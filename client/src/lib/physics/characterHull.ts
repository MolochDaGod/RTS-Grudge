import * as THREE from "three";

/**
 * Convex-hull point sampling for character meshes.
 *
 * Walks an Object3D root, pulls vertex positions out of every Mesh /
 * SkinnedMesh, transforms them into the root's LOCAL frame, and
 * returns a flat Float32Array suitable for `<ConvexHullCollider args={[points]}>`.
 *
 * Skinning: for SkinnedMesh we run `applyBoneTransform(i, v)` per vertex,
 * which folds in the CURRENT skeleton pose — including any body-morph
 * bone scales the caller has applied to the rig. So if you call
 * `applyBodyMorph(scene, ...)` BEFORE sampling, the resulting hull
 * tracks the morphed silhouette (broad warrior vs. slim ranger), not
 * the bind pose. For non-skinned meshes we use raw geometry positions
 * since they have no skeleton to deform them.
 *
 * Why a point cloud and not a triangle list: Rapier's ConvexHullCollider
 * builds the hull internally via QuickHull. Feeding triangles would just
 * waste memory — only the extremal points survive the hull.
 */

export interface HullSampleOptions {
  /** Hard cap on points after subsampling. Rapier's hull builder is fast,
   *  but the hull is recomputed on collider re-key, so keep this modest.
   *  ~1500 covers a 5k-tri humanoid silhouette without visible loss. */
  maxPoints?: number;
  /** Skip meshes whose name matches (weapons, hair, FX, eye decals, etc.). */
  ignoreNames?: RegExp;
  /** Skip meshes whose material name matches (e.g. transparent FX). */
  ignoreMaterialNames?: RegExp;
}

const DEFAULT_OPTS: Required<HullSampleOptions> = {
  maxPoints: 1500,
  // Match the noun stems we use in the asset registry — see
  // `client/public/models/weapons` + character accessory naming.
  ignoreNames:
    /weapon|sword|axe|bow|gun|arrow|shield|staff|dagger|hammer|spear|wand|hair|effect|fx|eye|tooth|claw|aura|trail|particle/i,
  ignoreMaterialNames: /transparent|alpha|fx|glow/i,
};

export function sampleCharacterPoints(
  root: THREE.Object3D,
  rootInverseWorld: THREE.Matrix4 | null = null,
  opts: HullSampleOptions = {},
): Float32Array {
  const { maxPoints, ignoreNames, ignoreMaterialNames } = { ...DEFAULT_OPTS, ...opts };

  // We need the root's world transform to map mesh-world space back into
  // root-local space. If the caller doesn't supply an inverse we compute
  // it now — but mutating updateMatrixWorld here is a side effect, so
  // prefer to pass one in when sampling repeatedly.
  let inv = rootInverseWorld;
  if (!inv) {
    root.updateMatrixWorld(true);
    inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  }

  const pts: number[] = [];
  const tmp = new THREE.Vector3();
  const localToRoot = new THREE.Matrix4();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (ignoreNames && (ignoreNames.test(mesh.name) || ignoreNames.test(mesh.parent?.name ?? ""))) return;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (mat && ignoreMaterialNames && ignoreMaterialNames.test(mat.name ?? "")) return;
    const geom = mesh.geometry as THREE.BufferGeometry | undefined;
    const pos = geom?.attributes?.position as THREE.BufferAttribute | undefined;
    if (!pos || pos.count < 4) return;

    mesh.updateMatrixWorld(true);
    localToRoot.copy(inv).multiply(mesh.matrixWorld);

    // SkinnedMesh: applyBoneTransform writes the post-skin position in
    // the mesh's LOCAL frame, which we then push through localToRoot
    // (mesh.matrixWorld → root inverse) just like a static mesh.
    // Critical for body-morph silhouettes: bone scales applied via
    // `applyBodyMorph` only show up in the hull if we sample skinned.
    const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh
      ? (mesh as THREE.SkinnedMesh)
      : null;
    if (skinned && skinned.skeleton) {
      // Make sure bone matrices reflect the current scene pose.
      skinned.skeleton.update();
    }

    // Per-mesh stride: keep at most ~4000 verts per mesh up front so a
    // dense head doesn't blow the budget by itself. Final cap below.
    const total = pos.count;
    const stride = total > 4000 ? Math.ceil(total / 4000) : 1;

    if (skinned) {
      for (let i = 0; i < total; i += stride) {
        // applyBoneTransform reads the bind-pose vertex FROM `tmp` and
        // writes the post-skin vertex back into `tmp` — see three.js
        // SkinnedMesh.js. Forgetting the seed produces nonsense hulls.
        tmp.fromBufferAttribute(pos, i);
        skinned.applyBoneTransform(i, tmp);
        // Reject any NaN/Inf the skinning math throws (degenerate weights,
        // missing bone) so a single bad vertex doesn't poison the hull.
        if (!Number.isFinite(tmp.x) || !Number.isFinite(tmp.y) || !Number.isFinite(tmp.z)) continue;
        tmp.applyMatrix4(localToRoot);
        pts.push(tmp.x, tmp.y, tmp.z);
      }
    } else {
      for (let i = 0; i < total; i += stride) {
        tmp.fromBufferAttribute(pos, i).applyMatrix4(localToRoot);
        pts.push(tmp.x, tmp.y, tmp.z);
      }
    }
  });

  // Final uniform decimation if we're over the global cap.
  const totalPts = pts.length / 3;
  if (totalPts > maxPoints) {
    const stride = Math.ceil(totalPts / maxPoints);
    const out = new Float32Array(Math.ceil(totalPts / stride) * 3);
    let w = 0;
    for (let i = 0; i < pts.length; i += 3 * stride) {
      out[w++] = pts[i];
      out[w++] = pts[i + 1];
      out[w++] = pts[i + 2];
    }
    return out.subarray(0, w);
  }

  return new Float32Array(pts);
}

/**
 * Cheap-but-stable signature of a point cloud — used to re-key the
 * Rapier rigid body / collider whenever the hull changes. Mixes count,
 * AABB extents, and a checksum of a few sample points. Same character
 * scene + same scale + same body morph → same signature, so the
 * collider is NOT rebuilt each frame.
 */
export function pointsSignature(points: Float32Array): string {
  if (points.length < 3) return "empty";
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let sum = 0;
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i], y = points[i + 1], z = points[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    sum += x + y * 1.7 + z * 2.3;
  }
  const dx = (maxX - minX).toFixed(3);
  const dy = (maxY - minY).toFixed(3);
  const dz = (maxZ - minZ).toFixed(3);
  return `${points.length / 3}|${dx}x${dy}x${dz}|${sum.toFixed(2)}`;
}
