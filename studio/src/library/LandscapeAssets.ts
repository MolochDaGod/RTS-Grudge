/**
 * Curated landscape asset library for the Grudge Studio editor.
 *
 * Source of truth for the visual Asset Palette. Three flavours of entry:
 *
 *   1. GLB-backed entries — resolved at build time via Vite's eager glob
 *      against `attached_assets/*.glb`. We match by stem (filename prefix
 *      before the timestamp suffix) so newly re-uploaded copies still work.
 *
 *   2. Procedural entries — no asset URL; carry `defaultData.foliageStyle`
 *      so EntityLayer renders the textured-foliage primitive instead of a
 *      GLB. These are powered by FoliageTextures.ts and let us turn raw
 *      leaf/bark PNGs into placeable trees/flowers/grass.
 *
 *   3. Warlords CDN entries — absolute R2 keys under assets.grudge-studio.com
 *      (battle nature + CreatureManifest paths). Prefer these for fleet-aligned
 *      home-island / biome work. Cross-repo SSOT:
 *        biomeHarvestAssets · CreatureManifest · HOME_ISLAND_PIPELINE_CANONICAL
 *        · TI warlordsAssetCatalog · THIS library
 *
 * Adding a new GLB to attached_assets/ won't surface it here automatically
 * — by design (the user asked for a curated palette). To expose it, add a
 * line to the CURATED array below.
 */
import type { EntityKind } from '../types';

/** Production CDN — same host as GrudgeBuilder / TI warlordsAssetCatalog */
export const WARLORDS_CDN = 'https://assets.grudge-studio.com';

// Eager glob → fully-resolved URL strings keyed by absolute filename.
// Vite emits each model as a static asset and gives us a stable URL.
// We accept both .glb (binary) and .gltf (json) so multi-mesh scenes
// like the Stylized Foliage pack can be placed too.
const modelModules = import.meta.glob(
  ['../../../../attached_assets/*.glb', '../../../../attached_assets/*.gltf'],
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>;

/**
 * Find a model whose filename (without dir) starts with the given stem.
 * When the user re-uploads a model, attached_assets ends up with multiple
 * copies that share the same prefix but have different `_<unix-ms>` suffixes
 * (e.g. `crystal_gem_pack_1776749840389.glb` and
 * `crystal_gem_pack_1776759146684.glb`). We prefer the LATEST one so a
 * re-upload silently supersedes the older copy without code changes.
 */
function resolveGlb(stem: string): string | undefined {
  let bestUrl: string | undefined;
  let bestTs = -1;
  for (const [path, url] of Object.entries(modelModules)) {
    const file = path.split('/').pop() ?? '';
    if (!file.startsWith(stem)) continue;
    // Pull the trailing `_<digits>` group as a timestamp; assets without one
    // sort first (treated as ts=0) so any timestamped re-upload wins.
    const m = /_(\d{10,})\.(glb|gltf)$/i.exec(file);
    const ts = m ? parseInt(m[1]!, 10) : 0;
    if (ts > bestTs) { bestTs = ts; bestUrl = url; }
  }
  return bestUrl;
}

export type AssetCategory =
  | 'Resources'
  | 'Trees'
  | 'Autumn Trees'
  | 'Winter Trees'
  | 'Tropical'
  | 'Tree Packs'
  | 'Foliage'
  | 'Sea Life'
  | 'Wildlife'
  | 'Ships & Docks'
  | 'Logs & Stumps'
  | 'Rocks & Gems'
  | 'Ground Materials';

export interface AssetSpec {
  /** Stable id used as the tile key and stored on placed entities */
  id: string;
  /** Human label shown on the palette tile */
  label: string;
  category: AssetCategory;
  /** EntityKind to write onto the placed entity */
  kind: EntityKind;
  /** Resolved /attached_assets/*.glb URL (via import.meta.glob), or undefined for procedural */
  assetUrl?: string;
  /** Default uniform scale applied at placement */
  defaultScale: number;
  /** Initial data blob; merged onto the placed entity */
  defaultData?: Record<string, unknown>;
  /** Short description shown on hover */
  hint?: string;
}

/**
 * Curated list. Order here is the order shown in the palette within each
 * category. Keep this list intentionally small (<= ~20) per the user's ask.
 */
const CURATED: Omit<AssetSpec, 'assetUrl'>[] & { glbStem?: string }[] = [];

interface RawSpec extends Omit<AssetSpec, 'assetUrl'> {
  /** Filename stem to look up in attached_assets/ (Vite import.meta.glob) */
  glbStem?: string;
  /** Path under public/assets/models/ — always available on Vercel, no upload needed */
  publicModelPath?: string;
  /**
   * R2 key on assets.grudge-studio.com (no leading slash), e.g.
   * `models/nature/CommonTree_1.glb`. Preferred for Warlords-era biome work.
   */
  cdnR2Key?: string;
}

const RAW: RawSpec[] = [
  // ── RTS Resource Nodes ────────────────────────────────────────────
  // Curated, semantic placements for the RTS resource economy. Each
  // tile drops a marker entity the gameplay layer can consume to seed
  // a harvestable node (wood / ore / blue or red mineral / gas).
  { id: 'res-wood', label: 'Wood (Log Pile)', category: 'Resources', kind: 'resource_node',
    glbStem: 'low_poly_tree_log_and_stump_1776749784192', defaultScale: 1.0,
    defaultData: { resource: 'wood' },
    hint: 'Wood resource node — uses the low-poly log & stump GLB.' },
  { id: 'res-ore', label: 'Ore Vein', category: 'Resources', kind: 'resource_node',
    defaultScale: 1.1, defaultData: { foliageStyle: 'textured', rockTexture: true, resource: 'ore', variant: 1 },
    hint: 'Procedural rock outcrop tagged as an iron-ore vein.' },
  { id: 'res-blue', label: 'Blue Mineral', category: 'Resources', kind: 'resource_node',
    glbStem: 'stylized_crystal_gem_pack_-_handpainted', defaultScale: 0.85,
    defaultData: { resource: 'mineral_blue', tint: '#4ea7ff' },
    hint: 'Blue mineral node — crystal gem pack, sapphire tint.' },
  { id: 'res-red', label: 'Red Mineral', category: 'Resources', kind: 'resource_node',
    glbStem: 'stylized_crystal_gem_pack_-_handpainted', defaultScale: 0.85,
    defaultData: { resource: 'mineral_red', tint: '#ff4d52' },
    hint: 'Red mineral node — crystal gem pack, ruby tint.' },
  { id: 'res-gas', label: 'Gas Geyser', category: 'Resources', kind: 'resource_node',
    defaultScale: 1.0, defaultData: { foliageStyle: 'geyser', resource: 'gas', tint: '#ff7733' },
    hint: 'Lava-pool geyser with rising smoke — gas deposit.' },

  // ── Multi-mesh foliage scene (ferns + flowers + mushrooms) ─────
  { id: 'stylized-foliage-scene', label: 'Stylized Foliage Pack',
    category: 'Tree Packs', kind: 'prop',
    glbStem: 'scene_1776758490854', defaultScale: 1.0,
    hint: 'Soidev "Stylized Foliage" — bundle of ferns, flowers, mushrooms (CC-BY-4.0).' },

  // ── Wood / debris ───────────────────────────────────────────────
  { id: 'wood-debris', label: 'Wood Planks & Debris',
    category: 'Logs & Stumps', kind: 'prop',
    glbStem: 'simple_wood_planks_debris_pack', defaultScale: 1.0,
    hint: 'Plank/board/debris bundle for shorelines & ruins.' },

  // ── Trees — always-available textured cross-billboards ─────────
  // These NEVER need a GLB upload; they use the shipped PNG texture atlases.
  { id: 'card-oak',   label: 'Oak Tree',    category: 'Trees', kind: 'tree',
    defaultScale: 1.3, defaultData: { foliageStyle: 'textured', leaf: 'pine' },
    hint: 'Textured cross-billboard oak — always available, no GLB needed.' },
  { id: 'card-birch-s', label: 'Birch Tree', category: 'Trees', kind: 'tree',
    defaultScale: 1.2, defaultData: { foliageStyle: 'textured', leaf: 'birch' },
    hint: 'Textured cross-billboard birch.' },
  { id: 'card-maple-s', label: 'Maple Tree',  category: 'Trees', kind: 'tree',
    defaultScale: 1.2, defaultData: { foliageStyle: 'textured', leaf: 'maple' },
    hint: 'Textured cross-billboard maple.' },
  { id: 'card-palm-s',  label: 'Palm Tree',   category: 'Trees', kind: 'tree',
    defaultScale: 1.1, defaultData: { foliageStyle: 'textured', leaf: 'palm' },
    hint: 'Textured cross-billboard palm.' },

  // ── Trees — GLB-backed when files are uploaded ──────────────────
  { id: 'jacaranda', label: 'Jacaranda (GLB)', category: 'Trees', kind: 'tree',
    glbStem: 'jacaranda_tree', defaultScale: 1.6,
    hint: 'Flowering signature tree — purple canopy (requires GLB upload).' },
  { id: 'stylized-tree', label: 'Stylized Tree (GLB)', category: 'Trees', kind: 'tree',
    glbStem: 'stylized_tree_', defaultScale: 1.4,
    hint: 'Hand-painted broadleaf GLB.' },
  { id: 'tree-animate', label: 'Animated Tree (GLB)', category: 'Trees', kind: 'tree',
    glbStem: 'tree_animate', defaultScale: 1.5,
    hint: 'Baked sway animation — requires GLB upload.' },

  // ── Autumn Trees — textured cards with warm tints ───────────────
  { id: 'autumn-maple', label: 'Maple (Autumn)',    category: 'Autumn Trees', kind: 'tree',
    defaultScale: 1.3, defaultData: { foliageStyle: 'textured', leaf: 'maple', tint: '#c86420' },
    hint: 'Autumn maple — deep orange canopy.' },
  { id: 'autumn-birch', label: 'Birch (Autumn)',    category: 'Autumn Trees', kind: 'tree',
    defaultScale: 1.2, defaultData: { foliageStyle: 'textured', leaf: 'birch', tint: '#d4920a' },
    hint: 'Autumn birch — golden yellow canopy.' },
  { id: 'autumn-oak',   label: 'Oak (Autumn)',      category: 'Autumn Trees', kind: 'tree',
    defaultScale: 1.3, defaultData: { foliageStyle: 'textured', leaf: 'pine',  tint: '#a84010' },
    hint: 'Autumn oak — crimson-red canopy.' },
  { id: 'dead-tree',    label: 'Dead / Bare Tree',  category: 'Autumn Trees', kind: 'tree',
    defaultScale: 1.1, defaultData: { foliageStyle: 'textured', leaf: 'pine',  tint: '#5a4a30' },
    hint: 'Bare winter silhouette — near-brown tint strips green.' },
  { id: 'autumn-pack', label: 'Autumn Pack (GLB)',  category: 'Autumn Trees', kind: 'tree',
    glbStem: 'stylized_aumtumn_trees_pack_animation_baked', defaultScale: 1.0,
    hint: 'Animated autumn trees with baked wind sway (requires GLB upload).' },

  // ── Winter Trees — snow-dusted variants ─────────────────────────
  { id: 'winter-pine',  label: 'Pine (Snowy)',       category: 'Winter Trees', kind: 'tree',
    defaultScale: 1.3, defaultData: { foliageStyle: 'textured', leaf: 'pine',  tint: '#c0d8f0' },
    hint: 'Snow-dusted pine — ice-blue leaf tint.' },
  { id: 'winter-birch', label: 'Birch (Snowy)',      category: 'Winter Trees', kind: 'tree',
    defaultScale: 1.2, defaultData: { foliageStyle: 'textured', leaf: 'birch', tint: '#d4e8f4' },
    hint: 'Snow-dusted birch — pale cool tint.' },
  { id: 'snowy-pines', label: 'Snowy Pines (GLB)',  category: 'Winter Trees', kind: 'tree',
    glbStem: 'snowy_pine_trees_pack__ps1_low_poly', defaultScale: 1.2,
    hint: 'PS1 low-poly snow-capped pines — requires GLB upload.' },

  // ── Tropical & Palms ────────────────────────────────────────────
  { id: 'tropical-pack', label: 'Tropical Pack (GLB)', category: 'Tropical', kind: 'tree',
    glbStem: 'stylized_tropical_pack', defaultScale: 1.2,
    hint: 'Palms + tropical foliage bundle — requires GLB upload.' },

  // ── Tree Packs (multi-tree GLBs) ────────────────────────────────
  { id: 'trees-set-a', label: 'Trees Set A (GLB)', category: 'Tree Packs', kind: 'tree',
    glbStem: 'trees_set_a', defaultScale: 1.0,
    hint: 'Bundle of varied trees — requires GLB upload.' },
  { id: 'pine-pack', label: 'Pine Pack (GLB)', category: 'Tree Packs', kind: 'tree',
    glbStem: 'pine_trees_pack__ps1_low_poly', defaultScale: 1.2,
    hint: 'PS1-style low-poly pines — requires GLB upload.' },

  // ── Sea Life — animated fish (Quaternius CC0) — always available ────────
  { id: 'fish-clownfish',  label: 'Clownfish',      category: 'Sea Life', kind: 'creature',
    publicModelPath: 'fish/clownfish.glb',    defaultScale: 0.8,  defaultData: { species: 'clownfish' },
    hint: 'Animated clownfish — swims in place.' },
  { id: 'fish-shark',     label: 'Shark',           category: 'Sea Life', kind: 'creature',
    publicModelPath: 'fish/shark.glb',        defaultScale: 1.2,  defaultData: { species: 'shark' },
    hint: 'Animated shark.' },
  { id: 'fish-anglerfish',label: 'Anglerfish',      category: 'Sea Life', kind: 'creature',
    publicModelPath: 'fish/anglerfish.glb',   defaultScale: 0.9,  defaultData: { species: 'anglerfish' },
    hint: 'Deep-sea anglerfish with glowing lure.' },
  { id: 'fish-lionfish',  label: 'Lionfish',        category: 'Sea Life', kind: 'creature',
    publicModelPath: 'fish/lionfish.glb',     defaultScale: 0.8,  defaultData: { species: 'lionfish' },
    hint: 'Spiny tropical lionfish.' },
  { id: 'fish-puffer',    label: 'Pufferfish',      category: 'Sea Life', kind: 'creature',
    publicModelPath: 'fish/puffer.glb',       defaultScale: 0.7,  defaultData: { species: 'pufferfish' },
    hint: 'Inflated pufferfish.' },
  { id: 'fish-goldfish',  label: 'Goldfish',        category: 'Sea Life', kind: 'creature',
    publicModelPath: 'fish/goldfish.glb',     defaultScale: 0.5,  defaultData: { species: 'goldfish' },
    hint: 'Ornamental goldfish.' },
  { id: 'fish-tuna',      label: 'Tuna',            category: 'Sea Life', kind: 'creature',
    publicModelPath: 'fish/tuna.glb',         defaultScale: 1.0,  defaultData: { species: 'tuna' },
    hint: 'Open-ocean tuna.' },
  { id: 'fish-swordfish', label: 'Swordfish',       category: 'Sea Life', kind: 'creature',
    publicModelPath: 'fish/swordfish.glb',    defaultScale: 1.0,  defaultData: { species: 'swordfish' },
    hint: 'Billfish swordfish.' },
  { id: 'fish-betta',     label: 'Betta Fish',      category: 'Sea Life', kind: 'creature',
    publicModelPath: 'fish/betta.glb',        defaultScale: 0.5,  defaultData: { species: 'betta' },
    hint: 'Colourful betta / Siamese fighting fish.' },
  { id: 'fish-blue-tang', label: 'Blue Tang',       category: 'Sea Life', kind: 'creature',
    publicModelPath: 'fish/blue-tang.glb',    defaultScale: 0.6,  defaultData: { species: 'blue-tang' },
    hint: 'Bright blue tang reef fish.' },
  { id: 'fish-mandarin',  label: 'Mandarin Fish',   category: 'Sea Life', kind: 'creature',
    publicModelPath: 'fish/mandarin-fish.glb',defaultScale: 0.5,  defaultData: { species: 'mandarin' },
    hint: 'Vivid psychedelic mandarin dragonet.' },
  { id: 'fish-piranha',   label: 'Piranha',         category: 'Sea Life', kind: 'creature',
    publicModelPath: 'fish/piranha.glb',      defaultScale: 0.6,  defaultData: { species: 'piranha' },
    hint: 'Freshwater piranha.' },
  { id: 'fish-cardinal',  label: 'Cardinal Fish',   category: 'Sea Life', kind: 'creature',
    publicModelPath: 'fish/cardinal-fish.glb',defaultScale: 0.4,  defaultData: { species: 'cardinal-fish' },
    hint: 'Tiny red cardinal fish.' },
  { id: 'fish-parrot',    label: 'Parrot Fish',     category: 'Sea Life', kind: 'creature',
    publicModelPath: 'fish/parrot-fish.glb',  defaultScale: 0.7,  defaultData: { species: 'parrot-fish' },
    hint: 'Tropical parrot fish.' },
  { id: 'fish-blue-goldfish', label: 'Blue Goldfish', category: 'Sea Life', kind: 'creature',
    publicModelPath: 'fish/blue-goldfish.glb',defaultScale: 0.5,  defaultData: { species: 'blue-goldfish' },
    hint: 'Ornamental blue goldfish variant.' },

  // ── Wildlife — land creatures ─────────────────────────────────
  { id: 'creature-wolf',  label: 'Wolf',             category: 'Wildlife', kind: 'creature',
    publicModelPath: 'creatures/wolf.glb',         defaultScale: 1.0,  defaultData: { species: 'wolf',    behavior: 'wander', speed: 2.4, visionRadius: 18, fleeSpeed: 6, homeRadius: 28 },
    hint: 'Animated wolf — wanders and flees from the player.' },
  { id: 'creature-deer',  label: 'Deer',             category: 'Wildlife', kind: 'creature',
    publicModelPath: 'creatures/deer.glb',         defaultScale: 1.0,  defaultData: { species: 'deer',    behavior: 'wander', speed: 1.6, visionRadius: 14, fleeSpeed: 5.2, homeRadius: 18 },
    hint: 'Animated low-poly deer.' },
  { id: 'creature-buffalo', label: 'Buffalo',        category: 'Wildlife', kind: 'creature',
    publicModelPath: 'creatures/buffalo.glb',      defaultScale: 1.2,  defaultData: { species: 'buffalo', behavior: 'wander', speed: 2.0, visionRadius: 14, fleeSpeed: 4.5, homeRadius: 25 },
    hint: 'African buffalo — large and slow, for volcano / savanna biomes.' },
  { id: 'creature-ibex',  label: 'Mountain Ibex',   category: 'Wildlife', kind: 'creature',
    publicModelPath: 'creatures/ibex.glb',         defaultScale: 1.0,  defaultData: { species: 'ibex',    behavior: 'wander', speed: 1.8, visionRadius: 16, fleeSpeed: 5, homeRadius: 20 },
    hint: 'Beceite ibex — climbs rocky slopes (winter/volcano).' },
  { id: 'creature-crab',  label: 'Crab',             category: 'Wildlife', kind: 'creature',
    publicModelPath: 'creatures/crab.glb',         defaultScale: 0.6,  defaultData: { species: 'crab',    behavior: 'wander', speed: 0.8, visionRadius: 5, fleeSpeed: 2, homeRadius: 8 },
    hint: 'Beach crab — scuttles along the shoreline.' },
  { id: 'creature-hawk',  label: 'Hawk (flying)',    category: 'Wildlife', kind: 'creature',
    publicModelPath: 'creatures/hawk.glb',         defaultScale: 0.8,  defaultData: { species: 'hawk',    behavior: 'circle', isAir: true },
    hint: 'Low-poly rigged hawk with flight animation.' },
  { id: 'creature-harpy', label: 'Harpy (flying)',   category: 'Wildlife', kind: 'creature',
    publicModelPath: 'creatures/harpy.glb',        defaultScale: 1.0,  defaultData: { species: 'harpy',   behavior: 'circle', isAir: true },
    hint: 'PSX-style harpy — circles overhead (volcano biome).' },
  { id: 'creature-hummingbird', label: 'Hummingbird', category: 'Wildlife', kind: 'creature',
    publicModelPath: 'creatures/hummingbird.glb',  defaultScale: 0.4,  defaultData: { species: 'hummingbird', behavior: 'circle', isAir: true },
    hint: 'Animated hummingbird — hovers near flowers (beach biome).' },
  { id: 'creature-dragon',label: 'Dragon',           category: 'Wildlife', kind: 'creature',
    publicModelPath: 'creatures/dragon.glb',       defaultScale: 1.5,  defaultData: { species: 'dragon',  behavior: 'circle', isAir: true },
    hint: 'Fantasy dragon.' },
  { id: 'creature-raptor',label: 'Velociraptor',     category: 'Wildlife', kind: 'creature',
    publicModelPath: 'creatures/velociraptor.glb', defaultScale: 1.0,  defaultData: { species: 'raptor',  behavior: 'wander', speed: 3, visionRadius: 12, fleeSpeed: 8, homeRadius: 20 },
    hint: 'Animated velociraptor dinosaur.' },
  { id: 'creature-zombie',label: 'Zombie',           category: 'Wildlife', kind: 'creature',
    publicModelPath: 'creatures/zombie.glb',       defaultScale: 1.0,  defaultData: { species: 'zombie',  behavior: 'wander', speed: 0.8, visionRadius: 8, fleeSpeed: 1.5, homeRadius: 10 },
    hint: 'Animated zombie character.' },

  // ── Sea Life additions — from Documents GLBs ──────────────────────────
  { id: 'creature-croc',  label: 'Nile Crocodile',  category: 'Sea Life', kind: 'creature',
    publicModelPath: 'creatures/crocodile.glb',    defaultScale: 1.2,  defaultData: { species: 'crocodile', behavior: 'swim', speed: 1.5, radius: 30 },
    hint: 'Animated crocodile — swims in shallow water around the island.' },

  // ── Tropical & Palms — Kenney CC0 (always available) ───────────
  { id: 'kenney-palm-straight',  label: 'Palm (Straight)',  category: 'Tropical', kind: 'tree',
    publicModelPath: 'nature/palm-straight.glb',         defaultScale: 1.5,
    hint: 'Kenney CC0 straight palm tree.' },
  { id: 'kenney-palm-bend',      label: 'Palm (Bent)',      category: 'Tropical', kind: 'tree',
    publicModelPath: 'nature/palm-bend.glb',             defaultScale: 1.5,
    hint: 'Kenney CC0 leaning palm tree.' },
  { id: 'kenney-palm-detail-s',  label: 'Palm Detailed (S)',category: 'Tropical', kind: 'tree',
    publicModelPath: 'nature/palm-detailed-straight.glb',defaultScale: 1.5,
    hint: 'Kenney CC0 high-detail straight palm.' },
  { id: 'kenney-palm-detail-b',  label: 'Palm Detailed (B)',category: 'Tropical', kind: 'tree',
    publicModelPath: 'nature/palm-detailed-bend.glb',    defaultScale: 1.5,
    hint: 'Kenney CC0 high-detail bent palm.' },

  // ── Rocks — Kenney CC0 ─────────────────────────────────────
  { id: 'kenney-rock-a',   label: 'Rock A',          category: 'Rocks & Gems', kind: 'rock',
    publicModelPath: 'nature/rocks-a.glb',         defaultScale: 1.0,
    hint: 'Kenney CC0 low-poly rock.' },
  { id: 'kenney-rock-b',   label: 'Rock B',          category: 'Rocks & Gems', kind: 'rock',
    publicModelPath: 'nature/rocks-b.glb',         defaultScale: 1.0,
    hint: 'Kenney CC0 low-poly rock variant.' },
  { id: 'kenney-rock-c',   label: 'Rock C',          category: 'Rocks & Gems', kind: 'rock',
    publicModelPath: 'nature/rocks-c.glb',         defaultScale: 1.0,
    hint: 'Kenney CC0 low-poly rock cluster.' },
  { id: 'kenney-rock-sand-a', label: 'Sand Rock A',  category: 'Rocks & Gems', kind: 'rock',
    publicModelPath: 'nature/rocks-sand-a.glb',    defaultScale: 1.0,
    hint: 'Kenney CC0 sandy rock formation.' },
  { id: 'kenney-rock-sand-b', label: 'Sand Rock B',  category: 'Rocks & Gems', kind: 'rock',
    publicModelPath: 'nature/rocks-sand-b.glb',    defaultScale: 1.0,
    hint: 'Kenney CC0 sandy rock group.' },

  // ── Ships & Docks — Kenney CC0 ───────────────────────────
  { id: 'kenney-ship-small',  label: 'Ship (Small)',  category: 'Ships & Docks', kind: 'prop',
    publicModelPath: 'nature/ship-small.glb',  defaultScale: 2.0,
    hint: 'Kenney CC0 small sailing vessel.' },
  { id: 'kenney-ship-medium', label: 'Ship (Medium)', category: 'Ships & Docks', kind: 'prop',
    publicModelPath: 'nature/ship-medium.glb', defaultScale: 2.0,
    hint: 'Kenney CC0 medium ship.' },
  { id: 'kenney-ship-large',  label: 'Ship (Large)',  category: 'Ships & Docks', kind: 'prop',
    publicModelPath: 'nature/ship-large.glb',  defaultScale: 2.0,
    hint: 'Kenney CC0 large galleon.' },
  { id: 'kenney-ship-wreck',  label: 'Ship Wreck',    category: 'Ships & Docks', kind: 'prop',
    publicModelPath: 'nature/ship-wreck.glb',  defaultScale: 2.0,
    hint: 'Kenney CC0 wrecked/sunken ship.' },

  // ── Logs & Stumps ─────────────────────────────────────────────────────
  // The log-stump.glb packs all three lifecycle stages into one file.
  // childIndex separates each mesh so every stage is its own palette tile.
  { id: 'log-standing', label: 'Standing Tree',  category: 'Logs & Stumps', kind: 'tree',
    publicModelPath: 'nature/log-stump.glb', defaultScale: 1.2,
    defaultData: { childIndex: 0 },
    hint: 'Full standing tree — stage 1 of the log/stump lifecycle.' },
  { id: 'log-chopping', label: 'Tree (Chopping)', category: 'Logs & Stumps', kind: 'prop',
    publicModelPath: 'nature/log-stump.glb', defaultScale: 1.2,
    defaultData: { childIndex: 1 },
    hint: 'Tree mid-chop with visible cut — stage 2.' },
  { id: 'log-stump-only', label: 'Stump & Log',  category: 'Logs & Stumps', kind: 'prop',
    publicModelPath: 'nature/log-stump.glb', defaultScale: 1.2,
    defaultData: { childIndex: 2 },
    hint: 'Fallen log beside stump — stage 3, forest floor detail.' },

  // ── Rocks & Gems ────────────────────────────────────────────────
  { id: 'crystal-gems', label: 'Crystal Gems', category: 'Rocks & Gems', kind: 'resource_node',
    glbStem: 'stylized_crystal_gem_pack', defaultScale: 0.9,
    defaultData: { resource: 'crystal' },
    hint: 'Hand-painted gem cluster — placed as a resource node.' },

  // ── Ground Material packs (placed as decorative groundcover for now;
  //     wired into TerrainMesh in T004). ──────────────────────────
  { id: 'jungle-pbr-mats', label: 'Jungle PBR Materials', category: 'Ground Materials', kind: 'prop',
    glbStem: 'jungle_jims_pbr_surface_materials', defaultScale: 1.0,
    hint: 'PBR surface sample sphere — use to preview ground textures.' },
  { id: 'texture-pack-2-ground', label: 'Ground Texture Pack', category: 'Ground Materials', kind: 'prop',
    glbStem: 'texture_pack_2_ground', defaultScale: 1.0,
    hint: 'Sampler of ground tiles — useful as a reference card.' },

  // ── Ground Cover — Kenney CC0 GLBs (always available) ─────────────
  // Real 3D geometry for grass, sand, and mixed foliage patches.
  // Place these densely to dress the terrain between tree placements.
  { id: 'kenney-grass',          label: 'Grass (3D)',          category: 'Foliage', kind: 'bush',
    publicModelPath: 'nature/grass.glb',                defaultScale: 1.2,
    hint: 'Kenney CC0 stylized 3D grass tuft.' },
  { id: 'kenney-grass-patch',    label: 'Grass Patch',         category: 'Foliage', kind: 'bush',
    publicModelPath: 'nature/grass-patch.glb',          defaultScale: 1.2,
    hint: 'Kenney CC0 flat grass ground patch.' },
  { id: 'kenney-patch-grass',    label: 'Grass Ground Cover',  category: 'Foliage', kind: 'bush',
    publicModelPath: 'nature/patch-grass.glb',          defaultScale: 1.5,
    hint: 'Kenney CC0 ground-level grass cover patch.' },
  { id: 'kenney-patch-foliage',  label: 'Grass & Foliage',     category: 'Foliage', kind: 'bush',
    publicModelPath: 'nature/patch-grass-foliage.glb',  defaultScale: 1.3,
    hint: 'Kenney CC0 grass patch with leaf foliage accents.' },
  { id: 'kenney-grass-plant',    label: 'Grass Plant',         category: 'Foliage', kind: 'bush',
    publicModelPath: 'nature/grass-plant.glb',          defaultScale: 1.0,
    hint: 'Kenney CC0 single upright grass plant.' },
  { id: 'kenney-patch-sand',     label: 'Sand Patch',          category: 'Foliage', kind: 'prop',
    publicModelPath: 'nature/patch-sand.glb',           defaultScale: 1.5,
    hint: 'Kenney CC0 sandy ground patch for beach areas.' },

  // ── Tree Packs — Kenney Nature Pack ─────────────────────────────────
  // Full Kenney nature pack — loads the whole scene as one prop. Use the
  // individual palm/rock entries above for single-asset placement.
  { id: 'kenney-nature-pack', label: 'Kenney Nature Pack', category: 'Tree Packs', kind: 'prop',
    publicModelPath: 'nature/nature-pack.glb', defaultScale: 1.0,
    hint: 'Full Kenney CC0 nature pack — trees, grass, rocks in one GLB scene.' },

  // ── Warlords CDN — Battle Kenney nature (fleet SSOT) ────────────────
  // Live on assets.grudge-studio.com; matches GrudgeBuilder natureAssetCatalog
  // + TI WARLORDS_BATTLE_NATURE. Prefer these for production island work.
  { id: 'wl-common-tree-1', label: 'Common Tree 1 (CDN)', category: 'Trees', kind: 'tree',
    cdnR2Key: 'models/nature/CommonTree_1.glb', defaultScale: 1.4,
    hint: 'Warlords battle pack — CommonTree_1.glb on CDN.' },
  { id: 'wl-common-tree-2', label: 'Common Tree 2 (CDN)', category: 'Trees', kind: 'tree',
    cdnR2Key: 'models/nature/CommonTree_2.glb', defaultScale: 1.4,
    hint: 'Warlords battle pack — CommonTree_2.glb on CDN.' },
  { id: 'wl-common-tree-3', label: 'Common Tree 3 (CDN)', category: 'Trees', kind: 'tree',
    cdnR2Key: 'models/nature/CommonTree_3.glb', defaultScale: 1.4,
    hint: 'Warlords battle pack — CommonTree_3.glb on CDN.' },
  { id: 'wl-pine-1', label: 'Pine 1 (CDN)', category: 'Winter Trees', kind: 'tree',
    cdnR2Key: 'models/nature/Pine_1.glb', defaultScale: 1.5,
    hint: 'Warlords battle pack pine — winter/forest biomes.' },
  { id: 'wl-pine-2', label: 'Pine 2 (CDN)', category: 'Winter Trees', kind: 'tree',
    cdnR2Key: 'models/nature/Pine_2.glb', defaultScale: 1.5,
    hint: 'Warlords battle pack pine variant.' },
  { id: 'wl-dead-tree-1', label: 'Dead Tree 1 (CDN)', category: 'Autumn Trees', kind: 'tree',
    cdnR2Key: 'models/nature/DeadTree_1.glb', defaultScale: 1.3,
    hint: 'Warlords dead tree — volcanic / storm biomes.' },
  { id: 'wl-rock-med-1', label: 'Rock Medium 1 (CDN)', category: 'Rocks & Gems', kind: 'rock',
    cdnR2Key: 'models/nature/Rock_Medium_1.glb', defaultScale: 1.0,
    hint: 'Warlords battle pack medium rock.' },
  { id: 'wl-rock-med-2', label: 'Rock Medium 2 (CDN)', category: 'Rocks & Gems', kind: 'rock',
    cdnR2Key: 'models/nature/Rock_Medium_2.glb', defaultScale: 1.0,
    hint: 'Warlords battle pack medium rock variant.' },
  { id: 'wl-bush', label: 'Bush Common (CDN)', category: 'Foliage', kind: 'bush',
    cdnR2Key: 'models/nature/Bush_Common.glb', defaultScale: 1.0,
    hint: 'Warlords common bush.' },
  { id: 'wl-grass-tall', label: 'Grass Tall (CDN)', category: 'Foliage', kind: 'bush',
    cdnR2Key: 'models/nature/Grass_Common_Tall.glb', defaultScale: 1.2,
    hint: 'Warlords tall grass cover.' },
  { id: 'wl-mushroom', label: 'Mushroom (CDN)', category: 'Foliage', kind: 'flower',
    cdnR2Key: 'models/nature/Mushroom_Common.glb', defaultScale: 0.8,
    hint: 'Warlords common mushroom.' },

  // ── Warlords CDN — CreatureManifest wildlife ───────────────────────
  { id: 'wl-wolf', label: 'Wolf (CDN)', category: 'Wildlife', kind: 'creature',
    cdnR2Key: 'models/creatures/land/wolf.glb', defaultScale: 1.0,
    defaultData: { species: 'wolf', behavior: 'wander', speed: 2.4, visionRadius: 18, fleeSpeed: 6, homeRadius: 28 },
    hint: 'CreatureManifest wolf — assets.grudge-studio.com.' },
  { id: 'wl-deer', label: 'Deer COTW (CDN)', category: 'Wildlife', kind: 'creature',
    cdnR2Key: 'models/creatures/land/cotw/deer.glb', defaultScale: 1.0,
    defaultData: { species: 'deer', behavior: 'wander', speed: 1.6, visionRadius: 14, fleeSpeed: 5.2, homeRadius: 18 },
    hint: 'COTW deer — biome ecosystem default prey.' },
  { id: 'wl-buffalo', label: 'Buffalo (CDN)', category: 'Wildlife', kind: 'creature',
    cdnR2Key: 'models/creatures/land/buffalo.glb', defaultScale: 1.2,
    defaultData: { species: 'buffalo', behavior: 'wander', speed: 2.0, visionRadius: 14, fleeSpeed: 4.5, homeRadius: 25 },
    hint: 'Plains buffalo — CreatureManifest.' },
  { id: 'wl-boar', label: 'Boar COTW (CDN)', category: 'Wildlife', kind: 'creature',
    cdnR2Key: 'models/creatures/land/cotw/boar.glb', defaultScale: 0.95,
    defaultData: { species: 'boar', behavior: 'wander', speed: 1.8, visionRadius: 12, fleeSpeed: 5, homeRadius: 20 },
    hint: 'COTW boar — alias boar → cotw_boar in CreatureManifest.' },
  { id: 'wl-bear', label: 'Bear COTW (CDN)', category: 'Wildlife', kind: 'creature',
    cdnR2Key: 'models/creatures/land/cotw/bear.glb', defaultScale: 1.1,
    defaultData: { species: 'bear', behavior: 'wander', speed: 1.5, visionRadius: 16, fleeSpeed: 4, homeRadius: 24 },
    hint: 'COTW bear — alias bear → cotw_bear.' },
  { id: 'wl-rabbit', label: 'Hare / Rabbit (CDN)', category: 'Wildlife', kind: 'creature',
    cdnR2Key: 'models/creatures/land/cotw/beaver.glb', defaultScale: 0.45,
    defaultData: { species: 'rabbit', behavior: 'wander', speed: 2.2, visionRadius: 14, fleeSpeed: 7, homeRadius: 16 },
    hint: 'Rabbit/hare pool key — beaver proxy until rabbit.glb ships.' },
  { id: 'wl-fish-angler', label: 'Anglerfish (CDN)', category: 'Sea Life', kind: 'creature',
    cdnR2Key: 'models/creatures/fish/anglerfish.glb', defaultScale: 0.8,
    defaultData: { species: 'anglerfish' },
    hint: 'Production pond fish — CreatureManifest GLB.' },
  { id: 'wl-fish-lion', label: 'Lionfish (CDN)', category: 'Sea Life', kind: 'creature',
    cdnR2Key: 'models/creatures/fish/lionfish.glb', defaultScale: 0.8,
    defaultData: { species: 'lionfish' },
    hint: 'Production pond fish GLB.' },

  // ── Foliage — ferns, flowers, mushrooms, ground cover ──────────
  { id: 'bush-leaves', label: 'Leaf Bush',     category: 'Foliage', kind: 'bush',
    defaultScale: 1.0, defaultData: { foliageStyle: 'textured', leaf: 'bush' },
    hint: 'Textured bush card.' },
  { id: 'flower-cluster', label: 'Flowers',    category: 'Foliage', kind: 'flower',
    defaultScale: 1.0, defaultData: { foliageStyle: 'textured', flowerAtlas: 'mixed' },
    hint: 'Mixed flower cluster.' },
  { id: 'flower-red', label: 'Red Flowers',    category: 'Foliage', kind: 'flower',
    defaultScale: 1.0, defaultData: { foliageStyle: 'textured', flowerAtlas: 'red' },
    hint: 'Crimson flowers.' },
  { id: 'flower-purple', label: 'Purple Flowers', category: 'Foliage', kind: 'flower',
    defaultScale: 1.0, defaultData: { foliageStyle: 'textured', flowerAtlas: 'purple' },
    hint: 'Violet flowers.' },
  { id: 'flower-yellow', label: 'Yellow Flowers', category: 'Foliage', kind: 'flower',
    defaultScale: 1.0, defaultData: { foliageStyle: 'textured', flowerAtlas: 'yellow' },
    hint: 'Gold flowers.' },
  { id: 'flower-pink', label: 'Pink Flowers',  category: 'Foliage', kind: 'flower',
    defaultScale: 1.0, defaultData: { foliageStyle: 'textured', flowerAtlas: 'pink' },
    hint: 'Pink flowers.' },
  { id: 'fern-broad',   label: 'Broad Fern',   category: 'Foliage', kind: 'bush',
    defaultScale: 1.0, defaultData: { foliageStyle: 'textured', fern: 'broad' },
    hint: 'Wide fern frond.' },
  { id: 'fern-narrow',  label: 'Narrow Fern',  category: 'Foliage', kind: 'bush',
    defaultScale: 1.0, defaultData: { foliageStyle: 'textured', fern: 'narrow' },
    hint: 'Tall narrow fern.' },
  { id: 'fern-leafy',   label: 'Leafy Fern',   category: 'Foliage', kind: 'bush',
    defaultScale: 1.0, defaultData: { foliageStyle: 'textured', fern: 'leafy' },
    hint: 'Leafy fern frond.' },
  { id: 'mushroom-red',    label: 'Red Mushroom',    category: 'Foliage', kind: 'flower',
    defaultScale: 1.0, defaultData: { foliageStyle: 'textured', mushroom: 'red' },
    hint: 'Red-cap mushroom.' },
  { id: 'mushroom-brown',  label: 'Brown Mushroom',  category: 'Foliage', kind: 'flower',
    defaultScale: 1.0, defaultData: { foliageStyle: 'textured', mushroom: 'brown' },
    hint: 'Forest brown mushroom.' },
  { id: 'mushroom-purple', label: 'Purple Mushroom', category: 'Foliage', kind: 'flower',
    defaultScale: 1.0, defaultData: { foliageStyle: 'textured', mushroom: 'purple' },
    hint: 'Stylized purple mushroom.' },
  { id: 'grass-clump', label: 'Grass Clump',   category: 'Foliage', kind: 'bush',
    defaultScale: 1.0, defaultData: { foliageStyle: 'textured', grass: true },
    hint: 'Instanced grass blades.' },
  { id: 'rock-tile', label: 'Mossy Rock', category: 'Rocks & Gems', kind: 'rock',
    defaultScale: 1.0, defaultData: { foliageStyle: 'textured', rockTexture: true },
    hint: 'Procedural rock textured with the Rocks atlas.' },
];

export const ASSET_LIBRARY: AssetSpec[] = RAW.map((r) => {
  // Priority: cdnR2Key (fleet CDN) > publicModelPath (local public/) > glbStem > procedural
  let url: string | undefined;
  if (r.cdnR2Key) {
    const key = r.cdnR2Key.replace(/^\//, '');
    url = `${WARLORDS_CDN}/${key.split('/').map(encodeURIComponent).join('/')}`;
  } else if (r.publicModelPath) {
    url = `${import.meta.env.BASE_URL}assets/models/${r.publicModelPath}`;
  } else if (r.glbStem) {
    url = resolveGlb(r.glbStem);
  }
  const { glbStem: _g, publicModelPath: _p, cdnR2Key: _c, ...spec } = r;
  void _g; void _p; void _c;
  return { ...spec, assetUrl: url };
}).filter((spec) => {
  const raw = RAW.find((r) => r.id === spec.id);
  // Drop attached_assets GLB entries that didn't resolve (file not uploaded yet).
  // cdnR2Key / publicModelPath entries always resolve. Procedural entries always kept.
  if (spec.assetUrl === undefined && raw?.glbStem && !raw?.publicModelPath && !raw?.cdnR2Key) {
    // eslint-disable-next-line no-console
    console.warn('[LandscapeAssets] dropped unresolved entry', spec.id);
    return false;
  }
  return true;
});

export const ASSET_CATEGORIES: AssetCategory[] = [
  'Resources',
  'Trees',
  'Autumn Trees',
  'Winter Trees',
  'Tropical',
  'Tree Packs',
  'Foliage',
  'Sea Life',
  'Wildlife',
  'Ships & Docks',
  'Logs & Stumps',
  'Rocks & Gems',
  'Ground Materials',
];

/**
 * Multi-mesh "pack" assets — these GLBs bundle many independent props in a
 * single scene graph. The pack inspector traverses these to surface stable
 * per-mesh UUIDs so the user can place individual sub-meshes too.
 */
export const PACK_ASSET_IDS = new Set<string>([
  'stylized-foliage-scene',
  'wood-debris',
  'trees-set-a',
  'autumn-pack',
  'tropical-pack',
  'snowy-pines',
  'pine-pack',
  'crystal-gems',
  'res-blue',
  'res-red',
  'jungle-pbr-mats',
  'texture-pack-2-ground',
]);

/** True if this asset is a multi-mesh pack worth inspecting per-mesh. */
export function isPackAsset(spec: AssetSpec): boolean {
  return !!spec.assetUrl && PACK_ASSET_IDS.has(spec.id);
}

export function getAssetById(id: string): AssetSpec | undefined {
  return ASSET_LIBRARY.find((a) => a.id === id);
}
