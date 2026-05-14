---
title: Cast moving warm light shadows from temple chandeliers
---
# Cast moving warm light shadows from temple chandeliers

  ## What & Why
  Temple chandeliers now sway and emit warm point light, but the lights do not cast shadows. Enabling shadow casting (with carefully-tuned shadow map size and bias) on a few hero chandeliers would dramatically improve atmosphere as the swaying light moves shadows across the dungeon walls and floor.

  ## Done looks like
  - A small number of hero chandeliers cast soft, dynamic shadows that visibly sway with the chandelier
  - Shadow map sizes and bias are tuned to avoid acne or perf hits
  - Frame time stays acceptable on mid-range hardware

  ## Relevant files
  - `client/src/game/dungeon/DungeonScene.tsx` (TempleChandelier, DungeonCeilingProps)