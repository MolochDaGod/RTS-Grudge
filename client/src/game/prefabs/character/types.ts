/**
 * Character Prefab Types
 *
 * Shared interfaces for the unified character prefab system.
 * All 6 races use the same types — race/faction/class only change data, not shape.
 */

import type * as THREE from "three";

// ---------------------------------------------------------------------------
// Core enums
// ---------------------------------------------------------------------------

export type RaceId = "human" | "barbarian" | "elf" | "dwarf" | "orc" | "undead";
export type FactionId = "crusade" | "fabled" | "legion" | "wild";
export type ClassId = "warrior" | "mage" | "ranger" | "worge";

/** Physics body mode — drives kinematic↔dynamic switching. */
export type PhysicsMode = "kinematic" | "dynamic" | "static";

/** High-level locomotion bucket fed to the animator. */
export type LocomotionState = "idle" | "walk" | "run" | "sprint" | "jumping" | "falling";

/** Ragdoll transition presets. */
export type RagdollPreset = "death" | "heavyHit" | "knockback" | "landImpact" | "none";

// ---------------------------------------------------------------------------
// Stats allocation (8-attribute system from StatsEngine)
// ---------------------------------------------------------------------------

export interface StatsAllocation {
  STR: number;
  DEX: number;
  INT: number;
  VIT: number;
  WIS: number;
  LCK: number;
  CHA: number;
  END: number;
}

export const DEFAULT_STATS: StatsAllocation = {
  STR: 20, DEX: 20, INT: 20, VIT: 20, WIS: 20, LCK: 20, CHA: 20, END: 20,
};

// ---------------------------------------------------------------------------
// Prefab configuration
// ---------------------------------------------------------------------------

export interface PrefabConfig {
  race: RaceId;
  faction: FactionId;
  class: ClassId;
  /** Player-controlled vs AI companion/NPC. */
  isPlayer: boolean;
  /** Equipment tier (0-8). Affects starting gear variant. */
  tier: number;
  /** 8-attribute point spread. */
  attributes: StatsAllocation;
  /** Override scale (default 1). */
  scale?: number;
  /** Starting position in world space. */
  spawnPosition?: THREE.Vector3;
}

// ---------------------------------------------------------------------------
// Skeleton bounds (auto-measured from loaded model)
// ---------------------------------------------------------------------------

export interface SkeletonBounds {
  /** Total height of the character model in world units. */
  height: number;
  /** XZ radius for the capsule collider. */
  radiusXZ: number;
}

// ---------------------------------------------------------------------------
// Hotbar slot definition
// ---------------------------------------------------------------------------

export interface HotbarSlot {
  /** Slot index (0-7). Slots 0-3 are skills, 4 is empty, 5-7 are consumables. */
  index: number;
  /** Display name. */
  name: string;
  /** Combat machine event to fire. */
  event: string;
  /** Animation state key. */
  animKey: string;
  /** Cooldown in seconds. */
  cooldown: number;
  /** Stamina cost. */
  staminaCost: number;
  /** Icon path (CDN or local). */
  icon?: string;
}

// ---------------------------------------------------------------------------
// Weapon type (subset relevant to the prefab system)
// ---------------------------------------------------------------------------

export type PrefabWeaponType =
  | "sword" | "axe" | "mace" | "dagger" | "hammer"
  | "staff" | "wand" | "bow" | "crossbow" | "gun"
  | "spear" | "polearm" | "shield" | "greatsword"
  | "fists";

// ---------------------------------------------------------------------------
// Ragdoll bone definition
// ---------------------------------------------------------------------------

export interface RagdollBoneDef {
  /** Bone name in the Bip001 skeleton. */
  boneName: string;
  /** Collider shape. */
  shape: "capsule" | "sphere" | "box";
  /** Dimensions: [halfHeight, radius] for capsule, [radius] for sphere. */
  dimensions: number[];
  /** Mass in kg. */
  mass: number;
  /** Parent bone name (null for root). */
  parent: string | null;
  /** Joint angle limits in radians: [minX, maxX, minY, maxY, minZ, maxZ]. */
  jointLimits?: number[];
}

// ---------------------------------------------------------------------------
// Damage event passed to takeDamage()
// ---------------------------------------------------------------------------

export interface DamageEvent {
  amount: number;
  /** World-space direction the hit came from (for knockback). */
  direction: THREE.Vector3;
  /** Source entity id (for kill attribution). */
  sourceId?: string;
  /** If true, triggers ragdoll stagger instead of just hit-react. */
  isHeavy?: boolean;
  /** If true, triggers full ragdoll death. */
  isLethal?: boolean;
}
