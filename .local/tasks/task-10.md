---
title: Add subtle creaking rope sound near hanging dungeon decor
---
# Add subtle creaking rope sound near hanging dungeon decor

  ## What & Why
  The new swaying chandeliers, mine planks, and crypt cobwebs add visual life. A faint, distance-attenuated creak/rope sound near a few of them would push the "lived-in dungeon" feeling further without being annoying.

  ## Done looks like
  - A low-volume, looping creak sound plays near a small subset of swaying ceiling props
  - Sound attenuates with distance from the player and does not stack/overlap loudly
  - Mute/volume settings respect the existing audio system

  ## Relevant files
  - `client/src/game/dungeon/DungeonScene.tsx` (DungeonCeilingProps)
  - existing audio/sfx system used elsewhere in client/src/game