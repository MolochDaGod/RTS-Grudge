/**
 * Grudge Warlords — Canonical Profession System
 * Source of truth: info.grudge-studio.com/profession-trees.html
 *
 * 5 Crafting Professions + 6 Harvesting Skills = 11 total
 * Max profession level: 100 | T1-T8 resource tiers
 *
 * Nodes are simple — a rock is a rock, a tree is a tree. No node tiers.
 * Your profession level determines what tier of material drops:
 *   - Mining level 1  → T1 Copper Ore
 *   - Mining level 35 → T4 Mithril Ore
 *   - Mining level 95 → T8 Divine Ore
 * There’s always a chance (8-25%) to get one tier above your base.
 * Furnace/Refinery converts: 3 lower → 1 higher, or 1 higher → 3 lower.
 */

// ── Profession IDs ──────────────────────────────────────────────────────────

export type CraftingProfessionId = 'miner' | 'forester' | 'chef' | 'engineer' | 'mystic';
export type HarvestingSkillId = 'mining' | 'woodcutting' | 'skinning' | 'fishing' | 'herbalism' | 'foraging';
export type ProfessionId = CraftingProfessionId | HarvestingSkillId;

export const MAX_PROFESSION_LEVEL = 100;

// ── Profession Tier Milestones ──────────────────────────────────────────────

export interface ProfessionTier {
  level: number;
  name: string;
  xpRequired: number;
}

export const PROFESSION_TIERS: ProfessionTier[] = [
  { level: 1,   name: 'Novice',       xpRequired: 0 },
  { level: 10,  name: 'Apprentice',    xpRequired: 1000 },
  { level: 25,  name: 'Journeyman',    xpRequired: 5000 },
  { level: 50,  name: 'Expert',        xpRequired: 25000 },
  { level: 75,  name: 'Master',        xpRequired: 75000 },
  { level: 100, name: 'Grandmaster',   xpRequired: 200000 },
];

export function getProfessionTier(level: number): ProfessionTier {
  for (let i = PROFESSION_TIERS.length - 1; i >= 0; i--) {
    if (level >= PROFESSION_TIERS[i].level) return PROFESSION_TIERS[i];
  }
  return PROFESSION_TIERS[0];
}

// ── Quality Tiers (crafting output) ─────────────────────────────────────────

export const QUALITY_TIERS = [
  { name: 'Poor',       statBonus: -0.10, chance: 'Below skill level' },
  { name: 'Normal',     statBonus:  0,    chance: 'At skill level' },
  { name: 'Good',       statBonus:  0.10, chance: 'Above skill level' },
  { name: 'Superior',   statBonus:  0.25, chance: 'Master crafter' },
  { name: 'Masterwork', statBonus:  0.50, chance: 'Critical success' },
] as const;

// ── Skill Tree Node ─────────────────────────────────────────────────────────

export interface SkillNode {
  id: string;
  name: string;
  level: number;
  description: string;
  type: 'core' | 'recipe' | 'combat_bonus' | 'stat_bonus' | 'effect' | 'gathering';
  unlocks?: string[];
  bonuses?: Record<string, number | string>;
}

export interface SkillBranch {
  id: string;
  name: string;
  icon: string;
  nodes: SkillNode[];
}

// ── 5 Crafting Professions ──────────────────────────────────────────────────

export interface CraftingProfession {
  id: CraftingProfessionId;
  name: string;
  icon: string;
  description: string;
  totalNodes: number;
  branches: SkillBranch[];
}

export const CRAFTING_PROFESSIONS: Record<CraftingProfessionId, CraftingProfession> = {
  miner: {
    id: 'miner', name: 'Miner', icon: '⛏', totalNodes: 35,
    description: 'Masters of ore, metal, and weapons. Forge devastating blades and impenetrable armor.',
    branches: [
      { id: 'miner_core', name: 'Core Skills', icon: '🎯', nodes: [
        { id: 'miners_initiation', name: "Miner's Initiation", level: 0, description: 'Basic mining tools and ore identification.', type: 'core', bonuses: { miningSpeed: 5 } },
        { id: 'ore_identification', name: 'Ore Identification', level: 5, description: 'Identify valuable ore deposits. +10% rare ore.', type: 'core', bonuses: { rareOreChance: 0.10 } },
        { id: 'metallurgy_basics', name: 'Metallurgy Basics', level: 10, description: 'Unlocks smelting and basic forging.', type: 'core', unlocks: ['smelting', 'basicForge'] },
      ]},
      { id: 'miner_weaponry', name: 'Weaponry', icon: '⚔', nodes: [
        { id: 'blade_forging', name: 'Blade Forging', level: 15, description: 'Swords T1-T3.', type: 'recipe', unlocks: ['swords_t1_t3'] },
        { id: 'edge_tempering', name: 'Edge Tempering', level: 25, description: '+15% weapon damage, +10% durability.', type: 'combat_bonus', bonuses: { weaponDamage: 0.15, durability: 0.10 } },
        { id: 'axe_smithing', name: 'Axe Smithing', level: 35, description: 'Axes T1-T4, +10% armor pen.', type: 'recipe', unlocks: ['axes_t1_t4'], bonuses: { armorPen: 0.10 } },
        { id: 'dagger_crafting', name: 'Dagger Crafting', level: 40, description: 'Daggers T1-T4, +15% crit chance.', type: 'recipe', unlocks: ['daggers_t1_t4'], bonuses: { critChance: 0.15 } },
        { id: 'hammer_forging', name: 'Hammer Forging', level: 50, description: 'Hammers T1-T5, +20% stun chance.', type: 'recipe', unlocks: ['hammers_t1_t5'], bonuses: { stunChance: 0.20 } },
        { id: 'greatsword_mastery', name: 'Greatsword Mastery', level: 55, description: 'Greatswords T1-T5.', type: 'recipe', unlocks: ['greatswords_t1_t5'] },
        { id: 'greataxe_mastery', name: 'Greataxe Mastery', level: 65, description: 'Greataxes T1-T6, +25% cleave.', type: 'recipe', unlocks: ['greataxes_t1_t6'], bonuses: { cleaveDamage: 0.25 } },
        { id: 'spear_mace_craft', name: 'Spear & Mace Craft', level: 75, description: 'Spears T1-T6, Maces T1-T6.', type: 'recipe', unlocks: ['spears_t1_t6', 'maces_t1_t6'] },
        { id: 'legendary_weaponsmith', name: 'Legendary Weaponsmith', level: 90, description: 'All weapons T7-T8.', type: 'recipe', unlocks: ['all_weapons_t7_t8'] },
        { id: 'divine_armaments', name: 'Divine Armaments', level: 95, description: 'Divine weapons + holy damage.', type: 'recipe', unlocks: ['divine_weapons'], bonuses: { holyDamage: 1 } },
      ]},
      { id: 'miner_plate', name: 'Plate Armor', icon: '🛡', nodes: [
        { id: 'basic_armor', name: 'Basic Armor', level: 15, description: 'Plate T1.', type: 'recipe', unlocks: ['plate_t1'] },
        { id: 'reinforced_plates', name: 'Reinforced Plates', level: 25, description: '+10% armor defense.', type: 'stat_bonus', bonuses: { armorDefense: 0.10 } },
        { id: 'steel_armoring', name: 'Steel Armoring', level: 35, description: 'Plate T2-T4.', type: 'recipe', unlocks: ['plate_t2_t4'] },
        { id: 'shield_forging', name: 'Shield Forging', level: 40, description: 'Shields T1-T6.', type: 'recipe', unlocks: ['shields_t1_t6'] },
        { id: 'master_temper', name: 'Master Temper', level: 55, description: '+8% HP from plate.', type: 'stat_bonus', bonuses: { hpFromPlate: 0.08 } },
        { id: 'heroic_armor', name: 'Heroic Armor', level: 60, description: 'Plate T5-T6.', type: 'recipe', unlocks: ['plate_t5_t6'] },
        { id: 'ancient_armor', name: 'Ancient Armor', level: 80, description: 'Plate T7.', type: 'recipe', unlocks: ['plate_t7'] },
        { id: 'divine_armor', name: 'Divine Armor', level: 95, description: 'Plate T8 + divine set bonus.', type: 'recipe', unlocks: ['plate_t8'] },
      ]},
      { id: 'miner_gathering', name: 'Mining Mastery', icon: '⛏', nodes: [
        { id: 'copper_mining', name: 'Copper Mining', level: 1, description: 'Mine copper ore.', type: 'gathering', unlocks: ['copperOre'] },
        { id: 'iron_mining', name: 'Iron Mining', level: 10, description: 'Mine iron ore. +5% yield.', type: 'gathering', unlocks: ['ironOre'], bonuses: { yield: 0.05 } },
        { id: 'steel_mining', name: 'Steel Mining', level: 20, description: 'Mine steel ore.', type: 'gathering', unlocks: ['steelOre'] },
        { id: 'gem_mastery', name: 'Gem Mastery', level: 30, description: 'Detect and mine gems.', type: 'gathering', unlocks: ['gems'] },
        { id: 'mithril_mining', name: 'Mithril Mining', level: 35, description: 'Mithril veins. +10% yield.', type: 'gathering', unlocks: ['mithrilOre'], bonuses: { yield: 0.10 } },
        { id: 'crystal_mastery', name: 'Crystal Mastery', level: 45, description: 'Harvest crystals.', type: 'gathering', unlocks: ['crystals'] },
        { id: 'adamantine_mining', name: 'Adamantine Mining', level: 50, description: 'Deep adamantine deposits.', type: 'gathering', unlocks: ['adamantineOre'] },
        { id: 'treasure_hunting', name: 'Treasure Hunting', level: 60, description: 'Detect buried treasure. +5% rare drops.', type: 'gathering', bonuses: { rareDrop: 0.05 } },
        { id: 'orichalcum_mining', name: 'Orichalcum Mining', level: 65, description: 'Volcanic orichalcum.', type: 'gathering', unlocks: ['orichalcumOre'] },
        { id: 'starmetal_mining', name: 'Starmetal Mining', level: 80, description: 'Meteorite-infused starmetal.', type: 'gathering', unlocks: ['starmetalOre'] },
        { id: 'divine_mining', name: 'Divine Mining', level: 95, description: "Mine divine essence from the gods' veins.", type: 'gathering', unlocks: ['divineOre'] },
      ]},
      { id: 'miner_infusions', name: 'Miner Infusions', icon: '✨', nodes: [
        { id: 'forge_infusion', name: 'Forge Infusion', level: 40, description: 'Weapon/armor durability +10%.', type: 'effect', bonuses: { durability: 0.10 } },
        { id: 'earthen_infusion', name: 'Earthen Infusion', level: 55, description: 'Defense +5% on plate armor.', type: 'effect', bonuses: { defense: 0.05 } },
        { id: 'crystal_infusion', name: 'Crystal Infusion', level: 70, description: 'Critical damage +8% on weapons.', type: 'effect', bonuses: { critDamage: 0.08 } },
      ]},
    ],
  },
  forester: {
    id: 'forester', name: 'Forester', icon: '🌲', totalNodes: 20,
    description: 'Woodworker, leatherworker & mount tamer. Bows, leather armor, and mounts.',
    branches: [
      { id: 'for_core', name: 'Core', icon: '🎯', nodes: [
        { id: 'foresters_initiation', name: "Forester's Initiation", level: 0, description: 'Basic woodcutting and skinning tools.', type: 'core' },
        { id: 'timber_processing', name: 'Timber Processing', level: 5, description: 'Sawmill access for planks.', type: 'core' },
        { id: 'leatherwork_basics', name: 'Leatherwork Basics', level: 10, description: 'Tanning rack for leather.', type: 'core' },
      ]},
      { id: 'for_bowcraft', name: 'Bowcraft & Leather', icon: '🏹', nodes: [
        { id: 'bow_carving', name: 'Bow Carving', level: 15, description: 'Bows T1-T3.', type: 'recipe', unlocks: ['bows_t1_t3'] },
        { id: 'leather_armor', name: 'Leather Armor', level: 20, description: 'Leather armor T1-T3.', type: 'recipe', unlocks: ['leather_t1_t3'] },
        { id: 'bowstring_craft', name: 'String & Bowstring', level: 25, description: 'Craft bowstrings from fiber.', type: 'recipe' },
        { id: 'adv_bowcraft', name: 'Advanced Bowcraft', level: 40, description: 'Bows T4-T6.', type: 'recipe', unlocks: ['bows_t4_t6'] },
        { id: 'adv_leather', name: 'Advanced Leather', level: 45, description: 'Leather armor T4-T6.', type: 'recipe', unlocks: ['leather_t4_t6'] },
        { id: 'mount_taming', name: 'Mount Taming', level: 50, description: 'Tame ground/flying mounts.', type: 'recipe', unlocks: ['groundMounts', 'flyingMounts'] },
        { id: 'legendary_bowyer', name: 'Legendary Bowyer', level: 80, description: 'Bows T7-T8.', type: 'recipe', unlocks: ['bows_t7_t8'] },
        { id: 'legendary_leatherwork', name: 'Legendary Leatherwork', level: 85, description: 'Leather armor T7-T8.', type: 'recipe', unlocks: ['leather_t7_t8'] },
      ]},
      { id: 'for_gathering', name: 'Gathering Mastery', icon: '🌿', nodes: [
        { id: 'pine_logging', name: 'Pine Logging', level: 1, description: 'Pine Log.', type: 'gathering', unlocks: ['pineLog'] },
        { id: 'oak_logging', name: 'Oak Logging', level: 10, description: 'Oak Log. +5% yield.', type: 'gathering', unlocks: ['oakLog'], bonuses: { yield: 0.05 } },
        { id: 'wood_progression', name: 'Maple→Worldtree', level: 20, description: 'Progressive wood T3-T8.', type: 'gathering', unlocks: ['mapleLog', 'ashLog', 'ironwoodLog', 'ebonyLog', 'wyrmwoodLog', 'worldtreeLog'] },
        { id: 'skinning_mastery', name: 'Skinning Mastery', level: 10, description: 'Rawhide → Divine hide.', type: 'gathering', unlocks: ['hides_t1_t8'] },
        { id: 'for_fishing', name: 'Fishing', level: 15, description: 'Salmon → Kraken.', type: 'gathering', unlocks: ['fish_t1_t8'] },
        { id: 'for_herbs', name: 'Herb Gathering', level: 10, description: 'Spice → Mystic herbs.', type: 'gathering', unlocks: ['herbs'] },
      ]},
      { id: 'for_infusions', name: 'Forester Infusions', icon: '✨', nodes: [
        { id: 'verdant_infusion', name: 'Verdant Infusion', level: 40, description: 'Nature damage +10%.', type: 'effect', bonuses: { natureDamage: 0.10 } },
        { id: 'beast_infusion', name: 'Beast Infusion', level: 55, description: 'Attack speed +5%.', type: 'effect', bonuses: { attackSpeed: 0.05 } },
        { id: 'primal_infusion', name: 'Primal Infusion', level: 70, description: 'Bleed damage +15%.', type: 'effect', bonuses: { bleedDamage: 0.15 } },
      ]},
    ],
  },
  chef: {
    id: 'chef', name: 'Chef', icon: '🍖', totalNodes: 17,
    description: 'Cook, brewer & alchemist. Food, potions, drinks, and alchemy.',
    branches: [
      { id: 'chef_core', name: 'Core', icon: '🎯', nodes: [
        { id: 'chefs_initiation', name: "Chef's Initiation", level: 0, description: 'Campfire cooking.', type: 'core' },
        { id: 'basic_alchemy', name: 'Basic Alchemy', level: 5, description: 'Charcoal, salt.', type: 'core' },
        { id: 'kitchen_access', name: 'Kitchen Access', level: 10, description: 'Upgrade to kitchen station.', type: 'core' },
      ]},
      { id: 'chef_cooking', name: 'Cooking & Alchemy', icon: '🍲', nodes: [
        { id: 'food_t1_t3', name: 'Food T1-T3', level: 10, description: 'Salted jerky → hearty stew.', type: 'recipe' },
        { id: 'health_potions', name: 'Health Potions T1-T8', level: 10, description: 'Minor → Divine HP potions.', type: 'recipe' },
        { id: 'mana_potions', name: 'Mana Potions T1-T8', level: 10, description: 'Minor → Divine MP potions.', type: 'recipe' },
        { id: 'buff_potions', name: 'Buff Potions', level: 30, description: 'STR, DEF, SPD, Regen elixirs.', type: 'recipe' },
        { id: 'drinks', name: 'Drinks T1-T3', level: 15, description: 'Water → Fruit Juice.', type: 'recipe' },
        { id: 'food_t4_t6', name: 'Food T4-T6', level: 40, description: 'Epic through mythic cuisine.', type: 'recipe' },
        { id: 'food_t7_t8', name: 'Food T7-T8', level: 80, description: 'Ancient → Divine Banquet.', type: 'recipe' },
      ]},
      { id: 'chef_gathering', name: 'Gathering', icon: '🌿', nodes: [
        { id: 'chef_fishing', name: 'Fishing T1-T8', level: 1, description: 'Salmon → Kraken.', type: 'gathering' },
        { id: 'chef_foraging', name: 'Foraging T1-T8', level: 5, description: 'Fruit → Golden Wheat.', type: 'gathering' },
        { id: 'chef_herbs', name: 'Herb Gathering', level: 10, description: 'Healing → Primordial herbs.', type: 'gathering' },
        { id: 'chef_ingredients', name: 'Ingredients', level: 15, description: 'Milk, Honey, Salt, Water.', type: 'gathering' },
      ]},
      { id: 'chef_infusions', name: 'Chef Infusions', icon: '✨', nodes: [
        { id: 'vitality_infusion', name: 'Vitality Infusion', level: 40, description: 'Max HP +8%.', type: 'effect', bonuses: { maxHp: 0.08 } },
        { id: 'stamina_infusion', name: 'Stamina Infusion', level: 55, description: 'Stamina regen +10%.', type: 'effect', bonuses: { staminaRegen: 0.10 } },
        { id: 'elixir_infusion', name: 'Elixir Infusion', level: 70, description: 'Potion effectiveness +20%.', type: 'effect', bonuses: { potionEffect: 0.20 } },
      ]},
    ],
  },
  engineer: {
    id: 'engineer', name: 'Engineer', icon: '⚙', totalNodes: 15,
    description: 'Mechanic, gunsmith & inventor. Crossbows, guns, gadgets, and mechanical mounts.',
    branches: [
      { id: 'eng_core', name: 'Core', icon: '🎯', nodes: [
        { id: 'tinkers_initiation', name: "Tinker's Initiation", level: 0, description: 'Scrap parts, basic traps.', type: 'core' },
        { id: 'component_assembly', name: 'Component Assembly', level: 5, description: 'Gears, springs, components.', type: 'core' },
        { id: 'workshop_access', name: 'Workshop Access', level: 10, description: 'Unlock workshop for T1+ crafting.', type: 'core' },
      ]},
      { id: 'eng_ranged', name: 'Ranged Weapons & Gadgets', icon: '🔫', nodes: [
        { id: 'crossbow_craft', name: 'Crossbow Craft', level: 15, description: 'Crossbows T1-T3.', type: 'recipe' },
        { id: 'gun_craft', name: 'Gun Craft', level: 25, description: 'Guns T1-T3.', type: 'recipe' },
        { id: 'components', name: 'Components', level: 30, description: 'Gunpowder, gears, springs, lenses, circuits.', type: 'recipe' },
        { id: 'adv_ranged', name: 'Advanced Ranged', level: 50, description: 'Crossbows + Guns T4-T6.', type: 'recipe' },
        { id: 'mechanical_mounts', name: 'Mechanical Mounts', level: 55, description: 'Build mechanical mounts.', type: 'recipe' },
        { id: 'legendary_engineering', name: 'Legendary Engineering', level: 80, description: 'Crossbows + Guns T7-T8.', type: 'recipe' },
      ]},
      { id: 'eng_scavenging', name: 'Scavenging Mastery', icon: '🧲', nodes: [
        { id: 'salvaging', name: 'Salvaging T1-T8', level: 1, description: 'Iron → Eternal scrap.', type: 'gathering' },
        { id: 'scavenging', name: 'Scavenging T1-T8', level: 10, description: 'Basic → Quantum parts.', type: 'gathering' },
        { id: 'special_materials', name: 'Special Materials', level: 20, description: 'Oil, gas, explosives, batteries.', type: 'gathering' },
      ]},
      { id: 'eng_infusions', name: 'Engineer Infusions', icon: '✨', nodes: [
        { id: 'mechanical_infusion', name: 'Mechanical Infusion', level: 40, description: 'Ranged damage +10%.', type: 'effect', bonuses: { rangedDamage: 0.10 } },
        { id: 'explosive_infusion', name: 'Explosive Infusion', level: 55, description: 'AoE damage +12%.', type: 'effect', bonuses: { aoeDamage: 0.12 } },
        { id: 'automaton_infusion', name: 'Automaton Infusion', level: 70, description: 'Turret damage +15%.', type: 'effect', bonuses: { turretDamage: 0.15 } },
      ]},
    ],
  },
  mystic: {
    id: 'mystic', name: 'Mystic', icon: '🔮', totalNodes: 18,
    description: 'Weaver, enchanter & spellcrafter. Staves, cloth armor, enchanting, and magical mounts.',
    branches: [
      { id: 'mys_core', name: 'Core', icon: '🎯', nodes: [
        { id: 'mystics_initiation', name: "Mystic's Initiation", level: 0, description: 'Spinning wheel, torn rag salvage.', type: 'core' },
        { id: 'weaving_basics', name: 'Weaving Basics', level: 5, description: 'Loom for cloth weaving.', type: 'core' },
        { id: 'essence_channeling', name: 'Essence Channeling', level: 10, description: 'Extract and use essence.', type: 'core' },
      ]},
      { id: 'mys_craft', name: 'Staves, Cloth & Enchanting', icon: '🪄', nodes: [
        { id: 'staff_crafting', name: 'Staff Crafting', level: 15, description: 'Fire & Frost staves T1-T3.', type: 'recipe' },
        { id: 'cloth_armor', name: 'Cloth Armor', level: 20, description: 'Hood, Robe, Pants, Slippers, Gloves, Mantle, Sash.', type: 'recipe' },
        { id: 'all_elements', name: 'All Elements', level: 30, description: 'Holy, Lightning, Nature, Arcane staves.', type: 'recipe' },
        { id: 'tomes_wands', name: 'Tomes & Wands', level: 35, description: 'Off-hand tomes and 1h wands.', type: 'recipe' },
        { id: 'enchanting_table', name: 'Enchanting Table', level: 40, description: 'Apply infusions to equipment.', type: 'recipe' },
        { id: 'adv_mystic_craft', name: 'Advanced Craft', level: 55, description: 'All staves + cloth T4-T6.', type: 'recipe' },
        { id: 'offhand_relics', name: 'Off-hand Relics', level: 60, description: 'Trinkets and active-use relics.', type: 'recipe' },
        { id: 'legendary_mystic', name: 'Legendary Mystic', level: 80, description: 'All staves + cloth T7-T8, magical mounts.', type: 'recipe' },
      ]},
      { id: 'mys_gathering', name: 'Gathering', icon: '🌿', nodes: [
        { id: 'mys_herbalism', name: 'Herbalism T1-T8', level: 1, description: 'Healing → Primordial herbs.', type: 'gathering' },
        { id: 'essence_extraction', name: 'Essence Extraction', level: 10, description: 'Lesser → Radiant essence.', type: 'gathering' },
        { id: 'crystal_harvesting', name: 'Crystal Harvesting', level: 15, description: 'Mana → Primordial crystals.', type: 'gathering' },
        { id: 'special_gathering', name: 'Special Gathering', level: 20, description: 'Mushrooms, lichen, flowers, roots.', type: 'gathering' },
      ]},
      { id: 'mys_infusions', name: 'Mystic Infusions', icon: '✨', nodes: [
        { id: 'arcane_infusion', name: 'Arcane Infusion', level: 40, description: 'Spell power +10%.', type: 'effect', bonuses: { spellPower: 0.10 } },
        { id: 'void_infusion', name: 'Void Infusion', level: 55, description: 'Shadow damage +12%.', type: 'effect', bonuses: { shadowDamage: 0.12 } },
        { id: 'celestial_infusion', name: 'Celestial Infusion', level: 70, description: 'Holy damage +15%.', type: 'effect', bonuses: { holyDamage: 0.15 } },
      ]},
    ],
  },
};

// ── 6 Harvesting Skills ─────────────────────────────────────────────────────

export interface HarvestingSkill {
  id: HarvestingSkillId;
  name: string;
  icon: string;
  description: string;
  /** Which crafting professions include this skill in their gathering branch */
  parentProfessions: CraftingProfessionId[];
  /** T1-T8 resource names gathered by this skill */
  resources: string[];
}

export const HARVESTING_SKILLS: Record<HarvestingSkillId, HarvestingSkill> = {
  mining: {
    id: 'mining', name: 'Mining', icon: '⛏',
    description: 'Extract ores, gems, and minerals from the earth.',
    parentProfessions: ['miner'],
    resources: ['copperOre', 'ironOre', 'steelOre', 'mithrilOre', 'adamantineOre', 'orichalcumOre', 'starmetalOre', 'divineOre'],
  },
  woodcutting: {
    id: 'woodcutting', name: 'Woodcutting', icon: '🪓',
    description: 'Harvest logs, bark, and sap from trees.',
    parentProfessions: ['forester'],
    resources: ['pineLog', 'oakLog', 'mapleLog', 'ashLog', 'ironwoodLog', 'ebonyLog', 'wyrmwoodLog', 'worldtreeLog'],
  },
  skinning: {
    id: 'skinning', name: 'Skinning', icon: '🔪',
    description: 'Collect hides and leather from creatures.',
    parentProfessions: ['forester'],
    resources: ['rawhideLeather', 'tannedLeather', 'thickHide', 'scaleHide', 'dragonHide', 'wyrmHide', 'ancientHide', 'divineHide'],
  },
  fishing: {
    id: 'fishing', name: 'Fishing', icon: '🎣',
    description: 'Catch fish from water sources.',
    parentProfessions: ['forester', 'chef'],
    resources: ['salmon', 'trout', 'swordfish', 'lobster', 'shark', 'leviathan', 'seaDragon', 'kraken'],
  },
  herbalism: {
    id: 'herbalism', name: 'Herbalism', icon: '🌿',
    description: 'Gather plants, herbs, and flowers.',
    parentProfessions: ['forester', 'chef', 'mystic'],
    resources: ['healingHerb', 'spiceHerb', 'mageroyal', 'fadeleaf', 'dreamfoil', 'ghostMoss', 'primordialRoot', 'divineBloom'],
  },
  foraging: {
    id: 'foraging', name: 'Foraging', icon: '🍄',
    description: 'Find berries, mushrooms, grain, and roots in the wild.',
    parentProfessions: ['chef'],
    resources: ['wildFruit', 'grain', 'mushroom', 'spice', 'honey', 'rareRoot', 'mysticFruit', 'goldenWheat'],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getAllProfessionIds(): ProfessionId[] {
  return [
    ...Object.keys(CRAFTING_PROFESSIONS) as CraftingProfessionId[],
    ...Object.keys(HARVESTING_SKILLS) as HarvestingSkillId[],
  ];
}

// ── Harvesting: Nodes Are Simple, Profession Level Drives Drops ────────────
//
// Nodes have NO tier. A rock is a rock, a tree is a tree.
// Your profession level determines what tier of material you pull out.
// There's always a chance to get one tier above your normal drop.
// ─────────────────────────────────────────────────────────────────────

/** Profession level at which each tier becomes the "base" drop. */
export const TIER_LEVEL_THRESHOLDS: Record<number, number> = {
  1: 1, 2: 10, 3: 20, 4: 35, 5: 50, 6: 65, 7: 80, 8: 95,
};

/**
 * Base drop tier for a profession level. This is the tier you normally get.
 *   Level 1   → T1
 *   Level 10  → T2
 *   Level 35  → T4
 *   Level 95+ → T8
 */
export function getBaseTier(professionLevel: number): number {
  let best = 1;
  for (let tier = 8; tier >= 1; tier--) {
    if (professionLevel >= (TIER_LEVEL_THRESHOLDS[tier] ?? 999)) {
      best = tier;
      break;
    }
  }
  return best;
}

/**
 * Chance to get one tier ABOVE your base drop (lucky gather).
 * Scales with how close you are to the next tier threshold.
 *   - Just reached current tier: ~8% chance
 *   - Halfway to next tier: ~15% chance
 *   - Almost at next tier: ~25% chance
 *   - Already at T8: 0% (nothing above T8)
 */
export function luckyTierChance(professionLevel: number): number {
  const baseTier = getBaseTier(professionLevel);
  if (baseTier >= 8) return 0; // can't go above T8
  const currentThreshold = TIER_LEVEL_THRESHOLDS[baseTier] ?? 1;
  const nextThreshold = TIER_LEVEL_THRESHOLDS[baseTier + 1] ?? 100;
  const progress = (professionLevel - currentThreshold) / Math.max(1, nextThreshold - currentThreshold);
  // 8% base + up to 17% more as you approach the next tier
  return 0.08 + progress * 0.17;
}

/**
 * Roll the actual drop tier for a harvest. Simple node, no node tier.
 *
 *   rollHarvestTier(level=1)  → usually T1, 8% chance for T2
 *   rollHarvestTier(level=33) → usually T3, ~22% chance for T4
 *   rollHarvestTier(level=95) → always T8 (nothing above)
 */
export function rollHarvestTier(professionLevel: number): number {
  const base = getBaseTier(professionLevel);
  const luckyChance = luckyTierChance(professionLevel);
  if (base < 8 && Math.random() < luckyChance) {
    return base + 1;
  }
  return base;
}

/**
 * XP awarded for a single harvest. Scales with your current tier range.
 * Low-tier gathering at high level gives diminishing returns.
 *   Base: tier * 8 XP (T1=8, T8=64)
 *   Lucky drops give 50% bonus XP.
 */
export function xpForHarvest(professionLevel: number): number {
  const tier = getBaseTier(professionLevel);
  return tier * 8;
}

// ── Tier Conversion (Furnace / Refinery) ───────────────────────────────

/** Cost to convert materials up one tier (3 lower → 1 higher) */
export const TIER_UP_COST = 3;

/** Yield when converting materials down one tier (1 higher → 3 lower) */
export const TIER_DOWN_YIELD = 3;

/**
 * Calculate tier conversion.
 *   direction 'up':   inputQty of tierFrom → outputQty of (tierFrom + 1)
 *   direction 'down': inputQty of tierFrom → outputQty of (tierFrom - 1)
 */
export function tierConversion(
  direction: 'up' | 'down',
  tierFrom: number,
  inputQty: number,
): { tierTo: number; outputQty: number; leftover: number } | null {
  if (direction === 'up') {
    if (tierFrom >= 8) return null;
    const batches = Math.floor(inputQty / TIER_UP_COST);
    if (batches === 0) return null;
    return {
      tierTo: tierFrom + 1,
      outputQty: batches,
      leftover: inputQty - batches * TIER_UP_COST,
    };
  } else {
    if (tierFrom <= 1) return null;
    return {
      tierTo: tierFrom - 1,
      outputQty: inputQty * TIER_DOWN_YIELD,
      leftover: 0,
    };
  }
}
