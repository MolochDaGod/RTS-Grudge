/**
 * worldSectorRoutes — REST endpoints for world map sector data.
 *
 * Endpoints:
 *   GET /api/world/sectors          — all 9 biome sectors + grid + labels
 *   GET /api/world/sectors/:id      — single sector by biome ID
 *   GET /api/world/sectors/grid     — just the 3×3 grid arrangement
 *
 * Responses are pure JSON; no auth required (read-only game data).
 * Data is derived from shared/worldSectors.ts — the canonical single
 * source of truth shared by server and client.
 */

import type { Express, Request, Response } from "express";
import {
  getAllSectors,
  getSectorById,
  getSectorsByLevel,
  SECTOR_GRID,
  BIOME_LABELS,
  type SectorBiome,
} from "../shared/worldSectors";

export function registerWorldSectorRoutes(app: Express): void {

  /**
   * GET /api/world/sectors
   * Returns all 9 world sectors plus the 3×3 grid arrangement and labels.
   * Clients use this to render the world map, populate sector selectors,
   * and determine zone-level entry requirements.
   */
  app.get("/api/world/sectors", (_req: Request, res: Response) => {
    res.json({
      success: true,
      sectors: getAllSectors(),
      grid: SECTOR_GRID,
      labels: BIOME_LABELS,
    });
  });

  /**
   * GET /api/world/sectors/by-level
   * Returns all sectors sorted ascending by minPlayerLevel.
   * Useful for progression guides and "recommended next zone" logic.
   */
  app.get("/api/world/sectors/by-level", (_req: Request, res: Response) => {
    res.json({
      success: true,
      sectors: getSectorsByLevel(),
    });
  });

  /**
   * GET /api/world/sectors/:id
   * Returns a single sector by its biome ID (e.g. "tropical", "frozen").
   * Returns 404 with a helpful error if the ID is not recognised.
   */
  app.get("/api/world/sectors/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const sector = getSectorById(String(id));

    if (!sector) {
      const validIds = Object.keys(BIOME_LABELS).join(", ");
      res.status(404).json({
        success: false,
        error: `Sector "${id}" not found. Valid sector IDs: ${validIds}`,
      });
      return;
    }

    res.json({ success: true, sector });
  });
}
