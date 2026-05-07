import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import path from "path";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/Models", express.static(path.resolve(process.cwd(), "Models")));

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
