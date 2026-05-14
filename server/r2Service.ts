/**
 * server/r2Service.ts
 *
 * Server-side R2 helper — used by Express routes to:
 *   - Upload game-data JSON blobs (weapons.json, skills.json, etc.) to the
 *     grudge-gamedata R2 bucket so the Cloudflare Worker can serve them
 *   - Check if R2 credentials are configured (graceful no-op when missing)
 *
 * This is the server counterpart to scripts/upload-to-r2.ts (which handles
 * bulk binary model uploads).  Game-data syncs happen at runtime when
 * POST /api/grudge/sync is called by an admin.
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? "";
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
const GAMEDATA_BUCKET = process.env.R2_GAMEDATA_BUCKET ?? "grudge-gamedata";
const ASSETS_BUCKET = process.env.R2_BUCKET_NAME ?? "grudge-assets";

export const r2Enabled = !!(ACCOUNT_ID && ACCESS_KEY && SECRET_KEY);

let _client: S3Client | null = null;

function getClient(): S3Client {
    if (!_client) {
        _client = new S3Client({
            region: "auto",
            endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
        });
    }
    return _client;
}

/**
 * Upload a JSON game-data blob to the grudge-gamedata R2 bucket.
 * key = "weapons.json" | "skills.json" | "materials.json" | etc.
 */
export async function uploadGameData(key: string, data: unknown): Promise<string> {
    if (!r2Enabled) {
        throw new Error("R2 credentials not configured — set CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
    }
    const body = JSON.stringify(data, null, 2);
    await getClient().send(
        new PutObjectCommand({
            Bucket: GAMEDATA_BUCKET,
            Key: key,
            Body: body,
            ContentType: "application/json",
            CacheControl: "public, max-age=300",
        })
    );
    const cdnBase = process.env.R2_CDN_BASE ?? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${GAMEDATA_BUCKET}`;
    return `${cdnBase}/${key}`;
}

/**
 * Fetch a game-data blob from R2 (used to verify sync / read back).
 * Returns null if the key doesn't exist.
 */
export async function fetchGameData(key: string): Promise<unknown | null> {
    if (!r2Enabled) return null;
    try {
        const res = await getClient().send(
            new GetObjectCommand({ Bucket: GAMEDATA_BUCKET, Key: key })
        );
        const text = await res.Body?.transformToString();
        return text ? JSON.parse(text) : null;
    } catch (e: any) {
        if (e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) return null;
        throw e;
    }
}

/**
 * Upload a binary asset buffer to the grudge-assets R2 bucket.
 * r2Key = "models/characters/elf-male.glb" etc.
 */
export async function uploadAsset(
    r2Key: string,
    body: Buffer,
    contentType = "application/octet-stream"
): Promise<string> {
    if (!r2Enabled) {
        throw new Error("R2 credentials not configured");
    }
    await getClient().send(
        new PutObjectCommand({
            Bucket: ASSETS_BUCKET,
            Key: r2Key,
            Body: body,
            ContentType: contentType,
            CacheControl: "public, max-age=86400",
        })
    );
    const cdnBase = process.env.R2_CDN_BASE ?? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${ASSETS_BUCKET}`;
    return `${cdnBase}/${r2Key}`;
}
