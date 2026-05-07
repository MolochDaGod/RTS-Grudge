import { create } from "zustand";
import { useGameConfig } from "@/lib/stores/useGameConfig";

/**
 * Controller Lab — session-level overrides for the /controller page.
 *
 * Holds per-clip animation tweaks (speed / loop / oneShot / autoReturn /
 * crossfade) and global controller-config tweaks (walk/run/sprint speeds,
 * jump height, dodge i-frames + distance, key bindings). The /controller
 * page edits these; the live preview reads them directly. Pressing
 * "Run" copies the controller-config values into the live game store
 * (useGameConfig) and bumps `runVersion` so the preview canvas re-mounts
 * with the freshest values.
 *
 * Kept intentionally small — every field is a number/bool/string with a
 * sensible default.
 */

export interface AnimOverride {
  /** Playback rate multiplier (1.0 = native). */
  speed: number;
  /** Loop the clip when finished, instead of clamping to last frame. */
  loop: boolean;
  /** Play exactly once, ignoring `loop` (same as loop=false but explicit). */
  oneShot: boolean;
  /** When the clip finishes, automatically transition back to idle. */
  autoReturn: boolean;
  /** Crossfade duration into this clip when triggered (seconds). */
  crossfade: number;
}

export const DEFAULT_ANIM_OVERRIDE: AnimOverride = {
  speed: 1.0,
  loop: true,
  oneShot: false,
  autoReturn: false,
  crossfade: 0.25,
};

/** Action keys whose bindings can be remapped from the lab. */
export type RemappableAction =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "jump"
  | "sprint"
  | "dodge"
  | "interact";

/** Allowed key codes shown in the keymap dropdown. */
export const REMAPPABLE_KEYS = [
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyE",
  "KeyF",
  "KeyQ",
  "KeyR",
  "KeyV",
  "KeyC",
  "KeyZ",
  "KeyX",
  "Space",
  "ShiftLeft",
  "ControlLeft",
  "AltLeft",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
] as const;

export type RemappableKey = (typeof REMAPPABLE_KEYS)[number];

export interface ControllerConfig {
  /** Walk speed in m/s (held movement, no sprint). */
  walkSpeed: number;
  /** Run speed in m/s (default movement speed). */
  runSpeed: number;
  /** Sprint speed in m/s (sprint key held). */
  sprintSpeed: number;
  /** Jump apex height in metres. */
  jumpHeight: number;
  /** Dodge i-frame window in milliseconds. */
  dodgeIFramesMs: number;
  /** Dodge displacement distance in metres. */
  dodgeDistance: number;
  /** Per-action key bindings. */
  keymap: Record<RemappableAction, RemappableKey>;
}

export const DEFAULT_CONTROLLER_CONFIG: ControllerConfig = {
  walkSpeed: 2.5,
  runSpeed: 5.0,
  sprintSpeed: 9.0,
  jumpHeight: 1.6,
  dodgeIFramesMs: 350,
  dodgeDistance: 4.0,
  keymap: {
    forward: "KeyW",
    back: "KeyS",
    left: "KeyA",
    right: "KeyD",
    jump: "Space",
    sprint: "ShiftLeft",
    dodge: "KeyV",
    interact: "KeyE",
  },
};

interface ControllerLabState {
  selectedAnimKey: string | null;
  selectedCharacterId: string;
  animOverrides: Record<string, AnimOverride>;
  controllerConfig: ControllerConfig;
  runVersion: number;

  setSelectedAnim: (key: string | null) => void;
  setSelectedCharacter: (id: string) => void;
  setAnimOverride: (key: string, patch: Partial<AnimOverride>) => void;
  resetAnimOverride: (key: string) => void;
  setControllerConfig: (patch: Partial<ControllerConfig>) => void;
  setKeymapBinding: (action: RemappableAction, key: RemappableKey) => void;
  resetControllerConfig: () => void;
  bumpRun: () => void;
}

export const useControllerLab = create<ControllerLabState>((set) => ({
  selectedAnimKey: null,
  selectedCharacterId: "assassin-male",
  animOverrides: {},
  controllerConfig: { ...DEFAULT_CONTROLLER_CONFIG },
  runVersion: 0,

  setSelectedAnim: (key) => set({ selectedAnimKey: key }),
  setSelectedCharacter: (id) => set({ selectedCharacterId: id }),
  setAnimOverride: (key, patch) =>
    set((s) => ({
      animOverrides: {
        ...s.animOverrides,
        [key]: { ...DEFAULT_ANIM_OVERRIDE, ...s.animOverrides[key], ...patch },
      },
    })),
  resetAnimOverride: (key) =>
    set((s) => {
      const next = { ...s.animOverrides };
      delete next[key];
      return { animOverrides: next };
    }),
  setControllerConfig: (patch) =>
    set((s) => ({ controllerConfig: { ...s.controllerConfig, ...patch } })),
  setKeymapBinding: (action, key) =>
    set((s) => ({
      controllerConfig: {
        ...s.controllerConfig,
        keymap: { ...s.controllerConfig.keymap, [action]: key },
      },
    })),
  resetControllerConfig: () =>
    set({ controllerConfig: { ...DEFAULT_CONTROLLER_CONFIG } }),
  bumpRun: () => set((s) => ({ runVersion: s.runVersion + 1 })),
}));

export function getAnimOverride(
  overrides: Record<string, AnimOverride>,
  key: string,
): AnimOverride {
  return overrides[key] ?? DEFAULT_ANIM_OVERRIDE;
}

/**
 * Apply the lab's controller-config values to the live game's
 * `useGameConfig.physics` + `useGameConfig.combat`. Called by the page's
 * "Run" button so tweaks made in the lab take effect in actual gameplay
 * the next time the player enters the world.
 *
 *  - `runSpeed`   → `physics.playerSpeed`
 *  - `sprintSpeed` → `physics.sprintMultiplier` (= sprintSpeed / runSpeed,
 *    clamped at >= 1.0)
 *  - `jumpHeight` → `physics.jumpForce` (impulse magnitude, derived from
 *    h = v² / 2g  ⇒  v = sqrt(2 g h)  with g = physics.gravity)
 *  - `dodgeIFramesMs` → `combat.dodgeIFrames` (seconds)
 *
 * `walkSpeed` and `dodgeDistance` are stored in the lab for now — there
 * is no live-game equivalent yet, so they're consumed only by the
 * preview canvas and any future controller plumbing that reads them.
 */
export function applyControllerConfigToLiveGame(config: ControllerConfig): void {
  const liveCfg = useGameConfig.getState();
  // Live `physics.gravity` is signed (default -20). For the kinematic
  // `v = sqrt(2 g h)` we need its magnitude, otherwise the radicand goes
  // negative and the jumpForce becomes NaN.
  const gravity = Math.abs(liveCfg.config.physics.gravity) || 9.81;
  const sprintMul = config.runSpeed > 0
    ? Math.max(1.0, config.sprintSpeed / config.runSpeed)
    : 1.8;
  const jumpForce = Math.sqrt(2 * gravity * Math.max(0.1, config.jumpHeight));

  liveCfg.updatePhysics({
    playerSpeed: config.runSpeed,
    sprintMultiplier: sprintMul,
    jumpForce,
  });
  liveCfg.updateCombat({
    dodgeIFrames: config.dodgeIFramesMs / 1000,
  });
}
