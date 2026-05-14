# Fix collisions, terrain navigation, and animation binding

## What & Why
Movement itself feels good now, but a few closely-coupled issues are keeping the world from feeling solid:

1. **Enemies, NPCs, and animals have no physics presence.** Only the player and static world (terrain, buildings) exist in the Rapier world. Everything else moves by raw transform with heightmap snapping, so the player walks straight through enemies, enemies clip into each other, and shoulder-bumping doesn't read. This is the "null collisions" symptom — there is no error, the colliders simply aren't there.

2. **Player isn't planted on the dirt.** The player uses a `BallCollider` whose center sits roughly at the hip and whose ground contact is whatever the sphere's lowest point happens to be against the heightfield. The visual feet end up floating, sinking, or sliding along the surface instead of being the actual root that grips the ground. Spheres also roll on slopes, tip on edges, and skip past gap edges — none of which an upright humanoid should do — and there's no step-up logic, so the character snags on small bumps. The user's ask is direct: "my root is supposed to be my feet, and gravity and me are supposed to be using math to stay upright and planted."

3. **Ground detection is loose against the visible terrain.** The `HeightfieldCollider` is 128×128 across the whole world, which is much coarser than the visible heightmap. The character sits on the coarse physical surface, not the dirt the player can see, so feet routinely poke into / hover over the visible mesh. We want the character's feet to land on the actual visible ground via a downward raycast (or BVH query) against the rendered terrain mesh, with gravity pulling the body back to that hit point each frame.

4. **Animations partially fail to bind on the recently-enabled races.** The previous fix exposed vampire / dwarf-female / centaur / avian / kobold / swordman GLBs. The console now spams `THREE.PropertyBinding: No target node found for track: toesr.quaternion / handl / spine / upperlegl / lowerarmr / footr ...` because their bone naming convention isn't covered by the alias map and the retargeter is leaving Mixamo-style track names that don't resolve. Visually this means parts of the body don't animate — frozen feet, locked spine, dead arms — which reads as "deformed" even when the body shape is right.

A few smaller correctness fixes get bundled in because they touch the same code paths.

## Done looks like
- The player's body actually pushes against enemies and is pushed back. You can shoulder-check an enemy and feel the collision, and a knot of enemies can't all stand on the exact same square inch.
- The character's **feet** are the visible contact point with the ground. Walking across a dirt patch, the toes/soles touch the visible surface — not floating, not sinking, not gliding through it.
- The player no longer rolls on slopes, no longer trips over small terrain bumps, and stays upright (no tipping) under normal locomotion. Gravity feels like a steady downward pull that re-plants the character each frame, not a spongy spring.
- The bone-binding warnings ("No target node found for track: …") stop appearing in the browser console for every supported race, and previously frozen body parts (feet, spine, arms) now animate visibly during walk / run / attack.
- No new physics crashes, no falling through the floor, and frame rate doesn't visibly regress on a populated scene.

## Out of scope
- Full pathfinding / nav-mesh AI rework — enemies still use the existing behavior tree. They just gain a physics body so they collide.
- Replacing the heightmap terrain with a different terrain system. We can sample it more precisely; we're not swapping it.
- Climbing, swimming, mantling — only ground locomotion.
- IK foot placement (per-foot pose adjustment to match terrain slope). Just the body root needs to plant correctly; per-foot IK is a future polish pass.
- Multi-rig retargeting refactor — we just want enough alias coverage to clear the bone warnings on currently-shipping races.

## Steps
1. **Give moving characters real colliders.** Add a sensible Rapier collider to enemies, allies/NPCs, and animals so the player and the world block them. Use a kinematic-position-based rigid body (their movement is still authored, not simulated) with a capsule collider sized to the entity's measured bounds. Skip dead / despawned entities. Make sure the player can still attack and hit them, and that enemies don't get launched by the physics solver.
2. **Replace the player's `BallCollider` with a `CapsuleCollider`, anchored so the feet are the root.** Half-height and radius come from the same measured-bounds pipeline that already exists for the ball collider; keep the existing tuning fallbacks. Position the capsule so the bottom of the capsule sits at the visual character's feet (y=0 in the model's local space), not at the hips. Verify the existing tunneling guard, ground snapping, and click-to-move raycast logic still behave with the capsule.
3. **Plant the character on the visible terrain via a per-frame downward ground sample.** Each frame, raycast (or BVH-query) straight down from just above the capsule's bottom against the visible terrain mesh. Use the hit point as the authoritative ground height for the character's feet. Apply gravity normally, but clamp the body so the feet rest exactly at the hit point when grounded (with a small tolerance so the contact reads as "planted" rather than "spring-loaded"). This is what the user means by "raycast or BVH the ground better." The Rapier heightfield stays in the world for general physics; this is an additional, tighter ground sample for the player only.
4. **Add a simple step-up assist.** When the player is moving forward and blocked by a small obstacle (≤ a configurable threshold like 0.3 m), nudge them up so they don't stop dead at every pebble. Keep it conservative so it doesn't let them climb walls.
5. **Make the new RigidBody re-key safe.** When `PLAYER_RADIUS` finishes measuring, the RigidBody currently re-keys and unmounts/remounts, leaving `rigidBodyRef.current` null for a frame. Either guard every read, or measure the bounds before mounting the RigidBody so it's only mounted once with the right size. Don't introduce a fresh teleport-to-origin glitch when this changes.
6. **Standardise physics timestep.** Housing uses `timeStep="vary"` while overworld and dungeon use a fixed `1/60`. Move Housing to the same fixed `1/60` so a frame-rate dip can't tunnel the player through the floor in one scene but not another.
7. **Cover the lowercase / simplified bone names in the alias map.** Add aliases for the bone names appearing in the current binding warnings (`spine`, `head`, `handl`/`handr`, `upperlegl`/`upperlegr`, `lowerlegl`/`lowerlegr`, `footl`/`footr`, `toesl`/`toesr`, `upperarml`/`upperarmr`, `lowerarml`/`lowerarmr`) so the retargeter can map them to the canonical Mixamo-style names. Verify on every playable race that the warnings stop and the relevant body parts animate.
8. **Reality check.** Restart the workflow, walk around the overworld, drop into a dungeon, and stand inside a knot of enemies. Confirm the feet visibly touch the ground on flat dirt, slopes, and small bumps; collisions feel right; animations look right; no console errors or warnings; no frame-rate regression.

## Constraints
- Don't change camera behaviour, weapon stats, AI logic, save format, or HUD.
- Enemies / NPCs / animals must remain authoritative on their own movement (kinematic-position bodies, not dynamic). Combat hit detection that already works (raycasts, sphere-overlap, etc.) must keep working.
- Heightfield terrain stays as the single source of truth for general physics. The visible-mesh ground sample is an added per-frame query for the player, not a replacement.
- Keep upright behavior simple: the body shouldn't tip over from physics. Use locked rotations on the player's rigid body if needed; orientation is driven by the controller, not the solver.

## Relevant files
- `client/src/game/components/Player.tsx`
- `client/src/game/controllers/useCharacterController.ts`
- `client/src/game/controllers/MovementController.ts`
- `client/src/game/components/Enemy.tsx`
- `client/src/game/components/NPCs.tsx`
- `client/src/game/components/Animals.tsx`
- `client/src/game/npc/AllyNPC.tsx`
- `client/src/game/components/Terrain.tsx`
- `client/src/game/components/TerrainCollider.tsx`
- `client/src/game/GameScene.tsx`
- `client/src/game/dungeon/DungeonScene.tsx`
- `client/src/game/housing/HousingScene.tsx`
- `client/src/game/systems/BoneAliases.ts`
- `client/src/game/hooks/useCharacterModel.ts`
- `client/src/game/systems/BoundsUtils.ts`
