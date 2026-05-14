# Modular Dungeon System

## What & Why
The current dungeon system generates layouts with BSP but renders them as plain colored boxes for floors and walls. It should use the modular 3D dungeon pieces already in the project (KayKit dungeon kit: ~80 pieces, Quaternius dungeon kit: ~40 pieces) to build visually rich dungeons with proper 3D walls, floors, doorways, decorations, and atmospheric props — similar to the Sketchfab "Modular Dungeon" reference.

## Done looks like
- Dungeons are visually composed of modular 3D pieces: stone floor tiles, wall segments, wall corners, doorway arches, columns/pillars, stairs, and decorations (torches, chests, barrels, bookshelves, potions, etc.)
- DungeonGenerator produces a tile-based layout where each cell has a type (floor, wall, door, corner, etc.) and the renderer places the matching 3D piece from the KayKit/Quaternius dungeon collections
- Walls automatically connect with corners and intersections using wallCorner, wallIntersection, wallSplit pieces
- Rooms have themed decoration placement (treasure rooms get chests/coins, libraries get bookcases, shrines get artifacts/candles)
- Corridors use floor tiles with wall segments on both sides and torch placement at intervals
- Dungeon entrance/exit portals use the Entrance.glb models from the Quaternius set
- Physics colliders on floor and wall pieces for player/enemy collision
- Multiple visual themes using different piece combinations (crypt = dark stone, mine = wooden scaffolds, temple = decorated walls)
- Existing dungeon gameplay (enemy spawning, navigation, exit portal interaction) continues to work

## Out of scope
- New dungeon gameplay mechanics (traps, puzzles, etc.)
- Procedural dungeon algorithms beyond the existing BSP approach
- New enemy types specific to dungeons

## Tasks
1. **Create a modular piece registry** — Define a mapping of logical piece types (floor, wall, wall_corner, wall_door, wall_window, pillar, stairs, torch, chest, etc.) to their GLB model paths from dungeon_kaykit/ and dungeon_quaternius/. Include rotation/offset metadata per piece.
2. **Rebuild DungeonGenerator for tile-based output** — Refactor the generator to output a grid of typed cells (empty, floor, wall_n, wall_s, wall_e, wall_w, corner_ne, corner_nw, door_n, etc.) rather than just coordinate arrays. Wall orientation must be computed from adjacency.
3. **Rebuild DungeonScene rendering** — Replace the colored-box floor/wall rendering with modular piece placement. Each cell in the grid instantiates the correct GLB piece at the correct position and rotation. Use instancing where possible for repeated pieces (floors, walls).
4. **Decoration placement system** — Place themed decorations in rooms based on room type. Torches along corridors at regular intervals. Treasure rooms get chests and coin piles. Libraries get bookcases. Shrines get artifacts and candles.
5. **Theme system** — Define 3 dungeon themes (crypt, mine, temple) that select different piece variants and lighting/fog colors.
6. **Physics colliders** — Add Rapier fixed-body colliders to wall and floor pieces for proper collision.
7. **Verify dungeon gameplay** — Ensure enemies spawn, player can navigate, exit portal works, combat functions in the new modular dungeon environment.

## Relevant files
- `client/src/game/dungeon/DungeonScene.tsx`
- `client/src/game/dungeon/DungeonGenerator.ts`
- `client/src/game/dungeon/DungeonAssetMap.ts`
- `client/src/game/dungeon/DungeonNavigation.ts`
- `client/src/game/dungeon/DungeonEntrances.tsx`
- `client/public/models/dungeon_kaykit/`
- `client/public/models/dungeon_quaternius/`
- `client/public/models/dungeon_modular/`
- `client/public/models/dungeon/`
