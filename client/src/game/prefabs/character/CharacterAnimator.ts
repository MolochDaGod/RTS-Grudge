/**
 * CharacterAnimator — Layer 2 of the Character Prefab system.
 *
 * Non-React imperative animation controller that manages:
 *   - Locomotion blend layer (idle/walk/run/sprint by speed)
 *   - Combat one-shot layer (attacks/skills with auto-return)
 *   - Additive layers (breathing, injured, hit-react)
 *   - Weapon-specific animation pack loading
 *
 * Uses the same CLIP_PATTERNS and FALLBACK_CHAIN from useCharacterModel.ts
 * so the animation resolution is identical to the existing React hook path.
 */

import * as THREE from "three";
import { COMBAT_STATE_ANIMS } from "../../machines/combatMachine";
import { SPEED } from "./constants";
import type { LocomotionState } from "./types";

// ---------------------------------------------------------------------------
// Clip resolution — simplified imperative port of useCharacterModel patterns
// ---------------------------------------------------------------------------

/**
 * Resolve a named animation action from the mixer, searching by clip name.
 * Returns null if no matching clip is found.
 */
function findAction(
  mixer: THREE.AnimationMixer,
  root: THREE.Object3D,
  clips: THREE.AnimationClip[],
  patterns: string[],
): THREE.AnimationAction | null {
  for (const pattern of patterns) {
    const clip = clips.find((c) => c.name === pattern || c.name.includes(pattern));
    if (clip) return mixer.clipAction(clip, root);
  }
  return null;
}

// ---------------------------------------------------------------------------
// CharacterAnimator
// ---------------------------------------------------------------------------

export class CharacterAnimator {
  mixer: THREE.AnimationMixer;
  root: THREE.Object3D;

  /** All registered actions keyed by AnimationState name. */
  private actions: Map<string, THREE.AnimationAction> = new Map();
  /** Source clips for pack loading. */
  private clips: THREE.AnimationClip[] = [];

  // Locomotion blend
  private idleAction: THREE.AnimationAction | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private runAction:  THREE.AnimationAction | null = null;
  private currentSpeed = 0;

  // One-shot tracking
  private currentOneShot: THREE.AnimationAction | null = null;
  private currentState = "idle";

  // Additive layers
  private additiveLayers: Map<string, THREE.AnimationAction> = new Map();

  /** Callback fired when a one-shot finishes (auto-return to locomotion). */
  onActionDone: (() => void) | null = null;

  constructor(model: THREE.Object3D) {
    this.root = model;
    this.mixer = new THREE.AnimationMixer(model);

    // Listen for finished clips to auto-return from one-shots
    this.mixer.addEventListener("finished", (e: any) => {
      if (e.action === this.currentOneShot) {
        this.currentOneShot = null;
        this.applyLocomotionWeights();
        this.onActionDone?.();
      }
    });
  }

  // -----------------------------------------------------------------------
  // Clip registration
  // -----------------------------------------------------------------------

  /**
   * Register clips from a loaded model (GLB animations or FBX clips).
   * Maps clip names to AnimationState keys using pattern matching.
   */
  registerClips(clips: THREE.AnimationClip[]) {
    this.clips.push(...clips);

    for (const clip of clips) {
      // Register under the raw clip name
      if (!this.actions.has(clip.name)) {
        const action = this.mixer.clipAction(clip, this.root);
        this.actions.set(clip.name, action);
      }
    }
  }

  /**
   * Register a single clip under a specific state name.
   * Used by weapon animation pack loaders.
   */
  registerAction(name: string, clip: THREE.AnimationClip, opts?: { loop?: boolean; speed?: number }) {
    clip.name = name;
    const action = this.mixer.clipAction(clip, this.root);

    if (opts?.loop === false) {
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = true;
    }
    if (opts?.speed) {
      action.timeScale = opts.speed;
    }

    this.actions.set(name, action);
    return action;
  }

  // -----------------------------------------------------------------------
  // Locomotion blend layer
  // -----------------------------------------------------------------------

  /**
   * Set up the three locomotion actions. All play simultaneously with
   * weights controlled by setLocomotionSpeed().
   */
  setupLocomotion(idleName: string, walkName: string, runName: string) {
    this.idleAction = this.actions.get(idleName) ?? null;
    this.walkAction = this.actions.get(walkName) ?? null;
    this.runAction  = this.actions.get(runName) ?? null;

    for (const a of [this.idleAction, this.walkAction, this.runAction]) {
      if (a) {
        a.play();
        a.setEffectiveWeight(0);
      }
    }
    if (this.idleAction) this.idleAction.setEffectiveWeight(1);
  }

  /**
   * Blend locomotion based on character movement speed.
   * Called every frame by CharacterBody.
   */
  setLocomotionSpeed(speed: number) {
    this.currentSpeed = speed;
    if (this.currentOneShot) return; // one-shot overrides locomotion
    this.applyLocomotionWeights();
  }

  private applyLocomotionWeights() {
    const speed = this.currentSpeed;
    let idleW = 0, walkW = 0, runW = 0;

    if (speed < SPEED.DEADZONE) {
      idleW = 1;
    } else if (speed < SPEED.RUN) {
      const t = speed / SPEED.RUN;
      idleW = 1 - t;
      walkW = t;
    } else {
      const t = Math.min((speed - SPEED.RUN) / (SPEED.SPRINT - SPEED.RUN), 1);
      walkW = 1 - t;
      runW = t;
    }

    if (this.idleAction) this.idleAction.setEffectiveWeight(idleW);
    if (this.walkAction) this.walkAction.setEffectiveWeight(walkW);
    if (this.runAction)  this.runAction.setEffectiveWeight(runW);
  }

  // -----------------------------------------------------------------------
  // One-shot / crossfade
  // -----------------------------------------------------------------------

  /**
   * Play a named animation as a one-shot (auto-returns to locomotion).
   * This is the main entry point for combat state transitions.
   */
  playAction(name: string, fadeDuration = 0.15): THREE.AnimationAction | null {
    // Check combat state anim mapping
    const animKey = COMBAT_STATE_ANIMS[name] ?? name;
    const action = this.actions.get(animKey) ?? this.actions.get(name);
    if (!action) return null;

    action.reset();
    action.loop = THREE.LoopOnce;
    action.clampWhenFinished = true;
    action.setEffectiveWeight(1);
    action.play();

    // Fade out previous
    if (this.currentOneShot && this.currentOneShot !== action) {
      this.currentOneShot.crossFadeTo(action, fadeDuration, false);
    } else {
      // Fade out locomotion
      for (const a of [this.idleAction, this.walkAction, this.runAction]) {
        if (a) a.crossFadeTo(action, fadeDuration, false);
      }
    }

    this.currentOneShot = action;
    this.currentState = name;
    return action;
  }

  /**
   * Play a looping animation (replaces locomotion until manually stopped).
   */
  playLoop(name: string, fadeDuration = 0.25): THREE.AnimationAction | null {
    const animKey = COMBAT_STATE_ANIMS[name] ?? name;
    const action = this.actions.get(animKey) ?? this.actions.get(name);
    if (!action) return null;

    action.reset();
    action.loop = THREE.LoopRepeat;
    action.setEffectiveWeight(1);
    action.play();

    if (this.currentOneShot && this.currentOneShot !== action) {
      this.currentOneShot.crossFadeTo(action, fadeDuration, false);
    }

    this.currentOneShot = action;
    this.currentState = name;
    return action;
  }

  /**
   * Force return to locomotion blend (clears any active one-shot).
   */
  returnToLocomotion(fadeDuration = 0.2) {
    if (this.currentOneShot) {
      this.currentOneShot.fadeOut(fadeDuration);
      this.currentOneShot = null;
    }
    this.applyLocomotionWeights();
    // Fade locomotion actions back in
    for (const a of [this.idleAction, this.walkAction, this.runAction]) {
      if (a) a.fadeIn(fadeDuration);
    }
    this.currentState = "idle";
  }

  // -----------------------------------------------------------------------
  // Additive layers
  // -----------------------------------------------------------------------

  /**
   * Add an additive animation layer (breathing, injured, hit-react).
   * Blends on top of the base pose.
   */
  addAdditiveLayer(name: string, clip: THREE.AnimationClip, weight = 1) {
    THREE.AnimationUtils.makeClipAdditive(clip);
    const action = this.mixer.clipAction(clip, this.root);
    action.blendMode = THREE.AdditiveAnimationBlendMode;
    action.setEffectiveWeight(weight);
    action.play();
    this.additiveLayers.set(name, action);
    return action;
  }

  setAdditiveWeight(name: string, weight: number) {
    const action = this.additiveLayers.get(name);
    if (action) action.setEffectiveWeight(weight);
  }

  removeAdditiveLayer(name: string) {
    const action = this.additiveLayers.get(name);
    if (action) {
      action.stop();
      this.additiveLayers.delete(name);
    }
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  get actionNames(): string[] {
    return [...this.actions.keys()];
  }

  get state(): string {
    return this.currentState;
  }

  hasAction(name: string): boolean {
    const animKey = COMBAT_STATE_ANIMS[name] ?? name;
    return this.actions.has(animKey) || this.actions.has(name);
  }

  // -----------------------------------------------------------------------
  // Update / Dispose
  // -----------------------------------------------------------------------

  update(dt: number) {
    this.mixer.update(dt);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.actions.clear();
    this.additiveLayers.clear();
    this.currentOneShot = null;
    this.clips = [];
  }
}
