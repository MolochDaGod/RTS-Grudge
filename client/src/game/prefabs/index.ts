/**
 * Barrel export for the prefab system. Import from "@/game/prefabs"
 * everywhere instead of reaching into the individual files — keeps
 * subsequent migrations (renames, splits) cheap.
 */

export {
  PREFAB_USERDATA_KEY,
  type Material,
  type Tool,
  type PrefabKind,
  type PrefabDrop,
  type PrefabDetachable,
  type PrefabVoxelSpec,
  type PrefabSchema,
  type PrefabTag,
} from "./types";

export {
  PREFAB_REGISTRY,
  RESOURCE_TYPE_TO_PREFAB_ID,
  type LegacyResourceType,
  getPrefab,
  tryGetPrefab,
} from "./registry";

export {
  tagPrefab,
  readPrefabTag,
  clearPrefabTags,
} from "./tagging";

// Character prefab system
export { CharacterPrefab } from "./character";
export type { PrefabConfig, RaceId, ClassId, DamageEvent } from "./character";
