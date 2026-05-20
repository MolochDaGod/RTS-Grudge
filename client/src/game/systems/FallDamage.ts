import { create } from "zustand";
import { useSurvival } from "@/lib/stores/useSurvival";

// ---------------------------------------------------------------------------
// Fall Damage — Conan Exiles-inspired height-based landing damage.
//
// Tracks the highest Y the player reaches while airborne. On landing,
// computes fall height and applies damage via a tunable curve:
//
//   0–3m     : safe (no damage)
//   3–10m    : linear ramp from 10 → 50 HP
//   10–15m   : steep ramp 50 → 80 HP
//   15m+     : lethal (100+ HP, effectively kills most characters)
//
// "Controlled drop" (dodge key while climbing) halves fall damage and
// applies a small horizontal push-off velocity — mirrors Conan's mechanic
// where tapping dodge on a wall lets you descend faster but safely.
//
// Integration:
//   - Player.tsx calls `trackAltitude(y, isGrounded)` every frame
//   - characterMachine CONTROLLED_DROP → sets the flag here
//   - On LAND transition, Player.tsx calls `resolveFallDamage()`
// ---------------------------------------------------------------------------

// --- Damage curve constants ---
const SAFE_HEIGHT       = 3.0;   // metres — no damage below this
const MID_HEIGHT        = 10.0;  // metres — moderate damage threshold
const HIGH_HEIGHT       = 15.0;  // metres — near-lethal threshold
const DAMAGE_AT_MID     = 50;    // HP at mid-height
const DAMAGE_AT_HIGH    = 80;    // HP at high-height
const DAMAGE_PER_M_OVER = 8;     // extra HP per metre above HIGH_HEIGHT

const CONTROLLED_DROP_MULT = 0.5; // 50% damage reduction

// --- Landing effects ---
export type LandingType = "safe" | "light" | "hard" | "lethal";

export function classifyLanding(fallHeight: number): LandingType {
  if (fallHeight < SAFE_HEIGHT)     return "safe";
  if (fallHeight < MID_HEIGHT)      return "light";
  if (fallHeight < HIGH_HEIGHT)     return "hard";
  return "lethal";
}

// --- Damage calculation ---
export function computeFallDamage(fallHeight: number, controlledDrop: boolean): number {
  if (fallHeight <= SAFE_HEIGHT) return 0;

  let damage: number;
  if (fallHeight <= MID_HEIGHT) {
    // Linear ramp: 0 at SAFE_HEIGHT → DAMAGE_AT_MID at MID_HEIGHT
    const t = (fallHeight - SAFE_HEIGHT) / (MID_HEIGHT - SAFE_HEIGHT);
    damage = t * DAMAGE_AT_MID;
  } else if (fallHeight <= HIGH_HEIGHT) {
    // Steeper ramp: DAMAGE_AT_MID → DAMAGE_AT_HIGH
    const t = (fallHeight - MID_HEIGHT) / (HIGH_HEIGHT - MID_HEIGHT);
    damage = DAMAGE_AT_MID + t * (DAMAGE_AT_HIGH - DAMAGE_AT_MID);
  } else {
    // Beyond HIGH_HEIGHT: DAMAGE_AT_HIGH + linear overflow
    damage = DAMAGE_AT_HIGH + (fallHeight - HIGH_HEIGHT) * DAMAGE_PER_M_OVER;
  }

  if (controlledDrop) {
    damage *= CONTROLLED_DROP_MULT;
  }

  return Math.round(damage);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export interface FallDamageState {
  /** Highest Y reached during current airborne period */
  peakY: number;
  /** Y when the player last left the ground */
  launchY: number;
  /** True while the player is airborne */
  airborne: boolean;
  /** True if the player initiated a controlled drop (dodge while climbing) */
  controlledDrop: boolean;
  /** Last computed fall damage (for HUD display / camera shake intensity) */
  lastFallDamage: number;
  /** Last landing type (for animation selection) */
  lastLandingType: LandingType;
  /** Camera shake intensity (0–1, decays over time) */
  cameraShake: number;

  // Actions
  trackAltitude: (y: number, isGrounded: boolean) => void;
  setControlledDrop: (v: boolean) => void;
  resolveFallDamage: () => number;
  tickShake: (dt: number) => void;
}

export const useFallDamage = create<FallDamageState>((set, get) => ({
  peakY: 0,
  launchY: 0,
  airborne: false,
  controlledDrop: false,
  lastFallDamage: 0,
  lastLandingType: "safe",
  cameraShake: 0,

  trackAltitude: (y, isGrounded) => {
    const s = get();
    if (isGrounded) {
      if (s.airborne) {
        // Transition: airborne → grounded — resolve handled by explicit call
        set({ airborne: false });
      }
      // Keep peakY and launchY updated to current ground level
      set({ peakY: y, launchY: y });
    } else {
      if (!s.airborne) {
        // Transition: grounded → airborne
        set({ airborne: true, launchY: y, peakY: y, controlledDrop: false });
      } else if (y > s.peakY) {
        set({ peakY: y });
      }
    }
  },

  setControlledDrop: (v) => set({ controlledDrop: v }),

  resolveFallDamage: () => {
    const s = get();
    const fallHeight = s.peakY - (useSurvival.getState().health > 0 ? s.launchY : s.peakY);
    // Use the difference between peak and current ground Y
    const actualFall = Math.max(0, s.peakY - s.launchY);

    const damage = computeFallDamage(actualFall, s.controlledDrop);
    const landingType = classifyLanding(actualFall);

    // Apply damage
    if (damage > 0) {
      useSurvival.getState().takeDamage(damage, "fall");
    }

    // Camera shake proportional to damage (capped at 1.0)
    const shakeIntensity = damage > 0
      ? Math.min(1.0, damage / DAMAGE_AT_HIGH)
      : 0;

    set({
      lastFallDamage: damage,
      lastLandingType: landingType,
      cameraShake: shakeIntensity,
      controlledDrop: false,
    });

    return damage;
  },

  tickShake: (dt) => set((s) => ({
    cameraShake: Math.max(0, s.cameraShake - dt * 3), // decays over ~0.33s
  })),
}));

// ---------------------------------------------------------------------------
// Convenience selectors
// ---------------------------------------------------------------------------
export const selectCameraShake = (s: FallDamageState) => s.cameraShake;
export const selectLastLanding = (s: FallDamageState) => s.lastLandingType;
