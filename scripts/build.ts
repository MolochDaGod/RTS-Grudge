import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STUDIO_DIR = path.join(ROOT, "studio");
const FORGE_OUT = path.join(ROOT, "dist", "public", "forge");

function run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv }) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: opts.cwd ?? ROOT,
      env: { ...process.env, ...opts.env },
      shell: true,
      stdio: "inherit",
    });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

async function buildForgeEditor() {
  console.log("building Grudge Studio Forge editor (studio/)...");
  // Vercel sets NODE_ENV=production during build, which would omit vite/tsc
  // (devDependencies) and break the studio bundle. Force a full install.
  const studioInstallEnv = {
    NODE_ENV: "development",
    npm_config_production: "false",
  };
  const lockfile = path.join(STUDIO_DIR, "package-lock.json");
  try {
    await readFile(lockfile);
    await run("npm", ["ci", "--include=dev", "--legacy-peer-deps"], {
      cwd: STUDIO_DIR,
      env: studioInstallEnv,
    });
  } catch {
    await run("npm", ["install", "--include=dev", "--legacy-peer-deps"], {
      cwd: STUDIO_DIR,
      env: studioInstallEnv,
    });
  }
  await run("npm", ["run", "build"], {
    cwd: STUDIO_DIR,
    env: {
      ...studioInstallEnv,
      BASE_PATH: "/forge/",
      STUDIO_OUT_DIR: FORGE_OUT,
    },
  });
}

const allowlist = [
  "@aws-sdk/client-s3",
  "compression",
  "cors",
  "dotenv",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "helmet",
  "nanoid",
  "socket.io-client",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  // Forge editor is a nested package (studio/). On Vercel/Railway the full
  // npm ci + vite build can OOM or fail while the main game client is fine.
  // Prefer shipping client+server; keep last-known /forge/ from prior deploy
  // when SKIP_FORGE_BUILD=1 or when nested build fails in CI.
  const skipForge =
    process.env.SKIP_FORGE_BUILD === "1" ||
    process.env.SKIP_FORGE_BUILD === "true";
  const studioMissing = !(await readFile(path.join(STUDIO_DIR, "package.json"), "utf-8").then(
    () => true,
    () => false,
  ));
  if (skipForge || studioMissing) {
    console.warn(
      studioMissing
        ? "studio/ not present — skipping forge editor (Docker/slim builds)"
        : "SKIP_FORGE_BUILD set — skipping studio/ forge editor bundle",
    );
  } else {
    try {
      await buildForgeEditor();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Vercel / Railway / CI: ship client+server even if nested forge OOMs.
      // Forge can deploy from studio/vercel.json as a separate project.
      if (
        process.env.VERCEL ||
        process.env.CI ||
        process.env.RAILWAY_ENVIRONMENT ||
        process.env.RAILWAY_PROJECT_ID
      ) {
        console.warn(
          `[build] forge editor failed (${msg}); continuing with client+server only. ` +
            `Deploy studio/ separately for /forge/ or fix nested build.`,
        );
      } else {
        throw err;
      }
    }
  }

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
