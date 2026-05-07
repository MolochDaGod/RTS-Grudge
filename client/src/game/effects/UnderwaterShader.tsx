import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

import { SEABED_VISUAL_Y, WATER_SURFACE_Y } from "./WaterVolume";

/**
 * Underwater volume shader, ported from the Shadertoy fragment program
 * at https://www.shadertoy.com/view/4ljXWh (CC BY-NC-SA 3.0). Renders a
 * self-contained underwater scene — raymarched seabed, animated
 * caustics, god rays, and tumbling bubbles — onto the BACK faces of a
 * box that fills the volume between the surface sheet and the seabed.
 * From above the box the material is invisible; once the camera dips
 * below the surface the player is enveloped by the dreamy view.
 *
 * Iterations on top of the original Shadertoy port:
 *   - Screen-space coordinates are derived from `gl_FragCoord` rather
 *     than the box's per-face UVs, so the six box faces show one
 *     continuous image instead of six seamed copies.
 *   - The depth-fog horizon is parameterized by uTopY/uBottomY so the
 *     fog scales correctly to the actual ~6 m volume rather than the
 *     unrelated screen-space `tmax = 20.0` of the original.
 *   - The seabed terrain (built from the noise textures) replaces the
 *     scene's separate sand sheet; the shader paints the floor itself.
 */

const VERT = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform float iGlobalTime;
  uniform vec3  iResolution;   // x = width px, y = height px, z = aspect
  uniform vec4  iMouse;
  uniform sampler2D iChannel0; // noise
  uniform sampler2D iChannel1; // noise
  uniform sampler2D iChannel2; // sand / seabed diffuse

  // World-space top/bottom of the underwater volume. Used to scale fog
  // so the visual depth matches the actual physical depth of the box.
  uniform float uTopY;
  uniform float uBottomY;

  #define TAU 6.28318530718
  #define MAX_ITER 5

  float speck(vec2 pos, vec2 uv, float radius) {
    pos.y += 0.05;
    float color = distance(pos, uv);
    vec3 tex  = texture2D(iChannel0, sin(vec2(uv) * 10.1)).xyz;
    vec3 tex2 = texture2D(iChannel0, sin(vec2(pos) * 10.1)).xyz;
    color = clamp((1.0 - pow(color * (5.0 / radius), pow(radius, 0.9))), 0.0, 1.0);
    color *= clamp(mix(sin(tex.y) + 0.1, cos(tex.x), 0.5) * sin(tex2.x) + 0.2, 0.0, 1.0);
    return color;
  }

  vec3 caustic(vec2 uv) {
    vec2 p = mod(uv * TAU, TAU) - 250.0;
    float time = iGlobalTime * 0.5 + 23.0;

    vec2 i = vec2(p);
    float c = 1.0;
    float inten = 0.005;

    for (int n = 0; n < MAX_ITER; n++) {
      float t = time * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
    }

    c /= float(MAX_ITER);
    c = 1.17 - pow(c, 1.4);
    vec3 color = vec3(pow(abs(c), 8.0));
    color = clamp(color + vec3(0.0, 0.35, 0.5), 0.0, 1.0);
    color = mix(color, vec3(1.0, 1.0, 1.0), 0.3);

    return color;
  }

  // Y-eliminated caustic, used by the god-ray pass.
  float causticX(float x, float power, float gtime) {
    float p = mod(x * TAU, TAU) - 250.0;
    float time = gtime * 0.5 + 23.0;

    float i = p;
    float c = 1.0;
    float inten = 0.005;

    // Literal 2 (i.e. MAX_ITER divided by 2) - WebGL1 GLSL ES 1.0
    // requires for-loop bounds to be constant expressions, and some
    // drivers reject the division form even though the result is a
    // compile-time constant. Hardcoding 2 sidesteps the footgun.
    for (int n = 0; n < 2; n++) {
      float t = time * (1.0 - (3.5 / float(n + 1)));
      i = p + cos(t - i) + sin(t + i);
      c += 1.0 / length(p / (sin(i + t) / inten));
    }
    c /= float(MAX_ITER);
    c = 1.17 - pow(c, power);
    return c;
  }

  float GodRays(vec2 uv) {
    float light = 0.0;
    light += pow(causticX((uv.x + 0.08 * uv.y) / 1.7 + 0.5, 1.8, iGlobalTime * 0.65), 10.0) * 0.05;
    light -= pow((1.0 - uv.y) * 0.3, 2.0) * 0.2;
    light += pow(causticX(sin(uv.x), 0.3, iGlobalTime * 0.7), 9.0) * 0.4;
    light += pow(causticX(cos(uv.x * 2.3), 0.3, iGlobalTime * 1.3), 4.0) * 0.1;
    light -= pow((1.0 - uv.y) * 0.3, 3.0);
    light = clamp(light, 0.0, 1.0);
    return light;
  }

  float fbmNoise(in vec2 p) {
    float height  = mix(texture2D(iChannel0, p / 80.0,  -100.0).x, 1.0,  0.85);
    float height2 = mix(texture2D(iChannel1, p / 700.0, -200.0).x, 0.0, -3.5);
    return height2 - height - 0.179;
  }

  float fBm(in vec2 p) {
    float sum = 0.0;
    float amp = 1.0;
    for (int i = 0; i < 4; i++) {
      sum += amp * fbmNoise(p);
      amp *= 0.5;
      p *= 2.5;
    }
    return sum * 0.5 + 0.15;
  }

  vec3 raymarchTerrain(in vec3 ro, in vec3 rd, in float tmin, in float tmax) {
    float t = tmin;
    vec3 res = vec3(-1.0);

    for (int i = 0; i < 110; i++) {
      vec3 p = ro + rd * t;
      res = vec3(vec2(0.0, p.y - fBm(p.xz)), t);
      float d = res.y;
      if (d < (0.001 * t) || t > tmax) break;
      t += 0.5 * d;
    }
    return res;
  }

  vec3 getTerrainNormal(in vec3 p) {
    float eps = 0.025;
    return normalize(vec3(
      fBm(vec2(p.x - eps, p.z)) - fBm(vec2(p.x + eps, p.z)),
      2.0 * eps,
      fBm(vec2(p.x, p.z - eps)) - fBm(vec2(p.x, p.z + eps))
    ));
  }

  void main() {
    vec3 skyColor      = vec3(0.3, 1.0, 1.0);
    vec3 sunLightColor = vec3(1.7, 0.65, 0.65);
    vec3 skyLightColor = vec3(0.8, 0.35, 0.15);
    vec3 horizonColor  = vec3(0.0, 0.05, 0.2);
    vec3 sunDirection  = normalize(vec3(0.8, 0.8, 0.6));

    // Canonical Shadertoy screen-space remap, fed off gl_FragCoord so
    // the six box faces produce one continuous image without seams.
    vec2 p = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;

    vec3 eye = vec3(0.0, 1.25, 1.5);
    vec2 rot = 6.2831 * (vec2(-0.05 + iGlobalTime * 0.01, 0.0 - sin(iGlobalTime * 0.5) * 0.01)
                        + vec2(1.0, 0.0) * (iMouse.xy - iResolution.xy * 0.25) / iResolution.x);
    eye.yz = cos(rot.y) * eye.yz + sin(rot.y) * eye.zy * vec2(-1.0, 1.0);
    eye.xz = cos(rot.x) * eye.xz + sin(rot.x) * eye.zx * vec2(1.0, -1.0);

    vec3 ro = eye;
    vec3 ta = vec3(0.5, 1.0, 0.0);

    vec3 cw = normalize(ta - ro);
    vec3 cu = normalize(cross(vec3(0.0, 1.0, 0.0), cw));
    vec3 cv = normalize(cross(cw, cu));
    mat3 cam = mat3(cu, cv, cw);

    vec3 rd = cam * normalize(vec3(p.xy, 1.0));

    vec3 color = skyColor;
    float sky = 0.0;

    float tmin = 0.1;
    float tmax = 20.0;
    vec3 res = raymarchTerrain(ro, rd, tmin, tmax);

    // Bubbles drifting across the foreground.
    vec3 colorBubble = vec3(0.0);
    float bubble = 0.0;
    bubble += speck(vec2(sin(iGlobalTime * 0.32), cos(iGlobalTime) * 0.2 + 0.1), rd.xy, -0.08 * rd.z);
    bubble += speck(vec2(sin(1.0 - iGlobalTime * 0.39) + 0.5, cos(1.0 - iGlobalTime * 0.69) * 0.2 + 0.15), rd.xy, 0.07 * rd.z);
    bubble += speck(vec2(cos(1.0 - iGlobalTime * 0.5) - 0.5, sin(1.0 - iGlobalTime * 0.36) * 0.2 + 0.1), rd.xy, 0.12 * rd.z);
    bubble += speck(vec2(sin(iGlobalTime * 0.44) - 1.0, cos(1.0 - iGlobalTime * 0.32) * 0.2 + 0.15), rd.xy, -0.09 * rd.z);
    bubble += speck(vec2(1.0 - sin(1.0 - iGlobalTime * 0.6) - 1.3, sin(1.0 - iGlobalTime * 0.82) * 0.2 + 0.1), rd.xy, 0.15 * rd.z);

    colorBubble = bubble * vec3(0.2, 0.7, 1.0);
    if (rd.z < 0.1) {
      for (float x = 0.39; x < 6.28; x += 0.39) {
        vec3 height = texture2D(iChannel0, vec2(x)).xyz;
        bubble = speck(
          vec2(sin(iGlobalTime + x) * 0.5 + 0.2,
               cos(iGlobalTime * height.z * 2.1 + height.x * 1.7) * 0.2 + 0.2),
          rd.xy,
          (cos(iGlobalTime + height.y * 2.3 + rd.z * -1.0) * -0.01 + 0.25)
        );
        colorBubble += bubble * vec3(-0.1 * rd.z, -0.5 * rd.z, 1.0);
      }
    }

    float t = res.z;

    if (t < tmax) {
      vec3 pos = ro + rd * t;
      vec3 nor = getTerrainNormal(pos);
      nor = normalize(nor + 0.5 * getTerrainNormal(pos * 8.0));

      float sun = clamp(dot(sunDirection, nor), 0.0, 1.0);
      sky = clamp(0.5 + 0.5 * nor.y, 0.0, 1.0);

      vec3 diffuse = mix(
        texture2D(iChannel2, vec2(pos.x * pow(pos.y, 0.01), pos.z * pow(pos.y, 0.01))).xyz,
        vec3(1.0, 1.0, 1.0),
        clamp(1.1 - pos.y, 0.0, 1.0)
      );

      diffuse *= caustic(vec2(mix(pos.x, pos.y, 0.2), mix(pos.z, pos.y, 0.2)) * 1.1);
      vec3 lightColor = 1.0 * sun * sunLightColor;
      lightColor += 0.7 * sky * skyLightColor;

      color *= 0.8 * diffuse * lightColor;

      // Depth-fog density scales with the actual physical volume depth
      // (uTopY - uBottomY metres). For the original 20-unit screen-space
      // distance this collapses back to ~0.3, so deeper volumes still
      // feel deep without going pitch-black in shallow ones.
      float volumeDepth = max(0.5, uTopY - uBottomY);
      float fogK = 0.3 * (6.0 / volumeDepth);
      color = mix(color, horizonColor, 1.0 - exp(-fogK * pow(t, 1.0)));
    } else {
      sky = clamp(0.8 * (1.0 - 0.8 * rd.y), 0.0, 1.0);
      color = sky * skyColor;
      color += ((0.3 * caustic(vec2(p.x, p.y * 1.0))) + (0.3 * caustic(vec2(p.x, p.y * 2.7)))) * pow(p.y, 4.0);
      color = mix(color, horizonColor, pow(1.0 - pow(rd.y, 4.0), 20.0));
    }

    color += colorBubble;
    color += GodRays(p) * mix(skyColor.x, 1.0, p.y * p.y) * vec3(0.7, 1.0, 1.0);

    vec3 gamma = vec3(0.46);
    gl_FragColor = vec4(pow(color, gamma), 1.0);
  }
`;

interface UnderwaterShaderMaterialProps {
  /** When true, the material uses BackSide so it's only visible from
   *  inside the box volume (i.e. when the player is underwater). */
  insideOnly?: boolean;
  /** Top of the underwater volume in world Y (the surface). */
  topY: number;
  /** Bottom of the underwater volume in world Y (the seabed). */
  bottomY: number;
}

/**
 * R3F wrapper material. Hooks into the render loop to feed `iGlobalTime`
 * and `iResolution`. Pulls three textures from disk and configures them
 * for tiling.
 */
export function UnderwaterShaderMaterial({
  insideOnly = true,
  topY,
  bottomY,
}: UnderwaterShaderMaterialProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  // iChannel0 = noise; iChannel1 = noise (also "tex03" in the original);
  // iChannel2 = sand for the seabed diffuse.
  const [noiseTex, tex03A, tex03B] = useTexture([
    "/textures/vfx/noise_03.png",
    "/textures/vfx/noise_03.png",
    "/textures/sand.jpg",
  ]) as THREE.Texture[];

  for (const tex of [noiseTex, tex03A, tex03B]) {
    if (tex) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.colorSpace = THREE.NoColorSpace;
    }
  }

  const uniforms = useMemo(
    () => ({
      iGlobalTime: { value: 0 },
      iResolution: { value: new THREE.Vector3(1, 1, 1) },
      iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
      iChannel0: { value: noiseTex },
      iChannel1: { value: tex03A },
      iChannel2: { value: tex03B },
      uTopY: { value: topY },
      uBottomY: { value: bottomY },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [noiseTex, tex03A, tex03B],
  );

  useFrame((state) => {
    if (!matRef.current) return;
    matRef.current.uniforms.iGlobalTime.value = state.clock.elapsedTime;
    const w = state.size.width;
    const h = Math.max(1, state.size.height);
    const dpr = state.viewport.dpr || 1;
    const res = matRef.current.uniforms.iResolution.value as THREE.Vector3;
    // gl_FragCoord lives in physical pixels; iResolution should match.
    res.set(w * dpr, h * dpr, w / h);
    matRef.current.uniforms.uTopY.value = topY;
    matRef.current.uniforms.uBottomY.value = bottomY;
  });

  return (
    <shaderMaterial
      ref={matRef}
      vertexShader={VERT}
      fragmentShader={FRAG}
      uniforms={uniforms}
      side={insideOnly ? THREE.BackSide : THREE.DoubleSide}
      depthWrite={true}
      transparent={false}
      toneMapped={false}
    />
  );
}

interface UnderwaterVolumeProps {
  /** y of the upper water sheet (the surface). Defaults to WATER_SURFACE_Y. */
  topY?: number;
  /** y of the lower bound (the seabed). Defaults to SEABED_VISUAL_Y (~6m). */
  bottomY?: number;
  /** Horizontal extent of the volume (centered on origin in x/z). */
  size: number;
  /** Optional center offset in x/z. */
  center?: [number, number];
}

/**
 * A box that fills the volume between the two water sheets. The shader
 * is applied to the inside (back faces), so when the player's camera
 * crosses below the surface they're enveloped by the underwater view;
 * from above the box is invisible.
 */
export default function UnderwaterVolume({
  topY = WATER_SURFACE_Y,
  bottomY = SEABED_VISUAL_Y,
  size,
  center = [0, 0],
}: UnderwaterVolumeProps) {
  const height = Math.max(0.01, topY - bottomY);
  const cy = (topY + bottomY) * 0.5;
  return (
    <mesh position={[center[0], cy, center[1]]} renderOrder={-10}>
      <boxGeometry args={[size, height, size]} />
      <UnderwaterShaderMaterial insideOnly topY={topY} bottomY={bottomY} />
    </mesh>
  );
}
