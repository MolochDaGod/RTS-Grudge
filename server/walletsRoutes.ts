import type { Express, Request, Response } from "express";
import { getWallet, getOrCreateWallet } from "./wallets";

const PLAYER_ID_RE = /^[A-Za-z0-9_\-]{6,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validatePlayer(playerId: string): string | null {
  if (!playerId || !PLAYER_ID_RE.test(playerId)) return "Invalid playerId";
  return null;
}

function param(req: Request, key: string): string {
  const v = (req.params as Record<string, unknown>)[key];
  return typeof v === "string" ? v : String(v ?? "");
}

export function registerWalletsRoutes(app: Express) {
  // GET — return the wallet for a player, or 404 if none.
  app.get("/api/wallets/:playerId", async (req: Request, res: Response) => {
    const err = validatePlayer(param(req, "playerId"));
    if (err) { res.status(400).json({ success: false, error: err }); return; }
    try {
      const wallet = await getWallet(param(req, "playerId"));
      if (!wallet) { res.status(404).json({ success: false, error: "Wallet not found" }); return; }
      res.json({ success: true, wallet });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // POST — provision a wallet (idempotent). Returns the existing wallet
  // if one already exists; otherwise calls Crossmint to create one.
  app.post("/api/wallets/:playerId", async (req: Request, res: Response) => {
    const err = validatePlayer(param(req, "playerId"));
    if (err) { res.status(400).json({ success: false, error: err }); return; }
    if (!process.env.CROSSMINT_API_KEY && !process.env.CROSSMINT_SERVER_API_KEY) {
      res.status(503).json({
        success: false,
        error: "Wallet provisioning unavailable — CROSSMINT_API_KEY not configured on server",
      });
      return;
    }
    const body = (req.body ?? {}) as { email?: unknown };
    const email = typeof body.email === "string" && EMAIL_RE.test(body.email) ? body.email : undefined;
    try {
      const wallet = await getOrCreateWallet(param(req, "playerId"), email);
      res.json({ success: true, wallet });
    } catch (e: any) {
      res.status(502).json({ success: false, error: `Provision failed: ${e.message}` });
    }
  });
}
