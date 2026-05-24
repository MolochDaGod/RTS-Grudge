import { useGame } from "@/lib/stores/useGame";
import { useGrudgeSync } from "@/lib/stores/useGrudgeSync";

const FONTS = {
  title: "'MorkDungeon', 'Cinzel', serif",
  header: "'Cinzel', serif",
  body: "'Crimson Text', serif",
};

/**
 * /combat — Entry page for the 2D Gruda Wars combat mode.
 *
 * Shows the active character summary and provides entry into the 2D
 * battle system. Until the full 2D engine is embedded here, this page
 * acts as the launcher that passes character context to the combat iframe.
 */
export default function Combat2DPage() {
  const { goToHome, goToCharacterSelect, selectedCharacter } = useGame();
  const { activeCharId, characters } = useGrudgeSync();
  const activeChar = characters.find(c => String(c.id) === activeCharId);

  const charName = activeChar?.name || selectedCharacter.name || "Hero";
  const charClass = selectedCharacter.combatClass;

  return (
    <div style={{
      minHeight: "100vh", width: "100vw",
      background: "linear-gradient(135deg, #05060c 0%, #0a1028 50%, #05060c 100%)",
      fontFamily: FONTS.body, color: "#fff",
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      {/* Top nav */}
      <nav style={{
        width: "100%", padding: "12px 20px", display: "flex", gap: 8, alignItems: "center",
        borderBottom: "1px solid rgba(106,169,255,.15)",
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
        <span style={{ fontSize: 9, color: "#555", fontFamily: "monospace" }}>/combat</span>
      </nav>

      {/* Header */}
      <header style={{ textAlign: "center", padding: "28px 24px 16px" }}>
        <div style={{
          fontFamily: FONTS.title, fontWeight: 900, letterSpacing: "3px", fontSize: 28,
          background: "linear-gradient(90deg,#6aa9ff,#a0c4ff 50%,#6aa9ff)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>GRUDA WARS</div>
        <div style={{
          fontFamily: FONTS.header, fontSize: 10, letterSpacing: "3px",
          color: "#6a7a9a", marginTop: 4,
        }}>2D COMBAT MODE</div>
      </header>

      {/* Character card */}
      <div style={{
        padding: "16px 24px", borderRadius: 12, maxWidth: 400, width: "100%",
        background: "linear-gradient(135deg, rgba(14,22,48,.7), rgba(8,12,28,.8))",
        border: "1px solid rgba(106,169,255,.2)", marginBottom: 20,
      }}>
        <div style={{ fontSize: 9, color: "#6aa9ff", textTransform: "uppercase", letterSpacing: "2px", fontFamily: FONTS.header }}>ACTIVE CHARACTER</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginTop: 4 }}>{charName}</div>
        <div style={{ fontSize: 11, color: "#8a8fa8", marginTop: 2, textTransform: "capitalize" }}>
          {charClass} — {selectedCharacter.weaponRight}{selectedCharacter.weaponLeft ? ` + ${selectedCharacter.weaponLeft}` : ""}
        </div>
      </div>

      {/* Combat entry — iframe for the 2D battle engine */}
      <div style={{
        width: "100%", maxWidth: 900, flex: 1, minHeight: 500,
        padding: "0 20px 24px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{
          flex: 1, borderRadius: 12, overflow: "hidden",
          border: "1px solid rgba(106,169,255,.2)",
          background: "#080c18",
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: 400,
        }}>
          {/* The 2D combat engine will be embedded here as an iframe or
              rendered directly when the grudawars module is integrated.
              For now, show a placeholder with a launch button. */}
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚔️</div>
            <div style={{
              fontFamily: FONTS.header, fontSize: 14, color: "#6aa9ff",
              letterSpacing: "2px", marginBottom: 8,
            }}>2D BATTLE ARENA</div>
            <div style={{ fontSize: 11, color: "#6a7a9a", maxWidth: 300, lineHeight: 1.5, marginBottom: 16 }}>
              Gruda Wars 2D combat with your {charName} ({charClass}).
              Fight using your character's stats, skills, and equipment from the main game.
            </div>
            <button
              onClick={() => {
                // TODO: Launch embedded grudawars or navigate to external URL with SSO
                window.open(`https://grudgewarlords.com/combat?char=${activeCharId || "guest"}`, "_blank");
              }}
              style={{
                padding: "10px 28px", fontSize: 13, fontWeight: 700, borderRadius: 8,
                fontFamily: FONTS.header, letterSpacing: "2px", cursor: "pointer",
                background: "linear-gradient(135deg, #3366cc, #2244aa)",
                border: "1px solid #4488ee", color: "#fff",
                boxShadow: "0 4px 16px rgba(51,102,204,.3)",
              }}
            >
              ENTER BATTLE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
