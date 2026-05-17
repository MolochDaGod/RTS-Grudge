/**
 * FactionHeroes — scene-level manager for all 24 faction hero NPCs.
 *
 * Visibility rule (the core performance guarantee):
 *   Only heroes whose location matches the player's current location are
 *   rendered as full 3D agents. Off-screen heroes stay as cheap Zustand
 *   state; their daily cycles still advance via the 60-second ticker.
 *
 * Location matching:
 *   at_hub       → render when player is at the hub world origin (within
 *                  HUB_DETECT_RADIUS of the faction hub).
 *   adventuring  → render when the player's current island grid matches
 *                  the hero's adventure grid cell.
 *   outbound/inbound/dead → never rendered.
 *
 * Cycle ticker:
 *   A setInterval fires every 60 real seconds and calls
 *   useFactionHeroes.advanceCycles(), which re-evaluates each hero's
 *   UTC-clock phase. This keeps off-screen heroes' states consistent
 *   without burning per-frame React budget.
 */

import { useEffect, useMemo, Suspense } from "react";
import * as THREE from "three";
import { ALL_HEROES } from "@/game/world/HeroRegistry";
import { useFactionHeroes } from "@/lib/stores/useFactionHeroes";
import { useIslandWorld } from "@/lib/stores/useIslandWorld";
import { useGame } from "@/lib/stores/useGame";
import { useMissions } from "@/lib/stores/useMissions";
import { useWorldEvents } from "@/lib/stores/useWorldEvents";
import FactionHeroNPC from "./FactionHeroNPC";

// ─────────────────────────────────────────────────────────────────────────────

/** Radius around a faction hub inside which hub-heroes are rendered. */
const HUB_DETECT_RADIUS = 80;

/** Re-evaluate all hero phases every N milliseconds. */
const CYCLE_TICK_MS = 60_000;

// Scratch vector for hub distance check
const _scratchVec = new THREE.Vector3();

// ─────────────────────────────────────────────────────────────────────────────

interface FactionHeroesProps {
  playerPosition: THREE.Vector3;
}

export default function FactionHeroes({ playerPosition }: FactionHeroesProps) {
  const { heroes, advanceCycles } = useFactionHeroes();
  const { currentIslandId } = useIslandWorld();

  // ── Coarse daily-cycle ticker ──────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      advanceCycles();
      useMissions.getState().checkAndRotate();
      // Tick world events (FactionInvasion, StormEvent, etc.)
      useWorldEvents.getState().tick();
    };
    const id = setInterval(tick, CYCLE_TICK_MS);
    tick(); // immediate first pass
    return () => clearInterval(id);
  }, [advanceCycles]);

  // ── Determine which heroes to render ──────────────────────────────────
  const visibleHeroIds = useMemo(() => {
    const result: string[] = [];

    for (const def of ALL_HEROES) {
      const state = heroes.get(def.id);
      if (!state) continue;

      switch (state.dailyState) {
        case "at_hub": {
          // Show if player is near this faction's hub
          _scratchVec.set(...def.hubPosition);
          const dist = playerPosition.distanceTo(_scratchVec);
          if (dist <= HUB_DETECT_RADIUS) result.push(def.id);
          break;
        }
        case "adventuring": {
          // Show if player is on the same grid cell as the hero's adventure island
          const expectedIslandId = `island_${def.adventureGrid.x}_${def.adventureGrid.z}`;
          if (currentIslandId === expectedIslandId) result.push(def.id);
          break;
        }
        // outbound, inbound, dead → not rendered
        default:
          break;
      }
    }

    return result;
  }, [heroes, playerPosition, currentIslandId]);

  if (visibleHeroIds.length === 0) return null;

  return (
    <>
      {visibleHeroIds.map((heroId) => (
        <FactionHeroNPC key={heroId} heroId={heroId} />
      ))}
    </>
  );
}
