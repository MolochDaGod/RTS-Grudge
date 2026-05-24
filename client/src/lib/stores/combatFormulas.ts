// ── Combat formulas (canonical 8-step pipeline) ──────────────────────────────

import type { SecondaryStats } from "./characterTypes";

// === Canonical defense formula (stats-guide) ===
// Damage Taken = Incoming × (100 - √Defense) / 100; √Defense is clamped to 100.
export function computeDamageReduction(defense: number, _attackerLevel: number): number {
  const sqrtDef = Math.min(100, Math.sqrt(Math.max(0, defense)));
  return sqrtDef / 100;
}

export function rollCrit(critChance: number, critDamage: number): { isCrit: boolean; multiplier: number } {
  if (Math.random() * 100 < critChance) return { isCrit: true, multiplier: critDamage / 100 };
  return { isCrit: false, multiplier: 1.0 };
}

export function rollDodge(dodgeVal: number, attackerAccuracy: number): boolean {
  const effectiveDodge = Math.max(0, dodgeVal - (100 - attackerAccuracy) * 0.5);
  return Math.random() * 100 < effectiveDodge;
}

export function rollBlock(blockVal: number): boolean {
  return Math.random() * 100 < blockVal;
}

// === Canonical 8-step combat pipeline (stats-guide) ===
//   1. Base damage              (caller-supplied)
//   2. Defense Break            (reduce target defense by attacker's defenseBreak)
//   3. Mitigation               (√defense reduction)
//   4. Random variance ±25%     (skipped — outer systems already vary)
//   5. Block roll               (block penetration reduces block; capped 90% effect)
//   6. Crit roll if not blocked (crit evasion reduces crit chance)
//   7. Apply damage             (caller subtracts from HP)
//   8. Trigger drain/reflect    (caller fires; capped 50% per stats-guide)
export function computeCombatDamage(
  baseDamage: number,
  attackerStats: SecondaryStats,
  defenderStats: SecondaryStats,
  damageType: "physical" | "magical",
  _attackerLevel: number,
): { finalDamage: number; dodged: boolean; blocked: boolean; isCrit: boolean } {
  // Dodge gate (kept as a pre-pipeline reflex roll).
  if (rollDodge(defenderStats.dodge, attackerStats.accuracy)) {
    return { finalDamage: 0, dodged: true, blocked: false, isCrit: false };
  }

  let dmg = baseDamage;

  // Step 2: defense break reduces effective defense (or resistance).
  const dbPct = Math.min(0.5, Math.max(0, attackerStats.defenseBreak - defenderStats.defenseBreakResist) / 100);
  const rawDef = damageType === "physical" ? defenderStats.defense : defenderStats.resistance;
  const apen = damageType === "physical" ? attackerStats.armorPenetration : attackerStats.armorPenetration * 0.5;
  const effectiveDef = Math.max(0, (rawDef - apen)) * (1 - dbPct);

  // Step 3: √defense mitigation per stats-guide.
  dmg *= (1 - computeDamageReduction(effectiveDef, _attackerLevel));

  // Step 5: block roll BEFORE crit. Block penetration reduces block chance.
  const effBlock = Math.max(0, defenderStats.block - attackerStats.blockPenetration);
  if (Math.random() * 100 < effBlock) {
    // Canonical blockEffect cap is 90% per master-attributes.json statCaps.
    const blockEff = Math.min(90, defenderStats.blockEffect) / 100;
    dmg *= (1 - blockEff);
    return { finalDamage: Math.max(1, Math.round(dmg)), dodged: false, blocked: true, isCrit: false };
  }

  // Step 6: crit roll (only on un-blocked hits). Crit evasion shaves crit chance.
  const effCrit = Math.max(0, attackerStats.critChance - defenderStats.critEvasion);
  const isCrit = Math.random() * 100 < effCrit;
  if (isCrit) dmg *= attackerStats.critDamage / 100;

  return { finalDamage: Math.max(1, Math.round(dmg)), dodged: false, blocked: false, isCrit };
}

// Synthesize a minimal SecondaryStats defender for an enemy.
const ENEMY_DEFENDER_TIERS: Record<string, Partial<SecondaryStats>> = {
  common:   { defense: 20,  resistance: 10,  block: 2,  blockEffect: 50, dodge: 3,  critEvasion: 1, defenseBreakResist: 0 },
  uncommon: { defense: 50,  resistance: 20,  block: 4,  blockEffect: 50, dodge: 5,  critEvasion: 2, defenseBreakResist: 5 },
  rare:     { defense: 100, resistance: 35,  block: 6,  blockEffect: 50, dodge: 7,  critEvasion: 3, defenseBreakResist: 10 },
  elite:    { defense: 200, resistance: 60,  block: 10, blockEffect: 60, dodge: 10, critEvasion: 5, defenseBreakResist: 15 },
  boss:     { defense: 400, resistance: 100, block: 15, blockEffect: 70, dodge: 12, critEvasion: 8, defenseBreakResist: 25 },
};

export function synthesizeEnemyDefender(tier: string): SecondaryStats {
  const out: any = {
    health: 0, mana: 0, stamina: 0, damage: 0, defense: 0, block: 0, blockEffect: 0,
    evasion: 0, accuracy: 0, critChance: 0, critDamage: 100, attackSpeed: 0, movementSpeed: 0,
    resistance: 0, cdrResist: 0, defenseBreakResist: 0, armorPenetration: 0, blockPenetration: 0,
    defenseBreak: 0, drainHealth: 0, manaRegen: 0, healthRegen: 0, cooldownReduction: 0,
    abilityCost: 0, spellAccuracy: 0, stagger: 0, ccResistance: 0, armor: 0, damageReduction: 0,
    bleedResist: 0, statusEffect: 0, spellblock: 0, dodge: 0, reflexTime: 0, critEvasion: 0,
    fallDamage: 0, comboCooldownRed: 0, combatPower: 0,
  };
  Object.assign(out, ENEMY_DEFENDER_TIERS[tier] ?? ENEMY_DEFENDER_TIERS.common);
  return out as SecondaryStats;
}
