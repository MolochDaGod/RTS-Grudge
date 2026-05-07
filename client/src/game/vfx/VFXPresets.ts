import * as THREE from "three";
import type { ParticleSpec, BurstSpec } from "./VFXManager";

/**
 * Preset library — ready-tuned spec factories the rest of the game can
 * call without inventing colors, lifetimes, or drift values. Each preset
 * is a tiny function that returns a ParticleSpec/BurstSpec; tuning lives
 * in one place so the look stays consistent across all gameplay systems.
 *
 * Add new presets here rather than passing raw specs from gameplay code —
 * keeps the visual language of the game uniform.
 */

type Pos = THREE.Vector3 | [number, number, number];

/** Soft red blood splatter — short-lived, gravity-heavy. Hit feedback. */
export function bloodBurst(position: Pos, count = 14): BurstSpec {
  return {
    position,
    count,
    speed: 4.5,
    speedJitter: 0.6,
    colorStart: 0xaa0000,
    colorEnd: 0x220000,
    sizeStart: 0.18,
    sizeEnd: 0.05,
    lifetime: 0.55,
    gravity: 14,
    damping: 1.2,
  };
}

/** Bright yellow-orange sparks — generic impact / metal-on-metal. */
export function hitSparks(position: Pos, direction?: Pos, count = 10): BurstSpec {
  return {
    position,
    count,
    speed: 7,
    speedJitter: 0.5,
    direction,
    coneAngle: Math.PI / 2.5,
    colorStart: 0xfff0aa,
    colorEnd: 0xff4400,
    sizeStart: 0.14,
    sizeEnd: 0.02,
    lifetime: 0.35,
    gravity: 12,
    damping: 2,
  };
}

/** Tiny embered fire particle — emit one per frame from a torch / impact. */
export function fireSpark(position: Pos): ParticleSpec {
  return {
    position,
    velocity: [
      (Math.random() - 0.5) * 0.4,
      0.6 + Math.random() * 0.4,
      (Math.random() - 0.5) * 0.4,
    ],
    colorStart: 0xffcc44,
    colorEnd: 0x661100,
    sizeStart: 0.18 + Math.random() * 0.06,
    sizeEnd: 0.02,
    lifetime: 0.7 + Math.random() * 0.3,
    gravity: -3, // negative = rises (heated)
    damping: 1.5,
    drift: 1.4,
  };
}

/**
 * Magic wisp trail particle — emit one per frame from a moving projectile
 * to form a connected ribbon (the linked-particles look). Color hue is
 * configurable so different schools (arcane / holy / shadow) read distinct.
 */
export function wispTrail(position: Pos, hue: "arcane" | "holy" | "shadow" | "fire" = "arcane"): ParticleSpec {
  const palette = {
    arcane: { start: 0x88aaff, end: 0x2244aa },
    holy:   { start: 0xfff5cc, end: 0xffaa44 },
    shadow: { start: 0x9944ff, end: 0x110022 },
    fire:   { start: 0xffaa33, end: 0x441100 },
  }[hue];
  return {
    position,
    velocity: [
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
    ],
    colorStart: palette.start,
    colorEnd: palette.end,
    sizeStart: 0.22,
    sizeEnd: 0.0,
    lifetime: 0.5,
    gravity: 0,
    damping: 1.5,
    drift: 0.8,
  };
}

/**
 * Tight high-velocity streak particle — for bullets / arrows / fast bolts
 * where you want a thin, short, directional line of light.
 */
export function bulletTrail(position: Pos, baseVel?: Pos): ParticleSpec {
  return {
    position,
    velocity: baseVel
      ? Array.isArray(baseVel)
        ? [baseVel[0] * 0.1, baseVel[1] * 0.1, baseVel[2] * 0.1]
        : [baseVel.x * 0.1, baseVel.y * 0.1, baseVel.z * 0.1]
      : [0, 0, 0],
    colorStart: 0xfff5d0,
    colorEnd: 0xffaa33,
    sizeStart: 0.08,
    sizeEnd: 0.0,
    lifetime: 0.18,
    damping: 4,
  };
}

/**
 * Casting swirl particle — orbits the caster's hand during a wind-up.
 * Call from a `useFrame` with the hand world position; the orbit math is
 * the caller's job (we only describe how each particle should look + die).
 */
export function castSwirl(position: Pos, hue: "arcane" | "holy" | "shadow" | "fire" = "arcane"): ParticleSpec {
  const palette = {
    arcane: { start: 0xaaccff, end: 0x4466cc },
    holy:   { start: 0xffeeaa, end: 0xffaa44 },
    shadow: { start: 0xcc88ff, end: 0x331144 },
    fire:   { start: 0xffaa33, end: 0xaa2200 },
  }[hue];
  return {
    position,
    velocity: [0, 0.4, 0],
    colorStart: palette.start,
    colorEnd: palette.end,
    sizeStart: 0.16,
    sizeEnd: 0.0,
    lifetime: 0.45,
    gravity: -2,
    damping: 1.0,
    drift: 1.2,
  };
}

/** Cone of dust at a footstep / impact landing. Subtle, brown, gravity-bound. */
export function dustPuff(position: Pos, count = 6): BurstSpec {
  return {
    position,
    count,
    speed: 1.4,
    speedJitter: 0.5,
    direction: [0, 1, 0],
    coneAngle: Math.PI / 2.2,
    colorStart: 0xaa9977,
    colorEnd: 0x554433,
    sizeStart: 0.22,
    sizeEnd: 0.0,
    lifetime: 0.7,
    gravity: 4,
    damping: 2,
  };
}
