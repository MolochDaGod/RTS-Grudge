/**
 * Hides the body-mesh face region when a helmet/head slot is equipped.
 */
import * as THREE from "three";

const ORIGINAL_PLANES_KEY = "_helmetFaceClipOriginal";
const CLIP_PLANE_KEY = "_helmetFaceClipPlane";

const HELMET_FACE_RATIO = 0.72;

export interface BodyFaceClipConfig {
  enabled: boolean;
  ratio: number;
}

export function resolveBodyFaceClip(
  _prefix: string,
  headEquipped: boolean,
): BodyFaceClipConfig {
  return { enabled: headEquipped, ratio: HELMET_FACE_RATIO };
}

function meshMaterials(mesh: THREE.Mesh): THREE.Material[] {
  if (!mesh.material) return [];
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function computeFaceClipY(mesh: THREE.Mesh, ratio: number): number {
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const box = geo.boundingBox;
  if (!box) return 0.55;

  const height = box.max.y - box.min.y;
  return box.min.y + height * ratio;
}

function applyClipToMaterial(mat: THREE.Material, enabled: boolean, clipY: number): void {
  if (!(mat as THREE.MeshStandardMaterial).isMaterial) return;

  if (enabled) {
    if (mat.userData[ORIGINAL_PLANES_KEY] === undefined) {
      mat.userData[ORIGINAL_PLANES_KEY] = mat.clippingPlanes
        ? [...mat.clippingPlanes]
        : null;
    }

    let plane = mat.userData[CLIP_PLANE_KEY] as THREE.Plane | undefined;
    if (!plane) {
      plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY);
      mat.userData[CLIP_PLANE_KEY] = plane;
    } else {
      plane.constant = clipY;
    }

    mat.clippingPlanes = [plane];
    mat.clipShadows = true;
    mat.needsUpdate = true;
    return;
  }

  const original = mat.userData[ORIGINAL_PLANES_KEY];
  if (original === undefined) return;
  mat.clippingPlanes = original ? [...original] : [];
  mat.needsUpdate = true;
}

/** Enable or disable face clipping on a single body mesh. */
export function setBodyFaceClip(
  mesh: THREE.Mesh,
  config: BodyFaceClipConfig,
): void {
  const clipY = config.enabled ? computeFaceClipY(mesh, config.ratio) : 0;
  for (const mat of meshMaterials(mesh)) {
    applyClipToMaterial(mat, config.enabled, clipY);
  }
}

/** Sync face clip on all cataloged body meshes. */
export function syncBodyFaceClip(
  bodyMeshes: Iterable<THREE.Object3D>,
  prefix: string,
  headEquipped: boolean,
): void {
  const config = resolveBodyFaceClip(prefix, headEquipped);
  for (const obj of bodyMeshes) {
    if (!(obj as THREE.Mesh).isMesh) continue;
    setBodyFaceClip(obj as THREE.Mesh, config);
  }
}

/** @deprecated Use syncBodyFaceClip */
export function syncHelmetFaceClip(
  bodyMeshes: Iterable<THREE.Object3D>,
  headEquipped: boolean,
): void {
  syncBodyFaceClip(bodyMeshes, "", headEquipped);
}

/** Clear stored clip state when disposing equipment managers. */
export function clearHelmetFaceClip(mesh: THREE.Mesh): void {
  for (const mat of meshMaterials(mesh)) {
    const original = mat.userData[ORIGINAL_PLANES_KEY];
    if (original === undefined) continue;
    mat.clippingPlanes = original ? [...original] : [];
    delete mat.userData[ORIGINAL_PLANES_KEY];
    delete mat.userData[CLIP_PLANE_KEY];
    mat.needsUpdate = true;
  }
}