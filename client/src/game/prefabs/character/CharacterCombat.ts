/**
 * CharacterCombat — Layer 5 of the Character Prefab system.
 *
 * Wraps the existing combatMachine (XState FSM) with:
 *   - Stats engine (8-attribute → 37 derived stats)
 *   - Weapon class restrictions per character class
 *   - Dynamic hotbar generation per equipped weapon
 *   - Combat state → animation + physics bridge
 *
 * Non-React — uses XState's interpret() directly.
 */

import { createActor, type AnyActorRef } from "xstate";
import {
  combatMachine,
  COMBAT_STATE_ANIMS,
  ACTION_DURATIONS,
  DAMAGE_STATES,
  STAMINA_COSTS,
  type CombatEvent,
  type CombatState,
} from "../../machines/combatMachine";
import { CLASS_WEAPON_RESTRICTIONS, TIER_MULTIPLIERS } from "./constants";
import type { ClassId, PrefabWeaponType, StatsAllocation, HotbarSlot, DamageEvent } from "./types";

// ---------------------------------------------------------------------------
// Simplified stats engine (port of playground StatsEngine.js)
// ---------------------------------------------------------------------------

interface DerivedStats {
  maxHp: number;
  maxStamina: number;
  maxMana: number;
  attackPower: number;
  defense: number;
  magicPower: number;
  magicDefense: number;
  critChance: number;
  critDamage: number;
  moveSpeed: number;
  attackSpeed: number;
  dodgeChance: number;
  blockChance: number;
}

function computeDerivedStats(attrs: StatsAllocation, tier: number): DerivedStats {
  const mult = TIER_MULTIPLIERS[Math.min(tier, 8)] ?? 1.0;

  // Diminishing returns: 1-25 = 100%, 26-50 = 50%, 51+ = 25%
  const dr = (v: number) => {
    if (v <= 25) return v;
    if (v <= 50) return 25 + (v - 25) * 0.5;
    return 25 + 12.5 + (v - 50) * 0.25;
  };

  const str = dr(attrs.STR);
  const dex = dr(attrs.DEX);
  const int = dr(attrs.INT);
  const vit = dr(attrs.VIT);
  const wis = dr(attrs.WIS);
  const lck = dr(attrs.LCK);
  const end = dr(attrs.END);

  return {
    maxHp: Math.floor((100 + vit * 8 + str * 2 + end * 3) * mult),
    maxStamina: Math.floor((80 + end * 5 + dex * 2) * mult),
    maxMana: Math.floor((60 + int * 6 + wis * 4) * mult),
    attackPower: Math.floor((str * 2.5 + dex * 0.8) * mult),
    defense: Math.floor(Math.sqrt((vit * 3 + end * 2) * mult) * 5),
    magicPower: Math.floor((int * 2.5 + wis * 1.2) * mult),
    magicDefense: Math.floor(Math.sqrt((wis * 3 + int * 1) * mult) * 4),
    critChance: Math.min(0.5, (lck * 0.004 + dex * 0.002) * mult),
    critDamage: 1.5 + lck * 0.01 * mult,
    moveSpeed: 5.0 + dex * 0.03 * mult,
    attackSpeed: 1.0 + dex * 0.005 * mult,
    dodgeChance: Math.min(0.3, dex * 0.003 * mult),
    blockChance: Math.min(0.5, (str * 0.003 + vit * 0.002) * mult),
  };
}

// ---------------------------------------------------------------------------
// Hotbar generation per weapon type
// ---------------------------------------------------------------------------

function generateHotbar(weaponType: PrefabWeaponType): HotbarSlot[] {
  const slots: HotbarSlot[] = [];

  // Slot 0-3: weapon skills
  const meleeSkills: HotbarSlot[] = [
    { index: 0, name: "Attack",     event: "LMB",            animKey: "attack",    cooldown: 0,   staminaCost: STAMINA_COSTS.attack1 ?? 8 },
    { index: 1, name: "Heavy",      event: "CLASS_ABILITY",  animKey: "heavyAttack",cooldown: 2,   staminaCost: STAMINA_COSTS.heavyAttack ?? 28 },
    { index: 2, name: "Spin Slash", event: "KEY_5",          animKey: "spinSlash",  cooldown: 5,   staminaCost: STAMINA_COSTS.skill5 ?? 20 },
    { index: 3, name: "Uppercut",   event: "KEY_2",          animKey: "uppercut",   cooldown: 4,   staminaCost: STAMINA_COSTS.skill2 ?? 18 },
  ];

  const rangedSkills: HotbarSlot[] = [
    { index: 0, name: "Shoot",      event: "LMB",            animKey: "attack",    cooldown: 0,   staminaCost: 6 },
    { index: 1, name: "Power Shot", event: "CLASS_ABILITY",  animKey: "heavyAttack",cooldown: 3,   staminaCost: 20 },
    { index: 2, name: "Volley",     event: "KEY_3",          animKey: "hadouken",   cooldown: 8,   staminaCost: 30 },
    { index: 3, name: "Dodge Roll", event: "ROLL",           animKey: "roll",       cooldown: 1,   staminaCost: STAMINA_COSTS.rolling ?? 12 },
  ];

  const magicSkills: HotbarSlot[] = [
    { index: 0, name: "Cast",       event: "LMB",            animKey: "attack",     cooldown: 0,   staminaCost: 5 },
    { index: 1, name: "Fireball",   event: "KEY_1",          animKey: "hadouken",   cooldown: 2,   staminaCost: STAMINA_COSTS.skill1 ?? 20 },
    { index: 2, name: "AoE Blast",  event: "POP",            animKey: "pop",        cooldown: 10,  staminaCost: 35 },
    { index: 3, name: "Shield",     event: "BLOCK",          animKey: "block",      cooldown: 0,   staminaCost: 5 },
  ];

  switch (weaponType) {
    case "bow":
    case "crossbow":
    case "gun":
      slots.push(...rangedSkills);
      break;
    case "staff":
    case "wand":
      slots.push(...magicSkills);
      break;
    default:
      slots.push(...meleeSkills);
      break;
  }

  // Slot 4: empty separator
  // Slots 5-7: consumable placeholders
  slots.push(
    { index: 5, name: "Health Potion", event: "KEY_6", animKey: "pickup", cooldown: 15, staminaCost: 0 },
    { index: 6, name: "Food",          event: "KEY_7", animKey: "pickup", cooldown: 30, staminaCost: 0 },
    { index: 7, name: "Relic",         event: "KEY_8", animKey: "pickup", cooldown: 60, staminaCost: 0 },
  );

  return slots;
}

// ---------------------------------------------------------------------------
// CharacterCombat
// ---------------------------------------------------------------------------

export class CharacterCombat {
  /** XState combat machine actor. */
  private actor: AnyActorRef;
  /** Derived stats from attributes + tier. */
  stats: DerivedStats;
  /** Current HP. */
  hp: number;
  /** Current stamina. */
  stamina: number;
  /** Current mana. */
  mana: number;
  /** Character class (for weapon restrictions). */
  classId: ClassId;
  /** Currently equipped weapon type. */
  weaponType: PrefabWeaponType = "fists";
  /** Dynamic hotbar based on weapon type. */
  hotbar: HotbarSlot[];

  /** Callback when combat state changes. */
  onStateChange: ((state: string, prevState: string) => void) | null = null;
  /** Callback when damage is dealt. */
  onDamageDealt: ((state: string, baseDamage: number) => void) | null = null;

  private prevState = "idle";
  private actionTimers: Map<string, number> = new Map();

  constructor(classId: ClassId, attributes: StatsAllocation, tier: number) {
    this.classId = classId;
    this.stats = computeDerivedStats(attributes, tier);
    this.hp = this.stats.maxHp;
    this.stamina = this.stats.maxStamina;
    this.mana = this.stats.maxMana;
    this.hotbar = generateHotbar("fists");

    // Create and start the XState actor
    this.actor = createActor(combatMachine);
    this.actor.start();

    // Subscribe to state changes
    this.actor.subscribe((snapshot) => {
      const current = String(snapshot.value);
      if (current !== this.prevState) {
        this.onStateChange?.(current, this.prevState);

        // Check stamina cost
        const cost = STAMINA_COSTS[current];
        if (cost && cost > 0) {
          this.stamina = Math.max(0, this.stamina - cost);
        }

        // Check if this state deals damage
        const dmg = DAMAGE_STATES[current];
        if (dmg && dmg > 0) {
          const scaledDmg = Math.floor(dmg * (1 + this.stats.attackPower / 100));
          this.onDamageDealt?.(current, scaledDmg);
        }

        this.prevState = current;
      }
    });
  }

  // -----------------------------------------------------------------------
  // Combat input
  // -----------------------------------------------------------------------

  /**
   * Send a combat event to the state machine.
   * This is the main entry point for player input and AI actions.
   */
  send(event: CombatEvent) {
    this.actor.send(event);
  }

  /** Current combat state name. */
  get state(): string {
    return String(this.actor.getSnapshot().value);
  }

  /** Whether the character can currently move (not in a rooted action). */
  get canMove(): boolean {
    const s = this.state;
    return s === "idle" || s === "dashing" || s === "jumping" || s === "falling"
      || s === "doubleJumping" || s === "climbing" || s === "charging"
      || s === "charged1" || s === "charged2" || s === "blocking";
  }

  /** Whether the character is in a damage-dealing state. */
  get isDealingDamage(): boolean {
    return (DAMAGE_STATES[this.state] ?? 0) > 0;
  }

  // -----------------------------------------------------------------------
  // Weapon management
  // -----------------------------------------------------------------------

  /**
   * Equip a weapon. Validates against class restrictions.
   * Returns false if the class can't use this weapon type.
   */
  equipWeapon(type: PrefabWeaponType): boolean {
    const allowed = CLASS_WEAPON_RESTRICTIONS[this.classId];
    if (allowed && !allowed.includes(type)) return false;

    this.weaponType = type;
    this.hotbar = generateHotbar(type);
    return true;
  }

  /** Get allowed weapon types for this class. */
  get allowedWeapons(): string[] {
    return CLASS_WEAPON_RESTRICTIONS[this.classId] ?? [];
  }

  // -----------------------------------------------------------------------
  // Damage
  // -----------------------------------------------------------------------

  /**
   * Apply damage to this character. Returns the ragdoll preset to trigger.
   */
  takeDamage(event: DamageEvent): { ragdollPreset: string; isDead: boolean; actualDamage: number } {
    // Defense mitigation (sqrt-based)
    const mitigation = Math.sqrt(this.stats.defense) * 2;
    const actualDamage = Math.max(1, Math.floor(event.amount - mitigation));

    this.hp = Math.max(0, this.hp - actualDamage);
    const isDead = this.hp <= 0;

    let ragdollPreset = "none";
    if (isDead || event.isLethal) {
      ragdollPreset = "death";
      this.send({ type: "ACTION_DONE" }); // force to idle then death
    } else if (event.isHeavy) {
      ragdollPreset = "heavyHit";
    } else if (event.amount > this.stats.maxHp * 0.3) {
      ragdollPreset = "knockback";
    }

    return { ragdollPreset, isDead, actualDamage };
  }

  // -----------------------------------------------------------------------
  // Regen / per-frame update
  // -----------------------------------------------------------------------

  /**
   * Per-frame update: stamina regen, mana regen, action timer ticks.
   */
  update(dt: number) {
    // Stamina regen (3/s base)
    if (this.stamina < this.stats.maxStamina) {
      this.stamina = Math.min(this.stats.maxStamina, this.stamina + 3 * dt);
    }

    // Mana regen (2/s base)
    if (this.mana < this.stats.maxMana) {
      this.mana = Math.min(this.stats.maxMana, this.mana + 2 * dt);
    }

    // Charge timer — increment chargeTime in combat context
    const state = this.state;
    if (state === "charging" || state === "charged1" || state === "charged2") {
      // The actual charge tier advancement is handled by the Player tick
      // dispatching CHARGE_TIER_1 / CHARGE_TIER_2 events
    }

    // Action duration auto-complete
    const dur = ACTION_DURATIONS[state];
    if (dur) {
      const t = (this.actionTimers.get(state) ?? 0) + dt;
      this.actionTimers.set(state, t);
      if (t >= dur) {
        this.actionTimers.delete(state);
        this.send({ type: "ACTION_DONE" });
      }
    } else {
      this.actionTimers.clear();
    }
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  dispose() {
    this.actor.stop();
    this.onStateChange = null;
    this.onDamageDealt = null;
  }
}
