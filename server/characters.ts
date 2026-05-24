import { eq, and, sql } from "drizzle-orm";
import { db } from "./db";
import { playerCharacters, type PlayerCharacter } from "@shared/schema";
import { nanoid } from "nanoid";

export type CharacterRecord = PlayerCharacter;

// ── Read ─────────────────────────────────────────────────────────────────────

export async function listCharacters(playerId: string): Promise<CharacterRecord[]> {
  return db.select().from(playerCharacters)
    .where(eq(playerCharacters.playerId, playerId))
    .orderBy(playerCharacters.updatedAt);
}

export async function getCharacter(
  playerId: string,
  characterId: string,
): Promise<CharacterRecord | null> {
  const rows = await db.select().from(playerCharacters)
    .where(and(
      eq(playerCharacters.playerId, playerId),
      eq(playerCharacters.characterId, characterId),
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function getActiveCharacter(playerId: string): Promise<CharacterRecord | null> {
  const rows = await db.select().from(playerCharacters)
    .where(and(
      eq(playerCharacters.playerId, playerId),
      eq(playerCharacters.isActive, true),
    ))
    .limit(1);
  return rows[0] ?? null;
}

// ── Write ────────────────────────────────────────────────────────────────────

export interface CreateCharacterInput {
  name?: string;
  heroClass?: string;
  race?: string;
  modelPath?: string;
  appearance?: Record<string, unknown>;
  equipment?: Record<string, unknown>;
}

export async function createCharacter(
  playerId: string,
  input: CreateCharacterInput,
): Promise<CharacterRecord> {
  const characterId = `char_${nanoid(12)}`;

  // Deactivate all other characters so the new one becomes active
  await db.update(playerCharacters)
    .set({ isActive: false })
    .where(eq(playerCharacters.playerId, playerId));

  await db.insert(playerCharacters).values({
    playerId,
    characterId,
    name: input.name ?? "Hero",
    heroClass: input.heroClass ?? "warrior",
    race: input.race ?? "human",
    modelPath: input.modelPath ?? null,
    appearance: (input.appearance ?? {}) as any,
    equipment: (input.equipment ?? {}) as any,
    level: 1,
    isActive: true,
    version: 1,
  });

  const fresh = await getCharacter(playerId, characterId);
  if (!fresh) throw new Error("Character vanished immediately after insert");
  return fresh;
}

export interface UpdateCharacterInput {
  name?: string;
  heroClass?: string;
  race?: string;
  modelPath?: string;
  appearance?: Record<string, unknown>;
  equipment?: Record<string, unknown>;
  level?: number;
  expectedVersion?: number;
}

export async function updateCharacter(
  playerId: string,
  characterId: string,
  input: UpdateCharacterInput,
): Promise<CharacterRecord | { conflict: true; current: CharacterRecord }> {
  if (typeof input.expectedVersion === "number") {
    const existing = await getCharacter(playerId, characterId);
    if (!existing) throw new Error("Character not found");
    if (existing.version !== input.expectedVersion) {
      return { conflict: true, current: existing };
    }
  }

  const setFields: Record<string, unknown> = {
    version: sql`${playerCharacters.version} + 1`,
  };
  if (input.name !== undefined) setFields.name = input.name;
  if (input.heroClass !== undefined) setFields.heroClass = input.heroClass;
  if (input.race !== undefined) setFields.race = input.race;
  if (input.modelPath !== undefined) setFields.modelPath = input.modelPath;
  if (input.appearance !== undefined) setFields.appearance = input.appearance;
  if (input.equipment !== undefined) setFields.equipment = input.equipment;
  if (input.level !== undefined) setFields.level = input.level;

  await db.update(playerCharacters)
    .set(setFields as any)
    .where(and(
      eq(playerCharacters.playerId, playerId),
      eq(playerCharacters.characterId, characterId),
    ));

  const fresh = await getCharacter(playerId, characterId);
  if (!fresh) throw new Error("Character vanished after update");
  return fresh;
}

// ── Delete ───────────────────────────────────────────────────────────────────

export async function deleteCharacter(
  playerId: string,
  characterId: string,
): Promise<boolean> {
  const result = await db.delete(playerCharacters)
    .where(and(
      eq(playerCharacters.playerId, playerId),
      eq(playerCharacters.characterId, characterId),
    ));
  return (result[0] as any)?.affectedRows > 0;
}

// ── Activate ─────────────────────────────────────────────────────────────────

export async function activateCharacter(
  playerId: string,
  characterId: string,
): Promise<CharacterRecord | null> {
  // Deactivate all
  await db.update(playerCharacters)
    .set({ isActive: false })
    .where(eq(playerCharacters.playerId, playerId));

  // Activate target
  await db.update(playerCharacters)
    .set({ isActive: true })
    .where(and(
      eq(playerCharacters.playerId, playerId),
      eq(playerCharacters.characterId, characterId),
    ));

  return getCharacter(playerId, characterId);
}
