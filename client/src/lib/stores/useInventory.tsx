import { create } from "zustand";
import { useEquipment, type EquipItem, type EquipSlot, type StatKey, type ItemTier } from "./useEquipment";

export interface InventoryItem {
  id: string;
  name: string;
  type: "weapon" | "food" | "material" | "tool" | "consumable" | "building" | "armor";
  quantity: number;
  damage?: number;
  healAmount?: number;
  hungerRestore?: number;
  staminaRestore?: number;
  duration?: number;
  icon: string;
  description?: string;
}

export type CraftCategory =
  // Original
  | "tools" | "weapons" | "food" | "consumables" | "materials" | "armor"
  // WCS profession categories
  | "smelt"        // Miner  — ore → ingot chains
  | "woodwork"     // Forester — log → plank chains
  | "leatherwork"  // Forester — hide → leather chains
  | "weave"        // Mystic  — thread/fiber → cloth chains
  | "alchemy"      // Chef    — potions / elixirs
  | "enchant"      // All     — enchanting / infusions
  ;

export interface CraftRecipe {
  id: string;
  name: string;
  category: CraftCategory;
  ingredients: { itemId: string; count: number }[];
  result: Omit<InventoryItem, "quantity"> & { quantity: number };
}

export type SurvivalBuildCategory = "fire" | "structure" | "furniture" | "defense" | "storage";

export interface SurvivalBuildRecipe {
  id: string;
  name: string;
  category: SurvivalBuildCategory;
  ingredients: { itemId: string; count: number }[];
  icon: string;
  description: string;
  size: [number, number, number];
  color: string;
  snapType?: "foundation" | "wall" | "roof" | "floor" | "none";
}

interface InventoryState {
  items: InventoryItem[];
  selectedSlot: number;
  maxSlots: number;

  addItem: (item: Omit<InventoryItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (id: string, quantity?: number) => void;
  hasItem: (id: string, quantity?: number) => boolean;
  getItem: (id: string) => InventoryItem | undefined;
  selectSlot: (slot: number) => void;
  getSelectedItem: () => InventoryItem | undefined;
  craft: (recipe: CraftRecipe) => boolean;
  craftSurvivalBuilding: (recipe: SurvivalBuildRecipe) => boolean;
  useItem: (id: string) => { type: string; healAmount?: number; hungerRestore?: number; staminaRestore?: number; duration?: number } | null;
  equipFromInventory: (id: string) => boolean;
  reset: () => void;
}

// Maps inventory armor/weapon items (the ones produced by crafting recipes)
// to their equipment-slot definition. Without this bridge, crafted gear
// sits in the inventory and never affects combat math. Adding new craftable
// gear means adding a row here.
export const INVENTORY_EQUIP_MAP: Record<string, {
  slot: EquipSlot;
  stats: Partial<Record<StatKey, number>>;
  tier: ItemTier;
  rarity: EquipItem["rarity"];
  weaponType?: string;
}> = {
  leather_vest:    { slot: "chest", stats: { defense: 5 },  tier: 1, rarity: "common" },
  iron_helmet:     { slot: "helm",  stats: { defense: 8 },  tier: 2, rarity: "uncommon" },
  iron_chestplate: { slot: "chest", stats: { defense: 15 }, tier: 2, rarity: "uncommon" },
  stone_axe:      { slot: "mainHand", stats: { damage: 8 },  tier: 1, rarity: "common",  weaponType: "axe" },
  stone_pickaxe:  { slot: "mainHand", stats: { damage: 6 },  tier: 1, rarity: "common",  weaponType: "axe" },
  iron_axe:       { slot: "mainHand", stats: { damage: 14 }, tier: 2, rarity: "uncommon", weaponType: "axe" },
  iron_pickaxe:   { slot: "mainHand", stats: { damage: 12 }, tier: 2, rarity: "uncommon", weaponType: "axe" },
  // Shovel: low damage but unlocks the heightfield editor. The
  // TerrainEditor checks `equipped.mainHand.weaponType === "shovel"` to
  // turn on raise/lower/flatten brush input.
  shovel:         { slot: "mainHand", stats: { damage: 3 },  tier: 1, rarity: "common",  weaponType: "shovel" },
};

export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    id: "stone_axe", name: "Stone Axe", category: "tools",
    ingredients: [{ itemId: "stone", count: 2 }, { itemId: "wood", count: 3 }],
    result: { id: "stone_axe", name: "Stone Axe", type: "tool", damage: 8, icon: "🪓", quantity: 1, description: "Chops trees faster" },
  },
  {
    id: "stone_pickaxe", name: "Stone Pickaxe", category: "tools",
    ingredients: [{ itemId: "stone", count: 3 }, { itemId: "wood", count: 2 }],
    result: { id: "stone_pickaxe", name: "Stone Pickaxe", type: "tool", damage: 6, icon: "⛏️", quantity: 1, description: "Mines ore faster" },
  },
  {
    id: "iron_axe", name: "Iron Axe", category: "tools",
    ingredients: [{ itemId: "iron_ore", count: 3 }, { itemId: "wood", count: 2 }],
    result: { id: "iron_axe", name: "Iron Axe", type: "tool", damage: 14, icon: "🪓", quantity: 1, description: "Superior tree chopping" },
  },
  {
    id: "iron_pickaxe", name: "Iron Pickaxe", category: "tools",
    ingredients: [{ itemId: "iron_ore", count: 4 }, { itemId: "wood", count: 2 }],
    result: { id: "iron_pickaxe", name: "Iron Pickaxe", type: "tool", damage: 12, icon: "⛏️", quantity: 1, description: "Superior mining" },
  },
  {
    id: "torch", name: "Torch", category: "tools",
    ingredients: [{ itemId: "wood", count: 2 }, { itemId: "fiber", count: 1 }],
    result: { id: "torch", name: "Torch", type: "tool", icon: "🔦", quantity: 1, description: "Lights the way" },
  },

  {
    id: "wooden_sword", name: "Wooden Sword", category: "weapons",
    ingredients: [{ itemId: "wood", count: 5 }],
    result: { id: "wooden_sword", name: "Wooden Sword", type: "weapon", damage: 12, icon: "🗡️", quantity: 1 },
  },
  {
    id: "stone_sword", name: "Stone Sword", category: "weapons",
    ingredients: [{ itemId: "stone", count: 3 }, { itemId: "wood", count: 2 }],
    result: { id: "stone_sword", name: "Stone Sword", type: "weapon", damage: 20, icon: "🗡️", quantity: 1 },
  },
  {
    id: "iron_sword", name: "Iron Sword", category: "weapons",
    ingredients: [{ itemId: "iron_ore", count: 4 }, { itemId: "wood", count: 1 }],
    result: { id: "iron_sword", name: "Iron Sword", type: "weapon", damage: 35, icon: "⚔️", quantity: 1 },
  },
  {
    id: "wooden_bow", name: "Wooden Bow", category: "weapons",
    ingredients: [{ itemId: "wood", count: 4 }, { itemId: "fiber", count: 3 }],
    result: { id: "wooden_bow", name: "Wooden Bow", type: "weapon", damage: 18, icon: "🏹", quantity: 1 },
  },
  {
    id: "wooden_shield", name: "Wooden Shield", category: "weapons",
    ingredients: [{ itemId: "wood", count: 6 }, { itemId: "fiber", count: 2 }],
    result: { id: "wooden_shield", name: "Wooden Shield", type: "weapon", damage: 3, icon: "🛡️", quantity: 1, description: "Blocks attacks" },
  },
  {
    id: "stone_spear", name: "Stone Spear", category: "weapons",
    ingredients: [{ itemId: "stone", count: 2 }, { itemId: "wood", count: 4 }],
    result: { id: "stone_spear", name: "Stone Spear", type: "weapon", damage: 22, icon: "🔱", quantity: 1 },
  },
  {
    id: "iron_mace", name: "Iron Mace", category: "weapons",
    ingredients: [{ itemId: "iron_ore", count: 5 }, { itemId: "wood", count: 2 }],
    result: { id: "iron_mace", name: "Iron Mace", type: "weapon", damage: 38, icon: "🔨", quantity: 1 },
  },

  {
    id: "cooked_meat", name: "Cooked Meat", category: "food",
    ingredients: [{ itemId: "raw_meat", count: 1 }, { itemId: "wood", count: 1 }],
    result: { id: "cooked_meat", name: "Cooked Meat", type: "food", healAmount: 25, hungerRestore: 35, icon: "🍖", quantity: 1 },
  },
  {
    id: "berry_bowl", name: "Berry Bowl", category: "food",
    ingredients: [{ itemId: "berry", count: 5 }],
    result: { id: "berry_bowl", name: "Berry Bowl", type: "food", healAmount: 10, hungerRestore: 20, icon: "🍇", quantity: 1 },
  },
  {
    id: "herb_salad", name: "Herb Salad", category: "food",
    ingredients: [{ itemId: "herb", count: 3 }, { itemId: "berry", count: 2 }],
    result: { id: "herb_salad", name: "Herb Salad", type: "food", healAmount: 20, hungerRestore: 25, icon: "🥗", quantity: 1 },
  },
  {
    id: "meat_stew", name: "Meat Stew", category: "food",
    ingredients: [{ itemId: "raw_meat", count: 2 }, { itemId: "herb", count: 2 }, { itemId: "berry", count: 1 }],
    result: { id: "meat_stew", name: "Meat Stew", type: "food", healAmount: 40, hungerRestore: 50, icon: "🍲", quantity: 1 },
  },
  {
    id: "feast_platter", name: "Feast Platter", category: "food",
    ingredients: [{ itemId: "raw_meat", count: 3 }, { itemId: "herb", count: 3 }, { itemId: "berry", count: 3 }],
    result: { id: "feast_platter", name: "Feast Platter", type: "food", healAmount: 60, hungerRestore: 80, icon: "🍽️", quantity: 1 },
  },
  {
    id: "dried_meat", name: "Dried Meat", category: "food",
    ingredients: [{ itemId: "raw_meat", count: 2 }, { itemId: "fiber", count: 1 }],
    result: { id: "dried_meat", name: "Dried Meat", type: "food", healAmount: 15, hungerRestore: 30, icon: "🥓", quantity: 1 },
  },

  {
    id: "bandage", name: "Bandage", category: "consumables",
    ingredients: [{ itemId: "fiber", count: 3 }],
    result: { id: "bandage", name: "Bandage", type: "consumable", healAmount: 20, icon: "🩹", quantity: 1 },
  },
  {
    id: "herbal_poultice", name: "Herbal Poultice", category: "consumables",
    ingredients: [{ itemId: "herb", count: 4 }, { itemId: "fiber", count: 2 }],
    result: { id: "herbal_poultice", name: "Herbal Poultice", type: "consumable", healAmount: 45, icon: "💊", quantity: 1 },
  },
  {
    id: "stamina_tonic", name: "Stamina Tonic", category: "consumables",
    ingredients: [{ itemId: "herb", count: 3 }, { itemId: "berry", count: 3 }],
    result: { id: "stamina_tonic", name: "Stamina Tonic", type: "consumable", staminaRestore: 50, icon: "🧪", quantity: 1 },
  },
  {
    id: "antidote", name: "Antidote", category: "consumables",
    ingredients: [{ itemId: "herb", count: 5 }, { itemId: "crystal", count: 1 }],
    result: { id: "antidote", name: "Antidote", type: "consumable", healAmount: 30, icon: "💉", quantity: 1, description: "Cures poison" },
  },
  {
    id: "health_potion", name: "Health Potion", category: "consumables",
    ingredients: [{ itemId: "herb", count: 3 }, { itemId: "crystal", count: 1 }, { itemId: "berry", count: 2 }],
    result: { id: "health_potion", name: "Health Potion", type: "consumable", healAmount: 60, icon: "❤️", quantity: 1 },
  },

  {
    id: "rope", name: "Rope", category: "materials",
    ingredients: [{ itemId: "fiber", count: 4 }],
    result: { id: "rope", name: "Rope", type: "material", icon: "🪢", quantity: 1 },
  },
  {
    id: "iron_ingot", name: "Iron Ingot", category: "materials",
    ingredients: [{ itemId: "iron_ore", count: 2 }, { itemId: "wood", count: 1 }],
    result: { id: "iron_ingot", name: "Iron Ingot", type: "material", icon: "🔩", quantity: 1 },
  },
  {
    id: "nails", name: "Nails", category: "materials",
    ingredients: [{ itemId: "iron_ore", count: 1 }],
    result: { id: "nails", name: "Nails", type: "material", icon: "📌", quantity: 5 },
  },
  {
    id: "leather", name: "Leather", category: "materials",
    ingredients: [{ itemId: "raw_meat", count: 2 }, { itemId: "fiber", count: 1 }],
    result: { id: "leather", name: "Leather", type: "material", icon: "🟫", quantity: 1 },
  },
  {
    id: "cloth", name: "Cloth", category: "materials",
    ingredients: [{ itemId: "fiber", count: 5 }],
    result: { id: "cloth", name: "Cloth", type: "material", icon: "🧵", quantity: 2 },
  },

  { id: "leather_vest", name: "Leather Vest", category: "armor",
    ingredients: [{ itemId: "leather", count: 4 }, { itemId: "fiber", count: 2 }],
    result: { id: "leather_vest", name: "Leather Vest", type: "armor", icon: "🦺", quantity: 1, description: "+5 Defense" },
  },
  {
    id: "iron_helmet", name: "Iron Helmet", category: "armor",
    ingredients: [{ itemId: "iron_ingot", count: 3 }],
    result: { id: "iron_helmet", name: "Iron Helmet", type: "armor", icon: "⛑️", quantity: 1, description: "+8 Defense" },
  },
  {
    id: "iron_chestplate", name: "Iron Chestplate", category: "armor",
    ingredients: [{ itemId: "iron_ingot", count: 5 }, { itemId: "leather", count: 2 }],
    result: { id: "iron_chestplate", name: "Iron Chestplate", type: "armor", icon: "🛡️", quantity: 1, description: "+15 Defense" },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // WCS MATERIAL TIER CHAINS — Miner: Smelting (ore → ingot, 8 tiers)
  // Tier chain: Copper → Iron → Steel → Mithril → Adamantine → Orichalcum → Starmetal → Divine
  // ─────────────────────────────────────────────────────────────────────────────
  { id: "smelt_copper",      name: "Smelt Copper Ingot",      category: "smelt", ingredients: [{ itemId: "copper_ore",      count: 2 }], result: { id: "copper_ingot",      name: "Copper Ingot",      type: "material", icon: "🧲", quantity: 1 } },
  { id: "smelt_iron",        name: "Smelt Iron Ingot",        category: "smelt", ingredients: [{ itemId: "iron_ore",        count: 2 }], result: { id: "iron_ingot",        name: "Iron Ingot",        type: "material", icon: "🔩", quantity: 1 } },
  { id: "smelt_steel",       name: "Smelt Steel Ingot",       category: "smelt", ingredients: [{ itemId: "iron_ingot",      count: 2 }, { itemId: "coal", count: 1 }], result: { id: "steel_ingot",       name: "Steel Ingot",       type: "material", icon: "⚙️", quantity: 1 } },
  { id: "smelt_mithril",     name: "Smelt Mithril Ingot",     category: "smelt", ingredients: [{ itemId: "mithril_ore",     count: 2 }], result: { id: "mithril_ingot",     name: "Mithril Ingot",     type: "material", icon: "✨", quantity: 1 } },
  { id: "smelt_adamantine",  name: "Smelt Adamantine Ingot",  category: "smelt", ingredients: [{ itemId: "adamantine_ore",  count: 2 }], result: { id: "adamantine_ingot",  name: "Adamantine Ingot",  type: "material", icon: "💠", quantity: 1 } },
  { id: "smelt_orichalcum",  name: "Smelt Orichalcum Ingot",  category: "smelt", ingredients: [{ itemId: "orichalcum_ore",  count: 2 }], result: { id: "orichalcum_ingot",  name: "Orichalcum Ingot",  type: "material", icon: "🌟", quantity: 1 } },
  { id: "smelt_starmetal",   name: "Smelt Starmetal Ingot",   category: "smelt", ingredients: [{ itemId: "starmetal_ore",   count: 2 }], result: { id: "starmetal_ingot",   name: "Starmetal Ingot",   type: "material", icon: "⭐", quantity: 1 } },
  { id: "smelt_divine",      name: "Smelt Divine Ingot",      category: "smelt", ingredients: [{ itemId: "divine_ore",      count: 1 }, { itemId: "divine_essence", count: 1 }], result: { id: "divine_ingot",      name: "Divine Ingot",      type: "material", icon: "🌐", quantity: 1 } },

  // ── WCS: Forester: Woodworking (log → plank, 8 tiers) ─────────────────────────────
  // Tier chain: Pine → Oak → Maple → Ash → Ironwood → Ebony → Wyrmwood → Worldtree
  { id: "mill_pine",      name: "Mill Pine Planks",      category: "woodwork", ingredients: [{ itemId: "pine_log",      count: 2 }], result: { id: "pine_plank",      name: "Pine Plank",      type: "material", icon: "🪵", quantity: 3 } },
  { id: "mill_oak",       name: "Mill Oak Planks",       category: "woodwork", ingredients: [{ itemId: "oak_log",       count: 2 }], result: { id: "oak_plank",       name: "Oak Plank",       type: "material", icon: "🪵", quantity: 3 } },
  { id: "mill_maple",     name: "Mill Maple Planks",     category: "woodwork", ingredients: [{ itemId: "maple_log",     count: 2 }], result: { id: "maple_plank",     name: "Maple Plank",     type: "material", icon: "🪵", quantity: 3 } },
  { id: "mill_ash",       name: "Mill Ash Planks",       category: "woodwork", ingredients: [{ itemId: "ash_log",       count: 2 }], result: { id: "ash_plank",       name: "Ash Plank",       type: "material", icon: "🪵", quantity: 3 } },
  { id: "mill_ironwood",  name: "Mill Ironwood Planks",  category: "woodwork", ingredients: [{ itemId: "ironwood_log",  count: 2 }], result: { id: "ironwood_plank",  name: "Ironwood Plank",  type: "material", icon: "🪵", quantity: 2 } },
  { id: "mill_ebony",     name: "Mill Ebony Planks",     category: "woodwork", ingredients: [{ itemId: "ebony_log",     count: 2 }], result: { id: "ebony_plank",     name: "Ebony Plank",     type: "material", icon: "🪵", quantity: 2 } },
  { id: "mill_wyrmwood",  name: "Mill Wyrmwood Planks",  category: "woodwork", ingredients: [{ itemId: "wyrmwood_log",  count: 2 }], result: { id: "wyrmwood_plank",  name: "Wyrmwood Plank",  type: "material", icon: "🪵", quantity: 2 } },
  { id: "mill_worldtree", name: "Mill Worldtree Planks", category: "woodwork", ingredients: [{ itemId: "worldtree_log", count: 1 }, { itemId: "divine_essence", count: 1 }], result: { id: "worldtree_plank", name: "Worldtree Plank", type: "material", icon: "🌳", quantity: 2 } },

  // ── WCS: Forester: Leatherworking (hide → leather, 6+2 tiers) ────────────────────
  // Tier chain: Rawhide → Thick → Rugged → Hardened → Wyrm → Infernal → Titan → Divine
  { id: "tan_rawhide",   name: "Tan Rawhide Leather",   category: "leatherwork", ingredients: [{ itemId: "rawhide",      count: 2 }], result: { id: "rawhide_leather",   name: "Rawhide Leather",   type: "material", icon: "🟥", quantity: 2 } },
  { id: "tan_thick",     name: "Tan Thick Leather",     category: "leatherwork", ingredients: [{ itemId: "thick_hide",    count: 2 }], result: { id: "thick_leather",     name: "Thick Leather",     type: "material", icon: "🟥", quantity: 2 } },
  { id: "tan_rugged",    name: "Tan Rugged Leather",    category: "leatherwork", ingredients: [{ itemId: "rugged_hide",   count: 2 }], result: { id: "rugged_leather",    name: "Rugged Leather",    type: "material", icon: "🟥", quantity: 2 } },
  { id: "tan_hardened",  name: "Tan Hardened Leather",  category: "leatherwork", ingredients: [{ itemId: "hardened_hide", count: 2 }], result: { id: "hardened_leather",  name: "Hardened Leather",  type: "material", icon: "🟥", quantity: 1 } },
  { id: "tan_wyrm",      name: "Tan Wyrm Leather",      category: "leatherwork", ingredients: [{ itemId: "wyrm_hide",     count: 1 }], result: { id: "wyrm_leather",      name: "Wyrm Leather",      type: "material", icon: "🐍", quantity: 1 } },
  { id: "tan_infernal",  name: "Tan Infernal Leather",  category: "leatherwork", ingredients: [{ itemId: "infernal_hide", count: 1 }], result: { id: "infernal_leather",  name: "Infernal Leather",  type: "material", icon: "🔥", quantity: 1 } },
  { id: "tan_titan",     name: "Tan Titan Leather",     category: "leatherwork", ingredients: [{ itemId: "titan_hide",    count: 1 }], result: { id: "titan_leather",     name: "Titan Leather",     type: "material", icon: "💪", quantity: 1 } },
  { id: "tan_divine",    name: "Tan Divine Leather",    category: "leatherwork", ingredients: [{ itemId: "divine_hide",   count: 1 }, { itemId: "divine_essence", count: 1 }], result: { id: "divine_leather",    name: "Divine Leather",    type: "material", icon: "✨", quantity: 1 } },

  // ── WCS: Mystic: Weaving (thread/fiber → cloth, 8 tiers) ────────────────────
  // Tier chain: Linen → Wool → Cotton → Silk → Moonweave → Starweave → Voidweave → Divine
  { id: "weave_linen",     name: "Weave Linen Cloth",     category: "weave", ingredients: [{ itemId: "linen",     count: 4 }], result: { id: "linen_cloth",     name: "Linen Cloth",     type: "material", icon: "🧵", quantity: 2 } },
  { id: "weave_wool",      name: "Weave Wool Cloth",      category: "weave", ingredients: [{ itemId: "wool",      count: 4 }], result: { id: "wool_cloth",      name: "Wool Cloth",      type: "material", icon: "🧵", quantity: 2 } },
  { id: "weave_cotton",    name: "Weave Cotton Cloth",    category: "weave", ingredients: [{ itemId: "cotton",    count: 4 }], result: { id: "cotton_cloth",    name: "Cotton Cloth",    type: "material", icon: "🧵", quantity: 2 } },
  { id: "weave_silk",      name: "Weave Silk Cloth",      category: "weave", ingredients: [{ itemId: "silk",      count: 3 }], result: { id: "silk_cloth",      name: "Silk Cloth",      type: "material", icon: "🧵", quantity: 2 } },
  { id: "weave_moonweave", name: "Weave Moonweave",       category: "weave", ingredients: [{ itemId: "moonweave", count: 3 }, { itemId: "minor_essence", count: 1 }], result: { id: "moonweave_cloth",  name: "Moonweave Cloth",  type: "material", icon: "🌙", quantity: 1 } },
  { id: "weave_starweave", name: "Weave Starweave",       category: "weave", ingredients: [{ itemId: "starweave", count: 3 }, { itemId: "lesser_essence", count: 1 }], result: { id: "starweave_cloth",  name: "Starweave Cloth",  type: "material", icon: "⭐", quantity: 1 } },
  { id: "weave_voidweave", name: "Weave Voidweave",       category: "weave", ingredients: [{ itemId: "voidweave", count: 3 }, { itemId: "greater_essence", count: 1 }], result: { id: "voidweave_cloth",  name: "Voidweave Cloth",  type: "material", icon: "🌑", quantity: 1 } },
  { id: "weave_divine",    name: "Weave Divine Cloth",    category: "weave", ingredients: [{ itemId: "divine_cloth", count: 2 }, { itemId: "divine_essence", count: 1 }], result: { id: "divine_cloth",     name: "Divine Cloth",     type: "material", icon: "✨", quantity: 1 } },

  // ── WCS: Chef: Alchemy (potions T1–T4 starter set) ─────────────────────────────
  { id: "health_potion_t2", name: "Health Potion (T2)",  category: "alchemy", ingredients: [{ itemId: "herb", count: 5 }, { itemId: "crystal", count: 1 }], result: { id: "health_potion_t2", name: "Health Potion II",  type: "consumable", healAmount: 100, icon: "❤️", quantity: 1 } },
  { id: "mana_potion_t1",   name: "Mana Potion (T1)",   category: "alchemy", ingredients: [{ itemId: "herb", count: 3 }, { itemId: "berry", count: 4 }],          result: { id: "mana_potion_t1",   name: "Mana Potion",      type: "consumable", icon: "💙", quantity: 1 } },
  { id: "buff_str_t1",      name: "Strength Elixir",    category: "alchemy", ingredients: [{ itemId: "herb", count: 4 }, { itemId: "raw_meat", count: 2 }],       result: { id: "buff_str_t1",      name: "Strength Elixir",  type: "consumable", icon: "💪", quantity: 1, description: "+20% Damage 3min" } },
  { id: "buff_def_t1",      name: "Defense Elixir",     category: "alchemy", ingredients: [{ itemId: "herb", count: 3 }, { itemId: "stone", count: 2 }],          result: { id: "buff_def_t1",      name: "Defense Elixir",   type: "consumable", icon: "🛡️", quantity: 1, description: "+20% Defense 3min" } },

  // ── WCS: Miner: T1 Named Weapons at Forge ──────────────────────────────────────
  // T1 swords (6 named: Bloodfeud, Wraithfang, Oathbreaker, Kinrend, Dusksinger, Emberclad)
  { id: "sword_bloodfeud_t1",   name: "Bloodfeud Blade",  category: "weapons", ingredients: [{ itemId: "copper_ingot", count: 4 }, { itemId: "pine_plank", count: 1 }],  result: { id: "sword_bloodfeud_t1",   name: "Bloodfeud Blade",  type: "weapon", damage: 22, icon: "⚔️", quantity: 1 } },
  { id: "sword_wraithfang_t1",  name: "Wraithfang",       category: "weapons", ingredients: [{ itemId: "copper_ingot", count: 4 }, { itemId: "pine_plank", count: 1 }],  result: { id: "sword_wraithfang_t1",  name: "Wraithfang",       type: "weapon", damage: 24, icon: "⚔️", quantity: 1 } },
  { id: "sword_oathbreaker_t1", name: "Oathbreaker",      category: "weapons", ingredients: [{ itemId: "iron_ingot",   count: 4 }, { itemId: "oak_plank",  count: 1 }],  result: { id: "sword_oathbreaker_t1", name: "Oathbreaker",      type: "weapon", damage: 35, icon: "⚔️", quantity: 1 } },
  // T1 greatswords
  { id: "gswrd_doomspire_t1",   name: "Doomspire",         category: "weapons", ingredients: [{ itemId: "iron_ingot",   count: 6 }, { itemId: "oak_plank",  count: 2 }],  result: { id: "gswrd_doomspire_t1",   name: "Doomspire",         type: "weapon", damage: 52, icon: "🗡️", quantity: 1 } },
  { id: "gswrd_bloodspire_t1",  name: "Bloodspire",        category: "weapons", ingredients: [{ itemId: "iron_ingot",   count: 6 }, { itemId: "oak_plank",  count: 2 }],  result: { id: "gswrd_bloodspire_t1",  name: "Bloodspire",        type: "weapon", damage: 55, icon: "🗡️", quantity: 1 } },
  // T1 bows (Forester)
  { id: "bow_wraithbone_t1",    name: "Wraithbone Bow",    category: "weapons", ingredients: [{ itemId: "oak_plank",   count: 4 }, { itemId: "fiber", count: 3 }],        result: { id: "bow_wraithbone_t1",    name: "Wraithbone Bow",    type: "weapon", damage: 28, icon: "🏹", quantity: 1 } },
  // T1 staves (Mystic)
  { id: "staff_emberwrath_t1",  name: "Emberwrath Staff",  category: "weapons", ingredients: [{ itemId: "ironwood_log", count: 2 }, { itemId: "crystal", count: 2 }], result: { id: "staff_emberwrath_t1",  name: "Emberwrath Staff",  type: "weapon", damage: 30, icon: "🪄", quantity: 1 } },
  { id: "staff_glacial_t1",     name: "Glacial Spire",     category: "weapons", ingredients: [{ itemId: "ironwood_log", count: 2 }, { itemId: "crystal", count: 2 }], result: { id: "staff_glacial_t1",     name: "Glacial Spire",     type: "weapon", damage: 28, icon: "❄️", quantity: 1 } },
];

export const SURVIVAL_BUILD_RECIPES: SurvivalBuildRecipe[] = [
  {
    id: "campfire", name: "Campfire", category: "fire",
    ingredients: [{ itemId: "wood", count: 5 }, { itemId: "stone", count: 3 }],
    icon: "🔥", description: "Cook food and stay warm", size: [1.5, 0.5, 1.5], color: "#8B4513", snapType: "none",
  },
  {
    id: "fire_pit", name: "Fire Pit", category: "fire",
    ingredients: [{ itemId: "stone", count: 8 }, { itemId: "wood", count: 3 }],
    icon: "🪵", description: "Large cooking fire for group meals", size: [2.5, 0.6, 2.5], color: "#696969", snapType: "none",
  },
  {
    id: "furnace", name: "Furnace", category: "fire",
    ingredients: [{ itemId: "stone", count: 12 }, { itemId: "wood", count: 4 }],
    icon: "🏭", description: "Smelt ores into ingots", size: [1.5, 2, 1.5], color: "#555555", snapType: "none",
  },

  {
    id: "wood_foundation", name: "Wood Foundation", category: "structure",
    ingredients: [{ itemId: "wood", count: 6 }],
    icon: "🟫", description: "Wooden floor platform (4x4)", size: [4, 0.3, 4], color: "#A0522D", snapType: "foundation",
  },
  {
    id: "stone_foundation", name: "Stone Foundation", category: "structure",
    ingredients: [{ itemId: "stone", count: 8 }],
    icon: "⬜", description: "Stone floor platform (4x4)", size: [4, 0.4, 4], color: "#808080", snapType: "foundation",
  },
  {
    id: "wood_wall", name: "Wood Wall", category: "structure",
    ingredients: [{ itemId: "wood", count: 4 }],
    icon: "🪵", description: "Wooden wall segment", size: [4, 3, 0.2], color: "#8B6914", snapType: "wall",
  },
  {
    id: "wood_wall_door", name: "Wood Doorway", category: "structure",
    ingredients: [{ itemId: "wood", count: 3 }],
    icon: "🚪", description: "Wall with door opening", size: [4, 3, 0.2], color: "#8B6914", snapType: "wall",
  },
  {
    id: "wood_wall_window", name: "Wood Window Wall", category: "structure",
    ingredients: [{ itemId: "wood", count: 3 }, { itemId: "fiber", count: 1 }],
    icon: "🪟", description: "Wall with window opening", size: [4, 3, 0.2], color: "#8B6914", snapType: "wall",
  },
  {
    id: "stone_wall", name: "Stone Wall", category: "structure",
    ingredients: [{ itemId: "stone", count: 6 }],
    icon: "🧱", description: "Stone wall segment", size: [4, 3, 0.3], color: "#696969", snapType: "wall",
  },
  {
    id: "wood_roof", name: "Wood Roof", category: "structure",
    ingredients: [{ itemId: "wood", count: 5 }],
    icon: "🏠", description: "Wooden roof square", size: [4, 0.2, 4], color: "#654321", snapType: "roof",
  },
  {
    id: "wood_stairs", name: "Wood Stairs", category: "structure",
    ingredients: [{ itemId: "wood", count: 6 }],
    icon: "🪜", description: "Staircase to upper level", size: [2, 3, 4], color: "#A0522D", snapType: "none",
  },
  {
    id: "wood_door", name: "Wooden Door", category: "structure",
    ingredients: [{ itemId: "wood", count: 3 }],
    icon: "🚪", description: "Placeable door", size: [1.2, 2.5, 0.15], color: "#6B3A2A", snapType: "none",
  },

  {
    id: "workbench", name: "Workbench", category: "furniture",
    ingredients: [{ itemId: "wood", count: 8 }, { itemId: "stone", count: 2 }],
    icon: "🔨", description: "Craft advanced items", size: [2, 1, 1], color: "#8B7355", snapType: "none",
  },
  {
    id: "sleeping_bag", name: "Sleeping Bag", category: "furniture",
    ingredients: [{ itemId: "fiber", count: 10 }, { itemId: "cloth", count: 2 }],
    icon: "🛏️", description: "Set spawn point", size: [1, 0.3, 2], color: "#4a6741", snapType: "none",
  },
  {
    id: "crafting_table", name: "Crafting Table", category: "furniture",
    ingredients: [{ itemId: "wood", count: 10 }, { itemId: "nails", count: 5 }],
    icon: "🪑", description: "Unlock advanced recipes", size: [1.5, 1, 1.5], color: "#8B6914", snapType: "none",
  },
  {
    id: "drying_rack", name: "Drying Rack", category: "furniture",
    ingredients: [{ itemId: "wood", count: 6 }, { itemId: "rope", count: 2 }],
    icon: "🧺", description: "Dry meat and herbs", size: [2, 2.5, 0.5], color: "#8B7355", snapType: "none",
  },

  {
    id: "wood_fence", name: "Wood Fence", category: "defense",
    ingredients: [{ itemId: "wood", count: 3 }],
    icon: "🪵", description: "Low wooden fence", size: [4, 1.2, 0.15], color: "#8B6914", snapType: "none",
  },
  {
    id: "spike_trap", name: "Spike Trap", category: "defense",
    ingredients: [{ itemId: "wood", count: 4 }, { itemId: "iron_ore", count: 2 }],
    icon: "⚠️", description: "Damages enemies who walk over it", size: [2, 0.3, 2], color: "#5C4033", snapType: "none",
  },
  {
    id: "wood_gate", name: "Wood Gate", category: "defense",
    ingredients: [{ itemId: "wood", count: 8 }, { itemId: "iron_ore", count: 2 }],
    icon: "🚧", description: "Large swinging gate", size: [4, 2.5, 0.3], color: "#6B3A2A", snapType: "none",
  },
  {
    id: "palisade", name: "Palisade Wall", category: "defense",
    ingredients: [{ itemId: "wood", count: 6 }],
    icon: "🪵", description: "Tall pointed log wall", size: [4, 2.5, 0.3], color: "#5C3317", snapType: "none",
  },

  {
    id: "storage_box", name: "Storage Box", category: "storage",
    ingredients: [{ itemId: "wood", count: 6 }],
    icon: "📦", description: "Store extra items", size: [1.2, 0.8, 0.8], color: "#8B6914", snapType: "none",
  },
  {
    id: "large_chest", name: "Large Chest", category: "storage",
    ingredients: [{ itemId: "wood", count: 10 }, { itemId: "iron_ore", count: 2 }],
    icon: "🗃️", description: "Large item storage", size: [1.5, 1, 1], color: "#6B3A2A", snapType: "none",
  },
  {
    id: "barrel", name: "Barrel", category: "storage",
    ingredients: [{ itemId: "wood", count: 4 }, { itemId: "iron_ore", count: 1 }],
    icon: "🛢️", description: "Store liquids and materials", size: [0.8, 1.2, 0.8], color: "#8B6914", snapType: "none",
  },
];

export const useInventory = create<InventoryState>()((set, get) => ({
  items: [
    { id: "fists", name: "Fists", type: "weapon" as const, quantity: 1, damage: 5, icon: "👊" },
    // Shovel ships in the starter loadout because the editable terrain
    // is part of the core building loop — players need to be able to
    // shape the ground from the moment they reach the world.
    {
      id: "shovel", name: "Shovel", type: "tool" as const, quantity: 1, damage: 3, icon: "🪏",
      description: "Reshape the land. LMB raise · Shift+LMB lower · F flatten · G smooth.",
    },
  ],
  selectedSlot: 0,
  maxSlots: 36,

  addItem: (item) => {
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id
              ? { ...i, quantity: i.quantity + (item.quantity || 1) }
              : i
          ),
        };
      }
      if (state.items.length >= state.maxSlots) return state;
      return {
        items: [...state.items, { ...item, quantity: item.quantity || 1 } as InventoryItem],
      };
    });
  },

  removeItem: (id, quantity = 1) => {
    set((state) => {
      const item = state.items.find((i) => i.id === id);
      if (!item) return state;
      if (item.quantity <= quantity) {
        return { items: state.items.filter((i) => i.id !== id) };
      }
      return {
        items: state.items.map((i) =>
          i.id === id ? { ...i, quantity: i.quantity - quantity } : i
        ),
      };
    });
  },

  hasItem: (id, quantity = 1) => {
    const item = get().items.find((i) => i.id === id);
    return item ? item.quantity >= quantity : false;
  },

  getItem: (id) => get().items.find((i) => i.id === id),

  selectSlot: (slot) => set({ selectedSlot: slot }),

  getSelectedItem: () => {
    const { items, selectedSlot } = get();
    return items[selectedSlot];
  },

  craft: (recipe) => {
    const { hasItem, removeItem, addItem } = get();
    for (const ingredient of recipe.ingredients) {
      if (!hasItem(ingredient.itemId, ingredient.count)) return false;
    }
    for (const ingredient of recipe.ingredients) {
      removeItem(ingredient.itemId, ingredient.count);
    }
    addItem(recipe.result);
    return true;
  },

  craftSurvivalBuilding: (recipe) => {
    const { hasItem, removeItem } = get();
    for (const ingredient of recipe.ingredients) {
      if (!hasItem(ingredient.itemId, ingredient.count)) return false;
    }
    for (const ingredient of recipe.ingredients) {
      removeItem(ingredient.itemId, ingredient.count);
    }
    return true;
  },

  useItem: (id) => {
    const { items, removeItem } = get();
    const item = items.find(i => i.id === id);
    if (!item) return null;
    if (item.type === "food" || item.type === "consumable") {
      removeItem(id, 1);
      return {
        type: item.type,
        healAmount: item.healAmount,
        hungerRestore: item.hungerRestore,
        staminaRestore: item.staminaRestore,
        duration: item.duration,
      };
    }
    return null;
  },

  equipFromInventory: (id) => {
    const { items, removeItem, addItem } = get();
    const item = items.find(i => i.id === id);
    if (!item) return false;
    if (item.type !== "armor" && item.type !== "weapon" && item.type !== "tool") return false;

    const def = INVENTORY_EQUIP_MAP[id];
    if (!def) return false;

    const equipItem: EquipItem = {
      id: item.id,
      name: item.name,
      slot: def.slot,
      icon: item.icon,
      tier: def.tier,
      stats: def.stats,
      rarity: def.rarity,
      weaponType: def.weaponType,
    };

    // Swap: if something is already in this slot, return it to the inventory
    // (as long as it can be reconstructed from INVENTORY_EQUIP_MAP) so the
    // player never loses gear by re-equipping.
    const equipState = useEquipment.getState();
    const previous = equipState.equipped[def.slot];
    if (previous) {
      const prevDef = INVENTORY_EQUIP_MAP[previous.id];
      if (prevDef) {
        addItem({
          id: previous.id,
          name: previous.name,
          type: prevDef.slot === "mainHand" || prevDef.slot === "offHand" ? "weapon" : "armor",
          icon: previous.icon,
          quantity: 1,
        });
      }
    }

    // Consume one stack of the new item and equip it.
    removeItem(id, 1);
    equipState.equip(equipItem);
    return true;
  },

  reset: () =>
    set({
      items: [
        { id: "fists", name: "Fists", type: "weapon", quantity: 1, damage: 5, icon: "👊" },
        {
          id: "shovel", name: "Shovel", type: "tool", quantity: 1, damage: 3, icon: "🪏",
          description: "Reshape the land. LMB raise · Shift+LMB lower · F flatten · G smooth.",
        },
      ],
      selectedSlot: 0,
    }),
}));
