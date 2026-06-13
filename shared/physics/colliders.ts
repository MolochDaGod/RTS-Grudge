/**
 * shared/physics/colliders.ts — collider parameter sets + sizing helpers.
 *
 * Params-as-data: the client feeds these to `<CapsuleCollider>` / `<RigidBody>`,
 * and a headless server feeds the same numbers to `RAPIER.ColliderDesc`. The
 * sizing helper is pure math, identical to the client controllers, so both
 * sides derive the exact same capsule geometry from skeleton bounds.
 */
import type { CapsuleParams } from "./types";
import { MATERIALS } from "./materials";

/** Fallback capsule dimensions when skeleton auto-measure is unavailable. */
export const PLAYER_CAPSULE_DEFAULT = { height: 1.8, radius: 0.3 } as const;

/** Clamp envelope used when auto-sizing a capsule from skeleton bounds. */
export const CHARACTER_CAPSULE_LIMITS = {
  minHeight: 0.4,
  radiusMin: 0.15,
  radiusMax: 1.5,
  minHalfHeight: 0.05,
} as const;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Size a character capsule from skeleton bounds. Matches the clamp envelope in
 * `KinematicCharacterBody` (radius 0.15..1.5), so the R3F client and a headless
 * server produce the same collider. Note: `prefabs/character/CharacterBody`
 * intentionally caps radius tighter (0.6) and keeps its own clamp — it reuses
 * MATERIALS here but not this helper.
 *
 * @returns halfHeight + radius (Rapier capsule args) and the Y offset that
 *          plants the capsule's feet at the body origin.
 */
export function sizeCharacterCapsule(
  height: number,
  radiusXZ: number,
  scale = 1,
): { halfHeight: number; radius: number; offsetY: number } {
  const h = Math.max(CHARACTER_CAPSULE_LIMITS.minHeight, height * scale);
  const r = clamp(radiusXZ * scale, CHARACTER_CAPSULE_LIMITS.radiusMin, CHARACTER_CAPSULE_LIMITS.radiusMax);
  const halfHeight = Math.max(CHARACTER_CAPSULE_LIMITS.minHalfHeight, (h - 2 * r) / 2);
  return { halfHeight, radius: r, offsetY: halfHeight + r };
}

/** Ready-made param set for the default player/enemy capsule (1.8 m / 0.3 m). */
export const PLAYER_COLLIDER: CapsuleParams = {
  shape: "capsule",
  ...sizeCharacterCapsule(PLAYER_CAPSULE_DEFAULT.height, PLAYER_CAPSULE_DEFAULT.radius),
  material: MATERIALS.character,
};
