import type { Express, Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { playerInventory, type PlayerInventory } from "@shared/schema";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const PLAYER_ID_RE = /^[A-Za-z0-9_\-]{6,64}$/;
const MAX_BODY_BYTES = 256 * 1024; // 256 KB — generous for 36 item slots

function validatePlayer(playerId: string): string | null {
  if (!playerId || !PLAYER_ID_RE.test(playerId)) return "Invalid playerId";
  return null;
}

function param(req: Request, key: string): string {
  const v = (req.params as Record<string, unknown>)[key];
  return typeof v === "string" ? v : String(v ?? "");
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function loadInventory(playerId: string): Promise<PlayerInventory | null> {
  const rows = await db.select().from(playerInventory)
    .where(eq(playerInventory.playerId, playerId))
    .limit(1);
  return rows[0] ?? null;
}

async function upsertInventory(
  playerId: string,
  items: unknown[],
  expectedVersion?: number,
): Promise<PlayerInventory | { conflict: true; current: PlayerInventory }> {
  if (typeof expectedVersion === "number") {
    const existing = await loadInventory(playerId);
    if (existing && existing.version !== expectedVersion) {
      return { conflict: true, current: existing };
    }
  }

  await db.insert(playerInventory).values({
    playerId,
    items: items as any,
    version: 1,
  }).onDuplicateKeyUpdate({
    set: {
      items: items as any,
      version: sql`${playerInventory.version} + 1`,
    },
  });

  const fresh = await loadInventory(playerId);
  if (!fresh) throw new Error("Inventory row vanished immediately after upsert");
  return fresh;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerInventoryRoutes(app: Express) {
  /**
   * GET /api/inventory/:playerId
   * Returns the player's account-level inventory. 404 when never initialised
   * (client seeds the starter kit on first login).
   */
  app.get("/api/inventory/:playerId", async (req: Request, res: Response) => {
    const pErr = validatePlayer(param(req, "playerId"));
    if (pErr) { res.status(400).json({ success: false, error: pErr }); return; }

    try {
      const rec = await loadInventory(param(req, "playerId"));
      if (!rec) {
        res.status(404).json({ success: false, error: "Inventory not found" });
        return;
      }
      res.json({ success: true, inventory: rec });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  /**
   * PUT /api/inventory/:playerId
   * Body: { items: InventoryItem[], expectedVersion?: number }
   * Upserts the player's inventory. Optimistic-lock: if expectedVersion is
   * supplied and doesn't match the stored version, returns 409 with current.
   */
  app.put("/api/inventory/:playerId", async (req: Request, res: Response) => {
    const pErr = validatePlayer(param(req, "playerId"));
    if (pErr) { res.status(400).json({ success: false, error: pErr }); return; }

    const body = req.body ?? {};

    if (!Array.isArray(body.items)) {
      res.status(400).json({ success: false, error: "items (array) required" });
      return;
    }

    const serialized = JSON.stringify(body.items);
    if (serialized.length > MAX_BODY_BYTES) {
      res.status(413).json({
        success: false,
        error: `items too large (${serialized.length} > ${MAX_BODY_BYTES} bytes)`,
      });
      return;
    }

    try {
      const result = await upsertInventory(
        param(req, "playerId"),
        body.items,
        typeof body.expectedVersion === "number" ? body.expectedVersion : undefined,
      );

      if ("conflict" in result) {
        res.status(409).json({
          success: false,
          error: "Version conflict",
          current: result.current,
        });
        return;
      }

      res.json({ success: true, inventory: result });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
}
