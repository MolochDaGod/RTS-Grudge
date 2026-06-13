/**
 * shared/physics/gravity.ts — gravity + step settings shared by client + server.
 *
 * The R3F client feeds these to `<Physics gravity timeStep interpolate>`; a
 * headless `RAPIER.World` reads the same values so client-side prediction and
 * server-authoritative simulation agree.
 */
import type { Vec3 } from "./types";

/**
 * World Y gravity for Grudge Warlords islands. Matches the default in
 * `useGameConfig` (`DEFAULT_PHYSICS.gravity`). Intentionally heavier than Earth
 * (-9.81) for a snappier, arcade-feeling fall.
 */
export const WORLD_GRAVITY_Y = -20;

/** Gravity vector for a Rapier world / `<Physics gravity={...}>`. */
export const GRAVITY: Vec3 = [0, WORLD_GRAVITY_Y, 0];

/** Fixed simulation step (60 Hz): client `<Physics timeStep>` and server `world.timestep`. */
export const FIXED_TIMESTEP = 1 / 60;

/** Whether the client interpolates rendered transforms between fixed steps. */
export const PHYSICS_INTERPOLATE = true;

/** Alternate gravities for special zones / effects (e.g. low-grav boss arenas). */
export const GRAVITY_PRESETS = {
  world: [0, WORLD_GRAVITY_Y, 0],
  earth: [0, -9.81, 0],
  moon: [0, -1.62, 0],
  none: [0, 0, 0],
} satisfies Record<string, Vec3>;

export type GravityPreset = keyof typeof GRAVITY_PRESETS;
