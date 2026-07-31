/**
 * useCharacterAPI — Client interface to the cross-game character registry.
 *
 * Warlords era (production):
 *   1. Fleet Railway heroes via Bearer SSO (`?era=warlords`) — preferred
 *   2. Legacy native /api/characters/:playerId (Express/MySQL when present)
 *
 * Create in production goes to Character Studio (Foundry), not local POST.
 */

import { useCallback, useEffect, useState } from "react";
import { getPlayerId } from "@/lib/save/playerId";
import {
  fetchFleetCharactersAsServer,
  getFleetAuthToken,
  grudge6RaceModelPath,
} from "@/lib/characters/fleetCharacterBridge";
import { navigateToGcsCreate } from "@/lib/gcsRedirect";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CharacterAppearance {
  matColors?: Record<string, string | null>;
  bodyMorph?: Record<string, number>;
  weaponOffset?: Record<string, unknown>;
  scale?: number;
  speedMult?: number;
  // ── Captain promotion metadata (set when a level-100 unit is promoted) ──
  /** Where this character originated, e.g. "promoted-unit". */
  origin?: string;
  /** True when this playable character was promoted from an RTS unit. */
  isCaptain?: boolean;
  /** The original ally id the captain was promoted from. */
  sourceUnitId?: string;
  /** Per-profession levels inherited from the promoted unit. */
  professionLevels?: Record<string, number>;
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

function authJsonHeaders(): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const token = getFleetAuthToken();
  if (token) {
    h.Authorization = `Bearer ${token}`;
    h["X-Session-Token"] = token;
  }
  return h;
}

async function apiGet(playerId: string, path = ""): Promise<any> {
  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(playerId)}${path}`,
    { headers: authJsonHeaders(), credentials: "include" },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GET ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function apiPost(playerId: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(playerId)}`, {
    method: "POST",
    headers: authJsonHeaders(),
    credentials: "include",
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
      headers: authJsonHeaders(),
      credentials: "include",
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
    { method: "DELETE", headers: authJsonHeaders(), credentials: "include" },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`DELETE ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

function ensureGrudge6Paths(chars: ServerCharacter[]): ServerCharacter[] {
  return chars.map((c) => {
    const race = (c.race || "human").toLowerCase();
    const path = c.model_path || "";
    const brokenLocal =
      !path ||
      path.startsWith("/models/characters/") ||
      (path.startsWith("/models/") && !path.includes("grudge6") && !path.startsWith("http"));
    if (brokenLocal || path.endsWith(".fbx")) {
      return { ...c, model_path: grudge6RaceModelPath(race) };
    }
    return c;
  });
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
  /** Create a new character (auto-activates it; production default level 20) */
  create: (data: {
    name?: string;
    heroClass?: string;
    race?: string;
    modelPath?: string;
    appearance?: CharacterAppearance;
    equipment?: CharacterEquipment;
    level?: number;
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

    // 1) Warlords fleet SSOT (Railway via rewrite or direct) — preferred
    try {
      const fleet = await fetchFleetCharactersAsServer(playerId);
      if (fleet.length > 0) {
        setCharacters(ensureGrudge6Paths(fleet));
        setStatus("ready");
        return;
      }
    } catch (e: any) {
      console.warn("[useCharacterAPI] fleet bridge", e?.message || e);
    }

    // 2) Legacy native RTS player-scoped registry
    try {
      const data = await apiGet(playerId);
      const native = ensureGrudge6Paths(data.characters ?? []);
      if (native.length > 0) {
        setCharacters(native);
        setStatus("ready");
        return;
      }
      setCharacters([]);
      setStatus("ready");
    } catch (e: any) {
      // No heroes yet is not an error — empty roster is valid
      if (getFleetAuthToken()) {
        setCharacters([]);
        setStatus("ready");
        setError(null);
      } else {
        setError(
          e?.message
            ? `${e.message} — sign in with Grudge ID to load Warlords heroes.`
            : "Sign in with Grudge ID to load Warlords heroes.",
        );
        setStatus("error");
      }
    }
  }, [playerId]);

  // Auto-fetch on mount + when SSO token lands (post-redirect)
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (
        ev.key === "grudge_auth_token" ||
        ev.key === "grudge_session_token" ||
        ev.key === "sso_token" ||
        ev.key === "grudge_id"
      ) {
        void refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const create = useCallback(async (input: {
    name?: string;
    heroClass?: string;
    race?: string;
    modelPath?: string;
    appearance?: CharacterAppearance;
    equipment?: CharacterEquipment;
    level?: number;
  }): Promise<ServerCharacter> => {
    // Production Warlords: create in Foundry (GCS), not legacy MySQL forge
    if (typeof window !== "undefined" && !/localhost|127\.0\.0\.1/.test(window.location.hostname)) {
      navigateToGcsCreate("/character");
      // Unreachable after navigation; satisfy type
      throw new Error("Redirecting to Character Studio (warlords era create)");
    }
    const data = await apiPost(playerId, {
      ...input,
      level: input.level ?? 20,
      modelPath: input.modelPath || grudge6RaceModelPath(input.race),
    });
    const char = data.character as ServerCharacter;
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
