import { eq, and, asc, sql } from "drizzle-orm";
import { db } from "./db";
import { gameSaves, type GameSave } from "@shared/schema";

export type SaveSummary = Omit<GameSave, "saveData" | "createdAt">;
export type SaveRecord = GameSave;

export async function listSaves(playerId: string): Promise<SaveSummary[]> {
  return db.select({
    playerId: gameSaves.playerId,
    slot: gameSaves.slot,
    characterId: gameSaves.characterId,
    characterName: gameSaves.characterName,
    characterClass: gameSaves.characterClass,
    characterRace: gameSaves.characterRace,
    level: gameSaves.level,
    playSeconds: gameSaves.playSeconds,
    version: gameSaves.version,
    updatedAt: gameSaves.updatedAt,
  }).from(gameSaves)
    .where(eq(gameSaves.playerId, playerId))
    .orderBy(asc(gameSaves.slot));
}

export async function loadSave(playerId: string, slot: number): Promise<SaveRecord | null> {
  const rows = await db.select().from(gameSaves)
    .where(and(eq(gameSaves.playerId, playerId), eq(gameSaves.slot, slot)))
    .limit(1);
  return rows[0] ?? null;
}

export interface SaveInput {
  characterId?: string | null;
  characterName?: string | null;
  characterClass?: string | null;
  characterRace?: string | null;
  level?: number;
  playSeconds?: number;
  saveData: Record<string, unknown>;
  expectedVersion?: number;
}

export async function upsertSave(
  playerId: string,
  slot: number,
  input: SaveInput,
): Promise<SaveRecord | { conflict: true; current: SaveRecord }> {
  if (typeof input.expectedVersion === "number") {
    const existing = await loadSave(playerId, slot);
    if (existing && existing.version !== input.expectedVersion) {
      return { conflict: true, current: existing };
    }
  }

  await db.insert(gameSaves).values({
    playerId,
    slot,
    characterId: input.characterId ?? null,
    characterName: input.characterName ?? null,
    characterClass: input.characterClass ?? null,
    characterRace: input.characterRace ?? null,
    level: input.level ?? 1,
    playSeconds: input.playSeconds ?? 0,
    saveData: input.saveData,
    version: 1,
  }).onDuplicateKeyUpdate({
    set: {
      characterId: input.characterId ?? null,
      characterName: input.characterName ?? null,
      characterClass: input.characterClass ?? null,
      characterRace: input.characterRace ?? null,
      level: input.level ?? 1,
      playSeconds: input.playSeconds ?? 0,
      saveData: input.saveData,
      version: sql`${gameSaves.version} + 1`,
    },
  });

  const fresh = await loadSave(playerId, slot);
  if (!fresh) throw new Error("Save vanished immediately after upsert");
  return fresh;
}

export async function deleteSave(playerId: string, slot: number): Promise<boolean> {
  const result = await db.delete(gameSaves)
    .where(and(eq(gameSaves.playerId, playerId), eq(gameSaves.slot, slot)));
  return (result[0] as any)?.affectedRows > 0;
}
