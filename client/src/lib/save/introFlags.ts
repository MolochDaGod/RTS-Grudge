/**
 * introFlags — one-shot intro tracking.
 *
 * The pirate-island intro cinematic should play exactly once per player.
 * We track this with a localStorage key (instant, offline-safe) and
 * optionally mirror it to Puter KV for cross-device persistence.
 */

const LOCAL_KEY = "grudge_intro_seen";

/** Returns true if the player has already seen the intro cinematic. */
export function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(LOCAL_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Marks the intro as seen. Called by `finishIntro()` in useGame.
 * Writes to localStorage immediately; also tries Puter KV if available.
 */
export function markIntroSeen(): void {
  try {
    localStorage.setItem(LOCAL_KEY, "1");
  } catch {}

  // Fire-and-forget: sync to Puter KV so the flag persists cross-device
  // when the player logs in with their Grudge ID.
  try {
    const win = window as any;
    if (win.puter?.kv?.set) {
      win.puter.kv.set("grudge.flags.intro_seen", "1").catch(() => {});
    }
  } catch {}
}

/**
 * Clears the intro flag (dev/testing helper — not called in production).
 */
export function resetIntroFlag(): void {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {}
  try {
    const win = window as any;
    if (win.puter?.kv?.del) {
      win.puter.kv.del("grudge.flags.intro_seen").catch(() => {});
    }
  } catch {}
}
