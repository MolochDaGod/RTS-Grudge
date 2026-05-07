/**
 * IntroStormDome — animated raymarched cloud backdrop for the intro
 * cutscene. Direct port of Inigo Quilez's "Clouds" Shadertoy
 * (https://www.shadertoy.com/view/Xd23zh) wrapped as a sky-far-plane
 * fullscreen quad so it composites behind every other intro element.
 *
 * The original shader sampled a 256x256 noise texture (`iChannel0`)
 * for noise, dithering and per-chunk camera randomisation. We don't
 * have that texture in-bundle, so the texture lookups are replaced
 * with hash-based 2D value noise that produces a near-identical
 * volumetric look without any asset I/O.
 *
 * Uniforms exposed:
 *   uTime      — seconds; drives cloud advection + camera shake
 *   uIntensity — 0..1 storm strength; scales the original `ani.x`
 *                lightning-flash factor and bumps cloud density.
 *
 * The dome is forced to the far plane via `gl_Position = pos.xyww`
 * (same trick StormClouds uses) so it never clips into geometry.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // Force to far plane so the dome composites behind everything else
    // (matches WeatherPrimitives' StormClouds technique).
    gl_Position = pos.xyww;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uResolution;
  uniform float uIntensity;

  // ----------------------------------------------------------------
  //  Procedural replacement for the original iChannel0 texture
  //  lookups. The Shadertoy noise was a 256x256 RG-packed value-
  //  noise tile sampled with mip bias -100 (ie nearest-tap). A 2D
  //  hash-based smoothed value noise reproduces the same look.
  // ----------------------------------------------------------------
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 x) {
    vec2 p = floor(x);
    vec2 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(p);
    float b = hash21(p + vec2(1.0, 0.0));
    float c = hash21(p + vec2(0.0, 1.0));
    float d = hash21(p + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // 2D noise (replaces texture2D(iChannel0, uv).x)
  float noise2(vec2 x) {
    return vnoise(x);
  }
  // 3D noise (replaces 2D-tile-with-z-offset trick from the original)
  float noise3(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    vec2 uv = p.xy + vec2(37.0, 17.0) * p.z + f.xy;
    float a = vnoise(uv);
    float b = vnoise(uv + vec2(37.0, 17.0));
    return mix(a, b, f.z);
  }

  // ---- IQ cloud map ------------------------------------------------
  vec4 cloudMap(vec3 p, vec2 ani) {
    vec3 r = p;
    float h = (0.7 + 0.3 * ani.x) * noise2(0.76 * r.xz);
    r.y -= h;
    float den = -(r.y + 2.5);
    r += 0.2 * vec3(0.0, 0.0, 1.0) * ani.y;

    vec3 q = 2.5 * r * vec3(1.0, 1.0, 0.15)
           + vec3(1.0, 1.0, 1.0) * ani.y * 0.15;
    float f;
    f  = 0.50000 * noise3(q); q = q * 2.02 - vec3(-1.0, 1.0, -1.0) * ani.y * 0.15;
    f += 0.25000 * noise3(q); q = q * 2.03 + vec3( 1.0,-1.0, 1.0) * ani.y * 0.15;
    f += 0.12500 * noise3(q); q = q * 2.01 - vec3( 1.0, 1.0,-1.0) * ani.y * 0.15;
    q.z *= 4.0;
    f += 0.06250 * noise3(q); q = q * 2.02 + vec3( 1.0, 1.0, 1.0) * ani.y * 0.15;
    f += 0.03125 * noise3(q);

    float es = 1.0 - clamp((r.y + 1.0) / 0.26, 0.0, 1.0);
    f += f * (1.0 - f) * 0.6 * sin(q.z) * es;
    den = clamp(den + 4.4 * f, 0.0, 1.0);

    vec3 col = mix(vec3(0.2, 0.3, 0.3), vec3(1.0, 1.0, 1.0),
                   clamp((r.y + 2.5) / 3.0, 0.0, 1.0));
    col = mix(col, 3.0 * vec3(1.0, 1.1, 1.20) * (0.2 + 0.8 * ani.x), es);
    col *= mix(vec3(0.1, 0.32, 0.38), vec3(1.05, 0.95, 0.75), f * 1.2);
    col = col * (0.8 - 0.5 * ani.x)
        + ani.x * 2.0 * smoothstep(0.75, 0.86,
                                    sin(10.0 * ani.y + 2.0 * r.z + r.x * 10.0))
                     * smoothstep(0.6, 0.8, f)
                     * vec3(1.0, 0.8, 0.5)
                     * smoothstep(0.7, 0.9, noise3(q.yx + vec2(0.0)));
    return vec4(col, den);
  }

  vec3 raymarch(vec3 ro, vec3 rd, vec2 ani, vec2 pixel) {
    vec3 bgc = vec3(0.6, 0.7, 0.7) + 0.3 * rd.y;
    bgc *= 0.2;
    float t = 0.03 * vnoise(pixel);

    // 80 steps instead of the original 150 — keeps the look but makes
    // the shader cheap enough to run as a fullscreen backdrop on
    // mid-range GPUs during the cinematic.
    vec4 sum = vec4(0.0);
    for (int i = 0; i < 80; i++) {
      if (sum.a > 0.99) continue;
      vec3 pos = ro + t * rd;
      vec4 col = cloudMap(pos, ani);
      vec3 lig = normalize(vec3(-1.0, 1.0, -1.0));
      float dif = 0.1 + 0.4 * (col.w - cloudMap(pos + lig * 0.15, ani).w);
      col.xyz += dif;
      col.xyz = mix(col.xyz, bgc, 1.0 - exp(-0.005 * t * t));
      col.rgb *= col.a;
      sum = sum + col * (1.0 - sum.a);
      t += 0.03 + t * 0.012;
    }
    sum.xyz = mix(bgc, sum.xyz / (sum.w + 0.0001), sum.w);
    return clamp(sum.xyz, 0.0, 1.0);
  }

  void main() {
    vec2 fragCoord = vUv * uResolution;
    vec2 q = vUv;
    vec2 p = -1.0 + 2.0 * q;
    p.x *= uResolution.x / uResolution.y;

    float time = uTime;

    // ani.x  = lightning-flash strength (0..uIntensity)
    // ani.y  = cloud advection time in shader units
    vec2 ani;
    float ati = time / 17.0;
    float pt  = mod(ati, 2.0);
    ani.x = (smoothstep(0.3, 0.7, pt) - smoothstep(1.3, 1.7, pt))
          * (0.4 + 0.6 * uIntensity);
    float it = floor(0.75 + ati * 0.5 + 0.1);
    float ft = fract(0.75 + ati * 0.5 + 0.1);
    ft = smoothstep(0.0, 0.6, ft);
    ani.y = time * 0.15 + 30.0 * (it + ft);

    // Per-chunk camera randomisation (was a texture lookup); use a
    // hash on the chunk index instead so the camera still cuts to
    // new angles every 5.5 seconds like the original.
    float chunk = floor(1.0 + time / 5.5);
    vec2 cP = vec2(hash21(chunk * vec2(5.0, 7.0) / 256.0),
                   hash21(chunk * vec2(5.0, 7.0) / 256.0 + 0.13));
    float cZ = hash21(chunk * vec2(5.0, 7.0) / 256.0 + 0.27);

    vec3 ro = 4.0 * normalize(vec3(
      cos(30.0 * cP.x + 0.023 * time),
      0.3 + 0.2 * sin(30.0 * cP.x + 0.08 * time),
      sin(30.0 * cP.x + 0.023 * time)
    ));
    vec3 ta = vec3(0.0);
    float cr = 0.25 * cos(30.0 * cP.y + 0.1 * time);

    // Storm-driven camera shake (matches the original ani.x*ani.x trick)
    vec3 sh = -1.0 + 2.0 * vec3(
      vnoise(1.035 * time * vec2(0.010, 0.014)),
      vnoise(1.035 * time * vec2(0.018, 0.011) + 13.0),
      vnoise(1.035 * time * vec2(0.013, 0.008) + 27.0)
    );
    ro += ani.x * ani.x * 0.05 * sh;
    ta += ani.x * ani.x * 0.20 * sh;

    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(vec3(sin(cr), cos(cr), 0.0), ww));
    vec3 vv = normalize(cross(ww, uu));
    vec3 rd = normalize(p.x * uu + p.y * vv
                      + (2.5 + 3.5 * pow(cZ, 2.0)) * ww);

    vec3 col = raymarch(ro, rd, ani, fragCoord);

    // Contrast / desaturation / vignette / scene-cut wipe — straight
    // from the original.
    col = col * col * (3.0 - 2.0 * col);
    col = mix(col, vec3(dot(col, vec3(0.33))), -0.5);
    col *= 0.25 + 0.75 * pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.1);
    col *= 1.0 - smoothstep(0.4, 0.5, abs(fract(time / 5.5) - 0.5))
               * (1.0 - sqrt(ani.x));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface IntroStormDomeProps {
  /** 0..1 — drives cloud density and lightning-flash strength. */
  intensity?: number;
}

export function IntroStormDome({ intensity = 0.85 }: IntroStormDomeProps) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  // Build the material once — uniforms get poked from useFrame.
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1280, 720) },
        uIntensity: { value: intensity },
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      transparent: false,
    });
  }, []);

  useFrame((state) => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uTime.value = state.clock.elapsedTime;
    m.uniforms.uIntensity.value = intensity;
    const size = state.size;
    m.uniforms.uResolution.value.set(size.width, size.height);
  });

  // Inverted box around the camera (radius 500 — well past the intro
  // raft at ~0,0,0 and the EnemyShip at ~+30,0,0). renderOrder=-1000
  // so it draws first; the far-plane Z trick keeps it behind the
  // depth-tested scene geometry.
  return (
    <mesh renderOrder={-1000} frustumCulled={false}>
      <boxGeometry args={[1000, 1000, 1000]} />
      <primitive ref={matRef} object={material} attach="material" />
    </mesh>
  );
}
