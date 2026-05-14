export type WeaponTypeId = "sword" | "axe" | "dagger" | "hammer" | "mace" | "greatsword" | "greataxe" | "greathammer" | "lance" | "bow" | "crossbow" | "gun" | "staff" | "tome" | "wand" | "focus" | "shield";
export type WeaponCategory = "Melee" | "Two-Handed" | "Ranged" | "Magic" | "Off-Hand";
export type HeroClassName = "Warrior" | "Mage" | "Ranger" | "Worge";

export interface WeaponTypeInfo {
  id: WeaponTypeId;
  name: string;
  category: WeaponCategory;
  icon: string;
}

export interface SkillAnimMapping {
  skillName: string;
  animationName: string;
  animationType: "attack" | "skill" | "buff" | "ranged" | "aoe";
  cooldown: number;
  manaCost: number;
  damage: number;
  icon: string;
}

export interface WeaponVariant {
  name: string;
  sub: string;
  lore: string;
  basic: string;
  abilities: string[];
  sig: string;
  passives: string[];
  elem?: string;
  modelId: string;
  modelPath: string;
  gripStyle: "main_1h" | "two_hand" | "ranged_2h" | "off_1h";
  attackSpeed: number;
  baseDamage: number;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  skillAnims: SkillAnimMapping[];
}

export interface MasterySkillNode {
  name: string;
  description: string;
  effect: string;
  bonus: string;
}

export interface MasteryTier {
  name: string;
  skills: MasterySkillNode[];
}

export interface MasteryTree {
  color: string;
  tiers: MasteryTier[];
}

export const WEAPON_TYPES: WeaponTypeInfo[] = [
  { id: "sword", name: "Sword", category: "Melee", icon: "\u2694\uFE0F" },
  { id: "axe", name: "Axe", category: "Melee", icon: "\uD83E\uDE93" },
  { id: "dagger", name: "Dagger", category: "Melee", icon: "\uD83D\uDDE1\uFE0F" },
  { id: "hammer", name: "Hammer (1H)", category: "Melee", icon: "\uD83D\uDD28" },
  { id: "mace", name: "Mace", category: "Melee", icon: "\u2692\uFE0F" },
  { id: "greatsword", name: "Greatsword", category: "Two-Handed", icon: "\u2694\uFE0F" },
  { id: "greataxe", name: "Greataxe", category: "Two-Handed", icon: "\uD83E\uDE93" },
  { id: "greathammer", name: "Greathammer", category: "Two-Handed", icon: "\uD83D\uDD28" },
  { id: "lance", name: "Lance / Spear", category: "Two-Handed", icon: "\uD83D\uDD31" },
  { id: "bow", name: "Bow", category: "Ranged", icon: "\uD83C\uDFF9" },
  { id: "crossbow", name: "Crossbow", category: "Ranged", icon: "\uD83C\uDFAF" },
  { id: "gun", name: "Gun", category: "Ranged", icon: "\uD83D\uDD2B" },
  { id: "staff", name: "Staff", category: "Magic", icon: "\uD83E\uDE84" },
  { id: "tome", name: "Tome", category: "Magic", icon: "\uD83D\uDCD6" },
  { id: "wand", name: "Wand", category: "Magic", icon: "\u2728" },
  { id: "focus", name: "Focus / Relic", category: "Off-Hand", icon: "\uD83D\uDD2E" },
  { id: "shield", name: "Shield", category: "Off-Hand", icon: "\uD83D\uDEE1\uFE0F" },
];

export const CLASS_WEAPONS: Record<HeroClassName, WeaponTypeId[]> = {
  Warrior: ["sword", "axe", "shield", "greatsword", "greataxe", "greathammer", "hammer", "mace"],
  Mage: ["staff", "tome", "mace", "focus", "wand"],
  Ranger: ["bow", "crossbow", "gun", "dagger", "greatsword", "lance"],
  Worge: ["staff", "lance", "dagger", "bow", "hammer", "mace", "focus"],
};

export function getClassesForWeapon(weaponId: WeaponTypeId): HeroClassName[] {
  const classes: HeroClassName[] = [];
  for (const [cls, weapons] of Object.entries(CLASS_WEAPONS)) {
    if (weapons.includes(weaponId)) classes.push(cls as HeroClassName);
  }
  return classes;
}

import { WEAPON_PREFAB_VARIANTS } from "./WeaponPrefabs";
export { getWeaponPrefab, getWeaponPrefabByName, getAllPrefabsForType, getSkillAnimForWeapon, RARITY_COLORS } from "./WeaponPrefabs";

export const WEAPON_VARIANTS: Record<WeaponTypeId, WeaponVariant[]> = WEAPON_PREFAB_VARIANTS;

export const WEAPON_MASTERY_TREES: Partial<Record<WeaponTypeId, MasteryTree>> = {
  sword: { color: "#ef4444", tiers: [
    { name: "Tier 1 \u2014 Fundamentals", skills: [
      { name: "Blade Mastery", description: "Increases sword damage by 5% per point", effect: "+5% Sword Damage", bonus: "+5% swordDamage" },
      { name: "Swift Strikes", description: "Increases attack speed with swords", effect: "+3% Attack Speed", bonus: "+3% attackSpeed" },
      { name: "Precision Cuts", description: "Increases critical strike chance", effect: "+2% Crit Chance", bonus: "+2% critChance" },
    ] },
    { name: "Tier 2 \u2014 Combat", skills: [
      { name: "Parry Mastery", description: "Increases block and parry chance", effect: "+4% Block Chance", bonus: "+4% blockChance" },
      { name: "Combo Extension", description: "Increases combo chain damage", effect: "+6% Combo Damage", bonus: "+6% comboDamage" },
      { name: "Bleeding Wounds", description: "Chance to cause bleed on hit", effect: "+3% Bleed Chance", bonus: "+3% bleedChance" },
    ] },
    { name: "Tier 3 \u2014 Mastery", skills: [
      { name: "Counter Specialist", description: "Increases counter attack damage", effect: "+10% Counter Damage", bonus: "+10% counterDamage" },
      { name: "Cleaving Blows", description: "Attacks hit additional targets", effect: "+1 Cleave Target", bonus: "+1 cleaveTargets" },
    ] },
    { name: "Tier 4 \u2014 Ultimate", skills: [
      { name: "Master Swordsman", description: "All sword stats increased", effect: "+8% All Sword Stats", bonus: "+8% allSword" },
    ] },
  ] },
  axe: { color: "#dc2626", tiers: [
    { name: "Tier 1", skills: [
      { name: "Brutal Force", description: "Increases axe damage", effect: "+6% Axe Damage", bonus: "+6%" },
      { name: "Cleave", description: "Hit additional targets", effect: "+1 Cleave", bonus: "+1" },
    ] },
    { name: "Tier 2", skills: [
      { name: "Rending Cuts", description: "Bleed chance on hit", effect: "+5% Bleed", bonus: "+5%" },
      { name: "Executioner", description: "Bonus vs low HP targets", effect: "+12% Execute", bonus: "+12%" },
    ] },
    { name: "Tier 3", skills: [
      { name: "Frenzy", description: "Speed boost on kill", effect: "+3%/Kill", bonus: "+3%" },
      { name: "Armor Break", description: "Reduce enemy armor", effect: "+8% Pen", bonus: "+8%" },
    ] },
    { name: "Tier 4", skills: [
      { name: "Berserker", description: "All axe stats increased", effect: "+8% All", bonus: "+8%" },
    ] },
  ] },
  dagger: { color: "#6b7280", tiers: [
    { name: "Tier 1", skills: [
      { name: "Quick Hands", description: "Dagger attack speed", effect: "+6% Speed", bonus: "+6%" },
      { name: "Stealth", description: "Stealth bonus", effect: "+10% Stealth", bonus: "+10%" },
    ] },
    { name: "Tier 2", skills: [
      { name: "Vital Strikes", description: "Critical hit chance", effect: "+4% Crit", bonus: "+4%" },
      { name: "Poison Coat", description: "Poison chance on hit", effect: "+5% Poison", bonus: "+5%" },
    ] },
    { name: "Tier 3", skills: [
      { name: "Backstab Mastery", description: "Bonus back damage", effect: "+15% Back", bonus: "+15%" },
      { name: "Deadly Wounds", description: "Bleed damage bonus", effect: "+10% Bleed", bonus: "+10%" },
    ] },
    { name: "Tier 4", skills: [
      { name: "Master Assassin", description: "All dagger stats", effect: "+8% All", bonus: "+8%" },
    ] },
  ] },
  hammer: { color: "#78716c", tiers: [
    { name: "Tier 1", skills: [
      { name: "Heavy Blows", description: "Hammer damage boost", effect: "+6% Damage", bonus: "+6%" },
      { name: "Concussive", description: "Stun chance on hit", effect: "+4% Stun", bonus: "+4%" },
    ] },
    { name: "Tier 2", skills: [
      { name: "Ground Slam", description: "AoE damage bonus", effect: "+8% AoE", bonus: "+8%" },
      { name: "Armor Crush", description: "Armor penetration", effect: "+6% Pen", bonus: "+6%" },
    ] },
    { name: "Tier 3", skills: [
      { name: "Knockback", description: "Knockback chance", effect: "+5% KB", bonus: "+5%" },
      { name: "Shatter", description: "Bonus vs stunned", effect: "+15% vs Stunned", bonus: "+15%" },
    ] },
    { name: "Tier 4", skills: [
      { name: "Titan", description: "All hammer stats", effect: "+8% All", bonus: "+8%" },
    ] },
  ] },
  bow: { color: "#22c55e", tiers: [
    { name: "Tier 1", skills: [
      { name: "Steady Aim", description: "Bow damage", effect: "+5% Damage", bonus: "+5%" },
      { name: "Quick Draw", description: "Draw speed", effect: "+4% Speed", bonus: "+4%" },
    ] },
    { name: "Tier 2", skills: [
      { name: "Piercing Arrows", description: "Armor penetration", effect: "+6% Pen", bonus: "+6%" },
      { name: "Wind Reading", description: "Accuracy bonus", effect: "+5% Accuracy", bonus: "+5%" },
    ] },
    { name: "Tier 3", skills: [
      { name: "Multi-Shot Mastery", description: "Extra projectiles", effect: "+1 Arrow", bonus: "+1" },
      { name: "Critical Draw", description: "Crit on full draw", effect: "+8% Crit", bonus: "+8%" },
    ] },
    { name: "Tier 4", skills: [
      { name: "Marksman", description: "All bow stats", effect: "+8% All", bonus: "+8%" },
    ] },
  ] },
  staff: { color: "#8b5cf6", tiers: [
    { name: "Tier 1", skills: [
      { name: "Arcane Flow", description: "Staff magic damage", effect: "+5% Magic", bonus: "+5%" },
      { name: "Mana Efficiency", description: "Reduced mana cost", effect: "-4% Cost", bonus: "-4%" },
    ] },
    { name: "Tier 2", skills: [
      { name: "Spell Amplification", description: "Spell power boost", effect: "+8% Power", bonus: "+8%" },
      { name: "Elemental Mastery", description: "Elemental damage", effect: "+6% Elem", bonus: "+6%" },
    ] },
    { name: "Tier 3", skills: [
      { name: "AoE Mastery", description: "Area spell bonus", effect: "+10% AoE", bonus: "+10%" },
      { name: "Spell Crit", description: "Magic crit chance", effect: "+5% Crit", bonus: "+5%" },
    ] },
    { name: "Tier 4", skills: [
      { name: "Archmage", description: "All staff stats", effect: "+8% All", bonus: "+8%" },
    ] },
  ] },
  shield: { color: "#3b82f6", tiers: [
    { name: "Tier 1", skills: [
      { name: "Shield Wall", description: "Block chance", effect: "+6% Block", bonus: "+6%" },
      { name: "Sturdy Grip", description: "Block stability", effect: "+4% Stability", bonus: "+4%" },
    ] },
    { name: "Tier 2", skills: [
      { name: "Reflect Damage", description: "Damage on block", effect: "+8% Reflect", bonus: "+8%" },
      { name: "Taunt Mastery", description: "Threat generation", effect: "+10% Threat", bonus: "+10%" },
    ] },
    { name: "Tier 3", skills: [
      { name: "Shield Bash Mastery", description: "Bash damage and stun", effect: "+12% Bash", bonus: "+12%" },
      { name: "Fortress", description: "Damage reduction", effect: "+5% DR", bonus: "+5%" },
    ] },
    { name: "Tier 4", skills: [
      { name: "Immovable", description: "All shield stats", effect: "+8% All", bonus: "+8%" },
    ] },
  ] },
};

export const MASTERY_TREE_ALIASES: Partial<Record<WeaponTypeId, WeaponTypeId>> = {
  mace: "hammer",
  greatsword: "sword",
  greataxe: "axe",
  greathammer: "hammer",
  lance: "sword",
  crossbow: "bow",
  gun: "bow",
  tome: "staff",
  wand: "staff",
  focus: "staff",
};

export function getMasteryTree(weaponId: WeaponTypeId): { tree: MasteryTree; aliased: boolean; aliasSource?: WeaponTypeId } | null {
  const direct = WEAPON_MASTERY_TREES[weaponId];
  if (direct) return { tree: direct, aliased: false };
  const alias = MASTERY_TREE_ALIASES[weaponId];
  if (alias && WEAPON_MASTERY_TREES[alias]) return { tree: WEAPON_MASTERY_TREES[alias]!, aliased: true, aliasSource: alias };
  return null;
}

export interface MasteryBonuses {
  damagePercent: number;
  attackSpeedPercent: number;
  critChanceFlat: number;
  armorPenPercent: number;
  cleaveTargets: number;
  aoeDamagePercent: number;
  bleedChancePercent: number;
  blockPercent: number;
  allStatsPercent: number;
}

export function computeMasteryBonuses(weaponId: WeaponTypeId, masteryLevels: Record<string, number>): MasteryBonuses {
  const bonuses: MasteryBonuses = {
    damagePercent: 0,
    attackSpeedPercent: 0,
    critChanceFlat: 0,
    armorPenPercent: 0,
    cleaveTargets: 0,
    aoeDamagePercent: 0,
    bleedChancePercent: 0,
    blockPercent: 0,
    allStatsPercent: 0,
  };

  const result = getMasteryTree(weaponId);
  if (!result) return bonuses;
  const { tree } = result;

  for (const tier of tree.tiers) {
    for (const skill of tier.skills) {
      const level = masteryLevels[skill.name] || 0;
      if (level <= 0) continue;

      const match = skill.bonus.match(/([+-]?\d+)%?\s*(.*)/);
      if (!match) continue;
      const val = parseFloat(match[1]) * level;
      const type = match[2].toLowerCase();

      if (type.includes("damage") || type.includes("sworddamage") || type.includes("axe") || type.includes("magic")) {
        bonuses.damagePercent += val;
      } else if (type.includes("speed") || type.includes("attackspeed")) {
        bonuses.attackSpeedPercent += val;
      } else if (type.includes("crit")) {
        bonuses.critChanceFlat += val;
      } else if (type.includes("pen")) {
        bonuses.armorPenPercent += val;
      } else if (type.includes("cleave")) {
        bonuses.cleaveTargets += val;
      } else if (type.includes("aoe")) {
        bonuses.aoeDamagePercent += val;
      } else if (type.includes("bleed")) {
        bonuses.bleedChancePercent += val;
      } else if (type.includes("block") || type.includes("stability")) {
        bonuses.blockPercent += val;
      } else if (type.includes("all")) {
        bonuses.allStatsPercent += val;
        bonuses.damagePercent += val;
        bonuses.attackSpeedPercent += val * 0.5;
        bonuses.critChanceFlat += val * 0.25;
      }
    }
  }

  return bonuses;
}
