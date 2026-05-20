import { create } from "zustand";
import { useFatigue, DRAIN_RATES } from "./FatigueSystem";
import { useSurvival } from "@/lib/stores/useSurvival";

// ---------------------------------------------------------------------------
// Swim physics — buoyancy, drag, surface tension, drowning, breath meter.
//
// Called per-frame from Player.tsx when `isInWater(py)` is true.
// Returns force/velocity adjustments for the Rapier rigid body.
//
// Conan Exiles-inspired additions:
//   - Breath meter (30s, separate from stamina)
//   - Encumbrance drag (heavier gear = slower swim)
//   - Water current vector support
// ---------------------------------------------------------------------------

/** Water surface y (read from WaterVolume.ts or passed in). */
export const WATER_SURFACE_Y_DEFAULT = -1.0;

// --- Buoyancy ---
// Upward force proportional to how much of the capsule is submerged.
// At the surface, buoyancy ≈ gravity so the character floats.
const BUOYANCY_FORCE   = 14.0;  // max upward force at full submersion
const GRAVITY_APPROX   = 9.81;

// --- Drag ---
// Velocity damping that increases with depth.
const DRAG_SURFACE     = 0.3;   // fraction of velocity preserved at surface
const DRAG_DEEP        = 0.5;   // fraction damped at deep depth
const DEEP_THRESHOLD   = 3.0;   // meters below surface to reach max drag

// --- Surface tension ---
// When the character is within this band around the water surface, they
// get a soft snap to the surface-swim pose (head above water).
const SURFACE_BAND     = 0.3;   // meters ± from surface

// --- Drowning ---
const DROWNING_DAMAGE_PER_SEC = 8;  // health per second when drowning

// --- Breath meter (Conan-style) ---
const MAX_BREATH          = 30.0;  // seconds of breath at full
const BREATH_DEPLETE_RATE = 1.0;   // 1 second of breath per real second submerged
const BREATH_RECOVER_RATE = 3.0;   // recovers 3× faster when at surface
const BREATH_DROWN_THRESHOLD = 0;  // start drowning when breath hits 0

// --- Encumbrance ---
// Swim speed penalty based on carried weight. 0 weight = no penalty, maxWeight = 40% slower.
const ENCUMBRANCE_MAX_PENALTY = 0.4; // 40% speed reduction at max weight

export interface SwimInput {
  /** Player capsule foot-y in world space. */
  playerY: number;
  /** Water surface y (may vary by zone). */
  waterSurfaceY: number;
  /** Character capsule total height. */
  capsuleHeight: number;
  /** Current vertical velocity. */
  vy: number;
  /** Current horizontal speed magnitude. */
  horizontalSpeed: number;
  /** Player is pressing dive key (Alt/LCtrl). */
  wantsDive: boolean;
  /** Player is pressing ascend key (Space). */
  wantsAscend: boolean;
  /** Frame delta. */
  delta: number;
  /** Current encumbrance ratio 0–1 (0 = empty, 1 = max carry weight). */
  encumbranceRatio?: number;
  /** External water current force [x, y, z] applied to the player. */
  waterCurrent?: [number, number, number];
}

export interface SwimOutput {
  /** Vertical force to apply (positive = up). */
  buoyancyForce: number;
  /** Horizontal speed multiplier (0–1). */
  horizontalDrag: number;
  /** Vertical velocity override (null = let physics resolve). */
  vyOverride: number | null;
  /** True when the character should snap to surface-swim pose. */
  atSurface: boolean;
  /** True when the character is actively diving below surface. */
  isDiving: boolean;
  /** True when drowning is active (out of breath underwater). */
  isDrowning: boolean;
  /** Submersion ratio 0–1 (0 = out of water, 1 = fully submerged). */
  submersion: number;
  /** Current force vector applied by water current [x, y, z]. */
  currentForce: [number, number, number];
}

/**
 * Compute swim physics for a single frame.
 */
export function computeSwimPhysics(input: SwimInput): SwimOutput {
  const { playerY, waterSurfaceY, capsuleHeight, vy, wantsDive, wantsAscend, delta } = input;

  // How deep the character's centre-mass is below the surface
  const charCenter = playerY + capsuleHeight * 0.5;
  const depth = waterSurfaceY - charCenter;

  // Submersion: 0 when centre is at surface, 1 when fully below
  const submersion = Math.max(0, Math.min(1, depth / capsuleHeight));

  // --- Buoyancy ---
  // Buoyancy ramps linearly with submersion. At submersion ~0.5 (waist deep)
  // it roughly equals gravity → floats. Below that it pulls you up.
  let buoyancyForce = BUOYANCY_FORCE * submersion;

  // If at surface and not diving, add surface tension snap
  const atSurface = Math.abs(depth) < SURFACE_BAND && !wantsDive;
  if (atSurface) {
    // Gently push/pull towards the surface plane
    const surfaceError = waterSurfaceY - (capsuleHeight * 0.35) - playerY;
    buoyancyForce += surfaceError * 8.0; // spring constant
  }

  // Ascend/dive input
  let vyOverride: number | null = null;
  const isDiving = wantsDive && submersion > 0.1;

  if (wantsAscend && submersion > 0.05) {
    vyOverride = 2.5; // swim upward
  } else if (isDiving) {
    vyOverride = -2.0; // dive down
    buoyancyForce *= 0.3; // reduce buoyancy while actively diving
  }

  // --- Drag (with encumbrance penalty) ---
  const depthRatio = Math.min(1, Math.max(0, depth) / DEEP_THRESHOLD);
  const dragFactor = 1.0 - (DRAG_SURFACE + (DRAG_DEEP - DRAG_SURFACE) * depthRatio);
  const encPenalty = (input.encumbranceRatio ?? 0) * ENCUMBRANCE_MAX_PENALTY;
  const horizontalDrag = Math.max(0.2, dragFactor * (1 - encPenalty));

  // --- Breath meter ---
  const breathState = useBreathMeter.getState();
  if (submersion > 0.5) {
    // Underwater — deplete breath
    breathState.deplete(BREATH_DEPLETE_RATE * delta);
  } else {
    // At surface or shallow — recover breath
    breathState.recover(BREATH_RECOVER_RATE * delta);
  }

  // --- Drowning (breath-based, not fatigue-based) ---
  const isDrowning = breathState.breath <= BREATH_DROWN_THRESHOLD && submersion > 0.3;

  if (isDrowning) {
    useSurvival.getState().takeDamage(DROWNING_DAMAGE_PER_SEC * delta, "poison");
    buoyancyForce *= 0.4;
  }

  // --- Water current ---
  const currentForce: [number, number, number] = input.waterCurrent ?? [0, 0, 0];

  return {
    buoyancyForce,
    horizontalDrag,
    vyOverride,
    atSurface,
    isDiving,
    isDrowning,
    submersion,
    currentForce,
  };
}

// ---------------------------------------------------------------------------
// Swim state resolver — maps physics output to state machine events
// ---------------------------------------------------------------------------
export type SwimState =
  | "surface_idle"
  | "surface_swim"
  | "diving"
  | "ascending"
  | "treading"
  | "drowning"
  | null;  // not in water

export function resolveSwimState(
  output: SwimOutput,
  horizontalSpeed: number,
): SwimState {
  if (output.isDrowning) return "drowning";
  if (output.isDiving) return "diving";
  if (output.vyOverride !== null && output.vyOverride > 0) return "ascending";
  if (output.atSurface) {
    return horizontalSpeed > 0.3 ? "surface_swim" : "surface_idle";
  }
  if (output.submersion > 0.3) return "treading";
  return "surface_idle";
}

// ---------------------------------------------------------------------------
// Breath Meter Store — Conan Exiles-style underwater breath.
//
// Separate from stamina: you can be at full stamina but still drown if
// you stay under too long. HUD subscribes for the breath bar display.
// ---------------------------------------------------------------------------

export interface BreathMeterState {
  breath: number;
  maxBreath: number;
  isSubmerged: boolean;
  deplete: (amount: number) => void;
  recover: (amount: number) => void;
  reset: () => void;
}

export const useBreathMeter = create<BreathMeterState>((set) => ({
  breath: MAX_BREATH,
  maxBreath: MAX_BREATH,
  isSubmerged: false,
  deplete: (amount) => set((s) => ({
    breath: Math.max(0, s.breath - amount),
    isSubmerged: true,
  })),
  recover: (amount) => set((s) => ({
    breath: Math.min(s.maxBreath, s.breath + amount),
    isSubmerged: false,
  })),
  reset: () => set({ breath: MAX_BREATH, isSubmerged: false }),
}));
