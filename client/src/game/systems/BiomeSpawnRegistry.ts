/**
 * BiomeSpawnRegistry — Zone-based + distance-scaled biome system.
 *
 * The world is divided into biome zones defined by center + radius. Each
 * zone has its own enemy spawn table, wildlife roster, and environment
 * props list. Distance from the world origin also scales difficulty: the
 * farther from center, the higher the tier of enemies that can appear.
 *
 * Used by WaveSpawner and the overworld scene to place biome-appropriate
 * enemies and ambient wildlife.
 */

import type { EnemyType } from "./EnemyManager";

// ---------------------------------------------------------------------------
// Biome definitions
// ---------------------------------------------------------------------------
export type BiomeId =
  | "plains"
  | "forest"
  | "desert"
  | "swamp"
  | "snow"
  | "lava"
  | "jungle"
  | "coast"
  | "mountains";

export interface BiomeZone {
  id: BiomeId;
  label: string;
  /** World-space center of this biome zone */
  center: [number, number];
  /** Radius of the zone (soft boundary — blends with neighbors) */
  radius: number;
  /** Enemy types that can spawn in this biome */
  enemies: BiomeEnemyEntry[];
  /** Passive wildlife that roams this biome */
  wildlife: WildlifeEntry[];
  /** Environment prop paths for this biome */
  envProps: string[];
  /** Terrain material tint */
  terrainTint: string;
  /** Ambient light color bias */
  ambientTint: string;
}

export interface BiomeEnemyEntry {
  type: EnemyType;
  /** Minimum distance from world origin for this enemy to spawn */
  minDistance: number;
  /** Spawn weight (higher = more common) */
  weight: number;
  /** Only spawns at night */
  nightOnly?: boolean;
}

export interface WildlifeEntry {
  modelPath: string;
  name: string;
  targetHeight: number;
  speed: number;
  /** Spawn weight */
  weight: number;
  /** Can be harvested for resources */
  harvestable?: boolean;
  /** Flees from player */
  passive?: boolean;
}

// ---------------------------------------------------------------------------
// Wildlife roster (animated farm animals + existing fish/birds)
// ---------------------------------------------------------------------------
export const WILDLIFE_MODELS: Record<string, WildlifeEntry> = {
  cow:    { modelPath: "/models/wildlife/Cow.glb",    name: "Cow",    targetHeight: 1.5, speed: 2.0, weight: 3, harvestable: true, passive: true },
  horse:  { modelPath: "/models/wildlife/Horse.glb",  name: "Horse",  targetHeight: 1.8, speed: 6.0, weight: 2, passive: true },
  llama:  { modelPath: "/models/wildlife/Llama.glb",  name: "Llama",  targetHeight: 1.6, speed: 3.5, weight: 2, harvestable: true, passive: true },
  pig:    { modelPath: "/models/wildlife/Pig.glb",    name: "Pig",    targetHeight: 0.8, speed: 3.0, weight: 4, harvestable: true, passive: true },
  pug:    { modelPath: "/models/wildlife/Pug.glb",    name: "Pug",    targetHeight: 0.4, speed: 4.0, weight: 2, passive: true },
  sheep:  { modelPath: "/models/wildlife/Sheep.glb",  name: "Sheep",  targetHeight: 0.9, speed: 2.5, weight: 4, harvestable: true, passive: true },
  zebra:  { modelPath: "/models/wildlife/Zebra.glb",  name: "Zebra",  targetHeight: 1.6, speed: 7.0, weight: 1, passive: true },
  fish:   { modelPath: "/models/monsters/big/Fish.glb", name: "Fish", targetHeight: 0.4, speed: 3.0, weight: 3, harvestable: true, passive: true },
  bunny:  { modelPath: "/models/monsters/big/Bunny.glb", name: "Bunny", targetHeight: 0.4, speed: 6.0, weight: 5, passive: true },
  pigeon: { modelPath: "/models/monsters/blob/Pigeon.glb", name: "Pigeon", targetHeight: 0.3, speed: 4.0, weight: 3, passive: true },
  cat:    { modelPath: "/models/monsters/blob/Cat.glb", name: "Cat", targetHeight: 0.4, speed: 5.0, weight: 2, passive: true },
  dog:    { modelPath: "/models/monsters/blob/Dog.glb", name: "Dog", targetHeight: 0.5, speed: 5.0, weight: 2, passive: true },
};

// ---------------------------------------------------------------------------
// Biome zone definitions
// ---------------------------------------------------------------------------
export const BIOME_ZONES: BiomeZone[] = [
  {
    id: "plains",
    label: "Verdant Plains",
    center: [0, 0],
    radius: 40,
    terrainTint: "#8fbc5f",
    ambientTint: "#ffffee",
    enemies: [
      { type: "skeleton", minDistance: 0, weight: 5 },
      { type: "spider", minDistance: 0, weight: 4 },
      { type: "blob", minDistance: 0, weight: 6 },
      { type: "frog", minDistance: 10, weight: 3 },
      { type: "bunny", minDistance: 0, weight: 2 },
      { type: "ghost", minDistance: 20, weight: 2, nightOnly: true },
      { type: "thrower_brute", minDistance: 15, weight: 2 },
      { type: "aw_infantry", minDistance: 10, weight: 3 },
      { type: "scifi_trooper", minDistance: 15, weight: 2 },
    ],
    wildlife: [
      WILDLIFE_MODELS.cow, WILDLIFE_MODELS.sheep, WILDLIFE_MODELS.pig,
      WILDLIFE_MODELS.horse, WILDLIFE_MODELS.bunny, WILDLIFE_MODELS.pigeon,
    ],
    envProps: [
      "/models/environment/palm_tree.glb",
      "/models/environment/rock.glb",
    ],
  },
  {
    id: "forest",
    label: "Dark Forest",
    center: [-55, -55],
    radius: 35,
    terrainTint: "#3d5a2e",
    ambientTint: "#aaccaa",
    enemies: [
      { type: "spider", minDistance: 0, weight: 6 },
      { type: "orc", minDistance: 20, weight: 4 },
      { type: "tribal", minDistance: 15, weight: 4 },
      { type: "ninja", minDistance: 30, weight: 3 },
      { type: "witch", minDistance: 25, weight: 3, nightOnly: true },
      { type: "ghost", minDistance: 10, weight: 3, nightOnly: true },
      { type: "mushroom_king", minDistance: 40, weight: 1 },
      { type: "thrower_assassin", minDistance: 25, weight: 2 },
      { type: "shadow_soldier", minDistance: 20, weight: 3 },
      { type: "scifi_soldier", minDistance: 30, weight: 2 },
    ],
    wildlife: [
      WILDLIFE_MODELS.pug, WILDLIFE_MODELS.cat, WILDLIFE_MODELS.dog,
      WILDLIFE_MODELS.bunny, WILDLIFE_MODELS.pigeon,
    ],
    envProps: [
      "/models/environment/forest/scary_forest.glb",
    ],
  },
  {
    id: "desert",
    label: "Scorched Wastes",
    center: [60, -50],
    radius: 35,
    terrainTint: "#c4a862",
    ambientTint: "#ffeecc",
    enemies: [
      { type: "cactoro", minDistance: 0, weight: 5 },
      { type: "skeleton", minDistance: 0, weight: 4 },
      { type: "golem", minDistance: 25, weight: 2 },
      { type: "alien", minDistance: 40, weight: 1 },
      { type: "thrower_soldier", minDistance: 20, weight: 2 },
      // Dinosaurs roam the deep desert
      { type: "raptor", minDistance: 30, weight: 3 },
      { type: "dino", minDistance: 50, weight: 1 },
      { type: "triceratops", minDistance: 45, weight: 1 },
      // Mechs and tanks patrol the deep wastes
      { type: "aw_mech", minDistance: 35, weight: 2 },
      { type: "aw_tank", minDistance: 45, weight: 1 },
    ],
    wildlife: [
      WILDLIFE_MODELS.zebra, WILDLIFE_MODELS.llama,
    ],
    envProps: [
      "/models/environment/desert/namaqualand_boulder.glb",
      "/models/environment/desert/quiver_tree.glb",
      "/models/environment/desert/othonna_plant.glb",
    ],
  },
  {
    id: "swamp",
    label: "Fetid Swamp",
    center: [-60, 50],
    radius: 30,
    terrainTint: "#4a5a3a",
    ambientTint: "#ccddaa",
    enemies: [
      { type: "frog", minDistance: 0, weight: 6 },
      { type: "blob", minDistance: 0, weight: 5 },
      { type: "witch", minDistance: 15, weight: 4 },
      { type: "ghost", minDistance: 10, weight: 3, nightOnly: true },
      { type: "mushroom_king", minDistance: 30, weight: 2 },
      { type: "thrower_berserker", minDistance: 20, weight: 2 },
      { type: "cyborg_soldier", minDistance: 25, weight: 2 },
    ],
    wildlife: [
      WILDLIFE_MODELS.fish, WILDLIFE_MODELS.frog,
    ],
    envProps: [],
  },
  {
    id: "snow",
    label: "Frozen Peaks",
    center: [0, 70],
    radius: 30,
    terrainTint: "#ddeeff",
    ambientTint: "#ccddff",
    enemies: [
      { type: "yeti", minDistance: 0, weight: 5 },
      { type: "ghost", minDistance: 10, weight: 3 },
      { type: "blue_demon", minDistance: 25, weight: 3 },
      { type: "golem", minDistance: 20, weight: 2 },
      { type: "thrower_brute", minDistance: 30, weight: 2 },
    ],
    wildlife: [
      WILDLIFE_MODELS.llama, WILDLIFE_MODELS.sheep,
    ],
    envProps: [],
  },
  {
    id: "lava",
    label: "Volcanic Caldera",
    center: [70, 55],
    radius: 25,
    terrainTint: "#4a2a1a",
    ambientTint: "#ffccaa",
    enemies: [
      { type: "demon", minDistance: 0, weight: 5 },
      { type: "blue_demon", minDistance: 15, weight: 3 },
      { type: "dragon", minDistance: 40, weight: 1 },
      { type: "golem", minDistance: 10, weight: 3 },
      { type: "thrower_berserker", minDistance: 20, weight: 3 },
      { type: "cyborg_unit", minDistance: 25, weight: 2 },
      { type: "mech_tripod", minDistance: 45, weight: 1 },
    ],
    wildlife: [],
    envProps: [
      "/models/environment/lava/lava_surface.glb",
    ],
  },
  {
    id: "jungle",
    label: "Tangled Jungle",
    center: [55, 0],
    radius: 30,
    terrainTint: "#2d6a1e",
    ambientTint: "#bbffbb",
    enemies: [
      { type: "tribal", minDistance: 0, weight: 5 },
      { type: "spider", minDistance: 0, weight: 4 },
      { type: "raptor", minDistance: 15, weight: 4 },
      { type: "dino", minDistance: 35, weight: 2 },
      { type: "trex", minDistance: 55, weight: 1 },
      { type: "pirate", minDistance: 20, weight: 3 },
      { type: "thrower_assassin", minDistance: 25, weight: 2 },
      { type: "scifi_officer", minDistance: 30, weight: 2 },
      { type: "aw_infantry", minDistance: 20, weight: 3 },
    ],
    wildlife: [
      WILDLIFE_MODELS.zebra, WILDLIFE_MODELS.pigeon,
      WILDLIFE_MODELS.bunny, WILDLIFE_MODELS.dog,
    ],
    envProps: [],
  },
  {
    id: "coast",
    label: "Pirate Coast",
    center: [-50, 0],
    radius: 25,
    terrainTint: "#c4b890",
    ambientTint: "#eeffff",
    enemies: [
      { type: "pirate", minDistance: 0, weight: 6 },
      { type: "skeleton", minDistance: 0, weight: 4 },
      { type: "ninja", minDistance: 20, weight: 3 },
      { type: "ghost", minDistance: 15, weight: 2, nightOnly: true },
      { type: "thrower_soldier", minDistance: 15, weight: 3 },
    ],
    wildlife: [
      WILDLIFE_MODELS.fish, WILDLIFE_MODELS.pigeon,
    ],
    envProps: [
      "/models/environment/docks/wooden_docks.glb",
    ],
  },
  {
    id: "mountains",
    label: "Iron Mountains",
    center: [0, -70],
    radius: 25,
    terrainTint: "#8a8a7a",
    ambientTint: "#dddddd",
    enemies: [
      { type: "golem", minDistance: 0, weight: 5 },
      { type: "orc", minDistance: 10, weight: 4 },
      { type: "demon", minDistance: 35, weight: 2 },
      { type: "triceratops", minDistance: 40, weight: 1 },
      { type: "trex", minDistance: 60, weight: 1 },
      { type: "thrower_berserker", minDistance: 30, weight: 2 },
      { type: "aw_tank", minDistance: 40, weight: 2 },
      { type: "mech_tripod", minDistance: 55, weight: 1 },
    ],
    wildlife: [
      WILDLIFE_MODELS.llama, WILDLIFE_MODELS.sheep,
    ],
    envProps: [],
  },
];

// ---------------------------------------------------------------------------
// Runtime API
// ---------------------------------------------------------------------------

const DIFFICULTY_TIERS = [
  { maxDist: 30, tierMult: 1.0 },
  { maxDist: 50, tierMult: 1.5 },
  { maxDist: 70, tierMult: 2.0 },
  { maxDist: 90, tierMult: 2.8 },
  { maxDist: Infinity, tierMult: 3.5 },
];

/** Get the difficulty multiplier for a world position based on distance from origin. */
export function getDifficultyAtPosition(worldX: number, worldZ: number): number {
  const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
  for (const tier of DIFFICULTY_TIERS) {
    if (dist <= tier.maxDist) return tier.tierMult;
  }
  return DIFFICULTY_TIERS[DIFFICULTY_TIERS.length - 1].tierMult;
}

/** Determine which biome a world position falls in (nearest center within radius). */
export function getBiomeAtPosition(worldX: number, worldZ: number): BiomeZone {
  let best: BiomeZone = BIOME_ZONES[0]; // plains fallback
  let bestScore = Infinity;

  for (const zone of BIOME_ZONES) {
    const dx = worldX - zone.center[0];
    const dz = worldZ - zone.center[1];
    const dist = Math.sqrt(dx * dx + dz * dz);
    // Score: distance normalized by radius. < 1.0 = inside the zone.
    const score = dist / zone.radius;
    if (score < bestScore) {
      bestScore = score;
      best = zone;
    }
  }
  return best;
}

/** Pick a random enemy type valid for this position + time-of-day. */
export function rollBiomeEnemy(
  worldX: number,
  worldZ: number,
  isDaytime: boolean,
): EnemyType | null {
  const biome = getBiomeAtPosition(worldX, worldZ);
  const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);

  const candidates = biome.enemies.filter((e) => {
    if (dist < e.minDistance) return false;
    if (e.nightOnly && isDaytime) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const c of candidates) {
    roll -= c.weight;
    if (roll <= 0) return c.type;
  }
  return candidates[candidates.length - 1].type;
}

/** Pick random wildlife entries for a position (for ambient spawning). */
export function rollBiomeWildlife(
  worldX: number,
  worldZ: number,
  count: number = 1,
): WildlifeEntry[] {
  const biome = getBiomeAtPosition(worldX, worldZ);
  if (biome.wildlife.length === 0) return [];

  const results: WildlifeEntry[] = [];
  const totalWeight = biome.wildlife.reduce((sum, w) => sum + w.weight, 0);

  for (let i = 0; i < count; i++) {
    let roll = Math.random() * totalWeight;
    for (const w of biome.wildlife) {
      roll -= w.weight;
      if (roll <= 0) {
        results.push(w);
        break;
      }
    }
  }
  return results;
}

/** Get all biome zones for map/minimap rendering. */
export function getAllBiomeZones(): readonly BiomeZone[] {
  return BIOME_ZONES;
}
