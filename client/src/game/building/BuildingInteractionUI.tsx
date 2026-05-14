import { useEffect, useCallback } from "react";
import { useBuildingInteraction } from "@/lib/stores/useBuildingInteraction";
import { useSurvivalBuilding, type PlacedSurvivalBuilding } from "@/lib/stores/useSurvivalBuilding";
import { useAllies } from "@/lib/stores/useAllies";
import { useInventory } from "@/lib/stores/useInventory";
import { useGame } from "@/lib/stores/useGame";
import * as THREE from "three";

const PANEL_BG = "/textures/ui/building-panel.png";

const f = {
  display: "'Cinzel', serif",
  body: "'Crimson Text', serif",
  mono: "'JetBrains Mono', monospace",
};

const GOLD = "#c9950a";
const GOLD_DIM = "rgba(201,149,10,0.4)";

// ----- Building type detection -----
type BuildingRole = "campfire" | "workbench" | "barracks" | "storage" | "watchtower" | "farm" | "generic";

function getBuildingRole(b: PlacedSurvivalBuilding): BuildingRole {
  const id = b.recipeId.toLowerCase();
  if (id.includes("campfire") || id.includes("fire_pit") || id.includes("cook")) return "campfire";
  if (id.includes("workbench") || id.includes("forge") || id.includes("anvil")) return "workbench";
  if (id.includes("barracks") || id.includes("tent") || id.includes("guard")) return "barracks";
  if (id.includes("storage") || id.includes("chest") || id.includes("crate")) return "storage";
  if (id.includes("watchtower") || id.includes("tower") || id.includes("lookout")) return "watchtower";
  if (id.includes("farm") || id.includes("plot") || id.includes("garden")) return "farm";
  return "generic";
}

const ROLE_ICONS: Record<BuildingRole, string> = {
  campfire: "🔥",
  workbench: "🔨",
  barracks: "⚔️",
  storage: "📦",
  watchtower: "🏰",
  farm: "🌾",
  generic: "🏠",
};

const ROLE_DESCRIPTIONS: Record<BuildingRole, string> = {
  campfire: "Provides warmth and cooking. Allies gather here at night.",
  workbench: "Assign workers to craft items and gain XP.",
  barracks: "Manage allies — spawn, dismiss, and assign orders.",
  storage: "Store and retrieve items from community stockpile.",
  watchtower: "Assign defenders to guard this area against enemies.",
  farm: "Assign farmers to tend crops and harvest resources.",
  generic: "A placed structure in your camp.",
};

// ----- Proximity prompt -----
function BuildingProximityPrompt() {
  const nearbyUid = useBuildingInteraction(s => s.nearbyBuildingUid);
  const nearbyName = useBuildingInteraction(s => s.nearbyBuildingName);
  const nearbyIcon = useBuildingInteraction(s => s.nearbyBuildingIcon);
  const openUid = useBuildingInteraction(s => s.openBuildingUid);

  if (!nearbyUid || openUid) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 180,
        transform: "translateX(-50%)",
        zIndex: 9040,
        pointerEvents: "none",
        background: "rgba(12,8,5,0.88)",
        border: `1px solid ${GOLD_DIM}`,
        borderRadius: 8,
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
      }}
    >
      <span style={{ fontSize: 18 }}>{nearbyIcon || "🏠"}</span>
      <span style={{ fontFamily: f.body, fontSize: 13, color: "#f3eada" }}>
        {nearbyName || "Building"}
      </span>
      <span style={{
        fontFamily: f.mono, fontSize: 12, color: GOLD,
        fontWeight: 700, letterSpacing: 1, marginLeft: 8,
      }}>
        [E]
      </span>
    </div>
  );
}

// ----- Building-specific content panels -----

function CampfirePanel({ building }: { building: PlacedSurvivalBuilding }) {
  return (
    <div>
      <SectionLabel>Cooking</SectionLabel>
      <div style={slotGridStyle}>
        {["Slot 1", "Slot 2", "Slot 3"].map((slot, i) => (
          <div key={i} style={slotStyle}>
            <span style={{ fontSize: 20 }}>🍳</span>
            <span style={{ fontSize: 10, color: "#8a7a5a" }}>{slot}</span>
          </div>
        ))}
      </div>
      <InfoRow label="Warmth Radius" value="8m" icon="🌡️" />
      <InfoRow label="Status" value="Burning" icon="🔥" />
    </div>
  );
}

function WorkbenchPanel({ building }: { building: PlacedSurvivalBuilding }) {
  const allies = useAllies(s => s.allies);
  const assignToBuilding = useAllies(s => s.assignToBuilding);
  const assignedWorkers = allies.filter(a => a.assignedBuildingUid === building.uid && a.behavior === "craft");
  const availableWorkers = allies.filter(a => !a.assignedBuildingUid && a.behavior !== "combat");

  return (
    <div>
      <SectionLabel>Assigned Workers ({assignedWorkers.length})</SectionLabel>
      {assignedWorkers.map(w => (
        <AllyRow key={w.id} ally={w}>
          <ActionBtn label="Unassign" onClick={() => assignToBuilding(w.id, null, "patrol")} />
        </AllyRow>
      ))}
      {availableWorkers.length > 0 && (
        <>
          <SectionLabel>Available</SectionLabel>
          {availableWorkers.slice(0, 4).map(w => (
            <AllyRow key={w.id} ally={w}>
              <ActionBtn label="Assign" onClick={() => assignToBuilding(w.id, building.uid, "craft")} />
            </AllyRow>
          ))}
        </>
      )}
      <InfoRow label="Craft Speed" value="1x" icon="⚡" />
    </div>
  );
}

function BarracksPanel({ building }: { building: PlacedSurvivalBuilding }) {
  const allies = useAllies(s => s.allies);
  const assigned = allies.filter(a => a.spawnedBy === building.uid);

  return (
    <div>
      <SectionLabel>Garrison ({assigned.length})</SectionLabel>
      {assigned.map(a => (
        <AllyRow key={a.id} ally={a}>
          <span style={{ fontSize: 9, color: "#8a7a5a" }}>Lv {a.level}</span>
        </AllyRow>
      ))}
      {assigned.length === 0 && (
        <div style={{ color: "#6a5a3a", fontSize: 11, padding: 8, textAlign: "center" }}>
          No allies stationed here
        </div>
      )}
      <InfoRow label="Capacity" value={`${assigned.length}/5`} icon="👥" />
    </div>
  );
}

function StoragePanel({ building }: { building: PlacedSurvivalBuilding }) {
  const items = useInventory(s => s.items);

  return (
    <div>
      <SectionLabel>Stockpile</SectionLabel>
      <div style={slotGridStyle}>
        {items.slice(0, 6).map((item, i) => (
          <div key={i} style={slotStyle}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span style={{ fontSize: 9, color: "#c0b090" }}>{item.quantity}</span>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ color: "#6a5a3a", fontSize: 11, gridColumn: "span 3", textAlign: "center", padding: 8 }}>
            Empty
          </div>
        )}
      </div>
      <InfoRow label="Slots Used" value={`${items.length}/20`} icon="📦" />
    </div>
  );
}

function WatchtowerPanel({ building }: { building: PlacedSurvivalBuilding }) {
  const allies = useAllies(s => s.allies);
  const assignToBuilding = useAllies(s => s.assignToBuilding);
  const defenders = allies.filter(a => a.assignedBuildingUid === building.uid && a.behavior === "defend");
  const available = allies.filter(a => !a.assignedBuildingUid && a.behavior !== "combat" && !a.canHarvest);

  return (
    <div>
      <SectionLabel>Defenders ({defenders.length})</SectionLabel>
      {defenders.map(d => (
        <AllyRow key={d.id} ally={d}>
          <ActionBtn label="Remove" onClick={() => assignToBuilding(d.id, null, "patrol")} />
        </AllyRow>
      ))}
      {available.length > 0 && (
        <>
          <SectionLabel>Assign Guard</SectionLabel>
          {available.slice(0, 3).map(a => (
            <AllyRow key={a.id} ally={a}>
              <ActionBtn label="Guard" onClick={() => assignToBuilding(a.id, building.uid, "defend")} />
            </AllyRow>
          ))}
        </>
      )}
      <InfoRow label="Defense Radius" value="8m" icon="🛡️" />
      <InfoRow label="Alert Level" value="Normal" icon="⚡" />
    </div>
  );
}

function FarmPanel({ building }: { building: PlacedSurvivalBuilding }) {
  const allies = useAllies(s => s.allies);
  const assignToBuilding = useAllies(s => s.assignToBuilding);
  const farmers = allies.filter(a => a.assignedBuildingUid === building.uid);
  const available = allies.filter(a => !a.assignedBuildingUid && a.canHarvest);

  return (
    <div>
      <SectionLabel>Farmers ({farmers.length})</SectionLabel>
      {farmers.map(f => (
        <AllyRow key={f.id} ally={f}>
          <ActionBtn label="Unassign" onClick={() => assignToBuilding(f.id, null, "patrol")} />
        </AllyRow>
      ))}
      {available.length > 0 && (
        <>
          <SectionLabel>Available Farmers</SectionLabel>
          {available.slice(0, 3).map(a => (
            <AllyRow key={a.id} ally={a}>
              <ActionBtn label="Assign" onClick={() => assignToBuilding(a.id, building.uid, "harvest")} />
            </AllyRow>
          ))}
        </>
      )}
      <InfoRow label="Yield Bonus" value="+10%" icon="🌱" />
    </div>
  );
}

function GenericPanel({ building }: { building: PlacedSurvivalBuilding }) {
  return (
    <div>
      <InfoRow label="Health" value={`${building.health}/${building.maxHealth}`} icon="❤️" />
      <InfoRow label="Type" value={building.recipeId.replace(/_/g, " ")} icon="🏗️" />
    </div>
  );
}

// ----- Shared UI atoms -----

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: f.display, fontSize: 11, color: GOLD,
      letterSpacing: 1.5, textTransform: "uppercase",
      borderBottom: `1px solid ${GOLD_DIM}`,
      paddingBottom: 3, marginTop: 10, marginBottom: 6,
    }}>{children}</div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "5px 8px", marginTop: 4,
      background: "rgba(30,20,14,0.6)", borderRadius: 4,
      border: "1px solid rgba(60,40,25,0.4)",
    }}>
      <span style={{ fontSize: 11, color: "#9b8a6a", display: "flex", alignItems: "center", gap: 5 }}>
        <span>{icon}</span>{label}
      </span>
      <span style={{ fontSize: 12, fontFamily: f.mono, color: "#e0d0a0", fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function AllyRow({ ally, children }: { ally: { id: string; name: string; type: string; level: number; health: number; maxHealth: number }; children?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "4px 8px", marginBottom: 3,
      background: "rgba(30,20,14,0.5)", borderRadius: 4,
      border: "1px solid rgba(60,40,25,0.3)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, fontFamily: f.body, color: "#e0d0a0" }}>{ally.name}</span>
        <span style={{ fontSize: 9, color: "#8a7a5a" }}>Lv{ally.level}</span>
      </div>
      {children}
    </div>
  );
}

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 8px", fontSize: 10, cursor: "pointer",
        background: "linear-gradient(135deg, #3a2a1a, #1a0f08)",
        border: `1px solid ${GOLD_DIM}`, borderRadius: 4,
        color: GOLD, fontFamily: f.display,
      }}
    >
      {label}
    </button>
  );
}

const slotGridStyle: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 4,
};

const slotStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  padding: 8, background: "rgba(20,14,8,0.7)", borderRadius: 6,
  border: "1px solid rgba(60,40,25,0.4)", minHeight: 48,
};

// ----- Main panel -----

function BuildingPanel() {
  const openUid = useBuildingInteraction(s => s.openBuildingUid);
  const closeBuilding = useBuildingInteraction(s => s.closeBuilding);
  const buildings = useSurvivalBuilding(s => s.placedBuildings);

  const building = buildings.find(b => b.uid === openUid);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") closeBuilding();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [closeBuilding]);

  if (!building) return null;

  const role = getBuildingRole(building);
  const roleIcon = ROLE_ICONS[role];
  const roleDesc = ROLE_DESCRIPTIONS[role];

  const ContentPanel = {
    campfire: CampfirePanel,
    workbench: WorkbenchPanel,
    barracks: BarracksPanel,
    storage: StoragePanel,
    watchtower: WatchtowerPanel,
    farm: FarmPanel,
    generic: GenericPanel,
  }[role];

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10000,
        width: 380,
        minHeight: 420,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Background: the quick interaction panel PNG */}
      <img
        src={PANEL_BG}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "fill",
          pointerEvents: "none",
          opacity: 0.95,
        }}
      />

      {/* Content overlay */}
      <div
        style={{
          position: "relative",
          padding: "28px 24px 20px",
          minHeight: 420,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>{roleIcon}</span>
            <div>
              <div style={{
                fontFamily: f.display, fontSize: 16, color: "#ffd700",
                textShadow: "0 1px 3px #000",
              }}>
                {building.name}
              </div>
              <div style={{ fontSize: 10, color: "#9b8a6a", fontFamily: f.body }}>{roleDesc}</div>
            </div>
          </div>
          <button
            onClick={closeBuilding}
            style={{
              background: "rgba(80,20,10,0.6)", border: "1px solid #a33",
              borderRadius: "50%", width: 26, height: 26,
              color: "#ff8888", cursor: "pointer", fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Health bar */}
        <div style={{
          height: 6, background: "rgba(0,0,0,0.5)", borderRadius: 3,
          overflow: "hidden", marginBottom: 8,
          border: "1px solid rgba(60,40,25,0.4)",
        }}>
          <div style={{
            height: "100%",
            width: `${(building.health / building.maxHealth) * 100}%`,
            background: building.health / building.maxHealth > 0.5
              ? "linear-gradient(90deg, #4a7a30, #6ec96e)"
              : "linear-gradient(90deg, #8b2020, #d44040)",
            transition: "width 0.3s",
          }} />
        </div>

        {/* Role-specific content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <ContentPanel building={building} />
        </div>

        {/* Footer actions */}
        <div style={{
          display: "flex", gap: 8, marginTop: 12,
          borderTop: `1px solid ${GOLD_DIM}`, paddingTop: 8,
        }}>
          <button
            onClick={closeBuilding}
            style={{
              flex: 1, padding: "8px 12px", cursor: "pointer",
              background: "linear-gradient(135deg, #2a1a10, #1a0f08)",
              border: `1px solid ${GOLD_DIM}`, borderRadius: 6,
              color: "#e0d0a0", fontFamily: f.display, fontSize: 12,
            }}
          >
            Close [Esc]
          </button>
        </div>
      </div>
    </div>
  );
}

// ----- Proximity detection hook (runs in HUD) -----

function BuildingProximityDetector() {
  const buildings = useSurvivalBuilding(s => s.placedBuildings);
  const setNearby = useBuildingInteraction(s => s.setNearbyBuilding);
  const openBuilding = useBuildingInteraction(s => s.openBuilding);
  const openUid = useBuildingInteraction(s => s.openBuildingUid);

  const checkProximity = useCallback(() => {
    const playerPos = useGame.getState().playerPosition;
    if (!playerPos || openUid) {
      setNearby(null);
      return;
    }

    let nearest: PlacedSurvivalBuilding | null = null;
    let nearestDist = 4.0; // interaction range

    for (const b of buildings) {
      const bPos = new THREE.Vector3(b.position[0], b.position[1], b.position[2]);
      const dist = playerPos.distanceTo(bPos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = b;
      }
    }

    if (nearest) {
      setNearby(nearest.uid, nearest.name, nearest.icon);
    } else {
      setNearby(null);
    }
  }, [buildings, setNearby, openUid]);

  useEffect(() => {
    const interval = setInterval(checkProximity, 250);
    return () => clearInterval(interval);
  }, [checkProximity]);

  // E key to open
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "KeyE") {
        const nearby = useBuildingInteraction.getState().nearbyBuildingUid;
        const isOpen = useBuildingInteraction.getState().openBuildingUid;
        if (isOpen) {
          useBuildingInteraction.getState().closeBuilding();
        } else if (nearby) {
          openBuilding(nearby);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [openBuilding]);

  return null;
}

// ----- Exported composite -----

export default function BuildingInteractionUI() {
  return (
    <>
      <BuildingProximityDetector />
      <BuildingProximityPrompt />
      <BuildingPanel />
    </>
  );
}
