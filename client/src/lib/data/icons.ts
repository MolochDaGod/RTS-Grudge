import type { FactionId } from "./factions";

export const ICON_BASE = "/icons/grudge";

export const ATTRIBUTE_ICONS = {
  strength: `${ICON_BASE}/attributes/strength.png`,
  intellect: `${ICON_BASE}/attributes/intellect.png`,
  vitality: `${ICON_BASE}/attributes/vitality.png`,
  dexterity: `${ICON_BASE}/attributes/dexterity.png`,
  endurance: `${ICON_BASE}/attributes/endurance.png`,
  wisdom: `${ICON_BASE}/attributes/wisdom.png`,
  agility: `${ICON_BASE}/attributes/agility.png`,
  tactics: `${ICON_BASE}/attributes/tactics.png`,
} as const;

export const FACTION_EMBLEMS: Record<Exclude<FactionId, "pirate">, string> = {
  crusade: `${ICON_BASE}/factions/crusade-emblem.png`,
  fabled: `${ICON_BASE}/factions/fabled-emblem.png`,
  legion: `${ICON_BASE}/factions/legion-emblem.png`,
};

export const FACTION_TENT: Record<Exclude<FactionId, "pirate">, string> = {
  crusade: enc(`${ICON_BASE}/entities/Tent Cruisade Icon.png`),
  fabled: enc(`${ICON_BASE}/entities/Tent Fabled Icon.png`),
  legion: enc(`${ICON_BASE}/entities/Tent Legion Icon.png`),
};

export type IconRace = "human" | "elf" | "dwarf" | "orc" | "barbarian" | "undead";
export type IconClass = "warrior" | "mage" | "worge" | "ranger";

const RACE_TO_FACTION: Record<IconRace, Exclude<FactionId, "pirate">> = {
  human: "crusade",
  barbarian: "crusade",
  dwarf: "fabled",
  elf: "fabled",
  orc: "legion",
  undead: "legion",
};

export function getRaceFaction(race: IconRace): Exclude<FactionId, "pirate"> {
  return RACE_TO_FACTION[race];
}

// Race "portrait" defaults — pick the warrior of each race so the player
// instantly reads the silhouette in tiles & badges.
const RACE_PORTRAIT_FILE: Record<IconRace, string> = {
  human: "Human Warrior.png",
  barbarian: "barb warrior.png",
  dwarf: "dwarf warrior.png",
  elf: "elf warrior.png",
  orc: "orc warrior.png",
  undead: "undead warrior.png",
};

export function getRacePortrait(race: IconRace): string {
  return enc(`${ICON_BASE}/entities/${RACE_PORTRAIT_FILE[race]}`);
}

// Per (race, archetype) entity portraits. Archetype keys mirror the file
// suffixes shipped in the entities/ pack: warrior / archer / mage / paladin / merc.
type RaceArchetype = "warrior" | "archer" | "mage" | "paladin" | "merc";

const RACE_FILE_PREFIX: Record<IconRace, string> = {
  human: "human",
  barbarian: "barb",
  dwarf: "dwarf",
  elf: "elf",
  orc: "orc",
  undead: "undead",
};

const RACE_ARCHETYPE_FILE: Record<IconRace, Partial<Record<RaceArchetype, string>>> = {
  human: { warrior: "Human Warrior.png", archer: "human archer.png", mage: "human mage.png", paladin: "human paladin.png", merc: "Human Merc.PNG" },
  barbarian: { warrior: "barb warrior.png", archer: "barb archer.png", mage: "barbarian Mage.png", paladin: "barb paladin.png", merc: "Barb merc.PNG" },
  dwarf: { warrior: "dwarf warrior.png", archer: "dwarf archer.png", mage: "dwarf mage.png", paladin: "dwarf paladin.png", merc: "Dwarve merc.PNG" },
  elf: { warrior: "elf warrior.png", archer: "elf archer.png", mage: "elf mage.png", paladin: "elf paladin.png", merc: "Elf Merc.PNG" },
  orc: { warrior: "orc warrior.png", archer: "orc archer.png", mage: "orc mage.png", paladin: "orc paladin.png", merc: "Orc Merc.PNG" },
  undead: { warrior: "undead warrior.png", archer: "undead archer.png", mage: "undead mage.png", paladin: "undead paladin.png", merc: "Undead Merc.PNG" },
};

export function getUnitIcon(race: IconRace, archetype: RaceArchetype): string {
  const file = RACE_ARCHETYPE_FILE[race]?.[archetype]
    ?? RACE_ARCHETYPE_FILE[race]?.warrior
    ?? `${RACE_FILE_PREFIX[race]} warrior.png`;
  return enc(`${ICON_BASE}/entities/${file}`);
}

// Class portrait for the 4 hero classes — keyed by HeroClass id from the
// stats store. "worge" has no dedicated icon in the pack, so we fall back
// to the orc warrior silhouette which reads as feral/melee.
const CLASS_DEFAULT_ARCHETYPE: Record<IconClass, RaceArchetype> = {
  warrior: "warrior",
  mage: "mage",
  worge: "warrior",
  ranger: "archer",
};

const CLASS_DEFAULT_RACE: Record<IconClass, IconRace> = {
  warrior: "human",
  mage: "human",
  worge: "orc",
  ranger: "human",
};

export function getClassIcon(cls: IconClass): string {
  return getUnitIcon(CLASS_DEFAULT_RACE[cls], CLASS_DEFAULT_ARCHETYPE[cls]);
}

// Profession (ally NPC role) → entity icon. Defaults to human variant; pass
// a race to get the matching racial portrait.
const PROFESSION_TO_ARCHETYPE: Record<string, RaceArchetype> = {
  Soldier: "warrior",
  Knight: "paladin",
  Archer: "archer",
  Mage: "mage",
  Wizard: "mage",
  Captain: "merc",
  Farmer: "merc",
  Worker: "merc",
};

export function getProfessionIcon(profession: string, race: IconRace = "human"): string {
  const archetype = PROFESSION_TO_ARCHETYPE[profession] ?? "warrior";
  return getUnitIcon(race, archetype);
}

// Building registry icon — keyword-matched against building name so the
// table doesn't need a maintained per-id map. Falls back to a generic
// house silhouette if nothing matches.
const BUILDING_KEYWORD_ICONS: { match: RegExp; file: string }[] = [
  { match: /watch.?tower|wall.?tower|^tower/i, file: "tower.PNG" },
  { match: /wall/i, file: "Stone Wall Icon.png" },
  { match: /gate/i, file: "Stone Gate Icon.png" },
  { match: /archery|ranger.?lodge/i, file: "Arsenal Icon.png" },
  { match: /barracks|warrior.?hall/i, file: "Armory Icon.png" },
  { match: /mage.?tower/i, file: "Laboritory.PNG" },
  { match: /wizard.?sanctum|sanctum|temple/i, file: "Study.PNG" },
  { match: /captain.?quarters|town.?center|hall/i, file: "House Icon.png" },
  { match: /camp(?!fire)|farmer/i, file: "Campfire.PNG" },
  { match: /lumber|sawmill/i, file: "Sawmill Icon.png" },
  { match: /herb|garden|loom/i, file: "Loom.PNG" },
  { match: /mining|mine|foundry/i, file: "Foundry Icon.png" },
  { match: /crystal|grove|refinery/i, file: "Refinery Icon.png" },
  { match: /wonder/i, file: "Castle Stairs Icon.png" },
  { match: /market/i, file: "Market Icon.png" },
  { match: /storage|stockpile/i, file: "Storage.PNG" },
  { match: /windmill|farm/i, file: "Sawmill Icon.png" },
  { match: /house|cabin|hut|home/i, file: "House Icon.png" },
  { match: /blacksmith/i, file: "Blacksmith Icon.png" },
  { match: /armory/i, file: "Armory Icon.png" },
  { match: /workbench/i, file: "Workbench.PNG" },
  { match: /tannery/i, file: "Tannery.PNG" },
  { match: /stable/i, file: "Stable Icon.png" },
  { match: /tent/i, file: "Tent Cruisade Icon.png" },
];

export function getBuildingIcon(nameOrId: string): string {
  for (const { match, file } of BUILDING_KEYWORD_ICONS) {
    if (match.test(nameOrId)) return enc(`${ICON_BASE}/entities/${file}`);
  }
  return enc(`${ICON_BASE}/entities/House Icon.png`);
}

function enc(p: string): string {
  // Encode spaces & other URL-unsafe chars in filenames while preserving
  // path separators.
  return p.split("/").map(seg => encodeURIComponent(seg)).join("/").replace(/^%2F/, "/");
}
