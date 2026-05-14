import * as THREE from "three";
import { useSurvival } from "@/lib/stores/useSurvival";

export type ResourceType = "wood" | "stone" | "ore" | "fiber" | "herb" | "crystal" | "food";

export interface HarvestNode {
  id: string;
  type: ResourceType;
  position: THREE.Vector3;
  maxYield: number;
  currentYield: number;
  harvestTime: number;
  respawnTime: number;
  toolRequired: ToolType | null;
  depleted: boolean;
  lastHarvestedAt: number;
  tier: number;
}

export type ToolType = "axe" | "pickaxe" | "sickle" | "fishingRod" | "hammer";

export interface ToolData {
  type: ToolType;
  tier: number;
  efficiency: number;
  durability: number;
  maxDurability: number;
}

export interface HarvestConfig {
  baseHarvestTime: number;
  interactRange: number;
  autoHarvestRange: number;
  staminaCostPerSwing: number;
  respawnMultiplier: number;
  yieldBonusPerTier: number;
}

const DEFAULT_HARVEST_CONFIG: HarvestConfig = {
  baseHarvestTime: 2.0,
  interactRange: 3.5,
  autoHarvestRange: 1.5,
  staminaCostPerSwing: 8,
  respawnMultiplier: 1.0,
  yieldBonusPerTier: 0.25,
};

const RESOURCE_XP: Record<ResourceType, number> = {
  wood: 5,
  stone: 8,
  ore: 12,
  fiber: 3,
  herb: 6,
  crystal: 15,
  food: 4,
};

const TOOL_REQUIREMENTS: Record<ResourceType, ToolType | null> = {
  wood: "axe",
  stone: "pickaxe",
  ore: "pickaxe",
  fiber: "sickle",
  herb: null,
  crystal: "pickaxe",
  food: null,
};

export class HarvestController {
  config: HarvestConfig;
  nodes: HarvestNode[] = [];
  activeNode: HarvestNode | null = null;
  harvestProgress = 0;
  isHarvesting = false;
  equippedTool: ToolData | null = null;
  harvestAnimation: string | null = null;

  constructor(config?: Partial<HarvestConfig>) {
    this.config = { ...DEFAULT_HARVEST_CONFIG, ...config };
  }

  registerNode(node: HarvestNode): void {
    const existing = this.nodes.find(n => n.id === node.id);
    if (!existing) {
      this.nodes.push(node);
    }
  }

  removeNode(nodeId: string): void {
    this.nodes = this.nodes.filter(n => n.id !== nodeId);
    if (this.activeNode?.id === nodeId) {
      this.cancelHarvest();
    }
  }

  findNearestNode(playerPos: THREE.Vector3): HarvestNode | null {
    let nearest: HarvestNode | null = null;
    let nearestDist = this.config.interactRange;

    for (const node of this.nodes) {
      if (node.depleted) continue;
      const dist = playerPos.distanceTo(node.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = node;
      }
    }

    return nearest;
  }

  canHarvest(node: HarvestNode): { can: boolean; reason?: string } {
    if (node.depleted) return { can: false, reason: "Depleted" };
    if (node.currentYield <= 0) return { can: false, reason: "Empty" };

    const survival = useSurvival.getState();
    if (survival.stamina < this.config.staminaCostPerSwing) {
      return { can: false, reason: "Not enough stamina" };
    }

    if (node.toolRequired && (!this.equippedTool || this.equippedTool.type !== node.toolRequired)) {
      return { can: false, reason: `Requires ${node.toolRequired}` };
    }

    return { can: true };
  }

  startHarvest(node: HarvestNode): boolean {
    const check = this.canHarvest(node);
    if (!check.can) return false;

    this.activeNode = node;
    this.isHarvesting = true;
    this.harvestProgress = 0;

    this.harvestAnimation = node.toolRequired === "axe" ? "chop"
      : node.toolRequired === "pickaxe" ? "mine"
      : "gather";

    return true;
  }

  update(delta: number): { completed: boolean; yield?: ResourceType; amount?: number; xp?: number } | null {
    if (!this.isHarvesting || !this.activeNode) return null;

    const harvestTime = this.getEffectiveHarvestTime();
    this.harvestProgress += delta;

    if (this.harvestProgress >= harvestTime) {
      const node = this.activeNode;

      const survival = useSurvival.getState();
      if (!survival.useStamina(this.config.staminaCostPerSwing)) {
        this.cancelHarvest();
        return null;
      }

      const baseAmount = 1;
      const toolBonus = this.equippedTool ? this.equippedTool.efficiency : 1;
      const tierBonus = 1 + node.tier * this.config.yieldBonusPerTier;
      const amount = Math.ceil(baseAmount * toolBonus * tierBonus);

      node.currentYield = Math.max(0, node.currentYield - amount);
      if (node.currentYield <= 0) {
        node.depleted = true;
        node.lastHarvestedAt = Date.now();
      }

      if (this.equippedTool) {
        this.equippedTool.durability = Math.max(0, this.equippedTool.durability - 1);
        if (this.equippedTool.durability <= 0) {
          this.equippedTool = null;
        }
      }

      const xp = RESOURCE_XP[node.type] * amount;

      this.harvestProgress = 0;

      if (node.depleted) {
        this.cancelHarvest();
      }

      return { completed: true, yield: node.type, amount, xp };
    }

    return null;
  }

  getEffectiveHarvestTime(): number {
    if (!this.activeNode) return this.config.baseHarvestTime;

    let time = this.activeNode.harvestTime || this.config.baseHarvestTime;
    if (this.equippedTool) {
      time *= Math.max(0.3, 1 / this.equippedTool.efficiency);
    }
    return time;
  }

  cancelHarvest(): void {
    this.isHarvesting = false;
    this.activeNode = null;
    this.harvestProgress = 0;
    this.harvestAnimation = null;
  }

  equipTool(tool: ToolData | null): void {
    this.equippedTool = tool;
  }

  tryRespawnNodes(now: number): void {
    for (const node of this.nodes) {
      if (!node.depleted) continue;

      const elapsed = (now - node.lastHarvestedAt) / 1000;
      const respawnTime = node.respawnTime * this.config.respawnMultiplier;
      if (elapsed >= respawnTime) {
        node.depleted = false;
        node.currentYield = node.maxYield;
      }
    }
  }

  getNodesInRange(playerPos: THREE.Vector3, range: number): HarvestNode[] {
    return this.nodes.filter(n => !n.depleted && playerPos.distanceTo(n.position) <= range);
  }

  getHarvestPercent(): number {
    if (!this.isHarvesting || !this.activeNode) return 0;
    return Math.min(1, this.harvestProgress / this.getEffectiveHarvestTime());
  }

  reset(): void {
    this.nodes = [];
    this.cancelHarvest();
    this.equippedTool = null;
  }
}

export const harvestController = new HarvestController();
