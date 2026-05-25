# `split_fbx_to_glb.mjs` — generic FBX-to-GLB splitter

A reusable CLI for importing multi-mesh FBX packs (weapon packs, prop packs,
siege kits, etc.) exported from Blender. It loads the FBX with three's
`FBXLoader`, walks the named meshes / groups, optionally rotates and
recenters each one, and writes one GLB per selected mesh via
`GLTFExporter`.

This is the generalised version of the original one-off
`extract_medieval_pack.mjs` script. New packs should use **this** CLI
instead of copy-pasting that script — the medieval-pack version is kept
in the repo as a frozen record of the configuration that produced
`client/public/models/weapon_pack/Medieval_*.glb` and friends.

## Usage

```bash
node script/asset_tools/split_fbx_to_glb.mjs <input.fbx> <output_dir> [options]
```

### Positional arguments

- `<input.fbx>` — path to the source FBX (relative or absolute).
- `<output_dir>` — directory the GLBs are written to (created if missing).
  Required unless `--list` is passed.

### Options

| Flag                           | Description                                                                                                                                                       |
|--------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--list`                       | Print every named node in the FBX and exit. No extraction.                                                                                                        |
| `--include <patterns>`         | Comma-separated mesh names (or simple `*` globs) to include. If omitted, every top-level child of the FBX root that contains geometry is exported.                |
| `--exclude <patterns>`         | Comma-separated names/globs to skip even if they match `--include`.                                                                                               |
| `--rename <old=new,...>`       | Rename mapping for output basenames. `old` matches the FBX node name (no glob), `new` is used as the output filename without `.glb`.                              |
| `--rotate <name=rx,ry,rz;...>` | Per-mesh Euler XYZ rotation in **radians** applied to the cloned mesh **before** the recenter step. Use `;` between entries.                                      |
| `--no-recenter`                | Skip the bounding-box recenter step. By default each exported mesh has its origin moved to the centre of its world AABB so the runtime loader's grip-bias works. |
| `--quiet`                      | Suppress per-mesh progress lines; only print the final summary.                                                                                                  |
| `--help`, `-h`                 | Print usage and exit.                                                                                                                                            |

The script exits with code `1` if any selected mesh failed to export, or
if no meshes matched the filters.

## Recommended workflow for a new pack

1. **Inspect the FBX** to learn what's inside:

   ```bash
   node script/asset_tools/split_fbx_to_glb.mjs attached_assets/new_pack.fbx --list
   ```

2. **Pick the meshes you want**. Build an `--include` list (and an
   `--exclude` list for sub-meshes / siege props you want to skip).

3. **First extraction pass — no rotations.** Export everything you
   want into a target directory:

   ```bash
   node script/asset_tools/split_fbx_to_glb.mjs \
     attached_assets/new_pack.fbx \
     client/public/models/new_pack \
     --include "Sword*,Bow*,Spear*" \
     --exclude "*_Holder*,*_Stand*"
   ```

4. **Measure bounding boxes** to find any meshes whose long axis is not
   `+Y`. The sister utility `measure_weapon_glbs.mjs` is the existing
   reference (it compares against KayKit weapons), or write a small
   one-off measure script for non-weapon packs:

   ```bash
   node script/asset_tools/measure_weapon_glbs.mjs
   ```

5. **Add `--rotate` entries** for any mesh whose long axis came out
   along `+X` or `+Z`, then re-run step 3. The convention used by the
   existing `WEAPON_PACK_WEAPONS` registry is **+Y up, handle at -Y,
   blade/head/string at +Y, thin axis along Z** — `rotateX(-π/2)` (i.e.
   `--rotate "Name=-1.5708,0,0"`) brings a `+Z`-long mesh into that
   convention. See `MEDIEVAL_PACK_IMPORT.md` § "Per-weapon orientation"
   for a worked example.

6. **Register the GLBs** in
   `client/src/game/systems/ModelRegistry.ts` (for equippable items)
   and / or `client/src/lib/data/NewAssetRegistry.ts` (for the asset
   browser), then iterate on `sizeBias` / `offHandGripLocal` as needed
   without re-running the extractor.

## Examples

```bash
# 1. Inspect what's inside a new pack:
node script/asset_tools/split_fbx_to_glb.mjs pack.fbx --list

# 2. Export every top-level mesh with geometry:
node script/asset_tools/split_fbx_to_glb.mjs pack.fbx ./out

# 3. Re-create the medieval pack output (equivalent to the frozen
#    extract_medieval_pack.mjs script):
node script/asset_tools/split_fbx_to_glb.mjs \
  attached_assets/mEDİAVEL_pACK_1777004586593.fbx \
  client/public/models/weapon_pack \
  --include "Sword001,Slam_Hammer001,Bow001,One_Side_Axe001,Double_Side_Axe001,Spiked_Maze001,Maze002,Spear001,Spear_With_Knife001,Dagger002,Dagger003,Shield_1001,Shield_2001,Shield_3001,Arrow001,Arrow_Bag001,Stick001" \
  --rename "Sword001=Medieval_Sword,Slam_Hammer001=Slam_Hammer,Bow001=Medieval_Bow,One_Side_Axe001=One_Side_Axe,Double_Side_Axe001=Double_Side_Axe,Spiked_Maze001=Spiked_Mace,Maze002=Medieval_Mace,Spear001=Medieval_Spear,Spear_With_Knife001=Spear_With_Knife,Dagger002=Medieval_Dagger_A,Dagger003=Medieval_Dagger_B,Shield_1001=Medieval_Shield_1,Shield_2001=Medieval_Shield_2,Shield_3001=Medieval_Shield_3,Arrow001=Medieval_Arrow,Arrow_Bag001=Arrow_Bag,Stick001=Quarterstaff" \
  --rotate "Slam_Hammer001=-1.5708,0,0;Spiked_Maze001=-1.5708,0,0;Spear001=-1.5708,0,0;Double_Side_Axe001=-1.5708,0,0;Dagger002=-1.5708,0,0;Dagger003=-1.5708,0,0;Shield_1001=-1.5708,0,0;Arrow001=-1.5708,0,0"
```

## Notes & limitations

- Only **named** nodes are considered. Unnamed sub-meshes are exported as
  part of their named ancestor's GLB but cannot be selected individually.
- `--include` / `--exclude` use exact-match by default. The only glob
  metacharacter supported is `*` (any number of any characters).
  Patterns are case-sensitive.
- Rotations are **Euler XYZ in radians**, applied to the cloned mesh
  before the recenter step. If you need degrees, do the conversion
  yourself (`degrees * Math.PI / 180`).
- Materials are exported as-is. The exporter logs
  `GLTFExporter: Use MeshStandardMaterial or MeshBasicMaterial for best results.`
  for FBX-imported `MeshPhongMaterial` instances; this is informational
  and does not affect the runtime — the runtime's `WeaponModelLoader`
  re-materialises everything anyway.
