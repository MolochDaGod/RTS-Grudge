/**
 * Home Island API — bridges RTS-Grudge procedural islands to Grudge Warlords
 * persisted home islands (UUID + Railway Postgres SSOT).
 *
 * Flow:
 *   1. GET  /api/island/status  — account linkage + UUID
 *   2. POST /api/island/export-from-rts — server generates all zones + mountain triad
 *   3. POST /api/island/initialize — mark cutscene complete + mint cNFT
 */

import { getStoredToken, hasValidToken } from "@/lib/auth/GrudgeSession";
import type { IslandBiome, IslandData } from "@/lib/stores/useIslandWorld";

export const WARLORDS_HOME_ISLAND_URL = "https://grudgewarlords.com/home-island";

export type WarlordsMapStyle = "iron" | "fantasy" | "tactical" | "night";

export interface HomeIslandStatus {
  homeIsland: boolean;
  homeIslandId: string | null;
  homeIslandMintActionId: string | null;
}

export interface HomeIslandRecord {
  id: string;
  accountId: string;
  seed: string;
  name: string;
  mapStyle: WarlordsMapStyle;
  mapImageUrl?: string | null;
  state: HomeIslandExportState;
}

export interface RtsIslandExportMeta {
  source: "rts-grudge";
  gridX: number;
  gridZ: number;
  seed: number;
  biome: IslandBiome;
  exportedAt: number;
  appUrl: string;
}

export interface HomeIslandExportState {
  id: string;
  mapStyle: WarlordsMapStyle;
  mapImageUrl?: string;
  nodes: unknown[];
  sheep: unknown[];
  skinningNodes: unknown[];
  assignedHeroes: Record<string, string>;
  createdAt: number;
  lastUpdate: number;
  rtsExport?: RtsIslandExportMeta;
}

export interface ExportHomeIslandResult {
  ok: boolean;
  homeIslandId: string | null;
  islandSeed: string | null;
  initialized: boolean;
  error?: string;
  warlordsUrl: string;
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return await res.json() as T;
  } catch {
    return null;
  }
}

export function biomeToMapStyle(biome: IslandBiome): WarlordsMapStyle {
  switch (biome) {
    case "volcanic": return "iron";
    case "pirate":   return "tactical";
    case "arctic":
    case "cursed":   return "night";
    case "temperate":
    case "tropical":
    default:         return "fantasy";
  }
}

export function buildExportStateFromRtsIsland(
  island: IslandData,
  islandUuid: string,
  existing?: Partial<HomeIslandExportState>,
): HomeIslandExportState {
  const now = Date.now();
  const mapStyle = biomeToMapStyle(island.biome);

  return {
    id: islandUuid,
    mapStyle,
    mapImageUrl: existing?.mapImageUrl,
    nodes: existing?.nodes ?? [],
    sheep: existing?.sheep ?? [],
    skinningNodes: existing?.skinningNodes ?? [],
    assignedHeroes: existing?.assignedHeroes ?? {},
    createdAt: existing?.createdAt ?? now,
    lastUpdate: now,
    rtsExport: {
      source: "rts-grudge",
      gridX: island.gridX,
      gridZ: island.gridZ,
      seed: island.seed,
      biome: island.biome,
      exportedAt: now,
      appUrl: typeof window !== "undefined" ? window.location.origin : "https://rts-grudge.vercel.app",
    },
  };
}

export async function fetchHomeIslandStatus(): Promise<HomeIslandStatus | null> {
  const res = await fetch("/api/island/status", { headers: authHeaders() });
  if (!res.ok) return null;
  return parseJson<HomeIslandStatus>(res);
}

export async function fetchHomeIsland(): Promise<HomeIslandRecord | null> {
  const res = await fetch("/api/island", { headers: authHeaders() });
  if (!res.ok) return null;
  return parseJson<HomeIslandRecord>(res);
}

export async function patchHomeIslandState(state: HomeIslandExportState): Promise<boolean> {
  const res = await fetch("/api/island/state", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ state }),
  });
  return res.ok;
}

export async function initializeHomeIsland(): Promise<boolean> {
  const res = await fetch("/api/island/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  return res.ok;
}

export async function requestHomeIslandMap(): Promise<string | null> {
  const res = await fetch("/api/island/generate-map", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  if (!res.ok) return null;
  const data = await parseJson<{ mapImageUrl?: string }>(res);
  return data?.mapImageUrl ?? null;
}

/**
 * Export the RTS home island (grid 0,0) to the Warlords home-island backend.
 * Requires a Grudge JWT — guests are prompted to sign in first.
 */
export async function exportRtsIslandToHome(island: IslandData): Promise<ExportHomeIslandResult> {
  const warlordsUrl = WARLORDS_HOME_ISLAND_URL;

  if (!hasValidToken()) {
    return {
      ok: false,
      homeIslandId: null,
      islandSeed: null,
      initialized: false,
      error: "Sign in with Grudge ID to export your island to Warlords.",
      warlordsUrl,
    };
  }

  try {
    const status = await fetchHomeIslandStatus();
    if (!status) {
      return {
        ok: false,
        homeIslandId: null,
        islandSeed: null,
        initialized: false,
        error: "Could not reach the home island API.",
        warlordsUrl,
      };
    }

    const exportRes = await fetch("/api/island/export-from-rts", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        gridX: island.gridX,
        gridZ: island.gridZ,
        seed: island.seed,
        biome: island.biome,
        appUrl: typeof window !== "undefined" ? window.location.origin : "https://rts-grudge.vercel.app",
      }),
    });

    if (!exportRes.ok) {
      const err = await exportRes.json().catch(() => ({})) as { error?: string };
      return {
        ok: false,
        homeIslandId: status.homeIslandId,
        islandSeed: null,
        initialized: status.homeIsland,
        error: err.error ?? "Server rejected RTS island export.",
        warlordsUrl,
      };
    }

    const exported = await exportRes.json() as {
      homeIslandId?: string;
      island?: { seed?: string };
    };

    let initialized = status.homeIsland;
    if (!initialized) {
      initialized = await initializeHomeIsland();
    }

    // Best-effort map generation (R2/CDN URL stored on island record)
    requestHomeIslandMap().catch(() => {});

    return {
      ok: true,
      homeIslandId: exported.homeIslandId ?? status.homeIslandId,
      islandSeed: exported.island?.seed ?? null,
      initialized,
      warlordsUrl,
    };
  } catch (e) {
    return {
      ok: false,
      homeIslandId: null,
      islandSeed: null,
      initialized: false,
      error: e instanceof Error ? e.message : "Export failed",
      warlordsUrl,
    };
  }
}