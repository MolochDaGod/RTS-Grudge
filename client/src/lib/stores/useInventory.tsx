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

export type CraftCategory = "tools" | "weapons" | "food" | "consumables" | "materials" | "armor";

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

  {
    id: "leather_vest", name: "Leather Vest", category: "armor",
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
