import type { Express, Request, Response } from "express";
import {
  listSaves, loadSave, upsertSave, deleteSave, type SaveInput,
} from "./saves";

const PLAYER_ID_RE = /^[A-Za-z0-9_\-]{6,64}$/;
const MAX_SLOTS = 8;
const MAX_BODY_BYTES = 512 * 1024; // 512 KB per save

function validatePlayer(playerId: string): string | null {
  if (!playerId || !PLAYER_ID_RE.test(playerId)) return "Invalid playerId";
  return null;
}

function validateSlot(raw: string): number | string {
  const slot = Number.parseInt(raw, 10);
  if (!Number.isFinite(slot) || slot < 0 || slot >= MAX_SLOTS) {
    return `Invalid slot (0..${MAX_SLOTS - 1})`;
  }
  return slot;
}

// Express's typed `req.params` for `/:foo` routes can resolve to
// `string | string[]` under some @types/express versions, so we coerce
// once at the boundary to keep the rest of the file simple.
function param(req: Request, key: string): string {
  const v = (req.params as Record<string, unknown>)[key];
  return typeof v === "string" ? v : String(v ?? "");
}

export function registerSavesRoutes(app: Express) {
  // List all saves for a player
  app.get("/api/saves/:playerId", async (req: Request, res: Response) => {
    const err = validatePlayer(param(req, "playerId"));
    if (err) { res.status(400).json({ success: false, error: err }); return; }
    try {
      const saves = await listSaves(param(req, "playerId"));
      res.json({ success: true, saves });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Load one save slot
  app.get("/api/saves/:playerId/:slot", async (req: Request, res: Response) => {
    const err = validatePlayer(param(req, "playerId"));
    if (err) { res.status(400).json({ success: false, error: err }); return; }
    const slot = validateSlot(param(req, "slot"));
    if (typeof slot === "string") { res.status(400).json({ success: false, error: slot }); return; }
    try {
      const save = await loadSave(param(req, "playerId"), slot);
      if (!save) { res.status(404).json({ success: false, error: "Save not found" }); return; }
      res.json({ success: true, save });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Create or update (upsert) a save slot
  app.put("/api/saves/:playerId/:slot", async (req: Request, res: Response) => {
    const err = validatePlayer(param(req, "playerId"));
    if (err) { res.status(400).json({ success: false, error: err }); return; }
    const slot = validateSlot(param(req, "slot"));
    if (typeof slot === "string") { res.status(400).json({ success: false, error: slot }); return; }

    const body = req.body ?? {};
    if (!body.saveData || typeof body.saveData !== "object") {
      res.status(400).json({ success: false, error: "saveData (object) required" });
      return;
    }

    const serialized = JSON.stringify(body.saveData);
    if (serialized.length > MAX_BODY_BYTES) {
      res.status(413).json({
        success: false,
        error: `saveData too large (${serialized.length} > ${MAX_BODY_BYTES} bytes)`,
      });
      return;
    }

    const input: SaveInput = {
      characterId:    body.characterId    ?? null,
      characterName:  body.characterName  ?? null,
      characterClass: body.characterClass ?? null,
      characterRace:  body.characterRace  ?? null,
      level:          typeof body.level === "number" ? body.level : 1,
      playSeconds:    typeof body.playSeconds === "number" ? body.playSeconds : 0,
      saveData:       body.saveData,
      expectedVersion: typeof body.expectedVersion === "number" ? body.expectedVersion : undefined,
    };

    try {
      const result = await upsertSave(param(req, "playerId"), slot, input);
      if ("conflict" in result) {
        res.status(409).json({
          success: false,
          error: "Version conflict",
          current: result.current,
        });
        return;
      }
      res.json({ success: true, save: result });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Delete a slot
  app.delete("/api/saves/:playerId/:slot", async (req: Request, res: Response) => {
    const err = validatePlayer(param(req, "playerId"));
    if (err) { res.status(400).json({ success: false, error: err }); return; }
    const slot = validateSlot(param(req, "slot"));
    if (typeof slot === "string") { res.status(400).json({ success: false, error: slot }); return; }
    try {
      const removed = await deleteSave(param(req, "playerId"), slot);
      res.json({ success: true, removed });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
}
