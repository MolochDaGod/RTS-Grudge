/**
 * authMiddleware — Non-blocking optional authentication.
 *
 * Every request gets a `req.grudgeUser` context. The game NEVER blocks
 * on auth — guests play immediately with an anonymous ID. Signed-in
 * users get their Grudge ID attached for save persistence.
 *
 * Auth flow:
 *   1. Check `Authorization: Bearer <token>` header
 *   2. Check `X-Grudge-Player` header (client-set player ID)
 *   3. Check `X-Puter-UUID` header (Puter SDK sets this)
 *   4. Fall through to anonymous guest
 *
 * Token validation:
 *   - In production: validates JWT against id.grudge-studio.com
 *   - In development: trusts the header value directly
 *
 * The middleware NEVER returns 401. It always calls next().
 */

import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// User context attached to every request
// ---------------------------------------------------------------------------

export interface GrudgeUser {
  /** Canonical player ID (puter_<uuid>, grudge_<id>, or anon_<hex>) */
  playerId: string;
  /** Whether the user is authenticated (vs anonymous guest) */
  authenticated: boolean;
  /** Auth provider that validated this session */
  provider: "grudge" | "puter" | "guest";
  /** Display name (null for guests) */
  username: string | null;
  /** Email (null for guests) */
  email: string | null;
  /** Account tier: master_admin | admin | member | pleb */
  tier: "master_admin" | "admin" | "member" | "pleb";
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      grudgeUser: GrudgeUser;
    }
  }
}

// ---------------------------------------------------------------------------
// Guest user factory
// ---------------------------------------------------------------------------

function guestUser(playerId?: string): GrudgeUser {
  return {
    playerId: playerId || `anon_${randomHex(16)}`,
    authenticated: false,
    provider: "guest",
    username: null,
    email: null,
    tier: "pleb",
  };
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  // Node.js crypto
  try {
    require("crypto").randomFillSync(arr);
  } catch {
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Token validation
// ---------------------------------------------------------------------------

const ID_SERVICE_URL = process.env.GRUDGE_ID_URL || "https://id.grudge-studio.com";
const IS_DEV = process.env.NODE_ENV !== "production";

// In-memory token cache. TTL set to 30 min so players stay logged in across
// normal page reloads without hitting id.grudge-studio.com every request.
// Tokens are evicted early when /auth/refresh issues a new one.
const tokenCache = new Map<string, { user: GrudgeUser; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

/** Manually evict a token from the cache (call when a refresh issues a new one). */
export function evictTokenCache(token: string): void {
  tokenCache.delete(token);
}

async function validateGrudgeToken(token: string): Promise<GrudgeUser | null> {
  // Check cache first
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  // In dev, trust the token as a player ID directly
  if (IS_DEV) {
    const user: GrudgeUser = {
      playerId: `grudge_${token.slice(0, 32)}`,
      authenticated: true,
      provider: "grudge",
      username: "dev_user",
      email: null,
      tier: "admin",
    };
    tokenCache.set(token, { user, expiresAt: Date.now() + CACHE_TTL_MS });
    return user;
  }

  // Production: validate against id.grudge-studio.com
  try {
    const resp = await fetch(`${ID_SERVICE_URL}/auth/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ token }),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data.valid || !data.user) return null;

    const user: GrudgeUser = {
      playerId: `grudge_${data.user.grudgeId || data.user.id}`,
      authenticated: true,
      provider: "grudge",
      username: data.user.username || data.user.displayName || null,
      email: data.user.email || null,
      tier: data.user.tier || "pleb",
    };

    tokenCache.set(token, { user, expiresAt: Date.now() + CACHE_TTL_MS });
    return user;
  } catch (err) {
    console.warn("[auth] Token validation failed:", (err as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Non-blocking auth middleware. Attaches `req.grudgeUser` to every request.
 * NEVER returns 401 — guests always pass through.
 */
export function grudgeAuth(req: Request, _res: Response, next: NextFunction): void {
  // Already resolved (e.g. by a more specific middleware upstream)
  if (req.grudgeUser) {
    next();
    return;
  }

  // 1. Check Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      // Async validation — attach result when it resolves
      validateGrudgeToken(token)
        .then(user => {
          req.grudgeUser = user || guestUser(extractPlayerId(req));
          next();
        })
        .catch(() => {
          req.grudgeUser = guestUser(extractPlayerId(req));
          next();
        });
      return;
    }
  }

  // 2. Check X-Grudge-Player header (client-set player ID)
  const grudgePlayer = req.headers["x-grudge-player"] as string | undefined;
  if (grudgePlayer && /^[A-Za-z0-9_\-]{6,64}$/.test(grudgePlayer)) {
    req.grudgeUser = {
      playerId: grudgePlayer,
      authenticated: grudgePlayer.startsWith("puter_") || grudgePlayer.startsWith("grudge_"),
      provider: grudgePlayer.startsWith("puter_") ? "puter" : grudgePlayer.startsWith("grudge_") ? "grudge" : "guest",
      username: null,
      email: null,
      tier: "pleb",
    };
    next();
    return;
  }

  // 3. Check X-Puter-UUID header
  const puterUuid = req.headers["x-puter-uuid"] as string | undefined;
  if (puterUuid && /^[a-f0-9\-]{32,40}$/.test(puterUuid)) {
    req.grudgeUser = {
      playerId: `puter_${puterUuid}`,
      authenticated: true,
      provider: "puter",
      username: null,
      email: null,
      tier: "pleb",
    };
    next();
    return;
  }

  // 4. Guest fallback
  req.grudgeUser = guestUser(extractPlayerId(req));
  next();
}

/**
 * Extract a player ID from query params or path params (for save/loadout routes).
 */
function extractPlayerId(req: Request): string | undefined {
  return (req.params?.playerId as string) ||
         (req.query?.playerId as string) ||
         undefined;
}

/**
 * Require authenticated user. Use on routes that MUST have a real account
 * (e.g. wallet operations, trading, guild management).
 * Returns 401 with a redirect hint to id.grudge-studio.com.
 * NEVER redirects to auth-gateway-flax.vercel.app or any third-party gateway.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.grudgeUser?.authenticated) {
    res.status(401).json({
      error: "Authentication required",
      loginUrl: `${ID_SERVICE_URL}/auth/login?redirect=${encodeURIComponent(req.originalUrl)}`,
      provider: "grudge-id",
      message: "Sign in at id.grudge-studio.com to access this feature.",
    });
    return;
  }
  next();
}

/**
 * Token refresh endpoint. Called by GrudgeSession keep-alive when a token
 * is about to expire. Issues a new token and evicts the old one from cache.
 * POST /auth/refresh  (Authorization: Bearer <old-token>)
 */
export function handleTokenRefresh(req: Request, res: Response): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token" });
    return;
  }
  const oldToken = authHeader.slice(7).trim();

  // In production, proxy refresh to id.grudge-studio.com and return the new token.
  // In development, extend the cached session by re-caching the same user.
  if (IS_DEV) {
    const cached = tokenCache.get(oldToken);
    if (!cached) {
      res.status(401).json({ error: "Token not found in cache" });
      return;
    }
    // Extend TTL
    const newExpiry = Date.now() + CACHE_TTL_MS;
    tokenCache.set(oldToken, { user: cached.user, expiresAt: newExpiry });
    res.json({ token: oldToken, expiresAt: newExpiry });
    return;
  }

  // Production: forward to id.grudge-studio.com
  fetch(`${ID_SERVICE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${oldToken}`,
    },
  })
    .then(async (r) => {
      if (!r.ok) {
        evictTokenCache(oldToken);
        res.status(r.status).json({ error: "Refresh rejected" });
        return;
      }
      const data = await r.json();
      if (data.token) evictTokenCache(oldToken);
      res.json(data);
    })
    .catch((err) => {
      console.warn("[auth] Refresh proxy failed:", (err as Error).message);
      res.status(502).json({ error: "Auth service unavailable" });
    });
}

/**
 * Require admin tier. Use on admin-only routes.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const tier = req.grudgeUser?.tier;
  if (tier !== "master_admin" && tier !== "admin") {
    // Fall back to legacy token check for backward compatibility
    const token = req.headers["x-grudge-admin"] as string;
    if (token === process.env.GRUDGE_ADMIN_TOKEN) {
      next();
      return;
    }
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
