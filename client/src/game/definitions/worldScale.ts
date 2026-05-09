/**
 * Canonical world-scale constants.
 *
 * Single source of truth for the distances used by:
 *   • the home-island 8-sector world map (`homeIslandWorldMap.ts`)
 *   • the generative island spawner (`generativeIslandSpawner.ts`)
 *   • the open-water sailing scene (`OpenWaterSailing.tsx`) — ocean size,
 *     LOD thresholds, horizon fade
 *   • the island editor preview camera and minimap scale
 *
 * All values are in Three.js world units, where 1 unit ≈ 1 metre.
 *
 * Scaling rules of thumb:
 *   1. Travel time from the home shoreline to the nearest sector island
 *      must be non-trivial for every hull tier (≥ 50s on a galleon,
 *      ≥ 100s on a raft).
 *   2. No two adjacent generated islands (45° apart) may overlap at any
 *      danger tier; keep a ≥ 2× island-radius gap for combat breathing
 *      room.
 *   3. Encounter rings must clear both the home island and the next
 *      sector over.
 */

/** Home-island radius at the centre of the world (always this size). */
export const HOME_ISLAND_RADIUS = 100;

/** Danger-tier → distance from world origin to sector island centre. */
export const SECTOR_DISTANCE_BY_TIER: Record<number, number> = {
  2: 700,
  3: 900,
  4: 1100,
  5: 1300,
};

/**
 * Per-tier island radius model. Final radius is
 * `ISLAND_RADIUS_BASE + tier * ISLAND_RADIUS_PER_TIER ± ISLAND_RADIUS_JITTER`.
 */
export const ISLAND_RADIUS_BASE = 70;
export const ISLAND_RADIUS_PER_TIER = 18;
export const ISLAND_RADIUS_JITTER = 10;

/** Per-tier peak terrain height. `PEAK_HEIGHT_BASE + tier * PEAK_HEIGHT_PER_TIER`. */
export const PEAK_HEIGHT_BASE = 25;
export const PEAK_HEIGHT_PER_TIER = 7;

/**
 * Encounter ring around the island. Ambushing ships / monsters spawn
 * between `radius + ENCOUNTER_RING_MIN` and
 * `radius + ENCOUNTER_RING_MIN + ENCOUNTER_RING_RANGE`.
 */
export const ENCOUNTER_RING_MIN = 120;
export const ENCOUNTER_RING_RANGE = 180;

/**
 * Ocean-plane side length used by `OpenWaterSailing`. Must cover the
 * outermost sector island + its encounter ring + a horizon fade margin.
 *
 *   max_reach = max(sector_distance) + max(island_radius) + encounter_ring
 *             = 1300 + 160 + 300 = 1760m
 *   ocean_size = 2 × max_reach + horizon_margin
 *              = 3520 + 80 ≈ 3600m
 */
export const OCEAN_SIZE = 3600;

/** Default ocean-plane tessellation (segments along each axis). */
export const OCEAN_SEGMENTS = 384;

/**
 * LOD thresholds for sector islands as seen from the player's ship.
 *
 *   > ISLAND_LOD_HIDE            → not rendered (beyond horizon cull)
 *   ≤ ISLAND_LOD_SILHOUETTE      → low-poly billboard / silhouette
 *   ≤ ISLAND_LOD_FULL_MESH       → full procedural mesh, no scatter
 *   ≤ ISLAND_LOD_HIGH_DETAIL     → full mesh + instanced scatter
 */
export const ISLAND_LOD_HIDE        = 1600;
export const ISLAND_LOD_SILHOUETTE  = 550;
export const ISLAND_LOD_FULL_MESH   = 350;
export const ISLAND_LOD_HIGH_DETAIL = 120;

/** Minimum safe gap between two adjacent generated islands. */
export const SAFE_ISLAND_GAP = 200;

/** Radius where sea creatures + ambushers may spawn from the player ship. */
export const AMBUSH_SPAWN_RADIUS = 300;

// ── Derived helpers ──────────────────────────────────────────────────────

/** Final island radius for a given danger tier (without RNG jitter). */
export function expectedIslandRadius(dangerTier: number): number {
  return ISLAND_RADIUS_BASE + dangerTier * ISLAND_RADIUS_PER_TIER;
}

/** Peak height for a given danger tier. */
export function expectedPeakHeight(dangerTier: number): number {
  return PEAK_HEIGHT_BASE + dangerTier * PEAK_HEIGHT_PER_TIER;
}

/**
 * Sector-to-sector chord length for adjacent sectors at two given distances.
 * Adjacent sectors are 45° apart on the compass.
 */
export function adjacentSectorChord(d1: number, d2: number): number {
  const angle = Math.PI / 4; // 45°
  return Math.sqrt(d1 * d1 + d2 * d2 - 2 * d1 * d2 * Math.cos(angle));
}

/**
 * Development sanity check. Returns `{ ok: true }` when all sector rings
 * leave at least `SAFE_ISLAND_GAP` between adjacent T5/T5 islands at the
 * maximum radius. Intended to be invoked at module load or in a test.
 */
export function validateWorldScale(
  sectorDistances: Record<string, number>,
  compassOrder: string[],
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const rMax = expectedIslandRadius(5) + ISLAND_RADIUS_JITTER;
  for (let i = 0; i < compassOrder.length; i++) {
    const a = compassOrder[i];
    const b = compassOrder[(i + 1) % compassOrder.length];
    const chord = adjacentSectorChord(sectorDistances[a], sectorDistances[b]);
    const gap = chord - 2 * rMax;
    if (gap < SAFE_ISLAND_GAP) {
      issues.push(`sector ${a} ↔ ${b} gap=${gap.toFixed(0)}m < SAFE_ISLAND_GAP (${SAFE_ISLAND_GAP}m)`);
    }
  }
  if (ISLAND_LOD_HIDE < Math.max(...Object.values(sectorDistances)) + rMax + 100) {
    issues.push(`ISLAND_LOD_HIDE must exceed max sector distance + island radius`);
  }
  if (OCEAN_SIZE < 2 * (Math.max(...Object.values(sectorDistances)) + rMax + ENCOUNTER_RING_MIN + ENCOUNTER_RING_RANGE)) {
    issues.push(`OCEAN_SIZE too small for outer encounter ring`);
  }
  return { ok: issues.length === 0, issues };
}
