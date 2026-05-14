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

// ═══════════════════════════════════════════════════════════════
// COMBAT VFX — Weapon skill effects, elemental magic, combos
// ═══════════════════════════════════════════════════════════════

// ── Melee Slash / Swing arcs ──

/** Wide slash arc — melee weapon swing. Color tinted by weapon tier. */
export function slashArc(position: Pos, direction?: Pos, color = 0xffffff, count = 8): BurstSpec {
  return {
    position, count,
    speed: 12, speedJitter: 0.3,
    direction: direction ?? [0, 0, -1], coneAngle: Math.PI / 4,
    colorStart: color, colorEnd: 0x222222,
    sizeStart: 0.3, sizeEnd: 0.02,
    lifetime: 0.2, gravity: 0, damping: 6,
  };
}

/** Double slash — two rapid arcs for combo attacks */
export function doubleSlash(position: Pos, direction?: Pos): BurstSpec {
  return {
    position, count: 14,
    speed: 15, speedJitter: 0.4,
    direction: direction ?? [0, 0, -1], coneAngle: Math.PI / 3,
    colorStart: 0xffeedd, colorEnd: 0xaa4400,
    sizeStart: 0.25, sizeEnd: 0.01,
    lifetime: 0.25, gravity: 0, damping: 5,
  };
}

/** Heavy slam — ground impact burst for hammer/mace heavyAttack */
export function groundSlam(position: Pos, count = 20): BurstSpec {
  return {
    position, count,
    speed: 6, speedJitter: 0.5,
    direction: [0, 1, 0], coneAngle: Math.PI / 1.5,
    colorStart: 0xccaa77, colorEnd: 0x443311,
    sizeStart: 0.4, sizeEnd: 0.05,
    lifetime: 0.6, gravity: 8, damping: 2,
  };
}

/** Combo finisher — flashy burst for the final hit in a combo chain */
export function comboFinisher(position: Pos, direction?: Pos): BurstSpec {
  return {
    position, count: 24,
    speed: 18, speedJitter: 0.6,
    direction: direction ?? [0, 0, -1], coneAngle: Math.PI / 2,
    colorStart: 0xffffaa, colorEnd: 0xff4400,
    sizeStart: 0.35, sizeEnd: 0.0,
    lifetime: 0.35, gravity: 0, damping: 4,
  };
}

// ── Charge attack effects ──

/** Charge windup glow — emit while holding LMB to charge */
export function chargeGlow(position: Pos, level: 0 | 1 | 2 = 0): ParticleSpec {
  const colors = [
    { start: 0x88aaff, end: 0x3344aa },  // level 0 — blue
    { start: 0xffaa44, end: 0xaa4400 },  // level 1 — orange
    { start: 0xff4444, end: 0x880000 },  // level 2 — red
  ];
  const c = colors[level];
  return {
    position,
    velocity: [(Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6],
    colorStart: c.start, colorEnd: c.end,
    sizeStart: 0.15 + level * 0.05, sizeEnd: 0.0,
    lifetime: 0.4, gravity: -2, damping: 1.5, drift: 1.0,
  };
}

/** Charge release lunge — directional burst on charged attack release */
export function chargeLunge(position: Pos, direction: Pos, chargeLevel: number): BurstSpec {
  return {
    position, count: 12 + chargeLevel * 6,
    speed: 10 + chargeLevel * 5, speedJitter: 0.3,
    direction, coneAngle: Math.PI / 6,
    colorStart: chargeLevel >= 2 ? 0xff4444 : chargeLevel >= 1 ? 0xffaa44 : 0x88aaff,
    colorEnd: 0x111111,
    sizeStart: 0.25 + chargeLevel * 0.1, sizeEnd: 0.0,
    lifetime: 0.3, gravity: 0, damping: 3,
  };
}

// ── Elemental magic effects ──

/** Fire burst — explosion of flame particles */
export function fireBurst(position: Pos, count = 16): BurstSpec {
  return {
    position, count,
    speed: 5, speedJitter: 0.6,
    colorStart: 0xff6600, colorEnd: 0x220000,
    sizeStart: 0.4, sizeEnd: 0.05,
    lifetime: 0.6, gravity: -3, damping: 1.5,
  };
}

/** Fire stream particle — continuous flame channel */
export function fireStream(position: Pos, direction: Pos): ParticleSpec {
  const d = Array.isArray(direction) ? direction : [direction.x, direction.y, direction.z];
  return {
    position,
    velocity: [d[0] * 8 + (Math.random() - 0.5), d[1] * 8 + Math.random() * 2, d[2] * 8 + (Math.random() - 0.5)],
    colorStart: 0xffaa33, colorEnd: 0x441100,
    sizeStart: 0.3, sizeEnd: 0.02,
    lifetime: 0.4, gravity: -2, damping: 2, drift: 0.5,
  };
}

/** Ice shards — crystalline burst */
export function iceBurst(position: Pos, count = 14): BurstSpec {
  return {
    position, count,
    speed: 6, speedJitter: 0.4,
    colorStart: 0xaaeeff, colorEnd: 0x224466,
    sizeStart: 0.25, sizeEnd: 0.03,
    lifetime: 0.8, gravity: 6, damping: 1.5,
  };
}

/** Ice spike particle — emit for frost spells */
export function iceSpike(position: Pos): ParticleSpec {
  return {
    position,
    velocity: [(Math.random() - 0.5) * 2, 3 + Math.random() * 2, (Math.random() - 0.5) * 2],
    colorStart: 0xccffff, colorEnd: 0x224488,
    sizeStart: 0.2, sizeEnd: 0.0,
    lifetime: 0.6, gravity: 8, damping: 1,
  };
}

/** Wind gust — swirling air particles */
export function windGust(position: Pos, direction: Pos, count = 12): BurstSpec {
  return {
    position, count,
    speed: 10, speedJitter: 0.5,
    direction, coneAngle: Math.PI / 3,
    colorStart: 0xddeeff, colorEnd: 0x88aacc,
    sizeStart: 0.3, sizeEnd: 0.0,
    lifetime: 0.5, gravity: 0, damping: 3,
  };
}

/** Storm lightning flash — bright electric burst */
export function lightningFlash(position: Pos, count = 18): BurstSpec {
  return {
    position, count,
    speed: 15, speedJitter: 0.8,
    colorStart: 0xeeeeff, colorEnd: 0x4466ff,
    sizeStart: 0.2, sizeEnd: 0.0,
    lifetime: 0.15, gravity: 0, damping: 8,
  };
}

/** Lightning chain particle — emit between two positions for chain lightning */
export function lightningChain(position: Pos): ParticleSpec {
  return {
    position,
    velocity: [(Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3],
    colorStart: 0xffffff, colorEnd: 0x4466ff,
    sizeStart: 0.12, sizeEnd: 0.0,
    lifetime: 0.1, gravity: 0, damping: 10, drift: 3,
  };
}

/** Shadow tendrils — dark magic void effect */
export function shadowTendrils(position: Pos, count = 10): BurstSpec {
  return {
    position, count,
    speed: 3, speedJitter: 0.5,
    colorStart: 0x6622aa, colorEnd: 0x110022,
    sizeStart: 0.35, sizeEnd: 0.1,
    lifetime: 1.0, gravity: -1, damping: 0.8,
  };
}

/** Shadow clone puff — burst when a shadow duplicate appears/vanishes */
export function shadowClonePuff(position: Pos): BurstSpec {
  return {
    position, count: 16,
    speed: 4, speedJitter: 0.4,
    colorStart: 0x553388, colorEnd: 0x110022,
    sizeStart: 0.5, sizeEnd: 0.0,
    lifetime: 0.6, gravity: -1, damping: 2,
  };
}

// ── Shield / Block effects ──

/** Shield block impact — sparks + ring pulse on successful block */
export function shieldBlock(position: Pos, direction?: Pos): BurstSpec {
  return {
    position, count: 12,
    speed: 8, speedJitter: 0.4,
    direction: direction ?? [0, 0, 1], coneAngle: Math.PI / 2,
    colorStart: 0xffdd88, colorEnd: 0x886622,
    sizeStart: 0.2, sizeEnd: 0.0,
    lifetime: 0.25, gravity: 2, damping: 4,
  };
}

/** Perfect parry flash — bright white flash on frame-perfect block */
export function perfectParry(position: Pos): BurstSpec {
  return {
    position, count: 20,
    speed: 12, speedJitter: 0.3,
    colorStart: 0xffffff, colorEnd: 0xffcc44,
    sizeStart: 0.3, sizeEnd: 0.0,
    lifetime: 0.2, gravity: 0, damping: 6,
  };
}

// ── AoE ground effects ──

/** AoE ring burst — ground-level radial expansion for area spells */
export function aoeRing(position: Pos, radius: number, color = 0xff4444, count = 24): BurstSpec {
  return {
    position, count,
    speed: radius * 3, speedJitter: 0.2,
    direction: [0, 0.2, 0], coneAngle: Math.PI / 1.2,
    colorStart: color, colorEnd: (color & 0x333333),
    sizeStart: 0.3, sizeEnd: 0.0,
    lifetime: 0.5, gravity: 0, damping: 3,
  };
}

/** Earthquake shockwave — heavy ground impact with debris */
export function earthquakeWave(position: Pos, count = 30): BurstSpec {
  return {
    position, count,
    speed: 8, speedJitter: 0.6,
    direction: [0, 1, 0], coneAngle: Math.PI / 1.5,
    colorStart: 0x998866, colorEnd: 0x332211,
    sizeStart: 0.5, sizeEnd: 0.1,
    lifetime: 0.8, gravity: 10, damping: 1.5,
  };
}

/** Heal pulse — upward green/gold motes */
export function healPulse(position: Pos, count = 10): BurstSpec {
  return {
    position, count,
    speed: 2, speedJitter: 0.5,
    direction: [0, 1, 0], coneAngle: Math.PI / 3,
    colorStart: 0x44ff88, colorEnd: 0x116633,
    sizeStart: 0.2, sizeEnd: 0.0,
    lifetime: 1.0, gravity: -2, damping: 1,
  };
}

/** Buff aura particle — gentle orbiting mote for active buffs */
export function buffAura(position: Pos, color = 0xffcc44): ParticleSpec {
  return {
    position,
    velocity: [(Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3],
    colorStart: color, colorEnd: color & 0x444444,
    sizeStart: 0.12, sizeEnd: 0.0,
    lifetime: 1.2, gravity: -1, damping: 0.5, drift: 1.5,
  };
}

// ── Ranged impact effects ──

/** Arrow impact — small directional burst at hit point */
export function arrowImpact(position: Pos, direction?: Pos): BurstSpec {
  return {
    position, count: 6,
    speed: 4, speedJitter: 0.5,
    direction: direction ?? [0, 1, 0], coneAngle: Math.PI / 2,
    colorStart: 0xddbb88, colorEnd: 0x554422,
    sizeStart: 0.12, sizeEnd: 0.0,
    lifetime: 0.3, gravity: 8, damping: 3,
  };
}

/** Bullet impact — metal sparks + smoke */
export function bulletImpact(position: Pos): BurstSpec {
  return {
    position, count: 10,
    speed: 8, speedJitter: 0.6,
    colorStart: 0xffeecc, colorEnd: 0x555555,
    sizeStart: 0.1, sizeEnd: 0.0,
    lifetime: 0.2, gravity: 6, damping: 5,
  };
}

/** Spell impact — arcane burst at spell hit point */
export function spellImpact(position: Pos, element: "fire" | "ice" | "lightning" | "shadow" | "arcane" | "nature" = "arcane"): BurstSpec {
  const palettes = {
    fire:      { start: 0xff6600, end: 0x441100 },
    ice:       { start: 0xaaeeff, end: 0x224466 },
    lightning: { start: 0xeeeeff, end: 0x4466ff },
    shadow:    { start: 0x9944ff, end: 0x110022 },
    arcane:    { start: 0x88aaff, end: 0x2244aa },
    nature:    { start: 0x44ff88, end: 0x116633 },
  };
  const c = palettes[element];
  return {
    position, count: 14,
    speed: 5, speedJitter: 0.5,
    colorStart: c.start, colorEnd: c.end,
    sizeStart: 0.3, sizeEnd: 0.0,
    lifetime: 0.5, gravity: 0, damping: 3,
  };
}

// ── Weapon tier aura particles (called per-frame for T3+ weapons) ──

/** Tier weapon aura — floating motes around the weapon mesh */
export function tierAura(position: Pos, tierColor: number): ParticleSpec {
  return {
    position,
    velocity: [(Math.random() - 0.5) * 0.4, 0.2 + Math.random() * 0.3, (Math.random() - 0.5) * 0.4],
    colorStart: tierColor, colorEnd: tierColor & 0x333333,
    sizeStart: 0.08, sizeEnd: 0.0,
    lifetime: 0.8, gravity: -0.5, damping: 1, drift: 1.2,
  };
}
