/**
 * ZoneManager — Server-side MMO zone channel management.
 *
 * Manages player connections across 9 world zones with auto-scaling channels:
 *   - Each zone starts with 1 channel, spawns more when soft cap (50) is hit
 *   - Players are assigned to the least-full channel on join
 *   - Position updates are broadcast only to players within interest radius (50m)
 *   - Empty channels are garbage-collected after 60 seconds
 *   - 10Hz batched position broadcasts
 *
 * Wire into Express via registerZoneHandlers(io) in server/index.ts.
 */

import type { Server as SocketIOServer, Socket } from "socket.io";

// ── Constants (mirrors shared/zoneProtocol.ts) ───────────────────────────────

const ZONE_CHANNEL_SOFT_CAP = 50;
const INTEREST_RADIUS = 50;         // metres
const INTEREST_RADIUS_SQ = INTEREST_RADIUS * INTEREST_RADIUS;
const POSITION_UPDATE_HZ = 10;
const CHANNEL_GC_DELAY_MS = 60_000;

type ZoneId = string;

// ── Data structures ──────────────────────────────────────────────────────────

interface PlayerState {
  playerId: string;
  socketId: string;
  characterName: string;
  heroClass: string;
  modelPath: string;
  level: number;
  position: [number, number, number];
  rotation: number;
  animation: string;
  health: number;
  maxHealth: number;
  faction: string;
  channelId: string;
  lastUpdate: number;
}

interface ZoneChannel {
  channelId: string;
  zoneId: ZoneId;
  players: Map<string, PlayerState>;  // playerId → state
  createdAt: number;
}

// ── ZoneManager class ────────────────────────────────────────────────────────

export class ZoneManager {
  private channels = new Map<string, ZoneChannel>();
  private playerToChannel = new Map<string, string>();  // socketId → channelId
  private channelCounter = 0;
  private gcTimer: ReturnType<typeof setInterval> | null = null;
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;
  private io: SocketIOServer | null = null;

  start(io: SocketIOServer): void {
    this.io = io;

    // GC empty channels every 60s
    this.gcTimer = setInterval(() => this.garbageCollect(), CHANNEL_GC_DELAY_MS);

    // Batched position broadcasts at 10Hz
    this.broadcastTimer = setInterval(
      () => this.broadcastPositions(),
      1000 / POSITION_UPDATE_HZ,
    );

    console.log("[zone] ZoneManager started (GC: 60s, broadcast: 10Hz)");
  }

  stop(): void {
    if (this.gcTimer) clearInterval(this.gcTimer);
    if (this.broadcastTimer) clearInterval(this.broadcastTimer);
  }

  // ── Join ─────────────────────────────────────────────────────────────────

  join(
    socket: Socket,
    zoneId: ZoneId,
    playerData: Omit<PlayerState, "socketId" | "channelId" | "lastUpdate">,
    channelPreference?: string,
  ): { channelId: string; players: PlayerState[] } {
    // Find or create best channel
    let channel: ZoneChannel | undefined;

    if (channelPreference) {
      channel = this.channels.get(channelPreference);
      if (channel && channel.players.size >= ZONE_CHANNEL_SOFT_CAP) {
        channel = undefined; // preferred channel is full
      }
    }

    if (!channel) {
      channel = this.findBestChannel(zoneId);
    }

    if (!channel) {
      channel = this.createChannel(zoneId);
    }

    const state: PlayerState = {
      ...playerData,
      socketId: socket.id,
      channelId: channel.channelId,
      lastUpdate: Date.now(),
    };

    channel.players.set(playerData.playerId, state);
    this.playerToChannel.set(socket.id, channel.channelId);

    // Join the Socket.IO room for this channel
    socket.join(channel.channelId);

    // Notify others in the channel
    socket.to(channel.channelId).emit("zone:player-joined", {
      playerId: state.playerId,
      characterName: state.characterName,
      heroClass: state.heroClass,
      modelPath: state.modelPath,
      level: state.level,
      position: state.position,
      rotation: state.rotation,
      animation: state.animation,
      health: state.health,
      maxHealth: state.maxHealth,
      faction: state.faction,
    });

    return {
      channelId: channel.channelId,
      players: Array.from(channel.players.values()),
    };
  }

  // ── Leave ────────────────────────────────────────────────────────────────

  leave(socket: Socket): void {
    const channelId = this.playerToChannel.get(socket.id);
    if (!channelId) return;

    const channel = this.channels.get(channelId);
    if (!channel) return;

    // Find and remove the player
    let removedPlayerId: string | null = null;
    for (const [pid, ps] of channel.players) {
      if (ps.socketId === socket.id) {
        removedPlayerId = pid;
        channel.players.delete(pid);
        break;
      }
    }

    this.playerToChannel.delete(socket.id);
    socket.leave(channelId);

    if (removedPlayerId) {
      socket.to(channelId).emit("zone:player-left", { playerId: removedPlayerId });
    }
  }

  // ── Move ─────────────────────────────────────────────────────────────────

  updatePosition(
    socket: Socket,
    pos: [number, number, number],
    rotation: number,
    animation: string,
  ): void {
    const channelId = this.playerToChannel.get(socket.id);
    if (!channelId) return;

    const channel = this.channels.get(channelId);
    if (!channel) return;

    for (const ps of channel.players.values()) {
      if (ps.socketId === socket.id) {
        ps.position = pos;
        ps.rotation = rotation;
        ps.animation = animation;
        ps.lastUpdate = Date.now();
        break;
      }
    }
  }

  // ── Action ───────────────────────────────────────────────────────────────

  handleAction(
    socket: Socket,
    actionType: string,
    targetId?: string,
    params?: Record<string, unknown>,
  ): void {
    const channelId = this.playerToChannel.get(socket.id);
    if (!channelId) return;

    const channel = this.channels.get(channelId);
    if (!channel) return;

    let actorPlayerId: string | null = null;
    let actorPos: [number, number, number] = [0, 0, 0];
    for (const ps of channel.players.values()) {
      if (ps.socketId === socket.id) {
        actorPlayerId = ps.playerId;
        actorPos = ps.position;
        break;
      }
    }
    if (!actorPlayerId) return;

    // Broadcast action result to nearby players (interest radius)
    for (const ps of channel.players.values()) {
      if (ps.socketId === socket.id) continue;
      if (distSq(actorPos, ps.position) <= INTEREST_RADIUS_SQ) {
        this.io?.to(ps.socketId).emit("zone:action-result", {
          playerId: actorPlayerId,
          type: actionType,
          result: { targetId, ...params },
        });
      }
    }
  }

  // ── Chat ─────────────────────────────────────────────────────────────────

  handleChat(socket: Socket, message: string): void {
    const channelId = this.playerToChannel.get(socket.id);
    if (!channelId) return;

    const channel = this.channels.get(channelId);
    if (!channel) return;

    let sender: PlayerState | null = null;
    for (const ps of channel.players.values()) {
      if (ps.socketId === socket.id) { sender = ps; break; }
    }
    if (!sender) return;

    socket.to(channelId).emit("zone:chat-message", {
      playerId: sender.playerId,
      characterName: sender.characterName,
      message: message.slice(0, 256), // cap message length
      timestamp: Date.now(),
    });
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private findBestChannel(zoneId: ZoneId): ZoneChannel | undefined {
    let best: ZoneChannel | undefined;
    let bestCount = Infinity;

    for (const ch of this.channels.values()) {
      if (ch.zoneId !== zoneId) continue;
      if (ch.players.size < bestCount && ch.players.size < ZONE_CHANNEL_SOFT_CAP) {
        best = ch;
        bestCount = ch.players.size;
      }
    }

    return best;
  }

  private createChannel(zoneId: ZoneId): ZoneChannel {
    this.channelCounter++;
    const channelId = `${zoneId}-${this.channelCounter}`;
    const channel: ZoneChannel = {
      channelId,
      zoneId,
      players: new Map(),
      createdAt: Date.now(),
    };
    this.channels.set(channelId, channel);
    console.log(`[zone] Created channel ${channelId}`);
    return channel;
  }

  private garbageCollect(): void {
    const now = Date.now();
    for (const [id, ch] of this.channels) {
      if (ch.players.size === 0 && now - ch.createdAt > CHANNEL_GC_DELAY_MS) {
        this.channels.delete(id);
        console.log(`[zone] GC'd empty channel ${id}`);
      }
    }
  }

  private broadcastPositions(): void {
    if (!this.io) return;

    for (const channel of this.channels.values()) {
      if (channel.players.size <= 1) continue;

      const players = Array.from(channel.players.values());

      for (const receiver of players) {
        // Only send updates for players within interest radius
        for (const sender of players) {
          if (sender.socketId === receiver.socketId) continue;
          if (distSq(sender.position, receiver.position) <= INTEREST_RADIUS_SQ) {
            this.io.to(receiver.socketId).emit("zone:player-moved", {
              playerId: sender.playerId,
              pos: sender.position,
              rot: sender.rotation,
              anim: sender.animation,
            });
          }
        }
      }
    }
  }

  // ── Instance zones (dungeons, home islands, housing) ───────────────────
  // Instances exist off the 9-zone sector map. Each is a private channel
  // scoped to a party or individual player. They are created on demand
  // and GC'd when all players leave.

  /**
   * Create a private instance zone for dungeons, home islands, or housing.
   * Returns the instanceId (channelId) the client should zone:join into.
   *
   * @param instanceType "dungeon" | "home_island" | "housing"
   * @param ownerId      Player or party leader who owns this instance
   * @param seed         Optional seed (dungeon level, island seed, etc.)
   */
  createInstance(
    instanceType: "dungeon" | "home_island" | "housing",
    ownerId: string,
    seed?: number,
  ): string {
    const instanceId = `inst_${instanceType}_${ownerId}_${++this.channelCounter}`;
    const channel: ZoneChannel = {
      channelId: instanceId,
      zoneId: `${instanceType}:${ownerId}`,
      players: new Map(),
      createdAt: Date.now(),
    };
    this.channels.set(instanceId, channel);
    console.log(`[zone] Created ${instanceType} instance ${instanceId}${seed != null ? ` (seed=${seed})` : ""}`);
    return instanceId;
  }

  /** Check if an instance exists and return its player count. */
  getInstanceInfo(instanceId: string): { exists: boolean; players: number; zoneId: string } | null {
    const ch = this.channels.get(instanceId);
    if (!ch) return null;
    return { exists: true, players: ch.players.size, zoneId: ch.zoneId };
  }

  /** List all active instances of a given type. */
  listInstances(instanceType?: string): { instanceId: string; zoneId: string; players: number }[] {
    const results: { instanceId: string; zoneId: string; players: number }[] = [];
    for (const ch of this.channels.values()) {
      if (ch.channelId.startsWith("inst_")) {
        if (!instanceType || ch.zoneId.startsWith(`${instanceType}:`)) {
          results.push({ instanceId: ch.channelId, zoneId: ch.zoneId, players: ch.players.size });
        }
      }
    }
    return results;
  }

  /** Get stats for monitoring. */
  getStats(): { channels: number; totalPlayers: number; perZone: Record<string, number>; instances: number } {
    const perZone: Record<string, number> = {};
    let totalPlayers = 0;
    let instances = 0;
    for (const ch of this.channels.values()) {
      perZone[ch.zoneId] = (perZone[ch.zoneId] || 0) + ch.players.size;
      totalPlayers += ch.players.size;
      if (ch.channelId.startsWith("inst_")) instances++;
    }
    return { channels: this.channels.size, totalPlayers, perZone, instances };
  }
}

function distSq(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2]; // Y is vertical — interest is 2D
  return dx * dx + dz * dz;
}

// ── Socket.IO event handler registration ─────────────────────────────────────

const zoneManager = new ZoneManager();

export function registerZoneHandlers(io: SocketIOServer): void {
  zoneManager.start(io);

  io.on("connection", (socket) => {
    // zone:join
    socket.on("zone:join", (data: any, cb?: Function) => {
      const { zoneId, channelPreference, ...playerData } = data;
      const result = zoneManager.join(socket, zoneId, {
        playerId: playerData.playerId || socket.id,
        characterName: playerData.characterName || "Unknown",
        heroClass: playerData.heroClass || "warrior",
        modelPath: playerData.modelPath || "",
        level: playerData.level || 1,
        position: playerData.position || [0, 0, 0],
        rotation: playerData.rotation || 0,
        animation: playerData.animation || "idle",
        health: playerData.health || 100,
        maxHealth: playerData.maxHealth || 100,
        faction: playerData.faction || "neutral",
      }, channelPreference);

      if (cb) cb({ success: true, ...result });
    });

    // zone:leave
    socket.on("zone:leave", () => {
      zoneManager.leave(socket);
    });

    // zone:move
    socket.on("zone:move", (data: any) => {
      zoneManager.updatePosition(
        socket,
        data.pos || [0, 0, 0],
        data.rot || 0,
        data.anim || "idle",
      );
    });

    // zone:action
    socket.on("zone:action", (data: any) => {
      zoneManager.handleAction(socket, data.type, data.targetId, data.params);
    });

    // zone:chat
    socket.on("zone:chat", (data: any) => {
      zoneManager.handleChat(socket, data.message || "");
    });

    // ── Instance events ──────────────────────────────────────────────
    socket.on("zone:create-instance", (data: any, cb?: Function) => {
      const instanceId = zoneManager.createInstance(
        data.type || "dungeon",
        data.ownerId || socket.id,
        data.seed,
      );
      if (cb) cb({ success: true, instanceId });
    });

    socket.on("zone:instance-info", (data: any, cb?: Function) => {
      const info = zoneManager.getInstanceInfo(data.instanceId);
      if (cb) cb(info ?? { exists: false });
    });

    socket.on("zone:list-instances", (data: any, cb?: Function) => {
      const list = zoneManager.listInstances(data.type);
      if (cb) cb({ instances: list });
    });

    // Disconnect
    socket.on("disconnect", () => {
      zoneManager.leave(socket);
    });
  });

  // Stats endpoint
  console.log("[zone] Zone handlers registered");
}

export { zoneManager };
