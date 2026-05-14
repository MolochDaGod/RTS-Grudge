/**
 * CombatPhysics — bridges combat state machine → Rapier impulses + VFX.
 *
 * Every combat state that deals damage or moves the player gets a physics
 * impulse and a VFX burst. Called from Player.tsx's useFrame when a combat
 * state transition fires. The rigid body ref is passed in so we can
 * applyImpulse() directly.
 *
 * Keybind reference (matches combatMachine.ts events):
 *   LMB          → attack1 → attack2 → attack3 → uppercut (combo chain)
 *   LMB hold     → charging → charged1 → charged2 → release
 *   RMB          → blocking (hold) / earthquake (airborne)
 *   LMB+RMB      → counterStrike (from block) / spinSlash (from attack2)
 *   Space         → jump → doubleJump
 *   LMB airborne  → jumpBash
 *   Shift         → dash → dashAttack (LMB during dash)
 *   Ctrl/Alt      → roll
 *   R             → classAbility (CLASS_ABILITY)
 *   E             → classAbility2 (CLASS_ABILITY_2)
 *   F             → classAbility3 (CLASS_ABILITY_3)
 *   X             → pop (Z-key battle cry / taunt)
 *   1-4           → skill1-4 (weapon mastery skills)
 *   5-7           → use item slots (consumables/deployables)
 *   Tab           → mode switch (combat ↔ harvest)
 *   C             → crouch/sneak toggle
 */

import * as THREE from "three";
import { vfx, VFXPresets } from "../vfx";
import { useFatigue, DRAIN_RATES } from "./FatigueSystem";
import type { ExtendedWeaponType, WeaponTier } from "./WeaponPrefabDatabase";
import { getTrailConfig, getWeaponSkillAnims } from "./WeaponPrefabWiring";
import { getWeaponVFX, emitCritHit, emitStatusVFX } from "../effects/SpellProjectileSystem";
import {
  spawnHexShield, spawnSparkExplosion, spawnSphereExplosion,
  spawnSplash, spawnCastCircle, spawnMagicOrb, spawnTornadoSpin,
  spawnRasengan, launchRasengan, spawnFireOrb,
  tickMeshVFX, type MeshVFXInstance,
} from "../effects/MeshVFXProjectiles";
import {
  applyEffect, tickEffects, isEntityCCd,
  type EffectId, type TickResult,
} from "./StatusEffectEngine";
import {
  getAttackMechanic, shouldActivateComboTiming,
  startComboTiming, tickComboTiming, releaseComboTiming, cancelComboTiming,
  getComboTimingState,
  startMagicCharge, tickMagicCharge, releaseMagicCharge, cancelMagicCharge,
  getMagicChargeState,
  startRangerDraw, tickRangerDraw, releaseRangerDraw, cancelRangerDraw,
  getRangerDrawState,
  isChargeWeapon, isDrawWeapon, isComboWeapon,
} from "./ComboTimingSystem";

// ---------------------------------------------------------------------------
// Impulse configs per combat state
// ---------------------------------------------------------------------------

export interface CombatImpulse {
  /** Forward impulse (along character facing) */
  forward: number;
  /** Upward impulse */
  up: number;
  /** Knockback applied to the target on hit */
  knockback: number;
  /** Whether this state consumes stamina */
  staminaCost: number;
  /** VFX preset to fire at hit point */
  vfxOnHit: string;
  /** VFX preset to fire at player position on state enter */
  vfxOnCast: string | null;
  /** Whether to show weapon trail during this state */
  showTrail: boolean;
}

const NO_VFX: CombatImpulse = { forward: 0, up: 0, knockback: 0, staminaCost: 0, vfxOnHit: "hitSparks", vfxOnCast: null, showTrail: false };

export const COMBAT_IMPULSES: Record<string, CombatImpulse> = {
  // ── Melee combo chain ──
  attack1:         { forward: 1.5, up: 0,   knockback: 2,   staminaCost: 0,               vfxOnHit: "hitSparks",     vfxOnCast: null,             showTrail: true },
  attack2:         { forward: 2.0, up: 0,   knockback: 2.5, staminaCost: 0,               vfxOnHit: "hitSparks",     vfxOnCast: null,             showTrail: true },
  attack3:         { forward: 2.5, up: 0,   knockback: 3,   staminaCost: 0,               vfxOnHit: "doubleSlash",   vfxOnCast: null,             showTrail: true },
  uppercut:        { forward: 1.0, up: 5,   knockback: 4,   staminaCost: 0,               vfxOnHit: "comboFinisher", vfxOnCast: "slashArc",       showTrail: true },

  // ── Charge attacks ──
  charging:        { forward: 0,   up: 0,   knockback: 0,   staminaCost: 0,               vfxOnHit: "hitSparks",     vfxOnCast: null,             showTrail: false },
  charged1:        { forward: 0,   up: 0,   knockback: 0,   staminaCost: 0,               vfxOnHit: "hitSparks",     vfxOnCast: "chargeGlow",     showTrail: false },
  charged2:        { forward: 0,   up: 0,   knockback: 0,   staminaCost: 0,               vfxOnHit: "hitSparks",     vfxOnCast: "chargeGlow",     showTrail: false },
  chargeAttack:    { forward: 4,   up: 0,   knockback: 5,   staminaCost: DRAIN_RATES.heavyFlat * 0.7, vfxOnHit: "comboFinisher", vfxOnCast: "chargeLunge", showTrail: true },
  chargeAttackMax: { forward: 6,   up: 0,   knockback: 8,   staminaCost: DRAIN_RATES.heavyFlat,       vfxOnHit: "comboFinisher", vfxOnCast: "chargeLunge", showTrail: true },
  chargeFist:      { forward: 3,   up: 2,   knockback: 5,   staminaCost: 0,               vfxOnHit: "comboFinisher", vfxOnCast: "slashArc",       showTrail: true },
  chargeStrike:    { forward: 5,   up: 0,   knockback: 7,   staminaCost: 0,               vfxOnHit: "comboFinisher", vfxOnCast: "slashArc",       showTrail: true },

  // ── Heavy / special melee ──
  heavyAttack:     { forward: 3,   up: 0,   knockback: 6,   staminaCost: DRAIN_RATES.heavyFlat, vfxOnHit: "groundSlam", vfxOnCast: "slashArc",    showTrail: true },
  counterStrike:   { forward: 2,   up: 0,   knockback: 4,   staminaCost: 0,               vfxOnHit: "perfectParry",  vfxOnCast: null,             showTrail: true },
  spinSlash:       { forward: 1,   up: 0,   knockback: 3,   staminaCost: 3,               vfxOnHit: "doubleSlash",   vfxOnCast: "slashArc",       showTrail: true },
  risingSlash:     { forward: 1,   up: 4,   knockback: 3,   staminaCost: 3,               vfxOnHit: "hitSparks",     vfxOnCast: "slashArc",       showTrail: true },
  dashAttack:      { forward: 6,   up: 0,   knockback: 4,   staminaCost: 0,               vfxOnHit: "hitSparks",     vfxOnCast: "slashArc",       showTrail: true },

  // ── Airborne attacks ──
  jumpBash:        { forward: 2,   up: -6,  knockback: 5,   staminaCost: DRAIN_RATES.jump, vfxOnHit: "groundSlam",   vfxOnCast: null,             showTrail: true },
  earthquake:      { forward: 0,   up: -12, knockback: 8,   staminaCost: DRAIN_RATES.jump * 2, vfxOnHit: "earthquakeWave", vfxOnCast: null,       showTrail: false },

  // ── Movement abilities ──
  dashing:         { forward: 8,   up: 0,   knockback: 0,   staminaCost: DRAIN_RATES.dodge, vfxOnHit: "hitSparks",   vfxOnCast: "dustPuff",       showTrail: false },
  rolling:         { forward: 5,   up: 0,   knockback: 0,   staminaCost: DRAIN_RATES.dodge, vfxOnHit: "hitSparks",   vfxOnCast: "dustPuff",       showTrail: false },
  jumping:         { forward: 0,   up: 7,   knockback: 0,   staminaCost: DRAIN_RATES.jump,  vfxOnHit: "hitSparks",   vfxOnCast: "dustPuff",       showTrail: false },
  doubleJumping:   { forward: 0,   up: 6,   knockback: 0,   staminaCost: DRAIN_RATES.jump,  vfxOnHit: "hitSparks",   vfxOnCast: null,             showTrail: false },

  // ── Blocking ──
  blocking:        { forward: 0,   up: 0,   knockback: 0,   staminaCost: 0,               vfxOnHit: "shieldBlock",   vfxOnCast: null,             showTrail: false },

  // ── Skills (weapon mastery hotbar 1-4) ──
  skill1:          { forward: 3,   up: 0,   knockback: 4,   staminaCost: 5,               vfxOnHit: "spellImpact",   vfxOnCast: "castSwirl",      showTrail: true },
  skill2:          { forward: 0,   up: 4,   knockback: 3,   staminaCost: 5,               vfxOnHit: "spellImpact",   vfxOnCast: "castSwirl",      showTrail: true },
  skill3:          { forward: 2,   up: 0,   knockback: 5,   staminaCost: 8,               vfxOnHit: "aoeRing",       vfxOnCast: "castSwirl",      showTrail: true },
  skill4:          { forward: 1,   up: 0,   knockback: 3,   staminaCost: 5,               vfxOnHit: "hitSparks",     vfxOnCast: null,             showTrail: true },
  skill5:          { forward: 2,   up: 0,   knockback: 4,   staminaCost: 6,               vfxOnHit: "spellImpact",   vfxOnCast: "castSwirl",      showTrail: true },

  // ── Class abilities (R, E, F) ──
  classAbility:    { forward: 4,   up: 0,   knockback: 6,   staminaCost: 10,              vfxOnHit: "fireBurst",     vfxOnCast: "castSwirl",      showTrail: true },
  classAbility2:   { forward: 0,   up: 0,   knockback: 0,   staminaCost: 8,               vfxOnHit: "healPulse",     vfxOnCast: "castSwirl",      showTrail: false },
  classAbility3:   { forward: 0,   up: 0,   knockback: 0,   staminaCost: 12,              vfxOnHit: "aoeRing",       vfxOnCast: "castSwirl",      showTrail: false },

  // ── Battle cry (X / Z-key) ──
  pop:             { forward: 0,   up: 0,   knockback: 0,   staminaCost: 0,               vfxOnHit: "hitSparks",     vfxOnCast: "buffAura",       showTrail: false },

  // ── Climbing ──
  climbing:        { forward: 0,   up: 0,   knockback: 0,   staminaCost: 0,               vfxOnHit: "hitSparks",     vfxOnCast: null,             showTrail: false },
};

// ---------------------------------------------------------------------------
// Apply impulse to player rigid body on combat state enter
// ---------------------------------------------------------------------------

/**
 * Apply the physics impulse for a combat state transition.
 * Call from Player.tsx when the combatMachine transitions.
 *
 * @param state       The new combat state name
 * @param rigidBody   Rapier RigidBody ref
 * @param facing      Character facing direction as [x, z] unit vector
 * @param position    Character world position
 * @param fatigueMult Speed multiplier from FatigueSystem (0.4–1.0)
 */
export function applyCombatImpulse(
  state: string,
  rigidBody: { applyImpulse: (impulse: { x: number; y: number; z: number }, wake: boolean) => void } | null,
  facing: [number, number],
  position: [number, number, number],
  fatigueMult: number = 1.0,
): void {
  const config = COMBAT_IMPULSES[state];
  if (!config || !rigidBody) return;

  // Apply forward + up impulse
  if (config.forward !== 0 || config.up !== 0) {
    const fwd = config.forward * fatigueMult;
    rigidBody.applyImpulse(
      { x: facing[0] * fwd, y: config.up * fatigueMult, z: facing[1] * fwd },
      true,
    );
  }

  // Drain stamina
  if (config.staminaCost > 0) {
    useFatigue.getState().tick(0, {
      sprinting: false, climbing: false, swimming: false,
      blocking: state === "blocking", idle: false,
    });
    // Use stamina directly for flat costs
    const { useSurvival } = require("@/lib/stores/useSurvival");
    useSurvival.getState().useStamina(config.staminaCost);
  }

  // Fire VFX on cast
  if (config.vfxOnCast) {
    emitCombatVFX(config.vfxOnCast, position, facing);
  }
}

// ---------------------------------------------------------------------------
// Mesh VFX spawning per combat state — call on state transitions
// ---------------------------------------------------------------------------

/** Active cast circle instance (disposed on state exit) */
let activeCastCircle: MeshVFXInstance | null = null;
/** Active rasengan instance (launched on release) */
let activeChargeOrb: MeshVFXInstance | null = null;

/**
 * Spawn mesh-based VFX for a combat state transition.
 * Call from Player.tsx alongside applyCombatImpulse.
 *
 * @param state       New combat state
 * @param prevState   Previous combat state (for cleanup)
 * @param scene       Three.js scene
 * @param position    Player world position
 * @param facing      Facing direction [x, z]
 * @param weaponType  Currently equipped weapon type
 * @param handBone    Right hand bone (for attached VFX)
 * @param targetPos   Current target position (for projectiles)
 */
export function spawnCombatMeshVFX(
  state: string,
  prevState: string,
  scene: THREE.Scene | THREE.Group,
  position: [number, number, number],
  facing: [number, number],
  weaponType: string,
  handBone: THREE.Object3D | null,
  targetPos: [number, number, number] | null,
): void {
  const dir3: [number, number, number] = [facing[0], 0, facing[1]];

  // Clean up previous state's persistent VFX
  if (prevState === "charging" || prevState === "charged1" || prevState === "charged2") {
    // Leaving charge states — dispose cast circle
    if (activeCastCircle) {
      activeCastCircle.remaining = 0.3; // fade out
      activeCastCircle = null;
    }
  }

  switch (state) {
    // ── Magic charge wind-up: cast circle under feet + orb in hand ──
    case "charging":
      if (isChargeWeapon(weaponType)) {
        activeCastCircle = spawnCastCircle(scene, position, { element: "arcane" });
        if (handBone) {
          activeChargeOrb = spawnRasengan(scene, handBone);
        }
      }
      break;

    case "charged1":
      // Upgrade cast circle color on tier-up
      if (activeCastCircle) {
        activeCastCircle.group.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (m.isMeshStandardMaterial) m.emissive.setHex(0xffaa44);
          }
        });
      }
      break;

    case "charged2":
      if (activeCastCircle) {
        activeCastCircle.group.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (m.isMeshStandardMaterial) {
              m.emissive.setHex(0xff4444);
              m.emissiveIntensity = 2.5;
            }
          }
        });
      }
      break;

    // ── Charge release: launch orb as projectile ──
    case "chargeAttack":
    case "chargeAttackMax":
      if (activeChargeOrb && targetPos) {
        launchRasengan(activeChargeOrb, targetPos);
        activeChargeOrb = null;
      } else if (activeChargeOrb) {
        // No target — fire straight ahead
        activeChargeOrb.attachedTo = null;
        activeChargeOrb.velocity.set(facing[0] * 20, 0, facing[1] * 20);
        activeChargeOrb.remaining = 3;
        activeChargeOrb = null;
      }
      break;

    // ── Spin/whirlwind attacks: tornado VFX ──
    case "spinSlash":
      spawnTornadoSpin(scene, position, { scale: 0.6, duration: 0.7 });
      break;

    // ── Skills with AoE effects ──
    case "skill3": // AoE skill
      spawnSphereExplosion(scene, position, { element: "arcane", scale: 1.2 });
      break;

    case "skill4": // whirlwind
      spawnTornadoSpin(scene, position, { scale: 1, duration: 1.5 });
      break;

    // ── Class abilities ──
    case "classAbility": // R — fire burst
      if (isChargeWeapon(weaponType)) {
        spawnMagicOrb(scene, position, dir3, { element: "fire", seekTarget: targetPos ?? undefined });
      } else {
        spawnFireOrb(scene, position, dir3);
      }
      break;

    case "classAbility2": // E — heal/buff
      spawnCastCircle(scene, position, { element: "nature", duration: 1.5 });
      break;

    case "classAbility3": // F — AoE storm
      spawnTornadoSpin(scene, position, { stylized: false, scale: 1.5, duration: 3 });
      spawnSplash(scene, position, { element: "lightning", scale: 2 });
      break;

    // ── Earthquake ground slam ──
    case "earthquake":
      // Sphere explosion on landing (fired when LANDED, not on state enter)
      break;

    // ── Blocking: hex shield flash ──
    case "blocking":
      spawnHexShield(scene, position, { duration: 0.8, scale: 0.8 });
      break;

    // ── Counter strike: shield + sparks ──
    case "counterStrike":
      spawnHexShield(scene, position, { color: 0xffcc44, duration: 0.5, scale: 0.6 });
      spawnSparkExplosion(scene, position, { scale: 0.5 });
      break;

    // ── Battle cry: expanding shield ──
    case "pop":
      spawnHexShield(scene, position, { color: 0xffaa00, duration: 1.5, scale: 1.2 });
      break;
  }
}

/**
 * Spawn impact VFX when a hit lands (after damage confirmed).
 * Picks the right explosion mesh based on context.
 */
export function spawnHitImpactMeshVFX(
  scene: THREE.Scene | THREE.Group,
  hitPos: [number, number, number],
  combatState: string,
  weaponType: string,
  isCrit: boolean,
  element?: string,
): void {
  // Explosive arrow / AoE attacks get sphere explosion
  if (combatState === "earthquake" || combatState === "skill3" || combatState === "classAbility3") {
    spawnSphereExplosion(scene, hitPos, { element: element ?? "fire" });
    spawnSplash(scene, hitPos, { element: element ?? "lava", scale: 1.5 });
    return;
  }

  // Crit hits get spark explosion
  if (isCrit) {
    spawnSparkExplosion(scene, hitPos, { scale: 0.6 });
    return;
  }

  // Magic spell impacts get spark explosion with element color
  if (isChargeWeapon(weaponType) && (combatState.startsWith("skill") || combatState.startsWith("class"))) {
    const colors: Record<string, number> = { fire: 0xff4400, ice: 0x44aaff, lightning: 0xeeeeff, shadow: 0x6622aa, arcane: 0x4488ff };
    spawnSparkExplosion(scene, hitPos, { color: colors[element ?? "arcane"] ?? 0xffaa44, scale: 0.5 });
  }
}

/**
 * Tick mesh VFX + spell zones each frame. Call from Player.tsx useFrame.
 */
export function tickCombatVFX(delta: number): void {
  tickMeshVFX(delta);
  tickSpellZones(delta);
}

/**
 * Apply knockback to an enemy rigid body when the player lands a hit.
 *
 * @param enemyBody   Enemy Rapier RigidBody
 * @param state       Combat state that caused the hit
 * @param direction   Attacker → target direction [x, z]
 * @param hitPoint    World position of the hit
 * @param weaponWeight Weight from WeaponPrefabDatabase (scales knockback)
 */
export function applyHitKnockback(
  enemyBody: { applyImpulse: (impulse: { x: number; y: number; z: number }, wake: boolean) => void } | null,
  state: string,
  direction: [number, number],
  hitPoint: [number, number, number],
  weaponWeight: number = 3,
): void {
  const config = COMBAT_IMPULSES[state];
  if (!config || !enemyBody || config.knockback === 0) return;

  const kb = config.knockback * (1 + weaponWeight * 0.1);
  enemyBody.applyImpulse(
    { x: direction[0] * kb, y: kb * 0.3, z: direction[1] * kb },
    true,
  );

  // Fire VFX on hit
  emitCombatVFX(config.vfxOnHit, hitPoint, direction);
}

// ---------------------------------------------------------------------------
// VFX emission helper
// ---------------------------------------------------------------------------

function emitCombatVFX(
  presetName: string,
  position: [number, number, number],
  direction: [number, number],
): void {
  const dir3: [number, number, number] = [direction[0], 0, direction[1]];
  const fn = (VFXPresets as any)[presetName];
  if (!fn) return;

  // Most presets take (position) or (position, direction)
  // Check arity to decide which arguments to pass
  if (fn.length >= 3) {
    // burst with direction + count
    vfx.burst(fn(position, dir3));
  } else if (fn.length >= 2) {
    // burst with direction
    vfx.burst(fn(position, dir3));
  } else {
    // single particle or position-only burst
    const spec = fn(position);
    if (spec.count !== undefined) {
      vfx.burst(spec);
    } else {
      vfx.emit(spec);
    }
  }
}

// ---------------------------------------------------------------------------
// Dodge physics — directional dodge impulses
// ---------------------------------------------------------------------------

export type DodgeDirection = "forward" | "back" | "left" | "right";

/**
 * Apply a dodge impulse in a specific direction relative to facing.
 * Used by the shuffle/dodge system (double-tap directional keys).
 */
export function applyDodgeImpulse(
  rigidBody: { applyImpulse: (impulse: { x: number; y: number; z: number }, wake: boolean) => void } | null,
  facing: [number, number],
  dodgeDir: DodgeDirection,
  position: [number, number, number],
): void {
  if (!rigidBody) return;

  const speed = 6;
  let ix = 0, iz = 0;

  switch (dodgeDir) {
    case "forward":
      ix = facing[0] * speed;
      iz = facing[1] * speed;
      break;
    case "back":
      ix = -facing[0] * speed;
      iz = -facing[1] * speed;
      break;
    case "left": {
      // Rotate facing 90° left
      ix = facing[1] * speed;
      iz = -facing[0] * speed;
      break;
    }
    case "right": {
      // Rotate facing 90° right
      ix = -facing[1] * speed;
      iz = facing[0] * speed;
      break;
    }
  }

  rigidBody.applyImpulse({ x: ix, y: 1, z: iz }, true);
  vfx.burst(VFXPresets.dustPuff(position, 4));

  // Drain dodge stamina
  const { useSurvival } = require("@/lib/stores/useSurvival");
  useSurvival.getState().useStamina(DRAIN_RATES.dodge);
}

// ---------------------------------------------------------------------------
// Elemental spell physics — AoE damage zones with Rapier overlap detection
// ---------------------------------------------------------------------------

export interface SpellZone {
  id: string;
  position: [number, number, number];
  radius: number;
  duration: number;
  elapsed: number;
  damagePerTick: number;
  element: "fire" | "ice" | "lightning" | "shadow" | "arcane" | "nature";
  /** Rapier collider handle for the sensor */
  colliderHandle?: number;
}

const activeZones: SpellZone[] = [];

export function createSpellZone(zone: Omit<SpellZone, "id" | "elapsed">): string {
  const id = `zone_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  activeZones.push({ ...zone, id, elapsed: 0 });

  // Fire initial AoE VFX
  vfx.burst(VFXPresets.aoeRing(zone.position, zone.radius, elementColor(zone.element)));
  return id;
}

export function tickSpellZones(delta: number): SpellZone[] {
  const expired: string[] = [];

  for (const zone of activeZones) {
    zone.elapsed += delta;
    if (zone.elapsed >= zone.duration) {
      expired.push(zone.id);
      continue;
    }

    // Emit ongoing VFX
    if (Math.random() < 0.3) {
      const preset = elementParticle(zone.element);
      if (preset) {
        const ox = (Math.random() - 0.5) * zone.radius * 2;
        const oz = (Math.random() - 0.5) * zone.radius * 2;
        vfx.emit(preset([zone.position[0] + ox, zone.position[1], zone.position[2] + oz]));
      }
    }
  }

  // Remove expired
  for (const id of expired) {
    const idx = activeZones.findIndex(z => z.id === id);
    if (idx >= 0) activeZones.splice(idx, 1);
  }

  return activeZones;
}

function elementColor(element: string): number {
  const colors: Record<string, number> = {
    fire: 0xff4400, ice: 0x44aaff, lightning: 0xeeeeff,
    shadow: 0x6622aa, arcane: 0x4488ff, nature: 0x44ff88,
  };
  return colors[element] ?? 0xffffff;
}

function elementParticle(element: string): ((pos: any) => any) | null {
  switch (element) {
    case "fire": return VFXPresets.fireSpark;
    case "ice": return VFXPresets.iceSpike;
    case "lightning": return VFXPresets.lightningChain;
    case "shadow": return (pos: any) => VFXPresets.wispTrail(pos, "shadow");
    case "arcane": return (pos: any) => VFXPresets.wispTrail(pos, "arcane");
    case "nature": return (pos: any) => VFXPresets.buffAura(pos, 0x44ff88);
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Weapon-specific VFX on attack — fires swing trail + cast flash
// ---------------------------------------------------------------------------

/**
 * Fire weapon-specific VFX when entering a combat state.
 * Call from Player.tsx on every combat state transition.
 */
export function fireWeaponVFX(
  state: string,
  weaponType: ExtendedWeaponType | string,
  weaponTipPos: [number, number, number],
  facingDir: [number, number, number],
): void {
  const wvfx = getWeaponVFX(weaponType);
  const config = COMBAT_IMPULSES[state];
  if (!config) return;

  // Swing trail for melee attack states
  const attackStates = new Set([
    "attack1", "attack2", "attack3", "uppercut", "spinSlash",
    "counterStrike", "risingSlash", "heavyAttack", "dashAttack",
    "chargeAttack", "chargeAttackMax", "chargeFist", "chargeStrike",
  ]);
  if (attackStates.has(state)) {
    wvfx.swingTrail(weaponTipPos, facingDir);
  }

  // Cast flash for magic/ranged on skill states
  const castStates = new Set([
    "skill1", "skill2", "skill3", "skill4", "skill5",
    "classAbility", "classAbility2", "classAbility3",
  ]);
  if (castStates.has(state) && wvfx.castFlash) {
    wvfx.castFlash(weaponTipPos);
  }
}

/**
 * Fire weapon-specific hit VFX at the impact point.
 * Call when damage is confirmed against a target.
 */
export function fireHitVFX(
  weaponType: ExtendedWeaponType | string,
  hitPos: [number, number, number],
  hitDir: [number, number, number],
  isCrit: boolean,
  element?: string,
): void {
  const wvfx = getWeaponVFX(weaponType);
  wvfx.onHit(hitPos, hitDir);

  if (isCrit) {
    emitCritHit(hitPos, hitDir, element);
  }
}

// ---------------------------------------------------------------------------
// Status effects on hit — applies DoTs/debuffs based on weapon + state
// ---------------------------------------------------------------------------

/** Map weapon types to their natural proc effects */
const WEAPON_HIT_EFFECTS: Partial<Record<string, { effectId: EffectId; chance: number }[]>> = {
  sword:      [{ effectId: "bleed", chance: 0.15 }],
  greatsword: [{ effectId: "bleed", chance: 0.2 }],
  axe:        [{ effectId: "bleed", chance: 0.25 }],
  poleaxe:    [{ effectId: "bleed", chance: 0.2 }],
  dagger:     [{ effectId: "bleed", chance: 0.2 }, { effectId: "poison", chance: 0.1 }],
  spear:      [{ effectId: "bleed", chance: 0.15 }],
  hammer:     [{ effectId: "stun", chance: 0.1 }],
  mace:       [{ effectId: "stun", chance: 0.12 }],
  staff:      [{ effectId: "burn", chance: 0.15 }],
  wand:       [{ effectId: "silence", chance: 0.08 }],
  tome:       [{ effectId: "corruption", chance: 0.1 }, { effectId: "fear", chance: 0.06 }],
  relic:      [{ effectId: "curse", chance: 0.08 }],
  bow:        [{ effectId: "bleed", chance: 0.1 }],
  crossbow:   [{ effectId: "bleed", chance: 0.12 }],
  gun:        [{ effectId: "stun", chance: 0.05 }],
};

/** Special state effects (on top of weapon procs) */
const STATE_EFFECTS: Partial<Record<string, { effectId: EffectId; chance: number }[]>> = {
  heavyAttack:     [{ effectId: "stun", chance: 0.2 }],
  earthquake:      [{ effectId: "stun", chance: 0.4 }, { effectId: "slow", chance: 0.3 }],
  counterStrike:   [{ effectId: "expose", chance: 0.3 }],
  chargeAttackMax: [{ effectId: "stun", chance: 0.3 }],
  classAbility:    [{ effectId: "burn", chance: 0.4 }],
  classAbility3:   [{ effectId: "slow", chance: 0.5 }],
  pop:             [{ effectId: "fear", chance: 0.15 }],
};

/**
 * Roll for status effect procs on a successful hit.
 * Call after damage is confirmed.
 *
 * @param targetId     Entity ID of the target
 * @param attackerId   Entity ID of the attacker
 * @param weaponType   Attacker's weapon type
 * @param combatState  The combat state that dealt damage
 * @param critHit      Whether this was a critical hit (doubles proc chance)
 */
export function rollHitEffects(
  targetId: string,
  attackerId: string,
  weaponType: ExtendedWeaponType | string,
  combatState: string,
  critHit: boolean,
): EffectId[] {
  const applied: EffectId[] = [];
  const critMult = critHit ? 2.0 : 1.0;

  // Weapon-natural procs
  const weaponProcs = WEAPON_HIT_EFFECTS[weaponType];
  if (weaponProcs) {
    for (const proc of weaponProcs) {
      if (Math.random() < proc.chance * critMult) {
        if (applyEffect(targetId, proc.effectId, attackerId)) {
          applied.push(proc.effectId);
        }
      }
    }
  }

  // State-specific procs
  const stateProcs = STATE_EFFECTS[combatState];
  if (stateProcs) {
    for (const proc of stateProcs) {
      if (Math.random() < proc.chance * critMult) {
        if (applyEffect(targetId, proc.effectId, attackerId)) {
          applied.push(proc.effectId);
        }
      }
    }
  }

  return applied;
}

// ---------------------------------------------------------------------------
// Per-frame combat update — ticks effects + timing systems
// ---------------------------------------------------------------------------

/**
 * Master per-frame combat update. Call from Player.tsx useFrame.
 * Ticks status effects, combo timing, magic charge, ranger draw.
 *
 * @returns Combined results for the frame
 */
export function tickCombat(
  entityId: string,
  delta: number,
  position: [number, number, number],
  weaponType: ExtendedWeaponType | string,
  comboCount: number,
  lmbHeld: boolean,
): {
  effects: TickResult;
  comboTimingActive: boolean;
  magicChargeActive: boolean;
  rangerDrawActive: boolean;
} {
  // Tick status effects
  const effects = tickEffects(entityId, delta, position);

  // Tick weapon-specific attack mechanic
  let comboTimingActive = false;
  let magicChargeActive = false;
  let rangerDrawActive = false;

  if (isChargeWeapon(weaponType)) {
    const cs = getMagicChargeState();
    if (cs.active) {
      tickMagicCharge(delta);
      magicChargeActive = true;
    }
  } else if (isDrawWeapon(weaponType)) {
    const ds = getRangerDrawState();
    if (ds.active) {
      tickRangerDraw(delta);
      rangerDrawActive = true;
    }
  } else if (isComboWeapon(weaponType)) {
    const cts = getComboTimingState();
    if (cts.active) {
      tickComboTiming(delta);
      comboTimingActive = true;
    } else if (shouldActivateComboTiming(weaponType, comboCount, lmbHeld)) {
      startComboTiming();
      comboTimingActive = true;
    }
  }

  return { effects, comboTimingActive, magicChargeActive, rangerDrawActive };
}

// ---------------------------------------------------------------------------
// Keybind reference — documents what each key does in combat vs harvest
// ---------------------------------------------------------------------------

export const KEYBIND_MAP = {
  // Combat mode
  "LMB":          "Attack / Charge (hold)",
  "RMB":          "Block (hold) / Earthquake (airborne)",
  "Space":        "Jump / Double Jump",
  "Shift":        "Sprint (hold) / Dash (tap)",
  "Ctrl":         "Roll / Dodge",
  "C":            "Crouch / Sneak toggle",
  "Tab":          "Switch Combat ↔ Harvest mode",
  "1":            "Weapon Skill 1 (Action)",
  "2":            "Weapon Skill 2 (Action2)",
  "3":            "Weapon Skill 3 (Auto toggle)",
  "4":            "Weapon Skill 4 (Special)",
  "5":            "Use Item Slot 1",
  "6":            "Use Item Slot 2",
  "7":            "Use Item Slot 3",
  "R":            "Class Ability 1 (classAbility)",
  "E":            "Class Ability 2 (classAbility2)",
  "F":            "Class Ability 3 (classAbility3)",
  "X":            "Battle Cry / Taunt (pop)",
  "Z":            "Z-key dynamic combat (stacking buff)",
  "Q":            "Strafe Left",
  "W":            "Move Forward (away from camera)",
  "A":            "Turn Left",
  "S":            "Move Backward",
  "D":            "Turn Right",
} as const;
