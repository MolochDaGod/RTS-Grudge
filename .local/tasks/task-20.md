---
title: Fade scattered props in and out instead of popping at the cull edge
---
# Fade scattered props in and out instead of popping at the cull edge

## What & Why
The new distance cull in IslandScatter snaps props on/off when the camera crosses the radius. The default radius (≈0.6 × world size) is far enough off-screen that this is rarely visible, but if a designer tightens the radius for performance or zooms the camera out, instances will pop in and out abruptly. A short hysteresis band plus per-instance opacity fade (or a scale ramp over a few tenths of a second) would let us pull the radius in further without visible artifacts, freeing up more frame time on dense biomes.

## Done looks like
- Props near the draw cull radius fade in/out instead of popping
- Cull radius can be reduced without visible scatter pop

## Relevant files
- `client/src/game/world/IslandScatter.tsx` (InstancedScatterPool repartition / shader override)