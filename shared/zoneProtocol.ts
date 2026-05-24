/**
 * zoneProtocol — Shared types for the MMO zone multiplayer system.
 *
 * Used by both server (zoneManager.ts) and client (useZoneSession.ts).
 * All zone:* Socket.IO events conform to these shapes.
 */

// ── Zone IDs (mirrors WorldGridRegistry.ZoneId) ──────────────────────────────

export type ZoneId =
  | "plains" | "coast" | "forest" | "desert" | "swamp"
  | "snow" | "lava" | "jungle" | "mountains";

// ── Remote player representation ─────────────────────────────────────────────

export interface RemotePlayer {
  playerId: string;
  characterName: string;
  heroClass: string;
  modelPath: string;
  level: number;
  /** World-space position */
  position: [number, number, number];
  /** Y-axis rotation (radians) */
  rotation: number;
  /** Current animation state (idle, run, attack, etc.) */
  animation: string;
  /** Current health (for nameplate bar) */
  health: number;
  maxHealth: number;
  /** Faction for nameplate color */
  faction: string;
}

// ── Zone state snapshot (sent on join) ────────────────────────────────────────

export interface ZoneSnapshot {
  channelId: string;
  zoneId: ZoneId;
  players: RemotePlayer[];
  /** Enemy positions + HP for the zone (server-authoritative) */
  enemies: ZoneEnemy[];
  /** Resource node states (harvested or available) */
  resources: ZoneResource[];
}

export interface ZoneEnemy {
  id: string;
  type: string;
  position: [number, number, number];
  health: number;
  maxHealth: number;
  /** Target player ID (if aggro'd) */
  targetId: string | null;
}

export interface ZoneResource {
  id: string;
  type: string;
  position: [number, number, number];
  /** False = harvested (respawning) */
  available: boolean;
  /** Seconds until respawn (if harvested) */
  respawnIn: number;
}

// ── Client → Server events ───────────────────────────────────────────────────

export interface ZoneClientEvents {
  /** Join a zone. Server assigns best channel. */
  "zone:join": (
    data: { zoneId: ZoneId; channelPreference?: string },
    cb: (result: ZoneJoinResult) => void,
  ) => void;

  /** Leave current zone channel. */
  "zone:leave": (data: { channelId: string }) => void;

  /** Position + animation update (client sends at 10Hz). */
  "zone:move": (data: {
    pos: [number, number, number];
    rot: number;
    anim: string;
  }) => void;

  /** Action (attack, harvest, build, etc.). */
  "zone:action": (data: {
    type: "attack" | "harvest" | "build" | "interact";
    targetId?: string;
    params?: Record<string, unknown>;
  }) => void;

  /** Zone chat message. */
  "zone:chat": (data: { message: string }) => void;

  /** Request to join a home island session. */
  "island:join": (
    data: { sessionCode: string },
    cb: (result: IslandJoinResult) => void,
  ) => void;

  /** Create a home island session. */
  "island:create": (
    data: { playerId: string },
    cb: (result: IslandCreateResult) => void,
  ) => void;

  /** Leave home island. */
  "island:leave": () => void;
}

// ── Server → Client events ───────────────────────────────────────────────────

export interface ZoneServerEvents {
  /** A new player entered the zone channel. */
  "zone:player-joined": (data: RemotePlayer) => void;

  /** A player left the zone channel. */
  "zone:player-left": (data: { playerId: string }) => void;

  /** Batched position updates for nearby players (10Hz). */
  "zone:player-moved": (data: {
    playerId: string;
    pos: [number, number, number];
    rot: number;
    anim: string;
  }) => void;

  /** Result of a zone action (combat, harvest, etc.). */
  "zone:action-result": (data: {
    playerId: string;
    type: string;
    result: Record<string, unknown>;
  }) => void;

  /** Server-authoritative enemy update (10Hz). */
  "zone:enemy-update": (data: { enemies: ZoneEnemy[] }) => void;

  /** Resource node state change (harvested/respawned). */
  "zone:resource-update": (data: {
    nodeId: string;
    available: boolean;
    respawnIn: number;
  }) => void;

  /** Zone chat from another player. */
  "zone:chat-message": (data: {
    playerId: string;
    characterName: string;
    message: string;
    timestamp: number;
  }) => void;

  /** Home island player joined. */
  "island:player-joined": (data: RemotePlayer) => void;

  /** Home island player left. */
  "island:player-left": (data: { playerId: string }) => void;
}

// ── Result types ─────────────────────────────────────────────────────────────

export interface ZoneJoinResult {
  success: boolean;
  channelId: string;
  snapshot: ZoneSnapshot;
  error?: string;
}

export interface IslandJoinResult {
  success: boolean;
  sessionCode: string;
  hostPlayerId: string;
  players: RemotePlayer[];
  error?: string;
}

export interface IslandCreateResult {
  success: boolean;
  sessionCode: string;
  error?: string;
}

// ── Channel info (for server-side management) ────────────────────────────────

export interface ZoneChannelInfo {
  channelId: string;
  zoneId: ZoneId;
  playerCount: number;
  createdAt: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Max players per zone channel before a new channel is spawned. */
export const ZONE_CHANNEL_SOFT_CAP = 50;

/** Interest radius — only receive updates for players within this distance. */
export const INTEREST_RADIUS = 50;

/** Beyond this distance, unsubscribe from server updates entirely. */
export const UNSUBSCRIBE_RADIUS = 100;

/** Server sends position batches at this rate (Hz). */
export const POSITION_UPDATE_HZ = 10;

/** Max players on a home island (host + guests). */
export const HOME_ISLAND_MAX_PLAYERS = 4;

/** Empty channel garbage collection delay (ms). */
export const CHANNEL_GC_DELAY_MS = 60_000;
