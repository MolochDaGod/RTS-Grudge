// Tiny WebSocket client for the Cloudflare chat worker
// (workers/chat). One connection per zone, auto-reconnects, fans out to
// listener sets. Reads JWT from the gw_player cookie or from
// VITE_GRUDGE_CHAT_TOKEN at boot.
//
// VITE_GRUDGE_CHAT_URL = e.g. wss://chat.grudge-studio.com or
//                              wss://rts-grudge-chat.<acct>.workers.dev

const RAW = (import.meta as any).env?.VITE_GRUDGE_CHAT_URL as string | undefined;
const CHAT_URL = RAW && RAW.length > 0 ? RAW.replace(/^http/, "ws") : "";
const TOKEN = (import.meta as any).env?.VITE_GRUDGE_CHAT_TOKEN as string | undefined;

export interface ChatIdentity { id: string; name: string; role: string; faction?: string }
export interface ChatMessage {
  from: string; name: string; role: string; faction?: string;
  text: string; channel: "zone" | "say"; ts: number;
}
export interface ChatHello {
  type: "hello"; zone: string; you: ChatIdentity;
  roster: ChatIdentity[]; backlog: ChatMessage[];
}

type Inbound =
  | ChatHello
  | { type: "msg"; body: ChatMessage }
  | { type: "join" | "leave"; who: ChatIdentity; ts: number }
  | { type: "rate"; reason: string }
  | { type: "pong"; ts: number };

type Listener<T> = (e: T) => void;
const cookieToken = () =>
  /(?:^|;\s*)gw_player=([^;]+)/.exec(document.cookie ?? "")?.[1];

class ChatClient {
  private ws: WebSocket | null = null;
  private zone = "tutorial";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private retries = 0;

  private helloL = new Set<Listener<ChatHello>>();
  private msgL = new Set<Listener<ChatMessage>>();
  private joinL = new Set<Listener<{ who: ChatIdentity; ts: number }>>();
  private leaveL = new Set<Listener<{ who: ChatIdentity; ts: number }>>();
  private statusL = new Set<Listener<"connecting" | "open" | "closed" | "error">>();

  isAvailable() { return CHAT_URL.length > 0; }

  connect(zone = "tutorial") {
    if (!CHAT_URL) { console.warn("[chat] VITE_GRUDGE_CHAT_URL is not set"); return; }
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.zone === zone) return;
    this.intentionalClose = false;
    this.zone = zone;
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }

    const token = TOKEN || cookieToken();
    const url = `${CHAT_URL.replace(/\/$/, "")}/room/${encodeURIComponent(zone)}` +
                (token ? `?token=${encodeURIComponent(token)}` : "");
    this.statusL.forEach(cb => cb("connecting"));

    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => { this.retries = 0; this.statusL.forEach(cb => cb("open")); };
    ws.onclose = () => {
      this.statusL.forEach(cb => cb("closed"));
      if (this.intentionalClose) return;
      const delay = Math.min(15_000, 1000 * Math.pow(2, this.retries++));
      this.reconnectTimer = setTimeout(() => this.connect(this.zone), delay);
    };
    ws.onerror = () => this.statusL.forEach(cb => cb("error"));
    ws.onmessage = (ev) => {
      let data: Inbound; try { data = JSON.parse(typeof ev.data === "string" ? ev.data : ""); }
      catch { return; }
      switch (data.type) {
        case "hello":  this.helloL.forEach(cb => cb(data)); break;
        case "msg":    this.msgL.forEach(cb => cb(data.body)); break;
        case "join":   this.joinL.forEach(cb => cb({ who: data.who, ts: data.ts })); break;
        case "leave":  this.leaveL.forEach(cb => cb({ who: data.who, ts: data.ts })); break;
      }
    };
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    try { this.ws?.close(1000, "client disconnect"); } catch {}
    this.ws = null;
  }

  sendMessage(text: string, channel: "zone" | "say" = "zone") {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    const payload = JSON.stringify({ type: "say", text, channel });
    this.ws.send(payload);
    return true;
  }

  ping() { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: "ping" })); }

  onHello(cb: Listener<ChatHello>)   { this.helloL.add(cb); return () => this.helloL.delete(cb); }
  onMessage(cb: Listener<ChatMessage>) { this.msgL.add(cb); return () => this.msgL.delete(cb); }
  onJoin(cb: Listener<{ who: ChatIdentity; ts: number }>)  { this.joinL.add(cb); return () => this.joinL.delete(cb); }
  onLeave(cb: Listener<{ who: ChatIdentity; ts: number }>) { this.leaveL.add(cb); return () => this.leaveL.delete(cb); }
  onStatus(cb: Listener<"connecting" | "open" | "closed" | "error">) {
    this.statusL.add(cb); return () => this.statusL.delete(cb);
  }
}

let _instance: ChatClient | null = null;
export function getChatClient(): ChatClient {
  if (!_instance) _instance = new ChatClient();
  return _instance;
}
