export interface OceanColorPreset {
  id: string;
  name: string;
  waterColor: number;
  waterColorDeep: number;
  sunColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  distortionScale: number;
  alpha: number;
  secondaryOpacity: number;
  underwaterVisibility: number;
  causticIntensity: number;
  foamColor: number;
  waveHeight: number;
  waveSpeed: number;
}

export const OCEAN_PRESETS: Record<string, OceanColorPreset> = {
  tropical: {
    id: 'tropical',
    name: 'Tropical Paradise',
    waterColor: 0x00ccff,
    waterColorDeep: 0x006699,
    sunColor: 0xfffacd,
    fogColor: 0x87ceeb,
    fogNear: 200,
    fogFar: 2000,
    distortionScale: 1.5,
    alpha: 0.6,
    secondaryOpacity: 0.12,
    underwaterVisibility: 40,
    causticIntensity: 0.8,
    foamColor: 0xffffff,
    waveHeight: 0.8,
    waveSpeed: 1.0,
  },
  caribbean: {
    id: 'caribbean',
    name: 'Caribbean Clear',
    waterColor: 0x40e0d0,
    waterColorDeep: 0x20b2aa,
    sunColor: 0xfff8dc,
    fogColor: 0xadd8e6,
    fogNear: 300,
    fogFar: 2500,
    distortionScale: 1.2,
    alpha: 0.55,
    secondaryOpacity: 0.1,
    underwaterVisibility: 50,
    causticIntensity: 0.9,
    foamColor: 0xf0ffff,
    waveHeight: 0.6,
    waveSpeed: 0.8,
  },
  deepOcean: {
    id: 'deepOcean',
    name: 'Deep Ocean',
    waterColor: 0x1a4a6e,
    waterColorDeep: 0x0a2a4e,
    sunColor: 0xffeedd,
    fogColor: 0x4682b4,
    fogNear: 100,
    fogFar: 1500,
    distortionScale: 2.5,
    alpha: 0.75,
    secondaryOpacity: 0.18,
    underwaterVisibility: 25,
    causticIntensity: 0.4,
    foamColor: 0xe0e0e0,
    waveHeight: 1.5,
    waveSpeed: 1.2,
  },
  stormy: {
    id: 'stormy',
    name: 'Stormy Seas',
    waterColor: 0x2f4f4f,
    waterColorDeep: 0x1a2a2a,
    sunColor: 0xc0c0c0,
    fogColor: 0x696969,
    fogNear: 50,
    fogFar: 800,
    distortionScale: 4.0,
    alpha: 0.85,
    secondaryOpacity: 0.25,
    underwaterVisibility: 15,
    causticIntensity: 0.2,
    foamColor: 0xd3d3d3,
    waveHeight: 3.0,
    waveSpeed: 2.0,
  },
  arctic: {
    id: 'arctic',
    name: 'Arctic Waters',
    waterColor: 0x4a90b0,
    waterColorDeep: 0x2a5070,
    sunColor: 0xf0f8ff,
    fogColor: 0xb0c4de,
    fogNear: 150,
    fogFar: 1800,
    distortionScale: 1.8,
    alpha: 0.65,
    secondaryOpacity: 0.15,
    underwaterVisibility: 35,
    causticIntensity: 0.6,
    foamColor: 0xf5fffa,
    waveHeight: 1.2,
    waveSpeed: 0.9,
  },
  sunset: {
    id: 'sunset',
    name: 'Golden Sunset',
    waterColor: 0x2e8b8b,
    waterColorDeep: 0x1a5050,
    sunColor: 0xffa500,
    fogColor: 0xff7f50,
    fogNear: 180,
    fogFar: 2200,
    distortionScale: 2.0,
    alpha: 0.58,
    secondaryOpacity: 0.14,
    underwaterVisibility: 38,
    causticIntensity: 0.7,
    foamColor: 0xffefd5,
    waveHeight: 0.9,
    waveSpeed: 0.85,
  },
  mystical: {
    id: 'mystical',
    name: 'Mystical Depths',
    waterColor: 0x4169e1,
    waterColorDeep: 0x191970,
    sunColor: 0xe6e6fa,
    fogColor: 0x9370db,
    fogNear: 100,
    fogFar: 1200,
    distortionScale: 2.2,
    alpha: 0.7,
    secondaryOpacity: 0.2,
    underwaterVisibility: 30,
    causticIntensity: 0.5,
    foamColor: 0xdda0dd,
    waveHeight: 1.0,
    waveSpeed: 0.7,
  },
  bioluminescent: {
    id: 'bioluminescent',
    name: 'Bioluminescent Night',
    waterColor: 0x001a33,
    waterColorDeep: 0x000a15,
    sunColor: 0x4a5568,
    fogColor: 0x1a1a2e,
    fogNear: 80,
    fogFar: 600,
    distortionScale: 1.0,
    alpha: 0.8,
    secondaryOpacity: 0.08,
    underwaterVisibility: 20,
    causticIntensity: 0.1,
    foamColor: 0x00ffff,
    waveHeight: 0.5,
    waveSpeed: 0.5,
  },
};

export const DEFAULT_OCEAN_PRESET = 'caribbean';

export interface FishingConfig {
  rodCastDistance: number;
  lineStrength: number;
  hookSize: number;
  baitDecayRate: number;
  catchDifficulty: number;
  reelSpeed: number;
  tensionThreshold: number;
  minigameEnabled: boolean;
  autoReel: boolean;
  showFishNames: boolean;
  highlightNearbyFish: boolean;
  soundEffects: boolean;
}

export const DEFAULT_FISHING_CONFIG: FishingConfig = {
  rodCastDistance: 30,
  lineStrength: 100,
  hookSize: 1.0,
  baitDecayRate: 0.1,
  catchDifficulty: 1.0,
  reelSpeed: 1.0,
  tensionThreshold: 80,
  minigameEnabled: true,
  autoReel: false,
  showFishNames: true,
  highlightNearbyFish: true,
  soundEffects: true,
};

export interface PlayerModelConfig {
  modelUrl: string;
  scale: number;
  rotationOffset: { x: number; y: number; z: number };
  animations: {
    idle?: string;
    walk?: string;
    run?: string;
    swim?: string;
    cast?: string;
    reel?: string;
    attack?: string;
    death?: string;
  };
  hitboxRadius: number;
  hitboxHeight: number;
}

export const SUPPORTED_MODEL_FORMATS = ['glb', 'gltf'] as const;
export type SupportedModelFormat = typeof SUPPORTED_MODEL_FORMATS[number];

export function getModelFormat(url: string): SupportedModelFormat | null {
  const ext = url.split('.').pop()?.toLowerCase();
  if (ext === 'glb' || ext === 'gltf') return ext as SupportedModelFormat;
  return null;
}
