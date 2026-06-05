/**
 * grudgeServices — single source of truth for Grudge Studio backend URLs and
 * the localStorage keys used by the auth session layer.
 *
 * Every other client module (GrudgeSession.ts, authRedirect.ts,
 * useGrudgeSession.ts, future API helpers) MUST import its URLs and token
 * keys from this file. Never redeclare them locally.
 *
 * URL precedence (highest first):
 *   1. import.meta.env.VITE_* override (set in .env / Vercel project env)
 *   2. Hard-coded production default
 *
 * In production, the Vercel rewrites in vercel.json proxy `/api/*` to
 * api.grudge-studio.com and `/socket.io/*` to ws.grudge-studio.com, so most
 * client code should call those endpoints with relative paths. The absolute
 * URLs below are for the cases that need them (cross-origin auth redirects,
 * <img src> for the CDN, direct WS handshakes outside the proxy, etc.).
 *
 * The vanilla JS shim at grudge-auth-shim.js intentionally redeclares its own
 * copies of these constants — it has to run before the bundle loads and
 * cannot import ES modules. Keep that one in sync by convention.
 */

// ---------------------------------------------------------------------------
// Env helper — safe access to Vite env vars (handles SSR / test runners)
// ---------------------------------------------------------------------------

function viteEnv(name: string): string | undefined {
  try {
    const env = (import.meta as any)?.env;
    const v = env?.[name];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// Service URLs (all overridable via VITE_* env, all trimmed of trailing slash)
// ---------------------------------------------------------------------------

/** Grudge ID — auth, SSO, JWT issuance, /account page. */
export const GRUDGE_ID_URL = trimTrailingSlash(
  viteEnv("VITE_GRUDGE_ID_URL") ?? "https://id.grudge-studio.com",
);

/** Game API — characters, saves, inventory, game-config, ObjectStore. */
export const GAME_API_URL = trimTrailingSlash(
  viteEnv("VITE_GAME_API_URL") ?? "https://api.grudge-studio.com",
);

/** Account API — profiles, social, achievements. */
export const ACCOUNT_API_URL = trimTrailingSlash(
  viteEnv("VITE_ACCOUNT_API_URL") ?? "https://account.grudge-studio.com",
);

/** Socket.IO world server — zones, lobbies, real-time PvP. */
export const WS_URL = trimTrailingSlash(
  viteEnv("VITE_WS_URL") ?? "https://ws.grudge-studio.com",
);

/** Cloudflare R2 asset CDN — GLB models, sprites, audio. */
export const ASSETS_URL = trimTrailingSlash(
  viteEnv("VITE_ASSETS_URL") ?? "https://assets.grudge-studio.com",
);

/** Convenience: account page on the Grudge ID host. */
export const ACCOUNT_URL = `${GRUDGE_ID_URL}/account`;

/**
 * Bundle of every service URL, useful for diagnostics dumps and the
 * /admin debug panel.
 */
export const GRUDGE_SERVICES = Object.freeze({
  id:      GRUDGE_ID_URL,
  api:     GAME_API_URL,
  account: ACCOUNT_API_URL,
  ws:      WS_URL,
  assets:  ASSETS_URL,
});

// ---------------------------------------------------------------------------
// localStorage keys — canonical session storage layout
// ---------------------------------------------------------------------------
//
// History: earlier WCS builds used `grudge_token` / `authToken`. The current
// canonical key is `grudge.token` (dot-separated, namespace-friendly). The
// auth shim and GrudgeSession migrate older keys on first read.

/** Grudge JWT (Bearer token for id. + api.). */
export const TOKEN_KEY      = "grudge.token";

/** Token expiry as Unix milliseconds string. */
export const TOKEN_EXP_KEY  = "grudge.token.exp";

/** Canonical player id — `grudge_<id>` | `puter_<uuid>` | `anon_<hex>`. */
export const PLAYER_ID_KEY  = "grudge.playerId";

/** Cached display name (set during SSO handoff for instant UI). */
export const DISPLAY_NAME_KEY = "grudge.displayName";

/** Stable anonymous guest id (TTL'd by GrudgeSession). */
export const GUEST_ID_KEY    = "grudge.guestId";
/** When the current guest id was minted (Unix ms). */
export const GUEST_ID_TS_KEY = "grudge.guestId.ts";

// ---------------------------------------------------------------------------
// Legacy aliases — kept for backwards compatibility with files that already
// import these names. New code should prefer the canonical exports above.
// ---------------------------------------------------------------------------

/** @deprecated Use {@link GRUDGE_ID_URL} instead. */
export const ID_SERVICE = GRUDGE_ID_URL;
