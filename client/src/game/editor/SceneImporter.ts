/**
 * SceneImporter — turns a loaded GLB into the editor's SceneObject tree.
 *
 * Why this exists
 *   Today the editor's "model" SceneObject loads a whole GLB at one node;
 *   you can't pick the "Shipwreck" or "rock_03" inside the tutorial island
 *   GLB and edit its transform independently. This importer walks the GLB's
 *   Three.js scene graph, creates one SceneObject per meaningful node with
 *   parent/child pointers preserved, and stamps each one with the path it
 *   came from inside the GLB so the editor viewport can pull the right
 *   subtree out at render time.
 *
 * What gets a SceneObject
 *   Every Object3D in the GLB whose `name` is non-empty is exported. We
 *   include Groups, Meshes and Bones-of-interest. We skip cameras and
 *   anonymous wrapper nodes (no name) — they collapse into their parent's
 *   path so the resulting tree is what an artist would expect to see.
 *
 * Local transforms
 *   Each emitted SceneObject carries the node's LOCAL position/rotation/
 *   scale (relative to its parent). Combined with parentId chaining this
 *   reproduces the original world placement exactly when rendered.
 *
 * Materials and textures
 *   We do NOT copy material data into SceneObject. Materials, textures and
 *   geometry stay attached to the GLB itself. EditorViewport renders a
 *   modelNode by re-resolving the live subtree from the cached GLB by
 *   `nodePath`, so materials/textures come along for free.
 */

import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { SceneObject } from "./EditorStore";

export interface ImportGLBOptions {
  /** Override the root SceneObject's display name. Defaults to GLB filename. */
  rootName?: string;
  /**
   * Uniform scale applied at the imported root SceneObject. Use this for
   * GLBs authored in centimetres (set to 0.01) without having to scale
   * every individual child.
   */
  rootScale?: number;
  /**
   * If true, emit a SceneObject for every named child (default).
   * If false, only the root is emitted as a single SceneObject — useful
   * for prefab placement when the user doesn't want to clutter the
   * hierarchy with every plank and stone.
   */
  walkChildren?: boolean;
}

/**
 * Returned by `glbToSceneObjects`. The objects are NOT yet committed to
 * the store — the caller (typically `useEditorStore.importGLBAsHierarchy`)
 * is responsible for `pushHistory()` + appending them.
 */
export interface ImportedScene {
  rootId: string;
  objects: Omit<SceneObject, never>[];
}

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function decomposeLocal(obj: THREE.Object3D): {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
} {
  const e = new THREE.Euler().setFromQuaternion(obj.quaternion, "XYZ");
  return {
    position: [obj.position.x, obj.position.y, obj.position.z],
    rotation: [e.x, e.y, e.z],
    scale: [obj.scale.x, obj.scale.y, obj.scale.z],
  };
}

/**
 * Decompose `child`'s transform expressed RELATIVE TO `emittedParent`,
 * not relative to `child.parent`. This is what callers want when one or
 * more anonymous wrapper nodes sit between the two — those wrappers may
 * carry non-identity transforms that would otherwise be lost when we
 * collapse them out of the SceneObject tree (architect callout).
 *
 * Algorithm: relativeMatrix = inverse(emittedParent.matrixWorld) * child.matrixWorld
 * The caller is responsible for having called `updateMatrixWorld(true)`
 * on the GLB scene root first so matrixWorld values are accurate.
 */
function decomposeRelativeTo(
  child: THREE.Object3D,
  emittedParent: THREE.Object3D,
): {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
} {
  const inv = new THREE.Matrix4().copy(emittedParent.matrixWorld).invert();
  const rel = new THREE.Matrix4().multiplyMatrices(inv, child.matrixWorld);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  rel.decompose(pos, quat, scl);
  const e = new THREE.Euler().setFromQuaternion(quat, "XYZ");
  return {
    position: [pos.x, pos.y, pos.z],
    rotation: [e.x, e.y, e.z],
    scale: [scl.x, scl.y, scl.z],
  };
}

/**
 * Build the slash-separated `nodePath` that locates a node inside the
 * imported GLB. Path is relative to the GLB's `gltf.scene` root and uses
 * each node's `name`. Anonymous (empty-name) ancestors are stepped over
 * without contributing a segment, matching what gets emitted as
 * SceneObjects.
 */
function buildNodePath(node: THREE.Object3D, root: THREE.Object3D): string {
  const segments: string[] = [];
  let cursor: THREE.Object3D | null = node;
  while (cursor && cursor !== root) {
    if (cursor.name) segments.unshift(cursor.name);
    cursor = cursor.parent;
  }
  return segments.join("/");
}

/**
 * Resolve a `nodePath` back to the live Object3D inside a loaded GLB.
 * Returns null if the path no longer matches (asset rebaked, name
 * collision, etc.) — callers should fall back to a placeholder mesh.
 */
export function resolveNodePath(gltfScene: THREE.Object3D, nodePath: string): THREE.Object3D | null {
  if (!nodePath) return gltfScene;
  const segments = nodePath.split("/");
  let cursor: THREE.Object3D | null = gltfScene;
  for (const seg of segments) {
    if (!cursor) return null;
    let next: THREE.Object3D | null = null;
    cursor.traverse((c) => {
      if (next) return;
      if (c !== cursor && c.name === seg && c.parent === cursor) {
        next = c;
      }
    });
    // Fallback: any descendant with matching name (handles anonymous wrappers).
    if (!next) {
      cursor.traverse((c) => {
        if (next) return;
        if (c !== cursor && c.name === seg) next = c;
      });
    }
    cursor = next;
  }
  return cursor;
}

function shouldEmitNode(node: THREE.Object3D, isRoot: boolean): boolean {
  if (isRoot) return true;
  if (!node.name) return false;
  // Skip cameras — the editor has its own camera control.
  if ((node as THREE.Camera).isCamera) return false;
  return true;
}

/**
 * Walk a loaded GLB's scene graph and produce a SceneObject tree.
 *
 * The returned `objects` are fresh — none have been added to the store
 * yet. The first entry (`objects[0]`, also identified by `rootId`) is
 * the imported root group; the rest hang off it via `parentId`.
 */
export function glbToSceneObjects(
  gltf: Pick<GLTF, "scene">,
  sourceGlbPath: string,
  opts: ImportGLBOptions = {},
): ImportedScene {
  const walkChildren = opts.walkChildren !== false;
  const rootScale = opts.rootScale ?? 1;
  const rootName =
    opts.rootName ??
    sourceGlbPath.split("/").pop()?.replace(/\.glb$/i, "") ??
    "Imported GLB";

  const objects: SceneObject[] = [];
  // Map a live Object3D to the SceneObject id we've assigned it, so we
  // can wire parentId/children correctly when we encounter children.
  const idByObject = new Map<THREE.Object3D, string>();

  const rootId = genId();
  idByObject.set(gltf.scene, rootId);

  const root: SceneObject = {
    id: rootId,
    name: rootName,
    type: "modelNode",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [rootScale, rootScale, rootScale],
    visible: true,
    locked: false,
    properties: {
      sourceGlb: sourceGlbPath,
      nodePath: "",
      isImportedRoot: true,
    },
  };
  objects.push(root);

  if (!walkChildren) {
    return { rootId, objects };
  }

  // Make sure matrixWorld values are current — we use them to compute
  // child transforms relative to their nearest emitted ancestor (which
  // may be several anonymous wrappers up the chain).
  gltf.scene.updateMatrixWorld(true);

  // Two-pass: first allocate ids for every emitted node so children/
  // parentId can reference each other regardless of traversal order;
  // then fill in transforms + parentage + paths.
  gltf.scene.traverse((node) => {
    if (node === gltf.scene) return;
    if (!shouldEmitNode(node, false)) return;
    idByObject.set(node, genId());
  });

  // Nearest emitted ancestor — collapses anonymous wrappers into the
  // closest tagged ancestor so the editor tree mirrors what an artist
  // sees. Returns the Object3D itself (or `gltf.scene` for the root) so
  // callers can compute the relative transform.
  function nearestEmittedAncestor(node: THREE.Object3D): THREE.Object3D {
    let cursor: THREE.Object3D | null = node.parent;
    while (cursor) {
      if (idByObject.has(cursor)) return cursor;
      cursor = cursor.parent;
    }
    return gltf.scene;
  }

  gltf.scene.traverse((node) => {
    if (node === gltf.scene) return;
    const id = idByObject.get(node);
    if (!id) return;

    const emittedParent = nearestEmittedAncestor(node);
    const parentId = idByObject.get(emittedParent) ?? rootId;
    // If the immediate Three parent is the emitted parent, the cheap
    // local decompose is exact. If anonymous wrappers sit between, fold
    // their transforms into ours via a world-relative decompose so we
    // don't drop translations/rotations/scale that the artist baked
    // into wrapper nodes.
    const transform =
      node.parent === emittedParent
        ? decomposeLocal(node)
        : decomposeRelativeTo(node, emittedParent);
    const so: SceneObject = {
      id,
      name: node.name || `node_${id.slice(0, 6)}`,
      type: "modelNode",
      parentId,
      position: transform.position,
      rotation: transform.rotation,
      scale: transform.scale,
      visible: node.visible,
      locked: false,
      properties: {
        sourceGlb: sourceGlbPath,
        nodePath: buildNodePath(node, gltf.scene),
        isMesh: (node as THREE.Mesh).isMesh === true,
        isBone: (node as THREE.Bone).isBone === true,
      },
    };
    objects.push(so);
  });

  // Fill children[] arrays from parentId.
  const childrenByParent = new Map<string, string[]>();
  for (const o of objects) {
    if (!o.parentId) continue;
    const arr = childrenByParent.get(o.parentId) ?? [];
    arr.push(o.id);
    childrenByParent.set(o.parentId, arr);
  }
  for (const o of objects) {
    const kids = childrenByParent.get(o.id);
    if (kids && kids.length > 0) o.children = kids;
  }

  return { rootId, objects };
}
