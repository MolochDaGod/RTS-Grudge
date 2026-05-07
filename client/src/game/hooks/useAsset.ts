import { loadAsset, onFailedAssetsCleared } from "../systems/AssetLoader";
import { resolveCharacterModelPath } from "../systems/CharacterModelResolver";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

// Suspense-style cache: hooks throw a Promise on first read, then return the
// resolved GLTF on the next render. Routing through `loadAsset` means useAsset
// shares the retry-with-backoff and magenta-cube fallback path with every
// other consumer (WeaponModelLoader, preloadCritical, etc.) — single source of
// truth for "did this asset load?".
const suspenseCache = new Map<string, GLTF | Promise<GLTF>>();

// When AssetLoader's failed-path cache is cleared (e.g. dev re-attempts after
// fixing a missing GLB), drop our cached fallback entries so the next render
// re-throws and re-fetches instead of serving the magenta cube forever.
onFailedAssetsCleared(() => {
  for (const [k, v] of Array.from(suspenseCache.entries())) {
    if (!(v instanceof Promise) && (v as GLTF).userData?.isAssetFallback) {
      suspenseCache.delete(k);
    }
  }
});

function suspendOnLoad(rawPath: string): GLTF {
  const path = resolveCharacterModelPath(rawPath);
  let entry = suspenseCache.get(path);
  if (!entry) {
    const promise = loadAsset(path, "medium", "useAsset").then((gltf) => {
      suspenseCache.set(path, gltf);
      return gltf;
    });
    suspenseCache.set(path, promise);
    entry = promise;
  }
  if (entry instanceof Promise) {
    // React Suspense contract: throw the pending promise.
    throw entry;
  }
  return entry;
}

export function useAsset(path: string): GLTF {
  return suspendOnLoad(path);
}

export function useAssets(paths: string[]): GLTF[] {
  // Kick off all loads in parallel before suspending; that way Suspense only
  // unblocks once *all* are settled, matching the previous useLoader semantics.
  const pendings: Promise<GLTF>[] = [];
  for (const p of paths) {
    const resolved = resolveCharacterModelPath(p);
    const cached = suspenseCache.get(resolved);
    if (!cached) {
      const pending = loadAsset(resolved, "medium", "useAssets").then((gltf) => {
        suspenseCache.set(resolved, gltf);
        return gltf;
      });
      suspenseCache.set(resolved, pending);
      pendings.push(pending);
    } else if (cached instanceof Promise) {
      pendings.push(cached);
    }
  }
  if (pendings.length > 0) {
    throw Promise.all(pendings);
  }
  return paths.map((p) => {
    const resolved = resolveCharacterModelPath(p);
    return suspenseCache.get(resolved) as GLTF;
  });
}

/** Test-only helper for clearing the Suspense cache. */
export function clearAssetSuspenseCache(): void {
  suspenseCache.clear();
}
