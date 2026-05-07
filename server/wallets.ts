import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Crossmint-backed Solana wallet provisioning, persisted in Postgres.
 *
 * One row per Grudge player. The wallet itself is custodial — Crossmint
 * holds the keys, we just store the public address + their internal
 * wallet ID so we can re-fetch state later. A signed-in Puter user maps
 * to a deterministic player_id (`puter_<uuid>`) and therefore to a
 * stable wallet across sessions/devices.
 *
 * If `CROSSMINT_API_KEY` is unset the routes still mount but every
 * provision call returns a clear 503 — the rest of the game keeps
 * working in guest mode.
 */

const CROSSMINT_BASE =
  process.env.CROSSMINT_BASE_URL ||
  (process.env.CROSSMINT_ENV === "production"
    ? "https://www.crossmint.com"
    : "https://staging.crossmint.com");
const CROSSMINT_CHAIN = process.env.CROSSMINT_CHAIN || "solana";

let _sql: NeonQueryFunction<false, false> | null = null;
function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL || process.env.GRUDGE_DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not configured");
    _sql = neon(url);
  }
  return _sql;
}

export async function initWalletsDB() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS player_wallets (
      player_id     TEXT PRIMARY KEY,
      address       TEXT NOT NULL,
      chain         TEXT NOT NULL DEFAULT 'solana',
      custodial_id  TEXT,
      provider      TEXT NOT NULL DEFAULT 'crossmint',
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS player_wallets_address_idx ON player_wallets(address)`;
  console.log("[wallets] player_wallets table ready");
}

export interface WalletRecord {
  player_id: string;
  address: string;
  chain: string;
  custodial_id: string | null;
  provider: string;
  created_at: string;
  updated_at: string;
}

const FULL_COLS = `
  player_id, address, chain, custodial_id, provider,
  created_at::text AS created_at,
  updated_at::text AS updated_at
`;

// The Neon HTTP driver occasionally returns null instead of [] for an
// empty result set (it then crashes downstream when callers do `.map`).
// Mirror the workaround used in `loadouts.ts` / `saves.ts`: catch the
// `reading 'map'` TypeError and treat it as "no rows".
async function safeRows<T>(p: Promise<unknown>): Promise<T[]> {
  try {
    const r = await p;
    return Array.isArray(r) ? (r as T[]) : [];
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg.includes("reading 'map'") || msg.includes('reading "map"')) {
      return [];
    }
    throw e;
  }
}

export async function getWallet(playerId: string): Promise<WalletRecord | null> {
  const sql = getSql();
  const rows = await safeRows<WalletRecord>(sql`
    SELECT ${sql.unsafe(FULL_COLS)} FROM player_wallets WHERE player_id = ${playerId} LIMIT 1
  `);
  return rows[0] ?? null;
}

interface CrossmintWalletResponse {
  id?: string;
  address?: string;
  publicKey?: string;
  chain?: string;
}

async function createCrossmintWallet(playerId: string, email?: string): Promise<{
  address: string;
  custodialId: string | null;
}> {
  const apiKey = process.env.CROSSMINT_API_KEY;
  if (!apiKey) throw new Error("CROSSMINT_API_KEY not set");

  // Crossmint links each wallet to a "user identifier". We use the
  // player_id directly so re-runs are idempotent on their side too.
  const linkedUser = email ? `email:${email}` : `userId:${playerId}`;

  const body = {
    type: "solana-mpc-wallet",
    linkedUser,
  };

  const url = `${CROSSMINT_BASE}/api/2022-06-09/wallets`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Crossmint ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as CrossmintWalletResponse;
  const address = data.address || data.publicKey || "";
  if (!address) throw new Error("Crossmint response missing address");
  return { address, custodialId: data.id ?? null };
}

export async function getOrCreateWallet(
  playerId: string,
  email?: string,
): Promise<WalletRecord> {
  const existing = await getWallet(playerId);
  if (existing) return existing;

  const { address, custodialId } = await createCrossmintWallet(playerId, email);

  const sql = getSql();
  const inserted = (await sql`
    INSERT INTO player_wallets (player_id, address, chain, custodial_id, provider)
    VALUES (${playerId}, ${address}, ${CROSSMINT_CHAIN}, ${custodialId}, 'crossmint')
    ON CONFLICT (player_id) DO UPDATE
      SET address = EXCLUDED.address,
          custodial_id = EXCLUDED.custodial_id,
          updated_at = NOW()
    RETURNING ${sql.unsafe(FULL_COLS)}
  `) as WalletRecord[];

  return inserted[0];
}
