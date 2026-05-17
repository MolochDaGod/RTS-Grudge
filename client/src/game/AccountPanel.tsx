import { useEffect, useCallback, useState } from "react";
import { LogIn, LogOut, Wallet, Loader2, ShieldCheck, AlertTriangle, ExternalLink, Flame } from "lucide-react";
import { useGrudgeSession } from "@/lib/auth/useGrudgeSession";
import { buildLoginUrl, buildAccountUrl, handleAuthCallback } from "@/lib/auth/authRedirect";
import { initSession } from "@/lib/auth/GrudgeSession";
import { useWallet } from "@/lib/wallet/useWallet";
import { usePets, FURNACE_COOK_SECONDS } from "@/lib/stores/usePets";
import { useInventory } from "@/lib/stores/useInventory";
import { useNFTs } from "@/lib/hooks/useNFTs";
import { DRAGON_STAGES } from "@/game/systems/DragonPetRegistry";

/**
 * Top-left account panel — Grudge Studio branding.
 *
 * Auth hierarchy:
 *   1. Grudge token (id.grudge-studio.com / Railway backend)
 *   2. Puter UUID   (puter.js SDK silent restore)
 *   3. Anonymous guest (plays fine, no sync)
 *
 * ⚠️ NEVER references auth-gateway-flax.vercel.app or any retired gateway.
 * All auth routes to id.grudge-studio.com (Cloudflare → Railway DB).
 */

// Handle ?grudge_token=... callback from id.grudge-studio.com on page load.
// Must run before any React renders so the token is in localStorage.
if (typeof window !== "undefined") {
  try { handleAuthCallback(); } catch {}
}

export function AccountPanel() {
  const { user, loading, signIn, signOut } = useGrudgeSession();
  const wallet = useWallet();

  // ——— All hooks MUST be called before any early return (Rules of Hooks) ———

  // Init session on mount (idempotent — GrudgeSession deduplicates)
  useEffect(() => { initSession(); }, []);

  // Auto-provision Solana wallet when signed in
  useEffect(() => {
    if (!user?.authenticated) return;
    if (wallet.status === "idle") wallet.provision(user.email ?? undefined);
  }, [user, wallet.status, wallet.provision]);

  const handleSignIn = useCallback(async () => { await signIn(); }, [signIn]);
  const handleSignOut = useCallback(async () => { await signOut(); }, [signOut]);

  // Pet + NFT hooks (always called; guards inside handle unauthenticated state)
  const activePet = usePets(s => s.getActivePet());
  const furnacePending = usePets(s => s.furnacePending);
  const furnaceHatch = usePets(s => s.furnaceHatch);
  const checkFurnaceHatch = usePets(s => s.checkFurnaceHatch);
  const inventory = useInventory(s => s.items);
  const removeFromInventory = useInventory(s => s.removeItem);
  // useNFTs handles null/undefined address gracefully (returns empty)
  const { nftCount, hasDragonEgg: walletHasEgg } = useNFTs(wallet.wallet?.address);

  const hasDragonEggInInventory = inventory.some(i => i.id === "dragon_egg" && i.quantity > 0);

  // Furnace cook countdown (1s tick, only active while cooking)
  const [cookSecsLeft, setCookSecsLeft] = useState(0);
  useEffect(() => {
    if (!furnacePending) { setCookSecsLeft(0); return; }
    const update = () => {
      const ms = new Date(furnacePending.completesAt).getTime() - Date.now();
      if (ms <= 0) { checkFurnaceHatch(); setCookSecsLeft(0); }
      else setCookSecsLeft(Math.ceil(ms / 1000));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [furnacePending, checkFurnaceHatch]);

  // ——— Early returns ——— (safe: all hooks already called above)

  if (loading) {
    return (
      <div className="fixed top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5
                      bg-zinc-900/80 border-2 border-zinc-800 rounded-md text-zinc-400 text-xs">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Grudge ID…</span>
      </div>
    );
  }

  if (!user?.authenticated) {
    return (
      <div className="fixed top-3 left-3 z-20 flex flex-col gap-1">
        <a
          href={buildLoginUrl(typeof window !== "undefined" ? window.location.href : undefined,
                              "Sign in to sync saves and access all features")}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-black border-2
                     border-amber-600 rounded-md hover:bg-amber-400 transition-colors
                     text-xs font-bold tracking-wide"
          aria-label="Sign in with Grudge ID"
        >
          <LogIn className="w-4 h-4" />
          Sign in with Grudge
        </a>
        <p className="text-[9px] text-zinc-500 max-w-[13rem] leading-tight pl-0.5">
          Optional — links saves &amp; wallet. Play as guest anytime.
        </p>
      </div>
    );
  }

  // ——— Signed in ———
  const displayId = user.displayName || user.playerId.replace(/^(grudge_|puter_)/, "").slice(0, 12);
  const providerBadge = user.provider === "grudge"
    ? { label: "Grudge ID",  color: "text-amber-300" }
    : user.provider === "puter"
    ? { label: "Puter",      color: "text-cyan-300"  }
    : { label: "Guest",      color: "text-zinc-400"  };

  const w = wallet.wallet;
  const shortAddr = w ? `${w.address.slice(0, 4)}…${w.address.slice(-4)}` : null;

  return (
    <div className="fixed top-3 left-3 z-20 flex flex-col gap-1.5 bg-zinc-900/90
                    border-2 border-zinc-700 rounded-md px-3 py-2 backdrop-blur-sm max-w-[17rem]">
      {/* — Identity row — */}
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <div className="flex flex-col leading-tight min-w-0 flex-1">
          <span className={`text-xs font-bold truncate ${providerBadge.color}`}>
            {displayId}
          </span>
          <span className="text-[9px] text-zinc-500">{providerBadge.label}</span>
        </div>
        {/* Account page link */}
        <a
          href={buildAccountUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 text-zinc-500 hover:text-amber-300 transition-colors"
          title="Grudge ID account"
          aria-label="Open Grudge ID account page"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="p-1 text-zinc-400 hover:text-red-300 focus:outline-none
                     focus:ring-2 focus:ring-red-400 rounded transition-colors"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* — Pet row — */}
      {(activePet || furnacePending || hasDragonEggInInventory || walletHasEgg) && (
        <div className="border-t border-zinc-800 pt-1.5 flex items-center gap-2">
          <span className="text-base shrink-0" aria-label="dragon">🐲</span>
          <div className="flex flex-col leading-tight flex-1 min-w-0">
            {activePet && (
              <span className="text-[10px] text-orange-300 font-semibold truncate">
                {DRAGON_STAGES[activePet.stage].icon} {activePet.name}
                <span className="text-zinc-500 font-normal"> — {DRAGON_STAGES[activePet.stage].name}</span>
              </span>
            )}
            {furnacePending && cookSecsLeft > 0 && (
              <span className="text-[9px] text-yellow-400 flex items-center gap-1">
                <Flame className="w-2.5 h-2.5" />
                Hatching in {cookSecsLeft}s…
              </span>
            )}
            {furnacePending && cookSecsLeft === 0 && (
              <span className="text-[9px] text-green-400">🥚 Ready! Visit furnace to collect.</span>
            )}
            {!furnacePending && (hasDragonEggInInventory || walletHasEgg) && (
              <span className="text-[9px] text-zinc-500">
                Dragon Egg — place in a Furnace to hatch
              </span>
            )}
          </div>
          {/* Quick-hatch button: shown at a furnace (UI calls furnaceHatch via HousingScene proximity) */}
          {!furnacePending && hasDragonEggInInventory && (
            <button
              type="button"
              onClick={() => furnaceHatch("dragon_egg", removeFromInventory)}
              className="text-[9px] px-1.5 py-0.5 bg-orange-700/80 text-orange-200 rounded
                         hover:bg-orange-600 transition-colors shrink-0"
              title="Place egg in nearest Furnace to cook"
            >
              Hatch
            </button>
          )}
        </div>
      )}

      {/* — Wallet row — */}
      <div className="border-t border-zinc-800 pt-1.5 flex items-center gap-2">
        <Wallet className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        {wallet.status === "loading" && (
          <span className="text-[10px] text-zinc-400 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Provisioning…
          </span>
        )}
        {wallet.status === "ready" && shortAddr && (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(w!.address).catch(() => {})}
            className="text-[10px] font-mono text-cyan-200 hover:text-cyan-100 truncate text-left flex-1"
            title={`${w!.chain.toUpperCase()}: ${w!.address} — click to copy`}
          >
            {w!.chain.toUpperCase()} {shortAddr}
          </button>
        )}
        {/* NFT badge — shows owned Grudge NFT count */}
        {nftCount > 0 && (
          <span
            className="text-[9px] px-1 py-0.5 bg-purple-900/60 border border-purple-600/50 rounded
                       text-purple-300 font-semibold shrink-0"
            title={`${nftCount} Grudge Studio NFT${nftCount !== 1 ? "s" : ""} in wallet`}
          >
            NFT ×{nftCount}
          </span>
        )}
        {wallet.status === "idle" && (
          <button
            type="button"
            onClick={() => wallet.provision(user.email ?? undefined)}
            className="text-[10px] text-cyan-300 hover:text-cyan-200 underline"
          >
            Create wallet
          </button>
        )}
        {wallet.status === "unavailable" && (
          <span className="text-[9px] text-zinc-500 flex items-center gap-1" title={wallet.error || ""}>
            <AlertTriangle className="w-2.5 h-2.5" /> Wallet offline
          </span>
        )}
        {wallet.status === "error" && (
          <button type="button" onClick={() => wallet.refresh()}
            className="text-[9px] text-red-300 hover:text-red-200 underline"
            title={wallet.error || ""}>
            Retry wallet
          </button>
        )}
      </div>
    </div>
  );
}
