import { preloadAssets, isAssetCached } from "../systems/AssetLoader";
import { ANIM_COMBAT_FILES, ANIM_SPECIAL_FILES } from "./animFiles";

const INTRO_ANIM_PATHS: readonly string[] = Array.from(
  new Set([
    ...ANIM_COMBAT_FILES.map((e) => e.file),
    ...ANIM_SPECIAL_FILES.map((e) => e.file),
  ]),
);

let kicked = false;

export function kickoffIntroAnimPreload(): void {
  if (kicked) return;
  kicked = true;
  const missing = INTRO_ANIM_PATHS.filter((p) => !isAssetCached(p));
  if (missing.length === 0) return;
  preloadAssets(missing, "high").catch(() => {
  });
}

export function isIntroAnimWarm(): boolean {
  return INTRO_ANIM_PATHS.every(isAssetCached);
}

export function introAnimWarmCount(): { ready: number; total: number } {
  const total = INTRO_ANIM_PATHS.length;
  let ready = 0;
  for (const p of INTRO_ANIM_PATHS) {
    if (isAssetCached(p)) ready++;
  }
  return { ready, total };
}
