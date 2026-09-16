# Game asset D1 practice (scheme)

D1 is the **asset index**. Railway Postgres is **player** SSOT (characters, bag, wallet). Do not write heroes into D1.

## UUID (one law)

```
sha1("grudge-asset:" + r2_key) → UUID v5
```

Used on `asset_registry.grudge_uuid`, ObjectStore `assets.id` + `assets.grudge_uuid`, `gn_assets.grudge_uuid`.

`HERO-` / `EQIP-` / `ITEM-` are **item instance / catalog stamps**, not file-row PKs.

`game_uuid` = Railway **character** UUID. Only on hero-bound rows. Never on every mesh.

## Required file-row columns

| Column | Values |
|--------|--------|
| `r2_key` / `key` | UNIQUE path in R2 |
| `grudge_uuid` | UUID v5 above |
| `game_era` | warlords \| grudox \| open \| cinema \| forge |
| `purpose` | play \| isolate \| author \| catalog \| skip \| legacy |
| `body_status` | real \| missing \| html_fake \| unknown |
| `file_size` / `size` | CDN Content-Length; 0 only if missing |

`purpose=play` is the play kit only (`loadRaceKit` Toon `{race}.glb`, `prod/anims`, T0 weapons, approved VFX). Everything else is catalog/skip.

## Indexes (live)

- `asset_registry`: category, purpose, layer, game_era, grudge_uuid, unique r2_key
- `assets`: key, category, grudge_uuid, game_era
- `gn_assets`: grudge_uuid, r2_key

## Writes

- Batch ≤ 80 statements per `wrangler d1 execute --file`
- `CLOUDFLARE_ACCOUNT_ID=ee475864561b02d4588180b8b9acf694`
- CDN HEAD before claiming `body_status=real`
- Missing CDN → `purpose=skip`, do not invent size
- Workers: files `grudge-asset-cdn`; search `grudgeassets`; AI `grudge-ai-hub` from `F:\GitHub\grudge-ai-hub` only

Scripts: `scripts/stamp-d1-purpose.mjs`, `scripts/correct-d1-uuids.mjs`, ObjectStore `scripts/correct-objectstore-uuids.mjs`, `scripts/stamp-gn-assets-uuid.mjs`.
