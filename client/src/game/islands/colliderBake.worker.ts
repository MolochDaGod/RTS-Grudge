/**
 * Generalised background worker for per-mesh trimesh collider bakes.
 *
 * Receives a list of "groups", each containing one or more raw mesh
 * geometries (`positions` / `indices` typed arrays + a baked combined
 * world matrix) from the main thread. For every group it applies the
 * per-vertex matrix transform, optionally merges the geometries of
 * the group into a single buffer (so things like a per-rock collider
 * built from multiple sub-meshes still come out as one `<TrimeshCollider>`
 * input), enforces the per-collider and total triangle budgets, and
 * posts back the assembled vertex/index Float32/Uint32 arrays via
 * Transferable so the main thread can hand them straight to
 * `<TrimeshCollider>` without any further work.
 *
 * Used by:
 *   - The tutorial island's per-mesh ground bake (one geom per group).
 *   - The tutorial island's per-rock bake (one rock = one group with
 *     N sub-mesh geoms merged together).
 *   - Any future scene that wants to push GLB-derived trimesh collider
 *     work off the main thread — the request format is intentionally
 *     scene-agnostic.
 *
 * Scope audit (April 2026): the only scenes in the codebase that use
 * `<TrimeshCollider>` from baked GLB geometry are TutorialIslandScene
 * (ground bake) and its child TutorialIslandHarvestables (per-rock
 * colliders, fed from this worker via `useRockCollidersBake`). All
 * other scenes use procedurally-derived colliders that don't touch
 * GLB vertex data — `GameScene` uses `<TerrainCollider>` (heightfield
 * from procedural heights) and `<BuildingColliders>` (cuboid-per-
 * building); `DungeonScene` uses cuboid-per-tile colliders;
 * `ChunkRenderer` uses heightfield colliders; `TrainingIslandScene`
 * has no colliders at all. So there is no other scene to migrate to
 * this worker today — the generalisation here is for the next time
 * we ship trimesh-bake-from-GLB code.
 *
 * Keeping this off the main thread means the loading overlay's CSS
 * sweep and AssetLoader progress updates keep ticking at a clean
 * 60 fps even if the triangle budget is doubled — the previous
 * `requestAnimationFrame`-sliced version still ate ~4 ms per frame
 * on the main thread, which started showing up as overlay jank on
 * slower machines.
 */

/**
 * Raw geometry for a single source mesh: a flat copy of `position`
 * (`[x,y,z,x,y,z,…]`), a 32-bit-widened index buffer (or `null` for
 * non-indexed geometry where each consecutive triple of vertices is a
 * triangle), and a 16-element column-major combined matrix
 * (`wrapMat * mesh.matrixWorld`). The matrix is pre-baked on the main
 * thread so the worker just multiplies vertices.
 */
export interface BakeCandidateGeom {
  positions: Float32Array;
  indices: Uint32Array | null;
  matrix: Float32Array;
}

/**
 * One logical collider's worth of input. A "group" can be a single
 * mesh (the ground-bake case — each walkable mesh becomes its own
 * trimesh) or several sub-meshes that should be welded into one
 * collider (the rock-bake case — a harvestable rock can be a parent
 * node with multiple LOD/material splits underneath, but the player
 * shouldn't be able to walk between them).
 */
export interface BakeCandidateGroup {
  /** Original GLB node name — used purely for debug logging. */
  name: string;
  geoms: BakeCandidateGeom[];
}

export interface BakeWorkerRequest {
  candidates: BakeCandidateGroup[];
  /**
   * Per-collider triangle cap. A group whose summed triangle count
   * exceeds this is either:
   *   - dropped wholesale (counted in `droppedHighTri`) when
   *     `chunkOversized` is `false` / omitted, OR
   *   - spatially split into multiple sub-colliders (each ≤ this cap)
   *     when `chunkOversized` is `true`. The split count is reported
   *     via `chunkedSources` / `chunkCount` on the response.
   */
  triLimitPerCollider: number;
  /**
   * Hard total cap across all colliders. Once accepted groups push
   * the running total past this, subsequent groups (or chunks) are
   * dropped (counted in `droppedTotal`). The worker iterates in input
   * order, so the caller should sort "most important first".
   */
  totalTriLimit: number;
  /**
   * If `true`, candidates whose tri count exceeds `triLimitPerCollider`
   * are spatially chunked instead of dropped. Used by the tutorial
   * island ground bake so heavy dunes / wreck hulls remain walkable;
   * left `false` for per-rock bakes where each candidate must remain
   * a single physics body.
   */
  chunkOversized?: boolean;
}

/**
 * One baked collider, ready to hand to `<TrimeshCollider args={[…]}>`.
 * The bbox metadata is computed from the post-transform vertices so
 * downstream streaming components don't have to re-walk the geometry.
 */
export interface BakedCollider {
  name: string;
  vertices: Float32Array;
  indices: Uint32Array;
  /**
   * World-space xz centroid of the baked collider, used by streaming
   * components to decide whether the trimesh should be mounted around
   * the player.
   */
  centerX: number;
  centerZ: number;
  /**
   * World-space xz bounding radius. Streaming components compare
   * `playerDist - radius` against the stream threshold so a long
   * mesh whose centroid is far from the player still mounts when the
   * player is standing on its near end.
   */
  radius: number;
}

export interface BakeWorkerResponse {
  colliders: BakedCollider[];
  /** Total triangles across all accepted colliders. */
  totalTris: number;
  /**
   * Groups skipped because their summed triangle count exceeded the
   * per-collider cap. Always `0` when the request set
   * `chunkOversized: true` — those groups are split rather than dropped.
   */
  droppedHighTri: number;
  /** Groups skipped because they would have pushed past the total-tri cap. */
  droppedTotal: number;
  /**
   * Source candidates whose tri count exceeded `triLimitPerCollider`
   * and were spatially split into multiple sub-colliders. Always `0`
   * when the request did not set `chunkOversized: true`. Reported
   * separately so the bake log can distinguish a clean 1:1 mapping
   * from "this dune ridge had to be cut".
   */
  chunkedSources: number;
  /**
   * Total chunk colliders produced from the chunked sources above
   * (e.g. 3 sources splitting 2/3/4 ways gives `chunkCount=9`).
   * Useful for sanity-checking the chunking branch.
   */
  chunkCount: number;
  /** Worker-side wall-clock elapsed for the per-vertex pass, in ms. */
  elapsedMs: number;
}

/**
 * `Vector3.applyMatrix4` open-coded against the column-major Matrix4
 * elements layout that Three.js uses (so the worker doesn't pull in
 * Three.js itself). Writes directly into `out[idx..idx+2]`.
 */
function applyMatrix4(
  out: Float32Array,
  m: Float32Array,
  x: number,
  y: number,
  z: number,
  idx: number,
): void {
  const w = 1 / (m[3] * x + m[7] * y + m[11] * z + m[15]);
  out[idx] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * w;
  out[idx + 1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * w;
  out[idx + 2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) * w;
}

/**
 * Split an oversized group's combined index buffer into chunks each
 * ≤ `triLimit` triangles. Operates against an iterative xz-bbox
 * midpoint partition (longest axis), which gives reasonably square
 * chunks for the broad, roughly-flat dune ridges and wreck-hull
 * skirts that triggered this code path. Vertices are NOT remapped
 * here — `compactChunk` does that per-chunk.
 *
 * If a midpoint split degenerates (every triangle's centroid ends up
 * on one side, e.g. a long thin ridge with most density at one end),
 * we fall back to splitting by triangle order so termination is
 * guaranteed. The DFS uses an explicit stack so deeply-divisible
 * meshes don't risk the JS recursion limit.
 */
function splitIntoChunks(
  bakedVerts: Float32Array,
  inds: Uint32Array,
  triLimit: number,
  out: Uint32Array[],
): void {
  const stack: Uint32Array[] = [inds];
  while (stack.length > 0) {
    const cur = stack.pop() as Uint32Array;
    const triCount = (cur.length / 3) | 0;
    if (triCount <= triLimit) {
      out.push(cur);
      continue;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let t = 0; t < cur.length; t++) {
      const v = cur[t] * 3;
      const x = bakedVerts[v];
      const z = bakedVerts[v + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const splitX = maxX - minX >= maxZ - minZ;
    const mid = splitX ? (minX + maxX) * 0.5 : (minZ + maxZ) * 0.5;

    // Two-pass: count first so we can allocate exact-size chunk
    // buffers (no Array.push reallocation).
    let lTris = 0;
    let rTris = 0;
    for (let t = 0; t < cur.length; t += 3) {
      const a = cur[t] * 3;
      const b = cur[t + 1] * 3;
      const c = cur[t + 2] * 3;
      const ca = splitX
        ? (bakedVerts[a] + bakedVerts[b] + bakedVerts[c]) * (1 / 3)
        : (bakedVerts[a + 2] + bakedVerts[b + 2] + bakedVerts[c + 2]) *
          (1 / 3);
      if (ca < mid) lTris += 1;
      else rTris += 1;
    }

    let left: Uint32Array;
    let right: Uint32Array;
    if (lTris === 0 || rTris === 0) {
      // Degenerate split — fall back to a triangle-order halving so
      // we still make forward progress.
      const halfTri = (triCount / 2) | 0;
      const cut = halfTri * 3;
      left = new Uint32Array(cut);
      right = new Uint32Array(cur.length - cut);
      left.set(cur.subarray(0, cut));
      right.set(cur.subarray(cut));
    } else {
      left = new Uint32Array(lTris * 3);
      right = new Uint32Array(rTris * 3);
      let li = 0;
      let ri = 0;
      for (let t = 0; t < cur.length; t += 3) {
        const a = cur[t] * 3;
        const b = cur[t + 1] * 3;
        const c = cur[t + 2] * 3;
        const ca = splitX
          ? (bakedVerts[a] + bakedVerts[b] + bakedVerts[c]) * (1 / 3)
          : (bakedVerts[a + 2] + bakedVerts[b + 2] + bakedVerts[c + 2]) *
            (1 / 3);
        if (ca < mid) {
          left[li++] = cur[t];
          left[li++] = cur[t + 1];
          left[li++] = cur[t + 2];
        } else {
          right[ri++] = cur[t];
          right[ri++] = cur[t + 1];
          right[ri++] = cur[t + 2];
        }
      }
    }
    // Push right first so left is processed next (DFS order doesn't
    // matter for correctness, just keeps logs roughly source-ordered).
    stack.push(right);
    stack.push(left);
  }
}

/**
 * Compact a chunk's vertex set so the resulting collider only carries
 * the verts referenced by its indices. The shared parent vertex array
 * may be 100 k+ entries; without compaction every chunk would ship the
 * entire buffer to the main thread and Rapier would index a mostly-
 * empty trimesh. Also computes the chunk's xz bbox in the same pass
 * so the streaming layer has a fresh per-chunk centroid + radius.
 */
function compactChunk(
  name: string,
  bakedVerts: Float32Array,
  chunkInds: Uint32Array,
): BakedCollider {
  const sourceVertCount = (bakedVerts.length / 3) | 0;
  // -1 marker = "not yet copied into the chunk's local vert list".
  // `Int32Array(N).fill(-1)` is a single native pass.
  const remap = new Int32Array(sourceVertCount).fill(-1);
  const newInds = new Uint32Array(chunkInds.length);
  let nextV = 0;
  for (let i = 0; i < chunkInds.length; i++) {
    const old = chunkInds[i];
    let n = remap[old];
    if (n === -1) {
      n = nextV++;
      remap[old] = n;
    }
    newInds[i] = n;
  }
  const verts = new Float32Array(nextV * 3);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let old = 0; old < sourceVertCount; old++) {
    const n = remap[old];
    if (n === -1) continue;
    const o = old * 3;
    const d = n * 3;
    const x = bakedVerts[o];
    const y = bakedVerts[o + 1];
    const z = bakedVerts[o + 2];
    verts[d] = x;
    verts[d + 1] = y;
    verts[d + 2] = z;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const halfX = (maxX - minX) * 0.5;
  const halfZ = (maxZ - minZ) * 0.5;
  const radius = Math.sqrt(halfX * halfX + halfZ * halfZ);
  return {
    name,
    vertices: verts,
    indices: newInds,
    centerX: (minX + maxX) * 0.5,
    centerZ: (minZ + maxZ) * 0.5,
    radius,
  };
}

self.onmessage = (e: MessageEvent<BakeWorkerRequest>) => {
  const startedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const { candidates, triLimitPerCollider, totalTriLimit } = e.data;
  const chunkOversized = e.data.chunkOversized === true;

  const colliders: BakedCollider[] = [];
  const transfers: ArrayBuffer[] = [];
  let totalTris = 0;
  let droppedHighTri = 0;
  let droppedTotal = 0;
  let chunkedSources = 0;
  let chunkCount = 0;

  for (let c = 0; c < candidates.length; c++) {
    const group = candidates[c];
    const geoms = group.geoms;

    // Pre-pass: total vert/tri count for the group, and per-mesh
    // tri counts (used to rebuild the merged index buffer).
    let groupVertCount = 0;
    let groupTriCount = 0;
    for (let g = 0; g < geoms.length; g++) {
      const geom = geoms[g];
      const vc = (geom.positions.length / 3) | 0;
      const tc = geom.indices
        ? (geom.indices.length / 3) | 0
        : (vc / 3) | 0;
      groupVertCount += vc;
      groupTriCount += tc;
    }

    if (groupTriCount === 0 || groupVertCount === 0) {
      // Nothing to bake for this group — silently skip rather than
      // taking up a "dropped" slot, which is reserved for budget hits.
      continue;
    }
    const oversized = groupTriCount > triLimitPerCollider;
    if (oversized && !chunkOversized) {
      // Drop semantics for callers (e.g. rocks) that need each
      // candidate to remain a single physics body.
      droppedHighTri += 1;
      continue;
    }
    if (totalTris + groupTriCount > totalTriLimit) {
      // For both fast-path and chunked groups: if the group can't fit
      // the total budget at all, drop wholesale. Partial-chunk
      // acceptance below only triggers when the budget runs out
      // mid-group, which can't happen if the whole group already
      // doesn't fit.
      droppedTotal += 1;
      continue;
    }

    const verts = new Float32Array(groupVertCount * 3);
    const inds = new Uint32Array(groupTriCount * 3);
    let vertWritten = 0;
    let indWritten = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (let g = 0; g < geoms.length; g++) {
      const geom = geoms[g];
      const positions = geom.positions;
      const matrix = geom.matrix;
      const vc = (positions.length / 3) | 0;
      const vertOffset = vertWritten;

      for (let v = 0; v < vc; v++) {
        const i3In = v * 3;
        const i3Out = (vertOffset + v) * 3;
        applyMatrix4(
          verts,
          matrix,
          positions[i3In],
          positions[i3In + 1],
          positions[i3In + 2],
          i3Out,
        );
        const tx = verts[i3Out];
        const tz = verts[i3Out + 2];
        if (tx < minX) minX = tx;
        if (tx > maxX) maxX = tx;
        if (tz < minZ) minZ = tz;
        if (tz > maxZ) maxZ = tz;
      }
      vertWritten += vc;

      const srcInds = geom.indices;
      if (srcInds) {
        const len = srcInds.length;
        for (let k = 0; k < len; k++) {
          inds[indWritten + k] = srcInds[k] + vertOffset;
        }
        indWritten += len;
      } else {
        for (let k = 0; k < vc; k++) {
          inds[indWritten + k] = k + vertOffset;
        }
        indWritten += vc;
      }
    }

    if (!oversized) {
      // Fast path: ship the welded buffers as-is. The bbox tracked
      // during the per-vertex pass above is exact for the whole
      // collider.
      totalTris += groupTriCount;
      const halfX = (maxX - minX) * 0.5;
      const halfZ = (maxZ - minZ) * 0.5;
      const radius = Math.sqrt(halfX * halfX + halfZ * halfZ);
      colliders.push({
        name: group.name,
        vertices: verts,
        indices: inds,
        centerX: (minX + maxX) * 0.5,
        centerZ: (minZ + maxZ) * 0.5,
        radius,
      });
      transfers.push(verts.buffer);
      transfers.push(inds.buffer);
      continue;
    }

    // Slow path: oversized + caller opted into chunking. Split the
    // welded index buffer along the longest xz axis until every
    // chunk fits the per-collider cap, then compact each chunk's
    // vertex set so it ships only the verts it references. The
    // welded `verts` / `inds` buffers themselves stay inside the
    // worker (they aren't transferred — the compacted per-chunk
    // buffers are).
    const chunks: Uint32Array[] = [];
    splitIntoChunks(verts, inds, triLimitPerCollider, chunks);
    let chunksAccepted = 0;
    for (let k = 0; k < chunks.length; k++) {
      const chunkInds = chunks[k];
      const chunkTris = (chunkInds.length / 3) | 0;
      if (totalTris + chunkTris > totalTriLimit) {
        droppedTotal += 1;
        continue;
      }
      totalTris += chunkTris;
      const out = compactChunk(group.name, verts, chunkInds);
      colliders.push(out);
      transfers.push(out.vertices.buffer);
      transfers.push(out.indices.buffer);
      chunksAccepted += 1;
    }
    if (chunksAccepted > 0) {
      chunkedSources += 1;
      chunkCount += chunksAccepted;
    }
  }

  const elapsedMs =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
    startedAt;

  const response: BakeWorkerResponse = {
    colliders,
    totalTris,
    droppedHighTri,
    droppedTotal,
    chunkedSources,
    chunkCount,
    elapsedMs,
  };

  (self as unknown as Worker).postMessage(response, transfers);
};

// Vite's `?worker` import treats this file as a module — keep the
// default export typing happy under `isolatedModules`.
export {};
