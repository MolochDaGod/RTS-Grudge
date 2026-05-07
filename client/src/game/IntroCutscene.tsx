import { useRef, useMemo, useCallback, Suspense, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "@/lib/stores/useGame";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { useAsset, useAssets } from "./hooks/useAsset";
import { IntroStormDome } from "./sky/IntroStormDome";
import { importFromScene } from "./systems/AssetPipeline";
import { normalizeCharacterHeight } from "./systems/BoundsUtils";
import {
  captureRestPose,
  retargetClips,
  type RestPoseEntry,
  RIGHT_HAND_ALIASES,
  LEFT_HAND_ALIASES,
} from "./systems/BoneAliases";
import {
  ANIM_COMBAT_FILES,
  ANIM_SPECIAL_FILES,
  type IntroAnimEntry,
} from "./intro/animFiles";

const SHIP_PATH = "/models/pirate_quaternius/Ship_Large.glb";

// Beach surface Y for the wash-up shore. Slightly above the IntroOcean
// (whose top sits at Y = -0.5) so the wet sand reads as just-above-the-
// waterline rather than submerged. The thrown player lies on this Y so
// the body stays flat on the beach instead of clipping into it.
const SHORE_Y = -0.35;

// World-Y of the player's ship deck where crew + the thrown player stand.
// The player ship is `IntroShip` at scale 1.4 (height ~11.2). Quaternius
// pirate ships put the deck around ~30-35% of total height above the
// model origin, which lands the deck near Y = 3.4. Crew/player feet
// math is keyed off this constant so the deck height is tweakable in
// one place if the model swap shifts the visible deck plane.
const DECK_Y = 3.4;

// Mixamo-style packs (one clip per file) — same source the in-game characters
// already retarget against. Loading several files in parallel and stitching
// the clips into one virtual "pack" lets the existing keyword-pick code in
// each cutscene component work as-is. The clip-name mapping (combat /
// special) lives in `./intro/animFiles` so the menu-screen preloader can
// warm the same files without dragging the rest of this scene into its
// bundle. Multi-clip packs (e.g. the KayKit "Rig_Medium_*" packs used for
// the bespoke grab/lift/throw motion) cherry-pick a clip via `entry.clipName`.

function findClipByKeywords(
  clips: THREE.AnimationClip[],
  keywords: string[],
  fallbackIndex: number
): number {
  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    const idx = clips.findIndex((c) => c.name.toLowerCase().includes(lower));
    if (idx >= 0) return idx;
  }
  return Math.min(fallbackIndex, Math.max(0, clips.length - 1));
}

const CARRIER_PATHS = [
  "/models/characters/human_battle_mage-male.glb",
  "/models/characters/undead_grave_knight-male.glb",
  "/models/characters/undead_grave_knight-male.glb",
  "/models/characters/night_stalker-male.glb",
];

const GRAVITY = 9.81;
const CANNON_SPEED = 28;

const TIMELINE = {
  start: 0,
  shipApproach: 0,
  firstVolley: 1.5,
  secondVolley: 3.0,
  thirdVolley: 4.2,
  deckFight: 2.0,
  grabPlayer: 5.0,
  throwStart: 6.5,
  throwPeak: 7.5,
  splashHit: 8.2,
  underwater: 9.0,
  logoShow: 9.5,
  logoHold: 12.0,
  washUpStart: 12.5,
  washUpEnd: 14.5,
  fadeOut: 15.0,
  end: 16.0,
};

const introState = {
  time: 0,
  showLogo: false,
  fadeOpacity: 0,
  finished: false,
};

// Registry of resolved hand bones for each crew member, keyed by their crew
// index. Populated by `AnimatedCrewMember` once its skinned scene has loaded
// and torn down on unmount. `ThrownCharacter` reads from this during the grab
// phase so the player visually attaches to whichever crew member is closest
// (no hard-coded index — this stays correct when the crew formation/order is
// randomized). We prefer the right hand, falling back to the left.
type CrewHandRecord = {
  rightHand: THREE.Object3D | null;
  leftHand: THREE.Object3D | null;
};
const crewHandRegistry: Map<number, CrewHandRecord> = new Map();

function normalizeBoneName(name: string): string {
  return (name || "").toLowerCase();
}

function findCrewBoneByAliases(
  root: THREE.Object3D,
  aliases: readonly string[],
): THREE.Object3D | null {
  const lowerSet = new Set(aliases.map((a) => a.toLowerCase()));
  let found: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (found) return;
    if (lowerSet.has(normalizeBoneName(obj.name))) found = obj;
  });
  return found;
}

function projectilePosition(
  origin: THREE.Vector3,
  velocity: THREE.Vector3,
  t: number
): THREE.Vector3 {
  return new THREE.Vector3(
    origin.x + velocity.x * t,
    origin.y + velocity.y * t - 0.5 * GRAVITY * t * t,
    origin.z + velocity.z * t
  );
}

function computeLaunchVelocity(
  from: THREE.Vector3,
  to: THREE.Vector3,
  launchAngle: number
): THREE.Vector3 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);
  const dy = to.y - from.y;

  const angleRad = launchAngle * (Math.PI / 180);
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const tanA = Math.tan(angleRad);

  const denom = 2 * cosA * cosA * (horizontalDist * tanA - dy);
  let speed: number;
  if (Math.abs(denom) < 0.01) {
    speed = CANNON_SPEED;
  } else {
    const v2 = (GRAVITY * horizontalDist * horizontalDist) / denom;
    speed = v2 > 0 ? Math.sqrt(v2) : CANNON_SPEED;
  }
  const dirXZ = Math.atan2(dz, dx);

  return new THREE.Vector3(
    speed * cosA * Math.cos(dirXZ),
    speed * sinA,
    speed * cosA * Math.sin(dirXZ)
  );
}

interface Cannonball {
  id: number;
  origin: THREE.Vector3;
  velocity: THREE.Vector3;
  fireTime: number;
  flightDuration: number;
  target: THREE.Vector3;
  hit: boolean;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 123457) % 2147483647;
    return (s & 0x7fffffff) / 2147483647;
  };
}

let cachedCannonballs: Cannonball[] | null = null;

function generateCannonballs(): Cannonball[] {
  if (cachedCannonballs) return cachedCannonballs;

  const rng = seededRandom(42424242);
  const balls: Cannonball[] = [];
  const enemyShipPos = new THREE.Vector3(-35, 2, -20);
  const playerShipPos = new THREE.Vector3(0, DECK_Y, 0);
  let id = 0;

  const volleys = [
    { time: TIMELINE.firstVolley, count: 3, fromEnemy: true },
    { time: TIMELINE.secondVolley, count: 4, fromEnemy: false },
    { time: TIMELINE.thirdVolley, count: 3, fromEnemy: true },
    { time: TIMELINE.thirdVolley + 0.3, count: 2, fromEnemy: false },
    { time: TIMELINE.grabPlayer - 0.5, count: 2, fromEnemy: true },
  ];

  for (const volley of volleys) {
    for (let i = 0; i < volley.count; i++) {
      const from = volley.fromEnemy ? enemyShipPos.clone() : playerShipPos.clone();
      const to = volley.fromEnemy ? playerShipPos.clone() : enemyShipPos.clone();

      from.x += (rng() - 0.5) * 6;
      from.z += (rng() - 0.5) * 4;
      from.y += 2 + rng();
      to.x += (rng() - 0.5) * 8;
      to.z += (rng() - 0.5) * 6;

      const angle = 25 + rng() * 15;
      const vel = computeLaunchVelocity(from, to, angle);
      const disc = vel.y * vel.y + 2 * GRAVITY * (from.y - to.y);
      const tFlight = disc > 0 ? (vel.y + Math.sqrt(disc)) / GRAVITY : 1.5;

      balls.push({
        id: id++,
        origin: from,
        velocity: vel,
        fireTime: volley.time + i * 0.15,
        flightDuration: Math.max(tFlight, 0.8),
        target: to,
        hit: false,
      });
    }
  }
  cachedCannonballs = balls;
  return balls;
}

function useIntroModel(path: string, height: number) {
  const gltf = useAsset(path);
  return useMemo(() => {
    const clone = gltf.scene.clone(true);
    const normalized = importFromScene(clone, [], path, {
      targetHeight: height,
      sanitizeBones: false,
      fixDarkMaterials: true,
      enableShadows: false,
    });
    return normalized.scene;
  }, [gltf, path, height]);
}

// Module-level cache for intro animation packs so repeated mounts of the
// cutscene and multiple consumers (4 crew, 1 thrown player, 2 survivors)
// don't re-capture the source rest pose or re-pull GLBs.
//
// `rawClips` and `restMaps` are parallel arrays — `restMaps[i]` is the source
// rig's rest pose for `rawClips[i]`. We track this per-clip (rather than once
// per pack) because the cutscene now mixes rigs: most clips come from Mixamo
// packs while the bespoke "Throw" / "PickUp" grab beats come from the KayKit
// pack, which has different bone names and rest orientations. Retargeting
// each clip with its own source rest is the only way to keep both groups
// pose-correct on the target character.
type IntroAnimPack = {
  rawClips: THREE.AnimationClip[];   // named per IntroAnimEntry.name, source-rig bones
  restMaps: (Map<string, RestPoseEntry> | null)[];
};
const introPackCache = new WeakMap<IntroAnimEntry[], IntroAnimPack>();

function buildIntroPack(
  entries: IntroAnimEntry[],
  gltfs: Array<{ animations?: THREE.AnimationClip[]; scene?: THREE.Object3D } | null | undefined>,
): IntroAnimPack {
  const cached = introPackCache.get(entries);
  if (cached) return cached;
  const rawClips: THREE.AnimationClip[] = [];
  const restMaps: (Map<string, RestPoseEntry> | null)[] = [];
  // Cache rest poses by file path — multiple entries can point at the same
  // multi-clip GLB (e.g. KayKit Rig_Medium_General.glb provides both Throw
  // and PickUp), and capturing the rest pose once per source scene is enough.
  const restByFile = new Map<string, Map<string, RestPoseEntry> | null>();
  entries.forEach((entry, i) => {
    const gltf = gltfs[i];
    const anims = gltf?.animations ?? [];
    if (anims.length === 0) return;

    // Pick the requested clip from a multi-clip GLB; fall back to the first
    // clip when no `clipName` is supplied (the common single-clip Mixamo case)
    // or when the named clip can't be found.
    let src: THREE.AnimationClip | undefined;
    if (entry.clipName) {
      src = anims.find((a) => a.name === entry.clipName);
      if (!src) {
        console.warn(
          `[IntroCutscene] Clip "${entry.clipName}" not found in ${entry.file}; falling back to first clip "${anims[0].name}".`,
        );
      }
    }
    if (!src) src = anims[0];

    // Rename so findClipByKeywords sees `entry.name` rather than the file's
    // (often "mixamo.com" / "Armature|..." / "Throw") source name.
    const c = src.clone();
    c.name = entry.name;
    rawClips.push(c);

    // Capture or reuse the rest pose for this clip's source rig.
    let rest: Map<string, RestPoseEntry> | null = null;
    if (gltf?.scene) {
      const cached = restByFile.get(entry.file);
      if (cached !== undefined) {
        rest = cached;
      } else {
        try { rest = captureRestPose(gltf.scene); } catch { rest = null; }
        restByFile.set(entry.file, rest);
      }
    }
    restMaps.push(rest);
  });
  const pack: IntroAnimPack = { rawClips, restMaps };
  introPackCache.set(entries, pack);
  return pack;
}

// Tracks (target model, clip name) pairs we've already warned about so the
// "no bound tracks" message fires once per character + clip rather than
// every frame or every cutscene mount.
const warnedPairs = new Set<string>();

/**
 * When `enabledFn()` returns true on a given frame, applies a tiny
 * breathing / weight-shift wobble to the `innerRef` group. Used as a
 * defensive fallback when the *currently selected* Mixamo clip failed to
 * bind to the target rig — keeps that character from reading as a
 * perfectly frozen statue during the affected phase, while staying out
 * of the way once a phase swaps to a clip that did bind. The predicate
 * is evaluated per-frame so callers can flip it as the cutscene phases
 * change. Wobble lives on a child group so the parent's procedural
 * position/rotation logic is untouched.
 */
function useFallbackBodyWobble(
  innerRef: React.RefObject<THREE.Group>,
  enabledFn: () => boolean,
  seed = 0,
) {
  useFrame(() => {
    if (!enabledFn()) return;
    const g = innerRef.current;
    if (!g) return;
    const t = introState.time + seed;
    g.rotation.x = Math.sin(t * 1.3) * 0.04;
    g.rotation.y = Math.sin(t * 0.9 + 1.0) * 0.05;
    g.rotation.z = Math.sin(t * 1.7 + 2.0) * 0.03;
    g.position.y = Math.sin(t * 1.1) * 0.02;
  });
}

function useIntroAnimatedModel(
  modelPath: string,
  animFiles: IntroAnimEntry[],
  height: number,
) {
  const modelGltf = useAsset(modelPath);
  const animGltfs = useAssets(animFiles.map((e) => e.file));

  return useMemo(() => {
    // Skinned characters MUST be cloned with SkeletonUtils.clone so the
    // SkinnedMesh.skeleton is rebuilt against the new bone hierarchy. A
    // plain `scene.clone(true)` shares the original skeleton across every
    // instance and is one of the classic "duplicate skeleton / model goes
    // nuts" footguns in three.js.
    const cloned = SkeletonUtils.clone(modelGltf.scene);

    // Single canonical sizing function shared with the in-game character
    // pipeline and the Hero Forge preview. Do NOT route this through the
    // AssetPipeline / longest-axis path — that gave the cutscene heroes a
    // different size than the in-game player for the same model.
    normalizeCharacterHeight(cloned, height);

    // Build / fetch the source pack (per-clip rest poses + raw clips), then
    // route through the SAME retargeter the in-game character pipeline uses
    // (BoneAliases.retargetClips). This handles `mixamorig:*` namespaces,
    // sanitised bone names, and the project-wide alias map so a Mixamo
    // pack binds cleanly onto every race rig (CC4, KayKit, Quaternius,
    // Reallusion, etc.) without producing twisted limbs.
    //
    // Retarget per-clip rather than per-pack so clips sourced from a
    // different rig (e.g. the KayKit Throw / PickUp grab clips alongside
    // Mixamo punches) each use the correct source rest pose. Otherwise the
    // delta-from-rest math in `rewriteQuaternionTrack` falls back to
    // pass-through (no source rest match) and the off-rig clip plays as
    // absolute source-space rotations on the target — i.e. twisted limbs.
    const pack = buildIntroPack(animFiles, animGltfs);
    const clips: THREE.AnimationClip[] = [];
    for (let i = 0; i < pack.rawClips.length; i++) {
      const out = retargetClips([pack.rawClips[i]], cloned, pack.restMaps[i]);
      clips.push(...out);
    }

    // Defensive log: per-clip rather than per-pack so a single dropped
    // clip (e.g. only the rig's tumble didn't bind) still surfaces. The
    // dedupe key is `modelPath + clipName` to match the requested
    // "once per character/clip pair" behavior — a duplicate cutscene
    // mount or a second character of the same race won't re-spam.
    const trackCounts = new Map<string, number>();
    for (const clip of clips) {
      trackCounts.set(clip.name, clip.tracks.length);
      if (clip.tracks.length === 0) {
        const key = `${modelPath}::${clip.name}`;
        if (!warnedPairs.has(key)) {
          warnedPairs.add(key);
          console.warn(
            `[IntroCutscene] Clip "${clip.name}" bound zero tracks on "${modelPath}" — rig is missing bones the alias map covers. Falling back to procedural sway whenever this clip would play.`,
          );
        }
      }
    }

    const mixer = clips.length > 0 ? new THREE.AnimationMixer(cloned) : null;
    const hasTracksAt = (idx: number): boolean => {
      const c = clips[idx];
      return !!c && c.tracks.length > 0;
    };

    return { scene: cloned, mixer, clips, trackCounts, hasTracksAt };
  }, [modelGltf, animGltfs, modelPath, animFiles, height]);
}

function IntroShip({ position, rotationY, scale = 1 }: { position: [number, number, number]; rotationY: number; scale?: number }) {
  const model = useIntroModel(SHIP_PATH, 8 * scale);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = introState.time;
    groupRef.current.position.y = position[1] + Math.sin(t * 0.8 + position[0] * 0.1) * 0.4;
    groupRef.current.rotation.z = Math.sin(t * 0.6 + position[0]) * 0.03;
    groupRef.current.rotation.x = Math.sin(t * 0.4) * 0.015;
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

function CannonballSystem() {
  const cannonballs = useMemo(() => generateCannonballs(), []);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  const trailRefs = useRef<(THREE.Points | null)[]>([]);
  const trailGeometries = useMemo(() => {
    return cannonballs.map(() => {
      const count = 12;
      const pos = new Float32Array(count * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return { geo, count };
    });
  }, [cannonballs]);

  useFrame(() => {
    const t = introState.time;

    cannonballs.forEach((ball, idx) => {
      const mesh = meshRefs.current[idx];
      if (!mesh) return;

      const elapsed = t - ball.fireTime;
      if (elapsed < 0 || elapsed > ball.flightDuration + 0.5) {
        mesh.visible = false;
        if (trailRefs.current[idx]) trailRefs.current[idx]!.visible = false;
        return;
      }

      if (elapsed <= ball.flightDuration) {
        mesh.visible = true;
        const pos = projectilePosition(ball.origin, ball.velocity, elapsed);
        mesh.position.copy(pos);

        mesh.rotation.x += 0.15;
        mesh.rotation.z += 0.1;

        const trail = trailRefs.current[idx];
        if (trail) {
          trail.visible = true;
          const trailAttr = trail.geometry.getAttribute("position") as THREE.BufferAttribute;
          for (let ti = 0; ti < trailGeometries[idx].count; ti++) {
            const trailT = Math.max(0, elapsed - ti * 0.03);
            const trailPos = projectilePosition(ball.origin, ball.velocity, trailT);
            trailAttr.setXYZ(ti, trailPos.x, trailPos.y, trailPos.z);
          }
          trailAttr.needsUpdate = true;
        }
      } else {
        mesh.visible = false;
        if (trailRefs.current[idx]) trailRefs.current[idx]!.visible = false;
      }
    });
  });

  return (
    <group>
      {cannonballs.map((ball, idx) => (
        <group key={ball.id}>
          <mesh
            ref={(el) => { meshRefs.current[idx] = el; }}
            visible={false}
          >
            <sphereGeometry args={[0.25, 8, 6]} />
            <meshStandardMaterial color="#222" metalness={0.8} roughness={0.3} />
          </mesh>
          <points
            ref={(el) => { trailRefs.current[idx] = el; }}
            visible={false}
            geometry={trailGeometries[idx].geo}
          >
            <pointsMaterial color="#ff6600" size={0.12} transparent opacity={0.6} depthWrite={false} />
          </points>
        </group>
      ))}
    </group>
  );
}

function ExplosionSystem() {
  const explosionData = useMemo(() => {
    const count = 200;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const elev = (Math.random() - 0.3) * Math.PI;
      const speed = 3 + Math.random() * 8;
      vel[i * 3] = Math.cos(angle) * Math.cos(elev) * speed;
      vel[i * 3 + 1] = Math.sin(elev) * speed + 4;
      vel[i * 3 + 2] = Math.sin(angle) * Math.cos(elev) * speed;
      const fireColor = Math.random();
      if (fireColor < 0.4) {
        colors[i * 3] = 1; colors[i * 3 + 1] = 0.4 + Math.random() * 0.3; colors[i * 3 + 2] = 0;
      } else if (fireColor < 0.7) {
        colors[i * 3] = 1; colors[i * 3 + 1] = 0.7 + Math.random() * 0.3; colors[i * 3 + 2] = 0;
      } else {
        colors[i * 3] = 0.3; colors[i * 3 + 1] = 0.3; colors[i * 3 + 2] = 0.3;
      }
    }
    return { pos, vel, colors, count };
  }, []);

  const pointsRef = useRef<THREE.Points>(null);
  const cannonballs = useMemo(() => generateCannonballs(), []);

  useFrame(() => {
    if (!pointsRef.current) return;
    const t = introState.time;

    let activeExplosion: Cannonball | null = null;
    let explosionAge = 0;
    for (const ball of cannonballs) {
      const impactTime = ball.fireTime + ball.flightDuration;
      const age = t - impactTime;
      if (age >= 0 && age < 1.5) {
        if (!activeExplosion || age < explosionAge) {
          activeExplosion = ball;
          explosionAge = age;
        }
      }
    }

    if (!activeExplosion) {
      pointsRef.current.visible = false;
      return;
    }

    pointsRef.current.visible = true;
    const impactPos = activeExplosion.target;
    pointsRef.current.position.set(impactPos.x, impactPos.y, impactPos.z);

    const posAttr = pointsRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    const dt = explosionAge;
    for (let i = 0; i < explosionData.count; i++) {
      posAttr.setXYZ(
        i,
        explosionData.vel[i * 3] * dt,
        explosionData.vel[i * 3 + 1] * dt - GRAVITY * dt * dt * 0.5,
        explosionData.vel[i * 3 + 2] * dt
      );
    }
    posAttr.needsUpdate = true;

    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = Math.max(0, 1 - dt * 0.8);
    mat.size = 0.15 + dt * 0.1;
  });

  return (
    <points ref={pointsRef} visible={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={explosionData.count}
          array={explosionData.pos}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={explosionData.count}
          array={explosionData.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={0.15}
        transparent
        opacity={1}
        depthWrite={false}
      />
    </points>
  );
}

function SmokeSystem() {
  const smokeData = useMemo(() => {
    const count = 40;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      vel[i * 3] = (Math.random() - 0.5) * 2;
      vel[i * 3 + 1] = 1 + Math.random() * 3;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    return { pos, vel, count };
  }, []);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame(() => {
    if (!pointsRef.current) return;
    const t = introState.time;

    const showSmoke = t > TIMELINE.firstVolley + 1.0 && t < TIMELINE.grabPlayer;
    if (!showSmoke) {
      pointsRef.current.visible = false;
      return;
    }

    pointsRef.current.visible = true;
    const posAttr = pointsRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;

    for (let i = 0; i < smokeData.count; i++) {
      const phase = (t * 0.5 + i * 0.3) % 3;
      posAttr.setXYZ(
        i,
        smokeData.vel[i * 3] * phase + Math.sin(t + i) * 0.5,
        smokeData.vel[i * 3 + 1] * phase,
        smokeData.vel[i * 3 + 2] * phase + Math.cos(t + i) * 0.5
      );
    }
    posAttr.needsUpdate = true;

    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = 0.3;
  });

  return (
    <points ref={pointsRef} position={[0, 2, 0]} visible={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={smokeData.count}
          array={smokeData.pos}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#555555"
        size={0.8}
        transparent
        opacity={0.3}
        depthWrite={false}
      />
    </points>
  );
}

function AnimatedCrewMember({ path, index }: { path: string; index: number }) {
  const { scene, mixer, clips, hasTracksAt } = useIntroAnimatedModel(path, ANIM_COMBAT_FILES, 1.8);
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const activeAction = useRef<THREE.AnimationAction | null>(null);
  const lastPhase = useRef("");
  // Index of the clip the most recent `playPhaseClip` call selected, so the
  // wobble fallback can flip on/off as different phases route to different
  // clips (one phase may bind cleanly while another doesn't).
  const activeClipIdx = useRef<number>(-1);

  useFallbackBodyWobble(
    innerRef,
    () => clips.length === 0 || (activeClipIdx.current >= 0 && !hasTracksAt(activeClipIdx.current)),
    index * 0.7,
  );

  // Each crew member gets a stable, role-appropriate combat animation so they
  // read as fighters rather than randomly cycling. Keywords match the Mixamo
  // pack clip names defined in ANIM_COMBAT_FILES (slash/attack/punch/hook/etc).
  const fightClipIdx = useMemo(() => {
    const fightKeywords = [
      ["slash", "attack", "swing"],
      ["hook", "attack", "punch"],
      ["uppercut", "punch", "attack"],
      ["punch", "slash", "attack"],
    ];
    return findClipByKeywords(clips, fightKeywords[index % fightKeywords.length], index % Math.max(1, clips.length));
  }, [clips, index]);
  // "lift" / "throw" lead so the bespoke KayKit two-handed lift+overhead-toss
  // clip wins the keyword search; "grab" / "carry" / "pickup" stay as
  // fallbacks for any pack that doesn't ship the dedicated clip.
  const grabClipIdx = useMemo(
    () => findClipByKeywords(clips, ["lift", "throw", "grab", "carry", "pickup", "hold", "drag"], 0),
    [clips]
  );

  const baseOffset = useMemo(() => {
    // Spread across the player ship's deck (which is much wider than the
    // old raft). Y is the deck plane so feet rest on the planks.
    const positions = [
      new THREE.Vector3(-2.0, DECK_Y, -1.6),
      new THREE.Vector3(2.0, DECK_Y, -1.6),
      new THREE.Vector3(-1.6, DECK_Y, 1.6),
      new THREE.Vector3(1.6, DECK_Y, 1.6),
    ];
    return positions[index];
  }, [index]);

  useEffect(() => {
    return () => {
      if (mixer) {
        mixer.stopAllAction();
        mixer.uncacheRoot(scene);
      }
    };
  }, [mixer, scene]);

  // Register the hand bones so `ThrownCharacter` can attach the player to
  // the lifter's wrist during the grab phase. We resolve from the (already
  // imported & sanitized) skinned scene rather than searching every frame.
  useEffect(() => {
    if (!scene) return;
    const rightHand = findCrewBoneByAliases(scene, RIGHT_HAND_ALIASES);
    const leftHand = findCrewBoneByAliases(scene, LEFT_HAND_ALIASES);
    crewHandRegistry.set(index, { rightHand, leftHand });
    return () => {
      crewHandRegistry.delete(index);
    };
  }, [scene, index]);

  function playPhaseClip(phase: string, clipIdx: number) {
    if (!mixer || clips.length === 0) return;
    // Always track the *intended* clip, even if we early-exit because the
    // phase hasn't changed — the wobble fallback predicate reads this.
    activeClipIdx.current = clipIdx;
    if (lastPhase.current === phase) return;
    lastPhase.current = phase;
    if (activeAction.current) activeAction.current.fadeOut(0.25);
    const action = mixer.clipAction(clips[clipIdx]);
    action.reset().fadeIn(0.25).play();
    activeAction.current = action;
  }

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (mixer) mixer.update(delta);
    const t = introState.time;

    if (clips.length > 0 && mixer) {
      // Phase-driven, intuitive animation: fight during the volley → grab when
      // closing on the player → release after the throw.
      if (t < TIMELINE.grabPlayer) {
        playPhaseClip("fight", fightClipIdx);
      } else if (t < TIMELINE.throwStart + 1.0) {
        playPhaseClip("grab", grabClipIdx);
      } else {
        playPhaseClip("release", fightClipIdx);
      }
    } else if (clips.length === 0) {
      activeClipIdx.current = -1; // ensure wobble stays on when there's nothing to play
    }

    if (t < TIMELINE.grabPlayer) {
      const fightSway = Math.sin(t * 4 + index * 1.5) * 0.15;
      groupRef.current.position.set(
        baseOffset.x + fightSway,
        baseOffset.y + Math.abs(Math.sin(t * 3 + index)) * 0.1,
        baseOffset.z
      );
      const targetAngle = index < 2 ? Math.PI : 0;
      groupRef.current.rotation.y = targetAngle + Math.sin(t * 2 + index) * 0.3;
      groupRef.current.visible = true;
    } else if (t < TIMELINE.throwStart) {
      const grabT = (t - TIMELINE.grabPlayer) / (TIMELINE.throwStart - TIMELINE.grabPlayer);
      const convergeX = THREE.MathUtils.lerp(baseOffset.x, baseOffset.x * 0.5, grabT);
      const convergeZ = THREE.MathUtils.lerp(baseOffset.z, 0, grabT);
      groupRef.current.position.set(convergeX, baseOffset.y, convergeZ);
      groupRef.current.rotation.y = Math.atan2(-convergeX, -convergeZ);
      groupRef.current.visible = true;
    } else if (t < TIMELINE.throwStart + 1.0) {
      const throwAnimT = t - TIMELINE.throwStart;
      const spreadAngle = (index / 4) * Math.PI * 2 + Math.PI * 0.25;
      groupRef.current.position.set(
        baseOffset.x * 0.5 + Math.cos(spreadAngle) * throwAnimT * 2,
        baseOffset.y + Math.sin(throwAnimT * 8) * 0.1,
        Math.sin(spreadAngle) * throwAnimT * 2
      );
      groupRef.current.rotation.y = spreadAngle + Math.PI;
      groupRef.current.visible = true;
    } else {
      groupRef.current.visible = t < TIMELINE.logoShow;
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

function ThrownCharacter() {
  const selectedCharacter = useGame((s) => s.selectedCharacter);
  // Fallback to the playable Knight model (same as DEFAULT_CHARACTER in
  // useGame). The previous undead_grave_knight fallback is an NPC-only
  // model whose rig didn't match the in-game playable rigs and could
  // cause twisted-limb retargeting if `selectedCharacter` was ever
  // unset (e.g. brand-new save before character pick).
  const modelPath = selectedCharacter?.modelPath || "/models/characters/assassin-male.glb";
  const { scene, mixer, clips, hasTracksAt } = useIntroAnimatedModel(modelPath, ANIM_SPECIAL_FILES, 1.8);
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const activeAction = useRef<THREE.AnimationAction | null>(null);
  const lastPhase = useRef("");
  const activeClipIdx = useRef<number>(-1);

  useFallbackBodyWobble(
    innerRef,
    () => clips.length === 0 || (activeClipIdx.current >= 0 && !hasTracksAt(activeClipIdx.current)),
    0.0,
  );

  // Resolve named clips for each phase so the cutscene reads intuitively
  // regardless of how the animation file names its clips. Falls back to a
  // stable index if no matching name is present. Keywords are ordered so
  // "tumble_air" wins for the throw beat and "rise_getup" for the wash-up.
  const idleClipIdx = useMemo(
    () => findClipByKeywords(clips, ["idle", "stand", "breath"], 0),
    [clips]
  );
  const struggleClipIdx = useMemo(
    () => findClipByKeywords(clips, ["struggle", "hit", "stagger", "flinch", "react"], 1),
    [clips]
  );
  const thrownClipIdx = useMemo(
    () => findClipByKeywords(clips, ["tumble", "air", "fall", "thrown", "death"], 2),
    [clips]
  );
  // Wash-up uses the actual "fallen / death-lay" pose so the body reads as
  // collapsed on the sand, not bent over picking something up. The previous
  // ["getup","rise","wakeup",...] keyword set resolved to `pick_up_item.glb`
  // — a half-bent reach motion — which was the source of the player looking
  // mis-rigged during the beach beat. `death_lay` is the source's actual
  // limp / sprawled pose, which is what we want here.
  const washupClipIdx = useMemo(
    () => findClipByKeywords(clips, ["death", "lay", "lie", "fall_idle", "land", "idle"], 0),
    [clips]
  );

  useEffect(() => {
    return () => {
      if (mixer) {
        mixer.stopAllAction();
        mixer.uncacheRoot(scene);
      }
    };
  }, [mixer, scene]);

  const throwOrigin = useMemo(() => new THREE.Vector3(0, DECK_Y + 1.6, 0), []);
  const throwTarget = useMemo(() => new THREE.Vector3(4, -0.5, -18), []);
  const throwVelocity = useMemo(() => {
    const vel = computeLaunchVelocity(throwOrigin, throwTarget, 35);
    return vel;
  }, [throwOrigin, throwTarget]);

  // Picked once at the start of the grab phase (the crew member whose hand is
  // closest to the player) and held stable so the player doesn't snap between
  // lifters mid-beat. Reset whenever we leave the grab/throw window so a
  // re-mounted cutscene picks fresh.
  const chosenCrewIndex = useRef<number | null>(null);
  const tmpHandPos = useMemo(() => new THREE.Vector3(), []);
  const tmpFromPos = useMemo(() => new THREE.Vector3(), []);
  const tmpFinalPos = useMemo(() => new THREE.Vector3(), []);
  const idleStandPos = useMemo(() => new THREE.Vector3(0, DECK_Y, 0), []);

  function pickClosestCrewHand(): {
    bone: THREE.Object3D;
    record: CrewHandRecord;
    index: number;
  } | null {
    let bestIdx: number | null = null;
    let bestDist = Infinity;
    let bestBone: THREE.Object3D | null = null;
    let bestRecord: CrewHandRecord | null = null;
    crewHandRegistry.forEach((rec, idx) => {
      const bone = rec.rightHand ?? rec.leftHand;
      if (!bone) return;
      bone.updateMatrixWorld(true);
      bone.getWorldPosition(tmpHandPos);
      // Player stands at origin during the grab phase; horizontal distance is
      // the right metric (we don't care about hand height when picking).
      const dx = tmpHandPos.x;
      const dz = tmpHandPos.z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
        bestBone = bone;
        bestRecord = rec;
      }
    });
    if (bestIdx === null || !bestBone || !bestRecord) return null;
    return { bone: bestBone, record: bestRecord, index: bestIdx };
  }

  function playClip(phase: string, clipIndex: number, fadeIn = 0.25, oneShot = false) {
    if (!mixer || clips.length === 0) {
      activeClipIdx.current = -1;
      return;
    }
    const idx = clipIndex % clips.length;
    activeClipIdx.current = idx;
    if (lastPhase.current === phase) return;
    lastPhase.current = phase;
    if (activeAction.current) activeAction.current.fadeOut(fadeIn);
    const action = mixer.clipAction(clips[idx]);
    action.reset();
    // `oneShot` keeps the action on its last pose instead of looping back
    // to the start — crucial for held beats whose source clip is authored
    // as a one-shot (e.g. `death.glb` for the wash-up "fallen on the
    // beach" shot). Without this the pose would snap back to standing
    // partway through the held framing.
    if (oneShot) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    }
    action.fadeIn(fadeIn).play();
    activeAction.current = action;
  }

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (mixer) mixer.update(delta);
    const t = introState.time;

    if (t < TIMELINE.grabPlayer) {
      // Standing on the deck, subtle weight-shift sway so it doesn't look static
      const sway = Math.sin(t * 1.2) * 0.04;
      groupRef.current.position.set(sway, DECK_Y, 0);
      groupRef.current.rotation.set(0, Math.PI + Math.sin(t * 0.8) * 0.08, 0);
      groupRef.current.visible = true;
      playClip("idle", idleClipIdx, 0.4);
      chosenCrewIndex.current = null;
    } else if (t < TIMELINE.throwStart) {
      // Being grabbed: ride a chosen crew member's hand bone so the player is
      // visibly held overhead, then ease back out to `throwOrigin` right
      // before the toss so the projectile arc starts from the same point and
      // doesn't pop. Falls back to a fully procedural lift if no hand bones
      // have registered yet (skinned scenes still loading).
      const rawP = (t - TIMELINE.grabPlayer) / (TIMELINE.throwStart - TIMELINE.grabPlayer);

      // Lock onto the closest crew hand on the first frame of this beat (or
      // recover if the previously chosen crew member has unmounted).
      if (
        chosenCrewIndex.current === null ||
        !crewHandRegistry.has(chosenCrewIndex.current)
      ) {
        const pick = pickClosestCrewHand();
        chosenCrewIndex.current = pick ? pick.index : null;
      }
      const record = chosenCrewIndex.current !== null
        ? crewHandRegistry.get(chosenCrewIndex.current) ?? null
        : null;
      const handBone = record?.rightHand ?? record?.leftHand ?? null;

      if (handBone) {
        // Hand world position drives the lift; the crew's `lift/throw` clip
        // already raises the wrist overhead, so the player rises with it.
        handBone.updateMatrixWorld(true);
        handBone.getWorldPosition(tmpHandPos);

        // Small struggle wobble while held (peaks mid-phase, fades near hand-off).
        const wobbleAmp = 4 * rawP * (1 - rawP); // bell curve, max 1 at p=0.5
        const wobbleX = Math.sin(t * 14) * 0.10 * wobbleAmp;
        const wobbleZ = Math.cos(t * 9) * 0.06 * wobbleAmp;

        // Player pivot sits a touch below the wrist so the body reads as
        // gripped rather than spawning inside the hand mesh.
        const heldOffsetY = -0.35;
        tmpFromPos.set(
          tmpHandPos.x + wobbleX,
          tmpHandPos.y + heldOffsetY,
          tmpHandPos.z + wobbleZ,
        );

        // Ease in from the standing pose so the first frame doesn't snap up
        // to the hand. Then ease out to `throwOrigin` near the end so the
        // projectile arc inherits the exact position with zero pop.
        const blendIn = THREE.MathUtils.smoothstep(rawP, 0, 0.25);
        const blendOut = THREE.MathUtils.smoothstep(rawP, 0.82, 1.0);

        tmpFinalPos.lerpVectors(idleStandPos, tmpFromPos, blendIn);
        tmpFinalPos.lerp(throwOrigin, blendOut);

        groupRef.current.position.copy(tmpFinalPos);
      } else {
        // No crew hand available — fall back to the original procedural lift
        // (also tapers into `throwOrigin` so the throw start doesn't pop).
        const struggleT = Math.pow(rawP, 1.4);
        const blendOut = THREE.MathUtils.smoothstep(rawP, 0.82, 1.0);
        tmpFromPos.set(
          Math.sin(t * 14) * 0.18 * struggleT,
          1.2 + struggleT * 0.9,
          Math.cos(t * 9) * 0.08 * struggleT,
        );
        tmpFinalPos.copy(tmpFromPos).lerp(throwOrigin, blendOut);
        groupRef.current.position.copy(tmpFinalPos);
      }

      const struggleT = Math.pow(rawP, 1.4);
      groupRef.current.rotation.set(
        Math.sin(t * 11) * 0.22 * struggleT,
        Math.PI + Math.sin(t * 7) * 0.45 * struggleT,
        Math.sin(t * 8) * 0.18 * struggleT,
      );
      groupRef.current.visible = true;
      playClip("struggle", struggleClipIdx, 0.2);
    } else if (t < TIMELINE.splashHit) {
      // Mid-air: ballistic toss with tumbling spin that decays into impact pose
      const flightT = t - TIMELINE.throwStart;
      const flightDur = TIMELINE.splashHit - TIMELINE.throwStart;
      const flightP = flightT / flightDur;
      const pos = projectilePosition(throwOrigin, throwVelocity, flightT);
      groupRef.current.position.copy(pos);

      // Spin fast at first, slow to a face-down orientation just before impact
      const spinFalloff = 1 - Math.pow(flightP, 2.5);
      groupRef.current.rotation.set(
        flightT * 6.0 * spinFalloff,
        flightT * 4.2 * spinFalloff,
        flightT * 2.4 * spinFalloff
      );
      groupRef.current.visible = true;
      playClip("thrown", thrownClipIdx, 0.15);
    } else if (t < TIMELINE.washUpStart) {
      // Sink under the surface, body relaxes face-up
      const sinkP = Math.min(1, (t - TIMELINE.splashHit) / (TIMELINE.washUpStart - TIMELINE.splashHit));
      const splashPos = projectilePosition(throwOrigin, throwVelocity, TIMELINE.splashHit - TIMELINE.throwStart);
      const eased = 1 - Math.pow(1 - sinkP, 2);
      groupRef.current.position.set(
        splashPos.x,
        splashPos.y - eased * 3,
        splashPos.z - eased * 2
      );
      groupRef.current.rotation.set(
        THREE.MathUtils.lerp(groupRef.current.rotation.x, -Math.PI * 0.5, 0.08),
        0,
        THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.1)
      );
      groupRef.current.visible = t < TIMELINE.logoShow;
    } else {
      // Wash up: face-down on the actual tutorial-island shore (no raft).
      // The body lies flat on the wet sand at world origin, gently shifted
      // by the surf, then begins a small head-lift "starting to come to"
      // beat near the end of the wash-up window. The cutscene fades before
      // the character fully stands — gameplay picks up the rest.
      const washP = Math.min(1, (t - TIMELINE.washUpStart) / (TIMELINE.washUpEnd - TIMELINE.washUpStart));
      const liftP = Math.max(0, (washP - 0.55) * 2.2); // small stir near the end
      const eased = 1 - Math.pow(1 - Math.min(1, liftP), 3);

      // Surf wash: a small lateral nudge + breathing rise as the body
      // settles into the sand. Z drift is tiny so the body doesn't slide
      // visibly across the beach during the held shot.
      const surf = Math.sin(t * 0.9) * 0.03;
      const breathe = Math.sin(t * 1.3) * 0.018;
      // Body half-height when lying face-down ~= 0.18m above the wet sand.
      const lieY = SHORE_Y + 0.18 + breathe + eased * 0.06;

      groupRef.current.position.set(surf, lieY, -0.4);

      // Face-down with a slight head turn toward the camera; as `eased`
      // climbs, head lifts a touch (small chin-off-the-sand beat).
      const facedownPitch = THREE.MathUtils.lerp(-Math.PI * 0.5, -Math.PI * 0.42, eased);
      const headYaw = Math.PI * 0.06 + Math.sin(t * 0.5) * 0.02;
      const tiltZ = Math.sin(t * 0.6) * 0.03;
      groupRef.current.rotation.set(facedownPitch, headYaw, tiltZ);

      groupRef.current.visible = true;
      // One-shot so the death/lay pose clamps to its final fallen frame
      // for the held beach shot instead of looping back to standing.
      playClip("washup", washupClipIdx, 0.6, true);
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

// Wet-sand shore the player washes up onto. Replaces the old wash-up raft
// (and the two extra-survivor companions that rode it). Renders a wedge of
// damp sand at world origin under the player's lying body, a translucent
// foam line at the waterline, and a couple of pieces of driftwood for
// visual interest. Centered at world (0, SHORE_Y, 0) — the same spot the
// CinematicCamera frames during the wash-up beat.
function WashUpShore() {
  const groupRef = useRef<THREE.Group>(null);
  const foamRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = introState.time;
    // Show only across the wash-up window so it never lingers into the
    // in-game world if the cutscene unmount is delayed by a frame or two.
    if (t < TIMELINE.washUpStart - 0.5 || t > TIMELINE.fadeOut) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;
    // Soft foam pulse at the surf line so the "ocean is still lapping
    // at the player" beat reads even though the sand mesh itself is static.
    if (foamRef.current) {
      foamRef.current.opacity = 0.45 + Math.sin(t * 1.6) * 0.15;
    }
  });

  return (
    <group ref={groupRef} position={[0, SHORE_Y, 0]} visible={false}>
      {/* Wet sand wedge. Receives shadows so the lying player casts a
          subtle silhouette, selling the "actually on the ground" read. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2]} receiveShadow>
        <planeGeometry args={[22, 14]} />
        <meshStandardMaterial color="#c9a878" roughness={1} />
      </mesh>
      {/* Drier dune slope behind the player. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -7.5]} receiveShadow>
        <planeGeometry args={[22, 6]} />
        <meshStandardMaterial color="#d9b785" roughness={1} />
      </mesh>
      {/* Foam line at the surf edge — translucent strip pulsing with the
          surf, giving the impression of a wave just having retreated. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 3]}>
        <planeGeometry args={[22, 1.6]} />
        <meshStandardMaterial ref={foamRef} color="#ffffff" transparent opacity={0.5} />
      </mesh>
      {/* Driftwood debris — implies the player wasn't alone in the wreck
          without spawning live characters. Keep it minimal so it doesn't
          fight the framing on the player. */}
      <mesh position={[-2.6, 0.1, -0.8]} rotation={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[1.4, 0.18, 0.18]} />
        <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
      </mesh>
      <mesh position={[3.1, 0.07, 0.6]} rotation={[0, -0.6, 0]} castShadow>
        <boxGeometry args={[0.9, 0.13, 0.13]} />
        <meshStandardMaterial color="#4a2a12" roughness={0.9} />
      </mesh>
      <mesh position={[-1.3, 0.05, 1.5]} rotation={[0, 0.9, 0]}>
        <boxGeometry args={[0.5, 0.09, 0.09]} />
        <meshStandardMaterial color="#3a1a08" roughness={0.95} />
      </mesh>
    </group>
  );
}

function SplashEffect() {
  const particlesRef = useRef<THREE.Points>(null);

  const { positions, velocities, count } = useMemo(() => {
    const c = 120;
    const pos = new Float32Array(c * 3);
    const vel = new Float32Array(c * 3);
    for (let i = 0; i < c; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      vel[i * 3] = Math.cos(angle) * speed;
      vel[i * 3 + 1] = 4 + Math.random() * 8;
      vel[i * 3 + 2] = Math.sin(angle) * speed;
    }
    return { positions: pos, velocities: vel, count: c };
  }, []);

  const splashPos = useMemo(() => {
    // Must mirror ThrownCharacter's throwOrigin/target/angle so the splash
    // particles land where the player's body actually hits the water.
    const origin = new THREE.Vector3(0, DECK_Y + 1.6, 0);
    const target = new THREE.Vector3(4, -0.5, -18);
    const vel = computeLaunchVelocity(origin, target, 35);
    const flightT = TIMELINE.splashHit - TIMELINE.throwStart;
    return projectilePosition(origin, vel, flightT);
  }, []);

  useFrame(() => {
    if (!particlesRef.current) return;
    const t = introState.time;

    if (t < TIMELINE.splashHit || t > TIMELINE.splashHit + 2.5) {
      particlesRef.current.visible = false;
      return;
    }

    particlesRef.current.visible = true;
    const dt = t - TIMELINE.splashHit;
    const posAttr = particlesRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;

    for (let i = 0; i < count; i++) {
      posAttr.setXYZ(
        i,
        velocities[i * 3] * dt,
        velocities[i * 3 + 1] * dt - GRAVITY * dt * dt * 0.5,
        velocities[i * 3 + 2] * dt
      );
    }
    posAttr.needsUpdate = true;

    const mat = particlesRef.current.material as THREE.PointsMaterial;
    mat.opacity = Math.max(0, 1 - dt * 0.5);
  });

  return (
    <points ref={particlesRef} position={[splashPos.x, 0, splashPos.z]} visible={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#88ccff"
        size={0.2}
        transparent
        opacity={1}
        depthWrite={false}
      />
    </points>
  );
}

function CannonMuzzleFlash() {
  const flashRefs = useRef<(THREE.PointLight | null)[]>([]);
  const cannonballs = useMemo(() => generateCannonballs(), []);

  useFrame(() => {
    const t = introState.time;
    flashRefs.current.forEach((light, idx) => {
      if (!light) return;
      const ball = cannonballs[idx];
      if (!ball) return;
      const age = t - ball.fireTime;
      if (age >= 0 && age < 0.3) {
        light.visible = true;
        light.intensity = (1 - age / 0.3) * 15;
        light.position.copy(ball.origin);
      } else {
        light.visible = false;
      }
    });
  });

  return (
    <group>
      {cannonballs.slice(0, 8).map((ball, idx) => (
        <pointLight
          key={ball.id}
          ref={(el) => { flashRefs.current[idx] = el; }}
          color="#ff8833"
          intensity={0}
          distance={15}
          visible={false}
        />
      ))}
    </group>
  );
}

function IntroOcean() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    const t = introState.time;
    const geo = meshRef.current.geometry as THREE.PlaneGeometry;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const wave = Math.sin(x * 0.08 + t * 0.8) * 0.35 +
        Math.sin(y * 0.06 + t * 0.5) * 0.2 +
        Math.sin((x + y) * 0.05 + t * 1.0) * 0.15 +
        Math.sin(x * 0.15 + t * 1.5) * 0.08;
      posAttr.setZ(i, wave);
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
      <planeGeometry args={[300, 300, 80, 80]} />
      <meshStandardMaterial
        color="#1a5276"
        transparent
        opacity={0.92}
        roughness={0.15}
        metalness={0.15}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function IntroIsland() {
  return (
    <group position={[0, -0.6, 50]}>
      <mesh>
        <coneGeometry args={[35, 5, 16]} />
        <meshStandardMaterial color="#8B7355" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <sphereGeometry args={[30, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="#4a7c3f" roughness={0.8} />
      </mesh>
      {[[-10, 3.5, -6], [7, 4, -9], [-4, 3.2, 4], [12, 3, -3], [-7, 3.8, -12]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.12, 0.18, 3, 5]} />
            <meshStandardMaterial color="#5a3a1a" />
          </mesh>
          <mesh position={[0, 3.5, 0]}>
            <coneGeometry args={[1 + Math.random() * 0.5, 3 + Math.random(), 6]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#2d5a1e" : "#3a6e2a"} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function EnemyShip() {
  const approachRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!approachRef.current) return;
    const t = introState.time;
    const approachT = Math.min(1, t / TIMELINE.firstVolley);
    const eased = 1 - Math.pow(1 - approachT, 2);

    approachRef.current.position.set(
      -35 - (1 - eased) * 20,
      Math.sin(t * 0.7) * 0.4,
      -20 + (1 - eased) * 10
    );
    approachRef.current.rotation.z = Math.sin(t * 0.5 + 1) * 0.03;

    approachRef.current.visible = t < TIMELINE.logoShow;
  });

  return (
    <group ref={approachRef}>
      <IntroShip position={[0, 0, 0]} rotationY={Math.PI * 0.3} scale={0.9} />
      <pointLight position={[0, 5, 0]} color="#ff4400" intensity={3} distance={20} />
    </group>
  );
}

function CinematicCamera() {
  const { camera } = useThree();
  const lookAt = useRef(new THREE.Vector3());
  const shakeRef = useRef({ x: 0, y: 0, z: 0 });

  useFrame(() => {
    const t = introState.time;
    let shakeIntensity = 0;

    if (t < TIMELINE.firstVolley) {
      const p = t / TIMELINE.firstVolley;
      const eased = 1 - Math.pow(1 - p, 2);
      camera.position.set(
        12 - eased * 4,
        5 + Math.sin(t * 0.3) * 0.3,
        8 - eased * 3
      );
      lookAt.current.set(-10, 2, -5);
    } else if (t < TIMELINE.grabPlayer) {
      const p = (t - TIMELINE.firstVolley) / (TIMELINE.grabPlayer - TIMELINE.firstVolley);
      const orbitAngle = p * Math.PI * 0.4 + Math.PI * 0.3;
      const radius = 12 - p * 2;
      camera.position.set(
        Math.cos(orbitAngle) * radius,
        4 + Math.sin(t * 0.5) * 0.3,
        Math.sin(orbitAngle) * radius
      );
      lookAt.current.set(0, DECK_Y + 0.6, 0);
      shakeIntensity = 0.15;
    } else if (t < TIMELINE.throwStart) {
      const p = (t - TIMELINE.grabPlayer) / (TIMELINE.throwStart - TIMELINE.grabPlayer);
      camera.position.set(
        3 + Math.sin(t * 2) * 0.2,
        DECK_Y + 1.6 - p * 0.5,
        4 - p * 2
      );
      lookAt.current.set(0, DECK_Y + 0.4, 0);
    } else if (t < TIMELINE.splashHit) {
      const p = (t - TIMELINE.throwStart) / (TIMELINE.splashHit - TIMELINE.throwStart);
      camera.position.set(
        6 + p * 4,
        DECK_Y + 1.4 + p * 2,
        -2 - p * 14
      );
      const charX = p * 4;
      const charZ = -p * 18;
      // Track the player's actual arc apex (~throwOrigin Y at p=0, descending
      // toward water at p=1) so the camera frames the toss instead of the deck.
      lookAt.current.set(charX, (DECK_Y + 1.6) * (1 - p) + Math.sin(p * Math.PI) * 3, charZ);
    } else if (t < TIMELINE.logoShow) {
      const p = (t - TIMELINE.splashHit) / (TIMELINE.logoShow - TIMELINE.splashHit);
      camera.position.set(
        6,
        2 - p * 3,
        -18 + p * 2
      );
      lookAt.current.set(4, -p * 2, -18);
      shakeIntensity = 0.1 * (1 - p);
    } else if (t < TIMELINE.washUpStart) {
      camera.position.set(0, 2, -25);
      lookAt.current.set(0, 0, 0);
    } else {
      const p = Math.min(1, (t - TIMELINE.washUpStart) / (TIMELINE.washUpEnd - TIMELINE.washUpStart));
      const eased = 1 - Math.pow(1 - p, 3);
      camera.position.set(
        5 - eased * 1.5,
        3 - eased * 1.5,
        -6 + eased * 4
      );
      lookAt.current.set(0, 0.3, 0);
    }

    if (shakeIntensity > 0) {
      shakeRef.current.x = (Math.random() - 0.5) * shakeIntensity;
      shakeRef.current.y = (Math.random() - 0.5) * shakeIntensity;
      shakeRef.current.z = (Math.random() - 0.5) * shakeIntensity;
      camera.position.x += shakeRef.current.x;
      camera.position.y += shakeRef.current.y;
      camera.position.z += shakeRef.current.z;
    }

    camera.lookAt(lookAt.current);
  });

  return null;
}

function IntroController({ onUpdate }: { onUpdate: () => void }) {
  const { finishIntro } = useGame();
  const prevLogo = useRef(false);
  const prevFadeStep = useRef(0);

  useFrame((_, delta) => {
    introState.time += delta;
    const t = introState.time;

    const newLogo = t >= TIMELINE.logoShow && t < TIMELINE.washUpStart;
    introState.showLogo = newLogo;

    if (t >= TIMELINE.fadeOut) {
      introState.fadeOpacity = Math.min(1, (t - TIMELINE.fadeOut) / (TIMELINE.end - TIMELINE.fadeOut));
    } else {
      introState.fadeOpacity = 0;
    }

    const fadeStep = Math.round(introState.fadeOpacity * 20);
    if (newLogo !== prevLogo.current || fadeStep !== prevFadeStep.current) {
      prevLogo.current = newLogo;
      prevFadeStep.current = fadeStep;
      onUpdate();
    }

    if (t >= TIMELINE.end && !introState.finished) {
      introState.finished = true;
      finishIntro();
    }
  });

  return null;
}

function IntroScene3D({ onUpdate }: { onUpdate: () => void }) {
  return (
    <>
      <IntroController onUpdate={onUpdate} />
      <CinematicCamera />
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 15, -5]} intensity={1.5} color="#ffeedd" castShadow />
      <directionalLight position={[-15, 8, 10]} intensity={0.4} color="#88aacc" />
      <pointLight position={[0, 8, 0]} intensity={2} color="#ff9944" distance={30} />
      <fog attach="fog" args={["#0d1f2d", 20, 100]} />
      <color attach="background" args={["#0d1f2d"]} />

      {/* Animated raymarched storm clouds backdrop (IQ Shadertoy port).
          Renders behind every other intro element via gl_Position.xyww
          and renderOrder=-1000. Driving intensity from uStormIntensity
          would let us ramp the storm with the cutscene; keeping it at
          a high constant for now since the whole intro is a storm. */}
      <IntroStormDome intensity={0.95} />

      <group>
        {/* Player's vessel: a big pirate ship under attack. Crew + thrown
            player stand on the deck (DECK_Y). Scaled larger than the
            EnemyShip (0.9) so it visually dominates as "the ship I'm on". */}
        <IntroShip position={[0, 0, 0]} rotationY={Math.PI * 0.5} scale={1.4} />
        {CARRIER_PATHS.map((path, i) => (
          <AnimatedCrewMember key={i} path={path} index={i} />
        ))}
        <ThrownCharacter />
        {/* Shore the player washes up on (replaces the old wash-up raft).
            No more "extra survivors" beat — the player is the lone
            survivor of the wreck. */}
        <WashUpShore />
        <SplashEffect />
      </group>

      <EnemyShip />

      <CannonballSystem />
      <ExplosionSystem />
      <SmokeSystem />
      <CannonMuzzleFlash />

      <IntroOcean />
      <IntroIsland />
    </>
  );
}

export default function IntroCutscene() {
  const [, forceUpdate] = useState(0);
  const { finishIntro } = useGame();

  useEffect(() => {
    introState.time = 0;
    introState.showLogo = false;
    introState.fadeOpacity = 0;
    introState.finished = false;
    cachedCannonballs = null;
  }, []);

  const handleUpdate = useCallback(() => {
    forceUpdate((n) => n + 1);
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#000" }}>
      <Canvas
        camera={{ fov: 55, near: 0.1, far: 300, position: [12, 5, 8] }}
        gl={{ antialias: true, alpha: false }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Suspense fallback={null}>
          <IntroScene3D onUpdate={handleUpdate} />
        </Suspense>
      </Canvas>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          opacity: introState.showLogo ? 1 : 0,
          transition: "opacity 1.2s ease-in-out",
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontSize: "clamp(64px, 12vw, 140px)",
            fontWeight: 400,
            fontFamily: "'MorkDungeon', 'Cinzel', serif",
            color: "#f0d68a",
            textShadow: "0 0 60px rgba(201,149,10,0.6), 0 4px 12px rgba(0,0,0,0.9), 0 0 120px rgba(201,149,10,0.2)",
            letterSpacing: "0.1em",
            lineHeight: 1,
          }}
        >
          GRUDGE
        </div>
        <div
          style={{
            fontSize: "clamp(16px, 3vw, 28px)",
            fontWeight: 400,
            fontFamily: "'MorkDungeon', 'Cinzel', serif",
            color: "#c9950a",
            letterSpacing: "0.3em",
            marginTop: "8px",
            textShadow: "0 0 20px rgba(201,149,10,0.4), 0 2px 10px rgba(0,0,0,0.8)",
          }}
        >
          Warlords of the Burning Lands
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          opacity: introState.fadeOpacity,
          pointerEvents: "none",
          zIndex: 20,
        }}
      />

      <button
        onClick={finishIntro}
        style={{
          position: "absolute",
          bottom: 40,
          right: 40,
          padding: "10px 28px",
          fontSize: 13,
          fontFamily: "'Cinzel', serif",
          fontWeight: 700,
          color: "rgba(201,149,10,0.6)",
          background: "rgba(10,7,4,0.7)",
          border: "1px solid rgba(201,149,10,0.25)",
          borderRadius: 5,
          cursor: "pointer",
          zIndex: 30,
          letterSpacing: 3,
          textTransform: "uppercase" as const,
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(201,149,10,0.6)";
          e.currentTarget.style.color = "#f0d68a";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(201,149,10,0.25)";
          e.currentTarget.style.color = "rgba(201,149,10,0.6)";
        }}
      >
        Skip Intro
      </button>
    </div>
  );
}
