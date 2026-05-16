/**
 * SinkingIslandTicker — R3F component that drives the sinking simulation.
 *
 * Must be mounted INSIDE a Canvas. Uses `useFrame` so the tick is tied to
 * the render loop's delta time rather than a separate rAF, giving exact
 * frame-budget-aware timing with no drift.
 *
 * Design constraints
 *   - No-ops during menu/loading/intro phases so the clocks are paused
 *     until actual gameplay begins.
 *   - Caps the raw delta at 100 ms (skips huge steps on tab-return /
 *     resize events that stall the render loop).
 *   - Supports debug fast-forward through `window.__SINKING_TIME_MULT`
 *     (written by SinkingIslandDebugHUD). Default 1 = real time.
 *
 * Mounting
 *   Place once inside the main game Canvas, alongside WaveSpawner etc.
 *   Does NOT need to be inside the same Canvas as the boss-zone 3D scene;
 *   the Zustand store is global. The training-island and sailing Canvases
 *   don't need it because time progression only matters in open-world mode.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useSinkingIslands } from "@/game/world/SinkingIslandSystem";
import { useGame } from "@/lib/stores/useGame";

/** Phases in which sinking should be frozen. */
const PAUSED_PHASES = new Set(["menu", "loading", "intro"]);

/** Hard cap on delta to avoid giant time-jumps on tab-restore. */
const MAX_DELTA_S = 0.1;

export default function SinkingIslandTicker() {
  const lastPhaseRef = useRef<string>("");

  useFrame((_, delta) => {
    const phase = useGame.getState().phase;

    // Freeze clocks during non-gameplay phases.
    if (PAUSED_PHASES.has(phase)) {
      if (lastPhaseRef.current !== phase) {
        console.debug("[SinkingIslands] tick PAUSED — phase:", phase);
        lastPhaseRef.current = phase;
      }
      return;
    }

    // Log the first tick of each new active phase (useful for state verification).
    if (lastPhaseRef.current !== phase) {
      console.debug("[SinkingIslands] tick ACTIVE — phase:", phase);
      lastPhaseRef.current = phase;
    }

    // Debug fast-forward: setting window.__SINKING_TIME_MULT to e.g. 30
    // makes 120-second sink complete in 4 real seconds.
    const rawMult =
      typeof window !== "undefined"
        ? ((window as any).__SINKING_TIME_MULT ?? 1)
        : 1;
    const mult = Math.max(1, Math.min(1000, Number(rawMult) || 1));

    const effectiveDelta = Math.min(delta, MAX_DELTA_S) * mult;
    useSinkingIslands.getState().tick(effectiveDelta);
  });

  return null;
}
