// Server-side session validation against id.grudge-studio.com.
//
// Verification ladder (first one that succeeds wins):
//
//   1. RS256 + JWKS  — preferred long-term. Set `GRUDGE_JWKS_URL` to the
//      central service's `/.well-known/jwks.json`. Token verified locally
//      against rotated public keys. Sub-millisecond, offline, supports
//      key rotation without service restarts.
//   2. HS256 + shared secret — legacy. Set `GRUDGE_JWT_SECRET` to the same
//      value the identity service uses to sign. Same speed as #1, but
//      every game server holds the signing key, which is why we want #1.
//   3. Network fallback — GET /api/auth/me with the cookie forwarded. The
//      identity service is the source of truth; works without any local
//      crypto config but adds a round-trip to every new connection.
//   4. Guest (dev only) — `GRUDGE_PVP_ALLOW_GUESTS=1` mints a synthetic
//      identity so the socket loop still works for offline playtests.

import crypto from "crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

const GRUDGE_AUTH_URL = (process.env.GRUDGE_AUTH_URL || "https://id.grudge-studio.com").replace(/\/+$/, "");
const JWKS_URL = process.env.GRUDGE_JWKS_URL || ""; // e.g. https://id.grudge-studio.com/.well-known/jwks.json
const JWT_ISSUER = process.env.GRUDGE_JWT_ISSUER || ""; // optional `iss` claim assertion
const JWT_AUDIENCE = process.env.GRUDGE_JWT_AUDIENCE || ""; // optional `aud` claim assertion
const JWT_SECRET = process.env.GRUDGE_JWT_SECRET || "";
const ALLOW_GUESTS = process.env.GRUDGE_PVP_ALLOW_GUESTS === "1";
const FETCH_TIMEOUT_MS = 4_000;

// Lazy JWKS resolver: jose's `createRemoteJWKSet` caches keys + handles
// rotation per spec (re-fetches on `kid` miss, respects HTTP cache headers).
let _jwks: JWTVerifyGetKey | null = null;
function getJwks(): JWTVerifyGetKey | null {
  if (!JWKS_URL) return null;
  if (!_jwks) _jwks = createRemoteJWKSet(new URL(JWKS_URL));
  return _jwks;
}

export interface GrudgeIdentity {
  /** Stable per-user id from the central service (e.g. "grudge_<uuid>"). */
  id: string;
  /** Short display name for HUDs / leaderboards. */
  name: string;
  role: string;
  /** Verification source. "jwks" = RS256 via /.well-known/jwks.json,
   *  "hmac" = legacy HS256 shared secret, "session" = network /api/auth/me,
   *  "guest" = dev-only synthetic identity. */
  source: "jwks" | "hmac" | "session" | "guest";
}

function base64UrlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad), "base64");
}

/** Local HMAC-SHA256 verification of a JWT-shaped token. Returns the parsed
 *  payload on success, null on any failure (signature, expiry, format). */
function verifyJwtHs256(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  let header: any;
  try { header = JSON.parse(base64UrlDecode(h).toString("utf8")); } catch { return null; }
  if (header.alg !== "HS256") return null;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${h}.${p}`)
    .digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let payload: any;
  try { payload = JSON.parse(base64UrlDecode(p).toString("utf8")); } catch { return null; }
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
  return payload;
}

/** Pull the gw_player / session cookie from a raw `Cookie:` header. */
export function extractSessionCookie(rawCookie: string | undefined | null): string | null {
  if (!rawCookie) return null;
  const pairs = rawCookie.split(";").map((s) => s.trim());
  for (const name of ["gw_player", "grudge_session", "session", "auth"]) {
    const found = pairs.find((p) => p.startsWith(`${name}=`));
    if (found) return decodeURIComponent(found.slice(name.length + 1));
  }
  return null;
}

function identityFromPayload(payload: Record<string, unknown>, source: GrudgeIdentity["source"]): GrudgeIdentity | null {
  const id = String(payload.sub ?? payload.userId ?? payload.id ?? "");
  if (!id) return null;
  return {
    id,
    name: String(payload.name ?? payload.username ?? payload.displayName ?? id),
    role: String(payload.role ?? (Array.isArray(payload.roles) ? (payload.roles as unknown[])[0] : "user")),
    source,
  };
}

/** Validate a raw cookie value against the central identity service.
 *  Tries JWKS → HMAC → /api/auth/me → guest, in that order. */
export async function resolveIdentity(rawCookie: string | undefined | null): Promise<GrudgeIdentity | null> {
  const token = extractSessionCookie(rawCookie);

  // 1. RS256 + JWKS (preferred)
  const jwks = getJwks();
  if (token && jwks) {
    try {
      const opts: { issuer?: string; audience?: string } = {};
      if (JWT_ISSUER) opts.issuer = JWT_ISSUER;
      if (JWT_AUDIENCE) opts.audience = JWT_AUDIENCE;
      const { payload } = await jwtVerify(token, jwks, opts);
      const id = identityFromPayload(payload as Record<string, unknown>, "jwks");
      if (id) return id;
    } catch (e: any) {
      // Fall through; another rung may still validate this token. We log at
      // debug level (warn would spam every failed token).
      if (process.env.GRUDGE_AUTH_DEBUG === "1") {
        console.warn("[grudge-auth] JWKS verify failed:", e?.message ?? e);
      }
    }
  }

  // 2. HS256 shared secret (legacy)
  if (token && JWT_SECRET) {
    const payload = verifyJwtHs256(token, JWT_SECRET);
    if (payload) {
      const id = identityFromPayload(payload, "hmac");
      if (id) return id;
    }
  }

  // 3. Network fallback against the identity service
  if (token) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${GRUDGE_AUTH_URL}/api/auth/me`, {
        headers: { Cookie: rawCookie as string, Accept: "application/json" },
        signal: ctrl.signal,
      });
      if (res.ok) {
        const u = (await res.json()) as Record<string, unknown>;
        const id = identityFromPayload(u, "session");
        if (id) return id;
      }
    } catch (e: any) {
      console.warn("[grudge-auth] /api/auth/me fetch failed:", e.message);
    } finally {
      clearTimeout(t);
    }
  }

  if (ALLOW_GUESTS) {
    const id = `guest_${crypto.randomBytes(4).toString("hex")}`;
    return { id, name: id, role: "guest", source: "guest" };
  }

  return null;
}
