/**
 * IslandLayout — single source of truth for the world's island placement.
 *
 * What this is
 *   A baked snapshot of where every island sits in the world, what it's
 *   called, and where it appears on the overhead reference map at
 *   `/maps/world_overhead.png` (784 x 826 px). Until we have proper
 *   sailing + per-island terrain, this is the file that the minimap,
 *   the M-key world map, and the 3D placeholder islands all read from.
 *
 * Co-ordinate convention
 *   - World axes: +X = image right (east), +Z = image down (south).
 *   - World origin (0, 0, 0) is intentionally the centre of the
 *     tutorial island. The tutorial GLB already centres itself on its
 *     "Shipwreck" node (see TutorialIslandScene.tsx), so anything
 *     placed at world (0, 0) lines up with where the player spawns.
 *   - 1 image pixel = `WORLD_PER_PIXEL` world units. With the current
 *     value of 1.5, the full reference map is ~1176 x 1239 world units
 *     across — large enough to feel like a real ocean, small enough
 *     that a future sailing system can cross it in a couple of
 *     minutes rather than half an hour.
 *
 * Adding / moving islands
 *   Edit the entry in ISLAND_LAYOUT below (image pixel coords are the
 *   primary inputs; world coords are derived). Everything that reads
 *   the layout — the minimap, the world map, the 3D placeholders, and
 *   eventually NPC/vendor placement — picks up the change automatically.
 *
 * World zones (5):
 *   CENTRAL   hub_main              — the large Unity-export hub island
 *   TROPICAL  tropical_a–d          — upper-left, pirate biome
 *   ICE       ice_a–d               — upper-right, glacier biome
 *   LAVA      lava_a–d              — lower-right, volcanic biome
 *   BOSS      boss_a–d              — lower-left, sinking / dungeon biome
 */

import type { ZoneId } from "./WorldZoneRegistry";

/** Reference image dimensions in pixels — `client/public/maps/world_overhead.png`. */
export const WORLD_MAP_IMAGE_PATH = "/maps/world_overhead.png";
export const WORLD_MAP_IMAGE_W = 784;
export const WORLD_MAP_IMAGE_H = 826;

/** Image pixel that represents world (0, 0, 0). Tutorial / central hub centre. */
const TUTORIAL_IMAGE_X = 220;
const TUTORIAL_IMAGE_Y = 580;

/** Conversion factor between image pixels and world units. */
export const WORLD_PER_PIXEL = 1.5;

export interface IslandLayoutEntry {
  id: string;
  /** Display name; used in tooltips and the M-key map. */
  name: string;
  /** Zone this island belongs to. */
  zoneId: ZoneId;
  /** True for the large central hub / tutorial island. There is exactly one. */
  isTutorial?: boolean;
  /** True for the small unnamed rocks that serve as visual decoration. */
  isIslet?: boolean;
  /** Centre of the island on the reference map, in image pixels. */
  imagePx: number;
  imagePy: number;
  /**
   * Visual radius in image pixels — used to draw the island pin on the
   * minimap / world map at roughly the right size, and to scale the 3D
   * placeholder geometry. Approximate; eyeballed from the reference
   * image.
   */
  imageRadius: number;
  /** Tint used for the pin on map UIs. Prefer zone pinColor for rendering. */
  color: string;
}

/**
 * 17 baked island placements across the 5 world zones.
 * Image pixel coords → world coords via imageToWorldCoords below.
 *
 *  Hub (1):           Central, large island near image centre
 *  Tropical (4):      Upper-left quadrant — pirate / jungle biome
 *  Ice (4):           Upper-right quadrant — glacier / blizzard biome
 *  Lava (4):          Lower-right quadrant — volcanic / fire biome
 *  Boss / Sinking (4): Lower-left quadrant — dungeon / void biome
 */
const RAW_LAYOUT: IslandLayoutEntry[] = [

  // ── CENTRAL HUB ──────────────────────────────────────────────────────────
  {
    id: "hub_main",
    name: "The Rift",
    zoneId: "central",
    isTutorial: true,
    imagePx: TUTORIAL_IMAGE_X, // world (0, 0) — player spawn
    imagePy: TUTORIAL_IMAGE_Y,
    imageRadius: 80,
    color: "#c9a25a",
  },

  // ── TROPICAL — upper-left ─────────────────────────────────────────────────
  {
    id: "tropical_d",
    name: "Shanty Shoal",
    zoneId: "tropical",
    imagePx: 210, imagePy: 320, imageRadius: 42, color: "#3d9960",
  },
  {
    id: "tropical_c",
    name: "Mangrove Lagoon",
    zoneId: "tropical",
    imagePx: 85, imagePy: 275, imageRadius: 48, color: "#3d9960",
  },
  {
    id: "tropical_b",
    name: "Coconut Harbor",
    zoneId: "tropical",
    imagePx: 192, imagePy: 170, imageRadius: 65, color: "#3d9960",
  },
  {
    id: "tropical_a",
    name: "Rum Runner's Cay",
    zoneId: "tropical",
    imagePx: 115, imagePy: 95, imageRadius: 50, color: "#3d9960",
  },

  // ── ICE — upper-right ─────────────────────────────────────────────────────
  {
    id: "ice_d",
    name: "Icebound Shallows",
    zoneId: "ice",
    imagePx: 490, imagePy: 280, imageRadius: 42, color: "#5599cc",
  },
  {
    id: "ice_c",
    name: "Blizzard Maw",
    zoneId: "ice",
    imagePx: 700, imagePy: 250, imageRadius: 48, color: "#5599cc",
  },
  {
    id: "ice_b",
    name: "Frostfall Peak",
    zoneId: "ice",
    imagePx: 565, imagePy: 165, imageRadius: 65, color: "#5599cc",
  },
  {
    id: "ice_a",
    name: "Glacier Keep",
    zoneId: "ice",
    imagePx: 668, imagePy: 90, imageRadius: 55, color: "#5599cc",
  },

  // ── LAVA — lower-right ────────────────────────────────────────────────────
  {
    id: "lava_d",
    name: "Cinder Gate",
    zoneId: "lava",
    imagePx: 558, imagePy: 580, imageRadius: 42, color: "#cc3311",
  },
  {
    id: "lava_c",
    name: "Scorched Reach",
    zoneId: "lava",
    imagePx: 700, imagePy: 760, imageRadius: 48, color: "#cc3311",
  },
  {
    id: "lava_b",
    name: "Ember Caldera",
    zoneId: "lava",
    imagePx: 635, imagePy: 658, imageRadius: 65, color: "#cc3311",
  },
  {
    id: "lava_a",
    name: "Volcanic Vent",
    zoneId: "lava",
    imagePx: 692, imagePy: 580, imageRadius: 50, color: "#cc3311",
  },

  // ── BOSS / SINKING — lower-left ───────────────────────────────────────────
  {
    id: "boss_a",
    name: "The Threshold",
    zoneId: "boss",
    imagePx: 115, imagePy: 648, imageRadius: 48, color: "#7744aa",
  },
  {
    id: "boss_b",
    name: "Cursed Crag",
    zoneId: "boss",
    imagePx: 65, imagePy: 728, imageRadius: 58, color: "#7744aa",
  },
  {
    id: "boss_c",
    name: "Sunken Throne",
    zoneId: "boss",
    imagePx: 155, imagePy: 778, imageRadius: 45, color: "#7744aa",
  },
  {
    id: "boss_d",
    name: "The Abyss",
    zoneId: "boss",
    imagePx: 58, imagePy: 798, imageRadius: 40, color: "#7744aa",
  },
];

/** Derived layout entry, with world coords resolved from image coords. */
export interface ResolvedIslandLayout extends IslandLayoutEntry {
  worldX: number;
  worldZ: number;
  /** Visual radius in world units (imageRadius * WORLD_PER_PIXEL). */
  worldRadius: number;
}

function imageToWorldCoords(px: number, py: number): { x: number; z: number } {
  return {
    x: (px - TUTORIAL_IMAGE_X) * WORLD_PER_PIXEL,
    z: (py - TUTORIAL_IMAGE_Y) * WORLD_PER_PIXEL,
  };
}

function worldToImageCoords(wx: number, wz: number): { px: number; py: number } {
  return {
    px: TUTORIAL_IMAGE_X + wx / WORLD_PER_PIXEL,
    py: TUTORIAL_IMAGE_Y + wz / WORLD_PER_PIXEL,
  };
}

export const ISLAND_LAYOUT: ResolvedIslandLayout[] = RAW_LAYOUT.map((e) => {
  const w = imageToWorldCoords(e.imagePx, e.imagePy);
  return {
    ...e,
    worldX: w.x,
    worldZ: w.z,
    worldRadius: e.imageRadius * WORLD_PER_PIXEL,
  };
});

/** Convenience accessors for the canonical tutorial island entry. */
export const TUTORIAL_ISLAND = ISLAND_LAYOUT.find((e) => e.isTutorial)!;

/** Map between world coords and the reference image's pixel coords. */
export const worldToImage = worldToImageCoords;
export const imageToWorld = imageToWorldCoords;

/**
 * Convert a world (X, Z) to a UV pair in [0..1] over the reference image,
 * so map UIs can paint the image at any size and place dots/pins on top
 * without each one re-deriving the maths.
 */
export function worldToImageUV(wx: number, wz: number): { u: number; v: number } {
  const p = worldToImageCoords(wx, wz);
  return {
    u: p.px / WORLD_MAP_IMAGE_W,
    v: p.py / WORLD_MAP_IMAGE_H,
  };
}

export function imageUVToWorld(u: number, v: number): { x: number; z: number } {
  return imageToWorldCoords(u * WORLD_MAP_IMAGE_W, v * WORLD_MAP_IMAGE_H);
}
