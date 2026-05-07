// Durable Object: one ChatRoom per zone. Holds in-memory roster + a
// rolling buffer of the last 50 messages, broadcasts to attached
// WebSockets, and uses the Cloudflare hibernation API so idle zones
// don't burn duration.

interface Identity { id: string; name: string; role: string; faction?: string }
interface ChatMsg { from: string; name: string; role: string; faction?: string;
                    text: string; channel: "zone" | "say"; ts: number }

const BUFFER = 50;
const RATE_WINDOW_MS = 1500;
const RATE_LIMIT = 4; // 4 messages per 1.5s per player

export class ChatRoom {
  private state: DurableObjectState;
  private buffer: ChatMsg[] = [];
  private rate = new Map<string, number[]>(); // playerId -> timestamps
  private zone = "tutorial";

  constructor(state: DurableObjectState) {
    this.state = state;
    state.blockConcurrencyWhile(async () => {
      const buf = await state.storage.get<ChatMsg[]>("buffer");
      if (Array.isArray(buf)) this.buffer = buf;
    });
  }

  async fetch(req: Request): Promise<Response> {
    const ident: Identity = {
      id: req.headers.get("X-Player-Id") ?? "",
      name: req.headers.get("X-Player-Name") ?? "Anonymous",
      role: req.headers.get("X-Player-Role") ?? "player",
      faction: req.headers.get("X-Player-Faction") ?? undefined,
    };
    const zone = req.headers.get("X-Zone") ?? "tutorial";
    this.zone = zone;
    if (!ident.id) return new Response("no identity", { status: 401 });

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    // Attach identity so the hibernation handler can read it back.
    server.serializeAttachment({ ident, zone });

    this.state.acceptWebSocket(server);

    // Send roster + recent backlog so the new client renders history.
    const roster = this.currentRoster();
    server.send(JSON.stringify({ type: "hello", zone, you: ident, roster, backlog: this.buffer }));
    this.broadcast({ type: "join", who: ident, ts: Date.now() }, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // Hibernation API: WS callbacks live on the DO itself.
  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const att = ws.deserializeAttachment() as { ident: Identity; zone: string } | null;
    if (!att) { ws.close(1011, "no attachment"); return; }
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    let msg: any;
    try { msg = JSON.parse(text); } catch { return; }

    if (msg?.type === "ping") { ws.send(JSON.stringify({ type: "pong", ts: Date.now() })); return; }
    if (msg?.type !== "say") return;

    if (!this.allow(att.ident.id)) {
      ws.send(JSON.stringify({ type: "rate", reason: "slow_down" }));
      return;
    }

    const body: ChatMsg = {
      from: att.ident.id,
      name: att.ident.name,
      role: att.ident.role,
      faction: att.ident.faction,
      text: String(msg.text ?? "").slice(0, 240),
      channel: msg.channel === "say" ? "say" : "zone",
      ts: Date.now(),
    };
    if (!body.text.trim()) return;

    this.buffer.push(body);
    if (this.buffer.length > BUFFER) this.buffer.splice(0, this.buffer.length - BUFFER);
    await this.state.storage.put("buffer", this.buffer);
    this.broadcast({ type: "msg", body });
  }

  async webSocketClose(ws: WebSocket) {
    const att = ws.deserializeAttachment() as { ident: Identity } | null;
    if (att?.ident) this.broadcast({ type: "leave", who: att.ident, ts: Date.now() }, ws);
  }
  async webSocketError(ws: WebSocket) { try { ws.close(1011, "error"); } catch {} }

  private allow(playerId: string): boolean {
    const now = Date.now();
    const arr = (this.rate.get(playerId) ?? []).filter(t => now - t < RATE_WINDOW_MS);
    if (arr.length >= RATE_LIMIT) { this.rate.set(playerId, arr); return false; }
    arr.push(now); this.rate.set(playerId, arr); return true;
  }

  private currentRoster(): Identity[] {
    const out: Identity[] = [];
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() as { ident: Identity } | null;
      if (att?.ident) out.push(att.ident);
    }
    return out;
  }

  private broadcast(payload: any, except?: WebSocket) {
    const text = JSON.stringify(payload);
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(text); } catch {}
    }
  }
}
