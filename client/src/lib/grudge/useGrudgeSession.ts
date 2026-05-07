// Auth context for the Grudge Studio identity service.
//
// Lives next to `client/src/lib/stores/useGrudge.ts` (which serves the
// catalog/object-store data) but is a SEPARATE store so a cold load that
// fails for one doesn't block the other. The store is intentionally tiny:
// just `{ user, role, loading, error }` plus three actions.

import { create } from "zustand";
import { grudgeApi, startGrudgeLogin, type GrudgeUser } from "./api";

interface GrudgeSessionState {
  user: GrudgeUser | null;
  // Convenience: derived from `user.role` / `user.roles` on every refresh.
  role: string;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  /** True after the first refresh resolves (success OR 401). Lets callers
   *  distinguish "haven't checked yet" from "checked, definitely logged out". */
  initialized: boolean;

  /** Hit /api/auth/me. Safe to call repeatedly. */
  refresh: () => Promise<void>;
  /** Look for a `?session=...` query string from the SSO redirect, exchange
   *  it for our cookie, then refresh. Idempotent. */
  consumeSessionFromUrl: () => Promise<boolean>;
  /** Bounce to id.grudge-studio.com/login?return=<here>. */
  login: () => void;
  /** POST /api/auth/logout, then clear local state. Never throws. */
  logout: () => Promise<void>;
}

function deriveRole(user: GrudgeUser | null): { role: string; isAdmin: boolean } {
  if (!user) return { role: "guest", isAdmin: false };
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const role = (typeof user.role === "string" && user.role) || roles[0] || "user";
  const isAdmin = role === "admin" || roles.includes("admin");
  return { role, isAdmin };
}

export const useGrudgeSession = create<GrudgeSessionState>((set, get) => ({
  user: null,
  role: "guest",
  isAdmin: false,
  loading: false,
  error: null,
  initialized: false,

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const user = await grudgeApi.getMe();
      const { role, isAdmin } = deriveRole(user);
      set({ user, role, isAdmin, loading: false, initialized: true });
    } catch (e: any) {
      set({
        user: null,
        role: "guest",
        isAdmin: false,
        loading: false,
        initialized: true,
        error: e?.message ?? String(e),
      });
    }
  },

  consumeSessionFromUrl: async () => {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    const token = url.searchParams.get("session");
    if (!token) return false;
    try {
      await grudgeApi.exchangeToken(token);
    } catch (e) {
      console.warn("[grudge-session] exchange failed:", e);
    } finally {
      // Strip the ?session= query so refreshes don't replay it.
      url.searchParams.delete("session");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
    await get().refresh();
    return true;
  },

  login: () => {
    startGrudgeLogin();
  },

  logout: async () => {
    try {
      await grudgeApi.logout();
    } finally {
      set({ user: null, role: "guest", isAdmin: false, error: null });
    }
  },
}));
