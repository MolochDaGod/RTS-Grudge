import { create } from "zustand";
import { useAllies } from "./useAllies";

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
  /** Legacy single-key unlock (kept for second_age gate) */
  unlockRequirement?: string;
  /** Building ids that must be placed before this one can be built.
   *  Empty array or undefined = no building prerequisites. */
  requires?: string[];
  spawnAlly?: string;
  allyCount?: number;
  spawnResources?: SpawnResourceDef[];
  /** If true, this is a quick-craft item (no station, built from inventory) */
  quickCraft?: boolean;
  /** Race restriction — only this race can build it (null = any race) */
  raceOnly?: string;
  /** Faction restriction — only this faction can build it */
  factionOnly?: string;
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

/** Grid cell size in world units. Buildings snap to multiples of this. */
export const BUILD_GRID_SIZE = 2;

/** Minimum distance from world origin buildings can be placed. */
export const BUILD_MIN_RADIUS = 8;

/** Maximum distance from world origin buildings can be placed (zone boundary). */
export const BUILD_MAX_RADIUS = 80;

interface BuildSystemState {
  resources: { wood: number; stone: number; gold: number };
  unlockedBuildings: Set<string>;
  placedBuildings: PlacedBuilding[];
  buildMode: boolean;
  selectedBuildingId: string | null;
  ghostPosition: [number, number, number] | null;
  ghostRotation: number;
  /** True when the current ghost position is a valid placement. */
  ghostValid: boolean;

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
  /** Snap a world position to the build grid. */
  snapToGrid: (x: number, z: number) => [number, number];
  /** Check whether the ghost can be placed at its current position. */
  canPlaceAtGhost: () => boolean;
}

let buildingUidCounter = 0;

export const BUILDING_REGISTRY: BuildingDef[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // TIER 0 — Quick Craft (no station, no building prereqs unless noted)
  // ══════════════════════════════════════════════════════════════════════════
  { id: "claim_flag", name: "Claim Flag", category: "special", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/WallTowers_FirstAge.glb", cost: { wood: 5, stone: 0, gold: 0 }, size: [1, 1], description: "Plant your faction banner. Smallest territory claim (15m).", quickCraft: true },
  { id: "campfire", name: "Campfire", category: "economy", age: "first", level: 1, maxLevel: 1, modelPath: "/models/structures/Camp_fire.glb", cost: { wood: 3, stone: 1, gold: 0 }, size: [1, 1], description: "Cook basic food. Grilled fish, roasted meat.", quickCraft: true },
  { id: "crafting_bench", name: "Crafting Bench", category: "economy", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Storage_FirstAge_Level1.glb", cost: { wood: 10, stone: 5, gold: 0 }, size: [2, 2], description: "Basic crafting station. Unlocks T1 refining.", quickCraft: true },
  { id: "wood_fence", name: "Wood Fence", category: "defense", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Wall_FirstAge.glb", cost: { wood: 3, stone: 0, gold: 0 }, size: [3, 1], description: "Light wooden fence. Decorative boundary.", quickCraft: true },
  { id: "small_box", name: "Small Box", category: "economy", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Crate.glb", cost: { wood: 5, stone: 0, gold: 0 }, size: [1, 1], description: "Small storage container.", quickCraft: true },
  { id: "large_box", name: "Large Box", category: "economy", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Crate_Big_Stack2.glb", cost: { wood: 10, stone: 2, gold: 0 }, size: [2, 2], description: "Large storage container.", quickCraft: true },
  { id: "chair", name: "Chair", category: "housing", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Barrel.glb", cost: { wood: 3, stone: 0, gold: 0 }, size: [1, 1], description: "Sit and rest. Restores stamina faster.", quickCraft: true },
  { id: "ladder", name: "Ladder", category: "special", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Logs.glb", cost: { wood: 5, stone: 0, gold: 0 }, size: [1, 1], description: "Reach high places.", quickCraft: true },

  // ── Race Houses (quick craft, requires claim_flag) ─────────────────────
  { id: "house_human",     name: "Human Cabin",      category: "housing", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Houses_FirstAge_1_Level1.glb", cost: { wood: 20, stone: 10, gold: 5 }, size: [3, 3], description: "Human dwelling. Provides 1 housing slot.",      quickCraft: true, requires: ["claim_flag"], raceOnly: "human" },
  { id: "house_elf",       name: "Elf Cabin",        category: "housing", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Houses_FirstAge_2_Level1.glb", cost: { wood: 20, stone: 10, gold: 5 }, size: [3, 3], description: "Elven bower. Provides 1 housing slot.",          quickCraft: true, requires: ["claim_flag"], raceOnly: "elf" },
  { id: "house_dwarf",     name: "Dwarf Cabin",      category: "housing", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Houses_FirstAge_3_Level1.glb", cost: { wood: 15, stone: 15, gold: 5 }, size: [3, 3], description: "Dwarven stone lodge. Provides 1 housing slot.",  quickCraft: true, requires: ["claim_flag"], raceOnly: "dwarf" },
  { id: "house_orc",       name: "Orc Hut",          category: "housing", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Houses_FirstAge_1_Level1.glb", cost: { wood: 20, stone: 10, gold: 5 }, size: [3, 3], description: "Orcish war hut. Provides 1 housing slot.",       quickCraft: true, requires: ["claim_flag"], raceOnly: "orc" },
  { id: "house_barbarian", name: "Barbarian Cabin",   category: "housing", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Houses_FirstAge_2_Level1.glb", cost: { wood: 20, stone: 10, gold: 5 }, size: [3, 3], description: "Bone and hide shelter. Provides 1 housing slot.", quickCraft: true, requires: ["claim_flag"], raceOnly: "barbarian" },
  { id: "house_undead",    name: "Undead Crypt",      category: "housing", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Houses_FirstAge_3_Level1.glb", cost: { wood: 10, stone: 20, gold: 5 }, size: [3, 3], description: "Dark crypt shelter. Provides 1 housing slot.",   quickCraft: true, requires: ["claim_flag"], raceOnly: "undead" },

  // ── Crafting Stations (quick craft, requires crafting_bench) ───────────
  { id: "foundry",   name: "Foundry",   category: "economy", age: "first", level: 1, maxLevel: 1, modelPath: "/models/structures/Forge.glb",         cost: { wood: 15, stone: 15, gold: 5 }, size: [2, 2], description: "Smelt ores into ingots.",          quickCraft: true, requires: ["crafting_bench"] },
  { id: "furnace",   name: "Furnace",   category: "economy", age: "first", level: 1, maxLevel: 1, modelPath: "/models/structures/Forge.glb",         cost: { wood: 10, stone: 20, gold: 5 }, size: [2, 2], description: "Advanced smelting. Higher tier ores.", quickCraft: true, requires: ["crafting_bench"] },
  { id: "refinery",  name: "Refinery",  category: "economy", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Storage_FirstAge_Level1.glb", cost: { wood: 15, stone: 10, gold: 5 }, size: [2, 2], description: "Refine raw materials.", quickCraft: true, requires: ["crafting_bench"] },
  { id: "saw_mill",  name: "Saw Mill",  category: "economy", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Storage_FirstAge_Level2.glb", cost: { wood: 20, stone: 5, gold: 5 },  size: [3, 2], description: "Process logs into planks.",       quickCraft: true, requires: ["crafting_bench"] },
  { id: "tannery",   name: "Tannery",   category: "economy", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Storage_FirstAge_Level1.glb", cost: { wood: 15, stone: 5, gold: 5 },  size: [2, 2], description: "Tan hides into leather.",         quickCraft: true, requires: ["crafting_bench"] },

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 1 — Camp (requires claim_flag)
  // ══════════════════════════════════════════════════════════════════════════
  { id: "camp", name: "Camp", category: "economy", age: "first", level: 1, maxLevel: 2, modelPath: "/models/rts_quaternius/Farm_FirstAge_Level1.glb", cost: { wood: 20, stone: 10, gold: 0 }, size: [4, 4], description: "Basic camp. Grows berry bushes and fiber around it.", requires: ["claim_flag"], spawnResources: [{ type: "berry", count: 4 }, { type: "fiber", count: 3 }, { type: "herb", count: 2 }] },
  { id: "farm_1a_l1", name: "Farm", category: "economy", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Farm_FirstAge_Level1.glb", cost: { wood: 30, stone: 10, gold: 5 }, size: [4, 4], description: "Produces food. Grows herbs and berries.", requires: ["claim_flag"], spawnResources: [{ type: "herb", count: 3 }, { type: "berry", count: 3 }] },
  { id: "storage_1a_l1", name: "Storage", category: "economy", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Storage_FirstAge_Level1.glb", cost: { wood: 30, stone: 15, gold: 5 }, size: [3, 3], description: "Stores resources.", requires: ["claim_flag"] },

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 2 — Military & Economy (requires crafting_bench + house)
  // ══════════════════════════════════════════════════════════════════════════
  { id: "barracks_1a_l1", name: "Barracks", category: "military", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Barracks_FirstAge_Level1.glb", cost: { wood: 80, stone: 40, gold: 20 }, size: [5, 5], description: "Trains melee soldiers.", requires: ["crafting_bench", "house_human"], spawnAlly: "soldier", allyCount: 2 },
  { id: "archery_1a_l1", name: "Archery Range", category: "military", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Archery_FirstAge_Level1.glb", cost: { wood: 60, stone: 20, gold: 15 }, size: [4, 4], description: "Trains archer allies.", requires: ["crafting_bench", "house_human"], spawnAlly: "archer", allyCount: 2 },
  { id: "farm_workers", name: "Farmer's Hut", category: "economy", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Farm_FirstAge_Level2.glb", cost: { wood: 40, stone: 15, gold: 10 }, size: [3, 3], description: "Recruit farmers that auto-harvest resources.", requires: ["farm_1a_l1"], spawnAlly: "farmer", allyCount: 2 },
  { id: "lumber_camp", name: "Lumber Yard", category: "economy", age: "first", level: 1, maxLevel: 2, modelPath: "/models/rts_quaternius/Storage_FirstAge_Level1.glb", cost: { wood: 50, stone: 20, gold: 5 }, size: [3, 3], description: "Spawns wood and fiber nodes.", requires: ["archery_1a_l1"], spawnResources: [{ type: "wood", count: 6 }, { type: "fiber", count: 3 }] },
  { id: "blacksmith", name: "Blacksmith", category: "economy", age: "first", level: 1, maxLevel: 3, modelPath: "/models/structures/Forge.glb", cost: { wood: 40, stone: 60, gold: 30 }, size: [4, 3], description: "Smithing Table. Craft T1-T4 weapons and armor.", requires: ["barracks_1a_l1"] },
  { id: "market_1a_l1", name: "Market", category: "economy", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Market_FirstAge_Level1.glb", cost: { wood: 40, stone: 20, gold: 15 }, size: [4, 3], description: "Trade post. Generates gold.", requires: ["crafting_bench", "house_human"] },

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 3 — Defensive & Faction (requires bench + house + barracks + archery)
  // ══════════════════════════════════════════════════════════════════════════
  { id: "watchtower_1a_l1", name: "Watch Tower", category: "defense", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/WatchTower_FirstAge_Level1.glb", cost: { wood: 50, stone: 30, gold: 10 }, size: [3, 3], description: "Defensive tower with archer garrison.", requires: ["crafting_bench", "house_human", "barracks_1a_l1", "archery_1a_l1"] },
  { id: "wall_1a", name: "Stone Wall", category: "defense", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Wall_FirstAge.glb", cost: { wood: 10, stone: 20, gold: 0 }, size: [4, 1], description: "Stone wall segment.", requires: ["crafting_bench", "house_human"] },
  { id: "gate_1a", name: "Gate", category: "defense", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/WallTowers_Door_FirstAge.glb", cost: { wood: 40, stone: 50, gold: 15 }, size: [4, 3], description: "Gated wall entrance.", requires: ["wall_1a"] },
  { id: "walltower_1a", name: "Wall Tower", category: "defense", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/WallTowers_FirstAge.glb", cost: { wood: 30, stone: 40, gold: 10 }, size: [3, 3], description: "Fortified wall corner tower.", requires: ["wall_1a"] },
  { id: "temple_1a_l1", name: "Temple", category: "special", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Temple_FirstAge_Level1.glb", cost: { wood: 60, stone: 80, gold: 40 }, size: [5, 5], description: "Sacred temple. Unlocks healing and mage training.", requires: ["crafting_bench", "house_human", "barracks_1a_l1", "archery_1a_l1"] },
  // Faction Tents — Tier 3, unlocks dock/laboratory/arsenal/stronghold
  { id: "tent_crusade", name: "Crusade Tent", category: "special", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/TowerHouse_FirstAge.glb", cost: { wood: 60, stone: 40, gold: 30 }, size: [4, 4], description: "Crusade command post. Unlocks Dock, Laboratory, Arsenal, and Stronghold buildings.", requires: ["house_human", "barracks_1a_l1", "archery_1a_l1"], factionOnly: "crusade" },
  { id: "tent_fabled", name: "Fabled Tent", category: "special", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/TowerHouse_FirstAge.glb", cost: { wood: 60, stone: 40, gold: 30 }, size: [4, 4], description: "Fabled command post. Unlocks Dock, Laboratory, Arsenal, and Stronghold buildings.", requires: ["house_elf", "barracks_1a_l1", "archery_1a_l1"], factionOnly: "fabled" },
  { id: "tent_legion", name: "Legion Tent", category: "special", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/TowerHouse_FirstAge.glb", cost: { wood: 60, stone: 40, gold: 30 }, size: [4, 4], description: "Legion command post. Unlocks Dock, Laboratory, Arsenal, and Stronghold buildings.", requires: ["house_orc", "barracks_1a_l1", "archery_1a_l1"], factionOnly: "legion" },
  { id: "windmill_1a", name: "Windmill", category: "economy", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Windmill_FirstAge.glb", cost: { wood: 50, stone: 20, gold: 10 }, size: [3, 3], description: "Generates food from nearby farms.", requires: ["farm_1a_l1"] },
  { id: "herb_garden", name: "Herb Garden", category: "economy", age: "first", level: 1, maxLevel: 2, modelPath: "/models/rts_quaternius/Farm_FirstAge_Level1.glb", cost: { wood: 25, stone: 10, gold: 10 }, size: [3, 3], description: "Cultivated garden. Grows herbs and berries.", requires: ["farm_1a_l1"], spawnResources: [{ type: "herb", count: 5 }, { type: "berry", count: 4 }] },
  { id: "mining_outpost", name: "Mining Outpost", category: "economy", age: "first", level: 1, maxLevel: 2, modelPath: "/models/rts_quaternius/Storage_FirstAge_Level1.glb", cost: { wood: 30, stone: 30, gold: 10 }, size: [3, 3], description: "Spawns stone and iron ore deposits.", requires: ["crafting_bench"], spawnResources: [{ type: "stone", count: 4 }, { type: "iron_ore", count: 3 }] },
  { id: "warrior_hall", name: "Warrior Hall", category: "military", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Barracks_FirstAge_Level2.glb", cost: { wood: 100, stone: 50, gold: 30 }, size: [5, 5], description: "Trains powerful melee warriors.", requires: ["barracks_1a_l1", "blacksmith"], spawnAlly: "warrior", allyCount: 2 },
  { id: "ranger_lodge", name: "Ranger Lodge", category: "military", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Archery_FirstAge_Level2.glb", cost: { wood: 70, stone: 30, gold: 25 }, size: [4, 4], description: "Trains rangers that patrol and harvest.", requires: ["archery_1a_l1", "lumber_camp"], spawnAlly: "ranger", allyCount: 2 },

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 4 — Advanced (requires temple + blacksmith)
  // ══════════════════════════════════════════════════════════════════════════
  { id: "mage_tower", name: "Mage Tower", category: "military", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/WatchTower_SecondAge_Level1.glb", cost: { wood: 80, stone: 60, gold: 50 }, size: [4, 4], description: "Trains mages with ranged fire attacks.", requires: ["temple_1a_l1", "blacksmith"], spawnAlly: "mage", allyCount: 2 },
  { id: "wizard_sanctum", name: "Wizard Sanctum", category: "military", age: "first", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Temple_FirstAge_Level1.glb", cost: { wood: 100, stone: 80, gold: 80 }, size: [5, 5], description: "Trains wizards with area buffs and lightning.", requires: ["temple_1a_l1", "mage_tower"], spawnAlly: "wizard", allyCount: 1 },
  { id: "workshop", name: "Workshop", category: "economy", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Storage_FirstAge_Level2.glb", cost: { wood: 80, stone: 60, gold: 40 }, size: [4, 3], description: "Tinker Table. Craft crossbows, guns, turrets, siege.", requires: ["blacksmith", "lumber_camp"] },
  { id: "dock_1a", name: "Dock", category: "economy", age: "first", level: 1, maxLevel: 2, modelPath: "/models/rts_quaternius/Dock_FirstAge.glb", cost: { wood: 60, stone: 30, gold: 20 }, size: [4, 6], description: "Build and dock ships.", requires: ["tent_crusade"] },

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 5 — Town Center (Age Up)
  // ══════════════════════════════════════════════════════════════════════════
  { id: "towncenter_1a_l1", name: "Town Center", category: "special", age: "first", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/TownCenter_FirstAge_Level1.glb", cost: { wood: 100, stone: 60, gold: 30 }, size: [6, 6], description: "Central hub. Unlocks Second Age buildings.", requires: ["house_human", "barracks_1a_l1", "archery_1a_l1", "temple_1a_l1", "blacksmith"], unlockRequirement: "second_age" },

  // ══════════════════════════════════════════════════════════════════════════
  // TIER 6 — Second Age
  // ══════════════════════════════════════════════════════════════════════════
  { id: "watchtower_2a_l1", name: "Guard Tower", category: "defense", age: "second", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/WatchTower_SecondAge_Level1.glb", cost: { wood: 100, stone: 60, gold: 30 }, size: [3, 3], description: "Advanced defensive tower.", unlockRequirement: "second_age", requires: ["towncenter_1a_l1"] },
  { id: "barracks_2a_l1", name: "Grand Barracks", category: "military", age: "second", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Barracks_SecondAge_Level1.glb", cost: { wood: 150, stone: 80, gold: 50 }, size: [6, 6], description: "Elite soldiers.", spawnAlly: "knight", allyCount: 3, unlockRequirement: "second_age", requires: ["towncenter_1a_l1"] },
  { id: "archery_2a_l1", name: "Grand Archery", category: "military", age: "second", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Archery_SecondAge_Level1.glb", cost: { wood: 120, stone: 60, gold: 40 }, size: [5, 5], description: "Elite archers.", spawnAlly: "elite_archer", allyCount: 3, unlockRequirement: "second_age", requires: ["towncenter_1a_l1"] },
  { id: "captain_quarters", name: "Captain's Quarters", category: "military", age: "second", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/TownCenter_FirstAge_Level1.glb", cost: { wood: 150, stone: 100, gold: 100 }, size: [6, 6], description: "Recruits a Captain that buffs nearby allies.", spawnAlly: "captain", allyCount: 1, unlockRequirement: "second_age", requires: ["towncenter_1a_l1"] },
  { id: "crystal_grove", name: "Crystal Grove", category: "economy", age: "second", level: 1, maxLevel: 1, modelPath: "/models/rts_quaternius/Temple_FirstAge_Level1.glb", cost: { wood: 60, stone: 60, gold: 40 }, size: [4, 4], description: "Grows crystals and gold ore.", spawnResources: [{ type: "crystal", count: 3 }, { type: "gold_ore", count: 2 }], unlockRequirement: "second_age", requires: ["towncenter_1a_l1"] },
  { id: "wonder_1a_l1", name: "Wonder", category: "special", age: "second", level: 1, maxLevel: 3, modelPath: "/models/rts_quaternius/Wonder_FirstAge_Level1.glb", cost: { wood: 200, stone: 200, gold: 100 }, size: [8, 8], description: "Legendary structure. Victory monument.", unlockRequirement: "second_age", requires: ["towncenter_1a_l1"] },
];

// All buildings are visible in the menu — requirements gate placement, not visibility.
// This lets tooltips show "Requires: X" on locked items.
const STARTER_UNLOCKS = new Set(
  BUILDING_REGISTRY.map(b => b.id),
);

// ── Collision helpers ──────────────────────────────────────────────────────

/** Get the AABB footprint of a building at a position, accounting for rotation. */
function getBuildingAABB(
  pos: [number, number, number],
  size: [number, number],
  rotation: number,
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  // After 90° or 270° rotation, width and depth swap.
  const rotSteps = Math.round(rotation / (Math.PI / 2)) % 4;
  const [w, d] = (rotSteps === 1 || rotSteps === 3) ? [size[1], size[0]] : [size[0], size[1]];
  const hw = w / 2;
  const hd = d / 2;
  return {
    minX: pos[0] - hw,
    maxX: pos[0] + hw,
    minZ: pos[2] - hd,
    maxZ: pos[2] + hd,
  };
}

function aabbOverlap(
  a: { minX: number; maxX: number; minZ: number; maxZ: number },
  b: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/** Check if a candidate building overlaps any existing placed building. */
function checkBuildingCollision(
  candidatePos: [number, number, number],
  candidateSize: [number, number],
  candidateRotation: number,
  placedBuildings: PlacedBuilding[],
): boolean {
  const candidateAABB = getBuildingAABB(candidatePos, candidateSize, candidateRotation);
  for (const placed of placedBuildings) {
    const placedDef = BUILDING_REGISTRY.find(b => b.id === placed.defId);
    if (!placedDef) continue;
    const placedAABB = getBuildingAABB(placed.position, placedDef.size, placed.rotation);
    if (aabbOverlap(candidateAABB, placedAABB)) return true;
  }
  return false;
}

/** Check if a position is within the buildable zone. */
function isInBuildZone(pos: [number, number, number]): boolean {
  const dist = Math.sqrt(pos[0] * pos[0] + pos[2] * pos[2]);
  return dist >= BUILD_MIN_RADIUS && dist <= BUILD_MAX_RADIUS;
}

export const useBuildSystem = create<BuildSystemState>((set, get) => ({
  resources: { wood: 200, stone: 150, gold: 100 },
  unlockedBuildings: STARTER_UNLOCKS,
  placedBuildings: [],
  buildMode: false,
  selectedBuildingId: null,
  ghostPosition: null,
  ghostRotation: 0,
  ghostValid: false,

  toggleBuildMode: () => set(s => ({ buildMode: !s.buildMode, selectedBuildingId: null, ghostPosition: null, ghostValid: false })),

  selectBuilding: (id) => set({ selectedBuildingId: id, ghostPosition: null, ghostValid: false }),

  snapToGrid: (x, z) => {
    const snappedX = Math.round(x / BUILD_GRID_SIZE) * BUILD_GRID_SIZE;
    const snappedZ = Math.round(z / BUILD_GRID_SIZE) * BUILD_GRID_SIZE;
    return [snappedX, snappedZ];
  },

  setGhostPosition: (pos) => {
    if (!pos) {
      set({ ghostPosition: null, ghostValid: false });
      return;
    }
    // Snap to grid
    const [sx, sz] = get().snapToGrid(pos[0], pos[2]);
    const snapped: [number, number, number] = [sx, pos[1], sz];

    // Validate placement
    const { selectedBuildingId, ghostRotation, placedBuildings, resources } = get();
    let valid = true;
    if (selectedBuildingId) {
      const def = BUILDING_REGISTRY.find(b => b.id === selectedBuildingId);
      if (def) {
        // Check zone bounds
        if (!isInBuildZone(snapped)) valid = false;
        // Check resource cost
        if (resources.wood < def.cost.wood || resources.stone < def.cost.stone || resources.gold < def.cost.gold) valid = false;
        // Check collision with existing buildings
        if (checkBuildingCollision(snapped, def.size, ghostRotation, placedBuildings)) valid = false;
      } else {
        valid = false;
      }
    } else {
      valid = false;
    }

    set({ ghostPosition: snapped, ghostValid: valid });
  },

  canPlaceAtGhost: () => {
    return get().ghostValid;
  },

  rotateGhost: () => {
    const newRotation = (get().ghostRotation + Math.PI / 2) % (Math.PI * 2);
    set({ ghostRotation: newRotation });
    // Re-validate after rotation
    const { ghostPosition } = get();
    if (ghostPosition) get().setGhostPosition(ghostPosition);
  },

  placeBuilding: () => {
    const { selectedBuildingId, ghostPosition, ghostRotation, resources, ghostValid } = get();
    if (!selectedBuildingId || !ghostPosition || !ghostValid) return false;
    const def = BUILDING_REGISTRY.find(b => b.id === selectedBuildingId);
    if (!def) return false;
    if (resources.wood < def.cost.wood || resources.stone < def.cost.stone || resources.gold < def.cost.gold) return false;
    // Final collision check (in case state changed between last setGhostPosition and click)
    if (checkBuildingCollision(ghostPosition, def.size, ghostRotation, get().placedBuildings)) return false;
    if (!isInBuildZone(ghostPosition)) return false;

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
      ghostValid: false,
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

// ── Requirement checking ────────────────────────────────────────────────────

export interface RequirementResult {
  met: boolean;
  reasons: string[];
}

/**
 * Check all requirements for placing a building.
 * Returns { met: true } if all good, or { met: false, reasons: [...] }
 * with human-readable tooltip strings for each unmet condition.
 */
export function checkRequirements(
  def: BuildingDef,
  placedBuildings: PlacedBuilding[],
  resources: { wood: number; stone: number; gold: number },
  playerRace?: string,
  playerFaction?: string,
): RequirementResult {
  const reasons: string[] = [];
  const placedDefIds = new Set(placedBuildings.map(b => b.defId));

  // Resource costs
  if (resources.wood < def.cost.wood) {
    reasons.push(`Need ${def.cost.wood} Wood (have ${Math.floor(resources.wood)})`);
  }
  if (resources.stone < def.cost.stone) {
    reasons.push(`Need ${def.cost.stone} Stone (have ${Math.floor(resources.stone)})`);
  }
  if (resources.gold < def.cost.gold) {
    reasons.push(`Need ${def.cost.gold} Gold (have ${Math.floor(resources.gold)})`);
  }

  // Building prerequisites
  if (def.requires && def.requires.length > 0) {
    for (const reqId of def.requires) {
      if (!placedDefIds.has(reqId)) {
        const reqDef = getBuildingDef(reqId);
        const reqName = reqDef?.name ?? reqId;
        reasons.push(`Requires: ${reqName}`);
      }
    }
  }

  // Legacy second_age gate
  if (def.unlockRequirement === "second_age") {
    const hasTownCenter = placedBuildings.some(b => b.defId.startsWith("towncenter"));
    if (!hasTownCenter) {
      reasons.push("Requires: Town Center (Second Age)");
    }
  }

  // Race restriction
  if (def.raceOnly && playerRace && def.raceOnly !== playerRace) {
    reasons.push(`Only available to ${def.raceOnly} race`);
  }

  // Faction restriction
  if (def.factionOnly && playerFaction && def.factionOnly !== playerFaction) {
    reasons.push(`Only available to ${def.factionOnly} faction`);
  }

  return { met: reasons.length === 0, reasons };
}

/**
 * Get a single tooltip string for why a building can't be placed.
 * Returns null if all requirements are met.
 */
export function getBlockedReason(
  defId: string,
  placedBuildings: PlacedBuilding[],
  resources: { wood: number; stone: number; gold: number },
  playerRace?: string,
  playerFaction?: string,
): string | null {
  const def = getBuildingDef(defId);
  if (!def) return "Unknown building";
  const result = checkRequirements(def, placedBuildings, resources, playerRace, playerFaction);
  if (result.met) return null;
  return result.reasons.join(" • ");
}
