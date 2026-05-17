/**
 * CharacterSkeleton — Layer 1 of the Character Prefab system.
 *
 * Wraps EquipmentMeshManager for equipment slot toggling and adds:
 *   - Auto-bounds measurement from the skeleton for physics capsule sizing
 *   - Bone lookup for weapon/prop attachment
 *   - Shadow setup on all skinned meshes
 *
 * Non-React class — usable in any Three.js context (R3F, raw, editor).
 */

import * as THREE from "three";
import { EquipmentMeshManager } from "../../character/EquipmentMeshManager";
import { RACE_CONFIGS, type RacePrefix, type BoneContainerKey } from "../../character/FactionCharacterRegistry";
import type { SkeletonBounds, RaceId } from "./types";
import { DEFAULT_CAPSULE } from "./constants";

// Bone name aliases for cross-skeleton compatibility
const BONE_ALIASES: Record<string, string[]> = {
  rightHand: ["R_hand_container", "RightHand", "mixamorig:RightHand", "Bip01_R_Hand"],
  leftHand:  ["L_hand_container", "LeftHand", "mixamorig:LeftHand", "Bip01_L_Hand"],
  shield:    ["L_shield_container", "LeftForeArm", "mixamorig:LeftForeArm"],
  head:      ["Bip001 Head", "Head", "mixamorig:Head"],
  spine:     ["Bip001 Spine", "Spine2", "mixamorig:Spine2"],
  hips:      ["Bip001 Pelvis", "Hips", "mixamorig:Hips"],
};

export class CharacterSkeleton {
  /** The loaded model root (FBX Group or GLB scene). */
  model: THREE.Group;
  /** The Three.js Skeleton extracted from the first SkinnedMesh. */
  skeleton: THREE.Skeleton | null = null;
  /** Equipment slot manager. */
  equipment: EquipmentMeshManager;
  /** Auto-measured bounding dimensions for the physics capsule. */
  bounds: SkeletonBounds;
  /** Race ID this skeleton was built for. */
  raceId: RaceId;

  private constructor(model: THREE.Group, raceId: RaceId, prefix: string) {
    this.model = model;
    this.raceId = raceId;
    this.equipment = new EquipmentMeshManager(prefix as RacePrefix);
    this.bounds = { height: DEFAULT_CAPSULE.height, radiusXZ: DEFAULT_CAPSULE.radius };
  }

  /**
   * Create a CharacterSkeleton from an already-loaded Three.js scene.
   * The model should be a cloned instance (not the shared cached original).
   */
  static fromLoadedModel(model: THREE.Group, raceId: RaceId): CharacterSkeleton {
    const config = RACE_CONFIGS[raceId];
    const prefix = config?.prefix ?? "";

    const skeleton = new CharacterSkeleton(model, raceId, prefix);

    // Extract the Three.js Skeleton from the first SkinnedMesh
    model.traverse((child) => {
      if (!skeleton.skeleton && (child as THREE.SkinnedMesh).isSkinnedMesh) {
        skeleton.skeleton = (child as THREE.SkinnedMesh).skeleton;
      }
    });

    // Catalog equipment meshes (auto-detects prefix if needed)
    if (prefix) {
      skeleton.equipment.catalog(model);
    } else {
      skeleton.equipment.autoDetectPrefix(model);
      skeleton.equipment.catalog(model);
    }

    // Measure bounds from the skeleton
    skeleton.bounds = skeleton.measureBounds();

    // Enable shadows on all meshes
    skeleton.setupShadows();

    return skeleton;
  }

  // -----------------------------------------------------------------------
  // Bounds measurement
  // -----------------------------------------------------------------------

  /**
   * Auto-measure character bounds from the skeleton bone positions.
   * Uses the Bip001 hierarchy to compute height and XZ radius.
   * Falls back to bounding box if skeleton is unavailable.
   */
  private measureBounds(): SkeletonBounds {
    if (this.skeleton && this.skeleton.bones.length > 0) {
      return this.measureFromSkeleton();
    }
    return this.measureFromBoundingBox();
  }

  private measureFromSkeleton(): SkeletonBounds {
    const bones = this.skeleton!.bones;

    // Compute world positions of all bones
    this.model.updateMatrixWorld(true);
    const positions = bones.map((bone) => {
      const pos = new THREE.Vector3();
      bone.getWorldPosition(pos);
      return pos;
    });

    // Height = max Y - min Y
    let minY = Infinity, maxY = -Infinity;
    let maxXZ = 0;
    for (const pos of positions) {
      if (pos.y < minY) minY = pos.y;
      if (pos.y > maxY) maxY = pos.y;
      const xz = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
      if (xz > maxXZ) maxXZ = xz;
    }

    const height = Math.max(0.5, maxY - minY);
    // XZ radius = max XZ extent + margin, clamped to reasonable range
    const radiusXZ = THREE.MathUtils.clamp(maxXZ + 0.1, 0.15, 0.6);

    return { height, radiusXZ };
  }

  private measureFromBoundingBox(): SkeletonBounds {
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());

    const height = Math.max(0.5, size.y);
    const radiusXZ = THREE.MathUtils.clamp(Math.max(size.x, size.z) / 2, 0.15, 0.6);

    return { height, radiusXZ };
  }

  // -----------------------------------------------------------------------
  // Bone lookup
  // -----------------------------------------------------------------------

  /**
   * Find a bone by slot name or direct bone name.
   * Searches through aliases for cross-skeleton compatibility.
   */
  findBone(slotOrName: string): THREE.Bone | THREE.Object3D | null {
    const aliases = BONE_ALIASES[slotOrName];
    const names = aliases ? aliases : [slotOrName];

    // Try skeleton bones first
    if (this.skeleton) {
      for (const name of names) {
        const bone = this.skeleton.bones.find((b) => b.name === name);
        if (bone) return bone;
      }
      // Fuzzy match
      for (const name of names) {
        const lower = name.toLowerCase();
        const bone = this.skeleton.bones.find((b) => b.name.toLowerCase().includes(lower));
        if (bone) return bone;
      }
    }

    // Fallback: scene graph traversal
    let found: THREE.Object3D | null = null;
    this.model.traverse((child) => {
      if (found) return;
      for (const name of names) {
        if (child.name === name || child.name.toLowerCase().includes(name.toLowerCase())) {
          found = child;
          return;
        }
      }
    });
    return found;
  }

  /**
   * Attach an object to a bone slot.
   */
  attachToBone(
    object: THREE.Object3D,
    slot: string,
    offset?: { position?: THREE.Vector3; rotation?: THREE.Euler; scale?: THREE.Vector3 },
  ): boolean {
    const bone = this.findBone(slot);
    if (!bone) return false;

    if (offset?.position) object.position.copy(offset.position);
    if (offset?.rotation) object.rotation.copy(offset.rotation);
    if (offset?.scale) object.scale.copy(offset.scale);

    bone.add(object);
    return true;
  }

  /**
   * List all bone names in the skeleton (for debugging).
   */
  listBoneNames(): string[] {
    if (!this.skeleton) return [];
    return this.skeleton.bones.map((b) => b.name);
  }

  // -----------------------------------------------------------------------
  // Shadows
  // -----------------------------------------------------------------------

  private setupShadows() {
    this.model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh || (child as THREE.SkinnedMesh).isSkinnedMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  dispose() {
    this.equipment.dispose();
    this.skeleton = null;
  }
}
