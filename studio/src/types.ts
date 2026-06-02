/**
 * Shared types for the Studio editor.
 * Map projects are pure JSON so they can be saved to localStorage today
 * and pushed to Postgres later without any shape change.
 */

export type Vec3 = [number, number, number];

/**
 * Loose entity categories. Renderer dispatches on `kind` to pick a
 * mesh/component; gameplay systems use `data` for any fine-grained
 * subtype, species, behavior tuning, etc.
 */
export type EntityKind =
  | 'unit'
  | 'building'
  | 'prop'
  | 'spell_marker'
  | 'spawn_point'
  | 'tree'
  | 'rock'
  | 'bush'
  | 'flower'
  | 'creature'
  | 'resource_node'
  | 'dock';

export interface PlacedEntity {
  id: string;
  kind: EntityKind;
  /** Display label shown in the outliner */
  name: string;
  /** Asset reference — can be a URL, /public path, or registry key */
  asset?: string;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  /** Free-form gameplay data (hp, faction, build cost, species, behavior, etc.) */
  data: Record<string, unknown>;
}

export interface TerrainData {
  /** Power-of-two grid resolution per side */
  resolution: number;
  /** World-space size per side (metres) */
  size: number;
  /** Flat heights[resolution * resolution] in metres, row-major (z, x) */
  heights: number[];
  /** Per-vertex biome id, same length as heights — 0=grass 1=sand 2=rock 3=snow */
  biome: number[];
}

/**
 * Runtime-side alias for TerrainData — some modules (GrassField,
 * terrain-utils) import `Terrain` instead. Kept as an alias so both
 * spellings compile; always prefer `TerrainData` in new code.
 */
export type Terrain = TerrainData;

export interface MapProject {
  schema: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Last seed used by the island generator, if any */
  seed?: number;
  terrain: TerrainData;
  entities: PlacedEntity[];
  /** RTS gameplay tuning saved with the map */
  rules: {
    startingFunds: number;
    fogOfWar: boolean;
    waveCount: number;
    victoryCondition: 'eliminate' | 'survive' | 'capture';
  };
}

export type EditorTool =
  | 'select'
  | 'translate'
  | 'rotate'
  | 'scale'
  | 'sculpt_raise'
  | 'sculpt_lower'
  | 'sculpt_smooth'
  | 'paint_grass'
  | 'paint_sand'
  | 'paint_rock'
  | 'paint_snow'
  | 'place_entity';
