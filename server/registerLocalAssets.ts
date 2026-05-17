import { registerAsset } from "./grudge";
import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Asset source boundaries:
//
//   Cloudflare Object Store (molochdagod.github.io/ObjectStore)
//     → Faction character GLBs (GRUDGE6_CDN), animation packs,
//       weapon icons, armor icons, item database.
//     → These are URL-only references in client code.  They are
//       NEVER scanned here because no local file exists for them.
//
//   Cloudflare D1 (via syncObjectStore)
//     → weapons.json / skills.json / materials.json / armor.json
//       / consumables.json from the ObjectStore Worker API.
//     → Synced only in production (syncObjectStore is already guarded).
//
//   Local public/models/* (this file)
//     → GLBs that ship with the repo and are served from Express/Vite.
//     → Registered into asset_registry ONLY in production where the
//       MySQL DB is reachable.  In local dev the DB is either absent or
//       firewalled, so all inserts fail — skip them silently.
// ─────────────────────────────────────────────────────────────────────────────

// Filename prefixes that belong to the Grudge6 CDN faction-character pack.
// These GLBs reference the remote CDN rather than a local path, so even if a
// stale copy exists on disk we must NOT register it against the local DB —
// the canonical record lives in Cloudflare Object Store.
const CDN_ASSET_PREFIXES = [
  "WK_", "BRB_", "ELF_", "DWF_", "ORC_", "UD_",  // faction character rigs
  "grudge6_",                                        // BRB animation packs
];

function isCDNAsset(filename: string): boolean {
  return CDN_ASSET_PREFIXES.some(p => filename.startsWith(p));
}

const MODEL_DIRS = [
  { dir: "client/public/models/characters",       category: "character", type: "character" },
  { dir: "client/public/models/monsters/big",     category: "monster",   type: "enemy" },
  { dir: "client/public/models/monsters/blob",    category: "monster",   type: "enemy" },
  { dir: "client/public/models/monsters/flying",  category: "monster",   type: "enemy" },
  { dir: "client/public/models/monsters/humanoid",category: "monster",   type: "enemy" },
  { dir: "client/public/models/monsters/undead",  category: "monster",   type: "enemy" },
  { dir: "client/public/models/nature",           category: "nature",    type: "environment" },
  { dir: "client/public/models/weapons",          category: "weapon",    type: "weapon" },
  { dir: "client/public/models/buildings",        category: "building",  type: "structure" },
  { dir: "client/public/models/animals",          category: "animal",    type: "npc" },
  // RTS building models are local — register them when DB is reachable
  { dir: "client/public/models/rts_quaternius",   category: "building",  type: "structure" },
];

const BONE_MAPS: Record<string, Record<string, string>> = {
  kaykit: {
    root: "Root",
    hips: "Hips",
    spine: "Torso",
    rightHand: "Fist.R",
    leftHand: "Fist.L",
    head: "Head",
    rightFoot: "Foot.R",
    leftFoot: "Foot.L",
  },
  mixamo: {
    root: "mixamorigHips",
    hips: "mixamorigHips",
    spine: "mixamorigSpine",
    rightHand: "mixamorigRightHand",
    leftHand: "mixamorigLeftHand",
    head: "mixamorigHead",
    rightFoot: "mixamorigRightFoot",
    leftFoot: "mixamorigLeftFoot",
  },
};

// All weapons fall back on the Mixamo glocomotion + glocomotion_combat
// packs after we removed the non-Mixamo packs (sword_shield, racalvin_*,
// ual1/ual2, longbow, rifle_locomotion, magic) whose rest poses
// distorted the player rig during retargeting. This map is unused by
// the current registration loop but kept here so future server-side
// callers have a single source of truth for the per-weapon default.
const ANIMATION_PACKS: Record<string, string> = {
  sword: "glocomotion_combat",
  axe: "glocomotion_combat",
  staff: "glocomotion",
  bow: "glocomotion",
  gun: "glocomotion",
  fists: "glocomotion_combat",
  greatsword: "glocomotion_combat",
};

export async function registerLocalAssets() {
  // Mirror the same local-dev guard used by syncObjectStore():
  // The MySQL DB (and Cloudflare D1) are only reachable from production
  // (Railway) or via an explicit tunnel.  Skipping here prevents the
  // flood of "asset_registry insert failed" noise on every `npm run dev`.
  if (process.env.NODE_ENV !== "production" && !process.env.OBJECT_STORE_BASE) {
    console.log("[grudge] Local asset registration skipped in local dev (set OBJECT_STORE_BASE to enable)");
    return 0;
  }

  let registered = 0;
  let skippedCDN = 0;

  for (const { dir, category, type } of MODEL_DIRS) {
    const absDir = path.resolve(dir);
    if (!fs.existsSync(absDir)) continue;

    const files = fs.readdirSync(absDir)
      .filter((f) => f.endsWith(".glb") || f.endsWith(".gltf"));

    for (const file of files) {
      // Skip any file that belongs to the Cloudflare Object Store CDN.
      // These assets are authoritative in ObjectStore; the local copy (if
      // any) is a dev-time convenience and must not shadow the CDN record.
      if (isCDNAsset(file)) {
        skippedCDN++;
        continue;
      }

      const id = `${category}_${path.basename(file, path.extname(file))}`.toLowerCase().replace(/\s+/g, "_");
      const name = path.basename(file, path.extname(file)).replace(/_/g, " ");
      // Derive a clean /models/... path that matches what Express/Vite serves
      const modelBase = dir.includes("models/") ? dir.split("models/")[1] : dir;
      const localPath = `/models/${modelBase}/${file}`;
      const format = path.extname(file).slice(1);

      const isKayKit = category === "character";
      const boneMap = isKayKit ? BONE_MAPS.kaykit : {};

      let animationPack: string | undefined;
      if (type === "character") {
        animationPack = "glocomotion_combat";
      }

      await registerAsset({
        id, category, name, type,
        localPath, format, boneMap, animationPack,
        metadata: { source: "local", originalFile: file },
      });
      registered++;
    }
  }

  console.log(`[grudge] Registered ${registered} local assets (${skippedCDN} CDN assets skipped — managed by ObjectStore)`);
  return registered;
}
