/**
 * worldSectors — Canonical definitions for the 9 biome world sectors.
 *
 * Single source of truth shared between:
 *   - server  (zone routing, sector REST API, ZoneManager)
 *   - client  (world map UI, biome-aware scene loading, AI context)
 *
 * 3×3 grid layout (row 0 = top):
 *   col →    0           1           2
 *   row 0  [forest]   [storm]    [frozen]
 *   row 1  [desert]   [nexus]    [tropical]
 *   row 2  [abyssal]  [ethereal] [volcanic]
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type SectorBiome =
  | "tropical"
  | "forest"
  | "frozen"
  | "volcanic"
  | "desert"
  | "storm"
  | "ethereal"
  | "abyssal"
  | "nexus";

export interface SectorGridPos {
  col: 0 | 1 | 2;
  row: 0 | 1 | 2;
}

export interface WorldSector {
  id: SectorBiome;
  name: string;
  subtitle: string;
  grid: SectorGridPos;

  // ── Visual ─────────────────────────────────────────────────────────
  /** UI accent colour for map labels, legend swatches, etc. */
  color: string;
  /** Hex for Three.js AmbientLight. */
  ambientColor: string;
  /** Hex for Three.js Fog. */
  fogColor: string;
  fogDensity: number;
  /** Renderer clear / sky colour. */
  skyColor: string;
  /** Primary terrain/ground tint. */
  groundColor: string;

  // ── Gameplay ────────────────────────────────────────────────────────
  minPlayerLevel: number;
  maxPlayerLevel: number;
  description: string;
  hazards: string[];
  resources: string[];
  enemies: string[];
  bosses: string[];

  // ── Scene ───────────────────────────────────────────────────────────
  /** Path relative to /public for a pre-built scene GLB, or null. */
  primaryAssetPath: string | null;
  fallbackMode: "scene" | "modular" | "placeholder";
  /** Whether islands here can permanently sink (boss zone mechanic). */
  supportsSinking: boolean;
}

// ── Sector data ───────────────────────────────────────────────────────────────

export const WORLD_SECTORS: Record<SectorBiome, WorldSector> = {

  // ── Row 0 (top) ──────────────────────────────────────────────────────────

  forest: {
    id: "forest",
    name: "The Verdant Reaches",
    subtitle: "Ancient Woodlands — Upper West",
    grid: { col: 0, row: 0 },
    color: "#3a7a44",
    ambientColor: "#7bc47e",
    fogColor: "#4a8c5a",
    fogDensity: 0.018,
    skyColor: "#b8e8b8",
    groundColor: "#4a7a30",
    minPlayerLevel: 5,
    maxPlayerLevel: 20,
    description:
      "Towering ancient trees host druid councils and hidden elven outposts. " +
      "Wolves, corrupted treants, and forest wyrms stalk the shadowed undergrowth.",
    hazards: ["poisonous_spores", "quicksand", "wild_magic"],
    resources: ["lumber", "herbs", "rare_mushrooms", "honey", "beast_pelts"],
    enemies: ["wolf", "treant", "forest_troll", "poison_sprite"],
    bosses: ["elder_treant", "forest_wyrm"],
    primaryAssetPath: null,
    fallbackMode: "modular",
    supportsSinking: false,
  },

  storm: {
    id: "storm",
    name: "The Tempest Expanse",
    subtitle: "Storm Seas — Upper Central",
    grid: { col: 1, row: 0 },
    color: "#5566cc",
    ambientColor: "#8899dd",
    fogColor: "#445588",
    fogDensity: 0.035,
    skyColor: "#2a3a5a",
    groundColor: "#3a4a6a",
    minPlayerLevel: 20,
    maxPlayerLevel: 35,
    description:
      "Perpetual lightning storms crackle above floating reef platforms. " +
      "Storm giants and thunder drakes patrol cloud citadels far above the wave-torn sea.",
    hazards: ["lightning_strikes", "hurricane_winds", "flash_floods"],
    resources: ["storm_crystals", "thunder_essence", "cloud_silk", "sea_glass"],
    enemies: ["storm_elemental", "thunder_drake", "sea_giant", "tempest_harpy"],
    bosses: ["storm_titan", "kraken"],
    primaryAssetPath: null,
    fallbackMode: "placeholder",
    supportsSinking: false,
  },

  frozen: {
    id: "frozen",
    name: "The Frozen Reach",
    subtitle: "Ice Wastes — Upper East",
    grid: { col: 2, row: 0 },
    color: "#88ccff",
    ambientColor: "#cce6ff",
    fogColor: "#aaccdd",
    fogDensity: 0.03,
    skyColor: "#b0d8f8",
    groundColor: "#c8e8f0",
    minPlayerLevel: 15,
    maxPlayerLevel: 30,
    description:
      "Perpetual blizzards scour these glacial islands. Yetis and ice golems " +
      "defend ancient frozen ruins buried beneath centuries of snow and silence.",
    hazards: ["blizzards", "black_ice", "avalanche", "frostbite"],
    resources: ["ice_ore", "frost_gems", "glacier_water", "yeti_fur", "ancient_relics"],
    enemies: ["yeti", "ice_golem", "frost_wraith", "glacier_wyrm"],
    bosses: ["frost_giant", "ice_dragon"],
    primaryAssetPath: null,
    fallbackMode: "placeholder",
    supportsSinking: false,
  },

  // ── Row 1 (middle) ───────────────────────────────────────────────────────

  desert: {
    id: "desert",
    name: "The Sunscorch Wastes",
    subtitle: "Desert Badlands — Mid West",
    grid: { col: 0, row: 1 },
    color: "#d4a22a",
    ambientColor: "#f5c84a",
    fogColor: "#c8a060",
    fogDensity: 0.01,
    skyColor: "#f0c060",
    groundColor: "#c8a050",
    minPlayerLevel: 10,
    maxPlayerLevel: 25,
    description:
      "Scorched sandstone mesas and sun-bleached ruins mark a land forsaken by rain. " +
      "Scorpion clans and mummified tomb guardians defend the pharaoh's buried hoards.",
    hazards: ["extreme_heat", "sandstorms", "scorpion_swarms", "mirages"],
    resources: ["gold_ore", "sand_crystals", "cactus_fruit", "ancient_coins", "oil"],
    enemies: ["sand_scorpion", "tomb_guardian", "desert_bandit", "sand_elemental"],
    bosses: ["scorpion_queen", "sand_pharaoh"],
    primaryAssetPath: null,
    fallbackMode: "modular",
    supportsSinking: false,
  },

  nexus: {
    id: "nexus",
    name: "The Rift Nexus",
    subtitle: "Heart of the Floating Isles — Center",
    grid: { col: 1, row: 1 },
    color: "#c9a25a",
    ambientColor: "#fff8ee",
    fogColor: "#c4b090",
    fogDensity: 0.008,
    skyColor: "#ffe8b8",
    groundColor: "#b09060",
    minPlayerLevel: 0,
    maxPlayerLevel: 99,
    description:
      "The great central island where all factions first made landfall. " +
      "A neutral ground where alliances are forged — and shattered.",
    hazards: ["faction_pvp", "rift_storms"],
    resources: ["rift_shards", "nexus_crystals", "faction_tokens", "all_basic_resources"],
    enemies: ["rival_faction_npc", "corrupted_guardian", "rift_spawn"],
    bosses: ["nexus_colossus"],
    primaryAssetPath: null,
    fallbackMode: "placeholder",
    supportsSinking: false,
  },

  tropical: {
    id: "tropical",
    name: "The Jade Seas",
    subtitle: "Pirate Waters — Mid East",
    grid: { col: 2, row: 1 },
    color: "#4db878",
    ambientColor: "#ffddaa",
    fogColor: "#c4a882",
    fogDensity: 0.012,
    skyColor: "#87ceeb",
    groundColor: "#3a8a50",
    minPlayerLevel: 1,
    maxPlayerLevel: 15,
    description:
      "Warm turquoise waters lined with palm trees and pirate strongholds. " +
      "The Jade Seas are where fresh recruits prove themselves in cannon fire and cutlass duels.",
    hazards: ["sea_storms", "reef_hazards", "pirate_raids"],
    resources: ["tropical_fruit", "hardwood", "pearls", "sea_salt", "rum"],
    enemies: ["pirate", "sea_serpent", "jungle_panther", "reef_crab"],
    bosses: ["pirate_admiral", "leviathan_crab"],
    primaryAssetPath: "/models/pirate_islands/scene.gltf",
    fallbackMode: "scene",
    supportsSinking: false,
  },

  // ── Row 2 (bottom) ───────────────────────────────────────────────────────

  abyssal: {
    id: "abyssal",
    name: "The Shattered Deep",
    subtitle: "Sinking Isles — Lower West",
    grid: { col: 0, row: 2 },
    color: "#9966cc",
    ambientColor: "#441144",
    fogColor: "#331133",
    fogDensity: 0.04,
    skyColor: "#1a0a2a",
    groundColor: "#2a1535",
    minPlayerLevel: 35,
    maxPlayerLevel: 55,
    description:
      "Ancient islands slowly claimed by the void sea. Demonic gates pulse with " +
      "dark energy. Each island may vanish beneath the waves — permanently.",
    hazards: ["void_corruption", "island_sinking", "demon_portals", "soul_drain"],
    resources: ["void_essence", "abyssal_ore", "dark_crystals", "demon_cores"],
    enemies: ["void_demon", "abyssal_knight", "soul_devourer", "rift_horror"],
    bosses: ["abyssal_overlord", "void_kraken"],
    primaryAssetPath: "/models/dungeons/low poly dungeon sample.glb",
    fallbackMode: "scene",
    supportsSinking: true,
  },

  ethereal: {
    id: "ethereal",
    name: "The Spirit Veil",
    subtitle: "Spectral Realm — Lower Central",
    grid: { col: 1, row: 2 },
    color: "#cc88ff",
    ambientColor: "#9966cc",
    fogColor: "#6644aa",
    fogDensity: 0.05,
    skyColor: "#3a1a5a",
    groundColor: "#5a3a8a",
    minPlayerLevel: 30,
    maxPlayerLevel: 50,
    description:
      "The boundary between the living world and the spirit realm thins here. " +
      "Ancient souls wander these shimmering islands, and reality itself fractures " +
      "at the edges. Only the bold — or the foolish — venture this far.",
    hazards: ["reality_fractures", "soul_displacement", "phantom_traps", "time_dilation"],
    resources: ["spirit_essence", "phantom_silk", "ether_crystals", "memory_shards"],
    enemies: ["phantom_knight", "spirit_wisp", "banshee", "ethereal_drake"],
    bosses: ["spirit_colossus", "the_forgotten_king"],
    primaryAssetPath: null,
    fallbackMode: "placeholder",
    supportsSinking: false,
  },

  volcanic: {
    id: "volcanic",
    name: "The Ember Reaches",
    subtitle: "Volcanic Isles — Lower East",
    grid: { col: 2, row: 2 },
    color: "#ff6633",
    ambientColor: "#ff8844",
    fogColor: "#aa4422",
    fogDensity: 0.025,
    skyColor: "#cc4400",
    groundColor: "#8b2200",
    minPlayerLevel: 25,
    maxPlayerLevel: 45,
    description:
      "Molten rivers carve through black obsidian as fire demons and lava golems " +
      "guard the smoldering depths. The air itself burns the lungs of the unprepared.",
    hazards: ["lava_flows", "eruptions", "toxic_ash", "superheated_air"],
    resources: ["obsidian", "lava_ore", "sulfur", "fire_gems", "infernal_coal"],
    enemies: ["lava_golem", "fire_demon", "ash_wraith", "magma_drake"],
    bosses: ["volcano_titan", "infernal_dragon"],
    // free_lava_zone_environment — full Ember Reaches shell (bottom-right sector)
    primaryAssetPath: "/models/environment/lava/free_lava_zone_environment.glb",
    fallbackMode: "scene",
    supportsSinking: false,
  },
};

// ── Grid & label helpers ──────────────────────────────────────────────────────

/** 3×3 grid, row-major. [row][col] → SectorBiome. */
export const SECTOR_GRID: SectorBiome[][] = [
  ["forest",  "storm",    "frozen"  ],
  ["desert",  "nexus",    "tropical"],
  ["abyssal", "ethereal", "volcanic"],
];

export const BIOME_LABELS: Record<SectorBiome, string> = {
  forest:   "Forest",
  storm:    "Storm",
  frozen:   "Frozen",
  desert:   "Desert",
  nexus:    "Nexus",
  tropical: "Tropical",
  abyssal:  "Abyssal",
  ethereal: "Ethereal",
  volcanic: "Volcanic",
};

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getSectorById(id: string): WorldSector | undefined {
  return WORLD_SECTORS[id as SectorBiome];
}

export function getAllSectors(): WorldSector[] {
  return Object.values(WORLD_SECTORS);
}

export function getSectorAtGrid(col: 0 | 1 | 2, row: 0 | 1 | 2): WorldSector {
  return WORLD_SECTORS[SECTOR_GRID[row][col]];
}

/** Returns all sectors sorted ascending by minPlayerLevel. */
export function getSectorsByLevel(): WorldSector[] {
  return getAllSectors().sort((a, b) => a.minPlayerLevel - b.minPlayerLevel);
}

/** Returns the sector whose grid cell contains the given world-space point.
 *  Assumes the full world is sectorSize × sectorSize units per cell. */
export function getSectorAtWorldPos(
  worldX: number,
  worldZ: number,
  sectorSize = 1000,
): WorldSector {
  const col = Math.max(0, Math.min(2, Math.floor((worldX + sectorSize * 1.5) / sectorSize))) as 0 | 1 | 2;
  const row = Math.max(0, Math.min(2, Math.floor((worldZ + sectorSize * 1.5) / sectorSize))) as 0 | 1 | 2;
  return getSectorAtGrid(col, row);
}
