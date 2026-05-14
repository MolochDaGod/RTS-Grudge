import { create } from "zustand";

export const CHARGE_TIER_1_MS = 500;
export const CHARGE_TIER_2_MS = 1000;

interface ChargeHudState {
  active: boolean;
  holdMs: number;
  tier: 0 | 1 | 2;
  setCharge: (active: boolean, holdMs: number, tier: 0 | 1 | 2) => void;
  clear: () => void;
}

export const useChargeHud = create<ChargeHudState>((set) => ({
  active: false,
  holdMs: 0,
  tier: 0,
  setCharge: (active, holdMs, tier) => set((s) => {
    if (s.active === active && s.holdMs === holdMs && s.tier === tier) return s;
    return { active, holdMs, tier };
  }),
  clear: () => set((s) => {
    if (!s.active && s.holdMs === 0 && s.tier === 0) return s;
    return { active: false, holdMs: 0, tier: 0 };
  }),
}));
