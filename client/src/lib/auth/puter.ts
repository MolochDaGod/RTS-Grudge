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

interface PuterSDK {
  auth: PuterAuth;
  kv: PuterKV;
}

declare global {
  interface Window {
    puter?: PuterSDK;
  }
}

// Resolve once the Puter SDK script tag has finished loading and exposed
// `window.puter`. The script is deferred so it may not be ready by the time
// React mounts.
//
// Improved over the original:
//   - Checks localStorage before polling (instant resolve when the SDK has
//     already cached a session from a prior page-load, preventing the hang).
//   - Default timeout raised to 8s (covers slow mobile connections).
//   - One-shot promise is NOT cached when `timeoutMs` differs, so callers
//     can do quick "is it ready yet" probes without poisoning the main wait.
//   - Emits a console.info instead of console.warn on clean timeout so
//     offline / ad-blocked players don't see a scary warning.

let readyPromise: Promise<PuterSDK | null> | null = null;

/** Check whether Puter has previously cached a session in localStorage. */
function hasPuterLocalSession(): boolean {
  try {
    const raw = localStorage.getItem("puter.user") || localStorage.getItem("puter_user");
    if (!raw) return false;
    const u = JSON.parse(raw);
    return !!(u?.uuid);
  } catch { return false; }
}

export function puterReady(timeoutMs = 8000): Promise<PuterSDK | null> {
  // If caller wants a short probe (< 2s) don't cache — avoids poisoning the
  // main 8s wait with an early "null" result.
  const useCache = timeoutMs >= 2000;
  if (useCache && readyPromise) return readyPromise;

  const p = new Promise<PuterSDK | null>((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    // Already loaded
    if (window.puter) return resolve(window.puter);
    // Has a prior session → the SDK is highly likely to load — wait longer
    const effectiveTimeout = hasPuterLocalSession()
      ? Math.max(timeoutMs, 10_000)
      : timeoutMs;
    const start = Date.now();
    const id = setInterval(() => {
      if (window.puter) {
        clearInterval(id);
        resolve(window.puter);
      } else if (Date.now() - start > effectiveTimeout) {
        clearInterval(id);
        console.info("[puter] SDK not available — continuing as guest");
        resolve(null);
      }
    }, 60);
  });

  if (useCache) readyPromise = p;
  return p;
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

/**
 * Silently attempt to restore a Puter session from localStorage without
 * triggering a visible sign-in popup. Returns the user if already signed in.
 * This is a no-op (returns null) if the SDK isn't loaded or no session exists.
 */
export async function restorePuterSession(): Promise<PuterUser | null> {
  if (!hasPuterLocalSession()) return null;
  // Don't re-resolve the cached promise to avoid recursive calls
  const sdk = await puterReady(5000);
  if (!sdk) return null;
  if (!sdk.auth.isSignedIn()) return null;
  try { return await sdk.auth.getUser(); }
  catch { return null; }
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
