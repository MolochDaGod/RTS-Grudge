# Decisions for the two extra FBX uploads (Task #23)

Two FBX files were uploaded alongside the GLocomotion animation pack and were
not part of the 18-animation scaffolding. After inspecting them and confirming
intent with the user, this is the decision trail.

## 1. `attached_assets/player_vektor_1777004586595.fbx`

**Classification:** Rigged playable character (Blender export from
`playerfps.blend`).

- Armature: `VektorHeroRig`
- Meshes: `body`, `body.001`, `armor_vektor`, `armor_vektor.001`, `helmet_vektor`
- Skeleton: Blender Rigify naming
  (`spine`, `spine.001`…`spine.006`, `shoulder.L/R`, `upper_arm.L/R`,
  `forearm.L/R`, `hand.L/R`, `thigh.L/R`, …) — **not** Mixamo, so combat
  animations would require a Rigify→Mixamo skeleton-alias map before this
  character could play any of the existing animation packs.

**User decision:** Discard. Not needed in the game.

**Action taken:** No registration. The FBX file remains in `attached_assets/`
as the original user upload, but is intentionally **not** referenced from
`ALL_CHARACTER_MODELS`, `WEAPON_PACK_WEAPONS`, `NewAssetRegistry`, or any
loader. If it is ever revisited, it would need to be added to
`client/src/game/systems/ModelRegistry.ts` (`ALL_CHARACTER_MODELS`) with a
validated `defaultScale` / `defaultHeight`, plus matching skeleton aliases in
`client/src/game/systems/BoneAliases.ts`.

## 2. `attached_assets/mEDİAVEL_pACK_1777004586593.fbx`

**Classification:** Static medieval pack (no armature) that mixes wieldable
weapons with siege props in a single FBX.

- Wieldable weapons (15): Sword, One-Side Axe, Double-Side Axe, Slam Hammer,
  Spiked Mace, Mace, Spear, Spear With Knife, two Daggers, Bow, Quarterstaff,
  three Shields (round, kite, heater).
- Ammo / accessory (2): Arrow, Arrow Bag (quiver).
- Siege props / scenery (skipped): Catapult, Cannon, three Barrels, two Flags,
  Bucket, Board, Training Dummy, Weapon Holder, plus the generic
  Cube/Cylinder/Sphere/Plane sub-meshes that are sub-parts of those props.

**User decision:** Register only the wieldable weapons in
`WEAPON_PACK_WEAPONS`. Siege props are intentionally **not** included here —
they will be handled separately as part of the RTS siege-AI work.

**Action taken:**

1. Ran `node script/asset_tools/extract_medieval_pack.mjs`. The script loads
   the FBX with three's `FBXLoader`, applies a per-weapon orientation rotation
   so the long axis ends up along +Y (see *Per-weapon orientation* below),
   recenters each selected mesh on its bounding box, and exports it as an
   individual `.glb` into `client/public/models/weapon_pack/`.
2. Registered the 15 wieldable weapons in
   `client/src/game/systems/ModelRegistry.ts` → `WEAPON_PACK_WEAPONS`
   (entry IDs `wp_med_*`). Maces use `weaponType: "hammer"` because the
   `WeaponType` union does not include `"mace"`. The quarterstaff uses
   `"poleaxe"` because it is the closest 2H melee polearm in the union.
3. Registered all 17 GLBs (the 15 weapons **plus** `wp_med_arrow` and
   `wp_med_arrow_bag`) in
   `client/src/lib/data/NewAssetRegistry.ts` → `WEAPON_PACK`. Arrow and
   quiver are listed in the asset browser only — they are deliberately
   omitted from `WEAPON_PACK_WEAPONS` because they are ammo / accessory props,
   not equippable weapons, and there is no matching `WeaponType` for them.
   Arrows are normally consumed by the bow's projectile system (see existing
   `wp_blunt_arrow`, `wp_broadhead_arrow`, `wp_piercing_arrow`, which follow
   the same pattern of being asset-registry-only). `wp_med_arrow` and
   `wp_med_arrow_bag` were subsequently wired into the runtime in Task #27 —
   `Medieval_Arrow.glb` is now a selectable mesh for `ArrowProjectile` (via
   `arrowModelId` on `CharacterConfig` + `ARROW_MODELS` in `ModelRegistry.ts`)
   and `Arrow_Bag.glb` is attachable to the back socket
   (`backAccessoryId` + `BACK_ACCESSORIES`). The character editor exposes
   pickers for both.

## Re-running the import

```bash
node script/asset_tools/extract_medieval_pack.mjs    # extracts the GLBs
node script/asset_tools/measure_weapon_glbs.mjs      # prints bounding boxes
```

The medieval-pack script above is the original one-off importer and is kept
as a frozen record of this exact pack's configuration. **Future FBX packs
should not copy it.** Use the generalised CLI instead — see
`SPLIT_FBX_TO_GLB.md`. The same medieval pack output can be recreated with
the generic CLI invocation in that README's *Examples* section.

## Per-weapon orientation (Task #26)

After the first extract pass it became clear the medieval pack ships with
**mixed mesh axes** — about half the weapons have their long axis along the
local +Y (matching KayKit / the existing `WEAPON_PACK_WEAPONS`), and the other
half lie along the local +Z. Running them through the runtime weapon loader
unchanged would scale the weapons by their *short* axis (Y) and inflate the
real long axis by 5–60×, producing 16-meter spears and 3-meter maces that
visually point sideways out of the wrist.

To keep the runtime registry / `OFF_HAND_GRIP_LOCAL` defaults usable as-is,
the extract script (`extract_medieval_pack.mjs`) now applies a per-weapon
`rotation` (Euler XYZ in radians) to each clone *before* the recenter step.
The chosen convention is **+Y up, handle at -Y, blade/head/string at +Y, thin
axis along Z**, identical to KayKit weapons.

Detected long-axis after the no-rotation pass (via
`measure_weapon_glbs.mjs`), and the head-end direction after the rotation
pass (via `_centroid_y.mjs` + `render_weapon_orientations.mjs`):

| File                     | Long axis | Action                                      | Head-end after rotation |
|--------------------------|-----------|---------------------------------------------|-------------------------|
| Medieval_Sword           | Y         | none                                        | +Y (already correct)    |
| One_Side_Axe             | Y         | none                                        | +Y                      |
| Double_Side_Axe          | **Z**     | `rotateX(+PI/2)` (was -PI/2; head was at -Y)| +Y (Task #33 flip)      |
| Slam_Hammer              | **Z**     | `rotateX(+PI/2)` (was -PI/2; head was at -Y)| +Y (Task #33 flip)      |
| Spiked_Mace              | **Z**     | `rotateX(+PI/2)` (was -PI/2; head was at -Y)| +Y (Task #33 flip)      |
| Medieval_Mace            | Y         | none                                        | +Y                      |
| Medieval_Spear           | **Z**     | `rotateX(-PI/2)`                            | +Y                      |
| Spear_With_Knife         | Y         | none                                        | +Y                      |
| Medieval_Dagger_A        | **Z**     | `rotateX(-PI/2)`                            | symmetric (no head end) |
| Medieval_Dagger_B        | **Z**     | `rotateX(-PI/2)`                            | symmetric (no head end) |
| Medieval_Bow             | **X**     | none — bow convention is X-long             | n/a (X-long)            |
| Quarterstaff             | Y         | none                                        | symmetric (staff)       |
| Medieval_Shield_1        | **Z**     | `rotateX(-PI/2)`                            | +Y (boss/cross-arms up) |
| Medieval_Shield_2        | Y         | none                                        | symmetric (face)        |
| Medieval_Shield_3        | Y         | none                                        | symmetric (face)        |
| Medieval_Arrow           | **Z**     | `rotateX(-PI/2)`                            | +Y (head up, fletch -Y) |
| Arrow_Bag                | Y         | none                                        | n/a (quiver)            |

After this pass every wieldable weapon is Y-long with its head pointing
+Y, and the existing `offHandGripLocal` values in `ModelRegistry.ts` (which
are all expressed in the +Y-down handle convention) line up with the actual
geometry — so e.g. `wp_med_spear` reuses `[0, -0.45, 0]` (the same value as
`wp_spear`) instead of needing its own per-axis rewrite.

The medieval bow is intentionally left in its X-long orientation because
`WEAPON_SPECIFIC_OFFSETS.bow.rotAdj = [0, PI/2, 0]` in
`client/src/game/systems/BoneAliases.ts` already rotates X-long bows into
the correct grip pose at attach time — matching how `wp_bow` and the KayKit
`bow_A` are oriented.

**Re-tuning a weapon:** edit the `rotation` field on its `WEAPON_TARGETS`
entry in `extract_medieval_pack.mjs`, re-run the extract + measure scripts,
and (if the resulting +Y end is the wrong end of the weapon — e.g. tip ends
up downward) flip the *sign* of the X rotation (use the `ROT_Z_TO_Y_FLIP`
constant which is `[+PI/2, 0, 0]`). Note that `[-PI/2, 0, PI]` does **not**
flip the head — see the explanatory block-comment above
`ROT_Z_TO_Y_FLIP` in `extract_medieval_pack.mjs` for the math. The runtime
loader still respects per-entry `sizeBias` and `offHandGripLocal` overrides
in `ModelRegistry.ts` for any fine-tuning that should not be baked into
the GLB.

**Verifying head orientation:** run

```bash
node script/asset_tools/_centroid_y.mjs               # area-weighted Y centroid
node script/asset_tools/render_weapon_orientations.mjs # PNG silhouettes per weapon
```

The first prints the per-weapon centroid bias (positive → head at +Y,
negative → head at -Y, |value| < 0.05 → symmetric). The second writes one
silhouette PNG per weapon to `/tmp/weapon_orientations/` plus a mosaic so
the head end can be confirmed visually.
