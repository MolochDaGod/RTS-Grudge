import { Pool } from "pg";

/**
 * NOTE: This module uses the standard `pg` (node-postgres) library to connect
 * to a Railway PostgreSQL instance via a standard postgres:// connection string.
 * The DATABASE_URL environment variable must be set to the Railway-provided
 * connection string.
 */

let _pool: Pool | null = null;
function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL || process.env.GRUDGE_DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not configured");
    _pool = new Pool({
      connectionString: url,
      // Railway Postgres uses SSL in production; allow self-signed certs.
      ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
    });
    _pool.on("error", (err) => {
      console.error("[saves] pg pool error:", err);
    });
  }
  return _pool;
}

async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function initSavesDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS game_saves (
      player_id TEXT NOT NULL,
      slot INTEGER NOT NULL DEFAULT 0,
      character_id TEXT,
      character_name TEXT,
      character_class TEXT,
      character_race TEXT,
      level INTEGER DEFAULT 1,
      play_seconds INTEGER DEFAULT 0,
      save_data JSONB NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (player_id, slot)
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS game_saves_updated_idx ON game_saves(player_id, updated_at DESC)`,
  );
  console.log("[saves] game_saves table ready");
}

export interface SaveSummary {
  player_id: string;
  slot: number;
  character_id: string | null;
  character_name: string | null;
  character_class: string | null;
  character_race: string | null;
  level: number;
  play_seconds: number;
  version: number;
  updated_at: string;
}

export interface SaveRecord extends SaveSummary {
  save_data: Record<string, unknown>;
  created_at: string;
}

const SUMMARY_COLS = `
  player_id, slot, character_id, character_name, character_class,
  character_race, level, play_seconds, version,
  updated_at::text AS updated_at
`;

const FULL_COLS = `
  player_id, slot, character_id, character_name, character_class,
  character_race, level, play_seconds, save_data, version,
  created_at::text AS created_at,
  updated_at::text AS updated_at
`;

export async function listSaves(playerId: string): Promise<SaveSummary[]> {
  const rows = await query<SaveSummary>(
    `SELECT ${SUMMARY_COLS}
     FROM game_saves
     WHERE player_id = $1
     ORDER BY slot ASC`,
    [playerId],
  );
  return rows;
}

export async function loadSave(
  playerId: string,
  slot: number,
): Promise<SaveRecord | null> {
  const rows = await query<SaveRecord>(
    `SELECT ${FULL_COLS}
     FROM game_saves
     WHERE player_id = $1 AND slot = $2
     LIMIT 1`,
    [playerId, slot],
  );
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

  await query(
    `INSERT INTO game_saves (
       player_id, slot, character_id, character_name, character_class,
       character_race, level, play_seconds, save_data, version, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,1,NOW())
     ON CONFLICT (player_id, slot) DO UPDATE SET
       character_id    = EXCLUDED.character_id,
       character_name  = EXCLUDED.character_name,
       character_class = EXCLUDED.character_class,
       character_race  = EXCLUDED.character_race,
       level           = EXCLUDED.level,
       play_seconds    = EXCLUDED.play_seconds,
       save_data       = EXCLUDED.save_data,
       version         = game_saves.version + 1,
       updated_at      = NOW()`,
    [
      playerId, slot,
      input.characterId ?? null,
      input.characterName ?? null,
      input.characterClass ?? null,
      input.characterRace ?? null,
      input.level ?? 1,
      input.playSeconds ?? 0,
      JSON.stringify(input.saveData),
    ],
  );

  const fresh = await loadSave(playerId, slot);
  if (!fresh) throw new Error("Save vanished immediately after upsert");
  return fresh;
}

export async function deleteSave(playerId: string, slot: number): Promise<boolean> {
  const result = await getPool().query(
    `DELETE FROM game_saves WHERE player_id = $1 AND slot = $2`,
    [playerId, slot],
  );
  return (result.rowCount ?? 0) > 0;
}