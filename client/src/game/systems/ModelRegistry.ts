import type { CombatClass, WeaponType } from "@/lib/stores/useGame";

export type ModelType = "character" | "weapon" | "prop";
export type ModelFormat = "glb" | "gltf" | "fbx";

export type Race =
  | "orc"
  | "undead"
  | "human"
  | "barbarian"
  | "elf"
  | "dwarf"
  | "rogue"
  | "goblin"
  | "werewolf"
  | "lizardfolk"
  | "avian";

export type Faction =
  | "legion"
  | "crusade"
  | "fabled"
  | "pirate"
  | "wild"
  | "hostile"
  | "independent";

export type Gender = "male" | "female" | "neutral";

export interface ModelEntry {
  id: string;
  name: string;
  path: string;
  type: ModelType;
  format: ModelFormat;
  defaultScale: number;
  defaultHeight: number;
  category: string;
  combatClass: CombatClass;
  description: string;
  race?: Race;
  faction?: Faction;
  gender?: Gender;
  isPlayable?: boolean;
  isWorgeForm?: boolean;
  enemyScale?: { height: number; width: number };
}

export type WeaponCategory = "blade" | "blunt" | "polearm" | "ranged" | "magic" | "shield" | "armor";

export interface WeaponModelEntry {
  id: string;
  name: string;
  path: string;
  format: ModelFormat;
  category: WeaponCategory;
  weaponType: WeaponType;
  defaultScale: number;
  thumbnail?: string;
  /** Skip applying the per-type texture atlas (already textured GLBs). */
  skipTextureAtlas?: boolean;
  /** Override the off-hand IK grip target in weapon-local space [x,y,z]. */
  offHandGripLocal?: [number, number, number];
  /** Per-model scale multiplier applied after type-default sizing. */
  sizeBias?: number;
}

export interface WeaponAnimMapping {
  weaponType: WeaponType;
  recommendedPacks: string[];
  description: string;
}

export interface AnimationPackEntry {
  id: string;
  name: string;
  basePath: string;
  combatStyle: string;
  bundledFile?: string;
  animations: { name: string; file: string }[];
}

export const ALL_CHARACTER_MODELS: ModelEntry[] = [
  { id: "orc_scout-male", name: "Orc Scout (M)", path: "/models/characters/orc_scout-male.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.9, category: "warrior", combatClass: "melee", description: "Legion orc raider. Tusked, lean, brutal melee striker.", race: "orc", faction: "legion", gender: "male", isPlayable: true },
  { id: "orc_scout-female", name: "Orc Scout (F)", path: "/models/characters/orc_scout-female.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.85, category: "warrior", combatClass: "melee", description: "Legion orc raider. Agile and savage in equal measure.", race: "orc", faction: "legion", gender: "female", isPlayable: true },
  { id: "undead_grave_knight-male", name: "Grave Knight (NPC)", path: "/models/characters/undead_grave_knight-male.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.9, category: "warrior", combatClass: "melee", description: "Legion undead NPC. Heavy plate, sword & shield, unkillable.", race: "undead", faction: "legion", gender: "male", isPlayable: false },
  { id: "undead_grave_knight-female", name: "Grave Knight (NPC)", path: "/models/characters/undead_grave_knight-female.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.85, category: "warrior", combatClass: "melee", description: "Legion undead NPC. Cursed armor, relentless blade.", race: "undead", faction: "legion", gender: "female", isPlayable: false },
  { id: "human_battle_mage-male", name: "Battle Mage (M)", path: "/models/characters/human_battle_mage-male.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.85, category: "caster", combatClass: "caster", description: "Crusade barbarian spellsword. Robes over light armor, staff and steel.", race: "barbarian", faction: "crusade", gender: "male", isPlayable: true },
  { id: "human_battle_mage-female", name: "Battle Mage (F)", path: "/models/characters/human_battle_mage-female.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.8, category: "caster", combatClass: "caster", description: "Crusade barbarian spellsword. Arcane focus paired with melee.", race: "barbarian", faction: "crusade", gender: "female", isPlayable: true },
  { id: "night_stalker-male", name: "Night Stalker (Worge Form)", path: "/models/characters/night_stalker-male.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 2.0, category: "beast", combatClass: "melee", description: "Worge transformation. Fur and leather, two-handed brawler.", race: "barbarian", faction: "wild", gender: "male", isPlayable: false, isWorgeForm: true },
  { id: "night_stalker-female", name: "Night Stalker (Worge Form)", path: "/models/characters/night_stalker-female.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.9, category: "beast", combatClass: "melee", description: "Worge transformation. Wild huntress, savage strikes.", race: "barbarian", faction: "wild", gender: "female", isPlayable: false, isWorgeForm: true },
  { id: "elf-male", name: "Elf (M)", path: "/models/characters/elf-male.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.85, category: "ranger", combatClass: "ranger", description: "Fabled elf. Pointed ears, longbow, fluid woodland combat.", race: "elf", faction: "fabled", gender: "male", isPlayable: true },
  { id: "elf-female", name: "Elf (F)", path: "/models/characters/elf-female.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.8, category: "ranger", combatClass: "ranger", description: "Fabled elf. Graceful archer, swift and lethal.", race: "elf", faction: "fabled", gender: "female", isPlayable: true },
  { id: "dwarf-male", name: "Dwarf (M)", path: "/models/characters/dwarf-male.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.4, category: "warrior", combatClass: "melee", description: "Fabled dwarf. Heavy build, axe and hammer specialist.", race: "dwarf", faction: "fabled", gender: "male", isPlayable: true },
  { id: "dwarf-female", name: "Dwarf (F)", path: "/models/characters/dwarf-female.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.4, category: "warrior", combatClass: "melee", description: "Fabled dwarf. Hammer and shield, mountain-born.", race: "dwarf", faction: "fabled", gender: "female", isPlayable: true },
  { id: "assassin-male", name: "Human (M)", path: "/models/characters/assassin-male.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.85, category: "ranger", combatClass: "melee", description: "Hooded human duelist. Twin daggers. Sails under the Pirate Confederacy.", race: "human", faction: "pirate", gender: "male", isPlayable: true },
  { id: "assassin-female", name: "Human (F)", path: "/models/characters/assassin-female.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.8, category: "ranger", combatClass: "melee", description: "Hooded human duelist. Twin daggers, silent and precise. Sails under the Pirate Confederacy.", race: "human", faction: "pirate", gender: "female", isPlayable: true },
  { id: "vampire_aristocrat-male", name: "Undead (M)", path: "/models/characters/vampire_aristocrat-male.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.85, category: "caster", combatClass: "caster", description: "Vampire aristocrat. Pale-blooded sorcerer marching under the Legion.", race: "undead", faction: "legion", gender: "male", isPlayable: true },
  { id: "vampire_aristocrat-female", name: "Undead (F)", path: "/models/characters/vampire_aristocrat-female.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.8, category: "caster", combatClass: "caster", description: "Vampire aristocrat. Pale-blooded sorceress marching under the Legion.", race: "undead", faction: "legion", gender: "female", isPlayable: true },
  { id: "werewolf", name: "Werewolf (Worge Form)", path: "/models/characters/werewolf.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 2.1, category: "beast", combatClass: "melee", description: "Early worge transformation. Lupine bipedal, claws and fangs.", race: "werewolf", faction: "wild", gender: "neutral", isPlayable: false, isWorgeForm: true },
  { id: "lizardfolk-male", name: "Lizardfolk (Worge Form)", path: "/models/characters/lizardfolk-male.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 2.0, category: "beast", combatClass: "melee", description: "Later worge transformation. Reptilian, scaled, tail-balanced.", race: "lizardfolk", faction: "wild", gender: "male", isPlayable: false, isWorgeForm: true },
  // Stylized nightmarish werewolf — high-fidelity bear form for Worge class
  { id: "stylized_nightmarish_werewolf", name: "Werewolf (Worge Bear Form)", path: "/models/characters/stylized_nightmarish_werewolf.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 2.4, category: "beast", combatClass: "melee", description: "Stylized nightmarish werewolf. High-fidelity Worge bear transformation.", race: "werewolf", faction: "wild", gender: "neutral", isPlayable: false, isWorgeForm: true },
  { id: "goblin_backstabber-male", name: "Goblin Backstabber (M)", path: "/models/characters/goblin_backstabber-male.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.4, category: "creature", combatClass: "melee", description: "Hostile goblin. Small, vicious, dagger-from-behind.", race: "goblin", faction: "hostile", gender: "male", isPlayable: false },
  { id: "goblin_backstabber-female", name: "Goblin Backstabber (F)", path: "/models/characters/goblin_backstabber-female.glb", type: "character", format: "glb", defaultScale: 1.0, defaultHeight: 1.35, category: "creature", combatClass: "melee", description: "Hostile goblin. Quick blades, no honor.", race: "goblin", faction: "hostile", gender: "female", isPlayable: false },
];

export const ALL_WEAPON_MODELS: ModelEntry[] = [
  { id: "katana", name: "Katana", path: "/models/weapons/Katana.glb", type: "weapon", format: "glb", defaultScale: 0.01, defaultHeight: 0, category: "blade", combatClass: "melee", description: "Japanese single-edged sword" },
  { id: "sword_fbx", name: "Longsword", path: "/models/weapons/Sword.glb", type: "weapon", format: "glb", defaultScale: 0.01, defaultHeight: 0, category: "blade", combatClass: "melee", description: "Standard longsword" },
  { id: "short_sword", name: "Short Sword", path: "/models/weapons/ShortSword.glb", type: "weapon", format: "glb", defaultScale: 0.01, defaultHeight: 0, category: "blade", combatClass: "melee", description: "Short blade for quick strikes" },
  { id: "club", name: "Club", path: "/models/weapons/Club.glb", type: "weapon", format: "glb", defaultScale: 0.01, defaultHeight: 0, category: "blunt", combatClass: "melee", description: "Heavy wooden club" },
  { id: "knight_char", name: "Knight (Full)", path: "/models/weapons/KnightCharacter.glb", type: "weapon", format: "glb", defaultScale: 0.01, defaultHeight: 0, category: "character", combatClass: "melee", description: "Full knight character with equipment" },
  { id: "helmet1", name: "Helmet (Open)", path: "/models/weapons/Helmet1.glb", type: "weapon", format: "glb", defaultScale: 0.01, defaultHeight: 0, category: "armor", combatClass: "melee", description: "Open-face knight helmet" },
  { id: "helmet2", name: "Helmet (Closed)", path: "/models/weapons/Helmet2.glb", type: "weapon", format: "glb", defaultScale: 0.01, defaultHeight: 0, category: "armor", combatClass: "melee", description: "Closed visor helmet" },
  { id: "helmet3", name: "Helmet (Horned)", path: "/models/weapons/Helmet3.glb", type: "weapon", format: "glb", defaultScale: 0.01, defaultHeight: 0, category: "armor", combatClass: "melee", description: "Horned battle helmet" },
  { id: "shoulder_pads", name: "Shoulder Pads", path: "/models/weapons/ShoulderPads.glb", type: "weapon", format: "glb", defaultScale: 0.01, defaultHeight: 0, category: "armor", combatClass: "melee", description: "Heavy shoulder armor" },
  { id: "offhand_tome", name: "Tome", path: "/models/weapons/offhand/Tome.glb", type: "weapon", format: "glb", defaultScale: 0.01, defaultHeight: 0, category: "magic", combatClass: "ranger", description: "Magical tome off-hand" },
  { id: "offhand_book", name: "Spellbook", path: "/models/weapons/offhand/Book.glb", type: "weapon", format: "glb", defaultScale: 0.01, defaultHeight: 0, category: "magic", combatClass: "ranger", description: "Arcane spellbook off-hand" },
  { id: "offhand_skull", name: "Skull", path: "/models/weapons/offhand/Skull.glb", type: "weapon", format: "glb", defaultScale: 0.01, defaultHeight: 0, category: "magic", combatClass: "ranger", description: "Necromantic skull off-hand" },
  { id: "offhand_nature_shield", name: "Nature Shield", path: "/models/weapons/offhand/NatureShield.glb", type: "weapon", format: "glb", defaultScale: 0.01, defaultHeight: 0, category: "shield", combatClass: "melee", description: "Shield of nature magic" },
  { id: "offhand_dark_shield", name: "Dark Shield", path: "/models/weapons/offhand/DarkShield.glb", type: "weapon", format: "glb", defaultScale: 0.01, defaultHeight: 0, category: "shield", combatClass: "melee", description: "Shield of dark magic" },
];

// IMPORTANT: this list is intentionally Mixamo-only. Earlier revisions
// shipped a much larger registry (sword_shield, magic, longbow,
// action_adventure, racalvin_*, rifle_locomotion, ual1_standard,
// ual2_standard, mining) but every one of those packs was authored
// against a different rest pose / bone hierarchy than the player's
// Mixamo skeleton. Even with the per-clip rest-pose retargeting we do in
// `useCharacterModel.loadPackClips`, the cross-rig delta math left the
// player's silhouette visibly distorted (resized limbs, shifted joints,
// "wrong-shaped" T-pose when the F8 admin override was toggled on).
// The four packs below all ship from Mixamo's standard skeleton, so
// they retarget cleanly onto our characters.
//
// To re-add a pack here:
//   1. Confirm it was authored on Mixamo's bind pose (or rebake it onto
//      that rig in Blender / Maya).
//   2. Add the entry below.
//   3. Wire the pack id into `WEAPON_TO_PACKS` in useCharacterModel.ts
//      and/or `WEAPON_ANIM_MAPPING` below.
export const ANIMATION_PACKS: AnimationPackEntry[] = [
  {
    id: "glocomotion",
    name: "GLocomotion (Mixamo Locomotion)",
    basePath: "/models/animations/glocomotion",
    combatStyle: "universal",
    animations: [
      { name: "idle", file: "idle.glb" },
      { name: "idle_fidget", file: "idle_fidget.glb" },
      { name: "idle_look", file: "idle_look.glb" },
      { name: "idle_stretch", file: "idle_stretch.glb" },
      { name: "walk", file: "walk.glb" },
      { name: "walk_uphill_tired", file: "walk_uphill_tired.glb" },
      { name: "wall_run", file: "wall_run.glb" },
      { name: "climb_start", file: "climb_start.glb" },
      { name: "climb", file: "climb.glb" },
      { name: "climb_down", file: "climb_down.glb" },
      { name: "climb_idle", file: "climb_idle.glb" },
      { name: "climb_topout", file: "climb_topout.glb" },
      { name: "climb_shimmy", file: "climb_shimmy.glb" },
      { name: "ledge_grab", file: "ledge_grab.glb" },
      { name: "run", file: "run.glb" },
      { name: "sprint", file: "sprint.glb" },
      { name: "run_stop", file: "run_stop.glb" },
      { name: "jump", file: "jump.glb" },
      { name: "fall", file: "fall.glb" },
      // Floating: relaxed mid-air pose. Used by the player as the safe-fall
      // blend (drops shorter than the fall-damage threshold) and as the
      // double-jump apex hang-time pose.
      { name: "floating", file: "floating.glb" },
      // Directional shuffles — short, low-commit standing dodges fired by
      // double-tapping a movement key while *not* sprinting. All four
      // cardinal directions are authored.
      { name: "shuffle_forward", file: "shuffle_forward.glb" },
      { name: "shuffle_back", file: "shuffle_back.glb" },
      { name: "shuffle_left", file: "shuffle_left.glb" },
      { name: "shuffle_right", file: "shuffle_right.glb" },
      // Stat-driven dodge proc — plays when the dodge/evasion roll in
      // useSurvival.takeDamage avoids an incoming hit.
      { name: "dodge_proc", file: "dodge_proc.glb" },
      { name: "land", file: "land.glb" },
      { name: "roll", file: "roll.glb" },
      { name: "crouch_start", file: "crouch_start.glb" },
      { name: "crouch_end", file: "crouch_end.glb" },
      { name: "sneak_forward", file: "sneak_forward.glb" },
      { name: "sneak_left", file: "sneak_left.glb" },
      { name: "sneak_right", file: "sneak_right.glb" },
      { name: "turn_left", file: "turn_left.glb" },
      { name: "turn_right", file: "turn_right.glb" },
      // 90° committed pivots — paired with the looping turn_left/turn_right.
      // Use these for NPC AI doing big standing-still facing changes.
      { name: "turn_left_90", file: "turn_left_90.glb" },
      { name: "turn_right_90", file: "turn_right_90.glb" },
      // In-place strafes (loops) — body keeps facing forward while sliding
      // sideways. Used for camera-relative movement when facing is decoupled
      // from velocity (e.g. lock-on combat camera).
      { name: "strafe_left", file: "strafe_left.glb" },
      { name: "strafe_right", file: "strafe_right.glb" },
      // Strafe-walk (loops) — advance forward while side-stepping. Useful
      // for the diagonal-input case where the body should still face fwd.
      { name: "strafe_walk_left", file: "strafe_walk_left.glb" },
      { name: "strafe_walk_right", file: "strafe_walk_right.glb" },
      // Climb-domain extras to complement the existing climb_* loops.
      { name: "ascending_stairs", file: "ascending_stairs.glb" },
      { name: "climb_ladder_start", file: "climb_ladder_start.glb" },
      { name: "sprint_to_wall_climb", file: "sprint_to_wall_climb.glb" },
      { name: "double_jump_to_climb", file: "double_jump_to_climb.glb" },
      // Swim trio — first time the player rig has swim clips on its
      // primary pack (previously only the combat pack carried them).
      { name: "swim", file: "swim.glb" },
      { name: "tread_water", file: "tread_water.glb" },
      { name: "swim_to_edge", file: "swim_to_edge.glb" },
      { name: "attack", file: "attack.glb" },
      { name: "hit", file: "hit.glb" },
      { name: "death", file: "death.glb" },
    ],
  },
  {
    id: "glocomotion_combat",
    name: "GLocomotion Combat (Mixamo Combat & Misc)",
    basePath: "/models/animations/glocomotion_combat",
    combatStyle: "universal",
    animations: [
      { name: "martelo_2", file: "martelo_2.glb" },
      { name: "medium_hit_to_head", file: "medium_hit_to_head.glb" },
      { name: "mma_kick", file: "mma_kick.glb" },
      { name: "pick_up_item", file: "pick_up_item.glb" },
      { name: "punching", file: "punching.glb" },
      { name: "punching_bag", file: "punching_bag.glb" },
      { name: "rallying", file: "rallying.glb" },
      { name: "right_hook", file: "right_hook.glb" },
      { name: "run_to_dive", file: "run_to_dive.glb" },
      { name: "skateboarding", file: "skateboarding.glb" },
      { name: "straightpunching", file: "straightpunching.glb" },
      { name: "stunned", file: "stunned.glb" },
      { name: "sweep_fall", file: "sweep_fall.glb" },
      { name: "swimming", file: "swimming.glb" },
      { name: "swimming_to_edge", file: "swimming_to_edge.glb" },
      { name: "treading_water", file: "treading_water.glb" },
      { name: "uppercut", file: "uppercut.glb" },
      { name: "victory", file: "victory.glb" },
    ],
  },
  {
    id: "farming",
    name: "Farming (Mixamo Farming Pack)",
    basePath: "/models/animations/farming",
    combatStyle: "universal",
    // Domain-specific clip set covering villager / NPC farmer behaviours and
    // matching player actions when wielding a tool. Loaded on demand via the
    // `extraPacks` option on useCharacterController/useCharacterModel — NOT
    // attached to any WEAPON_TO_PACKS entry, so unrelated characters (warriors,
    // mages, etc.) never pay the load cost.
    animations: [
      { name: "box_idle", file: "box_idle.glb" },
      { name: "box_walk_arc", file: "box_walk_arc.glb" },
      { name: "box_turn_left", file: "box_turn_left.glb" },
      { name: "box_turn_right", file: "box_turn_right.glb" },
      { name: "kneeling_idle", file: "kneeling_idle.glb" },
      { name: "dig_and_plant_seeds", file: "dig_and_plant_seeds.glb" },
      { name: "pull_plant", file: "pull_plant.glb" },
      { name: "pull_plant_2", file: "pull_plant_2.glb" },
      { name: "plant_tree", file: "plant_tree.glb" },
      { name: "plant_a_plant", file: "plant_a_plant.glb" },
      { name: "holding_idle", file: "holding_idle.glb" },
      { name: "holding_walk", file: "holding_walk.glb" },
      { name: "holding_turn_left", file: "holding_turn_left.glb" },
      { name: "holding_turn_right", file: "holding_turn_right.glb" },
      { name: "watering", file: "watering.glb" },
      { name: "pick_fruit", file: "pick_fruit.glb" },
      { name: "pick_fruit_2", file: "pick_fruit_2.glb" },
      { name: "pick_fruit_3", file: "pick_fruit_3.glb" },
      { name: "cow_milking", file: "cow_milking.glb" },
      { name: "wheelbarrow_idle", file: "wheelbarrow_idle.glb" },
      { name: "wheelbarrow_walk", file: "wheelbarrow_walk.glb" },
      { name: "wheelbarrow_walk_back", file: "wheelbarrow_walk_back.glb" },
      { name: "wheelbarrow_walk_turn_left", file: "wheelbarrow_walk_turn_left.glb" },
      { name: "wheelbarrow_walk_turn_right", file: "wheelbarrow_walk_turn_right.glb" },
      { name: "wheelbarrow_dump", file: "wheelbarrow_dump.glb" },
    ],
  },
  {
    id: "gestures_basic",
    name: "Gestures (Mixamo Basic Gestures Pack)",
    basePath: "/models/animations/gestures_basic",
    combatStyle: "universal",
    // 15-clip emote / gesture set. Loaded on demand via the `extraPacks`
    // option so only characters that surface gestures (the player, key
    // companion NPCs) pay the load cost. The player binds 15 of these to
    // numpad keys for manual emoting; a subset (the head-nod / head-shake
    // family + weight_shift) is also folded into the alt-idle fidget pool
    // so they read as ambient body language during long idles.
    animations: [
      { name: "acknowledging", file: "acknowledging.glb" },
      { name: "angry_gesture", file: "angry_gesture.glb" },
      { name: "annoyed_head_shake", file: "annoyed_head_shake.glb" },
      { name: "being_cocky", file: "being_cocky.glb" },
      { name: "dismissing_gesture", file: "dismissing_gesture.glb" },
      { name: "happy_hand_gesture", file: "happy_hand_gesture.glb" },
      { name: "hard_head_nod", file: "hard_head_nod.glb" },
      { name: "head_nod_yes", file: "head_nod_yes.glb" },
      { name: "lengthy_head_nod", file: "lengthy_head_nod.glb" },
      { name: "look_away_gesture", file: "look_away_gesture.glb" },
      { name: "relieved_sigh", file: "relieved_sigh.glb" },
      { name: "sarcastic_head_nod", file: "sarcastic_head_nod.glb" },
      { name: "shaking_head_no", file: "shaking_head_no.glb" },
      { name: "thoughtful_head_shake", file: "thoughtful_head_shake.glb" },
      { name: "weight_shift", file: "weight_shift.glb" },
      // Quick formal bow — short courteous bow. Pulled into the player's
      // alt-idle fidget pool ("blending non-damage collision" / idle
      // assistant role); also playable manually by NPCs that need it.
      { name: "quick_formal_bow", file: "quick_formal_bow.glb" },
    ],
  },
];

// All weapon types currently fall back on the Mixamo glocomotion +
// glocomotion_combat packs. The earlier per-weapon recommendations
// (sword_shield, racalvin_*, ual1/ual2, longbow, rifle_locomotion,
// magic, action_adventure) were removed because their non-Mixamo rest
// poses distorted the player's silhouette during retargeting. When new
// weapon-specific Mixamo packs land, list them here in priority order.
export const WEAPON_ANIM_MAPPING: WeaponAnimMapping[] = [
  { weaponType: "sword", recommendedPacks: ["glocomotion_combat", "glocomotion"], description: "1H sword falls back on Mixamo locomotion + combat" },
  { weaponType: "greatsword", recommendedPacks: ["glocomotion_combat", "glocomotion"], description: "2H greatsword falls back on Mixamo locomotion + combat" },
  { weaponType: "axe", recommendedPacks: ["glocomotion_combat", "glocomotion"], description: "1H axe falls back on Mixamo locomotion + combat" },
  { weaponType: "poleaxe", recommendedPacks: ["glocomotion_combat", "glocomotion"], description: "Poleaxe falls back on Mixamo locomotion + combat" },
  { weaponType: "hammer", recommendedPacks: ["glocomotion_combat", "glocomotion"], description: "Hammer falls back on Mixamo locomotion + combat" },
  { weaponType: "dagger", recommendedPacks: ["glocomotion_combat", "glocomotion"], description: "Dagger falls back on Mixamo locomotion + combat" },
  { weaponType: "staff", recommendedPacks: ["glocomotion"], description: "Staff falls back on Mixamo locomotion (no Mixamo magic pack yet)" },
  { weaponType: "wand", recommendedPacks: ["glocomotion"], description: "Wand falls back on Mixamo locomotion (no Mixamo magic pack yet)" },
  { weaponType: "bow", recommendedPacks: ["glocomotion"], description: "Bow falls back on Mixamo locomotion (no Mixamo bow pack yet)" },
  { weaponType: "crossbow", recommendedPacks: ["glocomotion"], description: "Crossbow falls back on Mixamo locomotion (no Mixamo crossbow pack yet)" },
  { weaponType: "gun", recommendedPacks: ["glocomotion"], description: "Gun falls back on Mixamo locomotion (no Mixamo rifle pack yet)" },
  { weaponType: "shield", recommendedPacks: ["glocomotion_combat", "glocomotion"], description: "Shield falls back on Mixamo locomotion + combat" },
  { weaponType: "fists", recommendedPacks: ["glocomotion_combat", "glocomotion"], description: "Unarmed uses Mixamo combat strikes + locomotion" },
];

function generateWeaponModels(prefix: string, dir: string, indices: number[], category: WeaponCategory, weaponType: WeaponType, namePrefix: string): WeaponModelEntry[] {
  return indices.map(i => ({
    id: `${prefix}_${i}`,
    name: `${namePrefix} ${i}`,
    path: `/models/weapons/${dir}/${prefix}_${i}.glb`,
    format: "glb" as ModelFormat,
    category,
    weaponType,
    defaultScale: 0.01,
  }));
}

const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const SWORD_INDICES = [...range(1, 13), ...range(15, 24)];
const AXE_INDICES = range(1, 24);
const POLEAXE_INDICES = range(1, 24);
const HAMMER_INDICES = range(1, 24);
const DAGGER_INDICES = range(1, 24);
const BOW_INDICES = range(1, 24);
const CROSSBOW_INDICES = range(1, 24);
const SHIELD_INDICES = range(1, 20);
const STAFF_INDICES = range(1, 24);
const CANE_INDICES = range(1, 24);
const ARROW_INDICES = range(1, 24);

export const QUATERNIUS_WEAPONS: WeaponModelEntry[] = [
  { id: "q_sword", name: "Quaternius Sword", path: "/models/weapons_quaternius/Sword.glb", format: "glb", category: "blade", weaponType: "sword", defaultScale: 0.01 },
  { id: "q_sword_2", name: "Quaternius Sword 2", path: "/models/weapons_quaternius/Sword_2.glb", format: "glb", category: "blade", weaponType: "sword", defaultScale: 0.01 },
  { id: "q_sword_big", name: "Quaternius Greatsword", path: "/models/weapons_quaternius/Sword_Big.glb", format: "glb", category: "blade", weaponType: "greatsword", defaultScale: 0.01 },
  { id: "q_sword_golden", name: "Golden Sword", path: "/models/weapons_quaternius/Sword_Golden.glb", format: "glb", category: "blade", weaponType: "sword", defaultScale: 0.01 },
  { id: "q_claymore", name: "Claymore", path: "/models/weapons_quaternius/Claymore.glb", format: "glb", category: "blade", weaponType: "greatsword", defaultScale: 0.01 },
  { id: "q_axe", name: "Quaternius Axe", path: "/models/weapons_quaternius/Axe.glb", format: "glb", category: "blade", weaponType: "axe", defaultScale: 0.01 },
  { id: "q_axe_double", name: "Double Axe", path: "/models/weapons_quaternius/Axe_Double.glb", format: "glb", category: "blade", weaponType: "axe", defaultScale: 0.01 },
  { id: "q_axe_small", name: "Small Axe", path: "/models/weapons_quaternius/Axe_Small.glb", format: "glb", category: "blade", weaponType: "axe", defaultScale: 0.01 },
  { id: "q_bow_wooden", name: "Wooden Bow", path: "/models/weapons_quaternius/Bow_Wooden.glb", format: "glb", category: "ranged", weaponType: "bow", defaultScale: 0.01 },
  { id: "q_bow_wooden2", name: "Wooden Bow 2", path: "/models/weapons_quaternius/Bow_Wooden2.glb", format: "glb", category: "ranged", weaponType: "bow", defaultScale: 0.01 },
  { id: "q_bow_evil", name: "Evil Bow", path: "/models/weapons_quaternius/Bow_Evil.glb", format: "glb", category: "ranged", weaponType: "bow", defaultScale: 0.01 },
  { id: "q_bow_golden", name: "Golden Bow", path: "/models/weapons_quaternius/Bow_Golden.glb", format: "glb", category: "ranged", weaponType: "bow", defaultScale: 0.01 },
  { id: "q_shield_round", name: "Round Shield", path: "/models/weapons_quaternius/Shield_Round.glb", format: "glb", category: "shield", weaponType: "shield", defaultScale: 0.01 },
  { id: "q_shield_round_2", name: "Round Shield 2", path: "/models/weapons_quaternius/Shield_Round_2.glb", format: "glb", category: "shield", weaponType: "shield", defaultScale: 0.01 },
  { id: "q_shield_heater", name: "Heater Shield", path: "/models/weapons_quaternius/Shield_Heater.glb", format: "glb", category: "shield", weaponType: "shield", defaultScale: 0.01 },
  { id: "q_shield_heater_2", name: "Heater Shield 2", path: "/models/weapons_quaternius/Shield_Heater_2.glb", format: "glb", category: "shield", weaponType: "shield", defaultScale: 0.01 },
  { id: "q_shield_celtic", name: "Celtic Golden Shield", path: "/models/weapons_quaternius/Shield_Celtic_Golden.glb", format: "glb", category: "shield", weaponType: "shield", defaultScale: 0.01 },
  { id: "q_hammer_small", name: "Small Hammer", path: "/models/weapons_quaternius/Hammer_Small.glb", format: "glb", category: "blunt", weaponType: "hammer", defaultScale: 0.01 },
  { id: "q_hammer_double", name: "Double Hammer", path: "/models/weapons_quaternius/Hammer_Double.glb", format: "glb", category: "blunt", weaponType: "hammer", defaultScale: 0.01 },
  { id: "q_dagger", name: "Quaternius Dagger", path: "/models/weapons_quaternius/Dagger.glb", format: "glb", category: "blade", weaponType: "dagger", defaultScale: 0.01 },
  { id: "q_dagger_2", name: "Quaternius Dagger 2", path: "/models/weapons_quaternius/Dagger_2.glb", format: "glb", category: "blade", weaponType: "dagger", defaultScale: 0.01 },
  { id: "q_spear", name: "Spear", path: "/models/weapons_quaternius/Spear.glb", format: "glb", category: "polearm", weaponType: "poleaxe", defaultScale: 0.01 },
  { id: "q_scythe", name: "Scythe", path: "/models/weapons_quaternius/Scythe.glb", format: "glb", category: "polearm", weaponType: "poleaxe", defaultScale: 0.01 },
  { id: "q_arrow", name: "Arrow", path: "/models/weapons_quaternius/Arrow.glb", format: "glb", category: "ranged", weaponType: "bow", defaultScale: 0.01 },
];

export const CRAFTPIX_WEAPONS: WeaponModelEntry[] = [
  ...generateWeaponModels("sword", "swords", SWORD_INDICES, "blade", "sword", "Sword"),
  ...generateWeaponModels("axe", "axes", AXE_INDICES, "blade", "axe", "Axe"),
  ...generateWeaponModels("poleaxe", "poleaxes", POLEAXE_INDICES, "polearm", "poleaxe", "Poleaxe"),
  ...generateWeaponModels("hammer", "hammers", HAMMER_INDICES, "blunt", "hammer", "Hammer"),
  ...generateWeaponModels("dagger", "daggers", DAGGER_INDICES, "blade", "dagger", "Dagger"),
  ...generateWeaponModels("bow", "bows", BOW_INDICES, "ranged", "bow", "Bow"),
  ...generateWeaponModels("crossbow", "crossbows", CROSSBOW_INDICES, "ranged", "crossbow", "Crossbow"),
  ...generateWeaponModels("shield", "shields", SHIELD_INDICES, "shield", "shield", "Shield"),
  ...generateWeaponModels("staff", "staffs", STAFF_INDICES, "magic", "staff", "Staff"),
  ...generateWeaponModels("cane", "canes", CANE_INDICES, "magic", "wand", "Cane"),
  ...generateWeaponModels("arrow", "arrows", ARROW_INDICES, "ranged", "bow", "Arrow"),
];

export const WEAPON_TEXTURES: Record<string, string> = {
  sword: "/textures/weapons/sword_atlas.png",
  axe: "/textures/weapons/axe_atlas.png",
  poleaxe: "/textures/weapons/poleaxe_atlas.png",
  hammer: "/textures/weapons/hammer_atlas.png",
  dagger: "/textures/weapons/dagger_atlas.png",
  bow: "/textures/weapons/bow_atlas.png",
  shield: "/textures/weapons/shield_atlas.png",
  staff: "/textures/weapons/staff_atlas.png",
  cane: "/textures/weapons/cane_atlas.png",
};

export function getModelsByType(type: ModelType): ModelEntry[] {
  if (type === "character") return ALL_CHARACTER_MODELS;
  if (type === "weapon") return ALL_WEAPON_MODELS;
  return [];
}

export function getModelById(id: string): ModelEntry | undefined {
  return ALL_CHARACTER_MODELS.find(m => m.id === id)
    || ALL_WEAPON_MODELS.find(m => m.id === id);
}

export function getFactionForModelPath(modelPath: string | undefined | null): Faction {
  if (!modelPath) return "crusade";
  const entry = ALL_CHARACTER_MODELS.find(m => m.path === modelPath);
  return entry?.faction ?? "crusade";
}

export const OFFHAND_MODELS: WeaponModelEntry[] = [
  { id: "offhand_tome", name: "Tome", path: "/models/weapons/offhand/Tome.glb", format: "glb", category: "magic", weaponType: "staff", defaultScale: 0.01 },
  { id: "offhand_book", name: "Spellbook", path: "/models/weapons/offhand/Book.glb", format: "glb", category: "magic", weaponType: "staff", defaultScale: 0.01 },
  { id: "offhand_skull", name: "Skull", path: "/models/weapons/offhand/Skull.glb", format: "glb", category: "magic", weaponType: "wand", defaultScale: 0.01 },
  { id: "offhand_nature_shield", name: "Nature Shield", path: "/models/weapons/offhand/NatureShield.glb", format: "glb", category: "shield", weaponType: "shield", defaultScale: 0.01 },
  { id: "offhand_dark_shield", name: "Dark Shield", path: "/models/weapons/offhand/DarkShield.glb", format: "glb", category: "shield", weaponType: "shield", defaultScale: 0.01 },
];

export interface SpellModelEntry {
  id: string;
  name: string;
  path: string;
  format: ModelFormat;
  defaultScale: number;
  spellType: "projectile" | "aoe" | "buff" | "summon";
  element: "fire" | "ice" | "nature" | "dark" | "arcane" | "earth";
}

export const SPELL_MODELS: SpellModelEntry[] = [
  { id: "spell_fireball", name: "Fireball", path: "/models/spells/Fireball.glb", format: "glb", defaultScale: 0.5, spellType: "projectile", element: "fire" },
  { id: "spell_ice_lance", name: "Ice Lance", path: "/models/spells/IceLance.glb", format: "glb", defaultScale: 0.5, spellType: "projectile", element: "ice" },
  { id: "spell_distortion", name: "Distortion", path: "/models/spells/Distortion.glb", format: "glb", defaultScale: 0.8, spellType: "aoe", element: "arcane" },
  { id: "spell_root", name: "Root", path: "/models/spells/Root.glb", format: "glb", defaultScale: 0.6, spellType: "aoe", element: "nature" },
  { id: "spell_rock", name: "Rock", path: "/models/spells/Rock.glb", format: "glb", defaultScale: 0.4, spellType: "projectile", element: "earth" },
];

const S = "/models/dungeon_kaykit/3dspritesa";
const RC = "/models/dungeon_kaykit/reward chest";

export const ITEM_MODELS: Record<string, { path: string; defaultScale: number }> = {
  // Legacy
  potion:              { path: "/models/items/Potion.glb",          defaultScale: 0.3 },
  // KayKit 3D sprites — loot drops
  coin:                { path: `${S}/coin.glb`,                    defaultScale: 0.4 },
  coins_medium:        { path: `${S}/coinsMedium.glb`,             defaultScale: 0.35 },
  coins_small:         { path: `${S}/coinsSmall.glb`,              defaultScale: 0.35 },
  artifact:            { path: `${S}/artifact.glb`,                defaultScale: 0.35 },
  spell_book:          { path: `${S}/spellBook.glb`,               defaultScale: 0.3 },
  book_a:              { path: `${S}/bookA.glb`,                   defaultScale: 0.3 },
  book_b:              { path: `${S}/bookB.glb`,                   defaultScale: 0.3 },
  loot_sack_a:         { path: `${S}/lootSackA.glb`,               defaultScale: 0.35 },
  loot_sack_b:         { path: `${S}/lootSackB.glb`,               defaultScale: 0.35 },
  weapon_rack:         { path: `${S}/weaponRack.glb`,              defaultScale: 0.3 },
  // KayKit potions (6 variants)
  potion_large_red:    { path: `${S}/potionLarge_red.glb`,         defaultScale: 0.35 },
  potion_large_blue:   { path: `${S}/potionLarge_blue.glb`,        defaultScale: 0.35 },
  potion_large_green:  { path: `${S}/potionLarge_green.glb`,       defaultScale: 0.35 },
  potion_small_red:    { path: `${S}/potionSmall_red.glb`,         defaultScale: 0.35 },
  potion_small_blue:   { path: `${S}/potionSmall_blue.glb`,        defaultScale: 0.35 },
  potion_small_green:  { path: `${S}/potionSmall_green.glb`,       defaultScale: 0.35 },
};

/** Reward chest models by tier, with separate lid pieces for open state. */
export const REWARD_CHEST_MODELS = {
  common:    { body: `${RC}/chest_common.glb`,    top: `${RC}/chestTop_common.glb`, scale: 0.5 },
  uncommon:  { body: `${RC}/chest_uncommon.glb`,  top: `${RC}/chestTop_common.glb`, scale: 0.5 },
  rare:      { body: `${RC}/chest_rare.glb`,      top: `${RC}/chestTop_rare.glb`,   scale: 0.5 },
  mimic:     { body: `${RC}/chest_rare_mimic.glb`, top: `${RC}/chestTop_rare.glb`,  scale: 0.5 },
} as const;

export type RewardChestTier = keyof typeof REWARD_CHEST_MODELS;

/** Map loot drop type → best ITEM_MODELS key for the 3D sprite. */
export function getLootModelKey(type: string, itemId: string): string {
  // Potions → KayKit potion models by color
  if (type === "potion") {
    if (itemId.includes("mana")) return "potion_large_blue";
    if (itemId.includes("stamina") || itemId.includes("speed")) return "potion_large_green";
    return "potion_large_red";
  }
  // Gold → coin pile size by quantity context
  if (type === "gold") return "coins_medium";
  // Materials → varies
  if (type === "material") {
    if (itemId.includes("gem") || itemId.includes("crystal") || itemId.includes("shard")) return "artifact";
    if (itemId.includes("bone")) return "loot_sack_a";
    return "loot_sack_b";
  }
  // Equipment → weapon rack or spell book
  if (type === "equipment") {
    if (itemId.includes("scroll")) return "spell_book";
    return "weapon_rack";
  }
  // Food → loot sack
  if (type === "food") return "loot_sack_a";
  // Default
  return "coin";
}

export const KAYKIT_WEAPONS: WeaponModelEntry[] = [
  { id: "kk_sword_a", name: "KayKit Sword A", path: "/models/kaykit_weapons/sword_A.glb", format: "glb", category: "blade", weaponType: "sword", defaultScale: 1.0, skipTextureAtlas: true },
  { id: "kk_sword_b", name: "KayKit Sword B", path: "/models/kaykit_weapons/sword_B.glb", format: "glb", category: "blade", weaponType: "sword", defaultScale: 1.0, skipTextureAtlas: true },
  { id: "kk_sword_c", name: "KayKit Sword C", path: "/models/kaykit_weapons/sword_C.glb", format: "glb", category: "blade", weaponType: "sword", defaultScale: 1.0, skipTextureAtlas: true },
  { id: "kk_sword_d", name: "KayKit Sword D", path: "/models/kaykit_weapons/sword_D.glb", format: "glb", category: "blade", weaponType: "greatsword", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.20, 0] },
  { id: "kk_sword_e", name: "KayKit Sword E", path: "/models/kaykit_weapons/sword_E.glb", format: "glb", category: "blade", weaponType: "greatsword", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.20, 0] },
  { id: "kk_axe_b",   name: "KayKit Axe B",   path: "/models/kaykit_weapons/axe_B.glb",   format: "glb", category: "blade", weaponType: "axe",    defaultScale: 1.0, skipTextureAtlas: true },
  { id: "kk_axe_c",   name: "KayKit Axe C",   path: "/models/kaykit_weapons/axe_C.glb",   format: "glb", category: "blade", weaponType: "axe",    defaultScale: 1.0, skipTextureAtlas: true },
  { id: "kk_hammer_a",name: "KayKit Hammer A",path: "/models/kaykit_weapons/hammer_A.glb",format: "glb", category: "blunt", weaponType: "hammer", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.15, 0] },
  { id: "kk_hammer_b",name: "KayKit Hammer B",path: "/models/kaykit_weapons/hammer_B.glb",format: "glb", category: "blunt", weaponType: "hammer", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.15, 0] },
  { id: "kk_hammer_c",name: "KayKit Hammer C",path: "/models/kaykit_weapons/hammer_C.glb",format: "glb", category: "blunt", weaponType: "hammer", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.15, 0] },
  { id: "kk_dagger_a",name: "KayKit Dagger A",path: "/models/kaykit_weapons/dagger_A.glb",format: "glb", category: "blade", weaponType: "dagger", defaultScale: 1.0, skipTextureAtlas: true },
  { id: "kk_dagger_b",name: "KayKit Dagger B",path: "/models/kaykit_weapons/dagger_B.glb",format: "glb", category: "blade", weaponType: "dagger", defaultScale: 1.0, skipTextureAtlas: true },
  { id: "kk_bow_a",   name: "KayKit Bow A (no string)", path: "/models/kaykit_weapons/bow_A.glb",            format: "glb", category: "ranged", weaponType: "bow", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, 0, -0.30] },
  { id: "kk_bow_a_s", name: "KayKit Bow A",   path: "/models/kaykit_weapons/bow_A_withString.glb",          format: "glb", category: "ranged", weaponType: "bow", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, 0, -0.30] },
  { id: "kk_bow_b",   name: "KayKit Bow B (no string)", path: "/models/kaykit_weapons/bow_B.glb",            format: "glb", category: "ranged", weaponType: "bow", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, 0, -0.30] },
  { id: "kk_bow_b_s", name: "KayKit Bow B",   path: "/models/kaykit_weapons/bow_B_withString.glb",          format: "glb", category: "ranged", weaponType: "bow", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, 0, -0.30] },
  { id: "kk_spear",   name: "KayKit Spear",   path: "/models/kaykit_weapons/spear_A.glb",                   format: "glb", category: "polearm", weaponType: "poleaxe", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.45, 0] },
  { id: "kk_staff_a", name: "KayKit Staff A", path: "/models/kaykit_weapons/staff_A.glb", format: "glb", category: "magic",  weaponType: "staff", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.55, 0] },
  { id: "kk_staff_b", name: "KayKit Staff B", path: "/models/kaykit_weapons/staff_B.glb", format: "glb", category: "magic",  weaponType: "staff", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.55, 0] },
  { id: "kk_wand",    name: "KayKit Wand",    path: "/models/kaykit_weapons/wand_A.glb",  format: "glb", category: "magic",  weaponType: "wand",  defaultScale: 1.0, skipTextureAtlas: true },
  { id: "kk_shield_a",name: "KayKit Shield A",path: "/models/kaykit_weapons/shield_A.glb",format: "glb", category: "shield", weaponType: "shield",defaultScale: 1.0, skipTextureAtlas: true },
  { id: "kk_shield_b",name: "KayKit Shield B",path: "/models/kaykit_weapons/shield_B.glb",format: "glb", category: "shield", weaponType: "shield",defaultScale: 1.0, skipTextureAtlas: true },
  { id: "kk_shield_c",name: "KayKit Shield C",path: "/models/kaykit_weapons/shield_C.glb",format: "glb", category: "shield", weaponType: "shield",defaultScale: 1.0, skipTextureAtlas: true },
];

export const WEAPON_PACK_WEAPONS: WeaponModelEntry[] = [
  { id: "wp_arming_sword",  name: "Arming Sword",   path: "/models/weapon_pack/Arming_Sword.glb",  format: "glb", category: "blade",   weaponType: "sword",      defaultScale: 1.0, skipTextureAtlas: true },
  { id: "wp_great_sword",   name: "Great Sword",    path: "/models/weapon_pack/Great_Sword.glb",   format: "glb", category: "blade",   weaponType: "greatsword", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.22, 0] },
  { id: "wp_offset_sword",  name: "Offset Sword",   path: "/models/weapon_pack/Offset_Sword.glb",  format: "glb", category: "blade",   weaponType: "sword",      defaultScale: 1.0, skipTextureAtlas: true },
  { id: "wp_orc_sword",     name: "Orc Sword",      path: "/models/weapon_pack/Orc_Sword.glb",     format: "glb", category: "blade",   weaponType: "sword",      defaultScale: 1.0, skipTextureAtlas: true },
  { id: "wp_bearded_axe",   name: "Bearded Axe",    path: "/models/weapon_pack/Bearded_Axe.glb",   format: "glb", category: "blade",   weaponType: "axe",        defaultScale: 1.0, skipTextureAtlas: true },
  { id: "wp_double_axe",    name: "Double Axe",     path: "/models/weapon_pack/Double_Axe.glb",    format: "glb", category: "blade",   weaponType: "axe",        defaultScale: 1.0, skipTextureAtlas: true },
  { id: "wp_anvil_hammer",  name: "Anvil Hammer",   path: "/models/weapon_pack/Anvil_Hammer.glb",  format: "glb", category: "blunt",   weaponType: "hammer",     defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.18, 0] },
  { id: "wp_double_hammer", name: "Double Hammer",  path: "/models/weapon_pack/Double_Hammer.glb", format: "glb", category: "blunt",   weaponType: "hammer",     defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.18, 0] },
  { id: "wp_war_hammer",    name: "War Hammer",     path: "/models/weapon_pack/War_Hammer.glb",    format: "glb", category: "blunt",   weaponType: "hammer",     defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.18, 0] },
  { id: "wp_dagger",        name: "Dagger",         path: "/models/weapon_pack/Dagger.glb",        format: "glb", category: "blade",   weaponType: "dagger",     defaultScale: 1.0, skipTextureAtlas: true },
  { id: "wp_spear",         name: "Spear",          path: "/models/weapon_pack/Spear.glb",         format: "glb", category: "polearm", weaponType: "poleaxe",    defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.45, 0] },
  { id: "wp_flared_spear",  name: "Flared Spear",   path: "/models/weapon_pack/Flared_Spear.glb",  format: "glb", category: "polearm", weaponType: "poleaxe",    defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.45, 0] },
  { id: "wp_bow",           name: "Hunter's Bow",   path: "/models/weapon_pack/Bow.glb",           format: "glb", category: "ranged",  weaponType: "bow",        defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, 0, -0.30] },
  { id: "wp_crossbow",      name: "Crossbow",       path: "/models/weapon_pack/Crossbow.glb",      format: "glb", category: "ranged",  weaponType: "crossbow",   defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, 0, 0.18] },
  { id: "wp_wizard_staff",  name: "Wizard Staff",   path: "/models/weapon_pack/Wizard_Staff.glb",  format: "glb", category: "magic",   weaponType: "staff",      defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.55, 0] },
  // --- Medieval pack weapons (extracted from attached_assets/mEDİAVEL_pACK_*.fbx).
  // See script/asset_tools/MEDIEVAL_PACK_IMPORT.md for the import decision trail
  // (which meshes were kept as wieldable weapons, which siege props were skipped,
  // and why arrow + quiver are registered only in NewAssetRegistry, not here).
  // The other extra upload, attached_assets/player_vektor_*.fbx, was intentionally
  // discarded per the user — see the same doc for that decision.
  //
  // Grip & off-hand offsets follow the standard +Y-up weapon convention used by
  // KayKit and the rest of WEAPON_PACK_WEAPONS — the extract script
  // (extract_medieval_pack.mjs) pre-rotates the half-dozen Z-long meshes during
  // the FBX→GLB step so the per-type defaults in OFF_HAND_GRIP_LOCAL line up
  // (handle at -Y, blade/head/string at +Y).
  { id: "wp_med_sword",        name: "Medieval Sword",      path: "/models/weapon_pack/Medieval_Sword.glb",     format: "glb", category: "blade",   weaponType: "sword",      defaultScale: 1.0, skipTextureAtlas: true },
  { id: "wp_med_one_axe",      name: "One-Side Axe",        path: "/models/weapon_pack/One_Side_Axe.glb",       format: "glb", category: "blade",   weaponType: "axe",        defaultScale: 1.0, skipTextureAtlas: true },
  // Double-Side Axe is visually 2H but registered as `axe` to match wp_double_axe.
  // The off-hand grip is pre-set so it lines up the moment the system promotes
  // any "axe" with this id to a two-handed grip.
  { id: "wp_med_two_axe",      name: "Double-Side Axe",     path: "/models/weapon_pack/Double_Side_Axe.glb",    format: "glb", category: "blade",   weaponType: "axe",        defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.20, 0] },
  { id: "wp_med_slam_hammer",  name: "Slam Hammer",         path: "/models/weapon_pack/Slam_Hammer.glb",        format: "glb", category: "blunt",   weaponType: "hammer",     defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.18, 0] },
  { id: "wp_med_spiked_mace",  name: "Spiked Mace",         path: "/models/weapon_pack/Spiked_Mace.glb",        format: "glb", category: "blunt",   weaponType: "hammer",     defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.18, 0] },
  { id: "wp_med_mace",         name: "Medieval Mace",       path: "/models/weapon_pack/Medieval_Mace.glb",      format: "glb", category: "blunt",   weaponType: "hammer",     defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.18, 0] },
  { id: "wp_med_spear",        name: "Medieval Spear",      path: "/models/weapon_pack/Medieval_Spear.glb",     format: "glb", category: "polearm", weaponType: "poleaxe",    defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.45, 0] },
  { id: "wp_med_spear_knife",  name: "Spear With Knife",    path: "/models/weapon_pack/Spear_With_Knife.glb",   format: "glb", category: "polearm", weaponType: "poleaxe",    defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.45, 0] },
  { id: "wp_med_dagger_a",     name: "Medieval Dagger A",   path: "/models/weapon_pack/Medieval_Dagger_A.glb",  format: "glb", category: "blade",   weaponType: "dagger",     defaultScale: 1.0, skipTextureAtlas: true },
  { id: "wp_med_dagger_b",     name: "Medieval Dagger B",   path: "/models/weapon_pack/Medieval_Dagger_B.glb",  format: "glb", category: "blade",   weaponType: "dagger",     defaultScale: 1.0, skipTextureAtlas: true },
  { id: "wp_med_bow",          name: "Medieval Bow",        path: "/models/weapon_pack/Medieval_Bow.glb",       format: "glb", category: "ranged",  weaponType: "bow",        defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, 0, -0.30] },
  { id: "wp_med_quarterstaff", name: "Quarterstaff",        path: "/models/weapon_pack/Quarterstaff.glb",       format: "glb", category: "polearm", weaponType: "poleaxe",    defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, -0.45, 0] },
  { id: "wp_med_shield_round", name: "Medieval Round Shield", path: "/models/weapon_pack/Medieval_Shield_1.glb",  format: "glb", category: "shield",  weaponType: "shield",     defaultScale: 1.0, skipTextureAtlas: true },
  { id: "wp_med_shield_kite",  name: "Medieval Kite Shield",  path: "/models/weapon_pack/Medieval_Shield_2.glb",  format: "glb", category: "shield",  weaponType: "shield",     defaultScale: 1.0, skipTextureAtlas: true },
  { id: "wp_med_shield_heater",name: "Medieval Heater Shield",path: "/models/weapon_pack/Medieval_Shield_3.glb",  format: "glb", category: "shield",  weaponType: "shield",     defaultScale: 1.0, skipTextureAtlas: true },
];

export const FIREARM_WEAPONS: WeaponModelEntry[] = [
  { id: "gun_revolver",    name: "Revolver",      path: "/models/threejs-games/weapons/revolver.glb",    format: "glb", category: "ranged", weaponType: "gun", defaultScale: 1.0, skipTextureAtlas: true },
  { id: "gun_luger",       name: "Luger Pistol",  path: "/models/threejs-games/weapons/luger.glb",       format: "glb", category: "ranged", weaponType: "gun", defaultScale: 1.0, skipTextureAtlas: true },
  { id: "gun_flame",       name: "Flame Gun",     path: "/models/threejs-games/weapons/flame-gun.glb",   format: "glb", category: "ranged", weaponType: "gun", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, 0, 0.22] },
  { id: "gun_machine",     name: "Machine Gun",   path: "/models/threejs-games/weapons/machine-gun.glb", format: "glb", category: "ranged", weaponType: "gun", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, 0, 0.25] },
  { id: "gun_rifle",       name: "Rifle",         path: "/models/threejs-games/weapons/rifle.glb",       format: "glb", category: "ranged", weaponType: "gun", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, 0, 0.25] },
  { id: "gun_berthier",    name: "Berthier Rifle",path: "/models/threejs-games/weapons/rifle-berthier.glb", format: "glb", category: "ranged", weaponType: "gun", defaultScale: 1.0, skipTextureAtlas: true, offHandGripLocal: [0, 0, 0.28] },
  { id: "gun_axe_lowpoly", name: "Throwing Axe",  path: "/models/threejs-games/weapons/axe-lowpoly.glb", format: "glb", category: "blade",  weaponType: "axe", defaultScale: 1.0, skipTextureAtlas: true },
  { id: "gun_kasikara",    name: "Kasikara",      path: "/models/threejs-games/weapons/kasikara.glb",    format: "glb", category: "blade",  weaponType: "dagger", defaultScale: 1.0, skipTextureAtlas: true },
];

export const ALL_WEAPON_CATALOG: WeaponModelEntry[] = [
  ...QUATERNIUS_WEAPONS,
  ...KAYKIT_WEAPONS,
  ...WEAPON_PACK_WEAPONS,
  ...FIREARM_WEAPONS,
  ...CRAFTPIX_WEAPONS,
  ...OFFHAND_MODELS,
];

export function getWeaponModelsByType(weaponType: WeaponType): WeaponModelEntry[] {
  return ALL_WEAPON_CATALOG.filter(w => w.weaponType === weaponType);
}

// Returns a sensible default weapon model id for a given weapon type, so the
// character forge can auto-equip a real weapon mesh whenever the user picks
// a weapon type from the type picker. Without this, picking e.g. "hammer"
// would leave the right-hand weapon model unset, the hands would close on
// nothing, and the procedural grip pose would visibly cross hands.
//
// Returns null only for `fists` (no model needed) or weapon types with no
// entries in the catalog.
export function getDefaultWeaponModelId(weaponType: WeaponType | null | undefined): string | null {
  if (!weaponType || weaponType === "fists") return null;
  const candidates = ALL_WEAPON_CATALOG.filter(w => w.weaponType === weaponType);
  return candidates[0]?.id ?? null;
}

export function getWeaponModelsByCategory(category: WeaponCategory): WeaponModelEntry[] {
  return ALL_WEAPON_CATALOG.filter(w => w.category === category);
}

export function getRecommendedAnimPacks(weaponType: WeaponType): AnimationPackEntry[] {
  const mapping = WEAPON_ANIM_MAPPING.find(m => m.weaponType === weaponType);
  if (!mapping) return [];
  return mapping.recommendedPacks
    .map(id => ANIMATION_PACKS.find(p => p.id === id))
    .filter((p): p is AnimationPackEntry => !!p);
}

export function getAnimationsForModel(combatClass: CombatClass): AnimationPackEntry[] {
  const result: AnimationPackEntry[] = [];
  for (const pack of ANIMATION_PACKS) {
    if (pack.combatStyle === "universal") {
      result.push(pack);
    } else if (combatClass === "melee" && (pack.combatStyle === "melee_shield" || pack.combatStyle === "melee" || pack.combatStyle === "melee_greatsword" || pack.combatStyle === "melee_axe" || pack.combatStyle === "unarmed")) {
      result.push(pack);
    } else if (combatClass === "caster" && pack.combatStyle === "caster") {
      result.push(pack);
    } else if (combatClass === "ranger" && (pack.combatStyle === "ranger" || pack.combatStyle === "ranged")) {
      result.push(pack);
    }
  }
  return result;
}

export function getAllAnimationPacks(): AnimationPackEntry[] {
  return ANIMATION_PACKS;
}

export function getAnimationPackById(id: string): AnimationPackEntry | undefined {
  return ANIMATION_PACKS.find(p => p.id === id);
}

// --- Ammo / accessory props -------------------------------------------------
// Arrows and quivers are not wieldable weapons (no `WeaponType` mapping), so
// they live in their own catalog and are looked up by `arrowModelId` /
// `backAccessoryId` on `CharacterConfig`. The runtime loads them as plain
// GLBs (no rig, no atlas), so the schema is intentionally minimal.
//
// Source meshes were extracted by `script/asset_tools/extract_medieval_pack.mjs`
// — `Medieval_Arrow.glb` is rotated so its long axis ends up along +Y (matches
// the convention in `extract_medieval_pack.mjs > ROT_Z_TO_Y`); `Arrow_Bag.glb`
// keeps its original orientation. `defaultLength` describes the long-axis size
// in metres so the projectile system can normalise to a consistent shaft size
// (the procedural arrow is roughly 1.0m end-to-end). `axis` tells consumers
// which local axis is the "tip" direction so we can re-align to whatever the
// projectile / attachment expects.
export interface PropModelEntry {
  id: string;
  name: string;
  path: string;
  defaultLength: number;
  axis: "x" | "y" | "z";
}

export const ARROW_MODELS: PropModelEntry[] = [
  { id: "wp_med_arrow", name: "Medieval Arrow", path: "/models/weapon_pack/Medieval_Arrow.glb", defaultLength: 1.0, axis: "y" },
];

export const BACK_ACCESSORIES: PropModelEntry[] = [
  { id: "wp_med_arrow_bag", name: "Arrow Bag (Quiver)", path: "/models/weapon_pack/Arrow_Bag.glb", defaultLength: 0.45, axis: "y" },
];

export function getArrowModel(id: string | null | undefined): PropModelEntry | undefined {
  if (!id) return undefined;
  return ARROW_MODELS.find(a => a.id === id);
}

export function getBackAccessoryModel(id: string | null | undefined): PropModelEntry | undefined {
  if (!id) return undefined;
  return BACK_ACCESSORIES.find(a => a.id === id);
}
