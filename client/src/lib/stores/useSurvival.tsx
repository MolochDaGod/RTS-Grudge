import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useDamageFlash, type DamageFlashSource } from "./useDamageFlash";

// Map a survival DamageType into the tinted family the HUD vignette
// understands. Physical-impact types share the red flash; magic and
// fall get their own colors so the player can read what hit them.
function damageTypeToFlashSource(type: DamageType): DamageFlashSource {
  switch (type) {
    case "burn": return "burn";
    case "poison": return "poison";
    case "fall": return "fall";
    case "blade":
    case "impact":
    case "pierce":
    default: return "physical";
  }
}

// Fire the HUD vignette for any HP loss > 0. Wrapped in try/catch so a
// store-init race can never tear down a damage application — the flash
// is a UX nicety, not a gameplay-critical step.
function flashIfDamaged(amountDealt: number, type: DamageType) {
  if (amountDealt <= 0) return;
  try {
    useDamageFlash.getState().triggerHit(amountDealt, damageTypeToFlashSource(type));
  } catch {}
}

// Starvation drains HP every frame (0.5/sec via hungerTick, plus any
// explicit takeDamage("starve") calls). A flash on every tick would
// strobe the screen, so we accumulate damage and only emit one pulse
// every STARVE_FLASH_INTERVAL_S — long enough to read, short enough
// that the player still gets repeated reminders that they're starving.
const STARVE_FLASH_INTERVAL_S = 1.5;
let _starveFlashAccum = 0;
let _starveFlashLastAt = 0;
// Dodge-proc broadcast. When the dodge/evasion roll inside takeDamage
// avoids an incoming hit, we want the player rig to play its dodge_proc
// animation. The store can't reach into Player.tsx directly, so we use
// a tiny listener registry — Player subscribes during mount and we fire
// every listener on a successful dodge. Try/catch isolates one bad
// listener from blocking the others.
type DodgeProcListener = (incomingType: DamageType, incomingAmount: number) => void;
const _dodgeProcListeners = new Set<DodgeProcListener>();
export function onDodgeProc(fn: DodgeProcListener): () => void {
  _dodgeProcListeners.add(fn);
  return () => { _dodgeProcListeners.delete(fn); };
}
function emitDodgeProc(type: DamageType, amount: number) {
  for (const fn of _dodgeProcListeners) {
    try { fn(type, amount); } catch {}
  }
}

function flashStarve(amountDealt: number) {
  if (amountDealt <= 0) return;
  _starveFlashAccum += amountDealt;
  const now = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
  if (now - _starveFlashLastAt < STARVE_FLASH_INTERVAL_S) return;
  _starveFlashLastAt = now;
  const dmg = _starveFlashAccum;
  _starveFlashAccum = 0;
  try {
    // Reuse the physical (red) tint — there's no dedicated "starve"
    // family, and red reads as "you're losing HP" which is the point.
    useDamageFlash.getState().triggerHit(dmg, "physical");
  } catch {}
}

export type HungerStatus = "well_fed" | "normal" | "hungry" | "starving";

export function getHungerStatus(hunger: number): HungerStatus {
  if (hunger > 80) return "well_fed";
  if (hunger > 30) return "normal";
  if (hunger > 0) return "hungry";
  return "starving";
}

export function getHungerStaminaRegenMult(status: HungerStatus): number {
  switch (status) {
    case "well_fed": return 1.25;
    case "normal": return 1.0;
    case "hungry": return 0.7;
    case "starving": return 0.5;
  }
}

export function getHungerHealthRegenAllowed(status: HungerStatus): boolean {
  return status === "well_fed" || status === "normal";
}

export interface SurvivalState {
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  stamina: number;
  maxStamina: number;
  isAlive: boolean;
  activeCharacterId: string | null;
  lastDamageWasStarve: boolean;

  takeDamage: (amount: number, type: DamageType) => void;
  heal: (amount: number) => void;
  eat: (amount: number, healOverride?: number) => void;
  restoreStamina: (amount: number) => void;
  useStamina: (amount: number) => boolean;
  regenStamina: (delta: number) => void;
  hungerTick: (delta: number) => void;
  setActiveCharacter: (id: string) => void;
  reset: () => void;
}

export type DamageType = "blade" | "impact" | "pierce" | "burn" | "poison" | "fall" | "starve";

interface CombatStats {
  defense: number;
  resistance: number;
  dodge: number;
  block: number;
  blockEffect: number;
  armor: number;
  damageReduction: number;
  fallDamage: number;
  critEvasion: number;
  ccResistance: number;
  bleedResist: number;
  evasion: number;
}
type StatLookup = (charId: string | null) => CombatStats | null;
let _statLookup: StatLookup | null = null;
export function registerStatLookup(fn: StatLookup) { _statLookup = fn; }

const INITIAL_STATE = {
  health: 200,
  maxHealth: 200,
  hunger: 100,
  maxHunger: 100,
  stamina: 100,
  maxStamina: 100,
  isAlive: true,
  activeCharacterId: null as string | null,
  lastDamageWasStarve: false,
};

export const useSurvival = create<SurvivalState>()(
  subscribeWithSelector((set, get) => ({
    ...INITIAL_STATE,

    setActiveCharacter: (id: string) => set({ activeCharacterId: id }),

    takeDamage: (amount: number, type: DamageType) => {
      const state = get();
      // Every branch below routes the *post-mitigation* HP loss through
      // `flashIfDamaged` so any damage path (projectile, melee, trap,
      // fall, status) automatically pulses the HUD vignette — no need
      // for callers to remember to fire it themselves. Dodged hits skip
      // the flash because no HP was actually lost.
      // Starve damage ticks every frame while hunger is at 0, so the
      // flash for it is throttled (see `flashStarve`) instead of
      // strobing on each tick.
      if (type === "starve") {
        const newHealth = Math.max(0, state.health - amount);
        const dealt = state.health - newHealth;
        set({ health: newHealth, isAlive: newHealth > 0, lastDamageWasStarve: true });
        flashStarve(dealt);
        return;
      }
      set({ lastDamageWasStarve: false });

      const stats = _statLookup?.(state.activeCharacterId);

      if (type === "fall") {
        let fallAmount = amount;
        if (stats) {
          const fallReduction = Math.min(50, Math.abs(stats.fallDamage));
          fallAmount = amount * (1 - fallReduction / 100);
        }
        const dealt = Math.max(0, Math.round(fallAmount));
        const newHealth = Math.max(0, state.health - dealt);
        set({ health: newHealth, isAlive: newHealth > 0 });
        flashIfDamaged(dealt, type);
        return;
      }

      if (stats) {
        const effectiveDodge = stats.dodge + stats.evasion * 0.5;
        if (Math.random() * 100 < effectiveDodge) {
          // Dodge succeeded — broadcast so the player rig can play its
          // dodge_proc animation. No HP was lost, so we deliberately
          // skip the damage flash.
          emitDodgeProc(type, amount);
          return;
        }

        const isMagic = type === "burn" || type === "poison";
        const baseDef = isMagic ? stats.resistance : stats.defense;
        const armorBonus = isMagic ? 0 : stats.armor * 0.5;
        const totalDef = baseDef + armorBonus;
        const defReduction = totalDef / (totalDef + 100);
        let reduced = amount * (1 - defReduction);

        if (stats.damageReduction > 0) {
          const drPct = Math.min(50, stats.damageReduction) / 100;
          reduced *= (1 - drPct);
        }

        if (type === "blade" && stats.bleedResist > 0) {
          const brPct = Math.min(75, stats.bleedResist) / 100;
          reduced *= (1 - brPct * 0.3);
        }

        if (Math.random() * 100 < stats.block) {
          const blockPct = Math.min(90, stats.blockEffect) / 100;
          reduced *= (1 - blockPct);
        }

        const dealt = Math.max(1, Math.round(reduced));
        const newHealth = Math.max(0, state.health - dealt);
        set({ health: newHealth, isAlive: newHealth > 0 });
        flashIfDamaged(dealt, type);
        return;
      }

      const fallbackDef = 10;
      const defReduction = fallbackDef / (fallbackDef + 100);
      const reduced = amount * (1 - defReduction);
      const dealt = Math.max(1, Math.round(reduced));
      const newHealth = Math.max(0, state.health - dealt);
      set({ health: newHealth, isAlive: newHealth > 0 });
      flashIfDamaged(dealt, type);
    },

    heal: (amount: number) => {
      set((state) => ({
        health: Math.min(state.maxHealth, state.health + amount),
      }));
    },

    eat: (amount: number, healOverride?: number) => {
      set((state) => {
        const newHunger = Math.min(state.maxHunger, state.hunger + amount);
        const healAmount = healOverride !== undefined ? healOverride : amount * 0.3;
        return {
          hunger: newHunger,
          health: Math.min(state.maxHealth, state.health + healAmount),
        };
      });
    },

    restoreStamina: (amount: number) => {
      set((state) => ({
        stamina: Math.min(state.maxStamina, state.stamina + amount),
      }));
    },

    useStamina: (amount: number) => {
      const { stamina } = get();
      if (stamina < amount) return false;
      set({ stamina: stamina - amount });
      return true;
    },

    regenStamina: (delta: number) => {
      set((state) => {
        const status = getHungerStatus(state.hunger);
        const staminaRegenMult = getHungerStaminaRegenMult(status);
        return {
          stamina: Math.min(state.maxStamina, state.stamina + 15 * delta * staminaRegenMult),
        };
      });
    },

    hungerTick: (delta: number) => {
      let starveDealt = 0;
      set((state) => {
        const hungerLoss = 0.15 * delta;
        const newHunger = Math.max(0, state.hunger - hungerLoss);
        if (newHunger <= 0 && state.isAlive) {
          const starveDamage = 0.5 * delta;
          const newHealth = Math.max(0, state.health - starveDamage);
          starveDealt = state.health - newHealth;
          return {
            hunger: 0,
            health: newHealth,
            isAlive: newHealth > 0,
            lastDamageWasStarve: true,
          };
        }
        return { hunger: newHunger, lastDamageWasStarve: false };
      });
      // Throttled inside flashStarve so the per-frame trickle doesn't
      // strobe the screen — keeps coverage of the "all damage paths"
      // promise without wrecking the UX.
      flashStarve(starveDealt);
    },

    reset: () => {
      // Clear the throttled starve-flash bookkeeping so a fresh run
      // doesn't inherit accumulated damage from the previous death.
      _starveFlashAccum = 0;
      _starveFlashLastAt = 0;
      set(INITIAL_STATE);
    },
  }))
);
