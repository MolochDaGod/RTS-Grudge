---
title: Show a translate/rotate gizmo in-game when tuning weapons
---
# Show a translate/rotate gizmo in-game when tuning weapons

  ## What & Why
  The character-select editor uses a TransformControls gizmo on the weapon mesh
  for direct manipulation, which is far faster than sliders. The new in-game
  tuner only exposes sliders. Bringing the gizmo into the live game scene would
  let authors drag the weapon directly while it animates, catching grip issues
  that are hard to spot statically.

  ## Done looks like
  - While the tuner panel is open, a TransformControls gizmo attaches to the
    player's equipped weapon and updates selectedCharacter.weaponOffset live.
  - A mode toggle (translate / rotate / scale / off) is exposed in the panel.
  - Player movement / camera input is suppressed while dragging the gizmo.

  ## Relevant files
  - `client/src/game/WeaponOffsetTuner.tsx`
  - `client/src/game/CharacterSelectScreen.tsx` (WeaponGizmo reference)
  - `client/src/game/components/Player.tsx` (rightHand / leftHand bone refs)