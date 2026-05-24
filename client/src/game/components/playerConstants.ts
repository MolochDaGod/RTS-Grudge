// ── Player constants ─────────────────────────────────────────────────────────
// Extracted from Player.tsx to reduce file size.

import type { WeaponType } from "@/lib/stores/useGame";

export const ATTACK_RANGE = 4;
export const JUMP_FORCE = 9;
export const DOUBLE_JUMP_FORCE = 7;
export const DASH_SPEED = 18;
export const SHORYUKEN_LIFT = 10;
export const EARTHQUAKE_SLAM = -15;
export const LAUNCH_LIFT = 8;
export const UPPERCUT_LIFT = 8;
export const RISING_SLASH_LIFT = 7;
export const BASE_PLAYER_RADIUS = 0.5;
export const PLAYER_MASS = 5;

// `farming` is included so the wheelbarrow_idle / wheelbarrow_walk clips are
// loaded for the beached-boat push pose.
export const PLAYER_EXTRA_PACKS: string[] = ["gestures_basic", "farming"];

// Valid WeaponType values from useGame, used to gate animation-pack loading.
export const VALID_WEAPON_TYPES = new Set<WeaponType>([
  "sword", "greatsword", "staff", "wand", "bow", "axe", "poleaxe",
  "hammer", "dagger", "shield", "fists", "crossbow", "gun",
]);

export function resolveEquippedWeaponType(equippedTypeRaw: string | undefined): WeaponType {
  if (equippedTypeRaw && VALID_WEAPON_TYPES.has(equippedTypeRaw as WeaponType)) {
    return equippedTypeRaw as WeaponType;
  }
  return "fists";
}

export const AOE_STATES = new Set(["earthquake", "spinSlash", "skill1", "skill3", "skill5", "classAbility", "classAbility2", "classAbility3"]);
export const CLEAVE_STATES = new Set(["attack1", "attack2", "attack3", "heavyAttack", "counterStrike", "dashAttack", "risingSlash", "chargeAttack", "chargeAttackMax", "chargeFist", "chargeStrike"]);

export const TRAIL_SWING_STATES = new Set([
  "attack1", "attack2", "attack3",
  "heavyAttack", "counterStrike", "spinSlash", "risingSlash", "dashAttack",
  "chargeAttack", "chargeAttackMax", "chargeFist", "chargeStrike",
]);
export const MAX_CLEAVE = 3;

export const BUFFERABLE_EVENTS = new Set(["LMB", "RMB_DOWN", "DASH", "ROLL", "JUMP", "KEY_1", "KEY_2", "KEY_3", "KEY_4", "KEY_5", "CLASS_ABILITY", "CLASS_ABILITY_2", "CLASS_ABILITY_3"]);

export const ACTIVE_COMBAT_STATES = new Set([
  "attack1", "attack2", "attack3", "heavyAttack", "dashAttack",
  "spinSlash", "counterStrike", "risingSlash", "uppercut", "jumpBash",
  "earthquake", "skill1", "skill2", "skill3", "skill4", "skill5",
  "classAbility", "classAbility2", "classAbility3", "rolling", "pop",
  "chargeAttack", "chargeAttackMax", "chargeFist", "chargeStrike",
]);

export const CHARGE_HOLD_STATES = new Set(["charging", "charged1", "charged2"]);

export const ACTION_STATES = new Set([
  "attack1", "attack2", "attack3",
  "dashAttack",
  "skill1", "skill2", "skill3", "skill4", "skill5",
  "classAbility", "classAbility2", "classAbility3", "rolling",
  "pop", "earthquake", "jumpBash",
  "blocking",
  "uppercut", "spinSlash", "counterStrike",
  "risingSlash", "heavyAttack",
  "chargeAttack", "chargeAttackMax", "chargeFist", "chargeStrike",
]);
