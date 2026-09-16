#!/usr/bin/env node
/**
 * Stamp purpose / layer on every asset_registry row.
 * Does NOT delete the 6595-row index. Play kit = purpose='play'.
 *
 * Usage (RTS-Grudge cwd, wrangler auth):
 *   node scripts/stamp-d1-purpose.mjs --dry-run
 *   node scripts/stamp-d1-purpose.mjs
 *
 * Optional: --verify-play  GET magic-byte on purpose=play keys only.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyAsset, countByPurpose, PURPOSES } from "./lib/assetPurpose.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DRY = process.argv.includes("--dry-run");
const VERIFY_PLAY = process.argv.includes("--verify-play");
const DB = process.env.D1_DATABASE_NAME || "grudge-assets-db";
const CDN = (process.env.ASSET_CDN_BASE || "https://assets.grudge-studio.com").replace(/\/$/, "");
const BATCH = 80;

function wranglerJson(sql) {
  const quoted = sql.replace(/"/g, '\\"');
  const out = execSync(`wrangler d1 execute ${DB} --remote --command "${quoted}" --json`, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 180000
  });
  const text = String(out);
  const iArr = text.indexOf("[");
  const iObj = text.indexOf("{");
  const i = iArr === -1 ? iObj : iObj === -1 ? iArr : Math.min(iArr, iObj);
  if (i < 0) throw new Error("no JSON in wrangler output: " + text.slice(0, 240));
  return JSON.parse(text.slice(i));
}

function wranglerRun(sql, label) {
  const tmp = path.join(os.tmpdir(), `grudge-d1-purpose-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmp, sql);
  try {
    if (DRY) {
      console.log(`  [dry] ${label} (${sql.length} chars)`);
      return;
    }
    execSync(`wrangler d1 execute ${DB} --remote --file=${tmp} --yes`, {
      cwd: ROOT,
      stdio: "inherit",
      timeout: 180000
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
      if (r && (r.r2_key || r.purpose || r.n != null)) rows.push(r);
    }
  }
  return rows;
}

async function magicStatus(key) {
  try {
    const r = await fetch(`${CDN}/${key}`, {
      headers: { Referer: `${CDN}/`, "User-Agent": "grudge-d1-purpose/1" }
    });
    if (r.status === 404) return "missing";
    const buf = new Uint8Array(await r.arrayBuffer());
    const head = new TextDecoder().decode(buf.slice(0, 24));
    if (head.includes("<!DOCTYPE") || head.includes("<html") || head.includes("<HTML")) {
      return "html_fake";
    }
    if (buf.length < 32) return "missing";
    return "real";
  } catch {
    return "unknown";
  }
}

async function main() {
  console.log(`D1 ${DB}  dry=${DRY}  verifyPlay=${VERIFY_PLAY}`);

  for (const col of ["purpose", "layer", "body_status"]) {
    const sql = `ALTER TABLE asset_registry ADD COLUMN ${col} TEXT;`;
    if (DRY) {
      console.log(`  [dry] ALTER ${col}`);
      continue;
    }
    try {
      wranglerRun(sql, `ALTER ${col}`);
    } catch (e) {
      const msg = String(e?.stderr || e?.message || e);
      if (/duplicate column/i.test(msg)) console.log(`  skip ALTER ${col} (exists)`);
      else throw e;
    }
  }
  if (!DRY) {
    try {
      wranglerRun(
        "CREATE INDEX IF NOT EXISTS idx_asset_purpose ON asset_registry (purpose);\nCREATE INDEX IF NOT EXISTS idx_asset_layer ON asset_registry (layer);",
        "indexes"
      );
    } catch (e) {
      console.warn("  index", e?.message || e);
    }
  }

  console.log("SELECT id, r2_key, category (paged)…");
  const rows = [];
  const PAGE = 500;
  for (let offset = 0; offset < 20000; offset += PAGE) {
    const dumped = wranglerJson(
      `SELECT id, r2_key, category FROM asset_registry ORDER BY id LIMIT ${PAGE} OFFSET ${offset};`
    );
    const chunk = parseRows(dumped);
    rows.push(...chunk);
    console.log(`  +${chunk.length} (total ${rows.length})`);
    if (chunk.length < PAGE) break;
  }
  if (!rows.length) {
    console.error("No rows parsed. Raw keys:", Object.keys(dumped?.[0] || dumped || {}));
    console.error(JSON.stringify(dumped).slice(0, 500));
    process.exit(1);
  }
  console.log(`rows ${rows.length}`);

  const classified = rows.map((r) => {
    const c = classifyAsset(r.r2_key, r.category);
    return { id: r.id, r2_key: r.r2_key, ...c };
  });
  const counts = countByPurpose(classified);
  console.log("purpose counts", counts);
  const play = classified.filter((r) => r.purpose === "play");
  console.log(`play kit ${play.length} (not ${rows.length})`);
  for (const p of play.slice(0, 40)) {
    console.log(`  PLAY  ${p.layer.padEnd(10)} ${p.r2_key}`);
  }
  if (play.length > 40) console.log(`  … ${play.length - 40} more play`);

  const skip = classified.filter((r) => r.purpose === "skip");
  console.log(`skip ${skip.length}`);
  for (const s of skip.slice(0, 20)) {
    console.log(`  SKIP  ${s.r2_key}  ${s.note || ""}`);
  }

  const groups = new Map();
  for (const r of classified) {
    const key = `${r.purpose}\t${r.layer}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r.id);
  }

  if (DRY) {
    console.log("groups", [...groups.keys()].map((k) => `${k.replace("\t", "/")} ${groups.get(k).length}`));
    console.log("dry-run: no UPDATE");
    return;
  }

  const stmts = [];
  for (const [key, ids] of groups) {
    const [purpose, layer] = key.split("\t");
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      stmts.push(
        `UPDATE asset_registry SET purpose=${escape(purpose)}, layer=${escape(layer)}, body_status=COALESCE(body_status, 'unknown') WHERE id IN (${chunk.map(escape).join(",")});`
      );
    }
  }
  for (let i = 0; i < stmts.length; i += 40) {
    wranglerRun(stmts.slice(i, i + 40).join("\n"), `UPDATE batch ${i / 40 + 1}`);
  }

  if (VERIFY_PLAY) {
    console.log("magic-byte play keys…");
    const updates = [];
    for (const p of play) {
      const st = await magicStatus(p.r2_key);
      console.log(`  ${st.padEnd(10)} ${p.r2_key}`);
      updates.push(
        `UPDATE asset_registry SET body_status=${escape(st)} WHERE id=${escape(p.id)};`
      );
    }
    for (let i = 0; i < updates.length; i += BATCH) {
      wranglerRun(updates.slice(i, i + BATCH).join("\n"), `body_status ${i / BATCH + 1}`);
    }
  }

  const tally = wranglerJson(
    "SELECT COALESCE(purpose,'unset') AS purpose, COUNT(*) AS n FROM asset_registry GROUP BY 1 ORDER BY n DESC;"
  );
  console.log("live tally", JSON.stringify(parseRows(tally).length ? tally : tally, null, 2).slice(0, 1500));
  console.log("done. Query: GET /assets?purpose=play");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
