/**
 * Fleet home island session — links RTS creation to grudgewarlords hosting
 * and the in-game world / server connection layer.
 */

import { useIslandWorld, type IslandBiome } from '@/lib/stores/useIslandWorld';
import { HOME_ISLAND_HOST_URL } from '@/lib/fleetHomeIsland';

export const HOME_ISLAND_ID_KEY = 'grudge.homeIslandId';
export const HOME_ISLAND_SEED_KEY = 'grudge.homeIslandSeed';
export const HOME_ISLAND_NAME_KEY = 'grudge.homeIslandName';
export const HOME_ISLAND_HOST_KEY = 'grudge.homeIslandHost';

export interface FleetHomeIslandRecord {
  id: string;
  seed: number;
  name: string;
  hostUrl: string;
}

export function saveHomeIslandSession(island: {
  id: string;
  seed: number;
  name?: string;
}): void {
  try {
    localStorage.setItem(HOME_ISLAND_ID_KEY, island.id);
    localStorage.setItem(HOME_ISLAND_SEED_KEY, String(island.seed));
    localStorage.setItem(HOME_ISLAND_NAME_KEY, island.name ?? 'Home Island');
    localStorage.setItem(HOME_ISLAND_HOST_KEY, HOME_ISLAND_HOST_URL);
  } catch { /* quota */ }

  useIslandWorld.getState().registerFleetHomeIsland({
    id: island.id,
    name: island.name ?? 'Home Island',
    seed: island.seed,
    biome: 'temperate',
  });
}

export function loadHomeIslandSession(): FleetHomeIslandRecord | null {
  try {
    const id = localStorage.getItem(HOME_ISLAND_ID_KEY);
    const seedRaw = localStorage.getItem(HOME_ISLAND_SEED_KEY);
    if (!id || !seedRaw) return null;
    return {
      id,
      seed: Number(seedRaw),
      name: localStorage.getItem(HOME_ISLAND_NAME_KEY) ?? 'Home Island',
      hostUrl: localStorage.getItem(HOME_ISLAND_HOST_KEY) ?? HOME_ISLAND_HOST_URL,
    };
  } catch {
    return null;
  }
}

/** Colyseus / world-server island room id for co-op home sessions. */
export function getHomeIslandRoomId(ownerId: string, islandId: string): string {
  return `home_${ownerId}_${islandId}`.replace(/[^a-zA-Z0-9_]/g, '_');
}