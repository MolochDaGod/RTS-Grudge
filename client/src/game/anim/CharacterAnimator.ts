import * as THREE from "three";
import type { AnimationState } from "../hooks/useCharacterModel";
import { ONE_SHOT, FALLBACK_CHAIN, SPEED_OVERRIDES } from "../hooks/useCharacterModel";
import { AnimationLibrary } from "./AnimationLibrary";
import { BoneMask, type BoneGroup } from "./BoneMask";
import { BlendTree1D, type BlendNode } from "./BlendTree";
import { hasSwingArc, sampleSwingArc, type SwingArcId } from "./SwingArcs";

// Combat anim names whose layered playback should pair with a swing-arc
// spline. Used by a dev-mode integrity warning in playLayeredFromClip so
// missing ARCS entries surface in the console immediately.
const ATTACK_LIKE_LAYERED = new Set<string>([
  "attack", "attack2", "combo2", "combo3", "fastCombo", "fastCombo2",
  "uppercut", "counterStrike", "heavyAttack",
  "spinSlash", "risingSlash", "dashAttack",
]);
const warnedMissingArc = new Set<string>();

export interface LocomotionConfig {
  /** Speed thresholds (m/s). Defaults are tuned for a ~4.5 m/s human run. */
  idleThreshold?: number;
  walkThreshold?: number;
  runThreshold?: number;
  sprintThreshold?: number;
}

/**
 * Easing curve for cross-fade weight ramps. Defaults to a cubic smoothstep
 * (ease-in-out) so blends feel less linear than three.js's stock fadeIn().
 * Pass a custom function (e.g. exponential out for snappy attacks) to taste.
 */
export type EaseFn = (t: number) => number;

export const EASE_LINEAR: EaseFn = (t) => t;
export const EASE_SMOOTH: EaseFn = (t) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
export const EASE_OUT_CUBIC: EaseFn = (t) => {
  const c = Math.max(0, Math.min(1, t));
  const inv = 1 - c;
  return 1 - inv * inv * inv;
};
export const EASE_IN_CUBIC: EaseFn = (t) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * c;
};

export interface PlayLayeredOptions {
  group?: BoneGroup;
  /** Cross-fade in seconds. */
  fadeIn?: number;
  fadeOut?: number;
  /** Multiplier applied to clip duration when scheduling auto-stop. */
  durationScale?: number;
  /** When set, run action.timeScale at this rate. */
  timeScale?: number;
  /**
   * Hold the layered clip until `stopLayered()` is called explicitly.
   * Used for sustained poses like blocking that should not auto-expire on
   * the source clip's natural duration.
   */
  loop?: boolean;
  /**
   * Easing applied to the fade-in/out weight ramp. Replaces three.js's
   * built-in linear fadeIn/fadeOut so combat clips can feel snappier.
   * Defaults to EASE_SMOOTH (cubic smoothstep) for layered combat.
   */
  ease?: EaseFn;
}

const DEFAULT_LOCOMOTION: Required<LocomotionConfig> = {
  idleThreshold: 0.05,
  walkThreshold: 1.5,
  runThreshold: 4.5,
  sprintThreshold: 8.0,
};

/**
 * Top-level animation orchestrator. Owns:
 *   - a 1D BlendTree across idle/walk/run/sprint, parameterized by speed
 *   - a single layered "upper-body" action slot for combat/hit overlays,
 *     using bone-masked clips so the lower body keeps locomoting
 *   - a one-shot "full body override" slot for things like jump/roll/death
 *     where the whole body should leave locomotion (we fade the blend tree
 *     out via setMasterWeight 0).
 *
 * The animator does NOT own the mixer (useCharacterModel does). Mixer
 * advancement still happens through the shared `update(delta)` from the hook.
 */
export class CharacterAnimator {
  private library: AnimationLibrary;
  private mask: BoneMask;
  private mixer: THREE.AnimationMixer;
  private scene: THREE.Object3D;
  private config: Required<LocomotionConfig>;

  private blendTree: BlendTree1D | null = null;
  private blendTreeFingerprint: string | null = null;
  private blendTreeReadyForState = new Set<AnimationState>();

  // Layered action (e.g. upper-body combat overlay)
  private layerAction: THREE.AnimationAction | null = null;
  private layerState: AnimationState | null = null;
  private layerExpireAt = 0;
  private layerStartedAt = 0;
  private layerSourceDuration = 0;
  private layerGroup: BoneGroup = "upperBody";

  // Full-body override action (jump, fall, roll, death — replaces locomotion)
  private overrideAction: THREE.AnimationAction | null = null;
  private overrideState: AnimationState | null = null;
  private overrideExpireAt = 0;
  private overrideStartedAt = 0;
  private overrideSourceDuration = 0;

  // Custom-easing fade scheduler. Replaces three.js's built-in linear
  // fadeIn/fadeOut by tracking pending weight ramps and applying an EaseFn
  // each frame in update(). Stale entries (action stopped, weight already
  // matches target) are filtered every tick.
  private pendingFades: Array<{
    action: THREE.AnimationAction;
    fromW: number;
    toW: number;
    elapsed: number;
    duration: number;
    ease: EaseFn;
    /** When toW===0, stop the action once the ramp completes. */
    stopOnDone: boolean;
  }> = [];

  // Right-hand bone for swing-arc additive offsets, plus a snapshot of the
  // bone's REST position/quaternion the first time we touch it. The mixer
  // overwrites bone pose every tick from clip data, so we re-add our offset
  // each frame in update() — there is no cumulative drift.
  private rightHandBone: THREE.Object3D | null = null;
  private leftHandBone: THREE.Object3D | null = null;
  // Charge tier multiplier consumed by sampleSwingArc (1.0..~1.6).
  private swingArcAmpMul = 1;
  // Per-frame scratch for arc sampling.
  private _arcPos = new THREE.Vector3();
  private _arcEuler = new THREE.Euler();
  private _arcQuat = new THREE.Quaternion();

  // Cache of mask-derived actions keyed by `${state}:${group}`.
  private maskedActionCache = new Map<string, THREE.AnimationAction>();


  private currentTime = 0;

  // Admin "force T-pose" override. While true the animator no-ops every
  // play/setSpeed entry point and keeps the skeleton in its bind pose so
  // the user can inspect rig deformation without pack clips overlaying it.
  // Toggled by the F8 cheat HUD via `setForceTPose`.
  private forceTPose = false;

  constructor(
    scene: THREE.Object3D,
    mixer: THREE.AnimationMixer,
    library: AnimationLibrary,
    mask: BoneMask,
    config: LocomotionConfig = {},
  ) {
    this.scene = scene;
    this.mixer = mixer;
    this.library = library;
    this.mask = mask;
    this.config = { ...DEFAULT_LOCOMOTION, ...config };
  }

  /**
   * Build the locomotion blend tree from whatever idle/walk/run/sprint
   * actions are currently registered. Safe to call repeatedly — no-op if the
   * same action set is already wired.
   */
  rebuildLocomotion(): void {
    if (this.forceTPose) return;
    const idle = this.library.getAction("idle");
    if (!idle) {
      // No idle yet → defer; blend tree comes online when clips bind.
      return;
    }

    const seen = new Set<AnimationState>();
    const nodes: BlendNode[] = [];

    nodes.push({ threshold: this.config.idleThreshold, action: idle, label: "idle" });
    seen.add("idle");

    const walkAction = this.library.getAction("walk");
    const walk = walkAction ?? this.library.getAction("run");
    if (walk) {
      nodes.push({
        threshold: this.config.walkThreshold,
        action: walk,
        label: walkAction ? "walk" : "walk(=run)",
      });
      seen.add(walkAction ? "walk" : "run");
    }

    const run = this.library.getAction("run") ?? walk;
    if (run && run !== walk) {
      nodes.push({ threshold: this.config.runThreshold, action: run, label: "run" });
      seen.add("run");
    }

    const sprint = this.library.getAction("sprint") ?? run;
    if (sprint && sprint !== run && sprint !== walk) {
      nodes.push({ threshold: this.config.sprintThreshold, action: sprint, label: "sprint" });
      seen.add("sprint");
    }

    // Fingerprint includes the underlying clip uuid for each node so weapon-
    // pack injection (which replaces actions with new ones bound to a fresh
    // clip uuid for the same logical state) is detected and triggers a
    // rebuild. Label-only would miss those swaps and leave the tree wired to
    // stale actions that useCharacterModel has stopped/uncached.
    const fingerprint = nodes
      .map(n => `${n.label}:${n.action.getClip().uuid}`)
      .join("|");
    if (this.blendTreeFingerprint === fingerprint) return;

    if (this.blendTree) {
      this.blendTree.stop();
    }
    this.blendTree = new BlendTree1D(nodes);
    this.blendTreeFingerprint = fingerprint;
    this.blendTreeReadyForState = seen;
    // Sync clip time-scales to actual movement speed so the feet stay
    // planted instead of skating across the ground when the scripted
    // velocity drifts from the clip's native pace.
    this.blendTree.enableTimeSync(true);
    this.blendTree.play();
  }

  setSpeed(speed: number): void {
    if (this.forceTPose) return;
    if (!this.blendTree) {
      this.rebuildLocomotion();
      if (!this.blendTree) return;
    }
    this.blendTree.setParameter(speed);
  }

  /**
   * Play an action that overrides the whole body (e.g. jump, fall, death).
   * The blend tree is faded out for the duration of the override.
   */
  playOverride(state: AnimationState, opts: { fadeIn?: number; loop?: boolean; ease?: EaseFn } = {}): void {
    if (this.forceTPose) return;
    let action = this.library.getAction(state);
    if (!action) {
      // Walk fallback chain
      const fallbacks = FALLBACK_CHAIN[state];
      if (fallbacks) {
        for (const fb of fallbacks) {
          action = this.library.getAction(fb);
          if (action) break;
        }
      }
      if (!action) return;
    }

    const fadeIn = opts.fadeIn ?? 0.2;
    const ease = opts.ease ?? EASE_SMOOTH;

    // Stop any prior override (different action) without snapping.
    if (this.overrideAction && this.overrideAction !== action) {
      this.scheduleFade(this.overrideAction, this.overrideAction.getEffectiveWeight(), 0, fadeIn, ease, true);
    }

    const clipDur = action.getClip().duration;
    if (!opts.loop && ONE_SHOT.has(state)) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      const dur = clipDur / Math.max(0.1, action.timeScale || 1);
      this.overrideExpireAt = this.currentTime + dur;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
      this.overrideExpireAt = Number.POSITIVE_INFINITY;
    }

    action.reset().play();
    // Custom-eased ramp from 0 → 1 instead of action.fadeIn() (which is
    // linear under the hood).
    action.setEffectiveWeight(0);
    this.scheduleFade(action, 0, 1, fadeIn, ease, false);
    this.overrideAction = action;
    this.overrideState = state;
    this.overrideStartedAt = this.currentTime;
    this.overrideSourceDuration = clipDur;

    // Damp locomotion fully while override owns the body.
    if (this.blendTree) this.blendTree.setMasterWeight(0);
  }

  stopOverride(fadeOut = 0.2, ease: EaseFn = EASE_SMOOTH): void {
    if (this.overrideAction) {
      this.scheduleFade(this.overrideAction, this.overrideAction.getEffectiveWeight(), 0, fadeOut, ease, true);
      this.overrideAction = null;
      this.overrideState = null;
      this.overrideExpireAt = 0;
    }
    if (this.blendTree) this.blendTree.setMasterWeight(1);
  }

  /**
   * Play a bone-masked layered action (e.g. punch on the upper body while
   * the legs keep walking). Uses additive blending so the masked clip is
   * laid on top of the locomotion pose for the masked bones.
   */
  playLayered(state: AnimationState, opts: PlayLayeredOptions = {}): void {
    if (this.forceTPose) return;
    const sourceClip = this.library.getClip(state);
    if (!sourceClip) {
      // Try fallbacks
      const fallbacks = FALLBACK_CHAIN[state];
      if (!fallbacks) return;
      for (const fb of fallbacks) {
        const fbClip = this.library.getClip(fb);
        if (fbClip) return this.playLayeredFromClip(state, fbClip, opts);
      }
      return;
    }
    this.playLayeredFromClip(state, sourceClip, opts);
  }

  private playLayeredFromClip(state: AnimationState, sourceClip: THREE.AnimationClip, opts: PlayLayeredOptions): void {
    const group = opts.group ?? "upperBody";
    const fadeIn = opts.fadeIn ?? 0.12;
    const ease = opts.ease ?? EASE_SMOOTH;
    const cacheKey = `${sourceClip.uuid}:${group}`;

    let action = this.maskedActionCache.get(cacheKey);
    if (!action) {
      const masked = this.mask.maskClip(sourceClip, group);
      if (masked.tracks.length === 0) {
        // Mask removed everything (skeleton lacked classified bones); fall
        // back to an unmasked layered play so the user still sees motion.
        const fallbackClip = sourceClip.clone();
        fallbackClip.name = sourceClip.name + "_layer_fallback";
        action = this.mixer.clipAction(fallbackClip, this.scene);
      } else {
        action = this.mixer.clipAction(masked, this.scene);
      }
      action.blendMode = THREE.NormalAnimationBlendMode;
      this.maskedActionCache.set(cacheKey, action);
    }

    // Loop mode is per-call rather than per-cached-action: the same clip can
    // be played as a one-shot (combat swing) or as a held loop (block hold).
    if (opts.loop) {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    } else {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }

    const speed = opts.timeScale ?? SPEED_OVERRIDES[state] ?? 1;
    action.timeScale = speed;

    // Fade out previous layer if it's a different action so we don't double
    // up combat clips on the same bones.
    if (this.layerAction && this.layerAction !== action) {
      this.scheduleFade(this.layerAction, this.layerAction.getEffectiveWeight(), 0, fadeIn, ease, true);
    }

    action.reset().play();
    action.setEffectiveWeight(0);
    this.scheduleFade(action, 0, 1, fadeIn, ease, false);
    this.layerAction = action;
    this.layerState = state;
    this.layerGroup = group;
    this.layerStartedAt = this.currentTime;
    this.layerSourceDuration = sourceClip.duration;

    // Dev-mode integration check. The swing-arc spline only fires when
    // hasSwingArc(state) is true; if a new combat anim is wired up without
    // a matching ARC entry the arc silently no-ops. Warn once per state so
    // we catch this in the console instead of as a missing visual.
    if (import.meta.env.DEV && ATTACK_LIKE_LAYERED.has(state) && !hasSwingArc(state as string)) {
      if (!warnedMissingArc.has(state)) {
        warnedMissingArc.add(state);
        console.warn(`[SwingArc] No arc defined for layered combat state "${state}". Add an entry to SwingArcs.ts ARCS.`);
      }
    }

    if (opts.loop) {
      this.layerExpireAt = Number.POSITIVE_INFINITY;
    } else {
      const dur = (sourceClip.duration / Math.max(0.1, speed)) * (opts.durationScale ?? 1);
      this.layerExpireAt = this.currentTime + dur;
    }
  }

  stopLayered(fadeOut = 0.15, ease: EaseFn = EASE_SMOOTH): void {
    if (this.layerAction) {
      this.scheduleFade(this.layerAction, this.layerAction.getEffectiveWeight(), 0, fadeOut, ease, true);
      this.layerAction = null;
      this.layerState = null;
      this.layerExpireAt = 0;
    }
  }

  /**
   * Register the right/left hand bones so layered combat states can apply
   * their swing-arc spline as an additive offset on top of the mixer pose.
   * Safe to call repeatedly with the same refs (idempotent), or with null
   * to detach (e.g. on scene swap).
   */
  setHandBones(right: THREE.Object3D | null, left: THREE.Object3D | null): void {
    this.rightHandBone = right;
    this.leftHandBone = left;
  }

  /**
   * Charge tier multiplier consumed by sampleSwingArc. Player wires this to
   * its CHARGE_TIER_1 / CHARGE_TIER_2 thresholds so charged swings get a
   * visibly wider arc on top of the same source clip. Default 1.0.
   */
  setSwingArcChargeMul(mul: number): void {
    this.swingArcAmpMul = Math.max(0, mul);
  }

  /**
   * Schedule a custom-eased weight ramp on `action`. The animator's update()
   * applies the ease per frame via setEffectiveWeight. When `stopOnDone` is
   * true and the ramp ends at weight 0, the action is .stop()'d so it
   * releases its mixer slot cleanly.
   */
  private scheduleFade(
    action: THREE.AnimationAction,
    fromW: number,
    toW: number,
    duration: number,
    ease: EaseFn,
    stopOnDone: boolean,
  ): void {
    // Drop any prior pending fade for the same action — we always replace
    // rather than stack so back-to-back attacks don't pile competing ramps.
    this.pendingFades = this.pendingFades.filter(f => f.action !== action);
    if (duration <= 0.001) {
      action.setEffectiveWeight(toW);
      if (stopOnDone && toW === 0) action.stop();
      return;
    }
    this.pendingFades.push({ action, fromW, toW, duration, elapsed: 0, ease, stopOnDone });
  }

  private tickFades(delta: number): void {
    if (this.pendingFades.length === 0) return;
    const next: typeof this.pendingFades = [];
    for (const f of this.pendingFades) {
      f.elapsed += delta;
      const t = Math.min(1, f.elapsed / f.duration);
      const w = f.fromW + (f.toW - f.fromW) * f.ease(t);
      f.action.setEffectiveWeight(w);
      if (t < 1) {
        next.push(f);
      } else if (f.stopOnDone && f.toW === 0) {
        f.action.stop();
      }
    }
    this.pendingFades = next;
  }

  /**
   * Apply the active layered state's swing-arc as additive offsets on the
   * right hand bone (and a damped mirror on the left for two-handed clips).
   * Runs AFTER the mixer has written the bone pose for this frame, so the
   * additive position/rotation lands on top of clip data and is reset on
   * the next mixer tick (no cumulative drift).
   */
  private applySwingArc(): void {
    const bone = this.rightHandBone;
    if (!bone) return;
    const state = this.layerState;
    if (!state || !this.layerAction) return;
    if (!hasSwingArc(state as string)) return;

    // Use the action's own clock so timeScale/duration changes are honored.
    const clipDur = this.layerSourceDuration;
    if (clipDur <= 0) return;
    const t = Math.max(0, Math.min(1, this.layerAction.time / clipDur));

    sampleSwingArc(state as SwingArcId, t, this._arcPos, this._arcEuler, this.swingArcAmpMul);

    bone.position.add(this._arcPos);
    this._arcQuat.setFromEuler(this._arcEuler);
    bone.quaternion.multiply(this._arcQuat);

    // Damped mirror on the off-hand so two-handed clips read coherent.
    const lh = this.leftHandBone;
    if (lh) {
      lh.position.x += this._arcPos.x * 0.4;
      lh.position.y += this._arcPos.y * 0.4;
      lh.position.z += this._arcPos.z * 0.4;
    }
  }

  /**
   * Generic "play state" entrypoint that picks the right slot:
   *  - locomotion states (idle/walk/run/sprint) feed the blend tree (no-op,
   *    use setSpeed instead — but we accept the call for back-compat).
   *  - full-body one-shots (jump, fall, roll, death, hit, etc.) → override
   *  - upper-body combat one-shots (attack/punch/uppercut/heavyAttack/etc.)
   *    → layered play
   */
  play(state: AnimationState): void {
    if (this.forceTPose) return;
    if (state === "idle" || state === "walk" || state === "run" || state === "sprint") {
      // Locomotion is parameter-driven. Caller should setSpeed instead, but
      // if they explicitly request idle, force the parameter to 0.
      if (state === "idle") this.setSpeed(0);
      this.stopOverride(0.18);
      return;
    }

    const isOneShot = ONE_SHOT.has(state);
    if (UPPER_BODY_COMBAT.has(state) || state === "hit") {
      // Hit and combat one-shots overlay the upper body so the legs keep
      // running. The masked clip is additive over the locomotion blend tree
      // and auto-stops on duration in update().
      this.playLayered(state, { group: "upperBody" });
      return;
    }
    if (state === "death") {
      this.playOverride(state, { fadeIn: 0.35 });
      return;
    }
    if (isOneShot) {
      this.playOverride(state);
      return;
    }
    // Looped non-locomotion (block, climb, sneak, etc.)
    this.playOverride(state, { loop: true });
  }

  update(delta: number): void {
    this.currentTime += delta;

    if (this.layerAction && this.currentTime >= this.layerExpireAt) {
      this.stopLayered(0.18);
    }

    if (this.overrideAction && this.currentTime >= this.overrideExpireAt) {
      this.stopOverride(0.22);
    }

    // Drive any pending custom-eased fade ramps before applying additive
    // arc offsets — the mixer has already advanced (model.update ran first
    // in the controller), so weight changes here take effect on this frame.
    this.tickFades(delta);

    // Layer the per-attack swing-arc spline on top of the mixer's bone pose.
    // No-op when no arc is registered for the current layered state.
    this.applySwingArc();
  }

  get currentLayerState(): AnimationState | null {
    return this.layerState;
  }

  get currentOverrideState(): AnimationState | null {
    return this.overrideState;
  }

  get hasBlendTree(): boolean {
    return this.blendTree !== null;
  }

  get isForcedTPose(): boolean {
    return this.forceTPose;
  }

  /**
   * Force every action off so the skeleton falls back to its bind pose.
   * Used by the F8 cheat HUD to inspect rig deformation. While `force`
   * is true every play / setSpeed entry point on this animator no-ops,
   * so the mixer ticks but has nothing to apply.
   *
   * Releasing the toggle re-arms the locomotion blend tree on the next
   * frame; the caller should follow up with `setSpeed(0)` (or whatever
   * the current scripted speed is) so the rig snaps back to idle
   * cleanly instead of holding bind pose for one mixer tick.
   */
  setForceTPose(force: boolean): void {
    if (this.forceTPose === force) return;
    this.forceTPose = force;
    if (force) {
      // Stop layered + override slots without fades so the bind pose is
      // immediate. fadeOut would leave the action contributing for ~0.2s
      // and the rig would visibly drift into T-pose instead of snapping.
      if (this.layerAction) {
        this.layerAction.stop();
        this.layerAction = null;
        this.layerState = null;
        this.layerExpireAt = 0;
      }
      if (this.overrideAction) {
        this.overrideAction.stop();
        this.overrideAction = null;
        this.overrideState = null;
        this.overrideExpireAt = 0;
      }
      // Drop any pending custom fades so the bind pose isn't disturbed by
      // a still-ramping weight ramp on the next frame.
      this.pendingFades = [];
      // Drop locomotion contribution to zero. The blend tree's nested
      // actions are still on the mixer, but with master weight 0 they
      // contribute nothing — and the next setSpeed call is gated by
      // `forceTPose` so they can't be re-driven until release.
      this.blendTree?.setMasterWeight(0);
      // Reset every skinned skeleton on the scene root to its bind pose
      // (matrix-of-each-bone-from-the-clip's-T0 → identity offset). With
      // all actions stopped the mixer won't overwrite this on the next
      // tick, so the rig stays in bind pose until release.
      this.scene.traverse((obj) => {
        const sm = obj as unknown as THREE.SkinnedMesh;
        if (sm && (sm as any).isSkinnedMesh && sm.skeleton) {
          sm.skeleton.pose();
        }
      });
    } else {
      // Re-arm locomotion. The blend tree fingerprint is still valid so
      // rebuildLocomotion is a cheap no-op — we just need to put the
      // master weight back so the existing nodes contribute again.
      this.blendTree?.setMasterWeight(1);
      this.rebuildLocomotion();
    }
  }
}

/**
 * States that should overlay the upper body while locomotion keeps the legs
 * moving. Anything not listed here will be played as a full-body override.
 */
const UPPER_BODY_COMBAT = new Set<AnimationState>([
  "attack", "attack2",
  "combo2", "combo3", "fastCombo", "fastCombo2",
  "uppercut", "counterStrike", "heavyAttack",
  "swordBlaster", "swordBlaster2",
  "hadouken",
  "block",
  "pickup", "victory", "idle_alt", "pop",
]);
