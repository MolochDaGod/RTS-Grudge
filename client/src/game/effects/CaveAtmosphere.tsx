/**
 * CaveAtmosphere — Volumetric atmosphere shader for cave and dungeon interiors.
 *
 * Adapted from UnderwaterShader.tsx. Instead of water caustics and god rays,
 * this renders:
 *   - Volumetric fog with distance-based density
 *   - Animated dust motes floating in the air
 *   - Ambient glow from crystal/torch light sources
 *   - Color tinting per cave type (void purple, lava orange, mine grey, moss green)
 *
 * Used inside:
 *   - Island cave entrances (MINES elevation band)
 *   - Dungeon instances (all themes)
 *   - Boss arenas (enclosed spaces)
 *   - Ethereal zone void caves
 *
 * Mount as a box volume around the cave interior, similar to UnderwaterVolume.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Cave type presets ────────────────────────────────────────────────────────

export type CaveType = "stone" | "crystal" | "void" | "lava" | "moss" | "ice";

interface CavePreset {
  fogColor: [number, number, number];
  fogDensity: number;
  glowColor: [number, number, number];
  glowIntensity: number;
  dustSpeed: number;
  dustDensity: number;
  dustColor: [number, number, number];
}

const CAVE_PRESETS: Record<CaveType, CavePreset> = {
  stone: {
    fogColor: [0.06, 0.05, 0.04],
    fogDensity: 0.08,
    glowColor: [1.0, 0.7, 0.3],
    glowIntensity: 0.3,
    dustSpeed: 0.2,
    dustDensity: 15.0,
    dustColor: [0.8, 0.7, 0.5],
  },
  crystal: {
    fogColor: [0.02, 0.04, 0.08],
    fogDensity: 0.06,
    glowColor: [0.3, 0.6, 1.0],
    glowIntensity: 0.6,
    dustSpeed: 0.15,
    dustDensity: 20.0,
    dustColor: [0.4, 0.7, 1.0],
  },
  void: {
    fogColor: [0.04, 0.01, 0.06],
    fogDensity: 0.12,
    glowColor: [0.6, 0.1, 0.8],
    glowIntensity: 0.5,
    dustSpeed: 0.3,
    dustDensity: 25.0,
    dustColor: [0.5, 0.2, 0.8],
  },
  lava: {
    fogColor: [0.08, 0.02, 0.01],
    fogDensity: 0.10,
    glowColor: [1.0, 0.4, 0.1],
    glowIntensity: 0.7,
    dustSpeed: 0.4,
    dustDensity: 12.0,
    dustColor: [1.0, 0.5, 0.2],
  },
  moss: {
    fogColor: [0.02, 0.05, 0.02],
    fogDensity: 0.07,
    glowColor: [0.3, 0.8, 0.2],
    glowIntensity: 0.4,
    dustSpeed: 0.1,
    dustDensity: 18.0,
    dustColor: [0.4, 0.9, 0.3],
  },
  ice: {
    fogColor: [0.04, 0.06, 0.10],
    fogDensity: 0.05,
    glowColor: [0.6, 0.8, 1.0],
    glowIntensity: 0.4,
    dustSpeed: 0.08,
    dustDensity: 10.0,
    dustColor: [0.7, 0.9, 1.0],
  },
};

// ── Shader code ──────────────────────────────────────────────────────────────

const CAVE_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vViewDir = normalize(worldPos.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const CAVE_FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uGlowColor;
  uniform float uGlowIntensity;
  uniform float uDustSpeed;
  uniform float uDustDensity;
  uniform vec3 uDustColor;
  uniform vec3 uVolumeMin;
  uniform vec3 uVolumeMax;

  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  // Simple 3D hash for dust particles
  float hash3D(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  // Animated dust motes
  float dustMotes(vec3 pos, float time) {
    float dust = 0.0;
    vec3 p = pos * uDustDensity;

    // Layer 1: slow large motes
    vec3 p1 = p + vec3(time * uDustSpeed * 0.3, time * uDustSpeed * 0.5, time * uDustSpeed * 0.2);
    float d1 = hash3D(floor(p1));
    float fade1 = smoothstep(0.7, 0.75, d1);
    dust += fade1 * 0.6;

    // Layer 2: fast small sparkles
    vec3 p2 = p * 2.3 + vec3(time * uDustSpeed * 0.8, -time * uDustSpeed * 0.4, time * uDustSpeed * 0.6);
    float d2 = hash3D(floor(p2));
    float fade2 = smoothstep(0.85, 0.88, d2);
    dust += fade2 * 0.4;

    // Layer 3: drifting particles
    vec3 p3 = p * 0.7 + vec3(sin(time * 0.2) * 0.5, time * uDustSpeed * 0.15, cos(time * 0.3) * 0.5);
    float d3 = hash3D(floor(p3));
    float fade3 = smoothstep(0.82, 0.85, d3);
    dust += fade3 * 0.3;

    return dust;
  }

  // Distance-based volumetric fog
  float fogFactor(float dist) {
    return 1.0 - exp(-uFogDensity * dist * dist);
  }

  void main() {
    // Distance from camera to fragment (through the volume)
    float dist = length(vWorldPos - cameraPosition);

    // Fog
    float fog = fogFactor(dist);

    // Ambient glow: brighter toward the center of the volume
    vec3 volumeCenter = (uVolumeMin + uVolumeMax) * 0.5;
    vec3 volumeSize = uVolumeMax - uVolumeMin;
    float maxExtent = max(volumeSize.x, max(volumeSize.y, volumeSize.z));
    float distToCenter = length(vWorldPos - volumeCenter) / (maxExtent * 0.5);
    float glow = uGlowIntensity * (1.0 - smoothstep(0.0, 1.0, distToCenter));

    // Pulsing glow
    glow *= 0.8 + 0.2 * sin(uTime * 1.5 + distToCenter * 3.0);

    // Dust particles
    float dust = dustMotes(vWorldPos, uTime);

    // Compose
    vec3 color = uFogColor;
    color += uGlowColor * glow;
    color += uDustColor * dust * 0.15;

    // Alpha: fog density determines visibility
    float alpha = fog * 0.6 + dust * 0.1;
    alpha = clamp(alpha, 0.0, 0.85);

    gl_FragColor = vec4(color, alpha);
  }
`;

// ── React component ──────────────────────────────────────────────────────────

interface CaveAtmosphereProps {
  /** Cave visual preset */
  type?: CaveType;
  /** Center position of the cave volume */
  position?: [number, number, number];
  /** Size of the atmosphere volume [width, height, depth] */
  size?: [number, number, number];
}

export default function CaveAtmosphere({
  type = "stone",
  position = [0, 0, 0],
  size = [40, 10, 40],
}: CaveAtmosphereProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const preset = CAVE_PRESETS[type];

  const volumeMin = useMemo(() =>
    new THREE.Vector3(
      position[0] - size[0] / 2,
      position[1] - size[1] / 2,
      position[2] - size[2] / 2,
    ),
  [position, size]);

  const volumeMax = useMemo(() =>
    new THREE.Vector3(
      position[0] + size[0] / 2,
      position[1] + size[1] / 2,
      position[2] + size[2] / 2,
    ),
  [position, size]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uFogColor: { value: new THREE.Vector3(...preset.fogColor) },
    uFogDensity: { value: preset.fogDensity },
    uGlowColor: { value: new THREE.Vector3(...preset.glowColor) },
    uGlowIntensity: { value: preset.glowIntensity },
    uDustSpeed: { value: preset.dustSpeed },
    uDustDensity: { value: preset.dustDensity },
    uDustColor: { value: new THREE.Vector3(...preset.dustColor) },
    uVolumeMin: { value: volumeMin },
    uVolumeMax: { value: volumeMax },
  }), [preset, volumeMin, volumeMax]);

  useFrame((state) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh position={position} renderOrder={100}>
      <boxGeometry args={size} />
      <shaderMaterial
        ref={matRef}
        vertexShader={CAVE_VERT}
        fragmentShader={CAVE_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/** Get the recommended cave type for a dungeon theme. */
export function getCaveTypeForTheme(theme: string): CaveType {
  switch (theme) {
    case "crypt": return "stone";
    case "mine": return "crystal";
    case "temple": return "moss";
    case "void": return "void";
    case "volcanic": return "lava";
    case "ice": return "ice";
    default: return "stone";
  }
}

/** Get the recommended cave type for a zone's caves. */
export function getCaveTypeForZone(biome: string): CaveType {
  switch (biome) {
    case "lava": return "lava";
    case "snow": return "ice";
    case "jungle": return "moss";
    case "swamp": return "moss";
    case "desert": return "stone";
    case "forest": return "crystal";
    case "mountains": return "crystal";
    case "plains": return "stone";
    case "coast": return "stone";
    default: return "void";
  }
}

export { CAVE_PRESETS };
