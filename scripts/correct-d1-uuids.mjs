#!/usr/bin/env node
/**
 * Retro-correct asset_registry UUIDs + era + size on live D1.
 * Extends stamp-d1-purpose.mjs — does NOT invent a second table.
 *
 *   node scripts/correct-d1-uuids.mjs --dry-run
 *   node scripts/correct-d1-uuids.mjs
 *   node scripts/correct-d1-uuids.mjs --verify-play
 *
 * UUID: sha1("grudge-asset:" + r2_key) → UUID v5 (same as assetManifest.ts)
 * game_era from r2_key path. game_uuid (character) is NOT stamped here.
 * Play rows: HEAD CDN for file_size + magic-byte body_status.
 */
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyAsset } from "./lib/assetPurpose.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DRY = process.argv.includes("--dry-run");
const VERIFY_PLAY = process.argv.includes("--verify-play") || !DRY;
const DB = process.env.D1_DATABASE_NAME || "grudge-assets-db";
const CDN = (process.env.ASSET_CDN_BASE || "https://assets.grudge-studio.com").replace(/\/$/, "");
const BATCH = 80;

function buildDeterministicUuid(r2Key) {
  const seed = `grudge-asset:${String(r2Key || "").replace(/^\/+/, "")}`;
  const bytes = crypto.createHash("sha1").update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function eraFromKey(r2Key) {
  const k = String(r2Key || "").replace(/^\/+/, "").toLowerCase();
  if (k.includes("toon-rts") || k.includes("grudge6") || k.startsWith("prod/anims/")) return "warlords";
  if (k.includes("models/vfx/") || k.includes("models/weapons/t0") || k.includes("models/creatures/land/")) return "warlords";
  if (k.includes("harvest/") || k.includes("nature/stylized")) return "warlords";
  if (k.includes("voxel") || k.includes("/vox/") || k.includes("mixamo") || k.includes("grudox")) return "grudox";
  if (k.includes("cinema") || k.includes("leviathan") || k.includes("shipwreck")) return "cinema";
  if (k.includes("forge") || k.endsWith(".gfscene")) return "forge";
  return "open";
}

function textureFormatFromKey(r2Key) {
  const k = String(r2Key || "").toLowerCase();
  if (k.endsWith(".glb") || k.endsWith(".gltf")) return "embed";
  if (k.endsWith(".ktx2")) return "ktx2";
  if (k.endsWith(".webp")) return "webp";
  if (k.endsWith(".png") || k.endsWith(".jpg") || k.endsWith(".jpeg") || k.endsWith(".tga")) return "raster";
  if (k.endsWith(".fbx")) return "author";
  return "none";
}

function wranglerJson(sql) {
  const quoted = sql.replace(/"/g, '\\"');
  const out = execSync(`wrangler d1 execute ${DB} --remote --command "${quoted}" --json`, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || "ee475864561b02d4588180b8b9acf694" },
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 180000,
  });
  const text = String(out);
  const iArr = text.indexOf("[");
  const iObj = text.indexOf("{");
  const i = iArr === -1 ? iObj : iObj === -1 ? iArr : Math.min(iArr, iObj);
  if (i < 0) throw new Error("no JSON in wrangler output: " + text.slice(0, 240));
  return JSON.parse(text.slice(i));
}

function wranglerRun(sql, label) {
  const tmp = path.join(os.tmpdir(), `grudge-d1-uuid-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmp, sql);
  try {
    if (DRY) {
      console.log(`  [dry] ${label} (${sql.split("\n").length} stmts)`);
      return;
    }
    execSync(`wrangler d1 execute ${DB} --remote --file=${tmp} --yes`, {
      cwd: ROOT,
      env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || "ee475864561b02d4588180b8b9acf694" },
      stdio: "inherit",
      timeout: 180000,
    });
    console.log(`  ok ${label}`);
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* */
    }
  }
}

function escape(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function parseRows(json) {
  const blocks = Array.isArray(json) ? json : [json];
  const rows = [];
  for (const b of blocks) {
    const inner = Array.isArray(b?.results)
      ? b.results
      : Array.isArray(b?.result?.[0]?.results)
        ? b.result[0].results
        : Array.isArray(b?.result)
          ? b.result
          : [];
    for (const r of inner) {
      if (r && (r.r2_key || r.id)) rows.push(r);
    }
  }
  return rows;
}

async function headCdn(key) {
  try {
    const r = await fetch(`${CDN}/${key}`, {
      method: "HEAD",
      headers: { Referer: `${CDN}/`, "User-Agent": "grudge-d1-uuid/1" },
    });
    const len = Number(r.headers.get("content-length") || 0);
    const ct = String(r.headers.get("content-type") || "");
    if (r.status === 404) return { status: "missing", size: 0, ct };
    if (ct.includes("text/html")) return { status: "html_fake", size: len, ct };
    return { status: r.ok ? "real" : "unknown", size: len, ct };
  } catch {
    return { status: "unknown", size: 0, ct: "" };
  }
}

async function main() {
  console.log(`D1 ${DB} dry=${DRY} verifyPlay=${VERIFY_PLAY}`);

  for (const col of [
    ["game_era", "TEXT"],
    ["texture_format", "TEXT"],
  ]) {
    const sql = `ALTER TABLE asset_registry ADD COLUMN ${col[0]} ${col[1]};`;
    if (DRY) {
      console.log(`  [dry] ALTER ${col[0]}`);
      continue;
    }
    try {
      wranglerRun(sql, `ALTER ${col[0]}`);
    } catch (e) {
      const msg = String(e?.stderr || e?.message || e);
      if (/duplicate column/i.test(msg)) console.log(`  skip ALTER ${col[0]} (exists)`);
      else throw e;
    }
  }
  if (!DRY) {
    try {
      wranglerRun(
        "CREATE INDEX IF NOT EXISTS idx_asset_uuid ON asset_registry (grudge_uuid);\nCREATE INDEX IF NOT EXISTS idx_asset_era ON asset_registry (game_era);",
        "indexes",
      );
    } catch (e) {
      console.warn("  index", e?.message || e);
    }
  }

  const rows = [];
  const PAGE = 500;
  for (let offset = 0; offset < 30000; offset += PAGE) {
    const dumped = wranglerJson(
      `SELECT id, r2_key, category, grudge_uuid, purpose, file_size FROM asset_registry ORDER BY id LIMIT ${PAGE} OFFSET ${offset};`,
    );
    const chunk = parseRows(dumped);
    rows.push(...chunk);
    console.log(`  +${chunk.length} (total ${rows.length})`);
    if (chunk.length < PAGE) break;
  }
  console.log(`rows ${rows.length}`);

  const updates = [];
  let uuidFix = 0;
  let eraFix = 0;
  const play = [];

  for (const r of rows) {
    const key = String(r.r2_key || "").replace(/^\/+/, "");
    if (!key) continue;
    const uuid = buildDeterministicUuid(key);
    const era = eraFromKey(key);
    const tex = textureFormatFromKey(key);
    const cls = classifyAsset(key, r.category);
    if (cls.purpose === "play") play.push({ ...r, r2_key: key, uuid, era, tex, layer: cls.layer });
    const needUuid = !r.grudge_uuid || r.grudge_uuid !== uuid;
    if (needUuid) uuidFix++;
    eraFix++;
    updates.push({
      id: r.id,
      uuid,
      era,
      tex,
    });
  }
  console.log(`uuid mismatches/empty ${uuidFix} / ${rows.length}`);
  console.log(`play kit ${play.length}`);

  const stmts = [];
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    const parts = chunk.map(
      (u) =>
        `UPDATE asset_registry SET grudge_uuid=${escape(u.uuid)}, game_era=${escape(u.era)}, texture_format=${escape(u.tex)}, updated_at=(unixepoch()*1000) WHERE id=${escape(u.id)};`,
    );
    stmts.push(parts.join("\n"));
  }
  for (let i = 0; i < stmts.length; i++) {
    wranglerRun(stmts[i], `UUID/era batch ${i + 1}/${stmts.length}`);
  }

  if (VERIFY_PLAY) {
    console.log("HEAD play kit on CDN…");
    const playStmts = [];
    for (const p of play) {
      const h = await headCdn(p.r2_key);
      console.log(`  ${h.status.padEnd(10)} ${String(h.size).padStart(10)}  ${p.r2_key}`);
      const sizeSql = h.size > 0 ? `file_size=${h.size}, ` : "";
      playStmts.push(
        `UPDATE asset_registry SET ${sizeSql}body_status=${escape(h.status)}, updated_at=(unixepoch()*1000) WHERE id=${escape(p.id)};`,
      );
    }
    for (let i = 0; i < playStmts.length; i += BATCH) {
      wranglerRun(playStmts.slice(i, i + BATCH).join("\n"), `play HEAD batch ${i / BATCH + 1}`);
    }
  }

  const summary = wranglerJson(
    `SELECT COUNT(*) AS n, SUM(CASE WHEN grudge_uuid IS NULL OR grudge_uuid='' THEN 1 ELSE 0 END) AS uuid_empty, SUM(CASE WHEN game_era IS NULL OR game_era='' THEN 1 ELSE 0 END) AS era_empty, SUM(CASE WHEN purpose='play' THEN 1 ELSE 0 END) AS play_n FROM asset_registry;`,
  );
  console.log("summary", JSON.stringify(parseRows(summary)[0] || summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
