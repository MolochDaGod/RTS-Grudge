# Deploying the world server (Railway)

The world server is the Express + Socket.IO process built from `server/index.ts`.
In production it runs on Railway behind `ws.grudge-studio.com`; the static
Vercel front-end reaches it via the `/socket.io/(.*)` rewrite in `vercel.json`.

## Service contract

| Setting             | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| Build               | Root `Dockerfile` (multi-stage, output `dist/index.cjs`)|
| Start command       | `node dist/index.cjs`                                   |
| Healthcheck path    | `/api/game-config`                                      |
| Public domain       | `ws.grudge-studio.com` (Cloudflare → Railway custom domain) |
| Internal port       | Railway-injected `PORT` (`server/index.ts` reads `process.env.PORT`) |
| Restart policy      | `ON_FAILURE`, max 3 retries                             |
| Replicas            | 1 (matchmaking state is in-process; see Caveats)        |

`railway.json` at the repo root encodes the above. Railway picks it up
automatically on each push.

## Environment variables

Set these in the Railway service (Settings → Variables):

| Name             | Required | Notes                                                  |
| ---------------- | -------- | ------------------------------------------------------ |
| `NODE_ENV`       | yes      | `production`                                           |
| `CORS_ORIGINS`   | yes      | Comma-separated allow-list. Minimum: `https://rts-grudge.vercel.app,https://grudgewarlords.com`. Add any Vercel preview domains you need. |
| `PORT`           | no       | Injected by Railway. Do not hard-set.                  |
| `GRUDGE_API_BASE`| no       | Upstream REST base for `server/grudge.ts` syncer. Defaults to `https://api.grudge-studio.com`. |
| `DATABASE_URL`   | no       | Only set if the MySQL/Drizzle dev path is ever exercised in prod. Currently unused at runtime. |

The same `CORS_ORIGINS` value gates both the Express CORS middleware
(line 23 of `server/index.ts`) and the Socket.IO CORS handshake
(line 147 of `server/index.ts`).

## DNS

`ws.grudge-studio.com` is a CNAME in Cloudflare pointing at the Railway custom
domain target. Proxy status must be **DNS-only (grey cloud)** — orange-cloud
proxy strips WebSocket upgrade headers under Cloudflare's free plan.

## Vercel wiring

`vercel.json` includes:

```json
{ "src": "/socket.io/(.*)", "dest": "https://ws.grudge-studio.com/socket.io/$1" }
```

before the `filesystem` handler. CSP `frame-ancestors` includes
`https://ws.grudge-studio.com`. Clients should connect with same-origin
`io({ path: "/socket.io" })` so the rewrite handles routing — direct
`io("https://ws.grudge-studio.com")` also works and skips the Vercel hop
(use this if the rewrite ever drops WebSocket upgrade frames).

## Caveats

- **Single replica.** `server/zoneManager.ts` keeps channel/home-island state
  in memory. Horizontal scaling needs a Redis adapter for Socket.IO and a
  shared room registry before `numReplicas` can be raised.
- **Healthcheck.** `/api/game-config` is registered by `registerRoutes()` in
  `server/routes.ts`. If that route is ever renamed, update `railway.json`
  and this doc in the same change.
- **Build output.** The Dockerfile produces `dist/index.cjs`; never change
  the `node dist/index.cjs` start command without also bumping the Dockerfile
  build target.
