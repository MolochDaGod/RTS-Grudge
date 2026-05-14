/**
 * WeaponTierEffects — Visual differentiation for weapon tiers T0–T8.
 *
 * The same weapon mesh is shared across tiers. What changes is the
 * visual treatment: glow intensity, emissive color, particle aura,
 * and outline strength. This mirrors the MMO convention where a
 * "Common Sword" and "Artifact Sword" use the same geometry but
 * the Artifact version pulses with golden light.
 *
 * Applied post-load via `applyTierEffect(mesh, tier)` — mutates the
 * material in place. Safe to call on cloned meshes.
 */

import * as THREE from "three";
import type { WeaponTier } from "../systems/WeaponPrefabDatabase";

// ---------------------------------------------------------------------------
// Tier visual config
// ---------------------------------------------------------------------------
export interface TierVisualConfig {
  /** Emissive color (hex) — the glow tint */
  emissiveColor: number;
  /** Emissive intensity (0 = no glow, 1 = strong) */
  emissiveIntensity: number;
  /** Whether to add a particle aura around the weapon */
  hasAura: boolean;
  /** Aura particle color */
  auraColor: number;
  /** Aura particle count per frame */
  auraCount: number;
  /** Outline glow strength (0 = none, used for post-processing) */
  outlineStrength: number;
  /** Metalness override (higher tiers look more polished) */
  metalness: number;
  /** Roughness override (lower = shinier) */
  roughness: number;
  /** Whether the weapon pulses (breathing glow animation) */
  pulses: boolean;
  /** Pulse speed (cycles per second) */
  pulseSpeed: number;
  /** Pulse amplitude (min/max emissive swing) */
  pulseAmplitude: number;
}

export const TIER_VISUALS: Record<WeaponTier, TierVisualConfig> = {
  // T0 Starter — no effects, dull appearance
  0: {
    emissiveColor: 0x000000, emissiveIntensity: 0,
    hasAura: false, auraColor: 0x000000, auraCount: 0,
    outlineStrength: 0, metalness: 0.1, roughness: 0.9,
    pulses: false, pulseSpeed: 0, pulseAmplitude: 0,
  },
  // T1 Common — no glow, slightly cleaner
  1: {
    emissiveColor: 0x000000, emissiveIntensity: 0,
    hasAura: false, auraColor: 0x000000, auraCount: 0,
    outlineStrength: 0, metalness: 0.3, roughness: 0.7,
    pulses: false, pulseSpeed: 0, pulseAmplitude: 0,
  },
  // T2 Uncommon — faint silver shimmer
  2: {
    emissiveColor: 0xa8a8a8, emissiveIntensity: 0.08,
    hasAura: false, auraColor: 0xa8a8a8, auraCount: 0,
    outlineStrength: 0.1, metalness: 0.5, roughness: 0.5,
    pulses: false, pulseSpeed: 0, pulseAmplitude: 0,
  },
  // T3 Rare — blue glow
  3: {
    emissiveColor: 0x4a9eff, emissiveIntensity: 0.2,
    hasAura: true, auraColor: 0x4a9eff, auraCount: 2,
    outlineStrength: 0.3, metalness: 0.6, roughness: 0.4,
    pulses: true, pulseSpeed: 1.0, pulseAmplitude: 0.08,
  },
  // T4 Epic — purple glow with particles
  4: {
    emissiveColor: 0x9d4dff, emissiveIntensity: 0.35,
    hasAura: true, auraColor: 0x9d4dff, auraCount: 3,
    outlineStrength: 0.5, metalness: 0.7, roughness: 0.3,
    pulses: true, pulseSpeed: 1.2, pulseAmplitude: 0.12,
  },
  // T5 Legendary — red/orange pulsing flame glow
  5: {
    emissiveColor: 0xff4d4d, emissiveIntensity: 0.5,
    hasAura: true, auraColor: 0xff6633, auraCount: 5,
    outlineStrength: 0.7, metalness: 0.8, roughness: 0.2,
    pulses: true, pulseSpeed: 1.5, pulseAmplitude: 0.15,
  },
  // T6 Mythic — gold/amber intense glow
  6: {
    emissiveColor: 0xffaa00, emissiveIntensity: 0.65,
    hasAura: true, auraColor: 0xffcc33, auraCount: 6,
    outlineStrength: 0.8, metalness: 0.85, roughness: 0.15,
    pulses: true, pulseSpeed: 1.8, pulseAmplitude: 0.18,
  },
  // T7 Ancient — warm gold with ancient rune particles
  7: {
    emissiveColor: 0xd4a84b, emissiveIntensity: 0.75,
    hasAura: true, auraColor: 0xd4a84b, auraCount: 8,
    outlineStrength: 0.9, metalness: 0.9, roughness: 0.1,
    pulses: true, pulseSpeed: 2.0, pulseAmplitude: 0.2,
  },
  // T8 Artifact — blinding white-gold, maximum everything
  8: {
    emissiveColor: 0xf0d890, emissiveIntensity: 0.9,
    hasAura: true, auraColor: 0xfff0cc, auraCount: 12,
    outlineStrength: 1.0, metalness: 0.95, roughness: 0.05,
    pulses: true, pulseSpeed: 2.5, pulseAmplitude: 0.25,
  },
};

// ---------------------------------------------------------------------------
// Apply tier effect to a weapon mesh
// ---------------------------------------------------------------------------

/**
 * Apply tier-appropriate visual effects to a weapon mesh.
 * Mutates the material in place — call on cloned meshes only.
 *
 * @param root  The weapon Object3D (may contain child meshes)
 * @param tier  Weapon tier 0–8
 */
export function applyTierEffect(root: THREE.Object3D, tier: WeaponTier): void {
  const config = TIER_VISUALS[tier];
  if (!config) return;

  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    for (const mat of materials) {
      const stdMat = mat as THREE.MeshStandardMaterial;
      if (!stdMat.isMeshStandardMaterial) continue;

      // Cache original values for later restoration
      if (!stdMat.userData._tierOriginal) {
        stdMat.userData._tierOriginal = {
          emissive: stdMat.emissive.getHex(),
          emissiveIntensity: stdMat.emissiveIntensity,
          metalness: stdMat.metalness,
          roughness: stdMat.roughness,
        };
      }

      // Apply tier overrides
      if (config.emissiveIntensity > 0) {
        stdMat.emissive.setHex(config.emissiveColor);
        stdMat.emissiveIntensity = config.emissiveIntensity;
      }
      stdMat.metalness = config.metalness;
      stdMat.roughness = config.roughness;
      stdMat.needsUpdate = true;
    }
  });

  // Tag the root for the pulse animation system
  root.userData.tierConfig = config;
  root.userData.tier = tier;
}

/**
 * Remove tier effects and restore original material values.
 */
export function removeTierEffect(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    for (const mat of materials) {
      const stdMat = mat as THREE.MeshStandardMaterial;
      const orig = stdMat.userData._tierOriginal;
      if (!orig) continue;

      stdMat.emissive.setHex(orig.emissive);
      stdMat.emissiveIntensity = orig.emissiveIntensity;
      stdMat.metalness = orig.metalness;
      stdMat.roughness = orig.roughness;
      stdMat.needsUpdate = true;
      delete stdMat.userData._tierOriginal;
    }
  });

  delete root.userData.tierConfig;
  delete root.userData.tier;
}

// ---------------------------------------------------------------------------
// Pulse animation — call once per frame for equipped weapons
// ---------------------------------------------------------------------------

/**
 * Update the breathing glow pulse on a tier-tagged weapon.
 * Call from useFrame. No-ops if the weapon has no pulse config.
 *
 * @param root  The weapon Object3D (must have userData.tierConfig)
 * @param time  Elapsed time in seconds (performance.now() / 1000)
 */
export function updateTierPulse(root: THREE.Object3D, time: number): void {
  const config = root.userData.tierConfig as TierVisualConfig | undefined;
  if (!config?.pulses) return;

  const pulse = Math.sin(time * config.pulseSpeed * Math.PI * 2) * 0.5 + 0.5;
  const intensity = config.emissiveIntensity - config.pulseAmplitude
    + pulse * config.pulseAmplitude * 2;

  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of materials) {
      const stdMat = mat as THREE.MeshStandardMaterial;
      if (stdMat.isMeshStandardMaterial && stdMat.userData._tierOriginal) {
        stdMat.emissiveIntensity = intensity;
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Tool prefabs — harvesting tools use the same tier glow system
// ---------------------------------------------------------------------------
export interface ToolPrefab {
  id: string;
  name: string;
  type: "pickaxe" | "axe" | "hoe" | "sickle" | "fishing_rod" | "shovel";
  tier: WeaponTier;
  modelPath: string;
  modelFormat: "glb" | "fbx";
  /** Harvesting speed multiplier */
  harvestSpeed: number;
  /** Profession bonus: mining, logging, farming, herbalism, fishing */
  profession: string;
  /** Bone attachment */
  attachBone: "rightHand";
}

export const TOOL_PREFABS: ToolPrefab[] = [
  // T0 Starter tools — always available
  { id: "pick_t0", name: "Crude Pickaxe", type: "pickaxe", tier: 0, modelPath: "/models/weapons/hammers_fbx/_hammer_01.fbx", modelFormat: "fbx", harvestSpeed: 1.0, profession: "mining", attachBone: "rightHand" },
  { id: "axe_t0",  name: "Crude Hatchet", type: "axe",     tier: 0, modelPath: "/models/weapons/swords_fbx/_sword_1.fbx", modelFormat: "fbx", harvestSpeed: 1.0, profession: "logging", attachBone: "rightHand" },
  { id: "hoe_t0",  name: "Crude Hoe",     type: "hoe",     tier: 0, modelPath: "/models/weapons/polearms_fbx/_polearm_1.fbx", modelFormat: "fbx", harvestSpeed: 1.0, profession: "farming", attachBone: "rightHand" },
  { id: "sickle_t0", name: "Crude Sickle", type: "sickle", tier: 0, modelPath: "/models/weapons/daggers_fbx/_dagger_1.fbx", modelFormat: "fbx", harvestSpeed: 1.0, profession: "herbalism", attachBone: "rightHand" },
  { id: "rod_t0",  name: "Crude Rod",     type: "fishing_rod", tier: 0, modelPath: "/models/weapons/canes_fbx/_Cane_1.fbx", modelFormat: "fbx", harvestSpeed: 1.0, profession: "fishing", attachBone: "rightHand" },
  { id: "shovel_t0", name: "Crude Shovel", type: "shovel", tier: 0, modelPath: "/models/weapons/polearms_fbx/_polearm_2.fbx", modelFormat: "fbx", harvestSpeed: 1.0, profession: "mining", attachBone: "rightHand" },

  // T1 Common tools
  { id: "pick_t1", name: "Stone Pickaxe",  type: "pickaxe", tier: 1, modelPath: "/models/weapons/hammers_fbx/_hammer_03.fbx", modelFormat: "fbx", harvestSpeed: 1.3, profession: "mining", attachBone: "rightHand" },
  { id: "axe_t1",  name: "Stone Hatchet",  type: "axe",     tier: 1, modelPath: "/models/weapons/swords_fbx/_sword_3.fbx", modelFormat: "fbx", harvestSpeed: 1.3, profession: "logging", attachBone: "rightHand" },
  { id: "hoe_t1",  name: "Stone Hoe",      type: "hoe",     tier: 1, modelPath: "/models/weapons/polearms_fbx/_polearm_5.fbx", modelFormat: "fbx", harvestSpeed: 1.3, profession: "farming", attachBone: "rightHand" },
  { id: "sickle_t1", name: "Stone Sickle", type: "sickle", tier: 1, modelPath: "/models/weapons/daggers_fbx/_dagger_4.fbx", modelFormat: "fbx", harvestSpeed: 1.3, profession: "herbalism", attachBone: "rightHand" },
  { id: "rod_t1",  name: "Wood Rod",       type: "fishing_rod", tier: 1, modelPath: "/models/weapons/canes_fbx/_Cane_5.fbx", modelFormat: "fbx", harvestSpeed: 1.3, profession: "fishing", attachBone: "rightHand" },
  { id: "shovel_t1", name: "Stone Shovel", type: "shovel", tier: 1, modelPath: "/models/weapons/polearms_fbx/_polearm_6.fbx", modelFormat: "fbx", harvestSpeed: 1.3, profession: "mining", attachBone: "rightHand" },
];

/** Get tool prefabs by profession */
export function getToolsByProfession(profession: string): ToolPrefab[] {
  return TOOL_PREFABS.filter(t => t.profession === profession);
}

/** Get the best tool for a profession at or below a given tier */
export function getBestTool(profession: string, maxTier: WeaponTier): ToolPrefab | undefined {
  return TOOL_PREFABS
    .filter(t => t.profession === profession && t.tier <= maxTier)
    .sort((a, b) => b.tier - a.tier)[0];
}
