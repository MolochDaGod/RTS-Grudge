# Colyseus World Server — Handoff Specification

**Audience:** A separate Warp AI building the live world server on the user's
secondary "grudgestudio" workstation.
**Status:** Greenfield — replaces the existing Socket.IO server that ships in
`server/index.ts` + `server/zoneManager.ts`. The Railway slot
(`ws.grudge-studio.com`) is kept as a hot-failover target while the Colyseus
service is bedded in.

## 1. Mission

Stand up an authoritative real-time world server using **Colyseus 0.15** on the
secondary workstation, expose it at `ws.grudge-studio.com`, and deliver feature
parity with — then exceed — the current Socket.IO `ZoneManager`.

The Colyseus server is the **authority** for: player position, enemy NPCs,
resource node respawn, harvest claims, combat hit resolution, and home-island
session ownership. Save data and catalog reads stay on the existing Cloudflare
fleet (`api.grudge-studio.com`).

## 2. What you are replacing

| Concern | Current (Socket.IO) | Target (Colyseus) |
| --- | --- | --- |
| Transport | `socket.io` v4 | `colyseus` v0.15 over WebSocket |
| Zone routing | `zoneManager.ts` channels, soft-cap 50 | `ZoneRoom` per `(SectorBiome, channel)` |
| Home island | `island:create` / `island:join` events | `IslandRoom` with 4-player cap |
| State sync | Hand-rolled JSON 10 Hz batches | `@colyseus/schema` delta encoding |
| Interest mgmt | Distance check in broadcast loop | Schema filters + per-client view |
| Hosting | Railway, single replica, Dockerfile | Workstation behind Cloudflare Tunnel |

The Socket.IO server **must not be deleted** until the Colyseus service has 7
consecutive days of clean traffic on `ws.grudge-studio.com`.

## 3. Hard contracts (do not break)

### 3.1 Zone IDs

Use `shared/worldSectors.ts` `SectorBiome` verbatim. Nine valid IDs:
`forest, storm, frozen, desert, nexus, tropical, abyssal, ethereal, volcanic`.
Layout is a 3×3 grid; see the file header in `worldSectors.ts`.

### 3.2 Event names + payloads

Mirror `shared/zoneProtocol.ts`. Even though Colyseus uses room methods rather
than named Socket.IO events, the **logical message names** must match so the
client-side adapter can be a thin shim:

- C→S: `zone:join`, `zone:leave`, `zone:move`, `zone:action`, `zone:chat`,
  `island:join`, `island:create`, `island:leave`
- S→C: `zone:player-joined/left/moved`, `zone:action-result`,
  `zone:enemy-update`, `zone:resource-update`, `zone:chat-message`,
  `island:player-joined/left`

### 3.3 Constants (mirror `shared/zoneProtocol.ts`)

`ZONE_CHANNEL_SOFT_CAP=50`, `INTEREST_RADIUS=50` m, `UNSUBSCRIBE_RADIUS=100` m,
`POSITION_UPDATE_HZ=10`, `HOME_ISLAND_MAX_PLAYERS=4`,
`CHANNEL_GC_DELAY_MS=60_000`.

## 4. World simulation spec

Authoritative reference: **`GrudgesTerrainSystem.js`** (currently in
`C:\Users\nugye\Documents\` — copy it into `docs/specs/grudges-terrain-system.js`
of this repo so the handoff is self-contained).

That file defines:

- Per-sector biome material + height-field generators (matches the 9 sectors)
- Layer ordering: `terrain → water → climb → entity → event`
- Movement rules: swim when player is in the water layer, climb when in the
  climb layer, event triggers fire on entity collision with the event layer
- Server must enforce these layer rules — clients only report position; the
  server clamps to the correct layer.

Collision: Colyseus does **not** need to load full GLB visuals. It only needs
the height field + climbable/water masks per sector. Generate these once at
boot from the same seeded noise the client uses (or load pre-baked masks from
R2 if you bake them).

## 5. Auth

Every Colyseus connection must carry a Grudge ID JWT in `client.auth.token`.

- Verify against `https://id.grudge-studio.com/.well-known/jwks.json` (RS256).
  If the JWKS endpoint is not yet live, fall back to
  `GET https://id.grudge-studio.com/api/me` with the bearer token and cache the
  result for the room lifetime.
- Reject the connection (`onAuth` returning `false`) on invalid/expired tokens.
- The decoded `playerId` is the room key — never trust client-supplied IDs.

The canonical token key on the client is `grudge.token` in `localStorage` (see
`client/src/lib/auth/grudgeServices.ts`). The client will send it via
`client.joinOrCreate("zone_forest", { token })`.

## 6. Persistence

Colyseus owns ephemeral state. Long-term writes go to existing endpoints:

- **Save checkpoints** → `POST https://api.grudge-studio.com/api/saves` with
  the player's JWT. Cadence: on zone exit and every 5 min of active play.
- **Item catalog reads** → `GET https://api.grudge-studio.com/api/items` (D1-
  backed). Cache room-side for 60 s.
- **Asset URLs** are emitted by the catalog and resolve from
  `https://assets.grudge-studio.com` (R2). The server never fetches GLBs.

## 7. Hosting on the secondary workstation

Recommended path:

1. Run `colyseus@0.15` listening on `localhost:2567` (Colyseus default).
2. Expose via **Cloudflare Tunnel** named `grudge-ws`:
   `cloudflared tunnel route dns grudge-ws ws.grudge-studio.com`.
3. Add a Cloudflare DNS proxied CNAME from `ws.grudge-studio.com` to the tunnel
   target. **Grey-cloud (DNS-only) is wrong for tunnels** — leave it orange.
4. Failover: keep the Railway service warm. Flip the CNAME back to the Railway
   target if the workstation goes down. See `docs/deploy-world-server.md` for
   the Railway side.
5. Healthcheck: `GET /api/game-config` (parity with Railway) and
   `GET /colyseus/monitor` (admin-only, IP-allowlisted).

## 8. Repo layout suggestion

Create a **new sibling repo** `grudge-world-colyseus`:

```
src/
  index.ts                 # Colyseus listen + Express attach
  rooms/ZoneRoom.ts        # 9-sector authoritative simulation
  rooms/IslandRoom.ts      # 4-player home-island session
  state/PlayerState.ts     # @colyseus/schema
  state/ZoneState.ts
  sim/TerrainLayers.ts     # port of GrudgesTerrainSystem.js layer rules
  auth/verifyGrudgeId.ts   # JWKS or /api/me fallback
  persistence/grudgeApi.ts # save + catalog HTTP client
Dockerfile
package.json               # node 20, colyseus@0.15, @colyseus/schema
```

## 9. Migration plan (coordinate with main repo owner)

1. Stand up Colyseus locally, smoke-test against a dev `.env` that points at
   `id.grudge-studio.com` + `api.grudge-studio.com`.
2. Switch `ws.grudge-studio.com` from Railway → Tunnel during a low-traffic
   window. Vercel rewrite (`/socket.io/*` → `ws.grudge-studio.com`) needs to be
   updated to `/colyseus/*` in **this** repo's `vercel.json` — coordinate before
   you flip DNS.
3. Add a Vite env flag `VITE_USE_COLYSEUS=1` on the static front-end so client
   code can pick the transport (the shim layer lives in this repo).
4. After 7 days of clean traffic, delete `server/zoneManager.ts` and the
   Socket.IO block in `server/index.ts` (REST API stays).

## 10. Open questions for the main repo owner

- Do you want enemy AI authoritative on Colyseus, or stay on a separate
  worker? (Recommend: Colyseus, single-source-of-truth.)
- Should `IslandRoom` use Colyseus matchmaking by session code, or remain a
  pre-shared 6-char code like the current implementation?
- JWKS publication on `id.grudge-studio.com` — confirm the endpoint exists, or
  authorise the `/api/me` fallback for v1.
