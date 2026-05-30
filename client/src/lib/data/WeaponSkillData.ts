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
      { name: "Shield Wall", description: "Block chance", effect: "+6% Block", bonus: "+6% blockChance" },
      { name: "Sturdy Grip", description: "Block stability", effect: "+4% Stability", bonus: "+4% stability" },
    ] },
    { name: "Tier 2", skills: [
      { name: "Reflect Damage", description: "Damage on block", effect: "+8% Reflect", bonus: "+8% reflectDamage" },
      { name: "Taunt Mastery", description: "Threat generation", effect: "+10% Threat", bonus: "+10% threat" },
    ] },
    { name: "Tier 3", skills: [
      { name: "Shield Bash Mastery", description: "Bash damage and stun", effect: "+12% Bash", bonus: "+12% bashDamage" },
      { name: "Fortress", description: "Damage reduction", effect: "+5% DR", bonus: "+5% damageReduction" },
    ] },
    { name: "Tier 4", skills: [
      { name: "Immovable", description: "All shield stats", effect: "+8% All", bonus: "+8% allShield" },
    ] },
  ] },

  // ═══════════════════════════════════════════════════════════════
  // UNIQUE TREES for formerly-aliased weapons
  // ═══════════════════════════════════════════════════════════════

  mace: { color: "#f59e0b", tiers: [
    { name: "Tier 1 — Devotion", skills: [
      { name: "Holy Strike", description: "Mace damage with bonus holy damage", effect: "+5% Holy Damage", bonus: "+5% holyDamage" },
      { name: "Consecrate Ground", description: "AoE holy ground on heavy attack", effect: "+4% AoE Radius", bonus: "+4% aoeDamage" },
      { name: "Templar's Resolve", description: "Reduced incoming damage after blocking", effect: "+3% DR on Block", bonus: "+3% damageReduction" },
    ] },
    { name: "Tier 2 — Crusade", skills: [
      { name: "Smite the Wicked", description: "Bonus damage vs undead and demons", effect: "+10% vs Evil", bonus: "+10% damage" },
      { name: "Heal on Smite", description: "Restore HP on critical holy strike", effect: "+3% Life per Crit", bonus: "+3% lifeLeech" },
      { name: "Zealous Fury", description: "Attack speed increases after each hit", effect: "+2% Speed/Hit", bonus: "+2% attackSpeed" },
    ] },
    { name: "Tier 3 — Judgment", skills: [
      { name: "Judgment Hammer", description: "Massive AoE stun slam", effect: "+8% Stun Duration", bonus: "+8% stunDuration" },
      { name: "Divine Armor", description: "Shield of faith absorbs damage", effect: "+6% Absorb", bonus: "+6% absorb" },
    ] },
    { name: "Tier 4 — Exalted", skills: [
      { name: "Hand of Justice", description: "All mace stats increased", effect: "+8% All", bonus: "+8% allMace" },
    ] },
  ] },

  greatsword: { color: "#b91c1c", tiers: [
    { name: "Tier 1 — Power Swings", skills: [
      { name: "Mighty Arms", description: "Greatsword damage", effect: "+6% Damage", bonus: "+6% damage" },
      { name: "Cleaving Arc", description: "Wider swing arc hits more targets", effect: "+1 Cleave", bonus: "+1 cleaveTargets" },
      { name: "Heavy Momentum", description: "Damage increases with combo chain", effect: "+4% per Combo", bonus: "+4% comboDamage" },
    ] },
    { name: "Tier 2 — Dominance", skills: [
      { name: "Sunder Armor", description: "Heavy attacks reduce enemy armor", effect: "+6% Armor Pen", bonus: "+6% armorPen" },
      { name: "Whirlwind Mastery", description: "Reduced cost for spinning attacks", effect: "-20% Whirl Cost", bonus: "-20% manaCost" },
      { name: "Staggering Blow", description: "Chance to stagger on hit", effect: "+5% Stagger", bonus: "+5% stunChance" },
    ] },
    { name: "Tier 3 — Warlord", skills: [
      { name: "Colossus Strike", description: "Empowered heavy attack damage", effect: "+12% Heavy", bonus: "+12% damage" },
      { name: "Indomitable", description: "Cannot be interrupted during attacks", effect: "Hyper Armor", bonus: "+10% hyperArmor" },
    ] },
    { name: "Tier 4 — Champion", skills: [
      { name: "Wrath Unleashed", description: "All greatsword stats", effect: "+8% All", bonus: "+8% allGreatsword" },
    ] },
  ] },

  greataxe: { color: "#991b1b", tiers: [
    { name: "Tier 1 — Savagery", skills: [
      { name: "Primal Force", description: "Raw greataxe damage", effect: "+6% Damage", bonus: "+6% damage" },
      { name: "Wild Swings", description: "Attack speed with heavy weapons", effect: "+3% Speed", bonus: "+3% attackSpeed" },
      { name: "Rending Blows", description: "Chance to cause deep bleed", effect: "+5% Bleed", bonus: "+5% bleedChance" },
    ] },
    { name: "Tier 2 — Berserker", skills: [
      { name: "Blood Rage", description: "Damage increases as HP decreases", effect: "+2% per 10% HP lost", bonus: "+2% damage" },
      { name: "Earthquake", description: "AoE ground slam bonus", effect: "+8% AoE", bonus: "+8% aoeDamage" },
      { name: "Executioner's Strike", description: "Bonus vs targets under 30% HP", effect: "+15% Execute", bonus: "+15% damage" },
    ] },
    { name: "Tier 3 — Rampage", skills: [
      { name: "Frenzy", description: "Speed and damage on kill", effect: "+5%/Kill", bonus: "+5% attackSpeed" },
      { name: "Cleave Through", description: "Attacks pierce to rear targets", effect: "+2 Pierce", bonus: "+2 cleaveTargets" },
    ] },
    { name: "Tier 4 — Cataclysm", skills: [
      { name: "Apocalyptic Might", description: "All greataxe stats", effect: "+8% All", bonus: "+8% allGreataxe" },
    ] },
  ] },

  greathammer: { color: "#57534e", tiers: [
    { name: "Tier 1 — Foundation", skills: [
      { name: "Titan's Grip", description: "Greathammer damage", effect: "+6% Damage", bonus: "+6% damage" },
      { name: "Seismic Force", description: "Ground tremor on heavy hits", effect: "+5% AoE", bonus: "+5% aoeDamage" },
      { name: "Bone Breaker", description: "Stun duration increased", effect: "+4% Stun", bonus: "+4% stunDuration" },
    ] },
    { name: "Tier 2 — Siege", skills: [
      { name: "Thunderclap", description: "AoE lightning damage on slam", effect: "+8% Lightning", bonus: "+8% damage" },
      { name: "Unbreakable", description: "Damage reduction while charging", effect: "+6% DR", bonus: "+6% damageReduction" },
      { name: "Shatter Point", description: "Destroy enemy shields/armor faster", effect: "+10% Sunder", bonus: "+10% armorPen" },
    ] },
    { name: "Tier 3 — Colossus", skills: [
      { name: "Gravity Well", description: "Heavy attacks pull enemies inward", effect: "3m Pull", bonus: "+3 pullRadius" },
      { name: "Fortress Stance", description: "Cannot be knocked back", effect: "Hyper Armor", bonus: "+10% hyperArmor" },
    ] },
    { name: "Tier 4 — World Ender", skills: [
      { name: "Cataclysmic Force", description: "All greathammer stats", effect: "+8% All", bonus: "+8% allGreathammer" },
    ] },
  ] },

  lance: { color: "#0891b2", tiers: [
    { name: "Tier 1 — Reach", skills: [
      { name: "Extended Range", description: "Lance reach increased", effect: "+10% Range", bonus: "+10% range" },
      { name: "Piercing Thrust", description: "Lance damage", effect: "+5% Damage", bonus: "+5% damage" },
      { name: "Spear Wall", description: "Bonus damage to charging enemies", effect: "+8% vs Charge", bonus: "+8% damage" },
    ] },
    { name: "Tier 2 — Cavalry", skills: [
      { name: "Mounted Charge", description: "Charge attack damage bonus", effect: "+10% Charge", bonus: "+10% damage" },
      { name: "Sweeping Arc", description: "Sweep attacks hit wider", effect: "+1 Target", bonus: "+1 cleaveTargets" },
      { name: "Impale Mastery", description: "Impale penetrates armor", effect: "+6% Pen", bonus: "+6% armorPen" },
    ] },
    { name: "Tier 3 — Vanguard", skills: [
      { name: "Dragon's Reach", description: "Extended combo range", effect: "+15% Range", bonus: "+15% range" },
      { name: "Brace for Impact", description: "Counter-charge stuns attacker", effect: "+6% Stun", bonus: "+6% stunChance" },
    ] },
    { name: "Tier 4 — Dragoon", skills: [
      { name: "Legendary Lancier", description: "All lance stats", effect: "+8% All", bonus: "+8% allLance" },
    ] },
  ] },

  crossbow: { color: "#65a30d", tiers: [
    { name: "Tier 1 — Mechanics", skills: [
      { name: "Quick Reload", description: "Crossbow reload speed", effect: "+6% Reload", bonus: "+6% attackSpeed" },
      { name: "Bolt Damage", description: "Base bolt damage", effect: "+5% Damage", bonus: "+5% damage" },
      { name: "Steady Brace", description: "Accuracy while aiming", effect: "+4% Accuracy", bonus: "+4% accuracy" },
    ] },
    { name: "Tier 2 — Engineering", skills: [
      { name: "Penetrating Bolts", description: "Bolts pierce through targets", effect: "+1 Pierce", bonus: "+1 pierce" },
      { name: "Explosive Tips", description: "AoE on bolt impact", effect: "+6% AoE", bonus: "+6% aoeDamage" },
      { name: "Poison Bolts", description: "Chance to apply poison", effect: "+5% Poison", bonus: "+5% poisonChance" },
    ] },
    { name: "Tier 3 — Siege", skills: [
      { name: "Rapid Fire", description: "Burst fire mode unlocked", effect: "+3 Burst", bonus: "+3 burstCount" },
      { name: "Armor Piercing", description: "Ignores percentage of armor", effect: "+8% Pen", bonus: "+8% armorPen" },
    ] },
    { name: "Tier 4 — Sharpshooter", skills: [
      { name: "Sniper's Precision", description: "All crossbow stats", effect: "+8% All", bonus: "+8% allCrossbow" },
    ] },
  ] },

  gun: { color: "#4b5563", tiers: [
    { name: "Tier 1 — Marksmanship", skills: [
      { name: "Steady Hand", description: "Gun accuracy", effect: "+5% Accuracy", bonus: "+5% accuracy" },
      { name: "Powder Charge", description: "Gun damage", effect: "+6% Damage", bonus: "+6% damage" },
      { name: "Quick Draw", description: "Swap and fire speed", effect: "+4% Speed", bonus: "+4% attackSpeed" },
    ] },
    { name: "Tier 2 — Gunslinger", skills: [
      { name: "Fan the Hammer", description: "Rapid sequential shots", effect: "+2 Shots", bonus: "+2 burstCount" },
      { name: "Incendiary Rounds", description: "Burn chance on hit", effect: "+5% Burn", bonus: "+5% burnChance" },
      { name: "Ricochet", description: "Bullets bounce to nearby targets", effect: "+1 Bounce", bonus: "+1 bounce" },
    ] },
    { name: "Tier 3 — Deadeye", skills: [
      { name: "Headshot", description: "Critical hit damage bonus", effect: "+15% Crit Damage", bonus: "+15% critDamage" },
      { name: "Suppressive Fire", description: "Slows enemies hit", effect: "+8% Slow", bonus: "+8% slowChance" },
    ] },
    { name: "Tier 4 — Ace", skills: [
      { name: "One Shot, One Kill", description: "All gun stats", effect: "+8% All", bonus: "+8% allGun" },
    ] },
  ] },

  tome: { color: "#7c3aed", tiers: [
    { name: "Tier 1 — Scholarship", skills: [
      { name: "Arcane Knowledge", description: "Tome spell power", effect: "+5% Spell Power", bonus: "+5% spellPower" },
      { name: "Page Turner", description: "Cast speed with tomes", effect: "+4% Cast Speed", bonus: "+4% attackSpeed" },
      { name: "Ink Siphon", description: "Mana regeneration while holding tome", effect: "+3% Mana Regen", bonus: "+3% manaRegen" },
    ] },
    { name: "Tier 2 — Lore", skills: [
      { name: "Forbidden Text", description: "Shadow damage bonus from tome", effect: "+8% Shadow", bonus: "+8% shadowDamage" },
      { name: "Summoning Rites", description: "Summon duration increased", effect: "+6% Duration", bonus: "+6% summonDuration" },
      { name: "Scroll Mastery", description: "Reduced mana cost for tome spells", effect: "-5% Cost", bonus: "-5% manaCost" },
    ] },
    { name: "Tier 3 — Grimoire", skills: [
      { name: "Eldritch Burst", description: "AoE spell damage", effect: "+10% AoE", bonus: "+10% aoeDamage" },
      { name: "Soul Link", description: "Life leech on spell hits", effect: "+4% Leech", bonus: "+4% lifeLeech" },
    ] },
    { name: "Tier 4 — Grand Arcanist", skills: [
      { name: "Infinite Pages", description: "All tome stats", effect: "+8% All", bonus: "+8% allTome" },
    ] },
  ] },

  wand: { color: "#a855f7", tiers: [
    { name: "Tier 1 — Channeling", skills: [
      { name: "Spark Mastery", description: "Wand projectile damage", effect: "+5% Damage", bonus: "+5% damage" },
      { name: "Rapid Casting", description: "Wand attack speed", effect: "+6% Speed", bonus: "+6% attackSpeed" },
      { name: "Mana Flow", description: "Reduced mana cost", effect: "-4% Cost", bonus: "-4% manaCost" },
    ] },
    { name: "Tier 2 — Enchantment", skills: [
      { name: "Chain Lightning", description: "Wand bolts chain to nearby targets", effect: "+1 Chain", bonus: "+1 chainTargets" },
      { name: "Elemental Infusion", description: "Wand attacks gain element", effect: "+6% Elem", bonus: "+6% elementalDamage" },
      { name: "Spell Penetration", description: "Magic resistance penetration", effect: "+5% Magic Pen", bonus: "+5% magicPen" },
    ] },
    { name: "Tier 3 — Sorcery", skills: [
      { name: "Arcane Barrage", description: "Multi-bolt burst attack", effect: "+3 Bolts", bonus: "+3 burstCount" },
      { name: "Spell Crit", description: "Magic crit chance", effect: "+5% Crit", bonus: "+5% critChance" },
    ] },
    { name: "Tier 4 — Arcane Lord", skills: [
      { name: "Wand Supremacy", description: "All wand stats", effect: "+8% All", bonus: "+8% allWand" },
    ] },
  ] },

  focus: { color: "#c026d3", tiers: [
    { name: "Tier 1 — Attunement", skills: [
      { name: "Mystic Focus", description: "Spell power from focus", effect: "+5% Spell Power", bonus: "+5% spellPower" },
      { name: "Mana Shield", description: "Absorb damage with mana", effect: "+4% Absorb", bonus: "+4% absorb" },
      { name: "Relic Resonance", description: "Buff duration extended", effect: "+6% Duration", bonus: "+6% buffDuration" },
    ] },
    { name: "Tier 2 — Empowerment", skills: [
      { name: "Healing Touch", description: "Focus heals increased", effect: "+8% Heal Power", bonus: "+8% healPower" },
      { name: "Protective Ward", description: "Shield allies in radius", effect: "+5% Shield", bonus: "+5% shieldPower" },
      { name: "Spirit Link", description: "Share damage with summons", effect: "+6% Link", bonus: "+6% summonLink" },
    ] },
    { name: "Tier 3 — Transcendence", skills: [
      { name: "Overcharge", description: "Next spell deals 2x damage", effect: "+100% Next", bonus: "+100% nextSpell" },
      { name: "Cooldown Reset", description: "Chance to reset spell cooldowns", effect: "+4% Reset", bonus: "+4% cooldownReset" },
    ] },
    { name: "Tier 4 — Mystic Master", skills: [
      { name: "Eternal Focus", description: "All focus stats", effect: "+8% All", bonus: "+8% allFocus" },
    ] },
  ] },
};

// Every weapon now has its own mastery tree — no aliases.
export const MASTERY_TREE_ALIASES: Partial<Record<WeaponTypeId, WeaponTypeId>> = {};

export function getMasteryTree(weaponId: WeaponTypeId): { tree: MasteryTree; aliased: boolean; aliasSource?: WeaponTypeId } | null {
  const direct = WEAPON_MASTERY_TREES[weaponId];
  if (direct) return { tree: direct, aliased: false };
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
