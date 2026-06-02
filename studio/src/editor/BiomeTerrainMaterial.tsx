/**
 * BiomeTerrainMaterial — splat-shader terrain material that blends 5 biome
 * surfaces (grass / sand / mud / rock / dirt) by world height, slope, and
 * a low-frequency noise mask.
 *
 * TEXTURE UNIT BUDGET
 * WebGL / WebGL2 guarantees MAX_TEXTURE_IMAGE_UNITS ≥ 16 in the fragment
 * shader.  Three.js MeshStandardMaterial always reserves 1-2 units for its
 * own built-ins (shadow map, optional envMap).  That leaves at most 14 for
 * custom samplers.
 *
 * This shader uses exactly 10 custom sampler2D uniforms:
 *   5 baseColor  (uGrassMap … uDirtMap)
 *   5 normalMap  (uGrassNorm … uDirtNorm)
 * = 10 custom + ≤2 Three.js = ≤12 — comfortably within the budget.
 *
 * ARM (AO/Roughness/Metalness) textures were the 6th–15th custom samplers
 * and pushed the total over 16.  They have been replaced by per-biome
 * constant roughness values (the same values that were already used as
 * fallbacks in the old `mix()` expressions), so the visual result is
 * identical on biomes that never had an ARM map (mud, dirt) and
 * indistinguishably close for those that did.
 */
import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useJungleJimsBiomes } from '../library/JungleJimsTextures';
import { useEditor } from './store';

/**
 * Tile factor: how many texture repeats per world unit.
 * 0.10 = one repeat every ~10 world metres — tuned for the 2K PBR textures
 * to look crisp without visible tiling at normal camera distances.
 * (Previous value of 0.045 made tiles 22m wide which looked blurry/flat.)
 */
const TEX_TILE = 0.10;


interface Props {
  envIntensity?: number;
}

export function BiomeTerrainMaterial({ envIntensity = 0.5 }: Props) {
  const weather = useEditor((s) => s.env.weather);
  const biomes  = useJungleJimsBiomes(weather);

  // Make sure each texture has the per-biome tile multiplier baked into its
  // .repeat so we get correct mip-LOD selection — varying *only* in the UV
  // calculation defeats the GPU's built-in derivative-based LOD.
  // The shader still applies a per-biome `wuv * Nx` multiplier on top, but
  // texture.repeat governs how the mips are pre-filtered.
  useEffect(() => {
    /* Only base + normal textures are bound as samplers now; ARM is unused. */
    const allTex: (THREE.Texture | null)[] = [];
    for (const slot of Object.values(biomes)) {
      allTex.push(slot.base, slot.normal);
    }
    for (const t of allTex) {
      if (!t) continue;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1, 1);
      t.needsUpdate = true;
    }
  }, [biomes]);

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.FrontSide,
      // Default roughness/metalness are overridden per-pixel by the splat
      // shader below; these are just the fallback used when a sampler is null.
      roughness: 0.92,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: 4,
      polygonOffsetUnits: 4,
      envMapIntensity: envIntensity,
    });

    /* 10 custom sampler2D uniforms total (5 base + 5 normals).
     * ARM textures removed to stay under MAX_TEXTURE_IMAGE_UNITS = 16.
     * Per-biome roughness is now a compile-time constant in the shader. */
    mat.userData.uniforms = {
      uGrassMap:  { value: biomes.grass.base   },
      uSandMap:   { value: biomes.sand.base    },
      uMudMap:    { value: biomes.mud.base     },
      uRockMap:   { value: biomes.rock.base    },
      uDirtMap:   { value: biomes.dirt.base    },
      uGrassNorm: { value: biomes.grass.normal },
      uSandNorm:  { value: biomes.sand.normal  },
      uMudNorm:   { value: biomes.mud.normal   },
      uRockNorm:  { value: biomes.rock.normal  },
      uDirtNorm:  { value: biomes.dirt.normal  },
      uTexTile:   { value: TEX_TILE },
    };

    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, mat.userData.uniforms);

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `
          #include <common>
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;
          `
        )
        .replace(
          '#include <worldpos_vertex>',
          `
          #include <worldpos_vertex>
          vec4 _wp = modelMatrix * vec4(transformed, 1.0);
          vWorldPos = _wp.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
          `
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `
          #include <common>
          /* 10 custom samplers — stays under MAX_TEXTURE_IMAGE_UNITS(16) */
          uniform sampler2D uGrassMap, uSandMap, uMudMap, uRockMap, uDirtMap;
          uniform sampler2D uGrassNorm, uSandNorm, uMudNorm, uRockNorm, uDirtNorm;
          uniform float uTexTile;
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;

          float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }
          float noise2d(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            float a = hash21(i);
            float b = hash21(i + vec2(1.0, 0.0));
            float c = hash21(i + vec2(0.0, 1.0));
            float d = hash21(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
          }
          `
        )
        .replace(
          '#include <map_fragment>',
          `
          // ---- Splat weights (height + slope + noise) -------------------
          vec2 wuv = vWorldPos.xz * uTexTile;
          float h = vWorldPos.y;
          float slopeY = clamp(vWorldNormal.y, 0.0, 1.0);
          // Two octaves of value-noise so the boundaries aren't perfectly
          // parallel to the height bands — gives natural-looking breakup.
          float n1 = noise2d(vWorldPos.xz * 0.012);
          float n2 = noise2d(vWorldPos.xz * 0.031) * 0.5;
          float n  = clamp(n1 + n2 * 0.35, 0.0, 1.0);

          float wSand  = smoothstep(2.2, 0.4, h)            * smoothstep(0.55, 0.88, slopeY);
          float wMud   = smoothstep(2.6, 0.9, h) * n        * smoothstep(0.5,  0.85, slopeY);
          float wGrass = smoothstep(1.2, 2.6, h) * smoothstep(7.5, 3.8, h) * smoothstep(0.55, 0.94, slopeY);
          float wDirt  = smoothstep(2.3, 4.6, h) * smoothstep(7.5, 4.8, h) * (1.0 - n) * 0.95;
          float wRock  = smoothstep(5.2, 8.5, h) + smoothstep(0.9, 0.35, slopeY) * 1.0;

          float wSum = wSand + wMud + wGrass + wDirt + wRock + 1e-4;
          wSand /= wSum; wMud /= wSum; wGrass /= wSum; wDirt /= wSum; wRock /= wSum;

          // ---- BaseColor blend (per-biome tile multipliers) -------------
          vec4 cGrass = texture2D(uGrassMap, wuv);
          vec4 cSand  = texture2D(uSandMap,  wuv * 1.7);
          vec4 cMud   = texture2D(uMudMap,   wuv * 0.85);
          vec4 cRock  = texture2D(uRockMap,  wuv * 0.55);
          vec4 cDirt  = texture2D(uDirtMap,  wuv * 1.2);

          vec4 splatColor =
              cGrass * wGrass + cSand * wSand + cMud * wMud +
              cRock  * wRock  + cDirt * wDirt;

          diffuseColor *= splatColor;
          `
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `
          /* Per-biome roughness — constant values replace the removed ARM
           * texture samples.  Values match the old mix() fallbacks exactly
           * so mud is still glossy, grass still matte, etc.              */
          float roughnessFactor = clamp(
            0.95 * wGrass +   // grass: dry / matte
            0.88 * wSand  +   // sand:  slightly smoother
            0.55 * wMud   +   // mud:   wet / glossy
            0.78 * wRock  +   // rock:  medium
            0.90 * wDirt,     // dirt:  rough
            0.18, 1.0
          );
          `
        )
        .replace(
          '#include <normal_fragment_maps>',
          `
          // ---- Per-biome normal-map blend --------------------------------
          // We treat each tangent-space normal as if it were object-space
          // XZ tilt around the (already correct) world-up vWorldNormal —
          // good enough for soft terrain micro-detail without needing the
          // full TBN derivation that #include <normal_fragment_maps> sets up.
          vec3 nGrass = texture2D(uGrassNorm, wuv).xyz * 2.0 - 1.0;
          vec3 nSand  = texture2D(uSandNorm,  wuv * 1.7).xyz * 2.0 - 1.0;
          vec3 nMud   = texture2D(uMudNorm,   wuv * 0.85).xyz * 2.0 - 1.0;
          vec3 nRock  = texture2D(uRockNorm,  wuv * 0.55).xyz * 2.0 - 1.0;
          vec3 nDirt  = texture2D(uDirtNorm,  wuv * 1.2).xyz * 2.0 - 1.0;
          vec3 nBlend = normalize(
            nGrass * wGrass + nSand * wSand + nMud * wMud +
            nRock  * wRock  + nDirt * wDirt
          );
          normal = normalize(vWorldNormal + vec3(nBlend.x, 0.0, nBlend.y) * 0.65);
          `
        );
    };

    return mat;
  }, [biomes, envIntensity]);

  return <primitive object={material} attach="material" />;
}
