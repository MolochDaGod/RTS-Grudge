# `script/asset_tools/`

Helpers for ingesting and verifying static / weapon assets that ship with
this project. Most of these are one-shot pipeline scripts you run after
adding or changing a source asset, not anything the runtime imports.

## Canonical (production) scripts

These are the scripts you'd re-run as part of a normal asset pipeline
re-import. Keep them maintained.

| Script                              | Purpose                                                                                                                                                                                                |
|-------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `extract_medieval_pack.mjs`         | Loads `attached_assets/mEDİAVEL_pACK_*.fbx`, applies the per-weapon orientation rotations described in `MEDIEVAL_PACK_IMPORT.md`, recenters each weapon on its bbox, and exports one GLB per weapon to `client/public/models/weapon_pack/`. Re-run whenever the FBX or the rotation table changes. |
| `measure_weapon_glbs.mjs`           | Prints the bounding box of every extracted weapon GLB. Use to confirm the long axis ended up along Y (per the +Y-up convention), and as a baseline for sanity-checking re-extracts.                                                                                       |
| `measure_shields_and_arrows.mjs`    | Specialised bbox / orientation report for shields and arrows / quivers, where the long-axis convention is more flexible than for melee weapons.                                                                                                  |
| `MEDIEVAL_PACK_IMPORT.md`           | Authoritative documentation for the medieval pack import: per-weapon orientation table (incl. head-end direction), rationale for the rotation choices, and the re-tuning workflow.                                                                                  |

## Verification / diagnostics

Used during a one-off orientation audit (Task #33) to confirm every
medieval weapon has its head pointing +Y after extraction. Safe to keep,
re-run on demand, but they aren't part of any scheduled pipeline.

| Script                                 | What it does                                                                                                                                                                                                                                                          |
|----------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `_centroid_y.mjs`                      | Reports the area-weighted Y-centroid of every weapon GLB, normalised to bbox half-height. Strongly negative ⇒ heavy mass at -Y ("head" likely upside-down); strongly positive ⇒ at +Y; \|value\| < 0.05 ⇒ symmetric.                                                                                                |
| `render_weapon_orientations.mjs`       | Headless-renders each weapon GLB to a 2D PNG silhouette using `three`'s `GLTFLoader` + `sharp` (no WebGL needed). Outputs one PNG per weapon plus a mosaic in `/tmp/weapon_orientations/`. The screenshot environment can't create a WebGL context, so this offline path is the way to visually confirm orientations. |
| `profile_weapon_glbs.mjs`              | Prints an ASCII silhouette of each weapon, picking the wider of {X, Z} as horizontal. Cheap text-only equivalent of `render_weapon_orientations.mjs`.                                                                                                                                            |
| `analyze_weapon_head_orientation.mjs`  | Older head-detection heuristic based on triangle-area distribution along Y. Superseded by `_centroid_y.mjs`; kept for cross-checking.                                                                                                                                  |

## Internal / temporary

Scripts prefixed with `_` are scratch / debug helpers — their output
format isn't stable, they may have been written for a single
investigation, and they may be deleted in a later cleanup pass once the
relevant asset workflow has stabilised.

| Script                          | What it does                                                                                                                                                                                                                                |
|---------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `_inspect_glb.mjs`              | Dumps bbox + per-mesh transforms / vertex counts for a single GLB.                                                                                                                                                                          |
| `_debug_glb_rotation.mjs`       | Prints the scene tree (with per-node `position`/`rotation`/`scale`) and the world-space bbox of a single GLB. Used to verify that an Euler rotation set in `extract_medieval_pack.mjs` actually made it into the saved file. |

## Required dependencies

These scripts run under Node and rely on `tsx`-friendly ESM imports. The
runtime project already depends on `three`; `sharp` (used by
`render_weapon_orientations.mjs`) is in `devDependencies` and is
installed alongside the rest of the toolchain by `npm install`.

```bash
node script/asset_tools/extract_medieval_pack.mjs
node script/asset_tools/measure_weapon_glbs.mjs
node script/asset_tools/_centroid_y.mjs
node script/asset_tools/render_weapon_orientations.mjs
```
