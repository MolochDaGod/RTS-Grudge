/**
 * Server-matching home island terrain generator (WCS generateTerrainServerSide).
 * Keeps RTS creation preview aligned with grudgewarlords.com hosted islands.
 */

export const TERRAIN = {
  WATER: 0,
  SAND: 1,
  GRASS: 2,
  FOREST: 3,
  ROCK: 4,
  BUILDABLE: 5,
} as const;

export type TerrainType = (typeof TERRAIN)[keyof typeof TERRAIN];

export const TERRAIN_COLORS: Record<TerrainType, string> = {
  [TERRAIN.WATER]: '#1a3a5c',
  [TERRAIN.SAND]: '#c2a878',
  [TERRAIN.GRASS]: '#4a8f4a',
  [TERRAIN.FOREST]: '#2d5a2d',
  [TERRAIN.ROCK]: '#6b6b6b',
  [TERRAIN.BUILDABLE]: '#6bdc8b',
};

function seededNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

export function generateHomeIslandTerrain(
  width: number,
  height: number,
  seed: number,
): number[][] {
  const terrain: number[][] = [];
  const centerX = width / 2;
  const centerY = height / 2;
  const islandRadius = Math.min(centerX, centerY) * 0.7;

  for (let y = 0; y < height; y++) {
    terrain[y] = [];
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const noise = seededNoise(x, y, seed);
      const falloff = 1 - distance / islandRadius;
      const value = falloff + (noise - 0.5) * 0.4;

      if (value < 0) terrain[y][x] = TERRAIN.WATER;
      else if (value < 0.15) terrain[y][x] = TERRAIN.SAND;
      else if (value < 0.4) terrain[y][x] = TERRAIN.GRASS;
      else if (value < 0.7) terrain[y][x] = TERRAIN.FOREST;
      else terrain[y][x] = TERRAIN.ROCK;

      if (value >= 0.2 && value < 0.5 && distance < islandRadius * 0.5) {
        terrain[y][x] = TERRAIN.BUILDABLE;
      }
    }
  }
  return terrain;
}

export function isValidCampCell(terrain: number[][], x: number, y: number): boolean {
  const cell = terrain[y]?.[x];
  return cell === TERRAIN.BUILDABLE || cell === TERRAIN.GRASS;
}