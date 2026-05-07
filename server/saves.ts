import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * NOTE: This module uses the @neondatabase/serverless **HTTP** driver.
 * That driver has two quirks we work around explicitly:
 *   1. `INSERT/UPDATE/DELETE ... RETURNING` returns `rowCount` but the
 *      actual rows array is empty. So after every write we do a follow-up
 *      `SELECT` to read back the canonical row.
 *   2. `TIMESTAMPTZ` columns are not parsed by default and JSON-serialise
 *      to `null`. We cast every timestamp we expose to clients with
 *      `::text` so they come back as ISO-style strings.
 */

// The HTTP driver supports both the tagged-template form `sql\`...\`` (used
// for DDL below) and a function-call form `sql(text, params)` for parameter-
// ised queries. The latter isn't reflected in the upstream types, so we
// keep a separately-typed handle for the function-call form.
let _sql: NeonQueryFunction<false, false> | null = null;
function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL || process.env.GRUDGE_DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not configured");
    _sql = neon(url);
  }
  return _sql;
}
function getSqlFn(): (text: string, params?: unknown[]) => Promise<unknown[]> {
  const sql = getSql() as unknown as { query: (text: string, params?: unknown[]) => Promise<unknown[] | null> };
  // The @neondatabase/serverless v1 HTTP driver throws
  // `TypeError: Cannot read properties of null (reading 'map')`
  // when a query returns zero rows (it tries to .map() over a null
  // `fields` array internally). We catch that one specific error and
  // treat it as the empty result it actually represents — anything else
  // is a real failure and re-thrown.
  return async (text, params) => {
    try {
      const r = await sql.query(text, params);
      return Array.isArray(r) ? r : [];
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("reading 'map'") || msg.includes("reading \"map\"")) {
        return [];
      }
      throw e;
    }
  };
}

export async function initSavesDB() {
  const sql = getSql();
  await sql`
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
  `;
  await sql`CREATE INDEX IF NOT EXISTS game_saves_updated_idx ON game_saves(player_id, updated_at DESC)`;
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
  const sql = getSql();
  const rows = await getSqlFn()(
    `SELECT ${SUMMARY_COLS}
     FROM game_saves
     WHERE player_id = $1
     ORDER BY slot ASC`,
    [playerId],
  );
  return (rows as unknown as SaveSummary[]) ?? [];
}

export async function loadSave(
  playerId: string,
  slot: number,
): Promise<SaveRecord | null> {
  const sql = getSql();
  const rows = await getSqlFn()(
    `SELECT ${FULL_COLS}
     FROM game_saves
     WHERE player_id = $1 AND slot = $2
     LIMIT 1`,
    [playerId, slot],
  );
  return ((rows as unknown as SaveRecord[])?.[0]) ?? null;
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
  const sql = getSql();

  if (typeof input.expectedVersion === "number") {
    const existing = await loadSave(playerId, slot);
    if (existing && existing.version !== input.expectedVersion) {
      return { conflict: true, current: existing };
    }
  }

  await getSqlFn()(
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
  const sql = getSql();
  // Existence check first — see RETURNING quirk in module header.
  const before = await getSqlFn()(
    `SELECT 1 AS one FROM game_saves WHERE player_id = $1 AND slot = $2 LIMIT 1`,
    [playerId, slot],
  );
  const beforeArr = Array.isArray(before) ? before : [];
  if (beforeArr.length === 0) return false;
  await getSqlFn()(
    `DELETE FROM game_saves WHERE player_id = $1 AND slot = $2`,
    [playerId, slot],
  );
  return true;
}
