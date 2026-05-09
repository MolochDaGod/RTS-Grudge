/**
 * CharacterSheet — unified stat block shared by every humanoid entity
 * in the game: player heroes, allies, enemies, expedition crew, faction
 * NPCs, tower garrison, and RTS-spawned units.
 *
 * All entities use the same 8-attribute system (STR/VIT/END/INT/WIS/DEX/AGI/TAC),
 * level 1-20, weapon type with 5 skill slots, and derive combat stats from
 * the canonical `computeSecondaryStats()` in useCharacterStats.
 *
 * NPC sheets are generated procedurally by distributing attribute points
 * based on archetype weights (melee→STR/VIT, ranged→DEX/AGI, caster→INT/WIS).
 *
 * Rendering rules:
 *   - Only entities within 100m of the player are rendered
 *   - NPCs are level-matched to the player within ±2 levels
 *   - Level 20 players only see other level 20 entities
 */

import type { PrimaryAttributes, SecondaryStats, HeroClass, HeroRace } from "@/lib/stores/useCharacterStats";
import { computeSecondaryStats } from "@/lib/stores/useCharacterStats";
import type { AttributeId, ClassId } from "@/data/grudge";
import type { EnemyType, EnemyTier } from "../systems/EnemyManager";
import { generateGrudgeUuid } from "./grudgeUuid";

// ── Core types ──────────────────────────────────────────────────────────────

export type EntityRole = "player" | "ally" | "enemy" | "npc" | "expedition" | "garrison";
export type WeaponTypeId = "sword" | "greatsword" | "axe" | "hammer" | "dagger" | "spear" | "mace" | "bow" | "crossbow" | "gun" | "staff" | "wand" | "shield" | "fists";

export interface CharacterSheet {
  /** Stable UUID for persistence and tracking */
  uuid: string;
  /** Display name */
  name: string;
  /** Level 1-20 */
  level: number;
  /** Race: human, elf, dwarf, orc, barbarian, undead */
  race: HeroRace;
  /** Class: warrior, mage, ranger, worge */
  heroClass: HeroClass;
  /** Faction affiliation */
  faction: string;
  /** What this entity is used for */
  role: EntityRole;
  /** The 8 primary attributes — point budget distributed by archetype */
  attributes: PrimaryAttributes;
  /** Equipped weapon type — drives animation pack and skill set */
  weaponType: WeaponTypeId;
  /** 5 weapon skill slot ids (from master-weaponSkills.json) */
  weaponSkills: [string, string, string, string, string];
  /** Equipment tier (T1-T8) — affects visual and stat bonuses */
  equipmentTier: number;
  /** Model path for 3D rendering */
  modelPath: string;
  /** Model scale */
  scale: number;
  /** Visual tint color (hex) */
  color: number;
  /** Enemy type key (for enemies using the EnemyManager visual system) */
  enemyType?: EnemyType;
  /** Enemy tier (for loot/difficulty classification) */
  enemyTier?: EnemyTier;
}

// ── Derived stats ───────────────────────────────────────────────────────────

export interface SheetStats extends SecondaryStats {
  /** Shorthand accessors computed from the full secondary stats */
  maxHealth: number;
  maxMana: number;
  maxStamina: number;
}

/** Compute full secondary stats from a CharacterSheet */
export function computeSheetStats(sheet: CharacterSheet): SheetStats {
  const secondary = computeSecondaryStats(sheet.attributes, sheet.level);
  return {
    ...secondary,
    maxHealth: Math.round(secondary.health),
    maxMana: Math.round(secondary.mana),
    maxStamina: Math.round(secondary.stamina),
  };
}

// ── Archetype attribute distribution weights ────────────────────────────────

/** How attribute points are distributed for each class archetype (weights sum to ~1.0) */
const ARCHETYPE_WEIGHTS: Record<HeroClass, Record<keyof PrimaryAttributes, number>> = {
  warrior: { strength: 0.25, vitality: 0.20, endurance: 0.18, intellect: 0.02, wisdom: 0.03, dexterity: 0.12, agility: 0.10, tactics: 0.10 },
  ranger:  { strength: 0.08, vitality: 0.10, endurance: 0.08, intellect: 0.05, wisdom: 0.05, dexterity: 0.28, agility: 0.26, tactics: 0.10 },
  mage:    { strength: 0.03, vitality: 0.08, endurance: 0.05, intellect: 0.30, wisdom: 0.25, dexterity: 0.05, agility: 0.08, tactics: 0.16 },
  worge:   { strength: 0.18, vitality: 0.15, endurance: 0.15, intellect: 0.08, wisdom: 0.10, dexterity: 0.10, agility: 0.14, tactics: 0.10 },
};

/** Race attribute bonuses (from useCharacterStats RACE_BONUSES) */
const RACE_ATTR_BONUS: Record<HeroRace, Partial<Record<keyof PrimaryAttributes, number>>> = {
  human:     { tactics: 2, wisdom: 1 },
  elf:       { intellect: 2, agility: 1 },
  dwarf:     { endurance: 2, vitality: 1 },
  orc:       { strength: 2, vitality: 1 },
  barbarian: { agility: 2, dexterity: 1 },
  undead:    { intellect: 1, endurance: 1, tactics: 1 },
};

// ── Canonical point budget ──────────────────────────────────────────────────

/** Starting attribute points at level 1 */
const STARTING_POINTS = 40;
/** Points gained per level */
const POINTS_PER_LEVEL = 5;

/** Total attribute point budget for a given level */
export function pointBudget(level: number): number {
  const lv = Math.max(1, Math.min(20, level));
  return STARTING_POINTS + (lv - 1) * POINTS_PER_LEVEL;
}

// ── Weapon → default skills mapping ─────────────────────────────────────────

const DEFAULT_WEAPON_SKILLS: Record<string, [string, string, string, string, string]> = {
  sword:      ["slash", "shield_bash", "war_cry", "execute", "bulwark"],
  greatsword: ["cleave", "whirlwind", "charge", "execute", "avatar_form"],
  axe:        ["chop", "rend", "berserker_rage", "execute", "avatar_form"],
  hammer:     ["smash", "stun_strike", "ground_slam", "fortify", "earthquake"],
  dagger:     ["backstab", "poison_blade", "shadow_step", "assassinate", "shadow_master"],
  spear:      ["thrust", "sweep", "charge", "impale", "whirlwind"],
  mace:       ["bash", "stun_strike", "holy_smite", "fortify", "divine_judgment"],
  bow:        ["power_shot", "multi_shot", "smoke_bolt", "rain_of_arrows", "storm_of_arrows"],
  crossbow:   ["bolt_shot", "piercing_bolt", "explosive_bolt", "rapid_fire", "siege_mode"],
  gun:        ["quick_draw", "scatter_shot", "smoke_bomb", "barrage", "dead_eye"],
  staff:      ["arc_bolt", "fireball", "lightning_chain", "meteor", "archmage"],
  wand:       ["magic_missile", "frost_bolt", "soul_drain", "blink", "reality_tear"],
  shield:     ["shield_bash", "block", "taunt", "fortify", "bulwark"],
  fists:      ["punch", "uppercut", "kick", "combo_strike", "frenzy"],
};

// ── NPC name generator ──────────────────────────────────────────────────────

const FIRST_NAMES: Record<string, string[]> = {
  crusade:  ["Aldric", "Seraphina", "Cedric", "Elara", "Roland", "Isolde", "Marcus", "Helena", "Sigurd", "Thrax"],
  fabled:   ["Aelindra", "Thalion", "Elowen", "Thorin", "Greta", "Lyrial", "Bolgrim", "Sylara", "Durin", "Miriel"],
  legion:   ["Grommash", "Shulka", "Volkrath", "Morkra", "Seraph", "Malachar", "Nythera", "Zugor", "Ashveil", "Grimholt"],
  pirate:   ["Racalvin", "Barnaby", "Scarla", "Flint", "Morgan", "Jade", "Crossbones", "Reef", "Storm", "Anchor"],
  wild:     ["Fenris", "Theron", "Wildkin", "Bramble", "Fang", "Howl", "Moss", "Thorn", "Shadow", "Ember"],
};

function randomName(faction: string, seed: number): string {
  const pool = FIRST_NAMES[faction] ?? FIRST_NAMES.pirate;
  return pool[Math.abs(seed) % pool.length];
}

// ── Seeded PRNG ─────────────────────────────────────────────────────────────

class SheetRNG {
  private s: number;
  constructor(seed: number) { this.s = (Math.abs(seed | 0) % 2147483646) + 1; }
  next(): number { this.s = (this.s * 16807) % 2147483647; return this.s / 2147483647; }
  int(min: number, max: number): number { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick<T>(arr: readonly T[]): T { return arr[this.int(0, arr.length - 1)]; }
}

// ── Sheet generator ─────────────────────────────────────────────────────────

export interface NPCGeneratorOpts {
  /** Target level (1-20). Required. */
  level: number;
  /** Role of this entity */
  role?: EntityRole;
  /** Force a specific class */
  heroClass?: HeroClass;
  /** Force a specific race */
  race?: HeroRace;
  /** Force a specific faction */
  faction?: string;
  /** Force a specific weapon */
  weaponType?: WeaponTypeId;
  /** Force a specific enemy type (for visual) */
  enemyType?: EnemyType;
  /** Enemy tier override */
  enemyTier?: EnemyTier;
  /** Model path override */
  modelPath?: string;
  /** Deterministic seed (for reproducible NPCs) */
  seed?: number;
  /** Equipment tier (1-8, defaults to level/3 clamped) */
  equipmentTier?: number;
}

/** Class → default weapon type */
const CLASS_DEFAULT_WEAPON: Record<HeroClass, WeaponTypeId> = {
  warrior: "sword",
  ranger: "bow",
  mage: "staff",
  worge: "staff",
};

/** Class → model path pool (uses the existing characters/*.glb) */
const CLASS_MODEL_POOL: Record<HeroClass, string[]> = {
  warrior: [
    "/models/characters/undead_grave_knight-male.glb",
    "/models/characters/night_stalker-male.glb",
    "/models/characters/dwarf-male.glb",
  ],
  ranger: [
    "/models/characters/elf-male.glb",
    "/models/characters/assassin-male.glb",
    "/models/characters/elf-female.glb",
  ],
  mage: [
    "/models/characters/human_battle_mage-male.glb",
    "/models/characters/vampire_aristocrat-male.glb",
    "/models/characters/human_battle_mage-female.glb",
  ],
  worge: [
    "/models/characters/night_stalker-male.glb",
    "/models/characters/night_stalker-female.glb",
  ],
};

/**
 * Generate a CharacterSheet for any NPC, enemy, ally, or expedition crew.
 *
 * Distributes attribute points based on class archetype weights + race bonuses,
 * assigns weapon type and 5 skill slots, and picks a model from the pool.
 */
export function generateNPCSheet(opts: NPCGeneratorOpts): CharacterSheet {
  const seed = opts.seed ?? Math.floor(Math.random() * 2147483647);
  const rng = new SheetRNG(seed);

  const level = Math.max(1, Math.min(20, Math.round(opts.level)));
  const role = opts.role ?? "enemy";

  // Pick race and class
  const allRaces: HeroRace[] = ["human", "elf", "dwarf", "orc", "barbarian", "undead"];
  const allClasses: HeroClass[] = ["warrior", "ranger", "mage", "worge"];
  const race = opts.race ?? rng.pick(allRaces);
  const heroClass = opts.heroClass ?? rng.pick(allClasses);

  // Faction from race if not specified
  const raceFaction: Record<HeroRace, string> = {
    human: "crusade", elf: "fabled", dwarf: "fabled",
    orc: "legion", barbarian: "crusade", undead: "legion",
  };
  const faction = opts.faction ?? raceFaction[race];

  // Distribute attribute points
  const budget = pointBudget(level);
  const weights = ARCHETYPE_WEIGHTS[heroClass];
  const raceBonus = RACE_ATTR_BONUS[race];

  const attrs: PrimaryAttributes = {
    strength: 0, vitality: 0, endurance: 0, intellect: 0,
    wisdom: 0, dexterity: 0, agility: 0, tactics: 0,
  };

  // Distribute budget by weights with small random variance (±15%)
  const attrKeys = Object.keys(weights) as (keyof PrimaryAttributes)[];
  let remaining = budget;
  for (let i = 0; i < attrKeys.length; i++) {
    const key = attrKeys[i];
    const w = weights[key];
    const isLast = i === attrKeys.length - 1;
    if (isLast) {
      attrs[key] = Math.max(1, remaining);
    } else {
      const base = Math.round(budget * w);
      const variance = Math.round(base * (rng.next() * 0.3 - 0.15));
      const points = Math.max(1, Math.min(remaining - (attrKeys.length - i - 1), base + variance));
      attrs[key] = points;
      remaining -= points;
    }
  }

  // Apply race bonuses
  for (const [attr, bonus] of Object.entries(raceBonus)) {
    attrs[attr as keyof PrimaryAttributes] += bonus as number;
  }

  // Weapon
  const weaponType = opts.weaponType ?? CLASS_DEFAULT_WEAPON[heroClass];
  const weaponSkills = DEFAULT_WEAPON_SKILLS[weaponType] ?? DEFAULT_WEAPON_SKILLS.fists;

  // Model
  const modelPool = CLASS_MODEL_POOL[heroClass];
  const modelPath = opts.modelPath ?? rng.pick(modelPool);

  // Equipment tier scales with level
  const equipmentTier = opts.equipmentTier ?? Math.max(1, Math.min(8, Math.ceil(level / 3)));

  // Color from race
  const raceColors: Record<HeroRace, number> = {
    human: 0xc8b89a, elf: 0x9ad0e0, dwarf: 0xb88560,
    orc: 0x6a8a3a, barbarian: 0xc83838, undead: 0x9a88c8,
  };

  return {
    uuid: generateGrudgeUuid("character"),
    name: randomName(faction, seed),
    level,
    race,
    heroClass,
    faction,
    role,
    attributes: attrs,
    weaponType,
    weaponSkills,
    equipmentTier,
    modelPath,
    scale: 1.0,
    color: raceColors[race],
    enemyType: opts.enemyType,
    enemyTier: opts.enemyTier ?? (level >= 18 ? "boss" : level >= 14 ? "elite" : level >= 9 ? "rare" : level >= 5 ? "uncommon" : "common"),
  };
}

// ── Level-matching helpers ──────────────────────────────────────────────────

/** Maximum render distance for NPCs (meters) */
export const NPC_RENDER_DISTANCE = 100;

/** Maximum level difference for NPC spawning */
export const NPC_LEVEL_VARIANCE = 2;

/**
 * Compute the level an NPC should spawn at, given the player's level.
 * - Player level 1-19: spawn at playerLevel ± 2 (random)
 * - Player level 20: spawn at exactly 20 (endgame bracket)
 */
export function matchLevel(playerLevel: number, seed?: number): number {
  const pl = Math.max(1, Math.min(20, playerLevel));
  if (pl >= 20) return 20;
  const rng = new SheetRNG(seed ?? Math.floor(Math.random() * 99999));
  const offset = rng.int(-NPC_LEVEL_VARIANCE, NPC_LEVEL_VARIANCE);
  return Math.max(1, Math.min(20, pl + offset));
}

/**
 * Check if an entity position is within render distance of the player.
 * Call this before creating 3D scene nodes for an NPC.
 */
export function isInRenderRange(
  entityX: number, entityZ: number,
  playerX: number, playerZ: number,
): boolean {
  const dx = entityX - playerX;
  const dz = entityZ - playerZ;
  return (dx * dx + dz * dz) <= NPC_RENDER_DISTANCE * NPC_RENDER_DISTANCE;
}

/**
 * Generate a level-matched NPC sheet for the current player level.
 * Convenience wrapper around generateNPCSheet + matchLevel.
 */
export function generateMatchedNPC(
  playerLevel: number,
  opts?: Partial<NPCGeneratorOpts>,
): CharacterSheet {
  const level = matchLevel(playerLevel, opts?.seed);
  return generateNPCSheet({ level, ...opts });
}
