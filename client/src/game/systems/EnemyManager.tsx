import { create } from "zustand";
import * as THREE from "three";
import { registerEnemyReset } from "@/lib/stores/useGame";
import { vfx, VFXPresets } from "../vfx";

export type EnemyType =
  | "skeleton" | "spider" | "golem" | "pirate" | "witch" | "ninja"
  | "orc" | "demon" | "blue_demon" | "dragon" | "mushroom_king"
  | "yeti" | "ghost" | "frog" | "blob" | "cactoro" | "tribal" | "dino"
  | "bunny" | "alien"
  | "thrower_brute" | "thrower_assassin" | "thrower_soldier" | "thrower_berserker"
  | "raptor" | "trex" | "triceratops"
  // Dark Elf camp enemies — replace pirate camps as spawnable dark elf camps
  | "dark_elf"
  // Flying boss enemies
  | "armabee" | "alpaking"
  // Advance Wars / sci-fi units from object storage
  | "aw_infantry" | "aw_mech" | "aw_tank" | "mech_tripod"
  | "scifi_soldier" | "cyborg_unit" | "cyborg_soldier"
  | "shadow_soldier" | "scifi_trooper" | "scifi_officer";

export type EnemyTier = "common" | "uncommon" | "rare" | "elite" | "boss";

export interface LootDrop {
  itemId: string;
  name: string;
  icon: string;
  chance: number;
  quantity: [number, number];
  type: "material" | "food" | "equipment" | "gold" | "potion";
}

export interface EnemyData {
  id: string;
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  type: EnemyType;
  tier: EnemyTier;
  isAttacking: boolean;
  isHit: boolean;
  lastAttackTime: number;
  attackCooldown: number;
  detectionRange: number;
  attackRange: number;
  color: string;
  scale: number;
  isDying: boolean;
  xpReward: number;
  loot: LootDrop[];
}

interface EnemyManagerState {
  enemies: EnemyData[];
  spawnEnemy: (type: EnemyType, position: THREE.Vector3) => void;
  removeEnemy: (id: string) => void;
  damageEnemy: (id: string, amount: number) => boolean;
  updateEnemy: (id: string, updates: Partial<EnemyData>) => void;
  reset: () => void;
  getEnemy: (id: string) => EnemyData | undefined;
}

let enemyIdCounter = 0;

let _onEnemyDeathCallback: ((enemy: EnemyData) => void) | null = null;
export function registerEnemyDeathCallback(cb: (enemy: EnemyData) => void) {
  _onEnemyDeathCallback = cb;
}

const COMMON_LOOT: LootDrop[] = [
  { itemId: "gold_coin", name: "Gold Coin", icon: "🪙", chance: 0.6, quantity: [1, 5], type: "gold" },
  { itemId: "bone", name: "Bone", icon: "🦴", chance: 0.3, quantity: [1, 2], type: "material" },
  { itemId: "potion_health_minor", name: "Minor Health Potion", icon: "❤️", chance: 0.15, quantity: [1, 1], type: "potion" },
];

const UNCOMMON_LOOT: LootDrop[] = [
  ...COMMON_LOOT,
  { itemId: "iron_shard", name: "Iron Shard", icon: "🔩", chance: 0.25, quantity: [1, 3], type: "material" },
  { itemId: "raw_meat", name: "Raw Meat", icon: "🥩", chance: 0.4, quantity: [1, 2], type: "food" },
  { itemId: "potion_mana_minor", name: "Minor Mana Potion", icon: "💙", chance: 0.12, quantity: [1, 1], type: "potion" },
  { itemId: "potion_stamina_minor", name: "Minor Stamina Potion", icon: "💚", chance: 0.1, quantity: [1, 1], type: "potion" },
];

const RARE_LOOT: LootDrop[] = [
  ...UNCOMMON_LOOT,
  { itemId: "magic_crystal", name: "Magic Crystal", icon: "💎", chance: 0.15, quantity: [1, 1], type: "material" },
  { itemId: "rare_gem", name: "Rare Gem", icon: "💠", chance: 0.1, quantity: [1, 1], type: "material" },
  { itemId: "potion_health", name: "Health Potion", icon: "❤️", chance: 0.2, quantity: [1, 1], type: "potion" },
  { itemId: "potion_mana", name: "Mana Potion", icon: "💙", chance: 0.15, quantity: [1, 1], type: "potion" },
];

const ELITE_LOOT: LootDrop[] = [
  ...RARE_LOOT,
  { itemId: "dragon_scale", name: "Dragon Scale", icon: "🐉", chance: 0.3, quantity: [1, 2], type: "material" },
  { itemId: "elite_token", name: "Elite Token", icon: "⭐", chance: 0.5, quantity: [1, 1], type: "material" },
  { itemId: "potion_health_greater", name: "Greater Health Potion", icon: "❤️", chance: 0.25, quantity: [1, 2], type: "potion" },
  { itemId: "potion_strength", name: "Strength Potion", icon: "🧡", chance: 0.15, quantity: [1, 1], type: "potion" },
  { itemId: "potion_speed", name: "Speed Potion", icon: "💛", chance: 0.12, quantity: [1, 1], type: "potion" },
];

const BOSS_LOOT: LootDrop[] = [
  ...ELITE_LOOT,
  { itemId: "boss_trophy",         name: "Boss Trophy",           icon: "🏆", chance: 1.0,  quantity: [1, 1], type: "equipment" },
  { itemId: "legendary_shard",     name: "Legendary Shard",       icon: "✨", chance: 0.4,  quantity: [1, 1], type: "material" },
  { itemId: "potion_health_supreme",name: "Supreme Health Potion", icon: "❤️", chance: 0.5, quantity: [1, 2], type: "potion" },
  { itemId: "potion_elixir",        name: "Elixir of Power",       icon: "💜", chance: 0.3,  quantity: [1, 1], type: "potion" },
  // Dragon eggs: boss-tier drops — placed in a Furnace to cook and hatch a baby dragon
  { itemId: "dragon_egg",           name: "Dragon Egg",            icon: "🥚", chance: 0.15, quantity: [1, 1], type: "material" },
];

function lootForTier(tier: EnemyTier): LootDrop[] {
  switch (tier) {
    case "common": return COMMON_LOOT;
    case "uncommon": return UNCOMMON_LOOT;
    case "rare": return RARE_LOOT;
    case "elite": return ELITE_LOOT;
    case "boss": return BOSS_LOOT;
  }
}

const ENEMY_TEMPLATES: Partial<Record<EnemyType, Omit<EnemyData, "id" | "position" | "loot">>> = {
  skeleton: { health: 40, maxHealth: 40, speed: 3, damage: 8, type: "skeleton", tier: "common", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.2, detectionRange: 18, attackRange: 2.5, color: "#d4c4a0", scale: 1.0, xpReward: 15 },
  spider: { health: 25, maxHealth: 25, speed: 5, damage: 6, type: "spider", tier: "common", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 0.8, detectionRange: 14, attackRange: 2.0, color: "#3a3a2a", scale: 0.7, xpReward: 10 },
  golem: { health: 120, maxHealth: 120, speed: 1.5, damage: 20, type: "golem", tier: "rare", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 2.5, detectionRange: 12, attackRange: 3.5, color: "#6a6a6a", scale: 1.8, xpReward: 50 },
  pirate: { health: 55, maxHealth: 55, speed: 3.5, damage: 12, type: "pirate", tier: "uncommon", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.0, detectionRange: 20, attackRange: 2.8, color: "#8B4513", scale: 1.0, xpReward: 25 },
  witch: { health: 35, maxHealth: 35, speed: 2.5, damage: 15, type: "witch", tier: "uncommon", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 2.0, detectionRange: 25, attackRange: 4.0, color: "#6B2D8B", scale: 1.0, xpReward: 30 },
  ninja: { health: 30, maxHealth: 30, speed: 7, damage: 10, type: "ninja", tier: "uncommon", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 0.6, detectionRange: 22, attackRange: 2.0, color: "#8B6914", scale: 1.0, xpReward: 20 },

  orc: { health: 80, maxHealth: 80, speed: 3, damage: 16, type: "orc", tier: "uncommon", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.3, detectionRange: 18, attackRange: 3.0, color: "#4a6b3a", scale: 1.4, xpReward: 35 },
  demon: { health: 150, maxHealth: 150, speed: 4, damage: 25, type: "demon", tier: "elite", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.5, detectionRange: 25, attackRange: 3.5, color: "#cc2222", scale: 2.0, xpReward: 80 },
  blue_demon: { health: 100, maxHealth: 100, speed: 3.5, damage: 18, type: "blue_demon", tier: "rare", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.4, detectionRange: 22, attackRange: 3.0, color: "#3344cc", scale: 1.6, xpReward: 55 },
  dragon: { health: 300, maxHealth: 300, speed: 5, damage: 40, type: "dragon", tier: "boss", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 2.0, detectionRange: 35, attackRange: 5.0, color: "#aa3300", scale: 3.0, xpReward: 300 },
  mushroom_king: { health: 200, maxHealth: 200, speed: 2, damage: 22, type: "mushroom_king", tier: "elite", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.8, detectionRange: 15, attackRange: 4.0, color: "#aa4455", scale: 2.5, xpReward: 100 },
  yeti: { health: 180, maxHealth: 180, speed: 3, damage: 30, type: "yeti", tier: "elite", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 2.0, detectionRange: 20, attackRange: 3.5, color: "#ccddee", scale: 2.2, xpReward: 90 },
  ghost: { health: 45, maxHealth: 45, speed: 4, damage: 14, type: "ghost", tier: "uncommon", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.0, detectionRange: 20, attackRange: 3.0, color: "#aabbcc", scale: 1.2, xpReward: 30 },
  frog: { health: 60, maxHealth: 60, speed: 6, damage: 10, type: "frog", tier: "common", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 0.7, detectionRange: 15, attackRange: 3.0, color: "#55aa55", scale: 1.3, xpReward: 20 },
  blob: { health: 35, maxHealth: 35, speed: 2, damage: 5, type: "blob", tier: "common", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.5, detectionRange: 10, attackRange: 2.0, color: "#66cc66", scale: 0.8, xpReward: 8 },
  cactoro: { health: 70, maxHealth: 70, speed: 2.5, damage: 12, type: "cactoro", tier: "uncommon", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.2, detectionRange: 14, attackRange: 2.5, color: "#33aa55", scale: 1.3, xpReward: 25 },
  tribal: { health: 65, maxHealth: 65, speed: 4, damage: 14, type: "tribal", tier: "uncommon", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.0, detectionRange: 20, attackRange: 2.8, color: "#886644", scale: 1.2, xpReward: 30 },
  dino: { health: 250, maxHealth: 250, speed: 5, damage: 35, type: "dino", tier: "boss", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.8, detectionRange: 30, attackRange: 4.5, color: "#558833", scale: 3.0, xpReward: 180 },
  raptor: { health: 120, maxHealth: 120, speed: 8, damage: 22, type: "raptor", tier: "rare", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 0.7, detectionRange: 25, attackRange: 3.0, color: "#446633", scale: 2.0, xpReward: 65 },
  trex: { health: 400, maxHealth: 400, speed: 4, damage: 50, type: "trex", tier: "boss", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 2.2, detectionRange: 35, attackRange: 6.0, color: "#664422", scale: 4.5, xpReward: 250 },
  triceratops: { health: 300, maxHealth: 300, speed: 3.5, damage: 38, type: "triceratops", tier: "elite", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 2.0, detectionRange: 20, attackRange: 5.0, color: "#556644", scale: 3.5, xpReward: 150 },
  bunny: { health: 15, maxHealth: 15, speed: 8, damage: 3, type: "bunny", tier: "common", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 0.5, detectionRange: 8, attackRange: 1.5, color: "#ddccbb", scale: 0.6, xpReward: 5 },
  alien: { health: 160, maxHealth: 160, speed: 4.5, damage: 28, type: "alien", tier: "elite", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.2, detectionRange: 28, attackRange: 4.0, color: "#44cc88", scale: 1.8, xpReward: 85 },

  // Thrower archetypes — Paladin/Robot-style ranged casters from §3.5 of the
  // audit. They spawn an EnemyHadoukenProjectile (team="enemy") on attack,
  // which the player can block to flip allegiance and rebound it. The wide
  // attackRange is what makes them ranged in the BT — once the player is
  // within this radius, the BT immediately fires a shot instead of charging
  // into melee. attackCooldown is the cast cadence.
  thrower_brute:     { health: 90,  maxHealth: 90,  speed: 3.0, damage: 14, type: "thrower_brute",     tier: "uncommon", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 2.4, detectionRange: 26, attackRange: 16, color: "#cc4444", scale: 1.0, xpReward: 30 },
  thrower_assassin:  { health: 55,  maxHealth: 55,  speed: 5.0, damage: 10, type: "thrower_assassin",  tier: "uncommon", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.6, detectionRange: 24, attackRange: 14, color: "#aa3366", scale: 1.0, xpReward: 25 },
  thrower_soldier:   { health: 100, maxHealth: 100, speed: 3.5, damage: 12, type: "thrower_soldier",   tier: "uncommon", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 2.0, detectionRange: 24, attackRange: 15, color: "#4466aa", scale: 1.0, xpReward: 28 },
  thrower_berserker: { health: 120, maxHealth: 120, speed: 4.0, damage: 16, type: "thrower_berserker", tier: "rare",     isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.8, detectionRange: 26, attackRange: 16, color: "#cc6600", scale: 1.0, xpReward: 40 },

  // ── Dark Elf camp enemies — spawnable pirate camps replaced by dark elf camps ──
  // dark_elf soldiers are uncommon, their captains are elite, their warlord is boss
  dark_elf:  { health: 60, maxHealth: 60, speed: 4, damage: 14, type: "dark_elf", tier: "uncommon", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.0, detectionRange: 22, attackRange: 2.8, color: "#3a2255", scale: 1.0, xpReward: 30 },

  // ── Flying boss enemies ──────────────────────────────────────────────────────
  armabee:  { health: 80,  maxHealth: 80,  speed: 6, damage: 16, type: "armabee",  tier: "rare",  isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 0.9, detectionRange: 24, attackRange: 3.5, color: "#ffcc00", scale: 1.2, xpReward: 50 },
  alpaking:  { health: 220, maxHealth: 220, speed: 4, damage: 28, type: "alpaking",  tier: "elite", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.8, detectionRange: 30, attackRange: 4.5, color: "#ff88aa", scale: 2.0, xpReward: 110 },

  // ── Advance Wars / sci-fi units (loaded from object storage CDN) ─────
  aw_infantry:     { health: 50,  maxHealth: 50,  speed: 3.5, damage: 10, type: "aw_infantry",     tier: "common",   isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.0, detectionRange: 20, attackRange: 2.5,  color: "#5577aa", scale: 1.0, xpReward: 15 },
  aw_mech:         { health: 140, maxHealth: 140, speed: 2.5, damage: 22, type: "aw_mech",         tier: "rare",     isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.8, detectionRange: 22, attackRange: 3.5,  color: "#886633", scale: 1.6, xpReward: 55 },
  aw_tank:         { health: 250, maxHealth: 250, speed: 4.0, damage: 35, type: "aw_tank",         tier: "elite",    isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 2.2, detectionRange: 28, attackRange: 14,   color: "#556644", scale: 2.0, xpReward: 100 },
  mech_tripod:     { health: 400, maxHealth: 400, speed: 3.0, damage: 45, type: "mech_tripod",     tier: "boss",     isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 2.5, detectionRange: 35, attackRange: 16,   color: "#444455", scale: 3.5, xpReward: 220 },
  scifi_soldier:   { health: 60,  maxHealth: 60,  speed: 4.5, damage: 14, type: "scifi_soldier",   tier: "uncommon", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 0.9, detectionRange: 24, attackRange: 12,   color: "#336699", scale: 1.0, xpReward: 25 },
  cyborg_unit:     { health: 180, maxHealth: 180, speed: 5.0, damage: 28, type: "cyborg_unit",     tier: "elite",    isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.2, detectionRange: 28, attackRange: 14,   color: "#44cccc", scale: 1.4, xpReward: 85 },
  cyborg_soldier:  { health: 150, maxHealth: 150, speed: 4.0, damage: 24, type: "cyborg_soldier",  tier: "rare",     isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.4, detectionRange: 26, attackRange: 13,   color: "#6688aa", scale: 1.2, xpReward: 65 },
  shadow_soldier:  { health: 70,  maxHealth: 70,  speed: 5.5, damage: 16, type: "shadow_soldier",  tier: "uncommon", isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 0.8, detectionRange: 26, attackRange: 14,   color: "#333344", scale: 1.0, xpReward: 30 },
  scifi_trooper:   { health: 55,  maxHealth: 55,  speed: 4.0, damage: 12, type: "scifi_trooper",   tier: "common",   isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.0, detectionRange: 22, attackRange: 12,   color: "#558866", scale: 1.0, xpReward: 20 },
  scifi_officer:   { health: 80,  maxHealth: 80,  speed: 3.5, damage: 18, type: "scifi_officer",   tier: "rare",     isAttacking: false, isHit: false, isDying: false, lastAttackTime: 0, attackCooldown: 1.6, detectionRange: 28, attackRange: 16,   color: "#aa6633", scale: 1.0, xpReward: 45 },
};

export function getEnemyTierColor(tier: EnemyTier): string {
  switch (tier) {
    case "common": return "#aaaaaa";
    case "uncommon": return "#33cc33";
    case "rare": return "#3399ff";
    case "elite": return "#cc66ff";
    case "boss": return "#ff9900";
  }
}

export function getEnemyTypes(): EnemyType[] {
  return Object.keys(ENEMY_TEMPLATES) as EnemyType[];
}

export function getEnemyTemplate(type: EnemyType) {
  return ENEMY_TEMPLATES[type];
}

export function getEnemiesByTier(tier: EnemyTier): EnemyType[] {
  return (Object.entries(ENEMY_TEMPLATES) as [EnemyType, typeof ENEMY_TEMPLATES[EnemyType]][])
    .filter(([_, t]) => t?.tier === tier)
    .map(([type]) => type);
}

export const useEnemyManager = create<EnemyManagerState>()((set, get) => ({
  enemies: [],

  spawnEnemy: (type, position) => {
    const template = ENEMY_TEMPLATES[type];
    if (!template) return;
    const enemy: EnemyData = {
      ...template,
      id: `enemy_${enemyIdCounter++}`,
      position: position.clone(),
      loot: lootForTier(template.tier),
    };
    set((state) => ({ enemies: [...state.enemies, enemy] }));
  },

  removeEnemy: (id) => {
    set((state) => ({ enemies: state.enemies.filter((e) => e.id !== id) }));
  },

  damageEnemy: (id, amount) => {
    const enemy = get().enemies.find((e) => e.id === id);
    if (!enemy || enemy.isDying) return false;
    const newHealth = enemy.health - amount;
    // Centralized blood splatter — every damage path (player melee, ally,
    // projectile, dot tick) converges here, so this single call covers the
    // whole game without sprinkling vfx calls into every attack site. Burst
    // size scales with damage so a chargeStrike reads visually heavier than
    // a basic poke.
    const torsoY = enemy.position.y + Math.max(0.6, enemy.scale * 0.9);
    const burstCount = Math.min(28, 8 + Math.round(amount * 0.5));
    vfx.burst(
      VFXPresets.bloodBurst([enemy.position.x, torsoY, enemy.position.z], burstCount),
    );
    if (newHealth <= 0) {
      get().updateEnemy(id, { health: 0, isDying: true, isHit: false });

      if (_onEnemyDeathCallback) {
        _onEnemyDeathCallback(enemy);
      }

      setTimeout(() => {
        get().removeEnemy(id);
      }, 1500);
      return true;
    }
    get().updateEnemy(id, { health: newHealth, isHit: true });
    setTimeout(() => {
      get().updateEnemy(id, { isHit: false });
    }, 400);
    return false;
  },

  updateEnemy: (id, updates) => {
    set((state) => ({
      enemies: state.enemies.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  },

  getEnemy: (id) => get().enemies.find((e) => e.id === id),

  reset: () => {
    enemyIdCounter = 0;
    set({ enemies: [] });
  },
}));

registerEnemyReset(() => useEnemyManager.getState().reset());
