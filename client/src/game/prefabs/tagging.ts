/**
 * Runtime helpers that stamp prefab metadata onto Three.js objects so
 * downstream systems (raycast harvest targeter, climb authoring, build
 * placement, destruction) can read material / hp / tool / detachable
 * info off any hit mesh.
 *
 * Tagging strategy (matters for HP correctness):
 *   The tag is stamped on the root and on each detachable child only —
 *   never on every descendant. `readPrefabTag` walks up the parent
 *   chain to resolve any hit mesh to the nearest tagged ancestor.
 *
 *   Why: tags carry mutable `hp`. If we stamped a copy on every
 *   descendant, hits against different sub-meshes of one instance
 *   would each decrement their own private HP and the prefab would
 *   never deplete. With a single shared tag per logical part, all
 *   hits against that part (including hits into nested decorative
 *   sub-meshes inside a detachable) accumulate into one HP pool.
 *
 * Per-instance call: `tagPrefab` MUST be called once per instance after
 * cloning a shared GLB scene. Three.js `Object3D.clone()` shallow-copies
 * `userData`, so two clones would otherwise share the same HP pool.
 */

import type { Object3D } from "three";
import {
  PREFAB_USERDATA_KEY,
  type PrefabSchema,
  type PrefabTag,
} from "./types";

/**
 * Tag a prefab instance. Stamps the root and each detachable child
 * (matched by `Object3D.name`). Other descendants are left untagged so
 * `readPrefabTag` resolves them by walking up to the nearest tagged
 * ancestor — guaranteeing one shared HP pool per logical part.
 *
 * Safe to call multiple times on the same root — the latest call wins.
 */
export function tagPrefab(root: Object3D, schema: PrefabSchema): void {
  const baseTag: PrefabTag = {
    prefabId: schema.id,
    material: schema.material,
    hp: schema.hp,
    maxHp: schema.hp,
    tool: schema.tool,
  };
  root.userData[PREFAB_USERDATA_KEY] = baseTag;

  if (!schema.detachable || schema.detachable.length === 0) {
    // Wipe any stale detachable tags from a previous tagging pass.
    root.traverse((obj) => {
      if (obj === root) return;
      if (obj.userData?.[PREFAB_USERDATA_KEY]) {
        delete obj.userData[PREFAB_USERDATA_KEY];
      }
    });
    return;
  }

  const detachableByName = new Map<string, PrefabTag>();
  for (const det of schema.detachable) {
    detachableByName.set(det.childName, {
      prefabId: schema.id,
      material: det.material ?? schema.material,
      hp: det.hp,
      maxHp: det.hp,
      tool: schema.tool,
      childName: det.childName,
    });
  }

  root.traverse((obj) => {
    if (obj === root) return;
    const detachableTag = detachableByName.get(obj.name);
    if (detachableTag) {
      obj.userData[PREFAB_USERDATA_KEY] = detachableTag;
    } else if (obj.userData?.[PREFAB_USERDATA_KEY]) {
      // Stale tag from a previous tagging pass — wipe so walk-up resolves
      // to the nearest *current* ancestor instead of the stale value.
      delete obj.userData[PREFAB_USERDATA_KEY];
    }
  });
}

/**
 * Read the prefab tag off a hit object by walking up the parent chain.
 * Returns null if no ancestor carries a tag — callers should treat null
 * as "non-interactive scenery."
 *
 * The returned tag is the SAME object held in userData. Mutating its
 * `hp` mutates the shared per-part HP pool — which is the design.
 */
export function readPrefabTag(obj: Object3D | null): PrefabTag | null {
  let cursor: Object3D | null = obj;
  while (cursor) {
    const tag = cursor.userData?.[PREFAB_USERDATA_KEY] as PrefabTag | undefined;
    if (tag) return tag;
    cursor = cursor.parent;
  }
  return null;
}

/**
 * Strip prefab tags off a subtree. Useful when respawning a depleted
 * harvestable so a stale "hp: 0" tag doesn't leak across respawns.
 */
export function clearPrefabTags(root: Object3D): void {
  if (root.userData) delete root.userData[PREFAB_USERDATA_KEY];
  root.traverse((obj) => {
    if (obj.userData) delete obj.userData[PREFAB_USERDATA_KEY];
  });
}
