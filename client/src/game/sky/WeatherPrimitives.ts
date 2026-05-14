import * as THREE from "three";

/**
 * Weather event primitives. Layered ON TOP of the base `Skybox` / `Clouds` /
 * `Stars` system from `SkyPrimitives.ts` — these are event-driven overlays
 * (storm clouds, lightning, rain) that activate when `useGame.weather` is set
 * to something other than `"clear"`.
 *
 * Adapted from David Hoskins' "Weather" Shadertoy
 * (https://www.shadertoy.com/view/4dsXWn, CC BY-NC-SA 3.0). The volumetric
 * cloud raymarch and rain noise are direct ports; the sky gradient, sun, sea,
 * lens flares, and camera path were dropped because the existing `Skybox`
 * already owns those.
 *
 * Design constraints:
 *   - Volumetric clouds render on a sky-box style mesh (BackSide, depthWrite
 *     off, transparent). Alpha = cloud density so the base sky shows through
 *     where coverage is sparse.
 *   - Rain renders on a fullscreen-quad overlay (depthTest off, very high
 *     renderOrder) — pure 2D screen effect, never written to the depth buffer.
 *   - Lightning is computed in JS (not GPU) so the same flash value can drive
 *     the cloud shader uniform AND a real `THREE.AmbientLight` boost in scene.
 */

const SKYBOX_SCALE = 100000;

/* ------------------------------------------------------------------------ */
/*  Procedural noise texture (replaces Shadertoy `iChannel0`)               */
/* ------------------------------------------------------------------------ */

/**
 * Generate a 256x256 RGBA noise texture matching the channel layout the
 * Shadertoy expects: the original samples `texture2D(iChannel0, ...).x` (luma)
 * for 2D noise and `.yx` for 3D noise. We pack independent random floats into
 * R and G so both lookups behave like uncorrelated white-noise samples after
 * the smoothstep that the GLSL `Noise` function applies on top.
 *
 * Cached at module scope so the StormClouds + RainOverlay share one texture
 * (the original shader binds the same channel to both).
 */
let _noiseTextureCache: THREE.DataTexture | null = null;
function getNoiseTexture(): THREE.DataTexture {
  if (_noiseTextureCache) return _noiseTextureCache;
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  // Seeded PRNG so the texture is deterministic across reloads (no flicker
  // when HMR reattaches WebGL resources during development).
  let s = 0x1bf52a;
  const rand = () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 65536) / 65535;
  };
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    data[o + 0] = Math.floor(rand() * 255);
    data[o + 1] = Math.floor(rand() * 255);
    data[o + 2] = Math.floor(rand() * 255);
    data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  _noiseTextureCache = tex;
  return tex;
}

/* ------------------------------------------------------------------------ */
/*  Storm clouds (volumetric raymarch dome)                                 */
/* ------------------------------------------------------------------------ */

const StormCloudShader = {
  vertexShader: `
    // Camera-relative ray direction. The mesh is translated to camera position
    // every frame in StormClouds.update, so the local 'position' attribute is
    // already the offset FROM the camera in world units (after model scale).
    // We could use vWorldPosition - cameraPosition, but 'position' is cheaper
    // and avoids needing to thread a uCameraPos uniform.
    varying vec3 vRayDir;
    void main() {
      vRayDir = position;
      vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      // Force clouds to sky-far plane so they composite behind everything else
      // except the base skybox/skyClouds (which use the same trick at z=ww).
      gl_Position = pos.xyww;
    }
  `,
  // Direct port of the cloud raymarch from David Hoskins' "Weather" shader.
  // Drops sea/sun/lensflare/camera-path; keeps Hash/Noise/FBM/Map/GetSky-cloud
  // section with cameraPos anchored at the world origin (clouds follow the
  // player because the mesh is parented to the player every frame).
  fragmentShader: `
    precision highp float;
    varying vec3 vRayDir;
    uniform float uTime;
    uniform float uCloudy;     // -1..1, Shadertoy 'cloudy' param (>0.2 = stormy)
    uniform vec3 uFlash;       // lightning flash colour (added to clouds)
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec2 uResolution;
    uniform sampler2D uNoise;

    #define CLOUD_LOWER 2000.0
    #define CLOUD_UPPER 3800.0
    #define MOD3 vec3(.16532,.17369,.15787)

    float Hash(vec3 p) {
      p = fract(p * MOD3);
      p += dot(p.xyz, p.yzx + 19.19);
      return fract(p.x * p.y * p.z);
    }
    float Noise(in vec2 f) {
      vec2 p = floor(f);
      f = fract(f);
      f = f*f*(3.0-2.0*f);
      return texture2D(uNoise, (p+f+0.5)/256.0).x;
    }
    float Noise(in vec3 x) {
      vec3 p = floor(x);
      vec3 f = fract(x);
      f = f*f*(3.0-2.0*f);
      vec2 uv = (p.xy + vec2(37.0, 17.0)*p.z) + f.xy;
      vec2 rg = texture2D(uNoise, (uv + 0.5)/256.0, -100.0).yx;
      return mix(rg.x, rg.y, f.z);
    }
    float FBM(vec3 p) {
      p *= 0.25;
      float f;
      f  = 0.5000 * Noise(p); p = p * 3.02;
      f += 0.2500 * Noise(p); p = p * 3.03;
      f += 0.1250 * Noise(p); p = p * 3.01;
      f += 0.0625 * Noise(p); p = p * 3.03;
      f += 0.03125 * Noise(p); p = p * 3.02;
      f += 0.015625 * Noise(p);
      return f;
    }
    float Map(vec3 p) {
      p *= 0.002;
      float h = FBM(p);
      return h - uCloudy - 0.5;
    }

    void main() {
      // Camera-relative ray direction. vRayDir is the local position attribute
      // (= offset from the camera since the mesh is positioned at camera each
      // frame). Normalising gives the world-space view ray independent of the
      // player's absolute position, so clouds don't "swim" as the player walks.
      vec3 rd = normalize(vRayDir);
      // Skip the lower hemisphere — clouds only live above the horizon.
      if (rd.y <= 0.02) {
        gl_FragColor = vec4(0.0);
        return;
      }
      // Synthetic camera position. The original Shadertoy oscillates camera Y
      // between ~100 and ~500. We hold it at 300 for a stable cloud silhouette
      // (player movement is folded in via uTime so clouds still drift).
      vec3 pos = vec3(0.0, 300.0, 0.0);

      float beg = ((CLOUD_LOWER - pos.y) / rd.y);
      float end = ((CLOUD_UPPER - pos.y) / rd.y);

      vec3 p = vec3(pos.x + rd.x * beg, 0.0, pos.z + rd.z * beg);
      // Per-ray noise jitter so the 45-step march doesn't band visibly.
      beg += Hash(p) * 150.0;

      vec3 add = rd * ((end - beg) / 45.0);
      vec2 shade;
      vec2 shadeSum = vec2(0.0, 0.0);
      float difference = CLOUD_UPPER - CLOUD_LOWER;
      shade.x = 0.01;
      // Match the Shadertoy step count for cloud silhouette quality.
      for (int i = 0; i < 55; i++) {
        if (shadeSum.y >= 1.0) break;
        float h = Map(p);
        shade.y = max(-h, 0.0);
        shade.x = p.y / difference; // grade by altitude, cheap shadow
        shadeSum += shade * (1.0 - shadeSum.y);
        p += add;
      }
      shadeSum.x /= 10.0;
      shadeSum = min(shadeSum, vec2(1.0));

      float sunAmount = max(dot(rd, uSunDir), 0.0);
      vec3 clouds = mix(vec3(pow(shadeSum.x, 0.4)), uSunColor, (1.0 - shadeSum.y) * 0.4);
      clouds += min((1.0 - sqrt(shadeSum.y)) * pow(sunAmount, 4.0), 1.0) * 2.0;
      clouds += uFlash * (shadeSum.y + shadeSum.x + 0.2) * 0.5;

      // Composite: alpha = coverage. Storm cloud darkens the sky by overwriting
      // it (premultiplied isn't needed since we use srcAlpha blending).
      gl_FragColor = vec4(clamp(clouds, 0.0, 1.0), shadeSum.y);
    }
  `,
};

/**
 * Volumetric storm cloud dome. Drop into the scene next to the existing
 * `Skybox` and call `update(delta, cameraPosition, cloudy, sunDir, sunColor, flash)`
 * each frame.
 *
 * Cost: 55-step raymarch per fragment. Coarse, but the existing skybox uses a
 * cube so the GPU only shades visible faces — front-facing skyward fragments
 * are the expensive ones. Acceptable for an event overlay (only renders when
 * `cloudy > 0`); we fade `material.opacity` to 0 below that to skip the work.
 */
export class StormClouds extends THREE.Mesh {
  constructor() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader: StormCloudShader.vertexShader,
      fragmentShader: StormCloudShader.fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uCloudy: { value: -0.5 }, // <0 = no clouds; matches Shadertoy "clear"
        uFlash: { value: new THREE.Color(0, 0, 0) },
        uSunDir: { value: new THREE.Vector3(0.35, 0.14, 0.3).normalize() },
        uSunColor: { value: new THREE.Color(1.0, 0.7, 0.55) },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uNoise: { value: getNoiseTexture() },
      },
      side: THREE.BackSide,
      depthWrite: false,
      transparent: true,
      fog: false,
    });
    super(geometry, material);
    this.frustumCulled = false;
    // Render after the base Skybox (renderOrder default 0, but skybox uses
    // gl_Position.xyww which sits at the far plane — both meshes paint over
    // each other on the far plane and the alpha blend handles compositing).
    this.renderOrder = 1;
    this.scale.setScalar(SKYBOX_SCALE);
    this.visible = false;
  }

  /**
   * @param cloudy   -1..1, Shadertoy convention. 0.2+ = stormy with lightning.
   * @param flash    additive flash colour from {@link Lightning}.
   */
  update(
    delta: number,
    cameraPosition: THREE.Vector3,
    cloudy: number,
    sunDir: THREE.Vector3,
    sunColor: THREE.Color,
    flash: THREE.Color
  ) {
    const m = this.material as THREE.ShaderMaterial;
    m.uniforms.uTime.value += delta;
    m.uniforms.uCloudy.value = cloudy;
    m.uniforms.uFlash.value.copy(flash);
    m.uniforms.uSunDir.value.copy(sunDir).normalize();
    m.uniforms.uSunColor.value.copy(sunColor);
    // Anchor to the camera so clouds always surround the player.
    this.position.copy(cameraPosition);
    // Skip the entire raymarch when there are no clouds to render.
    this.visible = cloudy > -0.4;
  }

  dispose() {
    this.geometry.dispose();
    (this.material as THREE.ShaderMaterial).dispose();
  }
}

/* ------------------------------------------------------------------------ */
/*  Rain overlay (screen-space)                                             */
/* ------------------------------------------------------------------------ */

const RainShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      // Identity transform — fullscreen-quad NDC positions baked into the
      // PlaneGeometry(2,2). No projection so this stays screen-space.
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  // Direct port of the rain block from the Weather shader's mainImage.
  fragmentShader: `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;
    uniform float uIntensity;  // 0..1 user-facing weather intensity
    uniform vec3 uFlash;
    uniform sampler2D uNoise;

    void main() {
      vec2 xy = vUv;
      // The shader builds streaks in screen space using two skewed noise
      // lookups. Using uv directly (range 0..1) instead of the normalized aspect
      // coords from the original is fine since rain streaks are radially
      // symmetric and the rotation parameter we don't expose was constant.
      vec2 uv = (-1.0 + 2.0 * xy);
      vec2 st = uv * vec2(0.5 + (xy.y + 1.0) * 0.3, 0.02)
              + vec2(uTime * 0.5 + xy.y * 0.2, uTime * 0.2);
      float f = texture2D(uNoise, st, -100.0).y
              * texture2D(uNoise, st * 0.773, -100.0).x * 1.55;
      // Same intensity ramp as the original: rain only appears when 'cloudy'
      // crosses 0.15. We pre-mapped that to uIntensity in the JS layer.
      float rain = clamp(uIntensity, 0.0, 1.0);
      f = clamp(pow(abs(f), 15.0) * 5.0 * (rain * rain * 125.0),
                0.0, (xy.y + 0.1) * 0.6);
      vec3 col = vec3(0.15, 0.15, 0.15) + uFlash;
      gl_FragColor = vec4(col, f);
    }
  `,
};

/**
 * Fullscreen rain overlay. Sits at very high `renderOrder` with depth test
 * off so it paints over everything (HUD-style). Driven by the same rain
 * intensity the storm clouds use.
 */
export class RainOverlay extends THREE.Mesh {
  constructor() {
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: RainShader.vertexShader,
      fragmentShader: RainShader.fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uFlash: { value: new THREE.Color(0, 0, 0) },
        uNoise: { value: getNoiseTexture() },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    super(geometry, material);
    this.frustumCulled = false;
    // High enough to render over post-fx but below the React HUD (which is
    // DOM, not WebGL — DOM always wins). 999 leaves room for in-scene effects.
    this.renderOrder = 999;
    this.visible = false;
  }

  update(delta: number, intensity: number, flash: THREE.Color) {
    const m = this.material as THREE.ShaderMaterial;
    m.uniforms.uTime.value += delta;
    m.uniforms.uIntensity.value = intensity;
    m.uniforms.uFlash.value.copy(flash);
    this.visible = intensity > 0.001;
  }

  dispose() {
    this.geometry.dispose();
    (this.material as THREE.ShaderMaterial).dispose();
  }
}

/* ------------------------------------------------------------------------ */
/*  Lightning (CPU-side flash event source)                                 */
/* ------------------------------------------------------------------------ */

/**
 * Stochastic lightning flash. Mirrors the Shadertoy `lightning` math
 * (`mod(gTime+1.5, 2.5)` + Hash-based jitter) but runs in JS so the same flash
 * value can drive the cloud shader's `uFlash` uniform AND a real ambient light
 * boost in the scene. Returns 0 when intensity is below the storm threshold.
 */
export class Lightning {
  private time = 0;
  /** Current flash brightness scalar, 0..1.5 (peaks brighter than 1 by design). */
  private currentFlash = 0;

  // Reused output objects to avoid per-frame allocations.
  private _color = new THREE.Color();
  private _hashSeed = 0x73a91f;
  private _hash(x: number): number {
    // Cheap 1D hash matching the Shadertoy `Hash(float p)` distribution.
    const v = Math.sin(x * 12.9898 + this._hashSeed) * 43758.5453;
    return v - Math.floor(v);
  }

  /**
   * @param intensity 0..1. Storm threshold is ~0.4 (matches Shadertoy `cloudy >= 0.2`
   *   after the 2x intensity-to-cloudy mapping in WeatherEvents).
   * @returns object with the flash colour for the cloud shader uniform AND a
   *   scalar 0..1.5 that callers can use to boost ambient/directional lights.
   */
  update(delta: number, intensity: number): { color: THREE.Color; brightness: number } {
    this.time += delta;
    const cloudy = intensity * 0.6 - 0.1; // map 0..1 intensity to ~-0.1..0.5 cloudy
    if (cloudy < 0.2) {
      this.currentFlash = 0;
      this._color.setScalar(0);
      return { color: this._color, brightness: 0 };
    }
    // Same trigger as Shadertoy: flash window is the first 0.8s of every 2.5s
    // cycle, with the peak intensity randomized by Hash(gTime*.3).
    const f = this.time % 2.5;
    let pulse = 0;
    if (f < 0.8) {
      // GLSL-style reverse smoothstep (1 at f=0, 0 at f=0.8). three.js
      // MathUtils.smoothstep clamps to 0 when x<=min, so we invert manually.
      const tRamp = THREE.MathUtils.smoothstep(f, 0.0, 0.8);
      const ramp = (1 - tRamp) * 1.5;
      // mod(-time*(1.5 - hash*0.002), 1.0) — this fluctuates per-frame, giving
      // the strobe effect of multiple sub-flashes within one strike.
      const h = this._hash(this.time * 0.3) * 0.002;
      const jitter = ((-this.time * (1.5 - h)) % 1 + 1) % 1;
      pulse = jitter * ramp;
    }
    // Smooth decay so the flash doesn't pop binary on/off between frames.
    this.currentFlash = Math.max(this.currentFlash * Math.exp(-delta * 6), pulse);
    const v = THREE.MathUtils.clamp(this.currentFlash, 0, 1);
    this._color.setRGB(v, v, v * 1.2);
    return { color: this._color, brightness: this.currentFlash };
  }
}
