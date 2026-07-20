/**
 * Fleet character bridge — loads WCS/Grudge heroes into RTS ServerCharacter format.
 * Used when the native /api/characters/:playerId route is unavailable on Vercel.
 */

import type { ServerCharacter } from './useCharacterAPI';
import { RACE_CONFIGS } from '@/game/character/FactionCharacterRegistry';

const WCS_ORIGIN =
  import.meta.env.VITE_WCS_URL ?? 'https://warlord-crafting-suite.vercel.app';

const CLASS_TO_COMBAT: Record<string, string> = {
  warrior: 'melee',
  mage: 'magic',
  ranger: 'ranger',
  rogue: 'ranger',
  cleric: 'melee',
  worg: 'melee',
};

const CLASS_TO_WEAPON: Record<string, { right: string; left: string | null }> = {
  warrior: { right: 'sword', left: 'shield' },
  mage: { right: 'staff', left: null },
  ranger: { right: 'bow', left: null },
  rogue: { right: 'dagger', left: null },
  cleric: { right: 'hammer', left: 'shield' },
  worg: { right: 'axe', left: null },
};

function getFleetAuthToken(): string | null {
  try {
    return (
      localStorage.getItem('grudge.token') ??
      localStorage.getItem('grudge_auth_token') ??
      null
    );
  } catch {
    return null;
  }
}

function characterUserIdCandidates(playerId: string): string[] {
  const ids = new Set<string>([playerId]);
  if (playerId.startsWith('grudge_')) {
    ids.add(playerId.slice('grudge_'.length));
  } else if (!playerId.startsWith('puter_') && !playerId.startsWith('anon_')) {
    ids.add(`grudge_${playerId}`);
  }
  return [...ids];
}

function modelPathForRace(raceId: string): string {
  const key = raceId.toLowerCase().replace(/\s+/g, '_');
  const cfg = RACE_CONFIGS[key];
  return cfg?.fbxModel ?? RACE_CONFIGS.human.fbxModel;
}

function wcsToServerCharacter(raw: Record<string, unknown>, playerId: string): ServerCharacter {
  const raceId = String(raw.raceId ?? raw.race_id ?? raw.race ?? 'human').toLowerCase();
  const classId = String(raw.classId ?? raw.class_id ?? raw.class ?? 'warrior').toLowerCase();
  const weapons = CLASS_TO_WEAPON[classId] ?? CLASS_TO_WEAPON.warrior;
  const charId = String(raw.id ?? raw.character_id ?? `fleet_${raceId}_${classId}`);

  return {
    player_id: playerId,
    character_id: charId,
    name: String(raw.name ?? 'Hero'),
    hero_class: classId,
    race: raceId,
    model_path: modelPathForRace(raceId),
    appearance: {
      scale: 1,
      speedMult: 1,
      matColors: {},
      bodyMorph: {},
    },
    equipment: {
      combatClass: CLASS_TO_COMBAT[classId] ?? 'melee',
      weaponRight: weapons.right,
      weaponLeft: weapons.left,
      weaponModelRight: null,
      weaponModelLeft: null,
      arrowModelId: classId === 'ranger' ? 'arrow_default' : null,
      backAccessoryId: null,
    },
    level: Number(raw.level ?? 1),
    is_active: Boolean(raw.isActive ?? raw.is_active ?? true),
    version: 1,
    created_at: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
    updated_at: String(raw.updatedAt ?? raw.updated_at ?? new Date().toISOString()),
  };
}

async function fetchWcsCharactersForUserId(
  userId: string,
  playerId: string,
  token: string | null,
): Promise<ServerCharacter[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-User-Id': userId };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(
      `${WCS_ORIGIN}/api/characters?userId=${encodeURIComponent(userId)}`,
      { headers },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.characters ?? []);
    if (!Array.isArray(list) || list.length === 0) return [];

    return list.map((row: Record<string, unknown>, i: number) => {
      const sc = wcsToServerCharacter(row, playerId);
      sc.is_active = i === 0;
      return sc;
    });
  } catch {
    return [];
  }
}

/** Fetch fleet heroes from WCS and adapt to RTS ServerCharacter rows */
export async function fetchFleetCharactersAsServer(
  playerId: string,
): Promise<ServerCharacter[]> {
  const token = getFleetAuthToken();
  const candidates = characterUserIdCandidates(playerId);
  if (candidates.length === 0) return [];

  for (const userId of candidates) {
    const chars = await fetchWcsCharactersForUserId(userId, playerId, token);
    if (chars.length > 0) return chars;
  }

  return [];
}