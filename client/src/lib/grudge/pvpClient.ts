// Thin Socket.IO client for the in-process PvP server (server/pvp.ts).
//
// Caller pattern:
//   const pvp = getPvpClient();
//   pvp.connect();
//   pvp.joinMatch("match-123");
//   pvp.onMatchState((s) => ...);
//
// Exposed as a singleton because we only need one socket per browser tab.

import { io, type Socket } from "socket.io-client";

const RAW_PVP = (import.meta as any).env?.VITE_GRUDGE_PVP_URL as string | undefined;
const PVP_URL = RAW_PVP && RAW_PVP.length > 0 ? RAW_PVP : "/";

export interface MatchSnapshot {
  matchId: string;
  count: number;
  players: Array<{ socketId: string; id: string; name: string; role: string }>;
}

export interface PlayerActionEvent {
  from: string;
  socketId: string;
  type: string;
  data: unknown;
  ts: number;
}

class PvpClient {
  private socket: Socket | null = null;
  private matchListeners = new Set<(s: MatchSnapshot) => void>();
  private actionListeners = new Set<(e: PlayerActionEvent) => void>();
  private welcomeListeners = new Set<(w: { id: string; name: string; role: string; socketId: string }) => void>();

  connect(): Socket {
    if (this.socket && this.socket.connected) return this.socket;
    if (this.socket) {
      this.socket.connect();
      return this.socket;
    }
    this.socket = io(PVP_URL, {
      path: "/pvp",
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1500,
    });
    this.socket.on("welcome", (w) => this.welcomeListeners.forEach((cb) => cb(w)));
    this.socket.on("matchState", (s: MatchSnapshot) => this.matchListeners.forEach((cb) => cb(s)));
    this.socket.on("playerAction", (e: PlayerActionEvent) => this.actionListeners.forEach((cb) => cb(e)));
    this.socket.on("connect_error", (err) => {
      console.warn("[pvp-client] connect_error:", err.message);
    });
    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
  }

  joinMatch(matchId: string): Promise<MatchSnapshot> {
    const s = this.connect();
    return new Promise((resolve, reject) => {
      s.emit("joinMatch", { matchId }, (res: { ok: boolean; room?: MatchSnapshot; error?: string }) => {
        if (res?.ok && res.room) resolve(res.room);
        else reject(new Error(res?.error || "joinMatch failed"));
      });
    });
  }

  leaveMatch(matchId: string) {
    this.socket?.emit("leaveMatch", { matchId });
  }

  emitAction(matchId: string, type: string, data?: unknown) {
    this.socket?.emit("playerAction", { matchId, type, data });
  }

  onWelcome(cb: (w: { id: string; name: string; role: string; socketId: string }) => void): () => void {
    this.welcomeListeners.add(cb);
    return () => this.welcomeListeners.delete(cb);
  }
  onMatchState(cb: (s: MatchSnapshot) => void): () => void {
    this.matchListeners.add(cb);
    return () => this.matchListeners.delete(cb);
  }
  onPlayerAction(cb: (e: PlayerActionEvent) => void): () => void {
    this.actionListeners.add(cb);
    return () => this.actionListeners.delete(cb);
  }
}

let _instance: PvpClient | null = null;
export function getPvpClient(): PvpClient {
  if (!_instance) _instance = new PvpClient();
  return _instance;
}
