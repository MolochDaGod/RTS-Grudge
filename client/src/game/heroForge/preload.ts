import { preloadAssets, isAssetCached } from "../systems/AssetLoader";

export const HERO_FORGE_MODEL_PATHS: readonly string[] = [
  "/models/characters/elf-male.glb",
  "/models/characters/elf-female.glb",
  "/models/characters/assassin-male.glb",
  "/models/characters/assassin-female.glb",
  "/models/characters/orc_scout-male.glb",
  "/models/characters/orc_scout-female.glb",
  "/models/characters/vampire_aristocrat-male.glb",
  "/models/characters/vampire_aristocrat-female.glb",
  "/models/characters/dwarf-male.glb",
  "/models/characters/dwarf-female.glb",
  "/models/characters/goblin_backstabber-male.glb",
  "/models/characters/goblin_backstabber-female.glb",
  "/models/characters/human_battle_mage-male.glb",
  "/models/characters/human_battle_mage-female.glb",
];

let kicked = false;

export function kickoffHeroForgePreload(): void {
  if (kicked) return;
  kicked = true;
  const missing = HERO_FORGE_MODEL_PATHS.filter((p) => !isAssetCached(p));
  if (missing.length === 0) return;
  preloadAssets(missing, "high").catch(() => {
  });
}

export function isHeroForgeWarm(): boolean {
  return HERO_FORGE_MODEL_PATHS.every(isAssetCached);
}

export function heroForgeWarmCount(): { ready: number; total: number } {
  const total = HERO_FORGE_MODEL_PATHS.length;
  let ready = 0;
  for (const p of HERO_FORGE_MODEL_PATHS) {
    if (isAssetCached(p)) ready++;
  }
  return { ready, total };
}
