/**
 * PlayerCharacterRegistry — declarative third-person avatar specs.
 *
 * Mirrors `CreatureRegistry` but adds locomotion-specific hooks the
 * `PlayerController` needs (eye height, walk/run speeds). Like creatures,
 * every avatar is loaded from the public Grudge Studio ObjectStore — no
 * procedural meshes; if a model can't be fetched, the player renders
 * nothing rather than fall back to a primitive.
 *
 * Two layouts:
 *   - "merged"  — single GLB/FBX with multiple AnimationClips inside.
 *                  PlayerCharacter pickClips by name keyword (idle/walk/run).
 *   - "split"   — base FBX + per-anim @<id>.FBX siblings. We stitch via
 *                  `loadAnimatedFbx` and the pre-named clips drive locomotion.
 */

export type PlayerCharacterId =
  | 'hero'
  | 'soldier'
  | 'male'
  | 'female'
  | 'warrior'
  | 'mage'
  | 'assassin'
  | 'archer';

/**
 * Locomotion intent → either an ObjectStore key (split) or a literal clip
 * name baked into the merged file. Nullable values fall back to `idle`.
 */
export interface PlayerClipMap {
  idle?: string;
  walk?: string;
  run?: string;
  attack?: string;
  jump?: string;
  hurt?: string;
  die?: string;
}

export interface PlayerCharacterSpec {
  /** Name shown in the toolbar dropdown. */
  label: string;
  /** Source layout — merged GLB/FBX, or split base+@anim FBX. */
  layout: 'merged' | 'split';
  /** ObjectStore key of the base/skeleton file. */
  baseKey: string;
  /** Split: state \u2192 ObjectStore key of an anim FBX (renamed on stitch). */
  splitClips?: PlayerClipMap;
  /** Merged: state \u2192 literal clip name inside the file (case-sensitive). */
  mergedClipNames?: PlayerClipMap;
  /**
   * Uniform scale applied in `<PlayerCharacter>` so the FBX's native units
   * land at metres. FRESH GRUDGE FBX exports are in centimetres (~100), the
   * RPG Hero GLBs are at native metres (~1).
   */
  defaultScale: number;
  /** Pivot offset \u2014 lift the rig if the FBX pivot sits inside the body. */
  yOffset: number;
  /** Eye / camera-target height in metres above the player's feet. */
  eyeHeight: number;
  /** Locomotion tuning for the controller (m/s). */
  walkSpeed: number;
  runSpeed: number;
  /** Optional jump impulse magnitude (m/s) \u2014 future use; controller stays
   *  grounded for now. */
  jumpVelocity: number;
}

const C = 'characters/models';
const G = 'models/characters';
const MX = 'models/animations/melee-axe';

export const PLAYER_CHARACTERS: Record<PlayerCharacterId, PlayerCharacterSpec> = {
  // ── Default basic character: Meshy2 rig + Mixamo locomotion ──────
  // The cleanest, best-formed avatar in ObjectStore. Uses the Meshy2
  // auto-rigged FBX as the skeleton and stitches in Mixamo's standard
  // "standing" locomotion clips. Industry-standard naming means our
  // pickClip heuristic resolves perfectly: idle → "standing idle",
  // walk → "standing walk forward", run → "standing run forward".
  //
  // FBX exports from Mixamo are in centimetres so defaultScale=0.01.
  hero: {
    label: 'Hero (basic)',
    layout: 'split',
    baseKey: `${MX}/Meshy2_AI_Character_output.fbx`,
    splitClips: {
      idle:   `${MX}/standing idle.fbx`,
      walk:   `${MX}/standing walk forward.fbx`,
      run:    `${MX}/standing run forward.fbx`,
      jump:   `${MX}/standing jump.fbx`,
      attack: `${MX}/standing melee attack horizontal.fbx`,
      hurt:   `${MX}/standing react large gut.fbx`,
    },
    defaultScale: 0.01,
    yOffset: 0,
    eyeHeight: 1.65,
    walkSpeed: 2.4,
    runSpeed: 5.0,
    jumpVelocity: 4.5,
  },

  // ── Modern GLB heroes (merged, web-native) ─────────────────
  soldier: {
    label: 'Soldier',
    layout: 'merged',
    baseKey: `${G}/soldier.glb`,
    mergedClipNames: {}, // pickClip falls back to keyword search
    defaultScale: 1.0,
    yOffset: 0,
    eyeHeight: 1.6,
    walkSpeed: 2.6,
    runSpeed: 5.4,
    jumpVelocity: 4.5,
  },
  male: {
    label: 'Hero (Male)',
    layout: 'merged',
    baseKey: `${G}/male_base.glb`,
    mergedClipNames: {},
    defaultScale: 1.0,
    yOffset: 0,
    eyeHeight: 1.6,
    walkSpeed: 2.4,
    runSpeed: 5.0,
    jumpVelocity: 4.5,
  },
  female: {
    label: 'Hero (Female)',
    layout: 'merged',
    baseKey: `${G}/female_base.glb`,
    mergedClipNames: {},
    defaultScale: 1.0,
    yOffset: 0,
    eyeHeight: 1.6,
    walkSpeed: 2.4,
    runSpeed: 5.0,
    jumpVelocity: 4.5,
  },

  // ── FRESH GRUDGE FBX heroes (split per-clip) ─────────────────────
  // These packs only ship a handful of clips named s### (stand) and a###
  // (action). For locomotion we map idle = s###; walk/run reuse idle until
  // the user uploads a dedicated walk clip — the controller still drives
  // root-motion via translation, so the avatar visibly moves even without
  // a walk anim.
  warrior: {
    label: 'Warrior',
    layout: 'split',
    baseKey: `${C}/player-warrior_warrior.FBX`,
    splitClips: {
      idle:   `${C}/player-warrior_warrior@s101.FBX`,
      walk:   `${C}/player-warrior_warrior@s101.FBX`,
      run:    `${C}/player-warrior_warrior@s101.FBX`,
      attack: `${C}/player-warrior_warrior@a100.FBX`,
    },
    defaultScale: 0.012,
    yOffset: 0,
    eyeHeight: 1.7,
    walkSpeed: 2.4,
    runSpeed: 5.0,
    jumpVelocity: 4.5,
  },
  mage: {
    label: 'Mage',
    layout: 'split',
    baseKey: `${C}/player-mage_mage.FBX`,
    splitClips: {
      idle:   `${C}/player-mage_mage@s301.FBX`,
      walk:   `${C}/player-mage_mage@s301.FBX`,
      run:    `${C}/player-mage_mage@s301.FBX`,
      attack: `${C}/player-mage_mage@a300.FBX`,
    },
    defaultScale: 0.012,
    yOffset: 0,
    eyeHeight: 1.7,
    walkSpeed: 2.2,
    runSpeed: 4.6,
    jumpVelocity: 4.0,
  },
  assassin: {
    label: 'Assassin',
    layout: 'split',
    baseKey: `${C}/player-assassin_assassin.FBX`,
    splitClips: {
      // Assassin has many a### clips; 400/401 are commonly idle/walk in
      // FRESH packs but it's pack-specific. The controller still works if
      // these are technically stand poses \u2014 it just won't lip-sync the
      // limbs to translation. Best-effort until we pin down clip semantics.
      idle:   `${C}/player-assassin_assassin@a400.FBX`,
      walk:   `${C}/player-assassin_assassin@a401.FBX`,
      run:    `${C}/player-assassin_assassin@a402.FBX`,
      attack: `${C}/player-assassin_assassin@a403.FBX`,
    },
    defaultScale: 0.012,
    yOffset: 0,
    eyeHeight: 1.65,
    walkSpeed: 2.8,
    runSpeed: 5.6,
    jumpVelocity: 4.8,
  },
  archer: {
    label: 'Archer',
    layout: 'split',
    baseKey: `${C}/player-archer_archer.FBX`,
    splitClips: {
      idle:   `${C}/player-archer_archer@a500.FBX`,
      walk:   `${C}/player-archer_archer@a501.FBX`,
      run:    `${C}/player-archer_archer@a502.FBX`,
      attack: `${C}/player-archer_archer@a505.FBX`,
    },
    defaultScale: 0.012,
    yOffset: 0,
    eyeHeight: 1.7,
    walkSpeed: 2.5,
    runSpeed: 5.2,
    jumpVelocity: 4.5,
  },
};

export const PLAYER_CHARACTER_IDS: PlayerCharacterId[] =
  Object.keys(PLAYER_CHARACTERS) as PlayerCharacterId[];

export function getPlayerCharacterSpec(id: string): PlayerCharacterSpec | undefined {
  return PLAYER_CHARACTERS[id as PlayerCharacterId];
}
