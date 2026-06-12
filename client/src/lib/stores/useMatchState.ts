/**
 * useMatchState — in-match RTS/MOBA stat tracker.
 *
 * Tracks per-team kills / towers destroyed / gold and the elapsed match
 * timer. Drives the MatchHUD scoreboard.  Server events (socket messages,
 * kill-feed notifications, economy ticks) call the actions here; the HUD
 * subscribes reactively.
 */
import { create } from "zustand";

export type MatchTeam = "red" | "blue";
export type MatchPhase = "loading" | "active" | "ended";

export interface TeamStats {
  kills: number;
  towers: number;
  gold: number;
}

export interface MatchStateStore {
  phase: MatchPhase;
  /** Elapsed seconds since match started. */
  timer: number;
  /** 0-1 during the loading phase, then stays at 1. */
  loadProgress: number;
  red: TeamStats;
  blue: TeamStats;

  // ── Actions ─────────────────────────────────────────────────────────────
  startLoading: () => void;
  setLoadProgress: (p: number) => void;
  startMatch: () => void;
  tickTimer: () => void;
  addKill: (team: MatchTeam) => void;
  addTowerDestroyed: (team: MatchTeam) => void;
  addGold: (team: MatchTeam, amount: number) => void;
  endMatch: () => void;
  resetMatch: () => void;
}

const DEFAULT_TEAM: TeamStats = { kills: 0, towers: 0, gold: 500 };

export const useMatchState = create<MatchStateStore>((set) => ({
  phase: "loading",
  timer: 0,
  loadProgress: 0,
  red: { ...DEFAULT_TEAM },
  blue: { ...DEFAULT_TEAM },

  startLoading: () => set({ phase: "loading", loadProgress: 0 }),

  setLoadProgress: (p) => set({ loadProgress: Math.min(1, Math.max(0, p)) }),

  startMatch: () =>
    set({
      phase: "active",
      loadProgress: 1,
      timer: 0,
      red: { ...DEFAULT_TEAM },
      blue: { ...DEFAULT_TEAM },
    }),

  tickTimer: () =>
    set((s) => (s.phase === "active" ? { timer: s.timer + 1 } : {})),

  addKill: (team) =>
    set((s) => ({
      [team]: { ...s[team], kills: s[team].kills + 1 },
    })),

  addTowerDestroyed: (team) =>
    set((s) => ({
      [team]: { ...s[team], towers: s[team].towers + 1 },
    })),

  addGold: (team, amount) =>
    set((s) => ({
      [team]: { ...s[team], gold: s[team].gold + amount },
    })),

  endMatch: () => set({ phase: "ended" }),

  resetMatch: () =>
    set({
      phase: "loading",
      timer: 0,
      loadProgress: 0,
      red: { ...DEFAULT_TEAM },
      blue: { ...DEFAULT_TEAM },
    }),
}));
