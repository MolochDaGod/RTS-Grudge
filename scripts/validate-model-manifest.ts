/**
 * validate-model-manifest (TypeScript)
 *
 * Imports the actual exported registry arrays from ModelRegistry.ts (covering
 * static literals, generated paths from `generateWeaponModels`, and any future
 * generator) and verifies each referenced file exists under client/public.
 *
 * Used both as a standalone CLI (`tsx scripts/validate-model-manifest.ts`)
 * and as a reusable module imported by `server/index.ts` in dev.
 *
 * Returns a structured result so callers (CLI or dev server) can render their
 * own warnings without re-walking source.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALL_CHARACTER_MODELS,
  ALL_WEAPON_CATALOG,
  OFFHAND_MODELS,
  SPELL_MODELS,
  ITEM_MODELS,
  ANIMATION_PACKS,
  WEAPON_TEXTURES,
} from "../client/src/game/systems/ModelRegistry";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_ROOT = path.resolve(HERE, "../client/public");

export interface MissingEntry {
  source: string;       // which exported registry it came from
  id: string | null;    // logical id (when known)
  path: string;         // the URL path (e.g. "/models/...")
}

export interface ValidationResult {
  ok: boolean;
  total: number;
  missing: MissingEntry[];
}

interface PathRef {
  source: string;
  id: string | null;
  path: string;
}

function collectPaths(): PathRef[] {
  const refs: PathRef[] = [];

  const pushAll = (
    source: string,
    items: Array<{ id?: string; path?: string }>,
  ): void => {
    for (const item of items) {
      if (item?.path) refs.push({ source, id: item.id ?? null, path: item.path });
    }
  };

  pushAll("ALL_CHARACTER_MODELS", ALL_CHARACTER_MODELS as any);
  pushAll("ALL_WEAPON_CATALOG", ALL_WEAPON_CATALOG as any);
  pushAll("OFFHAND_MODELS", OFFHAND_MODELS as any);
  pushAll("SPELL_MODELS", SPELL_MODELS as any);
  pushAll("ANIMATION_PACKS", ANIMATION_PACKS as any);

  // ITEM_MODELS is a Record<key, { path, ... }>
  for (const [key, entry] of Object.entries(ITEM_MODELS)) {
    const e = entry as { path?: string };
    if (e?.path) refs.push({ source: "ITEM_MODELS", id: key, path: e.path });
  }

  // WEAPON_TEXTURES is a Record<key, string-path>
  for (const [key, p] of Object.entries(WEAPON_TEXTURES)) {
    if (typeof p === "string" && p.startsWith("/")) {
      refs.push({ source: "WEAPON_TEXTURES", id: key, path: p });
    }
  }

  return refs;
}

export function validateModelManifest(): ValidationResult {
  const refs = collectPaths();
  const seen = new Set<string>();
  const missing: MissingEntry[] = [];

  for (const ref of refs) {
    const key = `${ref.path}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const absolute = path.join(PUBLIC_ROOT, ref.path);
    if (!fs.existsSync(absolute)) {
      missing.push({ source: ref.source, id: ref.id, path: ref.path });
    }
  }

  return {
    ok: missing.length === 0,
    total: seen.size,
    missing,
  };
}

// Bare CLI entrypoint when invoked via tsx.
const isCli = (() => {
  try {
    const argv1 = process.argv[1] ? path.resolve(process.argv[1]) : "";
    return argv1 === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isCli) {
  const result = validateModelManifest();
  console.log(`\n=== ModelRegistry Validation ===`);
  console.log(`Checked ${result.total} unique model paths across registry exports.`);
  if (result.ok) {
    console.log("All referenced models exist on disk.");
    process.exit(0);
  }
  console.log(`\nMissing ${result.missing.length} file(s):`);
  for (const m of result.missing) {
    const tag = m.id ? ` [id=${m.id}]` : "";
    console.log(`  [${m.source}] ${m.path}${tag}`);
  }
  process.exit(1);
}
