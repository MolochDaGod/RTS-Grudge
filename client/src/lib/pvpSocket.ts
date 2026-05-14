/**
 * PvP Socket.IO client — singleton connection manager.
 *
 * Connects to the Grudge PvP server (Socket.IO at /pvp path).
 * The URL is resolved from VITE_PVP_URL at build time or
 * falls back to the same origin in production.
 *
 * Usage:
 *   import { getPvPSocket, disconnectPvP } from "@/lib/pvpSocket";
 *   const socket = getPvPSocket();         // lazy connect
 *   socket.emit("lobby:list", (games) => { ... });
 */
import { io, type Socket } from "socket.io-client";

// ── Types matching the grudge-pvp-server protocol ────────────────────────────

export interface RoomSummary {
  roomId: string;
  gameMode: string;
  maxPlayers: number;
  playerCount: number;
  status: "waiting" | "in-progress" | "finished";
  createdBy: string;
  gameSettings: Record<string, unknown>;
  createdAt: number;
}

export interface CreateGameOptions {
  gameMode?: string;
  maxPlayers?: number;
  gameSettings?: Record<string, unknown>;
}

export interface CreateGameResult {
  success: boolean;
  roomId: string;
  slot: "p1" | "p2";
  room: RoomSummary;
}

export interface JoinGameResult {
  success: boolean;
  slot: "p1" | "p2";
  roomId: string;
  room: RoomSummary;
  opponentCharacter: string | null;
  error?: string;
}

export interface FightStartPayload {
  p1Character: string;
  p2Character: string;
}

// ── Server → Client events ───────────────────────────────────────────────────

export interface PvPServerEvents {
  "lobby:game-updated": (room: RoomSummary) => void;
  "lobby:game-removed": (data: { roomId: string }) => void;
  "room:opponent-joined": () => void;
  "room:opponent-picked": (data: { characterId: string }) => void;
  "room:opponent-left": () => void;
  "fight:start": (payload: FightStartPayload) => void;
  "input:remote": (data: { frame: number; keys: Record<string, boolean> }) => void;
  "action:remote": (data: { action: string; params: unknown }) => void;
}

// ── Client → Server events ───────────────────────────────────────────────────

export interface PvPClientEvents {
  "lobby:list": (cb: (games: RoomSummary[]) => void) => void;
  "lobby:create-game": (options: CreateGameOptions, cb: (result: CreateGameResult) => void) => void;
  "lobby:join-game": (roomId: string, cb: (result: JoinGameResult) => void) => void;
  "room:pick": (data: { roomId: string; characterId: string }) => void;
  "room:ready": (data: { roomId: string }) => void;
  "input": (data: { roomId: string; frame: number; keys: Record<string, boolean> }) => void;
  "action": (data: { roomId: string; action: string; params: unknown }) => void;
}

// ── Singleton ────────────────────────────────────────────────────────────────

const PVP_URL = (import.meta as any).env?.VITE_PVP_URL as string | undefined;

let _socket: Socket<PvPServerEvents, PvPClientEvents> | null = null;

export function getPvPSocket(): Socket<PvPServerEvents, PvPClientEvents> {
  if (!_socket) {
    const url = PVP_URL || window.location.origin;
    _socket = io(url, {
      path: "/pvp",
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    _socket.on("connect", () => {
      console.log("[pvp] connected:", _socket!.id);
    });

    _socket.on("disconnect", (reason) => {
      console.log("[pvp] disconnected:", reason);
    });

    _socket.on("connect_error", (err) => {
      console.warn("[pvp] connection error:", err.message);
    });
  }
  return _socket;
}

export function disconnectPvP() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

export function isPvPConnected(): boolean {
  return _socket?.connected ?? false;
}
