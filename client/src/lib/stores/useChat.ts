import { create } from "zustand";
import {
  getChatClient, type ChatIdentity, type ChatMessage,
} from "@/lib/grudge/chatClient";

// React-friendly mirror of the Cloudflare chat worker. The store keeps a
// rolling buffer of messages + the current roster and exposes helpers
// for connect/send. Falls back to silent no-op if the worker URL is
// unavailable, so the rest of the UI keeps working.

const MAX_MESSAGES = 120;

interface ChatStore {
  status: "idle" | "connecting" | "open" | "closed" | "error";
  zone: string;
  self: ChatIdentity | null;
  roster: ChatIdentity[];
  messages: ChatMessage[];
  available: boolean;

  connect: (zone?: string) => void;
  disconnect: () => void;
  send: (text: string, channel?: "zone" | "say") => boolean;
}

let bound = false;

export const useChat = create<ChatStore>((set, get) => ({
  status: "idle",
  zone: "tutorial",
  self: null,
  roster: [],
  messages: [],
  available: getChatClient().isAvailable(),

  connect: (zone = "tutorial") => {
    const cc = getChatClient();
    if (!cc.isAvailable()) { set({ status: "error", available: false }); return; }
    if (!bound) {
      bound = true;
      cc.onHello((hello) => set({
        zone: hello.zone,
        self: hello.you,
        roster: hello.roster,
        messages: hello.backlog.slice(-MAX_MESSAGES),
      }));
      cc.onMessage((m) => set((s) => ({
        messages: [...s.messages.slice(-(MAX_MESSAGES - 1)), m],
      })));
      cc.onJoin(({ who }) => set((s) => {
        if (s.roster.some(r => r.id === who.id)) return {};
        return { roster: [...s.roster, who] };
      }));
      cc.onLeave(({ who }) => set((s) => ({
        roster: s.roster.filter(r => r.id !== who.id),
      })));
      cc.onStatus((status) => set({ status }));
    }
    set({ status: "connecting", zone });
    cc.connect(zone);
  },

  disconnect: () => {
    getChatClient().disconnect();
    set({ status: "closed" });
  },

  send: (text, channel = "zone") => {
    const cc = getChatClient();
    return cc.sendMessage(text, channel);
  },
}));
