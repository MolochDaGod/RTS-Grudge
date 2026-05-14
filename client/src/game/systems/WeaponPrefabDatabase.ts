/**
 * WeaponPrefabDatabase — The single source of truth for all weapon prefabs
 * in Grudge Warlords.
 *
 * Structure mirrors the Unity uMMORPG ScriptableItem + PlayerEquipment system:
 *   - 17 weapon types (matching game design class restrictions)
 *   - T0–T8 tiers (Common → Artifact) with stat multipliers 1.0× → 4.0×
 *   - 6 visual variants per type (A–F) so gear looks distinct per tier
 *   - Each prefab links to: model path, animation pack, bone attachment,
 *     class restrictions, and R2/D1 asset keys
 *
 * Model sources:
 *   - Craftpix swords/axes/poleaxes/hammers/daggers/bows/crossbows/shields/staffs/canes/arrows (24 each)
 *   - KayKit weapons (22 models)
 *   - Quaternius weapons (24 models)
 *   - Kickin It Studios weapon pack (36 models)
 *   - Weapon Pack (medieval + standard, 28 models)
 *   - Firearm pack (8 models)
 */

import type { WeaponType } from "@/lib/stores/useGame";

// ---------------------------------------------------------------------------
// Extended weapon type — adds the 4 types missing from the current union
// ---------------------------------------------------------------------------
export type ExtendedWeaponType = WeaponType | "mace" | "spear" | "tome" | "relic";

// ---------------------------------------------------------------------------
// Tier system (mirrors Unity T1–T8 + T0 starter)
// ---------------------------------------------------------------------------
export type WeaponTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const TIER_LABELS: Record<WeaponTier, string> = {
  0: "Starter",  1: "Common",    2: "Uncommon", 3: "Rare",
  4: "Epic",     5: "Legendary", 6: "Mythic",   7: "Ancient", 8: "Artifact",
};

export const TIER_MULTIPLIERS: Record<WeaponTier, number> = {
  0: 0.5, 1: 1.0, 2: 1.3, 3: 1.6, 4: 2.0, 5: 2.5, 6: 3.0, 7: 3.5, 8: 4.0,
};

export const TIER_COLORS: Record<WeaponTier, string> = {
  0: "#666666", 1: "#8b7355", 2: "#a8a8a8", 3: "#4a9eff",
  4: "#9d4dff", 5: "#ff4d4d", 6: "#ffaa00", 7: "#d4a84b", 8: "#f0d890",
};

// ---------------------------------------------------------------------------
// Class restrictions (from game design rules)
// ---------------------------------------------------------------------------
export type HeroClass = "warrior" | "ranger" | "mage" | "worge";

export const CLASS_WEAPON_RESTRICTIONS: Record<HeroClass, ExtendedWeaponType[]> = {
  warrior: ["sword", "greatsword", "shield", "axe", "hammer", "mace", "poleaxe"],
  mage:    ["staff", "tome", "wand", "mace", "relic"],
  ranger:  ["bow", "crossbow", "gun", "dagger", "greatsword", "spear"],
  worge:   ["staff", "spear", "dagger", "bow", "hammer", "mace", "relic"],
};

// ---------------------------------------------------------------------------
// Bone attachment config
// ---------------------------------------------------------------------------
export type AttachBone = "rightHand" | "leftHand" | "leftShield" | "back";

export interface BoneAttachConfig {
  bone: AttachBone;
  /** Scale multiplier (FBX models often need 0.01, GLBs are 1.0) */
  scale: number;
  /** Local offset from bone [x, y, z] */
  offset: [number, number, number];
  /** Local euler rotation [x, y, z] in radians */
  rotation: [number, number, number];
}

// ---------------------------------------------------------------------------
// Animation pack mapping
// ---------------------------------------------------------------------------
export const WEAPON_ANIM_PACKS: Record<ExtendedWeaponType, string[]> = {
  sword:      ["glocomotion_combat", "glocomotion"],
  greatsword: ["glocomotion_combat", "glocomotion"],
  axe:        ["glocomotion_combat", "glocomotion"],
  hammer:     ["glocomotion_combat", "glocomotion"],
  mace:       ["glocomotion_combat", "glocomotion"],
  dagger:     ["glocomotion_combat", "glocomotion"],
  poleaxe:    ["glocomotion_combat", "glocomotion"],
  spear:      ["glocomotion_combat", "glocomotion"],
  shield:     ["glocomotion_combat", "glocomotion"],
  bow:        ["glocomotion", "glocomotion_combat"],
  crossbow:   ["glocomotion", "glocomotion_combat"],
  gun:        ["glocomotion", "glocomotion_combat"],
  staff:      ["glocomotion", "glocomotion_combat"],
  wand:       ["glocomotion", "glocomotion_combat"],
  tome:       ["glocomotion", "glocomotion_combat"],
  relic:      ["glocomotion", "glocomotion_combat"],
  fists:      ["glocomotion_combat", "glocomotion"],
};

// ---------------------------------------------------------------------------
// Weapon prefab entry
// ---------------------------------------------------------------------------
export interface WeaponPrefab {
  id: string;
  name: string;
  type: ExtendedWeaponType;
  tier: WeaponTier;
  variant: string; // "A" through "F"
  modelPath: string;
  modelFormat: "glb" | "fbx";
  /** Which model pack this came from */
  pack: string;
  /** Bone attachment for the character rig */
  attach: BoneAttachConfig;
  /** Base damage before tier multiplier */
  baseDamage: number;
  /** Base attack speed (attacks per second) */
  baseSpeed: number;
  /** Weight affects knockback and stamina drain */
  weight: number;
  /** R2 storage key */
  r2Key: string;
  /** Classes that can equip this */
  classes: HeroClass[];
  /** Whether this is a two-handed weapon (blocks offHand) */
  twoHanded: boolean;
  /** Off-hand IK grip offset for 2H weapons */
  offHandGrip?: [number, number, number];
}

// ---------------------------------------------------------------------------
// Default bone configs per weapon type
// ---------------------------------------------------------------------------
const R_HAND: BoneAttachConfig = { bone: "rightHand", scale: 1.0, offset: [0, 0, 0], rotation: [0, 0, 0] };
const R_HAND_FBX: BoneAttachConfig = { bone: "rightHand", scale: 0.01, offset: [0, 0, 0], rotation: [0, 0, 0] };
const L_HAND: BoneAttachConfig = { bone: "leftHand", scale: 1.0, offset: [0, 0, 0], rotation: [0, 0, 0] };
const L_SHIELD: BoneAttachConfig = { bone: "leftShield", scale: 1.0, offset: [0, 0, 0], rotation: [0, 0, 0] };
const BACK: BoneAttachConfig = { bone: "back", scale: 1.0, offset: [0, 0, 0], rotation: [0, 0, 0] };

const DEFAULT_ATTACH: Record<ExtendedWeaponType, BoneAttachConfig> = {
  sword: R_HAND, greatsword: R_HAND, axe: R_HAND, hammer: R_HAND,
  mace: R_HAND, dagger: R_HAND, poleaxe: R_HAND, spear: R_HAND,
  shield: L_SHIELD, bow: L_HAND, crossbow: R_HAND, gun: R_HAND,
  staff: R_HAND, wand: R_HAND, tome: L_HAND, relic: L_HAND, fists: R_HAND,
};

// ---------------------------------------------------------------------------
// Base stats per weapon type
// ---------------------------------------------------------------------------
interface WeaponBaseStats {
  damage: number;
  speed: number;
  weight: number;
  twoHanded: boolean;
}

const BASE_STATS: Record<ExtendedWeaponType, WeaponBaseStats> = {
  sword:      { damage: 12, speed: 1.4, weight: 3, twoHanded: false },
  greatsword: { damage: 22, speed: 0.9, weight: 8, twoHanded: true },
  axe:        { damage: 14, speed: 1.2, weight: 4, twoHanded: false },
  hammer:     { damage: 18, speed: 0.8, weight: 7, twoHanded: true },
  mace:       { damage: 15, speed: 1.1, weight: 5, twoHanded: false },
  dagger:     { damage: 8,  speed: 2.0, weight: 1, twoHanded: false },
  poleaxe:    { damage: 20, speed: 0.85, weight: 7, twoHanded: true },
  spear:      { damage: 16, speed: 1.0, weight: 4, twoHanded: true },
  shield:     { damage: 3,  speed: 0.5, weight: 5, twoHanded: false },
  bow:        { damage: 14, speed: 1.0, weight: 2, twoHanded: true },
  crossbow:   { damage: 18, speed: 0.7, weight: 4, twoHanded: true },
  gun:        { damage: 20, speed: 0.6, weight: 3, twoHanded: true },
  staff:      { damage: 10, speed: 1.3, weight: 3, twoHanded: true },
  wand:       { damage: 8,  speed: 1.6, weight: 1, twoHanded: false },
  tome:       { damage: 6,  speed: 0.8, weight: 2, twoHanded: false },
  relic:      { damage: 4,  speed: 0.5, weight: 1, twoHanded: false },
  fists:      { damage: 5,  speed: 2.2, weight: 0, twoHanded: false },
};

// ---------------------------------------------------------------------------
// Model assignments — map each weapon type to its available model paths
//
// Models are pulled from across all our packs. Each type gets up to 6
// distinct visual variants (A–F) that are then replicated across tiers
// with increasing stat multipliers.
// ---------------------------------------------------------------------------

interface ModelSource {
  variant: string;
  path: string;
  format: "glb" | "fbx";
  pack: string;
  attachOverride?: Partial<BoneAttachConfig>;
  offHandGrip?: [number, number, number];
}

const WEAPON_MODELS: Record<ExtendedWeaponType, ModelSource[]> = {
  sword: [
    { variant: "A", path: "/models/weapon_pack/Arming_Sword.glb", format: "glb", pack: "weapon_pack" },
    { variant: "B", path: "/models/weapon_pack/Offset_Sword.glb", format: "glb", pack: "weapon_pack" },
    { variant: "C", path: "/models/weapon_pack/Orc_Sword.glb", format: "glb", pack: "weapon_pack" },
    { variant: "D", path: "/models/weapons_quaternius/Sword.glb", format: "glb", pack: "quaternius" },
    { variant: "E", path: "/models/weapons_quaternius/Sword_Golden.glb", format: "glb", pack: "quaternius" },
    { variant: "F", path: "/models/kaykit_weapons/sword_A.glb", format: "glb", pack: "kaykit" },
  ],
  greatsword: [
    { variant: "A", path: "/models/weapon_pack/Great_Sword.glb", format: "glb", pack: "weapon_pack", offHandGrip: [0, -0.22, 0] },
    { variant: "B", path: "/models/weapons_quaternius/Sword_Big.glb", format: "glb", pack: "quaternius", offHandGrip: [0, -0.20, 0] },
    { variant: "C", path: "/models/weapons_quaternius/Claymore.glb", format: "glb", pack: "quaternius", offHandGrip: [0, -0.20, 0] },
    { variant: "D", path: "/models/kaykit_weapons/sword_D.glb", format: "glb", pack: "kaykit", offHandGrip: [0, -0.20, 0] },
    { variant: "E", path: "/models/kaykit_weapons/sword_E.glb", format: "glb", pack: "kaykit", offHandGrip: [0, -0.20, 0] },
    { variant: "F", path: "/models/weapon_pack/Medieval_Sword.glb", format: "glb", pack: "medieval" },
  ],
  axe: [
    { variant: "A", path: "/models/weapon_pack/Bearded_Axe.glb", format: "glb", pack: "weapon_pack" },
    { variant: "B", path: "/models/weapon_pack/Double_Axe.glb", format: "glb", pack: "weapon_pack" },
    { variant: "C", path: "/models/weapons_quaternius/Axe.glb", format: "glb", pack: "quaternius" },
    { variant: "D", path: "/models/weapons_quaternius/Axe_Double.glb", format: "glb", pack: "quaternius" },
    { variant: "E", path: "/models/weapons_quaternius/Axe_Small.glb", format: "glb", pack: "quaternius" },
    { variant: "F", path: "/models/kaykit_weapons/axe_B.glb", format: "glb", pack: "kaykit" },
  ],
  hammer: [
    { variant: "A", path: "/models/weapon_pack/Anvil_Hammer.glb", format: "glb", pack: "weapon_pack", offHandGrip: [0, -0.18, 0] },
    { variant: "B", path: "/models/weapon_pack/Double_Hammer.glb", format: "glb", pack: "weapon_pack", offHandGrip: [0, -0.18, 0] },
    { variant: "C", path: "/models/weapon_pack/War_Hammer.glb", format: "glb", pack: "weapon_pack", offHandGrip: [0, -0.18, 0] },
    { variant: "D", path: "/models/weapons_quaternius/Hammer_Small.glb", format: "glb", pack: "quaternius" },
    { variant: "E", path: "/models/weapons_quaternius/Hammer_Double.glb", format: "glb", pack: "quaternius", offHandGrip: [0, -0.15, 0] },
    { variant: "F", path: "/models/kaykit_weapons/hammer_A.glb", format: "glb", pack: "kaykit", offHandGrip: [0, -0.15, 0] },
  ],
  mace: [
    { variant: "A", path: "/models/weapon_pack/Medieval_Mace.glb", format: "glb", pack: "medieval", offHandGrip: [0, -0.18, 0] },
    { variant: "B", path: "/models/weapon_pack/Spiked_Mace.glb", format: "glb", pack: "medieval", offHandGrip: [0, -0.18, 0] },
    { variant: "C", path: "/models/weapon_pack/Slam_Hammer.glb", format: "glb", pack: "medieval", offHandGrip: [0, -0.18, 0] },
    { variant: "D", path: "/models/weapons/hammers/hammer_7.glb", format: "glb", pack: "craftpix" },
    { variant: "E", path: "/models/weapons/hammers/hammer_12.glb", format: "glb", pack: "craftpix" },
    { variant: "F", path: "/models/weapons/hammers/hammer_19.glb", format: "glb", pack: "craftpix" },
  ],
  dagger: [
    { variant: "A", path: "/models/weapon_pack/Dagger.glb", format: "glb", pack: "weapon_pack" },
    { variant: "B", path: "/models/weapons_quaternius/Dagger.glb", format: "glb", pack: "quaternius" },
    { variant: "C", path: "/models/weapons_quaternius/Dagger_2.glb", format: "glb", pack: "quaternius" },
    { variant: "D", path: "/models/kaykit_weapons/dagger_A.glb", format: "glb", pack: "kaykit" },
    { variant: "E", path: "/models/kaykit_weapons/dagger_B.glb", format: "glb", pack: "kaykit" },
    { variant: "F", path: "/models/weapon_pack/Medieval_Dagger_A.glb", format: "glb", pack: "medieval" },
  ],
  poleaxe: [
    { variant: "A", path: "/models/weapon_pack/Spear.glb", format: "glb", pack: "weapon_pack", offHandGrip: [0, -0.45, 0] },
    { variant: "B", path: "/models/weapon_pack/Flared_Spear.glb", format: "glb", pack: "weapon_pack", offHandGrip: [0, -0.45, 0] },
    { variant: "C", path: "/models/weapons_quaternius/Spear.glb", format: "glb", pack: "quaternius", offHandGrip: [0, -0.45, 0] },
    { variant: "D", path: "/models/weapons_quaternius/Scythe.glb", format: "glb", pack: "quaternius", offHandGrip: [0, -0.45, 0] },
    { variant: "E", path: "/models/kaykit_weapons/spear_A.glb", format: "glb", pack: "kaykit", offHandGrip: [0, -0.45, 0] },
    { variant: "F", path: "/models/weapon_pack/Quarterstaff.glb", format: "glb", pack: "medieval", offHandGrip: [0, -0.45, 0] },
  ],
  spear: [
    { variant: "A", path: "/models/weapon_pack/Medieval_Spear.glb", format: "glb", pack: "medieval", offHandGrip: [0, -0.45, 0] },
    { variant: "B", path: "/models/weapon_pack/Spear_With_Knife.glb", format: "glb", pack: "medieval", offHandGrip: [0, -0.45, 0] },
    { variant: "C", path: "/models/weapons/poleaxes/poleaxe_3.glb", format: "glb", pack: "craftpix", offHandGrip: [0, -0.45, 0] },
    { variant: "D", path: "/models/weapons/poleaxes/poleaxe_8.glb", format: "glb", pack: "craftpix", offHandGrip: [0, -0.45, 0] },
    { variant: "E", path: "/models/weapons/poleaxes/poleaxe_15.glb", format: "glb", pack: "craftpix", offHandGrip: [0, -0.45, 0] },
    { variant: "F", path: "/models/weapons/poleaxes/poleaxe_22.glb", format: "glb", pack: "craftpix", offHandGrip: [0, -0.45, 0] },
  ],
  shield: [
    { variant: "A", path: "/models/kaykit_weapons/shield_A.glb", format: "glb", pack: "kaykit" },
    { variant: "B", path: "/models/kaykit_weapons/shield_B.glb", format: "glb", pack: "kaykit" },
    { variant: "C", path: "/models/kaykit_weapons/shield_C.glb", format: "glb", pack: "kaykit" },
    { variant: "D", path: "/models/weapons_quaternius/Shield_Round.glb", format: "glb", pack: "quaternius" },
    { variant: "E", path: "/models/weapons_quaternius/Shield_Heater.glb", format: "glb", pack: "quaternius" },
    { variant: "F", path: "/models/weapon_pack/Medieval_Shield_1.glb", format: "glb", pack: "medieval" },
  ],
  bow: [
    { variant: "A", path: "/models/kaykit_weapons/bow_A_withString.glb", format: "glb", pack: "kaykit", offHandGrip: [0, 0, -0.30] },
    { variant: "B", path: "/models/kaykit_weapons/bow_B_withString.glb", format: "glb", pack: "kaykit", offHandGrip: [0, 0, -0.30] },
    { variant: "C", path: "/models/weapon_pack/Bow.glb", format: "glb", pack: "weapon_pack", offHandGrip: [0, 0, -0.30] },
    { variant: "D", path: "/models/weapons_quaternius/Bow_Wooden.glb", format: "glb", pack: "quaternius", offHandGrip: [0, 0, -0.30] },
    { variant: "E", path: "/models/weapons_quaternius/Bow_Evil.glb", format: "glb", pack: "quaternius", offHandGrip: [0, 0, -0.30] },
    { variant: "F", path: "/models/weapon_pack/Medieval_Bow.glb", format: "glb", pack: "medieval", offHandGrip: [0, 0, -0.30] },
  ],
  crossbow: [
    { variant: "A", path: "/models/weapon_pack/Crossbow.glb", format: "glb", pack: "weapon_pack", offHandGrip: [0, 0, 0.18] },
    { variant: "B", path: "/models/weapons/crossbows/crossbow_1.glb", format: "glb", pack: "craftpix" },
    { variant: "C", path: "/models/weapons/crossbows/crossbow_2.glb", format: "glb", pack: "craftpix" },
    { variant: "D", path: "/models/weapons/crossbows/crossbow_3.glb", format: "glb", pack: "craftpix" },
    { variant: "E", path: "/models/weapons/crossbows/crossbow_4.glb", format: "glb", pack: "craftpix" },
    { variant: "F", path: "/models/weapons/crossbows/crossbow_5.glb", format: "glb", pack: "craftpix" },
  ],
  gun: [
    { variant: "A", path: "/models/threejs-games/weapons/revolver.glb", format: "glb", pack: "firearm" },
    { variant: "B", path: "/models/threejs-games/weapons/luger.glb", format: "glb", pack: "firearm" },
    { variant: "C", path: "/models/threejs-games/weapons/rifle.glb", format: "glb", pack: "firearm", offHandGrip: [0, 0, 0.25] },
    { variant: "D", path: "/models/threejs-games/weapons/machine-gun.glb", format: "glb", pack: "firearm", offHandGrip: [0, 0, 0.25] },
    { variant: "E", path: "/models/threejs-games/weapons/flame-gun.glb", format: "glb", pack: "firearm", offHandGrip: [0, 0, 0.22] },
    { variant: "F", path: "/models/threejs-games/weapons/rifle-berthier.glb", format: "glb", pack: "firearm", offHandGrip: [0, 0, 0.28] },
  ],
  staff: [
    { variant: "A", path: "/models/kaykit_weapons/staff_A.glb", format: "glb", pack: "kaykit", offHandGrip: [0, -0.55, 0] },
    { variant: "B", path: "/models/kaykit_weapons/staff_B.glb", format: "glb", pack: "kaykit", offHandGrip: [0, -0.55, 0] },
    { variant: "C", path: "/models/weapon_pack/Wizard_Staff.glb", format: "glb", pack: "weapon_pack", offHandGrip: [0, -0.55, 0] },
    { variant: "D", path: "/models/weapons/staffs/staff_1.glb", format: "glb", pack: "craftpix", offHandGrip: [0, -0.55, 0] },
    { variant: "E", path: "/models/weapons/staffs/staff_2.glb", format: "glb", pack: "craftpix", offHandGrip: [0, -0.55, 0] },
    { variant: "F", path: "/models/weapons/staffs/staff_3.glb", format: "glb", pack: "craftpix", offHandGrip: [0, -0.55, 0] },
  ],
  wand: [
    { variant: "A", path: "/models/kaykit_weapons/wand_A.glb", format: "glb", pack: "kaykit" },
    { variant: "B", path: "/models/weapons/canes/cane_1.glb", format: "glb", pack: "craftpix" },
    { variant: "C", path: "/models/weapons/canes/cane_2.glb", format: "glb", pack: "craftpix" },
    { variant: "D", path: "/models/weapons/canes/cane_3.glb", format: "glb", pack: "craftpix" },
    { variant: "E", path: "/models/weapons/canes/cane_4.glb", format: "glb", pack: "craftpix" },
    { variant: "F", path: "/models/weapons/canes/cane_5.glb", format: "glb", pack: "craftpix" },
  ],
  tome: [
    { variant: "A", path: "/models/weapons/offhand/Tome.glb", format: "glb", pack: "offhand" },
    { variant: "B", path: "/models/weapons/offhand/Book.glb", format: "glb", pack: "offhand" },
    { variant: "C", path: "/models/weapons/offhand/Skull.glb", format: "glb", pack: "offhand" },
    { variant: "D", path: "/models/weapons/canes/cane_5.glb", format: "glb", pack: "craftpix" },
    { variant: "E", path: "/models/weapons/canes/cane_11.glb", format: "glb", pack: "craftpix" },
    { variant: "F", path: "/models/weapons/canes/cane_18.glb", format: "glb", pack: "craftpix" },
  ],
  relic: [
    { variant: "A", path: "/models/weapons/offhand/NatureShield.glb", format: "glb", pack: "offhand" },
    { variant: "B", path: "/models/weapons/offhand/DarkShield.glb", format: "glb", pack: "offhand" },
    { variant: "C", path: "/models/weapons/offhand/Skull.glb", format: "glb", pack: "offhand" },
    { variant: "D", path: "/models/weapons/canes/cane_2.glb", format: "glb", pack: "craftpix" },
    { variant: "E", path: "/models/weapons/canes/cane_9.glb", format: "glb", pack: "craftpix" },
    { variant: "F", path: "/models/weapons/canes/cane_16.glb", format: "glb", pack: "craftpix" },
  ],
  fists: [
    { variant: "A", path: "", format: "glb", pack: "none" },
    { variant: "B", path: "", format: "glb", pack: "none" },
    { variant: "C", path: "", format: "glb", pack: "none" },
    { variant: "D", path: "", format: "glb", pack: "none" },
    { variant: "E", path: "", format: "glb", pack: "none" },
    { variant: "F", path: "", format: "glb", pack: "none" },
  ],
};

// ---------------------------------------------------------------------------
// Generate the full prefab database
// ---------------------------------------------------------------------------

function buildPrefabs(): WeaponPrefab[] {
  const prefabs: WeaponPrefab[] = [];
  const allTypes = Object.keys(WEAPON_MODELS) as ExtendedWeaponType[];
  const tiers: WeaponTier[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  for (const type of allTypes) {
    const models = WEAPON_MODELS[type];
    const stats = BASE_STATS[type];
    const classes = Object.entries(CLASS_WEAPON_RESTRICTIONS)
      .filter(([_, types]) => types.includes(type))
      .map(([cls]) => cls as HeroClass);

    for (const tier of tiers) {
      // Each tier uses the 6 model variants but with scaled stats
      for (const model of models) {
        if (type === "fists" && tier > 0) continue; // fists only have T0

        const id = `${type}_t${tier}_${model.variant.toLowerCase()}`;
        const tierMult = TIER_MULTIPLIERS[tier];
        const attach: BoneAttachConfig = {
          ...DEFAULT_ATTACH[type],
          ...(model.attachOverride || {}),
        };

        prefabs.push({
          id,
          name: `${capitalize(type)} ${model.variant} (${TIER_LABELS[tier]})`,
          type,
          tier,
          variant: model.variant,
          modelPath: model.path,
          modelFormat: model.format,
          pack: model.pack,
          attach,
          baseDamage: Math.round(stats.damage * tierMult),
          baseSpeed: stats.speed,
          weight: stats.weight,
          r2Key: model.path ? `models/${model.path.replace(/^\/models\//, "")}` : "",
          classes,
          twoHanded: stats.twoHanded,
          offHandGrip: model.offHandGrip,
        });
      }
    }
  }

  return prefabs;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const ALL_WEAPON_PREFABS: WeaponPrefab[] = buildPrefabs();

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** Get all prefabs for a weapon type */
export function getPrefabsByType(type: ExtendedWeaponType): WeaponPrefab[] {
  return ALL_WEAPON_PREFABS.filter(p => p.type === type);
}

/** Get all prefabs at a specific tier */
export function getPrefabsByTier(tier: WeaponTier): WeaponPrefab[] {
  return ALL_WEAPON_PREFABS.filter(p => p.tier === tier);
}

/** Get prefabs for a specific type + tier combo */
export function getPrefabsForSlot(type: ExtendedWeaponType, tier: WeaponTier): WeaponPrefab[] {
  return ALL_WEAPON_PREFABS.filter(p => p.type === type && p.tier === tier);
}

/** Get a specific prefab by ID */
export function getPrefabById(id: string): WeaponPrefab | undefined {
  return ALL_WEAPON_PREFABS.find(p => p.id === id);
}

/** Get all weapons equippable by a class */
export function getPrefabsForClass(cls: HeroClass): WeaponPrefab[] {
  return ALL_WEAPON_PREFABS.filter(p => p.classes.includes(cls));
}

/** Get the best (highest tier) prefab for a type that a class can use */
export function getBestPrefab(type: ExtendedWeaponType, cls: HeroClass): WeaponPrefab | undefined {
  return getPrefabsForClass(cls)
    .filter(p => p.type === type)
    .sort((a, b) => b.tier - a.tier)[0];
}

/** Count total prefabs */
export function getPrefabCount(): number {
  return ALL_WEAPON_PREFABS.length;
}

/** Get types that still need more model variants */
export function getModelCoverage(): Record<ExtendedWeaponType, { assigned: number; unique: number }> {
  const coverage: Record<string, { assigned: number; unique: number }> = {};
  for (const type of Object.keys(WEAPON_MODELS) as ExtendedWeaponType[]) {
    const models = WEAPON_MODELS[type];
    const uniquePaths = new Set(models.map(m => m.path).filter(p => p !== ""));
    coverage[type] = { assigned: models.length, unique: uniquePaths.size };
  }
  return coverage as Record<ExtendedWeaponType, { assigned: number; unique: number }>;
}

// ---------------------------------------------------------------------------
// Gap analysis — what's still needed for complete coverage
// ---------------------------------------------------------------------------
export function getModelGaps(): string[] {
  const gaps: string[] = [];
  const coverage = getModelCoverage();

  for (const [type, info] of Object.entries(coverage)) {
    if (type === "fists") continue;
    if (info.unique < 6) {
      gaps.push(`${type}: ${info.unique}/6 unique models — need ${6 - info.unique} more distinct meshes`);
    }
    // Check if any models are duplicated across variants
    const models = WEAPON_MODELS[type as ExtendedWeaponType];
    const paths = models.map(m => m.path).filter(p => p);
    const dupes = paths.filter((p, i) => paths.indexOf(p) !== i);
    if (dupes.length > 0) {
      gaps.push(`${type}: ${dupes.length} duplicated model(s) across variants — should have unique meshes per variant`);
    }
  }

  return gaps;
}
