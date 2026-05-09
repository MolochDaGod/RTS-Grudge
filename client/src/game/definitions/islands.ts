/**
 * Grudge Warlords — Island & Resource System
 *
 * Canonical T1-T8 resource tiers aligned with info.grudge-studio.com
 * profession trees. All resource names match the Miner, Forester, Chef,
 * Engineer, and Mystic gathering branches exactly.
 */

import { generateGrudgeUuid } from './grudgeUuid';

// ── Tier System (T1-T8) ────────────────────────────────────────────────────

export type ResourceTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const TIER_NAMES: Record<ResourceTier, string> = {
  1: 'Common',
  2: 'Uncommon',
  3: 'Rare',
  4: 'Epic',
  5: 'Legendary',
  6: 'Mythic',
  7: 'Ancient',
  8: 'Artifact',
};

export const TIER_COLORS: Record<ResourceTier, string> = {
  1: '#9ca3af',
  2: '#22c55e',
  3: '#3b82f6',
  4: '#a855f7',
  5: '#f97316',
  6: '#ef4444',
  7: '#06b6d4',
  8: '#fbbf24',
};

export const TIER_YIELD_MULTIPLIERS: Record<ResourceTier, number> = {
  1: 1.0, 2: 1.5, 3: 2.0, 4: 3.0, 5: 4.0, 6: 5.0, 7: 7.0, 8: 10.0,
};

// ── Canonical GW Resource Types per Node ────────────────────────────────────
// Source: info.grudge-studio.com/profession-trees.html

export const NODE_TYPES = {
  ore: {
    id: 'ore', name: 'Ore Vein', baseYield: 5, respawnTime: 120,
    /** Miner gathering tree: Copper → Divine Ore */
    resourceTypes: ['copperOre', 'ironOre', 'steelOre', 'mithrilOre', 'adamantineOre', 'orichalcumOre', 'starmetalOre', 'divineOre'],
  },
  tree: {
    id: 'tree', name: 'Tree', baseYield: 8, respawnTime: 90,
    /** Forester gathering tree: Pine → Worldtree */
    resourceTypes: ['pineLog', 'oakLog', 'mapleLog', 'ashLog', 'ironwoodLog', 'ebonyLog', 'wyrmwoodLog', 'worldtreeLog'],
  },
  herb: {
    id: 'herb', name: 'Herb Patch', baseYield: 3, respawnTime: 60,
    /** Mystic + Chef herb gathering */
    resourceTypes: ['healingHerb', 'spiceHerb', 'mageroyal', 'fadeleaf', 'dreamfoil', 'ghostMoss', 'primordialRoot', 'divineBloom'],
  },
  fish: {
    id: 'fish', name: 'Fishing Spot', baseYield: 4, respawnTime: 45,
    /** Forester + Chef fishing tree: Salmon → Kraken */
    resourceTypes: ['salmon', 'trout', 'swordfish', 'lobster', 'shark', 'leviathan', 'seaDragon', 'kraken'],
  },
  hide: {
    id: 'hide', name: 'Beast Den', baseYield: 2, respawnTime: 180,
    /** Forester skinning tree: Rawhide → Divine hide */
    resourceTypes: ['rawhideLeather', 'tannedLeather', 'thickHide', 'scaleHide', 'dragonHide', 'wyrmHide', 'ancientHide', 'divineHide'],
  },
  scrap: {
    id: 'scrap', name: 'Salvage Pile', baseYield: 3, respawnTime: 150,
    /** Engineer salvaging tree */
    resourceTypes: ['ironScrap', 'steelScrap', 'mithrilScrap', 'adamantineScrap', 'orichalcumScrap', 'starmetalScrap', 'voidScrap', 'eternalScrap'],
  },
  essence: {
    id: 'essence', name: 'Essence Node', baseYield: 2, respawnTime: 200,
    /** Mystic essence extraction */
    resourceTypes: ['lesserEssence', 'minorEssence', 'greaterEssence', 'superiorEssence', 'brilliantEssence', 'mythicEssence', 'ancientEssence', 'radiantEssence'],
  },
  forage: {
    id: 'forage', name: 'Forage Spot', baseYield: 4, respawnTime: 40,
    /** Chef foraging tree: Fruit → Golden Wheat */
    resourceTypes: ['wildFruit', 'grain', 'mushroom', 'spice', 'honey', 'rareRoot', 'mysticFruit', 'goldenWheat'],
  },
} as const;

export type NodeTypeId = keyof typeof NODE_TYPES;

// ── Resource Node ───────────────────────────────────────────────────────────

export interface ResourceNode {
  id: string;
  nodeType: NodeTypeId;
  tier: ResourceTier;
  resourceType: string;
  baseYield: number;
  respawnTime: number;
  x: number;
  y: number;
  currentYield: number;
  lastHarvested: number;
}

// ── Island Building ─────────────────────────────────────────────────────────

export interface IslandBuilding {
  id: string;
  buildingType: string;
  level: number;
  x: number;
  y: number;
  isConstructing: boolean;
  constructionEndTime: number;
}

// ── Island ──────────────────────────────────────────────────────────────────

export interface Island {
  id: string;
  ownerId: string;
  name: string;
  gridX: number;
  gridY: number;
  biome: string;
  nodes: ResourceNode[];
  buildings: IslandBuilding[];
  assignedHeroes: string[];
  discoveredAt: number;
}

// ── Biomes ──────────────────────────────────────────────────────────────────

export const BIOMES = {
  forest:   { id: 'forest',   name: 'Forest',   primaryNodes: ['tree', 'herb'] as NodeTypeId[],    color: '#228b22' },
  mountain: { id: 'mountain', name: 'Mountain', primaryNodes: ['ore'] as NodeTypeId[],              color: '#696969' },
  plains:   { id: 'plains',   name: 'Plains',   primaryNodes: ['forage', 'hide'] as NodeTypeId[],   color: '#90ee90' },
  coast:    { id: 'coast',    name: 'Coast',    primaryNodes: ['fish', 'forage'] as NodeTypeId[],    color: '#00bfff' },
  swamp:    { id: 'swamp',    name: 'Swamp',    primaryNodes: ['herb', 'hide'] as NodeTypeId[],      color: '#556b2f' },
  volcanic: { id: 'volcanic', name: 'Volcanic', primaryNodes: ['ore', 'essence'] as NodeTypeId[],    color: '#dc143c' },
  ruins:    { id: 'ruins',    name: 'Ruins',    primaryNodes: ['scrap', 'essence'] as NodeTypeId[],   color: '#4a4a4a' },
} as const;

export type BiomeId = keyof typeof BIOMES;

// ── Building Types ──────────────────────────────────────────────────────────

export const BUILDING_TYPES = {
  barracks:     { id: 'barracks',     name: 'Barracks',      maxLevel: 3, description: 'Train infantry units' },
  archeryRange: { id: 'archeryRange', name: 'Archery Range', maxLevel: 3, description: 'Train ranged units' },
  market:       { id: 'market',       name: 'Market',        maxLevel: 3, description: 'Trade resources' },
  port:         { id: 'port',         name: 'Port',          maxLevel: 3, description: 'Build ships' },
  storage:      { id: 'storage',      name: 'Storage',       maxLevel: 3, description: 'Store resources' },
  house:        { id: 'house',        name: 'House',         maxLevel: 3, description: 'Increase population' },
  wallTower:    { id: 'wallTower',    name: 'Wall Tower',    maxLevel: 3, description: 'Defensive structure' },
  mineShaft:    { id: 'mineShaft',    name: 'Mine Shaft',    maxLevel: 3, description: 'Auto-harvest ore' },
  sawmill:      { id: 'sawmill',      name: 'Sawmill',       maxLevel: 3, description: 'Auto-harvest wood' },
  forge:        { id: 'forge',        name: 'Forge',         maxLevel: 3, description: 'Craft metal items' },
  kitchen:      { id: 'kitchen',      name: 'Kitchen',       maxLevel: 3, description: 'Cook food and brew potions' },
  workshop:     { id: 'workshop',     name: 'Workshop',      maxLevel: 3, description: 'Engineer crafting station' },
  enchantTable: { id: 'enchantTable', name: 'Enchanting Table', maxLevel: 3, description: 'Mystic enchanting' },
} as const;

// ── Harvest Interval ────────────────────────────────────────────────────────

export const HARVEST_INTERVAL_MS = 12000;

// ── Factory Functions ───────────────────────────────────────────────────────

export function createResourceNode(
  nodeType: NodeTypeId,
  tier: ResourceTier,
  x: number,
  y: number,
): ResourceNode {
  const nodeData = NODE_TYPES[nodeType];
  const yieldMult = TIER_YIELD_MULTIPLIERS[tier];
  const resourceIndex = Math.min(tier - 1, nodeData.resourceTypes.length - 1);
  const resourceType = nodeData.resourceTypes[resourceIndex];

  return {
    id: generateGrudgeUuid('node'),
    nodeType,
    tier,
    resourceType,
    baseYield: Math.floor(nodeData.baseYield * yieldMult),
    respawnTime: nodeData.respawnTime,
    x,
    y,
    currentYield: Math.floor(nodeData.baseYield * yieldMult),
    lastHarvested: 0,
  };
}

export function generateIslandNodes(biome: BiomeId, gridSize: number = 9): ResourceNode[] {
  const nodes: ResourceNode[] = [];
  const biomeData = BIOMES[biome] || BIOMES.forest;
  const nodeCount = 3 + Math.floor(Math.random() * 4);
  const usedPositions = new Set<string>();

  for (let i = 0; i < nodeCount; i++) {
    let x: number, y: number, posKey: string;
    do {
      x = Math.floor(Math.random() * gridSize);
      y = Math.floor(Math.random() * gridSize);
      posKey = `${x},${y}`;
    } while (usedPositions.has(posKey));
    usedPositions.add(posKey);

    const nodeType = biomeData.primaryNodes[
      Math.floor(Math.random() * biomeData.primaryNodes.length)
    ];

    const tierRoll = Math.random();
    let tier: ResourceTier = 1;
    if (tierRoll < 0.01) tier = 8;
    else if (tierRoll < 0.02) tier = 7;
    else if (tierRoll < 0.04) tier = 6;
    else if (tierRoll < 0.08) tier = 5;
    else if (tierRoll < 0.14) tier = 4;
    else if (tierRoll < 0.25) tier = 3;
    else if (tierRoll < 0.45) tier = 2;

    nodes.push(createResourceNode(nodeType, tier, x, y));
  }

  return nodes;
}

export function createIsland(
  ownerId: string,
  name: string,
  gridX: number,
  gridY: number,
  biome: BiomeId,
): Island {
  return {
    id: generateGrudgeUuid('island'),
    ownerId,
    name,
    gridX,
    gridY,
    biome,
    nodes: generateIslandNodes(biome),
    buildings: [],
    assignedHeroes: [],
    discoveredAt: Date.now(),
  };
}
