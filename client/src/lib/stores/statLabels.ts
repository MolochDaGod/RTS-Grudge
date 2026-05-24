// ── UI labels and attribute descriptions ─────────────────────────────────────

import type { PrimaryAttributes, SecondaryStats } from "./characterTypes";
import { ATTR_GAINS } from "./attributeFormulas";
import { ATTRIBUTE_ICONS } from "@/lib/data/icons";

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

function formatGain(stat: string, perPoint: number): string {
  const labelMap: Partial<Record<keyof SecondaryStats, string>> = {
    health: "Health", mana: "Mana", stamina: "Stamina", damage: "Damage", defense: "Defense",
    block: "Block %", blockEffect: "Block Effect", critChance: "Crit %", critDamage: "Crit Dmg %",
    accuracy: "Accuracy", resistance: "Resistance",
  };
  const lbl = labelMap[stat as keyof SecondaryStats] ?? stat;
  return `+${perPoint} ${lbl} / pt`;
}

// Auto-generated effect blurbs straight from ATTR_GAINS so the UI never drifts
// from the live formula.
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
