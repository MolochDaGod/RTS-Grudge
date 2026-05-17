/**
 * Character Prefab System — barrel export.
 *
 * Import from "@/game/prefabs/character" for the full character prefab API.
 */

// Top-level factory
export { CharacterPrefab } from "./CharacterPrefab";

// Individual layers (for advanced usage / testing)
export { CharacterSkeleton } from "./CharacterSkeleton";
export { CharacterAnimator } from "./CharacterAnimator";
export { CharacterBody } from "./CharacterBody";
export { RagdollBlendLayer } from "./RagdollBlendLayer";
export { CharacterCombat } from "./CharacterCombat";

// Types
export type {
  PrefabConfig,
  RaceId,
  FactionId,
  ClassId,
  PhysicsMode,
  LocomotionState,
  RagdollPreset,
  StatsAllocation,
  SkeletonBounds,
  HotbarSlot,
  PrefabWeaponType,
  RagdollBoneDef,
  DamageEvent,
} from "./types";

export { DEFAULT_STATS } from "./types";

// Constants
export {
  COLLISION_GROUPS,
  SPEED,
  RAGDOLL_PRESETS,
  RAGDOLL_BONES,
  TIER_MULTIPLIERS,
  CLASS_WEAPON_RESTRICTIONS,
  DEFAULT_CAPSULE,
} from "./constants";
