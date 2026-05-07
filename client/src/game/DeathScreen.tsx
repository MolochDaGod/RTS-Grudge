import { useState, useEffect } from "react";
import { useGame } from "@/lib/stores/useGame";
import { useSurvival } from "@/lib/stores/useSurvival";
import { useInventory } from "@/lib/stores/useInventory";
import { useEnemyManager } from "./systems/EnemyManager";

const FONTS = {
  title: "'MorkDungeon', 'Cinzel', serif",
  header: "'Cinzel', serif",
  body: "'Crimson Text', serif",
  mono: "'JetBrains Mono', monospace",
};

const GOLD = "#c5a059";
const BLOOD = "#8b1a1a";

export default function DeathScreen() {
  const { score, wave, enemiesKilled, level, maxCombo, restart, goToCharacterSelect } = useGame();
  const { reset: resetSurvival } = useSurvival();
  const { reset: resetInventory } = useInventory();
  const { reset: resetEnemies } = useEnemyManager();
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFadeIn(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleRestart = () => {
    resetSurvival();
    resetInventory();
    resetEnemies();
    restart();
  };

  const handleCharSelect = () => {
    resetSurvival();
    resetInventory();
    resetEnemies();
    goToCharacterSelect();
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "radial-gradient(ellipse at center, rgba(40,5,5,0.95) 0%, rgba(0,0,0,0.95) 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: FONTS.header,
        opacity: fadeIn ? 1 : 0,
        transition: "opacity 0.8s ease-in",
      }}
    >
      <div
        style={{
          textAlign: "center",
          transform: fadeIn ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
          transition: "transform 0.6s ease-out",
          position: "relative",
          maxWidth: 420,
          padding: "40px 50px",
          background: "rgba(15,10,6,0.9)",
          border: `1.5px solid rgba(139,26,26,0.5)`,
          borderRadius: 8,
          boxShadow: "0 0 60px rgba(139,26,26,0.2), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent 10%, ${BLOOD} 50%, transparent 90%)`,
          opacity: 0.6,
        }} />

        <div style={{
          fontSize: "clamp(48px, 8vw, 72px)",
          fontFamily: FONTS.title,
          color: "#cc3333",
          textShadow: "0 0 40px rgba(204,51,51,0.5), 0 2px 8px rgba(0,0,0,0.9)",
          letterSpacing: 4,
          lineHeight: 1,
          marginBottom: 24,
        }}>
          YOU DIED
        </div>

        <div
          style={{
            margin: "0 0 24px",
            fontSize: 14,
            color: "#ccc",
            lineHeight: 2.2,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4px 24px",
            textAlign: "left",
            fontFamily: FONTS.body,
          }}
        >
          <div>Score: <strong style={{ color: GOLD, fontFamily: FONTS.mono }}>{score}</strong></div>
          <div>Level: <strong style={{ color: "#ab47bc", fontFamily: FONTS.mono }}>{level}</strong></div>
          <div>Wave: <strong style={{ color: GOLD, fontFamily: FONTS.mono }}>{wave}</strong></div>
          <div>Kills: <strong style={{ color: "#ff6644", fontFamily: FONTS.mono }}>{enemiesKilled}</strong></div>
          {maxCombo >= 3 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", marginTop: 4 }}>
              Best Combo: <strong style={{ color: "#ffaa00", fontFamily: FONTS.mono }}>{maxCombo}x</strong>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <DeathButton label="TRY AGAIN" onClick={handleRestart} primary />
          <DeathButton label="CHARACTERS" onClick={handleCharSelect} />
        </div>
      </div>
    </div>
  );
}

function DeathButton({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const accentColor = primary ? "#cc3333" : GOLD;
  const glowColor = primary ? "rgba(204,51,51,0.3)" : "rgba(197,160,89,0.2)";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        padding: "12px 28px",
        border: `1.5px solid ${hovered ? accentColor : "rgba(255,255,255,0.15)"}`,
        borderRadius: 6,
        cursor: "pointer",
        background: "rgba(20,12,8,0.9)",
        color: hovered ? accentColor : "#d4c4a8",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: FONTS.header,
        letterSpacing: 2,
        transition: "all 0.2s",
        transform: pressed ? "scale(0.97)" : hovered ? "translateY(-1px)" : "none",
        boxShadow: hovered ? `0 4px 16px ${glowColor}` : "0 2px 8px rgba(0,0,0,0.4)",
        textShadow: "0 1px 3px rgba(0,0,0,0.6)",
      }}
    >
      {label}
    </button>
  );
}
