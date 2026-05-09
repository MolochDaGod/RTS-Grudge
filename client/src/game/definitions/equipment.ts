// Equipment definitions with tiered stats for GRUDGE tactical game
// Stats scale with tier (T1-T8)

export interface EquipmentStats {
  hpBase: number;
  hpPerTier: number;
  manaBase: number;
  manaPerTier: number;
  critBase: number;
  critPerTier: number;
  blockBase: number;
  blockPerTier: number;
  defenseBase: number;
  defensePerTier: number;
}

export interface EquipmentItem {
  id: string;
  name: string;
  type: EquipmentSlot;
  material: ArmorMaterial;
  set: EquipmentSet;
  stats: EquipmentStats;
  passive: string;
  attribute: string;
  effect: string;
  proc: string;
  setBonus: string;
  lore: string;
}

export type EquipmentSlot = "Head" | "Chest" | "Hands" | "Legs" | "Feet" | "Cape" | "Accessory";
export type ArmorMaterial = "Cloth" | "Leather" | "Metal" | "Gem";
export type EquipmentSet = "Scholar" | "Ranger" | "Knight" | "Mage" | "Assassin" | "Paladin";

export const EQUIPMENT_SLOTS: EquipmentSlot[] = ["Head", "Chest", "Hands", "Legs", "Feet", "Cape", "Accessory"];
export const ARMOR_MATERIALS: ArmorMaterial[] = ["Cloth", "Leather", "Metal", "Gem"];
export const EQUIPMENT_SETS: EquipmentSet[] = ["Scholar", "Ranger", "Knight", "Mage", "Assassin", "Paladin"];

// Calculate equipment stat at specific tier
export function getEquipmentStatAtTier(base: number, perTier: number, tier: number): number {
  return Math.round(base + perTier * tier);
}

// All equipment in the game
export const ALL_EQUIPMENT: EquipmentItem[] = [
  // SCHOLAR SET (Cloth - Mage/Healer support)
  {
    id: "scholar_hood",
    name: "Scholar's Hood",
    type: "Head",
    material: "Cloth",
    set: "Scholar",
    stats: {
      hpBase: 20, hpPerTier: 8,
      manaBase: 30, manaPerTier: 12,
      critBase: 2, critPerTier: 0.5,
      blockBase: 0, blockPerTier: 0,
      defenseBase: 5, defensePerTier: 2,
    },
    passive: "Mana Regen +3/turn",
    attribute: "Intelligence +5",
    effect: "Spell Power +10%",
    proc: "5% to refund spell mana cost",
    setBonus: "2pc: +15% healing; 4pc: +25% spell power",
    lore: "Worn by the keepers of ancient knowledge.",
  },
  {
    id: "scholar_robes",
    name: "Scholar's Robes",
    type: "Chest",
    material: "Cloth",
    set: "Scholar",
    stats: {
      hpBase: 40, hpPerTier: 15,
      manaBase: 50, manaPerTier: 20,
      critBase: 3, critPerTier: 0.8,
      blockBase: 0, blockPerTier: 0,
      defenseBase: 8, defensePerTier: 3,
    },
    passive: "Cast Speed +15%",
    attribute: "Wisdom +5",
    effect: "Mana Pool +20",
    proc: "10% to reduce next spell cooldown by 1",
    setBonus: "2pc: +15% healing; 4pc: +25% spell power",
    lore: "Enchanted threads protect the wearer from harm.",
  },
  {
    id: "scholar_gloves",
    name: "Scholar's Gloves",
    type: "Hands",
    material: "Cloth",
    set: "Scholar",
    stats: {
      hpBase: 15, hpPerTier: 5,
      manaBase: 20, manaPerTier: 8,
      critBase: 4, critPerTier: 1,
      blockBase: 0, blockPerTier: 0,
      defenseBase: 3, defensePerTier: 1,
    },
    passive: "Precision Casting +5%",
    attribute: "Dexterity +3",
    effect: "Spell Range +1",
    proc: "8% spell crit bonus damage +25%",
    setBonus: "2pc: +15% healing; 4pc: +25% spell power",
    lore: "Fingers nimble enough to weave reality.",
  },

  // RANGER SET (Leather - Ranged DPS)
  {
    id: "ranger_helm",
    name: "Ranger's Hood",
    type: "Head",
    material: "Leather",
    set: "Ranger",
    stats: {
      hpBase: 30, hpPerTier: 10,
      manaBase: 15, manaPerTier: 5,
      critBase: 5, critPerTier: 1.2,
      blockBase: 1, blockPerTier: 0.2,
      defenseBase: 8, defensePerTier: 3,
    },
    passive: "Eagle Eye (+2 range)",
    attribute: "Perception +5",
    effect: "Ranged Damage +10%",
    proc: "10% to mark target (vulnerable)",
    setBonus: "2pc: +15% ranged damage; 4pc: +20% crit chance",
    lore: "See your target before they see you.",
  },
  {
    id: "ranger_vest",
    name: "Ranger's Vest",
    type: "Chest",
    material: "Leather",
    set: "Ranger",
    stats: {
      hpBase: 50, hpPerTier: 18,
      manaBase: 20, manaPerTier: 6,
      critBase: 4, critPerTier: 1,
      blockBase: 2, blockPerTier: 0.5,
      defenseBase: 12, defensePerTier: 4,
    },
    passive: "Evasion +10%",
    attribute: "Agility +5",
    effect: "Movement +1",
    proc: "15% dodge on ranged attacks",
    setBonus: "2pc: +15% ranged damage; 4pc: +20% crit chance",
    lore: "Light armor for those who prefer to stay mobile.",
  },
  {
    id: "ranger_boots",
    name: "Ranger's Boots",
    type: "Feet",
    material: "Leather",
    set: "Ranger",
    stats: {
      hpBase: 25, hpPerTier: 8,
      manaBase: 10, manaPerTier: 3,
      critBase: 3, critPerTier: 0.8,
      blockBase: 0, blockPerTier: 0,
      defenseBase: 6, defensePerTier: 2,
    },
    passive: "Silent Step (stealth bonus)",
    attribute: "Speed +3",
    effect: "Terrain Penalty -50%",
    proc: "20% to not trigger opportunity attacks",
    setBonus: "2pc: +15% ranged damage; 4pc: +20% crit chance",
    lore: "Leave no trace, make no sound.",
  },

  // KNIGHT SET (Metal - Tank)
  {
    id: "knight_helm",
    name: "Knight's Helm",
    type: "Head",
    material: "Metal",
    set: "Knight",
    stats: {
      hpBase: 50, hpPerTier: 20,
      manaBase: 5, manaPerTier: 2,
      critBase: 1, critPerTier: 0.3,
      blockBase: 5, blockPerTier: 1.5,
      defenseBase: 15, defensePerTier: 5,
    },
    passive: "Steadfast (immune to knockback)",
    attribute: "Constitution +5",
    effect: "Threat Generation +20%",
    proc: "10% to reduce incoming damage by 25%",
    setBonus: "2pc: +20% HP; 4pc: +30% block, +15% defense",
    lore: "Heavy iron forged for the front lines.",
  },
  {
    id: "knight_plate",
    name: "Knight's Plate",
    type: "Chest",
    material: "Metal",
    set: "Knight",
    stats: {
      hpBase: 80, hpPerTier: 30,
      manaBase: 5, manaPerTier: 2,
      critBase: 0, critPerTier: 0,
      blockBase: 8, blockPerTier: 2,
      defenseBase: 25, defensePerTier: 8,
    },
    passive: "Damage Reduction 10%",
    attribute: "Strength +5",
    effect: "HP Regen +5/turn",
    proc: "15% to absorb hit as shield",
    setBonus: "2pc: +20% HP; 4pc: +30% block, +15% defense",
    lore: "The wall between your allies and death.",
  },
  {
    id: "knight_gauntlets",
    name: "Knight's Gauntlets",
    type: "Hands",
    material: "Metal",
    set: "Knight",
    stats: {
      hpBase: 35, hpPerTier: 12,
      manaBase: 5, manaPerTier: 2,
      critBase: 2, critPerTier: 0.5,
      blockBase: 6, blockPerTier: 1.5,
      defenseBase: 10, defensePerTier: 4,
    },
    passive: "Shield Bash (stun on block)",
    attribute: "Strength +3",
    effect: "Block Damage Reflect 25%",
    proc: "10% to counter-attack on block",
    setBonus: "2pc: +20% HP; 4pc: +30% block, +15% defense",
    lore: "Turn defense into offense.",
  },
  {
    id: "knight_greaves",
    name: "Knight's Greaves",
    type: "Legs",
    material: "Metal",
    set: "Knight",
    stats: {
      hpBase: 60, hpPerTier: 22,
      manaBase: 5, manaPerTier: 2,
      critBase: 0, critPerTier: 0,
      blockBase: 4, blockPerTier: 1,
      defenseBase: 18, defensePerTier: 6,
    },
    passive: "Stand Ground (root immunity)",
    attribute: "Constitution +3",
    effect: "Movement Penalty -1 (min 2)",
    proc: "10% to resist crowd control",
    setBonus: "2pc: +20% HP; 4pc: +30% block, +15% defense",
    lore: "Stability is the foundation of survival.",
  },

  // ASSASSIN SET (Leather - Melee DPS)
  {
    id: "assassin_mask",
    name: "Assassin's Mask",
    type: "Head",
    material: "Leather",
    set: "Assassin",
    stats: {
      hpBase: 25, hpPerTier: 8,
      manaBase: 20, manaPerTier: 6,
      critBase: 8, critPerTier: 2,
      blockBase: 0, blockPerTier: 0,
      defenseBase: 5, defensePerTier: 2,
    },
    passive: "Ambush (+50% damage from stealth)",
    attribute: "Cunning +5",
    effect: "Stealth Duration +2 turns",
    proc: "15% to re-enter stealth after kill",
    setBonus: "2pc: +25% crit damage; 4pc: +30% backstab damage",
    lore: "They never see the face of death.",
  },
  {
    id: "assassin_vest",
    name: "Assassin's Vest",
    type: "Chest",
    material: "Leather",
    set: "Assassin",
    stats: {
      hpBase: 40, hpPerTier: 14,
      manaBase: 25, manaPerTier: 8,
      critBase: 6, critPerTier: 1.5,
      blockBase: 0, blockPerTier: 0,
      defenseBase: 8, defensePerTier: 3,
    },
    passive: "Poison Coating (+DoT on attacks)",
    attribute: "Agility +5",
    effect: "Attack Speed +15%",
    proc: "10% to apply bleeding on crit",
    setBonus: "2pc: +25% crit damage; 4pc: +30% backstab damage",
    lore: "Shadows woven into every thread.",
  },

  // PALADIN SET (Metal + Gem - Hybrid Tank/Healer)
  {
    id: "paladin_crown",
    name: "Paladin's Crown",
    type: "Head",
    material: "Gem",
    set: "Paladin",
    stats: {
      hpBase: 45, hpPerTier: 16,
      manaBase: 25, manaPerTier: 10,
      critBase: 2, critPerTier: 0.5,
      blockBase: 4, blockPerTier: 1,
      defenseBase: 12, defensePerTier: 4,
    },
    passive: "Divine Protection (absorb ally damage)",
    attribute: "Spirit +5",
    effect: "Healing Received +20%",
    proc: "10% to heal nearby ally on damage taken",
    setBonus: "2pc: +15% healing done; 4pc: +20% defense, divine shield on low HP",
    lore: "Blessed by the light, protector of the faithful.",
  },
  {
    id: "paladin_plate",
    name: "Paladin's Plate",
    type: "Chest",
    material: "Gem",
    set: "Paladin",
    stats: {
      hpBase: 70, hpPerTier: 25,
      manaBase: 35, manaPerTier: 12,
      critBase: 1, critPerTier: 0.3,
      blockBase: 6, blockPerTier: 1.5,
      defenseBase: 20, defensePerTier: 7,
    },
    passive: "Aura of Light (+5 HP/turn to allies)",
    attribute: "Faith +5",
    effect: "Undead Damage +25%",
    proc: "15% to cleanse debuff on heal",
    setBonus: "2pc: +15% healing done; 4pc: +20% defense, divine shield on low HP",
    lore: "Where darkness falls, the paladin stands.",
  },
];

// Get equipment by ID
export function getEquipmentById(id: string): EquipmentItem | undefined {
  return ALL_EQUIPMENT.find(e => e.id === id);
}

// Get equipment by slot
export function getEquipmentBySlot(slot: EquipmentSlot): EquipmentItem[] {
  return ALL_EQUIPMENT.filter(e => e.type === slot);
}

// Get equipment by material
export function getEquipmentByMaterial(material: ArmorMaterial): EquipmentItem[] {
  return ALL_EQUIPMENT.filter(e => e.material === material);
}

// Get equipment by set
export function getEquipmentBySet(set: EquipmentSet): EquipmentItem[] {
  return ALL_EQUIPMENT.filter(e => e.set === set);
}
