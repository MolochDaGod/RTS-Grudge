import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";
import { attachPvpServer, listPvpRooms } from "./pvp";
import { attachWorldServer, getWorldStatus } from "./world";

const app = express();
const httpServer = createServer(app);

// ── Security headers (production-safe; CSP is intentionally loose so
//    Three.js / WebGL / Blob workers still load from the same origin). ──────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
        workerSrc: ["'self'", "blob:"],
        connectSrc: ["'self'", "wss:", "ws:", "https:", "blob:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        mediaSrc: ["'self'", "blob:"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ── Rate-limiting — API routes only; static assets are exempt. ──────────────
const apiLimiter = rateLimit({
  windowMs: 60_000,        // 1-minute window
  max: 300,                // 300 req/min per IP (generous for a game API)
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests — slow down." },
  skip: (req) => !req.path.startsWith("/api"),
});
app.use(apiLimiter);

// ── Health-check (matches railway.json healthcheckPath). ────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ts: Date.now(), env: process.env.NODE_ENV });
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/Models", express.static(path.resolve(process.cwd(), "Models")));

// Socket.IO servers: PvP (match rooms) + World (MMO position / resource sync).
// Both must attach before the SPA catch-all so their upgrade paths are reserved.
attachPvpServer(httpServer);
attachWorldServer(httpServer);

// Read-only admin probe for the Grudge Studio integration. Returns the
// upstream health snapshot + active PvP rooms. No auth gate yet — wrap it
// once the central service exposes RBAC.
app.get("/api/grudge/integration-status", async (_req, res) => {
  const apiUrl = (process.env.GRUDGE_API_URL || "https://api.grudge-studio.com").replace(/\/+$/, "");
  const authUrl = (process.env.GRUDGE_AUTH_URL || "https://id.grudge-studio.com").replace(/\/+$/, "");
  async function ping(url: string) {
    try {
      const r = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(4000) });
      return { ok: r.ok, status: r.status };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  }
  res.json({
    api: { url: apiUrl, ...(await ping(apiUrl)) },
    auth: { url: authUrl, ...(await ping(authUrl)) },
    pvp: { rooms: listPvpRooms() },
    world: getWorldStatus(),
    flags: {
      jwtSecretConfigured: !!process.env.GRUDGE_JWT_SECRET,
      jwksConfigured: !!process.env.GRUDGE_JWKS_URL,
      allowGuests: process.env.GRUDGE_PVP_ALLOW_GUESTS === "1",
    },
  });
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);

    // Pre-flight: warn (don't fail) when a model referenced by any registry
    // export (including paths produced by `generateWeaponModels`) is missing
    // from disk. Non-fatal.
    try {
      const { validateModelManifest } = await import("../scripts/validate-model-manifest");
      const result = validateModelManifest();
      if (!result.ok) {
        log(
          `model-manifest: ${result.missing.length}/${result.total} registry entries reference missing files`,
          "warn",
        );
        const sample = result.missing.slice(0, 5);
        for (const m of sample) {
          const tag = m.id ? ` [id=${m.id}]` : "";
          log(`  [${m.source}] ${m.path}${tag}`, "warn");
        }
        if (result.missing.length > sample.length) {
          log(
            `  ... and ${result.missing.length - sample.length} more (run \`tsx scripts/validate-model-manifest.ts\` for the full list)`,
            "warn",
          );
        }
      } else {
        log(`model-manifest: ${result.total} registry entries verified on disk`);
      }
    } catch (e) {
      log(`model-manifest validator skipped: ${(e as Error).message}`, "warn");
    }
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
