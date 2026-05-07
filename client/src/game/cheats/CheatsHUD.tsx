import { useEffect, useRef, useState } from "react";
import { useCheats } from "@/lib/stores/useCheats";
import { useGame, type GamePhase } from "@/lib/stores/useGame";

/**
 * Mounted once at the App level. Owns the F8 keybinding for the
 * live-admin / dev-tools overlay and renders the floating panel
 * when `panelOpen` is true.
 *
 * This is the single dashboard for every dev surface in the game:
 *
 *  • CHEATS — fly mode, no-clip, T-pose, terrain debug overlay
 *  • TOOLS — quick-jump to Admin Panel (`phase: "admin"`), GGE level
 *    editor (`phase: "gge"`), and Controller Lab (`phase: "controller"`),
 *    plus a "Back to game" exit when you're already in one of them
 *  • STATS — live FPS (60-frame rolling avg) + frame time + current
 *    phase + scene context, so you can sanity-check perf at any time
 *
 * Why mount at App level (not per-scene): the panel needs to be
 * available on the menu, character select, tutorial island, the
 * open world, the dungeon, and the housing scene with one consistent
 * shortcut. Per-scene mounts would re-attach listeners on every
 * scene swap and risk a frame where F8 is dead during the swap.
 *
 * The HUD itself is intentionally HTML (not R3F) — it sits over the
 * canvas via a fixed-position div with a high z-index so it stays
 * legible regardless of camera, and it doesn't pay the per-frame
 * cost of running through the R3F scheduler.
 *
 * Keybindings (all skip when typing in inputs):
 *   F8  — master toggle (open + enable / close + disable)
 *   Esc — close the panel without disabling cheats (so flags stick)
 */
export default function CheatsHUD() {
  const enabled = useCheats((s) => s.enabled);
  const panelOpen = useCheats((s) => s.panelOpen);
  const flyMode = useCheats((s) => s.flyMode);
  const noClip = useCheats((s) => s.noClip);
  const debugTerrain = useCheats((s) => s.debugTerrain);
  const debugColliders = useCheats((s) => s.debugColliders);
  const debugPlayerCollider = useCheats((s) => s.debugPlayerCollider);
  const toggleEnabled = useCheats((s) => s.toggleEnabled);
  const togglePanel = useCheats((s) => s.togglePanel);
  const toggleFly = useCheats((s) => s.toggleFly);
  const toggleNoClip = useCheats((s) => s.toggleNoClip);
  const toggleDebugTerrain = useCheats((s) => s.toggleDebugTerrain);
  const toggleDebugColliders = useCheats((s) => s.toggleDebugColliders);
  const toggleDebugPlayerCollider = useCheats((s) => s.toggleDebugPlayerCollider);
  const reset = useCheats((s) => s.reset);

  const phase = useGame((s) => s.phase);
  const goToAdmin = useGame((s) => s.goToAdmin);
  const goToGGE = useGame((s) => s.goToGGE);
  const goToController = useGame((s) => s.goToController);
  const weather = useGame((s) => s.weather);
  const setWeather = useGame((s) => s.setWeather);

  /**
   * Track the last "real" (non-dev-surface) phase the user was in so
   * the "Back to game" button can return them to where they came from
   * without wiping score / progression / inventory the way `restart()`
   * does. If they were on the menu, they go back to the menu; if they
   * were mid-game, they go straight back to playing.
   */
  const lastRealPhaseRef = useRef<GamePhase>(phase);
  useEffect(() => {
    if (phase !== "admin" && phase !== "gge" && phase !== "controller") {
      lastRealPhaseRef.current = phase;
    }
  }, [phase]);
  const exitDevSurface = () => {
    const target = lastRealPhaseRef.current;
    // Don't try to restore loading/intro mid-flight — those are
    // transient phases that wouldn't survive being re-entered cold.
    const safeTarget: GamePhase =
      target === "loading" || target === "intro" ? "menu" : target;
    useGame.setState({ phase: safeTarget });
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Skip when typing — the tuner / chat / filter boxes shouldn't
      // ever swallow our shortcuts, and we shouldn't swallow theirs.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // F8 — master toggle. Opens the panel and enables cheats on
      // first press; closes the panel and disables cheats on second.
      if (e.code === "F8") {
        e.preventDefault();
        toggleEnabled();
        return;
      }

      // Esc — soft close. Hides the panel but leaves `enabled` and
      // every individual flag intact, so popping the panel back up
      // with F8 restores exactly what you had before.
      //
      // We listen in capture phase + call stopImmediatePropagation so
      // that App.tsx's Esc handler (pause / close-panel) doesn't ALSO
      // fire while the F8 panel is open. Without this, hitting Esc to
      // dismiss the panel would simultaneously toggle pause.
      if (e.code === "Escape" && panelOpen) {
        e.preventDefault();
        e.stopImmediatePropagation();
        togglePanel();
        return;
      }
    };
    // Capture phase so we run BEFORE App.tsx's bubble-phase listener.
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [toggleEnabled, togglePanel, panelOpen]);

  if (!enabled || !panelOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        zIndex: 9999,
        background: "rgba(10, 10, 12, 0.94)",
        border: "1px solid rgba(255, 196, 64, 0.55)",
        borderRadius: 6,
        padding: "10px 14px",
        color: "#f5e8c5",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 12,
        lineHeight: 1.5,
        minWidth: 280,
        maxWidth: 320,
        boxShadow: "0 6px 22px rgba(0,0,0,0.55)",
        userSelect: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: "1px solid rgba(255, 196, 64, 0.25)",
        }}
      >
        <span style={{ color: "#ffc440", fontWeight: 700, letterSpacing: 1 }}>
          ADMIN — DEV TOOLS
        </span>
        <button
          onClick={togglePanel}
          type="button"
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "#ddd",
            borderRadius: 3,
            cursor: "pointer",
            fontSize: 11,
            padding: "2px 6px",
          }}
          aria-label="Hide cheat panel"
        >
          hide
        </button>
      </div>

      <SectionLabel>Cheats</SectionLabel>
      <CheatRow
        label="Fly mode"
        hint="gravity off · Space ↑ · LCtrl ↓"
        active={flyMode}
        onToggle={toggleFly}
      />
      <CheatRow
        label="No-clip"
        hint="phase through every collider"
        active={noClip}
        onToggle={toggleNoClip}
      />
      <CheatRow
        label="Terrain debug"
        hint="raycast crosshair · ground sample · collider stats"
        active={debugTerrain}
        onToggle={toggleDebugTerrain}
      />
      <CheatRow
        label="Stream colliders"
        hint="wireframe + bbox per ground chunk · stream radius rings"
        active={debugColliders}
        onToggle={toggleDebugColliders}
      />
      <CheatRow
        label="Player collider"
        hint="wireframe of the convex hull around the player rigid body"
        active={debugPlayerCollider}
        onToggle={toggleDebugPlayerCollider}
      />

      <SectionLabel>Weather</SectionLabel>
      <ToolGrid>
        <ToolButton
          label="Clear"
          hint="bright sky · no clouds"
          active={weather === "clear"}
          onClick={() => setWeather("clear")}
        />
        <ToolButton
          label="Cloudy"
          hint="overcast · no rain"
          active={weather === "cloudy"}
          onClick={() => setWeather("cloudy")}
        />
        <ToolButton
          label="Rain"
          hint="rain overlay · darker sky"
          active={weather === "rain"}
          onClick={() => setWeather("rain")}
        />
        <ToolButton
          label="Storm"
          hint="thick clouds · rain · lightning"
          active={weather === "storm"}
          onClick={() => setWeather("storm")}
        />
      </ToolGrid>

      <SectionLabel>Tools</SectionLabel>
      <ToolGrid>
        <ToolButton
          label="Admin"
          hint="terrain · enemies · combat config"
          active={phase === "admin"}
          onClick={goToAdmin}
        />
        <ToolButton
          label="GGE Editor"
          hint="scenes · prefabs · physics"
          active={phase === "gge"}
          onClick={goToGGE}
        />
        <ToolButton
          label="Controller"
          hint="anims · controller · live rig"
          active={phase === "controller"}
          onClick={goToController}
        />
        <ToolButton
          label="Back to game"
          hint="exit current dev surface"
          active={false}
          disabled={phase !== "admin" && phase !== "gge" && phase !== "controller"}
          onClick={exitDevSurface}
        />
      </ToolGrid>

      <SectionLabel>Stats</SectionLabel>
      <PerfStats phase={phase} />

      <div
        style={{
          marginTop: 8,
          paddingTop: 6,
          borderTop: "1px solid rgba(255,255,255,0.1)",
          fontSize: 10,
          color: "#9b8e6b",
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span>F8 toggle · Esc close</span>
        <button
          onClick={reset}
          type="button"
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "#bbb",
            borderRadius: 3,
            cursor: "pointer",
            fontSize: 10,
            padding: "1px 6px",
          }}
        >
          reset
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 8,
        marginBottom: 4,
        fontSize: 10,
        letterSpacing: 1.4,
        color: "#ffc440aa",
        fontWeight: 700,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function CheatRow({
  label,
  hint,
  active,
  onToggle,
}: {
  label: string;
  hint: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      type="button"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        background: active ? "rgba(255, 196, 64, 0.16)" : "transparent",
        border: "1px solid",
        borderColor: active
          ? "rgba(255, 196, 64, 0.55)"
          : "rgba(255, 255, 255, 0.12)",
        borderRadius: 4,
        padding: "5px 8px",
        marginBottom: 4,
        cursor: "pointer",
        color: "#f5e8c5",
        fontFamily: "inherit",
        fontSize: 12,
        textAlign: "left",
      }}
      aria-pressed={active}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          borderRadius: 2,
          border: "1px solid rgba(255,196,64,0.6)",
          background: active ? "#ffc440" : "transparent",
          color: "#1a1306",
          fontSize: 11,
          fontWeight: 800,
          lineHeight: 1,
        }}
        aria-hidden
      >
        {active ? "✓" : ""}
      </span>
      <span style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 10, color: "#9b8e6b" }}>{hint}</div>
      </span>
    </button>
  );
}

function ToolGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 4,
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function ToolButton({
  label,
  hint,
  active,
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      disabled={disabled}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        background: active ? "rgba(80, 200, 120, 0.18)" : "transparent",
        border: "1px solid",
        borderColor: active
          ? "rgba(80, 200, 120, 0.55)"
          : "rgba(255, 255, 255, 0.12)",
        borderRadius: 4,
        padding: "6px 8px",
        cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? "#5e5949" : "#f5e8c5",
        opacity: disabled ? 0.45 : 1,
        fontFamily: "inherit",
        fontSize: 11,
        textAlign: "left",
      }}
      aria-pressed={active}
    >
      <span style={{ fontWeight: 700 }}>
        {label}
        {active && (
          <span style={{ color: "#7ed991", marginLeft: 6, fontSize: 9 }}>
            ● active
          </span>
        )}
      </span>
      <span style={{ fontSize: 9, color: "#9b8e6b" }}>{hint}</span>
    </button>
  );
}

/**
 * Lightweight rAF-driven FPS counter. Kept self-contained so it
 * doesn't need to live inside the R3F Canvas — the panel is HTML
 * and we want it to keep updating even when the camera is paused
 * (e.g. during the GGE editor's static viewport).
 *
 * Rolling 60-sample average smooths out hitches without hiding
 * sustained framerate drops. We update the visible label twice a
 * second so the digits stay readable.
 */
function PerfStats({ phase }: { phase: GamePhase }) {
  const [fps, setFps] = useState(0);
  const [frameMs, setFrameMs] = useState(0);
  const samplesRef = useRef<number[]>([]);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      const samples = samplesRef.current;
      samples.push(delta);
      if (samples.length > 60) samples.shift();
      // Throttle React updates to 2 Hz so the digits don't strobe.
      if (now - lastUpdateRef.current > 500) {
        lastUpdateRef.current = now;
        const avg = samples.reduce((s, x) => s + x, 0) / samples.length;
        setFrameMs(avg);
        setFps(avg > 0 ? 1000 / avg : 0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Color-code the FPS the same way browser devtools does so the
  // user can read the health at a glance: green = solid 60+, amber
  // = 30-60, red = below 30.
  const fpsColor = fps >= 55 ? "#7ed991" : fps >= 28 ? "#ffc440" : "#ff6b6b";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        rowGap: 2,
        columnGap: 8,
        fontSize: 11,
        background: "rgba(255,255,255,0.03)",
        padding: "5px 8px",
        borderRadius: 4,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <span style={{ color: "#9b8e6b" }}>FPS</span>
      <span style={{ color: fpsColor, fontWeight: 700 }}>
        {fps.toFixed(0)}{" "}
        <span style={{ color: "#9b8e6b", fontWeight: 400 }}>
          ({frameMs.toFixed(1)} ms)
        </span>
      </span>
      <span style={{ color: "#9b8e6b" }}>Phase</span>
      <span style={{ color: "#f5e8c5" }}>{phase}</span>
    </div>
  );
}
