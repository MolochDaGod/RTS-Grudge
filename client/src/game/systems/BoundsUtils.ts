import * as THREE from "three";

const _tempV = new THREE.Vector3();
const _tempPos = new THREE.Vector3();

function computeSkinnedMeshBounds(mesh: THREE.SkinnedMesh): THREE.Box3 {
  const box = new THREE.Box3();
  const geo = mesh.geometry;
  const posAttr = geo.getAttribute("position");
  if (!posAttr) return box;

  const skinIdxAttr = geo.getAttribute("skinIndex") as THREE.BufferAttribute | null;
  const skinWtAttr = geo.getAttribute("skinWeight") as THREE.BufferAttribute | null;

  if (!skinIdxAttr || !skinWtAttr || !mesh.skeleton) {
    geo.computeBoundingBox();
    if (geo.boundingBox) {
      box.copy(geo.boundingBox).applyMatrix4(mesh.matrixWorld);
    }
    return box;
  }

  const skeleton = mesh.skeleton;
  skeleton.update();

  const boneMatrices = skeleton.boneMatrices;
  const bindMatrix = mesh.bindMatrix;
  const bindMatrixInverse = mesh.bindMatrixInverse;

  const maxSamples = Math.min(posAttr.count, 2000);
  const stride = Math.max(1, Math.floor(posAttr.count / maxSamples));

  const skinMat = new THREE.Matrix4();
  const bMat = new THREE.Matrix4();

  const getAttrComp = (attr: THREE.BufferAttribute, idx: number, comp: number): number => {
    if (comp === 0) return attr.getX(idx);
    if (comp === 1) return attr.getY(idx);
    if (comp === 2) return attr.getZ(idx);
    return attr.getW(idx);
  };

  for (let i = 0; i < posAttr.count; i += stride) {
    _tempPos.fromBufferAttribute(posAttr, i);
    _tempPos.applyMatrix4(bindMatrix);

    skinMat.set(0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0);

    for (let j = 0; j < 4; j++) {
      const boneIdx = getAttrComp(skinIdxAttr, i, j);
      const weight = getAttrComp(skinWtAttr, i, j);
      if (weight === 0) continue;
      if (!boneMatrices || boneIdx * 16 + 15 >= boneMatrices.length) continue;

      bMat.fromArray(boneMatrices as ArrayLike<number>, boneIdx * 16);
      for (let k = 0; k < 16; k++) {
        skinMat.elements[k] += bMat.elements[k] * weight;
      }
    }

    _tempPos.applyMatrix4(skinMat);
    _tempPos.applyMatrix4(bindMatrixInverse);
    _tempPos.applyMatrix4(mesh.matrixWorld);

    box.expandByPoint(_tempPos);
  }

  return box;
}

export function computeSkinnedBounds(scene: THREE.Object3D): THREE.Box3 {
  scene.updateMatrixWorld(true);

  const box = new THREE.Box3();
  let hasContent = false;

  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.geometry) return;

    let meshBox: THREE.Box3;

    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      const sm = child as THREE.SkinnedMesh;
      if (sm.skeleton && sm.skeleton.bones.length > 0) {
        try {
          meshBox = computeSkinnedMeshBounds(sm);
          const smSize = meshBox.getSize(_tempV);
          if (smSize.lengthSq() < 1e-10) {
            mesh.geometry.computeBoundingBox();
            const geoBB = mesh.geometry.boundingBox;
            if (!geoBB) return;
            meshBox = geoBB.clone().applyMatrix4(mesh.matrixWorld);
          }
        } catch {
          mesh.geometry.computeBoundingBox();
          const geoBB = mesh.geometry.boundingBox;
          if (!geoBB) return;
          meshBox = geoBB.clone().applyMatrix4(mesh.matrixWorld);
        }
      } else {
        mesh.geometry.computeBoundingBox();
        const geoBB = mesh.geometry.boundingBox;
        if (!geoBB) return;
        meshBox = geoBB.clone().applyMatrix4(mesh.matrixWorld);
      }
    } else {
      mesh.geometry.computeBoundingBox();
      const geoBB = mesh.geometry.boundingBox;
      if (!geoBB) return;
      const geoSize = geoBB.getSize(_tempV);
      if (geoSize.lengthSq() < 1e-10) return;
      meshBox = geoBB.clone().applyMatrix4(mesh.matrixWorld);
    }

    const bSize = meshBox.getSize(_tempV);
    if (bSize.lengthSq() < 1e-10) return;

    if (hasContent) {
      box.union(meshBox);
    } else {
      box.copy(meshBox);
      hasContent = true;
    }
  });

  if (!hasContent) {
    const fallback = new THREE.Box3().setFromObject(scene);
    const fbSize = fallback.getSize(_tempV);
    if (fbSize.lengthSq() < 1e-10) {
      return new THREE.Box3(
        new THREE.Vector3(-0.5, 0, -0.5),
        new THREE.Vector3(0.5, 1.8, 0.5)
      );
    }
    return fallback;
  }

  const size = box.getSize(_tempV);
  if (size.y < 0.001) {
    const fallback = new THREE.Box3().setFromObject(scene);
    const fbSize = fallback.getSize(_tempV);
    if (fbSize.y >= 0.001) return fallback;

    return new THREE.Box3(
      new THREE.Vector3(-0.5, 0, -0.5),
      new THREE.Vector3(0.5, 1.8, 0.5)
    );
  }

  return box;
}

export function measureSceneHeight(scene: THREE.Object3D): number {
  const box = computeSkinnedBounds(scene);
  const size = box.getSize(new THREE.Vector3());
  return size.y;
}

/**
 * THE SINGLE CANONICAL "make this character N meters tall and stand on the
 * ground" function. Both the in-game character pipeline (useCharacterModel)
 * and the Hero Forge preview (CharacterSelectScreen) MUST call this — never
 * compute their own scale formulas, never pick longest-axis vs height-axis
 * on their own. If both pipelines disagree, the player visibly changes size
 * between the preview and the world (the "100x too big" bug).
 *
 * Algorithm:
 *  1. Measure the model's CURRENT height (Y axis, world units) using the
 *     skin-aware bounds computer.
 *  2. Multiply the model's root scale so that height becomes `targetHeight`
 *     metres exactly (clamped against absurd values).
 *  3. Drop the model so its bottom sits at y = 0 (feet on the ground).
 *
 * Per the project's scale blueprint: 1 engine unit = 1 metre, characters
 * are ~1.8 m tall.
 */
export function normalizeCharacterHeight(
  scene: THREE.Object3D,
  targetHeight: number,
): void {
  const MIN_SCALE_FACTOR = 0.0001;
  const MAX_SCALE_FACTOR = 1000;

  scene.updateMatrixWorld(true);
  const beforeBox = computeSkinnedBounds(scene);
  const beforeSize = beforeBox.getSize(new THREE.Vector3());
  const rawHeight = beforeSize.y;

  if (rawHeight > 0.001 && Math.abs(rawHeight - targetHeight) > 0.001) {
    const factor = THREE.MathUtils.clamp(
      targetHeight / rawHeight,
      MIN_SCALE_FACTOR,
      MAX_SCALE_FACTOR,
    );
    scene.scale.multiplyScalar(factor);
    scene.updateMatrixWorld(true);
  }

  // Foot-plant: bottom of the actual rendered (skin-aware) bounds sits on
  // y = 0 in the model-root local frame. Use a plain Box3 here because at
  // this point we want geometry-aware ground contact (skirts, capes, etc.).
  const groundBox = new THREE.Box3().setFromObject(scene);
  if (isFinite(groundBox.min.y)) {
    scene.position.y -= groundBox.min.y;
  }
}
