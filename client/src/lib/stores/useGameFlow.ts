/**
 * useGameFlow — Reactive game flow state for the MMO.
 *
 * Wraps GameFlowStateMachine with Zustand so React components can subscribe
 * to the current rendering context and trigger transitions with validation
 * and fade effects.
 *
 * Usage:
 *   const { context, state, transition } = useGameFlow();
 *   // context = "zone_overworld" | "open_water" | "dungeon" | ...
 *   // state   = full typed state for the current context
 *   // transition({ type: "dock_travel", from: "plains", to: "forest" })
 */

import { create } from "zustand";
import {
  type RenderContext,
  type GameFlowState,
  type TransitionAction,
  type FadeConfig,
  isValidTransition,
  getTargetContext,
  TRANSITION_FADES,
  RENDER_LAYERS,
  type RenderLayerSpec,
} from "@/game/world/GameFlowStateMachine";
import type { ZoneId } from "@/game/world/WorldGridRegistry";

// ── Fade state ───────────────────────────────────────────────────────────────

export type FadePhase = "none" | "fading_out" | "hold" | "fading_in";

interface GameFlowStore {
  /** Current rendering context */
  context: RenderContext;
  /** Full typed state for the current context */
  state: GameFlowState;
  /** Render layer specification for the current context */
  layers: RenderLayerSpec;

  /** Fade overlay state for transitions */
  fadePhase: FadePhase;
  fadeColor: string;
  fadeOpacity: number;

  /** True while a transition is in progress (prevents double-transitions) */
  transitioning: boolean;

  /** Execute a game flow transition with fade animation. */
  transition: (action: TransitionAction) => void;

  /** Force-set context without fade (for initial load / debug). */
  setContext: (state: GameFlowState) => void;

  /** Get the current zone ID (null if not in a zone context). */
  getCurrentZoneId: () => ZoneId | null;
}

const INITIAL_STATE: GameFlowState = {
  context: "zone_overworld",
  zoneId: "coast",
  playerPos: { x: 0, z: 0 },
  channelId: null,
};

export const useGameFlow = create<GameFlowStore>()((set, get) => ({
  context: "zone_overworld",
  state: INITIAL_STATE,
  layers: RENDER_LAYERS.zone_overworld,
  fadePhase: "none",
  fadeColor: "#000000",
  fadeOpacity: 0,
  transitioning: false,

  transition: (action) => {
    const { context, transitioning } = get();
    if (transitioning) return;

    if (!isValidTransition(context, action.type)) {
      console.warn(`[gameflow] Invalid transition: ${context} → ${action.type}`);
      return;
    }

    const targetContext = getTargetContext(action);
    const fade = TRANSITION_FADES[action.type];

    set({ transitioning: true, fadeColor: fade.color });

    // Phase 1: Fade out
    set({ fadePhase: "fading_out", fadeOpacity: 0 });
    animateFade(0, 1, fade.fadeOutMs, (opacity) => {
      set({ fadeOpacity: opacity });
    }).then(() => {
      // Phase 2: Hold (black screen — load new scene)
      set({ fadePhase: "hold", fadeOpacity: 1 });

      const newState = buildStateForTransition(action, targetContext);
      set({
        context: targetContext,
        state: newState,
        layers: RENDER_LAYERS[targetContext],
      });

      return delay(fade.holdMs);
    }).then(() => {
      // Phase 3: Fade in
      set({ fadePhase: "fading_in" });
      return animateFade(1, 0, fade.fadeInMs, (opacity) => {
        set({ fadeOpacity: opacity });
      });
    }).then(() => {
      set({ fadePhase: "none", fadeOpacity: 0, transitioning: false });
    });
  },

  setContext: (newState) => {
    set({
      context: newState.context,
      state: newState,
      layers: RENDER_LAYERS[newState.context],
      fadePhase: "none",
      fadeOpacity: 0,
      transitioning: false,
    });
  },

  getCurrentZoneId: () => {
    const { state } = get();
    if ("zoneId" in state) return state.zoneId;
    return null;
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function animateFade(
  from: number,
  to: number,
  durationMs: number,
  onUpdate: (opacity: number) => void,
): Promise<void> {
  return new Promise(resolve => {
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease-in-out
      onUpdate(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

function buildStateForTransition(
  action: TransitionAction,
  targetContext: RenderContext,
): GameFlowState {
  switch (action.type) {
    case "dock_travel":
      return {
        context: "open_water",
        originZone: action.from,
        destinationZone: action.to,
        shipType: "sloop",
        voyageProgress: 0,
      };
    case "enter_dungeon":
      return {
        context: "dungeon",
        zoneId: action.zoneId,
        dungeonName: action.dungeonName,
        tier: action.tier,
        seed: Date.now(),
        theme: action.tier <= 2 ? "crypt" : action.tier <= 4 ? "mine" : "temple",
        returnPos: action.returnPos,
      };
    case "exit_dungeon": {
      const prev = useGameFlow.getState().state;
      const returnZone = "zoneId" in prev ? prev.zoneId : "coast";
      const returnPos = "returnPos" in prev ? (prev as any).returnPos : { x: 0, z: 0 };
      return {
        context: "zone_overworld",
        zoneId: returnZone as ZoneId,
        playerPos: returnPos,
        channelId: null,
      };
    }
    case "enter_home":
      return {
        context: "home_island",
        ownerId: action.ownerId,
        islandSeed: hashString(action.ownerId),
        biome: "temperate",
        sessionCode: null,
      };
    case "exit_home":
      return {
        context: "zone_overworld",
        zoneId: action.returnTo,
        playerPos: { x: 0, z: 0 },
        channelId: null,
      };
    case "enter_boss":
      return {
        context: "boss_arena",
        zoneId: action.zoneId,
        bossName: action.bossName,
        bossType: "demon",
        arenaCenter: { x: 0, z: 0 },
        arenaRadius: 30,
      };
    case "exit_boss": {
      const prev = useGameFlow.getState().state;
      const zone = "zoneId" in prev ? prev.zoneId : "plains";
      return {
        context: "zone_overworld",
        zoneId: zone as ZoneId,
        playerPos: { x: 0, z: 0 },
        channelId: null,
      };
    }
    case "die_respawn":
      return {
        context: "zone_overworld",
        zoneId: action.respawnZone,
        playerPos: action.respawnPos,
        channelId: null,
      };
    case "enter_tutorial":
      return { context: "tutorial_island", areaId: null };
    case "exit_tutorial":
      return {
        context: "zone_overworld",
        zoneId: action.toZone,
        playerPos: { x: 0, z: 0 },
        channelId: null,
      };
  }
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
