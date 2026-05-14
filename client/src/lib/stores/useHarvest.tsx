import { create } from "zustand";

export interface HarvestState {
  isHarvesting: boolean;
  harvestAnimation: string;
  harvestProgress: number;
  harvestDuration: number;
  harvestCallback: (() => void) | null;
  startHarvest: (animation: string, duration: number, callback: () => void) => void;
  tickHarvest: (delta: number) => void;
  cancelHarvest: () => void;
}

export const useHarvest = create<HarvestState>()((set, get) => ({
  isHarvesting: false,
  harvestAnimation: "",
  harvestProgress: 0,
  harvestDuration: 1,
  harvestCallback: null,

  startHarvest: (animation: string, duration: number, callback: () => void) => {
    if (get().isHarvesting) return;
    set({
      isHarvesting: true,
      harvestAnimation: animation,
      harvestProgress: 0,
      harvestDuration: duration,
      harvestCallback: callback,
    });
  },

  tickHarvest: (delta: number) => {
    const state = get();
    if (!state.isHarvesting) return;
    const newProgress = state.harvestProgress + delta;
    if (newProgress >= state.harvestDuration) {
      if (state.harvestCallback) state.harvestCallback();
      set({
        isHarvesting: false,
        harvestAnimation: "",
        harvestProgress: 0,
        harvestCallback: null,
      });
    } else {
      set({ harvestProgress: newProgress });
    }
  },

  cancelHarvest: () => {
    set({
      isHarvesting: false,
      harvestAnimation: "",
      harvestProgress: 0,
      harvestCallback: null,
    });
  },
}));
