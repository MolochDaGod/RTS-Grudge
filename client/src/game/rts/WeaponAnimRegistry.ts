/**
 * WeaponAnimRegistry — weapon-specific animation FBXs for the modular
 * toon_rts character system. These were authored for the Synty/Mixamo
 * skeleton used by the 6 race GLBs, NOT the main game's Mixamo packs.
 *
 * The ModularCharacter system can consume these directly since they
 * share the same skeleton as the race character GLBs.
 *
 * These are separate from ANIMATION_PACKS in ModelRegistry.ts (which
 * targets the main game's character pipeline) to avoid cross-rig issues.
 */

export interface WeaponAnimEntry {
  name: string;
  file: string;
}

export interface WeaponAnimPack {
  id: string;
  label: string;
  basePath: string;
  weaponTypes: string[];
  animations: WeaponAnimEntry[];
}

export const WEAPON_ANIM_PACKS: WeaponAnimPack[] = [
  {
    id: "sword_shield",
    label: "Sword & Shield",
    basePath: "/models/animations/weapons",
    weaponTypes: ["sword", "shield"],
    animations: [
      { name: "attack_1h_1", file: "Sword And Shield Attack.fbx" },
      { name: "attack_1h_2", file: "Sword And Shield Attack (1).fbx" },
      { name: "attack_1h_3", file: "Sword And Shield Attack (2).fbx" },
      { name: "slash_1h_1", file: "Sword And Shield Slash.fbx" },
      { name: "slash_1h_2", file: "Sword And Shield Slash (1).fbx" },
      { name: "slash_1h_3", file: "Sword And Shield Slash 1.fbx" },
      { name: "cast_1h", file: "Sword And Shield Casting.fbx" },
      { name: "powerup_1h", file: "Sword And Shield Power Up.fbx" },
    ],
  },
  {
    id: "great_sword",
    label: "Great Sword (2H)",
    basePath: "/models/animations/weapons",
    weaponTypes: ["greatsword"],
    animations: [
      { name: "idle_2h", file: "2H - Great Sword Idle.fbx" },
      { name: "idle_2h_2", file: "2H - Great Sword Idle 2.fbx" },
      { name: "idle_2h_3", file: "2H - Great Sword Idle 3.fbx" },
      { name: "run_2h", file: "2H - Great Sword Run.fbx" },
      { name: "slash_2h", file: "2H - Great Sword Slash.fbx" },
      { name: "slash_2h_alt", file: "Great Sword Slash.fbx" },
      { name: "slash_2h_alt2", file: "Great Sword Slash (1).fbx" },
    ],
  },
  {
    id: "magic",
    label: "Magic Casting",
    basePath: "/models/animations/weapons",
    weaponTypes: ["staff", "wand"],
    animations: [
      { name: "cast_spell", file: "Spell Casting.fbx" },
      { name: "cast_1h_01", file: "Standing 1H Cast Spell 01.fbx" },
      { name: "cast_2h_01", file: "Standing 2H Cast Spell 01.fbx" },
      { name: "area_attack_01", file: "Standing 2H Magic Area Attack 01.fbx" },
      { name: "area_attack_02", file: "Standing 2H Magic Area Attack 02.fbx" },
      { name: "magic_attack_01", file: "Standing 2H Magic Attack 01.fbx" },
      { name: "magic_attack_03", file: "Standing 2H Magic Attack 03.fbx" },
      { name: "magic_attack_04", file: "Standing 2H Magic Attack 04.fbx" },
    ],
  },
  {
    id: "combo",
    label: "Weapon Combos",
    basePath: "/models/animations/weapons",
    weaponTypes: ["sword", "greatsword"],
    animations: [
      { name: "combo_1h", file: "One Hand Sword Combo.fbx" },
      { name: "combo_2h", file: "Two Hand Sword Combo.fbx" },
    ],
  },
];

/** Look up weapon anim packs relevant for a given weapon type */
export function getWeaponAnimPacks(weaponType: string): WeaponAnimPack[] {
  return WEAPON_ANIM_PACKS.filter((p) => p.weaponTypes.includes(weaponType));
}

/** Get all animation entries for a weapon type (flattened) */
export function getWeaponAnims(weaponType: string): (WeaponAnimEntry & { basePath: string })[] {
  return WEAPON_ANIM_PACKS
    .filter((p) => p.weaponTypes.includes(weaponType))
    .flatMap((p) => p.animations.map((a) => ({ ...a, basePath: p.basePath })));
}
