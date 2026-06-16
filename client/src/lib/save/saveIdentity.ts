/**
 * Pure save-record identity derivation.
 *
 * Split out of `saveSync` so it can be unit-tested without importing the heavy
 * store / THREE graph that `saveSync` pulls in. Given the live survival key,
 * the hero stats map, and the active grudge6 character identity carried in the
 * launched `CharacterConfig`, it produces the metadata columns persisted with a
 * save (`character_id`, `character_name`, `character_class`, `character_race`,
 * `level`).
 *
 * Identity precedence:
 *   - `characterId`   → the grudge6 cross-game UUID when known, so a save maps
 *                       back to its /api/characters entry; otherwise the local
 *                       stats key ("hero") for legacy / guest snapshots.
 *   - `characterName` → the real hero name when known, else the local key.
 *   - class / level   → always read from the local hero stat block (keyed by
 *                       the local stats key the in-game systems use).
 *   - `characterRace` → the grudge6 race when known, else the hero stat block's
 *                       race.
 */

/** Active grudge6 character identity carried in the launched CharacterConfig. */
export interface SaveCharacterIdentity {
  /** grudge6 / grudge-studio cross-game character UUID. */
  serverCharacterId: string | null;
  /** Display name of the hero. */
  name: string | null;
  /** grudge6 race id. */
  race: string | null;
}

/** Minimal hero stat shape needed to summarise a save (structural). */
interface HeroStatLike {
  heroClass?: string | null;
  race?: string | null;
  level?: number | null;
}

export interface DeriveSaveIdentityArgs {
  /** useSurvival.activeCharacterId — the local stats key (e.g. "hero"). */
  activeCharacterId: string | null;
  /** useCharacterStats.heroes, keyed by the local stats key. */
  heroes: Record<string, HeroStatLike | undefined>;
  /** Active grudge6 identity; null/absent for legacy or guest snapshots. */
  identity?: SaveCharacterIdentity | null;
}

export interface SaveIdentitySummary {
  characterId: string | null;
  characterName: string | null;
  characterClass: string | null;
  characterRace: string | null;
  level: number;
}

export function deriveSaveIdentity(args: DeriveSaveIdentityArgs): SaveIdentitySummary {
  const { activeCharacterId, heroes, identity } = args;

  // The local stats key the in-game systems use; drives class/level lookup.
  const localId = activeCharacterId || Object.keys(heroes)[0] || null;
  const hero = localId ? heroes[localId] : null;

  return {
    // Prefer the grudge6 cross-game UUID so each saved hero maps back to its
    // /api/characters record; fall back to the local stats key (legacy saves).
    characterId: identity?.serverCharacterId ?? localId,
    // Real hero name when known, else the local stats key (legacy behaviour).
    characterName: identity?.name ?? localId ?? null,
    characterClass: hero?.heroClass ?? null,
    characterRace: identity?.race ?? hero?.race ?? null,
    level: hero?.level ?? 1,
  };
}
