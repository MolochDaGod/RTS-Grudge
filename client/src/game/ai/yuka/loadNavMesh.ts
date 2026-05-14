import { NavMeshLoader, NavMesh } from "yuka";

const cache = new Map<string, Promise<NavMesh>>();

export function loadNavMesh(url: string, options?: { epsilonCoplanarTest?: number }): Promise<NavMesh> {
  const key = url + JSON.stringify(options ?? {});
  const cached = cache.get(key);
  if (cached) return cached;
  const loader = new NavMeshLoader();
  const p = loader.load(url, options).then((nav) => nav as NavMesh);
  cache.set(key, p);
  return p;
}

export function clearNavMeshCache(url?: string) {
  if (url) {
    for (const k of Array.from(cache.keys())) {
      if (k.startsWith(url)) cache.delete(k);
    }
  } else {
    cache.clear();
  }
}
