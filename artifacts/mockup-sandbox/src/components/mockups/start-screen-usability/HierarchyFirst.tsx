import { useState } from "react";
import './_group.css';

const FONTS = {
  title: "'MorkDungeon', 'Cinzel', serif",
  header: "'Cinzel', serif",
  body: "'Crimson Text', serif",
  mono: "'JetBrains Mono', monospace",
};

export function HierarchyFirst() {
  const handlePlay = () => {};
  const goToGGE = () => {};
  const [showControls, setShowControls] = useState(false);

  return (
    <div className="menu-bg" style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: FONTS.header, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.8) 60%, rgba(0,0,0,0.95) 100%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 0%, transparent 60%, rgba(10,5,2,0.95) 100%)", pointerEvents: "none" }} />
      
      <div style={{ position: "relative", zIndex: 10, textAlign: "center", maxWidth: 800, padding: "0 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 48 }}>
        
        {/* 1. WHAT IS THIS GAME (compressed title block) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <h1 style={{ fontSize: "clamp(48px, 8vw, 72px)", margin: 0, fontWeight: 400, fontFamily: FONTS.title, color: "#f0d68a", textShadow: "0 0 40px rgba(201,149,10,0.4), 0 4px 8px rgba(0,0,0,0.9)", letterSpacing: 4, lineHeight: 1 }}>GRUDGE</h1>
            <div style={{ fontSize: "clamp(20px, 3vw, 28px)", fontFamily: FONTS.title, color: "#c9950a", textShadow: "0 0 20px rgba(201,149,10,0.3), 0 2px 4px rgba(0,0,0,0.8)", letterSpacing: 6 }}>SURVIVAL</div>
          </div>
          <p style={{ fontSize: 12, color: "rgba(201,149,10,0.7)", margin: 0, letterSpacing: 8, textTransform: "uppercase", fontFamily: FONTS.body, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>Fight. Gather. Survive.</p>
        </div>

        {/* 2. WHAT DO I DO RIGHT NOW (Primary CTA) & 3. WHAT ELSE IS HERE (Secondary Action) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: "100%", maxWidth: 380 }}>
          <PlayButton onClick={handlePlay} />
          <EditorButton onClick={goToGGE} />
        </div>

      </div>

      {/* 4. HOW DO I PLAY (tucked away corner controls) */}
      <div 
        style={{ position: "absolute", bottom: 24, right: 24, zIndex: 20, display: "flex", flexDirection: "column", alignItems: "flex-end" }}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        <div style={{ 
          opacity: showControls ? 1 : 0.4, 
          transition: "opacity 0.2s ease",
          fontSize: 12, 
          color: "#8a7e6a", 
          fontFamily: FONTS.body,
          letterSpacing: 1,
          textTransform: "uppercase",
          cursor: "default",
          marginBottom: showControls ? 12 : 0,
          display: "flex",
          alignItems: "center",
          gap: 6
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          Controls
        </div>
        
        <div style={{
          opacity: showControls ? 1 : 0,
          transform: showControls ? "translateY(0)" : "translateY(10px)",
          pointerEvents: showControls ? "auto" : "none",
          transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          background: "rgba(10, 5, 2, 0.8)",
          border: "1px solid rgba(201,149,10,0.15)",
          borderRadius: 4,
          padding: "16px 20px",
          backdropFilter: "blur(8px)",
          fontSize: 11, 
          color: "rgba(201,149,10,0.6)", 
          lineHeight: 2.2, 
          fontFamily: FONTS.mono,
          textAlign: "right"
        }}>
          <div>WASD - Move | Shift - Sprint | Space - Jump</div>
          <div>Click - Attack | E - Block | C - Crafting</div>
          <div>1-5 - Special Moves | ESC - Pause</div>
        </div>
      </div>
    </div>
  );
}

function PlayButton({ onClick }: { onClick: () => void }) {
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
        padding: "24px 32px",
        border: `1px solid ${hovered ? "rgba(201, 149, 10, 0.8)" : "rgba(201, 149, 10, 0.3)"}`,
        borderRadius: 2,
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        background: hovered ? "rgba(20, 15, 5, 0.95)" : "rgba(10, 5, 2, 0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        transform: pressed ? "scale(0.98)" : hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered
          ? `0 12px 32px rgba(201,149,10,0.15), 0 0 0 1px rgba(201,149,10,0.4) inset`
          : `0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02) inset`,
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse at center, rgba(201,149,10,0.15) 0%, transparent 70%)`,
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.4s",
      }} />
      <span style={{
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: 6,
        color: hovered ? "#f0d68a" : "#d4c4a8",
        fontFamily: FONTS.header,
        textShadow: "0 2px 8px rgba(0,0,0,0.9)",
        position: "relative",
        zIndex: 2,
        transition: "color 0.2s",
      }}>
        ENTER CAMPAIGN
      </span>
      <span style={{
        fontSize: 12,
        color: hovered ? "#a89468" : "#736750",
        fontFamily: FONTS.body,
        letterSpacing: 1,
        position: "relative",
        zIndex: 2,
        transition: "color 0.2s",
      }}>
        Forge your hero and survive
      </span>
    </button>
  );
}

function EditorButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "transparent",
        border: "none",
        padding: "12px 24px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        opacity: hovered ? 1 : 0.5,
        transition: "all 0.2s ease",
        transform: hovered ? "translateY(-1px)" : "none",
      }}
    >
      <span style={{
        fontSize: 12,
        color: "#9b6bdf",
        fontFamily: FONTS.header,
        letterSpacing: 2,
        fontWeight: 600,
      }}>
        LEVEL EDITOR
      </span>
      <span style={{ fontSize: 14, color: "#9b6bdf", opacity: 0.7 }}>→</span>
    </button>
  );
}
