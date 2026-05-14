import * as THREE from "three";

export const CHUNK_SIZE = 50;
export const LOD_FULL = 50;
export const LOD_LOW = 150;
export const LOD_MINIMAL = 200;

export type LODTier = "full" | "low" | "minimal" | "unloaded";

export interface ChunkCoord {
  cx: number;
  cz: number;
}

export interface WorldChunk {
  cx: number;
  cz: number;
  key: string;
  lod: LODTier;
  worldX: number;
  worldZ: number;
  terrainGenerated: boolean;
  naturePopulated: boolean;
  active: boolean;
}

function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

function worldToChunk(wx: number, wz: number): ChunkCoord {
  return {
    cx: Math.floor(wx / CHUNK_SIZE),
    cz: Math.floor(wz / CHUNK_SIZE),
  };
}

function chunkCenter(cx: number, cz: number): [number, number] {
  return [cx * CHUNK_SIZE + CHUNK_SIZE / 2, cz * CHUNK_SIZE + CHUNK_SIZE / 2];
}

function distToChunk(px: number, pz: number, cx: number, cz: number): number {
  const [ccx, ccz] = chunkCenter(cx, cz);
  return Math.sqrt((px - ccx) ** 2 + (pz - ccz) ** 2);
}

export function getLODTier(distance: number): LODTier {
  if (distance <= LOD_FULL) return "full";
  if (distance <= LOD_LOW) return "low";
  if (distance <= LOD_MINIMAL) return "minimal";
  return "unloaded";
}

export class WorldChunkManager {
  chunks = new Map<string, WorldChunk>();
  private lastPlayerChunk: ChunkCoord = { cx: -999, cz: -999 };
  private loadRadius: number;

  constructor() {
    this.loadRadius = Math.ceil(LOD_MINIMAL / CHUNK_SIZE) + 1;
  }

  update(playerX: number, playerZ: number): {
    added: WorldChunk[];
    removed: string[];
    lodChanged: WorldChunk[];
  } {
    const pc = worldToChunk(playerX, playerZ);
    const added: WorldChunk[] = [];
    const removed: string[] = [];
    const lodChanged: WorldChunk[] = [];

    const activeKeys = new Set<string>();

    for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
      for (let dz = -this.loadRadius; dz <= this.loadRadius; dz++) {
        const cx = pc.cx + dx;
        const cz = pc.cz + dz;
        const dist = distToChunk(playerX, playerZ, cx, cz);
        const lod = getLODTier(dist);

        if (lod === "unloaded") continue;

        const key = chunkKey(cx, cz);
        activeKeys.add(key);

        const existing = this.chunks.get(key);
        if (existing) {
          if (existing.lod !== lod) {
            existing.lod = lod;
            lodChanged.push(existing);
          }
        } else {
          const chunk: WorldChunk = {
            cx,
            cz,
            key,
            lod,
            worldX: cx * CHUNK_SIZE,
            worldZ: cz * CHUNK_SIZE,
            terrainGenerated: false,
            naturePopulated: false,
            active: true,
          };
          this.chunks.set(key, chunk);
          added.push(chunk);
        }
      }
    }

    for (const [key, chunk] of Array.from(this.chunks)) {
      if (!activeKeys.has(key)) {
        chunk.active = false;
        removed.push(key);
        this.chunks.delete(key);
      }
    }

    this.lastPlayerChunk = pc;
    return { added, removed, lodChanged };
  }

  getActiveChunks(): WorldChunk[] {
    return Array.from(this.chunks.values());
  }

  getChunksAtLOD(lod: LODTier): WorldChunk[] {
    return Array.from(this.chunks.values()).filter(c => c.lod === lod);
  }

  getPlayerChunk(): ChunkCoord {
    return this.lastPlayerChunk;
  }
}

export function generateChunkHeightmap(
  chunk: WorldChunk,
  islandSeed: number,
  islandSize: number,
  resolution: number
): Float32Array {
  const data = new Float32Array(resolution * resolution);
  const noiseScale = 0.02;
  const maxHeight = 12;

  let s = islandSeed + chunk.cx * 73856093 + chunk.cz * 19349663;
  const hash = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };

  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const wx = chunk.worldX + (x / (resolution - 1)) * CHUNK_SIZE;
      const wz = chunk.worldZ + (z / (resolution - 1)) * CHUNK_SIZE;

      const distFromCenter = Math.sqrt(wx * wx + wz * wz);
      const islandFactor = Math.max(0, 1 - (distFromCenter / (islandSize * 0.5)) ** 2);

      const nx = wx * noiseScale;
      const nz = wz * noiseScale;
      const noise1 = Math.sin(nx * 1.3 + nz * 0.7) * 0.5 + 0.5;
      const noise2 = Math.sin(nx * 2.7 + nz * 1.3 + 1.5) * 0.3;
      const noise3 = Math.sin(nx * 5.1 + nz * 3.7 + 3.0) * 0.1;

      const rawHeight = (noise1 + noise2 + noise3) * maxHeight * islandFactor;

      const spawnDist = Math.sqrt(wx * wx + (wz + 5) * (wz + 5));
      const flattenFactor = spawnDist < 14 ? Math.pow(spawnDist / 14, 2) : 1;

      data[z * resolution + x] = Math.max(0, rawHeight * flattenFactor);
    }
  }

  return data;
}

export function getChunkTerrainHeight(
  heightData: Float32Array,
  resolution: number,
  localX: number,
  localZ: number
): number {
  const gridX = (localX / CHUNK_SIZE) * (resolution - 1);
  const gridZ = (localZ / CHUNK_SIZE) * (resolution - 1);

  const x0 = Math.floor(Math.max(0, Math.min(resolution - 2, gridX)));
  const z0 = Math.floor(Math.max(0, Math.min(resolution - 2, gridZ)));
  const fx = gridX - x0;
  const fz = gridZ - z0;

  const h00 = heightData[z0 * resolution + x0];
  const h10 = heightData[z0 * resolution + x0 + 1];
  const h01 = heightData[(z0 + 1) * resolution + x0];
  const h11 = heightData[(z0 + 1) * resolution + x0 + 1];

  return h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz) + h01 * (1 - fx) * fz + h11 * fx * fz;
}
