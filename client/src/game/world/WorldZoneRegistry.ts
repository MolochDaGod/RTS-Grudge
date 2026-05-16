/**
 * WorldZoneRegistry — canonical definitions for the 5 world zones.
 *
 * Zone layout (from the player's perspective looking at the world map):
 *   TOP-LEFT     The Jade Seas       tropical / pirate
 *   TOP-RIGHT    The Frozen Reach    ice / snow
 *   BOTTOM-RIGHT The Ember Reaches   lava / fire
 *   BOTTOM-LEFT  The Shattered Deep  boss / sinking islands
 *   CENTER       The Rift            large hub island (Unity import pending)
 *
 * All display, fog, asset, and gameplay defaults live here so the world
 * map, exploration system, and 3D scene loader can all share them without
 * coupling to each other.
 */

export type ZoneId = "tropical" | "ice" | "lava" | "boss" | "central";
export type ZoneQuadrant =
  | "top_left"
  | "top_right"
  | "bottom_right"
  | "bottom_left"
  | "center";

export interface WorldZone {
  id: ZoneId;
  name: string;
  subtitle: string;
  quadrant: ZoneQuadrant;

  // ── Map UI ──────────────────────────────────────────────────────────
  /** Accent colour used in UI labels, legend swatches, etc. */
  color: string;
  /** Tint applied to island pins on the world map. */
  pinColor: string;
  /** Translucent fill for the quadrant overlay drawn on the world map. */
  overlayColor: string;

  // ── 3D Scene ────────────────────────────────────────────────────────
  ambientColor: string;
  fogColor: string;
  fogDensity: number;

  // ── Assets ──────────────────────────────────────────────────────────
  /**
   * Primary scene asset path relative to /public. null means no single
   * scene mesh is available and the zone falls back to `fallbackMode`.
   */
  primaryAssetPath: string | null;
  /** How the scene is assembled when no single GLB is available. */
  fallbackMode: "scene" | "modular" | "placeholder";

  // ── Gameplay ────────────────────────────────────────────────────────
  description: string;
  /** Minimum recommended player level to enter this zone. */
  minPlayerLevel: number;
  /** Whether islands in this zone can permanently sink (boss zone only). */
  supportsSinking: boolean;
}

export const WORLD_ZONES: Record<ZoneId, WorldZone> = {
  // ─────────────────────────────────────────────────────────────────────
  central: {
    id: "central",
    name: "The Rift",
    subtitle: "Heart of the Floating Isles",
    quadrant: "center",
    color: "#c9a25a",
    pinColor: "#c9a25a",
    overlayColor: "rgba(201,162,90,0.07)",
    ambientColor: "#fff8ee",
    fogColor: "#c4b090",
    fogDensity: 0.008,
    primaryAssetPath: null, // Pending: export large island from Unity project
    fallbackMode: "placeholder",
    description:
      "The great central island where all factions first made landfall. " +
      "A neutral ground where alliances are forged — and shattered.",
    minPlayerLevel: 0,
    supportsSinking: false,
  },

  // ─────────────────────────────────────────────────────────────────────
  tropical: {
    id: "tropical",
    name: "The Jade Seas",
    subtitle: "Pirate Waters — Upper West",
    quadrant: "top_left",
    color: "#4db878",
    pinColor: "#3d9960",
    overlayColor: "rgba(77,184,120,0.08)",
    ambientColor: "#ffddaa",
    fogColor: "#c4a882",
    fogDensity: 0.012,
    primaryAssetPath: "/models/pirate_islands/scene.gltf",
    fallbackMode: "scene",
    description:
      "Warm turquoise waters lined with palm trees and pirate strongholds. " +
      "The Jade Seas are where fresh recruits prove themselves in cannon fire and cutlass duels.",
    minPlayerLevel: 1,
    supportsSinking: false,
  },

  // ─────────────────────────────────────────────────────────────────────
  ice: {
    id: "ice",
    name: "The Frozen Reach",
    subtitle: "Ice Wastes — Upper East",
    quadrant: "top_right",
    color: "#88ccff",
    pinColor: "#5599cc",
    overlayColor: "rgba(136,204,255,0.09)",
    ambientColor: "#cce6ff",
    fogColor: "#aaccdd",
    fogDensity: 0.03,
    // NOTE: No major ice biome mesh in /public/models yet. Using modular
    // assembly from dungeon_modular + nature props until a dedicated glacier
    // island GLB is imported.
    primaryAssetPath: null,
    fallbackMode: "placeholder",
    description:
      "Perpetual blizzards scour these glacial islands. Yetis and ice golems " +
      "defend ancient frozen ruins buried beneath centuries of snow and silence.",
    minPlayerLevel: 15,
    supportsSinking: false,
  },

  // ─────────────────────────────────────────────────────────────────────
  lava: {
    id: "lava",
    name: "The Ember Reaches",
    subtitle: "Volcanic Isles — Lower East",
    quadrant: "bottom_right",
    color: "#ff6633",
    pinColor: "#cc3311",
    overlayColor: "rgba(255,102,51,0.09)",
    ambientColor: "#ff8844",
    fogColor: "#aa4422",
    fogDensity: 0.025,
    primaryAssetPath: "/models/environment/lava/lava_surface.glb",
    fallbackMode: "scene",
    description:
      "Molten rivers carve through black obsidian as fire demons and lava golems " +
      "guard the smoldering depths. The air itself burns the lungs of the unprepared.",
    minPlayerLevel: 25,
    supportsSinking: false,
  },

  // ─────────────────────────────────────────────────────────────────────
  boss: {
    id: "boss",
    name: "The Shattered Deep",
    subtitle: "Sinking Isles — Lower West",
    quadrant: "bottom_left",
    color: "#9966cc",
    pinColor: "#7744aa",
    overlayColor: "rgba(153,102,204,0.1)",
    ambientColor: "#441144",
    fogColor: "#331133",
    fogDensity: 0.04,
    primaryAssetPath: "/models/dungeons/low poly dungeon sample.glb",
    fallbackMode: "scene",
    description:
      "Ancient islands slowly claimed by the void sea. Demonic gates pulse with " +
      "dark energy. Each island may vanish beneath the waves — permanently. " +
      "Those who fall here are not easily rescued.",
    minPlayerLevel: 35,
    supportsSinking: true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// World-space AABB for each zone — used by WorldMap to draw translucent
// quadrant overlays. Values are [minX, minZ, maxX, maxZ] in world units.
// Derived from the image pixel ranges mapped through WORLD_PER_PIXEL=1.5 and
// the tutorial island at image px (220, 580) = world (0, 0).
// ─────────────────────────────────────────────────────────────────────────────
export const ZONE_WORLD_BOUNDS: Record<ZoneId, [number, number, number, number]> = {
  //          minX   minZ   maxX   maxZ
  central:  [ -120,  -240,   210,    60],
  tropical: [ -330,  -750,    15,  -270],
  ice:      [  195,  -750,   780,  -180],
  lava:     [  285,    30,   780,   540],
  boss:     [ -330,    30,    15,   540],
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getZone(id: ZoneId): WorldZone {
  return WORLD_ZONES[id];
}

export function getAllZones(): WorldZone[] {
  return Object.values(WORLD_ZONES);
}

/** Returns the zone whose world-space AABB contains the given point, or null. */
export function getZoneAtPoint(worldX: number, worldZ: number): WorldZone | null {
  for (const [zoneId, bounds] of Object.entries(ZONE_WORLD_BOUNDS) as [
    ZoneId,
    [number, number, number, number]
  ][]) {
    const [minX, minZ, maxX, maxZ] = bounds;
    if (worldX >= minX && worldX <= maxX && worldZ >= minZ && worldZ <= maxZ) {
      return WORLD_ZONES[zoneId];
    }
  }
  return null;
}
