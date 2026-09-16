-- Grudge Asset Registry — D1 (SQLite) Schema
-- Run via:  wrangler d1 execute grudge-assets-db --file=workers/asset-api/schema.sql

-- ── Asset Registry ─────────────────────────────────────────────────────────────
-- Canonical source-of-truth for all 3D models, textures, and audio on R2.
-- All clients read from here via the Cloudflare Worker API instead of hitting Express.
CREATE TABLE IF NOT EXISTS asset_registry (
  id              TEXT    NOT NULL PRIMARY KEY,    -- e.g. "models_characters_elf-male_glb"
  name            TEXT    NOT NULL,                -- e.g. "elf-male"
  category        TEXT    NOT NULL,                -- character|monster|weapon|animation|spell|item|terrain|building|environment|texture|audio|font
  r2_key          TEXT    NOT NULL UNIQUE,         -- R2 object key: "models/characters/elf-male.glb"
  bone_map        TEXT,                            -- "mixamo" | "kaykit" | null
  animation_packs TEXT,                            -- JSON payload: { "animationPacks": [...], "grudgeUuid": "...", "metadata": { ... } }
  grudge_uuid     TEXT,                            -- deterministic asset UUID, promoted from the JSON payload for indexed lookup
  file_size       INTEGER,                         -- bytes
  purpose         TEXT,                            -- play|isolate|author|catalog|skip|legacy  (queryable — not a second table)
  layer           TEXT,                            -- hero|anim|vfx|weapon|harvest|…  (play-role slice)
  body_status     TEXT,                            -- unknown|real|html_fake|missing  (R2 magic-byte, not HEAD 200)
  game_era        TEXT,                            -- warlords|grudox|vox|open|cinema|forge
  texture_format  TEXT,                            -- embed|webp|ktx2|raster|author|none
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- NOTE: For tables created before grudge_uuid existed, scripts/seed-d1.ts runs
-- an idempotent `ALTER TABLE asset_registry ADD COLUMN grudge_uuid TEXT` first.
-- purpose/layer/body_status: scripts/stamp-d1-purpose.mjs ALTER + stamp.
CREATE INDEX IF NOT EXISTS idx_asset_category ON asset_registry (category);
CREATE INDEX IF NOT EXISTS idx_asset_updated  ON asset_registry (updated_at);
CREATE INDEX IF NOT EXISTS idx_asset_uuid     ON asset_registry (grudge_uuid);
CREATE INDEX IF NOT EXISTS idx_asset_purpose  ON asset_registry (purpose);
CREATE INDEX IF NOT EXISTS idx_asset_layer    ON asset_registry (layer);
CREATE INDEX IF NOT EXISTS idx_asset_era      ON asset_registry (game_era);

-- ── Game Data Versions ────────────────────────────────────────────────────────
-- Tracks the last sync of each JSON blob (weapons, skills, etc.) from R2 GAME_DATA bucket.
CREATE TABLE IF NOT EXISTS gamedata_versions (
  key         TEXT    NOT NULL PRIMARY KEY,  -- "weapons" | "skills" | etc.
  r2_key      TEXT    NOT NULL,              -- "weapons.json"
  checksum    TEXT,                          -- MD5 of last known content
  synced_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
