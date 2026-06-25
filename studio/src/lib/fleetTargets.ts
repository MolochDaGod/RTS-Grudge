/**
 * Fleet games that publish scenes from Grudge Studio Forge.
 */
import { FLEET_STACKS, FORGE_TOOLCHAIN, type GameStack } from "./forgeStack";

export type FleetGameId = keyof typeof FLEET_STACKS;

export interface FleetGameTarget {
  id: FleetGameId;
  label: string;
  shortLabel: string;
  liveUrl: string;
  apiBase: string;
  assetsCdn: string;
  objectStore: string;
  stack: GameStack;
}

const API = "https://api.grudge-studio.com";
const CDN = "https://assets.grudge-studio.com";
const OS = "https://objectstore.grudge-studio.com";

export const FLEET_GAMES: FleetGameTarget[] = [
  {
    id: "warlords",
    label: "Grudge Warlords",
    shortLabel: "Warlords",
    liveUrl: "https://grudgewarlords.com",
    apiBase: API,
    assetsCdn: CDN,
    objectStore: OS,
    stack: FLEET_STACKS.warlords,
  },
  {
    id: "rts-grudge",
    label: "RTS Grudge",
    shortLabel: "RTS",
    liveUrl: "https://rts-grudge.vercel.app",
    apiBase: API,
    assetsCdn: CDN,
    objectStore: OS,
    stack: FLEET_STACKS["rts-grudge"],
  },
  {
    id: "dcq",
    label: "Dungeon Crawler Quest",
    shortLabel: "DCQ",
    liveUrl: "https://dcq.grudge-studio.com",
    apiBase: API,
    assetsCdn: CDN,
    objectStore: OS,
    stack: FLEET_STACKS.dcq,
  },
];

export { FORGE_TOOLCHAIN };

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