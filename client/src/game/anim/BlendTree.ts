import * as THREE from "three";

export interface BlendNode {
  /** Parameter value at which this node's weight is 1.0. */
  threshold: number;
  action: THREE.AnimationAction;
  /** Optional label for debugging. */
  label?: string;
}

/**
 * 1D blend tree. Each node owns an action; nodes are sorted by threshold.
 * setParameter(value) computes a normalized weight for each action: when the
 * parameter falls between two adjacent thresholds, those two get a weighted
 * sum (totaling 1.0); all other nodes get 0. All actions are kept playing
 * with weight 0 when not active so transitions are smooth and free from
 * action-state snapping.
 *
 * Used for speed-driven locomotion: idle (0) ↔ walk (1.5) ↔ run (4.5) ↔ sprint (8).
 */
export class BlendTree1D {
  private nodes: BlendNode[];
  private parameter = 0;
  private playing = false;

  constructor(nodes: BlendNode[]) {
    if (nodes.length === 0) throw new Error("BlendTree1D requires at least one node");
    this.nodes = [...nodes].sort((a, b) => a.threshold - b.threshold);
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    for (const n of this.nodes) {
      // setEffectiveWeight starts at 0; play() begins ticking time so blending
      // happens by tweaking weights rather than re-starting actions.
      n.action.reset();
      n.action.setEffectiveWeight(0);
      n.action.play();
    }
    this.recomputeWeights();
  }

  stop(): void {
    if (!this.playing) return;
    this.playing = false;
    for (const n of this.nodes) {
      n.action.stop();
    }
  }

  fadeOut(duration: number): void {
    if (!this.playing) return;
    for (const n of this.nodes) {
      n.action.fadeOut(duration);
    }
    this.playing = false;
  }

  fadeIn(duration: number): void {
    if (this.playing) return;
    this.playing = true;
    for (const n of this.nodes) {
      n.action.reset();
      n.action.setEffectiveWeight(0);
      n.action.play();
    }
    this.recomputeWeights();
    // After the weights are set, scale them up over `duration`. Three.js
    // doesn't provide weighted fade in directly, so we cheat: play with
    // weight 0 then immediately reset weights (already correct). For long
    // fades, callers can ramp the parameter externally. The duration param
    // is accepted for API symmetry with single AnimationActions.
    void duration;
  }

  setParameter(value: number): void {
    this.parameter = value;
    if (this.playing) {
      this.recomputeWeights();
      if (this.syncTimeScale) this.recomputeTimeScales();
    }
  }

  /**
   * When enabled, every node's `timeScale` is set so the clip plays at
   * `parameter / threshold` speed. This keeps the feet locked to the actual
   * movement velocity for smooth foot planting (no sliding) regardless of
   * which clips are blended together. Pure idle (threshold 0) is held at
   * its native rate. Recommended for locomotion blend trees.
   */
  enableTimeSync(enabled: boolean): void {
    this.syncTimeScale = enabled;
    if (this.playing) {
      if (enabled) this.recomputeTimeScales();
      else for (const n of this.nodes) n.action.timeScale = 1;
    }
  }

  private syncTimeScale = false;

  private recomputeTimeScales(): void {
    const v = this.parameter;
    // Treat the lowest-threshold node as the idle clip and leave it at its
    // native rate — its visual is supposed to be a standing pose, not a
    // slowed-down walk. Anything else gets scaled to match the parameter.
    const idleNode = this.nodes[0];
    for (const n of this.nodes) {
      if (n === idleNode) {
        n.action.timeScale = 1;
        continue;
      }
      const scale = Math.min(1.6, Math.max(0.4, v / n.threshold));
      n.action.timeScale = scale;
    }
  }

  /** Multiplier applied to every node's weight. Lets external layers scale
   *  the locomotion contribution down (e.g. while a one-shot one-shot
   *  attack plays full-body) without losing the relative blend. */
  setMasterWeight(w: number): void {
    this.masterWeight = Math.max(0, Math.min(1, w));
    if (this.playing) this.recomputeWeights();
  }

  private masterWeight = 1;

  private recomputeWeights(): void {
    const v = this.parameter;
    const n = this.nodes;
    const m = this.masterWeight;

    if (v <= n[0].threshold) {
      for (let i = 0; i < n.length; i++) n[i].action.setEffectiveWeight(i === 0 ? m : 0);
      return;
    }
    if (v >= n[n.length - 1].threshold) {
      for (let i = 0; i < n.length; i++) n[i].action.setEffectiveWeight(i === n.length - 1 ? m : 0);
      return;
    }

    for (let i = 0; i < n.length - 1; i++) {
      const a = n[i];
      const b = n[i + 1];
      if (v >= a.threshold && v <= b.threshold) {
        const span = b.threshold - a.threshold;
        const t = span <= 1e-6 ? 0 : (v - a.threshold) / span;
        for (let j = 0; j < n.length; j++) {
          if (j === i) n[j].action.setEffectiveWeight((1 - t) * m);
          else if (j === i + 1) n[j].action.setEffectiveWeight(t * m);
          else n[j].action.setEffectiveWeight(0);
        }
        return;
      }
    }
  }

  getNodes(): BlendNode[] {
    return this.nodes;
  }

  isPlaying(): boolean {
    return this.playing;
  }
}
