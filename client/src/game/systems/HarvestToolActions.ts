/**
 * HarvestToolActions — defines the 4-slot action bar for each tool type.
 *
 * When the player swaps to harvest mode (Tab), slots 1–4 populate from
 * the held tool's action set instead of weapon skills:
 *
 *   Slot 1: Action  — primary manual swing/dig/cast (click-to-use)
 *   Slot 2: Action2 — secondary technique (precision, directional, combo)
 *   Slot 3: Auto    — toggle auto-harvest (AI takes over, drains stamina)
 *   Slot 4: Special — charged/area/rare-find ability (cooldown-gated)
 *
 * Each tool type maps to a profession and has tier-scaled effectiveness.
 * The same tier glow system from WeaponTierEffects applies to tools.
 */

import type { WeaponTier } from "./WeaponPrefabDatabase";

// ---------------------------------------------------------------------------
// Tool types and their professions
// ---------------------------------------------------------------------------
export type HarvestToolType = "pickaxe" | "axe" | "hoe" | "sickle" | "fishing_rod" | "shovel";

export const TOOL_PROFESSIONS: Record<HarvestToolType, string> = {
  pickaxe:     "mining",
  axe:         "logging",
  hoe:         "farming",
  sickle:      "herbalism",
  fishing_rod: "fishing",
  shovel:      "mining",
};

// ---------------------------------------------------------------------------
// Action slot definition
// ---------------------------------------------------------------------------
export type ActionSlotKind = "action" | "action2" | "auto" | "special";

export interface HarvestAction {
  /** Stable ID for hotbar persistence */
  id: string;
  /** Display name */
  name: string;
  /** Slot kind (determines position in the 4-slot bar) */
  kind: ActionSlotKind;
  /** HUD icon */
  icon: string;
  /** Animation clip name to play on use */
  animation: string;
  /** Cooldown in seconds (0 = no cooldown, just animation lock) */
  cooldown: number;
  /** Stamina cost per use (auto drains per tick instead) */
  staminaCost: number;
  /** For "auto" — stamina drain per second while toggled on */
  staminaDrainPerSec?: number;
  /** Harvest speed multiplier on top of the tool's base */
  harvestMult: number;
  /** Description shown in tooltip */
  description: string;
  /** Whether this is a toggle (auto-harvest) vs one-shot */
  isToggle?: boolean;
  /** Chance to find rare materials (special only) */
  rareFindBonus?: number;
  /** AoE radius for area actions (special only, meters) */
  aoeRadius?: number;
}

// ---------------------------------------------------------------------------
// Action sets per tool type
// ---------------------------------------------------------------------------
export const TOOL_ACTIONS: Record<HarvestToolType, HarvestAction[]> = {
  pickaxe: [
    {
      id: "pick_action", name: "Strike", kind: "action", icon: "⛏️",
      animation: "attack", cooldown: 0, staminaCost: 3, harvestMult: 1.0,
      description: "Swing the pickaxe at a rock or ore node.",
    },
    {
      id: "pick_action2", name: "Precision Chip", kind: "action2", icon: "🎯",
      animation: "heavyAttack", cooldown: 2, staminaCost: 5, harvestMult: 1.5,
      description: "Careful strike that yields higher quality ore fragments.",
    },
    {
      id: "pick_auto", name: "Auto-Mine", kind: "auto", icon: "🔄",
      animation: "attack", cooldown: 0, staminaCost: 0, staminaDrainPerSec: 4, harvestMult: 0.8,
      description: "Toggle automatic mining. Drains stamina while active.", isToggle: true,
    },
    {
      id: "pick_special", name: "Shatter Vein", kind: "special", icon: "💥",
      animation: "combo3", cooldown: 15, staminaCost: 20, harvestMult: 3.0,
      description: "Powerful strike that shatters the entire vein, harvesting all at once.",
      rareFindBonus: 0.15, aoeRadius: 3,
    },
  ],

  axe: [
    {
      id: "axe_action", name: "Chop", kind: "action", icon: "🪓",
      animation: "attack", cooldown: 0, staminaCost: 3, harvestMult: 1.0,
      description: "Chop a tree trunk to gather wood.",
    },
    {
      id: "axe_action2", name: "Undercut", kind: "action2", icon: "🌲",
      animation: "heavyAttack", cooldown: 2, staminaCost: 5, harvestMult: 1.5,
      description: "Strategic cut that increases plank yield from the log.",
    },
    {
      id: "axe_auto", name: "Auto-Chop", kind: "auto", icon: "🔄",
      animation: "attack", cooldown: 0, staminaCost: 0, staminaDrainPerSec: 4, harvestMult: 0.8,
      description: "Toggle automatic chopping. Drains stamina while active.", isToggle: true,
    },
    {
      id: "axe_special", name: "Timber!", kind: "special", icon: "🪵",
      animation: "combo3", cooldown: 12, staminaCost: 18, harvestMult: 2.5,
      description: "Fell the entire tree in one powerful swing. Bonus wood and chance for rare bark.",
      rareFindBonus: 0.1, aoeRadius: 2,
    },
  ],

  hoe: [
    {
      id: "hoe_action", name: "Till", kind: "action", icon: "🌱",
      animation: "attack", cooldown: 0, staminaCost: 2, harvestMult: 1.0,
      description: "Till the soil to prepare for planting or harvest crops.",
    },
    {
      id: "hoe_action2", name: "Deep Furrow", kind: "action2", icon: "🌾",
      animation: "heavyAttack", cooldown: 3, staminaCost: 4, harvestMult: 1.4,
      description: "Deep tilling that increases crop quality and yield.",
    },
    {
      id: "hoe_auto", name: "Auto-Farm", kind: "auto", icon: "🔄",
      animation: "attack", cooldown: 0, staminaCost: 0, staminaDrainPerSec: 3, harvestMult: 0.7,
      description: "Toggle automatic farming. Plants, waters, and harvests nearby plots.", isToggle: true,
    },
    {
      id: "hoe_special", name: "Bountiful Harvest", kind: "special", icon: "🌻",
      animation: "combo3", cooldown: 20, staminaCost: 15, harvestMult: 3.0,
      description: "Harvest all mature crops in a wide area with bonus yield.",
      rareFindBonus: 0.2, aoeRadius: 5,
    },
  ],

  sickle: [
    {
      id: "sickle_action", name: "Gather", kind: "action", icon: "🌿",
      animation: "attack", cooldown: 0, staminaCost: 2, harvestMult: 1.0,
      description: "Gather herbs, fibers, and plant materials.",
    },
    {
      id: "sickle_action2", name: "Careful Cut", kind: "action2", icon: "✂️",
      animation: "heavyAttack", cooldown: 2, staminaCost: 4, harvestMult: 1.6,
      description: "Precise cut that preserves delicate herb properties for higher potency.",
    },
    {
      id: "sickle_auto", name: "Auto-Gather", kind: "auto", icon: "🔄",
      animation: "attack", cooldown: 0, staminaCost: 0, staminaDrainPerSec: 3, harvestMult: 0.7,
      description: "Toggle automatic gathering of nearby herbs and plants.", isToggle: true,
    },
    {
      id: "sickle_special", name: "Nature's Bounty", kind: "special", icon: "🍀",
      animation: "combo3", cooldown: 18, staminaCost: 15, harvestMult: 2.5,
      description: "Channel nature energy to reveal and harvest all hidden herbs in the area.",
      rareFindBonus: 0.25, aoeRadius: 6,
    },
  ],

  fishing_rod: [
    {
      id: "rod_action", name: "Cast Line", kind: "action", icon: "🎣",
      animation: "attack", cooldown: 0, staminaCost: 2, harvestMult: 1.0,
      description: "Cast the fishing line into water.",
    },
    {
      id: "rod_action2", name: "Lure Swap", kind: "action2", icon: "🪱",
      animation: "pickup", cooldown: 5, staminaCost: 3, harvestMult: 1.3,
      description: "Switch to a specialized lure that attracts rarer fish.",
    },
    {
      id: "rod_auto", name: "Auto-Fish", kind: "auto", icon: "🔄",
      animation: "idle", cooldown: 0, staminaCost: 0, staminaDrainPerSec: 2, harvestMult: 0.6,
      description: "Toggle automatic fishing. Lower catch rate but hands-free.", isToggle: true,
    },
    {
      id: "rod_special", name: "Net Cast", kind: "special", icon: "🥅",
      animation: "combo3", cooldown: 25, staminaCost: 20, harvestMult: 4.0,
      description: "Throw a wide net catching multiple fish at once. Chance for rare catches.",
      rareFindBonus: 0.2, aoeRadius: 4,
    },
  ],

  shovel: [
    {
      id: "shovel_action", name: "Dig", kind: "action", icon: "🪏",
      animation: "attack", cooldown: 0, staminaCost: 3, harvestMult: 1.0,
      description: "Dig into the ground to raise or lower terrain.",
    },
    {
      id: "shovel_action2", name: "Flatten", kind: "action2", icon: "📐",
      animation: "heavyAttack", cooldown: 1, staminaCost: 4, harvestMult: 1.0,
      description: "Smooth and flatten the terrain in the target area.",
    },
    {
      id: "shovel_auto", name: "Auto-Dig", kind: "auto", icon: "🔄",
      animation: "attack", cooldown: 0, staminaCost: 0, staminaDrainPerSec: 5, harvestMult: 0.6,
      description: "Toggle automatic terrain shaping in a pattern.", isToggle: true,
    },
    {
      id: "shovel_special", name: "Excavate", kind: "special", icon: "🕳️",
      animation: "combo3", cooldown: 15, staminaCost: 25, harvestMult: 1.0,
      description: "Excavate a large area at once. Chance to uncover buried treasures.",
      rareFindBonus: 0.3, aoeRadius: 4,
    },
  ],
};

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** Get the 4 actions for a tool type (always in order: action, action2, auto, special) */
export function getToolActions(toolType: HarvestToolType): HarvestAction[] {
  return TOOL_ACTIONS[toolType] ?? [];
}

/** Get a specific action by ID */
export function getActionById(actionId: string): HarvestAction | null {
  for (const actions of Object.values(TOOL_ACTIONS)) {
    const found = actions.find(a => a.id === actionId);
    if (found) return found;
  }
  return null;
}

/** Get the 4 action IDs for a tool type (for hotbar slot population) */
export function getToolActionIds(toolType: HarvestToolType): string[] {
  return (TOOL_ACTIONS[toolType] ?? []).map(a => a.id);
}

/** Scale harvest action effectiveness by tool tier */
export function getScaledAction(action: HarvestAction, tier: WeaponTier): HarvestAction {
  const tierMults: Record<number, number> = {
    0: 0.7, 1: 1.0, 2: 1.2, 3: 1.4, 4: 1.7, 5: 2.0, 6: 2.4, 7: 2.8, 8: 3.5,
  };
  const mult = tierMults[tier] ?? 1.0;
  return {
    ...action,
    harvestMult: action.harvestMult * mult,
    staminaCost: Math.max(1, Math.round(action.staminaCost * (1 - tier * 0.04))),
    cooldown: Math.max(0, action.cooldown * (1 - tier * 0.03)),
    rareFindBonus: action.rareFindBonus ? action.rareFindBonus + tier * 0.02 : undefined,
  };
}

/** Detect tool type from an inventory item ID */
export function detectToolType(itemId: string): HarvestToolType | null {
  if (itemId.includes("pick")) return "pickaxe";
  if (itemId.includes("axe") && !itemId.includes("pick")) return "axe";
  if (itemId.includes("hoe")) return "hoe";
  if (itemId.includes("sickle")) return "sickle";
  if (itemId.includes("rod") || itemId.includes("fish")) return "fishing_rod";
  if (itemId.includes("shovel")) return "shovel";
  return null;
}
