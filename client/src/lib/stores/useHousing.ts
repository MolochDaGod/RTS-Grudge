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
  | "forge"
  | "barrel"
  | "bookshelf"
  | "cauldron";

export interface FurnitureDef {
  type: FurnitureType;
  name: string;
  icon: string;
  color: string;
  size: [number, number, number];
  cost: { itemId: string; count: number }[];
}

export const FURNITURE_CATALOG: FurnitureDef[] = [
  { type: "bed", name: "Bed", icon: "🛏️", color: "#8B4513", size: [1.2, 0.6, 2.0], cost: [{ itemId: "wood", count: 5 }] },
  { type: "table", name: "Table", icon: "🪑", color: "#A0522D", size: [1.5, 0.8, 0.8], cost: [{ itemId: "wood", count: 3 }] },
  { type: "chair", name: "Chair", icon: "💺", color: "#8B6914", size: [0.5, 0.9, 0.5], cost: [{ itemId: "wood", count: 2 }] },
  { type: "chest", name: "Storage Chest", icon: "📦", color: "#CD853F", size: [0.8, 0.6, 0.5], cost: [{ itemId: "wood", count: 4 }, { itemId: "iron_ore", count: 1 }] },
  { type: "shelf", name: "Shelf", icon: "📚", color: "#D2691E", size: [1.2, 1.5, 0.3], cost: [{ itemId: "wood", count: 3 }] },
  { type: "torch", name: "Wall Torch", icon: "🔥", color: "#FF8C00", size: [0.15, 0.5, 0.15], cost: [{ itemId: "wood", count: 1 }] },
  { type: "banner", name: "Banner", icon: "🚩", color: "#8B0000", size: [0.8, 1.5, 0.1], cost: [{ itemId: "fiber", count: 3 }] },
  { type: "rug", name: "Rug", icon: "🟫", color: "#B22222", size: [2.0, 0.05, 1.5], cost: [{ itemId: "fiber", count: 4 }] },
  { type: "forge", name: "Forge", icon: "⚒️", color: "#555555", size: [1.0, 1.0, 0.8], cost: [{ itemId: "stone", count: 5 }, { itemId: "iron_ore", count: 3 }] },
  { type: "barrel", name: "Barrel", icon: "🛢️", color: "#8B7355", size: [0.5, 0.7, 0.5], cost: [{ itemId: "wood", count: 2 }] },
  { type: "bookshelf", name: "Bookshelf", icon: "📖", color: "#654321", size: [1.0, 1.8, 0.4], cost: [{ itemId: "wood", count: 4 }] },
  { type: "cauldron", name: "Cauldron", icon: "🫕", color: "#333333", size: [0.6, 0.5, 0.6], cost: [{ itemId: "iron_ore", count: 2 }, { itemId: "stone", count: 1 }] },
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
