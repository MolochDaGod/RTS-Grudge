#!/usr/bin/env ts-node
/**
 * upload-to-r2.ts
 *
 * Bulk-uploads all local model/texture/audio assets from client/public/
 * to a Cloudflare R2 bucket using the S3-compatible API.
 *
 * Usage:
 *   npx ts-node scripts/upload-to-r2.ts [--dry-run] [--category characters]
 *
 * Required env vars (add to .env or export before running):
 *   CLOUDFLARE_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME        (default: grudge-assets)
 *
 * The script:
 *   1. Walks client/public/models/** for GLB/GLTF/FBX files
 *   2. Also walks client/public/textures/** for KTX2/PNG/JPG
 *   3. Also walks client/public/sounds/**  for MP3/OGG/WAV
 *   4. Uploads each with key = relative path (e.g. models/characters/elf-male.glb)
 *   5. Skips files already on R2 with matching ETag (content hash)
 *   6. Outputs a JSON manifest: dist/asset-manifest.json
 *
 * After uploading, run:
 *   npx ts-node scripts/seed-d1.ts
 * to populate the D1 database from the manifest.
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
    buildManifestEntry,
    mimeTypeForExt,
    type ManifestEntry,
} from "./lib/assetManifest";

const __here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__here, "../.env") });

// ── Config ────────────────────────────────────────────────────────────────────
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID ?? "";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? process.env.OBJECT_STORAGE_KEY ?? "";
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY ?? process.env.OBJECT_STORAGE_SECRET ?? "";
const BUCKET = process.env.R2_BUCKET_NAME ?? "grudge-assets";
const CDN_BASE =
    process.env.ASSET_CDN_BASE ?? "https://assets.grudge-studio.com";

const DRY_RUN = process.argv.includes("--dry-run");
const CATEGORY_FILTER = (() => {
    const idx = process.argv.indexOf("--category");
    return idx !== -1 ? process.argv[idx + 1] : null;
})();
const PROJECT_ROOT = path.resolve(__here, "..");
const PUBLIC_DIR = path.resolve(__here, "../client/public");
const DIST_DIR = path.resolve(__here, "../dist");
const MANIFEST_PATH = path.join(DIST_DIR, "asset-manifest.json");

// Extensions we upload
const ASSET_EXTENSIONS = new Set([
    ".glb", ".gltf", ".fbx",               // 3D models
    ".ktx2", ".png", ".jpg", ".jpeg", ".webp", // textures
    ".mp3", ".ogg", ".wav",                 // audio
    ".json",                                // data
    ".woff", ".woff2", ".ttf", ".otf",      // fonts
]);

// Directories to scan (relative to PUBLIC_DIR)
const SCAN_DIRS = ["models", "textures", "sounds", "fonts"];

function matchesCategoryFilter(entry: ManifestEntry, filter: string): boolean {
    const needle = filter.toLowerCase();
    const haystack = [
        entry.category,
        entry.metadata.sourceSet ?? "",
        entry.metadata.weaponType ?? "",
        entry.metadata.attachmentProfile ?? "",
    ];
    return haystack.some((value) => value.toLowerCase().includes(needle));
}

// ── File walker ───────────────────────────────────────────────────────────────
function walkDir(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkDir(full));
        } else if (ASSET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
            results.push(full);
        }
    }
    return results;
}

// ── MD5 / ETag helper ─────────────────────────────────────────────────────────
function md5File(filePath: string): string {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash("md5").update(buf).digest("hex");
}
function shellQuote(arg: string): string {
    return `"${arg.replace(/"/g, '\\"')}"`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    let uploadMode: "dry-run" | "s3" | "wrangler" = "dry-run";
    let s3Module: Awaited<typeof import("@aws-sdk/client-s3")> | null = null;
    let s3: InstanceType<(typeof import("@aws-sdk/client-s3"))["S3Client"]> | null = null;

    if (!DRY_RUN) {
        if (ACCOUNT_ID && ACCESS_KEY && SECRET_KEY) {
            try {
                s3Module = await import("@aws-sdk/client-s3");
                s3 = new s3Module.S3Client({
                    region: "auto",
                    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
                    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
                });
                uploadMode = "s3";
            } catch {
                console.warn("AWS S3 client not available locally; falling back to Wrangler-authenticated upload.");
            }
        }

        if (!s3) {
            uploadMode = "wrangler";
            console.log("Using Wrangler-authenticated R2 upload fallback.");
        }
    }

    console.log("Scanning local asset tree…");

    // Collect all files
    const files: string[] = [];
    for (const scanDir of SCAN_DIRS) {
        const dir = path.join(PUBLIC_DIR, scanDir);
        files.push(...walkDir(dir));
    }
    const discovered = files.map((filePath) => {
        const r2Key = path.relative(PUBLIC_DIR, filePath).replace(/\\/g, "/");
        const fileSize = fs.statSync(filePath).size;
        const previewEntry = buildManifestEntry({
            r2Key,
            cdnBase: CDN_BASE,
            fileSize,
            sourceHash: "",
        });
        return { filePath, fileSize, r2Key, previewEntry };
    });

    const filtered = CATEGORY_FILTER
        ? discovered.filter(({ previewEntry }) => matchesCategoryFilter(previewEntry, CATEGORY_FILTER))
        : discovered;

    console.log(`Selected ${filtered.length} assets to process${DRY_RUN ? " (DRY RUN)" : ""}`);
    console.log("Hashing selected assets and building manifest entries…");

    const prepared = filtered.map(({ filePath, fileSize, r2Key }) => {
        const localHash = md5File(filePath);
        const manifestEntry = buildManifestEntry({
            r2Key,
            cdnBase: CDN_BASE,
            fileSize,
            sourceHash: localHash,
        });
        return { filePath, fileSize, localHash, manifestEntry };
    });

    // Fetch existing R2 keys for diff (skip unchanged)
    const existingEtags = new Map<string, string>();
    if (uploadMode === "s3") {
        console.log("Fetching existing R2 keys…");
        let continuationToken: string | undefined;
        do {
            const res = await s3!.send(
                new s3Module!.ListObjectsV2Command({
                    Bucket: BUCKET,
                    ContinuationToken: continuationToken,
                })
            );
            for (const obj of res.Contents ?? []) {
                if (obj.Key && obj.ETag) {
                    existingEtags.set(obj.Key, obj.ETag.replace(/"/g, ""));
                }
            }
            continuationToken = res.NextContinuationToken;
        } while (continuationToken);
        console.log(`  ${existingEtags.size} existing objects in R2`);
    }

    const manifest: ManifestEntry[] = [];
    let uploaded = 0;
    let skipped = 0;
    let errors = 0;

    for (const { filePath, fileSize, localHash, manifestEntry } of prepared) {
        const { r2Key } = manifestEntry;
        const ext = path.extname(filePath).toLowerCase();

        // Skip if R2 already has the same content
        if (!DRY_RUN && existingEtags.get(r2Key) === localHash) {
            skipped++;
            manifest.push(manifestEntry);
            continue;
        }

        if (DRY_RUN) {
            console.log(
                `  [DRY] ${r2Key} (${(fileSize / 1024).toFixed(1)}KB) ` +
                `→ ${manifestEntry.category}${manifestEntry.metadata.sourceSet ? `/${manifestEntry.metadata.sourceSet}` : ""}`,
            );
            manifest.push(manifestEntry);
            uploaded++;
            continue;
        }

        // Upload
        try {
            const contentType = mimeTypeForExt(ext);
            const cacheControl = r2Key.includes("/v1/")
                ? "public, max-age=31536000, immutable"
                : "public, max-age=86400";

            if (uploadMode === "s3") {
                const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB
                const putParams = {
                    Bucket: BUCKET,
                    Key: r2Key,
                    ContentType: contentType,
                    CacheControl: cacheControl,
                    Metadata: {
                        category: manifestEntry.category,
                        "source-hash": localHash,
                        "grudge-uuid": manifestEntry.grudgeUuid,
                        "source-set": manifestEntry.metadata.sourceSet ?? "unknown",
                    },
                };
                if (fileSize > MULTIPART_THRESHOLD) {
                    const { Upload } = await import("@aws-sdk/lib-storage");
                    const stream = fs.createReadStream(filePath);
                    const upload = new Upload({
                        client: s3!,
                        params: { ...putParams, Body: stream },
                        queueSize: 4,
                        partSize: 10 * 1024 * 1024, // 10MB parts
                        leavePartsOnError: false,
                    });
                    await upload.done();
                } else {
                    const body = fs.readFileSync(filePath);
                    await s3!.send(
                        new s3Module!.PutObjectCommand({
                            ...putParams,
                            Body: body,
                            ContentLength: fileSize,
                        })
                    );
                }
            } else {
                execSync(
                    [
                        "npx wrangler r2 object put",
                        shellQuote(`${BUCKET}/${r2Key}`),
                        "--file",
                        shellQuote(filePath),
                        "--content-type",
                        shellQuote(contentType),
                        "--cache-control",
                        shellQuote(cacheControl),
                    ].join(" "),
                    {
                        cwd: PROJECT_ROOT,
                        stdio: "pipe",
                    },
                );
            }
            uploaded++;
            console.log(`  ✓ ${r2Key} (${(fileSize / 1024).toFixed(1)}KB)`);
        } catch (e) {
            errors++;
            const extra =
                e && typeof e === "object" && "stderr" in e && (e as any).stderr
                    ? ` ${(e as any).stderr.toString().trim()}`
                    : "";
            console.error(`  ✗ ${r2Key}: ${(e as Error).message}${extra}`);
        }
        manifest.push(manifestEntry);
    }

    // Write manifest
    if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

    console.log(`\n── Summary ─────────────────────────────────`);
    console.log(`  Uploaded : ${uploaded}`);
    console.log(`  Skipped  : ${skipped} (unchanged)`);
    console.log(`  Errors   : ${errors}`);
    console.log(`  Manifest : ${MANIFEST_PATH} (${manifest.length} entries)`);
    if (errors === 0) {
        console.log(`\nNext step: npx ts-node scripts/seed-d1.ts`);
    }
}


main().catch((e) => {
    console.error(e);
    process.exit(1);
});
