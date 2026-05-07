import { create } from "zustand";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { DecorType, DungeonDecor } from "./DungeonGenerator";
import { useBuildSystem } from "@/lib/stores/useBuildSystem";
import { DECOR_TO_DUNGEON_ASSET, resolveAssetDef } from "./DungeonAssetMap";
import {
  playDecorSmash,
  playDecorThunk,
  sizeFactorFromVolume,
} from "@/lib/audio/decorSmashSynth";
import { rollContainerLootDrops, type ContainerLootKind } from "../systems/LootSystem";
import { useLootDrops } from "../components/LootDrops";
import {
  getFractureTemplates,
  type FractureChunkTemplate,
} from "./DungeonFractureAssets";

/** Hard cap on simultaneously-rendered fragments across all active
 *  shatters. When a new shatter would exceed the cap, the oldest
 *  fragments are evicted FIFO. Keeps GPU draw cost bounded even when
 *  the player AOEs through a dense room. */
const MAX_TOTAL_FRAGMENTS = 80;
/** Per-shatter chunk count for both the procedural cuboid path and
 *  the GLB-chunk path (the GLB path may pull fewer if the asset has
 *  fewer meshes registered). */
const FRAGMENTS_PER_SHATTER = 10;

/**
 * Dungeon decor: GLB-bbox registry (auto-sized hitboxes), per-type
 * material classification (HP / fragment colour / drop), and the
 * destruction state machine that consumes both.
 */

// ─────────────────────────────────────────────────────────────────────
// GLB bounding box registry
// ─────────────────────────────────────────────────────────────────────

export interface DecorBBox {
  hx: number;
  hy: number;
  hz: number;
  /** World-Y center of the collider (= hy because the model bottom is at y=0). */
  cy: number;
}

interface GLBBboxState {
  /** Keyed by `${path}|${height}`. */
  bboxes: Record<string, DecorBBox>;
  /** Bumped on every new bbox so subscribers re-render. */
  version: number;
  registerBBox: (key: string, bbox: DecorBBox) => void;
  reset: () => void;
}

export const useGLBBboxRegistry = create<GLBBboxState>((set, get) => ({
  bboxes: {},
  version: 0,
  registerBBox: (key, bbox) => {
    if (get().bboxes[key]) return;
    set((s) => ({
      bboxes: { ...s.bboxes, [key]: bbox },
      version: s.version + 1,
    }));
  },
  reset: () => set({ bboxes: {}, version: 0 }),
}));

export function glbBboxKey(path: string, height: number): string {
  return `${path}|${height.toFixed(3)}`;
}

/** Half-extents + center-Y of `scene` after the height normalization
 *  `<DungeonGLBDecor>` performs (model bottom pinned to y=0). */
export function computeNormalizedBBox(scene: THREE.Object3D): DecorBBox {
  const box = new THREE.Box3().setFromObject(scene);
  const sx = Math.max(0.05, (box.max.x - box.min.x) / 2);
  const sy = Math.max(0.05, (box.max.y - box.min.y) / 2);
  const sz = Math.max(0.05, (box.max.z - box.min.z) / 2);
  return { hx: sx, hy: sy, hz: sz, cy: sy };
}

// ─────────────────────────────────────────────────────────────────────
// Materials
// ─────────────────────────────────────────────────────────────────────

export type DecorMaterial = "wood" | "stone" | "ore" | "ceramic" | "cloth" | "crystal";

/** Decor types absent from this map are non-destructible (pools,
 *  doors, ground rubble, pickup-likes, banners). */
export const DECOR_MATERIAL: Partial<Record<DecorType, DecorMaterial>> = {
  // wood
  chest: "wood",
  barrel: "wood",
  crate: "wood",
  bookshelf: "wood",
  bed: "wood",
  cabinet: "wood",
  weapon_rack: "wood",
  table: "wood",
  chair: "wood",
  bench: "wood",
  stool: "wood",
  bucket: "wood",
  scaffold: "wood",
  minecart: "wood",
  // stone
  pillar: "stone",
  statue: "stone",
  altar: "stone",
  sarcophagus: "stone",
  // ore (metal)
  anvil: "ore",
  brazier: "ore",
  cauldron: "ore",
  armor: "ore",
  // ceramic
  pots: "ceramic",
  // crystal
  crystal: "crystal",
};

export interface MaterialProps {
  hp: number;
  /** Primary chunk color. */
  color: string;
  /** Secondary chunk color (variation). */
  altColor: string;
  /** Bright pop flash on shatter. */
  popColor: string;
  /** Build-system resource gained on shatter. */
  resourceKind: "wood" | "stone" | "gold" | null;
  resourceMin: number;
  resourceMax: number;
  /** Material PBR feel. */
  metalness: number;
  roughness: number;
}

/**
 * Loot-container override: decor types listed here ignore their
 * material's flat build-resource drop on shatter and instead spawn
 * real `LootDrops` (gold/gems/scrolls/potions/weapons) at the prop's
 * world position via the same system enemies use. Material/HP still
 * comes from `DECOR_MATERIAL` so swing-to-break feel is unchanged.
 */
export const CONTAINER_LOOT_KIND: Partial<Record<DecorType, ContainerLootKind>> = {
  chest: "chest",
  sarcophagus: "sarcophagus",
  bookshelf: "bookshelf",
};

export const MATERIAL_PROPS: Record<DecorMaterial, MaterialProps> = {
  wood:    { hp: 2, color: "#8b5a2b", altColor: "#6b4226", popColor: "#cc8844", resourceKind: "wood",  resourceMin: 2, resourceMax: 5, metalness: 0.0, roughness: 0.85 },
  stone:   { hp: 4, color: "#8a8a8a", altColor: "#5e5e60", popColor: "#cccccc", resourceKind: "stone", resourceMin: 3, resourceMax: 6, metalness: 0.05, roughness: 0.9 },
  ore:     { hp: 5, color: "#5a5a66", altColor: "#3a3a44", popColor: "#aaaadd", resourceKind: "gold",  resourceMin: 1, resourceMax: 3, metalness: 0.7, roughness: 0.4 },
  ceramic: { hp: 1, color: "#b8593a", altColor: "#8a4428", popColor: "#dd9966", resourceKind: "stone", resourceMin: 1, resourceMax: 2, metalness: 0.0, roughness: 0.6 },
  cloth:   { hp: 1, color: "#aa3344", altColor: "#772233", popColor: "#ffaaaa", resourceKind: null,    resourceMin: 0, resourceMax: 0, metalness: 0.0, roughness: 1.0 },
  crystal: { hp: 3, color: "#33ccff", altColor: "#99eeff", popColor: "#aaffff", resourceKind: "gold",  resourceMin: 2, resourceMax: 5, metalness: 0.3, roughness: 0.2 },
};

// ─────────────────────────────────────────────────────────────────────
// Destruction state
// ─────────────────────────────────────────────────────────────────────

export interface DecorFragment {
  id: number;
  position: [number, number, number];
  velocity: [number, number, number];
  angularVel: [number, number, number];
  rotation: [number, number, number];
  /** Used by the cuboid renderer; ignored when `chunk` is set. */
  size: [number, number, number];
  /** Used by the cuboid renderer; ignored when `chunk` is set. */
  color: string;
  metalness: number;
  roughness: number;
  age: number;
  lifetime: number;
  /** When set, the renderer draws this GLB chunk (geometry + native
   *  PBR material) in place of a colored cuboid. */
  chunk?: FractureChunkTemplate;
}

export interface DecorPopFlash {
  id: number;
  position: [number, number, number];
  color: string;
  age: number;
  lifetime: number;
  radius: number;
}

interface DungeonDestructionState {
  decor: DungeonDecor[];
  hitsByIndex: Map<number, number>;
  destroyed: Set<number>;
  fragments: DecorFragment[];
  pops: DecorPopFlash[];
  setDecor: (decor: DungeonDecor[]) => void;
  /** Apply 1 hit. Returns `"destroyed" | "hit" | "ignored"`. */
  hitDecor: (idx: number) => "destroyed" | "hit" | "ignored";
  /** Force destruction (used internally on HP-zero). */
  shatterDecor: (idx: number, bbox: DecorBBox) => void;
  tickFragments: (dt: number) => void;
  reset: () => void;
}

let _fxIdCounter = 1;

export const useDungeonDestruction = create<DungeonDestructionState>((set, get) => ({
  decor: [],
  hitsByIndex: new Map(),
  destroyed: new Set(),
  fragments: [],
  pops: [],

  setDecor: (decor) =>
    set({
      decor,
      hitsByIndex: new Map(),
      destroyed: new Set(),
      fragments: [],
      pops: [],
    }),

  hitDecor: (idx) => {
    const state = get();
    if (state.destroyed.has(idx)) return "ignored";
    const d = state.decor[idx];
    if (!d) return "ignored";
    const mat = DECOR_MATERIAL[d.type];
    if (!mat) return "ignored";
    const props = MATERIAL_PROPS[mat];

    const cur = (state.hitsByIndex.get(idx) ?? 0) + 1;
    if (cur >= props.hp) {
      const bbox = lookupDecorBBoxForDestruction(d);
      if (bbox) {
        get().shatterDecor(idx, bbox);
      } else {
        // No bbox known yet — still mark destroyed so collider clears,
        // but skip the visual shatter. Should be rare since the decor
        // can only be hit once visible/loaded. Still play the smash
        // so the kill always lands audibly.
        const nextDestroyed = new Set(state.destroyed);
        nextDestroyed.add(idx);
        set({ destroyed: nextDestroyed });
        playDecorSmash(mat, 1);
      }
      return "destroyed";
    }
    const nextHits = new Map(state.hitsByIndex);
    nextHits.set(idx, cur);
    set({ hitsByIndex: nextHits });
    // Softer "thunk" cue for hits that didn't yet destroy the prop —
    // size scaled off the bbox if it's loaded, otherwise neutral.
    const thunkBBox = lookupDecorBBoxForDestruction(d);
    const thunkSize = thunkBBox
      ? sizeFactorFromVolume(8 * thunkBBox.hx * thunkBBox.hy * thunkBBox.hz)
      : 1;
    playDecorThunk(mat, thunkSize);
    return "hit";
  },

  shatterDecor: (idx, bbox) => {
    const state = get();
    if (state.destroyed.has(idx)) return;
    const d = state.decor[idx];
    if (!d) return;
    const mat = DECOR_MATERIAL[d.type];
    if (!mat) return;
    const props = MATERIAL_PROPS[mat];

    const chunkTemplates = getFractureTemplates(d.type);
    const newFragments: DecorFragment[] =
      chunkTemplates && chunkTemplates.length > 0
        ? buildChunkFragments(d, chunkTemplates)
        : buildCuboidFragments(d, bbox, props);

    const popRadius = Math.max(0.3, Math.max(bbox.hx, bbox.hz) * 1.4);
    const pop: DecorPopFlash = {
      id: _fxIdCounter++,
      position: [d.x, bbox.cy, d.z],
      color: props.popColor,
      age: 0,
      lifetime: 0.35,
      radius: popRadius,
    };

    // Enforce the global fragment cap (FIFO eviction). Keeps the
    // GPU draw count bounded even during back-to-back AOE shatters.
    const merged = [...state.fragments, ...newFragments];
    const trimmed =
      merged.length > MAX_TOTAL_FRAGMENTS
        ? merged.slice(merged.length - MAX_TOTAL_FRAGMENTS)
        : merged;

    const nextDestroyed = new Set(state.destroyed);
    nextDestroyed.add(idx);
    set({
      destroyed: nextDestroyed,
      fragments: trimmed,
      pops: [...state.pops, pop],
    });

    const containerKind = CONTAINER_LOOT_KIND[d.type];
    if (containerKind) {
      // Loot containers: spawn real LootDrops (gold, gems, scrolls,
      // potions, weapons) at the prop's footprint instead of pouring
      // a flat build-resource into the inventory.
      const drops = rollContainerLootDrops(containerKind, d.x, bbox.cy, d.z);
      if (drops.length > 0) {
        useLootDrops.getState().addDrops(drops);
      }
    } else if (props.resourceKind) {
      const min = props.resourceMin;
      const max = props.resourceMax;
      const amount = min + Math.floor(Math.random() * (max - min + 1));
      const wood = props.resourceKind === "wood" ? amount : 0;
      const stone = props.resourceKind === "stone" ? amount : 0;
      const gold = props.resourceKind === "gold" ? amount : 0;
      useBuildSystem.getState().addResources(wood, stone, gold);
    }

    // Per-material smash SFX. Volume scales with the bbox volume so a
    // tiny pot is quieter than a pillar.
    const smashSize = sizeFactorFromVolume(8 * bbox.hx * bbox.hy * bbox.hz);
    playDecorSmash(mat, smashSize);
  },

  tickFragments: (dt) => {
    const state = get();
    if (state.fragments.length === 0 && state.pops.length === 0) return;

    let mutated = false;
    let nextFrags: DecorFragment[] = state.fragments;
    if (state.fragments.length > 0) {
      nextFrags = [];
      const G = 14;
      for (const f of state.fragments) {
        const age = f.age + dt;
        if (age >= f.lifetime) {
          mutated = true;
          continue;
        }
        const drag = 0.94;
        const vx = f.velocity[0] * drag;
        const vy = f.velocity[1] - G * dt;
        const vz = f.velocity[2] * drag;
        const nx = f.position[0] + vx * dt;
        let ny = f.position[1] + vy * dt;
        const nz = f.position[2] + vz * dt;
        let bouncedVy = vy;
        if (ny < 0.05) {
          ny = 0.05;
          bouncedVy = Math.abs(vy) * 0.25;
        }
        nextFrags.push({
          ...f,
          age,
          velocity: [vx, bouncedVy, vz],
          position: [nx, ny, nz],
          rotation: [
            f.rotation[0] + f.angularVel[0] * dt,
            f.rotation[1] + f.angularVel[1] * dt,
            f.rotation[2] + f.angularVel[2] * dt,
          ],
        });
        mutated = true;
      }
    }

    let nextPops: DecorPopFlash[] = state.pops;
    if (state.pops.length > 0) {
      nextPops = [];
      for (const p of state.pops) {
        const age = p.age + dt;
        if (age >= p.lifetime) {
          mutated = true;
          continue;
        }
        nextPops.push({ ...p, age });
        mutated = true;
      }
    }

    if (mutated) set({ fragments: nextFrags, pops: nextPops });
  },

  reset: () =>
    set({
      decor: [],
      hitsByIndex: new Map(),
      destroyed: new Set(),
      fragments: [],
      pops: [],
    }),
}));

// ─────────────────────────────────────────────────────────────────────
// Fragment builders
// ─────────────────────────────────────────────────────────────────────

/** Procedural cuboid chunks — the original "colored boxes" path used
 *  when no fracture GLB is registered for this decor type. */
function buildCuboidFragments(
  d: DungeonDecor,
  bbox: DecorBBox,
  props: MaterialProps,
): DecorFragment[] {
  const out: DecorFragment[] = [];
  const maxDim = Math.max(bbox.hx, bbox.hy, bbox.hz);
  const minDim = Math.max(0.05, Math.min(bbox.hx, bbox.hy, bbox.hz));

  for (let i = 0; i < FRAGMENTS_PER_SHATTER; i++) {
    const lx = (Math.random() - 0.5) * 2 * bbox.hx;
    const ly = (Math.random() - 0.5) * 2 * bbox.hy;
    const lz = (Math.random() - 0.5) * 2 * bbox.hz;
    const px = d.x + lx;
    const py = bbox.cy + ly;
    const pz = d.z + lz;

    const horiz = Math.max(0.001, Math.sqrt(lx * lx + lz * lz));
    const outX = lx / horiz;
    const outZ = lz / horiz;
    const speed = 1.5 + Math.random() * 2.5;
    const vx = outX * speed + (Math.random() - 0.5) * 1.5;
    const vy = 2.5 + Math.random() * 3.0;
    const vz = outZ * speed + (Math.random() - 0.5) * 1.5;

    const sizeBase = minDim * 0.4 + maxDim * 0.05;
    const sx = sizeBase * (0.6 + Math.random() * 0.8);
    const sy = sizeBase * (0.6 + Math.random() * 0.8);
    const sz = sizeBase * (0.6 + Math.random() * 0.8);

    out.push({
      id: _fxIdCounter++,
      position: [px, py, pz],
      velocity: [vx, vy, vz],
      angularVel: [
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
      ],
      rotation: [
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      ],
      size: [sx, sy, sz],
      color: Math.random() > 0.5 ? props.color : props.altColor,
      metalness: props.metalness,
      roughness: props.roughness,
      age: 0,
      lifetime: 1.4 + Math.random() * 0.8,
    });
  }
  return out;
}

/** Real GLB chunks — sampled from the registered fracture asset.
 *  Each chunk spawns at its native local offset (so the prop visibly
 *  blows apart from where it stood) and inherits the GLB's PBR
 *  material via the shared `chunk` template reference. */
function buildChunkFragments(
  d: DungeonDecor,
  templates: FractureChunkTemplate[],
): DecorFragment[] {
  const out: DecorFragment[] = [];
  const scale = d.scale ?? 1;
  // Cap at FRAGMENTS_PER_SHATTER even if the fracture asset has more
  // meshes registered (defense-in-depth on top of the loader's cap).
  const count = Math.min(templates.length, FRAGMENTS_PER_SHATTER);

  // Angular velocity scaling: bigger slabs have larger moment of
  // inertia and should tumble slower than small shards. Reference
  // radius matches a "typical" mid-sized chunk; multiplier clamped
  // so neither extreme spins absurdly fast nor sits still.
  // ANG_BASE matches the previous fixed range (±4 rad/s) at mult=1.
  const REF_RADIUS = 0.2;
  const ANG_BASE = 4;
  const ANG_MIN_MULT = 0.5;
  const ANG_MAX_MULT = 2.0;
  // Initial random tilt — small enough to keep recognizable chunk
  // shapes oriented, large enough to break the stiff axis-aligned
  // look every chunk would otherwise share at t=0.
  const INIT_TILT = 0.3;

  for (let i = 0; i < count; i++) {
    const tpl = templates[i];
    // Spawn each chunk at its native position inside the prop, so the
    // assembled fracture visually starts as the intact prop and then
    // explodes outward.
    const px = d.x + tpl.offset.x * scale;
    const py = tpl.offset.y * scale;
    const pz = d.z + tpl.offset.z * scale;

    // Outward velocity from the prop center for a clean radial burst.
    const dx = tpl.offset.x;
    const dz = tpl.offset.z;
    const horiz = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
    const outX = dx / horiz;
    const outZ = dz / horiz;
    const speed = 1.2 + Math.random() * 2.2;
    const vx = outX * speed + (Math.random() - 0.5) * 1.2;
    const vy = 2.5 + Math.random() * 3.0;
    const vz = outZ * speed + (Math.random() - 0.5) * 1.2;

    const sizeRadius = Math.max(0.05, tpl.radius * scale);
    const angMult = Math.min(
      ANG_MAX_MULT,
      Math.max(ANG_MIN_MULT, REF_RADIUS / sizeRadius),
    );
    const angRange = ANG_BASE * angMult;

    out.push({
      id: _fxIdCounter++,
      position: [px, py, pz],
      velocity: [vx, vy, vz],
      angularVel: [
        (Math.random() - 0.5) * 2 * angRange,
        (Math.random() - 0.5) * 2 * angRange,
        (Math.random() - 0.5) * 2 * angRange,
      ],
      rotation: [
        (Math.random() - 0.5) * 2 * INIT_TILT,
        (Math.random() - 0.5) * 2 * INIT_TILT,
        (Math.random() - 0.5) * 2 * INIT_TILT,
      ],
      // size/color/metalness/roughness are ignored when `chunk` is set
      // but the type requires them, so populate sensible neutrals.
      size: [tpl.radius * 2, tpl.radius * 2, tpl.radius * 2],
      color: "#ffffff",
      metalness: 0,
      roughness: 1,
      age: 0,
      lifetime: 1.6 + Math.random() * 0.8,
      chunk: tpl,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Bbox lookup (procedural fallbacks for non-GLB types)
// ─────────────────────────────────────────────────────────────────────

/** Hand-tuned half-extents for procedural-only blockers (no GLB to
 *  measure). `scaled` follows placement-time `d.scale`. */
export interface ProceduralBBoxSpec extends DecorBBox {
  scaled?: boolean;
}

export const PROCEDURAL_DECOR_BBOX: Partial<Record<DecorType, ProceduralBBoxSpec>> = {
  sarcophagus: { hx: 0.425, hy: 0.4,  hz: 1.025, cy: 0.4,  scaled: true },
  minecart:    { hx: 0.3,   hy: 0.225, hz: 0.45, cy: 0.225 },
  crystal:     { hx: 0.2,   hy: 0.5,   hz: 0.2,  cy: 0.5,  scaled: true },
};

/** Resolve a placement's bbox: GLB registry → procedural fallback →
 *  null (non-blocker, or GLB not loaded yet). */
export function resolveDecorBBox(
  d: DungeonDecor,
  bboxKeyForDecor: (d: DungeonDecor) => string | null,
): DecorBBox | null {
  const k = bboxKeyForDecor(d);
  if (k) {
    const reg = useGLBBboxRegistry.getState().bboxes[k];
    if (reg) {
      const scale = d.scale ?? 1;
      if (scale !== 1) {
        return {
          hx: reg.hx * scale,
          hy: reg.hy * scale,
          hz: reg.hz * scale,
          cy: reg.cy * scale,
        };
      }
      return reg;
    }
    return null;
  }

  const proc = PROCEDURAL_DECOR_BBOX[d.type];
  if (proc) {
    if (proc.scaled) {
      const scale = d.scale ?? 1;
      return {
        hx: proc.hx * scale,
        hy: proc.hy * scale,
        hz: proc.hz * scale,
        cy: proc.cy * scale,
      };
    }
    return { hx: proc.hx, hy: proc.hy, hz: proc.hz, cy: proc.cy };
  }
  return null;
}

// Mirror of `dungeonDecorBBoxKey` in `DungeonScene.tsx`.
function destructionBBoxKeyFor(d: DungeonDecor): string | null {
  const mapping = DECOR_TO_DUNGEON_ASSET[d.type];
  if (!mapping) return null;
  const assetDef = resolveAssetDef(mapping.asset, mapping.source);
  if (!assetDef) return null;
  return glbBboxKey(assetDef.path, mapping.height);
}

function lookupDecorBBoxForDestruction(d: DungeonDecor): DecorBBox | null {
  return resolveDecorBBox(d, destructionBBoxKeyFor);
}

// ─────────────────────────────────────────────────────────────────────
// Hit testing API for player attacks
// ─────────────────────────────────────────────────────────────────────

/**
 * Apply a swing to dungeon decor. Non-AOE swings hit the single
 * closest decor inside the cone; AOE swings hit every decor in range.
 */
export function tryDamageDungeonDecor(
  px: number,
  pz: number,
  facingX: number,
  facingZ: number,
  range: number,
  halfArc: number,
  isAOE: boolean,
): { hits: number; destroyed: number } {
  const state = useDungeonDestruction.getState();
  if (state.decor.length === 0) return { hits: 0, destroyed: 0 };

  const cosArc = Math.cos(halfArc);
  const rangeSq = range * range;

  const candidates: { idx: number; distSq: number }[] = [];
  for (let i = 0; i < state.decor.length; i++) {
    if (state.destroyed.has(i)) continue;
    const d = state.decor[i];
    if (!DECOR_MATERIAL[d.type]) continue;

    const dx = d.x - px;
    const dz = d.z - pz;
    const distSq = dx * dx + dz * dz;
    if (distSq > rangeSq) continue;

    if (!isAOE) {
      const dist = Math.sqrt(distSq);
      if (dist > 1e-4) {
        const cosAngle = (facingX * dx + facingZ * dz) / dist;
        if (cosAngle < cosArc) continue;
      }
    }
    candidates.push({ idx: i, distSq });
  }

  if (candidates.length === 0) return { hits: 0, destroyed: 0 };

  let toApply: number[];
  if (isAOE) {
    toApply = candidates.map((c) => c.idx);
  } else {
    candidates.sort((a, b) => a.distSq - b.distSq);
    toApply = [candidates[0].idx];
  }

  let hits = 0;
  let destroyed = 0;
  for (const idx of toApply) {
    const result = state.hitDecor(idx);
    if (result === "hit" || result === "destroyed") {
      hits++;
      if (result === "destroyed") destroyed++;
    }
  }
  return { hits, destroyed };
}

// ─────────────────────────────────────────────────────────────────────
// Visual fragment renderer
// ─────────────────────────────────────────────────────────────────────

/** Fragment chunks + pop flashes for active shatters. */
export function DungeonDecorFragments() {
  const fragments = useDungeonDestruction((s) => s.fragments);
  const pops = useDungeonDestruction((s) => s.pops);
  const tick = useDungeonDestruction((s) => s.tickFragments);

  useFrame((_, dt) => {
    tick(Math.min(0.05, dt));
  });

  return (
    <group>
      {fragments.map((f) => {
        const lifeT = f.age / f.lifetime;
        const opacity = lifeT < 0.7 ? 1 : Math.max(0, 1 - (lifeT - 0.7) / 0.3);
        if (f.chunk) {
          // GLB chunk: reuse the source mesh's geometry + native PBR
          // material directly. Opacity tween is skipped so the texture
          // stays crisp until the fragment expires.
          return (
            <mesh
              key={`frag_${f.id}`}
              position={f.position}
              rotation={f.rotation}
              geometry={f.chunk.geometry}
              material={f.chunk.material}
              castShadow
              visible={opacity > 0}
            />
          );
        }
        return (
          <mesh
            key={`frag_${f.id}`}
            position={f.position}
            rotation={f.rotation}
            castShadow
          >
            <boxGeometry args={f.size} />
            <meshStandardMaterial
              color={f.color}
              metalness={f.metalness}
              roughness={f.roughness}
              transparent={opacity < 1}
              opacity={opacity}
            />
          </mesh>
        );
      })}
      {pops.map((p) => {
        const lifeT = p.age / p.lifetime;
        const radius = p.radius * (0.4 + lifeT * 1.6);
        const opacity = (1 - lifeT) * 0.6;
        return (
          <mesh key={`pop_${p.id}`} position={p.position}>
            <sphereGeometry args={[radius, 12, 8]} />
            <meshBasicMaterial color={p.color} transparent opacity={opacity} />
          </mesh>
        );
      })}
    </group>
  );
}

export function useIsDecorDestroyed(idx: number): boolean {
  return useDungeonDestruction((s) => s.destroyed.has(idx));
}

export function useDestroyedSet(): Set<number> {
  return useDungeonDestruction((s) => s.destroyed);
}
