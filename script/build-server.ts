/**
 * Server-only build for Railway deployment.
 * Runs esbuild on server/index.ts → dist/index.cjs.
 * Does NOT call viteBuild — no Rollup, no Windows-only optional deps.
 * The client (Vite/React) is built and served separately via Vercel.
 */
import { build as esbuild } from "esbuild";
import { rm, readFile } from "fs/promises";

// Packages that should be bundled into the output rather than required at runtime.
// Everything NOT on this list is marked external (installed in node_modules on the server).
const BUNDLE_ALLOWLIST = new Set([
  "@neondatabase/serverless",
  "connect-pg-simple",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-session",
  "grudge-studio",
  "memorystore",
  "passport",
  "passport-local",
  "pg",
  "ws",
  "zod",
  "zod-validation-error",
]);

async function buildServer() {
  await rm("dist", { recursive: true, force: true });

  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !BUNDLE_ALLOWLIST.has(dep));

  console.log("▶ building server (esbuild only)…");
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

  console.log("✔ server build complete → dist/index.cjs");
}

buildServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
