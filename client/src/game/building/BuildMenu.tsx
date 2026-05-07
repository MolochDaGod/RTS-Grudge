import { useBuildSystem, BUILDING_REGISTRY, type BuildingCategory } from "@/lib/stores/useBuildSystem";
import { useGame } from "@/lib/stores/useGame";
import { useState } from "react";
import { getBuildingIcon } from "@/lib/data/icons";

const CATEGORIES: { key: BuildingCategory; label: string; color: string }[] = [
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
  const toggleBuildMode = useBuildSystem(s => s.toggleBuildMode);
  const selectBuilding = useBuildSystem(s => s.selectBuilding);
  const [activeCategory, setActiveCategory] = useState<BuildingCategory>("defense");

  if (interactionMode !== "build") return null;
  if (!buildMode) return null;

  const available = BUILDING_REGISTRY.filter(b =>
    b.category === activeCategory && unlockedBuildings.has(b.id)
  );

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(10,10,20,0.95)", borderTop: "2px solid #ffd700",
      padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8,
    }}>
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
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {available.map(def => {
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
        {available.length === 0 && (
          <span style={{ color: "#888", padding: 8 }}>No buildings unlocked in this category yet.</span>
        )}
      </div>
      <div style={{ color: "#888", fontSize: 11, textAlign: "center" }}>
        Click terrain to place • R to rotate • Right-click to cancel • B to close build mode
      </div>
    </div>
  );
}
