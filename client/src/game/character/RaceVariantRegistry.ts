/**
 * RaceVariantRegistry — pre-built Grudge6 character variant GLBs.
 *
 * Variants are produced by the variant-pipeline (FBX → intermediate GLB →
 * per-loadout GLB). The `horse` variant is the mounted cavalry preset:
 * rider + mount mesh baked into one skinned GLB per race.
 *
 * Mount types by race:
 *   WK, BRB, ELF, UD — horse
 *   DWF — war ram
 *   ORC — war wolf
 */

import { getRaceConfig, type RaceConfig } from "./FactionCharacterRegistry";

const VARIANTS_BASE = "/models/grudge6/variants";

/** Preset loadout variants (foot + mounted). */
export type RaceVariantKey =
  | "knight"
  | "wizard"
  | "bow"
  | "hammer_simple"
  | "horse";

export type MountCreature = "horse" | "ram" | "wolf" | "skeletal_horse";

/** Race key → file prefix used in variant GLB names. */
const RACE_VARIANT_PREFIX: Record<string, string> = {
  human: "WK",
  barbarian: "BRB",
  elf: "ELF",
  dwarf: "DWF",
  orc: "ORC",
  undead: "UD",
  worge: "WK",
};

const MOUNT_CREATURE: Record<string, MountCreature> = {
  human: "horse",
  barbarian: "horse",
  elf: "horse",
  dwarf: "ram",
  orc: "wolf",
  undead: "skeletal_horse",
};

export interface MountedVariantInfo {
  /** Pre-baked mounted rider+mount GLB. */
  glbPath: string;
  /** Full cavalry source GLB (all equipment meshes present). */
  cavalryGlbPath: string;
  /** Runtime FBX fallback (preserves textures). */
  cavalryFbxPath: string;
  mountCreature: MountCreature;
  label: string;
}

function variantPrefix(raceKey: string): string | null {
  return RACE_VARIANT_PREFIX[raceKey] ?? null;
}

/** Local path for a preset variant GLB, or null if the race has no variants. */
export function getVariantGlb(raceKey: string, variant: RaceVariantKey): string | null {
  const pfx = variantPrefix(raceKey);
  if (!pfx) return null;
  return `${VARIANTS_BASE}/${pfx}_${variant}.glb`;
}

/** Mounted cavalry variant GLB for a race (the `horse` preset). */
export function getMountedVariantGlb(raceKey: string): string | null {
  return getVariantGlb(raceKey, "horse");
}

/** Cavalry GLB path under /models/grudge6/<race>/. */
export function getCavalryGlb(raceKey: string): string | null {
  const cfg = getRaceConfig(raceKey);
  if (!cfg?.cavalryFbx) return null;
  return cfg.cavalryFbx.replace(/\.fbx$/i, ".glb");
}

/** Full mounted-variant metadata for UI + loaders. */
export function getMountedVariantInfo(raceKey: string): MountedVariantInfo | null {
  const cfg = getRaceConfig(raceKey);
  const glbPath = getMountedVariantGlb(raceKey);
  if (!cfg?.cavalryFbx || !glbPath) return null;

  const creature = MOUNT_CREATURE[raceKey] ?? "horse";
  const labels: Record<MountCreature, string> = {
    horse: "Warhorse",
    ram: "War Ram",
    wolf: "War Wolf",
    skeletal_horse: "Skeletal Steed",
  };

  return {
    glbPath,
    cavalryGlbPath: getCavalryGlb(raceKey)!,
    cavalryFbxPath: cfg.cavalryFbx,
    mountCreature: creature,
    label: labels[creature],
  };
}

/**
 * Resolve the character model path for the current mount state.
 * Mounted riders use the pre-baked `horse` variant GLB; foot soldiers
 * use the race FBX (texture fidelity) unless an explicit variant is set.
 */
export function resolveCharacterModelPath(
  raceKey: string,
  opts: {
    mounted?: boolean;
    variant?: RaceVariantKey;
    /** Prefer GLB over FBX for foot models (preview / CDN). */
    preferGlb?: boolean;
  } = {},
): string | null {
  const cfg = getRaceConfig(raceKey);
  if (!cfg) return null;

  if (opts.mounted) {
    return getMountedVariantGlb(raceKey) ?? cfg.cavalryFbx ?? null;
  }

  if (opts.variant) {
    const variantPath = getVariantGlb(raceKey, opts.variant);
    if (variantPath) return variantPath;
  }

  if (opts.preferGlb) {
    const pfx = variantPrefix(raceKey);
    if (pfx) {
      const raceFolder = raceKey === "human" ? "wk"
        : raceKey === "barbarian" ? "brb"
        : raceKey === "elf" ? "elf"
        : raceKey === "dwarf" ? "dwf"
        : raceKey === "orc" ? "orc"
        : raceKey === "undead" ? "ud"
        : "wk";
      return `/models/grudge6/${raceFolder}/${pfx}_Characters.glb`;
    }
  }

  return cfg.fbxModel;
}

/** All mounted variants that have been built for the 6 core races. */
export function getAllMountedVariants(): Array<{ raceKey: string; config: RaceConfig; info: MountedVariantInfo }> {
  const races = ["human", "barbarian", "elf", "dwarf", "orc", "undead"] as const;
  const out: Array<{ raceKey: string; config: RaceConfig; info: MountedVariantInfo }> = [];
  for (const raceKey of races) {
    const cfg = getRaceConfig(raceKey);
    const info = getMountedVariantInfo(raceKey);
    if (cfg && info) out.push({ raceKey, config: cfg, info });
  }
  return out;
}