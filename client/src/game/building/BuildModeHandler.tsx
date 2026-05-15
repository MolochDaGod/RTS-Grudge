import { useEffect, useCallback, useRef } from "react";
import { useBuildSystem, getBuildingDef, registerBuildingRemoveCallback } from "@/lib/stores/useBuildSystem";
import { useModularBuild } from "@/lib/stores/useModularBuild";
import { useGame } from "@/lib/stores/useGame";
import { useAllies } from "@/lib/stores/useAllies";
import { addBuildingResources, removeBuildingResources } from "../components/ResourceNode";
import * as THREE from "three";

registerBuildingRemoveCallback(removeBuildingResources);

function useResourceIncome() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const { placedBuildings, addResources } = useBuildSystem.getState();
      let woodIncome = 0, stoneIncome = 0, goldIncome = 0;
      for (const b of placedBuildings) {
        const def = getBuildingDef(b.defId);
        if (!def) continue;
        if (def.category === "economy") {
          if (def.id.startsWith("farm")) goldIncome += 1 * b.level;
          if (def.id.startsWith("market")) goldIncome += 2 * b.level;
          if (def.id.startsWith("storage")) { woodIncome += 0.5; stoneIncome += 0.5; }
          if (def.id.startsWith("windmill")) goldIncome += 1;
        }
      }
      if (woodIncome > 0 || stoneIncome > 0 || goldIncome > 0) {
        addResources(woodIncome, stoneIncome, goldIncome);
      }
    }, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);
}

export default function BuildModeHandler() {
  useResourceIncome();
  const buildMode = useBuildSystem(s => s.buildMode);
  const selectedBuildingId = useBuildSystem(s => s.selectedBuildingId);
  const ghostPosition = useBuildSystem(s => s.ghostPosition);
  const interactionMode = useGame(s => s.interactionMode);

  useEffect(() => {
    const bs = useBuildSystem.getState();
    if (interactionMode === "build" && !bs.buildMode) {
      bs.toggleBuildMode();
    } else if (interactionMode !== "build" && bs.buildMode) {
      bs.toggleBuildMode();
    }
  }, [interactionMode]);

  const handlePlace = useCallback(() => {
    if (!buildMode || !selectedBuildingId || !ghostPosition) return;
    const def = getBuildingDef(selectedBuildingId);
    const placed = useBuildSystem.getState().placeBuilding();
    if (!placed || !def) return;

    const buildings = useBuildSystem.getState().placedBuildings;
    const lastBuilding = buildings[buildings.length - 1];
    if (!lastBuilding) return;

    if (def.spawnAlly && def.allyCount) {
      const center = new THREE.Vector3(ghostPosition[0], ghostPosition[1], ghostPosition[2]);
      useAllies.getState().spawnAllies(
        def.spawnAlly as any,
        def.allyCount,
        center,
        10,
        lastBuilding.uid,
      );
    }

    if (def.spawnResources && def.spawnResources.length > 0) {
      addBuildingResources(
        lastBuilding.uid,
        ghostPosition,
        def.spawnResources,
      );
    }
  }, [buildMode, selectedBuildingId, ghostPosition]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "KeyB" && !e.repeat) {
        const currentMode = useGame.getState().interactionMode;
        if (currentMode === "build") {
          useGame.getState().setInteractionMode("combat");
        } else {
          useGame.getState().setInteractionMode("build");
        }
      }
      // N key toggles modular dungeon build mode (separate from RTS B-key)
      if (e.code === "KeyN" && !e.repeat) {
        const mb = useModularBuild.getState();
        mb.setActive(!mb.active);
      }
      if (useBuildSystem.getState().buildMode) {
        if (e.code === "KeyR" && !e.repeat) {
          useBuildSystem.getState().rotateGhost();
        }
        if (e.code === "Escape") {
          useBuildSystem.getState().selectBuilding(null);
        }
      }
    };

    const handleClick = (e: MouseEvent) => {
      const state = useBuildSystem.getState();
      if (!state.buildMode || !state.selectedBuildingId) return;
      if (e.button === 0) {
        handlePlace();
      } else if (e.button === 2) {
        state.selectBuilding(null);
      }
    };

    const handleContext = (e: MouseEvent) => {
      if (useBuildSystem.getState().buildMode) e.preventDefault();
    };

    window.addEventListener("keydown", handleKey);
    window.addEventListener("click", handleClick);
    window.addEventListener("contextmenu", handleContext);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("contextmenu", handleContext);
    };
  }, [handlePlace]);

  return null;
}
