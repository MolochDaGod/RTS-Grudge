import * as THREE from "three";
import type { AnimationState } from "../hooks/useCharacterModel";

/**
 * Read-only view over the live Map<AnimationState, AnimationAction> owned by
 * useCharacterModel. The library translates "what state do I want?" lookups
 * into the actual mixer-bound action, plus exposes the underlying clip so
 * higher-level systems (BoneMask, BlendTree) can build derived actions on
 * the same mixer.
 */
export class AnimationLibrary {
  constructor(private actionsRef: React.MutableRefObject<Map<AnimationState, THREE.AnimationAction>>) {}

  has(state: AnimationState): boolean {
    return this.actionsRef.current.has(state);
  }

  getAction(state: AnimationState): THREE.AnimationAction | null {
    return this.actionsRef.current.get(state) ?? null;
  }

  getClip(state: AnimationState): THREE.AnimationClip | null {
    const action = this.actionsRef.current.get(state);
    return action ? action.getClip() : null;
  }

  /**
   * Find the first action available from `candidates`, walking the list in
   * priority order. Useful for graceful fallbacks (e.g. sprint → run → walk).
   */
  resolve(candidates: AnimationState[]): THREE.AnimationAction | null {
    for (const c of candidates) {
      const a = this.actionsRef.current.get(c);
      if (a) return a;
    }
    return null;
  }

  states(): AnimationState[] {
    return Array.from(this.actionsRef.current.keys());
  }
}
