import * as THREE from "three";
import type { GameEntity } from "yuka";

const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

// Copy a YUKA entity's pose into a three.js Object3D.
// Yuka stores pose as a Matrix4 in `entity.worldMatrix`; we decompose into
// position + quaternion (skip scale — three handles its own).
export function syncEntityToObject3D(entity: GameEntity, obj: THREE.Object3D) {
  const e = entity.worldMatrix.elements as unknown as ArrayLike<number>;
  for (let i = 0; i < 16; i++) _m.elements[i] = e[i];
  _m.decompose(obj.position, _q, obj.scale);
  obj.quaternion.copy(_q);
}
