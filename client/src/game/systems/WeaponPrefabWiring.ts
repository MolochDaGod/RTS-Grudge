/**
 * WeaponPrefabWiring — connects the WeaponPrefabDatabase to the live
 * runtime pipeline. This is the single integration point that every
 * consumer (Player.tsx, Enemy.tsx, CharacterForge, etc.) calls to:
 *
 *   1. Load the correct model for a prefab ID
 *   2. Attach it to the character's bone container
 *   3. Apply tier glow effects + weapon trail color
 *   4. Map the prefab to its skill animations
 *   5. Award profession XP on harvest actions
 *
 * This replaces ad-hoc wiring scattered across components.
 */

import * as THREE from "three";
import {
  type WeaponPrefab,
  type ExtendedWeaponType,
  type WeaponTier,
  type AttachBone,
  type BoneAttachConfig,
  getPrefabById,
  WEAPON_ANIM_PACKS,
  TIER_COLORS,
  TIER_MULTIPLIERS,
} from "./WeaponPrefabDatabase";
import {
  applyTierEffect,
  removeTierEffect,
  updateTierPulse,
  TIER_VISUALS,
} from "../effects/WeaponTierEffects";
import {
  type HarvestToolType,
  type HarvestAction,
  TOOL_PROFESSIONS,
  getToolActions,
  getScaledAction,
  detectToolType,
} from "./HarvestToolActions";
import { loadWeaponModel, normalizeWeaponGroup, WEAPON_REAL_SIZES } from "../components/WeaponModelLoader";
import { ALL_WEAPON_CATALOG, type WeaponModelEntry } from "./ModelRegistry";

// ---------------------------------------------------------------------------
// Model loading + bone attachment
// ---------------------------------------------------------------------------

export interface AttachedWeapon {
  group: THREE.Group;
  prefab: WeaponPrefab;
  bone: THREE.Object3D;
  /** Dispose callback — removes from bone, clears glow */
  dispose: () => void;
}

/**
 * Load a weapon prefab model, apply tier glow, and attach to bone.
 *
 * Full pipeline:
 *   prefab.modelPath → GLTFLoader → normalize → tier effect → bone.add()
 *
 * @param prefabId  ID from WeaponPrefabDatabase (e.g. "sword_t3_a")
 * @param bones     Character bone containers (from useCharacterModel or EquipmentMeshManager)
 * @returns The attached weapon handle, or null on failure
 */
export async function loadAndAttachPrefab(
  prefabId: string,
  bones: Partial<Record<string, THREE.Object3D>>,
): Promise<AttachedWeapon | null> {
  const prefab = getPrefabById(prefabId);
  if (!prefab || !prefab.modelPath) return null;

  const boneKey = prefab.attach.bone;
  const boneNames: Record<AttachBone, string> = {
    rightHand: "R_hand_container",
    leftHand: "L_hand_container",
    leftShield: "L_shield_container",
    back: "Bone_bag",
  };
  const bone = bones[boneNames[boneKey]];
  if (!bone) {
    console.warn(`[WeaponPrefabWiring] Bone ${boneKey} not found for prefab ${prefabId}`);
    return null;
  }

  try {
    // Find the model entry in the catalog for the loader
    const catalogEntry = ALL_WEAPON_CATALOG.find(w => w.path === prefab.modelPath);
    let group: THREE.Group;

    if (catalogEntry) {
      group = await loadWeaponModel(prefab.type, catalogEntry.id);
    } else {
      // FBX model not in catalog — load directly via asset loader
      const { loadAsset } = await import("./AssetLoader");
      const gltf = await loadAsset(prefab.modelPath, "high", `wprefab_${prefabId}`);
      group = new THREE.Group();
      group.name = `weapon_prefab_${prefabId}`;
      group.add(gltf.scene.clone());
      normalizeWeaponGroup(group, prefab.type, prefabId);

      // Apply scale for FBX models
      if (prefab.attach.scale !== 1.0) {
        group.scale.setScalar(prefab.attach.scale);
      }
    }

    // Apply tier glow effect
    applyTierEffect(group, prefab.tier);

    // Apply offset/rotation from prefab config
    const [ox, oy, oz] = prefab.attach.offset;
    if (ox || oy || oz) group.position.set(ox, oy, oz);
    const [rx, ry, rz] = prefab.attach.rotation;
    if (rx || ry || rz) group.rotation.set(rx, ry, rz);

    // Attach to bone
    bone.add(group);

    return {
      group,
      prefab,
      bone,
      dispose: () => {
        removeTierEffect(group);
        bone.remove(group);
      },
    };
  } catch (err) {
    console.error(`[WeaponPrefabWiring] Failed to load prefab ${prefabId}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Weapon trail color per tier
// ---------------------------------------------------------------------------

export interface TrailConfig {
  color: string;
  opacity: number;
  width: number;
  /** Whether to show the trail at all (T0-T1 = no trail) */
  enabled: boolean;
}

export function getTrailConfig(tier: WeaponTier): TrailConfig {
  if (tier <= 1) return { color: "#ffffff", opacity: 0, width: 0, enabled: false };
  const vis = TIER_VISUALS[tier];
  return {
    color: TIER_COLORS[tier],
    opacity: 0.3 + tier * 0.07,
    width: 0.02 + tier * 0.005,
    enabled: true,
  };
}

// ---------------------------------------------------------------------------
// Skill animation mapping — bridges prefab → animation names
// ---------------------------------------------------------------------------

export interface SkillAnimConfig {
  /** Animation clip name in the character's mixer */
  clipName: string;
  /** Animation type for the combat state machine */
  combatEvent: "ATTACK_LIGHT" | "ATTACK_HEAVY" | "ATTACK_COMBO_NEXT" | "ABILITY" | "BLOCK_START";
  /** Cooldown in seconds */
  cooldown: number;
  /** Mana cost */
  manaCost: number;
  /** Damage multiplier on top of weapon base damage */
  damageMult: number;
  /** Whether this triggers weapon trail */
  showTrail: boolean;
  /** VFX preset key (slash, thrust, slam, projectile) */
  vfxType: "slash" | "thrust" | "slam" | "projectile" | "buff" | "aoe" | "none";
}

/**
 * Default skill animation set for a weapon type.
 * Slots 1–4 map to the hotbar. Each weapon type has distinct animations.
 */
export function getWeaponSkillAnims(type: ExtendedWeaponType): SkillAnimConfig[] {
  // Melee weapons
  const MELEE_BASE: SkillAnimConfig[] = [
    { clipName: "attack",      combatEvent: "ATTACK_LIGHT", cooldown: 0,  manaCost: 0,  damageMult: 1.0, showTrail: true,  vfxType: "slash" },
    { clipName: "combo2",      combatEvent: "ATTACK_COMBO_NEXT", cooldown: 0,  manaCost: 0,  damageMult: 1.2, showTrail: true,  vfxType: "slash" },
    { clipName: "combo3",      combatEvent: "ATTACK_COMBO_NEXT", cooldown: 0,  manaCost: 0,  damageMult: 1.5, showTrail: true,  vfxType: "slash" },
    { clipName: "heavyAttack", combatEvent: "ATTACK_HEAVY", cooldown: 3,  manaCost: 0,  damageMult: 2.5, showTrail: true,  vfxType: "slam" },
  ];

  switch (type) {
    case "sword":
    case "axe":
    case "dagger":
    case "mace":
      return MELEE_BASE;

    case "greatsword":
    case "poleaxe":
    case "spear":
    case "hammer":
      return [
        { clipName: "attack",      combatEvent: "ATTACK_LIGHT", cooldown: 0,  manaCost: 0,  damageMult: 1.0, showTrail: true,  vfxType: "slash" },
        { clipName: "combo2",      combatEvent: "ATTACK_COMBO_NEXT", cooldown: 0,  manaCost: 0,  damageMult: 1.3, showTrail: true,  vfxType: "thrust" },
        { clipName: "hadouken",    combatEvent: "ABILITY",      cooldown: 5,  manaCost: 10, damageMult: 2.0, showTrail: true,  vfxType: "aoe" },
        { clipName: "heavyAttack", combatEvent: "ATTACK_HEAVY", cooldown: 4,  manaCost: 0,  damageMult: 3.0, showTrail: true,  vfxType: "slam" },
      ];

    case "shield":
      return [
        { clipName: "block",       combatEvent: "BLOCK_START",  cooldown: 0,  manaCost: 0,  damageMult: 0.3, showTrail: false, vfxType: "none" },
        { clipName: "attack",      combatEvent: "ATTACK_LIGHT", cooldown: 0,  manaCost: 0,  damageMult: 0.5, showTrail: false, vfxType: "slam" },
        { clipName: "hadouken",    combatEvent: "ABILITY",      cooldown: 8,  manaCost: 15, damageMult: 1.0, showTrail: false, vfxType: "buff" },
        { clipName: "heavyAttack", combatEvent: "ATTACK_HEAVY", cooldown: 5,  manaCost: 0,  damageMult: 1.5, showTrail: false, vfxType: "slam" },
      ];

    case "bow":
    case "crossbow":
    case "gun":
      return [
        { clipName: "attack",      combatEvent: "ATTACK_LIGHT", cooldown: 0,  manaCost: 0,  damageMult: 1.0, showTrail: false, vfxType: "projectile" },
        { clipName: "combo2",      combatEvent: "ATTACK_COMBO_NEXT", cooldown: 0,  manaCost: 0,  damageMult: 1.2, showTrail: false, vfxType: "projectile" },
        { clipName: "hadouken",    combatEvent: "ABILITY",      cooldown: 6,  manaCost: 15, damageMult: 2.5, showTrail: false, vfxType: "projectile" },
        { clipName: "heavyAttack", combatEvent: "ATTACK_HEAVY", cooldown: 4,  manaCost: 5,  damageMult: 2.0, showTrail: false, vfxType: "projectile" },
      ];

    case "staff":
    case "wand":
    case "tome":
    case "relic":
      return [
        { clipName: "attack",      combatEvent: "ATTACK_LIGHT", cooldown: 0,  manaCost: 5,  damageMult: 1.0, showTrail: true,  vfxType: "projectile" },
        { clipName: "combo2",      combatEvent: "ATTACK_COMBO_NEXT", cooldown: 0,  manaCost: 8,  damageMult: 1.3, showTrail: true,  vfxType: "projectile" },
        { clipName: "hadouken",    combatEvent: "ABILITY",      cooldown: 5,  manaCost: 20, damageMult: 2.5, showTrail: true,  vfxType: "aoe" },
        { clipName: "heavyAttack", combatEvent: "ATTACK_HEAVY", cooldown: 4,  manaCost: 15, damageMult: 2.0, showTrail: true,  vfxType: "projectile" },
      ];

    default: // fists
      return [
        { clipName: "attack",      combatEvent: "ATTACK_LIGHT", cooldown: 0,  manaCost: 0,  damageMult: 1.0, showTrail: false, vfxType: "none" },
        { clipName: "uppercut",    combatEvent: "ATTACK_COMBO_NEXT", cooldown: 0,  manaCost: 0,  damageMult: 1.3, showTrail: false, vfxType: "none" },
        { clipName: "combo3",      combatEvent: "ATTACK_COMBO_NEXT", cooldown: 0,  manaCost: 0,  damageMult: 1.5, showTrail: false, vfxType: "none" },
        { clipName: "heavyAttack", combatEvent: "ATTACK_HEAVY", cooldown: 2,  manaCost: 0,  damageMult: 2.0, showTrail: false, vfxType: "slam" },
      ];
  }
}

// ---------------------------------------------------------------------------
// Profession XP — awarded on harvest actions
// ---------------------------------------------------------------------------

export interface ProfessionProgress {
  profession: string;
  level: number;
  xp: number;
  xpToNext: number;
}

/** XP per level (scales quadratically) */
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

/** XP per harvest action, scaled by tier and action type */
export function getHarvestXP(
  action: HarvestAction,
  toolTier: WeaponTier,
): number {
  const baseXP: Record<string, number> = {
    action: 5,
    action2: 8,
    auto: 2,     // auto gives less per tick
    special: 20,
  };
  const base = baseXP[action.kind] ?? 5;
  const tierMult = TIER_MULTIPLIERS[toolTier] ?? 1;
  return Math.round(base * tierMult);
}

/**
 * Simple in-memory profession progress tracker.
 * In production this syncs to the VPS via the grudge backend.
 */
const professionData: Map<string, ProfessionProgress> = new Map();

export function getProfessionProgress(profession: string): ProfessionProgress {
  if (!professionData.has(profession)) {
    professionData.set(profession, {
      profession,
      level: 1,
      xp: 0,
      xpToNext: xpForLevel(1),
    });
  }
  return professionData.get(profession)!;
}

export function addProfessionXP(profession: string, amount: number): { leveled: boolean; newLevel: number } {
  const p = getProfessionProgress(profession);
  p.xp += amount;
  let leveled = false;
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level++;
    p.xpToNext = xpForLevel(p.level);
    leveled = true;
  }
  return { leveled, newLevel: p.level };
}

/**
 * Award profession XP for a harvest action.
 * Called from the harvest input handler after a successful gather.
 */
export function awardHarvestXP(
  toolType: HarvestToolType,
  action: HarvestAction,
  toolTier: WeaponTier,
): { profession: string; xpGained: number; leveled: boolean; newLevel: number } {
  const profession = TOOL_PROFESSIONS[toolType];
  const xp = getHarvestXP(action, toolTier);
  const result = addProfessionXP(profession, xp);
  return { profession, xpGained: xp, ...result };
}

// ---------------------------------------------------------------------------
// Per-frame update — call from useFrame for equipped weapon pulse
// ---------------------------------------------------------------------------

/**
 * Update all tier-based visual effects for an equipped weapon.
 * Call once per frame from the Player component.
 */
export function updateEquippedWeaponEffects(
  weapon: AttachedWeapon | null,
  time: number,
): void {
  if (!weapon) return;
  updateTierPulse(weapon.group, time);
}
