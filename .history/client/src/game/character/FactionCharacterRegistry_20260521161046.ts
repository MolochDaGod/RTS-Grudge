/**
 * FactionCharacterRegistry — mirrors the Unity uMMORPG 6-race system.
 *
 * Each race uses customizable FBX models with prefix-based child meshes
 * (WK_, BRB_, ELF_, DWF_, ORC_, UD_) that can be toggled for equipment.
 * The same skeleton (Bip001) is shared across all races, enabling
 * universal animation retargeting.
 *
 * This registry also maps to the existing GLB characters in
 * ModelRegistry.ts so both pipelines (FBX prefix-toggle and GLB
 * external-attach) can coexist.
 *
 * CDN PATHS: The 6 grudge6 race GLBs are hosted on the Grudge Object Store.
 * Run `node scripts/convert-grudge6-assets.mjs` to convert local FBX files
 * to GLB and upload. See that script for the expected output layout.
 */

// ---------------------------------------------------------------------------
// Grudge Object Storage CDN roots
// ---------------------------------------------------------------------------
/** Root for grudge6 race character GLBs and their animation packs. */
export const GRUDGE6_CDN = "https://molochdagod.github.io/ObjectStore/models/factioncharacters";
/** Root for Bip001 animation pack GLBs shared across all 6 races. */
export const GRUDGE6_ANIM_CDN = `${GRUDGE6_CDN}/animations`;

import type { Faction, Race } from "../systems/ModelRegistry";

// ---------------------------------------------------------------------------
// Bone containers — identical across all 6 races (Bip001 skeleton)
// ---------------------------------------------------------------------------
export const BONE_CONTAINERS = {
  rightHand:  "R_hand_container",
  leftHand:   "L_hand_container",
  leftShield: "L_shield_container",
  bag:        "Bone_bag",
  wood:       "Bone_wood",
  quiver:     "Quiver_container",
} as const;

export type BoneContainerKey = keyof typeof BONE_CONTAINERS;

// ---------------------------------------------------------------------------
// Equipment slot definitions — regex patterns match mesh names after prefix strip
// ---------------------------------------------------------------------------
export type EquipGroup = "armor" | "weapon_r" | "weapon_l" | "shield" | "utility";

export interface SlotDefinition {
  slot: string;
  re: RegExp;
  group: EquipGroup;
  /** When true, the slot has no variant letter (e.g. pick, spear, bow). */
  noVariant?: boolean;
}

export const SLOT_DEFINITIONS: SlotDefinition[] = [
  // Armor slots — skinned meshes at root
  { slot: "body",       re: /^Units_Body_([A-Z])$/i,           group: "armor" },
  { slot: "arms",       re: /^Units_Arms_([A-Z])$/i,           group: "armor" },
  { slot: "legs",       re: /^Units_Legs_([A-Z])$/i,           group: "armor" },
  { slot: "head",       re: /^Units_head_([A-Z])$/i,           group: "armor" },
  { slot: "shoulders",  re: /^Units_shoulderpads_([A-Z])$/i,   group: "armor" },

  // Right-hand weapons
  { slot: "axe",    re: /(?:Units_|weapon_)axe_([A-Z])$/i,     group: "weapon_r" },
  { slot: "hammer", re: /(?:Units_|weapon_)hammer_([A-Z])$/i,  group: "weapon_r" },
  { slot: "sword",  re: /(?:Units_|weapon_)[Ss]word_([A-Z])$/i,group: "weapon_r" },
  { slot: "pick",   re: /(?:Units_|weapon_)pick$/i,            group: "weapon_r", noVariant: true },
  { slot: "spear",  re: /(?:Units_|weapon_)[Ss]pear$/i,        group: "weapon_r", noVariant: true },

  // Left-hand items
  { slot: "bow",    re: /(?:Units_|weapon_)[Bb]ow$/i,          group: "weapon_l", noVariant: true },
  { slot: "staff",  re: /(?:Units_|weapon_)staff_([A-Z])$/i,   group: "weapon_l" },

  // Shields
  { slot: "shield", re: /(?:Units_|)[Ss]hield_([A-Z])$/i,      group: "shield" },

  // Utility
  { slot: "bag",    re: /(?:Xtra_|Units_)bag$/i,               group: "utility", noVariant: true },
  { slot: "wood",   re: /(?:Xtra_|Units_)wood$/i,              group: "utility", noVariant: true },
  { slot: "quiver", re: /(?:Xtra_|Units_)quiver$/i,            group: "utility", noVariant: true },
];

// Grouped for UI panels (matches Unity PlayerEquipment.slotInfo)
export const SLOT_GROUPS = {
  armor:   ["body", "arms", "legs", "head", "shoulders"],
  weapons: ["axe", "hammer", "sword", "pick", "spear", "bow", "staff"],
  shields: ["shield"],
  utility: ["bag", "wood", "quiver"],
} as const;

// ---------------------------------------------------------------------------
// Race prefix → uMMORPG Unity slot mapping
//
// Maps to the Unity PlayerEquipment.slotInfo categories:
//   Weapon, Head, Chest, Legs, Shield, Shoulders, Hands, Feet
// ---------------------------------------------------------------------------
export type RacePrefix = "WK_" | "BRB_" | "ELF_" | "DWF_" | "ORC_" | "UD_";

export interface RaceConfig {
  name: string;
  prefix: RacePrefix;
  race: Race;
  faction: Faction | string;
  /** FBX model path (prefix-based child mesh toggle) */
  fbxModel: string;
  /** GLB model path (external weapon attach — current RTS-Grudge pipeline) */
  glbModels: { male: string; female: string };
  /**
   * Bear-form GLB for the Worge race. When set, CLASS_ABILITY_3 swaps
   * the player model to this path and back.
   */
  bearFormGlb?: string;
  /** Unity equipment slot mapping: category → bone Transform name */
  unitySlots: {
    weapon: string;   // mainHand bone
    head: string;     // helmet attach point
    chest: string;    // chest armor (skinned mesh toggle)
    legs: string;     // leg armor (skinned mesh toggle)
    shield: string;   // offHand / shield bone
    shoulders: string; // shoulder armor (skinned mesh toggle)
    hands: string;    // glove armor (skinned mesh toggle)
    feet: string;     // boot armor (skinned mesh toggle)
  };
}

export const RACE_CONFIGS: Record<string, RaceConfig> = {
  human: {
    name: "Human (WK)",
    prefix: "WK_",
    race: "human",
    faction: "crusade",
    fbxModel: "/models/factioncharacters/WesternKingdoms/models/WK_Characters_customizable.FBX",
    // CDN GLB path — uploaded via scripts/convert-grudge6-assets.mjs
    glbModels: {
      male:   `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
      female: `${GRUDGE6_CDN}/wk/WK_Characters_customizable.glb`,
    },
    unitySlots: {
      weapon: "R_hand_container",
      head: "Bip001 Head",
      chest: "body",
      legs: "legs",
      shield: "L_shield_container",
      shoulders: "shoulders",
      hands: "arms",
      feet: "legs",
    },
  },
  barbarian: {
    name: "Barbarian (BRB)",
    prefix: "BRB_",
    race: "barbarian",
    faction: "crusade",
    fbxModel: "/models/factioncharacters/Barbarians/models/BRB_Characters_customizable.FBX",
    glbModels: {
      male:   `${GRUDGE6_CDN}/brb/BRB_Characters_customizable.glb`,
      female: `${GRUDGE6_CDN}/brb/BRB_Characters_customizable.glb`,
    },
    unitySlots: {
      weapon: "R_hand_container",
      head: "Bip001 Head",
      chest: "body",
      legs: "legs",
      shield: "L_shield_container",
      shoulders: "shoulders",
      hands: "arms",
      feet: "legs",
    },
  },
  elf: {
    name: "Elf (ELF)",
    prefix: "ELF_",
    race: "elf",
    faction: "fabled",
    fbxModel: "/models/factioncharacters/Elves/models/ELF_Characters_customizable.FBX",
    glbModels: {
      male:   `${GRUDGE6_CDN}/elf/ELF_Characters_customizable.glb`,
      female: `${GRUDGE6_CDN}/elf/ELF_Characters_customizable.glb`,
    },
    unitySlots: {
      weapon: "R_hand_container",
      head: "Bip001 Head",
      chest: "body",
      legs: "legs",
      shield: "L_shield_container",
      shoulders: "shoulders",
      hands: "arms",
      feet: "legs",
    },
  },
  dwarf: {
    name: "Dwarf (DWF)",
    prefix: "DWF_",
    race: "dwarf",
    faction: "fabled",
    fbxModel: "/models/factioncharacters/Dwarves/models/DWF_Characters_customizable.FBX",
    glbModels: {
      male:   `${GRUDGE6_CDN}/dwf/DWF_Characters_customizable.glb`,
      female: `${GRUDGE6_CDN}/dwf/DWF_Characters_customizable.glb`,
    },
    unitySlots: {
      weapon: "R_hand_container",
      head: "Bip001 Head",
      chest: "body",
      legs: "legs",
      shield: "L_shield_container",
      shoulders: "shoulders",
      hands: "arms",
      feet: "legs",
    },
  },
  orc: {
    name: "Orc (ORC)",
    prefix: "ORC_",
    race: "orc",
    faction: "legion",
    fbxModel: "/models/factioncharacters/Orcs/models/ORC_Characters_Customizable.FBX",
    glbModels: {
      male:   `${GRUDGE6_CDN}/orc/ORC_Characters_Customizable.glb`,
      female: `${GRUDGE6_CDN}/orc/ORC_Characters_Customizable.glb`,
    },
    unitySlots: {
      weapon: "R_hand_container",
      head: "Bip001 Head",
      chest: "body",
      legs: "legs",
      shield: "L_shield_container",
      shoulders: "shoulders",
      hands: "arms",
      feet: "legs",
    },
  },
  worge: {
    name: "Worge",
    prefix: "WK_", // shares the WK skeleton for animation compatibility
    race: "barbarian" as any,
    faction: "wild",
    fbxModel: "/models/factioncharacters/WesternKingdoms/models/WK_Characters_customizable.FBX",
    glbModels: {
      male: "/models/characters/night_stalker-male.glb",
      female: "/models/characters/night_stalker-female.glb",
    },
    /** Bear-form model — swapped in when the Worge's CLASS_ABILITY_3 fires. */
    bearFormGlb: "/models/characters/stylized_nightmarish_werewolf.glb",
    unitySlots: {
      weapon: "R_hand_container",
      head: "Bip001 Head",
      chest: "body",
      legs: "legs",
      shield: "L_shield_container",
      shoulders: "shoulders",
      hands: "arms",
      feet: "legs",
    },
  },
  undead: {
    name: "Undead (UD)",
    prefix: "UD_",
    race: "undead",
    faction: "legion",
    fbxModel: "/models/factioncharacters/Undead/models/UD_Characters_customizable.FBX",
    glbModels: {
      male:   `${GRUDGE6_CDN}/ud/UD_Characters_customizable.glb`,
      female: `${GRUDGE6_CDN}/ud/UD_Characters_customizable.glb`,
    },
    unitySlots: {
      weapon: "R_hand_container",
      head: "Bip001 Head",
      chest: "body",
      legs: "legs",
      shield: "L_shield_container",
      shoulders: "shoulders",
      hands: "arms",
      feet: "legs",
    },
  },
};

// ---------------------------------------------------------------------------
// Weapon animation packs — shared across all races via retargeting
// ---------------------------------------------------------------------------
export const WEAPON_ANIM_PACK_IDS = {
  "1h_sword_shield": "1H Sword & Shield",
  "2h_melee":        "2H Melee (Axe/Hammer)",
  "longbow":         "Longbow",
  "magic":           "Magic Staff",
  "rifle_crossbow":  "Rifle / Crossbow",
  "advanced_gun":    "Advanced Gun (8-Dir)",
  "great_sword":     "Great Sword",
} as const;

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** Get all 6 core race configs */
export function getAllRaceConfigs(): RaceConfig[] {
  return Object.values(RACE_CONFIGS);
}

/** Get a race config by race key */
export function getRaceConfig(raceKey: string): RaceConfig | null {
  return RACE_CONFIGS[raceKey] ?? null;
}

/** Get race config by prefix (e.g. "WK_" → human config) */
export function getRaceByPrefix(prefix: RacePrefix): RaceConfig | null {
  return Object.values(RACE_CONFIGS).find(r => r.prefix === prefix) ?? null;
}

/** Map a model path to its race config (works for both FBX and GLB paths) */
export function getRaceForModelPath(modelPath: string): RaceConfig | null {
  for (const config of Object.values(RACE_CONFIGS)) {
    if (modelPath === config.fbxModel) return config;
    if (modelPath === config.glbModels.male || modelPath === config.glbModels.female) return config;
  }
  return null;
}

/** Detect the prefix from a mesh name (returns null if no known prefix found) */
export function detectPrefix(meshName: string): RacePrefix | null {
  const prefixes: RacePrefix[] = ["WK_", "BRB_", "ELF_", "DWF_", "ORC_", "UD_"];
  for (const p of prefixes) {
    if (meshName.startsWith(p)) return p;
  }
  return null;
}
