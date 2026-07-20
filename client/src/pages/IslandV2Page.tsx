import { useState } from "react";
import { useGame } from "@/lib/stores/useGame";
import { useCampaign } from "@/lib/stores/useCampaign";
import { useIslandWorld } from "@/lib/stores/useIslandWorld";
import {
  exportRtsIslandToHome,
  WARLORDS_HOME_ISLAND_URL,
} from "@/lib/island/homeIslandApi";
import { hasValidToken, redirectToLogin } from "@/lib/auth/GrudgeSession";

const FONTS = {
  title: "'MorkDungeon', 'Cinzel', serif",
  header: "'Cinzel', serif",
  body: "'Crimson Text', serif",
};

/**
 * /island-v2 — Island survival mode launcher.
 *
 * Presents a pre-game screen for the shipwreck / tutorial island.
 * The player can jump straight in (with their last character) or go
 * to Hero Forge first to pick a new build.
 */
export default function IslandV2Page() {
  const {
    goToHome, goToCharacterSelect, enterTutorialIsland,
    selectedCharacter,
  } = useGame();
  const startCampaign = useCampaign(s => s.startCampaign);
  const homeIsland = useIslandWorld(s => s.islands.get("island_0_0"));
  const [exportStatus, setExportStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);

  const handleQuickStart = () => {
    // Enter island directly with current character (skips intro)
    enterTutorialIsland(null);
  };

  const handleCampaignStart = () => {
    // Full flow: campaign intro → character select → island
    startCampaign();
    useGame.setState({ inTutorialIsland: true });
    goToCharacterSelect();
  };

  const handleExportToWarlords = async () => {
    if (!hasValidToken()) {
      redirectToLogin(window.location.href, "Export your island to Grudge Warlords");
      return;
    }
    if (!homeIsland) return;

    setExportStatus("working");
    setExportMessage(null);
    setExportedUrl(null);

    const result = await exportRtsIslandToHome(homeIsland);
    if (result.ok) {
      setExportStatus("done");
      setExportMessage(
        result.initialized
          ? `Island exported (UUID ${result.homeIslandId?.slice(0, 8)}…). Open Warlords to play your home island.`
          : `Island saved. Finish setup on Warlords home island.`,
      );
      setExportedUrl(result.warlordsUrl);
    } else {
      setExportStatus("error");
      setExportMessage(result.error ?? "Export failed");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", width: "100vw",
      background: "linear-gradient(135deg, #05060c 0%, #0a1a14 50%, #05060c 100%)",
      fontFamily: FONTS.body, color: "#fff",
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      {/* Top nav */}
      <nav style={{
        width: "100%", padding: "12px 20px", display: "flex", gap: 8, alignItems: "center",
        borderBottom: "1px solid rgba(107,220,139,.15)",
      }}>
        <button onClick={goToHome} style={{
          padding: "5px 14px", fontSize: 10, borderRadius: 6, cursor: "pointer",
          background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)",
          color: "#9aa3c7", fontFamily: FONTS.header, letterSpacing: "1px",
        }}>← HOME</button>
        <button onClick={goToCharacterSelect} style={{
          padding: "5px 14px", fontSize: 10, borderRadius: 6, cursor: "pointer",
          background: "rgba(246,201,69,.08)", border: "1px solid rgba(246,201,69,.25)",
          color: "#f6c945", fontFamily: FONTS.header, letterSpacing: "1px",
        }}>HERO FORGE</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: "#555", fontFamily: "monospace" }}>/island-v2</span>
      </nav>

      {/* Hero block */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "32px 24px", maxWidth: 600, textAlign: "center",
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🏝️</div>
        <div style={{
          fontFamily: FONTS.title, fontWeight: 900, letterSpacing: "3px", fontSize: 32,
          background: "linear-gradient(90deg,#6bdc8b,#a8f0c0 50%,#6bdc8b)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>SHIPWRECK ISLAND</div>
        <div style={{
          fontFamily: FONTS.header, fontSize: 10, letterSpacing: "3px",
          color: "#6a9a7a", marginTop: 4, marginBottom: 20,
        }}>SURVIVAL MODE</div>

        <p style={{
          fontSize: 13, color: "#8a9a8a", lineHeight: 1.6, maxWidth: 420, marginBottom: 28,
        }}>
          Shipwrecked on a hostile island. Harvest resources, craft gear,
          fight waves of enemies, and survive. Your character's skills,
          equipment, and professions carry over from the main game.
        </p>

        {/* Current character summary */}
        <div style={{
          padding: "12px 20px", borderRadius: 10, marginBottom: 20,
          background: "rgba(107,220,139,.06)", border: "1px solid rgba(107,220,139,.2)",
          width: "100%", maxWidth: 340,
        }}>
          <div style={{ fontSize: 8, color: "#6bdc8b", textTransform: "uppercase", letterSpacing: "2px", fontFamily: FONTS.header }}>
            CURRENT CHARACTER
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>{selectedCharacter.name}</div>
          <div style={{ fontSize: 10, color: "#6a9a7a", textTransform: "capitalize" }}>
            {selectedCharacter.combatClass} — {selectedCharacter.weaponRight}
          </div>
        </div>

        {/* Export to Warlords home island */}
        <div style={{
          padding: "14px 18px", borderRadius: 10, marginBottom: 20,
          background: "rgba(246,201,69,.05)", border: "1px solid rgba(246,201,69,.2)",
          width: "100%", maxWidth: 420, textAlign: "left",
        }}>
          <div style={{ fontSize: 8, color: "#f6c945", textTransform: "uppercase", letterSpacing: "2px", fontFamily: FONTS.header }}>
            SYNC TO WARLORDS
          </div>
          <p style={{ fontSize: 11, color: "#8a8a7a", lineHeight: 1.5, margin: "8px 0 12px" }}>
            Generate your procedural home island here, then export it to{" "}
            <a href={WARLORDS_HOME_ISLAND_URL} target="_blank" rel="noreferrer" style={{ color: "#f6c945" }}>
              grudgewarlords.com/home-island
            </a>{" "}
            with your account UUID, D1 state, and map storage.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={handleExportToWarlords}
              disabled={exportStatus === "working"}
              style={{
                padding: "8px 16px", fontSize: 10, fontWeight: 700, borderRadius: 6,
                fontFamily: FONTS.header, letterSpacing: "1px", cursor: exportStatus === "working" ? "wait" : "pointer",
                background: "rgba(246,201,69,.12)", border: "1px solid rgba(246,201,69,.35)", color: "#f6c945",
                opacity: exportStatus === "working" ? 0.6 : 1,
              }}
            >
              {exportStatus === "working" ? "EXPORTING…" : "EXPORT HOME ISLAND"}
            </button>
            {exportedUrl && (
              <a
                href={exportedUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "8px 16px", fontSize: 10, fontWeight: 700, borderRadius: 6,
                  fontFamily: FONTS.header, letterSpacing: "1px", textDecoration: "none",
                  background: "rgba(107,220,139,.12)", border: "1px solid rgba(107,220,139,.35)", color: "#6bdc8b",
                }}
              >
                OPEN WARLORDS →
              </a>
            )}
          </div>
          {exportMessage && (
            <p style={{
              fontSize: 10, marginTop: 10, lineHeight: 1.4,
              color: exportStatus === "error" ? "#ff8a7a" : "#9aa3c7",
            }}>
              {exportMessage}
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={handleCampaignStart} style={{
            padding: "12px 28px", fontSize: 14, fontWeight: 700, borderRadius: 8,
            fontFamily: FONTS.header, letterSpacing: "2px", cursor: "pointer",
            background: "linear-gradient(135deg, #2a8a4a, #1a6a3a)",
            border: "1px solid #4aaa6a", color: "#fff",
            boxShadow: "0 4px 16px rgba(42,138,74,.3)",
          }}>
            NEW CAMPAIGN
          </button>
          <button onClick={handleQuickStart} style={{
            padding: "12px 28px", fontSize: 14, fontWeight: 700, borderRadius: 8,
            fontFamily: FONTS.header, letterSpacing: "2px", cursor: "pointer",
            background: "rgba(107,220,139,.1)", border: "1px solid rgba(107,220,139,.35)",
            color: "#6bdc8b",
          }}>
            QUICK START
          </button>
        </div>
      </div>
    </div>
  );
}
