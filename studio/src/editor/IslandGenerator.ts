/**
 * Seeded procedural island generator.
 *
 * Constraints (from product brief):
 * - Heights cap at 3x player height above water → max ~5.4 m above sea level (player ≈ 1.8 m)
 * - Sea level = 0
 * - Carved bay along one side, suitable for a dock
 * - Flat building plateau in the central interior
 * - Stylized props (trees, rocks, bushes, flowers) + animals scattered with seeded jitter
 *
 * Output:
 * - Mutated TerrainData (heights + biome arrays)
 * - PlacedEntity[] of stylized props/creatures/resource_nodes/dock
 */
import { createNoise2D } from 'simplex-noise';
import alea from 'alea';
import type { MapProject, PlacedEntity, TerrainData, Vec3 } from '../types';
import {
  TREE_GLBS, ROCK_GLBS, HARVEST_GLBS, FISH_POOL, CREATURE_ASSET, pick,
} from './islandAssetPools';

export const SEA_LEVEL = 0;
export const PLAYER_HEIGHT = 1.8;
/** 20 ft above sea level — hard cap for all terrain heights. */
export const MAX_TERRAIN = 6.096;

/** Six distinct island morphologies, each with unique height-map logic. */
export type IslandProfile =
  | 'standard'   // balanced island with coastal hills
  | 'volcanic'   // tall cone, rocky ridges, snow at peak
  | 'atoll'      // ring island with central lagoon
  | 'fjord'      // elongated with multiple deep inlets + snow cap
  | 'rolling'    // low gentle hills, wide beaches, multiple plateaus
  | 'mesa';      // flat terraced highlands with cliff edges

const ALL_PROFILES: IslandProfile[] =
  ['standard', 'volcanic', 'atoll', 'fjord', 'rolling', 'mesa'];

const uid = (rng: () => number) => Math.floor(rng() * 1e9).toString(36);

/** Smooth saturate from 0 → 1 across [a, b]. */
function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

interface IslandShape {
  /** Centre of the bay carve in world coords (negative-Z by convention = "north") */
  bayDir: { x: number; z: number };
  /** Centre + radius of the building plateau */
  plateau: { x: number; z: number; r: number };
  /** Dock anchor point (water side, just outside the beach) */
  dock: { x: number; z: number };
  /** Mountain peak — dungeon / event entrance anchor */
  peak: { x: number; z: number; y: number };
}

// ── Island profile presets ──────────────────────────────────────────────────
interface ProfileParams {
  /** Island footprint as fraction of terrain size */
  islandFrac: number;
  /** Extra headroom above MAX_TERRAIN for peaks (volcanic gets > 1) */
  peakScale: number;
  /** Hill noise amplitude (0–1) */
  hillAmp: number;
  /** Number of bay carves (0–3) */
  bays: number;
  /** Bay depth multiplier */
  bayDepth: number;
  /** Number of plateaus (build pads) */
  plateaus: number;
  /** Ridge spine: extra noise that creates mountain ridgelines */
  ridgeAmp: number;
  /** Atoll mode: hollow out the centre */
  atoll: boolean;
  /** Island elongation factor (stretches the shape like a fjord) */
  elongX: number;
  /** Biome: assign snow above this height fraction */
  snowFrac: number;
}

// ridgeAmp kept low on all profiles — ridge noise was causing unnatural
// knife-edge peaks.  hillHigh (fine detail) is capped at 0.06 in the
// per-vertex loop so terrain stays walkable and avoids low-poly mountain look.
const PROFILES: Record<IslandProfile, ProfileParams> = {
  standard: { islandFrac:0.36, peakScale:0.82, hillAmp:0.45, bays:1, bayDepth:1.4, plateaus:1, ridgeAmp:0.0,  atoll:false, elongX:1.0, snowFrac:99   },
  volcanic: { islandFrac:0.30, peakScale:1.00, hillAmp:0.70, bays:0, bayDepth:0.8, plateaus:0, ridgeAmp:0.15, atoll:false, elongX:1.0, snowFrac:0.86 },
  atoll:    { islandFrac:0.40, peakScale:0.45, hillAmp:0.28, bays:0, bayDepth:0.6, plateaus:0, ridgeAmp:0.0,  atoll:true,  elongX:1.0, snowFrac:99   },
  fjord:    { islandFrac:0.34, peakScale:0.90, hillAmp:0.50, bays:2, bayDepth:2.0, plateaus:1, ridgeAmp:0.12, atoll:false, elongX:2.2, snowFrac:0.82 },
  rolling:  { islandFrac:0.44, peakScale:0.55, hillAmp:0.30, bays:1, bayDepth:1.0, plateaus:2, ridgeAmp:0.0,  atoll:false, elongX:1.0, snowFrac:99   },
  mesa:     { islandFrac:0.34, peakScale:0.90, hillAmp:0.18, bays:1, bayDepth:1.2, plateaus:3, ridgeAmp:0.0,  atoll:false, elongX:1.3, snowFrac:99   },
};

/**
 * Build heights + biome from a seeded shape. Pure function over the
 * provided TerrainData — mutates in place, returns shape metadata.
 *
 * Six island profiles (standard / volcanic / atoll / fjord / rolling / mesa)
 * are each seeded differently so every numeric seed produces a unique world.
 */
function buildIslandHeights(
  t: TerrainData,
  seed: number,
  profile: IslandProfile,
): IslandShape {
  const rng  = alea(seed);
  // Five independent noise layers for richer, more varied terrain
  const n1   = createNoise2D(rng);
  const n2   = createNoise2D(rng);
  const n3   = createNoise2D(rng);  // high-frequency detail
  const n4   = createNoise2D(rng);  // ridge / spine
  const n5   = createNoise2D(rng);  // large-scale island-shape warping

  const P    = PROFILES[profile];
  const half = t.size / 2;
  const cell = t.size / (t.resolution - 1);

  // ── Plateaus (build pads) ─────────────────────────────────────────────
  const numPlateaus = Math.min(P.plateaus + Math.floor(rng() * 2), 3);
  const plateaus = Array.from({ length: numPlateaus }, (_, k) => ({
    x:    (rng() - 0.5) * t.size * 0.22,
    z:    (rng() - 0.5) * t.size * 0.22,
    r:    t.size * (0.09 + rng() * 0.05),
    // Staggered heights so a mesa has terraces, rolling has gentle pads
    h:    MAX_TERRAIN * (0.18 + k * 0.14 + rng() * 0.10),
  }));
  // The FIRST plateau is always the player spawn pad
  const plateau = plateaus[0] ?? { x: 0, z: 0, r: t.size * 0.12, h: MAX_TERRAIN * 0.32 };

  // ── Bay directions (up to 3) ─────────────────────────────────────────────
  const numBays = Math.min(P.bays + Math.floor(rng() * 2), 3);
  const baseAngle = rng() * Math.PI * 2;
  const bayDirs = Array.from({ length: Math.max(numBays, 1) }, (_, i) => {
    const a = baseAngle + (i * Math.PI * 2) / Math.max(numBays, 1) + (rng() - 0.5) * 0.8;
    return { x: Math.cos(a), z: Math.sin(a) };
  });
  const bayDir = bayDirs[0]!;
  const dock = { x: bayDir.x * t.size * 0.42, z: bayDir.z * t.size * 0.42 };

  // ── Island shape parameters ─────────────────────────────────────────────
  // Rim expanded 25% for richer coastal height variation and build sites.
  const islandR     = t.size * P.islandFrac * 1.25;
  const oceanFloorR = islandR + t.size * 0.12;
  const OCEAN_FLOOR = -12.192; // 40 ft — deep trench for sharks / diving fish
  const peakH       = MAX_TERRAIN * P.peakScale;

  // Elongation axis (for fjord): rotate by a random angle
  const elongAngle = rng() * Math.PI;
  const elongCos   = Math.cos(elongAngle);
  const elongSin   = Math.sin(elongAngle);

  // ── Per-vertex generation ───────────────────────────────────────────────
  for (let zi = 0; zi < t.resolution; zi++) {
    for (let xi = 0; xi < t.resolution; xi++) {
      const wx = -half + xi * cell;
      const wz = -half + zi * cell;
      const i  = zi * t.resolution + xi;

      // Rotate + elongate coordinate for fjord/asymmetric islands
      const lx = (wx * elongCos + wz * elongSin) / P.elongX;
      const lz = (-wx * elongSin + wz * elongCos);
      const dCentre = Math.hypot(lx, lz);

      // Large-scale shape warp using n5 — breaks the perfect circle
      const warpAmt = (n5(wx * 0.006, wz * 0.006) * 0.5 + 0.5) * islandR * 0.18;
      const warpedDist = dCentre - warpAmt;

      const islandMask = 1 - smoothstep(islandR * 0.5, islandR, warpedDist);
      const landGate   = 1 - smoothstep(islandR, oceanFloorR, warpedDist);

      // Coastline noise (n1 + n2 two octaves)
      const coast = (n1(wx * 0.012, wz * 0.012) * 0.35
                   + n2(wx * 0.04,  wz * 0.04)  * 0.15) * landGate;
      let land = islandMask + coast - 0.18;

      // Atoll: hollow out centre — punch a lagoon into the land mask
      if (P.atoll) {
        const lagoonR   = islandR * 0.45;
        const lagoonRim = islandR * 0.60;
        const lagoon    = 1 - smoothstep(lagoonR, lagoonRim, warpedDist);
        land -= lagoon * 1.2;
      }

      // All bay carves
      let bayCarve = 0;
      for (const bd of bayDirs) {
        const dot     = wx * bd.x + wz * bd.z;
        const along   = Math.max(0, dot - t.size * 0.04);
        const perp    = Math.abs(wx * -bd.z + wz * bd.x);
        const bayMask = (1 - smoothstep(t.size * 0.10, t.size * 0.22, perp))
                      * smoothstep(0, t.size * 0.18, along);
        bayCarve     += bayMask * P.bayDepth;
      }

      // Hill / terrain detail — n2 (large) + n3 (fine) + optional ridge n4
      // hillHigh capped at 0.06 (was 0.18) — prevents jagged/low-poly peak look
      const hillLow  = (n2(wx * 0.025, wz * 0.025) * 0.50
                      + n2(wx * 0.07,  wz * 0.07)  * 0.22) * P.hillAmp;
      const hillHigh = n3(wx * 0.12,  wz * 0.12)  * 0.06 * P.hillAmp;

      // Ridgeline: soft spine (ridgeAmp already reduced in PROFILES)
      const ridge    = Math.abs(n4(wx * 0.018, wz * 0.018)) * P.ridgeAmp * 0.5;

      const hill = (hillLow + hillHigh + ridge) * landGate;

      // Combine
      let h = (land - bayCarve) * peakH + hill;
      const oceanBlend = 1 - landGate;
      h = h * landGate + OCEAN_FLOOR * oceanBlend;

      // Apply all plateaus
      for (const pl of plateaus) {
        const dPlat = Math.hypot(wx - pl.x, wz - pl.z);
        if (dPlat < pl.r) {
          const blend = 1 - smoothstep(pl.r * 0.7, pl.r, dPlat);
          h = h * (1 - blend) + pl.h * blend;
        }
      }

      // Expanded rim: gentle coastal hills on the outer 25% ring
      const rimInner = islandR * 0.72;
      const rimOuter = islandR * 1.05;
      if (warpedDist > rimInner && warpedDist < rimOuter && h > 0.2) {
        const rimT = 1 - smoothstep(rimInner, rimOuter, warpedDist);
        h += rimT * peakH * 0.12;
      }

      // Beach smoothing near coast
      if (h > -0.35 && h < 0.45) h *= 0.5;

      // Hard clamp: max 20 ft above sea, 40 ft ocean floor
      h = Math.max(OCEAN_FLOOR, Math.min(MAX_TERRAIN, h));
      t.heights[i] = h;

      // Biome assignment
      let biome: 0 | 1 | 2 | 3 = 0;
      if      (h < 0.28)                        biome = 1;  // sand
      else if (h > peakH * P.snowFrac)           biome = 3;  // snow
      else if (h > peakH * 0.72)                 biome = 2;  // rock
      else                                        biome = 0;  // grass
      t.biome[i] = biome;
    }
  }

  // ─ Post-generation smoothing pass ──────────────────────────────────────────
  // Average each land vertex with its 4 cardinal neighbors once.
  // This rounds off the angular facets that make terrain look low-poly,
  // and ensures walkable slopes (< ~38° after smoothing).
  // Only applied to above-water heights to keep the ocean floor intact.
  const R   = t.resolution;
  const tmp = Float32Array.from(t.heights);
  for (let zi = 1; zi < R - 1; zi++) {
    for (let xi = 1; xi < R - 1; xi++) {
      const i = zi * R + xi;
      if (tmp[i] <= 0) continue; // leave ocean untouched
      const avg = (
        tmp[i] +
        tmp[(zi - 1) * R + xi] +
        tmp[(zi + 1) * R + xi] +
        tmp[zi * R + (xi - 1)] +
        tmp[zi * R + (xi + 1)]
      ) / 5;
      // 60% blend toward the average — removes facets, preserves character
      t.heights[i] = tmp[i] * 0.4 + avg * 0.6;
    }
  }

  // ── Mountain emboss at highest interior point ─────────────────────────────
  let peakIdx = 0;
  let peakVal = -Infinity;
  for (let i = 0; i < t.heights.length; i++) {
    if (t.heights[i]! > peakVal) { peakVal = t.heights[i]!; peakIdx = i; }
  }
  const peakXi = peakIdx % R;
  const peakZi = Math.floor(peakIdx / R);
  const peakWx = -half + peakXi * cell;
  const peakWz = -half + peakZi * cell;
  const mountainR = islandR * 0.16;
  for (let zi = 0; zi < R; zi++) {
    for (let xi = 0; xi < R; xi++) {
      const wx = -half + xi * cell;
      const wz = -half + zi * cell;
      const d = Math.hypot(wx - peakWx, wz - peakWz);
      if (d >= mountainR) continue;
      const bump = (1 - d / mountainR) ** 1.6 * MAX_TERRAIN * 0.28;
      const i = zi * R + xi;
      if (t.heights[i]! > 0) {
        t.heights[i] = Math.min(MAX_TERRAIN, t.heights[i]! + bump);
      }
    }
  }
  // Re-sample peak after emboss
  peakIdx = 0;
  peakVal = -Infinity;
  for (let i = 0; i < t.heights.length; i++) {
    if (t.heights[i]! > peakVal) { peakVal = t.heights[i]!; peakIdx = i; }
  }
  const finalPeakXi = peakIdx % R;
  const finalPeakZi = Math.floor(peakIdx / R);
  const finalPeakWx = -half + finalPeakXi * cell;
  const finalPeakWz = -half + finalPeakZi * cell;
  const peakY = peakVal;

  return {
    bayDir,
    plateau: { x: plateau.x, z: plateau.z, r: plateau.r },
    dock,
    peak: { x: finalPeakWx, z: finalPeakWz, y: peakY },
  };
}

interface ScatterParams {
  count: number;
  /** Reject if height is outside [hMin, hMax] */
  hMin: number;
  hMax: number;
  /** Reject biomes other than these */
  biomes: number[];
  /** Reject if within radius of plateau (so we don't choke the build pad) */
  avoidPlateau?: boolean;
}

function scatter(
  t: TerrainData,
  shape: IslandShape,
  rng: () => number,
  params: ScatterParams,
  attemptsPerSlot = 18,
): { x: number; z: number; y: number }[] {
  const out: { x: number; z: number; y: number }[] = [];
  const half = t.size / 2;
  let placed = 0, tries = 0;
  while (placed < params.count && tries < params.count * attemptsPerSlot) {
    tries++;
    const x = (rng() - 0.5) * t.size * 0.92;
    const z = (rng() - 0.5) * t.size * 0.92;
    if (params.avoidPlateau) {
      const d = Math.hypot(x - shape.plateau.x, z - shape.plateau.z);
      if (d < shape.plateau.r * 1.05) continue;
    }
    // Sample height
    const cell = t.size / (t.resolution - 1);
    const xi = Math.round((x + half) / cell);
    const zi = Math.round((z + half) / cell);
    if (xi < 0 || zi < 0 || xi >= t.resolution || zi >= t.resolution) continue;
    const i = zi * t.resolution + xi;
    const h = t.heights[i]!;
    if (h < params.hMin || h > params.hMax) continue;
    if (!params.biomes.includes(t.biome[i] ?? 0)) continue;
    out.push({ x, z, y: h });
    placed++;
  }
  return out;
}

function entity(
  rng: () => number,
  kind: PlacedEntity['kind'],
  name: string,
  pos: Vec3,
  data: Record<string, unknown> = {},
  scale: Vec3 = [1, 1, 1],
  yRot = rng() * Math.PI * 2,
): PlacedEntity {
  return {
    id: uid(rng),
    kind,
    name,
    position: pos,
    rotation: [0, yRot, 0],
    scale,
    data,
  };
}

export interface IslandGenOptions {
  seed?: number;
  /** Density multipliers — defaults give a "lush but readable" island */
  treeDensity?: number;
  rockDensity?: number;
  bushDensity?: number;
  flowerDensity?: number;
  animalDensity?: number;
  /**
   * Terrain morphology.  When omitted a random profile is chosen based on
   * the seed, so every seed reliably produces a unique island shape.
   */
  profile?: IslandProfile;
  /**
   * Weather / biome preset.  Determines which animal species are placed and
   * influences the island vegetation style.
   *   forest  — deer, wolf, rabbit, hawk (default)
   *   beach   — shark & crocodile (swimming), crab, hummingbird
   *   volcano — harpy (flying), buffalo
   *   winter  — ibex, wolf (sparse vegetation)
   */
  weather?: 'forest' | 'beach' | 'volcano' | 'winter';
}

export interface IslandGenResult {
  entities: PlacedEntity[];
  shape: IslandShape;
  seed: number;
}

/** Mutate `project.terrain` in place and return new entity list + shape metadata. */
export function generateIsland(
  project: MapProject,
  opts: IslandGenOptions = {},
): IslandGenResult {
  const seed    = opts.seed ?? Math.floor(Math.random() * 1e9);
  const weather = opts.weather ?? 'forest';
  // Pick profile: explicit option wins, otherwise derive from seed so the
  // same number always gives the same island shape across regenerations.
  const seedRng = alea(seed + 999);
  const profile: IslandProfile =
    opts.profile ?? ALL_PROFILES[Math.floor(seedRng() * ALL_PROFILES.length)]!;
  const rng     = alea(seed);
  const shape   = buildIslandHeights(project.terrain, seed, profile);

  const treeDensity   = opts.treeDensity   ?? 1;
  const rockDensity   = opts.rockDensity   ?? 1;
  const bushDensity   = opts.bushDensity   ?? 1;
  const flowerDensity = opts.flowerDensity ?? 1;
  const animalDensity = opts.animalDensity ?? 1;

  const t    = project.terrain;
  const ents: PlacedEntity[] = [];

  // ── Trees: grass biome, mid elevations, away from plateau ─────────────
  const beachBiome   = weather === 'beach';
  const volcanoBiome = weather === 'volcano';
  const winterBiome  = weather === 'winter';

  // Reduce trees for beach/volcano biomes, drastically for volcano
  const treeFactor = volcanoBiome ? 0.2 : beachBiome ? 0.5 : winterBiome ? 0.4 : 1;
  const treeSpecies = beachBiome
    ? ['palm', 'palm', 'palm', 'birch']
    : winterBiome ? ['pine', 'pine', 'birch']
    : ['oak', 'pine', 'birch', 'palm', 'palm'];

  for (const p of scatter(t, shape, rng, {
    count: Math.round(160 * treeDensity * treeFactor),
    hMin: 0.4, hMax: MAX_TERRAIN * 0.85,
    biomes: [0],
    avoidPlateau: true,
  })) {
    const sp = treeSpecies[Math.floor(rng() * treeSpecies.length)]!;
    // ~55% Kenney/R2 GLB trees at realistic 3–7 m scale; rest stylized CardTree
    if (rng() < 0.55) {
      const glb = pick(TREE_GLBS, rng);
      const s = 2.2 + rng() * 2.8;
      const te = entity(rng, 'tree', sp, [p.x, p.y, p.z],
        { species: sp, paletteId: 'island-tree-glb' },
        [s, s, s]);
      te.asset = glb;
      ents.push(te);
    } else if (sp === 'palm') {
      const ps = 2.4 + rng() * 1.6;
      ents.push(entity(rng, 'tree', 'palm', [p.x, p.y, p.z],
        { species: 'palm', foliageStyle: 'textured', leaf: 'palm' }, [ps, ps, ps]));
    } else {
      const s = 2.0 + rng() * 1.8;
      ents.push(entity(rng, 'tree', sp, [p.x, p.y, p.z],
        { species: sp, foliageStyle: 'textured', leaf: sp }, [s, s, s]));
    }
  }

  // ── Rocks: mix Kenney GLB + PBR procedural textured rocks ───────────────
  const rockFactor = volcanoBiome ? 2.0 : winterBiome ? 1.4 : 1;
  for (const p of scatter(t, shape, rng, {
    count: Math.round(55 * rockDensity * rockFactor),
    hMin: 0.2, hMax: MAX_TERRAIN,
    biomes: [0, 1, 2],
  })) {
    const s = 1.2 + rng() * 2.2;
    if (rng() < 0.5) {
      const glb = pick(ROCK_GLBS, rng);
      const re = entity(rng, 'rock', 'rock', [p.x, p.y, p.z],
        { paletteId: 'island-rock-glb' }, [s, s, s]);
      re.asset = glb;
      ents.push(re);
    } else {
      ents.push(entity(rng, 'rock', 'rock', [p.x, p.y, p.z],
        { foliageStyle: 'textured', variant: Math.floor(rng() * 4) }, [s * 0.85, s * 0.85, s * 0.85]));
    }
  }

  // ── Bushes ──────────────────────────────────────────────────────────
  if (!volcanoBiome) {
    for (const p of scatter(t, shape, rng, {
      count: Math.round(80 * bushDensity * (winterBiome ? 0.3 : 1)),
      hMin: 0.3, hMax: MAX_TERRAIN * 0.7,
      biomes: [0],
      avoidPlateau: true,
    })) {
      const s = 0.6 + rng() * 0.5;
      ents.push(entity(rng, 'bush', 'bush', [p.x, p.y, p.z], {}, [s, s, s]));
    }
  }

  // ── Flowers (skip for volcano/winter) ────────────────────────────
  if (!volcanoBiome && !winterBiome) {
    const flowerColors = ['#ff5d8f', '#ffd24d', '#a86bff', '#fff7e0', '#ff8a3d'];
    const patchCenters = scatter(t, shape, rng, {
      count: Math.round(20 * flowerDensity),
      hMin: 0.4, hMax: MAX_TERRAIN * 0.6,
      biomes: [0],
      avoidPlateau: true,
    });
    for (const c of patchCenters) {
      const color = flowerColors[Math.floor(rng() * flowerColors.length)]!;
      const n = 6 + Math.floor(rng() * 8);
      for (let k = 0; k < n; k++) {
        const r = rng() * 2.5;
        const a = rng() * Math.PI * 2;
        ents.push(entity(rng, 'flower', 'flower', [c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r], { color }, [1, 0.7 + rng() * 0.5, 1]));
      }
    }
  }

  // ── Harvest nodes (registered, controllable resource spawns) ─────────────
  const harvestTypes = [
    { resource: 'crystal', type: 'crystal', glb: HARVEST_GLBS.crystal, amount: 500, scale: 1.4 },
    { resource: 'ore', type: 'ore', glb: HARVEST_GLBS.ore, amount: 350, scale: 1.6 },
    { resource: 'wood', type: 'wood', glb: HARVEST_GLBS.wood, amount: 200, scale: 1.2 },
    { resource: 'hemp', type: 'hemp', glb: HARVEST_GLBS.hemp, amount: 120, scale: 1.0 },
    { resource: 'scrap', type: 'scrap', glb: HARVEST_GLBS.scrap, amount: 80, scale: 1.1 },
  ] as const;
  for (let hi = 0; hi < harvestTypes.length; hi++) {
    const ht = harvestTypes[hi]!;
    const spots = scatter(t, shape, rng, {
      count: 2, hMin: 0.45, hMax: MAX_TERRAIN * 0.75, biomes: [0, 2], avoidPlateau: true,
    });
    for (const p of spots) {
      const harvestId = `harvest_${ht.type}_${hi}_${uid(rng)}`;
      const node = entity(rng, 'resource_node', `${ht.type} node`, [p.x, p.y, p.z], {
        resource: ht.resource,
        resourceType: ht.type,
        harvestId,
        harvestable: true,
        respawnSec: 120 + Math.floor(rng() * 180),
        amount: ht.amount,
      }, [ht.scale, ht.scale, ht.scale]);
      node.asset = ht.glb;
      ents.push(node);
    }
  }

  // ── Animals (biome-specific) ───────────────────────────────────
  //
  // IMPORTANT: land animals are placed at terrain height (p.y) so they
  // sit ON the ground.  Water animals orbit AROUND the island at sea level
  // — their Y is locked to SEA_LEVEL + 0.2 so they swim on the surface
  // and never clip through the terrain mesh.

  // Helper: create a water-swimming creature entity
  const waterAnimal = (
    name: string,
    species: string,
    orbitRadius: number,
    speed = 2.5,
  ): PlacedEntity => {
    const angle = rng() * Math.PI * 2;
    const x = Math.cos(angle) * orbitRadius;
    const z = Math.sin(angle) * orbitRadius;
    const swimY = SEA_LEVEL + 0.2; // on the water surface, never underground
    return entity(rng, 'creature', name,
      [x, swimY, z],
      {
        species,
        asset: CREATURE_ASSET[species],
        behavior: 'swim',
        speed,
        // Orbit parameters (used by the swim AI tick)
        radius:  orbitRadius,
        centerX: 0, centerZ: 0,
        altitude: swimY,
      },
      [1, 1, 1],
    );
  };

  // Helper: create a land creature with GLB model, placed above terrain
  const landAnimal = (
    p: { x: number; y: number; z: number },
    name: string,
    species: string,
    data: Record<string, unknown>,
    scale: Vec3 = [1, 1, 1],
  ): PlacedEntity => {
    return entity(rng, 'creature', name,
      [p.x, p.y, p.z],
      { ...data, species, asset: CREATURE_ASSET[species] },
      scale,
    );
  };

  const animalCount = Math.round(animalDensity);

  // ── Fish — shallow reef + deep-water schools ─────────────────────────────
  const fishCount = 6 + Math.floor(rng() * 5);
  for (let k = 0; k < fishCount; k++) {
    const f = FISH_POOL[k % FISH_POOL.length]!;
    const shallow = k < fishCount * 0.6;
    const r = shallow
      ? t.size * (0.22 + rng() * 0.18)
      : t.size * (0.38 + rng() * 0.22);
    const swimY = shallow ? 0.12 + rng() * 0.2 : -2.5 - rng() * 3.5;
    const spd = 1.5 + rng() * 2.0;
    const ang = rng() * Math.PI * 2;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    ents.push(entity(rng, 'creature', f.species,
      [x, swimY, z],
      { species: f.species, asset: f.glb, behavior: 'swim',
        speed: spd, radius: r, centerX: 0, centerZ: 0, altitude: swimY,
        deepWater: !shallow },
      [f.scale, f.scale, f.scale]));
  }

  if (weather === 'forest') {
    // Deer — prey: flee from wolves + camera
    for (const p of scatter(t, shape, rng, { count: 5 * animalCount, hMin: 0.5, hMax: MAX_TERRAIN * 0.6, biomes: [0], avoidPlateau: true })) {
      ents.push(landAnimal(p, 'deer', 'deer',
        { behavior: 'wander', speed: 1.6, visionRadius: 14, fleeSpeed: 5.8, homeX: p.x, homeZ: p.z, homeRadius: 20 }));
    }
    // Wolf — predator: pursues deer
    for (const p of scatter(t, shape, rng, { count: 2 * animalCount, hMin: 0.5, hMax: MAX_TERRAIN * 0.7, biomes: [0], avoidPlateau: true })) {
      ents.push(landAnimal(p, 'wolf', 'wolf',
        { behavior: 'wander', speed: 2.6, visionRadius: 22, fleeSpeed: 7, homeX: p.x, homeZ: p.z, homeRadius: 35 }));
    }
    // Hawk — large orbit, wind-riding enabled
    for (let k = 0; k < 3 * animalCount; k++) {
      const cx = (rng() - 0.5) * t.size * 0.5, cz = (rng() - 0.5) * t.size * 0.5;
      const alt  = MAX_TERRAIN + 6 + rng() * 8;
      const baseR = 25 + rng() * 35; // 25–60 m orbit
      ents.push(entity(rng, 'creature', 'hawk', [cx, alt, cz],
        { species: 'hawk', asset: CREATURE_ASSET.hawk, behavior: 'circle',
          speed: 5 + rng() * 4, radius: baseR, centerX: cx, centerZ: cz, altitude: alt }));
    }

  } else if (weather === 'beach') {
    // Sharks — deep-water predators in the outer trench
    for (let k = 0; k < 3 * animalCount; k++) {
      const orbitR = t.size * (0.42 + rng() * 0.28);
      const angle = rng() * Math.PI * 2;
      const x = Math.cos(angle) * orbitR;
      const z = Math.sin(angle) * orbitR;
      const swimY = -3.5 - rng() * 4.5;
      ents.push(entity(rng, 'creature', 'shark',
        [x, swimY, z],
        {
          species: 'shark', asset: CREATURE_ASSET.shark, behavior: 'swim',
          speed: 3 + rng() * 2, radius: orbitR, centerX: 0, centerZ: 0,
          altitude: swimY, deepWater: true,
        }));
    }
    // Crocodile — predator, near shore
    for (let k = 0; k < 2 * animalCount; k++) ents.push(waterAnimal('crocodile', 'crocodile', t.size * 0.18 + rng() * 10, 1.5));
    // Crab — prey
    for (const p of scatter(t, shape, rng, { count: 6 * animalCount, hMin: -0.1, hMax: 0.6, biomes: [1] })) {
      ents.push(landAnimal(p, 'crab', 'crab',
        { behavior: 'wander', speed: 0.8, visionRadius: 5, fleeSpeed: 2.2, homeX: p.x, homeZ: p.z, homeRadius: 8 },
        [0.6, 0.6, 0.6]));
    }
    // Hummingbird — tight orbit with wind-riding
    for (let k = 0; k < 4 * animalCount; k++) {
      const cx  = (rng() - 0.5) * t.size * 0.4, cz = (rng() - 0.5) * t.size * 0.4;
      const alt  = MAX_TERRAIN * 0.4 + rng() * 2;
      const baseR = 8 + rng() * 12;
      ents.push(entity(rng, 'creature', 'hummingbird', [cx, alt, cz],
        { species: 'hummingbird', asset: CREATURE_ASSET.hummingbird, behavior: 'circle',
          speed: 3.5 + rng() * 2, radius: baseR, centerX: cx, centerZ: cz, altitude: alt }));
    }

  } else if (weather === 'volcano') {
    // Buffalo — prey from harpy
    for (const p of scatter(t, shape, rng, { count: 4 * animalCount, hMin: 0.3, hMax: MAX_TERRAIN * 0.8, biomes: [0, 2] })) {
      ents.push(landAnimal(p, 'buffalo', 'buffalo',
        { behavior: 'wander', speed: 2, visionRadius: 14, fleeSpeed: 4.5, homeX: p.x, homeZ: p.z, homeRadius: 28 },
        [1.2, 1.2, 1.2]));
    }
    // Harpy — predator, large chaotic orbits
    for (let k = 0; k < 3 * animalCount; k++) {
      const cx = (rng() - 0.5) * t.size * 0.4, cz = (rng() - 0.5) * t.size * 0.4;
      const alt  = MAX_TERRAIN + 4 + rng() * 10;
      const baseR = 28 + rng() * 30;
      ents.push(entity(rng, 'creature', 'harpy', [cx, alt, cz],
        { species: 'harpy', asset: CREATURE_ASSET.harpy, behavior: 'circle',
          speed: 7 + rng() * 5, radius: baseR, centerX: cx, centerZ: cz, altitude: alt }));
    }

  } else if (weather === 'winter') {
    // Ibex — prey, facing corrected via SPECIES_CFG
    for (const p of scatter(t, shape, rng, { count: 5 * animalCount, hMin: MAX_TERRAIN * 0.35, hMax: MAX_TERRAIN, biomes: [0, 2] })) {
      ents.push(landAnimal(p, 'ibex', 'ibex',
        { behavior: 'wander', speed: 1.8, visionRadius: 16, fleeSpeed: 5.5, homeX: p.x, homeZ: p.z, homeRadius: 22 }));
    }
    // Wolf — predator, hunts ibex
    for (const p of scatter(t, shape, rng, { count: 3 * animalCount, hMin: 0.3, hMax: MAX_TERRAIN * 0.7, biomes: [0] })) {
      ents.push(landAnimal(p, 'wolf', 'wolf',
        { behavior: 'wander', speed: 2.6, visionRadius: 22, fleeSpeed: 7, homeX: p.x, homeZ: p.z, homeRadius: 35 }));
    }
  }

  // ── Instanced forest zones (dense procedural groves) ─────────────────────
  const forestZoneCount = 2 + Math.floor(rng() * 3);
  for (let fz = 0; fz < forestZoneCount; fz++) {
    const centres = scatter(t, shape, rng, {
      count: 1, hMin: 0.5, hMax: MAX_TERRAIN * 0.65, biomes: [0], avoidPlateau: true,
    });
    const c = centres[0];
    if (!c) continue;
    ents.push(entity(rng, 'prop', `forest zone ${fz + 1}`, [c.x, c.y, c.z], {
      forestZone: true,
      cx: c.x, cz: c.z,
      radius: 14 + rng() * 12,
      count: 35 + Math.floor(rng() * 45),
      seed: Math.floor(rng() * 1e9),
    }, [1, 1, 1], 0));
  }

  // ── Nav waypoints for creature pathfinding ───────────────────────────────
  const navPts = scatter(t, shape, rng, {
    count: 14, hMin: 0.35, hMax: MAX_TERRAIN * 0.9, biomes: [0, 2], avoidPlateau: false,
  });
  const navIds: string[] = [];
  for (const p of navPts) {
    const id = uid(rng);
    navIds.push(id);
    const wp = entity(rng, 'nav_waypoint', 'nav', [p.x, p.y, p.z],
      { navWaypoint: true, links: [] as string[] }, [1, 1, 1], 0);
    wp.id = id;
    ents.push(wp);
  }
  const linkRadius = t.size * 0.14;
  for (let i = 0; i < navPts.length; i++) {
    const wp = ents.find((e) => e.id === navIds[i]);
    if (!wp) continue;
    const links: string[] = [];
    for (let j = 0; j < navPts.length; j++) {
      if (i === j) continue;
      const d = Math.hypot(navPts[i]!.x - navPts[j]!.x, navPts[i]!.z - navPts[j]!.z);
      if (d < linkRadius) links.push(navIds[j]!);
    }
    if (links.length < 2) {
      const sorted = navPts
        .map((p, j) => ({ j, d: Math.hypot(navPts[i]!.x - p.x, navPts[i]!.z - p.z) }))
        .filter((x) => x.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      for (const s of sorted) if (!links.includes(navIds[s.j]!)) links.push(navIds[s.j]!);
    }
    wp.data.links = links.slice(0, 4);
  }

  // ── Mountain dungeon / event entrance at peak ────────────────────────────
  const peak = shape.peak;
  ents.push(entity(rng, 'dungeon_entrance', 'dungeon entrance',
    [peak.x, peak.y + 0.2, peak.z],
    {
      eventType: 'dungeon',
      dungeonId: `island_dungeon_${seed}`,
      interactable: true,
      mountainPeak: true,
    },
    [2.5, 2.5, 2.5], Math.atan2(shape.bayDir.x, shape.bayDir.z)));
  ents.push(entity(rng, 'spell_marker', 'event marker',
    [peak.x, peak.y + 3.2, peak.z],
    { eventType: 'boss', linkedDungeon: `island_dungeon_${seed}` },
    [1.2, 1.2, 1.2], 0));

  // ── Dock + Spawn (always present) ────────────────────────────────────────
  ents.push(entity(rng, 'dock', 'dock anchor',
    [shape.dock.x, 0.05, shape.dock.z],
    { facing: Math.atan2(-shape.bayDir.z, -shape.bayDir.x) },
    [3, 0.2, 5],
  ));
  ents.push(entity(rng, 'spawn_point', 'player spawn',
    [shape.plateau.x, MAX_TERRAIN * 0.32 + 0.1, shape.plateau.z],
    { faction: 'player' },
    [1, 1, 1], 0,
  ));

  return { entities: ents, shape, seed };
}
