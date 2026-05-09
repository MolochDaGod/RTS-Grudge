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
  "https://rts-grudge-git-main-grudgenexus.vercel.app",
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

export type FactionId = "crusade" | "fabled" | "legion" | "pirate" | "neutral";
export type ServiceKind = "vendor" | "banker" | "healer" | "blacksmith" | "trainer" | "questgiver" | "guard" | "patrol";
export type AiBehavior = "patrol" | "aggressive" | "defensive" | "stationary" | "wander";

export interface VendorCatalogItem {
  itemId: string;
  name: string;
  price: number;          // gold
  stock: number;          // -1 = infinite
  icon?: string;
}

export interface ServicePrice {
  /** flat gold cost; 0 = free for faction members */
  gold: number;
  /** optional reputation requirement w/ this faction */
  minReputation?: number;
}

export interface NpcState {
  npcId: string;
  name: string;
  role: ServiceKind;
  faction: FactionId;
  zone: string;
  pos: Vec3;
  rot: number;
  anim: string;
  patrolIdx: number;
  patrol: Vec3[];
  behavior: AiBehavior;
  hp: number;
  maxHp: number;
  catalog?: VendorCatalogItem[]; // vendor only
  service?: ServicePrice;        // banker/healer/blacksmith/trainer
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

// ─── Seed tutorial island NPCs (faction-tagged, with services) ───────────────
const SAM_CATALOG: VendorCatalogItem[] = [
  { itemId: "wood", name: "Wood Plank", price: 2, stock: -1, icon: "🪵" },
  { itemId: "stone", name: "Stone Block", price: 3, stock: -1, icon: "🪨" },
  { itemId: "iron_ingot", name: "Iron Ingot", price: 12, stock: 24, icon: "⛓️" },
  { itemId: "bandage", name: "Bandage", price: 6, stock: -1, icon: "🩹" },
  { itemId: "torch", name: "Torch", price: 4, stock: -1, icon: "🔦" },
  { itemId: "rope", name: "Climbing Rope", price: 8, stock: -1, icon: "🪢" },
];

function seedNpcs() {
  const zone = "tutorial";
  type NpcSeed = Omit<NpcState, "patrolIdx" | "anim" | "hp" | "maxHp"> & { hp?: number };
  const defs: NpcSeed[] = [
    {
      npcId: "npc_old_pirate", name: "Old Bonebeard", role: "questgiver", faction: "pirate", zone,
      pos: { x: 0, y: 0, z: -5 }, rot: 0, behavior: "patrol",
      patrol: [{ x: 0, y: 0, z: -5 }, { x: 3, y: 0, z: -5 }, { x: 3, y: 0, z: -8 }],
    },
    {
      npcId: "npc_vendor_sam", name: "Salvage Sam", role: "vendor", faction: "pirate", zone,
      pos: { x: 10, y: 0, z: -2 }, rot: 1.57, behavior: "stationary",
      patrol: [{ x: 10, y: 0, z: -2 }],
      catalog: SAM_CATALOG,
    },
    {
      npcId: "npc_banker_finn", name: "Banker Finn", role: "banker", faction: "crusade", zone,
      pos: { x: -3, y: 0, z: 6 }, rot: -1.57, behavior: "stationary",
      patrol: [{ x: -3, y: 0, z: 6 }],
      service: { gold: 0 },
    },
    {
      npcId: "npc_healer_lia", name: "Healer Lia", role: "healer", faction: "fabled", zone,
      pos: { x: 6, y: 0, z: 6 }, rot: -1.57, behavior: "stationary",
      patrol: [{ x: 6, y: 0, z: 6 }],
      service: { gold: 5 },
    },
    {
      npcId: "npc_smith_brak", name: "Blacksmith Brak", role: "blacksmith", faction: "crusade", zone,
      pos: { x: -10, y: 0, z: -2 }, rot: 1.57, behavior: "stationary",
      patrol: [{ x: -10, y: 0, z: -2 }],
      service: { gold: 25 },
    },
    {
      npcId: "npc_trainer_kael", name: "Trainer Kael", role: "trainer", faction: "crusade", zone,
      pos: { x: 14, y: 0, z: 6 }, rot: 3.14, behavior: "stationary",
      patrol: [{ x: 14, y: 0, z: 6 }],
      service: { gold: 50 },
    },
    {
      npcId: "npc_guard_1", name: "Crusade Guard", role: "guard", faction: "crusade", zone,
      pos: { x: -8, y: 0, z: 3 }, rot: 0, behavior: "patrol",
      patrol: [{ x: -8, y: 0, z: 3 }, { x: -8, y: 0, z: 10 }, { x: -14, y: 0, z: 10 }, { x: -14, y: 0, z: 3 }],
    },
    {
      npcId: "npc_legion_raider", name: "Legion Raider", role: "patrol", faction: "legion", zone,
      pos: { x: 22, y: 0, z: -22 }, rot: 0, behavior: "aggressive",
      patrol: [{ x: 22, y: 0, z: -22 }, { x: 28, y: 0, z: -22 }, { x: 28, y: 0, z: -16 }, { x: 22, y: 0, z: -16 }],
    },
  ];
  defs.forEach(d => npcs.set(d.npcId, {
    ...d,
    patrolIdx: 0,
    anim: "idle",
    hp: d.hp ?? 100,
    maxHp: d.hp ?? 100,
  }));
}


// ─── NPC tick (server-authoritative patrol movement) ─────────────────────────
let _worldIo: IOServer | null = null;

const AGGRO_RADIUS = 8;       // metres — aggressive NPCs lock players inside this
const AGGRO_LEASH = 18;       // metres — drop chase past this
const NPC_WALK_SPEED = 0.05;  // metres per tick
const NPC_RUN_SPEED = 0.11;  // metres per tick when chasing

function nearestPlayerInZone(zone: string, from: Vec3, radius: number): PlayerState | null {
  let best: PlayerState | null = null;
  let bestSq = radius * radius;
  for (const p of players.values()) {
    if (p.zone !== zone) continue;
    const dx = p.pos.x - from.x;
    const dz = p.pos.z - from.z;
    const sq = dx * dx + dz * dz;
    if (sq < bestSq) { bestSq = sq; best = p; }
  }
  return best;
}

function moveTowards(npc: NpcState, target: Vec3, speed: number): boolean {
  const dx = target.x - npc.pos.x;
  const dz = target.z - npc.pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.15) return true;
  npc.pos.x += (dx / dist) * speed;
  npc.pos.z += (dz / dist) * speed;
  npc.rot = Math.atan2(dx, dz);
  return false;
}

function tickNpcs() {
  for (const npc of npcs.values()) {
    if (npc.behavior === "stationary") { npc.anim = "idle"; continue; }

    if (npc.behavior === "aggressive") {
      const target = nearestPlayerInZone(npc.zone, npc.pos, AGGRO_LEASH);
      if (target) {
        const dx = target.pos.x - npc.pos.x;
        const dz = target.pos.z - npc.pos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq <= AGGRO_RADIUS * AGGRO_RADIUS) {
          if (distSq < 1.6) { npc.anim = "attack"; npc.rot = Math.atan2(dx, dz); continue; }
          moveTowards(npc, target.pos, NPC_RUN_SPEED);
          npc.anim = "run";
          continue;
        }
      }
    }

    if (npc.patrol.length <= 1) { npc.anim = "idle"; continue; }
    const wp = npc.patrol[npc.patrolIdx % npc.patrol.length];
    const reached = moveTowards(npc, wp, NPC_WALK_SPEED);
    if (reached) {
      npc.patrolIdx = (npc.patrolIdx + 1) % npc.patrol.length;
      npc.anim = "idle";
    } else {
      npc.anim = "walk";
    }
  }
  _worldIo?.emit("world:npcTick", Array.from(npcs.values()).map(n => ({
    npcId: n.npcId, pos: n.pos, rot: n.rot, anim: n.anim, hp: n.hp,
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
        if (origin.endsWith(".vercel.app")) return cb(null, true);
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
      ack?.({
        ok: true,
        npc: {
          npcId: npc.npcId, name: npc.name, role: npc.role,
          faction: npc.faction, catalog: npc.catalog ?? null, service: npc.service ?? null,
        },
      });
    });

    // Vendor list — clients open the shop UI from this payload.
    socket.on("world:vendor:list", (payload: { npcId?: string }, ack?: (r: any) => void) => {
      const npc = npcs.get(String(payload?.npcId || ""));
      if (!npc || npc.role !== "vendor") { ack?.({ ok: false, error: "no vendor" }); return; }
      ack?.({ ok: true, npcId: npc.npcId, faction: npc.faction, catalog: npc.catalog ?? [] });
    });

    // Service request — banker / healer / blacksmith / trainer.
    // Server returns the price + a synthetic effect token; the client store
    // applies it locally and the central API persists currency/xp.
    socket.on("world:service:request", (payload: { npcId?: string; kind?: ServiceKind }, ack?: (r: any) => void) => {
      const npc = npcs.get(String(payload?.npcId || ""));
      if (!npc || !npc.service) { ack?.({ ok: false, error: "no service" }); return; }
      ack?.({
        ok: true,
        kind: npc.role,
        faction: npc.faction,
        price: npc.service.gold,
        npcId: npc.npcId,
      });
    });

    // Combat hit — player attacks a hostile NPC. Server validates range,
    // applies damage, broadcasts the new HP, and emits world:npcDeath when
    // an NPC drops. Damage is clamped 1..50 to prevent client overflow.
    socket.on("world:combat:hit", (payload: { npcId?: string; damage?: number }, ack?: (r: any) => void) => {
      const state = players.get(socket.id);
      const npc = npcs.get(String(payload?.npcId || ""));
      if (!state || !npc) { ack?.({ ok: false, error: "missing target" }); return; }
      if (npc.zone !== state.zone) { ack?.({ ok: false, error: "wrong zone" }); return; }
      const dx = npc.pos.x - state.pos.x;
      const dz = npc.pos.z - state.pos.z;
      if (dx * dx + dz * dz > 9) { ack?.({ ok: false, error: "out of range" }); return; }
      const dmg = Math.max(1, Math.min(50, Math.floor(payload?.damage ?? 5)));
      npc.hp = Math.max(0, npc.hp - dmg);
      io.to(`zone:${npc.zone}`).emit("world:npcHp", { npcId: npc.npcId, hp: npc.hp, maxHp: npc.maxHp });
      if (npc.hp <= 0) {
        io.to(`zone:${npc.zone}`).emit("world:npcDeath", { npcId: npc.npcId, killerId: state.id });
        // Respawn after 30s at original waypoint 0.
        const wp = npc.patrol[0];
        setTimeout(() => {
          npc.hp = npc.maxHp;
          npc.pos = { ...wp };
          npc.anim = "idle";
          io.to(`zone:${npc.zone}`).emit("world:npcRespawn", { npcId: npc.npcId, pos: npc.pos, hp: npc.hp });
        }, 30_000);
      }
      ack?.({ ok: true, hp: npc.hp });
    });

    // In-zone chat fallback (used when the Cloudflare worker is unavailable).
    socket.on("world:chat", (payload: { text?: string; channel?: "zone" | "say" }) => {
      const state = players.get(socket.id);
      const text = String(payload?.text || "").slice(0, 240);
      if (!state || !text) return;
      const channel = payload?.channel === "say" ? "say" : "zone";
      io.to(`zone:${state.zone}`).emit("world:chat", {
        from: state.id, name: state.name, text, channel, ts: Date.now(),
      });
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
