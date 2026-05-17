# Glossary — Grudge Warlords

> Terms, definitions, and technical concepts used across the RTS-Grudge codebase and game design.

---

## Game Design Terms

### Biome
A named ecological region within the world that determines which enemy types, wildlife species, and resource nodes appear at a given location. Biomes are defined in `BiomeSpawnRegistry.ts` and include: `plains`, `forest`, `tropical`, `desert`, `swamp`, `snow`, `lava`, `jungle`, `coast`, `mountains`.

### Camp
A temporary base established by a hero or allied NPC when adventuring on an island. Marked by a small campfire visual. The camp's position acts as the patrol centre for the hero and their squad. Created automatically on the hero's first field tick via `useFactionHeroes.placeCamp()`.

### Class
One of four combat archetypes a player or hero NPC can be:
- **Warrior** — melee tank/fighter, shield bearer
- **Mage** — ranged spellcaster, kiting style
- **Ranger** — long-range physical/projectile, scouting and harvesting
- **Worge** — shapeshifter/beast, aggressive flanking with berserker mode

### Collision Group
A Rapier physics group number used to control which objects interact. Groups: TERRAIN(0), PLAYER(1), BUILDING(2), ENEMY(3), PROJECTILE(4), NPC(5), TRIGGER(6), RESOURCE(7), CLIMBABLE(8), LADDER(9), ALLY(10), WATER(11), BOAT(12), LOOT(13). Defined in `BuildingColliders.tsx`.

### District
A named neighbourhood within the home island with associated faction ownership, enemy-spawn permission, resource bias, and ambient NPC archetypes. Defined in `DistrictRegistry.ts`. Examples: `town_medieval`, `harbor_south`, `fortress_nw`.

### Faction
One of three player-aligned power groups:
- **Crusade** — Human + Barbarian races, gold/amber colour `#c9a044`
- **Fabled** — Dwarf + Elf races, blue colour `#44a8cc`
- **Legion** — Orc + Undead races, red colour `#cc4444`

### Faction Hero
One of 24 named AI-player agents permanently assigned to a faction. Each has a unique name, class, lore quote, and daily adventure schedule. Heroes give missions, sell items (vendors), and operate in the world like player characters.

### Gouldstone
A special item that allows a player to clone themselves, creating an AI companion (GOULD) with the original player's stats, gear, and profession levels. Players can deploy up to 15 Gouldstone allies.

### Grudge ID
A unique persistent player identifier generated from a Puter account, linking cloud storage, characters, and session state. Format: UUID v4 tied to `puter.id`.

### Hero Daily Cycle
The UTC-clock schedule that governs where a faction hero physically is:
- `00:00–05:59` UTC → `at_hub` (morning rest, missions available)
- `06:00–06:29` → `outbound` (departing, invisible)
- `06:30–17:59` → `adventuring` (on adventure island)
- `18:00–18:29` → `inbound` (returning, invisible)
- `18:30–23:59` → `at_hub` (evening debrief)

### Home Island
The central tutorial island (The Rift) at world position (0, 0, 0). Features the `town_medieval` district, harbors, market plaza, fortress, and outpost. World size: 200×200 world-units. Terrain resolution: 128×128 heightfield.

### Hub
A faction outpost where heroes gather when at_hub. Three hubs exist on the central island, one per faction:
- Crusade: (-62, 0, -90)
- Fabled: (95, 0, -82)
- Legion: (-15, 0, 48)

### Island Grid
The coordinate system for sailing destinations in `useIslandWorld`. Each island has a `[gridX, gridZ]` address. The home island is `[0, 0]`. Adventure islands are at e.g. `[-2, -2]` (crusade tropical) or `[3, 1]` (legion lava).

### Lore
In-world narrative text attached to heroes, items, and missions. Hero lore describes their backstory and faction role.

### Mission Variant
One of three rotating mission types per hero: Kill (fight enemies), Recover (gather lost materials), Resource (crafting/material request). Cycles on claim or every 2 real hours via `useMissions.checkAndRotate()`.

### Object Storage (ObjectStore)
The Grudge-hosted CDN for game assets. Base URL: `https://molochdagod.github.io/ObjectStore`. Contains icons for weapons, armor, skills, characters, and backgrounds. Backed by Cloudflare R2.

### Port
A named dock location with faction affiliation, sailing destinations, resupply services, and ambient NPC archetypes. Defined in `PortRegistry.ts`. The three home-island ports are `home_south`, `home_west`, `home_east`.

### Race
The species of a player character or hero NPC. Six playable races:
- **Human** (Crusade) — +10% XP gain
- **Barbarian** (Crusade) — +HP regen
- **Elf** (Fabled) — +Mana regen
- **Dwarf** (Fabled) — +Mining efficiency
- **Orc** (Legion) — +Melee damage
- **Undead** (Legion) — +Shadow resistance

### Resource Node
An interactable world object that yields crafting materials on harvest. 150 nodes are seeded across the home island at game start. Node types and their placement are biome-weighted. Defined in `ResourceNode.tsx` / `globalResourceRegistry`.

### Sinking Island
A boss-zone island that has health points and can transition through states: `stable → damaged → sinking → sunk → respawning → stable`. Tracked by `useSinkingIslands.ts`. Visual descent is driven by `sinkProgress` (0→1).

### Squad
Up to 3 lightweight AI allies attached to a faction hero's camp when adventuring. Each squad has a class-specific composition (2 soldiers + 1 archer for Warrior heroes, etc.). Rendered as coloured capsule meshes via `HeroSquadMember.tsx`.

### Tier
Item quality level from T0 (Starter) to T8 (Artifact). Tiers affect stat multipliers (0.5× → 4.0×) and visual rarity colours. Used in `useEquipment.tsx`, `WeaponPrefabDatabase.ts`, and `ArmorPrefabDatabase.ts`.

### Waypoint
A user-placed marker on the world map. Stored in `useWorldMap.waypoints`. Can be named, coloured, and tracked with a compass needle.

### Wave
One round of enemy spawning. `WaveSpawner.tsx` tracks `waveEnemiesSpawned` per wave. After the last enemy is killed, `nextWave()` is called, incrementing the wave counter and scaling enemy count/difficulty.

### World Event
A timed, UTC-scheduled game-wide occurrence that modifies gameplay in a zone. Types: `FactionInvasion`, `TreasureSpawn`, `BossEmergence`, `ResourceBoom`, `StormEvent`. Defined in `WorldEventRegistry.ts`, tracked in `useWorldEvents.ts`.

### Zone
One of five macro regions of the world map. Each zone has a biome identity, fog/ambient settings, asset paths, enemy types, and resource concentrations. Defined in `WorldZoneRegistry.ts`.

### Worge
A shapeshifting race/class that can transform between a humanoid form and a beast form (bear, raptor, or bird). Worges have three forms: Bear (large/powerful), Raptor (stealthy/rogue-like), Large Bird (flyable). Also spelled "Worge" (not "Worg").

---

## Technical Terms

### BiomeSpawnRegistry
`client/src/game/systems/BiomeSpawnRegistry.ts` — Defines 9 biomes with weighted enemy tables, wildlife rosters, and env prop lists. Key functions:
- `getBiomeAtPosition(x, z)` — Returns the nearest biome for a world position
- `rollBiomeEnemy(x, z, isDaytime)` — Returns an appropriate enemy type
- `rollBiomeWildlife(x, z, count)` — Returns wildlife entry objects
- `getDifficultyAtPosition(x, z)` — Returns 1.0–3.5× multiplier by distance

### BuildingColliders
`client/src/game/components/BuildingColliders.tsx` — Generates Rapier cuboid physics bodies for all static world buildings. Exports `COLLISION_GROUPS` and `COLLISION_MASKS` used throughout the physics system.

### DistrictRegistry
`client/src/game/world/DistrictRegistry.ts` — Defines named neighbourhood districts on the home island. Used by WaveSpawner (enemy spawn gating), WorldMap (district icons), and ambient NPC placement.

### FactionHeroNPC
`client/src/game/npc/FactionHeroNPC.tsx` — R3F component rendering a single hero agent with hub-wander + field combat/harvest AI. Uses `useCharacterController` for GLB model + animations and a `useFrame` state machine for behaviour.

### getTerrainHeight
`client/src/game/components/Terrain.tsx` — Bilinear-interpolated world-space height sample. Called by every AI agent, wildlife, and resource node placement to snap to terrain.

### globalResourceRegistry
Module-level mutable `{ nodes: ResourceInstance[] }` in `ResourceNode.tsx`. Shared by all components that need to find or harvest resources. Not Zustand — reads/writes are direct array mutations for performance.

### HeroAIProfiles
`client/src/game/world/HeroAIProfiles.ts` — Defines 4 class-specific combat behaviour profiles (warrior/mage/ranger/worge) with engagement ranges, kiting flags, orbit speeds, special move timers, and berserker thresholds.

### ItemPrefabRegistry
`client/src/lib/data/ItemPrefabRegistry.ts` — Master registry of all equippable items (weapons + armor). Resolves CDN icon URLs, merges localStorage overrides, and provides lookup/search helpers.

### IslandLayout
`client/src/game/world/IslandLayout.ts` — Baked placement of all 17 world islands (image pixel → world coords). Single source of truth for the world map, minimap, and 3D island placeholder geometry.

### KinematicCharacterBody
`client/src/game/components/KinematicCharacterBody.tsx` — Thin wrapper over Rapier `RigidBody` + `CapsuleCollider` that reads position from a `positionRef` every frame and drives the physics body via `setNextKinematicTranslation`.

### MissionRegistry
`client/src/game/world/MissionRegistry.ts` — 72 missions (3 per hero × 24 heroes) in rotating pools. Each variant includes objectives, rewards, map marker offsets, and variant kind (kill/recover/resource).

### NatureScatter
`client/src/game/terrain/NatureScatter.tsx` — Instanced foliage scattering using `InstancedMesh` for 11 plant categories. Biome-filtered via `getBiomeAtPosition` so pines only appear in mountain/snow zones, flowers only in plains/coast, etc.

### PortRegistry
`client/src/game/world/PortRegistry.ts` — 6 ports with faction, world position, services (repair/resupply), NPC archetypes, and sailing grid destinations. Provides `getPortMapPins()` for world map ⚓ icons.

### TerrainHeightField
`client/src/game/components/TerrainHeightField.ts` — The authoritative 128×128 Float32Array for the home island terrain. Mutable in-place by the brush editor. All height reads go through `getTerrainHeight(x, z)`.

### useFactionHeroes
`client/src/lib/stores/useFactionHeroes.ts` — Zustand store for 24 hero world states. Tracks daily cycle, position, health, camp, kills, and player proximity for [T] interaction. Persists kill-flags to localStorage.

### useMissions
`client/src/lib/stores/useMissions.ts` — Zustand store for mission progress. Hero-keyed API: `acceptHeroMission`, `claimHeroReward`, `abandonHeroMission`, `checkAndRotate`. Spawns/removes world map markers on accept/claim. Persisted to localStorage.

### useSinkingIslands
`client/src/game/world/SinkingIslandSystem.ts` — Zustand store tracking per-island sink state (`stable/damaged/sinking/sunk/respawning`). Driven by `SinkingIslandTicker.tsx` (R3F `useFrame`). Auto-registers all boss-zone sinkable islands from `WorldIslandRegistry`.

### useWorldEvents
`client/src/lib/stores/useWorldEvents.ts` — Zustand store for active world events. Calls `tick()` every 60s (via FactionHeroes). StormEvent immediately sets `useGame.weather = "storm"`. FactionInvasion exposes `enemySpawnMult()` for WaveSpawner.

### useWorldMap
`client/src/lib/stores/useWorldMap.ts` — Zustand store for the [M] world map. Tracks: `waypoints`, `discoveredLocations`, `missionMarkers`. Provides `addMissionMarker`, `clearMissionMarkersForHero`.

### WaveSpawner
`client/src/game/components/WaveSpawner.tsx` — R3F `useFrame`-based enemy spawner. Uses `rollBiomeEnemy` for zone-appropriate enemies, `isEnemySpawnAllowed` to gate safe districts, `getDifficultyAtPosition` for interval scaling, and `useWorldEvents.enemySpawnMult` for event pressure.

### WorldObjectRegistry
`client/src/game/world/WorldObjectRegistry.ts` — 34 placed world buildings with unified visual + collision data. Single source of truth replacing parallel lists in `World.tsx` and `BuildingColliders.tsx`.

### WorldZoneRegistry
`client/src/game/world/WorldZoneRegistry.ts` — 5 zone definitions with biome metadata, fog params, asset paths, fallback modes, and enemy spawn permissions. Also exports `ZONE_WORLD_BOUNDS` AABBs for world-map overlay rendering.

---

## Character Stats

| Stat | Code Key | Description |
|---|---|---|
| Strength | `strength` | Melee damage, health, defense, block |
| Vitality | `vitality` | Health pool, defense, resistance |
| Endurance | `endurance` | Defense, block, resistance |
| Intellect | `intellect` | Spell damage, mana, accuracy |
| Wisdom | `wisdom` | Mana efficiency, healing power |
| Dexterity | `dexterity` | Physical damage, accuracy, crit |
| Agility | `agility` | Movement speed, dodge, crit |
| Tactics | `tactics` | Global stat multiplier (+0.5%/pt on non-resources) |

---

## Item Rarity Colours

| Rarity | Hex | Glow |
|---|---|---|
| Common | `#8b7355` | none |
| Uncommon | `#a8a8a8` | 4px silver |
| Rare | `#4a9eff` | 6px blue |
| Epic | `#9d4dff` | 8px purple |
| Legendary | `#ff4d4d` | 10px red |
| Mythic | `#ffaa00` | 12px gold |
| Ancient | `#d4a84b` | 14px amber |
| Artifact | `#f0d890` | 16px light gold |
