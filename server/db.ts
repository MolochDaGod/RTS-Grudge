import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import type { EventEmitter } from "node:events";
import * as schema from "@shared/schema";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  port: parseInt(process.env.MYSQL_PORT || "3306", 10),
  user: process.env.MYSQL_USER || "grudge_admin",
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || "grudge_game",
  waitForConnections: true,
  connectionLimit: 10,
  // Ensure JSON columns come back as objects, not strings
  typeCast: function (field, next) {
    if (field.type === "JSON") {
      const val = field.string();
      if (val === null) return null;
      try { return JSON.parse(val); } catch { return val; }
    }
    return next();
  },
});

// mysql2 pools surface connection-level failures (DB unreachable, dropped
// connections) as an 'error' event. Without a listener Node treats it as an
// unhandled 'error' and crashes the process — which on Railway looks like a
// silent boot-then-die loop. Log it and let the pool recover on next query.
// (The promise wrapper's types omit the 'error' overload, so cast to the
// underlying EventEmitter.)
(pool as unknown as EventEmitter).on("error", (err: unknown) => {
  console.error("[db] MySQL pool error:", (err as Error)?.message ?? err);
});

export const db = drizzle(pool, { schema, mode: "default" });
export { pool };
