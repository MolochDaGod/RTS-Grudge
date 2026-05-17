/**
 * DragonPetRegistry — 6-stage dragon companion system.
 *
 * Ported from the Unity Grudge Warlords game:
 *
 *   Stage 1 · Egg          — Inventory item. Hatch by using it in your inventory.
 *   Stage 2 · Hatchling    — Tiny dragon follows player, +5% XP bonus.
 *   Stage 3 · Juvenile     — Compact teen dragon, attacks enemies, +10% damage aura.
 *   Stage 4 · Adult        — Full dragon, flyable mount (R key), fire breath special.
 *   Stage 5 · Elder        — Larger dragon, buff aura for party, +25% all stats on mount.
 *   Stage 6 · Legendary    — Ultimate form, can carry 2+ players, NFT-mintable.
 *
 * Dragon eggs drop from boss-tier dragon enemies (15% chance).
 * They can also be obtained via OpenSea/Magic Eden NFT ownership.
 *
 * R2 CDN fallback paths are hosted on assets.grudge-studio.com (grudge-assets R2).
 * Local dev uses the models already in client/public/models/monsters/flying/.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DragonStage = 1 | 2 | 3 | 4 | 5 | 6;
export type DragonColor = "red" | "blue" | "green" | "black" | "gold" | "void";

export interface DragonAbility {
  id: string;
  name: string;
  icon: string;
  description: string;
  cooldown: number;
  /** Combat damage multiplier relative to dragon's base damage */
  damageMult?: number;
  /** Radius for AoE abilities */
  aoeRadius?: number;
  /** Passive stat bonus (e.g. 0.1 = +10%) — always active when pet is out */
  passiveBonus?: { stat: string; value: number };
}

export interface DragonStageDef {
  stage: DragonStage;
  name: string;
  icon: string;
  description: string;

  /** Local model path (ships with repo) */
  modelPath: string;
  /** R2 CDN override — set once the enhanced dragon GLBs are uploaded */
  cdnModelPath?: string;

  scale: number;
  targetHeight: number;

  /** Base stats at this stage */
  stats: {
    health: number;
    damage: number;
    speed: number;
    detectionRange: number;
    attackRange: number;
  };

  /** Abilities available at this stage */
  abilities: DragonAbility[];

  /** Whether the player can mount and fly this dragon */
  mountable: boolean;
  /** How many players can ride at once */
  mountCapacity: number;

  /** XP required to advance to the next stage (undefined = max stage) */
  xpToNextStage?: number;
  /** Feeding materials required per XP point */
  feedMaterials: { itemId: string; quantity: number; xpGain: number }[];

  /** NFT metadata for Solana minting */
  nft: {
    collection: string;
    attributes: Record<string, string | number>;
    royaltyBps: number;  // basis points (200 = 2%)
  };

  /** Color used in UI for this stage */
  stageColor: string;
  /** Glow color in the 3D scene */
  glowColor: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CDN root (assets.grudge-studio.com R2 bucket)
// ─────────────────────────────────────────────────────────────────────────────

const R2 = "https://assets.grudge-studio.com/models/pets";

// ─────────────────────────────────────────────────────────────────────────────
// Stage definitions
// ─────────────────────────────────────────────────────────────────────────────

export const DRAGON_STAGES: Record<DragonStage, DragonStageDef> = {

  // ── Stage 1: Egg ──────────────────────────────────────────────────────────
  // Not a 3D unit — lives in inventory as a usable item.
  1: {
    stage: 1,
    name: "Dragon Egg",
    icon: "🥚",
    description: "A warm, pulsing egg. Keep it close — it will hatch when the time is right. Use from inventory to hatch.",
    modelPath: "",  // egg has no 3D world presence
    cdnModelPath: undefined,
    scale: 0,
    targetHeight: 0,
    stats: { health: 0, damage: 0, speed: 0, detectionRange: 0, attackRange: 0 },
    abilities: [],
    mountable: false,
    mountCapacity: 0,
    xpToNextStage: 0,  // instant hatch via use action
    feedMaterials: [],
    nft: {
      collection: "grudge-dragon-eggs",
      attributes: { stage: "egg", rarity: "rare" },
      royaltyBps: 500,
    },
    stageColor: "#ffcc66",
    glowColor: "#ffaa00",
  },

  // ── Stage 2: Hatchling ────────────────────────────────────────────────────
  2: {
    stage: 2,
    name: "Dragon Hatchling",
    icon: "🐉",
    description: "A newborn dragon no bigger than a cat. Curious and loyal. Orbits the player and applies a small XP bonus.",
    modelPath: "/models/monsters/flying/Goleling.glb",
    cdnModelPath: `${R2}/dragon_hatchling.glb`,
    scale: 0.35,
    targetHeight: 0.6,
    stats: { health: 40, damage: 5, speed: 6, detectionRange: 8, attackRange: 2.5 },
    abilities: [
      {
        id: "hatchling_xp_aura",
        name: "Dragon Bond",
        icon: "⭐",
        description: "+5% XP from all sources while hatchling is active.",
        cooldown: 0,
        passiveBonus: { stat: "xpGain", value: 0.05 },
      },
    ],
    mountable: false,
    mountCapacity: 0,
    xpToNextStage: 300,
    feedMaterials: [
      { itemId: "raw_meat", quantity: 1, xpGain: 5 },
      { itemId: "herb", quantity: 2, xpGain: 3 },
      { itemId: "berry", quantity: 5, xpGain: 8 },
    ],
    nft: {
      collection: "grudge-dragons",
      attributes: { stage: "hatchling", element: "fire", rarity: "uncommon" },
      royaltyBps: 400,
    },
    stageColor: "#ff9944",
    glowColor: "#ff7700",
  },

  // ── Stage 3: Juvenile ─────────────────────────────────────────────────────
  3: {
    stage: 3,
    name: "Juvenile Dragon",
    icon: "🐉",
    description: "Growing fast and itching to fight. Can actively engage weak enemies. Damage aura for the player.",
    modelPath: "/models/monsters/flying/Goleling_Evolved.glb",
    cdnModelPath: `${R2}/dragon_juvenile.glb`,
    scale: 0.7,
    targetHeight: 1.1,
    stats: { health: 120, damage: 18, speed: 7, detectionRange: 15, attackRange: 3.5 },
    abilities: [
      {
        id: "juvenile_damage_aura",
        name: "Fire Presence",
        icon: "🔥",
        description: "+10% damage for all party members within 8m.",
        cooldown: 0,
        passiveBonus: { stat: "damage", value: 0.10 },
        aoeRadius: 8,
      },
      {
        id: "juvenile_fire_spit",
        name: "Fire Spit",
        icon: "🔥",
        description: "Spits a small fireball at the nearest enemy. 8s cooldown.",
        cooldown: 8,
        damageMult: 1.8,
        aoeRadius: 1.5,
      },
    ],
    mountable: false,
    mountCapacity: 0,
    xpToNextStage: 1000,
    feedMaterials: [
      { itemId: "raw_meat", quantity: 2, xpGain: 8 },
      { itemId: "iron_ingot", quantity: 1, xpGain: 15 },
      { itemId: "crystal", quantity: 1, xpGain: 20 },
      { itemId: "dragon_scale", quantity: 1, xpGain: 50 },
    ],
    nft: {
      collection: "grudge-dragons",
      attributes: { stage: "juvenile", element: "fire", rarity: "rare" },
      royaltyBps: 400,
    },
    stageColor: "#ff6633",
    glowColor: "#ff4400",
  },

  // ── Stage 4: Adult ────────────────────────────────────────────────────────
  4: {
    stage: 4,
    name: "Adult Dragon",
    icon: "🐲",
    description: "A fearsome adult dragon. Press R (or tap mount) to ride. Fire breath can hit multiple enemies. +20% all stats on mount.",
    modelPath: "/models/monsters/flying/Dragon_Evolved.glb",
    cdnModelPath: `${R2}/dragon_adult.glb`,
    scale: 1.0,
    targetHeight: 2.2,
    stats: { health: 400, damage: 45, speed: 9, detectionRange: 30, attackRange: 6.0 },
    abilities: [
      {
        id: "adult_mount_buff",
        name: "Dragon Rider",
        icon: "🏇",
        description: "+20% to all combat stats while mounted. Flying mount — can cross any terrain.",
        cooldown: 0,
        passiveBonus: { stat: "allStats", value: 0.20 },
      },
      {
        id: "adult_fire_breath",
        name: "Fire Breath",
        icon: "🔥",
        description: "Cone of fire. 5m range, 12m wide. Burns enemies for 4 seconds. 15s cooldown.",
        cooldown: 15,
        damageMult: 3.0,
        aoeRadius: 6,
      },
      {
        id: "adult_dive_bomb",
        name: "Dive Bomb",
        icon: "💥",
        description: "Dive from height, AoE shockwave on landing. 25s cooldown.",
        cooldown: 25,
        damageMult: 4.0,
        aoeRadius: 8,
      },
    ],
    mountable: true,
    mountCapacity: 1,
    xpToNextStage: 3500,
    feedMaterials: [
      { itemId: "raw_meat", quantity: 5, xpGain: 10 },
      { itemId: "iron_ingot", quantity: 2, xpGain: 20 },
      { itemId: "mithril_ore", quantity: 1, xpGain: 40 },
      { itemId: "dragon_scale", quantity: 2, xpGain: 80 },
      { itemId: "crystal", quantity: 3, xpGain: 30 },
    ],
    nft: {
      collection: "grudge-dragons",
      attributes: { stage: "adult", element: "fire", rarity: "heroic", mountable: 1 },
      royaltyBps: 500,
    },
    stageColor: "#ff3300",
    glowColor: "#cc2200",
  },

  // ── Stage 5: Elder ────────────────────────────────────────────────────────
  5: {
    stage: 5,
    name: "Elder Dragon",
    icon: "🐲",
    description: "An ancient dragon of great power. Party-wide buff aura. Two riders. Fire storm ultimate.",
    modelPath: "/models/monsters/flying/Dragon_Evolved.glb",
    cdnModelPath: `${R2}/dragon_elder.glb`,
    scale: 1.6,
    targetHeight: 3.0,
    stats: { health: 900, damage: 80, speed: 10, detectionRange: 40, attackRange: 8.0 },
    abilities: [
      {
        id: "elder_party_aura",
        name: "Ancient Might",
        icon: "🌟",
        description: "+25% all stats for entire party within 20m radius.",
        cooldown: 0,
        passiveBonus: { stat: "allStats", value: 0.25 },
        aoeRadius: 20,
      },
      {
        id: "elder_fire_breath",
        name: "Inferno Breath",
        icon: "🌋",
        description: "Devastating fire cone. 10m range, 20m wide. Stacks burn. 12s cooldown.",
        cooldown: 12,
        damageMult: 5.0,
        aoeRadius: 10,
      },
      {
        id: "elder_fire_storm",
        name: "Fire Storm",
        icon: "⚡",
        description: "Calls down meteors over a 30m area. Ultimate ability. 90s cooldown.",
        cooldown: 90,
        damageMult: 8.0,
        aoeRadius: 30,
      },
      {
        id: "elder_scale_armor",
        name: "Dragon Scales",
        icon: "🛡️",
        description: "Mounted riders gain +40% damage reduction.",
        cooldown: 0,
        passiveBonus: { stat: "defense", value: 0.40 },
      },
    ],
    mountable: true,
    mountCapacity: 2,
    xpToNextStage: 10000,
    feedMaterials: [
      { itemId: "dragon_scale", quantity: 5, xpGain: 100 },
      { itemId: "divine_ore", quantity: 1, xpGain: 300 },
      { itemId: "orichalcum_ore", quantity: 2, xpGain: 150 },
      { itemId: "boss_trophy", quantity: 1, xpGain: 500 },
      { itemId: "legendary_shard", quantity: 1, xpGain: 800 },
    ],
    nft: {
      collection: "grudge-dragons",
      attributes: { stage: "elder", element: "inferno", rarity: "mythic", mountCapacity: 2 },
      royaltyBps: 600,
    },
    stageColor: "#cc0000",
    glowColor: "#880000",
  },

  // ── Stage 6: Legendary ────────────────────────────────────────────────────
  6: {
    stage: 6,
    name: "Legendary Dragon",
    icon: "⚜️",
    description: "The apex of dragon evolution. A living weapon of mass destruction. 3 riders. NFT-mintable as a Grudge Legendary asset. One of a kind per server.",
    modelPath: "/models/monsters/flying/Dragon_Evolved.glb",
    cdnModelPath: `${R2}/dragon_legendary.glb`,
    scale: 2.5,
    targetHeight: 4.5,
    stats: { health: 2500, damage: 160, speed: 12, detectionRange: 60, attackRange: 12.0 },
    abilities: [
      {
        id: "legendary_world_aura",
        name: "Dragon Sovereign",
        icon: "👑",
        description: "+35% all stats for entire server in the same zone. Unique in the world.",
        cooldown: 0,
        passiveBonus: { stat: "allStats", value: 0.35 },
        aoeRadius: 999,
      },
      {
        id: "legendary_cataclysm",
        name: "Cataclysm",
        icon: "💀",
        description: "Total destruction. Wipes a 50m area. Warlord-class ability. 5 min cooldown.",
        cooldown: 300,
        damageMult: 20.0,
        aoeRadius: 50,
      },
      {
        id: "legendary_void_breath",
        name: "Void Breath",
        icon: "🌀",
        description: "Reality-tearing dark breath. Ignores all defenses. 20s cooldown.",
        cooldown: 20,
        damageMult: 10.0,
        aoeRadius: 15,
      },
      {
        id: "legendary_immortal",
        name: "Dragon Immortality",
        icon: "✨",
        description: "Upon death, respawns in 60s with 50% health. Once per IRL day.",
        cooldown: 86400,
        passiveBonus: { stat: "immortality", value: 1 },
      },
    ],
    mountable: true,
    mountCapacity: 3,
    xpToNextStage: undefined,  // max stage
    feedMaterials: [],  // no further feeding — this is the final form
    nft: {
      collection: "grudge-legendary-dragons",
      attributes: {
        stage: "legendary", element: "void", rarity: "legendary",
        mountCapacity: 3, unique: 1,
      },
      royaltyBps: 700,
    },
    stageColor: "#f0d890",
    glowColor: "#d4a400",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Dragon variant color schemes (skin variations)
// ─────────────────────────────────────────────────────────────────────────────

export const DRAGON_COLOR_TINTS: Record<DragonColor, {
  name: string; hex: string; emissive: string; rarity: string;
}> = {
  red:   { name: "Crimson",   hex: "#cc2200", emissive: "#ff3300", rarity: "common"   },
  blue:  { name: "Frost",     hex: "#2244cc", emissive: "#4466ff", rarity: "uncommon" },
  green: { name: "Venomfang", hex: "#228833", emissive: "#44cc55", rarity: "uncommon" },
  black: { name: "Shadowscale",hex: "#221122",emissive: "#663366", rarity: "rare"     },
  gold:  { name: "Auric",     hex: "#cc8800", emissive: "#ffaa00", rarity: "heroic"   },
  void:  { name: "Voidborn",  hex: "#110022", emissive: "#8800ff", rarity: "legendary"},
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

export function getDragonStage(stage: DragonStage): DragonStageDef {
  return DRAGON_STAGES[stage];
}

export function getDragonModelPath(stage: DragonStage): string {
  const def = DRAGON_STAGES[stage];
  // Prefer CDN path in production when R2 models are uploaded
  if (def.cdnModelPath && typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return def.cdnModelPath;
  }
  return def.modelPath;
}

export function canAdvanceStage(stage: DragonStage): stage is 1 | 2 | 3 | 4 | 5 {
  return stage < 6;
}

export function getXpThreshold(stage: DragonStage): number {
  return DRAGON_STAGES[stage].xpToNextStage ?? Infinity;
}

/** Passive stat bonus for the active stage (type → multiplier). */
export function getDragonPassiveBonuses(stage: DragonStage): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const ability of DRAGON_STAGES[stage].abilities) {
    if (ability.passiveBonus) {
      bonuses[ability.passiveBonus.stat] = (bonuses[ability.passiveBonus.stat] ?? 0) + ability.passiveBonus.value;
    }
  }
  return bonuses;
}
