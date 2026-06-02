/**
 * Pack inspector — opens a multi-mesh GLB asset, walks the scene graph,
 * and emits a stable, deterministic UUID + metadata for every mesh inside.
 *
 * Why deterministic: when a user saves a map and reopens it, sub-meshes
 * referenced by id need to resolve to the same primitive. We hash
 * `packId|meshPath` (the dotted path from the root through node names)
 * with a 128-bit seed mixer (cyrb128) and format the result as a
 * canonical UUID v4 string. Same pack, same mesh path → same UUID forever.
 *
 * This is the foundation for the "place individual mesh from a pack"
 * workflow: a tile in the palette can target a specific UUID inside a
 * GLB and we render only that node, not the whole pack.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export interface PackMeshEntry {
  /** Deterministic v4-format UUID. Stable across reloads/runs. */
  uuid: string;
  /** Dotted path from the GLB root through node names, e.g. "Foliage.FernA.Leaf_03" */
  meshPath: string;
  /** Last segment of meshPath — display label */
  name: string;
  /** Triangle count for the primitive */
  triangles: number;
  /** Bounding-box size in metres (world-axis-aligned within the pack) */
  size: [number, number, number];
  /** True if the primitive is a SkinnedMesh (rigged) */
  rigged: boolean;
  /** Material name if any — useful for grouping */
  materialName?: string;
}

/**
 * cyrb128 — a tiny deterministic seed-mixer that produces 4×32-bit ints
 * from a string. Public-domain, originally by Bryc. We use it because it's
 * dependency-free, branchless, and fast enough to call per mesh on load.
 */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703 ^ str.length;
  let h2 = 3144134277 ^ str.length;
  let h3 = 1013904242 ^ str.length;
  let h4 = 2773480762 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/**
 * Format four 32-bit ints as an RFC-4122 v4 UUID string. The version (4)
 * and variant (10) bits are forced so the result is a syntactically valid
 * v4, even though the entropy is deterministic rather than random.
 */
export function stableUuid(seed: string): string {
  const [a, b, c, d] = cyrb128(seed);
  const hex = (n: number, len: number) => n.toString(16).padStart(8, '0').slice(-len);
  // bytes 0-3 / 4-5 / 6-7 / 8-9 / 10-15
  const p1 = hex(a, 8);
  const p2 = hex(b >>> 16, 4);
  // version nibble = 4
  const p3 = '4' + hex(b, 4).slice(1);
  // variant nibble: top 2 bits = 10 → first hex char ∈ {8,9,a,b}
  const variantNibble = ((c >>> 28) & 0x3) | 0x8;
  const p4 = variantNibble.toString(16) + hex(c, 4).slice(1);
  const p5 = hex(c >>> 8, 4) + hex(d, 8);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

// Module-level cache so we only fetch+parse each GLB once even if multiple
// palette tiles inspect the same pack URL.
const packCache = new Map<string, Promise<PackMeshEntry[]>>();

/**
 * Inspect a multi-mesh GLB and return every Mesh / SkinnedMesh inside,
 * each tagged with a stable per-mesh UUID derived from `packId|meshPath`.
 *
 * @param url    Resolved GLB URL (typically from LandscapeAssets.assetUrl)
 * @param packId Stable identifier for the pack (e.g. AssetSpec.id) — used
 *               as the namespace for UUID derivation so two different
 *               packs that happen to contain a mesh named "Trunk" get
 *               different UUIDs for those meshes.
 */
export function inspectPack(url: string, packId: string): Promise<PackMeshEntry[]> {
  const key = `${packId}\0${url}`;
  const hit = packCache.get(key);
  if (hit) return hit;

  const promise = (async () => {
    const loader = new GLTFLoader();
    // Wire DRACO so compressed packs (KHR_draco_mesh_compression) decode.
    // Use the same Khronos CDN drei points at internally, for consistency.
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(draco);

    const gltf = await loader.loadAsync(url);
    const out: PackMeshEntry[] = [];

    // Ensure world matrices are current before we sample bounding boxes —
    // a GLB pack typically transforms its sub-meshes (rotate, scale, offset)
    // and the geometry-local AABB alone would be misleading.
    gltf.scene.updateMatrixWorld(true);

    // Walk the scene graph, building a path of "name#siblingIndex" segments.
    // The sibling-index suffix guarantees uniqueness even when a parent
    // contains multiple children with the same name (very common in GLBs
    // exported from Blender — "Cube", "Cube.001" can collapse to "Cube").
    const tmpBox = new THREE.Box3();
    const tmpSize = new THREE.Vector3();
    const visit = (obj: THREE.Object3D, parentPath: string[], siblingIdx: number) => {
      const baseName = obj.name || obj.type;
      const seg = `${baseName}#${siblingIdx}`;
      const path = obj === gltf.scene ? parentPath : [...parentPath, seg];
      const meshLike = obj as THREE.Mesh;
      if (meshLike.isMesh || (obj as THREE.SkinnedMesh).isSkinnedMesh) {
        const geom = meshLike.geometry as THREE.BufferGeometry;
        // Triangle count — index buffer wins, else position-vertex/3.
        const tris = geom.index
          ? geom.index.count / 3
          : (geom.getAttribute('position')?.count ?? 0) / 3;
        // World-space AABB so reported size reflects the mesh as it appears
        // inside the pack (after parent transforms).
        tmpBox.setFromObject(meshLike);
        tmpBox.getSize(tmpSize);
        const size: [number, number, number] = [
          +tmpSize.x.toFixed(3),
          +tmpSize.y.toFixed(3),
          +tmpSize.z.toFixed(3),
        ];
        const meshPath = path.join('.');
        const mat = meshLike.material as THREE.Material | THREE.Material[] | undefined;
        const matName = Array.isArray(mat) ? mat[0]?.name : mat?.name;
        out.push({
          uuid: stableUuid(`${packId}|${meshPath}`),
          meshPath,
          name: baseName,
          triangles: Math.round(tris),
          size,
          rigged: !!(obj as THREE.SkinnedMesh).isSkinnedMesh,
          materialName: matName || undefined,
        });
      }
      obj.children.forEach((child, i) => visit(child, path, i));
    };
    visit(gltf.scene, [], 0);
    // Sort heaviest-first so the inspector UI surfaces the visually
    // important meshes (the actual tree/rock/crystal) before tiny details.
    out.sort((a, b) => b.triangles - a.triangles);
    return out;
  })();

  packCache.set(key, promise);
  return promise;
}

/**
 * Convenience: filter inspect results to "interesting" meshes only —
 * useful for auto-populating a palette without surfacing 200 leaf cards
 * from a tropical pack. Drops anything under `minTriangles` (default 32).
 */
export function pickPlaceableMeshes(
  entries: PackMeshEntry[],
  minTriangles = 32,
): PackMeshEntry[] {
  return entries.filter((e) => e.triangles >= minTriangles);
}
