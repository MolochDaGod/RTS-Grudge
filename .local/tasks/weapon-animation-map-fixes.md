# Weapon, Animation & Map System Polish

## What & Why
A comprehensive review and fix pass across three interconnected systems: weapon attachment/placement on character models, the animation controller, and map rendering and deployment. The goal is to bring all three systems to a consistent, production-ready state.

## Done looks like
- Weapons appear correctly positioned and oriented in each character's hand across all skeleton types (KayKit, Mixamo, Generic), with no visible clipping into the body or floating away from the grip
- Weapon pivot offsets are correct so handles sit flush in the grip for all weapon categories (swords, axes, daggers, hammers, staffs, bows, shields)
- Two-handed weapons correctly involve both hand bones; ranged weapons aim properly
- Animations play smoothly for all entity types — idle, walk, run, attack, hit, death — with no stuck poses or jitter after rapid state changes
- Upper-body / lower-body blending works correctly when moving and attacking simultaneously, regardless of skeleton naming convention
- Weapon swaps mid-animation transition gracefully without snapping or freezing
- The `AnimationController` class is the single source of truth used by both Player and Enemy, replacing the parallel `useUnifiedModel` transition logic
- Island overworld, dungeon scenes, and sailing mode all render without dark/broken materials
- Models in all map scenes are consistently scaled (no oversized props, no tiny characters)
- Players and enemies do not fall through procedurally generated terrain or dungeon floors (physics colliders match visual meshes)
- Dungeon fog transitions smoothly without harsh geometry pop-in
- Shadow rendering in island scatter scenes maintains acceptable frame rate

## Out of scope
- New weapons, new weapon types, or new character models
- New maps or biomes
- Multiplayer networking changes
- UI/HUD changes

## Tasks
1. **Weapon placement audit and fix** — Review `WeaponGripSystem.ts`, `WeaponMesh.tsx`, and `BoneAliases.ts`. Correct pivot point offsets for all weapon categories so handles are flush in the grip. Verify and extend bone alias coverage for all skeleton types in use. Fix scale-compensation logic for models with non-uniform bone scales. Ensure two-handed and ranged grip profiles correctly attach to both hand bones.

2. **Weapon–animation intersection reduction** — Audit weapon angle/offset defaults per weapon type and animation state. Adjust rotation and position offsets to minimise body clipping across the most common animations (idle, walk, run, attack, block). Add animation-state-aware offset overrides where a single static offset is insufficient.

3. **Animation controller unification** — Migrate `Player.tsx` and `Enemy.tsx` off the `useUnifiedModel` hook's internal transition logic and onto `AnimationController.ts` as the single authority. Remove the duplicate transition/blend code from `useUnifiedModel`. Ensure priority, LOD, and state-lock behaviour from `AnimationController` applies to all entities.

4. **Animation blending and transition fixes** — Replace hard-coded bone mask strings in `AnimationBlender.ts` with skeleton-type-aware lookups (using the same skeleton detection already in `WeaponGripSystem`). Extend transition lock duration and add foot-sync heuristics for walk↔run transitions. Fix the `finished`-event return-to-idle path so interrupted non-looping animations (attacks, hits) always resolve cleanly.

5. **Weapon-swap animation desync fix** — Add logic to `AnimationController` to detect an in-progress animation when the weapon type changes, smoothly cross-fade to the equivalent state in the new weapon profile rather than snapping or freezing.

6. **Map material and scale pipeline fixes** — In `AssetPipeline.ts`, ensure `fixDarkMaterials` is applied consistently to all loaded GLB scenes (including dungeon KayKit and furniture assets). Verify `targetHeight` normalisation covers all asset categories and fix any outliers causing scale mismatches visible in-game.

7. **Physics collider and floor sync** — Audit terrain and dungeon floor collider generation. Ensure the static bodies built from procedural heightmaps and BSP dungeon floors match the corresponding visual meshes so players/enemies cannot fall through. Add a safety floor fallback for edge cases.

8. **Dungeon fog and shadow performance** — Tune fog `near`/`far` values in dungeon scenes to reduce harsh pop-in while keeping geometry hidden. Audit `castShadow` usage in `IslandScatter` and apply shadow culling (distance threshold or LOD) to maintain frame rate at high scatter densities.

## Relevant files
- `client/src/game/systems/WeaponGripSystem.ts`
- `client/src/game/systems/AnimationController.ts`
- `client/src/game/systems/AnimationBlender.ts`
- `client/src/game/systems/AnimationUnifier.ts`
- `client/src/game/hooks/useUnifiedModel.ts`
- `client/src/game/systems/AssetPipeline.ts`
- `client/src/game/components/WeaponMesh.tsx`
- `client/src/game/components/Player.tsx`
- `client/src/game/components/Terrain.tsx`
- `client/src/game/world/IslandScatter.tsx`
- `client/src/game/world/IslandGenerator.ts`
- `client/src/game/dungeon/DungeonGenerator.ts`
- `client/src/game/world/SailingMode.tsx`
- `client/src/game/GameScene.tsx`
- `client/src/lib/data/WeaponPrefabs.ts`
- `client/src/lib/data/BoneAliases.ts`
