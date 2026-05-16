/**
 * SinkingIslandSystem — authoritative state for boss-zone sinking mechanics.
 *
 * This is a data-first implementation. It tracks per-island health, sinking
 * progress, and respawn timers as pure state. No 3D rendering is done here;
 * scene components subscribe to this store to drive visual descent / fog
 * effects in a later integration pass.
 *
 * Life-cycle of a sinkable island:
 *
 *   stable  ──[damageIsland]──►  damaged  ──[health ≤ 0]──►  sinking
 *     ▲                                                           │
 *     │                                                    [sink progress = 1]
 *     │                                                           ▼
 *     └──────────────[respawn timer expired]──────────────────  sunk
 *                                                     ▲          │
 *                                              (server gate)  [resetIsland]
 *
 * Sink progression:
 *   While in "sinking" state, `tick(delta)` advances `sinkProgress` from 0→1
 *   over SINK_DURATION_S seconds.  Once it reaches 1 the state transitions to
 *   "sunk" and a respawn countdown begins (RESPAWN_DURATION_S seconds).
 *
 * Usage in a scene:
 *   const { registerIsland, tick, getSinkProgress, isSunk } = useSinkingIslands();
 *   useFrame((_, delta) => tick(delta));
 *   const pct = getSinkProgress("boss_b");  // 0..1, drive Y-offset in scene
 *
 * Usage by the world map:
 *   const sunk = useSinkingIslands(s => s.isSunk("boss_c"));
 *   // render a faded/dashed pin when sunk
 */

import { create } from "zustand";

// ─────────────────────────────────────────────────────────────────────────────

/** How many seconds it takes a sinking island to fully submerge. */
export const SINK_DURATION_S = 120;

/** How many seconds until a fully-sunk island respawns and becomes contestable again. */
export const RESPAWN_DURATION_S = 300;

export type SinkState = "stable" | "damaged" | "sinking" | "sunk" | "respawning";

export interface SinkingIslandEntry {
  islandId: string;
  health: number;
  maxHealth: number;
  sinkState: SinkState;
  /** 0.0 (surface) → 1.0 (fully submerged). Drives Y-offset in scene. */
  sinkProgress: number;
  /** Seconds remaining before the island respawns (only meaningful when sunk). */
  respawnTimer: number;
  /** Unix ms timestamp when the island last finished sinking. */
  sunkAt: number | null;
}

interface SinkingIslandSystemState {
  /** Keyed by layoutId (e.g. "boss_b"). */
  islands: Map<string, SinkingIslandEntry>;

  /**
   * Register a sinkable island with the system. Safe to call multiple times;
   * subsequent calls are no-ops unless `force` is true.
   */
  registerIsland: (islandId: string, maxHealth?: number, force?: boolean) => void;

  /**
   * Apply damage to a sinkable island. If health drops to 0 and the island is
   * in "stable" or "damaged" state, it transitions to "sinking".
   */
  damageIsland: (islandId: string, amount: number) => void;

  /**
   * Immediately start the sinking sequence regardless of current health.
   * Useful for scripted events or server-driven transitions.
   */
  startSinking: (islandId: string) => void;

  /**
   * Advance all sinking/respawning islands by `delta` seconds.
   * Should be called from a useFrame or a game-loop tick.
   */
  tick: (delta: number) => void;

  /** Fully reset an island back to its stable state with full health. */
  resetIsland: (islandId: string) => void;

  /** Reset all registered islands. */
  resetAll: () => void;

  getIsland: (islandId: string) => SinkingIslandEntry | undefined;

  /** Returns true if the island is currently fully submerged. */
  isSunk: (islandId: string) => boolean;

  /**
   * Returns a 0..1 progress value:
   *   - 0 when stable/damaged
   *   - 0→1 while sinking
   *   - 1 when sunk or respawning
   *   - Interpolates back to 0 during respawn for a rising-back-up feel
   */
  getSinkProgress: (islandId: string) => number;
}

// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MAX_HEALTH = 500;

function makeEntry(
  islandId: string,
  maxHealth: number = DEFAULT_MAX_HEALTH
): SinkingIslandEntry {
  return {
    islandId,
    health: maxHealth,
    maxHealth,
    sinkState: "stable",
    sinkProgress: 0,
    respawnTimer: 0,
    sunkAt: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export const useSinkingIslands = create<SinkingIslandSystemState>()((set, get) => ({
  islands: new Map<string, SinkingIslandEntry>(),

  // ── Register ─────────────────────────────────────────────────────────────

  registerIsland: (islandId, maxHealth = DEFAULT_MAX_HEALTH, force = false) => {
    set((s) => {
      if (!force && s.islands.has(islandId)) return s;
      const updated = new Map(s.islands);
      updated.set(islandId, makeEntry(islandId, maxHealth));
      return { islands: updated };
    });
  },

  // ── Damage ───────────────────────────────────────────────────────────────

  damageIsland: (islandId, amount) => {
    set((s) => {
      const entry = s.islands.get(islandId);
      if (!entry) return s;
      if (entry.sinkState === "sinking" || entry.sinkState === "sunk" || entry.sinkState === "respawning") {
        return s; // already past the point of damage
      }
      const newHealth = Math.max(0, entry.health - amount);
      const newState: SinkState =
        newHealth <= 0
          ? "sinking"
          : newHealth < entry.maxHealth * 0.5
          ? "damaged"
          : "stable";

      const updated = new Map(s.islands);
      updated.set(islandId, { ...entry, health: newHealth, sinkState: newState });
      return { islands: updated };
    });
  },

  // ── Force sink ───────────────────────────────────────────────────────────

  startSinking: (islandId) => {
    set((s) => {
      const entry = s.islands.get(islandId);
      if (!entry) return s;
      if (entry.sinkState === "sinking" || entry.sinkState === "sunk") return s;
      const updated = new Map(s.islands);
      updated.set(islandId, { ...entry, health: 0, sinkState: "sinking" });
      return { islands: updated };
    });
  },

  // ── Tick ─────────────────────────────────────────────────────────────────

  tick: (delta) => {
    set((s) => {
      let changed = false;
      const updated = new Map(s.islands);

      for (const [id, entry] of updated) {
        if (entry.sinkState === "sinking") {
          const newProgress = Math.min(1, entry.sinkProgress + delta / SINK_DURATION_S);
          if (newProgress >= 1) {
            // Fully submerged — transition to sunk and start respawn timer
            updated.set(id, {
              ...entry,
              sinkProgress: 1,
              sinkState: "sunk",
              respawnTimer: RESPAWN_DURATION_S,
              sunkAt: Date.now(),
            });
          } else {
            updated.set(id, { ...entry, sinkProgress: newProgress });
          }
          changed = true;
        } else if (entry.sinkState === "sunk") {
          const newTimer = entry.respawnTimer - delta;
          if (newTimer <= 0) {
            // Timer expired — begin respawning (rising back up)
            updated.set(id, {
              ...entry,
              respawnTimer: 0,
              sinkState: "respawning",
            });
          } else {
            updated.set(id, { ...entry, respawnTimer: newTimer });
          }
          changed = true;
        } else if (entry.sinkState === "respawning") {
          // Animate the island rising back to the surface
          const newProgress = Math.max(0, entry.sinkProgress - delta / (SINK_DURATION_S * 0.5));
          if (newProgress <= 0) {
            // Fully risen — restore to stable state with full health
            updated.set(id, makeEntry(id, entry.maxHealth));
          } else {
            updated.set(id, { ...entry, sinkProgress: newProgress });
          }
          changed = true;
        }
      }

      return changed ? { islands: updated } : s;
    });
  },

  // ── Reset ────────────────────────────────────────────────────────────────

  resetIsland: (islandId) => {
    set((s) => {
      const entry = s.islands.get(islandId);
      if (!entry) return s;
      const updated = new Map(s.islands);
      updated.set(islandId, makeEntry(islandId, entry.maxHealth));
      return { islands: updated };
    });
  },

  resetAll: () => {
    set((s) => {
      const updated = new Map<string, SinkingIslandEntry>();
      for (const [id, entry] of s.islands) {
        updated.set(id, makeEntry(id, entry.maxHealth));
      }
      return { islands: updated };
    });
  },

  // ── Selectors ────────────────────────────────────────────────────────────

  getIsland: (islandId) => get().islands.get(islandId),

  isSunk: (islandId) => {
    const entry = get().islands.get(islandId);
    return entry?.sinkState === "sunk" || entry?.sinkState === "respawning";
  },

  getSinkProgress: (islandId) => {
    const entry = get().islands.get(islandId);
    if (!entry) return 0;
    if (entry.sinkState === "stable" || entry.sinkState === "damaged") return 0;
    return entry.sinkProgress; // 0→1 while sinking, 1→0 while respawning
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Convenience — pre-register all boss-zone sinkable islands on first import.
// The WorldIslandRegistry declares which islands are sinkable; we mirror that
// here so the store is populated the moment this module loads without needing
// a component to call registerIsland explicitly.
// ─────────────────────────────────────────────────────────────────────────────

import { getSinkableIslands } from "./WorldIslandRegistry";

(function autoRegister() {
  const store = useSinkingIslands.getState();
  for (const island of getSinkableIslands()) {
    store.registerIsland(island.layoutId, island.sinkableMaxHealth);
  }
})();
