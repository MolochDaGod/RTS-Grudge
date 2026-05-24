/**
 * ZoneHeightmapSystem — Generates heightmap terrain for each 4km×4km zone.
 *
 * ## Elevation Band System
 * Heights are in meters. Water surface is at y=0.
 *
 *   -20m to  0m  OCEAN       — seabed, deepest at zone edges
 *     0m to 1.5m BEACH       — sandy shoreline, ~8% of island
 *   1.5m to  4m  FLAT_LAND   — town areas, meadows, ~18% of island
 *     4m to 10m  FOREST      — rolling hills with trees, ~30% of island
 *    10m to 18m  MINES       — cave-entrance elevation, rocky, ~20% of island
 *    18m to 35m  MOUNTAIN    — steep rocky terrain, ~15% of island
 *    35m+        PEAK        — mountain-top plateau, ~9% of island
 *
 * ## Required Features (every island)
 *   - Bay:           carved inlet on one side with calm shallow water
 *   - Flat town:     200m×200m minimum at FLAT_LAND elevation
 *   - Forest zone:   large FOREST band around the interior
 *   - Mine entrance: 2-3 spots at MINES elevation
 *   - Mountain:      main ridge/peak in the interior
 *   - Mountain top:  steep cone (~100m radius) with flat 30m plateau at summit
 *   - 3 Event zones: specific cleared areas at FOREST/MINES/MOUNTAIN elevations
 *   - Beach ring:    60-80% of perimeter is sandy beach
 *
 * ## Ocean
 *   Ocean floor slopes from 0m at shore to -20m at zone boundary.
 *   The 500m gap between zones is deep ocean (-20m).
 *
 * Supports PNG heightmap import for artist-made terrain.
 */

import type { ZoneDefinition } from "./WorldGridRegistry";

// ── Zone-specific terrain configs ────────────────────────────────────────────

/** Resolution of the heightfield grid. 1024 = ~3.9m per cell at 4000m island. */
const ZONE_RESOLUTION = 1024;

interface ZoneTerrainConfig {
  maxHeight: number;
  noiseScale: number;
  octaves: number;
  islandRadius: number;  // 0-1, how much of the square is island vs ocean falloff
  flattenCenter: number; // radius of flattened town area
  /** Extra terrain passes (volcanic crater, mesa cuts, etc.) */
  postProcess?: (data: Float32Array, res: number, size: number, seed: number) => void;
}

const ZONE_TERRAIN_CONFIGS: Record<string, ZoneTerrainConfig> = {
  snow: {
    maxHeight: 28,
    noiseScale: 0.012,
    octaves: 7,
    islandRadius: 0.42,
    flattenCenter: 30,
    postProcess: (data, res, size, seed) => {
      // Glacial ridges: add sharp ridgeline features
      applyRidgeNoise(data, res, size, seed, 0.008, 8, 0.4);
    },
  },
  mountains: {
    maxHeight: 35,
    noiseScale: 0.010,
    octaves: 8,
    islandRadius: 0.38,
    flattenCenter: 25,
    postProcess: (data, res, size, seed) => {
      // Jagged peaks with steep cliff faces
      applyRidgeNoise(data, res, size, seed, 0.006, 12, 0.5);
      // Carve a central valley for the mining town
      carveValley(data, res, size, 0, 30, 40, 0.3);
    },
  },
  lava: {
    maxHeight: 30,
    noiseScale: 0.014,
    octaves: 7,
    islandRadius: 0.40,
    flattenCenter: 20,
    postProcess: (data, res, size, seed) => {
      // Volcanic caldera: raise rim, depress center
      applyCaldera(data, res, size, 0, -30, 60, 20);
      // Lava river channels
      carveLavaRivers(data, res, size, seed, 3);
    },
  },
  forest: {
    maxHeight: 16,
    noiseScale: 0.018,
    octaves: 6,
    islandRadius: 0.45,
    flattenCenter: 25,
  },
  plains: {
    maxHeight: 10,
    noiseScale: 0.020,
    octaves: 5,
    islandRadius: 0.48,
    flattenCenter: 40, // large flat area for hub town
  },
  desert: {
    maxHeight: 14,
    noiseScale: 0.016,
    octaves: 5,
    islandRadius: 0.44,
    flattenCenter: 25,
    postProcess: (data, res, size, seed) => {
      // Dune wave overlay
      applyDuneWaves(data, res, size, seed, 0.3);
      // Mesa plateaus
      applyMesas(data, res, size, seed, 4);
    },
  },
  swamp: {
    maxHeight: 6,
    noiseScale: 0.025,
    octaves: 4,
    islandRadius: 0.46,
    flattenCenter: 20,
    postProcess: (data, res, size) => {
      // Clamp most terrain to near-water level, leaving scattered high ground
      for (let i = 0; i < data.length; i++) {
        if (data[i] > 0 && data[i] < 3) data[i] *= 0.4; // flatten low areas to wetland
      }
    },
  },
  jungle: {
    maxHeight: 22,
    noiseScale: 0.014,
    octaves: 7,
    islandRadius: 0.43,
    flattenCenter: 25,
    postProcess: (data, res, size, seed) => {
      // Steep ridgelines with waterfall cliffs
      applyRidgeNoise(data, res, size, seed + 500, 0.010, 6, 0.3);
    },
  },
};

// ── SimplexNoise (shared with IslandGenerator) ───────────────────────────────

class SimplexNoise2D {
  private p: Uint8Array;
  private perm: Uint8Array;
  private permMod12: Uint8Array;

  constructor(seed: number) {
    this.p = new Uint8Array(256);
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 256; i++) this.p[i] = i;
    let n: number, swap: number;
    for (let i = 255; i > 0; i--) {
      seed = (seed * 16807) % 2147483647;
      n = Math.floor((seed / 2147483647) * (i + 1));
      swap = this.p[i]; this.p[i] = this.p[n]; this.p[n] = swap;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  private static grad3 = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
  ];
  private static F2 = 0.5 * (Math.sqrt(3) - 1);
  private static G2 = (3 - Math.sqrt(3)) / 6;

  noise2D(x: number, y: number): number {
    const { F2, G2, grad3 } = SimplexNoise2D;
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { t0 *= t0; const gi = this.permMod12[ii + this.perm[jj]]; n0 = t0 * t0 * (grad3[gi][0] * x0 + grad3[gi][1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { t1 *= t1; const gi = this.permMod12[ii + i1 + this.perm[jj + j1]]; n1 = t1 * t1 * (grad3[gi][0] * x1 + grad3[gi][1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { t2 *= t2; const gi = this.permMod12[ii + 1 + this.perm[jj + 1]]; n2 = t2 * t2 * (grad3[gi][0] * x2 + grad3[gi][1] * y2); }
    return 70 * (n0 + n1 + n2);
  }
}

function fbm(noise: SimplexNoise2D, x: number, y: number, octaves: number): number {
  let value = 0, amplitude = 1, frequency = 1, totalAmp = 0;
  for (let o = 0; o < octaves; o++) {
    value += amplitude * noise.noise2D(x * frequency, y * frequency);
    totalAmp += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / totalAmp;
}

// ── Post-processing functions ────────────────────────────────────────────────

/** Add sharp ridgeline features (for mountains, snow, jungle). */
function applyRidgeNoise(
  data: Float32Array, res: number, size: number,
  seed: number, scale: number, maxAdd: number, blend: number,
) {
  const noise = new SimplexNoise2D(seed + 2000);
  const half = size / 2;
  for (let iz = 0; iz <= res; iz++) {
    for (let ix = 0; ix <= res; ix++) {
      const wx = (ix / res) * size - half;
      const wz = (iz / res) * size - half;
      const n = noise.noise2D(wx * scale, wz * scale);
      // Ridge: abs(noise) creates sharp valleys
      const ridge = (1 - Math.abs(n)) * maxAdd * blend;
      data[iz * (res + 1) + ix] += ridge;
    }
  }
}

/** Carve a valley for a town area. */
function carveValley(
  data: Float32Array, res: number, size: number,
  cx: number, cz: number, radius: number, depth: number,
) {
  const half = size / 2;
  for (let iz = 0; iz <= res; iz++) {
    for (let ix = 0; ix <= res; ix++) {
      const wx = (ix / res) * size - half;
      const wz = (iz / res) * size - half;
      const dist = Math.sqrt((wx - cx) ** 2 + (wz - cz) ** 2);
      if (dist < radius) {
        const factor = 1 - (dist / radius);
        data[iz * (res + 1) + ix] *= (1 - factor * depth);
      }
    }
  }
}

/** Volcanic caldera: raise rim, depress center. */
function applyCaldera(
  data: Float32Array, res: number, size: number,
  cx: number, cz: number, outerRadius: number, innerDepth: number,
) {
  const half = size / 2;
  for (let iz = 0; iz <= res; iz++) {
    for (let ix = 0; ix <= res; ix++) {
      const wx = (ix / res) * size - half;
      const wz = (iz / res) * size - half;
      const dist = Math.sqrt((wx - cx) ** 2 + (wz - cz) ** 2);
      if (dist < outerRadius) {
        const t = dist / outerRadius;
        if (t < 0.5) {
          // Inner crater: depress
          const craterDepth = (0.5 - t) * 2 * innerDepth;
          data[iz * (res + 1) + ix] = Math.max(0, data[iz * (res + 1) + ix] - craterDepth);
        } else {
          // Rim: raise
          const rimHeight = (t - 0.5) * 2 * (innerDepth * 0.6);
          data[iz * (res + 1) + ix] += rimHeight * (1 - (t - 0.5) * 2);
        }
      }
    }
  }
}

/** Carve lava river channels. */
function carveLavaRivers(
  data: Float32Array, res: number, size: number, seed: number, count: number,
) {
  const noise = new SimplexNoise2D(seed + 3000);
  const half = size / 2;
  for (let r = 0; r < count; r++) {
    const angle = (r / count) * Math.PI * 2;
    for (let t = 0; t < 1; t += 0.002) {
      const dist = t * half * 0.8;
      const wobble = noise.noise2D(t * 10 + r * 100, r) * 20;
      const wx = Math.cos(angle + wobble * 0.01) * dist;
      const wz = Math.sin(angle + wobble * 0.01) * dist;
      const ix = Math.round(((wx + half) / size) * res);
      const iz = Math.round(((wz + half) / size) * res);
      // Carve a 3-cell-wide channel
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const ci = Math.max(0, Math.min(res, ix + dx));
          const cj = Math.max(0, Math.min(res, iz + dz));
          data[cj * (res + 1) + ci] *= 0.3;
        }
      }
    }
  }
}

/** Desert dune wave overlay. */
function applyDuneWaves(
  data: Float32Array, res: number, size: number, seed: number, strength: number,
) {
  const half = size / 2;
  for (let iz = 0; iz <= res; iz++) {
    for (let ix = 0; ix <= res; ix++) {
      const wx = (ix / res) * size - half;
      const wz = (iz / res) * size - half;
      const dune = Math.sin(wx * 0.04 + wz * 0.02) * 0.5 + 0.5;
      data[iz * (res + 1) + ix] += dune * strength * data[iz * (res + 1) + ix];
    }
  }
}

/** Desert mesa plateaus. */
function applyMesas(
  data: Float32Array, res: number, size: number, seed: number, count: number,
) {
  let s = seed + 4000;
  const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const half = size / 2;
  for (let m = 0; m < count; m++) {
    const mx = (rng() - 0.5) * size * 0.6;
    const mz = (rng() - 0.5) * size * 0.6;
    const mRadius = 15 + rng() * 25;
    const mesaHeight = 8 + rng() * 10;
    for (let iz = 0; iz <= res; iz++) {
      for (let ix = 0; ix <= res; ix++) {
        const wx = (ix / res) * size - half;
        const wz = (iz / res) * size - half;
        const dist = Math.sqrt((wx - mx) ** 2 + (wz - mz) ** 2);
        if (dist < mRadius) {
          const t = dist / mRadius;
          const plateau = t < 0.7 ? mesaHeight : mesaHeight * (1 - (t - 0.7) / 0.3);
          data[iz * (res + 1) + ix] = Math.max(data[iz * (res + 1) + ix], plateau);
        }
      }
    }
  }
}

// ── Elevation band constants (meters) ─────────────────────────────────────

/** Ocean floor at deepest point (-20m below water surface at y=0). */
export const OCEAN_FLOOR = -20;
/** Water surface is at y=0. */
export const WATER_LEVEL = 0;

export const ELEVATION_BANDS = {
  /** -20m to 0m — seabed, slopes from shore to deep ocean */
  OCEAN:     { min: -20, max: 0 },
  /** 0m to 1.5m — sandy shoreline, ~8% of island area */
  BEACH:     { min: 0,   max: 1.5 },
  /** 1.5m to 4m — town areas, meadows, ~18% of island area */
  FLAT_LAND: { min: 1.5, max: 4 },
  /** 4m to 10m — rolling hills with trees, ~30% of island area */
  FOREST:    { min: 4,   max: 10 },
  /** 10m to 18m — cave-entrance elevation, rocky, ~20% of island area */
  MINES:     { min: 10,  max: 18 },
  /** 18m to 35m — steep rocky terrain, ~15% of island area */
  MOUNTAIN:  { min: 18,  max: 35 },
  /** 35m+ — mountain-top plateau, ~9% of island area */
  PEAK:      { min: 35,  max: 50 },
} as const;

/** Get the terrain band name for a given height in meters. */
export function getElevationBand(height: number): keyof typeof ELEVATION_BANDS {
  if (height < ELEVATION_BANDS.OCEAN.max) return "OCEAN";
  if (height < ELEVATION_BANDS.BEACH.max) return "BEACH";
  if (height < ELEVATION_BANDS.FLAT_LAND.max) return "FLAT_LAND";
  if (height < ELEVATION_BANDS.FOREST.max) return "FOREST";
  if (height < ELEVATION_BANDS.MINES.max) return "MINES";
  if (height < ELEVATION_BANDS.MOUNTAIN.max) return "MOUNTAIN";
  return "PEAK";
}

// ── Universal island features ───────────────────────────────────────────

/** Carve ocean floor: heights below 0 slope down to OCEAN_FLOOR at zone boundary. */
function applyOceanFloor(
  data: Float32Array, res: number, size: number,
) {
  const half = size / 2;
  const stride = res + 1;
  for (let iz = 0; iz <= res; iz++) {
    for (let ix = 0; ix <= res; ix++) {
      const idx = iz * stride + ix;
      if (data[idx] <= 0) {
        // Distance from center as 0-1
        const wx = (ix / res) * size - half;
        const wz = (iz / res) * size - half;
        const distNorm = Math.sqrt((wx / half) ** 2 + (wz / half) ** 2);
        // Slope from 0 at shore to OCEAN_FLOOR at zone edge
        const depthFactor = Math.min(1, distNorm / 1.0);
        data[idx] = OCEAN_FLOOR * depthFactor;
      }
    }
  }
}

/**
 * Carve a natural bay/harbor inlet on one side of the island.
 * Creates a crescent-shaped depression cutting into the coastline.
 */
function carveBay(
  data: Float32Array, res: number, size: number, seed: number,
) {
  let s = seed + 5000;
  const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const half = size / 2;
  const stride = res + 1;

  // Bay location: random side of island, ~60-70% out from center
  const bayAngle = rng() * Math.PI * 2;
  const bayDist = half * 0.55;
  const bayCx = Math.cos(bayAngle) * bayDist;
  const bayCz = Math.sin(bayAngle) * bayDist;
  const bayRadius = 150 + rng() * 200; // 150-350m wide bay
  const bayDepth = 6; // meters below current terrain

  for (let iz = 0; iz <= res; iz++) {
    for (let ix = 0; ix <= res; ix++) {
      const wx = (ix / res) * size - half;
      const wz = (iz / res) * size - half;
      const dist = Math.sqrt((wx - bayCx) ** 2 + (wz - bayCz) ** 2);
      if (dist < bayRadius) {
        const idx = iz * stride + ix;
        const t = dist / bayRadius;
        // Smooth crescent: deeper at center, shallows at edges
        const carve = (1 - t * t) * bayDepth;
        data[idx] = Math.max(OCEAN_FLOOR, data[idx] - carve);
      }
    }
  }
}

/**
 * Add a mountain-top feature: steep cone (~100m radius) with a flat
 * 30m×30m climbable plateau at the summit. Highest point on the island.
 */
function addMountainTop(
  data: Float32Array, res: number, size: number, seed: number,
  peakHeight: number,
) {
  let s = seed + 6000;
  const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const half = size / 2;
  const stride = res + 1;

  // Place the peak in the interior, offset from center (not on the town)
  const peakAngle = rng() * Math.PI * 2;
  const peakDist = 400 + rng() * 600; // 400-1000m from center
  const peakCx = Math.cos(peakAngle) * peakDist;
  const peakCz = Math.sin(peakAngle) * peakDist;
  const outerRadius = 120; // steep climb radius
  const plateauRadius = 15; // flat summit area (30m across)

  for (let iz = 0; iz <= res; iz++) {
    for (let ix = 0; ix <= res; ix++) {
      const wx = (ix / res) * size - half;
      const wz = (iz / res) * size - half;
      const dist = Math.sqrt((wx - peakCx) ** 2 + (wz - peakCz) ** 2);
      if (dist < outerRadius) {
        const idx = iz * stride + ix;
        const t = dist / outerRadius;
        let peakH: number;
        if (dist < plateauRadius) {
          // Flat plateau at summit
          peakH = peakHeight;
        } else {
          // Steep falloff from plateau to base (power curve for steepness)
          const falloffT = (dist - plateauRadius) / (outerRadius - plateauRadius);
          peakH = peakHeight * (1 - Math.pow(falloffT, 0.6));
        }
        // Only raise terrain, never lower it
        data[idx] = Math.max(data[idx], peakH);
      }
    }
  }
}

/**
 * Clear 3 event zones: flat circular areas at FOREST, MINES, and MOUNTAIN
 * elevations for world events, boss spawns, or gatherings.
 */
function clearEventZones(
  data: Float32Array, res: number, size: number, seed: number,
) {
  let s = seed + 7000;
  const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const half = size / 2;
  const stride = res + 1;

  const eventTargets = [
    { targetH: 7, label: "forest_event" },    // FOREST band
    { targetH: 14, label: "mines_event" },     // MINES band
    { targetH: 25, label: "mountain_event" },  // MOUNTAIN band
  ];

  for (const evt of eventTargets) {
    const angle = rng() * Math.PI * 2;
    const dist = 300 + rng() * 800; // 300-1100m from center
    const cx = Math.cos(angle) * dist;
    const cz = Math.sin(angle) * dist;
    const radius = 40 + rng() * 30; // 40-70m cleared area

    for (let iz = 0; iz <= res; iz++) {
      for (let ix = 0; ix <= res; ix++) {
        const wx = (ix / res) * size - half;
        const wz = (iz / res) * size - half;
        const d = Math.sqrt((wx - cx) ** 2 + (wz - cz) ** 2);
        if (d < radius) {
          const idx = iz * stride + ix;
          const t = d / radius;
          // Smooth blend to target height at center, original at edge
          data[idx] = data[idx] * t + evt.targetH * (1 - t);
        }
      }
    }
  }
}

// ── Main generation function ─────────────────────────────────────────────────

export interface ZoneTerrainData {
  heightData: Float32Array;
  resolution: number;
  worldSize: number;
  maxHeight: number;
  zoneId: string;
  seed: number;
}

/**
 * Generate the heightmap terrain for a world zone.
 * Returns null for GLB-based zones (like coast/tutorial island).
 */
export function generateZoneTerrain(zone: ZoneDefinition): ZoneTerrainData | null {
  if (zone.terrain.type === "glb") return null;

  const { biome, seed } = zone.terrain;
  const config = ZONE_TERRAIN_CONFIGS[zone.biome] ?? ZONE_TERRAIN_CONFIGS.plains;
  const res = ZONE_RESOLUTION;
  const size = zone.size;
  const halfSize = size / 2;

  const noise = new SimplexNoise2D(seed);
  const noise2 = new SimplexNoise2D(seed + 1000);
  const heightData = new Float32Array((res + 1) * (res + 1));

  // Base terrain from FBM noise
  for (let iz = 0; iz <= res; iz++) {
    for (let ix = 0; ix <= res; ix++) {
      const wx = (ix / res) * size - halfSize;
      const wz = (iz / res) * size - halfSize;

      const nx = wx * config.noiseScale;
      const nz = wz * config.noiseScale;
      let h = fbm(noise, nx, nz, config.octaves);
      h = (h + 1) / 2; // normalize to 0-1

      // Island falloff — creates natural coastline
      const dx = wx / halfSize;
      const dz = wz / halfSize;
      const distFromCenter = Math.sqrt(dx * dx + dz * dz);
      const islandFactor = Math.max(0, 1 - Math.pow(distFromCenter / config.islandRadius, 2.5));
      h *= islandFactor;

      // Flatten center for town
      const centerDist = Math.sqrt(wx * wx + wz * wz);
      if (centerDist < config.flattenCenter) {
        const flatFactor = centerDist / config.flattenCenter;
        h = h * flatFactor + 0.12 * (1 - flatFactor);
      }

      // Detail noise
      const detail = noise2.noise2D(wx * 0.06, wz * 0.06) * 0.04;
      h += detail * islandFactor;

      heightData[iz * (res + 1) + ix] = Math.max(0, h) * config.maxHeight;
    }
  }

  // Biome-specific post-processing
  if (config.postProcess) {
    config.postProcess(heightData, res, size, seed);
  }

  // ── Universal island features (applied to every zone) ─────────────────

  // 1. Mountain-top plateau: steep cone with flat summit (highest point)
  addMountainTop(heightData, res, size, seed, config.maxHeight + 10);

  // 2. Bay/harbor: carved inlet on one side of the island
  carveBay(heightData, res, size, seed);

  // 3. Event zones: 3 cleared flat areas at forest/mines/mountain elevations
  clearEventZones(heightData, res, size, seed);

  // 2-pass box smooth for natural appearance
  for (let pass = 0; pass < 2; pass++) {
    const copy = new Float32Array(heightData);
    for (let iz = 1; iz < res; iz++) {
      for (let ix = 1; ix < res; ix++) {
        const idx = iz * (res + 1) + ix;
        heightData[idx] = (
          copy[idx] * 4 +
          copy[idx - 1] + copy[idx + 1] +
          copy[idx - (res + 1)] + copy[idx + (res + 1)]
        ) / 8;
      }
    }
  }

  // 4. Ocean floor: slope from 0m at shore to -20m at zone boundary
  //    Applied AFTER smoothing so coastline stays sharp.
  applyOceanFloor(heightData, res, size);

  return {
    heightData,
    resolution: res,
    worldSize: size,
    maxHeight: config.maxHeight,
    zoneId: zone.id,
    seed,
  };
}

/**
 * Sample terrain height at a local position within a zone.
 * `localX`/`localZ` are relative to the zone center (zone.worldOffset).
 */
export function getZoneTerrainHeight(
  data: ZoneTerrainData,
  localX: number,
  localZ: number,
): number {
  const half = data.worldSize / 2;
  const gridX = ((localX + half) / data.worldSize) * data.resolution;
  const gridZ = ((localZ + half) / data.worldSize) * data.resolution;

  const x0 = Math.floor(Math.max(0, Math.min(data.resolution - 1, gridX)));
  const z0 = Math.floor(Math.max(0, Math.min(data.resolution - 1, gridZ)));
  const fx = gridX - x0;
  const fz = gridZ - z0;

  const stride = data.resolution + 1;
  const h00 = data.heightData[z0 * stride + x0];
  const h10 = data.heightData[z0 * stride + Math.min(x0 + 1, data.resolution)];
  const h01 = data.heightData[Math.min(z0 + 1, data.resolution) * stride + x0];
  const h11 = data.heightData[Math.min(z0 + 1, data.resolution) * stride + Math.min(x0 + 1, data.resolution)];

  return h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz) + h01 * (1 - fx) * fz + h11 * fx * fz;
}

/**
 * Sample terrain height at a world position, automatically determining the zone.
 * Returns 0 (ocean level) if the position is over water between islands.
 */
export function getWorldTerrainHeight(
  worldX: number,
  worldZ: number,
  zoneTerrainCache: Map<string, ZoneTerrainData>,
): number {
  // Import at call time to avoid circular dependency
  const { getZoneAtWorldPos } = require("./WorldGridRegistry");
  const zone = getZoneAtWorldPos(worldX, worldZ);
  if (!zone) return 0; // ocean

  const data = zoneTerrainCache.get(zone.id);
  if (!data) return 0; // zone not yet generated

  const localX = worldX - zone.worldOffset.x;
  const localZ = worldZ - zone.worldOffset.z;
  return getZoneTerrainHeight(data, localX, localZ);
}
