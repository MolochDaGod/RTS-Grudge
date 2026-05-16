/**
 * WorldObjectRegistry — single source of truth for all placed world buildings.
 *
 * Both `World.tsx` (rendering) and `BuildingColliders.tsx` (physics) derive
 * from this registry. Previously they maintained parallel hardcoded coordinate
 * lists that drifted out of sync whenever a building was moved.
 *
 * Each entry declares:
 *   id          — unique stable identifier
 *   district    — logical neighbourhood from DistrictRegistry
 *   type        — visual/semantic category
 *   modelPath   — GLB/GLTF file for World.tsx to render
 *   position    — world XZ; Y is derived via getTerrainHeight at render time
 *   rotation    — Euler Y rotation (radians)
 *   targetHeight — normalised model height (metres)
 *   collision   — optional cuboid size [w,h,d] for BuildingColliders physics
 *   mapIcon     — emoji shown on world map when zoomed in
 *   interaction — how the player can interact with this building
 *
 * Adding a new building: add one entry here. Both visual and physics update
 * automatically. No more editing two files.
 */

import type { DistrictId } from "./DistrictRegistry";

// ─────────────────────────────────────────────────────────────────────────────

export type ObjectType =
  | "building_medieval"
  | "building_rts"
  | "building_elf"
  | "building_structure"
  | "prop_dock"
  | "prop_statue"
  | "prop_religious"
  | "prop_military"
  | "landmark";

export type InteractionType =
  | "none"
  | "vendor"
  | "talk"
  | "quest_board"
  | "repair"
  | "inn"
  | "smithy"
  | "tavern";

export interface WorldObjectEntry {
  id: string;
  district: DistrictId;
  type: ObjectType;
  modelPath: string;
  /** World XZ. Y is snapped to terrain height at render time. */
  x: number;
  z: number;
  rotY: number;
  targetHeight: number;
  /** Cuboid collider [w, h, d]. Omit for decoration-only objects. */
  collision?: [number, number, number];
  mapIcon?: string;
  interaction: InteractionType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact builder
// ─────────────────────────────────────────────────────────────────────────────

type E = [
  id: string, district: DistrictId, type: ObjectType,
  model: string, x: number, z: number, rotY: number, h: number,
  col: [number, number, number] | null,
  icon: string, interaction: InteractionType,
];

function e(...args: E): WorldObjectEntry {
  return {
    id: args[0], district: args[1], type: args[2],
    modelPath: args[3], x: args[4], z: args[5],
    rotY: args[6], targetHeight: args[7],
    ...(args[8] ? { collision: args[8] } : {}),
    ...(args[9] ? { mapIcon: args[9] } : {}),
    interaction: args[10],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// All placed world objects
// ─────────────────────────────────────────────────────────────────────────────

export const WORLD_OBJECTS: WorldObjectEntry[] = [

  // ── TOWN MEDIEVAL ────────────────────────────────────────────────────────
  // Central settlement buildings with collision boxes

  e("med_tavern",   "town_medieval", "building_medieval", "/models/medieval/Tavern.glb",         -15,-25, 0.8, 10, [6,10,6],  "🍺", "tavern"),
  e("med_inn",      "town_medieval", "building_medieval", "/models/medieval/Fantasy Inn.glb",      15,-20, 2.2, 11, [6,11,6],  "🛏️", "inn"),
  e("med_blacksmith","town_medieval","building_medieval", "/models/medieval/Blacksmith.glb",      -12, 20, 1.5,  8, [5, 8,5],  "⚒️", "smithy"),
  e("med_mill",     "town_medieval", "building_medieval", "/models/medieval/Mill.glb",            -30,-10, 0.3, 12, [6,12,6],  "⚙️", "none"),
  e("med_windmill", "town_medieval", "building_medieval", "/models/medieval/Windmill.glb",         30,-40, 1.0, 14, [4,14,4],  "🌀", "none"),
  e("med_barracks", "town_medieval", "building_medieval", "/models/medieval/Fantasy Barracks.glb",-35, 15, 2.1,  9, [6, 9,6],  "⚔️", "none"),
  e("med_tower",    "town_medieval", "building_medieval", "/models/medieval/Bell Tower.glb",        0,-30, 0.0, 14, [3,14,3],  "🔔", "none"),
  e("med_well",     "town_medieval", "building_medieval", "/models/medieval/Wishing Well.glb",     18,  5, 0.0,  2.5, null,   "💧", "none"),
  e("med_gate",     "town_medieval", "building_medieval", "/models/medieval/Gate - Game Asset.glb", 0,-40, 0.0,  8, [7, 8,3],  "🚪", "none"),
  e("med_house1",   "town_medieval", "building_medieval", "/models/medieval/Fantasy House.glb",   -40,-35, 0.4, 10, [6,10,6],  "🏠", "none"),
  e("med_house2",   "town_medieval", "building_medieval", "/models/medieval/FantasyHouse2.glb",    50,-30, 2.8, 10, [6,10,6],  "🏠", "none"),
  e("med_house3",   "town_medieval", "building_medieval", "/models/medieval/FantasyHouse3.glb",   -50, 10, 1.6, 10, [6,10,6],  "🏠", "none"),

  // ── MARKET PLAZA ─────────────────────────────────────────────────────────

  e("rts_market",   "market_plaza",  "building_rts",      "/models/rts/Market Stalls.glb",        -10, 35, 0.0,  4, [8, 4,4],  "🛒", "vendor"),
  e("rts_farm1",    "market_plaza",  "building_rts",      "/models/rts/Farm.glb",                  45, 30, 0.8,  5, [8, 5,8],  "🌾", "none"),
  e("rts_farm2",    "market_plaza",  "building_rts",      "/models/rts/Farm.glb",                  50, 25, 0.0,  5, [8, 5,8],  "🌾", "none"),
  e("rts_town",     "market_plaza",  "building_rts",      "/models/rts/Town Center.glb",            0, 55, 0.0, 10, [6,10,6],  "🏛️", "quest_board"),
  e("rts_house",    "market_plaza",  "building_rts",      "/models/rts/House.glb",                -30, 50, 0.8,  8, [5, 8,5],  "🏠", "none"),

  // ── FORTRESS NW ──────────────────────────────────────────────────────────

  e("rts_castle",   "fortress_nw",   "building_rts",      "/models/rts/Castle.glb",               -60,-60, 0.5, 18, [12,18,12],"🏰", "quest_board"),
  e("str_tower",    "fortress_nw",   "building_structure","/models/structures/Castle_Tower.glb",  -58,-65, 0.4, 15, [6,15,6],  "🗼", "none"),
  e("str_crypt",    "fortress_nw",   "building_structure","/models/structures/Crypt.glb",          -62,-58, 0.3,  8, [5, 8,5],  "💀", "none"),
  e("str_cabin",    "fortress_nw",   "building_structure","/models/structures/Cabin_Shed.glb",     -38,-15, 0.6,  6, [4, 6,4],  "🏚️", "none"),
  e("str_forge",    "fortress_nw",   "building_structure","/models/structures/Forge.glb",          -10, 22, 2.8,  6, [4, 6,4],  "⚒️", "smithy"),

  // ── OUTPOST EAST ─────────────────────────────────────────────────────────

  e("rts_watchtower","outpost_east", "building_rts",      "/models/rts/Watch Tower.glb",            60,-60, 1.0, 12, [4,12,4],  "🗼", "none"),
  e("rts_fortress", "outpost_east",  "building_rts",      "/models/rts/Fortress.glb",               75,-35, 2.0, 15, [10,15,10],"🏯", "none"),
  e("str_barracks", "outpost_east",  "building_structure","/models/structures/Fantasy_Barracks.glb",68,-28, 1.8, 10, [6,10,6],  "⚔️", "none"),

  // ── WIDER WORLD ──────────────────────────────────────────────────────────

  e("rts_temple",   "wilderness_north","building_rts",    "/models/rts/Temple.glb",                70, 55, 3.0, 12, [7,12,7],  "⛩️", "talk"),
  e("rts_mine",     "wilderness_north","building_rts",    "/models/rts/Mine.glb",                  -75,-40, 1.2, 7, [5, 7,5],  "⛏️", "none"),
  e("str_coliseum", "wilderness_general","building_structure","/models/structures/Coliseum.glb",   85, 70, 0.0, 16, [12,16,12],"🏟️", "none"),
  e("str_camp",     "wilderness_general","building_structure","/models/structures/Camp_fire.glb",  -5, 10, 0.0, 1.5, null,     "🔥", "none"),

  // ── ELF VILLAGE BUILDINGS (env/ models) ──────────────────────────────────

  e("elf_tavern",   "town_medieval", "building_elf", "/models/environment/tavern.glb",             20,-30, 0.5, 10, [6,10,6],  "🏠", "inn"),
  e("elf_smithy",   "town_medieval", "building_elf", "/models/environment/smithy.glb",            -25, 25, 1.2, 10, [6,10,6],  "⚒️", "smithy"),
  e("elf_bakery",   "market_plaza",  "building_elf", "/models/environment/bakery.glb",             40, 15, 2.5, 10, [6,10,6],  "🥐", "vendor"),
  e("elf_herbalist","market_plaza",  "building_elf", "/models/environment/herbalist_shop.glb",    -55,-30, 0.8, 10, [6,10,6],  "🌿", "vendor"),
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getObjectById(id: string): WorldObjectEntry | undefined {
  return WORLD_OBJECTS.find((o) => o.id === id);
}

export function getObjectsByDistrict(district: DistrictId): WorldObjectEntry[] {
  return WORLD_OBJECTS.filter((o) => o.district === district);
}

/** Only entries that need a Rapier cuboid collider. */
export function getCollidableObjects(): WorldObjectEntry[] {
  return WORLD_OBJECTS.filter((o) => o.collision !== undefined);
}

/** Objects that should show a map icon (have mapIcon set). */
export function getMapIconObjects(): WorldObjectEntry[] {
  return WORLD_OBJECTS.filter((o) => o.mapIcon !== undefined);
}

/** Buildings that have a vendor/service interaction. */
export function getServiceBuildings(): WorldObjectEntry[] {
  return WORLD_OBJECTS.filter((o) => o.interaction !== "none");
}
