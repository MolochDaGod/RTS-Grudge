import { puterReady } from "@/lib/auth/puter";
import type { ChatBlock } from "./types";

// Session storage for VIBE chat. Cloud copy lives in Puter FS under
// `vibe/sessions/<id>.json` when the user is signed in; otherwise we
// fall back to localStorage so the feature still works for guests.

const FS_DIR = "vibe/sessions";
const LS_PREFIX = "vibe.session.";
const LS_INDEX = "vibe.sessions.index";

export interface VibeSessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  provider: string;
  messageCount: number;
  storage: "puter" | "local";
}

export interface VibeSession extends VibeSessionMeta {
  blocks: ChatBlock[];
}

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

export async function saveSession(session: VibeSession): Promise<VibeSession> {
  const meta: VibeSessionMeta = {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: Date.now(),
    model: session.model,
    provider: session.provider,
    messageCount: session.blocks.length,
    storage: session.storage,
  };
  const payload: VibeSession = { ...meta, blocks: session.blocks };
  const json = JSON.stringify(payload);

  const sdk = await puterReady();
  const signedIn = !!sdk?.auth.isSignedIn();
  if (sdk && signedIn && (await ensureDir())) {
    try {
      await sdk.fs.write(fsPath(session.id), json, { overwrite: true, createMissingParents: true });
      payload.storage = "puter";
      return payload;
    } catch (e: any) {
      console.warn("[vibe] Puter save failed, falling back to local:", e?.message || e);
    }
  }

  // Local fallback
  try {
    payload.storage = "local";
    localStorage.setItem(`${LS_PREFIX}${session.id}`, JSON.stringify(payload));
    const idx = readLocalIndex();
    const without = idx.filter((m) => m.id !== session.id);
    without.unshift({ ...meta, storage: "local" });
    localStorage.setItem(LS_INDEX, JSON.stringify(without));
  } catch (e: any) {
    console.warn("[vibe] localStorage save failed:", e?.message || e);
  }
  return payload;
}

function readLocalIndex(): VibeSessionMeta[] {
  try {
    const raw = localStorage.getItem(LS_INDEX);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VibeSessionMeta[]) : [];
  } catch {
    return [];
  }
}

export async function listSessions(): Promise<VibeSessionMeta[]> {
  const out = new Map<string, VibeSessionMeta>();
  for (const m of readLocalIndex()) out.set(m.id, m);

  const sdk = await puterReady();
  if (sdk?.auth.isSignedIn() && (await ensureDir())) {
    try {
      const items = await sdk.fs.readdir(FS_DIR);
      for (const item of items) {
        if (item.is_dir || !item.name.endsWith(".json")) continue;
        try {
          const blob = await sdk.fs.read(item.path);
          const text = await blob.text();
          const sess = JSON.parse(text) as VibeSession;
          out.set(sess.id, {
            id: sess.id,
            title: sess.title,
            createdAt: sess.createdAt,
            updatedAt: sess.updatedAt ?? item.modified ?? sess.createdAt,
            model: sess.model,
            provider: sess.provider,
            messageCount: sess.messageCount ?? sess.blocks?.length ?? 0,
            storage: "puter",
          });
        } catch {/* skip bad file */}
      }
    } catch (e: any) {
      console.warn("[vibe] Puter list failed:", e?.message || e);
    }
  }

  return Array.from(out.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadSession(id: string): Promise<VibeSession | null> {
  const sdk = await puterReady();
  if (sdk?.auth.isSignedIn()) {
    try {
      const blob = await sdk.fs.read(fsPath(id));
      const text = await blob.text();
      return JSON.parse(text) as VibeSession;
    } catch {/* fall through to local */}
  }
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${id}`);
    if (raw) return JSON.parse(raw) as VibeSession;
  } catch {}
  return null;
}

export async function deleteSession(id: string): Promise<void> {
  const sdk = await puterReady();
  if (sdk?.auth.isSignedIn()) {
    try { await sdk.fs.delete(fsPath(id)); } catch {}
  }
  try {
    localStorage.removeItem(`${LS_PREFIX}${id}`);
    const idx = readLocalIndex().filter((m) => m.id !== id);
    localStorage.setItem(LS_INDEX, JSON.stringify(idx));
  } catch {}
}

export async function renameSession(id: string, title: string): Promise<void> {
  const sess = await loadSession(id);
  if (!sess) return;
  sess.title = title;
  await saveSession(sess);
}
