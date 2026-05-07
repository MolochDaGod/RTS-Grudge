import { useMemo, useState } from "react";
import {
  useAllies,
  type AllyData,
  type AllyCommand,
  ALLY_COMMAND_LABELS,
  ALLY_COMMAND_ICONS,
  MAX_ALLY_LEVEL,
} from "@/lib/stores/useAllies";
import { useGame } from "@/lib/stores/useGame";
import { useEnemyManager } from "../systems/EnemyManager";
import { getProfessionIcon } from "@/lib/data/icons";

const f = {
  display: "'Cinzel', serif",
  body: "'Crimson Text', serif",
  mono: "'JetBrains Mono', monospace",
};

const PROFESSION_EMOJI_FALLBACK: Record<string, string> = {
  Soldier: "⚔️",
  Knight: "🛡️",
  Archer: "🏹",
  Mage: "🔮",
  Farmer: "🌾",
  Captain: "🎖️",
  Worker: "⚒️",
};

const BEHAVIOR_LABELS: Record<string, string> = {
  idle: "Holding Position",
  patrol: "Patrolling",
  combat: "Engaging Enemy",
  harvest: "Gathering",
  return_to_camp: "Returning to Camp",
  follow: "Following Player",
  go_home: "Heading Home",
  sleep: "Sleeping",
};

type AllyTab = "status" | "commands" | "equipment" | "tasks";

function StatRow({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "6px 10px",
      background: "linear-gradient(135deg, #1e1510, #160e08)",
      border: "1px solid #3a2a1a", borderRadius: 6,
    }}>
      <span style={{ fontSize: 11, color: "#9b7d52", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color }}>{icon}</span>{label}
      </span>
      <span style={{ fontSize: 12, fontFamily: f.mono, color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: f.display, fontSize: 12, color: "#d4a400",
      letterSpacing: 1.5, textTransform: "uppercase",
      borderBottom: "1px solid #c9950a55", paddingBottom: 4, marginTop: 14, marginBottom: 8,
    }}>{children}</div>
  );
}

function StatusTab({ ally }: { ally: AllyData }) {
  const xpPct = ally.level >= MAX_ALLY_LEVEL ? 100 : Math.min(100, (ally.xp / Math.max(1, ally.xpToNext)) * 100);
  const hpPct = Math.min(100, (ally.health / Math.max(1, ally.maxHealth)) * 100);

  return (
    <div>
      <SectionTitle>Vitals</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
        <StatRow label="Health" value={`${Math.round(ally.health)} / ${ally.maxHealth}`} color="#d44040" icon="❤" />
        <StatRow label="Damage" value={ally.damage} color="#ff8b95" icon="⚔" />
        <StatRow label="Range" value={ally.attackRange.toFixed(1)} color="#84b2ff" icon="↗" />
        <StatRow label="Speed" value={ally.speed.toFixed(1)} color="#ffd56a" icon="💨" />
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9b7d52", marginBottom: 3 }}>
          <span>Health</span>
          <span style={{ fontFamily: f.mono }}>{Math.round(ally.health)}/{ally.maxHealth}</span>
        </div>
        <div style={{ height: 8, background: "#1a0f08", border: "1px solid #3a2a1a", borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${hpPct}%`,
            background: hpPct > 50 ? "linear-gradient(90deg, #4a7a30, #6ec96e)" : "linear-gradient(90deg, #8b2020, #d44040)",
          }} />
        </div>
      </div>

      <SectionTitle>Progression</SectionTitle>
      <div style={{
        padding: 10, background: "linear-gradient(135deg, #1e1510, #160e08)",
        border: "1px solid #c9950a44", borderRadius: 8,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontFamily: f.display, fontSize: 14, color: "#d4a400" }}>Level {ally.level}</span>
          <span style={{ fontFamily: f.mono, fontSize: 11, color: "#9b7d52" }}>
            {ally.level >= MAX_ALLY_LEVEL ? "MAX" : `${ally.xp} / ${ally.xpToNext} XP`}
          </span>
        </div>
        <div style={{ height: 6, background: "#1a0f08", border: "1px solid #3a2a1a", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${xpPct}%`,
            background: "linear-gradient(90deg, #c9950a, #ffd56a)",
          }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
          <StatRow label="Kills" value={ally.kills} color="#ff8b95" icon="💀" />
          <StatRow label="Gathered" value={ally.resourcesGathered} color="#6ec96e" icon="🌾" />
        </div>
      </div>

      <SectionTitle>Status</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <StatRow
          label="Behavior"
          value={BEHAVIOR_LABELS[ally.behavior] || ally.behavior}
          color="#49de95"
          icon="●"
        />
        <StatRow
          label="Sleeping"
          value={ally.isSleeping ? "Yes 😴" : "No"}
          color={ally.isSleeping ? "#84b2ff" : "#9b7d52"}
          icon={ally.isSleeping ? "🌙" : "☀"}
        />
      </div>
    </div>
  );
}

function CommandsTab({ ally }: { ally: AllyData }) {
  const setPersonalCommand = useAllies(s => s.setPersonalCommand);
  const setHomePosition = useAllies(s => s.setHomePosition);
  const playerPos = useGame(s => s.playerPosition);
  const enemies = useEnemyManager(s => s.enemies);

  const commands: AllyCommand[] = ["follow", "patrol", "stay", "attack_target"];

  return (
    <div>
      <SectionTitle>Personal Orders</SectionTitle>
      <div style={{ fontSize: 10, color: "#8a7050", marginBottom: 8 }}>
        Personal orders override the global command for this unit only.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
        {commands.map(cmd => {
          const isActive = ally.personalCommand === cmd;
          return (
            <button
              key={cmd}
              onClick={() => {
                if (cmd === "attack_target") {
                  // Pick the nearest live enemy as the personal target — does NOT
                  // touch the global command (other allies stay on their orders)
                  const nearest = enemies
                    .filter(e => !e.isDying)
                    .sort((a, b) => a.position.distanceTo(ally.position) - b.position.distanceTo(ally.position))[0];
                  setPersonalCommand(ally.id, "attack_target", nearest?.id ?? null);
                } else {
                  setPersonalCommand(ally.id, cmd);
                }
              }}
              style={{
                padding: 10, cursor: "pointer", textAlign: "left",
                background: isActive
                  ? "linear-gradient(135deg, #3a4a1a, #1a2810)"
                  : "linear-gradient(135deg, #1e1510, #160e08)",
                border: `1px solid ${isActive ? "#49de95" : "#3a2a1a"}`,
                borderRadius: 8, fontFamily: f.body, color: "#f5e2c1",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{ALLY_COMMAND_ICONS[cmd]}</span>
                <span style={{ fontFamily: f.display, fontSize: 12 }}>{ALLY_COMMAND_LABELS[cmd]}</span>
              </div>
            </button>
          );
        })}
      </div>

      {ally.personalCommand && (
        <button
          onClick={() => setPersonalCommand(ally.id, null)}
          style={{
            marginTop: 8, width: "100%", padding: 8,
            background: "linear-gradient(135deg, #2a1a10, #1a0f08)",
            border: "1px solid #c9950a55", borderRadius: 6,
            color: "#d4a400", cursor: "pointer", fontFamily: f.display, fontSize: 11,
          }}
        >
          ↩ Resume Global Orders
        </button>
      )}

      <SectionTitle>Home Tent</SectionTitle>
      <div style={{ fontSize: 10, color: "#8a7050", marginBottom: 8 }}>
        At nightfall, this unit walks back to its home and sleeps until dawn.
      </div>
      <div style={{
        padding: 10, background: "linear-gradient(135deg, #1e1510, #160e08)",
        border: "1px solid #3a2a1a", borderRadius: 8,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: f.mono, color: "#9b7d52" }}>
          <span>Home</span>
          <span>X {ally.homePosition.x.toFixed(1)}, Z {ally.homePosition.z.toFixed(1)}</span>
        </div>
        <button
          onClick={() => {
            if (playerPos) setHomePosition(ally.id, playerPos);
          }}
          disabled={!playerPos}
          style={{
            marginTop: 8, width: "100%", padding: 8,
            background: "linear-gradient(135deg, #1a2810, #142008)",
            border: "1px solid #4a7a30", borderRadius: 6,
            color: "#49de95", cursor: playerPos ? "pointer" : "not-allowed",
            fontFamily: f.display, fontSize: 11, opacity: playerPos ? 1 : 0.5,
          }}
        >
          🏕 Set Home Here (at player)
        </button>
      </div>
    </div>
  );
}

function EquipmentTab({ ally }: { ally: AllyData }) {
  return (
    <div>
      <SectionTitle>Loadout</SectionTitle>
      <div style={{
        padding: 10, background: "linear-gradient(135deg, #1e1510, #160e08)",
        border: "1px solid #3a2a1a", borderRadius: 8,
      }}>
        <div style={{ fontSize: 11, color: "#f5e2c1", fontFamily: f.body }}>
          Model: <span style={{ fontFamily: f.mono, color: "#9b7d52" }}>
            {ally.modelPath.split("/").pop()?.replace(".glb", "")}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#f5e2c1", fontFamily: f.body, marginTop: 4 }}>
          Projectile: <span style={{ color: "#84b2ff" }}>{ally.projectileType}</span>
        </div>
      </div>
      <div style={{
        marginTop: 10, padding: 12, textAlign: "center",
        background: "linear-gradient(135deg, #1a1410, #0f0a05)",
        border: "1px dashed #c9950a55", borderRadius: 8,
        color: "#9b7d52", fontFamily: f.body, fontStyle: "italic", fontSize: 11,
      }}>
        Hand-equipping individual allies with weapons & armor from the camp inventory is coming soon.
        For now, units fight with the gear granted by their barracks/structure.
      </div>
    </div>
  );
}

function TasksTab({ ally }: { ally: AllyData }) {
  const isDaytime = useGame(s => s.isDaytime);
  const dayTime = useGame(s => s.dayTime);

  const schedule = useMemo(() => {
    if (ally.canHarvest) {
      return [
        { time: "Dawn (06:00)", task: "Wake up, leave home", icon: "☀" },
        { time: "Morning – Dusk", task: "Gather resources, return to camp", icon: "🌾" },
        { time: "Dusk (21:00)", task: "Walk back to home tent", icon: "🏕" },
        { time: "Night", task: "Sleep, recover stamina", icon: "🌙" },
      ];
    }
    if (ally.projectileType !== "none" || ally.damage >= 12) {
      return [
        { time: "All hours", task: "Patrol assigned area, engage hostile enemies", icon: "⚔" },
        { time: "On command", task: "Follow / Stay / Attack-target", icon: "📯" },
        { time: "When wounded", task: "Retreat & circle the target", icon: "🛡️" },
      ];
    }
    return [
      { time: "Dawn", task: "Leave home, begin daily tasks", icon: "☀" },
      { time: "Day", task: "Idle / patrol around home", icon: "🚶" },
      { time: "Night", task: "Return home and sleep", icon: "🌙" },
    ];
  }, [ally]);

  return (
    <div>
      <SectionTitle>Daily Schedule ({isDaytime ? "Daytime" : "Night"} — {(dayTime * 24).toFixed(1)}h)</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {schedule.map((s, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: 10,
            background: "linear-gradient(135deg, #1e1510, #160e08)",
            border: "1px solid #3a2a1a", borderRadius: 8,
          }}>
            <span style={{ fontSize: 18 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: f.display, fontSize: 11, color: "#d4a400" }}>{s.time}</div>
              <div style={{ fontSize: 11, color: "#f5e2c1", marginTop: 2 }}>{s.task}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AllyDetailPanel() {
  const selectedAllyId = useAllies(s => s.selectedAllyId);
  const ally = useAllies(s => s.allies.find(a => a.id === s.selectedAllyId) || null);
  const selectAlly = useAllies(s => s.selectAlly);
  const [tab, setTab] = useState<AllyTab>("status");

  if (!selectedAllyId || !ally) return null;

  const tabs: { id: AllyTab; label: string; icon: string }[] = [
    { id: "status", label: "Status", icon: "📜" },
    { id: "commands", label: "Orders", icon: "📯" },
    { id: "equipment", label: "Equipment", icon: "🎒" },
    { id: "tasks", label: "Schedule", icon: "🗓" },
  ];

  return (
    <div
      style={{
        position: "absolute", inset: 0, zIndex: 250,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
        fontFamily: f.body, color: "#f5e2c1",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) selectAlly(null); }}
    >
      <div
        style={{
          width: 540, maxWidth: "92vw", maxHeight: "88vh",
          display: "flex", flexDirection: "column",
          background: "linear-gradient(180deg, #1a100a, #110a05)",
          border: "2px solid #c9950a", borderRadius: 12,
          boxShadow: "0 12px 48px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,217,107,.1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px",
          background: "linear-gradient(90deg, #1a100a, #221710, #1a100a)",
          borderBottom: "1px solid #c9950a55", borderRadius: "10px 10px 0 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src={getProfessionIcon(ally.profession)}
              alt={ally.profession}
              style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 6, border: "1px solid #5a4020", background: "radial-gradient(circle, rgba(212,164,0,.12), transparent)" }}
              onError={(e) => {
                const span = document.createElement("span");
                span.style.fontSize = "30px";
                span.textContent = PROFESSION_EMOJI_FALLBACK[ally.profession] || "⚔";
                e.currentTarget.replaceWith(span);
              }}
            />
            <div>
              <div style={{ fontFamily: f.display, fontSize: 16, color: "#d4a400", letterSpacing: 1 }}>
                {ally.name}
              </div>
              <div style={{ fontSize: 11, color: "#9b7d52" }}>
                {ally.profession} <span style={{ color: "#3a2a1a" }}>·</span> Lv.{ally.level} <span style={{ color: "#3a2a1a" }}>·</span> <span style={{ fontFamily: f.mono, fontSize: 9, color: "#5a4a30" }}>{ally.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => selectAlly(null)}
            style={{
              padding: "4px 12px", fontSize: 14,
              background: "rgba(212,80,80,.15)", border: "1px solid rgba(212,80,80,.4)",
              borderRadius: 6, color: "#d45050", cursor: "pointer", fontWeight: 700, lineHeight: 1,
            }}
          >✕</button>
        </header>

        <nav style={{
          display: "flex", padding: "6px 8px", gap: 4,
          borderBottom: "1px solid #3a2a1a",
          background: "linear-gradient(180deg, #150c08, #110a05)",
        }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: "8px 6px", cursor: "pointer",
                background: tab === t.id
                  ? "linear-gradient(180deg, #2a1d12, #1a100a)"
                  : "transparent",
                border: tab === t.id ? "1px solid #c9950a" : "1px solid transparent",
                borderRadius: 6,
                color: tab === t.id ? "#d4a400" : "#9b7d52",
                fontFamily: f.display, fontSize: 11, letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              <span style={{ marginRight: 4 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>

        <main style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          {tab === "status" && <StatusTab ally={ally} />}
          {tab === "commands" && <CommandsTab ally={ally} />}
          {tab === "equipment" && <EquipmentTab ally={ally} />}
          {tab === "tasks" && <TasksTab ally={ally} />}
        </main>
      </div>
    </div>
  );
}
