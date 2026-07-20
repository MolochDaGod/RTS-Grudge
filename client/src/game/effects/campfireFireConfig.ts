import * as THREE from "three";

/** Tuned for island camps — not the 2000-fire stress demo. */
export const CAMPFIRE_FIRE_CONFIG = {
  maxInstances: 128,
  boxSize: 0.85,
  fireColor: new THREE.Color(1.0, 0.35, 0.05),
  intensity: 1.0,
  opacityMultiplier: 2800,
  animSpeedBase: 1.7,
  animSpeedVariance: 0.3,
  noiseFreqBase: 1.0,
  noiseFreqVariance: 0.2,
  iterations: 24,
  octaves: 3,
  magnitude: 1.3,
  lacunarity: 2.0,
  gain: 0.5,
  noiseScale: new THREE.Vector4(1.0, 2.0, 1.0, 0.3),
  lodDistance: 28,
  animFreezeDistance: 45,
  flameHeightOffset: 0.45,
  textureUrl:
    "https://mattatz.github.io/THREE.Fire/assets/textures/firetex.png",
} as const;