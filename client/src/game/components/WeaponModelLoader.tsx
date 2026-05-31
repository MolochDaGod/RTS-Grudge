import * as THREE from "three";
import type { WeaponType } from "@/lib/stores/useGame";
import { loadAsset, onFailedAssetsCleared } from "../systems/AssetLoader";
import { ALL_WEAPON_CATALOG, WEAPON_TEXTURES } from "../systems/ModelRegistry";
import { importFromScene } from "../systems/AssetPipeline";
import { OFF_HAND_GRIP_LOCAL } from "../systems/WeaponIK";

export const WEAPON_REAL_SIZES: Record<string, number> = {
  sword: 0.85,
  greatsword: 1.3,
  axe: 0.75,
  poleaxe: 1.6,
  hammer: 0.8,
  dagger: 0.35,
  staff: 1.5,
  wand: 0.45,
  bow: 1.1,
  crossbow: 0.7,
  gun: 0.6,
  shield: 0.6,
  cane: 0.9,
  arrow: 0.7,
};

/**
 * Where along the weapon's long axis the grip sits, expressed as a fraction
 * from the "pommel" (low) end (0.0) to the "tip" (high) end (1.0). The
 * weapon is shifted so this point ends up at the local origin (and therefore
 * coincides with the hand bone after attachment).
 *
 * Melee weapons root at 0.0 — the very bottom (pommel end) sits AT the hand
 * bone, blade extending up. Staves/bows/shields stay centered at 0.5.
 * Cane is centered (held in the middle). Wand near the bottom.
 */
const GRIP_ANCHOR_RATIO: Record<string, number> = {
  sword: 0.0,
  greatsword: 0.0,
  dagger: 0.0,
  axe: 0.0,
  poleaxe: 0.0,
  hammer: 0.0,
  staff: 0.5,
  wand: 0.05,
  bow: 0.5,
  crossbow: 0.0,
  gun: 0.0,
  shield: 0.5,
  cane: 0.5,
  arrow: 0.5,
};

/**
 * Single source of truth for weapon-to-hand alignment. Mutates `group`
 * in place so the outer transform stays identity (ready for the bone
 * attachment step) while an inner wrapper holds:
 *  1) a rotation that maps the weapon's longest axis to +Y, and
 *  2) a translation that puts the weapon's grip-anchor (defined by
 *     GRIP_ANCHOR_RATIO per weapon type) at the local origin.
 *
 * Used by both the GLB loader path and the procedural-mesh fallback
 * path so every weapon, regardless of source, presents the same
 * predictable frame to applyWeaponTransformToBone.
 */
export function normalizeWeaponGroup(
  group: THREE.Group,
  weaponType: string,
  debugLabel?: string,
): void {
  const originalChildren = [...group.children];
  if (originalChildren.length === 0) return;
  const inner = new THREE.Group();
  inner.name = "weapon_inner";
  for (const child of originalChildren) {
    group.remove(child);
    inner.add(child);
  }

  // Step 1: detect dominant axis from the unrotated bounding box and
  // rotate inner so that axis becomes +Y.
  //  - X-longest -> Rz(+π/2): +X maps to +Y
  //  - Z-longest -> Rx(-π/2): +Z maps to +Y
  //  - Y-longest -> no rotation
  // 1.05 hysteresis avoids flipping near-cubic shapes (e.g. shields).
  const preBox = new THREE.Box3().setFromObject(inner);
  const preSize = preBox.getSize(new THREE.Vector3());
  const longest = Math.max(preSize.x, preSize.y, preSize.z);
  let dominantAxis: "x" | "y" | "z" = "y";
  if (preSize.x === longest && preSize.x > preSize.y * 1.05) {
    inner.rotation.set(0, 0, Math.PI / 2);
    dominantAxis = "x";
  } else if (preSize.z === longest && preSize.z > preSize.y * 1.05) {
    inner.rotation.set(-Math.PI / 2, 0, 0);
    dominantAxis = "z";
  }
  inner.updateMatrixWorld(true);

  // Step 2: re-measure in the rotated frame and shift the inner wrapper
  // so the grip anchor sits at the origin.
  const box = new THREE.Box3().setFromObject(inner);
  const center = box.getCenter(new THREE.Vector3());
  const aligned = box.getSize(new THREE.Vector3());
  const height = aligned.y > 1e-4 ? aligned.y : longest;
  const gripRatio = GRIP_ANCHOR_RATIO[weaponType] ?? 0.0;
  inner.position.x -= center.x;
  inner.position.y -= center.y - height * (0.5 - gripRatio);
  inner.position.z -= center.z;

  group.add(inner);
  group.position.set(0, 0, 0);
  group.rotation.set(0, 0, 0);
  group.scale.set(1, 1, 1);

  if (import.meta.env.DEV) {
    const label = debugLabel ? `${debugLabel} (${weaponType})` : weaponType;
    console.log(
      `[normalizeWeaponGroup] ${label} preSize=` +
      `(${preSize.x.toFixed(3)}, ${preSize.y.toFixed(3)}, ${preSize.z.toFixed(3)}) ` +
      `dominant=${dominantAxis} gripRatio=${gripRatio} height=${height.toFixed(3)}`,
    );
  }
}

const modelCache = new Map<string, THREE.Group>();
const textureCache = new Map<string, THREE.Texture>();
const loadingPromises = new Map<string, Promise<THREE.Group>>();

function getTextureForType(weaponType: string): THREE.Texture | null {
  const texPath = WEAPON_TEXTURES[weaponType];
  if (!texPath) return null;

  if (textureCache.has(texPath)) return textureCache.get(texPath)!;

  // Load with error handler — atlas PNGs may not exist for all weapon types.
  // Return null on failure so the weapon renders with its embedded material
  // colors instead of a broken texture reference.
  const loader = new THREE.TextureLoader();
  const tex = loader.load(
    texPath,
    undefined,
    undefined,
    () => {
      // 404 — atlas not deployed. Remove from cache so we don't retry.
      textureCache.delete(texPath);
    },
  );
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(texPath, tex);
  return tex;
}

function resolveModelPath(entry: { path: string; format: string }): string {
  if (entry.format === "fbx") {
    const glbPath = entry.path.replace(/\.fbx$/i, '.glb');
    return glbPath;
  }
  return entry.path;
}

export function loadWeaponModel(
  weaponType: WeaponType | string,
  modelId: string
): Promise<THREE.Group> {
  const cacheKey = `${weaponType}_${modelId}`;

  if (modelCache.has(cacheKey)) {
    const cached = modelCache.get(cacheKey)!;
    return Promise.resolve(cached.clone());
  }

  if (loadingPromises.has(cacheKey)) {
    return loadingPromises.get(cacheKey)!.then((g) => g.clone());
  }

  const entry = ALL_WEAPON_CATALOG.find((w) => w.id === modelId);
  if (!entry) {
    return Promise.reject(new Error(`Weapon model not found: ${modelId}`));
  }

  const modelPath = resolveModelPath(entry);

  // Route through shared loadAsset so retry/fallback/queueing live in one place.
  // The cache here stores a *post-import* Group (sized + grip-tagged) — distinct
  // from AssetLoader's raw GLTF cache, which is why this layer still exists.
  const promise = loadAsset(modelPath, "high", `weapon_${modelId}`)
    .then((gltf) => {
      const texture = entry.skipTextureAtlas ? null : getTextureForType(weaponType as string);
      const baseSize = WEAPON_REAL_SIZES[weaponType as string] || 0.8;
      const targetSize = baseSize * (entry.sizeBias ?? 1);

      const normalized = importFromScene(gltf.scene, gltf.animations || [], `weapon_${modelId}`, {
        targetHeight: targetSize,
        sanitizeBones: false,
        fixDarkMaterials: true,
        enableShadows: true,
        textureAtlas: texture || undefined,
        // Weapons may be modeled along any axis (KayKit `bow_A` is X-long,
        // reference `Bow.glb` is X=245, `Arming_Sword.glb` is Z=122). Normalize
        // by the longest extent so the in-hand size matches `WEAPON_REAL_SIZES`
        // regardless of orientation. For Y-long weapons this is identical to
        // the previous Y-only behavior.
        normalizeAxis: "longest",
      });

      const group = new THREE.Group();
      group.name = `weapon_model_${modelId}`;
      group.add(normalized.scene);
      normalizeWeaponGroup(group, weaponType as string, modelId);

      // Tag the off-hand IK target in weapon-local space.
      const gripOverride = entry.offHandGripLocal;
      const defaultGrip = OFF_HAND_GRIP_LOCAL[weaponType as WeaponType];
      if (gripOverride) {
        group.userData.offHandGripLocal = new THREE.Vector3(...gripOverride);
      } else if (defaultGrip) {
        group.userData.offHandGripLocal = defaultGrip.clone();
      }

      // Propagate fallback marker so callers can react (e.g. dev UI badge).
      if (gltf.userData?.isAssetFallback) {
        group.userData.isAssetFallback = true;
        group.userData.failedPath = gltf.userData.failedPath;
      }

      modelCache.set(cacheKey, group);
      loadingPromises.delete(cacheKey);
      return group.clone();
    })
    .catch((error) => {
      // loadAsset only rejects on truly unrecoverable errors (failed paths
      // already resolve with the magenta cube). Propagate so UI can react.
      loadingPromises.delete(cacheKey);
      throw error;
    });

  loadingPromises.set(cacheKey, promise);
  return promise;
}

export function getAvailableModels(weaponType: WeaponType | string) {
  return ALL_WEAPON_CATALOG.filter((w) => w.weaponType === weaponType);
}

export function getWeaponDimensions(
  group: THREE.Object3D
): { width: number; height: number; depth: number } {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  return {
    width: Math.round(size.x * 100) / 100,
    height: Math.round(size.y * 100) / 100,
    depth: Math.round(size.z * 100) / 100,
  };
}

export function clearWeaponCache(): void {
  modelCache.clear();
  loadingPromises.clear();
}

// When the underlying loader's failed-path list is cleared, drop any cached
// post-import groups that were built from a fallback so the next call re-runs
// loadAsset and (hopefully) gets the real model.
onFailedAssetsCleared(() => {
  for (const [k, group] of Array.from(modelCache.entries())) {
    if (group.userData?.isAssetFallback) modelCache.delete(k);
  }
});
