import { users, type User, type InsertUser } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private kvStore: Map<string, string>;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.kvStore = new Map();
    this.currentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = {
      id,
      grudgeId: insertUser.grudgeId,
      username: insertUser.username ?? null,
      email: insertUser.email ?? null,
      role: "user",
      createdAt: new Date(),
      lastLogin: null,
    };
    this.users.set(id, user);
    return user;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.kvStore.set(key, value);
  }

  async getItem(key: string): Promise<string | null> {
    return this.kvStore.get(key) ?? null;
  }
}

export const storage = new MemStorage();
