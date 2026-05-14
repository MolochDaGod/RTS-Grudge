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
  file_size       INTEGER,                         -- bytes
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_asset_category ON asset_registry (category);
CREATE INDEX IF NOT EXISTS idx_asset_updated  ON asset_registry (updated_at);

-- ── Game Data Versions ────────────────────────────────────────────────────────
-- Tracks the last sync of each JSON blob (weapons, skills, etc.) from R2 GAME_DATA bucket.
CREATE TABLE IF NOT EXISTS gamedata_versions (
  key         TEXT    NOT NULL PRIMARY KEY,  -- "weapons" | "skills" | etc.
  r2_key      TEXT    NOT NULL,              -- "weapons.json"
  checksum    TEXT,                          -- MD5 of last known content
  synced_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
