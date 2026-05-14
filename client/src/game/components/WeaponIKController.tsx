import { useFrame } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import { useRef } from "react";
import * as THREE from "three";
import {
  findBoneByAlias,
  UPPER_ARM_L_ALIASES, FOREARM_L_ALIASES, LEFT_HAND_ALIASES,
  UPPER_ARM_R_ALIASES, FOREARM_R_ALIASES, RIGHT_HAND_ALIASES,
} from "../systems/BoneAliases";
import { solveTwoBoneIK, OFF_HAND_GRIP_LOCAL, shouldUseOffHandIK } from "../systems/WeaponIK";
import type { WeaponType } from "@/lib/stores/useGame";

interface Props {
  scene: THREE.Object3D | null;
  rightHandRef: MutableRefObject<THREE.Object3D | null>;
  leftHandRef: MutableRefObject<THREE.Object3D | null>;
  weaponRight: WeaponType;
  weaponLeft: WeaponType | null | undefined;
  enabled?: boolean;
}

const _gripWorld = new THREE.Vector3();
const _gripLocal = new THREE.Vector3();
const _pole = new THREE.Vector3();

/**
 * Runs after the animation mixer each frame. When the character is wielding a
 * two-handed or ranged weapon with an empty off-hand, this pins the off-hand
 * to the appropriate grip point on the weapon mesh using two-bone IK.
 *
 * Bow is a special case: the bow is held in the LEFT hand, so we instead pin
 * the RIGHT hand to a draw-point behind the bow grip.
 */
export function WeaponIKController({
  scene, rightHandRef, leftHandRef, weaponRight, weaponLeft, enabled = true,
}: Props) {
  const cache = useRef<{
    upperL: THREE.Object3D | null; lowerL: THREE.Object3D | null; handL: THREE.Object3D | null;
    upperR: THREE.Object3D | null; lowerR: THREE.Object3D | null; handR: THREE.Object3D | null;
    sceneRef: THREE.Object3D | null;
  }>({ upperL: null, lowerL: null, handL: null, upperR: null, lowerR: null, handR: null, sceneRef: null });

  useFrame(() => {
    if (!enabled || !scene) return;
    if (!shouldUseOffHandIK(weaponRight, weaponLeft)) return;

    if (cache.current.sceneRef !== scene) {
      cache.current.sceneRef = scene;
      cache.current.upperL = findBoneByAlias(scene, UPPER_ARM_L_ALIASES);
      cache.current.lowerL = findBoneByAlias(scene, FOREARM_L_ALIASES);
      cache.current.handL  = findBoneByAlias(scene, LEFT_HAND_ALIASES);
      cache.current.upperR = findBoneByAlias(scene, UPPER_ARM_R_ALIASES);
      cache.current.lowerR = findBoneByAlias(scene, FOREARM_R_ALIASES);
      cache.current.handR  = findBoneByAlias(scene, RIGHT_HAND_ALIASES);
    }

    const isBow = weaponRight === "bow";
    const sourceHand = isBow ? leftHandRef.current : rightHandRef.current; // hand actually holding the weapon
    if (!sourceHand) return;

    const weaponGroup = sourceHand.children.find(c => c.name?.startsWith("weapon_"));
    if (!weaponGroup) return;

    // Resolve grip target in weapon-local space
    const userGrip = (weaponGroup.userData?.offHandGripLocal as THREE.Vector3 | undefined);
    const defaultGrip = OFF_HAND_GRIP_LOCAL[weaponRight];
    if (!userGrip && !defaultGrip) return;
    _gripLocal.copy(userGrip || defaultGrip!);

    weaponGroup.updateMatrixWorld(true);
    _gripWorld.copy(_gripLocal).applyMatrix4(weaponGroup.matrixWorld);

    // Choose chain to solve: bow -> right arm (draw hand); else -> left arm (off-hand)
    const upper = isBow ? cache.current.upperR : cache.current.upperL;
    const lower = isBow ? cache.current.lowerR : cache.current.lowerL;
    const hand  = isBow ? cache.current.handR  : cache.current.handL;
    if (!upper || !lower || !hand) return;

    // Pole hint: push elbow outward (away from torso) so it doesn't collapse
    upper.getWorldPosition(_pole);
    _pole.x += isBow ? 0.5 : -0.5;
    _pole.y -= 0.3;

    solveTwoBoneIK(upper, lower, hand, _gripWorld, _pole, 0.85);
  });

  return null;
}
