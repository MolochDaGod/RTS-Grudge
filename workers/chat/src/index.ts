// Cloudflare Worker entry point — verifies the player's JWT and forwards
// the WebSocket upgrade to the ChatRoom Durable Object scoped to the
// requested zone. Anonymous / invalid tokens are rejected up front so the
// DO never has to think about auth.

import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import { ChatRoom } from "./chatRoom";

export { ChatRoom };

export interface Env {
  CHAT_ROOM: DurableObjectNamespace;
  GRUDGE_JWT_SECRET?: string;
  GRUDGE_JWKS_URL?: string;
  GRUDGE_JWT_ISSUER?: string;
  GRUDGE_JWT_AUDIENCE?: string;
  ALLOWED_ORIGINS?: string;
}

export interface ChatIdentity {
  id: string;
  name: string;
  role: string;
  faction?: string;
}

const encoder = new TextEncoder();
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function corsHeaders(env: Env, req: Request): HeadersInit {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const allow = allowed.includes(origin) ? origin : allowed[0] ?? "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

async function verifyToken(token: string, env: Env): Promise<ChatIdentity | null> {
  try {
    let payload: JWTPayload;
    if (env.GRUDGE_JWKS_URL) {
      if (!_jwks) _jwks = createRemoteJWKSet(new URL(env.GRUDGE_JWKS_URL));
      ({ payload } = await jwtVerify(token, _jwks, {
        issuer: env.GRUDGE_JWT_ISSUER, audience: env.GRUDGE_JWT_AUDIENCE,
      }));
    } else if (env.GRUDGE_JWT_SECRET) {
      ({ payload } = await jwtVerify(token, encoder.encode(env.GRUDGE_JWT_SECRET), {
        issuer: env.GRUDGE_JWT_ISSUER, audience: env.GRUDGE_JWT_AUDIENCE,
      }));
    } else { return null; }
    const sub = String(payload.sub ?? "");
    if (!sub) return null;
    return {
      id: sub,
      name: String((payload as any).name ?? sub),
      role: String((payload as any).role ?? "player"),
      faction: (payload as any).faction ? String((payload as any).faction) : undefined,
    };
  } catch (e) { return null; }
}

function extractToken(req: Request, url: URL): string | null {
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const q = url.searchParams.get("token");
  if (q) return q;
  const cookie = req.headers.get("Cookie") ?? "";
  const m = /(?:^|;\s*)gw_player=([^;]+)/.exec(cookie);
  return m ? decodeURIComponent(m[1]) : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(env, request);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", service: "rts-grudge-chat" }), {
        headers: { "content-type": "application/json", ...cors },
      });
    }

    // /room/<zoneId> — WebSocket upgrade only
    const m = /^\/room\/([\w-]{1,64})$/.exec(url.pathname);
    if (!m) return new Response("not found", { status: 404, headers: cors });
    const zone = m[1];

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("expected websocket", { status: 426, headers: cors });
    }

    const token = extractToken(request, url);
    if (!token) return new Response("missing token", { status: 401, headers: cors });
    const ident = await verifyToken(token, env);
    if (!ident) return new Response("invalid token", { status: 401, headers: cors });

    const id = env.CHAT_ROOM.idFromName(`zone:${zone}`);
    const stub = env.CHAT_ROOM.get(id);

    // Forward to the DO. Player identity is passed via headers so the DO
    // doesn't have to parse the JWT a second time.
    const fwd = new Request(request.url, request);
    fwd.headers.set("X-Player-Id", ident.id);
    fwd.headers.set("X-Player-Name", ident.name);
    fwd.headers.set("X-Player-Role", ident.role);
    if (ident.faction) fwd.headers.set("X-Player-Faction", ident.faction);
    fwd.headers.set("X-Zone", zone);
    return stub.fetch(fwd);
  },
};
