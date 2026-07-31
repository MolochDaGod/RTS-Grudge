/**
 * Fleet character bridge — Warlords-era SSOT.
 *
 * Loads Railway heroes (`?era=warlords`) with Grudge ID bearer auth and maps
 * them into RTS ServerCharacter rows with **CDN grudge6** modular race GLBs.
 *
 * Do NOT use WCS Vercel partial APIs or local /models/* shells on production —
 * Vercel SPA rewrites fake-200 empty asset paths.
 */

import type { ServerCharacter } from "./useCharacterAPI";
import {
  GRUDGE6_CDN,
  RACE_CONFIGS,
} from "@/game/character/FactionCharacterRegistry";

const ERA = "warlords";
const RAILWAY =
  import.meta.env.VITE_RAILWAY_GAME_API ||
  "https://grudge-api-production-0d46.up.railway.app";
const CLIENT_ORIGIN =
  import.meta.env.VITE_WCS_URL ||
  import.meta.env.VITE_CLIENT_URL ||
  "https://client.grudge-studio.com";

/** Production GLB on R2 (not SPA-fallback paths). */
const RACE_GLB: Record<string, string> = {
  human: `${GRUDGE6_CDN}/races/WK_Characters.glb`,
  barbarian: `${GRUDGE6_CDN}/races/BRB_Characters.glb`,
  elf: `${GRUDGE6_CDN}/races/ELF_Characters.glb`,
  dwarf: `${GRUDGE6_CDN}/races/DWF_Characters.glb`,
  orc: `${GRUDGE6_CDN}/races/ORC_Characters.glb`,
  undead: `${GRUDGE6_CDN}/races/UD_Characters.glb`,
};

const CLASS_TO_COMBAT: Record<string, string> = {
  warrior: "melee",
  mage: "magic",
  ranger: "ranger",
  rogue: "ranger",
  cleric: "melee",
  worg: "melee",
  worge: "melee",
};

const CLASS_TO_WEAPON: Record<string, { right: string; left: string | null }> = {
  warrior: { right: "sword", left: "shield" },
  mage: { right: "staff", left: null },
  ranger: { right: "bow", left: null },
  rogue: { right: "dagger", left: null },
  cleric: { right: "hammer", left: "shield" },
  worg: { right: "axe", left: null },
  worge: { right: "fists", left: null },
};

export function getFleetAuthToken(): string | null {
  try {
    return (
      localStorage.getItem("grudge_auth_token") ||
      localStorage.getItem("grudge_session_token") ||
      localStorage.getItem("sso_token") ||
      localStorage.getItem("grudge.token") ||
      localStorage.getItem("access_token") ||
      null
    );
  } catch {
    return null;
  }
}

export function getFleetGrudgeId(): string | null {
  try {
    return (
      localStorage.getItem("grudge_id") ||
      localStorage.getItem("grudge_account_id") ||
      null
    );
  } catch {
    return null;
  }
}

/** Resolve warlords race → CDN grudge6 modular kit GLB. */
export function grudge6RaceModelPath(raceId: string | null | undefined): string {
  const key = String(raceId || "human")
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (RACE_GLB[key]) return RACE_GLB[key];
  const cfg = RACE_CONFIGS[key];
  if (cfg?.prefix) {
    const pfx = cfg.prefix.replace(/_$/, "");
    return `${GRUDGE6_CDN}/races/${pfx}_Characters.glb`;
  }
  return RACE_GLB.human;
}

function authHeaders(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const token = getFleetAuthToken();
  if (token) {
    h.Authorization = `Bearer ${token}`;
    h["X-Session-Token"] = token;
  }
  const gid = getFleetGrudgeId();
  if (gid) h["X-Grudge-Id"] = gid;
  return h;
}

function extractList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    for (const k of ["characters", "data", "results", "items"]) {
      if (Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
    }
  }
  return [];
}

function fleetRowToServer(
  raw: Record<string, unknown>,
  playerId: string,
  index: number,
): ServerCharacter {
  const raceId = String(
    raw.raceId ?? raw.race_id ?? raw.race ?? "human",
  ).toLowerCase();
  const classId = String(
    raw.classId ?? raw.class_id ?? raw.class ?? raw.heroClass ?? "warrior",
  ).toLowerCase();
  const weapons = CLASS_TO_WEAPON[classId] ?? CLASS_TO_WEAPON.warrior;
  const charId = String(
    raw.id ?? raw.character_id ?? raw.characterId ?? `fleet_${raceId}_${index}`,
  );

  const modelFromServer =
    (typeof raw.modelPath === "string" && raw.modelPath) ||
    (typeof raw.model_path === "string" && raw.model_path) ||
    (raw.model3d &&
      typeof raw.model3d === "object" &&
      typeof (raw.model3d as { glbUrl?: string }).glbUrl === "string" &&
      (raw.model3d as { glbUrl: string }).glbUrl) ||
    null;

  // Prefer CDN grudge6 modular kit for warlords races; only keep absolute CDN URLs
  const isWarlordsRace = raceId in RACE_GLB || !!RACE_CONFIGS[raceId];
  const model_path =
    modelFromServer &&
    /^https?:\/\//i.test(modelFromServer) &&
    !modelFromServer.includes("localhost")
      ? modelFromServer
      : isWarlordsRace
        ? grudge6RaceModelPath(raceId)
        : grudge6RaceModelPath("human");

  const equipment =
    raw.equipment && typeof raw.equipment === "object"
      ? (raw.equipment as Record<string, unknown>)
      : {};

  return {
    player_id: playerId,
    character_id: charId,
    name: String(raw.name ?? raw.characterName ?? "Hero"),
    hero_class: classId,
    race: raceId,
    model_path,
    appearance: {
      scale: 1,
      speedMult: 1,
      matColors: {},
      bodyMorph: {},
      ...(typeof raw.appearance === "object" && raw.appearance
        ? (raw.appearance as object)
        : {}),
    },
    equipment: {
      combatClass: String(
        equipment.combatClass ?? CLASS_TO_COMBAT[classId] ?? "melee",
      ),
      weaponRight: String(equipment.weaponRight ?? weapons.right),
      weaponLeft:
        equipment.weaponLeft !== undefined
          ? (equipment.weaponLeft as string | null)
          : weapons.left,
      weaponModelRight: (equipment.weaponModelRight as string | null) ?? null,
      weaponModelLeft: (equipment.weaponModelLeft as string | null) ?? null,
      arrowModelId:
        (equipment.arrowModelId as string | null) ??
        (classId === "ranger" ? "arrow_default" : null),
      backAccessoryId: (equipment.backAccessoryId as string | null) ?? null,
    },
    level: Number(raw.level ?? 20) || 20,
    is_active: Boolean(
      raw.isActive ?? raw.is_active ?? raw.active ?? index === 0,
    ),
    version: Number(raw.version ?? 1) || 1,
    created_at: String(
      raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    ),
    updated_at: String(
      raw.updatedAt ?? raw.updated_at ?? new Date().toISOString(),
    ),
  };
}

async function fetchEraCharacters(
  url: string,
  playerId: string,
): Promise<ServerCharacter[]> {
  const res = await fetch(url, {
    headers: authHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) throw new Error("HTML (not API)");
  const json = await res.json();
  const list = extractList(json);
  if (!list.length) return [];
  return list.map((row, i) => fleetRowToServer(row, playerId, i));
}

/**
 * Load Warlords-era heroes for the signed-in fleet account.
 * Cascade: same-origin rewrite → Railway → client.grudge-studio.com
 */
export async function fetchFleetCharactersAsServer(
  playerId: string,
): Promise<ServerCharacter[]> {
  const token = getFleetAuthToken();
  const qs = new URLSearchParams({ era: ERA });
  const gid = getFleetGrudgeId();
  if (gid) qs.set("userId", gid);

  const endpoints: string[] = [
    `/api/characters?${qs}`,
    `${RAILWAY}/api/characters?${qs}`,
  ];
  // Only hit WCS/client when authenticated — anonymous will 401 either way
  if (token) {
    endpoints.push(`${CLIENT_ORIGIN}/api/characters?${qs}`);
  }

  for (const url of endpoints) {
    try {
      const chars = await fetchEraCharacters(url, playerId);
      if (chars.length > 0) {
        // Ensure exactly one active
        let sawActive = false;
        return chars.map((c, i) => {
          if (c.is_active && !sawActive) {
            sawActive = true;
            return c;
          }
          if (c.is_active && sawActive) return { ...c, is_active: false };
          if (!sawActive && i === 0) {
            sawActive = true;
            return { ...c, is_active: true };
          }
          return { ...c, is_active: false };
        });
      }
    } catch (e) {
      console.warn("[fleetCharacterBridge] fail", url, e);
    }
  }
  return [];
}
