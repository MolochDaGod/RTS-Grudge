/**
 * useRaceEquipment — React hook that bridges the EquipmentMeshManager
 * (3D mesh toggle system from uMMORPG) with the useEquipment Zustand store.
 *
 * When the player equips/unequips items via the store, this hook
 * translates those changes into EquipmentMeshManager.equip/unequip calls
 * so the character model's child meshes update in real-time.
 *
 * Usage in Player.tsx or CharacterSelectScreen:
 *   const equipManager = useRaceEquipment(scene, racePrefix);
 *   // equipManager auto-syncs with useEquipment store
 */

import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { useEquipment, type EquipSlot } from "@/lib/stores/useEquipment";
import { EquipmentMeshManager } from "./EquipmentMeshManager";
import { getRaceForModelPath, type RacePrefix } from "./FactionCharacterRegistry";

// Maps useEquipment slot names to EquipmentMeshManager slot names
const STORE_TO_MESH_SLOT: Partial<Record<EquipSlot, string>> = {
  helm:     "head",
  shoulder: "shoulders",
  chest:    "body",
  legs:     "legs",
  boots:    "legs",      // boots share the legs mesh slot
  belt:     "body",      // belt is part of body mesh
  mainHand: "sword",     // default; overridden by weaponType
  offHand:  "shield",
  gloves:   "arms",
  cape:     "body",      // cape is part of body mesh
};

// Maps weapon types to EquipmentMeshManager weapon slots
const WEAPON_TO_MESH_SLOT: Record<string, string> = {
  sword: "sword", greatsword: "sword", axe: "axe", hammer: "hammer",
  mace: "hammer", dagger: "sword", poleaxe: "spear", spear: "spear",
  bow: "bow", crossbow: "bow", gun: "bow",
  staff: "staff", wand: "staff", tome: "staff", relic: "staff",
  shield: "shield",
};

export interface UseRaceEquipmentResult {
  /** The underlying mesh manager instance */
  manager: EquipmentMeshManager | null;
  /** Whether the model has prefix-based equipment meshes */
  hasMeshEquipment: boolean;
  /** Summary of discovered slots */
  slotSummary: Record<string, string[]>;
}

/**
 * Hook that creates an EquipmentMeshManager for a character scene
 * and syncs it with the useEquipment store.
 *
 * @param scene      The loaded character Three.js scene (from useCharacterModel)
 * @param modelPath  The character's model path (used to detect race prefix)
 */
export function useRaceEquipment(
  scene: THREE.Group | null,
  modelPath: string,
): UseRaceEquipmentResult {
  const managerRef = useRef<EquipmentMeshManager | null>(null);
  const prevEquipped = useRef<Partial<Record<EquipSlot, string>>>({});

  // Detect race config from model path
  const raceConfig = useMemo(() => getRaceForModelPath(modelPath), [modelPath]);
  const prefix = raceConfig?.prefix ?? "";

  // Create/rebuild manager when scene changes
  useEffect(() => {
    if (!scene) {
      managerRef.current = null;
      return;
    }

    const manager = new EquipmentMeshManager(prefix);

    // Try to auto-detect prefix if not known
    if (!prefix) {
      manager.autoDetectPrefix(scene);
    }

    const summary = manager.catalog(scene);
    managerRef.current = manager;

    // If the model has no prefix meshes (GLB pipeline), skip store sync
    if (!manager.hasPrefixMeshes) {
      return;
    }

    // Initial sync: apply current store state to mesh manager
    const equipped = useEquipment.getState().equipped;
    syncEquipmentToMesh(manager, equipped);

    return () => {
      manager.dispose();
      managerRef.current = null;
    };
  }, [scene, prefix]);

  // Subscribe to equipment changes
  useEffect(() => {
    if (!managerRef.current?.hasPrefixMeshes) return;

    const unsub = useEquipment.subscribe(
      (state) => state.equipped,
      (equipped) => {
        const manager = managerRef.current;
        if (!manager) return;
        syncEquipmentToMesh(manager, equipped);
      },
    );

    return unsub;
  }, [scene]);

  return {
    manager: managerRef.current,
    hasMeshEquipment: managerRef.current?.hasPrefixMeshes ?? false,
    slotSummary: managerRef.current?.getSlotSummary() ?? {},
  };
}

/**
 * Sync the useEquipment store state to the mesh manager.
 * Called on initial mount and on every store change.
 */
function syncEquipmentToMesh(
  manager: EquipmentMeshManager,
  equipped: Partial<Record<EquipSlot, any>>,
): void {
  // For each equip slot, determine the mesh slot and variant
  for (const [storeSlot, item] of Object.entries(equipped)) {
    if (!item) continue;
    const slot = storeSlot as EquipSlot;

    // Weapon slots use the weapon type to determine which mesh to show
    if (slot === "mainHand" && item.weaponType) {
      const meshSlot = WEAPON_TO_MESH_SLOT[item.weaponType];
      if (meshSlot) {
        manager.equipWeapon(meshSlot, "A"); // default to variant A
      }
    } else if (slot === "offHand") {
      if (item.weaponType === "shield") {
        manager.equip("shield", "A");
      }
    } else {
      // Armor/accessory slots
      const meshSlot = STORE_TO_MESH_SLOT[slot];
      if (meshSlot) {
        // Determine variant from tier (A=T1-T2, B=T3-T4, C=T5-T6, D=T7-T8)
        const tier = item.tier ?? 1;
        const variant = tier <= 2 ? "A" : tier <= 4 ? "B" : tier <= 6 ? "C" : "D";
        manager.equip(meshSlot, variant);
      }
    }
  }

  // Unequip slots that were previously equipped but now empty
  const allSlots: EquipSlot[] = ["helm", "shoulder", "chest", "legs", "boots", "belt", "mainHand", "offHand", "gloves", "cape"];
  for (const slot of allSlots) {
    if (!equipped[slot]) {
      const meshSlot = STORE_TO_MESH_SLOT[slot];
      if (meshSlot && slot !== "mainHand") {
        // Don't unequip body/legs defaults — those should always show
        if (meshSlot !== "body" && meshSlot !== "legs") {
          manager.unequip(meshSlot);
        }
      }
      if (slot === "mainHand") {
        manager.unequipAllWeapons();
      }
    }
  }
}
