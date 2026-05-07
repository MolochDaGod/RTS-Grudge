import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { MAX_HEIGHT } from "./TerrainHeightField";

// Unified terrain shader: grass on top, sand on the beaches, with triplanar
// sampling on the sand layer so dunes don't show vertical stretching, plus
// a brush-ring overlay used by the shovel editor.
//
// Implemented as a `MeshStandardMaterial` with an `onBeforeCompile` patch
// rather than a from-scratch ShaderMaterial. This keeps Three's built-in
// lighting, shadow casting/receiving and tone-mapping intact — writing
// those by hand is a recipe for the terrain looking flat compared to the
// rest of the scene.
//
// Uniforms exposed to the brush editor (mutate `material.userData.uniforms`):
//   uBrushCenter (vec2 xz, world-space)
//   uBrushRadius (float, world-space metres)
//   uBrushColor  (vec3 rgb, ring colour)
//   uBrushActive (float, 0 = hidden, 1 = visible)

export interface SandTerrainMaterialProps {
  /** Override grass texture path. Defaults to the existing world grass. */
  grassUrl?: string;
  /** Override sand texture path. Defaults to `M_Sand_diffuse.png`. */
  sandUrl?: string;
  /** World-space metres for one full grass tile. Lower = denser pattern. */
  grassRepeat?: number;
  /** World-space metres for one full sand tile (triplanar). */
  sandRepeat?: number;
}

export function useSandTerrainMaterial(opts: SandTerrainMaterialProps = {}): THREE.MeshStandardMaterial {
  const grassUrl = opts.grassUrl ?? "/textures/grass_detailed.png";
  const sandUrl = opts.sandUrl ?? "/textures/M_Sand_diffuse.png";
  const grassRepeat = opts.grassRepeat ?? 5; // metres per tile (40 tiles across 200m)
  const sandRepeat = opts.sandRepeat ?? 4;

  const grass = useTexture(grassUrl);
  const sand = useTexture(sandUrl);

  return useMemo(() => {
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
    sand.wrapS = sand.wrapT = THREE.RepeatWrapping;
    grass.colorSpace = THREE.SRGBColorSpace;
    sand.colorSpace = THREE.SRGBColorSpace;
    // Vertex UVs run 0..1 across the whole 200m plane so the per-metre
    // tile rate is encoded by repeating the UVs in the shader instead of
    // on the texture itself. This lets us re-tile freely without losing
    // crispness at oblique camera angles.
    grass.repeat.set(1, 1);
    sand.repeat.set(1, 1);

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
    });

    const uniforms: Record<string, THREE.IUniform> = {
      uGrassMap: { value: grass },
      uSandMap: { value: sand },
      uGrassRepeatM: { value: grassRepeat },
      uSandRepeatM: { value: sandRepeat },
      // Beach blend band — sand below `uSandHigh`, grass above `uGrassLow`,
      // smooth crossfade in between.
      uSandHigh: { value: MAX_HEIGHT * 0.13 },
      uGrassLow: { value: MAX_HEIGHT * 0.05 },
      // Wet sand near the waterline (Y ≈ 0).
      uWetLine: { value: 0.0 },
      uWetBand: { value: 0.4 },
      uWetTint: { value: new THREE.Color("#7a6a55") },
      // Brush overlay (set by TerrainEditor each frame).
      uBrushCenter: { value: new THREE.Vector2(0, 0) },
      uBrushRadius: { value: 0 },
      uBrushColor: { value: new THREE.Color("#ffd470") },
      uBrushActive: { value: 0 },
    };

    mat.userData.uniforms = uniforms;

    mat.onBeforeCompile = (shader) => {
      // Merge our uniforms in. We keep references through `mat.userData`
      // so the editor can write to them without going through the shader.
      Object.assign(shader.uniforms, uniforms);

      // Pass world-space position to the fragment shader so we can do
      // triplanar sampling and a height-based grass/sand blend without
      // depending on the (single-channel) UV layout.
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vWorldPos;
varying vec3 vWorldNormal;`,
        )
        .replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>
vWorldPos = worldPosition.xyz;
// World-space normal — Three's stock vNormal is in view space, which
// would make our triplanar weights swim as the camera moves
// (architect callout). Multiply by the model's normal matrix so it
// stays put as the camera rotates.
vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
uniform sampler2D uGrassMap;
uniform sampler2D uSandMap;
uniform float uGrassRepeatM;
uniform float uSandRepeatM;
uniform float uSandHigh;
uniform float uGrassLow;
uniform float uWetLine;
uniform float uWetBand;
uniform vec3  uWetTint;
uniform vec2  uBrushCenter;
uniform float uBrushRadius;
uniform vec3  uBrushColor;
uniform float uBrushActive;

// Triplanar sand: sample the sand texture from three orthogonal planes
// and blend by world-normal weights. Dramatically reduces the vertical
// stretching you'd otherwise see on dune slopes.
vec3 triplanarSand(vec3 worldPos, vec3 worldN, float scale) {
  vec2 uvX = worldPos.zy / scale;
  vec2 uvY = worldPos.xz / scale;
  vec2 uvZ = worldPos.xy / scale;
  vec3 w = abs(worldN);
  w = pow(w, vec3(4.0));
  w /= max(w.x + w.y + w.z, 1e-4);
  vec3 cX = texture2D(uSandMap, uvX).rgb;
  vec3 cY = texture2D(uSandMap, uvY).rgb;
  vec3 cZ = texture2D(uSandMap, uvZ).rgb;
  return cX * w.x + cY * w.y + cZ * w.z;
}`,
        )
        .replace(
          "#include <map_fragment>",
          `// --- Custom terrain map fragment (sand + grass + wet line + brush)
{
  vec3 worldN = normalize(vWorldNormal);
  vec3 grassCol = texture2D(uGrassMap, vWorldPos.xz / uGrassRepeatM).rgb;
  vec3 sandCol  = triplanarSand(vWorldPos, worldN, uSandRepeatM);

  // Height-based blend: sand below uSandHigh, grass above. Use a smooth
  // crossfade band so beach edges aren't a hard line.
  float h = vWorldPos.y;
  float sandToGrass = smoothstep(uGrassLow, uSandHigh, h);
  vec3 baseCol = mix(sandCol, grassCol, sandToGrass);

  // Wet sand near the waterline darkens and slightly desaturates.
  float wet = 1.0 - smoothstep(uWetLine, uWetLine + uWetBand, h);
  baseCol = mix(baseCol, baseCol * uWetTint, wet * (1.0 - sandToGrass));

  // Multiply through the vertex-color slope/height tint that the CPU
  // bakes (rocks on cliffs, snow on peaks, etc.) so existing terrain
  // colouring still reads.
  vec4 sampledDiffuseColor = vec4(baseCol, 1.0);
  diffuseColor *= sampledDiffuseColor;

  // Brush ring overlay — soft additive ring at the brush perimeter so
  // the player can see exactly where the shovel will hit.
  if (uBrushActive > 0.5 && uBrushRadius > 0.0) {
    float d = distance(vWorldPos.xz, uBrushCenter);
    float ring = 1.0 - smoothstep(0.04 * uBrushRadius, 0.10 * uBrushRadius, abs(d - uBrushRadius));
    float fill = (1.0 - smoothstep(0.0, uBrushRadius, d)) * 0.18;
    diffuseColor.rgb += uBrushColor * (ring * 0.55 + fill);
  }
}`,
        );
    };

    // onBeforeCompile output is cached per-program; force recompile when
    // we hot-swap the material.
    mat.needsUpdate = true;
    return mat;
  }, [grass, sand, grassRepeat, sandRepeat]);
}

export type SandTerrainUniforms = {
  uBrushCenter: { value: THREE.Vector2 };
  uBrushRadius: { value: number };
  uBrushColor: { value: THREE.Color };
  uBrushActive: { value: number };
};

export function getSandTerrainUniforms(mat: THREE.Material): SandTerrainUniforms | null {
  const u = (mat.userData as { uniforms?: SandTerrainUniforms })?.uniforms;
  return u && u.uBrushCenter ? u : null;
}
