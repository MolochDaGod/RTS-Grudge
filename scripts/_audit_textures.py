"""One-shot helper to locate fallback textures referenced in the RTS-Grudge
client code. Walks a small set of roots and reports any file whose name
matches a target stem (case-insensitive). Used by the Tactical-Infinity
audit pass; safe to delete after the audit."""

import os
import sys

# Targets pulled from grep over client/src + VFX_TEXTURES map.
TARGETS = [
    "grass_detailed", "glow_point2_purple", "Sparkle_Ink_001", "Color_Ring_002",
    "M_Sand_diffuse", "FlameDecal04", "decal_fire10", "Fx_Glow_004",
    "Radial_Glow", "Soft_Circle_Pulse", "Spark_Blur", "hit_02", "slash03",
    "dust54", "star_06", "lightning01", "trail_CPdr", "Gradient_Beam",
    "Flow_001", "Noise_02", "flare08", "glow_ball2", "Aura_Flame",
    "Default-Particle", "Sheet_purple", "FX_smoke", "DungeonRingGuid",
    "noise_03",
]
ROOTS = [
    "attached_assets",
    "_extract",
    "Tactical-Infinity",
    "client/public",
    "dist/public",
]
SKIP_DIR_PARTS = {"node_modules", ".git"}


def main() -> int:
    found: dict[str, list[str]] = {t: [] for t in TARGETS}
    targets_lc = [(t, t.lower()) for t in TARGETS]
    for root in ROOTS:
        if not os.path.isdir(root):
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIR_PARTS]
            for f in filenames:
                fl = f.lower()
                for tgt, tgt_lc in targets_lc:
                    if tgt_lc in fl:
                        found[tgt].append(os.path.join(dirpath, f))
                        break
    for tgt in TARGETS:
        hits = found[tgt]
        print(f"{tgt:24s} {len(hits):3d}  " + (hits[0] if hits else "(none)"))
        for extra in hits[1:3]:
            print(" " * 29 + extra)
    return 0


if __name__ == "__main__":
    sys.exit(main())
