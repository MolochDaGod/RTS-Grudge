import { useAudio } from "@/lib/stores/useAudio";
import { useSettings } from "@/lib/stores/useSettings";
import type { DecorMaterial } from "@/game/dungeon/DungeonDecorDestruction";

/**
 * Procedural per-material smash + thunk SFX for the dungeon decor
 * destruction system. Uses Web Audio synthesis (no asset files), the
 * same approach the CeilingCreaks system in DungeonScene uses, so we
 * don't need to ship a pile of .mp3s for every material variant.
 *
 * Smash recipe shape per material:
 *   wood    — filtered noise crack with a low woody click underneath
 *   stone   — heavy crumble: low rumble sub + filtered noise debris
 *   ore     — metallic clang: noise transient + ringing sine partials
 *   ceramic — bright shatter: high-passed noise burst + airy chirps
 *   cloth   — soft fabric thump (very quiet by design)
 *   crystal — bell-like chime: stacked sine partials with long decay
 *
 * The "thunk" variant for a non-killing hit reuses the same engine but
 * with a much shorter, duller envelope and ~half volume.
 *
 * Volume is composed from:
 *   - per-material base level (bigger materials are inherently louder)
 *   - a size factor derived from the prop's bbox volume (a tiny pot
 *     should be quieter than a pillar)
 *   - the user's master + sfx sliders, gated by the global mute toggle
 */

type SmashKind = "smash" | "thunk";

interface MaterialRecipe {
  /** Per-material gain on top of the global SFX volume. */
  baseGain: number;
  smash: (ctx: AudioContext) => AudioBuffer;
  thunk: (ctx: AudioContext) => AudioBuffer;
}

let _ctx: AudioContext | null = null;
const _bufferCache = new Map<string, AudioBuffer>();

function getCtx(): AudioContext | null {
  if (_ctx) return _ctx;
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    _ctx = new Ctor();
  } catch {
    _ctx = null;
  }
  return _ctx;
}

// ─────────────────────────────────────────────────────────────────────
// Synth primitives
// ─────────────────────────────────────────────────────────────────────

interface NoiseOpts {
  durationSec: number;
  attackSec?: number;
  releaseSec?: number;
  /** 1-pole LPF coefficient (0..1, larger = brighter). */
  lpAlpha?: number;
  /** 1-pole HPF coefficient (0..1, larger = duller, smaller = brighter). */
  hpAlpha?: number;
  /** Gain envelope curve exponent (>1 = faster decay). */
  curve?: number;
  /** Final output gain. */
  level?: number;
}

function fillNoise(
  data: Float32Array,
  sr: number,
  opts: NoiseOpts,
): void {
  const {
    durationSec,
    attackSec = 0.002,
    releaseSec = durationSec,
    lpAlpha = 0.5,
    hpAlpha = 0,
    curve = 2.0,
    level = 0.6,
  } = opts;
  const length = Math.min(data.length, Math.floor(sr * durationSec));
  let lp = 0;
  let hpPrevIn = 0;
  let hpPrevOut = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sr;
    const n = Math.random() * 2 - 1;
    lp += (n - lp) * lpAlpha;
    let s = lp;
    if (hpAlpha > 0) {
      // Simple 1-pole high-pass (DC blocker style).
      const out = (1 - hpAlpha) * (hpPrevOut + s - hpPrevIn);
      hpPrevIn = s;
      hpPrevOut = out;
      s = out;
    }
    const atk = attackSec > 0 ? Math.min(1, t / attackSec) : 1;
    const relT = Math.max(0, (t - attackSec) / Math.max(0.001, releaseSec));
    const env = atk * Math.pow(Math.max(0, 1 - relT), curve);
    data[i] += s * env * level;
  }
}

interface SineOpts {
  durationSec: number;
  freqHz: number;
  /** Linear glide to this frequency over the burst. */
  endFreqHz?: number;
  attackSec?: number;
  releaseSec?: number;
  curve?: number;
  level?: number;
}

function addSine(data: Float32Array, sr: number, opts: SineOpts): void {
  const {
    durationSec,
    freqHz,
    endFreqHz = freqHz,
    attackSec = 0.002,
    releaseSec = durationSec,
    curve = 2.5,
    level = 0.4,
  } = opts;
  const length = Math.min(data.length, Math.floor(sr * durationSec));
  let phase = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sr;
    const k = durationSec > 0 ? Math.min(1, t / durationSec) : 1;
    const f = freqHz + (endFreqHz - freqHz) * k;
    phase += (2 * Math.PI * f) / sr;
    const atk = attackSec > 0 ? Math.min(1, t / attackSec) : 1;
    const relT = Math.max(0, (t - attackSec) / Math.max(0.001, releaseSec));
    const env = atk * Math.pow(Math.max(0, 1 - relT), curve);
    data[i] += Math.sin(phase) * env * level;
  }
}

function makeBuffer(
  ctx: AudioContext,
  durationSec: number,
  fill: (data: Float32Array, sr: number) => void,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sr * durationSec));
  const buf = ctx.createBuffer(1, length, sr);
  const data = buf.getChannelData(0);
  fill(data, sr);
  // Gentle peak normalize so wildly different recipes still play in
  // the same dynamic range. We aim for a peak of ~0.85 so the master
  // gain stage has headroom.
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const a = Math.abs(data[i]);
    if (a > peak) peak = a;
  }
  if (peak > 0) {
    const norm = 0.85 / peak;
    for (let i = 0; i < length; i++) data[i] *= norm;
  }
  return buf;
}

// ─────────────────────────────────────────────────────────────────────
// Material recipes
// ─────────────────────────────────────────────────────────────────────

const RECIPES: Record<DecorMaterial, MaterialRecipe> = {
  wood: {
    baseGain: 0.55,
    smash: (ctx) =>
      makeBuffer(ctx, 0.45, (d, sr) => {
        // Sharp crack + low woody click.
        fillNoise(d, sr, {
          durationSec: 0.35,
          attackSec: 0.001,
          releaseSec: 0.35,
          lpAlpha: 0.55,
          curve: 2.2,
          level: 0.7,
        });
        addSine(d, sr, {
          durationSec: 0.18,
          freqHz: 180,
          endFreqHz: 110,
          attackSec: 0.001,
          releaseSec: 0.18,
          curve: 3.0,
          level: 0.5,
        });
        addSine(d, sr, {
          durationSec: 0.22,
          freqHz: 320,
          endFreqHz: 220,
          attackSec: 0.001,
          releaseSec: 0.22,
          curve: 2.5,
          level: 0.25,
        });
      }),
    thunk: (ctx) =>
      makeBuffer(ctx, 0.18, (d, sr) => {
        fillNoise(d, sr, {
          durationSec: 0.14,
          lpAlpha: 0.35,
          curve: 2.8,
          level: 0.55,
        });
        addSine(d, sr, {
          durationSec: 0.12,
          freqHz: 140,
          endFreqHz: 90,
          curve: 3.0,
          level: 0.45,
        });
      }),
  },

  stone: {
    baseGain: 0.7,
    smash: (ctx) =>
      makeBuffer(ctx, 0.6, (d, sr) => {
        // Heavy crumble: low rumble + filtered noise debris.
        fillNoise(d, sr, {
          durationSec: 0.5,
          attackSec: 0.002,
          releaseSec: 0.5,
          lpAlpha: 0.3,
          curve: 1.6,
          level: 0.7,
        });
        addSine(d, sr, {
          durationSec: 0.35,
          freqHz: 95,
          endFreqHz: 55,
          curve: 2.0,
          level: 0.55,
        });
        // A second debris tail to evoke chunks bouncing.
        fillNoise(d, sr, {
          durationSec: 0.55,
          attackSec: 0.05,
          releaseSec: 0.45,
          lpAlpha: 0.18,
          curve: 1.8,
          level: 0.35,
        });
      }),
    thunk: (ctx) =>
      makeBuffer(ctx, 0.22, (d, sr) => {
        fillNoise(d, sr, {
          durationSec: 0.18,
          lpAlpha: 0.22,
          curve: 2.5,
          level: 0.55,
        });
        addSine(d, sr, {
          durationSec: 0.16,
          freqHz: 80,
          endFreqHz: 55,
          curve: 2.6,
          level: 0.45,
        });
      }),
  },

  ore: {
    baseGain: 0.6,
    smash: (ctx) =>
      makeBuffer(ctx, 0.7, (d, sr) => {
        // Metal clang: noise transient + ringing sine partials.
        fillNoise(d, sr, {
          durationSec: 0.06,
          attackSec: 0.001,
          releaseSec: 0.06,
          lpAlpha: 0.7,
          curve: 2.2,
          level: 0.6,
        });
        addSine(d, sr, {
          durationSec: 0.55,
          freqHz: 620,
          endFreqHz: 580,
          attackSec: 0.002,
          releaseSec: 0.55,
          curve: 1.6,
          level: 0.5,
        });
        addSine(d, sr, {
          durationSec: 0.55,
          freqHz: 940,
          endFreqHz: 900,
          attackSec: 0.002,
          releaseSec: 0.55,
          curve: 1.8,
          level: 0.35,
        });
        addSine(d, sr, {
          durationSec: 0.55,
          freqHz: 1480,
          endFreqHz: 1420,
          attackSec: 0.003,
          releaseSec: 0.55,
          curve: 2.2,
          level: 0.2,
        });
      }),
    thunk: (ctx) =>
      makeBuffer(ctx, 0.25, (d, sr) => {
        fillNoise(d, sr, {
          durationSec: 0.04,
          lpAlpha: 0.7,
          curve: 2.0,
          level: 0.4,
        });
        addSine(d, sr, {
          durationSec: 0.22,
          freqHz: 540,
          endFreqHz: 500,
          curve: 2.4,
          level: 0.5,
        });
      }),
  },

  ceramic: {
    baseGain: 0.5,
    smash: (ctx) =>
      makeBuffer(ctx, 0.4, (d, sr) => {
        // Bright shatter: high-passed noise burst + airy chirps.
        fillNoise(d, sr, {
          durationSec: 0.32,
          attackSec: 0.001,
          releaseSec: 0.32,
          lpAlpha: 0.95,
          hpAlpha: 0.75,
          curve: 2.6,
          level: 0.75,
        });
        // A few quick high partials suggesting shards.
        addSine(d, sr, {
          durationSec: 0.18,
          freqHz: 2400,
          endFreqHz: 1900,
          attackSec: 0.002,
          releaseSec: 0.18,
          curve: 3.0,
          level: 0.18,
        });
        addSine(d, sr, {
          durationSec: 0.22,
          freqHz: 3100,
          endFreqHz: 2700,
          attackSec: 0.002,
          releaseSec: 0.22,
          curve: 3.5,
          level: 0.14,
        });
      }),
    thunk: (ctx) =>
      makeBuffer(ctx, 0.16, (d, sr) => {
        fillNoise(d, sr, {
          durationSec: 0.12,
          lpAlpha: 0.7,
          hpAlpha: 0.4,
          curve: 3.0,
          level: 0.5,
        });
        addSine(d, sr, {
          durationSec: 0.1,
          freqHz: 1100,
          endFreqHz: 800,
          curve: 3.2,
          level: 0.25,
        });
      }),
  },

  cloth: {
    baseGain: 0.35,
    smash: (ctx) =>
      makeBuffer(ctx, 0.25, (d, sr) => {
        // Soft fabric thump.
        fillNoise(d, sr, {
          durationSec: 0.22,
          attackSec: 0.005,
          releaseSec: 0.22,
          lpAlpha: 0.18,
          curve: 2.4,
          level: 0.55,
        });
        addSine(d, sr, {
          durationSec: 0.12,
          freqHz: 110,
          endFreqHz: 75,
          curve: 2.8,
          level: 0.25,
        });
      }),
    thunk: (ctx) =>
      makeBuffer(ctx, 0.14, (d, sr) => {
        fillNoise(d, sr, {
          durationSec: 0.12,
          lpAlpha: 0.15,
          curve: 2.6,
          level: 0.45,
        });
      }),
  },

  crystal: {
    baseGain: 0.5,
    smash: (ctx) =>
      makeBuffer(ctx, 0.85, (d, sr) => {
        // Bell-like chime: stacked sine partials with long decay.
        fillNoise(d, sr, {
          durationSec: 0.05,
          attackSec: 0.001,
          releaseSec: 0.05,
          lpAlpha: 0.95,
          hpAlpha: 0.6,
          curve: 2.0,
          level: 0.45,
        });
        const fundamental = 1100;
        const partials: Array<[number, number, number]> = [
          // [ratio, level, durationSec]
          [1.0, 0.55, 0.8],
          [2.0, 0.35, 0.7],
          [2.76, 0.25, 0.65],
          [4.05, 0.18, 0.55],
        ];
        for (const [ratio, level, dur] of partials) {
          addSine(d, sr, {
            durationSec: dur,
            freqHz: fundamental * ratio,
            endFreqHz: fundamental * ratio * 0.985,
            attackSec: 0.003,
            releaseSec: dur,
            curve: 1.8,
            level,
          });
        }
      }),
    thunk: (ctx) =>
      makeBuffer(ctx, 0.3, (d, sr) => {
        fillNoise(d, sr, {
          durationSec: 0.04,
          lpAlpha: 0.9,
          hpAlpha: 0.5,
          curve: 2.0,
          level: 0.35,
        });
        addSine(d, sr, {
          durationSec: 0.28,
          freqHz: 1400,
          endFreqHz: 1380,
          attackSec: 0.003,
          releaseSec: 0.28,
          curve: 2.4,
          level: 0.45,
        });
        addSine(d, sr, {
          durationSec: 0.28,
          freqHz: 2200,
          endFreqHz: 2170,
          attackSec: 0.003,
          releaseSec: 0.28,
          curve: 2.8,
          level: 0.2,
        });
      }),
  },
};

// ─────────────────────────────────────────────────────────────────────
// Public play API
// ─────────────────────────────────────────────────────────────────────

/** Reference bbox volume (in units^3) at which sizeFactor = 1.0. Picked
 *  to match a typical small-medium prop (a chest is ~0.7 * 0.5 * 0.4 ≈
 *  0.14 m^3). Values below the reference quiet down toward MIN_FACTOR;
 *  values above lift toward MAX_FACTOR. */
const SIZE_REF_VOLUME = 0.15;
const SIZE_MIN_FACTOR = 0.45;
const SIZE_MAX_FACTOR = 1.85;

export function sizeFactorFromVolume(bboxVolume: number): number {
  if (!Number.isFinite(bboxVolume) || bboxVolume <= 0) return 1;
  // sqrt curve so a 10x bigger prop is only ~3.2x louder, not 10x.
  const raw = Math.sqrt(bboxVolume / SIZE_REF_VOLUME);
  return Math.max(SIZE_MIN_FACTOR, Math.min(SIZE_MAX_FACTOR, raw));
}

function getMasterSfxLevel(): number {
  const audioStore = useAudio.getState();
  const settings = useSettings.getState().audio;
  if (audioStore.isMuted || settings.muted) return 0;
  return Math.max(0, Math.min(1, settings.masterVolume * settings.sfxVolume));
}

function getOrBuildBuffer(
  ctx: AudioContext,
  material: DecorMaterial,
  kind: SmashKind,
): AudioBuffer {
  const key = `${material}|${kind}`;
  let buf = _bufferCache.get(key);
  if (buf) return buf;
  const recipe = RECIPES[material];
  buf = kind === "smash" ? recipe.smash(ctx) : recipe.thunk(ctx);
  _bufferCache.set(key, buf);
  return buf;
}

function playRecipe(
  material: DecorMaterial,
  kind: SmashKind,
  sizeFactor: number,
): void {
  const sfxLevel = getMasterSfxLevel();
  if (sfxLevel <= 0) return;

  const ctx = getCtx();
  if (!ctx) return;
  // Some browsers freeze the context until a user gesture; unblock it
  // lazily on first play. Failure is fine — the play will just be
  // silent until audio is unlocked elsewhere (e.g. by background music).
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => { /* ignore */ });
  }

  const buffer = getOrBuildBuffer(ctx, material, kind);
  const recipe = RECIPES[material];
  const kindGain = kind === "smash" ? 1.0 : 0.55;
  const safeSize = Math.max(SIZE_MIN_FACTOR, Math.min(SIZE_MAX_FACTOR, sizeFactor));
  const gainValue = recipe.baseGain * kindGain * safeSize * sfxLevel;
  if (gainValue <= 0.0005) return;

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  // A little pitch variance so successive smashes don't sound identical.
  // Smashes get a wider window (±8%); thunks stay tighter (±4%) so they
  // still read as the same "tap" repeated.
  const pitchVar = kind === "smash" ? 0.08 : 0.04;
  src.playbackRate.value = 1 + (Math.random() * 2 - 1) * pitchVar;

  const gain = ctx.createGain();
  gain.gain.value = Math.min(1, gainValue);
  src.connect(gain).connect(ctx.destination);
  try {
    src.start();
  } catch {
    /* ignore */
  }
  // Auto-disconnect once the source ends so we don't leak nodes.
  src.onended = () => {
    try { src.disconnect(); } catch { /* ignore */ }
    try { gain.disconnect(); } catch { /* ignore */ }
  };
}

export function playDecorSmash(
  material: DecorMaterial,
  sizeFactor: number = 1,
): void {
  playRecipe(material, "smash", sizeFactor);
}

export function playDecorThunk(
  material: DecorMaterial,
  sizeFactor: number = 1,
): void {
  playRecipe(material, "thunk", sizeFactor);
}
