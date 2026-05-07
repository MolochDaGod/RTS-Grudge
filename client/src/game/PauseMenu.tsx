import { useState } from "react";
import { useGame } from "@/lib/stores/useGame";
import { useSurvival } from "@/lib/stores/useSurvival";
import { useInventory } from "@/lib/stores/useInventory";
import { useEnemyManager } from "./systems/EnemyManager";
import SettingsPanel from "./SettingsPanel";

const FONTS = {
  title: "'MorkDungeon', 'Cinzel', serif",
  header: "'Cinzel', serif",
  body: "'Crimson Text', serif",
};

const GOLD = "#c5a059";
const GOLD_DIM = "rgba(197,160,89,0.3)";

export default function PauseMenu() {
  const { resume, restart } = useGame();
  const { reset: resetSurvival } = useSurvival();
  const { reset: resetInventory } = useInventory();
  const { reset: resetEnemies } = useEnemyManager();
  const [showSettings, setShowSettings] = useState(false);

  const handleResume = () => {
    resume();
  };

  const handleRestart = () => {
    resetSurvival();
    resetInventory();
    resetEnemies();
    restart();
  };

  const handleMainMenu = () => {
    resetSurvival();
    resetInventory();
    resetEnemies();
    restart();
  };

  if (showSettings) {
    return <SettingsPanel onBack={() => setShowSettings(false)} />;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10002,
        backdropFilter: "blur(6px)",
      }}
    >
      <div style={{
        width: 280,
        background: "linear-gradient(180deg, rgba(18,12,8,0.97) 0%, rgba(10,7,4,0.98) 100%)",
        border: `1.5px solid ${GOLD_DIM}`,
        borderRadius: 8,
        padding: "36px 28px 28px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 40px rgba(201,149,10,0.05), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}>
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent 10%, ${GOLD} 50%, transparent 90%)`,
          opacity: 0.5,
        }} />

        <div style={{
          fontSize: 36,
          fontFamily: FONTS.title,
          color: GOLD,
          letterSpacing: 4,
          textShadow: `0 0 20px rgba(201,149,10,0.3), 0 2px 4px rgba(0,0,0,0.8)`,
          marginBottom: 24,
        }}>PAUSED</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
          <PauseButton label="RESUME" onClick={handleResume} primary />
          <PauseButton label="SETTINGS" onClick={() => setShowSettings(true)} />
          <PauseButton label="RESTART" onClick={handleRestart} />
          <PauseButton label="MAIN MENU" onClick={handleMainMenu} />
        </div>

        <div style={{
          marginTop: 18,
          fontSize: 10,
          color: "rgba(201,149,10,0.3)",
          textAlign: "center",
          fontFamily: FONTS.body,
          letterSpacing: 1,
        }}>
          Press ESC to resume
        </div>
      </div>
    </div>
  );
}

function PauseButton({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        width: "100%",
        padding: "12px 0",
        border: `1px solid ${hovered ? GOLD : GOLD_DIM}`,
        borderRadius: 5,
        cursor: "pointer",
        background: hovered ? "rgba(201,149,10,0.08)" : "rgba(255,255,255,0.02)",
        color: hovered ? "#f0d68a" : (primary ? "#d4c4a8" : "#9b8b6e"),
        fontSize: 13,
        fontWeight: 700,
        fontFamily: FONTS.header,
        letterSpacing: 3,
        transition: "all 0.15s",
        transform: pressed ? "scale(0.98)" : "none",
        textShadow: "0 1px 3px rgba(0,0,0,0.6)",
        boxShadow: hovered ? `0 0 12px rgba(201,149,10,0.1)` : "none",
      }}
    >
      {label}
    </button>
  );
}
