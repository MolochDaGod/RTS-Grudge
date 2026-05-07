import { useState, useCallback } from "react";
import { useGameConfig } from "@/lib/stores/useGameConfig";
import { useGame } from "@/lib/stores/useGame";
import TerrainPanel from "./panels/TerrainPanel";
import EnemyPanel from "./panels/EnemyPanel";
import CombatPanel from "./panels/CombatPanel";
import PhysicsPanel from "./panels/PhysicsPanel";
import WorldPanel from "./panels/WorldPanel";
import WavePanel from "./panels/WavePanel";
import NPCPanel from "./panels/NPCPanel";
import StatsPanel from "./panels/StatsPanel";
import BehaviorPanel from "./panels/BehaviorPanel";
import AnimationPanel from "./panels/AnimationPanel";
import UIPanel from "./panels/UIPanel";
import ModelBrowser from "./panels/ModelBrowser";
import GrudgeScenesPanel from "./panels/GrudgeScenesPanel";
import VibeConsole from "./vibe/VibeConsole";

type PageId =
  | "terrain"
  | "enemies"
  | "combat"
  | "physics"
  | "world"
  | "waves"
  | "npcs"
  | "stats"
  | "behavior"
  | "animation"
  | "ui"
  | "models"
  | "scenes"
  | "ai";

interface PageDef {
  id: PageId;
  label: string;
  description: string;
  group: string;
  icon: string;
}

const PAGES: PageDef[] = [
  { id: "terrain", label: "Terrain", description: "Island generation, noise, biomes", group: "World", icon: "🏔" },
  { id: "world", label: "Environment", description: "Lighting, fog, day/night, objects", group: "World", icon: "🌅" },
  { id: "physics", label: "Physics", description: "Gravity, movement, slopes, collision", group: "World", icon: "⚡" },
  { id: "enemies", label: "Enemies", description: "Enemy types, stats, models", group: "Combat", icon: "💀" },
  { id: "waves", label: "Waves", description: "Spawn scaling, boss waves", group: "Combat", icon: "🌊" },
  { id: "combat", label: "Combat", description: "Damage, crits, combos, defense", group: "Combat", icon: "⚔" },
  { id: "behavior", label: "Behaviors", description: "AI behavior trees, aggro, patrol", group: "Combat", icon: "🧠" },
  { id: "npcs", label: "NPCs", description: "Friendly NPCs, vendors, dialogue", group: "Entities", icon: "👤" },
  { id: "stats", label: "Stats", description: "Health, stamina, leveling, XP", group: "Entities", icon: "📊" },
  { id: "animation", label: "Animation", description: "Blend timing, packs, root motion", group: "Entities", icon: "🎬" },
  { id: "ui", label: "UI / HUD", description: "HUD, minimap, damage numbers", group: "Interface", icon: "🖥" },
  { id: "models", label: "Asset Browser", description: "Characters, weapons, animations", group: "Interface", icon: "📦" },
  { id: "scenes", label: "Grudge Scenes", description: "ThreeJS-Games assets, scenes, textures", group: "Interface", icon: "🎭" },
  { id: "ai", label: "VIBE AI", description: "AI assistant for game creation", group: "Interface", icon: "🤖" },
];

const GROUPS = ["World", "Combat", "Entities", "Interface"];

const GROUP_COLORS: Record<string, string> = {
  World: "#7ed88a",
  Combat: "#e8534a",
  Entities: "#c9950a",
  Interface: "#f0d68a",
};

const GROUP_ICONS: Record<string, string> = {
  World: "🌍",
  Combat: "⚔",
  Entities: "👥",
  Interface: "🖥",
};

const T = {
  bg: "#0a0705",
  bgCard: "#0f0a06",
  bgHeader: "#0d0906",
  bgSection: "#130e08",
  border: "rgba(201,149,10,0.15)",
  borderActive: "rgba(201,149,10,0.4)",
  gold: "#c9950a",
  goldLight: "#f0d68a",
  goldDim: "#9b7520",
  text: "#c9a86c",
  textBright: "#f0e6d0",
  textMuted: "#7a6a50",
  red: "#b54a3a",
};

interface AdminPanelProps {
  onClose: () => void;
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const [activePage, setActivePage] = useState<PageId>("terrain");
  const [chatOpen, setChatOpen] = useState(false);
  const isDirty = useGameConfig((s) => s.isDirty);
  const exportConfig = useGameConfig((s) => s.exportConfig);
  const importConfig = useGameConfig((s) => s.importConfig);
  const resetToDefaults = useGameConfig((s) => s.resetToDefaults);
  const undo = useGameConfig((s) => s.undo);
  const redo = useGameConfig((s) => s.redo);
  const historyIndex = useGameConfig((s) => s.historyIndex);
  const historyLength = useGameConfig((s) => s.history.length);
  const goToCharacterSelect = useGame((s) => s.goToCharacterSelect);

  const currentPage = PAGES.find((p) => p.id === activePage)!;
  const currentGroup = currentPage.group;

  const handleExport = useCallback(() => {
    const json = exportConfig();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `game-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportConfig]);

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const success = importConfig(text);
        if (!success) alert("Invalid config file format.");
      };
      reader.readAsText(file);
    };
    input.click();
  }, [importConfig]);

  const renderPanel = () => {
    switch (activePage) {
      case "terrain": return <TerrainPanel />;
      case "enemies": return <EnemyPanel />;
      case "combat": return <CombatPanel />;
      case "physics": return <PhysicsPanel />;
      case "world": return <WorldPanel />;
      case "waves": return <WavePanel />;
      case "npcs": return <NPCPanel />;
      case "stats": return <StatsPanel />;
      case "behavior": return <BehaviorPanel />;
      case "animation": return <AnimationPanel />;
      case "ui": return <UIPanel />;
      case "models": return <ModelBrowser />;
      case "scenes": return <GrudgeScenesPanel />;
      case "ai": return <div style={{ height: "100%" }}><VibeConsole variant="panel" /></div>;
      default: return null;
    }
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLength - 1;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: T.bg,
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Cinzel', 'Inter', serif",
      zIndex: 9999,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        background: T.bgHeader,
        borderBottom: `1px solid ${T.border}`,
        height: 48,
        flexShrink: 0,
        gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 6,
            background: `linear-gradient(135deg, ${T.gold}, ${T.goldDim})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 900, color: T.bg,
            boxShadow: `0 0 12px ${T.gold}33`,
          }}>G</div>
          <span style={{
            color: T.goldLight, fontWeight: 700, fontSize: 14,
            letterSpacing: 3, textTransform: "uppercase",
            fontFamily: "'Cinzel', serif",
          }}>Game Dev Engine</span>
        </div>

        <div style={{ width: 1, height: 28, background: T.border }} />

        <button onClick={onClose} style={navLinkStyle(false)}>Main Menu</button>
        <button onClick={goToCharacterSelect} style={navLinkStyle(false)}>Hero Forge</button>
        <button onClick={() => useGame.getState().goToGGE()} style={navLinkStyle(false)}>GGE Editor</button>

        <div style={{ flex: 1 }} />

        {isDirty && (
          <span style={{
            padding: "3px 10px", borderRadius: 10, fontSize: 10, fontWeight: 700,
            background: `${T.gold}15`, color: T.gold, border: `1px solid ${T.gold}33`,
            letterSpacing: 1, textTransform: "uppercase",
          }}>Modified</span>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <TopBtn onClick={undo} disabled={!canUndo} label="Undo" />
          <TopBtn onClick={redo} disabled={!canRedo} label="Redo" />
        </div>

        <div style={{ width: 1, height: 28, background: T.border }} />

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <TopBtn onClick={handleImport} label="Import" />
          <TopBtn onClick={handleExport} label="Export" />
          <TopBtn onClick={resetToDefaults} label="Reset" warn />
        </div>

        <div style={{ width: 1, height: 28, background: T.border }} />

        <button
          onClick={() => setChatOpen(!chatOpen)}
          style={{
            padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
            fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
            fontFamily: "'Cinzel', serif",
            background: chatOpen ? `linear-gradient(135deg, ${T.gold}, ${T.goldDim})` : T.bgSection,
            color: chatOpen ? T.bg : T.gold,
            boxShadow: chatOpen ? `0 0 15px ${T.gold}44` : "none",
            transition: "all 0.25s ease",
          }}
        >
          VIBE AI
        </button>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        background: T.bg,
        borderBottom: `1px solid ${T.border}`,
        height: 42,
        flexShrink: 0,
        gap: 0,
      }}>
        {GROUPS.map((group) => {
          const active = currentGroup === group;
          const color = GROUP_COLORS[group];
          return (
            <button
              key={group}
              onClick={() => {
                const first = PAGES.find((p) => p.group === group);
                if (first) setActivePage(first.id);
              }}
              style={{
                padding: "0 20px",
                height: "100%",
                background: "none",
                border: "none",
                borderBottom: active ? `2px solid ${color}` : "2px solid transparent",
                color: active ? color : T.textMuted,
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.2s ease",
                letterSpacing: 2,
                textTransform: "uppercase",
                fontFamily: "'Cinzel', serif",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = T.text; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = T.textMuted; }}
            >
              <span style={{ fontSize: 14 }}>{GROUP_ICONS[group]}</span>
              {group}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          {PAGES.filter((p) => p.group === currentGroup).map((page) => {
            const active = activePage === page.id;
            const color = GROUP_COLORS[currentGroup];
            return (
              <button
                key={page.id}
                onClick={() => setActivePage(page.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: active ? `1px solid ${color}44` : `1px solid transparent`,
                  background: active ? `${color}15` : "transparent",
                  color: active ? color : T.textMuted,
                  fontSize: 11,
                  fontWeight: active ? 700 : 400,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  letterSpacing: 1,
                  fontFamily: "'Cinzel', serif",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = T.bgSection;
                    e.currentTarget.style.color = T.text;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = T.textMuted;
                  }
                }}
              >
                <span style={{ fontSize: 12 }}>{page.icon}</span>
                {page.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        background: T.bgCard,
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ color: T.textMuted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'Cinzel', serif" }}>Engine</span>
            <span style={{ color: T.textMuted, fontSize: 10 }}>/</span>
            <span style={{ color: GROUP_COLORS[currentGroup], fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'Cinzel', serif" }}>{currentGroup}</span>
            <span style={{ color: T.textMuted, fontSize: 10 }}>/</span>
            <span style={{ color: T.textBright, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'Cinzel', serif" }}>{currentPage.label}</span>
          </div>
          <h2 style={{
            color: T.goldLight, fontSize: 18, margin: 0, fontWeight: 700,
            fontFamily: "'Cinzel', serif", letterSpacing: 2,
          }}>
            <span style={{ marginRight: 8 }}>{currentPage.icon}</span>
            {currentPage.label}
          </h2>
          <p style={{
            color: T.textMuted, fontSize: 11, margin: "3px 0 0", lineHeight: 1,
            fontFamily: "'Crimson Text', serif", fontStyle: "italic",
          }}>
            {currentPage.description}
          </p>
        </div>

        <QuickJump pages={PAGES} activePage={activePage} onSelect={setActivePage} />
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{
          flex: 1, overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: `${T.gold}33 ${T.bg}`,
        }}>
          {renderPanel()}
        </div>

        {chatOpen && (
          <div style={{
            width: 400,
            borderLeft: `1px solid ${T.border}`,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            background: T.bg,
          }}>
            <VibeConsole variant="panel" />
          </div>
        )}
      </div>
    </div>
  );
}

function navLinkStyle(active: boolean): React.CSSProperties {
  return {
    background: "none",
    border: "none",
    color: active ? T.goldLight : T.textMuted,
    fontSize: 11,
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
    padding: "5px 10px",
    borderRadius: 6,
    transition: "all 0.2s ease",
    letterSpacing: 1,
    fontFamily: "'Cinzel', serif",
  };
}

function TopBtn({ onClick, disabled, label, warn }: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  warn?: boolean;
}) {
  const color = warn ? T.red : T.text;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "5px 12px",
        borderRadius: 6,
        border: `1px solid ${T.border}`,
        background: T.bgSection,
        color: disabled ? T.textMuted : color,
        fontSize: 11,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.2s ease",
        letterSpacing: 0.5,
        fontFamily: "'Cinzel', serif",
      }}
    >
      {label}
    </button>
  );
}

function QuickJump({ pages, activePage, onSelect }: {
  pages: PageDef[];
  activePage: PageId;
  onSelect: (id: PageId) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search
    ? pages.filter((p) =>
        p.label.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.group.toLowerCase().includes(search.toLowerCase())
      )
    : pages;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => { setOpen(!open); setSearch(""); }}
        style={{
          padding: "7px 16px",
          borderRadius: 6,
          border: `1px solid ${T.border}`,
          background: T.bgSection,
          color: T.textMuted,
          fontSize: 11,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "'Cinzel', serif",
          letterSpacing: 1,
          transition: "all 0.2s ease",
        }}
      >
        Jump to page...
        <span style={{
          color: T.textMuted, fontSize: 9,
          border: `1px solid ${T.border}`, borderRadius: 3,
          padding: "1px 5px", fontFamily: "'JetBrains Mono', monospace",
        }}>/</span>
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 50 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 6,
            width: 300,
            background: T.bgCard,
            border: `1px solid ${T.borderActive}`,
            borderRadius: 8,
            boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${T.gold}11`,
            zIndex: 51,
            overflow: "hidden",
          }}>
            <div style={{ padding: 10 }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pages..."
                autoFocus
                style={{
                  width: "100%",
                  background: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  color: T.textBright,
                  padding: "8px 12px",
                  fontSize: 12,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "'Crimson Text', serif",
                }}
              />
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {filtered.map((page) => {
                const active = activePage === page.id;
                const groupColor = GROUP_COLORS[page.group];
                return (
                  <div
                    key={page.id}
                    onClick={() => { onSelect(page.id); setOpen(false); }}
                    style={{
                      padding: "10px 14px",
                      cursor: "pointer",
                      background: active ? `${groupColor}10` : "transparent",
                      borderLeft: active ? `2px solid ${groupColor}` : `2px solid transparent`,
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = T.bgSection; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? `${groupColor}10` : "transparent"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12 }}>{page.icon}</span>
                      <span style={{ color: groupColor, fontSize: 10, fontWeight: 700, letterSpacing: 1, fontFamily: "'Cinzel', serif" }}>{page.group}</span>
                      <span style={{ color: T.textMuted, fontSize: 10 }}>/</span>
                      <span style={{
                        color: active ? T.textBright : T.text,
                        fontSize: 12, fontWeight: active ? 700 : 400,
                        fontFamily: "'Cinzel', serif",
                      }}>{page.label}</span>
                    </div>
                    <div style={{
                      color: T.textMuted, fontSize: 10, marginTop: 2,
                      fontFamily: "'Crimson Text', serif", fontStyle: "italic",
                    }}>{page.description}</div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div style={{
                  padding: "14px 18px", color: T.textMuted, fontSize: 12,
                  textAlign: "center", fontFamily: "'Crimson Text', serif", fontStyle: "italic",
                }}>
                  No pages found
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
