/**
 * Fleet home island — RTS creates on /island, grudgewarlords.com hosts on /home-island.
 * API calls go to WCS (cross-origin) keyed by Grudge UUID.
 */

import { getStoredToken, PLAYER_ID_KEY } from '@/lib/auth/authRedirect';

export const HOME_ISLAND_HOST_PATH = '/home-island';
export const ISLAND_CREATE_PATH = '/island';

export const GRUDGE_WARLORDS_URL =
  import.meta.env.VITE_GRUDGE_WARLORDS_URL ?? 'https://grudgewarlords.com';

export const WCS_API_ORIGIN =
  import.meta.env.VITE_WCS_URL ?? 'https://warlord-crafting-suite.vercel.app';

export const RTS_ORIGIN =
  import.meta.env.VITE_RTS_URL ?? 'https://rts-grudge.vercel.app';

/** Where players manage their hosted island after creation. */
export const HOME_ISLAND_HOST_URL = `${GRUDGE_WARLORDS_URL.replace(/\/+$/, '')}${HOME_ISLAND_HOST_PATH}`;

/** Where new islands are forged (RTS only). */
export const ISLAND_CREATE_URL = `${RTS_ORIGIN.replace(/\/+$/, '')}${ISLAND_CREATE_PATH}`;

export interface HomeIslandResponse {
  island: {
    id: string;
    seed: number;
    name: string;
    userId: string;
    islandType: string;
    width: number;
    height: number;
  } | null;
  hasHomeIsland: boolean;
  isNew: boolean;
  seed?: number;
}

export interface ConfirmHomeIslandPayload {
  characterId: string;
  islandName?: string;
  campPosition: { x: number; y: number };
  seed?: number;
  width?: number;
  height?: number;
}

function readPlayerId(): string | null {
  try {
    return localStorage.getItem(PLAYER_ID_KEY);
  } catch {
    return null;
  }
}

export function getHomeIslandAuthHeaders(userId?: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const uid = userId ?? readPlayerId();
  if (uid) headers['X-User-Id'] = uid;
  return headers;
}

function userIdCandidates(playerId: string): string[] {
  const ids = new Set<string>([playerId]);
  if (playerId.startsWith('grudge_')) ids.add(playerId.slice('grudge_'.length));
  else if (!playerId.startsWith('puter_') && !playerId.startsWith('anon')) {
    ids.add(`grudge_${playerId}`);
  }
  return [...ids];
}

export async function fetchHomeIsland(
  characterId: string,
  playerId: string,
): Promise<HomeIslandResponse> {
  let lastError: Error | null = null;
  for (const userId of userIdCandidates(playerId)) {
    try {
      const res = await fetch(
        `${WCS_API_ORIGIN}/api/home-island?characterId=${encodeURIComponent(characterId)}`,
        { headers: getHomeIslandAuthHeaders(userId) },
      );
      if (!res.ok) {
        lastError = new Error(`home-island GET ${res.status}`);
        continue;
      }
      return res.json();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error('Failed to load home island');
}

export async function confirmHomeIsland(
  payload: ConfirmHomeIslandPayload,
  playerId: string,
): Promise<{ success: boolean; island: HomeIslandResponse['island'] & { id: string } }> {
  let lastError: Error | null = null;
  for (const userId of userIdCandidates(playerId)) {
    try {
      const res = await fetch(`${WCS_API_ORIGIN}/api/home-island/confirm`, {
        method: 'POST',
        headers: getHomeIslandAuthHeaders(userId),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        lastError = new Error(`home-island confirm ${res.status}: ${body.slice(0, 120)}`);
        continue;
      }
      return res.json();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error('Failed to save home island');
}

/** Navigate to the hosted island on grudgewarlords.com (no redirect loop). */
export function openHostedHomeIsland(): void {
  if (typeof window === 'undefined') return;
  window.location.assign(HOME_ISLAND_HOST_URL);
}