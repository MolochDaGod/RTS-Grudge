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

export const ENEMY_MODEL_REGISTRY: Partial<Record<EnemyType, EnemyModelDef>> = {
  // ── Ground monsters (blob pack) ──────────────────────────────────────────
  skeleton:  { modelPath: "/models/monsters/big/Orc.glb",             scale: 1.0 },
  spider:    { modelPath: "/models/monsters/blob/GreenSpikyBlob.glb",  scale: 0.7 },
  golem:     { modelPath: "/models/monsters/big/Yeti.glb",             scale: 1.8 },
  pirate:    { modelPath: "/models/monsters/big/Orc.glb",              scale: 1.0 },
  witch:     { modelPath: "/models/monsters/blob/Wizard.glb",          scale: 1.0 },
  ninja:     { modelPath: "/models/monsters/big/Ninja.glb",            scale: 1.0 },
  orc:       { modelPath: "/models/monsters/big/Orc.glb",              scale: 1.4 },
  demon:     { modelPath: "/models/monsters/big/Demon.glb",            scale: 2.0 },
  blue_demon:{ modelPath: "/models/monsters/flying/Demon.glb",         scale: 1.6 },
  mushroom_king: { modelPath: "/models/monsters/big/MushroomKing.glb", scale: 2.5 },
  yeti:      { modelPath: "/models/monsters/big/Yeti.glb",             scale: 2.2 },
  ghost:     { modelPath: "/models/monsters/flying/Ghost.glb",         scale: 1.2 },
  frog:      { modelPath: "/models/monsters/big/Frog.glb",             scale: 1.3 },
  blob:      { modelPath: "/models/monsters/blob/GreenBlob.glb",       scale: 0.8 },
  cactoro:   { modelPath: "/models/monsters/big/Cactoro.glb",          scale: 1.3 },
  tribal:    { modelPath: "/models/monsters/big/Tribal.glb",           scale: 1.2 },
  bunny:     { modelPath: "/models/monsters/blob/Cat.glb",             scale: 0.6 },
  alien:     { modelPath: "/models/monsters/big/Alien.glb",            scale: 1.8 },

  // ── Dark Elf camp enemies (replace pirate camps) ─────────────────────────
  // Uses CDN faction elf models; fallback to Ninja for local dev
  dark_elf:  { modelPath: `${CDN}/ELF_ranger.glb`,       scale: 1.0, animPack: "ELF_" },

  // ── Dinosaurs ────────────────────────────────────────────────────────────
  dino:         { modelPath: "/models/monsters/dinosaurs/Apatosaurus.glb",    scale: 3.0 },
  raptor:       { modelPath: "/models/monsters/dinosaurs/Velociraptor.glb",   scale: 2.0 },
  trex:         { modelPath: "/models/monsters/dinosaurs/Trex.glb",           scale: 4.5 },
  triceratops:  { modelPath: "/models/monsters/dinosaurs/Triceratops.glb",    scale: 3.5 },

  // ── Flying monsters ──────────────────────────────────────────────────────
  dragon:    { modelPath: "/models/monsters/flying/Dragon_Evolved.glb",       scale: 3.0 },
  armabee:   { modelPath: "/models/monsters/flying/Armabee.glb",              scale: 1.2 },
  alpaking:  { modelPath: "/models/monsters/flying/Alpaking.glb",             scale: 2.0 },

  // ── Thrower / ranged archetypes ──────────────────────────────────────────
  // Reuse existing character-size monsters with different colors (tint at render time)
  thrower_brute:     { modelPath: "/models/monsters/big/Orc.glb",     scale: 1.0 },
  thrower_assassin:  { modelPath: "/models/monsters/big/Ninja.glb",   scale: 1.0 },
  thrower_soldier:   { modelPath: "/models/monsters/big/Tribal.glb",  scale: 1.0 },
  thrower_berserker: { modelPath: "/models/monsters/big/Demon.glb",   scale: 1.0 },

  // ── Sci-fi / Advance Wars units (CDN) ────────────────────────────────────
  aw_infantry:    { modelPath: `${CDN}/rts_infantry.glb`,      scale: 1.0 },
  aw_mech:        { modelPath: `${CDN}/rts_mech.glb`,          scale: 1.6 },
  aw_tank:        { modelPath: `${CDN}/rts_tank.glb`,          scale: 2.0 },
  mech_tripod:    { modelPath: `${CDN}/rts_tripod.glb`,        scale: 3.5 },
  scifi_soldier:  { modelPath: `${CDN}/scifi_soldier.glb`,     scale: 1.0 },
  cyborg_unit:    { modelPath: `${CDN}/cyborg_unit.glb`,       scale: 1.4 },
  cyborg_soldier: { modelPath: `${CDN}/cyborg_soldier.glb`,   scale: 1.2 },
  shadow_soldier: { modelPath: `${CDN}/shadow_soldier.glb`,   scale: 1.0 },
  scifi_trooper:  { modelPath: `${CDN}/scifi_trooper.glb`,    scale: 1.0 },
  scifi_officer:  { modelPath: `${CDN}/scifi_officer.glb`,    scale: 1.0 },
};

/** Resolve model def for an enemy type. Returns a fallback blob if unknown. */
export function getEnemyModelDef(type: EnemyType): EnemyModelDef {
  return ENEMY_MODEL_REGISTRY[type] ?? {
    modelPath: "/models/monsters/blob/GreenBlob.glb",
    scale: 1.0,
  };
}
