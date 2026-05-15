import { useEffect, useState, useCallback } from "react";
import { LogIn, LogOut, Wallet, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  usePuterUser,
  puterSignIn,
  puterSignOut,
  puterReady,
} from "@/lib/auth/puter";
import { useWallet } from "@/lib/wallet/useWallet";

/**
 * Top-left start-menu panel — Grudge Studio branding.
 *
 *   - Signed out: "Sign in with Grudge" button that opens
 *     id.grudge-studio.com in a modal/popup. Anonymous play
 *     keeps working — sign-in is optional.
 *   - Signed in:  shows the Grudge ID, Solana wallet address,
 *     and a sign-out button.
 *
 * Auth backend is Puter SDK but the frontend shows Grudge branding
 * per project convention (id.grudge-studio.com styles match WCS).
 */
export function AccountPanel() {
  const { user, loading, refresh } = usePuterUser();
  const wallet = useWallet();
  const [sdkAvailable, setSdkAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    puterReady().then((sdk) => setSdkAvailable(!!sdk));
  }, []);

  // Auto-provision a Solana wallet the first time a signed-in player
  // hits the menu. Idempotent on the server.
  useEffect(() => {
    if (!user) return;
    if (wallet.status === "idle") {
      wallet.provision(user.email);
    }
  }, [user, wallet.status, wallet.provision]);

  const handleSignIn = useCallback(async () => {
    setBusy(true);
    try {
      const u = await puterSignIn();
      if (u) {
        await refresh();
        // Force a quick re-fetch of the wallet under the new player_id.
        // useWallet's playerId reads from getPlayerId() which now reflects
        // the Puter UUID — we re-mount it implicitly via the user change.
      }
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const handleSignOut = useCallback(async () => {
    setBusy(true);
    try {
      await puterSignOut();
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  if (sdkAvailable === false) return null;
  if (sdkAvailable === null || loading) {
    return (
      <div className="fixed top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border-2 border-zinc-800 rounded-md text-zinc-400 text-xs font-bold">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Account</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed top-3 left-3 z-20">
      <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-black border-2 border-amber-600 rounded-md hover:bg-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-black transition-colors disabled:opacity-50"
          aria-label="Sign in with Grudge Studio to sync saves and claim a Solana wallet"
          title="Sign in to sync saves across devices and claim a Solana wallet"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          <span className="text-xs font-bold tracking-wide">Sign In</span>
        </button>
        <p className="mt-1 text-[10px] text-zinc-400 max-w-[14rem] leading-tight">
          Optional — links your Grudge ID, cloud saves, and a Solana wallet.
        </p>
      </div>
    );
  }

  const shortUuid = user.uuid.length > 12 ? `${user.uuid.slice(0, 8)}…${user.uuid.slice(-4)}` : user.uuid;
  const w = wallet.wallet;
  const shortAddr = w ? `${w.address.slice(0, 4)}…${w.address.slice(-4)}` : null;

  return (
    <div className="fixed top-3 left-3 z-20 flex flex-col gap-1.5 bg-zinc-900/85 border-2 border-zinc-700 rounded-md px-3 py-2 backdrop-blur-sm max-w-[18rem]">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <div className="flex flex-col leading-tight min-w-0 flex-1">
          <span className="text-xs font-bold text-amber-300 truncate">{user.username}</span>
          <span className="text-[10px] font-mono text-zinc-400 truncate" title={user.uuid}>
            ID {shortUuid}
          </span>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy}
          className="p-1 text-zinc-400 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-400 rounded transition-colors disabled:opacity-50"
          aria-label="Sign out"
          title="Sign out"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="border-t border-zinc-800 pt-1.5 flex items-center gap-2">
        <Wallet className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        {wallet.status === "loading" && (
          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Provisioning wallet…
          </span>
        )}
        {wallet.status === "ready" && shortAddr && (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(w!.address).catch(() => {})}
            className="text-[11px] font-mono text-cyan-200 hover:text-cyan-100 truncate text-left flex-1"
            title={`${w!.chain.toUpperCase()}: ${w!.address} (click to copy)`}
          >
            {w!.chain.toUpperCase()} {shortAddr}
          </button>
        )}
        {wallet.status === "idle" && (
          <button
            type="button"
            onClick={() => wallet.provision(user.email)}
            className="text-[11px] text-cyan-300 hover:text-cyan-200 underline"
          >
            Create Solana wallet
          </button>
        )}
        {wallet.status === "unavailable" && (
          <span className="text-[10px] text-zinc-500 flex items-center gap-1" title={wallet.error || ""}>
            <AlertTriangle className="w-3 h-3" /> Wallet service offline
          </span>
        )}
        {wallet.status === "error" && (
          <button
            type="button"
            onClick={() => wallet.refresh()}
            className="text-[10px] text-red-300 hover:text-red-200 underline truncate"
            title={wallet.error || ""}
          >
            Wallet error — retry
          </button>
        )}
      </div>
    </div>
  );
}
