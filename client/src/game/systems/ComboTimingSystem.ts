/**
 * ComboTimingSystem — Class-specific attack mechanics.
 *
 * MELEE (Warrior/Worge): Combo chain with precision timing finisher
 *   LMB → attack1 → attack2 → attack3 → FINISHER WINDOW
 *   On the 3rd hit, a timing bar appears. Hold LMB and release as
 *   close to the "sweet spot" line as possible without going over.
 *   The closer to the line, the higher the crit chance bonus.
 *   Going OVER the line = miss (weak hit, stamina wasted).
 *
 * MAGIC (Mage): Charge-cast system
 *   Hold LMB → charging → charged1 → charged2
 *   Release fires the spell at the current charge tier.
 *   Higher tiers = more damage + bigger AoE + more mana cost.
 *   This is the existing charge system, now class-gated.
 *
 * RANGER: Aim-and-release
 *   Hold LMB → draw → release fires projectile
 *   Draw time affects projectile speed + damage (like bow draw).
 *   Perfect draw timing = bonus crit.
 */

import type { CombatClass, WeaponType } from "@/lib/stores/useGame";
import type { ExtendedWeaponType } from "./WeaponPrefabDatabase";

// ---------------------------------------------------------------------------
// Melee Combo Finisher Timing
// ---------------------------------------------------------------------------

export interface ComboTimingState {
  /** Whether the timing window is currently active */
  active: boolean;
  /** Current fill progress (0–1, advances while LMB held on combo 3+) */
  progress: number;
  /** The "sweet spot" position (0.7–0.95, randomized per window) */
  sweetSpot: number;
  /** Width of the perfect zone around the sweet spot */
  perfectZone: number;
  /** Width of the "good" zone (wider than perfect) */
  goodZone: number;
  /** Whether the player went over the line (failed) */
  overshot: boolean;
  /** Result of the last release */
  lastResult: TimingResult | null;
}

export type TimingResult = "perfect" | "good" | "early" | "overshot";

export interface TimingReward {
  critBonus: number;       // Added to base crit chance (0–100%)
  damageMultiplier: number; // Multiplied with base damage
  vfxIntensity: number;    // VFX particle count multiplier
  label: string;
}

const TIMING_REWARDS: Record<TimingResult, TimingReward> = {
  perfect: { critBonus: 40, damageMultiplier: 2.5, vfxIntensity: 3.0, label: "PERFECT!" },
  good:    { critBonus: 15, damageMultiplier: 1.5, vfxIntensity: 1.5, label: "GOOD" },
  early:   { critBonus: 0,  damageMultiplier: 1.0, vfxIntensity: 1.0, label: "" },
  overshot:{ critBonus: -10, damageMultiplier: 0.5, vfxIntensity: 0.5, label: "MISS!" },
};

/** Fill speed — how fast the bar progresses (units per second) */
const FILL_SPEED = 1.2;
/** How much the sweet spot varies between combos */
const SWEET_SPOT_MIN = 0.70;
const SWEET_SPOT_MAX = 0.92;
/** Width of the perfect zone (±) around the sweet spot */
const PERFECT_HALF_WIDTH = 0.04;
/** Width of the good zone (±) */
const GOOD_HALF_WIDTH = 0.10;

let comboState: ComboTimingState = {
  active: false,
  progress: 0,
  sweetSpot: 0.82,
  perfectZone: PERFECT_HALF_WIDTH,
  goodZone: GOOD_HALF_WIDTH,
  overshot: false,
  lastResult: null,
};

/**
 * Start the combo timing window. Called when the player enters
 * the 3rd+ hit in a melee combo chain and holds LMB.
 */
export function startComboTiming(): void {
  comboState = {
    active: true,
    progress: 0,
    sweetSpot: SWEET_SPOT_MIN + Math.random() * (SWEET_SPOT_MAX - SWEET_SPOT_MIN),
    perfectZone: PERFECT_HALF_WIDTH,
    goodZone: GOOD_HALF_WIDTH,
    overshot: false,
    lastResult: null,
  };
}

/**
 * Tick the combo timing bar. Call every frame while active.
 * @param delta Frame delta in seconds
 * @returns true if the bar overshot (auto-fails)
 */
export function tickComboTiming(delta: number): boolean {
  if (!comboState.active) return false;

  comboState.progress += FILL_SPEED * delta;

  if (comboState.progress >= 1.0) {
    // Went past the end — overshot
    comboState.overshot = true;
    comboState.lastResult = "overshot";
    comboState.active = false;
    return true;
  }

  return false;
}

/**
 * Release the combo timing — evaluate how close to the sweet spot.
 * @returns The timing result and reward
 */
export function releaseComboTiming(): { result: TimingResult; reward: TimingReward } {
  if (!comboState.active) {
    return { result: "early", reward: TIMING_REWARDS.early };
  }

  comboState.active = false;
  const dist = Math.abs(comboState.progress - comboState.sweetSpot);

  let result: TimingResult;
  if (comboState.progress > comboState.sweetSpot + comboState.goodZone) {
    result = "overshot";
  } else if (dist <= comboState.perfectZone) {
    result = "perfect";
  } else if (dist <= comboState.goodZone) {
    result = "good";
  } else {
    result = "early";
  }

  comboState.lastResult = result;
  return { result, reward: TIMING_REWARDS[result] };
}

/** Cancel the timing window (player dodged/rolled/got hit) */
export function cancelComboTiming(): void {
  comboState.active = false;
  comboState.lastResult = null;
}

/** Get current state for HUD rendering */
export function getComboTimingState(): Readonly<ComboTimingState> {
  return comboState;
}

/** Get the reward config for a result */
export function getTimingReward(result: TimingResult): TimingReward {
  return TIMING_REWARDS[result];
}

// ---------------------------------------------------------------------------
// Magic Charge System — class-gated version of the existing charge
// ---------------------------------------------------------------------------

export interface MagicChargeState {
  active: boolean;
  /** Charge time in seconds */
  chargeTime: number;
  /** Current tier (0 = base, 1 = empowered, 2 = max) */
  tier: 0 | 1 | 2;
  /** Element of the spell being charged */
  element: "fire" | "ice" | "lightning" | "shadow" | "arcane" | "nature";
}

const CHARGE_TIER_THRESHOLDS = [0, 0.5, 1.2]; // seconds to reach each tier

let magicCharge: MagicChargeState = {
  active: false,
  chargeTime: 0,
  tier: 0,
  element: "arcane",
};

export interface MagicChargeConfig {
  /** Damage multiplier per tier */
  damagePerTier: [number, number, number]; // [base, empowered, max]
  /** Mana cost per tier */
  manaPerTier: [number, number, number];
  /** AoE radius per tier (0 = single target) */
  aoePerTier: [number, number, number];
  /** VFX intensity per tier */
  vfxPerTier: [number, number, number];
}

export const DEFAULT_MAGIC_CHARGE: MagicChargeConfig = {
  damagePerTier: [1.0, 1.8, 3.0],
  manaPerTier: [5, 12, 25],
  aoePerTier: [0, 2, 4],
  vfxPerTier: [1, 2, 4],
};

export function startMagicCharge(element: MagicChargeState["element"] = "arcane"): void {
  magicCharge = { active: true, chargeTime: 0, tier: 0, element };
}

export function tickMagicCharge(delta: number): { tierChanged: boolean; newTier: 0 | 1 | 2 } {
  if (!magicCharge.active) return { tierChanged: false, newTier: 0 };

  magicCharge.chargeTime += delta;
  const prevTier = magicCharge.tier;

  if (magicCharge.chargeTime >= CHARGE_TIER_THRESHOLDS[2]) {
    magicCharge.tier = 2;
  } else if (magicCharge.chargeTime >= CHARGE_TIER_THRESHOLDS[1]) {
    magicCharge.tier = 1;
  }

  return { tierChanged: magicCharge.tier !== prevTier, newTier: magicCharge.tier };
}

export function releaseMagicCharge(config = DEFAULT_MAGIC_CHARGE): {
  tier: 0 | 1 | 2;
  damage: number;
  manaCost: number;
  aoeRadius: number;
  vfxIntensity: number;
  element: MagicChargeState["element"];
} {
  const t = magicCharge.tier;
  magicCharge.active = false;
  return {
    tier: t,
    damage: config.damagePerTier[t],
    manaCost: config.manaPerTier[t],
    aoeRadius: config.aoePerTier[t],
    vfxIntensity: config.vfxPerTier[t],
    element: magicCharge.element,
  };
}

export function cancelMagicCharge(): void {
  magicCharge.active = false;
  magicCharge.chargeTime = 0;
  magicCharge.tier = 0;
}

export function getMagicChargeState(): Readonly<MagicChargeState> {
  return magicCharge;
}

// ---------------------------------------------------------------------------
// Ranger Draw System — aim-and-release with draw strength
// ---------------------------------------------------------------------------

export interface RangerDrawState {
  active: boolean;
  drawTime: number;
  /** 0–1 draw strength (maps to projectile speed + damage) */
  drawStrength: number;
  /** Whether the draw is at "perfect" strength */
  isPerfectDraw: boolean;
}

const DRAW_MAX_TIME = 1.5;         // seconds to reach full draw
const PERFECT_DRAW_WINDOW = 0.1;   // ± seconds around full draw
const DRAW_PERFECT_CRIT = 25;      // crit bonus for perfect draw

let rangerDraw: RangerDrawState = {
  active: false, drawTime: 0, drawStrength: 0, isPerfectDraw: false,
};

export function startRangerDraw(): void {
  rangerDraw = { active: true, drawTime: 0, drawStrength: 0, isPerfectDraw: false };
}

export function tickRangerDraw(delta: number): void {
  if (!rangerDraw.active) return;
  rangerDraw.drawTime += delta;
  rangerDraw.drawStrength = Math.min(1, rangerDraw.drawTime / DRAW_MAX_TIME);
  rangerDraw.isPerfectDraw =
    rangerDraw.drawStrength >= 0.95 &&
    rangerDraw.drawTime <= DRAW_MAX_TIME + PERFECT_DRAW_WINDOW;
}

export function releaseRangerDraw(): {
  drawStrength: number;
  critBonus: number;
  damageMultiplier: number;
  projectileSpeed: number;
} {
  rangerDraw.active = false;
  const str = rangerDraw.drawStrength;
  const perfect = rangerDraw.isPerfectDraw;
  return {
    drawStrength: str,
    critBonus: perfect ? DRAW_PERFECT_CRIT : 0,
    damageMultiplier: 0.5 + str * 1.5, // 0.5× at min, 2.0× at full
    projectileSpeed: 10 + str * 20,     // 10–30 m/s
  };
}

export function cancelRangerDraw(): void {
  rangerDraw.active = false;
  rangerDraw.drawTime = 0;
  rangerDraw.drawStrength = 0;
}

export function getRangerDrawState(): Readonly<RangerDrawState> {
  return rangerDraw;
}

// ---------------------------------------------------------------------------
// Class router — determines which system LMB activates
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Weapon-type router — attack mechanic is per-weapon, NOT per-class
// ---------------------------------------------------------------------------

/** Melee weapons use the combo chain + timing finisher */
const COMBO_WEAPONS: Set<string> = new Set([
  "sword", "greatsword", "axe", "dagger", "hammer", "mace",
  "poleaxe", "spear", "shield", "fists",
]);

/** Magic weapons use charge-cast tiers */
const CHARGE_WEAPONS: Set<string> = new Set([
  "staff", "wand", "tome", "relic",
]);

/** Ranged weapons use aim-draw-release */
const DRAW_WEAPONS: Set<string> = new Set([
  "bow", "crossbow", "gun",
]);

/**
 * Determine which attack mechanic to activate based on WEAPON TYPE.
 * A Worge with a staff charge-casts. A Mage with a mace combos.
 * Called from Player.tsx when LMB is pressed.
 */
export function getAttackMechanic(weaponType: WeaponType | ExtendedWeaponType | string): "combo" | "charge" | "draw" {
  if (CHARGE_WEAPONS.has(weaponType)) return "charge";
  if (DRAW_WEAPONS.has(weaponType)) return "draw";
  return "combo"; // all melee + fists + unknown
}

/**
 * Whether the combo timing window should activate.
 * Returns true on the 3rd+ hit with a melee weapon when LMB is held.
 */
export function shouldActivateComboTiming(
  weaponType: WeaponType | ExtendedWeaponType | string,
  comboCount: number,
  lmbHeld: boolean,
): boolean {
  return COMBO_WEAPONS.has(weaponType) && comboCount >= 3 && lmbHeld;
}

/** Check if a weapon type uses the charge-cast system */
export function isChargeWeapon(weaponType: string): boolean {
  return CHARGE_WEAPONS.has(weaponType);
}

/** Check if a weapon type uses the draw system */
export function isDrawWeapon(weaponType: string): boolean {
  return DRAW_WEAPONS.has(weaponType);
}

/** Check if a weapon type uses the combo system */
export function isComboWeapon(weaponType: string): boolean {
  return COMBO_WEAPONS.has(weaponType);
}
