/**
 * Character Prefab Constants
 *
 * Collision groups, speed thresholds, ragdoll transition curves,
 * and tier multipliers. Shared across all prefab layers.
 */

// ---------------------------------------------------------------------------
// Collision groups (Rapier interaction groups — powers of 2)
// ---------------------------------------------------------------------------

export const COLLISION_GROUPS = {
  TERRAIN:  0x0001,
  PLAYER:   0x0002,
  ENEMY:    0x0004,
  ATTACKER: 0x0008,
  TRIGGER:  0x0010,
  SHIELD:   0x0020,
  PROJECTILE: 0x0040,
} as const;

/** Player capsule interacts with terrain + enemy + trigger */
export const PLAYER_INTERACTION_GROUPS =
  (COLLISION_GROUPS.PLAYER << 16) |
  (COLLISION_GROUPS.TERRAIN | COLLISION_GROUPS.ENEMY | COLLISION_GROUPS.TRIGGER);

/** Enemy capsule interacts with terrain + player + trigger */
export const ENEMY_INTERACTION_GROUPS =
  (COLLISION_GROUPS.ENEMY << 16) |
  (COLLISION_GROUPS.TERRAIN | COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.TRIGGER);

// ---------------------------------------------------------------------------
// Speed thresholds (matches MovementController.ts)
// ---------------------------------------------------------------------------

export const SPEED = {
  WALK: 2.0,
  RUN:  5.0,
  SPRINT: 8.0,
  DASH: 12.0,
  /** Minimum speed to count as "moving" for animation. */
  DEADZONE: 0.05,
} as const;

// ---------------------------------------------------------------------------
// Ragdoll transition presets
// ---------------------------------------------------------------------------

/** ragdollWeight target, ramp duration (seconds), hold duration before lerp back */
export const RAGDOLL_PRESETS = {
  death:     { targetWeight: 1.0, rampUp: 0.3, holdTime: 2.0,  rampDown: 0 },
  heavyHit:  { targetWeight: 0.6, rampUp: 0.05, holdTime: 0.1, rampDown: 0.5 },
  knockback: { targetWeight: 0.8, rampUp: 0.05, holdTime: 0.3, rampDown: 0.4 },
  landImpact:{ targetWeight: 0.2, rampUp: 0.02, holdTime: 0.05, rampDown: 0.15 },
  none:      { targetWeight: 0,   rampUp: 0,    holdTime: 0,    rampDown: 0 },
} as const;

// ---------------------------------------------------------------------------
// Ragdoll bone configuration (shared across all races — Bip001 skeleton)
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;

export const RAGDOLL_BONES = [
  {
    boneName: "Bip001 Pelvis",
    shape: "capsule" as const,
    dimensions: [0.12, 0.08],
    mass: 10,
    parent: null,
  },
  {
    boneName: "Bip001 Spine",
    shape: "capsule" as const,
    dimensions: [0.14, 0.09],
    mass: 5,
    parent: "Bip001 Pelvis",
    jointLimits: [-30*DEG, 30*DEG, -30*DEG, 30*DEG, -30*DEG, 30*DEG],
  },
  {
    boneName: "Bip001 Head",
    shape: "sphere" as const,
    dimensions: [0.09],
    mass: 2,
    parent: "Bip001 Spine",
    jointLimits: [-45*DEG, 45*DEG, -30*DEG, 30*DEG, -20*DEG, 20*DEG],
  },
  {
    boneName: "Bip001 L UpperArm",
    shape: "capsule" as const,
    dimensions: [0.1, 0.04],
    mass: 2,
    parent: "Bip001 Spine",
    jointLimits: [-90*DEG, 90*DEG, -45*DEG, 45*DEG, -10*DEG, 170*DEG],
  },
  {
    boneName: "Bip001 R UpperArm",
    shape: "capsule" as const,
    dimensions: [0.1, 0.04],
    mass: 2,
    parent: "Bip001 Spine",
    jointLimits: [-90*DEG, 90*DEG, -45*DEG, 45*DEG, -170*DEG, 10*DEG],
  },
  {
    boneName: "Bip001 L Thigh",
    shape: "capsule" as const,
    dimensions: [0.15, 0.05],
    mass: 3,
    parent: "Bip001 Pelvis",
    jointLimits: [-20*DEG, 90*DEG, -30*DEG, 30*DEG, -20*DEG, 20*DEG],
  },
  {
    boneName: "Bip001 R Thigh",
    shape: "capsule" as const,
    dimensions: [0.15, 0.05],
    mass: 3,
    parent: "Bip001 Pelvis",
    jointLimits: [-20*DEG, 90*DEG, -30*DEG, 30*DEG, -20*DEG, 20*DEG],
  },
] as const;

// ---------------------------------------------------------------------------
// Tier multipliers (T0..T8 from StatsEngine)
// ---------------------------------------------------------------------------

export const TIER_MULTIPLIERS = [
  1.0, 1.2, 1.4, 1.6, 1.9, 2.2, 2.6, 3.2, 4.0,
] as const;

// ---------------------------------------------------------------------------
// Weapon class restrictions (from game design rules)
// ---------------------------------------------------------------------------

export const CLASS_WEAPON_RESTRICTIONS: Record<string, string[]> = {
  warrior: ["sword", "axe", "mace", "hammer", "shield", "greatsword", "polearm", "spear"],
  mage:    ["staff", "wand", "mace", "dagger"],
  ranger:  ["bow", "crossbow", "gun", "dagger", "greatsword", "spear"],
  worge:   ["staff", "spear", "dagger", "bow", "hammer", "mace"],
};

// ---------------------------------------------------------------------------
// Default capsule dimensions (fallback if auto-measure fails)
// ---------------------------------------------------------------------------

export const DEFAULT_CAPSULE = {
  height: 1.8,
  radius: 0.3,
} as const;
