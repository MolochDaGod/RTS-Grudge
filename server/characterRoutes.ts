import type { Express, Request, Response } from "express";
import {
  listCharacters,
  getCharacter,
  getActiveCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  activateCharacter,
} from "./characters";

const PLAYER_ID_RE = /^[A-Za-z0-9_\-]{6,64}$/;
const CHAR_ID_RE = /^[A-Za-z0-9_\-]{6,64}$/;
const MAX_BODY_BYTES = 128 * 1024; // 128 KB per character

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

export function registerCharacterRoutes(app: Express) {
  // ── List all characters for a player ────────────────────────────────────
  // ?active=true returns only the active character.
  app.get("/api/characters/:playerId", async (req: Request, res: Response) => {
    const pErr = validatePlayer(param(req, "playerId"));
    if (pErr) { res.status(400).json({ success: false, error: pErr }); return; }

    try {
      const activeOnly = req.query.active === "true";
      if (activeOnly) {
        const char = await getActiveCharacter(param(req, "playerId"));
        res.json({ success: true, characters: char ? [char] : [] });
      } else {
        const chars = await listCharacters(param(req, "playerId"));
        res.json({ success: true, characters: chars });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Get one character ───────────────────────────────────────────────────
  app.get("/api/characters/:playerId/:charId", async (req: Request, res: Response) => {
    const pErr = validatePlayer(param(req, "playerId"));
    if (pErr) { res.status(400).json({ success: false, error: pErr }); return; }
    const cErr = validateChar(param(req, "charId"));
    if (cErr) { res.status(400).json({ success: false, error: cErr }); return; }

    try {
      const char = await getCharacter(param(req, "playerId"), param(req, "charId"));
      if (!char) { res.status(404).json({ success: false, error: "Character not found" }); return; }
      res.json({ success: true, character: char });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Create a new character ──────────────────────────────────────────────
  app.post("/api/characters/:playerId", async (req: Request, res: Response) => {
    const pErr = validatePlayer(param(req, "playerId"));
    if (pErr) { res.status(400).json({ success: false, error: pErr }); return; }

    const body = req.body ?? {};
    const serialized = JSON.stringify(body);
    if (serialized.length > MAX_BODY_BYTES) {
      res.status(413).json({ success: false, error: "Request body too large" });
      return;
    }

    try {
      const char = await createCharacter(param(req, "playerId"), {
        name: typeof body.name === "string" ? body.name.slice(0, 128) : undefined,
        heroClass: typeof body.heroClass === "string" ? body.heroClass : undefined,
        race: typeof body.race === "string" ? body.race : undefined,
        modelPath: typeof body.modelPath === "string" ? body.modelPath : undefined,
        appearance: body.appearance && typeof body.appearance === "object" ? body.appearance : undefined,
        equipment: body.equipment && typeof body.equipment === "object" ? body.equipment : undefined,
      });
      res.status(201).json({ success: true, character: char });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Update an existing character ────────────────────────────────────────
  app.put("/api/characters/:playerId/:charId", async (req: Request, res: Response) => {
    const pErr = validatePlayer(param(req, "playerId"));
    if (pErr) { res.status(400).json({ success: false, error: pErr }); return; }
    const cErr = validateChar(param(req, "charId"));
    if (cErr) { res.status(400).json({ success: false, error: cErr }); return; }

    const body = req.body ?? {};

    try {
      const result = await updateCharacter(param(req, "playerId"), param(req, "charId"), {
        name: typeof body.name === "string" ? body.name.slice(0, 128) : undefined,
        heroClass: typeof body.heroClass === "string" ? body.heroClass : undefined,
        race: typeof body.race === "string" ? body.race : undefined,
        modelPath: typeof body.modelPath === "string" ? body.modelPath : undefined,
        appearance: body.appearance && typeof body.appearance === "object" ? body.appearance : undefined,
        equipment: body.equipment && typeof body.equipment === "object" ? body.equipment : undefined,
        level: typeof body.level === "number" ? body.level : undefined,
        expectedVersion: typeof body.expectedVersion === "number" ? body.expectedVersion : undefined,
      });

      if ("conflict" in result) {
        res.status(409).json({ success: false, error: "Version conflict", current: result.current });
        return;
      }

      res.json({ success: true, character: result });
    } catch (e: any) {
      if (e.message === "Character not found") {
        res.status(404).json({ success: false, error: e.message });
      } else {
        res.status(500).json({ success: false, error: e.message });
      }
    }
  });

  // ── Delete a character ──────────────────────────────────────────────────
  app.delete("/api/characters/:playerId/:charId", async (req: Request, res: Response) => {
    const pErr = validatePlayer(param(req, "playerId"));
    if (pErr) { res.status(400).json({ success: false, error: pErr }); return; }
    const cErr = validateChar(param(req, "charId"));
    if (cErr) { res.status(400).json({ success: false, error: cErr }); return; }

    try {
      const removed = await deleteCharacter(param(req, "playerId"), param(req, "charId"));
      res.json({ success: true, removed });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Activate a character ────────────────────────────────────────────────
  app.put("/api/characters/:playerId/:charId/activate", async (req: Request, res: Response) => {
    const pErr = validatePlayer(param(req, "playerId"));
    if (pErr) { res.status(400).json({ success: false, error: pErr }); return; }
    const cErr = validateChar(param(req, "charId"));
    if (cErr) { res.status(400).json({ success: false, error: cErr }); return; }

    try {
      const char = await activateCharacter(param(req, "playerId"), param(req, "charId"));
      if (!char) { res.status(404).json({ success: false, error: "Character not found" }); return; }
      res.json({ success: true, character: char });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
}
