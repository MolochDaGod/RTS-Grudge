/**
 * PortRegistry — port definitions for all faction docks.
 *
 * Each port entry declares:
 *   - World position (matches GameScene DEFAULT_DOCKS where applicable)
 *   - Faction affiliation
 *   - Available services (repair, resupply items)
 *   - Ambient NPC archetypes to spawn at the dock
 *   - Linked sailing destinations (island grid coords for useIslandWorld)
 *   - Adventure island arrival position for hero AI sailing
 *
 * World map rendering: PortRegistry provides the positions for the ⚓ anchor
 * icons drawn in WorldMap.tsx.
 */

import type { FactionId } from "./HeroRegistry";
import type { AmbientNPCArchetype } from "./DistrictRegistry";
import type { InventoryItem } from "@/lib/stores/useInventory";

// ─────────────────────────────────────────────────────────────────────────────

export interface PortService {
  /** Gold cost to fully repair player HP. */
  repairCost: number;
  /** Items available to resupply (purchased with gold_coin). */
  resupplyItems: Array<{
    itemId: string;
    name: string;
    icon: string;
    price: number;
  }>;
}

export interface PortDef {
  id: string;
  name: string;
  faction: FactionId | "neutral" | "pirate";
  /** Hex accent colour for map icon. */
  mapColor: string;
  /** World-space [x, z] dock position (matches GameScene dock rotation). */
  worldX: number;
  worldZ: number;
  /** Rapier dock rotation (radians) — passed to DockArea. */
  dockRotation: number;
  /** Number of boat slips. */
  dockCount: number;
  services: PortService;
  /** Ambient NPC archetypes to populate the dock. */
  npcTypes: AmbientNPCArchetype[];
  /**
   * useIslandWorld grid destinations this port can sail to.
   * Each entry: [gridX, gridZ].
   */
  destinations: [number, number][];
  /** Short flavour text shown in the port UI. */
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Common resupply catalogues per faction
// ─────────────────────────────────────────────────────────────────────────────

const NEUTRAL_RESUPPLY = [
  { itemId: "health_potion",    name: "Health Potion",    icon: "❤️",  price: 55  },
  { itemId: "bandage",          name: "Bandage",           icon: "🩹",  price: 20  },
  { itemId: "cooked_meat",      name: "Cooked Meat",       icon: "🍖",  price: 18  },
  { itemId: "stamina_tonic",    name: "Stamina Tonic",     icon: "🧪",  price: 45  },
];

const CRUSADE_RESUPPLY = [
  ...NEUTRAL_RESUPPLY,
  { itemId: "holy_potion",      name: "Holy Potion",       icon: "✨",  price: 80  },
  { itemId: "iron_ore",         name: "Iron Ore",          icon: "⛏️",  price: 12  },
];

const LEGION_RESUPPLY = [
  ...NEUTRAL_RESUPPLY,
  { itemId: "dark_elixir",      name: "Dark Elixir",       icon: "🫧",  price: 90  },
  { itemId: "gold_ore",         name: "Gold Ore",          icon: "🥇",  price: 10  },
];

const PIRATE_RESUPPLY = [
  ...NEUTRAL_RESUPPLY,
  { itemId: "fiber",            name: "Rope & Fiber",      icon: "🌿",  price: 8   },
  { itemId: "wood",             name: "Ship Timber",       icon: "🪵",  price: 8   },
];

// ─────────────────────────────────────────────────────────────────────────────
// Port definitions
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_PORTS: PortDef[] = [
  // ── Home Island — South Harbor (default sailing dock) ────────────────────
  {
    id: "home_south",
    name: "South Harbor",
    faction: "pirate",
    mapColor: "#4499cc",
    worldX: 0,
    worldZ: 85,
    dockRotation: -Math.PI / 2,
    dockCount: 2,
    services: {
      repairCost: 30,
      resupplyItems: PIRATE_RESUPPLY,
    },
    npcTypes: ["DockWorker", "PatrolGuard"],
    destinations: [[-2, -2], [3, -2], [3, 1], [-1, 2]],
    description:
      "The busiest port on the island. Pirate merchants and neutral traders dock here freely. No questions asked.",
  },

  // ── Home Island — West Dock (Crusade fleet) ───────────────────────────────
  {
    id: "home_west",
    name: "West Dock",
    faction: "crusade",
    mapColor: "#c9a044",
    worldX: -85,
    worldZ: 0,
    dockRotation: 0,
    dockCount: 1,
    services: {
      repairCost: 25,
      resupplyItems: CRUSADE_RESUPPLY,
    },
    npcTypes: ["DockWorker", "TownGuard"],
    destinations: [[-2, -2], [-3, -2], [-4, -3], [-2, -3]],
    description:
      "Crusade war galleons are maintained here. Temple Knights stand watch around the clock.",
  },

  // ── Home Island — East Dock (Legion landing) ─────────────────────────────
  {
    id: "home_east",
    name: "East Dock",
    faction: "legion",
    mapColor: "#cc4444",
    worldX: 85,
    worldZ: 0,
    dockRotation: Math.PI,
    dockCount: 1,
    services: {
      repairCost: 25,
      resupplyItems: LEGION_RESUPPLY,
    },
    npcTypes: ["DockWorker", "PatrolGuard"],
    destinations: [[3, 1], [4, 1], [4, 2], [3, 2]],
    description:
      "Legion assault barges offload here. Non-Legion vessels are tolerated — barely.",
  },

  // ── Adventure zone port — Crusade outpost (tropical zone) ────────────────
  {
    id: "crusade_outpost",
    name: "Crusade Shore Camp",
    faction: "crusade",
    mapColor: "#c9a044",
    worldX: -62,   // matches crusade hub world position
    worldZ: -90,
    dockRotation: 0,
    dockCount: 1,
    services: {
      repairCost: 40,
      resupplyItems: CRUSADE_RESUPPLY,
    },
    npcTypes: ["DockWorker", "TownGuard"],
    destinations: [[-2, -2], [-3, -3], [-1, -3]],
    description:
      "A forward camp deep in the Jade Seas. The Crusade resupplies its expeditionary forces here.",
  },

  // ── Adventure zone port — Fabled landing (ice zone) ──────────────────────
  {
    id: "fabled_landing",
    name: "Crystal Spire Landing",
    faction: "fabled",
    mapColor: "#44a8cc",
    worldX: 95,
    worldZ: -82,
    dockRotation: Math.PI / 2,
    dockCount: 1,
    services: {
      repairCost: 40,
      resupplyItems: NEUTRAL_RESUPPLY,
    },
    npcTypes: ["DockWorker"],
    destinations: [[3, -2], [4, -3], [2, -3]],
    description:
      "An ice-cut harbour carved by Fabled engineers. Frost still clings to the mooring ropes.",
  },

  // ── Adventure zone port — Legion lava shore ───────────────────────────────
  {
    id: "legion_shore",
    name: "Brimstone Wharf",
    faction: "legion",
    mapColor: "#cc4444",
    worldX: -15,
    worldZ: 48,
    dockRotation: -Math.PI / 2,
    dockCount: 1,
    services: {
      repairCost: 35,
      resupplyItems: LEGION_RESUPPLY,
    },
    npcTypes: ["PatrolGuard"],
    destinations: [[3, 1], [4, 2], [2, 2]],
    description:
      "The volcanic shore is treacherous, but the Legion fortified it anyway. Nothing here is comfortable.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getPort(id: string): PortDef | undefined {
  return ALL_PORTS.find((p) => p.id === id);
}

export function getPortsForFaction(faction: string): PortDef[] {
  return ALL_PORTS.filter((p) => p.faction === faction);
}

export function getHomeIslandPorts(): PortDef[] {
  return ALL_PORTS.filter((p) => p.id.startsWith("home_"));
}

/** Returns all ports as world-map pin data. */
export function getPortMapPins(): Array<{
  id: string;
  label: string;
  worldX: number;
  worldZ: number;
  color: string;
}> {
  return ALL_PORTS.map((p) => ({
    id: p.id,
    label: p.name,
    worldX: p.worldX,
    worldZ: p.worldZ,
    color: p.mapColor,
  }));
}
