/**
 * AnimationSystem — Three.js Animation Skinning Blending best practices
 *
 * Implements the exact patterns from:
 *   https://threejs.org/examples/#webgl_animation_skinning_blending
 *
 * Key principles:
 *  1. setWeight() BEFORE crossFadeTo() to avoid opacity pop
 *  2. crossFadeTo() handles fadeOut of the from-action automatically
 *  3. synchronize() maintains the cycle phase between locomotion states
 *  4. prepareCrossFade() waits for the current non-looping clip to complete
 *  5. Additive action layer for aim/overlay blending
 */
import * as THREE from 'three';

export type AnimName = string;

interface RegisterOptions {
  loop?:            boolean;          // default true
  clampWhenDone?:   boolean;          // default true for non-looping
  timeScale?:       number;           // playback speed
  weight?:          number;           // initial effective weight
}

// ── Low-level helpers (mirrors Three.js example exactly) ─────────────────────

function setWeight(action: THREE.AnimationAction, weight: number) {
  action.enabled = true;
  action.setEffectiveTimeScale(1);
  action.setEffectiveWeight(weight);
}

// ── AnimationSystem ────────────────────────────────────────────────────────────
export class AnimationSystem {
  readonly mixer:   THREE.AnimationMixer;
  private actions = new Map<AnimName, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private currentName: AnimName = '';

  constructor(mixer: THREE.AnimationMixer) {
    this.mixer = mixer;
  }

  // ── Registration ──────────────────────────────────────────────────────────

  register(name: AnimName, clip: THREE.AnimationClip, opts: RegisterOptions = {}): THREE.AnimationAction {
    const { loop = true, clampWhenDone = true, timeScale = 1, weight = 1 } = opts;
    const action = this.mixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    if (!loop && clampWhenDone) action.clampWhenFinished = true;
    action.setEffectiveTimeScale(timeScale);
    action.setEffectiveWeight(weight);
    this.actions.set(name, action);
    return action;
  }

  registerAll(clips: Record<string, THREE.AnimationClip>, opts?: Record<string, RegisterOptions>) {
    const ONE_SHOT: AnimName[] = [
      'attack', 'attack_heavy', 'shoot', 'ranged_attack',
      'dodge', 'hit', 'death', 'phase_out', 'phase_in', 'jump',
    ];
    for (const [name, clip] of Object.entries(clips)) {
      const isOneShot = ONE_SHOT.some(s => name.includes(s));
      this.register(name, clip, { loop: !isOneShot, ...(opts?.[name] ?? {}) });
    }
  }

  // ── Core cross-fade (Three.js example) ───────────────────────────────────

  /**
   * Immediately cross-fade from → to.
   * Mirror of executeCrossFade() in the Three.js skinning blending example.
   */
  crossFade(from: AnimName, to: AnimName, duration: number, warp = false): boolean {
    const fromAction = this.actions.get(from);
    const toAction   = this.actions.get(to);
    if (!toAction) return false;

    setWeight(toAction, 1);
    toAction.time = 0;

    if (fromAction && fromAction !== toAction) {
      fromAction.crossFadeTo(toAction, duration, warp);
    } else {
      // Nothing to fade from — just fade the target action in
      toAction.reset().fadeIn(duration).play();
    }

    toAction.play();
    this.current     = toAction;
    this.currentName = to;
    return true;
  }

  /**
   * Cross-fade while synchronising the cycle phase (e.g. walk → run).
   * Mirror of synchronizeCrossFade() in the Three.js example.
   */
  crossFadeSync(from: AnimName, to: AnimName, duration: number): boolean {
    const fromAction = this.actions.get(from);
    const toAction   = this.actions.get(to);
    if (!fromAction || !toAction) return this.crossFade(from, to, duration);

    // Preserve normalised time so the foot cycle stays in phase
    const normTime = fromAction.time / fromAction.getClip().duration;
    toAction.time  = normTime * toAction.getClip().duration;

    setWeight(toAction, 1);
    fromAction.crossFadeTo(toAction, duration, false);
    toAction.play();
    this.current     = toAction;
    this.currentName = to;
    return true;
  }

  /**
   * Wait for the current loop to complete, then cross-fade.
   * Mirror of synchronizeCrossFade() via loop event.
   */
  crossFadeOnLoop(from: AnimName, to: AnimName, duration: number) {
    const fromAction = this.actions.get(from);
    if (!fromAction) { this.crossFade(from, to, duration); return; }

    const onLoop = (event: THREE.Event) => {
      if ((event as any).action === fromAction) {
        this.mixer.removeEventListener('loop', onLoop as any);
        this.crossFade(from, to, duration);
      }
    };
    this.mixer.addEventListener('loop', onLoop as any);
  }

  // ── Convenience wrappers ──────────────────────────────────────────────────

  /** Cross-fade to `to` from whatever is currently playing */
  to(to: AnimName, duration = 0.2, warp = false): boolean {
    return this.crossFade(this.currentName, to, duration, warp);
  }

  /** Synchronized fade to locomotion state */
  toSync(to: AnimName, duration = 0.2): boolean {
    return this.crossFadeSync(this.currentName, to, duration);
  }

  /** Instant switch — no blend */
  play(name: AnimName) {
    const action = this.actions.get(name);
    if (!action) return;
    if (this.current && this.current !== action) {
      this.current.stop();
      this.current.enabled = false;
    }
    setWeight(action, 1);
    action.reset().play();
    this.current     = action;
    this.currentName = name;
  }

  // ── Additive / overlay layer ──────────────────────────────────────────────

  /**
   * Blend an additive layer (e.g. aim overlay) onto the current pose.
   * weight = 0 fully removes the additive; weight = 1 fully applies it.
   */
  setAdditiveWeight(name: AnimName, weight: number) {
    const action = this.actions.get(name);
    if (!action) return;
    if (weight > 0 && !action.isRunning()) {
      action.enabled = true;
      action.setEffectiveTimeScale(1);
      action.blendMode = THREE.AdditiveAnimationBlendMode;
      action.play();
    }
    action.setEffectiveWeight(weight);
    if (weight <= 0) { action.enabled = false; }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  has(name: AnimName): boolean { return this.actions.has(name); }

  isFinished(name: AnimName, threshold = 0.9): boolean {
    const a = this.actions.get(name);
    if (!a || !a.isRunning()) return true;
    return a.time >= a.getClip().duration * threshold;
  }

  getNormalisedTime(name: AnimName): number {
    const a = this.actions.get(name);
    if (!a || a.getClip().duration === 0) return 0;
    return a.time / a.getClip().duration;
  }

  get currentStateName(): AnimName { return this.currentName; }
  get currentAction():    THREE.AnimationAction | null { return this.current; }

  update(dt: number) { this.mixer.update(dt); }
}
