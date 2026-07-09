/**
 * ObjectStoreClient — thin wrapper around the public Grudge Studio ObjectStore
 * worker (https://objectstore.grudge-studio.com), tuned for the editor's
 * Three.js model-loading needs.
 *
 * URL precedence (highest first):
 *   1. window.__GRUDGE_OBJECTSTORE_URL__ (runtime override)
 *   2. import.meta.env.VITE_OBJECT_STORE_URL
 *   3. Default: https://objectstore.grudge-studio.com
 *
 * Asset key convention follows the @grudge-studio/objectstore SDK exactly:
 *   - List:    GET  /v1/assets?prefix=<prefix>
 *   - Meta:    GET  /v1/assets/<encoded-key>
 *   - File:    GET  /v1/assets/<encoded-key>/file       ← what loaders fetch
 *   - Health:  GET  /v1/health
 *
 * We keep this module tiny and dependency-free (no fetching of metadata is
 * required for the typical "place a known creature" path); the Three loaders
 * just stream the .FBX/.GLB straight from the file endpoint.
 */
import * as THREE from 'three';
import { FBXLoader, GLTFLoader } from 'three-stdlib';

// ── Base URL resolution ───────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __GRUDGE_OBJECTSTORE_URL__: string | undefined;
}

const DEFAULT_OBJECT_STORE_URL = 'https://objectstore.grudge-studio.com';

function readEnv(key: string): string | undefined {
  try {
    // Vite injects import.meta.env at build time; tsconfig already maps it.
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    const v = env?.[key];
    return typeof v === 'string' && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

export function getObjectStoreBase(): string {
  if (typeof globalThis !== 'undefined' && globalThis.__GRUDGE_OBJECTSTORE_URL__) {
    return globalThis.__GRUDGE_OBJECTSTORE_URL__.replace(/\/$/, '');
  }
  return (readEnv('VITE_OBJECT_STORE_URL') ?? DEFAULT_OBJECT_STORE_URL).replace(/\/$/, '');
}

/**
 * Build a public file URL for an asset key. Keys use forward slashes
 * (`monsters/models/foo.FBX`) and we URI-encode the whole thing as a single
 * path segment because the worker treats the key as opaque.
 */
export function objectStoreFileUrl(key: string): string {
  const trimmed = key.replace(/^\/+/, '');
  return `${getObjectStoreBase()}/v1/assets/${encodeURIComponent(trimmed)}/file`;
}

/**
 * Some R2 deployments key assets under a `game-assets/` prefix
 * (see ObjectStore `r2-upload-manifest.json`); others expose them at the
 * raw `monsters/...` path. We try the bare key first, then retry with
 * the prefix on 404 / network error so the studio works against either
 * shape without per-deploy config.
 */
function urlsToTry(key: string): string[] {
  const trimmed = key.replace(/^\/+/, '');

  // Local Vite public assets (e.g. assets/animations/swim/swimming.fbx)
  // and explicit local: prefix — skip ObjectStore entirely.
  if (
    trimmed.startsWith('assets/') ||
    trimmed.startsWith('local/') ||
    trimmed.startsWith('local:')
  ) {
    let rel = trimmed
      .replace(/^local:/, '')
      .replace(/^local\//, 'assets/');
    if (!rel.startsWith('assets/')) rel = `assets/${rel}`;
    let base = '/';
    try {
      const env = (import.meta as unknown as { env?: Record<string, string> }).env;
      base = (env?.BASE_URL ?? '/').replace(/\/?$/, '/');
    } catch { /* ignore */ }
    return [`${base}${rel}`];
  }

  const out = [trimmed];
  if (!trimmed.startsWith('game-assets/')) out.push(`game-assets/${trimmed}`);
  return out.map(
    (k) => `${getObjectStoreBase()}/v1/assets/${encodeURIComponent(k)}/file`,
  );
}

/** Wraps a Three loader's `.load(...)` callback in a Promise with URL-fallback. */
function loadWithFallback<T>(
  key: string,
  loadOnce: (url: string) => Promise<T>,
): Promise<T> {
  const urls = urlsToTry(key);
  let i = 0;
  const tryNext = (): Promise<T> =>
    loadOnce(urls[i]!).catch((err) => {
      i++;
      if (i >= urls.length) throw err;
      // eslint-disable-next-line no-console
      console.warn(`[ObjectStore] ${urls[i - 1]} failed, retrying ${urls[i]}`);
      return tryNext();
    });
  return tryNext();
}

// ── Loader singletons (FBX skeletons share a loader; cheap to keep) ───

const fbxLoader = new FBXLoader();
const gltfLoader = new GLTFLoader();

// In-flight promise cache keyed by URL — calling code can request the same
// model from many entities without spamming the network. We cache the raw
// loaded scene/animations; the AnimatedCreature component clones per-instance.
const sceneCache = new Map<string, Promise<THREE.Group>>();
const animCache = new Map<string, Promise<THREE.AnimationClip[]>>();

/**
 * Load the base mesh (rig + skinned mesh) of an FBX as a THREE.Group.
 * The result is shared across instances — DO NOT mutate it; clone with
 * `SkeletonUtils.clone` per entity in the React layer.
 */
export function loadFbxBase(key: string): Promise<THREE.Group> {
  let p = sceneCache.get(key);
  if (!p) {
    p = loadWithFallback(key, (url) =>
      new Promise<THREE.Group>((resolve, reject) => {
        fbxLoader.load(url, (obj) => resolve(obj), undefined, (err) => reject(err));
      }),
    );
    sceneCache.set(key, p);
  }
  return p;
}

/**
 * Load just the AnimationClip[] from an animation-only FBX (e.g. xiezi@walk.FBX).
 * Returns the FBX's `animations` array — typically a single clip per file in
 * the bundled FRESH GRUDGE packs.
 */
export function loadFbxAnimations(key: string): Promise<THREE.AnimationClip[]> {
  let p = animCache.get(key);
  if (!p) {
    p = loadWithFallback(key, (url) =>
      new Promise<THREE.AnimationClip[]>((resolve, reject) => {
        fbxLoader.load(
          url,
          (obj) => resolve(obj.animations),
          undefined,
          (err) => reject(err),
        );
      }),
    );
    animCache.set(key, p);
  }
  return p;
}

/**
 * Load a GLB/GLTF model. Returned scene is shared — clone per instance.
 * Used by the rock-formation pipeline (kaykit aquatic-ruins rocks etc.) so
 * the studio can pull real assets from ObjectStore the same way it pulls
 * creatures.
 */
export function loadGlb(key: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  return loadWithFallback(key, (url) =>
    new Promise((resolve, reject) => {
      gltfLoader.load(
        url,
        (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations }),
        undefined,
        (err) => reject(err),
      );
    }),
  );
}

/**
 * High-level helper: load an FBX skeleton + a map of (clipName → animation
 * FBX key) and stitch the animations onto the base group, renaming each
 * clip to its semantic state name (idle/walk/attack/...) so React code can
 * look them up without caring about the original "@walk" file naming.
 *
 * Returns a fresh Group ready to be cloned with SkeletonUtils.clone.
 */
export async function loadAnimatedFbx(
  baseKey: string,
  clipMap: Record<string, string>,
): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  const [base, ...clipBundles] = await Promise.all([
    loadFbxBase(baseKey),
    ...Object.values(clipMap).map((k) => loadFbxAnimations(k)),
  ]);

  const stitched: THREE.AnimationClip[] = [];
  const names = Object.keys(clipMap);
  clipBundles.forEach((clips, i) => {
    const stateName = names[i]!;
    // Most "@<anim>.FBX" packs ship one clip per file; if the artist exported
    // several, we keep them all but only the first gets the canonical state
    // name so React code can `actions[stateName]` reliably.
    clips.forEach((c, j) => {
      const renamed = c.clone();
      renamed.name = j === 0 ? stateName : `${stateName}_${j}`;
      stitched.push(renamed);
    });
  });

  return { scene: base, animations: stitched };
}

/**
 * Optional health probe — useful for the /admin diagnostics page to surface
 * a green/red dot next to "ObjectStore reachable". Not used in the editor's
 * critical path; failures of individual assets surface as load errors.
 */
export interface ObjectStoreModelRecord {
  id: string;
  filename: string;
  mime: string;
  size: number;
  category: string;
  tags: string[];
  created_at: string;
  file_url: string;
  thumbnail_url?: string;
}

export interface ObjectStoreModelsPage {
  models: ObjectStoreModelRecord[];
  count: number;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export interface ListModelsParams {
  limit?: number;
  offset?: number;
  category?: string;
  search?: string;
}

export async function listObjectStoreModels(
  params: ListModelsParams = {},
): Promise<ObjectStoreModelsPage> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 24));
  qs.set("offset", String(params.offset ?? 0));
  if (params.category) qs.set("category", params.category);
  if (params.search) qs.set("search", params.search);

  const res = await fetch(`${getObjectStoreBase()}/v1/models?${qs}`);
  if (!res.ok) {
    throw new Error(`ObjectStore models ${res.status}`);
  }
  return res.json() as Promise<ObjectStoreModelsPage>;
}

/** Full URL for a model file (Worker path or absolute CDN). */
export function modelFileUrl(model: ObjectStoreModelRecord): string {
  if (model.file_url.startsWith("http")) return model.file_url;
  return `${getObjectStoreBase()}${model.file_url}`;
}

export async function objectStoreHealth(): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(`${getObjectStoreBase()}/v1/health`);
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
