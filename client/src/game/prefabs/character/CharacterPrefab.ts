/**
 * CharacterPrefab — Unified character factory for all 6 races.
 *
 * Wires together:
 *   Layer 1: CharacterSkeleton (model, equipment, bones, bounds)
 *   Layer 2: CharacterAnimator (locomotion blend, combat one-shots, additive)
 *   Layer 3: CharacterBody    (Rapier capsule, movement, physics modes)
 *   Layer 4: RagdollBlendLayer(partial ragdoll, animation↔physics blend)
 *   Layer 5: CharacterCombat  (XState FSM, stats, weapon restrictions, hotbar)
 *
 * Usage:
 *   const hero = CharacterPrefab.fromModel(loadedModel, {
 *     race: 'elf', faction: 'fabled', class: 'ranger',
 *     isPlayer: true, tier: 3,
 *     attributes: { STR: 15, DEX: 30, INT: 20, VIT: 25, WIS: 15, LCK: 20, CHA: 15, END: 20 }
 *   });
 *   scene.add(hero.model);
 *   // Per frame:
 *   hero.update(dt, input, cameraYaw);
 *
 * The same class works for AI companions (Gouldstone clones) — set isPlayer: false
 * and feed AI-generated input instead of keyboard input.
 */

import * as THREE from "three";
import { CharacterSkeleton } from "./CharacterSkeleton";
import { CharacterAnimator } from "./CharacterAnimator";
import { CharacterBody } from "./CharacterBody";
import { RagdollBlendLayer } from "./RagdollBlendLayer";
import { CharacterCombat } from "./CharacterCombat";
import type { PrefabConfig, PrefabWeaponType, DamageEvent, RagdollPreset } from "./types";
import { DEFAULT_STATS } from "./types";
import type { MovementInput } from "../../controllers/MovementController";
import type { CombatEvent } from "../../machines/combatMachine";

export class CharacterPrefab {
  /** The prefab config this character was built with. */
  readonly config: PrefabConfig;

  /** Layer 1 — skeleton, equipment, bones, bounds. */
  skeleton: CharacterSkeleton;
  /** Layer 2 — animation mixer, locomotion blend, combat one-shots. */
  animator: CharacterAnimator;
  /** Layer 3 — physics capsule, movement, mode switching. */
  body: CharacterBody;
  /** Layer 4 — partial ragdoll blend. */
  ragdoll: RagdollBlendLayer;
  /** Layer 5 — combat FSM, stats, weapon restrictions. */
  combat: CharacterCombat;

  /** Convenience: the model root (same as skeleton.model). */
  get model(): THREE.Group { return this.skeleton.model; }

  /** Whether this prefab has been disposed. */
  private disposed = false;
  /** Previous combat state (for animation transitions). */
  private prevCombatState = "idle";
  /** Charge timer for charge-attack tracking. */
  private chargeTimer = 0;

  // -----------------------------------------------------------------------
  // Construction
  // -----------------------------------------------------------------------

  private constructor(config: PrefabConfig) {
    this.config = config;
    // Layers initialized in fromModel() — these are set by the factory.
    this.skeleton = null!;
    this.animator = null!;
    this.body = null!;
    this.ragdoll = null!;
    this.combat = null!;
  }

  /**
   * Create a CharacterPrefab from an already-loaded Three.js model.
   * The model should be a cloned instance (not the shared cache original).
   *
   * This is synchronous — model loading happens externally (via useAsset,
   * GLTFLoader, FBXLoader, etc). The prefab only wires the layers.
   */
  static fromModel(loadedModel: THREE.Group, config: PrefabConfig): CharacterPrefab {
    const prefab = new CharacterPrefab(config);
    const attrs = config.attributes ?? DEFAULT_STATS;
    const scale = config.scale ?? 1;

    // Layer 1: Skeleton
    prefab.skeleton = CharacterSkeleton.fromLoadedModel(loadedModel, config.race);

    // Apply scale
    if (scale !== 1) {
      loadedModel.scale.setScalar(scale);
      prefab.skeleton.bounds.height *= scale;
      prefab.skeleton.bounds.radiusXZ *= scale;
    }

    // Layer 2: Animator
    prefab.animator = new CharacterAnimator(loadedModel);
    // Register any embedded clips from the model
    const embeddedClips: THREE.AnimationClip[] = [];
    loadedModel.traverse((child) => {
      if ((child as any).animations) {
        embeddedClips.push(...(child as any).animations);
      }
    });
    if ((loadedModel as any).animations) {
      embeddedClips.push(...(loadedModel as any).animations);
    }
    if (embeddedClips.length > 0) {
      prefab.animator.registerClips(embeddedClips);
    }

    // Layer 3: Body
    prefab.body = new CharacterBody(
      prefab.skeleton.bounds,
      config.isPlayer,
      config.spawnPosition,
    );

    // Layer 4: Ragdoll
    prefab.ragdoll = new RagdollBlendLayer();
    prefab.ragdoll.discoverBones(loadedModel);

    // Layer 5: Combat
    prefab.combat = new CharacterCombat(config.class, attrs, config.tier);

    // Wire combat state changes → animation
    prefab.combat.onStateChange = (state, prev) => {
      prefab.onCombatStateChange(state, prev);
    };

    // Wire animation done → combat FSM ACTION_DONE
    prefab.animator.onActionDone = () => {
      prefab.combat.send({ type: "ACTION_DONE" });
    };

    // Apply stats-derived speed to body
    prefab.body.setBaseSpeed(prefab.combat.stats.moveSpeed);

    return prefab;
  }

  // -----------------------------------------------------------------------
  // Per-frame update
  // -----------------------------------------------------------------------

  /**
   * Main update loop — call once per frame.
   *
   * @param dt        Delta time in seconds
   * @param input     Movement input (WASD/gamepad/AI)
   * @param cameraYaw Camera yaw for camera-relative movement
   * @param isSprinting Whether sprint is held
   */
  update(dt: number, input: MovementInput, cameraYaw: number, isSprinting = false) {
    if (this.disposed) return;

    // 1. Combat update (regen, action timers)
    this.combat.update(dt);

    // 2. Charge timer tracking
    const combatState = this.combat.state;
    if (combatState === "charging") {
      this.chargeTimer += dt;
      if (this.chargeTimer >= 0.5) {
        this.combat.send({ type: "CHARGE_TIER_1" });
        this.chargeTimer = 0;
      }
    } else if (combatState === "charged1") {
      this.chargeTimer += dt;
      if (this.chargeTimer >= 0.5) {
        this.combat.send({ type: "CHARGE_TIER_2" });
        this.chargeTimer = 0;
      }
    } else {
      this.chargeTimer = 0;
    }

    // 3. Body update (movement + physics)
    const canMove = this.combat.canMove;
    const effectiveInput: MovementInput = canMove
      ? input
      : { forward: false, backward: false, left: false, right: false };
    const moveResult = this.body.update(dt, effectiveInput, cameraYaw, isSprinting);

    // 4. Ground detection
    this.body.checkGround();
    if (this.body.isGrounded && combatState === "falling") {
      this.combat.send({ type: "LANDED" });
    }

    // 5. Sync model position + rotation
    this.skeleton.model.position.copy(this.body.position);
    if (moveResult.isMoving && canMove) {
      this.skeleton.model.rotation.y = this.body.facingAngle;
    }

    // 6. Feed locomotion speed to animator
    this.animator.setLocomotionSpeed(this.body.horizontalSpeed);

    // 7. Animation update
    this.animator.update(dt);

    // 8. Ragdoll blend (after mixer, before render)
    this.ragdoll.update(dt);
  }

  // -----------------------------------------------------------------------
  // Combat state → animation bridge
  // -----------------------------------------------------------------------

  private onCombatStateChange(state: string, prev: string) {
    if (this.disposed) return;

    // States that should trigger one-shot animations
    const actionStates = [
      "attack1", "attack2", "attack3", "dashAttack", "counterStrike",
      "uppercut", "spinSlash", "risingSlash", "heavyAttack",
      "chargeAttack", "chargeAttackMax", "chargeFist", "chargeStrike",
      "skill1", "skill2", "skill3", "skill4", "skill5",
      "classAbility", "classAbility2", "classAbility3",
      "rolling", "pop", "jumpBash", "earthquake",
    ];

    // States that trigger looping animations
    const loopStates = ["blocking", "climbing", "dashing"];

    if (actionStates.includes(state)) {
      this.animator.playAction(state);
    } else if (loopStates.includes(state)) {
      this.animator.playLoop(state);
    } else if (state === "jumping" || state === "doubleJumping") {
      this.animator.playAction("jump");
    } else if (state === "falling") {
      this.animator.playLoop("fall");
    } else if (state === "idle" && prev !== "idle") {
      this.animator.returnToLocomotion();
    }

    this.prevCombatState = state;
  }

  // -----------------------------------------------------------------------
  // Public API — Equipment
  // -----------------------------------------------------------------------

  /**
   * Equip a weapon type. Validates class restrictions, updates hotbar.
   */
  equipWeapon(type: PrefabWeaponType, variant?: string): boolean {
    const ok = this.combat.equipWeapon(type);
    if (!ok) return false;

    // Toggle equipment mesh visibility
    const slotName = this.weaponTypeToSlot(type);
    if (slotName) {
      this.skeleton.equipment.equipWeapon(slotName, variant ?? "_default");
    }
    return true;
  }

  /**
   * Equip armor in a slot.
   */
  equipArmor(slot: string, variant: string) {
    this.skeleton.equipment.equip(slot, variant);
  }

  private weaponTypeToSlot(type: PrefabWeaponType): string | null {
    const map: Record<string, string> = {
      sword: "sword", axe: "axe", mace: "hammer", dagger: "sword",
      hammer: "hammer", staff: "staff", wand: "staff", bow: "bow",
      crossbow: "bow", gun: "bow", spear: "spear", polearm: "spear",
      shield: "shield", greatsword: "sword", fists: "",
    };
    return map[type] || null;
  }

  // -----------------------------------------------------------------------
  // Public API — Combat input
  // -----------------------------------------------------------------------

  /**
   * Send a combat event (player input or AI action).
   */
  sendCombatEvent(event: CombatEvent) {
    this.combat.send(event);
  }

  // -----------------------------------------------------------------------
  // Public API — Damage
  // -----------------------------------------------------------------------

  /**
   * Apply damage. Triggers appropriate ragdoll preset and hit animation.
   */
  takeDamage(event: DamageEvent) {
    const result = this.combat.takeDamage(event);

    // Trigger ragdoll
    if (result.ragdollPreset !== "none") {
      this.ragdoll.trigger(result.ragdollPreset as RagdollPreset);
    }

    // Apply knockback impulse
    if (result.ragdollPreset === "knockback" || result.ragdollPreset === "heavyHit") {
      const impulse = event.direction.clone().normalize().multiplyScalar(5);
      impulse.y = 2;
      this.body.applyImpulse(impulse);
    }

    // Play hit animation
    if (!result.isDead) {
      this.animator.playAction("hit");
    }

    return result;
  }

  /**
   * Kill the character — triggers death ragdoll.
   */
  die() {
    this.ragdoll.trigger("death");
    this.animator.playAction("death");
    this.body.setPhysicsMode("dynamic");
  }

  /**
   * Respawn at a position — resets all state.
   */
  respawn(position: THREE.Vector3) {
    this.combat.hp = this.combat.stats.maxHp;
    this.combat.stamina = this.combat.stats.maxStamina;
    this.combat.mana = this.combat.stats.maxMana;

    this.ragdoll.trigger("none");
    this.body.setPhysicsMode("kinematic");
    this.body.position.copy(position);
    this.skeleton.model.position.copy(position);

    this.animator.returnToLocomotion();
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    this.combat.dispose();
    this.animator.dispose();
    this.body.dispose();
    this.ragdoll.dispose();
    this.skeleton.dispose();
  }
}
