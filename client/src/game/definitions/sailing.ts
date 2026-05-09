export interface Ship {
  id: string;
  name: string;
  tier: number;
  crewCapacity: number;
  cargoCapacity: number;
  speed: number;
  durability: number;
  cannons: number;
  description: string;
  buildMaterials: { material: string; quantity: number }[];
}

export type CannonMountType = 'broadside-port' | 'broadside-starboard' | 'bow' | 'stern' | 'swivel';

export interface CannonMount {
  id: string;
  type: CannonMountType;
  localPosition: [number, number, number];
  arcCenter: number;   // degrees from bow (0=forward, 90=port, -90=starboard, 180=stern)
  arcWidth: number;    // total fire arc width in degrees (e.g. 120 = ±60 from center)
  allowedSkills: CannonSkillId[];
  cooldownMultiplier: number;
}

export type CannonSkillId = 'heavy_ball' | 'chain_shot' | 'grapeshot' | 'fire_bomb' | 'explosive_shell' | 'scatter_shot';

export interface CannonSkill {
  id: CannonSkillId;
  name: string;
  icon: string;
  key: string;
  damage: number;
  range: number;
  speed: number;
  ttl: number;
  count: number;
  spread: number;
  cooldown: number;
  color: number;
  description: string;
  effects?: { type: 'burn' | 'slow' | 'stun'; duration: number; value: number }[];
}

export const CANNON_SKILLS: Record<CannonSkillId, CannonSkill> = {
  heavy_ball: {
    id: 'heavy_ball', name: 'Heavy Ball', icon: '🔵', key: '1',
    damage: 28, range: 90, speed: 62, ttl: 3.2, count: 1, spread: 0, cooldown: 2.5,
    color: 0x222222,
    description: 'Standard iron shot. High damage, long range.',
  },
  chain_shot: {
    id: 'chain_shot', name: 'Chain Shot', icon: '⛓', key: '2',
    damage: 14, range: 65, speed: 48, ttl: 2.5, count: 2, spread: 0.25, cooldown: 3.5,
    color: 0x888888,
    description: 'Two balls on a chain. Tears rigging, slows enemy by 55%.',
    effects: [{ type: 'slow', duration: 4.5, value: 0.55 }],
  },
  grapeshot: {
    id: 'grapeshot', name: 'Grapeshot', icon: '🫧', key: '3',
    damage: 7, range: 35, speed: 52, ttl: 1.0, count: 8, spread: 0.45, cooldown: 2.0,
    color: 0xaaaaaa,
    description: 'Scatter of iron pellets. Devastating at close range.',
  },
  fire_bomb: {
    id: 'fire_bomb', name: 'Fire Bomb', icon: '🔥', key: '4',
    damage: 10, range: 70, speed: 42, ttl: 4.0, count: 1, spread: 0, cooldown: 5.0,
    color: 0xff6600,
    description: 'Clay pot of burning oil. Burns for 6 dmg/s over 5s.',
    effects: [{ type: 'burn', duration: 5.0, value: 6 }],
  },
  explosive_shell: {
    id: 'explosive_shell', name: 'Explosive Shell', icon: '💥', key: '5',
    damage: 42, range: 80, speed: 55, ttl: 3.0, count: 1, spread: 0, cooldown: 7.0,
    color: 0xff4400,
    description: 'Explosive charge. Massive damage on impact.',
  },
  scatter_shot: {
    id: 'scatter_shot', name: 'Scatter Shot', icon: '✦', key: '6',
    damage: 5, range: 50, speed: 58, ttl: 1.5, count: 12, spread: 0.6, cooldown: 4.0,
    color: 0xcccc00,
    description: 'Wide scatter pattern, excellent against crew.',
  },
};

export interface ShipCannonConfig {
  shipId: string;
  mounts: CannonMount[];
  armor: number;
  turnBonus: number;
}

export const SHIP_CANNON_CONFIGS: Record<string, ShipCannonConfig> = {
  raft: {
    shipId: 'raft',
    armor: 0,
    turnBonus: 0.4,
    mounts: [],
  },
  skiff: {
    shipId: 'skiff',
    armor: 2,
    turnBonus: 0.3,
    mounts: [
      {
        id: 'swivel-bow', type: 'swivel',
        localPosition: [0, 1.5, 3],
        arcCenter: 0, arcWidth: 240,
        allowedSkills: ['heavy_ball', 'grapeshot'],
        cooldownMultiplier: 1.2,
      },
    ],
  },
  sloop: {
    shipId: 'sloop',
    armor: 8,
    turnBonus: 0.15,
    mounts: [
      {
        id: 'port-1', type: 'broadside-port',
        localPosition: [-3, 1.2, 0],
        arcCenter: 90, arcWidth: 130,
        allowedSkills: ['heavy_ball', 'chain_shot', 'grapeshot', 'fire_bomb'],
        cooldownMultiplier: 1.0,
      },
      {
        id: 'port-2', type: 'broadside-port',
        localPosition: [-3, 1.2, -3],
        arcCenter: 90, arcWidth: 130,
        allowedSkills: ['heavy_ball', 'chain_shot', 'grapeshot', 'fire_bomb'],
        cooldownMultiplier: 1.0,
      },
      {
        id: 'stbd-1', type: 'broadside-starboard',
        localPosition: [3, 1.2, 0],
        arcCenter: -90, arcWidth: 130,
        allowedSkills: ['heavy_ball', 'chain_shot', 'grapeshot', 'fire_bomb'],
        cooldownMultiplier: 1.0,
      },
      {
        id: 'stbd-2', type: 'broadside-starboard',
        localPosition: [3, 1.2, -3],
        arcCenter: -90, arcWidth: 130,
        allowedSkills: ['heavy_ball', 'chain_shot', 'grapeshot', 'fire_bomb'],
        cooldownMultiplier: 1.0,
      },
      {
        id: 'bow-chaser', type: 'bow',
        localPosition: [0, 1.6, 5],
        arcCenter: 0, arcWidth: 60,
        allowedSkills: ['heavy_ball', 'explosive_shell'],
        cooldownMultiplier: 0.8,
      },
    ],
  },
  brigantine: {
    shipId: 'brigantine',
    armor: 18,
    turnBonus: 0.05,
    mounts: [
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `port-${i + 1}`, type: 'broadside-port' as CannonMountType,
        localPosition: [-4, 1.5, (i - 1.5) * 4] as [number, number, number],
        arcCenter: 90, arcWidth: 140,
        allowedSkills: ['heavy_ball', 'chain_shot', 'grapeshot', 'fire_bomb', 'explosive_shell'] as CannonSkillId[],
        cooldownMultiplier: 0.9,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `stbd-${i + 1}`, type: 'broadside-starboard' as CannonMountType,
        localPosition: [4, 1.5, (i - 1.5) * 4] as [number, number, number],
        arcCenter: -90, arcWidth: 140,
        allowedSkills: ['heavy_ball', 'chain_shot', 'grapeshot', 'fire_bomb', 'explosive_shell'] as CannonSkillId[],
        cooldownMultiplier: 0.9,
      })),
      {
        id: 'bow-port', type: 'bow',
        localPosition: [-1.5, 2, 6],
        arcCenter: 20, arcWidth: 80,
        allowedSkills: ['heavy_ball', 'explosive_shell', 'scatter_shot'],
        cooldownMultiplier: 0.75,
      },
      {
        id: 'bow-stbd', type: 'bow',
        localPosition: [1.5, 2, 6],
        arcCenter: -20, arcWidth: 80,
        allowedSkills: ['heavy_ball', 'explosive_shell', 'scatter_shot'],
        cooldownMultiplier: 0.75,
      },
    ],
  },
  galleon: {
    shipId: 'galleon',
    armor: 35,
    turnBonus: -0.1,
    mounts: [
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `port-${i + 1}`, type: 'broadside-port' as CannonMountType,
        localPosition: [-5.5, 1.5, (i - 3.5) * 4.5] as [number, number, number],
        arcCenter: 90, arcWidth: 150,
        allowedSkills: ['heavy_ball', 'chain_shot', 'grapeshot', 'fire_bomb', 'explosive_shell', 'scatter_shot'] as CannonSkillId[],
        cooldownMultiplier: 0.8,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `stbd-${i + 1}`, type: 'broadside-starboard' as CannonMountType,
        localPosition: [5.5, 1.5, (i - 3.5) * 4.5] as [number, number, number],
        arcCenter: -90, arcWidth: 150,
        allowedSkills: ['heavy_ball', 'chain_shot', 'grapeshot', 'fire_bomb', 'explosive_shell', 'scatter_shot'] as CannonSkillId[],
        cooldownMultiplier: 0.8,
      })),
      { id: 'bow-port', type: 'bow', localPosition: [-2, 2.5, 10], arcCenter: 20, arcWidth: 90, allowedSkills: ['heavy_ball', 'explosive_shell'], cooldownMultiplier: 0.7 },
      { id: 'bow-stbd', type: 'bow', localPosition: [2, 2.5, 10], arcCenter: -20, arcWidth: 90, allowedSkills: ['heavy_ball', 'explosive_shell'], cooldownMultiplier: 0.7 },
      { id: 'stern-port', type: 'stern', localPosition: [-2, 2, -12], arcCenter: 160, arcWidth: 80, allowedSkills: ['heavy_ball', 'chain_shot'], cooldownMultiplier: 0.85 },
      { id: 'stern-stbd', type: 'stern', localPosition: [2, 2, -12], arcCenter: -160, arcWidth: 80, allowedSkills: ['heavy_ball', 'chain_shot'], cooldownMultiplier: 0.85 },
    ],
  },
};

export function getEligibleMounts(shipId: string, aimBearingDeg: number): CannonMount[] {
  const config = SHIP_CANNON_CONFIGS[shipId] || SHIP_CANNON_CONFIGS.sloop;
  return config.mounts.filter(mount => {
    const diff = ((aimBearingDeg - mount.arcCenter + 540) % 360) - 180;
    return Math.abs(diff) <= mount.arcWidth / 2;
  });
}

export interface SeaRoute {
  id: string;
  name: string;
  from: string;
  to: string;
  distance: number;
  dangerLevel: number;
  treasureChance: number;
  encounterTypes: string[];
}

export interface SeaEncounter {
  id: string;
  name: string;
  type: 'combat' | 'treasure' | 'event' | 'storm';
  difficulty: number;
  rewards: string[];
  description: string;
}

export interface WorldRegion {
  id: string;
  name: string;
  biome: string;
  levelRange: [number, number];
  resources: string[];
  dungeons: string[];
  ports: string[];
  description: string;
}

export const SHIP_TYPES: Record<string, Ship> = {
  raft: {
    id: 'raft',
    name: 'Raft',
    tier: 1,
    crewCapacity: 2,
    cargoCapacity: 10,
    speed: 5,
    durability: 50,
    cannons: 0,
    description: 'A simple wooden raft for short coastal trips',
    buildMaterials: [{ material: 'pineLog', quantity: 20 }],
  },
  skiff: {
    id: 'skiff',
    name: 'Skiff',
    tier: 2,
    crewCapacity: 4,
    cargoCapacity: 25,
    speed: 8,
    durability: 100,
    cannons: 0,
    description: 'A small boat for fishing and exploration',
    buildMaterials: [{ material: 'oakLog', quantity: 40 }, { material: 'ironOre', quantity: 10 }],
  },
  sloop: {
    id: 'sloop',
    name: 'Sloop',
    tier: 3,
    crewCapacity: 8,
    cargoCapacity: 50,
    speed: 12,
    durability: 200,
    cannons: 4,
    description: 'A fast single-masted vessel for trade and light combat',
    buildMaterials: [{ material: 'mapleLog', quantity: 80 }, { material: 'steelOre', quantity: 30 }, { material: 'rawhideLeather', quantity: 20 }],
  },
  brigantine: {
    id: 'brigantine',
    name: 'Brigantine',
    tier: 4,
    crewCapacity: 16,
    cargoCapacity: 100,
    speed: 15,
    durability: 400,
    cannons: 12,
    description: 'A two-masted vessel balanced for speed and firepower',
    buildMaterials: [{ material: 'ashLog', quantity: 150 }, { material: 'mithrilOre', quantity: 20 }, { material: 'thickHide', quantity: 30 }],
  },
  galleon: {
    id: 'galleon',
    name: 'Galleon',
    tier: 5,
    crewCapacity: 32,
    cargoCapacity: 250,
    speed: 10,
    durability: 800,
    cannons: 24,
    description: 'A massive warship for naval supremacy',
    buildMaterials: [{ material: 'ironwoodLog', quantity: 300 }, { material: 'adamantineOre', quantity: 50 }, { material: 'dragonHide', quantity: 20 }],
  },
};

export const SEA_ENCOUNTERS: Record<string, SeaEncounter> = {
  pirateAmbush: { id: 'pirateAmbush', name: 'Pirate Ambush', type: 'combat', difficulty: 2, rewards: ['gold', 'supplies', 'maps'], description: 'Pirates attack your vessel seeking plunder' },
  ghostShip: { id: 'ghostShip', name: 'Ghost Ship', type: 'combat', difficulty: 4, rewards: ['cursedGold', 'artifacts', 'souls'], description: 'A spectral vessel emerges from the mist' },
  seaMonster: { id: 'seaMonster', name: 'Sea Monster', type: 'combat', difficulty: 5, rewards: ['scales', 'teeth', 'treasure'], description: 'A massive creature rises from the depths' },
  floatingTreasure: { id: 'floatingTreasure', name: 'Floating Treasure', type: 'treasure', difficulty: 1, rewards: ['gold', 'supplies'], description: 'Wreckage with salvageable goods' },
  merfolk: { id: 'merfolk', name: 'Merfolk Encounter', type: 'event', difficulty: 2, rewards: ['pearls', 'seaweeds', 'maps'], description: 'Merfolk offer trade or challenge' },
  storm: { id: 'storm', name: 'Violent Storm', type: 'storm', difficulty: 3, rewards: [], description: 'Navigate through dangerous weather' },
  whirlpool: { id: 'whirlpool', name: 'Whirlpool', type: 'event', difficulty: 4, rewards: ['deepTreasure'], description: 'A massive whirlpool threatens to swallow the ship' },
};

export const WORLD_REGIONS: Record<string, WorldRegion> = {
  startingIsles: {
    id: 'startingIsles',
    name: 'Starting Isles',
    biome: 'temperate',
    levelRange: [1, 10],
    resources: ['copper', 'oak', 'silverleaf'],
    dungeons: ['forgottenCrypt', 'goblinWarren'],
    ports: ['novicePort'],
    description: 'Safe waters for new adventurers',
  },
  stormyWaters: {
    id: 'stormyWaters',
    name: 'Stormy Waters',
    biome: 'stormy',
    levelRange: [10, 20],
    resources: ['iron', 'maple', 'mageroyal'],
    dungeons: ['ancientLibrary'],
    ports: ['stormHarbor'],
    description: 'Treacherous seas with frequent storms',
  },
  dragonSea: {
    id: 'dragonSea',
    name: 'Dragon Sea',
    biome: 'volcanic',
    levelRange: [30, 40],
    resources: ['mithril', 'ironwood', 'dreamfoil'],
    dungeons: ['dragonLair'],
    ports: ['dragonPort'],
    description: 'Waters patrolled by sea dragons',
  },
  voidExpanse: {
    id: 'voidExpanse',
    name: 'Void Expanse',
    biome: 'void',
    levelRange: [40, 50],
    resources: ['adamantite', 'worldtree', 'blacklotus'],
    dungeons: ['voidRift'],
    ports: ['voidAnchor'],
    description: 'The edge of reality where the void bleeds through',
  },
};

export function getShipsByTier(tier: number): Ship[] {
  return Object.values(SHIP_TYPES).filter(s => s.tier === tier);
}

export function getRegionByLevel(level: number): WorldRegion | undefined {
  return Object.values(WORLD_REGIONS).find(r => level >= r.levelRange[0] && level <= r.levelRange[1]);
}

export function calculateTravelTime(distance: number, shipSpeed: number): number {
  return Math.ceil(distance / shipSpeed * 60);
}

export interface SailingPolarPoint {
  angle: number;
  speedMultiplier: number;
}

export interface ShipPolarProfile {
  shipType: string;
  lightWind: SailingPolarPoint[];
  moderateWind: SailingPolarPoint[];
  strongWind: SailingPolarPoint[];
}

export const SHIP_POLAR_PROFILES: Record<string, ShipPolarProfile> = {
  raft: {
    shipType: 'raft',
    lightWind: [
      { angle: 0, speedMultiplier: 0 },
      { angle: 30, speedMultiplier: 0 },
      { angle: 45, speedMultiplier: 0.2 },
      { angle: 60, speedMultiplier: 0.5 },
      { angle: 90, speedMultiplier: 0.8 },
      { angle: 120, speedMultiplier: 0.9 },
      { angle: 150, speedMultiplier: 0.7 },
      { angle: 180, speedMultiplier: 0.5 },
    ],
    moderateWind: [
      { angle: 0, speedMultiplier: 0 },
      { angle: 30, speedMultiplier: 0 },
      { angle: 45, speedMultiplier: 0.3 },
      { angle: 60, speedMultiplier: 0.6 },
      { angle: 90, speedMultiplier: 0.85 },
      { angle: 120, speedMultiplier: 1.0 },
      { angle: 150, speedMultiplier: 0.75 },
      { angle: 180, speedMultiplier: 0.55 },
    ],
    strongWind: [
      { angle: 0, speedMultiplier: 0 },
      { angle: 30, speedMultiplier: 0 },
      { angle: 45, speedMultiplier: 0.25 },
      { angle: 60, speedMultiplier: 0.55 },
      { angle: 90, speedMultiplier: 0.8 },
      { angle: 120, speedMultiplier: 1.0 },
      { angle: 150, speedMultiplier: 0.85 },
      { angle: 180, speedMultiplier: 0.6 },
    ],
  },
  skiff: {
    shipType: 'skiff',
    lightWind: [
      { angle: 0, speedMultiplier: 0 },
      { angle: 30, speedMultiplier: 0.1 },
      { angle: 45, speedMultiplier: 0.4 },
      { angle: 60, speedMultiplier: 0.7 },
      { angle: 90, speedMultiplier: 1.0 },
      { angle: 120, speedMultiplier: 1.0 },
      { angle: 150, speedMultiplier: 0.75 },
      { angle: 180, speedMultiplier: 0.5 },
    ],
    moderateWind: [
      { angle: 0, speedMultiplier: 0 },
      { angle: 30, speedMultiplier: 0.15 },
      { angle: 45, speedMultiplier: 0.5 },
      { angle: 60, speedMultiplier: 0.8 },
      { angle: 90, speedMultiplier: 1.1 },
      { angle: 120, speedMultiplier: 1.2 },
      { angle: 150, speedMultiplier: 0.85 },
      { angle: 180, speedMultiplier: 0.55 },
    ],
    strongWind: [
      { angle: 0, speedMultiplier: 0 },
      { angle: 30, speedMultiplier: 0.1 },
      { angle: 45, speedMultiplier: 0.45 },
      { angle: 60, speedMultiplier: 0.75 },
      { angle: 90, speedMultiplier: 1.0 },
      { angle: 120, speedMultiplier: 1.3 },
      { angle: 150, speedMultiplier: 1.0 },
      { angle: 180, speedMultiplier: 0.6 },
    ],
  },
  sloop: {
    shipType: 'sloop',
    lightWind: [
      { angle: 0, speedMultiplier: 0 },
      { angle: 30, speedMultiplier: 0.2 },
      { angle: 45, speedMultiplier: 0.5 },
      { angle: 60, speedMultiplier: 0.8 },
      { angle: 90, speedMultiplier: 1.1 },
      { angle: 120, speedMultiplier: 1.1 },
      { angle: 150, speedMultiplier: 0.8 },
      { angle: 180, speedMultiplier: 0.5 },
    ],
    moderateWind: [
      { angle: 0, speedMultiplier: 0 },
      { angle: 30, speedMultiplier: 0.25 },
      { angle: 45, speedMultiplier: 0.6 },
      { angle: 60, speedMultiplier: 0.9 },
      { angle: 90, speedMultiplier: 1.2 },
      { angle: 120, speedMultiplier: 1.4 },
      { angle: 150, speedMultiplier: 1.0 },
      { angle: 180, speedMultiplier: 0.55 },
    ],
    strongWind: [
      { angle: 0, speedMultiplier: 0 },
      { angle: 30, speedMultiplier: 0.2 },
      { angle: 45, speedMultiplier: 0.55 },
      { angle: 60, speedMultiplier: 0.85 },
      { angle: 90, speedMultiplier: 1.15 },
      { angle: 120, speedMultiplier: 1.5 },
      { angle: 150, speedMultiplier: 1.2 },
      { angle: 180, speedMultiplier: 0.65 },
    ],
  },
  brigantine: {
    shipType: 'brigantine',
    lightWind: [
      { angle: 0, speedMultiplier: 0 },
      { angle: 30, speedMultiplier: 0.25 },
      { angle: 45, speedMultiplier: 0.55 },
      { angle: 60, speedMultiplier: 0.85 },
      { angle: 90, speedMultiplier: 1.15 },
      { angle: 120, speedMultiplier: 1.2 },
      { angle: 150, speedMultiplier: 0.9 },
      { angle: 180, speedMultiplier: 0.55 },
    ],
    moderateWind: [
      { angle: 0, speedMultiplier: 0 },
      { angle: 30, speedMultiplier: 0.3 },
      { angle: 45, speedMultiplier: 0.65 },
      { angle: 60, speedMultiplier: 0.95 },
      { angle: 90, speedMultiplier: 1.25 },
      { angle: 120, speedMultiplier: 1.5 },
      { angle: 150, speedMultiplier: 1.1 },
      { angle: 180, speedMultiplier: 0.6 },
    ],
    strongWind: [
      { angle: 0, speedMultiplier: 0 },
      { angle: 30, speedMultiplier: 0.25 },
      { angle: 45, speedMultiplier: 0.6 },
      { angle: 60, speedMultiplier: 0.9 },
      { angle: 90, speedMultiplier: 1.2 },
      { angle: 120, speedMultiplier: 1.6 },
      { angle: 150, speedMultiplier: 1.35 },
      { angle: 180, speedMultiplier: 0.7 },
    ],
  },
  galleon: {
    shipType: 'galleon',
    lightWind: [
      { angle: 0, speedMultiplier: 0 },
      { angle: 30, speedMultiplier: 0.15 },
      { angle: 45, speedMultiplier: 0.4 },
      { angle: 60, speedMultiplier: 0.7 },
      { angle: 90, speedMultiplier: 1.0 },
      { angle: 120, speedMultiplier: 1.1 },
      { angle: 150, speedMultiplier: 0.85 },
      { angle: 180, speedMultiplier: 0.6 },
    ],
    moderateWind: [
      { angle: 0, speedMultiplier: 0 },
      { angle: 30, speedMultiplier: 0.2 },
      { angle: 45, speedMultiplier: 0.5 },
      { angle: 60, speedMultiplier: 0.8 },
      { angle: 90, speedMultiplier: 1.1 },
      { angle: 120, speedMultiplier: 1.3 },
      { angle: 150, speedMultiplier: 1.0 },
      { angle: 180, speedMultiplier: 0.65 },
    ],
    strongWind: [
      { angle: 0, speedMultiplier: 0 },
      { angle: 30, speedMultiplier: 0.15 },
      { angle: 45, speedMultiplier: 0.45 },
      { angle: 60, speedMultiplier: 0.75 },
      { angle: 90, speedMultiplier: 1.05 },
      { angle: 120, speedMultiplier: 1.4 },
      { angle: 150, speedMultiplier: 1.2 },
      { angle: 180, speedMultiplier: 0.75 },
    ],
  },
};

export function getWindStrengthCategory(windSpeed: number): 'light' | 'moderate' | 'strong' {
  if (windSpeed < 8) return 'light';
  if (windSpeed < 18) return 'moderate';
  return 'strong';
}

export function interpolatePolarSpeed(
  polarPoints: SailingPolarPoint[],
  angleToWind: number
): number {
  const absAngle = Math.abs(angleToWind);
  const clampedAngle = Math.min(180, absAngle);
  
  let lower = polarPoints[0];
  let upper = polarPoints[polarPoints.length - 1];
  
  for (let i = 0; i < polarPoints.length - 1; i++) {
    if (clampedAngle >= polarPoints[i].angle && clampedAngle <= polarPoints[i + 1].angle) {
      lower = polarPoints[i];
      upper = polarPoints[i + 1];
      break;
    }
  }
  
  if (lower.angle === upper.angle) return lower.speedMultiplier;
  
  const t = (clampedAngle - lower.angle) / (upper.angle - lower.angle);
  return lower.speedMultiplier + t * (upper.speedMultiplier - lower.speedMultiplier);
}

export function calculatePolarSpeed(
  shipType: string,
  angleToWind: number,
  windSpeed: number
): number {
  const profile = SHIP_POLAR_PROFILES[shipType] || SHIP_POLAR_PROFILES.sloop;
  const category = getWindStrengthCategory(windSpeed);
  
  let polarPoints: SailingPolarPoint[];
  switch (category) {
    case 'light':
      polarPoints = profile.lightWind;
      break;
    case 'moderate':
      polarPoints = profile.moderateWind;
      break;
    case 'strong':
      polarPoints = profile.strongWind;
      break;
  }
  
  return interpolatePolarSpeed(polarPoints, angleToWind);
}
