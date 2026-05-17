/**
 * AmbientNPCRegistry — archetype definitions for ambient townsfolk and guards.
 *
 * These are not quest NPCs; they're the background population that makes
 * settlements feel inhabited. Each archetype defines:
 *   - Which character model to use
 *   - Day/night schedule (active hours in UTC)
 *   - Patrol pattern (stationary / patrol / wander)
 *   - Reaction to enemies (attack / flee / hide)
 *   - A small dialogue pool (3 random lines cycle on [T])
 *
 * Runtime spawning is handled by a future `AmbientNPCs.tsx` component that
 * reads DistrictRegistry.ambientNPCTypes and places one archetype instance
 * per allowed type per district, co-located with the player.
 *
 * Model paths: all paths already exist in the character model registry.
 */

import type { AmbientNPCArchetype } from "./DistrictRegistry";

// ─────────────────────────────────────────────────────────────────────────────

export type PatrolPattern = "stationary" | "small_patrol" | "wander_district";
export type EnemyReaction = "attack_nearby" | "flee"         | "ignore";
export type ScheduleMode  = "day_only"     | "night_only"    | "always";

export interface AmbientNPCDef {
  archetype:      AmbientNPCArchetype;
  name:           string;
  description:    string;
  modelPath:      string;
  targetHeight:   number;
  schedule:       ScheduleMode;
  patrol:         PatrolPattern;
  wanderRadius:   number;
  speed:          number;
  reaction:       EnemyReaction;
  /** Damage dealt if reaction === "attack_nearby". */
  attackDamage:   number;
  attackRange:    number;
  /** 3 dialogue lines cycling on [T]. */
  dialogueLines:  string[];
  /** Colour of the name stripe above head. */
  badgeColor:     string;
}

// ─────────────────────────────────────────────────────────────────────────────

export const AMBIENT_NPC_DEFS: Record<AmbientNPCArchetype, AmbientNPCDef> = {

  TownGuard: {
    archetype:    "TownGuard",
    name:         "Town Guard",
    description:  "Armoured militia stationed at settlement gates.",
    modelPath:    "/models/characters/undead_grave_knight-male.glb",
    targetHeight: 1.9,
    schedule:     "always",
    patrol:       "small_patrol",
    wanderRadius: 8,
    speed:        2.0,
    reaction:     "attack_nearby",
    attackDamage: 15,
    attackRange:  3.0,
    dialogueLines: [
      "Move along. Nothing to see here.",
      "Keep your weapons sheathed inside the walls.",
      "Trouble's been brewing out east. Stay alert.",
    ],
    badgeColor:   "#c9a044",
  },

  MarketVendor: {
    archetype:    "MarketVendor",
    name:         "Market Vendor",
    description:  "Merchants hawking wares from stalls and counters.",
    modelPath:    "/models/characters/human_battle_mage-female.glb",
    targetHeight: 1.8,
    schedule:     "day_only",
    patrol:       "stationary",
    wanderRadius: 3,
    speed:        1.2,
    reaction:     "flee",
    attackDamage: 0,
    attackRange:  0,
    dialogueLines: [
      "Best prices on the island! Don't let the pirates tell you otherwise.",
      "Herbs, iron, fine cloth — name your need.",
      "Business is good when adventurers pass through.",
    ],
    badgeColor:   "#ffcc44",
  },

  DockWorker: {
    archetype:    "DockWorker",
    name:         "Dock Worker",
    description:  "Sailors and workers maintaining the harbour.",
    modelPath:    "/models/characters/assassin-male.glb",
    targetHeight: 1.85,
    schedule:     "always",
    patrol:       "wander_district",
    wanderRadius: 14,
    speed:        2.2,
    reaction:     "flee",
    attackDamage: 0,
    attackRange:  0,
    dialogueLines: [
      "Mind your step on the gangway — third plank's rotten.",
      "Tides been strange lately. Smells like a storm coming.",
      "You sailing? Check the rigging before you cast off.",
    ],
    badgeColor:   "#4499cc",
  },

  Innkeeper: {
    archetype:    "Innkeeper",
    name:         "Innkeeper",
    description:  "The landlord who keeps the fire burning and the ale flowing.",
    modelPath:    "/models/characters/dwarf-male.glb",
    targetHeight: 1.4,
    schedule:     "always",
    patrol:       "stationary",
    wanderRadius: 4,
    speed:        1.0,
    reaction:     "ignore",
    attackDamage: 0,
    attackRange:  0,
    dialogueLines: [
      "Room and board, same price as yesterday. Gold only.",
      "The stew's hot and the ale's cold. What more do you need?",
      "Had a dwarf come through last week — drank the whole keg. Still owe me three gold.",
    ],
    badgeColor:   "#aa6633",
  },

  TownCrier: {
    archetype:    "TownCrier",
    name:         "Town Crier",
    description:  "Announces news, events, and faction decrees from the town square.",
    modelPath:    "/models/characters/human_battle_mage-male.glb",
    targetHeight: 1.85,
    schedule:     "day_only",
    patrol:       "stationary",
    wanderRadius: 2,
    speed:        1.0,
    reaction:     "flee",
    attackDamage: 0,
    attackRange:  0,
    dialogueLines: [
      "Hear ye, hear ye! The Crusade seeks brave souls for island expeditions!",
      "The Legion has been sighted in the eastern waters. Lock your doors at night!",
      "Reward offered for information on the vanished merchant vessel 'The Reluctant Tide'.",
    ],
    badgeColor:   "#c9a044",
  },

  PatrolGuard: {
    archetype:    "PatrolGuard",
    name:         "Patrol Guard",
    description:  "Armoured soldiers walking the perimeter of fortified areas.",
    modelPath:    "/models/characters/orc_scout-male.glb",
    targetHeight: 1.9,
    schedule:     "always",
    patrol:       "small_patrol",
    wanderRadius: 16,
    speed:        2.5,
    reaction:     "attack_nearby",
    attackDamage: 20,
    attackRange:  3.5,
    dialogueLines: [
      "Eyes on the horizon. They like to come from the water.",
      "Last patrol found tracks near the eastern ridge. Watch yourself.",
      "Double shift tonight. Commander's orders.",
    ],
    badgeColor:   "#886622",
  },
};

// ─────────────────────────────────────────────────────────────────────────────

export function getAmbientNPCDef(archetype: AmbientNPCArchetype): AmbientNPCDef {
  return AMBIENT_NPC_DEFS[archetype];
}
