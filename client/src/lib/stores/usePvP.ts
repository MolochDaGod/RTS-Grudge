/**
 * PvP lobby & match state — zustand store backed by the Socket.IO client.
 *
 * Call `connectPvP()` to lazily boot the socket and subscribe to server
 * events. The store is the single source of truth for lobby listings,
 * current room, connection status, and in-fight remote input.
 */
import { create } from "zustand";
import {
  getPvPSocket, disconnectPvP, isPvPConnected,
  type RoomSummary, type CreateGameOptions, type FightStartPayload,
} from "../pvpSocket";

export type PvPPhase = "disconnected" | "lobby" | "room" | "fighting";

export interface PvPState {
  // Connection
  phase: PvPPhase;
  connected: boolean;

  // Lobby
  games: RoomSummary[];

  // Room
  roomId: string | null;
  slot: "p1" | "p2" | null;
  opponentCharacter: string | null;
  fightPayload: FightStartPayload | null;

  // Remote input (latest frame from opponent)
  remoteInput: { frame: number; keys: Record<string, boolean> } | null;
  remoteAction: { action: string; params: unknown } | null;

  // Actions
  connectPvP: () => void;
  disconnect: () => void;
  refreshLobby: () => void;
  createGame: (opts?: CreateGameOptions) => void;
  joinGame: (roomId: string) => void;
  pickCharacter: (characterId: string) => void;
  ready: () => void;
  sendInput: (frame: number, keys: Record<string, boolean>) => void;
  sendAction: (action: string, params: unknown) => void;
}

export const usePvP = create<PvPState>((set, get) => {
  let _subscribed = false;

  function subscribe() {
    if (_subscribed) return;
    _subscribed = true;
    const socket = getPvPSocket();

    socket.on("connect", () => {
      set({ connected: true, phase: "lobby" });
      // Auto-fetch lobby on connect
      socket.emit("lobby:list", (games) => set({ games }));
    });

    socket.on("disconnect", () => {
      set({ connected: false, phase: "disconnected" });
    });

    socket.on("lobby:game-updated", (room) => {
      set((s) => {
        const idx = s.games.findIndex((g) => g.roomId === room.roomId);
        const next = [...s.games];
        if (idx >= 0) next[idx] = room; else next.push(room);
        return { games: next };
      });
    });

    socket.on("lobby:game-removed", ({ roomId }) => {
      set((s) => ({ games: s.games.filter((g) => g.roomId !== roomId) }));
    });

    socket.on("room:opponent-joined", () => {
      // Opponent joined our room — no data change needed beyond what
      // lobby:game-updated already provides.
    });

    socket.on("room:opponent-picked", ({ characterId }) => {
      set({ opponentCharacter: characterId });
    });

    socket.on("room:opponent-left", () => {
      set({ opponentCharacter: null, fightPayload: null, phase: "lobby", roomId: null, slot: null });
    });

    socket.on("fight:start", (payload) => {
      set({ fightPayload: payload, phase: "fighting" });
    });

    socket.on("input:remote", (data) => {
      set({ remoteInput: data });
    });

    socket.on("action:remote", (data) => {
      set({ remoteAction: data });
    });
  }

  return {
    phase: "disconnected",
    connected: false,
    games: [],
    roomId: null,
    slot: null,
    opponentCharacter: null,
    fightPayload: null,
    remoteInput: null,
    remoteAction: null,

    connectPvP: () => {
      subscribe();
      if (!isPvPConnected()) getPvPSocket().connect();
    },

    disconnect: () => {
      disconnectPvP();
      _subscribed = false;
      set({
        phase: "disconnected", connected: false, games: [],
        roomId: null, slot: null, opponentCharacter: null, fightPayload: null,
      });
    },

    refreshLobby: () => {
      const socket = getPvPSocket();
      socket.emit("lobby:list", (games) => set({ games }));
    },

    createGame: (opts = {}) => {
      const socket = getPvPSocket();
      socket.emit("lobby:create-game", opts, (result) => {
        if (result.success) {
          set({ roomId: result.roomId, slot: result.slot, phase: "room" });
        }
      });
    },

    joinGame: (roomId) => {
      const socket = getPvPSocket();
      socket.emit("lobby:join-game", roomId, (result) => {
        if (result.success) {
          set({
            roomId: result.roomId,
            slot: result.slot,
            opponentCharacter: result.opponentCharacter,
            phase: "room",
          });
        }
      });
    },

    pickCharacter: (characterId) => {
      const { roomId } = get();
      if (!roomId) return;
      getPvPSocket().emit("room:pick", { roomId, characterId });
    },

    ready: () => {
      const { roomId } = get();
      if (!roomId) return;
      getPvPSocket().emit("room:ready", { roomId });
    },

    sendInput: (frame, keys) => {
      const { roomId } = get();
      if (!roomId) return;
      getPvPSocket().emit("input", { roomId, frame, keys });
    },

    sendAction: (action, params) => {
      const { roomId } = get();
      if (!roomId) return;
      getPvPSocket().emit("action", { roomId, action, params });
    },
  };
});
