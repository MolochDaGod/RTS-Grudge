/**
 * Grudge Warlords — island taxonomy.
 *
 * Every island authored in the island editor belongs to one of these
 * top-level categories. Each category is rendered the same way at runtime
 * but drives different persistence, multiplayer, and gameplay rules:
 *
 *   home    — a private, player-owned island. One per captain; persists
 *             builds, resource nodes, and crew gouldstones. Other players
 *             may visit via invite but cannot permanently modify it.
 *   pve     — a procedural or curated PvE zone used for harvesting,
 *             missions, and co-op encounters. Progress is per-run; the
 *             base layout is authoritative (shared across players).
 *   event   — a time-boxed event map (festivals, raids, seasonal
 *             content). Lives in R2 under an event prefix, is swapped
 *             in and out of rotation by the backend, and carries an
 *             `activeFrom`/`activeTo` window.
 *   main    — a main-questline island. Authored once, versioned, and
 *             served to all players. Treated as read-only content by the
 *             client; only admin accounts can save back to R2.
 */

export type IslandType = 'home' | 'pve' | 'event' | 'main';

export interface IslandTypeMeta {
  id: IslandType;
  label: string;
  icon: string;
  description: string;
  /** Bucket prefix used when serializing this island to R2. */
  assetPrefix: string;
  /** Logical audience — who may edit / own / visit the island. */
  ownership: 'player' | 'shared' | 'admin';
  /** Whether the island can be instanced (each player gets their own copy). */
  instanced: boolean;
  /** PvP enabled by default. */
  pvp: boolean;
}

export const ISLAND_TYPES: Record<IslandType, IslandTypeMeta> = {
  home: {
    id: 'home',
    label: 'Home Island',
    icon: '🏡',
    description: 'Private player-owned island. Persists buildings and harvesting state.',
    assetPrefix: 'game/islands/home',
    ownership: 'player',
    instanced: true,
    pvp: false,
  },
  pve: {
    id: 'pve',
    label: 'PvE Island',
    icon: '⚔️',
    description: 'Shared PvE zone for harvesting, missions, and co-op encounters.',
    assetPrefix: 'game/islands/pve',
    ownership: 'shared',
    instanced: true,
    pvp: false,
  },
  event: {
    id: 'event',
    label: 'Event Island',
    icon: '🎪',
    description: 'Time-boxed event map swapped in and out of rotation by the backend.',
    assetPrefix: 'game/islands/event',
    ownership: 'admin',
    instanced: false,
    pvp: false,
  },
  main: {
    id: 'main',
    label: 'Main-Story Island',
    icon: '🏰',
    description: 'Main-questline island authored once and served read-only to all players.',
    assetPrefix: 'game/islands/main',
    ownership: 'admin',
    instanced: false,
    pvp: false,
  },
};

export const ISLAND_TYPE_ORDER: IslandType[] = ['home', 'pve', 'event', 'main'];

/** Compose the R2 key where an island's JSON payload is stored. */
export function islandSaveKey(type: IslandType, slug: string): string {
  const clean = slug.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${ISLAND_TYPES[type].assetPrefix}/${clean}.json`;
}

/** Parse a CDN key back into `{ type, slug }`. Returns null on miss. */
export function parseIslandSaveKey(key: string): { type: IslandType; slug: string } | null {
  const match = key.match(/^game\/islands\/(home|pve|event|main)\/([^/]+)\.json$/i);
  if (!match) return null;
  return { type: match[1].toLowerCase() as IslandType, slug: match[2] };
}

export function isIslandType(value: unknown): value is IslandType {
  return typeof value === 'string' && (ISLAND_TYPE_ORDER as string[]).includes(value);
}
