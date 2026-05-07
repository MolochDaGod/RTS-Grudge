import type { WeaponType } from "@/lib/stores/useGame";
import { resetAllControllers } from "./ModeController";

export type GameFlowPhase =
  | "uninitialized"
  | "model_processing"
  | "weapon_attachment"
  | "animation_binding"
  | "controllers_ready"
  | "playing"
  | "error";

export interface GameFlowState {
  phase: GameFlowPhase;
  modelReady: boolean;
  weaponsAttached: boolean;
  animationsBound: boolean;
  controllersReady: boolean;
  error: string | null;
  lastWeaponType: WeaponType | null;
}

let state: GameFlowState = {
  phase: "uninitialized",
  modelReady: false,
  weaponsAttached: false,
  animationsBound: false,
  controllersReady: false,
  error: null,
  lastWeaponType: null,
};

const listeners: Array<(state: GameFlowState) => void> = [];

function notify(): void {
  for (const listener of listeners) {
    listener(state);
  }
}

export function onGameFlowChange(listener: (state: GameFlowState) => void): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function getGameFlowState(): GameFlowState {
  return { ...state };
}

function checkAndTransitionToPlaying(): void {
  if (state.modelReady && state.weaponsAttached && state.animationsBound && state.controllersReady) {
    if (state.phase !== "playing") {
      state = { ...state, phase: "playing" };
      console.log("[GameFlow] All phases complete — game playing");
      notify();
    }
  }
}

export function onModelProcessed(): void {
  state = { ...state, modelReady: true };
  if (state.phase === "uninitialized" || state.phase === "controllers_ready") {
    state.phase = "model_processing";
  }
  console.log("[GameFlow] Model processed and ready");
  notify();
  checkAndTransitionToPlaying();
}

export function onWeaponsAttached(weaponType: WeaponType): void {
  state = { ...state, weaponsAttached: true, lastWeaponType: weaponType };
  if (state.phase === "model_processing") {
    state.phase = "weapon_attachment";
  }
  console.log(`[GameFlow] Weapons attached: ${weaponType}`);
  notify();
  checkAndTransitionToPlaying();
}

export function onAnimationsBound(clipCount: number): void {
  state = { ...state, animationsBound: true };
  if (state.phase === "weapon_attachment" || state.phase === "model_processing") {
    state.phase = "animation_binding";
  }
  console.log(`[GameFlow] Animations bound: ${clipCount} clips`);
  notify();
  checkAndTransitionToPlaying();
}

export function onControllersReady(): void {
  state = { ...state, controllersReady: true };
  if (state.phase === "uninitialized") {
    state.phase = "controllers_ready";
  }
  console.log("[GameFlow] Mode controllers initialized");
  notify();
  checkAndTransitionToPlaying();
}

export function onGameFlowError(error: string): void {
  state = { ...state, phase: "error", error };
  console.error(`[GameFlow] Error: ${error}`);
  notify();
}

export function resetGameFlow(): void {
  state = {
    phase: "uninitialized",
    modelReady: false,
    weaponsAttached: false,
    animationsBound: false,
    controllersReady: false,
    error: null,
    lastWeaponType: null,
  };

  resetAllControllers();

  console.log("[GameFlow] Reset complete");
  notify();
}

export function initializeControllers(): void {
  resetAllControllers();
  onControllersReady();
}

export function validateGameFlowReady(): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!state.modelReady) missing.push("model_processing");
  if (!state.weaponsAttached) missing.push("weapon_attachment");
  if (!state.animationsBound) missing.push("animation_binding");
  if (!state.controllersReady) missing.push("controllers_ready");
  return { ready: missing.length === 0, missing };
}
