import { create } from "zustand";
import {
  getWorldClient, type RemotePlayer, type RemoteNpc, type RemoteNode,
  type ChatMessage, type Vec3,
} from "@/lib/grudge/worldClient";

// Reactive mirror of the Railway /world server. One snapshot, then patched
// in place by world:* events. Renderers subscribe to the slices they care
// about (e.g. just `npcs`) so React doesn't re-render the world on every
// movement broadcast.

interface WorldNetState {
  connected: boolean;
  zone: string;
  selfSocketId: string | null;

  remotePlayers: Record<string, RemotePlayer>;
  npcs: Record<string, RemoteNpc>;
  nodes: Record<string, RemoteNode>;
  chat: ChatMessage[];

  // Lifecycle ----------------------------------------------------------------
  bind: () => () => void;
  joinZone: (zone?: string, pos?: Vec3, rot?: number) => void;

  // Imperative helpers (delegate to worldClient) -----------------------------
  move: (pos: Vec3, rot: number, anim: string) => void;
  harvest: (nodeId: string) => Promise<boolean>;
  interact: (npcId: string) => Promise<any>;
  combatHit: (npcId: string, damage: number) => Promise<boolean>;
  sendChat: (text: string, channel?: "zone" | "say") => void;
}

const CHAT_BUFFER = 80;

export const useWorldNet = create<WorldNetState>((set, get) => ({
  connected: false,
  zone: "tutorial",
  selfSocketId: null,
  remotePlayers: {},
  npcs: {},
  nodes: {},
  chat: [],

  bind: () => {
    const wc = getWorldClient();
    const off: Array<() => void> = [];

    off.push(wc.onSnapshot((snap) => {
      const players: Record<string, RemotePlayer> = {};
      snap.players.forEach((p) => { players[p.socketId] = p; });
      const npcs: Record<string, RemoteNpc> = {};
      snap.npcs.forEach((n) => { npcs[n.npcId] = n; });
      const nodes: Record<string, RemoteNode> = {};
      snap.nodes.forEach((n) => { nodes[n.nodeId] = n; });
      set({
        remotePlayers: players,
        npcs,
        nodes,
        connected: true,
        selfSocketId: wc.getSocketId(),
      });
    }));

    off.push(wc.onPlayerJoined((p) => {
      set((s) => ({ remotePlayers: { ...s.remotePlayers, [p.socketId]: p } }));
    }));

    off.push(wc.onPlayerMoved((e) => {
      set((s) => {
        const cur = s.remotePlayers[e.socketId];
        if (!cur) return {};
        return {
          remotePlayers: {
            ...s.remotePlayers,
            [e.socketId]: { ...cur, pos: e.pos, rot: e.rot, anim: e.anim },
          },
        };
      });
    }));

    off.push(wc.onPlayerLeft((e) => {
      set((s) => {
        const next = { ...s.remotePlayers };
        delete next[e.socketId];
        return { remotePlayers: next };
      });
    }));

    off.push(wc.onNpcTick((batch) => {
      set((s) => {
        const next = { ...s.npcs };
        for (const u of batch) {
          const cur = next[u.npcId];
          if (!cur) continue;
          next[u.npcId] = { ...cur, pos: u.pos, rot: u.rot, anim: u.anim, hp: u.hp };
        }
        return { npcs: next };
      });
    }));

    off.push(wc.onNodeState((e) => {
      set((s) => {
        const cur = s.nodes[e.nodeId];
        if (!cur) return {};
        return { nodes: { ...s.nodes, [e.nodeId]: { ...cur, depleted: e.depleted, respawnAt: e.respawnAt } } };
      });
    }));

    off.push(wc.onNpcHp((e) => {
      set((s) => {
        const cur = s.npcs[e.npcId];
        if (!cur) return {};
        return { npcs: { ...s.npcs, [e.npcId]: { ...cur, hp: e.hp, maxHp: e.maxHp } } };
      });
    }));

    off.push(wc.onNpcRespawn((e) => {
      set((s) => {
        const cur = s.npcs[e.npcId];
        if (!cur) return {};
        return { npcs: { ...s.npcs, [e.npcId]: { ...cur, pos: e.pos, hp: e.hp, anim: "idle" } } };
      });
    }));

    off.push(wc.onChat((m) => {
      set((s) => ({ chat: [...s.chat.slice(-(CHAT_BUFFER - 1)), m] }));
    }));

    return () => { off.forEach((fn) => fn()); };
  },

  joinZone: (zone = "tutorial", pos = { x: 0, y: 0.5, z: 0 }, rot = 0) => {
    const wc = getWorldClient();
    wc.join(zone, pos, rot);
    set({ zone });
  },

  move: (pos, rot, anim) => getWorldClient().move(pos, rot, anim),

  harvest: async (nodeId) => {
    const r = await getWorldClient().harvest(nodeId);
    return !!r?.ok;
  },
  interact: (npcId) => getWorldClient().interact(npcId),
  combatHit: async (npcId, damage) => {
    const r = await getWorldClient().combatHit(npcId, damage);
    return !!r?.ok;
  },
  sendChat: (text, channel = "zone") => getWorldClient().chat(text, channel),
}));
