// ── Shared character type definitions ─────────────────────────────────────────
// Extracted from useCharacterStats.ts — canonical types used across the
// entire Grudge Warlords game.

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

export interface HeroDefinition {
  characterId: string;
  name: string;
  heroClass: HeroClass;
  race: HeroRace;
  baseAttributes: PrimaryAttributes;
  lore: string;
  beastFormModelId?: string;
}
