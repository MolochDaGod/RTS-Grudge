/**
 * server/grokOrchestrator.ts
 *
 * Flag-gated "Grok orchestrator" for the Grudge stack.
 *
 * DESIGN GUARANTEES (read before extending):
 *   1. Disabled by default. Everything no-ops unless GROK_ORCHESTRATOR_ENABLED="true".
 *   2. Propose-then-approve. `proposeActions()` only RETURNS structured proposals —
 *      it never changes anything. Execution is a separate, explicit call.
 *   3. Gated execution. `executeApproved()` will only:
 *        - legion → POST /legion/dispatch (queues a task) and ONLY when opts.confirm
 *        - assets/ops → NEVER auto-run; it returns the command for a human to run.
 *   4. Secrets come from env only and are never logged.
 *
 * Provider switch (per user decision "build against xAI now, switchable later"):
 *   GROK_PROVIDER="xai"     → calls api.x.ai directly with XAI_API_KEY (works today)
 *   GROK_PROVIDER="gateway" → calls ai.grudge-studio.com/ai/grok (once that handler
 *                             is deployed) with GRUDACHAIN_API_TOKEN
 */

export type GrokProvider = "xai" | "gateway";
export type ProposalTarget = "legion" | "assets" | "ops";
export type RiskLevel = "low" | "medium" | "high";

/** Legion agents exposed by the ALE gateway (/legion/dispatch). */
export const LEGION_AGENTS = ["code", "art", "lore", "balance", "qa", "mission"] as const;
export type LegionAgent = (typeof LEGION_AGENTS)[number];

export interface OrchestratorConfig {
  enabled: boolean;
  provider: GrokProvider;
  model: string;
  xaiApiKey: string;
  xaiBaseUrl: string;
  gatewayUrl: string;
  gatewayToken: string;
  maxTokens: number;
}

export interface Proposal {
  id: string;
  target: ProposalTarget;
  /** Required when target === "legion". */
  agent?: LegionAgent;
  title: string;
  /** Shell/npm command for assets|ops proposals. NEVER executed automatically. */
  command?: string;
  rationale: string;
  risk: RiskLevel;
  /** Always true — present so downstream tooling can't forget the gate. */
  requiresApproval: true;
}

export interface ExecuteResult {
  id: string;
  status: "queued" | "dry-run" | "manual" | "skipped" | "error";
  detail: string;
}

export class OrchestratorDisabledError extends Error {
  constructor() {
    super(
      'Grok orchestrator is disabled. Set GROK_ORCHESTRATOR_ENABLED="true" to enable.',
    );
    this.name = "OrchestratorDisabledError";
  }
}

// ── Config ────────────────────────────────────────────────────────────────────
export function loadConfig(env: NodeJS.ProcessEnv = process.env): OrchestratorConfig {
  const provider = (env.GROK_PROVIDER === "gateway" ? "gateway" : "xai") as GrokProvider;
  return {
    enabled: env.GROK_ORCHESTRATOR_ENABLED === "true",
    provider,
    // Run `grok-orchestrate models` to confirm the exact id of the new build.
    model: env.GROK_MODEL || "grok-4",
    xaiApiKey: env.XAI_API_KEY || "",
    xaiBaseUrl: env.XAI_BASE_URL || "https://api.x.ai/v1",
    gatewayUrl: env.AI_SERVICE_URL || "https://ai.grudge-studio.com",
    gatewayToken: env.GRUDACHAIN_API_TOKEN || env.ADMIN_API_KEY || "",
    maxTokens: Number(env.GROK_MAX_TOKENS || 2048),
  };
}

function assertEnabled(cfg: OrchestratorConfig): void {
  if (!cfg.enabled) throw new OrchestratorDisabledError();
}

function assertProviderCreds(cfg: OrchestratorConfig): void {
  if (cfg.provider === "xai" && !cfg.xaiApiKey) {
    throw new Error("XAI_API_KEY is not set (required for GROK_PROVIDER=xai).");
  }
  if (cfg.provider === "gateway" && !cfg.gatewayToken) {
    throw new Error("GRUDACHAIN_API_TOKEN is not set (required for GROK_PROVIDER=gateway).");
  }
}

// ── Low-level chat call (provider-switched) ────────────────────────────────────
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function chat(messages: ChatMessage[], cfg: OrchestratorConfig): Promise<string> {
  assertProviderCreds(cfg);

  if (cfg.provider === "gateway") {
    // ALE gateway /ai/grok (OpenAI-compatible body, returns { success, response }).
    // Available once the staged xAI handler is deployed to workers/ale.
    const res = await fetch(`${cfg.gatewayUrl}/ai/grok`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.gatewayToken}`,
      },
      body: JSON.stringify({ messages, model: cfg.model, max_tokens: cfg.maxTokens }),
    });
    if (!res.ok) {
      throw new Error(
        `Gateway /ai/grok failed (${res.status}). Has the handler been deployed? Falls back: set GROK_PROVIDER=xai.`,
      );
    }
    const data = (await res.json()) as { response?: string; error?: string };
    if (data.error) throw new Error(`Gateway error: ${data.error}`);
    return data.response || "";
  }

  // Direct xAI (OpenAI-compatible).
  const res = await fetch(`${cfg.xaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.xaiApiKey}`,
    },
    body: JSON.stringify({ model: cfg.model, messages, max_tokens: cfg.maxTokens, stream: false }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`xAI request failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content || "";
}

/** List models from xAI so callers can confirm the exact "new Grok build" id. */
export async function listModels(cfg: OrchestratorConfig = loadConfig()): Promise<string[]> {
  assertEnabled(cfg);
  if (cfg.provider !== "xai") {
    // The gateway has no model-list route; model discovery is an xAI-direct concern.
    return [cfg.model];
  }
  if (!cfg.xaiApiKey) throw new Error("XAI_API_KEY is not set.");
  const res = await fetch(`${cfg.xaiBaseUrl}/models`, {
    headers: { Authorization: `Bearer ${cfg.xaiApiKey}` },
  });
  if (!res.ok) throw new Error(`xAI /models failed (${res.status}).`);
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data || []).map((m) => m.id).sort();
}

// ── Proposal generation (read-only) ────────────────────────────────────────────
const SYSTEM_PROMPT = [
  "You are the Grudge Studio Legion orchestrator, powered by Grok.",
  "Your ONLY job is to PROPOSE operational improvements for the Grudge stack.",
  "You never execute anything; a human approves each proposal before it runs.",
  "",
  "Return STRICT JSON ONLY, no prose, in this exact shape:",
  '{"proposals":[{"target":"legion|assets|ops","agent":"code|art|lore|balance|qa|mission",',
  '"title":"...","command":"<shell/npm command, only for assets|ops>","rationale":"...",',
  '"risk":"low|medium|high"}]}',
  "",
  "Rules:",
  "- target=legion → set agent; omit command.",
  "- target=assets|ops → set a concrete command; omit agent.",
  "- Mark anything that deploys to production, deletes data, or writes to a remote DB as risk:high.",
  "- Prefer small, reversible, verifiable steps. Max 8 proposals.",
].join("\n");

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export interface ProposeOptions {
  goal: string;
  context?: unknown;
}

export async function proposeActions(
  { goal, context }: ProposeOptions,
  cfg: OrchestratorConfig = loadConfig(),
): Promise<Proposal[]> {
  assertEnabled(cfg);
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify({ goal, context: context ?? null }) },
  ];
  const raw = await chat(messages, cfg);

  let parsed: { proposals?: unknown[] };
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new Error(`Grok returned non-JSON output:\n${raw.slice(0, 400)}`);
  }

  const list = Array.isArray(parsed.proposals) ? parsed.proposals : [];
  return list.map((p): Proposal => {
    const o = (p ?? {}) as Record<string, unknown>;
    const target = (["legion", "assets", "ops"].includes(o.target as string)
      ? o.target
      : "ops") as ProposalTarget;
    const agent =
      target === "legion" && LEGION_AGENTS.includes(o.agent as LegionAgent)
        ? (o.agent as LegionAgent)
        : undefined;
    const risk = (["low", "medium", "high"].includes(o.risk as string)
      ? o.risk
      : "medium") as RiskLevel;
    return {
      id: shortId(),
      target,
      agent,
      title: String(o.title ?? "(untitled)"),
      command: typeof o.command === "string" ? o.command : undefined,
      rationale: String(o.rationale ?? ""),
      risk,
      requiresApproval: true,
    };
  });
}

// ── Gated execution (only for already-approved proposals) ──────────────────────
export interface ExecuteOptions {
  /** Must be explicitly true to actually queue a legion task. */
  confirm: boolean;
}

export async function executeApproved(
  proposal: Proposal,
  opts: ExecuteOptions,
  cfg: OrchestratorConfig = loadConfig(),
): Promise<ExecuteResult> {
  assertEnabled(cfg);

  // assets/ops are NEVER auto-run. We hand the command back for human review.
  if (proposal.target === "assets" || proposal.target === "ops") {
    return {
      id: proposal.id,
      status: "manual",
      detail: proposal.command
        ? `Review and run manually:\n  ${proposal.command}`
        : "No command supplied; nothing to run.",
    };
  }

  // legion → queue a task on the gateway. Only with explicit confirm.
  if (!proposal.agent) {
    return { id: proposal.id, status: "skipped", detail: "Legion proposal missing agent." };
  }
  if (!opts.confirm) {
    return {
      id: proposal.id,
      status: "dry-run",
      detail: `Would dispatch to legion agent "${proposal.agent}" (re-run with --confirm).`,
    };
  }
  if (!cfg.gatewayToken) {
    return {
      id: proposal.id,
      status: "error",
      detail: "GRUDACHAIN_API_TOKEN (or ADMIN_API_KEY) is not set (required for /legion/dispatch).",
    };
  }

  try {
    const res = await fetch(`${cfg.gatewayUrl}/legion/dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.gatewayToken}`,
      },
      body: JSON.stringify({
        agent: proposal.agent,
        task: proposal.title,
        priority: proposal.risk === "high" ? 3 : proposal.risk === "medium" ? 2 : 1,
        context: { rationale: proposal.rationale, proposalId: proposal.id },
      }),
    });
    if (!res.ok) {
      return { id: proposal.id, status: "error", detail: `/legion/dispatch ${res.status}` };
    }
    const data = (await res.json()) as { task?: { id?: string } };
    return {
      id: proposal.id,
      status: "queued",
      detail: `Queued legion task ${data.task?.id ?? "(unknown id)"} for agent ${proposal.agent}.`,
    };
  } catch (e) {
    return { id: proposal.id, status: "error", detail: (e as Error).message };
  }
}
