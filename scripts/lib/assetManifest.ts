import crypto from "node:crypto";
import path from "node:path";

import {
  ALL_CHARACTER_MODELS,
  ALL_WEAPON_CATALOG,
} from "../../client/src/game/systems/ModelRegistry";

const HUMAN_BASELINE_METERS = 2.0;

const CHARACTER_BY_PATH = new Map(
  ALL_CHARACTER_MODELS.map((entry) => [normalizeRegistryPath(entry.path), entry]),
);

const WEAPON_BY_PATH = new Map(
  ALL_WEAPON_CATALOG.map((entry) => [normalizeRegistryPath(entry.path), entry]),
);

const WEAPON_SOURCE_SETS = new Set([
  "weapons",
  "weapon_pack",
  "kaykit_weapons",
  "weapons_quaternius",
]);

const BUILDING_SOURCE_SETS = new Set([
  "encampment",
  "fortress",
  "raft",
  "rts",
  "rts_quaternius",
  "structures",
  "styloo_village",
  "village_quaternius",
]);

const TERRAIN_SOURCE_SETS = new Set([
  "modular_terrain",
  "pirate_islands",
  "tutorial_island",
]);

const UNIVERSAL_WEAPON_SKELETONS = [
  "mixamo",
  "cc4",
  "generic",
  "legacy",
  "rts_toon",
  "kaykit",
];

const WEAPON_REAL_SIZES: Record<string, number> = {
  sword: 0.85,
  greatsword: 1.3,
  axe: 0.75,
  poleaxe: 1.6,
  hammer: 0.8,
  dagger: 0.35,
  staff: 1.5,
  wand: 0.45,
  bow: 1.1,
  crossbow: 0.7,
  gun: 0.6,
  shield: 0.6,
  cane: 0.9,
  arrow: 0.7,
};

export interface AssetRegistryMetadata {
  version: 1;
  sourceSet: string | null;
  format: string;
  mimeType: string;
  sourceHash: string;
  sourcePath: string;
  scaleProfile: string | null;
  baselineHumanMeters: number;
  recommendedTargetMeters: number | null;
  attachmentProfile: string | null;
  supportedSkeletons: string[] | null;
  weaponType: string | null;
}

export interface ManifestEntry {
  id: string;
  grudgeUuid: string;
  name: string;
  r2Key: string;
  cdnUrl: string;
  category: string;
  boneMap: string | null;
  animationPacks: string[] | null;
  fileSize: number;
  metadata: AssetRegistryMetadata;
}

interface BuildManifestEntryOptions {
  r2Key: string;
  cdnBase: string;
  fileSize: number;
  sourceHash: string;
}

function normalizeRegistryPath(assetPath: string): string {
  return assetPath.replace(/^\/+/, "");
}

function buildDeterministicUuid(seed: string): string {
  const bytes = crypto.createHash("sha1").update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function mimeTypeForExt(ext: string): string {
  const map: Record<string, string> = {
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".fbx": "application/octet-stream",
    ".ktx2": "image/ktx2",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".json": "application/json",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
  };
  return map[ext.toLowerCase()] ?? "application/octet-stream";
}

function detectSourceSet(parts: string[]): string | null {
  if (parts[0] === "models") return parts[1] ?? null;
  return parts[0] ?? null;
}

function detectBoneMap(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (
    lower.includes("orc") ||
    lower.includes("undead") ||
    lower.includes("human") ||
    lower.includes("battle_mage") ||
    lower.includes("night_stalker") ||
    lower.includes("elf") ||
    lower.includes("dwarf") ||
    lower.includes("assassin") ||
    lower.includes("vampire") ||
    lower.includes("werewolf") ||
    lower.includes("lizard") ||
    lower.includes("goblin")
  ) {
    return "mixamo";
  }
  if (lower.includes("kaykit") || lower.includes("kaykit_")) return "kaykit";
  return null;
}

function detectAnimationPacks(r2Key: string): string[] | null {
  if (!r2Key.startsWith("models/characters/")) return null;
  return ["glocomotion", "glocomotion_combat", "gestures_basic"];
}

function detectWeaponType(
  r2Key: string,
  fileStem: string,
): string | null {
  const registryEntry = WEAPON_BY_PATH.get(r2Key);
  if (registryEntry?.weaponType) return registryEntry.weaponType;

  const lower = fileStem.toLowerCase();
  if (/(arrow|bolt)/.test(lower)) return "arrow";
  if (/shield/.test(lower)) return "shield";
  if (/crossbow/.test(lower)) return "crossbow";
  if (/(rifle|revolver|pistol|luger|gun|machine)/.test(lower)) return "gun";
  if (/bow/.test(lower)) return "bow";
  if (/wand/.test(lower)) return "wand";
  if (/(staff|quarterstaff)/.test(lower)) return "staff";
  if (/(spear|halberd|poleaxe|pitchfork)/.test(lower)) return "poleaxe";
  if (/(great_sword|greatsword|zweihander|two_hand|2h)/.test(lower)) return "greatsword";
  if (/(dagger|shiv|knife|kukri)/.test(lower)) return "dagger";
  if (/(hammer|mace|club|maul)/.test(lower)) return "hammer";
  if (/axe/.test(lower)) return "axe";
  if (/sword/.test(lower)) return "sword";
  return null;
}

function isWeaponLike(sourceSet: string | null, fileStem: string, r2Key: string): boolean {
  if (WEAPON_BY_PATH.has(r2Key)) return true;
  if (sourceSet && WEAPON_SOURCE_SETS.has(sourceSet)) return true;
  return !!detectWeaponType(r2Key, fileStem);
}

function detectCategory(r2Key: string, sourceSet: string | null, fileStem: string): string {
  const parts = r2Key.split("/");
  if (parts[0] === "textures") return "texture";
  if (parts[0] === "sounds") return "audio";
  if (parts[0] === "fonts") return "font";
  if (parts[0] !== "models") return "asset";

  if (sourceSet === "characters" || sourceSet === "medieval_people") return "character";
  if (sourceSet === "monsters") return "monster";
  if (sourceSet === "animations") return "animation";
  if (sourceSet === "spells") return "spell";
  if (sourceSet === "items" || sourceSet === "rpg_items") return "item";
  if (sourceSet && BUILDING_SOURCE_SETS.has(sourceSet)) return "building";
  if (sourceSet && TERRAIN_SOURCE_SETS.has(sourceSet)) return "terrain";
  if (isWeaponLike(sourceSet, fileStem, r2Key)) return "weapon";
  return "environment";
}

function detectAttachmentProfile(
  category: string,
  r2Key: string,
  fileStem: string,
  weaponType: string | null,
): string | null {
  if (category !== "weapon") return null;
  const lower = fileStem.toLowerCase();

  if (/(quiver|arrow_bag|backpack)/.test(lower)) return "back_accessory";
  if (/(arrow|bolt)/.test(lower)) return "ammo";
  if (r2Key.includes("/offhand/") || weaponType === "shield") return "off_hand";
  if (weaponType === "bow" || weaponType === "crossbow" || weaponType === "gun") return "ranged_2h";
  if (weaponType === "greatsword" || weaponType === "poleaxe" || weaponType === "staff") return "two_hand";
  return "main_hand";
}

function detectSupportedSkeletons(
  category: string,
  boneMap: string | null,
  attachmentProfile: string | null,
): string[] | null {
  if (category === "weapon" && attachmentProfile) return UNIVERSAL_WEAPON_SKELETONS;
  if (category === "animation") return ["mixamo", "cc4", "generic", "legacy", "rts_toon"];
  if ((category === "character" || category === "monster") && boneMap) return [boneMap];
  if (category === "character" || category === "monster") return ["generic"];
  return null;
}

function detectRecommendedTargetMeters(
  category: string,
  r2Key: string,
  sourceSet: string | null,
  weaponType: string | null,
): number | null {
  if (category === "weapon" && weaponType) {
    return WEAPON_REAL_SIZES[weaponType] ?? null;
  }

  if (category === "character") {
    return CHARACTER_BY_PATH.get(r2Key)?.defaultHeight ?? HUMAN_BASELINE_METERS;
  }

  if (category === "monster") {
    const characterEntry = CHARACTER_BY_PATH.get(r2Key);
    if (characterEntry?.enemyScale?.height) return characterEntry.enemyScale.height;
    return characterEntry?.defaultHeight ?? null;
  }

  if (sourceSet === "medieval_people") return HUMAN_BASELINE_METERS;
  return null;
}

function detectScaleProfile(category: string): string | null {
  switch (category) {
    case "character":
      return "humanoid_relative_to_2m";
    case "monster":
      return "creature_relative_to_2m";
    case "weapon":
      return "weapon_real_size";
    case "animation":
      return "animation_clip";
    case "spell":
      return "effect_scale";
    case "item":
      return "handheld_prop";
    case "terrain":
    case "building":
    case "environment":
      return "world_static";
    default:
      return null;
  }
}

export function buildManifestEntry({
  r2Key,
  cdnBase,
  fileSize,
  sourceHash,
}: BuildManifestEntryOptions): ManifestEntry {
  const normalizedKey = r2Key.replace(/\\/g, "/");
  const parts = normalizedKey.split("/");
  const sourceSet = detectSourceSet(parts);
  const ext = path.posix.extname(normalizedKey).toLowerCase();
  const fileName = path.posix.basename(normalizedKey);
  const fileStem = fileName.replace(/\.[^.]+$/, "");
  const boneMap = detectBoneMap(fileName);
  const animationPacks = detectAnimationPacks(normalizedKey);
  const weaponType = detectWeaponType(normalizedKey, fileStem);
  const category = detectCategory(normalizedKey, sourceSet, fileStem);
  const attachmentProfile = detectAttachmentProfile(category, normalizedKey, fileStem, weaponType);
  const supportedSkeletons = detectSupportedSkeletons(category, boneMap, attachmentProfile);
  const recommendedTargetMeters = detectRecommendedTargetMeters(category, normalizedKey, sourceSet, weaponType);
  const metadata: AssetRegistryMetadata = {
    version: 1,
    sourceSet,
    format: ext.replace(/^\./, ""),
    mimeType: mimeTypeForExt(ext),
    sourceHash,
    sourcePath: normalizedKey,
    scaleProfile: detectScaleProfile(category),
    baselineHumanMeters: HUMAN_BASELINE_METERS,
    recommendedTargetMeters,
    attachmentProfile,
    supportedSkeletons,
    weaponType,
  };

  return {
    id: normalizedKey.replace(/[/.]/g, "_").replace(/_{2,}/g, "_"),
    grudgeUuid: buildDeterministicUuid(`grudge-asset:${normalizedKey}`),
    name: fileStem,
    r2Key: normalizedKey,
    cdnUrl: `${cdnBase}/${normalizedKey}`,
    category,
    boneMap,
    animationPacks,
    fileSize,
    metadata,
  };
}
