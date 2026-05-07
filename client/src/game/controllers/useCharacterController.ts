import { useEffect, useMemo, useRef, useCallback } from "react";
import * as THREE from "three";
import { createActor, type StateValue } from "xstate";
import { useCharacterModel, type AnimationState } from "../hooks/useCharacterModel";
import { AnimationLibrary } from "../anim/AnimationLibrary";
import { BoneMask } from "../anim/BoneMask";
import { CharacterAnimator, type LocomotionConfig, EASE_OUT_CUBIC, EASE_SMOOTH } from "../anim/CharacterAnimator";
import { computeSkinnedBounds } from "../systems/BoundsUtils";
import {
  characterMachine,
  type CharacterActor,
  type CharacterEvent,
  getLocomotionState,
  getCombatState,
  getOverrideState,
  getClimbingState,
  type ClimbingState,
} from "./characterMachine";
import type { WeaponType } from "@/lib/stores/useGame";

/** Posture leaf accessor — mirrors getCombatState/getOverrideState. */
function getPostureState(value: StateValue): "standing" | "crouching" | "prone" {
  if (typeof value !== "object") return "standing";
  const p = value.posture;
  if (p === undefined) return "standing";
  if (typeof p === "string") return p as "standing" | "crouching" | "prone";
  const k = Object.keys(p)[0];
  return (k as "standing" | "crouching" | "prone" | undefined) ?? "standing";
}

/** Map a combat-region leaf to its layered animation slot. */
const COMBAT_TO_ANIM: Partial<Record<string, AnimationState>> = {
  light1: "attack",
  light2: "combo2",
  combo: "combo3",
  heavy: "heavyAttack",
  blocking: "block",
  ability: "hadouken",
};

export interface UseCharacterControllerOptions {
  modelPath: string;
  targetHeight?: number;
  tintColor?: string | null;
  /**
   * Optional per-material color overrides keyed by material name. Forwarded
   * verbatim to useCharacterModel so the customization screen's color tinting
   * still applies under the new controller pipeline.
   */
  materialColorOverrides?: Record<string, string> | null;
  weaponType?: WeaponType;
  /**
   * Additional animation pack IDs to load on top of the weapon-derived packs.
   * Used to opt a character into a domain-specific clip set (e.g. `["farming"]`
   * for an NPC farmer or for a player wielding a hoe). Forwarded verbatim to
   * useCharacterModel. Pass a useMemo'd array (stable reference) to avoid
   * triggering pack re-loads each render.
   */
  extraPacks?: string[];
  /** Override the default speed thresholds for the locomotion blend tree. */
  locomotion?: LocomotionConfig;
  /** Disable the upper-body combat layer (e.g. for NPCs without combat clips). */
  disableCombatLayer?: boolean;
}

/**
 * The new high-level character pipeline. Composes:
 *   1. useCharacterModel(externallyDriven=true) for asset/clip loading,
 *      retargeting, weapon-pack injection, hand-bone discovery, etc.
 *   2. AnimationLibrary as a read-only view over the live actions map.
 *   3. BoneMask built from the cloned skeleton.
 *   4. CharacterAnimator orchestrating BlendTree1D (locomotion) + bone-masked
 *      additive layered playback (combat) + full-body overrides (jump/hit).
 *   5. characterMachine as the parallel-region state-of-truth.
 *
 * Drop-in API compatible with useCharacterModel's public surface:
 *   { scene, playAnimation, update, setMovementSpeed, transitionLock,
 *     rightHand, leftHand }
 *
 * Plus extras:
 *   - actor: the XState actor (parallel regions)
 *   - animator: the CharacterAnimator instance
 *   - sendEvent: actor.send shorthand
 *   - playLayered(state): explicitly target the upper-body combat layer
 *   - triggerOverride(state): explicitly target the full-body override slot
 */
export function useCharacterController(opts: UseCharacterControllerOptions) {
  const model = useCharacterModel({
    modelPath: opts.modelPath,
    targetHeight: opts.targetHeight,
    tintColor: opts.tintColor,
    materialColorOverrides: opts.materialColorOverrides,
    weaponType: opts.weaponType,
    extraPacks: opts.extraPacks,
    externallyDriven: true,
  });

  const libraryRef = useRef<AnimationLibrary | null>(null);
  const maskRef = useRef<BoneMask | null>(null);
  const animatorRef = useRef<CharacterAnimator | null>(null);
  const actorRef = useRef<CharacterActor | null>(null);

  // (Re)build library + mask + animator + actor whenever the scene/mixer change.
  // (model.scene is a new clone per modelPath; keying on it ensures clean wiring.)
  useEffect(() => {
    if (!model.scene || !model.mixer) return;

    const library = new AnimationLibrary(model.actions);
    const mask = new BoneMask(model.scene);
    const animator = new CharacterAnimator(model.scene, model.mixer, library, mask, opts.locomotion ?? {});

    libraryRef.current = library;
    maskRef.current = mask;
    animatorRef.current = animator;

    const actor = createActor(characterMachine);
    actor.start();
    actorRef.current = actor;

    // Drive the animator off the parallel state machine. We track the
    // previous leaf for each region and only act on transitions, so feeding
    // SET_SPEED every frame doesn't re-trigger animation calls.
    let prevCombat: string | null = null;
    let prevPosture: string | null = null;
    let prevAirborne: string | null = null;
    let prevOverride: string | null = null;
    let prevClimbing: ClimbingState = null;

    const sub = actor.subscribe((snap) => {
      const value = snap.value;
      if (typeof value !== "object") return;
      const a = animatorRef.current;
      if (!a) return;
      const disableCombat = !!opts.disableCombatLayer;

      // Combat region → upper-body layered slot.
      const combat = getCombatState(value);
      if (combat !== prevCombat) {
        const animName = COMBAT_TO_ANIM[combat];
        if (combat === "idle") {
          // Always release the upper-body slot when combat returns to idle,
          // including when the previous combat state was a sustained block.
          a.stopLayered(0.18);
        } else if (animName) {
          if (disableCombat) {
            // NPCs without proper combat clips: route everything through the
            // full-body override slot so the swing is at least visible.
            a.playOverride(animName);
          } else if (combat === "blocking") {
            // Blocks are sustained — slow smooth ramp reads as "raise guard".
            a.playLayered(animName, { group: "upperBody", loop: true, fadeIn: 0.18, ease: EASE_SMOOTH });
          } else {
            // Attacks: snappier OUT_CUBIC entry so the swing pops on the
            // anticipation frame instead of cross-fading mushily out of
            // the previous swing. Charged releases (chargeAttack*, etc)
            // reuse the same fast entry so the impact reads punchy.
            a.playLayered(animName, { group: "upperBody", fadeIn: 0.08, ease: EASE_OUT_CUBIC });
          }
        }
        prevCombat = combat;
      }

      // Posture region → loop the sneak clip while crouching, releasing the
      // override (and re-enabling the locomotion blend tree) on standing.
      const posture = getPostureState(value);
      if (posture !== prevPosture) {
        if (posture === "crouching" || posture === "prone") {
          a.playOverride("sneak", { loop: true });
        } else {
          // standing
          if (a.currentOverrideState === "sneak") a.stopOverride(0.2);
        }
        prevPosture = posture;
      }

      // Climbing sub-region → drive the climb_* full-body overrides.
      // Animations chosen per leaf:
      //   mounting → climb_start (one-shot, fires OVERRIDE_DONE → idle)
      //   idle     → climb_idle (looped — hanging on the wall)
      //   vertical → climb (looped — going up; climb_down auto-mirrors)
      //   shimmy   → climb_shimmy (looped — sideways on the wall)
      //   topout   → climb_topout (one-shot — pull up onto platform)
      //   dropoff  → ledge_grab as a brief release frame before falling
      //   null     → released the climb override slot if it was a climb_*
      const climbing = getClimbingState(value);
      if (climbing !== prevClimbing) {
        if (climbing === "mounting") a.playOverride("climb_start");
        else if (climbing === "idle") a.playOverride("climb_idle", { loop: true });
        else if (climbing === "vertical") {
          // Pick climb vs climb_down based on signed vertical context the
          // climb controller stamped on the actor.
          const vy = snap.context.climbVertical;
          if (vy < 0) a.playOverride("climb_down", { loop: true });
          else a.playOverride("climb", { loop: true });
        } else if (climbing === "shimmy") a.playOverride("climb_shimmy", { loop: true });
        else if (climbing === "topout") a.playOverride("climb_topout");
        else if (climbing === "dropoff") a.playOverride("ledge_grab");
        else if (climbing === null) {
          const cur = a.currentOverrideState;
          if (cur && cur.startsWith("climb")) a.stopOverride(0.18);
          if (cur === "ledge_grab") a.stopOverride(0.18);
        }
        prevClimbing = climbing;
      }

      // Airborne sub-region → drive jump/fall/land overrides.
      const airborne = ((): string | null => {
        const loco = (value as Record<string, StateValue>).locomotion;
        if (typeof loco !== "object") return null;
        const air = (loco as Record<string, StateValue>).airborne;
        if (air === undefined) return null;
        if (typeof air === "string") return air;
        return Object.keys(air)[0] ?? null;
      })();
      if (airborne !== prevAirborne) {
        if (airborne === "jumping") a.playOverride("jump");
        else if (airborne === "falling") a.playOverride("fall", { loop: true });
        else if (airborne === "landing") a.playOverride("land");
        else if (airborne === null) {
          // Returned to grounded — release any remaining airborne override.
          const cur = a.currentOverrideState;
          if (cur === "jump" || cur === "fall" || cur === "land") {
            a.stopOverride(0.18);
          }
        }
        prevAirborne = airborne;
      }

      // Overrides region → hit/death/pickup/victory full-body or layered.
      const override = getOverrideState(value);
      if (override !== prevOverride) {
        if (override === "hit") a.playLayered("hit", { group: "upperBody" });
        else if (override === "death") a.playOverride("death", { fadeIn: 0.35 });
        else if (override === "pickup") a.playLayered("pickup", { group: "upperBody" });
        else if (override === "victory") a.playLayered("victory", { group: "upperBody" });
        else if (override === "none") {
          const curOver = a.currentOverrideState;
          if (curOver === "death") {
            // Death stays clamped; only revive clears it.
            a.stopOverride(0.4);
          }
        }
        prevOverride = override;
      }
    });

    return () => {
      sub.unsubscribe();
      actor.stop();
      actorRef.current = null;
      animator.stopLayered(0);
      animator.stopOverride(0);
      animatorRef.current = null;
      libraryRef.current = null;
      maskRef.current = null;
    };
    // model.scene + model.mixer are stable for a given modelPath via useMemo
    // inside useCharacterModel; we intentionally key the rebuild on those.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.scene, model.mixer]);

  // Try to wire up the locomotion blend tree once clips bind. The actions map
  // populates inside an effect in useCharacterModel, so we defer one tick.
  useEffect(() => {
    if (!animatorRef.current) return;
    let cancelled = false;
    let tries = 0;
    const tick = () => {
      if (cancelled) return;
      const animator = animatorRef.current;
      if (!animator) return;
      animator.rebuildLocomotion();
      if (!animator.hasBlendTree && tries < 30) {
        tries++;
        setTimeout(tick, 100);
      }
    };
    tick();
    return () => { cancelled = true; };
  }, [model.scene]);

  // When weapon pack injection adds new actions (e.g. better walk/run clips),
  // re-wire the blend tree to use them.
  useEffect(() => {
    const id = setInterval(() => {
      animatorRef.current?.rebuildLocomotion();
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Measure the actual normalized character bounds (post `normalizeCharacterHeight`
  // inside useCharacterModel). This is what physics/raycast code MUST use to
  // size colliders + eye-height — never trust caller-supplied scale metadata,
  // which historically drifts away from the real on-screen mesh size,
  // especially for skinned models that come in at huge native scales (the
  // "100x too large from inception" bug). Re-measured whenever the scene
  // identity changes (model swap, color override re-clone, etc.).
  const bounds = useMemo(() => {
    if (!model.scene) return null;
    model.scene.updateMatrixWorld(true);
    const box = computeSkinnedBounds(model.scene);
    const size = box.getSize(new THREE.Vector3());
    if (!isFinite(size.x) || !isFinite(size.y) || !isFinite(size.z)) return null;
    if (size.y < 0.001) return null;
    return {
      height: size.y,
      // XZ-plane half-extent — best fit for a vertical "feet sphere"
      // collider that needs to envelope the character's footprint.
      radiusXZ: Math.max(size.x, size.z) * 0.5,
    };
  }, [model.scene]);

  const setMovementSpeed = useCallback((speed: number) => {
    animatorRef.current?.setSpeed(speed);
    actorRef.current?.send({ type: "SET_SPEED", value: speed });
  }, []);

  const setGrounded = useCallback((grounded: boolean) => {
    actorRef.current?.send({ type: "SET_GROUNDED", value: grounded });
  }, []);

  const sendEvent = useCallback((event: CharacterEvent) => {
    actorRef.current?.send(event);
  }, []);

  /**
   * Back-compat playAnimation. Routes states to the right slot:
   *  - locomotion → blend tree
   *  - upper-body combat → layered (unless disableCombatLayer)
   *  - everything else → full-body override
   */
  const playAnimation = useCallback((state: AnimationState) => {
    const animator = animatorRef.current;
    if (!animator) return;

    if (opts.disableCombatLayer && UPPER_BODY_COMBAT.has(state)) {
      // Force full-body override path so NPCs without proper combat clips
      // still get a visible swing.
      animator.playOverride(state);
      // Mirror to machine for completeness.
      const ev = STATE_TO_EVENT[state];
      if (ev) actorRef.current?.send(ev);
      return;
    }

    animator.play(state);

    // Mirror state into the parallel machine.
    const ev = STATE_TO_EVENT[state];
    if (ev) actorRef.current?.send(ev);
  }, [opts.disableCombatLayer]);

  const playLayered = useCallback((state: AnimationState) => {
    animatorRef.current?.playLayered(state, { group: "upperBody" });
  }, []);

  const triggerOverride = useCallback((state: AnimationState, looped = false) => {
    animatorRef.current?.playOverride(state, { loop: looped });
  }, []);

  // Track previous animator slots so we can emit completion events back into
  // the parallel state machine on the frame a layered/override clip ends.
  // Without this the combat / overrides regions stay stuck in attacking /
  // hit / pickup forever once their animation has already finished.
  const prevLayerRef = useRef<AnimationState | null>(null);
  const prevOverrideRef = useRef<AnimationState | null>(null);

  const update = useCallback((delta: number) => {
    model.update(delta);
    const animator = animatorRef.current;
    if (!animator) return;
    animator.update(delta);

    const actor = actorRef.current;
    if (!actor) return;

    // Layered slot expired → end the current upper-body action.
    const layer = animator.currentLayerState;
    const prevLayer = prevLayerRef.current;
    if (prevLayer && !layer) {
      if (prevLayer === "hit") actor.send({ type: "HIT_DONE" });
      else if (prevLayer === "block") actor.send({ type: "BLOCK_END" });
      else actor.send({ type: "ATTACK_DONE" });
    }
    prevLayerRef.current = layer;

    // Override slot expired → end the current full-body override (jump,
    // pickup, victory, etc.). Death intentionally does NOT auto-clear.
    const override = animator.currentOverrideState;
    const prevOverride = prevOverrideRef.current;
    if (prevOverride && !override && prevOverride !== "death") {
      actor.send({ type: "OVERRIDE_DONE" });
      // Land/jump/fall need explicit airborne→grounded plumbing too. We let
      // the controller user drive setGrounded() for that, but as a safety
      // net we emit LAND when a jump/fall override clears.
      if (prevOverride === "jump" || prevOverride === "fall") {
        actor.send({ type: "LAND" });
      }
    }
    prevOverrideRef.current = override;
  }, [model]);

  return {
    // Drop-in compatible surface
    scene: model.scene,
    mixer: model.mixer,
    playAnimation,
    update,
    setMovementSpeed,
    transitionLock: model.transitionLock,
    rightHand: model.rightHand,
    leftHand: model.leftHand,
    head: model.head,
    currentState: model.currentState,
    // New surface
    actor: actorRef,
    animator: animatorRef,
    library: libraryRef,
    mask: maskRef,
    sendEvent,
    setGrounded,
    playLayered,
    triggerOverride,
    /**
     * Live-measured bounds of the rendered, normalized character mesh
     * (post BoundsUtils.normalizeCharacterHeight). `null` until the scene
     * is ready. Consumers (Player physics, NPC colliders, eye-height
     * raycasts) MUST prefer this over caller-supplied scale metadata.
     */
    bounds,
    /** Snapshot inspector helpers (parallel-region aware). */
    getLocomotionState: () => actorRef.current ? getLocomotionState(actorRef.current.getSnapshot().value) : "idle",
    getCombatState: () => actorRef.current ? getCombatState(actorRef.current.getSnapshot().value) : "idle",
    getOverrideState: () => actorRef.current ? getOverrideState(actorRef.current.getSnapshot().value) : "none",
    /** Returns the climbing-region leaf, or null when not on a wall/ladder. */
    getClimbingState: () => actorRef.current ? getClimbingState(actorRef.current.getSnapshot().value) : null,
  };
}

const UPPER_BODY_COMBAT = new Set<AnimationState>([
  "attack", "attack2", "combo2", "combo3", "fastCombo", "fastCombo2",
  "uppercut", "counterStrike", "heavyAttack", "swordBlaster", "hadouken",
  "block", "pickup", "victory", "idle_alt", "pop",
]);

const STATE_TO_EVENT: Partial<Record<AnimationState, CharacterEvent>> = {
  attack: { type: "ATTACK_LIGHT" },
  attack2: { type: "ATTACK_COMBO_NEXT" },
  combo2: { type: "ATTACK_COMBO_NEXT" },
  combo3: { type: "ATTACK_COMBO_NEXT" },
  heavyAttack: { type: "ATTACK_HEAVY" },
  uppercut: { type: "ATTACK_HEAVY" },
  counterStrike: { type: "ATTACK_HEAVY" },
  block: { type: "BLOCK_START" },
  hit: { type: "HIT" },
  death: { type: "DEATH" },
  pickup: { type: "PICKUP" },
  victory: { type: "VICTORY" },
  jump: { type: "JUMP" },
  fall: { type: "FALL" },
  land: { type: "LAND" },
  crouch_start: { type: "CROUCH_START" },
  crouch_end: { type: "CROUCH_END" },
};
