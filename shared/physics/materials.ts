/**
 * shared/physics/materials.ts — friction / restitution per surface.
 *
 * Values mirror the live colliders so centralizing them is behavior-neutral:
 *   - character: player + enemy/NPC capsules (KinematicCharacterBody, CharacterBody)
 *   - terrain:   the heightfield collider (TerrainCollider)
 *   - building:  static cuboids (BuildingColliders)
 */
import type { PhysicsMaterial } from "./types";

export const MATERIALS = {
  /** Player + enemy/NPC kinematic capsules. */
  character: { friction: 0.4, restitution: 0.0 },
  /**
   * The local player's dynamic convex-hull body. Grippier than the kinematic
   * capsules (0.5 vs 0.4) so the body doesn't slide forever once locomotion
   * releases velocity. Pair with an Average friction-combine rule on the client.
   */
  playerBody: { friction: 0.5, restitution: 0.0 },
  /** Terrain heightfield. */
  terrain: { friction: 0.6, restitution: 0.0 },
  /** Static building cuboids. */
  building: { friction: 0.4, restitution: 0.0 },
  /** Generic fallback for unclassified colliders. */
  default: { friction: 0.5, restitution: 0.0 },
} satisfies Record<string, PhysicsMaterial>;

export type SurfaceId = keyof typeof MATERIALS;
