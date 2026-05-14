import type { IslandBiome } from "@/lib/stores/useIslandWorld";

export interface IslandTerrainData {
  heightData: Float32Array;
  resolution: number;
  worldSize: number;
  maxHeight: number;
  biome: IslandBiome;
  seed: number;
  dockPositions: { x: number; z: number; rotation: number }[];
  dungeonPortalPos: { x: number; z: number } | null;
  shopPos: { x: number; z: number } | null;
  villageCenter: { x: number; z: number };
}

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

const BIOME_CONFIGS: Record<IslandBiome, {
  maxHeight: number;
  noiseScale: number;
  octaves: number;
  islandRadius: number;
  flattenCenter: number;
  waterLevel: number;
}> = {
  temperate: { maxHeight: 12, noiseScale: 0.02, octaves: 6, islandRadius: 0.42, flattenCenter: 15, waterLevel: -0.3 },
  tropical: { maxHeight: 8, noiseScale: 0.025, octaves: 5, islandRadius: 0.45, flattenCenter: 12, waterLevel: -0.2 },
  volcanic: { maxHeight: 18, noiseScale: 0.018, octaves: 7, islandRadius: 0.38, flattenCenter: 10, waterLevel: -0.5 },
  arctic: { maxHeight: 10, noiseScale: 0.022, octaves: 6, islandRadius: 0.4, flattenCenter: 14, waterLevel: -0.4 },
  pirate: { maxHeight: 7, noiseScale: 0.03, octaves: 5, islandRadius: 0.48, flattenCenter: 12, waterLevel: -0.15 },
  cursed: { maxHeight: 14, noiseScale: 0.02, octaves: 7, islandRadius: 0.35, flattenCenter: 10, waterLevel: -0.6 },
};

export function generateIslandTerrain(
  seed: number,
  biome: IslandBiome,
  worldSize: number = 200,
  resolution: number = 128,
  hasDungeon: boolean = true,
  hasShop: boolean = true,
): IslandTerrainData {
  const config = BIOME_CONFIGS[biome];
  const noise = new SimplexNoise2D(seed);
  const noise2 = new SimplexNoise2D(seed + 1000);
  const heightData = new Float32Array((resolution + 1) * (resolution + 1));
  const halfSize = worldSize / 2;

  for (let iz = 0; iz <= resolution; iz++) {
    for (let ix = 0; ix <= resolution; ix++) {
      const wx = (ix / resolution) * worldSize - halfSize;
      const wz = (iz / resolution) * worldSize - halfSize;

      const nx = wx * config.noiseScale;
      const nz = wz * config.noiseScale;
      let h = fbm(noise, nx, nz, config.octaves);
      h = (h + 1) / 2;

      const dx = wx / halfSize;
      const dz = wz / halfSize;
      const distFromCenter = Math.sqrt(dx * dx + dz * dz);
      const islandFactor = Math.max(0, 1 - Math.pow(distFromCenter / config.islandRadius, 2.5));

      h *= islandFactor;

      const centerDist = Math.sqrt(wx * wx + wz * wz);
      if (centerDist < config.flattenCenter) {
        const flatFactor = centerDist / config.flattenCenter;
        h = h * flatFactor + 0.15 * (1 - flatFactor);
      }

      if (biome === "volcanic" && centerDist < 25) {
        const volcFactor = 1 - centerDist / 25;
        const crater = volcFactor > 0.6 ? (volcFactor - 0.6) * 2.5 : 0;
        h = h + volcFactor * 0.5 - crater * 0.3;
      }

      const detail = noise2.noise2D(wx * 0.08, wz * 0.08) * 0.05;
      h += detail * islandFactor;

      heightData[iz * (resolution + 1) + ix] = Math.max(0, h) * config.maxHeight;
    }
  }

  for (let pass = 0; pass < 2; pass++) {
    const copy = new Float32Array(heightData);
    for (let iz = 1; iz < resolution; iz++) {
      for (let ix = 1; ix < resolution; ix++) {
        const idx = iz * (resolution + 1) + ix;
        heightData[idx] = (
          copy[idx] * 4 +
          copy[idx - 1] + copy[idx + 1] +
          copy[idx - (resolution + 1)] + copy[idx + (resolution + 1)]
        ) / 8;
      }
    }
  }

  const rng = seededRng(seed);
  const dockPositions = generateDockPositions(heightData, resolution, worldSize, rng);
  const villageCenter = { x: rng() * 20 - 10, z: rng() * 20 - 10 };

  let dungeonPortalPos = null;
  if (hasDungeon) {
    const angle = rng() * Math.PI * 2;
    const dist = 40 + rng() * 30;
    dungeonPortalPos = {
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
    };
  }

  let shopPos = null;
  if (hasShop) {
    shopPos = {
      x: villageCenter.x + (rng() - 0.5) * 15,
      z: villageCenter.z + (rng() - 0.5) * 15,
    };
  }

  return {
    heightData,
    resolution,
    worldSize,
    maxHeight: config.maxHeight,
    biome,
    seed,
    dockPositions,
    dungeonPortalPos,
    shopPos,
    villageCenter,
  };
}

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function generateDockPositions(
  heightData: Float32Array,
  resolution: number,
  worldSize: number,
  rng: () => number,
): { x: number; z: number; rotation: number }[] {
  const docks: { x: number; z: number; rotation: number }[] = [];
  const halfSize = worldSize / 2;
  const directions = [
    { angle: 0, label: "east" },
    { angle: Math.PI / 2, label: "south" },
    { angle: Math.PI, label: "west" },
    { angle: -Math.PI / 2, label: "north" },
  ];

  for (const dir of directions) {
    if (rng() > 0.6) continue;
    for (let dist = halfSize * 0.3; dist < halfSize * 0.8; dist += 5) {
      const x = Math.cos(dir.angle) * dist;
      const z = Math.sin(dir.angle) * dist;

      const ix = Math.round(((x + halfSize) / worldSize) * resolution);
      const iz = Math.round(((z + halfSize) / worldSize) * resolution);
      if (ix < 0 || ix > resolution || iz < 0 || iz > resolution) continue;
      const h = heightData[iz * (resolution + 1) + ix];

      if (h > 0.2 && h < 2.0) {
        docks.push({ x, z, rotation: dir.angle + Math.PI });
        break;
      }
    }
  }

  if (docks.length === 0) {
    docks.push({ x: halfSize * 0.4, z: 0, rotation: Math.PI });
  }

  return docks;
}

export function getIslandTerrainHeight(
  x: number, z: number,
  data: IslandTerrainData,
): number {
  const halfSize = data.worldSize / 2;
  const nx = ((x + halfSize) / data.worldSize) * data.resolution;
  const nz = ((z + halfSize) / data.worldSize) * data.resolution;
  const ix = Math.floor(nx);
  const iz = Math.floor(nz);
  if (ix < 0 || ix >= data.resolution || iz < 0 || iz >= data.resolution) return 0;
  const fx = nx - ix;
  const fz = nz - iz;
  const w = data.resolution + 1;
  const h00 = data.heightData[iz * w + ix];
  const h10 = data.heightData[iz * w + ix + 1];
  const h01 = data.heightData[(iz + 1) * w + ix];
  const h11 = data.heightData[(iz + 1) * w + ix + 1];
  return (h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz) + h01 * (1 - fx) * fz + h11 * fx * fz);
}

export const BIOME_COLORS: Record<IslandBiome, {
  sand: string; grass: string; rock: string; snow: string; water: string;
}> = {
  temperate: { sand: "#c2b280", grass: "#4a7c3f", rock: "#6b6b6b", snow: "#e8e8e8", water: "#2255aa" },
  tropical: { sand: "#e8d5a3", grass: "#2d8c2d", rock: "#8b7355", snow: "#f0f0e8", water: "#1188aa" },
  volcanic: { sand: "#3a3a3a", grass: "#3d5c2d", rock: "#4a4a4a", snow: "#cccccc", water: "#882200" },
  arctic: { sand: "#d0d0d0", grass: "#6b8b6b", rock: "#8888a0", snow: "#ffffff", water: "#334466" },
  pirate: { sand: "#dcc89c", grass: "#3a6b2a", rock: "#7b6b55", snow: "#e0d8c8", water: "#117788" },
  cursed: { sand: "#5a4a5a", grass: "#2a4a2a", rock: "#4a3a4a", snow: "#8a7a8a", water: "#221144" },
};
