import { create } from "zustand";
import type { TrainingIsland, AIBehaviorProfile } from "./TrainingIslandRegistry";
import { getTrainingIsland, getTotalEnemiesForIsland } from "./TrainingIslandRegistry";

export interface TrainingIslandState {
  activeIslandId: string | null;
  currentWave: number;
  totalWaves: number;
  enemiesKilledThisIsland: number;
  totalEnemiesThisIsland: number;
  bossSpawned: boolean;
  bossDefeated: boolean;
  islandCleared: boolean;
  clearedIslands: Set<string>;
  currentBehavior: AIBehaviorProfile;
  waveInProgress: boolean;
  waveEnemiesSpawned: number;
  waveEnemiesTotal: number;

  startIsland: (islandId: string) => void;
  advanceWave: () => void;
  recordKill: () => void;
  spawnBoss: () => void;
  defeatBoss: () => void;
  clearIsland: () => void;
  leaveIsland: () => void;
  setWaveSpawnProgress: (spawned: number, total: number) => void;
  getActiveIsland: () => TrainingIsland | undefined;
  isIslandUnlocked: (islandId: string) => boolean;
  reset: () => void;
}

export const useTrainingIslands = create<TrainingIslandState>()((set, get) => ({
  activeIslandId: null,
  currentWave: 0,
  totalWaves: 0,
  enemiesKilledThisIsland: 0,
  totalEnemiesThisIsland: 0,
  bossSpawned: false,
  bossDefeated: false,
  islandCleared: false,
  clearedIslands: new Set<string>(),
  currentBehavior: "patrol" as AIBehaviorProfile,
  waveInProgress: false,
  waveEnemiesSpawned: 0,
  waveEnemiesTotal: 0,

  startIsland: (islandId: string) => {
    const island = getTrainingIsland(islandId);
    if (!island) return;
    const total = getTotalEnemiesForIsland(island);
    set({
      activeIslandId: islandId,
      currentWave: 0,
      totalWaves: island.waves.length,
      enemiesKilledThisIsland: 0,
      totalEnemiesThisIsland: total,
      bossSpawned: false,
      bossDefeated: false,
      islandCleared: false,
      currentBehavior: island.defaultBehavior,
      waveInProgress: true,
      waveEnemiesSpawned: 0,
      waveEnemiesTotal: 0,
    });
  },

  advanceWave: () => {
    const state = get();
    const island = getTrainingIsland(state.activeIslandId || "");
    if (!island) return;
    const nextWave = state.currentWave + 1;
    if (nextWave >= island.waves.length) {
      if (island.bossType && !state.bossSpawned) {
        set({ bossSpawned: true, waveInProgress: true, currentWave: nextWave });
      } else {
        set({ waveInProgress: false, currentWave: nextWave });
      }
    } else {
      const waveDef = island.waves[nextWave];
      set({
        currentWave: nextWave,
        waveInProgress: true,
        currentBehavior: waveDef.behaviorOverride || island.defaultBehavior,
        waveEnemiesSpawned: 0,
        waveEnemiesTotal: 0,
      });
    }
  },

  recordKill: () => {
    set(s => ({ enemiesKilledThisIsland: s.enemiesKilledThisIsland + 1 }));
  },

  spawnBoss: () => set({ bossSpawned: true }),
  defeatBoss: () => set({ bossDefeated: true }),

  clearIsland: () => {
    const state = get();
    if (!state.activeIslandId) return;
    const newCleared = new Set(state.clearedIslands);
    newCleared.add(state.activeIslandId);
    set({ islandCleared: true, clearedIslands: newCleared, waveInProgress: false });
  },

  leaveIsland: () => {
    set({
      activeIslandId: null,
      currentWave: 0,
      totalWaves: 0,
      enemiesKilledThisIsland: 0,
      totalEnemiesThisIsland: 0,
      bossSpawned: false,
      bossDefeated: false,
      islandCleared: false,
      waveInProgress: false,
      waveEnemiesSpawned: 0,
      waveEnemiesTotal: 0,
    });
  },

  setWaveSpawnProgress: (spawned, total) => {
    set({ waveEnemiesSpawned: spawned, waveEnemiesTotal: total });
  },

  getActiveIsland: () => {
    const id = get().activeIslandId;
    return id ? getTrainingIsland(id) : undefined;
  },

  isIslandUnlocked: (islandId: string) => {
    const island = getTrainingIsland(islandId);
    if (!island) return false;
    if (!island.unlockRequirement) return true;
    return get().clearedIslands.has(island.unlockRequirement);
  },

  reset: () => {
    set({
      activeIslandId: null,
      currentWave: 0,
      totalWaves: 0,
      enemiesKilledThisIsland: 0,
      totalEnemiesThisIsland: 0,
      bossSpawned: false,
      bossDefeated: false,
      islandCleared: false,
      clearedIslands: new Set<string>(),
      currentBehavior: "patrol",
      waveInProgress: false,
      waveEnemiesSpawned: 0,
      waveEnemiesTotal: 0,
    });
  },
}));
