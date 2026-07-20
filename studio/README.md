# Grudge Studio — Map & Model Editor

> Live: [grudge-studio-editor.vercel.app](https://grudge-studio-editor.vercel.app/editor)  
> Package: `@grudge-studio/forge-editor`

Procedural island map editor and third-person play mode (React Three Fiber).

## Quick start

```bash
cd studio
npm install
npm run dev        # Vite on 0.0.0.0
npm run build
npm run typecheck
```

## Ocean vertical datum (Y axis)

| Constant | Y | Meaning |
|---|---|---|
| `SEA_LEVEL` | **0** | Water surface (authoritative) |
| `COAST_SUBMERGE` | **-1** | Land always dips underwater before open sea |
| `SHELF_DEPTH` | **-5** | Seafloor outside the island circle |
| `OCEAN_FLOOR_DEEP` | **-50** | Deepest trenches |

Land and seafloor share **one continuous heightmap** so submersion, swimming, and fish pathfinding sample the same mesh. See `src/editor/IslandGenerator.ts`.

### Fish bands

| Size | Region | Y band |
|---|---|---|
| Small | Near rim / shelf | **−1 … −5** |
| Big | Past island circle | **−2 … −10** |

Spawn Y is seafloor-cleared via `clampSwimY`. Swim AI re-samples terrain every frame (`groundAt`) so fish never clip the mesh.

### Nav waypoints

Island seed places **land** and **underwater** nav nodes (`layer: land | small | big`). Land animals only path on dry waypoints.

## Play mode controls

| Input | Land | Water | Climb |
|---|---|---|---|
| WASD | Move | Swim | Up / down / shimmy |
| Shift | Sprint | Faster stroke | — |
| **Space** | Mount wall | Swim **up** | Climb **up** |
| **Alt** | — | **Dive** | Climb **down** / drop |
| RMB + drag | Camera orbit | same | same |

### Locomotion clips

Local FBX under `public/assets/animations/`:

- **Swim:** `swim/swimming.fbx`, `treading_water.fbx`, `swimming_to_edge.fbx`
- **Climb:** `climb/climbing.fbx` (+ idle / topout copies; `climb_down` plays reversed)

`ObjectStoreClient` loads `assets/…` from Vite public without going through ObjectStore.

## Key modules

| Path | Role |
|---|---|
| `src/editor/IslandGenerator.ts` | Seeded island + ocean heightmap + fish + nav |
| `src/editor/terrain-utils.ts` | Brush sculpt; clamps to `[-50, MAX_TERRAIN]` |
| `src/runtime/Player.tsx` | Land / swim / climb controller |
| `src/runtime/PlayerCharacter.tsx` | Clip mixer + reverse climb_down |
| `src/runtime/ai.ts` | Creature AI; depth-band swim; shark hunt fish |
| `src/runtime/islandNavGraph.ts` | Layered nav graph |
| `src/runtime/Effects.tsx` | Water plane at `SEA_LEVEL` |
| `src/library/PlayerCharacterRegistry.ts` | Race + hero clip maps (swim/climb) |

## Deploy

Linked Vercel project: **grudge-studio-editor**

```bash
cd studio
vercel --prod
# or push main if the project is git-connected
```

After deploy, **reseed** the island in the editor to regenerate terrain with the new ocean depths.
