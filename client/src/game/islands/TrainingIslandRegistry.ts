import type { EnemyType } from "../systems/EnemyManager";

export type AIBehaviorProfile =
  | "patrol"
  | "aggressive"
  | "defensive"
  | "ambush"
  | "berserker"
  | "coordinated";

export type EmoteType = "taunt" | "rally" | "fear" | "celebrate" | "warn" | "laugh";

export interface IslandEnemyWave {
  enemies: { type: EnemyType; count: number }[];
  spawnDelay: number;
  behaviorOverride?: AIBehaviorProfile;
}

export interface TrainingIsland {
  id: string;
  name: string;
  subtitle: string;
  sceneNodeName: string;
  difficulty: number;
  order: number;
  description: string;
  unlockRequirement: string | null;

  defaultBehavior: AIBehaviorProfile;
  enemyEmotes: EmoteType[];

  waves: IslandEnemyWave[];
  bossType: EnemyType | null;
  bossName: string;

  sceneOffset: [number, number, number];
  playerSpawn: [number, number, number];
  enemySpawnRadius: number;
  boundsRadius: number;

  rewards: {
    xp: number;
    gold: number;
    unlocks: string[];
  };

  ambientColor: string;
  fogColor: string;
  fogDensity: number;
}

export const TRAINING_ISLANDS: TrainingIsland[] = [
  {
    id: "ti_shanty",
    name: "Shanty Cove",
    subtitle: "The Beginner's Landing",
    sceneNodeName: "Shanty",
    difficulty: 1,
    order: 1,
    description: "A ramshackle pirate outpost. Weak scavengers patrol the docks. A good place to learn the basics.",
    unlockRequirement: null,
    defaultBehavior: "patrol",
    enemyEmotes: ["taunt", "fear"],
    waves: [
      { enemies: [{ type: "skeleton", count: 3 }, { type: "blob", count: 2 }], spawnDelay: 2.0 },
      { enemies: [{ type: "skeleton", count: 4 }, { type: "spider", count: 3 }], spawnDelay: 1.8 },
      { enemies: [{ type: "pirate", count: 3 }, { type: "skeleton", count: 2 }], spawnDelay: 1.5 },
    ],
    bossType: "orc",
    bossName: "Shanty Warlord",
    sceneOffset: [0, 0, 0],
    playerSpawn: [0, 0.5, -8],
    enemySpawnRadius: 20,
    boundsRadius: 28,
    rewards: { xp: 200, gold: 100, unlocks: ["ti_shipwreck"] },
    ambientColor: "#ffddaa",
    fogColor: "#c4a882",
    fogDensity: 0.015,
  },
  {
    id: "ti_shipwreck",
    name: "Shipwreck Bay",
    subtitle: "Graveyard of the Forgotten",
    sceneNodeName: "Shipwreck",
    difficulty: 2,
    order: 2,
    description: "Wrecked ships litter this cursed bay. Ghosts and undead sailors lurk among the wreckage. They ambush from the shadows.",
    unlockRequirement: "ti_shanty",
    defaultBehavior: "ambush",
    enemyEmotes: ["fear", "warn", "laugh"],
    waves: [
      { enemies: [{ type: "skeleton", count: 4 }, { type: "ghost", count: 2 }], spawnDelay: 1.8 },
      { enemies: [{ type: "ghost", count: 4 }, { type: "pirate", count: 3 }], spawnDelay: 1.5, behaviorOverride: "ambush" },
      { enemies: [{ type: "pirate", count: 4 }, { type: "ninja", count: 2 }, { type: "ghost", count: 2 }], spawnDelay: 1.2 },
    ],
    bossType: "blue_demon",
    bossName: "The Drowned Captain",
    sceneOffset: [0, 0, 0],
    playerSpawn: [0, 0.5, -8],
    enemySpawnRadius: 22,
    boundsRadius: 28,
    rewards: { xp: 400, gold: 200, unlocks: ["ti_mangrove"] },
    ambientColor: "#aabbcc",
    fogColor: "#889aab",
    fogDensity: 0.025,
  },
  {
    id: "ti_mangrove",
    name: "Mangrove Swamp",
    subtitle: "The Overgrown Wilds",
    sceneNodeName: "Mangrove",
    difficulty: 3,
    order: 3,
    description: "Dense mangrove roots hide aggressive beasts. Raptors hunt in packs, coordinating their attacks through the undergrowth.",
    unlockRequirement: "ti_shipwreck",
    defaultBehavior: "coordinated",
    enemyEmotes: ["rally", "warn", "taunt"],
    waves: [
      { enemies: [{ type: "frog", count: 4 }, { type: "spider", count: 3 }], spawnDelay: 1.5, behaviorOverride: "aggressive" },
      { enemies: [{ type: "raptor", count: 3 }, { type: "tribal", count: 3 }], spawnDelay: 1.2, behaviorOverride: "coordinated" },
      { enemies: [{ type: "raptor", count: 4 }, { type: "orc", count: 2 }, { type: "cactoro", count: 2 }], spawnDelay: 1.0 },
      { enemies: [{ type: "raptor", count: 3 }, { type: "triceratops", count: 1 }], spawnDelay: 1.0, behaviorOverride: "coordinated" },
    ],
    bossType: "trex",
    bossName: "Swamp Tyrant",
    sceneOffset: [0, 0, 0],
    playerSpawn: [0, 0.5, -8],
    enemySpawnRadius: 22,
    boundsRadius: 28,
    rewards: { xp: 600, gold: 300, unlocks: ["ti_havana"] },
    ambientColor: "#88aa66",
    fogColor: "#667755",
    fogDensity: 0.03,
  },
  {
    id: "ti_havana",
    name: "Port Havana",
    subtitle: "The Pirate Stronghold",
    sceneNodeName: "Havana",
    difficulty: 4,
    order: 4,
    description: "A fortified pirate port bristling with defenders. Enemies hold strategic positions and refuse to give ground. Expect heavy resistance.",
    unlockRequirement: "ti_mangrove",
    defaultBehavior: "defensive",
    enemyEmotes: ["taunt", "rally", "celebrate"],
    waves: [
      { enemies: [{ type: "pirate", count: 5 }, { type: "ninja", count: 3 }], spawnDelay: 1.5 },
      { enemies: [{ type: "orc", count: 4 }, { type: "pirate", count: 3 }, { type: "witch", count: 2 }], spawnDelay: 1.2, behaviorOverride: "defensive" },
      { enemies: [{ type: "demon", count: 2 }, { type: "blue_demon", count: 2 }, { type: "orc", count: 3 }], spawnDelay: 1.0 },
      { enemies: [{ type: "alien", count: 2 }, { type: "ninja", count: 3 }, { type: "demon", count: 2 }], spawnDelay: 0.8 },
    ],
    bossType: "dragon",
    bossName: "Admiral Blackflame",
    sceneOffset: [0, 0, 0],
    playerSpawn: [0, 0.5, -8],
    enemySpawnRadius: 25,
    boundsRadius: 30,
    rewards: { xp: 1000, gold: 500, unlocks: ["ti_mansion"] },
    ambientColor: "#ffccaa",
    fogColor: "#ddb899",
    fogDensity: 0.01,
  },
  {
    id: "ti_mansion",
    name: "Governor's Mansion",
    subtitle: "The Seat of Power",
    sceneNodeName: "Mansion",
    difficulty: 5,
    order: 5,
    description: "The pirate governor's lavish estate. Elite guards fight with berserker fury, charging recklessly with no regard for their own lives.",
    unlockRequirement: "ti_havana",
    defaultBehavior: "berserker",
    enemyEmotes: ["taunt", "rally", "laugh", "celebrate"],
    waves: [
      { enemies: [{ type: "ninja", count: 4 }, { type: "pirate", count: 4 }], spawnDelay: 1.2, behaviorOverride: "aggressive" },
      { enemies: [{ type: "demon", count: 3 }, { type: "yeti", count: 2 }, { type: "orc", count: 3 }], spawnDelay: 1.0, behaviorOverride: "berserker" },
      { enemies: [{ type: "alien", count: 3 }, { type: "mushroom_king", count: 2 }, { type: "demon", count: 2 }], spawnDelay: 0.8 },
      { enemies: [{ type: "triceratops", count: 2 }, { type: "raptor", count: 4 }], spawnDelay: 0.8, behaviorOverride: "coordinated" },
      { enemies: [{ type: "demon", count: 3 }, { type: "alien", count: 3 }, { type: "yeti", count: 2 }], spawnDelay: 0.6 },
    ],
    bossType: "trex",
    bossName: "Governor Ironjaw",
    sceneOffset: [0, 0, 0],
    playerSpawn: [0, 0.5, -8],
    enemySpawnRadius: 25,
    boundsRadius: 30,
    rewards: { xp: 1500, gold: 800, unlocks: ["ti_fort"] },
    ambientColor: "#eeddcc",
    fogColor: "#ccbbaa",
    fogDensity: 0.012,
  },
  {
    id: "ti_fort",
    name: "Fortress of Tides",
    subtitle: "The Final Siege",
    sceneNodeName: "Fort",
    difficulty: 6,
    order: 6,
    description: "The ultimate pirate stronghold. Enemies coordinate in lethal formations. Only the strongest warriors will take this fortress.",
    unlockRequirement: "ti_mansion",
    defaultBehavior: "coordinated",
    enemyEmotes: ["taunt", "rally", "warn", "celebrate", "laugh"],
    waves: [
      { enemies: [{ type: "orc", count: 5 }, { type: "ninja", count: 4 }, { type: "pirate", count: 3 }], spawnDelay: 1.0 },
      { enemies: [{ type: "demon", count: 3 }, { type: "yeti", count: 3 }, { type: "alien", count: 3 }], spawnDelay: 0.8, behaviorOverride: "coordinated" },
      { enemies: [{ type: "mushroom_king", count: 2 }, { type: "raptor", count: 4 }, { type: "triceratops", count: 2 }], spawnDelay: 0.8, behaviorOverride: "aggressive" },
      { enemies: [{ type: "demon", count: 4 }, { type: "alien", count: 3 }, { type: "dragon", count: 1 }], spawnDelay: 0.6, behaviorOverride: "berserker" },
      { enemies: [{ type: "trex", count: 1 }, { type: "raptor", count: 5 }, { type: "demon", count: 3 }], spawnDelay: 0.5 },
    ],
    bossType: "dragon",
    bossName: "Kraken's Herald",
    sceneOffset: [0, 0, 0],
    playerSpawn: [0, 0.5, -8],
    enemySpawnRadius: 25,
    boundsRadius: 30,
    rewards: { xp: 3000, gold: 1500, unlocks: ["pirate_king_title"] },
    ambientColor: "#ffaa88",
    fogColor: "#cc8866",
    fogDensity: 0.02,
  },
];

export function getTrainingIsland(id: string): TrainingIsland | undefined {
  return TRAINING_ISLANDS.find(i => i.id === id);
}

export function getTrainingIslandByOrder(order: number): TrainingIsland | undefined {
  return TRAINING_ISLANDS.find(i => i.order === order);
}

export function getAvailableTrainingIslands(clearedIds: Set<string>): TrainingIsland[] {
  return TRAINING_ISLANDS.filter(island => {
    if (!island.unlockRequirement) return true;
    return clearedIds.has(island.unlockRequirement);
  });
}

export function getTotalEnemiesForIsland(island: TrainingIsland): number {
  let total = 0;
  for (const wave of island.waves) {
    for (const entry of wave.enemies) {
      total += entry.count;
    }
  }
  if (island.bossType) total += 1;
  return total;
}
