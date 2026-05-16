/**
 * SinkingIslandDebugHUD — live debug panel for verifying the sinking
 * island state machine.
 *
 * Toggle with F10. Outside the Canvas (pure HTML), mounted once at the
 * GameScene level alongside HUD.
 *
 * What it shows
 *   • Per-island card: name · state badge · HP bar · sink % bar · respawn timer
 *   • Action buttons: [Damage 100] [Force Sink] [Reset]
 *   • Time-multiplier strip: 1× / 5× / 30× / 120×
 *     Writing to window.__SINKING_TIME_MULT, which SinkingIslandTicker reads.
 *   • Event log (ring buffer): captures every state transition with timestamp.
 *
 * Refresh strategy
 *   Polls useSinkingIslands.getState() at 10 Hz via setInterval. This keeps
 *   React renders at ≤10/s even while the simulation ticks at 60 fps.
 *
 * State transition coverage (verified via the action buttons)
 *   stable  ──[Damage 100 × 5]──► damaged
 *   damaged ──[Damage 100 × n]──► sinking   (health reaches 0)
 *   sinking ──[tick × n]────────► sunk       (sink progress → 1.0)
 *   sunk    ──[tick × n]────────► respawning (respawn timer expires)
 *   respawning ──[tick × n]─────► stable     (rises back to surface)
 *   any     ──[Force Sink]──────► sinking    (scripted / server event)
 *   any     ──[Reset]──────────► stable     (admin reset)
 */

import { useEffect, useRef, useState } from "react";
import {
  useSinkingIslands,
  type SinkingIslandEntry,
  type SinkState,
  SINK_DURATION_S,
  RESPAWN_DURATION_S,
} from "@/game/world/SinkingIslandSystem";
import { WORLD_ISLANDS } from "@/game/world/WorldIslandRegistry";

// ─────────────────────────────────────────────────────────────────────────────

const TIME_MULT_OPTIONS = [1, 5, 30, 120] as const;
type TimeMult = (typeof TIME_MULT_OPTIONS)[number];

const STATE_COLOR: Record<SinkState, string> = {
  stable:     "#44cc44",
  damaged:    "#ffcc00",
  sinking:    "#ff7700",
  sunk:       "#aa44cc",
  respawning: "#4499ff",
};

const STATE_LABEL: Record<SinkState, string> = {
  stable:     "STABLE",
  damaged:    "DAMAGED",
  sinking:    "SINKING",
  sunk:       "SUNK",
  respawning: "RISING",
};

interface IslandSnapshot extends SinkingIslandEntry {
  displayName: string;
}

interface LogEntry {
  ts: string;
  layoutId: string;
  from: SinkState;
  to: SinkState;
}

const POLL_HZ = 10;
const MAX_LOG = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function ts(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${Math.floor(now.getMilliseconds() / 100)}`;
}

function fmt(seconds: number): string {
  if (seconds <= 0) return "0.0s";
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${seconds.toFixed(1)}s`;
}

/** Compute estimated real-time remaining based on current progress. */
function estimateRemaining(entry: SinkingIslandEntry): string {
  if (entry.sinkState === "sinking") {
    const remaining = (1 - entry.sinkProgress) * SINK_DURATION_S;
    return `sinks in ~${fmt(remaining)}`;
  }
  if (entry.sinkState === "sunk") {
    return `respawns in ${fmt(entry.respawnTimer)}`;
  }
  if (entry.sinkState === "respawning") {
    const remaining = entry.sinkProgress * (SINK_DURATION_S * 0.5);
    return `rises in ~${fmt(remaining)}`;
  }
  if (entry.sinkState === "damaged") {
    const hpPct = entry.health / entry.maxHealth;
    return `${(hpPct * 100).toFixed(0)}% HP remaining`;
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function MiniBar({
  value,
  max,
  color,
  height = 5,
}: {
  value: number;
  max: number;
  color: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div
      style={{
        background: "#1a1a1a",
        borderRadius: 2,
        height,
        width: "100%",
        overflow: "hidden",
        border: "1px solid #333",
      }}
    >
      <div
        style={{
          width: `${pct * 100}%`,
          height: "100%",
          background: color,
        }}
      />
    </div>
  );
}

function StateBadge({ state }: { state: SinkState }) {
  const color = STATE_COLOR[state];
  const isActive = state === "sinking" || state === "respawning";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 5px",
        borderRadius: 3,
        background: color + "22",
        border: `1px solid ${color}88`,
        color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        animation: isActive ? "pulse 1s ease-in-out infinite" : undefined,
      }}
    >
      {STATE_LABEL[state]}
    </span>
  );
}

function ActionBtn({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: color + "22",
        border: `1px solid ${color}66`,
        color,
        borderRadius: 3,
        padding: "2px 7px",
        fontSize: 10,
        cursor: "pointer",
        fontFamily: "monospace",
      }}
    >
      {label}
    </button>
  );
}

function IslandCard({
  entry,
  onDamage,
  onForceSink,
  onReset,
}: {
  entry: IslandSnapshot;
  onDamage: () => void;
  onForceSink: () => void;
  onReset: () => void;
}) {
  const color = STATE_COLOR[entry.sinkState];
  const remaining = estimateRemaining(entry);

  return (
    <div
      style={{
        border: `1px solid ${color}44`,
        borderRadius: 5,
        padding: "7px 9px",
        marginBottom: 6,
        background: "#0d0d0d",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 5,
        }}
      >
        <div>
          <span style={{ color: "#ddd", fontSize: 11, fontWeight: 700 }}>
            {entry.displayName}
          </span>
          <span style={{ color: "#555", fontSize: 9, marginLeft: 5 }}>
            [{entry.islandId}]
          </span>
        </div>
        <StateBadge state={entry.sinkState} />
      </div>

      {/* HP bar */}
      <div style={{ marginBottom: 3 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 9,
            color: "#888",
            marginBottom: 1,
          }}
        >
          <span>HP</span>
          <span>
            {entry.health}/{entry.maxHealth}
          </span>
        </div>
        <MiniBar
          value={entry.health}
          max={entry.maxHealth}
          color={STATE_COLOR.damaged}
        />
      </div>

      {/* Sink progress bar */}
      <div style={{ marginBottom: 5 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 9,
            color: "#888",
            marginBottom: 1,
          }}
        >
          <span>SINK</span>
          <span>{(entry.sinkProgress * 100).toFixed(1)}%</span>
        </div>
        <MiniBar
          value={entry.sinkProgress}
          max={1}
          color={STATE_COLOR.sinking}
          height={4}
        />
      </div>

      {/* Status line */}
      {remaining && (
        <div style={{ fontSize: 9, color: color + "bb", marginBottom: 5 }}>
          {remaining}
        </div>
      )}

      {/* Respawn timer when sunk */}
      {entry.sinkState === "sunk" && entry.respawnTimer > 0 && (
        <div style={{ marginBottom: 5 }}>
          <MiniBar
            value={entry.respawnTimer}
            max={RESPAWN_DURATION_S}
            color={STATE_COLOR.respawning}
            height={3}
          />
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 4 }}>
        <ActionBtn
          label="Damage 100"
          color={STATE_COLOR.damaged}
          onClick={onDamage}
        />
        <ActionBtn
          label="Force Sink"
          color={STATE_COLOR.sinking}
          onClick={onForceSink}
        />
        <ActionBtn
          label="Reset"
          color={STATE_COLOR.stable}
          onClick={onReset}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main HUD component
// ─────────────────────────────────────────────────────────────────────────────

export default function SinkingIslandDebugHUD() {
  const [open, setOpen] = useState(false);
  const [timeMult, setTimeMult] = useState<TimeMult>(1);
  const [snapshots, setSnapshots] = useState<IslandSnapshot[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const prevStatesRef = useRef<Map<string, SinkState>>(new Map());

  // Build a display-name lookup from the world island registry.
  const displayNames = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    for (const isl of WORLD_ISLANDS) {
      if (isl.isSinkable) {
        displayNames.current.set(isl.layoutId, isl.name);
      }
    }
  }, []);

  // Write time multiplier to window for SinkingIslandTicker to read.
  useEffect(() => {
    (window as any).__SINKING_TIME_MULT = timeMult;
    return () => {
      (window as any).__SINKING_TIME_MULT = 1;
    };
  }, [timeMult]);

  // F10 toggle.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      if (e.code === "F10") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, []);

  // 10 Hz polling loop: snapshot the store, detect state changes.
  useEffect(() => {
    if (!open) return;

    const poll = () => {
      const { islands } = useSinkingIslands.getState();
      const newSnapshots: IslandSnapshot[] = [];
      const newEvents: LogEntry[] = [];

      for (const [id, entry] of islands) {
        const name = displayNames.current.get(id) ?? id;
        newSnapshots.push({ ...entry, displayName: name });

        // Detect state transition.
        const prev = prevStatesRef.current.get(id);
        if (prev !== undefined && prev !== entry.sinkState) {
          newEvents.push({
            ts: ts(),
            layoutId: id,
            from: prev,
            to: entry.sinkState,
          });
        }
        prevStatesRef.current.set(id, entry.sinkState);
      }

      setSnapshots(newSnapshots);

      if (newEvents.length > 0) {
        setLog((prev) => {
          const combined = [...newEvents.reverse(), ...prev];
          return combined.slice(0, MAX_LOG);
        });
      }
    };

    const id = setInterval(poll, 1000 / POLL_HZ);
    poll(); // immediate first read
    return () => clearInterval(id);
  }, [open]);

  if (!open) {
    return (
      <div
        onClick={() => setOpen(true)}
        title="Open Sinking Island Debug (F10)"
        style={{
          position: "fixed",
          bottom: 8,
          right: 8,
          zIndex: 9998,
          background: "rgba(10,10,15,0.85)",
          border: "1px solid #333",
          borderRadius: 4,
          padding: "3px 8px",
          color: "#555",
          fontFamily: "monospace",
          fontSize: 10,
          cursor: "pointer",
        }}
      >
        ⛰ SINK [F10]
      </div>
    );
  }

  const actions = {
    damage: (id: string) => useSinkingIslands.getState().damageIsland(id, 100),
    sink: (id: string) => useSinkingIslands.getState().startSinking(id),
    reset: (id: string) => useSinkingIslands.getState().resetIsland(id),
    resetAll: () => useSinkingIslands.getState().resetAll(),
  };

  return (
    <>
      {/* Pulse animation for active states */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          bottom: 8,
          right: 8,
          zIndex: 9998,
          width: 280,
          maxHeight: "85vh",
          overflowY: "auto",
          background: "rgba(8, 8, 12, 0.96)",
          border: "1px solid rgba(255,196,64,0.35)",
          borderRadius: 6,
          padding: "10px 12px",
          color: "#f5e8c5",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11,
          boxShadow: "0 6px 24px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
            paddingBottom: 6,
            borderBottom: "1px solid rgba(255,196,64,0.2)",
          }}
        >
          <span style={{ color: "#aa66ff", fontWeight: 700, letterSpacing: 1, fontSize: 11 }}>
            ⛰ SINKING ISLANDS
          </span>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: "transparent",
              border: "1px solid #333",
              color: "#888",
              borderRadius: 3,
              cursor: "pointer",
              fontSize: 10,
              padding: "2px 6px",
            }}
          >
            F10 close
          </button>
        </div>

        {/* Time multiplier */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: "#666", marginBottom: 3 }}>
            SIM SPEED (window.__SINKING_TIME_MULT)
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {TIME_MULT_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => setTimeMult(m)}
                style={{
                  flex: 1,
                  background:
                    timeMult === m
                      ? "rgba(170,102,255,0.25)"
                      : "rgba(255,255,255,0.04)",
                  border:
                    timeMult === m
                      ? "1px solid #aa66ff"
                      : "1px solid #333",
                  color: timeMult === m ? "#aa66ff" : "#888",
                  borderRadius: 3,
                  padding: "3px 0",
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "monospace",
                }}
              >
                {m}×
              </button>
            ))}
          </div>
          <div style={{ fontSize: 9, color: "#555", marginTop: 3 }}>
            At 120×: sink in ~1s · respawn in ~2.5s
          </div>
        </div>

        {/* Island cards */}
        <div style={{ marginBottom: 6 }}>
          {snapshots.length === 0 ? (
            <div style={{ color: "#444", fontSize: 10, textAlign: "center", padding: 12 }}>
              No sinkable islands registered.
              <br />
              <span style={{ fontSize: 9 }}>
                Are you in the main game scene?
              </span>
            </div>
          ) : (
            snapshots.map((snap) => (
              <IslandCard
                key={snap.islandId}
                entry={snap}
                onDamage={() => actions.damage(snap.islandId)}
                onForceSink={() => actions.sink(snap.islandId)}
                onReset={() => actions.reset(snap.islandId)}
              />
            ))
          )}
        </div>

        {/* Global reset */}
        <button
          onClick={actions.resetAll}
          style={{
            width: "100%",
            background: "rgba(68,204,68,0.1)",
            border: "1px solid rgba(68,204,68,0.4)",
            color: "#44cc44",
            borderRadius: 4,
            padding: "4px 0",
            fontSize: 10,
            cursor: "pointer",
            fontFamily: "monospace",
            marginBottom: 8,
          }}
        >
          Reset All Islands
        </button>

        {/* Transition log */}
        <div>
          <div
            style={{
              fontSize: 9,
              color: "#555",
              marginBottom: 4,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>STATE TRANSITIONS</span>
            <span
              style={{ cursor: "pointer", color: "#444" }}
              onClick={() => setLog([])}
            >
              clear
            </span>
          </div>
          <div
            style={{
              background: "#070709",
              borderRadius: 3,
              padding: "4px 6px",
              maxHeight: 140,
              overflowY: "auto",
              border: "1px solid #1a1a1a",
            }}
          >
            {log.length === 0 ? (
              <div style={{ color: "#333", fontSize: 9 }}>
                No transitions yet. Use action buttons above.
              </div>
            ) : (
              log.map((e, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 9,
                    color: "#888",
                    borderBottom: "1px solid #111",
                    paddingBottom: 2,
                    marginBottom: 2,
                  }}
                >
                  <span style={{ color: "#555" }}>{e.ts} </span>
                  <span style={{ color: "#aaa" }}>{e.layoutId} </span>
                  <span style={{ color: STATE_COLOR[e.from] }}>{STATE_LABEL[e.from]}</span>
                  <span style={{ color: "#555" }}> → </span>
                  <span style={{ color: STATE_COLOR[e.to] }}>
                    {STATE_LABEL[e.to]}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Keyboard hint */}
        <div style={{ fontSize: 9, color: "#333", marginTop: 6, textAlign: "center" }}>
          F10 toggle · ticker: SinkingIslandTicker inside Canvas
        </div>
      </div>
    </>
  );
}
