/**
 * DistrictRegistry — named districts that divide the 200×200 home island
 * into logical neighbourhoods.
 *
 * Districts control:
 *   - Which faction governs the area (affects ambient NPC alignment)
 *   - Whether enemies can spawn inside the perimeter
 *   - The dominant resource types found nearby
 *   - Which ambient NPC archetypes populate it
 *   - The world-map icon and label
 *
 * Coordinate system: world XZ centred on (0,0). Radius is an approximate
 * soft boundary — buildings may extend slightly past it.
 *
 * Home island layout (bird's eye):
 *
 *         [wilderness_north] ~ (-5, -65)
 *          [fortress_nw]            [outpost_east]
 *     (-65,-62)                           (72,-32)
 *
 *      [town_medieval] (5,-28)
 *           [spawn_beach] (0,-5)
 *     [harbor_west]  (0,0)  [harbor_east]
 *       (-85, 0)                (85, 0)
 *        [market_plaza] (-5, 42)
 *             [harbor_south] (0, 85)
 */

export type DistrictId =
  | "spawn_beach"
  | "town_medieval"
  | "harbor_south"
  | "harbor_west"
  | "harbor_east"
  | "market_plaza"
  | "fortress_nw"
  | "outpost_east"
  | "wilderness_north"
  | "wilderness_general";

export type AmbientNPCArchetype =
  | "TownGuard"
  | "MarketVendor"
  | "DockWorker"
  | "Innkeeper"
  | "TownCrier"
  | "PatrolGuard";

export interface DistrictDef {
  id: DistrictId;
  name: string;
  /** Short descriptor for map tooltip. */
  subtitle: string;
  /** World-space [x, z] centre of this district. */
  center: [number, number];
  /** Approximate soft radius (world units). */
  radius: number;
  /** Faction that controls this district. null = neutral. */
  faction: "crusade" | "legion" | "fabled" | "pirate" | "neutral" | null;
  /** If false, WaveSpawner will not place enemies within this district. */
  enemySpawnAllowed: boolean;
  /** Ambient NPCs that should appear here. */
  ambientNPCTypes: AmbientNPCArchetype[];
  /** Dominant resource types found here (informational — used by resource spawner). */
  dominantResources: string[];
  /** World map emoji icon. */
  mapIcon: string;
  /** Map pin colour (hex). */
  mapColor: string;
}

export const ALL_DISTRICTS: DistrictDef[] = [
  {
    id: "spawn_beach",
    name: "Spawn Beach",
    subtitle: "Where the journey begins",
    center: [0, -5],
    radius: 14,
    faction: "neutral",
    enemySpawnAllowed: false,
    ambientNPCTypes: ["TownGuard", "TownCrier"],
    dominantResources: ["wood", "fiber", "berry"],
    mapIcon: "🏖️",
    mapColor: "#c9a044",
  },
  {
    id: "town_medieval",
    name: "Crossroads Town",
    subtitle: "The central settlement",
    center: [5, -28],
    radius: 32,
    faction: "neutral",
    enemySpawnAllowed: false,
    ambientNPCTypes: ["TownGuard", "MarketVendor", "Innkeeper", "TownCrier"],
    dominantResources: ["wood", "stone", "iron_ore"],
    mapIcon: "🏘️",
    mapColor: "#c9a044",
  },
  {
    id: "market_plaza",
    name: "Market Plaza",
    subtitle: "Trade hub of the island",
    center: [-5, 42],
    radius: 22,
    faction: "neutral",
    enemySpawnAllowed: false,
    ambientNPCTypes: ["MarketVendor", "TownGuard"],
    dominantResources: ["fiber", "herb", "berry", "gold_ore"],
    mapIcon: "🛒",
    mapColor: "#ffcc44",
  },
  {
    id: "harbor_south",
    name: "South Harbor",
    subtitle: "Gateway to the open sea",
    center: [0, 85],
    radius: 18,
    faction: "pirate",
    enemySpawnAllowed: false,
    ambientNPCTypes: ["DockWorker", "PatrolGuard"],
    dominantResources: ["fiber", "raw_meat", "wood"],
    mapIcon: "⚓",
    mapColor: "#4499cc",
  },
  {
    id: "harbor_west",
    name: "West Dock",
    subtitle: "Crusade fleet anchorage",
    center: [-85, 0],
    radius: 16,
    faction: "crusade",
    enemySpawnAllowed: false,
    ambientNPCTypes: ["DockWorker", "TownGuard"],
    dominantResources: ["raw_meat", "wood"],
    mapIcon: "⚓",
    mapColor: "#c9a044",
  },
  {
    id: "harbor_east",
    name: "East Dock",
    subtitle: "Legion transport landing",
    center: [85, 0],
    radius: 16,
    faction: "legion",
    enemySpawnAllowed: false,
    ambientNPCTypes: ["DockWorker", "PatrolGuard"],
    dominantResources: ["raw_meat", "iron_ore"],
    mapIcon: "⚓",
    mapColor: "#cc4444",
  },
  {
    id: "fortress_nw",
    name: "Ironhold Fortress",
    subtitle: "The northwest stronghold",
    center: [-65, -62],
    radius: 26,
    faction: "crusade",
    enemySpawnAllowed: true,
    ambientNPCTypes: ["TownGuard", "PatrolGuard"],
    dominantResources: ["iron_ore", "stone", "gold_ore"],
    mapIcon: "🏰",
    mapColor: "#aa8833",
  },
  {
    id: "outpost_east",
    name: "Eastern Outpost",
    subtitle: "Frontier garrison",
    center: [72, -32],
    radius: 22,
    faction: "crusade",
    enemySpawnAllowed: true,
    ambientNPCTypes: ["TownGuard", "PatrolGuard"],
    dominantResources: ["iron_ore", "stone"],
    mapIcon: "🗼",
    mapColor: "#aa8833",
  },
  {
    id: "wilderness_north",
    name: "Northern Wilds",
    subtitle: "Untamed highland",
    center: [-5, -70],
    radius: 30,
    faction: null,
    enemySpawnAllowed: true,
    ambientNPCTypes: [],
    dominantResources: ["wood", "stone", "herb", "raw_meat"],
    mapIcon: "🌲",
    mapColor: "#336633",
  },
  {
    id: "wilderness_general",
    name: "Open World",
    subtitle: "Beyond the settlements",
    center: [0, 0],
    radius: 200,
    faction: null,
    enemySpawnAllowed: true,
    ambientNPCTypes: [],
    dominantResources: ["wood", "stone", "fiber", "raw_meat", "berry", "herb"],
    mapIcon: "🗺️",
    mapColor: "#448844",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getDistrict(id: DistrictId): DistrictDef | undefined {
  return ALL_DISTRICTS.find((d) => d.id === id);
}

/** Returns the most specific district containing [worldX, worldZ]. */
export function getDistrictAtPosition(worldX: number, worldZ: number): DistrictDef {
  let best: DistrictDef = ALL_DISTRICTS[ALL_DISTRICTS.length - 1]; // wilderness_general fallback
  let bestRadius = Infinity;

  for (const d of ALL_DISTRICTS) {
    if (d.id === "wilderness_general") continue;
    const dx = worldX - d.center[0];
    const dz = worldZ - d.center[1];
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < d.radius && d.radius < bestRadius) {
      best = d;
      bestRadius = d.radius;
    }
  }
  return best;
}

/** True if enemy spawning is allowed at this world position. */
export function isEnemySpawnAllowed(worldX: number, worldZ: number): boolean {
  return getDistrictAtPosition(worldX, worldZ).enemySpawnAllowed;
}

/** All non-wilderness districts (for map rendering). */
export function getNamedDistricts(): DistrictDef[] {
  return ALL_DISTRICTS.filter((d) => d.id !== "wilderness_general");
}
