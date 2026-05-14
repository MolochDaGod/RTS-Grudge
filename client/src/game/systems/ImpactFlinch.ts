/**
 * ImpactFlinch — Procedural bone-level hit reaction.
 *
 * On damage, rotates targeted bones a small amount toward the impact
 * direction, then springs them back to the animation-driven pose over
 * a short decay. The effect is additive: it layers on top of whatever
 * the animation mixer is currently doing, so the character visibly
 * recoils without interrupting locomotion or combat clips.
 *
 * Supports humanoid (Mixamo/KayKit/CC4/generic) and quadruped (Quaternius
 * dinosaur/animal) skeletons via separate weight maps. The system auto-
 * detects the rig type using the existing BoneAliases.detectSkeletonType
 * and falls back to a "body root only" flinch for unknown rigs.
 *
 * Usage:
 *   const flinch = new ImpactFlinchController(scene);
 *   // on damage:
 *   flinch.trigger(impactWorldDir, intensity);
 *   // every frame:
 *   flinch.update(delta);
 */

import * as THREE from "three";
import {
  findBoneByAlias,
  HIPS_ALIASES,
  SPINE_ALIASES,
  SPINE2_ALIASES,
  HEAD_ALIASES,
  SHOULDER_L_ALIASES,
  SHOULDER_R_ALIASES,
  UPPER_ARM_L_ALIASES,
  UPPER_ARM_R_ALIASES,
  LEFT_UP_LEG_ALIASES,
  RIGHT_UP_LEG_ALIASES,
} from "./BoneAliases";

// ---------------------------------------------------------------------------
// Flinch bone entry — one per influenced bone
// ---------------------------------------------------------------------------
interface FlinchBone {
  bone: THREE.Object3D;
  /** How much this bone participates in the flinch (0–1). */
  weight: number;
  /** Axis this bone rotates around in its local space for the flinch. */
  axis: THREE.Vector3;
  /** Current flinch angle (radians). Springs toward 0 over time. */
  currentAngle: number;
  /** Target flinch angle set on trigger(). */
  targetAngle: number;
  /** Quaternion snapshot before flinch is applied this frame. */
  preQ: THREE.Quaternion;
}

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/** Maximum flinch angle in radians at full intensity. ~5.7° — subtle. */
const MAX_ANGLE_RAD = 0.10;

/** How fast the flinch springs toward the target (rad/s). Higher = snappier. */
const ATTACK_SPEED = 18.0;

/** How fast the flinch decays back to zero (rad/s). */
const DECAY_SPEED = 8.0;

/** Below this angle the flinch is considered done and zeroed out. */
const EPSILON_RAD = 0.001;

/** Time (seconds) the flinch holds at peak before decaying. */
const HOLD_TIME = 0.06;

// ---------------------------------------------------------------------------
// Per-bone weight maps keyed by alias group name
// ---------------------------------------------------------------------------

/** Humanoid skeleton: spine chain gets the most, extremities taper off. */
const HUMANOID_WEIGHTS: Array<{ aliases: string[]; weight: number; axis: THREE.Vector3 }> = [
  { aliases: HIPS_ALIASES,         weight: 0.25, axis: new THREE.Vector3(1, 0, 0) },
  { aliases: SPINE_ALIASES,        weight: 0.50, axis: new THREE.Vector3(1, 0, 0) },
  { aliases: SPINE2_ALIASES,       weight: 0.70, axis: new THREE.Vector3(1, 0, 0) },
  { aliases: HEAD_ALIASES,         weight: 0.40, axis: new THREE.Vector3(1, 0, 0) },
  { aliases: SHOULDER_L_ALIASES,   weight: 0.20, axis: new THREE.Vector3(0, 0, 1) },
  { aliases: SHOULDER_R_ALIASES,   weight: 0.20, axis: new THREE.Vector3(0, 0, 1) },
  { aliases: UPPER_ARM_L_ALIASES,  weight: 0.15, axis: new THREE.Vector3(1, 0, 0) },
  { aliases: UPPER_ARM_R_ALIASES,  weight: 0.15, axis: new THREE.Vector3(1, 0, 0) },
  { aliases: LEFT_UP_LEG_ALIASES,  weight: 0.10, axis: new THREE.Vector3(1, 0, 0) },
  { aliases: RIGHT_UP_LEG_ALIASES, weight: 0.10, axis: new THREE.Vector3(1, 0, 0) },
];

/** Quadruped: Body bone is the main reactor, legs absorb a little. */
const QUADRUPED_BONE_NAMES = [
  { names: ["Body", "body", "Spine", "spine"],   weight: 0.60, axis: new THREE.Vector3(1, 0, 0) },
  { names: ["Hips", "hips", "Back", "back"],     weight: 0.35, axis: new THREE.Vector3(1, 0, 0) },
  { names: ["Head", "head", "Neck", "neck"],     weight: 0.45, axis: new THREE.Vector3(1, 0, 0) },
  { names: ["Tail1", "tail1"],                   weight: 0.20, axis: new THREE.Vector3(1, 0, 0) },
  { names: ["FrontLeg.R", "FrontLeg.L"],         weight: 0.10, axis: new THREE.Vector3(0, 0, 1) },
  { names: ["BackLeg.R", "BackLeg.L"],           weight: 0.10, axis: new THREE.Vector3(0, 0, 1) },
];

// Scratch quaternion for the per-bone rotation delta.
const _flinchQ = new THREE.Quaternion();
const _impactLocal = new THREE.Vector3();
const _parentWorldQ = new THREE.Quaternion();
const _parentWorldQInv = new THREE.Quaternion();

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------
export class ImpactFlinchController {
  private bones: FlinchBone[] = [];
  private holdTimer = 0;
  private active = false;
  private scene: THREE.Object3D;

  constructor(scene: THREE.Object3D) {
    this.scene = scene;
    this.discoverBones();
  }

  /** Re-scan the skeleton. Call if the scene is swapped (character change). */
  rebuild(scene: THREE.Object3D): void {
    this.scene = scene;
    this.bones = [];
    this.active = false;
    this.holdTimer = 0;
    this.discoverBones();
  }

  // ── Discovery ────────────────────────────────────────────────────────────

  private discoverBones(): void {
    // Collect all bone names to detect rig type.
    const boneNames: string[] = [];
    this.scene.traverse((n) => {
      if ((n as THREE.Bone).isBone || n.type === "Bone") boneNames.push(n.name);
    });

    if (boneNames.length === 0) return; // static mesh, no skeleton

    // Try humanoid aliases first.
    const humanoidBones = this.tryHumanoid();
    if (humanoidBones.length >= 3) {
      this.bones = humanoidBones;
      return;
    }

    // Try quadruped name matching.
    const quadBones = this.tryQuadruped();
    if (quadBones.length >= 1) {
      this.bones = quadBones;
      return;
    }

    // Fallback: just use the root bone.
    const rootBone = this.findFirstBone();
    if (rootBone) {
      this.bones = [{
        bone: rootBone,
        weight: 0.40,
        axis: new THREE.Vector3(1, 0, 0),
        currentAngle: 0,
        targetAngle: 0,
        preQ: new THREE.Quaternion(),
      }];
    }
  }

  private tryHumanoid(): FlinchBone[] {
    const result: FlinchBone[] = [];
    for (const entry of HUMANOID_WEIGHTS) {
      const bone = findBoneByAlias(this.scene, entry.aliases);
      if (bone) {
        result.push({
          bone,
          weight: entry.weight,
          axis: entry.axis.clone(),
          currentAngle: 0,
          targetAngle: 0,
          preQ: new THREE.Quaternion(),
        });
      }
    }
    return result;
  }

  private tryQuadruped(): FlinchBone[] {
    const result: FlinchBone[] = [];
    for (const entry of QUADRUPED_BONE_NAMES) {
      for (const name of entry.names) {
        let found: THREE.Object3D | null = null;
        this.scene.traverse((n) => {
          if (!found && n.name === name) found = n;
        });
        if (found) {
          result.push({
            bone: found,
            weight: entry.weight,
            axis: entry.axis.clone(),
            currentAngle: 0,
            targetAngle: 0,
            preQ: new THREE.Quaternion(),
          });
          break; // take first match from each entry
        }
      }
    }
    return result;
  }

  private findFirstBone(): THREE.Object3D | null {
    let first: THREE.Object3D | null = null;
    this.scene.traverse((n) => {
      if (!first && ((n as THREE.Bone).isBone || n.type === "Bone")) first = n;
    });
    return first;
  }

  // ── API ──────────────────────────────────────────────────────────────────

  /**
   * Trigger a flinch from an impact direction.
   *
   * @param impactWorldDir — Normalized world-space direction FROM attacker TO target.
   *   The flinch rotates bones "away from" this vector.
   * @param intensity — 0–1 scalar. 0.3 = light poke, 0.7 = heavy hit, 1.0 = max.
   *   Values above 1 are clamped internally.
   */
  trigger(impactWorldDir: THREE.Vector3, intensity: number): void {
    if (this.bones.length === 0) return;

    const clampedIntensity = Math.min(Math.max(intensity, 0), 1);
    this.holdTimer = HOLD_TIME;
    this.active = true;

    for (const entry of this.bones) {
      // Transform impact direction into the bone's local space so the
      // flinch axis is meaningful regardless of the character's world-space
      // facing. We project the local impact onto the bone's configured axis
      // to get a signed angle: positive = flinch "backward" (away from hit),
      // negative would flinch into the hit which we skip.
      entry.bone.updateWorldMatrix(true, false);
      if (entry.bone.parent) {
        entry.bone.parent.getWorldQuaternion(_parentWorldQ);
        _parentWorldQInv.copy(_parentWorldQ).invert();
      } else {
        _parentWorldQInv.identity();
      }

      _impactLocal.copy(impactWorldDir).applyQuaternion(_parentWorldQInv);
      const dot = _impactLocal.dot(entry.axis);

      // The flinch sign: positive dot means the impact pushes "along" the
      // bone's flinch axis, so we rotate in the positive direction. The
      // magnitude is the projection strength × weight × intensity.
      const sign = dot >= 0 ? 1 : -1;
      const projection = Math.abs(dot);

      entry.targetAngle = sign * MAX_ANGLE_RAD * entry.weight * clampedIntensity * Math.max(projection, 0.3);
    }
  }

  /**
   * Tick the flinch. Call every frame from useFrame AFTER the animation
   * mixer has been updated so the flinch layers on top of the current pose.
   */
  update(delta: number): void {
    if (!this.active) return;

    let anyActive = false;

    // Hold phase: wait before decaying.
    if (this.holdTimer > 0) {
      this.holdTimer -= delta;
    }

    for (const entry of this.bones) {
      // Snapshot the current (animation-driven) quaternion.
      entry.preQ.copy(entry.bone.quaternion);

      if (this.holdTimer > 0) {
        // Attack phase: spring toward target.
        const diff = entry.targetAngle - entry.currentAngle;
        const step = ATTACK_SPEED * delta;
        if (Math.abs(diff) < step) {
          entry.currentAngle = entry.targetAngle;
        } else {
          entry.currentAngle += Math.sign(diff) * step;
        }
      } else {
        // Decay phase: spring back to 0.
        const step = DECAY_SPEED * delta;
        if (Math.abs(entry.currentAngle) < step) {
          entry.currentAngle = 0;
        } else {
          entry.currentAngle -= Math.sign(entry.currentAngle) * step;
        }
      }

      // Apply the additive rotation.
      if (Math.abs(entry.currentAngle) > EPSILON_RAD) {
        _flinchQ.setFromAxisAngle(entry.axis, entry.currentAngle);
        entry.bone.quaternion.multiply(_flinchQ);
        anyActive = true;
      }
    }

    if (!anyActive) {
      this.active = false;
    }
  }

  /** True while any bone is still displaced from its rest pose. */
  get isActive(): boolean {
    return this.active;
  }

  /** Clean up references. Call on unmount. */
  dispose(): void {
    this.bones = [];
    this.active = false;
  }
}

// ---------------------------------------------------------------------------
// Convenience: compute intensity from damage amount + max health
// ---------------------------------------------------------------------------

/**
 * Maps a raw damage number to a 0–1 flinch intensity.
 *
 *   damage / maxHealth    → intensity
 *   ≤ 2%                  → 0.15  (tiny poke)
 *   5%                    → 0.30
 *   10%                   → 0.50
 *   25%                   → 0.75
 *   ≥ 50%                 → 1.00  (massive hit, capped)
 *
 * The curve is a simple sqrt so small hits still read visibly.
 */
export function damageToFlinchIntensity(damage: number, maxHealth: number): number {
  if (maxHealth <= 0) return 0;
  const ratio = Math.min(damage / maxHealth, 0.5);
  // sqrt(ratio / 0.5) maps [0, 0.5] → [0, 1] with an aggressive curve
  // that gives small hits more visibility.
  return Math.sqrt(ratio / 0.5);
}
