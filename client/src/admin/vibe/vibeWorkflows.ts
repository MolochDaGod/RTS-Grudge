import { puterReady } from "@/lib/auth/puter";
import { DEFAULT_WORKFLOWS, type VibeWorkflow } from "./types";

// Workflow storage for the VIBE command palette. Cloud copy lives in Puter FS
// under `vibe/workflows/<id>.json` when the user is signed in; otherwise we
// fall back to localStorage so the feature still works for guests.
//
// Mirrors the pattern used by `vibeSessions.ts`.

const FS_DIR = "vibe/workflows";
const LS_KEY = "vibe.userWorkflows";

function fsPath(id: string): string {
  return `${FS_DIR}/${id}.json`;
}

async function ensureDir(): Promise<boolean> {
  const sdk = await puterReady();
  if (!sdk) return false;
  try {
    await sdk.fs.stat(FS_DIR);
  } catch {
    try {
      await sdk.fs.mkdir(FS_DIR, { createMissingParents: true });
    } catch {
      return false;
    }
  }
  return true;
}

function readLocal(): VibeWorkflow[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VibeWorkflow[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(list: VibeWorkflow[]): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {/* ignore */}
}

export async function listUserWorkflows(): Promise<VibeWorkflow[]> {
  const out = new Map<string, VibeWorkflow>();
  for (const w of readLocal()) out.set(w.id, w);

  const sdk = await puterReady();
  if (sdk?.auth.isSignedIn() && (await ensureDir())) {
    try {
      const items = await sdk.fs.readdir(FS_DIR);
      for (const item of items) {
        if (item.is_dir || !item.name.endsWith(".json")) continue;
        try {
          const blob = await sdk.fs.read(item.path);
          const text = await blob.text();
          const wf = JSON.parse(text) as VibeWorkflow;
          if (wf?.id && wf?.name && typeof wf.prompt === "string") {
            out.set(wf.id, { id: wf.id, name: wf.name, prompt: wf.prompt });
          }
        } catch {/* skip bad file */}
      }
    } catch (e: any) {
      console.warn("[vibe] Puter workflow list failed:", e?.message || e);
    }
  }

  return Array.from(out.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveUserWorkflow(wf: VibeWorkflow): Promise<VibeWorkflow> {
  const json = JSON.stringify(wf);
  const sdk = await puterReady();
  const signedIn = !!sdk?.auth.isSignedIn();
  if (sdk && signedIn && (await ensureDir())) {
    try {
      await sdk.fs.write(fsPath(wf.id), json, { overwrite: true, createMissingParents: true });
    } catch (e: any) {
      console.warn("[vibe] Puter workflow save failed, keeping local copy:", e?.message || e);
    }
  }
  // Always mirror locally so the value survives offline / sign-out.
  const without = readLocal().filter((w) => w.id !== wf.id);
  writeLocal([...without, wf]);
  return wf;
}

export async function addUserWorkflow(name: string, prompt: string): Promise<VibeWorkflow> {
  const wf: VibeWorkflow = { id: `uw-${Date.now().toString(36)}`, name, prompt };
  return saveUserWorkflow(wf);
}

export async function deleteUserWorkflow(id: string): Promise<void> {
  const sdk = await puterReady();
  if (sdk?.auth.isSignedIn()) {
    try { await sdk.fs.delete(fsPath(id)); } catch {/* ignore */}
  }
  writeLocal(readLocal().filter((w) => w.id !== id));
}

export async function renameUserWorkflow(id: string, name: string): Promise<void> {
  const list = await listUserWorkflows();
  const wf = list.find((w) => w.id === id);
  if (!wf) return;
  await saveUserWorkflow({ ...wf, name });
}

export { DEFAULT_WORKFLOWS };
export type { VibeWorkflow };
