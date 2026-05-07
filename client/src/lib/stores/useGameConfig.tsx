import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface TerrainConfig {
  worldSize: number;
  resolution: number;
  maxHeight: number;
  seed: number;
  noiseScale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  waterLevel: number;
  snowLevel: number;
}

export interface EnemyTypeConfig {
  id: string;
  name: string;
  modelPath: string;
  health: number;
  damage: number;
  speed: number;
  detectionRange: number;
  attackRange: number;
  attackCooldown: number;
  xpReward: number;
  lootTable: string[];
  scale: number;
  tint: string | null;
  spawnWeight: number;
  minWave: number;
  nightOnly: boolean;
}

export interface WaveConfig {
  baseEnemiesPerWave: number;
  enemiesPerWaveMultiplier: number;
  maxConcurrentEnemies: number;
  concurrentPerWaveBonus: number;
  spawnInterval: number;
  spawnDistance: number;
  bossEveryNWaves: number;
  bossHealthMultiplier: number;
  bossDamageMultiplier: number;
}

export interface NPCConfig {
  id: string;
  name: string;
  label: string;
  modelPath: string;
  position: [number, number, number];
  targetHeight: number;
  wanderRadius: number;
  speed: number;
  dialogue: string[];
  role: string;
  isVendor: boolean;
  vendorItems: string[];
}

export interface PhysicsConfig {
  gravity: number;
  playerSpeed: number;
  sprintMultiplier: number;
  jumpForce: number;
  slopeUpPenalty: number;
  slopeDownBoost: number;
  maxSlopeAngle: number;
  friction: number;
  airResistance: number;
  playerCollisionRadius: number;
  enemyCollisionRadius: number;
}

export interface CombatConfig {
  baseMeleeDamage: number;
  baseCasterDamage: number;
  baseArcherDamage: number;
  attackCooldown: number;
  staminaCostPerAttack: number;
  criticalHitChance: number;
  criticalHitMultiplier: number;
  blockDamageReduction: number;
  dodgeIFrames: number;
  comboWindow: number;
  maxComboHits: number;
}

export interface UIConfig {
  hudOpacity: number;
  showMinimap: boolean;
  minimapSize: number;
  showDamageNumbers: boolean;
  showHealthBars: boolean;
  healthBarDistance: number;
  crosshairStyle: string;
  chatFontSize: number;
  showFPS: boolean;
  showCoordinates: boolean;
}

export interface WorldConfig {
  dayDuration: number;
  nightDuration: number;
  ambientLightDay: number;
  ambientLightNight: number;
  sunIntensity: number;
  moonIntensity: number;
  fogDensity: number;
  fogColor: string;
  skyColor: string;
  treeCount: number;
  rockCount: number;
  grassDensity: number;
  buildingCount: number;
}

export interface BehaviorConfig {
  fleeHealthThreshold: number;
  aggroMemoryDuration: number;
  wanderChangeInterval: number;
  groupAggroRange: number;
  retreatDistance: number;
  patrolSpeed: number;
  chaseSpeedMultiplier: number;
  alertOthersRange: number;
  deaggroDistance: number;
  idleAnimationChance: number;
}

export interface AnimationConfig {
  blendDuration: number;
  idleToWalkBlend: number;
  walkToRunBlend: number;
  attackBlendIn: number;
  attackBlendOut: number;
  deathDuration: number;
  hitReactDuration: number;
  rootMotionScale: number;
}

export interface StatsConfig {
  baseHealth: number;
  baseStamina: number;
  baseMana: number;
  healthRegenRate: number;
  staminaRegenRate: number;
  manaRegenRate: number;
  hungerDecayRate: number;
  thirstDecayRate: number;
  xpPerLevel: number;
  xpScalingFactor: number;
  maxLevel: number;
  statPointsPerLevel: number;
}

export interface GameConfig {
  terrain: TerrainConfig;
  enemyTypes: EnemyTypeConfig[];
  waves: WaveConfig;
  npcs: NPCConfig[];
  physics: PhysicsConfig;
  combat: CombatConfig;
  ui: UIConfig;
  world: WorldConfig;
  behavior: BehaviorConfig;
  animation: AnimationConfig;
  stats: StatsConfig;
}

const DEFAULT_TERRAIN: TerrainConfig = {
  worldSize: 200,
  resolution: 128,
  maxHeight: 12,
  seed: 42,
  noiseScale: 0.02,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2.0,
  waterLevel: 0.5,
  snowLevel: 10.0,
};

const DEFAULT_ENEMY_TYPES: EnemyTypeConfig[] = [
  { id: "skeleton", name: "Skeleton", modelPath: "/models/characters/undead_grave_knight-male.glb", health: 60, damage: 8, speed: 3.0, detectionRange: 15, attackRange: 2.0, attackCooldown: 1.5, xpReward: 10, lootTable: ["bone", "iron_ore"], scale: 0.1, tint: "#88aa77", spawnWeight: 3, minWave: 1, nightOnly: false },
  { id: "spider", name: "Spider", modelPath: "/models/characters/goblin_backstabber-male.glb", health: 40, damage: 12, speed: 4.5, detectionRange: 12, attackRange: 1.5, attackCooldown: 1.0, xpReward: 8, lootTable: ["silk", "venom"], scale: 0.08, tint: "#886644", spawnWeight: 3, minWave: 1, nightOnly: false },
  { id: "golem", name: "Golem", modelPath: "/models/characters/night_stalker-male.glb", health: 200, damage: 20, speed: 1.5, detectionRange: 10, attackRange: 3.0, attackCooldown: 2.5, xpReward: 25, lootTable: ["stone", "crystal"], scale: 0.15, tint: null, spawnWeight: 1, minWave: 2, nightOnly: true },
  { id: "pirate", name: "Pirate", modelPath: "/models/characters/human_battle_mage-male.glb", health: 80, damage: 15, speed: 3.5, detectionRange: 18, attackRange: 2.0, attackCooldown: 1.2, xpReward: 15, lootTable: ["gold", "cloth"], scale: 0.1, tint: null, spawnWeight: 2, minWave: 2, nightOnly: false },
  { id: "witch", name: "Witch", modelPath: "/models/characters/human_battle_mage-female.glb", health: 50, damage: 25, speed: 2.5, detectionRange: 20, attackRange: 8.0, attackCooldown: 2.0, xpReward: 20, lootTable: ["herb", "mana_crystal"], scale: 0.1, tint: null, spawnWeight: 1, minWave: 3, nightOnly: true },
  { id: "ninja", name: "Ninja", modelPath: "/models/characters/assassin-male.glb", health: 45, damage: 18, speed: 6.0, detectionRange: 22, attackRange: 1.8, attackCooldown: 0.8, xpReward: 18, lootTable: ["cloth", "throwing_star"], scale: 0.1, tint: null, spawnWeight: 2, minWave: 4, nightOnly: false },
  { id: "thrower_brute", name: "Brute Thrower", modelPath: "/models/characters/night_stalker-male.glb", health: 90, damage: 20, speed: 3.0, detectionRange: 12, attackRange: 2.5, attackCooldown: 2.0, xpReward: 20, lootTable: ["bone", "stone"], scale: 0.1, tint: "#cc4444", spawnWeight: 3, minWave: 1, nightOnly: false },
  { id: "thrower_assassin", name: "Assassin Thrower", modelPath: "/models/characters/assassin-male.glb", health: 55, damage: 15, speed: 5.0, detectionRange: 16, attackRange: 2.0, attackCooldown: 1.2, xpReward: 15, lootTable: ["cloth", "throwing_star"], scale: 0.1, tint: "#aa3366", spawnWeight: 3, minWave: 1, nightOnly: false },
  { id: "thrower_soldier", name: "Soldier Thrower", modelPath: "/models/characters/undead_grave_knight-male.glb", health: 100, damage: 18, speed: 3.5, detectionRange: 14, attackRange: 2.5, attackCooldown: 1.5, xpReward: 18, lootTable: ["iron_ore", "gold"], scale: 0.1, tint: "#4466aa", spawnWeight: 3, minWave: 1, nightOnly: false },
  { id: "thrower_berserker", name: "Berserker Thrower", modelPath: "/models/characters/night_stalker-male.glb", health: 120, damage: 25, speed: 4.0, detectionRange: 15, attackRange: 3.0, attackCooldown: 1.8, xpReward: 22, lootTable: ["bone", "crystal"], scale: 0.1, tint: "#cc6600", spawnWeight: 3, minWave: 1, nightOnly: false },
];

const DEFAULT_WAVES: WaveConfig = {
  baseEnemiesPerWave: 5,
  enemiesPerWaveMultiplier: 3,
  maxConcurrentEnemies: 5,
  concurrentPerWaveBonus: 2,
  spawnInterval: 2.0,
  spawnDistance: 25,
  bossEveryNWaves: 5,
  bossHealthMultiplier: 3.0,
  bossDamageMultiplier: 2.0,
};

const DEFAULT_NPCS: NPCConfig[] = [
  { id: "guard1", name: "Town Guard", label: "Guard", modelPath: "/models/characters/undead_grave_knight-male.glb", position: [5, 0, -8], targetHeight: 1.8, wanderRadius: 6, speed: 1.5, dialogue: ["Stay safe, traveler.", "Monsters come out at night."], role: "guard", isVendor: false, vendorItems: [] },
  { id: "guard2", name: "Royal Guard", label: "Guard", modelPath: "/models/characters/undead_grave_knight-male.glb", position: [-8, 0, 5], targetHeight: 1.8, wanderRadius: 6, speed: 1.5, dialogue: ["The kingdom stands strong.", "Report any suspicious activity."], role: "guard", isVendor: false, vendorItems: [] },
  { id: "worker1", name: "Worker", label: "Worker", modelPath: "/models/characters/human_battle_mage-male.glb", position: [22, 0, -28], targetHeight: 1.7, wanderRadius: 8, speed: 1.2, dialogue: ["Hard day's work ahead.", "Need more supplies."], role: "civilian", isVendor: false, vendorItems: [] },
  { id: "wizard_npc", name: "Elder Wizard", label: "Wizard", modelPath: "/models/characters/human_battle_mage-male.glb", position: [30, 0, -15], targetHeight: 1.8, wanderRadius: 5, speed: 0.8, dialogue: ["The ancient magic grows stronger.", "Seek the dungeon below."], role: "questgiver", isVendor: false, vendorItems: [] },
];

const DEFAULT_PHYSICS: PhysicsConfig = {
  gravity: -20,
  playerSpeed: 5.0,
  sprintMultiplier: 1.8,
  jumpForce: 8.0,
  slopeUpPenalty: 1.2,
  slopeDownBoost: 0.5,
  maxSlopeAngle: 45,
  friction: 0.9,
  airResistance: 0.02,
  playerCollisionRadius: 0.5,
  enemyCollisionRadius: 0.8,
};

const DEFAULT_COMBAT: CombatConfig = {
  baseMeleeDamage: 15,
  baseCasterDamage: 20,
  baseArcherDamage: 12,
  attackCooldown: 0.5,
  staminaCostPerAttack: 10,
  criticalHitChance: 0.1,
  criticalHitMultiplier: 2.0,
  blockDamageReduction: 0.6,
  dodgeIFrames: 0.3,
  comboWindow: 0.8,
  maxComboHits: 4,
};

const DEFAULT_UI: UIConfig = {
  hudOpacity: 0.9,
  showMinimap: true,
  minimapSize: 150,
  showDamageNumbers: true,
  showHealthBars: true,
  healthBarDistance: 20,
  crosshairStyle: "dot",
  chatFontSize: 14,
  showFPS: false,
  showCoordinates: false,
};

const DEFAULT_WORLD: WorldConfig = {
  dayDuration: 300,
  nightDuration: 180,
  ambientLightDay: 0.6,
  ambientLightNight: 0.15,
  sunIntensity: 1.5,
  moonIntensity: 0.3,
  fogDensity: 0.002,
  fogColor: "#c8d8e8",
  skyColor: "#87CEEB",
  treeCount: 80,
  rockCount: 60,
  grassDensity: 0.5,
  buildingCount: 12,
};

const DEFAULT_BEHAVIOR: BehaviorConfig = {
  fleeHealthThreshold: 0.2,
  aggroMemoryDuration: 10,
  wanderChangeInterval: 5,
  groupAggroRange: 15,
  retreatDistance: 20,
  patrolSpeed: 0.5,
  chaseSpeedMultiplier: 1.5,
  alertOthersRange: 12,
  deaggroDistance: 30,
  idleAnimationChance: 0.3,
};

const DEFAULT_ANIMATION: AnimationConfig = {
  blendDuration: 0.2,
  idleToWalkBlend: 0.2,
  walkToRunBlend: 0.15,
  attackBlendIn: 0.1,
  attackBlendOut: 0.2,
  deathDuration: 1.5,
  hitReactDuration: 0.3,
  rootMotionScale: 1.0,
};

const DEFAULT_STATS: StatsConfig = {
  baseHealth: 100,
  baseStamina: 100,
  baseMana: 50,
  healthRegenRate: 1.0,
  staminaRegenRate: 5.0,
  manaRegenRate: 2.0,
  hungerDecayRate: 0.5,
  thirstDecayRate: 0.8,
  xpPerLevel: 100,
  xpScalingFactor: 1.5,
  maxLevel: 50,
  statPointsPerLevel: 3,
};

export const DEFAULT_GAME_CONFIG: GameConfig = {
  terrain: DEFAULT_TERRAIN,
  enemyTypes: DEFAULT_ENEMY_TYPES,
  waves: DEFAULT_WAVES,
  npcs: DEFAULT_NPCS,
  physics: DEFAULT_PHYSICS,
  combat: DEFAULT_COMBAT,
  ui: DEFAULT_UI,
  world: DEFAULT_WORLD,
  behavior: DEFAULT_BEHAVIOR,
  animation: DEFAULT_ANIMATION,
  stats: DEFAULT_STATS,
};

interface GameConfigStore {
  config: GameConfig;
  isDirty: boolean;
  history: GameConfig[];
  historyIndex: number;

  updateTerrain: (updates: Partial<TerrainConfig>) => void;
  updateEnemyType: (id: string, updates: Partial<EnemyTypeConfig>) => void;
  addEnemyType: (enemy: EnemyTypeConfig) => void;
  removeEnemyType: (id: string) => void;
  updateWaves: (updates: Partial<WaveConfig>) => void;
  updateNPC: (id: string, updates: Partial<NPCConfig>) => void;
  addNPC: (npc: NPCConfig) => void;
  removeNPC: (id: string) => void;
  updatePhysics: (updates: Partial<PhysicsConfig>) => void;
  updateCombat: (updates: Partial<CombatConfig>) => void;
  updateUI: (updates: Partial<UIConfig>) => void;
  updateWorld: (updates: Partial<WorldConfig>) => void;
  updateBehavior: (updates: Partial<BehaviorConfig>) => void;
  updateAnimation: (updates: Partial<AnimationConfig>) => void;
  updateStats: (updates: Partial<StatsConfig>) => void;
  resetToDefaults: () => void;
  loadConfig: (config: GameConfig) => void;
  exportConfig: () => string;
  importConfig: (json: string) => boolean;
  undo: () => void;
  redo: () => void;
}

function pushHistory(state: GameConfigStore): Partial<GameConfigStore> {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(JSON.parse(JSON.stringify(state.config)));
  return {
    history: newHistory.slice(-50),
    historyIndex: newHistory.length - 1,
    isDirty: true,
  };
}

export const useGameConfig = create<GameConfigStore>()(
  subscribeWithSelector((set, get) => ({
    config: JSON.parse(JSON.stringify(DEFAULT_GAME_CONFIG)),
    isDirty: false,
    history: [JSON.parse(JSON.stringify(DEFAULT_GAME_CONFIG))],
    historyIndex: 0,

    updateTerrain: (updates) =>
      set((s) => ({
        ...pushHistory(s),
        config: { ...s.config, terrain: { ...s.config.terrain, ...updates } },
      })),

    updateEnemyType: (id, updates) =>
      set((s) => ({
        ...pushHistory(s),
        config: {
          ...s.config,
          enemyTypes: s.config.enemyTypes.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        },
      })),

    addEnemyType: (enemy) =>
      set((s) => ({
        ...pushHistory(s),
        config: { ...s.config, enemyTypes: [...s.config.enemyTypes, enemy] },
      })),

    removeEnemyType: (id) =>
      set((s) => ({
        ...pushHistory(s),
        config: {
          ...s.config,
          enemyTypes: s.config.enemyTypes.filter((e) => e.id !== id),
        },
      })),

    updateWaves: (updates) =>
      set((s) => ({
        ...pushHistory(s),
        config: { ...s.config, waves: { ...s.config.waves, ...updates } },
      })),

    updateNPC: (id, updates) =>
      set((s) => ({
        ...pushHistory(s),
        config: {
          ...s.config,
          npcs: s.config.npcs.map((n) =>
            n.id === id ? { ...n, ...updates } : n
          ),
        },
      })),

    addNPC: (npc) =>
      set((s) => ({
        ...pushHistory(s),
        config: { ...s.config, npcs: [...s.config.npcs, npc] },
      })),

    removeNPC: (id) =>
      set((s) => ({
        ...pushHistory(s),
        config: {
          ...s.config,
          npcs: s.config.npcs.filter((n) => n.id !== id),
        },
      })),

    updatePhysics: (updates) =>
      set((s) => ({
        ...pushHistory(s),
        config: { ...s.config, physics: { ...s.config.physics, ...updates } },
      })),

    updateCombat: (updates) =>
      set((s) => ({
        ...pushHistory(s),
        config: { ...s.config, combat: { ...s.config.combat, ...updates } },
      })),

    updateUI: (updates) =>
      set((s) => ({
        ...pushHistory(s),
        config: { ...s.config, ui: { ...s.config.ui, ...updates } },
      })),

    updateWorld: (updates) =>
      set((s) => ({
        ...pushHistory(s),
        config: { ...s.config, world: { ...s.config.world, ...updates } },
      })),

    updateBehavior: (updates) =>
      set((s) => ({
        ...pushHistory(s),
        config: { ...s.config, behavior: { ...s.config.behavior, ...updates } },
      })),

    updateAnimation: (updates) =>
      set((s) => ({
        ...pushHistory(s),
        config: { ...s.config, animation: { ...s.config.animation, ...updates } },
      })),

    updateStats: (updates) =>
      set((s) => ({
        ...pushHistory(s),
        config: { ...s.config, stats: { ...s.config.stats, ...updates } },
      })),

    resetToDefaults: () =>
      set((s) => ({
        ...pushHistory(s),
        config: JSON.parse(JSON.stringify(DEFAULT_GAME_CONFIG)),
        isDirty: false,
      })),

    loadConfig: (config) =>
      set({
        config: JSON.parse(JSON.stringify(config)),
        isDirty: false,
        history: [JSON.parse(JSON.stringify(config))],
        historyIndex: 0,
      }),

    exportConfig: () => JSON.stringify(get().config, null, 2),

    importConfig: (json) => {
      try {
        const parsed = JSON.parse(json);
        get().loadConfig(parsed);
        return true;
      } catch {
        return false;
      }
    },

    undo: () =>
      set((s) => {
        if (s.historyIndex <= 0) return s;
        const newIndex = s.historyIndex - 1;
        return {
          config: JSON.parse(JSON.stringify(s.history[newIndex])),
          historyIndex: newIndex,
        };
      }),

    redo: () =>
      set((s) => {
        if (s.historyIndex >= s.history.length - 1) return s;
        const newIndex = s.historyIndex + 1;
        return {
          config: JSON.parse(JSON.stringify(s.history[newIndex])),
          historyIndex: newIndex,
        };
      }),
  }))
);
