export type Skittishness = 'bold' | 'curious' | 'cautious' | 'timid' | 'paranoid';

export interface FishBehavior {
  name: string;
  skittishness: Skittishness;
  fleeDistance: number;
  fleeSpeed: number;
  approachSpeed: number;
  curiosityRadius: number;
  schoolingTightness: number;
  animationSpeedMultiplier: number;
  lurePreferences: Record<string, number>;
}

export interface LureDefinition {
  id: string;
  name: string;
  description: string;
  tier: number;
  durability: number;
  attractionRadius: number;
  effectiveFish: string[];
  craftingMaterials: { material: string; quantity: number }[];
}

export const SKITTISHNESS_CONFIG: Record<Skittishness, { fleeMultiplier: number; approachMultiplier: number; curiosityMultiplier: number }> = {
  bold: { fleeMultiplier: 0.3, approachMultiplier: 1.5, curiosityMultiplier: 2.0 },
  curious: { fleeMultiplier: 0.6, approachMultiplier: 1.2, curiosityMultiplier: 1.5 },
  cautious: { fleeMultiplier: 1.0, approachMultiplier: 0.8, curiosityMultiplier: 1.0 },
  timid: { fleeMultiplier: 1.5, approachMultiplier: 0.5, curiosityMultiplier: 0.6 },
  paranoid: { fleeMultiplier: 2.0, approachMultiplier: 0.3, curiosityMultiplier: 0.3 },
};

export const FISH_BEHAVIORS: Record<string, FishBehavior> = {
  Clownfish: {
    name: 'Clownfish',
    skittishness: 'bold',
    fleeDistance: 8,
    fleeSpeed: 6,
    approachSpeed: 4,
    curiosityRadius: 20,
    schoolingTightness: 0.9,
    animationSpeedMultiplier: 1.2,
    lurePreferences: {
      shinyLure: 0.9,
      wormBait: 0.7,
      glowingLure: 0.8,
      insectLure: 0.4,
      crustaceanBait: 0.6,
      fishHeadBait: 0.3,
      magicLure: 0.5,
      deepSeaLure: 0.2,
    },
  },
  BlueTang: {
    name: 'BlueTang',
    skittishness: 'curious',
    fleeDistance: 12,
    fleeSpeed: 8,
    approachSpeed: 5,
    curiosityRadius: 25,
    schoolingTightness: 0.85,
    animationSpeedMultiplier: 1.1,
    lurePreferences: {
      shinyLure: 0.8,
      wormBait: 0.6,
      glowingLure: 0.9,
      insectLure: 0.5,
      crustaceanBait: 0.4,
      fishHeadBait: 0.3,
      magicLure: 0.7,
      deepSeaLure: 0.3,
    },
  },
  YellowTang: {
    name: 'YellowTang',
    skittishness: 'curious',
    fleeDistance: 10,
    fleeSpeed: 7,
    approachSpeed: 4.5,
    curiosityRadius: 22,
    schoolingTightness: 0.88,
    animationSpeedMultiplier: 1.0,
    lurePreferences: {
      shinyLure: 0.85,
      wormBait: 0.5,
      glowingLure: 0.7,
      insectLure: 0.6,
      crustaceanBait: 0.4,
      fishHeadBait: 0.2,
      magicLure: 0.6,
      deepSeaLure: 0.2,
    },
  },
  Koi: {
    name: 'Koi',
    skittishness: 'bold',
    fleeDistance: 6,
    fleeSpeed: 4,
    approachSpeed: 3,
    curiosityRadius: 30,
    schoolingTightness: 0.7,
    animationSpeedMultiplier: 0.8,
    lurePreferences: {
      shinyLure: 0.7,
      wormBait: 0.9,
      glowingLure: 0.5,
      insectLure: 0.95,
      crustaceanBait: 0.6,
      fishHeadBait: 0.3,
      magicLure: 0.4,
      deepSeaLure: 0.1,
    },
  },
  Tuna: {
    name: 'Tuna',
    skittishness: 'cautious',
    fleeDistance: 25,
    fleeSpeed: 15,
    approachSpeed: 8,
    curiosityRadius: 35,
    schoolingTightness: 0.95,
    animationSpeedMultiplier: 1.4,
    lurePreferences: {
      shinyLure: 0.95,
      wormBait: 0.3,
      glowingLure: 0.6,
      insectLure: 0.2,
      crustaceanBait: 0.7,
      fishHeadBait: 0.9,
      magicLure: 0.5,
      deepSeaLure: 0.8,
    },
  },
  Shark: {
    name: 'Shark',
    skittishness: 'bold',
    fleeDistance: 5,
    fleeSpeed: 8,
    approachSpeed: 6,
    curiosityRadius: 50,
    schoolingTightness: 0.3,
    animationSpeedMultiplier: 0.9,
    lurePreferences: {
      shinyLure: 0.4,
      wormBait: 0.2,
      glowingLure: 0.3,
      insectLure: 0.1,
      crustaceanBait: 0.5,
      fishHeadBait: 0.99,
      magicLure: 0.6,
      deepSeaLure: 0.95,
    },
  },
  Goldfish: {
    name: 'Goldfish',
    skittishness: 'timid',
    fleeDistance: 15,
    fleeSpeed: 5,
    approachSpeed: 2,
    curiosityRadius: 12,
    schoolingTightness: 0.92,
    animationSpeedMultiplier: 0.9,
    lurePreferences: {
      shinyLure: 0.95,
      wormBait: 0.8,
      glowingLure: 0.85,
      insectLure: 0.9,
      crustaceanBait: 0.4,
      fishHeadBait: 0.1,
      magicLure: 0.7,
      deepSeaLure: 0.1,
    },
  },
  Tetra: {
    name: 'Tetra',
    skittishness: 'timid',
    fleeDistance: 18,
    fleeSpeed: 7,
    approachSpeed: 3,
    curiosityRadius: 10,
    schoolingTightness: 0.98,
    animationSpeedMultiplier: 1.3,
    lurePreferences: {
      shinyLure: 0.8,
      wormBait: 0.6,
      glowingLure: 0.9,
      insectLure: 0.85,
      crustaceanBait: 0.3,
      fishHeadBait: 0.1,
      magicLure: 0.75,
      deepSeaLure: 0.15,
    },
  },
  ButterflyFish: {
    name: 'ButterflyFish',
    skittishness: 'curious',
    fleeDistance: 12,
    fleeSpeed: 6,
    approachSpeed: 3.5,
    curiosityRadius: 20,
    schoolingTightness: 0.8,
    animationSpeedMultiplier: 1.0,
    lurePreferences: {
      shinyLure: 0.9,
      wormBait: 0.5,
      glowingLure: 0.85,
      insectLure: 0.7,
      crustaceanBait: 0.8,
      fishHeadBait: 0.2,
      magicLure: 0.65,
      deepSeaLure: 0.3,
    },
  },
  Piranha: {
    name: 'Piranha',
    skittishness: 'bold',
    fleeDistance: 5,
    fleeSpeed: 10,
    approachSpeed: 7,
    curiosityRadius: 40,
    schoolingTightness: 0.95,
    animationSpeedMultiplier: 1.5,
    lurePreferences: {
      shinyLure: 0.6,
      wormBait: 0.5,
      glowingLure: 0.4,
      insectLure: 0.3,
      crustaceanBait: 0.7,
      fishHeadBait: 0.95,
      magicLure: 0.5,
      deepSeaLure: 0.6,
    },
  },
  Anglerfish: {
    name: 'Anglerfish',
    skittishness: 'cautious',
    fleeDistance: 20,
    fleeSpeed: 4,
    approachSpeed: 2,
    curiosityRadius: 15,
    schoolingTightness: 0.2,
    animationSpeedMultiplier: 0.6,
    lurePreferences: {
      shinyLure: 0.3,
      wormBait: 0.4,
      glowingLure: 0.99,
      insectLure: 0.2,
      crustaceanBait: 0.5,
      fishHeadBait: 0.7,
      magicLure: 0.85,
      deepSeaLure: 0.95,
    },
  },
  Lionfish: {
    name: 'Lionfish',
    skittishness: 'cautious',
    fleeDistance: 15,
    fleeSpeed: 5,
    approachSpeed: 3.5,
    curiosityRadius: 18,
    schoolingTightness: 0.4,
    animationSpeedMultiplier: 0.85,
    lurePreferences: {
      shinyLure: 0.7,
      wormBait: 0.4,
      glowingLure: 0.75,
      insectLure: 0.5,
      crustaceanBait: 0.9,
      fishHeadBait: 0.6,
      magicLure: 0.7,
      deepSeaLure: 0.65,
    },
  },
};

export const LURE_TYPES: Record<string, LureDefinition> = {
  wormBait: {
    id: 'wormBait',
    name: 'Earthworm Bait',
    description: 'Simple but effective. Freshwater fish love it.',
    tier: 1,
    durability: 5,
    attractionRadius: 15,
    effectiveFish: ['Koi', 'Goldfish', 'Tetra'],
    craftingMaterials: [{ material: 'worm', quantity: 3 }],
  },
  shinyLure: {
    id: 'shinyLure',
    name: 'Shiny Metal Lure',
    description: 'Catches light and attention. Good for reef fish.',
    tier: 2,
    durability: 20,
    attractionRadius: 20,
    effectiveFish: ['Clownfish', 'BlueTang', 'YellowTang', 'Goldfish', 'Tuna'],
    craftingMaterials: [{ material: 'copperOre', quantity: 2 }, { material: 'silverOre', quantity: 1 }],
  },
  insectLure: {
    id: 'insectLure',
    name: 'Insect Fly Lure',
    description: 'Mimics surface insects. Perfect for surface feeders.',
    tier: 2,
    durability: 15,
    attractionRadius: 18,
    effectiveFish: ['Koi', 'Tetra', 'ButterflyFish'],
    craftingMaterials: [{ material: 'feather', quantity: 2 }, { material: 'thread', quantity: 1 }],
  },
  glowingLure: {
    id: 'glowingLure',
    name: 'Bioluminescent Lure',
    description: 'Glows in dark waters. Irresistible to deep-sea creatures.',
    tier: 3,
    durability: 25,
    attractionRadius: 30,
    effectiveFish: ['Anglerfish', 'BlueTang', 'Tetra', 'ButterflyFish'],
    craftingMaterials: [{ material: 'glowingMoss', quantity: 3 }, { material: 'crystalShard', quantity: 1 }],
  },
  crustaceanBait: {
    id: 'crustaceanBait',
    name: 'Crustacean Bait',
    description: 'Made from shrimp and crab. Appeals to predatory fish.',
    tier: 3,
    durability: 10,
    attractionRadius: 25,
    effectiveFish: ['Lionfish', 'Tuna', 'Piranha', 'ButterflyFish'],
    craftingMaterials: [{ material: 'shrimpMeat', quantity: 2 }, { material: 'crabClaw', quantity: 1 }],
  },
  fishHeadBait: {
    id: 'fishHeadBait',
    name: 'Fish Head Bait',
    description: 'Strong scent attracts large predators from afar.',
    tier: 4,
    durability: 8,
    attractionRadius: 40,
    effectiveFish: ['Shark', 'Piranha', 'Tuna', 'Anglerfish'],
    craftingMaterials: [{ material: 'fishHead', quantity: 1 }, { material: 'fishOil', quantity: 2 }],
  },
  magicLure: {
    id: 'magicLure',
    name: 'Enchanted Lure',
    description: 'Imbued with arcane energy. Confuses and attracts all fish.',
    tier: 4,
    durability: 30,
    attractionRadius: 35,
    effectiveFish: ['Anglerfish', 'Tetra', 'Lionfish', 'BlueTang', 'Goldfish'],
    craftingMaterials: [{ material: 'manaEssence', quantity: 2 }, { material: 'enchantedThread', quantity: 1 }],
  },
  deepSeaLure: {
    id: 'deepSeaLure',
    name: 'Abyssal Lure',
    description: 'Forged for the darkest depths. Attracts leviathans.',
    tier: 5,
    durability: 40,
    attractionRadius: 50,
    effectiveFish: ['Shark', 'Anglerfish', 'Tuna'],
    craftingMaterials: [{ material: 'voidShard', quantity: 1 }, { material: 'deepSeaScale', quantity: 3 }],
  },
};

export function getLureEffectiveness(lureId: string, fishName: string): number {
  const behavior = FISH_BEHAVIORS[fishName];
  if (!behavior) return 0.5;
  return behavior.lurePreferences[lureId] ?? 0.3;
}

export function getFleeParameters(fishName: string): { distance: number; speed: number; multiplier: number } {
  const behavior = FISH_BEHAVIORS[fishName];
  if (!behavior) return { distance: 15, speed: 8, multiplier: 1.0 };
  
  const config = SKITTISHNESS_CONFIG[behavior.skittishness];
  return {
    distance: behavior.fleeDistance * config.fleeMultiplier,
    speed: behavior.fleeSpeed * config.fleeMultiplier,
    multiplier: config.fleeMultiplier,
  };
}

export function getApproachParameters(fishName: string): { speed: number; curiosityRadius: number; multiplier: number } {
  const behavior = FISH_BEHAVIORS[fishName];
  if (!behavior) return { speed: 4, curiosityRadius: 15, multiplier: 1.0 };
  
  const config = SKITTISHNESS_CONFIG[behavior.skittishness];
  return {
    speed: behavior.approachSpeed * config.approachMultiplier,
    curiosityRadius: behavior.curiosityRadius * config.curiosityMultiplier,
    multiplier: config.approachMultiplier,
  };
}

export function getLuresByTier(tier: number): LureDefinition[] {
  return Object.values(LURE_TYPES).filter(l => l.tier === tier);
}

export function getBestLureForFish(fishName: string): string | null {
  const behavior = FISH_BEHAVIORS[fishName];
  if (!behavior) return null;
  
  let bestLure = '';
  let bestScore = 0;
  
  for (const [lureId, score] of Object.entries(behavior.lurePreferences)) {
    if (score > bestScore) {
      bestScore = score;
      bestLure = lureId;
    }
  }
  
  return bestLure || null;
}
