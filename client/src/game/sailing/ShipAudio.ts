/**
 * shipAudio — lightweight ship/cannon audio bus for OpenWaterSailing.
 *
 * Patterns lifted from the Unity BoatController.cs vendored in
 * attached_assets/BoatController_*.cs:
 *
 *   • Engine pitch tied to velocity:  pitch = 1 + |speed| / pitchFraction
 *   • Sail audio swelling with throttle / sail trim
 *   • Distinct hull-hit vs water-hit one-shots
 *
 * Implementation notes:
 *   - Uses HTMLAudioElement under the hood (no AudioContext) so we don't
 *     need user-gesture priming or a graph; loops use `loop=true` and
 *     pitch is driven via `playbackRate`.
 *   - One-shot SFX clone the underlying buffer per call so overlapping
 *     fires don't cancel each other.
 *   - Asset URLs come from Vite's `@assets/` alias (resolved at build time
 *     to hashed final URLs).
 */

import bulletShotUrl       from '@assets/bulletshot_1776934095594.ogg';
import bulletImpactUrl     from '@assets/bulletimpact_1776934095595.ogg';
import bulletWaterUrl      from '@assets/bulletwater_1776934095594.ogg';
import bulletUnderwaterUrl from '@assets/bulletimpactunderwater_1776934095594.ogg';
import fireBurnUrl         from '@assets/fire_1776934095594.ogg';
// NOTE: `boatengine_*.wav` is intentionally NOT imported. Sailing ships in
// Tethical have no engine; the looped engine drone was a leftover from the
// Unity BoatController.cs reference and was removed at user request.
import windSailUrl         from '@assets/windsail_1776934095595.wav';

/** Cap on simultaneous one-shot clones so a broadside doesn't allocate dozens. */
const ONE_SHOT_BUDGET = 8;

class OneShotPool {
  private template: HTMLAudioElement;
  private pool:     HTMLAudioElement[] = [];
  private idx       = 0;

  constructor(url: string, baseVolume = 0.7) {
    this.template = new Audio(url);
    this.template.preload = 'auto';
    this.template.volume  = baseVolume;
    for (let i = 0; i < ONE_SHOT_BUDGET; i++) {
      const a = this.template.cloneNode(true) as HTMLAudioElement;
      a.volume = baseVolume;
      this.pool.push(a);
    }
  }

  play(volume = 1, pitch = 1) {
    const a = this.pool[this.idx];
    this.idx = (this.idx + 1) % this.pool.length;
    try {
      a.currentTime  = 0;
      a.volume       = Math.max(0, Math.min(1, this.template.volume * volume));
      a.playbackRate = Math.max(0.5, Math.min(2.0, pitch));
      void a.play().catch(() => { /* user-gesture policy — first call may reject */ });
    } catch { /* swallow */ }
  }

  setBaseVolume(v: number) {
    this.template.volume = Math.max(0, Math.min(1, v));
  }
}

class Loop {
  private el: HTMLAudioElement;
  private started = false;
  private targetGain = 0;

  constructor(url: string, baseVolume = 0.5) {
    this.el = new Audio(url);
    this.el.loop    = true;
    this.el.preload = 'auto';
    this.el.volume  = 0;
    (this.el as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
  }

  /** Drive the loop. `gain01` controls volume, `pitch` controls playbackRate. */
  drive(gain01: number, pitch = 1) {
    this.targetGain = Math.max(0, Math.min(1, gain01));
    this.el.playbackRate = Math.max(0.4, Math.min(2.0, pitch));
    if (!this.started && this.targetGain > 0) {
      this.started = true;
      void this.el.play().catch(() => { this.started = false; });
    }
    // simple low-pass on volume to avoid clicks
    this.el.volume += (this.targetGain - this.el.volume) * 0.15;
  }

  stop() {
    this.targetGain = 0;
    this.el.volume  = 0;
    if (this.started) {
      try { this.el.pause(); } catch { /* */ }
      this.started = false;
    }
  }
}

class ShipAudioBus {
  private fire:        OneShotPool | null = null;
  private hullHit:     OneShotPool | null = null;
  private waterHit:    OneShotPool | null = null;
  private underwater:  OneShotPool | null = null;
  private burn:        OneShotPool | null = null;
  private sail:        Loop        | null = null;
  private booted = false;

  /** Pitch divisor copied from BoatController (`pitchFraction = 5`). */
  pitchFraction = 12;

  /** Lazily build the pools. Call once on scene mount. */
  boot() {
    if (this.booted) return;
    this.booted    = true;
    this.fire      = new OneShotPool(bulletShotUrl,       0.55);
    this.hullHit   = new OneShotPool(bulletImpactUrl,     0.7);
    this.waterHit  = new OneShotPool(bulletWaterUrl,      0.5);
    this.underwater= new OneShotPool(bulletUnderwaterUrl, 0.55);
    this.burn      = new OneShotPool(fireBurnUrl,         0.4);
    this.sail      = new Loop(windSailUrl,   0.45);
  }

  playFire(opts?: { volume?: number; pitch?: number }) {
    this.fire?.play(opts?.volume ?? 1, opts?.pitch ?? (0.9 + Math.random() * 0.2));
  }
  playHullHit()       { this.hullHit?.play(1,    0.9 + Math.random() * 0.2); }
  playWaterHit()      { this.waterHit?.play(0.9, 0.9 + Math.random() * 0.2); }
  playUnderwaterHit() { this.underwater?.play(0.8, 0.9 + Math.random() * 0.2); }
  playBurn()          { this.burn?.play(0.7); }

  /**
   * Drive engine + sail loops from the live sailing state.
   * @param speed     Current ship speed (game units/s, ~0..30)
   * @param sailTrim  0..1 normalized sail trim
   * @param maxSpeed  Reference top speed for normalization
   */
  driveSailing(speed: number, sailTrim: number, maxSpeed = 25) {
    const speed01 = Math.max(0, Math.min(1, Math.abs(speed) / maxSpeed));
    // Sail: gain follows trim * speed; pitch slightly modulated by speed.
    // (Engine loop intentionally removed — see boatEngineUrl note above.)
    const sailGain = Math.max(0, Math.min(1, sailTrim)) * (0.4 + 0.6 * speed01);
    this.sail?.drive(sailGain, 0.9 + 0.3 * speed01);
  }

  stop() {
    this.sail?.stop();
  }
}

export const shipAudio = new ShipAudioBus();
export type { ShipAudioBus };
