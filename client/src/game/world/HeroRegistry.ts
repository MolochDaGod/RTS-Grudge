/**
 * HeroRegistry — canonical definitions for all 24 faction hero NPCs.
 *
 * Three factions × two races × four classes = 24 heroes.
 *   Crusade : Human + Barbarian
 *   Legion  : Undead + Orc
 *   Fabled  : Dwarf + Elf
 *
 * Each race has one hero per class: Warrior · Worge · Mage · Ranger.
 *
 * This file is data-only. AI logic lives in HeroAIProfiles.ts.
 * World-state (daily cycle, health, position) lives in useFactionHeroes.ts.
 */

import type { HeroClass, HeroRace } from "@/lib/stores/useCharacterStats";
import type { VoicePackKey } from "@/lib/dialog/voicePacks";
import type { ZoneId } from "./WorldZoneRegistry";

// ─────────────────────────────────────────────────────────────────────────────

export type FactionId = "crusade" | "legion" | "fabled";
export type DailyObjective = "combat" | "harvest" | "explore" | "defend";

export interface HeroStats {
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  attackRange: number;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  faction: FactionId;
  race: HeroRace;
  heroClass: HeroClass;
  quote: string;
  lore: string;

  // Model
  modelPath: string;
  /** Optional alternate model used when in Worge beast form. */
  worgeModelPath?: string;
  targetHeight: number;

  // Dialogue & voice
  voicePack: VoicePackKey;
  /** Key into DIALOGUE_SCRIPTS in dialogueData.ts */
  dialogueId: string;

  // World placement
  /** World-space [x, y, z] of the faction hub outpost. */
  hubPosition: [number, number, number];
  adventureZone: ZoneId;
  /** useIslandWorld grid cell the hero adventures on. */
  adventureGrid: { x: number; z: number };

  stats: HeroStats;

  /** Exposes the [T] mission list when at hub. */
  isMissionGiver: boolean;
  /** Exposes the [T] shop tab when at hub. */
  isVendor: boolean;
  /** Dominant out-of-combat activity when adventuring. */
  dailyObjective: DailyObjective;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared hub positions (world coords) per faction
// ─────────────────────────────────────────────────────────────────────────────
// All three hubs are placed in the central zone so new players encounter
// all factions without needing to sail to their home zones first.

export const FACTION_HUB_POSITION: Record<FactionId, [number, number, number]> = {
  crusade: [-62, 0, -90],   // NW of The Rift, towards tropical
  fabled:  [95,  0, -82],   // NE of The Rift, towards ice
  legion:  [-15, 0,  48],   // S of The Rift, towards lava/boss
};

export const FACTION_ADVENTURE_ZONE: Record<FactionId, ZoneId> = {
  crusade: "tropical",
  fabled:  "ice",
  legion:  "lava",
};

export const FACTION_COLOR: Record<FactionId, string> = {
  crusade: "#c9a044",
  fabled:  "#44a8cc",
  legion:  "#cc4444",
};

export const FACTION_ICON: Record<FactionId, string> = {
  crusade: "⚔️",
  fabled:  "🌿",
  legion:  "💀",
};

// ─────────────────────────────────────────────────────────────────────────────
// Compact builder (DRY helper)
// ─────────────────────────────────────────────────────────────────────────────

type HeroArgs = [
  id: string, name: string, title: string,
  faction: FactionId, race: HeroRace, heroClass: HeroClass,
  quote: string, lore: string,
  modelPath: string, targetHeight: number,
  voicePack: VoicePackKey,
  stats: HeroStats,
  missionGiver: boolean, vendor: boolean,
  dailyObjective: DailyObjective,
  advGrid: { x: number; z: number },
  worgeModelPath?: string,
];

function h(...args: HeroArgs): HeroDef {
  const [id, name, title, faction, race, heroClass, quote, lore,
         modelPath, targetHeight, voicePack, stats,
         isMissionGiver, isVendor, dailyObjective, advGrid,
         worgeModelPath] = args;
  return {
    id, name, title, faction, race, heroClass, quote, lore,
    modelPath, targetHeight, voicePack,
    dialogueId: id,
    hubPosition: FACTION_HUB_POSITION[faction],
    adventureZone: FACTION_ADVENTURE_ZONE[faction],
    adventureGrid: advGrid,
    stats,
    isMissionGiver, isVendor, dailyObjective,
    ...(worgeModelPath ? { worgeModelPath } : {}),
  };
}

// Stat shorthand
type S = HeroStats;
const warrior  = (hp: number, dmg: number): S => ({ health: hp, maxHealth: hp, damage: dmg, speed: 3.0, attackRange: 2.8 });
const worge    = (hp: number, dmg: number): S => ({ health: hp, maxHealth: hp, damage: dmg, speed: 4.5, attackRange: 2.5 });
const mage     = (hp: number, dmg: number): S => ({ health: hp, maxHealth: hp, damage: dmg, speed: 2.8, attackRange: 15.0 });
const ranger   = (hp: number, dmg: number): S => ({ health: hp, maxHealth: hp, damage: dmg, speed: 3.8, attackRange: 18.0 });

// ─────────────────────────────────────────────────────────────────────────────
// ALL 24 HEROES
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_HEROES: HeroDef[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUSADE — Human (4)
  // ═══════════════════════════════════════════════════════════════════════════

  h("hero_aldric", "Sir Aldric Valorheart", "The Iron Bastion",
    "crusade", "human", "warrior",
    "The shield breaks before the will does.",
    "Orphaned during the First Grudge War, raised by the Temple Knights. Leads every Crusade offensive in golden armor.",
    "/models/characters/assassin-male.glb", 1.85, "warrior",
    warrior(280, 35), true, false, "combat", { x: -2, z: -2 }),

  h("hero_gareth", "Gareth Moonshadow", "The Twilight Stalker",
    "crusade", "human", "worge",
    "The beast within is not my curse. It is my salvation.",
    "Once captain of the Crusade rangers. Bonded with Wolf Spirit Fenrath during a blood moon in the Darkwood.",
    "/models/characters/night_stalker-male.glb", 2.0, "male",
    worge(240, 30), true, false, "combat", { x: -3, z: -2 },
    "/models/characters/werewolf.glb"),

  h("hero_elara", "Archmage Elara Brightspire", "The Storm Caller",
    "crusade", "human", "mage",
    "Knowledge is the flame. I am merely the torch.",
    "Youngest ever admitted to the Arcane Consortium. Channels both arcane destruction and divine healing.",
    "/models/characters/human_battle_mage-female.glb", 1.8, "female",
    mage(145, 42), true, true, "harvest", { x: -2, z: -3 }),

  h("hero_kael", "Kael Shadowblade", "The Shadow Blade",
    "crusade", "human", "ranger",
    "You never see the arrow that kills you.",
    "The Crusade's deadliest operative. Slum-born in Port Grimaldi. Prefers to end wars before they start.",
    "/models/characters/assassin-male.glb", 1.85, "male",
    ranger(165, 32), true, false, "explore", { x: -1, z: -3 }),

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUSADE — Barbarian (4)
  // ═══════════════════════════════════════════════════════════════════════════

  h("hero_ulfgar", "Ulfgar Bonecrusher", "The Mountain Breaker",
    "crusade", "barbarian", "warrior",
    "I do not fight to survive. I fight because the mountain told me to.",
    "Shattered a mountain pass single-handed to bury a Legion invasion. Lost his left eye in the act. Saved his tribe.",
    "/models/characters/human_battle_mage-male.glb", 1.85, "warrior",
    warrior(300, 38), true, false, "combat", { x: -3, z: -3 }),

  h("hero_hrothgar", "Hrothgar Fangborn", "The Beast of the North",
    "crusade", "barbarian", "worge",
    "The pack does not forgive. The pack does not forget.",
    "Born during an eclipse, left in the woods as an omen, raised by a dire wolf mother.",
    "/models/characters/night_stalker-male.glb", 2.0, "male",
    worge(260, 33), true, false, "combat", { x: -4, z: -2 },
    "/models/characters/stylized_nightmarish_werewolf.glb"),

  h("hero_volka", "Volka Stormborn", "The Frost Witch",
    "crusade", "barbarian", "mage",
    "Winter does not come. I bring it.",
    "Commanded a blizzard as a child to save her buried village. Tribal elders named her Stormborn and sent her south to fight.",
    "/models/characters/human_battle_mage-female.glb", 1.8, "female",
    mage(135, 40), true, false, "harvest", { x: -4, z: -3 }),

  h("hero_svala", "Svala Windrider", "The Silent Huntress",
    "crusade", "barbarian", "ranger",
    "The wind tells me where you hide.",
    "Youngest ever to complete the Trial of the Winter Hunt, slaying a frost drake alone at fourteen.",
    "/models/characters/human_battle_mage-female.glb", 1.8, "female",
    ranger(170, 30), true, false, "explore", { x: -3, z: -4 }),

  // ═══════════════════════════════════════════════════════════════════════════
  // FABLED — Dwarf (4)
  // ═══════════════════════════════════════════════════════════════════════════

  h("hero_thane", "Thane Ironshield", "The Mountain Guardian",
    "fabled", "dwarf", "warrior",
    "Deeper than stone. Harder than iron. We endure.",
    "47th guardian of the Deep Gate. Sealed the lower mines and marched to war. Carries the Aegis of Ancestors.",
    "/models/characters/dwarf-male.glb", 1.4, "warrior",
    warrior(310, 36), true, false, "defend", { x: 3, z: -2 }),

  h("hero_bromm", "Bromm Earthshaker", "The Cavern Beast",
    "fabled", "dwarf", "worge",
    "The mountain has teeth. I am its bite.",
    "A miner who broke into a sealed cavern and freed a primordial earth spirit. The merging nearly killed him. It did not.",
    "/models/characters/dwarf-male.glb", 1.4, "warrior",
    worge(250, 31), true, false, "combat", { x: 4, z: -2 },
    "/models/characters/lizardfolk-male.glb"),

  h("hero_runa", "Runa Forgekeeper", "The Runesmith",
    "fabled", "dwarf", "mage",
    "Every rune tells a story. Mine tells of fire.",
    "Last of the Forgekeeper bloodline. Carries runic magic that predates the Grudge Wars.",
    "/models/characters/dwarf-female.glb", 1.4, "female",
    mage(140, 44), true, true, "harvest", { x: 3, z: -3 }),

  h("hero_durin", "Durin Tunnelwatcher", "The Deep Scout",
    "fabled", "dwarf", "ranger",
    "In the deep, every sound is a target.",
    "Lost his squad to a cave-in. Alone in the dark for thirty days. Emerged able to fight in total blackness.",
    "/models/characters/dwarf-male.glb", 1.4, "male",
    ranger(160, 28), true, false, "explore", { x: 2, z: -3 }),

  // ═══════════════════════════════════════════════════════════════════════════
  // FABLED — Elf (4)
  // ═══════════════════════════════════════════════════════════════════════════

  h("hero_thalion", "Thalion Bladedancer", "The Graceful Death",
    "fabled", "elf", "warrior",
    "A blade is a brush. Combat is art.",
    "Three centuries at the Moonblade Academy. Mastered every weapon form before settling on twin curved blades.",
    "/models/characters/elf-male.glb", 1.85, "male",
    warrior(265, 33), true, false, "combat", { x: 3, z: -4 }),

  h("hero_sylara", "Sylara Wildheart", "The Forest Spirit",
    "fabled", "elf", "worge",
    "The forest breathes through me. And it is angry.",
    "Last of the Wildheart druids. Performed the Rite of Binding when the Darkwood began to wither.",
    "/models/characters/elf-female.glb", 1.8, "female",
    worge(230, 29), true, false, "combat", { x: 4, z: -3 },
    "/models/characters/night_stalker-female.glb"),

  h("hero_lyra", "Lyra Stormweaver", "The Storm Weaver",
    "fabled", "elf", "mage",
    "Magic is not power. It is understanding. I understand everything.",
    "Four hundred years in the Crystal Spire before the war forced her to battle. Masters all eight schools of magic.",
    "/models/characters/elf-female.glb", 1.8, "female",
    mage(150, 46), true, true, "harvest", { x: 4, z: -4 }),

  h("hero_aelindra", "Aelindra Swiftbow", "The Wind Walker",
    "fabled", "elf", "ranger",
    "I loosed the arrow yesterday. It arrives tomorrow. You die today.",
    "Captain of the Silverglade Sentinels for two centuries. Trained under Lyra. Infuses arrows with arcane energy.",
    "/models/characters/elf-female.glb", 1.8, "female",
    ranger(175, 31), true, false, "explore", { x: 5, z: -3 }),

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGION — Orc (4)
  // ═══════════════════════════════════════════════════════════════════════════

  h("hero_grommash", "Grommash Ironjaw", "The Warchief",
    "legion", "orc", "warrior",
    "BLOOD AND THUNDER!",
    "Born during a blood eclipse. United every orc clan under one banner by twenty. The Legion's iron fist.",
    "/models/characters/orc_scout-male.glb", 1.9, "warrior",
    warrior(320, 40), true, false, "combat", { x: 3, z: 1 }),

  h("hero_fenris", "Fenris Bloodfang", "The Alpha",
    "legion", "orc", "worge",
    "I am the alpha. There is no omega.",
    "Exiled for refusing to kill prisoners. Fought the dire wolf Shadowmaw for three days. They are one being now.",
    "/models/characters/night_stalker-male.glb", 2.0, "male",
    worge(270, 34), true, false, "combat", { x: 4, z: 1 },
    "/models/characters/werewolf.glb"),

  h("hero_zulijn", "Zul'jin the Hexmaster", "The Blood Shaman",
    "legion", "orc", "mage",
    "Your blood screams louder than you do.",
    "Born with blood-sight. Taken by the Legion's war shamans at birth. Weaponizes pain itself.",
    "/models/characters/orc_scout-male.glb", 1.9, "mage",
    mage(130, 45), true, false, "harvest", { x: 3, z: 2 }),

  h("hero_razak", "Razak Deadeye", "The Trophy Hunter",
    "legion", "orc", "ranger",
    "Every head on my wall was once the strongest in its land.",
    "Disgraced warrior who lost his sword arm. Reinvented as a marksman. His war-crossbow pierces dragon-scale.",
    "/models/characters/orc_scout-male.glb", 1.9, "male",
    ranger(170, 35), true, true, "explore", { x: 4, z: 2 }),

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGION — Undead (4)
  // ═══════════════════════════════════════════════════════════════════════════

  h("hero_malachar", "Lord Malachar", "The Deathless Knight",
    "legion", "undead", "warrior",
    "I cannot die. I have tried.",
    "Sir Malachar the Pure, greatest knight of his age. Raised by necromancy. He remembers fragments. He hates what he has become.",
    "/models/characters/undead_grave_knight-male.glb", 1.9, "warrior",
    warrior(340, 38), true, false, "defend", { x: 2, z: 1 }),

  h("hero_ghoulfather", "The Ghoulfather", "The Abomination",
    "legion", "undead", "worge",
    "We\u2026 are\u2026 HUNGRY.",
    "A failed necromantic experiment. Three beast spirits bound to one corpse. The spirits still fight for dominance.",
    "/models/characters/werewolf.glb", 2.1, "male",
    worge(290, 37), true, false, "combat", { x: 2, z: 2 }),

  h("hero_vexis", "Necromancer Vexis", "The Soul Harvester",
    "legion", "undead", "mage",
    "Death is not the end. It is the door to real power.",
    "A healer in life, raised specifically for her magical knowledge. The irony is not lost on her.",
    "/models/characters/vampire_aristocrat-female.glb", 1.8, "female",
    mage(150, 43), true, true, "harvest", { x: 3, z: 3 }),

  h("hero_shade", "Shade Whisper", "The Phantom Archer",
    "legion", "undead", "ranger",
    "I remember your face. I remember all their faces.",
    "In life she was Elena Brightarrow, finest Crusade scout. Now she hunts her former comrades with the same skill.",
    "/models/characters/vampire_aristocrat-female.glb", 1.8, "female",
    ranger(155, 33), true, false, "explore", { x: 4, z: 3 }),
];

// ─────────────────────────────────────────────────────────────────────────────
// Lookups
// ─────────────────────────────────────────────────────────────────────────────

export function getHero(id: string): HeroDef | undefined {
  return ALL_HEROES.find((h) => h.id === id);
}

export function getHeroesByFaction(faction: FactionId): HeroDef[] {
  return ALL_HEROES.filter((h) => h.faction === faction);
}

export function getVendorHero(faction: FactionId): HeroDef | undefined {
  return ALL_HEROES.find((h) => h.faction === faction && h.isVendor);
}

/** All heroes that act as mission givers. */
export function getMissionGivers(): HeroDef[] {
  return ALL_HEROES.filter((h) => h.isMissionGiver);
}
