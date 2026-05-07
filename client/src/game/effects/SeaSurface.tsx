import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * SeaSurface — top-of-water shader for all open ocean surfaces in the game.
 *
 * Port of "Seascape" by Alexander Alekseev / TDM (2014, CC BY-NC-SA 3.0,
 * https://www.shadertoy.com/view/Ms2SD1) adapted from the original screen-space
 * raymarching demo to a flat horizontal plane. The plane geometry stays flat
 * (so swim/walk colliders are unaffected); all wave detail comes from the
 * fragment shader sampling the same height field at each fragment's world XZ
 * to derive a per-pixel normal, then doing fresnel + sky reflection +
 * specular + depth tint exactly like the original.
 *
 * Use ONE of these per scene as the visible top water layer. The companion
 * UnderwaterShader handles the volume below the surface.
 */

const VERT = /* glsl */ `
  varying vec3 vWorldPos;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3  uSeaBase;
  uniform vec3  uSeaWaterColor;
  uniform vec3  uLightDir;
  uniform float uOpacity;
  uniform float uChoppy;
  uniform float uHeight;
  uniform float uFreq;
  uniform float uSpeed;

  varying vec3 vWorldPos;

  // ----- Seascape constants (from Alexander Alekseev / TDM 2014) -----
  const int ITER_FRAGMENT = 5;
  const mat2 OCTAVE_M = mat2(1.6, 1.2, -1.2, 1.6);

  // ----- noise primitives -----
  float hash(vec2 p) {
    float h = dot(p, vec2(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
  }

  float noise(in vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return -1.0 + 2.0 * mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // ----- shading helpers -----
  float diffuseTerm(vec3 n, vec3 l, float p) {
    return pow(abs(dot(n, l) * 0.4 + 0.6), p);
  }

  float specularTerm(vec3 n, vec3 l, vec3 e, float s) {
    float nrm = (s + 8.0) / (3.1415 * 8.0);
    return pow(abs(max(dot(reflect(e, n), l), 0.0)), s) * nrm;
  }

  // Original sky function — used for water reflection only (the actual sky
  // dome of each scene is unchanged; this just tints what the water mirrors).
  vec3 getSkyColor(vec3 e) {
    e.y = max(e.y, 0.0);
    vec3 ret;
    ret.x = pow(1.0 - e.y, 2.0);
    ret.y = 1.0 - e.y;
    ret.z = 0.6 + (1.0 - e.y) * 0.4;
    return ret;
  }

  // ----- height field -----
  float seaOctave(vec2 uv, float choppy) {
    uv += noise(uv);
    vec2 wv  = 1.0 - abs(sin(uv));
    vec2 swv = abs(cos(uv));
    wv = mix(wv, swv, wv);
    return pow(abs(1.0 - pow(abs(wv.x * wv.y), 0.65)), choppy);
  }

  // Returns the wave height at world XZ. (Original demo returned p.y minus h
  // for raymarching; here we compute h directly so the caller can both shade
  // and use the height value for the depth-tint term.)
  float waveHeight(vec2 worldXZ, float seaTime) {
    float freq   = uFreq;
    float amp    = uHeight;
    float choppy = uChoppy;
    vec2 uv = worldXZ; uv.x *= 0.75;

    float d, h = 0.0;
    for (int i = 0; i < ITER_FRAGMENT; i++) {
      d  = seaOctave((uv + seaTime) * freq, choppy);
      d += seaOctave((uv - seaTime) * freq, choppy);
      h += d * amp;
      uv = OCTAVE_M * uv; freq *= 1.9; amp *= 0.22;
      choppy = mix(choppy, 1.0, 0.2);
    }
    return h;
  }

  // Finite-difference normal — equivalent to the original's getNormal but
  // built from the explicit waveHeight() helper.
  vec3 getNormal(vec3 p, float eps, float seaTime) {
    float h0 = waveHeight(p.xz, seaTime);
    float hx = waveHeight(p.xz + vec2(eps, 0.0), seaTime);
    float hz = waveHeight(p.xz + vec2(0.0, eps), seaTime);
    // Original packs the inverted heights into n then sets n.y = eps; the
    // sign convention here matches getSeaColor's fresnel use of -eye.
    return normalize(vec3(h0 - hx, eps, h0 - hz));
  }

  vec3 getSeaColor(vec3 p, vec3 n, vec3 l, vec3 eye, vec3 dist, float waveH) {
    float fresnel = 1.0 - max(dot(n, -eye), 0.0);
    fresnel = pow(abs(fresnel), 3.0) * 0.65;

    vec3 reflected = getSkyColor(reflect(eye, n));
    vec3 refracted = uSeaBase + diffuseTerm(n, l, 80.0) * uSeaWaterColor * 0.12;

    vec3 color = mix(refracted, reflected, fresnel);

    // Depth tint -- in the original demo p.y was the raymarched wave
    // height, so this term varies across the surface. Our p is the flat
    // plane, so we feed in the sampled wave height explicitly.
    float atten = max(1.0 - dot(dist, dist) * 0.001, 0.0);
    color += uSeaWaterColor * (waveH - uHeight) * 0.18 * atten;

    color += vec3(specularTerm(n, l, eye, 60.0));

    return color;
  }

  void main() {
    float seaTime = 1.0 + uTime * uSpeed;

    // The fragment IS the (flat) surface point. Sample the wave height at
    // its XZ so the depth-tint term in getSeaColor varies across the surface
    // exactly like the original demo (where p.y was the raymarched wave
    // height). Geometry stays flat so colliders aren't disturbed.
    vec3 p     = vWorldPos;
    float waveH = waveHeight(p.xz, seaTime);
    vec3 dist  = p - cameraPosition;
    vec3 eye   = normalize(dist);

    // Distance-scaled normal epsilon (matches the original demo's intent).
    float eps = max(dot(dist, dist) * (0.1 / 1024.0), 0.001);

    vec3 n     = getNormal(p, eps, seaTime);
    vec3 light = normalize(uLightDir);
    vec3 color = getSeaColor(p, n, light, eye, dist, waveH);

    // Original tone curve.
    color = pow(abs(color), vec3(0.75));

    gl_FragColor = vec4(color, uOpacity);
  }
`;

export interface SeaSurfaceProps {
  /** World-space size of the water plane (units). */
  size: number;
  /** Y position of the water surface in world space. */
  y: number;
  /** Optional XZ offset (defaults to scene origin). */
  centerXZ?: [number, number];
  /** Plane subdivisions. 1 is fine — waves come from the shader, not vertices. */
  segments?: number;
  /** Render double-sided so swimmers see the water from below. */
  doubleSided?: boolean;
  /** Surface alpha (0..1). */
  opacity?: number;
  /** Deep-water base color. Defaults to Seascape's original (0.1, 0.19, 0.22). */
  seaBase?: THREE.ColorRepresentation;
  /** Sub-surface scatter / foam tint. Defaults to Seascape's original (0.8, 0.9, 0.6). */
  seaWaterColor?: THREE.ColorRepresentation;
  /** Sun direction for diffuse + specular. Defaults to (0, 1, 0.8) like the demo. */
  lightDir?: [number, number, number];
  /** Wave choppiness multiplier (1..6). Default 4. */
  choppy?: number;
  /** Wave amplitude in world units. Default 0.6. */
  height?: number;
  /** Wave base frequency. Default 0.16. */
  freq?: number;
  /** Wave time scale. Default 0.8. */
  speed?: number;
  /** Render order (water typically draws after solids). */
  renderOrder?: number;
}

export function SeaSurface({
  size,
  y,
  centerXZ = [0, 0],
  segments = 1,
  doubleSided = true,
  opacity = 0.85,
  seaBase = "#1a3038",
  seaWaterColor = "#ccd692",
  lightDir = [0, 1, 0.8],
  choppy = 4.0,
  height = 0.6,
  freq = 0.16,
  speed = 0.8,
  renderOrder,
}: SeaSurfaceProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeaBase: { value: new THREE.Color(seaBase) },
      uSeaWaterColor: { value: new THREE.Color(seaWaterColor) },
      uLightDir: { value: new THREE.Vector3(...lightDir) },
      uOpacity: { value: opacity },
      uChoppy: { value: choppy },
      uHeight: { value: height },
      uFreq: { value: freq },
      uSpeed: { value: speed },
    }),
    // Defaults are stable between renders; per-scene props feed in via the
    // explicit deps below so changing them in HMR / settings updates live.
    [seaBase, seaWaterColor, lightDir, opacity, choppy, height, freq, speed]
  );

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh
      position={[centerXZ[0], y, centerXZ[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={renderOrder}
    >
      <planeGeometry args={[size, size, segments, segments]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent={opacity < 1.0}
        depthWrite={opacity >= 1.0}
        side={doubleSided ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  );
}
