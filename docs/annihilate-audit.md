# Annihilate / `MolochDaGod/annihilatetrainer` Reference Audit

**Reference repo:** [`MolochDaGod/annihilatetrainer`](https://github.com/MolochDaGod/annihilatetrainer) — fork of `gonnavis/annihilate`. Cloned to `/tmp/scratch/annihilatetrainer/`.

**Scope:** ~8,732 LOC across 45 ES-module source files in `src/`. This document maps every Annihilate gameplay mechanic to the equivalent system in our game and recommends a port plan with size estimates. **No code changes are made by this audit** — it is a research deliverable only.

**Conventions used in this document:**
- **Source** — file/line range in the reference repo (`/tmp/scratch/annihilatetrainer/src/<file>.js`).
- **What it does** — concrete behavior, not a paraphrase.
- **Our equivalent** — the file/system in our codebase that owns the same responsibility today, or `none` if missing.
- **Gap delta** — the meaningful difference between Annihilate's behavior and ours.
- **Port plan** — concrete steps, with a size tag: **S** (≤½ day), **M** (1–2 days), **L** (3+ days).
- **Priority** — `P0` = must-have (first wave), `P1` = nice-to-have (second wave), `P2` = nice-to-have (polish / ambient), `Skip` = out of scope (do not port).

---

## 1. Priority Summary

The table below is the executive index. Each row points to the per-module entry below for full context.

| # | Annihilate module / mechanic | Group | Our equivalent | Size | Priority |
|---|------------------------------|-------|----------------|------|----------|
| 1 | Charge-attack chain (`attack → chargeAttack → chargeFist → chargeStrike`) with hold-J levels 0/1/2 | Player Moveset | `combatMachine.ts` (no charge subgraph) | M | **P0** |
| 2 | Motion-input parser (SDJ Hadouken, DSDJ Shoryuken, SAK Tatsumaki/Ajejebloken) gated by `block` state | Player Moveset | none (skills exist as direct hotkeys) | M | **P0** |
| 3 | `bash → whirlwind` (hold U) + `bashStartNotWhirlwind` (tap U) | Player Moveset | `whirlwind` animation only, no hold-vs-tap branch | S | **P0** |
| 4 | `Pop` AOE sphere (J+K+L chord) — single-use radial knockback | Player Moveset | `pop` animation key only, no AOE body | S | **P0** |
| 5 | `launch → launchWithJump → launch` lifter (O / O-hold) with `gsap` lift to `liftDistance` | Player Moveset | `launch`, `launchJump` animation states only | M | **P0** |
| 6 | Wall-climb on ±X collision (`climbContactSign`, `climbJump` with sign-flip velocity) | Movement | `climb` animation state, no wall-detect logic | M | **P1** |
| 7 | `airDash` with mass-zero, `dashFall` lock-out, `airBash` ground-pound | Movement | `dash`, `dashAttack` (ground only) | M | **P1** |
| 8 | `chargedLevel` visual feedback — sword emissive + color shift + `SwordBlink` flash | Player Moveset | none | S | **P1** |
| 9 | `SwordBlaster` projectile (level-2 charge release, 3 angles) | Projectiles | `SkillEffects.swordBlaster`, `swordBlaster2` anims only | M | **P1** |
| 10 | `Hadouken` / `PaladinHadouken` cylinder projectile with **rebound** on block | Projectiles | `SpellProjectiles.FireballProjectile` (no rebound) | M | **P0** |
| 11 | `Bullet` linear projectile with rebound | Projectiles | `SpellProjectiles` (no rebound) | S | **P1** |
| 12 | `Grenade` parabolic projectile with `move → stop → explode` FSM | Projectiles | none | M | **P1** |
| 13 | `Splash` red impact box with gsap rise+fade | World FX | `ParticleEffects.tsx` general system | S | **P2** |
| 14 | `SwordBlink` 12-shard flash mounted on sword bone | World FX | none | S | **P2** |
| 15 | `Shield` collider tracking `paladin.shieldDelegate` bone — drives `blocked` event when struck | Defense | `block` state only, no shield collider | M | **P1** |
| 16 | Block-state input gate that consumes inputs into the seq buffer instead of triggering attacks | Defense | `BLOCK` / `BLOCK_UP` events only | S | **P0** |
| 17 | `GreatSword` / `Sword` / `HandKnife` bone-attached weapon hitboxes with `canDamage` tag check | Weapons | `WeaponMesh.tsx` visual mount, no per-frame physics body | L | **P1** |
| 18 | `Flail` chain — N kinematic spheres + Cannon constraints, swung from a delegate bone | Weapons | none | L | **P2** |
| 19 | `Mutant` enemy + `MutantAi` (chase + 4 s attack cooldown, `attack`/`keyJUp` simulation) | Enemies | `Enemy.tsx` + `EnemyBehaviorTree.ts` | M | **P1** |
| 20 | `Paladin` enemy + `PaladinAi` (with hadouken throw) | Enemies | `Enemy.tsx` (no projectile-AI variant) | M | **P1** |
| 21 | `Robot` + `RobotAi` (basic hadouken thrower) | Enemies | same | S | **P1** |
| 22 | `Parrot` + `ParrotAi` (random `attack`/`grenade` choice) | Enemies | same | M | **P1** |
| 23 | `RobotBoss` + `RobotBossAi` — multi-phase `hadouken / whirlwind / pop / weak / hit` machine | Bosses | `BossSpawner.tsx` (basic spawn, no phase machine) | L | **P0** |
| 24 | `RobotBossWeakness` — temporary vulnerability shell that triggers `weak → pop → hit` loop | Bosses | none (no weakness/parry-window concept) | M | **P1** |
| 25 | `RobotBossWhirlwind` / `RobotBossPop` / `RobotBossHadouken` — boss attack composers | Bosses | none | M | **P1** |
| 26 | `Catapult` kinematic prop with periodic `setInterval` launch + emissive warning | Props | none | M | **P2** |
| 27 | `JumpPoint` trigger sphere that sends `'jumpPoint'` event to enter `airIdle` (anti-grav lift) | Props | none | S | **P2** |
| 28 | `Teleporter` trigger box that warps `belongTo.body.position` to `dest` | Props | none | S | **P2** |
| 29 | `FloatingBox` kinematic platform with sin-wave Y motion | Props | none | S | **P2** |
| 30 | `TranslatedBox` rotating box w/ shape offset (Cannon shape pivot trick) | Props | none | S | **P2** |
| 31 | `Box` / `Hill` / `Ground` / `TorusKnot` / `Level` static colliders | Props / World | `Terrain.tsx`, `getTerrainHeight` | S | **P2** |
| 32 | `BirdFlock` GPGPU boids (~563 LOC of GPUComputationRenderer + bird-shader) | World FX | none | L | **P2** |
| 33 | `Cloud` 3D volumetric noise raymarched cloud | World FX | none | M | **P2** |
| 34 | `Attacker` base class — multi-body collider with `canDamage` tag gating | Engine | `CombatController.ts` hit detection (raycast/sphere) | M | **P1** |
| 35 | `Ai` base class — sphere-trigger detector + chase + face-target | Engine | `EnemyBehaviorTree.ts` | reuse | **Skip** (already done better) |
| 36 | `RoleControls` — keyboard tickKey/holdKey/seqKey input dispatcher | Engine | `MovementController.ts` + input layer | reuse | **Skip** (don't replace) |
| 37 | `global.js` — collision group bitmasks (`GROUP_ROLE`, `GROUP_ENEMY`, etc.) | Engine | implicit groups in Rapier setup | S | **P1** |
| 38 | `index.js` — boot, asset loading, `OrbitControls`, world.step loop | Engine / Camera | Our R3F root, `Camera.tsx` | reuse | **Skip** (camera out of scope) |
| 39 | `OrbitControls` follow camera in Annihilate `index.js` | Camera | `Camera.tsx` (with screen-shake) | — | **Skip** |
| 40 | `setMassZero` / `restoreMass` pattern around hover/launch attacks | Engine | none (Rapier rigidbody type swap) | S | **P1** |
| 41 | `getAltitude` raycast for ground / `setAir` flag | Engine | `useCharacterController.ts` (`isGrounded`) | reuse | **Skip** |
| 42 | `Maria.swordDelegate` / `swordTipDelegate` / `swordBone` bone proxies for IK-like weapon FX | Engine | `WeaponMesh.tsx` weapon attachment | reuse | **Skip** (use existing IK) |
| 43 | `Mutant`/`Paladin`/`Robot` cloned shadow mesh (commented-out pseudo-shadow shader) | World FX | drop shadows from R3F renderer | — | **Skip** (we have real shadows) |
| 44 | `gsap` tween for `playLauncStart` lift / `playWhirlwind` rotation | Engine | `framer-motion`/manual lerp in our skill FX | S | **P1** (port the timing curves only) |
| 45 | `Three Cannon` / `cannon-es` integration | Engine | `@react-three/rapier` | reuse | **Skip** (do NOT introduce cannon) |

---

## 2. House Rules

These are non-negotiable constraints for any future port work. They reflect the architectural commitments we have already made and exist to keep the port from regressing the codebase.

1. **Do not modify the camera.** Annihilate ships an orbit camera in `index.js` and a few `gsap` tweens that nudge the camera; flag any item that touches camera state as **Skip**. Our `client/src/game/components/Camera.tsx` already handles follow logic and screen-shake via `useSettings.ts`. Screen-shake hookups are fine; replacing the camera is not.
2. **Reuse the existing XState combat machine.** Annihilate's `Maria.js` defines a single 1.5k-LOC `state-machine.js`-style FSM. We have `client/src/game/machines/combatMachine.ts` and `client/src/game/controllers/characterMachine.ts` (parallel locomotion + combat regions). Add new states/regions there — do **not** introduce a parallel state library or a per-character monolithic FSM.
3. **Reuse Rapier physics.** Annihilate uses `cannon-es` for capsule bodies, raycasting, and constraints (chain on `Flail`, `ConvexPolyhedron` on `Level`). Map each Cannon usage onto `@react-three/rapier` equivalents (CapsuleCollider, RigidBody, RopeJoint, ConvexHullCollider). Do **not** add `cannon-es` to `package.json`.
4. **Reuse `useCharacterModel`, `AnimationController`, `AnimationBlender`.** Annihilate's `fadeToAction(name, duration)` pattern is already covered by our `useCharacterModel.ts` animation registry and the blender stack. New animations should be added as keys in `AnimationState`, not as bespoke `mixer.clipAction` calls.
5. **Reuse the weapon catalog and IK rig.** `WeaponPrefabs.ts` + `WeaponSkillData.ts` + `WeaponMesh.tsx` already cover sword/greatsword/dagger/etc. Annihilate's `swordDelegate` / `shieldDelegate` bone offsets (e.g. `Maria.swordDelegate.position.set(-26.34, 7.10, 46.97)`) should inform tuning constants, not replace our prefab system.
6. **Skip cosmetic / tutorial / boilerplate Annihilate code.** Things like `OrbitControls`, the Annihilate-specific GLTF asset paths, the commented-out pseudo-shadow shader, and the `setInterval` debug `Catapult` triggers should not be ported verbatim — extract the gameplay idea, not the line.

---

## 3. Per-Module Audit (grouped)

The following sections cover all 45 source files. For brevity, very small modules (`global.js`, `Box.js`, `Ground.js`, `Hill.js`) are folded into their group.

### 3.1 Player Moveset

These modules drive the playable character `Maria`.

#### Maria.js — 1503 LOC — the player FSM and all of her actions
- **Source:** `Maria.js` lines 1–1503 (state graph ~120–600, action implementations ~600–1200, body+load ~1200–1503).
- **What it does:** Defines a giant XState machine for Maria with states `loading / idle / run / dash / dashAttack / airDash / dashFall / fall / doubleFall / jump / doubleJump / climb / climbJump / hit / block / attack / fist / strike / charging / charged1 / charged2 / chargeAttack / chargeFist / chargeStrike / launchStart / launchWithJump / launch / bashStart / whirlwind / hadouken / shoryuken / ajejebloken / airAttack / airFist / airStrike / airBashStartWithCharge / airChargeBash / airBash / airBashEnd`. Each entry drives `fadeToAction(name, duration)` on a `THREE.AnimationMixer`. Charge sub-graph: `attackStartWithCharge → charging (after 500ms) → charged1 (after 500ms) → charged2`, key-up at any rung commits to `attack` / `chargeAttack` (which on completion can be combo-ed into `chargeFistStart → chargeFist → chargeStrikeStart → chargeStrike → chargeStrikeEnd`). Charge level 2 entries (`playChargeAttack`, `playChargeFist`, `playChargeStrike`) also instantiate `new SwordBlaster(this, type)` so the charged release fires a projectile in addition to the melee swing. `setMassZero` / `restoreMass` are entered/exited around `airBashStartWithCharge` and `airDash` to suspend gravity. `playShoryuken` and `playLauncStart` use `gsap.to(this.body.position, { duration: 0.3, y: y + this.liftDistance })` then snap `velocity.y = 0` — this is the lift trick. `getAltitude(maxDistance)` raycasts straight down via `world.raycastClosest` to decide air/ground every tick.
- **Our equivalent:**
  - `client/src/game/machines/combatMachine.ts` — already has `attack/attack2/combo2/combo3/fastCombo/heavyAttack/uppercut/spinSlash/counterStrike/risingSlash/dashAttack/jumpBash/whirlwind/launch/launchJump/pop` slots.
  - `client/src/game/controllers/characterMachine.ts` — parallel locomotion / combat / posture regions.
  - `client/src/game/controllers/useCharacterController.ts` — drives Rapier body, jump/fall, `isGrounded`.
  - `client/src/game/hooks/useCharacterModel.ts` — animation registry, `AnimationState` includes most of Maria's keys plus extras.
- **Gap delta:** We have most animation slots but NO charge sub-graph (`charging → charged1 → charged2 → chargeAttack/chargeFist/chargeStrike`), NO `bashStart → whirlwind` hold-vs-tap branching, NO `launchStart → launchWithJump` lifter chain, and NO `setMassZero/restoreMass` mass-toggle pattern around aerial specials.
- **Port plan (M for charges, M for launcher, S for whirlwind hold):**
  1. Add `charging`, `charged1`, `charged2` substates to `combatMachine.ts` under a new `charge` region keyed off `LMB` / `LMB_UP`. Use `actionTimer` / `chargeTime` (already in `CombatContext`) to tick 500ms thresholds. Visual feedback hook calls into the weapon mesh emissive (S follow-up tied to `SwordBlink`).
  2. Add `bashStart` substate that branches: `RMB_UP` within window → tap-bash; otherwise `whirlwind` enters. The `whirlwind` exit action kills any held tween.
  3. Add `launchStart` substate: enter triggers a Rapier impulse on Y (mirroring `liftDistance`), schedules `LANDED` recovery; `KEY_UP` within window cancels into `launch` short hop.
  4. For mass-zero, swap RigidBody `gravityScale` to `0` on entry and back to `1` on exit (Rapier's analog of Cannon `mass = 0`).

#### RoleControls.js — 228 LOC — input dispatcher with motion-input parser
- **Source:** `RoleControls.js` lines 1–228.
- **What it does:** Maintains three input maps — `holdKey` (currently held), `tickKey` (this-frame edge), `seqKey` (rolling motion buffer cleared after 150 ms). On every `keydown` while `role.service.state.matches('block')`, pressing `J` checks the seq for `S → D` (Hadouken) or `D → S → D` (Shoryuken); pressing `K` checks for `S → A` (Ajejebloken). The chord `J+K+L` calls `role.pop?.pop()` directly. Other ticks dispatch `attack/jump/dash/bash/block/launch`. `keyup` for J/U/L/O dispatches `keyJUp/keyUUp/keyLUp/keyOUp` events that the FSM consumes for tap-vs-hold branching. Movement is normalized WSAD into a `THREE.Vector2` then applied as direct position deltas (`body.position.x += direction.x`).
- **Our equivalent:** `client/src/game/controllers/MovementController.ts` (input → world-space direction) and the keyboard wiring in `Player.tsx`.
- **Gap delta:** We currently fire skills on dedicated hotkeys (`KEY_1..KEY_5`, `CLASS_ABILITY*`). We do NOT have a sequential motion-input parser, the `block`-as-input-context gate, or a seq-clear timer.
- **Port plan (M):** Add a small `MotionInputBuffer` module next to `MovementController.ts`. State: `seq: Array<'U'|'D'|'L'|'R'|'A'|'B'>`, `lastInputTime`, 150 ms clear. Public API: `recognize(currentInput): 'hadouken' | 'shoryuken' | 'tatsumaki' | null`. Gate behind `combatMachine` `blocking` state (pressing block opens motion mode; pressing the action key while a sequence matches sends the corresponding skill event). Reuse our existing `KEY_*` events — motion inputs become an additional way to send the same events. Do NOT replace our hotkeys.

#### Pop.js — 110 LOC — radial knockback AOE
- **Source:** `Pop.js` lines 1–110.
- **What it does:** Owned by `Maria` as `this.pop = new Pop(this)`. Carries a sphere collider (`radius = 3.7`) that follows `owner.body.position` every tick but stays invisible until `pop()` is called (via the J+K+L chord). On collide with `GROUP_ENEMY`, pushes them away from the player.
- **Our equivalent:** `pop` animation key only (`useCharacterModel`); no AOE body or radial impulse.
- **Gap delta:** No radial AOE collider, no chord input that triggers it.
- **Port plan (S):** Add a `POP` event handler to `combatMachine` (the event already exists). On entry, the controller spawns a one-frame `BallCollider` (Rapier sensor) at the player root, queries overlapping enemies, applies a radial impulse via `body.applyImpulse((pos - playerPos).normalize() * popPower)`, then disposes. Wire J+K+L chord (or our chord equivalent) in the input layer.

#### SwordBlink.js — 116 LOC — sword charge VFX
- **Source:** `SwordBlink.js` lines 1–116.
- **What it does:** A `THREE.Group` with a main cross (two perpendicular planes textured by `image/SwordBlink.png`) and 12 small "shard" planes. Mounted under `Maria.swordDelegate`. `blink(level)` scales the planes outward and fades them. Used to telegraph charged level 1 / level 2.
- **Our equivalent:** none.
- **Gap delta:** No sword-charge flash VFX.
- **Port plan (S):** Add a charge-flash effect to `client/src/game/effects/SkillEffects.tsx` using existing additive sprite material. Trigger from `combatMachine` `charged1` / `charged2` entry actions.

#### SwordBlaster.js — 103 LOC — projectile fired from charged release
- **Source:** `SwordBlaster.js` lines 1–103.
- **What it does:** `Attacker` subclass; box collider sized `0.185 × 5.92 × 3.7` aligned to `owner.facing`. Three "types" with angle offsets (`-π/5, 0, +π/5`) so a burst can fire three blades. Spawned by `Maria.playChargeAttack/playChargeFist/playChargeStrike` on `chargedLevel === 2`, and unconditionally by `playHadouken`.
- **Our equivalent:** `swordBlaster`, `swordBlaster2` animation keys exist in `AnimationState`, and `SkillEffects.tsx` has VFX scaffolding, but there is no projectile body or hit detection.
- **Gap delta:** No projectile entity firing on charge release.
- **Port plan (M):** Add a `SwordBlasterProjectile` to `SpellProjectiles.tsx` (or new `MeleeProjectiles.tsx`). Rapier sensor box, 1.5 s lifetime, velocity = `facing * speed`. Hit handler routes through `CombatController.applyDamage`. Spawn from the charge release entry action in `combatMachine` (same hook as `SwordBlink.blink(2)`).

#### Hadouken.js — 141 LOC — projectile with rebound mechanic
- **Source:** `Hadouken.js` lines 1–141. (Also `PaladinHadouken.js` 154 LOC — same shape, paladin-flavored.)
- **What it does:** `Attacker` subclass. `THREE.Vector2` movement built from `owner.facing.normalize().multiplyScalar(speed)`. Internal XState machine: `move (after 2000 → dispose) → rebound (after 2000 → dispose) → dispose`. `entryRebound` flips `movement *= -1` AND swaps collision groups (`GROUP_ENEMY_ATTACKER → GROUP_ROLE_ATTACKER`, mask flips to `GROUP_ENEMY`) — the rebound attribution change means a rebounded enemy hadouken hurts enemies. Cylinder body `radius 0.8, height 0.4` — height intentionally raised "for more easily rebound".
- **Our equivalent:** `client/src/game/effects/SpellProjectiles.tsx` `FireballProjectile` (linear lifetime projectile, no rebound, no allegiance swap).
- **Gap delta:** No rebound mechanic, no allegiance swap, no per-projectile FSM.
- **Port plan (M):** Extend the projectile prop interface in `SpellProjectiles.tsx` with `rebounded?: boolean` and an `onBlock` callback. When the player's `blocking` state intersects the projectile, flip velocity, swap the `team` field, and re-arm the hit handler. This single change unlocks the most iconic Annihilate trick (block-the-Hadouken) for both player-thrown and boss-thrown projectiles.

#### Splash.js — 93 LOC — hit impact VFX
- **Source:** `Splash.js` lines 1–93.
- **What it does:** Tiny red `BoxGeometry(0.1, 0.1, 0.1)` placed at `event.body.position + event.contact.ri`, gsap-tweened upward 1.5 units while fading opacity over 0.5 s, then disposed. Spawned by `Maria.playHit` on the player and by enemies on hit.
- **Our equivalent:** `client/src/game/effects/ParticleEffects.tsx` (general-purpose), `DamageNumbers.tsx`.
- **Gap delta:** Our particle system is more general; we lack a small "blood splash" preset spawned at exact contact normal.
- **Port plan (S):** Add a `spawnHitSplash(position, normal, color)` preset to `ParticleEffects.tsx` using existing additive materials. Call from `CombatController` on damage.

---

### 3.2 Defense

#### Shield.js — 59 LOC — bone-attached shield collider
- **Source:** `Shield.js` lines 1–59.
- **What it does:** Owned by `paladin`. Box body `0.3 × 0.11 × 0.37`, group `GROUP_ENEMY_SHIELD`, `collisionResponse: false`. Per-frame copies world transform from `paladin.shieldDelegate` bone. The actual `blocked` event is NOT raised here — `GreatSword.update()` (see Weapons) sees the shield body and fires `event.body.belongTo.owner.service.send('blocked')`.
- **Our equivalent:** `block` state in `combatMachine`; `parry` logic stub in `CombatController.ts`. We have no actual shield mesh-attached collider.
- **Gap delta:** No shield-as-collider; `block` is a pure state flag.
- **Port plan (M):** Add an optional `ShieldCollider` Rapier sensor mounted to a new `shield_socket` bone in our humanoid rig (or at the off-hand position when a shield is equipped per `WeaponPrefabs.ts`). Sensor-on-attacker overlap raises `BLOCKED` event in `CombatController`, decoupling animation pose from actual deflection geometry. Reuses our existing weapon-mount IK approach.

#### Block-state input gating (cross-cutting)
- **Source:** `RoleControls.js` lines 30–60 and `Maria.js` `block` state.
- **What it does:** Holding `L` enters `block`; while in block, the **input layer stops sending `attack` events** and instead consumes inputs into the motion buffer. Releasing `L` (`keyLUp`) exits block and clears the seq. This gating is what makes "block + motion + attack" a coherent special-input gesture instead of polluting normal combat.
- **Our equivalent:** `BLOCK` / `BLOCK_UP` events in `combatMachine`.
- **Gap delta:** Block does not gate input mode; specials fire from independent hotkeys today.
- **Port plan (S):** When implementing the motion-input buffer (item 3.1 RoleControls), make it active only while `combatMachine.blocking` is true — exactly mirrors Annihilate's behavior. No state-graph changes required.

---

### 3.3 Movement

#### Wall climb (cross-cutting between `Maria.js`, `Mutant.js`, etc.)
- **Source:** `Maria.js` lines on `climb` state (~575) plus `body.addEventListener('collide', ...)` block at line ~1380 that detects `Math.abs(event.contact.ni.x) === 1 && ni.y === 0 && ni.z === 0` (i.e. ground-normal pointing along ±X with no vertical component) → `service.send('climb', { contact })`.
- **What it does:** Climb is a STATIC body lock that hugs the wall. `playClimbJump` shoots `body.velocity.x = 10 * climbContactSign` so jumping off a left wall throws you right and vice versa. `update()` applies a small `body.position.y -= dt` slow slide while climbing.
- **Our equivalent:** `climb` is in `AnimationState` (useCharacterModel) but the controller has no wall detection or wall jump logic.
- **Gap delta:** No wall-climb collision detection, no sign-flip jump impulse, no slide-down behavior.
- **Port plan (M):** In `useCharacterController.ts`, raycast horizontally on ±X (and optionally ±Z) every tick. If a hit occurs while airborne and player is pressing into the wall, send `WALL_TOUCH { axis: 'x' }` to `combatMachine` (event already exists) and swap the rigid body to `kinematicPosition` for the climb. `JUMP` from climb applies an opposite-axis horizontal impulse. Slide rate matches Annihilate's `dt` slide.

#### Air dash + dashFall
- **Source:** `Maria.js` actions `playAirDash` and `exitAirDash` (~795–820).
- **What it does:** Sets `body.velocity = facing * 11`, kills Y velocity, schedules a 500 ms `finish` to `dashFall`. `dashFall` is identical to `doubleFall` but disables further `attack` and `dash` to prevent loops.
- **Our equivalent:** Ground `dash` exists; no `airDash` state.
- **Gap delta:** No mid-air dash with Y-zero, no dashFall lockout.
- **Port plan (M):** Add `airDash` state in `combatMachine`'s airborne region, gated by `hasDoubleJumped == false`. Apply Rapier linear velocity (zero Y), 500 ms lock, then transition to a `dashFall` state that masks LMB and DASH events.

#### Air bash (ground-pound)
- **Source:** `Maria.js` actions `playAirBashStartWithCharge`, `playAirBash`, `playAirChargeBash`. Uses `body.velocity.y = -body.position.y * 3.5` so impact velocity scales with altitude.
- **What it does:** RMB while airborne charges a ground pound; uncharged taps slam down with attack hitbox; charged release adds extra knockdown tag.
- **Our equivalent:** `jumpBash` animation key; some equivalent in `combatMachine`.
- **Gap delta:** Our `jumpBash` does not modulate impact velocity by altitude or have a charge variant.
- **Port plan (S):** Augment existing `jumpBash` action with an altitude-scaled downward impulse and a `charged` flag.

---

### 3.4 Projectiles

#### Bullet.js — 120 LOC
- **Source:** `Bullet.js` lines 1–120.
- **What it does:** `Attacker` subclass with own FSM (`move → rebound → dispose`). Sphere body, normalized direction × speed. `entryRebound` flips both `movement` and collision groups so a deflected bullet hurts enemies.
- **Our equivalent:** `SpellProjectiles.tsx` projectile machinery.
- **Gap delta:** No rebound + allegiance swap.
- **Port plan (S):** Same change as Hadouken (item 3.1), but for ranged-class projectiles. Once the rebound primitive exists in `SpellProjectiles`, both Bullet and Hadouken are trivially supported.

#### Grenade.js — 197 LOC
- **Source:** `Grenade.js` lines 1–197.
- **What it does:** `Attacker` with FSM `move (after 5s → dispose) → stop (after 1500 → explode) → explode → rebound → dispose`. `entryStop` records `stopTime` for explosion countdown VFX; `entryExplode` deals AOE damage; rebound flips it back to `move` with swapped allegiance. Used by `Parrot` boss.
- **Our equivalent:** none.
- **Gap delta:** Full module missing (parabolic projectile, timed fuse, AOE explosion, rebound).
- **Port plan (M):** Add `GrenadeProjectile` to `SpellProjectiles.tsx`. Use Rapier dynamic ball with gravity for parabola; on first ground contact transition to `stop`, after 1500 ms apply radial AOE through the same overlap query as Pop.

#### Hadouken / PaladinHadouken / RobotBossHadouken
- See Hadouken in 3.1 (player) and item 3.7 RobotBossHadouken (boss variant).

---

### 3.5 Weapons

#### GreatSword.js — 119 LOC
- **Source:** `GreatSword.js` lines 1–119.
- **What it does:** `Attacker` subclass. Per-frame copies world transform from `owner.swordDelegate` bone into a `CANNON.Box(0.19, 0.19, 0.74)` sensor body. On collide, checks `owner.service.state.hasTag('canDamage')` (state-machine tag) and dispatches damage. If the contact is also a `Shield`, raises `'blocked'` on the shield's owner first; if `knockDown` tag is set on the wielder, calls `belongTo.knockDown(event)` and (for `jumpBash`) snaps the victim's vertical velocity downward.
- **Our equivalent:** `WeaponMesh.tsx` mounts the visual sword to a hand bone via the rig socket, but our hit detection lives in `CombatController.ts` which is currently animation-event/raycast based, not per-frame physics-collider based.
- **Gap delta:** We rely on animation-event hitboxes; Annihilate uses an always-on bone-attached sensor gated by an FSM tag.
- **Port plan (L):** Either (a) extend `WeaponMesh.tsx` to optionally mount a Rapier sensor box at a configurable offset from the hand bone, gated by `combatMachine.tags.canDamage`; or (b) keep our current animation-trigger model but borrow Annihilate's `canDamage` tag pattern for cleaner gating. (b) is cheaper and aligns with our XState machine; (a) is more accurate. Recommend (b) for first wave.

#### Sword.js — 44 LOC
- **Source:** `Sword.js` lines 1–44.
- **What it does:** Smaller-box version of GreatSword for enemy `Mutant`. Same delegate-attached pattern.
- **Our equivalent:** Enemy weapon visual via `WeaponMesh.tsx`.
- **Gap delta:** Same as GreatSword, scaled down.
- **Port plan:** Subsumed by GreatSword port.

#### HandKnife.js — 43 LOC
- **Source:** `HandKnife.js` lines 1–43.
- **What it does:** Hand-attached knife collider (uses `rightEquipDelegate` bone instead of `swordDelegate`). Mutant unarmed strikes use this.
- **Our equivalent:** Same.
- **Gap delta:** Same as GreatSword (per-frame collider vs animation event).
- **Port plan:** Subsumed by GreatSword port. Note the bone-name differentiation (`rightEquipDelegate`) — we already have hand-socket helpers in our rig.

#### Flail.js — 118 LOC
- **Source:** `Flail.js` lines 1–118.
- **What it does:** Builds an N-link chain (`N = world.solver.iterations`, typically 5–10) of small Cannon spheres connected by `DistanceConstraint` (or similar). Top sphere is mass-zero and parented to a delegate bone; the rest are dynamic. The end sphere has the damage box. Visual is a series of `BoxGeometry` segments rendered along the chain.
- **Our equivalent:** none.
- **Gap delta:** Full physical chain weapon missing.
- **Port plan (L):** Rapier supports `RopeJoint` and `SphericalJoint`. Build a `<Flail />` component: top point follows the wielder's hand bone via `KinematicPositionBased`; each link is a dynamic `BallCollider` joined with `RopeJoint`. End collider is the damage sensor. P2 priority — flair item, not core.

---

### 3.6 Enemies

#### Mutant.js — 678 LOC + MutantAi.js — 61 LOC
- **Source:** `Mutant.js` lines 1–678; `MutantAi.js` lines 1–61.
- **What it does (Mutant):** Player-shaped FSM with subset of moves: `idle/run/attack/attackStartWithCharge/charging/charged.../jump/hit/knockDown/dash`. Loads `mutant.gltf`, attaches a `HandKnife` to its right-hand delegate. `attackSpeed = 0.5` (slow telegraph).
- **What it does (Ai):** Trivially small — XState `canAttack ⇄ canNotAttack (4000ms)`. On `attack`, sends `'attack'` then schedules `'keyJUp'` 1600 ms later, simulating a player tap-attack so the same FSM path runs.
- **Our equivalent:** `Enemy.tsx` (component), `EnemyBehaviorTree.ts` (BT-based AI). Our enemies are profile-driven via `AIBehaviorProfile` from `TrainingIslandRegistry`.
- **Gap delta:** We use behavior trees and configurable profiles; Annihilate uses a small XState. Our system is more capable. We *don't* have a Mutant-style enemy that re-uses the player FSM verbatim.
- **Port plan (M):** Add a `mutant` enemy variant (or `bruiser`) to our existing `EnemyType` union with a BT profile that mirrors Mutant's "chase, telegraph 1.6 s, swing, 4 s cooldown". Reuse our existing animation/weapon attach. No new AI engine needed.

#### Paladin.js — 658 LOC + PaladinAi.js — 60 LOC
- **Source:** `Paladin.js` lines 1–658; `PaladinAi.js` lines 1–60.
- **What it does:** Spell-throwing humanoid. Owns a `Shield` (see Defense). Attack action spawns a `PaladinHadouken`. AI alternates melee swing and projectile throw.
- **Our equivalent:** `Enemy.tsx` covers humanoid models; no projectile-throwing AI variant.
- **Gap delta:** Need an enemy variant that throws our (to-be-built) hadouken-class projectile and carries a shield collider.
- **Port plan (M):** Once Hadouken-with-rebound and ShieldCollider land, a `paladin` enemy profile becomes a thin BT that picks "throw_hadouken" 30% / "melee" 70% and toggles `block` posture between volleys.

#### Robot.js — 289 LOC + RobotAi.js — 58 LOC
- **Source:** `Robot.js` lines 1–289; `RobotAi.js` lines 1–58.
- **What it does:** Smaller hadouken thrower; minion for the boss. AI is basically MutantAi clone with `attack → spawn Hadouken`.
- **Our equivalent:** Existing enemy framework.
- **Gap delta:** Trivial variant once Hadouken + AI profiles are in.
- **Port plan (S):** Add `robot` enemy profile.

#### Parrot.js — 307 LOC + ParrotAi.js — 69 LOC
- **Source:** `Parrot.js` lines 1–307; `ParrotAi.js` lines 1–69.
- **What it does:** Bird/sniper boss. FSM: `idle/run/attack (Bullet)/grenade (Grenade)/hit`. AI randomly picks `attack` or `grenade` per cooldown. `attackSpeed` higher than mutant; uses `Bullet` (linear) and `Grenade` (parabolic AOE) from 3.4.
- **Our equivalent:** none.
- **Gap delta:** No artillery-class boss. Requires Bullet + Grenade ports first.
- **Port plan (M):** After Bullet (S) and Grenade (M), add `parrot` enemy with BT that randomly picks projectile type and maintains range.

---

### 3.7 Bosses

#### RobotBoss.js — 441 LOC + RobotBossAi.js — 113 LOC
- **Source:** `RobotBoss.js` lines 1–441; `RobotBossAi.js` lines 1–113.
- **What it does:** Multi-phase boss. Top-level XState states: `loading / idle / run / hadouken / whirlwind / pop / weak / hit`. Idle transitions: `attack → hadouken`, `bash → whirlwind`, `weak → weak`, `dash → weak`. `hadoukenDuration = 7000`, `whirlwindDuration = 7000` — phases have hard durations. `weak` is a vulnerability shell — only state where the boss can be `hit`. `pop` plays a wind-up animation that ends with `popComplete → idle`. `isMassive: true` flag prevents player Pop from displacing the boss.
- **What it does (AI):** Timed phase machine — periodically decides whether to throw a hadouken, run a whirlwind, or pop, with cooldowns; flips into `weak` on certain triggers (in the source it's tied to dash collisions / hit count).
- **Our equivalent:** `client/src/game/components/BossSpawner.tsx` handles spawn but there is no per-boss multi-phase machine.
- **Gap delta:** No phase machine, no weakness window concept, no boss-scoped attack composer modules.
- **Port plan (L):** Add a `BossPhaseMachine` (XState) sibling to `combatMachine`, with states `idle / hadoukenPhase / whirlwindPhase / popPhase / weak / hit / dead`. Each phase transitions from a timer or hit count. Instantiated by `BossSpawner.tsx` per encounter and configurable per-boss via a `BossPhaseProfile`.

#### RobotBossHadouken.js — 149 LOC, RobotBossWhirlwind.js — 155 LOC, RobotBossPop.js — 180 LOC
- **Source:** Three boss-attack composer files.
- **What they do:** Each is an `Attacker` subclass scoped to the boss. `RobotBossHadouken` instantiates multiple `Hadouken` projectiles in a fan over the phase duration. `RobotBossWhirlwind` spawns a wide spinning AOE box that follows the boss for several seconds. `RobotBossPop` does the boss's giant Pop AOE.
- **Our equivalent:** none.
- **Gap delta:** No boss-scoped attack composers.
- **Port plan (M each):** Build them as scheduled emitters off the new BossPhaseMachine. Whirlwind = persistent sensor box rotating with the boss for `whirlwindDuration`. Pop = scaled-up version of player Pop with bigger radius and longer wind-up.

#### RobotBossWeakness.js — 94 LOC
- **Source:** `RobotBossWeakness.js` lines 1–94.
- **What it does:** Spawns when the boss enters `weak` state. Acts as a temporary collider that, when hit by the player's `airChargeBashEnd` (note `Maria.airChargeBashEnd` comment "For RobotBossWeakness attack more stable"), triggers `stopWeak → pop` on the boss. Encodes a "knock the boss out of weak state to interrupt" mechanic.
- **Our equivalent:** No weakness window concept.
- **Gap delta:** Full mechanic missing.
- **Port plan (M):** Generalize as a `WeaknessSocket` Rapier sensor that the BossPhaseMachine spawns and despawns. Hits on the socket fire a configurable boss event (`weak_hit`, `weak_break`).

---

### 3.8 Props / World

#### Box.js — 35 / Hill.js — 81 / Ground.js — 39 / TorusKnot.js — 45 / Level.js — 72
- **Source:** Five static-collider props and the level GLB loader.
- **What they do:** Each wraps a `THREE.Mesh` with a matching Cannon static body (`mass: 0`, `GROUP_SCENE`). `Hill.js` slopes use `Heightfield`-ish shapes; `Level.js` loads a level GLB and uses `three-to-cannon` to derive `ConvexPolyhedron`/`Mesh` shapes; `TorusKnot.js` uses `geometryToShape` (cannon-es-utils).
- **Our equivalent:** `client/src/game/components/Terrain.tsx` + `getTerrainHeight`, plus our Rapier scene props.
- **Gap delta:** Our terrain is heightmap-based. We don't generally need to port these — they're scene-test props.
- **Port plan (S):** Use as inspiration for any "physics test arena" debug screen. Skip otherwise.

#### FloatingBox.js — 56 LOC
- **Source:** `FloatingBox.js` lines 1–56.
- **What it does:** Kinematic body with sin-wave Y motion (`speed = 3.7`, `timeBias`). Floats up and down on a fixed period.
- **Our equivalent:** none.
- **Gap delta:** No moving platform primitive.
- **Port plan (S):** Add a `FloatingPlatform` prop to props folder using Rapier `KinematicPositionBased` and a sin in `useFrame`.

#### TranslatedBox.js — 61 LOC
- **Source:** `TranslatedBox.js` lines 1–61.
- **What it does:** Demonstrates a Cannon trick: `bufferGeometry.translate(width/2, 0, 0)` AND `body.addShape(shape, new CANNON.Vec3(width/2, 0, 0))` — i.e. shape pivot offset. Used to build off-pivot rotating obstacles.
- **Our equivalent:** Rapier compound colliders cover this directly via `<RigidBody><BoxCollider position=[w/2,0,0]/></RigidBody>`.
- **Gap delta:** none — already supported by Rapier.
- **Port plan (S):** Document the Rapier equivalent in our props readme. No new code needed.

#### Catapult.js — 89 LOC
- **Source:** `Catapult.js` lines 1–89.
- **What it does:** Kinematic box that periodically (`setInterval(launch, 5000)`) sets a strong `angularVelocity` for a moment, then gsap-tweens back to rest pose. Emissive ramp telegraphs the next launch. Anything sitting on top is flung.
- **Our equivalent:** none.
- **Gap delta:** No timed-launch trap prop.
- **Port plan (M):** Add `<Catapult />` prop component. Replace `setInterval` with a hook-managed timer; replace gsap tween with a manual lerp; use Rapier `setAngularVelocity` and `setRotation`.

#### JumpPoint.js — 59 LOC
- **Source:** `JumpPoint.js` lines 1–59.
- **What it does:** Sensor sphere; on `beginContact` sends `'jumpPoint'` event to the contacting character, who transitions to `airIdle` (effectively zero-gravity hover). Visual is a wireframe icosahedron that rotates.
- **Our equivalent:** none.
- **Gap delta:** No "anti-grav lift" trigger volume.
- **Port plan (S):** Add `<JumpPoint />` sensor; on overlap with player, dispatch a new `JUMP_POINT` event to `combatMachine` (wire into the airborne region).

#### Teleporter.js — 42 LOC
- **Source:** `Teleporter.js` lines 1–42.
- **What it does:** Sensor box; on contact with anything `isCharacter`, snaps `body.position` to `this.dest`. Visual is wireframe rotating box.
- **Our equivalent:** none.
- **Gap delta:** No teleporter volume.
- **Port plan (S):** Add `<Teleporter dest={...} />` prop using Rapier sensor + `setTranslation`.

---

### 3.9 World FX

#### BirdFlock.js — 563 LOC
- **Source:** `BirdFlock.js` lines 1–563.
- **What it does:** GPGPU boids implementation using `GPUComputationRenderer` with two textures (position, velocity) updated each frame by `fragmentShaderPosition` and `fragmentShaderVelocity`. The velocity shader implements separation/alignment/cohesion in GLSL with a `predator` uniform. Birds are rendered as procedural geometry with phase-driven wing flap. Pure ambient fauna — no gameplay effect.
- **Our equivalent:** none.
- **Gap delta:** Full GPGPU flocking system missing.
- **Port plan (L):** Port to `client/src/game/effects/AmbientFlock.tsx` using `GPUComputationRenderer` (still in three/examples). Reuse the shaders verbatim. Wire to a `useAmbient()` toggle keyed off island/world type. Pure aesthetic; P2.

#### Cloud.js — 206 LOC
- **Source:** `Cloud.js` lines 1–206.
- **What it does:** Builds a 128³ Perlin-noise `DataTexture3D` and raymarches it in the fragment shader (using `sampler3D`, `threshold`, `range`, `opacity` uniforms). Single volumetric cloud volume.
- **Our equivalent:** none.
- **Gap delta:** No volumetric clouds.
- **Port plan (M):** Port as `<VolumetricCloud />` for boss-arena ambience. Camera-independent ray entry, so safe per house rule #1.

---

### 3.10 Engine

#### Attacker.js — 80 LOC
- **Source:** `Attacker.js` lines 1–80.
- **What it does:** Base class for every damaging body in the game. Creates `num` Cannon bodies (default 1) all `mass: 0, type: DYNAMIC, collisionResponse: false` so they pass through targets while still firing collide events. Tracks `body.collidings[]` so subclasses can detect first-collide vs continued contact (avoiding multi-hit per swing). Forwards `collide` / `endContact` to subclass virtual methods.
- **Our equivalent:** `client/src/game/controllers/CombatController.ts` performs hit detection but our pattern is distance-based (raycast / sphere overlap during the active frames of an attack), not always-on sensor with collidings tracking.
- **Gap delta:** Annihilate's `canDamage` FSM tag + always-on sensor pattern is cleaner than our per-attack ad-hoc shapes when the weapon is bone-attached. But our pattern is simpler when the attack is a one-shot AOE.
- **Port plan (M):** Optional; introduce a `BoneSensorAttacker` helper in `CombatController.ts` for the weapon-on-bone case (Sword/GreatSword/HandKnife port). Keep existing per-skill detection for AOE/projectile cases.

#### Ai.js — 136 LOC
- **Source:** `Ai.js` lines 1–136.
- **What it does:** Base AI: trigger-sphere detector (`character.detectorRadius`), `setTarget` on enter/leave, per-tick `update` that faces the target, runs toward it until within `distance`, then sends `attack`. Movement is direct `body.position` mutation.
- **Our equivalent:** `client/src/game/systems/EnemyBehaviorTree.ts` uses a structured BT model with `EnemyBlackboard` (anchor, patrol, ambush, emote, behavior profile). Strictly more capable.
- **Gap delta:** None worth porting — our system is the better one.
- **Port plan: Skip.**

#### global.js — 32 LOC — collision groups
- **Source:** `global.js` lines 1–32.
- **What it does:** Defines bitmask constants `GROUP_SCENE / GROUP_ROLE / GROUP_ENEMY / GROUP_ROLE_ATTACKER / GROUP_ENEMY_ATTACKER / GROUP_ENEMY_SHIELD / GROUP_TRIGGER`. These appear throughout every file as `body.collisionFilterGroup` / `collisionFilterMask`.
- **Our equivalent:** Implicit in our Rapier setup; we don't have a centralized membership table.
- **Gap delta:** We may want to formalize.
- **Port plan (S):** Add `client/src/game/systems/CollisionGroups.ts` exporting Rapier interaction-group bitmasks for `PLAYER`, `ENEMY`, `PLAYER_ATTACKER`, `ENEMY_ATTACKER`, `ENEMY_SHIELD`, `SCENE`, `TRIGGER`. Adopt as Rapier collider props are touched. Useful prerequisite for the rebound-projectile allegiance swap.

#### index.js — 676 LOC — boot
- **Source:** `index.js` lines 1–676.
- **What it does:** Three.js renderer setup, scene/world singletons (`window.scene`, `window.world`), GLTF asset preloading, `OrbitControls` follow camera, the `requestAnimationFrame` loop that calls `world.step()` then iterates `updates[].update(dt, time)`. Spawns sample enemies, the boss arena, the bird flock, etc. Includes `gsap` camera tweens.
- **Our equivalent:** R3F root + workflow-driven `Start Game`.
- **Gap delta:** none worth porting; everything is either house-rule-skipped (camera) or already provided by R3F (scene/world).
- **Port plan: Skip** for the boot loop. Camera tweens: **Skip** per house rule #1.

#### `setMassZero` / `restoreMass` pattern
- **Source:** `Maria.js` actions throughout (`airBashStartWithCharge`, `airChargeBash`, `airDash`).
- **What it does:** Setting `body.mass = 0` while in air-attack states freezes gravity on the actor for the duration of the move; `restoreMass` snaps it back on exit.
- **Our equivalent:** none — we let gravity run continuously.
- **Port plan (S):** In `useCharacterController.ts`, expose `setGravityScale(0|1)` on the player rigid body. Have `combatMachine` actions call it on entry/exit of `airBash*`, `airDash`, and `launch*` states.

---

## 4. First-Wave Recommendations

These are the items I would land first to unlock the Annihilate-style feel without overreaching. They are ordered by ratio of gameplay impact to implementation cost.

1. **Charge-attack subgraph + sword-blink VFX (item 1 + 8).** Single coherent feature: hold-LMB → 0.5 s charge1 (sword glow) → 0.5 s charge2 (color shift + blink). Release at any rung commits to either normal `attack` or `chargeAttack`. Subsequent LMBs chain into `chargeFist → chargeStrike`. Keep the 1.5 s window already in `comboTimer`. Adds the central player rhythm cheaply (M + S).

2. **Motion-input parser gated by block (items 2 + 16).** Add `MotionInputBuffer` next to `MovementController.ts`, active only while `combatMachine.blocking` is true. SDJ → Hadouken event, DSDJ → Shoryuken event, SAK → Tatsumaki event. Reuses our existing skill events — no new state graph. Unlocks the iconic SF-style motion vocabulary on top of our hotkey skills (M).

3. **Projectile rebound + allegiance swap (items 10 + 11).** Extend the projectile interface in `SpellProjectiles.tsx` with `rebounded?: boolean` and a `team` field, swap on block. Once this primitive exists, both Hadouken (P0) and Bullet (P1) get rebound for free, and the eventual paladin/parrot enemies inherit a "block-the-shot" loop. Highest mechanic-per-LOC return in the audit (M).

4. **Whirlwind hold-vs-tap branch + Pop AOE chord (items 3 + 4).** RMB tap = `bashStartNotWhirlwind` quick attack; RMB hold = enter `whirlwind` until release. J+K+L chord (or our chord equivalent) triggers the pop AOE — spawn a one-frame `BallCollider`, query overlaps, apply radial impulse. Both are tiny code, both are highly visible (S + S).

5. **Launcher chain `launchStart → launchWithJump → launch` (item 5).** O (or our LAUNCH key) starts the lifter; tap-O cancels into a short hop, hold-O carries you up. Pairs well with the `airAttack → airFist → airStrike` aerial combo we already have animation slots for. Combined with `setGravityScale(0)` from item 40, this gives us proper juggling (M).

6. **Boss phase machine + first weakness window (items 23 + 24).** Add `BossPhaseMachine` + `WeaknessSocket` so `BossSpawner.tsx` can load encounter profiles with `hadoukenPhase / whirlwindPhase / popPhase / weak / hit` timing. Even without porting `RobotBossHadouken/Whirlwind/Pop` composers, just the machine + weakness window enables design experiments (L; do this third in the wave).

7. **Bone-attached weapon hitboxes via `canDamage` tag (items 17 + 34).** Refactor weapon damage to query `combatMachine.tags.canDamage` while a weapon-mounted Rapier sensor follows the hand bone. This cleanly replaces our scattered animation-event hit logic for melee classes and is a prerequisite for shield-collider deflect (item 15) and boss greatsword/sword Annihilate-style hits (M).

8. **Wall climb on ±X raycast + climb-jump impulse (item 6).** Already have the `climb` animation and `WALL_TOUCH` event. Add a horizontal raycast in `useCharacterController`, transition into climb on contact, jump out with opposite-axis impulse. Opens up vertical level design without any new art (M).

---

## 5. Out-of-Scope Items (Skip)

For traceability — these were intentionally not assigned port plans:

- **Camera (orbit/follow/tweens) in `index.js`.** House rule #1.
- **`OrbitControls` setup.** Subset of above.
- **`Ai.js` chase/face primitive.** We have a strictly more capable BT system (`EnemyBehaviorTree.ts`).
- **`RoleControls.js` keyboard event plumbing.** We have `MovementController.ts`. Only the **motion-input parser** logic is being lifted, not the input layer itself.
- **`cannon-es` / `three-to-cannon` integration.** House rule #3 — Rapier only.
- **Pseudo-shadow shader fragments** in Mutant/Paladin (commented out anyway). We use real shadow maps.
- **Annihilate boot loop / asset loader** in `index.js`. R3F + our existing asset pipeline.
- **GLB asset paths** like `./model/maria/all.gltf`, `./model/level/level.glb`. Mechanic ports use our own assets.

---

## 6. Source File Inventory (45 files, 8732 LOC)

For quick reference, all source files in `/tmp/scratch/annihilatetrainer/src/`:

| File | LOC | Group | Covered in |
|---|---:|---|---|
| Maria.js | 1503 | Player | §3.1 |
| Mutant.js | 678 | Enemies | §3.6 |
| index.js | 676 | Engine | §3.10 |
| Paladin.js | 658 | Enemies | §3.6 |
| BirdFlock.js | 563 | World FX | §3.9 |
| RobotBoss.js | 441 | Bosses | §3.7 |
| Parrot.js | 307 | Enemies | §3.6 |
| Robot.js | 289 | Enemies | §3.6 |
| RoleControls.js | 228 | Engine | §3.1 (parser portion) |
| Cloud.js | 206 | World FX | §3.9 |
| Grenade.js | 197 | Projectiles | §3.4 |
| RobotBossPop.js | 180 | Bosses | §3.7 |
| RobotBossWhirlwind.js | 155 | Bosses | §3.7 |
| PaladinHadouken.js | 154 | Projectiles | §3.4 (Hadouken) |
| RobotBossHadouken.js | 149 | Bosses | §3.7 |
| Hadouken.js | 141 | Projectiles | §3.4 |
| Ai.js | 136 | Engine | §3.10 |
| Bullet.js | 120 | Projectiles | §3.4 |
| GreatSword.js | 119 | Weapons | §3.5 |
| Flail.js | 118 | Weapons | §3.5 |
| SwordBlink.js | 116 | Player FX | §3.1 |
| RobotBossAi.js | 113 | Bosses | §3.7 |
| Pop.js | 110 | Player | §3.1 |
| SwordBlaster.js | 103 | Player | §3.1 |
| RobotBossWeakness.js | 94 | Bosses | §3.7 |
| Splash.js | 93 | World FX | §3.1 |
| Catapult.js | 89 | Props | §3.8 |
| Hill.js | 81 | Props | §3.8 |
| Attacker.js | 80 | Engine | §3.10 |
| Level.js | 72 | World | §3.8 |
| ParrotAi.js | 69 | Enemies | §3.6 |
| MutantAi.js | 61 | Enemies | §3.6 |
| TranslatedBox.js | 61 | Props | §3.8 |
| PaladinAi.js | 60 | Enemies | §3.6 |
| JumpPoint.js | 59 | Props | §3.8 |
| Shield.js | 59 | Defense | §3.2 |
| RobotAi.js | 58 | Enemies | §3.6 |
| FloatingBox.js | 56 | Props | §3.8 |
| TorusKnot.js | 45 | Props | §3.8 |
| Sword.js | 44 | Weapons | §3.5 |
| HandKnife.js | 43 | Weapons | §3.5 |
| Teleporter.js | 42 | Props | §3.8 |
| Ground.js | 39 | Props | §3.8 |
| Box.js | 35 | Props | §3.8 |
| global.js | 32 | Engine | §3.10 |

---

## 7. README Key-Map Crosswalk

The reference repo's `README.md` (lines 54–96) documents the canonical input grammar. This appendix maps every README binding directly to (a) the `RoleControls.js` line that consumes it, (b) the `Maria.js` state(s) it drives, and (c) where we'd hook it on our side. This makes README compliance for any future port unambiguous.

| README binding | README line | Annihilate handler | Annihilate target state(s) | Our hook | Audit ref |
|---|---:|---|---|---|---|
| `J = Attack` | 58 | `RoleControls.js` ~120 (`tickKey.KeyJ` → `service.send('attack')`) | `attackStartWithCharge` → `attack` → `fist` → `strike` (3-hit chain) | `combatMachine` `LMB` event → `attack/attack2/combo2/combo3` | §3.1 RoleControls |
| `J + J + J = Combo` | 60 | same, repeated tap within frame window | `attack.prepareNext → fistStart → fist.prepareNext → strikeStart → strike` | `combatMachine` combo chain (already wired via `comboCount`) | §3.1 Maria |
| `J hold charge1 + J + J = Fast Combo` | 62 | `keyJUp` event released after `charged1` enters | `chargeAttack → chargeFistStart → chargeFist → chargeStrikeStart → chargeStrike` | **MISSING** — needs charge subgraph (first wave #1) | §3.1 Maria; §4 #1 |
| `J hold charge2 + J + J = Sword Blaster` | 64 | `keyJUp` after `charged2` → `playChargeAttack` spawns `new SwordBlaster(this, 1/2/3)` | charged combo + projectile burst | **MISSING** — needs charge level 2 + SwordBlaster projectile | §3.1 SwordBlaster; §4 #1 |
| `J & K & L = Pop` | 66 | `RoleControls.js` 110–113 (`tickKey.KeyJ && KeyK && KeyL` → `role.pop?.pop()`) | `Pop.js` AOE sphere | **MISSING** — needs `POP` AOE collider; chord wiring (first wave #4) | §3.1 Pop; §4 #4 |
| `K = Jump` | 68 | `RoleControls.js` ~128 (`tickKey.KeyK` → `service.send('jump')`) | `jump` → `fall` | `combatMachine` `JUMP` event (already wired) | §3.1 RoleControls |
| `K + K = Double Jump` | 70 | same — `jump` event from `jump`/`fall` state | `doubleJump` → `doubleFall` | `combatMachine` `JUMP` while `isAirborne && !hasDoubleJumped` | §3.1 Maria |
| `K + U = Jump Bash Attack` | 72 | `tickKey.KeyU` while airborne → `service.send('bash')` | `airBashStart → airBash → airBashEnd` | `combatMachine` `jumpBash` (animation slot exists; needs altitude-scaled impulse) | §3.3 Air bash |
| `K + U hold = Earthquake` | 74 | `keyUUp` not received → falls through to `airChargeBash` (sustained `airBashStartWithCharge`) | `airChargeBash → airChargeBashEnd` | `combatMachine` `earthquake` slot exists; needs charge-hold gating | §3.3 Air bash |
| `L hold = Block` | 76 | `RoleControls.js` ~135 (`tickKey.KeyL` → `service.send('block')`); `keyLUp` exits | `block` | `combatMachine` `BLOCK` / `BLOCK_UP` (already wired) | §3.2 Block-state input gating |
| `L hold + S + D + J = Hadouken` | 78 | `RoleControls.js` 38–44 (seqKey check inside `block`) | `hadouken` → `playHadouken` (spawns SwordBlaster type 3) | **MISSING** — needs motion-input parser (first wave #2) + SwordBlaster | §3.1 RoleControls; §4 #2 |
| `L hold + D + S + D + J = Shoryuken` | 80 | `RoleControls.js` 41–44 | `shoryuken` → `playShoryuken` (gsap lift to `liftDistance`) | **MISSING** — motion parser + lifter; animation slot exists | §3.1 RoleControls; §4 #2,#5 |
| `L hold + S + A + K = Tatsumaki Senpukyaku` | 82 | `RoleControls.js` 45–49 (`KeyK` after `S→A` seq) → `service.send('ajejebloken')` | `ajejebloken` (whirlwind anim + 2 s forward drift, gsap rotation) | **MISSING** — motion parser; we have `tatsumaki` animation slot | §3.1 Maria; §4 #2 |
| `U hold = Whirlwind` | 84 | `tickKey.KeyU` → `bashStart`, `keyUUp` NOT received before `finish` → `whirlwind` | `bashStart → whirlwind`; key-up exits to `attack` | **MISSING** — needs hold-vs-tap branch (first wave #4) | §3.1 Maria; §4 #4 |
| `I = Dash` | 86 | `tickKey.KeyI` → `service.send('dash')` | `dash` (after 300 ms → `idle`) | `combatMachine` `DASH` (already wired) | §3.1 RoleControls |
| `I + J = Dash Attack` | 88 | `attack` event during `dash` | `dashAttack` | `combatMachine` `dashAttack` (already wired) | §3.1 Maria |
| `O = Launch` | 90 | `tickKey.KeyO` → `service.send('launch')` | `launchStart → launch` (key-up) | `combatMachine` `launch` slot exists; needs lifter chain (first wave #5) | §3.1 Maria; §4 #5 |
| `O hold = Launch with Jump` | 92 | `keyOUp` NOT received before `finish` → `launchWithJump` | `launchStart → launchWithJump` | **MISSING** — hold branch + lift impulse (first wave #5) | §3.1 Maria; §4 #5 |
| `touch wall = climb (±X only)` | 94 | `Maria.js` collide listener filters `Math.abs(ni.x) === 1 && ni.y === 0 && ni.z === 0` → `service.send('climb', { contact })` | `climb` (STATIC body, hugs wall) | **MISSING** — needs raycast-based wall detect (first wave #8) | §3.3 Wall climb; §4 #8 |
| `when climb J = fall` | 96 | `attack` event from `climb` state → `airIdle` (note: README labels it "fall" but FSM target is `airIdle`) | climb cancel | Tied to wall-climb port (first wave #8) | §3.3 Wall climb |

**Compliance summary:** Of the 19 README bindings, 9 are already implemented in our system (basic attacks, combos, jump/double-jump, dash/dashAttack, block), 1 (Earthquake) has the animation slot but needs the charge-hold trigger, and 9 are MISSING and have first-wave port plans assigned in §4 (#1, #2, #4, #5, #8). No README binding is intentionally Skipped.

---

*End of audit. No code changes were made by this document.*
