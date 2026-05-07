import { getPuterUuidSync } from "@/lib/auth/puter";

const KEY = "grudge.playerId";

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Returns the canonical Grudge player identity. Preference order:
//   1. Puter UUID when the user is signed in via puter.js (stable, tied
//      to a real account, survives device changes).
//   2. Anonymous localStorage UUID (legacy / guest mode).
//   3. Per-session ephemeral id when localStorage is unavailable.
//
// IDs from Puter are namespaced with a "puter:" prefix so saves/loadouts
// keyed by them never collide with the legacy anon hex IDs (32-char hex)
// — and so the server can tell them apart when needed. The PLAYER_ID_RE
// allowlist on the server is `[A-Za-z0-9_\-]{6,64}` which already permits
// the colon-free prefix form below (we use `puter_<uuid>` instead of
// `puter:<uuid>` to stay in that allowlist without a server change).
export function getPlayerId(): string {
  const puterUuid = getPuterUuidSync();
  if (puterUuid) return `puter_${puterUuid}`;
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[A-Za-z0-9_\-]{6,64}$/.test(id)) {
      id = randomId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "anon-" + Math.random().toString(36).slice(2, 14);
  }
}

export const ACTIVE_SLOT_KEY = "grudge.activeSlot";

export function getActiveSlot(): number {
  try {
    const raw = localStorage.getItem(ACTIVE_SLOT_KEY);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 && n < 8 ? n : 0;
  } catch {
    return 0;
  }
}

export function setActiveSlot(slot: number): void {
  try {
    localStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
  } catch {
    /* ignore quota errors */
  }
}
