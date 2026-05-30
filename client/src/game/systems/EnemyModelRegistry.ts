/**
 * EnemyModelRegistry — maps every EnemyType to a GLB model path + render config.
 *
 * modelPath: path under client/public/ (or full CDN URL).
 * scale:     world-space uniform scale for the model.
 * boneMap:   optional bone rename alias map for non-standard rigs.
 * animPack:  optional BRB animation pack prefix (e.g. "ORC_" loads ORC_*.fbx anims).
 *
 * The CDN root for faction character enemies is https://assets.grudge-studio.com/models/.
 */

import type { EnemyType } from "./EnemyManager";

export interface EnemyModelDef {
  modelPath: string;
  scale: number;
  /** Bone name remaps: { canonical: modelBoneName } */
  boneMap?: Record<string, string>;
  /** BRB animation pack prefix used by useCharacterController */
  animPack?: string;
}

const CDN = "https://assets.grudge-studio.com/models";
/** CDN for faction characters — used for humanoid enemies like dark elves. */
const CHAR_CDN = "https://molochdagod.github.io/ObjectStore/models/factioncharacters";

// Available local enemy models (cultist_armed, big_scary_t2/t3, etc.)
// Available local wildlife: Cow, Horse, Llama, Pig, Pug, Sheep, Zebra
// Available dinosaurs: Apatosaurus, Parasaurolophus, Stegosaurus, Trex, Triceratops, Velociraptor
const LOCAL_ENEMIES = {
  cultist:  "/models/enemies/cultist_armed.glb",
  beast2:   "/models/enemies/big_scary_t2.glb",
  beast3:   "/models/enemies/big_scary_t3.glb",
  dante:    "/models/enemies/dante_beast.glb",
  medusa:   "/models/enemies/medusa.glb",
  pincher:  "/models/enemies/pincher.glb",
  cow:      "/models/wildlife/Cow.glb",
  horse:    "/models/wildlife/Horse.glb",
  pig:      "/models/wildlife/Pig.glb",
  sheep:    "/models/wildlife/Sheep.glb",
};

export const ENEMY_MODEL_REGISTRY: Partial<Record<EnemyType, EnemyModelDef>> = {
  // ── Ground monsters — redirected to local enemy/wildlife/dino models ─────
  skeleton:  { modelPath: LOCAL_ENEMIES.cultist,          scale: 1.0 },
  spider:    { modelPath: LOCAL_ENEMIES.pincher,           scale: 0.7 },
  golem:     { modelPath: LOCAL_ENEMIES.beast3,            scale: 1.8 },
  pirate:    { modelPath: LOCAL_ENEMIES.cultist,           scale: 1.0 },
  witch:     { modelPath: LOCAL_ENEMIES.medusa,            scale: 1.0 },
  ninja:     { modelPath: LOCAL_ENEMIES.cultist,           scale: 1.0 },
  orc:       { modelPath: `${CHAR_CDN}/orc/ORC_Characters_Customizable.glb`, scale: 1.4 },
  demon:     { modelPath: LOCAL_ENEMIES.dante,             scale: 2.0 },
  blue_demon:{ modelPath: LOCAL_ENEMIES.dante,             scale: 1.6 },
  mushroom_king: { modelPath: LOCAL_ENEMIES.beast3,        scale: 2.5 },
  yeti:      { modelPath: LOCAL_ENEMIES.beast3,            scale: 2.2 },
  ghost:     { modelPath: LOCAL_ENEMIES.medusa,            scale: 1.2 },
  frog:      { modelPath: LOCAL_ENEMIES.pincher,           scale: 1.3 },
  blob:      { modelPath: LOCAL_ENEMIES.beast2,            scale: 0.8 },
  cactoro:   { modelPath: LOCAL_ENEMIES.beast2,            scale: 1.3 },
  tribal:    { modelPath: LOCAL_ENEMIES.cultist,           scale: 1.2 },
  bunny:     { modelPath: LOCAL_ENEMIES.pig,               scale: 0.6 },
  alien:     { modelPath: LOCAL_ENEMIES.dante,             scale: 1.8 },

  // ── Dark Elf camp enemies — CDN elf model ───────────────────────────────
  dark_elf:  { modelPath: `${CHAR_CDN}/elf/ELF_Characters_customizable.glb`, scale: 1.0, animPack: "ELF_" },

  // ── Dinosaurs (all exist locally) ────────────────────────────────────────
  dino:         { modelPath: "/models/monsters/dinosaurs/Apatosaurus.glb",    scale: 3.0 },
  raptor:       { modelPath: "/models/monsters/dinosaurs/Velociraptor.glb",   scale: 2.0 },
  trex:         { modelPath: "/models/monsters/dinosaurs/Trex.glb",           scale: 4.5 },
  triceratops:  { modelPath: "/models/monsters/dinosaurs/Triceratops.glb",    scale: 3.5 },

  // ── Flying monsters — use available local enemies ───────────────────────
  dragon:    { modelPath: LOCAL_ENEMIES.dante,             scale: 3.0 },
  armabee:   { modelPath: LOCAL_ENEMIES.pincher,           scale: 1.2 },
  alpaking:  { modelPath: LOCAL_ENEMIES.beast2,            scale: 2.0 },

  // ── Thrower / ranged archetypes ──────────────────────────────────────────
  thrower_brute:     { modelPath: `${CHAR_CDN}/orc/ORC_Characters_Customizable.glb`,  scale: 1.0 },
  thrower_assassin:  { modelPath: LOCAL_ENEMIES.cultist,    scale: 1.0 },
  thrower_soldier:   { modelPath: LOCAL_ENEMIES.cultist,    scale: 1.0 },
  thrower_berserker: { modelPath: LOCAL_ENEMIES.dante,      scale: 1.0 },

  // ── Sci-fi / Advance Wars units (CDN) ────────────────────────────────────
  aw_infantry:    { modelPath: `${CDN}/rts_infantry.glb`,      scale: 1.0 },
  aw_mech:        { modelPath: `${CDN}/rts_mech.glb`,          scale: 1.6 },
  aw_tank:        { modelPath: `${CDN}/rts_tank.glb`,          scale: 2.0 },
  mech_tripod:    { modelPath: `${CDN}/rts_tripod.glb`,        scale: 3.5 },
  scifi_soldier:  { modelPath: `${CDN}/scifi_soldier.glb`,     scale: 1.0 },
  cyborg_unit:    { modelPath: `${CDN}/cyborg_unit.glb`,       scale: 1.4 },
  cyborg_soldier: { modelPath: `${CDN}/cyborg_soldier.glb`,    scale: 1.2 },
  shadow_soldier: { modelPath: `${CDN}/shadow_soldier.glb`,    scale: 1.0 },
  scifi_trooper:  { modelPath: `${CDN}/scifi_trooper.glb`,     scale: 1.0 },
  scifi_officer:  { modelPath: `${CDN}/scifi_officer.glb`,     scale: 1.0 },
};

/** Resolve model def for an enemy type. Returns a local fallback if unknown. */
export function getEnemyModelDef(type: EnemyType): EnemyModelDef {
  return ENEMY_MODEL_REGISTRY[type] ?? {
    modelPath: LOCAL_ENEMIES.beast2,
    scale: 1.0,
  };
}
