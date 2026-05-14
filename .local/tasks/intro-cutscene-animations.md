# Real animations in the intro cutscene

## What & Why
The intro cutscene currently shows several characters (the crew fighting on deck, the player being grabbed and thrown, and the survivors washing up on the raft) standing in a T-pose instead of actually animating. The cutscene wiring itself is fine — it clones each character with `SkeletonUtils.clone`, builds a fresh `AnimationMixer`, picks a clip by keyword, and calls `mixer.update(delta)` every frame. The problem is the **animation source**: the intro is the only place in the project that points at the Kay Kit packs (`Rig_Medium_CombatMelee.glb`, `Rig_Medium_General.glb`, `Rig_Medium_Special.glb`), and those clips get bound directly to the cloned mesh with no retargeting. Every in-game character is rigged for and animated by the project's Mixamo packs (`glocomotion/`, `glocomotion_combat/`, `racalvin_*/`, `action/`, `longbow/`, `sword_shield/`, `magic/`, etc.) which are already wired through the project's retargeter + bone-alias map. So when a Mixamo-rigged character receives a Kay Kit clip, every track resolves to a missing bone and the body silently holds its rest pose.

The fix is to swap the intro over to the Mixamo packs we already ship and already animate every character with in gameplay. Pick clips that read clearly for each cutscene beat — idle on the raft, fight on the deck, grab/carry, struggle, thrown/falling, lying down, getting up — from the existing folders. If the right clip isn't in the library, we can drop in a fresh Mixamo download in the same folders later without changing this code.

## Done looks like
- The crew on the enemy deck visibly swing/slash/grab during the volley and grab phase — no T-pose.
- The thrown player character visibly idles, struggles while being lifted, tumbles in the air, and lies / stirs on the raft afterwards.
- The two survivors (elf and dwarf) on the wash-up raft visibly lie face-down and stir / lift, instead of standing rigid.
- The "No target node found for track: …" warnings stop firing during the intro for these characters.
- Works for every playable race the player might pick at character select (since the intro's thrown character uses `selectedCharacter.modelPath`).
- No regressions: the cutscene still finishes on time, transitions into gameplay cleanly, and doesn't crash or stall on slow asset loads.

## Out of scope
- Re-choreographing the cutscene timeline, camera, or staging.
- Building new animations or commissioning new motion-capture — only use what's already in `client/public/models/animations/`. (The user can drop in additional Mixamo clips later without code changes if a beat needs a better match.)
- Touching the in-game retargeting pipeline itself.
- Adding facial / hand finger animation; we just want the major bones to move.

## Steps
1. **Swap the intro's animation source from Kay Kit to Mixamo.** Replace the three `ANIM_*_PATH` constants in `IntroCutscene.tsx` so the cutscene loads from the Mixamo-style packs the in-game characters already use (e.g. `glocomotion/`, `glocomotion_combat/`, `racalvin_*`). Pick the pack(s) that contain the beats the timeline needs: idle / fight (slash/swing/attack) / grab-carry / struggle-react / thrown-fall / lying-down / getting-up. Keep the existing `findClipByKeywords` selection logic so the cutscene's named-clip choices still drive which clip plays per phase — just update the keyword lists so they match the actual Mixamo clip names in those packs.
2. **Bind clips through the same path the in-game characters use.** Right now `useIntroAnimatedModel` builds a raw `AnimationMixer` against the cloned scene and plays raw clips. Route the cloned model + selected clip through the same retargeting / bone-alias flow used in `useCharacterModel.ts` (so `mixamorig:*` namespaces, sanitised names, and the project's bone aliases are all handled) before binding to the mixer. This is the same machinery that makes gameplay animations bind cleanly across every race.
3. **Verify on every playable race.** Walk through character select with each unlocked race, trigger the intro, and confirm the thrown character actually animates. Spot-check the crew + survivors with their fixed models (`elf-female`, `dwarf-male`, `human_battle_mage-male`, `undead_grave_knight-male`, `night_stalker-male`).
4. **Defensive fallback.** If a particular character + clip combo still produces zero bound tracks (e.g. an exotic rig like centaur or avian), fall back to a small built-in idle wobble / sway on that character so they're never visibly frozen on screen. Log a single warning per character/clip pair so we can spot which rigs need follow-up, without spamming every frame.
5. **Reality check.** Restart the workflow, watch the full intro, confirm no T-poses, no console spam, smooth transition into gameplay.

## Constraints
- Don't change the cutscene's timeline constants, camera, lighting, or staging.
- Don't break the existing "single canonical sizing" behaviour (`normalizeCharacterHeight`) — the intro hero must still match the in-game player's height.
- Don't introduce a second retargeting implementation; reuse the in-game one. If it needs a small extraction/refactor to be callable from the intro, do that minimally.
- Don't delete the Kay Kit pack files from disk — just stop pointing the intro at them.

## Relevant files
- `client/src/game/IntroCutscene.tsx:1-240,510-624,626-740,820-940`
- `client/src/game/hooks/useCharacterModel.ts`
- `client/src/game/systems/BoneAliases.ts`
- `client/src/game/systems/BoundsUtils.ts`
- `client/src/game/anim/CharacterAnimator.ts`
- `client/public/models/animations/glocomotion`
- `client/public/models/animations/glocomotion_combat`
- `client/public/models/animations/racalvin_base`
- `client/public/models/animations/racalvin_sword_shield`
- `client/public/models/animations/racalvin_unarmed`
- `client/public/models/animations/action`
