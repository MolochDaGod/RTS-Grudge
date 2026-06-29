/**
 * Art Assets — single source of truth for Hero Forge / character creation UI.
 *
 * Canonical URLs from grudge-skill-tree/class-selector.html (proven production art).
 * Race portraits + class stage backgrounds must be imported from here — never
 * duplicated as local /icons/grudge/entities paths or ad-hoc imgur strings.
 */

import type { CombatClass } from "@/lib/stores/useGame";

/** Hero-art race portraits (class-selector.html RACES map). */
export const RACE_PORTRAITS = {
  elf:       "https://i.imgur.com/rWEKVAw.png",
  human:     "https://i.imgur.com/qBSRLZG.png",
  dwarf:     "https://i.imgur.com/6A4px2O.png",
  orc:       "https://i.imgur.com/4PyTEN5.png",
  barbarian: "https://i.imgur.com/7WKJ8Bw.png",
  undead:    "https://i.imgur.com/mPTojTj.png",
} as const;

export type ArtRaceId = keyof typeof RACE_PORTRAITS;

/** Full-bleed class hero art (class-selector.html CLASSES + stage backgrounds). */
export const CLASS_HERO_IMAGES = {
  mage:    "https://i.imgur.com/vKQR4UT.png",
  warrior: "https://i.imgur.com/Wj2mUH2.png",
  ranger:  "https://i.imgur.com/5A6e5kL.png",
  worge:   "https://i.imgur.com/BrQH0Bx.png",
  worg:    "https://i.imgur.com/BrQH0Bx.png",
} as const;

export type ArtClassId = keyof typeof CLASS_HERO_IMAGES;

/** Skill-tree / panel parchment backdrop. */
export const PANEL_BG = "https://i.imgur.com/0SOCXgv.png";

/** Menu + Hero Forge cycling class stage backgrounds. */
export const CLASS_STAGE_BACKGROUNDS = CLASS_HERO_IMAGES;

export const CLASS_ACCENT_COLORS = {
  mage:    "#6aa9ff",
  warrior: "#ff6b57",
  ranger:  "#6bdc8b",
  worge:   "#c792ff",
} as const;

export const CLASS_CYCLE = ["warrior", "mage", "ranger", "worge"] as const;

/** Hero Forge combatClass → class-selector hero background. */
export const COMBAT_CLASS_BACKGROUNDS: Record<CombatClass, string> = {
  melee:  CLASS_HERO_IMAGES.warrior,
  caster: CLASS_HERO_IMAGES.mage,
  ranger: CLASS_HERO_IMAGES.ranger,
};

export function getRacePortrait(race: string): string {
  const key = race.toLowerCase() as ArtRaceId;
  return RACE_PORTRAITS[key] ?? RACE_PORTRAITS.human;
}

export function getClassHeroImage(cls: string): string {
  const key = cls.toLowerCase() as ArtClassId;
  return CLASS_HERO_IMAGES[key] ?? CLASS_HERO_IMAGES.warrior;
}

/** Race picker tiles for Hero Forge — portraits always from RACE_PORTRAITS. */
export const RACE_PICKER_TILES: {
  id: ArtRaceId;
  name: string;
  modelFilter: string;
  icon: string;
  portrait: string;
}[] = [
  { id: "elf",       name: "Elf",       modelFilter: "/elf-",              icon: "🧝", portrait: RACE_PORTRAITS.elf },
  { id: "human",     name: "Human",     modelFilter: "assassin",           icon: "👤", portrait: RACE_PORTRAITS.human },
  { id: "dwarf",     name: "Dwarf",     modelFilter: "/dwarf-",            icon: "⛏️", portrait: RACE_PORTRAITS.dwarf },
  { id: "orc",       name: "Orc",       modelFilter: "orc_scout",          icon: "👹", portrait: RACE_PORTRAITS.orc },
  { id: "barbarian", name: "Barbarian", modelFilter: "battle_mage",        icon: "🪓", portrait: RACE_PORTRAITS.barbarian },
  { id: "undead",    name: "Undead",    modelFilter: "vampire_aristocrat", icon: "💀", portrait: RACE_PORTRAITS.undead },
];