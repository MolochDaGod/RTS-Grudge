# Missing CDN keys — keep `purpose=skip`

Live `asset_registry` rows with `body_status=missing` (2026-09-16 HEAD of `assets.grudge-studio.com`).

**Do not invent sizes, Meshy fish, or a second fauna table.** Re-seed scripts must call `classifyAsset()` so these stay `skip` until a real file is converted (`grudge-asset-convert`) and uploaded to the **same** R2 key.

| Prefix | Count (approx) | Disk |
|--------|----------------|------|
| `icons/fauna/ocean/*.png` | 55 | not on disk |
| `models/fauna/ocean/*.{glb,fbx}` | 55 | not on disk |
| `models/fauna/fish/cute/*.fbx` | 25 | not on disk |
| `models/fauna/fish/sketchfab/*.glb` | 11 | not on disk |
| `models/voxels/tvs/voxel-knights/misc/voxel-knights-horse.glb` | 1 | not on disk |

`D:\Games\Models\free-fishing-pack-extracted` is **2D pixel** catch sprites — not these 3D keys. Do not remap.

ObjectStore prefix rows that are not files (`defs/faction-city/human|elf|undead`) are deleted from `assets` (not objects).
