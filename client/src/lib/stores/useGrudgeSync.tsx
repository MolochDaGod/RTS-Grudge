/**
 * useGrudgeSync — Zustand store + React hook for cross-game character sync in RTS-Grudge.
 *
 * Wraps GrudgeCharacterService and exposes:
 *   - characters[]        — Grudge API character list (same as crafting app sees)
 *   - activeCharId        — currently selected character (persisted in localStorage)
 *   - crossGameData       — live CrossGameData for the active character
 *   - heroForgeConfig     — last Hero Forge config pushed (read from cross-game cache)
 *   - loadCharacters()    — fetch from API
 *   - selectCharacter()   — set active + persist
 *   - pushHeroForge()     — fire-and-forget push of a Hero Forge config
 *   - pushProfessions()   — fire-and-forget push of profession levels
 *   - pullForActiveChar() — re-pull cross-game data for active char
 *
 * This store is initialised once in App.tsx and populated as soon as GrudgeSession
 * resolves. Components read from it for the sync badge / cross-game data displays.
 */

import { create } from "zustand";
import { useEffect } from "react";
import {
  fetchCharacters,
  pullCrossGame,
  pushHeroForge as svcPushHeroForge,
  pushProfessions as svcPushProfessions,
  setActiveCharId,
  getActiveCharId,
  getCachedCrossGame,
  type CharacterRecord,
  type CrossGameData,
  type CrossGameProfession,
  type HeroForgeConfig,
} from "@/lib/services/GrudgeCharacterService";

// ─────────────────────────────────────────────────────────────────────────────
// Store shape
// ─────────────────────────────────────────────────────────────────────────────

interface GrudgeSyncState {
  /** Characters fetched from Grudge API. */
  characters: CharacterRecord[];
  /** Active character ID (string for compatibility with Grudge API number IDs too). */
  activeCharId: string | null;
  /** Cross-game envelope for the active character. */
  crossGameData: CrossGameData | null;
  /** True while fetchCharacters is in-flight. */
  loadingCharacters: boolean;
  /** True while pullCrossGame is in-flight. */
  loadingCrossGame: boolean;
  /** Last sync timestamp (ms). 0 = never synced. */
  lastSyncAt: number;

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Fetch characters from Grudge API and update store. */
  loadCharacters: () => Promise<void>;

  /**
   * Set the active character and persist the choice.
   * Triggers an async pull of cross-game data for the new character.
   */
  selectCharacter: (charId: string | null) => void;

  /**
   * Pull the latest cross-game data for the currently active character.
   * No-op if no character is active.
   */
  pullForActiveChar: () => Promise<void>;

  /**
   * Push Hero Forge config for the active character.
   * No-op if no character is active.
   */
  pushHeroForge: (config: HeroForgeConfig) => void;

  /**
   * Push profession levels for the active character.
   * Expects keys like "miner", "forester", "chef", "engineer", "mystic".
   */
  pushProfessions: (profs: Record<string, CrossGameProfession>) => void;

  /**
   * Merge incoming cross-game data into the store (called by pullForActiveChar).
   * @internal
   */
  _setCrossGameData: (charId: string, data: CrossGameData | null) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store implementation
// ─────────────────────────────────────────────────────────────────────────────

export const useGrudgeSync = create<GrudgeSyncState>()((set, get) => ({
  characters: [],
  activeCharId: getActiveCharId(),
  crossGameData: (() => {
    // Seed from local cache so data is available before the first async pull
    const id = getActiveCharId();
    return id ? getCachedCrossGame(id) : null;
  })(),
  loadingCharacters: false,
  loadingCrossGame: false,
  lastSyncAt: 0,

  // ── loadCharacters ────────────────────────────────────────────────────────
  loadCharacters: async () => {
    if (get().loadingCharacters) return;
    set({ loadingCharacters: true });
    try {
      const chars = await fetchCharacters();
      set({ characters: chars, loadingCharacters: false });

      // Auto-select first character if none is set yet
      const current = get().activeCharId;
      if (!current && chars.length > 0) {
        get().selectCharacter(String(chars[0].id));
      }
    } catch {
      set({ loadingCharacters: false });
    }
  },

  // ── selectCharacter ───────────────────────────────────────────────────────
  selectCharacter: (charId) => {
    setActiveCharId(charId);
    set({ activeCharId: charId, crossGameData: charId ? getCachedCrossGame(charId) : null });
    if (charId) {
      // Async pull — don't await, update when it lands
      void get().pullForActiveChar();
    }
  },

  // ── pullForActiveChar ─────────────────────────────────────────────────────
  pullForActiveChar: async () => {
    const charId = get().activeCharId;
    if (!charId || get().loadingCrossGame) return;
    set({ loadingCrossGame: true });
    try {
      const data = await pullCrossGame(charId);
      get()._setCrossGameData(charId, data);
    } finally {
      set({ loadingCrossGame: false });
    }
  },

  // ── pushHeroForge ─────────────────────────────────────────────────────────
  pushHeroForge: (config) => {
    const charId = get().activeCharId;
    if (!charId) return;
    svcPushHeroForge(charId, config);
    // Optimistic local update
    const prev = get().crossGameData ?? {};
    set({ crossGameData: { ...prev, heroForge: config, syncSource: "rts", syncedAt: Date.now() } });
  },

  // ── pushProfessions ───────────────────────────────────────────────────────
  pushProfessions: (profs) => {
    const charId = get().activeCharId;
    if (!charId) return;
    svcPushProfessions(charId, profs, "rts");
    // Optimistic local update
    const prev = get().crossGameData ?? {};
    set({ crossGameData: { ...prev, professions: profs, syncSource: "rts", syncedAt: Date.now() } });
  },

  // ── _setCrossGameData ─────────────────────────────────────────────────────
  _setCrossGameData: (charId, data) => {
    if (get().activeCharId !== charId) return; // stale response
    set({ crossGameData: data, lastSyncAt: Date.now() });
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// React hook — auto-loads characters and pulls cross-game data on mount
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drop-in hook that bootstraps the sync store for a component.
 * Call once near the top of your game tree (e.g. App.tsx or AccountPanel).
 *
 * @param enabled - Pass false to skip auto-loading (e.g. when user is not signed in).
 */
export function useGrudgeSyncInit(enabled = true): void {
  const { loadCharacters, pullForActiveChar, activeCharId } = useGrudgeSync();

  useEffect(() => {
    if (!enabled) return;
    void loadCharacters();
  }, [enabled, loadCharacters]);

  // Re-pull when active character changes
  useEffect(() => {
    if (!enabled || !activeCharId) return;
    void pullForActiveChar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, activeCharId]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience selector hooks
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the active CharacterRecord from the loaded character list. */
export function useActiveCharacter(): CharacterRecord | null {
  return useGrudgeSync(s => {
    if (!s.activeCharId) return null;
    return s.characters.find(c => String(c.id) === s.activeCharId) ?? null;
  });
}

/** Returns the Hero Forge config for the active character from cross-game data. */
export function useSyncedHeroForge(): HeroForgeConfig | null {
  return useGrudgeSync(s => s.crossGameData?.heroForge ?? null);
}

/** Returns synced profession levels for the active character. */
export function useSyncedProfessions(): Record<string, CrossGameProfession> | null {
  return useGrudgeSync(s => s.crossGameData?.professions ?? null);
}

/** Returns whether the store has at least one successful sync for the active character. */
export function useSyncStatus(): { synced: boolean; lastSyncAt: number } {
  return useGrudgeSync(s => ({ synced: s.lastSyncAt > 0, lastSyncAt: s.lastSyncAt }));
}
