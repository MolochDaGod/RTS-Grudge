/**
 * Art Assets — thin wrapper over fleet ui-art.json registry.
 *
 * Canonical URLs from grudge-skill-tree/class-selector.html (proven production art).
 * Race portraits + class stage backgrounds must be imported from here — never
 * duplicated as local /icons/grudge/entities paths or ad-hoc imgur strings.
 */

import type { CombatClass } from "@/lib/stores/useGame";
import {
  getRacePortraitUrl,
  getClassHeroUrl,
  getClassAccentColor,
  getCombatClassBackgroundUrl,
  UI_ART_FALLBACK,
} from "@/lib/data/uiArt";

/** Hero-art race portraits (class-selector.html RACES map). */
export const RACE_PORTRAITS = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    return getRacePortraitUrl(prop);
  },
});

export type ArtRaceId = "elf" | "human" | "dwarf" | "orc" | "barbarian" | "undead";

/** Full-bleed class hero art (class-selector.html CLASSES + stage backgrounds). */
export const CLASS_HERO_IMAGES = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    return getClassHeroUrl(prop);
  },
});

export type ArtClassId = "mage" | "warrior" | "ranger" | "worge" | "worg";

/** Skill-tree / panel parchment backdrop. */
export const PANEL_BG = UI_ART_FALLBACK.panels.parchment;

/** Menu + Hero Forge cycling class stage backgrounds. */
export const CLASS_STAGE_BACKGROUNDS = CLASS_HERO_IMAGES;

export const CLASS_ACCENT_COLORS = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    return getClassAccentColor(prop);
  },
});

export const CLASS_CYCLE = ["warrior", "mage", "ranger", "worge"] as const;

/** Hero Forge combatClass → class-selector hero background. */
export const COMBAT_CLASS_BACKGROUNDS: Record<CombatClass, string> = {
  melee: getCombatClassBackgroundUrl("melee"),
  caster: getCombatClassBackgroundUrl("caster"),
  ranger: getCombatClassBackgroundUrl("ranger"),
};

export function getRacePortrait(race: string): string {
  return getRacePortraitUrl(race);
}

export function getClassHeroImage(cls: string): string {
  return getClassHeroUrl(cls);
}

/** Race picker tiles for Hero Forge — portraits always from RACE_PORTRAITS. */
export const RACE_PICKER_TILES: {
  id: ArtRaceId;
  name: string;
  modelFilter: string;
  icon: string;
  portrait: string;
}[] = [
  { id: "elf",       name: "Elf",       modelFilter: "/elf-",              icon: "🧝", portrait: getRacePortraitUrl("elf") },
  { id: "human",     name: "Human",     modelFilter: "assassin",           icon: "👤", portrait: getRacePortraitUrl("human") },
  { id: "dwarf",     name: "Dwarf",     modelFilter: "/dwarf-",            icon: "⛏️", portrait: getRacePortraitUrl("dwarf") },
  { id: "orc",       name: "Orc",       modelFilter: "orc_scout",          icon: "👹", portrait: getRacePortraitUrl("orc") },
  { id: "barbarian", name: "Barbarian", modelFilter: "battle_mage",        icon: "🪓", portrait: getRacePortraitUrl("barbarian") },
  { id: "undead",    name: "Undead",    modelFilter: "vampire_aristocrat", icon: "💀", portrait: getRacePortraitUrl("undead") },
];