#!/usr/bin/env node
/**
 * Lightweight RTS-Grudge stack probe — no GrudgeBuilder monorepo required.
 * Checks Node engines, dead fleet hosts, three/react pins, and production health URLs.
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
let errors = 0;

function ok(msg) {
  console.log(`  OK  ${msg}`);
}
function bad(msg) {
  console.log(`  ERR ${msg}`);
  errors++;
}

console.log("RTS-Grudge local stack probe\n");

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 20) ok(`Node ${process.version}`);
else bad(`Node ${process.version} — need >=20`);

if (deps.three) ok(`three ${deps.three}`);
else bad("missing three");
if (deps.react && deps["react-dom"]) ok(`react ${deps.react} / react-dom ${deps["react-dom"]}`);
else bad("react pair incomplete");
if (deps["@react-three/fiber"]) ok(`@react-three/fiber ${deps["@react-three/fiber"]}`);

const vercel = fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8");
if (vercel.includes("api.grudge-studio.com")) {
  bad("vercel.json still references dead api.grudge-studio.com");
} else {
  ok("vercel.json has no dead api.grudge-studio.com host");
}
if (vercel.includes("grudge-api-production-0d46.up.railway.app")) {
  ok("vercel.json routes API to Railway SSOT");
}

function get(url) {
  return new Promise((resolve) => {
    https
      .get(url, { timeout: 15000 }, (res) => {
        res.resume();
        resolve(res.statusCode);
      })
      .on("error", () => resolve(0));
  });
}

const urls = [
  "https://grudge-api-production-0d46.up.railway.app/api/health",
  "https://assets.grudge-studio.com/icons/pack/weapons/Sword_01.png",
  "https://objectstore.grudge-studio.com/api/v1/master-items.json",
  "https://id.grudge-studio.com/login",
];

console.log("\nLive endpoints:");
for (const u of urls) {
  const s = await get(u);
  if (s === 200 || s === 401) ok(`${s} ${u}`);
  else bad(`${s || "fail"} ${u}`);
}

console.log(errors ? `\n✗ ${errors} issue(s)\n` : "\n✓ stack probe OK\n");
process.exit(errors ? 1 : 0);
