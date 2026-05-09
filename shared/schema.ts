import { pgTable, text, serial, integer, boolean, jsonb, timestamp, index, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ══════════════════════════════════════════════════════════════════════════════
// Grudge Warlords — Game Database Schema (Railway PostgreSQL)
//
// This DB stores game-specific state. Account identity lives on
// api.grudge-studio.com — we link to it via grudgeId.
// ══════════════════════════════════════════════════════════════════════════════

// ── Accounts (linked to Grudge Studio identity) ─────────────────────────────

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  grudgeId: text("grudge_id").notNull().unique(),
  username: text("username"),
  email: text("email"),
  role: text("role").default("user"),
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
}, (t) => ({
  grudgeIdx: index("accounts_grudge_id_idx").on(t.grudgeId),
}));

// ── Characters ──────────────────────────────────────────────────────────────

export const characters = pgTable("characters", {
  id: serial("id").primaryKey(),
  uuid: text("uuid").notNull().unique(),
  accountId: integer("account_id").references(() => accounts.id),
  name: text("name").notNull(),
  race: text("race").notNull(),        // human, elf, dwarf, orc, barbarian, undead
  heroClass: text("hero_class").notNull(), // warrior, ranger, mage, worge
  faction: text("faction").notNull(),   // crusade, fabled, legion
  level: integer("level").default(1),
  experience: integer("experience").default(0),
  // 8 primary attributes stored as JSON for flexibility
  attributes: jsonb("attributes").default({}),
  // Equipment loadout (slot → item UUID)
  equipment: jsonb("equipment").default({}),
  // Modular character loadout (slot variant picks from race/class select)
  loadout: jsonb("loadout").default({}),
  modelPath: text("model_path"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  accountIdx: index("characters_account_id_idx").on(t.accountId),
  uuidIdx: index("characters_uuid_idx").on(t.uuid),
}));

// ── Inventory ───────────────────────────────────────────────────────────────

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  uuid: text("uuid").notNull().unique(),
  characterId: integer("character_id").references(() => characters.id),
  name: text("name").notNull(),
  type: text("type").notNull(),         // weapon, armor, material, consumable, resource
  tier: integer("tier").default(1),
  quantity: integer("quantity").default(1),
  stats: jsonb("stats").default({}),
  slot: text("slot"),                   // head, chest, hands, legs, feet, cape, accessory, mainHand, offHand
  weaponType: text("weapon_type"),
  iconPath: text("icon_path"),
  craftedBy: text("crafted_by"),        // profession that crafted it
  quality: text("quality").default("Normal"), // Poor, Normal, Good, Superior, Masterwork
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  characterIdx: index("inventory_character_id_idx").on(t.characterId),
}));

// ── Professions ─────────────────────────────────────────────────────────────

export const professions = pgTable("professions", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").references(() => characters.id),
  professionId: text("profession_id").notNull(), // miner, forester, chef, engineer, mystic, mining, woodcutting, etc
  level: integer("level").default(1),
  xp: integer("xp").default(0),
  // Invested skill tree nodes (node_id → rank)
  skills: jsonb("skills").default({}),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  characterProfIdx: index("professions_char_prof_idx").on(t.characterId, t.professionId),
}));

// ── Island State (buildings, allies, resources) ─────────────────────────────

export const islands = pgTable("islands", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").references(() => characters.id).unique(),
  // Full building placements array
  buildings: jsonb("buildings").default([]),
  // Ally data (name, type, level, xp, equipment, position)
  allies: jsonb("allies").default([]),
  // Resource counts (wood, stone, gold, etc)
  resources: jsonb("resources").default({}),
  // World map sector states
  sectorStates: jsonb("sector_states").default({}),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  characterIdx: index("islands_character_id_idx").on(t.characterId),
}));

// ── Crafting Log ────────────────────────────────────────────────────────────

export const craftingLog = pgTable("crafting_log", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").references(() => characters.id),
  recipeId: text("recipe_id").notNull(),
  station: text("station").notNull(),
  tier: integer("tier").default(1),
  quality: text("quality"),
  success: boolean("success").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Game Sessions (for analytics and AFK summaries) ─────────────────────────

export const gameSessions = pgTable("game_sessions", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").references(() => characters.id),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  duration: integer("duration"),         // seconds
  xpGained: integer("xp_gained").default(0),
  resourcesGathered: jsonb("resources_gathered").default({}),
  enemiesKilled: integer("enemies_killed").default(0),
  buildingsPlaced: integer("buildings_placed").default(0),
});

// ── Zod Schemas for API validation ──────────────────────────────────────────

export const insertAccountSchema = createInsertSchema(accounts).pick({
  grudgeId: true,
  username: true,
  email: true,
});

export const insertCharacterSchema = createInsertSchema(characters).pick({
  uuid: true,
  name: true,
  race: true,
  heroClass: true,
  faction: true,
  attributes: true,
  loadout: true,
  modelPath: true,
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).pick({
  uuid: true,
  name: true,
  type: true,
  tier: true,
  quantity: true,
  stats: true,
  slot: true,
  weaponType: true,
  iconPath: true,
  quality: true,
});

// ── Type Exports ────────────────────────────────────────────────────────────

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Character = typeof characters.$inferSelect;
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type Profession = typeof professions.$inferSelect;
export type Island = typeof islands.$inferSelect;
export type CraftingLogEntry = typeof craftingLog.$inferSelect;
export type GameSession = typeof gameSessions.$inferSelect;

// ── Legacy compat (some server routes still reference 'users') ──────────────
export const users = accounts;
export type User = Account;
export type InsertUser = InsertAccount;
