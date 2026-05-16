/**
 * CharacterBody — Layer 3 of the Character Prefab system.
 *
 * Imperative physics controller wrapping:
 *   - MovementController (input → world direction)
 *   - Rapier capsule collider (auto-sized from skeleton bounds)
 *   - Kinematic ↔ dynamic mode switching (for ragdoll/knockback)
 *   - Ground detection via raycast
 *   - Velocity tracking from position delta
 *
 * Non-React — drives the Rapier world directly. For R3F integration,
 * the CharacterPrefab exposes a React component wrapper.
 */

import * as THREE from "three";
import { MovementController, type MovementInput, type MovementResult } from "../../controllers/MovementController";
import type { SkeletonBounds, PhysicsMode } from "./types";
import { SPEED, DEFAULT_CAPSULE, COLLISION_GROUPS, PLAYER_INTERACTION_GROUPS, ENEMY_INTERACTION_GROUPS } from "./constants";

// ---------------------------------------------------------------------------
// Rapier type stubs — we reference these structurally so the prefab system
// doesn't hard-depend on @dimforge/rapier3d-compat at the type level.
// Actual Rapier values are passed in via init().
// ---------------------------------------------------------------------------

interface RapierWorld {
  castRay(ray: any, maxToi: number, solid: boolean, filterFlags?: number, filterGroups?: number): any;
  createRigidBody(desc: any): any;
  createCollider(desc: any, parent: any): any;
  removeRigidBody(body: any): void;
}

interface RapierBody {
  setNextKinematicTranslation(pos: { x: number; y: number; z: number }): void;
  setBodyType(type: number, wakeUp: boolean): void;
  setGravityScale(scale: number, wakeUp: boolean): void;
  setLinvel(vel: { x: number; y: number; z: number }, wakeUp: boolean): void;
  applyImpulse(impulse: { x: number; y: number; z: number }, wakeUp: boolean): void;
  translation(): { x: number; y: number; z: number };
}

// ---------------------------------------------------------------------------
// CharacterBody
// ---------------------------------------------------------------------------

export class CharacterBody {
  /** Movement controller (input → world direction). */
  movement: MovementController;

  /** Current world position. */
  position: THREE.Vector3;
  /** Derived velocity (position delta per frame). */
  velocity: THREE.Vector3;
  /** Current facing angle (Y rotation). */
  facingAngle = 0;

  /** Ground detection flag. */
  isGrounded = true;
  /** Current physics mode. */
  physicsMode: PhysicsMode = "kinematic";

  /** Capsule dimensions derived from skeleton bounds. */
  capsuleHalfHeight: number;
  capsuleRadius: number;

  /** Whether this body belongs to a player (vs enemy/NPC). */
  isPlayer: boolean;

  // Rapier references — null until init() is called with a Rapier world
  private rapierBody: RapierBody | null = null;
  private rapierWorld: RapierWorld | null = null;

  // For velocity calculation
  private prevPosition = new THREE.Vector3();

  // Speed modifiers from stats. Explicitly typed as `number` so setBaseSpeed()
  // can assign any number to it (SPEED.RUN is literal type `5` from `as const`).
  private baseSpeed: number = SPEED.RUN;
  private sprintMultiplier: number = 1.6;

  constructor(bounds: SkeletonBounds, isPlayer: boolean, spawnPos?: THREE.Vector3) {
    this.movement = new MovementController();
    this.isPlayer = isPlayer;

    // Capsule sizing from skeleton bounds
    const h = Math.max(0.4, bounds.height);
    const r = THREE.MathUtils.clamp(bounds.radiusXZ, 0.15, 0.6);
    this.capsuleHalfHeight = Math.max(0.05, (h - 2 * r) / 2);
    this.capsuleRadius = r;

    this.position = spawnPos?.clone() ?? new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.prevPosition.copy(this.position);
  }

  /**
   * Initialize the Rapier physics body. Called once the Rapier world is available.
   * If Rapier isn't available (e.g. in a preview/editor), the body works in
   * position-only mode without physics.
   */
  initRapier(world: RapierWorld, RAPIER: any) {
    this.rapierWorld = world;

    const bodyDesc = RAPIER.RigidBodyDesc
      .kinematicPositionBased()
      .setTranslation(this.position.x, this.position.y, this.position.z);

    this.rapierBody = world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc
      .capsule(this.capsuleHalfHeight, this.capsuleRadius)
      .setTranslation(0, this.capsuleHalfHeight + this.capsuleRadius, 0)
      .setFriction(0.4)
      .setRestitution(0.0);

    const groups = this.isPlayer ? PLAYER_INTERACTION_GROUPS : ENEMY_INTERACTION_GROUPS;
    colliderDesc.setCollisionGroups(groups);

    world.createCollider(colliderDesc, this.rapierBody);
  }

  // -----------------------------------------------------------------------
  // Per-frame update
  // -----------------------------------------------------------------------

  /**
   * Update movement, physics, and ground detection.
   * Called once per frame by CharacterPrefab.update().
   *
   * @param dt Delta time in seconds
   * @param input Movement input (WASD/gamepad)
   * @param cameraYaw Camera yaw angle for camera-relative movement
   * @param isSprinting Whether sprint key is held
   */
  update(dt: number, input: MovementInput, cameraYaw: number, isSprinting: boolean): MovementResult {
    // 1. Compute world-space move direction
    const moveResult = this.movement.computeMoveDir(input, cameraYaw);

    // 2. Apply speed
    const speed = isSprinting ? this.baseSpeed * this.sprintMultiplier : this.baseSpeed;
    if (moveResult.isMoving && this.physicsMode === "kinematic") {
      const dx = moveResult.direction.x * speed * dt;
      const dz = moveResult.direction.z * speed * dt;
      this.position.x += dx;
      this.position.z += dz;

      // Update facing
      this.facingAngle = MovementController.facingFromDir(moveResult.direction);
    }

    // 3. Gravity (simple, when not kinematic-grounded)
    if (this.physicsMode === "kinematic" && !this.isGrounded) {
      this.position.y -= 9.81 * dt * dt * 0.5; // simple gravity approximation
    }

    // 4. Sync to Rapier
    if (this.rapierBody && this.physicsMode === "kinematic") {
      this.rapierBody.setNextKinematicTranslation({
        x: this.position.x,
        y: this.position.y,
        z: this.position.z,
      });
    } else if (this.rapierBody && this.physicsMode === "dynamic") {
      // In dynamic mode, read position FROM Rapier
      const t = this.rapierBody.translation();
      this.position.set(t.x, t.y, t.z);
    }

    // 5. Compute velocity from position delta
    this.velocity.subVectors(this.position, this.prevPosition).divideScalar(Math.max(dt, 0.001));
    this.prevPosition.copy(this.position);

    return moveResult;
  }

  // -----------------------------------------------------------------------
  // Physics mode switching
  // -----------------------------------------------------------------------

  /**
   * Switch between kinematic and dynamic mode.
   * Dynamic mode enables gravity and physics forces (for ragdoll/knockback).
   */
  setPhysicsMode(mode: PhysicsMode, RAPIER?: any) {
    if (mode === this.physicsMode) return;
    this.physicsMode = mode;

    if (!this.rapierBody || !RAPIER) return;

    if (mode === "dynamic") {
      this.rapierBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      this.rapierBody.setGravityScale(1.0, true);
    } else {
      this.rapierBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      this.rapierBody.setGravityScale(0, true);
      // Snap position to current
      this.rapierBody.setNextKinematicTranslation({
        x: this.position.x,
        y: this.position.y,
        z: this.position.z,
      });
    }
  }

  /**
   * Apply a physics impulse (knockback, launch, etc.).
   * Automatically switches to dynamic mode if needed.
   */
  applyImpulse(impulse: THREE.Vector3, RAPIER?: any) {
    if (this.physicsMode !== "dynamic") {
      this.setPhysicsMode("dynamic", RAPIER);
    }
    if (this.rapierBody) {
      this.rapierBody.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
    }
  }

  // -----------------------------------------------------------------------
  // Speed configuration
  // -----------------------------------------------------------------------

  setBaseSpeed(speed: number) { this.baseSpeed = speed; }
  setSprintMultiplier(mult: number) { this.sprintMultiplier = mult; }

  /** Current horizontal speed magnitude (for locomotion blend). */
  get horizontalSpeed(): number {
    return Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
  }

  // -----------------------------------------------------------------------
  // Ground detection (simple raycast placeholder)
  // -----------------------------------------------------------------------

  /**
   * Perform ground detection. Sets isGrounded flag.
   * In full integration, this uses Rapier raycast; here it's a height check.
   */
  checkGround(terrainHeight = 0) {
    const groundThreshold = 0.1;
    this.isGrounded = this.position.y <= terrainHeight + groundThreshold;
    if (this.isGrounded && this.position.y < terrainHeight) {
      this.position.y = terrainHeight;
    }
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  dispose() {
    if (this.rapierWorld && this.rapierBody) {
      this.rapierWorld.removeRigidBody(this.rapierBody as any);
    }
    this.rapierBody = null;
    this.rapierWorld = null;
  }
}
