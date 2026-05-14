import { useEffect, useRef } from "react";
import { useDialog } from "@/lib/stores/useDialog";

const COLORS = {
  panel: "rgba(12, 8, 5, 0.96)",
  border: "#c5a059",
  borderDim: "rgba(197, 160, 89, 0.45)",
  text: "#f3eada",
  speaker: "#e8c868",
  hint: "#9a8868",
  hintAccent: "#e8c868",
};

export default function DialogPanel() {
  const active = useDialog((s) => s.active);
  const speakerName = useDialog((s) => s.speakerName);
  const lines = useDialog((s) => s.lines);
  const index = useDialog((s) => s.index);
  const revealedChars = useDialog((s) => s.revealedChars);
  const tickReveal = useDialog((s) => s.tickReveal);
  const next = useDialog((s) => s.next);
  const close = useDialog((s) => s.close);
  const open = useDialog((s) => s.open);

  // Typewriter ticking via rAF.
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!active) return;
    lastTimeRef.current = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      tickReveal(dt);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, tickReveal]);

  // Global keys: T = talk/advance; Escape = close.
  // Use capture + stopImmediatePropagation when active so other panels
  // (settings, build mode, etc.) don't react to the same Esc/T press.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyT") {
        const state = useDialog.getState();
        if (state.active) {
          e.preventDefault();
          e.stopImmediatePropagation();
          state.next();
        } else if (state.nearby) {
          e.preventDefault();
          e.stopImmediatePropagation();
          open(state.nearby.npcId);
        }
      } else if (e.code === "Escape") {
        const state = useDialog.getState();
        if (state.active) {
          e.preventDefault();
          e.stopImmediatePropagation();
          state.close();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (!active) return null;

  const fullLine = lines[index]?.text ?? "";
  const shown = fullLine.slice(0, Math.floor(revealedChars));
  const isComplete = Math.floor(revealedChars) >= fullLine.length;
  const isLast = index >= lines.length - 1;

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 56,
        transform: "translateX(-50%)",
        width: "min(820px, 92vw)",
        zIndex: 9100,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          backgroundImage: "url(/ui/dialog_container.png)",
          backgroundSize: "100% 100%",
          backgroundColor: COLORS.panel,
          padding: "20px 28px 22px 28px",
          borderRadius: 10,
          border: `1px solid ${COLORS.borderDim}`,
          boxShadow: "0 14px 36px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.4)",
          color: COLORS.text,
          fontFamily: "'Crimson Text', 'Cinzel', Georgia, serif",
          minHeight: 140,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            marginBottom: 10,
            paddingBottom: 8,
            borderBottom: `1px solid ${COLORS.borderDim}`,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: COLORS.border,
              transform: "rotate(45deg)",
              boxShadow: "0 0 8px rgba(232,200,104,0.5)",
            }}
          />
          <div
            style={{
              fontFamily: "'Cinzel', Georgia, serif",
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: 1.2,
              color: COLORS.speaker,
              textShadow: "0 1px 0 rgba(0,0,0,0.7)",
            }}
          >
            {speakerName}
          </div>
        </div>

        <div
          aria-live="polite"
          style={{
            fontSize: 18,
            lineHeight: 1.5,
            minHeight: 56,
            color: COLORS.text,
            textShadow: "0 1px 0 rgba(0,0,0,0.7)",
            whiteSpace: "pre-wrap",
          }}
        >
          {shown}
          {!isComplete && <span style={{ opacity: 0.6 }}>▍</span>}
        </div>

        <div
          style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: `1px dashed ${COLORS.borderDim}`,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: COLORS.hint,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <div>
            <span style={{ color: COLORS.hintAccent }}>[T]</span>{" "}
            {isComplete ? (isLast ? "Farewell" : "Continue") : "Skip"}
          </div>
          <div>
            <span style={{ color: COLORS.hintAccent }}>[Esc]</span> Close
          </div>
        </div>

        <button
          type="button"
          aria-label="Close dialogue"
          onClick={close}
          style={{
            position: "absolute",
            top: 8,
            right: 10,
            background: "transparent",
            color: COLORS.hint,
            border: "none",
            fontSize: 18,
            cursor: "pointer",
            padding: "2px 6px",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

interface ProximityHintProps {
  visible: boolean;
  speakerName?: string | null;
}

export function NpcProximityHint({ visible, speakerName }: ProximityHintProps) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 220,
        transform: "translateX(-50%)",
        zIndex: 9050,
        pointerEvents: "none",
        background: "rgba(12,8,5,0.85)",
        border: "1px solid rgba(197,160,89,0.55)",
        borderRadius: 8,
        padding: "8px 14px",
        color: "#f3eada",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        letterSpacing: 1,
        textTransform: "uppercase",
        boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
      }}
    >
      <span style={{ color: "#e8c868", fontWeight: 700 }}>[T]</span>{" "}
      Talk{speakerName ? <> to <span style={{ color: "#e8c868" }}>{speakerName}</span></> : null}
    </div>
  );
}
