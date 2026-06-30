/**
 * Shared material tint for uMMORPG drake variants (one mesh, color = lerp).
 */

import * as THREE from "three";
import {
  type DragonColor,
  getDragonTintHex,
} from "@/game/systems/DragonPetRegistry";

export function applyDragonTint(
  root: THREE.Object3D,
  color: DragonColor,
  lerp = 0.35,
): void {
  const tint = new THREE.Color(getDragonTintHex(color));
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if ("color" in mat && mat.color instanceof THREE.Color) {
        mat.color.lerp(tint, lerp);
      }
      if ("emissive" in mat && mat.emissive instanceof THREE.Color) {
        const emissive = new THREE.Color(getDragonTintHex(color));
        mat.emissive.lerp(emissive, lerp * 0.5);
      }
    }
  });
}