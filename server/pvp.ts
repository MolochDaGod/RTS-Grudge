// Socket.IO PvP server, attached to the existing Express httpServer so we
// run on a single port (matches Railway's free tier and keeps the dev URL
// the same as the SPA). Authoritative server is intentionally minimal here:
// it owns *room membership* and *event broadcast*. Movement / hit detection
// stays on the client for now; we'll move authoritative tick rate in once
// the basic loop is proven and the Grudge Studio token system is exercised.

import type { Server as HttpServer } from "http";
import { Server as IOServer, type Socket } from "socket.io";
import { resolveIdentity, type GrudgeIdentity } from "./grudgeAuth";

const ALLOWED_ORIGINS = [
  "https://grudgewarlords.com",
  "https://www.grudgewarlords.com",
  "https://rts.grudge-studio.com",
  "https://grudge-studio.com",
  "https://www.grudge-studio.com",
  "http://localhost:5000",
  "http://localhost:5173",
  "http://127.0.0.1:5000",
];

interface RoomState {
  matchId: string;
  // socketId -> identity
  players: Map<string, GrudgeIdentity>;
  createdAt: number;
}

const rooms = new Map<string, RoomState>();

function roomSnapshot(room: RoomState) {
  return {
    matchId: room.matchId,
    players: Array.from(room.players.entries()).map(([sid, id]) => ({
      socketId: sid,
      id: id.id,
      name: id.name,
      role: id.role,
    })),
    count: room.players.size,
  };
}

function getOrCreateRoom(matchId: string): RoomState {
  let r = rooms.get(matchId);
  if (!r) {
    r = { matchId, players: new Map(), createdAt: Date.now() };
    rooms.set(matchId, r);
  }
  return r;
}

export function attachPvpServer(httpServer: HttpServer): IOServer {
  const io = new IOServer(httpServer, {
    path: "/pvp",
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        return cb(new Error(`PvP origin not allowed: ${origin}`), false);
      },
      credentials: true,
    },
    pingInterval: 20_000,
    pingTimeout: 30_000,
  });

  io.use(async (socket, next) => {
    const cookie = socket.handshake.headers.cookie;
    const identity = await resolveIdentity(cookie);
    if (!identity) {
      return next(new Error("unauthenticated"));
    }
    (socket.data as any).identity = identity;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const identity: GrudgeIdentity = (socket.data as any).identity;
    console.log(`[pvp] connect sid=${socket.id} user=${identity.id} (${identity.source})`);

    socket.emit("welcome", {
      id: identity.id,
      name: identity.name,
      role: identity.role,
      socketId: socket.id,
    });

    socket.on("joinMatch", (payload: { matchId?: string }, ack?: (r: any) => void) => {
      const matchId = String(payload?.matchId || "").trim() || "lobby";
      const room = getOrCreateRoom(matchId);
      socket.join(`match:${matchId}`);
      room.players.set(socket.id, identity);
      const snap = roomSnapshot(room);
      io.to(`match:${matchId}`).emit("matchState", snap);
      ack?.({ ok: true, room: snap });
    });

    socket.on("leaveMatch", (payload: { matchId?: string }) => {
      const matchId = String(payload?.matchId || "").trim();
      if (!matchId) return;
      const room = rooms.get(matchId);
      if (!room) return;
      room.players.delete(socket.id);
      socket.leave(`match:${matchId}`);
      io.to(`match:${matchId}`).emit("matchState", roomSnapshot(room));
      if (room.players.size === 0) rooms.delete(matchId);
    });

    socket.on("playerAction", (payload: { matchId?: string; type?: string; data?: unknown }) => {
      const matchId = String(payload?.matchId || "").trim();
      if (!matchId) return;
      socket.to(`match:${matchId}`).emit("playerAction", {
        from: identity.id,
        socketId: socket.id,
        type: String(payload?.type || "unknown"),
        data: payload?.data,
        ts: Date.now(),
      });
    });

    socket.on("disconnect", (reason) => {
      console.log(`[pvp] disconnect sid=${socket.id} user=${identity.id} reason=${reason}`);
      for (const room of rooms.values()) {
        if (room.players.delete(socket.id)) {
          io.to(`match:${room.matchId}`).emit("matchState", roomSnapshot(room));
          if (room.players.size === 0) rooms.delete(room.matchId);
        }
      }
    });
  });

  console.log("[pvp] Socket.IO server attached at /pvp");
  return io;
}

/** Read-only summary of currently active rooms; consumed by the admin UI. */
export function listPvpRooms() {
  return Array.from(rooms.values()).map(roomSnapshot);
}
