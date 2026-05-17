/**
 * RagdollBlendLayer — Layer 4 of the Character Prefab system.
 *
 * Partial ragdoll using 8 key bones from the Bip001 skeleton.
 * Blends between animation-driven and physics-driven bone transforms
 * using a weight factor (0 = full animation, 1 = full physics).
 *
 * Transition presets:
 *   death     → ramp to 1.0 over 0.3s, freeze after 2s
 *   heavyHit  → spike to 0.6, lerp back over 0.5s
 *   knockback → ramp to 0.8, lerp back on land
 *   landImpact→ brief 0.2 spike for weight feel
 *
 * The ragdoll bodies are only created when first needed (lazy init)
 * to avoid the cost for characters that never take ragdoll damage.
 */

import * as THREE from "three";
import { RAGDOLL_BONES, RAGDOLL_PRESETS } from "./constants";
import type { RagdollPreset } from "./types";

// ---------------------------------------------------------------------------
// Per-bone ragdoll state
// ---------------------------------------------------------------------------

interface RagdollBoneState {
  boneName: string;
  bone: THREE.Bone | THREE.Object3D;
  /** Rapier rigid body for this bone (null until lazy init). */
  body: any | null;
  /** Snapshot of animation-driven world position. */
  animPosition: THREE.Vector3;
  /** Snapshot of animation-driven world quaternion. */
  animQuaternion: THREE.Quaternion;
  /** Physics-driven world position (from Rapier body). */
  physPosition: THREE.Vector3;
  /** Physics-driven world quaternion. */
  physQuaternion: THREE.Quaternion;
  /** Final blended local position written back to the bone. */
  blendedPosition: THREE.Vector3;
  /** Final blended local quaternion written back to the bone. */
  blendedQuaternion: THREE.Quaternion;
}

// ---------------------------------------------------------------------------
// Transition state machine
// ---------------------------------------------------------------------------

interface TransitionState {
  preset: RagdollPreset;
  targetWeight: number;
  rampUp: number;
  holdTime: number;
  rampDown: number;
  /** Elapsed time since transition started. */
  elapsed: number;
  /** Phase: rampUp → hold → rampDown → done */
  phase: "rampUp" | "hold" | "rampDown" | "done";
}

// ---------------------------------------------------------------------------
// RagdollBlendLayer
// ---------------------------------------------------------------------------

export class RagdollBlendLayer {
  /** Current blend weight: 0 = animation, 1 = physics. */
  weight = 0;

  /** Per-bone state (populated on init). */
  private bones: RagdollBoneState[] = [];
  /** Whether ragdoll bodies have been lazily created. */
  private initialized = false;
  /** Active transition. */
  private transition: TransitionState | null = null;
  /** Frozen flag — after death, stop updating. */
  private frozen = false;

  // Temp vectors for blending
  private tmpPos = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();

  /**
   * Discover ragdoll bones from the model skeleton.
   * Call once after the model is loaded. Does NOT create physics bodies yet.
   */
  discoverBones(model: THREE.Object3D) {
    this.bones = [];

    for (const def of RAGDOLL_BONES) {
      const bone = model.getObjectByName(def.boneName);
      if (!bone) {
        // Try fuzzy match (spaces vs underscores, case)
        let found: THREE.Object3D | null = null;
        const lower = def.boneName.toLowerCase().replace(/\s+/g, "");
        model.traverse((child) => {
          if (!found && child.name.toLowerCase().replace(/\s+/g, "") === lower) {
            found = child;
          }
        });
        if (!found) continue;
        this.bones.push(this.createBoneState(def.boneName, found));
      } else {
        this.bones.push(this.createBoneState(def.boneName, bone));
      }
    }
  }

  private createBoneState(name: string, bone: THREE.Object3D): RagdollBoneState {
    return {
      boneName: name,
      bone,
      body: null,
      animPosition: new THREE.Vector3(),
      animQuaternion: new THREE.Quaternion(),
      physPosition: new THREE.Vector3(),
      physQuaternion: new THREE.Quaternion(),
      blendedPosition: new THREE.Vector3(),
      blendedQuaternion: new THREE.Quaternion(),
    };
  }

  /**
   * Lazily create Rapier rigid bodies for each ragdoll bone.
   * Called on first ragdoll trigger to avoid the cost for characters
   * that never enter ragdoll states.
   */
  initPhysics(world: any, RAPIER: any, modelWorldPos: THREE.Vector3) {
    if (this.initialized) return;
    this.initialized = true;

    for (let i = 0; i < this.bones.length; i++) {
      const boneState = this.bones[i];
      const def = RAGDOLL_BONES[i];
      if (!def) continue;

      // Get bone world position
      boneState.bone.updateMatrixWorld(true);
      const worldPos = new THREE.Vector3();
      boneState.bone.getWorldPosition(worldPos);

      // Create dynamic body at bone world position
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(worldPos.x, worldPos.y, worldPos.z)
        .setLinearDamping(2.0)
        .setAngularDamping(2.0);
      const body = world.createRigidBody(bodyDesc);

      // Create collider based on shape
      let colliderDesc: any;
      if (def.shape === "capsule") {
        colliderDesc = RAPIER.ColliderDesc.capsule(def.dimensions[0], def.dimensions[1]);
      } else if (def.shape === "sphere") {
        colliderDesc = RAPIER.ColliderDesc.ball(def.dimensions[0]);
      } else {
        colliderDesc = RAPIER.ColliderDesc.capsule(0.1, 0.05);
      }
      colliderDesc.setMass(def.mass);
      world.createCollider(colliderDesc, body);

      // Disable gravity initially (activated during ragdoll transitions)
      body.setGravityScale(0, false);

      boneState.body = body;
    }

    // Create joints between parent-child bone pairs
    for (let i = 0; i < this.bones.length; i++) {
      const def = RAGDOLL_BONES[i];
      if (!def?.parent) continue;

      const childState = this.bones[i];
      const parentState = this.bones.find((b) => b.boneName === def.parent);
      if (!childState.body || !parentState?.body) continue;

      // Spherical joint at the child bone position
      const anchor1 = { x: 0, y: 0, z: 0 };
      const anchor2 = { x: 0, y: 0, z: 0 };

      const jointData = RAPIER.JointData.spherical(anchor1, anchor2);
      world.createImpulseJoint(jointData, parentState.body, childState.body, true);
    }
  }

  // -----------------------------------------------------------------------
  // Transition triggers
  // -----------------------------------------------------------------------

  /**
   * Start a ragdoll transition preset.
   */
  trigger(preset: RagdollPreset, world?: any, RAPIER?: any, modelWorldPos?: THREE.Vector3) {
    if (preset === "none") {
      this.transition = null;
      this.weight = 0;
      return;
    }

    // Lazy-init physics bodies on first ragdoll trigger
    if (!this.initialized && world && RAPIER && modelWorldPos) {
      this.initPhysics(world, RAPIER, modelWorldPos);
    }

    const params = RAGDOLL_PRESETS[preset];
    this.transition = {
      preset,
      targetWeight: params.targetWeight,
      rampUp: params.rampUp,
      holdTime: params.holdTime,
      rampDown: params.rampDown,
      elapsed: 0,
      phase: "rampUp",
    };
    this.frozen = false;

    // Enable gravity on ragdoll bodies during transition
    if (this.initialized) {
      const gravScale = preset === "death" ? 1.0 : 0.5;
      for (const bs of this.bones) {
        if (bs.body) bs.body.setGravityScale(gravScale, true);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Per-frame update
  // -----------------------------------------------------------------------

  /**
   * Update ragdoll blend. Call every frame AFTER AnimationMixer.update()
   * and BEFORE rendering.
   *
   * 1. Snapshot animation-driven bone transforms
   * 2. Read physics-driven transforms from Rapier bodies
   * 3. Lerp between them based on weight
   * 4. Write blended transforms back to bones
   */
  update(dt: number) {
    if (this.frozen || this.bones.length === 0) return;

    // Advance transition
    this.advanceTransition(dt);

    // Early out if weight is 0 (pure animation)
    if (this.weight <= 0.001) return;

    for (const bs of this.bones) {
      // 1. Snapshot animation-driven transforms (already applied by mixer)
      bs.bone.getWorldPosition(bs.animPosition);
      bs.bone.getWorldQuaternion(bs.animQuaternion);

      // 2. Read physics-driven transforms
      if (bs.body) {
        const t = bs.body.translation();
        bs.physPosition.set(t.x, t.y, t.z);
        const r = bs.body.rotation();
        bs.physQuaternion.set(r.x, r.y, r.z, r.w);
      } else {
        // No physics body — use animation as fallback
        bs.physPosition.copy(bs.animPosition);
        bs.physQuaternion.copy(bs.animQuaternion);
      }

      // 3. Lerp between animation and physics
      this.tmpPos.lerpVectors(bs.animPosition, bs.physPosition, this.weight);
      this.tmpQuat.slerpQuaternions(bs.animQuaternion, bs.physQuaternion, this.weight);

      // 4. Convert back to local space and write to bone
      if (bs.bone.parent) {
        const parentInv = new THREE.Matrix4();
        bs.bone.parent.updateMatrixWorld(true);
        parentInv.copy(bs.bone.parent.matrixWorld).invert();

        const worldMat = new THREE.Matrix4().compose(this.tmpPos, this.tmpQuat, bs.bone.scale);
        const localMat = worldMat.premultiply(parentInv);

        localMat.decompose(bs.blendedPosition, bs.blendedQuaternion, bs.bone.scale);
        bs.bone.position.copy(bs.blendedPosition);
        bs.bone.quaternion.copy(bs.blendedQuaternion);
      }

      // 5. Sync physics body to animation when weight < 1
      // (keeps ragdoll bodies near animation pose during partial blend)
      if (bs.body && this.weight < 0.95) {
        const syncPos = this.tmpPos;
        bs.body.setTranslation({ x: syncPos.x, y: syncPos.y, z: syncPos.z }, true);
      }
    }
  }

  private advanceTransition(dt: number) {
    if (!this.transition) return;
    const t = this.transition;
    t.elapsed += dt;

    switch (t.phase) {
      case "rampUp": {
        if (t.rampUp <= 0) {
          this.weight = t.targetWeight;
          t.phase = "hold";
          t.elapsed = 0;
        } else {
          const progress = Math.min(t.elapsed / t.rampUp, 1);
          this.weight = t.targetWeight * progress;
          if (progress >= 1) {
            t.phase = "hold";
            t.elapsed = 0;
          }
        }
        break;
      }
      case "hold": {
        this.weight = t.targetWeight;
        if (t.elapsed >= t.holdTime) {
          if (t.rampDown <= 0) {
            // No ramp down — stay at target (death)
            t.phase = "done";
            if (t.preset === "death") this.frozen = true;
          } else {
            t.phase = "rampDown";
            t.elapsed = 0;
          }
        }
        break;
      }
      case "rampDown": {
        const progress = Math.min(t.elapsed / t.rampDown, 1);
        this.weight = t.targetWeight * (1 - progress);
        if (progress >= 1) {
          this.weight = 0;
          t.phase = "done";
          this.transition = null;
          // Disable gravity on ragdoll bodies
          for (const bs of this.bones) {
            if (bs.body) bs.body.setGravityScale(0, false);
          }
        }
        break;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  get isActive(): boolean {
    return this.weight > 0.001;
  }

  get isFrozen(): boolean {
    return this.frozen;
  }

  get boneCount(): number {
    return this.bones.length;
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  dispose(world?: any) {
    if (world) {
      for (const bs of this.bones) {
        if (bs.body) {
          try { world.removeRigidBody(bs.body); } catch { /* ignore */ }
        }
      }
    }
    this.bones = [];
    this.initialized = false;
    this.transition = null;
    this.frozen = false;
    this.weight = 0;
  }
}
