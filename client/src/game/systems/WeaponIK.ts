import * as THREE from "three";
import type { WeaponType } from "@/lib/stores/useGame";

const _aPos = new THREE.Vector3();
const _bPos = new THREE.Vector3();
const _cPos = new THREE.Vector3();
const _abDir = new THREE.Vector3();
const _bcDir = new THREE.Vector3();
const _acDir = new THREE.Vector3();
const _atDir = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _qWorld = new THREE.Quaternion();
const _qParent = new THREE.Quaternion();
const _qParentInv = new THREE.Quaternion();
const _qBoneWorld = new THREE.Quaternion();
const _qDelta = new THREE.Quaternion();
const _qNewWorld = new THREE.Quaternion();
const _qNewLocal = new THREE.Quaternion();
const _fallback = new THREE.Vector3();

function applyWorldDelta(bone: THREE.Object3D, deltaWorldQ: THREE.Quaternion): void {
  bone.getWorldQuaternion(_qBoneWorld);
  _qNewWorld.copy(deltaWorldQ).multiply(_qBoneWorld);
  if (bone.parent) {
    bone.parent.getWorldQuaternion(_qParent);
    _qParentInv.copy(_qParent).invert();
    _qNewLocal.copy(_qParentInv).multiply(_qNewWorld);
  } else {
    _qNewLocal.copy(_qNewWorld);
  }
  bone.quaternion.copy(_qNewLocal);
  bone.updateMatrixWorld(true);
}

/**
 * Analytical two-bone IK. Reorients `upper` and `lower` so that `end` reaches
 * `targetWorld` while preserving bone lengths. `poleWorld` (optional) controls
 * the bend plane; without it the existing bend plane is kept.
 *
 * Based on the standard law-of-cosines formulation (e.g. Ryder Mason 2018,
 * Sebastian Lague). Pure rotation, no scale change.
 */
export function solveTwoBoneIK(
  upper: THREE.Object3D,
  lower: THREE.Object3D,
  end: THREE.Object3D,
  targetWorld: THREE.Vector3,
  poleWorld?: THREE.Vector3,
  weight = 1,
): void {
  upper.updateWorldMatrix(true, false);
  lower.updateWorldMatrix(true, false);
  end.updateWorldMatrix(true, false);

  _aPos.setFromMatrixPosition(upper.matrixWorld);
  _bPos.setFromMatrixPosition(lower.matrixWorld);
  _cPos.setFromMatrixPosition(end.matrixWorld);

  const lab = _bPos.distanceTo(_aPos);
  const lbc = _cPos.distanceTo(_bPos);
  if (lab < 1e-5 || lbc < 1e-5) return;

  const targetDist = targetWorld.distanceTo(_aPos);
  const lat = THREE.MathUtils.clamp(targetDist, 1e-3, lab + lbc - 1e-3);

  _abDir.subVectors(_bPos, _aPos).normalize();
  _bcDir.subVectors(_cPos, _bPos).normalize();
  _acDir.subVectors(_cPos, _aPos).normalize();
  _atDir.subVectors(targetWorld, _aPos).normalize();

  // Bend plane axis. Prefer pole hint, otherwise existing arm-plane normal.
  if (poleWorld) {
    _axis.copy(poleWorld).sub(_aPos).cross(_atDir);
  } else {
    _axis.copy(_abDir).cross(_bcDir);
  }
  if (_axis.lengthSq() < 1e-6) {
    // Straight arm — pick any axis perpendicular to ac.
    _fallback.set(0, 0, 1);
    _axis.copy(_fallback).cross(_atDir);
    if (_axis.lengthSq() < 1e-6) _axis.set(1, 0, 0);
  }
  _axis.normalize();

  // Existing angles
  const dot_ac_ab = THREE.MathUtils.clamp(_acDir.dot(_abDir), -1, 1);
  const ac_ab_0 = Math.acos(dot_ac_ab);
  const dot_ba_bc = THREE.MathUtils.clamp(-_abDir.dot(_bcDir), -1, 1);
  const ba_bc_0 = Math.acos(dot_ba_bc);

  // Target angles via law of cosines
  const ac_ab_1 = Math.acos(THREE.MathUtils.clamp(
    (lbc * lbc - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1));
  const ba_bc_1 = Math.acos(THREE.MathUtils.clamp(
    (lat * lat - lab * lab - lbc * lbc) / (-2 * lab * lbc), -1, 1));

  const w = THREE.MathUtils.clamp(weight, 0, 1);

  // 1) Bend the upper joint so |ac| matches |at|
  _qDelta.setFromAxisAngle(_axis, (ac_ab_1 - ac_ab_0) * w);
  applyWorldDelta(upper, _qDelta);

  // 2) Aim ac toward at
  upper.updateWorldMatrix(true, true);
  end.updateWorldMatrix(true, false);
  _cPos.setFromMatrixPosition(end.matrixWorld);
  _acDir.subVectors(_cPos, _aPos).normalize();
  _qWorld.setFromUnitVectors(_acDir, _atDir);
  if (w < 1) _qWorld.slerp(new THREE.Quaternion(), 1 - w);
  applyWorldDelta(upper, _qWorld);

  // 3) Bend the elbow
  _qDelta.setFromAxisAngle(_axis, (ba_bc_1 - ba_bc_0) * w);
  applyWorldDelta(lower, _qDelta);
}

/**
 * Per-weapon-type defaults for where the off-hand should grip on the weapon,
 * expressed in the weapon group's local space (after WeaponModelLoader centering).
 *
 * +Y is "up the weapon" (toward the blade tip / barrel-end). The right hand
 * holds near the top of the handle, so off-hand grips are typically below.
 */
export const OFF_HAND_GRIP_LOCAL: Partial<Record<WeaponType, THREE.Vector3>> = {
  greatsword: new THREE.Vector3(0, -0.18, 0),
  poleaxe:    new THREE.Vector3(0, -0.45, 0),
  staff:      new THREE.Vector3(0, -0.55, 0),
  hammer:     new THREE.Vector3(0, -0.12, 0),
  crossbow:   new THREE.Vector3(0, 0, 0.18),
  gun:        new THREE.Vector3(0, 0, 0.22),
  bow:        new THREE.Vector3(0, 0.0, -0.30), // off-hand pulls string behind grip
};

/**
 * Should the off-hand be IK-pinned to the right-hand weapon?
 * True for two-handed/ranged weapons when the off-hand is empty.
 */
export function shouldUseOffHandIK(
  rightWeapon: WeaponType,
  leftWeapon: WeaponType | null | undefined,
): boolean {
  if (leftWeapon && leftWeapon !== "fists") return false;
  return rightWeapon === "greatsword"
    || rightWeapon === "poleaxe"
    || rightWeapon === "staff"
    || rightWeapon === "hammer"
    || rightWeapon === "crossbow"
    || rightWeapon === "gun"
    || rightWeapon === "bow";
}
