/**
 * @shared/physics — engine-agnostic physics source of truth for the Grudge stack.
 *
 * Plain data + pure helpers only (no `three`, no `@react-three/rapier`, no
 * `@dimforge/rapier3d-compat`), so the same numbers drive the R3F client, a
 * headless Node server, and the editor. Rapier ships in two flavors that do
 * NOT share an API; this module is the neutral ground both read from.
 *
 * Client (@react-three/rapier):
 *   import { GRAVITY, FIXED_TIMESTEP, PHYSICS_INTERPOLATE, MATERIALS, sizeCharacterCapsule } from "@shared/physics";
 *   <Physics gravity={GRAVITY} timeStep={FIXED_TIMESTEP} interpolate={PHYSICS_INTERPOLATE}>
 *   const cap = sizeCharacterCapsule(bounds.height, bounds.radiusXZ, scale);
 *   <CapsuleCollider
 *     args={[cap.halfHeight, cap.radius]}
 *     position={[0, cap.offsetY, 0]}
 *     friction={MATERIALS.character.friction}
 *     restitution={MATERIALS.character.restitution}
 *   />
 *
 * Server (@dimforge/rapier3d-compat):
 *   import RAPIER from "@dimforge/rapier3d-compat";
 *   import { GRAVITY, FIXED_TIMESTEP, MATERIALS, sizeCharacterCapsule } from "@shared/physics";
 *   await RAPIER.init();
 *   const world = new RAPIER.World({ x: GRAVITY[0], y: GRAVITY[1], z: GRAVITY[2] });
 *   world.timestep = FIXED_TIMESTEP;
 *   const cap = sizeCharacterCapsule(h, r, scale);
 *   world.createCollider(
 *     RAPIER.ColliderDesc.capsule(cap.halfHeight, cap.radius)
 *       .setTranslation(0, cap.offsetY, 0)
 *       .setFriction(MATERIALS.character.friction)
 *       .setRestitution(MATERIALS.character.restitution),
 *     body,
 *   );
 *
 * NOTE — collision groups are intentionally NOT defined here yet. Two different
 * schemes already exist in the client and unifying them changes collision
 * behaviour, so that belongs in a dedicated pass — don't mint a third here:
 *   - client/src/game/prefabs/character/constants.ts  (bitmask powers-of-2)
 *   - client/src/game/components/BuildingColliders.tsx (index-based interactionGroups, 14 groups)
 */
export * from "./types";
export * from "./gravity";
export * from "./materials";
export * from "./colliders";
