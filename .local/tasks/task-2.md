---
title: Strip overkill rigging/skeleton systems & simplify model pipeline
---
# Strip Overkill Systems & Simplify Model Pipeline

## What & Why
The model loading pipeline has grown excessively complex with auto-rigging, skeleton normalization, BVH patching, animation unification, and body-part analysis systems. These ~3,000 lines of code make the codebase fragile and hard to maintain. Strip them out and replace with a lean, direct GLB loading approach. Also establish the character roster from the Toon RTS collection style (KayKit characters).

## Done looks like
- SkeletonRigger.ts, AnimationUnifier.ts, AnimationBlender.ts, ModelAnalyzer.ts, WeaponGripSystem.ts, and BVHAccelerator.ts are deleted
- AssetPipeline.ts is drastically simplified — just loads GLB, enables shadows, returns the scene. No auto-rigging, no BVH patching, no skeleton normalization
- useCharacterModel.ts simplified — loads GLB via useLoader, clones with SkeletonUtils, plays embedded animations directly using simple clip-name matching. No retargeting, no pack loading complexity
- BoneAliases.ts kept but trimmed to just hand-bone lookups for weapon attachment (no retarget maps)
- CharacterSelectScreen.tsx updated to work without AnimationUnifier/AnimationBlender/SkeletonRigger/ModelAnalyzer
- Player.tsx updated to work without ModelAnalyzer body morph and WeaponGripSystem (simplified weapon attachment)
- All consumers of AssetPipeline (World.tsx, DungeonScene.tsx, IntroCutscene.tsx, IslandScatter.tsx, BoatSystem.tsx, SailingMode.tsx, WeaponModelLoader.tsx) updated to use simplified API
- main.tsx no longer imports/calls initBVH
- useGame store no longer imports ModelAnalyzer types
- Game builds cleanly and runs with existing KayKit character models
- Characters from KayKit collection (Knight, Viking, Wizard, Elf, Ninja, Pirate, Soldier, Worker, Goblin, etc.) remain playable with embedded animations

## Out of scope
- Dungeon system rebuild (separate task)
- Adding new character models not already in the project
- Gameplay mechanic changes

## Tasks
1. **Delete overkill files** — Remove SkeletonRigger.ts, AnimationUnifier.ts, AnimationBlender.ts, ModelAnalyzer.ts, WeaponGripSystem.ts, BVHAccelerator.ts.
2. **Simplify AssetPipeline.ts** — Strip down to a thin wrapper: load GLB scene, enable shadows on meshes, return scene+animations. Remove all imports of deleted systems. Remove auto-rigging, BVH building, skeleton analysis, body part detection.
3. **Simplify useCharacterModel.ts** — Direct GLB loading with useLoader/SkeletonUtils.clone, simple AnimationMixer with clip-name pattern matching for animation states. Remove retargeting, pack loading complexity, scale track stripping.
4. **Simplify BoneAliases.ts** — Keep only hand bone aliases for weapon attachment. Remove RETARGET_ALIAS_MAP, buildRetargetMap, retargetClips.
5. **Update CharacterSelectScreen.tsx** — Remove imports of AnimationUnifier, AnimationBlender, SkeletonRigger, ModelAnalyzer. Simplify character preview to use basic AnimationMixer directly.
6. **Update Player.tsx** — Remove ModelAnalyzer body morph usage, replace WeaponGripSystem with simple hand-bone weapon attachment via BoneAliases hand lookups.
7. **Update all AssetPipeline consumers** — World.tsx, DungeonScene.tsx, IntroCutscene.tsx, IslandScatter.tsx, BoatSystem.tsx, SailingMode.tsx, WeaponModelLoader.tsx — adapt to simplified importFromScene API.
8. **Update main.tsx and useGame store** — Remove initBVH call, remove ModelAnalyzer type imports.
9. **Verify build and playtest** — Ensure clean build, characters load and animate, weapons attach, game is playable.

## Relevant files
- `client/src/game/systems/SkeletonRigger.ts`
- `client/src/game/systems/AnimationUnifier.ts`
- `client/src/game/systems/AnimationBlender.ts`
- `client/src/game/systems/ModelAnalyzer.ts`
- `client/src/game/systems/WeaponGripSystem.ts`
- `client/src/game/systems/BVHAccelerator.ts`
- `client/src/game/systems/AssetPipeline.ts`
- `client/src/game/systems/BoneAliases.ts`
- `client/src/game/hooks/useCharacterModel.ts`
- `client/src/game/CharacterSelectScreen.tsx`
- `client/src/game/components/Player.tsx`
- `client/src/game/components/World.tsx`
- `client/src/game/components/WeaponModelLoader.tsx`
- `client/src/game/dungeon/DungeonScene.tsx`
- `client/src/game/IntroCutscene.tsx`
- `client/src/game/world/IslandScatter.tsx`
- `client/src/game/world/BoatSystem.tsx`
- `client/src/game/world/SailingMode.tsx`
- `client/src/main.tsx`
- `client/src/lib/stores/useGame.tsx`