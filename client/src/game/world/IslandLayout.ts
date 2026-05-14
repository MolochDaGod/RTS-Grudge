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
 */

/** Reference image dimensions in pixels — `client/public/maps/world_overhead.png`. */
export const WORLD_MAP_IMAGE_PATH = "/maps/world_overhead.png";
export const WORLD_MAP_IMAGE_W = 784;
export const WORLD_MAP_IMAGE_H = 826;

/** Image pixel that represents world (0, 0, 0). Tutorial island centre. */
const TUTORIAL_IMAGE_X = 220;
const TUTORIAL_IMAGE_Y = 580;

/** Conversion factor between image pixels and world units. */
export const WORLD_PER_PIXEL = 1.5;

export interface IslandLayoutEntry {
  id: string;
  /** Display name; used in tooltips and the M-key map. */
  name: string;
  /** Optional faction tag — unset for the tutorial island and decorative islets. */
  faction?: "north" | "south" | "east" | "west";
  /** True for the tutorial island. There is exactly one. */
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
  /** Tint used for the pin on map UIs. */
  color: string;
}

/**
 * Baked island placements. Image pixel coords come from eyeballing the
 * reference map; world coords are derived in `withWorldCoords` below.
 *
 * The bottom-left island carries the shipwreck mark, so it's the
 * tutorial island. The four "compass" majors become faction islands
 * (NW + N + W + SE were the cleanest assignment given the image's
 * organic spread — note the world is NOT a strict cross around the
 * tutorial; the user wants the layout to follow the image, not
 * doctrine). The two tiny islets are decoration / future fast-travel
 * waypoints.
 */
const RAW_LAYOUT: IslandLayoutEntry[] = [
  {
    id: "tutorial",
    name: "Driftwood Cove",
    isTutorial: true,
    imagePx: TUTORIAL_IMAGE_X,
    imagePy: TUTORIAL_IMAGE_Y,
    imageRadius: 70,
    color: "#c9a25a",
  },
  {
    id: "island_nw",
    name: "Pinecrest Reach",
    faction: "west",
    imagePx: 190,
    imagePy: 170,
    imageRadius: 75,
    color: "#7da06b",
  },
  {
    id: "island_n",
    name: "Bastion Vale",
    faction: "north",
    imagePx: 460,
    imagePy: 200,
    imageRadius: 110,
    color: "#a98556",
  },
  {
    id: "island_w",
    name: "Hollowtide Town",
    faction: "west",
    imagePx: 270,
    imagePy: 410,
    imageRadius: 75,
    color: "#9c6b50",
  },
  {
    id: "island_e",
    name: "Verdant Knoll",
    faction: "east",
    imagePx: 615,
    imagePy: 400,
    imageRadius: 50,
    color: "#5fa069",
  },
  {
    id: "island_se",
    name: "Iron Watch Hold",
    faction: "south",
    imagePx: 490,
    imagePy: 555,
    imageRadius: 100,
    color: "#8d8276",
  },
  {
    id: "islet_w",
    name: "West Shoal",
    isIslet: true,
    imagePx: 80,
    imagePy: 315,
    imageRadius: 14,
    color: "#cdb079",
  },
  {
    id: "islet_e",
    name: "East Shoal",
    isIslet: true,
    imagePx: 700,
    imagePy: 290,
    imageRadius: 14,
    color: "#cdb079",
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
