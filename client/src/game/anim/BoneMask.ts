import * as THREE from "three";
import { detectBodyParts, type BodyPartBones } from "../systems/BoneAliases";

export type BoneGroup =
  | "all"
  | "upperBody"
  | "lowerBody"
  | "rightArm"
  | "leftArm"
  | "head"
  | "spine";

/**
 * Builds bone-name sets per semantic group from a skeleton, and produces
 * masked variants of clips that only retain tracks for bones in the chosen
 * group. Used by CharacterAnimator's combat layer to overlay an upper-body
 * punch / hit on top of a running locomotion animation.
 */
export class BoneMask {
  private parts: BodyPartBones;
  private groupCache = new Map<BoneGroup, Set<string>>();

  constructor(scene: THREE.Object3D) {
    const boneNames: string[] = [];
    scene.traverse((n) => {
      if ((n as THREE.Bone).isBone || n.type === "Bone") boneNames.push(n.name);
    });
    if (boneNames.length === 0) {
      // Fallback: scan all named nodes (some rigs don't tag bones with isBone).
      scene.traverse((n) => { if (n.name) boneNames.push(n.name); });
    }
    this.parts = detectBodyParts(boneNames);
  }

  getBoneNames(group: BoneGroup): Set<string> {
    let cached = this.groupCache.get(group);
    if (cached) return cached;

    const out = new Set<string>();
    const p = this.parts;
    const add = (arr: string[]) => { for (const n of arr) out.add(n); };

    switch (group) {
      case "all": {
        add(p.spine); add(p.upperSpine); add(p.neck); add(p.arms);
        add(p.upperArms); add(p.forearms); add(p.hands); add(p.legs);
        add(p.calves); add(p.feet); add(p.head); add(p.hips);
        if (p.root) out.add(p.root);
        break;
      }
      case "upperBody": {
        add(p.spine); add(p.upperSpine); add(p.neck); add(p.head);
        add(p.arms); add(p.upperArms); add(p.forearms); add(p.hands);
        break;
      }
      case "lowerBody": {
        add(p.legs); add(p.calves); add(p.feet); add(p.hips);
        if (p.root) out.add(p.root);
        break;
      }
      case "spine": {
        add(p.spine); add(p.upperSpine); add(p.neck); add(p.hips);
        break;
      }
      case "head": {
        add(p.head); add(p.neck);
        break;
      }
      case "rightArm": {
        for (const n of [...p.arms, ...p.upperArms, ...p.forearms, ...p.hands]) {
          const lower = n.toLowerCase();
          if (lower.includes(".r") || lower.includes("_r") || lower.endsWith("r") ||
              lower.includes("right")) out.add(n);
        }
        break;
      }
      case "leftArm": {
        for (const n of [...p.arms, ...p.upperArms, ...p.forearms, ...p.hands]) {
          const lower = n.toLowerCase();
          if (lower.includes(".l") || lower.includes("_l") || lower.endsWith("l") ||
              lower.includes("left")) out.add(n);
        }
        break;
      }
    }

    this.groupCache.set(group, out);
    return out;
  }

  /**
   * Clone a clip and keep ONLY tracks that belong to bones in `group`.
   * Pass `invert: true` to keep tracks NOT in the group (e.g. lower-body
   * stripped from a combat clip so locomotion drives the legs).
   */
  maskClip(clip: THREE.AnimationClip, group: BoneGroup, invert = false): THREE.AnimationClip {
    if (group === "all" && !invert) return clip.clone();

    const allowed = this.getBoneNames(group);
    const tracks: THREE.KeyframeTrack[] = [];
    for (const track of clip.tracks) {
      const dot = track.name.lastIndexOf(".");
      if (dot === -1) continue;
      const boneName = track.name.substring(0, dot);
      const inGroup = allowed.has(boneName);
      const keep = invert ? !inGroup : inGroup;
      if (keep) tracks.push(track.clone());
    }
    const masked = new THREE.AnimationClip(clip.name + `_mask_${group}${invert ? "_inv" : ""}`, clip.duration, tracks);
    return masked;
  }

  get bodyParts(): BodyPartBones {
    return this.parts;
  }
}
