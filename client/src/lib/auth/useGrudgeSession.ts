/**
 * useGrudgeSession — React hook that exposes the current GrudgeSession state.
 *
 * Usage:
 *   const { user, loading, signIn, signOut, requireAuth } = useGrudgeSession();
 */

import { useEffect, useState, useCallback } from "react";
import {
  initSession,
  getCurrentUser,
  onSessionChange,
  signOut as sessionSignOut,
  redirectToLogin,
  requireAuth as sessionRequireAuth,
  type GrudgeSessionUser,
} from "./GrudgeSession";
import { puterSignIn } from "./puter";
import { buildLoginUrl } from "./authRedirect";

export interface UseGrudgeSessionResult {
  /** Current user. null while loading or when signed out. */
  user: GrudgeSessionUser | null;
  /** True during the initial session resolve. */
  loading: boolean;
  /** Sign in via the best available provider (Puter first, then id.grudge-studio.com). */
  signIn: () => Promise<void>;
  /** Full sign-out: clears all tokens and Puter session. */
  signOut: () => Promise<void>;
  /**
   * Redirect to id.grudge-studio.com if not authenticated.
   * Returns true if a redirect was issued.
   */
  requireAuth: (reason?: string) => boolean;
  /** Direct link to the Grudge ID login page for this app. */
  loginUrl: string;
  /** Direct link to the Grudge ID account page. */
  accountUrl: string;
}

export function useGrudgeSession(): UseGrudgeSessionResult {
  const [user, setUser]       = useState<GrudgeSessionUser | null>(getCurrentUser);
  const [loading, setLoading] = useState(!getCurrentUser());

  // Init on first mount
  useEffect(() => {
    let cancelled = false;

    initSession().then((u) => {
      if (!cancelled) {
        setUser(u);
        setLoading(false);
      }
    });

    // Subscribe to future changes (cross-tab, token refresh, sign-out)
    const unsub = onSessionChange((u) => {
      if (!cancelled) {
        setUser(u);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const signIn = useCallback(async () => {
    // Try Puter first (seamless, no redirect needed)
    try {
      const sdk = await import("./puter").then(m => m.puterReady(3000));
      if (sdk) {
        const puterUser = await puterSignIn();
        if (puterUser) {
          // Re-init to pick up the new Puter session
          const u = await initSession();
          setUser(u);
          setLoading(false);
          return;
        }
      }
    } catch {}

    // Fallback: redirect to id.grudge-studio.com
    redirectToLogin(window.location.href, "Sign in to sync saves and access all features");
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    await sessionSignOut();
    setUser(null);
    setLoading(false);
  }, []);

  const requireAuth = useCallback((reason?: string): boolean => {
    return sessionRequireAuth(reason);
  }, []);

  return {
    user,
    loading,
    signIn,
    signOut,
    requireAuth,
    loginUrl:   buildLoginUrl(),
    accountUrl: "https://id.grudge-studio.com/account",
  };
}
