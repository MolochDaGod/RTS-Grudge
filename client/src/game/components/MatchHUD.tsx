/**
 * MatchHUD — Diablo III / WoW-style bottom game HUD
 *
 * Layout (bottom of screen, centred):
 *
 *   [Top loading bar]   ← fixed at top centre during load phase
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  [HP Orb]  [Consumable slots × 14]  [Energy Orb]               │  ← orbs + top row
 *   │            [Main hotbar   × 14]                                 │  ← action slots
 *   │            [════ XP bar ═══════]                                 │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │  💀 kills  🏰 towers  🪙 gold  │  00:00  │  gold  towers  kills │  ← scoreboard
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │  [Char card]  [Char card]  [Char card]  [+]                      │  ← roster
 *   └──────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect } from "react";
import { useSurvival } from "@/lib/stores/useSurvival";
import { useGame } from "@/lib/stores/useGame";
import { useInventory } from "@/lib/stores/useInventory";
import { useMatchState } from "@/lib/stores/useMatchState";
import { SkullIcon, GoldIcon, TrophyIcon } from "./GameIcons";

// ── Shared design tokens ────────────────────────────────────────────────────
const C = {
  gold:        "#c5a059",
  goldDim:     "rgba(197,160,89,0.28)",
  goldBright:  "#e8c87a",
  panel:       "rgba(12, 8, 5, 0.96)",
  panelMid:    "rgba(22, 15, 8, 0.93)",
  text:        "#e0d8c8",
  muted:       "#7a6a5a",
  highlight:   "#ffd166",
  red:         "#c0392b",
  redGrad:     "linear-gradient(135deg, rgba(110,22,22,0.88), rgba(42,8,8,0.94))",
  blue:        "#2980b9",
  blueGrad:    "linear-gradient(225deg, rgba(22,48,110,0.88), rgba(8,18,44,0.94))",
  green:       "#27ae60",
  orange:      "#e67e22",
};

const F = {
  header: "'Cinzel', serif",
  mono:   "'JetBrains Mono', monospace",
  body:   "'Crimson Text', serif",
};

// ── Top Loading Bar ─────────────────────────────────────────────────────────
function TopLoadingBar({ progress }: { progress: number }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        width: 640,
        zIndex: 9992,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Left bracket cap */}
      <div
        style={{
          flexShrink: 0,
          width: 24,
          height: 28,
          background:
            "linear-gradient(135deg, #6a3a12 0%, #c5a059 50%, #7a4a18 100%)",
          clipPath: "polygon(0 20%, 35% 0, 100% 0, 100% 100%, 35% 100%, 0 80%)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.7)",
        }}
      />

      {/* Bar body */}
      <div
        style={{
          flex: 1,
          height: 28,
          background: "rgba(25, 12, 5, 0.96)",
          border: `2px solid ${C.gold}`,
          borderLeft: "none",
          borderRight: "none",
          position: "relative",
          overflow: "hidden",
          boxShadow:
            "0 0 24px rgba(160,40,10,0.35), inset 0 0 28px rgba(0,0,0,0.55)",
        }}
      >
        {/* Fill */}
        <div
          style={{
            position: "absolute",
            top: 2,
            left: 2,
            bottom: 2,
            width: `${progress * 100}%`,
            background:
              "linear-gradient(90deg, #5c1212 0%, #8e2020 45%, #c0392b 72%, #8e2020 100%)",
            transition: "width 0.5s ease",
            boxShadow: "inset 0 2px 6px rgba(255,80,40,0.3)",
          }}
        />
        {/* Rivet lines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(90deg, transparent 0px, transparent 10px, rgba(0,0,0,0.07) 10px, rgba(0,0,0,0.07) 11px)",
            pointerEvents: "none",
          }}
        />
        {/* Label */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: F.header,
            fontSize: 11,
            color: progress >= 1 ? C.highlight : C.text,
            letterSpacing: 4,
            textShadow: "0 1px 5px rgba(0,0,0,0.95)",
          }}
        >
          {progress >= 1 ? "READY" : "LOADING..."}
        </div>
      </div>

      {/* Right bracket cap */}
      <div
        style={{
          flexShrink: 0,
          width: 24,
          height: 28,
          background:
            "linear-gradient(135deg, #6a3a12 0%, #c5a059 50%, #7a4a18 100%)",
          clipPath:
            "polygon(0 0, 65% 0, 100% 20%, 100% 80%, 65% 100%, 0 100%)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.7)",
        }}
      />
    </div>
  );
}

// ── Liquid Orb ──────────────────────────────────────────────────────────────
interface OrbProps {
  value: number;
  max: number;
  label: string;
  fillColor: string;
  glowColor: string;
  bgGradient: string;
  title?: string;
}

function LiquidOrb({
  value,
  max,
  label,
  fillColor,
  glowColor,
  bgGradient,
  title,
}: OrbProps) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

  return (
    <div
      style={{ position: "relative", width: 88, height: 88 }}
      title={title}
    >
      {/* Outer glow ring */}
      <div
        style={{
          position: "absolute",
          inset: -3,
          borderRadius: "50%",
          boxShadow: `0 0 16px ${glowColor}`,
          pointerEvents: "none",
        }}
      />
      {/* Globe shell */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: `3px solid ${C.gold}`,
          overflow: "hidden",
          background: bgGradient,
          boxShadow: `inset 0 0 18px rgba(0,0,0,0.7)`,
        }}
      >
        {/* Liquid fill — animates height */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: `${pct * 100}%`,
            background: fillColor,
            transition: "height 0.45s ease",
          }}
        />
        {/* Highlight shine */}
        <div
          style={{
            position: "absolute",
            top: "12%",
            left: "18%",
            width: "28%",
            height: "32%",
            background: "rgba(255,255,255,0.13)",
            borderRadius: "50%",
            transform: "rotate(-30deg)",
            pointerEvents: "none",
          }}
        />
        {/* Rim shadow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 50% 50%, transparent 50%, rgba(0,0,0,0.45) 100%)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Value text */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontFamily: F.header,
            fontSize: 13,
            fontWeight: "bold",
            color: "#fff",
            textShadow: "0 2px 6px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.8)",
            lineHeight: 1,
          }}
        >
          {Math.round(value)}
        </span>
        <span
          style={{
            fontSize: 8,
            color: "#ccc",
            letterSpacing: 1.5,
            marginTop: 2,
            textShadow: "0 1px 4px rgba(0,0,0,1)",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// ── Hotbar Slot ─────────────────────────────────────────────────────────────
const MAIN_HOTKEYS = ["1","2","3","4","5","6","7","8","9","0","-","=","R","T"];

interface SlotItem { icon: string; name: string; qty: number }

function HotbarSlot({
  item,
  hotkey,
  size = 40,
  selected,
  onClick,
}: {
  item: SlotItem | null;
  hotkey?: string;
  size?: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        cursor: item ? "pointer" : "default",
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          border: `1px solid ${
            selected ? C.goldBright : item ? C.gold : "#3a2e22"
          }`,
          background: item
            ? "radial-gradient(circle at 30% 25%, rgba(48,36,20,0.97), rgba(14,9,4,0.99))"
            : "radial-gradient(circle at 30% 25%, rgba(22,14,7,0.95), rgba(8,5,2,0.98))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          opacity: item ? 1 : 0.42,
          transition: "all 0.13s",
          transform: hovered && item ? "translateY(-2px)" : "none",
          boxShadow: selected
            ? `inset 0 0 8px rgba(197,160,89,0.35), 0 0 6px rgba(197,160,89,0.45)`
            : item
            ? "inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.55)"
            : "none",
        }}
      >
        {item && (
          <>
            <span
              style={{
                fontSize: size <= 32 ? 16 : 22,
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.9))",
              }}
            >
              {item.icon}
            </span>
            {item.qty > 1 && (
              <span
                style={{
                  position: "absolute",
                  bottom: 1,
                  right: 2,
                  fontSize: 8,
                  fontWeight: "bold",
                  color: "#fff",
                  textShadow: "0 1px 2px #000",
                  fontFamily: F.mono,
                }}
              >
                {item.qty > 99 ? "99+" : item.qty}
              </span>
            )}
          </>
        )}
        {/* Inner bevel gloss */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "40%",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
            pointerEvents: "none",
          }}
        />
      </div>

      {hotkey && (
        <div
          style={{
            marginTop: 1,
            fontSize: 7,
            fontFamily: F.mono,
            color: selected ? C.gold : "#5a4a35",
            background: "rgba(0,0,0,0.45)",
            padding: "0 3px",
            borderRadius: 2,
            lineHeight: "13px",
            minWidth: 12,
            textAlign: "center",
          }}
        >
          {hotkey}
        </div>
      )}

      {/* Tooltip */}
      {hovered && item && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: 8,
            whiteSpace: "nowrap",
            padding: "5px 10px",
            background: "rgba(8,5,2,0.97)",
            border: `1px solid ${C.gold}`,
            borderRadius: 6,
            fontSize: 10,
            color: C.text,
            fontFamily: F.header,
            pointerEvents: "none",
            zIndex: 30,
            boxShadow: "0 4px 14px rgba(0,0,0,0.9)",
          }}
        >
          <span style={{ color: C.highlight }}>{item.name}</span>
          {item.qty > 1 && (
            <span style={{ color: C.muted, marginLeft: 6 }}>×{item.qty}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Action Bar (orbs + dual-row slots + XP bar) ─────────────────────────────
function ActionBar() {
  const { health, maxHealth, stamina, maxStamina } = useSurvival();
  const xp = useGame((s) => s.xp);
  const xpToNext = useGame((s) => s.xpToNext);
  const items = useInventory((s) => s.items);
  const selectedSlot = useInventory((s) => s.selectedSlot);
  const selectSlot = useInventory((s) => s.selectSlot);

  const xpPct = xpToNext > 0 ? Math.min(1, xp / xpToNext) : 0;

  // Top row: items[14..27] (secondary consumables row)
  const topSlots: (SlotItem | null)[] = Array.from({ length: 14 }, (_, i) => {
    const it = items[i + 14];
    return it ? { icon: it.icon, name: it.name, qty: it.quantity } : null;
  });

  // Bottom row: items[0..13] (main hotbar)
  const mainSlots: (SlotItem | null)[] = Array.from({ length: 14 }, (_, i) => {
    const it = items[i];
    return it ? { icon: it.icon, name: it.name, qty: it.quantity } : null;
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 0,
      }}
    >
      {/* ── HP Orb (left) ── */}
      <LiquidOrb
        value={health}
        max={maxHealth}
        label="HP"
        fillColor="linear-gradient(to top, #6b1414, #a33030aa)"
        glowColor="rgba(180,30,30,0.35)"
        bgGradient="radial-gradient(circle at 40% 35%, #1c1a08 0%, #080404 100%)"
        title={`Health: ${Math.round(health)} / ${maxHealth}`}
      />

      {/* ── Slot panel ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background:
            "linear-gradient(180deg, rgba(22,14,7,0.98) 0%, rgba(12,7,3,0.99) 100%)",
          border: `2px solid ${C.gold}`,
          borderLeft: "none",
          borderRight: "none",
          borderBottom: "none",
          padding: "6px 8px 5px",
          position: "relative",
          boxShadow:
            "inset 0 4px 20px rgba(0,0,0,0.6), inset 0 -1px 4px rgba(197,160,89,0.05)",
        }}
      >
        {/* Top border glow line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "5%",
            right: "5%",
            height: 1,
            background: `linear-gradient(90deg, transparent, ${C.gold}88, transparent)`,
          }}
        />

        {/* Consumable row */}
        <div style={{ display: "flex", gap: 3, marginBottom: 3 }}>
          {topSlots.map((item, i) => (
            <HotbarSlot key={`top-${i}`} item={item} size={30} />
          ))}
        </div>

        {/* Main hotbar row */}
        <div style={{ display: "flex", gap: 3 }}>
          {mainSlots.map((item, i) => (
            <HotbarSlot
              key={`main-${i}`}
              item={item}
              hotkey={MAIN_HOTKEYS[i]}
              size={40}
              selected={selectedSlot === i}
              onClick={() => selectSlot(i)}
            />
          ))}
        </div>

        {/* XP bar */}
        <div
          style={{
            width: "100%",
            height: 5,
            marginTop: 4,
            background: "rgba(0,0,0,0.45)",
            borderRadius: 3,
            overflow: "hidden",
            border: "1px solid rgba(50,200,90,0.15)",
          }}
        >
          <div
            style={{
              width: `${xpPct * 100}%`,
              height: "100%",
              background:
                "linear-gradient(90deg, #1a5e30, #27ae60 60%, #5dde8a)",
              boxShadow: "0 0 6px rgba(60,210,110,0.45)",
              transition: "width 0.55s ease",
            }}
          />
        </div>
      </div>

      {/* ── Energy Orb (right) ── */}
      <LiquidOrb
        value={stamina}
        max={maxStamina}
        label="EN"
        fillColor="linear-gradient(to top, #7a3c0a, #c07830aa)"
        glowColor="rgba(200,110,20,0.4)"
        bgGradient="radial-gradient(circle at 40% 35%, #1e1206 0%, #070403 100%)"
        title={`Energy: ${Math.round(stamina)} / ${maxStamina}`}
      />
    </div>
  );
}

// ── Match Scoreboard ─────────────────────────────────────────────────────────
function MatchScoreboard() {
  const red = useMatchState((s) => s.red);
  const blue = useMatchState((s) => s.blue);
  const timer = useMatchState((s) => s.timer);
  const phase = useMatchState((s) => s.phase);
  const startMatch = useMatchState((s) => s.startMatch);
  const tickTimer = useMatchState((s) => s.tickTimer);

  // Tick the timer once per second when active
  useEffect(() => {
    if (phase !== "active") return;
    const id = setInterval(tickTimer, 1000);
    return () => clearInterval(id);
  }, [phase, tickTimer]);

  const mm = String(Math.floor(timer / 60)).padStart(2, "0");
  const ss = String(timer % 60).padStart(2, "0");

  const teamSection = (
    stats: typeof red,
    side: "red" | "blue"
  ) => {
    const isRed = side === "red";
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "7px 16px",
          background: isRed ? C.redGrad : C.blueGrad,
          flex: 1,
          borderTop: `2px solid ${isRed ? C.red : C.blue}`,
        }}
      >
        {isRed ? (
          <>
            <StatChip emoji="💀" value={stats.kills} color="#e87070" />
            <StatChip emoji="🏰" value={stats.towers} color="#e0c070" />
            <StatChip emoji="🪙" value={stats.gold} color={C.highlight} />
          </>
        ) : (
          <>
            <StatChip emoji="🪙" value={stats.gold} color={C.highlight} />
            <StatChip emoji="🏰" value={stats.towers} color="#e0c070" />
            <StatChip emoji="💀" value={stats.kills} color="#e87070" />
          </>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        width: "100%",
        background: C.panel,
        border: `2px solid ${C.gold}`,
        borderBottom: "none",
      }}
    >
      {teamSection(red, "red")}

      {/* Timer + menu */}
      <div
        style={{
          flexShrink: 0,
          padding: "6px 18px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          borderLeft: `1px solid ${C.goldDim}`,
          borderRight: `1px solid ${C.goldDim}`,
          background:
            "linear-gradient(180deg, rgba(28,18,8,0.96), rgba(14,9,4,0.98))",
        }}
      >
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 20,
            fontWeight: "bold",
            color: C.goldBright,
            letterSpacing: 3,
            textShadow: `0 0 14px ${C.gold}55, 0 2px 5px rgba(0,0,0,0.95)`,
          }}
        >
          {mm}:{ss}
        </span>
        {phase === "loading" && (
          <button
            onClick={startMatch}
            style={{
              padding: "2px 10px",
              borderRadius: 4,
              background: "rgba(30,18,8,0.85)",
              border: `1px solid ${C.goldDim}`,
              color: C.muted,
              fontFamily: F.header,
              fontSize: 8,
              cursor: "pointer",
              letterSpacing: 1.5,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = C.gold;
              e.currentTarget.style.color = C.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.goldDim;
              e.currentTarget.style.color = C.muted;
            }}
          >
            START
          </button>
        )}
        {phase === "active" && (
          <span
            style={{
              fontSize: 8,
              fontFamily: F.header,
              color: C.muted,
              letterSpacing: 1,
            }}
          >
            MATCH
          </span>
        )}
      </div>

      {teamSection(blue, "blue")}
    </div>
  );
}

function StatChip({
  emoji,
  value,
  color,
}: {
  emoji: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontFamily: F.mono,
        fontSize: 13,
        fontWeight: "bold",
        color,
        textShadow: "0 1px 5px rgba(0,0,0,0.95)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>{emoji}</span>
      {value.toLocaleString()}
    </div>
  );
}

// ── Character Card ───────────────────────────────────────────────────────────
function CharacterCard({
  name,
  level,
  subtitle,
  portrait,
  active,
  onClick,
}: {
  name: string;
  level: number;
  subtitle: string;
  portrait?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        padding: "8px 14px",
        background: active
          ? "linear-gradient(180deg, rgba(42,28,10,0.97), rgba(22,14,5,0.99))"
          : hovered
          ? "linear-gradient(180deg, rgba(30,20,8,0.95), rgba(15,10,4,0.98))"
          : "linear-gradient(180deg, rgba(18,12,5,0.94), rgba(10,6,2,0.97))",
        border: `1px solid ${active ? C.gold : hovered ? C.goldDim + "aa" : C.goldDim}`,
        borderRadius: 10,
        cursor: "pointer",
        minWidth: 110,
        transition: "all 0.18s",
        boxShadow: active
          ? `0 0 14px rgba(197,160,89,0.25), inset 0 0 8px rgba(197,160,89,0.08)`
          : "none",
      }}
    >
      {/* Portrait circle */}
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: "50%",
          border: `3px solid ${active ? C.gold : C.goldDim}`,
          background:
            "radial-gradient(circle at 35% 28%, #3a2a16, #0c0804)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          fontSize: 26,
          boxShadow: active ? `0 0 10px rgba(197,160,89,0.4)` : "none",
          flexShrink: 0,
        }}
      >
        {portrait ? (
          <img
            src={portrait}
            alt={name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span>🧙‍♀️</span>
        )}
      </div>

      {/* Name */}
      <div
        style={{
          fontFamily: F.header,
          fontSize: 10,
          color: active ? C.highlight : C.text,
          fontWeight: "bold",
          textAlign: "center",
          letterSpacing: 0.5,
          maxWidth: 100,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </div>

      {/* Level + class subtitle */}
      <div
        style={{
          fontSize: 9,
          color: C.muted,
          textAlign: "center",
          fontFamily: F.header,
          letterSpacing: 0.4,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

// ── Character Roster ─────────────────────────────────────────────────────────
function CharacterRoster() {
  const selectedChar = useGame((s) => s.selectedCharacter);
  const level = useGame((s) => s.level);
  const goToCharacterSelect = useGame((s) => s.goToCharacterSelect);

  const name = selectedChar?.name || "Hero";
  const combatClass = selectedChar?.combatClass || "melee";
  const classLabel =
    combatClass === "caster" ? "Mage" : combatClass === "ranger" ? "Ranger" : "Warrior";

  const [addHovered, setAddHovered] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background:
          "linear-gradient(180deg, rgba(18,11,5,0.97), rgba(10,6,2,0.99))",
        border: `2px solid ${C.gold}`,
        borderTop: "none",
        borderRadius: "0 0 10px 10px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Active character */}
      <CharacterCard
        name={name}
        level={level}
        subtitle={`Level ${level} Human ${classLabel}`}
        active
      />

      {/* Placeholder slots */}
      {[2, 3].map((slot) => (
        <div
          key={slot}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            padding: "8px 14px",
            minWidth: 110,
            opacity: 0.4,
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              border: `2px dashed ${C.goldDim}`,
              background: "rgba(12,8,3,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              color: C.muted,
            }}
          >
            ?
          </div>
          <div
            style={{
              fontFamily: F.header,
              fontSize: 9,
              color: C.muted,
              letterSpacing: 0.5,
            }}
          >
            Empty
          </div>
        </div>
      ))}

      {/* Add button */}
      <div
        onMouseEnter={() => setAddHovered(true)}
        onMouseLeave={() => setAddHovered(false)}
        onClick={goToCharacterSelect}
        style={{
          width: 54,
          height: 54,
          borderRadius: "50%",
          border: `2px dashed ${addHovered ? C.gold : C.goldDim}`,
          background: addHovered ? "rgba(30,20,8,0.7)" : "rgba(12,8,3,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: addHovered ? C.gold : C.muted,
          fontSize: 26,
          fontWeight: 300,
          transition: "all 0.18s",
          marginBottom: 22,
          boxShadow: addHovered ? `0 0 10px rgba(197,160,89,0.3)` : "none",
        }}
        title="Add character"
      >
        +
      </div>
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────────────────────
export default function MatchHUD() {
  const gamePhase = useGame((s) => s.phase);
  const matchPhase = useMatchState((s) => s.phase);
  const setLoadProgress = useMatchState((s) => s.setLoadProgress);
  const loadProgress = useMatchState((s) => s.loadProgress);

  // Auto-advance loading bar on mount (simulate map load)
  useEffect(() => {
    if (matchPhase !== "loading") return;
    let p = loadProgress;
    const id = setInterval(() => {
      p = Math.min(1, p + 0.04);
      setLoadProgress(p);
      if (p >= 1) clearInterval(id);
    }, 80);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only render during active gameplay
  if (gamePhase !== "playing") return null;

  return (
    <>
      {/* Top loading bar — hides once fully loaded */}
      {loadProgress < 1 && <TopLoadingBar progress={loadProgress} />}

      {/* Bottom HUD panel */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9994,
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          userSelect: "none",
          filter: "drop-shadow(0 -4px 32px rgba(0,0,0,0.7))",
        }}
      >
        {/* Match scoreboard sits above the action bar */}
        <MatchScoreboard />

        {/* Action bar: orbs + dual-row hotbar + XP */}
        <div
          style={{
            background:
              "linear-gradient(180deg, rgba(22,14,7,0.98), rgba(12,7,3,0.99))",
            borderLeft: `2px solid ${C.gold}`,
            borderRight: `2px solid ${C.gold}`,
          }}
        >
          <ActionBar />
        </div>

        {/* Character roster */}
        <CharacterRoster />
      </div>
    </>
  );
}
