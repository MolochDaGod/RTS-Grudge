import { combatController } from "./CombatController";
import { buildController } from "./BuildController";
import { harvestController } from "./HarvestController";

export type InteractionMode = "combat" | "build" | "harvest";

let _getMode: (() => InteractionMode) | null = null;

export function registerModeGetter(fn: () => InteractionMode): void {
  _getMode = fn;
}

export function getActiveController(mode: InteractionMode) {
  switch (mode) {
    case "combat": return combatController;
    case "build": return buildController;
    case "harvest": return harvestController;
  }
}

export function updateActiveController(delta: number): void {
  const mode = _getMode ? _getMode() : "combat";

  switch (mode) {
    case "combat":
      combatController.update(delta);
      break;
    case "harvest": {
      const result = harvestController.update(delta);
      if (result?.completed) {
        console.log(`[Harvest] Got ${result.amount} ${result.yield} (+${result.xp} xp)`);
      }
      break;
    }
    case "build":
      break;
  }

  harvestController.tryRespawnNodes(Date.now());
}

export function onModeSwitch(from: InteractionMode, to: InteractionMode): void {
  if (from === "combat") {
    combatController.stopBlock();
  }
  if (from === "build") {
    buildController.cancelPlacement();
  }
  if (from === "harvest") {
    harvestController.cancelHarvest();
  }
}

export function resetAllControllers(): void {
  combatController.reset();
  buildController.reset();
  harvestController.reset();
}
