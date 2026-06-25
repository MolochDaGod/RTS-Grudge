#!/usr/bin/env ts-node
/**
 * audit-documents-assets.ts
 *
 * Scans a local folder tree for .glb/.gltf files, checks R2/CDN presence,
 * classifies game use, uploads missing assets, seeds D1, and optionally
 * removes local copies after verified upload.
 *
 * Usage:
 *   npx ts-node scripts/audit-documents-assets.ts --scan "C:\Users\nugye\Documents" [--dry-run]
 *   npx ts-node scripts/audit-documents-assets.ts --from-json agent-tools/documents-glb-scan.json [--upload] [--seed] [--purge]
 *
 * Flags:
 *   --dry-run     Report only; no uploads/deletes
 *   --upload      Upload missing files to R2
 *   --seed        Run seed-d1.ts after upload manifest is written
 *   --purge       Delete local file after CDN HEAD returns 200 + matching size
 *   --min-mb N    Skip files smaller than N MB (default 0)
 *   --max-mb N    Skip files larger than N MB (default 200)
 *   --limit N     Process at most N files (for batch runs)
 *   --priority    Process environments/characters/weapons before other categories
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import {
  buildManifestEntry,
  mimeTypeForExt,
  type ManifestEntry,
} from "./lib/assetManifest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(HERE, "../.env") });

const CDN_BASE = process.env.ASSET_CDN_BASE ?? "https://assets.grudge-studio.com";
const BUCKET = process.env.R2_BUCKET_NAME ?? "grudge-assets";
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID ?? "";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? "";
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const DO_UPLOAD = args.includes("--upload");
const DO_SEED = args.includes("--seed");
const DO_PURGE = args.includes("--purge");
const scanIdx = args.indexOf("--scan");
const jsonIdx = args.indexOf("--from-json");
const minMbIdx = args.indexOf("--min-mb");
const maxMbIdx = args.indexOf("--max-mb");
const limitIdx = args.indexOf("--limit");
const PRIORITY = args.includes("--priority");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 0;
const MIN_BYTES = minMbIdx >= 0 ? Number(args[minMbIdx + 1]) * 1024 * 1024 : 0;
const MAX_BYTES = maxMbIdx >= 0 ? Number(args[maxMbIdx + 1]) * 1024 * 1024 : 200 * 1024 * 1024;

const PRIORITY_USE_CASES = new Set([
  "environment_map",
  "character_rig",
  "weapon_mesh",
  "animation_clip",
  "structure",
]);

const OUT_DIR = path.resolve(HERE, "../dist");
const AUDIT_PATH = path.join(OUT_DIR, "documents-asset-audit.json");
const MANIFEST_PATH = path.join(OUT_DIR, "documents-asset-manifest.json");

interface LocalAsset {
  fullPath: string;
  size: number;
  mtime: string;
}

interface AuditRow {
  localPath: string;
  fileName: string;
  sizeBytes: number;
  r2Key: string;
  cdnUrl: string;
  onCdn: boolean;
  cdnSize: number | null;
  category: string;
  useCase: string;
  boneMap: string | null;
  animationPacks: string[] | null;
  gameReady: boolean;
  skipReason: string | null;
  grudgeUuid: string;
  uploaded: boolean;
  purged: boolean;
}

function md5File(filePath: string): string {
  return crypto.createHash("md5").update(fs.readFileSync(filePath)).digest("hex");
}

function walkGlbGltf(root: string): LocalAsset[] {
  const out: LocalAsset[] = [];
  const stack = [root];
  const skipDirs = new Set([
    "node_modules", ".git", "Library", "Temp", "Logs", "Cache",
    "DerivedDataCache", "Build", "obj", "bin", ".vs", ".idea",
  ]);
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!skipDirs.has(e.name)) stack.push(full);
        continue;
      }
      const ext = path.extname(e.name).toLowerCase();
      if (ext !== ".glb" && ext !== ".gltf") continue;
      try {
        const st = fs.statSync(full);
        out.push({ fullPath: full, size: st.size, mtime: st.mtime.toISOString() });
      } catch {
        /* skip */
      }
    }
  }
  return out;
}

function slugify(name: string): string {
  return name
    .replace(/\.(glb|gltf)$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "asset";
}

/** Map a Documents path to a canonical R2 key under models/ */
function inferR2Key(localPath: string, fileName: string): { r2Key: string; useCase: string } {
  const lower = localPath.toLowerCase().replace(/\\/g, "/");
  const stem = slugify(fileName);

  if (/(animation|anim_|_anim|locomotion|mixamo)/.test(lower)) {
    return { r2Key: `models/animations/${stem}.glb`, useCase: "animation_clip" };
  }
  if (/(weapon|sword|axe|bow|rifle|gun|shield|dagger|staff|mace)/.test(lower)) {
    return { r2Key: `models/weapons/${stem}.glb`, useCase: "weapon_mesh" };
  }
  if (/(character|hero|player|npc|enemy|orc|elf|dwarf|human|skeleton|zombie|boss)/.test(lower)) {
    return { r2Key: `models/characters/${stem}.glb`, useCase: "character_rig" };
  }
  if (/(map|terrain|environment|dungeon|arena|island|fort|town|city|underground)/.test(lower)) {
    return { r2Key: `models/environments/${stem}.glb`, useCase: "environment_map" };
  }
  if (/(building|house|tower|castle|hut|tavern|structure)/.test(lower)) {
    return { r2Key: `models/buildings/${stem}.glb`, useCase: "structure" };
  }
  if (/(prop|item|pickup|loot|chest|crate|potion)/.test(lower)) {
    return { r2Key: `models/props/${stem}.glb`, useCase: "prop" };
  }
  if (/(vehicle|car|ship|boat|mount)/.test(lower)) {
    return { r2Key: `models/vehicles/${stem}.glb`, useCase: "vehicle" };
  }
  if (/(vfx|effect|particle|explosion|fire|spell)/.test(lower)) {
    return { r2Key: `models/vfx/${stem}.glb`, useCase: "vfx" };
  }
  return { r2Key: `models/imported/${stem}.glb`, useCase: "unclassified_import" };
}

async function headCdn(url: string): Promise<{ ok: boolean; size: number | null }> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return { ok: false, size: null };
    const len = res.headers.get("content-length");
    return { ok: true, size: len ? Number(len) : null };
  } catch {
    return { ok: false, size: null };
  }
}

function shellQuote(arg: string): string {
  return `"${arg.replace(/"/g, '\\"')}"`;
}

async function uploadFile(
  filePath: string,
  r2Key: string,
  contentType: string,
): Promise<void> {
  if (ACCOUNT_ID && ACCESS_KEY && SECRET_KEY) {
    try {
      const s3 = await import("@aws-sdk/client-s3");
      const client = new s3.S3Client({
        region: "auto",
        endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
      });
      const body = fs.readFileSync(filePath);
      await client.send(
        new s3.PutObjectCommand({
          Bucket: BUCKET,
          Key: r2Key,
          Body: body,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      return;
    } catch {
      /* fall through to wrangler */
    }
  }
  execSync(
    [
      "npx wrangler r2 object put",
      shellQuote(`${BUCKET}/${r2Key}`),
      "--file",
      shellQuote(filePath),
      "--content-type",
      shellQuote(contentType),
      "--remote",
    ].join(" "),
    { cwd: path.resolve(HERE, ".."), stdio: "pipe" },
  );
}

function loadFromJson(jsonPath: string): LocalAsset[] {
  const text = fs.readFileSync(jsonPath, "utf8").trim();
  if (!text) return [];
  if (jsonPath.endsWith(".ndjson")) {
    return text.split(/\r?\n/).filter(Boolean).map((line) => {
      const row = JSON.parse(line) as { fullPath?: string; size?: number; mtime?: string };
      return { fullPath: row.fullPath ?? "", size: row.size ?? 0, mtime: row.mtime ?? "" };
    }).filter((a) => a.fullPath.endsWith(".glb") || a.fullPath.endsWith(".gltf"));
  }
  const raw = JSON.parse(text);
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((row: { FullName?: string; fullPath?: string; Length?: number; size?: number; LastWriteTime?: string; mtime?: string }) => ({
    fullPath: row.FullName ?? row.fullPath ?? "",
    size: row.Length ?? row.size ?? 0,
    mtime: row.LastWriteTime ?? row.mtime ?? "",
  })).filter((a) => a.fullPath && (a.fullPath.endsWith(".glb") || a.fullPath.endsWith(".gltf")));
}

async function main() {
  let assets: LocalAsset[] = [];
  if (jsonIdx >= 0) {
    assets = loadFromJson(path.resolve(args[jsonIdx + 1]));
  } else if (scanIdx >= 0) {
    console.log(`Scanning ${args[scanIdx + 1]} …`);
    assets = walkGlbGltf(path.resolve(args[scanIdx + 1]));
  } else {
    console.error("Provide --scan <dir> or --from-json <file>");
    process.exit(1);
  }

  const missing = assets.filter((a) => !fs.existsSync(a.fullPath)).length;
  assets = assets.filter((a) => fs.existsSync(a.fullPath));
  console.log(`Found ${assets.length} GLB/GLTF files (${missing} missing/skipped — likely purged in a prior batch)`);

  if (PRIORITY) {
    assets.sort((a, b) => {
      const pa = PRIORITY_USE_CASES.has(inferR2Key(a.fullPath, path.basename(a.fullPath)).useCase) ? 0 : 1;
      const pb = PRIORITY_USE_CASES.has(inferR2Key(b.fullPath, path.basename(b.fullPath)).useCase) ? 0 : 1;
      return pa - pb || b.size - a.size;
    });
  }
  // Dedupe by content hash — same bytes → upload once, purge all copies
  const byHash = new Map<string, LocalAsset[]>();
  for (const a of assets) {
    if (!fs.existsSync(a.fullPath)) continue;
    let h: string;
    try {
      h = md5File(a.fullPath);
    } catch {
      continue;
    }
    const list = byHash.get(h) ?? [];
    list.push(a);
    byHash.set(h, list);
  }
  assets = [...byHash.values()].map((group) => group[0]);

  if (LIMIT > 0) assets = assets.slice(0, LIMIT);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const hashGroups = byHash;

  const rows: AuditRow[] = [];
  const manifest: ManifestEntry[] = [];
  let uploaded = 0;
  let purged = 0;
  let skipped = 0;

  for (const asset of assets) {
    if (!fs.existsSync(asset.fullPath)) {
      skipped++;
      continue;
    }
    if (asset.size < MIN_BYTES || asset.size > MAX_BYTES) {
      skipped++;
      continue;
    }

    const fileName = path.basename(asset.fullPath);
    const ext = path.extname(fileName).toLowerCase();
    const { r2Key, useCase } = inferR2Key(asset.fullPath, fileName);
    const cdnUrl = `${CDN_BASE}/${r2Key}`;
    let hash: string;
    try {
      hash = md5File(asset.fullPath);
    } catch {
      skipped++;
      continue;
    }
    const entry = buildManifestEntry({
      r2Key,
      cdnBase: CDN_BASE,
      fileSize: asset.size,
      sourceHash: hash,
    });

    const cdn = await headCdn(cdnUrl);
    let row: AuditRow = {
      localPath: asset.fullPath,
      fileName,
      sizeBytes: asset.size,
      r2Key,
      cdnUrl,
      onCdn: cdn.ok,
      cdnSize: cdn.size,
      category: entry.category,
      useCase,
      boneMap: entry.boneMap,
      animationPacks: entry.animationPacks,
      gameReady: entry.category !== "asset" && asset.size > 10_000,
      skipReason: asset.size <= 10_000 ? "too_small_corrupt_guess" : null,
      grudgeUuid: entry.grudgeUuid,
      uploaded: false,
      purged: false,
    };

    const shouldUpload = DO_UPLOAD && !DRY_RUN && !cdn.ok && row.gameReady && ACCOUNT_ID && ACCESS_KEY && SECRET_KEY;
    if (shouldUpload) {
      try {
        await uploadFile(asset.fullPath, r2Key, mimeTypeForExt(ext));
        row.uploaded = true;
        row.onCdn = true;
        uploaded++;
        manifest.push(entry);
        console.log(`  ✓ uploaded ${r2Key}`);
      } catch (e) {
        row.skipReason = `upload_failed: ${(e as Error).message}`;
        console.error(`  ✗ ${r2Key}: ${(e as Error).message}`);
      }
    } else if (cdn.ok) {
      manifest.push(entry);
    } else if (DRY_RUN && row.gameReady) {
      console.log(`  [dry] would upload ${r2Key} (${(asset.size / 1e6).toFixed(1)} MB) — ${useCase}`);
    }

    if (DO_PURGE && !DRY_RUN && (row.uploaded || (cdn.ok && cdn.size === asset.size))) {
      const copies = hashGroups.get(hash) ?? [asset];
      for (const copy of copies) {
        if (!copy.fullPath.startsWith("C:\\Users\\nugye\\Documents")) continue;
        try {
          if (fs.existsSync(copy.fullPath)) {
            fs.unlinkSync(copy.fullPath);
            purged++;
            console.log(`  🗑 purged ${copy.fullPath}`);
          }
        } catch (e) {
          console.error(`  purge failed ${copy.fullPath}: ${(e as Error).message}`);
        }
      }
      row.purged = copies.some((c) => c.fullPath.startsWith("C:\\Users\\nugye\\Documents"));
    }

    rows.push(row);
  }

  fs.writeFileSync(AUDIT_PATH, JSON.stringify(rows, null, 2));
  if (manifest.length) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  }

  const summary = {
    scanned: assets.length,
    processed: rows.length,
    skipped,
    onCdn: rows.filter((r) => r.onCdn).length,
    gameReady: rows.filter((r) => r.gameReady).length,
    uploaded,
    purged,
    needsUpload: rows.filter((r) => r.gameReady && !r.onCdn).length,
  };

  console.log("\n── Audit summary ──");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Audit report: ${AUDIT_PATH}`);

  if (DO_SEED && !DRY_RUN && manifest.length && fs.existsSync(MANIFEST_PATH)) {
    fs.copyFileSync(MANIFEST_PATH, path.join(OUT_DIR, "asset-manifest.json"));
    console.log("Seeding D1 …");
    execSync("npx ts-node scripts/seed-d1.ts", { cwd: path.resolve(HERE, ".."), stdio: "inherit" });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});