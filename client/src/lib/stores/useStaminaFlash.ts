import { create } from "zustand";

// Transient store the HUD listens to in order to flash the stamina
// readouts (top-left bar + bottom-right globe) when something
// noteworthy drains stamina. `seq` is bumped on every trigger so
// repeated drains of the same cost still re-fire the visual.
//
// Today only `block` is wired up (parry rebound spends 8 SP and
// looks identical to sprint loss without this cue). The `reason`
// field is here so future stamina costs (jump / dash / roll) can
// reuse the same store with a different color tint without
// breaking the existing block path — see follow-up #83.
interface StaminaFlashState {
  seq: number;
  cost: number;
  triggerBlock: (cost: number) => void;
}

export const useStaminaFlash = create<StaminaFlashState>((set) => ({
  seq: 0,
  cost: 0,
  triggerBlock: (cost: number) =>
    set((s) => ({ seq: s.seq + 1, cost })),
}));
