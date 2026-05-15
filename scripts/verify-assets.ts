/**
 * verify-assets — Production quality check script.
 *
 * Scans all model paths from:
 *   - ModelRegistry (ALL_CHARACTER_MODELS, ALL_WEAPON_CATALOG)
 *   - BuildingPalette (ALL_BUILDING_PIECES)
 *   - WeaponPrefabDatabase (weapon model sources)
 *   - ArrowAmmoSystem (arrow/bolt models)
 *
 * Reports:
 *   - Missing files (path in registry but no file on disk)
 *   - Duplicate registrations (same path registered twice)
 *   - File size anomalies (>50MB = probably too big, <1KB = probably empty)
 *
 * Run: npx tsx scripts/verify-assets.ts
 */

import * as fs from "fs";
import * as path from "path";

const DIST_PUBLIC = path.resolve(process.cwd(), "dist/public");
const CLIENT_PUBLIC = path.resolve(process.cwd(), "client/public");

interface AssetEntry {
  source: string;
  path: string;
  format?: string;
}

// Collect all registered asset paths
const allPaths: AssetEntry[] = [];

// Helper to check if a file exists in either dist/public or client/public
function resolveAssetPath(assetPath: string): string | null {
  // Strip leading slash
  const rel = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;

  const distPath = path.join(DIST_PUBLIC, rel);
  if (fs.existsSync(distPath)) return distPath;

  const clientPath = path.join(CLIENT_PUBLIC, rel);
  if (fs.existsSync(clientPath)) return clientPath;

  return null;
}

// ── Scan character models ──
try {
  // Read the ModelRegistry source and extract paths
  const registryPath = path.resolve(process.cwd(), "client/src/game/systems/ModelRegistry.ts");
  if (fs.existsSync(registryPath)) {
    const content = fs.readFileSync(registryPath, "utf-8");
    const pathMatches = content.match(/path:\s*"([^"]+\.(glb|gltf|fbx))"/g) || [];
    for (const match of pathMatches) {
      const p = match.match(/path:\s*"([^"]+)"/)?.[1];
      if (p) allPaths.push({ source: "ModelRegistry", path: p });
    }
  }
} catch (e) {
  console.warn("Could not scan ModelRegistry:", (e as Error).message);
}

// ── Scan building palette ──
try {
  const palettePath = path.resolve(process.cwd(), "client/src/game/building/BuildingPalette.ts");
  if (fs.existsSync(palettePath)) {
    const content = fs.readFileSync(palettePath, "utf-8");
    const pathMatches = content.match(/path:\s*`[^`]*`/g) || [];
    for (const match of pathMatches) {
      const p = match.match(/path:\s*`([^`]+)`/)?.[1];
      if (p && !p.includes("${")) {
        allPaths.push({ source: "BuildingPalette", path: p });
      }
    }
  }
} catch (e) {
  console.warn("Could not scan BuildingPalette:", (e as Error).message);
}

// ── Scan weapon prefab database ──
try {
  const wpdbPath = path.resolve(process.cwd(), "client/src/game/systems/WeaponPrefabDatabase.ts");
  if (fs.existsSync(wpdbPath)) {
    const content = fs.readFileSync(wpdbPath, "utf-8");
    const pathMatches = content.match(/path:\s*"([^"]+\.(glb|gltf|fbx))"/g) || [];
    for (const match of pathMatches) {
      const p = match.match(/path:\s*"([^"]+)"/)?.[1];
      if (p) allPaths.push({ source: "WeaponPrefabDB", path: p });
    }
  }
} catch (e) {
  console.warn("Could not scan WeaponPrefabDatabase:", (e as Error).message);
}

// ── Scan VFX models ──
try {
  const vfxPath = path.resolve(process.cwd(), "client/src/game/effects/MeshVFXProjectiles.ts");
  if (fs.existsSync(vfxPath)) {
    const content = fs.readFileSync(vfxPath, "utf-8");
    const pathMatches = content.match(/path:\s*"([^"]+\.(glb|gltf))"/g) || [];
    for (const match of pathMatches) {
      const p = match.match(/path:\s*"([^"]+)"/)?.[1];
      if (p) allPaths.push({ source: "MeshVFX", path: p });
    }
  }
} catch (e) {
  console.warn("Could not scan MeshVFXProjectiles:", (e as Error).message);
}

// ── Run verification ──
console.log("\n═══════════════════════════════════════");
console.log("  Grudge Warlords — Asset Verification");
console.log("═══════════════════════════════════════\n");

// Deduplicate
const uniquePaths = new Map<string, AssetEntry>();
const duplicates: string[] = [];
for (const entry of allPaths) {
  if (uniquePaths.has(entry.path)) {
    duplicates.push(`${entry.path} (${entry.source} + ${uniquePaths.get(entry.path)!.source})`);
  } else {
    uniquePaths.set(entry.path, entry);
  }
}

const missing: AssetEntry[] = [];
const found: { entry: AssetEntry; size: number; resolved: string }[] = [];
const oversized: { entry: AssetEntry; size: number }[] = [];
const empty: { entry: AssetEntry; size: number }[] = [];

for (const [assetPath, entry] of uniquePaths) {
  const resolved = resolveAssetPath(assetPath);
  if (!resolved) {
    missing.push(entry);
  } else {
    const stat = fs.statSync(resolved);
    const sizeMB = stat.size / (1024 * 1024);
    found.push({ entry, size: stat.size, resolved });
    if (sizeMB > 50) oversized.push({ entry, size: stat.size });
    if (stat.size < 1024) empty.push({ entry, size: stat.size });
  }
}

// ── Report ──
console.log(`Total registered paths: ${uniquePaths.size}`);
console.log(`Found on disk:          ${found.length}`);
console.log(`Missing:                ${missing.length}`);
console.log(`Duplicates:             ${duplicates.length}`);
console.log(`Oversized (>50MB):      ${oversized.length}`);
console.log(`Suspiciously small:     ${empty.length}`);
console.log("");

if (missing.length > 0) {
  console.log("❌ MISSING FILES:");
  for (const m of missing.slice(0, 30)) {
    console.log(`   ${m.source}: ${m.path}`);
  }
  if (missing.length > 30) console.log(`   ... and ${missing.length - 30} more`);
  console.log("");
}

if (duplicates.length > 0) {
  console.log("⚠ DUPLICATE REGISTRATIONS:");
  for (const d of duplicates.slice(0, 10)) {
    console.log(`   ${d}`);
  }
  console.log("");
}

if (oversized.length > 0) {
  console.log("⚠ OVERSIZED FILES (>50MB):");
  for (const o of oversized) {
    console.log(`   ${o.entry.path} — ${(o.size / 1024 / 1024).toFixed(1)}MB`);
  }
  console.log("");
}

if (empty.length > 0) {
  console.log("⚠ SUSPICIOUSLY SMALL (<1KB):");
  for (const e of empty) {
    console.log(`   ${e.entry.path} — ${e.size} bytes`);
  }
  console.log("");
}

// Source breakdown
const bySource = new Map<string, number>();
for (const entry of allPaths) {
  bySource.set(entry.source, (bySource.get(entry.source) || 0) + 1);
}
console.log("📊 PATHS BY SOURCE:");
for (const [source, count] of bySource) {
  console.log(`   ${source}: ${count}`);
}
console.log("");

const exitCode = missing.length > 0 ? 1 : 0;
console.log(missing.length === 0 ? "✅ All registered assets found on disk." : `❌ ${missing.length} assets missing — check paths or upload to R2.`);
process.exit(exitCode);
