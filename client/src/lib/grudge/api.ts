// Thin client for the Grudge Studio backend (api.grudge-studio.com /
// id.grudge-studio.com). Read-only on this side for now: every endpoint here
// already exists on the live deploy, verified during the Phase A audit.
//
// Anything that would mutate central state (e.g. linking wallets, writing
// account-level entitlements) goes through the server-to-server path on the
// Express side, never directly from the browser.

const TIMEOUT_MS = 10_000;

// Resolved at module load. `import.meta.env` is the Vite-injected env bag.
const RAW_API = (import.meta as any).env?.VITE_GRUDGE_API_URL as string | undefined;
const RAW_AUTH = (import.meta as any).env?.VITE_GRUDGE_AUTH_URL as string | undefined;
const RAW_LOGIN = (import.meta as any).env?.VITE_GRUDGE_LOGIN_URL as string | undefined;

export const GRUDGE_API_URL = (RAW_API ?? "https://api.grudge-studio.com").replace(/\/+$/, "");
export const GRUDGE_AUTH_URL = (RAW_AUTH ?? "https://id.grudge-studio.com").replace(/\/+$/, "");
export const GRUDGE_LOGIN_URL = (RAW_LOGIN ?? `${GRUDGE_AUTH_URL}/login`).replace(/\/+$/, "");

export interface GrudgeUser {
  id: string;
  email?: string | null;
  username?: string | null;
  displayName?: string | null;
  role?: "user" | "admin" | string;
  roles?: string[];
  avatarUrl?: string | null;
  // Anything else the central service decides to ship.
  [key: string]: unknown;
}

export interface GrudgeHealth {
  status: string;
  ts?: number;
  env?: string;
}

export interface GrudgeGame {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      credentials: "include", // send the gw_player httpOnly cookie cross-site
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      ...init,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`${res.status} ${res.statusText}${text ? ` :: ${text.slice(0, 200)}` : ""}`);
      (err as any).status = res.status;
      throw err;
    }
    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const grudgeApi = {
  /** /api/health on the central API. Cheap heartbeat. */
  health: () => request<GrudgeHealth>(`${GRUDGE_API_URL}/api/health`),

  /** Catalog of titles published under the Grudge Studio umbrella. */
  getGames: () => request<GrudgeGame[] | { games: GrudgeGame[] }>(`${GRUDGE_API_URL}/api/games`),

  /** Current session user; resolves to null on 401 (not logged in). */
  getMe: async (): Promise<GrudgeUser | null> => {
    try {
      return await request<GrudgeUser>(`${GRUDGE_AUTH_URL}/api/auth/me`);
    } catch (e: any) {
      if (e?.status === 401) return null;
      throw e;
    }
  },

  /**
   * Exchange a one-time `?session=...` token (issued by id.grudge-studio.com
   * after a successful OAuth round-trip) for the persistent gw_player cookie
   * on this game's origin. Used when the SSO redirect lands users back here.
   */
  exchangeToken: (sessionToken: string) =>
    request<GrudgeUser>(`${GRUDGE_AUTH_URL}/api/auth/session/exchange`, {
      method: "POST",
      body: JSON.stringify({ token: sessionToken }),
    }),

  /** Server-side session destroy. Best-effort; the client is responsible for
   *  clearing local zustand state regardless of the response. */
  logout: () =>
    request<{ ok: boolean }>(`${GRUDGE_AUTH_URL}/api/auth/logout`, {
      method: "POST",
    }).catch(() => ({ ok: false })),
};

/**
 * Redirect to the central login screen with a ?return= parameter so the
 * identity service knows where to send users back. Caller does not return.
 */
export function startGrudgeLogin(): void {
  if (typeof window === "undefined") return;
  const here = encodeURIComponent(window.location.href);
  window.location.href = `${GRUDGE_LOGIN_URL}?return=${here}`;
}
