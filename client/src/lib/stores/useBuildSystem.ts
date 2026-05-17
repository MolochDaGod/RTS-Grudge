import { create } from "zustand";
import { useAllies, type AllyType } from "./useAllies";
import type { FactionId } from "@/lib/data/factions";

let _onBuildingRemoved: ((uid: string) => void) | null = null;
export function registerBuildingRemoveCallback(cb: (uid: string) => void) {
  _onBuildingRemoved = cb;
}

export type BuildingCategory = "defense" | "economy" | "military" | "housing" | "special";
export type BuildingAge = "first" | "second";

export type SpawnResourceDef = { type: "wood" | "stone" | "fiber" | "iron_ore" | "raw_meat" | "berry" | "herb" | "gold_ore" | "crystal"; count: number };

export interface BuildingDef {
  id: string;
  name: string;
  category: BuildingCategory;
  age: BuildingAge;
  level: number;
  maxLevel: number;
  modelPath: string;
  cost: { wood: number; stone: number; gold: number };
  size: [number, number];
  description: string;
  unlockRequirement?: string;
  spawnAlly?: AllyType;
  allyCount?: number;
  spawnResources?: SpawnResourceDef[];
  /**
   * Faction that owns this building type.
   * "neutral" = available to every faction.
   * A specific FactionId = only that faction can build it in the UI.
   * Omitting the field defaults to "neutral".
   */
  faction?: FactionId | "neutral";
}

export interface PlacedBuilding {
  uid: string;
  defId: string;
  position: [number, number, number];
  rotation: number;
  level: number;
  health: number;
  maxHealth: number;
}

interface BuildSystemState {
  resources: { wood: number; stone: number; gold: number };
  unlockedBuildings: Set<string>;
  placedBuildings: PlacedBuilding[];
  buildMode: boolean;
  selectedBuildingId: string | null;
  ghostPosition: [number, number, number] | null;
  ghostRotation: number;

  toggleBuildMode: () => void;
  selectBuilding: (id: string | null) => void;
  setGhostPosition: (pos: [number, number, number] | null) => void;
  rotateGhost: () => void;
  placeBuilding: () => boolean;
  removeBuilding: (uid: string) => void;
  upgradeBuilding: (uid: string) => boolean;
  addResources: (wood: number, stone: number, gold: number) => void;
  unlockBuilding: (id: string) => void;
  damageBuilding: (uid: string, amount: number) => void;
}

let buildingUidCounter = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Faction→worker ally override
// Neutral buildings that spawn workers use this map so the worker model always
// matches the player's race instead of hardcoding a "farmer" (human).
// ─────────────────────────────────────────────────────────────────────────────
export const FACTION_WORKER_ALLY: Record<string, AllyType> = {
  crusade: "farmer",   // human_battle_mage-male
  pirate:  "farmer",   // human model (pirates share human appearance)
  fabled:  "ranger",   // elf-female, canHarvest:true — fabled harvester
  legion:  "warrior",  // orc_scout-male, brute-force gatherer
};

// ─────────────────────────────────────────────────────────────────────────────
// Faction→building access alias
// When a faction is listed here, it can also build that other faction's
// military structures. Pirates are culturally human so they can build Crusade
// military (soldiers, mages, captains) in addition to their own neutral builds.
// ─────────────────────────────────────────────────────────────────────────────
export const FACTION_BUILDING_ALIAS: Partial<Record<string, string>> = {
  pirate: "crusade",
};

export const BUILDING_REGISTRY: BuildingDef[] = [
  // ── NEUTRAL: Defense ─────────────────────────────────────────────────────
  // Walls, towers and gates are neutral — any faction can fortify their land.
  { id: "watchtower_1a_l1", faction: "neutral", name: "Watch Tower",     category: "defense", age: "first",  level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/WatchTower_FirstAge_Level1.glb",    cost: { wood: 50,  stone: 30, gold: 10 }, size: [3, 3], description: "Basic defensive tower. Archers attack nearby enemies." },
  { id: "watchtower_1a_l2", faction: "neutral", name: "Watch Tower II",  category: "defense", age: "first",  level: 2, maxLevel: 3, modelPath: "/models/rts_quaternius/WatchTower_FirstAge_Level2.glb",    cost: { wood: 80,  stone: 50, gold: 20 }, size: [3, 3], description: "Upgraded tower with increased range." },
  { id: "watchtower_1a_l3", faction: "neutral", name: "Watch Tower III", category: "defense", age: "first",  level: 3, maxLevel: 3, modelPath: "/models/rts_quaternius/WatchTower_FirstAge_Level3.glb",    cost: { wood: 120, stone: 80, gold: 40 }, size: [3, 3], description: "Maximum tower with elite archers." },
  { id: "wall_1a",          faction: "neutral", name: "Stone Wall",      category: "defense", age: "first",  level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Wall_FirstAge.glb",                 cost: { wood: 10,  stone: 20, gold:  0 }, size: [4, 1], description: "Basic stone wall segment." },
  { id: "walltower_1a",     faction: "neutral", name: "Wall Tower",      category: "defense", age: "first",  level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/WallTowers_FirstAge.glb",           cost: { wood: 30,  stone: 40, gold: 10 }, size: [3, 3], description: "Fortified wall tower." },
  { id: "gate_1a",          faction: "neutral", name: "Gate",            category: "defense", age: "first",  level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/WallTowers_Door_FirstAge.glb",       cost: { wood: 40,  stone: 50, gold: 15 }, size: [4, 3], description: "Gated wall entrance." },
  { id: "watchtower_2a_l1", faction: "neutral", name: "Guard Tower",     category: "defense", age: "second", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/WatchTower_SecondAge_Level1.glb",   cost: { wood: 100, stone: 60, gold: 30 }, size: [3, 3], description: "Advanced defensive tower.", unlockRequirement: "second_age" },

  // ── NEUTRAL: Economy ─────────────────────────────────────────────────────
  // Resource production and storage are faction-agnostic infrastructure.
  // Worker-spawning buildings (camp, farm_workers) use FACTION_WORKER_ALLY to
  // replace the default 'farmer' with the correct race at placement time.
  { id: "farm_1a_l1",      faction: "neutral", name: "Farm",          category: "economy", age: "first",  level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Farm_FirstAge_Level1.glb",    cost: { wood: 30, stone: 10, gold:  5 }, size: [4, 4], description: "Produces food. Generates gold over time. Grows herbs and berries.",       spawnResources: [{ type: "herb", count: 3 }, { type: "berry", count: 3 }] },
  { id: "farm_1a_l2",      faction: "neutral", name: "Farm II",       category: "economy", age: "first",  level: 2, maxLevel: 3, modelPath: "/models/rts_quaternius/Farm_FirstAge_Level2.glb",    cost: { wood: 50, stone: 20, gold: 10 }, size: [4, 4], description: "Upgraded farm. Grows more food.",                                          spawnResources: [{ type: "herb", count: 4 }, { type: "berry", count: 4 }, { type: "fiber", count: 2 }] },
  { id: "farm_1a_l3",      faction: "neutral", name: "Farm III",      category: "economy", age: "first",  level: 3, maxLevel: 3, modelPath: "/models/rts_quaternius/Farm_FirstAge_Level3.glb",    cost: { wood: 80, stone: 30, gold: 20 }, size: [4, 4], description: "Large farm. Rich ecosystem.",                                             spawnResources: [{ type: "herb", count: 5 }, { type: "berry", count: 5 }, { type: "fiber", count: 3 }] },
  { id: "market_1a_l1",    faction: "neutral", name: "Market",        category: "economy", age: "first",  level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Market_FirstAge_Level1.glb",   cost: { wood: 40, stone: 20, gold: 15 }, size: [4, 3], description: "Trade post. Generates gold." },
  { id: "storage_1a_l1",   faction: "neutral", name: "Storage",       category: "economy", age: "first",  level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Storage_FirstAge_Level1.glb",  cost: { wood: 30, stone: 15, gold:  5 }, size: [3, 3], description: "Stores resources." },
  { id: "windmill_1a",      faction: "neutral", name: "Windmill",      category: "economy", age: "first",  level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Windmill_FirstAge.glb",        cost: { wood: 50, stone: 20, gold: 10 }, size: [3, 3], description: "Generates food from nearby farms." },
  { id: "lumber_camp",      faction: "neutral", name: "Lumber Camp",   category: "economy", age: "first",  level: 1, maxLevel: 2, modelPath: "/models/rts_quaternius/Storage_FirstAge_Level1.glb",  cost: { wood: 35, stone: 15, gold:  5 }, size: [3, 3], description: "Forestry camp. Spawns wood and fiber nodes around it.",              spawnResources: [{ type: "wood", count: 6 }, { type: "fiber", count: 3 }] },
  { id: "herb_garden",      faction: "neutral", name: "Herb Garden",   category: "economy", age: "first",  level: 1, maxLevel: 2, modelPath: "/models/rts_quaternius/Farm_FirstAge_Level1.glb",    cost: { wood: 25, stone: 10, gold: 10 }, size: [3, 3], description: "Cultivated garden. Grows herbs and berries around it.",           spawnResources: [{ type: "herb", count: 5 }, { type: "berry", count: 4 }] },
  { id: "mining_outpost",   faction: "neutral", name: "Mining Outpost", category: "economy", age: "first", level: 1, maxLevel: 2, modelPath: "/models/rts_quaternius/Storage_FirstAge_Level1.glb", cost: { wood: 30, stone: 30, gold: 10 }, size: [3, 3], description: "Mining site. Spawns stone and iron ore deposits around it.",     spawnResources: [{ type: "stone", count: 4 }, { type: "iron_ore", count: 3 }] },
  { id: "crystal_grove",    faction: "neutral", name: "Crystal Grove", category: "economy", age: "second", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Temple_FirstAge_Level1.glb", cost: { wood: 60, stone: 60, gold: 40 }, size: [4, 4], description: "Mystical grove. Grows crystals and gold ore around it.",         spawnResources: [{ type: "crystal", count: 3 }, { type: "gold_ore", count: 2 }], unlockRequirement: "second_age" },
  // Worker hut: spawns faction-appropriate workers at placement (BuildModeHandler overrides the ally type)
  { id: "farm_workers",     faction: "neutral", name: "Worker's Hut",  category: "economy", age: "first",  level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Farm_FirstAge_Level2.glb",    cost: { wood: 40, stone: 15, gold: 10 }, size: [3, 3], description: "Spawns workers that auto-harvest nearby resources.", spawnAlly: "farmer", allyCount: 2 },
  { id: "camp",             faction: "neutral", name: "Camp",          category: "economy", age: "first",  level: 1, maxLevel: 2, modelPath: "/models/rts_quaternius/Farm_FirstAge_Level1.glb",    cost: { wood: 20, stone: 10, gold:  0 }, size: [4, 4], description: "Base camp. Spawns workers that auto-harvest nearby resources.",    spawnAlly: "farmer", allyCount: 2, spawnResources: [{ type: "berry", count: 4 }, { type: "fiber", count: 3 }, { type: "herb", count: 2 }] },

  // ── NEUTRAL: Housing ─────────────────────────────────────────────────────
  { id: "house_1a_1_l1",  faction: "neutral", name: "House",          category: "housing", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Houses_FirstAge_1_Level1.glb", cost: { wood: 25, stone: 15, gold: 5 }, size: [3, 3], description: "Basic dwelling." },
  { id: "house_1a_2_l1",  faction: "neutral", name: "House (Style B)", category: "housing", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Houses_FirstAge_2_Level1.glb", cost: { wood: 25, stone: 15, gold: 5 }, size: [3, 3], description: "Alternative house style." },
  { id: "house_1a_3_l1",  faction: "neutral", name: "House (Style C)", category: "housing", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Houses_FirstAge_3_Level1.glb", cost: { wood: 25, stone: 15, gold: 5 }, size: [3, 3], description: "Alternative house style." },

  // ── NEUTRAL: Special ─────────────────────────────────────────────────────
  { id: "temple_1a_l1",     faction: "neutral", name: "Temple",      category: "special", age: "first",  level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Temple_FirstAge_Level1.glb",     cost: { wood: 60,  stone: 80,  gold:  40 }, size: [5, 5], description: "Sacred temple. Unlocks healing." },
  { id: "towncenter_1a_l1", faction: "neutral", name: "Town Center", category: "special", age: "first",  level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/TownCenter_FirstAge_Level1.glb", cost: { wood: 100, stone: 60,  gold:  30 }, size: [6, 6], description: "Central hub. Unlocks Second Age buildings.", unlockRequirement: "second_age" },
  { id: "wonder_1a_l1",     faction: "neutral", name: "Wonder",      category: "special", age: "first",  level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Wonder_FirstAge_Level1.glb",     cost: { wood: 200, stone: 200, gold: 100 }, size: [8, 8], description: "Legendary structure. Victory monument." },

  // ── CRUSADE: Military ─────────────────────────────────────────────────────
  // Human-race faction buildings. Crusade + pirate (human-adjacent) can build.
  { id: "barracks_1a_l1",    faction: "crusade", name: "Barracks",          category: "military", age: "first",  level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Barracks_FirstAge_Level1.glb",    cost: { wood: 80,  stone: 40,  gold:  20 }, size: [5, 5], description: "Trains human soldiers.",             spawnAlly: "soldier",  allyCount: 2 },
  { id: "barracks_1a_l2",    faction: "crusade", name: "Barracks II",        category: "military", age: "first",  level: 2, maxLevel: 3, modelPath: "/models/rts_quaternius/Barracks_FirstAge_Level2.glb",    cost: { wood: 130, stone: 70,  gold:  40 }, size: [5, 5], description: "Upgraded barracks.",                spawnAlly: "soldier",  allyCount: 3 },
  { id: "barracks_1a_l3",    faction: "crusade", name: "Barracks III",       category: "military", age: "first",  level: 3, maxLevel: 3, modelPath: "/models/rts_quaternius/Barracks_FirstAge_Level3.glb",    cost: { wood: 200, stone: 100, gold:  60 }, size: [5, 5], description: "Elite barracks.",                   spawnAlly: "soldier",  allyCount: 5 },
  { id: "barracks_2a_l1",    faction: "crusade", name: "Grand Barracks",     category: "military", age: "second", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Barracks_SecondAge_Level1.glb",   cost: { wood: 150, stone: 80,  gold:  50 }, size: [6, 6], description: "Elite armored knights.",             spawnAlly: "knight",   allyCount: 3, unlockRequirement: "second_age" },
  { id: "mage_tower",         faction: "crusade", name: "Mage Tower",         category: "military", age: "second", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/WatchTower_SecondAge_Level1.glb", cost: { wood: 80,  stone: 60,  gold:  50 }, size: [4, 4], description: "Trains battle mages.",               spawnAlly: "mage",     allyCount: 2, unlockRequirement: "second_age" },
  { id: "captain_quarters",   faction: "crusade", name: "Captain's Quarters", category: "military", age: "second", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/TownCenter_FirstAge_Level1.glb", cost: { wood: 150, stone: 100, gold: 100 }, size: [6, 6], description: "Recruits a Captain that buffs allies.",  spawnAlly: "captain",  allyCount: 1, unlockRequirement: "second_age" },

  // ── FABLED: Military ─────────────────────────────────────────────────────
  // Elf-race faction buildings — archery and scouting focus.
  { id: "archery_1a_l1", faction: "fabled", name: "Archery Range",   category: "military", age: "first",  level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Archery_FirstAge_Level1.glb",  cost: { wood: 60,  stone: 20, gold: 15 }, size: [4, 4], description: "Trains elven archers.",       spawnAlly: "archer",       allyCount: 2 },
  { id: "archery_1a_l2", faction: "fabled", name: "Archery Range II", category: "military", age: "first",  level: 2, maxLevel: 3, modelPath: "/models/rts_quaternius/Archery_FirstAge_Level2.glb",  cost: { wood: 100, stone: 40, gold: 30 }, size: [4, 4], description: "Advanced archery range.",    spawnAlly: "archer",       allyCount: 3 },
  { id: "archery_1a_l3", faction: "fabled", name: "Archery Range III", category: "military", age: "first", level: 3, maxLevel: 3, modelPath: "/models/rts_quaternius/Archery_FirstAge_Level3.glb",  cost: { wood: 150, stone: 60, gold: 50 }, size: [4, 4], description: "Elite archery training.",    spawnAlly: "archer",       allyCount: 4 },
  { id: "archery_2a_l1", faction: "fabled", name: "Grand Archery",    category: "military", age: "second", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Archery_SecondAge_Level1.glb", cost: { wood: 120, stone: 60, gold: 40 }, size: [5, 5], description: "Elite elven archers.",       spawnAlly: "elite_archer", allyCount: 3, unlockRequirement: "second_age" },
  { id: "ranger_lodge",   faction: "fabled", name: "Ranger Lodge",     category: "military", age: "first",  level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Archery_FirstAge_Level2.glb",  cost: { wood: 70,  stone: 30, gold: 25 }, size: [4, 4], description: "Trains rangers that scout and harvest.", spawnAlly: "ranger",    allyCount: 2 },

  // ── LEGION: Military ─────────────────────────────────────────────────────
  // Orc/Undead faction buildings — brute melee and dark sorcery.
  { id: "warrior_hall",   faction: "legion", name: "Warrior Hall",   category: "military", age: "first",  level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Barracks_FirstAge_Level2.glb",   cost: { wood: 100, stone: 50,  gold:  30 }, size: [5, 5], description: "Trains orc berserkers.",             spawnAlly: "warrior", allyCount: 2 },
  { id: "wizard_sanctum", faction: "legion", name: "Wizard Sanctum", category: "military", age: "second", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Temple_FirstAge_Level1.glb",    cost: { wood: 100, stone: 80,  gold:  80 }, size: [5, 5], description: "Trains undead sorcerers with area buffs.", spawnAlly: "wizard",  allyCount: 1, unlockRequirement: "second_age" },
];

const STARTER_UNLOCKS = new Set([
  "watchtower_1a_l1", "wall_1a", "walltower_1a", "gate_1a",
  "archery_1a_l1", "barracks_1a_l1",
  "farm_1a_l1", "market_1a_l1", "storage_1a_l1",
  "house_1a_1_l1", "house_1a_2_l1", "house_1a_3_l1",
  "windmill_1a",
  "farm_workers", "warrior_hall", "ranger_lodge",
  "camp", "lumber_camp", "herb_garden", "mining_outpost",
]);

export const useBuildSystem = create<BuildSystemState>((set, get) => ({
  resources: { wood: 200, stone: 150, gold: 100 },
  unlockedBuildings: STARTER_UNLOCKS,
  placedBuildings: [],
  buildMode: false,
  selectedBuildingId: null,
  ghostPosition: null,
  ghostRotation: 0,

  toggleBuildMode: () => set(s => ({ buildMode: !s.buildMode, selectedBuildingId: null, ghostPosition: null })),

  selectBuilding: (id) => set({ selectedBuildingId: id, ghostPosition: null }),

  setGhostPosition: (pos) => set({ ghostPosition: pos }),

  rotateGhost: () => set(s => ({ ghostRotation: (s.ghostRotation + Math.PI / 2) % (Math.PI * 2) })),

  placeBuilding: () => {
    const { selectedBuildingId, ghostPosition, ghostRotation, resources } = get();
    if (!selectedBuildingId || !ghostPosition) return false;
    const def = BUILDING_REGISTRY.find(b => b.id === selectedBuildingId);
    if (!def) return false;
    if (resources.wood < def.cost.wood || resources.stone < def.cost.stone || resources.gold < def.cost.gold) return false;

    const uid = `building_${++buildingUidCounter}_${Date.now()}`;
    const placed: PlacedBuilding = {
      uid,
      defId: def.id,
      position: [...ghostPosition],
      rotation: ghostRotation,
      level: def.level,
      health: 100 + def.level * 50,
      maxHealth: 100 + def.level * 50,
    };

    set(s => ({
      resources: {
        wood: s.resources.wood - def.cost.wood,
        stone: s.resources.stone - def.cost.stone,
        gold: s.resources.gold - def.cost.gold,
      },
      placedBuildings: [...s.placedBuildings, placed],
      ghostPosition: null,
    }));
    return true;
  },

  removeBuilding: (uid) => {
    useAllies.getState().removeAlliesForBuilding(uid);
    _onBuildingRemoved?.(uid);
    set(s => ({
      placedBuildings: s.placedBuildings.filter(b => b.uid !== uid),
    }));
  },

  upgradeBuilding: (uid) => {
    const { placedBuildings, resources } = get();
    const building = placedBuildings.find(b => b.uid === uid);
    if (!building) return false;
    const def = BUILDING_REGISTRY.find(b => b.id === building.defId);
    if (!def || building.level >= def.maxLevel) return false;
    const upgradeCost = { wood: def.cost.wood * 1.5, stone: def.cost.stone * 1.5, gold: def.cost.gold * 1.5 };
    if (resources.wood < upgradeCost.wood || resources.stone < upgradeCost.stone || resources.gold < upgradeCost.gold) return false;

    set(s => ({
      resources: {
        wood: s.resources.wood - upgradeCost.wood,
        stone: s.resources.stone - upgradeCost.stone,
        gold: s.resources.gold - upgradeCost.gold,
      },
      placedBuildings: s.placedBuildings.map(b =>
        b.uid === uid ? { ...b, level: b.level + 1, health: b.maxHealth + 50, maxHealth: b.maxHealth + 50 } : b
      ),
    }));
    return true;
  },

  addResources: (wood, stone, gold) => set(s => ({
    resources: {
      wood: s.resources.wood + wood,
      stone: s.resources.stone + stone,
      gold: s.resources.gold + gold,
    },
  })),

  unlockBuilding: (id) => set(s => {
    const newSet = new Set(s.unlockedBuildings);
    newSet.add(id);
    return { unlockedBuildings: newSet };
  }),

  damageBuilding: (uid, amount) => {
    const building = get().placedBuildings.find(b => b.uid === uid);
    if (building && building.health - amount <= 0) {
      useAllies.getState().removeAlliesForBuilding(uid);
      _onBuildingRemoved?.(uid);
    }
    set(s => ({
      placedBuildings: s.placedBuildings
        .map(b => b.uid === uid ? { ...b, health: Math.max(0, b.health - amount) } : b)
        .filter(b => b.health > 0),
    }));
  },
}));

export function getBuildingDef(id: string): BuildingDef | undefined {
  return BUILDING_REGISTRY.find(b => b.id === id);
}

export function getBuildingsByCategory(cat: BuildingCategory): BuildingDef[] {
  return BUILDING_REGISTRY.filter(b => b.category === cat);
}
