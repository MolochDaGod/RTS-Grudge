import { useFatigue, DRAIN_RATES } from "./FatigueSystem";
import { useSurvival } from "@/lib/stores/useSurvival";

// ---------------------------------------------------------------------------
// Swim physics — buoyancy, drag, surface tension, drowning.
//
// Called per-frame from Player.tsx when `isInWater(py)` is true.
// Returns force/velocity adjustments for the Rapier rigid body.
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
  /** True when drowning is active (exhausted stamina in water). */
  isDrowning: boolean;
  /** Submersion ratio 0–1 (0 = out of water, 1 = fully submerged). */
  submersion: number;
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

  // --- Drag ---
  const depthRatio = Math.min(1, Math.max(0, depth) / DEEP_THRESHOLD);
  const dragFactor = 1.0 - (DRAG_SURFACE + (DRAG_DEEP - DRAG_SURFACE) * depthRatio);
  const horizontalDrag = Math.max(0.3, dragFactor);

  // --- Fatigue / drowning ---
  const fatigue = useFatigue.getState();
  const isExhausted = fatigue.level === "exhausted";
  const isDrowning = isExhausted && submersion > 0.3;

  if (isDrowning) {
    // Apply drowning damage
    useSurvival.getState().takeDamage(DROWNING_DAMAGE_PER_SEC * delta, "poison");
    // Reduce buoyancy when drowning — character sinks
    buoyancyForce *= 0.4;
  }

  return {
    buoyancyForce,
    horizontalDrag,
    vyOverride,
    atSurface,
    isDiving,
    isDrowning,
    submersion,
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
