import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
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

export const db = drizzle(pool, { schema, mode: "default" });
export { pool };
