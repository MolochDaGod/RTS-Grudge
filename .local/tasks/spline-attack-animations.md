# Spline-driven attack polish pass

## What & Why
Attacks today rely on baked FBX clips played through linear cross-fades, with no procedural arc on top of the swing and no visual weapon trail. The result feels stiff: anticipation and follow-through are abrupt, the blade just teleports through the swing, and there's nothing in the air to sell a clean cut. This pass introduces splines in three coordinated places — motion, timing, and visuals — so every attack has a curved path, eased blending, and a swept trail behind the blade.

## Done looks like
- Each attack swing (attack1, combo2, attack3, uppercut, chargeAttack, chargeAttackMax, chargeFist, chargeStrike, heavyAttack) drives the weapon/right-hand offset along a per-attack spline arc layered on top of the baked clip — the blade visibly carves a curve instead of a straight chop.
- Cross-fades into and out of attack states use spline-eased curves (anticipation easing in, snappier release easing out) instead of the current linear `fadeIn`/`fadeOut` ramps. Combos chain noticeably more crisply.
- A swept ribbon/trail follows the blade tip through every swing, fading out over ~250ms; trail color/intensity scales with charge tier (subtle on attack1, bright on chargeStrike / chargeAttackMax).
- Charged release tiers reuse the same trail with stronger color and a wider arc spline so the existing tier-1 vs tier-2 distinction (Task #81 territory) reads visually as well.
- Works for both player and humanoid enemies that use the upper-body combat layer; monster enemies (still on the override slot) at minimum get the visual trail even if procedural arc layering is skipped for now.
- No regressions to hit registration, combo windows, or charge thresholds — splines are layered cosmetically on top of the existing `combatMachine` timings.

## Out of scope
- Re-authoring or replacing the baked attack FBX clips themselves.
- Extending `BoneMask` to monster skeletons (Task #45 owns that). Procedural arc layering on monsters can wait until #45 lands.
- Parry/block timing changes (Task #95) and charge-release juice tuning (Task #81) — this task only adds the spline systems they can later hook into.
- Spline-driven locomotion, rolls, dashes, or skill animations (Task #47 territory).

## Steps
1. **Per-attack swing-arc splines** — Define a small data table of named CatmullRom/Bezier curves in local hand-space (one per attack state in `COMBAT_STATE_ANIMS`), with a normalized 0→1 time parameter mapped to the clip's duration. Add a hook in `CharacterAnimator` that, while a layered combat clip is playing, samples the active arc and applies a small additive offset/rotation to the right-hand bone (and mirror to off-hand for two-handers) so the weapon carves the authored curve.
2. **Spline-eased blend transitions** — Replace the linear fade ramps used when entering/exiting layered combat clips and override clips with eased curves (slow-in for anticipation, fast-out for follow-through). Expose an easing-curve parameter on `playLayered` / `playOverride` / `fadeOut` so each attack can pick its own curve; default the rest of the system to a neutral ease so non-combat behavior is unchanged.
3. **Blade-tip weapon trail** — Add a new `WeaponTrail` effect component that samples the blade-tip world position each frame while a combat state is active, builds a CatmullRom curve through the recent samples, and renders it as a tapered, fading ribbon (additive material). Wire it to mount on the equipped weapon mesh, gate by attack-active flag from `combatMachine`, and parameterize color/width/lifetime by charge tier.
4. **Wire charge tiers + integration test pass** — Hook charge state (`charging` / `charged1` / `charged2` / chargeStrike) into the trail's color+width and into a wider arc-spline variant for the corresponding release. Manually verify in-game across: basic combo (attack1→combo2→attack3→uppercut), chargeAttack vs chargeAttackMax release, heavyAttack, and at least one humanoid enemy (skeleton or pirate) swinging at the player. Confirm hit registration, combo windows, and screen shake still trigger on the same frames as before.

## Relevant files
- `client/src/game/anim/CharacterAnimator.ts`
- `client/src/game/anim/BoneMask.ts`
- `client/src/game/anim/BlendTree.ts`
- `client/src/game/machines/combatMachine.ts`
- `client/src/game/controllers/CombatController.ts`
- `client/src/game/controllers/useCharacterController.ts`
- `client/src/game/components/WeaponMesh.tsx`
- `client/src/game/components/Player.tsx`
- `client/src/game/components/Enemy.tsx`
- `client/src/game/effects/SkillEffects.tsx`
- `client/src/game/effects/SpellProjectiles.tsx:1142`
- `client/src/game/hooks/useCharacterModel.ts`
- `client/src/game/systems/BoneAliases.ts`
