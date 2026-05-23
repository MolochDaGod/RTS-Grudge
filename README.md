# RTS-Grudge — Grudge Warlords

> **Created by Racalvin The Pirate King** · Grudge Studio  
> The 3D island gameplay engine for Grudge Warlords — open-world combat, faction heroes, sailing, crafting, and dynamic world events. Built with React-Three-Fiber + Rapier physics.
>
> **Live:** [rts-grudge.vercel.app](https://rts-grudge.vercel.app) · **Hub:** [grudgewarlords.com/rts-grudge](https://grudgewarlords.com/rts-grudge)

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Quick Start](#quick-start)
4. [Architecture](#architecture)
5. [World & Zone System](#world--zone-system)
6. [Hero & Faction System](#hero--faction-system)
7. [Combat UI](#combat-ui)
8. [Harvest Mode](#harvest-mode)
9. [Build Mode](#build-mode)
10. [Weapon Prefabs & Object Storage](#weapon-prefabs--object-storage)
11. [Skill Icons & Hotbar](#skill-icons--hotbar)
12. [API Reference](#api-reference)
13. [Deployment](#deployment)
14. [Environment Variables](#environment-variables)

---

## Overview

Grudge Warlords is a browser-based open-world MMO where players:

- Choose a **race** (Human, Barbarian, Elf, Dwarf, Orc, Undead) and **class** (Warrior, Worge, Mage, Ranger)
- Sail between **17 world islands** across 5 zone biomes
- Complete **rotating faction missions** (Kill → Recover → Resource) from 24 named hero NPCs
- Harvest resources, craft gear, build bases, and fight AI-driven enemy waves
- Interact with **24 persistent hero agents** who sail, camp, harvest, and fight daily

---

## Tech Stack

| Layer | Technology |
|---|---|
| 3D Engine | React-Three-Fiber + Three.js |
| Physics | Rapier (via @react-three/rapier) |
| State | Zustand |
| Routing | Wouter |
| Auth | Puter.js + Grudge Auth (id.grudge-studio.com) |
| Backend | Node.js/Express on Railway |
| CDN / Object Storage | Cloudflare R2 via `molochdagod.github.io/ObjectStore` |
| Frontend Deploy | Vercel |
| UI Framework | React 18 + TypeScript |

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your MySQL credentials and API keys

# Development (Express + Vite HMR on port 5000)
npm run dev

# Production build (Vite client → dist/public, esbuild server → dist/index.cjs)
npm run build

# Production start (serves both API and client)
npm start

# Typecheck
npm run check

# Push database schema
npm run db:push
```

Dev server runs on `http://localhost:5000`. The Express server serves both the
Vite-compiled client and the REST API on the same port.

---

## Architecture

```
RTS-Grudge/
├── client/src/
│   ├── game/
│   │   ├── components/      # R3F scene components (Player, Enemy, NPCs, terrain…)
│   │   ├── world/           # World registries (zones, islands, districts, ports, events)
│   │   ├── npc/             # Faction hero AI + squad system
│   │   ├── ui/              # DOM overlays (HeroInteractionPanel, etc.)
│   │   ├── systems/         # EnemyManager, BiomeSpawnRegistry, WeaponPrefabDatabase…
│   │   ├── islands/         # Tutorial island + training island scenes
│   │   └── terrain/         # NatureScatter, GrassLayer
│   └── lib/
│       ├── stores/          # Zustand state (useGame, useInventory, useMissions…)
│       ├── data/            # ItemPrefabRegistry, ArmorPrefabDatabase, WeaponPrefabs
│       └── auth/            # Puter + Grudge auth integration
├── server/
│   ├── grudge.ts            # Express entry point
│   ├── routes.ts            # REST API routes
│   └── authMiddleware.ts    # JWT/session middleware
└── docs/                    # Extended documentation
```

### Layer ordering (world scene)

```
L0  Terrain (heightfield + water surface)
L1  Static scenery (NatureScatter — instanced foliage/rocks)
L2  Buildings / structures  (WorldObjectRegistry → World.tsx + BuildingColliders)
L3  Resource nodes           (ResourceNode.tsx — biome-weighted types)
L4  Wildlife / BiomeWildlife (BiomeSpawnRegistry species)
L5  Enemies                  (WaveSpawner → EnemyManager)
L6  Allied NPCs / Faction Heroes + 3-member squads
L7  Player
L8  Projectiles / VFX
L9  HUD / UI overlays
```

---

## World & Zone System

### 5 Zones

| Zone | Location | Biome | Min Level | Faction |
|---|---|---|---|---|
| The Rift (Central Hub) | Center | Temperate | 0 | Neutral |
| The Jade Seas | Upper-left | Tropical/Pirate | 1 | Crusade |
| The Frozen Reach | Upper-right | Ice/Snow | 15 | Fabled |
| The Ember Reaches | Lower-right | Lava/Volcanic | 25 | Legion |
| The Shattered Deep | Lower-left | Boss/Sinking | 35 | — |

### World Coordinate System

- **Origin (0,0,0)** = Central Hub island / player spawn
- **+X** = East, **+Z** = South
- `WORLD_PER_PIXEL = 1.5` world-units per image pixel on the 784×826 reference map

### Districts (Home Island)

| District | Center | Enemy Spawn | Faction |
|---|---|---|---|
| Spawn Beach | (0, -5) | ✗ | Neutral |
| Crossroads Town | (5, -28) | ✗ | Neutral |
| Market Plaza | (-5, 42) | ✗ | Neutral |
| South Harbor | (0, 85) | ✗ | Pirate |
| West Dock | (-85, 0) | ✗ | Crusade |
| East Dock | (85, 0) | ✗ | Legion |
| Ironhold Fortress | (-65, -62) | ✓ | Crusade |
| Eastern Outpost | (72, -32) | ✓ | Crusade |
| Northern Wilds | (-5, -70) | ✓ | None |

### Sinking Island System

Boss-zone islands have health and can permanently sink. Track with `useSinkingIslands`:

```ts
import { useSinkingIslands } from "@/game/world/SinkingIslandSystem";

// Apply damage
useSinkingIslands.getState().damageIsland("boss_b", 100);

// Force sink
useSinkingIslands.getState().startSinking("boss_b");

// Read state
const progress = useSinkingIslands.getState().getSinkProgress("boss_b"); // 0..1
const isSunk   = useSinkingIslands.getState().isSunk("boss_b");
```

---

## Hero & Faction System

### 24 Faction Heroes

3 factions × 2 races × 4 classes = 24 heroes. Each has:
- Daily life cycle: `at_hub → outbound → adventuring → inbound → at_hub`
- Rotating missions (Kill → Recover → Resource, cycle every 2h or on claim)
- Up to 3 squad members (hero + 3 = team of 4)
- Respawn once per real calendar day

```ts
import { useFactionHeroes } from "@/lib/stores/useFactionHeroes";
import { useMissions } from "@/lib/stores/useMissions";

// Accept hero mission (also spawns map marker)
useMissions.getState().acceptHeroMission("hero_aldric");

// Claim reward (auto-advances to next variant)
useMissions.getState().claimHeroReward("hero_aldric");

// Check hero phase
const state = useFactionHeroes.getState().heroes.get("hero_aldric");
// state.dailyState: "at_hub" | "outbound" | "adventuring" | "inbound" | "dead"
```

### Faction Hubs (World Coords)

| Faction | Hub Position | Adventure Zone |
|---|---|---|
| Crusade | (-62, 0, -90) | Tropical |
| Fabled | (95, 0, -82) | Ice |
| Legion | (-15, 0, 48) | Lava |

---

## Combat UI

### Hotbar Layout

```
[ 1 ][ 2 ][ 3 ][ 4 ] — Skill slots
[ 5 ] — Empty / unused  
[ 6 ][ 7 ][ 8 ] — Consumables (food, potions, on-use relics)
```

### Combat Mode Controls

| Key | Action |
|---|---|
| LMB | Primary attack / cast |
| RMB | Block / parry attempt |
| RMB + LMB | Ranger parry → counter-dash stun (0.5s) |
| Q | Toggle combat / harvest / build mode |
| R | Class ability 1 |
| E | Class ability 2 |
| X | Class ability 3 |
| Z | Z-key combat mechanic (stackable buff, chat bubble trigger) |
| Tab | Target cycle (WoW-style lock-on) |
| Space | Jump / double-jump (Warriors) |

### Class Combat Profiles

| Class | Spacing | Special | Berserker |
|---|---|---|---|
| Warrior | 2–3u melee | Charge + AoE sweep | — (hold ground) |
| Worge | 1–2u melee | Leap attack + Howl | 30% HP → 1.8× damage |
| Mage | 12–15u ranged | Big spell AOE + Blink back | — (retreat at 25%) |
| Ranger | 14–18u ranged | Rapid fire burst + Sidestep | — (retreat at 20%) |

### Camera

- **W** always moves forward away from camera (Fortnite-style over-shoulder)
- **Hold LMB** rotates camera
- **A/D** turn character with camera following
- **Q/E** strafe

---

## Harvest Mode

Switch with **Q** (cycle through combat → harvest → build).

### Resources & Biome Weights

| Resource | Plains | Tropical | Ice | Lava | Swamp |
|---|---|---|---|---|---|
| Wood | 15% | 32% | 4% | 0% | 10% |
| Stone | 12% | 4% | 20% | 10% | 4% |
| Fiber | 15% | 26% | 4% | 0% | 30% |
| Iron Ore | 10% | 4% | 26% | 30% | 4% |
| Crystal | 6% | 0% | 16% | 22% | 0% |
| Gold Ore | 6% | 0% | 12% | 30% | 0% |
| Raw Meat | 12% | 10% | 10% | 0% | 20% |
| Berry | 12% | 14% | 0% | 0% | 14% |
| Herb | 12% | 10% | 8% | 0% | 18% |

### Harvest Controls

- **F** — Harvest nearest resource node (within 3.5u)
- **LMB** while in harvest mode — same as F
- Harvestable wildlife (🟠 dot) also harvestable with F in harvest mode

### Mission Progress

Gathering automatically increments active `gather`-type missions:

```ts
useMissions.getState().onGather("crystal"); // increments all active gather missions for crystal
```

---

## Build Mode

Switch with **Q** (third mode in the cycle).

### Build Menu Controls

| Key | Action |
|---|---|
| B | Open/close build menu |
| LMB | Place building (when in build mode) |
| R | Rotate building preview |
| Escape | Cancel placement |

### Building Types

```ts
// From game/building/BuildMenu.tsx
"barracks" | "farm" | "storage" | "watchtower" | "mine" | "workshop"
```

### Building Interaction

Buildings spawn resource nodes around them via `addBuildingResources()`:

```ts
import { addBuildingResources } from "@/game/components/ResourceNode";

addBuildingResources("building_uid_123", [5, 0, 10], [
  { type: "wood",  count: 3 },
  { type: "stone", count: 2 },
]);
```

---

## Weapon Prefabs & Object Storage

### CDN Base URL

```
https://molochdagod.github.io/ObjectStore/icons/pack
```

### Weapon Icon URL Pattern

```
{CDN_BASE}/weapons/{typeFolder}/{itemName_slug}.png
```

Example: `https://molochdagod.github.io/ObjectStore/icons/pack/weapons/swords/iron_longsword.png`

### Weapon Type Folders

| Type | CDN Folder | Classes |
|---|---|---|
| sword | `swords/` | Warrior |
| greatsword | `greatswords/` | Warrior, Ranger |
| axe | `axes/` | Warrior |
| hammer | `hammers/` | Warrior, Mage, Worge |
| mace | `maces/` | Warrior, Mage, Worge |
| dagger | `daggers/` | Ranger, Worge |
| poleaxe | `lances/` | Warrior |
| spear | `lances/` | Ranger, Worge |
| bow | `bows/` | Ranger, Worge |
| crossbow | `crossbows/` | Ranger |
| gun | `guns/` | Ranger |
| staff | `staves/` | Mage, Worge |
| tome | `tomes/` | Mage |
| wand | `wands/` | Mage |
| shield | `shields/` | Warrior |
| relic | `focuses/` | Mage, Worge |

### Armor Icon URL Pattern

```
{CDN_BASE}/armor/{material}/{slot}/{rarity}.png
```

Example: `https://molochdagod.github.io/ObjectStore/icons/pack/armor/leather/chest/rare.png`

Materials: `cloth` · `leather` · `metal`  
Slots: `helm` · `shoulder` · `chest` · `legs` · `boots` · `belt` · `gloves` · `cape`  
Rarities: `common` · `uncommon` · `rare` · `epic` · `legendary` · `mythic`

### Weapon Tier System

| Tier | Label | DMG Mult | Hex |
|---|---|---|---|
| T0 | Starter | 0.5× | #666666 |
| T1 | Common | 1.0× | #8b7355 |
| T2 | Uncommon | 1.3× | #a8a8a8 |
| T3 | Rare | 1.6× | #4a9eff |
| T4 | Epic | 2.0× | #9d4dff |
| T5 | Legendary | 2.5× | #ff4d4d |
| T6 | Mythic | 3.0× | #ffaa00 |
| T7 | Ancient | 3.5× | #d4a84b |
| T8 | Artifact | 4.0× | #f0d890 |

### Usage in Code

```ts
import { getWeaponIconUrl } from "@/lib/data/ItemPrefabRegistry";
import { WEAPON_TYPE_EMOJI } from "@/lib/data/ItemPrefabRegistry";

// CDN icon URL
const url  = getWeaponIconUrl("sword", variant);  // full CDN path

// Emoji fallback
const emoji = WEAPON_TYPE_EMOJI["sword"]; // "⚔️"

// Armor icon URL
import { getArmorIconUrl } from "@/lib/data/ItemPrefabRegistry";
const armorUrl = getArmorIconUrl(armorPrefab); // CDN path
```

### Item Prefab Override System

Players and admins can override item stats/icons, persisted in `localStorage`:

```ts
import { saveItemOverride, resetItemOverride } from "@/lib/data/ItemPrefabRegistry";

// Override a specific weapon's damage
saveItemOverride({
  id:    "weapon_sword_v3",
  name:  "Renamed Sword",
  stats: { damage: 55, attackSpeed: 1.4 },
  lore:  "Custom lore text.",
});

// Reset to defaults
resetItemOverride("weapon_sword_v3");
```

---

## Skill Icons & Hotbar

### Skill Icon Sources

Skill icons resolve via the Grudge Object Store CDN:

```
{CDN_BASE}/skills/{class}/{skillName}.png
```

Example: `https://molochdagod.github.io/ObjectStore/icons/pack/skills/warrior/charge.png`

### Default Hotbar Action Slots

```ts
import { useEquipment } from "@/lib/stores/useEquipment";

// Set a custom action slot
useEquipment.getState().setActionSlot(0, {
  label:         "Fireball",
  animationName: "skill1",
  cooldown:      3,
  icon:          "🔥",  // emoji fallback
  iconUrl:       "https://molochdagod.github.io/ObjectStore/icons/pack/skills/mage/fireball.png",
  type:          "skill",
});

// Use an action slot (returns false if on cooldown)
const success = useEquipment.getState().useAction(0);
```

### Slot Layout by Class

```
Warrior hotbar  [⚔ Slash][🛡 Guard][💥 Charge][🌀 AoE][  ][🍖 Meat][❤️ Potion][  ]
Mage hotbar     [🔥 Fire ][💧 Ice  ][⚡ Bolt  ][📖 AOE][  ][🧪 Tonic][💙 Mana  ][  ]
Ranger hotbar   [🏹 Shot ][🎯 Aim  ][💨 Dash  ][🌀 Trap][  ][🥩 Meat][❤️ Potion][  ]
Worge hotbar    [🐾 Claw ][🐺 Leap ][🌙 Shift ][🌀 Howl][  ][🥩 Meat][🧪 Tonic ][  ]
```

### Cape Active Ability

Capes have a special active ability on a cooldown. Swapping capes while the ability is on cooldown is blocked:

```ts
const result = useEquipment.getState().useCapeAbility();
// { ok: true, effect: "speed_boost" }
// { ok: false, remainingCd: 12.4 }

const isLocked = useEquipment.getState().isCapeSwapLocked();
```

---

## API Reference

### Base URL

- **Local**: `http://localhost:3001`
- **Production**: `https://client.grudge-studio.com`

### Authentication

All protected routes require a Grudge session cookie or Bearer token:

```
Authorization: Bearer <grudge_session_token>
```

Auth is issued by `id.grudge-studio.com` (Puter-backed Grudge Auth).

### Character Endpoints

```
GET    /api/characters           List all characters for current user
GET    /api/characters/:id       Get character by ID
POST   /api/characters           Create new character
PUT    /api/characters/:id       Update character stats/equipment
DELETE /api/characters/:id       Delete character
```

### Inventory Endpoints

```
GET    /api/inventory            Get player inventory
POST   /api/inventory/add        Add item to inventory
DELETE /api/inventory/:itemId    Remove item
POST   /api/inventory/equip      Equip item from inventory
```

### World / Mission Endpoints

```
GET    /api/missions             List available missions for current zone
POST   /api/missions/:id/accept  Accept a mission
POST   /api/missions/:id/claim   Claim completed mission reward
GET    /api/world/events         List active world events
```

### Object Store Endpoints

```
GET    /api/assets/weapons       List all weapon prefab metadata
GET    /api/assets/armor         List all armor prefab metadata
GET    /api/assets/icons/:type   Get icon CDN URLs for item type
```

### WebSocket Events

Connect to `wss://client.grudge-studio.com/ws`:

```json
// Server → Client
{ "type": "world_event_start",  "eventId": "event_crusade_invasion" }
{ "type": "hero_state_change",  "heroId": "hero_aldric", "state": "adventuring" }
{ "type": "enemy_spawn",        "enemyId": "e_001", "position": [x, y, z] }

// Client → Server
{ "type": "player_position",    "x": 0, "z": -5 }
{ "type": "enemy_kill",         "enemyId": "e_001", "position": [x, y, z] }
```

---

## Deployment

RTS-Grudge is a **web app** — the 3D island gameplay portion of Grudge Warlords.
It deploys as a static Vite build on Vercel with API calls proxied to the Grudge
backend services.

### Vercel (Frontend — `rts-grudge.vercel.app`)

Push to `main` triggers automatic Vercel deployment. The `vercel.json` handles:

- **Build**: `npm run build` → outputs to `dist/public`
- **SPA fallback**: all non-file routes serve `index.html`
- **API proxy**: `/api/*` → `api.grudge-studio.com` (Cloudflare Worker)
- **Auth proxy**: `/auth/*` → `id.grudge-studio.com`
- **Model CDN**: `/Models/*` → `assets.grudge-studio.com/models/*` (R2)
- **Cache headers**: immutable for `/assets/*`, 24h for models/audio/images

Vercel routes config (`vercel.json`):

```
/api/*       → https://api.grudge-studio.com/api/*
/auth/*      → https://id.grudge-studio.com/auth/*
/Models/*    → https://assets.grudge-studio.com/models/*
/*           → /index.html (SPA catch-all)
```

### Backend Services (Cloudflare Workers)

RTS-Grudge does **not** run its own backend in production. All API calls proxy
to the shared Grudge Studio infrastructure:

| Service | Domain | Purpose |
|---|---|---|
| Game API | `api.grudge-studio.com` | Characters, saves, inventory, game-config |
| Auth (Grudge ID) | `id.grudge-studio.com` | JWT auth, SSO, token validation |
| Asset CDN | `assets.grudge-studio.com` | 3D models, sprites, audio (R2) |
| ObjectStore | `grudge-objectstore.pages.dev` | Weapons, armor, classes JSON |
| Puter SDK | `js.puter.com/v2` | Cloud save, AI, guest accounts |

### Cloudflare (CDN / Object Storage)

Binary assets (GLB models, sprites, audio) are stored in Cloudflare R2 and
served via `assets.grudge-studio.com`. JSON game data is served from GitHub
Pages at `grudge-objectstore.pages.dev/api/v1/`.

R2 uploads are handled by `server/r2Service.ts` when running the Express
server locally with R2 credentials configured.

### Local Backend (Development Only)

The Express server (`npm run dev`) runs locally for development with:
- Vite HMR proxy for the React client
- MySQL database for saves, loadouts, inventory, wallets
- AI chat endpoints (dev-only file editing gated behind `NODE_ENV`)
- Grudge ObjectStore sync
- Local `/Models` static file serving

In production, none of this runs — the Vercel static build handles everything
via API rewrites to the shared Grudge backend.

---

## Environment Variables

See `.env.example` for the full list. Key variables for local development:

```bash
# Server
PORT=5000
NODE_ENV=development

# Database (MySQL — local dev only, not used in Vercel production)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=grudge_admin
MYSQL_PASSWORD=<your-password>
MYSQL_DATABASE=grudge_game

# Auth service
GRUDGE_ID_URL=https://id.grudge-studio.com

# CORS (production)
# CORS_ORIGINS=https://grudgewarlords.com,https://client.grudge-studio.com

# R2 / Cloudflare (optional — enables CDN uploads)
# CLOUDFLARE_ACCOUNT_ID=
# R2_ACCESS_KEY_ID=
# R2_SECRET_ACCESS_KEY=
# R2_CDN_BASE=https://assets.grudge-studio.com

# AI providers (optional — at least one needed for /api/ai-chat)
# OPENROUTER_API_KEY=sk-or-v1-...
```

In **production on Vercel**, no env vars are needed — the static build proxies
all API calls to the Grudge backend via `vercel.json` rewrites.

---

## See Also

- [docs/GLOSSARY.md](docs/GLOSSARY.md) — Terms and definitions
- [docs/WEAPONS.md](docs/WEAPONS.md) — Weapon prefab catalogue and object storage mapping
- [docs/UI.md](docs/UI.md) — Combat, harvest, and build UI specifications

---

## Grudge Fleet

RTS-Grudge is one game in the **Grudge Warlords** fleet. All games share the same Grudge ID, characters, and backend.

| Game | Repo | Domain | Engine |
|---|---|---|---|
| **Grudge Warlords** (hub) | Grudge-Builder | grudgewarlords.com | React + Three.js + Phaser |
| **RTS Grudge** (this repo) | RTS-Grudge | rts-grudge.vercel.app | React-Three-Fiber + Rapier |
| **Dungeon Crawler Quest** | Dungeon-Crawler-Quest | dcq.grudge-studio.com | BabylonJS + Havok |

All games connect to the same backend services:
- `api.grudge-studio.com` — Game API (characters, saves, inventory)
- `id.grudge-studio.com` — Auth (SSO, OAuth, JWT)
- `assets.grudge-studio.com` — Asset CDN (R2)
- `grudge-objectstore.pages.dev` — Game data (weapons, armor, classes)

---

*Grudge Studio · Built by Racalvin The Pirate King*
