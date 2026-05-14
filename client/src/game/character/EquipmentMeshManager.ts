/**
 * EquipmentMeshManager — TypeScript port of the Unity PlayerEquipment +
 * playground EquipmentManager.js.
 *
 * Mirrors Unity's RefreshLocation() workflow:
 *   1. Load a race's FBX/GLB model with all child meshes baked in.
 *   2. catalog() scans children, classifies them into equipment slots
 *      by regex-matching the mesh name after stripping the race prefix.
 *   3. equip(slot, variant) shows one variant, hides others in the slot.
 *   4. equipWeapon() auto-hides conflicting weapon slots (same hand).
 *   5. Color tinting mirrors Unity's SwitchableColor system.
 *
 * Also supports the GLB pipeline (external weapon attachment to bone
 * containers) used by the current RTS-Grudge characters — the two modes
 * coexist: prefix-toggled meshes for armor/baked weapons, external
 * attach for standalone weapon GLBs.
 */

import * as THREE from "three";
import {
  SLOT_DEFINITIONS,
  BONE_CONTAINERS,
  type RacePrefix,
  type EquipGroup,
  type SlotDefinition,
  type BoneContainerKey,
} from "./FactionCharacterRegistry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CatalogedMesh {
  mesh: THREE.Object3D;
  slot: string;
  variant: string;
  group: EquipGroup;
}

export interface SlotSummary {
  [slot: string]: string[];
}

export interface GroupedSlots {
  armor:   Record<string, { variants: string[]; equipped: string | null }>;
  weapons: Record<string, { variants: string[]; equipped: string | null }>;
  shields: Record<string, { variants: string[]; equipped: string | null }>;
  utility: Record<string, { variants: string[]; equipped: string | null }>;
}

export interface ColorTint {
  /** Material property name: '_Color' | '_EmissionColor' | THREE.Color prop */
  property: string;
  /** Hex number (0xff4400) or CSS string ('#ff4400') */
  color: number | string;
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------
export class EquipmentMeshManager {
  prefix: string;
  root: THREE.Object3D | null = null;

  /** slot → { variant → Object3D } */
  private slots: Map<string, Map<string, THREE.Object3D>> = new Map();
  /** Currently equipped: slot → variant */
  private equipped: Map<string, string> = new Map();
  /** Flat list of all cataloged meshes */
  private allMeshes: CatalogedMesh[] = [];
  /** Bone containers found in the skeleton */
  bones: Partial<Record<BoneContainerKey, THREE.Object3D>> = {};
  /** External weapon models attached to bone containers */
  private externalWeapons: Map<BoneContainerKey, THREE.Object3D> = new Map();

  constructor(prefix: RacePrefix | string = "") {
    this.prefix = prefix;
  }

  // -----------------------------------------------------------------------
  // Catalog
  // -----------------------------------------------------------------------

  /**
   * Scan the loaded model scene graph and classify child meshes into slots.
   * Call once after the model is loaded.
   *
   * @param root The loaded scene (FBX Group or GLB scene)
   * @returns Summary of discovered slots and their variants
   */
  catalog(root: THREE.Object3D): SlotSummary {
    this.root = root;
    this.slots.clear();
    this.equipped.clear();
    this.allMeshes = [];

    // Discover bone containers
    for (const [key, boneName] of Object.entries(BONE_CONTAINERS)) {
      const bone = root.getObjectByName(boneName) ?? null;
      if (bone) this.bones[key as BoneContainerKey] = bone;
    }

    // Traverse all children
    root.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh && !(child as THREE.SkinnedMesh).isSkinnedMesh) return;

      const name = child.name;
      // Strip the race prefix to get generic slot name
      const stripped = name.startsWith(this.prefix)
        ? name.slice(this.prefix.length)
        : name;

      for (const def of SLOT_DEFINITIONS) {
        const match = stripped.match(def.re);
        if (!match) continue;

        const variant = def.noVariant
          ? "_default"
          : (match[1] || match[2] || "_default").toUpperCase();

        if (!this.slots.has(def.slot)) {
          this.slots.set(def.slot, new Map());
        }
        this.slots.get(def.slot)!.set(variant, child);

        // Tag the mesh for later lookups
        child.userData.equipSlot = def.slot;
        child.userData.equipVariant = variant;
        child.userData.equipGroup = def.group;
        this.allMeshes.push({ mesh: child, slot: def.slot, variant, group: def.group });

        // Start hidden — autoEquipDefaults() will show the base set
        child.visible = false;
        break;
      }
    });

    this.autoEquipDefaults();
    return this.getSlotSummary();
  }

  /**
   * Auto-detect prefix from child mesh names if not provided.
   * Useful when loading a model without knowing its race.
   */
  autoDetectPrefix(root: THREE.Object3D): RacePrefix | null {
    const prefixes: RacePrefix[] = ["WK_", "BRB_", "ELF_", "DWF_", "ORC_", "UD_"];
    let found: RacePrefix | null = null;

    root.traverse((child) => {
      if (found) return;
      if (!(child as THREE.Mesh).isMesh && !(child as THREE.SkinnedMesh).isSkinnedMesh) return;
      for (const p of prefixes) {
        if (child.name.startsWith(p)) {
          found = p;
          return;
        }
      }
    });

    if (found) {
      this.prefix = found;
    }
    return found;
  }

  /** Show variant A of base armor slots so the character isn't invisible */
  private autoEquipDefaults() {
    for (const slot of ["body", "arms", "legs", "head"]) {
      const variants = this.slots.get(slot);
      if (!variants) continue;
      const keys = Array.from(variants.keys()).sort();
      if (keys[0]) this.equip(slot, keys[0]);
    }
  }

  // -----------------------------------------------------------------------
  // Equip / Unequip
  // -----------------------------------------------------------------------

  /**
   * Equip a specific variant of a slot (shows it, hides others in same slot).
   * Optionally override material and/or apply color tints.
   *
   * Mirrors Unity's PlayerEquipment.RefreshLocation().
   */
  equip(
    slot: string,
    variant: string,
    material: THREE.Material | null = null,
    colors: ColorTint[] | null = null,
  ): boolean {
    const variants = this.slots.get(slot);
    if (!variants) return false;

    for (const [v, mesh] of variants) {
      if (v === variant) {
        mesh.visible = true;
        // Material override
        if (material && (mesh as THREE.Mesh).isMesh) {
          const m = mesh as THREE.Mesh;
          if (!m.userData._defaultMaterial && m.material) {
            m.userData._defaultMaterial = m.material;
          }
          m.material = material;
        }
        // Color tints (SwitchableColor equivalent)
        if (colors?.length && (mesh as THREE.Mesh).isMesh) {
          this.applyColors(mesh as THREE.Mesh, colors);
        }
      } else {
        mesh.visible = false;
      }
    }
    this.equipped.set(slot, variant);
    return true;
  }

  /** Unequip a slot — hide all variants */
  unequip(slot: string) {
    const variants = this.slots.get(slot);
    if (!variants) return;
    for (const mesh of variants.values()) {
      mesh.visible = false;
    }
    this.equipped.delete(slot);
  }

  /** Toggle a slot variant on/off */
  toggle(slot: string, variant: string) {
    if (this.equipped.get(slot) === variant) {
      this.unequip(slot);
    } else {
      this.equip(slot, variant);
    }
  }

  /**
   * Equip a weapon by slot — auto-hides conflicting weapon slots
   * (right-hand weapons are mutually exclusive, same for left-hand).
   */
  equipWeapon(slot: string, variant: string = "_default"): boolean {
    const def = SLOT_DEFINITIONS.find(d => d.slot === slot);
    if (!def) return false;

    // Hide all same-group weapons first
    for (const entry of this.allMeshes) {
      if (entry.group === def.group) {
        entry.mesh.visible = false;
        this.equipped.delete(entry.slot);
      }
    }

    return this.equip(slot, variant);
  }

  /** Hide all weapons (right hand, left hand, shield) */
  unequipAllWeapons() {
    for (const entry of this.allMeshes) {
      if (["weapon_r", "weapon_l", "shield"].includes(entry.group)) {
        entry.mesh.visible = false;
      }
    }
    for (const s of ["axe", "hammer", "sword", "pick", "spear", "bow", "staff", "shield"]) {
      this.equipped.delete(s);
    }
  }

  // -----------------------------------------------------------------------
  // External weapon loading (GLB pipeline — bone container attachment)
  // -----------------------------------------------------------------------

  /**
   * Attach an externally loaded weapon model to a bone container.
   * Used by the GLB pipeline where weapons are separate models.
   *
   * @param model   The loaded weapon Object3D
   * @param boneKey Which bone container to attach to
   * @param opts    Scale/offset/rotation overrides
   */
  attachExternalWeapon(
    model: THREE.Object3D,
    boneKey: BoneContainerKey = "rightHand",
    opts: { scale?: number; offset?: THREE.Vector3; rotation?: THREE.Euler } = {},
  ): boolean {
    const bone = this.bones[boneKey];
    if (!bone) return false;

    // Remove previous external weapon on this bone
    const prev = this.externalWeapons.get(boneKey);
    if (prev) bone.remove(prev);

    if (opts.scale) model.scale.setScalar(opts.scale);
    if (opts.offset) model.position.copy(opts.offset);
    if (opts.rotation) model.rotation.copy(opts.rotation);

    model.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    bone.add(model);
    this.externalWeapons.set(boneKey, model);
    return true;
  }

  /** Remove an external weapon from a bone container */
  detachExternalWeapon(boneKey: BoneContainerKey) {
    const bone = this.bones[boneKey];
    const model = this.externalWeapons.get(boneKey);
    if (bone && model) {
      bone.remove(model);
      this.externalWeapons.delete(boneKey);
    }
  }

  /** Remove all external weapons */
  detachAllExternalWeapons() {
    for (const [key] of this.externalWeapons) {
      this.detachExternalWeapon(key);
    }
  }

  // -----------------------------------------------------------------------
  // Color tinting (mirrors Unity SwitchableColor)
  // -----------------------------------------------------------------------

  private applyColors(mesh: THREE.Mesh, colors: ColorTint[]) {
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!mat) return;
    const stdMat = mat as THREE.MeshStandardMaterial;

    for (const { property, color } of colors) {
      switch (property) {
        case "_Color":
          if (stdMat.color) stdMat.color.set(color as any);
          break;
        case "_EmissionColor":
          if (stdMat.emissive) {
            stdMat.emissive.set(color as any);
            stdMat.emissiveIntensity = 1;
          }
          break;
        default: {
          const prop = (stdMat as any)[property];
          if (prop?.isColor) prop.set(color as any);
          break;
        }
      }
      stdMat.needsUpdate = true;
    }
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get summary of all discovered slots and their variants */
  getSlotSummary(): SlotSummary {
    const summary: SlotSummary = {};
    for (const [slot, variants] of this.slots) {
      summary[slot] = Array.from(variants.keys()).sort();
    }
    return summary;
  }

  /** Get grouped slots for UI panel rendering */
  getGroupedSlots(): GroupedSlots {
    const groups: GroupedSlots = { armor: {}, weapons: {}, shields: {}, utility: {} };
    for (const [slot, variants] of this.slots) {
      const def = SLOT_DEFINITIONS.find(d => d.slot === slot);
      if (!def) continue;
      const groupKey = def.group === "weapon_r" || def.group === "weapon_l"
        ? "weapons" : def.group === "shield" ? "shields" : def.group === "armor" ? "armor" : "utility";
      groups[groupKey][slot] = {
        variants: Array.from(variants.keys()).sort(),
        equipped: this.equipped.get(slot) ?? null,
      };
    }
    return groups;
  }

  /** Check what's currently equipped in a slot */
  getEquipped(slot: string): string | null {
    return this.equipped.get(slot) ?? null;
  }

  /** Get all currently equipped slots */
  getAllEquipped(): Record<string, string> {
    return Object.fromEntries(this.equipped);
  }

  /** Is a specific slot equipped? */
  isSlotEquipped(slot: string): boolean {
    return this.equipped.has(slot);
  }

  /** Total count of cataloged equipment meshes */
  get meshCount(): number {
    return this.allMeshes.length;
  }

  /** Does this model have prefix-based equipment meshes? */
  get hasPrefixMeshes(): boolean {
    return this.allMeshes.length > 0;
  }

  // -----------------------------------------------------------------------
  // Debug / bulk ops
  // -----------------------------------------------------------------------

  /** Show all meshes (debug mode) */
  showAll() {
    for (const entry of this.allMeshes) {
      entry.mesh.visible = true;
    }
  }

  /** Hide all meshes */
  hideAll() {
    for (const entry of this.allMeshes) {
      entry.mesh.visible = false;
    }
  }

  /** Restore default material on all meshes */
  restoreAllMaterials() {
    for (const entry of this.allMeshes) {
      const mesh = entry.mesh as THREE.Mesh;
      if (mesh.isMesh && mesh.userData._defaultMaterial) {
        mesh.material = mesh.userData._defaultMaterial;
      }
    }
  }

  /** Cleanup — remove all external weapons and clear state */
  dispose() {
    this.detachAllExternalWeapons();
    this.slots.clear();
    this.equipped.clear();
    this.allMeshes = [];
    this.bones = {};
    this.root = null;
  }
}
