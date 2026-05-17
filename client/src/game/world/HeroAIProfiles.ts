/**
 * HeroAIProfiles — class-specific behavior blueprints for hero NPC agents.
 *
 * Each HeroClass maps to one profile that governs:
 *   - Engagement and preferred fighting distance
 *   - Retreat logic (none / threshold)
 *   - Special move timing and type
 *   - Kiting vs. hold-ground preference
 *   - Berserker escalation at low HP
 *   - Harvest resource preferences when not in combat
 *
 * FactionHeroNPC.tsx reads these at runtime to parameterise its AI loop.
 * AllyNPC.tsx uses a similar pattern — keep both in sync when extending.
 */

import type { HeroClass } from "@/lib/stores/useCharacterStats";

// ─────────────────────────────────────────────────────────────────────────────

export type SpecialMoveType =
  | "charge"      // warrior: high-speed sprint + heavy hit
  | "aoe_sweep"   // warrior: damage all in radius
  | "leap"        // worge: leap from distance, guarantee melee hit
  | "howl"        // worge: stun pulse on berserk trigger
  | "big_spell"   // mage: heavy AOE projectile burst
  | "blink_back"  // mage: teleport away when surrounded
  | "rapid_fire"  // ranger: 3-shot burst in quick succession
  | "sidestep";   // ranger: perpendicular dash to break line

export interface HeroAIProfile {
  heroClass: HeroClass;

  // ── Spacing ─────────────────────────────────────────────────────────────
  /** Distance at which the hero begins moving toward the nearest enemy. */
  engageRange: number;
  /** Distance at which a melee/ranged attack is valid. */
  attackRange: number;
  /**
   * Preferred distance to maintain from the enemy during combat.
   * Warriors want to stay close; rangers and mages stay far.
   */
  optimalRange: number;
  /**
   * HP fraction (0-1) below which the hero retreats to camp before re-engaging.
   * null = never retreats (warriors/worges stand their ground).
   */
  retreatThreshold: number | null;

  // ── Timing ──────────────────────────────────────────────────────────────
  /** Normal attack interval in seconds. */
  attackCooldown: number;
  /** Interval between special moves in seconds. */
  specialCooldown: number;
  /** Primary special move. */
  specialMove: SpecialMoveType;
  /** Secondary special move (null = only one). */
  specialMove2: SpecialMoveType | null;

  // ── Locomotion ──────────────────────────────────────────────────────────
  /**
   * If true, the hero strafes perpendicular to the enemy while firing instead
   * of standing still. Prevents a ranger from being a static target.
   */
  kiteWhileFighting: boolean;
  /**
   * Combat circle orbit speed for melee heroes (rad/s).
   * 0 = stand in place, ~1 = slow circle, ~2.5 = fast weave.
   */
  circleOrbitSpeed: number;

  // ── Berserker ───────────────────────────────────────────────────────────
  /**
   * HP fraction (0-1) below which berserk mode activates.
   * Berserk doubles speed and damage multiplier and prevents retreat.
   * 0 = no berserk.
   */
  berserkerThreshold: number;
  /** Damage multiplier applied in berserk mode (1 = no bonus). */
  berserkerDamageMult: number;

  // ── Camp / harvest ──────────────────────────────────────────────────────
  /** Maximum patrol radius from the camp when no enemies are near (world units). */
  patrolRadius: number;
  /** Preferred resource types to harvest when dailyObjective is "harvest". */
  preferredResources: string[];
  /** Harvest speed multiplier (relative to base harvest rate). */
  harvestMultiplier: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// The four profiles
// ─────────────────────────────────────────────────────────────────────────────

export const HERO_AI_PROFILES: Record<HeroClass, HeroAIProfile> = {

  // ── WARRIOR ─────────────────────────────────────────────────────────────
  // Charges directly at enemies, holds ground, rotates around target.
  // Periodic charge attack to close distance; AoE sweep on timer.
  warrior: {
    heroClass: "warrior",
    engageRange: 22,
    attackRange: 2.8,
    optimalRange: 2.0,
    retreatThreshold: null,
    attackCooldown: 1.1,
    specialCooldown: 8.0,
    specialMove: "charge",
    specialMove2: "aoe_sweep",
    kiteWhileFighting: false,
    circleOrbitSpeed: 1.2,
    berserkerThreshold: 0,     // warriors don't berserk — they just fight harder
    berserkerDamageMult: 1.0,
    patrolRadius: 18,
    preferredResources: ["iron_ore", "stone", "raw_meat"],
    harvestMultiplier: 0.8,
  },

  // ── WORGE ────────────────────────────────────────────────────────────────
  // Highly aggressive. Leaps at enemies from range. Berserks at 30% HP.
  // Does not retreat — ever. Packs bonus when another worge hero is nearby.
  worge: {
    heroClass: "worge",
    engageRange: 28,
    attackRange: 2.5,
    optimalRange: 1.8,
    retreatThreshold: null,
    attackCooldown: 0.9,
    specialCooldown: 7.0,
    specialMove: "leap",
    specialMove2: "howl",
    kiteWhileFighting: false,
    circleOrbitSpeed: 2.2,
    berserkerThreshold: 0.30,
    berserkerDamageMult: 1.8,
    patrolRadius: 22,
    preferredResources: ["raw_meat", "fiber", "herb"],
    harvestMultiplier: 0.9,
  },

  // ── MAGE ─────────────────────────────────────────────────────────────────
  // Maintains distance. Blinks away from melee. Periodic big-spell AOE.
  // Retreats to camp when HP drops below 25% to re-engage from range.
  mage: {
    heroClass: "mage",
    engageRange: 18,
    attackRange: 15.0,
    optimalRange: 12.0,
    retreatThreshold: 0.25,
    attackCooldown: 1.8,
    specialCooldown: 12.0,
    specialMove: "big_spell",
    specialMove2: "blink_back",
    kiteWhileFighting: true,
    circleOrbitSpeed: 0,       // mages don't orbit — they strafe laterally
    berserkerThreshold: 0,
    berserkerDamageMult: 1.0,
    patrolRadius: 14,
    preferredResources: ["crystal", "herb", "berry"],
    harvestMultiplier: 1.4,
  },

  // ── RANGER ───────────────────────────────────────────────────────────────
  // Keeps maximum range. Strafes while shooting. Rapid-fire burst on timer.
  // Sidestep-dashes when cornered. Retreats if enemy closes within 6 units.
  ranger: {
    heroClass: "ranger",
    engageRange: 22,
    attackRange: 18.0,
    optimalRange: 14.0,
    retreatThreshold: 0.20,
    attackCooldown: 1.4,
    specialCooldown: 10.0,
    specialMove: "rapid_fire",
    specialMove2: "sidestep",
    kiteWhileFighting: true,
    circleOrbitSpeed: 0,       // rangers strafe, not orbit
    berserkerThreshold: 0,
    berserkerDamageMult: 1.0,
    patrolRadius: 20,
    preferredResources: ["wood", "fiber", "berry", "herb"],
    harvestMultiplier: 1.6,    // rangers are the best gatherers
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getAIProfile(heroClass: HeroClass): HeroAIProfile {
  return HERO_AI_PROFILES[heroClass];
}

/** True when this hero should berserk given current HP fraction. */
export function isBerserk(profile: HeroAIProfile, hpFraction: number): boolean {
  return profile.berserkerThreshold > 0 && hpFraction <= profile.berserkerThreshold;
}

/** True when the hero should retreat to camp to recover. */
export function shouldRetreat(profile: HeroAIProfile, hpFraction: number): boolean {
  if (profile.retreatThreshold === null) return false;
  return hpFraction <= profile.retreatThreshold;
}

/** Effective attack damage (applies berserk multiplier if active). */
export function effectiveDamage(
  baseDamage: number,
  profile: HeroAIProfile,
  hpFraction: number,
): number {
  return isBerserk(profile, hpFraction)
    ? baseDamage * profile.berserkerDamageMult
    : baseDamage;
}
