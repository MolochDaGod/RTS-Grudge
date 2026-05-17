/**
 * useMissions — rotating mission system for faction hero NPCs.
 *
 * Each hero has a pool of 3 variants (kill → recover → resource) that cycle:
 *   • On claim: immediately advance to the next variant
 *   • Every 2 real hours: auto-advance regardless of completion (checkAndRotate)
 *
 * Map markers
 *   When a mission is accepted, a MissionMarker is added to useWorldMap so
 *   the world map shows the objective within 1000 world units of the hero hub.
 *   The marker is removed when the mission is claimed or rotated away.
 *
 * Persistence
 *   heroRotations (variantIndex + lastRotatedAt) are stored in localStorage.
 *   Mission progress (progress/completed/claimed) is also persisted.
 */

import { create } from "zustand";
import {
  getActiveVariant, getMission, getMissionId,
  type FactionMission,
} from "@/game/world/MissionRegistry";
import { getHero } from "@/game/world/HeroRegistry";
import { FACTION_COLOR } from "@/game/world/HeroRegistry";
import { useInventory } from "./useInventory";
import { useGame } from "./useGame";
import { useWorldMap } from "./useWorldMap";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────

export interface MissionProgress {
  missionId: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
  acceptedAt: number;
  lastClaimedDay: string | null;
}

/** Per-hero rotation state persisted to localStorage. */
export interface HeroRotationState {
  variantIndex: number;   // 0, 1, or 2
  lastRotatedAt: number;  // Date.now() when last advanced
}

const LS_ACTIVE     = "grudge_missions_active";
const LS_COMPLETED  = "grudge_missions_done";
const LS_ROTATIONS  = "grudge_mission_rotations";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function loadRotations(): Map<string, HeroRotationState> {
  try {
    const raw = localStorage.getItem(LS_ROTATIONS);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, HeroRotationState>;
    return new Map(Object.entries(obj));
  } catch { return new Map(); }
}

function saveRotations(map: Map<string, HeroRotationState>) {
  try {
    const obj: Record<string, HeroRotationState> = {};
    for (const [k, v] of map) obj[k] = v;
    localStorage.setItem(LS_ROTATIONS, JSON.stringify(obj));
  } catch {}
}

/** Compute the world-space marker position from hero hub + variant markerOffset. */
function markerWorldPos(heroId: string, variant: FactionMission): [number, number] {
  const def = getHero(heroId);
  if (!def) return [variant.markerOffset[0], variant.markerOffset[1]];
  const wx = def.hubPosition[0] + variant.markerOffset[0];
  const wz = def.hubPosition[2] + variant.markerOffset[1];
  return [wx, wz];
}

function loadActive(): Map<string, MissionProgress> {
  try {
    const raw = localStorage.getItem(LS_ACTIVE);
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as MissionProgress[];
    return new Map(arr.map((m) => [m.missionId, m]));
  } catch {
    return new Map();
  }
}

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_COMPLETED);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveActive(map: Map<string, MissionProgress>) {
  try {
    localStorage.setItem(LS_ACTIVE, JSON.stringify(Array.from(map.values())));
  } catch {}
}

function saveCompleted(set: Set<string>) {
  try {
    localStorage.setItem(LS_COMPLETED, JSON.stringify(Array.from(set)));
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────

interface MissionsState {
  active:    Map<string, MissionProgress>;
  completed: Set<string>;
  /** Rotation state per hero (variant index + last rotate timestamp). */
  rotations: Map<string, HeroRotationState>;

  // — Legacy single-mission API (kept for backward compat) —
  acceptMission: (missionId: string) => void;
  abandonMission: (missionId: string) => void;
  claimReward: (missionId: string) => void;

  // — Hero-keyed rotating API —
  /** Accept the current active variant for a hero and place the map marker. */
  acceptHeroMission: (heroId: string) => void;
  /** Claim rewards for the active completed mission, advance variant, update marker. */
  claimHeroReward: (heroId: string) => void;
  /** Abandon the active variant without advancing. */
  abandonHeroMission: (heroId: string) => void;
  /** Auto-advance any hero whose last rotation was 2+ real hours ago. */
  checkAndRotate: () => void;
  /** Milliseconds until the active variant rotates (due to 2h timeout). */
  getTimeUntilRotation: (heroId: string) => number;
  /** The currently-active FactionMission variant for a hero. */
  getActiveVariantForHero: (heroId: string) => FactionMission | undefined;
  /** Current variant index (0-2) for a hero. */
  getVariantIndex: (heroId: string) => number;

  // — Event hooks —
  onKill: (enemyType: string) => void;
  onGather: (resourceType: string) => void;
  onIslandDiscover: (zoneId: string) => void;

  getMissionProgress: (missionId: string) => MissionProgress | null;
  isComplete: (missionId: string) => boolean;
  isClaimed: (missionId: string) => boolean;
  isActive: (missionId: string) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────

export const useMissions = create<MissionsState>()((set, get) => ({
  active:    loadActive(),
  completed: loadCompleted(),
  rotations: loadRotations(),

  // ── Accept ──────────────────────────────────────────────────────────────

  acceptMission: (missionId) => {
    const mission = getMission(missionId);
    if (!mission) return;
    const state = get();
    if (state.active.has(missionId)) return; // already tracking

    set((s) => {
      const updated = new Map(s.active);
      updated.set(missionId, {
        missionId,
        progress: 0,
        completed: false,
        claimed: false,
        acceptedAt: Date.now(),
        lastClaimedDay: null,
      });
      saveActive(updated);
      return { active: updated };
    });
  },

  // ── Abandon ─────────────────────────────────────────────────────────────

  abandonMission: (missionId) => {
    set((s) => {
      const updated = new Map(s.active);
      updated.delete(missionId);
      saveActive(updated);
      return { active: updated };
    });
  },

  // ── Hero-keyed rotating API ──────────────────────────────────────────────────────────

  getVariantIndex: (heroId) => {
    return get().rotations.get(heroId)?.variantIndex ?? 0;
  },

  getActiveVariantForHero: (heroId) => {
    const idx = get().rotations.get(heroId)?.variantIndex ?? 0;
    return getActiveVariant(heroId, idx);
  },

  getTimeUntilRotation: (heroId) => {
    const rot = get().rotations.get(heroId);
    if (!rot) return 0;
    const elapsed = Date.now() - rot.lastRotatedAt;
    return Math.max(0, TWO_HOURS_MS - elapsed);
  },

  acceptHeroMission: (heroId) => {
    const state = get();
    const idx = state.rotations.get(heroId)?.variantIndex ?? 0;
    const variant = getActiveVariant(heroId, idx);
    if (!variant) return;
    const missionId = getMissionId(heroId, idx);
    if (state.active.has(missionId)) return; // already accepted

    // Add progress record
    set((s) => {
      const updatedActive = new Map(s.active);
      updatedActive.set(missionId, {
        missionId, progress: 0, completed: false, claimed: false,
        acceptedAt: Date.now(), lastClaimedDay: null,
      });
      // Initialise rotation record if missing
      const updatedRotations = new Map(s.rotations);
      if (!updatedRotations.has(heroId)) {
        updatedRotations.set(heroId, { variantIndex: 0, lastRotatedAt: Date.now() });
      }
      saveActive(updatedActive);
      saveRotations(updatedRotations);
      return { active: updatedActive, rotations: updatedRotations };
    });

    // Place map marker
    const heroDef = getHero(heroId);
    if (heroDef) {
      const [wx, wz] = markerWorldPos(heroId, variant);
      useWorldMap.getState().addMissionMarker({
        id: `${heroId}_m`,
        heroId,
        title: variant.markerLabel,
        type: variant.objective.type as "kill" | "gather" | "explore",
        faction: FACTION_COLOR[heroDef.faction],
        worldX: wx,
        worldZ: wz,
      });
    }
  },

  claimHeroReward: (heroId) => {
    const state = get();
    const idx = state.rotations.get(heroId)?.variantIndex ?? 0;
    const missionId = getMissionId(heroId, idx);
    const variant = getActiveVariant(heroId, idx);
    const prog = state.active.get(missionId);
    if (!variant || !prog || !prog.completed || prog.claimed) return;

    // Dispatch rewards
    useGame.getState().addXP(variant.rewards.xp);
    if (variant.rewards.gold > 0) {
      useInventory.getState().addItem({
        id: "gold_coin", name: "Gold Coin", type: "material",
        icon: "🪙", quantity: variant.rewards.gold,
      });
    }
    for (const item of variant.rewards.items) {
      useInventory.getState().addItem({
        id: item.id, name: item.name, icon: item.icon,
        type: "consumable", quantity: item.quantity,
      });
    }

    // Advance variant, reset progress
    const nextIdx = (idx + 1) % 3;
    const nextMissionId = getMissionId(heroId, nextIdx);
    const now = Date.now();

    set((s) => {
      const updatedActive = new Map(s.active);
      const updatedRotations = new Map(s.rotations);
      // Clear old mission, remove map marker
      updatedActive.delete(missionId);
      updatedRotations.set(heroId, { variantIndex: nextIdx, lastRotatedAt: now });
      saveActive(updatedActive);
      saveRotations(updatedRotations);
      return { active: updatedActive, rotations: updatedRotations };
    });

    // Remove old marker
    useWorldMap.getState().clearMissionMarkersForHero(heroId);
  },

  abandonHeroMission: (heroId) => {
    const state = get();
    const idx = state.rotations.get(heroId)?.variantIndex ?? 0;
    const missionId = getMissionId(heroId, idx);
    set((s) => {
      const updatedActive = new Map(s.active);
      updatedActive.delete(missionId);
      saveActive(updatedActive);
      return { active: updatedActive };
    });
    useWorldMap.getState().clearMissionMarkersForHero(heroId);
  },

  checkAndRotate: () => {
    const now = Date.now();
    const state = get();
    const newRotations = new Map(state.rotations);
    const newActive = new Map(state.active);
    let changed = false;

    for (const [heroId, rot] of newRotations) {
      if (now - rot.lastRotatedAt < TWO_HOURS_MS) continue;
      // Time expired — abandon any active mission and advance variant
      const oldMissionId = getMissionId(heroId, rot.variantIndex);
      if (newActive.has(oldMissionId)) {
        newActive.delete(oldMissionId);
        useWorldMap.getState().clearMissionMarkersForHero(heroId);
      }
      newRotations.set(heroId, {
        variantIndex: (rot.variantIndex + 1) % 3,
        lastRotatedAt: now,
      });
      changed = true;
    }

    if (changed) {
      saveActive(newActive);
      saveRotations(newRotations);
      set({ active: newActive, rotations: newRotations });
    }
  },

  // ── Claim reward (legacy single-mission API) ──────────────────────────────────────────────────

  // ── Claim reward ────────────────────────────────────────────────────────────────────────

  claimReward: (missionId) => {
    const mission = getMission(missionId);
    if (!mission) return;
    const prog = get().active.get(missionId);
    if (!prog || !prog.completed || prog.claimed) return;

    // Push XP
    useGame.getState().addXP(mission.rewards.xp);

    // Push gold coins
    if (mission.rewards.gold > 0) {
      useInventory.getState().addItem({
        id: "gold_coin",
        name: "Gold Coin",
        type: "material",
        icon: "🪙",
        quantity: mission.rewards.gold,
      });
    }

    // Push reward items
    for (const rewardItem of mission.rewards.items) {
      useInventory.getState().addItem({
        id: rewardItem.id,
        name: rewardItem.name,
        icon: rewardItem.icon,
        type: "consumable",
        quantity: rewardItem.quantity,
      });
    }

    const today = todayStr();

    set((s) => {
      const updatedActive = new Map(s.active);
      const updatedCompleted = new Set(s.completed);

      if (mission.repeatable) {
        // Mark claimed but keep for re-acceptance tomorrow
        updatedActive.set(missionId, { ...prog, claimed: true, lastClaimedDay: today });
      } else {
        updatedActive.delete(missionId);
        updatedCompleted.add(missionId);
      }

      saveActive(updatedActive);
      saveCompleted(updatedCompleted);
      return { active: updatedActive, completed: updatedCompleted };
    });
  },

  // ── Event hooks ──────────────────────────────────────────────────────────

  onKill: (enemyType) => {
    set((s) => {
      let changed = false;
      const updated = new Map(s.active);

      for (const [id, prog] of updated) {
        if (prog.completed || prog.claimed) continue;
        const mission = getMission(id);
        if (!mission || mission.objective.type !== "kill") continue;

        const obj = mission.objective;
        // Empty enemyTypes = any enemy counts
        const counts =
          obj.enemyTypes.length === 0 || obj.enemyTypes.includes(enemyType);
        if (!counts) continue;

        const newProgress = prog.progress + 1;
        const completed = newProgress >= obj.required;
        updated.set(id, { ...prog, progress: newProgress, completed });
        changed = true;
      }

      if (changed) {
        saveActive(updated);
        return { active: updated };
      }
      return s;
    });
  },

  onGather: (resourceType) => {
    set((s) => {
      let changed = false;
      const updated = new Map(s.active);

      for (const [id, prog] of updated) {
        if (prog.completed || prog.claimed) continue;
        const mission = getMission(id);
        if (!mission || mission.objective.type !== "gather") continue;

        const obj = mission.objective;
        if (!obj.resourceTypes.includes(resourceType)) continue;

        const newProgress = prog.progress + 1;
        const completed = newProgress >= obj.required;
        updated.set(id, { ...prog, progress: newProgress, completed });
        changed = true;
      }

      if (changed) {
        saveActive(updated);
        return { active: updated };
      }
      return s;
    });
  },

  onIslandDiscover: (zoneId) => {
    set((s) => {
      let changed = false;
      const updated = new Map(s.active);

      for (const [id, prog] of updated) {
        if (prog.completed || prog.claimed) continue;
        const mission = getMission(id);
        if (!mission || mission.objective.type !== "explore") continue;

        const obj = mission.objective;
        // Empty targetZone = any zone qualifies
        if (obj.targetZone !== "" && obj.targetZone !== zoneId) continue;

        updated.set(id, { ...prog, progress: 1, completed: true });
        changed = true;
      }

      if (changed) {
        saveActive(updated);
        return { active: updated };
      }
      return s;
    });
  },

  // ── Selectors ────────────────────────────────────────────────────────────

  getMissionProgress: (missionId) => {
    return get().active.get(missionId) ?? null;
  },

  isComplete: (missionId) => {
    const prog = get().active.get(missionId);
    return prog?.completed === true;
  },

  isClaimed: (missionId) => {
    if (get().completed.has(missionId)) return true;
    const prog = get().active.get(missionId);
    return prog?.claimed === true;
  },

  isActive: (missionId) => {
    return get().active.has(missionId);
  },
}));
