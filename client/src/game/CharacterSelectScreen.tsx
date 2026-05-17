import { useState, useRef, Suspense, useEffect, useMemo, useCallback } from "react";
import { SceneErrorBoundary } from "./components/SceneErrorBoundary";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls, Text } from "@react-three/drei";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { useAsset } from "./hooks/useAsset";
import { isRestPoseClipName } from "./hooks/useCharacterModel";
import { AssetLoaderInit } from "./systems/AssetLoaderInit";
import { useGame, CharacterConfig, MaterialColors, WeaponType, CombatClass } from "@/lib/stores/useGame";
import { FACTIONS, DEFAULT_FACTION, getFaction, type FactionId } from "@/lib/data/factions";
import { ALL_CHARACTER_MODELS } from "./systems/ModelRegistry";
import { kickoffHeroForgePreload } from "./heroForge/preload";
import { kickoffIntroAnimPreload } from "./intro/preload";
import {
  RIGHT_HAND_ALIASES, LEFT_HAND_ALIASES,
  UPPER_ARM_R_ALIASES, UPPER_ARM_L_ALIASES,
  FOREARM_R_ALIASES, FOREARM_L_ALIASES,
  SHOULDER_R_ALIASES, SHOULDER_L_ALIASES,
  HEAD_ALIASES, SPINE2_ALIASES,
  RIGHT_FOOT_ALIASES, LEFT_FOOT_ALIASES,
  findBoneByAlias, findBoneByAliasFromList, findBoneNameByAlias,
  retargetClips,
} from "./systems/BoneAliases";
import { useSurvival } from "@/lib/stores/useSurvival";
import { useInventory } from "@/lib/stores/useInventory";
import { useCharacterStats } from "@/lib/stores/useCharacterStats";
import { useEnemyManager } from "./systems/EnemyManager";
import { buildProceduralWeaponGroup as buildProceduralWeaponGroupShared } from "./components/WeaponMesh";
import { loadWeaponModel, getWeaponDimensions, getAvailableModels, WEAPON_REAL_SIZES } from "./components/WeaponModelLoader";
import { setPlayerBones } from "./systems/playerBones";
import {
  detectBodyParts, applyBodyMorph, detectSkeletonType,
  type ModelAnalysis, type MaterialCategory, type BodyMorphConfig, type BodyPartBones,
  type WeaponOffsetConfig,
  DEFAULT_BODY_MORPH, DEFAULT_WEAPON_OFFSET,
  getWeaponGripProfile, getGripLabel, getWeaponPairDescription,
  computeWeaponTransform, buildWeaponGripData,
  type GripStyle, type SkeletonType, type GripTransform,
} from "./systems/BoneAliases";
import { computeSkinnedBounds, normalizeCharacterHeight } from "./systems/BoundsUtils";
import {
  cloneWeaponOffset,
  useWeaponOffsetPresetsStore,
  weaponOffsetComboKey,
  writeWeaponOffsetPresetsStore as writeWeaponOffsetPresets,
  type WeaponOffsetPresetsStore,
} from "./systems/weaponOffsetPresets";
import {
  ANIMATION_PACKS, getAllAnimationPacks, getRecommendedAnimPacks,
  WEAPON_ANIM_MAPPING, ALL_WEAPON_CATALOG, WEAPON_TEXTURES,
  ARROW_MODELS, BACK_ACCESSORIES, getBackAccessoryModel, getDefaultWeaponModelId,
  type AnimationPackEntry, type WeaponModelEntry, type WeaponAnimMapping,
} from "./systems/ModelRegistry";
import { loadAsset } from "./systems/AssetLoader";

interface CharacterDef {
  id: string;
  name: string;
  modelPath: string;
  description: string;
  baseHeight: number;
  defaultClass: CombatClass;
  defaultWeaponRight: WeaponType;
  defaultWeaponLeft: WeaponType | null;
  materialMap: Record<string, keyof MaterialColors>;
}

const MATERIAL_CLASSIFY: Record<string, keyof MaterialColors> = {
  "Skin": "skin", "Face": "skin", "Teeth": "skin",
  "Hair": "hair", "Hat": "hat",
  "Armor": "armor", "Armor_Dark": "armor", "Main": "armor",
  "Clothes": "clothing", "Shirt": "clothing", "Top": "clothing", "Tunic": "clothing", "Cape": "clothing", "Cloak": "clothing",
  "Pants": "pants", "Legs": "pants", "Trousers": "pants", "Skirt": "pants", "Greaves": "pants", "Boots": "pants", "Leggings": "pants",
  "Belt": "detail", "Beige": "clothing", "Brown": "clothing", "Black": "clothing", "Light": "clothing",
  "Gold": "detail", "Detail": "detail", "Red": "detail",
};

const BASE_CHARACTER: CharacterDef = {
  id: "hero", name: "Hero", modelPath: "",
  description: "Modular base character. Fully customizable appearance, class, and equipment.",
  baseHeight: 1.8, defaultClass: "melee", defaultWeaponRight: "sword", defaultWeaponLeft: "shield", materialMap: {},
};

// Faction is now determined entirely by race (the model registry). The hero
// forge no longer offers a separate faction picker — picking your race picks
// your banner. Returns a guaranteed-valid FactionId for HUD/colors.
const VALID_FACTION_IDS: ReadonlySet<string> = new Set(FACTIONS.map(f => f.id));
function getFactionForModel(modelPath: string | undefined | null): FactionId {
  if (!modelPath) return DEFAULT_FACTION;
  const entry = ALL_CHARACTER_MODELS.find(m => m.path === modelPath);
  if (entry?.faction && VALID_FACTION_IDS.has(entry.faction)) {
    return entry.faction as FactionId;
  }
  return DEFAULT_FACTION;
}

interface StylePreset {
  id: string;
  name: string;
  icon: string;
  category: "warrior" | "magic" | "ranged" | "tank";
  combatClass: CombatClass;
  weaponRight: WeaponType;
  weaponLeft: WeaponType | null;
  matColors: Partial<MaterialColors>;
  bodyMorph?: Partial<BodyMorphConfig>;
  description: string;
  modelPath?: string;
}

const STYLE_PRESETS: StylePreset[] = [
  { id: "elf_m", name: "Elf (M)", icon: "\uD83C\uDFF9", category: "ranged", combatClass: "ranger",
    weaponRight: "bow", weaponLeft: null, description: "Woodland archer. Swift longbow shots.",
    modelPath: "/models/characters/elf-male.glb",
    matColors: { clothing: "#33aa44", pants: "#2d5a27", hair: "#e6c35c" } },
  { id: "elf_f", name: "Elf (F)", icon: "\uD83C\uDFF9", category: "ranged", combatClass: "ranger",
    weaponRight: "bow", weaponLeft: null, description: "Woodland archer. Swift longbow shots.",
    modelPath: "/models/characters/elf-female.glb",
    matColors: { clothing: "#33aa44", pants: "#2d5a27", hair: "#e6c35c" } },
  { id: "assassin_m", name: "Human (M)", icon: "\uD83E\uDD77", category: "ranged", combatClass: "melee",
    weaponRight: "dagger", weaponLeft: "dagger", description: "Hooded human duelist. Twin daggers.",
    modelPath: "/models/characters/assassin-male.glb",
    matColors: { clothing: "#222222", pants: "#1a1a1a", hat: "#222222" }, bodyMorph: { muscle: 0.85 } },
  { id: "assassin_f", name: "Human (F)", icon: "\uD83E\uDD77", category: "ranged", combatClass: "melee",
    weaponRight: "dagger", weaponLeft: "dagger", description: "Hooded human duelist. Twin daggers.",
    modelPath: "/models/characters/assassin-female.glb",
    matColors: { clothing: "#222222", pants: "#1a1a1a", hat: "#222222" }, bodyMorph: { muscle: 0.85 } },
  { id: "orc_scout_m", name: "Orc (M)", icon: "\uD83E\uDDCC", category: "warrior", combatClass: "melee",
    weaponRight: "axe", weaponLeft: null, description: "Greenskin raider. Brutal axe strikes.",
    modelPath: "/models/characters/orc_scout-male.glb",
    matColors: { skin: "#5a8a4a", clothing: "#5c3317", pants: "#3b2210" },
    bodyMorph: { muscle: 1.4, shoulderWidth: 1.3 } },
  { id: "orc_scout_f", name: "Orc (F)", icon: "\uD83E\uDDCC", category: "warrior", combatClass: "melee",
    weaponRight: "axe", weaponLeft: null, description: "Greenskin raider. Brutal axe strikes.",
    modelPath: "/models/characters/orc_scout-female.glb",
    matColors: { skin: "#5a8a4a", clothing: "#5c3317", pants: "#3b2210" },
    bodyMorph: { muscle: 1.3, shoulderWidth: 1.2 } },
  { id: "vampire_aristocrat_m", name: "Undead (M)", icon: "\uD83E\uDDDB", category: "magic", combatClass: "caster",
    weaponRight: "wand", weaponLeft: null, description: "Vampire aristocrat. Pale-blooded sorcerer.",
    modelPath: "/models/characters/vampire_aristocrat-male.glb",
    matColors: { clothing: "#2a1a2a", pants: "#1a1a1a", detail: "#cc3333", hair: "#1a1a1a", skin: "#e8d8d8" } },
  { id: "vampire_aristocrat_f", name: "Undead (F)", icon: "\uD83E\uDDDB", category: "magic", combatClass: "caster",
    weaponRight: "wand", weaponLeft: null, description: "Vampire aristocrat. Pale-blooded sorceress.",
    modelPath: "/models/characters/vampire_aristocrat-female.glb",
    matColors: { clothing: "#2a1a2a", pants: "#1a1a1a", detail: "#cc3333", hair: "#1a1a1a", skin: "#e8d8d8" } },
  { id: "dwarf_m", name: "Dwarf (M)", icon: "\u26CF\uFE0F", category: "warrior", combatClass: "melee",
    weaponRight: "hammer", weaponLeft: "shield", description: "Mountain warrior. Hammer & shield.",
    modelPath: "/models/characters/dwarf-male.glb",
    matColors: { clothing: "#8B4513", armor: "#888899", hair: "#aa3322" },
    bodyMorph: { muscle: 1.5, shoulderWidth: 1.3, legLength: 0.85 } },
  { id: "dwarf_f", name: "Dwarf (F)", icon: "\u26CF\uFE0F", category: "warrior", combatClass: "melee",
    weaponRight: "hammer", weaponLeft: "shield", description: "Mountain warrior. Hammer & shield.",
    modelPath: "/models/characters/dwarf-female.glb",
    matColors: { clothing: "#8B4513", armor: "#888899", hair: "#aa3322" },
    bodyMorph: { muscle: 1.3, shoulderWidth: 1.2, legLength: 0.85 } },
  { id: "goblin_m", name: "Goblin Backstabber (M)", icon: "\uD83D\uDDE1\uFE0F", category: "ranged", combatClass: "melee",
    weaponRight: "dagger", weaponLeft: null, description: "Sneaky cutpurse. Backstab specialist.",
    modelPath: "/models/characters/goblin_backstabber-male.glb",
    matColors: { skin: "#5a8a4a", clothing: "#5c3317", pants: "#3b2210" },
    bodyMorph: { muscle: 0.7, legLength: 0.85 } },
  { id: "goblin_f", name: "Goblin Backstabber (F)", icon: "\uD83D\uDDE1\uFE0F", category: "ranged", combatClass: "melee",
    weaponRight: "dagger", weaponLeft: null, description: "Sneaky cutpurse. Backstab specialist.",
    modelPath: "/models/characters/goblin_backstabber-female.glb",
    matColors: { skin: "#5a8a4a", clothing: "#5c3317", pants: "#3b2210" },
    bodyMorph: { muscle: 0.7, legLength: 0.85 } },
  { id: "battle_mage_m", name: "Battle Mage (M)", icon: "\u2728", category: "magic", combatClass: "caster",
    weaponRight: "staff", weaponLeft: null, description: "Armored spellblade. Staff caster.",
    modelPath: "/models/characters/human_battle_mage-male.glb",
    matColors: { clothing: "#3355cc", armor: "#888899", detail: "#ccaa33" } },
  { id: "battle_mage_f", name: "Battle Mage (F)", icon: "\u2728", category: "magic", combatClass: "caster",
    weaponRight: "staff", weaponLeft: null, description: "Armored spellblade. Staff caster.",
    modelPath: "/models/characters/human_battle_mage-female.glb",
    matColors: { clothing: "#3355cc", armor: "#888899", detail: "#ccaa33" } },
  // Worge class — night_stalker humanoid with bear-form transform on CLASS_ABILITY_3
  { id: "worge_m", name: "Worge (M)", icon: "\uD83D\uDC3A", category: "warrior", combatClass: "melee",
    weaponRight: "fists", weaponLeft: null,
    description: "Shapeshifting brawler. Transforms into a nightmarish werewolf bear form.",
    modelPath: "/models/characters/night_stalker-male.glb",
    matColors: { clothing: "#3a2510", skin: "#8a5a30", armor: "#444444" },
    bodyMorph: { muscle: 1.4, shoulderWidth: 1.3 } },
  { id: "worge_f", name: "Worge (F)", icon: "\uD83D\uDC3A", category: "warrior", combatClass: "melee",
    weaponRight: "fists", weaponLeft: null,
    description: "Shapeshifting huntress. Transforms into a nightmarish werewolf bear form.",
    modelPath: "/models/characters/night_stalker-female.glb",
    matColors: { clothing: "#3a2510", skin: "#8a5a30", armor: "#444444" },
    bodyMorph: { muscle: 1.2, shoulderWidth: 1.15 } },
];

// Used by save loader to migrate stale saved characters whose previous model
// is no longer in Hero Forge: werewolf, lizardfolk, night_stalker (now
// worge-form-only) and undead grave knights (now NPC-only). Removed saves
// snap back to the first available preset on next load.
const REMOVED_HERO_FORGE_MODELS = new Set<string>([
  "/models/characters/undead_grave_knight-male.glb",
  "/models/characters/undead_grave_knight-female.glb",
  "/models/characters/lizardfolk-male.glb",
  // night_stalker and werewolf are now selectable as the Worge class presets
]);
const PRESET_CATEGORIES: { key: StylePreset["category"]; label: string; color: string }[] = [
  { key: "warrior", label: "Warriors", color: "#c9950a" },
  { key: "tank",    label: "Tanks",    color: "#a0845a" },
  { key: "magic",   label: "Mages",    color: "#7c4dff" },
  { key: "ranged",  label: "Rangers",  color: "#66bb6a" },
];

// Production class backgrounds matching class-selector.html
const CHAR_CLASS_BG: Record<string, string> = {
  melee:   "https://i.imgur.com/Wj2mUH2.png",   // warrior
  caster:  "https://i.imgur.com/vKQR4UT.png",   // mage
  ranger:  "https://i.imgur.com/5A6e5kL.png",   // ranger
};
const CHAR_CLASS_COLORS: Record<string, { main: string; bg: string; border: string }> = {
  melee:  { main: "#ff6b57", bg: "rgba(255,107,87,.08)",  border: "rgba(255,107,87,.35)" },
  caster: { main: "#6aa9ff", bg: "rgba(106,169,255,.08)", border: "rgba(106,169,255,.35)" },
  ranger: { main: "#6bdc8b", bg: "rgba(107,220,139,.08)", border: "rgba(107,220,139,.35)" },
};

// Race portrait tiles data — uses existing entity icons from the game
const RACE_PORTRAITS: { id: string; name: string; modelFilter: string; icon: string; portrait: string }[] = [
  { id: "elf",       name: "Elf",       modelFilter: "/elf-",                icon: "🧝", portrait: "/icons/grudge/entities/elf%20warrior.png" },
  { id: "human",     name: "Human",     modelFilter: "assassin",             icon: "👤", portrait: "/icons/grudge/entities/Human%20Warrior.png" },
  { id: "dwarf",     name: "Dwarf",     modelFilter: "/dwarf-",              icon: "⛏️", portrait: "/icons/grudge/entities/dwarf%20warrior.png" },
  { id: "orc",       name: "Orc",       modelFilter: "orc_scout",            icon: "👹", portrait: "/icons/grudge/entities/orc%20warrior.png" },
  { id: "barbarian", name: "Barbarian",  modelFilter: "battle_mage",         icon: "🪓", portrait: "/icons/grudge/entities/barb%20warrior.png" },
  { id: "undead",    name: "Undead",    modelFilter: "vampire_aristocrat",   icon: "💀", portrait: "/icons/grudge/entities/undead%20warrior.png" },
  { id: "worge",     name: "Worge",     modelFilter: "night_stalker",        icon: "🐺", portrait: "/icons/grudge/entities/orc%20warrior.png" },
  { id: "goblin",    name: "Goblin",    modelFilter: "goblin_backstabber",   icon: "🗡️", portrait: "/icons/grudge/entities/orc%20archer.png" },
];

// CSS for animated stage backgrounds + race portrait hover
const CHAR_SELECT_CSS = `
.cs-stage-bg{
  position:absolute;inset:-4%;background-size:cover;background-position:center;
  filter:saturate(1.1) brightness(.35);
  transform:scale(1.06);
  transition:opacity 1.2s ease,transform 8s ease;
  opacity:0;
}
.cs-stage-bg.active{opacity:1;transform:scale(1.02)}
.cs-race-card{
  position:relative;cursor:pointer;border:1px solid rgba(255,255,255,.08);border-radius:10px;
  overflow:hidden;aspect-ratio:1/1;background:#0b0f1e;
  transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease;
}
.cs-race-card:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.22)}
.cs-race-card.active{
  border-color:transparent;
  box-shadow:0 0 0 1px rgba(246,201,69,.6),0 14px 40px -14px rgba(246,201,69,.5);
}
.cs-race-card .cs-portrait{
  position:absolute;inset:0;background-size:cover;background-position:center top;
  transform:scale(1.03);transition:transform .5s ease,filter .3s ease;
  filter:saturate(.9) brightness(.85);
}
.cs-race-card:hover .cs-portrait{transform:scale(1.1);filter:saturate(1.1) brightness(1)}
.cs-race-card::after{
  content:"";position:absolute;inset:0;
  background:linear-gradient(180deg,transparent 40%,rgba(6,8,16,.82));
}
.cs-race-card .cs-race-label{
  position:absolute;left:0;right:0;bottom:4px;z-index:2;text-align:center;
  font-family:'Cinzel',serif;font-size:9px;letter-spacing:1.5px;color:#fff;
  text-shadow:0 2px 6px rgba(0,0,0,.9);
}
`;

function injectCharSelectCSS() {
  if (document.getElementById("grudge-charselect-css")) return;
  const s = document.createElement("style");
  s.id = "grudge-charselect-css";
  s.textContent = CHAR_SELECT_CSS;
  document.head.appendChild(s);
}

const ALL_WEAPON_TYPES: WeaponType[] = ["sword", "greatsword", "axe", "poleaxe", "hammer", "dagger", "staff", "wand", "bow", "crossbow", "gun", "shield", "fists"];

const PART_COLORS: Record<keyof MaterialColors, { label: string; colors: { label: string; value: string }[] }> = {
  skin: { label: "Skin", colors: [
    { label: "Default", value: "" }, { label: "Pale", value: "#ffe0cc" }, { label: "Light", value: "#f5d0a9" },
    { label: "Tan", value: "#d2a679" }, { label: "Brown", value: "#8d5524" }, { label: "Dark", value: "#5c3a1e" },
    { label: "Green", value: "#5a8a4a" }, { label: "Blue", value: "#5577aa" }, { label: "Gray", value: "#888888" },
  ]},
  clothing: { label: "Upper Body", colors: [
    { label: "Default", value: "" }, { label: "Red", value: "#cc3333" }, { label: "Blue", value: "#3355cc" },
    { label: "Green", value: "#33aa44" }, { label: "Purple", value: "#8833bb" }, { label: "Black", value: "#222222" },
    { label: "White", value: "#eeeeee" }, { label: "Brown", value: "#8B4513" }, { label: "Gold", value: "#ccaa33" },
  ]},
  pants: { label: "Lower Body", colors: [
    { label: "Default", value: "" }, { label: "Brown", value: "#5c3317" }, { label: "Dark Brown", value: "#3b2210" },
    { label: "Black", value: "#1a1a1a" }, { label: "Gray", value: "#555555" }, { label: "Navy", value: "#1a2744" },
    { label: "Green", value: "#2d5a27" }, { label: "Red", value: "#8b2020" }, { label: "White", value: "#cccccc" },
    { label: "Tan", value: "#c4a46c" }, { label: "Blue", value: "#334488" }, { label: "Purple", value: "#4a2266" },
  ]},
  hair: { label: "Hair", colors: [
    { label: "Default", value: "" }, { label: "Black", value: "#1a1a1a" }, { label: "Brown", value: "#5c3317" },
    { label: "Blonde", value: "#e6c35c" }, { label: "Red", value: "#aa3322" }, { label: "White", value: "#dddddd" },
    { label: "Blue", value: "#3366cc" }, { label: "Pink", value: "#cc5588" }, { label: "Green", value: "#44aa55" },
  ]},
  hat: { label: "Hat/Helm", colors: [
    { label: "Default", value: "" }, { label: "Red", value: "#cc2222" }, { label: "Blue", value: "#2244aa" },
    { label: "Purple", value: "#7722aa" }, { label: "Black", value: "#222222" }, { label: "Brown", value: "#6B3A20" },
    { label: "Gold", value: "#ccaa22" }, { label: "Silver", value: "#bbbbcc" }, { label: "Green", value: "#338844" },
  ]},
  armor: { label: "Armor", colors: [
    { label: "Default", value: "" }, { label: "Iron", value: "#888899" }, { label: "Steel", value: "#aaaabb" },
    { label: "Gold", value: "#ccaa33" }, { label: "Bronze", value: "#aa7733" }, { label: "Dark", value: "#333344" },
    { label: "Red", value: "#aa3333" }, { label: "Blue", value: "#334488" }, { label: "Emerald", value: "#338855" },
  ]},
  detail: { label: "Details", colors: [
    { label: "Default", value: "" }, { label: "Gold", value: "#ccaa33" }, { label: "Silver", value: "#bbbbcc" },
    { label: "Red", value: "#cc3333" }, { label: "Blue", value: "#3355cc" }, { label: "Green", value: "#33aa44" },
    { label: "Purple", value: "#8833bb" }, { label: "White", value: "#eeeeee" }, { label: "Black", value: "#222222" },
  ]},
};

const CLASS_INFO: Record<CombatClass, { label: string; icon: string; desc: string }> = {
  melee: { label: "Melee", icon: "\u2694", desc: "Close combat, sword combos, heavy attacks" },
  caster: { label: "Caster", icon: "\u2728", desc: "Magic spells, area attacks, ranged blasts" },
  ranger: { label: "Ranger", icon: "\uD83C\uDFF9", desc: "Ranged attacks, quick shots, dodge rolls" },
};

const CATEGORY_MAP: Record<MaterialCategory, keyof MaterialColors> = {
  skin: "skin", clothing: "clothing", hair: "hair", hat: "hat",
  armor: "armor", detail: "detail", unknown: "clothing", pants: "pants",
};

type MorphGroup = "build" | "limbs" | "face" | "extremities";
const MORPH_SLIDERS: { key: keyof BodyMorphConfig; label: string; min: number; max: number; step: number; color: string; group: MorphGroup }[] = [
  { key: "torsoLength", label: "Torso Length", min: 0.7, max: 1.4, step: 0.02, color: "#66bb6a", group: "build" },
  { key: "shoulderWidth", label: "Shoulders", min: 0.7, max: 1.5, step: 0.02, color: "#ab47bc", group: "build" },
  { key: "chestWidth", label: "Chest Width", min: 0.7, max: 1.5, step: 0.02, color: "#ec407a", group: "build" },
  { key: "hipWidth", label: "Hips", min: 0.7, max: 1.4, step: 0.02, color: "#26c6da", group: "build" },
  { key: "muscle", label: "Muscle", min: 0.6, max: 1.6, step: 0.02, color: "#ff7043", group: "build" },
  { key: "neckLength", label: "Neck Length", min: 0.6, max: 1.5, step: 0.02, color: "#78909c", group: "build" },
  { key: "neckWidth", label: "Neck Width", min: 0.6, max: 1.5, step: 0.02, color: "#90a4ae", group: "build" },
  { key: "armLength", label: "Arm Length", min: 0.7, max: 1.4, step: 0.02, color: "#ffb74d", group: "limbs" },
  { key: "forearmScale", label: "Forearm", min: 0.7, max: 1.4, step: 0.02, color: "#ffa726", group: "limbs" },
  { key: "legLength", label: "Leg Length", min: 0.7, max: 1.4, step: 0.02, color: "#c9a86c", group: "limbs" },
  { key: "calfScale", label: "Calf", min: 0.7, max: 1.4, step: 0.02, color: "#b8976a", group: "limbs" },
  { key: "headScale", label: "Head Size", min: 0.7, max: 1.4, step: 0.02, color: "#8d6e63", group: "face" },
  { key: "jawWidth", label: "Jaw Width", min: 0.7, max: 1.4, step: 0.02, color: "#a1887f", group: "face" },
  { key: "browHeight", label: "Brow Height", min: 0.7, max: 1.4, step: 0.02, color: "#bcaaa4", group: "face" },
  { key: "cheekWidth", label: "Cheek Width", min: 0.7, max: 1.4, step: 0.02, color: "#d7ccc8", group: "face" },
  { key: "handScale", label: "Hands", min: 0.7, max: 1.5, step: 0.02, color: "#7e57c2", group: "extremities" },
  { key: "footScale", label: "Feet", min: 0.7, max: 1.5, step: 0.02, color: "#5c6bc0", group: "extremities" },
];

const MORPH_GROUP_LABELS: Record<MorphGroup, { label: string; color: string }> = {
  build: { label: "Build & Torso", color: "#c9950a" },
  limbs: { label: "Limbs", color: "#ffb74d" },
  face: { label: "Head & Face", color: "#8d6e63" },
  extremities: { label: "Hands & Feet", color: "#7e57c2" },
};

function ModelAnalyzerDisplay({ analysis }: { analysis: ModelAnalysis | null }) {
  if (!analysis) return <div style={{ color: "#666", fontSize: 11 }}>Loading model analysis...</div>;
  const classSuggestion = "melee";
  const bodyParts = detectBodyParts(analysis.boneNames);

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11 }}>
      <div style={{ flex: "1 1 180px" }}>
        <div style={sty.sectionHeader}>Mesh Stats</div>
        <div style={sty.panel}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, fontSize: 10 }}>
            <span style={{ color: "#aaa" }}>Meshes:</span><span style={{ color: "#c9950a" }}>{analysis.meshCount}</span>
            <span style={{ color: "#aaa" }}>Vertices:</span><span style={{ color: "#c9950a" }}>{analysis.vertexCount.toLocaleString()}</span>
            <span style={{ color: "#aaa" }}>Triangles:</span><span style={{ color: "#c9950a" }}>{Math.floor(analysis.triangleCount).toLocaleString()}</span>
            <span style={{ color: "#aaa" }}>Has Rig:</span><span style={{ color: analysis.hasRig ? "#66bb6a" : "#b54a3a" }}>{analysis.hasRig ? "Yes" : "No"}</span>
            <span style={{ color: "#aaa" }}>Scale:</span><span style={{ color: "#ffb74d" }}>{analysis.suggestedScale.toFixed(2)}x</span>
            <span style={{ color: "#aaa" }}>AI Class:</span><span style={{ color: "#ce93d8" }}>{classSuggestion}</span>
          </div>
        </div>
        <div style={{ ...sty.sectionHeader, marginTop: 6 }}>Body Parts Detected</div>
        <div style={sty.panelText}>
          <div><span style={{ color: "#aaa" }}>Root: </span><span style={{ color: bodyParts.root ? "#66bb6a" : "#b54a3a" }}>{bodyParts.root || "none"}</span></div>
          {(["spine","upperSpine","neck","arms","upperArms","forearms","hands","legs","calves","feet","head","jaw","brow","cheek","hips"] as const).map(k => (
            <div key={k}><span style={{ color: "#aaa" }}>{k}: </span><span style={{ color: "#c9950a" }}>{bodyParts[k].length}</span></div>
          ))}
        </div>
      </div>
      <div style={{ flex: "1 1 180px" }}>
        <div style={sty.sectionHeader}>Hand Bones</div>
        <div style={sty.panelText}>
          <div><span style={{ color: "#aaa" }}>R: </span><span style={{ color: analysis.handBones.right ? "#66bb6a" : "#b54a3a" }}>{analysis.handBones.right || "Not found"}</span></div>
          <div><span style={{ color: "#aaa" }}>L: </span><span style={{ color: analysis.handBones.left ? "#66bb6a" : "#b54a3a" }}>{analysis.handBones.left || "Not found"}</span></div>
        </div>
        <div style={{ ...sty.sectionHeader, marginTop: 6 }}>Materials ({analysis.materialNames.length})</div>
        <div style={sty.panelScroll()}>
          {analysis.materialNames.length === 0 ? <span style={{ color: "#666" }}>No named materials</span> :
            analysis.materialNames.map(m => (
              <div key={m} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#ddd" }}>{m}</span>
                <span style={{ color: "#c9950a", fontSize: 8, textTransform: "uppercase" }}>{analysis.materialCategories[m]}</span>
              </div>
            ))}
        </div>
        <div style={{ ...sty.sectionHeader, marginTop: 6 }}>Animations ({analysis.animationNames.length})</div>
        <div style={sty.panelScroll()}>
          {analysis.animationNames.length === 0 ? <span style={{ color: "#666" }}>No embedded animations</span> :
            analysis.animationNames.map(a => (
              <div key={a} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#ddd" }}>{a}</span>
                <span style={{ color: "#888", fontSize: 9 }}>{analysis.animationDurations[a]?.toFixed(2)}s</span>
              </div>
            ))}
        </div>
      </div>
      <div style={{ flex: "1 1 180px" }}>
        <div style={sty.sectionHeader}>Bones ({analysis.boneNames.length})</div>
        <div style={sty.panelScroll(160)}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {analysis.boneNames.map(b => (
              <span key={b} style={{
                padding: "1px 4px", borderRadius: 2, fontSize: 8,
                background: (b === analysis.handBones.right || b === analysis.handBones.left) ? "rgba(102,187,106,0.3)" : "rgba(255,255,255,0.06)",
                color: (b === analysis.handBones.right || b === analysis.handBones.left) ? "#66bb6a" : "#888",
              }}>{b}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


function ExternalAnimLoader({
  url, mixer, cloned, onLoaded, clipName,
}: {
  url: string; mixer: THREE.AnimationMixer | null; cloned: THREE.Object3D | null;
  onLoaded: (clipName: string) => void;
  clipName?: string;
}) {
  const gltf = useAsset(url);

  useEffect(() => {
    if (!gltf || !mixer || !cloned || gltf.animations.length === 0) return;
    mixer.stopAllAction();
    const clips = gltf.animations;
    let rawClip: THREE.AnimationClip;
    if (clipName) {
      const found = clips.find(c => c.name === clipName);
      rawClip = found || clips[0];
    } else {
      rawClip = clips[0];
    }
    const [processed] = retargetClips([rawClip], cloned);
    const action = mixer.clipAction(processed, cloned);
    action.reset().play();
    const label = clipName
      ? clipName
      : clips.length > 1
        ? `${rawClip.name || "clip_0"} (+${clips.length - 1} more)`
        : (rawClip.name || url.split("/").pop()?.replace(".glb", "") || "external");
    onLoaded(label);
  }, [gltf, url, mixer, cloned, onLoaded, clipName]);

  return null;
}

function WeaponGizmo({
  bone, type, hand, offset, onOffsetChange, gizmoMode, weaponModelId, skeletonType,
}: {
  bone: THREE.Object3D | null;
  type: WeaponType | null;
  hand: "right" | "left";
  offset: { pos: [number, number, number]; rot: [number, number, number]; scl: [number, number, number] };
  onOffsetChange: (hand: "right" | "left", pos: [number, number, number], rot: [number, number, number], scl: [number, number, number]) => void;
  gizmoMode: "translate" | "rotate" | "scale" | null;
  weaponModelId?: string | null;
  skeletonType?: SkeletonType;
}) {
  const [grpObj, setGrpObj] = useState<THREE.Group | null>(null);
  const boneInvScaleRef = useRef<[number, number, number]>([1, 1, 1]);
  const baseTransformRef = useRef<GripTransform>({ position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 });
  const transformRef = useRef<any>(null);
  const createdGrpRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (createdGrpRef.current && bone) {
      bone.remove(createdGrpRef.current);
      createdGrpRef.current = null;
    }
    setGrpObj(null);

    if (!bone || !type || type === "fists") return;

    let cancelled = false;

    const skelType = skeletonType || "generic";
    const baseXform = computeWeaponTransform(type, hand, skelType, 1.0);
    baseTransformRef.current = baseXform;

    const finalPos: [number, number, number] = [
      baseXform.position[0] + offset.pos[0],
      baseXform.position[1] + offset.pos[1],
      baseXform.position[2] + offset.pos[2],
    ];
    const finalRot: [number, number, number] = [
      baseXform.rotation[0] + offset.rot[0],
      baseXform.rotation[1] + offset.rot[1],
      baseXform.rotation[2] + offset.rot[2],
    ];

    const setupGroup = (grp: THREE.Group) => {
      if (cancelled) return;
      grp.name = `wpn_gizmo_${hand}`;
      boneInvScaleRef.current = [1, 1, 1];
      grp.position.set(...finalPos);
      grp.rotation.set(...finalRot);
      grp.scale.set(offset.scl[0], offset.scl[1], offset.scl[2]);
      bone.add(grp);
      createdGrpRef.current = grp;
      setGrpObj(grp);
    };

    if (weaponModelId) {
      loadWeaponModel(type, weaponModelId)
        .then((modelGroup) => {
          if (cancelled) return;
          setupGroup(modelGroup);
        })
        .catch(() => {
          if (cancelled) return;
          const grp = buildProceduralWeaponGroup(type);
          setupGroup(grp);
        });
    } else {
      const grp = buildProceduralWeaponGroup(type);
      setupGroup(grp);
    }

    return () => {
      cancelled = true;
      if (createdGrpRef.current && bone) {
        bone.remove(createdGrpRef.current);
        createdGrpRef.current = null;
      }
      setGrpObj(null);
    };
  }, [bone, type, hand, weaponModelId, skeletonType]);

  useEffect(() => {
    if (grpObj) {
      const [ix, iy, iz] = boneInvScaleRef.current;
      const base = baseTransformRef.current;
      grpObj.position.set(
        base.position[0] + offset.pos[0],
        base.position[1] + offset.pos[1],
        base.position[2] + offset.pos[2],
      );
      grpObj.rotation.set(
        base.rotation[0] + offset.rot[0],
        base.rotation[1] + offset.rot[1],
        base.rotation[2] + offset.rot[2],
      );
      grpObj.scale.set(ix * offset.scl[0], iy * offset.scl[1], iz * offset.scl[2]);
    }
  }, [offset, grpObj]);

  const { scene: threeScene } = useThree();
  const [sceneValid, setSceneValid] = useState(false);

  useEffect(() => {
    if (!grpObj || !gizmoMode) {
      setSceneValid(false);
      return;
    }
    const checkTimer = setTimeout(() => {
      let current: THREE.Object3D | null = grpObj;
      while (current) {
        if (current === threeScene) {
          setSceneValid(true);
          return;
        }
        current = current.parent;
      }
      setSceneValid(false);
    }, 50);
    return () => clearTimeout(checkTimer);
  }, [grpObj, gizmoMode, threeScene, bone, type]);

  const orbitControls = useThree((state) => state.controls as any);

  useEffect(() => {
    const tc = transformRef.current;
    if (!tc || !sceneValid) return;
    const handler = (event: { value: boolean }) => {
      if (orbitControls && "enabled" in orbitControls) {
        orbitControls.enabled = !event.value;
      }
    };
    tc.addEventListener("dragging-changed", handler);
    return () => {
      tc.removeEventListener("dragging-changed", handler);
      if (orbitControls && "enabled" in orbitControls) {
        orbitControls.enabled = true;
      }
    };
  }, [orbitControls, sceneValid, grpObj, gizmoMode]);

  if (!bone || !type || type === "fists" || !grpObj || !gizmoMode || !sceneValid) return null;

  return (
    <TransformControls
      ref={transformRef}
      object={grpObj}
      mode={gizmoMode}
      size={0.4}
      onObjectChange={() => {
        if (!grpObj) return;
        const p = grpObj.position;
        const r = grpObj.rotation;
        const s = grpObj.scale;
        const base = baseTransformRef.current;
        const [ix, iy, iz] = boneInvScaleRef.current;
        const userPos: [number, number, number] = [
          p.x - base.position[0],
          p.y - base.position[1],
          p.z - base.position[2],
        ];
        const userRot: [number, number, number] = [
          r.x - base.rotation[0],
          r.y - base.rotation[1],
          r.z - base.rotation[2],
        ];
        const userScl: [number, number, number] = [
          ix > 0 ? s.x / ix : s.x,
          iy > 0 ? s.y / iy : s.y,
          iz > 0 ? s.z / iz : s.z,
        ];
        onOffsetChange(hand, userPos, userRot, userScl);
      }}
    />
  );
}

// Routes through the shared procedural pipeline (which runs the same
// normalize-axis + grip-anchor logic as the GLB loader) so character-select
// previews match in-game weapon placement exactly.
function buildProceduralWeaponGroup(type: WeaponType): THREE.Group {
  return buildProceduralWeaponGroupShared(type);
}

function HeightMarkers({ showMarkers }: { showMarkers: boolean }) {
  if (!showMarkers) return null;
  const heights = [0, 0.5, 1.0, 1.5, 2.0];
  return (
    <group position={[-1.2, 0, 0]}>
      {heights.map(h => (
        <group key={h} position={[0, h, 0]}>
          <mesh>
            <boxGeometry args={[0.3, 0.003, 0.003]} />
            <meshBasicMaterial color={h === 1.0 ? "#ff9800" : "#555"} />
          </mesh>
          <Text
            position={[-0.22, 0.02, 0]}
            fontSize={0.04}
            color={h === 1.0 ? "#ff9800" : "#888"}
            anchorX="right"
            anchorY="bottom"
          >
            {h.toFixed(1)}m
          </Text>
        </group>
      ))}
      <mesh position={[0.15, 1.0, 0]}>
        <boxGeometry args={[0.003, 2.0, 0.003]} />
        <meshBasicMaterial color="#333" />
      </mesh>
      <group position={[0.5, 0, 0]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.005, 1.0, 0.005]} />
          <meshBasicMaterial color="#ff9800" />
        </mesh>
        <Text position={[0.06, 0.5, 0]} fontSize={0.035} color="#ff9800" anchorX="left" anchorY="middle">
          1m ref
        </Text>
      </group>
    </group>
  );
}

// Hero Forge animation policy: ONLY play clips that ship inside the
// character's own GLB. No external animation packs are layered in.
//
// Why no external idle: cross-rig retargeting cannot fix every rig
// mismatch. Even with delta-from-rest math on spine/arms/legs and root-
// chain tracks dropped, a source rig like Mixamo's glocomotion/idle.glb
// has its Hips bone rotated ~50° at rest. Every child bone's animation is
// authored in that tilted local space — when applied to a target rig whose
// Hips is at identity, those rotations land in a different world direction
// and the character ends up sideways or flying. The only robust fix is
// full world-space retargeting (expensive, brittle, out of scope here).
//
// Trade-off: characters whose GLB ships only a T-pose will stand in T-pose
// in the preview (no breathing). That is intentional — it is strictly
// better than the previous "breathes but tips sideways" behavior.

// Hero Forge clip lookup. Uses the same matching semantics as the in-game
// animation pipeline: exact name → suffix after Mixamo `|` separator →
// case-insensitive → substring.
function findClipByName(clips: THREE.AnimationClip[], targetName: string): THREE.AnimationClip | null {
  if (!targetName) return clips[0] ?? null;
  const exact = clips.find(c => c.name === targetName);
  if (exact) return exact;

  const withPipe = clips.find(c => {
    const pipeIdx = c.name.lastIndexOf("|");
    if (pipeIdx === -1) return false;
    return c.name.substring(pipeIdx + 1) === targetName;
  });
  if (withPipe) return withPipe;

  const lower = targetName.toLowerCase();
  const caseInsensitive = clips.find(c => c.name.toLowerCase() === lower);
  if (caseInsensitive) return caseInsensitive;

  const substring = clips.find(c => {
    const cn = c.name.toLowerCase();
    return cn.includes(lower) || lower.includes(cn);
  });
  if (substring) return substring;

  return null;
}

function CharacterPreview({
  modelPath, scale, materialColors, materialMap, previewAnim, weaponRight, weaponLeft,
  onAnalysis, bodyMorph, autoRotate, externalAnimUrl, externalAnimClipName, onExternalAnimLoaded,
  weaponOffset, onWeaponOffsetChange, gizmoMode, onHandBones, tPose,
  weaponModelRight, weaponModelLeft, backAccessoryId,
}: {
  modelPath: string; scale: number; materialColors: MaterialColors;
  materialMap: Record<string, keyof MaterialColors>; previewAnim: string;
  weaponRight: WeaponType; weaponLeft: WeaponType | null;
  onAnalysis?: (analysis: ModelAnalysis) => void;
  bodyMorph: BodyMorphConfig; autoRotate: boolean;
  externalAnimUrl: string | null;
  externalAnimClipName?: string;
  onExternalAnimLoaded: (name: string) => void;
  weaponOffset: WeaponOffsetConfig;
  onWeaponOffsetChange: (hand: "right" | "left", pos: [number, number, number], rot: [number, number, number], scl: [number, number, number]) => void;
  gizmoMode: "translate" | "rotate" | "scale" | null;
  onHandBones?: (right: THREE.Object3D | null, left: THREE.Object3D | null) => void;
  tPose?: boolean;
  weaponModelRight?: string | null;
  weaponModelLeft?: string | null;
  backAccessoryId?: string | null;
}) {
  const gltf = useAsset(modelPath);
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const prevAnimRef = useRef<string>("");
  const rightHandRef = useRef<THREE.Object3D | null>(null);
  const leftHandRef = useRef<THREE.Object3D | null>(null);
  const headRef = useRef<THREE.Object3D | null>(null);
  const analysisRef = useRef<ModelAnalysis | null>(null);
  const bodyPartsRef = useRef<BodyPartBones | null>(null);
  const [detectedSkelType, setDetectedSkelType] = useState<SkeletonType>("generic");
  const [autoMaterialMap, setAutoMaterialMap] = useState<Record<string, keyof MaterialColors>>({});

  useEffect(() => {
    if (gltf) {
      const boneNames: string[] = [];
      const materialNamesSet = new Set<string>();
      let meshCount = 0, vertexCount = 0, triangleCount = 0, hasRig = false;
      gltf.scene.traverse((child: any) => {
        if (child.isBone) { boneNames.push(child.name); hasRig = true; }
        if (child.isSkinnedMesh) hasRig = true;
        if (child.isMesh) {
          meshCount++;
          const geo = child.geometry;
          if (geo) {
            const pos = geo.getAttribute("position");
            if (pos) vertexCount += pos.count;
            if (geo.index) triangleCount += geo.index.count / 3;
            else if (pos) triangleCount += pos.count / 3;
          }
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const mat of mats) { if (mat?.name) materialNamesSet.add(mat.name); }
        }
      });
      const box = computeSkinnedBounds(gltf.scene);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const materialNames = Array.from(materialNamesSet);
      const materialCategories: Record<string, MaterialCategory> = {};
      for (const n of materialNames) {
        const l = n.toLowerCase();
        if (["skin","face","teeth","body","head"].some(k => l.includes(k))) materialCategories[n] = "skin";
        else if (["hair","brow","beard"].some(k => l.includes(k))) materialCategories[n] = "hair";
        else if (["hat","helm","hood"].some(k => l.includes(k))) materialCategories[n] = "hat";
        else if (["armor","plate","chain","shield"].some(k => l.includes(k))) materialCategories[n] = "armor";
        else if (["detail","gold","gem"].some(k => l.includes(k))) materialCategories[n] = "detail";
        else if (["pants","trouser","legging","skirt"].some(k => l.includes(k))) materialCategories[n] = "pants";
        else if (["cloth","shirt","robe","tunic"].some(k => l.includes(k))) materialCategories[n] = "clothing";
        else materialCategories[n] = "unknown";
      }
      const analysis: ModelAnalysis = {
        bounds: { width: size.x, height: size.y, depth: size.z },
        box,
        suggestedScale: maxDim > 0 ? 1.8 / maxDim : 1.0,
        boneNames, materialNames, materialCategories,
        handBones: {
          right: findBoneNameByAlias(boneNames, RIGHT_HAND_ALIASES),
          left: findBoneNameByAlias(boneNames, LEFT_HAND_ALIASES),
        },
        animationNames: gltf.animations.map(a => a.name),
        animationDurations: Object.fromEntries(gltf.animations.map(a => [a.name, a.duration])),
        meshCount, vertexCount, triangleCount, hasRig,
      };
      analysisRef.current = analysis;
      bodyPartsRef.current = detectBodyParts(analysis.boneNames);
      setDetectedSkelType(detectSkeletonType(analysis.boneNames));
      // Derive the auto-material-map as state so `dynamicMaterialMap` below
      // doesn't have to depend on a ref. Refs can't be deps — when something
      // else triggers a re-render after the ref changes, useMemo would
      // spuriously recompute, recreating `cloned`, the bones, the mixer, and
      // every weapon attached to the rig. That was the root of the Hero Forge
      // "two bodies / spazzing" bug.
      const auto: Record<string, keyof MaterialColors> = {};
      for (const [matName, cat] of Object.entries(analysis.materialCategories)) {
        auto[matName] = CATEGORY_MAP[cat];
      }
      setAutoMaterialMap(auto);
      if (onAnalysis) onAnalysis(analysis);
    }
  }, [gltf, onAnalysis]);

  const dynamicMaterialMap = useMemo(() => {
    if (Object.keys(materialMap).length > 0) return materialMap;
    return autoMaterialMap;
  }, [materialMap, autoMaterialMap]);

  const cloned = useMemo(() => {
    const s = SkeletonUtils.clone(gltf.scene);

    // Bone-name normalisation (colon stripping etc.) is the responsibility of
    // the canonical retarget path in `BoneAliases.retargetClips`, which
    // tolerates raw `mixamorig:` namespaces and rewrites track names to match
    // whatever bones live on the cloned scene. Mutating bone names here used
    // to fight the in-game pipeline (which keeps the original names) and was
    // the root cause of the "model goes nuts" glitch — so we leave the cloned
    // skeleton untouched and let the retargeter do all alias resolution.

    // SAME canonical sizing function the in-game pipeline uses. Do not
    // inline a local "use longest axis / use max(width,height,depth) / etc."
    // formula here — that produced two different sizes for the same hero
    // (tiny in the preview, giant in the world).
    normalizeCharacterHeight(s, 1.8 * scale);
    rightHandRef.current = null;
    leftHandRef.current = null;
    headRef.current = null;

    rightHandRef.current = findBoneByAlias(s, RIGHT_HAND_ALIASES);
    leftHandRef.current = findBoneByAlias(s, LEFT_HAND_ALIASES);
    headRef.current = findBoneByAlias(s, HEAD_ALIASES);

    s.traverse((child) => {

      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        const applyColor = (mat: THREE.Material) => {
          const stdMat = mat as THREE.MeshStandardMaterial;
          if (!stdMat.name || !("color" in stdMat)) return mat;
          const partKey = dynamicMaterialMap[stdMat.name] || MATERIAL_CLASSIFY[stdMat.name];
          if (!partKey) return mat;
          const colorVal = materialColors[partKey];
          if (!colorVal) return mat;
          const clonedMat = stdMat.clone();
          clonedMat.color.lerp(new THREE.Color(colorVal), 0.55);
          return clonedMat;
        };
        if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(applyColor);
        else mesh.material = applyColor(mesh.material);
      }
    });

    return s;
  }, [gltf, scale, materialColors, dynamicMaterialMap]);

  // Publish active rig bones (hands + head) to the global registry so the
  // character-select preview exposes the same surface as the in-game Player.
  // The Hero Forge canvas and the in-game canvas are never mounted at the
  // same time, so they can't fight for the slots. Cleanup nulls them out so
  // a stale CharacterPreview unmount doesn't leave dangling pointers when
  // the player drops back into the world.
  useEffect(() => {
    if (onHandBones) onHandBones(rightHandRef.current, leftHandRef.current);
    setPlayerBones(rightHandRef.current, leftHandRef.current, headRef.current);
    return () => { setPlayerBones(null, null, null); };
  }, [cloned, onHandBones]);

  useEffect(() => {
    if (bodyPartsRef.current && cloned) {
      applyBodyMorph(cloned, bodyMorph, bodyPartsRef.current);
    }
  }, [cloned, bodyMorph]);

  // Mirror the in-game back-accessory attachment so the character editor
  // shows the quiver while the player is configuring their loadout. Same
  // bone-search + load + cleanup pattern as `Player.tsx`.
  useEffect(() => {
    if (!cloned) return;
    const backBone = findBoneByAlias(cloned, SPINE2_ALIASES);
    if (!backBone) return;

    const ACCESSORY_NAME_PREFIX = "back_accessory_";
    const removeExisting = () => {
      for (let i = backBone.children.length - 1; i >= 0; i--) {
        const child = backBone.children[i];
        if (child.name.startsWith(ACCESSORY_NAME_PREFIX)) {
          backBone.remove(child);
        }
      }
    };
    removeExisting();

    const entry = getBackAccessoryModel(backAccessoryId);
    if (!entry) return;

    let cancelled = false;
    loadAsset(entry.path, "medium", "preview_back_accessory").then((gltf) => {
      if (cancelled || !backBone.parent) return;
      removeExisting();

      const inst = gltf.scene.clone(true);
      inst.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(inst);
      const size = new THREE.Vector3();
      box.getSize(size);
      const longest = Math.max(size.x, size.y, size.z, 1e-4);
      const baseScale = entry.defaultLength / longest;

      const wrapper = new THREE.Group();
      wrapper.name = `${ACCESSORY_NAME_PREFIX}${entry.id}`;
      wrapper.add(inst);

      const worldScale = new THREE.Vector3();
      backBone.getWorldScale(worldScale);
      const inv = 1 / Math.max(worldScale.x, 1e-4);
      wrapper.scale.setScalar(baseScale * inv);

      wrapper.position.set(0, 0.05, -0.18);
      wrapper.rotation.set(-0.3, 0, 0.4);

      wrapper.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          (c as THREE.Mesh).castShadow = true;
        }
      });

      backBone.add(wrapper);
    }).catch((err) => {
      if (!cancelled) console.warn(`[CharacterPreview] Back accessory load failed for ${backAccessoryId}:`, err);
    });

    return () => {
      cancelled = true;
      removeExisting();
    };
  }, [cloned, backAccessoryId]);

  // Single source of truth for clip remapping: `retargetClips` walks every
  // track, strips Maya-style `mixamorig:` namespaces, and rewrites the
  // bone-name portion of each track to match the cloned scene's bones via
  // `RETARGET_ALIAS_MAP`. No parallel/duplicate remapping pass.
  const sanitizedClips = useMemo(() => {
    // Strip the "0_T-Pose" rest-pose clips Sketchfab bakes into our
    // characters. Without this, `findClipByName(..., "Idle") || clips[0]`
    // falls back to the T-pose clip and the preview is stuck T-posing
    // until/unless the user picks a different animation manually.
    const clean = (gltf.animations || []).filter(
      c => !isRestPoseClipName(c.name),
    );
    return retargetClips(clean, cloned);
  }, [gltf.animations, cloned]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(cloned);
    mixerRef.current = mixer;
    const clip = findClipByName(sanitizedClips, "Idle") || sanitizedClips[0];
    if (clip) {
      const action = mixer.clipAction(clip, cloned);
      action.play();
      currentActionRef.current = action;
    }
    prevAnimRef.current = "Idle";

    // No external idle layering. If the character's own clips didn't give
    // us an Idle, the mixer simply stays empty and the character holds its
    // bind/T-pose. See policy comment near top of this file.

    return () => { mixer.stopAllAction(); currentActionRef.current = null; };
  }, [cloned, sanitizedClips]);

  useEffect(() => {
    if (tPose) return;
    if (!mixerRef.current || previewAnim === prevAnimRef.current) return;
    const mixer = mixerRef.current;

    mixer.stopAllAction();
    currentActionRef.current = null;

    // Only the character's own clips. No external pack fallback.
    const clip = findClipByName(sanitizedClips, previewAnim);
    if (!clip) return;
    const newAction = mixer.clipAction(clip, cloned);
    newAction.reset().play();
    currentActionRef.current = newAction;
    prevAnimRef.current = previewAnim;
  }, [previewAnim, gltf.animations, cloned, tPose, sanitizedClips]);

  useEffect(() => {
    if (!tPose || !mixerRef.current || !cloned) return;
    mixerRef.current.stopAllAction();
    currentActionRef.current = null;
    prevAnimRef.current = "";

    const skeletons: THREE.Skeleton[] = [];
    cloned.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const sk = (child as THREE.SkinnedMesh).skeleton;
        if (sk && !skeletons.includes(sk)) skeletons.push(sk);
      }
    });

    for (const skeleton of skeletons) {
      skeleton.pose();
    }

    const allBones: THREE.Bone[] = [];
    cloned.traverse((child) => {
      if ((child as THREE.Bone).isBone) allBones.push(child as THREE.Bone);
    });

    const upperArmR = findBoneByAliasFromList(allBones, UPPER_ARM_R_ALIASES);
    const upperArmL = findBoneByAliasFromList(allBones, UPPER_ARM_L_ALIASES);
    const forearmR = findBoneByAliasFromList(allBones, FOREARM_R_ALIASES);
    const forearmL = findBoneByAliasFromList(allBones, FOREARM_L_ALIASES);

    if (upperArmR || upperArmL) {
      cloned.updateMatrixWorld(true);

      const parentInvQuat = new THREE.Quaternion();
      const targetDir = new THREE.Vector3();
      const currentDir = new THREE.Vector3();
      const rotQuat = new THREE.Quaternion();

      const setArmTPose = (upperArm: THREE.Bone, forearm: THREE.Bone | null, sideSign: number) => {
        if (upperArm.parent) {
          upperArm.parent.updateWorldMatrix(true, false);
          parentInvQuat.copy(upperArm.parent.getWorldQuaternion(new THREE.Quaternion())).invert();
        } else {
          parentInvQuat.identity();
        }

        targetDir.set(sideSign, 0, 0).applyQuaternion(parentInvQuat).normalize();

        upperArm.updateWorldMatrix(true, false);
        const childBone = forearm || upperArm.children.find(c => (c as THREE.Bone).isBone) as THREE.Bone | undefined;
        if (childBone) {
          currentDir.copy(childBone.position).normalize();
        } else {
          currentDir.set(sideSign, 0, 0).applyQuaternion(parentInvQuat).normalize();
        }

        if (currentDir.lengthSq() > 0.001) {
          rotQuat.setFromUnitVectors(currentDir, targetDir);
          upperArm.quaternion.premultiply(rotQuat);
        }

        if (forearm) {
          forearm.quaternion.identity();
        }
      };

      if (upperArmR) setArmTPose(upperArmR, forearmR, 1);
      if (upperArmL) setArmTPose(upperArmL, forearmL, -1);
    }

    cloned.updateMatrixWorld(true);
  }, [tPose, cloned]);

  useFrame((_, delta) => {
    if (!tPose) mixerRef.current?.update(delta);
    if (groupRef.current && autoRotate && !tPose) groupRef.current.rotation.y += delta * 0.4;
  });

  const gripData = useMemo(() => {
    return buildWeaponGripData(weaponRight, weaponLeft, detectedSkelType, 1.0);
  }, [weaponRight, weaponLeft, detectedSkelType]);

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
      {externalAnimUrl && (
        <Suspense fallback={null}>
          <ExternalAnimLoader
            url={externalAnimUrl}
            mixer={mixerRef.current}
            cloned={cloned}
            onLoaded={onExternalAnimLoaded}
            clipName={externalAnimClipName}
          />
        </Suspense>
      )}
      <WeaponGizmo
        bone={rightHandRef.current} type={gripData.right?.type ?? null} hand="right"
        offset={{ pos: weaponOffset.rightPos, rot: weaponOffset.rightRot, scl: weaponOffset.rightScale }}
        onOffsetChange={onWeaponOffsetChange} gizmoMode={gizmoMode}
        weaponModelId={gripData.right ? (gripData.right.type === weaponRight ? weaponModelRight : weaponModelLeft) : null}
        skeletonType={detectedSkelType}
      />
      <WeaponGizmo
        bone={leftHandRef.current} type={gripData.left?.type ?? null} hand="left"
        offset={{ pos: weaponOffset.leftPos, rot: weaponOffset.leftRot, scl: weaponOffset.leftScale }}
        onOffsetChange={onWeaponOffsetChange} gizmoMode={gizmoMode}
        weaponModelId={gripData.left ? (gripData.left.type === weaponRight ? weaponModelRight : weaponModelLeft) : null}
        skeletonType={detectedSkelType}
      />
    </group>
  );
}

function PreviewCanvas({
  modelPath, scale, materialColors, materialMap, previewAnim, weaponRight, weaponLeft,
  onAnalysis, bodyMorph, autoRotate, externalAnimUrl, externalAnimClipName, onExternalAnimLoaded,
  weaponOffset, onWeaponOffsetChange, gizmoMode, onHandBones, tPose,
  showHeightMarkers, weaponModelRight, weaponModelLeft, backAccessoryId,
}: {
  modelPath: string; scale: number; materialColors: MaterialColors;
  materialMap: Record<string, keyof MaterialColors>; previewAnim: string;
  weaponRight: WeaponType; weaponLeft: WeaponType | null;
  onAnalysis?: (analysis: ModelAnalysis) => void;
  bodyMorph: BodyMorphConfig; autoRotate: boolean;
  externalAnimUrl: string | null;
  externalAnimClipName?: string;
  onExternalAnimLoaded: (name: string) => void;
  weaponOffset: WeaponOffsetConfig;
  onWeaponOffsetChange: (hand: "right" | "left", pos: [number, number, number], rot: [number, number, number], scl: [number, number, number]) => void;
  gizmoMode: "translate" | "rotate" | "scale" | null;
  onHandBones?: (right: THREE.Object3D | null, left: THREE.Object3D | null) => void;
  tPose?: boolean;
  showHeightMarkers?: boolean;
  weaponModelRight?: string | null;
  weaponModelLeft?: string | null;
  backAccessoryId?: string | null;
}) {
  return (
    <Canvas camera={{ position: [0, 1.2, 3], fov: 45 }} dpr={[1, 1.5]} style={{ width: "100%", height: "100%" }} gl={{ antialias: false, alpha: true, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, outputColorSpace: THREE.SRGBColorSpace }} onCreated={({ gl }) => { const c = gl.domElement; c.addEventListener("webglcontextlost", (e) => { e.preventDefault(); }); c.addEventListener("webglcontextrestored", () => {}); }}>
      <AssetLoaderInit />
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 3]} intensity={1.2} castShadow />
      <directionalLight position={[-2, 3, -1]} intensity={0.4} />
      <pointLight position={[0, 2, 2]} intensity={0.5} color="#aaccff" />
      {modelPath ? (
        <SceneErrorBoundary resetKey={modelPath} label="CharacterPreview" fallback={
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[0.6, 1.6, 0.4]} />
            <meshStandardMaterial color="#a44" wireframe />
          </mesh>
        }>
          <Suspense fallback={
            <group position={[0, 0.9, 0]}>
              <mesh>
                <capsuleGeometry args={[0.28, 0.7, 8, 16]} />
                <meshStandardMaterial color="#4a90d9" transparent opacity={0.35} />
              </mesh>
              <Text
                position={[0, 1.1, 0]}
                fontSize={0.18}
                color="#ffd966"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.012}
                outlineColor="#000000"
              >
                Forging hero...
              </Text>
            </group>
          }>
            <CharacterPreview
              modelPath={modelPath} scale={scale} materialColors={materialColors}
              materialMap={materialMap} previewAnim={previewAnim}
              weaponRight={weaponRight} weaponLeft={weaponLeft}
              onAnalysis={onAnalysis}
              bodyMorph={bodyMorph} autoRotate={autoRotate}
              externalAnimUrl={externalAnimUrl} externalAnimClipName={externalAnimClipName} onExternalAnimLoaded={onExternalAnimLoaded}
              weaponOffset={weaponOffset} onWeaponOffsetChange={onWeaponOffsetChange}
              gizmoMode={gizmoMode} onHandBones={onHandBones} tPose={tPose}
              weaponModelRight={weaponModelRight} weaponModelLeft={weaponModelLeft}
              backAccessoryId={backAccessoryId}
            />
          </Suspense>
        </SceneErrorBoundary>
      ) : (
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[0.6, 1.6, 0.4]} />
          <meshStandardMaterial color="#666" wireframe />
        </mesh>
      )}
      <HeightMarkers showMarkers={showHeightMarkers || false} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[1.5, 32]} />
        <meshStandardMaterial color="#2a2a3a" />
      </mesh>
      <gridHelper args={[4, 8, "#333", "#222"]} position={[0, 0.001, 0]} />
      <OrbitControls
        makeDefault
        enableZoom={true} enablePan={true} enableRotate={true}
        minDistance={0.5} maxDistance={10}
        minPolarAngle={0.05} maxPolarAngle={Math.PI - 0.05}
        target={[0, 0.9, 0]}
      />
    </Canvas>
  );
}

const sty = {
  label: { fontSize: 10, color: "#777", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 },
  sectionHeader: { color: "#888", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4, fontSize: 9 },
  panel: { background: "rgba(255,255,255,0.04)", padding: 6, borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)" },
  panelText: { background: "rgba(255,255,255,0.04)", padding: 6, borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)", fontSize: 10 },
  panelScroll: (maxH = 80) => ({ maxHeight: maxH, overflowY: "auto" as const, background: "rgba(255,255,255,0.04)", padding: 6, borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)", fontSize: 10 }),
  swatch: (selected: boolean) => ({
    width: 20, height: 20, borderRadius: 3, cursor: "pointer",
    border: selected ? "2px solid #fff" : "2px solid transparent",
    transition: "border 0.1s",
  }),
  btn: (active: boolean, _color = "#c9950a") => ({
    padding: "3px 8px", fontSize: 9, borderRadius: 3, cursor: "pointer",
    background: active ? "rgba(201,149,10,0.25)" : "rgba(255,255,255,0.06)",
    border: active ? "1px solid rgba(201,149,10,0.5)" : "1px solid rgba(255,255,255,0.1)",
    color: active ? "#f0d68a" : "#c9a86c", textTransform: "capitalize" as const,
  }),
};

export default function CharacterSelectScreen() {
  const { startLoading } = useGame();
  const { reset: resetSurvival } = useSurvival();
  const { reset: resetInventory } = useInventory();
  const { reset: resetEnemies } = useEnemyManager();
  const { initHero } = useCharacterStats();

  // Belt-and-suspenders: also kick off Hero Forge model preload here in case
  // the user reaches this screen without going through the main menu first.
  // Same for the intro cutscene's animation pack — character select is the
  // last screen before the intro plays, so warming the clip files now keeps
  // the cutscene from stalling on cold network/disk. Both kickoff functions
  // are idempotent and a no-op if already warm.
  useEffect(() => {
    injectCharSelectCSS();
    kickoffHeroForgePreload();
    kickoffIntroAnimPreload();
  }, []);

  const [heroName, setHeroName] = useState("Hero");
  const [scale, setScale] = useState(1.0);
  const [speedMult, setSpeedMult] = useState(1.0);
  const [previewAnim, setPreviewAnim] = useState("Idle");
  const [raceFilter, setRaceFilter] = useState<string | null>(null);
  const [combatClass, setCombatClass] = useState<CombatClass>(BASE_CHARACTER.defaultClass);
  const [weaponRight, setWeaponRight] = useState<WeaponType>(BASE_CHARACTER.defaultWeaponRight);
  const [weaponLeft, setWeaponLeft] = useState<WeaponType | null>(BASE_CHARACTER.defaultWeaponLeft);
  const [matColors, setMatColors] = useState<MaterialColors>({ skin: null, clothing: null, pants: null, hair: null, hat: null, armor: null, detail: null });
  const [activeTab, setActiveTab] = useState<"class" | "colors" | "anims" | "body" | "weapons" | "info" | "studio" | "edit" | "debug">("class");
  const [showDevTools, setShowDevTools] = useState<boolean>(() => {
    try { return localStorage.getItem("hero_forge_dev") === "1"; } catch { return false; }
  });
  const [editMode, setEditMode] = useState(false);
  const [panelHeight, setPanelHeight] = useState(340);
  const panelDragRef = useRef<{ startY: number; startH: number } | null>(null);
  const [modelAnalysis, setModelAnalysis] = useState<ModelAnalysis | null>(null);
  const [bodyMorph, setBodyMorph] = useState<BodyMorphConfig>({ ...DEFAULT_BODY_MORPH });
  const [autoRotate, setAutoRotate] = useState(false);
  const [selectedAnimPack, setSelectedAnimPack] = useState<string | null>(null);
  const [externalAnimUrl, setExternalAnimUrl] = useState<string | null>(null);
  const [externalAnimClipName, setExternalAnimClipName] = useState<string | undefined>(undefined);
  const [playingExternal, setPlayingExternal] = useState<string>("");
  const [weaponOffset, setWeaponOffset] = useState<WeaponOffsetConfig>({ ...DEFAULT_WEAPON_OFFSET });
  const [gizmoMode, setGizmoMode] = useState<"translate" | "rotate" | "scale" | null>(null);
  const [morphGroup, setMorphGroup] = useState<MorphGroup>("build");
  const [presetName, setPresetName] = useState("");
  const [showHeightMarkers, setShowHeightMarkers] = useState(false);
  const [weaponModelRight, setWeaponModelRight] = useState<string | null>(() => getDefaultWeaponModelId(BASE_CHARACTER.defaultWeaponRight));
  const [weaponModelLeft, setWeaponModelLeft] = useState<string | null>(() => getDefaultWeaponModelId(BASE_CHARACTER.defaultWeaponLeft));
  const [arrowModelId, setArrowModelId] = useState<string | null>(null);
  const [backAccessoryId, setBackAccessoryId] = useState<string | null>(null);
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [currentModelPath, setCurrentModelPath] = useState<string>(BASE_CHARACTER.modelPath);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [presetFilter, setPresetFilter] = useState<StylePreset["category"] | "all">("all");
  const [savedPresets, setSavedPresets] = useState<Record<string, any>>(() => {
    try { return JSON.parse(localStorage.getItem("character_presets") || "{}"); } catch { return {}; }
  });
  const [weaponOffsetPresets, setWeaponOffsetPresets] = useWeaponOffsetPresetsStore();
  const [offsetPresetName, setOffsetPresetName] = useState("");

  const offsetComboKey = useMemo(
    () => weaponOffsetComboKey(BASE_CHARACTER.id, weaponRight, weaponLeft),
    [weaponRight, weaponLeft],
  );
  const offsetComboEntry = weaponOffsetPresets[offsetComboKey];
  const offsetComboPresets = offsetComboEntry?.presets ?? {};
  const activeOffsetPresetName = offsetComboEntry?.active;
  const offsetPresetNames = useMemo(
    () => Object.keys(offsetComboPresets).sort(),
    [offsetComboPresets],
  );

  const lastAutoLoadedOffsetComboRef = useRef<string | null>(null);
  useEffect(() => {
    const entry = weaponOffsetPresets[offsetComboKey];
    const activeOffset = entry?.active ? entry.presets[entry.active] : undefined;
    const sigKey = `${offsetComboKey}|${entry?.active ?? ""}|${
      activeOffset ? JSON.stringify(activeOffset) : ""
    }`;
    if (lastAutoLoadedOffsetComboRef.current === sigKey) return;
    lastAutoLoadedOffsetComboRef.current = sigKey;
    if (activeOffset) {
      setWeaponOffset(cloneWeaponOffset(activeOffset));
    }
  }, [offsetComboKey, weaponOffsetPresets]);

  const applyOffsetPreset = useCallback((name: string) => {
    setWeaponOffsetPresets(prev => {
      const entry = prev[offsetComboKey];
      if (!entry?.presets[name]) return prev;
      const next: WeaponOffsetPresetsStore = {
        ...prev,
        [offsetComboKey]: { presets: entry.presets, active: name },
      };
      writeWeaponOffsetPresets(next);
      const offset = entry.presets[name];
      setWeaponOffset(cloneWeaponOffset(offset));
      lastAutoLoadedOffsetComboRef.current = `${offsetComboKey}|${name}|${JSON.stringify(offset)}`;
      return next;
    });
  }, [offsetComboKey, setWeaponOffsetPresets]);

  const saveOffsetPreset = useCallback((rawName: string) => {
    const name = rawName.trim();
    if (!name) return;
    setWeaponOffsetPresets(prev => {
      const existing = prev[offsetComboKey] ?? { presets: {}, active: undefined };
      const next: WeaponOffsetPresetsStore = {
        ...prev,
        [offsetComboKey]: {
          presets: { ...existing.presets, [name]: cloneWeaponOffset(weaponOffset) },
          active: name,
        },
      };
      writeWeaponOffsetPresets(next);
      lastAutoLoadedOffsetComboRef.current = offsetComboKey;
      return next;
    });
    setOffsetPresetName("");
  }, [offsetComboKey, weaponOffset]);

  const deleteOffsetPreset = useCallback((name: string) => {
    setWeaponOffsetPresets(prev => {
      const entry = prev[offsetComboKey];
      if (!entry?.presets[name]) return prev;
      const { [name]: _removed, ...rest } = entry.presets;
      const next: WeaponOffsetPresetsStore = { ...prev };
      if (Object.keys(rest).length === 0) {
        delete next[offsetComboKey];
      } else {
        next[offsetComboKey] = {
          presets: rest,
          active: entry.active === name ? undefined : entry.active,
        };
      }
      writeWeaponOffsetPresets(next);
      lastAutoLoadedOffsetComboRef.current = offsetComboKey;
      return next;
    });
  }, [offsetComboKey]);

  const currentChar = BASE_CHARACTER;
  const allPacks = getAllAnimationPacks();
  const weaponMapping = WEAPON_ANIM_MAPPING.find(m => m.weaponType === weaponRight);
  const recommendedPacks = getRecommendedAnimPacks(weaponRight);
  const availableWeaponModels = ALL_WEAPON_CATALOG.filter(w => w.weaponType === weaponRight);

  const filteredPresets = useMemo(() => {
    let list = presetFilter === "all" ? STYLE_PRESETS : STYLE_PRESETS.filter(p => p.category === presetFilter);
    if (raceFilter) {
      const rf = RACE_PORTRAITS.find(r => r.id === raceFilter);
      if (rf) list = list.filter(p => p.modelPath?.includes(rf.modelFilter));
    }
    return list;
  }, [presetFilter, raceFilter]);

  // Class color palette for the active combatClass
  const classPalette = CHAR_CLASS_COLORS[combatClass] ?? { main: "#c9950a", bg: "rgba(201,149,10,.08)", border: "rgba(201,149,10,.3)" };

  const applyPreset = useCallback((preset: StylePreset) => {
    setCombatClass(preset.combatClass);
    setWeaponRight(preset.weaponRight);
    setWeaponLeft(preset.weaponLeft);
    const fullColors: MaterialColors = { skin: null, clothing: null, pants: null, hair: null, hat: null, armor: null, detail: null };
    for (const [k, v] of Object.entries(preset.matColors)) {
      (fullColors as any)[k] = v;
    }
    setMatColors(fullColors);
    if (preset.bodyMorph) {
      setBodyMorph({ ...DEFAULT_BODY_MORPH, ...preset.bodyMorph });
    } else {
      setBodyMorph({ ...DEFAULT_BODY_MORPH });
    }
    setWeaponOffset({ ...DEFAULT_WEAPON_OFFSET });
    // Auto-equip a default weapon model for each weapon type so the
    // character actually has a weapon mesh in hand at game start. Without
    // this, picking a hammer-wielding preset would leave weaponModelRight
    // null — the hands would close on empty space and the procedural grip
    // pose would visibly cross.
    setWeaponModelRight(getDefaultWeaponModelId(preset.weaponRight));
    setWeaponModelLeft(getDefaultWeaponModelId(preset.weaponLeft));
    setArrowModelId(null);
    setBackAccessoryId(null);
    setCurrentModelPath(preset.modelPath || BASE_CHARACTER.modelPath);
    setActivePreset(preset.id);
    // Worge presets automatically wire the bear-form model path so Player.tsx
    // can swap to it on CLASS_ABILITY_3 without any extra UI config.
    // We store it in the character save but it's not surfaced as an editable
    // field — it's always derived from the race/class selection.
    // (handled downstream by startLoading / startWithCharacter in the confirm step)
  }, []);

  const saveCharacterEdits = useCallback((data: Record<string, any>) => {
    try {
      const all = JSON.parse(localStorage.getItem("character_edits") || "{}");
      all["hero"] = { ...data, _ts: Date.now() };
      localStorage.setItem("character_edits", JSON.stringify(all));
    } catch {}
  }, []);

  const autoSaveReady = useRef(false);

  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem("character_edits") || "{}");
      const saved = all["hero"];
      if (saved) {
        setHeroName(saved.heroName ?? "Hero");
        setScale(saved.scale && saved.scale > 0.5 ? saved.scale : 1.0);
        setSpeedMult(saved.speedMult ?? 1.0);
        const legacyClass = saved.combatClass === "archer" ? "ranger" : saved.combatClass;
        setCombatClass(legacyClass ?? BASE_CHARACTER.defaultClass);
        const resolvedWR = saved.weaponRight ?? BASE_CHARACTER.defaultWeaponRight;
        const resolvedWL = saved.weaponLeft !== undefined ? saved.weaponLeft : BASE_CHARACTER.defaultWeaponLeft;
        setWeaponRight(resolvedWR);
        setWeaponLeft(resolvedWL);
        setMatColors(saved.matColors ?? { skin: null, clothing: null, pants: null, hair: null, hat: null, armor: null, detail: null });
        setBodyMorph({ ...DEFAULT_BODY_MORPH, ...Object.fromEntries(Object.entries(saved.bodyMorph ?? {}).filter(([k]) => k in DEFAULT_BODY_MORPH)) });
        setWeaponOffset(saved.weaponOffset ?? { ...DEFAULT_WEAPON_OFFSET });
        // (Faction is now derived from the selected model — saved.faction is ignored.)
        // Auto-fill weapon models when missing from the save (legacy saves
        // predate the auto-equip behavior) so the player never starts with
        // empty hands and a crossed-fists grip pose.
        setWeaponModelRight(saved.weaponModelRight ?? getDefaultWeaponModelId(resolvedWR));
        setWeaponModelLeft(saved.weaponModelLeft ?? getDefaultWeaponModelId(resolvedWL));
        setArrowModelId(saved.arrowModelId ?? null);
        setBackAccessoryId(saved.backAccessoryId ?? null);
        const savedPath = saved.currentModelPath as string | undefined;
        // Saves whose previous model is no longer in Hero Forge (grave knight,
        // werewolf, lizardfolk, night stalker — now NPC/worge-only) need a
        // wholesale reset to a matching preset. Otherwise the player ends up
        // wearing greatsword-tank gear on an Elf ranger body, etc.
        if (savedPath && REMOVED_HERO_FORGE_MODELS.has(savedPath)) {
          const targetClass = legacyClass ?? BASE_CHARACTER.defaultClass;
          const targetRightWeapon = saved.weaponRight ?? BASE_CHARACTER.defaultWeaponRight;
          const fallback =
            STYLE_PRESETS.find(p => p.combatClass === targetClass && p.weaponRight === targetRightWeapon)
            ?? STYLE_PRESETS.find(p => p.combatClass === targetClass)
            ?? STYLE_PRESETS[0];
          if (fallback) {
            setCombatClass(fallback.combatClass);
            setWeaponRight(fallback.weaponRight);
            setWeaponLeft(fallback.weaponLeft);
            const fullColors: MaterialColors = { skin: null, clothing: null, pants: null, hair: null, hat: null, armor: null, detail: null };
            for (const [k, v] of Object.entries(fallback.matColors)) {
              (fullColors as any)[k] = v;
            }
            setMatColors(fullColors);
            setBodyMorph(fallback.bodyMorph ? { ...DEFAULT_BODY_MORPH, ...fallback.bodyMorph } : { ...DEFAULT_BODY_MORPH });
            setWeaponOffset({ ...DEFAULT_WEAPON_OFFSET });
            setWeaponModelRight(getDefaultWeaponModelId(fallback.weaponRight));
            setWeaponModelLeft(getDefaultWeaponModelId(fallback.weaponLeft));
            setArrowModelId(null);
            setBackAccessoryId(null);
            setCurrentModelPath(fallback.modelPath ?? BASE_CHARACTER.modelPath);
          } else {
            setCurrentModelPath(BASE_CHARACTER.modelPath);
          }
        } else {
          setCurrentModelPath(savedPath ?? BASE_CHARACTER.modelPath);
        }
      }
    } catch {}
    setTimeout(() => { autoSaveReady.current = true; }, 100);
  }, []);

  useEffect(() => {
    if (!autoSaveReady.current) return;
    saveCharacterEdits({
      heroName, scale, speedMult, combatClass, weaponRight, weaponLeft, matColors,
      bodyMorph, weaponOffset, weaponModelRight, weaponModelLeft, arrowModelId, backAccessoryId, currentModelPath,
    });
  }, [heroName, scale, speedMult, combatClass, weaponRight, weaponLeft, matColors, bodyMorph, weaponOffset, weaponModelRight, weaponModelLeft, arrowModelId, backAccessoryId, currentModelPath, saveCharacterEdits]);

  const handleWeaponOffsetChange = useCallback((hand: "right" | "left", pos: [number, number, number], rot: [number, number, number], scl: [number, number, number]) => {
    setWeaponOffset(prev => ({
      ...prev,
      ...(hand === "right" ? { rightPos: pos, rightRot: rot, rightScale: scl } : { leftPos: pos, leftRot: rot, leftScale: scl }),
    }));
  }, []);

  const handleExternalAnimLoaded = useCallback((name: string) => {
    setPlayingExternal(name);
  }, []);

  const handlePanelDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    panelDragRef.current = { startY: e.clientY, startH: panelHeight };
    const onMove = (ev: MouseEvent) => {
      if (!panelDragRef.current) return;
      const dy = panelDragRef.current.startY - ev.clientY;
      const newH = Math.max(150, Math.min(window.innerHeight * 0.8, panelDragRef.current.startH + dy));
      setPanelHeight(newH);
    };
    const onUp = () => {
      panelDragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelHeight]);

  const savePreset = useCallback((name: string) => {
    if (!name.trim()) return;
    const preset = {
      heroName, scale, speedMult, combatClass,
      weaponRight, weaponLeft, matColors, bodyMorph, weaponOffset,
      weaponModelRight, weaponModelLeft, arrowModelId, backAccessoryId, currentModelPath,
    };
    const updated = { ...savedPresets, [name.trim()]: preset };
    setSavedPresets(updated);
    localStorage.setItem("character_presets", JSON.stringify(updated));
    setPresetName("");
  }, [heroName, scale, speedMult, combatClass, weaponRight, weaponLeft, matColors, bodyMorph, weaponOffset, savedPresets, currentModelPath, weaponModelRight, weaponModelLeft, arrowModelId, backAccessoryId]);

  const loadPreset = useCallback((name: string) => {
    const preset = savedPresets[name];
    if (!preset) return;
    if (preset.heroName) setHeroName(preset.heroName);
    if (preset.scale) setScale(preset.scale);
    if (preset.speedMult) setSpeedMult(preset.speedMult);
    if (preset.combatClass) setCombatClass(preset.combatClass);
    if (preset.weaponRight) {
      setWeaponRight(preset.weaponRight);
      if (preset.weaponModelRight === undefined) {
        setWeaponModelRight(getDefaultWeaponModelId(preset.weaponRight));
      }
    }
    if (preset.weaponLeft !== undefined) {
      setWeaponLeft(preset.weaponLeft);
      if (preset.weaponModelLeft === undefined) {
        setWeaponModelLeft(getDefaultWeaponModelId(preset.weaponLeft));
      }
    }
    if (preset.matColors) setMatColors(preset.matColors);
    if (preset.bodyMorph) setBodyMorph({ ...DEFAULT_BODY_MORPH, ...Object.fromEntries(Object.entries(preset.bodyMorph).filter(([k]) => k in DEFAULT_BODY_MORPH)) });
    if (preset.weaponOffset) setWeaponOffset(preset.weaponOffset);
    if (preset.weaponModelRight !== undefined) setWeaponModelRight(preset.weaponModelRight);
    if (preset.weaponModelLeft !== undefined) setWeaponModelLeft(preset.weaponModelLeft);
    if (preset.arrowModelId !== undefined) setArrowModelId(preset.arrowModelId);
    if (preset.backAccessoryId !== undefined) setBackAccessoryId(preset.backAccessoryId);
    if (preset.currentModelPath) setCurrentModelPath(preset.currentModelPath);
    // (Faction is now derived from the selected model — preset.faction ignored.)
  }, [savedPresets]);

  const deletePreset = useCallback((name: string) => {
    const updated = { ...savedPresets };
    delete updated[name];
    setSavedPresets(updated);
    localStorage.setItem("character_presets", JSON.stringify(updated));
  }, [savedPresets]);

  const handlePlayPackAnim = useCallback((pack: AnimationPackEntry, animFile: string) => {
    if (pack.bundledFile) {
      const url = `${pack.basePath}/${pack.bundledFile}`;
      setExternalAnimUrl(url);
      setExternalAnimClipName(animFile);
    } else {
      const url = `${pack.basePath}/${animFile}`;
      setExternalAnimUrl(url);
      setExternalAnimClipName(undefined);
    }
  }, []);

  const handleConfirm = () => {
    const isDefaultMorph = Object.entries(bodyMorph).every(([_, v]) => v === 1.0);
    const isDefaultOffset = weaponOffset.rightPos.every(v => v === 0) && weaponOffset.rightRot.every(v => v === 0)
      && weaponOffset.rightScale.every(v => v === 1) && weaponOffset.leftPos.every(v => v === 0)
      && weaponOffset.leftRot.every(v => v === 0) && weaponOffset.leftScale.every(v => v === 1);
    // Detect Worge presets by model path so the bear-form model gets wired
    // automatically — no manual field needed in Hero Forge.
    const isWorgePath = currentModelPath?.includes("night_stalker");
    const worgeFormModelPath = isWorgePath
      ? "/models/characters/stylized_nightmarish_werewolf.glb"
      : undefined;

    const config: CharacterConfig = {
      characterId: BASE_CHARACTER.id,
      modelPath: currentModelPath, name: heroName || "Hero", scale,
      baseHeight: BASE_CHARACTER.baseHeight,
      speedMultiplier: speedMult, combatClass, weaponRight, weaponLeft, materialColors: matColors,
      bodyMorph: isDefaultMorph ? undefined : bodyMorph,
      weaponOffset: isDefaultOffset ? undefined : weaponOffset,
      weaponModelRight: weaponModelRight || undefined,
      weaponModelLeft: weaponModelLeft || undefined,
      arrowModelId: arrowModelId || undefined,
      backAccessoryId: backAccessoryId || undefined,
      faction: getFactionForModel(currentModelPath),
      worgeFormModelPath,
    };
    initHero(BASE_CHARACTER.id);
    resetSurvival(); resetInventory(); resetEnemies();
    useSurvival.getState().setActiveCharacter(BASE_CHARACTER.id);
    const stats = useCharacterStats.getState().getSecondaryStats(BASE_CHARACTER.id);
    if (stats) {
      useSurvival.setState({
        maxHealth: stats.health,
        health: stats.health,
        maxStamina: stats.stamina,
        stamina: stats.stamina,
      });
    }
    startLoading(config);
  };

  const uniqueParts = useMemo(() => {
    if (Object.keys(currentChar.materialMap).length > 0) {
      return [...new Set(Object.values(currentChar.materialMap))] as (keyof MaterialColors)[];
    }
    if (modelAnalysis) {
      const cats = Object.values(modelAnalysis.materialCategories);
      const mapped = [...new Set(cats.map(c => CATEGORY_MAP[c]))];
      if (!mapped.includes("pants")) mapped.push("pants");
      return mapped.length > 0 ? mapped : (["skin", "clothing", "pants", "armor", "detail"] as (keyof MaterialColors)[]);
    }
    return ["skin", "clothing", "pants", "hair", "hat", "armor", "detail"] as (keyof MaterialColors)[];
  }, [currentChar.materialMap, modelAnalysis]);

  const updateMorph = useCallback((key: keyof BodyMorphConfig, value: number) => {
    setBodyMorph(prev => ({ ...prev, [key]: value }));
  }, []);

  // Player-facing tabs: the five things you actually configure to make a hero.
  const playerTabs = [
    { key: "class" as const, label: "Class" },
    { key: "weapons" as const, label: "Weapons" },
    { key: "colors" as const, label: "Appearance" },
    { key: "body" as const, label: "Body" },
    { key: "anims" as const, label: "Animations" },
  ];
  // Dev/debug tabs — hidden behind the "Dev Tools" toggle. These are for
  // model rigging, gizmo tuning, and engine inspection — not character choice.
  const devTabs = [
    { key: "edit" as const, label: "Edit Mode" },
    { key: "studio" as const, label: "Studio" },
    { key: "info" as const, label: "Model Info" },
    { key: "debug" as const, label: "Debug" },
  ];
  const tabs = showDevTools ? [...playerTabs, ...devTabs] : playerTabs;
  const toggleDevTools = () => {
    setShowDevTools(prev => {
      const next = !prev;
      try { localStorage.setItem("hero_forge_dev", next ? "1" : "0"); } catch {}
      // If we're hiding the dev tabs and one is active, snap back to Class.
      if (!next && devTabs.some(t => t.key === activeTab)) setActiveTab("class");
      return next;
    });
  };

  const derivedFaction = getFaction(getFactionForModel(currentModelPath));

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "#05060c",
      display: "flex", color: "#fff", fontFamily: "'Crimson Text', serif", overflow: "hidden",
      position: "relative",
    }}>
      {/* ── Animated class background ── */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
        {(["melee", "caster", "ranger"] as (keyof typeof CHAR_CLASS_BG)[]).map(cls => (
          <div
            key={cls}
            className={`cs-stage-bg${cls === combatClass ? " active" : ""}`}
            style={{ backgroundImage: `url('${CHAR_CLASS_BG[cls]}')` }}
          />
        ))}
        {/* Vignette */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: [
            "radial-gradient(1200px 700px at 50% 110%,rgba(0,0,0,.82),transparent 55%)",
            "linear-gradient(180deg,rgba(5,6,12,.55),rgba(5,6,12,.90))",
          ].join(","),
        }} />
        {/* Class-color sheen */}
        <div style={{
          position: "absolute", inset: "-20%", pointerEvents: "none",
          background: `conic-gradient(from 0deg at 60% 30%,${classPalette.main}14,transparent 30%,rgba(199,146,255,.06) 60%,transparent 80%)`,
          filter: "blur(50px)", opacity: 0.7,
          transition: "background 1.2s ease",
        }} />
      </div>

      {/* All panels are z:1 to sit above background */}
      <div style={{
        position: "relative", zIndex: 1,
        flex: "0 0 280px", borderRight: `1px solid ${classPalette.border}`,
        display: "flex", flexDirection: "column",
        background: "linear-gradient(180deg,rgba(6,8,14,.88),rgba(4,6,12,.9))",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ padding: "10px 12px 8px", borderBottom: `1px solid ${classPalette.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              {/* Gold gradient brand */}
              <div style={{
                fontFamily: "'MorkDungeon', 'Cinzel', serif",
                fontWeight: 900, letterSpacing: "3px", fontSize: 18,
                background: "linear-gradient(90deg,#f6c945,#fff3c2 50%,#f6c945)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 12px rgba(246,201,69,.2))",
              }}>HERO FORGE</div>
              <div style={{ fontSize: 8, color: "#9aa3c7", letterSpacing: "2px", fontFamily: "'Cinzel',serif", marginTop: 1 }}>CHARACTER CREATOR</div>
            </div>
            <button onClick={() => useGame.getState().goToGGE()}
              style={{
                padding: "3px 8px", fontSize: 8, borderRadius: 6, cursor: "pointer",
                background: classPalette.bg, border: `1px solid ${classPalette.border}`,
                color: classPalette.main, textTransform: "uppercase", letterSpacing: 1,
              }}>GGE</button>
          </div>
        </div>

        <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(201,149,10,0.1)" }}>
          <div style={{ fontSize: 8, color: "#c9a86c", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontFamily: "'Cinzel', serif" }}>Hero Name</div>
          <input type="text" value={heroName}
            onChange={(e) => setHeroName(e.target.value)}
            style={{
              width: "100%", padding: "5px 8px", fontSize: 12, borderRadius: 4,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff", outline: "none", fontWeight: "bold", boxSizing: "border-box",
            }} />
          {/* Faction is derived from the chosen race — show it as a read-only badge so the player knows
              what banner they'll fight under. Class lives in the Class tab; we don't duplicate it here. */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "5px 8px", borderRadius: 4,
            background: `linear-gradient(135deg, ${derivedFaction.colorDark}55 0%, rgba(0,0,0,0.35) 100%)`,
            border: `1px solid ${derivedFaction.color}55`,
          }}>
            <img src={derivedFaction.emblem} alt={derivedFaction.name}
              style={{ width: 22, height: 22, objectFit: "contain", flex: "0 0 auto" }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 7, color: "#c9a86c", textTransform: "uppercase", letterSpacing: 1, fontFamily: "'Cinzel', serif" }}>Faction</div>
              <div style={{
                fontSize: 11, fontFamily: "'Cinzel', serif", fontWeight: 600, letterSpacing: 0.5,
                color: derivedFaction.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{derivedFaction.name}</div>
            </div>
          </div>
        </div>

        {/* Race portrait grid — click to filter presets by race */}
        <div style={{ padding: "8px 10px 6px", borderBottom: `1px solid ${classPalette.border}` }}>
          <div style={{ fontSize: 8, color: "#9aa3c7", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, fontFamily: "'Cinzel',serif" }}>Race</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
            {RACE_PORTRAITS.map(race => {
              const isActive = raceFilter === race.id;
              return (
                <div
                  key={race.id}
                  className={`cs-race-card${isActive ? " active" : ""}`}
                  onClick={() => setRaceFilter(isActive ? null : race.id)}
                  title={race.name}
                >
                  <div
                    className="cs-portrait"
                    style={{ backgroundImage: `url('${race.portrait}')` }}
                  />
                  <span className="cs-race-label">{race.name}</span>
                </div>
              );
            })}
          </div>
          {raceFilter && (
            <button
              onClick={() => setRaceFilter(null)}
              style={{
                marginTop: 5, width: "100%", padding: "3px 0", fontSize: 8,
                background: "rgba(246,201,69,.08)", border: "1px solid rgba(246,201,69,.25)",
                borderRadius: 5, color: "#f6c945", cursor: "pointer",
                fontFamily: "'Cinzel',serif", letterSpacing: 1,
              }}
            >✕ Clear Race Filter</button>
          )}
        </div>

        <div style={{ padding: "6px 10px 4px", borderBottom: `1px solid ${classPalette.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 9, color: classPalette.main, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'Cinzel', serif" }}>Style Presets</div>
            <span style={{ fontSize: 7, color: "#555" }}>{filteredPresets.length} styles</span>
          </div>
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap", marginBottom: 4 }}>
            <button onClick={() => setPresetFilter("all")}
              style={{
                padding: "2px 6px", fontSize: 7, borderRadius: 2, cursor: "pointer",
                background: presetFilter === "all" ? "rgba(201,149,10,0.25)" : "rgba(255,255,255,0.06)",
                border: presetFilter === "all" ? "1px solid rgba(201,149,10,0.4)" : "1px solid rgba(255,255,255,0.08)",
                color: presetFilter === "all" ? "#fff" : "#888",
              }}>All</button>
            {PRESET_CATEGORIES.map(cat => (
              <button key={cat.key} onClick={() => setPresetFilter(cat.key)}
                style={{
                  padding: "2px 6px", fontSize: 7, borderRadius: 2, cursor: "pointer",
                  background: presetFilter === cat.key ? `${cat.color}44` : "rgba(255,255,255,0.06)",
                  border: presetFilter === cat.key ? `1px solid ${cat.color}` : "1px solid rgba(255,255,255,0.08)",
                  color: presetFilter === cat.key ? cat.color : "#888",
                }}>{cat.label}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "3px 5px" }}>
          {filteredPresets.map((preset) => {
            const isActive = activePreset === preset.id;
            const catInfo = PRESET_CATEGORIES.find(c => c.key === preset.category);
            return (
              <div key={preset.id} onClick={() => applyPreset(preset)}
                style={{
                  padding: "6px 8px", marginBottom: 2, borderRadius: 8, cursor: "pointer",
                  background: isActive
                    ? `linear-gradient(135deg, ${classPalette.bg}, rgba(0,0,0,.4))`
                    : "rgba(255,255,255,0.02)",
                  border: isActive ? `1px solid ${classPalette.border}` : "1px solid transparent",
                  borderLeft: isActive ? `3px solid ${classPalette.main}` : "3px solid transparent",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.1)"; }}}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "transparent"; }}}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: isActive ? "bold" : "normal", color: isActive ? classPalette.main : "#f0e8d8" }}>
                    <span style={{ marginRight: 4 }}>{preset.icon}</span>{preset.name}
                  </span>
                  <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                    <span style={{ fontSize: 7, padding: "1px 3px", borderRadius: 2, background: `${catInfo?.color || "#888"}22`, color: catInfo?.color || "#888", textTransform: "uppercase" }}>{preset.category}</span>
                    <span style={{ fontSize: 9, color: "#888" }}>{CLASS_INFO[preset.combatClass].icon}</span>
                  </div>
                </div>
                {isActive && <div style={{ fontSize: 8, color: classPalette.main, marginTop: 2, lineHeight: 1.3, opacity: 0.85 }}>{preset.description}</div>}
              </div>
            );
          })}

          {Object.keys(savedPresets).length > 0 && (
            <>
              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 0" }} />
              <div style={{ fontSize: 8, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, padding: "0 4px" }}>Saved Builds</div>
              {Object.keys(savedPresets).map(name => (
                <div key={name} style={{ display: "flex", gap: 3, alignItems: "center", padding: "3px 4px" }}>
                  <button onClick={() => loadPreset(name)}
                    style={{
                      flex: 1, padding: "4px 8px", fontSize: 9, borderRadius: 3, cursor: "pointer", textAlign: "left",
                      background: "rgba(201,149,10,0.1)", border: "1px solid rgba(201,149,10,0.2)", color: "#c9950a",
                    }}>{name}</button>
                  <button onClick={() => deletePreset(name)}
                    style={{
                      padding: "3px 5px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                      background: "rgba(181,74,58,0.1)", border: "1px solid rgba(181,74,58,0.2)", color: "#b54a3a",
                    }}>x</button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
          <PreviewCanvas
            modelPath={currentModelPath} scale={scale} materialColors={matColors}
            materialMap={currentChar.materialMap} previewAnim={previewAnim}
            weaponRight={weaponRight} weaponLeft={weaponLeft}
            onAnalysis={setModelAnalysis}
            bodyMorph={bodyMorph} autoRotate={autoRotate}
            externalAnimUrl={externalAnimUrl} externalAnimClipName={externalAnimClipName} onExternalAnimLoaded={handleExternalAnimLoaded}
            weaponOffset={weaponOffset} onWeaponOffsetChange={handleWeaponOffsetChange}
            gizmoMode={editMode ? gizmoMode : null}
            tPose={editMode}
            showHeightMarkers={showHeightMarkers}
            weaponModelRight={weaponModelRight}
            weaponModelLeft={weaponModelLeft}
            backAccessoryId={backAccessoryId}
          />
          <div style={{
            position: "absolute", top: 8, left: 8,
            background: "linear-gradient(135deg,rgba(6,8,16,.85),rgba(4,5,12,.9))",
            padding: "8px 12px", borderRadius: 10,
            border: `1px solid ${classPalette.border}`,
            backdropFilter: "blur(10px)",
            boxShadow: `0 8px 24px rgba(0,0,0,.4)`,
          }}>
            <div style={{ fontSize: 16, fontWeight: "bold", color: classPalette.main }}>{heroName || "Hero"}</div>
            <div style={{ fontSize: 9, color: "#aaa", marginTop: 2 }}>
              {CLASS_INFO[combatClass].icon} {CLASS_INFO[combatClass].label} &bull; {getWeaponPairDescription(weaponRight, weaponLeft)}
              {activePreset && <span style={{ color: "#666", marginLeft: 6 }}>({STYLE_PRESETS.find(p => p.id === activePreset)?.name})</span>}
            </div>
            {modelAnalysis && <div style={{ fontSize: 7, color: "#666", marginTop: 2 }}>{modelAnalysis.meshCount} meshes | {modelAnalysis.vertexCount.toLocaleString()} verts | {modelAnalysis.boneNames.length} bones</div>}
            {playingExternal && <div style={{ fontSize: 8, color: "#ab47bc", marginTop: 2 }}>Playing: {playingExternal}</div>}
          </div>
          <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4, flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => { setEditMode(!editMode); if (!editMode) { setActiveTab("edit"); setGizmoMode("translate"); } else { setGizmoMode(null); } }}
                style={{ padding: "3px 7px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                  background: editMode ? "rgba(255,87,34,0.4)" : "rgba(255,255,255,0.06)",
                  border: editMode ? "1px solid rgba(255,87,34,0.7)" : "1px solid rgba(255,87,34,0.3)",
                  color: editMode ? "#ff5722" : "#888", fontWeight: editMode ? "bold" : "normal" }}>
                {editMode ? "EXIT EDIT" : "Edit Mode"}
              </button>
              <button onClick={() => setAutoRotate(!autoRotate)}
                style={{ padding: "3px 7px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                  background: autoRotate ? "rgba(201,149,10,0.25)" : "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(201,149,10,0.3)", color: autoRotate ? "#c9950a" : "#888" }}>
                {autoRotate ? "Auto Spin" : "Free Cam"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 3 }}>
              <button onClick={() => setGizmoMode(gizmoMode === "translate" ? null : "translate")}
                style={{ padding: "3px 7px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                  background: gizmoMode === "translate" ? "rgba(76,175,80,0.3)" : "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(76,175,80,0.4)", color: gizmoMode === "translate" ? "#4caf50" : "#888" }}>
                Move
              </button>
              <button onClick={() => setGizmoMode(gizmoMode === "rotate" ? null : "rotate")}
                style={{ padding: "3px 7px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                  background: gizmoMode === "rotate" ? "rgba(255,152,0,0.3)" : "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,152,0,0.4)", color: gizmoMode === "rotate" ? "#ff9800" : "#888" }}>
                Rotate
              </button>
              <button onClick={() => setGizmoMode(gizmoMode === "scale" ? null : "scale")}
                style={{ padding: "3px 7px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                  background: gizmoMode === "scale" ? "rgba(171,71,188,0.3)" : "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(171,71,188,0.4)", color: gizmoMode === "scale" ? "#ab47bc" : "#888" }}>
                Scale
              </button>
              <button onClick={() => { setWeaponOffset({ ...DEFAULT_WEAPON_OFFSET }); setGizmoMode(null); }}
                style={{ padding: "3px 7px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>
                Reset
              </button>
            </div>
            {editMode && (
              <div style={{ background: "rgba(255,87,34,0.15)", padding: "3px 8px", borderRadius: 3, border: "1px solid rgba(255,87,34,0.3)", fontSize: 8, color: "#ff5722", fontWeight: "bold" }}>
                T-POSE | Weapon Editing Active
              </div>
            )}
            <div style={{ background: "rgba(0,0,0,0.6)", padding: "3px 6px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)", fontSize: 7, color: "#666" }}>
              {allPacks.length} packs | {allPacks.reduce((a, p) => a + p.animations.length, 0)} anims
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 6, left: 8, fontSize: 7, color: "#444" }}>
            Drag: rotate | Scroll: zoom | Right-drag: pan | Gizmo: position weapons
          </div>
        </div>

        <div style={{
          background: "linear-gradient(180deg,rgba(8,6,12,.92),rgba(4,5,10,.95))",
          borderTop: `1px solid ${classPalette.border}`,
          display: "flex", flexDirection: "column", height: panelHeight, overflow: "hidden", flexShrink: 0,
          backdropFilter: "blur(14px)",
        }}>
          <div onMouseDown={handlePanelDragStart}
            style={{
              height: 6, cursor: "ns-resize", display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(255,255,255,0.03)", flexShrink: 0,
            }}>
            <div style={{ width: 40, height: 2, borderRadius: 1, background: "rgba(201,149,10,0.25)" }} />
          </div>
          <div style={{ display: "flex", borderBottom: "1px solid rgba(201,149,10,0.1)", alignItems: "stretch" }}>
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, padding: "6px", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5,
                  fontFamily: "'Cinzel', serif",
                  background: activeTab === tab.key ? classPalette.bg : "transparent",
                  border: "none",
                  borderBottom: activeTab === tab.key ? `2px solid ${classPalette.main}` : "2px solid transparent",
                  color: activeTab === tab.key ? classPalette.main : "#8a7e6a", cursor: "pointer",
                  transition: "color .15s, background .15s",
                }}>{tab.label}</button>
            ))}
            <button
              onClick={toggleDevTools}
              title={showDevTools ? "Hide developer tabs (Edit Mode, Studio, Model Info, Debug)" : "Show developer tabs"}
              style={{
                flex: "0 0 auto", padding: "6px 10px", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5,
                fontFamily: "'Cinzel', serif",
                background: showDevTools ? "rgba(80,40,40,0.35)" : "transparent",
                border: "none", borderLeft: "1px solid rgba(201,149,10,0.1)",
                borderBottom: showDevTools ? "2px solid #b87a4a" : "2px solid transparent",
                color: showDevTools ? "#f0c08a" : "#6a5e4a", cursor: "pointer",
              }}>
              {showDevTools ? "Dev: ON" : "Dev"}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
            {activeTab === "class" && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 200px" }}>
                  <div style={sty.label}>Combat Class</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["melee", "caster", "ranger"] as CombatClass[]).map(cls => (
                      <button key={cls} onClick={() => setCombatClass(cls)}
                        style={{
                          padding: "5px 10px", fontSize: 10, borderRadius: 4, cursor: "pointer",
                          background: combatClass === cls ? "rgba(201,149,10,0.3)" : "rgba(255,255,255,0.06)",
                          border: combatClass === cls ? "1px solid rgba(201,149,10,0.5)" : "1px solid rgba(255,255,255,0.1)", color: combatClass === cls ? "#f0d68a" : "#c9a86c",
                        }}>{CLASS_INFO[cls].icon} {CLASS_INFO[cls].label}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 9, color: "#8a7e6a", marginTop: 3 }}>{CLASS_INFO[combatClass].desc}</div>
                </div>
                <div style={{ flex: "1 1 100px" }}>
                  <div style={sty.label}>Scale: {scale.toFixed(2)}x</div>
                  <input type="range" min="0.4" max="2.0" step="0.05" value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#c9950a" }} />
                </div>
                <div style={{ flex: "1 1 100px" }}>
                  <div style={sty.label}>Speed: {speedMult.toFixed(2)}x</div>
                  <input type="range" min="0.5" max="2.0" step="0.05" value={speedMult}
                    onChange={(e) => setSpeedMult(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#c9950a" }} />
                </div>
              </div>
            )}

            {activeTab === "weapons" && (() => {
              const rightGrip = getWeaponGripProfile(weaponRight);
              const pairDesc = getWeaponPairDescription(weaponRight, weaponLeft);
              const gripLabel = getGripLabel(weaponRight);
              const gripColor = rightGrip.style === "main_1h" ? "#4caf50" : rightGrip.style === "two_hand" ? "#ff9800" : rightGrip.style === "ranged_2h" ? "#c9950a" : rightGrip.style === "off_1h" ? "#ce93d8" : "#888";

              return (
              <div>
                <div style={{ background: `rgba(${gripColor === "#4caf50" ? "76,175,80" : gripColor === "#ff9800" ? "255,152,0" : gripColor === "#c9950a" ? "201,149,10" : "171,71,188"},0.1)`, padding: "4px 8px", borderRadius: 4, border: `1px solid ${gripColor}33`, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 9, color: gripColor, fontWeight: "bold" }}>{gripLabel}</span>
                    <span style={{ fontSize: 8, color: "#888", marginLeft: 8 }}>{pairDesc}</span>
                  </div>
                  <span style={{ fontSize: 7, color: "#666", textTransform: "uppercase" }}>Grip: {rightGrip.style.replace("_", " ")}</span>
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <div style={sty.label}>Right Hand (Main)</div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {ALL_WEAPON_TYPES.map(w => {
                        const wGrip = getWeaponGripProfile(w);
                        const dotColor = wGrip.style === "main_1h" ? "#4caf50" : wGrip.style === "two_hand" ? "#ff9800" : wGrip.style === "ranged_2h" ? "#c9950a" : wGrip.style === "unarmed" ? "#888" : "#ce93d8";
                        return (
                        <button key={w} onClick={() => {
                          setWeaponRight(w);
                          setWeaponModelRight(getDefaultWeaponModelId(w));
                        }}
                          style={sty.btn(weaponRight === w)} title={getGripLabel(w)}>
                          <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: dotColor, marginRight: 3, verticalAlign: "middle" }} />
                          {w}
                        </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ flex: "1 1 200px" }}>
                    <div style={sty.label}>Left Hand (Off)</div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      <button onClick={() => { setWeaponLeft(null); setWeaponModelLeft(null); }} style={sty.btn(weaponLeft === null)}>Empty</button>
                      {ALL_WEAPON_TYPES.filter(w => {
                        const g = getWeaponGripProfile(w);
                        return g.style === "main_1h" || g.style === "off_1h" || w === "fists";
                      }).map(w => (
                        <button key={w} onClick={() => {
                          setWeaponLeft(w);
                          setWeaponModelLeft(getDefaultWeaponModelId(w));
                        }}
                          style={sty.btn(weaponLeft === w)}>{w}</button>
                      ))}
                    </div>
                    {rightGrip.style === "two_hand" && <div style={{ fontSize: 7, color: "#ff9800", marginTop: 3 }}>Two-handed weapon occupies both hands</div>}
                    {rightGrip.style === "ranged_2h" && <div style={{ fontSize: 7, color: "#c9950a", marginTop: 3 }}>Ranged weapon requires both hands</div>}
                  </div>
                </div>

                {weaponMapping && (
                  <div style={{ background: "rgba(171,71,188,0.08)", padding: 6, borderRadius: 4, border: "1px solid rgba(171,71,188,0.2)", marginBottom: 8 }}>
                    <div style={{ fontSize: 9, color: "#ce93d8", marginBottom: 3 }}>Animation Mapping: {weaponMapping.description}</div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {recommendedPacks.map(pack => (
                        <button key={pack.id} onClick={() => { setSelectedAnimPack(pack.id); setActiveTab("anims"); }}
                          style={{ padding: "2px 6px", fontSize: 7, borderRadius: 2, cursor: "pointer",
                            background: "rgba(171,71,188,0.2)", border: "1px solid rgba(171,71,188,0.4)", color: "#ce93d8" }}>
                          {pack.name} ({pack.animations.length})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableWeaponModels.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={sty.label}>Model Library ({availableWeaponModels.length} {weaponRight} models)</div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", maxHeight: 48, overflowY: "auto" }}>
                      {availableWeaponModels.map(w => (
                        <span key={w.id} title={`${w.name} - ${w.path}`}
                          style={{ padding: "2px 6px", fontSize: 7, borderRadius: 2,
                            background: "rgba(255,152,0,0.1)", border: "1px solid rgba(255,152,0,0.2)", color: "#ffb74d" }}>
                          {w.name}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 7, color: "#555", marginTop: 2 }}>
                      {WEAPON_TEXTURES[weaponRight] ? `Texture atlas: ${WEAPON_TEXTURES[weaponRight]}` : "GLB models - loaded via GLTFLoader"}
                    </div>
                  </div>
                )}

                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "6px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={sty.label}>Weapon Positioning</div>
                  <div style={{ display: "flex", gap: 3 }}>
                    <span style={{ fontSize: 7, padding: "1px 4px", borderRadius: 2, background: `rgba(76,175,80,0.15)`, color: "#4caf50" }}>1H</span>
                    <span style={{ fontSize: 7, padding: "1px 4px", borderRadius: 2, background: `rgba(255,152,0,0.15)`, color: "#ff9800" }}>2H</span>
                    <span style={{ fontSize: 7, padding: "1px 4px", borderRadius: 2, background: `rgba(201,149,10,0.12)`, color: "#c9950a" }}>Ranged</span>
                    <span style={{ fontSize: 7, padding: "1px 4px", borderRadius: 2, background: `rgba(171,71,188,0.15)`, color: "#ce93d8" }}>Off</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6, padding: "4px 6px", background: "rgba(201,149,10,0.06)", border: "1px solid rgba(201,149,10,0.18)", borderRadius: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 8, color: "#c9950a", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Offset Preset</span>
                    {offsetPresetNames.length === 0 ? (
                      <span style={{ flex: 1, fontSize: 8, color: "#777", fontStyle: "italic" }}>
                        No saved presets for this combo yet — name and save below.
                      </span>
                    ) : (
                      <>
                        <select
                          value={activeOffsetPresetName ?? ""}
                          onChange={(e) => { const v = e.target.value; if (v) applyOffsetPreset(v); }}
                          style={{ flex: 1, fontSize: 9, padding: "2px 5px", background: "rgba(40,40,50,0.9)", color: "#ddd", border: "1px solid #555", borderRadius: 3 }}
                          title="Select a saved weapon offset preset for this character + weapon combo"
                        >
                          <option value="">-- select preset --</option>
                          {offsetPresetNames.map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => activeOffsetPresetName && deleteOffsetPreset(activeOffsetPresetName)}
                          disabled={!activeOffsetPresetName}
                          title={activeOffsetPresetName ? `Delete preset "${activeOffsetPresetName}"` : "No active preset to delete"}
                          style={{
                            width: 22, fontSize: 10, padding: "2px 0", borderRadius: 3,
                            background: activeOffsetPresetName ? "rgba(80,30,30,0.6)" : "rgba(50,50,50,0.4)",
                            color: activeOffsetPresetName ? "#ffaaaa" : "#666",
                            border: "1px solid " + (activeOffsetPresetName ? "#884" : "#444"),
                            cursor: activeOffsetPresetName ? "pointer" : "not-allowed",
                          }}
                        >
                          ✕
                        </button>
                        {activeOffsetPresetName ? (
                          <span style={{ fontSize: 8, color: "#c9950a" }} title="Auto-loads when this character + weapon combo is selected">
                            Active: {activeOffsetPresetName}
                          </span>
                        ) : (
                          <span style={{ fontSize: 8, color: "#777" }}>None active</span>
                        )}
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="text"
                      value={offsetPresetName}
                      placeholder={activeOffsetPresetName ? `Save as new (or "${activeOffsetPresetName}" to overwrite)` : "Name (e.g. Knight + Sword)"}
                      onChange={(e) => setOffsetPresetName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveOffsetPreset(offsetPresetName); }}
                      style={{ flex: 1, fontSize: 9, padding: "3px 6px", background: "rgba(40,40,50,0.9)", color: "#ddd", border: "1px solid #555", borderRadius: 3, outline: "none" }}
                    />
                    <button
                      onClick={() => saveOffsetPreset(offsetPresetName)}
                      disabled={!offsetPresetName.trim()}
                      title="Save current offsets as a preset for this combo"
                      style={{
                        fontSize: 9, padding: "3px 10px", borderRadius: 3,
                        background: offsetPresetName.trim() ? "rgba(76,175,80,0.2)" : "rgba(50,50,50,0.4)",
                        color: offsetPresetName.trim() ? "#aaffaa" : "#666",
                        border: "1px solid " + (offsetPresetName.trim() ? "rgba(76,175,80,0.4)" : "#444"),
                        cursor: offsetPresetName.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <button onClick={() => setGizmoMode(gizmoMode === "translate" ? null : "translate")}
                    style={{ ...sty.btn(gizmoMode === "translate", "#c9950a"), padding: "4px 10px", fontSize: 9 }}>
                    Move
                  </button>
                  <button onClick={() => setGizmoMode(gizmoMode === "rotate" ? null : "rotate")}
                    style={{ ...sty.btn(gizmoMode === "rotate", "#c9950a"), padding: "4px 10px", fontSize: 9 }}>
                    Rotate
                  </button>
                  <button onClick={() => setGizmoMode(gizmoMode === "scale" ? null : "scale")}
                    style={{ ...sty.btn(gizmoMode === "scale", "#c9950a"), padding: "4px 10px", fontSize: 9 }}>
                    Scale
                  </button>
                  <button onClick={() => { setWeaponOffset({ ...DEFAULT_WEAPON_OFFSET }); setGizmoMode(null); }}
                    style={{ padding: "4px 10px", fontSize: 9, borderRadius: 3, cursor: "pointer",
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>
                    Reset
                  </button>
                </div>
                <div style={{ fontSize: 7, color: "#555", marginBottom: 4 }}>
                  Auto-positioning uses skeleton detection ({modelAnalysis ? (modelAnalysis.handBones.right ? `hands detected, rig: ${detectSkeletonType(modelAnalysis.boneNames)}` : "no hand bones") : "analyzing..."}). Fine-tune with Move/Rotate/Scale gizmos.
                </div>
                {modelAnalysis && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 6, padding: 4, background: "rgba(76,175,80,0.04)", border: "1px solid rgba(76,175,80,0.15)", borderRadius: 3 }}>
                    <div>
                      <div style={{ fontSize: 7, color: "#4caf50", textTransform: "uppercase", letterSpacing: 1 }}>Right Mount Bone</div>
                      <div style={{ fontSize: 8, color: modelAnalysis.handBones.right ? "#aaffaa" : "#b54a3a", fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all" }}>
                        {modelAnalysis.handBones.right || "NOT FOUND — weapon will fall back to hips"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 7, color: "#c9950a", textTransform: "uppercase", letterSpacing: 1 }}>Left Mount Bone</div>
                      <div style={{ fontSize: 8, color: modelAnalysis.handBones.left ? "#ffd479" : "#888", fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all" }}>
                        {modelAnalysis.handBones.left || "(none — single-hand model)"}
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: 5, borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 8, color: "#4caf50", marginBottom: 2 }}>Right Hand Offset</div>
                    <div style={{ fontSize: 7, color: "#888" }}>Pos: [{weaponOffset.rightPos.map(v => v.toFixed(3)).join(", ")}]</div>
                    <div style={{ fontSize: 7, color: "#888" }}>Rot: [{weaponOffset.rightRot.map(v => (v * 180 / Math.PI).toFixed(1) + "\u00B0").join(", ")}]</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: 5, borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 8, color: "#c9950a", marginBottom: 2 }}>Left Hand Offset</div>
                    <div style={{ fontSize: 7, color: "#888" }}>Pos: [{weaponOffset.leftPos.map(v => v.toFixed(3)).join(", ")}]</div>
                    <div style={{ fontSize: 7, color: "#888" }}>Rot: [{weaponOffset.leftRot.map(v => (v * 180 / Math.PI).toFixed(1) + "\u00B0").join(", ")}]</div>
                  </div>
                </div>
              </div>
              );
            })()}

            {activeTab === "colors" && (() => {
              const upperParts: (keyof MaterialColors)[] = ["skin", "hair", "hat", "clothing", "armor", "detail"];
              const lowerParts: (keyof MaterialColors)[] = ["pants"];
              const activeUpper = upperParts.filter(p => uniqueParts.includes(p));
              const activeLower = lowerParts.filter(p => uniqueParts.includes(p));
              const hasLower = activeLower.length > 0 || uniqueParts.includes("pants");
              const showLower = hasLower || true;

              return (
                <div>
                  <div style={{ fontSize: 9, color: "#c9950a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontWeight: "bold" }}>Upper Body</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: showLower ? 10 : 0 }}>
                    {activeUpper.map(part => {
                      const info = PART_COLORS[part];
                      if (!info) return null;
                      return (
                        <div key={part} style={{ flex: "1 1 120px", minWidth: 100 }}>
                          <div style={sty.label}>{info.label}</div>
                          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                            {info.colors.map(c => {
                              const isActive = (matColors[part] || "") === (c.value || "");
                              return (
                                <div key={c.label} title={c.label}
                                  onClick={() => setMatColors(prev => ({ ...prev, [part]: c.value || null }))}
                                  style={{ ...sty.swatch(isActive), background: c.value || "linear-gradient(135deg, #444 45%, #888 55%)" }} />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {showLower && (
                    <>
                      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 0 8px" }} />
                      <div style={{ fontSize: 9, color: "#ff9800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontWeight: "bold" }}>Lower Body</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 120px", minWidth: 100 }}>
                          <div style={sty.label}>{PART_COLORS.pants.label}</div>
                          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                            {PART_COLORS.pants.colors.map(c => {
                              const isActive = (matColors.pants || "") === (c.value || "");
                              return (
                                <div key={c.label} title={c.label}
                                  onClick={() => setMatColors(prev => ({ ...prev, pants: c.value || null }))}
                                  style={{ ...sty.swatch(isActive), background: c.value || "linear-gradient(135deg, #444 45%, #888 55%)" }} />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {activeTab === "edit" && (() => {
              const rightModels = getAvailableModels(weaponRight);
              const leftModels = weaponLeft ? getAvailableModels(weaponLeft) : [];
              const charHeight = modelAnalysis ? (modelAnalysis.suggestedScale * (currentChar.baseHeight || 1.8)).toFixed(2) : (currentChar.baseHeight * scale).toFixed(2);
              const rightRealSize = WEAPON_REAL_SIZES[weaponRight] || 0.8;
              const leftRealSize = weaponLeft ? (WEAPON_REAL_SIZES[weaponLeft] || 0.8) : 0;

              return (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#ff5722", fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1 }}>Weapon Edit Mode</div>
                    <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>T-Pose active. Gizmo controls do not rotate camera while dragging.</div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => setShowHeightMarkers(!showHeightMarkers)}
                      style={{
                        padding: "5px 10px", fontSize: 9, borderRadius: 4, cursor: "pointer",
                        background: showHeightMarkers ? "rgba(255,152,0,0.3)" : "rgba(255,255,255,0.06)",
                        border: showHeightMarkers ? "1px solid rgba(255,152,0,0.5)" : "1px solid rgba(255,255,255,0.1)",
                        color: showHeightMarkers ? "#ff9800" : "#888",
                      }}>Rulers</button>
                    <button onClick={() => { setEditMode(!editMode); if (!editMode) setGizmoMode("translate"); else setGizmoMode(null); }}
                      style={{
                        padding: "5px 12px", fontSize: 10, borderRadius: 4, cursor: "pointer", fontWeight: "bold",
                        background: editMode ? "rgba(255,87,34,0.4)" : "rgba(76,175,80,0.3)",
                        border: editMode ? "1px solid rgba(255,87,34,0.7)" : "1px solid rgba(76,175,80,0.5)",
                        color: editMode ? "#ff5722" : "#4caf50",
                      }}>{editMode ? "Disable T-Pose" : "Enable T-Pose"}</button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 4, marginBottom: 6, alignItems: "center" }}>
                  <div style={{ fontSize: 8, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginRight: 4 }}>Gizmo:</div>
                  {(["translate", "rotate", "scale"] as const).map(mode => {
                    const labels = { translate: "Move", rotate: "Rotate", scale: "Scale" };
                    const colors = { translate: "#4caf50", rotate: "#ff9800", scale: "#ab47bc" };
                    return (
                      <button key={mode} onClick={() => setGizmoMode(gizmoMode === mode ? null : mode)}
                        style={{
                          padding: "4px 10px", fontSize: 9, borderRadius: 4, cursor: "pointer",
                          background: gizmoMode === mode ? `${colors[mode]}44` : "rgba(255,255,255,0.06)",
                          border: gizmoMode === mode ? `1px solid ${colors[mode]}` : "1px solid rgba(255,255,255,0.1)",
                          color: gizmoMode === mode ? colors[mode] : "#888",
                        }}>{labels[mode]}</button>
                    );
                  })}
                  <button onClick={() => { setWeaponOffset({ ...DEFAULT_WEAPON_OFFSET }); }}
                    style={{ padding: "4px 10px", fontSize: 9, borderRadius: 4, cursor: "pointer",
                      background: "rgba(181,74,58,0.12)", border: "1px solid rgba(181,74,58,0.25)", color: "#b54a3a" }}>
                    Reset
                  </button>
                  <div style={{ marginLeft: "auto", fontSize: 8, color: "#666", display: "flex", gap: 8 }}>
                    <span>Char: <span style={{ color: "#c9950a" }}>{charHeight}m</span></span>
                    <span>R: <span style={{ color: "#4caf50" }}>{(rightRealSize * 100).toFixed(0)}cm</span></span>
                    {weaponLeft && <span>L: <span style={{ color: "#c9950a" }}>{(leftRealSize * 100).toFixed(0)}cm</span></span>}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div style={{ background: "rgba(76,175,80,0.08)", padding: 8, borderRadius: 6, border: "1px solid rgba(76,175,80,0.2)" }}>
                    <div style={{ fontSize: 10, color: "#4caf50", fontWeight: "bold", marginBottom: 4 }}>Right Hand (Main)</div>
                    <div style={{ fontSize: 9, color: "#aaa", marginBottom: 2 }}>Weapon: {weaponRight} ({(rightRealSize * 100).toFixed(0)}cm)</div>
                    <div style={{ fontSize: 8, color: "#888" }}>Pos: {weaponOffset.rightPos.map(v => `${(v * 100).toFixed(1)}cm`).join(" / ")}</div>
                    <div style={{ fontSize: 8, color: "#888" }}>Rot: {weaponOffset.rightRot.map(v => `${(v * 180 / Math.PI).toFixed(1)}\u00B0`).join(" / ")}</div>
                    <div style={{ fontSize: 8, color: "#ab47bc" }}>Scale: {weaponOffset.rightScale.map(v => v.toFixed(2)).join(" / ")}</div>
                    {modelAnalysis && <div style={{ fontSize: 7, color: "#666", marginTop: 3 }}>Bone: {modelAnalysis.handBones.right || "not found"}</div>}
                    {weaponModelRight && <div style={{ fontSize: 7, color: "#ff9800", marginTop: 2 }}>3D Model: {weaponModelRight}</div>}
                  </div>
                  <div style={{ background: "rgba(201,149,10,0.08)", padding: 8, borderRadius: 6, border: "1px solid rgba(201,149,10,0.15)" }}>
                    <div style={{ fontSize: 10, color: "#c9950a", fontWeight: "bold", marginBottom: 4 }}>Left Hand (Off)</div>
                    <div style={{ fontSize: 9, color: "#aaa", marginBottom: 2 }}>Weapon: {weaponLeft || "empty"} {weaponLeft ? `(${(leftRealSize * 100).toFixed(0)}cm)` : ""}</div>
                    <div style={{ fontSize: 8, color: "#888" }}>Pos: {weaponOffset.leftPos.map(v => `${(v * 100).toFixed(1)}cm`).join(" / ")}</div>
                    <div style={{ fontSize: 8, color: "#888" }}>Rot: {weaponOffset.leftRot.map(v => `${(v * 180 / Math.PI).toFixed(1)}\u00B0`).join(" / ")}</div>
                    <div style={{ fontSize: 8, color: "#ab47bc" }}>Scale: {weaponOffset.leftScale.map(v => v.toFixed(2)).join(" / ")}</div>
                    {modelAnalysis && <div style={{ fontSize: 7, color: "#666", marginTop: 3 }}>Bone: {modelAnalysis.handBones.left || "not found"}</div>}
                    {weaponModelLeft && <div style={{ fontSize: 7, color: "#ff9800", marginTop: 2 }}>3D Model: {weaponModelLeft}</div>}
                  </div>
                </div>

                {rightModels.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={sty.label}>Right Hand Model ({rightModels.length} available)</div>
                      <button onClick={() => setWeaponModelRight(null)}
                        style={{ padding: "2px 6px", fontSize: 7, borderRadius: 2, cursor: "pointer",
                          background: !weaponModelRight ? "rgba(76,175,80,0.3)" : "rgba(255,255,255,0.06)",
                          border: !weaponModelRight ? "1px solid rgba(76,175,80,0.5)" : "1px solid rgba(255,255,255,0.1)",
                          color: !weaponModelRight ? "#4caf50" : "#888" }}>Procedural</button>
                    </div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", maxHeight: 56, overflowY: "auto" }}>
                      {rightModels.map(w => {
                        const isSelected = weaponModelRight === w.id;
                        const isLoading = loadingModel === w.id;
                        return (
                          <button key={w.id}
                            onClick={() => {
                              if (isSelected) { setWeaponModelRight(null); return; }
                              setLoadingModel(w.id);
                              loadWeaponModel(weaponRight, w.id)
                                .then(() => { setWeaponModelRight(w.id); setLoadingModel(null); })
                                .catch(() => setLoadingModel(null));
                            }}
                            style={{
                              padding: "3px 6px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                              background: isSelected ? "rgba(255,152,0,0.4)" : isLoading ? "rgba(255,152,0,0.15)" : "rgba(255,255,255,0.06)",
                              border: isSelected ? "1px solid rgba(255,152,0,0.7)" : "1px solid rgba(255,255,255,0.1)",
                              color: isSelected ? "#ff9800" : isLoading ? "#ffb74d" : "#aaa",
                            }}>{isLoading ? "..." : w.name}</button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {weaponLeft && leftModels.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={sty.label}>Left Hand Model ({leftModels.length} available)</div>
                      <button onClick={() => setWeaponModelLeft(null)}
                        style={{ padding: "2px 6px", fontSize: 7, borderRadius: 2, cursor: "pointer",
                          background: !weaponModelLeft ? "rgba(201,149,10,0.25)" : "rgba(255,255,255,0.06)",
                          border: !weaponModelLeft ? "1px solid rgba(201,149,10,0.4)" : "1px solid rgba(255,255,255,0.1)",
                          color: !weaponModelLeft ? "#c9950a" : "#888" }}>Procedural</button>
                    </div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", maxHeight: 56, overflowY: "auto" }}>
                      {leftModels.map(w => {
                        const isSelected = weaponModelLeft === w.id;
                        const isLoading = loadingModel === w.id;
                        return (
                          <button key={w.id}
                            onClick={() => {
                              if (isSelected) { setWeaponModelLeft(null); return; }
                              setLoadingModel(w.id);
                              loadWeaponModel(weaponLeft!, w.id)
                                .then(() => { setWeaponModelLeft(w.id); setLoadingModel(null); })
                                .catch(() => setLoadingModel(null));
                            }}
                            style={{
                              padding: "3px 6px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                              background: isSelected ? "rgba(255,152,0,0.4)" : isLoading ? "rgba(255,152,0,0.15)" : "rgba(255,255,255,0.06)",
                              border: isSelected ? "1px solid rgba(255,152,0,0.7)" : "1px solid rgba(255,255,255,0.1)",
                              color: isSelected ? "#ff9800" : isLoading ? "#ffb74d" : "#aaa",
                            }}>{isLoading ? "..." : w.name}</button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {weaponRight === "bow" && ARROW_MODELS.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={sty.label}>Arrow Model ({ARROW_MODELS.length} available)</div>
                      <button onClick={() => setArrowModelId(null)}
                        style={{ padding: "2px 6px", fontSize: 7, borderRadius: 2, cursor: "pointer",
                          background: !arrowModelId ? "rgba(76,175,80,0.3)" : "rgba(255,255,255,0.06)",
                          border: !arrowModelId ? "1px solid rgba(76,175,80,0.5)" : "1px solid rgba(255,255,255,0.1)",
                          color: !arrowModelId ? "#4caf50" : "#888" }}>Procedural</button>
                    </div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", maxHeight: 56, overflowY: "auto" }}>
                      {ARROW_MODELS.map(a => {
                        const isSelected = arrowModelId === a.id;
                        return (
                          <button key={a.id}
                            onClick={() => setArrowModelId(isSelected ? null : a.id)}
                            style={{
                              padding: "3px 6px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                              background: isSelected ? "rgba(255,152,0,0.4)" : "rgba(255,255,255,0.06)",
                              border: isSelected ? "1px solid rgba(255,152,0,0.7)" : "1px solid rgba(255,255,255,0.1)",
                              color: isSelected ? "#ff9800" : "#aaa",
                            }}>{a.name}</button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {BACK_ACCESSORIES.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={sty.label}>Back Accessory ({BACK_ACCESSORIES.length} available)</div>
                      <button onClick={() => setBackAccessoryId(null)}
                        style={{ padding: "2px 6px", fontSize: 7, borderRadius: 2, cursor: "pointer",
                          background: !backAccessoryId ? "rgba(76,175,80,0.3)" : "rgba(255,255,255,0.06)",
                          border: !backAccessoryId ? "1px solid rgba(76,175,80,0.5)" : "1px solid rgba(255,255,255,0.1)",
                          color: !backAccessoryId ? "#4caf50" : "#888" }}>None</button>
                    </div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", maxHeight: 56, overflowY: "auto" }}>
                      {BACK_ACCESSORIES.map(a => {
                        const isSelected = backAccessoryId === a.id;
                        return (
                          <button key={a.id}
                            onClick={() => setBackAccessoryId(isSelected ? null : a.id)}
                            style={{
                              padding: "3px 6px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                              background: isSelected ? "rgba(255,152,0,0.4)" : "rgba(255,255,255,0.06)",
                              border: isSelected ? "1px solid rgba(255,152,0,0.7)" : "1px solid rgba(255,255,255,0.1)",
                              color: isSelected ? "#ff9800" : "#aaa",
                            }}>{a.name}</button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 7, color: "#555", lineHeight: 1.5 }}>
                  Drag gizmo axes to reposition. Camera orbit is disabled while dragging. Toggle Rulers for height reference markers.
                </div>
              </div>
              );
            })()}

            {activeTab === "anims" && (
              <div>
                {(() => {
                  const stdPacks = allPacks.filter(p => p.id === "glocomotion" || p.id === "glocomotion_combat");
                  if (stdPacks.length === 0) return null;
                  return (
                    <div style={{ background: "rgba(76,175,80,0.06)", border: "1px solid rgba(76,175,80,0.25)", borderRadius: 4, padding: 6, marginBottom: 8 }}>
                      <div style={{ fontSize: 9, color: "#66bb6a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                        Standard Motion Library — quick test on this model
                      </div>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {stdPacks.flatMap(pack => pack.animations.slice(0, 8).map(a => {
                          const isPlaying = pack.bundledFile
                            ? (externalAnimUrl === `${pack.basePath}/${pack.bundledFile}` && externalAnimClipName === a.file)
                            : externalAnimUrl === `${pack.basePath}/${a.file}`;
                          return (
                            <button key={`${pack.id}-${a.name}`} onClick={() => handlePlayPackAnim(pack, a.file)}
                              style={{
                                padding: "3px 8px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                                background: isPlaying ? "rgba(76,175,80,0.4)" : "rgba(76,175,80,0.12)",
                                border: isPlaying ? "1px solid rgba(76,175,80,0.7)" : "1px solid rgba(76,175,80,0.3)",
                                color: isPlaying ? "#aaffaa" : "#66bb6a",
                              }} title={`${pack.name} → ${a.name}`}>
                              {a.name}
                            </button>
                          );
                        }))}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  Embedded Model Clips ({modelAnalysis?.animationNames.length ?? 0})
                </div>
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 6, maxHeight: 96, overflowY: "auto", padding: 2, border: (modelAnalysis?.animationNames.length ?? 0) > 16 ? "1px solid rgba(255,255,255,0.06)" : "none", borderRadius: 3 }}>
                  {(!modelAnalysis || modelAnalysis.animationNames.length === 0) && (
                    <span style={{ fontSize: 8, color: "#666", fontStyle: "italic" }}>
                      No embedded animations. Use Standard Motion Library above or external packs below.
                    </span>
                  )}
                  {modelAnalysis?.animationNames.map(anim => (
                    <button key={anim} onClick={() => { setPreviewAnim(anim); setExternalAnimUrl(null); setPlayingExternal(""); }}
                      style={sty.btn(previewAnim === anim && !externalAnimUrl, "#c9950a")}>{anim}</button>
                  ))}
                </div>
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "6px 0" }} />
                <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  External Animation Packs ({allPacks.length} packs, {allPacks.reduce((a, p) => a + p.animations.length, 0)} total) - Click any to play on this model
                </div>
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 6 }}>
                  {allPacks.map(pack => (
                    <button key={pack.id} onClick={() => setSelectedAnimPack(selectedAnimPack === pack.id ? null : pack.id)}
                      style={{
                        padding: "4px 8px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                        background: selectedAnimPack === pack.id ? "rgba(171,71,188,0.4)" : "rgba(255,255,255,0.06)",
                        border: selectedAnimPack === pack.id ? "1px solid rgba(171,71,188,0.7)" : "1px solid rgba(255,255,255,0.1)",
                        color: "#fff",
                      }}>
                      {pack.name} <span style={{ color: "#888", fontSize: 7 }}>({pack.animations.length})</span>
                    </button>
                  ))}
                </div>
                {selectedAnimPack && (() => {
                  const pack = allPacks.find(p => p.id === selectedAnimPack);
                  if (!pack) return null;
                  const isGlbPack = pack.bundledFile ? true : pack.animations[0]?.file.endsWith(".glb");
                  return (
                    <div style={{ background: "rgba(255,255,255,0.03)", padding: 8, borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontSize: 10, color: "#ab47bc" }}>{pack.name} - {pack.combatStyle}</div>
                        {isGlbPack && <span style={{ fontSize: 7, padding: "1px 4px", borderRadius: 2, background: "rgba(76,175,80,0.2)", color: "#66bb6a" }}>GLB - Playable</span>}
                        {!isGlbPack && <span style={{ fontSize: 7, padding: "1px 4px", borderRadius: 2, background: "rgba(255,152,0,0.2)", color: "#ff9800" }}>FBX - Preview only</span>}
                      </div>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {pack.animations.map(a => {
                          const isPlaying = pack.bundledFile
                            ? (externalAnimUrl === `${pack.basePath}/${pack.bundledFile}` && externalAnimClipName === a.file)
                            : externalAnimUrl === `${pack.basePath}/${a.file}`;
                          return (
                            <button key={a.name}
                              onClick={() => isGlbPack ? handlePlayPackAnim(pack, a.file) : null}
                              style={{
                                padding: "3px 8px", fontSize: 8, borderRadius: 3,
                                cursor: isGlbPack ? "pointer" : "default",
                                background: isPlaying ? "rgba(76,175,80,0.4)" : "rgba(171,71,188,0.15)",
                                border: isPlaying ? "1px solid rgba(76,175,80,0.7)" : "1px solid rgba(171,71,188,0.3)",
                                color: isPlaying ? "#66bb6a" : "#ce93d8",
                                opacity: isGlbPack ? 1 : 0.6,
                              }}>{a.name}</button>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 7, color: "#555", marginTop: 4 }}>Path: {pack.basePath}/</div>
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === "body" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Body Morphing</div>
                  <button onClick={() => setBodyMorph({ ...DEFAULT_BODY_MORPH })}
                    style={{ padding: "2px 8px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>
                    Reset All
                  </button>
                </div>
                {!modelAnalysis?.hasRig && (
                  <div style={{ fontSize: 9, color: "#b54a3a", marginBottom: 6, padding: 5, background: "rgba(181,74,58,0.1)", borderRadius: 4 }}>
                    No skeleton rig detected. Body morphing requires a rigged model.
                  </div>
                )}
                <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
                  {(Object.keys(MORPH_GROUP_LABELS) as MorphGroup[]).map(g => (
                    <button key={g} onClick={() => setMorphGroup(g)}
                      style={{
                        padding: "4px 10px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                        background: morphGroup === g ? `rgba(${g === "build" ? "201,149,10" : g === "limbs" ? "255,183,77" : g === "face" ? "141,110,99" : "126,87,194"},0.3)` : "rgba(255,255,255,0.06)",
                        border: morphGroup === g ? `1px solid ${MORPH_GROUP_LABELS[g].color}` : "1px solid rgba(255,255,255,0.1)",
                        color: morphGroup === g ? MORPH_GROUP_LABELS[g].color : "#888",
                      }}>{MORPH_GROUP_LABELS[g].label}</button>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {MORPH_SLIDERS.filter(s => s.group === morphGroup).map(s => (
                    <div key={s.key}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ fontSize: 9, color: s.color }}>{s.label}</span>
                        <span style={{ fontSize: 9, color: "#888" }}>{bodyMorph[s.key].toFixed(2)}</span>
                      </div>
                      <input type="range" min={s.min} max={s.max} step={s.step} value={bodyMorph[s.key]}
                        onChange={(e) => updateMorph(s.key, parseFloat(e.target.value))}
                        style={{ width: "100%", accentColor: s.color, height: 4 }} />
                    </div>
                  ))}
                </div>
                {modelAnalysis?.hasRig && (
                  <div style={{ marginTop: 8, fontSize: 7, color: "#444" }}>
                    Bone-based morphing: modifies skeleton bone scales in real-time. {MORPH_SLIDERS.length} parameters across {Object.keys(MORPH_GROUP_LABELS).length} groups. Best with humanoid rigs (Mixamo, Kay Kit, etc).
                  </div>
                )}

              </div>
            )}

            {activeTab === "studio" && (
              <div>
                <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Animation Studio</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ background: "rgba(255,255,255,0.04)", padding: 8, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ color: "#ab47bc", fontSize: 10, fontWeight: "bold", marginBottom: 4 }}>Skeleton Info</div>
                    {modelAnalysis ? (
                      <div style={{ fontSize: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                          <span style={{ color: "#aaa" }}>Type:</span>
                          <span style={{ color: "#c9950a" }}>{detectSkeletonType(modelAnalysis.boneNames)}</span>
                          <span style={{ color: "#aaa" }}>Total Bones:</span>
                          <span style={{ color: "#c9950a" }}>{modelAnalysis.boneNames.length}</span>
                          <span style={{ color: "#aaa" }}>Animations:</span>
                          <span style={{ color: "#66bb6a" }}>{modelAnalysis.animationNames.length} clips</span>
                          <span style={{ color: "#aaa" }}>Has Rig:</span>
                          <span style={{ color: modelAnalysis.hasRig ? "#66bb6a" : "#b54a3a" }}>{modelAnalysis.hasRig ? "Yes" : "No"}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: "#666", fontSize: 10 }}>Loading...</div>
                    )}
                  </div>

                  <div style={{ background: "rgba(255,255,255,0.04)", padding: 8, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ color: "#c9950a", fontSize: 10, fontWeight: "bold", marginBottom: 4 }}>Animation Clips</div>
                    {modelAnalysis && modelAnalysis.animationNames.length > 0 ? (
                      <div style={{ maxHeight: 100, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 2 }}>
                        {modelAnalysis.animationNames.map(name => (
                          <span key={name} style={{ padding: "2px 6px", borderRadius: 3, fontSize: 8, background: "rgba(201,149,10,0.15)", color: "#c9950a", border: "1px solid rgba(201,149,10,0.3)" }}>
                            {name} ({(modelAnalysis.animationDurations[name] || 0).toFixed(1)}s)
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: "#666", fontSize: 10 }}>No embedded animations</div>
                    )}
                  </div>

                  <div style={{ fontSize: 7, color: "#444", padding: "0 2px" }}>
                    {ANIMATION_PACKS.length} animation packs ({ANIMATION_PACKS.reduce((a, p) => a + p.animations.length, 0)} clips) available.
                  </div>
                </div>
              </div>
            )}

            {activeTab === "info" && <ModelAnalyzerDisplay analysis={modelAnalysis} />}

            {activeTab === "debug" && (() => {
              const skelType = modelAnalysis ? detectSkeletonType(modelAnalysis.boneNames) : "unknown";
              const bodyParts: BodyPartBones | null = modelAnalysis ? detectBodyParts(modelAnalysis.boneNames) : null;
              const totalAnimClips = allPacks.reduce((a, p) => a + p.animations.length, 0);
              const stdLib = allPacks.filter(p => p.id === "glocomotion" || p.id === "glocomotion_combat");
              const currentAnim = externalAnimUrl
                ? `${externalAnimClipName || "(external)"} ← ${externalAnimUrl.split("/").pop()}`
                : (previewAnim || "(none)");
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 10, color: "#ccc" }}>
                  <div style={{ background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: 9, color: "#c9950a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Model</div>
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 3, fontSize: 9 }}>
                      <span style={{ color: "#888" }}>Path:</span>
                      <span style={{ color: "#aaffaa", fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all" }}>{currentModelPath || "(default base)"}</span>
                      <span style={{ color: "#888" }}>Active Preset:</span>
                      <span style={{ color: "#ffd479" }}>{activePreset || "(none)"}</span>
                      <span style={{ color: "#888" }}>Skeleton Type:</span>
                      <span style={{ color: skelType === "unknown" ? "#b54a3a" : "#aaffaa" }}>{skelType}</span>
                      <span style={{ color: "#888" }}>Bones:</span>
                      <span style={{ color: "#fff" }}>{modelAnalysis?.boneNames.length ?? 0}</span>
                      <span style={{ color: "#888" }}>Meshes / Verts:</span>
                      <span style={{ color: "#fff" }}>{modelAnalysis?.meshCount ?? 0} / {(modelAnalysis?.vertexCount ?? 0).toLocaleString()}</span>
                      <span style={{ color: "#888" }}>Has Rig:</span>
                      <span style={{ color: modelAnalysis?.hasRig ? "#aaffaa" : "#b54a3a" }}>{modelAnalysis?.hasRig ? "yes" : "no"}</span>
                    </div>
                  </div>

                  <div style={{ background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: 9, color: "#c9950a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Resolved Bones (Standard Motion Library targets)</div>
                    {(() => {
                      const rh = modelAnalysis?.handBones.right ?? null;
                      const lh = modelAnalysis?.handBones.left ?? null;
                      const hips = bodyParts?.root || bodyParts?.hips[0] || null;
                      const spine = bodyParts?.spine[0] || null;
                      const chest = bodyParts?.upperSpine[0] || null;
                      const head = bodyParts?.head[0] || null;
                      const allBones = modelAnalysis?.boneNames ?? [];
                      const rfoot = findBoneNameByAlias(allBones, RIGHT_FOOT_ALIASES)
                        || bodyParts?.feet.find(n => /(right|\.r|_r$|_R\b)/i.test(n))
                        || null;
                      const lfoot = findBoneNameByAlias(allBones, LEFT_FOOT_ALIASES)
                        || bodyParts?.feet.find(n => /(left|\.l|_l$|_L\b)/i.test(n))
                        || null;
                      const missing = !rh || !hips || !head;
                      return (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 3, fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}>
                            <span style={{ color: "#888" }}>Right Hand:</span><span style={{ color: rh ? "#aaffaa" : "#b54a3a" }}>{rh || "MISSING"}</span>
                            <span style={{ color: "#888" }}>Left Hand:</span><span style={{ color: lh ? "#aaffaa" : "#888" }}>{lh || "(none)"}</span>
                            <span style={{ color: "#888" }}>Hips / Root:</span><span style={{ color: hips ? "#aaffaa" : "#b54a3a" }}>{hips || "MISSING"}</span>
                            <span style={{ color: "#888" }}>Spine:</span><span style={{ color: spine ? "#aaffaa" : "#b54a3a" }}>{spine || "MISSING"}</span>
                            <span style={{ color: "#888" }}>Chest:</span><span style={{ color: chest ? "#aaffaa" : "#888" }}>{chest || "(fallback to spine)"}</span>
                            <span style={{ color: "#888" }}>Head:</span><span style={{ color: head ? "#aaffaa" : "#b54a3a" }}>{head || "MISSING"}</span>
                            <span style={{ color: "#888" }}>Right Foot:</span><span style={{ color: rfoot ? "#aaffaa" : "#888" }}>{rfoot || "(none)"}</span>
                            <span style={{ color: "#888" }}>Left Foot:</span><span style={{ color: lfoot ? "#aaffaa" : "#888" }}>{lfoot || "(none)"}</span>
                          </div>
                          {missing && (
                            <div style={{ marginTop: 4, fontSize: 8, color: "#b54a3a" }}>
                              ⚠ Missing core bones — standard motion library may produce T-pose or distorted animation. Check that the GLB uses Mixamo or Kay Kit naming conventions.
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  <div style={{ background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: 9, color: "#c9950a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Animation</div>
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 3, fontSize: 9 }}>
                      <span style={{ color: "#888" }}>Currently Playing:</span><span style={{ color: "#aaffaa", fontFamily: "JetBrains Mono, monospace" }}>{currentAnim}</span>
                      <span style={{ color: "#888" }}>Embedded Clips:</span><span style={{ color: "#fff" }}>{modelAnalysis?.animationNames.length ?? 0}</span>
                      <span style={{ color: "#888" }}>External Packs:</span><span style={{ color: "#fff" }}>{allPacks.length} packs / {totalAnimClips} clips total</span>
                      <span style={{ color: "#888" }}>Standard Library:</span>
                      <span style={{ color: stdLib.length === 2 ? "#aaffaa" : "#b54a3a" }}>
                        {stdLib.map(p => p.name).join(", ") || "MISSING — neither glocomotion nor glocomotion_combat registered"}
                      </span>
                      <span style={{ color: "#888" }}>Recommended Packs:</span>
                      <span style={{ color: "#ffd479" }}>{recommendedPacks.map(p => p.name).join(", ") || "(none for current weapon)"}</span>
                    </div>
                  </div>

                  <div style={{ background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: 9, color: "#c9950a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Weapons & Offsets</div>
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 3, fontSize: 9 }}>
                      <span style={{ color: "#888" }}>Right Hand:</span><span style={{ color: "#aaffaa" }}>{weaponRight} {weaponModelRight ? `(${weaponModelRight})` : "(procedural)"}</span>
                      <span style={{ color: "#888" }}>Left Hand:</span><span style={{ color: "#ffd479" }}>{weaponLeft || "(empty)"} {weaponModelLeft ? `(${weaponModelLeft})` : ""}</span>
                      <span style={{ color: "#888" }}>RH Pos / Rot:</span>
                      <span style={{ color: "#fff", fontFamily: "JetBrains Mono, monospace", fontSize: 8 }}>
                        [{weaponOffset.rightPos.map(v => v.toFixed(3)).join(", ")}] / [{weaponOffset.rightRot.map(v => (v * 180 / Math.PI).toFixed(1)).join(", ")}°]
                      </span>
                      <span style={{ color: "#888" }}>LH Pos / Rot:</span>
                      <span style={{ color: "#fff", fontFamily: "JetBrains Mono, monospace", fontSize: 8 }}>
                        [{weaponOffset.leftPos.map(v => v.toFixed(3)).join(", ")}] / [{weaponOffset.leftRot.map(v => (v * 180 / Math.PI).toFixed(1)).join(", ")}°]
                      </span>
                      <span style={{ color: "#888" }}>Active Preset:</span>
                      <span style={{ color: activeOffsetPresetName ? "#aaffaa" : "#888" }}>{activeOffsetPresetName || "(none)"}</span>
                    </div>
                  </div>

                  <div style={{ background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: 9, color: "#c9950a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Materials Detected</div>
                    {(!modelAnalysis || modelAnalysis.materialNames.length === 0) ? (
                      <div style={{ fontSize: 9, color: "#888", fontStyle: "italic" }}>No materials detected.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 9 }}>
                        {modelAnalysis.materialNames.map((name: string) => {
                          const cat = modelAnalysis.materialCategories[name] ?? "unknown";
                          const colorKey = CATEGORY_MAP[cat as MaterialCategory];
                          const colorVal = colorKey ? matColors[colorKey] : null;
                          return (
                            <div key={name} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 4 }}>
                              <span style={{ color: "#fff", fontFamily: "JetBrains Mono, monospace", fontSize: 8, wordBreak: "break-all" }}>{name}</span>
                              <span style={{ color: "#ffd479", fontSize: 8 }}>→ {cat}</span>
                              <span style={{ color: "#888", fontSize: 8 }}>{colorVal || "default"}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => {
                      console.group("[HeroForge] Full State Dump");
                      console.log("modelPath:", currentModelPath);
                      console.log("skeletonType:", skelType);
                      console.log("bodyParts:", bodyParts);
                      console.log("modelAnalysis:", modelAnalysis);
                      console.log("weaponOffset:", weaponOffset);
                      console.log("matColors:", matColors);
                      console.log("bodyMorph:", bodyMorph);
                      console.groupEnd();
                    }}
                      style={{ padding: "5px 10px", fontSize: 9, borderRadius: 3, cursor: "pointer", background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.4)", color: "#aaffaa" }}>
                      Dump State to Console
                    </button>
                    <button onClick={() => {
                      if (!modelAnalysis) {
                        console.warn("[HeroForge Bones] No model analysis yet — wait for model to finish loading.");
                        return;
                      }
                      const bones = modelAnalysis.boneNames;
                      console.group(`[HeroForge Bones] ${bones.length} bones in ${currentModelPath}`);
                      bones.forEach((b, i) => console.log(`${i + 1}. ${b}`));
                      console.groupEnd();
                    }}
                      style={{ padding: "5px 10px", fontSize: 9, borderRadius: 3, cursor: "pointer", background: "rgba(201,149,10,0.15)", border: "1px solid rgba(201,149,10,0.4)", color: "#ffd479" }}>
                      Log All Bone Names
                    </button>
                    <button onClick={() => {
                      if (!modelAnalysis) {
                        console.warn("[HeroForge Anims] No model analysis yet — wait for model to finish loading.");
                        return;
                      }
                      const anims = modelAnalysis.animationNames;
                      const durations = modelAnalysis.animationDurations || {};
                      console.group(`[HeroForge Anims] ${anims.length} embedded clips in ${currentModelPath}`);
                      if (anims.length === 0) {
                        console.log("(no embedded animations on this model)");
                      } else {
                        anims.forEach((a, i) => {
                          const d = durations[a];
                          console.log(`${i + 1}. ${a}${typeof d === "number" ? ` (${d.toFixed(2)}s)` : ""}`);
                        });
                      }
                      console.groupEnd();
                    }}
                      style={{ padding: "5px 10px", fontSize: 9, borderRadius: 3, cursor: "pointer", background: "rgba(171,71,188,0.15)", border: "1px solid rgba(171,71,188,0.4)", color: "#ce93d8" }}>
                      Log All Animation Clips
                    </button>
                    <button onClick={() => {
                      if (!modelAnalysis) {
                        console.warn("[HeroForge Box] No model analysis yet — wait for model to finish loading.");
                        return;
                      }
                      const box = modelAnalysis.box;
                      const size = box.getSize(new THREE.Vector3());
                      const center = box.getCenter(new THREE.Vector3());
                      const fmt = (v: THREE.Vector3) => `(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`;
                      console.group(`[HeroForge Box] AABB for ${currentModelPath}`);
                      console.log("min:    ", fmt(box.min));
                      console.log("max:    ", fmt(box.max));
                      console.log("size:   ", fmt(size), `(W ${size.x.toFixed(2)} × H ${size.y.toFixed(2)} × D ${size.z.toFixed(2)})`);
                      console.log("center: ", fmt(center));
                      console.log("suggestedScale (target 1.8m):", modelAnalysis.suggestedScale.toFixed(4));
                      console.log("box:    ", box);
                      console.groupEnd();
                    }}
                      style={{ padding: "5px 10px", fontSize: 9, borderRadius: 3, cursor: "pointer", background: "rgba(33,150,243,0.15)", border: "1px solid rgba(33,150,243,0.4)", color: "#90caf9" }}>
                      Log Bounding Box
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          <div style={{
            display: "flex", justifyContent: "space-between", padding: "6px 12px", gap: 6,
            borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)", alignItems: "center",
          }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center", flex: 1 }}>
              <input type="text" placeholder="Save build as..." value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") savePreset(presetName); }}
                style={{ padding: "4px 8px", fontSize: 9, width: 110, borderRadius: 3,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }} />
              <button onClick={() => savePreset(presetName)}
                style={{ padding: "4px 8px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                  background: "rgba(76,175,80,0.2)", border: "1px solid rgba(76,175,80,0.4)", color: "#66bb6a" }}>Save</button>
              <button onClick={() => {
                autoSaveReady.current = false;
                setHeroName("Hero");
                setCombatClass(BASE_CHARACTER.defaultClass);
                setWeaponRight("sword"); setWeaponLeft("shield");
                setMatColors({ skin: null, clothing: null, pants: null, hair: null, hat: null, armor: null, detail: null });
                setBodyMorph({ ...DEFAULT_BODY_MORPH });
                setWeaponOffset({ ...DEFAULT_WEAPON_OFFSET });
                setScale(0.1); setSpeedMult(1.0);
                setWeaponModelRight(getDefaultWeaponModelId("sword"));
                setWeaponModelLeft(getDefaultWeaponModelId("shield"));
                setActivePreset(null);
                setTimeout(() => { autoSaveReady.current = true; }, 150);
              }}
                style={{ padding: "4px 8px", fontSize: 8, borderRadius: 3, cursor: "pointer",
                  background: "rgba(181,74,58,0.1)", border: "1px solid rgba(181,74,58,0.25)", color: "#b54a3a" }}
                title="Reset character to defaults">Reset</button>
              <span style={{ fontSize: 7, color: "#4caf50", opacity: 0.7, marginLeft: 2 }}>auto-saved</span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => useGame.getState().goToGGE()}
                style={{
                  padding: "6px 12px", fontSize: 9,
                  background: "rgba(201,149,10,0.15)", color: "#c9950a",
                  border: "1px solid rgba(201,149,10,0.3)", borderRadius: 4, cursor: "pointer",
                }}>GGE Editor</button>
              <button onClick={handleConfirm}
                style={{
                  padding: "10px 32px", fontSize: 14, fontWeight: 700,
                  fontFamily: "'Cinzel', serif",
                  background: "linear-gradient(135deg, #c9950a, #9b7520)", color: "#1a100a",
                  border: "1px solid #e8c868", borderRadius: 5, cursor: "pointer", letterSpacing: 2,
                  boxShadow: "0 4px 15px rgba(201,149,10,0.35)", textTransform: "uppercase",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(201,149,10,0.5)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 15px rgba(201,149,10,0.35)"; }}>
                Play as {heroName || "Hero"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
