import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { IslandBiome } from "./useIslandWorld";
import { useGame } from "./useGame";
import { useEquipment } from "./useEquipment";
import { useCombatLog } from "./useCombatLog";

export type CampaignObjective = "explore" | "dungeon" | "boss" | "gather" | "build" | "defend";

export interface CampaignIsland {
  id: string;
  gridX: number;
  gridZ: number;
  seed: number;
  biome: IslandBiome;
  discovered: boolean;
  cleared: boolean;
  dungeonCleared: boolean;
  bossDefeated: boolean;
  difficulty: number;
  wilderness: boolean;
  resources: {
    woodAvailable: number;
    stoneAvailable: number;
    oreAvailable: number;
  };
}

export interface CampaignQuest {
  id: string;
  title: string;
  description: string;
  objective: CampaignObjective;
  targetIsland: string;
  completed: boolean;
  // Quantitative progress. `target` is the goal (e.g. 20 wood). `progress`
  // counts toward it. Quests without these fields are treated as 1/1
  // (single-shot completion via completeQuest).
  progress?: number;
  target?: number;
  rewards: {
    xp: number;
    gold: number;
    unlocks?: string[];
  };
}

export interface CampaignState {
  active: boolean;
  currentIslandId: string;
  homeBaseLevel: number;
  islandsDiscovered: number;
  dungeonsCleared: number;
  bossesDefeated: number;
  daysSurvived: number;
  totalKills: number;

  islands: Map<string, CampaignIsland>;
  activeQuests: CampaignQuest[];
  completedQuests: string[];
  unlockedRecipes: Set<string>;
  unlockedBuildings: Set<string>;

  startCampaign: () => void;
  discoverIsland: (gridX: number, gridZ: number) => void;
  clearDungeon: (islandId: string) => void;
  defeatBoss: (islandId: string) => void;
  completeQuest: (questId: string) => void;
  recordGather: (qty?: number) => void;
  recordBuild: (qty?: number) => void;
  recordKill: (qty?: number) => void;
  recordDungeon: () => void;
  addQuest: (quest: CampaignQuest) => void;
  unlockRecipe: (recipeId: string) => void;
  unlockBuilding: (buildingId: string) => void;
  incrementDay: () => void;
  addKills: (count: number) => void;
  travelToIsland: (islandId: string) => void;
  upgradeBase: () => void;
  reset: () => void;
}

const BIOMES: IslandBiome[] = ["temperate", "tropical", "volcanic", "arctic", "pirate", "cursed"];

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

function createCampaignIsland(gridX: number, gridZ: number, difficulty: number): CampaignIsland {
  const seed = generateIslandSeed(gridX, gridZ);
  const rng = seededRandom(seed);
  const isHome = gridX === 0 && gridZ === 0;
  const biome: IslandBiome = isHome ? "temperate" : BIOMES[Math.floor(rng() * BIOMES.length)];

  return {
    id: `island_${gridX}_${gridZ}`,
    gridX,
    gridZ,
    seed,
    biome,
    discovered: isHome,
    cleared: false,
    dungeonCleared: false,
    bossDefeated: false,
    difficulty: isHome ? 1 : difficulty,
    wilderness: isHome,
    resources: {
      woodAvailable: Math.floor(100 + rng() * 200),
      stoneAvailable: Math.floor(50 + rng() * 150),
      oreAvailable: Math.floor(20 + rng() * 80),
    },
  };
}

const STARTER_QUESTS: CampaignQuest[] = [
  {
    id: "quest_survive_wilderness",
    title: "Stranded",
    description: "Gather 20 resources from the wilderness to survive.",
    objective: "gather",
    targetIsland: "island_0_0",
    completed: false,
    progress: 0,
    target: 20,
    rewards: { xp: 50, gold: 10 },
  },
  {
    id: "quest_make_camp",
    title: "A Place to Rest",
    description: "Place 2 structures from scavenged materials.",
    objective: "build",
    targetIsland: "island_0_0",
    completed: false,
    progress: 0,
    target: 2,
    rewards: { xp: 100, gold: 25, unlocks: ["foundation", "wall"] },
  },
  {
    id: "quest_clear_threats",
    title: "Predators",
    description: "Defeat 5 hostile creatures around your camp.",
    objective: "defend",
    targetIsland: "island_0_0",
    completed: false,
    progress: 0,
    target: 5,
    rewards: { xp: 150, gold: 50 },
  },
  {
    id: "quest_island_boss",
    title: "The Ancient Guardian",
    description: "Defeat the island boss to unlock the depths below.",
    objective: "boss",
    targetIsland: "island_0_0",
    completed: false,
    progress: 0,
    target: 1,
    rewards: { xp: 500, gold: 200, unlocks: ["forge", "armorBench"] },
  },
  {
    id: "quest_first_dungeon",
    title: "Into the Deep",
    description: "Clear the island dungeon to discover what lies beneath.",
    objective: "dungeon",
    targetIsland: "island_0_0",
    completed: false,
    progress: 0,
    target: 1,
    rewards: { xp: 300, gold: 100, unlocks: ["shipwright"] },
  },
];

function createInitialIslands(): Map<string, CampaignIsland> {
  const home = createCampaignIsland(0, 0, 1);
  const m = new Map<string, CampaignIsland>();
  m.set(home.id, home);
  return m;
}

const NEIGHBOR_OFFSETS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];

export const useCampaign = create<CampaignState>()(
  subscribeWithSelector((set, get) => ({
    active: false,
    currentIslandId: "island_0_0",
    homeBaseLevel: 1,
    islandsDiscovered: 1,
    dungeonsCleared: 0,
    bossesDefeated: 0,
    daysSurvived: 0,
    totalKills: 0,
    islands: createInitialIslands(),
    activeQuests: [],
    completedQuests: [],
    unlockedRecipes: new Set<string>(),
    unlockedBuildings: new Set<string>(["campfire", "workbench"]),

    startCampaign: () => {
      set({
        active: true,
        activeQuests: [...STARTER_QUESTS],
        islands: createInitialIslands(),
        currentIslandId: "island_0_0",
        homeBaseLevel: 1,
        islandsDiscovered: 1,
        dungeonsCleared: 0,
        bossesDefeated: 0,
        daysSurvived: 0,
        totalKills: 0,
        completedQuests: [],
        unlockedRecipes: new Set<string>(),
        unlockedBuildings: new Set<string>(["campfire", "workbench"]),
      });
    },

    discoverIsland: (gridX: number, gridZ: number) => {
      const id = `island_${gridX}_${gridZ}`;
      const state = get();
      if (state.islands.has(id)) {
        const existing = state.islands.get(id)!;
        if (existing.discovered) return;
        const newIslands = new Map(state.islands);
        existing.discovered = true;
        newIslands.set(id, existing);
        set({ islands: newIslands, islandsDiscovered: state.islandsDiscovered + 1 });
        return;
      }

      const dist = Math.sqrt(gridX * gridX + gridZ * gridZ);
      const difficulty = Math.max(1, Math.floor(dist) + 1);
      const island = createCampaignIsland(gridX, gridZ, difficulty);
      island.discovered = true;

      const newIslands = new Map(state.islands);
      newIslands.set(id, island);
      set({ islands: newIslands, islandsDiscovered: state.islandsDiscovered + 1 });
    },

    clearDungeon: (islandId: string) => {
      const state = get();
      const newIslands = new Map(state.islands);
      const island = newIslands.get(islandId);
      if (!island || island.dungeonCleared) return;

      island.dungeonCleared = true;
      newIslands.set(islandId, island);

      for (const [dx, dz] of NEIGHBOR_OFFSETS) {
        const nx = island.gridX + dx;
        const nz = island.gridZ + dz;
        const nid = `island_${nx}_${nz}`;
        if (!newIslands.has(nid)) {
          const dist = Math.sqrt(nx * nx + nz * nz);
          const newIsland = createCampaignIsland(nx, nz, Math.max(1, Math.floor(dist) + 1));
          newIslands.set(nid, newIsland);
        }
      }

      set({
        islands: newIslands,
        dungeonsCleared: state.dungeonsCleared + 1,
      });
      (get() as any)._advanceObjective("dungeon", 1);
    },

    defeatBoss: (islandId: string) => {
      const state = get();
      const newIslands = new Map(state.islands);
      const island = newIslands.get(islandId);
      if (!island || island.bossDefeated) return;
      island.bossDefeated = true;
      island.cleared = true;
      newIslands.set(islandId, island);
      set({ islands: newIslands, bossesDefeated: state.bossesDefeated + 1 });
      (get() as any)._advanceObjective("boss", 1);
    },

    completeQuest: (questId: string) => {
      const state = get();
      const quest = state.activeQuests.find(q => q.id === questId);
      if (!quest || quest.completed) return;

      const newUnlockedBuildings = new Set(state.unlockedBuildings);
      if (quest.rewards.unlocks) {
        for (const u of quest.rewards.unlocks) newUnlockedBuildings.add(u);
      }

      // Drop the completed quest from the active list and append it to the
      // completed roster. Mark it completed first so any UI that snapshots
      // both lists during the same tick sees a consistent state.
      set({
        activeQuests: state.activeQuests
          .map(q => (q.id === questId ? { ...q, completed: true, progress: q.target ?? q.progress } : q))
          .filter(q => q.id !== questId),
        completedQuests: [...state.completedQuests, questId],
        unlockedBuildings: newUnlockedBuildings,
      });

      // Distribute rewards. XP goes through useGame.addXP which forwards to
      // the per-character stats store (so the player actually levels up). Gold
      // goes to the equipment store where the player's currency lives.
      if (quest.rewards.xp > 0) {
        try { useGame.getState().addXP(quest.rewards.xp); } catch {}
      }
      if (quest.rewards.gold > 0) {
        try { useEquipment.getState().addGold(quest.rewards.gold); } catch {}
      }

      try {
        useCombatLog.getState().addEntry(
          `Quest complete — ${quest.title} (+${quest.rewards.xp} XP, +${quest.rewards.gold} gold)`,
          "#ffd166"
        );
      } catch {}
    },

    // Internal helper: advance the first active quest matching `objective`.
    // Returns nothing — completion + reward distribution happens implicitly.
    // Uses a functional set so back-to-back calls in the same tick can't race.
    _advanceObjective: (objective: CampaignObjective, qty: number) => {
      if (!get().active) return;

      let questToComplete: string | null = null;
      set((s) => {
        const idx = s.activeQuests.findIndex(q => q.objective === objective && !q.completed);
        if (idx < 0) return s;
        const quest = s.activeQuests[idx];
        const target = quest.target ?? 1;
        const nextProgress = Math.min(target, (quest.progress ?? 0) + qty);
        if (nextProgress === (quest.progress ?? 0)) return s;

        const updated = s.activeQuests.slice();
        updated[idx] = { ...quest, progress: nextProgress };
        if (nextProgress >= target) {
          questToComplete = quest.id;
        }
        return { activeQuests: updated };
      });

      if (questToComplete) {
        get().completeQuest(questToComplete);
      }
    },

    recordGather: (qty = 1) => (get() as any)._advanceObjective("gather", qty),
    recordBuild: (qty = 1) => (get() as any)._advanceObjective("build", qty),
    recordKill: (qty = 1) => (get() as any)._advanceObjective("defend", qty),
    recordDungeon: () => (get() as any)._advanceObjective("dungeon", 1),

    addQuest: (quest: CampaignQuest) => {
      set(s => ({ activeQuests: [...s.activeQuests, quest] }));
    },

    unlockRecipe: (recipeId: string) => {
      set(s => {
        const nr = new Set(s.unlockedRecipes);
        nr.add(recipeId);
        return { unlockedRecipes: nr };
      });
    },

    unlockBuilding: (buildingId: string) => {
      set(s => {
        const nb = new Set(s.unlockedBuildings);
        nb.add(buildingId);
        return { unlockedBuildings: nb };
      });
    },

    incrementDay: () => set(s => ({ daysSurvived: s.daysSurvived + 1 })),

    addKills: (count: number) => {
      set(s => ({ totalKills: s.totalKills + count }));
      (get() as any)._advanceObjective("defend", count);
    },

    travelToIsland: (islandId: string) => {
      set({ currentIslandId: islandId });
    },

    upgradeBase: () => set(s => ({ homeBaseLevel: s.homeBaseLevel + 1 })),

    reset: () => {
      set({
        active: false,
        currentIslandId: "island_0_0",
        homeBaseLevel: 1,
        islandsDiscovered: 1,
        dungeonsCleared: 0,
        bossesDefeated: 0,
        daysSurvived: 0,
        totalKills: 0,
        islands: createInitialIslands(),
        activeQuests: [],
        completedQuests: [],
        unlockedRecipes: new Set<string>(),
        unlockedBuildings: new Set<string>(["campfire", "workbench"]),
      });
    },
  }))
);
