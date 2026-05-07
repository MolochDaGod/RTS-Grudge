import { registerAsset } from "./grudge";
import fs from "fs";
import path from "path";

const MODEL_DIRS = [
  { dir: "client/public/models/characters", category: "character", type: "character" },
  { dir: "client/public/models/monsters/big", category: "monster", type: "enemy" },
  { dir: "client/public/models/monsters/blob", category: "monster", type: "enemy" },
  { dir: "client/public/models/monsters/flying", category: "monster", type: "enemy" },
  { dir: "client/public/models/monsters/humanoid", category: "monster", type: "enemy" },
  { dir: "client/public/models/monsters/undead", category: "monster", type: "enemy" },
  { dir: "client/public/models/nature", category: "nature", type: "environment" },
  { dir: "client/public/models/weapons", category: "weapon", type: "weapon" },
  { dir: "client/public/models/buildings", category: "building", type: "structure" },
  { dir: "client/public/models/animals", category: "animal", type: "npc" },
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
  let registered = 0;

  for (const { dir, category, type } of MODEL_DIRS) {
    const absDir = path.resolve(dir);
    if (!fs.existsSync(absDir)) continue;

    const files = fs.readdirSync(absDir).filter((f) => f.endsWith(".glb") || f.endsWith(".gltf"));

    for (const file of files) {
      const id = `${category}_${path.basename(file, path.extname(file))}`.toLowerCase().replace(/\s+/g, "_");
      const name = path.basename(file, path.extname(file)).replace(/_/g, " ");
      const localPath = `/models/${dir.split("models/")[1]}/${file}`;
      const format = path.extname(file).slice(1);

      const isKayKit = category === "character";
      const boneMap = isKayKit ? BONE_MAPS.kaykit : {};

      let animationPack: string | undefined;
      if (type === "character") {
        animationPack = "glocomotion_combat";
      }

      await registerAsset({
        id,
        category,
        name,
        type,
        localPath,
        format,
        boneMap,
        animationPack,
        metadata: { source: "local", originalFile: file },
      });
      registered++;
    }
  }

  console.log(`[grudge] Registered ${registered} local assets`);
  return registered;
}
