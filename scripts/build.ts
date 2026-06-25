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
  await run("npm", ["install", "--legacy-peer-deps"], { cwd: STUDIO_DIR });
  await run("npm", ["run", "build"], {
    cwd: STUDIO_DIR,
    env: {
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

  await buildForgeEditor();

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
