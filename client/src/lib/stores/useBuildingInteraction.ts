import { create } from "zustand";

export interface BuildingInteractionState {
  /** UID of the building currently open in the interaction panel */
  openBuildingUid: string | null;
  /** UID of the building the player is near (for [E] prompt) */
  nearbyBuildingUid: string | null;
  /** Name/icon of the nearby building for the prompt */
  nearbyBuildingName: string | null;
  nearbyBuildingIcon: string | null;

  openBuilding: (uid: string) => void;
  closeBuilding: () => void;
  setNearbyBuilding: (uid: string | null, name?: string | null, icon?: string | null) => void;
}

export const useBuildingInteraction = create<BuildingInteractionState>((set) => ({
  openBuildingUid: null,
  nearbyBuildingUid: null,
  nearbyBuildingName: null,
  nearbyBuildingIcon: null,

  openBuilding: (uid) => set({ openBuildingUid: uid }),
  closeBuilding: () => set({ openBuildingUid: null }),
  setNearbyBuilding: (uid, name = null, icon = null) =>
    set({ nearbyBuildingUid: uid, nearbyBuildingName: name, nearbyBuildingIcon: icon }),
}));
