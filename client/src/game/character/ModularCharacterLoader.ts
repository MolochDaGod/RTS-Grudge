/**
 * ModularCharacterLoader — Lazy-loads modular toon RTS character parts from GLBs,
 * re-binds all SkinnedMeshes to a single shared skeleton, and supports hot-swapping
 * individual slots without disrupting the running AnimationMixer.
 *
 * Placeholder mode: when no manifest.json is present (FBX pipeline hasn't run yet),
 * the loader logs a warning and returns null — callers fall back to monolithic GLBs.
 *
 * Mixamo timeline support (three-mixamo technique):
 *   When manifest.json includes a "timeline" field for a faction, the skeleton.glb
 *   contains a single packed animation clip.  loadSharedSkeleton() automatically
 *   splits it into named subclips using THREE.AnimationUtils.subclip so the
 *   AnimationSystem receives the same discrete "idle"/"walk"/"attack"/... clips
 *   it expects regardless of whether native or Mixamo animations are used.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import MixamoRetargeter from './MixamoRetargeter';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SlotName = 'head' | 'body' | 'arms' | 'legs' | 'shoulders' | 'weapon' | 'shield';

export const ALL_SLOTS: SlotName[] = ['head', 'body', 'arms', 'legs', 'shoulders', 'weapon', 'shield'];

export interface ModularLoadout {
  faction:   string;
  slots:     Partial<Record<SlotName, number>>;  // slot → variantIndex
  skinIndex: number;                              // 0–8
}

/** Frame range entry for a subclip inside a packed timeline skeleton.glb */
export interface TimelineRange {
  start: number;
  end:   number;
  fps:   number;
}

export interface ToonRTSManifest {
  factions: Record<string, {
    slots:     Record<string, string[]>;          // slot → variant name array
    /** Optional: packed animation timeline ranges written by run.js.
     *  When present, skeleton.glb contains one long AnimationClip that is
     *  split at runtime using THREE.AnimationUtils.subclip.             */
    timeline?: Record<string, TimelineRange>;
  }>;
}

export interface LoadedPart {
  slot:     SlotName;
  variant:  string;
  mesh:     THREE.SkinnedMesh;
}

export interface ModularCharacterData {
  group:      THREE.Group;
  skeleton:   THREE.Skeleton;
  bones:      THREE.Bone[];
  parts:      Map<SlotName, LoadedPart>;
  mixer:      THREE.AnimationMixer;
  clips:      Record<string, THREE.AnimationClip>;
  faction:    string;
  skinIndex:  number;
}

// ── Skin colour palettes (fallback when atlas texture is absent) ──────────────

const SKIN_PALETTES: number[][] = [
  [0x8aafd4, 0xd4b895, 0xa07848],   // 0 – cool blue steel
  [0x7a6a9a, 0xc8a888, 0x887050],   // 1 – purple dusk
  [0x5a8a5a, 0xa0c890, 0x607840],   // 2 – forest green
  [0xaa4444, 0xe0a080, 0x884428],   // 3 – crimson war
  [0x484880, 0xb0a8d0, 0x605888],   // 4 – void indigo
  [0x806828, 0xd4b870, 0x907840],   // 5 – golden sovereign
  [0x504040, 0xc0a898, 0x706050],   // 6 – ash grey
  [0x28608a, 0x90c8d8, 0x406878],   // 7 – ocean teal
  [0xa06030, 0xe0c898, 0x906040],   // 8 – bronze savage
];

// ── Cache ─────────────────────────────────────────────────────────────────────

let manifestCache:  ToonRTSManifest | null | 'not_found' = null;
let manifestFetch:  Promise<ToonRTSManifest | null> | null = null;

const skeletonCache = new Map<string, Promise<{ bones: THREE.Bone[]; rootBone: THREE.Bone; skeleton: THREE.Skeleton; clips: Record<string, THREE.AnimationClip> } | null>>();
const partCache     = new Map<string, Promise<THREE.SkinnedMesh | null>>();

const gltfLoader = new GLTFLoader();

// ── Manifest loading ──────────────────────────────────────────────────────────

export async function loadManifest(basePath = ''): Promise<ToonRTSManifest | null> {
  if (manifestCache === 'not_found') return null;
  if (manifestCache) return manifestCache;
  if (manifestFetch) return manifestFetch;

  manifestFetch = (async () => {
    const url = `${basePath}/models/toon_rts/manifest.json`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as ToonRTSManifest;
      manifestCache = data;
      console.log('[ModularLoader] Manifest loaded:', Object.keys(data.factions));
      return data;
    } catch (e) {
      console.warn('[ModularLoader] Manifest not found — running in placeholder mode. Run tools/convert-toon-rts/run.js to generate parts.');
      manifestCache = 'not_found';
      return null;
    }
  })();

  return manifestFetch;
}

export function getManifest(): ToonRTSManifest | null {
  return manifestCache && manifestCache !== 'not_found' ? manifestCache : null;
}

// ── Bone remapping (re-bind extracted part mesh to shared skeleton) ───────────

function remapBoneIndices(
  mesh:           THREE.SkinnedMesh,
  partBones:      THREE.Bone[],
  sharedBones:    THREE.Bone[],
): void {
  const sharedBoneNameToIdx = new Map<string, number>();
  sharedBones.forEach((b, i) => sharedBoneNameToIdx.set(b.name, i));

  const remap: number[] = partBones.map(b => {
    const idx = sharedBoneNameToIdx.get(b.name);
    if (idx === undefined) {
      console.warn(`[ModularLoader] Bone "${b.name}" not found in shared skeleton`);
      return 0;
    }
    return idx;
  });

  const skinIndexAttr = mesh.geometry.attributes.skinIndex as THREE.BufferAttribute;
  if (!skinIndexAttr) return;

  const data  = skinIndexAttr.array as Float32Array | Int16Array | Uint16Array | Uint8Array;
  const count = skinIndexAttr.count;
  const itemSize = skinIndexAttr.itemSize;

  for (let i = 0; i < count; i++) {
    for (let c = 0; c < itemSize; c++) {
      const old = data[i * itemSize + c];
      data[i * itemSize + c] = remap[old] ?? 0;
    }
  }
  skinIndexAttr.needsUpdate = true;
}

// ── Skeleton / animation GLB loader ──────────────────────────────────────────

/**
 * Load the shared skeleton GLB for a faction.
 *
 * Two animation modes are supported:
 *
 *   1. Named clips (legacy / native anims):
 *      The GLB contains multiple named AnimationClips (idle, walk, attack…).
 *      These are returned as-is.
 *
 *   2. Packed timeline (three-mixamo technique):
 *      The GLB contains a single long clip.  The manifest's `timeline` field
 *      maps clip names → { start, end, fps } frame ranges.  We extract each
 *      subclip with THREE.AnimationUtils.subclip and retarget any remaining
 *      Mixamo bone names via MixamoRetargeter.
 */
async function loadSharedSkeleton(
  faction:       string,
  basePath:      string,
  timelineRanges?: Record<string, TimelineRange>,
): Promise<{ bones: THREE.Bone[]; rootBone: THREE.Bone; skeleton: THREE.Skeleton; clips: Record<string, THREE.AnimationClip> } | null> {
  // Cache key includes presence of timeline so different callers don't share a stale entry
  const hasTimeline = timelineRanges && Object.keys(timelineRanges).length > 0;
  const key = `${faction}@${basePath}@${hasTimeline ? 'tl' : 'named'}`;
  if (skeletonCache.has(key)) return skeletonCache.get(key)!;

  const promise = (async () => {
    const url = `${basePath}/models/toon_rts/${faction}/skeleton.glb`;
    try {
      const gltf = await gltfLoader.loadAsync(url);
      const bones: THREE.Bone[] = [];
      gltf.scene.traverse(obj => {
        if ((obj as THREE.Bone).isBone) bones.push(obj as THREE.Bone);
      });
      if (bones.length === 0) {
        console.warn(`[ModularLoader] Skeleton GLB for "${faction}" has no bones`);
        return null;
      }

      // Root bone = topmost bone (parent is not a bone)
      const rootBone = bones.find(b => !b.parent || !(b.parent as THREE.Bone).isBone) ?? bones[0];

      // Build skeleton using the SAME bone objects from the GLB hierarchy so the
      // AnimationMixer on the parent group can resolve bone-name track bindings.
      const skeleton = new THREE.Skeleton(bones);

      const clips: Record<string, THREE.AnimationClip> = {};

      if (hasTimeline && gltf.animations.length > 0) {
        // ── Packed timeline mode (three-mixamo technique) ──────────────────────
        // The skeleton.glb has one long clip.  Retarget any remaining Mixamo
        // bone names, then split it into named subclips using the manifest ranges.
        const packed = gltf.animations[0];

        if (MixamoRetargeter.needsRetargeting(packed)) {
          MixamoRetargeter.retargetClip(packed);
        }

        for (const [clipName, range] of Object.entries(timelineRanges!)) {
          const sub = MixamoRetargeter.subclip(packed, clipName, range.start, range.end, range.fps);
          clips[clipName] = sub;
        }

        console.log(`[ModularLoader] Packed timeline for "${faction}": extracted ${Object.keys(clips).length} subclips from frames 0–${packed.duration * (timelineRanges![Object.keys(timelineRanges!)[Object.keys(timelineRanges!).length - 1]]?.fps ?? 30)}`);
      } else {
        // ── Named clips mode ────────────────────────────────────────────────────
        // Each AnimationClip in the GLB is already named and ready to use.
        // Still retarget in case someone dropped a raw Mixamo GLB as skeleton.glb.
        for (const clip of gltf.animations) {
          const c = MixamoRetargeter.needsRetargeting(clip) ? MixamoRetargeter.retargetClip(clip) : clip;
          clips[c.name] = c;
        }
      }

      console.log(`[ModularLoader] Shared skeleton loaded for "${faction}": ${bones.length} bones, ${Object.keys(clips).length} clips [${Object.keys(clips).join(', ')}]`);
      return { bones, rootBone, skeleton, clips };
    } catch (e) {
      console.warn(`[ModularLoader] Could not load skeleton for "${faction}": ${e}`);
      return null;
    }
  })();

  skeletonCache.set(key, promise);
  return promise;
}

// ── Part GLB loader ──────────────────────────────────────────────────────────

async function loadPartMesh(
  faction:   string,
  slot:      SlotName,
  variant:   string,
  basePath:  string,
): Promise<THREE.SkinnedMesh | null> {
  const key = `${faction}/${slot}/${variant}@${basePath}`;
  if (partCache.has(key)) return partCache.get(key)!;

  const promise = (async () => {
    const url = `${basePath}/models/toon_rts/${faction}/${slot}/${variant}.glb`;
    try {
      const gltf = await gltfLoader.loadAsync(url);
      let found: THREE.SkinnedMesh | null = null;
      gltf.scene.traverse(obj => {
        if (!found && (obj as THREE.SkinnedMesh).isSkinnedMesh) {
          found = (obj as THREE.SkinnedMesh);
        }
      });
      if (!found) {
        console.warn(`[ModularLoader] No SkinnedMesh in part "${faction}/${slot}/${variant}"`);
        return null;
      }
      return found;
    } catch (e) {
      console.warn(`[ModularLoader] Could not load part "${faction}/${slot}/${variant}": ${e}`);
      return null;
    }
  })();

  partCache.set(key, promise);
  return promise;
}

// ── Atlas UV strip helper ─────────────────────────────────────────────────────

const ATLAS_STRIP_COUNT = SKIN_PALETTES.length; // 9

/**
 * Apply a skin index to a single MeshToonMaterial:
 *  - When the material already has a texture map (atlas), set UV offset/repeat
 *    to select the correct horizontal strip (row = skinIndex / ATLAS_STRIP_COUNT).
 *  - When there is no texture map, tint the material colour from SKIN_PALETTES.
 */
function applyAtlasSkin(mat: THREE.MeshToonMaterial, skinIndex: number): void {
  if (mat.map) {
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.map.repeat.set(1, 1 / ATLAS_STRIP_COUNT);
    mat.map.offset.set(0, skinIndex / ATLAS_STRIP_COUNT);
    mat.map.needsUpdate = true;
  } else {
    const palette = SKIN_PALETTES[Math.min(skinIndex, SKIN_PALETTES.length - 1)] ?? SKIN_PALETTES[0];
    mat.color.setHex(palette[0]);
  }
  mat.needsUpdate = true;
}

// ── Apply toon material with skin colour ─────────────────────────────────────

/**
 * Convert each source material on a part mesh to MeshToonMaterial, preserving
 * any existing texture map so atlas UV skin switching works correctly.
 * When no map is found, fall back to SKIN_PALETTES tinting.
 */
function applyPartMaterial(mesh: THREE.SkinnedMesh, skinIndex: number): void {
  const sourceMats = Array.isArray(mesh.material) ? mesh.material as THREE.Material[] : [mesh.material as THREE.Material];

  const newMats = sourceMats.map(srcMat => {
    if (srcMat instanceof THREE.MeshToonMaterial) {
      // Already toon — just update the skin
      applyAtlasSkin(srcMat, skinIndex);
      return srcMat;
    }

    // Convert from MeshStandardMaterial / MeshBasicMaterial / etc.
    const src = srcMat as THREE.MeshStandardMaterial;
    const existingMap   = src.map   ?? null;
    const existingColor = (src as any).color instanceof THREE.Color
      ? (src as any).color.clone()
      : new THREE.Color(0xffffff);

    const toon = new THREE.MeshToonMaterial({
      name:       srcMat.name,
      color:      existingColor,
      map:        existingMap,
      transparent: srcMat.transparent,
      opacity:    srcMat.opacity,
      side:       srcMat.side,
    });

    applyAtlasSkin(toon, skinIndex);
    return toon;
  });

  mesh.material      = newMats.length === 1 ? newMats[0] : newMats;
  mesh.castShadow    = true;
  mesh.receiveShadow = false;
  mesh.normalizeSkinWeights();
}

// ── Build character from loadout ──────────────────────────────────────────────

export async function buildCharacter(
  loadout:  ModularLoadout,
  basePath: string,
  externalAnims?: Record<string, THREE.AnimationClip>,
): Promise<ModularCharacterData | null> {

  const manifest = await loadManifest(basePath);
  if (!manifest) return null;

  const factionData = manifest.factions[loadout.faction];
  if (!factionData) {
    console.warn(`[ModularLoader] Faction "${loadout.faction}" not in manifest`);
    return null;
  }

  // Pass timeline ranges (if any) so loadSharedSkeleton can split the packed clip
  const timelineRanges = factionData.timeline ?? undefined;
  const skelData = await loadSharedSkeleton(loadout.faction, basePath, timelineRanges);
  if (!skelData) return null;

  const { bones: templateBones, rootBone: templateRoot, clips: skeletonClips } = skelData;

  // Clone the bone hierarchy so each character gets its own bone objects.
  // A Three.js Object3D can only have one parent; sharing template bones across
  // multiple characters would cause the last-added parent to steal all bones.
  const clonedRoot = templateRoot.clone(true) as THREE.Bone;
  const bones: THREE.Bone[] = [];
  clonedRoot.traverse(obj => { if ((obj as THREE.Bone).isBone) bones.push(obj as THREE.Bone); });
  const skeleton = new THREE.Skeleton(bones);

  const group = new THREE.Group();
  // *** CRITICAL: add the cloned bone hierarchy to the group so the AnimationMixer
  //     can resolve bone-name track bindings by traversing the scene graph.
  group.add(clonedRoot);

  const parts = new Map<SlotName, LoadedPart>();

  const slotLoadPromises = ALL_SLOTS.map(async (slot) => {
    const slotVariants = factionData.slots[slot];
    if (!slotVariants || slotVariants.length === 0) return;

    const varIdx = loadout.slots[slot] ?? 0;
    const variant = slotVariants[Math.min(varIdx, slotVariants.length - 1)];

    const sourceMesh = await loadPartMesh(loadout.faction, slot, variant, basePath);
    if (!sourceMesh) return;

    const mesh = sourceMesh.clone(true) as THREE.SkinnedMesh;

    const partBones: THREE.Bone[] = [];
    if (sourceMesh.skeleton) {
      partBones.push(...sourceMesh.skeleton.bones);
    }

    if (partBones.length > 0 && partBones.length !== bones.length) {
      remapBoneIndices(mesh, partBones, bones);
    }

    applyPartMaterial(mesh, loadout.skinIndex);

    mesh.bind(skeleton);
    group.add(mesh);

    parts.set(slot, { slot, variant, mesh });
  });

  await Promise.allSettled(slotLoadPromises);

  if (parts.size === 0) {
    console.warn(`[ModularLoader] No parts loaded for faction "${loadout.faction}"`);
    return null;
  }

  const mixer = new THREE.AnimationMixer(group);

  const allClips: Record<string, THREE.AnimationClip> = { ...skeletonClips };
  if (externalAnims) Object.assign(allClips, externalAnims);

  console.log(`[ModularLoader] Built character: faction=${loadout.faction}, parts=${parts.size}, clips=${Object.keys(allClips).length}`);

  return {
    group,
    skeleton,
    bones,
    parts,
    mixer,
    clips:     allClips,
    faction:   loadout.faction,
    skinIndex: loadout.skinIndex,
  };
}

// ── Hot-swap a single part ────────────────────────────────────────────────────

export async function swapPart(
  data:       ModularCharacterData,
  slot:       SlotName,
  variantIdx: number,
  basePath:   string,
  manifest:   ToonRTSManifest,
): Promise<boolean> {
  const factionData = manifest.factions[data.faction];
  if (!factionData) return false;

  const slotVariants = factionData.slots[slot];
  if (!slotVariants || slotVariants.length === 0) return false;

  const variant  = slotVariants[Math.min(variantIdx, slotVariants.length - 1)];
  const existing = data.parts.get(slot);

  if (existing?.variant === variant) return true;

  const sourceMesh = await loadPartMesh(data.faction, slot, variant, basePath);
  if (!sourceMesh) return false;

  if (existing) {
    data.group.remove(existing.mesh);
    existing.mesh.geometry.dispose();
  }

  const mesh = sourceMesh.clone(true) as THREE.SkinnedMesh;

  const partBones: THREE.Bone[] = sourceMesh.skeleton?.bones ?? [];
  if (partBones.length > 0 && partBones.length !== data.bones.length) {
    remapBoneIndices(mesh, partBones, data.bones);
  }

  applyPartMaterial(mesh, data.skinIndex);
  mesh.bind(data.skeleton);
  data.group.add(mesh);
  data.parts.set(slot, { slot, variant, mesh });

  return true;
}

// ── Update skin on all loaded parts ─────────────────────────────────────────

export function updateSkin(data: ModularCharacterData, skinIndex: number): void {
  data.skinIndex = skinIndex;
  data.parts.forEach(({ mesh }) => {
    const mats = Array.isArray(mesh.material) ? mesh.material as THREE.Material[] : [mesh.material as THREE.Material];
    mats.forEach(m => {
      if (m instanceof THREE.MeshToonMaterial) {
        applyAtlasSkin(m, skinIndex);
      }
    });
  });
}

// ── Variant listing helpers (for UI) ─────────────────────────────────────────

export function getVariants(manifest: ToonRTSManifest, faction: string, slot: SlotName): string[] {
  return manifest.factions[faction]?.slots[slot] ?? [];
}

export function getFactions(manifest: ToonRTSManifest): string[] {
  return Object.keys(manifest.factions);
}

export { SKIN_PALETTES };
