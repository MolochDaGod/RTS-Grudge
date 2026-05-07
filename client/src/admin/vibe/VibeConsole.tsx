import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type CSSProperties,
} from "react";
import { useGameConfig } from "@/lib/stores/useGameConfig";
import { useEditorStore } from "@/game/editor/EditorStore";
import { puterReady, puterSignIn, usePuterUser } from "@/lib/auth/puter";
import { puterChatStream, PUTER_MODELS } from "./puterChat";
import {
  saveSession,
  listSessions,
  loadSession,
  deleteSession,
  renameSession,
  type VibeSession,
  type VibeSessionMeta,
} from "./vibeSessions";
import {
  listUserWorkflows,
  addUserWorkflow,
  deleteUserWorkflow,
  saveUserWorkflow,
} from "./vibeWorkflows";
import {
  parseVibeEdits,
  parseSceneActions,
  stripActionBlocks,
  summarizeEdit,
  summarizeScene,
  describeSceneObject,
  DEFAULT_WORKFLOWS,
  type VibeWorkflow,
  type ChatBlock,
  type AgentStep,
  type EditApplyResult,
  type SceneApplyResult,
  type ParsedEdit,
} from "./types";
import { executeSceneAction, revertSceneAction } from "./sceneExec";
import { setConsoleFocused } from "./useConsole";
import { useDictation } from "./useDictation";

// ─── Theme ────────────────────────────────────────────────────────────
const T = {
  bg: "#07060a",
  bgPanel: "#0d0c12",
  bgBlock: "#11101a",
  bgBlockUser: "#161425",
  bgInput: "#0a0910",
  border: "rgba(140,120,255,0.12)",
  borderHot: "rgba(140,120,255,0.4)",
  text: "#cfd2e3",
  textDim: "#7a7892",
  accent: "#a99cff",
  accentDim: "#6e62b8",
  ok: "#54d18c",
  err: "#ff6a6a",
  warn: "#ffaa55",
  scene: "#d2a8ff",
  edit: "#f0883e",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
};

// ─── Provider catalog ────────────────────────────────────────────────
interface ConsoleModel { id: string; name: string; provider: string; }
const PUTER_PROVIDER_MODELS: ConsoleModel[] = PUTER_MODELS.map((m) => ({
  id: `puter:${m.id}`,
  name: m.name,
  provider: "Puter",
}));

const FALLBACK_MODELS: ConsoleModel[] = [
  { id: "x-ai/grok-4.1-fast:free", name: "Grok 4.1 Fast", provider: "OpenRouter" },
  { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash", provider: "OpenRouter" },
  { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3", provider: "OpenRouter" },
];

// ─── System prompt (Warp Agent tone) ─────────────────────────────────
const VIBE_SYSTEM_PROMPT = `You are VIBE — the in-engine agent for the Grudge Game Engine (R3F + Rapier + XState + Grudge Warlords stats).

Operate like a senior engineer pairing with the user. Be terse and decisive.

OUTPUT RULES
- Lead with a one-line plan, then act.
- No filler ("Sure!", "Let me…", "I'll try to…"). No restating the request.
- Prefer doing over describing. If you need to make changes, emit the action block AND nothing else as the next paragraph.
- For multi-step plans, number the steps; each action block is one step.

ACTION BLOCKS — emit exactly these fences, the UI parses them as agent steps.

Source-code edit:
\`\`\`vibe-edit
FILE: client/src/path/to/file.ts
ACTION: replace
OLD: |exact text to find|
NEW: |replacement text|
\`\`\`

Or to overwrite a file:
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

Allowed object types: primitive | model | light | group | spawn | trigger | empty | prefab
Primitive shapes: box | sphere | cylinder | cone | torus | plane
Light types (set in properties.lightType): point | spot | directional | hemisphere | ambient
Prefab categories: character | animal | building | weapon | vehicle | nature | ship | item | primitive | effect

When asked a question that doesn't require a change, just answer — short paragraphs, code only when meaningful.`;

// ─── Slash commands ──────────────────────────────────────────────────
type SlashCmd = { name: string; description: string; run?: string };
const SLASH_COMMANDS: SlashCmd[] = [
  { name: "/scene",    description: "Add or modify a scene object" },
  { name: "/edit",     description: "Edit a source file" },
  { name: "/clear",    description: "Clear the transcript" },
  { name: "/save",     description: "Save current session (overwrite)" },
  { name: "/saveas",   description: "Save as a new session entry" },
  { name: "/load",     description: "Load a saved session" },
  { name: "/help",     description: "Show all commands" },
  { name: "/model",    description: "Switch active model" },
  { name: "/provider", description: "Switch active provider" },
];

const RECENT_KEY = "vibe.recentPrompts";

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}
function pushRecent(p: string) {
  const list = [p, ...readRecent().filter((x) => x !== p)].slice(0, 30);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
}

function getSceneContext(): string {
  const store = useEditorStore.getState();
  const { objects, selectedId, selectedIds } = store;
  const selected = selectedId ? objects.find(o => o.id === selectedId) : null;
  const lines: string[] = [];
  lines.push(`Scene: ${objects.length} objects`);
  if (selected) lines.push(`Selected: ${describeSceneObject(selected)}`);
  if (selectedIds.length > 1) lines.push(`Multi-selected: ${selectedIds.length} objects`);
  const roots = objects.filter(o => !o.parentId).slice(0, 15);
  for (const o of roots) lines.push(`  - ${describeSceneObject(o)}`);
  return lines.join("\n");
}

interface VibeConsoleProps {
  /** "panel" = embedded in admin panel, "overlay" = in-game floating */
  variant?: "panel" | "overlay";
  onClose?: () => void;
}

export default function VibeConsole({ variant = "panel", onClose }: VibeConsoleProps) {
  const [blocks, setBlocks] = useState<ChatBlock[]>(() => [{
    id: "welcome",
    role: "assistant",
    text: "VIBE ready. Ctrl+K for commands, ` for in-game console, /help for slash-commands.",
    rawText: "",
    status: "ok",
    timestamp: Date.now(),
  }]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [models, setModels] = useState<ConsoleModel[]>([
    ...PUTER_PROVIDER_MODELS,
    ...FALLBACK_MODELS,
  ]);
  const [selectedModelId, setSelectedModelId] = useState<string>(PUTER_PROVIDER_MODELS[0].id);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteFilter, setPaletteFilter] = useState("");
  const [sessionsView, setSessionsView] = useState<VibeSessionMeta[] | null>(null);
  const [autoEdit, setAutoEdit] = useState(false);
  const [autoScene, setAutoScene] = useState(true);
  const [includeScene, setIncludeScene] = useState(true);
  const [includeConfig, setIncludeConfig] = useState(true);
  const [sessionId, setSessionId] = useState<string>(() => `s-${Date.now().toString(36)}`);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const [userWorkflows, setUserWorkflows] = useState<VibeWorkflow[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const config = useGameConfig((s) => s.config);
  const { user: puterUser, refresh: refreshPuter } = usePuterUser();

  const selectedModel = useMemo(
    () => models.find((m) => m.id === selectedModelId) ?? models[0],
    [models, selectedModelId],
  );
  const isPuter = selectedModel.provider === "Puter";

  // Load OpenRouter etc. models from server, merge with Puter list.
  useEffect(() => {
    fetch("/api/ai-models")
      .then((r) => r.json())
      .then((data) => {
        if (data.models?.length) {
          const merged = [...PUTER_PROVIDER_MODELS, ...data.models];
          setModels(merged);
        }
      })
      .catch(() => {/* keep fallback */});
  }, []);

  // Auto-scroll on new content.
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [blocks]);

  // Ctrl/Cmd+K palette + Ctrl+L clear + Esc closes overlay/palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        setPaletteFilter("");
      } else if (meta && e.key.toLowerCase() === "l") {
        e.preventDefault();
        clearTranscript();
      } else if (e.key === "Escape") {
        if (paletteOpen) { setPaletteOpen(false); return; }
        if (sessionsView) { setSessionsView(null); return; }
        if (variant === "overlay" && onClose) onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, sessionsView, variant, onClose]);

  // Track focus for in-game overlay so game controllers stop reading keys.
  useEffect(() => {
    if (variant !== "overlay") return;
    setConsoleFocused(true);
    return () => setConsoleFocused(false);
  }, [variant]);

  const ghostSuggestion = useMemo(() => {
    if (!input || running) return "";
    if (input.startsWith("/")) return "";
    const lower = input.toLowerCase();
    const fromRecent = recent.find((r) => r.toLowerCase().startsWith(lower) && r.length > input.length);
    if (fromRecent) return fromRecent.slice(input.length);
    const allWf = [...DEFAULT_WORKFLOWS, ...userWorkflows];
    const wf = allWf.find((w) => w.prompt.toLowerCase().startsWith(lower) && w.prompt.length > input.length);
    return wf ? wf.prompt.slice(input.length) : "";
  }, [input, running, recent, userWorkflows]);

  // ─── Block / step helpers ──────────────────────────────────────────
  const updateBlock = useCallback((id: string, patch: Partial<ChatBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const updateStep = useCallback((blockId: string, stepId: string, patch: Partial<AgentStep>) => {
    setBlocks((prev) => prev.map((b) => {
      if (b.id !== blockId) return b;
      return { ...b, steps: (b.steps ?? []).map((s) => s.id === stepId ? { ...s, ...patch } : s) };
    }));
  }, []);

  const applyEditStep = useCallback(async (blockId: string, step: AgentStep) => {
    if (!step.edit) return;
    updateStep(blockId, step.id, { status: "running" });
    try {
      const res = await fetch("/api/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edits: [step.edit] }),
      });
      const data = await res.json();
      const result: EditApplyResult = data.results?.[0] ?? { file: step.edit.file, status: "error", message: "no result" };
      updateStep(blockId, step.id, {
        status: result.status === "error" ? "error" : "ok",
        result,
        applied: result.status !== "error",
      });
    } catch (e: any) {
      updateStep(blockId, step.id, { status: "error", result: { file: step.edit.file, status: "error", message: e?.message || String(e) }, applied: false });
    }
  }, [updateStep]);

  const applySceneStep = useCallback((blockId: string, step: AgentStep) => {
    if (!step.scene) return;
    updateStep(blockId, step.id, { status: "running" });
    const result: SceneApplyResult = executeSceneAction(step.scene);
    updateStep(blockId, step.id, {
      status: result.status === "error" ? "error" : "ok",
      result,
      applied: result.status !== "error",
    });
  }, [updateStep]);

  // Revert applies the true inverse using ids/content tracked at Apply time.
  // - vibe-edit + ACTION=replace: send a swapped {old↔new} edit to the server.
  // - vibe-edit + ACTION=write: best-effort — flag for manual verification
  //   (no pre-edit snapshot is captured today; tracked as a follow-up task).
  // - vibe-scene + add-object/add-prefab: removeObject(createdObjectId).
  // - vibe-scene + save-prefab: removeCustomPrefab(createdPrefabId).
  const revertStep = useCallback(async (blockId: string, step: AgentStep) => {
    if (step.kind === "scene" && step.scene) {
      const prev = step.result as SceneApplyResult | undefined;
      const result = prev
        ? revertSceneAction(prev)
        : { action: step.scene.action, name: step.scene.data?.name || "?", status: "error" as const, message: "no apply result tracked" };
      updateStep(blockId, step.id, { applied: false, status: result.status === "error" ? "error" : "ok", result });
      return;
    }
    if (step.kind === "edit" && step.edit) {
      if (step.edit.action === "replace" && step.edit.old != null && step.edit.new != null) {
        updateStep(blockId, step.id, { status: "running" });
        try {
          const res = await fetch("/api/ai-edit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              edits: [{ file: step.edit.file, action: "replace", old: step.edit.new, new: step.edit.old }],
            }),
          });
          const data = await res.json();
          const r: EditApplyResult = data.results?.[0] ?? { file: step.edit.file, status: "error", message: "no result" };
          updateStep(blockId, step.id, {
            applied: false,
            status: r.status === "error" ? "error" : "ok",
            result: { ...r, message: r.message || "reverted (swap applied)" },
          });
        } catch (e: any) {
          updateStep(blockId, step.id, { status: "error", result: { file: step.edit.file, status: "error", message: e?.message || String(e) }, applied: false });
        }
        return;
      }
      // For ACTION=write we'd need the prior file content; not tracked yet.
      updateStep(blockId, step.id, {
        applied: false,
        status: "ok",
        result: { file: step.edit.file, status: "modified", message: "marked reverted — verify file (write actions can't be inverted yet)" } as EditApplyResult,
      });
    }
  }, [updateStep]);

  // ─── Send a prompt ─────────────────────────────────────────────────
  const sendPrompt = useCallback(async (prompt: string) => {
    if (!prompt.trim() || running) return;

    // Slash command intercept
    if (prompt.startsWith("/")) {
      const handled = await handleSlash(prompt);
      if (handled) { setInput(""); return; }
    }

    pushRecent(prompt);
    setRecent(readRecent());

    const userBlock: ChatBlock = {
      id: `u-${Date.now()}`,
      role: "user",
      text: prompt,
      status: "ok",
      timestamp: Date.now(),
    };
    const assistantBlockId = `a-${Date.now() + 1}`;
    const assistantBlock: ChatBlock = {
      id: assistantBlockId,
      role: "assistant",
      text: "",
      rawText: "",
      status: "running",
      timestamp: Date.now() + 1,
      model: selectedModel.name,
      provider: selectedModel.provider,
      steps: [],
    };
    setBlocks((prev) => [...prev, userBlock, assistantBlock]);
    setInput("");
    setRunning(true);

    const history = [...blocks, userBlock]
      .filter((b) => b.role !== "system" && b.id !== "welcome")
      .map((b) => ({ role: b.role as "user" | "assistant", content: b.role === "assistant" ? (b.rawText || b.text) : b.text }));

    try {
      let full = "";

      if (isPuter) {
        const puterModelId = selectedModelId.replace(/^puter:/, "");
        const sysAndCtx = buildSystemMessage();
        const messages = [
          { role: "system" as const, content: sysAndCtx },
          ...history,
        ];
        await puterChatStream(messages, puterModelId, {
          onToken: (chunk) => {
            full += chunk;
            updateBlock(assistantBlockId, {
              text: stripActionBlocks(full) || full,
              rawText: full,
            });
          },
          onDone: () => {/* finalized below */},
          onError: (err) => { throw err; },
        });
      } else {
        // Server-routed (OpenRouter / MegaLLM / etc.)
        const body: any = {
          messages: history,
          model: selectedModelId,
          systemPrompt: VIBE_SYSTEM_PROMPT,
          includeSource: true,
        };
        if (includeConfig) body.gameConfig = config;
        if (includeScene) body.sceneContext = getSceneContext();
        const res = await fetch("/api/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        full = data.choices?.[0]?.message?.content || "";
      }

      // Parse action steps and finalize block.
      const edits = parseVibeEdits(full);
      const scenes = parseSceneActions(full);
      const steps: AgentStep[] = [];
      edits.forEach((e, i) => steps.push({
        id: `step-e-${i}`, kind: "edit", status: "pending", edit: e, applied: false,
      }));
      scenes.forEach((s, i) => steps.push({
        id: `step-s-${i}`, kind: "scene", status: "pending", scene: s, applied: false,
      }));

      const finalText = stripActionBlocks(full) || (steps.length > 0 ? "(agent step)" : full);
      updateBlock(assistantBlockId, {
        text: finalText,
        rawText: full,
        status: "ok",
        steps,
      });

      // Auto-apply when toggled on.
      for (const step of steps) {
        if (step.kind === "edit" && autoEdit) await applyEditStep(assistantBlockId, step);
        if (step.kind === "scene" && autoScene) applySceneStep(assistantBlockId, step);
      }
    } catch (err: any) {
      updateBlock(assistantBlockId, {
        status: "error",
        text: `Error: ${err?.message || String(err)}`,
        error: err?.message || String(err),
      });
    } finally {
      setRunning(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, selectedModelId, isPuter, blocks, autoEdit, autoScene, includeScene, includeConfig, config]);

  function buildSystemMessage(): string {
    const parts: string[] = [VIBE_SYSTEM_PROMPT];
    if (includeConfig) parts.push(`\n\nCURRENT GAME CONFIG:\n${JSON.stringify(config, null, 2).slice(0, 6000)}`);
    if (includeScene) parts.push(`\n\nCURRENT SCENE STATE:\n${getSceneContext()}`);
    return parts.join("");
  }

  // ─── Slash command handler ─────────────────────────────────────────
  async function handleSlash(prompt: string): Promise<boolean> {
    const [cmd, ...rest] = prompt.split(" ");
    const arg = rest.join(" ").trim();
    switch (cmd) {
      case "/clear":
        clearTranscript();
        return true;
      case "/help":
        appendInfo(SLASH_COMMANDS.map((c) => `${c.name.padEnd(11)} ${c.description}`).join("\n"));
        return true;
      case "/save":
        await doSave(arg || `Session ${new Date().toLocaleString()}`);
        return true;
      case "/saveas":
        await doSave(arg || `Session ${new Date().toLocaleString()}`, true);
        return true;
      case "/load":
        await openSessionsList();
        return true;
      case "/model": {
        const m = models.find((mm) => mm.name.toLowerCase() === arg.toLowerCase() || mm.id.toLowerCase() === arg.toLowerCase());
        if (m) { setSelectedModelId(m.id); appendInfo(`Model → ${m.name} (${m.provider})`); }
        else appendInfo(`No model named "${arg}". Try Ctrl+K → Models.`);
        return true;
      }
      case "/provider": {
        const m = models.find((mm) => mm.provider.toLowerCase() === arg.toLowerCase());
        if (m) { setSelectedModelId(m.id); appendInfo(`Provider → ${m.provider} (using ${m.name})`); }
        else appendInfo(`No provider "${arg}".`);
        return true;
      }
      case "/scene":
      case "/edit":
        // Re-route through normal send with a hint prefix.
        setInput("");
        sendPrompt(`${cmd === "/scene" ? "Update the scene:" : "Edit the source:"} ${arg}`);
        return true;
      default:
        appendInfo(`Unknown command ${cmd}. /help for list.`);
        return true;
    }
  }

  function appendInfo(text: string) {
    setBlocks((prev) => [...prev, {
      id: `i-${Date.now()}`, role: "system", text, status: "ok", timestamp: Date.now(),
    }]);
  }

  function clearTranscript() {
    // /clear and the Clear header button start a fresh session id so the
    // next /save creates a new entry instead of overwriting the previous.
    setSessionId(`s-${Date.now().toString(36)}`);
    setBlocks([{
      id: "welcome",
      role: "assistant",
      text: "Cleared.",
      status: "ok",
      timestamp: Date.now(),
    }]);
  }

  async function doSave(title: string, asNew: boolean = false) {
    // "Save As" allocates a fresh id so the existing session row is kept
    // intact alongside the new copy.
    const id = asNew ? `s-${Date.now().toString(36)}` : sessionId;
    const sess: VibeSession = {
      id,
      title,
      createdAt: blocks[0]?.timestamp ?? Date.now(),
      updatedAt: Date.now(),
      model: selectedModel.name,
      provider: selectedModel.provider,
      messageCount: blocks.length,
      blocks,
      storage: puterUser ? "puter" : "local",
    };
    const saved = await saveSession(sess);
    if (asNew) setSessionId(id);
    appendInfo(`Saved "${saved.title}" to ${saved.storage === "puter" ? "Puter cloud" : "local browser"}${asNew ? " (new session)" : ""}.`);
  }

  async function openSessionsList() {
    const list = await listSessions();
    setSessionsView(list);
  }

  async function loadSessionById(id: string) {
    const sess = await loadSession(id);
    if (sess) {
      setBlocks(sess.blocks);
      setSessionId(sess.id);
      setSessionsView(null);
      appendInfo(`Loaded "${sess.title}".`);
    }
  }

  // ─── Block actions: copy / share / rerun / delete ──────────────────
  const copyBlock = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); appendInfo("Copied to clipboard."); }
    catch { appendInfo("Copy failed (clipboard blocked)."); }
  }, []);

  const shareBlock = useCallback(async (block: ChatBlock) => {
    const md = `**${block.role.toUpperCase()}** ${block.model ? `(${block.model})` : ""}\n\n${block.rawText || block.text}`;
    const shareData = { title: "VIBE conversation", text: md };
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share && (!('canShare' in navigator) || (navigator as any).canShare(shareData))) {
        await (navigator as any).share(shareData);
        return;
      }
    } catch { /* fall through to clipboard */ }
    try { await navigator.clipboard.writeText(md); appendInfo("Block markdown copied — paste anywhere to share."); }
    catch { appendInfo("Share unavailable."); }
  }, []);

  const rerunBlock = useCallback((block: ChatBlock) => {
    if (block.role === "user") sendPrompt(block.text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendPrompt]);

  const deleteBlockById = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, collapsed: !b.collapsed } : b));
  }, []);

  // ─── Workflows: add / delete (synced to Puter FS, falls back to local) ─
  const refreshWorkflows = useCallback(async () => {
    try {
      setUserWorkflows(await listUserWorkflows());
    } catch (e: any) {
      console.warn("[vibe] workflow refresh failed:", e?.message || e);
    }
  }, []);
  const addWorkflow = useCallback(async (name: string, prompt: string) => {
    await addUserWorkflow(name, prompt);
    await refreshWorkflows();
    appendInfo(`Workflow "${name}" saved.`);
  }, [refreshWorkflows]);
  const removeWorkflow = useCallback(async (id: string) => {
    await deleteUserWorkflow(id);
    await refreshWorkflows();
  }, [refreshWorkflows]);
  const editWorkflow = useCallback(async (wf: VibeWorkflow) => {
    const name = window.prompt("Workflow name:", wf.name);
    if (name === null) return;
    const prompt = window.prompt("Workflow prompt:", wf.prompt);
    if (prompt === null) return;
    const trimmedName = name.trim();
    const trimmedPrompt = prompt.trim();
    if (!trimmedName || !trimmedPrompt) {
      appendInfo("Workflow not saved — name and prompt are required.");
      return;
    }
    await saveUserWorkflow({ id: wf.id, name: trimmedName, prompt: trimmedPrompt });
    await refreshWorkflows();
    appendInfo(`Workflow "${trimmedName}" updated.`);
  }, [refreshWorkflows]);

  // Initial load + reload whenever the Puter sign-in state changes so a
  // user's workflows follow them across machines.
  useEffect(() => { refreshWorkflows(); }, [refreshWorkflows, puterUser?.uuid]);

  // ─── Sessions: rename ──────────────────────────────────────────────
  const renameSessionById = useCallback(async (id: string, title: string) => {
    await renameSession(id, title);
    setSessionsView(await listSessions());
  }, []);

  // ─── Voice dictation (push-to-talk) ────────────────────────────────
  // We capture the input value at start so live transcription appends to
  // whatever the user already typed. Interim results are previewed in the
  // input; final results commit. Saying "send it" / "submit" / "stop
  // dictation" stops the recognizer (and submits when there's content).
  const dictationBaseRef = useRef("");
  const dictation = useDictation({
    onTranscript: (text, isFinal) => {
      const base = dictationBaseRef.current;
      const sep = base && !base.endsWith(" ") ? " " : "";
      const next = base + sep + text;
      setInput(next);
      if (isFinal) dictationBaseRef.current = next;
    },
    onStopWord: (_finalText) => {
      // The cleaned final chunk was already appended to the ref by the
      // preceding onTranscript(_, true) call, so the ref holds the full
      // text to submit (state may not have flushed yet — don't read it).
      const txt = dictationBaseRef.current.trim();
      if (txt) sendPrompt(txt);
    },
    onError: (msg) => appendInfo(msg),
  });
  const toggleDictation = useCallback(() => {
    if (dictation.listening) {
      dictation.stop();
    } else {
      dictationBaseRef.current = input;
      dictation.start();
    }
  }, [dictation, input]);

  // ─── Input keys ────────────────────────────────────────────────────
  const onInputKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab accepts ghost suggestion
    if (e.key === "Tab" && ghostSuggestion) {
      e.preventDefault();
      setInput(input + ghostSuggestion);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (dictation.listening) dictation.stop();
      sendPrompt(input);
      setHistoryIdx(-1);
      return;
    }
    if (e.key === "ArrowUp" && !input) {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, recent.length - 1);
      if (next >= 0) { setHistoryIdx(next); setInput(recent[next]); }
      return;
    }
    if (e.key === "ArrowDown" && historyIdx >= 0) {
      e.preventDefault();
      const next = historyIdx - 1;
      setHistoryIdx(next);
      setInput(next < 0 ? "" : recent[next]);
      return;
    }
  };

  // ─── Render ────────────────────────────────────────────────────────
  const containerStyle: CSSProperties = variant === "overlay"
    ? { position: "fixed", top: 0, left: 0, right: 0, height: "55vh", background: T.bg, color: T.text, fontFamily: T.mono, fontSize: 12, display: "flex", flexDirection: "column", borderBottom: `1px solid ${T.borderHot}`, boxShadow: "0 12px 40px rgba(0,0,0,0.6)", zIndex: 9999 }
    : { display: "flex", flexDirection: "column", height: "100%", background: T.bg, color: T.text, fontFamily: T.mono, fontSize: 12 };

  return (
    <div style={containerStyle}>
      <Header
        variant={variant}
        selectedModel={selectedModel}
        onPickModel={() => { setPaletteOpen(true); setPaletteFilter(""); }}
        puterUser={puterUser?.username ?? null}
        onPuterSignIn={async () => { await puterSignIn(); refreshPuter(); }}
        autoEdit={autoEdit}
        autoScene={autoScene}
        includeScene={includeScene}
        includeConfig={includeConfig}
        setAutoEdit={setAutoEdit}
        setAutoScene={setAutoScene}
        setIncludeScene={setIncludeScene}
        setIncludeConfig={setIncludeConfig}
        onClear={clearTranscript}
        onSave={() => doSave(`Session ${new Date().toLocaleTimeString()}`)}
        onSaveAs={() => {
          const name = window.prompt("Save as new session — name:", `Session ${new Date().toLocaleTimeString()}`);
          if (name) doSave(name, true);
        }}
        onSessions={openSessionsList}
        onClose={onClose}
      />

      <div ref={transcriptRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {blocks.map((b) => (
          <Block
            key={b.id}
            block={b}
            onApplyStep={(s) => s.kind === "edit" ? applyEditStep(b.id, s) : applySceneStep(b.id, s)}
            onRevertStep={(s) => revertStep(b.id, s)}
            onCopy={(text) => copyBlock(text)}
            onShare={() => shareBlock(b)}
            onRerun={() => rerunBlock(b)}
            onDelete={() => deleteBlockById(b.id)}
            onToggleCollapse={() => toggleCollapse(b.id)}
          />
        ))}
        {running && <RunningIndicator model={selectedModel} />}
      </div>

      <InputArea
        value={input}
        onChange={(v) => {
          setInput(v);
          // Slash trigger: typing "/" as the first char opens the palette
          // pre-filtered to the slash text, so the user can pick a command
          // without leaving the keyboard.
          if (v.startsWith("/") && !paletteOpen) {
            setPaletteOpen(true);
            setPaletteFilter(v);
          } else if (paletteOpen && paletteFilter.startsWith("/")) {
            // Keep palette filter in sync while the user keeps typing the slash text
            setPaletteFilter(v.startsWith("/") ? v : "");
            if (!v.startsWith("/")) setPaletteOpen(false);
          }
        }}
        onKey={onInputKey}
        onSend={() => { if (dictation.listening) dictation.stop(); sendPrompt(input); }}
        ghost={ghostSuggestion}
        running={running}
        inputRef={inputRef}
        onFocus={() => variant === "overlay" && setConsoleFocused(true)}
        onBlur={() => variant === "overlay" && setConsoleFocused(false)}
        dictationListening={dictation.listening}
        dictationSupported={dictation.supported}
        onToggleDictation={toggleDictation}
      />

      {paletteOpen && (
        <CommandPalette
          filter={paletteFilter}
          onFilterChange={setPaletteFilter}
          models={models}
          recent={recent}
          workflows={DEFAULT_WORKFLOWS}
          userWorkflows={userWorkflows}
          currentInput={input}
          onPickModel={(m) => { setSelectedModelId(m.id); setPaletteOpen(false); appendInfo(`Model → ${m.name}`); }}
          onPickProvider={(p) => {
            const m = models.find((mm) => mm.provider === p);
            if (m) { setSelectedModelId(m.id); setPaletteOpen(false); appendInfo(`Provider → ${p}`); }
          }}
          onPickSlash={(c) => { setInput(c.name + " "); setPaletteOpen(false); inputRef.current?.focus(); }}
          onPickPrompt={(text) => { setInput(text); setPaletteOpen(false); inputRef.current?.focus(); }}
          onSaveCurrentAsWorkflow={(name) => {
            const text = input.trim();
            if (!text) { appendInfo("Nothing to save — type a prompt first."); return; }
            addWorkflow(name, text);
          }}
          onDeleteWorkflow={removeWorkflow}
          onEditWorkflow={editWorkflow}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {sessionsView && (
        <SessionsList
          sessions={sessionsView}
          puterSignedIn={!!puterUser}
          onLoad={loadSessionById}
          onRename={renameSessionById}
          onDelete={async (id) => { await deleteSession(id); setSessionsView(await listSessions()); }}
          onClose={() => setSessionsView(null)}
        />
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────

function Header(props: {
  variant: "panel" | "overlay";
  selectedModel: ConsoleModel;
  onPickModel: () => void;
  puterUser: string | null;
  onPuterSignIn: () => void;
  autoEdit: boolean; autoScene: boolean; includeScene: boolean; includeConfig: boolean;
  setAutoEdit: (v: boolean) => void; setAutoScene: (v: boolean) => void;
  setIncludeScene: (v: boolean) => void; setIncludeConfig: (v: boolean) => void;
  onClear: () => void; onSave: () => void; onSaveAs: () => void; onSessions: () => void; onClose?: () => void;
}) {
  const {
    variant, selectedModel, onPickModel, puterUser, onPuterSignIn,
    autoEdit, autoScene, includeScene, includeConfig,
    setAutoEdit, setAutoScene, setIncludeScene, setIncludeConfig,
    onClear, onSave, onSaveAs, onSessions, onClose,
  } = props;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${T.border}`, background: T.bgPanel, flexWrap: "wrap" }}>
      <span style={{ color: T.accent, fontWeight: 700, letterSpacing: 1 }}>VIBE</span>
      <span style={{ color: T.textDim, fontSize: 10 }}>{variant === "overlay" ? "in-game" : "console"}</span>
      <button onClick={onPickModel} style={btn()} title="Click or Ctrl+K → Models">
        {selectedModel.provider} · {selectedModel.name}
      </button>
      {selectedModel.provider === "Puter" && (
        puterUser
          ? <span style={{ color: T.ok, fontSize: 10 }}>● {puterUser}</span>
          : <button onClick={onPuterSignIn} style={btn(T.warn)}>Sign in to Puter</button>
      )}
      <div style={{ flex: 1 }} />
      <Chip label="Config" active={includeConfig} onChange={setIncludeConfig} />
      <Chip label="Scene" active={includeScene} onChange={setIncludeScene} color={T.ok} />
      <Chip label="Auto-Edit" active={autoEdit} onChange={setAutoEdit} color={T.edit} />
      <Chip label="Auto-Scene" active={autoScene} onChange={setAutoScene} color={T.scene} />
      <button onClick={onSessions} style={btn()}>Sessions</button>
      <button onClick={onSave} style={btn()} title="Overwrite current session">Save</button>
      <button onClick={onSaveAs} style={btn()} title="Save as a new session entry">Save As</button>
      <button onClick={onClear} style={btn()}>Clear</button>
      <span style={{ color: T.textDim, fontSize: 9, paddingLeft: 4 }}>⌘K</span>
      {onClose && <button onClick={onClose} style={btn(T.err)}>Close</button>}
    </div>
  );
}

function btn(color = T.text): CSSProperties {
  return {
    background: T.bgBlock,
    border: `1px solid ${T.border}`,
    color,
    padding: "3px 8px",
    fontSize: 10,
    borderRadius: 4,
    cursor: "pointer",
    fontFamily: T.mono,
  };
}

function Chip({ label, active, onChange, color }: { label: string; active: boolean; onChange: (v: boolean) => void; color?: string }) {
  const c = color || T.accent;
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: active ? c : T.textDim, cursor: "pointer", padding: "2px 6px", borderRadius: 4, border: `1px solid ${active ? c + "55" : "transparent"}` }}>
      <input type="checkbox" checked={active} onChange={(e) => onChange(e.target.checked)} style={{ display: "none" }} />
      <span style={{ width: 6, height: 6, borderRadius: 3, background: active ? c : T.border }} />
      {label}
    </label>
  );
}

function StatusPill({ status }: { status: ChatBlock["status"] }) {
  const map: Record<ChatBlock["status"], { label: string; color: string }> = {
    running: { label: "running", color: T.warn },
    ok:      { label: "ok",      color: T.ok },
    error:   { label: "error",   color: T.err },
  };
  const v = map[status];
  return <span style={{ fontSize: 9, color: v.color, border: `1px solid ${v.color}55`, padding: "0 5px", borderRadius: 3 }}>{v.label}</span>;
}

function Block({
  block, onApplyStep, onRevertStep, onCopy, onShare, onRerun, onDelete, onToggleCollapse,
}: {
  block: ChatBlock;
  onApplyStep: (s: AgentStep) => void;
  onRevertStep: (s: AgentStep) => void;
  onCopy: (text: string) => void;
  onShare: () => void;
  onRerun: () => void;
  onDelete: () => void;
  onToggleCollapse: () => void;
}) {
  const isUser = block.role === "user";
  const isSystem = block.role === "system";
  const accentColor = isUser ? T.accent : isSystem ? T.textDim : T.text;
  return (
    <div style={{
      marginBottom: 10,
      background: isUser ? T.bgBlockUser : T.bgBlock,
      border: `1px solid ${T.border}`,
      borderLeft: `2px solid ${accentColor}`,
      borderRadius: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ color: accentColor, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>
          {block.role === "user" ? "$" : block.role === "system" ? "i" : "λ"}
        </span>
        <span style={{ color: T.textDim, fontSize: 10 }}>
          {block.role}{block.model ? ` · ${block.model}` : ""}
        </span>
        <StatusPill status={block.status} />
        <span style={{ flex: 1 }} />
        <span style={{ color: T.textDim, fontSize: 9 }}>{new Date(block.timestamp).toLocaleTimeString()}</span>
        <button onClick={onToggleCollapse} style={iconBtn()}>{block.collapsed ? "▸" : "▾"}</button>
        <button onClick={() => onCopy(block.rawText || block.text)} style={iconBtn()} title="Copy">⎘</button>
        <button onClick={onShare} style={iconBtn()} title="Share">↗</button>
        {block.role === "user" && <button onClick={onRerun} style={iconBtn()} title="Re-run">↻</button>}
        <button onClick={onDelete} style={iconBtn(T.err)} title="Delete">×</button>
      </div>
      {!block.collapsed && (
        <div style={{ padding: "8px 10px" }}>
          {block.text && (
            <div style={{ whiteSpace: "pre-wrap", color: isUser ? T.text : T.text, lineHeight: 1.5 }}>{block.text}</div>
          )}
          {block.steps && block.steps.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {block.steps.map((s) => (
                <StepBlock key={s.id} step={s} onApply={() => onApplyStep(s)} onRevert={() => onRevertStep(s)} />
              ))}
            </div>
          )}
          {block.error && (
            <div style={{ marginTop: 6, color: T.err, fontSize: 11 }}>! {block.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

function iconBtn(color = T.textDim): CSSProperties {
  return {
    background: "none", border: "none", color, cursor: "pointer", fontSize: 12, padding: "0 4px", fontFamily: T.mono,
  };
}

function StepBlock({ step, onApply, onRevert }: { step: AgentStep; onApply: () => void; onRevert: () => void }) {
  const isEdit = step.kind === "edit";
  const tone = isEdit ? T.edit : T.scene;
  const summary = isEdit ? summarizeEdit(step.edit!) : summarizeScene(step.scene!);
  const statusMap = { pending: "queued", running: "running", ok: "ok", error: "error" } as const;
  const statusColor = step.status === "error" ? T.err : step.status === "ok" ? T.ok : step.status === "running" ? T.warn : T.textDim;
  return (
    <div style={{ border: `1px solid ${tone}33`, background: T.bgPanel, borderRadius: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderBottom: `1px solid ${tone}22` }}>
        <span style={{ color: tone, fontWeight: 700, fontSize: 10, textTransform: "uppercase" }}>{isEdit ? "edit" : "scene"}</span>
        <span style={{ color: T.text, fontSize: 11 }}>{summary}</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: statusColor, fontSize: 9, border: `1px solid ${statusColor}55`, padding: "0 5px", borderRadius: 3 }}>{statusMap[step.status]}</span>
        {!step.applied && step.status !== "running" && (
          <button onClick={onApply} style={btn(T.ok)}>Apply</button>
        )}
        {step.applied && (
          <button onClick={onRevert} style={btn(T.warn)}>Revert</button>
        )}
      </div>
      {step.edit && (
        <DiffSummary edit={step.edit} />
      )}
      {step.scene && (
        <pre style={{ margin: 0, padding: "6px 10px", color: T.textDim, fontSize: 10, maxHeight: 140, overflow: "auto" }}>
          {JSON.stringify(step.scene.data, null, 2)}
        </pre>
      )}
      {step.result && "message" in step.result && step.result.message && (
        <div style={{ padding: "4px 10px", color: step.status === "error" ? T.err : T.textDim, fontSize: 10 }}>
          → {step.result.message}
        </div>
      )}
    </div>
  );
}

function DiffSummary({ edit }: { edit: ParsedEdit }) {
  if (edit.action === "write") {
    const preview = (edit.content ?? "").split("\n").slice(0, 8).join("\n");
    return (
      <pre style={{ margin: 0, padding: "6px 10px", color: T.ok, fontSize: 10, maxHeight: 160, overflow: "auto" }}>
+ {preview.replace(/\n/g, "\n+ ")}
      </pre>
    );
  }
  const oldP = (edit.old ?? "").split("\n").slice(0, 6).join("\n");
  const newP = (edit.new ?? "").split("\n").slice(0, 6).join("\n");
  return (
    <pre style={{ margin: 0, padding: "6px 10px", fontSize: 10, maxHeight: 200, overflow: "auto" }}>
      <span style={{ color: T.err }}>{`- ${oldP.replace(/\n/g, "\n- ")}\n`}</span>
      <span style={{ color: T.ok }}>{`+ ${newP.replace(/\n/g, "\n+ ")}`}</span>
    </pre>
  );
}

function RunningIndicator({ model }: { model: ConsoleModel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: T.bgBlock, borderLeft: `2px solid ${T.warn}`, borderRadius: 4, color: T.textDim }}>
      <span style={{ color: T.warn }}>●</span> {model.name} thinking…
    </div>
  );
}

function InputArea({ value, onChange, onKey, onSend, ghost, running, inputRef, onFocus, onBlur, dictationListening, dictationSupported, onToggleDictation }: {
  value: string;
  onChange: (v: string) => void;
  onKey: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  ghost: string;
  running: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onFocus: () => void;
  onBlur: () => void;
  dictationListening: boolean;
  dictationSupported: boolean;
  onToggleDictation: () => void;
}) {
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, padding: "8px 12px", background: T.bgPanel, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: T.accent, fontWeight: 700 }}>$</span>
        <div style={{ position: "relative", flex: 1 }}>
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKey}
            onFocus={onFocus}
            onBlur={onBlur}
            disabled={running}
            placeholder="Type a command, prompt, or /help — Tab accepts ghost text, ⌘K palette, Enter to run"
            rows={1}
            style={{
              width: "100%",
              background: T.bgInput,
              border: `1px solid ${T.border}`,
              borderRadius: 4,
              color: T.text,
              padding: "6px 10px",
              fontSize: 12,
              fontFamily: T.mono,
              resize: "none",
              outline: "none",
              minHeight: 28,
              maxHeight: 160,
            }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 160) + "px";
            }}
          />
          {ghost && (
            <span style={{
              position: "absolute",
              top: 6, left: 11,
              pointerEvents: "none",
              color: T.textDim,
              fontFamily: T.mono,
              fontSize: 12,
              whiteSpace: "pre-wrap",
              opacity: 0.5,
            }}>
              <span style={{ visibility: "hidden" }}>{value}</span>{ghost}
            </span>
          )}
        </div>
        <button
          onClick={onToggleDictation}
          disabled={!dictationSupported || running}
          title={
            !dictationSupported
              ? "Voice dictation not supported in this browser"
              : dictationListening
                ? "Stop dictation (or say \"send it\")"
                : "Start voice dictation"
          }
          aria-label={dictationListening ? "Stop voice dictation" : "Start voice dictation"}
          style={{
            background: dictationListening ? T.err : T.bgBlock,
            color: !dictationSupported ? T.textDim : dictationListening ? "#fff" : T.text,
            border: `1px solid ${dictationListening ? T.err : T.border}`,
            borderRadius: 4,
            padding: "4px 8px",
            fontSize: 14,
            cursor: !dictationSupported || running ? "default" : "pointer",
            opacity: !dictationSupported ? 0.4 : 1,
            fontFamily: T.mono,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ display: "inline-block", animation: dictationListening ? "vibePulse 1.2s ease-in-out infinite" : undefined }}>🎙</span>
          {dictationListening && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>REC</span>}
        </button>
        <button onClick={onSend} disabled={running || !value.trim()} style={{
          background: running || !value.trim() ? T.bgBlock : T.accentDim,
          color: running || !value.trim() ? T.textDim : "#fff",
          border: "none",
          borderRadius: 4,
          padding: "6px 14px",
          fontSize: 11,
          fontWeight: 700,
          cursor: running || !value.trim() ? "default" : "pointer",
          fontFamily: T.mono,
        }}>RUN</button>
        <style>{`@keyframes vibePulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
      </div>
    </div>
  );
}

// ─── Command Palette ─────────────────────────────────────────────────
function CommandPalette({
  filter, onFilterChange, models, recent, workflows, userWorkflows, currentInput,
  onPickModel, onPickProvider, onPickSlash, onPickPrompt,
  onSaveCurrentAsWorkflow, onDeleteWorkflow, onEditWorkflow, onClose,
}: {
  filter: string;
  onFilterChange: (v: string) => void;
  models: ConsoleModel[];
  recent: string[];
  workflows: typeof DEFAULT_WORKFLOWS;
  userWorkflows: VibeWorkflow[];
  currentInput: string;
  onPickModel: (m: ConsoleModel) => void;
  onPickProvider: (p: string) => void;
  onPickSlash: (c: SlashCmd) => void;
  onPickPrompt: (text: string) => void;
  onSaveCurrentAsWorkflow: (name: string) => void;
  onDeleteWorkflow: (id: string) => void;
  onEditWorkflow: (wf: VibeWorkflow) => void;
  onClose: () => void;
}) {
  const f = filter.toLowerCase();
  const providers = Array.from(new Set(models.map((m) => m.provider)));
  const matchedModels = models.filter((m) => `${m.provider} ${m.name}`.toLowerCase().includes(f));
  const matchedSlashes = SLASH_COMMANDS.filter((c) => c.name.includes(f) || c.description.toLowerCase().includes(f));
  const matchedRecent = recent.filter((r) => r.toLowerCase().includes(f)).slice(0, 8);
  const matchedWorkflows = workflows.filter((w) => `${w.name} ${w.prompt}`.toLowerCase().includes(f));
  const matchedUserWorkflows = userWorkflows.filter((w) => `${w.name} ${w.prompt}`.toLowerCase().includes(f));
  const matchedProviders = providers.filter((p) => p.toLowerCase().includes(f));
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 10000 }} />
      <div style={{
        position: "fixed",
        top: "12vh", left: "50%", transform: "translateX(-50%)",
        width: 560, maxHeight: "70vh",
        background: T.bgPanel, border: `1px solid ${T.borderHot}`, borderRadius: 8,
        zIndex: 10001, color: T.text, fontFamily: T.mono,
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
      }}>
        <input
          autoFocus
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Search commands, models, providers, recent prompts, workflows…"
          style={{
            background: "transparent", border: "none", borderBottom: `1px solid ${T.border}`,
            padding: "12px 14px", color: T.text, fontSize: 13, fontFamily: T.mono, outline: "none",
          }}
        />
        <div style={{ overflowY: "auto", padding: 6 }}>
          <Section title="Slash commands" items={matchedSlashes} render={(c) => (
            <Row key={c.name} label={c.name} hint={c.description} onClick={() => onPickSlash(c)} />
          )} />
          <Section title="Models" items={matchedModels.slice(0, 12)} render={(m) => (
            <Row key={m.id} label={`${m.provider} · ${m.name}`} hint={m.id} onClick={() => onPickModel(m)} />
          )} />
          <Section title="Providers" items={matchedProviders} render={(p) => (
            <Row key={p} label={p} hint="set provider" onClick={() => onPickProvider(p)} />
          )} />
          <Section title="Workflows" items={matchedWorkflows} render={(w) => (
            <Row key={w.id} label={w.name} hint={w.prompt} onClick={() => onPickPrompt(w.prompt)} />
          )} />
          {(matchedUserWorkflows.length > 0 || currentInput.trim()) && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ color: T.textDim, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, padding: "6px 10px 2px", display: "flex", alignItems: "center" }}>
                <span>Your workflows</span>
                <span style={{ flex: 1 }} />
                {currentInput.trim() && (
                  <button
                    onClick={() => {
                      const name = window.prompt("Name this workflow:", currentInput.slice(0, 40));
                      if (name) onSaveCurrentAsWorkflow(name);
                    }}
                    style={{ ...btn(T.ok), fontSize: 9 }}
                    title="Save current input as a reusable workflow"
                  >+ save current</button>
                )}
              </div>
              {matchedUserWorkflows.map((w) => (
                <div
                  key={w.id}
                  style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 10, borderRadius: 4 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = T.bgBlock)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span onClick={() => onPickPrompt(w.prompt)} style={{ color: T.text, fontSize: 12, cursor: "pointer" }}>{w.name}</span>
                  <span onClick={() => onPickPrompt(w.prompt)} style={{ color: T.textDim, fontSize: 10, flex: 1, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.prompt}</span>
                  <button onClick={(e) => { e.stopPropagation(); onEditWorkflow(w); }} style={{ ...btn(T.accent), fontSize: 9 }}>edit</button>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteWorkflow(w.id); }} style={{ ...btn(T.err), fontSize: 9 }}>delete</button>
                </div>
              ))}
            </div>
          )}
          <Section title="Recent prompts" items={matchedRecent} render={(r) => (
            <Row key={r} label={r} onClick={() => onPickPrompt(r)} />
          )} />
        </div>
      </div>
    </>
  );
}

function Section<T>({ title, items, render }: { title: string; items: T[]; render: (item: T) => React.ReactNode }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ color: T.textDim, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, padding: "6px 10px 2px" }}>{title}</div>
      {items.map(render)}
    </div>
  );
}

function Row({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ padding: "6px 10px", cursor: "pointer", borderRadius: 4, display: "flex", alignItems: "center", gap: 10 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = T.bgBlock)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ color: T.text, fontSize: 12 }}>{label}</span>
      {hint && <span style={{ color: T.textDim, fontSize: 10, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hint}</span>}
    </div>
  );
}

// ─── Sessions list ──────────────────────────────────────────────────
function SessionsList({ sessions, puterSignedIn, onLoad, onRename, onDelete, onClose }: {
  sessions: VibeSessionMeta[];
  puterSignedIn: boolean;
  onLoad: (id: string) => void;
  onRename: (id: string, title: string) => void | Promise<void>;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 10000 }} />
      <div style={{
        position: "fixed", top: "12vh", left: "50%", transform: "translateX(-50%)",
        width: 600, maxHeight: "70vh", background: T.bgPanel, border: `1px solid ${T.borderHot}`,
        borderRadius: 8, zIndex: 10001, color: T.text, fontFamily: T.mono, padding: 12,
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <span style={{ color: T.accent, fontWeight: 700 }}>Sessions</span>
          <span style={{ flex: 1 }} />
          {!puterSignedIn && (
            <button onClick={async () => { await puterSignIn(); }} style={btn(T.warn)}>
              Sign in to Puter to sync
            </button>
          )}
          <button onClick={onClose} style={btn(T.err)}>Close</button>
        </div>
        <div style={{ overflowY: "auto" }}>
          {sessions.length === 0 && <div style={{ color: T.textDim, padding: 12 }}>No sessions yet. Use /save to keep one.</div>}
          {sessions.map((s) => {
            const isRenaming = renamingId === s.id;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.storage === "puter" ? T.ok : T.textDim }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          const v = renameValue.trim();
                          if (v) await onRename(s.id, v);
                          setRenamingId(null);
                        } else if (e.key === "Escape") {
                          setRenamingId(null);
                        }
                      }}
                      style={{
                        width: "100%", background: T.bgInput, border: `1px solid ${T.borderHot}`,
                        borderRadius: 3, color: T.text, padding: "3px 6px", fontSize: 12, fontFamily: T.mono, outline: "none",
                      }}
                    />
                  ) : (
                    <div style={{ color: T.text, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                  )}
                  <div style={{ color: T.textDim, fontSize: 9 }}>{s.model} · {s.messageCount} msg · {new Date(s.updatedAt).toLocaleString()}</div>
                </div>
                {isRenaming ? (
                  <>
                    <button onClick={async () => { const v = renameValue.trim(); if (v) await onRename(s.id, v); setRenamingId(null); }} style={btn(T.ok)}>Save</button>
                    <button onClick={() => setRenamingId(null)} style={btn()}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => onLoad(s.id)} style={btn(T.accent)}>Load</button>
                    <button onClick={() => { setRenamingId(s.id); setRenameValue(s.title); }} style={btn()}>Rename</button>
                    <button onClick={() => onDelete(s.id)} style={btn(T.err)}>Delete</button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
