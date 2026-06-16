import {
  pgTable, varchar, text, integer, jsonb, timestamp, boolean,
  primaryKey, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Accounts ─────────────────────────────────────────────────────────────────
export const accounts = pgTable("accounts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  username: varchar("username", { length: 128 }).notNull().unique(),
  email: varchar("email", { length: 255 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  discordId: varchar("discord_id", { length: 64 }),
  puterId: varchar("puter_id", { length: 128 }),
  walletAddress: varchar("wallet_address", { length: 128 }),
  authProvider: varchar("auth_provider", { length: 32 }).default("guest"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const insertAccountSchema = createInsertSchema(accounts).pick({
  id: true,
  username: true,
  email: true,
  authProvider: true,
});
export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;

// Legacy aliases
export const users = accounts;
export type User = Account;
export type InsertUser = InsertAccount;

// ── Game Saves ───────────────────────────────────────────────────────────────
export const gameSaves = pgTable("game_saves", {
  playerId: varchar("player_id", { length: 64 }).notNull(),
  slot: integer("slot").notNull().default(0),
  characterId: varchar("character_id", { length: 64 }),
  characterName: varchar("character_name", { length: 128 }),
  characterClass: varchar("character_class", { length: 32 }),
  characterRace: varchar("character_race", { length: 32 }),
  level: integer("level").default(1),
  playSeconds: integer("play_seconds").default(0),
  saveData: jsonb("save_data").notNull().default({}),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  primaryKey({ columns: [t.playerId, t.slot] }),
  index("game_saves_updated_idx").on(t.playerId, t.updatedAt),
]);
export type GameSave = typeof gameSaves.$inferSelect;

// ── Player Loadouts ──────────────────────────────────────────────────────────
export const playerLoadouts = pgTable("player_loadouts", {
  playerId: varchar("player_id", { length: 64 }).notNull(),
  characterId: varchar("character_id", { length: 64 }).notNull(),
  loadoutData: jsonb("loadout_data").notNull().default({}),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  primaryKey({ columns: [t.playerId, t.characterId] }),
  index("player_loadouts_updated_idx").on(t.playerId, t.updatedAt),
]);
export type PlayerLoadout = typeof playerLoadouts.$inferSelect;

// ── Player Inventory (account-level, shared across all apps) ─────────────────
export const playerInventory = pgTable("player_inventory", {
  playerId: varchar("player_id", { length: 64 }).primaryKey(),
  items:    jsonb("items").notNull().default([]),
  /** Optimistic-lock version — bump on every write so cross-app races are detected. */
  version:  integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index("player_inventory_updated_idx").on(t.playerId, t.updatedAt),
]);
export type PlayerInventory = typeof playerInventory.$inferSelect;

// ── Player Wallets ───────────────────────────────────────────────────────────
export const playerWallets = pgTable("player_wallets", {
  playerId: varchar("player_id", { length: 64 }).primaryKey(),
  address: varchar("address", { length: 128 }).notNull(),
  chain: varchar("chain", { length: 32 }).notNull().default("solana"),
  custodialId: varchar("custodial_id", { length: 128 }),
  provider: varchar("provider", { length: 32 }).notNull().default("crossmint"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index("player_wallets_address_idx").on(t.address),
]);
export type PlayerWallet = typeof playerWallets.$inferSelect;

// ── Asset Registry ───────────────────────────────────────────────────────────
export const assetRegistry = pgTable("asset_registry", {
  id: varchar("id", { length: 128 }).primaryKey(),
  category: varchar("category", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  localPath: text("local_path"),
  cdnUrl: text("cdn_url"),
  format: varchar("format", { length: 16 }).default("glb"),
  metadata: jsonb("metadata").default({}),
  boneMap: jsonb("bone_map").default({}),
  animationPack: varchar("animation_pack", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

// ── Weapon Data ──────────────────────────────────────────────────────────────
export const weaponData = pgTable("weapon_data", {
  id: varchar("id", { length: 128 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  tier: integer("tier").default(1),
  stats: jsonb("stats").default({}),
  abilities: jsonb("abilities").default([]),
  passive: jsonb("passive").default([]),
  lore: text("lore"),
  spritePath: text("sprite_path"),
  modelId: varchar("model_id", { length: 128 }),
  grudgeType: varchar("grudge_type", { length: 32 }).default("item"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

// ── Skill Data ───────────────────────────────────────────────────────────────
export const skillData = pgTable("skill_data", {
  id: varchar("id", { length: 128 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  weaponType: varchar("weapon_type", { length: 64 }).notNull(),
  cooldown: varchar("cooldown", { length: 16 }),
  manaCost: integer("mana_cost").default(0),
  description: text("description"),
  grudgeType: varchar("grudge_type", { length: 32 }).default("ability"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

// ── Material Data ────────────────────────────────────────────────────────────
export const materialData = pgTable("material_data", {
  id: varchar("id", { length: 128 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  tier: integer("tier").default(0),
  gatheredBy: varchar("gathered_by", { length: 64 }),
  grudgeType: varchar("grudge_type", { length: 32 }).default("material"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

// ── Armor Data ───────────────────────────────────────────────────────────────
export const armorData = pgTable("armor_data", {
  id: varchar("id", { length: 128 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  armorSet: varchar("armor_set", { length: 128 }),
  type: varchar("type", { length: 64 }),
  material: varchar("material", { length: 64 }),
  attribute: varchar("attribute", { length: 64 }),
  stats: jsonb("stats").default({}),
  passive: text("passive"),
  effect: text("effect"),
  proc: text("proc"),
  setBonus: text("set_bonus"),
  lore: text("lore"),
  spritePath: text("sprite_path"),
  grudgeType: varchar("grudge_type", { length: 32 }).default("equipment"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
}, (t) => [
  index("armor_data_set_idx").on(t.armorSet),
  index("armor_data_material_idx").on(t.material),
]);

// ── Consumable Data ──────────────────────────────────────────────────────────
export const consumableData = pgTable("consumable_data", {
  id: varchar("id", { length: 128 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  lvl: integer("lvl").default(1),
  icon: text("icon"),
  mats: jsonb("mats").default({}),
  stats: jsonb("stats").default({}),
  description: text("description"),
  grudgeType: varchar("grudge_type", { length: 32 }).default("consumable"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
}, (t) => [
  index("consumable_data_cat_idx").on(t.category),
]);

// ── Equipment Config ─────────────────────────────────────────────────────────
export const equipmentConfig = pgTable("equipment_config", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

// ── Player Characters (cross-game character registry) ────────────────────────
// Source of truth for every character a player creates. Shared across ALL
// Grudge Studio games (RTS-Grudge, DCQ, Grudge Crafting, 2D Combat, etc.).
// Hero Forge writes here on create/save; any game mode can read the active
// character to render the player's chosen class, race, and appearance.
export const playerCharacters = pgTable("player_characters", {
  playerId: varchar("player_id", { length: 64 }).notNull(),
  characterId: varchar("character_id", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull().default("Hero"),
  heroClass: varchar("hero_class", { length: 32 }).notNull().default("warrior"),
  race: varchar("race", { length: 32 }).notNull().default("human"),
  modelPath: text("model_path"),
  /** Visual customisation: matColors, bodyMorph, weaponOffset, scale, speedMult */
  appearance: jsonb("appearance").notNull().default({}),
  /** Weapon loadout: weaponRight, weaponLeft, weaponModelRight/Left, arrowModelId, backAccessoryId */
  equipment: jsonb("equipment").notNull().default({}),
  level: integer("level").notNull().default(1),
  isActive: boolean("is_active").notNull().default(false),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  primaryKey({ columns: [t.playerId, t.characterId] }),
  index("player_characters_active_idx").on(t.playerId, t.isActive),
]);
export type PlayerCharacter = typeof playerCharacters.$inferSelect;

// ── KV Store (replaces MemStorage) ───────────────────────────────────────────
export const kvStore = pgTable("kv_store", {
  key: varchar("key", { length: 255 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});
