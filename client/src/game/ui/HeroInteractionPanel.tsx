/**
 * HeroInteractionPanel — DOM overlay opened when the player presses [T]
 * near a faction hero stationed at their hub.
 *
 * Three tabs:
 *   Talk      Scrolling typewriter dialogue from dialogueData.ts
 *   Missions  Accept / track / claim missions from MissionRegistry
 *   Shop      Buy items (vendor heroes only) using gold_coin currency
 *
 * Keybindings:
 *   T / Enter  Advance dialogue line or open panel
 *   Escape     Close panel
 */

import { useEffect, useRef, useState } from "react";
import { useFactionHeroes } from "@/lib/stores/useFactionHeroes";
import { useMissions } from "@/lib/stores/useMissions";
import { useInventory } from "@/lib/stores/useInventory";
import { getHero, FACTION_COLOR, FACTION_ICON } from "@/game/world/HeroRegistry";
import { getMissionsForHero, getMission } from "@/game/world/MissionRegistry";
import { getShopForHero } from "@/game/world/VendorRegistry";
import { getDialogueScript } from "@/lib/dialog/dialogueData";

// ─────────────────────────────────────────────────────────────────────────────
const VARIANT_LABEL = ["Kill", "Recover", "Resources"];
const VARIANT_ICON  = ["⚔️", "📦", "🔨"];

function formatMs(ms: number): string {
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─────────────────────────────────────────────────────────────────────────────

const TYPEWRITER_CPS = 40;

type Tab = "talk" | "missions" | "shop";

// ─────────────────────────────────────────────────────────────────────────────

function ObjectiveProgress({ missionId }: { missionId: string }) {
  const mission = getMission(missionId)!;
  const prog  = useMissions((s) => s.getMissionProgress(missionId));
  const obj   = mission.objective;
  const cur   = prog?.progress ?? 0;
  const req   = obj.required;
  const pct   = Math.min(1, cur / req);

  let label = "";
  if (obj.type === "kill")
    label = obj.enemyTypes.length > 0
      ? `Kill ${obj.enemyTypes.slice(0, 2).join(" / ")}  ${cur}/${req}`
      : `Kill any enemies  ${cur}/${req}`;
  else if (obj.type === "gather")
    label = `Gather ${obj.resourceTypes.join(", ")}  ${cur}/${req}`;
  else
    label = `Explore ${obj.targetZone || "any zone"}  ${cur}/${req}`;

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 9, color: "#888", marginBottom: 2 }}>{label}</div>
      <div style={{ background: "#1a1a1a", borderRadius: 2, height: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: pct >= 1 ? "#2ecc71" : "#4499ff" }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function HeroInteractionPanel() {
  const { nearHeroId, interactionOpen, interactionTab, openInteraction,
          closeInteraction, setInteractionTab } = useFactionHeroes();

  const [dialogText, setDialogText]   = useState("");
  const [dialogIdx, setDialogIdx]     = useState(0);
  const [revealedChars, setRevealedChars] = useState(0);
  const rafRef = useRef<number>(0);
  const lastTs = useRef<number>(0);
  const [purchaseMsg, setPurchaseMsg] = useState<string | null>(null);

  // ── Dialogue lines for current hero ──────────────────────────────────
  const heroDef  = nearHeroId ? getHero(nearHeroId) : null;
  const script   = heroDef ? getDialogueScript(heroDef.dialogueId) : null;
  const lines    = script?.lines ?? [];
  const factionColor = heroDef ? FACTION_COLOR[heroDef.faction] : "#c9a044";

  // ── Typewriter animation ──────────────────────────────────────────────
  useEffect(() => {
    if (!interactionOpen || interactionTab !== "talk") return;
    const fullText = lines[dialogIdx]?.text ?? "";
    if (revealedChars >= fullText.length) return;

    const tick = (ts: number) => {
      if (!lastTs.current) lastTs.current = ts;
      const elapsed = (ts - lastTs.current) / 1000;
      lastTs.current = ts;
      setRevealedChars((c) => Math.min(fullText.length, c + TYPEWRITER_CPS * elapsed));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); lastTs.current = 0; };
  }, [interactionOpen, interactionTab, dialogIdx, lines]);

  useEffect(() => {
    if (!interactionOpen) return;
    setDialogIdx(0);
    setRevealedChars(0);
  }, [nearHeroId, interactionOpen]);

  // ── Keyboard handlers ──────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;

      // Open panel on T near hero
      if (e.code === "KeyT" && !interactionOpen && nearHeroId) {
        e.preventDefault();
        openInteraction(nearHeroId);
        return;
      }

      if (!interactionOpen) return;

      if (e.code === "Escape") { e.preventDefault(); closeInteraction(); return; }

      if ((e.code === "KeyT" || e.code === "Enter") && interactionTab === "talk") {
        e.preventDefault();
        const fullText = lines[dialogIdx]?.text ?? "";
        if (revealedChars < fullText.length) {
          setRevealedChars(fullText.length);
        } else if (dialogIdx + 1 < lines.length) {
          setDialogIdx((i) => i + 1);
          setRevealedChars(0);
        } else {
          // End of dialogue — stay open on missions tab if available
          if (heroDef?.isMissionGiver) setInteractionTab("missions");
        }
      }
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  }, [interactionOpen, nearHeroId, interactionTab, dialogIdx, revealedChars, lines, heroDef,
      openInteraction, closeInteraction, setInteractionTab]);

  if (!interactionOpen || !heroDef) return null;

  // ── Rotation state ────────────────────────────────────────────────────────────────
  const missionsStore = useMissions.getState();
  const variantIndex  = missionsStore.getVariantIndex(heroDef.id);
  const activeVariant = missionsStore.getActiveVariantForHero(heroDef.id);
  const timeUntilRotation = missionsStore.getTimeUntilRotation(heroDef.id);
  const activeMissionId   = activeVariant?.id ?? null;
  const isMissionAccepted = activeMissionId ? missionsStore.isActive(activeMissionId) : false;
  const isMissionComplete = activeMissionId ? missionsStore.isComplete(activeMissionId) : false;
  const missionProgress   = activeMissionId ? missionsStore.getMissionProgress(activeMissionId) : null;

  const shop = heroDef.isVendor ? getShopForHero(heroDef.id) : null;
  const gold = useInventory.getState().items.find(i => i.id === "gold_coin")?.quantity ?? 0;

  const handleBuy = (listingId: string) => {
    if (!shop) return;
    const listing = shop.items.find(l => l.listingId === listingId);
    if (!listing) return;
    const inv = useInventory.getState();
    const haveGold = inv.items.find(i => i.id === "gold_coin")?.quantity ?? 0;
    if (haveGold < listing.price) {
      setPurchaseMsg(`Not enough gold. Need ${listing.price} 🪙`);
      setTimeout(() => setPurchaseMsg(null), 2500);
      return;
    }
    inv.removeItem("gold_coin", listing.price);
    inv.addItem(listing.item);
    setPurchaseMsg(`Bought ${listing.item.name}!`);
    setTimeout(() => setPurchaseMsg(null), 1800);
  };

  const currentLine = lines[dialogIdx]?.text ?? "";
  const displayText = currentLine.slice(0, Math.floor(revealedChars));
  const isComplete  = revealedChars >= currentLine.length;

  return (
    <div
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        zIndex: 8000,
        background: "rgba(6,6,10,0.97)",
        borderTop: `2px solid ${factionColor}88`,
        maxHeight: "55vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Cinzel', Georgia, serif",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px 6px",
        borderBottom: `1px solid ${factionColor}33`,
      }}>
        <span style={{ fontSize: 20 }}>{FACTION_ICON[heroDef.faction]}</span>
        <div>
          <div style={{ color: factionColor, fontSize: 14, fontWeight: 700 }}>{heroDef.name}</div>
          <div style={{ fontSize: 10, color: "#888" }}>{heroDef.title} · {heroDef.faction.charAt(0).toUpperCase() + heroDef.faction.slice(1)}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {/* Tabs */}
          {(["talk", ...(heroDef.isMissionGiver ? ["missions"] : []), ...(heroDef.isVendor ? ["shop"] : [])] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setInteractionTab(tab)}
              style={{
                background: interactionTab === tab ? factionColor + "33" : "rgba(255,255,255,0.04)",
                border: `1px solid ${interactionTab === tab ? factionColor : "#333"}`,
                color: interactionTab === tab ? factionColor : "#888",
                borderRadius: 4, padding: "3px 10px", fontSize: 10,
                cursor: "pointer", fontFamily: "monospace",
                textTransform: "capitalize",
              }}
            >
              {tab === "talk" ? "Talk" : tab === "missions" ? "Missions" : "Shop"}
            </button>
          ))}
          <button
            onClick={closeInteraction}
            style={{
              background: "transparent", border: "1px solid #333",
              color: "#666", borderRadius: 4, padding: "3px 8px",
              fontSize: 10, cursor: "pointer",
            }}
          >
            Esc
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>

        {/* ── TALK ─────────────────────────────────────────────────────── */}
        {interactionTab === "talk" && (
          <div>
            <div style={{
              color: "#f0e8d0", fontSize: 13, lineHeight: 1.7, minHeight: 60,
              fontFamily: "Georgia, serif",
            }}>
              "{displayText}{!isComplete && <span style={{ opacity: 0.5 }}>|</span>}"
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: "#555" }}>
              {isComplete
                ? (dialogIdx + 1 < lines.length ? "[T] Continue" : "[T] Done")
                : "[T] Skip"}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: "#444", fontStyle: "italic", fontFamily: "Georgia, serif" }}>
              "{heroDef.quote}"
            </div>
          </div>
        )}

        {/* ── MISSIONS — rotating pool display ─────────────────────────────────────────── */}
        {interactionTab === "missions" && (
          <div>
            {/* Rotation strip */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
              padding: "6px 10px", background: "rgba(255,255,255,0.04)",
              borderRadius: 5, border: `1px solid ${factionColor}22`,
            }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    flex: 1, textAlign: "center", borderRadius: 3, padding: "4px 2px",
                    background: i === variantIndex ? factionColor + "33" : "transparent",
                    border: `1px solid ${i === variantIndex ? factionColor : "#333"}`,
                    fontSize: 9, color: i === variantIndex ? factionColor : "#555",
                  }}
                >
                  <div style={{ fontSize: 13 }}>{VARIANT_ICON[i]}</div>
                  <div>{VARIANT_LABEL[i]}</div>
                </div>
              ))}
              <div style={{ fontSize: 9, color: "#444", marginLeft: 4, minWidth: 48, textAlign: "center" }}>
                Rotates in
                <br />
                <span style={{ color: timeUntilRotation < 600000 ? "#ff9900" : "#666" }}>
                  {formatMs(timeUntilRotation)}
                </span>
              </div>
            </div>

            {/* Active mission card */}
            {!activeVariant ? (
              <div style={{ color: "#555", fontSize: 11 }}>No mission available.</div>
            ) : (
              <div style={{
                border: `1px solid ${isMissionComplete ? "#2ecc71" : factionColor + "44"}`,
                borderRadius: 6, padding: "10px 12px",
                background: "#0a0a0f",
              }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div>
                    <div style={{ color: isMissionComplete ? "#2ecc71" : factionColor, fontSize: 12, fontWeight: 700 }}>
                      {activeVariant.title}
                    </div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                      {activeVariant.description}
                    </div>
                  </div>
                  <div style={{ marginLeft: 8, flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: "#888" }}>Lvl {activeVariant.recommendedLevel}+</div>
                    <div style={{ fontSize: 9, color: "#c9a044" }}>
                      {activeVariant.rewards.xp} XP · {activeVariant.rewards.gold}🪙
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {isMissionAccepted && activeMissionId && (
                  <>
                    <ObjectiveProgress missionId={activeMissionId} />
                    <div style={{ marginTop: 4, fontSize: 9, color: "#555" }}>
                      {missionProgress?.progress ?? 0} / {activeVariant.objective.required}
                    </div>
                  </>
                )}

                {/* Actions */}
                <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                  {!isMissionAccepted && (
                    <button
                      onClick={() => useMissions.getState().acceptHeroMission(heroDef.id)}
                      style={{
                        background: factionColor + "22", border: `1px solid ${factionColor}66`,
                        color: factionColor, borderRadius: 3, padding: "3px 12px",
                        fontSize: 10, cursor: "pointer", fontFamily: "monospace",
                      }}
                    >
                      Accept — places map marker
                    </button>
                  )}
                  {isMissionAccepted && !isMissionComplete && (
                    <button
                      onClick={() => useMissions.getState().abandonHeroMission(heroDef.id)}
                      style={{
                        background: "rgba(200,50,50,0.1)", border: "1px solid rgba(200,50,50,0.4)",
                        color: "#cc5555", borderRadius: 3, padding: "3px 10px",
                        fontSize: 10, cursor: "pointer", fontFamily: "monospace",
                      }}
                    >
                      Abandon
                    </button>
                  )}
                  {isMissionComplete && (
                    <button
                      onClick={() => useMissions.getState().claimHeroReward(heroDef.id)}
                      style={{
                        background: "rgba(46,204,113,0.2)", border: "1px solid rgba(46,204,113,0.5)",
                        color: "#2ecc71", borderRadius: 3, padding: "3px 12px",
                        fontSize: 10, cursor: "pointer", fontFamily: "monospace", fontWeight: 700,
                      }}
                    >
                      ✓ Claim — next mission unlocks
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SHOP ─────────────────────────────────────────────────────── */}
        {interactionTab === "shop" && shop && (
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 8, fontStyle: "italic" }}>
              {shop.description}
            </div>
            <div style={{ fontSize: 11, color: "#c9a044", marginBottom: 10 }}>
              Your gold: {gold} 🪙
            </div>
            {purchaseMsg && (
              <div style={{
                background: "rgba(46,204,113,0.15)", border: "1px solid rgba(46,204,113,0.4)",
                borderRadius: 4, padding: "4px 10px", marginBottom: 8, fontSize: 11, color: "#2ecc71",
              }}>
                {purchaseMsg}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
              {shop.items.map((listing) => {
                const canAfford = gold >= listing.price;
                return (
                  <div
                    key={listing.listingId}
                    style={{
                      border: `1px solid ${canAfford ? factionColor + "44" : "#333"}`,
                      borderRadius: 5, padding: "8px 10px",
                      background: "#0a0a0f",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>{listing.item.icon}</span>
                      <div>
                        <div style={{ color: "#ddd", fontSize: 11, fontWeight: 700 }}>{listing.item.name}</div>
                        {listing.item.description && (
                          <div style={{ fontSize: 9, color: "#666" }}>{listing.item.description}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: canAfford ? "#c9a044" : "#555", fontSize: 11, fontWeight: 700 }}>
                        {listing.price} 🪙
                      </span>
                      {listing.dailyLimit > 0 && (
                        <span style={{ fontSize: 9, color: "#555" }}>Limit {listing.dailyLimit}/day</span>
                      )}
                      <button
                        onClick={() => handleBuy(listing.listingId)}
                        disabled={!canAfford}
                        style={{
                          background: canAfford ? factionColor + "22" : "rgba(50,50,50,0.3)",
                          border: `1px solid ${canAfford ? factionColor + "66" : "#333"}`,
                          color: canAfford ? factionColor : "#555",
                          borderRadius: 3, padding: "3px 10px",
                          fontSize: 10, cursor: canAfford ? "pointer" : "default",
                          fontFamily: "monospace",
                        }}
                      >
                        Buy
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div style={{ padding: "4px 16px 8px", fontSize: 9, color: "#333" }}>
        Esc to close · T to advance dialogue
      </div>
    </div>
  );
}
