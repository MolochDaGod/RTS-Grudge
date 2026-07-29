import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * SeaSurface — Tactical Infinity / Warlords production water.
 *
 * Full port of TI `SeascapeOcean` (Alexander Alekseev / TDM 2014, CC BY-NC-SA
 * 3.0 — Shadertoy Ms2SD1):
 *   • Vertex stage: ITER_GEOMETRY=3 octaves — real mesh displacement (not flat R3F plane)
 *   • Fragment stage: ITER_FRAGMENT=5 octaves normals + fresnel + Beer tint + specular
 *
 * Physics/swim colliders still use `WATER_SURFACE_Y` in WaterVolume — they stay
 * at a constant Y. Visual waves only move the mesh so the surface reads as
 * TI open water instead of a flat translucent slab.
 *
 * Prefer this over @react-three/drei `Water` / mesh-reflector hacks.
 */

// ── Seascape vertex (matches Tactical-Infinity islandsCanonical/SeascapeOcean) ─
const VERT = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uHeight;
  uniform float uChoppy;
  uniform float uFreq;
  uniform float uSpeed;

  varying vec3 vWorldPos;
  varying vec2 vSeaUv;

  const int ITER_GEOMETRY = 3;
  const mat2 OCTAVE_M = mat2(1.6, 1.2, -1.2, 1.6);

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return -1.0 + 2.0 * mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float seaOctave(vec2 uv, float choppy) {
    uv += noise(uv);
    vec2 wv  = 1.0 - abs(sin(uv));
    vec2 swv = abs(cos(uv));
    wv = mix(wv, swv, wv);
    return pow(abs(1.0 - pow(abs(wv.x * wv.y), 0.65)), choppy);
  }

  float seaHeight(vec2 worldXz) {
    float freq = uFreq;
    float amp = uHeight;
    float choppy = uChoppy;
    float seaTime = 1.0 + uTime * uSpeed;
    vec2 uv = worldXz;
    uv.x *= 0.75;
    float h = 0.0;
    for (int i = 0; i < ITER_GEOMETRY; i++) {
      float d  = seaOctave((uv + seaTime) * freq, choppy);
            d += seaOctave((uv - seaTime) * freq, choppy);
      h  += d * amp;
      uv  *= OCTAVE_M;
      freq *= 1.9;
      amp  *= 0.22;
      choppy = mix(choppy, 1.0, 0.2);
    }
    return h;
  }

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float h = seaHeight(wp.xz);
    wp.y += h;
    vWorldPos = wp.xyz;
    vSeaUv = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// ── Seascape fragment ─────────────────────────────────────────────────
const FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3  uSeaBase;
  uniform vec3  uSeaTint;
  uniform vec3  uSkyTint;
  uniform vec3  uSunDir;
  uniform vec3  uCameraPos;
  uniform float uOpacity;
  uniform float uChoppy;
  uniform float uHeight;
  uniform float uFreq;
  uniform float uSpeed;

  varying vec3 vWorldPos;
  varying vec2 vSeaUv;

  const int ITER_FRAGMENT = 5;
  const mat2 OCTAVE_M = mat2(1.6, 1.2, -1.2, 1.6);

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return -1.0 + 2.0 * mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float seaOctave(vec2 uv, float choppy) {
    uv += noise(uv);
    vec2 wv  = 1.0 - abs(sin(uv));
    vec2 swv = abs(cos(uv));
    wv = mix(wv, swv, wv);
    return pow(abs(1.0 - pow(abs(wv.x * wv.y), 0.65)), choppy);
  }

  float mapDetailed(vec3 p) {
    float freq = uFreq;
    float amp = uHeight;
    float choppy = uChoppy;
    float seaTime = 1.0 + uTime * uSpeed;
    vec2 uv = p.xz;
    uv.x *= 0.75;
    float h = 0.0;
    for (int i = 0; i < ITER_FRAGMENT; i++) {
      float d  = seaOctave((uv + seaTime) * freq, choppy);
            d += seaOctave((uv - seaTime) * freq, choppy);
      h  += d * amp;
      uv  *= OCTAVE_M;
      freq *= 1.9;
      amp  *= 0.22;
      choppy = mix(choppy, 1.0, 0.2);
    }
    return p.y - h;
  }

  vec3 getNormal(vec3 p, float eps) {
    vec3 n;
    n.y = mapDetailed(p);
    n.x = mapDetailed(vec3(p.x + eps, p.y, p.z)) - n.y;
    n.z = mapDetailed(vec3(p.x, p.y, p.z + eps)) - n.y;
    n.y = eps;
    return normalize(n);
  }

  float diffuseTerm(vec3 n, vec3 l, float p) {
    return pow(abs(dot(n, l) * 0.4 + 0.6), p);
  }

  float specularTerm(vec3 n, vec3 l, vec3 e, float s) {
    float nrm = (s + 8.0) / (3.1415 * 8.0);
    return pow(abs(max(dot(reflect(e, n), l), 0.0)), s) * nrm;
  }

  vec3 skyTint(vec3 e) {
    e.y = max(e.y, 0.0);
    vec3 ret;
    ret.x = pow(1.0 - e.y, 2.0);
    ret.y = 1.0 - e.y;
    ret.z = 0.6 + (1.0 - e.y) * 0.4;
    return mix(ret, uSkyTint, 0.4);
  }

  vec3 getSeaColor(vec3 p, vec3 n, vec3 l, vec3 eye, vec3 dist) {
    float fresnel = 1.0 - max(dot(n, -eye), 0.0);
    fresnel = pow(abs(fresnel), 3.0) * 0.65;
    vec3 reflected = skyTint(reflect(eye, n));
    vec3 refracted = uSeaBase + diffuseTerm(n, l, 80.0) * uSeaTint * 0.12;
    vec3 color = mix(refracted, reflected, fresnel);
    float atten = max(1.0 - dot(dist, dist) * 0.001, 0.0);
    color += uSeaTint * (p.y - uHeight) * 0.18 * atten;
    color += vec3(specularTerm(n, l, eye, 60.0));
    return color;
  }

  void main() {
    vec3 eye  = normalize(vWorldPos - uCameraPos);
    vec3 dist = vWorldPos - uCameraPos;
    float epsNrm = max(0.0008, 0.0006 * length(dist));
    vec3 n = getNormal(vWorldPos, epsNrm);
    vec3 light = normalize(uSunDir);
    vec3 col = getSeaColor(vWorldPos, n, light, eye, dist);
    col = pow(abs(col), vec3(0.75));
    gl_FragColor = vec4(col, uOpacity);
  }
`;

export interface SeaSurfaceProps {
  /** World-space size of the water plane (units). */
  size: number;
  /** Base Y of the water surface (physics still uses WaterVolume constant). */
  y: number;
  /** Optional XZ offset (defaults to scene origin). */
  centerXZ?: [number, number];
  /**
   * Subdivisions — TI uses dense grids so vertex waves read as real ocean.
   * Default 128 (was 1 flat slab). Lower for tiny shallow shelves.
   */
  segments?: number;
  /** Render double-sided so swimmers see the underside. */
  doubleSided?: boolean;
  /** Surface alpha (0..1). TI open ocean is opaque (1.0). */
  opacity?: number;
  /** Deep-water base. TI default teal-base. */
  seaBase?: THREE.ColorRepresentation;
  /** Sub-surface scatter / foam tint (maps to TI uSeaTint). */
  seaWaterColor?: THREE.ColorRepresentation;
  /** Sky reflection mix (TI uSkyTint). */
  skyTint?: THREE.ColorRepresentation;
  /** Sun direction for diffuse + specular. */
  lightDir?: [number, number, number];
  /** Wave choppiness (1..6). TI default 4. */
  choppy?: number;
  /** Wave amplitude. TI default 0.6. */
  height?: number;
  /** Wave base frequency. TI default 0.16. */
  freq?: number;
  /** Wave time scale. TI default 0.8. */
  speed?: number;
  /** Render order. */
  renderOrder?: number;
}

export function SeaSurface({
  size,
  y,
  centerXZ = [0, 0],
  segments = 128,
  doubleSided = false,
  opacity = 1.0,
  seaBase = "#1a3038",
  seaWaterColor = "#ccd692",
  skyTint = "#8cb2f2",
  lightDir = [0.2, 1, 0.4],
  choppy = 4.0,
  height = 0.6,
  freq = 0.16,
  speed = 0.8,
  renderOrder,
}: SeaSurfaceProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { camera } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeaBase: { value: new THREE.Color(seaBase) },
      uSeaTint: { value: new THREE.Color(seaWaterColor) },
      uSkyTint: { value: new THREE.Color(skyTint) },
      uSunDir: { value: new THREE.Vector3(...lightDir).normalize() },
      uCameraPos: { value: new THREE.Vector3() },
      uOpacity: { value: opacity },
      uChoppy: { value: choppy },
      uHeight: { value: height },
      uFreq: { value: freq },
      uSpeed: { value: speed },
    }),
    [seaBase, seaWaterColor, skyTint, lightDir, opacity, choppy, height, freq, speed],
  );

  useFrame((state, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value += delta;
    (mat.uniforms.uCameraPos.value as THREE.Vector3).copy(camera.position);
    // Keep sun/time stable if props change via HMR
    void state;
  });

  // Dense grid required for vertex wave displacement (TI SeascapeOcean).
  const segs = Math.max(16, Math.min(256, segments | 0));

  return (
    <mesh
      name="SeascapeOcean"
      position={[centerXZ[0], y, centerXZ[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={renderOrder}
      frustumCulled={false}
      receiveShadow
    >
      <planeGeometry args={[size, size, segs, segs]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent={opacity < 0.999}
        depthWrite={opacity >= 0.999}
        side={doubleSided ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  );
}
