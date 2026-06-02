/**
 * CreatureRegistry — declarative species → ObjectStore asset map.
 *
 * Single source of truth for creature visuals in the editor. Each entry
 * pulls real animated FBX models from the public Grudge Studio ObjectStore
 * (`https://objectstore.grudge-studio.com`) — no procedurally-built primitives.
 *
 * Two flavours of pack:
 *   - "split"  packs (FRESH GRUDGE convention): base FBX + per-anim
 *               sibling files like `xiezi@walk.FBX`. We stitch them
 *               with `loadAnimatedFbx`.
 *   - "merged" packs: a single FBX with every clip inside. We load it
 *               with `loadFbxBase` and use the original clip names.
 *
 * Reference: ObjectStore `entities-manifest.json` (FRESH Unity export).
 */
import type { CreatureState } from '../runtime/ai';

export type CreatureSpecies = 'crab' | 'bear' | 'wolf' | 'tortoise' | 'raptor';

/**
 * State → clip name. For *split* packs the value is the ObjectStore key of
 * the FBX file holding that single anim; we rename the clip on stitch so
 * AnimationMixer can look it up by state name. For *merged* packs the value
 * is the literal AnimationClip name baked into the FBX by the source
 * authoring tool — the registry's `clipNames` lookup table maps state
 * names back to those.
 */
export interface CreatureSpec {
  /** Tag shown in the editor outliner / inspector. */
  label: string;
  /** "split"  = base + @<clip>.FBX siblings; "merged" = single FBX with multiple clips. */
  layout: 'split' | 'merged';
  /** ObjectStore key of the base/skeleton FBX. */
  baseKey: string;
  /**
   * For split packs only: state → ObjectStore key of an anim FBX.
   * `idle` is required so we always have something to play; the rest are
   * optional and the runtime falls back to `idle` if they're missing.
   */
  splitClips?: Partial<Record<CreatureState | 'attack' | 'hurt' | 'die', string>>;
  /**
   * For merged packs: state → literal clip name inside the merged FBX.
   * Use the AnimationClip name as authored (case-sensitive).
   */
  mergedClipNames?: Partial<Record<CreatureState | 'attack' | 'hurt' | 'die', string>>;
  /**
   * Uniform scale applied at placement. ObjectStore FBX models are exported
   * in centimetres (Unity/3ds Max convention) so a real-world-sized creature
   * lands at ~100x the metric scale. We multiply by 0.01 here as the
   * default; if a specific pack ships in metres, override with 1.0.
   *
   * This is the knob that fixes "crabs are 100x too large".
   */
  defaultScale: number;
  /**
   * Y-axis offset in metres applied so the FBX's pivot lines up with the
   * terrain ground plane. Most FRESH packs are pivoted at the feet so we
   * leave it at 0; tortoise-boss has a centered pivot so we lift it.
   */
  yOffset: number;
  /**
   * Biome ids the IslandGenerator may scatter this species onto.
   *   0 = grass, 1 = sand, 2 = rock, 3 = snow
   */
  biomes: number[];
  /** Tags surfaced in the asset palette later. */
  tags: string[];
}

// Common ObjectStore prefix for the FRESH GRUDGE Unity export.
const M = 'monsters/models';

export const CREATURE_REGISTRY: Record<CreatureSpecies, CreatureSpec> = {
  crab: {
    label: 'Crab',
    layout: 'split',
    baseKey: `${M}/monster-crab_xiezi.FBX`,
    splitClips: {
      idle:   `${M}/monster-crab_xiezi@stand.FBX`,
      wander: `${M}/monster-crab_xiezi@walk.FBX`,
      // Crabs use the same walk anim while fleeing — frame-rate is bumped
      // by AnimationAction.timeScale at runtime instead of swapping clips.
      flee:   `${M}/monster-crab_xiezi@walk.FBX`,
      attack: `${M}/monster-crab_xiezi@ATK01.FBX`,
      hurt:   `${M}/monster-crab_xiezi@hurt.FBX`,
      die:    `${M}/monster-crab_xiezi@die.FBX`,
    },
    // FBX exports from this pack are in centimetres at human-bipedal scale,
    // but a crab is shore-pebble-sized. 0.0035 lands a realistic ~10–15cm
    // crab on screen given the default editor camera framing.
    defaultScale: 0.0035,
    yOffset: 0,
    biomes: [1], // sand only
    tags: ['shore', 'small', 'animated'],
  },
  bear: {
    label: 'Bear',
    layout: 'split',
    baseKey: `${M}/monster-bear_bear.FBX`,
    splitClips: {
      idle:   `${M}/monster-bear_bear@stand.FBX`,
      wander: `${M}/monster-bear_bear@walk.FBX`,
      flee:   `${M}/monster-bear_bear@walk.FBX`,
      attack: `${M}/monster-bear_bear@ATK01.FBX`,
      hurt:   `${M}/monster-bear_bear@hurt.FBX`,
      die:    `${M}/monster-bear_bear@die.FBX`,
    },
    // Bear is ~2m at the shoulder — closer to the cm→m conversion factor.
    defaultScale: 0.012,
    yOffset: 0,
    biomes: [0, 2], // grass + rock highlands
    tags: ['large', 'predator', 'animated'],
  },
  wolf: {
    label: 'Wolf',
    layout: 'split',
    baseKey: `${M}/monster-wolf-pack_yelang.FBX`,
    splitClips: {
      idle:   `${M}/monster-wolf-pack_yelang@stand.FBX`,
      // No @walk in the pack — `@run` is the only locomotion clip.
      wander: `${M}/monster-wolf-pack_yelang@run.FBX`,
      flee:   `${M}/monster-wolf-pack_yelang@run.FBX`,
      attack: `${M}/monster-wolf-pack_yelang@ATK01.FBX`,
      hurt:   `${M}/monster-wolf-pack_yelang@hurt.FBX`,
      die:    `${M}/monster-wolf-pack_yelang@die.FBX`,
    },
    defaultScale: 0.009,
    yOffset: 0,
    biomes: [0],
    tags: ['mid', 'predator', 'animated'],
  },
  tortoise: {
    label: 'Tortoise',
    layout: 'merged',
    baseKey: `${M}/tortoise-boss_Tortoise_Boss_Anims.fbx`,
    // Clip names inside the merged FBX are author-defined; we leave the map
    // empty and the runtime falls back to "first non-bind clip" via its
    // pickClip heuristic. This is intentional — once we inspect the file
    // post-deploy we can fill in real names without a code change to the
    // runtime.
    mergedClipNames: {},
    // Tortoise pack ships at metres; tortoise-boss is intentionally large.
    defaultScale: 0.6,
    yOffset: 0,
    biomes: [0, 2],
    tags: ['boss', 'slow', 'animated'],
  },
  raptor: {
    label: 'Raptor',
    layout: 'merged',
    baseKey: `${M}/velociraptor_Raptor_Animated_FBX_5K.fbx`,
    mergedClipNames: {},
    defaultScale: 0.018,
    yOffset: 0,
    biomes: [0, 1],
    tags: ['mid', 'predator', 'animated'],
  },
};

export function getCreatureSpec(species: string): CreatureSpec | undefined {
  return CREATURE_REGISTRY[species as CreatureSpecies];
}

export const CREATURE_SPECIES: CreatureSpecies[] = Object.keys(CREATURE_REGISTRY) as CreatureSpecies[];
