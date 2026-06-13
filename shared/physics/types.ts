/**
 * shared/physics/types.ts — engine-agnostic physics primitives.
 *
 * Pure data types only. NEVER import `three`, `@react-three/rapier`, or
 * `@dimforge/rapier3d-compat` here — this module must compile cleanly in the
 * R3F client, the headless Node server, and the editor alike. The whole point
 * is that both Rapier flavors read the *same numbers* from one place.
 */

/** Plain XYZ tuple (mutable so it assigns to Rapier/R3F Vector3Tuple props). */
export type Vec3 = [number, number, number];

/** Surface response shared by every collider. */
export interface PhysicsMaterial {
  /** Coulomb friction coefficient. */
  friction: number;
  /** Bounciness, 0 (none) .. 1 (perfectly elastic). */
  restitution: number;
}

/**
 * Capsule collider parameters as plain data. The client passes these to
 * `<CapsuleCollider args={[halfHeight, radius]} .../>`; the headless server
 * passes the same numbers to `RAPIER.ColliderDesc.capsule(halfHeight, radius)`.
 */
export interface CapsuleParams {
  shape: "capsule";
  /** Half the height of the cylindrical mid-section (Rapier capsule arg 1). */
  halfHeight: number;
  /** Capsule radius (Rapier capsule arg 2). */
  radius: number;
  /** Y offset so the capsule sits on the body origin (feet at y = 0). */
  offsetY: number;
  /** Friction / restitution for the collider. */
  material: PhysicsMaterial;
}
