import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { computeSkinnedBounds } from "./BoundsUtils";
import {
  RIGHT_HAND_ALIASES, LEFT_HAND_ALIASES,
  HEAD_ALIASES, SPINE2_ALIASES, CHEST_ALIASES,
  RIGHT_FOOT_ALIASES, LEFT_FOOT_ALIASES,
  HIPS_ALIASES, SPINE_ALIASES,
  findBoneByAlias, findBoneNameByAlias,
  detectSkeletonType, detectBodyParts,
  sanitizeBoneName,
  type SkeletonType, type ModelAnalysis, type BodyPartBones,
} from "./BoneAliases";

export type SocketName =
  | "rightHand" | "leftHand"
  | "head" | "back" | "chest"
  | "rightFoot" | "leftFoot"
  | "hips" | "spine";

export interface AttachmentSocket {
  name: SocketName;
  boneName: string;
  boneRef: THREE.Object3D | null;
  localOffset: THREE.Vector3;
  localRotation: THREE.Euler;
}

export interface CollisionShape {
  type: "capsule" | "box" | "sphere";
  center: THREE.Vector3;
  halfExtents: THREE.Vector3;
  radius: number;
  height: number;
}

export interface NormalizedModel {
  id: string;
  scene: THREE.Object3D;
  /**
   * Pre-scale extent of the source mesh along the axis chosen for
   * normalization. With the default `normalizeAxis: 'y'` this is the original
   * Y (height). When the importer is called with `normalizeAxis: 'longest'`
   * (e.g. weapon imports) this is the longest of the X/Y/Z extents instead.
   * Diagnostics tooling that prints "height" should treat this as
   * "normalization extent" to avoid confusing X/Z-long weapons.
   */
  originalHeight: number;
  normalizedScale: number;
  worldUnitsHeight: number;
  skeletonType: SkeletonType;
  analysis: ModelAnalysis;
  bodyParts: BodyPartBones;
  sockets: Map<SocketName, AttachmentSocket>;
  collisionShape: CollisionShape;
  animations: THREE.AnimationClip[];
  mixer: THREE.AnimationMixer | null;
}

export interface ImportOptions {
  targetHeight?: number;
  sanitizeBones?: boolean;
  fixDarkMaterials?: boolean;
  materialOverrides?: Record<string, string>;
  textureAtlas?: THREE.Texture;
  enableShadows?: boolean;
  cloneScene?: boolean;
  /**
   * Which mesh axis to normalize against `targetHeight`.
   * - `'y'` (default): legacy behavior, scales so vertical extent matches `targetHeight`.
   *   Correct for characters and most upright props.
   * - `'longest'`: scales so the longest of the X/Y/Z extents matches `targetHeight`.
   *   Use for weapons whose modeled "long axis" may not be Y (e.g. KayKit `Bow_A`
   *   is X-long, reference `Arming_Sword.glb` is Z-long). Y-long meshes are
   *   unchanged because longest === Y for them.
   */
  normalizeAxis?: "y" | "longest";
}

const DEFAULT_TARGET_HEIGHT = 1.8;
const DARK_LUM_THRESHOLD = 0.08;
const DARK_MATERIAL_FALLBACK = "#8B7355";

const SOCKET_BONE_PRIORITY: Record<SocketName, string[]> = {
  rightHand: RIGHT_HAND_ALIASES,
  leftHand: LEFT_HAND_ALIASES,
  head: HEAD_ALIASES,
  back: SPINE2_ALIASES,
  chest: CHEST_ALIASES,
  rightFoot: RIGHT_FOOT_ALIASES,
  leftFoot: LEFT_FOOT_ALIASES,
  hips: HIPS_ALIASES,
  spine: SPINE_ALIASES,
};

const BACK_SOCKET_OFFSET = new THREE.Vector3(0, 0, -0.15);
const BACK_SOCKET_ROTATION = new THREE.Euler(0, 0, 0);

function sanitizeBoneNames(scene: THREE.Object3D): void {
  scene.traverse((child) => {
    if ((child as THREE.Bone).isBone && child.name.includes(":")) {
      child.name = sanitizeBoneName(child.name);
    }
  });
}

function sanitizeClipTrackNames(clips: THREE.AnimationClip[]): void {
  for (const clip of clips) {
    for (const track of clip.tracks) {
      if (track.name.includes(":")) {
        track.name = sanitizeBoneName(track.name);
      }
    }
  }
}

function applyDarkMaterialFix(scene: THREE.Object3D): void {
  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      const anyMat = mat as any;
      const hasMap = anyMat.map || anyMat.emissiveMap || anyMat.bumpMap || anyMat.normalMap;

      if (anyMat.map) {
        anyMat.map.colorSpace = THREE.SRGBColorSpace;
        anyMat.map.needsUpdate = true;
      }

      if (!hasMap && anyMat.color) {
        const c = anyMat.color as THREE.Color;
        const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
        if (lum < DARK_LUM_THRESHOLD) {
          c.set(DARK_MATERIAL_FALLBACK);
          if (anyMat.roughness !== undefined) anyMat.roughness = Math.max(anyMat.roughness, 0.6);
        }
      }

      if (anyMat.metalness !== undefined && anyMat.metalness > 0.95 && !hasMap) {
        anyMat.metalness = 0.5;
        anyMat.roughness = Math.max(anyMat.roughness || 0, 0.4);
      }

      if (anyMat.transparent && anyMat.opacity < 0.1 && !hasMap) {
        anyMat.transparent = false;
        anyMat.opacity = 1.0;
      }

      anyMat.needsUpdate = true;
    }
  });
}

function applyMaterialOverrides(scene: THREE.Object3D, overrides: Record<string, string>): void {
  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const processMat = (mat: THREE.Material): THREE.Material => {
      const stdMat = mat as THREE.MeshStandardMaterial;
      if (!("color" in stdMat) || !stdMat.name || !overrides[stdMat.name]) return mat;
      const clonedMat = stdMat.clone();
      clonedMat.color.lerp(new THREE.Color(overrides[stdMat.name]), 0.55);
      return clonedMat;
    };
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(processMat);
    } else {
      mesh.material = processMat(mesh.material);
    }
  });
}

function applyTextureAtlas(scene: THREE.Object3D, atlas: THREE.Texture): void {
  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const processMat = (mat: THREE.Material): THREE.Material => {
      const cloned = (mat as THREE.MeshStandardMaterial).clone();
      cloned.map = atlas;
      cloned.needsUpdate = true;
      return cloned;
    };
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(processMat);
    } else {
      mesh.material = processMat(mesh.material);
    }
  });
}

function enableShadows(scene: THREE.Object3D): void {
  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

function buildSockets(scene: THREE.Object3D): Map<SocketName, AttachmentSocket> {
  const sockets = new Map<SocketName, AttachmentSocket>();

  for (const [socketName, aliases] of Object.entries(SOCKET_BONE_PRIORITY)) {
    const bone = findBoneByAlias(scene, aliases);
    if (bone) {
      const offset = socketName === "back" ? BACK_SOCKET_OFFSET.clone() : new THREE.Vector3(0, 0, 0);
      const rotation = socketName === "back" ? BACK_SOCKET_ROTATION.clone() : new THREE.Euler(0, 0, 0);

      sockets.set(socketName as SocketName, {
        name: socketName as SocketName,
        boneName: bone.name,
        boneRef: bone,
        localOffset: offset,
        localRotation: rotation,
      });
    }
  }

  return sockets;
}

function generateCollisionShape(bounds: { width: number; height: number; depth: number }, normalizedScale: number): CollisionShape {
  const w = bounds.width * normalizedScale;
  const h = bounds.height * normalizedScale;
  const d = bounds.depth * normalizedScale;

  const radius = Math.max(w, d) * 0.4;
  const capsuleHeight = h;

  return {
    type: "capsule",
    center: new THREE.Vector3(0, h / 2, 0),
    halfExtents: new THREE.Vector3(w / 2, h / 2, d / 2),
    radius,
    height: capsuleHeight,
  };
}

export { computeSkinnedBounds } from "./BoundsUtils";

function rebindSkeletons(scene: THREE.Object3D): void {
  scene.updateMatrixWorld(true);
  scene.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      const sm = child as THREE.SkinnedMesh;
      if (sm.skeleton) {
        if ((sm as any).bindMode === "detached") {
          sm.skeleton.calculateInverses();
        } else {
          sm.skeleton.calculateInverses();
          sm.bindMatrix.copy(sm.matrixWorld);
          sm.bindMatrixInverse.copy(sm.bindMatrix).invert();
        }
      }
    }
  });
}

function analyzeScene(scene: THREE.Object3D, animations: THREE.AnimationClip[]): ModelAnalysis {
  const box = computeSkinnedBounds(scene);
  const size = box.getSize(new THREE.Vector3());
  const bounds = { width: size.x, height: size.y, depth: size.z };
  const maxDim = Math.max(size.x, size.y, size.z);
  const suggestedScale = maxDim > 0 ? 1.8 / maxDim : 1.0;

  const boneNames: string[] = [];
  const materialNamesSet = new Set<string>();
  let meshCount = 0;
  let vertexCount = 0;
  let triangleCount = 0;
  let hasRig = false;

  scene.traverse((child) => {
    if ((child as THREE.Bone).isBone) {
      boneNames.push(child.name);
      hasRig = true;
    }
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      hasRig = true;
    }
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      meshCount++;
      const geo = mesh.geometry;
      if (geo) {
        const posAttr = geo.getAttribute("position");
        if (posAttr) vertexCount += posAttr.count;
        if (geo.index) triangleCount += geo.index.count / 3;
        else if (posAttr) triangleCount += posAttr.count / 3;
      }
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (mat && mat.name) materialNamesSet.add(mat.name);
      }
    }
  });

  const materialNames = Array.from(materialNamesSet);
  const materialCategories: Record<string, string> = {};
  for (const name of materialNames) {
    materialCategories[name] = classifyMaterialSimple(name);
  }

  const handBones = {
    right: findBoneNameByAlias(boneNames, RIGHT_HAND_ALIASES),
    left: findBoneNameByAlias(boneNames, LEFT_HAND_ALIASES),
  };

  const animationNames = animations.map(a => a.name);
  const animationDurations: Record<string, number> = {};
  for (const anim of animations) {
    animationDurations[anim.name] = anim.duration;
  }

  return {
    bounds,
    box,
    suggestedScale,
    boneNames,
    handBones,
    materialNames,
    materialCategories,
    animationNames,
    animationDurations,
    meshCount,
    vertexCount,
    triangleCount,
    hasRig,
  } as ModelAnalysis;
}

const SKIN_KW = ["skin", "face", "teeth", "body", "head", "flesh", "hand", "foot"];
const HAIR_KW = ["hair", "brow", "beard", "mustache"];
const HAT_KW = ["hat", "helm", "helmet", "hood", "crown"];
const ARMOR_KW = ["armor", "plate", "chain", "mail", "shield", "gauntlet"];
const DETAIL_KW = ["detail", "gold", "gem", "jewel", "buckle", "ornament"];
const PANTS_KW = ["pants", "pant", "trouser", "legging", "skirt"];
const CLOTHING_KW = ["cloth", "shirt", "dress", "robe", "tunic", "vest", "cape"];

function classifyMaterialSimple(name: string): string {
  const lower = name.toLowerCase();
  if (SKIN_KW.some(k => lower.includes(k))) return "skin";
  if (HAIR_KW.some(k => lower.includes(k))) return "hair";
  if (HAT_KW.some(k => lower.includes(k))) return "hat";
  if (ARMOR_KW.some(k => lower.includes(k))) return "armor";
  if (DETAIL_KW.some(k => lower.includes(k))) return "detail";
  if (PANTS_KW.some(k => lower.includes(k))) return "pants";
  if (CLOTHING_KW.some(k => lower.includes(k))) return "clothing";
  return "unknown";
}

export function importFromScene(
  scene: THREE.Object3D,
  animations: THREE.AnimationClip[],
  modelId: string = "unknown",
  options: ImportOptions = {}
): NormalizedModel {
  const {
    targetHeight = DEFAULT_TARGET_HEIGHT,
    sanitizeBones = true,
    fixDarkMaterials = false,
    materialOverrides,
    textureAtlas,
    enableShadows: shadows = true,
    cloneScene = false,
    normalizeAxis = "y",
  } = options;

  const workScene = cloneScene ? scene.clone(true) : scene;

  if (sanitizeBones) {
    sanitizeBoneNames(workScene);
  }

  const clonedAnims = animations.map(c => c.clone());
  if (sanitizeBones) {
    sanitizeClipTrackNames(clonedAnims);
  }

  if (fixDarkMaterials) {
    applyDarkMaterialFix(workScene);
  }

  if (materialOverrides) {
    applyMaterialOverrides(workScene, materialOverrides);
  }

  if (textureAtlas) {
    applyTextureAtlas(workScene, textureAtlas);
  }

  if (shadows) {
    enableShadows(workScene);
  }

  const MAX_SCALE = 200;
  const MIN_SCALE = 0.0001;

  workScene.updateMatrixWorld(true);

  const measureExtent = (box: THREE.Box3): number => {
    const size = box.getSize(new THREE.Vector3());
    return normalizeAxis === "longest" ? Math.max(size.x, size.y, size.z) : size.y;
  };
  const axisLabel = normalizeAxis === "longest" ? "longest" : "height(y)";

  const preScaleBox = computeSkinnedBounds(workScene);
  const preScaleExtent = measureExtent(preScaleBox);
  const originalHeight = preScaleExtent > 0.001 ? preScaleExtent : targetHeight;

  console.log(`[ScalePipeline] Measuring model with existing scale [${workScene.scale.x.toFixed(4)}, ${workScene.scale.y.toFixed(4)}, ${workScene.scale.z.toFixed(4)}]: ${axisLabel}=${preScaleExtent.toFixed(4)}, target=${targetHeight.toFixed(4)}`);

  if (preScaleExtent > 0.001) {
    const scaleMult = Math.max(MIN_SCALE, Math.min(MAX_SCALE, targetHeight / preScaleExtent));
    workScene.scale.multiplyScalar(scaleMult);
  } else {
    const fallbackScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, targetHeight / 1.8));
    workScene.scale.set(fallbackScale, fallbackScale, fallbackScale);
  }
  workScene.updateMatrixWorld(true);

  rebindSkeletons(workScene);

  const postScaleBox = computeSkinnedBounds(workScene);
  const postScaleExtent = measureExtent(postScaleBox);

  if (postScaleExtent > 0.001 && Math.abs(postScaleExtent - targetHeight) / targetHeight > 0.15) {
    const correction = Math.max(0.01, Math.min(100, targetHeight / postScaleExtent));
    console.warn(`[ScalePipeline] Post-scale ${axisLabel} ${postScaleExtent.toFixed(4)} ≠ target ${targetHeight.toFixed(4)}, applying correction ${correction.toFixed(4)}`);
    workScene.scale.multiplyScalar(correction);
    workScene.updateMatrixWorld(true);
    rebindSkeletons(workScene);
  }

  const finalBox = computeSkinnedBounds(workScene);
  const finalExtent = measureExtent(finalBox);
  console.log(`[ScalePipeline] Final model ${axisLabel}: ${finalExtent.toFixed(4)} (target: ${targetHeight.toFixed(4)}, scale: [${workScene.scale.x.toFixed(4)}, ${workScene.scale.y.toFixed(4)}, ${workScene.scale.z.toFixed(4)}])`);

  const analysis = analyzeScene(workScene, clonedAnims);
  const bodyParts = detectBodyParts(analysis.boneNames);
  const skeletonType = detectSkeletonType(analysis.boneNames);

  const sockets = buildSockets(workScene);
  const actualScale = workScene.scale.x;
  const collisionShape = generateCollisionShape(analysis.bounds, 1.0);

  return {
    id: modelId,
    scene: workScene,
    originalHeight,
    normalizedScale: actualScale,
    worldUnitsHeight: targetHeight,
    skeletonType,
    analysis,
    bodyParts,
    sockets,
    collisionShape,
    animations: clonedAnims,
    mixer: null,
  };
}

export function importModel(gltf: GLTF, modelId: string = "unknown", applyScale: boolean = true): NormalizedModel {
  if (!applyScale) {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const originalHeight = size.y > 0 ? size.y : 1;
    return importFromScene(
      gltf.scene,
      gltf.animations || [],
      modelId,
      { targetHeight: originalHeight }
    );
  }
  return importFromScene(
    gltf.scene,
    gltf.animations || [],
    modelId,
    { targetHeight: DEFAULT_TARGET_HEIGHT }
  );
}

export function attachToSocket(
  model: NormalizedModel,
  socketName: SocketName,
  child: THREE.Object3D,
  offsetOverride?: THREE.Vector3,
  rotationOverride?: THREE.Euler
): boolean {
  const socket = model.sockets.get(socketName);
  if (!socket || !socket.boneRef) return false;

  const offset = offsetOverride || socket.localOffset;
  const rotation = rotationOverride || socket.localRotation;

  child.position.copy(offset);
  child.rotation.copy(rotation);
  socket.boneRef.add(child);

  return true;
}

export function detachFromSocket(
  model: NormalizedModel,
  socketName: SocketName,
  childName: string
): boolean {
  const socket = model.sockets.get(socketName);
  if (!socket || !socket.boneRef) return false;

  const toRemove = socket.boneRef.children.filter(c => c.name === childName);
  toRemove.forEach(c => socket.boneRef!.remove(c));

  return toRemove.length > 0;
}

export function getSocketWorldPosition(model: NormalizedModel, socketName: SocketName): THREE.Vector3 | null {
  const socket = model.sockets.get(socketName);
  if (!socket || !socket.boneRef) return null;

  const worldPos = new THREE.Vector3();
  socket.boneRef.getWorldPosition(worldPos);
  return worldPos;
}

export function getModelCollider(model: NormalizedModel): { center: [number, number, number]; radius: number; height: number } {
  return {
    center: [model.collisionShape.center.x, model.collisionShape.center.y, model.collisionShape.center.z],
    radius: model.collisionShape.radius,
    height: model.collisionShape.height,
  };
}

export function getSocketReport(model: NormalizedModel): { name: SocketName; boneName: string; found: boolean }[] {
  const allSocketNames: SocketName[] = ["rightHand", "leftHand", "head", "back", "chest", "rightFoot", "leftFoot", "hips", "spine"];

  return allSocketNames.map(name => {
    const socket = model.sockets.get(name);
    return {
      name,
      boneName: socket?.boneName || "",
      found: !!socket,
    };
  });
}

export function getModelDiagnostics(model: NormalizedModel): string {
  const lines: string[] = [];
  lines.push(`Model: ${model.id}`);
  lines.push(`Original height: ${model.originalHeight.toFixed(3)}m`);
  lines.push(`Normalized scale: ${model.normalizedScale.toFixed(4)}x → ${model.worldUnitsHeight}m`);
  lines.push(`Skeleton: ${model.skeletonType} (${model.analysis.boneNames.length} bones)`);
  lines.push(`Meshes: ${model.analysis.meshCount} | Verts: ${model.analysis.vertexCount} | Tris: ${Math.floor(model.analysis.triangleCount)}`);
  lines.push(`Animations: ${model.animations.length}`);
  lines.push(`Collider: capsule r=${model.collisionShape.radius.toFixed(3)} h=${model.collisionShape.height.toFixed(3)}`);
  lines.push(`Sockets:`);
  for (const [name, socket] of model.sockets) {
    lines.push(`  ${name}: ${socket.boneName} ✓`);
  }
  const allNames: SocketName[] = ["rightHand", "leftHand", "head", "back", "chest", "rightFoot", "leftFoot", "hips", "spine"];
  for (const name of allNames) {
    if (!model.sockets.has(name)) {
      lines.push(`  ${name}: NOT FOUND ✗`);
    }
  }
  return lines.join("\n");
}

const modelCache = new Map<string, NormalizedModel>();

export function getCachedModel(id: string): NormalizedModel | undefined {
  return modelCache.get(id);
}

export function cacheModel(model: NormalizedModel): void {
  modelCache.set(model.id, model);
}

export function clearModelCache(): void {
  modelCache.clear();
}

export function getModelCacheStats(): { count: number; ids: string[] } {
  return {
    count: modelCache.size,
    ids: Array.from(modelCache.keys()),
  };
}
