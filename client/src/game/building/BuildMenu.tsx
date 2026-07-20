import { useBuildSystem, BUILDING_REGISTRY, FACTION_BUILDING_ALIAS, type BuildingCategory } from "@/lib/stores/useBuildSystem";
import { useGame } from "@/lib/stores/useGame";
import { useState, useMemo, useSyncExternalStore } from "react";
import { getBuildingIcon } from "@/lib/data/icons";
import { FACTIONS_BY_ID, type FactionId } from "@/lib/data/factions";
import {
  buildingPaletteRows,
  getClaim,
  subscribeClaim,
  validateBuildAt,
} from "@/lib/campSsot";

/** Color + label shown on faction-specific military buildings. */
const FACTION_BADGE: Record<string, { color: string; label: string }> = {
  crusade: { color: "#3aa0ff", label: "⚔ Crusade" },
  fabled:  { color: "#3ddc7b", label: "🌿 Fabled" },
  legion:  { color: "#ff3a3a", label: "💀 Legion" },
  pirate:  { color: "#d4a437", label: "☠ Pirate" },
};

const CATEGORIES: { key: BuildingCategory | "camp"; label: string; color: string }[] = [
  { key: "camp", label: "Camp SSOT", color: "#c9950a" },
  { key: "defense", label: "Defense", color: "#e74c3c" },
  { key: "military", label: "Military", color: "#e67e22" },
  { key: "economy", label: "Economy", color: "#2ecc71" },
  { key: "housing", label: "Housing", color: "#3498db" },
  { key: "special", label: "Special", color: "#9b59b6" },
];

export default function BuildMenu() {
  const interactionMode = useGame(s => s.interactionMode);
  const buildMode = useBuildSystem(s => s.buildMode);
  const selectedBuildingId = useBuildSystem(s => s.selectedBuildingId);
  const resources = useBuildSystem(s => s.resources);
  const unlockedBuildings = useBuildSystem(s => s.unlockedBuildings);
  const ghostPosition = useBuildSystem(s => s.ghostPosition);
  const toggleBuildMode = useBuildSystem(s => s.toggleBuildMode);
  const selectBuilding = useBuildSystem(s => s.selectBuilding);
  const selectedCharacter = useGame(s => s.selectedCharacter);
  const [activeCategory, setActiveCategory] = useState<BuildingCategory | "camp">("camp");
  const claim = useSyncExternalStore(subscribeClaim, getClaim, () => null);

  // Resolve the player's effective faction for building access.
  // Pirates share human-Crusade military buildings via the alias map.
  const rawFaction = (selectedCharacter.faction ?? "crusade") as string;
  const effectiveFaction = (FACTION_BUILDING_ALIAS[rawFaction] ?? rawFaction) as string;
  const factionDef = FACTIONS_BY_ID[rawFaction as FactionId];

  const ssotRows = useMemo(
    () => buildingPaletteRows(effectiveFaction === "pirate" ? "crusade" : effectiveFaction),
    [effectiveFaction],
  );

  if (interactionMode !== "build") return null;
  if (!buildMode) return null;

  const available = BUILDING_REGISTRY.filter(b => {
    if (!unlockedBuildings.has(b.id)) return false;
    if (activeCategory === "camp") return false;
    if (b.category !== activeCategory) return false;
    // Show neutral buildings to everyone; show faction buildings only to the
    // matching faction (or its alias).
    const bf = b.faction ?? "neutral";
    return bf === "neutral" || bf === rawFaction || bf === effectiveFaction;
  });

  const ghostGate =
    ghostPosition && selectedBuildingId
      ? validateBuildAt(selectedBuildingId, ghostPosition[0], ghostPosition[2])
      : null;

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(10,10,20,0.95)", borderTop: "2px solid #ffd700",
      padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8,
    }}>
      {/* Faction identity strip */}
      {factionDef && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          borderBottom: `1px solid ${factionDef.color}33`, paddingBottom: 6, marginBottom: 2,
        }}>
          <img
            src={factionDef.emblem}
            alt={factionDef.name}
            style={{ width: 20, height: 20, objectFit: "contain" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <span style={{ color: factionDef.color, fontWeight: "bold", fontSize: 12 }}>
            {factionDef.name}
          </span>
          <span style={{ color: "#777", fontSize: 11 }}>
            — {factionDef.tagline}
          </span>
          <span style={{ marginLeft: "auto", color: "#666", fontSize: 10 }}>
            You can build neutral + {factionDef.name} structures
          </span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              style={{
                padding: "6px 14px", borderRadius: 6, cursor: "pointer",
                background: activeCategory === cat.key ? cat.color : "rgba(255,255,255,0.1)",
                color: "#fff", border: "none", fontWeight: activeCategory === cat.key ? "bold" : "normal",
                fontSize: 13,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ color: "#8B4513", fontWeight: "bold" }}>Wood: {Math.floor(resources.wood)}</span>
          <span style={{ color: "#888", fontWeight: "bold" }}>Stone: {Math.floor(resources.stone)}</span>
          <span style={{ color: "#ffd700", fontWeight: "bold" }}>Gold: {Math.floor(resources.gold)}</span>
          <button
            onClick={toggleBuildMode}
            style={{
              padding: "6px 14px", background: "#c0392b", color: "#fff",
              border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold",
            }}
          >
            Close
          </button>
        </div>
      </div>
      {/* Claim status */}
      <div style={{ color: claim ? "#3ddc7b" : "#e67e22", fontSize: 11 }}>
        {claim
          ? `Claim active · r=${claim.radiusM}m · ${claim.placedBuildingIds.length} structures`
          : "No claim — place Claim Flag (Camp SSOT / Special) first for gated buildings"}
        {ghostGate && !ghostGate.ok && (
          <span style={{ color: "#e74c3c", marginLeft: 12 }}>⚠ {ghostGate.reason}</span>
        )}
        {ghostGate?.ok && ghostGate.inClaim && (
          <span style={{ color: "#3ddc7b", marginLeft: 12 }}>✓ In claim</span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {activeCategory === "camp"
          ? ssotRows.map((row) => {
              const cost = row.cost;
              const canAfford =
                resources.wood >= (cost.wood ?? 0) &&
                resources.stone >= (cost.stone ?? 0) &&
                resources.gold >= (cost.gold ?? 0);
              const pickId = row.legacyId;
              const isSelected = selectedBuildingId === pickId || selectedBuildingId === row.id;
              // Map SSOT to registry id when possible
              const regId =
                BUILDING_REGISTRY.find(
                  (b) => b.id === pickId || b.id === row.id || b.name === row.name,
                )?.id ?? (pickId === "claim_flag" || row.id === "bld.claim_flag" ? "claim_flag" : pickId);
              return (
                <button
                  key={row.id}
                  onClick={() => selectBuilding(isSelected ? null : regId)}
                  style={{
                    minWidth: 140, padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                    background: isSelected ? "rgba(201,149,10,0.35)" : "rgba(255,255,255,0.08)",
                    border: isSelected ? "2px solid #c9950a" : "1px solid rgba(255,255,255,0.2)",
                    opacity: canAfford ? 1 : 0.5, display: "flex", flexDirection: "column", gap: 4,
                    textAlign: "left",
                  }}
                  title={row.description}
                >
                  <span style={{ color: "#fff", fontWeight: "bold", fontSize: 13 }}>
                    {row.emoji} {row.name}
                  </span>
                  <span style={{ color: "#aaa", fontSize: 11 }}>{row.description.slice(0, 60)}</span>
                  <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                    {(cost.wood ?? 0) > 0 && <span style={{ color: "#8B4513" }}>W:{cost.wood}</span>}
                    {(cost.stone ?? 0) > 0 && <span style={{ color: "#888" }}>S:{cost.stone}</span>}
                    {(cost.gold ?? 0) > 0 && <span style={{ color: "#ffd700" }}>G:{cost.gold}</span>}
                  </div>
                  {row.claimGated && (
                    <span style={{ color: "#e67e22", fontSize: 10 }}>Claim gated</span>
                  )}
                </button>
              );
            })
          : available.map(def => {
          const canAfford = resources.wood >= def.cost.wood && resources.stone >= def.cost.stone && resources.gold >= def.cost.gold;
          const isSelected = selectedBuildingId === def.id;
          return (
            <button
              key={def.id}
              onClick={() => selectBuilding(isSelected ? null : def.id)}
              style={{
                minWidth: 140, padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                background: isSelected ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.08)",
                border: isSelected ? "2px solid #ffd700" : "1px solid rgba(255,255,255,0.2)",
                opacity: canAfford ? 1 : 0.5, display: "flex", flexDirection: "column", gap: 4,
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <img
                  src={getBuildingIcon(def.name || def.id)}
                  alt={def.name}
                  style={{ width: 28, height: 28, objectFit: "contain", flexShrink: 0 }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <span style={{ color: "#fff", fontWeight: "bold", fontSize: 13 }}>{def.name}</span>
              </div>
              {/* Faction badge on military buildings */}
              {def.faction && def.faction !== "neutral" && FACTION_BADGE[def.faction] && (
                <span style={{
                  display: "inline-block", fontSize: 10, fontWeight: "bold",
                  color: FACTION_BADGE[def.faction]!.color,
                  borderLeft: `2px solid ${FACTION_BADGE[def.faction]!.color}`,
                  paddingLeft: 4, lineHeight: 1.4,
                }}>
                  {FACTION_BADGE[def.faction]!.label}
                </span>
              )}
              <span style={{ color: "#aaa", fontSize: 11 }}>{def.description}</span>
              <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                {def.cost.wood > 0 && <span style={{ color: "#8B4513" }}>W:{def.cost.wood}</span>}
                {def.cost.stone > 0 && <span style={{ color: "#888" }}>S:{def.cost.stone}</span>}
                {def.cost.gold > 0 && <span style={{ color: "#ffd700" }}>G:{def.cost.gold}</span>}
              </div>
              {def.spawnAlly && (
                <span style={{ color: "#2ecc71", fontSize: 11 }}>Spawns {def.allyCount}x {def.spawnAlly}</span>
              )}
            </button>
          );
        })}
        {activeCategory !== "camp" && available.length === 0 && (
          <span style={{ color: "#888", padding: 8 }}>No buildings unlocked in this category yet.</span>
        )}
      </div>
      <div style={{ color: "#888", fontSize: 11, textAlign: "center" }}>
        Click terrain to place • R to rotate • Right-click to cancel • B to close build mode
      </div>
    </div>
  );
}
