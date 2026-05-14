# Push beached boats into water

## What & Why
Right now the small boats next to docks are just decorative bobbing props. Players should be able to walk up to a beached/overturned boat, "attach" to it with **F**, flip it upright with **right mouse**, and push it slowly with **WASD** so they can shove it into the water. This makes the dock area feel interactive and lets the player set up their own launch before boarding.

## Done looks like
- Walking near a boat shows a prompt like "Press F to grab boat".
- Pressing **F** attaches the player to that boat (player snaps to a push position at the stern, plays/holds a pushing pose, and locks onto this boat until released).
- Pressing **F** again (or moving far away) detaches the player.
- While attached, **right mouse** flips the boat upright if it's tipped/overturned (smooth rotation back to level, not an instant snap).
- While attached, **WASD** moves the boat slowly along the ground plane (clearly slower than normal walking), with the player staying glued to the stern and facing the boat.
- The boat's idle bobbing only plays once it's actually over water; on land it sits still on the ground.
- Once pushed past the shoreline into the water, the boat resumes its normal floating/bobbing behavior and can be boarded the usual way (existing E-to-board flow still works).
- Other docked boats and the sailing scene are unaffected.

## Out of scope
- New boat models, textures, or VFX (splashes, footprints, ropes).
- Multiplayer / networked boat ownership.
- Buoyancy simulation, wave physics, or a real water collider — "in water" is just a simple shoreline check (e.g. world position past a configurable line / inside a water zone).
- Changing the existing E-to-board → SailingMode transition.
- Letting the player push any other prop.

## Steps
1. **Boat interaction state** — Extend the boat data so each boat tracks whether it's beached vs. floating, its current upright tilt, and whether a player is currently attached. Add a simple "is over water" check based on world position relative to the shoreline.
2. **F-to-attach prompt and toggle** — Add a proximity prompt on beached boats ("Press F to grab boat" / "Press F to release"). Pressing F toggles an "attached to boat" mode on the player, records which boat is held, snaps the player to a push anchor at the stern facing the boat, and disables normal movement/combat input while attached.
3. **RMB flip-upright** — While attached, right mouse triggers a smooth tween of the boat's roll/pitch back to level over a short duration. Ignore the input if the boat is already upright or mid-flip.
4. **WASD slow push** — While attached, WASD drives the boat (not the player) along the ground at a slow push speed, with the player rig following the stern anchor and the boat's yaw rotating with strafe input. Keep the boat clamped to ground height while beached.
5. **Water transition** — When the boat's position crosses into the water zone, switch it from "beached" (static, grounded, pushable) to "floating" (resumes bobbing animation, no longer pushable, available for the existing E-to-board interaction). Auto-detach the player at that moment and restore normal controls.
6. **Polish** — Make sure releasing/auto-detach cleanly restores the player's controller state, animation layer, and camera; verify the existing dock boats and SailingMode still work; confirm prompt text doesn't conflict with other F/E prompts in range.

## Relevant files
- `client/src/game/world/BoatSystem.tsx`
- `client/src/game/world/SailingMode.tsx`
- `client/src/game/components/Player.tsx`
- `client/src/game/controllers/useCharacterController.ts`
- `client/src/game/components/ResourceNode.tsx`
- `client/src/game/dungeon/DungeonAssetMap.ts`
