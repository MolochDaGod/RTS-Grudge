# Fix Player Floating In Tutorial

## What & Why
On the tutorial island the player spawns into thin air and feels stuck inside an invisible box: they can barely move, the visible character isn't standing on the shipwreck/beach, and the camera hovers over nothing. The root cause is that the player movement code reads ground height from a global heightmap baked by the main game's terrain (`globalHeightData` in `client/src/game/components/Terrain.tsx`), but the tutorial scene doesn't have its own terrain. The player's anti-tunneling logic therefore keeps snapping the body up to a phantom surface from the main game's island, while the only real collider in the scene is a single invisible `400 × 0.5 × 400` cuboid at `y = -1`. The two systems fight each other and the result is the floating / invisible-box behaviour.

## Done looks like
- Loading the tutorial island spawns the player on the visible ground next to the shipwreck (not in midair).
- The character model is visible and stands at the correct height for the scene scale.
- Walking with WASD moves the player smoothly across the island terrain instead of snagging on an invisible wall.
- Jumping and falling resolve against the actual island geometry (or a sensible flat stand-in), not against the main game's heightmap.
- Swim mode still triggers when the player walks into the water as it does today.

## Out of scope
- Reworking the main `GameScene` terrain or the procedural heightmap system itself.
- Adding new tutorial gameplay, NPCs, harvestables, or quest scripting.
- Polishing animations, camera framing, or HUD layout.

## Steps
1. **Decouple the player from the global heightmap when no terrain is mounted.** Update `client/src/game/components/Player.tsx` so the ground-snap / tunneling-guard logic (around the `getTerrainHeight` calls) does not read from a stale global. Either accept an explicit "ground sampler" via prop/context, or have the player skip terrain-snap when the active scene hasn't published heightmap data. Keep the existing main-game behaviour byte-identical when terrain *is* present.

2. **Give the tutorial scene a real, scene-appropriate ground.** In `client/src/game/islands/TutorialIslandScene.tsx`, replace the lone `CuboidCollider` stand-in with one of: (a) per-mesh trimesh colliders generated from the relevant ground meshes inside the scaled GLB, or (b) a fitted, scene-sized flat collider placed at the island's actual ground height (matching what the player visually walks on at the shipwreck). Whichever is chosen, make sure the player capsule rests on the visible terrain and that horizontal movement is unobstructed.

3. **Spawn the player on that ground.** Recompute the `spawnPosition` so the capsule starts just above the new ground height near the shipwreck centre (origin after the existing offset re-centring). Update both the `<Player spawnPosition={...}>` prop and the `playerPosRef` initial value so the camera frames the character correctly on first load.

4. **Verify swim mode still works.** Confirm the existing `WATER_SURFACE_Y = 0` / `SEABED_Y = -16` swim trigger in `Player.tsx` still activates when the player walks into the water sheets configured in `TutorialIslandScene`, and that exiting the water returns to normal locomotion.

5. **Smoke-test the main game scene.** Load `GameScene` and confirm walking, jumping, and falling on the procedural island still feel identical — the change in step 1 must not regress the main scene.

## Relevant files
- `client/src/game/islands/TutorialIslandScene.tsx`
- `client/src/game/components/Player.tsx:1543-1605`
- `client/src/game/components/Player.tsx:2719-2769`
- `client/src/game/components/Terrain.tsx:140-166`
- `client/src/game/GameScene.tsx`
- `client/src/game/components/TerrainCollider.tsx`
