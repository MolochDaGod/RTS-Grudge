/**
 * WorldEventRegistry — timed, repeatable world events per zone.
 *
 * Events fire on UTC-clock schedules (same lightweight approach as the
 * hero daily cycle). When an event is active, the game world changes:
 *
 *   FactionInvasion  — Enemy spawn rate triples in the target zone for 30 min.
 *   TreasureSpawn    — A rare chest appears near the zone boss area.
 *   BossEmergence    — A boss-tier enemy patrols outside dungeon entrance.
 *   ResourceBoom     — Doubled yield from a specific resource type for 30 min.
 *   StormEvent       — Weather flips to storm + all enemies gain +20 % aggression.
 *
 * useWorldEvents.ts owns the runtime state and checks/resolves active events.
 * FactionHeroes.tsx and WaveSpawner.tsx can query the active event store to
 * modify their behaviour accordingly.
 */

import type { ZoneId } from "./WorldZoneRegistry";
import type { FactionId } from "./HeroRegistry";

// ─────────────────────────────────────────────────────────────────────────────

export type WorldEventType =
  | "FactionInvasion"
  | "TreasureSpawn"
  | "BossEmergence"
  | "ResourceBoom"
  | "StormEvent";

export interface WorldEventDef {
  id: string;
  type: WorldEventType;
  title: string;
  description: string;
  /** Which world zone this event targets. */
  zone: ZoneId;
  /** UTC hour the event can first trigger (0-23). */
  triggerHour: number;
  /** Duration in real minutes. */
  durationMinutes: number;
  /** Whether the event resets next day. */
  repeatable: boolean;
  /** Optional: minimum player level to see the event notification. */
  minPlayerLevel?: number;
  /** Loot or bonus applied when the event resolves (player claims). */
  reward: {
    xp: number;
    gold: number;
    description: string;
  };
  /** Hex colour for the HUD notification banner. */
  bannerColor: string;
  /** Emoji icon for the HUD and world map. */
  icon: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event definitions
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_WORLD_EVENTS: WorldEventDef[] = [

  // ── FACTION INVASION ─────────────────────────────────────────────────────
  {
    id: "event_crusade_invasion",
    type: "FactionInvasion",
    title: "Crusade Under Siege",
    description:
      "Legion forces are launching a coordinated assault on the Jade Seas. " +
      "Enemy spawn rate is tripled in the tropical zone. Drive them back!",
    zone: "tropical",
    triggerHour: 20,        // 8 PM UTC
    durationMinutes: 30,
    repeatable: true,
    minPlayerLevel: 3,
    reward: { xp: 800, gold: 300, description: "Crusade Defender bonus" },
    bannerColor: "#cc3333",
    icon: "⚔️",
  },

  {
    id: "event_legion_push",
    type: "FactionInvasion",
    title: "Legion Offensive",
    description:
      "The Legion is pushing through the volcanic reaches. " +
      "Stronger enemies flood the lava zone for 30 minutes.",
    zone: "lava",
    triggerHour: 14,        // 2 PM UTC
    durationMinutes: 30,
    repeatable: true,
    minPlayerLevel: 8,
    reward: { xp: 1200, gold: 500, description: "Legion Hunter bonus" },
    bannerColor: "#cc4422",
    icon: "🔥",
  },

  // ── TREASURE SPAWN ───────────────────────────────────────────────────────
  {
    id: "event_treasure_tropical",
    type: "TreasureSpawn",
    title: "Pirate Treasure Found",
    description:
      "A buried treasure cache has surfaced near the Jade Seas boss area. " +
      "Find it before the tide takes it back!",
    zone: "tropical",
    triggerHour: 12,        // noon UTC
    durationMinutes: 20,
    repeatable: true,
    minPlayerLevel: 2,
    reward: { xp: 600, gold: 450, description: "Treasure Hunter bonus" },
    bannerColor: "#c9a044",
    icon: "💰",
  },

  // ── BOSS EMERGENCE ───────────────────────────────────────────────────────
  {
    id: "event_frost_titan",
    type: "BossEmergence",
    title: "Frost Titan Stirs",
    description:
      "The Frost Titan has left its lair in the Frozen Reach. " +
      "It wanders the zone perimeter for 20 minutes. Face it for legendary rewards.",
    zone: "ice",
    triggerHour: 2,         // 2 AM UTC
    durationMinutes: 20,
    repeatable: true,
    minPlayerLevel: 10,
    reward: { xp: 3000, gold: 1000, description: "Boss Slayer bonus" },
    bannerColor: "#88ccff",
    icon: "🧊",
  },

  // ── RESOURCE BOOM ────────────────────────────────────────────────────────
  {
    id: "event_crystal_surge",
    type: "ResourceBoom",
    title: "Crystal Surge",
    description:
      "Ley-line energy pulses through the ice zone. Crystal nodes yield " +
      "double this period. Harvest quickly — it won't last.",
    zone: "ice",
    triggerHour: 8,         // 8 AM UTC
    durationMinutes: 30,
    repeatable: true,
    reward: { xp: 200, gold: 100, description: "Harvester bonus" },
    bannerColor: "#66aaff",
    icon: "💎",
  },

  {
    id: "event_gold_vein",
    type: "ResourceBoom",
    title: "Gold Vein Eruption",
    description:
      "Volcanic activity in the Ember Reaches has pushed gold ore to the surface. " +
      "Gold nodes yield triple for 30 minutes.",
    zone: "lava",
    triggerHour: 16,        // 4 PM UTC
    durationMinutes: 30,
    repeatable: true,
    reward: { xp: 200, gold: 120, description: "Prospector bonus" },
    bannerColor: "#ccaa33",
    icon: "🥇",
  },

  // ── STORM EVENT ──────────────────────────────────────────────────────────
  {
    id: "event_void_storm",
    type: "StormEvent",
    title: "Void Storm",
    description:
      "A storm of dark energy tears through the Shattered Deep. " +
      "All enemies gain +20 % aggression and see farther. Weather is mandatory storm.",
    zone: "boss",
    triggerHour: 0,         // midnight UTC
    durationMinutes: 45,
    repeatable: true,
    minPlayerLevel: 12,
    reward: { xp: 500, gold: 200, description: "Storm Survivor bonus" },
    bannerColor: "#9966cc",
    icon: "🌀",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getWorldEvent(id: string): WorldEventDef | undefined {
  return ALL_WORLD_EVENTS.find((e) => e.id === id);
}

export function getEventsByZone(zone: ZoneId): WorldEventDef[] {
  return ALL_WORLD_EVENTS.filter((e) => e.zone === zone);
}

export function getEventsByType(type: WorldEventType): WorldEventDef[] {
  return ALL_WORLD_EVENTS.filter((e) => e.type === type);
}

/**
 * Returns which events *could* be active right now based on UTC hour.
 * Actual active state is managed by useWorldEvents.ts.
 */
export function getCurrentlyEligibleEvents(): WorldEventDef[] {
  const hour = new Date().getUTCHours();
  return ALL_WORLD_EVENTS.filter((e) => e.triggerHour === hour);
}
