/**
 * SpellProjectileSystem — Animated projectiles, impact particles, and
 * status effect visuals for ALL weapon types.
 *
 * Every attack in the game produces visible feedback:
 *   - Melee: slash trails, impact sparks, blood splatter, crit flash
 *   - Bow: arrow with trailing particles, impact thud
 *   - Crossbow: bolt with speed lines, penetration spark
 *   - Gun: muzzle flash, bullet trail, smoke on impact
 *   - Staff: orbiting magic missile, element-colored trail
 *   - Wand: rapid bolt chain, arcane afterglow
 *   - Tome: summoned orb that seeks target, page flutter particles
 *   - Status effects: bleed drip, poison cloud, burn embers, frost crystals
 *
 * All projectiles use the VFXPresets particle system for trails and
 * impacts — no separate mesh projectiles needed for most effects
 * (the existing HadoukenProjectile, FireballProjectile etc. handle
 * the mesh-based ones). This module covers the particle-only layer.
 */

import * as THREE from "three";
import { vfx, VFXPresets } from "../vfx";
import type { ExtendedWeaponType } from "../systems/WeaponPrefabDatabase";

type Pos = [number, number, number];

// ---------------------------------------------------------------------------
// Per-weapon attack VFX — called on every attack state enter
// ---------------------------------------------------------------------------

export interface AttackVFXConfig {
  /** Particles emitted at the weapon tip during the swing */
  swingTrail: (pos: Pos, dir: Pos) => void;
  /** Particles emitted at the hit point on contact */
  onHit: (pos: Pos, dir: Pos) => void;
  /** Projectile trail (for ranged — emitted per frame while in flight) */
  projectileTrail?: (pos: Pos, vel: Pos) => void;
  /** Muzzle/cast point flash on attack start */
  castFlash?: (pos: Pos) => void;
}

/**
 * Get the VFX config for a weapon type. Called from Player.tsx and
 * Enemy.tsx to fire the right particles per attack.
 */
export function getWeaponVFX(weaponType: ExtendedWeaponType | string): AttackVFXConfig {
  switch (weaponType) {
    // ── Melee weapons ──
    case "sword":
    case "greatsword":
      return {
        swingTrail: (pos, dir) => {
          for (let i = 0; i < 3; i++) vfx.emit(VFXPresets.wispTrail(jitter(pos, 0.2), "holy"));
        },
        onHit: (pos, dir) => {
          vfx.burst(VFXPresets.hitSparks(pos, dir, 8));
          vfx.burst(VFXPresets.slashArc(pos, dir, 0xffeedd, 6));
        },
      };

    case "axe":
    case "poleaxe":
      return {
        swingTrail: (pos, dir) => {
          for (let i = 0; i < 2; i++) vfx.emit(VFXPresets.fireSpark(jitter(pos, 0.15)));
        },
        onHit: (pos, dir) => {
          vfx.burst(VFXPresets.hitSparks(pos, dir, 10));
          vfx.burst(VFXPresets.bloodBurst(pos, 8));
        },
      };

    case "hammer":
    case "mace":
      return {
        swingTrail: (pos) => {
          vfx.emit(VFXPresets.dustPuff(pos, 2));
        },
        onHit: (pos, dir) => {
          vfx.burst(VFXPresets.groundSlam(pos, 12));
          vfx.burst(VFXPresets.hitSparks(pos, dir, 6));
        },
      };

    case "dagger":
      return {
        swingTrail: (pos) => {
          vfx.emit(VFXPresets.wispTrail(jitter(pos, 0.1), "shadow"));
        },
        onHit: (pos, dir) => {
          vfx.burst(VFXPresets.hitSparks(pos, dir, 5));
          vfx.burst(VFXPresets.bloodBurst(pos, 6));
        },
      };

    case "spear":
      return {
        swingTrail: (pos, dir) => {
          vfx.emit(VFXPresets.bulletTrail(pos, dir));
        },
        onHit: (pos, dir) => {
          vfx.burst(VFXPresets.hitSparks(pos, dir, 6));
          vfx.burst(VFXPresets.bloodBurst(pos, 5));
        },
      };

    case "shield":
      return {
        swingTrail: () => {},
        onHit: (pos, dir) => {
          vfx.burst(VFXPresets.shieldBlock(pos, dir));
        },
      };

    // ── Ranged weapons ──
    case "bow":
      return {
        swingTrail: () => {},
        onHit: (pos, dir) => {
          vfx.burst(VFXPresets.arrowImpact(pos, dir));
          vfx.burst(VFXPresets.dustPuff(pos, 3));
        },
        projectileTrail: (pos, vel) => {
          vfx.emit(VFXPresets.bulletTrail(pos, vel));
          // Feather flutter particles
          if (Math.random() < 0.3) {
            vfx.emit({
              position: pos,
              velocity: [vel[0] * -0.1 + (Math.random() - 0.5) * 0.5, 0.3, vel[2] * -0.1 + (Math.random() - 0.5) * 0.5],
              colorStart: 0xddccaa, colorEnd: 0x887755,
              sizeStart: 0.06, sizeEnd: 0.0,
              lifetime: 0.4, gravity: 3, damping: 2,
            });
          }
        },
        castFlash: (pos) => {
          // Bowstring snap
          vfx.emit({ position: pos, velocity: [0, 0.5, 0], colorStart: 0xffffff, colorEnd: 0x888888, sizeStart: 0.15, sizeEnd: 0, lifetime: 0.1, damping: 8 });
        },
      };

    case "crossbow":
      return {
        swingTrail: () => {},
        onHit: (pos, dir) => {
          vfx.burst(VFXPresets.bulletImpact(pos));
          vfx.burst(VFXPresets.hitSparks(pos, dir, 8));
        },
        projectileTrail: (pos, vel) => {
          // Speed lines — tight streak
          vfx.emit(VFXPresets.bulletTrail(pos, vel));
          vfx.emit(VFXPresets.bulletTrail(jitter(pos, 0.05), vel));
        },
        castFlash: (pos) => {
          vfx.burst(VFXPresets.hitSparks(pos, undefined, 4));
        },
      };

    case "gun":
      return {
        swingTrail: () => {},
        onHit: (pos, dir) => {
          vfx.burst(VFXPresets.bulletImpact(pos));
          // Smoke puff on impact
          for (let i = 0; i < 3; i++) {
            vfx.emit({
              position: pos,
              velocity: [(Math.random() - 0.5) * 1.5, 0.5 + Math.random(), (Math.random() - 0.5) * 1.5],
              colorStart: 0x888888, colorEnd: 0x333333,
              sizeStart: 0.25, sizeEnd: 0.5,
              lifetime: 0.8, gravity: -0.5, damping: 1, drift: 1,
            });
          }
        },
        projectileTrail: (pos, vel) => {
          vfx.emit(VFXPresets.bulletTrail(pos, vel));
        },
        castFlash: (pos) => {
          // Muzzle flash — bright yellow burst
          vfx.burst({
            position: pos, count: 8,
            speed: 6, speedJitter: 0.5,
            colorStart: 0xffffaa, colorEnd: 0xff6600,
            sizeStart: 0.2, sizeEnd: 0.0,
            lifetime: 0.08, gravity: 0, damping: 10,
          });
          // Smoke from barrel
          for (let i = 0; i < 2; i++) {
            vfx.emit({
              position: pos,
              velocity: [(Math.random() - 0.5) * 0.5, 0.3, (Math.random() - 0.5) * 0.5],
              colorStart: 0x999999, colorEnd: 0x444444,
              sizeStart: 0.15, sizeEnd: 0.3,
              lifetime: 0.5, gravity: -0.3, damping: 1, drift: 0.8,
            });
          }
        },
      };

    // ── Magic weapons ──
    case "staff":
      return {
        swingTrail: (pos) => {
          // Orbiting arcane wisps around staff head
          const t = performance.now() * 0.004;
          const ox = Math.cos(t) * 0.3;
          const oz = Math.sin(t) * 0.3;
          vfx.emit(VFXPresets.castSwirl([pos[0] + ox, pos[1] + 0.5, pos[2] + oz], "arcane"));
        },
        onHit: (pos) => {
          vfx.burst(VFXPresets.spellImpact(pos, "arcane"));
        },
        projectileTrail: (pos) => {
          // Magic missile — orbiting twin wisps
          const t = performance.now() * 0.006;
          for (let i = 0; i < 2; i++) {
            const a = t + i * Math.PI;
            const r = 0.15;
            vfx.emit(VFXPresets.wispTrail([pos[0] + Math.cos(a) * r, pos[1] + Math.sin(a) * r, pos[2]], "arcane"));
          }
        },
        castFlash: (pos) => {
          vfx.burst(VFXPresets.lightningFlash(pos, 6));
        },
      };

    case "wand":
      return {
        swingTrail: (pos) => {
          vfx.emit(VFXPresets.castSwirl(jitter(pos, 0.1), "arcane"));
        },
        onHit: (pos) => {
          vfx.burst(VFXPresets.spellImpact(pos, "lightning"));
          vfx.burst(VFXPresets.lightningFlash(pos, 8));
        },
        projectileTrail: (pos) => {
          // Rapid arcane bolt — tight bright trail
          vfx.emit(VFXPresets.wispTrail(pos, "arcane"));
          vfx.emit(VFXPresets.lightningChain(jitter(pos, 0.1)));
        },
        castFlash: (pos) => {
          vfx.emit({ position: pos, velocity: [0, 1, 0], colorStart: 0xffffff, colorEnd: 0x8888ff, sizeStart: 0.3, sizeEnd: 0, lifetime: 0.15, damping: 5 });
        },
      };

    case "tome":
      return {
        swingTrail: (pos) => {
          // Page flutter particles
          if (Math.random() < 0.4) {
            vfx.emit({
              position: jitter(pos, 0.2),
              velocity: [(Math.random() - 0.5) * 1, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 1],
              colorStart: 0xeeddcc, colorEnd: 0x886644,
              sizeStart: 0.08, sizeEnd: 0.02,
              lifetime: 0.6, gravity: 2, damping: 1.5, drift: 2,
            });
          }
          vfx.emit(VFXPresets.castSwirl(pos, "shadow"));
        },
        onHit: (pos) => {
          vfx.burst(VFXPresets.spellImpact(pos, "shadow"));
          vfx.burst(VFXPresets.shadowTendrils(pos, 6));
        },
        projectileTrail: (pos) => {
          // Seeking orb — dark energy with inner glow
          vfx.emit(VFXPresets.wispTrail(pos, "shadow"));
          if (Math.random() < 0.5) {
            vfx.emit(VFXPresets.castSwirl(jitter(pos, 0.1), "shadow"));
          }
        },
        castFlash: (pos) => {
          vfx.burst(VFXPresets.shadowClonePuff(pos));
        },
      };

    case "relic":
      return {
        swingTrail: (pos) => {
          vfx.emit(VFXPresets.buffAura(jitter(pos, 0.15), 0x44ff88));
        },
        onHit: (pos) => {
          vfx.burst(VFXPresets.healPulse(pos, 8));
        },
        castFlash: (pos) => {
          vfx.burst(VFXPresets.healPulse(pos, 5));
        },
      };

    // ── Fists ──
    default:
      return {
        swingTrail: () => {},
        onHit: (pos, dir) => {
          vfx.burst(VFXPresets.hitSparks(pos, dir, 5));
        },
      };
  }
}

// ---------------------------------------------------------------------------
// Status effect visuals — ongoing particles while a debuff is active
// ---------------------------------------------------------------------------

export type StatusEffect = "bleed" | "poison" | "burn" | "frost" | "stun" | "root" | "fear" | "silence";

/**
 * Emit per-frame particles for an active status effect on a character.
 * Call from the character's useFrame while the debuff is active.
 *
 * @param effect  The status effect type
 * @param pos     Character world position (torso height)
 */
export function emitStatusVFX(effect: StatusEffect, pos: Pos): void {
  switch (effect) {
    case "bleed":
      // Blood drip from wounds
      if (Math.random() < 0.3) {
        vfx.emit({
          position: jitter(pos, 0.3),
          velocity: [0, -1.5, 0],
          colorStart: 0xaa0000, colorEnd: 0x440000,
          sizeStart: 0.08, sizeEnd: 0.03,
          lifetime: 0.4, gravity: 8, damping: 0.5,
        });
      }
      break;

    case "poison":
      // Green toxic bubbles rising
      if (Math.random() < 0.25) {
        vfx.emit({
          position: jitter(pos, 0.4),
          velocity: [(Math.random() - 0.5) * 0.3, 0.3 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3],
          colorStart: 0x44cc44, colorEnd: 0x114411,
          sizeStart: 0.1, sizeEnd: 0.02,
          lifetime: 0.8, gravity: -1, damping: 1, drift: 0.5,
        });
      }
      break;

    case "burn":
      // Ember particles + small flames
      if (Math.random() < 0.4) {
        vfx.emit(VFXPresets.fireSpark(jitter(pos, 0.3)));
      }
      break;

    case "frost":
      // Ice crystal shimmer
      if (Math.random() < 0.2) {
        vfx.emit({
          position: jitter(pos, 0.3),
          velocity: [(Math.random() - 0.5) * 0.3, 0.2, (Math.random() - 0.5) * 0.3],
          colorStart: 0xccffff, colorEnd: 0x4488aa,
          sizeStart: 0.06, sizeEnd: 0.0,
          lifetime: 0.5, gravity: 1, damping: 2,
        });
      }
      break;

    case "stun":
      // Stars circling above head
      {
        const t = performance.now() * 0.003;
        const r = 0.3;
        const headPos: Pos = [pos[0] + Math.cos(t) * r, pos[1] + 0.5, pos[2] + Math.sin(t) * r];
        vfx.emit({
          position: headPos,
          velocity: [0, 0.1, 0],
          colorStart: 0xffffaa, colorEnd: 0xffaa00,
          sizeStart: 0.1, sizeEnd: 0.0,
          lifetime: 0.3, gravity: 0, damping: 3,
        });
      }
      break;

    case "root":
      // Green tendrils at feet
      if (Math.random() < 0.15) {
        vfx.emit({
          position: [pos[0] + (Math.random() - 0.5) * 0.5, pos[1] - 0.8, pos[2] + (Math.random() - 0.5) * 0.5],
          velocity: [0, 0.8, 0],
          colorStart: 0x228822, colorEnd: 0x114411,
          sizeStart: 0.08, sizeEnd: 0.12,
          lifetime: 1.0, gravity: -0.5, damping: 0.5, drift: 0.3,
        });
      }
      break;

    case "fear":
      // Purple wisps fleeing outward
      if (Math.random() < 0.2) {
        vfx.emit(VFXPresets.wispTrail(jitter(pos, 0.3), "shadow"));
      }
      break;

    case "silence":
      // Muted grey particles
      if (Math.random() < 0.15) {
        vfx.emit({
          position: jitter(pos, 0.2),
          velocity: [0, 0.3, 0],
          colorStart: 0x888888, colorEnd: 0x333333,
          sizeStart: 0.12, sizeEnd: 0.0,
          lifetime: 0.5, gravity: -0.5, damping: 1,
        });
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// Critical hit flash — screen-space + world-space feedback
// ---------------------------------------------------------------------------

/**
 * Fire a critical hit VFX burst at the impact point.
 * Bigger, brighter, with a white flash + colored sparks.
 */
export function emitCritHit(pos: Pos, dir: Pos, element?: string): void {
  // White flash ring
  vfx.burst({
    position: pos, count: 16,
    speed: 10, speedJitter: 0.3,
    colorStart: 0xffffff, colorEnd: 0xffcc44,
    sizeStart: 0.4, sizeEnd: 0.0,
    lifetime: 0.2, gravity: 0, damping: 5,
  });

  // Element-colored sparks
  const color = element ? elementHex(element) : 0xffaa44;
  vfx.burst({
    position: pos, count: 12,
    speed: 8, speedJitter: 0.5,
    direction: dir, coneAngle: Math.PI / 2,
    colorStart: color, colorEnd: color & 0x333333,
    sizeStart: 0.2, sizeEnd: 0.0,
    lifetime: 0.35, gravity: 4, damping: 3,
  });

  // Extra blood on physical crits
  if (!element || element === "physical") {
    vfx.burst(VFXPresets.bloodBurst(pos, 16));
  }
}

// ---------------------------------------------------------------------------
// Elemental projectile behaviors — configures how each element's
// projectile moves and looks in flight
// ---------------------------------------------------------------------------

export interface ElementalProjectileBehavior {
  /** Trail particle emitter (per frame) */
  trail: (pos: Pos, vel: Pos) => void;
  /** Impact burst */
  impact: (pos: Pos) => void;
  /** Color for the projectile mesh glow */
  glowColor: number;
  /** Speed multiplier */
  speedMult: number;
  /** Whether the projectile homes toward target */
  seeking: boolean;
  /** Seeking turn rate (radians/sec, 0 = straight) */
  seekRate: number;
}

export function getElementalProjectile(element: string): ElementalProjectileBehavior {
  switch (element) {
    case "fire":
      return {
        trail: (pos, vel) => {
          vfx.emit(VFXPresets.fireStream(pos, vel));
          if (Math.random() < 0.5) vfx.emit(VFXPresets.fireSpark(jitter(pos, 0.1)));
        },
        impact: (pos) => { vfx.burst(VFXPresets.fireBurst(pos, 20)); },
        glowColor: 0xff4400, speedMult: 1.0, seeking: false, seekRate: 0,
      };

    case "ice":
      return {
        trail: (pos) => {
          vfx.emit(VFXPresets.iceSpike(jitter(pos, 0.05)));
          vfx.emit(VFXPresets.wispTrail(pos, "arcane"));
        },
        impact: (pos) => { vfx.burst(VFXPresets.iceBurst(pos, 18)); },
        glowColor: 0x44aaff, speedMult: 0.8, seeking: false, seekRate: 0,
      };

    case "lightning":
      return {
        trail: (pos) => {
          vfx.emit(VFXPresets.lightningChain(pos));
          vfx.emit(VFXPresets.lightningChain(jitter(pos, 0.15)));
        },
        impact: (pos) => { vfx.burst(VFXPresets.lightningFlash(pos, 24)); },
        glowColor: 0xeeeeff, speedMult: 2.0, seeking: false, seekRate: 0,
      };

    case "shadow":
      return {
        trail: (pos) => {
          vfx.emit(VFXPresets.wispTrail(pos, "shadow"));
          if (Math.random() < 0.3) vfx.emit(VFXPresets.castSwirl(jitter(pos, 0.1), "shadow"));
        },
        impact: (pos) => {
          vfx.burst(VFXPresets.shadowTendrils(pos, 12));
          vfx.burst(VFXPresets.shadowClonePuff(pos));
        },
        glowColor: 0x6622aa, speedMult: 0.9, seeking: true, seekRate: 3.0,
      };

    case "nature":
      return {
        trail: (pos) => {
          vfx.emit(VFXPresets.buffAura(jitter(pos, 0.1), 0x44ff88));
        },
        impact: (pos) => {
          vfx.burst(VFXPresets.healPulse(pos, 12));
          vfx.burst(VFXPresets.spellImpact(pos, "nature"));
        },
        glowColor: 0x44ff88, speedMult: 0.7, seeking: true, seekRate: 2.0,
      };

    case "arcane":
    default:
      return {
        trail: (pos) => {
          vfx.emit(VFXPresets.wispTrail(pos, "arcane"));
          // Orbiting twin wisps
          const t = performance.now() * 0.005;
          for (let i = 0; i < 2; i++) {
            const a = t + i * Math.PI;
            const r = 0.12;
            vfx.emit(VFXPresets.wispTrail(
              [pos[0] + Math.cos(a) * r, pos[1] + Math.sin(a) * r * 0.5, pos[2] + Math.sin(a) * r],
              "arcane",
            ));
          }
        },
        impact: (pos) => {
          vfx.burst(VFXPresets.spellImpact(pos, "arcane"));
          vfx.burst(VFXPresets.lightningFlash(pos, 8));
        },
        glowColor: 0x4488ff, speedMult: 1.0, seeking: false, seekRate: 0,
      };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jitter(pos: Pos, amount: number): Pos {
  return [
    pos[0] + (Math.random() - 0.5) * amount,
    pos[1] + (Math.random() - 0.5) * amount,
    pos[2] + (Math.random() - 0.5) * amount,
  ];
}

function elementHex(element: string): number {
  const map: Record<string, number> = {
    fire: 0xff4400, ice: 0x44aaff, lightning: 0xeeeeff,
    shadow: 0x9944ff, arcane: 0x4488ff, nature: 0x44ff88,
    physical: 0xffaa44, holy: 0xffeeaa,
  };
  return map[element] ?? 0xffffff;
}
