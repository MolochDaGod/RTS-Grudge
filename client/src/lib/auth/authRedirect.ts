/**
 * authRedirect — URL builders and route-guard helpers shared across all
 * Grudge Studio apps (grudgewarlords.com, warlord-crafting-suite, etc.).
 *
 * This file has ZERO framework dependencies — safe to import from vanilla JS,
 * React, or the WCS puter-deploy shim.
 */

export const GRUDGE_ID_URL = "https://id.grudge-studio.com";

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

/**
 * Build the login URL, preserving the current page as the post-auth redirect.
 *
 * @param returnUrl  Where to send the player after login (default: current href)
 * @param reason     Short message shown on the id. login page ("wallet access" etc.)
 * @param provider   Pre-select a provider tab: "puter" | "discord" | "google" | "solana"
 */
export function buildLoginUrl(
  returnUrl?: string,
  reason?: string,
  provider?: "puter" | "discord" | "google" | "solana",
): string {
  const ret = returnUrl ?? (typeof window !== "undefined" ? window.location.href : "");
  const p = new URLSearchParams({ redirect: ret });
  if (reason)   p.set("reason",   reason);
  if (provider) p.set("provider", provider);
  return `${GRUDGE_ID_URL}/auth/login?${p.toString()}`;
}

/** Build the logout URL with optional post-logout destination. */
export function buildLogoutUrl(returnUrl?: string): string {
  const ret = returnUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${GRUDGE_ID_URL}/auth/logout?redirect=${encodeURIComponent(ret)}`;
}

/** Build the account page URL on id.grudge-studio.com. */
export function buildAccountUrl(): string {
  return `${GRUDGE_ID_URL}/account`;
}

// ---------------------------------------------------------------------------
// Redirect helpers
// ---------------------------------------------------------------------------

/** Hard-navigate to the login page. */
export function redirectToLogin(
  returnUrl?: string,
  reason?: string,
  provider?: "puter" | "discord" | "google" | "solana",
): void {
  if (typeof window === "undefined") return;
  window.location.href = buildLoginUrl(returnUrl, reason, provider);
}

/** Hard-navigate to the logout endpoint. */
export function redirectToLogout(returnUrl?: string): void {
  if (typeof window === "undefined") return;
  window.location.href = buildLogoutUrl(returnUrl);
}

// ---------------------------------------------------------------------------
// Protected route patterns
// ---------------------------------------------------------------------------

/**
 * Path prefixes that require a fully authenticated session.
 * Guest / Puter-only sessions are fine for play; these routes need Grudge ID.
 */
const PROTECTED_PREFIXES = [
  "/wallet",
  "/guild",
  "/trade",
  "/profile",
  "/admin",
  "/mapadmin",
  "/account",
  "/shop/checkout",
];

/**
 * Returns true if the given path requires a Grudge-authenticated session.
 * Used by both the server middleware and the client-side route guard.
 */
export function isProtectedRoute(path: string): boolean {
  const norm = path.split("?")[0].toLowerCase();
  return PROTECTED_PREFIXES.some(prefix => norm.startsWith(prefix));
}

/**
 * Client-side route guard. If the current route is protected and the user
 * is not authenticated, redirects immediately.
 *
 * Returns `true` if a redirect was issued (caller should bail out of render).
 *
 * @param isAuthenticated  Pass `true` when a valid session exists.
 * @param path             Path to check (default: current pathname).
 * @param reason           Optional reason string forwarded to the login page.
 */
export function guardRoute(
  isAuthenticated: boolean,
  path?: string,
  reason?: string,
): boolean {
  if (typeof window === "undefined") return false;
  const p = path ?? window.location.pathname;
  if (isAuthenticated || !isProtectedRoute(p)) return false;
  redirectToLogin(window.location.href, reason);
  return true;
}

// ---------------------------------------------------------------------------
// Token storage (thin wrappers — the real logic is in GrudgeSession.ts)
// These are exported so vanilla JS shims can call them without importing the
// full GrudgeSession module.
// ---------------------------------------------------------------------------

const _TOKEN_KEY     = "grudge.token";
const _TOKEN_EXP_KEY = "grudge.token.exp";

export function getStoredToken(): string | null {
  try {
    const t = localStorage.getItem(_TOKEN_KEY);
    if (!t) return null;
    const exp = Number(localStorage.getItem(_TOKEN_EXP_KEY) ?? "0");
    if (exp > 0 && Date.now() > exp) {
      localStorage.removeItem(_TOKEN_KEY);
      localStorage.removeItem(_TOKEN_EXP_KEY);
      return null;
    }
    return t;
  } catch { return null; }
}

export function storeToken(token: string, expiryMs: number): void {
  try {
    localStorage.setItem(_TOKEN_KEY, token);
    localStorage.setItem(_TOKEN_EXP_KEY, String(expiryMs));
  } catch {}
}

export function clearToken(): void {
  try {
    localStorage.removeItem(_TOKEN_KEY);
    localStorage.removeItem(_TOKEN_EXP_KEY);
  } catch {}
}

/** True when a valid (non-expired) Grudge token is stored. */
export function hasToken(): boolean {
  return getStoredToken() !== null;
}

// ---------------------------------------------------------------------------
// OAuth callback handler (call on the page that id. redirects back to)
// ---------------------------------------------------------------------------

/**
 * Parse auth tokens from URL query params.
 *
 * Supports two flows:
 *   1. id.grudge-studio.com redirect: `?grudge_token=...&expires_at=...`
 *   2. Cross-game SSO handoff:        `?sso_token=...&grudge_id=...&username=...`
 *      (sent by gameNav.ts when navigating between fleet games)
 *
 * Stores the token and returns `true` if a token was found + stored.
 * Call this at the top of your app's entry point (before any auth checks).
 */
export function handleAuthCallback(): boolean {
  if (typeof window === "undefined") return false;
  const p = new URLSearchParams(window.location.search);

  // Flow 1: id.grudge-studio.com direct redirect
  const grudgeToken = p.get("grudge_token");
  if (grudgeToken) {
    const exp = p.get("expires_at");
    const expiryMs = exp ? Number(exp) : Date.now() + 7 * 24 * 60 * 60 * 1000;
    storeToken(grudgeToken, expiryMs);
    const clean = new URL(window.location.href);
    clean.searchParams.delete("grudge_token");
    clean.searchParams.delete("expires_at");
    window.history.replaceState({}, "", clean.toString());
    return true;
  }

  // Flow 2: Cross-game SSO token pickup (?sso_token=...&grudge_id=...&username=...)
  const ssoToken = p.get("sso_token");
  if (ssoToken) {
    const expiryMs = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7-day default
    storeToken(ssoToken, expiryMs);
    // Persist grudge_id and username if provided
    const grudgeId = p.get("grudge_id");
    const username = p.get("username");
    if (grudgeId) {
      try { localStorage.setItem("grudge.playerId", `grudge_${grudgeId}`); } catch {}
    }
    if (username) {
      try { localStorage.setItem("grudge.displayName", username); } catch {}
    }
    // Clean the URL
    const clean = new URL(window.location.href);
    clean.searchParams.delete("sso_token");
    clean.searchParams.delete("grudge_id");
    clean.searchParams.delete("username");
    window.history.replaceState({}, "", clean.toString());
    return true;
  }

  return false;
}
