import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type EquipSlot = "helm" | "shoulder" | "chest" | "legs" | "boots" | "belt" | "mainHand" | "offHand" | "gloves" | "cape" | "ring" | "necklace";

export type ItemTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// WCS canonical tier labels (D5 rename: T5=Heroic, T8=Legendary)
export const TIER_INFO: Record<ItemTier, { label: string; color: string; glow: string }> = {
  1: { label: "Common",    color: "#8b7355", glow: "none" },
  2: { label: "Uncommon",  color: "#a8a8a8", glow: "0 0 4px #a8a8a844" },
  3: { label: "Rare",      color: "#4a9eff", glow: "0 0 6px #4a9eff44" },
  4: { label: "Epic",      color: "#9d4dff", glow: "0 0 8px #9d4dff44" },
  5: { label: "Heroic",    color: "#e05050", glow: "0 0 10px #e0505066" },
  6: { label: "Mythic",    color: "#ffaa00", glow: "0 0 12px #ffaa0066" },
  7: { label: "Ancient",   color: "#d4a84b", glow: "0 0 14px #d4a84b88" },
  8: { label: "Legendary", color: "#f0d890", glow: "0 0 18px #f0d890aa, 0 0 32px #f0d89044" },
};

export const CDN_BASE = "https://molochdagod.github.io/ObjectStore/icons/pack";

export interface EquipItem {
  id: string;
  name: string;
  slot: EquipSlot;
  icon: string;
  iconUrl?: string;
  tier: ItemTier;
  stats: Partial<Record<StatKey, number>>;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic" | "ancient" | "artifact";
  weaponType?: string;
}

export type StatKey = "health" | "mana" | "stamina" | "damage" | "defense" | "block" | "critChance" | "critDamage" | "attackSpeed" | "movementSpeed" | "accuracy" | "resistance" | "armor" | "armorPenetration" | "healthRegen" | "manaRegen" | "evasion" | "cooldownReduction" | "drainHealth" | "stagger" | "spellAccuracy" | "dodge";

export interface ActionSlot {
  key: string;
  label: string;
  animationName: string | null;
  cooldown: number;
  lastUsed: number;
  icon: string;
  type: "attack" | "skill" | "item" | "empty";
}

const DEFAULT_ACTION_SLOTS: ActionSlot[] = [
  { key: "1", label: "Skill 1", animationName: "skill1", cooldown: 3, lastUsed: 0, icon: "🔥", type: "skill" },
  { key: "2", label: "Skill 2", animationName: "skill2", cooldown: 4, lastUsed: 0, icon: "⬆️", type: "skill" },
  { key: "3", label: "Skill 3", animationName: "skill3", cooldown: 5, lastUsed: 0, icon: "🌀", type: "skill" },
  { key: "4", label: "Skill 4", animationName: "skill4", cooldown: 3, lastUsed: 0, icon: "👊", type: "attack" },
  { key: "5", label: "Skill 5", animationName: "skill5", cooldown: 4, lastUsed: 0, icon: "💫", type: "attack" },
  { key: "6", label: "Empty", animationName: null, cooldown: 0, lastUsed: 0, icon: "", type: "empty" },
  { key: "7", label: "Empty", animationName: null, cooldown: 0, lastUsed: 0, icon: "", type: "empty" },
  { key: "8", label: "Empty", animationName: null, cooldown: 0, lastUsed: 0, icon: "", type: "empty" },
];

interface EquipmentState {
  equipped: Partial<Record<EquipSlot, EquipItem>>;
  actionSlots: ActionSlot[];
  level: number;
  experience: number;
  experienceToNext: number;
  gold: number;
  mana: number;
  maxMana: number;

  equip: (item: EquipItem) => void;
  unequip: (slot: EquipSlot) => void;
  getEquipped: (slot: EquipSlot) => EquipItem | undefined;
  getTotalStats: () => Partial<Record<StatKey, number>>;
  setActionSlot: (index: number, slot: Partial<ActionSlot>) => void;
  clearActionSlot: (index: number) => void;
  useAction: (index: number) => boolean;
  addGold: (amount: number) => void;
  addExperience: (amount: number) => void;
  useMana: (amount: number) => boolean;
  regenMana: (delta: number) => void;
  reset: () => void;
  /** Save equipped state to localStorage */
  persist: () => void;
  /** Load equipped state from localStorage */
  hydrate: () => void;
  /**
   * Cape active ability cooldown. Tracks when the cape ability was last used
   * so no-swap enforcement can detect if the cooldown is still running.
   * Value is a unix timestamp (seconds). 0 = never used.
   */
  capeAbilityLastUsed: number;
  capeAbilityCooldown: number; // seconds
  /**
   * Attempt to use the equipped cape's active ability.
   * Returns false if on cooldown or no cape equipped.
   */
  useCapeAbility: () => { ok: boolean; effect?: string; remainingCd?: number };
  /**
   * Enforce no-swap: returns true if a cape is equipped AND its cooldown
   * hasn't expired yet (i.e. swapping should be blocked).
   */
  isCapeSwapLocked: () => boolean;
}

const SLOT_ORDER: EquipSlot[] = ["helm", "shoulder", "chest", "legs", "boots", "belt", "mainHand", "offHand", "gloves", "cape", "ring", "necklace"];

export { SLOT_ORDER };

const EQUIPMENT_PERSIST_KEY = "grudge_equipment_state";

function loadPersistedEquipment(): Partial<EquipmentState> {
  try {
    const raw = localStorage.getItem(EQUIPMENT_PERSIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      equipped:  parsed.equipped  ?? {},
      gold:      parsed.gold      ?? 0,
      level:     parsed.level     ?? 1,
      experience:parsed.experience ?? 0,
      experienceToNext: parsed.experienceToNext ?? 100,
    };
  } catch {
    return {};
  }
}

export const useEquipment = create<EquipmentState>()(subscribeWithSelector((set, get) => ({
  equipped: {},
  actionSlots: [...DEFAULT_ACTION_SLOTS],
  level: 1,
  experience: 0,
  experienceToNext: 100,
  gold: 0,
  mana: 50,
  maxMana: 50,
  capeAbilityLastUsed: 0,
  capeAbilityCooldown: 0,
  ...loadPersistedEquipment(),

  equip: (item) => {
    // Cape swap enforcement: block if cape ability is still on cooldown
    if (item.slot === "cape") {
      const { capeAbilityLastUsed, capeAbilityCooldown } = get();
      const now = Date.now() / 1000;
      if (capeAbilityLastUsed > 0 && now - capeAbilityLastUsed < capeAbilityCooldown) {
        const remaining = Math.ceil(capeAbilityCooldown - (now - capeAbilityLastUsed));
        console.warn(`[Equipment] Cape swap blocked — ability on cooldown (${remaining}s remaining)`);
        return; // hard block, no swap
      }
      // Equipping a new cape resets the cooldown to that cape's CD (from ArmorPrefabDatabase)
      // The cooldown value is looked up by the caller or set from capeActive.cooldownSeconds
    }
    set((state) => ({
      equipped: { ...state.equipped, [item.slot]: item },
    }));
    get().persist();
  },

  unequip: (slot) => {
    // Cape unequip also blocked while ability is on cooldown
    if (slot === "cape") {
      const { capeAbilityLastUsed, capeAbilityCooldown } = get();
      const now = Date.now() / 1000;
      if (capeAbilityLastUsed > 0 && now - capeAbilityLastUsed < capeAbilityCooldown) {
        const remaining = Math.ceil(capeAbilityCooldown - (now - capeAbilityLastUsed));
        console.warn(`[Equipment] Cape unequip blocked — ability on cooldown (${remaining}s remaining)`);
        return;
      }
    }
    set((state) => {
      const newEquipped = { ...state.equipped };
      delete newEquipped[slot];
      return { equipped: newEquipped };
    });
    get().persist();
  },

  getEquipped: (slot) => get().equipped[slot],

  getTotalStats: () => {
    const { equipped } = get();
    const totals: Partial<Record<StatKey, number>> = {};
    for (const item of Object.values(equipped)) {
      if (!item) continue;
      for (const [key, val] of Object.entries(item.stats)) {
        const k = key as StatKey;
        totals[k] = (totals[k] || 0) + (val || 0);
      }
    }
    return totals;
  },

  setActionSlot: (index, partial) => {
    set((state) => {
      const slots = [...state.actionSlots];
      slots[index] = { ...slots[index], ...partial };
      return { actionSlots: slots };
    });
  },

  clearActionSlot: (index) => {
    set((state) => {
      const slots = [...state.actionSlots];
      slots[index] = { key: slots[index].key, label: "Empty", animationName: null, cooldown: 0, lastUsed: 0, icon: "", type: "empty" };
      return { actionSlots: slots };
    });
  },

  useAction: (index) => {
    const { actionSlots, mana } = get();
    const slot = actionSlots[index];
    if (!slot || slot.type === "empty" || !slot.animationName) return false;
    const now = Date.now() / 1000;
    if (now - slot.lastUsed < slot.cooldown) return false;

    const manaCost = slot.type === "skill" ? 10 : 0;
    if (mana < manaCost) return false;

    set((state) => {
      const slots = [...state.actionSlots];
      slots[index] = { ...slots[index], lastUsed: now };
      return { actionSlots: slots, mana: state.mana - manaCost };
    });
    return true;
  },

  addGold: (amount) => set((state) => ({ gold: state.gold + amount })),

  addExperience: (amount) => {
    set((state) => {
      let exp = state.experience + amount;
      let lvl = state.level;
      let toNext = state.experienceToNext;
      while (exp >= toNext) {
        exp -= toNext;
        lvl++;
        toNext = Math.floor(toNext * 1.5);
      }
      return {
        experience: exp,
        level: lvl,
        experienceToNext: toNext,
        maxMana: 50 + (lvl - 1) * 10,
      };
    });
  },

  useMana: (amount) => {
    const { mana } = get();
    if (mana < amount) return false;
    set({ mana: mana - amount });
    return true;
  },

  regenMana: (delta) => {
    set((state) => ({
      mana: Math.min(state.maxMana, state.mana + 3 * delta),
    }));
  },

  reset: () => {
    set({
      equipped: {},
      actionSlots: [...DEFAULT_ACTION_SLOTS],
      level: 1,
      experience: 0,
      experienceToNext: 100,
      gold: 0,
      mana: 50,
      maxMana: 50,
      capeAbilityLastUsed: 0,
      capeAbilityCooldown: 0,
    });
    try { localStorage.removeItem(EQUIPMENT_PERSIST_KEY); } catch {}
  },

  persist: () => {
    const { equipped, gold, level, experience, experienceToNext } = get();
    try {
      localStorage.setItem(EQUIPMENT_PERSIST_KEY, JSON.stringify({
        equipped, gold, level, experience, experienceToNext,
      }));
    } catch {
      console.warn("[Equipment] Could not persist to localStorage");
    }
  },

  hydrate: () => {
    const saved = loadPersistedEquipment();
    if (Object.keys(saved).length > 0) {
      set(saved as Partial<EquipmentState>);
    }
  },

  useCapeAbility: () => {
    const state = get();
    const cape = state.equipped.cape;
    if (!cape) return { ok: false };

    const now = Date.now() / 1000;
    const remaining = state.capeAbilityCooldown - (now - state.capeAbilityLastUsed);
    if (state.capeAbilityLastUsed > 0 && remaining > 0) {
      return { ok: false, remainingCd: Math.ceil(remaining) };
    }

    // Lookup the ArmorPrefab for this cape to get its active ability + cooldown
    // We import lazily to avoid circular deps
    try {
      const { getArmorById } = require("@/lib/data/ArmorPrefabDatabase");
      const armorPrefab = getArmorById(cape.id);
      const cooldown = armorPrefab?.capeActive?.cooldownSeconds ?? 30;
      const effect = armorPrefab?.capeActive?.effect ?? "";
      set({ capeAbilityLastUsed: now, capeAbilityCooldown: cooldown });
      console.info(`[Equipment] Cape ability used: ${armorPrefab?.capeActive?.name ?? cape.name} (CD: ${cooldown}s, effect: ${effect})`);
      return { ok: true, effect, remainingCd: 0 };
    } catch {
      // Fallback for non-armor prefab capes
      set({ capeAbilityLastUsed: now, capeAbilityCooldown: 30 });
      return { ok: true };
    }
  },

  isCapeSwapLocked: () => {
    const { capeAbilityLastUsed, capeAbilityCooldown } = get();
    if (!capeAbilityLastUsed) return false;
    return (Date.now() / 1000 - capeAbilityLastUsed) < capeAbilityCooldown;
  },
})));
