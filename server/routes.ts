import type { Express, Request, Response } from "express";
import type { Server } from "http";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { initGrudgeDB, syncObjectStore } from "./grudge";
import { registerGrudgeRoutes } from "./grudgeRoutes";
import { registerMeshyRoutes } from "./meshyRoutes";
import { registerLocalAssets } from "./registerLocalAssets";
import { initSavesDB } from "./saves";
import { registerSavesRoutes } from "./savesRoutes";
import { initLoadoutsDB } from "./loadouts";
import { registerLoadoutsRoutes } from "./loadoutsRoutes";
import { initWalletsDB } from "./wallets";
import { registerWalletsRoutes } from "./walletsRoutes";

interface AIProviderDef {
  name: string;
  baseUrl: string;
  getKey: () => string;
  headers?: Record<string, string>;
  models: { id: string; name: string; provider: string; contextLength: number }[];
}

const AI_PROVIDERS: AIProviderDef[] = [
  {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    getKey: () => process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || process.env.OPENAIROUTE_API_KEY || "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",
    headers: { "HTTP-Referer": "https://github.com/mk-knight23/vibe", "X-Title": "Vibe Game Engine" },
    models: [
      { id: "x-ai/grok-4.1-fast:free", name: "Grok 4.1 Fast", provider: "OpenRouter", contextLength: 128000 },
      { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash", provider: "OpenRouter", contextLength: 1000000 },
      { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3", provider: "OpenRouter", contextLength: 64000 },
      { id: "qwen/qwen3-coder:free", name: "Qwen3 Coder", provider: "OpenRouter", contextLength: 32000 },
      { id: "meta-llama/llama-4-maverick:free", name: "Llama 4 Maverick", provider: "OpenRouter", contextLength: 128000 },
    ],
  },
  {
    name: "MegaLLM",
    baseUrl: "https://ai.megallm.io/v1",
    getKey: () => process.env.MEGALLM_API_KEY || "sk-mega-0eaa0b2c2bae3ced6afca8651cfbbce07927e231e4119068f7f7867c20cdc820",
    models: [
      { id: "llama3.3-70b-instruct", name: "Llama 3.3 70B", provider: "MegaLLM", contextLength: 128000 },
      { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill", provider: "MegaLLM", contextLength: 64000 },
      { id: "alibaba-qwen3-32b", name: "Qwen3 32B", provider: "MegaLLM", contextLength: 32000 },
      { id: "deepseek-ai/deepseek-v3.1", name: "DeepSeek V3.1", provider: "MegaLLM", contextLength: 64000 },
      { id: "mistralai/mistral-nemotron", name: "Mistral Nemotron", provider: "MegaLLM", contextLength: 128000 },
    ],
  },
  {
    name: "AgentRouter",
    baseUrl: "https://agentrouter.org/v1",
    getKey: () => process.env.AGENTROUTER_API_KEY || "sk-WXLlCAeAaDCeEjMWCBo7sqXGPOF1HrYEDm0JFBDXP3tEiERw",
    models: [
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", provider: "AgentRouter", contextLength: 200000 },
      { id: "deepseek-r1-0528", name: "DeepSeek R1", provider: "AgentRouter", contextLength: 64000 },
      { id: "deepseek-v3.1", name: "DeepSeek V3.1", provider: "AgentRouter", contextLength: 64000 },
      { id: "glm-4.6", name: "GLM 4.6", provider: "AgentRouter", contextLength: 128000 },
    ],
  },
  {
    name: "Routeway",
    baseUrl: "https://api.routeway.ai/v1",
    getKey: () => process.env.ROUTEWAY_API_KEY || "sk-LeRlb8aww5YXvdP57hnVw07xmIA2c3FvfeLvPhbmFU14osMn",
    models: [
      { id: "kimi-k2-0905:free", name: "Kimi K2", provider: "Routeway", contextLength: 200000 },
      { id: "minimax-m2:free", name: "MiniMax M2", provider: "Routeway", contextLength: 200000 },
      { id: "deepseek-v3-0324:free", name: "DeepSeek V3", provider: "Routeway", contextLength: 64000 },
    ],
  },
];

function findProviderForModel(modelId: string): AIProviderDef | undefined {
  return AI_PROVIDERS.find(p => p.models.some(m => m.id === modelId));
}

function getAllModels() {
  return AI_PROVIDERS.flatMap(p => p.models);
}

const PROJECT_ROOT = path.resolve(process.cwd());

function safePath(filePath: string): string | null {
  const absPath = path.resolve(PROJECT_ROOT, filePath);
  let realAbs: string;
  try {
    realAbs = fs.existsSync(absPath) ? fs.realpathSync(absPath) : absPath;
  } catch {
    realAbs = absPath;
  }
  if (!realAbs.startsWith(PROJECT_ROOT + path.sep) && realAbs !== PROJECT_ROOT) return null;
  const blocked = [".env", ".git", "node_modules", ".config"];
  const relative = path.relative(PROJECT_ROOT, realAbs);
  if (blocked.some(b => relative === b || relative.startsWith(b + path.sep))) return null;
  return absPath;
}

async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}): Promise<globalThis.Response> {
  const { timeout = 60000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function callAIProvider(provider: AIProviderDef, messages: any[], model: string, maxTokens = 4000): Promise<any> {
  const apiKey = provider.getKey();
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(provider.headers || {}),
  };

  const response = await fetchWithTimeout(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: maxTokens }),
    timeout: 60000,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[${provider.name}] ${response.status}: ${errorText}`);
  }

  return await response.json();
}

async function chatWithFallback(messages: any[], model: string, maxTokens = 4000): Promise<any> {
  const primaryProvider = findProviderForModel(model);
  const providerOrder = primaryProvider
    ? [primaryProvider, ...AI_PROVIDERS.filter(p => p !== primaryProvider)]
    : AI_PROVIDERS;

  const errors: string[] = [];

  for (const provider of providerOrder) {
    const targetModel = provider === primaryProvider ? model : provider.models[0].id;
    try {
      const result = await callAIProvider(provider, messages, targetModel, maxTokens);
      if (result.choices?.[0]?.message?.content) {
        return result;
      }
    } catch (err: any) {
      errors.push(`${provider.name}: ${err.message}`);
      console.log(`[vibe-ai] ${provider.name} failed for ${targetModel}, trying next...`);
    }
  }

  throw new Error(`All providers failed:\n${errors.join("\n")}`);
}

let projectSourceCache: string = "";
let projectSourceCacheTime = 0;

function getProjectSourceContext(): string {
  const now = Date.now();
  if (projectSourceCache && now - projectSourceCacheTime < 120000) {
    return projectSourceCache;
  }

  const keyFiles = [
    "client/src/lib/stores/useGame.tsx",
    "client/src/lib/stores/useSurvival.tsx",
    "client/src/lib/stores/useCharacterStats.ts",
    "client/src/lib/stores/useInventory.tsx",
    "client/src/lib/stores/useBuildSystem.ts",
    "client/src/lib/stores/useAllies.ts",
    "client/src/lib/stores/useGameConfig.tsx",
    "client/src/game/systems/EnemyBehaviorTree.ts",
    "client/src/game/controllers/CombatController.ts",
    "client/src/game/controllers/BuildController.ts",
    "client/src/game/controllers/HarvestController.ts",
    "client/src/game/islands/TrainingIslandRegistry.ts",
    "client/src/lib/data/WeaponSkillData.ts",
    "client/src/lib/data/NewAssetRegistry.ts",
  ];

  const summaries: string[] = [];
  for (const filePath of keyFiles) {
    try {
      const absPath = path.resolve(process.cwd(), filePath);
      if (fs.existsSync(absPath)) {
        const content = fs.readFileSync(absPath, "utf-8");
        const lines = content.split("\n");
        const exportLines = lines.filter(l =>
          /^export\s+(function|const|class|interface|type|enum|default)/.test(l.trim())
        ).slice(0, 15);

        if (exportLines.length > 0) {
          summaries.push(`--- ${filePath} ---\n${exportLines.join("\n")}`);
        }
      }
    } catch {}
  }

  projectSourceCache = summaries.length > 0
    ? `\n\nPROJECT SOURCE EXPORTS (for code-aware editing):\n${summaries.join("\n\n")}`
    : "";
  projectSourceCacheTime = now;
  return projectSourceCache;
}

const GAME_SYSTEM_PROMPT = `You are VIBE — the in-engine agent for the Grudge Game Engine (R3F + Rapier WASM + XState v5 + Grudge Warlords stats).

Operate like a senior engineer pairing with the user. Be terse and decisive: lead with a one-line plan, then act. No filler ("Sure!", "I'll try…"), no restating the request. Prefer doing over describing.

For multi-step plans, number the steps; each action block below is one step. The UI parses fenced action blocks as agent steps and renders them with Apply / Revert controls — emit them as their own paragraphs, not nested inside prose.

GAME SYSTEMS:
- Terrain: Procedural SimplexNoise island generation (worldSize, resolution, maxHeight, seed, octaves, persistence, lacunarity)
- Enemies: 6 types with behavior tree AI (pack tactics, retreat-heal, strafe, berserker charge, coordinated flanking, difficulty scaling)
- Combat: Melee/caster/archer classes, combo system (0.6s window, 15% per-hit), stamina costs, crits, blocking, dodging, screen shake, hit streaks
- Waves: Configurable spawn system with boss waves, concurrent limits, day/night variants
- NPCs: Wandering NPCs with dialogue, roles (guard, vendor, questgiver), vendor inventories
- Physics: Slope-aware movement, gravity, jump, sprint, Rapier collision groups (8 groups)
- Characters: 27 playable models with skeleton retargeting, bone-based weapon attachment, body morphing
- Animation: Blend trees, body region masking, crossfade transitions, weapon idle anims
- Weapon Skills: 6 masteries with damage bonuses wired into combat, weapon trails
- Training Islands: 6 pirate islands (Shanty→Shipwreck→Mangrove→Havana→Mansion→Fort) with progressive difficulty
- Stats: Grudge Warlords — 8 attributes (STR/VIT/END/INT/WIS/DEX/AGI/TAC), 37 derived stats, 6 races, 4 classes
- Survival Building: 22+ recipes (campfire, foundations, walls, roofs, workbench, palisades, spike traps)
- RTS Building: 35+ buildings across 5 categories, 2 ages, resource economy, ally spawning
- Allies: 10 types (soldier, archer, knight, farmer, ranger, mage, wizard, captain) with harvest/patrol/combat behaviors
- Assets: All unified GLB format, KayKit weapons/tools, fortress voxel pieces (tower/gate/wall/corner), modular terrain
- Dungeons: BSP-generated rooms with navmesh pathfinding

ACTION BLOCKS — emit exactly these fences.

Source-code edit:
\`\`\`vibe-edit
FILE: client/src/path/to/file.ts
ACTION: replace
OLD: |exact text to find|
NEW: |replacement text|
\`\`\`

Or to create/overwrite a file:
\`\`\`vibe-edit
FILE: client/src/path/to/file.ts
ACTION: write
CONTENT: |full file content|
\`\`\`

Scene mutation (live editor):
\`\`\`vibe-scene
{ "action": "add-object",  "data": { "name": "Torch", "type": "primitive", "position": [0,1,0], "properties": { "shape": "box", "color": "#ff8844" } } }
\`\`\`
\`\`\`vibe-scene
{ "action": "save-prefab", "data": { "id": "elite-knight", "name": "Elite Knight", "category": "character", "modelPath": "/models/characters/undead_grave_knight-male.glb" } }
\`\`\`

Allowed object types: primitive | model | light | group | spawn | trigger | empty | prefab.
When asked a question that doesn't require a change, just answer — short paragraphs, code only when meaningful.`;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  if (process.env.GRUDGE_DATABASE_URL) {
    try {
      await initGrudgeDB();
      registerGrudgeRoutes(app);
      syncObjectStore().catch((e) => console.warn("[grudge] Background sync error:", e.message));
      registerLocalAssets().catch((e) => console.warn("[grudge] Asset registration error:", e.message));
      console.log("[grudge] Integration ready");
    } catch (e: any) {
      console.warn("[grudge] Init failed (non-fatal):", e.message);
    }
  }

  if (process.env.MESHY_API_KEY) {
    registerMeshyRoutes(app);
    console.log("[meshy] Pipeline routes registered");
  }

  // Game-save persistence (uses DATABASE_URL, falls back to GRUDGE_DATABASE_URL).
  if (process.env.DATABASE_URL || process.env.GRUDGE_DATABASE_URL) {
    try {
      await initSavesDB();
      registerSavesRoutes(app);
      console.log("[saves] Save game routes registered");
    } catch (e: any) {
      console.warn("[saves] Init failed (non-fatal):", e.message);
    }

    try {
      await initLoadoutsDB();
      registerLoadoutsRoutes(app);
      console.log("[loadouts] Hotbar loadout routes registered");
    } catch (e: any) {
      console.warn("[loadouts] Init failed (non-fatal):", e.message);
    }

    // Crossmint-backed Solana wallets per Grudge account.
    // The DB table is always created so /api/wallets/:id GET works for
    // legacy lookups; provisioning is gated on CROSSMINT_API_KEY at the
    // route level (POST returns 503 until the secret is provided).
    try {
      await initWalletsDB();
      registerWalletsRoutes(app);
      const provisioning = process.env.CROSSMINT_API_KEY ? "enabled" : "disabled (no CROSSMINT_API_KEY)";
      console.log(`[wallets] Wallet routes registered, provisioning ${provisioning}`);
    } catch (e: any) {
      console.warn("[wallets] Init failed (non-fatal):", e.message);
    }
  }

  app.post("/api/ai-chat", async (req: Request, res: Response) => {
    try {
      const { messages, model, gameConfig, includeSource, systemPrompt, sceneContext } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "messages array required" });
      }

      if (systemPrompt && (typeof systemPrompt !== "string" || systemPrompt.length > 8000)) {
        return res.status(400).json({ error: "systemPrompt must be a string under 8000 chars" });
      }
      if (sceneContext && (typeof sceneContext !== "string" || sceneContext.length > 32000)) {
        return res.status(400).json({ error: "sceneContext must be a string under 32000 chars" });
      }

      const contextMessage = gameConfig
        ? `\n\nCURRENT GAME CONFIG:\n${JSON.stringify(gameConfig, null, 2)}`
        : "";

      const sourceContext = includeSource !== false ? getProjectSourceContext() : "";

      const sceneInfo = sceneContext
        ? `\n\nCURRENT SCENE STATE:\n${sceneContext}`
        : "";

      const basePrompt = systemPrompt || GAME_SYSTEM_PROMPT;

      const fullMessages = [
        { role: "system", content: basePrompt + contextMessage + sourceContext + sceneInfo },
        ...messages,
      ];

      const selectedModel = model || "x-ai/grok-4.1-fast:free";

      const data = await chatWithFallback(fullMessages, selectedModel);
      return res.json(data);
    } catch (error: any) {
      console.error("[vibe-ai] Chat error:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai-models", (_req: Request, res: Response) => {
    res.json({ models: getAllModels() });
  });

  app.post("/api/ai-edit", async (req: Request, res: Response) => {
    try {
      const { edits } = req.body;
      if (!edits || !Array.isArray(edits)) {
        return res.status(400).json({ error: "edits array required" });
      }

      const results: any[] = [];
      for (const edit of edits) {
        if (!edit || !edit.file || !edit.action) {
          results.push({ file: edit?.file || "unknown", status: "error", message: "Invalid edit (missing file or action)" });
          continue;
        }
        try {
          const absPath = safePath(edit.file);

          if (!absPath) {
            results.push({ file: edit.file, status: "error", message: "Path blocked" });
            continue;
          }

          if (edit.action === "write") {
            const dir = path.dirname(absPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(absPath, edit.content || "", "utf-8");
            results.push({ file: edit.file, status: "created" });
          } else if (edit.action === "replace") {
            if (!fs.existsSync(absPath)) {
              results.push({ file: edit.file, status: "error", message: "File not found" });
              continue;
            }
            let content = fs.readFileSync(absPath, "utf-8");
            if (!content.includes(edit.old)) {
              results.push({ file: edit.file, status: "error", message: "Old text not found in file" });
              continue;
            }
            content = content.replace(edit.old, edit.new);
            fs.writeFileSync(absPath, content, "utf-8");
            results.push({ file: edit.file, status: "modified" });
          } else {
            results.push({ file: edit.file, status: "error", message: `Unknown action: ${edit.action}` });
          }
        } catch (err: any) {
          results.push({ file: edit.file, status: "error", message: err.message });
        }
      }

      projectSourceCache = "";
      return res.json({ results });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai-read", async (req: Request, res: Response) => {
    try {
      const { filePath, offset, limit } = req.body;
      if (!filePath || typeof filePath !== "string") {
        return res.status(400).json({ error: "filePath required" });
      }
      const absPath = safePath(filePath);

      if (!absPath) {
        return res.status(403).json({ error: "Path blocked" });
      }

      if (!fs.existsSync(absPath)) {
        return res.status(404).json({ error: "File not found" });
      }

      const content = fs.readFileSync(absPath, "utf-8");
      const lines = content.split("\n");
      const start = offset || 0;
      const end = limit ? start + limit : lines.length;
      const slice = lines.slice(start, end);

      return res.json({
        content: slice.join("\n"),
        totalLines: lines.length,
        showing: { from: start + 1, to: Math.min(end, lines.length) },
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai-files", (_req: Request, res: Response) => {
    try {
      const clientSrc = path.resolve(process.cwd(), "client/src");
      const serverDir = path.resolve(process.cwd(), "server");
      const files: string[] = [];

      function walk(dir: string, prefix: string) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
          const rel = path.join(prefix, entry.name);
          if (entry.isDirectory()) {
            walk(path.join(dir, entry.name), rel);
          } else if (/\.(ts|tsx|js|jsx|css|json)$/.test(entry.name)) {
            files.push(rel);
          }
        }
      }

      walk(clientSrc, "client/src");
      walk(serverDir, "server");
      return res.json({ files });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/game-config", (_req: Request, res: Response) => {
    res.json({ status: "ok", message: "Game config endpoint ready" });
  });

  app.post("/api/game-config/save", async (req: Request, res: Response) => {
    try {
      const { config, name } = req.body;
      const key = `game_config_${name || "default"}`;
      await storage.setItem(key, JSON.stringify(config));
      res.json({ status: "saved", key });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/game-config/load/:name", async (req: Request, res: Response) => {
    try {
      const key = `game_config_${req.params.name}`;
      const data = await storage.getItem(key);
      if (data) {
        res.json({ config: JSON.parse(data) });
      } else {
        res.status(404).json({ error: "Config not found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
