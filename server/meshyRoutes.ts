import type { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

const MESHY_BASE = "https://api.meshy.ai/openapi";
const MESHY_KEY = process.env.MESHY_API_KEY || "";

const MODELS_DIR = path.join(process.cwd(), "client", "public", "models", "meshy");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function meshyFetch(urlStr: string, method = "GET", body?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: `Bearer ${MESHY_KEY}`,
        "Content-Type": "application/json",
      },
    };
    if (body) options.headers!["Content-Length"] = Buffer.byteLength(body).toString();

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode || 200, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode || 200, data: raw });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function downloadFile(urlStr: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const getter = urlStr.startsWith("https") ? https : http;
    const doRequest = (url: string) => {
      getter.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Download failed: ${res.statusCode}`));
          return;
        }
        const ws = fs.createWriteStream(destPath);
        res.pipe(ws);
        ws.on("finish", () => { ws.close(); resolve(); });
        ws.on("error", reject);
      }).on("error", reject);
    };
    doRequest(urlStr);
  });
}

export function registerMeshyRoutes(app: Express) {
  app.get("/api/meshy/status", (_req: Request, res: Response) => {
    res.json({ configured: !!MESHY_KEY, modelsDir: "/models/meshy" });
  });

  app.post("/api/meshy/text-to-3d", async (req: Request, res: Response) => {
    try {
      const { prompt, negativePrompt, artStyle, topology, targetPolyCount, aiModel } = req.body;
      const body: any = {
        mode: "preview",
        prompt,
        ai_model: aiModel || "meshy-4",
        topology: topology || "triangle",
        target_polycount: targetPolyCount || 30000,
      };
      if (negativePrompt) body.negative_prompt = negativePrompt;
      if (artStyle) body.art_style = artStyle;

      const { status, data } = await meshyFetch(`${MESHY_BASE}/v2/text-to-3d`, "POST", JSON.stringify(body));
      if (status >= 400) return res.status(status).json(data);
      res.json({ taskId: data.result, status: "PENDING" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/meshy/text-to-3d/refine", async (req: Request, res: Response) => {
    try {
      const { previewTaskId, textureRichness } = req.body;
      const body: any = {
        mode: "refine",
        preview_task_id: previewTaskId,
        texture_richness: textureRichness || "high",
      };

      const { status, data } = await meshyFetch(`${MESHY_BASE}/v2/text-to-3d`, "POST", JSON.stringify(body));
      if (status >= 400) return res.status(status).json(data);
      res.json({ taskId: data.result, status: "PENDING" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/meshy/image-to-3d", async (req: Request, res: Response) => {
    try {
      const { imageUrl, topology, targetPolyCount, aiModel } = req.body;
      const body: any = {
        image_url: imageUrl,
        ai_model: aiModel || "meshy-4",
        topology: topology || "triangle",
        target_polycount: targetPolyCount || 30000,
      };

      const { status, data } = await meshyFetch(`${MESHY_BASE}/v2/image-to-3d`, "POST", JSON.stringify(body));
      if (status >= 400) return res.status(status).json(data);
      res.json({ taskId: data.result, status: "PENDING" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/meshy/retexture", async (req: Request, res: Response) => {
    try {
      const { modelUrl, prompt, negativePrompt, artStyle, resolution, aiModel } = req.body;
      const body: any = {
        model_url: modelUrl,
        prompt,
        ai_model: aiModel || "meshy-4",
        resolution: resolution || 2048,
      };
      if (negativePrompt) body.negative_prompt = negativePrompt;
      if (artStyle) body.art_style = artStyle;

      const { status, data } = await meshyFetch(`${MESHY_BASE}/v1/retexture`, "POST", JSON.stringify(body));
      if (status >= 400) return res.status(status).json(data);
      res.json({ taskId: data.result, status: "PENDING" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/meshy/remesh", async (req: Request, res: Response) => {
    try {
      const { inputModelUrl, targetFormats, targetPolycount } = req.body;
      const body: any = {
        input_model_url: inputModelUrl,
        target_formats: targetFormats || ["glb"],
        target_polycount: targetPolycount || 10000,
      };

      const { status, data } = await meshyFetch(`${MESHY_BASE}/v1/remesh`, "POST", JSON.stringify(body));
      if (status >= 400) return res.status(status).json(data);
      res.json({ taskId: data.result, status: "PENDING" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/meshy/rig", async (req: Request, res: Response) => {
    try {
      const { inputModelUrl, rigType } = req.body;
      const body: any = {
        input_model_url: inputModelUrl,
        rig_type: rigType || "biped",
      };

      const { status, data } = await meshyFetch(`${MESHY_BASE}/v1/rig`, "POST", JSON.stringify(body));
      if (status >= 400) return res.status(status).json(data);
      res.json({ taskId: data.result, status: "PENDING" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/meshy/task/:type/:taskId", async (req: Request, res: Response) => {
    try {
      const { type, taskId } = req.params;
      const versionMap: Record<string, string> = {
        "text-to-3d": "v2",
        "image-to-3d": "v2",
        retexture: "v1",
        remesh: "v1",
        rig: "v1",
      };
      const version = versionMap[String(type)] || "v2";
      const { status, data } = await meshyFetch(`${MESHY_BASE}/${version}/${type}/${taskId}`);
      if (status >= 400) return res.status(status).json(data);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/meshy/tasks/:type", async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      const { page, limit } = req.query;
      const versionMap: Record<string, string> = {
        "text-to-3d": "v2",
        "image-to-3d": "v2",
        retexture: "v1",
        remesh: "v1",
        rig: "v1",
      };
      const version = versionMap[String(type)] || "v2";
      const params = new URLSearchParams();
      if (page) params.set("page_num", String(page));
      if (limit) params.set("page_size", String(limit));
      const qs = params.toString() ? `?${params.toString()}` : "";
      const { status, data } = await meshyFetch(`${MESHY_BASE}/${version}/${type}${qs}`);
      if (status >= 400) return res.status(status).json(data);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/meshy/download", async (req: Request, res: Response) => {
    try {
      const { modelUrl, filename, subfolder } = req.body;
      if (!modelUrl || !filename) {
        return res.status(400).json({ error: "modelUrl and filename required" });
      }
      const sub = subfolder || "generated";
      const dir = path.join(MODELS_DIR, sub);
      ensureDir(dir);
      const filePath = path.join(dir, filename);
      const publicPath = `/models/meshy/${sub}/${filename}`;

      await downloadFile(modelUrl, filePath);
      res.json({ success: true, path: publicPath, fullPath: filePath });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/meshy/library", (_req: Request, res: Response) => {
    try {
      const items: Array<{ name: string; path: string; subfolder: string; size: number; created: number }> = [];
      if (!fs.existsSync(MODELS_DIR)) {
        return res.json({ items });
      }
      const subfolders = fs.readdirSync(MODELS_DIR);
      for (const sub of subfolders) {
        const subPath = path.join(MODELS_DIR, sub);
        if (!fs.statSync(subPath).isDirectory()) continue;
        const files = fs.readdirSync(subPath);
        for (const file of files) {
          const stat = fs.statSync(path.join(subPath, file));
          items.push({
            name: file,
            path: `/models/meshy/${sub}/${file}`,
            subfolder: sub,
            size: stat.size,
            created: stat.mtimeMs,
          });
        }
      }
      items.sort((a, b) => b.created - a.created);
      res.json({ items });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/meshy/library/:subfolder/:filename", (req: Request, res: Response) => {
    try {
      const { subfolder, filename } = req.params;
      const filePath = path.join(MODELS_DIR, String(subfolder), String(filename));
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
