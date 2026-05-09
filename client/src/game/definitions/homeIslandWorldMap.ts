/**
 * Home-island world map.
 *
 * The captain's home island sits at the centre of a 3×3 sector grid. The
 * eight surrounding compass sectors (N, NE, E, SE, S, SW, W, NW) each host
 * a procedurally generated island that rotates on a fixed cadence.
 *
 * Refresh cadence: every epoch all eight sectors roll a new seed derived
 * from `(playerGrudgeId, sectorId, epochId)`. The default epoch is 1 CST
 * day long, aligned to 23:00 CST ("11 PM CST") as per the grudge game
 * design.
 */

import type { IslandType } from './islandTypes';
import { SECTOR_DISTANCE_BY_TIER } from './worldScale';

export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export const COMPASS_ORDER: CompassDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export interface SectorDef {
  id: CompassDirection;
  label: string;
  bearingDeg: number;        // degrees clockwise from north
  /** Distance from home, in Three.js world units (≈ metres). */
  distance: number;
  /** Biome pool the sector can roll from; first element is the default. */
  biomePool: string[];
  /** Danger tier 1-5. Feeds enemy ship & boss scaling. */
  dangerTier: number;
  /** Which island-type classification the generated island carries. */
  islandType: IslandType;
  /** Short flavour blurb surfaced in the world-map card UI. */
  blurb: string;
}

/**
 * Distances are derived from `SECTOR_DISTANCE_BY_TIER` in
 * `worldScale.ts` so a single change to the ring layout propagates to
 * every consumer. Each sector picks the ring matching its danger tier.
 */
export const HOME_SECTOR_DEFS: Record<CompassDirection, SectorDef> = {
  N:  { id: 'N',  label: 'Northern Reach',     bearingDeg: 0,   distance: SECTOR_DISTANCE_BY_TIER[3], biomePool: ['tundra', 'arctic', 'boreal'],          dangerTier: 3, islandType: 'pve',   blurb: 'Frozen islets crawling with Legion frost-raiders.' },
  NE: { id: 'NE', label: 'Splintered Cay',     bearingDeg: 45,  distance: SECTOR_DISTANCE_BY_TIER[2], biomePool: ['tropical', 'coast', 'coral'],          dangerTier: 2, islandType: 'pve',   blurb: 'Shallow reefs, wreck-divers, and coral trade routes.' },
  E:  { id: 'E',  label: 'Burning Expanse',    bearingDeg: 90,  distance: SECTOR_DISTANCE_BY_TIER[4], biomePool: ['volcanic', 'obsidian', 'ashland'],     dangerTier: 4, islandType: 'pve',   blurb: 'Smoking black-sand beaches. Fire elementals and dragons.' },
  SE: { id: 'SE', label: 'Sargasso Drift',     bearingDeg: 135, distance: SECTOR_DISTANCE_BY_TIER[3], biomePool: ['swamp', 'mangrove', 'haunted'],        dangerTier: 3, islandType: 'pve',   blurb: 'Choked lagoons. Beware the kraken spawn and spectral ships.' },
  S:  { id: 'S',  label: 'Gilded Shoals',      bearingDeg: 180, distance: SECTOR_DISTANCE_BY_TIER[2], biomePool: ['tropical', 'desert', 'oasis'],         dangerTier: 2, islandType: 'pve',   blurb: 'Friendly ports, calm seas. Best harvesting zone for newcomers.' },
  SW: { id: 'SW', label: 'Stormwatch',         bearingDeg: 225, distance: SECTOR_DISTANCE_BY_TIER[4], biomePool: ['stormy', 'coast', 'cliffside'],        dangerTier: 4, islandType: 'pve',   blurb: 'Perma-storm. Skyterrors nest in the cliffs.' },
  W:  { id: 'W',  label: 'Emerald Hollows',    bearingDeg: 270, distance: SECTOR_DISTANCE_BY_TIER[3], biomePool: ['forest', 'jungle', 'fey'],             dangerTier: 3, islandType: 'pve',   blurb: 'Elven glades, worge packs, and ley-line nodes.' },
  NW: { id: 'NW', label: 'Ruined Bastions',    bearingDeg: 315, distance: SECTOR_DISTANCE_BY_TIER[5], biomePool: ['haunted', 'ruins', 'undead'],          dangerTier: 5, islandType: 'pve',   blurb: 'Crumbling Undead strongholds. High risk, high reward.' },
};

// ── Epoch (refresh cadence) ───────────────────────────────────────────────

/** 23:00 CST → 05:00 UTC (CST is UTC-6; CDT is UTC-5 — we use CST fixed). */
const EPOCH_ROLLOVER_UTC_HOUR = 5;
const MS_PER_DAY = 86_400_000;

/**
 * Returns the current epoch id (daily integer) aligned to 23:00 CST.
 * Using `Date.UTC` so this is deterministic across clients.
 */
export function currentEpochId(now = Date.now()): number {
  // Shift the reference so the rollover instant maps to midnight in the
  // shifted day.
  const shifted = now - EPOCH_ROLLOVER_UTC_HOUR * 3600_000;
  return Math.floor(shifted / MS_PER_DAY);
}

/** Milliseconds until the next sector refresh. */
export function millisUntilNextEpoch(now = Date.now()): number {
  const shifted = now - EPOCH_ROLLOVER_UTC_HOUR * 3600_000;
  const nextBoundary = (Math.floor(shifted / MS_PER_DAY) + 1) * MS_PER_DAY;
  return nextBoundary - shifted;
}

// ── Seed derivation ───────────────────────────────────────────────────────

/** Stable 32-bit FNV-1a hash. */
function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministic seed for a (player, sector, epoch) tuple. Returns a
 * 32-bit unsigned integer suitable for any seeded PRNG.
 */
export function sectorSeed(
  playerGrudgeId: string,
  sector: CompassDirection,
  epochId = currentEpochId(),
): number {
  return fnv1a32(`${playerGrudgeId}|${sector}|${epochId}`);
}

/** Roll a biome id for the sector using its seed + biome pool. */
export function rollBiome(def: SectorDef, seed: number): string {
  if (def.biomePool.length === 0) return 'tropical';
  return def.biomePool[seed % def.biomePool.length];
}

// ── Combined view for the world-map UI ────────────────────────────────────

export interface SectorState {
  def: SectorDef;
  epochId: number;
  seed: number;
  biome: string;
  /** ms until the sector re-rolls. */
  msToRefresh: number;
}

export function readSectorState(
  playerGrudgeId: string,
  sector: CompassDirection,
  now = Date.now(),
): SectorState {
  const epochId = currentEpochId(now);
  const def = HOME_SECTOR_DEFS[sector];
  const seed = sectorSeed(playerGrudgeId, sector, epochId);
  return {
    def,
    epochId,
    seed,
    biome: rollBiome(def, seed),
    msToRefresh: millisUntilNextEpoch(now),
  };
}

export function readAllSectorStates(
  playerGrudgeId: string,
  now = Date.now(),
): Record<CompassDirection, SectorState> {
  const out = {} as Record<CompassDirection, SectorState>;
  for (const dir of COMPASS_ORDER) out[dir] = readSectorState(playerGrudgeId, dir, now);
  return out;
}

/** Convert compass id → world-space offset (east=+x, north=-z). */
export function sectorWorldOffset(sector: CompassDirection): { x: number; z: number } {
  const def = HOME_SECTOR_DEFS[sector];
  const rad = (def.bearingDeg * Math.PI) / 180;
  return { x: Math.sin(rad) * def.distance, z: -Math.cos(rad) * def.distance };
}
