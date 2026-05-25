/**
 * GrudgeAssetManifest — Canonical paths for all labeled Grudge Studio icons.
 *
 * Source: attached_assets/backgroundsandimages/ (labeled PNGs)
 * Deployed to: client/public/icons/grudge/ (served at /icons/grudge/*)
 *
 * Usage:
 *   import { RACE_EMBLEMS, FACTION_EMBLEMS, CLASS_ICONS } from "@/lib/data/GrudgeAssetManifest";
 *   <img src={RACE_EMBLEMS.human} />
 *   <img src={FACTION_EMBLEMS.crusade} />
 */

// ── Race Emblems ─────────────────────────────────────────────────────────────

export const RACE_EMBLEMS = {
  human:     "/icons/grudge/emblems/human.png",
  elf:       "/icons/grudge/emblems/elf.png",
  dwarf:     "/icons/grudge/emblems/dwarf.png",
  orc:       "/icons/grudge/emblems/orc.png",
  undead:    "/icons/grudge/emblems/undead.png",
  barbarian: "/icons/grudge/emblems/barbarian.png",
  worge:     "/icons/grudge/emblems/worge.png",
} as const;

export type RaceName = keyof typeof RACE_EMBLEMS;

// ── Faction Emblems ──────────────────────────────────────────────────────────

export const FACTION_EMBLEMS = {
  crusade: "/icons/grudge/emblems/crusade.png",
  fabled:  "/icons/grudge/emblems/fabled.png",
  legion:  "/icons/grudge/emblems/legion.png",
} as const;

export type FactionName = keyof typeof FACTION_EMBLEMS;

// ── Class Icons ──────────────────────────────────────────────────────────────

export const CLASS_ICONS = {
  warrior: "/icons/grudge/classes/warrior.png",
  mage:    "/icons/grudge/classes/mage.png",
  ranger:  "/icons/grudge/classes/ranger.png",
  attack:  "/icons/grudge/classes/attack.png",
  defend:  "/icons/grudge/classes/defend.png",
} as const;

// ── Zone Backgrounds ─────────────────────────────────────────────────────────

export const ZONE_BACKGROUNDS = {
  ethereal:       "/icons/grudge/zones/ethereal.png",
  lava:           "/icons/grudge/zones/lava.png",
  boss:           "/icons/grudge/zones/boss.png",
  world_overview: "/icons/grudge/zones/world_overview.jpeg",
} as const;

// ── Profession Icons ─────────────────────────────────────────────────────────

export const PROFESSION_ICONS = {
  forestry: "/icons/grudge/ui/forestry.png",
  mining:   "/icons/grudge/ui/mining.png",
} as const;

// ── UI Assets ────────────────────────────────────────────────────────────────

export const UI_ASSETS = {
  pirate:  "/icons/grudge/ui/pirate.png",
  tavern:  "/icons/grudge/ui/tavern.png",
  battle:  "/icons/grudge/ui/battle.png",
  logo:    "/icons/grudge/ui/logo.png",
  splash:  "/icons/grudge/ui/splash.jpg",
  discord: "/icons/grudge/ui/discord.png",
} as const;

// ── Combined lookup ──────────────────────────────────────────────────────────

/** Get the emblem path for a race name (case-insensitive). */
export function getRaceEmblem(race: string): string {
  const key = race.toLowerCase() as RaceName;
  return RACE_EMBLEMS[key] ?? RACE_EMBLEMS.human;
}

/** Get the emblem path for a faction name (case-insensitive). */
export function getFactionEmblem(faction: string): string {
  const key = faction.toLowerCase() as FactionName;
  return FACTION_EMBLEMS[key] ?? FACTION_EMBLEMS.crusade;
}
