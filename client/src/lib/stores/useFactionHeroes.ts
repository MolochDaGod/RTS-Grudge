/**
 * useFactionHeroes — persistent world-state for all 24 faction hero agents.
 *
 * Daily life-cycle
 *   The store computes each hero's current phase from the real UTC clock:
 *     00:00 – 05:59  at_hub     (night/pre-dawn, heroes rest and accept visitors)
 *     06:00 – 06:29  outbound   (heroes depart, not visible anywhere)
 *     06:30 – 17:59  adventuring (heroes are on their assigned island)
 *     18:00 – 18:29  inbound    (heroes returning, not visible)
 *     18:30 – 23:59  at_hub     (evening, heroes debrief and give missions)
 *
 * Respawn
 *   Heroes that are killed store `isKilledToday: true` in the per-hero
 *   persisted record. At midnight UTC (day change) every hero is reset.
 *
 * Proximity
 *   FactionHeroNPC.tsx writes nearHeroId when the player walks close to a
 *   hub-stationed hero. HeroInteractionPanel.tsx reads it to open the panel
 *   when the player presses [T].
 *
 * Persistence
 *   Only kill-flags and lastRespawnDay are stored in localStorage. All other
 *   state (position, health) is re-initialised every session from the registry.
 */

import { create } from "zustand";
import * as THREE from "three";
import { ALL_HEROES, getHero } from "@/game/world/HeroRegistry";

// ─────────────────────────────────────────────────────────────────────────────

export type HeroDailyState =
  | "at_hub"       // available for missions / vendor
  | "outbound"     // travelling to adventure island (briefly invisible)
  | "adventuring"  // fighting / harvesting on their zone island
  | "inbound"      // travelling back (briefly invisible)
  | "dead";        // killed this day — respawns next calendar day

// UTC hour boundaries
const OUTBOUND_START  = 6;    // 06:00 UTC
const OUTBOUND_END    = 6.5;  // 06:30 UTC
const INBOUND_START   = 18;   // 18:00 UTC
const INBOUND_END     = 18.5; // 18:30 UTC

export function computeHeroDailyPhase(isKilledToday: boolean): HeroDailyState {
  if (isKilledToday) return "dead";
  const now = new Date();
  const h = now.getUTCHours() + now.getUTCMinutes() / 60;

  if (h >= OUTBOUND_START && h < OUTBOUND_END) return "outbound";
  if (h >= OUTBOUND_END   && h < INBOUND_START) return "adventuring";
  if (h >= INBOUND_START  && h < INBOUND_END)   return "inbound";
  return "at_hub";
}

function todayString(): string {
  return new Date().toISOString().split("T")[0]; // "2024-05-15"
}

// ─────────────────────────────────────────────────────────────────────────────
// Persisted record (saved to localStorage per hero)
// ─────────────────────────────────────────────────────────────────────────────

interface HeroPersisted {
  lastRespawnDay: string;
  isKilledToday: boolean;
}

const LS_KEY = "grudge_hero_states";

function loadPersisted(): Map<string, HeroPersisted> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, HeroPersisted>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function savePersisted(map: Map<string, HeroPersisted>) {
  try {
    const obj: Record<string, HeroPersisted> = {};
    for (const [k, v] of map) obj[k] = v;
    localStorage.setItem(LS_KEY, JSON.stringify(obj));
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime state per hero
// ─────────────────────────────────────────────────────────────────────────────

export interface HeroWorldState {
  heroId: string;
  dailyState: HeroDailyState;
  /** World-space position; updated by FactionHeroNPC when visible. */
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  /** True if a camp has been placed this session (field heroes only). */
  hasCamp: boolean;
  campPosition: THREE.Vector3 | null;
  kills: number;
  resourcesGathered: number;
}

// ─────────────────────────────────────────────────────────────────────────────

interface FactionHeroesState {
  heroes: Map<string, HeroWorldState>;

  // ── Interaction ────────────────────────────────────────────────────────────
  /** Id of the hero the player is currently standing next to. */
  nearHeroId: string | null;
  interactionOpen: boolean;
  interactionTab: "talk" | "missions" | "shop";

  // ── Actions ────────────────────────────────────────────────────────────────
  /** Refresh all hero phases (called by FactionHeroes every minute). */
  advanceCycles: () => void;

  updateHeroPosition: (heroId: string, pos: THREE.Vector3) => void;
  damageHero: (heroId: string, amount: number) => void;
  killHero: (heroId: string) => void;
  placeCamp: (heroId: string, pos: THREE.Vector3) => void;
  recordKill: (heroId: string) => void;
  recordGather: (heroId: string) => void;

  setNearHero: (heroId: string | null) => void;
  openInteraction: (heroId: string) => void;
  closeInteraction: () => void;
  setInteractionTab: (tab: "talk" | "missions" | "shop") => void;

  /** Returns true if the hero is visible at the hub right now. */
  isAtHub: (heroId: string) => boolean;
  /** Returns true if the hero is adventuring and may be visible in the field. */
  isAdventuring: (heroId: string) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialise
// ─────────────────────────────────────────────────────────────────────────────

function buildInitialHeroes(): Map<string, HeroWorldState> {
  const persisted = loadPersisted();
  const today = todayString();
  const map = new Map<string, HeroWorldState>();

  for (const def of ALL_HEROES) {
    const saved = persisted.get(def.id);
    // Auto-respawn if it's a new real-world day.
    const isKilledToday =
      saved && saved.lastRespawnDay === today ? saved.isKilledToday : false;

    map.set(def.id, {
      heroId: def.id,
      dailyState: computeHeroDailyPhase(isKilledToday),
      position: new THREE.Vector3(...def.hubPosition),
      health: def.stats.health,
      maxHealth: def.stats.maxHealth,
      hasCamp: false,
      campPosition: null,
      kills: 0,
      resourcesGathered: 0,
    });
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────

export const useFactionHeroes = create<FactionHeroesState>()((set, get) => ({
  heroes: buildInitialHeroes(),
  nearHeroId: null,
  interactionOpen: false,
  interactionTab: "talk",

  // ── Cycle advancement ───────────────────────────────────────────────────

  advanceCycles: () => {
    const persisted = loadPersisted();
    const today = todayString();

    set((s) => {
      const updated = new Map(s.heroes);
      let changed = false;

      for (const [id, hero] of updated) {
        const saved = persisted.get(id);
        const isKilledToday =
          saved && saved.lastRespawnDay === today ? saved.isKilledToday : false;

        const newPhase = computeHeroDailyPhase(isKilledToday);
        if (newPhase !== hero.dailyState) {
          updated.set(id, { ...hero, dailyState: newPhase });
          changed = true;
        }
      }
      return changed ? { heroes: updated } : s;
    });
  },

  // ── Position ────────────────────────────────────────────────────────────

  updateHeroPosition: (heroId, pos) => {
    set((s) => {
      const hero = s.heroes.get(heroId);
      if (!hero) return s;
      const updated = new Map(s.heroes);
      updated.set(heroId, { ...hero, position: pos.clone() });
      return { heroes: updated };
    });
  },

  // ── Combat ──────────────────────────────────────────────────────────────

  damageHero: (heroId, amount) => {
    set((s) => {
      const hero = s.heroes.get(heroId);
      if (!hero || hero.dailyState === "dead") return s;
      const newHp = Math.max(0, hero.health - amount);
      const updated = new Map(s.heroes);
      if (newHp <= 0) {
        // Hero dies — record in localStorage
        const persisted = loadPersisted();
        persisted.set(heroId, { lastRespawnDay: todayString(), isKilledToday: true });
        savePersisted(persisted);
        updated.set(heroId, { ...hero, health: 0, dailyState: "dead" });
      } else {
        updated.set(heroId, { ...hero, health: newHp });
      }
      return { heroes: updated };
    });
  },

  killHero: (heroId) => {
    get().damageHero(heroId, Infinity);
  },

  // ── Camp ────────────────────────────────────────────────────────────────

  placeCamp: (heroId, pos) => {
    set((s) => {
      const hero = s.heroes.get(heroId);
      if (!hero) return s;
      const updated = new Map(s.heroes);
      updated.set(heroId, { ...hero, hasCamp: true, campPosition: pos.clone() });
      return { heroes: updated };
    });
  },

  // ── XP / stats ──────────────────────────────────────────────────────────

  recordKill: (heroId) => {
    set((s) => {
      const hero = s.heroes.get(heroId);
      if (!hero) return s;
      const updated = new Map(s.heroes);
      updated.set(heroId, { ...hero, kills: hero.kills + 1 });
      return { heroes: updated };
    });
  },

  recordGather: (heroId) => {
    set((s) => {
      const hero = s.heroes.get(heroId);
      if (!hero) return s;
      const updated = new Map(s.heroes);
      updated.set(heroId, { ...hero, resourcesGathered: hero.resourcesGathered + 1 });
      return { heroes: updated };
    });
  },

  // ── Interaction ─────────────────────────────────────────────────────────

  setNearHero: (heroId) => {
    set({ nearHeroId: heroId });
  },

  openInteraction: (heroId) => {
    const heroDef = getHero(heroId);
    const defaultTab: "talk" | "missions" | "shop" = heroDef?.isVendor
      ? "shop"
      : heroDef?.isMissionGiver
      ? "missions"
      : "talk";
    set({ interactionOpen: true, nearHeroId: heroId, interactionTab: defaultTab });
  },

  closeInteraction: () => {
    set({ interactionOpen: false });
  },

  setInteractionTab: (tab) => {
    set({ interactionTab: tab });
  },

  // ── Helpers ─────────────────────────────────────────────────────────────

  isAtHub: (heroId) => {
    const hero = get().heroes.get(heroId);
    return hero?.dailyState === "at_hub";
  },

  isAdventuring: (heroId) => {
    const hero = get().heroes.get(heroId);
    return hero?.dailyState === "adventuring";
  },
}));
