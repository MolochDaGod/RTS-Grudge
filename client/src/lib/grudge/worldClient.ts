// Thin Socket.IO client for the authoritative MMO world server (server/world.ts).
//
// Mirrors the pvpClient pattern: one socket per browser tab, listener-set
// fan-out, ack-style requests for vendor/service/combat. Connects to
// VITE_GRUDGE_WORLD_URL (Railway) on namespace `/world`.

import { io, type Socket } from "socket.io-client";

const RAW_WORLD = (import.meta as any).env?.VITE_GRUDGE_WORLD_URL as string | undefined;
const WORLD_URL = RAW_WORLD && RAW_WORLD.length > 0 ? RAW_WORLD : "/";

export interface Vec3 { x: number; y: number; z: number }
export type FactionId = "crusade" | "fabled" | "legion" | "pirate" | "neutral";
export type ServiceKind = "vendor" | "banker" | "healer" | "blacksmith" | "trainer" | "questgiver" | "guard" | "patrol";

export interface RemotePlayer {
  socketId: string; id: string; name: string; role: string;
  zone: string; pos: Vec3; rot: number; anim: string;
}
export interface RemoteNpc {
  npcId: string; name: string; role: ServiceKind; faction: FactionId;
  zone: string; pos: Vec3; rot: number; anim: string; hp: number; maxHp: number;
}
export interface RemoteNode {
  nodeId: string; type: string; pos: Vec3; zone: string;
  depleted: boolean; respawnAt: number | null;
}
export interface VendorCatalogItem {
  itemId: string; name: string; price: number; stock: number; icon?: string;
}
export interface WorldSnapshot { players: RemotePlayer[]; nodes: RemoteNode[]; npcs: RemoteNpc[] }
export interface ChatMessage { from: string; name: string; text: string; channel: "zone" | "say"; ts: number }

type Listener<T> = (e: T) => void;

class WorldClient {
  private socket: Socket | null = null;
  private snapshotL = new Set<Listener<WorldSnapshot>>();
  private joinedL = new Set<Listener<RemotePlayer>>();
  private movedL = new Set<Listener<{ socketId: string; id: string; pos: Vec3; rot: number; anim: string }>>();
  private leftL = new Set<Listener<{ socketId: string; id: string }>>();
  private npcTickL = new Set<Listener<Array<{ npcId: string; pos: Vec3; rot: number; anim: string; hp: number }>>>();
  private nodeStateL = new Set<Listener<{ nodeId: string; depleted: boolean; respawnAt: number | null }>>();
  private npcHpL = new Set<Listener<{ npcId: string; hp: number; maxHp: number }>>();
  private npcDeathL = new Set<Listener<{ npcId: string; killerId: string }>>();
  private npcRespawnL = new Set<Listener<{ npcId: string; pos: Vec3; hp: number }>>();
  private chatL = new Set<Listener<ChatMessage>>();

  connect(): Socket {
    if (this.socket && this.socket.connected) return this.socket;
    if (this.socket) { this.socket.connect(); return this.socket; }
    this.socket = io(WORLD_URL, {
      path: "/world",
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1500,
    });
    const s = this.socket;
    s.on("world:snapshot", (snap: WorldSnapshot) => this.snapshotL.forEach(cb => cb(snap)));
    s.on("world:playerJoined", (p: RemotePlayer) => this.joinedL.forEach(cb => cb(p)));
    s.on("world:playerMoved", (e) => this.movedL.forEach(cb => cb(e)));
    s.on("world:playerLeft", (e) => this.leftL.forEach(cb => cb(e)));
    s.on("world:npcTick", (e) => this.npcTickL.forEach(cb => cb(e)));
    s.on("world:nodeState", (e) => this.nodeStateL.forEach(cb => cb(e)));
    s.on("world:npcHp", (e) => this.npcHpL.forEach(cb => cb(e)));
    s.on("world:npcDeath", (e) => this.npcDeathL.forEach(cb => cb(e)));
    s.on("world:npcRespawn", (e) => this.npcRespawnL.forEach(cb => cb(e)));
    s.on("world:chat", (e: ChatMessage) => this.chatL.forEach(cb => cb(e)));
    s.on("connect_error", (err) => console.warn("[world-client] connect_error:", err.message));
    return s;
  }
  disconnect() { this.socket?.disconnect(); }

  /** Returns the underlying Socket.IO id once connected, otherwise null. */
  getSocketId(): string | null {
    return this.socket?.id ?? null;
  }

  join(zone = "tutorial", pos: Vec3 = { x: 0, y: 0.5, z: 0 }, rot = 0) {
    this.connect().emit("world:join", { zone, pos, rot });
  }
  move(pos: Vec3, rot: number, anim: string) {
    this.socket?.emit("world:move", { pos, rot, anim });
  }
  harvest(nodeId: string): Promise<{ ok: boolean; node?: any; error?: string }> {
    return new Promise((resolve) => {
      this.connect().emit("world:harvest", { nodeId }, (r: any) => resolve(r));
    });
  }
  interact(npcId: string): Promise<any> {
    return new Promise((resolve) => {
      this.connect().emit("world:interact", { npcId }, (r: any) => resolve(r));
    });
  }
  vendorList(npcId: string): Promise<{ ok: boolean; faction?: FactionId; catalog?: VendorCatalogItem[]; error?: string }> {
    return new Promise((resolve) => {
      this.connect().emit("world:vendor:list", { npcId }, (r: any) => resolve(r));
    });
  }
  requestService(npcId: string, kind: ServiceKind): Promise<{ ok: boolean; price?: number; faction?: FactionId; kind?: ServiceKind; error?: string }> {
    return new Promise((resolve) => {
      this.connect().emit("world:service:request", { npcId, kind }, (r: any) => resolve(r));
    });
  }
  combatHit(npcId: string, damage: number): Promise<{ ok: boolean; hp?: number; error?: string }> {
    return new Promise((resolve) => {
      this.connect().emit("world:combat:hit", { npcId, damage }, (r: any) => resolve(r));
    });
  }
  chat(text: string, channel: "zone" | "say" = "zone") {
    this.socket?.emit("world:chat", { text, channel });
  }

  onSnapshot(cb: Listener<WorldSnapshot>): () => void { this.snapshotL.add(cb); return () => this.snapshotL.delete(cb); }
  onPlayerJoined(cb: Listener<RemotePlayer>) { this.joinedL.add(cb); return () => this.joinedL.delete(cb); }
  onPlayerMoved(cb: Listener<{ socketId: string; id: string; pos: Vec3; rot: number; anim: string }>) { this.movedL.add(cb); return () => this.movedL.delete(cb); }
  onPlayerLeft(cb: Listener<{ socketId: string; id: string }>) { this.leftL.add(cb); return () => this.leftL.delete(cb); }
  onNpcTick(cb: Listener<Array<{ npcId: string; pos: Vec3; rot: number; anim: string; hp: number }>>) { this.npcTickL.add(cb); return () => this.npcTickL.delete(cb); }
  onNodeState(cb: Listener<{ nodeId: string; depleted: boolean; respawnAt: number | null }>) { this.nodeStateL.add(cb); return () => this.nodeStateL.delete(cb); }
  onNpcHp(cb: Listener<{ npcId: string; hp: number; maxHp: number }>) { this.npcHpL.add(cb); return () => this.npcHpL.delete(cb); }
  onNpcDeath(cb: Listener<{ npcId: string; killerId: string }>) { this.npcDeathL.add(cb); return () => this.npcDeathL.delete(cb); }
  onNpcRespawn(cb: Listener<{ npcId: string; pos: Vec3; hp: number }>) { this.npcRespawnL.add(cb); return () => this.npcRespawnL.delete(cb); }
  onChat(cb: Listener<ChatMessage>) { this.chatL.add(cb); return () => this.chatL.delete(cb); }
}

let _instance: WorldClient | null = null;
export function getWorldClient(): WorldClient {
  if (!_instance) _instance = new WorldClient();
  return _instance;
}
