#!/usr/bin/env ts-node
/**
 * seed-d1.ts
 *
 * Reads dist/asset-manifest.json (produced by upload-to-r2.ts) and
 * bulk-inserts every entry into the Cloudflare D1 database via wrangler d1.
 *
 * Usage:
 *   npx ts-node scripts/seed-d1.ts [--dry-run]
 *
 * Required:
 *   wrangler CLI installed (npx wrangler or global)
 *   dist/asset-manifest.json (run upload-to-r2.ts first)
 *   D1 database created: wrangler d1 create grudge-assets-db
 *   Schema applied:      wrangler d1 execute grudge-assets-db --file=workers/asset-api/schema.sql
 *
 * What it does:
 *   1. Reads the manifest JSON
 *   2. Splits into batches of 100 (D1 batch limit)
 *   3. For each batch, writes a temp SQL file and runs wrangler d1 execute
 *   4. Reports success/error counts
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import os from "os";
import { fileURLToPath } from "node:url";
import type { ManifestEntry } from "./lib/assetManifest";
const HERE = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(HERE, "../.env") });
const MANIFEST_PATH = path.resolve(HERE, "../dist/asset-manifest.json");
const DRY_RUN = process.argv.includes("--dry-run");
const DB_NAME = process.env.D1_DATABASE_NAME ?? "grudge-assets-db";
const BATCH_SIZE = 100;

interface StoredAssetPayload {
    animationPacks?: string[] | null;
    grudgeUuid?: string;
    metadata?: ManifestEntry["metadata"];
}

function escape(s: string | null | undefined): string {
    if (s == null) return "NULL";
    return `'${s.replace(/'/g, "''")}'`;
}

function buildStoredAssetPayload(entry: ManifestEntry): string | null {
    const payload: StoredAssetPayload = {
        animationPacks: entry.animationPacks,
        grudgeUuid: entry.grudgeUuid,
        metadata: entry.metadata,
    };
    return JSON.stringify(payload);
}
function buildInsert(entry: ManifestEntry): string {
    const now = Date.now();
    return (
        `INSERT OR REPLACE INTO asset_registry ` +
        `(id, name, category, r2_key, bone_map, animation_packs, file_size, updated_at, created_at) ` +
        `VALUES (` +
        [
            escape(entry.id),
            escape(entry.name),
            escape(entry.category),
            escape(entry.r2Key),
            escape(entry.boneMap),
            escape(buildStoredAssetPayload(entry)),
            entry.fileSize ?? "NULL",
            now,
            now,
        ].join(", ") +
        `);`
    );
}

async function main() {
    if (!fs.existsSync(MANIFEST_PATH)) {
        console.error(`Manifest not found at ${MANIFEST_PATH}`);
        console.error("Run: npx ts-node scripts/upload-to-r2.ts --dry-run first");
        process.exit(1);
    }

    const manifest: ManifestEntry[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    console.log(`Seeding D1 database '${DB_NAME}' with ${manifest.length} entries…`);

    if (DRY_RUN) {
        console.log("[DRY RUN] First 3 SQL statements:");
        manifest.slice(0, 3).forEach((e) => console.log("  " + buildInsert(e)));
        return;
    }

    // Ensure schema is applied
    const schemaPath = path.resolve(HERE, "../workers/asset-api/schema.sql");
    if (fs.existsSync(schemaPath)) {
        console.log("Applying schema…");
        try {
            execSync(`npx wrangler@latest d1 execute ${DB_NAME} --remote --file=${schemaPath} --yes`, {
                stdio: "inherit",
            });
        } catch (e) {
            console.warn("Schema apply warning (may already exist):", (e as Error).message);
        }
    }

    let inserted = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < manifest.length; i += BATCH_SIZE) {
        const batch = manifest.slice(i, i + BATCH_SIZE);
        const sql = batch.map(buildInsert).join("\n");

        // Write to temp file (wrangler d1 execute --command has length limits)
        const tmpFile = path.join(os.tmpdir(), `grudge-d1-seed-${Date.now()}.sql`);
        fs.writeFileSync(tmpFile, sql);

        try {
            execSync(`npx wrangler@latest d1 execute ${DB_NAME} --remote --file=${tmpFile} --yes`, {
                stdio: "inherit",
            });
            inserted += batch.length;
            console.log(`  ✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} rows`);
        } catch (e) {
            errors += batch.length;
            console.error(
                `  ✗ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${(e as Error).message}`
            );
        } finally {
            fs.unlinkSync(tmpFile);
        }
    }

    console.log(`\n── Summary ──────────────────────────────────`);
    console.log(`  Inserted : ${inserted}`);
    console.log(`  Errors   : ${errors}`);

    if (errors === 0) {
        console.log(`\nD1 seeded! Deploy the worker:`);
        console.log(`  npx wrangler deploy`);
        console.log(`\nThen test:`);
        console.log(`  curl https://api.grudge-studio.com/assets?limit=5`);
        console.log(`  curl https://api.grudge-studio.com/assets/category/character`);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
