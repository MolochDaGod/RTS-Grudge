import { create } from "zustand";

// Transient store the HUD listens to in order to flash a colored
// vignette whenever the player loses HP. `seq` is bumped on every
// trigger so back-to-back hits of the same damage still re-fire the
// visual.
//
// Mirrors the shape of `useStaminaFlash` so the HUD effect-overlay
// pattern stays consistent (key off `seq`, read latest payload).
//
// `damage` is forwarded so the overlay can scale the flash intensity
// lightly with hit size — see DamageFlashOverlay in HUD.tsx.
//
// `source` lets the overlay tint the vignette per damage kind
// (red for physical/projectile/melee, green for poison, orange for
// burn, white for fall) so the flash also conveys *what* hit you.
// Most callers should fire this through `useSurvival.takeDamage`,
// which routes every HP-draining path here automatically.
export type DamageFlashSource =
  | "physical"
  | "burn"
  | "poison"
  | "fall";

interface DamageFlashState {
  seq: number;
  damage: number;
  source: DamageFlashSource;
  triggerHit: (damage: number, source?: DamageFlashSource) => void;
}

export const useDamageFlash = create<DamageFlashState>((set) => ({
  seq: 0,
  damage: 0,
  source: "physical",
  triggerHit: (damage: number, source: DamageFlashSource = "physical") =>
    set((s) => ({
      seq: s.seq + 1,
      damage: Math.max(0, damage),
      source,
    })),
}));
