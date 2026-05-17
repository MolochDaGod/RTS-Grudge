/**
 * useWorldEvents — runtime state for active world events.
 *
 * Checked every 60 seconds by FactionHeroes.tsx (same interval as hero
 * daily cycle advancement). When a world event's triggerHour matches the
 * current UTC hour AND it hasn't been triggered today, it becomes active.
 *
 * Active events drive gameplay changes:
 *   FactionInvasion  → WaveSpawner multiplies enemy count (reads from store)
 *   StormEvent       → immediately sets useGame.weather = "storm"
 *   ResourceBoom     → ResourceNode yield multiplier (reads from store)
 *   TreasureSpawn    → adds a special waypoint on the world map
 *   BossEmergence    → spawned by FactionHeroes if player is in zone
 *
 * Persistence: lastTriggeredDay per event in localStorage so repeatable
 * events fire once per real day, not every 60-second tick that lands on
 * the right hour.
 */

import { create } from "zustand";
import {
  ALL_WORLD_EVENTS,
  type WorldEventDef,
  type WorldEventType,
} from "@/game/world/WorldEventRegistry";
import { useGame } from "./useGame";

// ─────────────────────────────────────────────────────────────────────────────

export interface ActiveWorldEvent {
  id: string;
  def: WorldEventDef;
  startedAt: number;    // Date.now()
  endsAt:    number;    // Date.now() + durationMs
}

const LS_KEY = "grudge_world_events";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function loadTriggeredDays(): Map<string, string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw) as Record<string, string>));
  } catch { return new Map(); }
}

function saveTriggeredDays(map: Map<string, string>) {
  try {
    const obj: Record<string, string> = {};
    for (const [k, v] of map) obj[k] = v;
    localStorage.setItem(LS_KEY, JSON.stringify(obj));
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────

interface WorldEventsState {
  active: ActiveWorldEvent[];
  /** lastTriggeredDay per event id — prevents double-firing within the same UTC hour. */
  triggeredDays: Map<string, string>;

  /** Called every 60 seconds. Activates eligible events, expires finished ones. */
  tick: () => void;

  /** Resolve a StormEvent early (player rode it out). */
  resolveEvent: (id: string) => void;

  /** Returns true if any active event matches the given type. */
  hasActiveEvent: (type: WorldEventType) => boolean;

  /**
   * Resource yield multiplier for the current active state.
   * ResourceBoom events double yields; multiple overlapping events stack.
   */
  resourceYieldMult: () => number;

  /**
   * Enemy spawn interval multiplier (< 1 = more frequent).
   * FactionInvasion events push this to 0.33 (triple rate).
   */
  enemySpawnMult: () => number;
}

// ─────────────────────────────────────────────────────────────────────────────

export const useWorldEvents = create<WorldEventsState>()((set, get) => ({
  active: [],
  triggeredDays: loadTriggeredDays(),

  tick: () => {
    const now  = Date.now();
    const hour = new Date().getUTCHours();
    const today = todayStr();

    const state = get();
    let nextActive = state.active.filter((e) => e.endsAt > now); // expire done events
    const newTriggered = new Map(state.triggeredDays);
    let changed = false;

    for (const def of ALL_WORLD_EVENTS) {
      // Already active — skip
      if (nextActive.some((a) => a.id === def.id)) continue;
      // Already triggered today
      if (newTriggered.get(def.id) === today) continue;
      // Not the right hour
      if (def.triggerHour !== hour) continue;

      // Activate
      const durationMs = def.durationMinutes * 60 * 1000;
      nextActive = [...nextActive, { id: def.id, def, startedAt: now, endsAt: now + durationMs }];
      newTriggered.set(def.id, today);
      changed = true;

      // Storm events immediately change weather
      if (def.type === "StormEvent") {
        useGame.getState().setWeather("storm", 1.0);
      }

      console.info(`[WorldEvents] Event started: ${def.title}`);
    }

    // Restore clear weather when all storm events have expired
    const hadStorm = state.active.some((e) => e.def.type === "StormEvent");
    const hasStorm = nextActive.some((e) => e.def.type === "StormEvent");
    if (hadStorm && !hasStorm) {
      useGame.getState().setWeather("clear", 0);
    }

    if (changed || nextActive.length !== state.active.length) {
      saveTriggeredDays(newTriggered);
      set({ active: nextActive, triggeredDays: newTriggered });
    }
  },

  resolveEvent: (id) => {
    const now = Date.now();
    set((s) => {
      const updated = s.active.filter((e) => e.id !== id);
      const hadStorm = s.active.some((e) => e.id === id && e.def.type === "StormEvent");
      if (hadStorm && !updated.some((e) => e.def.type === "StormEvent")) {
        useGame.getState().setWeather("clear", 0);
      }
      return { active: updated };
    });
  },

  hasActiveEvent: (type) => {
    return get().active.some((e) => e.def.type === type);
  },

  resourceYieldMult: () => {
    const booms = get().active.filter((e) => e.def.type === "ResourceBoom");
    if (booms.length === 0) return 1.0;
    return booms.reduce((acc) => acc * 2.0, 1.0);
  },

  enemySpawnMult: () => {
    const invasions = get().active.filter((e) => e.def.type === "FactionInvasion");
    if (invasions.length === 0) return 1.0;
    return 1 / (3 * invasions.length);  // triple spawn rate = 0.33x interval
  },
}));
