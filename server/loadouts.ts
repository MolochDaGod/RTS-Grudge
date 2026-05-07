import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Hotbar / loadout persistence per (playerId, characterId).
 *
 * Mirrors the Neon HTTP-driver patterns in `saves.ts`:
 *   - separate function-call handle for parameterised queries
 *   - empty-rows null-map workaround
 *   - TIMESTAMPTZ cast to ::text for JSON-safe ISO strings
 *
 * Schema is intentionally narrow: a single JSONB blob holds the
 * mode-aware bindings. The shape is owned by the client store and
 * versioned by the `version` column for optimistic concurrency.
 */

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

export async function initLoadoutsDB() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS player_loadouts (
      player_id     TEXT NOT NULL,
      character_id  TEXT NOT NULL,
      loadout_data  JSONB NOT NULL DEFAULT '{}',
      version       INTEGER NOT NULL DEFAULT 1,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (player_id, character_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS player_loadouts_updated_idx ON player_loadouts(player_id, updated_at DESC)`;
  console.log("[loadouts] player_loadouts table ready");
}

export interface LoadoutRecord {
  player_id: string;
  character_id: string;
  loadout_data: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}

const FULL_COLS = `
  player_id, character_id, loadout_data, version,
  created_at::text AS created_at,
  updated_at::text AS updated_at
`;

export async function loadLoadout(
  playerId: string,
  characterId: string,
): Promise<LoadoutRecord | null> {
  const rows = await getSqlFn()(
    `SELECT ${FULL_COLS}
     FROM player_loadouts
     WHERE player_id = $1 AND character_id = $2
     LIMIT 1`,
    [playerId, characterId],
  );
  return ((rows as unknown as LoadoutRecord[])?.[0]) ?? null;
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
  const sqlFn = getSqlFn();
  const dataJson = JSON.stringify(input.loadoutData);

  if (typeof input.expectedVersion === "number") {
    // Atomic compare-and-swap: the version check lives INSIDE the
    // UPDATE WHERE clause so two concurrent PUTs can't both pass a
    // separate pre-check and both commit.
    //
    // CAVEAT: the @neondatabase/serverless HTTP driver returns an
    // empty rows array for any statement with a RETURNING clause
    // (see header docstring in saves.ts). To get a usable affected-
    // row count we wrap the UPDATE in a CTE and project the count
    // through an outer SELECT, which the driver does parse normally.
    const cas = await sqlFn(
      `WITH cas AS (
         UPDATE player_loadouts
            SET loadout_data = $3::jsonb,
                version      = version + 1,
                updated_at   = NOW()
          WHERE player_id    = $1
            AND character_id = $2
            AND version      = $4
          RETURNING player_id
       )
       SELECT COUNT(*)::int AS n FROM cas`,
      [playerId, characterId, dataJson, input.expectedVersion],
    );
    const n = Number((cas as unknown as Array<{ n: number }>)?.[0]?.n ?? 0);
    if (n > 0) {
      // Update matched — re-read for the canonical row (RETURNING
      // wouldn't be readable through this driver anyway).
      const fresh = await loadLoadout(playerId, characterId);
      if (!fresh) throw new Error("Loadout vanished immediately after CAS update");
      return fresh;
    }

    // Either the row doesn't exist (client thought it did) or the
    // version no longer matches. Surface the current state to the
    // client so it can adopt and retry.
    const current = await loadLoadout(playerId, characterId);
    if (!current) {
      // Row truly doesn't exist — fall through to the unconditional
      // insert path below to create it. This covers a benign race
      // where hydrate succeeded with serverVersion=null then someone
      // (e.g. another tab) deleted the row before we could write.
    } else {
      return { conflict: true, current };
    }
  }

  // No expected version (or row vanished mid-flight): unconditional
  // upsert with last-write-wins semantics.
  await sqlFn(
    `INSERT INTO player_loadouts (
       player_id, character_id, loadout_data, version, updated_at
     ) VALUES ($1,$2,$3::jsonb,1,NOW())
     ON CONFLICT (player_id, character_id) DO UPDATE SET
       loadout_data = EXCLUDED.loadout_data,
       version      = player_loadouts.version + 1,
       updated_at   = NOW()`,
    [playerId, characterId, dataJson],
  );

  const fresh = await loadLoadout(playerId, characterId);
  if (!fresh) throw new Error("Loadout vanished immediately after upsert");
  return fresh;
}

export async function deleteLoadout(
  playerId: string,
  characterId: string,
): Promise<boolean> {
  const before = await getSqlFn()(
    `SELECT 1 AS one FROM player_loadouts WHERE player_id = $1 AND character_id = $2 LIMIT 1`,
    [playerId, characterId],
  );
  if ((Array.isArray(before) ? before : []).length === 0) return false;
  await getSqlFn()(
    `DELETE FROM player_loadouts WHERE player_id = $1 AND character_id = $2`,
    [playerId, characterId],
  );
  return true;
}
