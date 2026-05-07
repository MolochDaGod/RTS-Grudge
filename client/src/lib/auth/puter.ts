import { useEffect, useState } from "react";

// Minimal type surface for the parts of the Puter.js SDK we actually use.
// Loaded via the <script> tag in `client/index.html`. We intentionally
// don't pull in @types/puter — the official package is browser-only and
// the surface we need is small + stable.
export interface PuterUser {
  uuid: string;
  username: string;
  email_confirmed?: boolean;
  email?: string;
}

interface PuterAuth {
  signIn: () => Promise<PuterUser>;
  signOut: () => Promise<void>;
  getUser: () => Promise<PuterUser>;
  isSignedIn: () => boolean;
}

interface PuterKV {
  set: (key: string, value: any) => Promise<boolean>;
  get: (key: string) => Promise<any>;
  del: (key: string) => Promise<boolean>;
  list: (pattern?: string, returnValues?: boolean) => Promise<string[] | { key: string; value: any }[]>;
  flush: () => Promise<boolean>;
}

// Minimal subset of `puter.ai.chat`. The real SDK accepts a string OR
// a messages array and many options. We only model the bits VIBE uses.
export interface PuterAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface PuterAIChatOptions {
  model?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}
export interface PuterAIChunk {
  text?: string;
}
export interface PuterAINonStreamResponse {
  message?: { content?: string };
  toString?: () => string;
}
interface PuterAI {
  chat: (
    messages: PuterAIMessage[] | string,
    options?: PuterAIChatOptions,
  ) => Promise<PuterAINonStreamResponse | AsyncIterable<PuterAIChunk>>;
}

// Minimal `puter.fs` surface for VIBE chat sessions. The real SDK has
// many more methods; we only need read/write/list/delete on JSON files.
export interface PuterFSItem {
  name: string;
  path: string;
  is_dir?: boolean;
  modified?: number;
  size?: number;
}
interface PuterFS {
  write: (
    path: string,
    data: string | Blob,
    options?: { overwrite?: boolean; createMissingParents?: boolean },
  ) => Promise<any>;
  read: (path: string) => Promise<Blob>;
  readdir: (path: string) => Promise<PuterFSItem[]>;
  delete: (path: string) => Promise<any>;
  mkdir: (path: string, options?: { createMissingParents?: boolean }) => Promise<any>;
  stat: (path: string) => Promise<PuterFSItem>;
}

interface PuterSDK {
  auth: PuterAuth;
  kv: PuterKV;
  ai: PuterAI;
  fs: PuterFS;
}

declare global {
  interface Window {
    puter?: PuterSDK;
  }
}

// Resolve once the Puter SDK script tag has finished loading and exposed
// `window.puter`. The script is deferred so it may not be ready by the time
// React mounts. We poll briefly (≤3s) and then give up — the rest of the
// app must keep working as a guest if Puter never loads (offline, ad-block,
// CSP, etc.).
let readyPromise: Promise<PuterSDK | null> | null = null;
export function puterReady(timeoutMs = 3000): Promise<PuterSDK | null> {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise<PuterSDK | null>((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    if (window.puter) return resolve(window.puter);
    const start = Date.now();
    const id = setInterval(() => {
      if (window.puter) {
        clearInterval(id);
        resolve(window.puter);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(id);
        console.warn("[puter] SDK never loaded — staying in guest mode");
        resolve(null);
      }
    }, 60);
  });
  return readyPromise;
}

export async function puterSignIn(): Promise<PuterUser | null> {
  const sdk = await puterReady();
  if (!sdk) return null;
  try {
    const user = await sdk.auth.signIn();
    console.log("[puter] Signed in as", user.username);
    return user;
  } catch (e: any) {
    console.warn("[puter] Sign-in failed/cancelled:", e?.message || e);
    return null;
  }
}

export async function puterSignOut(): Promise<void> {
  const sdk = await puterReady();
  if (!sdk) return;
  try {
    await sdk.auth.signOut();
    console.log("[puter] Signed out");
  } catch (e: any) {
    console.warn("[puter] Sign-out failed:", e?.message || e);
  }
}

export async function getPuterUser(): Promise<PuterUser | null> {
  const sdk = await puterReady();
  if (!sdk) return null;
  if (!sdk.auth.isSignedIn()) return null;
  try {
    return await sdk.auth.getUser();
  } catch {
    return null;
  }
}

// Synchronous best-effort accessor: returns the cached uuid stored in
// localStorage by the Puter SDK ("puter.uuid") or null. Useful in places
// like getPlayerId() that need a value without going async.
export function getPuterUuidSync(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const sdk = window.puter;
    if (!sdk || !sdk.auth.isSignedIn()) return null;
    // Puter SDK caches user in localStorage under "puter.user" — try that
    // before falling back to the dedicated uuid key it also writes.
    const raw =
      window.localStorage.getItem("puter.user") ||
      window.localStorage.getItem("puter_user");
    if (raw) {
      try {
        const u = JSON.parse(raw);
        if (u?.uuid && typeof u.uuid === "string") return u.uuid;
      } catch {/* fall through */}
    }
    return window.localStorage.getItem("puter.uuid");
  } catch {
    return null;
  }
}

// React hook: subscribes to the current Puter user. Re-resolves on
// `storage` events so a sign-in done in another tab updates this one.
export function usePuterUser(): {
  user: PuterUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [user, setUser] = useState<PuterUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const u = await getPuterUser();
    setUser(u);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("puter")) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loading, refresh };
}
