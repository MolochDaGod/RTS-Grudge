/**
 * Texture registry for the procedural foliage primitives. Loads each
 * raw PNG once via Vite's eager glob, returns shared `THREE.Texture`
 * singletons configured for foliage (sRGB color, alpha cutout, mipmap,
 * proper anisotropy).
 *
 * One file → one named slot. Adding a new texture means dropping the PNG
 * into attached_assets/ and adding a `findUrl(stem)` line below.
 */
import * as THREE from 'three';

const pngModules = import.meta.glob(
  '../../../../attached_assets/*.png',
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>;

function findUrl(stem: string): string | undefined {
  for (const [path, url] of Object.entries(pngModules)) {
    const file = path.split('/').pop() ?? '';
    if (file.startsWith(stem)) return url;
  }
  return undefined;
}

const textureCache = new Map<string, THREE.Texture>();

/**
 * Load a foliage texture once, share across all instances. We mark the
 * texture as sRGB color (standard for albedo PNGs), enable mipmaps, and
 * crank anisotropy so leaf cards stay crisp at oblique camera angles.
 */
function loadFoliage(url: string | undefined, opts: { tile?: boolean } = {}): THREE.Texture | null {
  if (!url) return null;
  const cached = textureCache.get(url);
  if (cached) return cached;
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (opts.tile) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  }
  textureCache.set(url, tex);
  return tex;
}

/**
 * A texture used as a *normal map* — must NOT be sRGB-decoded, otherwise
 * the per-pixel TBN math in the shader produces washed-out lighting.
 */
function loadNormal(url: string | undefined, opts: { tile?: boolean } = {}): THREE.Texture | null {
  if (!url) return null;
  const key = url + '#normal';
  const cached = textureCache.get(key);
  if (cached) return cached;
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  if (opts.tile) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(key, tex);
  return tex;
}

// ── URL slots ───────────────────────────────────────────────────────
const URLS = {
  // leaf atlases (RGBA cutout)
  birchLeaves:  findUrl('BirchTree_Leaves_'),
  bushLeaves:   findUrl('Bush_Leaves_'),
  mapleLeaves:  findUrl('MapleTree_Leaves_1'),
  normalLeaves: findUrl('NormalTree_Leaves_'),
  palmLeaves:   findUrl('PalmTree_Leaves_'),
  pineLeaves:   findUrl('PineTree_Leaves_'),
  // ferns
  fern1: findUrl('Fern_01_baseColor'),
  fern2: findUrl('Fern_02_baseColor'),
  fern3: findUrl('Fern_03_baseColor'),
  // mushrooms
  mush1: findUrl('Mushroom_01_baseColor'),
  mush2: findUrl('Mushroom_02_baseColor'),
  mush3: findUrl('Mushroom_03_baseColor'),
  // flowers (mixed atlas + colour variants)
  flowersMixed:  findUrl('Flowers_1776758262654'),
  flowersRed:    findUrl('Flowers_01_baseColor'),
  flowersPurple: findUrl('Flowers_02_baseColor'),
  flowersYellow: findUrl('Flowers_03_baseColor'),
  flowersPink:   findUrl('Flowers_04_baseColor'),
  // ground / surface
  grass:    findUrl('Grass_'),
  rocks:    findUrl('Rocks_'),
  // bark + normal
  pineBark:    findUrl('PineTree_Bark_'),
  palmTrunkN:  findUrl('PalmTree_Trunk_Normal'),
  // VFX
  smoke:       findUrl('smoke_'),
} as const;

export const FoliageTextures = {
  // leaf atlases
  leafBirch:  () => loadFoliage(URLS.birchLeaves),
  leafBush:   () => loadFoliage(URLS.bushLeaves),
  leafMaple:  () => loadFoliage(URLS.mapleLeaves),
  leafNormal: () => loadFoliage(URLS.normalLeaves),
  leafPalm:   () => loadFoliage(URLS.palmLeaves),
  leafPine:   () => loadFoliage(URLS.pineLeaves),
  // ferns
  fernBroad:  () => loadFoliage(URLS.fern1),
  fernNarrow: () => loadFoliage(URLS.fern2),
  fernLeafy:  () => loadFoliage(URLS.fern3),
  // mushrooms
  mushroomRed:    () => loadFoliage(URLS.mush1),
  mushroomBrown:  () => loadFoliage(URLS.mush2),
  mushroomPurple: () => loadFoliage(URLS.mush3),
  // flowers
  flowersMixed:  () => loadFoliage(URLS.flowersMixed),
  flowersRed:    () => loadFoliage(URLS.flowersRed),
  flowersPurple: () => loadFoliage(URLS.flowersPurple),
  flowersYellow: () => loadFoliage(URLS.flowersYellow),
  flowersPink:   () => loadFoliage(URLS.flowersPink),
  // tileable ground
  grass: () => loadFoliage(URLS.grass, { tile: true }),
  rocks: () => loadFoliage(URLS.rocks, { tile: true }),
  // bark
  pineBark:        () => loadFoliage(URLS.pineBark, { tile: true }),
  palmTrunkNormal: () => loadNormal(URLS.palmTrunkN, { tile: true }),
  // VFX — soft greyscale puff used as additive billboard sprite for
  // the gas-geyser plume. Loaded as sRGB so the puff reads naturally.
  smoke:           () => loadFoliage(URLS.smoke),
};

/**
 * Lookup helper used by TexturedFoliage to map an entity's data slug
 * (e.g. `data.leaf = 'birch'`) to a leaf texture.
 */
export function leafTextureBySlug(slug: string | undefined): THREE.Texture | null {
  switch (slug) {
    case 'birch':  return FoliageTextures.leafBirch();
    case 'bush':   return FoliageTextures.leafBush();
    case 'maple':  return FoliageTextures.leafMaple();
    case 'normal': return FoliageTextures.leafNormal();
    case 'palm':   return FoliageTextures.leafPalm();
    case 'pine':   return FoliageTextures.leafPine();
    default:       return FoliageTextures.leafNormal();
  }
}

export function flowerAtlasBySlug(slug: string | undefined): THREE.Texture | null {
  switch (slug) {
    case 'red':    return FoliageTextures.flowersRed();
    case 'purple': return FoliageTextures.flowersPurple();
    case 'yellow': return FoliageTextures.flowersYellow();
    case 'pink':   return FoliageTextures.flowersPink();
    case 'mixed':
    default:       return FoliageTextures.flowersMixed();
  }
}

export function fernTextureBySlug(slug: string | undefined): THREE.Texture | null {
  switch (slug) {
    case 'narrow': return FoliageTextures.fernNarrow();
    case 'leafy':  return FoliageTextures.fernLeafy();
    case 'broad':
    default:       return FoliageTextures.fernBroad();
  }
}

export function mushroomTextureBySlug(slug: string | undefined): THREE.Texture | null {
  switch (slug) {
    case 'brown':  return FoliageTextures.mushroomBrown();
    case 'purple': return FoliageTextures.mushroomPurple();
    case 'red':
    default:       return FoliageTextures.mushroomRed();
  }
}
