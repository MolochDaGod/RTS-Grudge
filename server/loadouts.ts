import { eq, and, sql } from "drizzle-orm";
import { db } from "./db";
import { playerLoadouts, type PlayerLoadout } from "@shared/schema";

export type LoadoutRecord = PlayerLoadout;

export async function loadLoadout(
  playerId: string,
  characterId: string,
): Promise<LoadoutRecord | null> {
  const rows = await db.select().from(playerLoadouts)
    .where(and(eq(playerLoadouts.playerId, playerId), eq(playerLoadouts.characterId, characterId)))
    .limit(1);
  return rows[0] ?? null;
}

export interface LoadoutInput {
  loadoutData: Record<string, unknown>;
  expectedVersion?: number;
}

export async function upsertLoadout(
  playerId: string,
  characterId: string,
  input: LoadoutInput,
): Promise<LoadoutRecord | { conflict: true; current: LoadoutRecord }> {
  if (typeof input.expectedVersion === "number") {
    const existing = await loadLoadout(playerId, characterId);
    if (existing && existing.version !== input.expectedVersion) {
      return { conflict: true, current: existing };
    }
  }

  await db.insert(playerLoadouts).values({
    playerId,
    characterId,
    loadoutData: input.loadoutData,
    version: 1,
  }).onDuplicateKeyUpdate({
    set: {
      loadoutData: input.loadoutData,
      version: sql`${playerLoadouts.version} + 1`,
    },
  });

  const fresh = await loadLoadout(playerId, characterId);
  if (!fresh) throw new Error("Loadout vanished immediately after upsert");
  return fresh;
}

export async function deleteLoadout(
  playerId: string,
  characterId: string,
): Promise<boolean> {
  const result = await db.delete(playerLoadouts)
    .where(and(eq(playerLoadouts.playerId, playerId), eq(playerLoadouts.characterId, characterId)));
  return (result[0] as any)?.affectedRows > 0;
}
