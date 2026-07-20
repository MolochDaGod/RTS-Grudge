import type * as THREE from 'three';

/**
 * Hide weapon / shield / utility meshes on Grudge6 race FBX models so play
 * mode spawns a basic unarmed avatar (body armor kept).
 */
const WEAPON_UTILITY_RE =
  /(?:Units_|weapon_|Xtra_)(?:[Ss]word|[Aa]xe|[Hh]ammer|[Pp]ick|[Ss]pear|[Bb]ow|[Ss]taff|[Ss]hield|[Bb]ag|[Ww]ood|[Qq]uiver)/i;

export function stripUnarmedEquipment(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh & THREE.SkinnedMesh;
    if (!mesh.isMesh && !mesh.isSkinnedMesh) return;
    const name = mesh.name ?? '';
    if (WEAPON_UTILITY_RE.test(name)) {
      mesh.visible = false;
    }
  });
}