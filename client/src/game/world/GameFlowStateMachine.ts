/**
 * GameFlowStateMachine — Defines every rendering context and the transitions
 * between them for the MMO world.
 *
 * ## Rendering Contexts (what the player sees)
 *
 *   ZONE_OVERWORLD   — On a 4km×4km island. Terrain heightmap + scatter +
 *                      enemies + NPCs + resource nodes + buildings.
 *                      Scene: <GameScene /> or <TutorialIslandScene /> (coast zone)
 *
 *   OPEN_WATER       — Sailing between islands. Ocean shader + ship + fish +
 *                      enemy ships. No terrain. Camera follows ship.
 *                      Scene: <SailingScene /> (from world/SailingMode)
 *
 *   DUNGEON          — Instanced dungeon. BSP rooms + modular tiles + enemies +
 *                      loot + cave atmosphere. Physics isolated from overworld.
 *                      Scene: <BakedDungeonScene />
 *
 *   HOME_ISLAND      — Player's personal 300m island. Full RTS: buildings,
 *                      allies, resources. Co-op hosting (1+3 players).
 *                      Scene: <HousingScene /> or custom home island renderer
 *
 *   BOSS_ARENA       — Enclosed boss fight area. Zone-specific theme (void,
 *                      lava, crystal). Cave atmosphere shader. Timer + mechanics.
 *                      Scene: uses zone terrain but isolates a radius around boss
 *
 *   TUTORIAL_ISLAND  — The starting experience (coast zone GLB). Shipwreck Bay,
 *                      Havana, Fort. Already implemented as TutorialIslandScene.
 *                      Scene: <TutorialIslandScene />
 *
 * ## Transitions (how the player moves between contexts)
 *
 *   ZONE → ZONE:     Walk to dock → select destination → sailing cutscene →
 *                     OPEN_WATER (optional) → arrive at destination dock
 *
 *   ZONE → DUNGEON:  Walk to dungeon portal → press T → fade out →
 *                     generate dungeon → fade in
 *
 *   ZONE → HOME:     Walk to dock → select "Home Island" → sail cutscene →
 *                     home island instance loads
 *
 *   ZONE → BOSS:     Enter boss arena circle → triggered by quest/event →
 *                     camera zooms to arena, fog walls seal the area
 *
 *   OPEN_WATER → ZONE: Ship reaches destination dock proximity →
 *                     auto-dock → fade → spawn at dock on target island
 *
 *   DUNGEON → ZONE:  Reach exit portal → fade → return to zone at dungeon
 *                     portal position
 *
 *   HOME → ZONE:     Walk to home dock → select destination → sail back
 *
 *   Any → DEAD:      Health reaches 0 → death screen → respawn at
 *                     nearest faction hub or home island
 */

import type { ZoneId } from "./WorldGridRegistry";

// ── Rendering context types ──────────────────────────────────────────────────

export type RenderContext =
  | "zone_overworld"
  | "open_water"
  | "dungeon"
  | "home_island"
  | "boss_arena"
  | "tutorial_island";

export interface ZoneOverworldState {
  context: "zone_overworld";
  zoneId: ZoneId;
  /** Player world position within the zone */
  playerPos: { x: number; z: number };
  /** Active zone channel (MMO) */
  channelId: string | null;
}

export interface OpenWaterState {
  context: "open_water";
  /** Zone we departed from */
  originZone: ZoneId;
  /** Zone we're heading to */
  destinationZone: ZoneId;
  /** Ship type the player is using */
  shipType: string;
  /** Progress 0-1 of the voyage */
  voyageProgress: number;
}

export interface DungeonState {
  context: "dungeon";
  /** Zone this dungeon belongs to */
  zoneId: ZoneId;
  /** Dungeon name (from WorldGridRegistry) */
  dungeonName: string;
  /** Difficulty tier 1-5 */
  tier: number;
  /** BSP seed for deterministic generation */
  seed: number;
  /** Theme drives modular piece set + cave atmosphere */
  theme: string;
  /** Return position in the zone after exiting */
  returnPos: { x: number; z: number };
}

export interface HomeIslandState {
  context: "home_island";
  /** Owner's player ID */
  ownerId: string;
  /** UUID seed for terrain generation */
  islandSeed: number;
  /** Biome chosen by the player */
  biome: string;
  /** Co-op session code (if hosting/joined) */
  sessionCode: string | null;
}

export interface BossArenaState {
  context: "boss_arena";
  zoneId: ZoneId;
  bossName: string;
  bossType: string;
  /** Center of the arena in zone-local coords */
  arenaCenter: { x: number; z: number };
  arenaRadius: number;
}

export interface TutorialIslandState {
  context: "tutorial_island";
  /** Which sub-area (shanty, shipwreck, mangrove, havana, mansion, fort) */
  areaId: string | null;
}

export type GameFlowState =
  | ZoneOverworldState
  | OpenWaterState
  | DungeonState
  | HomeIslandState
  | BossArenaState
  | TutorialIslandState;

// ── Transition actions ───────────────────────────────────────────────────────

export type TransitionAction =
  | { type: "dock_travel"; from: ZoneId; to: ZoneId }
  | { type: "enter_dungeon"; zoneId: ZoneId; dungeonName: string; tier: number; returnPos: { x: number; z: number } }
  | { type: "exit_dungeon" }
  | { type: "enter_home"; ownerId: string }
  | { type: "exit_home"; returnTo: ZoneId }
  | { type: "enter_boss"; zoneId: ZoneId; bossName: string }
  | { type: "exit_boss" }
  | { type: "die_respawn"; respawnZone: ZoneId; respawnPos: { x: number; z: number } }
  | { type: "enter_tutorial" }
  | { type: "exit_tutorial"; toZone: ZoneId };

// ── Rendering layer registry ─────────────────────────────────────────────────
// Documents what each context renders so scene components can be built.

export interface RenderLayerSpec {
  terrain: "heightmap" | "glb" | "dungeon_modular" | "ocean_only" | "home_heightmap";
  water: "ocean_shader" | "zone_water" | "none";
  sky: "procedural" | "dungeon_ceiling" | "ocean_sky";
  lighting: "zone_ambient" | "dungeon_torch" | "ocean_sun" | "boss_dramatic";
  physics: "rapier_heightfield" | "rapier_trimesh" | "rapier_dungeon" | "ship_procedural";
  camera: "third_person" | "ship_follow" | "dungeon_follow" | "boss_orbit";
  hud: "full" | "sailing" | "dungeon" | "boss" | "minimal";
  atmosphere: "none" | "cave" | "underwater" | "zone_fog";
  enemies: "zone_biome" | "dungeon_theme" | "boss_only" | "none" | "ocean_ships";
  players: "mmo_zone" | "co_op_home" | "solo" | "party_dungeon";
}

export const RENDER_LAYERS: Record<RenderContext, RenderLayerSpec> = {
  zone_overworld: {
    terrain: "heightmap",
    water: "zone_water",
    sky: "procedural",
    lighting: "zone_ambient",
    physics: "rapier_heightfield",
    camera: "third_person",
    hud: "full",
    atmosphere: "zone_fog",
    enemies: "zone_biome",
    players: "mmo_zone",
  },
  open_water: {
    terrain: "ocean_only",
    water: "ocean_shader",
    sky: "ocean_sky",
    lighting: "ocean_sun",
    physics: "ship_procedural",
    camera: "ship_follow",
    hud: "sailing",
    atmosphere: "none",
    enemies: "ocean_ships",
    players: "solo",
  },
  dungeon: {
    terrain: "dungeon_modular",
    water: "none",
    sky: "dungeon_ceiling",
    lighting: "dungeon_torch",
    physics: "rapier_dungeon",
    camera: "dungeon_follow",
    hud: "dungeon",
    atmosphere: "cave",
    enemies: "dungeon_theme",
    players: "party_dungeon",
  },
  home_island: {
    terrain: "home_heightmap",
    water: "zone_water",
    sky: "procedural",
    lighting: "zone_ambient",
    physics: "rapier_heightfield",
    camera: "third_person",
    hud: "full",
    atmosphere: "none",
    enemies: "none",
    players: "co_op_home",
  },
  boss_arena: {
    terrain: "heightmap",
    water: "none",
    sky: "procedural",
    lighting: "boss_dramatic",
    physics: "rapier_heightfield",
    camera: "boss_orbit",
    hud: "boss",
    atmosphere: "cave",
    enemies: "boss_only",
    players: "mmo_zone",
  },
  tutorial_island: {
    terrain: "glb",
    water: "zone_water",
    sky: "procedural",
    lighting: "zone_ambient",
    physics: "rapier_trimesh",
    camera: "third_person",
    hud: "full",
    atmosphere: "none",
    enemies: "zone_biome",
    players: "mmo_zone",
  },
};

// ── Transition validators ────────────────────────────────────────────────────

/** Check if a transition is valid from the current state. */
export function isValidTransition(
  current: RenderContext,
  action: TransitionAction["type"],
): boolean {
  const valid: Record<RenderContext, TransitionAction["type"][]> = {
    zone_overworld: ["dock_travel", "enter_dungeon", "enter_home", "enter_boss", "die_respawn"],
    open_water: ["dock_travel", "die_respawn"],  // dock_travel = arrive at destination
    dungeon: ["exit_dungeon", "die_respawn"],
    home_island: ["exit_home", "die_respawn"],
    boss_arena: ["exit_boss", "die_respawn"],
    tutorial_island: ["exit_tutorial", "enter_dungeon", "dock_travel", "die_respawn"],
  };
  return valid[current]?.includes(action) ?? false;
}

/** Get the render context for a transition action. */
export function getTargetContext(action: TransitionAction): RenderContext {
  switch (action.type) {
    case "dock_travel": return "open_water";
    case "enter_dungeon": return "dungeon";
    case "exit_dungeon": return "zone_overworld";
    case "enter_home": return "home_island";
    case "exit_home": return "zone_overworld";
    case "enter_boss": return "boss_arena";
    case "exit_boss": return "zone_overworld";
    case "die_respawn": return "zone_overworld";
    case "enter_tutorial": return "tutorial_island";
    case "exit_tutorial": return "zone_overworld";
  }
}

// ── Fade transition config ───────────────────────────────────────────────────

export interface FadeConfig {
  fadeOutMs: number;
  holdMs: number;      // black screen while loading
  fadeInMs: number;
  color: string;       // CSS color for the fade overlay
}

export const TRANSITION_FADES: Record<TransitionAction["type"], FadeConfig> = {
  dock_travel:    { fadeOutMs: 800, holdMs: 2000, fadeInMs: 800, color: "#000000" },
  enter_dungeon:  { fadeOutMs: 600, holdMs: 1500, fadeInMs: 600, color: "#000000" },
  exit_dungeon:   { fadeOutMs: 600, holdMs: 1000, fadeInMs: 600, color: "#000000" },
  enter_home:     { fadeOutMs: 800, holdMs: 1500, fadeInMs: 800, color: "#000000" },
  exit_home:      { fadeOutMs: 800, holdMs: 1500, fadeInMs: 800, color: "#000000" },
  enter_boss:     { fadeOutMs: 400, holdMs: 500,  fadeInMs: 400, color: "#1a0000" },
  exit_boss:      { fadeOutMs: 400, holdMs: 500,  fadeInMs: 400, color: "#000000" },
  die_respawn:    { fadeOutMs: 1500, holdMs: 2000, fadeInMs: 1000, color: "#220000" },
  enter_tutorial: { fadeOutMs: 800, holdMs: 1500, fadeInMs: 800, color: "#000000" },
  exit_tutorial:  { fadeOutMs: 800, holdMs: 1500, fadeInMs: 800, color: "#000000" },
};
