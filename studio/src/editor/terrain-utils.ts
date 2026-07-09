/**
 * Pure terrain math — kept separate from the React mesh component so
 * gameplay code (or a worker) can use it without pulling Three.js.
 */
import type { TerrainData } from '../types';
import { MAX_TERRAIN, OCEAN_FLOOR_DEEP } from './IslandGenerator';

interface Sampleable { resolution: number; size: number; heights: number[] }

/**
 * Convert world-space (x,z) into floating grid coords, with origin at
 * the centre of the terrain. Returns { gx, gz } in [0, res-1].
 */
function worldToGrid(x: number, z: number, t: Sampleable): { gx: number; gz: number } {
  const half = t.size / 2;
  const cell = t.size / (t.resolution - 1);
  return {
    gx: Math.max(0, Math.min(t.resolution - 1, (x + half) / cell)),
    gz: Math.max(0, Math.min(t.resolution - 1, (z + half) / cell)),
  };
}

/** Bilinear height sample. */
export function sampleHeight(x: number, z: number, t: Sampleable): number {
  const { gx, gz } = worldToGrid(x, z, t);
  const x0 = Math.floor(gx), x1 = Math.min(t.resolution - 1, x0 + 1);
  const z0 = Math.floor(gz), z1 = Math.min(t.resolution - 1, z0 + 1);
  const fx = gx - x0, fz = gz - z0;
  const h00 = t.heights[z0 * t.resolution + x0]!;
  const h10 = t.heights[z0 * t.resolution + x1]!;
  const h01 = t.heights[z1 * t.resolution + x0]!;
  const h11 = t.heights[z1 * t.resolution + x1]!;
  return (
    h00 * (1 - fx) * (1 - fz) +
    h10 *      fx  * (1 - fz) +
    h01 * (1 - fx) *      fz  +
    h11 *      fx  *      fz
  );
}

export type SculptOp = 'raise' | 'lower' | 'smooth';
export type PaintBiome = 0 | 1 | 2 | 3;

/**
 * Apply a circular brush at world (x,z). Mutates t.heights / t.biome
 * in place and returns true if any cell changed.
 */
export function applyBrush(
  t: TerrainData,
  worldX: number,
  worldZ: number,
  radiusWorld: number,
  strength: number,
  op: SculptOp | { paint: PaintBiome },
): boolean {
  const cell = t.size / (t.resolution - 1);
  const radiusCells = Math.max(1, Math.ceil(radiusWorld / cell));
  const { gx: cgx, gz: cgz } = worldToGrid(worldX, worldZ, t);
  const cx = Math.round(cgx), cz = Math.round(cgz);
  let changed = false;

  for (let dz = -radiusCells; dz <= radiusCells; dz++) {
    for (let dx = -radiusCells; dx <= radiusCells; dx++) {
      const x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= t.resolution || z >= t.resolution) continue;
      const distCells = Math.hypot(dx, dz);
      if (distCells > radiusCells) continue;
      // Smoothstep falloff so brush edges feel soft
      const u = 1 - distCells / radiusCells;
      const falloff = u * u * (3 - 2 * u);
      const i = z * t.resolution + x;

      if (typeof op === 'object') {
        // Paint biome — bias toward the painted index by falloff
        if (falloff > 0.35) {
          if (t.biome[i] !== op.paint) { t.biome[i] = op.paint; changed = true; }
        }
        continue;
      }
      const dh =
        op === 'raise'  ?  strength * falloff :
        op === 'lower'  ? -strength * falloff :
                          0;
      if (op === 'smooth') {
        // Average the 8 neighbours (clamped) and lerp toward the mean
        let sum = 0, count = 0;
        for (let ddz = -1; ddz <= 1; ddz++) {
          for (let ddx = -1; ddx <= 1; ddx++) {
            const xn = x + ddx, zn = z + ddz;
            if (xn < 0 || zn < 0 || xn >= t.resolution || zn >= t.resolution) continue;
            sum += t.heights[zn * t.resolution + xn]!;
            count++;
          }
        }
        const mean = count > 0 ? sum / count : t.heights[i]!;
        const next = t.heights[i]! + (mean - t.heights[i]!) * strength * falloff;
        const clamped = Math.max(OCEAN_FLOOR_DEEP, Math.min(MAX_TERRAIN, next));
        if (clamped !== t.heights[i]) { t.heights[i] = clamped; changed = true; }
      } else if (dh !== 0) {
        const next = Math.max(
          OCEAN_FLOOR_DEEP,
          Math.min(MAX_TERRAIN, (t.heights[i] ?? 0) + dh),
        );
        if (next !== t.heights[i]) { t.heights[i] = next; changed = true; }
      }
    }
  }
  return changed;
}
