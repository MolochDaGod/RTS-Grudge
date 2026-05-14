import type { Express, Request, Response } from "express";
import {
  loadLoadout, upsertLoadout, deleteLoadout, type LoadoutInput,
} from "./loadouts";

const PLAYER_ID_RE = /^[A-Za-z0-9_\-]{6,64}$/;
const CHAR_ID_RE   = /^[A-Za-z0-9_\-]{6,64}$/;
const MAX_BODY_BYTES = 64 * 1024; // 64 KB per loadout — bindings only

function validatePlayer(playerId: string): string | null {
  if (!playerId || !PLAYER_ID_RE.test(playerId)) return "Invalid playerId";
  return null;
}

function validateChar(characterId: string): string | null {
  if (!characterId || !CHAR_ID_RE.test(characterId)) return "Invalid characterId";
  return null;
}

function param(req: Request, key: string): string {
  const v = (req.params as Record<string, unknown>)[key];
  return typeof v === "string" ? v : String(v ?? "");
}

export function registerLoadoutsRoutes(app: Express) {
  // Load a loadout for one character
  app.get("/api/loadouts/:playerId/:charId", async (req: Request, res: Response) => {
    const pErr = validatePlayer(param(req, "playerId"));
    if (pErr) { res.status(400).json({ success: false, error: pErr }); return; }
    const cErr = validateChar(param(req, "charId"));
    if (cErr) { res.status(400).json({ success: false, error: cErr }); return; }
    try {
      const rec = await loadLoadout(param(req, "playerId"), param(req, "charId"));
      if (!rec) { res.status(404).json({ success: false, error: "Loadout not found" }); return; }
      res.json({ success: true, loadout: rec });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Upsert a loadout for one character
  app.put("/api/loadouts/:playerId/:charId", async (req: Request, res: Response) => {
    const pErr = validatePlayer(param(req, "playerId"));
    if (pErr) { res.status(400).json({ success: false, error: pErr }); return; }
    const cErr = validateChar(param(req, "charId"));
    if (cErr) { res.status(400).json({ success: false, error: cErr }); return; }

    const body = req.body ?? {};
    if (!body.loadoutData || typeof body.loadoutData !== "object") {
      res.status(400).json({ success: false, error: "loadoutData (object) required" });
      return;
    }

    const serialized = JSON.stringify(body.loadoutData);
    if (serialized.length > MAX_BODY_BYTES) {
      res.status(413).json({
        success: false,
        error: `loadoutData too large (${serialized.length} > ${MAX_BODY_BYTES} bytes)`,
      });
      return;
    }

    const input: LoadoutInput = {
      loadoutData: body.loadoutData,
      expectedVersion: typeof body.expectedVersion === "number" ? body.expectedVersion : undefined,
    };

    try {
      const result = await upsertLoadout(param(req, "playerId"), param(req, "charId"), input);
      if ("conflict" in result) {
        res.status(409).json({
          success: false,
          error: "Version conflict",
          current: result.current,
        });
        return;
      }
      res.json({ success: true, loadout: result });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Delete a loadout
  app.delete("/api/loadouts/:playerId/:charId", async (req: Request, res: Response) => {
    const pErr = validatePlayer(param(req, "playerId"));
    if (pErr) { res.status(400).json({ success: false, error: pErr }); return; }
    const cErr = validateChar(param(req, "charId"));
    if (cErr) { res.status(400).json({ success: false, error: cErr }); return; }
    try {
      const removed = await deleteLoadout(param(req, "playerId"), param(req, "charId"));
      res.json({ success: true, removed });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
}
