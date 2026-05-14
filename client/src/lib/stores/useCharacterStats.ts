import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type HeroClass = "warrior" | "mage" | "worge" | "ranger";
export type HeroRace = "human" | "elf" | "dwarf" | "orc" | "barbarian" | "undead";

export interface PrimaryAttributes {
  strength: number;
  vitality: number;
  endurance: number;
  intellect: number;
  wisdom: number;
  dexterity: number;
  agility: number;
  tactics: number;
}

export interface SecondaryStats {
  health: number;
  mana: number;
  stamina: number;
  damage: number;
  defense: number;
  block: number;
  blockEffect: number;
  evasion: number;
  accuracy: number;
  critChance: number;
  critDamage: number;
  attackSpeed: number;
  movementSpeed: number;
  resistance: number;
  cdrResist: number;
  defenseBreakResist: number;
  armorPenetration: number;
  blockPenetration: number;
  defenseBreak: number;
  drainHealth: number;
  manaRegen: number;
  healthRegen: number;
  cooldownReduction: number;
  abilityCost: number;
  spellAccuracy: number;
  stagger: number;
  ccResistance: number;
  armor: number;
  damageReduction: number;
  bleedResist: number;
  statusEffect: number;
  spellblock: number;
  dodge: number;
  reflexTime: number;
  critEvasion: number;
  fallDamage: number;
  comboCooldownRed: number;
  combatPower: number;
}

export interface SkillNode {
  id: string;
  name: string;
  icon: string;
  description: string;
  maxRank: number;
  currentRank: number;
  requires: string[];
  effects: SkillEffect[];
  category: "class" | "weapon" | "custom";
}

export interface SkillEffect {
  stat?: keyof SecondaryStats;
  type: "flat" | "percent" | "special";
  value: number;
  specialId?: string;
}

export interface HeroStatBlock {
  characterId: string;
  heroClass: HeroClass;
  level: number;
  experience: number;
  experienceToNext: number;
  attributePointsSpent: number;
  attributePointsMax: number;
  attributes: PrimaryAttributes;
  baseAttributes: PrimaryAttributes;
  skillPoints: number;
  skillPointsTotal: number;
  skills: Record<string, number>;
}

export const CDN = "https://molochdagod.github.io/ObjectStore";

import { ATTRIBUTE_ICONS, getRacePortrait, getClassIcon, type IconRace } from "@/lib/data/icons";

export const RACE_BONUSES: Record<HeroRace, { label: string; bonus: string; icon: string; bonuses: Partial<PrimaryAttributes>; iconUrl: string }> = {
  human: { label: "Human", bonus: "+10% EXP gain", icon: "👤", bonuses: { tactics: 2, wisdom: 1 }, iconUrl: getRacePortrait("human") },
  elf: { label: "Elf", bonus: "+Mana regeneration", icon: "🧝", bonuses: { intellect: 2, agility: 1 }, iconUrl: getRacePortrait("elf") },
  dwarf: { label: "Dwarf", bonus: "+Mining efficiency", icon: "⛏️", bonuses: { endurance: 2, vitality: 1 }, iconUrl: getRacePortrait("dwarf") },
  orc: { label: "Orc", bonus: "+Melee damage", icon: "👹", bonuses: { strength: 2, vitality: 1 }, iconUrl: getRacePortrait("orc") },
  barbarian: { label: "Barbarian", bonus: "+HP regeneration", icon: "🪓", bonuses: { agility: 2, dexterity: 1 }, iconUrl: getRacePortrait("barbarian") },
  undead: { label: "Undead", bonus: "+Shadow resistance", icon: "💀", bonuses: { intellect: 1, endurance: 1, tactics: 1 }, iconUrl: getRacePortrait("undead") },
};

export const ATTRIBUTE_ICON_BASE = "/icons/grudge/attributes";

// Local fallback: if the primary attribute PNG fails to load, retry the
// same path. (Kept so existing `onError` consumers still compile.)
export const ATTRIBUTE_ICON_ALTS: Record<keyof PrimaryAttributes, string> = {
  strength: ATTRIBUTE_ICONS.strength,
  intellect: ATTRIBUTE_ICONS.intellect,
  vitality: ATTRIBUTE_ICONS.vitality,
  dexterity: ATTRIBUTE_ICONS.dexterity,
  endurance: ATTRIBUTE_ICONS.endurance,
  wisdom: ATTRIBUTE_ICONS.wisdom,
  agility: ATTRIBUTE_ICONS.agility,
  tactics: ATTRIBUTE_ICONS.tactics,
};

// === Canonical Grudge per-point gains ===
// Mirrors client/public/data/grudge/master-attributes.json (v2.0.0). The "flat"
// values are the per-(effective)-point contribution to each derived stat,
// before diminishing returns and the Tactics global multiplier are applied.
const ATTR_GAINS: Record<keyof PrimaryAttributes, Partial<Record<keyof SecondaryStats, number>>> = {
  strength:  { health: 26, damage: 3, defense: 12, block: 0.5,  critChance: 0.32, blockEffect: 0.85, critDamage: 1.1 },
  vitality:  { health: 25, mana: 2,  stamina: 5,   damage: 2,   defense: 12,      blockEffect: 0.3, resistance: 0.5 },
  endurance: { health: 10, stamina: 1, defense: 12, block: 0.11, blockEffect: 0.27, resistance: 0.46 },
  intellect: { mana: 5,  damage: 4,  defense: 2,  critChance: 0.23, accuracy: 0.12, resistance: 0.38 },
  wisdom:    { health: 10, mana: 20, damage: 2,  defense: 2,  critChance: 0.5, resistance: 0.5 },
  dexterity: { damage: 3,  defense: 10, block: 0.41, critChance: 0.5, accuracy: 0.7 },
  agility:   { health: 2,  stamina: 5, damage: 3,  defense: 5, critChance: 0.42 },
  tactics:   { health: 10, stamina: 1, damage: 3,  defense: 5, block: 0.27 },
};

// Diminishing returns table from stats-guide.html:
//   Effective Points = full(1-25) + half(26-50) + quarter(51+)
function effectivePoints(p: number): number {
  if (p <= 0) return 0;
  if (p <= 25) return p;
  if (p <= 50) return 25 + (p - 25) * 0.5;
  return 25 + 12.5 + (p - 50) * 0.25;
}

// Stats considered resources — Tactics global multiplier does NOT apply.
const RESOURCE_STATS = new Set<keyof SecondaryStats>(["health", "mana", "stamina"]);

// Canonical Grudge stat caps from master-attributes.json `statCaps` (v2.0.0).
// Values are stored as percentages (0-100) here because all derived stats in
// SecondaryStats use that scale (e.g. block: 75 = 75%). critDamage uses %.
const STAT_CAPS: Partial<Record<keyof SecondaryStats, number>> = {
  block: 75,
  critChance: 75,
  blockEffect: 90,
  critDamage: 300,
  accuracy: 95,
  resistance: 95,
  drainHealth: 50,
  cooldownReduction: 40,
};

// Auto-generated effect blurbs straight from ATTR_GAINS so the UI never drifts
// from the live formula. Order matches per-point yield (descending).
function formatGain(stat: string, perPoint: number): string {
  const labelMap: Partial<Record<keyof SecondaryStats, string>> = {
    health: "Health", mana: "Mana", stamina: "Stamina", damage: "Damage", defense: "Defense",
    block: "Block %", blockEffect: "Block Effect", critChance: "Crit %", critDamage: "Crit Dmg %",
    accuracy: "Accuracy", resistance: "Resistance",
  };
  const lbl = labelMap[stat as keyof SecondaryStats] ?? stat;
  return `+${perPoint} ${lbl} / pt`;
}

const ATTR_DESCRIPTIONS: Record<keyof PrimaryAttributes, string> = {
  strength: "Tank / Melee DPS — health, raw damage, defense, and block power.",
  vitality: "Tank / Survivability — high health, supplemental defense and resistance.",
  endurance: "Defensive Specialist — stacks defense, block, and resistance.",
  intellect: "Mage / Caster — mana, spell damage, accuracy, resistance.",
  wisdom: "Healer / Support — mana, mana efficiency, crit, resistance.",
  dexterity: "Rogue / Precision — damage, accuracy, crit, block.",
  agility: "Mobile DPS / Dodge Tank — damage, stamina, crit chance.",
  tactics: "Strategic Commander — damage, defense, plus a global +0.5%/pt multiplier on non-resource stats.",
};

export const ATTRIBUTE_EFFECTS: Record<keyof PrimaryAttributes, { label: string; description: string; effects: string[]; iconUrl: string }> =
  (Object.keys(ATTR_GAINS) as (keyof PrimaryAttributes)[]).reduce((acc, attr) => {
    const gains = ATTR_GAINS[attr];
    const effects = Object.entries(gains)
      .filter(([, v]) => v && v > 0)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 4)
      .map(([s, v]) => formatGain(s, v as number));
    acc[attr] = {
      label: attr.charAt(0).toUpperCase() + attr.slice(1),
      description: ATTR_DESCRIPTIONS[attr],
      iconUrl: `${ATTRIBUTE_ICON_BASE}/${attr}.png`,
      effects,
    };
    return acc;
  }, {} as Record<keyof PrimaryAttributes, { label: string; description: string; effects: string[]; iconUrl: string }>);

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
  //    Computed from raw attributes BEFORE the Tactics multiplier so the
  //    multiplier sweeps everything in a single pass (no overwriting).
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
  //    Single sweep, applied AFTER all gains and composites are summed.
  //    Tactics is never soft-capped in this multiplier role (per stats-guide).
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

// Synthesize a minimal SecondaryStats defender for an enemy. Enemies don't
// have full canonical attributes — only HP/damage/tier — so we map the tier
// (and HP scale as a soft-level proxy) to defense/block/dodge/etc. so the
// canonical pipeline produces a believable mitigation curve. Tuned so that
// the stats-guide √defense table reads sensibly:
//   common 20  →  ~4.5% mit
//   rare   100 →  10%  mit
//   elite  200 →  ~14% mit
//   boss   400 →  20%  mit
const ENEMY_DEFENDER_TIERS: Record<string, Partial<SecondaryStats>> = {
  common:   { defense: 20,  resistance: 10,  block: 2,  blockEffect: 50, dodge: 3,  critEvasion: 1, defenseBreakResist: 0 },
  uncommon: { defense: 50,  resistance: 20,  block: 4,  blockEffect: 50, dodge: 5,  critEvasion: 2, defenseBreakResist: 5 },
  rare:     { defense: 100, resistance: 35,  block: 6,  blockEffect: 50, dodge: 7,  critEvasion: 3, defenseBreakResist: 10 },
  elite:    { defense: 200, resistance: 60,  block: 10, blockEffect: 60, dodge: 10, critEvasion: 5, defenseBreakResist: 15 },
  boss:     { defense: 400, resistance: 100, block: 15, blockEffect: 70, dodge: 12, critEvasion: 8, defenseBreakResist: 25 },
};

export function synthesizeEnemyDefender(tier: string): SecondaryStats {
  // Start from a zeroed SecondaryStats shape, then overlay tier defenders.
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

export const CLASS_SKILL_TREES: Record<HeroClass, SkillNode[]> = {
  warrior: [
    { id: "w_invincibility", name: "Invincibility", icon: "🛡️", description: "Temporary invulnerability: 1-4 seconds of complete damage immunity. Duration scales with rank.", maxRank: 4, currentRank: 0, requires: [], effects: [{ type: "special", value: 1, specialId: "invincibility" }], category: "class" },
    { id: "w_taunt", name: "Taunt", icon: "📢", description: "Force enemies to target you. Generates massive threat.", maxRank: 3, currentRank: 0, requires: [], effects: [{ stat: "stagger", type: "percent", value: 30 }], category: "class" },
    { id: "w_quick_strike", name: "Quick Strike", icon: "⚔️", description: "Fast attack with speed bonus. +15% attack speed per rank.", maxRank: 3, currentRank: 0, requires: [], effects: [{ stat: "attackSpeed", type: "percent", value: 15 }], category: "class" },
    { id: "w_damage_surge", name: "Damage Surge", icon: "💥", description: "Temporary damage boost. +25% damage for 5 seconds.", maxRank: 3, currentRank: 0, requires: ["w_quick_strike"], effects: [{ stat: "damage", type: "percent", value: 25 }], category: "class" },
    { id: "w_guardians_aura", name: "Guardian's Aura", icon: "🔰", description: "Defense buff for nearby allies. +15% party defense per rank.", maxRank: 3, currentRank: 0, requires: ["w_taunt"], effects: [{ stat: "defense", type: "percent", value: 15 }], category: "class" },
    { id: "w_dual_wield", name: "Dual Wield", icon: "⚔️", description: "Enables dual wielding. +30% attack speed, multi-hit chance.", maxRank: 1, currentRank: 0, requires: ["w_damage_surge"], effects: [{ stat: "attackSpeed", type: "percent", value: 30 }, { type: "special", value: 1, specialId: "dual_wield" }], category: "class" },
    { id: "w_shield_spec", name: "Shield Specialist", icon: "🛡️", description: "Master shield techniques. +20% block chance per rank.", maxRank: 3, currentRank: 0, requires: ["w_guardians_aura"], effects: [{ stat: "block", type: "flat", value: 20 }], category: "class" },
    { id: "w_life_drain", name: "Life Drain", icon: "❤️", description: "Attacks heal you for 10% of damage dealt per rank.", maxRank: 2, currentRank: 0, requires: ["w_quick_strike"], effects: [{ stat: "drainHealth", type: "flat", value: 10 }], category: "class" },
    { id: "w_execute", name: "Execute", icon: "💀", description: "Bonus damage vs low health enemies. +50% damage below 30% HP.", maxRank: 1, currentRank: 0, requires: ["w_dual_wield"], effects: [{ type: "special", value: 50, specialId: "execute" }], category: "class" },
    { id: "w_double_strike", name: "Double Strike", icon: "⚡", description: "Two consecutive attacks in rapid succession.", maxRank: 2, currentRank: 0, requires: ["w_life_drain"], effects: [{ type: "special", value: 1, specialId: "double_strike" }], category: "class" },
    { id: "w_avatar", name: "Avatar Form", icon: "⭐", description: "Ultimate transformation. All stats boost + size increase.", maxRank: 1, currentRank: 0, requires: ["w_execute"], effects: [{ stat: "damage", type: "percent", value: 40 }, { stat: "defense", type: "percent", value: 40 }, { stat: "health", type: "percent", value: 30 }, { type: "special", value: 1, specialId: "avatar_form" }], category: "class" },
    { id: "w_counter", name: "Perfect Counter", icon: "🔄", description: "30% chance to counter-attack on successful block.", maxRank: 1, currentRank: 0, requires: ["w_shield_spec"], effects: [{ type: "special", value: 30, specialId: "perfect_counter" }], category: "class" },
  ],

  mage: [
    { id: "mp_fireball", name: "Fireball", icon: "🔥", description: "Hurl a bolt of fire dealing magic damage. Scales with Intelligence.", maxRank: 3, currentRank: 0, requires: [], effects: [{ stat: "damage", type: "percent", value: 20 }], category: "class" },
    { id: "mp_heal", name: "Divine Heal", icon: "💚", description: "Restore HP to self or ally. Heals more per rank.", maxRank: 3, currentRank: 0, requires: [], effects: [{ stat: "healthRegen", type: "flat", value: 5 }], category: "class" },
    { id: "mp_barrier", name: "Arcane Barrier", icon: "🔮", description: "Create a magic shield absorbing damage. Scales with Wisdom.", maxRank: 3, currentRank: 0, requires: [], effects: [{ stat: "resistance", type: "percent", value: 20 }], category: "class" },
    { id: "mp_chain_lightning", name: "Chain Lightning", icon: "⚡", description: "Lightning arcs between enemies. Hits +1 target per rank.", maxRank: 3, currentRank: 0, requires: ["mp_fireball"], effects: [{ stat: "damage", type: "percent", value: 15 }, { type: "special", value: 1, specialId: "chain_lightning" }], category: "class" },
    { id: "mp_blessing", name: "Holy Blessing", icon: "✨", description: "Buff party with +10% all stats per rank for 15 seconds.", maxRank: 3, currentRank: 0, requires: ["mp_heal"], effects: [{ type: "special", value: 10, specialId: "holy_blessing" }], category: "class" },
    { id: "mp_meteor", name: "Meteor Strike", icon: "☄️", description: "Call down a meteor dealing massive AoE damage.", maxRank: 1, currentRank: 0, requires: ["mp_chain_lightning"], effects: [{ stat: "damage", type: "percent", value: 50 }, { type: "special", value: 1, specialId: "meteor_strike" }], category: "class" },
    { id: "mp_resurrect", name: "Resurrect", icon: "🕊️", description: "Revive a fallen ally with 50% HP. 120s cooldown.", maxRank: 1, currentRank: 0, requires: ["mp_blessing"], effects: [{ type: "special", value: 1, specialId: "resurrect" }], category: "class" },
    { id: "mp_mana_shield", name: "Mana Shield", icon: "💠", description: "Damage is absorbed by MP instead of HP. 2:1 ratio per rank.", maxRank: 2, currentRank: 0, requires: ["mp_barrier"], effects: [{ type: "special", value: 1, specialId: "mana_shield" }], category: "class" },
    { id: "mp_smite", name: "Holy Smite", icon: "⚔️", description: "+35% damage to undead and demons per rank.", maxRank: 2, currentRank: 0, requires: ["mp_heal"], effects: [{ type: "special", value: 35, specialId: "holy_smite" }], category: "class" },
    { id: "mp_arcane_mastery", name: "Arcane Mastery", icon: "📖", description: "+15% cooldown reduction and +20% spell vamp.", maxRank: 2, currentRank: 0, requires: ["mp_meteor"], effects: [{ stat: "cooldownReduction", type: "flat", value: 15 }, { stat: "cooldownReduction", type: "flat", value: 20 }], category: "class" },
    { id: "mp_divine_form", name: "Divine Form", icon: "👼", description: "Ultimate: Become an avatar of light. +60% magic damage, immune to CC, party heals passively.", maxRank: 1, currentRank: 0, requires: ["mp_arcane_mastery", "mp_resurrect"], effects: [{ stat: "damage", type: "percent", value: 60 }, { type: "special", value: 1, specialId: "divine_form" }], category: "class" },
    { id: "mp_dispel", name: "Dispel", icon: "🌀", description: "Remove all debuffs from self or ally, or remove buffs from enemy.", maxRank: 1, currentRank: 0, requires: ["mp_mana_shield"], effects: [{ type: "special", value: 1, specialId: "dispel" }], category: "class" },
  ],

  worge: [
    { id: "wg_feral_strike", name: "Feral Strike", icon: "🐾", description: "Savage claw attack. +20% physical damage per rank.", maxRank: 3, currentRank: 0, requires: [], effects: [{ stat: "damage", type: "percent", value: 20 }], category: "class" },
    { id: "wg_howl", name: "War Howl", icon: "🐺", description: "Buff party attack speed by 10% and intimidate enemies.", maxRank: 3, currentRank: 0, requires: [], effects: [{ stat: "attackSpeed", type: "percent", value: 10 }, { type: "special", value: 1, specialId: "war_howl" }], category: "class" },
    { id: "wg_thick_hide", name: "Thick Hide", icon: "🦴", description: "Passive defense boost. +15% defense per rank.", maxRank: 3, currentRank: 0, requires: [], effects: [{ stat: "defense", type: "percent", value: 15 }], category: "class" },
    { id: "wg_beast_form", name: "Beast Form", icon: "🦈", description: "Transform into beast form (Shark Warrior). +30% damage, +20% speed, new attack moveset.", maxRank: 1, currentRank: 0, requires: ["wg_feral_strike"], effects: [{ stat: "damage", type: "percent", value: 30 }, { stat: "movementSpeed", type: "percent", value: 20 }, { type: "special", value: 1, specialId: "beast_form" }], category: "class" },
    { id: "wg_regen", name: "Nature's Regeneration", icon: "🌿", description: "Passive HP regen. +5 HP/s per rank.", maxRank: 3, currentRank: 0, requires: ["wg_thick_hide"], effects: [{ stat: "healthRegen", type: "flat", value: 5 }], category: "class" },
    { id: "wg_pack_leader", name: "Pack Leader", icon: "👑", description: "Summon 2 wolf allies per rank. They fight alongside you.", maxRank: 2, currentRank: 0, requires: ["wg_howl"], effects: [{ type: "special", value: 2, specialId: "pack_leader" }], category: "class" },
    { id: "wg_frenzy", name: "Blood Frenzy", icon: "🩸", description: "Below 30% HP: +50% damage, +25% attack speed.", maxRank: 2, currentRank: 0, requires: ["wg_beast_form"], effects: [{ type: "special", value: 1, specialId: "blood_frenzy" }], category: "class" },
    { id: "wg_pounce", name: "Pounce", icon: "💨", description: "Leap to target dealing damage and stunning for 1.5s.", maxRank: 2, currentRank: 0, requires: ["wg_feral_strike"], effects: [{ type: "special", value: 1, specialId: "pounce" }], category: "class" },
    { id: "wg_predator", name: "Apex Predator", icon: "🔱", description: "+25% crit chance and +50% crit damage while in beast form.", maxRank: 1, currentRank: 0, requires: ["wg_frenzy"], effects: [{ stat: "critChance", type: "flat", value: 25 }, { stat: "critDamage", type: "flat", value: 50 }], category: "class" },
    { id: "wg_devour", name: "Devour", icon: "😈", description: "Bite attack that heals for 25% of damage dealt.", maxRank: 2, currentRank: 0, requires: ["wg_regen"], effects: [{ stat: "drainHealth", type: "flat", value: 25 }], category: "class" },
    { id: "wg_alpha", name: "Alpha Worg", icon: "🐺", description: "Ultimate: Permanent beast form. All beast bonuses doubled. Pack wolves become dire wolves.", maxRank: 1, currentRank: 0, requires: ["wg_predator", "wg_pack_leader"], effects: [{ type: "special", value: 1, specialId: "alpha_worg" }], category: "class" },
    { id: "wg_savage_roar", name: "Savage Roar", icon: "💀", description: "AoE fear. Enemies flee for 3 seconds. -20% enemy defense.", maxRank: 1, currentRank: 0, requires: ["wg_devour"], effects: [{ type: "special", value: 1, specialId: "savage_roar" }], category: "class" },
  ],

  ranger: [
    { id: "r_precise_shot", name: "Precise Shot", icon: "🎯", description: "Aimed shot with +20% accuracy and damage per rank.", maxRank: 3, currentRank: 0, requires: [], effects: [{ stat: "accuracy", type: "flat", value: 10 }, { stat: "damage", type: "percent", value: 15 }], category: "class" },
    { id: "r_evasion", name: "Evasion", icon: "💨", description: "Passive dodge chance. +8% per rank.", maxRank: 3, currentRank: 0, requires: [], effects: [{ stat: "dodge", type: "flat", value: 8 }], category: "class" },
    { id: "r_trap", name: "Bear Trap", icon: "🪤", description: "Place a trap that roots and damages enemies for 3s.", maxRank: 3, currentRank: 0, requires: [], effects: [{ type: "special", value: 1, specialId: "bear_trap" }], category: "class" },
    { id: "r_multi_shot", name: "Multi-Shot", icon: "🏹", description: "Fire 3 arrows in a spread. +1 arrow per rank.", maxRank: 3, currentRank: 0, requires: ["r_precise_shot"], effects: [{ type: "special", value: 3, specialId: "multi_shot" }], category: "class" },
    { id: "r_stealth", name: "Shadow Step", icon: "👤", description: "Enter stealth for 5 seconds. First attack from stealth deals +50% damage.", maxRank: 2, currentRank: 0, requires: ["r_evasion"], effects: [{ type: "special", value: 1, specialId: "stealth" }], category: "class" },
    { id: "r_poison_arrow", name: "Poison Arrow", icon: "☠️", description: "Arrows apply poison DoT. 5 damage/s for 6s per rank.", maxRank: 2, currentRank: 0, requires: ["r_precise_shot"], effects: [{ type: "special", value: 5, specialId: "poison_arrow" }], category: "class" },
    { id: "r_rain_of_arrows", name: "Rain of Arrows", icon: "🌧️", description: "AoE barrage covering a large area for 3 seconds.", maxRank: 1, currentRank: 0, requires: ["r_multi_shot"], effects: [{ type: "special", value: 1, specialId: "rain_of_arrows" }], category: "class" },
    { id: "r_explosive_trap", name: "Explosive Trap", icon: "💣", description: "Upgraded trap that deals AoE damage and knocks back.", maxRank: 2, currentRank: 0, requires: ["r_trap"], effects: [{ type: "special", value: 1, specialId: "explosive_trap" }], category: "class" },
    { id: "r_headshot", name: "Headshot", icon: "💀", description: "+100% crit damage on ranged attacks.", maxRank: 1, currentRank: 0, requires: ["r_rain_of_arrows"], effects: [{ stat: "critDamage", type: "flat", value: 100 }], category: "class" },
    { id: "r_assassinate", name: "Assassinate", icon: "🗡️", description: "Stealth attack with guaranteed crit and +75% damage.", maxRank: 2, currentRank: 0, requires: ["r_stealth"], effects: [{ type: "special", value: 1, specialId: "assassinate" }], category: "class" },
    { id: "r_phantom", name: "Phantom Archer", icon: "👻", description: "Ultimate: Become ethereal. +50% dodge, attacks pass through walls, infinite stealth.", maxRank: 1, currentRank: 0, requires: ["r_headshot", "r_assassinate"], effects: [{ stat: "dodge", type: "flat", value: 50 }, { type: "special", value: 1, specialId: "phantom_archer" }], category: "class" },
    { id: "r_mark", name: "Hunter's Mark", icon: "🔍", description: "Mark a target. Marked enemies take +30% damage from all sources.", maxRank: 1, currentRank: 0, requires: ["r_explosive_trap"], effects: [{ type: "special", value: 30, specialId: "hunters_mark" }], category: "class" },
  ],
};

export const WEAPON_MASTERY_NODES: SkillNode[] = [
  { id: "wm_sword", name: "Sword Mastery", icon: "\u2694\uFE0F", description: "+5% sword damage per rank.", maxRank: 5, currentRank: 0, requires: [], effects: [{ stat: "damage", type: "percent", value: 5 }], category: "weapon" },
  { id: "wm_bow", name: "Bow Mastery", icon: "\uD83C\uDFF9", description: "+5% bow damage and +3% accuracy per rank.", maxRank: 5, currentRank: 0, requires: [], effects: [{ stat: "damage", type: "percent", value: 5 }, { stat: "accuracy", type: "flat", value: 3 }], category: "weapon" },
  { id: "wm_staff", name: "Staff Mastery", icon: "\uD83E\uDE84", description: "+5% magic damage and +2% cooldown reduction per rank.", maxRank: 5, currentRank: 0, requires: [], effects: [{ stat: "damage", type: "percent", value: 5 }, { stat: "cooldownReduction", type: "flat", value: 2 }], category: "weapon" },
  { id: "wm_dagger", name: "Dagger Mastery", icon: "\uD83D\uDDE1\uFE0F", description: "+3% crit chance and +10% crit damage per rank.", maxRank: 5, currentRank: 0, requires: [], effects: [{ stat: "critChance", type: "flat", value: 3 }, { stat: "critDamage", type: "flat", value: 10 }], category: "weapon" },
  { id: "wm_axe", name: "Axe Mastery", icon: "\uD83E\uDE93", description: "+5% physical damage and +2% armor penetration per rank.", maxRank: 5, currentRank: 0, requires: [], effects: [{ stat: "damage", type: "percent", value: 5 }, { stat: "armorPenetration", type: "flat", value: 2 }], category: "weapon" },
  { id: "wm_hammer", name: "Hammer Mastery", icon: "\uD83D\uDD28", description: "+5% physical damage and +3% block chance per rank.", maxRank: 5, currentRank: 0, requires: [], effects: [{ stat: "damage", type: "percent", value: 5 }, { stat: "block", type: "flat", value: 3 }], category: "weapon" },
  { id: "wm_mace", name: "Mace Mastery", icon: "\u2692\uFE0F", description: "+4% physical damage and +3% stun chance per rank.", maxRank: 5, currentRank: 0, requires: [], effects: [{ stat: "damage", type: "percent", value: 4 }, { stat: "block", type: "flat", value: 3 }], category: "weapon" },
  { id: "wm_greatsword", name: "Greatsword Mastery", icon: "\u2694\uFE0F", description: "+6% physical damage and +3% cleave per rank.", maxRank: 5, currentRank: 0, requires: ["wm_sword"], effects: [{ stat: "damage", type: "percent", value: 6 }], category: "weapon" },
  { id: "wm_greataxe", name: "Greataxe Mastery", icon: "\uD83E\uDE93", description: "+6% physical damage and +3% bleed per rank.", maxRank: 5, currentRank: 0, requires: ["wm_axe"], effects: [{ stat: "damage", type: "percent", value: 6 }], category: "weapon" },
  { id: "wm_greathammer", name: "Greathammer Mastery", icon: "\uD83D\uDD28", description: "+6% physical damage and +4% stun per rank.", maxRank: 5, currentRank: 0, requires: ["wm_hammer"], effects: [{ stat: "damage", type: "percent", value: 6 }], category: "weapon" },
  { id: "wm_lance", name: "Lance Mastery", icon: "\uD83D\uDD31", description: "+5% physical damage and +3% penetration per rank.", maxRank: 5, currentRank: 0, requires: [], effects: [{ stat: "damage", type: "percent", value: 5 }, { stat: "armorPenetration", type: "flat", value: 3 }], category: "weapon" },
  { id: "wm_crossbow", name: "Crossbow Mastery", icon: "\uD83C\uDFAF", description: "+5% ranged damage and +3% crit per rank.", maxRank: 5, currentRank: 0, requires: ["wm_bow"], effects: [{ stat: "damage", type: "percent", value: 5 }, { stat: "critChance", type: "flat", value: 3 }], category: "weapon" },
  { id: "wm_gun", name: "Gun Mastery", icon: "\uD83D\uDD2B", description: "+5% ranged damage and +4% accuracy per rank.", maxRank: 5, currentRank: 0, requires: ["wm_bow"], effects: [{ stat: "damage", type: "percent", value: 5 }, { stat: "accuracy", type: "flat", value: 4 }], category: "weapon" },
  { id: "wm_tome", name: "Tome Mastery", icon: "\uD83D\uDCD6", description: "+5% magic damage and +3% spell crit per rank.", maxRank: 5, currentRank: 0, requires: ["wm_staff"], effects: [{ stat: "damage", type: "percent", value: 5 }, { stat: "critChance", type: "flat", value: 3 }], category: "weapon" },
  { id: "wm_wand", name: "Wand Mastery", icon: "\u2728", description: "+4% magic damage and +3% cast speed per rank.", maxRank: 5, currentRank: 0, requires: ["wm_staff"], effects: [{ stat: "damage", type: "percent", value: 4 }, { stat: "cooldownReduction", type: "flat", value: 3 }], category: "weapon" },
  { id: "wm_focus", name: "Focus Mastery", icon: "\uD83D\uDD2E", description: "+4% magic damage and +4% mana regen per rank.", maxRank: 5, currentRank: 0, requires: [], effects: [{ stat: "damage", type: "percent", value: 4 }, { stat: "manaRegen", type: "flat", value: 4 }], category: "weapon" },
  { id: "wm_shield", name: "Shield Mastery", icon: "\uD83D\uDEE1\uFE0F", description: "+5% block chance and +3% defense per rank.", maxRank: 5, currentRank: 0, requires: [], effects: [{ stat: "block", type: "flat", value: 5 }, { stat: "defense", type: "percent", value: 3 }], category: "weapon" },
];

export interface HeroDefinition {
  characterId: string;
  name: string;
  heroClass: HeroClass;
  race: HeroRace;
  baseAttributes: PrimaryAttributes;
  lore: string;
  beastFormModelId?: string;
}

export const HERO_DEFINITIONS: HeroDefinition[] = [
  { characterId: "knight", name: "Knight", heroClass: "warrior", race: "human",
    baseAttributes: { strength: 14, vitality: 14, endurance: 8, intellect: 3, wisdom: 4, dexterity: 6, agility: 4, tactics: 5 },
    lore: "Stalwart defender. Heavy plate armor, trained in sword and shield." },
  { characterId: "golden_knight", name: "Golden Knight", heroClass: "warrior", race: "human",
    baseAttributes: { strength: 16, vitality: 16, endurance: 10, intellect: 2, wisdom: 3, dexterity: 4, agility: 3, tactics: 4 },
    lore: "Elite royal guard. Gold-plated armor, unyielding discipline." },
  { characterId: "soldier", name: "Soldier", heroClass: "warrior", race: "human",
    baseAttributes: { strength: 12, vitality: 12, endurance: 6, intellect: 3, wisdom: 4, dexterity: 8, agility: 6, tactics: 7 },
    lore: "Versatile frontliner. Chainmail and adaptability." },
  { characterId: "blue_soldier", name: "Blue Soldier", heroClass: "warrior", race: "human",
    baseAttributes: { strength: 13, vitality: 13, endurance: 7, intellect: 4, wisdom: 5, dexterity: 7, agility: 5, tactics: 4 },
    lore: "Royal guard corps. Blue tabard, sworn protector of the crown." },
  { characterId: "viking", name: "Viking", heroClass: "warrior", race: "barbarian",
    baseAttributes: { strength: 18, vitality: 14, endurance: 8, intellect: 2, wisdom: 2, dexterity: 6, agility: 4, tactics: 4 },
    lore: "Ferocious norse raider. Raw strength and berserker fury." },
  { characterId: "pirate", name: "Pirate", heroClass: "ranger", race: "human",
    baseAttributes: { strength: 8, vitality: 6, endurance: 4, intellect: 4, wisdom: 4, dexterity: 14, agility: 10, tactics: 8 },
    lore: "Sea-hardened swashbuckler. Quick blade, sharp eye, favored by fortune." },
  { characterId: "cowboy", name: "Cowboy", heroClass: "ranger", race: "human",
    baseAttributes: { strength: 6, vitality: 6, endurance: 4, intellect: 3, wisdom: 4, dexterity: 16, agility: 10, tactics: 9 },
    lore: "Dead-eye gunslinger. Fastest draw in any land." },
  { characterId: "ninja", name: "Ninja", heroClass: "ranger", race: "human",
    baseAttributes: { strength: 6, vitality: 5, endurance: 4, intellect: 5, wisdom: 3, dexterity: 14, agility: 16, tactics: 5 },
    lore: "Shadow assassin. Speed and precision over brute force." },
  { characterId: "ninja_sand", name: "Sand Ninja", heroClass: "ranger", race: "human",
    baseAttributes: { strength: 6, vitality: 5, endurance: 4, intellect: 8, wisdom: 5, dexterity: 12, agility: 12, tactics: 6 },
    lore: "Desert wind warrior. Combines stealth with sand magic." },
  { characterId: "wizard", name: "Wizard", heroClass: "mage", race: "elf",
    baseAttributes: { strength: 2, vitality: 4, endurance: 3, intellect: 18, wisdom: 14, dexterity: 5, agility: 4, tactics: 8 },
    lore: "Arcane master. Decades of study unlocked devastating spell power." },
  { characterId: "witch", name: "Witch", heroClass: "mage", race: "elf",
    baseAttributes: { strength: 2, vitality: 4, endurance: 3, intellect: 16, wisdom: 14, dexterity: 6, agility: 5, tactics: 8 },
    lore: "Dark sorceress. Curses, hexes, and forbidden magic." },
  { characterId: "elf", name: "Elf", heroClass: "ranger", race: "elf",
    baseAttributes: { strength: 5, vitality: 5, endurance: 4, intellect: 7, wisdom: 10, dexterity: 14, agility: 10, tactics: 3 },
    lore: "Woodland guardian. Unmatched archery and nature attunement." },
  { characterId: "worker", name: "Worker", heroClass: "warrior", race: "dwarf",
    baseAttributes: { strength: 14, vitality: 16, endurance: 10, intellect: 2, wisdom: 3, dexterity: 6, agility: 4, tactics: 3 },
    lore: "Hardened laborer turned fighter. Incredible stamina and toughness." },
  { characterId: "goblin", name: "Goblin", heroClass: "ranger", race: "orc",
    baseAttributes: { strength: 4, vitality: 5, endurance: 3, intellect: 5, wisdom: 2, dexterity: 14, agility: 14, tactics: 11 },
    lore: "Small, vicious, and impossibly lucky. Stabs first, asks never." },
  { characterId: "zombie_m", name: "Zombie", heroClass: "worge", race: "undead",
    baseAttributes: { strength: 14, vitality: 18, endurance: 12, intellect: 2, wisdom: 2, dexterity: 3, agility: 3, tactics: 4 },
    lore: "Undead brute. Relentless, feels no pain, regenerates from wounds.",
    beastFormModelId: "raptor" },
  { characterId: "zombie_f", name: "Zombie Queen", heroClass: "mage", race: "undead",
    baseAttributes: { strength: 3, vitality: 8, endurance: 6, intellect: 16, wisdom: 12, dexterity: 5, agility: 4, tactics: 4 },
    lore: "Cursed ruler. Commands dark magic and legions of undead." },
  { characterId: "adventurer", name: "Adventurer", heroClass: "warrior", race: "human",
    baseAttributes: { strength: 10, vitality: 10, endurance: 6, intellect: 5, wisdom: 5, dexterity: 8, agility: 7, tactics: 7 },
    lore: "Jack of all trades. Seasoned dungeon crawler, adaptable fighter." },
  { characterId: "animated_base", name: "Base Character", heroClass: "warrior", race: "human",
    baseAttributes: { strength: 8, vitality: 8, endurance: 6, intellect: 8, wisdom: 5, dexterity: 8, agility: 8, tactics: 7 },
    lore: "Universal template. Balanced in every way, master of none." },
  { characterId: "animated_human", name: "Human", heroClass: "warrior", race: "human",
    baseAttributes: { strength: 10, vitality: 10, endurance: 6, intellect: 6, wisdom: 5, dexterity: 8, agility: 7, tactics: 6 },
    lore: "Standard human fighter. Reliable, determined, and trainable." },
  { characterId: "animated_wizard", name: "Arcane Wizard", heroClass: "mage", race: "elf",
    baseAttributes: { strength: 2, vitality: 3, endurance: 2, intellect: 20, wisdom: 16, dexterity: 5, agility: 4, tactics: 6 },
    lore: "Supreme arcanist. Raw magic power rivals the gods." },
  { characterId: "animated_woman", name: "Warrior Woman", heroClass: "warrior", race: "human",
    baseAttributes: { strength: 10, vitality: 8, endurance: 5, intellect: 3, wisdom: 4, dexterity: 12, agility: 10, tactics: 6 },
    lore: "Fierce blade dancer. Speed and strength in equal measure." },
  { characterId: "animated_zombie", name: "Risen Dead", heroClass: "worge", race: "undead",
    baseAttributes: { strength: 12, vitality: 20, endurance: 10, intellect: 2, wisdom: 2, dexterity: 3, agility: 3, tactics: 6 },
    lore: "Reanimated horror. Shambling tank with supernatural resilience.",
    beastFormModelId: "raptor" },
  { characterId: "anne", name: "Anne", heroClass: "ranger", race: "human",
    baseAttributes: { strength: 6, vitality: 5, endurance: 3, intellect: 3, wisdom: 3, dexterity: 16, agility: 14, tactics: 8 },
    lore: "Lightning-fast ranger. Dual daggers, evasion specialist." },
  { characterId: "barbarian_glad", name: "Barbarian Gladiator", heroClass: "worge", race: "barbarian",
    baseAttributes: { strength: 20, vitality: 14, endurance: 8, intellect: 2, wisdom: 2, dexterity: 6, agility: 4, tactics: 2 },
    lore: "Arena champion. Primal rage and beast-like ferocity.",
    beastFormModelId: "raptor" },
  { characterId: "berserker", name: "Berserker", heroClass: "worge", race: "barbarian",
    baseAttributes: { strength: 18, vitality: 12, endurance: 6, intellect: 2, wisdom: 2, dexterity: 8, agility: 6, tactics: 4 },
    lore: "Rage-fueled berserker. Crosses the line between man and beast.",
    beastFormModelId: "raptor" },
  { characterId: "racalvin", name: "Racalvin", heroClass: "warrior", race: "human",
    baseAttributes: { strength: 12, vitality: 8, endurance: 6, intellect: 5, wisdom: 4, dexterity: 10, agility: 8, tactics: 5 },
    lore: "Master of six weapon styles. Versatile combat virtuoso." },
  { characterId: "human_base_mesh", name: "Human Base (Equipped)", heroClass: "warrior", race: "human",
    baseAttributes: { strength: 8, vitality: 8, endurance: 6, intellect: 8, wisdom: 5, dexterity: 8, agility: 8, tactics: 7 },
    lore: "Customizable template. Equipment defines the warrior." },
  { characterId: "hero", name: "Hero", heroClass: "warrior", race: "human",
    baseAttributes: { strength: 10, vitality: 10, endurance: 7, intellect: 7, wisdom: 6, dexterity: 8, agility: 8, tactics: 6 },
    lore: "Custom-forged champion. A blank slate shaped by choice and will." },
];

const LEVEL_XP_TABLE = [0, 100, 250, 500, 850, 1300, 1900, 2700, 3700, 5000,
  6500, 8300, 10500, 13100, 16200, 19800, 24000, 28900, 34500, 41000,
  48500, 57000, 66500, 77200, 89200, 102500, 117500, 134200, 152800, 173500];

export function xpForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level <= 30) return LEVEL_XP_TABLE[level - 1] || 0;
  return Math.round(173500 + (level - 30) * 25000 * Math.pow(1.1, level - 30));
}

// Canonical Grudge: 20 starting points + 7 per level, capped at 160
// (cap reached at level 21). Source: stats-guide.html "Per Level / Max Points".
export function attributePointsForLevel(level: number): number {
  return Math.min(160, 20 + Math.max(0, level - 1) * 7);
}

export function skillPointsForLevel(level: number): number {
  return Math.max(0, level - 1) + Math.floor(level / 5);
}

function getHeroDefinition(characterId: string): HeroDefinition | undefined {
  return HERO_DEFINITIONS.find(h => h.characterId === characterId);
}

interface CharacterStatsState {
  heroes: Record<string, HeroStatBlock>;

  initHero: (characterId: string) => void;
  allocateAttribute: (characterId: string, attr: keyof PrimaryAttributes, points: number) => void;
  resetAttributes: (characterId: string) => void;
  randomizeAttributes: (characterId: string) => void;
  learnSkill: (characterId: string, skillId: string) => boolean;
  resetSkills: (characterId: string) => void;
  addExperience: (characterId: string, amount: number) => void;
  getSecondaryStats: (characterId: string) => SecondaryStats | null;
  getSkillTree: (characterId: string) => SkillNode[];
  getHeroClass: (characterId: string) => HeroClass | null;
  getHero: (characterId: string) => HeroStatBlock | null;
  hasSpecial: (characterId: string, specialId: string) => boolean;
  getSpecialRank: (characterId: string, specialId: string) => number;
}

export const useCharacterStats = create<CharacterStatsState>()(
  subscribeWithSelector((set, get) => ({
    heroes: {},

    initHero: (characterId: string) => {
      const def = getHeroDefinition(characterId);
      if (!def) return;
      const existing = get().heroes[characterId];
      if (existing) return;

      const level = 1;
      const hero: HeroStatBlock = {
        characterId,
        heroClass: def.heroClass,
        level,
        experience: 0,
        experienceToNext: xpForLevel(level + 1),
        attributePointsSpent: 0,
        attributePointsMax: attributePointsForLevel(level),
        attributes: { ...def.baseAttributes },
        baseAttributes: { ...def.baseAttributes },
        skillPoints: skillPointsForLevel(level),
        skillPointsTotal: skillPointsForLevel(level),
        skills: {},
      };

      set(state => ({ heroes: { ...state.heroes, [characterId]: hero } }));
    },

    allocateAttribute: (characterId, attr, points) => {
      set(state => {
        const hero = state.heroes[characterId];
        if (!hero) return state;
        const remaining = hero.attributePointsMax - hero.attributePointsSpent;
        const toAdd = Math.min(points, remaining);
        if (toAdd <= 0) return state;

        return {
          heroes: {
            ...state.heroes,
            [characterId]: {
              ...hero,
              attributes: { ...hero.attributes, [attr]: hero.attributes[attr] + toAdd },
              attributePointsSpent: hero.attributePointsSpent + toAdd,
            },
          },
        };
      });
    },

    resetAttributes: (characterId) => {
      set(state => {
        const hero = state.heroes[characterId];
        if (!hero) return state;
        return {
          heroes: {
            ...state.heroes,
            [characterId]: {
              ...hero,
              attributes: { ...hero.baseAttributes },
              attributePointsSpent: 0,
            },
          },
        };
      });
    },

    randomizeAttributes: (characterId) => {
      set(state => {
        const hero = state.heroes[characterId];
        if (!hero) return state;
        const remaining = hero.attributePointsMax - hero.attributePointsSpent;
        const attrs = { ...hero.attributes };
        const keys: (keyof PrimaryAttributes)[] = ["strength", "vitality", "endurance", "intellect", "wisdom", "dexterity", "agility", "tactics"];
        let left = remaining;
        for (let i = 0; i < left; i++) {
          const key = keys[Math.floor(Math.random() * keys.length)];
          attrs[key]++;
        }
        return {
          heroes: {
            ...state.heroes,
            [characterId]: {
              ...hero,
              attributes: attrs,
              attributePointsSpent: hero.attributePointsMax,
            },
          },
        };
      });
    },

    learnSkill: (characterId, skillId) => {
      const state = get();
      const hero = state.heroes[characterId];
      if (!hero || hero.skillPoints <= 0) return false;

      const tree = get().getSkillTree(characterId);
      const node = tree.find(n => n.id === skillId);
      if (!node) return false;

      const currentRank = hero.skills[skillId] || 0;
      if (currentRank >= node.maxRank) return false;

      for (const req of node.requires) {
        const reqNode = tree.find(n => n.id === req);
        if (!reqNode) return false;
        const reqRank = hero.skills[req] || 0;
        if (reqRank < 1) return false;
      }

      set(s => ({
        heroes: {
          ...s.heroes,
          [characterId]: {
            ...hero,
            skills: { ...hero.skills, [skillId]: currentRank + 1 },
            skillPoints: hero.skillPoints - 1,
          },
        },
      }));
      return true;
    },

    resetSkills: (characterId) => {
      set(state => {
        const hero = state.heroes[characterId];
        if (!hero) return state;
        return {
          heroes: {
            ...state.heroes,
            [characterId]: {
              ...hero,
              skills: {},
              skillPoints: hero.skillPointsTotal,
            },
          },
        };
      });
    },

    addExperience: (characterId, amount) => {
      set(state => {
        const hero = state.heroes[characterId];
        if (!hero) return state;
        let newXP = hero.experience + amount;
        let newLevel = hero.level;
        let nextXP = hero.experienceToNext;

        while (newXP >= nextXP && newLevel < 50) {
          newXP -= nextXP;
          newLevel++;
          nextXP = xpForLevel(newLevel + 1);
        }

        const newAttrMax = attributePointsForLevel(newLevel);
        const newSkillTotal = skillPointsForLevel(newLevel);
        const skillGain = newSkillTotal - hero.skillPointsTotal;

        return {
          heroes: {
            ...state.heroes,
            [characterId]: {
              ...hero,
              experience: newXP,
              level: newLevel,
              experienceToNext: nextXP,
              attributePointsMax: newAttrMax,
              skillPoints: hero.skillPoints + skillGain,
              skillPointsTotal: newSkillTotal,
            },
          },
        };
      });
    },

    getSecondaryStats: (characterId) => {
      const hero = get().heroes[characterId];
      if (!hero) return null;

      const def = getHeroDefinition(characterId);
      const raceKey = def?.race;
      const effectiveAttrs = { ...hero.attributes };
      if (raceKey && RACE_BONUSES[raceKey]?.bonuses) {
        for (const [attr, bonus] of Object.entries(RACE_BONUSES[raceKey].bonuses)) {
          effectiveAttrs[attr as keyof PrimaryAttributes] += bonus as number;
        }
      }

      const base = computeSecondaryStats(effectiveAttrs, hero.level);

      const tree = get().getSkillTree(characterId);
      for (const node of tree) {
        const rank = hero.skills[node.id] || 0;
        if (rank <= 0) continue;
        for (const eff of node.effects) {
          if (!eff.stat) continue;
          if (eff.type === "flat") {
            (base[eff.stat] as number) += eff.value * rank;
          } else if (eff.type === "percent") {
            (base[eff.stat] as number) *= 1 + (eff.value * rank) / 100;
          }
        }
      }

      base.combatPower = Math.round(
        base.damage * 2 + base.defense + base.health * 0.1 + base.mana * 0.05 +
        base.critChance * 3 + base.block * 2 + base.dodge * 2.5 +
        base.attackSpeed * 50 + base.armor * 0.5 + base.resistance * 0.5 + hero.level * 10
      );

      return base;
    },

    getSkillTree: (characterId) => {
      const hero = get().heroes[characterId];
      if (!hero) return [];
      const classTree = CLASS_SKILL_TREES[hero.heroClass] || [];
      return [...classTree, ...WEAPON_MASTERY_NODES].map(node => ({
        ...node,
        currentRank: hero.skills[node.id] || 0,
      }));
    },

    getHeroClass: (characterId) => {
      const def = getHeroDefinition(characterId);
      return def?.heroClass ?? null;
    },

    getHero: (characterId) => {
      return get().heroes[characterId] || null;
    },

    hasSpecial: (characterId, specialId) => {
      const hero = get().heroes[characterId];
      if (!hero) return false;
      const tree = get().getSkillTree(characterId);
      for (const node of tree) {
        const rank = hero.skills[node.id] || 0;
        if (rank <= 0) continue;
        for (const eff of node.effects) {
          if (eff.specialId === specialId) return true;
        }
      }
      return false;
    },

    getSpecialRank: (characterId, specialId) => {
      const hero = get().heroes[characterId];
      if (!hero) return 0;
      const tree = get().getSkillTree(characterId);
      for (const node of tree) {
        const rank = hero.skills[node.id] || 0;
        if (rank <= 0) continue;
        for (const eff of node.effects) {
          if (eff.specialId === specialId) return rank;
        }
      }
      return 0;
    },
  }))
);

export const SECONDARY_STAT_LABELS: Record<keyof SecondaryStats, { label: string; format: string; description: string; category: string }> = {
  health: { label: "Health", format: "int", description: "Total health points", category: "core" },
  mana: { label: "Mana", format: "int", description: "Total mana for abilities", category: "core" },
  stamina: { label: "Stamina", format: "int", description: "Stamina for sprinting/dodging", category: "core" },
  damage: { label: "Damage", format: "1dp", description: "Base attack damage", category: "offense" },
  defense: { label: "Defense", format: "1dp", description: "Reduces physical damage taken", category: "defense" },
  block: { label: "Block", format: "pct", description: "Chance to block incoming attacks", category: "defense" },
  blockEffect: { label: "Block Effect", format: "pct", description: "Damage reduction when blocking", category: "defense" },
  evasion: { label: "Evasion", format: "pct", description: "Chance to evade attacks", category: "defense" },
  accuracy: { label: "Accuracy", format: "pct", description: "Hit chance, counters enemy dodge", category: "offense" },
  critChance: { label: "Crit Chance", format: "pct", description: "Chance to deal critical damage", category: "offense" },
  critDamage: { label: "Crit Damage", format: "pct", description: "Bonus damage on critical hit", category: "offense" },
  attackSpeed: { label: "Attack Speed", format: "2dp", description: "Attacks per second multiplier", category: "offense" },
  movementSpeed: { label: "Move Speed", format: "2dp", description: "Movement speed multiplier", category: "utility" },
  resistance: { label: "Resistance", format: "1dp", description: "Reduces magic/elemental damage", category: "defense" },
  cdrResist: { label: "CDR Resist", format: "pct", description: "Resist enemy cooldown manipulation", category: "defense" },
  defenseBreakResist: { label: "Def Break Resist", format: "pct", description: "Resist defense reduction effects", category: "defense" },
  armorPenetration: { label: "Armor Pen", format: "pct", description: "Ignores enemy armor", category: "offense" },
  blockPenetration: { label: "Block Pen", format: "pct", description: "Ignores enemy block chance", category: "offense" },
  defenseBreak: { label: "Defense Break", format: "pct", description: "Reduces enemy defense", category: "offense" },
  drainHealth: { label: "Drain Health", format: "pct", description: "Damage returned as HP", category: "utility" },
  manaRegen: { label: "Mana Regen", format: "1dp", description: "Mana restored per second", category: "utility" },
  healthRegen: { label: "HP Regen", format: "1dp", description: "Health restored per second", category: "utility" },
  cooldownReduction: { label: "CDR", format: "pct", description: "Reduces ability cooldowns", category: "utility" },
  abilityCost: { label: "Ability Cost", format: "pct", description: "Mana cost reduction", category: "utility" },
  spellAccuracy: { label: "Spell Accuracy", format: "pct", description: "Spell hit chance", category: "offense" },
  stagger: { label: "Stagger", format: "pct", description: "Chance to stagger enemies", category: "offense" },
  ccResistance: { label: "CC Resistance", format: "pct", description: "Resist crowd control effects", category: "defense" },
  armor: { label: "Armor", format: "1dp", description: "Flat damage reduction from armor", category: "defense" },
  damageReduction: { label: "Damage Reduction", format: "pct", description: "% damage reduction", category: "defense" },
  bleedResist: { label: "Bleed Resist", format: "pct", description: "Resist bleed damage", category: "defense" },
  statusEffect: { label: "Status Effect", format: "pct", description: "Chance to apply status effects", category: "offense" },
  spellblock: { label: "Spellblock", format: "pct", description: "Chance to block spells", category: "defense" },
  dodge: { label: "Dodge", format: "pct", description: "Chance to completely avoid attacks", category: "defense" },
  reflexTime: { label: "Reflex Time", format: "pct", description: "Reaction speed bonus", category: "utility" },
  critEvasion: { label: "Crit Evasion", format: "pct", description: "Chance to negate critical hits", category: "defense" },
  fallDamage: { label: "Fall Damage", format: "pct", description: "Fall damage reduction", category: "utility" },
  comboCooldownRed: { label: "Combo CDR", format: "pct", description: "Combo ability cooldown reduction", category: "utility" },
  combatPower: { label: "Combat Power", format: "int", description: "Overall combat rating", category: "core" },
};

export const CLASS_LABELS: Record<HeroClass, { label: string; icon: string; iconUrl: string; description: string; color: string }> = {
  warrior: { label: "Warrior", icon: "⚔️", iconUrl: getClassIcon("warrior"), description: "Frontline tank and damage dealer. Masters of melee combat, blocking, and party defense.", color: "#cc3333" },
  mage: { label: "Mage Priest", icon: "🔮", iconUrl: getClassIcon("mage"), description: "Arcane spellcaster and divine healer. Masters of magic damage, barriers, and restoration.", color: "#6633cc" },
  worge: { label: "Worg", icon: "🐺", iconUrl: getClassIcon("worge"), description: "Primal shapeshifter. Beast transformation, regeneration, and savage ferocity.", color: "#33aa33" },
  ranger: { label: "Ranger", icon: "🏹", iconUrl: getClassIcon("ranger"), description: "Precision striker and shadow operative. Archery, stealth, traps, and critical hits.", color: "#cc9933" },
};
