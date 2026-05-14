import { eq } from "drizzle-orm";
import { db } from "./db";
import { accounts, kvStore, type User, type InsertUser } from "@shared/schema";
import { nanoid } from "nanoid";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const rows = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    return rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = await db.select().from(accounts).where(eq(accounts.username, username)).limit(1);
    return rows[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = insertUser.id || nanoid();
    await db.insert(accounts).values({ ...insertUser, id });
    const rows = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    return rows[0]!;
  }

  async setItem(key: string, value: string): Promise<void> {
    await db.insert(kvStore).values({ key, value })
      .onDuplicateKeyUpdate({ set: { value } });
  }

  async getItem(key: string): Promise<string | null> {
    const rows = await db.select().from(kvStore).where(eq(kvStore.key, key)).limit(1);
    return rows[0]?.value ?? null;
  }
}

export const storage = new DbStorage();
