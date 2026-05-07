import { useEffect, useRef } from "react";
import { useGame } from "@/lib/stores/useGame";
import { useCharacterStats } from "@/lib/stores/useCharacterStats";
import { useEquipment } from "@/lib/stores/useEquipment";
import { useInventory } from "@/lib/stores/useInventory";
import { useSurvival } from "@/lib/stores/useSurvival";
import { getActiveSlot } from "./playerId";
import { saveSlot, loadSlot, restoreGame } from "./saveSync";

const DEBOUNCE_MS = 4000;
const PHASES_THAT_SAVE = new Set(["playing", "paused"]);

/**
 * Background autosave controller:
 *   - On first mount: pulls the latest server save (if any) and restores
 *     it into the in-memory stores.
 *   - While the player is in "playing"/"paused" phase, every meaningful
 *     state change is debounced for 4s and then PUT to /api/saves.
 *   - On window unload it does one final synchronous-ish flush.
 *
 * The hook returns nothing and renders nothing — drop <AutoSaveController/>
 * once near the root and forget about it.
 */
function useAutoSave() {
  const phase = useGame((s) => s.phase);
  const dirty = useRef(false);
  const inflight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);
  // `loadComplete` flips to true once the initial server pull has finished
  // (success OR failure). We refuse to push autosaves before that happens —
  // otherwise the empty default stores could clobber a real cloud save.
  const loadComplete = useRef(false);
  const startedAt = useRef<number>(Date.now());
  const accumulatedSeconds = useRef(0);
  const slot = useRef(getActiveSlot());

  // Initial pull from server.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    (async () => {
      try {
        const remote = await loadSlot(slot.current);
        if (remote?.save_data) {
          restoreGame(remote.save_data as any);
          accumulatedSeconds.current = remote.play_seconds || 0;
          console.log(`[save] Loaded slot ${slot.current} (v${remote.version})`);
        } else {
          console.log(`[save] No remote save in slot ${slot.current}; starting fresh`);
        }
      } catch (e) {
        console.warn("[save] Initial load failed (offline?):", e);
      } finally {
        loadComplete.current = true;
      }
    })();
  }, []);

  const flush = useRef(async () => {
    if (inflight.current) return;
    if (!dirty.current) return;
    if (!loadComplete.current) return; // wait for initial pull
    if (!PHASES_THAT_SAVE.has(useGame.getState().phase)) return;
    inflight.current = true;
    dirty.current = false;
    const playSeconds = accumulatedSeconds.current +
      Math.floor((Date.now() - startedAt.current) / 1000);
    try {
      await saveSlot(slot.current, { playSeconds });
      console.log(`[save] autosaved slot ${slot.current} (~${playSeconds}s played)`);
    } catch (e) {
      console.warn("[save] autosave failed; will retry on next change", e);
      dirty.current = true; // re-mark so the next edit retries
    } finally {
      inflight.current = false;
    }
  }).current;

  // Subscribe to relevant stores; mark dirty + (re)debounce.
  useEffect(() => {
    const markDirty = () => {
      dirty.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { void flush(); }, DEBOUNCE_MS);
    };
    const unsubs = [
      useCharacterStats.subscribe(markDirty),
      useEquipment.subscribe(markDirty),
      useInventory.subscribe(markDirty),
      useSurvival.subscribe(markDirty),
    ];
    return () => { unsubs.forEach((u) => u()); };
  }, [flush]);

  // Reset playtime timer when entering "playing" so paused time isn't double-counted.
  useEffect(() => {
    if (phase === "playing") startedAt.current = Date.now();
  }, [phase]);

  // Final flush on unload (best-effort).
  useEffect(() => {
    const handler = () => {
      if (dirty.current && PHASES_THAT_SAVE.has(useGame.getState().phase)) {
        // sendBeacon-style fallback: fire-and-forget fetch with keepalive.
        const playSeconds = accumulatedSeconds.current +
          Math.floor((Date.now() - startedAt.current) / 1000);
        // Re-use saveSlot but without awaiting; mark keepalive via a direct fetch.
        void saveSlot(slot.current, { playSeconds }).catch(() => undefined);
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
}

export function AutoSaveController() {
  useAutoSave();
  return null;
}
