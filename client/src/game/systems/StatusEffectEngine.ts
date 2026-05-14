/**
 * StatusEffectEngine — DoTs, HoTs, buffs, debuffs with full timing,
 * stacking, diminishing returns, VFX particles, and shader tints.
 *
 * Every active effect on a character ticks per frame and:
 *   1. Applies damage/healing at the configured interval
 *   2. Emits VFX particles via SpellProjectileSystem.emitStatusVFX
 *   3. Applies a material color tint (shader overlay) to the character
 *   4. Respects diminishing returns on CC effects (stun, root, fear, silence)
 *   5. Tracks stacks for stackable effects (bleed, poison)
 *
 * Integration: call `tickEffects(entityId, delta)` from useFrame.
 * Effects are added via `applyEffect(entityId, effect)` from combat code.
 */

import { emitStatusVFX, type StatusEffect as VFXStatusEffect } from "../effects/SpellProjectileSystem";

// ---------------------------------------------------------------------------
// Effect definitions
// ---------------------------------------------------------------------------

export type EffectCategory = "dot" | "hot" | "buff" | "debuff" | "cc";

export type EffectId =
  // DoTs
  | "bleed" | "poison" | "burn" | "corruption"
  // HoTs
  | "regen" | "lifebloom" | "nature_heal"
  // Buffs
  | "haste" | "fortify" | "empower" | "shield_buff" | "battle_cry"
  // Debuffs
  | "slow" | "weaken" | "expose" | "curse"
  // CC (crowd control — subject to diminishing returns)
  | "stun" | "root" | "fear" | "silence" | "freeze";

export interface EffectTemplate {
  id: EffectId;
  name: string;
  category: EffectCategory;
  /** Base duration in seconds */
  baseDuration: number;
  /** Tick interval in seconds (0 = no ticks, just duration) */
  tickInterval: number;
  /** Damage/heal per tick (negative = heal) */
  tickValue: number;
  /** Max stacks (1 = doesn't stack, refreshes duration) */
  maxStacks: number;
  /** Whether each stack adds its own tickValue */
  stacksMultiply: boolean;
  /** Stat modifier while active (multiplier, e.g. 0.7 = 30% slow) */
  statMod: Partial<Record<StatModKey, number>>;
  /** VFX key for SpellProjectileSystem.emitStatusVFX */
  vfxKey: VFXStatusEffect | null;
  /** Character material tint color (applied as emissive overlay) */
  tintColor: number;
  /** Tint intensity (0 = no tint, 1 = full) */
  tintIntensity: number;
  /** Whether this effect is subject to diminishing returns */
  diminishing: boolean;
  /** Icon for the HUD buff bar */
  icon: string;
}

export type StatModKey =
  | "speedMult" | "damageMult" | "defenseMult" | "attackSpeedMult"
  | "healingMult" | "critChanceMod" | "armorMod" | "resistanceMod";

// ---------------------------------------------------------------------------
// Effect templates
// ---------------------------------------------------------------------------

export const EFFECT_TEMPLATES: Record<EffectId, EffectTemplate> = {
  // ── DoTs ──
  bleed: {
    id: "bleed", name: "Bleed", category: "dot",
    baseDuration: 6, tickInterval: 1, tickValue: 3,
    maxStacks: 5, stacksMultiply: true,
    statMod: {}, vfxKey: "bleed", tintColor: 0xaa0000, tintIntensity: 0.15,
    diminishing: false, icon: "🩸",
  },
  poison: {
    id: "poison", name: "Poison", category: "dot",
    baseDuration: 8, tickInterval: 2, tickValue: 5,
    maxStacks: 3, stacksMultiply: true,
    statMod: { healingMult: 0.5 }, vfxKey: "poison", tintColor: 0x44cc44, tintIntensity: 0.2,
    diminishing: false, icon: "☠️",
  },
  burn: {
    id: "burn", name: "Burn", category: "dot",
    baseDuration: 4, tickInterval: 0.5, tickValue: 2,
    maxStacks: 1, stacksMultiply: false,
    statMod: {}, vfxKey: "burn", tintColor: 0xff4400, tintIntensity: 0.25,
    diminishing: false, icon: "🔥",
  },
  corruption: {
    id: "corruption", name: "Corruption", category: "dot",
    baseDuration: 10, tickInterval: 2, tickValue: 4,
    maxStacks: 1, stacksMultiply: false,
    statMod: { defenseMult: 0.85, resistanceMod: -10 }, vfxKey: "fear", tintColor: 0x6622aa, tintIntensity: 0.2,
    diminishing: false, icon: "💀",
  },

  // ── HoTs ──
  regen: {
    id: "regen", name: "Regeneration", category: "hot",
    baseDuration: 10, tickInterval: 1, tickValue: -5,
    maxStacks: 1, stacksMultiply: false,
    statMod: {}, vfxKey: null, tintColor: 0x44ff88, tintIntensity: 0.1,
    diminishing: false, icon: "💚",
  },
  lifebloom: {
    id: "lifebloom", name: "Lifebloom", category: "hot",
    baseDuration: 8, tickInterval: 1, tickValue: -3,
    maxStacks: 3, stacksMultiply: true,
    statMod: {}, vfxKey: null, tintColor: 0x88ff44, tintIntensity: 0.12,
    diminishing: false, icon: "🌸",
  },
  nature_heal: {
    id: "nature_heal", name: "Nature's Touch", category: "hot",
    baseDuration: 6, tickInterval: 1.5, tickValue: -8,
    maxStacks: 1, stacksMultiply: false,
    statMod: { healingMult: 1.2 }, vfxKey: null, tintColor: 0x44ff88, tintIntensity: 0.15,
    diminishing: false, icon: "🌿",
  },

  // ── Buffs ──
  haste: {
    id: "haste", name: "Haste", category: "buff",
    baseDuration: 8, tickInterval: 0, tickValue: 0,
    maxStacks: 1, stacksMultiply: false,
    statMod: { speedMult: 1.3, attackSpeedMult: 1.2 }, vfxKey: null, tintColor: 0xffcc44, tintIntensity: 0.1,
    diminishing: false, icon: "⚡",
  },
  fortify: {
    id: "fortify", name: "Fortify", category: "buff",
    baseDuration: 10, tickInterval: 0, tickValue: 0,
    maxStacks: 1, stacksMultiply: false,
    statMod: { defenseMult: 1.3, armorMod: 15 }, vfxKey: null, tintColor: 0x8888ff, tintIntensity: 0.1,
    diminishing: false, icon: "🛡️",
  },
  empower: {
    id: "empower", name: "Empower", category: "buff",
    baseDuration: 6, tickInterval: 0, tickValue: 0,
    maxStacks: 1, stacksMultiply: false,
    statMod: { damageMult: 1.25, critChanceMod: 10 }, vfxKey: null, tintColor: 0xff4444, tintIntensity: 0.1,
    diminishing: false, icon: "💪",
  },
  shield_buff: {
    id: "shield_buff", name: "Barrier", category: "buff",
    baseDuration: 8, tickInterval: 0, tickValue: 0,
    maxStacks: 1, stacksMultiply: false,
    statMod: { armorMod: 25, resistanceMod: 15 }, vfxKey: null, tintColor: 0x44aaff, tintIntensity: 0.15,
    diminishing: false, icon: "🔷",
  },
  battle_cry: {
    id: "battle_cry", name: "Battle Cry", category: "buff",
    baseDuration: 5, tickInterval: 0, tickValue: 0,
    maxStacks: 1, stacksMultiply: false,
    statMod: { damageMult: 1.15, speedMult: 1.1, attackSpeedMult: 1.1 }, vfxKey: null, tintColor: 0xffaa00, tintIntensity: 0.12,
    diminishing: false, icon: "📣",
  },

  // ── Debuffs ──
  slow: {
    id: "slow", name: "Slow", category: "debuff",
    baseDuration: 4, tickInterval: 0, tickValue: 0,
    maxStacks: 1, stacksMultiply: false,
    statMod: { speedMult: 0.6, attackSpeedMult: 0.8 }, vfxKey: "frost", tintColor: 0x88ccff, tintIntensity: 0.2,
    diminishing: false, icon: "🐌",
  },
  weaken: {
    id: "weaken", name: "Weaken", category: "debuff",
    baseDuration: 6, tickInterval: 0, tickValue: 0,
    maxStacks: 1, stacksMultiply: false,
    statMod: { damageMult: 0.7 }, vfxKey: null, tintColor: 0x888888, tintIntensity: 0.15,
    diminishing: false, icon: "📉",
  },
  expose: {
    id: "expose", name: "Expose", category: "debuff",
    baseDuration: 5, tickInterval: 0, tickValue: 0,
    maxStacks: 1, stacksMultiply: false,
    statMod: { defenseMult: 0.7, armorMod: -20 }, vfxKey: null, tintColor: 0xffaa44, tintIntensity: 0.12,
    diminishing: false, icon: "🎯",
  },
  curse: {
    id: "curse", name: "Curse", category: "debuff",
    baseDuration: 8, tickInterval: 0, tickValue: 0,
    maxStacks: 1, stacksMultiply: false,
    statMod: { healingMult: 0.5, critChanceMod: -10 }, vfxKey: "fear", tintColor: 0x6622aa, tintIntensity: 0.2,
    diminishing: false, icon: "🔮",
  },

  // ── CC (diminishing returns) ──
  stun: {
    id: "stun", name: "Stun", category: "cc",
    baseDuration: 2, tickInterval: 0, tickValue: 0,
    maxStacks: 1, stacksMultiply: false,
    statMod: { speedMult: 0, attackSpeedMult: 0 }, vfxKey: "stun", tintColor: 0xffffaa, tintIntensity: 0.3,
    diminishing: true, icon: "💫",
  },
  root: {
    id: "root", name: "Root", category: "cc",
    baseDuration: 3, tickInterval: 0, tickValue: 0,
    maxStacks: 1, stacksMultiply: false,
    statMod: { speedMult: 0 }, vfxKey: "root", tintColor: 0x228822, tintIntensity: 0.2,
    diminishing: true, icon: "🌱",
  },
  fear: {
    id: "fear", name: "Fear", category: "cc",
    baseDuration: 2.5, tickInterval: 0, tickValue: 0,
    maxStacks: 1, stacksMultiply: false,
    statMod: { speedMult: 1.3 }, // feared target runs away faster
    vfxKey: "fear", tintColor: 0x9944ff, tintIntensity: 0.25,
    diminishing: true, icon: "😱",
  },
  silence: {
    id: "silence", name: "Silence", category: "cc",
    baseDuration: 3, tickInterval: 0, tickValue: 0,
    maxStacks: 1, stacksMultiply: false,
    statMod: {}, vfxKey: "silence", tintColor: 0x888888, tintIntensity: 0.2,
    diminishing: true, icon: "🔇",
  },
  freeze: {
    id: "freeze", name: "Freeze", category: "cc",
    baseDuration: 2, tickInterval: 0, tickValue: 0,
    maxStacks: 1, stacksMultiply: false,
    statMod: { speedMult: 0, attackSpeedMult: 0 }, vfxKey: "frost", tintColor: 0x88eeff, tintIntensity: 0.35,
    diminishing: true, icon: "🧊",
  },
};

// ---------------------------------------------------------------------------
// Active effect instance
// ---------------------------------------------------------------------------

export interface ActiveEffect {
  templateId: EffectId;
  /** Remaining duration (seconds) */
  remaining: number;
  /** Time since last tick (seconds) */
  tickAccum: number;
  /** Current stacks */
  stacks: number;
  /** Source entity ID (for tracking who applied it) */
  sourceId: string;
  /** Diminishing returns reduction applied to this instance (0–1) */
  drReduction: number;
}

// ---------------------------------------------------------------------------
// Per-entity effect state
// ---------------------------------------------------------------------------

interface EntityEffectState {
  effects: ActiveEffect[];
  /** DR tracker: effectId → number of times applied in the DR window */
  drHistory: Map<EffectId, { count: number; windowEnd: number }>;
}

const entityStates = new Map<string, EntityEffectState>();

function getState(entityId: string): EntityEffectState {
  if (!entityStates.has(entityId)) {
    entityStates.set(entityId, { effects: [], drHistory: new Map() });
  }
  return entityStates.get(entityId)!;
}

// ---------------------------------------------------------------------------
// Diminishing returns
// ---------------------------------------------------------------------------

/** DR window in seconds — resets after this period of no re-application */
const DR_WINDOW = 15;

/** Duration multiplier per successive application within the DR window */
const DR_MULTIPLIERS = [1.0, 0.5, 0.25, 0]; // 4th application = immune

function getDRReduction(entityId: string, effectId: EffectId): number {
  const state = getState(entityId);
  const now = performance.now() / 1000;

  let dr = state.drHistory.get(effectId);
  if (!dr || now > dr.windowEnd) {
    // Fresh window
    dr = { count: 0, windowEnd: now + DR_WINDOW };
    state.drHistory.set(effectId, dr);
  }

  const mult = DR_MULTIPLIERS[Math.min(dr.count, DR_MULTIPLIERS.length - 1)];
  dr.count++;
  dr.windowEnd = now + DR_WINDOW; // extend window on re-application
  return mult;
}

// ---------------------------------------------------------------------------
// Apply / remove effects
// ---------------------------------------------------------------------------

/**
 * Apply an effect to an entity. Handles stacking and diminishing returns.
 *
 * @param entityId  Target entity (player ID, enemy ID)
 * @param effectId  Which effect to apply
 * @param sourceId  Who applied it (for tracking)
 * @param durationOverride  Override base duration (null = use template)
 * @param valueOverride  Override tick value (null = use template)
 */
export function applyEffect(
  entityId: string,
  effectId: EffectId,
  sourceId: string = "unknown",
  durationOverride: number | null = null,
  valueOverride: number | null = null,
): boolean {
  const template = EFFECT_TEMPLATES[effectId];
  if (!template) return false;

  const state = getState(entityId);

  // Diminishing returns for CC
  let drMult = 1.0;
  if (template.diminishing) {
    drMult = getDRReduction(entityId, effectId);
    if (drMult <= 0) return false; // immune
  }

  const duration = (durationOverride ?? template.baseDuration) * drMult;
  if (duration <= 0) return false;

  // Check for existing effect of same type
  const existing = state.effects.find(e => e.templateId === effectId);
  if (existing) {
    if (template.maxStacks > 1 && existing.stacks < template.maxStacks) {
      // Add a stack
      existing.stacks++;
      existing.remaining = Math.max(existing.remaining, duration);
    } else {
      // Refresh duration (don't add stacks past max)
      existing.remaining = Math.max(existing.remaining, duration);
    }
    existing.drReduction = 1 - drMult;
    return true;
  }

  // Apply new effect
  state.effects.push({
    templateId: effectId,
    remaining: duration,
    tickAccum: 0,
    stacks: 1,
    sourceId,
    drReduction: 1 - drMult,
  });
  return true;
}

/** Remove all instances of an effect from an entity */
export function removeEffect(entityId: string, effectId: EffectId): void {
  const state = getState(entityId);
  state.effects = state.effects.filter(e => e.templateId !== effectId);
}

/** Remove all effects from an entity */
export function clearAllEffects(entityId: string): void {
  const state = getState(entityId);
  state.effects = [];
}

// ---------------------------------------------------------------------------
// Tick — call once per frame per entity
// ---------------------------------------------------------------------------

export interface TickResult {
  /** Damage dealt this frame (positive = damage, negative = heal) */
  totalDamage: number;
  totalHealing: number;
  /** Combined stat modifiers from all active effects */
  statMods: Record<StatModKey, number>;
  /** Tint to apply to the character mesh */
  tintColor: number;
  tintIntensity: number;
  /** Active effect IDs (for HUD display) */
  activeEffects: { id: EffectId; name: string; icon: string; stacks: number; remaining: number }[];
  /** Effects that expired this frame */
  expired: EffectId[];
  /** Whether the entity is CC'd (stunned, rooted, feared, frozen) */
  isCCd: boolean;
  /** VFX keys to emit this frame */
  vfxToEmit: VFXStatusEffect[];
}

/**
 * Tick all effects on an entity. Call from useFrame.
 *
 * @param entityId  The entity being ticked
 * @param delta     Frame delta in seconds
 * @param position  Entity world position (for VFX emission)
 * @returns Combined results for damage, healing, stat mods, tints
 */
export function tickEffects(
  entityId: string,
  delta: number,
  position: [number, number, number],
): TickResult {
  const state = getState(entityId);
  const result: TickResult = {
    totalDamage: 0, totalHealing: 0,
    statMods: { speedMult: 1, damageMult: 1, defenseMult: 1, attackSpeedMult: 1, healingMult: 1, critChanceMod: 0, armorMod: 0, resistanceMod: 0 },
    tintColor: 0x000000, tintIntensity: 0,
    activeEffects: [], expired: [],
    isCCd: false, vfxToEmit: [],
  };

  const expired: number[] = [];

  for (let i = 0; i < state.effects.length; i++) {
    const eff = state.effects[i];
    const tmpl = EFFECT_TEMPLATES[eff.templateId];
    if (!tmpl) continue;

    eff.remaining -= delta;
    if (eff.remaining <= 0) {
      expired.push(i);
      result.expired.push(eff.templateId);
      continue;
    }

    // Tick damage/healing
    if (tmpl.tickInterval > 0) {
      eff.tickAccum += delta;
      while (eff.tickAccum >= tmpl.tickInterval) {
        eff.tickAccum -= tmpl.tickInterval;
        const value = tmpl.stacksMultiply ? tmpl.tickValue * eff.stacks : tmpl.tickValue;
        if (value > 0) result.totalDamage += value;
        else result.totalHealing += Math.abs(value);
      }
    }

    // Apply stat modifiers (multiplicative for mults, additive for flat)
    for (const [key, value] of Object.entries(tmpl.statMod)) {
      const k = key as StatModKey;
      if (k.endsWith("Mult")) {
        result.statMods[k] *= value as number;
      } else {
        result.statMods[k] += value as number;
      }
    }

    // Tint — blend toward strongest effect
    if (tmpl.tintIntensity > result.tintIntensity) {
      result.tintColor = tmpl.tintColor;
      result.tintIntensity = tmpl.tintIntensity;
    }

    // CC check
    if (tmpl.category === "cc") {
      result.isCCd = true;
    }

    // VFX emission (throttled — not every frame)
    if (tmpl.vfxKey && Math.random() < 0.5) {
      result.vfxToEmit.push(tmpl.vfxKey);
    }

    // HUD data
    result.activeEffects.push({
      id: eff.templateId, name: tmpl.name, icon: tmpl.icon,
      stacks: eff.stacks, remaining: eff.remaining,
    });
  }

  // Remove expired (reverse order to preserve indices)
  for (let i = expired.length - 1; i >= 0; i--) {
    state.effects.splice(expired[i], 1);
  }

  // Emit VFX
  for (const vfxKey of result.vfxToEmit) {
    emitStatusVFX(vfxKey, position);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Get all active effects on an entity */
export function getActiveEffects(entityId: string): ActiveEffect[] {
  return getState(entityId).effects;
}

/** Check if an entity has a specific effect */
export function hasEffect(entityId: string, effectId: EffectId): boolean {
  return getState(entityId).effects.some(e => e.templateId === effectId);
}

/** Get stack count for an effect (0 if not active) */
export function getEffectStacks(entityId: string, effectId: EffectId): number {
  return getState(entityId).effects.find(e => e.templateId === effectId)?.stacks ?? 0;
}

/** Check if entity is under any CC */
export function isEntityCCd(entityId: string): boolean {
  return getState(entityId).effects.some(e => EFFECT_TEMPLATES[e.templateId]?.category === "cc");
}

/** Get the DR reduction for the next application of an effect */
export function peekDR(entityId: string, effectId: EffectId): number {
  const state = getState(entityId);
  const now = performance.now() / 1000;
  const dr = state.drHistory.get(effectId);
  if (!dr || now > dr.windowEnd) return 1.0; // full duration
  return DR_MULTIPLIERS[Math.min(dr.count, DR_MULTIPLIERS.length - 1)];
}
