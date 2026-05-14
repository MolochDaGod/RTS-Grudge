# Climbing Physics (Walls & Ladders)

## What & Why
The character has all the climbing animations wired up (`climb_start`, `climb_idle`, `climb`, `climb_shimmy`, `climb_topout`, `climb_down`, `ledge_grab`) but no physics or controller behavior to actually drive them. This task adds the physics layer so the player can climb authored surfaces (rough walls, cliffs, etc.) and ladders, with the right "stick to wall" feel and a clean topout transition.

The approach follows standard three.js + Rapier practice:
- **Climbable surfaces** → one or more `ConvexHullCollider`s baked from the visual mesh's vertices. Convex hulls are cheap, give clean penetration normals (needed for the "press into wall" stick), and avoid the cost of a tri-mesh against a kinematic body.
- **Ladders** → a simple AABB cuboid collider plus a sensor cuboid for entry detection and a second sensor near the top for the topout cue.
- **Climb mechanic itself** → while in climb state the player switches to a kinematic position-based mode (we already use `kinematicPosition` for the body), gravity/jump are suspended, a forward raycast keeps the chest a fixed offset from the wall, and a downward raycast from the head detects the topout transition.

## Done looks like
- Authored climbable surfaces and ladders show up in the world with the right colliders (visible in physics debug).
- Walking into a tagged climbable surface and pressing the climb input snaps the player flush to the wall, hides gravity, and plays `climb_start` → `climb_idle`.
- Movement input on a wall translates to up/down/sideways climbing (`climb`, `climb_shimmy`) along the wall surface, with the chest staying at a fixed offset via the forward raycast.
- Reaching the top of a climbable surface or ladder triggers `climb_topout`, then hands control back to normal locomotion on solid ground.
- Dropping off (back/jump input while climbing) cleanly returns to `airborne.falling`.
- Ladders have predictable axis-aligned up/down movement, with a sensor at the top that fires the topout transition.
- The existing capsule controller, jump, combat, and ground-handling behavior on flat ground are unchanged when the player isn't climbing.

## Out of scope
- Authoring tools / new editor UI for placing climbable surfaces beyond a minimal prefab tag (full editor polish is a follow-up).
- AI/enemy climbing.
- Wall-running, mantling over short ledges, or vaulting (separate mechanics).
- Climbable terrain chunks (rock cliffs in the open world streamed through `ChunkRenderer`) — this task focuses on authored, prefab-placed climbables and ladders. A follow-up can extend the same collider/sensor pattern to terrain.
- Net-syncing climb state for any future multiplayer.

## Steps

1. **Climbable + ladder collision groups and tagging.** Add `CLIMBABLE` (e.g. group bit 8) and `LADDER` to `COLLISION_GROUPS` / `COLLISION_MASKS` in `BuildingColliders.tsx` so the player capsule and the climb-detection raycasts can filter to just these surfaces. Extend `PrefabRegistry`'s `ColliderDef` (or add a sibling `climb` field) so a prefab can be marked `climbable: "wall" | "ladder"`. Keep the tag opt-in — existing prefabs are unaffected.

2. **ConvexHull collider baking for walls.** Add a small utility that, given a mesh (or selected child meshes) of a climbable prefab, extracts the vertex positions in local space and feeds them into `ColliderDesc.convexHull(points)` via `<ConvexHullCollider args={[points]} />` from `@react-three/rapier`. For most authored walls the runtime hull from the GLB vertices is fine; for high-poly meshes use the `quickhull-3d` skill (`.agents/skills/quickhull-3d/SKILL.md`) to pre-decimate offline and ship a `.hull.json` next to the model so we don't pay the build cost at runtime. Climbable prefabs render this collider with the `CLIMBABLE` group instead of the default `BUILDING` mask so the player capsule can pass through them but the climb raycast can hit them.

3. **Ladder collider + sensors.** A ladder prefab spawns: (a) a thin solid `CuboidCollider` for the rungs (group `LADDER`, blocks the player capsule slightly so they don't clip through the back), (b) a slightly larger `CuboidCollider` `sensor` covering the climb volume in front of the rungs, used to trigger "enter ladder" on overlap, and (c) a small sensor cuboid at the top of the ladder used to fire the topout transition when the player's chest enters it. Centralize ladder construction in a `LadderCollider` component so any prefab with `climbable: "ladder"` gets all three.

4. **`climbing` region in the character state machine.** Extend `characterMachine.ts` so locomotion has `grounded | airborne | climbing`. The `climbing` region should have leaves matching the existing animation set: `mounting` (plays `climb_start`), `idle` (loops `climb_idle`), `vertical` (loops `climb` for up/down), `shimmy` (loops `climb_shimmy` for sideways), `topout` (plays `climb_topout` and exits to grounded.idle on `LAND`), `dropoff` (exits to airborne.falling). Add `MOUNT_CLIMB`, `DISMOUNT_CLIMB`, `TOPOUT`, `CLIMB_VEL` (or similar) events on locomotion. Update `LocomotionState` and `leafLocomotion` so `Player.tsx` can read the current climb sub-state for animation binding (it already does this for grounded/airborne).

5. **Climb controller in `Player.tsx`.** Add a `climbController` block that runs in `useFrame` when locomotion is in `climbing`:
   - **Enter**: when a "climb" intent fires (sensor overlap on a `CLIMBABLE` or `LADDER` and the player presses forward / a dedicated climb key), capture the wall normal from a forward raycast and snap the capsule so the chest sits a fixed offset along that normal. Suspend the existing gravity / jump-force path (gate the existing `jumping`/`falling`/`isGrounded` logic on `!isClimbing`).
   - **While climbing**: each frame, do a short forward raycast from the chest along the captured wall normal direction; correct the kinematic position so the chest stays at the fixed offset (this is the "stick to wall" behavior). Translate WASD into wall-tangent movement (right/up vectors derived from the wall normal). For ladders, lock movement to the world Y axis and the ladder's local right axis so it feels predictable.
   - **Topout**: do a downward raycast from the head; when it finds a walkable surface ahead-and-above the chest, fire `TOPOUT`, lerp the capsule to the platform position over the duration of the `climb_topout` clip, then re-enable gravity and hand off to `grounded.idle`.
   - **Drop off**: on back/jump input or loss of wall contact (no hit on the forward raycast for N frames), fire `DISMOUNT_CLIMB` and let the existing airborne pipeline take over.
   - All raycasts use `useRapier().world` and filter by the new `CLIMBABLE`/`LADDER` groups so they don't snag on `BUILDING` geometry.

6. **Sensor → state plumbing.** Wire the ladder/wall sensors' `onIntersectionEnter` / `onIntersectionExit` to set a `nearClimbable` ref on the player (with the surface kind, normal, and a back-pointer to the collider) so step 5's enter check has the data it needs without doing per-frame proximity scans.

7. **Test surfaces in one existing scene.** Drop one wall-climb prefab and one ladder prefab into the dungeon scene (`DungeonScene.tsx`) so the feature is visibly testable end to end. No new content beyond what's needed to verify mount → climb → shimmy → topout → drop off works on both surface types. Confirm the player capsule, normal locomotion, jump, and combat on flat ground are all unchanged when not climbing.

8. **Debug overlay toggle.** Add a small dev-only toggle (re-using whatever physics-debug pattern the project already exposes) that draws the convex hull, the ladder sensors, the captured wall normal, and the chest/head raycasts so future tuning of stick distance, topout offset, and climb speed is easy.

## Architectural constraints / notes
- Stay on the existing **kinematic-position** body pattern (`KinematicCharacterBody.tsx` + `setNextKinematicTranslation`). Do not switch the body to dynamic; the climb controller drives position directly.
- Reuse `COLLISION_GROUPS`/`COLLISION_MASKS` — don't introduce a parallel system. Add new bits there.
- Animations are already mapped in `useCharacterModel.ts`; do not re-map them — just point new machine leaves at the existing keys.
- Climb state must layer cleanly with the existing parallel `combat`, `posture`, and `overrides` regions in `characterMachine.ts` (e.g. combat one-shots should be suppressed while climbing — the simplest path is for `Player.tsx` to gate combat input on `!isClimbing`).
- Use `quickhull-3d` skill only when a runtime hull from raw GLB vertices is too dense; for typical authored walls the direct path is fine.

## Relevant files
- `client/src/game/components/Player.tsx:219-371,1478-1839,2251`
- `client/src/game/components/KinematicCharacterBody.tsx`
- `client/src/game/components/BuildingColliders.tsx:9-51`
- `client/src/game/controllers/characterMachine.ts:107-310`
- `client/src/game/controllers/useCharacterController.ts`
- `client/src/game/controllers/MovementController.ts:25-71`
- `client/src/game/hooks/useCharacterModel.ts:27-45`
- `client/src/game/anim/CharacterAnimator.ts`
- `client/src/game/editor/PrefabRegistry.ts`
- `client/src/game/dungeon/DungeonScene.tsx`
- `.agents/skills/quickhull-3d/SKILL.md`
