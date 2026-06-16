import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { EventEmitter } from "node:events";
import * as schema from "@shared/schema";

// Railway provisions PostgreSQL and injects DATABASE_URL (postgresql://). The
// server runs inside the same Railway project, so DATABASE_URL points at the
// private network (postgres.railway.internal), which does NOT use TLS. External
// hosts (the public TCP proxy, or an explicit sslmode=require) do, so enable a
// relaxed SSL only in that case.
const connectionString =
  process.env.DATABASE_URL || process.env.GRUDGE_DATABASE_URL || undefined;

function needsSsl(cs: string | undefined): boolean {
  if (!cs) return false;
  if (/sslmode=require/i.test(cs)) return true;
  if (/\.railway\.internal|localhost|127\.0\.0\.1/.test(cs)) return false;
  return true; // external host (public proxy, etc.)
}

const pool = new Pool({
  connectionString,
  ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

// node-postgres pools emit 'error' on idle-client / connection-level failures.
// Without a listener Node treats it as an unhandled 'error' and crashes the
// process — which on Railway looks like a silent boot-then-die loop. Log it and
// let the pool recover on the next query.
(pool as unknown as EventEmitter).on("error", (err: unknown) => {
  console.error("[db] Postgres pool error:", (err as Error)?.message ?? err);
});

export const db = drizzle(pool, { schema });
export { pool };
