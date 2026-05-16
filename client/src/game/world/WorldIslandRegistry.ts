/**
 * WorldIslandRegistry — canonical dataset for all 17 world islands.
 *
 * Structure
 *   1  central hub  (The Rift — Unity import pending)
 *   4  tropical     (The Jade Seas     — upper-left)
 *   4  ice          (The Frozen Reach  — upper-right)
 *   4  lava         (The Ember Reaches — lower-right)
 *   4  boss         (The Shattered Deep — lower-left, sinkable)
 *
 * Each entry reuses the same wave/boss/reward shape as TrainingIslandRegistry
 * so existing combat machinery can drive any of these islands without changes.
 * The extra fields (`zoneId`, `layoutId`, `sceneAssetPath`, `isSinkable`,
 * `isCentralHub`) are what makes this the *world* registry rather than just
 * the training one.
 */

import type { EnemyType } from "../systems/EnemyManager";
import type {
  AIBehaviorProfile,
  IslandEnemyWave,
  EmoteType,
} from "../islands/TrainingIslandRegistry";
import type { ZoneId } from "./WorldZoneRegistry";

// ─────────────────────────────────────────────────────────────────────────────

export interface WorldIsland {
  // ── Identity ────────────────────────────────────────────────────────
  id: string;
  /** Must match the corresponding IslandLayoutEntry.id. */
  layoutId: string;
  zoneId: ZoneId;
  name: string;
  subtitle: string;
  description: string;

  // ── Progression ─────────────────────────────────────────────────────
  /** 1 = tutorial-easy, 10 = endgame-hard. */
  difficulty: number;
  /** Ordering within the zone (1 = entry island). */
  order: number;
  /** Island id that must be cleared first, or null. */
  unlockRequirement: string | null;

  // ── Combat ──────────────────────────────────────────────────────────
  defaultBehavior: AIBehaviorProfile;
  enemyEmotes: EmoteType[];
  waves: IslandEnemyWave[];
  bossType: EnemyType | null;
  bossName: string;

  // ── Scene ───────────────────────────────────────────────────────────
  /**
   * Path to the 3D scene asset for this specific island. null means the
   * zone's `primaryAssetPath` (or placeholder) is used instead.
   */
  sceneAssetPath: string | null;
  playerSpawn: [number, number, number];
  enemySpawnRadius: number;
  boundsRadius: number;

  // ── Rewards ─────────────────────────────────────────────────────────
  rewards: { xp: number; gold: number; unlocks: string[] };

  // ── Rendering ───────────────────────────────────────────────────────
  ambientColor: string;
  fogColor: string;
  fogDensity: number;

  // ── Special flags ────────────────────────────────────────────────────
  /** True for the single large hub island (The Rift). */
  isCentralHub: boolean;
  /** True for boss-zone islands that can permanently sink. */
  isSinkable: boolean;
  /** Starting HP for sinkable islands. Only meaningful when isSinkable. */
  sinkableMaxHealth: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper used by several entries below
// ─────────────────────────────────────────────────────────────────────────────

function spawn(): [number, number, number] {
  return [0, 0.5, -8];
}

// ─────────────────────────────────────────────────────────────────────────────
// All 17 islands
// ─────────────────────────────────────────────────────────────────────────────

export const WORLD_ISLANDS: WorldIsland[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // CENTRAL — The Rift
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "wi_hub_main",
    layoutId: "hub_main",
    zoneId: "central",
    name: "The Rift",
    subtitle: "First Landing",
    description:
      "The ancient neutral island where all faction ships first made landfall. " +
      "Traders, mercenaries, and faction emissaries gather here. " +
      "A massive Unity-era fortress ruin dominates the skyline.",
    difficulty: 1,
    order: 1,
    unlockRequirement: null,
    defaultBehavior: "patrol",
    enemyEmotes: ["taunt", "fear"],
    waves: [
      { enemies: [{ type: "skeleton", count: 2 }, { type: "blob", count: 2 }], spawnDelay: 2.0 },
    ],
    bossType: null,
    bossName: "",
    sceneAssetPath: null, // Pending: export from Unity project
    playerSpawn: spawn(),
    enemySpawnRadius: 18,
    boundsRadius: 50,
    rewards: { xp: 100, gold: 50, unlocks: ["wi_tropical_d"] },
    ambientColor: "#fff8ee",
    fogColor: "#c4b090",
    fogDensity: 0.008,
    isCentralHub: true,
    isSinkable: false,
    sinkableMaxHealth: 0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TROPICAL — The Jade Seas (upper-left)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "wi_tropical_d",
    layoutId: "tropical_d",
    zoneId: "tropical",
    name: "Shanty Shoal",
    subtitle: "Gateway to the Jade Seas",
    description:
      "A rickety pirate outpost at the edge of the Jade Seas. Weak scavengers patrol the docks. A good place to find your sea legs.",
    difficulty: 2,
    order: 1,
    unlockRequirement: "wi_hub_main",
    defaultBehavior: "patrol",
    enemyEmotes: ["taunt", "fear"],
    waves: [
      { enemies: [{ type: "skeleton", count: 3 }, { type: "blob", count: 2 }], spawnDelay: 2.0 },
      { enemies: [{ type: "pirate", count: 2 }, { type: "skeleton", count: 3 }], spawnDelay: 1.8 },
    ],
    bossType: "orc",
    bossName: "Shanty Warlord",
    sceneAssetPath: "/models/pirate_islands/scene.gltf",
    playerSpawn: spawn(),
    enemySpawnRadius: 20,
    boundsRadius: 28,
    rewards: { xp: 300, gold: 150, unlocks: ["wi_tropical_c"] },
    ambientColor: "#ffddaa",
    fogColor: "#c4a882",
    fogDensity: 0.015,
    isCentralHub: false,
    isSinkable: false,
    sinkableMaxHealth: 0,
  },

  {
    id: "wi_tropical_c",
    layoutId: "tropical_c",
    zoneId: "tropical",
    name: "Mangrove Lagoon",
    subtitle: "The Overgrown Wilds",
    description:
      "Dense mangrove roots hide aggressive beasts. Raptors hunt in packs, coordinating their attacks through the undergrowth.",
    difficulty: 3,
    order: 2,
    unlockRequirement: "wi_tropical_d",
    defaultBehavior: "coordinated",
    enemyEmotes: ["rally", "warn", "taunt"],
    waves: [
      { enemies: [{ type: "frog", count: 4 }, { type: "spider", count: 3 }], spawnDelay: 1.5, behaviorOverride: "aggressive" },
      { enemies: [{ type: "raptor", count: 3 }, { type: "tribal", count: 3 }], spawnDelay: 1.2, behaviorOverride: "coordinated" },
      { enemies: [{ type: "raptor", count: 4 }, { type: "orc", count: 2 }], spawnDelay: 1.0 },
    ],
    bossType: "trex",
    bossName: "Swamp Tyrant",
    sceneAssetPath: "/models/pirate_islands/scene.gltf",
    playerSpawn: spawn(),
    enemySpawnRadius: 22,
    boundsRadius: 28,
    rewards: { xp: 600, gold: 300, unlocks: ["wi_tropical_b"] },
    ambientColor: "#88aa66",
    fogColor: "#667755",
    fogDensity: 0.03,
    isCentralHub: false,
    isSinkable: false,
    sinkableMaxHealth: 0,
  },

  {
    id: "wi_tropical_b",
    layoutId: "tropical_b",
    zoneId: "tropical",
    name: "Coconut Harbor",
    subtitle: "Stronghold of the Jade Corsairs",
    description:
      "A fortified pirate port bristling with defenders who hold their strategic positions to the last. Expect heavy resistance and cannon fire.",
    difficulty: 4,
    order: 3,
    unlockRequirement: "wi_tropical_c",
    defaultBehavior: "defensive",
    enemyEmotes: ["taunt", "rally", "celebrate"],
    waves: [
      { enemies: [{ type: "pirate", count: 5 }, { type: "ninja", count: 3 }], spawnDelay: 1.5 },
      { enemies: [{ type: "orc", count: 4 }, { type: "pirate", count: 3 }, { type: "witch", count: 2 }], spawnDelay: 1.2, behaviorOverride: "defensive" },
      { enemies: [{ type: "demon", count: 2 }, { type: "blue_demon", count: 2 }, { type: "orc", count: 3 }], spawnDelay: 1.0 },
    ],
    bossType: "dragon",
    bossName: "Admiral Blackflame",
    sceneAssetPath: "/models/pirate_islands/scene.gltf",
    playerSpawn: spawn(),
    enemySpawnRadius: 25,
    boundsRadius: 30,
    rewards: { xp: 1200, gold: 600, unlocks: ["wi_tropical_a"] },
    ambientColor: "#ffccaa",
    fogColor: "#ddb899",
    fogDensity: 0.01,
    isCentralHub: false,
    isSinkable: false,
    sinkableMaxHealth: 0,
  },

  {
    id: "wi_tropical_a",
    layoutId: "tropical_a",
    zoneId: "tropical",
    name: "Rum Runner's Cay",
    subtitle: "Last Outpost of the Jade Seas",
    description:
      "The remotest pirate stronghold. Elite corsairs coordinate in lethal formations — only the most hardened warriors can crack this fortress.",
    difficulty: 5,
    order: 4,
    unlockRequirement: "wi_tropical_b",
    defaultBehavior: "coordinated",
    enemyEmotes: ["taunt", "rally", "warn", "laugh"],
    waves: [
      { enemies: [{ type: "ninja", count: 4 }, { type: "pirate", count: 4 }], spawnDelay: 1.2, behaviorOverride: "aggressive" },
      { enemies: [{ type: "demon", count: 3 }, { type: "yeti", count: 2 }, { type: "orc", count: 3 }], spawnDelay: 1.0, behaviorOverride: "berserker" },
      { enemies: [{ type: "alien", count: 3 }, { type: "mushroom_king", count: 2 }, { type: "demon", count: 2 }], spawnDelay: 0.8 },
      { enemies: [{ type: "triceratops", count: 2 }, { type: "raptor", count: 4 }], spawnDelay: 0.8, behaviorOverride: "coordinated" },
    ],
    bossType: "trex",
    bossName: "Dread Corsair Ironjaw",
    sceneAssetPath: "/models/pirate_islands/scene.gltf",
    playerSpawn: spawn(),
    enemySpawnRadius: 25,
    boundsRadius: 30,
    rewards: { xp: 2000, gold: 1000, unlocks: ["wi_ice_d"] },
    ambientColor: "#eeddcc",
    fogColor: "#ccbbaa",
    fogDensity: 0.012,
    isCentralHub: false,
    isSinkable: false,
    sinkableMaxHealth: 0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ICE — The Frozen Reach (upper-right)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "wi_ice_d",
    layoutId: "ice_d",
    zoneId: "ice",
    name: "Icebound Shallows",
    subtitle: "Gateway to the Frozen Reach",
    description:
      "The outermost frozen island where the cold first bites. Yeti scouts and ice elementals guard the approach to deeper glacial territory.",
    difficulty: 6,
    order: 1,
    unlockRequirement: "wi_tropical_a",
    defaultBehavior: "patrol",
    enemyEmotes: ["warn", "taunt"],
    waves: [
      { enemies: [{ type: "yeti", count: 2 }, { type: "ghost", count: 3 }], spawnDelay: 2.0 },
      { enemies: [{ type: "yeti", count: 3 }, { type: "golem", count: 1 }], spawnDelay: 1.8 },
    ],
    bossType: "golem",
    bossName: "Glacier Sentinel",
    sceneAssetPath: null, // Ice biome placeholder until GLB imported
    playerSpawn: spawn(),
    enemySpawnRadius: 20,
    boundsRadius: 26,
    rewards: { xp: 800, gold: 400, unlocks: ["wi_ice_c"] },
    ambientColor: "#cce6ff",
    fogColor: "#aaccdd",
    fogDensity: 0.03,
    isCentralHub: false,
    isSinkable: false,
    sinkableMaxHealth: 0,
  },

  {
    id: "wi_ice_c",
    layoutId: "ice_c",
    zoneId: "ice",
    name: "Blizzard Maw",
    subtitle: "Storm of the White Plains",
    description:
      "Brutal blizzards make visibility near zero. Ice demons and frost witches exploit the whiteout to ambush from all angles.",
    difficulty: 7,
    order: 2,
    unlockRequirement: "wi_ice_d",
    defaultBehavior: "ambush",
    enemyEmotes: ["fear", "warn", "laugh"],
    waves: [
      { enemies: [{ type: "ghost", count: 4 }, { type: "witch", count: 2 }], spawnDelay: 1.8, behaviorOverride: "ambush" },
      { enemies: [{ type: "yeti", count: 3 }, { type: "ghost", count: 3 }], spawnDelay: 1.5 },
      { enemies: [{ type: "blue_demon", count: 2 }, { type: "golem", count: 2 }, { type: "witch", count: 2 }], spawnDelay: 1.2 },
    ],
    bossType: "blue_demon",
    bossName: "Frostbite Lich",
    sceneAssetPath: null,
    playerSpawn: spawn(),
    enemySpawnRadius: 22,
    boundsRadius: 28,
    rewards: { xp: 1400, gold: 700, unlocks: ["wi_ice_b"] },
    ambientColor: "#bbddff",
    fogColor: "#99bbcc",
    fogDensity: 0.04,
    isCentralHub: false,
    isSinkable: false,
    sinkableMaxHealth: 0,
  },

  {
    id: "wi_ice_b",
    layoutId: "ice_b",
    zoneId: "ice",
    name: "Frostfall Peak",
    subtitle: "Seat of the Ice Warlords",
    description:
      "A vast frozen plateau holding the crumbling towers of the ancient Ice Warlords. Coordinated elite forces hold every approach.",
    difficulty: 8,
    order: 3,
    unlockRequirement: "wi_ice_c",
    defaultBehavior: "defensive",
    enemyEmotes: ["taunt", "rally", "warn"],
    waves: [
      { enemies: [{ type: "yeti", count: 4 }, { type: "golem", count: 2 }], spawnDelay: 1.5 },
      { enemies: [{ type: "blue_demon", count: 3 }, { type: "ghost", count: 4 }], spawnDelay: 1.2, behaviorOverride: "coordinated" },
      { enemies: [{ type: "alien", count: 2 }, { type: "yeti", count: 3 }, { type: "golem", count: 2 }], spawnDelay: 1.0 },
      { enemies: [{ type: "demon", count: 3 }, { type: "blue_demon", count: 3 }], spawnDelay: 0.8, behaviorOverride: "berserker" },
    ],
    bossType: "dragon",
    bossName: "Crystalline Wyrm",
    sceneAssetPath: null,
    playerSpawn: spawn(),
    enemySpawnRadius: 24,
    boundsRadius: 30,
    rewards: { xp: 2200, gold: 1100, unlocks: ["wi_ice_a"] },
    ambientColor: "#aaccee",
    fogColor: "#8899bb",
    fogDensity: 0.035,
    isCentralHub: false,
    isSinkable: false,
    sinkableMaxHealth: 0,
  },

  {
    id: "wi_ice_a",
    layoutId: "ice_a",
    zoneId: "ice",
    name: "Glacier Keep",
    subtitle: "The Unbroken Citadel of Ice",
    description:
      "The innermost glacier fortress where the Ice Warlord himself holds court. Unrelenting berserker forces and the ancient Frost Titan await.",
    difficulty: 9,
    order: 4,
    unlockRequirement: "wi_ice_b",
    defaultBehavior: "berserker",
    enemyEmotes: ["taunt", "rally", "laugh", "celebrate"],
    waves: [
      { enemies: [{ type: "yeti", count: 5 }, { type: "golem", count: 3 }], spawnDelay: 1.2, behaviorOverride: "aggressive" },
      { enemies: [{ type: "demon", count: 3 }, { type: "blue_demon", count: 4 }], spawnDelay: 1.0, behaviorOverride: "berserker" },
      { enemies: [{ type: "alien", count: 3 }, { type: "yeti", count: 4 }, { type: "ghost", count: 3 }], spawnDelay: 0.8 },
      { enemies: [{ type: "dragon", count: 1 }, { type: "demon", count: 4 }], spawnDelay: 0.6, behaviorOverride: "coordinated" },
    ],
    bossType: "trex",
    bossName: "Frost Titan",
    sceneAssetPath: null,
    playerSpawn: spawn(),
    enemySpawnRadius: 26,
    boundsRadius: 32,
    rewards: { xp: 3500, gold: 1750, unlocks: ["wi_lava_d"] },
    ambientColor: "#99bbdd",
    fogColor: "#7799aa",
    fogDensity: 0.04,
    isCentralHub: false,
    isSinkable: false,
    sinkableMaxHealth: 0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LAVA — The Ember Reaches (lower-right)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "wi_lava_d",
    layoutId: "lava_d",
    zoneId: "lava",
    name: "Cinder Gate",
    subtitle: "Threshold of the Ember Reaches",
    description:
      "Scorched rock and rivers of cooling lava mark the gateway to the Ember Reaches. Fire sprites and cactoro harass new arrivals mercilessly.",
    difficulty: 5,
    order: 1,
    unlockRequirement: "wi_ice_a",
    defaultBehavior: "aggressive",
    enemyEmotes: ["taunt", "warn"],
    waves: [
      { enemies: [{ type: "cactoro", count: 4 }, { type: "golem", count: 2 }], spawnDelay: 1.8 },
      { enemies: [{ type: "demon", count: 2 }, { type: "cactoro", count: 3 }], spawnDelay: 1.5 },
    ],
    bossType: "golem",
    bossName: "Magma Sentinel",
    sceneAssetPath: "/models/environment/lava/lava_surface.glb",
    playerSpawn: spawn(),
    enemySpawnRadius: 20,
    boundsRadius: 26,
    rewards: { xp: 900, gold: 450, unlocks: ["wi_lava_c"] },
    ambientColor: "#ff8844",
    fogColor: "#993322",
    fogDensity: 0.02,
    isCentralHub: false,
    isSinkable: false,
    sinkableMaxHealth: 0,
  },

  {
    id: "wi_lava_c",
    layoutId: "lava_c",
    zoneId: "lava",
    name: "Scorched Reach",
    subtitle: "Sea of Flowing Fire",
    description:
      "Lava channels bisect this island making every crossing a trial of endurance. Demon berserkers charge without hesitation across the molten rivers.",
    difficulty: 6,
    order: 2,
    unlockRequirement: "wi_lava_d",
    defaultBehavior: "berserker",
    enemyEmotes: ["taunt", "rally"],
    waves: [
      { enemies: [{ type: "demon", count: 3 }, { type: "golem", count: 2 }], spawnDelay: 1.5, behaviorOverride: "aggressive" },
      { enemies: [{ type: "demon", count: 4 }, { type: "cactoro", count: 3 }], spawnDelay: 1.2, behaviorOverride: "berserker" },
      { enemies: [{ type: "blue_demon", count: 3 }, { type: "golem", count: 3 }], spawnDelay: 1.0 },
    ],
    bossType: "dragon",
    bossName: "Ember Drake",
    sceneAssetPath: "/models/environment/lava/lava_surface.glb",
    playerSpawn: spawn(),
    enemySpawnRadius: 22,
    boundsRadius: 28,
    rewards: { xp: 1600, gold: 800, unlocks: ["wi_lava_b"] },
    ambientColor: "#ff7733",
    fogColor: "#882200",
    fogDensity: 0.025,
    isCentralHub: false,
    isSinkable: false,
    sinkableMaxHealth: 0,
  },

  {
    id: "wi_lava_b",
    layoutId: "lava_b",
    zoneId: "lava",
    name: "Ember Caldera",
    subtitle: "Heart of the Volcano",
    description:
      "An active caldera where elite fire demons guard the passage to deeper volcanic horrors. Coordinated strikes from all directions.",
    difficulty: 7,
    order: 3,
    unlockRequirement: "wi_lava_c",
    defaultBehavior: "coordinated",
    enemyEmotes: ["taunt", "rally", "celebrate"],
    waves: [
      { enemies: [{ type: "demon", count: 4 }, { type: "golem", count: 2 }], spawnDelay: 1.5 },
      { enemies: [{ type: "alien", count: 2 }, { type: "demon", count: 3 }, { type: "blue_demon", count: 2 }], spawnDelay: 1.2, behaviorOverride: "coordinated" },
      { enemies: [{ type: "dragon", count: 1 }, { type: "demon", count: 3 }, { type: "golem", count: 2 }], spawnDelay: 1.0 },
      { enemies: [{ type: "mushroom_king", count: 2 }, { type: "alien", count: 3 }, { type: "demon", count: 3 }], spawnDelay: 0.8, behaviorOverride: "berserker" },
    ],
    bossType: "dragon",
    bossName: "Inferno Sovereign",
    sceneAssetPath: "/models/environment/lava/lava_surface.glb",
    playerSpawn: spawn(),
    enemySpawnRadius: 25,
    boundsRadius: 30,
    rewards: { xp: 2800, gold: 1400, unlocks: ["wi_lava_a"] },
    ambientColor: "#ff6622",
    fogColor: "#771100",
    fogDensity: 0.03,
    isCentralHub: false,
    isSinkable: false,
    sinkableMaxHealth: 0,
  },

  {
    id: "wi_lava_a",
    layoutId: "lava_a",
    zoneId: "lava",
    name: "Volcanic Vent",
    subtitle: "The Forge of the Damned",
    description:
      "The deepest volcanic island where the world's crust runs thin. Legendary fire dragons and titanic golems hold the ultimate challenge of the Ember Reaches.",
    difficulty: 8,
    order: 4,
    unlockRequirement: "wi_lava_b",
    defaultBehavior: "berserker",
    enemyEmotes: ["taunt", "rally", "laugh", "celebrate"],
    waves: [
      { enemies: [{ type: "dragon", count: 2 }, { type: "demon", count: 4 }], spawnDelay: 1.0, behaviorOverride: "aggressive" },
      { enemies: [{ type: "golem", count: 3 }, { type: "alien", count: 4 }], spawnDelay: 0.8, behaviorOverride: "berserker" },
      { enemies: [{ type: "dragon", count: 2 }, { type: "demon", count: 5 }], spawnDelay: 0.6 },
      { enemies: [{ type: "trex", count: 1 }, { type: "dragon", count: 2 }, { type: "golem", count: 2 }], spawnDelay: 0.5, behaviorOverride: "coordinated" },
    ],
    bossType: "trex",
    bossName: "Magma God-King",
    sceneAssetPath: "/models/environment/lava/lava_surface.glb",
    playerSpawn: spawn(),
    enemySpawnRadius: 26,
    boundsRadius: 32,
    rewards: { xp: 5000, gold: 2500, unlocks: ["wi_boss_a"] },
    ambientColor: "#ff5500",
    fogColor: "#660000",
    fogDensity: 0.035,
    isCentralHub: false,
    isSinkable: false,
    sinkableMaxHealth: 0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BOSS — The Shattered Deep (lower-left, sinkable)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "wi_boss_a",
    layoutId: "boss_a",
    zoneId: "boss",
    name: "The Threshold",
    subtitle: "Gateway to the Abyss",
    description:
      "A cracked island on the edge of the Shattered Deep. The ancient stones tremble. Dark energy pulses from the gates below. It will not hold forever.",
    difficulty: 7,
    order: 1,
    unlockRequirement: "wi_lava_a",
    defaultBehavior: "defensive",
    enemyEmotes: ["warn", "fear", "taunt"],
    waves: [
      { enemies: [{ type: "ghost", count: 4 }, { type: "demon", count: 2 }], spawnDelay: 1.8 },
      { enemies: [{ type: "demon", count: 3 }, { type: "blue_demon", count: 3 }], spawnDelay: 1.5, behaviorOverride: "defensive" },
    ],
    bossType: "blue_demon",
    bossName: "The Gate Warden",
    sceneAssetPath: "/models/dungeons/low poly dungeon sample.glb",
    playerSpawn: spawn(),
    enemySpawnRadius: 20,
    boundsRadius: 26,
    rewards: { xp: 1200, gold: 600, unlocks: ["wi_boss_b"] },
    ambientColor: "#663366",
    fogColor: "#441144",
    fogDensity: 0.035,
    isCentralHub: false,
    isSinkable: false,
    sinkableMaxHealth: 0,
  },

  {
    id: "wi_boss_b",
    layoutId: "boss_b",
    zoneId: "boss",
    name: "Cursed Crag",
    subtitle: "The Living Graveyard",
    description:
      "This island shifts and groans as the sea rises to claim it. Dark commanders and demonic hordes surge from the cracks. Defeat them or be swallowed whole.",
    difficulty: 8,
    order: 2,
    unlockRequirement: "wi_boss_a",
    defaultBehavior: "aggressive",
    enemyEmotes: ["warn", "fear", "laugh", "taunt"],
    waves: [
      { enemies: [{ type: "demon", count: 4 }, { type: "blue_demon", count: 2 }], spawnDelay: 1.5 },
      { enemies: [{ type: "ghost", count: 5 }, { type: "demon", count: 3 }], spawnDelay: 1.2, behaviorOverride: "ambush" },
      { enemies: [{ type: "alien", count: 3 }, { type: "mushroom_king", count: 2 }, { type: "demon", count: 3 }], spawnDelay: 1.0 },
    ],
    bossType: "dragon",
    bossName: "The Sunken Lord",
    sceneAssetPath: "/models/dungeons/low poly dungeon sample.glb",
    playerSpawn: spawn(),
    enemySpawnRadius: 22,
    boundsRadius: 28,
    rewards: { xp: 2500, gold: 1250, unlocks: ["wi_boss_c"] },
    ambientColor: "#551155",
    fogColor: "#330033",
    fogDensity: 0.04,
    isCentralHub: false,
    isSinkable: true,
    sinkableMaxHealth: 500,
  },

  {
    id: "wi_boss_c",
    layoutId: "boss_c",
    zoneId: "boss",
    name: "Sunken Throne",
    subtitle: "Where Kings Are Swallowed",
    description:
      "Half this island is already beneath the waterline. Demonic royalty and their legions fight with the fury of the desperate — " +
      "or perhaps with the calm of those who know eternity awaits below.",
    difficulty: 9,
    order: 3,
    unlockRequirement: "wi_boss_b",
    defaultBehavior: "berserker",
    enemyEmotes: ["taunt", "laugh", "rally", "celebrate"],
    waves: [
      { enemies: [{ type: "demon", count: 5 }, { type: "alien", count: 3 }], spawnDelay: 1.2, behaviorOverride: "berserker" },
      { enemies: [{ type: "dragon", count: 2 }, { type: "demon", count: 4 }], spawnDelay: 1.0 },
      { enemies: [{ type: "mushroom_king", count: 2 }, { type: "alien", count: 4 }, { type: "ghost", count: 3 }], spawnDelay: 0.8, behaviorOverride: "coordinated" },
      { enemies: [{ type: "triceratops", count: 1 }, { type: "demon", count: 5 }], spawnDelay: 0.6, behaviorOverride: "aggressive" },
    ],
    bossType: "dragon",
    bossName: "Void Emperor",
    sceneAssetPath: "/models/dungeons/low poly dungeon sample.glb",
    playerSpawn: spawn(),
    enemySpawnRadius: 24,
    boundsRadius: 30,
    rewards: { xp: 4000, gold: 2000, unlocks: ["wi_boss_d"] },
    ambientColor: "#440044",
    fogColor: "#220022",
    fogDensity: 0.05,
    isCentralHub: false,
    isSinkable: true,
    sinkableMaxHealth: 400,
  },

  {
    id: "wi_boss_d",
    layoutId: "boss_d",
    zoneId: "boss",
    name: "The Abyss",
    subtitle: "End of All Things",
    description:
      "This island is barely a memory. Void-touched horrors claw upward from the depths as the island itself descends into oblivion. The only way out is through.",
    difficulty: 10,
    order: 4,
    unlockRequirement: "wi_boss_c",
    defaultBehavior: "berserker",
    enemyEmotes: ["taunt", "laugh", "celebrate"],
    waves: [
      { enemies: [{ type: "dragon", count: 2 }, { type: "demon", count: 5 }], spawnDelay: 1.0, behaviorOverride: "berserker" },
      { enemies: [{ type: "trex", count: 1 }, { type: "alien", count: 4 }, { type: "ghost", count: 4 }], spawnDelay: 0.8 },
      { enemies: [{ type: "dragon", count: 3 }, { type: "mushroom_king", count: 3 }], spawnDelay: 0.6, behaviorOverride: "coordinated" },
      { enemies: [{ type: "trex", count: 1 }, { type: "dragon", count: 3 }, { type: "demon", count: 5 }], spawnDelay: 0.5 },
    ],
    bossType: "trex",
    bossName: "The Abyss Wraith",
    sceneAssetPath: "/models/dungeons/low poly dungeon sample.glb",
    playerSpawn: spawn(),
    enemySpawnRadius: 26,
    boundsRadius: 32,
    rewards: { xp: 7500, gold: 3500, unlocks: [] },
    ambientColor: "#220022",
    fogColor: "#110011",
    fogDensity: 0.06,
    isCentralHub: false,
    isSinkable: true,
    sinkableMaxHealth: 300,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getWorldIsland(id: string): WorldIsland | undefined {
  return WORLD_ISLANDS.find((i) => i.id === id);
}

export function getWorldIslandByLayoutId(layoutId: string): WorldIsland | undefined {
  return WORLD_ISLANDS.find((i) => i.layoutId === layoutId);
}

export function getIslandsByZone(zoneId: ZoneId): WorldIsland[] {
  return WORLD_ISLANDS.filter((i) => i.zoneId === zoneId).sort(
    (a, b) => a.order - b.order
  );
}

export function getSinkableIslands(): WorldIsland[] {
  return WORLD_ISLANDS.filter((i) => i.isSinkable);
}

export function getAvailableWorldIslands(clearedIds: Set<string>): WorldIsland[] {
  return WORLD_ISLANDS.filter((island) => {
    if (!island.unlockRequirement) return true;
    return clearedIds.has(island.unlockRequirement);
  });
}

export function getTotalEnemiesForWorldIsland(island: WorldIsland): number {
  let total = 0;
  for (const wave of island.waves) {
    for (const entry of wave.enemies) {
      total += entry.count;
    }
  }
  if (island.bossType) total += 1;
  return total;
}
