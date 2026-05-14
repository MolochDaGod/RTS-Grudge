import { create } from "zustand";

// Transient store the HUD listens to in order to flash a brief
// white/gold edge vignette whenever the player lands a successful
// parry / perfect-block. `seq` is bumped on every trigger so
// back-to-back parries still re-fire the visual.
//
// Mirrors the shape of `useDamageFlash` and `useStaminaFlash` so the
// HUD effect-overlay pattern stays consistent (key off `seq`, render a
// short keyframe animation, gate on `gameplay.flashEffects`).
//
// Today only projectile rebounds (handleProjectileBlock in Player.tsx)
// are wired up — those are themselves the "perfect" timing window, since
// a regular RMB hold without aim/timing simply soaks damage rather than
// deflecting. Future melee perfect-block detection should also call
// `trigger()` from this store rather than introducing a parallel one.
interface ParryFlashState {
  seq: number;
  trigger: () => void;
}

export const useParryFlash = create<ParryFlashState>((set) => ({
  seq: 0,
  trigger: () => set((s) => ({ seq: s.seq + 1 })),
}));
