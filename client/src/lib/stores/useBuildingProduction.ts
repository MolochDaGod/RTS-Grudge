/**
 * useBuildingProduction — per-building item production queue.
 *
 * Each player-placed building can produce specific items based on its type.
 * The campfire cooks food, the workbench crafts tools, the barracks trains units, etc.
 *
 * Production is gated by:
 *   - Ingredients in the player's inventory (or camp stockpile)
 *   - Resource cost (wood/stone/gold)
 *   - Time (productionDef.durationSecs)
 *
 * On completion, the finished item is added to the player's inventory.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useInventory, type InventoryItem } from "./useInventory";
import { useBuildSystem } from "./useBuildSystem";

// ---------------------------------------------------------------------------
// Production definition — what a building CAN produce
// ---------------------------------------------------------------------------

export interface BuildingProductionDef {
  id: string;
  label: string;
  icon: string;
  durationSecs: number;
  /** Items consumed from player inventory when production starts. */
  ingredients: { itemId: string; qty: number }[];
  /** Resource cost deducted from the build system. */
  resourceCost?: { wood?: number; stone?: number; gold?: number };
  /** What gets added to inventory on completion. */
  result: Omit<InventoryItem, "quantity"> & { quantity: number };
}

// ---------------------------------------------------------------------------
// Production definitions per building recipe ID
// ---------------------------------------------------------------------------

export const BUILDING_PRODUCTION_DEFS: Record<string, BuildingProductionDef[]> = {
  // ── Campfire / Fire Pit ───────────────────────────────────────────────────
  campfire: [
    {
      id: "cook_meat", label: "Cook Meat", icon: "🍖",
      durationSecs: 20,
      ingredients: [{ itemId: "raw_meat", qty: 1 }],
      result: { id: "cooked_meat", name: "Cooked Meat", type: "food", icon: "🍖", healAmount: 25, hungerRestore: 35, quantity: 1 },
    },
    {
      id: "cook_stew", label: "Meat Stew", icon: "🍲",
      durationSecs: 45,
      ingredients: [{ itemId: "raw_meat", qty: 2 }, { itemId: "herb", qty: 1 }],
      result: { id: "meat_stew", name: "Meat Stew", type: "food", icon: "🍲", healAmount: 40, hungerRestore: 50, quantity: 1 },
    },
    {
      id: "cook_berries", label: "Berry Bowl", icon: "🫐",
      durationSecs: 12,
      ingredients: [{ itemId: "berry", qty: 4 }],
      result: { id: "berry_bowl", name: "Berry Bowl", type: "food", icon: "🫐", healAmount: 10, hungerRestore: 20, quantity: 1 },
    },
  ],
  fire_pit: [
    {
      id: "cook_feast", label: "Feast Platter", icon: "🍽️",
      durationSecs: 90,
      ingredients: [{ itemId: "raw_meat", qty: 3 }, { itemId: "herb", qty: 2 }, { itemId: "berry", qty: 3 }],
      result: { id: "feast_platter", name: "Feast Platter", type: "food", icon: "🍽️", healAmount: 60, hungerRestore: 80, quantity: 1 },
    },
  ],
  furnace: [
    {
      id: "smelt_iron", label: "Smelt Iron", icon: "⚙️",
      durationSecs: 60,
      ingredients: [{ itemId: "iron_ore", qty: 2 }, { itemId: "wood", qty: 1 }],
      result: { id: "iron_ingot", name: "Iron Ingot", type: "material", icon: "🔩", quantity: 1 },
    },
  ],

  // ── Workbench / Crafting Table ────────────────────────────────────────────
  workbench: [
    {
      id: "craft_stone_axe", label: "Stone Axe", icon: "🪓",
      durationSecs: 30,
      ingredients: [{ itemId: "stone", qty: 2 }, { itemId: "wood", qty: 3 }],
      result: { id: "stone_axe", name: "Stone Axe", type: "tool", icon: "🪓", damage: 8, quantity: 1 },
    },
    {
      id: "craft_stone_pick", label: "Stone Pickaxe", icon: "⛏️",
      durationSecs: 30,
      ingredients: [{ itemId: "stone", qty: 3 }, { itemId: "wood", qty: 2 }],
      result: { id: "stone_pickaxe", name: "Stone Pickaxe", type: "tool", icon: "⛏️", damage: 6, quantity: 1 },
    },
    {
      id: "craft_bandage", label: "Bandage", icon: "🩹",
      durationSecs: 20,
      ingredients: [{ itemId: "fiber", qty: 3 }],
      result: { id: "bandage", name: "Bandage", type: "consumable", icon: "🩹", healAmount: 20, quantity: 1 },
    },
    {
      id: "craft_medpack", label: "Basic Medpack", icon: "💊",
      durationSecs: 45,
      ingredients: [{ itemId: "herb", qty: 4 }, { itemId: "fiber", qty: 2 }],
      result: { id: "medpack_basic", name: "Basic Medpack", type: "consumable", icon: "💊", healAmount: 50, quantity: 1 },
    },
  ],
  crafting_table: [
    {
      id: "craft_iron_axe", label: "Iron Axe", icon: "🪓",
      durationSecs: 90,
      ingredients: [{ itemId: "iron_ingot", qty: 3 }, { itemId: "wood", qty: 2 }],
      result: { id: "iron_axe", name: "Iron Axe", type: "tool", icon: "🪓", damage: 14, quantity: 1 },
    },
    {
      id: "craft_health_potion", label: "Health Potion", icon: "❤️‍🔥",
      durationSecs: 60,
      ingredients: [{ itemId: "herb", qty: 3 }, { itemId: "crystal", qty: 1 }, { itemId: "berry", qty: 2 }],
      result: { id: "health_potion", name: "Health Potion", type: "consumable", icon: "❤️‍🔥", healAmount: 60, quantity: 1 },
    },
  ],

  // ── Storage buildings produce nothing but their E-key opens the chest ────
  storage_box: [],
  large_chest: [],
  barrel: [],

  // ── Defense / Military ────────────────────────────────────────────────────
  spike_trap: [],
  wood_fence: [],
  palisade: [],
};

// ---------------------------------------------------------------------------
// Active production entry (in-flight or complete)
// ---------------------------------------------------------------------------

export interface ProductionEntry {
  uid: string;           // building UID
  defId: string;         // production def ID
  startedAt: number;     // Date.now() when production started
  durationMs: number;    // total duration in ms
  result: Omit<InventoryItem, "quantity"> & { quantity: number };
  collected: boolean;
}

interface BuildingProductionState {
  /** uid → active production entry */
  active: Record<string, ProductionEntry>;

  /** Start production for a building. Returns false if missing ingredients or already producing. */
  startProduction: (buildingUid: string, def: BuildingProductionDef) => boolean;

  /** Collect a finished item — moves it to player inventory. */
  collect: (buildingUid: string) => boolean;

  /** Cancel an in-progress production (no refund). */
  cancel: (buildingUid: string) => void;

  /** Progress 0–1 for a building's current production. */
  getProgress: (buildingUid: string) => number | null;

  /** True if the building has a finished, uncollected item. */
  isReady: (buildingUid: string) => boolean;

  /** True if the building is currently producing something. */
  isProducing: (buildingUid: string) => boolean;
}

export const useBuildingProduction = create<BuildingProductionState>()(
  subscribeWithSelector((set, get) => ({
    active: {},

    startProduction: (buildingUid, def) => {
      const { active } = get();
      // Already producing — don't overwrite
      if (active[buildingUid] && !active[buildingUid].collected) return false;

      const inv = useInventory.getState();

      // Check ingredients
      for (const ing of def.ingredients) {
        if (!inv.hasItem(ing.itemId, ing.qty)) {
          console.warn(`[Production] Missing ${ing.qty}x ${ing.itemId} for ${def.label}`);
          return false;
        }
      }

      // Consume resource cost from build system
      if (def.resourceCost) {
        const bs = useBuildSystem.getState();
        const r = bs.resources;
        if (
          (def.resourceCost.wood  ?? 0) > r.wood  ||
          (def.resourceCost.stone ?? 0) > r.stone ||
          (def.resourceCost.gold  ?? 0) > r.gold
        ) {
          console.warn(`[Production] Insufficient resources for ${def.label}`);
          return false;
        }
        if (def.resourceCost.wood)  bs.spendResources({ wood:  def.resourceCost.wood });
        if (def.resourceCost.stone) bs.spendResources({ stone: def.resourceCost.stone });
        if (def.resourceCost.gold)  bs.spendResources({ gold:  def.resourceCost.gold });
      }

      // Consume ingredients
      for (const ing of def.ingredients) {
        inv.removeItem(ing.itemId, ing.qty);
      }

      const entry: ProductionEntry = {
        uid: buildingUid,
        defId: def.id,
        startedAt: Date.now(),
        durationMs: def.durationSecs * 1000,
        result: def.result,
        collected: false,
      };

      set(s => ({ active: { ...s.active, [buildingUid]: entry } }));
      return true;
    },

    collect: (buildingUid) => {
      const entry = get().active[buildingUid];
      if (!entry || entry.collected) return false;
      const elapsed = Date.now() - entry.startedAt;
      if (elapsed < entry.durationMs) return false; // not done yet

      useInventory.getState().addItem(entry.result);

      set(s => {
        const next = { ...s.active };
        delete next[buildingUid];
        return { active: next };
      });
      return true;
    },

    cancel: (buildingUid) => {
      set(s => {
        const next = { ...s.active };
        delete next[buildingUid];
        return { active: next };
      });
    },

    getProgress: (buildingUid) => {
      const entry = get().active[buildingUid];
      if (!entry || entry.collected) return null;
      const elapsed = Date.now() - entry.startedAt;
      return Math.min(1, elapsed / entry.durationMs);
    },

    isReady: (buildingUid) => {
      const entry = get().active[buildingUid];
      if (!entry || entry.collected) return false;
      return Date.now() - entry.startedAt >= entry.durationMs;
    },

    isProducing: (buildingUid) => {
      const entry = get().active[buildingUid];
      if (!entry || entry.collected) return false;
      return Date.now() - entry.startedAt < entry.durationMs;
    },
  }))
);
