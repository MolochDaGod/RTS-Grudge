/**
 * Prefab schema — single source of truth for what every interactive thing
 * in the world IS, semantically. Every harvestable, structure, voxel patch,
 * and breakable sub-part declares itself once here, and every system
 * (harvest, build, climb, dig, break, drop) reads from this same shape.
 *
 * This file intentionally contains only types + constants. The registry
 * lives in `registry.ts` and the runtime helpers in `tagging.ts`.
 */

/**
 * Material identity attached to every interactive surface in the world.
 *
 * Grouped by use:
 *  - Terrain layers (sand/dirt/grass/rock) — also the four stacked layers
 *    of a `voxel_patch` per the diggable-terrain spec.
 *  - Structural (wood/stone/metal/crystal/bone) — what walls, towers,
 *    weapons and most harvestable nodes are made of.
 *  - Soft / organic (fiber/cloth/leather/raw_meat/berry/herb) — gathered
 *    by hand or with a sharp tool, no impact SFX.
 */
export type Material =
  | "sand"
  | "dirt"
  | "grass"
  | "rock"
  | "wood"
  | "stone"
  | "metal"
  | "crystal"
  | "bone"
  | "fiber"
  | "cloth"
  | "leather"
  | "raw_meat"
  | "berry"
  | "herb"
  | "ice"
  | "snow";

/**
 * Tool required to harvest / break a given material efficiently.
 * `"hand"` means no tool needed (berries, herbs, fiber).
 * Mismatched tools should still chip away at HP but at a heavy penalty
 * (resolved by the harvest controller, not declared here).
 */
export type Tool = "axe" | "pickaxe" | "shovel" | "sword" | "hand";

/**
 * High-level kind of prefab. Drives which subsystem cares about it.
 *  - static_mesh : decorative scenery; no interaction at all.
 *  - harvestable : tree, rock, ore vein, plant — yields drops on depletion.
 *  - structure   : wall, tower, fence, door — breakable, can have
 *                  detachable sub-parts and a fragments-GLB on full destroy.
 *  - voxel_patch : a softxels-backed diggable terrain region with stacked
 *                  material layers (the sand/dirt/grass/bedrock spec).
 *  - creature    : NPC / animal / enemy slot — listed for completeness so
 *                  spawn data can flow through the same registry, but the
 *                  combat system owns hp/death.
 */
export type PrefabKind =
  | "static_mesh"
  | "harvestable"
  | "structure"
  | "voxel_patch"
  | "creature";

/** Drop entry attached to a harvestable or destructible prefab. */
export interface PrefabDrop {
  /** Inventory item id (matches `useInventory` ids). */
  item: string;
  min: number;
  max: number;
  /** 0..1 probability the drop rolls at all. Default 1. */
  chance?: number;
}

/**
 * One named child mesh that can be detached from a structure independently
 * of the parent (e.g. snap a single branch off a tree, knock one brick out
 * of a wall). The child is identified by `Object3D.name` as authored in
 * the GLB.
 */
export interface PrefabDetachable {
  /** Must match a child `Object3D.name` in the loaded GLB. */
  childName: string;
  hp: number;
  /** Override material on this part (e.g. metal hinge on a wood door). */
  material?: Material;
  drops?: PrefabDrop[];
}

/**
 * Voxel-patch spec for `kind: "voxel_patch"` prefabs. Drives the layered
 * diggable-terrain implementation:
 *  - cellSize: world-space size of one voxel cell, in metres.
 *  - size:    [width, height, depth] in cells.
 *  - layers:  top-down material stack. Total `thickness` in metres should
 *             equal `size[1] * cellSize` (validated at registry load).
 *  - diggableDepth: metres from the top that the player can carve.
 *                   The remainder is treated as bedrock (undiggable).
 */
export interface PrefabVoxelSpec {
  cellSize: number;
  size: [number, number, number];
  layers: Array<{ material: Material; thickness: number }>;
  diggableDepth: number;
}

/**
 * Full prefab declaration. Most fields are optional and only meaningful
 * for the matching `kind` — see comments below.
 */
export interface PrefabSchema {
  /** Stable id; lookup key in PREFAB_REGISTRY and on every tagged mesh. */
  id: string;
  kind: PrefabKind;

  /** Root material — what the whole thing "is" semantically. */
  material: Material;

  /**
   * Hit points before the prefab is depleted (harvestable) or destroyed
   * (structure). Voxel patches use 1 (digging is per-cell, not per-prefab).
   * Static meshes use Infinity.
   */
  hp: number;

  /** Tool that harvests/breaks this efficiently. */
  tool?: Tool;

  /** Drops awarded when the prefab is depleted/destroyed in full. */
  drops?: PrefabDrop[];

  /** Independently-breakable named child meshes (structures only). */
  detachable?: PrefabDetachable[];

  /**
   * Path (relative to public/) of a `*_fragments.glb` to spawn as dynamic
   * rigidbodies on full destruction. If absent, the prefab simply
   * disappears (or swaps to a stump for trees) on death.
   */
  fragments?: string;

  /** Climbable surface — tagged so ClimbableColliders can mount on it. */
  climbable?: boolean;

  /** Player can place this via the unified build system. */
  placeable?: boolean;

  /** Voxel-patch config; required iff kind === "voxel_patch". */
  voxel?: PrefabVoxelSpec;
}

/**
 * Runtime tag stamped onto every Object3D belonging to a tagged prefab.
 * Read with `readPrefabTag(obj)` after a raycast hit. Mutable: `hp` is
 * decremented in place by the harvest/combat systems.
 */
export interface PrefabTag {
  prefabId: string;
  material: Material;
  hp: number;
  maxHp: number;
  tool?: Tool;
  /** Set on detachable child meshes; identifies which sub-part this is. */
  childName?: string;
}

/** Key under which the tag lives on `Object3D.userData`. */
export const PREFAB_USERDATA_KEY = "__prefab" as const;
