/**
 * TerrainPackage — mirror of GrudgeBuilder shared/definitions/terrainPackage.ts
 * Keep in sync when schema bumps. Used by Forge import of Unity/seed maps.
 */

export const TERRAIN_PACKAGE_SCHEMA = 1 as const;

export type TerrainEntityKind =
  | 'tree'
  | 'rock'
  | 'bush'
  | 'flower'
  | 'resource_node'
  | 'creature'
  | 'building'
  | 'prop'
  | 'dock'
  | 'spawn_point'
  | 'marker';

export interface TerrainHeightfield {
  resolution: number;
  sizeM: number;
  heights: number[];
  biome?: number[];
  worldPosition?: [number, number, number];
}

export interface TerrainEntity {
  id: string;
  kind: TerrainEntityKind;
  name: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  asset?: { r2Key: string; meshName?: string; targetSizeM?: number };
  data?: Record<string, unknown>;
}

export interface TerrainPackage {
  schema: typeof TERRAIN_PACKAGE_SCHEMA;
  mapId: string;
  name?: string;
  source?: string;
  exportedAt?: string;
  heightfield: TerrainHeightfield;
  entities: TerrainEntity[];
  water?: { levelY: number; profile?: string };
  markers?: Array<{ name: string; kind: string; position: [number, number, number] }>;
  characterHeightM?: number;
}

export function createEmptyTerrainPackage(
  mapId: string,
  opts?: { resolution?: number; sizeM?: number; name?: string },
): TerrainPackage {
  const resolution = opts?.resolution ?? 128;
  const sizeM = opts?.sizeM ?? 256;
  const cells = resolution * resolution;
  return {
    schema: TERRAIN_PACKAGE_SCHEMA,
    mapId,
    name: opts?.name ?? mapId,
    source: 'procedural',
    exportedAt: new Date().toISOString(),
    heightfield: {
      resolution,
      sizeM,
      heights: new Array(cells).fill(0),
      biome: new Array(cells).fill(0),
      worldPosition: [0, 0, 0],
    },
    entities: [],
    water: { levelY: 0 },
    markers: [],
    characterHeightM: 2.0,
  };
}

export function validateTerrainPackage(pkg: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!pkg || typeof pkg !== 'object') return { ok: false, errors: ['not an object'] };
  const p = pkg as Partial<TerrainPackage>;
  if (p.schema !== TERRAIN_PACKAGE_SCHEMA) errors.push(`schema must be ${TERRAIN_PACKAGE_SCHEMA}`);
  if (!p.mapId) errors.push('mapId required');
  if (!p.heightfield) errors.push('heightfield required');
  else {
    const need = (p.heightfield.resolution || 0) ** 2;
    if (!Array.isArray(p.heightfield.heights) || p.heightfield.heights.length !== need) {
      errors.push(`heights length must be ${need}`);
    }
  }
  if (!Array.isArray(p.entities)) errors.push('entities array required');
  return { ok: errors.length === 0, errors };
}

/** Map into Forge MapProject terrain fields */
export function toForgeTerrain(pkg: TerrainPackage) {
  const h = pkg.heightfield;
  const need = h.resolution * h.resolution;
  const heights = h.heights.slice(0, need);
  while (heights.length < need) heights.push(0);
  const biome = (h.biome ?? []).slice(0, need);
  while (biome.length < need) biome.push(0);
  return { resolution: h.resolution, size: h.sizeM, heights, biome };
}
