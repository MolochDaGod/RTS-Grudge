// ── Attribute → Secondary-stat formulas ───────────────────────────────────────
// Mirrors client/public/data/grudge/master-attributes.json (v2.0.0).

import type { PrimaryAttributes, SecondaryStats } from "./characterTypes";

// Canonical Grudge per-point gains. The "flat" values are the per-(effective)-
// point contribution to each derived stat, before diminishing returns and the
// Tactics global multiplier are applied.
export const ATTR_GAINS: Record<keyof PrimaryAttributes, Partial<Record<keyof SecondaryStats, number>>> = {
  strength:  { health: 26, damage: 3, defense: 12, block: 0.5,  critChance: 0.32, blockEffect: 0.85, critDamage: 1.1 },
  vitality:  { health: 25, mana: 2,  stamina: 5,   damage: 2,   defense: 12,      blockEffect: 0.3, resistance: 0.5 },
  endurance: { health: 10, stamina: 1, defense: 12, block: 0.11, blockEffect: 0.27, resistance: 0.46 },
  intellect: { mana: 5,  damage: 4,  defense: 2,  critChance: 0.23, accuracy: 0.12, resistance: 0.38 },
  wisdom:    { health: 10, mana: 20, damage: 2,  defense: 2,  critChance: 0.5, resistance: 0.5 },
  dexterity: { damage: 3,  defense: 10, block: 0.41, critChance: 0.5, accuracy: 0.7 },
  agility:   { health: 2,  stamina: 5, damage: 3,  defense: 5, critChance: 0.42 },
  tactics:   { health: 10, stamina: 1, damage: 3,  defense: 5, block: 0.27 },
};

// Stats considered resources — Tactics global multiplier does NOT apply.
export const RESOURCE_STATS = new Set<keyof SecondaryStats>(["health", "mana", "stamina"]);

// Canonical Grudge stat caps from master-attributes.json `statCaps` (v2.0.0).
export const STAT_CAPS: Partial<Record<keyof SecondaryStats, number>> = {
  block: 75,
  critChance: 75,
  blockEffect: 90,
  critDamage: 300,
  accuracy: 95,
  resistance: 95,
  drainHealth: 50,
  cooldownReduction: 40,
};

// Diminishing returns table from stats-guide.html:
//   Effective Points = full(1-25) + half(26-50) + quarter(51+)
export function effectivePoints(p: number): number {
  if (p <= 0) return 0;
  if (p <= 25) return p;
  if (p <= 50) return 25 + (p - 25) * 0.5;
  return 25 + 12.5 + (p - 50) * 0.25;
}

// === Canonical secondary-stat compute ===
// Total Stat = Σ(per-point flat × effectivePoints(attribute)) + Base + level scaling
// Tactics applies a +0.5%/pt global multiplier on every non-resource stat.
export function computeSecondaryStats(attrs: PrimaryAttributes, level: number): SecondaryStats {
  const lv = Math.max(0, level - 1);

  // Base values (combat starting floor) + level scaling baked into bases.
  const base: Record<keyof SecondaryStats, number> = {
    health: 100 + lv * 12,
    mana: 50 + lv * 5,
    stamina: 100 + lv * 3,
    damage: 5 + lv * 2,
    defense: 5 + lv * 1,
    block: 5,
    blockEffect: 25,
    evasion: 0,
    accuracy: 75,
    critChance: 5,
    critDamage: 150,
    attackSpeed: 1.0 + lv * 0.005,
    movementSpeed: 1.0 + lv * 0.003,
    resistance: 5 + lv * 0.8,
    cdrResist: 0,
    defenseBreakResist: 0,
    armorPenetration: 0,
    blockPenetration: 0,
    defenseBreak: 0,
    drainHealth: 0,
    manaRegen: 1,
    healthRegen: 1,
    cooldownReduction: 0,
    abilityCost: 0,
    spellAccuracy: 75,
    stagger: 0,
    ccResistance: 0,
    armor: 0,
    damageReduction: 0,
    bleedResist: 0,
    statusEffect: 0,
    spellblock: 0,
    dodge: 0,
    reflexTime: 0,
    critEvasion: 0,
    fallDamage: 0,
    comboCooldownRed: 0,
    combatPower: 0,
  };

  const stats: Record<keyof SecondaryStats, number> = { ...base };

  // 1) Apply each attribute's per-point gains, scaled by diminishing returns.
  (Object.keys(ATTR_GAINS) as (keyof PrimaryAttributes)[]).forEach(attr => {
    const eff = effectivePoints(attrs[attr] || 0);
    if (eff <= 0) return;
    for (const [stat, perPoint] of Object.entries(ATTR_GAINS[attr])) {
      const k = stat as keyof SecondaryStats;
      stats[k] = (stats[k] || 0) + eff * (perPoint as number);
    }
  });

  // 2) Composite/derived stats NOT directly listed in canonical ATTR_GAINS.
  const a = (k: keyof PrimaryAttributes) => attrs[k] || 0;
  stats.dodge = a("agility") * 0.3 + a("dexterity") * 0.1;
  stats.evasion = stats.dodge;
  stats.armor = a("endurance") * 2 + a("vitality") * 0.5 + a("strength") * 0.3;
  stats.damageReduction = a("endurance") * 0.3 + a("vitality") * 0.1;
  stats.bleedResist = a("endurance") * 0.4 + a("vitality") * 0.15;
  stats.statusEffect = a("intellect") * 0.2 + a("tactics") * 0.15;
  stats.spellblock = a("wisdom") * 0.25 + a("intellect") * 0.1;
  stats.reflexTime = a("agility") * 0.15 + a("dexterity") * 0.1;
  stats.critEvasion = a("agility") * 0.2 + a("endurance") * 0.1;
  stats.fallDamage = Math.max(-50, -(a("agility") * 0.5 + a("endurance") * 0.2));
  stats.comboCooldownRed = a("tactics") * 0.15 + a("agility") * 0.05;
  stats.cdrResist = a("endurance") * 0.2 + a("wisdom") * 0.1;
  stats.defenseBreakResist = a("endurance") * 0.25 + a("vitality") * 0.1;
  stats.armorPenetration = a("strength") * 0.067 + a("tactics") * 0.05;
  stats.blockPenetration = a("tactics") * 0.15 + a("strength") * 0.05;
  stats.defenseBreak = a("tactics") * 0.1 + a("strength") * 0.05;
  stats.drainHealth = a("tactics") * 0.02 + a("strength") * 0.01;
  stats.manaRegen = base.manaRegen + a("wisdom") * 0.8 + a("intellect") * 0.1;
  stats.healthRegen = base.healthRegen + a("vitality") * 0.25 + a("endurance") * 0.15 + a("wisdom") * 0.1;
  stats.cooldownReduction = a("intellect") * 0.067 + a("wisdom") * 0.075 + a("tactics") * 0.03;
  stats.abilityCost = Math.max(-30, -(a("wisdom") * 0.075 + a("intellect") * 0.05));
  stats.spellAccuracy = base.spellAccuracy + a("intellect") * 0.3 + a("wisdom") * 0.1;
  stats.stagger = a("tactics") * 0.3 + a("strength") * 0.1;
  stats.ccResistance = a("endurance") * 0.25 + a("wisdom") * 0.15;

  // 3) Tactics global multiplier — +0.5%/pt on every non-resource stat.
  const tacMult = 1 + (attrs.tactics || 0) * 0.005;
  (Object.keys(stats) as (keyof SecondaryStats)[]).forEach(k => {
    if (!RESOURCE_STATS.has(k)) stats[k] = stats[k] * tacMult;
  });

  // 4) Apply canonical Grudge stat caps (master-attributes.json statCaps).
  (Object.keys(STAT_CAPS) as (keyof SecondaryStats)[]).forEach(k => {
    const cap = STAT_CAPS[k]!;
    if (stats[k] > cap) stats[k] = cap;
  });

  // 5) Round per stat type.
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const out: any = {};
  (Object.keys(stats) as (keyof SecondaryStats)[]).forEach(k => {
    if (k === "attackSpeed" || k === "movementSpeed" || k === "drainHealth") out[k] = r2(stats[k]);
    else if (RESOURCE_STATS.has(k)) out[k] = Math.round(stats[k]);
    else out[k] = r1(stats[k]);
  });

  // 5) Combat power composite (UI sort key only).
  out.combatPower = Math.round(
    out.damage * 2 + out.defense + out.health * 0.1 + out.mana * 0.05 +
    out.critChance * 3 + out.block * 2 + out.dodge * 2.5 + out.attackSpeed * 50 +
    out.armor * 0.5 + out.resistance * 0.5 + level * 10
  );

  return out as SecondaryStats;
}
