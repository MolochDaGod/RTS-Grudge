import { useCallback, useEffect, useState } from "react";
import { getPlayerId } from "@/lib/save/playerId";

export interface PlayerWallet {
  player_id: string;
  address: string;
  chain: string;
  custodial_id: string | null;
  provider: string;
  created_at: string;
  updated_at: string;
}

export type WalletStatus = "idle" | "loading" | "ready" | "error" | "unavailable";

interface UseWalletResult {
  wallet: PlayerWallet | null;
  status: WalletStatus;
  error: string | null;
  /** Idempotent — calls POST to provision if missing, then refreshes. */
  provision: (email?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Solana wallet for the current Grudge player. Auto-fetches on mount;
 * `provision()` triggers server-side Crossmint creation when the user
 * is ready to commit (e.g. just signed in with Puter).
 *
 * Status semantics:
 *   - "loading"     — initial fetch in flight
 *   - "ready"       — wallet exists for this player
 *   - "idle"        — fetch returned 404 (no wallet yet — call provision)
 *   - "unavailable" — server returned 503 (no CROSSMINT_API_KEY)
 *   - "error"       — anything else
 */
export function useWallet(playerIdOverride?: string): UseWalletResult {
  const [wallet, setWallet] = useState<PlayerWallet | null>(null);
  const [status, setStatus] = useState<WalletStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const playerId = playerIdOverride ?? getPlayerId();

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/wallets/${encodeURIComponent(playerId)}`);
      if (res.status === 404) {
        setWallet(null);
        setStatus("idle");
        return;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`GET ${res.status}: ${txt.slice(0, 120)}`);
      }
      const data = await res.json();
      if (data?.success && data.wallet) {
        setWallet(data.wallet as PlayerWallet);
        setStatus("ready");
      } else {
        throw new Error(data?.error || "Unexpected response");
      }
    } catch (e: any) {
      setError(e?.message || String(e));
      setStatus("error");
    }
  }, [playerId]);

  const provision = useCallback(
    async (email?: string) => {
      setStatus("loading");
      setError(null);
      try {
        const res = await fetch(`/api/wallets/${encodeURIComponent(playerId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(email ? { email } : {}),
        });
        if (res.status === 503) {
          setStatus("unavailable");
          setError("Wallet service not configured on server");
          return;
        }
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`POST ${res.status}: ${txt.slice(0, 120)}`);
        }
        const data = await res.json();
        if (data?.success && data.wallet) {
          setWallet(data.wallet as PlayerWallet);
          setStatus("ready");
        } else {
          throw new Error(data?.error || "Unexpected response");
        }
      } catch (e: any) {
        setError(e?.message || String(e));
        setStatus("error");
      }
    },
    [playerId],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { wallet, status, error, provision, refresh };
}
