import type { SceneObject } from "@/game/editor/EditorStore";

export type BlockStatus = "running" | "ok" | "error";

export interface ParsedEdit {
  file: string;
  action: "replace" | "write";
  old?: string;
  new?: string;
  content?: string;
}

export interface ParsedSceneAction {
  action: "add-object" | "add-prefab" | "save-prefab";
  data: Record<string, any>;
}

export interface EditApplyResult {
  file: string;
  status: "created" | "modified" | "error";
  message?: string;
}

export interface SceneApplyResult {
  action: string;
  name: string;
  status: "success" | "error";
  message?: string;
  /** Id of the SceneObject created in the editor store (for add-object / add-prefab). */
  createdObjectId?: string;
  /** Id of the prefab registered (for save-prefab). */
  createdPrefabId?: string;
}

export interface AgentStep {
  id: string;
  kind: "edit" | "scene";
  status: "pending" | "running" | "ok" | "error";
  edit?: ParsedEdit;
  scene?: ParsedSceneAction;
  result?: EditApplyResult | SceneApplyResult;
  applied: boolean;
}

export interface ChatBlock {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;          // raw content (for assistant: stripped of action fences during render)
  rawText?: string;      // unredacted assistant text including action fences
  status: BlockStatus;
  timestamp: number;
  model?: string;
  provider?: string;
  steps?: AgentStep[];
  collapsed?: boolean;
  error?: string;
}

export interface VibeWorkflow {
  id: string;
  name: string;
  prompt: string;
}

export const DEFAULT_WORKFLOWS: VibeWorkflow[] = [
  { id: "wf-scene", name: "Add object to scene", prompt: "Add a {object} at position [{x},{y},{z}]" },
  { id: "wf-prefab", name: "Save selected as prefab", prompt: "Save the currently selected object as a reusable prefab named '{name}'" },
  { id: "wf-balance", name: "Balance enemy difficulty", prompt: "Make {enemyType} enemies {tweak} — apply the change live to the running config." },
  { id: "wf-light", name: "Light a scene", prompt: "Add a directional sun + ambient + a warm rim light to the scene." },
];

// User workflow CRUD lives in `vibeWorkflows.ts` so it can sync with Puter FS
// the same way sessions do (with a localStorage fallback for guests).

export function parseVibeEdits(content: string): ParsedEdit[] {
  const edits: ParsedEdit[] = [];
  const re = /```vibe-edit\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const block = m[1];
    const fileM = block.match(/FILE:\s*(.+)/);
    const actionM = block.match(/ACTION:\s*(\w+)/);
    if (!fileM || !actionM) continue;
    const file = fileM[1].trim();
    const action = actionM[1].trim() as "replace" | "write";
    if (action === "replace") {
      const oldM = block.match(/OLD:\s*\|([\s\S]*?)\|/);
      const newM = block.match(/NEW:\s*\|([\s\S]*?)\|/);
      if (oldM && newM) edits.push({ file, action, old: oldM[1], new: newM[1] });
    } else if (action === "write") {
      const cM = block.match(/CONTENT:\s*\|([\s\S]*?)\|/);
      if (cM) edits.push({ file, action, content: cM[1] });
    }
  }
  return edits;
}

export function parseSceneActions(content: string): ParsedSceneAction[] {
  const actions: ParsedSceneAction[] = [];
  const re = /```vibe-scene\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (parsed.action) actions.push(parsed as ParsedSceneAction);
    } catch {/* ignore malformed */}
  }
  return actions;
}

export function stripActionBlocks(content: string): string {
  return content
    .replace(/```vibe-edit\n[\s\S]*?```/g, "")
    .replace(/```vibe-scene\n[\s\S]*?```/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Cheap "diff summary" for an edit step header.
export function summarizeEdit(edit: ParsedEdit): string {
  if (edit.action === "write") {
    const lines = (edit.content ?? "").split("\n").length;
    return `write ${edit.file} (${lines} lines)`;
  }
  const oldLines = (edit.old ?? "").split("\n").length;
  const newLines = (edit.new ?? "").split("\n").length;
  return `replace ${edit.file} (-${oldLines} / +${newLines})`;
}

export function summarizeScene(action: ParsedSceneAction): string {
  const name = action.data?.name ?? "(unnamed)";
  switch (action.action) {
    case "add-object": return `add-object "${name}" (${action.data?.type ?? "primitive"})`;
    case "add-prefab": return `add-prefab "${name}"`;
    case "save-prefab": return `save-prefab "${name}"`;
    default: return `${action.action} "${name}"`;
  }
}

export function describeSceneObject(o: SceneObject): string {
  return `"${o.name}" (${o.type}) at [${o.position.map((v) => v.toFixed(1)).join(",")}]`;
}
