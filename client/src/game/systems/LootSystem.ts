import { useInventory } from "@/lib/stores/useInventory";
import type { EnemyData, LootDrop } from "./EnemyManager";

export type ContainerLootKind = "chest" | "sarcophagus" | "bookshelf";

const CHEST_LOOT: LootDrop[] = [
  { itemId: "gold_coin",        name: "Gold Coin",          icon: "🪙", chance: 1.0,  quantity: [5, 15], type: "gold" },
  { itemId: "rare_gem",         name: "Rare Gem",           icon: "💠", chance: 0.40, quantity: [1, 2],  type: "material" },
  { itemId: "magic_crystal",    name: "Magic Crystal",      icon: "💎", chance: 0.30, quantity: [1, 1],  type: "material" },
  { itemId: "potion_health",    name: "Health Potion",      icon: "❤️", chance: 0.40, quantity: [1, 2],  type: "potion" },
  { itemId: "scroll_arcane",    name: "Arcane Scroll",      icon: "📜", chance: 0.25, quantity: [1, 1],  type: "equipment" },
  { itemId: "wooden_sword",     name: "Wooden Sword",       icon: "🗡️", chance: 0.15, quantity: [1, 1],  type: "equipment" },
  // Dragon eggs are rare finds in dungeon end chests — place in Furnace to hatch
  { itemId: "dragon_egg",       name: "Dragon Egg",         icon: "🥚", chance: 0.05, quantity: [1, 1],  type: "material" },
];

const SARCOPHAGUS_LOOT: LootDrop[] = [
  { itemId: "gold_coin",         name: "Gold Coin",           icon: "🪙", chance: 1.0,  quantity: [3, 10], type: "gold" },
  { itemId: "bone",              name: "Bone",                icon: "🦴", chance: 0.80, quantity: [1, 3],  type: "material" },
  { itemId: "rare_gem",          name: "Rare Gem",            icon: "💠", chance: 0.25, quantity: [1, 1],  type: "material" },
  { itemId: "potion_health_minor", name: "Minor Health Potion", icon: "❤️", chance: 0.30, quantity: [1, 1], type: "potion" },
  { itemId: "legendary_shard",   name: "Legendary Shard",     icon: "✨", chance: 0.05, quantity: [1, 1],  type: "material" },
];

const BOOKSHELF_LOOT: LootDrop[] = [
  { itemId: "gold_coin",          name: "Gold Coin",           icon: "🪙", chance: 0.50, quantity: [1, 5], type: "gold" },
  { itemId: "scroll_arcane",      name: "Arcane Scroll",       icon: "📜", chance: 0.50, quantity: [1, 2], type: "equipment" },
  { itemId: "potion_mana_minor",  name: "Minor Mana Potion",   icon: "💙", chance: 0.40, quantity: [1, 1], type: "potion" },
  { itemId: "potion_mana",        name: "Mana Potion",         icon: "💙", chance: 0.15, quantity: [1, 1], type: "potion" },
  { itemId: "magic_crystal",      name: "Magic Crystal",       icon: "💎", chance: 0.15, quantity: [1, 1], type: "material" },
];

const CONTAINER_LOOT_TABLES: Record<ContainerLootKind, LootDrop[]> = {
  chest: CHEST_LOOT,
  sarcophagus: SARCOPHAGUS_LOOT,
  bookshelf: BOOKSHELF_LOOT,
};

export interface DroppedLoot {
  id: string;
  itemId: string;
  name: string;
  icon: string;
  quantity: number;
  type: LootDrop["type"];
  position: [number, number, number];
  spawnTime: number;
}

let lootIdCounter = 0;

export function rollLootDrops(enemy: EnemyData): DroppedLoot[] {
  const drops: DroppedLoot[] = [];
  const pos = enemy.position;

  for (const loot of enemy.loot) {
    if (Math.random() <= loot.chance) {
      const qty = loot.quantity[0] + Math.floor(Math.random() * (loot.quantity[1] - loot.quantity[0] + 1));
      const spreadX = (Math.random() - 0.5) * 2;
      const spreadZ = (Math.random() - 0.5) * 2;
      drops.push({
        id: `loot_${lootIdCounter++}`,
        itemId: loot.itemId,
        name: loot.name,
        icon: loot.icon,
        quantity: qty,
        type: loot.type,
        position: [pos.x + spreadX, pos.y + 0.5, pos.z + spreadZ],
        spawnTime: Date.now(),
      });
    }
  }

  const tierBonus = {
    common: 0,
    uncommon: 1,
    rare: 3,
    elite: 8,
    boss: 20,
  };
  const bonusGold = tierBonus[enemy.tier] || 0;
  if (bonusGold > 0) {
    drops.push({
      id: `loot_${lootIdCounter++}`,
      itemId: "gold_coin",
      name: "Gold Coin",
      icon: "🪙",
      quantity: bonusGold + Math.floor(Math.random() * bonusGold),
      type: "gold",
      position: [pos.x, pos.y + 0.5, pos.z],
      spawnTime: Date.now(),
    });
  }

  return drops;
}

/**
 * Roll loot drops for a destructible "loot container" decor (chest,
 * sarcophagus, bookshelf). Mirrors `rollLootDrops` for enemies but
 * keyed by container kind and an explicit world position, since
 * decor is not an `EnemyData`.
 */
export function rollContainerLootDrops(
  kind: ContainerLootKind,
  x: number,
  y: number,
  z: number,
): DroppedLoot[] {
  const table = CONTAINER_LOOT_TABLES[kind];
  if (!table) return [];

  const drops: DroppedLoot[] = [];
  for (const loot of table) {
    if (Math.random() <= loot.chance) {
      const qty = loot.quantity[0] + Math.floor(Math.random() * (loot.quantity[1] - loot.quantity[0] + 1));
      const spreadX = (Math.random() - 0.5) * 1.2;
      const spreadZ = (Math.random() - 0.5) * 1.2;
      drops.push({
        id: `loot_${lootIdCounter++}`,
        itemId: loot.itemId,
        name: loot.name,
        icon: loot.icon,
        quantity: qty,
        type: loot.type,
        position: [x + spreadX, Math.max(0.3, y), z + spreadZ],
        spawnTime: Date.now(),
      });
    }
  }
  return drops;
}

export function collectLoot(loot: DroppedLoot) {
  if (loot.type === "potion") {
    useInventory.getState().addItem({
      id: loot.itemId,
      name: loot.name,
      icon: loot.icon,
      quantity: loot.quantity,
      type: "consumable",
    });
  } else {
    useInventory.getState().addItem({
      id: loot.itemId,
      name: loot.name,
      icon: loot.icon,
      quantity: loot.quantity,
      type: loot.type === "food" ? "food" : "material",
    });
  }
}

const LOOT_PICKUP_RANGE = 3.0;
const LOOT_DESPAWN_TIME = 60000;

export function shouldPickupLoot(loot: DroppedLoot, playerX: number, playerZ: number): boolean {
  const dx = loot.position[0] - playerX;
  const dz = loot.position[2] - playerZ;
  return (dx * dx + dz * dz) < LOOT_PICKUP_RANGE * LOOT_PICKUP_RANGE;
}

export function isLootExpired(loot: DroppedLoot): boolean {
  return Date.now() - loot.spawnTime > LOOT_DESPAWN_TIME;
}
