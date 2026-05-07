/**
 * PREFAB_REGISTRY — the authored catalog of every interactive prefab in
 * the game. This is the single source the unified harvest, build, dig
 * and destruction systems will read from once they're wired (subsequent
 * tasks). Adding a prefab here is meant to be the only step needed to
 * make it interactable in the world.
 *
 * For now this seeds the registry with:
 *   - The nine harvestable resource types currently defined in
 *     ResourceNode.tsx (so existing nodes can be migrated onto this
 *     schema in the harvest-targeter task without re-authoring values).
 *   - One example structure with a detachable child + fragments path,
 *     to lock the structure shape in.
 *   - One example voxel_patch matching the user's spec exactly:
 *     6 ft total depth, 5 ft diggable, layers grass / dirt / sand / rock.
 *
 * The existing ResourceNode / BuildController / useBuildSystem code is
 * NOT modified by this task. They keep working unchanged. Migration
 * happens in the dedicated raycast-harvest and unified-placement tasks.
 */

import type { PrefabSchema } from "./types";

/**
 * Migration map from the legacy `ResourceNode.ResourceType` literal
 * to the prefab id that replaces it. This is the bridge the upcoming
 * raycast-harvest task will use:
 *
 *   const prefab = tryGetPrefab(RESOURCE_TYPE_TO_PREFAB_ID[node.type]);
 *
 * Keep the keys in lock-step with `ResourceType` in
 * `client/src/game/components/ResourceNode.tsx`.
 */
export const RESOURCE_TYPE_TO_PREFAB_ID = {
  wood: "tree_basic",
  stone: "rock_basic",
  fiber: "fiber_plant",
  iron_ore: "iron_vein",
  gold_ore: "gold_vein",
  raw_meat: "carcass_small",
  berry: "berry_bush",
  herb: "herb_patch",
  crystal: "crystal_cluster",
} as const;

export type LegacyResourceType = keyof typeof RESOURCE_TYPE_TO_PREFAB_ID;

/** 1 ft expressed in metres, used for the voxel spec. */
const FT = 0.3048;

const ENTRIES: PrefabSchema[] = [
  // -------------------- Harvestables (current 9 resource types) ----------
  {
    id: "tree_basic",
    kind: "harvestable",
    material: "wood",
    hp: 10,
    tool: "axe",
    drops: [{ item: "wood", min: 1, max: 3 }],
  },
  {
    id: "rock_basic",
    kind: "harvestable",
    material: "stone",
    hp: 12,
    tool: "pickaxe",
    drops: [{ item: "stone", min: 1, max: 2 }],
  },
  {
    id: "iron_vein",
    kind: "harvestable",
    material: "metal",
    hp: 16,
    tool: "pickaxe",
    drops: [{ item: "iron_ore", min: 1, max: 2 }],
  },
  {
    id: "gold_vein",
    kind: "harvestable",
    material: "metal",
    hp: 20,
    tool: "pickaxe",
    drops: [{ item: "gold_ore", min: 1, max: 1 }],
  },
  {
    id: "crystal_cluster",
    kind: "harvestable",
    material: "crystal",
    hp: 18,
    tool: "pickaxe",
    drops: [{ item: "crystal", min: 1, max: 1 }],
  },
  {
    id: "fiber_plant",
    kind: "harvestable",
    material: "fiber",
    hp: 1,
    tool: "hand",
    drops: [{ item: "fiber", min: 2, max: 4 }],
  },
  {
    id: "berry_bush",
    kind: "harvestable",
    material: "berry",
    hp: 1,
    tool: "hand",
    drops: [{ item: "berry", min: 2, max: 5 }],
  },
  {
    id: "herb_patch",
    kind: "harvestable",
    material: "herb",
    hp: 1,
    tool: "hand",
    drops: [{ item: "herb", min: 1, max: 3 }],
  },
  {
    id: "carcass_small",
    kind: "harvestable",
    material: "raw_meat",
    hp: 4,
    tool: "sword",
    drops: [{ item: "raw_meat", min: 1, max: 2 }],
  },

  // -------------------- Example structure with sub-parts ------------------
  {
    id: "wooden_wall_segment",
    kind: "structure",
    material: "wood",
    hp: 80,
    tool: "axe",
    placeable: true,
    climbable: false,
    drops: [{ item: "wood", min: 2, max: 4 }],
    detachable: [
      // When the GLB ships with named planks, knocking one out is a
      // separate event from destroying the whole wall.
      { childName: "plank_top", hp: 20, drops: [{ item: "wood", min: 1, max: 1 }] },
      { childName: "plank_mid", hp: 20, drops: [{ item: "wood", min: 1, max: 1 }] },
    ],
    fragments: "/models/structures/wooden_wall_fragments.glb",
  },

  // -------------------- Voxel patch (the dig-spec example) ---------------
  // 6 ft total depth (5 ft diggable + 1 ft bedrock), four stacked layers,
  // 1 ft per cell, 32 ft x 32 ft footprint.
  {
    id: "voxel_patch_default",
    kind: "voxel_patch",
    material: "dirt", // root material — overridden per-cell at runtime
    hp: 1,
    tool: "shovel",
    voxel: {
      cellSize: FT,
      size: [32, 6, 32],
      layers: [
        { material: "grass", thickness: 0.5 * FT },
        { material: "dirt", thickness: 2.5 * FT },
        { material: "sand", thickness: 2.0 * FT },
        { material: "rock", thickness: 1.0 * FT }, // bedrock — undiggable
      ],
      diggableDepth: 5 * FT,
    },
  },
];

function validateEntry(entry: PrefabSchema): void {
  const tag = `[PREFAB_REGISTRY] "${entry.id}"`;

  // Per-kind voxel field invariants
  if (entry.kind === "voxel_patch") {
    if (!entry.voxel) {
      throw new Error(`${tag} is voxel_patch but has no voxel spec`);
    }
    const v = entry.voxel;
    if (!(v.cellSize > 0)) {
      throw new Error(`${tag} voxel.cellSize must be > 0 (got ${v.cellSize})`);
    }
    if (v.size.length !== 3 || v.size.some((n) => !Number.isInteger(n) || n <= 0)) {
      throw new Error(`${tag} voxel.size must be three positive integers (got ${JSON.stringify(v.size)})`);
    }
    if (v.layers.length === 0) {
      throw new Error(`${tag} voxel.layers must have at least one layer`);
    }
    if (v.layers.some((l) => !(l.thickness > 0))) {
      throw new Error(`${tag} every voxel layer must have thickness > 0`);
    }
    if (v.diggableDepth < 0) {
      throw new Error(`${tag} voxel.diggableDepth must be >= 0`);
    }
    const totalThickness = v.layers.reduce((a, l) => a + l.thickness, 0);
    const heightMetres = v.size[1] * v.cellSize;
    if (Math.abs(totalThickness - heightMetres) > 0.001) {
      throw new Error(
        `${tag} voxel layers sum to ${totalThickness}m but ` +
        `size[1] * cellSize = ${heightMetres}m — these must agree.`,
      );
    }
    if (v.diggableDepth > heightMetres) {
      throw new Error(`${tag} diggableDepth ${v.diggableDepth}m exceeds total patch height ${heightMetres}m`);
    }
  } else if (entry.voxel) {
    throw new Error(`${tag} has voxel spec but kind is "${entry.kind}" (only voxel_patch may carry voxel)`);
  }

  // Drops
  if (entry.drops) {
    for (const d of entry.drops) {
      if (!d.item) throw new Error(`${tag} has a drop with no item id`);
      if (!Number.isFinite(d.min) || !Number.isFinite(d.max) || d.min < 0 || d.max < d.min) {
        throw new Error(`${tag} drop "${d.item}" has invalid min/max (${d.min}..${d.max})`);
      }
      if (d.chance !== undefined && (d.chance < 0 || d.chance > 1)) {
        throw new Error(`${tag} drop "${d.item}" chance must be in [0,1] (got ${d.chance})`);
      }
    }
  }

  // Detachables
  if (entry.detachable) {
    const seen = new Set<string>();
    for (const det of entry.detachable) {
      if (!det.childName) throw new Error(`${tag} has a detachable with empty childName`);
      if (seen.has(det.childName)) {
        throw new Error(`${tag} detachable childName "${det.childName}" listed twice`);
      }
      seen.add(det.childName);
      if (!(det.hp > 0)) {
        throw new Error(`${tag} detachable "${det.childName}" hp must be > 0`);
      }
    }
  }

  // Fragments path: a soft convention check — point future authors at
  // the *_fragments.glb naming so the destruction system can find the
  // sibling base GLB by stripping the suffix.
  if (entry.fragments && !entry.fragments.endsWith("_fragments.glb")) {
    throw new Error(`${tag} fragments path should end in "_fragments.glb" (got "${entry.fragments}")`);
  }

  // Root hp sanity for non-voxel kinds
  if (entry.kind !== "voxel_patch" && entry.kind !== "static_mesh" && !(entry.hp > 0)) {
    throw new Error(`${tag} hp must be > 0 for kind "${entry.kind}"`);
  }
}

function buildRegistry(entries: PrefabSchema[]): Record<string, PrefabSchema> {
  const map: Record<string, PrefabSchema> = {};
  for (const entry of entries) {
    if (map[entry.id]) {
      throw new Error(`[PREFAB_REGISTRY] duplicate prefab id: "${entry.id}"`);
    }
    validateEntry(entry);
    map[entry.id] = entry;
  }
  return map;
}

export const PREFAB_REGISTRY: Readonly<Record<string, PrefabSchema>> = buildRegistry(ENTRIES);

/** Lookup helper that throws on miss — fail loudly during integration. */
export function getPrefab(id: string): PrefabSchema {
  const p = PREFAB_REGISTRY[id];
  if (!p) throw new Error(`[PREFAB_REGISTRY] unknown prefab id: "${id}"`);
  return p;
}

/** Non-throwing variant for systems that legitimately probe by id. */
export function tryGetPrefab(id: string): PrefabSchema | undefined {
  return PREFAB_REGISTRY[id];
}
