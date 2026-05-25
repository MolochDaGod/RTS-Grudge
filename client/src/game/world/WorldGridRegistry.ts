/**
 * WorldGridRegistry — 9-zone MMO world definition.
 *
 * The world is a 3×3 grid of major islands separated by ocean. Each island
 * is a full zone with its own biome, terrain, faction town, dungeons, mob
 * spawns, and docks for inter-zone travel.
 *
 *   [Ethereal/Void]  [Mountains/Neutral]  [Jungle/Crusade]
 *   [Forest/Crusade] [Plains/Hub]         [Desert/Legion]
 *   [Swamp/Neutral]  [Coast/Pirate★]      [Lava/Legion]
 *
 * ★ Coast is the starting zone — uses the tutorial island GLB scene.
 *   All other zones use procedural heightmap terrain from IslandGenerator.
 *
 * Grid coordinates: row 0 = north, col 0 = west.
 * World offsets: 500-unit spacing (400-unit island + 100-unit ocean gap).
 */

import type { BiomeId } from "../systems/BiomeSpawnRegistry";
import type { IslandBiome } from "@/lib/stores/useIslandWorld";
import type { EnemyType } from "../systems/EnemyManager";

// ── Zone definition ──────────────────────────────────────────────────────────

export type ZoneId =
  | "plains"    // center hub
  | "coast"     // starting zone (tutorial island)
  | "forest"
  | "desert"
  | "swamp"
  | "ethereal"  // NW — Eternity Falls, void water, Shattered Deep
  | "lava"      // SE — Ember Reaches, volcanic birth of new islands
  | "jungle"    // NE — Emerald Jungle, Crusade frontier
  | "mountains";

export type FactionId = "neutral" | "crusade" | "fabled" | "legion" | "pirate";

export type TerrainSource =
  | { type: "heightmap"; biome: IslandBiome; seed: number }
  | { type: "glb"; path: string; scale: number };

export interface DockPosition {
  x: number;
  z: number;
  rotation: number;
  /** Which zone this dock connects to */
  destination: ZoneId;
  label: string;
}

export interface DungeonPortal {
  x: number;
  z: number;
  /** Dungeon difficulty tier (1-5) */
  tier: number;
  name: string;
  /** Min player level to enter */
  minLevel: number;
}

export interface TownLayout {
  center: { x: number; z: number };
  name: string;
  /** NPC vendor/questgiver count */
  npcCount: number;
  /** Has a crafting station cluster */
  hasCraftingHub: boolean;
  /** Has a faction vendor */
  hasFactionVendor: boolean;
  /** Has an auction house / trade post */
  hasTradePost: boolean;
}

export interface BossArena {
  center: { x: number; z: number };
  radius: number;
  bossType: EnemyType;
  bossName: string;
  minLevel: number;
  /** Respawn interval in seconds */
  respawnSeconds: number;
}

export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  subtitle: string;
  description: string;
  /** Grid position in the 3×3 world */
  gridRow: number;  // 0=north, 2=south
  gridCol: number;  // 0=west, 2=east
  /** World-space offset (center of this island) */
  worldOffset: { x: number; z: number };
  /** Island size in world units (square) */
  size: number;
  /** Player level range for this zone */
  levelRange: [number, number];
  /** Controlling faction */
  faction: FactionId;
  /** Biome for spawn tables + visual theming */
  biome: BiomeId;
  /** How the terrain is generated */
  terrain: TerrainSource;
  /** Main settlement */
  town: TownLayout;
  /** Dock positions for inter-zone travel */
  docks: DockPosition[];
  /** Dungeon entrance locations */
  dungeons: DungeonPortal[];
  /** World boss arena */
  boss: BossArena | null;
  /** Sub-camps / outposts (faction or NPC) */
  camps: Array<{ x: number; z: number; name: string; type: "faction" | "bandit" | "merchant" }>;
  /** Zone-specific ambient color */
  ambientColor: string;
  /** Zone-specific fog */
  fogColor: string;
  fogDensity: number;
}

// ── Grid constants ───────────────────────────────────────────────────────────

/** Total spacing between island centers (island + ocean gap) */
const GRID_SPACING = 4500; // 4000m island + 500m ocean
/** Default island size in meters */
const ISLAND_SIZE = 4000;
/** Home island size (tutorial island GLB scale reference) */
export const HOME_ISLAND_SIZE = 300;

function gridOffset(row: number, col: number): { x: number; z: number } {
  return {
    x: (col - 1) * GRID_SPACING,  // col 1 = center = x:0
    z: (row - 1) * GRID_SPACING,  // row 1 = center = z:0
  };
}

// ── The 9 zones ──────────────────────────────────────────────────────────────

export const WORLD_ZONES: ZoneDefinition[] = [
  // ─── Row 0 (North) ──────────────────────────────────────────────────────
  {
    id: "ethereal",
    name: "Eternity Falls",
    subtitle: "The Shattered Deep — Void Water Zone",
    description: "Where the ocean meets the void. Eternity Falls consumes and recycles all things that drift into its pull — ships, islands, even time itself. Sinking islands descend into ethereal mist. The water glows with spectral energy and ancient ruins surface briefly before being swallowed again. This is where the world ends and begins anew.",
    gridRow: 0, gridCol: 0,
    worldOffset: gridOffset(0, 0),
    size: ISLAND_SIZE,
    levelRange: [35, 50],
    faction: "neutral",
    biome: "swamp", // low terrain, heavy water, eerie fog
    terrain: { type: "heightmap", biome: "cursed", seed: 7001 },
    town: {
      center: { x: 0, z: 200 },
      name: "The Threshold",
      npcCount: 8,
      hasCraftingHub: true,
      hasFactionVendor: false,
      hasTradePost: false,
    },
    docks: [
      { x: -80, z: 1800, rotation: Math.PI, destination: "forest", label: "South to Dark Forest" },
      { x: 1800, z: 0, rotation: Math.PI / 2, destination: "mountains", label: "East to Iron Peaks" },
    ],
    dungeons: [
      { x: -600, z: -800, tier: 4, name: "Abyssal Rift", minLevel: 38 },
      { x: 500, z: -600, tier: 5, name: "Void Sanctum", minLevel: 45 },
    ],
    boss: {
      center: { x: 0, z: -1200 },
      radius: 40,
      bossType: "demon",
      bossName: "The Eternalkeeper",
      minLevel: 48,
      respawnSeconds: 3600,
    },
    camps: [
      { x: -800, z: -300, name: "Sunken Ruins", type: "bandit" },
      { x: 700, z: 400, name: "Void Researchers", type: "merchant" },
    ],
    ambientColor: "#221144",
    fogColor: "#110033",
    fogDensity: 0.04,
  },
  {
    id: "mountains",
    name: "The Iron Peaks",
    subtitle: "Neutral Mining Territory",
    description: "Jagged mountain ranges rich in ore and crystal. Neutral ground contested by all factions. Golem and dragon-class enemies patrol the high ridges. The deepest mines hold starmetal veins.",
    gridRow: 0, gridCol: 1,
    worldOffset: gridOffset(0, 1),
    size: ISLAND_SIZE,
    levelRange: [20, 40],
    faction: "neutral",
    biome: "mountains",
    terrain: { type: "heightmap", biome: "volcanic", seed: 7002 },
    town: {
      center: { x: 10, z: 30 },
      name: "Highforge",
      npcCount: 10,
      hasCraftingHub: true,
      hasFactionVendor: false,
      hasTradePost: true,
    },
    docks: [
      { x: -180, z: 0, rotation: -Math.PI / 2, destination: "snow", label: "West to Frozen Reach" },
      { x: 180, z: 0, rotation: Math.PI / 2, destination: "lava", label: "East to Ember Reaches" },
      { x: 0, z: 180, rotation: Math.PI, destination: "plains", label: "South to Central Hub" },
    ],
    dungeons: [
      { x: -50, z: -120, tier: 3, name: "Deep Mines", minLevel: 25 },
      { x: 70, z: -90, tier: 4, name: "Dragon's Lair", minLevel: 35 },
    ],
    boss: {
      center: { x: 0, z: -150 },
      radius: 35,
      bossType: "dragon",
      bossName: "Stormfang, the Peak Wyrm",
      minLevel: 38,
      respawnSeconds: 2400,
    },
    camps: [
      { x: -100, z: 60, name: "Dwarven Miners", type: "merchant" },
      { x: 120, z: -30, name: "Golem Quarry", type: "bandit" },
    ],
    ambientColor: "#aabbcc",
    fogColor: "#778899",
    fogDensity: 0.015,
  },
  {
    id: "jungle",
    name: "The Emerald Jungle",
    subtitle: "Crusade Frontier",
    description: "Dense tropical canopy with hidden Crusade temples and dinosaur nesting grounds. The Jade Seas crash against cliffs lined with ancient ruins. Raptors hunt in coordinated packs. The jungle conceals the oldest temples on the archipelago.",
    gridRow: 0, gridCol: 2,
    worldOffset: gridOffset(0, 2),
    size: ISLAND_SIZE,
    levelRange: [15, 35],
    faction: "crusade",
    biome: "jungle",
    terrain: { type: "heightmap", biome: "tropical", seed: 7003 },
    town: {
      center: { x: 0, z: 200 },
      name: "Temple Landing",
      npcCount: 12,
      hasCraftingHub: true,
      hasFactionVendor: true,
      hasTradePost: true,
    },
    docks: [
      { x: -1800, z: 0, rotation: -Math.PI / 2, destination: "mountains", label: "West to Iron Peaks" },
      { x: 0, z: 1800, rotation: Math.PI, destination: "desert", label: "South to Scorched Wastes" },
    ],
    dungeons: [
      { x: -700, z: -800, tier: 2, name: "Raptor Nest", minLevel: 18 },
      { x: 600, z: -900, tier: 4, name: "Jade Temple", minLevel: 30 },
    ],
    boss: {
      center: { x: 0, z: -1200 },
      radius: 35,
      bossType: "trex",
      bossName: "Deathjaw, the Jungle King",
      minLevel: 33,
      respawnSeconds: 2400,
    },
    camps: [
      { x: -900, z: 400, name: "Crusade Temple Camp", type: "faction" },
      { x: 800, z: -300, name: "Tribal Village", type: "bandit" },
      { x: -200, z: 900, name: "Jungle Herbalist", type: "merchant" },
    ],
    ambientColor: "#88cc66",
    fogColor: "#335522",
    fogDensity: 0.028,
  },

  // ─── Row 1 (Center) ─────────────────────────────────────────────────────
  {
    id: "forest",
    name: "The Dark Forest",
    subtitle: "Crusade Faction Territory",
    description: "Ancient woodland cloaked in eternal twilight. The Crusade faction guards the sacred groves from orc raiders and dark spirits. Wolves and bears prowl the deeper reaches.",
    gridRow: 1, gridCol: 0,
    worldOffset: gridOffset(1, 0),
    size: ISLAND_SIZE,
    levelRange: [5, 20],
    faction: "crusade",
    biome: "forest",
    terrain: { type: "heightmap", biome: "temperate", seed: 7004 },
    town: {
      center: { x: 10, z: 10 },
      name: "Greenwatch",
      npcCount: 14,
      hasCraftingHub: true,
      hasFactionVendor: true,
      hasTradePost: true,
    },
    docks: [
      { x: 0, z: -180, rotation: 0, destination: "snow", label: "North to Frozen Reach" },
      { x: 180, z: 0, rotation: Math.PI / 2, destination: "plains", label: "East to Central Hub" },
      { x: 0, z: 180, rotation: Math.PI, destination: "swamp", label: "South to Fetid Swamp" },
    ],
    dungeons: [
      { x: -90, z: -70, tier: 1, name: "Hollow Oak", minLevel: 8 },
      { x: 60, z: -100, tier: 2, name: "Spider's Nest", minLevel: 14 },
    ],
    boss: {
      center: { x: -100, z: -120 },
      radius: 25,
      bossType: "mushroom_king",
      bossName: "The Fungal Sovereign",
      minLevel: 18,
      respawnSeconds: 1200,
    },
    camps: [
      { x: -120, z: 60, name: "Crusade Camp", type: "faction" },
      { x: 100, z: -50, name: "Orc Raider Camp", type: "bandit" },
      { x: 30, z: 130, name: "Woodland Herbalist", type: "merchant" },
    ],
    ambientColor: "#aaccaa",
    fogColor: "#667755",
    fogDensity: 0.02,
  },
  {
    id: "plains",
    name: "The Rift",
    subtitle: "Central Hub — Neutral Ground",
    description: "Verdant plains at the center of the world. All factions maintain embassies here. The Grand Market, Hall of Heroes, and the inter-zone dock hub make this the beating heart of Grudge Warlords.",
    gridRow: 1, gridCol: 1,
    worldOffset: gridOffset(1, 1), // (0, 0) — world center
    size: ISLAND_SIZE,
    levelRange: [1, 10],
    faction: "neutral",
    biome: "plains",
    terrain: { type: "heightmap", biome: "temperate", seed: 7005 },
    town: {
      center: { x: 0, z: 0 },
      name: "The Rift",
      npcCount: 24,
      hasCraftingHub: true,
      hasFactionVendor: true,
      hasTradePost: true,
    },
    docks: [
      { x: 0, z: -180, rotation: 0, destination: "mountains", label: "North to Iron Peaks" },
      { x: 180, z: 0, rotation: Math.PI / 2, destination: "desert", label: "East to Scorched Wastes" },
      { x: 0, z: 180, rotation: Math.PI, destination: "coast", label: "South to Pirate Coast ★" },
      { x: -180, z: 0, rotation: -Math.PI / 2, destination: "forest", label: "West to Dark Forest" },
    ],
    dungeons: [
      { x: 80, z: -80, tier: 1, name: "Training Grounds", minLevel: 1 },
    ],
    boss: null,
    camps: [
      { x: -100, z: -80, name: "Crusade Embassy", type: "faction" },
      { x: 100, z: -80, name: "Legion Embassy", type: "faction" },
      { x: 0, z: -120, name: "Fabled Embassy", type: "faction" },
      { x: -60, z: 100, name: "Traveling Merchants", type: "merchant" },
    ],
    ambientColor: "#ffffee",
    fogColor: "#c4a882",
    fogDensity: 0.008,
  },
  {
    id: "desert",
    name: "The Scorched Wastes",
    subtitle: "Legion Frontier",
    description: "Endless sand dunes and sandstone canyons. Legion patrols guard orichalcum mines. Dinosaurs roam the deep wastes and ancient temples hide beneath the dunes.",
    gridRow: 1, gridCol: 2,
    worldOffset: gridOffset(1, 2),
    size: ISLAND_SIZE,
    levelRange: [10, 25],
    faction: "legion",
    biome: "desert",
    terrain: { type: "heightmap", biome: "temperate", seed: 7006 },
    town: {
      center: { x: -10, z: 20 },
      name: "Sandport",
      npcCount: 10,
      hasCraftingHub: true,
      hasFactionVendor: true,
      hasTradePost: false,
    },
    docks: [
      { x: 0, z: -180, rotation: 0, destination: "lava", label: "North to Ember Reaches" },
      { x: -180, z: 0, rotation: -Math.PI / 2, destination: "plains", label: "West to Central Hub" },
      { x: 0, z: 180, rotation: Math.PI, destination: "jungle", label: "South to Emerald Jungle" },
    ],
    dungeons: [
      { x: 80, z: -110, tier: 2, name: "Buried Temple", minLevel: 14 },
      { x: -70, z: -80, tier: 3, name: "Sand Wurm Tunnels", minLevel: 20 },
    ],
    boss: {
      center: { x: 100, z: -140 },
      radius: 30,
      bossType: "trex",
      bossName: "Sandstorm Rex",
      minLevel: 23,
      respawnSeconds: 1500,
    },
    camps: [
      { x: 120, z: 40, name: "Legion Mining Camp", type: "faction" },
      { x: -110, z: -50, name: "Nomad Raiders", type: "bandit" },
    ],
    ambientColor: "#ffeecc",
    fogColor: "#c4a862",
    fogDensity: 0.012,
  },

  // ─── Row 2 (South) ──────────────────────────────────────────────────────
  {
    id: "swamp",
    name: "The Fetid Swamp",
    subtitle: "Contested Wilds",
    description: "Murky wetlands choked with poisonous mist. Witches, fungal horrors, and swamp beasts lurk in the mangroves. A hidden druid circle offers rare alchemy ingredients.",
    gridRow: 2, gridCol: 0,
    worldOffset: gridOffset(2, 0),
    size: ISLAND_SIZE,
    levelRange: [10, 25],
    faction: "neutral",
    biome: "swamp",
    terrain: { type: "heightmap", biome: "temperate", seed: 7007 },
    town: {
      center: { x: 10, z: 30 },
      name: "Bogtown",
      npcCount: 8,
      hasCraftingHub: true,
      hasFactionVendor: false,
      hasTradePost: false,
    },
    docks: [
      { x: 0, z: -180, rotation: 0, destination: "forest", label: "North to Dark Forest" },
      { x: 180, z: 0, rotation: Math.PI / 2, destination: "coast", label: "East to Pirate Coast" },
    ],
    dungeons: [
      { x: -80, z: -90, tier: 2, name: "Witch's Hollow", minLevel: 14 },
      { x: 50, z: -120, tier: 3, name: "Fungal Depths", minLevel: 22 },
    ],
    boss: {
      center: { x: -60, z: -140 },
      radius: 25,
      bossType: "mushroom_king",
      bossName: "The Blight Mother",
      minLevel: 23,
      respawnSeconds: 1200,
    },
    camps: [
      { x: -100, z: 70, name: "Druid Circle", type: "merchant" },
      { x: 90, z: -30, name: "Cultist Encampment", type: "bandit" },
    ],
    ambientColor: "#ccddaa",
    fogColor: "#4a5a3a",
    fogDensity: 0.035,
  },
  {
    id: "coast",
    name: "The Pirate Coast",
    subtitle: "Starting Zone ★",
    description: "Sun-drenched shores dotted with shipwrecks and pirate camps. New players spawn here. The tutorial island GLB scene provides the terrain — palm trees, sandy beaches, a fort, mangrove swamp, and Port Havana.",
    gridRow: 2, gridCol: 1,
    worldOffset: gridOffset(2, 1),
    size: ISLAND_SIZE,
    levelRange: [1, 15],
    faction: "pirate",
    biome: "coast",
    terrain: { type: "glb", path: "/models/tutorial_island/scene.glb", scale: 1.0 },
    town: {
      center: { x: 0, z: 0 },
      name: "Port Havana",
      npcCount: 16,
      hasCraftingHub: true,
      hasFactionVendor: true,
      hasTradePost: true,
    },
    docks: [
      { x: 0, z: -140, rotation: 0, destination: "plains", label: "North to Central Hub" },
      { x: -140, z: 0, rotation: -Math.PI / 2, destination: "swamp", label: "West to Fetid Swamp" },
      { x: 140, z: 0, rotation: Math.PI / 2, destination: "jungle", label: "East to Emerald Jungle" },
    ],
    dungeons: [
      { x: 50, z: -80, tier: 1, name: "Smuggler's Cave", minLevel: 3 },
      { x: -60, z: -60, tier: 2, name: "Sunken Galleon", minLevel: 10 },
    ],
    boss: {
      center: { x: 0, z: -110 },
      radius: 25,
      bossType: "orc",
      bossName: "Captain Ironjaw",
      minLevel: 13,
      respawnSeconds: 900,
    },
    camps: [
      { x: -80, z: 50, name: "Pirate Shanty", type: "faction" },
      { x: 90, z: 40, name: "Wrecked Ship Market", type: "merchant" },
      { x: -50, z: -100, name: "Bandit Cove", type: "bandit" },
    ],
    ambientColor: "#ffddaa",
    fogColor: "#c4a882",
    fogDensity: 0.01,
  },
  {
    id: "lava",
    name: "The Ember Reaches",
    subtitle: "Legion Faction Territory — Volcanic Birth",
    description: "Volcanic wasteland of molten rivers and obsidian spires where new islands are born from the earth. The Legion faction built their war citadel in the caldera. Lava flows create new land that pushes outward, forming the youngest islands in the archipelago. Demons and fire elementals roam the ashen plains.",
    gridRow: 2, gridCol: 2,
    worldOffset: gridOffset(2, 2),
    size: ISLAND_SIZE,
    levelRange: [25, 45],
    faction: "legion",
    biome: "lava",
    terrain: { type: "heightmap", biome: "volcanic", seed: 7009 },
    town: {
      center: { x: 0, z: 200 },
      name: "Cinderhall",
      npcCount: 14,
      hasCraftingHub: true,
      hasFactionVendor: true,
      hasTradePost: true,
    },
    docks: [
      { x: 0, z: -1800, rotation: 0, destination: "desert", label: "North to Scorched Wastes" },
      { x: -1800, z: 0, rotation: -Math.PI / 2, destination: "coast", label: "West to Pirate Coast" },
    ],
    dungeons: [
      { x: -600, z: -800, tier: 3, name: "Magma Core", minLevel: 28 },
      { x: 500, z: -1000, tier: 5, name: "Inferno Sanctum", minLevel: 40 },
    ],
    boss: {
      center: { x: 0, z: -1300 },
      radius: 40,
      bossType: "demon",
      bossName: "Moloch, the Ember Lord",
      minLevel: 42,
      respawnSeconds: 3600,
    },
    camps: [
      { x: -1000, z: 400, name: "Legion Forward Base", type: "faction" },
      { x: 800, z: -500, name: "Demon Cultists", type: "bandit" },
      { x: -300, z: 1000, name: "Obsidian Trader", type: "merchant" },
    ],
    ambientColor: "#ffccaa",
    fogColor: "#cc6633",
    fogDensity: 0.025,
  },
];

// ── Lookup helpers ───────────────────────────────────────────────────────────

const _zoneMap = new Map<ZoneId, ZoneDefinition>();
for (const zone of WORLD_ZONES) _zoneMap.set(zone.id, zone);

/** Get a zone definition by ID. */
export function getZone(id: ZoneId): ZoneDefinition | undefined {
  return _zoneMap.get(id);
}

/** Get the zone at a grid position. */
export function getZoneAtGrid(row: number, col: number): ZoneDefinition | undefined {
  return WORLD_ZONES.find(z => z.gridRow === row && z.gridCol === col);
}

/** Determine which zone a world position falls in (or null if in ocean). */
export function getZoneAtWorldPos(worldX: number, worldZ: number): ZoneDefinition | null {
  for (const zone of WORLD_ZONES) {
    const halfSize = zone.size / 2;
    const dx = worldX - zone.worldOffset.x;
    const dz = worldZ - zone.worldOffset.z;
    if (Math.abs(dx) <= halfSize && Math.abs(dz) <= halfSize) {
      return zone;
    }
  }
  return null; // over ocean
}

/** Get all zones adjacent to a given zone (sharing an edge, not diagonal). */
export function getAdjacentZones(id: ZoneId): ZoneDefinition[] {
  const zone = _zoneMap.get(id);
  if (!zone) return [];
  const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const result: ZoneDefinition[] = [];
  for (const [dr, dc] of deltas) {
    const adj = getZoneAtGrid(zone.gridRow + dr, zone.gridCol + dc);
    if (adj) result.push(adj);
  }
  return result;
}

/** Get dock destinations available from a zone. */
export function getDockDestinations(zoneId: ZoneId): Array<{ dock: DockPosition; zone: ZoneDefinition }> {
  const zone = _zoneMap.get(zoneId);
  if (!zone) return [];
  return zone.docks
    .map(dock => ({ dock, zone: _zoneMap.get(dock.destination)! }))
    .filter(d => d.zone != null);
}

/** Get the starting zone (Coast / Tutorial Island). */
export function getStartingZone(): ZoneDefinition {
  return _zoneMap.get("coast")!;
}

/** Get the hub zone (Plains / The Rift). */
export function getHubZone(): ZoneDefinition {
  return _zoneMap.get("plains")!;
}

/** Total world bounds (for minimap / ocean plane). */
export const WORLD_BOUNDS = {
  minX: -GRID_SPACING - ISLAND_SIZE / 2,
  maxX: GRID_SPACING + ISLAND_SIZE / 2,
  minZ: -GRID_SPACING - ISLAND_SIZE / 2,
  maxZ: GRID_SPACING + ISLAND_SIZE / 2,
  /** Ocean plane should extend at least this far */
  oceanRadius: GRID_SPACING * 2,
};

/** Grid spacing for external use. */
export { GRID_SPACING, ISLAND_SIZE };
