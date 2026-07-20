# Scale, ocean depth, and weapon-skill SSOT

**Date:** 2026-07-20

## Character height

- Canonical humanoid / ORC height: **2.0 m** (`CHARACTER_HEIGHT_M`).
- `shared/physics/colliders.ts` — player capsule default height 2.0 m.
- `client/src/game/systems/BoundsUtils.ts` — `normalizeCharacterHeight` default 2.0 m.
- Hero Forge preview uses **2.0 × scale** (was 1.8 — fixed preview/world desync).

## Ocean

- Water surface **y = 0** at coast.
- Deepest open-ocean floor: **`OCEAN_FLOOR = -30` m** (`ZoneHeightmapSystem`).
- Near-shore shelf still **−5 m**; zone edge interpolates to −30 m.
- Ocean-floor prop scatter defaults deeper on open-ocean biomes (volcanic/abyssal ~30 m).

## Weapon skills (HUD)

- `useHotbar.resolveWeaponSkills` / `resolveHeldItemSkills` ignore slots from a **different** weapon type.
- HUD subscribes to `equipped.mainHand.weaponType` so Q skills refresh on equip swap.

## Related

- Warlord Genesis grudge6: `GRUDGE6_TARGET_HEIGHT_M = 2.0`.
- VoxGrudge: normalize fallback 2.0 m.
