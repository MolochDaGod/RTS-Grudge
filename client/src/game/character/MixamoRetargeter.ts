/**
 * MixamoRetargeter — Retargets Mixamo animation clips to target skeleton rigs.
 *
 * Two target rigs are supported:
 *
 *   'bip001'   — 3ds Max Biped naming used by the existing toon_rts GLBs:
 *                Bip001_Pelvis, Bip001_Spine, Bip001_L_Thigh … etc.
 *                THIS IS THE DEFAULT for our game.
 *
 *   'mecanim'  — Unity Humanoid naming used by the modular skeleton.glb pipeline:
 *                Hips, Spine, LeftArm … etc.
 *
 * Mixamo exports bone names in two forms:
 *   "mixamorigHips"    — no-colon variant (FBX exports from mixamo.com "FBX for Unity")
 *   "mixamorig:Hips"   — colon variant  (older Mixamo downloads / some converters)
 * Both are handled automatically.
 *
 * Usage
 * ─────
 *   // Load and retarget a Mixamo FBX (for bip001 characters like wk/ud/orc/brb)
 *   const clips = await MixamoRetargeter.loadFBXClips('/models/mixamo/idle.fbx', {}, 'bip001');
 *
 *   // Load a Mixamo GLB (already in GLTF format)
 *   const clips = await MixamoRetargeter.loadClips('/models/mixamo/slash.glb', {}, 'bip001');
 *
 *   // Subclip from a packed Mixamo timeline (three-mixamo technique)
 *   const idle = MixamoRetargeter.subclip(packedClip, 'idle', 0, 60, 30);
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ── Target rig type ───────────────────────────────────────────────────────────

export type TargetRig = 'bip001' | 'mecanim';

// ── Bip001 (3ds Max Biped) mapping ────────────────────────────────────────────
// Used by ALL existing game characters: wk_characters.glb, ud_characters.glb,
// orc_characters.glb, brb_characters.glb AND the animation GLBs.
//
// Note: Bip001 has only ONE spine bone — Mixamo's Spine / Spine1 / Spine2 all
// collapse to Bip001_Spine.  This loses some spinal detail but is correct.

const MIXAMO_TO_BIP001: Record<string, string> = {
  Hips:                  'Bip001_Pelvis',
  Spine:                 'Bip001_Spine',
  Spine1:                'Bip001_Spine',   // collapsed
  Spine2:                'Bip001_Spine',   // collapsed
  Neck:                  'Bip001_Neck',
  Head:                  'Bip001_Head',
  HeadTop_End:           'Bip001_Head',    // no nub in Bip001
  // Left arm
  LeftShoulder:          'Bip001_L_Clavicle',
  LeftArm:               'Bip001_L_UpperArm',
  LeftForeArm:           'Bip001_L_Forearm',
  LeftHand:              'Bip001_L_Hand',
  LeftHandThumb1:        'Bip001_L_Finger0',
  LeftHandThumb2:        'Bip001_L_Finger01',
  LeftHandThumb3:        'Bip001_L_Finger02',
  LeftHandIndex1:        'Bip001_L_Finger1',
  LeftHandIndex2:        'Bip001_L_Finger11',
  LeftHandIndex3:        'Bip001_L_Finger12',
  LeftHandMiddle1:       'Bip001_L_Finger2',
  LeftHandMiddle2:       'Bip001_L_Finger21',
  LeftHandMiddle3:       'Bip001_L_Finger22',
  LeftHandRing1:         'Bip001_L_Finger3',
  LeftHandRing2:         'Bip001_L_Finger31',
  LeftHandRing3:         'Bip001_L_Finger32',
  LeftHandPinky1:        'Bip001_L_Finger4',
  LeftHandPinky2:        'Bip001_L_Finger41',
  LeftHandPinky3:        'Bip001_L_Finger42',
  // Right arm
  RightShoulder:         'Bip001_R_Clavicle',
  RightArm:              'Bip001_R_UpperArm',
  RightForeArm:          'Bip001_R_Forearm',
  RightHand:             'Bip001_R_Hand',
  RightHandThumb1:       'Bip001_R_Finger0',
  RightHandThumb2:       'Bip001_R_Finger01',
  RightHandThumb3:       'Bip001_R_Finger02',
  RightHandIndex1:       'Bip001_R_Finger1',
  RightHandIndex2:       'Bip001_R_Finger11',
  RightHandIndex3:       'Bip001_R_Finger12',
  RightHandMiddle1:      'Bip001_R_Finger2',
  RightHandMiddle2:      'Bip001_R_Finger21',
  RightHandMiddle3:      'Bip001_R_Finger22',
  RightHandRing1:        'Bip001_R_Finger3',
  RightHandRing2:        'Bip001_R_Finger31',
  RightHandRing3:        'Bip001_R_Finger32',
  RightHandPinky1:       'Bip001_R_Finger4',
  RightHandPinky2:       'Bip001_R_Finger41',
  RightHandPinky3:       'Bip001_R_Finger42',
  // Left leg
  LeftUpLeg:             'Bip001_L_Thigh',
  LeftLeg:               'Bip001_L_Calf',
  LeftFoot:              'Bip001_L_Foot',
  LeftToeBase:           'Bip001_L_Toe0',
  LeftToe_End:           'Bip001_L_Toe0',
  // Right leg
  RightUpLeg:            'Bip001_R_Thigh',
  RightLeg:              'Bip001_R_Calf',
  RightFoot:             'Bip001_R_Foot',
  RightToeBase:          'Bip001_R_Toe0',
  RightToe_End:          'Bip001_R_Toe0',
};

// ── Unity Mecanim mapping ─────────────────────────────────────────────────────
// Used by the modular toon_rts skeleton.glb (future FBX pipeline output).

const MIXAMO_TO_UNITY: Record<string, string> = {
  Hips:                  'Hips',
  Spine:                 'Spine',
  Spine1:                'Spine1',
  Spine2:                'Spine2',
  Neck:                  'Neck',
  Head:                  'Head',
  HeadTop_End:           'HeadTop_End',
  LeftShoulder:          'LeftShoulder',
  LeftArm:               'LeftArm',
  LeftForeArm:           'LeftForeArm',
  LeftHand:              'LeftHand',
  LeftHandThumb1:        'LeftHandThumb1',
  LeftHandThumb2:        'LeftHandThumb2',
  LeftHandThumb3:        'LeftHandThumb3',
  LeftHandThumb4:        'LeftHandThumb4',
  LeftHandIndex1:        'LeftHandIndex1',
  LeftHandIndex2:        'LeftHandIndex2',
  LeftHandIndex3:        'LeftHandIndex3',
  LeftHandIndex4:        'LeftHandIndex4',
  LeftHandMiddle1:       'LeftHandMiddle1',
  LeftHandMiddle2:       'LeftHandMiddle2',
  LeftHandMiddle3:       'LeftHandMiddle3',
  LeftHandMiddle4:       'LeftHandMiddle4',
  LeftHandRing1:         'LeftHandRing1',
  LeftHandRing2:         'LeftHandRing2',
  LeftHandRing3:         'LeftHandRing3',
  LeftHandRing4:         'LeftHandRing4',
  LeftHandPinky1:        'LeftHandPinky1',
  LeftHandPinky2:        'LeftHandPinky2',
  LeftHandPinky3:        'LeftHandPinky3',
  LeftHandPinky4:        'LeftHandPinky4',
  RightShoulder:         'RightShoulder',
  RightArm:              'RightArm',
  RightForeArm:          'RightForeArm',
  RightHand:             'RightHand',
  RightHandThumb1:       'RightHandThumb1',
  RightHandThumb2:       'RightHandThumb2',
  RightHandThumb3:       'RightHandThumb3',
  RightHandThumb4:       'RightHandThumb4',
  RightHandIndex1:       'RightHandIndex1',
  RightHandIndex2:       'RightHandIndex2',
  RightHandIndex3:       'RightHandIndex3',
  RightHandIndex4:       'RightHandIndex4',
  RightHandMiddle1:      'RightHandMiddle1',
  RightHandMiddle2:      'RightHandMiddle2',
  RightHandMiddle3:      'RightHandMiddle3',
  RightHandMiddle4:      'RightHandMiddle4',
  RightHandRing1:        'RightHandRing1',
  RightHandRing2:        'RightHandRing2',
  RightHandRing3:        'RightHandRing3',
  RightHandRing4:        'RightHandRing4',
  RightHandPinky1:       'RightHandPinky1',
  RightHandPinky2:       'RightHandPinky2',
  RightHandPinky3:       'RightHandPinky3',
  RightHandPinky4:       'RightHandPinky4',
  LeftUpLeg:             'LeftUpLeg',
  LeftLeg:               'LeftLeg',
  LeftFoot:              'LeftFoot',
  LeftToeBase:           'LeftToeBase',
  LeftToe_End:           'LeftToe_End',
  RightUpLeg:            'RightUpLeg',
  RightLeg:              'RightLeg',
  RightFoot:             'RightFoot',
  RightToeBase:          'RightToeBase',
  RightToe_End:          'RightToe_End',
};

// ── Build lookup maps for both prefix forms ───────────────────────────────────

function buildBoneMap(table: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [suffix, target] of Object.entries(table)) {
    map.set(`mixamorig${suffix}`,  target);   // mixamorigHips
    map.set(`mixamorig:${suffix}`, target);   // mixamorig:Hips
    map.set(suffix,                target);   // bare name (already stripped)
    // Also handle the target name mapping to itself (identity, for safety)
    map.set(target, target);
  }
  return map;
}

const BIP001_MAP  = buildBoneMap(MIXAMO_TO_BIP001);
const MECANIM_MAP = buildBoneMap(MIXAMO_TO_UNITY);

function getMap(rig: TargetRig) {
  return rig === 'bip001' ? BIP001_MAP : MECANIM_MAP;
}

// ── Synty (POLYGON / Locomotion Pack) source skeleton ────────────────────────
// Bone hierarchy used by the Synty Locomotion FBX clips:
//   RigRoot ▸ Hips ▸ Spine ▸ Chest ▸ UpperChest ▸ Neck (+Neck_Twist_A) ▸ Head
//   {Left,Right}_{Shoulder, UpperArm, LowerArm, Hand}
//   {Left,Right}_{UpperLeg, LowerLeg, Foot, Toes, ToesEnd}
//   Finger triples: <Side>_<Finger>{Proximal,Intermediate,Distal,DistalEnd}
//
// Maps THIS skeleton (not Mixamo's) onto the same TargetRig codomain so the
// resulting clips bind to existing Bip001 game characters.

const SYNTY_TO_BIP001: Record<string, string> = {
  Hips:           'Bip001_Pelvis',
  Spine:          'Bip001_Spine',
  Chest:          'Bip001_Spine1',
  UpperChest:     'Bip001_Spine2',
  Neck:           'Bip001_Neck',
  Head:           'Bip001_Head',
  // Left arm
  Left_Shoulder:  'Bip001_L_Clavicle',
  Left_UpperArm:  'Bip001_L_UpperArm',
  Left_LowerArm:  'Bip001_L_Forearm',
  Left_Hand:      'Bip001_L_Hand',
  Left_ThumbProximal:      'Bip001_L_Finger0',
  Left_ThumbIntermediate:  'Bip001_L_Finger01',
  Left_ThumbDistal:        'Bip001_L_Finger02',
  Left_IndexProximal:      'Bip001_L_Finger1',
  Left_IndexIntermediate:  'Bip001_L_Finger11',
  Left_IndexDistal:        'Bip001_L_Finger12',
  Left_MiddleProximal:     'Bip001_L_Finger2',
  Left_MiddleIntermediate: 'Bip001_L_Finger21',
  Left_MiddleDistal:       'Bip001_L_Finger22',
  Left_RingProximal:       'Bip001_L_Finger3',
  Left_RingIntermediate:   'Bip001_L_Finger31',
  Left_RingDistal:         'Bip001_L_Finger32',
  Left_PinkyProximal:      'Bip001_L_Finger4',
  Left_PinkyIntermediate:  'Bip001_L_Finger41',
  Left_PinkyDistal:        'Bip001_L_Finger42',
  // Right arm
  Right_Shoulder: 'Bip001_R_Clavicle',
  Right_UpperArm: 'Bip001_R_UpperArm',
  Right_LowerArm: 'Bip001_R_Forearm',
  Right_Hand:     'Bip001_R_Hand',
  Right_ThumbProximal:      'Bip001_R_Finger0',
  Right_ThumbIntermediate:  'Bip001_R_Finger01',
  Right_ThumbDistal:        'Bip001_R_Finger02',
  Right_IndexProximal:      'Bip001_R_Finger1',
  Right_IndexIntermediate:  'Bip001_R_Finger11',
  Right_IndexDistal:        'Bip001_R_Finger12',
  Right_MiddleProximal:     'Bip001_R_Finger2',
  Right_MiddleIntermediate: 'Bip001_R_Finger21',
  Right_MiddleDistal:       'Bip001_R_Finger22',
  Right_RingProximal:       'Bip001_R_Finger3',
  Right_RingIntermediate:   'Bip001_R_Finger31',
  Right_RingDistal:         'Bip001_R_Finger32',
  Right_PinkyProximal:      'Bip001_R_Finger4',
  Right_PinkyIntermediate:  'Bip001_R_Finger41',
  Right_PinkyDistal:        'Bip001_R_Finger42',
  // Left leg
  Left_UpperLeg:  'Bip001_L_Thigh',
  Left_LowerLeg:  'Bip001_L_Calf',
  Left_Foot:      'Bip001_L_Foot',
  Left_Toes:      'Bip001_L_Toe0',
  Left_ToesEnd:   'Bip001_L_Toe0',
  // Right leg
  Right_UpperLeg: 'Bip001_R_Thigh',
  Right_LowerLeg: 'Bip001_R_Calf',
  Right_Foot:     'Bip001_R_Foot',
  Right_Toes:     'Bip001_R_Toe0',
  Right_ToesEnd:  'Bip001_R_Toe0',
};

const SYNTY_BIP001_MAP = buildBoneMap(SYNTY_TO_BIP001);

function getSyntyMap(rig: TargetRig): Map<string, string> {
  if (rig === 'bip001') return SYNTY_BIP001_MAP;
  throw new Error(`[SyntyRetargeter] No Synty→${rig} mapping defined`);
}

// ── Track path remapping ──────────────────────────────────────────────────────

/**
 * Remap a Three.js AnimationTrack name.
 *
 * Formats handled:
 *   "mixamorigHips.quaternion"
 *   "mixamorig:Hips.position"
 *   "Scene > mixamorigHips.quaternion"   (ancestor path)
 *   "Armature|mixamorigHips|quaternion"  (pipe separator in some FBX exports)
 */
function remapTrackName(name: string, map: Map<string, string>): string {
  // Strip ancestor path (e.g. "Armature > ")
  const arrowIdx = name.lastIndexOf('>');
  let clean = arrowIdx >= 0 ? name.slice(arrowIdx + 1).trim() : name;

  // Some FBX→GLB converters use pipe as separator
  clean = clean.replace('|', '.');

  const dotIdx = clean.lastIndexOf('.');
  if (dotIdx < 0) return clean;

  const bonePart = clean.slice(0, dotIdx);
  const propPart = clean.slice(dotIdx);          // e.g. ".quaternion"

  const mapped = map.get(bonePart);
  return mapped ? `${mapped}${propPart}` : clean;
}

// ── Scale normalisation ───────────────────────────────────────────────────────

/**
 * Mixamo FBX "for Unity" exports position data in centimetres.
 * If any position track value > 10, scale all positions by 0.01.
 */
function normaliseScale(clip: THREE.AnimationClip): void {
  let maxPos = 0;
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.position')) continue;
    const arr = track.values as Float32Array;
    for (let i = 0; i < arr.length; i++) {
      const v = Math.abs(arr[i]);
      if (v > maxPos) maxPos = v;
    }
  }
  if (maxPos < 10) return;
  const inv = 1 / 100;
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.position')) continue;
    const arr = track.values as Float32Array;
    for (let i = 0; i < arr.length; i++) arr[i] *= inv;
  }
}

// ── Root-motion stripping ─────────────────────────────────────────────────────

/**
 * Remove the root pelvis bone's `.position` animation track.
 *
 * Mixamo clips bake the hip's world-space Y position (~1m) into the Hips track,
 * which after retargeting hoists the entire skeleton up by hip height every
 * frame, making the character float in the air above its physics body. Stripping
 * this track keeps the pelvis at its bind-pose offset (driven by the parent
 * group's transform = the cannon body sync), so the character stays grounded
 * and locomotion is driven purely by physics.
 *
 * Rotation tracks are kept intact so the character still animates correctly.
 */
function stripRootMotion(clip: THREE.AnimationClip, targetRig: TargetRig): void {
  const rootBone = targetRig === 'bip001' ? 'Bip001_Pelvis' : 'Hips';
  const rootPosTrack = `${rootBone}.position`;
  clip.tracks = clip.tracks.filter(t => t.name !== rootPosTrack);
}

// ── Public API ────────────────────────────────────────────────────────────────

export const MixamoRetargeter = {

  MIXAMO_TO_BIP001,
  MIXAMO_TO_UNITY,
  SYNTY_TO_BIP001,
  BIP001_MAP,
  MECANIM_MAP,
  SYNTY_BIP001_MAP,

  /** Retarget a single Synty Locomotion clip in place. */
  retargetSyntyClip(clip: THREE.AnimationClip, targetRig: TargetRig = 'bip001'): THREE.AnimationClip {
    const map = getSyntyMap(targetRig);
    for (const track of clip.tracks) track.name = remapTrackName(track.name, map);
    normaliseScale(clip);
    // Strip ALL position tracks — Synty FBX bakes per-bone world-space
    // positions (knees/ankles/spine) which, when bound onto a Bip001 skeleton
    // with different limb lengths, stretch joints to source positions
    // (the "100-foot legs" stretch artifact). Only quaternions transfer
    // cleanly across rigs; bone positions stay at the target's bind pose.
    clip.tracks = clip.tracks.filter(t => !t.name.endsWith('.position'));
    return clip;
  },

  /** Load a Synty FBX file and retarget all clips against the Synty source skeleton. */
  async loadSyntyFBXClips(
    url:       string,
    nameMap:   Record<string, string> = {},
    targetRig: TargetRig              = 'bip001',
  ): Promise<Record<string, THREE.AnimationClip>> {
    const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
    const loader = new FBXLoader();
    const obj    = await loader.loadAsync(url) as THREE.Group & { animations: THREE.AnimationClip[] };
    const result: Record<string, THREE.AnimationClip> = {};
    for (const clip of (obj.animations ?? [])) {
      const retargeted = this.retargetSyntyClip(clip.clone(), targetRig);
      const gameName   = nameMap[clip.name] ?? nameMap['*'] ?? clip.name;
      retargeted.name  = gameName;
      result[gameName] = retargeted;
    }
    console.log(`[SyntyRetargeter] FBX ${url} → ${targetRig}: ${Object.keys(result).length} clip(s) → [${Object.keys(result).join(', ')}]`);
    return result;
  },

  /** Load multiple Synty FBX files in parallel and merge the resulting clips. */
  async loadSyntyFBXBatch(
    files: Array<{ url: string; name: string }>,
    targetRig: TargetRig = 'bip001',
  ): Promise<Record<string, THREE.AnimationClip>> {
    const results = await Promise.allSettled(
      files.map(({ url, name }) => this.loadSyntyFBXClips(url, { '*': name }, targetRig)),
    );
    const merged: Record<string, THREE.AnimationClip> = {};
    for (const r of results) {
      if (r.status === 'fulfilled') Object.assign(merged, r.value);
      else console.warn('[SyntyRetargeter] batch entry failed:', r.reason);
    }
    return merged;
  },

  /**
   * Retarget a single AnimationClip in-place.
   *
   * @param clip       The clip to retarget (mutated in place).
   * @param targetRig  'bip001' (default) or 'mecanim'.
   */
  retargetClip(clip: THREE.AnimationClip, targetRig: TargetRig = 'bip001'): THREE.AnimationClip {
    const map = getMap(targetRig);
    for (const track of clip.tracks) {
      track.name = remapTrackName(track.name, map);
    }
    normaliseScale(clip);
    stripRootMotion(clip, targetRig);
    return clip;
  },

  /**
   * Retarget an array of clips, returning new (cloned + retargeted) clips.
   */
  retargetAll(clips: THREE.AnimationClip[], targetRig: TargetRig = 'bip001'): THREE.AnimationClip[] {
    return clips.map(c => this.retargetClip(c.clone(), targetRig));
  },

  /**
   * Load a Mixamo FBX file using Three.js FBXLoader, retarget all animation
   * clips, and return them keyed by name.
   *
   * @param url        URL of the .fbx file (must be served by the dev server).
   * @param nameMap    Optional: original clip name → game clip name override.
   * @param targetRig  'bip001' (default) or 'mecanim'.
   *
   * IMPORTANT: FBXLoader is a heavy dependency (~500 KB).  It is imported
   * dynamically so it doesn't bloat the initial bundle unless this function
   * is actually called.
   */
  async loadFBXClips(
    url:       string,
    nameMap:   Record<string, string> = {},
    targetRig: TargetRig              = 'bip001',
  ): Promise<Record<string, THREE.AnimationClip>> {
    const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
    const loader = new FBXLoader();
    const obj    = await loader.loadAsync(url) as THREE.Group & { animations: THREE.AnimationClip[] };

    const result: Record<string, THREE.AnimationClip> = {};
    for (const clip of (obj.animations ?? [])) {
      const retargeted = this.retargetClip(clip.clone(), targetRig);
      // FBX clips from Mixamo are typically named "mixamorig|idle" or just "Armature"
      // Use the original name, then override with nameMap if provided
      const originalName = clip.name;
      const gameName     = nameMap[originalName] ?? nameMap['*'] ?? originalName;
      retargeted.name    = gameName;
      result[gameName]   = retargeted;
    }

    const count = Object.keys(result).length;
    console.log(`[MixamoRetargeter] FBX ${url}: ${count} clip(s) → [${Object.keys(result).join(', ')}]`);
    return result;
  },

  /**
   * Load a Mixamo GLB (already in GLTF format, e.g. from fbx2gltf conversion),
   * retarget clips, and return them keyed by name.
   */
  async loadClips(
    url:       string,
    nameMap:   Record<string, string> = {},
    targetRig: TargetRig              = 'bip001',
  ): Promise<Record<string, THREE.AnimationClip>> {
    const loader = new GLTFLoader();
    const gltf   = await loader.loadAsync(url);

    const result: Record<string, THREE.AnimationClip> = {};
    for (const clip of gltf.animations) {
      const retargeted = this.retargetClip(clip.clone(), targetRig);
      const gameName   = nameMap[clip.name] ?? nameMap['*'] ?? clip.name;
      retargeted.name  = gameName;
      result[gameName] = retargeted;
    }

    const count = Object.keys(result).length;
    console.log(`[MixamoRetargeter] GLB ${url}: ${count} clip(s) → [${Object.keys(result).join(', ')}]`);
    return result;
  },

  /**
   * Load multiple Mixamo FBX files in parallel and merge their clips.
   *
   * @param files  Array of { url, name } entries.  `name` is the game clip name.
   *               Each FBX is expected to contain exactly one animation.
   * @param targetRig  'bip001' (default) or 'mecanim'.
   */
  async loadFBXBatch(
    files: Array<{ url: string; name: string }>,
    targetRig: TargetRig = 'bip001',
  ): Promise<Record<string, THREE.AnimationClip>> {
    const results = await Promise.allSettled(
      files.map(async ({ url, name }) => {
        const clips = await this.loadFBXClips(url, { '*': name }, targetRig);
        return clips;
      }),
    );

    const merged: Record<string, THREE.AnimationClip> = {};
    for (const r of results) {
      if (r.status === 'fulfilled') {
        Object.assign(merged, r.value);
      }
    }
    return merged;
  },

  // ── three-mixamo packed timeline helpers ─────────────────────────────────

  /**
   * Split a packed Mixamo timeline clip into a named subclip.
   * Core of the three-mixamo technique.
   */
  subclip(
    packedClip: THREE.AnimationClip,
    name:       string,
    startFrame: number,
    endFrame:   number,
    fps         = 30,
  ): THREE.AnimationClip {
    return THREE.AnimationUtils.subclip(packedClip, name, startFrame, endFrame, fps);
  },

  /**
   * Load a packed timeline GLB and split into named subclips.
   */
  async loadPackedTimeline(
    url:       string,
    ranges:    Array<{ name: string; start: number; end: number; fps?: number }>,
    targetRig: TargetRig = 'bip001',
  ): Promise<Record<string, THREE.AnimationClip>> {
    const loader = new GLTFLoader();
    const gltf   = await loader.loadAsync(url);
    if (!gltf.animations.length) return {};

    const packed = gltf.animations[0];
    this.retargetClip(packed, targetRig);

    const result: Record<string, THREE.AnimationClip> = {};
    for (const { name, start, end, fps = 30 } of ranges) {
      result[name] = this.subclip(packed, name, start, end, fps);
    }
    return result;
  },

  /** Detect whether a clip still has Mixamo-prefixed bone names. */
  needsRetargeting(clip: THREE.AnimationClip): boolean {
    return clip.tracks.some(t => t.name.startsWith('mixamorig'));
  },
};

export default MixamoRetargeter;
