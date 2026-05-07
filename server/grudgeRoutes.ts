import type { Express, Request, Response, NextFunction } from "express";
import {
  getAssets, getWeapons, getSkills, getMaterials,
  getEquipmentConfig, registerAsset, syncObjectStore,
  getArmor, getConsumables,
} from "./grudge";

function requireServerOnly(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-grudge-admin"];
  if (token !== process.env.GRUDGE_ADMIN_TOKEN && process.env.NODE_ENV !== "development") {
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }
  next();
}

export function registerGrudgeRoutes(app: Express) {
  app.get("/api/grudge/assets", async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const assets = await getAssets(category);
      res.json({ success: true, assets });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/grudge/assets", requireServerOnly, async (req: Request, res: Response) => {
    try {
      await registerAsset(req.body);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/grudge/weapons", async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const weapons = await getWeapons(category);
      res.json({ success: true, weapons });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/grudge/skills", async (req: Request, res: Response) => {
    try {
      const weaponType = req.query.weaponType as string | undefined;
      const skills = await getSkills(weaponType);
      res.json({ success: true, skills });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/grudge/materials", async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const materials = await getMaterials(category);
      res.json({ success: true, materials });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/grudge/armor", async (req: Request, res: Response) => {
    try {
      const material = req.query.material as string | undefined;
      const set = req.query.set as string | undefined;
      const armor = await getArmor(material, set);
      res.json({ success: true, armor });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/grudge/consumables", async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const consumables = await getConsumables(category);
      res.json({ success: true, consumables });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/grudge/equipment", async (_req: Request, res: Response) => {
    try {
      const config = await getEquipmentConfig();
      res.json({ success: true, config });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/grudge/sync", requireServerOnly, async (_req: Request, res: Response) => {
    try {
      const results = await syncObjectStore();
      res.json({ success: true, results });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
}
