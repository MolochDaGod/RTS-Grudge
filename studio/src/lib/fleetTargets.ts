/**
 * Fleet games that publish scenes from Grudge Studio Forge.
 * Used for deploy labels, API context, and cross-links back to live clients.
 */
export type FleetGameId = "warlords" | "rts-grudge" | "dcq";

export interface FleetGameTarget {
  id: FleetGameId;
  label: string;
  shortLabel: string;
  liveUrl: string;
  apiBase: string;
  assetsCdn: string;
  objectStore: string;
  engine: string;
}

export const FLEET_GAMES: FleetGameTarget[] = [
  {
    id: "warlords",
    label: "Grudge Warlords",
    shortLabel: "Warlords",
    liveUrl: "https://grudgewarlords.com",
    apiBase: "https://api.grudge-studio.com",
    assetsCdn: "https://assets.grudge-studio.com",
    objectStore: "https://objectstore.grudge-studio.com",
    engine: "R3F + Phaser + Node",
  },
  {
    id: "rts-grudge",
    label: "RTS Grudge",
    shortLabel: "RTS",
    liveUrl: "https://rts-grudge.vercel.app",
    apiBase: "https://api.grudge-studio.com",
    assetsCdn: "https://assets.grudge-studio.com",
    objectStore: "https://objectstore.grudge-studio.com",
    engine: "R3F + Rapier + Node",
  },
  {
    id: "dcq",
    label: "Dungeon Crawler Quest",
    shortLabel: "DCQ",
    liveUrl: "https://dcq.grudge-studio.com",
    apiBase: "https://api.grudge-studio.com",
    assetsCdn: "https://assets.grudge-studio.com",
    objectStore: "https://objectstore.grudge-studio.com",
    engine: "Three.js + Babylon/Havok",
  },
];

const STORAGE_KEY = "grudge-forge-target";

export function getActiveFleetTarget(): FleetGameTarget {
  try {
    const id = localStorage.getItem(STORAGE_KEY) as FleetGameId | null;
    return FLEET_GAMES.find((g) => g.id === id) ?? FLEET_GAMES[1];
  } catch {
    return FLEET_GAMES[1];
  }
}

export function setActiveFleetTarget(id: FleetGameId): FleetGameTarget {
  const hit = FLEET_GAMES.find((g) => g.id === id) ?? FLEET_GAMES[1];
  try {
    localStorage.setItem(STORAGE_KEY, hit.id);
  } catch {
    /* ignore */
  }
  return hit;
}