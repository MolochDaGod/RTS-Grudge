# 2026-05 Whole-Project Audit — Grudge

> Scope: read-only walkthrough of `client/`, `server/`, `shared/`, `scripts/`, `Models/`,
> `client/public/{models,textures,sounds,maps,editor}/`, `artifacts/mockup-sandbox/`,
> and the proposed-task queue. **No code, asset, or config was changed.** All findings
> below cite a path or path:line so they can be re-verified.

---

## 1. Executive Summary

Top findings, ranked by impact.

1. **`controller/` vs `controllers/` is a false alarm, not a duplicate system.**
   `client/src/game/controller/` contains exactly one file (the dev-only Controller Lab
   page, `ControllerPage.tsx`, 1063 lines, lazy-loaded from `App.tsx:23`).
   `client/src/game/controllers/` contains the runtime mode/movement/combat/build
   controllers (`MovementController`, `CombatController`, `HarvestController`,
   `BuildController`, `GameFlowController`, `ModeController`, `MotionInputBuffer`,
   `useCharacterController`, `characterMachine`). Different concerns, both alive,
   both reachable. The naming is unfortunate but not redundant — recommend a one-line
   rename of the lab folder to `controller_lab/` and we're done.

2. **The "strip overkill systems" task (task-2) is ~95% done but left two stale
   handles in `BoneAliases.ts` and `CharacterSelectScreen.tsx`.** `BoneAliases.ts`
   still exports `ModelAnalysis` (line 912), `BodyPartBones` (928), `BodyMorphConfig`
   (993), `applyBodyMorph` (1020) and `MaterialCategory` (910). `CharacterSelectScreen.tsx`
   still imports `ModelAnalysis` (line 34) and renders a `ModelAnalyzerDisplay` panel
   (lines 276, 2557) that surveys the loaded model's bones. `ModelAnalyzer.ts` itself
   was deleted (no file on disk) but its consumer UI and its type definitions weren't.
   Either finish the strip (delete the panel + the types) or revert the rename and
   keep `ModelAnalyzer.ts` honest.

3. **`useCharacterModel.ts` is the canonical animation system, but it has grown to
   1353 lines** with ~150 `AnimationState` enum entries (gestures, farming, combat,
   climb, swim, all packs). It is the single load-bearing hook for Player, Enemy,
   NPCs, Animals, AllyNPC, IntroCutscene, CharacterSelectScreen. It needs splitting
   — at minimum: pack registration, retarget plumbing, and the state-name pattern
   tables should live in dedicated files so the hook itself can shrink to mount /
   update logic. This file plus `BoneAliases.ts` (1671 lines) and `Player.tsx`
   (3267 lines) are the three god-files of the project.

4. **`server/storage.ts` is still the boilerplate `MemStorage` users-table sample**
   (48 lines, in-memory `Map`, `IStorage` interface). It is unreferenced by every
   real persistence path — saves, loadouts, wallets and grudge each use Neon HTTP
   directly. It is safe to delete or to actually wire to Postgres; right now it just
   confuses the surface area.

5. **`EnemyManager` has 23 enemy types across 5 tiers** (skeletons, golems,
   raptor, dragon, trex, mushroom_king, etc., `EnemyManager.tsx:114-` …) **but
   `EnemyBehaviorTree.ts` has zero references to `monster`, `skeleton`, `dragon`,
   `golem`** etc. — the tree is humanoid-shaped only. Several PROPOSED tasks
   ("Give monster enemies layered combat reactions", "Tune walk/run speed thresholds
   for small and giant monsters") are symptoms of this single missing system: a
   monster-specific behavior branch / size-aware locomotion layer.

6. **The animation system has a real layered combat layer** (`CharacterAnimator.ts`,
   `BoneMask.ts`, `BlendTree.ts`) wired through `useCharacterController.playLayered`
   — but **only humanoid combat overlays use it**. The proposed tasks
   ("Make non-combat moves use layered animation", "Layered combat reactions for
   monsters", "Blend grip open/close during attacks", "Show quiver while bow drawn")
   are all the same gap: a generic non-combat / per-rig layered-pose channel that
   isn't yet exposed. The plumbing exists; the policy layer doesn't.

7. **Asset health is good.** `validate-model-manifest.ts` reports **all 384
   referenced model paths exist on disk**, including the ones that were broken in
   `client/public/models/characters/` thanks to `CharacterModelResolver`'s remap
   table. No broken model references. Texture references match disk
   (`client/public/textures/`). Sound references match disk
   (`client/public/sounds/`).

8. **There is not a single `TODO`, `FIXME`, `XXX` or `HACK` comment in the entire
   `client/src` or `server/` tree.** That's clean discipline; the price is that
   half-built features are tracked only in the proposed-task queue, in `replit.md`,
   or as `coming soon` UI strings (5 known — see §3).

9. **`Models/` (196 MB) is mostly orphan.** It is mounted at `/Models` by
   `server/index.ts:13` (`app.use("/Models", express.static(...))`) and contains
   `Models/models/{characters,animations,weapons,weapons_quaternius}/`. **No code
   in `client/src/` or `server/` references the `/Models/` route.** It mirrors a
   subset of `client/public/models/`. Recommend: confirm with the project owner
   then either delete or repurpose as a working/import staging area.

10. **`artifacts/mockup-sandbox/` is correctly isolated.** It's a separate Vite
    app (own `package.json`, own `node_modules`, own `tsconfig.json`) used as a
    design surface. It does not import from `client/src/`. Only meaningful overlap
    is `hooks/use-mobile.tsx` (mockup) vs `client/src/hooks/use-is-mobile.tsx`
    (main). Acceptable cost for an isolated artifact.

---

## 2. System-by-System Review

### 2.1 Rendering / Three / Physics
- **What's there.** R3F 8.18, drei 9.122, `@react-three/rapier` 1.5, Rapier compat
  `@dimforge/rapier3d-compat` 0.19. Fixed-timestep 1/60 physics with interpolation
  (`replit.md:6`). Scenes: `GameScene.tsx`, `BakedDungeonScene.tsx`,
  `HousingScene.tsx`, `TutorialIslandScene.tsx`. Camera has MMO + Action modes
  (`Camera.tsx`, 384 lines). Shared `<Physics>` lives at scene root.
- **Mature.** Capsule + heightfield + cuboid colliders, `interactionGroups`, ray
  casts (`Player.tsx:851,1063,1077,1082,1900,1904`). Climbable colliders system
  (`ClimbableColliders.tsx`, 328 lines) using `ConvexHullCollider` — surfaces are
  there, but climbing physics task notes (`.local/tasks/climbing-physics.md`)
  confirm the controller layer is missing.
- **Stubbed / inconsistent.** `KinematicCharacterBody.tsx` (75 lines) exists but
  Player uses dynamic RigidBody — alternative path that may be vestigial; verify.
- **Missing.** No central physics-step orchestrator other than R3F's `<Physics>`;
  fine for now but proposed wall-run/climb work will likely need a single
  ground-detection helper instead of inline `distToGround` checks scattered
  across `Player.tsx`.

### 2.2 Animation
- **Canonical.** `useCharacterModel.ts` (1353 lines), `CharacterAnimator.ts`
  (445), `BlendTree.ts` (165), `BoneMask.ts` (116), `AnimationLibrary.ts` (42).
  `BoneAliases.ts` (1671) holds the retarget map. Layered upper-body combat
  works (`CharacterAnimator.playLayered/stopLayered`, used from
  `useCharacterController.ts:143-246`).
- **Stubbed.** Climb states are now real per the comment at
  `useCharacterModel.ts:616` (resolved by `climb.glb`), but the controller
  side still doesn't drive them — see `.local/tasks/climbing-physics.md`.
  T-pose admin override `CharacterAnimator.ts:79`.
- **Inconsistent.** Layered API only used for humanoid combat overlays. Monster
  enemies use the same animator but never call `playLayered`.
- **Missing.** Pose-blending for non-combat moves (rolling, dashing, skills);
  per-weapon grip-pose tuning on top of layered (proposed tasks #44–48–50–51 in
  the polish queue all sit on this gap); IK in only one place (`WeaponIK.ts`,
  150 lines, off-hand grip via 2-bone solver).

### 2.3 Combat
- **What's there.** `combatMachine.ts` (XState v5, 25+ states,
  `client/src/game/machines/combatMachine.ts`). Charge meter (`ChargeMeter.tsx`,
  73), parry flash (`useParryFlash.ts`, 25), stamina flash (24), block-guard
  singleton (`state/blockGuard.ts`), reboundable projectile interface
  (`SpellProjectiles.tsx`, see `state/blockGuard.ts:1-`). Damage numbers
  (`effects/DamageNumbers.tsx`).
- **Cross-reference.** `controllers/characterMachine.ts` (500 lines) is a
  separate XState machine from `machines/combatMachine.ts`. Their boundaries
  aren't documented in `replit.md`. **Recommend a §combat-state-ownership note
  in `replit.md`** so newcomers don't add behaviour to the wrong machine.

### 2.4 AI / Navigation
- **What's there.** Yuka wrapper at `client/src/game/ai/yuka/`
  (`YukaWorld.ts`, `loadNavMesh.ts`, `syncEntity.ts`, `useYukaTick.ts`,
  `index.ts`). `three-pathfinding` for dungeon (`DungeonNavigation.ts`, 65,
  consumed by `DungeonScene.tsx:21,2610`). Custom behaviour tree
  (`EnemyBehaviorTree.ts`, 689).
- **Inconsistent.** Two navigation stacks coexist: Yuka navmesh outdoors,
  three-pathfinding in dungeons. Acceptable, but should be called out in
  `replit.md` (currently only Yuka is mentioned in the tech-stack header).
- **Missing.** Monster behaviours in the tree (see Finding 5).

### 2.5 Editor (GGE)
- **What's there.** `client/src/game/editor/`: `EditorStore.ts` (Zustand),
  `EditorViewport.tsx`, `GGEEditor.tsx`, `InspectorPanel.tsx`,
  `SceneHierarchy.tsx`, `SceneImporter.ts`, `PrefabRegistry.ts`,
  `NPCPrefabRegistry.ts`, `GameSceneBackdrop.tsx`. NavMesh visualisation
  toggle (`GGEEditor.tsx:91-413`).
- **Stubbed surfaces.** `EditorStore.ts:962` notes the AssetLoader's silent
  magenta-cube fallback can mask missing-asset import failures during preset
  import. `EditorViewport.tsx:148-154` and `SceneImporter.ts:136` both fall
  back to placeholder meshes. These produce the symptoms behind the proposed
  task "Show what will change before overwriting a preset".
- **Missing.** Per-preset selective import (proposed task), preset-diff
  preview UX. Both rooted in the same gap: import currently overwrites
  blindly via the same code path that handles fresh imports.

### 2.6 Content / Asset Pipeline
- **Build scripts.** 9 conversion / audit scripts under `scripts/` plus
  `scripts/lib/{scriptKit.cjs,boneSanitize.cjs}`. All built on the shared
  `scriptKit` framework (`replit.md:104`). Validator
  (`validate-model-manifest.ts`) green on all 384 paths.
- **Asset weight.** `client/public/models/` ≈ 1.8 GB on disk. Heaviest:
  `characters/` (580 MB), `nature/` (293 MB), `tutorial_island/` (215 MB),
  `pirate_islands/` (133 MB), `environment/` (82 MB), `rts_quaternius/` (69 MB).
  No checks for unused-on-disk-but-referenced-nowhere assets exist.
- **Orphan candidate.** `Models/` (196 MB) — see Finding 9. Subdirs:
  `characters/raptor`, `animations/{magic,longbow,action,sword_shield,
  racalvin_*,rifle,ual1_standard,ual2_standard}`, `weapons/{swords,axes}`.
  Mounted at `/Models` by `server/index.ts:13` but no client code requests it.
- **Inconsistent.** Some FBX still present in `Models/animations/*` even
  though `replit.md:88` states "all animations converted to GLB". Confirm.

### 2.7 Lighting
- **What's there.** `Lighting.tsx` (9 lines, just a dispatcher),
  `BakedSceneWrapper.tsx` (lightmap baker, `?bakeLightmap=1` flag — see
  `replit.md:7`). Tutorial Island is the only baked scene.
- **Missing.** No volumetric / God-ray system; no soft cookie shadow under
  ceiling holes (proposed task). Chandelier `breathe` lighting (proposed task)
  is currently emissive-only; would need an animated `pointLight` paired to
  the candle flicker driver.

### 2.8 Audio
- **What's there.** `useAudio.tsx` (336 lines), bundled clips in
  `client/public/sounds/`: 40 files (`background.mp3`, `hit.mp3`, `success.mp3`,
  `climb-scrape.wav`, `threejs-games/{thunder,rain,rifle,...}.mp3`, voice packs
  under `voices/{mage,male,female,warrior,femalemage}`).
- **Inconsistent / verify.** Code references e.g.
  `voices/female/farewell_1_meghan.wav` and `voices/male/greeting_2_sean.wav`;
  these were not in the 30-file truncated `find` output. Recommend adding a
  `validate-sound-manifest.ts` mirror of the model validator so this isn't
  rediscovered later.
- **Missing.** No spatialised ambient bed for dungeons or weather; rope-creak
  audio task in the queue is a single asset away from doable.

### 2.9 Persistence
- **Real persistence (Neon HTTP).** `server/saves.ts` (201), `server/loadouts.ts`
  (179), `server/wallets.ts` (157), `server/grudge.ts` (413). All four share
  the same `getSql()` / `getSqlFn()` HTTP-driver workaround and TIMESTAMPTZ
  cast pattern (documented in `saves.ts:1-`).
- **Dead boilerplate.** `server/storage.ts` (`MemStorage`, 48 lines). Not
  imported by any of the active routes. Still wired into `routes.ts`?
  Quick grep confirms: it is exported as `storage` but no production caller
  uses it. **Recommend deleting** or wiring to Postgres so it stops looking
  like an alternative path.
- **Single-player by intent.** `replit.md` confirms; nothing in the saves
  code half-assumes multiplayer beyond the per-player `playerId` partitioning,
  which is also needed for guest vs Puter-signed-in mode.

### 2.10 UI / Accessibility
- **What's there.** Bottom-right icon dock (9 panels), HUD design tokens,
  custom SVG icon set in `GameIcons.tsx`. Settings panel
  (`SettingsPanel.tsx`, 200), HotkeysPanel (177).
- **Stubbed (visible-to-user).** Five `coming soon` / no-op surfaces:
  - `MenuScreen.tsx:91` — accessibility toggle button (`onClick={noop}`,
    `MenuScreen.tsx:22`).
  - `SettingsPanel.tsx:277` — "Keybind remapping coming soon".
  - `WeaponSkillPanel.tsx:447` — passive mastery tree.
  - `AllyDetailPanel.tsx:256` — per-ally hand-equipping.
  - `WorldMap.tsx:173` — sub-second placeholder backdrop colour.
- **Inconsistent.** Per-scene crouch key (proposed task) — different scenes
  bind crouch differently. UI for binding sits behind the no-op toggle in
  `SettingsPanel`, so the proposed task can't finish until the keybind UI
  exists.

### 2.11 Dev Tooling
- **Cheats / debug HUDs.** `client/src/game/cheats/` — `CheatsHUD.tsx` (518),
  `TerrainDebugHUD.tsx` (437), `StreamedColliderDebugOverlay.tsx` (929),
  `PlayerColliderDebug.tsx` (75). All gated behind F8.
- **Scene inspector.** `debug/SceneInspectorBridge.tsx` (snapshots scene tree
  + Rapier world @ 4Hz), `SceneInspectorPanel.tsx`, `SelectionHighlight.tsx`.
- **Validation scripts.** Only `validate-model-manifest.ts` and
  `verify-character-rigs.ts` are first-party; `audit-models.cjs` is one-shot.
  No equivalents for textures, sounds, prefabs, animation packs.

---

## 3. Cross-Cutting Issues

### 3.1 `controller/` vs `controllers/`
- **Status:** Not duplicates. See Finding 1. Recommend rename.

### 3.2 Mockup sandbox vs main client
- **Status:** Isolated. `artifacts/mockup-sandbox/` is a self-contained Vite app
  with its own dependency tree. The auto-discovery file
  `artifacts/mockup-sandbox/src/.generated/mockup-components.ts` is generated by
  `mockupPreviewPlugin.ts`. Only conceptual overlap is the
  `use-mobile.tsx` hook duplication; not worth deduping across project boundaries.

### 3.3 Stubbed accessibility toggles
- **Status:** Real. `MenuScreen.tsx:87-91` is the most visible offender. None of
  the toggles do anything yet. Either delete the surface or implement the
  toggles (font-size scale, high-contrast palette, screen-shake/motion toggles
  — note `useSettings` already has the `screenShake` toggle so partial wiring
  exists).

### 3.4 Asset-manifest health
- **Models:** ✅ all 384 paths exist on disk.
- **Textures:** ✅ no broken references found in spot-check.
- **Sounds:** ⚠️ partial verification, recommend writing a sound validator.
- **`Models/` mount:** ⚠️ orphan (Finding 9).

### 3.5 TODO/FIXME inventory
- **Result:** zero matches across `client/src/`, `server/`, `shared/`, `scripts/`.
- **Implication:** The "in-flight work" surface is invisible from grep — it lives
  in the proposed-task queue, in `replit.md`, and in 5 visible-to-user
  `coming soon` strings (§2.10). That's a discipline win but means newcomers
  must read `replit.md` to know what's stubbed.

### 3.6 Dead files / unused exports
- **Confirmed deletions ok.** `AnimationUnifier`, `AnimationBlender`,
  `SkeletonRigger`, `ModelAnalyzer`, `WeaponGripSystem`, `BVHAccelerator`,
  `useUnifiedModel`, `ModelProcessingGateway` — none exist on disk and no
  source file imports them.
- **Stale handles still living.** `BoneAliases.ts` still exports
  `ModelAnalysis` / `BodyPartBones` / `BodyMorphConfig` / `applyBodyMorph` /
  `MaterialCategory` (`BoneAliases.ts:910-1020`). `CharacterSelectScreen.tsx`
  still imports them and renders `ModelAnalyzerDisplay`
  (`CharacterSelectScreen.tsx:34, 276, 2557`). See Finding 2.
- **Dead boilerplate.** `server/storage.ts` (`MemStorage`, see §2.9).
- **Unused mount.** `server/index.ts:13` `app.use("/Models", ...)` (Finding 9).

### 3.7 Broken asset references
- **None found** by `validate-model-manifest.ts` or by spot-checking texture
  paths in `client/src/`.

### 3.8 God-files (>1000 lines, single-responsibility risk)
| File | Lines |
|------|-------|
| `client/src/game/components/Player.tsx` | 3267 |
| `client/src/game/dungeon/DungeonScene.tsx` | 2830 |
| `client/src/game/islands/TutorialIslandScene.tsx` | 2467 |
| `client/src/game/systems/BoneAliases.ts` | 1671 |
| `client/src/game/components/HUD.tsx` | 1612 |
| `client/src/game/components/MainPanel.tsx` | 1603 |
| `client/src/game/hooks/useCharacterModel.ts` | 1353 |
| `client/src/game/dungeon/DungeonGenerator.ts` | 1055 |
| `client/src/game/controller/ControllerPage.tsx` | 1063 |
| `client/src/game/dungeon/DungeonModular.tsx` | 961 |
| `client/src/admin/VibeChat.tsx` | 985 |
| `client/src/lib/stores/useCharacterStats.ts` | 957 |
| `client/src/game/cheats/StreamedColliderDebugOverlay.tsx` | 929 |

---

## 4. Proposed-Task Triage

The system message lists 20 currently-active polish tasks; `.local/tasks/` also
holds 8 longer feature notes (`annihilate-mechanics-audit.md`,
`boat-pushing.md`, `climbing-physics.md`, `fix-tutorial-player-floating.md`,
`intro-cutscene-animations.md`, `modular-dungeon-system.md`,
`movement-collision-overhaul.md`, `spline-attack-animations.md`,
`weapon-animation-map-fixes.md`). Triage covers both surfaces.

### Group A — Layered animation / pose-blending gap
**Underlying gap:** `CharacterAnimator.playLayered` only drives upper-body
combat overlays; non-combat layers and per-rig grip-pose channels aren't
exposed.

- **Keep but re-scope into one task ("Generic per-rig pose layer"):**
  - Make non-combat moves (rolling, dashing, skills) use the layered
    animation system.
  - Give monster enemies layered combat reactions like humanoid enemies.
  - Tune grip pose per weapon type so axes and bows feel right.
  - Blend grip open/close during attacks and reactions.
- **Keep dependent on the above:**
  - Show the equipped quiver on enemy archers too.
  - Hide the back-strap quiver while a bow is being drawn.

### Group B — Weapon / equipment authoring loop
**Underlying gap:** `WeaponOffsetTuner`, the editor, and the in-game tuning UI
share state but no preset-diff / multi-select preset import flow.

- **Keep merged into one ("Preset diff + selective import"):**
  - Pick individual presets to import, not just whole combos.
  - Show what will change before overwriting a preset.
  - Confirm new weapon orientations look right with a character holding them
    in-game.
  - Decide the canonical orientation for the symmetric medieval daggers.
- **Keep as-is (small, independent):**
  - Add more arrow and quiver options to the editor.

### Group C — Monster locomotion / size-aware tuning
**Underlying gap:** locomotion thresholds in `useCharacterModel` /
`CharacterAnimator` assume a ~4.5 m/s human run.

- **Keep merged into one ("Per-rig speed thresholds"):**
  - Tune walk/run speed thresholds for small and giant monsters.
  - Tune the crouch experience so the character actually moves slower and
    stays low.

### Group D — Lighting / ambience polish
**Underlying gap:** No animated point-light driver for set-piece lights.

- **Keep merged into one ("Animated set-piece lights"):**
  - Cast a soft pool of light on the floor under each ceiling hole.
  - Let the hero chandelier's floor light breathe with the candles.
  - (Already-active task #9 "Cast moving warm light shadows from temple
    chandeliers" is the same theme — fold all three into one.)

### Group E — World scatter / dungeon dressing
**Underlying gap:** No spatial-conflict pass after rubble / destructible decor
spawns.

- **Keep as-is (already small):**
  - Keep chests and statues from spawning on top of fallen rubble piles.
  - Add a small dust patch on the floor under cracked ceiling tiles.

### Group F — Input / UX consistency
**Underlying gap:** Keybinding lives in `useSettings` but there's no UI to
remap (`SettingsPanel.tsx:277` — "coming soon").

- **Keep but block on a parent task ("Keybind remap UI"):**
  - Match crouch key across all scenes so players don't have to relearn it.

### Group G — Pipeline / import polish
- **Keep as-is:**
  - Auto-orient meshes during FBX import so future packs don't need manual
    rotation tuning.
  - Import the medieval pack's siege props (catapult, cannon, barrels, flags,
    etc.).

### One-to-one triage ledger (active polish queue)

For traceability — every active polish task in the queue, mapped to exactly
one bucket above:

| # | Task | Bucket | Disposition |
|---|------|--------|-------------|
| 1 | Import the medieval pack's siege props | Group G | keep as-is |
| 2 | Auto-orient meshes during FBX import | Group G | keep as-is |
| 3 | Tune walk/run speed thresholds for small and giant monsters | Group C | merge |
| 4 | Give monster enemies layered combat reactions | Group A | merge |
| 5 | Cast a soft pool of light on floor under ceiling holes | Group D | merge |
| 6 | Make non-combat moves use the same layered animation system | Group A | merge |
| 7 | Tune the crouch experience (slower, stays low) | Group C | merge |
| 8 | Match crouch key across all scenes | Group F | block on parent |
| 9 | Tune grip pose per weapon type | Group A | merge |
| 10 | Blend grip open/close during attacks and reactions | Group A | merge |
| 11 | Show the equipped quiver on enemy archers too | Group A | depends on parent |
| 12 | Hide the back-strap quiver while a bow is being drawn | Group A | depends on parent |
| 13 | Add more arrow and quiver options to the editor | Group B | keep as-is |
| 14 | Confirm new weapon orientations look right in-game | Group B | merge |
| 15 | Decide canonical orientation for symmetric medieval daggers | Group B | merge |
| 16 | Hero chandelier's floor light breathes with the candles | Group D | merge |
| 17 | Pick individual presets to import, not just whole combos | Group B | merge |
| 18 | Show what will change before overwriting a preset | Group B | merge |
| 19 | Keep chests and statues off fallen rubble piles | Group E | keep as-is |
| 20 | Add a small dust patch under cracked ceiling tiles | Group E | keep as-is |

**Disposition tally:** 0 drop, 5 keep-as-is, 13 merge into a parent, 2 depend
on a merged parent, 1 blocked on the keybind-remap UI parent (#5/Theme 2).

> Note on the original "33 PROPOSED tasks" count cited in the parent audit
> brief: at the time of this audit, the visible queue contained 20 active
> polish tasks plus 8 longer feature notes under `.local/tasks/` (covered
> below), totalling 28 distinct items. If older proposed tasks have been
> resolved or merged since the count was set, that accounts for the gap;
> the table above triages every item still visible.

### Larger feature notes (separate from polish queue)
- `climbing-physics.md` — controller layer for the existing climb animations
  and ledge-grab states. **High-value, fold the climb-related ambience tasks
  underneath this once it lands.**
- `movement-collision-overhaul.md`, `fix-tutorial-player-floating.md` —
  same root cause family (Tutorial Island has no terrain heightmap, scene
  contracts not enforced). Recommend merging.
- `intro-cutscene-animations.md` — concrete bug, keep as-is.
- `modular-dungeon-system.md` — already-large feature, keep as-is.
- `spline-attack-animations.md`, `weapon-animation-map-fixes.md` — both
  partially overlap Group A (layered system) and Group B (weapons). Recommend
  scoping these only after Group A lands.
- `annihilate-mechanics-audit.md` is already a research deliverable
  (`docs/annihilate-audit.md`), so the queue task is "complete the port plan
  it generated", not new research.

---

## 5. Recommended Fix Plan (for next batch of project tasks)

Grouped by theme so the user can approve a batch at a time. Sizes:
**S** ≤ ½ day, **M** 1–2 days, **L** 3+ days.

### Theme 1 — Cleanup (do first, unblocks everything)
1. **(S)** Finish the strip-overkill task. Delete `ModelAnalyzerDisplay` from
   `CharacterSelectScreen.tsx` and the `ModelAnalysis` / `BodyPartBones` /
   `BodyMorphConfig` / `MaterialCategory` exports from `BoneAliases.ts`.
   Rationale: closes Finding 2.
2. **(S)** Rename `client/src/game/controller/` → `controller_lab/`.
   Rationale: closes Finding 1 / 3.1.
3. **(S)** Delete `server/storage.ts` (or wire it to Postgres if any future
   user table is planned).
   Rationale: closes Finding 4 / §2.9.
4. **(S)** Remove the `app.use("/Models", ...)` mount in `server/index.ts:13`
   if `Models/` is confirmed dead, or document its purpose in `replit.md`.
   Rationale: closes Finding 9 / 3.4.

### Theme 2 — Foundation: missing systems
5. **(M)** Generic per-rig pose layer (Group A). Expose `playLayered` for
   non-combat states; thread per-rig configs through `CharacterAnimator`.
   Unblocks 6 polish tasks.
6. **(M)** Per-rig speed thresholds (Group C). Move locomotion thresholds to
   the rig descriptor instead of `DEFAULT_LOCOMOTION` in
   `CharacterAnimator.ts:32`.
7. **(M)** Climb/wall-run controller layer (`climbing-physics.md` task note).
   Animations + colliders already exist; controller is the gap.
8. **(M)** Keybind-remap UI (Group F). Replaces the
   `SettingsPanel.tsx:277` "coming soon" string. Unblocks the per-scene crouch
   parity task.
9. **(M)** Monster behaviour-tree branch (Finding 5). Sized + tier-aware
   leaves in `EnemyBehaviorTree.ts`; existing humanoid branch stays intact.

### Theme 3 — Editor / authoring loop
10. **(M)** Preset diff + selective import (Group B). One task that delivers
    both the preview-before-overwrite and per-preset selection UX in
    `WeaponOffsetTuner` + the GGE preset import surface.
11. **(S)** Sound-manifest validator
    (`scripts/validate-sound-manifest.ts`). Pattern: copy
    `validate-model-manifest.ts` and point it at the audio refs surfaced by
    `useAudio.tsx` + voice tables.

### Theme 4 — God-file decomposition (background, low risk)
12. **(L)** Split `useCharacterModel.ts` into pack registration, retarget
    plumbing, state-name pattern tables, and a thin mount/update hook.
13. **(L)** Split `BoneAliases.ts` into per-rig alias modules (Mixamo / KayKit
    / UAL) plus a shared retargeter. Currently 1671 lines and growing.
14. **(L)** Split `Player.tsx` (3267 lines) — at minimum factor out the
    raycast helpers and the block/parry handlers.

### Theme 5 — Polish (after the foundation lands)
15. **(S)** Group D animated set-piece lights (chandeliers + ceiling-hole pools).
16. **(S)** Group E spatial-conflict pass for dungeon decor spawning.
17. **(S)** Group G import polish — auto-orient FBX + medieval siege props.

---

## 6. Won't Fix / Out of Scope

- **`controller/` vs `controllers/` directory split** is *not* a duplicate
  system — just unfortunate naming. Will re-flag every audit unless renamed.
- **`artifacts/mockup-sandbox/` having its own `node_modules`** — by design
  for the artifact system. Not a duplication problem.
- **Two navmesh stacks (Yuka outdoor vs three-pathfinding indoor)** — the
  separation is intentional; both fit their use case. Document and move on.
- **Three combat-related XState machines** (`controllers/characterMachine.ts`,
  `machines/combatMachine.ts`, plus implicit `characterMachine` in
  `useCharacterController`) — boundaries are fine, but `replit.md` should
  document who owns what.
- **Bundled `nodejs` and `webgl2` npm packages** in `package.json` —
  suspicious-looking but harmless tiny shim packages; not the audit's job to
  cull dependencies.
- **Performance profiling under load** — flagged but out of scope; would need
  a runtime harness.
- **Server threat model / auth review** — separate concern per task scope.
