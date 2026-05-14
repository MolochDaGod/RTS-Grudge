import * as THREE from "three";

// ---------------------------------------------------------------------------
// Two-bone IK solver with foot-placement and hand-reach pipelines.
//
// Runs post-mixer update (after AnimationMixer.update and before render) so
// the IK adjustments layer on top of whatever clip the blend tree resolved
// to this frame. The solver mutates bone world-matrices in place.
//
// Gated behind a quality flag — call `setIKEnabled(false)` on low-end
// devices or when IK would conflict (e.g. during full-body overrides like
// death).
// ---------------------------------------------------------------------------

let _ikEnabled = true;
export function setIKEnabled(v: boolean) { _ikEnabled = v; }
export function getIKEnabled() { return _ikEnabled; }

// Reusable temporaries (module-scope to avoid per-frame allocation)
const _v3A = new THREE.Vector3();
const _v3B = new THREE.Vector3();
const _v3C = new THREE.Vector3();
const _v3D = new THREE.Vector3();
const _q1  = new THREE.Quaternion();
const _q2  = new THREE.Quaternion();
const _mat = new THREE.Matrix4();
const _rayOrigin = new THREE.Vector3();
const _rayDir    = new THREE.Vector3(0, -1, 0);

// ---------------------------------------------------------------------------
// Two-bone IK (CCD-lite for 2 bones: upper + lower towards target)
// ---------------------------------------------------------------------------
/**
 * Solve a two-bone IK chain (e.g. upper leg → lower leg → foot)
 * so that the end effector (foot/hand) reaches `target` in world space.
 *
 * @param upper  - The upper bone (e.g. thigh / upper arm)
 * @param lower  - The child bone (e.g. shin / forearm)
 * @param effector - The end bone (e.g. foot / hand) — used for reading only
 * @param target - Desired world-space position for the effector
 * @param hint   - Pole vector hint in world space (knee / elbow direction)
 */
export function solveTwoBoneIK(
  upper: THREE.Bone,
  lower: THREE.Bone,
  effector: THREE.Bone,
  target: THREE.Vector3,
  hint: THREE.Vector3,
) {
  // Bone world positions
  upper.updateWorldMatrix(true, false);
  lower.updateWorldMatrix(true, false);
  effector.updateWorldMatrix(true, false);

  const a = _v3A.setFromMatrixPosition(upper.matrixWorld);
  const b = _v3B.setFromMatrixPosition(lower.matrixWorld);
  const c = _v3C.setFromMatrixPosition(effector.matrixWorld);

  const lab = a.distanceTo(b); // upper bone length
  const lcb = b.distanceTo(c); // lower bone length
  const lat = a.distanceTo(target);

  // Clamp reach so the solver doesn't flip when target is beyond full extension
  const eps = 0.001;
  const maxReach = lab + lcb - eps;
  const clampedTarget = _v3D.copy(target);
  if (lat > maxReach) {
    clampedTarget.sub(a).normalize().multiplyScalar(maxReach).add(a);
  }

  const ac = clampedTarget.clone().sub(a);
  const acLen = ac.length();

  // Law of cosines for the angle at the upper joint
  const cosAngleUpper = Math.max(-1, Math.min(1,
    (lab * lab + acLen * acLen - lcb * lcb) / (2 * lab * acLen)
  ));
  const angleUpper = Math.acos(cosAngleUpper);

  // Build rotation for upper bone: aim at target, then bend by angleUpper
  // towards the hint plane.
  const acNorm = ac.clone().normalize();
  const hintDir = hint.clone().sub(a).normalize();

  // Plane normal from ac × hint
  const planeNormal = _v3A.crossVectors(acNorm, hintDir).normalize();
  if (planeNormal.lengthSq() < 0.001) {
    // Degenerate — hint is collinear with ac; skip IK this frame
    return;
  }

  // Bend direction: rotate acNorm around planeNormal by -angleUpper
  _q1.setFromAxisAngle(planeNormal, -angleUpper);
  const upperDir = acNorm.clone().applyQuaternion(_q1);

  // Apply upper rotation in parent space
  const parentInv = _mat.copy(upper.parent?.matrixWorld ?? _mat.identity()).invert();
  const localDir = upperDir.clone().transformDirection(parentInv);

  // Current local forward of upper bone (down the bone)
  const currentDir = _v3B.set(0, 1, 0); // bones typically point along +Y (local)
  _q2.setFromUnitVectors(currentDir.normalize(), localDir.normalize());
  upper.quaternion.premultiply(_q2);
  upper.updateWorldMatrix(false, true);

  // Now solve lower bone: aim from lower toward target
  lower.updateWorldMatrix(true, false);
  const newB = _v3A.setFromMatrixPosition(lower.matrixWorld);
  const btDir = clampedTarget.clone().sub(newB).normalize();

  effector.updateWorldMatrix(true, false);
  const newC = _v3B.setFromMatrixPosition(effector.matrixWorld);
  const bcDir = newC.clone().sub(newB).normalize();

  const lowerParentInv = _mat.copy(lower.parent?.matrixWorld ?? _mat.identity()).invert();
  const bcLocal = bcDir.clone().transformDirection(lowerParentInv).normalize();
  const btLocal = btDir.clone().transformDirection(lowerParentInv).normalize();

  _q1.setFromUnitVectors(bcLocal, btLocal);
  lower.quaternion.premultiply(_q1);
  lower.updateWorldMatrix(false, true);
}

// ---------------------------------------------------------------------------
// Foot IK pipeline
// ---------------------------------------------------------------------------
export interface FootIKBones {
  leftUpperLeg:  THREE.Bone | null;
  leftLowerLeg:  THREE.Bone | null;
  leftFoot:      THREE.Bone | null;
  rightUpperLeg: THREE.Bone | null;
  rightLowerLeg: THREE.Bone | null;
  rightFoot:     THREE.Bone | null;
  hips:          THREE.Bone | null;
}

export interface FootIKResult {
  leftOffset: number;
  rightOffset: number;
  pelvisOffset: number;
}

const FOOT_RAY_HEIGHT = 1.5;  // ray origin above the foot bone
const FOOT_RAY_LENGTH = 2.5;  // max ray length downward
const MAX_FOOT_OFFSET = 0.4;  // max vertical foot adjustment (m)

/**
 * Discover foot-IK bones from a skeleton by name matching.
 * Searches for common Mixamo / retargeted bone names.
 */
export function discoverFootBones(root: THREE.Object3D): FootIKBones {
  const result: FootIKBones = {
    leftUpperLeg: null, leftLowerLeg: null, leftFoot: null,
    rightUpperLeg: null, rightLowerLeg: null, rightFoot: null,
    hips: null,
  };

  const nameMap: Record<string, keyof FootIKBones> = {};
  // Mixamo standard
  const patterns: [RegExp, keyof FootIKBones][] = [
    [/mixamorigLeftUpLeg|LeftUpLeg|upperlegl|thigh[._-]?l/i, "leftUpperLeg"],
    [/mixamorigLeftLeg|LeftLeg|lowerlegl|shin[._-]?l|calf[._-]?l/i, "leftLowerLeg"],
    [/mixamorigLeftFoot|LeftFoot|footl|foot[._-]?l/i, "leftFoot"],
    [/mixamorigRightUpLeg|RightUpLeg|upperlegr|thigh[._-]?r/i, "rightUpperLeg"],
    [/mixamorigRightLeg|RightLeg|lowerlegr|shin[._-]?r|calf[._-]?r/i, "rightLowerLeg"],
    [/mixamorigRightFoot|RightFoot|footr|foot[._-]?r/i, "rightFoot"],
    [/mixamorigHips|Hips|pelvis|root/i, "hips"],
  ];

  root.traverse((node) => {
    if (!(node as THREE.Bone).isBone) return;
    for (const [re, key] of patterns) {
      if (re.test(node.name) && !result[key]) {
        (result as any)[key] = node;
      }
    }
  });

  return result;
}

/**
 * Run the foot-IK pipeline for a single frame.
 *
 * @param bones     Discovered foot IK bones
 * @param raycaster A reusable raycaster instance
 * @param terrain   The terrain mesh(es) to raycast against
 * @param charWorldY The character's current world-space foot height (body.y)
 * @returns offsets applied (for debug / telemetry)
 */
export function solveFootIK(
  bones: FootIKBones,
  raycaster: THREE.Raycaster,
  terrain: THREE.Object3D[],
  charWorldY: number,
): FootIKResult {
  const result: FootIKResult = { leftOffset: 0, rightOffset: 0, pelvisOffset: 0 };
  if (!_ikEnabled) return result;
  if (!bones.hips || !bones.leftFoot || !bones.rightFoot) return result;

  // Cast rays from above each foot straight down
  const leftHit  = castFootRay(bones.leftFoot, raycaster, terrain);
  const rightHit = castFootRay(bones.rightFoot, raycaster, terrain);

  if (leftHit !== null) {
    result.leftOffset = Math.max(-MAX_FOOT_OFFSET, Math.min(MAX_FOOT_OFFSET, leftHit - charWorldY));
  }
  if (rightHit !== null) {
    result.rightOffset = Math.max(-MAX_FOOT_OFFSET, Math.min(MAX_FOOT_OFFSET, rightHit - charWorldY));
  }

  // Pelvis drops by the larger offset so both feet can reach the ground.
  // Only drop (negative offset); don't lift the pelvis above rest pose.
  const minOffset = Math.min(result.leftOffset, result.rightOffset, 0);
  result.pelvisOffset = minOffset;

  // Apply pelvis offset
  if (Math.abs(minOffset) > 0.005) {
    bones.hips.position.y += minOffset;
  }

  // IK-solve each leg to reach the ground hit point
  if (leftHit !== null && bones.leftUpperLeg && bones.leftLowerLeg) {
    const target = _v3A.copy(bones.leftFoot.getWorldPosition(_v3B));
    target.y = leftHit + result.pelvisOffset;
    const knee = _v3C.copy(bones.leftLowerLeg.getWorldPosition(_v3D));
    knee.z -= 0.2; // forward bias for knee
    solveTwoBoneIK(bones.leftUpperLeg, bones.leftLowerLeg, bones.leftFoot, target, knee);
  }

  if (rightHit !== null && bones.rightUpperLeg && bones.rightLowerLeg) {
    const target = _v3A.copy(bones.rightFoot.getWorldPosition(_v3B));
    target.y = rightHit + result.pelvisOffset;
    const knee = _v3C.copy(bones.rightLowerLeg.getWorldPosition(_v3D));
    knee.z -= 0.2;
    solveTwoBoneIK(bones.rightUpperLeg, bones.rightLowerLeg, bones.rightFoot, target, knee);
  }

  return result;
}

function castFootRay(
  foot: THREE.Bone,
  raycaster: THREE.Raycaster,
  terrain: THREE.Object3D[],
): number | null {
  foot.updateWorldMatrix(true, false);
  const footPos = _v3A.setFromMatrixPosition(foot.matrixWorld);
  _rayOrigin.set(footPos.x, footPos.y + FOOT_RAY_HEIGHT, footPos.z);
  raycaster.set(_rayOrigin, _rayDir);
  raycaster.far = FOOT_RAY_LENGTH;

  const hits = raycaster.intersectObjects(terrain, true);
  if (hits.length > 0) {
    return hits[0].point.y;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hand IK pipeline (for climbing / object interaction)
// ---------------------------------------------------------------------------
export interface HandIKBones {
  leftUpperArm:  THREE.Bone | null;
  leftLowerArm:  THREE.Bone | null;
  leftHand:      THREE.Bone | null;
  rightUpperArm: THREE.Bone | null;
  rightLowerArm: THREE.Bone | null;
  rightHand:     THREE.Bone | null;
}

export function discoverHandBones(root: THREE.Object3D): HandIKBones {
  const result: HandIKBones = {
    leftUpperArm: null, leftLowerArm: null, leftHand: null,
    rightUpperArm: null, rightLowerArm: null, rightHand: null,
  };
  const patterns: [RegExp, keyof HandIKBones][] = [
    [/mixamorigLeftArm|LeftArm|upperarml|shoulder[._-]?l/i, "leftUpperArm"],
    [/mixamorigLeftForeArm|LeftForeArm|lowerarml|forearm[._-]?l/i, "leftLowerArm"],
    [/mixamorigLeftHand|LeftHand|handl|hand[._-]?l|L_hand/i, "leftHand"],
    [/mixamorigRightArm|RightArm|upperarmr|shoulder[._-]?r/i, "rightUpperArm"],
    [/mixamorigRightForeArm|RightForeArm|lowerarmr|forearm[._-]?r/i, "rightLowerArm"],
    [/mixamorigRightHand|RightHand|handr|hand[._-]?r|R_hand/i, "rightHand"],
  ];
  root.traverse((node) => {
    if (!(node as THREE.Bone).isBone) return;
    for (const [re, key] of patterns) {
      if (re.test(node.name) && !result[key]) {
        (result as any)[key] = node;
      }
    }
  });
  return result;
}

export interface HandIKTarget {
  left:  THREE.Vector3 | null;
  right: THREE.Vector3 | null;
}

/**
 * Solve hand IK for both arms towards supplied world-space targets.
 * Pass null for a hand that shouldn't be IK'd this frame.
 */
export function solveHandIK(
  bones: HandIKBones,
  targets: HandIKTarget,
) {
  if (!_ikEnabled) return;

  if (targets.left && bones.leftUpperArm && bones.leftLowerArm && bones.leftHand) {
    const elbow = _v3A.copy(bones.leftLowerArm.getWorldPosition(_v3B));
    elbow.z += 0.15; // slight forward bias
    elbow.x -= 0.1;  // outward bias
    solveTwoBoneIK(bones.leftUpperArm, bones.leftLowerArm, bones.leftHand, targets.left, elbow);
  }

  if (targets.right && bones.rightUpperArm && bones.rightLowerArm && bones.rightHand) {
    const elbow = _v3A.copy(bones.rightLowerArm.getWorldPosition(_v3B));
    elbow.z += 0.15;
    elbow.x += 0.1;
    solveTwoBoneIK(bones.rightUpperArm, bones.rightLowerArm, bones.rightHand, targets.right, elbow);
  }
}

// ---------------------------------------------------------------------------
// Combined IK context — one instance per character
// ---------------------------------------------------------------------------
export class CharacterIK {
  footBones: FootIKBones;
  handBones: HandIKBones;
  raycaster: THREE.Raycaster;
  terrainTargets: THREE.Object3D[];
  handTargets: HandIKTarget;
  enabled: boolean;

  constructor(root: THREE.Object3D) {
    this.footBones = discoverFootBones(root);
    this.handBones = discoverHandBones(root);
    this.raycaster = new THREE.Raycaster();
    this.terrainTargets = [];
    this.handTargets = { left: null, right: null };
    this.enabled = true;
  }

  setTerrainTargets(targets: THREE.Object3D[]) {
    this.terrainTargets = targets;
  }

  solve(charWorldY: number): FootIKResult {
    if (!this.enabled || !_ikEnabled) {
      return { leftOffset: 0, rightOffset: 0, pelvisOffset: 0 };
    }

    // Foot IK
    const footResult = solveFootIK(
      this.footBones,
      this.raycaster,
      this.terrainTargets,
      charWorldY,
    );

    // Hand IK (only when targets are set — climbing / interact)
    if (this.handTargets.left || this.handTargets.right) {
      solveHandIK(this.handBones, this.handTargets);
    }

    return footResult;
  }

  clearHandTargets() {
    this.handTargets.left = null;
    this.handTargets.right = null;
  }
}
