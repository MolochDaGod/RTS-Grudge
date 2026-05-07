// MMO world state server — Socket.IO namespace /world
//
// Authoritative over:
//   • Player presence + position (broadcast to nearby peers)
//   • Resource node state (harvest → depleted → respawn timer)
//   • NPC patrol tick (server broadcasts at NPC_TICK_HZ)
//   • Vendor inventory (static catalogue served on request)
//
// Each of these maps to a client-side event your R3F scene already emits;
// the server simply validates, persists in memory, and fans out to everyone
// in the same zone.

import type { Server as HttpServer } from "http";
import { Server as IOServer, type Socket, type Namespace } from "socket.io";
import { resolveIdentity, type GrudgeIdentity } from "./grudgeAuth";

// ─── Constants ───────────────────────────────────────────────────────────────
const NPC_TICK_HZ = 2;          // NPC position broadcasts per second
const NODE_RESPAWN_MS = 60_000; // 1 minute resource node respawn
const MAX_PLAYERS_PER_ZONE = 64;
const MOVE_THROTTLE_MS = 100;   // min ms between position broadcasts per player

const ALLOWED_ORIGINS = [
  "https://grudgewarlords.com",
  "https://www.grudgewarlords.com",
  "https://rts.grudge-studio.com",
  "https://grudge-studio.com",
  "http://localhost:5000",
  "http://localhost:5173",
  "http://127.0.0.1:5000",
];

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Vec3 { x: number; y: number; z: number }

export interface PlayerState {
  id: string;
  name: string;
  role: string;
  socketId: string;
  zone: string;
  pos: Vec3;
  rot: number;    // Y-axis rotation in radians
  anim: string;   // current animation key e.g. "walk", "idle", "harvest"
  lastMoveAt: number;
}

export interface ResourceNode {
  nodeId: string;
  type: "tree" | "rock" | "flower" | "chest" | "ore" | "fish" | "herb";
  pos: Vec3;
  zone: string;
  depleted: boolean;
  respawnAt: number | null; // epoch ms when it comes back; null = available
}

export interface NpcState {
  npcId: string;
  name: string;
  role: "guard" | "vendor" | "questgiver" | "patrol";
  zone: string;
  pos: Vec3;
  rot: number;
  anim: string;
  patrolIdx: number;
  patrol: Vec3[];  // patrol waypoints
}

// ─── In-memory world state ───────────────────────────────────────────────────
const players = new Map<string, PlayerState>();                // socketId → state
const resourceNodes = new Map<string, ResourceNode>();         // nodeId → state
const npcs = new Map<string, NpcState>();                      // npcId → state

// ─── Seed resource nodes for the tutorial island ─────────────────────────────
function seedTutorialIsland() {
  const zone = "tutorial";
  const types: ResourceNode["type"][] = ["tree", "rock", "flower", "chest", "ore"];
  const positions: Vec3[] = [
    { x: 12, y: 0, z: 8 }, { x: -15, y: 0, z: 5 }, { x: 8, y: 0, z: -12 },
    { x: -20, y: 0, z: -8 }, { x: 25, y: 0, z: 15 }, { x: -5, y: 0, z: 20 },
    { x: 18, y: 0, z: -20 }, { x: -28, y: 0, z: 12 }, { x: 5, y: 0, z: -25 },
    { x: -10, y: 0, z: -18 },
  ];
  positions.forEach((pos, i) => {
    const nodeId = `${zone}_node_${i}`;
    resourceNodes.set(nodeId, {
      nodeId, type: types[i % types.length], pos, zone,
      depleted: false, respawnAt: null,
    });
  });
}

// ─── Seed tutorial island NPCs ───────────────────────────────────────────────
function seedNpcs() {
  const zone = "tutorial";
  const defs: Omit<NpcState, "patrolIdx" | "anim">[] = [
    {
      npcId: "npc_old_pirate", name: "Old Bonebeard", role: "questgiver", zone,
      pos: { x: 0, y: 0, z: -5 }, rot: 0,
      patrol: [{ x: 0, y: 0, z: -5 }, { x: 3, y: 0, z: -5 }, { x: 3, y: 0, z: -8 }],
    },
    {
      npcId: "npc_vendor_sam", name: "Salvage Sam", role: "vendor", zone,
      pos: { x: 10, y: 0, z: -2 }, rot: 1.57,
      patrol: [{ x: 10, y: 0, z: -2 }], // stationary vendor
    },
    {
      npcId: "npc_guard_1", name: "Guard", role: "guard", zone,
      pos: { x: -8, y: 0, z: 3 }, rot: 0,
      patrol: [{ x: -8, y: 0, z: 3 }, { x: -8, y: 0, z: 10 }, { x: -14, y: 0, z: 10 }, { x: -14, y: 0, z: 3 }],
    },
  ];
  defs.forEach(d => npcs.set(d.npcId, { ...d, patrolIdx: 0, anim: "idle" }));
}


// ─── NPC tick (server-authoritative patrol movement) ─────────────────────────
let _worldIo: IOServer | null = null;

function tickNpcs() {
  for (const npc of npcs.values()) {
    if (npc.patrol.length <= 1) continue;
    const target = npc.patrol[npc.patrolIdx % npc.patrol.length];
    const dx = target.x - npc.pos.x;
    const dz = target.z - npc.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const SPEED = 0.05;
    if (dist < 0.15) {
      npc.patrolIdx = (npc.patrolIdx + 1) % npc.patrol.length;
      npc.anim = "idle";
    } else {
      npc.pos.x += (dx / dist) * SPEED;
      npc.pos.z += (dz / dist) * SPEED;
      npc.rot = Math.atan2(dx, dz);
      npc.anim = "walk";
    }
  }
  _worldIo?.emit("world:npcTick", Array.from(npcs.values()).map(n => ({
    npcId: n.npcId, name: n.name, role: n.role, pos: n.pos, rot: n.rot, anim: n.anim,
  })));
}

function tickRespawns() {
  const now = Date.now();
  for (const node of resourceNodes.values()) {
    if (node.depleted && node.respawnAt && now >= node.respawnAt) {
      node.depleted = false;
      node.respawnAt = null;
      _worldIo?.emit("world:nodeState", { nodeId: node.nodeId, depleted: false, respawnAt: null });
    }
  }
}

// ─── Socket.IO /world server ──────────────────────────────────────────────────
export function attachWorldServer(httpServer: HttpServer): IOServer {
  const io = new IOServer(httpServer, {
    path: "/world",
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (origin.endsWith(".up.railway.app")) return cb(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        return cb(new Error(`World origin not allowed: ${origin}`), false);
      },
      credentials: true,
    },
    pingInterval: 20_000,
    pingTimeout: 40_000,
  });

  _worldIo = io;
  if (resourceNodes.size === 0) seedTutorialIsland();
  if (npcs.size === 0) seedNpcs();

  io.use(async (socket, next) => {
    const identity = await resolveIdentity(socket.handshake.headers.cookie);
    if (!identity) return next(new Error("unauthenticated"));
    (socket.data as any).identity = identity;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const identity: GrudgeIdentity = (socket.data as any).identity;

    socket.on("world:join", (payload: { zone?: string; pos?: Vec3; rot?: number }) => {
      const zone = String(payload?.zone || "tutorial");
      const pos: Vec3 = payload?.pos ?? { x: 0, y: 0.5, z: 0 };
      const state: PlayerState = {
        id: identity.id, name: identity.name, role: identity.role,
        socketId: socket.id, zone, pos, rot: payload?.rot ?? 0,
        anim: "idle", lastMoveAt: 0,
      };
      players.set(socket.id, state);
      socket.join(`zone:${zone}`);
      socket.emit("world:snapshot", {
        players: Array.from(players.values()).filter(p => p.zone === zone),
        nodes: Array.from(resourceNodes.values()).filter(n => n.zone === zone),
        npcs: Array.from(npcs.values()).filter(n => n.zone === zone),
      });
      socket.to(`zone:${zone}`).emit("world:playerJoined", { ...state });
    });

    socket.on("world:move", (payload: { pos?: Vec3; rot?: number; anim?: string }) => {
      const state = players.get(socket.id);
      if (!state) return;
      const now = Date.now();
      if (now - state.lastMoveAt < MOVE_THROTTLE_MS) return;
      state.pos = payload?.pos ?? state.pos;
      state.rot = payload?.rot ?? state.rot;
      state.anim = payload?.anim ?? state.anim;
      state.lastMoveAt = now;
      socket.to(`zone:${state.zone}`).emit("world:playerMoved", {
        socketId: socket.id, id: state.id, pos: state.pos, rot: state.rot, anim: state.anim,
      });
    });

    socket.on("world:harvest", (payload: { nodeId?: string }, ack?: (r: any) => void) => {
      const nodeId = String(payload?.nodeId || "");
      const node = resourceNodes.get(nodeId);
      if (!node || node.depleted) { ack?.({ ok: false, error: node ? "already depleted" : "not found" }); return; }
      node.depleted = true;
      node.respawnAt = Date.now() + NODE_RESPAWN_MS;
      const update = { nodeId, depleted: true, respawnAt: node.respawnAt };
      io.to(`zone:${node.zone}`).emit("world:nodeState", update);
      ack?.({ ok: true, node: update });
    });

    socket.on("world:interact", (payload: { npcId?: string }, ack?: (r: any) => void) => {
      const npc = npcs.get(String(payload?.npcId || ""));
      if (!npc) { ack?.({ ok: false, error: "npc not found" }); return; }
      ack?.({ ok: true, npc: { npcId: npc.npcId, name: npc.name, role: npc.role } });
    });

    socket.on("disconnect", () => {
      const state = players.get(socket.id);
      if (state) {
        socket.to(`zone:${state.zone}`).emit("world:playerLeft", { socketId: socket.id, id: state.id });
        players.delete(socket.id);
      }
    });
  });

  setInterval(tickNpcs, Math.round(1000 / NPC_TICK_HZ));
  setInterval(tickRespawns, 5_000);
  console.log("[world] Socket.IO world server attached at /world");
  return io;
}

export function getWorldStatus() {
  return {
    players: players.size,
    resourceNodes: { total: resourceNodes.size, depleted: Array.from(resourceNodes.values()).filter(n => n.depleted).length },
    npcs: npcs.size,
  };
}
