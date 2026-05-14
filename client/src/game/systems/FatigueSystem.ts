import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useSurvival } from "@/lib/stores/useSurvival";

// ---------------------------------------------------------------------------
// Fatigue tiers — each tier imposes a set of physics multipliers that
// downstream consumers (Player.tsx, characterMachine, etc.) read per-frame
// to clamp speed, jump impulse, and attack cadence.
// ---------------------------------------------------------------------------
export type FatigueLevel = "rested" | "normal" | "tired" | "exhausted";

export interface FatigueModifiers {
  /** Max horizontal speed multiplier (1 = full, 0.4 = walk-only). */
  speedMult: number;
  /** Jump impulse multiplier. */
  jumpMult: number;
  /** Attack animation timeScale multiplier (lower = slower swings). */
  attackSpeedMult: number;
  /** Stamina recovery rate multiplier (applied on top of hunger mult). */
  recoveryMult: number;
}

const FATIGUE_MODIFIERS: Record<FatigueLevel, FatigueModifiers> = {
  rested:    { speedMult: 1.0,  jumpMult: 1.0,  attackSpeedMult: 1.0,  recoveryMult: 1.5 },
  normal:    { speedMult: 1.0,  jumpMult: 1.0,  attackSpeedMult: 1.0,  recoveryMult: 1.0 },
  tired:     { speedMult: 0.75, jumpMult: 0.75, attackSpeedMult: 0.85, recoveryMult: 0.7 },
  exhausted: { speedMult: 0.4,  jumpMult: 0.5,  attackSpeedMult: 0.7,  recoveryMult: 0.4 },
};

// ---------------------------------------------------------------------------
// Thresholds — stamina percentage boundaries that determine the fatigue tier.
// Hysteresis: to leave a tier you must exceed the *upper* band by ≥5 so
// a player who hovers near a boundary doesn't oscillate every frame.
// ---------------------------------------------------------------------------
const EXHAUSTED_ENTER = 10;   // stamina ≤ 10% → exhausted
const EXHAUSTED_EXIT  = 20;
const TIRED_ENTER     = 35;   // stamina ≤ 35% → tired
const TIRED_EXIT      = 45;
const RESTED_ENTER    = 90;   // stamina ≥ 90% → rested
const RESTED_EXIT     = 80;

// ---------------------------------------------------------------------------
// Drain rates (stamina units per second of continuous action)
// ---------------------------------------------------------------------------
export const DRAIN_RATES = {
  sprint:    12,   // per second while sprinting
  climb:     16,   // per second while climbing (2× idle-recovery rate)
  swim:      18,   // per second while swimming (1.5× sprint)
  comboPer:   8,   // flat cost per combo hit beyond the 3rd in a chain
  heavyFlat: 15,   // flat cost to initiate a heavy attack
  jump:       5,   // flat cost per jump
  dodge:      8,   // flat cost per dodge/roll
  block:      3,   // per second while holding block
} as const;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export interface FatigueState {
  level: FatigueLevel;
  modifiers: FatigueModifiers;
  /** Continuous exertion accumulator (seconds of sustained activity). */
  exertionAccum: number;
  /** Tracks combo chain length for fatigue drain escalation. */
  comboChain: number;

  // --- Actions ---
  /** Call every frame from Player.tsx with the frame delta + activity flags. */
  tick: (delta: number, activity: ActivityFlags) => void;
  /** Call on combo hit to track chain length + drain stamina. */
  registerComboHit: () => void;
  /** Reset combo chain (on ATTACK_DONE or idle timeout). */
  resetCombo: () => void;
  /** Grant a fatigue recovery burst (e.g. perfect parry/dodge). */
  perfectActionBurst: (amount: number) => void;
  /** Force recalculate fatigue level from current stamina. */
  recalc: () => void;
}

export interface ActivityFlags {
  sprinting: boolean;
  climbing: boolean;
  swimming: boolean;
  blocking: boolean;
  idle: boolean;
}

function resolveLevel(staminaPct: number, prev: FatigueLevel): FatigueLevel {
  // Evaluate with hysteresis — once you enter a tier you need to clear
  // a higher threshold to leave it.
  if (prev === "exhausted") {
    if (staminaPct > EXHAUSTED_EXIT) return staminaPct <= TIRED_ENTER ? "tired" : "normal";
    return "exhausted";
  }
  if (prev === "tired") {
    if (staminaPct <= EXHAUSTED_ENTER) return "exhausted";
    if (staminaPct > TIRED_EXIT) return staminaPct >= RESTED_ENTER ? "rested" : "normal";
    return "tired";
  }
  if (prev === "rested") {
    if (staminaPct < RESTED_EXIT) return staminaPct <= TIRED_ENTER ? "tired" : "normal";
    return "rested";
  }
  // normal
  if (staminaPct <= EXHAUSTED_ENTER) return "exhausted";
  if (staminaPct <= TIRED_ENTER) return "tired";
  if (staminaPct >= RESTED_ENTER) return "rested";
  return "normal";
}

export const useFatigue = create<FatigueState>()(
  subscribeWithSelector((set, get) => ({
    level: "normal" as FatigueLevel,
    modifiers: FATIGUE_MODIFIERS.normal,
    exertionAccum: 0,
    comboChain: 0,

    tick: (delta: number, activity: ActivityFlags) => {
      const survival = useSurvival.getState();
      const maxStam = survival.maxStamina || 100;

      // --- Drain ---
      let drain = 0;
      if (activity.sprinting) drain += DRAIN_RATES.sprint * delta;
      if (activity.climbing)  drain += DRAIN_RATES.climb * delta;
      if (activity.swimming)  drain += DRAIN_RATES.swim * delta;
      if (activity.blocking)  drain += DRAIN_RATES.block * delta;

      if (drain > 0) {
        survival.useStamina(drain);
      }

      // --- Exertion accumulator (drives subtle long-term fatigue) ---
      const isExerting = activity.sprinting || activity.climbing || activity.swimming;
      set((s) => ({
        exertionAccum: isExerting
          ? s.exertionAccum + delta
          : Math.max(0, s.exertionAccum - delta * 0.5),
      }));

      // --- Idle recovery bonus ---
      // When truly idle (not exerting, not blocking), regen gets a small
      // boost on top of the normal hunger-driven regen in useSurvival.
      // This reward loop encourages "catch your breath" moments.
      if (activity.idle && !isExerting && !activity.blocking) {
        const state = get();
        const bonus = 3.0 * delta * state.modifiers.recoveryMult;
        survival.restoreStamina(bonus);
      }

      // --- Resolve fatigue level ---
      const staminaPct = (survival.stamina / maxStam) * 100;
      const prev = get().level;
      const next = resolveLevel(staminaPct, prev);
      if (next !== prev) {
        set({ level: next, modifiers: FATIGUE_MODIFIERS[next] });
      }
    },

    registerComboHit: () => {
      const state = get();
      const chain = state.comboChain + 1;
      set({ comboChain: chain });
      // Combos past 3 hits start draining stamina
      if (chain > 3) {
        useSurvival.getState().useStamina(DRAIN_RATES.comboPer);
      }
    },

    resetCombo: () => set({ comboChain: 0 }),

    perfectActionBurst: (amount: number) => {
      useSurvival.getState().restoreStamina(amount);
      // Immediately recalc since a burst can push us out of exhausted
      const survival = useSurvival.getState();
      const staminaPct = (survival.stamina / (survival.maxStamina || 100)) * 100;
      const prev = get().level;
      const next = resolveLevel(staminaPct, prev);
      if (next !== prev) {
        set({ level: next, modifiers: FATIGUE_MODIFIERS[next] });
      }
    },

    recalc: () => {
      const survival = useSurvival.getState();
      const staminaPct = (survival.stamina / (survival.maxStamina || 100)) * 100;
      const prev = get().level;
      const next = resolveLevel(staminaPct, prev);
      if (next !== prev) {
        set({ level: next, modifiers: FATIGUE_MODIFIERS[next] });
      }
    },
  }))
);

// ---------------------------------------------------------------------------
// Convenience selectors for per-frame reads (avoids object destructuring in
// hot paths like useFrame).
// ---------------------------------------------------------------------------
export const selectSpeedMult      = (s: FatigueState) => s.modifiers.speedMult;
export const selectJumpMult       = (s: FatigueState) => s.modifiers.jumpMult;
export const selectAttackSpeedMult = (s: FatigueState) => s.modifiers.attackSpeedMult;
export const selectFatigueLevel   = (s: FatigueState) => s.level;
export const selectIsExhausted    = (s: FatigueState) => s.level === "exhausted";
