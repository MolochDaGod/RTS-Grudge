/**
 * Mirror of grudge-builder/shared/definitions/rtsTerrainBridge.ts
 * Keep in sync when changing heightmap encoding or zone derivation.
 */

export const RTS_TERRAIN_RESOLUTION = 128;
export const RTS_DEFAULT_WORLD_SIZE_M = 200;

export interface RtsHeightmapPayload {
  resolution: number;
  worldSizeM: number;
  maxHeightM: number;
  biome: string;
  heightsBase64: string;
}

export function encodeRtsHeightmap(
  heights: Float32Array,
  maxHeightM: number,
): string {
  const u16 = new Uint16Array(heights.length);
  const denom = Math.max(maxHeightM, 0.001);
  for (let i = 0; i < heights.length; i++) {
    u16[i] = Math.min(65535, Math.round((Math.max(0, heights[i]) / denom) * 65535));
  }
  const bytes = new Uint8Array(u16.buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function buildRtsHeightmapPayload(
  heights: Float32Array,
  resolution: number,
  worldSizeM: number,
  maxHeightM: number,
  biome: string,
): RtsHeightmapPayload {
  return {
    resolution,
    worldSizeM,
    maxHeightM,
    biome,
    heightsBase64: encodeRtsHeightmap(heights, maxHeightM),
  };
}