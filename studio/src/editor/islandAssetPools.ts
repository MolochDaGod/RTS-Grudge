/**
 * Curated asset pools for procedural island seeding.
 * Mixes local Kenney GLBs, stylized packs, and R2 CDN fallbacks.
 */
const BASE = import.meta.env.BASE_URL;
const R2 = 'https://assets.grudge-studio.com';

export const m = (path: string) => `${BASE}${path.replace(/^\//, '')}`;
export const r2 = (key: string) => `${R2}/builtin/${key}`;

/** Stylized + Kenney tree GLBs — assigned to auto-placed trees. */
export const TREE_GLBS = [
  m('assets/models/nature/tree_aspen.glb'),
  m('assets/models/nature/nature-pack.glb'),
  m('assets/models/nature/palm-detailed-straight.glb'),
  m('assets/models/nature/palm-detailed-bend.glb'),
  m('assets/models/nature/palm-straight.glb'),
  m('assets/models/nature/palm-bend.glb'),
  m('assets/models/nature/tree_wind_system.glb'),
  r2('nature-tree-pack.glb'),
  r2('nature-tropical-pack.glb'),
] as const;

/** Kenney + sand rocks — mixed with procedural PBR rocks in seed. */
export const ROCK_GLBS = [
  m('assets/models/nature/rocks-a.glb'),
  m('assets/models/nature/rocks-b.glb'),
  m('assets/models/nature/rocks-c.glb'),
  m('assets/models/nature/rocks-sand-a.glb'),
  m('assets/models/nature/rocks-sand-b.glb'),
] as const;

/** Harvest / resource GLBs */
export const HARVEST_GLBS = {
  crystal: m('assets/models/nature/ore_and_crystals.glb'),
  ore: m('assets/models/nature/proptober_day_11_iron_ore_vein.glb'),
  wood: m('assets/models/nature/log-stump.glb'),
  hemp: m('assets/models/nature/hemp.glb'),
  scrap: m('assets/models/nature/pile_of_scrap_metal_tools_rubbish_garbage.glb'),
} as const;

/** Poly Haven–style terrain PBR (hosted under our terrain CDN paths). */
export const POLYHAVEN_TERRAIN = {
  forestGrass: m('textures/terrain/forest/grass_diff.jpg'),
  forestRock: m('textures/terrain/forest/rock_diff.jpg'),
  beachSand: m('textures/terrain/beach/sand_diff.jpg'),
} as const;

export const CREATURE_ASSET: Record<string, string> = {
  wolf: m('assets/models/creatures/wolf.glb'),
  deer: m('assets/models/creatures/deer.glb'),
  buffalo: m('assets/models/creatures/buffalo.glb'),
  ibex: m('assets/models/creatures/ibex.glb'),
  hawk: m('assets/models/creatures/hawk.glb'),
  harpy: m('assets/models/creatures/harpy.glb'),
  hummingbird: m('assets/models/creatures/hummingbird.glb'),
  shark: m('assets/models/creatures/shark.glb'),
  crocodile: m('assets/models/creatures/crocodile.glb'),
  crab: m('assets/models/creatures/crab.glb'),
};

export const FISH_POOL = [
  { species: 'clownfish', glb: m('assets/models/fish/clownfish.glb'), scale: 0.7 },
  { species: 'blue-tang', glb: m('assets/models/fish/blue-tang.glb'), scale: 0.7 },
  { species: 'lionfish', glb: m('assets/models/fish/lionfish.glb'), scale: 0.8 },
  { species: 'tuna', glb: m('assets/models/fish/tuna.glb'), scale: 1.0 },
  { species: 'swordfish', glb: m('assets/models/fish/swordfish.glb'), scale: 1.0 },
  { species: 'puffer', glb: m('assets/models/fish/puffer.glb'), scale: 0.6 },
  { species: 'parrot-fish', glb: m('assets/models/fish/parrot-fish.glb'), scale: 0.8 },
  { species: 'anglerfish', glb: m('assets/models/fish/anglerfish.glb'), scale: 0.9 },
  { species: 'piranha', glb: m('assets/models/fish/piranha.glb'), scale: 0.7 },
] as const;

export function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}