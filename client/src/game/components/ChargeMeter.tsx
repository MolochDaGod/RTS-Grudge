import { useChargeHud, CHARGE_TIER_1_MS, CHARGE_TIER_2_MS } from "@/lib/stores/useChargeHud";

const TIER_1_COLOR = "#4488ff";
const TIER_2_COLOR = "#ffaa44";
const SEGMENT_WIDTH = 68;
const SEGMENT_HEIGHT = 8;
const SEGMENT_GAP = 4;

const SEGMENT_2_START_MS = CHARGE_TIER_1_MS;
const SEGMENT_2_RANGE_MS = CHARGE_TIER_2_MS - CHARGE_TIER_1_MS;

export default function ChargeMeter() {
  const active = useChargeHud((s) => s.active);
  const holdMs = useChargeHud((s) => s.holdMs);
  const tier = useChargeHud((s) => s.tier);

  if (!active) return null;

  // Two discrete segments. Segment 1 fills as the player approaches tier 1;
  // segment 2 only starts filling after tier 1 is reached. This makes the
  // tier-1 / tier-2 thresholds visually unambiguous.
  const seg1Pct = Math.min(1, holdMs / CHARGE_TIER_1_MS) * 100;
  const seg2Pct = Math.max(0, Math.min(1, (holdMs - SEGMENT_2_START_MS) / SEGMENT_2_RANGE_MS)) * 100;

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(50% + 28px)",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: SEGMENT_GAP,
        pointerEvents: "none",
        zIndex: 50,
        userSelect: "none",
      }}
      aria-hidden
    >
      <Segment fillPct={seg1Pct} color={TIER_1_COLOR} ready={tier >= 1} />
      <Segment fillPct={seg2Pct} color={TIER_2_COLOR} ready={tier >= 2} />
    </div>
  );
}

function Segment({ fillPct, color, ready }: { fillPct: number; color: string; ready: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        width: SEGMENT_WIDTH,
        height: SEGMENT_HEIGHT,
        background: "rgba(8, 10, 14, 0.75)",
        border: `1px solid ${ready ? color : "rgba(255,255,255,0.18)"}`,
        borderRadius: 3,
        boxShadow: ready ? `0 0 8px ${color}` : "0 1px 4px rgba(0,0,0,0.6)",
        overflow: "hidden",
        transition: "border-color 80ms linear, box-shadow 80ms linear",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: `${fillPct}%`,
          background: color,
        }}
      />
    </div>
  );
}
