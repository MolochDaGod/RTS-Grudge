import { create } from "zustand";

export type FurnitureType =
  | "bed"
  | "table"
  | "chair"
  | "chest"
  | "shelf"
  | "torch"
  | "banner"
  | "rug"
  // ── WCS crafting stations (interactive — E-key opens CraftingStationUI) ──
  | "forge"             // Miner   — smelting + weapons + plate armor
  | "workbench"         // Forester + Engineer — woodwork + guns + crossbows
  | "alchemy_table"     // Chef    — potions + elixirs + food
  | "loom"              // Mystic  — cloth weaving + staves + enchanting base
  | "tannery"           // Forester — leather + armor + hides
  | "enchanting_altar"  // All     — apply infusions/enchants to gear
  // ── Decorative / storage ──
  | "barrel"
  | "bookshelf"
  | "cauldron";

/** WCS profession that this station belongs to (or null for decorative). */
export type StationProfession = "miner" | "forester" | "chef" | "engineer" | "mystic" | "all" | null;

export interface FurnitureDef {
  type: FurnitureType;
  name: string;
  icon: string;
  color: string;
  size: [number, number, number];
  cost: { itemId: string; count: number }[];
  /** If true, player standing within 3 units + pressing E opens CraftingStationUI. */
  isStation?: boolean;
  /** Which WCS profession this station serves (drives CraftingStationUI context). */
  stationProfession?: StationProfession;
  /** WCS station ID passed to CraftingStationUI. */
  stationId?: string;
  /** Brief one-line craft summary shown in the station tooltip. */
  stationCrafts?: string;
}

export const FURNITURE_CATALOG: FurnitureDef[] = [
  // ── Basic furniture ─────────────────────────────────────────────────────────────────────
  { type: "bed",       name: "Bed",           icon: "🛏️", color: "#8B4513", size: [1.2, 0.6, 2.0], cost: [{ itemId: "wood", count: 5 }] },
  { type: "table",     name: "Table",         icon: "🪑", color: "#A0522D", size: [1.5, 0.8, 0.8], cost: [{ itemId: "wood", count: 3 }] },
  { type: "chair",     name: "Chair",         icon: "💺", color: "#8B6914", size: [0.5, 0.9, 0.5], cost: [{ itemId: "wood", count: 2 }] },
  { type: "chest",     name: "Storage Chest", icon: "📦", color: "#CD853F", size: [0.8, 0.6, 0.5], cost: [{ itemId: "wood", count: 4 }, { itemId: "iron_ore", count: 1 }] },
  { type: "shelf",     name: "Shelf",         icon: "📚", color: "#D2691E", size: [1.2, 1.5, 0.3], cost: [{ itemId: "wood", count: 3 }] },
  { type: "torch",     name: "Wall Torch",    icon: "🔥", color: "#FF8C00", size: [0.15, 0.5, 0.15], cost: [{ itemId: "wood", count: 1 }] },
  { type: "banner",    name: "Banner",        icon: "🚩", color: "#8B0000", size: [0.8, 1.5, 0.1], cost: [{ itemId: "fiber", count: 3 }] },
  { type: "rug",       name: "Rug",           icon: "🟧", color: "#B22222", size: [2.0, 0.05, 1.5], cost: [{ itemId: "fiber", count: 4 }] },
  { type: "barrel",    name: "Barrel",        icon: "🛢️", color: "#8B7355", size: [0.5, 0.7, 0.5], cost: [{ itemId: "wood", count: 2 }] },
  { type: "bookshelf", name: "Bookshelf",     icon: "📖", color: "#654321", size: [1.0, 1.8, 0.4], cost: [{ itemId: "wood", count: 4 }] },
  { type: "cauldron",  name: "Cauldron",      icon: "�ap",   color: "#333333", size: [0.6, 0.5, 0.6], cost: [{ itemId: "iron_ore", count: 2 }, { itemId: "stone", count: 1 }] },

  // ── WCS Crafting Stations (interactive — press E to open 4-tab profession UI) ─────────────
  {
    type: "forge", name: "Forge", icon: "🔨", color: "#c0893a",
    size: [1.2, 1.1, 0.9], cost: [{ itemId: "stone", count: 8 }, { itemId: "iron_ore", count: 5 }],
    isStation: true, stationProfession: "miner", stationId: "forge",
    stationCrafts: "Smelt ingots · forge swords, axes, maces, shields, plate armor (T1–T8)",
  },
  {
    type: "workbench", name: "Workbench", icon: "🛠️", color: "#8B7355",
    size: [1.4, 0.9, 0.7], cost: [{ itemId: "wood", count: 6 }, { itemId: "stone", count: 2 }],
    isStation: true, stationProfession: "forester", stationId: "workbench",
    stationCrafts: "Mill planks · craft bows, leather armor, rope, tools, crossbows (T1–T8)",
  },
  {
    type: "alchemy_table", name: "Alchemy Table", icon: "⚗️", color: "#3ddc7b",
    size: [1.2, 1.0, 0.7], cost: [{ itemId: "wood", count: 4 }, { itemId: "crystal", count: 2 }, { itemId: "iron_ore", count: 2 }],
    isStation: true, stationProfession: "chef", stationId: "alchemy_table",
    stationCrafts: "Brew potions, food, elixirs, poisons · health/mana/buff potions (T1–T8)",
  },
  {
    type: "loom", name: "Loom", icon: "🧵", color: "#9155d4",
    size: [1.3, 1.3, 0.6], cost: [{ itemId: "wood", count: 5 }, { itemId: "fiber", count: 8 }],
    isStation: true, stationProfession: "mystic", stationId: "loom",
    stationCrafts: "Weave cloth (T1–T8) · craft staves, wands, tomes, cloth armor, off-hand relics",
  },
  {
    type: "tannery", name: "Tannery", icon: "🦴", color: "#7a5c3a",
    size: [1.2, 1.0, 0.8], cost: [{ itemId: "wood", count: 5 }, { itemId: "stone", count: 3 }],
    isStation: true, stationProfession: "forester", stationId: "tannery",
    stationCrafts: "Tan hides into leather (T1–T8) · craft leather armor, boots, belts, capes",
  },
  {
    type: "enchanting_altar", name: "Enchanting Altar", icon: "✨", color: "#42e8e0",
    size: [1.0, 1.2, 1.0], cost: [{ itemId: "stone", count: 6 }, { itemId: "crystal", count: 4 }, { itemId: "iron_ore", count: 2 }],
    isStation: true, stationProfession: "all", stationId: "enchanting_altar",
    stationCrafts: "Apply infusions · rune enchants · 20 infusion types across all professions",
  },
];

export interface PlacedFurniture {
  id: string;
  type: FurnitureType;
  position: [number, number, number];
  rotation: number;
}

export interface StorageItem {
  id: string;
  name: string;
  type: "weapon" | "food" | "material" | "tool" | "consumable" | "building" | "armor";
  quantity: number;
  damage?: number;
  healAmount?: number;
  icon: string;
}

interface HousingState {
  unlocked: boolean;
  furniture: PlacedFurniture[];
  storage: StorageItem[];
  maxStorage: number;
  buildMode: boolean;
  selectedFurnitureType: FurnitureType | null;
  storageOpen: boolean;

  unlockHouse: () => void;
  setBuildMode: (v: boolean) => void;
  setSelectedFurnitureType: (t: FurnitureType | null) => void;
  setStorageOpen: (v: boolean) => void;

  placeFurniture: (type: FurnitureType, position: [number, number, number], rotation?: number) => string;
  removeFurniture: (id: string) => void;
  moveFurniture: (id: string, position: [number, number, number]) => void;
  rotateFurniture: (id: string, rotation: number) => void;

  addToStorage: (item: StorageItem) => boolean;
  removeFromStorage: (id: string, quantity?: number) => void;
  getStorageItem: (id: string) => StorageItem | undefined;
  hasStorageSpace: () => boolean;
}

let furnitureIdCounter = 0;

export const useHousing = create<HousingState>()((set, get) => ({
  unlocked: true,
  furniture: [
    { id: "starter_chest", type: "chest", position: [3, 0, -3], rotation: 0 },
    { id: "starter_torch1", type: "torch", position: [-4.8, 1.5, 0], rotation: 0 },
    { id: "starter_torch2", type: "torch", position: [4.8, 1.5, 0], rotation: Math.PI },
  ],
  storage: [],
  maxStorage: 30,
  buildMode: false,
  selectedFurnitureType: null,
  storageOpen: false,

  unlockHouse: () => set({ unlocked: true }),
  setBuildMode: (v) => set({ buildMode: v, selectedFurnitureType: null, storageOpen: false }),
  setSelectedFurnitureType: (t) => set({ selectedFurnitureType: t }),
  setStorageOpen: (v) => set({ storageOpen: v, buildMode: false }),

  placeFurniture: (type, position, rotation = 0) => {
    const id = `furn_${++furnitureIdCounter}`;
    set((s) => ({
      furniture: [...s.furniture, { id, type, position, rotation }],
      selectedFurnitureType: null,
    }));
    return id;
  },

  removeFurniture: (id) => {
    set((s) => ({ furniture: s.furniture.filter((f) => f.id !== id) }));
  },

  moveFurniture: (id, position) => {
    set((s) => ({
      furniture: s.furniture.map((f) => (f.id === id ? { ...f, position } : f)),
    }));
  },

  rotateFurniture: (id, rotation) => {
    set((s) => ({
      furniture: s.furniture.map((f) => (f.id === id ? { ...f, rotation } : f)),
    }));
  },

  addToStorage: (item) => {
    const { storage, maxStorage } = get();
    const existing = storage.find((s) => s.id === item.id);
    if (existing) {
      set((s) => ({
        storage: s.storage.map((si) =>
          si.id === item.id ? { ...si, quantity: si.quantity + item.quantity } : si
        ),
      }));
      return true;
    }
    if (storage.length >= maxStorage) return false;
    set((s) => ({ storage: [...s.storage, { ...item }] }));
    return true;
  },

  removeFromStorage: (id, quantity = 1) => {
    set((s) => {
      const item = s.storage.find((si) => si.id === id);
      if (!item) return s;
      if (item.quantity <= quantity) {
        return { storage: s.storage.filter((si) => si.id !== id) };
      }
      return {
        storage: s.storage.map((si) =>
          si.id === id ? { ...si, quantity: si.quantity - quantity } : si
        ),
      };
    });
  },

  getStorageItem: (id) => get().storage.find((si) => si.id === id),

  hasStorageSpace: () => get().storage.length < get().maxStorage,
}));
