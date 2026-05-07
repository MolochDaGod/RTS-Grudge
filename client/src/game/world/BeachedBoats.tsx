import { useRef, useMemo, Suspense, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { create } from "zustand";
import { useAsset } from "../hooks/useAsset";
import { importFromScene } from "../systems/AssetPipeline";
import { PIRATE_ASSETS } from "../dungeon/DungeonAssetMap";
import { getTerrainHeight, globalHeightData } from "../components/Terrain";
import {
  TERRAIN_RESOLUTION,
  WORLD_SIZE,
  terrainHeights,
} from "../components/TerrainHeightField";
import { WATER_SURFACE_Y } from "../effects/WaterVolume";
import { useIslandWorld } from "@/lib/stores/useIslandWorld";
import { useSurvival } from "@/lib/stores/useSurvival";
import { globalHarvestTriggerRef } from "../components/ResourceNode";

const PUSH_RANGE = 4.5;
const PUSH_SPEED = 2.0;
const TURN_SPEED = 1.2;
const FLIP_DURATION = 0.7;
const STERN_OFFSET = 2.4;
const AUTO_DETACH_DIST = 9;
const BEACHED_BOAT_COUNT = 3;
// A "beach" cell sits just above the waterline. Anything higher is dune
// or grass; anything at/below sea level is already in the water.
const BEACH_MIN_Y = WATER_SURFACE_Y + 0.15;
const BEACH_MAX_Y = WATER_SURFACE_Y + 0.8;
const MIN_BOAT_SEPARATION = 25;

interface BeachedBoatState {
  id: string;
  pos: THREE.Vector3;
  yaw: number;
  roll: number;
  pitch: number;
  targetRoll: number;
  targetPitch: number;
  flipping: boolean;
  flipT: number;
  flipFromRoll: number;
  flipFromPitch: number;
  beached: boolean;
  attached: boolean;
  bobPhase: number;
}

interface PromptStore {
  text: string | null;
  set: (text: string | null) => void;
}
export const useBoatPushPrompt = create<PromptStore>((set) => ({
  text: null,
  set: (text) => set({ text }),
}));

interface BoatSpawn {
  x: number;
  z: number;
  yaw: number;
  roll: number;
  pitch: number;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Walk the live terrain heightfield and return up to `count` shoreline
 * spots suitable for spawning a beached boat: just above the waterline,
 * adjacent to water, on a sand patch (gentle slope, not a cliff). Yaw is
 * computed so the boat's forward axis points outward (toward the sea), so
 * a quick W push launches it.
 *
 * Returns an empty array if the heightfield has no qualifying cells (e.g.
 * a fully submerged biome), in which case no boats are spawned. We
 * deliberately don't fall back to fixed coordinates — those used to
 * dump boats in the sea or on cliffs on differently-shaped islands.
 */
function findBeachedBoatSpots(count: number, seed: number): BoatSpawn[] {
  const N = TERRAIN_RESOLUTION;
  type Cand = { x: number; z: number; yaw: number; score: number };
  const candidates: Cand[] = [];

  for (let r = 1; r < N - 1; r++) {
    for (let c = 1; c < N - 1; c++) {
      const h = terrainHeights[r * N + c];
      if (h < BEACH_MIN_Y || h > BEACH_MAX_Y) continue;

      const hL = terrainHeights[r * N + (c - 1)];
      const hR = terrainHeights[r * N + (c + 1)];
      const hU = terrainHeights[(r - 1) * N + c];
      const hD = terrainHeights[(r + 1) * N + c];
      const minN = Math.min(hL, hR, hU, hD);
      const maxN = Math.max(hL, hR, hU, hD);
      // Must touch water on at least one side — that's what makes it
      // a shoreline cell rather than just a low inland patch.
      if (minN >= WATER_SURFACE_Y) continue;
      // Reject cliffs / steep ledges; we want a flat-ish beach.
      if (maxN - minN > 1.5) continue;

      // Outward (toward sea) = downhill = -gradient. The boat's forward
      // axis is (sin yaw, cos yaw) in world XZ, so atan2(outX, outZ).
      const outX = -(hR - hL);
      const outZ = -(hD - hU);
      const len = Math.hypot(outX, outZ);
      if (len < 1e-3) continue;

      const x = (c / (N - 1) - 0.5) * WORLD_SIZE;
      const z = (r / (N - 1) - 0.5) * WORLD_SIZE;
      const yaw = Math.atan2(outX, outZ);
      // Prefer cells with a clear water-facing slope and that sit lower
      // on the beach (closer to the waterline → shorter push to launch).
      const score = len + (BEACH_MAX_Y - h);
      candidates.push({ x, z, yaw, score });
    }
  }

  if (candidates.length === 0) return [];

  // Take the strongest shoreline candidates, then shuffle them
  // deterministically per island seed so picks vary between biomes
  // without drifting between sessions on the same island.
  candidates.sort((a, b) => b.score - a.score);
  const pool = candidates.slice(0, Math.max(count * 20, 30));
  const rng = mulberry32(seed || 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const picked: Cand[] = [];
  for (const cand of pool) {
    if (picked.length >= count) break;
    let ok = true;
    for (const p of picked) {
      if (Math.hypot(p.x - cand.x, p.z - cand.z) < MIN_BOAT_SEPARATION) {
        ok = false;
        break;
      }
    }
    if (ok) picked.push(cand);
  }

  return picked.map((p) => ({
    x: p.x,
    z: p.z,
    yaw: p.yaw,
    // Random list — beached, capsized boats lean every which way.
    roll: (rng() - 0.5) * Math.PI * 0.9,
    pitch: (rng() - 0.5) * 0.3,
  }));
}

function isInWaterXZ(x: number, z: number): boolean {
  if (!globalHeightData) return false;
  // Same shoreline source as the spawn search: the boat is "in water"
  // exactly when it's standing on terrain that sits below the ocean
  // surface. Keeps launch behaviour consistent on any biome.
  return getTerrainHeight(x, z, globalHeightData) < WATER_SURFACE_Y;
}

function PushableBoatModel({
  stateRef,
  scale = 3,
}: {
  stateRef: React.MutableRefObject<BeachedBoatState>;
  scale?: number;
}) {
  const gltf = useAsset(PIRATE_ASSETS.ship_small);
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const normalized = importFromScene(clone, [], "ship_small_pushable", {
      targetHeight: scale,
      sanitizeBones: false,
      fixDarkMaterials: true,
      enableShadows: true,
    });
    const box = new THREE.Box3().setFromObject(normalized.scene);
    normalized.scene.position.y = -box.min.y;
    return normalized.scene;
  }, [gltf, scale]);

  const groupRef = useRef<THREE.Group>(null);

  useFrame((rs) => {
    const g = groupRef.current;
    if (!g) return;
    const s = stateRef.current;
    g.position.set(s.pos.x, s.pos.y, s.pos.z);
    if (s.beached) {
      g.rotation.set(s.pitch, s.yaw, s.roll);
    } else {
      // Floating bob — preserve any small residual roll/pitch from a fresh
      // launch but layer the gentle ocean sway on top so the boat reads
      // as alive in the water.
      const t = rs.clock.elapsedTime;
      g.position.y = s.pos.y + Math.sin(t * 0.7 + s.bobPhase) * 0.08;
      g.rotation.set(
        Math.cos(t * 0.45 + s.bobPhase) * 0.02,
        s.yaw,
        Math.sin(t * 0.55 + s.bobPhase) * 0.025,
      );
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} />
    </group>
  );
}

export function BeachedBoatsSystem({ playerPosition }: { playerPosition: THREE.Vector3 }) {
  // Subscribe to the active island via the store hook so this component
  // re-renders when the player sails to a new island. The keyed inner
  // component below then fully remounts (refs, attachment, HUD prompt)
  // against the new island's shoreline.
  const currentIslandId = useIslandWorld((s) => s.currentIslandId);
  const islandSeed = useIslandWorld((s) =>
    s.islands.get(s.currentIslandId)?.seed ?? 1,
  );
  return (
    <BeachedBoatsImpl
      key={currentIslandId}
      playerPosition={playerPosition}
      islandSeed={islandSeed}
    />
  );
}

function BeachedBoatsImpl({
  playerPosition,
  islandSeed,
}: {
  playerPosition: THREE.Vector3;
  islandSeed: number;
}) {
  // One stable state object per boat, held inside refs so per-frame mutation
  // doesn't trigger React re-renders. Spawn spots are derived from the
  // active island's actual shoreline (see findBeachedBoatSpots) so the
  // feature works on any biome / island shape, not just the home island
  // it was originally hardcoded for. Computed once per mount; the parent
  // remounts this component (via `key={currentIslandId}`) when the player
  // changes islands so the spawns always match the current shoreline.
  const spawns = useMemo(
    () => findBeachedBoatSpots(BEACHED_BOAT_COUNT, islandSeed),
    [islandSeed],
  );

  const boatRefs = useRef(
    spawns.map((b, i) => {
      const groundY = globalHeightData ? Math.max(getTerrainHeight(b.x, b.z, globalHeightData), 0) : 0;
      const state: BeachedBoatState = {
        id: `beached_${i}`,
        pos: new THREE.Vector3(b.x, groundY, b.z),
        yaw: b.yaw,
        roll: b.roll,
        pitch: b.pitch,
        targetRoll: b.roll,
        targetPitch: b.pitch,
        flipping: false,
        flipT: 0,
        flipFromRoll: b.roll,
        flipFromPitch: b.pitch,
        beached: true,
        attached: false,
        bobPhase: i * 1.7,
      };
      return { current: state };
    })
  );

  const attachedIdxRef = useRef<number | null>(null);
  const keys = useRef({ w: false, a: false, s: false, d: false });
  const lastPromptRef = useRef<string | null>(null);

  const setPrompt = (text: string | null) => {
    if (lastPromptRef.current === text) return;
    lastPromptRef.current = text;
    useBoatPushPrompt.getState().set(text);
  };

  const detach = () => {
    const i = attachedIdxRef.current;
    if (i != null) boatRefs.current[i].current.attached = false;
    attachedIdxRef.current = null;
    (window as any).__boatAttached = false;
    (window as any).__boatPushMoving = false;
    setPrompt(null);
  };

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === "KeyW" || code === "ArrowUp") keys.current.w = true;
      else if (code === "KeyS" || code === "ArrowDown") keys.current.s = true;
      else if (code === "KeyA" || code === "ArrowLeft") keys.current.a = true;
      else if (code === "KeyD" || code === "ArrowRight") keys.current.d = true;
      else if (code === "KeyF") {
        // Neutralize the resource-harvest "F held" flag so this same F
        // press doesn't also trigger a nearby tree/rock harvest. The
        // harvest consumer reads the flag in useFrame, so clearing it
        // here (regardless of keydown listener order) wins.
        globalHarvestTriggerRef.current = false;
        if (attachedIdxRef.current != null) {
          detach();
        } else {
          let best = -1;
          let bestD = Infinity;
          for (let i = 0; i < boatRefs.current.length; i++) {
            const b = boatRefs.current[i].current;
            if (!b.beached) continue;
            const d = Math.hypot(b.pos.x - playerPosition.x, b.pos.z - playerPosition.z);
            if (d < PUSH_RANGE && d < bestD) {
              bestD = d;
              best = i;
            }
          }
          if (best >= 0) {
            attachedIdxRef.current = best;
            boatRefs.current[best].current.attached = true;
            (window as any).__boatAttached = true;
            setPrompt("Press F to release  •  RMB flip  •  WASD push");
          }
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === "KeyW" || code === "ArrowUp") keys.current.w = false;
      else if (code === "KeyS" || code === "ArrowDown") keys.current.s = false;
      else if (code === "KeyA" || code === "ArrowLeft") keys.current.a = false;
      else if (code === "KeyD" || code === "ArrowRight") keys.current.d = false;
    };
    const md = (e: MouseEvent) => {
      if (e.button !== 2) return;
      const idx = attachedIdxRef.current;
      if (idx == null) return;
      e.preventDefault();
      const b = boatRefs.current[idx].current;
      if (b.flipping) return;
      // Only flip if not already upright.
      if (Math.abs(b.roll) < 0.05 && Math.abs(b.pitch) < 0.05) return;
      b.flipping = true;
      b.flipT = 0;
      b.flipFromRoll = b.roll;
      b.flipFromPitch = b.pitch;
      b.targetRoll = 0;
      b.targetPitch = 0;
    };
    const cm = (e: MouseEvent) => {
      if (attachedIdxRef.current != null) e.preventDefault();
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    window.addEventListener("mousedown", md);
    window.addEventListener("contextmenu", cm);
    // Auto-detach on death so a player who dies while attached to a boat
    // doesn't respawn with `__boatAttached` still latched (which would
    // pin them at zero gravity in the wheelbarrow pose forever).
    const unsubAlive = useSurvival.subscribe((s, prev) => {
      if (prev.isAlive && !s.isAlive && attachedIdxRef.current != null) {
        detach();
      }
    });
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mousedown", md);
      window.removeEventListener("contextmenu", cm);
      unsubAlive();
      // Safety: clear any latched state on unmount.
      (window as any).__boatAttached = false;
      (window as any).__boatPushMoving = false;
      (window as any).__floatedBeachedBoats = [];
      lastPromptRef.current = null;
      useBoatPushPrompt.getState().set(null);
    };
    // playerPosition is a ref-shared THREE.Vector3 from the parent that
    // never re-allocates; the listener body always reads its live x/z.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, deltaRaw) => {
    const delta = Math.min(deltaRaw, 0.1);

    // Tween any in-progress flips first so attach/move logic uses the
    // tweened roll/pitch values.
    for (const ref of boatRefs.current) {
      const b = ref.current;
      if (!b.flipping) continue;
      b.flipT += delta;
      const t = Math.min(b.flipT / FLIP_DURATION, 1);
      const k = t * t * (3 - 2 * t);
      b.roll = THREE.MathUtils.lerp(b.flipFromRoll, b.targetRoll, k);
      b.pitch = THREE.MathUtils.lerp(b.flipFromPitch, b.targetPitch, k);
      if (t >= 1) {
        b.flipping = false;
        b.roll = b.targetRoll;
        b.pitch = b.targetPitch;
      }
    }

    // Publish floated boats so DockDetector (E-to-board flow) can also
    // light up next to a player-launched boat.
    const floated: { x: number; z: number }[] = [];
    for (const ref of boatRefs.current) {
      const b = ref.current;
      if (!b.beached) floated.push({ x: b.pos.x, z: b.pos.z });
    }
    (window as any).__floatedBeachedBoats = floated;

    const idx = attachedIdxRef.current;
    if (idx == null) {
      // Stale-flag safeguard: if the window flag survived a remount /
      // save-load / scene change but our attach ref is null, clear it
      // immediately. Without this, the Player's boat-attached early-return
      // (Player.tsx:1770) would zero linvel every frame and lock the
      // wheelbarrow override pose — the "no gravity, hits a pose, floats"
      // failure mode.
      if ((window as any).__boatAttached) {
        (window as any).__boatAttached = false;
        (window as any).__boatPushMoving = false;
      }
      // Show grab prompt when standing next to any beached boat.
      let nearest = -1;
      let bestD = Infinity;
      for (let i = 0; i < boatRefs.current.length; i++) {
        const b = boatRefs.current[i].current;
        if (!b.beached) continue;
        const d = Math.hypot(b.pos.x - playerPosition.x, b.pos.z - playerPosition.z);
        if (d < PUSH_RANGE && d < bestD) {
          bestD = d;
          nearest = i;
        }
      }
      setPrompt(nearest >= 0 ? "Press F to grab boat" : null);
      return;
    }

    // Attached: drive the boat with WASD, anchor the player at the stern.
    const b = boatRefs.current[idx].current;
    const dx0 = b.pos.x - playerPosition.x;
    const dz0 = b.pos.z - playerPosition.z;
    if (Math.hypot(dx0, dz0) > AUTO_DETACH_DIST) {
      detach();
      return;
    }

    const k = keys.current;
    let mv = 0;
    if (k.w) mv += 1;
    if (k.s) mv -= 1;
    let turn = 0;
    if (k.a) turn += 1;
    if (k.d) turn -= 1;

    // Publish a "currently pushing" flag so the player's pose driver can
    // swap from the braced lean (`wheelbarrow_idle`) to the slow shuffle
    // (`wheelbarrow_walk`) while WASD is held, and back again on release.
    (window as any).__boatPushMoving = (mv !== 0 || turn !== 0) && !b.flipping;

    // While flipping, ignore push so the rotation tween reads cleanly.
    if (!b.flipping) {
      if (turn !== 0) b.yaw += turn * TURN_SPEED * delta;
      if (mv !== 0) {
        const fx = Math.sin(b.yaw);
        const fz = Math.cos(b.yaw);
        b.pos.x += fx * mv * PUSH_SPEED * delta;
        b.pos.z += fz * mv * PUSH_SPEED * delta;
      }
    }

    // Ground-clamp while beached.
    const groundY = globalHeightData ? Math.max(getTerrainHeight(b.pos.x, b.pos.z, globalHeightData), 0) : 0;
    if (b.beached) {
      b.pos.y = groundY;
    }

    // Water transition: switch to floating, auto-detach, restore controls.
    if (b.beached && isInWaterXZ(b.pos.x, b.pos.z)) {
      b.beached = false;
      b.pos.y = -0.3;
      // Snap upright on launch — looks much better than tipping into the sea.
      b.flipping = false;
      b.roll = 0;
      b.pitch = 0;
      b.targetRoll = 0;
      b.targetPitch = 0;
      detach();
      return;
    }

    // Snap player to stern. Player faces the boat (i.e. faces along the
    // boat's forward heading, with their back to the camera).
    const fx = Math.sin(b.yaw);
    const fz = Math.cos(b.yaw);
    const sx = b.pos.x - fx * STERN_OFFSET;
    const sz = b.pos.z - fz * STERN_OFFSET;
    const sy = (b.beached ? groundY : -0.3) + 0.3;
    const facing = Math.atan2(fx, fz);
    const teleport = (window as any).__pushBoatTeleportPlayer as
      | ((x: number, y: number, z: number, yaw: number) => void)
      | undefined;
    teleport?.(sx, sy, sz, facing);
  });

  return (
    <>
      {boatRefs.current.map((ref) => (
        <Suspense key={ref.current.id} fallback={null}>
          <PushableBoatModel stateRef={ref} />
        </Suspense>
      ))}
    </>
  );
}

export function BeachedBoatPromptHUD() {
  const text = useBoatPushPrompt((s) => s.text);
  if (!text) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 170,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.8)",
        color: "#ffcc00",
        padding: "8px 16px",
        borderRadius: 6,
        fontFamily: "monospace",
        fontSize: 15,
        zIndex: 100,
        border: "1px solid #ffcc00",
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
}
