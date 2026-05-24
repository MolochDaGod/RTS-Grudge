import { useState, useCallback } from "react";
import { useGame } from "@/lib/stores/useGame";
import { useGrudgeSession } from "@/lib/auth/useGrudgeSession";
import { useWallet } from "@/lib/wallet/useWallet";
import { useNFTs } from "@/lib/hooks/useNFTs";
import { AccountPanel } from "@/game/AccountPanel";
import {
  Wallet, Copy, Check, RefreshCw, ExternalLink, ArrowLeft,
  Loader2, AlertTriangle, Shield, Gem, Unplug,
} from "lucide-react";

const FONTS = {
  title: "'MorkDungeon', 'Cinzel', serif",
  header: "'Cinzel', serif",
  body: "'Crimson Text', serif",
  mono: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
};

/**
 * /wallet — Universal Grudge server-side wallet dashboard.
 *
 * This is the canonical wallet page used across ALL Grudge Studio
 * deployments (grudgewarlords.com, dcq.grudge-studio.com, etc.).
 * It surfaces the Solana MPC wallet provisioned by the Grudge backend,
 * displays owned Grudge NFTs, and provides an external wallet connect
 * path for players who already have a Solana wallet.
 */
export default function WalletPage() {
  const { goToHome } = useGame();
  const { user, loading: authLoading, signIn } = useGrudgeSession();
  const wallet = useWallet();
  const { nfts, nftCount, loading: nftsLoading, error: nftsError, refresh: refreshNfts, bonuses: gameBonuses, hasDragonEgg } = useNFTs(wallet.wallet?.address);

  const [copied, setCopied] = useState(false);

  const copyAddress = useCallback(() => {
    if (!wallet.wallet?.address) return;
    navigator.clipboard?.writeText(wallet.wallet.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [wallet.wallet?.address]);

  const w = wallet.wallet;
  const shortAddr = w ? `${w.address.slice(0, 6)}…${w.address.slice(-6)}` : null;

  return (
    <div style={{
      minHeight: "100vh", width: "100vw",
      background: "linear-gradient(135deg, #05060c 0%, #0d1220 50%, #05060c 100%)",
      fontFamily: FONTS.body, color: "#fff",
      display: "flex", flexDirection: "column", alignItems: "center",
      overflow: "auto",
    }}>
      <AccountPanel />

      {/* Header */}
      <header style={{ textAlign: "center", padding: "32px 24px 8px", width: "100%", maxWidth: 700 }}>
        <button
          onClick={goToHome}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
            background: "none", border: "none", color: "#8a8fa8", fontSize: 11,
            fontFamily: FONTS.header, letterSpacing: "1px", marginBottom: 12,
          }}
        >
          <ArrowLeft size={14} /> BACK TO HUB
        </button>
        <div style={{
          fontFamily: FONTS.title, fontWeight: 900, letterSpacing: "4px", fontSize: 28,
          background: "linear-gradient(90deg,#4dd0e1,#b2ebf2 50%,#4dd0e1)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          filter: "drop-shadow(0 0 24px rgba(77,208,225,.2))",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <Wallet size={26} />
          GRUDGE WALLET
        </div>
        <div style={{
          fontFamily: FONTS.header, fontSize: 10, letterSpacing: "4px",
          color: "#6a6e82", fontWeight: 600, marginTop: 4,
        }}>
          SERVER-SIDE • SOLANA • ALL GRUDGE GAMES
        </div>
      </header>

      <main style={{ width: "100%", maxWidth: 700, padding: "20px 20px 40px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Auth gate ── */}
        {authLoading && (
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8fa8" }}>
              <Loader2 size={16} className="animate-spin" /> Checking Grudge ID…
            </div>
          </Card>
        )}

        {!authLoading && !user?.authenticated && (
          <Card>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "16px 0" }}>
              <Shield size={32} color="#f6c945" />
              <span style={{ fontFamily: FONTS.header, fontSize: 14, color: "#f6c945", letterSpacing: "1px" }}>
                SIGN IN TO ACCESS YOUR WALLET
              </span>
              <span style={{ fontSize: 12, color: "#6a6e82", textAlign: "center", maxWidth: 360, lineHeight: 1.5 }}>
                Your Grudge Wallet is tied to your Grudge ID and syncs across
                grudgewarlords.com, DCQ, and all Grudge Studio games.
              </span>
              <button
                onClick={() => signIn()}
                style={{
                  padding: "8px 24px", borderRadius: 8, cursor: "pointer",
                  background: "linear-gradient(135deg, #f6c945, #d4a520)",
                  border: "none", color: "#000", fontFamily: FONTS.header,
                  fontWeight: 700, fontSize: 12, letterSpacing: "1px",
                }}
              >
                SIGN IN WITH GRUDGE
              </button>
            </div>
          </Card>
        )}

        {/* ── Wallet section (authed) ── */}
        {!authLoading && user?.authenticated && (
          <>
            {/* Wallet card */}
            <Card>
              <SectionLabel icon={<Wallet size={14} color="#4dd0e1" />} label="SOLANA WALLET" />

              {wallet.status === "loading" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8fa8", padding: "12px 0" }}>
                  <Loader2 size={16} className="animate-spin" /> Provisioning wallet…
                </div>
              )}

              {wallet.status === "ready" && w && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0" }}>
                  {/* Address */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "rgba(77,208,225,.06)", border: "1px solid rgba(77,208,225,.15)",
                    borderRadius: 8, padding: "10px 14px",
                  }}>
                    <span style={{
                      fontFamily: FONTS.mono, fontSize: 13, color: "#b2ebf2",
                      flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{w.address}</span>
                    <button
                      onClick={copyAddress}
                      title="Copy address"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: copied ? "#66bb6a" : "#4dd0e1", padding: 4,
                      }}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>

                  {/* Meta row */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <MetaBadge label="Chain" value={w.chain.toUpperCase()} color="#4dd0e1" />
                    <MetaBadge label="Provider" value={w.provider} color="#ce93d8" />
                    <MetaBadge label="Linked To" value={user.displayName || user.playerId.slice(0, 12)} color="#f6c945" />
                  </div>

                  {/* Solscan link */}
                  <a
                    href={`https://solscan.io/account/${w.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontSize: 11, color: "#4dd0e1", textDecoration: "none",
                    }}
                  >
                    <ExternalLink size={12} /> View on Solscan
                  </a>
                </div>
              )}

              {wallet.status === "idle" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "16px 0" }}>
                  <span style={{ fontSize: 12, color: "#6a6e82" }}>No wallet yet — provision one now.</span>
                  <button
                    onClick={() => wallet.provision(user.email ?? undefined)}
                    style={{
                      padding: "8px 20px", borderRadius: 8, cursor: "pointer",
                      background: "linear-gradient(135deg, #4dd0e1, #26a1b0)",
                      border: "none", color: "#000", fontFamily: FONTS.header,
                      fontWeight: 700, fontSize: 12, letterSpacing: "1px",
                    }}
                  >
                    CREATE WALLET
                  </button>
                </div>
              )}

              {wallet.status === "unavailable" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#ff8a65", padding: "12px 0" }}>
                  <AlertTriangle size={16} />
                  <span style={{ fontSize: 12 }}>Wallet service offline — server needs CROSSMINT_API_KEY configured.</span>
                </div>
              )}

              {wallet.status === "error" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#ef5350", padding: "12px 0" }}>
                  <AlertTriangle size={16} />
                  <span style={{ fontSize: 12, flex: 1 }}>{wallet.error}</span>
                  <button
                    onClick={() => wallet.refresh()}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#ef5350", padding: 4 }}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              )}
            </Card>

            {/* External wallet connect */}
            <Card>
              <SectionLabel icon={<Unplug size={14} color="#ce93d8" />} label="EXTERNAL WALLET" />
              <div style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#6a6e82", lineHeight: 1.5 }}>
                  Connect a third-party Solana wallet (Phantom, Backpack, Solflare)
                  to link on-chain assets to your Grudge account.
                </span>
                <button
                  disabled
                  style={{
                    padding: "8px 20px", borderRadius: 8, cursor: "not-allowed",
                    background: "rgba(206,147,216,.12)", border: "1px solid rgba(206,147,216,.2)",
                    color: "#ce93d8", fontFamily: FONTS.header, fontWeight: 700,
                    fontSize: 11, letterSpacing: "1px", opacity: 0.6,
                  }}
                >
                  CONNECT WALLET — COMING SOON
                </button>
              </div>
            </Card>

            {/* NFTs */}
            {wallet.status === "ready" && w && (
              <Card>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <SectionLabel icon={<Gem size={14} color="#f6c945" />} label={`GRUDGE NFTs${nftCount > 0 ? ` (${nftCount})` : ""}`} />
                  <button
                    onClick={refreshNfts}
                    title="Refresh NFTs"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#6a6e82", padding: 4 }}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>

                {nftsLoading && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a8fa8", padding: "12px 0" }}>
                    <Loader2 size={14} className="animate-spin" /> Scanning wallets…
                  </div>
                )}

                {!nftsLoading && nftCount === 0 && (
                  <div style={{ padding: "16px 0", textAlign: "center", color: "#6a6e82", fontSize: 12 }}>
                    No Grudge Studio NFTs found in this wallet.
                  </div>
                )}

                {!nftsLoading && nfts.length > 0 && (
                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: 10, padding: "8px 0",
                  }}>
                    {nfts.map((nft) => (
                      <div key={nft.mintAddress} style={{
                        borderRadius: 8, overflow: "hidden",
                        background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)",
                      }}>
                        {nft.image && (
                          <img
                            src={nft.image}
                            alt={nft.name}
                            style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
                            loading="lazy"
                          />
                        )}
                        <div style={{ padding: "8px 10px" }}>
                          <div style={{
                            fontFamily: FONTS.header, fontSize: 10, fontWeight: 700,
                            color: "#f6c945", letterSpacing: "0.5px", overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>{nft.name}</div>
                          <div style={{ fontSize: 9, color: "#6a6e82", marginTop: 2 }}>
                            {nft.collection || nft.chain}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Game bonuses from NFTs */}
                {gameBonuses.length > 0 && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", marginTop: 8, paddingTop: 8 }}>
                    <div style={{
                      fontFamily: FONTS.header, fontSize: 9, letterSpacing: "2px",
                      color: "#6a6e82", marginBottom: 6,
                    }}>ACTIVE BONUSES</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {gameBonuses.map((b, i) => (
                        <span key={i} style={{
                          fontSize: 10, padding: "3px 8px", borderRadius: 6,
                          background: "rgba(246,201,69,.08)", border: "1px solid rgba(246,201,69,.2)",
                          color: "#f6c945",
                        }}>
                          {b.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {nftsError && (
                  <div style={{ fontSize: 10, color: "#ef5350", marginTop: 4 }}>{nftsError}</div>
                )}
              </Card>
            )}

            {/* Cross-game info */}
            <Card>
              <SectionLabel icon={<Shield size={14} color="#66bb6a" />} label="UNIVERSAL WALLET" />
              <div style={{ padding: "8px 0", fontSize: 12, color: "#6a6e82", lineHeight: 1.6 }}>
                This wallet is managed server-side by Grudge Studio. It is
                automatically linked to your Grudge ID and shared across all
                connected games:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingBottom: 4 }}>
                {[
                  { name: "Grudge Warlords", url: "grudgewarlords.com" },
                  { name: "DCQ", url: "dcq.grudge-studio.com" },
                  { name: "Grudge Crafting", url: "grudge-crafting.puter.site" },
                ].map((g) => (
                  <span key={g.url} style={{
                    fontSize: 10, padding: "4px 10px", borderRadius: 6,
                    background: "rgba(102,187,106,.06)", border: "1px solid rgba(102,187,106,.15)",
                    color: "#66bb6a",
                  }}>
                    {g.name}
                  </span>
                ))}
              </div>
            </Card>
          </>
        )}
      </main>

      <footer style={{ padding: "12px 20px 24px", fontSize: 9, color: "#333", textAlign: "center" }}>
        Grudge Studio — Created by Racalvin The Pirate King
      </footer>
    </div>
  );
}

/* ─── Shared sub-components ────────────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(14,22,48,.7), rgba(8,12,28,.8))",
      border: "1px solid rgba(255,255,255,.08)", borderRadius: 12,
      padding: "16px 18px",
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 700,
      letterSpacing: "2px", color: "#c8cce0", marginBottom: 4,
    }}>
      {icon}
      {label}
    </div>
  );
}

function MetaBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 2,
      padding: "6px 12px", borderRadius: 6,
      background: `${color}08`, border: `1px solid ${color}22`,
    }}>
      <span style={{ fontSize: 8, color: "#6a6e82", letterSpacing: "1px", fontFamily: "'Cinzel', serif" }}>{label}</span>
      <span style={{ fontSize: 11, color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
