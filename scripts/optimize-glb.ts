#!/usr/bin/env tsx
/**
 * optimize-glb.ts
 *
 * Build-time GLB optimizer for the Grudge asset pipeline.
 *
 * Per-file codec selection:
 *   - Skinned / animated (skins > 0 OR animations > 0)  → EXT_meshopt_compression
 *     (Meshopt decodes fast and is safe for skinning + animation tracks; it also
 *      matches the runtime `setMeshoptDecoder` already wired in AssetLoader.ts.)
 *   - Static meshes                                       → KHR_draco_mesh_compression
 *     (Draco gives the best ratio for static geometry; runtime has DRACOLoader.)
 *
 * Both classes also get: weld → dedup → prune → (join, static only) → texture
 * compression (WebP, resized to a cap). Optional LOD variants for static meshes.
 *
 * Usage:
 *   npx tsx scripts/optimize-glb.ts [options]
 *
 * Options:
 *   --in-dir <dir>    Source root to scan for .glb (default: client/public/models)
 *   --out-dir <dir>   Output root (default: dist/optimized/models)
 *   --in-place        Write optimized GLBs back over the source files
 *   --input <file>    Optimize a single .glb file instead of scanning a dir
 *   --category <name> Only process files whose path contains this substring
 *   --lods            Also emit lod1-/lod2- simplified variants for static meshes
 *   --ktx2            Compress textures to KTX2/UASTC instead of WebP
 *   --texture-size N  Max texture dimension (default: 1024)
 *   --force           Re-process even if the input hash is unchanged
 *   --dry-run         Report what would be processed without writing output
 */

import { NodeIO, type Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  weld,
  dedup,
  prune,
  resample,
  join,
  draco,
  meshopt,
  textureCompress,
  simplify,
} from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from "meshoptimizer";
import draco3d from "draco3dgltf";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, "..");

// ── Args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (name: string) => argv.includes(`--${name}`);
const opt = (name: string, def: string): string => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};

const IN_DIR = path.resolve(PROJECT_ROOT, opt("in-dir", "client/public/models"));
const OUT_DIR = path.resolve(PROJECT_ROOT, opt("out-dir", "dist/optimized/models"));
const SINGLE_INPUT = opt("input", "");
const IN_PLACE = has("in-place");
const CATEGORY = opt("category", "");
const WITH_LODS = has("lods");
const USE_KTX2 = has("ktx2");
const TEX_SIZE = parseInt(opt("texture-size", "1024"), 10);
const FORCE = has("force");
const DRY_RUN = has("dry-run");

const REPORT_PATH = path.resolve(PROJECT_ROOT, "dist/glb-optimize-report.json");
const CACHE_PATH = path.resolve(PROJECT_ROOT, "dist/glb-optimize-cache.json");

// ── Helpers ───────────────────────────────────────────────────────────────────
function walk(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.glb$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function md5(file: string): string {
  return crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
}

function fmtKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

interface DocStats {
  meshes: number;
  materials: number;
  textures: number;
  skins: number;
  animations: number;
}

function docStats(doc: Document): DocStats {
  const root = doc.getRoot();
  return {
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    skins: root.listSkins().length,
    animations: root.listAnimations().length,
  };
}

interface ReportEntry {
  file: string;
  codec: "meshopt" | "draco" | "none";
  inBytes: number;
  outBytes: number;
  savingsPct: number;
  stats: DocStats;
  lods?: string[];
  status: "ok" | "skipped" | "error";
  error?: string;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  await MeshoptSimplifier.ready;

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });

  const files = SINGLE_INPUT
    ? [path.resolve(PROJECT_ROOT, SINGLE_INPUT)]
    : walk(IN_DIR).filter((f) => (CATEGORY ? f.toLowerCase().includes(CATEGORY.toLowerCase()) : true));

  console.log(
    `Scanning ${SINGLE_INPUT ? "1 input" : IN_DIR}… ${files.length} GLB file(s)${DRY_RUN ? " (DRY RUN)" : ""}`,
  );

  const cache: Record<string, string> = fs.existsSync(CACHE_PATH)
    ? JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"))
    : {};

  const report: ReportEntry[] = [];
  let totalIn = 0;
  let totalOut = 0;
  let okCount = 0;
  let skipCount = 0;
  let errCount = 0;

  for (const inFile of files) {
    const rel = SINGLE_INPUT
      ? path.basename(inFile)
      : path.relative(IN_DIR, inFile).replace(/\\/g, "/");
    const outFile = IN_PLACE ? inFile : path.join(OUT_DIR, SINGLE_INPUT ? path.basename(inFile) : rel);

    const inBytes = fs.statSync(inFile).size;
    const inHash = md5(inFile);

    if (!FORCE && !DRY_RUN && cache[rel] === inHash && fs.existsSync(outFile)) {
      skipCount++;
      report.push({ file: rel, codec: "none", inBytes, outBytes: fs.statSync(outFile).size, savingsPct: 0, stats: { meshes: 0, materials: 0, textures: 0, skins: 0, animations: 0 }, status: "skipped" });
      console.log(`  - ${rel} (unchanged, skipped)`);
      continue;
    }

    try {
      const doc = await io.read(inFile);
      const stats = docStats(doc);
      const isSkinned = stats.skins > 0 || stats.animations > 0;
      const codec: "meshopt" | "draco" = isSkinned ? "meshopt" : "draco";

      if (DRY_RUN) {
        console.log(
          `  [DRY] ${rel} → ${codec}  (${stats.meshes} mesh, ${stats.materials} mat, ${stats.textures} tex, ${stats.skins} skin, ${stats.animations} anim)`,
        );
        report.push({ file: rel, codec, inBytes, outBytes: 0, savingsPct: 0, stats, status: "ok" });
        continue;
      }

      const texFn = USE_KTX2
        ? textureCompress({ encoder: sharp, targetFormat: "ktx2", resize: [TEX_SIZE, TEX_SIZE] })
        : textureCompress({ encoder: sharp, targetFormat: "webp", resize: [TEX_SIZE, TEX_SIZE] });

      if (isSkinned) {
        // Skinned/animated → Meshopt. No join() (must not merge skinned graph).
        await doc.transform(
          weld(),
          dedup(),
          resample(),
          prune(),
          texFn,
          meshopt({ encoder: MeshoptEncoder, level: "medium" }),
        );
      } else {
        // Static → Draco. join() reduces draw calls before compression.
        await doc.transform(
          weld(),
          dedup(),
          prune(),
          join(),
          texFn,
          draco({ method: "edgebreaker" }),
        );
      }

      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      await io.write(outFile, doc);
      const outBytes = fs.statSync(outFile).size;

      const lods: string[] = [];
      if (WITH_LODS && !isSkinned) {
        for (const [tag, ratio] of [["lod1", 0.5], ["lod2", 0.15]] as const) {
          try {
            const lodDoc = await io.read(inFile);
            await lodDoc.transform(
              weld(),
              dedup(),
              prune(),
              simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.001 }),
              join(),
              draco({ method: "edgebreaker" }),
            );
            const lodOut = path.join(path.dirname(outFile), `${tag}-${path.basename(outFile)}`);
            await io.write(lodOut, lodDoc);
            lods.push(path.relative(PROJECT_ROOT, lodOut).replace(/\\/g, "/"));
          } catch (e) {
            console.warn(`    ! LOD ${tag} failed for ${rel}: ${(e as Error).message}`);
          }
        }
      }

      const savingsPct = inBytes > 0 ? (1 - outBytes / inBytes) * 100 : 0;
      totalIn += inBytes;
      totalOut += outBytes;
      okCount++;
      cache[rel] = IN_PLACE ? md5(outFile) : inHash;
      report.push({ file: rel, codec, inBytes, outBytes, savingsPct, stats, lods: lods.length ? lods : undefined, status: "ok" });
      console.log(
        `  ✓ ${rel}  ${codec}  ${fmtKB(inBytes)} → ${fmtKB(outBytes)}  (${savingsPct.toFixed(1)}% smaller)${lods.length ? `  +${lods.length} LOD` : ""}`,
      );
    } catch (e) {
      errCount++;
      report.push({ file: rel, codec: "none", inBytes, outBytes: 0, savingsPct: 0, stats: { meshes: 0, materials: 0, textures: 0, skins: 0, animations: 0 }, status: "error", error: (e as Error).message });
      console.error(`  ✗ ${rel}: ${(e as Error).message}`);
    }
  }

  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  }

  console.log(`\n── Summary ─────────────────────────────────`);
  console.log(`  Optimized : ${okCount}`);
  console.log(`  Skipped   : ${skipCount} (unchanged)`);
  console.log(`  Errors    : ${errCount}`);
  if (totalIn > 0) {
    console.log(`  Size      : ${(totalIn / 1024 / 1024).toFixed(2)}MB → ${(totalOut / 1024 / 1024).toFixed(2)}MB  (${((1 - totalOut / totalIn) * 100).toFixed(1)}% smaller)`);
  }
  if (!DRY_RUN) console.log(`  Report    : ${path.relative(PROJECT_ROOT, REPORT_PATH)}`);

  if (errCount > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
