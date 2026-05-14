# Annihilate Mechanics Audit

## What & Why
The reference repo `MolochDaGod/annihilatetrainer` (a fork of `gonnavis/annihilate`, a 2018 action game prototype with DMC/Guilty Gear-style combat, fighting-game motion inputs, an XState role machine, and a small zoo of enemies/bosses/props) contains a long list of moves, AIs, props, and effects we want to learn from and re-build at the same level of quality as the rest of our game. Before any porting work, we need a single research document that goes through every module in that repo, cross-references it against what we already have, and lays out a per-feature "iterate to our quality bar" proposal. This becomes the source of truth that later porting tasks are spawned from.

The main camera stays exactly as it is. Anything in the audit that would touch our camera (orbit/zoom/follow/MMO vs Action mode) is explicitly flagged as "skip — out of scope".

## Done looks like
- A new long-form research document lives at `docs/annihilate-audit.md`.
- The doc has one section per Annihilate module/system, grouped into: Player Moveset, Defense & Reactions, Movement & Traversal, Projectiles & Skills, Weapons, Enemies & AI, Bosses, Props & Level Pieces, World FX, Engine/Architecture.
- Each entry contains: source file(s) and line refs in the reference repo, a one-paragraph "what it does" in plain language, our current equivalent (file path or "none"), gap/quality delta vs our bar, and a recommended port plan ("adopt as-is", "rebuild on our combat machine", "skip", etc.) with rough size (S/M/L).
- A summary table at the top ranks every entry by recommended priority (must-have / nice-to-have / skip) and flags everything camera-related as Skip.
- A short "House rules" section at the top restates: do not modify our camera system, reuse our XState combat machine instead of state-machine.js, reuse our Rapier physics (not cannon-es), reuse our existing animation pipeline (`useCharacterModel` + `AnimationController` + `AnimationBlender`), and reuse our existing weapon catalog/IK rather than the Annihilate weapon classes.
- The doc ends with a recommended "first wave" port list (5–8 items) the user can turn into follow-up tasks.

## Out of scope
- Any code changes to gameplay, controls, animations, weapons, enemies, camera, or UI.
- Pulling models, textures, or audio out of the reference repo into our project.
- Adding `cannon-es`, `state-machine.js`, `ecsy`, or any other library from the reference repo.
- Producing per-port implementation tickets — this audit only recommends them; the user will pick which ones to spawn as their own tasks afterward.

## Steps
1. Clone or read the reference repo `https://github.com/MolochDaGod/annihilatetrainer.git` into a scratch location and inventory every file under `src/` (≈45 modules, ~8.7k lines) plus `README.md`'s key map. Do not copy anything into the project.
2. For each Annihilate module, write a short "what it does" summary derived from the source (state names, inputs, physics calls, FX hooks). Cite source file and approximate line ranges.
3. For each Annihilate module, locate our equivalent in the project (player moves in `Player.tsx` + `combatMachine.ts` + `CombatController.ts`, animations in `useCharacterModel.ts` / `AnimationController.ts` / `AnimationBlender.ts`, weapons in `ModelRegistry.ts` + `WeaponPrefabs.ts` + `WeaponGripSystem.ts` + `WeaponIKController.tsx`, enemies in `Enemy.tsx` + `EnemyManager.tsx` + `EnemyBehaviorTree.ts`, FX in `client/src/game/effects/`, etc.). Mark "none" where missing.
4. Compare quality and write the gap delta in plain language (e.g., "we have basic dash, missing dash-cancel into attack and i-frames"). Recommend port action: adopt-as-is, rebuild-on-our-stack, partial, or skip. Add a rough S/M/L size estimate.
5. Group results by category and produce the priority summary table at the top. Explicitly mark any camera-adjacent item (e.g., Annihilate's follow-cam tweens, screen shake, camera lerps that aren't already in our `Camera.tsx`) as Skip with a one-line reason.
6. Write the closing "first wave" recommendation: 5–8 ports that give the highest gameplay payoff for the least conflict with our existing systems (likely candidates: Hadouken/Shoryuken/Tatsumaki motion-input specials, Whirlwind hold, Pop launcher, Earthquake, wall climb, Bash/Launch follow-up, BirdFlock ambient, Catapult prop, Parrot boss skeleton). The user picks from this list to spawn the actual porting tasks.

## Relevant files
- `client/src/game/components/Player.tsx`
- `client/src/game/components/Camera.tsx`
- `client/src/game/components/Enemy.tsx`
- `client/src/game/components/WeaponMesh.tsx`
- `client/src/game/components/WeaponModelLoader.tsx`
- `client/src/game/components/WeaponIKController.tsx`
- `client/src/game/controllers/MovementController.ts`
- `client/src/game/controllers/CombatController.ts`
- `client/src/game/controllers/useCharacterController.ts`
- `client/src/game/machines/combatMachine.ts`
- `client/src/game/systems/useCharacterModel.ts`
- `client/src/game/systems/EnemyManager.tsx`
- `client/src/game/systems/EnemyBehaviorTree.ts`
- `client/src/game/systems/playerBones.ts`
- `client/src/game/systems/weaponOffsetPresets.ts`
- `client/src/game/anim`
- `client/src/game/effects`
- `client/src/lib/data/WeaponPrefabs.ts`
- `client/src/lib/data/WeaponSkillData.ts`
- `client/src/game/systems/AnimationController.ts`
- `client/src/game/systems/AnimationBlender.ts`
- `client/src/game/systems/WeaponGripSystem.ts`
- `client/src/game/systems/ModelRegistry.ts`
- `client/src/game/systems/BoneAliases.ts`
