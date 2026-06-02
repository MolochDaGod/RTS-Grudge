/**
 * BiomeTextures — biome-aware PBR texture loader.
 *
 * Four weather presets (forest / beach / volcano / winter) each map to
 * a different set of terrain surface textures stored under
 * `public/textures/terrain/<weather>/`.  The original flat lookup is
 * kept as the `'forest'` default for backwards compatibility.
 *
 * Texture naming per subfolder:
 *   grass_diff.jpg / grass_nor.jpg / grass_arm.jpg  — main grass surface
 *   rock_diff.jpg  / rock_nor.jpg  / rock_ao.jpg    — exposed rock
 *   sand_diff.jpg  / sand_nor.jpg  / sand_arm.jpg   — sand / ash
 *
 * Fallback: if a biome-specific file is missing, the forest textures
 * (which are always present) are used transparently.
 */
import { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { WeatherBiome } from '../editor/store';

/**
 * A single biome's PBR texture set, ready to plug into the splat shader.
 */
export interface BiomePBRTextures {
  /** sRGB baseColor — multiply by light to get diffuse. */
  base: THREE.Texture | null;
  /** Linear tangent-space normal map (OpenGL convention). */
  normal: THREE.Texture | null;
  /**
   * Linear AO/Rough/Metal-packed texture (ARM).
   *   R = ambient occlusion
   *   G = roughness
   *   B = metalness
   * Null if the biome has no ARM map shipped (e.g. mud, dirt); the
   * splat shader falls back to per-biome constants in that case.
   */
  mr: THREE.Texture | null;
}

export interface BiomePBRSet {
  grass: BiomePBRTextures;
  sand:  BiomePBRTextures;
  mud:   BiomePBRTextures;
  rock:  BiomePBRTextures;
  dirt:  BiomePBRTextures;
}

// ── Per-weather texture descriptors ────────────────────────────────────────
// Each weather preset supplies 5 splat slots (grass / sand / mud / rock / dirt).
// Files live under public/textures/terrain/<weather>/ or fall back to the
// root public/textures/terrain/ (legacy flat layout) when a subfolder lacks
// a particular file.

type SlotFiles = { diff: string; nor: string; arm: string | null };

type BiomeFileSet = {
  grass: SlotFiles;
  sand:  SlotFiles;
  mud:   SlotFiles;
  rock:  SlotFiles;
  dirt:  SlotFiles;
};

const WEATHER_FILES: Record<WeatherBiome, BiomeFileSet> = {
  forest: {
    // real PBR grass — rocky_terrain_02_* from Hero-Commander
    grass: { diff: 'forest/grass_diff.jpg', nor: 'forest/grass_nor.jpg',  arm: 'forest/grass_arm.jpg' },
    sand:  { diff: 'sand_diff.jpg',          nor: 'sand_nor_gl.jpg',       arm: 'sand_arm.jpg'  },
    mud:   { diff: 'mud_diff.jpg',            nor: 'mud_nor_gl.jpg',        arm: null            },
    rock:  { diff: 'forest/rock_diff.jpg',   nor: 'forest/rock_nor.jpg',   arm: 'forest/rock_ao.jpg' },
    dirt:  { diff: 'dirt_diff.jpg',           nor: 'dirt_nor_gl.jpg',       arm: null            },
  },
  beach: {
    // warm, sandy coast
    grass: { diff: 'beach/sand_diff.jpg',    nor: 'beach/sand_nor.jpg',    arm: 'beach/sand_arm.jpg' },
    sand:  { diff: 'beach/sand_diff.jpg',    nor: 'beach/sand_nor.jpg',    arm: 'beach/sand_arm.jpg' },
    mud:   { diff: 'mud_diff.jpg',            nor: 'mud_nor_gl.jpg',        arm: null            },
    rock:  { diff: 'beach/rock_diff.jpg',    nor: 'rock_nor_gl.jpg',       arm: null            },
    dirt:  { diff: 'sand_diff.jpg',           nor: 'sand_nor_gl.jpg',       arm: null            },
  },
  volcano: {
    // dark basalt cliffs
    grass: { diff: 'volcano/cliff_diff.jpg', nor: 'volcano/rock_nor.jpg',  arm: 'volcano/rock_ao.jpg' },
    sand:  { diff: 'volcano/rock_diff.jpg',  nor: 'volcano/rock_nor.jpg',  arm: null            },
    mud:   { diff: 'volcano/rock_diff.jpg',  nor: 'volcano/rock_nor.jpg',  arm: null            },
    rock:  { diff: 'volcano/cliff_diff.jpg', nor: 'volcano/rock_nor.jpg',  arm: 'volcano/rock_ao.jpg' },
    dirt:  { diff: 'volcano/rock_diff.jpg',  nor: 'volcano/rock_nor.jpg',  arm: null            },
  },
  winter: {
    // snow-dusted grass + icy rock
    grass: { diff: 'winter/snow_diff.jpg',   nor: 'winter/snow_nor.jpg',   arm: null            },
    sand:  { diff: 'rock_diff.jpg',           nor: 'rock_nor_gl.jpg',       arm: null            },
    mud:   { diff: 'winter/snow_diff.jpg',   nor: 'winter/snow_nor.jpg',   arm: null            },
    rock:  { diff: 'winter/rock_diff.jpg',   nor: 'winter/rock_nor.jpg',   arm: null            },
    dirt:  { diff: 'winter/snow_diff.jpg',   nor: 'winter/snow_nor.jpg',   arm: null            },
  },
};

const TERRAIN_TEX_BASE = `${import.meta.env.BASE_URL}textures/terrain/`;

/** Shared TextureLoader — Three caches fetches, so repeat calls de-dup. */
const _texLoader = new THREE.TextureLoader();

/** Per-weather texture cache: avoids reloading the same weather set. */
const _weatherCache = new Map<WeatherBiome, BiomePBRSet>();

function loadTex(url: string, srgb: boolean): THREE.Texture {
  const t = _texLoader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.minFilter = THREE.LinearMipMapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  return t;
}

function buildSlot(files: SlotFiles): BiomePBRTextures {
  return {
    base:   loadTex(`${TERRAIN_TEX_BASE}${files.diff}`, true),
    normal: loadTex(`${TERRAIN_TEX_BASE}${files.nor}`,  false),
    mr:     files.arm
      ? loadTex(`${TERRAIN_TEX_BASE}${files.arm}`, false)
      : null,
  };
}

function buildWeatherSet(weather: WeatherBiome): BiomePBRSet {
  const f = WEATHER_FILES[weather];
  return {
    grass: buildSlot(f.grass),
    sand:  buildSlot(f.sand),
    mud:   buildSlot(f.mud),
    rock:  buildSlot(f.rock),
    dirt:  buildSlot(f.dirt),
  };
}

/**
 * React hook: returns the 5-biome PBR texture set for the given weather
 * preset. Results are cached per-weather so switching biomes is instant
 * after the first load. Pass `weather` from the editor store.
 */
export function useJungleJimsBiomes(weather: WeatherBiome = 'forest'): BiomePBRSet {
  // Track previous weather so we only rebuild the material when it changes.
  const prevWeather = useRef<WeatherBiome | null>(null);

  const set = useMemo<BiomePBRSet>(() => {
    const cached = _weatherCache.get(weather);
    if (cached) return cached;
    const built = buildWeatherSet(weather);
    _weatherCache.set(weather, built);
    return built;
  }, [weather]);

  void prevWeather;

  useEffect(() => {
    for (const slot of Object.values(set)) {
      for (const t of [slot.base, slot.normal, slot.mr]) {
        if (!t) continue;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.needsUpdate = true;
      }
    }
  }, [set]);

  return set;
}
