import * as THREE from "three";

/**
 * Shared wind sway helper for trees, palms, bushes, ferns, etc.
 *
 * Why this exists:
 * Static foliage breaks the immersion of an open-world survival
 * game. The grass blades sway already (see GrassLayer), but the
 * trees/bushes/ferns scattered by NatureScatter are completely
 * still, which makes the world look frozen.
 *
 * Design decisions:
 *   • One global wind clock advanced by a single rAF loop. Adding
 *     a `useFrame` per material would cost us one React Three
 *     Fiber subscription + one closure per material; cheap each
 *     but multiplied by hundreds of tree species across the world
 *     it's wasteful.
 *   • Sway is injected into the existing MeshStandardMaterial via
 *     `onBeforeCompile`. The alternative — a fresh ShaderMaterial
 *     — would mean reimplementing PBR lighting and would lose the
 *     baked vertex colors / normal maps the GLBs ship with.
 *   • Per-instance phase variation comes from `instanceMatrix`
 *     translation (column 3). Using world position would force a
 *     `modelMatrix * vec4(0,0,0,1)` per vertex; reading the
 *     instance origin once is one mat4 column lookup.
 *   • Sway is scaled by `transformed.y` so the trunk base
 *     (y=0 in the cleaned-up model frame) stays planted while the
 *     canopy moves. Negative-Y verts (rare; below the pivot) are
 *     clamped via `max(transformed.y, 0.0)` so they don't sway
 *     the wrong direction.
 *   • A slow "gust" multiplier (cos at 0.3 Hz) modulates the
 *     fast sway so the motion ebbs and flows naturally instead of
 *     looking like a metronome.
 *
 * Compression / cost:
 *   • Vertex shader only — no extra textures, no extra draw calls,
 *     no extra geometry. The instanced meshes still render in one
 *     draw call each.
 *   • Materials are mutated once and tagged with `__windAttached`
 *     so cached materials shared between cached models don't get
 *     onBeforeCompile chained (which would compound the sway).
 */

type WindUniforms = {
  uWindTime: { value: number };
  uWindStrength: { value: number };
  uWindFreq: { value: number };
  uWindDir: { value: THREE.Vector2 };
};

const wind: WindUniforms = {
  uWindTime: { value: 0 },
  uWindStrength: { value: 0.06 },
  uWindFreq: { value: 0.18 },
  uWindDir: { value: new THREE.Vector2(0.7, 0.3).normalize() },
};

let clockStarted = false;
let clockStart = 0;
function startWindClockOnce() {
  if (clockStarted) return;
  if (typeof requestAnimationFrame === "undefined") return;
  clockStarted = true;
  clockStart = performance.now();
  const tick = () => {
    wind.uWindTime.value = (performance.now() - clockStart) / 1000;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const WIND_TAG = "__windAttached" as const;

/**
 * Inject wind-sway vertex displacement into a standard material.
 *
 * Safe to call multiple times with the same material — subsequent
 * calls no-op via the `__windAttached` marker. Works with both
 * instanced (uses `instanceMatrix`) and non-instanced meshes
 * (falls back to `modelMatrix`).
 */
export function attachWindToMaterial(material: THREE.Material): void {
  startWindClockOnce();
  type ShaderHook = {
    uniforms: Record<string, { value: unknown }>;
    vertexShader: string;
    fragmentShader: string;
  };
  const m = material as THREE.Material & {
    [WIND_TAG]?: boolean;
    onBeforeCompile?: (shader: ShaderHook) => void;
  };
  if (m[WIND_TAG]) return;
  m[WIND_TAG] = true;

  const previousOnBeforeCompile = m.onBeforeCompile;

  m.onBeforeCompile = (shader: ShaderHook) => {
    if (previousOnBeforeCompile) previousOnBeforeCompile(shader);

    shader.uniforms.uWindTime = wind.uWindTime;
    shader.uniforms.uWindStrength = wind.uWindStrength;
    shader.uniforms.uWindFreq = wind.uWindFreq;
    shader.uniforms.uWindDir = wind.uWindDir;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        uniform float uWindTime;
        uniform float uWindStrength;
        uniform float uWindFreq;
        uniform vec2  uWindDir;`,
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
        // ── Wind sway ───────────────────────────────────────────
        // Per-instance phase: read translation column from
        // instanceMatrix when instanced, otherwise from modelMatrix.
        #ifdef USE_INSTANCING
          vec3 windInstOrigin = vec3(
            instanceMatrix[3][0],
            instanceMatrix[3][1],
            instanceMatrix[3][2]
          );
        #else
          vec3 windInstOrigin = vec3(
            modelMatrix[3][0],
            modelMatrix[3][1],
            modelMatrix[3][2]
          );
        #endif

        // Trunk stays planted; canopy sways. Clamp negative Y so
        // sub-pivot verts don't push the wrong way.
        float swayMask = max(transformed.y, 0.0);

        float windPhase = (windInstOrigin.x + windInstOrigin.z) * uWindFreq
                        + uWindTime * 1.4;
        float fastSway  = sin(windPhase) * 0.7
                        + sin(windPhase * 2.3 + 1.7) * 0.3;
        float gust      = 0.55 + 0.45 * sin(
                            uWindTime * 0.3
                            + (windInstOrigin.x - windInstOrigin.z) * 0.05
                          );

        float windAmount = uWindStrength * fastSway * gust * swayMask;
        transformed.x += uWindDir.x * windAmount;
        transformed.z += uWindDir.y * windAmount;`,
      );
  };
  m.needsUpdate = true;
}

/**
 * Test hook — exposed so tuning UIs (or future weather systems)
 * can adjust wind without reaching into the module internals.
 */
export function setWind(opts: {
  strength?: number;
  freq?: number;
  direction?: THREE.Vector2;
}): void {
  if (opts.strength !== undefined) wind.uWindStrength.value = opts.strength;
  if (opts.freq !== undefined) wind.uWindFreq.value = opts.freq;
  if (opts.direction) wind.uWindDir.value.copy(opts.direction).normalize();
}
