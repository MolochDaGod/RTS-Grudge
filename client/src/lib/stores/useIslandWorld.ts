import { create } from "zustand";

export type IslandBiome = "temperate" | "tropical" | "volcanic" | "arctic" | "pirate" | "cursed";

export interface IslandData {
  id: string;
  /** Display name — shown in HUD and sailing UI. */
  name: string;
  gridX: number;
  gridZ: number;
  seed: number;
  biome: IslandBiome;
  discovered: boolean;
  hasShop: boolean;
  hasDungeon: boolean;
  dungeonLevel: number;
  enemyTypes: string[];
}

interface IslandWorldState {
  currentIslandId: string;
  islands: Map<string, IslandData>;
  sailing: boolean;
  sailingTarget: { gridX: number; gridZ: number } | null;
  boatPosition: [number, number, number];

  getCurrentIsland: () => IslandData | undefined;
  getOrCreateIsland: (gridX: number, gridZ: number) => IslandData;
  setCurrentIsland: (id: string) => void;
  startSailing: (targetGridX: number, targetGridZ: number) => void;
  stopSailing: () => void;
  setBoatPosition: (pos: [number, number, number]) => void;
  discoverIsland: (id: string) => void;
}

const BIOMES: IslandBiome[] = ["temperate", "tropical", "volcanic", "arctic", "pirate", "cursed"];

const ISLAND_NAMES: Record<IslandBiome, string[]> = {
  temperate: ["The Shattered Coast", "Driftwood Shore", "The Broken Atoll"],
  tropical:  ["Coconut Harbor", "Mangrove Lagoon", "Rum Runner's Cay"],
  volcanic:  ["Ember Caldera", "Cinder Gate", "Scorched Reach"],
  arctic:    ["Frostfall Peak", "Glacier Keep", "Blizzard Maw"],
  pirate:    ["Corsair's Cove", "Cutthroat Bay", "Dead Man's Wharf"],
  cursed:    ["The Cursed Deep", "Shadow Hollows", "The Abyss"],
};

const BIOME_ENEMIES: Record<IslandBiome, string[]> = {
  temperate: ["skeleton", "spider", "golem", "thrower_brute", "thrower_assassin", "thrower_soldier", "thrower_berserker"],
  tropical: ["pirate", "spider", "ninja", "thrower_assassin", "thrower_berserker"],
  volcanic: ["golem", "witch", "skeleton", "thrower_brute", "thrower_soldier"],
  arctic: ["skeleton", "golem", "witch", "thrower_soldier", "thrower_berserker"],
  pirate: ["pirate", "ninja", "skeleton", "thrower_assassin", "thrower_brute"],
  cursed: ["witch", "ninja", "golem", "skeleton", "thrower_berserker", "thrower_soldier"],
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function generateIslandSeed(gridX: number, gridZ: number): number {
  return Math.abs(((gridX * 73856093) ^ (gridZ * 19349663)) % 2147483647) || 42;
}

function createIsland(gridX: number, gridZ: number): IslandData {
  const seed = generateIslandSeed(gridX, gridZ);
  const rng = seededRandom(seed);
  const biome = BIOMES[Math.floor(rng() * BIOMES.length)];
  const isHome = gridX === 0 && gridZ === 0;
  const finalBiome = isHome ? "temperate" : biome;
  const namePool = ISLAND_NAMES[finalBiome];
  const nameIdx = Math.floor(rng() * namePool.length);

  return {
    id: `island_${gridX}_${gridZ}`,
    name: isHome ? "Home Island" : namePool[nameIdx],
    gridX,
    gridZ,
    seed,
    biome: finalBiome,
    discovered: isHome,
    hasShop: isHome || rng() > 0.4,
    hasDungeon: isHome || rng() > 0.3,
    dungeonLevel: isHome ? 1 : Math.floor(rng() * 5) + 1,
    enemyTypes: BIOME_ENEMIES[finalBiome],
  };
}

const homeIsland = createIsland(0, 0);
const initialIslands = new Map<string, IslandData>();
initialIslands.set(homeIsland.id, homeIsland);

export const useIslandWorld = create<IslandWorldState>((set, get) => ({
  currentIslandId: homeIsland.id,
  islands: initialIslands,
  sailing: false,
  sailingTarget: null,
  boatPosition: [0, 0, 0],

  getCurrentIsland: () => {
    return get().islands.get(get().currentIslandId);
  },

  getOrCreateIsland: (gridX, gridZ) => {
    const id = `island_${gridX}_${gridZ}`;
    const existing = get().islands.get(id);
    if (existing) return existing;

    const island = createIsland(gridX, gridZ);
    set(s => {
      const newMap = new Map(s.islands);
      newMap.set(id, island);
      return { islands: newMap };
    });
    return island;
  },

  setCurrentIsland: (id) => set({ currentIslandId: id }),

  startSailing: (targetGridX, targetGridZ) => {
    const island = get().getOrCreateIsland(targetGridX, targetGridZ);
    set({ sailing: true, sailingTarget: { gridX: targetGridX, gridZ: targetGridZ } });
  },

  stopSailing: () => {
    const target = get().sailingTarget;
    if (target) {
      const id = `island_${target.gridX}_${target.gridZ}`;
      get().discoverIsland(id);
      set({ sailing: false, sailingTarget: null, currentIslandId: id });
    } else {
      set({ sailing: false, sailingTarget: null });
    }
  },

  setBoatPosition: (pos) => set({ boatPosition: pos }),

  discoverIsland: (id) => set(s => {
    const island = s.islands.get(id);
    if (island && !island.discovered) {
      const newMap = new Map(s.islands);
      newMap.set(id, { ...island, discovered: true });
      return { islands: newMap };
    }
    return {};
  }),
}));

export const ISLAND_SIZE = 200;
export const OCEAN_GRID_SIZE = 12000;
export const ISLAND_COVERAGE = 0.5;
