/**
 * Wires legacy camp / base / flag sources into the unified ClaimArea registry.
 */
import { useEffect } from "react";
import { useClaimArea } from "@/lib/stores/useClaimArea";
import { useSurvivalBuilding } from "@/lib/stores/useSurvivalBuilding";
import { useFactionHeroes } from "@/lib/stores/useFactionHeroes";
import { CLAIM_AREA_DEFAULTS, isCampfireRecipe } from "./claimAreaTypes";
import { getTerrainHeight, globalHeightData } from "@/game/components/Terrain";
import { WORLD_CLAIM_CAMPS } from "./worldClaimCamps";

export function ClaimAreaSync() {
  const upsert = useClaimArea((s) => s.upsertClaim);
  const remove = useClaimArea((s) => s.removeClaim);
  const survivalBuildings = useSurvivalBuilding((s) => s.placedBuildings);
  const heroes = useFactionHeroes((s) => s.heroes);

  // World scatter camps (static POIs)
  useEffect(() => {
    for (const camp of WORLD_CLAIM_CAMPS) {
      const y = getTerrainHeight(camp.x, camp.z, globalHeightData);
      upsert({
        id: camp.id,
        position: [camp.x, y, camp.z],
        radius: camp.radius ?? CLAIM_AREA_DEFAULTS.worldCampRadius,
        ownerId: "world",
        ownerKind: "world",
        labels: ["camp", "claim", "flag"],
        lit: true,
        fireSeed: camp.seed,
        fireScale: camp.fireScale,
      });
    }
    return () => {
      for (const camp of WORLD_CLAIM_CAMPS) remove(camp.id);
    };
  }, [upsert, remove]);

  // Player survival campfires / fire pits
  useEffect(() => {
    const campfireIds = new Set<string>();

    for (const b of survivalBuildings) {
      if (!isCampfireRecipe(b.recipeId)) continue;
      const id = `claim-${b.uid}`;
      campfireIds.add(id);
      upsert({
        id,
        position: [...b.position],
        radius: CLAIM_AREA_DEFAULTS.playerCampRadius,
        ownerId: "player",
        ownerKind: "player",
        labels: ["camp", "base", "claim", "fire_pit"],
        lit: b.health > 0,
        fireSeed: hashSeed(b.uid),
        fireScale: 0.85,
      });
    }

    const stale = [...useClaimArea.getState().areas.keys()].filter(
      (k) => k.startsWith("claim-sb_") && !campfireIds.has(k),
    );
    for (const id of stale) remove(id);

    return () => {
      for (const id of campfireIds) remove(id);
    };
  }, [survivalBuildings, upsert, remove]);

  // NPC hero field camps
  useEffect(() => {
    const active = new Set<string>();

    for (const [heroId, hero] of heroes) {
      if (!hero.hasCamp || !hero.campPosition) continue;
      const id = `hero-claim-${heroId}`;
      active.add(id);
      const p = hero.campPosition;
      upsert({
        id,
        position: [p.x, p.y, p.z],
        radius: CLAIM_AREA_DEFAULTS.heroCampRadius,
        ownerId: heroId,
        ownerKind: "hero",
        labels: ["camp", "claim", "flag", "outpost"],
        lit: hero.dailyState === "adventuring",
        fireSeed: hashSeed(heroId),
        fireScale: 0.95,
      });
    }

    const stale = [...useClaimArea.getState().areas.keys()].filter(
      (k) => k.startsWith("hero-claim-") && !active.has(k),
    );
    for (const id of stale) remove(id);
  }, [heroes, upsert, remove]);

  return null;
}

function hashSeed(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 997;
  return (h % 1000) / 1000;
}