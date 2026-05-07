import { create } from "zustand";
import type { SurvivalBuildRecipe } from "./useInventory";
import { useCampaign } from "./useCampaign";

export interface PlacedSurvivalBuilding {
  uid: string;
  recipeId: string;
  position: [number, number, number];
  rotation: number;
  size: [number, number, number];
  color: string;
  name: string;
  icon: string;
  health: number;
  maxHealth: number;
}

interface SurvivalBuildingState {
  placedBuildings: PlacedSurvivalBuilding[];
  pendingRecipe: SurvivalBuildRecipe | null;
  ghostPosition: [number, number, number] | null;
  ghostRotation: number;

  setPendingRecipe: (recipe: SurvivalBuildRecipe | null) => void;
  setGhostPosition: (pos: [number, number, number] | null) => void;
  rotateGhost: () => void;
  placeBuilding: () => boolean;
  removeBuilding: (uid: string) => void;
  damageBuilding: (uid: string, amount: number) => void;
}

let uidCounter = 0;

export const useSurvivalBuilding = create<SurvivalBuildingState>((set, get) => ({
  placedBuildings: [],
  pendingRecipe: null,
  ghostPosition: null,
  ghostRotation: 0,

  setPendingRecipe: (recipe) => set({ pendingRecipe: recipe, ghostPosition: null, ghostRotation: 0 }),

  setGhostPosition: (pos) => set({ ghostPosition: pos }),

  rotateGhost: () => set(s => ({ ghostRotation: (s.ghostRotation + Math.PI / 2) % (Math.PI * 2) })),

  placeBuilding: () => {
    const { pendingRecipe, ghostPosition, ghostRotation } = get();
    if (!pendingRecipe || !ghostPosition) return false;

    const uid = `sb_${++uidCounter}_${Date.now()}`;
    const maxHealth = pendingRecipe.category === "structure" ? 200 : 100;

    const placed: PlacedSurvivalBuilding = {
      uid,
      recipeId: pendingRecipe.id,
      position: [...ghostPosition],
      rotation: ghostRotation,
      size: pendingRecipe.size,
      color: pendingRecipe.color,
      name: pendingRecipe.name,
      icon: pendingRecipe.icon,
      health: maxHealth,
      maxHealth,
    };

    set(s => ({
      placedBuildings: [...s.placedBuildings, placed],
      pendingRecipe: null,
      ghostPosition: null,
    }));

    // Advance any active "build" quest by one for each placement.
    useCampaign.getState().recordBuild(1);
    return true;
  },

  removeBuilding: (uid) => set(s => ({
    placedBuildings: s.placedBuildings.filter(b => b.uid !== uid),
  })),

  damageBuilding: (uid, amount) => set(s => ({
    placedBuildings: s.placedBuildings
      .map(b => b.uid === uid ? { ...b, health: Math.max(0, b.health - amount) } : b)
      .filter(b => b.health > 0),
  })),
}));
