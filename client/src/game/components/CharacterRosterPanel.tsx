/**
 * CharacterRosterPanel — displays the player's saved cross-game characters
 * (the "grudge6 UUID set") fetched from the Grudge backend via useCharacterAPI.
 *
 * This is the read/display half of the character integration: the registry is
 * fetched in CharacterSelectScreen (`useCharacterAPI().characters`) and rendered
 * here as a selectable roster. Picking a card loads that character into the Hero
 * Forge editor and activates it server-side so every game mode renders the same
 * race/class/gear.
 *
 * Purely presentational — all data + handlers are passed in as props so this
 * component stays trivially testable and free of side effects.
 */

import { useState } from "react";
import type { ServerCharacter, CharacterAPIStatus } from "@/lib/characters/useCharacterAPI";
import { getFaction, type FactionId } from "@/lib/data/factions";

interface RaceMeta {
  label: string;
  emoji: string;
  faction: FactionId;
}

// Race → display + banner colour. Mirrors FactionCharacterRegistry's race→faction
// mapping so a roster card's accent matches the faction the character fights for.
const RACE_META: Record<string, RaceMeta> = {
  human:     { label: "Human",     emoji: "🛡️", faction: "crusade" },
  barbarian: { label: "Barbarian", emoji: "🪓", faction: "crusade" },
  elf:       { label: "Elf",       emoji: "🏹", faction: "fabled" },
  dwarf:     { label: "Dwarf",     emoji: "⛏️", faction: "fabled" },
  worge:     { label: "Worge",     emoji: "🐺", faction: "fabled" },
  orc:       { label: "Orc",       emoji: "🪓", faction: "legion" },
  undead:    { label: "Undead",    emoji: "💀", faction: "legion" },
};

function metaForRace(race: string | null | undefined): RaceMeta {
  const key = (race ?? "").toLowerCase();
  return RACE_META[key] ?? { label: race || "Unknown", emoji: "❓", faction: "crusade" };
}

function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Short, human-glanceable suffix of the character UUID (e.g. char_AbC123 → C123). */
function shortId(characterId: string): string {
  return characterId.replace(/^char_/, "").slice(-4).toUpperCase();
}

export interface CharacterRosterPanelProps {
  characters: ServerCharacter[];
  /** character_id of the currently active character, for highlight. */
  activeCharacterId: string | null;
  status: CharacterAPIStatus;
  error: string | null;
  /** Load a saved character into the forge + activate it. */
  onSelect: (character: ServerCharacter) => void;
  /** Re-fetch the roster from the backend. */
  onRefresh: () => void;
}

export function CharacterRosterPanel({
  characters,
  activeCharacterId,
  status,
  error,
  onSelect,
  onRefresh,
}: CharacterRosterPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const loading = status === "loading" && characters.length === 0;
  const isError = status === "error";

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        // Sit just to the right of the fixed 280px Hero Forge sidebar so the
        // roster overlays the empty preview area instead of the forge controls.
        left: 296,
        width: 236,
        maxHeight: "72vh",
        display: "flex",
        flexDirection: "column",
        background: "rgba(8,10,18,0.82)",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(201,149,10,0.35)",
        borderRadius: 8,
        boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
        zIndex: 40,
        fontFamily: "'Crimson Text', serif",
        color: "#e8e0cf",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          borderBottom: collapsed ? "none" : "1px solid rgba(255,255,255,0.08)",
          background: "rgba(201,149,10,0.10)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: "#f0d68a" }}>
            Your Heroes
          </span>
          <span style={{ fontSize: 10, color: "#8a7f63" }}>
            {characters.length > 0 ? `(${characters.length})` : ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            type="button"
            title="Refresh roster"
            onClick={onRefresh}
            style={iconBtnStyle}
          >
            ⟳
          </button>
          <button
            type="button"
            title={collapsed ? "Expand" : "Collapse"}
            onClick={() => setCollapsed((c) => !c)}
            style={iconBtnStyle}
          >
            {collapsed ? "▸" : "▾"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {loading && (
            <div style={hintStyle}>Loading characters…</div>
          )}

          {isError && (
            <div style={{ ...hintStyle, color: "#ff8a8a" }}>
              Couldn’t load roster.
              {error ? <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>{error}</div> : null}
              <button type="button" onClick={onRefresh} style={{ ...textBtnStyle, marginTop: 6 }}>
                Retry
              </button>
            </div>
          )}

          {!loading && !isError && characters.length === 0 && (
            <div style={hintStyle}>
              No saved heroes yet. Forge one below and it’ll appear here — synced to
              every Grudge game.
            </div>
          )}

          {characters.map((c) => {
            const meta = metaForRace(c.race);
            const faction = getFaction(meta.faction);
            const isActive = c.character_id === activeCharacterId;
            return (
              <button
                key={c.character_id}
                type="button"
                onClick={() => onSelect(c)}
                title={`Play as ${c.name}`}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  textAlign: "left",
                  padding: "7px 8px 7px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: isActive ? "rgba(201,149,10,0.18)" : "rgba(255,255,255,0.04)",
                  border: isActive
                    ? "1px solid rgba(201,149,10,0.6)"
                    : "1px solid rgba(255,255,255,0.08)",
                  color: "inherit",
                  transition: "background 0.12s, border 0.12s",
                }}
              >
                {/* Faction accent bar */}
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    borderTopLeftRadius: 6,
                    borderBottomLeftRadius: 6,
                    background: faction.color,
                  }}
                />
                <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>
                  {meta.emoji}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#f5edd8",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.name}
                  </span>
                  <span style={{ display: "block", fontSize: 10, color: "#b8aa86" }}>
                    Lvl {c.level} · {meta.label} · {titleCase(c.hero_class)}
                  </span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  {isActive && (
                    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, color: "#f0d68a" }}>
                      ACTIVE
                    </span>
                  )}
                  <span style={{ fontSize: 8, color: "#6f6750" }}>#{shortId(c.character_id)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  borderRadius: 4,
  cursor: "pointer",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#c9a86c",
  lineHeight: 1,
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  lineHeight: 1.4,
  color: "#9a8f72",
  padding: "6px 4px",
};

const textBtnStyle: React.CSSProperties = {
  padding: "3px 10px",
  fontSize: 10,
  borderRadius: 4,
  cursor: "pointer",
  background: "rgba(201,149,10,0.18)",
  border: "1px solid rgba(201,149,10,0.45)",
  color: "#f0d68a",
};
