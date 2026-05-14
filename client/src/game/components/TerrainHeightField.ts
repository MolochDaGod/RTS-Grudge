// Shared, mutable heightfield for the world terrain. Both the visual
// `Terrain` mesh and the physics `TerrainCollider` read from this same
// `Float32Array` so a single edit (raise / lower / flatten under a brush)
// updates both at once.
//
// Why a module-level array instead of a Zustand store?
// - The visual mesh uses thousands of vertex Y values per frame; pushing
//   that through React state on every brush stroke would be a non-starter.
// - The physics collider only needs to know "the data changed, please
//   rebuild" — a tiny version counter delivered via subscribers covers
//   that without re-rendering the whole scene.
// - `getTerrainHeight()` is called by the player movement code, mob
//   spawners, the map widget, etc. They all benefit from reading the
//   same array directly.
//
// Public API:
//   `terrainHeights`              — the live Float32Array (mutate in place)
//   `TERRAIN_RESOLUTION` / `WORLD_SIZE` / `MAX_HEIGHT`  — geometry constants
//   `terrainVersion()`            — increments after every commit
//   `subscribeTerrainEdit(fn)`    — fire when the heightfield changes
//   `commitTerrainEdit(rect)`     — broadcast that a region was edited
//   `editTerrainBrush(opts)`      — raise / lower / flatten under a brush
//   `getTerrainHeight(x, z)`      — bilinear sample (world-space)
//   `sampleTerrainHeightRaw(...)` — nearest-cell sample (world-space)

import { generateInitialTerrainHeights } from "./TerrainGen";

export const WORLD_SIZE = 200;
export const TERRAIN_RESOLUTION = 128;
export const MAX_HEIGHT = 12;
export const TERRAIN_SEED = 42;

// One Y value per (z * N + x). Exported as a `let` because we replace the
// underlying buffer when `resetTerrain()` is called (e.g. on a fresh game),
// but in 99 % of the lifetime callers should mutate this in place.
export let terrainHeights: Float32Array =
  generateInitialTerrainHeights(WORLD_SIZE, TERRAIN_RESOLUTION, MAX_HEIGHT, TERRAIN_SEED);

// Bumped on every committed edit. Subscribers compare against the previous
// value to know whether they need to rebuild downstream resources (e.g.
// the Rapier heightfield collider).
let _version = 0;
export function terrainVersion(): number {
  return _version;
}

// AABB of the most recent edit, in heightfield index space (inclusive).
// The visual mesh uses this to recompute only the affected vertex range
// instead of walking the entire grid every brush tick.
export interface TerrainEditRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}
let _lastRect: TerrainEditRect | null = null;
export function lastTerrainEditRect(): TerrainEditRect | null {
  return _lastRect;
}

type EditListener = (rect: TerrainEditRect, version: number) => void;
const _listeners = new Set<EditListener>();
export function subscribeTerrainEdit(fn: EditListener): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}

export function commitTerrainEdit(rect: TerrainEditRect): void {
  _version++;
  _lastRect = rect;
  // Snapshot the listener set so a listener that unsubscribes inside its
  // own callback (common in React effects) doesn't skip a sibling.
  const snapshot = Array.from(_listeners);
  for (const fn of snapshot) {
    try {
      fn(rect, _version);
    } catch (err) {
      console.error("[TerrainHeightField] listener threw:", err);
    }
  }
}

// Replace the entire buffer (used when entering a saved world). Triggers a
// full-grid commit so every subscriber rebuilds.
export function resetTerrain(next: Float32Array): void {
  if (next.length !== TERRAIN_RESOLUTION * TERRAIN_RESOLUTION) {
    console.warn(
      `[TerrainHeightField] resetTerrain: length mismatch ${next.length} vs ${TERRAIN_RESOLUTION * TERRAIN_RESOLUTION}; ignoring.`,
    );
    return;
  }
  terrainHeights = next;
  commitTerrainEdit({ x0: 0, z0: 0, x1: TERRAIN_RESOLUTION - 1, z1: TERRAIN_RESOLUTION - 1 });
}

// World-space → heightfield index conversions. Centered on origin: the
// terrain spans `[-WORLD_SIZE/2, +WORLD_SIZE/2]` on both X and Z.
export function worldXToCol(x: number): number {
  return ((x / WORLD_SIZE) + 0.5) * (TERRAIN_RESOLUTION - 1);
}
export function worldZToRow(z: number): number {
  return ((z / WORLD_SIZE) + 0.5) * (TERRAIN_RESOLUTION - 1);
}

// Bilinear-interpolated terrain height at a world position. Used by the
// player movement code, mob spawners, projectile impact tests, etc.
export function getTerrainHeight(x: number, z: number): number {
  const mapX = worldXToCol(x);
  const mapZ = worldZToRow(z);
  const ix = Math.floor(mapX);
  const iz = Math.floor(mapZ);
  const fx = mapX - ix;
  const fz = mapZ - iz;
  const N = TERRAIN_RESOLUTION;
  const cl = (v: number) => (v < 0 ? 0 : v > N - 1 ? N - 1 : v);
  const cix = cl(ix);
  const ciz = cl(iz);
  const cix1 = cl(ix + 1);
  const ciz1 = cl(iz + 1);
  const h00 = terrainHeights[ciz * N + cix];
  const h10 = terrainHeights[ciz * N + cix1];
  const h01 = terrainHeights[ciz1 * N + cix];
  const h11 = terrainHeights[ciz1 * N + cix1];
  return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
}

// Nearest-cell sample. Cheaper than bilinear; used inside the brush loop
// where each cell is processed individually anyway.
export function sampleTerrainHeightRaw(col: number, row: number): number {
  const N = TERRAIN_RESOLUTION;
  const c = col < 0 ? 0 : col > N - 1 ? N - 1 : col;
  const r = row < 0 ? 0 : row > N - 1 ? N - 1 : row;
  return terrainHeights[r * N + c];
}

export type BrushMode = "raise" | "lower" | "flatten" | "smooth";

export interface BrushEditOptions {
  /** World-space center of the brush (x, z). */
  worldX: number;
  worldZ: number;
  /** World-space brush radius in metres. */
  radius: number;
  /** Edit mode. */
  mode: BrushMode;
  /** Per-tick strength (metres for raise/lower, lerp 0..1 for flatten/smooth). */
  strength: number;
  /** Required for `flatten` — the target Y to lerp toward. */
  targetY?: number;
  /** Hard floor / ceiling so a player can't dig to -infinity or build to +infinity. */
  minY?: number;
  maxY?: number;
}

const DEFAULT_MIN_Y = -2;
const DEFAULT_MAX_Y = MAX_HEIGHT * 1.4;

/**
 * Apply a brush edit to `terrainHeights` in place and broadcast a commit
 * for the touched rectangle. Returns the rectangle so callers can pass it
 * to `commitTerrainEdit` themselves if they need to bundle several edits.
 *
 * The falloff is a smooth `1 - smoothstep(0.4, 1, d/radius)` so the centre
 * gets full strength and the edge feathers out — avoids cliff edges when
 * the player drags the brush across the ground.
 */
export function editTerrainBrush(opts: BrushEditOptions): TerrainEditRect | null {
  const { worldX, worldZ, radius, mode, strength } = opts;
  const minY = opts.minY ?? DEFAULT_MIN_Y;
  const maxY = opts.maxY ?? DEFAULT_MAX_Y;
  const N = TERRAIN_RESOLUTION;
  const elementSize = WORLD_SIZE / (N - 1);

  // Convert the brush AABB into heightfield index space. `pad` adds a
  // one-cell margin so the falloff curve has room to feather.
  const cellRadius = radius / elementSize;
  const centerCol = worldXToCol(worldX);
  const centerRow = worldZToRow(worldZ);
  const pad = 1;
  const c0 = Math.max(0, Math.floor(centerCol - cellRadius - pad));
  const r0 = Math.max(0, Math.floor(centerRow - cellRadius - pad));
  const c1 = Math.min(N - 1, Math.ceil(centerCol + cellRadius + pad));
  const r1 = Math.min(N - 1, Math.ceil(centerRow + cellRadius + pad));
  if (c1 < c0 || r1 < r0) return null;

  // For smooth mode we need the *original* heights to average from, not
  // the partially-modified buffer. Snapshot the rect once.
  let snapshot: Float32Array | null = null;
  const snapW = c1 - c0 + 1;
  const snapH = r1 - r0 + 1;
  if (mode === "smooth") {
    snapshot = new Float32Array(snapW * snapH);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        snapshot[(r - r0) * snapW + (c - c0)] = terrainHeights[r * N + c];
      }
    }
  }

  const rad2 = cellRadius * cellRadius;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const dx = c - centerCol;
      const dz = r - centerRow;
      const d2 = dx * dx + dz * dz;
      if (d2 > rad2) continue;
      const t = Math.sqrt(d2) / cellRadius; // 0 at centre, 1 at edge
      // Smooth falloff: full strength inside `inner`, fade to 0 at edge.
      const inner = 0.4;
      const fall =
        t <= inner ? 1 : 1 - smoothstep(inner, 1, t);

      const idx = r * N + c;
      const cur = terrainHeights[idx];
      let next = cur;
      switch (mode) {
        case "raise":
          next = cur + strength * fall;
          break;
        case "lower":
          next = cur - strength * fall;
          break;
        case "flatten": {
          const target = opts.targetY ?? cur;
          next = lerp(cur, target, Math.min(1, strength * fall));
          break;
        }
        case "smooth": {
          // 3x3 average from the snapshot. Edge cells fall back to `cur`.
          let sum = 0;
          let n = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const sc = c + dc;
              const sr = r + dr;
              if (sc < c0 || sc > c1 || sr < r0 || sr > r1) continue;
              sum += snapshot![(sr - r0) * snapW + (sc - c0)];
              n++;
            }
          }
          const avg = n > 0 ? sum / n : cur;
          next = lerp(cur, avg, Math.min(1, strength * fall));
          break;
        }
      }
      if (next < minY) next = minY;
      if (next > maxY) next = maxY;
      terrainHeights[idx] = next;
    }
  }

  const rect: TerrainEditRect = { x0: c0, z0: r0, x1: c1, z1: r1 };
  commitTerrainEdit(rect);
  return rect;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
