import * as THREE from 'three';

/**
 * OCEAN SHADER — Tethical
 * ───────────────────────
 * Two layers of motion:
 *
 *   1. GEOMETRIC SWELL (vertex):  6-wave Gerstner system pushes the plane
 *      around for actual silhouette. Six octaves: 150m/75m/55m/35m/22m/200m.
 *
 *   2. SURFACE LIFE (fragment):  inspired by P_Malin's "Where the River Goes"
 *      (Shadertoy Xl2XRW, MIT) — dual time-blended FBM-with-derivatives.
 *      Two phase-offset octaves of value-noise-with-analytic-derivative are
 *      cross-faded against a 0..1 sawtooth so the surface NEVER time-loops.
 *      Foam is generated from a *flow magnitude* term, not from raw elevation,
 *      so the surface stops looking like a repeating white pattern.
 *
 *   3. BEER-LAMBERT WATER EXTINCTION:  warm-tinted absorption coefficient
 *      gives the water its depth-dependent colour shift instead of a flat
 *      blend between two colour constants.
 *
 *   4. SCHLICK FRESNEL + GGX SPECULAR:  physically based highlights, with
 *      sky reflection mixed into the long-distance horizon.
 */

// ─────────────────────────────────────────────────────────────────────────────
// VERTEX
// ─────────────────────────────────────────────────────────────────────────────
export const oceanVertexShader = `
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveFrequency;
uniform vec3  uWindDirection;
uniform float uWindStrength;
uniform float uStormIntensity;

varying vec3  vWorldPosition;
varying vec3  vNormal;
varying float vElevation;
varying vec2  vUv;
varying vec2  vCrestGrad;     // gradient of total wave height (for foam)
varying vec3  vViewDir;

#define PI 3.14159265359

vec3 gerstner(vec2 pos, float steepness, float wavelength, vec2 dir, float t) {
  float k  = 2.0 * PI / wavelength;
  float c  = sqrt(9.81 / k);
  vec2  d  = normalize(dir);
  float f  = k * (dot(d, pos) - c * t);
  float a  = steepness / k;
  return vec3(d.x * a * cos(f),
              a * sin(f),
              d.y * a * cos(f));
}
float gerstnerY(vec2 pos, float steepness, float wavelength, vec2 dir, float t) {
  float k  = 2.0 * PI / wavelength;
  float c  = sqrt(9.81 / k);
  vec2  d  = normalize(dir);
  float f  = k * (dot(d, pos) - c * t);
  return (steepness / k) * sin(f);
}

void main() {
  vUv = uv;

  vec2 windDir  = normalize(uWindDirection.xz + vec2(0.0001));
  vec2 crossDir = vec2(-windDir.y, windDir.x);

  float wh    = uWaveHeight;
  float storm = uStormIntensity;

  // Six Gerstner octaves — same recipe, slightly toned-down chop steepness so
  // the foam pass below has actual structure to grab onto instead of a flat
  // white scream across the whole surface.
  vec3 w1 = gerstner(position.xz, wh*0.055, 150.0, windDir,                                uTime*0.62);
  vec3 w2 = gerstner(position.xz, wh*0.070,  75.0, windDir*0.9 + crossDir*0.2,             uTime*0.85);
  vec3 w3 = gerstner(position.xz, wh*0.045,  55.0, crossDir*0.8 + windDir*0.1,             uTime*0.74);
  vec3 w4 = gerstner(position.xz, wh*0.075,  35.0, windDir*0.95 + crossDir*0.3,            uTime*1.05);
  vec3 w5 = gerstner(position.xz, wh*0.055,  22.0, -crossDir*0.7 + windDir*0.3,            uTime*1.28);
  float stormBlend = smoothstep(0.2, 0.8, storm);
  vec3 w6 = gerstner(position.xz, wh*stormBlend*0.040, 200.0, windDir,                     uTime*0.45);

  vec3 totalWave = w1 + w2 + w3 + w4 + w5 + w6;
  vec3 displaced = position + totalWave;
  vElevation     = totalWave.y;

  // Crest gradient — used by the fragment to mask foam to actually-breaking
  // crests (high height + high gradient), not "anything above zero".
  float nd  = 0.6;
  vec2  px  = vec2(nd, 0.0);
  vec2  pz  = vec2(0.0, nd);

  float hyx = gerstnerY(position.xz + px, wh*0.055,150.0, windDir, uTime*0.62)
            + gerstnerY(position.xz + px, wh*0.070, 75.0, windDir*0.9+crossDir*0.2, uTime*0.85)
            + gerstnerY(position.xz + px, wh*0.045, 55.0, crossDir*0.8+windDir*0.1, uTime*0.74)
            + gerstnerY(position.xz + px, wh*0.075, 35.0, windDir*0.95+crossDir*0.3, uTime*1.05)
            + gerstnerY(position.xz + px, wh*0.055, 22.0,-crossDir*0.7+windDir*0.3, uTime*1.28)
            + gerstnerY(position.xz + px, wh*stormBlend*0.040,200.0, windDir, uTime*0.45);
  float hyz = gerstnerY(position.xz + pz, wh*0.055,150.0, windDir, uTime*0.62)
            + gerstnerY(position.xz + pz, wh*0.070, 75.0, windDir*0.9+crossDir*0.2, uTime*0.85)
            + gerstnerY(position.xz + pz, wh*0.045, 55.0, crossDir*0.8+windDir*0.1, uTime*0.74)
            + gerstnerY(position.xz + pz, wh*0.075, 35.0, windDir*0.95+crossDir*0.3, uTime*1.05)
            + gerstnerY(position.xz + pz, wh*0.055, 22.0,-crossDir*0.7+windDir*0.3, uTime*1.28)
            + gerstnerY(position.xz + pz, wh*stormBlend*0.040,200.0, windDir, uTime*0.45);

  vec3 tang   = normalize(vec3(nd, hyx - vElevation, 0.0));
  vec3 bitang = normalize(vec3(0.0, hyz - vElevation, nd));
  vNormal     = normalize(cross(bitang, tang));
  vCrestGrad  = vec2(hyx - vElevation, hyz - vElevation) / nd;

  vec4 worldPos  = modelMatrix * vec4(displaced, 1.0);
  vWorldPosition = worldPos.xyz;
  vViewDir       = normalize(cameraPosition - worldPos.xyz);

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// FRAGMENT
// ─────────────────────────────────────────────────────────────────────────────
export const oceanFragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3  uDeepColor;
uniform vec3  uShallowColor;
uniform vec3  uFoamColor;
uniform vec3  uSunDirection;
uniform vec3  uSunColor;
uniform float uVisibility;
uniform float uStormIntensity;
uniform vec3  uWindDirection;
uniform float uWaveHeight;

varying vec3  vWorldPosition;
varying vec3  vNormal;
varying float vElevation;
varying vec2  vUv;
varying vec2  vCrestGrad;
varying vec3  vViewDir;

// ── Hash + smooth value-noise with derivatives ───────────────────────────────
// Returns vec3(dx, dy, value). Used to build flow normals AND foam
// without ever sampling a texture.
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
vec3 noiseDXY(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 t  = f * f * (3.0 - 2.0 * f);
  vec2 dt = 6.0 * f * (1.0 - f);
  float val = a + (b - a) * t.x + (c - a) * t.y + (a - b - c + d) * t.x * t.y;
  float dx  = ((b - a) + (a - b - c + d) * t.y) * dt.x;
  float dy  = ((c - a) + (a - b - c + d) * t.x) * dt.y;
  return vec3(dx, dy, val);
}

// Flowing FBM: each octave is offset along the flow vector and
// accumulated as (dv/dx, dv/dy, v). Caller drives flow from the wave
// gradient so the noise pattern advects with the swell instead of
// sitting still.
vec3 fbmFlow(vec2 p, vec2 flow, float persistence) {
  vec3 acc = vec3(0.0);
  float a = 1.0, tot = 0.0;
  for (int i = 0; i < 4; i++) {
    p += flow;
    flow *= -0.75;             // alternate flow per octave (P_Malin trick)
    vec3 v = noiseDXY(p);
    acc += v * a;
    p   += v.xy * 0.18;        // domain-warp by previous derivative
    p   *= 2.0;
    tot += a;
    a   *= persistence;
  }
  return acc / tot;
}

// Two phase offsets crossfaded against a 0..1 sawtooth — kills the
// time-loop artifact that any single fbm scroll produces.
vec4 sampleFlowingNormal(vec2 uv, vec2 flow, float fMag, float foamHint, float t,
                         out float fOutFoamTex) {
  float t0 = fract(t);
  float t1 = fract(t + 0.5);
  float o0 = t0 - 0.5;
  float o1 = t1 - 0.5;

  vec3 nA = fbmFlow(uv * 1.0, flow * o0 * 8.0, 0.65 + foamHint * 0.20);
  vec3 nB = fbmFlow(uv * 1.0, flow * o1 * 8.0, 0.65 + foamHint * 0.20);
  vec3 fA = fbmFlow(uv * 1.6, flow * o0 * 4.0, 0.7);
  vec3 fB = fbmFlow(uv * 1.6, flow * o1 * 4.0, 0.7);

  float w = abs(t0 - 0.5) * 2.0;
  vec3 nMix = mix(nA, nB, w);
  vec3 fMix = mix(fA, fB, w);

  fOutFoamTex = clamp(fMix.z * 1.4, 0.0, 1.0);

  vec3 normal = normalize(vec3(nMix.x * fMag, 1.0, nMix.y * fMag));
  return vec4(normal, nMix.z);
}

float schlick(float cosTheta, float F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
float GGX(float NdotH, float roughness) {
  float a  = roughness * roughness;
  float a2 = a * a;
  float d  = NdotH * NdotH * (a2 - 1.0) + 1.0;
  return a2 / (3.14159265 * d * d + 0.0001);
}

// Beer-Lambert extinction — warm tint absorbs blue least, red most.
// A function of "optical depth" which we fake from camera distance + how
// far below sea-level the camera-space sample is.
vec3 waterExtinction(float opticalDepth) {
  vec3 absorbCol = 1.0 - vec3(0.55, 0.40, 0.10);
  return exp2(-opticalDepth * absorbCol);
}

void main() {
  vec2 windXZ = normalize(uWindDirection.xz + vec2(0.0001));
  vec2 perp   = vec2(-windXZ.y, windXZ.x);

  // Flow vector: combines wind + crest gradient. Storm boosts magnitude.
  vec2  flow     = windXZ * (0.4 + uStormIntensity * 0.6) - vCrestGrad * 0.6;
  float flowMag2 = dot(flow, flow);
  float foamHint = clamp(flowMag2 * 0.6 + uStormIntensity * 0.5, 0.0, 1.0);

  // Surface UVs — kept big enough that the noise pattern doesn't dominate.
  vec2 uv = vWorldPosition.xz * 0.045;

  float microMag = 1.6 + uStormIntensity * 1.2;
  float foamTex  = 0.0;
  vec4  flowing  = sampleFlowingNormal(uv, flow, microMag, foamHint, uTime * 0.18, foamTex);

  vec3 microNorm = flowing.xyz;
  // 0.55 lets micro detail dominate close-up while geometry still wins at
  // grazing angles for proper silhouette shading.
  vec3 N = normalize(mix(vNormal, microNorm, 0.55));

  vec3 V = normalize(vViewDir);
  vec3 L = normalize(uSunDirection);
  vec3 H = normalize(V + L);

  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.001);
  float NdotH = max(dot(N, H), 0.0);

  float fresnel = schlick(NdotV, 0.02);

  // ── Water column colour (Beer-Lambert) ─────────────────────────────────────
  // Synthetic optical depth: higher for deeper troughs, lower for crests.
  float trough     = clamp(0.5 - vElevation / max(uWaveHeight * 0.6, 0.1), 0.0, 1.0);
  float opticalDep = 0.6 + trough * 2.4;
  vec3 extinction  = waterExtinction(opticalDep);
  // Light entering from above gets tinted by extinction → that's our "deep" colour.
  vec3 transmitted = uShallowColor * extinction;
  vec3 waterColor  = mix(uDeepColor, transmitted, extinction.b * 0.5 + 0.5);

  // Storm tint: cold, desaturated, dark
  vec3 stormTint   = mix(vec3(0.06, 0.10, 0.14), vec3(0.18, 0.22, 0.28), 1.0 - trough);
  waterColor = mix(waterColor, stormTint, uStormIntensity * 0.55);

  // ── Specular ───────────────────────────────────────────────────────────────
  float roughness = mix(0.05, 0.30, uStormIntensity + (1.0 - flowMag2) * 0.05);
  float spec      = GGX(NdotH, roughness) * NdotL;
  vec3  specColor = uSunColor * spec * (1.0 - uStormIntensity * 0.65) * 0.6;

  // ── Subsurface scatter (warm wrap, only on lit upper face of crest) ────────
  float sssWrap   = pow(max(0.0, 0.65 - dot(L, N)), 2.0);
  float sssCrest  = clamp(vElevation / max(uWaveHeight * 0.5, 0.1), 0.0, 1.0);
  vec3  sssColor  = vec3(0.10, 0.45, 0.42);
  waterColor     += sssColor * sssWrap * sssCrest * (1.0 - uStormIntensity * 0.5) * 0.45;

  // ── Sky reflection (Fresnel-weighted) ──────────────────────────────────────
  vec3 skyCol  = mix(vec3(0.45, 0.65, 0.92), vec3(0.20, 0.24, 0.30), uStormIntensity);
  waterColor   = mix(waterColor, skyCol, fresnel * 0.55);
  waterColor  += specColor;

  // ── FOAM — flow-driven, NOT elevation-driven ───────────────────────────────
  // Foam only appears where the wave is actually breaking: high gradient AND
  // high crest. This is what stops the surface from being a flat repeating
  // white pattern. Then the foam texture (foamTex) gives it actual structure.
  float gradMag      = length(vCrestGrad);
  float crestRising  = max(0.0, vElevation / max(uWaveHeight * 0.6, 0.1));
  float foamMask     = smoothstep(0.55, 1.20, gradMag) * smoothstep(0.25, 0.90, crestRising);
  // Storm adds whitecap foam from chop independently
  foamMask          += smoothstep(0.6, 1.0, gradMag * (1.0 + uStormIntensity * 1.5))
                     * uStormIntensity * 0.7;
  // Modulate by the foam noise texture so it has actual streaks
  foamMask          *= 0.30 + foamTex * 0.85;
  foamMask           = clamp(foamMask, 0.0, 1.0);

  float flicker      = 0.85 + 0.15 * sin(uTime * 2.4 + vWorldPosition.x * 0.25 + vWorldPosition.z * 0.18);
  vec3  foamFinal    = uFoamColor * flicker;
  waterColor         = mix(waterColor, foamFinal, foamMask * 0.85);

  // ── Atmospheric fog → horizon ──────────────────────────────────────────────
  float fog       = 1.0 - uVisibility;
  float camDist   = length(vWorldPosition - cameraPosition);
  float fogFactor = 1.0 - exp(-camDist * (0.00025 + fog * 0.0055));
  vec3  fogColor  = mix(vec3(0.72, 0.84, 0.95), vec3(0.28, 0.32, 0.38), uStormIntensity);
  waterColor      = mix(waterColor, fogColor, clamp(fogFactor, 0.0, 1.0));

  // Alpha — solid where there's foam, more transparent where calm so the
  // shore reads through.
  float alpha = clamp(0.78 + fresnel * 0.18 + foamMask * 0.10
                      - (1.0 - uStormIntensity) * (1.0 - fresnel) * 0.20, 0.55, 1.0);

  gl_FragColor = vec4(waterColor, alpha);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────
export function createOceanMaterial(uniforms: Record<string, { value: unknown }>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:           uniforms.uTime           || { value: 0 },
      uWaveHeight:     uniforms.uWaveHeight     || { value: 1.2 },
      uWaveFrequency:  uniforms.uWaveFrequency  || { value: 1.0 },
      uWindDirection:  uniforms.uWindDirection  || { value: new THREE.Vector3(1, 0, 0) },
      uWindStrength:   uniforms.uWindStrength   || { value: 8 },
      uDeepColor:      uniforms.uDeepColor      || { value: new THREE.Color(0x062a45) },
      uShallowColor:   uniforms.uShallowColor   || { value: new THREE.Color(0x2dc4e8) },
      uFoamColor:      uniforms.uFoamColor      || { value: new THREE.Color(0xe8f4ff) },
      uSunDirection:   uniforms.uSunDirection   || { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
      uSunColor:       uniforms.uSunColor       || { value: new THREE.Color(0xfff5e0) },
      uVisibility:     uniforms.uVisibility     || { value: 1.0 },
      uStormIntensity: uniforms.uStormIntensity || { value: 0.0 },
    },
    vertexShader:   oceanVertexShader,
    fragmentShader: oceanFragmentShader,
    transparent: true,
    side: THREE.FrontSide,
  });
}

export function createOceanGeometry(width = 400, height = 400, segments = 256): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, height, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export class DynamicOcean {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  geometry: THREE.PlaneGeometry;

  constructor(size: number = 400, segments: number = 256) {
    this.geometry = createOceanGeometry(size, size, segments);
    this.material = createOceanMaterial({});
    this.mesh     = new THREE.Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  update(time: number, weatherUniforms?: Record<string, { value: unknown }>): void {
    this.material.uniforms.uTime.value = time;
    if (weatherUniforms) {
      Object.keys(weatherUniforms).forEach((key) => {
        if (this.material.uniforms[key]) {
          this.material.uniforms[key].value = weatherUniforms[key].value;
        }
      });
    }
  }

  setStormIntensity(intensity: number): void {
    this.material.uniforms.uStormIntensity.value = Math.max(0, Math.min(1, intensity));
  }
  setWaveParameters(height: number, frequency: number): void {
    this.material.uniforms.uWaveHeight.value    = height;
    this.material.uniforms.uWaveFrequency.value = frequency;
  }
  setWindDirection(direction: THREE.Vector3): void {
    this.material.uniforms.uWindDirection.value = direction;
  }
  setSunPosition(position: THREE.Vector3): void {
    this.material.uniforms.uSunDirection.value = position.clone().normalize();
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
