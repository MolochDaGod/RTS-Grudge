import { create } from "zustand";

// ---------------------------------------------------------------------------
// Game Balance — Conan Exiles-style runtime multiplier config.
//
// Mirrors the 13-category structure from the Conan Exiles ServerSettings.ini
// schema (see conan-admin/server.js), adapted for Grudge Warlords 3D.
//
// Every multiplier defaults to 1.0. The admin panel (or backend API) can
// push overrides at any time — no code deploy needed to rebalance the game.
//
// Integration:
//   - Game systems read from `useGameBalance.getState()` each frame
//   - Backend pushes balance updates via `/api/balance` endpoint
//   - Admin panel renders the schema for live tuning
// ---------------------------------------------------------------------------

// --- Category definitions (matching Conan's structure) ---

export interface DamageBalance {
  playerDamageOutput: number;      // Player melee/ranged damage multiplier
  playerDamageTaken: number;       // Incoming damage to players
  npcDamageOutput: number;         // NPC/enemy damage multiplier
  npcDamageTaken: number;          // Incoming damage to NPCs
  npcHealthMultiplier: number;     // NPC base health scale
  npcRespawnSpeed: number;         // How fast NPCs respawn
  buildingDamage: number;          // Damage to player buildings
  petDamage: number;               // AI companion damage output
  petHealth: number;               // AI companion health scale
}

export interface SurvivalBalance {
  playerHealthMultiplier: number;  // Base health scale
  playerStaminaMultiplier: number; // Base stamina pool
  staminaCostMultiplier: number;   // All stamina drain rates
  sprintCostMultiplier: number;    // Sprint-specific drain
  hungerRate: number;              // Active hunger drain
  thirstRate: number;              // Active thirst drain (reserved)
  idleHungerRate: number;          // Idle hunger drain
  breathDuration: number;          // Underwater breath time (seconds)
  fallDamageMultiplier: number;    // Fall damage scale (0 = disabled)
}

export interface HarvestBalance {
  harvestAmount: number;           // Resource yield multiplier
  resourceRespawnSpeed: number;    // Node respawn rate
  weakSpotBonus: number;           // Crosshair weak-spot multiplier
  toolDurabilityDrain: number;     // Tool wear rate
}

export interface XPBalance {
  xpRate: number;                  // Global XP multiplier
  xpFromKills: number;            // Kill XP multiplier
  xpFromHarvest: number;          // Harvest XP multiplier
  xpFromCrafting: number;         // Crafting XP multiplier
  xpOverTime: number;             // Passive XP tick rate
}

export interface CraftingBalance {
  craftingTime: number;            // Crafting duration multiplier
  fuelBurnTime: number;            // Furnace fuel efficiency
  recipeUnlockLevel: number;       // Level scaling for recipe unlocks
}

export interface CombatBalance {
  comboWindow: number;             // Combo input timing multiplier
  dodgeCost: number;               // Dodge/roll stamina cost scale
  blockDrain: number;              // Block stamina drain scale
  parryWindow: number;             // Perfect parry timing multiplier
  heavyAttackCost: number;         // Heavy attack stamina cost scale
}

export interface WorldBalance {
  dayCycleSpeed: number;           // Day/night cycle speed
  dayTimeSpeed: number;            // Daytime duration
  nightTimeSpeed: number;          // Nighttime duration
  waterCurrentStrength: number;    // Water current force multiplier
}

export interface GameBalanceConfig {
  version: string;
  damage: DamageBalance;
  survival: SurvivalBalance;
  harvest: HarvestBalance;
  xp: XPBalance;
  crafting: CraftingBalance;
  combat: CombatBalance;
  world: WorldBalance;
}

// --- Defaults (everything at 1.0 = vanilla) ---

const DEFAULT_BALANCE: GameBalanceConfig = {
  version: "1.0.0",
  damage: {
    playerDamageOutput: 1.0,
    playerDamageTaken: 1.0,
    npcDamageOutput: 1.0,
    npcDamageTaken: 1.0,
    npcHealthMultiplier: 1.0,
    npcRespawnSpeed: 1.0,
    buildingDamage: 1.0,
    petDamage: 1.0,
    petHealth: 1.0,
  },
  survival: {
    playerHealthMultiplier: 1.0,
    playerStaminaMultiplier: 1.0,
    staminaCostMultiplier: 1.0,
    sprintCostMultiplier: 1.0,
    hungerRate: 1.0,
    thirstRate: 1.0,
    idleHungerRate: 1.0,
    breathDuration: 30.0,
    fallDamageMultiplier: 1.0,
  },
  harvest: {
    harvestAmount: 1.0,
    resourceRespawnSpeed: 1.0,
    weakSpotBonus: 1.5,
    toolDurabilityDrain: 1.0,
  },
  xp: {
    xpRate: 1.0,
    xpFromKills: 1.0,
    xpFromHarvest: 1.0,
    xpFromCrafting: 1.0,
    xpOverTime: 1.0,
  },
  crafting: {
    craftingTime: 1.0,
    fuelBurnTime: 1.0,
    recipeUnlockLevel: 1.0,
  },
  combat: {
    comboWindow: 1.0,
    dodgeCost: 1.0,
    blockDrain: 1.0,
    parryWindow: 1.0,
    heavyAttackCost: 1.0,
  },
  world: {
    dayCycleSpeed: 1.0,
    dayTimeSpeed: 1.0,
    nightTimeSpeed: 1.0,
    waterCurrentStrength: 1.0,
  },
};

// --- Zustand store ---

interface GameBalanceState extends GameBalanceConfig {
  /** Replace the entire config (e.g. from backend fetch). */
  loadConfig: (cfg: Partial<GameBalanceConfig>) => void;
  /** Patch a single category. */
  patchCategory: <K extends keyof GameBalanceConfig>(
    category: K,
    patch: Partial<GameBalanceConfig[K]>,
  ) => void;
  /** Reset everything to defaults. */
  resetDefaults: () => void;
}

export const useGameBalance = create<GameBalanceState>((set) => ({
  ...DEFAULT_BALANCE,

  loadConfig: (cfg) => set((s) => ({
    ...s,
    ...cfg,
    damage: { ...s.damage, ...cfg.damage },
    survival: { ...s.survival, ...cfg.survival },
    harvest: { ...s.harvest, ...cfg.harvest },
    xp: { ...s.xp, ...cfg.xp },
    crafting: { ...s.crafting, ...cfg.crafting },
    combat: { ...s.combat, ...cfg.combat },
    world: { ...s.world, ...cfg.world },
  })),

  patchCategory: (category, patch) => set((s) => {
    const current = s[category];
    if (typeof current === "object" && current !== null) {
      return { [category]: { ...current, ...patch } } as any;
    }
    return {};
  }),

  resetDefaults: () => set(DEFAULT_BALANCE),
}));

// --- Convenience accessors for hot paths ---

export function getDamageBalance(): DamageBalance {
  return useGameBalance.getState().damage;
}

export function getSurvivalBalance(): SurvivalBalance {
  return useGameBalance.getState().survival;
}

export function getHarvestBalance(): HarvestBalance {
  return useGameBalance.getState().harvest;
}

export function getCombatBalance(): CombatBalance {
  return useGameBalance.getState().combat;
}

// --- Schema export (for admin panel rendering) ---

export interface BalanceFieldMeta {
  key: string;
  label: string;
  type: "float" | "int";
  default: number;
  min: number;
  max: number;
  step: number;
}

export const BALANCE_SCHEMA: Record<string, { label: string; fields: BalanceFieldMeta[] }> = {
  damage: {
    label: "Damage Model",
    fields: [
      { key: "playerDamageOutput",  label: "Player Damage Output",  type: "float", default: 1, min: 0,   max: 10, step: 0.05 },
      { key: "playerDamageTaken",   label: "Player Damage Taken",   type: "float", default: 1, min: 0,   max: 10, step: 0.05 },
      { key: "npcDamageOutput",     label: "NPC Damage Output",     type: "float", default: 1, min: 0,   max: 10, step: 0.1  },
      { key: "npcHealthMultiplier", label: "NPC Health",            type: "float", default: 1, min: 0.1, max: 10, step: 0.1  },
      { key: "npcRespawnSpeed",     label: "NPC Respawn Speed",     type: "float", default: 1, min: 0.1, max: 10, step: 0.1  },
      { key: "petDamage",           label: "Pet/Ally Damage",       type: "float", default: 1, min: 0,   max: 10, step: 0.1  },
      { key: "petHealth",           label: "Pet/Ally Health",       type: "float", default: 1, min: 0.1, max: 10, step: 0.1  },
    ],
  },
  survival: {
    label: "Stamina & Survival",
    fields: [
      { key: "playerHealthMultiplier",  label: "Player Health",       type: "float", default: 1,  min: 0.1, max: 10, step: 0.1  },
      { key: "playerStaminaMultiplier", label: "Player Stamina Pool", type: "float", default: 1,  min: 0.1, max: 10, step: 0.1  },
      { key: "staminaCostMultiplier",   label: "Stamina Cost",        type: "float", default: 1,  min: 0.1, max: 5,  step: 0.05 },
      { key: "sprintCostMultiplier",    label: "Sprint Cost",         type: "float", default: 1,  min: 0.1, max: 5,  step: 0.05 },
      { key: "hungerRate",              label: "Hunger Rate",         type: "float", default: 1,  min: 0,   max: 5,  step: 0.1  },
      { key: "breathDuration",          label: "Breath Duration (s)", type: "float", default: 30, min: 5,   max: 120,step: 5    },
      { key: "fallDamageMultiplier",    label: "Fall Damage",         type: "float", default: 1,  min: 0,   max: 3,  step: 0.1  },
    ],
  },
  harvest: {
    label: "Harvest & Resources",
    fields: [
      { key: "harvestAmount",        label: "Harvest Amount",        type: "float", default: 1,   min: 0.1, max: 10, step: 0.1 },
      { key: "resourceRespawnSpeed", label: "Resource Respawn Speed",type: "float", default: 1,   min: 0.1, max: 10, step: 0.1 },
      { key: "weakSpotBonus",        label: "Weak Spot Bonus",       type: "float", default: 1.5, min: 1,   max: 5,  step: 0.1 },
      { key: "toolDurabilityDrain",  label: "Tool Durability Drain", type: "float", default: 1,   min: 0.1, max: 5,  step: 0.1 },
    ],
  },
  xp: {
    label: "XP & Progression",
    fields: [
      { key: "xpRate",         label: "XP Rate",          type: "float", default: 1, min: 0.1, max: 10, step: 0.1 },
      { key: "xpFromKills",    label: "XP from Kills",    type: "float", default: 1, min: 0.1, max: 10, step: 0.1 },
      { key: "xpFromHarvest",  label: "XP from Harvesting",type: "float",default: 1, min: 0.1, max: 10, step: 0.1 },
      { key: "xpFromCrafting", label: "XP from Crafting",  type: "float",default: 1, min: 0.1, max: 10, step: 0.1 },
    ],
  },
  crafting: {
    label: "Crafting",
    fields: [
      { key: "craftingTime", label: "Crafting Time",    type: "float", default: 1, min: 0.01, max: 10, step: 0.1 },
      { key: "fuelBurnTime", label: "Fuel Burn Time",   type: "float", default: 1, min: 0.1,  max: 10, step: 0.1 },
    ],
  },
  combat: {
    label: "Combat Mechanics",
    fields: [
      { key: "comboWindow",      label: "Combo Window",       type: "float", default: 1, min: 0.5, max: 3, step: 0.1 },
      { key: "dodgeCost",        label: "Dodge Cost",         type: "float", default: 1, min: 0.1, max: 5, step: 0.1 },
      { key: "blockDrain",       label: "Block Stamina Drain",type: "float", default: 1, min: 0.1, max: 5, step: 0.1 },
      { key: "parryWindow",      label: "Parry Window",       type: "float", default: 1, min: 0.5, max: 3, step: 0.1 },
      { key: "heavyAttackCost",  label: "Heavy Attack Cost",  type: "float", default: 1, min: 0.1, max: 5, step: 0.1 },
    ],
  },
  world: {
    label: "Day / Night & World",
    fields: [
      { key: "dayCycleSpeed",         label: "Day Cycle Speed",          type: "float", default: 1, min: 0.1, max: 10, step: 0.1 },
      { key: "dayTimeSpeed",          label: "Daytime Speed",            type: "float", default: 1, min: 0.1, max: 10, step: 0.1 },
      { key: "nightTimeSpeed",        label: "Nighttime Speed",          type: "float", default: 1, min: 0.1, max: 10, step: 0.1 },
      { key: "waterCurrentStrength",  label: "Water Current Strength",   type: "float", default: 1, min: 0,   max: 5,  step: 0.1 },
    ],
  },
};
