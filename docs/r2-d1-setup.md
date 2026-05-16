# R2 + D1 Asset Pipeline — Setup Guide

This document walks through the full setup from zero to production CDN-backed assets.

---

## Architecture

```
Players worldwide
      │
      ▼
assets.grudge-studio.com  ←── Cloudflare R2 (grudge-assets bucket)
      │                              GLBs, textures, audio
      │
api.grudge-studio.com     ←── Cloudflare Worker (workers/asset-api/index.ts)
      │                              Queries D1 for manifest
      │
      ▼
D1: grudge-assets-db      ←── Asset manifest (id, name, category, CDN URL, bone map)
      
Railway / PostgreSQL       ←── Player saves, auth, loadouts (Drizzle ORM)
```

**Dev**: all assets load from `localhost:5000/models/...` (Express static, unchanged)  
**Prod**: `VITE_ASSET_CDN_BASE=https://assets.grudge-studio.com` → every `loadAsset()` call in the game rewrites the path to the R2 CDN URL automatically.

---

## Step 1 — Create the R2 Buckets

In [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2**:

1. Create bucket `grudge-assets` (stores GLBs, textures, audio)
2. Create bucket `grudge-gamedata` (stores weapons.json, skills.json etc.)
3. For `grudge-assets`: go to **Settings → Custom Domains** → connect domain `assets.grudge-studio.com`
   - Requires `grudge-studio.com` on Cloudflare DNS — add a CNAME handled by Cloudflare automatically.
4. Create an **R2 API Token**:
   - R2 → Manage R2 API Tokens → Create API Token
   - Permissions: Object Read & Write on both buckets
   - Copy `Access Key ID` and `Secret Access Key`

Add to `.env`:

```
CLOUDFLARE_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_BUCKET_NAME=grudge-assets
R2_GAMEDATA_BUCKET=grudge-gamedata
R2_CDN_BASE=https://assets.grudge-studio.com
```

---

## Step 2 — Upload All Assets to R2

```bash
# Dry run first (no actual upload, generates manifest)
npx ts-node scripts/upload-to-r2.ts --dry-run

# Upload everything
npx ts-node scripts/upload-to-r2.ts

# Or upload only one category
npx ts-node scripts/upload-to-r2.ts --category character
```

This:

- Walks all `client/public/models/**`, `client/public/textures/**`, `client/public/sounds/**`
- Uploads each file to R2 with the same relative key (e.g. `models/characters/elf-male.glb`)
- Skips files already on R2 with matching MD5 (ETag)
- Writes `dist/asset-manifest.json` with CDN URLs

**Current asset count (estimated)**:

| Category | Count |
|---|---|
| Character GLBs | 27 |
| Monster GLBs | 14 |
| RTS Building GLBs | 24 |
| Animation GLBs | 66+ |
| Weapon GLBs | 250+ |
| Terrain GLBs | 305 |
| Other models | ~200+ |
| **Total** | **~900+ files** |

---

## Step 3 — Create the D1 Database

```bash
# Create the database (run once)
npx wrangler d1 create grudge-assets-db

# Note the database_id in the output — paste it into wrangler.toml:
# [[d1_databases]]
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Apply schema
npx wrangler d1 execute grudge-assets-db --file=workers/asset-api/schema.sql

# Seed with manifest from Step 2
npx ts-node scripts/seed-d1.ts
```

---

## Step 4 — Deploy the Cloudflare Worker

```bash
# Install wrangler if needed
npm install -g wrangler

# Authenticate
npx wrangler login

# Add the admin secret (keeps POST /assets protected)
npx wrangler secret put GRUDGE_ADMIN_TOKEN

# Deploy
npx wrangler deploy
```

After deploy, test:

```bash
curl https://api.grudge-studio.com/assets?limit=5
curl https://api.grudge-studio.com/assets/category/character
curl https://api.grudge-studio.com/gamedata/weapons
```

---

## Step 5 — Enable CDN in the Game Client

Set the Vite env var in production:

```bash
# In your deployment env (Vercel, Railway, etc.):
VITE_ASSET_CDN_BASE=https://assets.grudge-studio.com
```

Or locally to test CDN loading:

```bash
# .env.local (gitignored)
VITE_ASSET_CDN_BASE=https://assets.grudge-studio.com
```

**How it works**: `ModelRegistry.resolveAssetUrl("/models/characters/elf-male.glb")` returns `https://assets.grudge-studio.com/models/characters/elf-male.glb` when the env var is set. `AssetLoader.loadAsset()` calls this automatically — zero code changes needed per model.

---

## Step 6 — Sync Game Data to R2 (replaces Pages static JSON)

The object store JSON (weapons, skills, materials, etc.) currently lives at `grudge-objectstore.pages.dev`. After this migration, it lives in R2 served by the Worker.

Update `server/grudge.ts` OBJECT_STORE_BASE:

```typescript
// Old (Cloudflare Pages static files):
const OBJECT_STORE_BASE = "https://grudge-objectstore.pages.dev/api/v1";

// New (Cloudflare Worker + R2):
const OBJECT_STORE_BASE = process.env.ASSET_API_BASE ?? "https://api.grudge-studio.com/gamedata";
```

To push game data to R2:

```bash
# Via the admin API (when the server is running)
curl -X POST https://your-server/api/grudge/sync \
  -H "GRUDGE_ADMIN_TOKEN: your-token"
```

The sync route calls `uploadGameData()` in `server/r2Service.ts` for each data type.

---

## CORS

R2 public access doesn't require any CORS config for read-only browser fetches of GLBs/textures (they're not cross-origin API calls). The Worker at `api.grudge-studio.com` already returns `Access-Control-Allow-Origin: *` for all `/assets*` and `/gamedata*` routes.

---

## Cost at Scale

| Resource | Free Tier | Paid |
|---|---|---|
| R2 Storage | 10 GB/month | $0.015/GB |
| R2 Class A ops (writes) | 1M/month | $4.50/million |
| R2 Class B ops (reads) | 10M/month | $0.36/million |
| D1 Reads | 5B/day | included in $5/mo Workers plan |
| Worker requests | 100K/day | $0.30/million |

For a game with ~1000 daily active users loading ~50 unique assets each: ~50K read ops/day, well within free tier.

---

## Development Workflow (no change needed)

Local dev works exactly as before — `VITE_ASSET_CDN_BASE` is not set, so:

- Assets load from Express at `localhost:5000/models/...`
- No R2 credentials needed
- No wrangler needed
- `npm run dev` works as always

Only set `VITE_ASSET_CDN_BASE` in your production deployment config.
