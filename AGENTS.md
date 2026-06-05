# AGENTS.md

Operational guide for AI coding agents working in **RTS-Grudge** (the 3D island engine
for Grudge Warlords). For game design, lore, and feature specs, read `README.md`,
`docs/GLOSSARY.md`, `docs/WEAPONS.md`, `docs/UI.md` — this file only covers what an
agent needs to make changes safely.

## Commands

| Task                                                                | Command          |
| ------------------------------------------------------------------- | ---------------- |
| Install                                                             | `npm install`    |
| Dev server (Express + Vite HMR on `:5000`)                          | `npm run dev`    |
| Production build (client → `dist/public`, server → `dist/index.cjs`)| `npm run build`  |
| Start prod build                                                    | `npm start`      |
| Typecheck                                                           | `npm run check`  |
| Tests (Vitest, one shot)                                            | `npm test`       |
| Tests (watch)                                                       | `npm run test:watch` |
| Push Drizzle schema                                                 | `npm run db:push`    |

Run a single test file: `npx vitest run path/to/file.test.ts`.
Always run `npm run check` before declaring TypeScript work done.

## Stack snapshot

React 18 + TypeScript · React-Three-Fiber + Three.js 0.170 · Rapier 3D physics ·
Zustand state · Wouter routing · Drizzle ORM (MySQL local-dev only) · Express 5 +
Vite 5 · Vitest. Production is a **static Vercel build** that proxies `/api/*` to
`api.grudge-studio.com` (Cloudflare Worker) and `/socket.io/*` to
`ws.grudge-studio.com` (Railway-hosted Express + Socket.IO world server, built
from `server/index.ts` via the root `Dockerfile`). See
`docs/deploy-world-server.md` for the Railway deploy contract.

## Repo layout (where things live)

```text
client/src/
  game/
    prefabs/        ← single-truth prefab registry (harvestables, structures, voxel)
    systems/        ← ModelRegistry, BiomeSpawnRegistry, EnemyManager, …
    components/     ← R3F scene components (Player, Enemy, ResourceNode, …)
    editor/         ← PrefabRegistry.ts (editor placement metadata)
    world/          ← zones, islands, districts, ports, events
    npc/, ai/       ← faction-hero AI + squads
    ui/             ← DOM overlays
  lib/
    data/           ← ItemPrefabRegistry, ArmorPrefabDatabase, WeaponPrefabs
    stores/         ← Zustand stores (useGame, useInventory, useEquipment, …)
    auth/           ← Puter + Grudge ID
server/             ← Express entry, REST routes (dev only)
shared/             ← Drizzle schemas + zone protocols, imported by both sides
workers/asset-api/  ← Cloudflare Worker + D1 schema for the asset registry
scripts/            ← FBX→GLB converters, R2 upload, audits
studio/             ← Separate Vite app (scene editor / forge embed)
```

## The "items + prefabs single source of truth" — work in progress

Several overlapping registries exist; treat them as a layered hierarchy and prefer
the **higher** layer when adding new content:

1. `client/src/game/prefabs/registry.ts` — `PREFAB_REGISTRY` (world-interactive prefabs:
   harvestables, structures, voxel patches). This is the **canonical** prefab truth.
2. `client/src/game/systems/ModelRegistry.ts` — `ITEM_MODELS` (item-id → GLB path).
3. `client/src/game/editor/PrefabRegistry.ts` — editor placement metadata.
4. `client/src/lib/data/ItemPrefabRegistry.ts` — equippable weapons + armor (CDN icons).
5. `shared/schemas/global_data_schema.ts` `items` table — DB-backed catalog
   (`modelUrl`, `iconUrl`, `tier`, `rarity`).
6. `workers/asset-api/schema.sql` `asset_registry` — D1/R2 CDN truth.
7. `data-exports/MASTER_ALL_ITEMS.csv` — 278-item cross-game export.

When adding a new harvestable/structure/voxel: edit `prefabs/registry.ts` first,
then add the GLB-path entry in `ModelRegistry.ts`. **Do not** introduce a new
registry file — extend an existing one.

## Asset pipeline

- **Source FBX/zip drops** land in `attached_assets/`; extracted packs live in `_extract/`.
- **Static-mesh FBX → GLB**: `node scripts/convert-all-craftpix.cjs` pattern (preserves
  meshes/materials). Output → `client/public/models/<pack>/<Name>.glb`.
- **Animation-only FBX → GLB**: `node scripts/convert-fbx-to-glb.cjs` (skeleton + clips
  only, no mesh). Output → `client/public/models/animations/<pack>/<clip>.glb`.
- **Audit**: `node scripts/audit-models.cjs`. **Manifest validation**: `tsx scripts/validate-model-manifest.ts`.
- Shared KayKit textures (e.g. `tools_bits_texture.png`) must be copied next to the
  GLBs that reference them, otherwise materials render untextured.
- R2 CDN: GLBs/PNGs in production resolve from `assets.grudge-studio.com`. The
  `vercel.json` rewrites `/Models/*` → `assets.grudge-studio.com/models/*`.

## Conventions

- **Imports** use the `@/` alias = `client/src/`.
- **Path style**: Windows-friendly forward slashes in code (`client/public/models/...`).
- **Drizzle schemas** live in `shared/` (not `server/`) so the client can derive types.
- **Bone aliases**: any code that walks character skeletons must go through
  `findBoneByAlias()` in `BoneAliases.ts` — never hardcode Mixamo vs Bip001 bone names.
- **Character prefab system**: one skinned GLB per race, equipment is **child meshes
  toggled by `name.startsWith("WK_Armor_")`** etc. — never swap geometry.
- **Animation pack priority**: weapon-specific → `grudge6_brb_base` → `glocomotion`.
- **Auth + service URLs**: `client/src/lib/auth/grudgeServices.ts` is the single
  source of truth for `GRUDGE_ID_URL`, `GAME_API_URL`, `WS_URL`, `ASSETS_URL`,
  `ACCOUNT_URL` and every `localStorage` key (`grudge.token`, `grudge.token.exp`,
  `grudge.playerId`, `grudge.displayName`, `grudge.guestId`). Never redeclare
  these constants locally — import from `grudgeServices`. Override at build time
  via `VITE_GRUDGE_ID_URL`, `VITE_GAME_API_URL`, `VITE_WS_URL`, `VITE_ASSETS_URL`.
  The vanilla `grudge-auth-shim.js` keeps its own inline copy (cannot import ES
  modules) — keep it in sync by convention.
- **Tests**: place near code as `*.test.ts` / `*.test.tsx`. Run with `npm test`.
  Do not create new test scaffolding/configs.

## Don't break

- `shared/schema.ts`, `shared/schemas/*`, `shared/zoneProtocol.ts` — touching these
  ripples into the API workers, the studio app, and sibling fleet repos. Treat any
  edit as a public-API change; bump types additively, never rename existing fields.
- `client/src/game/prefabs/types.ts` `PrefabKind` / `Material` / `Tool` unions —
  every `switch` on these must stay exhaustive; extend additively and audit consumers.
- `vercel.json` rewrites — these glue the static front-end to the backend fleet.
  Don't reorder or remove `/api/*`, `/auth/*`, `/socket.io/*`, `/Models/*`.
- `railway.json` — Railway service spec for the world server. Healthcheck path
  (`/api/game-config`) and `startCommand` (`node dist/index.cjs`) must stay in
  sync with the `Dockerfile` build output and `server/index.ts`.
- `client/src/lib/auth/grudgeServices.ts` — canonical service URLs + token keys.
  Renaming an exported constant or changing a `localStorage` key invalidates
  every signed-in session across the fleet. Extend additively; if a key must
  change, write a migration read in `GrudgeSession.ts` first.
- `workers/asset-api/schema.sql` — schema changes need a D1 migration; coordinate
  with the user before editing.

## Grudge fleet (sibling repos sharing this backend)

| Game                   | Repo                  | Domain                  |
| ---------------------- | --------------------- | ----------------------- |
| Grudge Warlords hub    | Grudge-Builder        | grudgewarlords.com      |
| RTS Grudge (this repo) | RTS-Grudge            | rts-grudge.vercel.app   |
| Dungeon Crawler Quest  | Dungeon-Crawler-Quest | dcq.grudge-studio.com   |

Shared services: `api.grudge-studio.com` · `id.grudge-studio.com` ·
`assets.grudge-studio.com` · `grudge-objectstore.pages.dev`.

## Active work context

The user is consolidating item/prefab truth and integrating new skill-tree assets
at `attached_assets/grudge-skill-tree/assets/` (FBX tools, buildings, scrolls +
class/skill PNG icons). See the task list for the 4-phase plan; Phase 3 (extending
`PrefabKind` with `tool` / `building` / `item`) requires user sign-off before
starting.
