import * as THREE from "three";
import { useCampaign } from "@/lib/stores/useCampaign";

export interface BuildableItem {
  id: string;
  name: string;
  category: "structure" | "defense" | "utility" | "production" | "decoration";
  cost: { wood: number; stone: number; gold: number; ore?: number };
  size: [number, number, number];
  snapToGrid: boolean;
  gridSize: number;
  maxHealth: number;
  colliderType: "box" | "mesh" | "none";
  prefabId?: string;
  unlockRequirement?: string;
}

export interface PlacedStructure {
  uid: string;
  buildableId: string;
  position: [number, number, number];
  rotation: number;
  health: number;
  maxHealth: number;
  builtAt: number;
  islandId: string;
}

export interface BuildConfig {
  maxBuildDistance: number;
  snapGridSize: number;
  rotationSnap: number;
  maxStructuresPerIsland: number;
  repairCostMultiplier: number;
}

const DEFAULT_BUILD_CONFIG: BuildConfig = {
  maxBuildDistance: 20,
  snapGridSize: 1,
  rotationSnap: Math.PI / 4,
  maxStructuresPerIsland: 200,
  repairCostMultiplier: 0.25,
};

export class BuildController {
  config: BuildConfig;
  ghostPosition = new THREE.Vector3();
  ghostRotation = 0;
  selectedBuildable: BuildableItem | null = null;
  placedStructures: PlacedStructure[] = [];
  isPlacing = false;

  constructor(config?: Partial<BuildConfig>) {
    this.config = { ...DEFAULT_BUILD_CONFIG, ...config };
  }

  selectBuildable(item: BuildableItem | null): void {
    this.selectedBuildable = item;
    this.isPlacing = item !== null;
  }

  updateGhostPosition(hitPoint: THREE.Vector3, terrainNormal?: THREE.Vector3): void {
    if (!this.selectedBuildable) return;

    if (this.selectedBuildable.snapToGrid) {
      const gs = this.selectedBuildable.gridSize || this.config.snapGridSize;
      this.ghostPosition.set(
        Math.round(hitPoint.x / gs) * gs,
        hitPoint.y,
        Math.round(hitPoint.z / gs) * gs
      );
    } else {
      this.ghostPosition.copy(hitPoint);
    }
  }

  rotateGhost(direction: number = 1): void {
    this.ghostRotation += this.config.rotationSnap * direction;
  }

  canAfford(item: BuildableItem, resources: { wood: number; stone: number; gold: number; ore?: number }): boolean {
    return (
      resources.wood >= item.cost.wood &&
      resources.stone >= item.cost.stone &&
      resources.gold >= item.cost.gold &&
      (!item.cost.ore || (resources.ore ?? 0) >= item.cost.ore)
    );
  }

  isUnlocked(item: BuildableItem): boolean {
    if (!item.unlockRequirement) return true;
    return useCampaign.getState().unlockedBuildings.has(item.unlockRequirement);
  }

  canPlaceAt(position: THREE.Vector3, playerPos: THREE.Vector3): { valid: boolean; reason?: string } {
    const dist = position.distanceTo(playerPos);
    if (dist > this.config.maxBuildDistance) {
      return { valid: false, reason: "Too far away" };
    }

    const islandId = useCampaign.getState().currentIslandId;
    const count = this.placedStructures.filter(s => s.islandId === islandId).length;
    if (count >= this.config.maxStructuresPerIsland) {
      return { valid: false, reason: "Max structures reached" };
    }

    for (const existing of this.placedStructures) {
      const ex = new THREE.Vector3(existing.position[0], existing.position[1], existing.position[2]);
      if (ex.distanceTo(position) < 0.5) {
        return { valid: false, reason: "Overlapping structure" };
      }
    }

    return { valid: true };
  }

  place(playerPos: THREE.Vector3, resources?: { wood: number; stone: number; gold: number; ore?: number }): PlacedStructure | null {
    if (!this.selectedBuildable || !this.isPlacing) return null;

    const check = this.canPlaceAt(this.ghostPosition, playerPos);
    if (!check.valid) return null;

    if (resources && !this.canAfford(this.selectedBuildable, resources)) return null;

    if (!this.isUnlocked(this.selectedBuildable)) return null;

    const structure: PlacedStructure = {
      uid: `bld_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      buildableId: this.selectedBuildable.id,
      position: [this.ghostPosition.x, this.ghostPosition.y, this.ghostPosition.z],
      rotation: this.ghostRotation,
      health: this.selectedBuildable.maxHealth,
      maxHealth: this.selectedBuildable.maxHealth,
      builtAt: Date.now(),
      islandId: useCampaign.getState().currentIslandId,
    };

    this.placedStructures.push(structure);
    return structure;
  }

  removeStructure(uid: string): void {
    this.placedStructures = this.placedStructures.filter(s => s.uid !== uid);
  }

  damageStructure(uid: string, amount: number): boolean {
    const structure = this.placedStructures.find(s => s.uid === uid);
    if (!structure) return false;

    structure.health = Math.max(0, structure.health - amount);
    if (structure.health <= 0) {
      this.removeStructure(uid);
      return true;
    }
    return false;
  }

  repairStructure(uid: string): number {
    const structure = this.placedStructures.find(s => s.uid === uid);
    if (!structure || structure.health >= structure.maxHealth) return 0;

    const repairAmount = structure.maxHealth - structure.health;
    structure.health = structure.maxHealth;
    return repairAmount;
  }

  getStructuresOnIsland(islandId: string): PlacedStructure[] {
    return this.placedStructures.filter(s => s.islandId === islandId);
  }

  cancelPlacement(): void {
    this.isPlacing = false;
    this.selectedBuildable = null;
    this.ghostRotation = 0;
  }

  reset(): void {
    this.placedStructures = [];
    this.cancelPlacement();
  }
}

export const buildController = new BuildController();
