/**
 * Baked-prefab dungeon scene. Replaces the procedural geometry path in
 * `DungeonScene.tsx` with a single GLB scene used as the static layout,
 * while still spawning enemies + a boss procedurally on top.
 *
 * Selection: one of {@link BAKED_DUNGEON_PREFABS} is picked
 * deterministically from `dungeonSeed` so each portal entry yields a
 * different layout, and revisiting a seed reproduces the same one.
 *
 * Geometry: the GLB is loaded through the shared Suspense-aware
 * `useAsset` cache, cloned (so two simultaneous entries don't share
 * mutated transforms), shadow-flagged, and wrapped in a fixed
 * `<RigidBody colliders="trimesh">` — Rapier auto-bakes a triangle-mesh
 * collider per child mesh so the player & enemies collide against the
 * real walls/floor.
 *
 * Combat: the world AABB of the loaded scene is computed once; player
 * spawns near one corner, the exit portal sits at the diagonal corner,
 * 7-12 enemies + 1 boss spawn at seeded-random (x,z) inside an inset
 * bbox at floor-y. Enemy & boss types come from the existing per-theme
 * tables in `DungeonGenerator.ts` so leveling progression still maps
 * crypt/mine/temple → the right roster.
 */
import { Suspense, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useGame } from "@/lib/stores/useGame";
import { useAsset } from "../hooks/useAsset";
import { AssetLoaderInit } from "../systems/AssetLoaderInit";
import Player from "../components/Player";
import Camera from "../components/Camera";
import HUD from "../components/HUD";
import Enemy from "../components/Enemy";
import LootDropsRenderer from "../components/LootDrops";
import { useEnemyManager, type EnemyType } from "../systems/EnemyManager";
import { VFXSystem } from "../vfx";
import {
  THEME_FOR_LEVEL,
  THEME_ENEMY_TYPES,
  THEME_BOSS_TYPES,
  type DungeonTheme,
} from "./DungeonGenerator";
import {
  BAKED_DUNGEON_PREFABS,
  pickPrefabForSeed,
  SeededRandom,
  type BakedDungeonPrefab,
} from "./BakedDungeonPrefabs";

// Same control map as the procedural DungeonScene so muscle-memory
// transfers between dungeon flavors.
const controls = [
  { name: "forward", keys: ["KeyW", "ArrowUp"] },
  { name: "backward", keys: ["KeyS", "ArrowDown"] },
  { name: "left", keys: ["KeyA", "ArrowLeft"] },
  { name: "right", keys: ["KeyD", "ArrowRight"] },
  { name: "sprint", keys: ["ShiftLeft", "ShiftRight"] },
  { name: "jump", keys: ["Space"] },
  { name: "use", keys: ["KeyF"] },
  { name: "craft", keys: ["KeyC"] },
  { name: "crouch", keys: ["ControlLeft", "ControlRight", "KeyZ"] },
  { name: "roll", keys: ["ControlLeft", "ControlRight"] },
  { name: "modeSwitch", keys: ["KeyQ"] },
  { name: "classAbility", keys: ["KeyR"] },
  { name: "classAbility2", keys: ["KeyE"] },
];

// Compact per-theme lighting / fog palette. Re-derived from the larger
// THEME_COLORS table in `DungeonScene.tsx` — kept inline so the baked
// scene doesn't pull in the procedural file's heavy import graph.
interface BakedThemeColors {
  ambient: string;
  ambientIntensity: number;
  directional: string;
  directionalIntensity: number;
  fog: string;
  fogNear: number;
  fogFar: number;
  portal: string;
  portalEmissive: string;
}

const BAKED_THEME_COLORS: Record<DungeonTheme, BakedThemeColors> = {
  crypt: {
    ambient: "#445566",
    ambientIntensity: 0.55,
    directional: "#8899bb",
    directionalIntensity: 0.7,
    fog: "#10101a",
    fogNear: 12,
    fogFar: 80,
    portal: "#33cc66",
    portalEmissive: "#33cc66",
  },
  mine: {
    ambient: "#665544",
    ambientIntensity: 0.6,
    directional: "#ccaa77",
    directionalIntensity: 0.75,
    fog: "#1a1208",
    fogNear: 12,
    fogFar: 80,
    portal: "#ffaa33",
    portalEmissive: "#ffaa33",
  },
  temple: {
    ambient: "#556677",
    ambientIntensity: 0.65,
    directional: "#aaccdd",
    directionalIntensity: 0.85,
    fog: "#15151c",
    fogNear: 14,
    fogFar: 90,
    portal: "#ddccff",
    portalEmissive: "#ddccff",
  },
};

interface NormalizedPrefab {
  /** Cloned + shadow-prepped scene root, ready to drop into a primitive. */
  scene: THREE.Object3D;
  /** Final world-space AABB after scale/clone. */
  bbox: THREE.Box3;
  /** Player spawn (near "entry" corner of bbox), y is floor + 2. */
  spawnPoint: [number, number, number];
  /** Exit portal location at the diagonal corner. */
  exitPoint: [number, number, number];
  /** Floor y used as the spawn height for enemies. */
  floorY: number;
}

/**
 * Clone the loaded GLTF scene, enable shadows on every mesh, scale per
 * the prefab spec, and derive the AABB / spawn / exit / floor metadata
 * the rest of the scene needs. Memoized at the call site by `useMemo`.
 */
function normalizePrefab(
  gltfScene: THREE.Object3D,
  prefab: BakedDungeonPrefab,
): NormalizedPrefab {
  const scene = gltfScene.clone(true);
  scene.scale.setScalar(prefab.scale);

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if ((mesh as any).isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Many baked GLBs ship with double-sided thin materials that
      // hurt shadow quality; flip them to front-side for cheaper
      // trimesh colliders + correct backface culling.
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) {
        const fix = (m: THREE.Material) => {
          if (m && (m as any).side === THREE.DoubleSide) {
            (m as any).side = THREE.FrontSide;
          }
        };
        if (Array.isArray(mat)) mat.forEach(fix);
        else fix(mat);
      }
    }
  });

  scene.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(scene);

  // Defensive fallback — if the GLB is empty or all-degenerate, give
  // the player a 30x30 sandbox so the scene still mounts.
  if (!isFinite(bbox.min.x) || bbox.isEmpty()) {
    bbox.set(
      new THREE.Vector3(-15, 0, -15),
      new THREE.Vector3(15, 5, 15),
    );
  }

  const sx = bbox.max.x - bbox.min.x;
  const sz = bbox.max.z - bbox.min.z;
  const floorY = bbox.min.y;

  // Player & exit hug opposite corners (20% / 80% along each axis) so
  // the room reads as "fight your way across to escape."
  const spawnPoint: [number, number, number] = [
    bbox.min.x + sx * 0.2,
    floorY + 2,
    bbox.min.z + sz * 0.2,
  ];
  const exitPoint: [number, number, number] = [
    bbox.min.x + sx * 0.8,
    floorY + 0.1,
    bbox.min.z + sz * 0.8,
  ];

  return { scene, bbox, spawnPoint, exitPoint, floorY };
}

/**
 * The static prefab geometry mounted as a single fixed rigid body with
 * Rapier auto-baked trimesh colliders covering every child mesh.
 */
function BakedDungeonGeometry({ scene }: { scene: THREE.Object3D }) {
  return (
    <RigidBody type="fixed" colliders="trimesh">
      <primitive object={scene} />
    </RigidBody>
  );
}

/**
 * Compact lighting rig for the baked scene. Hemisphere fill + a single
 * directional shadow caster, theme-tinted. Enough to read silhouettes
 * without the procedural scene's per-room torch system.
 */
function BakedDungeonLighting({ theme, bbox }: { theme: DungeonTheme; bbox: THREE.Box3 }) {
  const tc = BAKED_THEME_COLORS[theme];
  // Place the directional caster above the dungeon center so its
  // frustum hugs the actual playable area.
  const cx = (bbox.min.x + bbox.max.x) * 0.5;
  const cz = (bbox.min.z + bbox.max.z) * 0.5;
  const halfX = Math.max(20, (bbox.max.x - bbox.min.x) * 0.6);
  const halfZ = Math.max(20, (bbox.max.z - bbox.min.z) * 0.6);
  return (
    <group>
      <ambientLight intensity={tc.ambientIntensity} color={tc.ambient} />
      <hemisphereLight
        args={[tc.ambient, "#0a0a10", tc.ambientIntensity * 0.9]}
      />
      <directionalLight
        position={[cx + 10, bbox.max.y + 25, cz + 10]}
        intensity={tc.directionalIntensity}
        color={tc.directional}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-halfX}
        shadow-camera-right={halfX}
        shadow-camera-top={halfZ}
        shadow-camera-bottom={-halfZ}
        shadow-camera-near={1}
        shadow-camera-far={100}
        shadow-bias={-0.0008}
      />
    </group>
  );
}

/**
 * Spawns 7-12 enemies + 1 boss inside the prefab's inset bbox, picked
 * deterministically from `seed`. Enemy types are pulled from the
 * level's theme table so a Crypt run still feels like a Crypt run.
 *
 * Each enemy is offset from the player's spawn corner to avoid instant
 * aggro on entry; the boss is forced to the far corner.
 *
 * Spawn validity: every candidate (x,z) is checked with two raycasts
 * against the actual prefab geometry — a downward ray to find the
 * floor (rejecting void columns the bbox-only sampling would happily
 * pick), and an upward ray from chest height to detect "stuck in
 * wall" cases (a low overhead hit means the candidate is inside a
 * solid mesh). This avoids enemies popping inside walls, which Rapier
 * penetration resolution can't reliably untangle for trimesh shapes.
 *
 * Lifecycle: every staggered `setTimeout` is tracked and cleared on
 * unmount/dep-change, and a `cancelled` flag short-circuits any
 * timer that fires during teardown. Without this, exiting a dungeon
 * while spawns are pending would leak enemies into the next scene.
 */
function BakedEnemySpawner({
  prefab,
  scene,
  bbox,
  floorY,
  spawnPoint,
  exitPoint,
  theme,
  seed,
}: {
  prefab: BakedDungeonPrefab;
  scene: THREE.Object3D;
  bbox: THREE.Box3;
  floorY: number;
  spawnPoint: [number, number, number];
  exitPoint: [number, number, number];
  theme: DungeonTheme;
  seed: number;
}) {
  const { spawnEnemy } = useEnemyManager();

  useEffect(() => {
    const rng = new SeededRandom(seed || 1);
    const enemyTypes = THEME_ENEMY_TYPES[theme] ?? THEME_ENEMY_TYPES.crypt;
    const bossTypes = THEME_BOSS_TYPES[theme] ?? THEME_BOSS_TYPES.crypt;

    const inset = prefab.spawnInset;
    const minX = bbox.min.x + inset;
    const maxX = bbox.max.x - inset;
    const minZ = bbox.min.z + inset;
    const maxZ = bbox.max.z - inset;
    const playerXZ = new THREE.Vector2(spawnPoint[0], spawnPoint[2]);

    // Reusable raycaster + scratch vectors so spawn-validation rays
    // don't allocate per-attempt.
    const raycaster = new THREE.Raycaster();
    const downDir = new THREE.Vector3(0, -1, 0);
    const upDir = new THREE.Vector3(0, 1, 0);
    const origin = new THREE.Vector3();

    /** Cast straight down to find the floor y at (x,z); null if void. */
    const findFloorY = (x: number, z: number): number | null => {
      origin.set(x, bbox.max.y + 5, z);
      raycaster.set(origin, downDir);
      raycaster.far = (bbox.max.y - bbox.min.y) + 10;
      const hits = raycaster.intersectObject(scene, true);
      return hits.length > 0 ? hits[0].point.y : null;
    };

    /**
     * Cheap "am I stuck in a wall?" check. Cast upward from chest
     * height; if the first hit is closer than ~0.6 units, the spawn
     * point is inside solid geometry (a wall/ceiling pressing down
     * on a torso-tall capsule).
     */
    const headroomClear = (x: number, fy: number, z: number): boolean => {
      origin.set(x, fy + 1.0, z);
      raycaster.set(origin, upDir);
      raycaster.far = 1.5;
      const hits = raycaster.intersectObject(scene, true);
      return hits.length === 0 || hits[0].distance > 0.6;
    };

    /**
     * Sample (x,z) within the inset bbox until we find one at least
     * `minDist` from the player's spawn corner AND backed by real
     * floor AND with headroom. Falls back after `maxAttempts` so an
     * over-tight prefab still spawns something instead of looping.
     */
    const samplePos = (minDist: number, fallback?: [number, number]) => {
      for (let attempt = 0; attempt < 30; attempt++) {
        const x = minX + rng.next() * (maxX - minX);
        const z = minZ + rng.next() * (maxZ - minZ);
        const d = playerXZ.distanceTo(new THREE.Vector2(x, z));
        if (d < minDist) continue;
        const fy = findFloorY(x, z);
        if (fy === null) continue;
        if (!headroomClear(x, fy, z)) continue;
        // Lift slightly above floor so the enemy doesn't spawn
        // overlapping the trimesh collider.
        return new THREE.Vector3(x, fy + 0.6, z);
      }
      // Fallback: use the supplied known-safe anchor (or bbox center)
      // and look up its floor — never trust the prefab's measured
      // `floorY` blindly because that's just the bbox min.
      const fx = fallback ? fallback[0] : (minX + maxX) * 0.5;
      const fz = fallback ? fallback[1] : (minZ + maxZ) * 0.5;
      const fy = findFloorY(fx, fz) ?? floorY;
      return new THREE.Vector3(fx, fy + 0.6, fz);
    };

    const enemyCount = rng.int(prefab.enemyMin, prefab.enemyMax);
    console.log(
      `[BakedDungeon] Prefab ${prefab.id} (${prefab.name}) ` +
      `theme=${theme} enemies=${enemyCount} bossTypes=${bossTypes.join("|")} ` +
      `bbox=[${bbox.min.x.toFixed(1)},${bbox.min.z.toFixed(1)} → ` +
      `${bbox.max.x.toFixed(1)},${bbox.max.z.toFixed(1)}] floor=${floorY.toFixed(2)}`,
    );

    // Stagger spawns slightly so the EnemyManager + render loop don't
    // ingest a dozen new entities in the same frame. Track every timer
    // so we can cancel pending spawns when the player exits early.
    let cancelled = false;
    const timerIds: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < enemyCount; i++) {
      const pos = samplePos(prefab.enemyMinDistFromPlayer);
      const type = rng.pick(enemyTypes) as EnemyType;
      const id = setTimeout(() => {
        if (cancelled) return;
        spawnEnemy(type, pos);
      }, i * 100);
      timerIds.push(id);
    }

    // Boss anchored near the exit so the player has to fight past him
    // to leave. Falls back to the exit corner if no in-bbox sample
    // satisfies the distance constraint.
    const bossPos = samplePos(
      prefab.bossMinDistFromPlayer,
      [exitPoint[0], exitPoint[2]],
    );
    const bossType = rng.pick(bossTypes) as EnemyType;
    const bossId = setTimeout(() => {
      if (cancelled) return;
      console.log(
        `[BakedDungeon] Spawning boss ${bossType} at ` +
        `(${bossPos.x.toFixed(1)}, ${bossPos.z.toFixed(1)})`,
      );
      spawnEnemy(bossType, bossPos);
    }, enemyCount * 100 + 500);
    timerIds.push(bossId);

    return () => {
      cancelled = true;
      for (const id of timerIds) clearTimeout(id);
    };
  }, [prefab, scene, bbox, floorY, spawnPoint, exitPoint, theme, seed, spawnEnemy]);

  return null;
}

/**
 * Exit portal: walk into it and press T to leave the dungeon. Smaller
 * cousin of `ExitPortal` in `DungeonScene.tsx`, sharing the same
 * `__dungeonExit` window flag set by `BakedDungeonInteractionHandler`.
 */
function BakedExitPortal({
  position,
  playerPositionRef,
  theme,
}: {
  position: [number, number, number];
  playerPositionRef: React.MutableRefObject<THREE.Vector3>;
  theme: DungeonTheme;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const cooldown = useRef(false);
  const { exitDungeon, addScore } = useGame();
  const tc = BAKED_THEME_COLORS[theme];

  useFrame(() => {
    if (ringRef.current) ringRef.current.rotation.y += 0.02;

    const dist = playerPositionRef.current.distanceTo(
      new THREE.Vector3(position[0], position[1] + 1, position[2]),
    );
    if (dist < 3 && !cooldown.current) {
      if ((window as any).__dungeonExit) {
        cooldown.current = true;
        addScore(50);
        exitDungeon();
      }
    }
  });

  return (
    <group position={position}>
      <mesh ref={ringRef} position={[0, 2, 0]}>
        <torusGeometry args={[1.5, 0.25, 16, 32]} />
        <meshStandardMaterial
          color={tc.portal}
          emissive={tc.portalEmissive}
          emissiveIntensity={0.8}
        />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <circleGeometry args={[1.2, 32]} />
        <meshStandardMaterial
          color={tc.portal}
          emissive={tc.portalEmissive}
          emissiveIntensity={2}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight
        position={[0, 2.5, 0]}
        color={tc.portal}
        intensity={5}
        distance={10}
      />
    </group>
  );
}

/**
 * Mirrors `DungeonInteractionHandler` from `DungeonScene.tsx`: pressing
 * T sets the shared `__dungeonExit` / `__dungeonInteract` window flags
 * for one frame so the exit portal (and any other interaction-aware
 * mounts) can react.
 */
function BakedDungeonInteractionHandler() {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "KeyT") {
        (window as any).__dungeonInteract = true;
        (window as any).__dungeonExit = true;
        setTimeout(() => {
          (window as any).__dungeonInteract = false;
          (window as any).__dungeonExit = false;
        }, 200);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
  return null;
}

/**
 * Inner content — runs inside `<Physics>` so colliders mount cleanly.
 * Loads the prefab GLB through Suspense, normalizes it, then mounts
 * geometry, lighting, spawner, player, exit, and combat renderers.
 */
function BakedDungeonContent({
  prefab,
  theme,
  seed,
}: {
  prefab: BakedDungeonPrefab;
  theme: DungeonTheme;
  seed: number;
}) {
  const gltf = useAsset(prefab.modelPath);
  const { enemies } = useEnemyManager();

  const normalized = useMemo(
    () => normalizePrefab(gltf.scene, prefab),
    [gltf, prefab],
  );

  const playerPosRef = useRef(
    new THREE.Vector3(
      normalized.spawnPoint[0],
      normalized.spawnPoint[1],
      normalized.spawnPoint[2],
    ),
  );

  // Re-seat the player position ref whenever the prefab changes so a
  // re-entry doesn't carry the previous dungeon's last position into
  // the new layout.
  useEffect(() => {
    playerPosRef.current.set(
      normalized.spawnPoint[0],
      normalized.spawnPoint[1],
      normalized.spawnPoint[2],
    );
  }, [normalized]);

  const handlePlayerPositionUpdate = (pos: THREE.Vector3) => {
    playerPosRef.current.copy(pos);
    useGame.getState().updatePlayerPosition(pos);
  };

  const tc = BAKED_THEME_COLORS[theme];

  return (
    <>
      <BakedDungeonLighting theme={theme} bbox={normalized.bbox} />
      <BakedDungeonGeometry scene={normalized.scene} />
      <BakedEnemySpawner
        prefab={prefab}
        scene={normalized.scene}
        bbox={normalized.bbox}
        floorY={normalized.floorY}
        spawnPoint={normalized.spawnPoint}
        exitPoint={normalized.exitPoint}
        theme={theme}
        seed={seed}
      />
      <Player
        onPositionUpdate={handlePlayerPositionUpdate}
        spawnPosition={normalized.spawnPoint}
      />
      <BakedExitPortal
        position={normalized.exitPoint}
        playerPositionRef={playerPosRef}
        theme={theme}
      />
      {enemies.map((enemy) => (
        <Enemy
          key={enemy.id}
          data={enemy}
          playerPosition={playerPosRef.current}
          pathfindFn={null}
        />
      ))}
      <LootDropsRenderer playerPosition={playerPosRef.current} />
      <Camera playerPosition={playerPosRef.current} />
      <fog attach="fog" args={[tc.fog, tc.fogNear, tc.fogFar]} />
    </>
  );
}

/**
 * Top-level baked-dungeon scene. Drop-in replacement for `DungeonScene`
 * that consumes the same `useGame.dungeonSeed` / `dungeonLevel` state.
 * Picks one of {@link BAKED_DUNGEON_PREFABS} per entry (deterministic
 * by seed), loads it, and renders Player + procedural enemies inside.
 */
export default function BakedDungeonScene() {
  const { dungeonSeed, dungeonLevel } = useGame();

  const prefab = useMemo(
    () => pickPrefabForSeed(dungeonSeed),
    [dungeonSeed],
  );
  const theme: DungeonTheme = THEME_FOR_LEVEL[dungeonLevel] ?? "crypt";

  return (
    <KeyboardControls map={controls}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{
          position: [0, 20, 15],
          fov: 50,
          near: 0.1,
          far: 300,
        }}
        gl={{
          antialias: false,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        onCreated={({ gl }) => {
          const c = gl.domElement;
          c.addEventListener("webglcontextlost", (e) => { e.preventDefault(); });
          c.addEventListener("webglcontextrestored", () => {});
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <AssetLoaderInit />
        <Suspense fallback={null}>
          <Physics gravity={[0, -20, 0]} timeStep="vary" interpolate={false}>
            <VFXSystem />
            <BakedDungeonContent
              prefab={prefab}
              theme={theme}
              seed={dungeonSeed}
            />
          </Physics>
        </Suspense>
      </Canvas>
      <HUD />
      <BakedDungeonInteractionHandler />
    </KeyboardControls>
  );
}
