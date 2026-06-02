import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { resolveCharacterModelPath } from "./CharacterModelResolver";
import { resolveAssetPath } from "./AssetCDNResolver";
import { sanitizeBoneName } from "./BoneAliases";

export type AssetPriority = "critical" | "high" | "medium" | "low";

export interface AssetLoadStats {
  totalLoaded: number;
  totalBytes: number;
  totalTimeMs: number;
  cacheHits: number;
  averageLoadTimeMs: number;
  byPriority: Record<AssetPriority, number>;
  texturesProcessed: number;
  dracoMeshesDecoded: number;
  retries: number;
  fallbacksServed: number;
}

interface QueueEntry {
  path: string;
  priority: AssetPriority;
  requesterTag: string | null;
  resolve: (gltf: GLTF) => void;
  reject: (err: Error) => void;
}

const PRIORITY_ORDER: Record<AssetPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const MAX_CONCURRENT = 4;

// Backoff schedule for transient load failures. Length = retry count.
const RETRY_DELAYS_MS = [250, 750];

const DRACO_CDN = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";
const KTX2_CDN = "https://cdn.jsdelivr.net/gh/pmndrs/drei-assets@master/basis/";

let sharedLoader: GLTFLoader | null = null;
let dracoLoader: DRACOLoader | null = null;
let ktx2Loader: KTX2Loader | null = null;
let rendererRef: THREE.WebGLRenderer | null = null;
let loadersGlInitialized = false;

const gltfCache = new Map<string, GLTF>();
const loadingPromises = new Map<string, Promise<GLTF>>();
const bytesTracker = new Map<string, number>();
const textureCache = new Map<string, THREE.Texture>();

// Paths that failed all retry attempts. We keep the fallback GLTF here so
// repeat callers don't loop on retries — they immediately receive the cube.
const failedPaths = new Map<string, GLTF>();

const queue: QueueEntry[] = [];
let activeLoads = 0;

const stats: AssetLoadStats = {
  totalLoaded: 0,
  totalBytes: 0,
  totalTimeMs: 0,
  cacheHits: 0,
  averageLoadTimeMs: 0,
  byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
  texturesProcessed: 0,
  dracoMeshesDecoded: 0,
  retries: 0,
  fallbacksServed: 0,
};

let loadersGlDraco: any = null;
let loadersGlImages: any = null;
let loadersGlTextures: any = null;

async function initLoadersGl(): Promise<void> {
  if (loadersGlInitialized) return;
  loadersGlInitialized = true;

  try {
    const [dracoMod, imagesMod, texturesMod] = await Promise.all([
      import("@loaders.gl/draco").catch(() => null),
      import("@loaders.gl/images").catch(() => null),
      import("@loaders.gl/textures").catch(() => null),
    ]);

    if (dracoMod) {
      loadersGlDraco = dracoMod;
      console.log("[AssetLoader] @loaders.gl/draco ready");
    }
    if (imagesMod) {
      loadersGlImages = imagesMod;
      console.log("[AssetLoader] @loaders.gl/images ready");
    }
    if (texturesMod) {
      loadersGlTextures = texturesMod;
      console.log("[AssetLoader] @loaders.gl/textures ready");
    }
  } catch (e) {
    console.warn("[AssetLoader] loaders.gl init partial failure:", e);
  }
}

function createDracoLoader(): DRACOLoader {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_CDN);
    dracoLoader.setDecoderConfig({ type: "js" });
    dracoLoader.preload();
  }
  return dracoLoader;
}

function createKTX2Loader(renderer: THREE.WebGLRenderer): KTX2Loader {
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath(KTX2_CDN);
    ktx2Loader.detectSupport(renderer);
  }
  return ktx2Loader;
}

export function initAssetLoader(renderer?: THREE.WebGLRenderer): GLTFLoader {
  if (sharedLoader) return sharedLoader;

  sharedLoader = new GLTFLoader();

  sharedLoader.setDRACOLoader(createDracoLoader());

  if (renderer) {
    rendererRef = renderer;
    sharedLoader.setKTX2Loader(createKTX2Loader(renderer));
  }

  sharedLoader.setMeshoptDecoder(MeshoptDecoder);

  // Suppress the "Unknown extension KHR_materials_pbrSpecularGlossiness"
  // warning that older GLBs (ship models, pirate island pack) trigger.
  // The models load fine without the extension — metallic-roughness
  // PBR takes over automatically.
  const _origWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (typeof args[0] === "string" && args[0].includes("KHR_materials_pbrSpecularGlossiness")) return;
    _origWarn.apply(console, args);
  };

  initLoadersGl();

  return sharedLoader;
}

export function getSharedLoader(): GLTFLoader {
  if (!sharedLoader) {
    return initAssetLoader();
  }
  return sharedLoader;
}

export function attachRenderer(renderer: THREE.WebGLRenderer): void {
  if (rendererRef === renderer) return;
  rendererRef = renderer;
  const loader = getSharedLoader();
  loader.setKTX2Loader(createKTX2Loader(renderer));
}

/**
 * Build a stand-in GLTF for a path that failed every retry. A magenta box
 * with strong emissive so it is visually obvious in the scene that something
 * is missing — much better than crashing or showing nothing at all.
 */
function createFallbackGltf(path: string): GLTF {
  const geo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff00ff,
    emissive: 0xff00ff,
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = "AssetLoader_FallbackCube";
  mesh.userData.isAssetFallback = true;
  mesh.userData.failedPath = path;

  const scene = new THREE.Group();
  scene.name = `AssetLoader_FallbackScene(${path})`;
  scene.userData.isAssetFallback = true;
  scene.userData.failedPath = path;
  scene.add(mesh);

  // Cast through unknown — only `scene` and `animations` are used by callers
  // (importFromScene, useAsset, etc.) so the rest can be empty.
  const fallback = {
    scene,
    scenes: [scene],
    animations: [] as THREE.AnimationClip[],
    cameras: [] as THREE.Camera[],
    asset: { generator: "AssetLoader.fallback", version: "2.0" },
    parser: null,
    userData: { isAssetFallback: true, failedPath: path },
  } as unknown as GLTF;

  return fallback;
}

function processQueue(): void {
  while (activeLoads < MAX_CONCURRENT && queue.length > 0) {
    queue.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    const entry = queue.shift()!;
    activeLoads++;
    executeLoad(entry);
  }
}

function postProcessGltf(gltf: GLTF): void {
  gltf.scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.geometry?.attributes?.position) {
        const draco = (child.geometry as any).__dracoDecoded;
        if (draco) {
          stats.dracoMeshesDecoded++;
        }
      }

      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of materials) {
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
            const maps = [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.aoMap, mat.emissiveMap];
            for (const tex of maps) {
              if (tex && !textureCache.has(tex.uuid)) {
                textureCache.set(tex.uuid, tex);

                if (tex.image && loadersGlImages) {
                  tex.anisotropy = rendererRef
                    ? Math.min(4, rendererRef.capabilities.getMaxAnisotropy())
                    : 4;
                  stats.texturesProcessed++;
                }

                const _img: any = tex.image;
                tex.generateMipmaps = (_img?.width ?? 0) > 256 || (_img?.height ?? 0) > 256;

                if ((_img?.width ?? 0) > 2048 || (_img?.height ?? 0) > 2048) {
                  tex.minFilter = THREE.LinearMipmapLinearFilter;
                  tex.magFilter = THREE.LinearFilter;
                }
              }
            }
          }
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// FBX loading — wraps FBXLoader result into a GLTF-compatible shape
// ---------------------------------------------------------------------------
let sharedFbxLoader: FBXLoader | null = null;

function getSharedFbxLoader(): FBXLoader {
  if (!sharedFbxLoader) sharedFbxLoader = new FBXLoader();
  return sharedFbxLoader;
}

/** Detect whether a path is an FBX file (by extension). */
function isFbxPath(path: string): boolean {
  return /\.fbx(\?|$)/i.test(path);
}

/**
 * Wrap an FBX-loaded Group into a GLTF-compatible object so the rest of the
 * pipeline (useAsset, useCharacterModel, postProcessGltf) works unchanged.
 *
 * Key fixes applied:
 * 1. Sanitise bone names (strips colons from Mixamo/Bip001 conventions)
 * 2. Bake the FBX unit-scale (3ds Max exports at cm, FBXLoader sets root
 *    scale to 0.01) into the scene transform so downstream normalizers
 *    see a scene already in metres — avoids the 100x sizing bug.
 * 3. Convert MeshPhongMaterial → MeshStandardMaterial to prevent WebGL
 *    shader compilation failures with the R3F pipeline.
 * 4. Enable shadow casting on all meshes.
 */
function wrapFbxAsGltf(fbxScene: THREE.Group, path: string): GLTF {
  // Bake FBX unit scale into the scene matrix so children are in metres.
  // FBXLoader sets fbxScene.scale to 0.01 for centimetre-unit files.
  // Without this bake, normalizeCharacterHeight sees a 180-unit-tall
  // bounding box and scales the mesh to 0.01, then the retargeter's
  // root-chain position tracks (which are in cm) launch the character
  // 100x off the ground.
  fbxScene.updateMatrixWorld(true);

  fbxScene.traverse((child) => {
    // Sanitise bone names
    if (child.name) child.name = sanitizeBoneName(child.name);

    if ((child as THREE.Mesh).isMesh || (child as THREE.SkinnedMesh).isSkinnedMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      // Convert MeshPhongMaterial → MeshStandardMaterial.
      // FBXLoader creates Phong materials which can fail to compile in
      // strict WebGL2 pipelines and don't support PBR features (roughness,
      // metalness). Preserve color, map, side, and transparency.
      const mesh = child as THREE.Mesh;
      const convertMat = (m: THREE.Material): THREE.Material => {
        if (!(m instanceof THREE.MeshPhongMaterial)) return m;
        const std = new THREE.MeshStandardMaterial({
          color: m.color.clone(),
          map: m.map,
          side: m.side,
          transparent: m.transparent,
          opacity: m.opacity,
          alphaTest: m.alphaTest,
          roughness: 0.7,
          metalness: 0.05,
          name: m.name,
        });
        if (m.emissive) std.emissive.copy(m.emissive);
        if (m.emissiveMap) std.emissiveMap = m.emissiveMap;
        if (m.normalMap) std.normalMap = m.normalMap;
        return std;
      };
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(convertMat);
      } else {
        mesh.material = convertMat(mesh.material);
      }
    }
  });

  const clips = fbxScene.animations ?? [];

  return {
    scene: fbxScene,
    scenes: [fbxScene],
    animations: clips,
    cameras: [] as THREE.Camera[],
    asset: { generator: "AssetLoader.FBXLoader", version: "2.0" },
    parser: null,
    userData: { isFbxSource: true, sourcePath: path },
  } as unknown as GLTF;
}

function loadFbxOnce(path: string, onProgress?: (xhr: ProgressEvent) => void): Promise<GLTF> {
  const loader = getSharedFbxLoader();
  return new Promise<GLTF>((res, rej) => {
    loader.load(
      path,
      (group) => res(wrapFbxAsGltf(group, path)),
      onProgress,
      (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        rej(new Error(msg));
      },
    );
  });
}

/**
 * Single low-level fetch attempt. Resolves with the GLTF on success, rejects
 * with a context-rich Error on failure — we don't retry inside this fn.
 *
 * Automatically selects FBXLoader for `.fbx` paths.
 */
function loadOnce(path: string, onProgress?: (xhr: ProgressEvent) => void): Promise<GLTF> {
  if (isFbxPath(path)) return loadFbxOnce(path, onProgress);

  const loader = getSharedLoader();
  return new Promise<GLTF>((res, rej) => {
    loader.load(
      path,
      (gltf) => res(gltf),
      onProgress,
      (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        rej(new Error(msg));
      },
    );
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function executeLoad(entry: QueueEntry): void {
  const { path, priority, requesterTag, resolve, reject } = entry;

  if (gltfCache.has(path)) {
    stats.cacheHits++;
    activeLoads--;
    resolve(gltfCache.get(path)!);
    processQueue();
    return;
  }

  const failed = failedPaths.get(path);
  if (failed) {
    stats.fallbacksServed++;
    activeLoads--;
    resolve(failed);
    processQueue();
    return;
  }

  const existing = loadingPromises.get(path);
  if (existing) {
    activeLoads--;
    existing.then(resolve).catch(reject);
    processQueue();
    return;
  }

  const startTime = performance.now();
  const tag = requesterTag ? ` (requester=${requesterTag})` : "";

  const promise = (async (): Promise<GLTF> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const gltf = await loadOnce(path, (xhr) => {
          if (xhr.lengthComputable) {
            bytesTracker.set(path, xhr.loaded);
            let sum = 0;
            bytesTracker.forEach((v) => { sum += v; });
            stats.totalBytes = sum;
            emitAssetProgress(path, xhr.loaded, xhr.total);
          }
        });

        const elapsed = performance.now() - startTime;
        postProcessGltf(gltf);

        gltfCache.set(path, gltf);
        // Publish a final snapshot so subscribers that only ever see the
        // 99 % progress event see a clean 100 % too.
        const finalBytes = bytesTracker.get(path) ?? 0;
        emitAssetProgress(path, finalBytes, finalBytes);

        stats.totalLoaded++;
        stats.totalTimeMs += elapsed;
        stats.averageLoadTimeMs = stats.totalTimeMs / stats.totalLoaded;
        stats.byPriority[priority]++;
        if (attempt > 0) {
          console.log(`[AssetLoader] ${path}${tag} succeeded on attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}`);
        }

        return gltf;
      } catch (err) {
        lastError = err as Error;
        if (attempt < RETRY_DELAYS_MS.length) {
          stats.retries++;
          const wait = RETRY_DELAYS_MS[attempt];
          console.warn(
            `[AssetLoader] ${path}${tag} attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1} failed: ${lastError.message} — retrying in ${wait}ms`,
          );
          await delay(wait);
          continue;
        }
      }
    }

    // All attempts exhausted — serve the magenta cube and remember it.
    const fallback = createFallbackGltf(path);
    failedPaths.set(path, fallback);
    stats.fallbacksServed++;
    console.error(
      `[AssetLoader] ${path}${tag} failed after ${RETRY_DELAYS_MS.length + 1} attempts (loader=GLTFLoader). Serving fallback cube. Last error: ${lastError?.message ?? "unknown"}`,
    );
    return fallback;
  })();

  promise
    .then((gltf) => {
      loadingPromises.delete(path);
      activeLoads--;
      resolve(gltf);
      processQueue();
    })
    .catch((err) => {
      // Should be unreachable now that the retry IIFE always resolves.
      loadingPromises.delete(path);
      activeLoads--;
      reject(err);
      processQueue();
    });

  loadingPromises.set(path, promise);
}

export function loadAsset(
  rawPath: string,
  priority: AssetPriority = "medium",
  requesterTag: string | null = null,
): Promise<GLTF> {
  // Character model paths → CDN (faction GLBs), then general CDN resolver
  // rewrites remaining /models/... paths to assets.grudge-studio.com in prod.
  const path = resolveAssetPath(resolveCharacterModelPath(rawPath));
  if (gltfCache.has(path)) {
    stats.cacheHits++;
    return Promise.resolve(gltfCache.get(path)!);
  }

  const failed = failedPaths.get(path);
  if (failed) {
    stats.fallbacksServed++;
    return Promise.resolve(failed);
  }

  const existing = loadingPromises.get(path);
  if (existing) return existing;

  return new Promise<GLTF>((resolve, reject) => {
    queue.push({ path, priority, requesterTag, resolve, reject });
    processQueue();
  });
}

export function preloadAssets(paths: string[], priority: AssetPriority = "medium"): Promise<GLTF[]> {
  return Promise.all(paths.map((p) => loadAsset(p, priority)));
}

export function preloadCritical(paths: string[]): Promise<GLTF[]> {
  return preloadAssets(paths, "critical");
}

export function isAssetCached(path: string): boolean {
  return gltfCache.has(path);
}

export function getCachedAsset(path: string): GLTF | undefined {
  return gltfCache.get(path);
}

/** Return true if the path has exhausted retries and is now serving the fallback cube. */
export function isAssetFailed(path: string): boolean {
  return failedPaths.has(resolveCharacterModelPath(path));
}

/** List of paths currently serving a fallback. Useful for dev overlays. */
export function getFailedAssetPaths(): string[] {
  return Array.from(failedPaths.keys());
}

// Per-asset byte progress so DOM overlays (tutorial loading screen, etc.)
// can show live "X / Y MB" without wiring custom XHR handlers — they just
// subscribe by path. `total` is 0 until the first lengthComputable progress
// event arrives; once the load resolves we publish a final loaded === total
// snapshot so subscribers don't get stuck at 99 %.
export interface AssetProgress {
  loaded: number;
  total: number;
}
type AssetProgressListener = (p: AssetProgress) => void;
const assetProgress = new Map<string, AssetProgress>();
const assetProgressListeners = new Map<string, Set<AssetProgressListener>>();

function emitAssetProgress(path: string, loaded: number, total: number): void {
  const snap: AssetProgress = { loaded, total };
  assetProgress.set(path, snap);
  const set = assetProgressListeners.get(path);
  if (!set) return;
  for (const listener of set) {
    try { listener(snap); } catch (e) { console.warn("[AssetLoader] progress listener threw:", e); }
  }
}

export function getAssetProgress(rawPath: string): AssetProgress {
  const path = resolveCharacterModelPath(rawPath);
  return assetProgress.get(path) ?? { loaded: 0, total: 0 };
}

export function subscribeAssetProgress(
  rawPath: string,
  listener: AssetProgressListener,
): () => void {
  const path = resolveCharacterModelPath(rawPath);
  let set = assetProgressListeners.get(path);
  if (!set) {
    set = new Set();
    assetProgressListeners.set(path, set);
  }
  set.add(listener);
  // Replay current snapshot so subscribers that mount mid-download don't
  // sit at 0 % until the next progress event.
  const current = assetProgress.get(path);
  if (current) {
    try { listener(current); } catch (e) { console.warn("[AssetLoader] progress listener threw:", e); }
  }
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) assetProgressListeners.delete(path);
  };
}

// Hooks invoked when failedPaths is cleared so dependent caches (Suspense,
// per-feature post-import groups) can drop their stale fallback copies. Kept
// as a small subscription list so the consumer modules don't have to know
// about each other.
type FailureClearListener = () => void;
const failureClearListeners = new Set<FailureClearListener>();

export function onFailedAssetsCleared(listener: FailureClearListener): () => void {
  failureClearListeners.add(listener);
  return () => failureClearListeners.delete(listener);
}

/**
 * Clear the failed-paths cache so the next load attempt actually re-fetches.
 * Also notifies subscribers (useAsset Suspense cache, WeaponModelLoader cache)
 * so they don't keep serving the magenta cube after the underlying file is
 * restored on disk.
 */
export function clearFailedAssets(): void {
  failedPaths.clear();
  for (const listener of failureClearListeners) {
    try { listener(); } catch (e) { console.warn("[AssetLoader] failure-clear listener threw:", e); }
  }
}

export function getLoadStats(): AssetLoadStats {
  return { ...stats };
}

export function clearAssetCache(): void {
  gltfCache.clear();
  textureCache.clear();
  bytesTracker.clear();
  failedPaths.clear();
  stats.totalLoaded = 0;
  stats.totalBytes = 0;
  stats.totalTimeMs = 0;
  stats.cacheHits = 0;
  stats.averageLoadTimeMs = 0;
  stats.byPriority = { critical: 0, high: 0, medium: 0, low: 0 };
  stats.texturesProcessed = 0;
  stats.dracoMeshesDecoded = 0;
  stats.retries = 0;
  stats.fallbacksServed = 0;
}

export function getAssetCacheSize(): number {
  return gltfCache.size;
}

export function getTextureCacheSize(): number {
  return textureCache.size;
}

export function getQueueLength(): number {
  return queue.length;
}

export function getActiveLoads(): number {
  return activeLoads;
}

export function getLoadersGlStatus(): { draco: boolean; images: boolean; textures: boolean } {
  return {
    draco: !!loadersGlDraco,
    images: !!loadersGlImages,
    textures: !!loadersGlTextures,
  };
}

export async function processImageWithLoadersGl(
  imageUrl: string,
  options?: { resize?: { width: number; height: number }; format?: string }
): Promise<THREE.Texture | null> {
  if (!loadersGlImages) return null;

  try {
    const { load } = await import("@loaders.gl/core");
    const { ImageLoader } = await import("@loaders.gl/images");

    const imageData = await load(imageUrl, ImageLoader, {
      image: {
        type: "data",
        ...(options?.resize && { resize: options.resize }),
      },
    });

    const _imgData: any = imageData;
    const texture = new THREE.DataTexture(
      new Uint8Array(_imgData.data),
      _imgData.width,
      _imgData.height,
      THREE.RGBAFormat,
    );
    texture.needsUpdate = true;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;

    stats.texturesProcessed++;
    return texture;
  } catch (e) {
    console.warn("[AssetLoader] processImageWithLoadersGl failed:", e);
    return null;
  }
}

export async function decodeDracoBuffer(
  arrayBuffer: ArrayBuffer
): Promise<THREE.BufferGeometry | null> {
  if (!loadersGlDraco) return null;

  try {
    const { load } = await import("@loaders.gl/core");
    const { DracoLoader } = await import("@loaders.gl/draco");

    const mesh = await load(arrayBuffer, DracoLoader, {
      draco: { decoderType: "wasm" },
    });

    const geometry = new THREE.BufferGeometry();

    if (mesh.attributes?.POSITION) {
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(mesh.attributes.POSITION.value), 3)
      );
    }
    if (mesh.attributes?.NORMAL) {
      geometry.setAttribute(
        "normal",
        new THREE.BufferAttribute(new Float32Array(mesh.attributes.NORMAL.value), 3)
      );
    }
    if (mesh.attributes?.TEXCOORD_0) {
      geometry.setAttribute(
        "uv",
        new THREE.BufferAttribute(new Float32Array(mesh.attributes.TEXCOORD_0.value), 2)
      );
    }
    if (mesh.indices) {
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(mesh.indices.value), 1));
    }

    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    stats.dracoMeshesDecoded++;

    return geometry;
  } catch (e) {
    console.warn("[AssetLoader] decodeDracoBuffer failed:", e);
    return null;
  }
}

export async function compressTextureBasis(
  imageData: ImageData | { data: Uint8Array; width: number; height: number }
): Promise<ArrayBuffer | null> {
  if (!loadersGlTextures) return null;

  try {
    const { encode } = await import("@loaders.gl/core");
    const texturesMod: any = await import("@loaders.gl/textures");
    const BasisWriter = texturesMod.BasisWriter;
    if (!BasisWriter) return null;

    const encoded = await encode(imageData, BasisWriter);
    return encoded;
  } catch (e) {
    console.warn("[AssetLoader] compressTextureBasis failed:", e);
    return null;
  }
}

export function disposeLoader(): void {
  if (dracoLoader) {
    dracoLoader.dispose();
    dracoLoader = null;
  }
  if (ktx2Loader) {
    ktx2Loader.dispose();
    ktx2Loader = null;
  }
  sharedLoader = null;
  rendererRef = null;
  loadersGlInitialized = false;
  loadersGlDraco = null;
  loadersGlImages = null;
  loadersGlTextures = null;
}

export function useAssetLoaderExtension(loader: GLTFLoader): GLTFLoader {
  loader.setDRACOLoader(createDracoLoader());
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (rendererRef) {
    loader.setKTX2Loader(createKTX2Loader(rendererRef));
  }
  return loader;
}
