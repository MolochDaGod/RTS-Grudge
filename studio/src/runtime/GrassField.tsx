/**
 * FluffyGrass-style instanced grass field.
 *
 * Ported from the codepen reference at
 * `.local/refs/grass-ref/threejs-player-and-grass/src/script.js`
 * (functions `createGrassMaterial` / `createGrassTerrain` /
 * `getAttributeData`, lines ~16533-16970).
 *
 * High-level recipe:
 *   - Base blade = a narrow `PlaneGeometry(bW, bH, 1, joints)` translated
 *     up so y=0 is the root and y=bH is the tip.
 *   - We build one `InstancedBufferGeometry` that shares the blade's
 *     position/uv attrs, plus per-instance attrs:
 *         offset            vec3   world-space root position
 *         orientation       vec4   quaternion picked at random
 *         halfRootAngleSin  float
 *         halfRootAngleCos  float
 *         stretch           float  height jitter
 *   - The vertex shader rotates each vertex by a quaternion that is
 *     `slerp`'d from a vertical baseline at the root → the random
 *     `orientation` at the tip (so blades curl), then adds a per-blade
 *     wind sway driven by a 2D simplex noise of `worldOffset` & `time`.
 *   - The fragment shader samples a procedurally drawn blade albedo and
 *     alpha map, mixes a tip and bottom colour by `frc = position.y/bH`,
 *     then darkens with a low-frequency simplex "cloud shadow".
 *
 * Differences from the codepen:
 *   - We don't trail/push grass with a player (yet). The `trail`
 *     attribute is omitted.
 *   - Density / height / noiseScale / windStrength are reactive so the
 *     EnvironmentPanel can live-tune them without re-mounting.
 *   - We sample the editor's heightfield with `sampleHeight()` so blades
 *     hug the sculpted terrain and we skip blades that fall under sea
 *     level (no underwater grass).
 *   - Blade textures are drawn with Canvas2D at module load — no PNGs
 *     to ship, no network round-trip.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sampleHeight } from '../editor/terrain-utils';
import { SEA_LEVEL } from '../editor/IslandGenerator';
import type { TerrainData } from '../types';

/**
 * GrassField v2 — quality upgrade inspired by the Three.js interactive-grass
 * demo (discourse.threejs.org/t/87994).  Key improvements over v1:
 *   • Per-blade height / width / lean / spin variation via hash(instanceID)
 *   • Realistic taper: blade is widest at root, pointed at tip
 *   • Per-blade two-tone colour variation (base / tip hues with noise)
 *   • Multi-entity grass-interaction: up to 8 positions can bend nearby blades
 *   • Multi-scale wind: large-scale gust envelope + small-scale flutter noise
 *   • Rich fragment shading: ambient + diffuse + SSS + backscatter + rim
 *   • Distance fade so far-away blades blend into the terrain colour
 */

// ----- Blade textures -------------------------------------------------------
// Albedo: the real PBR grass-diffuse texture from public/textures/terrain/,
// which gives blades the same material look as the sculpted terrain under them.
// Alpha: Canvas2D-drawn tapered silhouette — keeps the blade shape crisp.

const _GRASS_DIFF_URL = `${import.meta.env.BASE_URL}textures/terrain/grass_diff.jpg`;

function makeBladeTextures(): { albedo: THREE.Texture; alpha: THREE.Texture } {
  // Albedo — load the terrain grass texture so blades match the ground surface.
  const albedo = new THREE.TextureLoader().load(_GRASS_DIFF_URL);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
  albedo.minFilter = THREE.LinearMipMapLinearFilter;
  albedo.magFilter = THREE.LinearFilter;
  albedo.generateMipmaps = true;

  // Alpha: slightly wider blade silhouette with bezier curves for realism.
  const W = 64, H = 256;
  const alphaCanvas = document.createElement('canvas');
  alphaCanvas.width = W; alphaCanvas.height = H;
  const xc = alphaCanvas.getContext('2d')!;
  xc.fillStyle = '#000';
  xc.fillRect(0, 0, W, H);
  // Soft gradient across the width so edges fade out rather than hard-cut.
  const bladeGrad = xc.createLinearGradient(0, 0, W, 0);
  bladeGrad.addColorStop(0.00, '#000');
  bladeGrad.addColorStop(0.22, '#fff');
  bladeGrad.addColorStop(0.78, '#fff');
  bladeGrad.addColorStop(1.00, '#000');
  xc.fillStyle = bladeGrad;
  xc.beginPath();
  xc.moveTo(W * 0.5, 2);                           // pointed tip
  xc.bezierCurveTo(W * 0.82, H * 0.22, W * 0.68, H * 0.55, W * 0.60, H);
  xc.lineTo(W * 0.40, H);
  xc.bezierCurveTo(W * 0.32, H * 0.55, W * 0.18, H * 0.22, W * 0.5, 2);
  xc.closePath();
  xc.fill();

  const alpha = new THREE.CanvasTexture(alphaCanvas);
  alpha.colorSpace = THREE.NoColorSpace;
  alpha.minFilter = THREE.LinearFilter;
  alpha.magFilter = THREE.LinearFilter;

  return { albedo, alpha };
}

let _bladeTex: { albedo: THREE.Texture; alpha: THREE.Texture } | null = null;
function getBladeTextures() {
  if (!_bladeTex) _bladeTex = makeBladeTextures();
  return _bladeTex;
}

// ----- Shader source ---------------------------------------------------

// ── Maximum entities that can push grass blades ──────────────────────────────
// NOTE: This constant is intentionally NOT used as a template literal inside
// the GLSL strings to avoid esbuild/Rollup trying to inline and expand the
// shader at build time (which causes multi-GB allocations).  The number 8
// appears verbatim in the GLSL text below; keep them in sync manually.
const MAX_INTERACT = 8;

const VERT = /* glsl */ `
  precision mediump float;

  // --- Shared blade attributes (per-blade instanced buffer) ---
  attribute vec3  offset;           // world-space root position
  attribute vec2  worldOffset;      // XZ for noise lookup
  attribute vec4  orientation;      // quaternion — base lean direction
  attribute float halfRootAngleSin;
  attribute float halfRootAngleCos;
  attribute float stretch;          // height jitter

  // --- Uniforms ---
  uniform float time;
  uniform float bladeHeight;
  uniform float windStrength;
  uniform vec3  sunDirection;

  // Entity-interaction: up to 8 world positions that bend nearby blades
  uniform vec3  entityPositions[8];   // keep in sync with MAX_INTERACT in TS
  uniform int   numEntities;
  uniform float interactionRadius;
  uniform float interactionStrength;

  // --- Varyings (colour computed in FRAG via Hoskins Voronoi) ---
  varying vec2  vUv;
  varying float vGrassHeight;    // normalised 0(root)→1(tip)
  varying vec3  vWorldPosition;

  // ============================================================
  // Utilities
  // ============================================================
  float hash(float n){ return fract(sin(n)*43758.5453); }

  vec3 mod289v3(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
  vec2 mod289v2(vec2 x){ return x - floor(x*(1.0/289.0))*289.0; }
  vec3 permute3(vec3 x){ return mod289v3(((x*34.0)+1.0)*x); }

  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = x0.x > x0.y ? vec2(1.0,0.0) : vec2(0.0,1.0);
    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
    i = mod289v2(i);
    vec3 p = permute3(permute3(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
    vec3 m = max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
    m=m*m; m=m*m;
    vec3 x2=2.0*fract(p*C.www)-1.0;
    vec3 h=abs(x2)-0.5;
    vec3 ox=floor(x2+0.5);
    vec3 a0=x2-ox;
    m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
    vec3 g;
    g.x=a0.x*x0.x+h.x*x0.y;
    g.yz=a0.yz*x12.xz+h.yz*x12.yw;
    return 130.0*dot(m,g);
  }

  vec3 rotVQ(vec3 v, vec4 q){
    return 2.0*cross(q.xyz,v*q.w+cross(q.xyz,v))+v;
  }
  vec4 slerpQ(vec4 v0, vec4 v1, float t){
    v0=normalize(v0); v1=normalize(v1);
    float d=dot(v0,v1);
    if(d<0.0){v1=-v1;d=-d;}
    if(d>0.9995) return normalize(t*(v1-v0)+v0);
    float th0=acos(d),th=th0*t,st=sin(th),st0=sin(th0);
    return (cos(th)-d*st/st0)*v0+(st/st0)*v1;
  }

  // ============================================================
  // Main
  // ============================================================
  void main() {
    float id = float(gl_InstanceID);

    // ── Per-blade variation ────────────────────────────────────
    float heightVar = mix(0.7, 1.3, hash(id*3.0));
    float widthVar  = mix(0.8, 1.5, hash(id*5.0));
    vGrassHeight = clamp(position.y / bladeHeight, 0.0, 1.0) * heightVar;

    // Root→tip taper (realistic — blade narrows toward tip)
    float taper = mix(0.3, 1.0, 1.0 - vGrassHeight*vGrassHeight);

    vec3 vPos = vec3(
      position.x * taper * widthVar,
      position.y * heightVar * (1.0 + stretch*0.3),
      position.z
    );

    // ── Lean (random per blade) ────────────────────────────────
    float leanAngle = (hash(id*1.3)-0.5)*0.55;
    float leanFac   = pow(max(0.0, 1.0-vGrassHeight), 1.2);
    vPos.x += leanFac * bladeHeight * tan(leanAngle);

    // ── Base wind sway (quaternion slerp) ─────────────────────
    // Carry the original orientation-slerp logic so blades curl naturally.
    vec4 rootDir = vec4(0.0, halfRootAngleSin, 0.0, halfRootAngleCos);
    vec4 tipDir  = slerpQ(rootDir, orientation, vGrassHeight);
    vPos = rotVQ(vPos, tipDir);

    // World position (before wind / interaction)
    vec4 worldPos = modelMatrix * vec4(offset + vPos, 1.0);

    // ── Multi-entity grass interaction ────────────────────────
    vec3 totalPush = vec3(0.0);
    for(int i=0; i<8; i++){  // 8 = MAX_INTERACT
      if(i >= numEntities) break;
      vec3  ep  = entityPositions[i];
      float d   = distance(worldPos.xyz, ep);
      if(d > interactionRadius) continue;
      float inf = pow(1.0 - smoothstep(0.0, interactionRadius, d), 1.5);
      // Only push the tip portion (height-weighted)
      inf *= vGrassHeight * interactionStrength;
      totalPush += normalize(worldPos.xyz - ep) * inf * bladeHeight;
    }
    worldPos.xyz += totalPush;

    // ── Multi-scale wind ──────────────────────────────────────
    float t = time * 0.6;
    float driftAngle = sin(t*0.07)*1.2;
    float bwx = cos(driftAngle), bwy = sin(driftAngle);

    float largeN = snoise(offset.xz*0.05 + t*0.05);
    float smallN = snoise(offset.xz*1.2  + t*0.6);
    float windN  = mix(largeN, smallN, 0.3);

    // Localised gust blob that drifts across the field
    vec2  burstC = vec2(sin(t*0.3)*80.0, cos(t*0.25)*80.0);
    windN += smoothstep(40.0, 0.0, distance(offset.xz, burstC))*1.0;

    float bladeFac  = hash(id)*0.5 + 0.75;
    float bladeOff  = (hash(id*13.0)-0.5)*0.5;
    vec2  windDir   = normalize(vec2(bwx,bwy) + vec2(cos(bladeOff),sin(bladeOff))*0.25);
    float swayFac   = (0.3 + 0.7*vGrassHeight) * windStrength;

    worldPos.xyz += vec3(windDir.x, 0.0, windDir.y) * windN * swayFac * bladeFac;

    // Colour is computed in FRAG (Hoskins Voronoi — no colour varying needed).
    vUv = uv;
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * worldPos;
  }
`;

// ============================================================================
// FRAG — David Hoskins "Rolling Hills" grass shader
// https://www.shadertoy.com/view/Xsf3zX  (MIT)
//
// Key functions ported verbatim, then wired to Three.js uniforms:
//   Hash(float/vec2), Noise(vec2), Voronoi(vec2)  — exact from Shadertoy
//   FractalNoise(vec2)                            — terrain shadow mask
//   DE-style coloring from GrassBlades():         — Voronoi ID → white tips
// ============================================================================
const FRAG = /* glsl */ `
  precision mediump float;

  uniform sampler2D alphaMap;   // blade silhouette (cutout)
  uniform float cloudTime;      // also used as iGlobalTime for Voronoi wind
  uniform float cloudScale;
  uniform float cloudIntensity;
  uniform vec3  sunDirection;
  uniform vec3  sunColor;
  uniform float sunIntensity;
  uniform vec3  ambientLight;

  varying vec2  vUv;
  varying float vGrassHeight;
  varying vec3  vWorldPosition;

  // ── Hoskins Hash / Noise / Voronoi (verbatim from shadertoy.com/view/Xsf3zX) ──
  const vec2 MOD2 = vec2(3.07965, 7.4235);

  float HashF(float p) {
    vec2 p2 = fract(vec2(p) / MOD2);
    p2 += dot(p2.yx, p2.xy + 19.19);
    return fract(p2.x * p2.y);
  }
  float HashV(vec2 p) {
    p = fract(p / MOD2);
    p += dot(p.xy, p.yx + 19.19);
    return fract(p.x * p.y);
  }
  float Noise(vec2 x) {
    vec2 p = floor(x);
    vec2 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n = p.x + p.y * 57.0;
    return mix(mix(HashF(n),      HashF(n+1.0),  f.x),
               mix(HashF(n+57.0), HashF(n+58.0), f.x), f.y);
  }
  // Voronoi — returns (edge distance, cell id)
  vec2 Voronoi(vec2 x) {
    vec2 p = floor(x);
    vec2 f = fract(x);
    float res = 100.0, id;
    for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 b = vec2(float(i), float(j));
      vec2 r = b - f + HashV(p + b);
      float d = dot(r, r);
      if (d < res) { res = d; id = HashV(p + b); }
    }
    return vec2(max(0.4 - sqrt(res), 0.0), id);
  }
  // FractalNoise — terrain occlusion shadow (shadertoy "t" variable)
  float FractalNoise(vec2 xy) {
    float w = 0.7, f = 0.0;
    for (int i = 0; i < 3; i++) {
      f += Noise(xy) * w;
      w *= 0.6;
      xy *= 2.0;
    }
    return f;
  }

  void main() {
    float a = texture2D(alphaMap, vUv).r;
    if (a < 0.15) discard;

    // ── Shadertoy base material: noisy dark / mid green ──────────────────
    // (same as TerrainColour mat in the original shader)
    vec3 mat = mix(vec3(0.0, 0.30, 0.0), vec3(0.20, 0.30, 0.0),
                   Noise(vWorldPosition.xz * 0.025));

    // ── Shadertoy DE() — height variable + Voronoi with animated wind ────
    // y is blade height squared (emphasises tips, matches GrassBlades logic)
    float y = vGrassHeight * vGrassHeight;

    // Wind in the Voronoi sample (Hoskins: sin(iGlobalTime*2.3+1.5*p.z) ...)
    vec2 windOff = vec2(
      sin(cloudTime * 2.3 + 1.5 * vWorldPosition.z),
      sin(cloudTime * 3.6 + 1.5 * vWorldPosition.x)
    ) * y * 0.5;

    vec2 ret = Voronoi(
      vWorldPosition.xz * 2.5
      + sin(y * 4.0 + vWorldPosition.zx * 12.3) * 0.12
      + windOff
    );
    float f       = ret.x * 0.6 + y * 0.58;
    float density = clamp(f * 1.5, 0.0, 1.0);

    // ── Shadertoy GrassBlades() coloring ─────────────────────────────────
    // White tips: colour of blade tip driven by Voronoi cell id (ret.y)
    // produces the characteristic "varied grass blade" look
    vec3 whiteTip = vec3(0.35, 0.35, min(pow(abs(ret.y), 4.0) * 35.0, 0.35));
    vec3 col = mix(mat, whiteTip, pow(abs(density), 9.0) * 0.7) * density;

    // ── FractalNoise terrain shadow (Shadertoy "t" term) ─────────────────
    float terrainShadow = FractalNoise(vWorldPosition.xz * 0.1) + 0.5;
    col *= terrainShadow;

    // ── Hoskins lighting: diffuse + SSS + backscatter + rim ──────────────
    vec3 N = vec3(0.0, 1.0, 0.0);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 L = normalize(sunDirection);

    float NdotL      = max(dot(N, L), 0.0);
    float diffuse    = NdotL * sunIntensity * 0.25;
    float SSS        = pow(max(dot( N, -L), 0.0), 2.0) * 0.6;  // light through blade
    float backScat   = pow(max(dot(-N, -L), 0.0), 2.0) * 0.5;
    float rim        = pow(1.0 - abs(dot(V, N)), 2.0) * 0.3;

    col *= ambientLight * 0.8
         + sunColor * (diffuse + SSS * 0.4 + backScat * 0.25 + rim * 0.2);

    // ── Cloud shadow (Hoskins-style drifting shadow) ──────────────────────
    float cloudN = Noise((vWorldPosition.xz + cloudTime * 10.0) / cloudScale);
    cloudN = smoothstep(0.2, 0.8, cloudN * 0.5 + 0.5);
    col *= mix(1.0 - cloudIntensity, 1.0, cloudN);

    // ── Distance fade ─────────────────────────────────────────────────────
    float dist = length(vWorldPosition.xz - cameraPosition.xz);
    col *= mix(0.75, 1.0, 1.0 - smoothstep(35.0, 75.0, dist));

    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface GrassFieldProps {
  terrain: TerrainData;
  /** Square footprint side, in metres. Defaults to terrain.size. */
  size?: number;
  /** Blades per square metre. */
  density: number;
  /** Mean blade height in metres. */
  height: number;
  /** Frequency of the placement-noise mask (higher = clumpier). */
  noiseScale: number;
  /** Wind sway amplitude multiplier. */
  windStrength: number;
  /**
   * World positions that will bend nearby blades away (player, creatures, etc.).
   * Capped at MAX_INTERACT entries; extra ones are ignored.
   */
  interactionPositions?: THREE.Vector3[];
}

// Tiny stable hash used for the noise placement mask. We don't import a
// noise lib — a value-noise hash like this is plenty for "clumpy patches".
function hash2(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

export function GrassField({
  terrain,
  size,
  density,
  height,
  noiseScale,
  windStrength,
  interactionPositions,
}: GrassFieldProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  // Geometry + per-instance attrs are recomputed when density / size /
  // height / noiseScale / terrain change. We don't include windStrength
  // here because it lives in a uniform and updates without rebuild.
  const { geometry, instanceCount } = useMemo(() => {
    const footprint = size ?? terrain.size;
    const targetCount = Math.floor(footprint * footprint * density);

    // Base blade geometry: width 0.06m, height = `height`, with 3
    // vertical joints so the slerp curl looks smooth.
    const bW = 0.06;
    const bH = height;
    const joints = 3;
    const base = new THREE.PlaneGeometry(bW, bH, 1, joints).translate(0, bH / 2, 0);

    const offsets = new Float32Array(targetCount * 3);
    const worldOffsets = new Float32Array(targetCount * 2);
    const orientations = new Float32Array(targetCount * 4);
    const stretches = new Float32Array(targetCount);
    const halfRootAngleSin = new Float32Array(targetCount);
    const halfRootAngleCos = new Float32Array(targetCount);

    const half = footprint / 2;
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion();
    let placed = 0;
    // Up to ~3x targetCount tries — placement-noise mask rejects spots
    // in dirt/sand patches and underwater, so we need some headroom.
    const maxTries = targetCount * 3;
    let tries = 0;
    while (placed < targetCount && tries < maxTries) {
      tries++;
      const x = (Math.random() - 0.5) * footprint;
      const z = (Math.random() - 0.5) * footprint;
      // Soft circular falloff so we don't spawn grass off the island
      // sticking out into the ocean.
      const r = Math.sqrt(x * x + z * z) / half;
      if (r > 1.0) continue;
      // Placement noise — clumpy patches via value noise, gated.
      const n = valueNoise(x * noiseScale, z * noiseScale);
      if (n < 0.35) continue;

      const y = sampleHeight(x, z, terrain);
      if (y <= SEA_LEVEL + 0.1) continue;

      offsets[placed * 3 + 0] = x;
      offsets[placed * 3 + 1] = y;
      offsets[placed * 3 + 2] = z;
      worldOffsets[placed * 2 + 0] = x;
      worldOffsets[placed * 2 + 1] = z;

      let angle = Math.PI - Math.random() * 2 * Math.PI;
      halfRootAngleSin[placed] = Math.sin(0.5 * angle);
      halfRootAngleCos[placed] = Math.cos(0.5 * angle);

      q0.set(0, Math.sin(angle / 2), 0, Math.cos(angle / 2)).normalize();
      const tilt = 0.25;
      angle = (Math.random() * 2 - 1) * tilt;
      q1.set(Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)).normalize();
      q0.multiply(q1);
      angle = (Math.random() * 2 - 1) * tilt;
      q1.set(0, 0, Math.sin(angle / 2), Math.cos(angle / 2)).normalize();
      q0.multiply(q1);

      orientations[placed * 4 + 0] = q0.x;
      orientations[placed * 4 + 1] = q0.y;
      orientations[placed * 4 + 2] = q0.z;
      orientations[placed * 4 + 3] = q0.w;

      // First third of blades is taller (variation).
      stretches[placed] = placed < targetCount / 3 ? Math.random() * 1.8 : Math.random();
      placed++;
    }

    const inst = new THREE.InstancedBufferGeometry();
    inst.index = base.index;
    inst.attributes.position = base.attributes.position;
    inst.attributes.uv = base.attributes.uv;
    inst.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets.slice(0, placed * 3), 3));
    inst.setAttribute('worldOffset', new THREE.InstancedBufferAttribute(worldOffsets.slice(0, placed * 2), 2));
    inst.setAttribute('orientation', new THREE.InstancedBufferAttribute(orientations.slice(0, placed * 4), 4));
    inst.setAttribute('stretch', new THREE.InstancedBufferAttribute(stretches.slice(0, placed), 1));
    inst.setAttribute('halfRootAngleSin', new THREE.InstancedBufferAttribute(halfRootAngleSin.slice(0, placed), 1));
    inst.setAttribute('halfRootAngleCos', new THREE.InstancedBufferAttribute(halfRootAngleCos.slice(0, placed), 1));
    inst.instanceCount = placed;

    base.dispose(); // we copied position/uv/index by ref but the source object isn't needed
    return { geometry: inst, instanceCount: placed };
  }, [terrain, size, density, height, noiseScale]);

  // GPU resource lifecycle. `useMemo` returns a fresh InstancedBufferGeometry
  // every time the user touches the density / height / clumpiness sliders;
  // without this effect the GL buffers from the previous geometry would
  // pile up on the GPU until the page reloads. The cleanup runs on the
  // *previous* geometry value because React re-runs effects when deps change.
  useEffect(() => {
    return () => { geometry.dispose(); };
  }, [geometry]);

  // Material is memoised independently so terrain re-rolls don't drop
  // textures (which would re-trigger upload to the GPU each time).
  const material = useMemo(() => {
    const { alpha } = getBladeTextures(); // albedo unused — FRAG is fully procedural
    // Pre-fill entity position array with far-away sentinels
    const entityArr = Array.from({ length: MAX_INTERACT }, () => new THREE.Vector3(1e6, 1e6, 1e6));
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
      transparent: true,
      uniforms: {
        // Blade geometry
        bladeHeight:        { value: height },
        alphaMap:           { value: alpha },
        // Animation
        time:               { value: 0 },
        windStrength:       { value: windStrength },
        // Cloud shadow
        cloudTime:          { value: 0 },
        cloudScale:         { value: 60 },
        cloudIntensity:     { value: 0.18 },
        // Sun / lighting
        sunDirection:       { value: new THREE.Vector3(1, 2, 1).normalize() },
        sunColor:           { value: new THREE.Color(1, 0.98, 0.85) },
        sunIntensity:       { value: 1.0 },
        ambientLight:       { value: new THREE.Color(0.42, 0.48, 0.52) },
        // Entity interaction
        entityPositions:    { value: entityArr },
        numEntities:        { value: 0 },
        interactionRadius:  { value: 3.5 },
        interactionStrength:{ value: 0.6 },
      },
    });
  }, [height]);

  useEffect(() => {
    return () => { material.dispose(); };
  }, [material]);

  // Live-update uniforms every frame (no material rebuild needed)
  if (matRef.current) {
    matRef.current.uniforms.windStrength.value = windStrength;
  }

  useFrame((state) => {
    const mat = matRef.current;
    if (!mat) return;
    const t = state.clock.elapsedTime;
    mat.uniforms.time.value      = t / 4;
    mat.uniforms.cloudTime.value = t / 6;

    // Push entity positions into shader (camera always acts as index-0 sentinel)
    const positions = interactionPositions ?? [];
    const count = Math.min(positions.length, MAX_INTERACT);
    for (let i = 0; i < count; i++) {
      (mat.uniforms.entityPositions.value as THREE.Vector3[])[i].copy(positions[i]);
    }
    // Fill remaining with far-away sentinels so the loop in the shader exits early
    for (let i = count; i < MAX_INTERACT; i++) {
      (mat.uniforms.entityPositions.value as THREE.Vector3[])[i].set(1e6, 1e6, 1e6);
    }
    mat.uniforms.numEntities.value = count;
  });

  if (instanceCount === 0) return null;

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={2}>
      <primitive object={material} attach="material" ref={matRef} />
    </mesh>
  );
}
