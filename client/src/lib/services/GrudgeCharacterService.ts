/**
 * GrudgeCharacterService — Cross-game character data sync for Grudge Studio.
 *
 * Synchronizes the "cross-game" character envelope between:
 *   - grudge-crafting.puter.site  (profession levels, crafting inventory)
 *   - RTS-Grudge / Hero Forge     (model config, combat class, weapon loadout)
 *   - survival / Gruda Wars        (survival profession XP, skill unlocks)
 *
 * Transport strategy:
 *   1. PATCH api.grudge-studio.com/characters/:charId/cross-game  (primary)
 *   2. localStorage queue fallback (written when offline, flushed on reconnect)
 *
 * Auth:
 *   Reads the Grudge JWT from localStorage['grudge.token'].
 *   When no JWT is present, falls back to Puter UUID for non-authenticated pushes.
 *
 * Write policy:
 *   Each game writes ONLY its own namespace:
 *     crafting → professions + craftingInventory
 *     rts      → heroForge
 *     survival → survivalProgress
 *   The server merges namespaces with last-write-wins per key.
 *   This means a slow crafting push cannot overwrite a hero forge config.
 *
 * Debounce:
 *   All pushes are debounced (default 4 s) to avoid hammering the API on
 *   rapid-fire craft ticks.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type SyncSource = "crafting" | "rts" | "survival";

/** Profession snapshot shared between crafting app and RTS useProfessions. */
export interface CrossGameProfession {
  level: number;
  xp: number;
  xpNext: number;
  totalCrafts?: number;
  /** Unlocked skill node IDs (from useProfessions in RTS). */
  unlockedNodes?: string[];
}

/** Hero Forge configuration saved from CharacterSelectScreen. */
export interface HeroForgeConfig {
  modelPath: string;
  name: string;
  combatClass: string;
  weaponRight: string;
  weaponLeft: string | null;
  faction: string;
  materialColors: Record<string, string | null>;
  bodyMorph?: Record<string, number>;
  weaponModelRight?: string | null;
  weaponModelLeft?: string | null;
  arrowModelId?: string | null;
  backAccessoryId?: string | null;
  scale?: number;
}

/** Survival-game progress payload. */
export interface SurvivalProgress {
  /** Profession levels keyed by survival ProfessionState IDs (same names as WCS). */
  professions?: Record<string, { level: number; xp: number }>;
  /** Learned skill IDs (survival Professions system). */
  learnedSkills?: string[];
}

/** Full cross-game envelope stored per character on the Grudge API. */
export interface CrossGameData {
  /** Keyed by canonical profession name (lowercase): miner, forester, chef, engineer, mystic */
  professions?: Record<string, CrossGameProfession>;
  /** Crafting material inventory (from grudge-crafting). */
  craftingInventory?: Record<string, number>;
  /** Hero Forge loadout (from RTS-Grudge). */
  heroForge?: HeroForgeConfig;
  /** Survival-game progress. */
  survivalProgress?: SurvivalProgress;
  /** Which game last wrote this record. */
  syncSource?: SyncSource;
  syncedAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal constants
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE             = "https://api.grudge-studio.com";
const TOKEN_LS_KEY         = "grudge.token";
const QUEUE_LS_KEY         = "grudge.xgame.queue";
const ACTIVE_CHAR_LS_KEY   = "grudge.activeCharId";
const CACHE_LS_PREFIX      = "grudge.xgame.cache.";
const DEFAULT_DEBOUNCE_MS  = 4_000;
const MAX_QUEUE_SIZE       = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Token / auth helpers
// ─────────────────────────────────────────────────────────────────────────────

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_LS_KEY); } catch { return null; }
}

function buildHeaders(): HeadersInit {
  const token = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// ─────────────────────────────────────────────────────────────────────────────
// Active character persistence (shared across all games via localStorage)
// ─────────────────────────────────────────────────────────────────────────────

/** Read the last-known active character ID set by any game. */
export function getActiveCharId(): string | null {
  try { return localStorage.getItem(ACTIVE_CHAR_LS_KEY); } catch { return null; }
}

/** Persist the active character ID so all games agree on which character is active. */
export function setActiveCharId(charId: string | null): void {
  try {
    if (charId) localStorage.setItem(ACTIVE_CHAR_LS_KEY, charId);
    else localStorage.removeItem(ACTIVE_CHAR_LS_KEY);
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Local cache (avoids redundant GET requests)
// ─────────────────────────────────────────────────────────────────────────────

function cacheKey(charId: string): string {
  return CACHE_LS_PREFIX + charId;
}

function readCache(charId: string): CrossGameData | null {
  try {
    const raw = localStorage.getItem(cacheKey(charId));
    return raw ? (JSON.parse(raw) as CrossGameData) : null;
  } catch { return null; }
}

function writeCache(charId: string, data: CrossGameData): void {
  try { localStorage.setItem(cacheKey(charId), JSON.stringify(data)); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline write queue
// ─────────────────────────────────────────────────────────────────────────────

interface QueueEntry {
  charId: string;
  patch: Partial<CrossGameData>;
  ts: number;
}

function readQueue(): QueueEntry[] {
  try {
    const raw = localStorage.getItem(QUEUE_LS_KEY);
    return raw ? (JSON.parse(raw) as QueueEntry[]) : [];
  } catch { return []; }
}

function writeQueue(q: QueueEntry[]): void {
  try { localStorage.setItem(QUEUE_LS_KEY, JSON.stringify(q.slice(-MAX_QUEUE_SIZE))); } catch {}
}

function enqueue(charId: string, patch: Partial<CrossGameData>): void {
  const q = readQueue();
  q.push({ charId, patch, ts: Date.now() });
  writeQueue(q);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core PATCH / GET
// ─────────────────────────────────────────────────────────────────────────────

/** PATCH a partial CrossGameData into the server record. Returns true on success. */
async function patchRemote(charId: string, patch: Partial<CrossGameData>): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(charId)}/cross-game`, {
      method: "PATCH",
      headers: buildHeaders(),
      body: JSON.stringify({ ...patch, syncedAt: Date.now() }),
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      // Merge into local cache
      const cached = readCache(charId) ?? {};
      writeCache(charId, { ...cached, ...patch, syncedAt: Date.now() });
    }
    return res.ok;
  } catch {
    return false;
  }
}

/** GET the full CrossGameData from server. Falls back to local cache on failure. */
async function getRemote(charId: string): Promise<CrossGameData | null> {
  try {
    const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(charId)}/cross-game`, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(6_000),
    });
    if (res.ok) {
      const data = await res.json() as CrossGameData;
      writeCache(charId, data);
      return data;
    }
  } catch {}
  // Fallback: serve from local cache
  return readCache(charId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Debounce helper
// ─────────────────────────────────────────────────────────────────────────────

const _debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

function debounced(key: string, fn: () => void, ms: number): void {
  const existing = _debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  _debounceTimers.set(key, setTimeout(() => {
    _debounceTimers.delete(key);
    fn();
  }, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Flush offline queue
// ─────────────────────────────────────────────────────────────────────────────

let _flushInFlight = false;

export async function flushQueue(): Promise<void> {
  if (_flushInFlight) return;
  _flushInFlight = true;
  try {
    const q = readQueue();
    if (q.length === 0) return;
    const remaining: QueueEntry[] = [];
    for (const entry of q) {
      const ok = await patchRemote(entry.charId, entry.patch);
      if (!ok) remaining.push(entry);
    }
    writeQueue(remaining);
  } finally {
    _flushInFlight = false;
  }
}

// Flush on page load + when connectivity returns
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void flushQueue(); });
  // Delay initial flush so other auth/session setup can complete first
  setTimeout(() => { void flushQueue(); }, 3_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pull the full cross-game envelope for a character.
 * Returns null if neither server nor cache has data.
 */
export async function pullCrossGame(charId: string): Promise<CrossGameData | null> {
  return getRemote(charId);
}

/**
 * Push a partial cross-game patch.
 * Writes to local cache immediately; queues for retry if offline.
 * Debounced per (charId + namespace) key.
 */
export function pushCrossGame(
  charId: string,
  patch: Partial<CrossGameData>,
  source: SyncSource,
  debounceMs = DEFAULT_DEBOUNCE_MS,
): void {
  const fullPatch: Partial<CrossGameData> = { ...patch, syncSource: source };
  // Write to cache immediately so other in-app reads see the update
  const cached = readCache(charId) ?? {};
  writeCache(charId, { ...cached, ...fullPatch, syncedAt: Date.now() });

  const debKey = `${charId}:${source}`;
  debounced(debKey, async () => {
    const ok = await patchRemote(charId, fullPatch);
    if (!ok) enqueue(charId, fullPatch);
  }, debounceMs);
}

/**
 * Push Hero Forge config from CharacterSelectScreen.
 * Source = 'rts'.
 */
export function pushHeroForge(
  charId: string,
  config: HeroForgeConfig,
  debounceMs = DEFAULT_DEBOUNCE_MS,
): void {
  pushCrossGame(charId, { heroForge: config }, "rts", debounceMs);
}

/**
 * Push profession levels from RTS useProfessions or crafting app.
 * `professions` should be keyed by lowercase canonical name: miner, forester, chef, engineer, mystic.
 */
export function pushProfessions(
  charId: string,
  professions: Record<string, CrossGameProfession>,
  source: SyncSource,
  debounceMs = DEFAULT_DEBOUNCE_MS,
): void {
  pushCrossGame(charId, { professions }, source, debounceMs);
}

/**
 * Push crafting inventory from grudge-crafting app.
 * `inventory` is a map of itemId → quantity.
 */
export function pushCraftingInventory(
  charId: string,
  inventory: Record<string, number>,
  debounceMs = DEFAULT_DEBOUNCE_MS,
): void {
  pushCrossGame(charId, { craftingInventory: inventory }, "crafting", debounceMs);
}

/**
 * Push survival-game progress (profession XP + learned skills).
 * Source = 'survival'.
 */
export function pushSurvivalProgress(
  charId: string,
  progress: SurvivalProgress,
  debounceMs = DEFAULT_DEBOUNCE_MS,
): void {
  pushCrossGame(charId, { survivalProgress: progress }, "survival", debounceMs);
}

/**
 * Read the locally-cached cross-game data synchronously (no network).
 * Useful for initial render before the async pull resolves.
 */
export function getCachedCrossGame(charId: string): CrossGameData | null {
  return readCache(charId);
}

/**
 * Fetch all characters from the Grudge API (same endpoint the crafting app uses).
 * Returns an empty array if the API is unreachable or the user is not authenticated.
 */
export async function fetchCharacters(): Promise<CharacterRecord[]> {
  try {
    const res = await fetch(`${API_BASE}/characters`, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(6_000),
    });
    if (res.ok) return (await res.json()) as CharacterRecord[];
  } catch {}
  return [];
}

/** Canonical character record shape returned by GET /characters. */
export interface CharacterRecord {
  id: string | number;
  name: string;
  race: string;
  class: string;
  level: number;
  gold?: number;
  xp_percent?: number;
  stats?: {
    strength?: number;
    vitality?: number;
    endurance?: number;
    intellect?: number;
    wisdom?: number;
    dexterity?: number;
    agility?: number;
    tactics?: number;
  };
}
