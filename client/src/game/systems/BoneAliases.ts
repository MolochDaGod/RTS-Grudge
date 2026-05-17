import * as THREE from "three";
import { retargetClip as skuRetargetClip } from "three/examples/jsm/utils/SkeletonUtils.js";

export const RIGHT_HAND_ALIASES = [
  // ── Grudge6 Bip001 weapon container (preferred — most specific) ──
  "R_hand_container",
  // ── Standard aliases ──
  "Fist.R", "FistR", "RightHand", "mixamorigRightHand", "mixamorig:RightHand",
  "Hand_R", "hand_r", "hand.R", "Right_Hand", "rightHand",
  // 3ds Max Biped — space-separated (FBX export) AND underscore (GLTF export)
  "Bip001 R Hand", "Bip01 R Hand",
  "Bip01_R_Hand", "Bip001_R_Hand", "r_hand", "R_Hand", "RightHandIndex1",
  "J_Bip_R_Hand", "CC_Base_R_Hand", "right_hand", "HandR",
  "Wrist_R", "WristR", "Wrist.R", "wrist.R", "DEF-hand.R", "ORG-hand.R",
  "ValveBiped.Bip01_R_Hand", "RIG-hand.R", "MCH-hand_ik.R",
  // Lowercase concatenated variants emitted by some FBX→GLB exporters
  "handr", "righthand", "wristr",
];

export const LEFT_HAND_ALIASES = [
  // ── Grudge6 Bip001 left-hand container (off-hand items / staffs / bows) ──
  "L_hand_container",
  // ── Standard aliases ──
  "Fist.L", "FistL", "LeftHand", "mixamorigLeftHand", "mixamorig:LeftHand",
  "Hand_L", "hand_l", "hand.L", "Left_Hand", "leftHand",
  // 3ds Max Biped — space-separated (FBX) AND underscore (GLTF)
  "Bip001 L Hand", "Bip01 L Hand",
  "Bip01_L_Hand", "Bip001_L_Hand", "l_hand", "L_Hand", "LeftHandIndex1",
  "J_Bip_L_Hand", "CC_Base_L_Hand", "left_hand", "HandL",
  "Wrist_L", "WristL", "Wrist.L", "wrist.L", "DEF-hand.L", "ORG-hand.L",
  "ValveBiped.Bip01_L_Hand", "RIG-hand.L", "MCH-hand_ik.L",
  // Lowercase concatenated variants
  "handl", "lefthand", "wristl",
];

/** Grudge6 Bip001 shield bone — weapon attachment for off-hand shields. */
export const SHIELD_BONE_ALIASES = [
  "L_shield_container",
  // Fallback to left hand when no dedicated shield bone exists
  ...LEFT_HAND_ALIASES,
];

export const UPPER_ARM_R_ALIASES = [
  "upperarm_r", "upper_arm.r", "upperarm.r", "arm_r", "arm.r",
  "mixamorigRightArm", "mixamorig:RightArm", "RightArm", "Arm_R", "Right_Arm",
  // 3ds Max Biped space-separated
  "Bip001 R UpperArm", "Bip01 R UpperArm",
  "Bip01_R_UpperArm", "Bip001_R_UpperArm", "J_Bip_R_UpperArm", "CC_Base_R_Upperarm",
  "UpperArmR", "UpperArm.R", "DEF-upper_arm.R", "ORG-upper_arm.R", "upper_arm_r",
  "upperarmr", "rightarm", "armr",
];

export const UPPER_ARM_L_ALIASES = [
  "upperarm_l", "upper_arm.l", "upperarm.l", "arm_l", "arm.l",
  "mixamorigLeftArm", "mixamorig:LeftArm", "LeftArm", "Arm_L", "Left_Arm",
  // 3ds Max Biped space-separated
  "Bip001 L UpperArm", "Bip01 L UpperArm",
  "Bip01_L_UpperArm", "Bip001_L_UpperArm", "J_Bip_L_UpperArm", "CC_Base_L_Upperarm",
  "UpperArmL", "UpperArm.L", "DEF-upper_arm.L", "ORG-upper_arm.L", "upper_arm_l",
  "upperarml", "leftarm", "arml",
];

export const FOREARM_R_ALIASES = [
  "forearm_r", "lowerarm_r", "forearm.r", "lowerarm.r",
  "mixamorigRightForeArm", "mixamorig:RightForeArm", "RightForeArm", "ForeArm_R",
  // 3ds Max Biped space-separated
  "Bip001 R Forearm", "Bip01 R Forearm",
  "Bip01_R_Forearm", "Bip001_R_Forearm", "J_Bip_R_LowerArm", "CC_Base_R_Forearm",
  "LowerArmR", "LowerArm.R", "Forearm.R", "DEF-forearm.R", "ORG-forearm.R",
  "forearmr", "lowerarmr", "rightforearm",
];

export const FOREARM_L_ALIASES = [
  "forearm_l", "lowerarm_l", "forearm.l", "lowerarm.l",
  "mixamorigLeftForeArm", "mixamorig:LeftForeArm", "LeftForeArm", "ForeArm_L",
  // 3ds Max Biped space-separated
  "Bip001 L Forearm", "Bip01 L Forearm",
  "Bip01_L_Forearm", "Bip001_L_Forearm", "J_Bip_L_LowerArm", "CC_Base_L_Forearm",
  "LowerArmL", "LowerArm.L", "Forearm.L", "DEF-forearm.L", "ORG-forearm.L",
  "forearml", "lowerarml", "leftforearm",
];

export const SHOULDER_R_ALIASES = [
  "shoulder_r", "shoulder.r", "clavicle_r", "clavicle.r",
  "mixamorigRightShoulder", "mixamorig:RightShoulder", "RightShoulder", "Clavicle_R",
  // 3ds Max Biped space-separated
  "Bip001 R Clavicle", "Bip01 R Clavicle",
  "Bip01_R_Clavicle", "Bip001_R_Clavicle", "J_Bip_R_Shoulder", "CC_Base_R_Clavicle",
  "shoulderr", "rightshoulder", "clavicler",
];

export const SHOULDER_L_ALIASES = [
  "shoulder_l", "shoulder.l", "clavicle_l", "clavicle.l",
  "mixamorigLeftShoulder", "mixamorig:LeftShoulder", "LeftShoulder", "Clavicle_L",
  // 3ds Max Biped space-separated
  "Bip001 L Clavicle", "Bip01 L Clavicle",
  "Bip01_L_Clavicle", "Bip001_L_Clavicle", "J_Bip_L_Shoulder", "CC_Base_L_Clavicle",
  "shoulderl", "leftshoulder", "claviclel",
];

export const HEAD_ALIASES = [
  "Head", "mixamorigHead", "mixamorig:Head", "head",
  // 3ds Max Biped space-separated variants
  "Bip001 Head", "Bip01 Head",
  "Bip01_Head", "Bip001_Head", "J_Bip_C_Head", "CC_Base_Head",
];

// Order matters: Mixamo `Hips` is the all-in-one motion driver (position+rotation
// in world frame). On CC4 rigs, the equivalent is `root_01` (the motion-root
// node parent of the deformation pelvis), NOT `CC_Base_Hip_02` — the pelvis bone
// has a different rest orientation, so applying Mixamo's hip quaternion directly
// to it tips the character on its side. Keep `Root`/`root` BEFORE the CC4/Bip01
// pelvis aliases so naive retarget routes Hips tracks to the correct bone.
export const HIPS_ALIASES = [
  "Hips", "mixamorigHips", "mixamorig:Hips",
  "Root", "root",
  "pelvis", "hip",
  // 3ds Max Biped — space-separated AND underscore
  "Bip001 Pelvis", "Bip01 Pelvis",
  "CC_Base_Hip", "Bip01_Pelvis", "Bip001_Pelvis", "J_Bip_C_Hips",
];

export const SPINE_ALIASES = [
  "Spine", "mixamorigSpine", "mixamorig:Spine", "spine",
  // 3ds Max Biped space-separated
  "Bip001 Spine", "Bip01 Spine",
  "Bip01_Spine", "Bip001_Spine", "J_Bip_C_Spine", "CC_Base_Waist",
];

export const SPINE2_ALIASES = [
  "Spine2", "mixamorigSpine2", "mixamorig:Spine2", "spine2", "upperchest",
  "Spine1", "mixamorigSpine1", "mixamorig:Spine1", "chest",
  // 3ds Max Biped space-separated
  "Bip001 Spine2", "Bip001 Spine1", "Bip01 Spine2", "Bip01 Spine1",
  "Bip01_Spine2", "Bip001_Spine2", "CC_Base_Spine02",
];

export const CHEST_ALIASES = [
  "Spine1", "mixamorigSpine1", "mixamorig:Spine1", "chest",
  "Spine2", "mixamorigSpine2", "mixamorig:Spine2",
  "Bip01_Spine1", "Bip001_Spine1", "CC_Base_Spine01",
];

export const RIGHT_FOOT_ALIASES = [
  "RightFoot", "mixamorigRightFoot", "mixamorig:RightFoot", "foot.R",
  // 3ds Max Biped space-separated
  "Bip001 R Foot", "Bip01 R Foot",
  "Bip01_R_Foot", "Bip001_R_Foot", "J_Bip_R_Foot", "CC_Base_R_Foot", "Foot.R",
  "FootR", "Foot_R", "foot_r",
  "footr", "rightfoot",
];

export const LEFT_FOOT_ALIASES = [
  "LeftFoot", "mixamorigLeftFoot", "mixamorig:LeftFoot", "foot.L",
  // 3ds Max Biped space-separated
  "Bip001 L Foot", "Bip01 L Foot",
  "Bip01_L_Foot", "Bip001_L_Foot", "J_Bip_L_Foot", "CC_Base_L_Foot", "Foot.L",
  "FootL", "Foot_L", "foot_l",
  "footl", "leftfoot",
];

// Standalone exports for the rest of the lower-body chain so any code
// path that does direct alias lookups (not just RETARGET_ALIAS_MAP)
// can resolve lowercase concatenated variants on their own. Mirrors
// the LEFT_/RIGHT_ pattern used for hands/arms/feet.
export const RIGHT_UP_LEG_ALIASES = [
  "RightUpLeg", "mixamorigRightUpLeg", "mixamorig:RightUpLeg",
  "UpperLeg.R", "UpperLegR",
  // 3ds Max Biped space-separated
  "Bip001 R Thigh", "Bip01 R Thigh",
  "Bip01_R_Thigh", "Bip001_R_Thigh",
  "J_Bip_R_UpperLeg", "CC_Base_R_Thigh", "thigh.R", "upper_leg.R", "upperleg_r",
  "upperlegr", "rightupleg", "rightthigh", "thighr",
];

export const LEFT_UP_LEG_ALIASES = [
  "LeftUpLeg", "mixamorigLeftUpLeg", "mixamorig:LeftUpLeg",
  "UpperLeg.L", "UpperLegL",
  // 3ds Max Biped space-separated
  "Bip001 L Thigh", "Bip01 L Thigh",
  "Bip01_L_Thigh", "Bip001_L_Thigh",
  "J_Bip_L_UpperLeg", "CC_Base_L_Thigh", "thigh.L", "upper_leg.L", "upperleg_l",
  "upperlegl", "leftupleg", "leftthigh", "thighl",
];

export const RIGHT_LOWER_LEG_ALIASES = [
  "RightLeg", "mixamorigRightLeg", "mixamorig:RightLeg",
  "LowerLeg.R", "LowerLegR",
  // 3ds Max Biped space-separated
  "Bip001 R Calf", "Bip01 R Calf",
  "Bip01_R_Calf", "Bip001_R_Calf",
  "J_Bip_R_LowerLeg", "CC_Base_R_Calf", "shin.R", "lower_leg.R", "lowerleg_r",
  "lowerlegr", "rightleg", "rightshin", "shinr", "rightcalf", "calfr",
];

export const LEFT_LOWER_LEG_ALIASES = [
  "LeftLeg", "mixamorigLeftLeg", "mixamorig:LeftLeg",
  "LowerLeg.L", "LowerLegL",
  // 3ds Max Biped space-separated
  "Bip001 L Calf", "Bip01 L Calf",
  "Bip01_L_Calf", "Bip001_L_Calf",
  "J_Bip_L_LowerLeg", "CC_Base_L_Calf", "shin.L", "lower_leg.L", "lowerleg_l",
  "lowerlegl", "leftleg", "leftshin", "shinl", "leftcalf", "calfl",
];

export const RIGHT_TOE_ALIASES = [
  "RightToeBase", "mixamorigRightToeBase", "mixamorig:RightToeBase",
  "Toe.R", "ToesR",
  // 3ds Max Biped space-separated
  "Bip001 R Toe0", "Bip01 R Toe0",
  "Bip01_R_Toe0", "Bip001_R_Toe0",
  "J_Bip_R_ToeBase", "CC_Base_R_ToeBase", "toe.R", "toes.R", "toes_r",
  "toesr", "righttoebase", "righttoe", "toer",
];

export const LEFT_TOE_ALIASES = [
  "LeftToeBase", "mixamorigLeftToeBase", "mixamorig:LeftToeBase",
  "Toe.L", "ToesL",
  // 3ds Max Biped space-separated
  "Bip001 L Toe0", "Bip01 L Toe0",
  "Bip01_L_Toe0", "Bip001_L_Toe0",
  "J_Bip_L_ToeBase", "CC_Base_L_ToeBase", "toe.L", "toes.L", "toes_l",
  "toesl", "lefttoebase", "lefttoe", "toel",
];

/**
 * Finger bone aliases, keyed by Finger key (e.g. `LeftHandIndex1`). Covers
 * the Mixamo (`mixamorig:`/sanitised), Reallusion CC_Base (Index/Mid/Ring/
 * Pinky/Thumb 1-3), 3ds Max Biped (`Bip01_L_Finger0/01/02` etc.), VRoid /
 * VRM (`J_Bip_L_Index1`), and Blender Rigify (`f_index.01.L`) conventions.
 *
 * The Bip01 numbering convention is: Finger0=Thumb, Finger1=Index,
 * Finger2=Middle, Finger3=Ring, Finger4=Pinky. The proximal segment is
 * `Bip01_L_FingerN`, with `Bip01_L_FingerN1` and `Bip01_L_FingerN2` for
 * the next two phalanges.
 *
 * Note: a handful of CC_Base race meshes (e.g. werewolf) are exported using
 * the Reallusion shorthand `Mid` instead of `Middle` — both spellings are
 * therefore included in the Middle alias arrays.
 */
function fingerAliases(
  side: "Left" | "Right",
  finger: "Index" | "Middle" | "Ring" | "Pinky" | "Thumb",
  segment: 1 | 2 | 3,
): string[] {
  const L = side === "Left" ? "L" : "R";
  const lower = side.toLowerCase();
  const fingerLower = finger.toLowerCase();
  const bipNum = finger === "Thumb" ? 0
    : finger === "Index" ? 1
    : finger === "Middle" ? 2
    : finger === "Ring" ? 3
    : 4;
  const bipSegSuffix = segment === 1 ? "" : segment === 2 ? "1" : "2";
  const rigifySeg = segment === 1 ? "01" : segment === 2 ? "02" : "03";
  const aliases: string[] = [
    `mixamorig:${side}Hand${finger}${segment}`,
    `mixamorig${side}Hand${finger}${segment}`,
    `${side}Hand${finger}${segment}`,
    `CC_Base_${L}_${finger}${segment}`,
    `Bip01_${L}_Finger${bipNum}${bipSegSuffix}`,
    `Bip001_${L}_Finger${bipNum}${bipSegSuffix}`,
    `J_Bip_${L}_${finger}${segment}`,
    `${fingerLower}.${rigifySeg}.${L}`,
    `f_${fingerLower}.${rigifySeg}.${L}`,
    `DEF-f_${fingerLower}.${rigifySeg}.${L}`,
    `${fingerLower}_0${segment}_${lower[0]}`,
    `${lower[0]}_${fingerLower}_0${segment}`,
  ];
  if (finger === "Middle") {
    aliases.push(
      `mixamorig:${side}HandMid${segment}`,
      `mixamorig${side}HandMid${segment}`,
      `${side}HandMid${segment}`,
      `CC_Base_${L}_Mid${segment}`,
      `J_Bip_${L}_Mid${segment}`,
    );
  }
  return aliases;
}

export const LEFT_INDEX_1_ALIASES   = fingerAliases("Left",  "Index",  1);
export const LEFT_INDEX_2_ALIASES   = fingerAliases("Left",  "Index",  2);
export const LEFT_INDEX_3_ALIASES   = fingerAliases("Left",  "Index",  3);
export const LEFT_MIDDLE_1_ALIASES  = fingerAliases("Left",  "Middle", 1);
export const LEFT_MIDDLE_2_ALIASES  = fingerAliases("Left",  "Middle", 2);
export const LEFT_MIDDLE_3_ALIASES  = fingerAliases("Left",  "Middle", 3);
export const LEFT_RING_1_ALIASES    = fingerAliases("Left",  "Ring",   1);
export const LEFT_RING_2_ALIASES    = fingerAliases("Left",  "Ring",   2);
export const LEFT_RING_3_ALIASES    = fingerAliases("Left",  "Ring",   3);
export const LEFT_PINKY_1_ALIASES   = fingerAliases("Left",  "Pinky",  1);
export const LEFT_PINKY_2_ALIASES   = fingerAliases("Left",  "Pinky",  2);
export const LEFT_PINKY_3_ALIASES   = fingerAliases("Left",  "Pinky",  3);
export const LEFT_THUMB_1_ALIASES   = fingerAliases("Left",  "Thumb",  1);
export const LEFT_THUMB_2_ALIASES   = fingerAliases("Left",  "Thumb",  2);
export const LEFT_THUMB_3_ALIASES   = fingerAliases("Left",  "Thumb",  3);
export const RIGHT_INDEX_1_ALIASES  = fingerAliases("Right", "Index",  1);
export const RIGHT_INDEX_2_ALIASES  = fingerAliases("Right", "Index",  2);
export const RIGHT_INDEX_3_ALIASES  = fingerAliases("Right", "Index",  3);
export const RIGHT_MIDDLE_1_ALIASES = fingerAliases("Right", "Middle", 1);
export const RIGHT_MIDDLE_2_ALIASES = fingerAliases("Right", "Middle", 2);
export const RIGHT_MIDDLE_3_ALIASES = fingerAliases("Right", "Middle", 3);
export const RIGHT_RING_1_ALIASES   = fingerAliases("Right", "Ring",   1);
export const RIGHT_RING_2_ALIASES   = fingerAliases("Right", "Ring",   2);
export const RIGHT_RING_3_ALIASES   = fingerAliases("Right", "Ring",   3);
export const RIGHT_PINKY_1_ALIASES  = fingerAliases("Right", "Pinky",  1);
export const RIGHT_PINKY_2_ALIASES  = fingerAliases("Right", "Pinky",  2);
export const RIGHT_PINKY_3_ALIASES  = fingerAliases("Right", "Pinky",  3);
export const RIGHT_THUMB_1_ALIASES  = fingerAliases("Right", "Thumb",  1);
export const RIGHT_THUMB_2_ALIASES  = fingerAliases("Right", "Thumb",  2);
export const RIGHT_THUMB_3_ALIASES  = fingerAliases("Right", "Thumb",  3);

export type SkeletonType = "kaykit" | "mixamo" | "cc4" | "bip001" | "generic";

export function detectSkeletonType(boneNames: string[]): SkeletonType {
  if (boneNames.some(b => b === "Fist.R" || b === "FistR" || b === "Fist.L" || b === "FistL")) {
    return "kaykit";
  }
  const joined = boneNames.join("|").toLowerCase();
  if (joined.includes("mixamorig:") || joined.includes("mixamorig")) {
    return "mixamo";
  }
  if (joined.includes("cc_base_")) {
    return "cc4";
  }
  // Grudge6 uMMORPG 3ds-Max Biped rig — detected via the Pelvis root node or
  // the R_hand_container weapon attachment bone that all 6 race models share.
  if (joined.includes("bip001") || joined.includes("bip01 ") || joined.includes("r_hand_container")) {
    return "bip001";
  }
  return "generic";
}

function stripColons(s: string): string {
  return s.replace(/:/g, "");
}

export function stripBoneSuffix(s: string): string {
  return s.replace(/_\d+$/, "");
}

/**
 * Canonical bone-name sanitiser used by both runtime (AssetPipeline) and
 * build scripts (convert-fbx-to-glb, convert-models-to-glb).
 *
 * Strips Maya-style namespace colons (e.g. "mixamorig:Hips" → "mixamorigHips")
 * which are illegal in GLTF node names.
 *
 * Mirror this exact behavior in `scripts/lib/boneSanitize.cjs`.
 */
export function sanitizeBoneName(name: string): string {
  return name ? name.replace(/:/g, "") : name;
}

function normalize(s: string): string {
  return stripBoneSuffix(stripColons(s));
}

export function findBoneByAlias(
  root: THREE.Object3D,
  aliases: string[]
): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;

  for (const alias of aliases) {
    root.traverse((child) => {
      if (!found && (child.name === alias || stripColons(child.name) === alias || normalize(child.name) === alias)) found = child;
    });
    if (found) return found;
  }

  for (const alias of aliases) {
    const lower = alias.toLowerCase();
    root.traverse((child) => {
      if (!found) {
        const n = child.name.toLowerCase();
        if (n === lower || stripColons(n) === lower || normalize(n) === lower) found = child;
      }
    });
    if (found) return found;
  }

  for (const alias of aliases) {
    const lower = alias.toLowerCase();
    root.traverse((child) => {
      if (!found) {
        const n = child.name.toLowerCase();
        if (n.includes(lower) || stripColons(n).includes(lower) || normalize(n).includes(lower)) found = child;
      }
    });
    if (found) return found;
  }

  return null;
}

export function findBoneByAliasFromList(
  bones: THREE.Bone[],
  aliases: string[]
): THREE.Bone | null {
  for (const alias of aliases) {
    const found = bones.find(b => b.name === alias || stripColons(b.name) === alias || normalize(b.name) === alias);
    if (found) return found;
  }
  for (const alias of aliases) {
    const lower = alias.toLowerCase();
    const found = bones.find(b => b.name.toLowerCase() === lower || stripColons(b.name).toLowerCase() === lower || normalize(b.name).toLowerCase() === lower);
    if (found) return found;
  }
  return null;
}

export const RETARGET_ALIAS_MAP: Record<string, string[]> = {
  Hips: [...HIPS_ALIASES, "CC_Base_Pelvis"],
  Spine: [...SPINE_ALIASES],
  Spine1: ["mixamorigSpine1", "Spine1", "spine1", "Spine.001", "CC_Base_Spine01"],
  Spine2: ["mixamorigSpine2", "Spine2", "spine2", "Chest", "chest", "CC_Base_Spine02"],
  Neck: ["mixamorigNeck", "Neck", "neck", "Bip01_Neck", "Bip001_Neck", "J_Bip_C_Neck", "CC_Base_NeckTwist01", "CC_Base_NeckTwist02"],
  Head: [...HEAD_ALIASES],
  LeftShoulder: [...SHOULDER_L_ALIASES],
  LeftArm: [...UPPER_ARM_L_ALIASES],
  LeftForeArm: [...FOREARM_L_ALIASES],
  LeftHand: [...LEFT_HAND_ALIASES],
  RightShoulder: [...SHOULDER_R_ALIASES],
  RightArm: [...UPPER_ARM_R_ALIASES],
  RightForeArm: [...FOREARM_R_ALIASES],
  RightHand: [...RIGHT_HAND_ALIASES],
  LeftUpLeg: [...LEFT_UP_LEG_ALIASES],
  LeftLeg: [...LEFT_LOWER_LEG_ALIASES],
  LeftFoot: [...LEFT_FOOT_ALIASES],
  LeftToeBase: [...LEFT_TOE_ALIASES],
  RightUpLeg: [...RIGHT_UP_LEG_ALIASES],
  RightLeg: [...RIGHT_LOWER_LEG_ALIASES],
  RightFoot: [...RIGHT_FOOT_ALIASES],
  RightToeBase: [...RIGHT_TOE_ALIASES],
  LeftHandIndex1:   [...LEFT_INDEX_1_ALIASES],
  LeftHandIndex2:   [...LEFT_INDEX_2_ALIASES],
  LeftHandIndex3:   [...LEFT_INDEX_3_ALIASES],
  LeftHandMiddle1:  [...LEFT_MIDDLE_1_ALIASES],
  LeftHandMiddle2:  [...LEFT_MIDDLE_2_ALIASES],
  LeftHandMiddle3:  [...LEFT_MIDDLE_3_ALIASES],
  LeftHandRing1:    [...LEFT_RING_1_ALIASES],
  LeftHandRing2:    [...LEFT_RING_2_ALIASES],
  LeftHandRing3:    [...LEFT_RING_3_ALIASES],
  LeftHandPinky1:   [...LEFT_PINKY_1_ALIASES],
  LeftHandPinky2:   [...LEFT_PINKY_2_ALIASES],
  LeftHandPinky3:   [...LEFT_PINKY_3_ALIASES],
  LeftHandThumb1:   [...LEFT_THUMB_1_ALIASES],
  LeftHandThumb2:   [...LEFT_THUMB_2_ALIASES],
  LeftHandThumb3:   [...LEFT_THUMB_3_ALIASES],
  RightHandIndex1:  [...RIGHT_INDEX_1_ALIASES],
  RightHandIndex2:  [...RIGHT_INDEX_2_ALIASES],
  RightHandIndex3:  [...RIGHT_INDEX_3_ALIASES],
  RightHandMiddle1: [...RIGHT_MIDDLE_1_ALIASES],
  RightHandMiddle2: [...RIGHT_MIDDLE_2_ALIASES],
  RightHandMiddle3: [...RIGHT_MIDDLE_3_ALIASES],
  RightHandRing1:   [...RIGHT_RING_1_ALIASES],
  RightHandRing2:   [...RIGHT_RING_2_ALIASES],
  RightHandRing3:   [...RIGHT_RING_3_ALIASES],
  RightHandPinky1:  [...RIGHT_PINKY_1_ALIASES],
  RightHandPinky2:  [...RIGHT_PINKY_2_ALIASES],
  RightHandPinky3:  [...RIGHT_PINKY_3_ALIASES],
  RightHandThumb1:  [...RIGHT_THUMB_1_ALIASES],
  RightHandThumb2:  [...RIGHT_THUMB_2_ALIASES],
  RightHandThumb3:  [...RIGHT_THUMB_3_ALIASES],
};

function buildTargetBoneIndex(targetScene: THREE.Object3D): {
  exact: Set<string>;
  byStripped: Map<string, string>;
  byLower: Map<string, string>;
  byNormalized: Map<string, string>;
} {
  const exact = new Set<string>();
  const byStripped = new Map<string, string>();
  const byLower = new Map<string, string>();
  const byNormalized = new Map<string, string>();
  targetScene.traverse((n) => {
    if (!n.name) return;
    exact.add(n.name);
    const stripped = stripBoneSuffix(n.name);
    if (stripped !== n.name && !byStripped.has(stripped)) byStripped.set(stripped, n.name);
    byLower.set(n.name.toLowerCase(), n.name);
    const norm = normalize(n.name).toLowerCase();
    if (!byNormalized.has(norm)) byNormalized.set(norm, n.name);
  });
  return { exact, byStripped, byLower, byNormalized };
}

function resolveTargetBone(
  alias: string,
  index: ReturnType<typeof buildTargetBoneIndex>
): string | null {
  if (index.exact.has(alias)) return alias;
  const stripped = stripBoneSuffix(alias);
  if (index.exact.has(stripped)) return stripped;
  if (index.byStripped.has(alias)) return index.byStripped.get(alias)!;
  if (index.byStripped.has(stripped)) return index.byStripped.get(stripped)!;
  const lower = alias.toLowerCase();
  if (index.byLower.has(lower)) return index.byLower.get(lower)!;
  const norm = normalize(alias).toLowerCase();
  if (index.byNormalized.has(norm)) return index.byNormalized.get(norm)!;
  return null;
}

export function buildRetargetMap(targetScene: THREE.Object3D): Map<string, string> | null {
  const index = buildTargetBoneIndex(targetScene);

  const remap = new Map<string, string>();
  for (const [, aliases] of Object.entries(RETARGET_ALIAS_MAP)) {
    let targetName: string | null = null;
    for (const a of aliases) {
      const resolved = resolveTargetBone(a, index);
      if (resolved) { targetName = resolved; break; }
    }
    if (targetName) {
      for (const alias of aliases) {
        if (alias !== targetName) remap.set(alias, targetName);
      }
    }
  }

  return remap.size > 0 ? remap : null;
}

// Capture each bone's local-space rest quaternion AND position by name.
// Stores under multiple aliases (raw name, colon-stripped) so a track named
// "mixamorig:RightShoulder" or "RightShoulder" can both look up the same rest.
// MUST be called before any AnimationMixer plays on the scene, so that
// .quaternion / .position still hold the GLTF rest pose values.
export interface RestPoseEntry {
  quaternion: THREE.Quaternion;
  position: THREE.Vector3;
}

export function captureRestPose(scene: THREE.Object3D): Map<string, RestPoseEntry> {
  const map = new Map<string, RestPoseEntry>();
  scene.traverse((n) => {
    if (!(n as THREE.Bone).isBone && n.type !== "Bone") return;
    const entry: RestPoseEntry = {
      quaternion: n.quaternion.clone(),
      position: n.position.clone(),
    };
    if (!map.has(n.name)) map.set(n.name, entry);
    const stripped = n.name.replace(/:/g, "");
    if (stripped !== n.name && !map.has(stripped)) map.set(stripped, entry);
  });
  return map;
}

const _qSourceRest = new THREE.Quaternion();
const _qSourceRestInv = new THREE.Quaternion();
const _qSourceKey = new THREE.Quaternion();
const _qTargetRest = new THREE.Quaternion();
const _qDelta = new THREE.Quaternion();
const _qOut = new THREE.Quaternion();

// Rewrites .quaternion track values from absolute source-space rotations into
// delta-from-rest rotations re-applied to the target rest pose. Math:
//   q_target_key = q_targetRest * (q_sourceRest^-1 * q_sourceKey)
// This is the standard "local delta" retarget — corrects the contorted-pose
// problem that arises when source rig (e.g. Mixamo idle.glb) and target rig
// (e.g. CC4 character) have different rest orientations on shared bone names.
function rewriteQuaternionTrack(
  track: THREE.QuaternionKeyframeTrack,
  sourceBoneName: string,
  targetBoneName: string,
  sourceRest: Map<string, RestPoseEntry>,
  targetRest: Map<string, RestPoseEntry>,
): void {
  const sRest = sourceRest.get(sourceBoneName) ?? sourceRest.get(sourceBoneName.replace(/:/g, ""));
  const tRest = targetRest.get(targetBoneName) ?? targetRest.get(targetBoneName.replace(/:/g, ""));
  if (!sRest || !tRest) return;

  _qSourceRest.copy(sRest.quaternion);
  _qSourceRestInv.copy(_qSourceRest).invert();
  _qTargetRest.copy(tRest.quaternion);

  const values = track.values as Float32Array;
  const stride = 4;
  for (let i = 0; i < values.length; i += stride) {
    _qSourceKey.set(values[i], values[i + 1], values[i + 2], values[i + 3]);
    _qDelta.copy(_qSourceRestInv).multiply(_qSourceKey);
    _qOut.copy(_qTargetRest).multiply(_qDelta);
    values[i] = _qOut.x;
    values[i + 1] = _qOut.y;
    values[i + 2] = _qOut.z;
    values[i + 3] = _qOut.w;
  }
}

// Bones whose tracks are DROPPED entirely when cross-rig retargeting (i.e.
// when a sourceRest is provided). These are the root-chain bones whose rest
// orientations encode up-axis conventions (Y-up vs Z-up, etc.) — applying
// source rotations or positions to them tips the character on its side or
// makes it float. By dropping them, the target's natural rest pose is
// preserved and the character stays planted upright while spine/limbs animate.
// Built once from HIPS_ALIASES (lower-cased + colon-stripped) so any bone
// matching "hips", "pelvis", "root", "armature", etc. is excluded.
const RETARGET_ROOT_SKIP_SET: Set<string> = (() => {
  const s = new Set<string>();
  for (const a of HIPS_ALIASES) {
    s.add(a.toLowerCase());
    s.add(a.replace(/:/g, "").toLowerCase());
  }
  s.add("armature");
  s.add("root");
  return s;
})();

function isRootChainBone(name: string): boolean {
  // Normalize: lowercase + drop colon/dot separators so "mixamorig:Hips",
  // "Armature.001", and "Bip01_Pelvis" all collapse to a stable form.
  const lower = name.toLowerCase();
  const stripped = name.replace(/[:.]/g, "").toLowerCase();
  if (RETARGET_ROOT_SKIP_SET.has(lower)) return true;
  if (RETARGET_ROOT_SKIP_SET.has(stripped)) return true;

  // Substring matches for stems that are unique enough to root-chain bones
  // that no body-part bone uses them ("pelvis", "hips" — note plural so
  // we don't false-positive on a hypothetical hip-joint leg bone).
  if (stripped.includes("pelvis")) return true;
  if (stripped.includes("hips")) return true;

  // Prefix matches for ambiguous stems. "root"/"armature" must START the
  // bone name to avoid catching things like "ik_foot_root" or "weapon_root".
  // Allows: Root, root, root_01, RootNode, Armature, Armature001, etc.
  if (/^root($|[\d_\-]|node)/.test(stripped)) return true;
  if (/^armature($|[\d_\-])/.test(stripped)) return true;

  return false;
}

function findFirstSkinnedMesh(o: THREE.Object3D): THREE.SkinnedMesh | null {
  let result: THREE.SkinnedMesh | null = null;
  o.traverse((n) => {
    if (result) return;
    if ((n as THREE.SkinnedMesh).isSkinnedMesh && (n as THREE.SkinnedMesh).skeleton?.bones?.length) {
      result = n as THREE.SkinnedMesh;
    }
  });
  return result;
}

// Build the { [targetBoneName]: sourceBoneName } map SkeletonUtils.retargetClip
// expects. We walk the TARGET skeleton (so every entry refers to a bone the
// retargeter will actually iterate) and look for a matching source bone via
// our existing alias system. Bones with no source counterpart are simply
// omitted — SkeletonUtils will leave their rotations at the rest pose.
function buildSkuTargetToSourceNames(
  targetBones: THREE.Bone[],
  sourceBones: THREE.Bone[],
  targetIndex: ReturnType<typeof buildTargetBoneIndex>,
  remap: Map<string, string> | null,
): Record<string, string> {
  const sourceByName = new Map<string, string>();
  const sourceByStripped = new Map<string, string>();
  const sourceByLower = new Map<string, string>();
  const sourceByNorm = new Map<string, string>();
  for (const b of sourceBones) {
    sourceByName.set(b.name, b.name);
    const s = stripBoneSuffix(b.name);
    if (!sourceByStripped.has(s)) sourceByStripped.set(s, b.name);
    sourceByLower.set(b.name.toLowerCase(), b.name);
    const n = normalize(b.name).toLowerCase();
    if (!sourceByNorm.has(n)) sourceByNorm.set(n, b.name);
  }
  // Reverse the alias-resolved remap (which maps alias → targetBoneName) so
  // we can look up "for this target bone, which aliases resolve to it" and
  // then test those aliases against the source skeleton.
  const targetToAliases = new Map<string, string[]>();
  if (remap) {
    for (const [alias, targetName] of remap) {
      const arr = targetToAliases.get(targetName) ?? [];
      arr.push(alias);
      targetToAliases.set(targetName, arr);
    }
  }

  const result: Record<string, string> = {};
  for (const tb of targetBones) {
    const tName = tb.name;
    // Try direct name / stripped / lower / normalized match against source.
    const stripped = stripBoneSuffix(tName);
    let sName: string | undefined =
      sourceByName.get(tName) ??
      sourceByName.get(stripped) ??
      sourceByStripped.get(tName) ??
      sourceByStripped.get(stripped) ??
      sourceByLower.get(tName.toLowerCase()) ??
      sourceByNorm.get(normalize(tName).toLowerCase());
    if (!sName) {
      // Try every alias that resolves to this target bone via remap.
      const aliases = targetToAliases.get(tName) ?? [];
      for (const a of aliases) {
        const sAlias =
          sourceByName.get(a) ??
          sourceByStripped.get(a) ??
          sourceByLower.get(a.toLowerCase()) ??
          sourceByNorm.get(normalize(a).toLowerCase());
        if (sAlias) { sName = sAlias; break; }
      }
    }
    if (sName) result[tName] = sName;
  }
  // Suppress unused-warning when targetIndex is not consumed (kept in
  // signature for symmetry with buildRetargetMap, may be used by future
  // resolution strategies).
  void targetIndex;
  return result;
}

export function retargetClips(
  clips: THREE.AnimationClip[],
  targetScene: THREE.Object3D,
  // Either a source scene (rest pose will be captured here) OR a pre-computed
  // rest map (preferred for caching — no risk of the cached scene being
  // mutated later). Pass null/undefined to use legacy rename-only retargeting,
  // which is correct when source and target rigs share rest pose (e.g. a
  // character's own embedded clips re-bound to its own cloned skeleton).
  source?: THREE.Object3D | Map<string, RestPoseEntry> | null,
  // Extra options. `dropRootChain` drops all tracks (quat + position)
  // targeting Hips/Pelvis/Root/Armature without requiring a source rest map
  // — useful for external animation packs (Mixamo attacks, walks, etc.)
  // that would otherwise pancake / launch the character because their
  // root rotation/position was authored against a different rig. When a
  // source IS provided, root tracks are always dropped regardless of this
  // flag (delta math can't safely handle root-chain mismatches).
  opts?: { dropRootChain?: boolean },
): THREE.AnimationClip[] {
  const index = buildTargetBoneIndex(targetScene);
  const remap = buildRetargetMap(targetScene);

  let sourceRest: Map<string, RestPoseEntry> | null = null;
  let sourceScene: THREE.Object3D | null = null;
  if (source) {
    if (source instanceof Map) {
      sourceRest = source;
    } else {
      sourceRest = captureRestPose(source);
      sourceScene = source;
    }
  }
  const targetRest = sourceRest ? captureRestPose(targetScene) : null;
  let crossRig = !!(sourceRest && targetRest);

  // Same-rig short-circuit. The cross-rig delta formula
  //   q_target_key = q_targetRest * (q_sourceRest^-1 * q_sourceKey)
  // is only correct when source and target bones share rest-LOCAL frame
  // axes; when they don't (and no basis change is applied), the result
  // tips bones around the wrong axis. The most painful failure mode is
  // a Mixamo source clip retargeted onto a Mixamo-skeleton character
  // (same bones, same rest pose) with cross-rig math forced on — every
  // bone gets q_targetRest * identity_delta and the body face-plants
  // when downstream multiplications accumulate floating-point drift on
  // bones whose rest happens to differ by a few thousandths of a radian
  // between two GLB exports of "the same" Mixamo skeleton.
  //
  // Detect the same-rig case by sampling rest quaternions for bones
  // that exist in both maps under either name or alias-resolved name.
  // If ≥80% of the resolved bones have rest quaternions within a tight
  // angular epsilon (dot > 0.9995 ≈ 1.8°), treat as same-rig and skip
  // the delta math — fall back to plain rename-only retargeting which
  // is what the Controller Lab did before commit 26b5710 added cross-
  // rig retarget unconditionally.
  if (crossRig && sourceRest && targetRest) {
    let sampled = 0, matched = 0;
    for (const [srcName, srcEntry] of sourceRest) {
      const stripped = srcName.replace(/:/g, "");
      let tName: string | null = null;
      if (targetRest.has(srcName)) tName = srcName;
      else if (targetRest.has(stripped)) tName = stripped;
      else if (remap?.get(srcName)) tName = remap.get(srcName)!;
      else if (remap?.get(stripped)) tName = remap.get(stripped)!;
      if (!tName) continue;
      const tEntry = targetRest.get(tName);
      if (!tEntry) continue;
      sampled++;
      // |dot(q1, q2)| > 0.9995 means the two rotations are within ~1.8°
      // of each other. Absolute value because q and -q represent the
      // same rotation.
      const d = Math.abs(
        srcEntry.quaternion.x * tEntry.quaternion.x +
        srcEntry.quaternion.y * tEntry.quaternion.y +
        srcEntry.quaternion.z * tEntry.quaternion.z +
        srcEntry.quaternion.w * tEntry.quaternion.w
      );
      if (d > 0.9995) matched++;
    }
    if (sampled >= 4 && matched / sampled >= 0.8) {
      crossRig = false;
      console.log(
        `[retarget] Same-rig detected (${matched}/${sampled} bones match rest), ` +
        `skipping cross-rig delta math.`
      );
    }
  }

  const dropRoot = crossRig || !!opts?.dropRootChain;

  // Cross-rig path using three.js's official SkeletonUtils.retargetClip.
  // It bakes new tracks by playing the source clip on the source skeleton
  // each frame and recording target-bone local rotations derived from
  // world-space matrices — which correctly handles bone-frame basis
  // changes between rigs (something our hand-rolled per-bone delta math
  // in `rewriteQuaternionTrack` does not). We only take this path when
  // we still have the actual source Object3D (Lab / GGE editor pass it),
  // and both source and target expose a SkinnedMesh.
  if (crossRig && sourceScene) {
    const sourceMesh = findFirstSkinnedMesh(sourceScene);
    const targetMesh = findFirstSkinnedMesh(targetScene);
    if (sourceMesh && targetMesh) {
      const names = buildSkuTargetToSourceNames(
        targetMesh.skeleton.bones,
        sourceMesh.skeleton.bones,
        index,
        remap,
      );
      // Resolve target hip bone name (used by SkeletonUtils to scale hip
      // translation by hipInfluence — we zero it out so the character
      // doesn't drift away from the rigid body).
      const hipBone = findBoneByAliasFromList(targetMesh.skeleton.bones, HIPS_ALIASES);
      const hipName = hipBone?.name ?? "Hips";
      const hipInfluence = new THREE.Vector3(0, 0, 0);

      return clips.map((clip) => {
        let retargeted: THREE.AnimationClip;
        try {
          retargeted = skuRetargetClip(targetMesh, sourceMesh, clip, {
            names,
            hip: hipName,
            hipInfluence,
            preserveBoneMatrix: false,
            // `preserveBonePositions` is honored by the SkeletonUtils JS impl
            // but missing from the bundled .d.ts — pass via the typed cast.
            preserveBonePositions: true,
          } as Parameters<typeof skuRetargetClip>[3]);
        } catch (e) {
          console.warn(`[retarget] SkeletonUtils.retargetClip failed for "${clip.name}":`, e);
          return clip;
        }

        // SkeletonUtils emits track names as `.bones[BoneName].quaternion`.
        // Our mixer is bound to the cloned scene root (a Group), not to
        // the SkinnedMesh, so rewrite to `BoneName.quaternion` which the
        // mixer will resolve via scene-tree node lookup. Also drop the
        // hip's quaternion track when dropRoot is set (external packs).
        const filtered: THREE.KeyframeTrack[] = [];
        for (const t of retargeted.tracks) {
          const m = t.name.match(/^\.bones\[([^\]]+)\](\..+)$/);
          let boneName: string;
          let prop: string;
          let renamed: THREE.KeyframeTrack;
          if (m) {
            boneName = m[1];
            prop = m[2];
            renamed = t.clone();
            renamed.name = boneName + prop;
          } else {
            const dot = t.name.lastIndexOf(".");
            if (dot === -1) { filtered.push(t.clone()); continue; }
            boneName = t.name.substring(0, dot);
            prop = t.name.substring(dot);
            renamed = t.clone();
          }
          if (prop.startsWith(".scale")) continue;
          const isRoot = isRootChainBone(boneName);
          if (isRoot && prop.startsWith(".position")) continue;
          if (dropRoot && isRoot && prop.startsWith(".quaternion")) continue;
          filtered.push(renamed);
        }
        return new THREE.AnimationClip(clip.name, clip.duration, filtered);
      });
    }
  }

  return clips.map((clip) => {
    const newTracks: THREE.KeyframeTrack[] = [];
    for (const track of clip.tracks) {
      const dot = track.name.lastIndexOf(".");
      if (dot === -1) { newTracks.push(track.clone()); continue; }
      const boneName = track.name.substring(0, dot);
      const prop = track.name.substring(dot);
      if (prop.startsWith(".scale")) continue;

      const stripped = boneName.replace(/:/g, "");

      let targetBone: string | null = null;
      if (index.exact.has(boneName)) targetBone = boneName;
      else if (index.exact.has(stripped)) targetBone = stripped;
      else if (remap?.get(boneName)) targetBone = remap.get(boneName)!;
      else if (remap?.get(stripped)) targetBone = remap.get(stripped)!;
      else targetBone = resolveTargetBone(boneName, index) ?? resolveTargetBone(stripped, index);

      if (!targetBone) continue;

      // ALWAYS strip Hips/root POSITION tracks. Movement is driven by the
      // physics body — letting an animation translate the root in local
      // space desyncs the visual mesh from the rigid body, so the
      // character "walks on air" away from where the controller actually
      // is. This applies to every clip source (character's own embedded
      // clips, external packs, cross-rig retargets) because none of them
      // should ever be the source of horizontal motion in this game.
      const isRootBone = isRootChainBone(boneName) || isRootChainBone(targetBone);
      if (isRootBone && prop.startsWith(".position")) {
        continue;
      }

      // Drop root QUATERNION tracks too when in cross-rig mode or when
      // the caller explicitly opts in via `dropRootChain` (external packs).
      // Within-rig retargeting keeps the root quaternion so a character's
      // own clips can still rotate the rig (e.g. lean, crouch, dodge).
      if (dropRoot && isRootBone) {
        continue;
      }

      const cloned = track.clone();
      cloned.name = targetBone + prop;

      // Apply delta-from-rest math to quaternion tracks when both rest poses
      // are available. Position tracks (rare outside the root chain we just
      // dropped) are passed through unchanged.
      if (crossRig && prop.startsWith(".quaternion")) {
        rewriteQuaternionTrack(
          cloned as THREE.QuaternionKeyframeTrack,
          boneName,
          targetBone,
          sourceRest!,
          targetRest!,
        );
      }

      newTracks.push(cloned);
    }
    return new THREE.AnimationClip(clip.name, clip.duration, newTracks);
  });
}

export function findBoneNameByAlias(
  boneNames: string[],
  aliases: string[]
): string | null {
  for (const alias of aliases) {
    const found = boneNames.find(b => b === alias || stripColons(b) === alias || normalize(b) === alias);
    if (found) return found;
  }
  for (const alias of aliases) {
    const lower = alias.toLowerCase();
    const found = boneNames.find(b => b.toLowerCase() === lower || stripColons(b).toLowerCase() === lower || normalize(b).toLowerCase() === lower);
    if (found) return found;
  }
  for (const alias of aliases) {
    const lower = alias.toLowerCase();
    const found = boneNames.find(b => b.toLowerCase().includes(lower) || stripColons(b).toLowerCase().includes(lower) || normalize(b).toLowerCase().includes(lower));
    if (found) return found;
  }
  return null;
}

export type MaterialCategory = "skin" | "clothing" | "pants" | "hair" | "hat" | "armor" | "detail" | "unknown";

export interface ModelAnalysis {
  bounds: { width: number; height: number; depth: number };
  box: THREE.Box3;
  suggestedScale: number;
  boneNames: string[];
  handBones: { right: string | null; left: string | null };
  materialNames: string[];
  materialCategories: Record<string, MaterialCategory>;
  animationNames: string[];
  animationDurations: Record<string, number>;
  meshCount: number;
  vertexCount: number;
  triangleCount: number;
  hasRig: boolean;
}

export interface BodyPartBones {
  spine: string[];
  upperSpine: string[];
  neck: string[];
  arms: string[];
  upperArms: string[];
  forearms: string[];
  hands: string[];
  legs: string[];
  calves: string[];
  feet: string[];
  head: string[];
  jaw: string[];
  brow: string[];
  cheek: string[];
  hips: string[];
  root: string | null;
}

const SPINE_KW = ["spine", "chest", "torso", "back", "abdomen"];
const UPPER_SPINE_KW = ["chest", "spine2", "spine02", "spine.002", "upperchest"];
const NECK_KW = ["neck"];
const ARM_KW = ["arm", "shoulder", "clavicle"];
const UPPER_ARM_KW = ["upperarm", "upper_arm", "arm.l", "arm.r", "arm_l", "arm_r"];
const FOREARM_KW = ["forearm", "lowerarm", "lower_arm", "elbow"];
const HAND_KW = ["hand", "fist", "wrist"];
const LEG_KW = ["leg", "thigh", "upperleg", "upper_leg"];
const CALF_KW = ["shin", "calf", "lowerleg", "lower_leg", "knee"];
const FOOT_KW = ["foot", "ankle", "toe"];
const HEAD_KW = ["head"];
const JAW_KW = ["jaw", "chin", "mouth"];
const BROW_KW = ["brow", "eye", "forehead"];
const CHEEK_KW = ["cheek", "zygomatic"];
const HIP_KW = ["hip", "pelvis", "waist"];

export function detectBodyParts(boneNames: string[]): BodyPartBones {
  const result: BodyPartBones = {
    spine: [], upperSpine: [], neck: [], arms: [], upperArms: [], forearms: [],
    hands: [], legs: [], calves: [], feet: [], head: [], jaw: [], brow: [],
    cheek: [], hips: [], root: null,
  };
  for (const name of boneNames) {
    const lower = name.toLowerCase();
    if (lower === "root" || lower === "armature" || lower === "hips" || lower === "mixamorig:hips" || lower === "mixamorigehips") {
      if (!result.root) result.root = name;
    }
    if (SPINE_KW.some(k => lower.includes(k))) result.spine.push(name);
    if (UPPER_SPINE_KW.some(k => lower.includes(k))) result.upperSpine.push(name);
    if (NECK_KW.some(k => lower.includes(k))) result.neck.push(name);
    if (ARM_KW.some(k => lower.includes(k))) result.arms.push(name);
    if (UPPER_ARM_KW.some(k => lower.includes(k))) result.upperArms.push(name);
    if (FOREARM_KW.some(k => lower.includes(k))) result.forearms.push(name);
    if (HAND_KW.some(k => lower.includes(k))) result.hands.push(name);
    if (LEG_KW.some(k => lower.includes(k))) result.legs.push(name);
    if (CALF_KW.some(k => lower.includes(k))) result.calves.push(name);
    if (FOOT_KW.some(k => lower.includes(k))) result.feet.push(name);
    if (HEAD_KW.some(k => lower.includes(k))) result.head.push(name);
    if (JAW_KW.some(k => lower.includes(k))) result.jaw.push(name);
    if (BROW_KW.some(k => lower.includes(k))) result.brow.push(name);
    if (CHEEK_KW.some(k => lower.includes(k))) result.cheek.push(name);
    if (HIP_KW.some(k => lower.includes(k))) result.hips.push(name);
  }
  return result;
}

export interface BodyMorphConfig {
  torsoLength: number;
  armLength: number;
  legLength: number;
  shoulderWidth: number;
  hipWidth: number;
  muscle: number;
  headScale: number;
  neckLength: number;
  neckWidth: number;
  chestWidth: number;
  forearmScale: number;
  calfScale: number;
  handScale: number;
  footScale: number;
  jawWidth: number;
  browHeight: number;
  cheekWidth: number;
}

export const DEFAULT_BODY_MORPH: BodyMorphConfig = {
  torsoLength: 1.0, armLength: 1.0, legLength: 1.0, shoulderWidth: 1.0,
  hipWidth: 1.0, muscle: 1.0, headScale: 1.0, neckLength: 1.0, neckWidth: 1.0,
  chestWidth: 1.0, forearmScale: 1.0, calfScale: 1.0, handScale: 1.0,
  footScale: 1.0, jawWidth: 1.0, browHeight: 1.0, cheekWidth: 1.0,
};

export function applyBodyMorph(
  scene: THREE.Object3D,
  morph: BodyMorphConfig,
  bodyParts: BodyPartBones
): void {
  scene.traverse((child) => {
    if (!(child as THREE.Bone).isBone) return;
    const bone = child as THREE.Bone;
    const lower = bone.name.toLowerCase();
    const isNonMorphRoot = (lower === "root" || lower === "armature") && !bodyParts.hips.includes(bone.name);
    if (isNonMorphRoot) return;
    if (bodyParts.spine.includes(bone.name)) {
      bone.scale.y = morph.torsoLength;
      bone.scale.x = THREE.MathUtils.lerp(1, morph.shoulderWidth, 0.5);
      bone.scale.z = THREE.MathUtils.lerp(1, morph.muscle, 0.3);
    }
    if (bodyParts.upperSpine.includes(bone.name)) {
      bone.scale.x = morph.chestWidth;
      bone.scale.z = THREE.MathUtils.lerp(1, morph.muscle, 0.5);
    }
    if (bodyParts.neck.includes(bone.name)) {
      bone.scale.y = morph.neckLength;
      bone.scale.x = morph.neckWidth;
      bone.scale.z = morph.neckWidth;
    }
    if (bodyParts.arms.includes(bone.name) || bodyParts.upperArms.includes(bone.name)) {
      bone.scale.y = morph.armLength;
      const m = THREE.MathUtils.lerp(1, morph.muscle, 0.4);
      bone.scale.x = m;
      bone.scale.z = m;
    }
    if (bodyParts.forearms.includes(bone.name)) {
      const m = THREE.MathUtils.lerp(1, morph.muscle, 0.3);
      bone.scale.x = morph.forearmScale * m;
      bone.scale.y = morph.armLength;
      bone.scale.z = morph.forearmScale * m;
    }
    if (bodyParts.hands.includes(bone.name)) bone.scale.set(morph.handScale, morph.handScale, morph.handScale);
    if (bodyParts.legs.includes(bone.name)) {
      bone.scale.y = morph.legLength;
      const m = THREE.MathUtils.lerp(1, morph.muscle, 0.3);
      bone.scale.x = m;
      bone.scale.z = m;
    }
    if (bodyParts.calves.includes(bone.name)) {
      const m = THREE.MathUtils.lerp(1, morph.muscle, 0.25);
      bone.scale.x = morph.calfScale * m;
      bone.scale.y = morph.legLength;
      bone.scale.z = morph.calfScale * m;
    }
    if (bodyParts.feet.includes(bone.name)) bone.scale.set(morph.footScale, morph.footScale, morph.footScale);
    if (bodyParts.head.includes(bone.name)) bone.scale.set(morph.headScale, morph.headScale, morph.headScale);
    if (bodyParts.jaw.includes(bone.name)) { bone.scale.x = morph.jawWidth; bone.scale.z = morph.jawWidth; }
    if (bodyParts.brow.includes(bone.name)) bone.scale.y = morph.browHeight;
    if (bodyParts.cheek.includes(bone.name)) { bone.scale.x = morph.cheekWidth; bone.scale.z = morph.cheekWidth; }
    if (bodyParts.hips.includes(bone.name)) {
      bone.scale.x = morph.hipWidth;
      bone.scale.z = THREE.MathUtils.lerp(1, morph.muscle, 0.2);
    }
  });
}

export interface WeaponOffsetConfig {
  rightPos: [number, number, number];
  rightRot: [number, number, number];
  rightScale: [number, number, number];
  leftPos: [number, number, number];
  leftRot: [number, number, number];
  leftScale: [number, number, number];
}

export const DEFAULT_WEAPON_OFFSET: WeaponOffsetConfig = {
  rightPos: [0, 0, 0], rightRot: [0, 0, 0], rightScale: [1, 1, 1],
  leftPos: [0, 0, 0], leftRot: [0, 0, 0], leftScale: [1, 1, 1],
};

import type { WeaponType } from "@/lib/stores/useGame";

export type GripStyle = "main_1h" | "off_1h" | "two_hand" | "ranged_2h" | "unarmed";

export interface GripProfile {
  style: GripStyle;
  mainHand: "right" | "left";
  usesOffHand: boolean;
  offHandWeapon: WeaponType | null;
}

export interface GripTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  scaleVector?: [number, number, number];
}

const WEAPON_GRIP_PROFILES: Record<WeaponType, GripProfile> = {
  sword:      { style: "main_1h",   mainHand: "right", usesOffHand: false, offHandWeapon: null },
  dagger:     { style: "main_1h",   mainHand: "right", usesOffHand: false, offHandWeapon: null },
  axe:        { style: "main_1h",   mainHand: "right", usesOffHand: false, offHandWeapon: null },
  hammer:     { style: "main_1h",   mainHand: "right", usesOffHand: false, offHandWeapon: null },
  wand:       { style: "main_1h",   mainHand: "right", usesOffHand: false, offHandWeapon: null },
  greatsword: { style: "two_hand",  mainHand: "right", usesOffHand: false, offHandWeapon: null },
  poleaxe:    { style: "two_hand",  mainHand: "right", usesOffHand: false, offHandWeapon: null },
  staff:      { style: "two_hand",  mainHand: "right", usesOffHand: false, offHandWeapon: null },
  bow:        { style: "ranged_2h", mainHand: "left",  usesOffHand: false, offHandWeapon: null },
  crossbow:   { style: "ranged_2h", mainHand: "right", usesOffHand: false, offHandWeapon: null },
  gun:        { style: "ranged_2h", mainHand: "right", usesOffHand: false, offHandWeapon: null },
  shield:     { style: "off_1h",    mainHand: "left",  usesOffHand: true,  offHandWeapon: null },
  fists:      { style: "unarmed",   mainHand: "right", usesOffHand: false, offHandWeapon: null },
};

export function getWeaponGripProfile(weaponType: WeaponType): GripProfile {
  return WEAPON_GRIP_PROFILES[weaponType];
}

/**
 * Per-weapon melee hit volume. `reach` multiplies the player's base attack
 * range; `arc` is the half-angle (radians) of the forward cone in which a
 * swing actually connects. Authored to match common conventions:
 *  - daggers and fists: short reach, narrow arc — surgical strikes.
 *  - swords / axes / hammers: medium reach, ~120° arc — a normal swing.
 *  - greatswords / poleaxes / staves: long reach, ~150° sweeping arc.
 *  - shields: short reach, narrow arc — defensive bash.
 *  - ranged weapons (bow/crossbow/gun): values are placeholders since they
 *    use projectile spawning, not melee cone resolution.
 */
export interface WeaponReach {
  reach: number;
  arc: number;
}

export const WEAPON_REACH: Record<WeaponType, WeaponReach> = {
  fists:      { reach: 0.55, arc: 0.80 },
  dagger:     { reach: 0.65, arc: 0.95 },
  sword:      { reach: 1.00, arc: 1.05 },
  axe:        { reach: 0.90, arc: 1.05 },
  hammer:     { reach: 0.95, arc: 1.00 },
  greatsword: { reach: 1.40, arc: 1.30 },
  poleaxe:    { reach: 1.65, arc: 1.30 },
  staff:      { reach: 1.30, arc: 1.20 },
  wand:       { reach: 0.75, arc: 1.05 },
  shield:     { reach: 0.70, arc: 0.90 },
  bow:        { reach: 1.00, arc: 1.00 },
  crossbow:   { reach: 1.00, arc: 1.00 },
  gun:        { reach: 1.00, arc: 1.00 },
};

export function getWeaponReach(weaponType: WeaponType): WeaponReach {
  return WEAPON_REACH[weaponType] ?? { reach: 1.0, arc: 1.0 };
}

const PI = Math.PI;

const GRIP_TRANSFORMS: Record<SkeletonType, Record<GripStyle, { right: GripTransform; left: GripTransform }>> = {
  // Grudge6 uMMORPG Bip001 3ds-Max rig. The hand containers already absorb
  // the local-axis orientation from the FBX rig, so offsets are much smaller
  // than Mixamo (no -PI/2 rotation needed).
  bip001: {
    main_1h: {
      right: { position: [0, 0.02, 0], rotation: [0, 0, 0.12], scale: 1.0 },
      left:  { position: [0, 0.02, 0], rotation: [0, 0, -0.12], scale: 1.0 },
    },
    off_1h: {
      right: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
      left:  { position: [0, 0.02, 0.03], rotation: [PI / 2, 0.1, -0.15], scale: 1.0 },
    },
    two_hand: {
      right: { position: [0, 0.03, 0], rotation: [0, 0, 0.12], scale: 1.0 },
      left:  { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
    },
    ranged_2h: {
      right: { position: [0, 0.02, 0.02], rotation: [0, 0, 0], scale: 1.0 },
      left:  { position: [0, 0.02, 0.03], rotation: [0, PI / 2, -0.1], scale: 1.0 },
    },
    unarmed: {
      right: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
      left:  { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
    },
  },
  kaykit: {
    main_1h: {
      right: { position: [0, 0.04, 0.03], rotation: [0.3, 0.1, 0], scale: 1.0 },
      left:  { position: [0, 0.04, 0.03], rotation: [0.3, -0.1, 0], scale: 1.0 },
    },
    off_1h: {
      right: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
      left:  { position: [0.02, 0.03, 0.06], rotation: [PI * 0.5, 0.15, -0.2], scale: 1.0 },
    },
    two_hand: {
      right: { position: [0, 0.05, 0.03], rotation: [0.35, 0.08, 0], scale: 1.0 },
      left:  { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
    },
    ranged_2h: {
      right: { position: [0, 0.03, 0.04], rotation: [0, 0, 0], scale: 1.0 },
      left:  { position: [0, 0.04, 0.05], rotation: [0, PI / 2, -0.1], scale: 1.0 },
    },
    unarmed: {
      right: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
      left:  { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
    },
  },
  mixamo: {
    main_1h: {
      right: { position: [0, 0.08, 0.02], rotation: [-PI / 2, 0, 0.3], scale: 1.0 },
      left:  { position: [0, 0.08, 0.02], rotation: [-PI / 2, 0, -0.3], scale: 1.0 },
    },
    off_1h: {
      right: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
      left:  { position: [0.02, 0.08, 0.05], rotation: [-PI * 0.5, 0.15, -0.2], scale: 1.0 },
    },
    two_hand: {
      right: { position: [0, 0.09, 0.02], rotation: [-PI / 2, 0, 0.35], scale: 1.0 },
      left:  { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
    },
    ranged_2h: {
      right: { position: [0, 0.06, 0.04], rotation: [-PI / 2, 0, 0], scale: 1.0 },
      left:  { position: [0, 0.07, 0.04], rotation: [-PI / 2, PI / 2, -0.1], scale: 1.0 },
    },
    unarmed: {
      right: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
      left:  { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
    },
  },
  cc4: {
    main_1h: {
      right: { position: [0, 0.07, 0.02], rotation: [-PI / 2, 0, 0.25], scale: 1.0 },
      left:  { position: [0, 0.07, 0.02], rotation: [-PI / 2, 0, -0.25], scale: 1.0 },
    },
    off_1h: {
      right: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
      left:  { position: [0.02, 0.07, 0.05], rotation: [-PI * 0.5, 0.15, -0.2], scale: 1.0 },
    },
    two_hand: {
      right: { position: [0, 0.08, 0.02], rotation: [-PI / 2, 0, 0.3], scale: 1.0 },
      left:  { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
    },
    ranged_2h: {
      right: { position: [0, 0.05, 0.03], rotation: [-PI / 2, 0, 0], scale: 1.0 },
      left:  { position: [0, 0.06, 0.04], rotation: [-PI / 2, PI / 2, -0.1], scale: 1.0 },
    },
    unarmed: {
      right: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
      left:  { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
    },
  },
  generic: {
    main_1h: {
      right: { position: [0, 0.06, 0.02], rotation: [-PI / 4, 0, 0.3], scale: 1.0 },
      left:  { position: [0, 0.06, 0.02], rotation: [-PI / 4, 0, -0.3], scale: 1.0 },
    },
    off_1h: {
      right: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
      left:  { position: [0.02, 0.06, 0.05], rotation: [-PI * 0.3, 0.15, -0.2], scale: 1.0 },
    },
    two_hand: {
      right: { position: [0, 0.07, 0.02], rotation: [-PI / 4, 0, 0.35], scale: 1.0 },
      left:  { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
    },
    ranged_2h: {
      right: { position: [0, 0.05, 0.03], rotation: [-PI / 4, 0, 0], scale: 1.0 },
      left:  { position: [0, 0.06, 0.04], rotation: [-PI / 4, PI / 2, -0.1], scale: 1.0 },
    },
    unarmed: {
      right: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
      left:  { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 },
    },
  },
};

type WeaponOffsetEntry = { posAdj: [number, number, number]; rotAdj: [number, number, number] };

const WEAPON_SPECIFIC_OFFSETS: Record<SkeletonType, Partial<Record<WeaponType, WeaponOffsetEntry>>> = {
  bip001: {
    // Bip001 containers already align the weapon axis; only minor tweaks needed.
    greatsword: { posAdj: [0, 0.04, 0], rotAdj: [0, 0, 0] },
    poleaxe:    { posAdj: [0, 0.06, 0], rotAdj: [0, 0, 0] },
    staff:      { posAdj: [0, 0.08, 0], rotAdj: [0, 0, 0] },
    bow:        { posAdj: [0, 0.01, 0.02], rotAdj: [0, PI / 2, 0] },
    crossbow:   { posAdj: [0, 0.02, 0.03], rotAdj: [-PI / 2, 0, 0] },
    gun:        { posAdj: [0, 0.02, 0.04], rotAdj: [0, 0, 0] },
    shield:     { posAdj: [0, 0.02, 0.03], rotAdj: [PI / 2, 0, 0.05] },
  },
  kaykit: {
    sword: { posAdj: [0, 0.02, 0.01], rotAdj: [0.1, 0, 0] },
    greatsword: { posAdj: [0, 0.06, 0.01], rotAdj: [0.15, -0.05, 0] },
    axe: { posAdj: [0, 0.04, 0.02], rotAdj: [0.08, 0.1, 0] },
    poleaxe: { posAdj: [0, 0.1, 0.01], rotAdj: [0.1, 0, 0] },
    hammer: { posAdj: [0, 0.04, 0.02], rotAdj: [0.08, 0.05, 0] },
    dagger: { posAdj: [0, 0.01, 0.01], rotAdj: [0.05, 0, 0] },
    staff: { posAdj: [0, 0.12, 0], rotAdj: [0.05, 0, 0] },
    wand: { posAdj: [0, 0.03, 0.01], rotAdj: [0.08, 0.05, 0] },
    bow: { posAdj: [0, 0.02, 0.04], rotAdj: [0, PI / 2, 0] },
    crossbow: { posAdj: [0, 0.03, 0.05], rotAdj: [-PI / 2, 0, 0] },
    gun: { posAdj: [0, 0.03, 0.05], rotAdj: [0, 0, 0] },
    shield: { posAdj: [0.01, 0.04, 0.04], rotAdj: [PI / 2, 0, 0.05] },
  },
  mixamo: {
    sword: { posAdj: [0, 0.03, 0.02], rotAdj: [-0.2, 0, 0] },
    greatsword: { posAdj: [0, 0.08, 0.02], rotAdj: [-0.3, -0.08, 0] },
    axe: { posAdj: [0, 0.06, 0.03], rotAdj: [-0.15, 0.12, 0] },
    poleaxe: { posAdj: [0, 0.12, 0.02], rotAdj: [-0.1, 0, 0] },
    hammer: { posAdj: [0, 0.06, 0.03], rotAdj: [-0.15, 0.08, 0] },
    dagger: { posAdj: [0, 0.01, 0.015], rotAdj: [-0.2, 0, 0] },
    staff: { posAdj: [0, 0.14, 0.01], rotAdj: [-0.06, 0, 0] },
    wand: { posAdj: [0, 0.04, 0.015], rotAdj: [-0.2, 0.08, 0] },
    bow: { posAdj: [0, 0.03, 0.05], rotAdj: [0, PI / 2, 0] },
    crossbow: { posAdj: [0, 0.04, 0.06], rotAdj: [-PI / 2, 0, 0] },
    gun: { posAdj: [0, 0.04, 0.06], rotAdj: [0, 0, 0] },
    shield: { posAdj: [0.01, 0.05, 0.06], rotAdj: [PI / 2, 0, 0.08] },
  },
  cc4: {
    sword: { posAdj: [0, 0.03, 0.02], rotAdj: [-0.15, 0, 0] },
    greatsword: { posAdj: [0, 0.08, 0.02], rotAdj: [-0.25, -0.08, 0] },
    axe: { posAdj: [0, 0.06, 0.03], rotAdj: [-0.12, 0.12, 0] },
    poleaxe: { posAdj: [0, 0.12, 0.02], rotAdj: [-0.08, 0, 0] },
    hammer: { posAdj: [0, 0.06, 0.03], rotAdj: [-0.12, 0.08, 0] },
    dagger: { posAdj: [0, 0.01, 0.015], rotAdj: [-0.15, 0, 0] },
    staff: { posAdj: [0, 0.14, 0.01], rotAdj: [-0.05, 0, 0] },
    wand: { posAdj: [0, 0.04, 0.015], rotAdj: [-0.15, 0.08, 0] },
    bow: { posAdj: [0, 0.03, 0.05], rotAdj: [0, PI / 2, 0] },
    crossbow: { posAdj: [0, 0.04, 0.06], rotAdj: [-PI / 2, 0, 0] },
    gun: { posAdj: [0, 0.04, 0.06], rotAdj: [0, 0, 0] },
    shield: { posAdj: [0.01, 0.05, 0.06], rotAdj: [PI / 2, 0, 0.08] },
  },
  generic: {
    sword: { posAdj: [0, 0.03, 0.015], rotAdj: [-0.1, 0, 0] },
    greatsword: { posAdj: [0, 0.07, 0.02], rotAdj: [-0.15, -0.06, 0] },
    axe: { posAdj: [0, 0.05, 0.025], rotAdj: [-0.08, 0.1, 0] },
    poleaxe: { posAdj: [0, 0.11, 0.015], rotAdj: [-0.05, 0, 0] },
    hammer: { posAdj: [0, 0.05, 0.025], rotAdj: [-0.08, 0.06, 0] },
    dagger: { posAdj: [0, 0.01, 0.01], rotAdj: [-0.1, 0, 0] },
    staff: { posAdj: [0, 0.13, 0.005], rotAdj: [-0.03, 0, 0] },
    wand: { posAdj: [0, 0.035, 0.01], rotAdj: [-0.1, 0.06, 0] },
    bow: { posAdj: [0, 0.025, 0.045], rotAdj: [0, PI / 2, 0] },
    crossbow: { posAdj: [0, 0.035, 0.055], rotAdj: [-PI / 2, 0, 0] },
    gun: { posAdj: [0, 0.035, 0.055], rotAdj: [0, 0, 0] },
    shield: { posAdj: [0.01, 0.045, 0.05], rotAdj: [PI / 2, 0, 0.06] },
  },
};

export function computeWeaponTransform(
  weaponType: WeaponType,
  hand: "right" | "left",
  skeletonType: SkeletonType,
  _modelScale: number = 1.0
): GripTransform {
  if (weaponType === "fists") return { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1.0 };
  const grip = WEAPON_GRIP_PROFILES[weaponType];
  const gripTransforms = GRIP_TRANSFORMS[skeletonType][grip.style];
  const base = hand === "right" ? gripTransforms.right : gripTransforms.left;
  const specificOff = WEAPON_SPECIFIC_OFFSETS[skeletonType][weaponType];
  const isMainHand = (grip.mainHand === hand);
  const isHolding = isMainHand || (grip.style === "off_1h" && hand === "left") || (grip.usesOffHand && hand === "left");
  if (!isHolding && grip.style !== "two_hand" && grip.style !== "ranged_2h") {
    return { position: [0, 0, 0], rotation: [0, 0, 0], scale: 0 };
  }
  const pos: [number, number, number] = [...base.position];
  const rot: [number, number, number] = [...base.rotation];
  if (specificOff) {
    pos[0] += specificOff.posAdj[0]; pos[1] += specificOff.posAdj[1]; pos[2] += specificOff.posAdj[2];
    rot[0] += specificOff.rotAdj[0]; rot[1] += specificOff.rotAdj[1]; rot[2] += specificOff.rotAdj[2];
  }
  return { position: pos, rotation: rot, scale: base.scale };
}

export function buildWeaponGripData(
  weaponRight: WeaponType,
  weaponLeft: WeaponType | null,
  skeletonType: SkeletonType,
  modelScale: number = 1.0
): { right: { type: WeaponType; transform: GripTransform } | null; left: { type: WeaponType; transform: GripTransform } | null } {
  const rightGrip = getWeaponGripProfile(weaponRight);
  let rightResult: { type: WeaponType; transform: GripTransform } | null = null;
  let leftResult: { type: WeaponType; transform: GripTransform } | null = null;
  if (weaponRight !== "fists") {
    if (rightGrip.mainHand === "right") {
      rightResult = { type: weaponRight, transform: computeWeaponTransform(weaponRight, "right", skeletonType, modelScale) };
    } else if (rightGrip.mainHand === "left") {
      leftResult = { type: weaponRight, transform: computeWeaponTransform(weaponRight, "left", skeletonType, modelScale) };
    }
  }
  if (weaponLeft && weaponLeft !== "fists") {
    const leftGrip = getWeaponGripProfile(weaponLeft);
    if (leftGrip.style === "off_1h" || weaponLeft === "shield") {
      leftResult = { type: weaponLeft, transform: computeWeaponTransform(weaponLeft, "left", skeletonType, modelScale) };
    } else if (!rightResult || rightGrip.style === "main_1h") {
      leftResult = { type: weaponLeft, transform: computeWeaponTransform(weaponLeft, "left", skeletonType, modelScale) };
    }
  }
  if (rightGrip.style === "two_hand" || rightGrip.style === "ranged_2h") {
    if (rightGrip.mainHand === "left") rightResult = null;
    else leftResult = null;
  }
  return { right: rightResult, left: leftResult };
}

export function cleanWeaponsFromBone(bone: THREE.Object3D | null): void {
  if (!bone) return;
  const toRemove = bone.children.filter(c => c.name.startsWith("weapon_"));
  toRemove.forEach(c => bone.remove(c));
}

export function applyWeaponTransformToBone(
  grp: THREE.Group,
  bone: THREE.Object3D,
  scene: THREE.Object3D,
  data: { type: WeaponType; transform: GripTransform },
  hand: "right" | "left",
  userOffset?: { rightPos: [number, number, number]; rightRot: [number, number, number]; rightScale?: [number, number, number]; leftPos: [number, number, number]; leftRot: [number, number, number]; leftScale?: [number, number, number] } | null
): void {
  const t = data.transform;
  let finalPos: [number, number, number] = [...t.position];
  let finalRot: [number, number, number] = [...t.rotation];
  if (userOffset) {
    const uPos = hand === "right" ? userOffset.rightPos : userOffset.leftPos;
    const uRot = hand === "right" ? userOffset.rightRot : userOffset.leftRot;
    if (uPos.some(v => v !== 0) || uRot.some(v => v !== 0)) {
      finalPos = [finalPos[0] + uPos[0], finalPos[1] + uPos[1], finalPos[2] + uPos[2]];
      finalRot = [finalRot[0] + uRot[0], finalRot[1] + uRot[1], finalRot[2] + uRot[2]];
    }
  }
  grp.position.set(finalPos[0], finalPos[1], finalPos[2]);
  grp.rotation.set(finalRot[0], finalRot[1], finalRot[2]);
  scene.updateMatrixWorld(true);
  const _ws = new THREE.Vector3();
  bone.getWorldScale(_ws);
  const avgWorldScale = (_ws.x + _ws.y + _ws.z) / 3;
  const boneInv = avgWorldScale > 0.01 ? Math.max(0.1, Math.min(10, 1 / avgWorldScale)) : 1;
  const uScale = userOffset ? (hand === "right" ? userOffset.rightScale : userOffset.leftScale) : undefined;
  if (uScale && (uScale[0] !== 1 || uScale[1] !== 1 || uScale[2] !== 1)) {
    grp.scale.set(boneInv * uScale[0], boneInv * uScale[1], boneInv * uScale[2]);
  } else {
    grp.scale.set(boneInv, boneInv, boneInv);
  }
  // Stash the base transform + bone inverse-scale so the in-game weapon
  // gizmo can recover the user offset from the live group pose.
  const weaponBase: WeaponBaseUserData = {
    basePos: [t.position[0], t.position[1], t.position[2]],
    baseRot: [t.rotation[0], t.rotation[1], t.rotation[2]],
    boneInv,
    hand,
  };
  grp.userData.weaponBase = weaponBase;
  bone.add(grp);
}

export interface WeaponBaseUserData {
  basePos: [number, number, number];
  baseRot: [number, number, number];
  boneInv: number;
  hand: "right" | "left";
}

export function getWeaponBaseUserData(obj: THREE.Object3D): WeaponBaseUserData | null {
  const wb = obj.userData?.weaponBase;
  if (
    wb &&
    Array.isArray(wb.basePos) && wb.basePos.length === 3 &&
    Array.isArray(wb.baseRot) && wb.baseRot.length === 3 &&
    typeof wb.boneInv === "number" &&
    (wb.hand === "right" || wb.hand === "left")
  ) {
    return wb as WeaponBaseUserData;
  }
  return null;
}

export function getGripLabel(weaponType: WeaponType): string {
  const grip = WEAPON_GRIP_PROFILES[weaponType];
  switch (grip.style) {
    case "main_1h": return "1H Main Hand";
    case "off_1h": return "Off Hand";
    case "two_hand": return "Two-Handed";
    case "ranged_2h": return "Ranged 2H";
    case "unarmed": return "Unarmed";
    default: return "Unknown";
  }
}

export function getWeaponPairDescription(weaponRight: WeaponType, weaponLeft: WeaponType | null): string {
  const rightGrip = WEAPON_GRIP_PROFILES[weaponRight];
  if (weaponRight === "fists") return "Unarmed combat";
  if (rightGrip.style === "two_hand") return `${weaponRight} (two-handed)`;
  if (rightGrip.style === "ranged_2h") return `${weaponRight} (ranged, both hands)`;
  if (weaponLeft && weaponLeft !== "fists") return `${weaponRight} + ${weaponLeft} (dual wield)`;
  return `${weaponRight} (one-handed)`;
}

/**
 * Per-finger curl strength for a hand grip pose. Values are radians of curl
 * applied to phalanx 1/2/3 of each finger (proximal, middle, distal). Larger
 * = tighter fist.
 */
export interface GripPose {
  index:  [number, number, number];
  middle: [number, number, number];
  ring:   [number, number, number];
  pinky:  [number, number, number];
  thumb:  [number, number, number];
}

export const GRIP_POSE_REST: GripPose = {
  index:  [0, 0, 0], middle: [0, 0, 0], ring: [0, 0, 0],
  pinky:  [0, 0, 0], thumb:  [0, 0, 0],
};

/** Closed fist around a hilt (sword, axe, hammer, staff, bow grip…). */
export const GRIP_POSE_FIST: GripPose = {
  index:  [0.65, 0.95, 0.65],
  middle: [0.65, 0.95, 0.65],
  ring:   [0.60, 0.90, 0.60],
  pinky:  [0.55, 0.85, 0.55],
  thumb:  [0.30, 0.45, 0.30],
};

/** Loose, half-curled grip — used for shield straps, open-palm holds. */
export const GRIP_POSE_OPEN: GripPose = {
  index:  [0.20, 0.20, 0.15],
  middle: [0.20, 0.20, 0.15],
  ring:   [0.18, 0.18, 0.12],
  pinky:  [0.15, 0.15, 0.10],
  thumb:  [0.10, 0.15, 0.10],
};

const FINGER_ALIAS_LOOKUP: Record<"left" | "right", Array<{ key: keyof GripPose; segments: [string[], string[], string[]] }>> = {
  left: [
    { key: "index",  segments: [LEFT_INDEX_1_ALIASES,  LEFT_INDEX_2_ALIASES,  LEFT_INDEX_3_ALIASES] },
    { key: "middle", segments: [LEFT_MIDDLE_1_ALIASES, LEFT_MIDDLE_2_ALIASES, LEFT_MIDDLE_3_ALIASES] },
    { key: "ring",   segments: [LEFT_RING_1_ALIASES,   LEFT_RING_2_ALIASES,   LEFT_RING_3_ALIASES] },
    { key: "pinky",  segments: [LEFT_PINKY_1_ALIASES,  LEFT_PINKY_2_ALIASES,  LEFT_PINKY_3_ALIASES] },
    { key: "thumb",  segments: [LEFT_THUMB_1_ALIASES,  LEFT_THUMB_2_ALIASES,  LEFT_THUMB_3_ALIASES] },
  ],
  right: [
    { key: "index",  segments: [RIGHT_INDEX_1_ALIASES,  RIGHT_INDEX_2_ALIASES,  RIGHT_INDEX_3_ALIASES] },
    { key: "middle", segments: [RIGHT_MIDDLE_1_ALIASES, RIGHT_MIDDLE_2_ALIASES, RIGHT_MIDDLE_3_ALIASES] },
    { key: "ring",   segments: [RIGHT_RING_1_ALIASES,   RIGHT_RING_2_ALIASES,   RIGHT_RING_3_ALIASES] },
    { key: "pinky",  segments: [RIGHT_PINKY_1_ALIASES,  RIGHT_PINKY_2_ALIASES,  RIGHT_PINKY_3_ALIASES] },
    { key: "thumb",  segments: [RIGHT_THUMB_1_ALIASES,  RIGHT_THUMB_2_ALIASES,  RIGHT_THUMB_3_ALIASES] },
  ],
};

/**
 * Per-hand cache of finger bone references plus the rest-pose quaternion we
 * snapshot the first time we touch a bone. Reusing the cache avoids walking
 * the scene graph 30 times every frame and lets us restore the rest pose
 * cleanly when the grip pose changes (e.g. weapon dropped).
 */
export interface HandGripBoneCache {
  bones: Array<{
    bone: THREE.Bone;
    restQ: THREE.Quaternion;
    /**
     * The quaternion we wrote on the previous frame (or restQ on first apply).
     * Used together with `authored` to detect when an external system
     * (animation mixer, IK, etc.) has written to this bone between our ticks.
     */
    lastWroteQ: THREE.Quaternion;
    /**
     * Latches `true` once we detect any external write to this bone. While
     * latched, procedural grip yields completely — even when the external
     * system writes the same value on consecutive frames (held key pose).
     * Cleared by `applyHandGripPose(..., { force: true })`, which is called
     * whenever the chosen `GripPose` changes (e.g. weapon swap).
     */
    authored: boolean;
    finger: keyof GripPose;
    segment: 0 | 1 | 2;
  }>;
  hand: "left" | "right";
}

export function buildHandGripBoneCache(
  scene: THREE.Object3D,
  hand: "left" | "right",
): HandGripBoneCache {
  const bones: HandGripBoneCache["bones"] = [];
  const fingerSegs = FINGER_ALIAS_LOOKUP[hand];
  for (const { key, segments } of fingerSegs) {
    for (let i = 0; i < 3; i++) {
      const found = findBoneByAlias(scene, segments[i]) as THREE.Bone | null;
      if (!found || !(found as THREE.Bone).isBone) continue;
      const restQ = found.quaternion.clone();
      bones.push({
        bone: found,
        restQ,
        lastWroteQ: restQ.clone(),
        authored: false,
        finger: key,
        segment: i as 0 | 1 | 2,
      });
    }
  }
  return { bones, hand };
}

const _curlAxis = new THREE.Vector3(1, 0, 0);
const _curlQ = new THREE.Quaternion();
const GRIP_YIELD_EPSILON_SQ = 1e-8;

function quaternionsClose(a: THREE.Quaternion, b: THREE.Quaternion): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  const dw = a.w - b.w;
  return dx * dx + dy * dy + dz * dz + dw * dw < GRIP_YIELD_EPSILON_SQ;
}

export interface ApplyGripOptions {
  strength?: number;
  /**
   * Reclaim every bone — including ones previously latched as authored — and
   * write the procedural pose unconditionally. Pass `true` whenever the
   * `pose` itself changes (weapon swap, equip / unequip) so the new pose
   * overrides any leftover authored value.
   */
  force?: boolean;
}

/**
 * Apply a static grip pose to the cached finger bones. Bones are oriented
 * "Y-along-bone" on every CC_Base / Mixamo / Bip01 finger we ship, so curl
 * is a rotation around local +X — flipped on the right hand to mirror the
 * left's anatomical curl direction.
 *
 * Strength of 0 restores the rest pose verbatim; 1 = full configured curl.
 *
 * Procedural grip yields to authored finger animation tracks: the first time
 * we observe an external system writing a bone (its quaternion no longer
 * matches the value we wrote last frame), we latch that bone as `authored`
 * and stop touching it entirely. This stays correct even when an authored
 * track holds the same value across many frames. The latch clears only when
 * the caller passes `force: true` — which the controller does when the
 * chosen pose changes (weapon swap), so a new equip resets ownership.
 */
export function applyHandGripPose(
  cache: HandGripBoneCache,
  pose: GripPose,
  options: ApplyGripOptions = {},
): void {
  const strength = options.strength ?? 1;
  const force = options.force ?? false;
  const sign = cache.hand === "left" ? 1 : -1;
  for (const entry of cache.bones) {
    if (!force) {
      if (entry.authored) continue;
      if (!quaternionsClose(entry.bone.quaternion, entry.lastWroteQ)) {
        entry.authored = true;
        entry.lastWroteQ.copy(entry.bone.quaternion);
        continue;
      }
    } else {
      entry.authored = false;
    }
    const curl = pose[entry.finger][entry.segment] * strength * sign;
    entry.bone.quaternion.copy(entry.restQ);
    if (curl !== 0) {
      _curlQ.setFromAxisAngle(_curlAxis, curl);
      entry.bone.quaternion.multiply(_curlQ);
    }
    entry.lastWroteQ.copy(entry.bone.quaternion);
  }
}

/**
 * Pick a grip pose for a hand based on what the character is holding. The
 * holding hand wraps tightly around the hilt; an empty off-hand stays
 * relaxed; a shield (or open-hand prop) gets a half-open grip.
 */
export function pickGripPose(
  hand: "left" | "right",
  weaponInThisHand: WeaponType | null | undefined,
  weaponInOtherHand: WeaponType | null | undefined,
): GripPose {
  const hasWeapon = !!weaponInThisHand && weaponInThisHand !== "fists";
  if (!hasWeapon) {
    // Two-handed weapons in the other hand pull this hand into a fist on the
    // grip. Otherwise the empty hand stays in its rest pose.
    if (weaponInOtherHand) {
      const otherProfile = WEAPON_GRIP_PROFILES[weaponInOtherHand];
      if (otherProfile.style === "two_hand" || otherProfile.style === "ranged_2h") {
        return GRIP_POSE_FIST;
      }
    }
    return GRIP_POSE_REST;
  }
  if (weaponInThisHand === "shield") return GRIP_POSE_OPEN;
  return GRIP_POSE_FIST;
}
