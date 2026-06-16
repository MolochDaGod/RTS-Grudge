#!/usr/bin/env tsx
/**
 * scripts/grok-orchestrate.ts
 *
 * CLI for the flag-gated Grok orchestrator (server/grokOrchestrator.ts).
 * Nothing here changes production state. Proposals are read-only; the only
 * mutating path is `execute --confirm` on a legion proposal, which merely
 * QUEUES a task on the gateway (/legion/dispatch).
 *
 * Enable first:   set GROK_ORCHESTRATOR_ENABLED=true  (or add to .env)
 *
 * Usage:
 *   npx tsx scripts/grok-orchestrate.ts models
 *   npx tsx scripts/grok-orchestrate.ts propose --goal "Speed up the GLB build" [--context-file ctx.json]
 *   npx tsx scripts/grok-orchestrate.ts execute --id <proposalId> [--confirm]
 *   npx tsx scripts/grok-orchestrate.ts status [--agent code]
 *
 * Flags: --provider xai|gateway   --model grok-4   (override env per-run)
 */

import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadConfig,
  listModels,
  proposeActions,
  executeApproved,
  OrchestratorDisabledError,
  type Proposal,
} from "../server/grokOrchestrator.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, "..");
dotenv.config({ path: path.resolve(PROJECT_ROOT, ".env") });

const PROPOSALS_PATH = path.resolve(PROJECT_ROOT, "dist/grok-proposals.json");

// ── tiny arg parser ─────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const cmd = argv[0];
const has = (n: string) => argv.includes(`--${n}`);
const opt = (n: string, def = ""): string => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};

function cfgWithOverrides() {
  const cfg = loadConfig();
  const provider = opt("provider");
  const model = opt("model");
  if (provider === "xai" || provider === "gateway") cfg.provider = provider;
  if (model) cfg.model = model;
  return cfg;
}

function riskBadge(r: Proposal["risk"]): string {
  return r === "high" ? "⛔ HIGH" : r === "medium" ? "▲ med" : "· low";
}

function printProposals(proposals: Proposal[]): void {
  if (!proposals.length) {
    console.log("(no proposals returned)");
    return;
  }
  for (const p of proposals) {
    const tgt = p.target === "legion" ? `legion:${p.agent}` : p.target;
    console.log(`\n[${p.id}] ${riskBadge(p.risk)}  (${tgt})  ${p.title}`);
    if (p.rationale) console.log(`     ${p.rationale}`);
    if (p.command) console.log(`     $ ${p.command}`);
  }
  console.log(
    `\n${proposals.length} proposal(s). Review, then: npx tsx scripts/grok-orchestrate.ts execute --id <id> [--confirm]`,
  );
}

// ── commands ──────────────────────────────────────────────────────────────────
async function runModels() {
  const cfg = cfgWithOverrides();
  const models = await listModels(cfg);
  console.log(`Provider: ${cfg.provider}  (configured model: ${cfg.model})`);
  console.log("Available models:");
  for (const m of models) console.log(`  ${m}${m === cfg.model ? "  <- configured" : ""}`);
}

async function runPropose() {
  const cfg = cfgWithOverrides();
  const goal = opt("goal");
  if (!goal) {
    console.error('Missing --goal "..."');
    process.exit(1);
  }
  let context: unknown = null;
  const ctxFile = opt("context-file");
  if (ctxFile) {
    context = JSON.parse(fs.readFileSync(path.resolve(PROJECT_ROOT, ctxFile), "utf8"));
  }

  console.log(`Asking ${cfg.provider}/${cfg.model} to PROPOSE (no changes will be made)…\n`);
  const proposals = await proposeActions({ goal, context }, cfg);
  printProposals(proposals);

  fs.mkdirSync(path.dirname(PROPOSALS_PATH), { recursive: true });
  fs.writeFileSync(PROPOSALS_PATH, JSON.stringify({ goal, generatedAt: new Date().toISOString(), proposals }, null, 2));
  console.log(`\nSaved → ${path.relative(PROJECT_ROOT, PROPOSALS_PATH)}`);
}

async function runExecute() {
  const cfg = cfgWithOverrides();
  const id = opt("id");
  if (!id) {
    console.error("Missing --id <proposalId> (run `propose` first)");
    process.exit(1);
  }
  if (!fs.existsSync(PROPOSALS_PATH)) {
    console.error(`No saved proposals at ${PROPOSALS_PATH}. Run \`propose\` first.`);
    process.exit(1);
  }
  const saved = JSON.parse(fs.readFileSync(PROPOSALS_PATH, "utf8")) as { proposals: Proposal[] };
  const proposal = saved.proposals.find((p) => p.id === id);
  if (!proposal) {
    console.error(`Proposal ${id} not found in saved set.`);
    process.exit(1);
  }

  const confirm = has("confirm");
  const result = await executeApproved(proposal, { confirm }, cfg);
  console.log(`[${result.id}] ${result.status.toUpperCase()}: ${result.detail}`);
  if (result.status === "dry-run") {
    console.log("Re-run with --confirm to actually queue this legion task.");
  }
}

async function runStatus() {
  const cfg = cfgWithOverrides();
  const agent = opt("agent");
  const url = `${cfg.gatewayUrl}/legion/status${agent ? `?agent=${encodeURIComponent(agent)}` : ""}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.gatewayToken}` } });
  const text = await res.text();
  console.log(`GET /legion/status -> ${res.status}\n${text}`);
}

async function main() {
  switch (cmd) {
    case "models":
      return runModels();
    case "propose":
      return runPropose();
    case "execute":
      return runExecute();
    case "status":
      return runStatus();
    default:
      console.log(
        [
          "Grok orchestrator CLI",
          "",
          "Commands:",
          "  models                          List available models (xAI)",
          '  propose --goal "..."            Generate proposals (read-only)',
          "  execute --id <id> [--confirm]   Run an approved proposal (legion only; --confirm to queue)",
          "  status [--agent <name>]         Show legion queue depth",
          "",
          'Enable with GROK_ORCHESTRATOR_ENABLED="true" in .env.',
        ].join("\n"),
      );
  }
}

main().catch((e) => {
  if (e instanceof OrchestratorDisabledError) {
    console.error(e.message);
    process.exit(2);
  }
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
