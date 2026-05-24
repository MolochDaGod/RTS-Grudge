// ── Player material helpers ──────────────────────────────────────────────────
// Extracted from Player.tsx: material color mapping, overrides, and charge glow.

import * as THREE from "three";
import type { MaterialColors } from "@/lib/stores/useGame";

export const MATERIAL_TO_PART: Record<string, keyof MaterialColors> = {
  Skin: "skin", Face: "skin", Teeth: "skin", Body: "skin", Head: "skin", Flesh: "skin",
  Foot: "skin", Feet: "skin", Arm: "skin", Leg_Skin: "skin",
  Hair: "hair", Hat: "hat", Helmet: "hat", Hood: "hat",
  Armor: "armor", Armor_Dark: "armor", Main: "armor",
  Gauntlet: "armor", Bracer: "armor", Pauldron: "armor", Shield: "armor", Plate: "armor",
  Clothes: "clothing", Shirt: "clothing", Top: "clothing", Tunic: "clothing", Cape: "clothing", Cloak: "clothing",
  Robe: "clothing", Vest: "clothing", Jacket: "clothing", Tabard: "clothing",
  Pants: "pants", Legs: "pants", Trousers: "pants", Skirt: "pants", Greaves: "pants",
  Boots: "pants", Leggings: "pants", Shorts: "pants", Kilt: "pants",
  Belt: "detail", Buckle: "detail", Strap: "detail",
  Beige: "clothing", Brown: "clothing", Black: "clothing", Light: "clothing",
  Gold: "detail", Detail: "detail", Red: "detail", Gem: "detail", Jewel: "detail",
};

export function buildMaterialOverrides(matColors: MaterialColors): Record<string, string> | null {
  const overrides: Record<string, string> = {};
  let hasAny = false;
  for (const [matName, partKey] of Object.entries(MATERIAL_TO_PART)) {
    const colorVal = matColors[partKey];
    if (colorVal) {
      overrides[matName] = colorVal;
      hasAny = true;
    }
  }
  return hasAny ? overrides : null;
}

// --- Charge glow ----------------------------------------------------------
interface ChargedUserData {
  __chargeOwned?: boolean;
  __origEmissive?: number;
  __origEmissiveIntensity?: number;
}

type EmissiveMaterial = THREE.MeshStandardMaterial | THREE.MeshPhongMaterial;

export function isEmissiveMaterial(m: THREE.Material): m is EmissiveMaterial {
  return m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhongMaterial;
}

const CHARGE_GLOW_COLORS = [
  0x000000, // tier 0 — restore original
  0x4488ff, // tier 1 — cool blue glow
  0xffaa44, // tier 2 — hot orange glow
];
const CHARGE_GLOW_INTENSITY = [0, 1.4, 2.8];

export function applyChargeGlow(boneRoot: THREE.Object3D | null, tier: 0 | 1 | 2) {
  if (!boneRoot) return;
  for (const child of boneRoot.children) {
    if (!child.name.startsWith("weapon_")) continue;
    child.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mesh = obj;
      const swap = (m: THREE.Material): THREE.Material => {
        if (!isEmissiveMaterial(m)) return m;
        let owned = m;
        const ud = owned.userData as ChargedUserData;
        if (!ud.__chargeOwned) {
          owned = m.clone() as EmissiveMaterial;
          const newUd = owned.userData as ChargedUserData;
          newUd.__chargeOwned = true;
          newUd.__origEmissive = m.emissive.getHex();
          newUd.__origEmissiveIntensity = m.emissiveIntensity;
        }
        const ownedUd = owned.userData as ChargedUserData;
        if (tier === 0) {
          owned.emissive.setHex(ownedUd.__origEmissive ?? 0);
          owned.emissiveIntensity = ownedUd.__origEmissiveIntensity ?? 0;
        } else {
          owned.emissive.setHex(CHARGE_GLOW_COLORS[tier]);
          owned.emissiveIntensity = CHARGE_GLOW_INTENSITY[tier];
        }
        return owned;
      };
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(swap);
      } else {
        mesh.material = swap(mesh.material);
      }
    });
  }
}
