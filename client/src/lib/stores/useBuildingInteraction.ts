import { create } from "zustand";

/**
 * Tracks which system the currently-open building comes from:
 *   "survival" = player-placed survival building (useSurvivalBuilding)
 *   "world"    = static world object (WorldObjectRegistry)
 */
export type BuildingSource = "survival" | "world";

export interface BuildingInteractionState {
  /** ID/UID of the currently open building panel */
  openBuildingUid: string | null;
  /** Which registry the open building comes from */
  openBuildingSource: BuildingSource | null;
  /** ID/UID of the building the player is near (for [E] prompt) */
  nearbyBuildingUid: string | null;
  nearbyBuildingSource: BuildingSource | null;
  /** Display name/icon of the nearby building */
  nearbyBuildingName: string | null;
  nearbyBuildingIcon: string | null;

  /** Open a player-placed survival building by UID */
  openBuilding: (uid: string) => void;
  /** Open a static world object by its WorldObjectRegistry id */
  openWorldBuilding: (id: string) => void;
  closeBuilding: () => void;
  setNearbyBuilding: (
    uid: string | null,
    source?: BuildingSource | null,
    name?: string | null,
    icon?: string | null
  ) => void;
}

export const useBuildingInteraction = create<BuildingInteractionState>((set) => ({
  openBuildingUid: null,
  openBuildingSource: null,
  nearbyBuildingUid: null,
  nearbyBuildingSource: null,
  nearbyBuildingName: null,
  nearbyBuildingIcon: null,

  openBuilding: (uid) => set({ openBuildingUid: uid, openBuildingSource: "survival" }),
  openWorldBuilding: (id) => set({ openBuildingUid: id, openBuildingSource: "world" }),
  closeBuilding: () => set({ openBuildingUid: null, openBuildingSource: null }),
  setNearbyBuilding: (uid, source = null, name = null, icon = null) =>
    set({ nearbyBuildingUid: uid, nearbyBuildingSource: source, nearbyBuildingName: name, nearbyBuildingIcon: icon }),
}));
