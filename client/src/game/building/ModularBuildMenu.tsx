/**
 * ModularBuildMenu — bottom-dock UI for the modular dungeon/fantasy builder.
 *
 * Shows when the player is in build mode with the modular palette active.
 * Category tabs come from CATEGORY_INFO, pieces from BuildingPalette.
 * Search bar, pack filter (Kenney / KayKit), and piece count per category.
 */

import { useState, useMemo } from "react";
import { useModularBuild } from "@/lib/stores/useModularBuild";
import { useGame } from "@/lib/stores/useGame";
import {
  type BuildingCategory,
  CATEGORY_INFO,
  getPiecesByCategory,
  getPiecesByPack,
  searchPieces,
  getActiveCategories,
  type BuildingPiece,
} from "./BuildingPalette";

type PackFilter = "all" | "kenney_fantasy" | "kaykit_dungeon";

export default function ModularBuildMenu() {
  const active = useModularBuild(s => s.active);
  const selectedPieceId = useModularBuild(s => s.selectedPieceId);
  const selectPiece = useModularBuild(s => s.selectPiece);
  const placedCount = useModularBuild(s => s.placedPieces.length);
  const clearAll = useModularBuild(s => s.clearAll);
  const setActive = useModularBuild(s => s.setActive);
  const interactionMode = useGame(s => s.interactionMode);

  const [activeCategory, setActiveCategory] = useState<BuildingCategory>("foundation");
  const [searchQuery, setSearchQuery] = useState("");
  const [packFilter, setPackFilter] = useState<PackFilter>("all");

  const categories = useMemo(() => getActiveCategories(), []);

  const pieces = useMemo(() => {
    let result: BuildingPiece[];
    if (searchQuery.trim()) {
      result = searchPieces(searchQuery);
    } else {
      result = getPiecesByCategory(activeCategory);
    }
    // Filter out destroyed variants from the placement palette
    result = result.filter(p => !p.isDestroyed);
    if (packFilter !== "all") {
      result = result.filter(p => p.pack === packFilter);
    }
    return result;
  }, [activeCategory, searchQuery, packFilter]);

  // Only show when modular build mode is active
  if (!active) return null;

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(10,10,20,0.96)", borderTop: "2px solid #aa7733",
      padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6,
      fontFamily: "system-ui, sans-serif",
    }}>
      {/* Top bar: search + pack filter + piece count + close */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
          <input
            type="text"
            placeholder="Search pieces…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 6, padding: "5px 10px", color: "#fff", fontSize: 12, width: 180,
              outline: "none",
            }}
          />
          {(["all", "kenney_fantasy", "kaykit_dungeon"] as const).map(pk => (
            <button
              key={pk}
              onClick={() => setPackFilter(pk)}
              style={{
                padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11,
                background: packFilter === pk ? "rgba(170,119,51,0.4)" : "rgba(255,255,255,0.06)",
                color: packFilter === pk ? "#ffcc66" : "#aaa",
                border: packFilter === pk ? "1px solid #aa7733" : "1px solid transparent",
              }}
            >
              {pk === "all" ? "All" : pk === "kenney_fantasy" ? "Kenney" : "KayKit"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ color: "#888", fontSize: 11 }}>
            {placedCount} placed
          </span>
          {placedCount > 0 && (
            <button
              onClick={clearAll}
              style={{
                padding: "4px 10px", background: "rgba(200,50,50,0.3)", color: "#ff6666",
                border: "1px solid rgba(200,50,50,0.4)", borderRadius: 4, cursor: "pointer", fontSize: 11,
              }}
            >
              Clear All
            </button>
          )}
          <button
            onClick={() => setActive(false)}
            style={{
              padding: "5px 14px", background: "#8b2500", color: "#fff",
              border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 12,
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
        {categories.filter(c => c !== "destroyed").map(cat => {
          const info = CATEGORY_INFO[cat];
          const count = getPiecesByCategory(cat).filter(p => !p.isDestroyed).length;
          const isActive = activeCategory === cat && !searchQuery.trim();
          return (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setSearchQuery(""); }}
              style={{
                padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11,
                background: isActive ? info.color + "44" : "rgba(255,255,255,0.05)",
                color: isActive ? "#fff" : "#aaa",
                border: isActive ? `1px solid ${info.color}` : "1px solid transparent",
                whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <span>{info.icon}</span>
              <span>{info.label}</span>
              <span style={{ opacity: 0.5, fontSize: 10 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Piece grid */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, minHeight: 64 }}>
        {pieces.map(piece => {
          const isSelected = selectedPieceId === piece.id;
          const catInfo = CATEGORY_INFO[piece.category];
          return (
            <button
              key={piece.id}
              onClick={() => selectPiece(isSelected ? null : piece.id)}
              title={`${piece.name}\n${piece.pack === "kaykit_dungeon" ? "KayKit Dungeon" : "Kenney Fantasy"}\nSnap: ${piece.snapSize}m · Rot: ${piece.rotationSnap}°${piece.hasDestroyedVariant ? "\n💥 Destructible" : ""}`}
              style={{
                minWidth: 100, padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                background: isSelected ? "rgba(170,119,51,0.35)" : "rgba(255,255,255,0.06)",
                border: isSelected ? "2px solid #aa7733" : "1px solid rgba(255,255,255,0.12)",
                display: "flex", flexDirection: "column", gap: 2,
                textAlign: "left", flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 14 }}>{catInfo.icon}</span>
                <span style={{ color: "#fff", fontWeight: "bold", fontSize: 11, lineHeight: 1.2 }}>
                  {piece.name}
                </span>
              </div>
              <span style={{ color: "#777", fontSize: 10 }}>
                {piece.pack === "kaykit_dungeon" ? "KayKit" : "Kenney"}
                {piece.hasDestroyedVariant ? " · 💥" : ""}
                {piece.tags?.includes("light") ? " · 🔥" : ""}
                {piece.tags?.includes("trap") ? " · ⚠️" : ""}
              </span>
            </button>
          );
        })}
        {pieces.length === 0 && (
          <span style={{ color: "#666", padding: 8, fontSize: 12 }}>
            {searchQuery ? "No pieces match your search." : "No pieces in this category."}
          </span>
        )}
      </div>

      {/* Help text */}
      <div style={{ color: "#666", fontSize: 10, textAlign: "center" }}>
        LMB to place · R to rotate · Right-click to deselect · Escape to cancel
      </div>
    </div>
  );
}
