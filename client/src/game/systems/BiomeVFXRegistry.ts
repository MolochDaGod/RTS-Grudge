/**
 * BiomeVFXRegistry — weather + ambient VFX configuration per biome zone.
 *
 * Used by:
 *   - WeatherEvents system (triggers weather changes on zone entry)
 *   - Overworld ambient particle system (persistent ambient effects)
 *
 * Particle counts are conservative for performance; scale up when R2 GPU
 * budget is confirmed.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BiomeId =
  | "plains"
  | "forest"
  | "dark_forest"
  | "snow"
  | "lava"
  | "swamp"
  | "coast"
  | "jungle"
  | "mountains"
  | "desert"
  | "void"
  | "dungeon";

export interface ParticleLayerConfig {
  /** Texture path under client/public/ or CDN URL */
  texture: string;
  /** Particles per second (emitter rate) */
  rate: number;
  /** Particle spread radius around the player (m) */
  spreadRadius: number;
  /** Particle lifetime in seconds */
  lifetime: number;
  /** Size range [min, max] in world units */
  sizeRange: [number, number];
  /** Speed range [min, max] in m/s */
  speedRange: [number, number];
  /** Direction vector (unnormalized — normalized at runtime) */
  direction: [number, number, number];
  /** Opacity [0-1] */
  opacity: number;
  /** Color tint in hex */
  tint: string;
  /** Whether particles cast a shadow (expensive — only for large FX) */
  castShadow?: boolean;
}

export interface BiomeVFXConfig {
  biome: BiomeId;
  /** Human-readable label */
  label: string;

  /** Sky/fog color override (CSS hex) */
  skyColor?: string;
  /** Fog density multiplier (1 = normal, 2 = twice as dense) */
  fogDensity?: number;
  /** Fog near/far in world units */
  fogRange?: [number, number];
  /** Ambient light color hex */
  ambientColor?: string;
  /** Ambient light intensity [0-1] */
  ambientIntensity?: number;

  /** Particle layers — layered on top of each other */
  particles: ParticleLayerConfig[];

  /** Sound ambience track (filename under /audio/ambient/) */
  ambienceTrack?: string;
  /** Ambience volume [0-1] */
  ambienceVolume?: number;

  /** Post-processing vignette strength [0-1] (0 = none) */
  vignetteStrength?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const BIOME_VFX_CONFIG: Record<BiomeId, BiomeVFXConfig> = {

  // ── Plains — calm default ─────────────────────────────────────────────────
  plains: {
    biome: "plains",
    label: "Plains",
    skyColor: "#87ceeb",
    fogDensity: 0.5,
    fogRange: [60, 200],
    ambientColor: "#fff8e8",
    ambientIntensity: 0.7,
    particles: [],
    ambienceTrack: "wind_light.ogg",
    ambienceVolume: 0.25,
  },

  // ── Forest — gentle particle drift + dark canopy ──────────────────────────
  forest: {
    biome: "forest",
    label: "Forest",
    skyColor: "#3a5c2a",
    fogDensity: 1.2,
    fogRange: [20, 80],
    ambientColor: "#446633",
    ambientIntensity: 0.45,
    particles: [
      {
        texture: "/vfx/particles/leaf.png",
        rate: 6,
        spreadRadius: 20,
        lifetime: 8,
        sizeRange: [0.05, 0.15],
        speedRange: [0.2, 0.6],
        direction: [-0.1, -0.8, 0.2],
        opacity: 0.7,
        tint: "#558833",
      },
    ],
    ambienceTrack: "forest_birds.ogg",
    ambienceVolume: 0.4,
  },

  // ── Dark Forest — fog + fireflies ─────────────────────────────────────────
  dark_forest: {
    biome: "dark_forest",
    label: "Dark Forest",
    skyColor: "#0d0d1a",
    fogDensity: 2.5,
    fogRange: [8, 40],
    ambientColor: "#1a1a33",
    ambientIntensity: 0.25,
    vignetteStrength: 0.5,
    particles: [
      {
        texture: "/vfx/particles/fog_wisp.png",
        rate: 4,
        spreadRadius: 25,
        lifetime: 12,
        sizeRange: [0.5, 2.0],
        speedRange: [0.05, 0.2],
        direction: [0.1, 0.0, 0.1],
        opacity: 0.3,
        tint: "#334455",
      },
      {
        texture: "/vfx/particles/firefly.png",
        rate: 3,
        spreadRadius: 15,
        lifetime: 5,
        sizeRange: [0.03, 0.06],
        speedRange: [0.1, 0.4],
        direction: [0, 0.5, 0],
        opacity: 0.9,
        tint: "#88ffcc",
      },
    ],
    ambienceTrack: "dark_forest_eerie.ogg",
    ambienceVolume: 0.5,
  },

  // ── Snow — snowfall particles ─────────────────────────────────────────────
  snow: {
    biome: "snow",
    label: "Snow",
    skyColor: "#c8d8e8",
    fogDensity: 1.8,
    fogRange: [15, 60],
    ambientColor: "#dde8f0",
    ambientIntensity: 0.8,
    particles: [
      {
        texture: "/vfx/particles/snowflake.png",
        rate: 40,
        spreadRadius: 30,
        lifetime: 6,
        sizeRange: [0.02, 0.07],
        speedRange: [0.5, 1.5],
        direction: [-0.1, -1.0, 0.0],
        opacity: 0.8,
        tint: "#eef5ff",
      },
      {
        texture: "/vfx/particles/snow_dust.png",
        rate: 10,
        spreadRadius: 12,
        lifetime: 3,
        sizeRange: [0.3, 0.8],
        speedRange: [0.8, 2.0],
        direction: [0.3, 0.2, 0.0],
        opacity: 0.3,
        tint: "#ffffff",
      },
    ],
    ambienceTrack: "snow_wind.ogg",
    ambienceVolume: 0.6,
  },

  // ── Lava — embers + heat shimmer ─────────────────────────────────────────
  lava: {
    biome: "lava",
    label: "Lava Fields",
    skyColor: "#331100",
    fogDensity: 1.5,
    fogRange: [10, 50],
    ambientColor: "#cc4400",
    ambientIntensity: 0.9,
    vignetteStrength: 0.3,
    particles: [
      {
        texture: "/vfx/particles/ember.png",
        rate: 25,
        spreadRadius: 20,
        lifetime: 4,
        sizeRange: [0.03, 0.10],
        speedRange: [1.0, 3.5],
        direction: [0.1, 1.0, 0.1],
        opacity: 0.9,
        tint: "#ff6600",
        castShadow: false,
      },
      {
        texture: "/vfx/particles/heat_shimmer.png",
        rate: 8,
        spreadRadius: 15,
        lifetime: 2,
        sizeRange: [0.8, 2.5],
        speedRange: [0.3, 0.8],
        direction: [0, 1, 0],
        opacity: 0.15,
        tint: "#ff8800",
      },
    ],
    ambienceTrack: "lava_rumble.ogg",
    ambienceVolume: 0.7,
  },

  // ── Swamp — thick fog + fireflies ────────────────────────────────────────
  swamp: {
    biome: "swamp",
    label: "Swamp",
    skyColor: "#223320",
    fogDensity: 3.0,
    fogRange: [5, 30],
    ambientColor: "#223322",
    ambientIntensity: 0.35,
    vignetteStrength: 0.4,
    particles: [
      {
        texture: "/vfx/particles/fog_wisp.png",
        rate: 8,
        spreadRadius: 20,
        lifetime: 10,
        sizeRange: [1.0, 3.5],
        speedRange: [0.05, 0.15],
        direction: [0.05, 0.0, 0.05],
        opacity: 0.5,
        tint: "#336633",
      },
      {
        texture: "/vfx/particles/firefly.png",
        rate: 5,
        spreadRadius: 18,
        lifetime: 4,
        sizeRange: [0.04, 0.08],
        speedRange: [0.15, 0.5],
        direction: [0, 0.3, 0],
        opacity: 0.85,
        tint: "#aaffaa",
      },
    ],
    ambienceTrack: "swamp_insects.ogg",
    ambienceVolume: 0.55,
  },

  // ── Coast — sea spray + wind ──────────────────────────────────────────────
  coast: {
    biome: "coast",
    label: "Coast",
    skyColor: "#6ab4cc",
    fogDensity: 0.6,
    fogRange: [40, 160],
    ambientColor: "#aaccdd",
    ambientIntensity: 0.75,
    particles: [
      {
        texture: "/vfx/particles/sea_spray.png",
        rate: 12,
        spreadRadius: 25,
        lifetime: 3,
        sizeRange: [0.05, 0.2],
        speedRange: [1.5, 4.0],
        direction: [0.5, 0.3, 0.0],
        opacity: 0.6,
        tint: "#ccefff",
      },
    ],
    ambienceTrack: "ocean_waves.ogg",
    ambienceVolume: 0.5,
  },

  // ── Jungle — rain + mist ──────────────────────────────────────────────────
  jungle: {
    biome: "jungle",
    label: "Jungle",
    skyColor: "#2d4a20",
    fogDensity: 1.4,
    fogRange: [12, 55],
    ambientColor: "#3a5a28",
    ambientIntensity: 0.5,
    particles: [
      {
        texture: "/vfx/particles/raindrop.png",
        rate: 80,
        spreadRadius: 20,
        lifetime: 1.5,
        sizeRange: [0.01, 0.04],
        speedRange: [4.0, 8.0],
        direction: [-0.05, -1.0, 0.0],
        opacity: 0.5,
        tint: "#aaccff",
      },
      {
        texture: "/vfx/particles/mist.png",
        rate: 5,
        spreadRadius: 22,
        lifetime: 8,
        sizeRange: [1.5, 4.0],
        speedRange: [0.05, 0.2],
        direction: [0, 0.1, 0],
        opacity: 0.25,
        tint: "#88aa88",
      },
    ],
    ambienceTrack: "jungle_rain.ogg",
    ambienceVolume: 0.65,
  },

  // ── Mountains — wind gusts ────────────────────────────────────────────────
  mountains: {
    biome: "mountains",
    label: "Mountains",
    skyColor: "#8898b8",
    fogDensity: 0.8,
    fogRange: [30, 120],
    ambientColor: "#aab0c0",
    ambientIntensity: 0.65,
    particles: [
      {
        texture: "/vfx/particles/snow_dust.png",
        rate: 20,
        spreadRadius: 30,
        lifetime: 5,
        sizeRange: [0.1, 0.4],
        speedRange: [2.0, 6.0],
        direction: [1.0, 0.1, 0.0],
        opacity: 0.4,
        tint: "#ddeeff",
      },
    ],
    ambienceTrack: "mountain_wind.ogg",
    ambienceVolume: 0.7,
  },

  // ── Desert — dust + heat shimmer ─────────────────────────────────────────
  desert: {
    biome: "desert",
    label: "Desert",
    skyColor: "#e8c880",
    fogDensity: 0.7,
    fogRange: [25, 100],
    ambientColor: "#ddbb66",
    ambientIntensity: 1.0,
    particles: [
      {
        texture: "/vfx/particles/dust.png",
        rate: 15,
        spreadRadius: 25,
        lifetime: 6,
        sizeRange: [0.2, 0.8],
        speedRange: [0.5, 2.0],
        direction: [0.3, 0.1, 0.1],
        opacity: 0.35,
        tint: "#ddbb88",
      },
    ],
    ambienceTrack: "desert_wind.ogg",
    ambienceVolume: 0.45,
  },

  // ── Void — dark portal energy ─────────────────────────────────────────────
  void: {
    biome: "void",
    label: "The Void",
    skyColor: "#050010",
    fogDensity: 2.0,
    fogRange: [8, 35],
    ambientColor: "#110033",
    ambientIntensity: 0.2,
    vignetteStrength: 0.7,
    particles: [
      {
        texture: "/vfx/particles/void_mote.png",
        rate: 20,
        spreadRadius: 25,
        lifetime: 6,
        sizeRange: [0.05, 0.2],
        speedRange: [0.3, 1.5],
        direction: [0, 1, 0],
        opacity: 0.8,
        tint: "#8800ff",
      },
    ],
    ambienceTrack: "void_hum.ogg",
    ambienceVolume: 0.8,
  },

  // ── Dungeon — damp + torch flicker ────────────────────────────────────────
  dungeon: {
    biome: "dungeon",
    label: "Dungeon",
    skyColor: "#0a0805",
    fogDensity: 1.8,
    fogRange: [6, 30],
    ambientColor: "#331100",
    ambientIntensity: 0.3,
    vignetteStrength: 0.45,
    particles: [
      {
        texture: "/vfx/particles/dust.png",
        rate: 3,
        spreadRadius: 8,
        lifetime: 5,
        sizeRange: [0.03, 0.10],
        speedRange: [0.1, 0.3],
        direction: [0.0, 0.5, 0.0],
        opacity: 0.3,
        tint: "#886644",
      },
    ],
    ambienceTrack: "dungeon_drip.ogg",
    ambienceVolume: 0.4,
  },
};

/** Get VFX config for a biome. Falls back to plains if unknown. */
export function getBiomeVFX(biome: BiomeId | string): BiomeVFXConfig {
  return BIOME_VFX_CONFIG[biome as BiomeId] ?? BIOME_VFX_CONFIG.plains;
}
