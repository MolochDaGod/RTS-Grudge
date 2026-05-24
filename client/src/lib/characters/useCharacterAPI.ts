/**
 * useCharacterAPI — Client interface to the cross-game character registry.
 *
 * Any Grudge Studio game can use this to:
 *   - Fetch the player's characters (or just the active one)
 *   - Create a new character from Hero Forge
 *   - Update appearance, equipment, or level
 *   - Activate a character for the current session
 *
 * All data flows through /api/characters → server/characterRoutes.ts → MySQL.
 * No localStorage dependency — server is the sole source of truth.
 */

import { useCallback, useEffect, useState } from "react";
import { getPlayerId } from "@/lib/save/playerId";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CharacterAppearance {
  matColors?: Record<string, string | null>;
  bodyMorph?: Record<string, number>;
  weaponOffset?: Record<string, unknown>;
  scale?: number;
  speedMult?: number;
}

export interface CharacterEquipment {
  combatClass?: string;
  weaponRight?: string;
  weaponLeft?: string | null;
  weaponModelRight?: string | null;
  weaponModelLeft?: string | null;
  arrowModelId?: string | null;
  backAccessoryId?: string | null;
}

export interface ServerCharacter {
  player_id: string;
  character_id: string;
  name: string;
  hero_class: string;
  race: string;
  model_path: string | null;
  appearance: CharacterAppearance;
  equipment: CharacterEquipment;
  level: number;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export type CharacterAPIStatus = "idle" | "loading" | "ready" | "error";

// ── API helpers ──────────────────────────────────────────────────────────────

const API_BASE = "/api/characters";

async function apiGet(playerId: string, path = ""): Promise<any> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(playerId)}${path}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GET ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function apiPost(playerId: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(playerId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`POST ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function apiPut(
  playerId: string,
  characterId: string,
  body: Record<string, unknown>,
  suffix = "",
): Promise<any> {
  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(playerId)}/${encodeURIComponent(characterId)}${suffix}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`PUT ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function apiDelete(playerId: string, characterId: string): Promise<any> {
  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(playerId)}/${encodeURIComponent(characterId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`DELETE ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseCharacterAPIResult {
  /** All characters for the current player */
  characters: ServerCharacter[];
  /** The currently active character (convenience) */
  active: ServerCharacter | null;
  status: CharacterAPIStatus;
  error: string | null;

  /** Fetch all characters from server */
  refresh: () => Promise<void>;
  /** Create a new character (auto-activates it) */
  create: (data: {
    name?: string;
    heroClass?: string;
    race?: string;
    modelPath?: string;
    appearance?: CharacterAppearance;
    equipment?: CharacterEquipment;
  }) => Promise<ServerCharacter>;
  /** Update an existing character */
  update: (characterId: string, data: {
    name?: string;
    heroClass?: string;
    race?: string;
    modelPath?: string;
    appearance?: CharacterAppearance;
    equipment?: CharacterEquipment;
    level?: number;
  }) => Promise<ServerCharacter>;
  /** Delete a character */
  remove: (characterId: string) => Promise<void>;
  /** Set a character as active */
  activate: (characterId: string) => Promise<ServerCharacter>;
}

export function useCharacterAPI(playerIdOverride?: string): UseCharacterAPIResult {
  const [characters, setCharacters] = useState<ServerCharacter[]>([]);
  const [status, setStatus] = useState<CharacterAPIStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const playerId = playerIdOverride ?? getPlayerId();

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const data = await apiGet(playerId);
      setCharacters(data.characters ?? []);
      setStatus("ready");
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    }
  }, [playerId]);

  // Auto-fetch on mount
  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (input: {
    name?: string;
    heroClass?: string;
    race?: string;
    modelPath?: string;
    appearance?: CharacterAppearance;
    equipment?: CharacterEquipment;
  }): Promise<ServerCharacter> => {
    const data = await apiPost(playerId, input);
    const char = data.character as ServerCharacter;
    // Refresh full list (new char is active, others deactivated)
    await refresh();
    return char;
  }, [playerId, refresh]);

  const update = useCallback(async (characterId: string, input: {
    name?: string;
    heroClass?: string;
    race?: string;
    modelPath?: string;
    appearance?: CharacterAppearance;
    equipment?: CharacterEquipment;
    level?: number;
  }): Promise<ServerCharacter> => {
    const data = await apiPut(playerId, characterId, input);
    const char = data.character as ServerCharacter;
    setCharacters(prev => prev.map(c => c.character_id === characterId ? char : c));
    return char;
  }, [playerId]);

  const remove = useCallback(async (characterId: string): Promise<void> => {
    await apiDelete(playerId, characterId);
    setCharacters(prev => prev.filter(c => c.character_id !== characterId));
  }, [playerId]);

  const activate = useCallback(async (characterId: string): Promise<ServerCharacter> => {
    const data = await apiPut(playerId, characterId, {}, "/activate");
    const char = data.character as ServerCharacter;
    setCharacters(prev => prev.map(c => ({
      ...c,
      is_active: c.character_id === characterId,
    })));
    return char;
  }, [playerId]);

  const active = characters.find(c => c.is_active) ?? null;

  return { characters, active, status, error, refresh, create, update, remove, activate };
}
