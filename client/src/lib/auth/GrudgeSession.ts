/**
 * GrudgeSession — Centralized auth session manager for all Grudge Studio apps.
 *
 * Responsibilities:
 *  1. Silent session restore on page load (Puter + Grudge token)
 *  2. Keep-alive: refresh Grudge token before it expires so players stay logged in
 *  3. Cross-tab sync via localStorage StorageEvent
 *  4. Redirect to id.grudge-studio.com when a protected feature needs auth
 *  5. Graceful guest fallback — never blocks play, just unlocks sync features
 *
 * Session priority:
 *   1. Grudge JWT (id.grudge-studio.com) — most authoritative, multi-device
 *   2. Puter UUID (puter.js SDK)          — automatic, cloud-save enabled
 *   3. Anonymous localStorage ID          — ephemeral guest, local only
 *
 * Token storage keys (localStorage):
 *   grudge.token       — Grudge JWT
 *   grudge.token.exp   — expiry as Unix ms
 *   grudge.playerId    — canonical player ID (puter_<uuid> or grudge_<id>)
 *   puter.user         — Puter SDK cache (SDK-owned, read-only here)
 */

import { getPuterUuidSync, puterReady, getPuterUser, type PuterUser } from "./puter";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ID_SERVICE = "https://id.grudge-studio.com";

const TOKEN_KEY      = "grudge.token";
const TOKEN_EXP_KEY  = "grudge.token.exp";
const PLAYER_ID_KEY  = "grudge.playerId";

/** Refresh the token when this many ms remain until expiry (15 min buffer). */
const REFRESH_BUFFER_MS = 15 * 60 * 1000;

/** How long a guest anonymous ID is trusted before a new one is minted (7 days). */
const GUEST_ID_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const GUEST_ID_KEY     = "grudge.guestId";
const GUEST_ID_TS_KEY  = "grudge.guestId.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GrudgeSessionUser {
  playerId: string;
  displayName: string | null;
  email: string | null;
  tier: "master_admin" | "admin" | "member" | "pleb";
  provider: "grudge" | "puter" | "guest";
  authenticated: boolean;
  avatarUrl?: string | null;
}

export type SessionChangeListener = (user: GrudgeSessionUser | null) => void;

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let _currentUser: GrudgeSessionUser | null = null;
let _keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let _listeners = new Set<SessionChangeListener>();
let _initPromise: Promise<GrudgeSessionUser | null> | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomHex(n: number): string {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => b.toString(16).padStart(2, "0")).join("");
}

function safeRead(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeWrite(key: string, val: string): void {
  try { localStorage.setItem(key, val); } catch {}
}

function safeRemove(key: string): void {
  try { localStorage.removeItem(key); } catch {}
}

function emit(user: GrudgeSessionUser | null): void {
  _currentUser = user;
  _listeners.forEach(fn => {
    try { fn(user); } catch {}
  });
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

/** Store a Grudge JWT and its expiry in localStorage. */
export function storeGrudgeToken(token: string, expiryMs: number): void {
  safeWrite(TOKEN_KEY, token);
  safeWrite(TOKEN_EXP_KEY, String(expiryMs));
}

/** Read the stored Grudge JWT. Returns null if absent or expired. */
export function getStoredToken(): string | null {
  const token = safeRead(TOKEN_KEY);
  if (!token) return null;
  const exp = Number(safeRead(TOKEN_EXP_KEY) ?? "0");
  if (exp > 0 && Date.now() > exp) {
    clearStoredToken();
    return null;
  }
  return token;
}

/** True when a stored token is still valid (not expired). */
export function hasValidToken(): boolean {
  return getStoredToken() !== null;
}

/** Delete the stored Grudge token + expiry. */
export function clearStoredToken(): void {
  safeRemove(TOKEN_KEY);
  safeRemove(TOKEN_EXP_KEY);
}

// ---------------------------------------------------------------------------
// Guest ID (stable anonymous ID, recycled after TTL)
// ---------------------------------------------------------------------------

function getOrCreateGuestId(): string {
  const existing = safeRead(GUEST_ID_KEY);
  const ts       = Number(safeRead(GUEST_ID_TS_KEY) ?? "0");
  if (existing && Date.now() - ts < GUEST_ID_TTL_MS) return existing;
  const id = `anon_${randomHex(12)}`;
  safeWrite(GUEST_ID_KEY, id);
  safeWrite(GUEST_ID_TS_KEY, String(Date.now()));
  return id;
}

// ---------------------------------------------------------------------------
// Session resolve: returns the best available user context
// ---------------------------------------------------------------------------

async function resolveSession(): Promise<GrudgeSessionUser | null> {
  // 1 ── Grudge token (highest authority)
  const token = getStoredToken();
  if (token) {
    try {
      const resp = await fetch(`${ID_SERVICE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000),
      });
      if (resp.ok) {
        const data = await resp.json();
        const user: GrudgeSessionUser = {
          playerId:      `grudge_${data.grudgeId || data.id}`,
          displayName:   data.username || data.displayName || null,
          email:         data.email || null,
          tier:          data.tier || "pleb",
          provider:      "grudge",
          authenticated: true,
          avatarUrl:     data.avatarUrl || null,
        };
        safeWrite(PLAYER_ID_KEY, user.playerId);
        return user;
      }
      // Token rejected / expired — clear it so we fall through
      clearStoredToken();
    } catch {
      // Network error — trust cached playerId if available, keep token for next retry
      const cached = safeRead(PLAYER_ID_KEY);
      if (cached?.startsWith("grudge_")) {
        return {
          playerId:      cached,
          displayName:   null,
          email:         null,
          tier:          "pleb",
          provider:      "grudge",
          authenticated: true,
          avatarUrl:     null,
        };
      }
    }
  }

  // 2 ── Puter SDK session
  const puterUuid = getPuterUuidSync();
  if (puterUuid) {
    // Try to get richer info if SDK is fully ready
    let puterUser: PuterUser | null = null;
    try {
      const sdk = await Promise.race([
        puterReady(1500),
        new Promise<null>(r => setTimeout(() => r(null), 1600)),
      ]);
      if (sdk?.auth.isSignedIn()) {
        puterUser = await getPuterUser();
      }
    } catch {}

    const playerId = `puter_${puterUuid}`;
    safeWrite(PLAYER_ID_KEY, playerId);
    return {
      playerId,
      displayName:   puterUser?.username || null,
      email:         puterUser?.email    || null,
      tier:          "pleb",
      provider:      "puter",
      authenticated: true,
      avatarUrl:     null,
    };
  }

  // 3 ── Anonymous guest
  const guestId = getOrCreateGuestId();
  safeWrite(PLAYER_ID_KEY, guestId);
  return {
    playerId:      guestId,
    displayName:   null,
    email:         null,
    tier:          "pleb",
    provider:      "guest",
    authenticated: false,
    avatarUrl:     null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the session once. Idempotent — safe to call from multiple
 * components. Returns the resolved user (or null on hard failure).
 */
export async function initSession(): Promise<GrudgeSessionUser | null> {
  if (_initPromise) return _initPromise;
  _initPromise = resolveSession().then(user => {
    emit(user);
    startKeepAlive();
    return user;
  });
  return _initPromise;
}

/** Get the current user synchronously. null until initSession() resolves. */
export function getCurrentUser(): GrudgeSessionUser | null {
  return _currentUser;
}

/** Subscribe to session changes (sign-in, sign-out, token refresh). */
export function onSessionChange(fn: SessionChangeListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/**
 * Sign out from all providers and clear all stored credentials.
 * Emits null to all listeners.
 */
export async function signOut(): Promise<void> {
  // Clear Grudge token
  clearStoredToken();
  safeRemove(PLAYER_ID_KEY);

  // Sign out of Puter if signed in
  try {
    const sdk = await puterReady(1000);
    if (sdk?.auth.isSignedIn()) await sdk.auth.signOut();
  } catch {}

  stopKeepAlive();
  _initPromise = null;
  emit(null);
}

/**
 * Redirect to id.grudge-studio.com login page.
 * Preserves the current URL as the post-login redirect target.
 *
 * @param returnUrl  Override the return URL (defaults to current page)
 * @param reason     Optional human-readable reason shown on the login page
 */
export function redirectToLogin(returnUrl?: string, reason?: string): void {
  const ret = returnUrl ?? (typeof window !== "undefined" ? window.location.href : "");
  const params = new URLSearchParams({ redirect: ret });
  if (reason) params.set("reason", reason);
  window.location.href = `${ID_SERVICE}/auth/login?${params.toString()}`;
}

/**
 * If the user is not authenticated, redirect to id.grudge-studio.com.
 * Returns true when redirection was triggered (caller should stop rendering).
 */
export function requireAuth(reason?: string): boolean {
  if (_currentUser?.authenticated) return false;
  redirectToLogin(undefined, reason);
  return true;
}

// ---------------------------------------------------------------------------
// Keep-alive: silently refresh the Grudge token before it expires
// ---------------------------------------------------------------------------

function startKeepAlive(): void {
  stopKeepAlive();
  _keepAliveTimer = setInterval(async () => {
    const token = getStoredToken();
    if (!token) return;

    const exp = Number(safeRead(TOKEN_EXP_KEY) ?? "0");
    const timeLeft = exp - Date.now();
    if (exp === 0 || timeLeft > REFRESH_BUFFER_MS) return;

    // Token about to expire — refresh it
    try {
      const resp = await fetch(`${ID_SERVICE}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.token && data.expiresAt) {
          storeGrudgeToken(data.token, data.expiresAt);
          console.info("[GrudgeSession] Token refreshed silently");
        }
      } else if (resp.status === 401) {
        // Refresh rejected — sign the user out gracefully
        console.warn("[GrudgeSession] Refresh rejected, clearing session");
        await signOut();
      }
    } catch {
      // Network blip — try again next interval
    }
  }, 60_000); // check every minute
}

function stopKeepAlive(): void {
  if (_keepAliveTimer !== null) {
    clearInterval(_keepAliveTimer);
    _keepAliveTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Cross-tab session sync
// ---------------------------------------------------------------------------

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e: StorageEvent) => {
    if (!e.key) return;

    // Another tab signed out
    if (e.key === TOKEN_KEY && e.newValue === null && _currentUser?.authenticated) {
      console.info("[GrudgeSession] Sign-out detected in another tab");
      _initPromise = null;
      initSession(); // re-resolve (will fall back to puter/guest)
      return;
    }

    // Another tab signed in with a new token
    if (e.key === TOKEN_KEY && e.newValue && !_currentUser?.authenticated) {
      console.info("[GrudgeSession] Sign-in detected in another tab");
      _initPromise = null;
      initSession();
      return;
    }

    // Puter sign-in from another tab
    if (e.key === "puter.user" || e.key === "puter_user") {
      if (e.newValue && !_currentUser?.authenticated) {
        _initPromise = null;
        initSession();
      }
    }
  });
}

// ---------------------------------------------------------------------------
// React hook (avoids importing React here — consumer imports the hook)
// ---------------------------------------------------------------------------
// The React hook lives in useGrudgeSession.ts to keep this file framework-free.
