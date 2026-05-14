import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  applyHandGripPose,
  buildHandGripBoneCache,
  pickGripPose,
  type GripPose,
  type HandGripBoneCache,
} from "@/game/systems/BoneAliases";
import type { WeaponType } from "@/lib/stores/useGame";

interface Props {
  scene: THREE.Object3D | null;
  weaponRight: WeaponType;
  weaponLeft: WeaponType | null | undefined;
  /** Optional pose overrides (used by debug tools / tests). */
  poseRightOverride?: GripPose;
  poseLeftOverride?: GripPose;
  enabled?: boolean;
}

/**
 * Runs every frame after the animation mixer has ticked and folds the
 * character's fingers around whatever weapon they are holding. Caches the
 * finger bone references the first time it sees a scene so per-frame cost
 * stays at "set 30 quaternions".
 *
 * If the rig has no finger bones (e.g. the lower-poly KayKit skeletons),
 * the cache simply ends up empty and this component is a no-op.
 */
export function GripPoseController({
  scene, weaponRight, weaponLeft, poseRightOverride, poseLeftOverride, enabled = true,
}: Props) {
  const cacheRef = useRef<{ scene: THREE.Object3D; right: HandGripBoneCache; left: HandGripBoneCache } | null>(null);

  // Rebuild cache when scene swaps (character race change).
  useEffect(() => {
    if (!scene) {
      cacheRef.current = null;
      return;
    }
    cacheRef.current = {
      scene,
      right: buildHandGripBoneCache(scene, "right"),
      left:  buildHandGripBoneCache(scene, "left"),
    };
    return () => {
      // Restore rest pose so a future scene with no GripPoseController
      // doesn't inherit our curled fingers.
      const c = cacheRef.current;
      if (c) {
        for (const e of c.right.bones) e.bone.quaternion.copy(e.restQ);
        for (const e of c.left.bones)  e.bone.quaternion.copy(e.restQ);
      }
      cacheRef.current = null;
    };
  }, [scene]);

  const poseRight = useMemo(
    () => poseRightOverride ?? pickGripPose("right", weaponRight, weaponLeft),
    [poseRightOverride, weaponRight, weaponLeft],
  );
  const poseLeft = useMemo(
    () => poseLeftOverride ?? pickGripPose("left", weaponLeft, weaponRight),
    [poseLeftOverride, weaponRight, weaponLeft],
  );

  // Tracks the last pose reference per hand so the very first frame after a
  // pose swap (weapon equip/unequip) is a `force` write — that reclaims any
  // bones previously latched as authored by the animation mixer and applies
  // the new procedural curl on top.
  const lastPoseRight = useRef<GripPose | null>(null);
  const lastPoseLeft = useRef<GripPose | null>(null);

  // Runs at default priority. The mixer animates no finger tracks today, so
  // ordering against the mixer tick is incidental — once we set the curl,
  // nothing else writes those bones for the rest of the frame. If finger
  // tracks are introduced later, `applyHandGripPose` latches per-bone
  // authored ownership so the animation always wins until the next pose
  // swap (handled by the `force` flag below).
  useFrame(() => {
    if (!enabled) return;
    const cache = cacheRef.current;
    if (!cache) return;
    const forceRight = lastPoseRight.current !== poseRight;
    const forceLeft = lastPoseLeft.current !== poseLeft;
    applyHandGripPose(cache.right, poseRight, { force: forceRight });
    applyHandGripPose(cache.left,  poseLeft,  { force: forceLeft });
    lastPoseRight.current = poseRight;
    lastPoseLeft.current = poseLeft;
  });

  return null;
}
