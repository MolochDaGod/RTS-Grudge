/**
 * Grudge Asset API — Cloudflare Worker
 *
 * Routes:
 *   GET  /assets            — list all registered assets (paginated)
 *   GET  /assets/:id        — fetch a single asset entry
 *   GET  /assets/uuid/:uuid — fetch a single asset entry by Grudge UUID
 *   GET  /assets/category/:cat — list assets by category
 *   GET  /gamedata/:key     — fetch game data JSON from R2 (weapons, skills, etc.)
 *   POST /assets            — register / upsert an asset (requires GRUDGE_ADMIN_TOKEN header)
 *   DELETE /assets/:id      — remove an asset registration (requires GRUDGE_ADMIN_TOKEN header)
 *
 * Bindings required (wrangler.toml):
 *   ASSETS    — R2 bucket for model/texture/audio files
 *   GAME_DATA — R2 bucket for JSON game-data blobs
 *   DB        — D1 database
 *
 * Secrets (wrangler secret put GRUDGE_ADMIN_TOKEN):
 *   GRUDGE_ADMIN_TOKEN — bearer token for write routes
 */

export interface Env {
    ASSETS: R2Bucket;
    GAME_DATA: R2Bucket;
    DB: D1Database;
    ASSET_CDN_BASE: string;
    GRUDGE_ADMIN_TOKEN: string;
    ENVIRONMENT: string;
}

// ── CORS helper ───────────────────────────────────────────────────────────────
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
}

function err(msg: string, status = 400): Response {
    return json({ error: msg }, status);
}

function isAdmin(req: Request, env: Env): boolean {
    const token =
        req.headers.get("X-Admin-Token") ??
        req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    return (
        env.ENVIRONMENT !== "production" ||
        (!!token && token === env.GRUDGE_ADMIN_TOKEN)
    );
}

// ── Router ────────────────────────────────────────────────────────────────────
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname.replace(/\/$/, ""); // strip trailing slash
        const method = request.method.toUpperCase();

        // CORS preflight
        if (method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        // ── Root / health ───────────────────────────────────────────────────────
        if ((path === "" || path === "/") && method === "GET") {
            const count = await env.DB.prepare("SELECT COUNT(*) as n FROM asset_registry").first<{ n: number }>();
            return json({
                service: "grudge-asset-api",
                status: "ok",
                totalAssets: count?.n ?? 0,
                endpoints: {
                    list: "/assets?limit=100&offset=0",
                    byId: "/assets/:id",
                    byUuid: "/assets/uuid/:uuid",
                    byCategory: "/assets/category/:cat",
                    gameData: "/gamedata/:key",
                },
            });
        }

        // ── /assets/category/:cat ──────────────────────────────────────────────
        const catMatch = path.match(/^\/assets\/category\/([^/]+)$/);
        if (catMatch && method === "GET") {
            return handleListByCategory(catMatch[1], url, env);
        }

        // ── /assets/uuid/:uuid ────────────────────────────────────────────────
        const assetUuidMatch = path.match(/^\/assets\/uuid\/([^/]+)$/);
        if (assetUuidMatch && method === "GET") {
            return handleGetAssetByUuid(assetUuidMatch[1], env);
        }

        // ── /assets/:id ────────────────────────────────────────────────────────
        const assetIdMatch = path.match(/^\/assets\/([^/]+)$/);
        if (assetIdMatch) {
            const id = assetIdMatch[1];
            if (method === "GET") return handleGetAsset(id, env);
            if (method === "DELETE") {
                if (!isAdmin(request, env)) return err("Unauthorized", 401);
                return handleDeleteAsset(id, env);
            }
        }

        // ── /assets ────────────────────────────────────────────────────────────
        if (path === "/assets") {
            if (method === "GET") return handleListAssets(url, env);
            if (method === "POST") {
                if (!isAdmin(request, env)) return err("Unauthorized", 401);
                return handleUpsertAsset(request, env);
            }
        }

        // ── /gamedata/:key ─────────────────────────────────────────────────────
        const gdMatch = path.match(/^\/gamedata\/([^/]+)$/);
        if (gdMatch && method === "GET") {
            return handleGameData(gdMatch[1], env);
        }

        return err("Not found", 404);
    },
};

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleListAssets(url: URL, env: Env): Promise<Response> {
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
    const offset = parseInt(url.searchParams.get("offset") ?? "0");

    const { results } = await env.DB.prepare(
        "SELECT * FROM asset_registry ORDER BY category, name LIMIT ?1 OFFSET ?2"
    )
        .bind(limit, offset)
        .all<AssetRow>();

    const total = await env.DB.prepare("SELECT COUNT(*) as n FROM asset_registry")
        .first<{ n: number }>();

    return json({
        assets: results.map((r) => hydrateAsset(r, env.ASSET_CDN_BASE)),
        total: total?.n ?? 0,
        limit,
        offset,
    });
}

async function handleListByCategory(
    category: string,
    url: URL,
    env: Env
): Promise<Response> {
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200"), 500);
    const { results } = await env.DB.prepare(
        "SELECT * FROM asset_registry WHERE category = ?1 ORDER BY name LIMIT ?2"
    )
        .bind(category, limit)
        .all<AssetRow>();
    return json({ assets: results.map((r) => hydrateAsset(r, env.ASSET_CDN_BASE)) });
}

async function handleGetAsset(id: string, env: Env): Promise<Response> {
    const row = await env.DB.prepare(
        "SELECT * FROM asset_registry WHERE id = ?1"
    )
        .bind(id)
        .first<AssetRow>();
    if (!row) return err("Asset not found", 404);
    return json(hydrateAsset(row, env.ASSET_CDN_BASE));
}
async function handleGetAssetByUuid(uuid: string, env: Env): Promise<Response> {
    const { results } = await env.DB.prepare("SELECT * FROM asset_registry").all<AssetRow>();
    const row = results.find((candidate) => parseAnimationPayload(candidate.animation_packs).grudgeUuid === uuid);
    if (!row) return err("Asset not found", 404);
    return json(hydrateAsset(row, env.ASSET_CDN_BASE));
}

async function handleUpsertAsset(request: Request, env: Env): Promise<Response> {
    let body: Partial<AssetRow>;
    try {
        body = await request.json();
    } catch {
        return err("Invalid JSON body");
    }
    const {
        id,
        name,
        category,
        r2Key,
        boneMap,
        animationPacks,
        grudgeUuid,
        metadata,
        fileSize,
    } = body as any;
    if (!id || !name || !category || !r2Key || !grudgeUuid) {
        return err("id, name, category, r2Key, grudgeUuid are required");
    }

    const now = Date.now();
    const packedAnimationPayload = JSON.stringify({
        animationPacks: Array.isArray(animationPacks) ? animationPacks : null,
        grudgeUuid,
        metadata: metadata && typeof metadata === "object" ? metadata : undefined,
    });
    await env.DB.prepare(
        `INSERT INTO asset_registry (id, name, category, r2_key, bone_map, animation_packs, file_size, updated_at, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       category = excluded.category,
       r2_key = excluded.r2_key,
       bone_map = excluded.bone_map,
       animation_packs = excluded.animation_packs,
       file_size = excluded.file_size,
       updated_at = excluded.updated_at`
    )
        .bind(
            id,
            name,
            category,
            r2Key,
            boneMap ?? null,
            packedAnimationPayload,
            fileSize ?? null,
            now
        )
        .run();

    const row = await env.DB.prepare("SELECT * FROM asset_registry WHERE id = ?1")
        .bind(id)
        .first<AssetRow>();

    return json(hydrateAsset(row!, env.ASSET_CDN_BASE), 201);
}

async function handleDeleteAsset(id: string, env: Env): Promise<Response> {
    const row = await env.DB.prepare("SELECT id FROM asset_registry WHERE id = ?1")
        .bind(id)
        .first<{ id: string }>();
    if (!row) return err("Asset not found", 404);

    await env.DB.prepare("DELETE FROM asset_registry WHERE id = ?1").bind(id).run();
    return json({ deleted: id });
}

async function handleGameData(key: string, env: Env): Promise<Response> {
    // Only allow known keys
    const allowed = ["weapons", "skills", "materials", "equipment", "armor", "consumables"];
    if (!allowed.includes(key)) return err("Unknown game data key", 404);

    const obj = await env.GAME_DATA.get(`${key}.json`);
    if (!obj) return err("Game data not found — run sync", 404);

    const body = await obj.text();
    return new Response(body, {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
            ...CORS_HEADERS,
        },
    });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssetRow {
    id: string;
    name: string;
    category: string;
    r2_key: string;
    bone_map: string | null;
    animation_packs: string | null;
    file_size: number | null;
    updated_at: number;
    created_at: number;
}
interface AssetPayloadMetadata {
    version?: number;
    sourceSet?: string | null;
    format?: string;
    mimeType?: string;
    sourceHash?: string;
    sourcePath?: string;
    scaleProfile?: string | null;
    baselineHumanMeters?: number;
    recommendedTargetMeters?: number | null;
    attachmentProfile?: string | null;
    supportedSkeletons?: string[] | null;
    weaponType?: string | null;
}

interface ParsedAnimationPayload {
    animationPacks?: string[];
    grudgeUuid?: string;
    metadata?: AssetPayloadMetadata;
}

function parseAnimationPayload(raw: string | null): ParsedAnimationPayload {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return { animationPacks: parsed };
        }
        if (parsed && typeof parsed === "object") {
            return {
                animationPacks: Array.isArray((parsed as any).animationPacks)
                    ? (parsed as any).animationPacks
                    : undefined,
                grudgeUuid: typeof (parsed as any).grudgeUuid === "string"
                    ? (parsed as any).grudgeUuid
                    : undefined,
                metadata:
                    (parsed as any).metadata && typeof (parsed as any).metadata === "object"
                        ? (parsed as any).metadata
                        : undefined,
            };
        }
    } catch {
        return {};
    }
    return {};
}

function hydrateAsset(row: AssetRow, cdnBase: string) {
    const payload = parseAnimationPayload(row.animation_packs);
    const metadata = payload.metadata;
    return {
        id: row.id,
        grudgeUuid: payload.grudgeUuid,
        name: row.name,
        category: row.category,
        r2Key: row.r2_key,
        cdnUrl: `${cdnBase}/${row.r2_key}`,
        boneMap: row.bone_map ?? undefined,
        animationPacks: payload.animationPacks,
        fileSize: row.file_size ?? undefined,
        sourceSet: metadata?.sourceSet,
        format: metadata?.format,
        mimeType: metadata?.mimeType,
        sourceHash: metadata?.sourceHash,
        sourcePath: metadata?.sourcePath,
        scaleProfile: metadata?.scaleProfile,
        baselineHumanMeters: metadata?.baselineHumanMeters,
        recommendedTargetMeters: metadata?.recommendedTargetMeters,
        attachmentProfile: metadata?.attachmentProfile,
        supportedSkeletons: metadata?.supportedSkeletons,
        weaponType: metadata?.weaponType,
        metadata,
        updatedAt: row.updated_at,
        createdAt: row.created_at,
    };
}
