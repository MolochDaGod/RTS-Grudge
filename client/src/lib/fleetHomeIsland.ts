/**
 * Fleet home island redirect — RTS /island routes to the canonical generator
 * on grudgewarlords.com (WCS shell). Islands save to Grudge UUID via WCS API.
 */

import { getStoredToken, PLAYER_ID_KEY } from '@/lib/auth/authRedirect';

export const HOME_ISLAND_CANONICAL_PATH = '/home-island';

export const GRUDGE_WARLORDS_URL =
  import.meta.env.VITE_GRUDGE_WARLORDS_URL ?? 'https://grudgewarlords.com';

export const WCS_ORIGIN =
  import.meta.env.VITE_WCS_URL ?? 'https://warlord-crafting-suite.vercel.app';

/** Canonical home island URL for fleet redirects. */
export function getCanonicalHomeIslandUrl(): string {
  const host =
    typeof window !== 'undefined' ? window.location.hostname : '';
  const base =
    host === 'localhost' || host.endsWith('.vercel.app')
      ? WCS_ORIGIN
      : GRUDGE_WARLORDS_URL;
  return `${base.replace(/\/+$/, '')}${HOME_ISLAND_CANONICAL_PATH}`;
}

/**
 * Hard-navigate to the fleet home island. Grudge ID SSO on id.grudge-studio.com
 * keeps the session across domains — no token in the URL.
 */
export function redirectToCanonicalHomeIsland(): void {
  if (typeof window === 'undefined') return;
  const target = getCanonicalHomeIslandUrl();
  if (window.location.href.replace(/\/+$/, '').endsWith(HOME_ISLAND_CANONICAL_PATH)) {
    return;
  }
  window.location.replace(target);
}

/** Headers for cross-origin WCS home-island API (if embedded later). */
export function getHomeIslandAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const playerId = localStorage.getItem(PLAYER_ID_KEY);
    if (playerId) headers['X-User-Id'] = playerId;
  } catch { /* ignore */ }
  return headers;
}