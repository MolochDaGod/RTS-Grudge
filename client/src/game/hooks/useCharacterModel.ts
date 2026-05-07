import { useEffect, useRef, useMemo, useCallback } from "react";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { useAsset } from "./useAsset";
import { getSharedLoader } from "../systems/AssetLoader";
import { RIGHT_HAND_ALIASES, LEFT_HAND_ALIASES, HEAD_ALIASES, findBoneByAlias, retargetClips, captureRestPose, type RestPoseEntry } from "../systems/BoneAliases";
import { normalizeCharacterHeight } from "../systems/BoundsUtils";
import { ANIMATION_PACKS, type AnimationPackEntry } from "../systems/ModelRegistry";
import type { WeaponType } from "@/lib/stores/useGame";

export type AnimationState =
  | "idle" | "run" | "walk" | "sprint" | "attack" | "hit" | "death"
  | "jump" | "fall" | "land" | "roll"
  | "sneak" | "crouch_start" | "crouch_end"
  | "idle_alt" | "run_stop" | "victory" | "pickup"
  | "combo2" | "combo3"
  | "fastCombo" | "fastCombo2"
  | "swordBlaster" | "swordBlaster2"
  | "dashAttack" | "dash"
  | "jumpBash" | "doubleJump"
  | "earthquake"
  | "block"
  | "hadouken" | "shoryuken" | "tatsumaki"
  | "whirlwind"
  | "launch" | "launchJump"
  | "pop"
  | "climb"
  | "uppercut"
  | "spinSlash"
  | "counterStrike"
  | "risingSlash"
  | "heavyAttack"
  | "attack2"
  | "idle_alt2"
  | "idle_alt3"
  | "unsheath"
  | "sheath"
  | "walk_uphill_tired"
  | "wall_run"
  | "climb_start"
  | "climb_down"
  | "climb_idle"
  | "climb_topout"
  | "climb_shimmy"
  | "ledge_grab"
  // Farming pack (Mixamo) — usable by player when wielding a tool and by NPC
  // farmer/villager behaviours. Loaded via the `farming` animation pack which
  // characters opt into through extraPacks.
  | "box_idle"
  | "box_walk_arc"
  | "box_turn_left"
  | "box_turn_right"
  | "kneeling_idle"
  | "dig_and_plant_seeds"
  | "pull_plant"
  | "pull_plant_2"
  | "plant_tree"
  | "plant_a_plant"
  | "holding_idle"
  | "holding_walk"
  | "holding_turn_left"
  | "holding_turn_right"
  | "watering"
  | "pick_fruit"
  | "pick_fruit_2"
  | "pick_fruit_3"
  | "cow_milking"
  | "wheelbarrow_idle"
  | "wheelbarrow_walk"
  | "wheelbarrow_walk_back"
  | "wheelbarrow_walk_turn_left"
  | "wheelbarrow_walk_turn_right"
  | "wheelbarrow_dump"
  // Gestures pack (Mixamo Basic Gestures) — 15 emotes bound to numpad keys
  // by the player. A subset (head nods/shakes + weight_shift) is also
  // injected into the alt-idle fidget pool for ambient body language.
  | "gesture_acknowledge"
  | "gesture_angry"
  | "gesture_annoyed_shake"
  | "gesture_cocky"
  | "gesture_dismiss"
  | "gesture_happy"
  | "gesture_hard_nod"
  | "gesture_nod_yes"
  | "gesture_lengthy_nod"
  | "gesture_look_away"
  | "gesture_relieved"
  | "gesture_sarcastic_nod"
  | "gesture_no_shake"
  | "gesture_thoughtful_shake"
  | "gesture_weight_shift"
  | "swim"
  | "swim_idle"
  | "swim_to_edge"
  // Floating: relaxed mid-air pose used as the safe-fall blend (drops <
  // FALL_DAMAGE_THRESHOLD_M) and the apex hang of a double jump.
  | "floating"
  // Quick formal bow — short courteous bow. Player gets it via the gestures
  // pack and folds it into the alt-idle fidget pool ("idle assistant" /
  // non-damage social-collision read).
  | "quick_formal_bow"
  // Poor-miner pickaxe loop. Originally a mining-domain NPC verb sourced
  // from a non-Mixamo seed pack. The pack was removed during the
  // Mixamo-only animation cleanup, so this state currently has no
  // backing clip and will fall through chains until a Mixamo-rigged
  // mining clip lands.
  | "poorminer"
  // Directional shuffles — short standing dodges fired by double-tapping a
  // movement key while *not* sprinting. Only back/right authored so far;
  // forward/left fall back through the chains until FBXs land.
  | "shuffle_forward"
  | "shuffle_back"
  | "shuffle_left"
  | "shuffle_right"
  // Reactive dodge played when the dodge/evasion stat avoids an incoming
  // hit. Triggered from useSurvival.takeDamage via emitDodgeProc().
  | "dodge_proc"
  // Standard locomotion pack additions (Mixamo "Locomotion Pack" — 12 clips).
  // In-place strafes loop while the body keeps facing forward; strafe-walk
  // variants advance forward while side-stepping. Useful for camera-relative
  // movement when the controller decouples facing from velocity.
  | "strafe_left"
  | "strafe_right"
  | "strafe_walk_left"
  | "strafe_walk_right"
  // Committed 90° on-the-spot pivots — one-shot, auto-return to idle. Used by
  // NPCs/AI for big facing changes when standing still; the player's tighter
  // turn_left/turn_right loops handle continuous rotation.
  | "turn_left_90"
  | "turn_right_90"
  // Climb-domain extras — all one-shot transitions that resolve back into
  // their loop counterpart (`climb` / `climb_idle`).
  | "sprint_to_wall_climb"   // sprint vault into wall-grab (energetic ledge_grab variant)
  | "double_jump_to_climb"   // air-grab from second-jump apex onto a braced hang
  | "ascending_stairs"       // stair-specific stride; distinct from walk_uphill_tired
  | "climb_ladder_start";    // ladder-specific turn-then-grab (vs wall climb_start)

/**
 * Detects "junk" rest-pose clips that ship with most of our character GLBs
 * (Sketchfab exports include a literal `"0_T-Pose"` clip alongside the
 * actual animation). If we don't filter these out:
 *   - `clips[0]` is the T-pose, so the no-idle fallback at line ~999 plays
 *     it and stores it as `actions["idle"]`. Every subsequent
 *     `playAnimation("idle")` then pulls back the T-pose, even after
 *     external packs inject a real idle.
 *   - The CharacterSelect preview (which renders without weapons and
 *     therefore never triggers pack injection) gets stuck in T-pose
 *     forever.
 * Matches: `0_T-Pose`, `0_T-Pose(0)`, `T-Pose`, `TPose`, `t_pose`,
 *          `A-Pose`, `bind_pose`, `rest_pose`, etc.
 */
export function isRestPoseClipName(name: string): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  // Strip leading digits / underscores (e.g. "0_T-Pose" → "t-pose"),
  // and trailing parenthesized indices (e.g. "0_T-Pose(0)" → "t-pose").
  const stripped = n
    .replace(/^[0-9_\s]+/, "")
    .replace(/\([0-9]+\)$/, "")
    .replace(/[\s_-]+/g, "");
  return stripped === "tpose" || stripped === "apose"
      || stripped === "bindpose" || stripped === "restpose";
}

const CLIP_PATTERNS: Record<AnimationState, string[]> = {
  idle: ["Idle", "CharacterArmature|Idle", "CharacterArmature|Idle_Neutral", "Idle_Neutral", "Idle_Loop", "idle", "Flying_Idle"],
  run: ["Run", "CharacterArmature|Run", "Jog_Fwd_Loop", "Jog", "run", "Fast_Flying"],
  walk: ["Walk", "CharacterArmature|Walk", "Walk_Loop", "walk"],
  sprint: ["Run", "CharacterArmature|Run", "Sprint_Loop", "sprint"],
  attack: ["SwordSlash", "CharacterArmature|Sword_Slash", "Punch", "CharacterArmature|Punch_Left", "CharacterArmature|Punch_Right", "Punch_Jab", "Sword_Attack", "attack", "Bite_Front", "Headbutt"],
  attack2: ["Punch", "CharacterArmature|Punch_Left", "CharacterArmature|Punch_Right", "SwordSlash", "CharacterArmature|Sword_Slash", "Punch_Cross", "Bite_Front"],
  hit: ["RecieveHit", "CharacterArmature|HitRecieve", "CharacterArmature|HitRecieve_2", "HitReact", "HitRecieve", "Hit_Chest", "Hit_Head"],
  death: ["Death", "CharacterArmature|Death", "Defeat", "Death01"],
  jump: ["Jump", "CharacterArmature|Jump", "Jump_Start", "Jump_Idle"],
  fall: ["Jump", "CharacterArmature|Jump", "Jump_Loop", "Jump_Idle", "Flying_Idle"],
  land: ["Idle", "CharacterArmature|Idle", "Jump_Land"],
  roll: ["Roll", "CharacterArmature|Roll", "Roll_RM", "Duck"],
  sneak: ["Walk", "CharacterArmature|Walk", "Crouch_Fwd_Loop", "Crawl"],
  crouch_start: ["SitDown", "CharacterArmature|SitDown", "Duck"],
  crouch_end: ["StandUp", "CharacterArmature|StandUp"],
  idle_alt: ["Victory", "PickUp", "CharacterArmature|Victory", "Wave", "Yes", "Dance", "Dance_Loop"],
  run_stop: ["Idle", "CharacterArmature|Idle"],
  victory: ["Victory", "CharacterArmature|Victory", "Yes", "Wave", "Dance", "Dance_Loop"],
  pickup: ["PickUp", "CharacterArmature|PickUp"],
  combo2: ["Punch", "CharacterArmature|Punch_Left", "SwordSlash", "CharacterArmature|Sword_Slash", "Sword_Regular_B"],
  combo3: ["SwordSlash", "CharacterArmature|Sword_Slash", "CharacterArmature|Kick_Left", "Sword_Regular_C"],
  fastCombo: ["Punch", "CharacterArmature|Punch_Left", "CharacterArmature|Punch_Right", "Sword_Regular_Combo"],
  fastCombo2: ["Punch", "CharacterArmature|Punch_Right", "CharacterArmature|Punch_Left"],
  swordBlaster: ["Shoot_OneHanded", "CharacterArmature|Shoot_OneHanded", "SwordSlash"],
  swordBlaster2: ["Spell_Simple_Shoot", "CharacterArmature|Shoot_OneHanded", "Shoot_OneHanded", "SwordSlash", "Punch_Cross"],
  dashAttack: ["SwordSlash", "CharacterArmature|Sword_Slash", "Sword_Dash_RM", "Punch"],
  dash: ["Run", "CharacterArmature|Run"],
  jumpBash: ["SwordSlash", "CharacterArmature|Sword_Slash", "Punch"],
  doubleJump: ["Jump", "CharacterArmature|Jump"],
  earthquake: ["Roll", "CharacterArmature|Roll", "Defeat", "Death"],
  block: ["SitDown", "CharacterArmature|SitDown", "Idle", "CharacterArmature|Idle", "Sword_Block", "Idle_Shield_Loop"],
  hadouken: ["Shoot_OneHanded", "CharacterArmature|Shoot_OneHanded", "Spell_Simple_Shoot", "Punch"],
  shoryuken: ["Punch", "CharacterArmature|Punch_Left", "Jump"],
  tatsumaki: ["Roll", "CharacterArmature|Roll", "CharacterArmature|Kick_Left"],
  whirlwind: ["Roll", "CharacterArmature|Roll"],
  launch: ["Punch", "CharacterArmature|Punch_Left", "SwordSlash"],
  launchJump: ["Jump", "CharacterArmature|Jump", "Punch"],
  pop: ["Victory", "CharacterArmature|Victory", "PickUp"],
  climb: ["Climbing", "Climb", "12Climbing", "CharacterArmature|Climb", "Walk", "CharacterArmature|Walk", "Run"],
  uppercut: ["Punch", "CharacterArmature|Punch_Left", "CharacterArmature|Punch_Right"],
  spinSlash: ["SwordSlash", "CharacterArmature|Sword_Slash", "Roll"],
  counterStrike: ["SwordSlash", "CharacterArmature|Sword_Slash", "Punch"],
  risingSlash: ["SwordSlash", "CharacterArmature|Sword_Slash", "Jump"],
  heavyAttack: ["SwordSlash", "CharacterArmature|Sword_Slash", "Punch_Cross", "Sword_Attack_RM", "Punch"],
  idle_alt2: ["Idle", "CharacterArmature|Idle", "Idle_Loop", "Idle_Neutral"],
  idle_alt3: ["Idle", "CharacterArmature|Idle", "Idle_Loop", "Idle_Neutral"],
  unsheath: ["PickUp", "CharacterArmature|PickUp", "Wave", "Yes"],
  sheath: ["PickUp", "CharacterArmature|PickUp", "Wave", "Yes"],
  walk_uphill_tired: ["WalkUphillTired", "Walk_Uphill_Tired", "Ascending_Stairs", "12Ascending_Stairs", "Walk", "CharacterArmature|Walk", "walk"],
  wall_run: ["WallRun", "Wall_Run", "12Wall_Run", "Climb", "CharacterArmature|Climb", "Jump", "CharacterArmature|Jump"],
  climb_start: ["ClimbStart", "Climb_Start", "Start_Climbing_Ladder", "spinStart_Climbing_Ladder", "12spinStart_Climbing_Ladder", "Climb", "CharacterArmature|Climb", "PickUp"],
  climb_down: ["ClimbDown", "Climb_Down", "Climbing_Down_Wall", "12Climbing_Down_Wall", "Climb", "CharacterArmature|Climb", "Walk"],
  climb_idle: ["ClimbIdle", "Climb_Idle", "Hang_Idle", "1sClimbing", "Idle", "CharacterArmature|Idle"],
  climb_topout: ["ClimbTopOut", "Climb_TopOut", "Braced_Hang_To_Crouch", "Hang_To_Crouch", "PickUp", "CharacterArmature|PickUp", "Climb"],
  climb_shimmy: ["ClimbShimmy", "Climb_Shimmy", "Braced_Hang_Shimmy", "Hang_Shimmy", "Climb", "CharacterArmature|Climb"],
  ledge_grab: ["LedgeGrab", "Ledge_Grab", "doublejumpToBraced", "Catch_Ledge", "Climb", "CharacterArmature|Climb", "Jump"],
  // Farming pack — clips primarily resolve through the pack loader (renamed
  // to the file-entry name); the patterns below let `findClip` pick them up
  // if a character's source GLB happens to bake them in too.
  box_idle: ["box_idle", "BoxIdle", "Box_Idle", "Idle", "CharacterArmature|Idle"],
  box_walk_arc: ["box_walk_arc", "BoxWalkArc", "Box_Walk", "Walk", "CharacterArmature|Walk"],
  box_turn_left: ["box_turn_left", "BoxTurnLeft", "Box_Turn", "Walk", "CharacterArmature|Walk"],
  box_turn_right: ["box_turn_right", "BoxTurnRight", "Box_Turn", "Walk", "CharacterArmature|Walk"],
  kneeling_idle: ["kneeling_idle", "KneelingIdle", "Kneeling", "Idle", "CharacterArmature|Idle"],
  dig_and_plant_seeds: ["dig_and_plant_seeds", "DigAndPlantSeeds", "DigPlant", "PickUp", "CharacterArmature|PickUp"],
  pull_plant: ["pull_plant", "PullPlant", "PickUp", "CharacterArmature|PickUp"],
  pull_plant_2: ["pull_plant_2", "PullPlant2", "PickUp", "CharacterArmature|PickUp"],
  plant_tree: ["plant_tree", "PlantTree", "PickUp", "CharacterArmature|PickUp"],
  plant_a_plant: ["plant_a_plant", "PlantAPlant", "PlantPlant", "PickUp", "CharacterArmature|PickUp"],
  holding_idle: ["holding_idle", "HoldingIdle", "Idle", "CharacterArmature|Idle"],
  holding_walk: ["holding_walk", "HoldingWalk", "Walk", "CharacterArmature|Walk"],
  holding_turn_left: ["holding_turn_left", "HoldingTurnLeft", "Holding_Turn", "Walk", "CharacterArmature|Walk"],
  holding_turn_right: ["holding_turn_right", "HoldingTurnRight", "Holding_Turn", "Walk", "CharacterArmature|Walk"],
  watering: ["watering", "Watering", "Water", "PickUp", "CharacterArmature|PickUp"],
  pick_fruit: ["pick_fruit", "PickFruit", "Pick_Fruit", "PickUp", "CharacterArmature|PickUp"],
  pick_fruit_2: ["pick_fruit_2", "PickFruit2", "PickUp", "CharacterArmature|PickUp"],
  pick_fruit_3: ["pick_fruit_3", "PickFruit3", "PickUp", "CharacterArmature|PickUp"],
  cow_milking: ["cow_milking", "CowMilking", "Milking", "PickUp", "CharacterArmature|PickUp"],
  wheelbarrow_idle: ["wheelbarrow_idle", "WheelbarrowIdle", "Idle", "CharacterArmature|Idle"],
  wheelbarrow_walk: ["wheelbarrow_walk", "WheelbarrowWalk", "Walk", "CharacterArmature|Walk"],
  wheelbarrow_walk_back: ["wheelbarrow_walk_back", "WheelbarrowWalkBack", "Walk", "CharacterArmature|Walk"],
  wheelbarrow_walk_turn_left: ["wheelbarrow_walk_turn_left", "WheelbarrowWalkTurnLeft", "Walk", "CharacterArmature|Walk"],
  wheelbarrow_walk_turn_right: ["wheelbarrow_walk_turn_right", "WheelbarrowWalkTurnRight", "Walk", "CharacterArmature|Walk"],
  wheelbarrow_dump: ["wheelbarrow_dump", "WheelbarrowDump", "Dump", "PickUp", "CharacterArmature|PickUp"],
  // Swimming pack
  swim: ["swimming", "Swimming", "Swim", "Walk", "CharacterArmature|Walk"],
  swim_idle: ["treading_water", "TreadingWater", "Tread_Water", "Idle", "CharacterArmature|Idle"],
  // Gesture clip patterns — file entries are renamed by the pack loader so
  // matching by the file-entry name is reliable. Each falls back to "Idle"
  // so a character that somehow loaded the pack without the clip still
  // resolves to a no-op rather than crashing the player frame.
  gesture_acknowledge: ["acknowledging", "Acknowledging", "Idle"],
  gesture_angry: ["angry_gesture", "AngryGesture", "Angry", "Idle"],
  gesture_annoyed_shake: ["annoyed_head_shake", "AnnoyedHeadShake", "Idle"],
  gesture_cocky: ["being_cocky", "BeingCocky", "Cocky", "Idle"],
  gesture_dismiss: ["dismissing_gesture", "DismissingGesture", "Dismiss", "Idle"],
  gesture_happy: ["happy_hand_gesture", "HappyHandGesture", "Happy", "Idle"],
  gesture_hard_nod: ["hard_head_nod", "HardHeadNod", "Idle"],
  gesture_nod_yes: ["head_nod_yes", "HeadNodYes", "Nod", "Idle"],
  gesture_lengthy_nod: ["lengthy_head_nod", "LengthyHeadNod", "Idle"],
  gesture_look_away: ["look_away_gesture", "LookAwayGesture", "LookAway", "Idle"],
  gesture_relieved: ["relieved_sigh", "RelievedSigh", "Sigh", "Idle"],
  gesture_sarcastic_nod: ["sarcastic_head_nod", "SarcasticHeadNod", "Idle"],
  gesture_no_shake: ["shaking_head_no", "ShakingHeadNo", "HeadShake", "Idle"],
  gesture_thoughtful_shake: ["thoughtful_head_shake", "ThoughtfulHeadShake", "Idle"],
  gesture_weight_shift: ["weight_shift", "WeightShift", "Idle"],
  swim_to_edge: ["swimming_to_edge", "SwimmingToEdge", "Swim_To_Edge", "PickUp", "CharacterArmature|PickUp", "Climb"],
  // Floating: prefer the new clip; fall back to fall/jump so a character
  // missing the GLB still poses something during airtime.
  floating: ["floating", "Floating", "Float", "fall", "Fall", "jump"],
  // Quick formal bow: idle blend; falls back to a generic acknowledging
  // gesture or alt-idle pose.
  quick_formal_bow: ["quick_formal_bow", "QuickFormalBow", "Bow", "FormalBow", "Idle"],
  // Poorminer: mining loop; degrades to attack so any unarmed strike
  // animation still reads as "swinging at a wall".
  poorminer: ["poorminer", "PoorMiner", "Mining", "Pickaxe", "attack", "Attack"],
  // Shuffles. Forward and left are unauthored — they pattern-match
  // anything containing the direction so the loader picks up future
  // FBXs automatically, and otherwise fall back via FALLBACK_CHAIN.
  shuffle_forward: ["shuffle_forward", "ShuffleForward", "Standing_Dodge_Forward", "DodgeForward", "step_forward"],
  shuffle_back: ["shuffle_back", "ShuffleBack", "Standing_Dodge_Backward", "DodgeBackward", "step_back"],
  shuffle_left: ["shuffle_left", "ShuffleLeft", "Standing_Dodge_Left", "DodgeLeft", "step_left"],
  shuffle_right: ["shuffle_right", "ShuffleRight", "Standing_Dodge_Right", "DodgeRight", "step_right"],
  // Dodge proc — uses the Mixamo "Dodging_Back" clip we ship as
  // dodge_proc.glb; degrades to roll/jump if a character has neither.
  dodge_proc: ["dodge_proc", "DodgeProc", "Dodging_Back", "Dodge", "roll", "Roll"],
  // Standard locomotion pack — file-entry names match AnimationState 1:1
  // because the pack loader renames clips[0].name to the file-entry name.
  strafe_left: ["strafe_left", "StrafeLeft", "Left_Strafe", "Strafe_Left", "left strafe"],
  strafe_right: ["strafe_right", "StrafeRight", "Right_Strafe", "Strafe_Right", "right strafe"],
  strafe_walk_left: ["strafe_walk_left", "StrafeWalkLeft", "Left_Strafe_Walking", "left strafe walking"],
  strafe_walk_right: ["strafe_walk_right", "StrafeWalkRight", "Right_Strafe_Walking", "right strafe walking"],
  turn_left_90: ["turn_left_90", "TurnLeft90", "Left_Turn_90", "left turn 90"],
  turn_right_90: ["turn_right_90", "TurnRight90", "Right_Turn_90", "right turn 90"],
  sprint_to_wall_climb: ["sprint_to_wall_climb", "SprintToWallClimb", "Sprint_To_Wall_Climb", "Wall_Run", "wall_run"],
  double_jump_to_climb: ["double_jump_to_climb", "DoubleJumpToClimb", "doublejumpToBraced", "Double_Jump_To_Braced"],
  ascending_stairs: ["ascending_stairs", "AscendingStairs", "12Ascending_Stairs", "Ascending_Stairs", "Walk", "CharacterArmature|Walk"],
  climb_ladder_start: ["climb_ladder_start", "ClimbLadderStart", "12spinStart_Climbing_Ladder", "Start_Climbing_Ladder", "spinStart_Climbing_Ladder"],
};

const ONE_SHOT = new Set<AnimationState>([
  "attack", "attack2", "hit", "death", "jump", "land", "roll",
  "crouch_start", "crouch_end", "run_stop", "idle_alt", "victory", "pickup",
  "combo2", "combo3", "fastCombo", "fastCombo2", "swordBlaster", "swordBlaster2",
  "dashAttack", "dash", "jumpBash", "doubleJump", "earthquake",
  "hadouken", "shoryuken", "tatsumaki", "launch", "launchJump", "pop",
  "uppercut", "spinSlash", "counterStrike", "risingSlash", "heavyAttack",
  "idle_alt2", "idle_alt3", "unsheath", "sheath",
  "wall_run", "climb_start", "climb_topout", "ledge_grab",
  // Farming one-shot actions. Turn clips are NOT auto-return so callers can
  // chain the matching holding/wheelbarrow walk state after the turn finishes.
  "box_turn_left", "box_turn_right",
  "dig_and_plant_seeds", "pull_plant", "pull_plant_2", "plant_tree", "plant_a_plant",
  "holding_turn_left", "holding_turn_right",
  "watering", "pick_fruit", "pick_fruit_2", "pick_fruit_3", "cow_milking",
  "wheelbarrow_walk_turn_left", "wheelbarrow_walk_turn_right", "wheelbarrow_dump",
  // Swim-to-edge is a single climb-out transition; swim and swim_idle loop.
  "swim_to_edge",
  // Gestures are all one-shot emotes that resolve back to idle.
  "gesture_acknowledge", "gesture_angry", "gesture_annoyed_shake",
  "gesture_cocky", "gesture_dismiss", "gesture_happy",
  "gesture_hard_nod", "gesture_nod_yes", "gesture_lengthy_nod",
  "gesture_look_away", "gesture_relieved", "gesture_sarcastic_nod",
  "gesture_no_shake", "gesture_thoughtful_shake", "gesture_weight_shift",
  // Bow is a brief one-shot that returns to idle. Floating and poorminer
  // are loops (held-pose / repeating action) so they're intentionally not
  // listed here.
  "quick_formal_bow",
  // Shuffles + dodge proc are all brief, one-shot reactive moves that
  // must return to idle/locomotion as soon as the clip ends.
  "shuffle_forward", "shuffle_back", "shuffle_left", "shuffle_right",
  "dodge_proc",
  // Standard locomotion one-shots — committed pivots and climb-transitions.
  // (Strafes and ascending_stairs are loops, intentionally excluded.)
  "turn_left_90", "turn_right_90",
  "sprint_to_wall_climb", "double_jump_to_climb", "climb_ladder_start",
]);

const AUTO_RETURN = new Set<AnimationState>([
  "attack", "attack2", "hit", "roll", "land", "run_stop", "idle_alt",
  "crouch_start", "crouch_end", "victory", "pickup",
  "combo2", "combo3", "fastCombo", "fastCombo2", "swordBlaster", "swordBlaster2",
  "dashAttack", "dash", "jumpBash", "earthquake",
  "hadouken", "shoryuken", "tatsumaki", "launch", "launchJump", "pop",
  "uppercut", "spinSlash", "counterStrike", "risingSlash", "heavyAttack",
  "idle_alt2", "idle_alt3", "unsheath", "sheath",
  "wall_run",
  // Farming verb actions auto-return to idle so a character that requests
  // `playAnimation("watering")` ends up back in idle without bookkeeping.
  // Turn clips are intentionally excluded — the AI/controller chains them
  // back into the matching holding/wheelbarrow walk state.
  "dig_and_plant_seeds", "pull_plant", "pull_plant_2", "plant_tree", "plant_a_plant",
  "watering", "pick_fruit", "pick_fruit_2", "pick_fruit_3", "cow_milking",
  "wheelbarrow_dump",
  // Gestures auto-return so playing one always resolves back to idle —
  // matches the existing alt-idle / pickup behaviour where the override
  // slot owns the body for one cycle then releases.
  "gesture_acknowledge", "gesture_angry", "gesture_annoyed_shake",
  "gesture_cocky", "gesture_dismiss", "gesture_happy",
  "gesture_hard_nod", "gesture_nod_yes", "gesture_lengthy_nod",
  "gesture_look_away", "gesture_relieved", "gesture_sarcastic_nod",
  "gesture_no_shake", "gesture_thoughtful_shake", "gesture_weight_shift",
  // Bow returns to idle automatically; floating/poorminer loop so they're
  // intentionally excluded.
  "quick_formal_bow",
  // Same auto-return treatment for the directional shuffles + dodge proc.
  "shuffle_forward", "shuffle_back", "shuffle_left", "shuffle_right",
  "dodge_proc",
  // 90° pivots and climb-transitions auto-resolve back to idle so callers
  // don't need to chain a follow-up state.
  "turn_left_90", "turn_right_90",
  "sprint_to_wall_climb", "double_jump_to_climb", "climb_ladder_start",
]);

const SPEED_OVERRIDES: Partial<Record<AnimationState, number>> = {
  sneak: 0.6, sprint: 1.3, dash: 1.8, fastCombo: 1.5, fastCombo2: 1.5,
  whirlwind: 2.0, tatsumaki: 1.4, combo2: 1.2, combo3: 1.1,
  uppercut: 1.3, spinSlash: 1.6, counterStrike: 1.8, risingSlash: 1.2, heavyAttack: 0.7,
  walk_uphill_tired: 0.85,
  wall_run: 1.1,
  climb_start: 1.0,
  climb: 1.0,
  climb_down: 1.0,
  climb_idle: 1.0,
  climb_topout: 1.0,
  climb_shimmy: 1.0,
  ledge_grab: 1.15,
  // Farming pack — Mixamo source clips already play at natural speed; only
  // tweak the wheelbarrow walks so they read as a slower laden gait.
  wheelbarrow_walk: 0.85,
  wheelbarrow_walk_back: 0.85,
  box_walk_arc: 0.9,
  holding_walk: 0.95,
};

const FALLBACK_CHAIN: Partial<Record<AnimationState, AnimationState[]>> = {
  sprint: ["run", "walk"], walk: ["run", "idle"], run: ["walk", "sprint"],
  combo2: ["attack", "attack2"], combo3: ["attack", "combo2"], attack2: ["combo2", "attack"],
  fall: ["jump", "idle"], land: ["idle"], sneak: ["walk", "idle"],
  crouch_start: ["idle"], crouch_end: ["idle"],
  dashAttack: ["attack", "combo2"], dash: ["run", "sprint"],
  jumpBash: ["attack", "combo2"], doubleJump: ["jump"],
  earthquake: ["attack", "roll"], block: ["idle"],
  hadouken: ["attack", "swordBlaster"], shoryuken: ["attack", "uppercut", "jump"],
  tatsumaki: ["roll", "spinSlash", "whirlwind"], whirlwind: ["roll", "spinSlash"],
  launch: ["attack", "uppercut"], launchJump: ["jump", "attack"],
  pop: ["victory", "idle"], climb: ["climb_idle", "walk", "run"],
  uppercut: ["attack", "combo2"], spinSlash: ["attack", "roll"],
  counterStrike: ["attack", "combo2"], risingSlash: ["attack", "jump"],
  heavyAttack: ["attack", "combo2"], swordBlaster: ["attack", "hadouken"],
  swordBlaster2: ["swordBlaster", "hadouken", "attack"],
  fastCombo: ["attack", "combo2"], fastCombo2: ["attack2", "combo3"],
  idle_alt: ["idle"], run_stop: ["idle"], victory: ["idle_alt", "idle"], pickup: ["idle"],
  idle_alt2: ["idle_alt", "idle"], idle_alt3: ["idle_alt", "idle"],
  unsheath: ["pickup", "idle_alt", "idle"], sheath: ["pickup", "idle_alt", "idle"],
  walk_uphill_tired: ["walk", "run", "idle"],
  wall_run: ["climb", "doubleJump", "jump", "idle"],
  climb_start: ["climb", "pickup", "idle_alt", "idle"],
  climb_down: ["climb", "climb_idle", "walk", "idle"],
  climb_idle: ["idle", "block"],
  climb_topout: ["pickup", "crouch_end", "idle_alt", "idle"],
  climb_shimmy: ["climb", "climb_idle", "walk", "idle"],
  ledge_grab: ["climb_start", "doubleJump", "jump", "fall", "idle"],
  // Farming fallbacks — every state degrades to a generic equivalent so a
  // character without the farming pack still plays *something* sensible.
  box_idle: ["holding_idle", "idle"],
  box_walk_arc: ["holding_walk", "walk"],
  box_turn_left: ["holding_turn_left", "walk"],
  box_turn_right: ["holding_turn_right", "walk"],
  kneeling_idle: ["crouch_start", "sneak", "idle"],
  dig_and_plant_seeds: ["pickup", "kneeling_idle", "idle"],
  pull_plant: ["pickup", "kneeling_idle", "idle"],
  pull_plant_2: ["pull_plant", "pickup", "idle"],
  plant_tree: ["pickup", "kneeling_idle", "idle"],
  plant_a_plant: ["plant_tree", "pickup", "idle"],
  holding_idle: ["idle"],
  holding_walk: ["walk", "idle"],
  holding_turn_left: ["holding_walk", "walk"],
  holding_turn_right: ["holding_walk", "walk"],
  watering: ["holding_idle", "pickup", "idle"],
  pick_fruit: ["pickup", "holding_idle", "idle"],
  pick_fruit_2: ["pick_fruit", "pickup", "idle"],
  pick_fruit_3: ["pick_fruit", "pickup", "idle"],
  cow_milking: ["kneeling_idle", "pickup", "idle"],
  wheelbarrow_idle: ["holding_idle", "idle"],
  wheelbarrow_walk: ["holding_walk", "walk"],
  wheelbarrow_walk_back: ["wheelbarrow_walk", "walk"],
  wheelbarrow_walk_turn_left: ["wheelbarrow_walk", "holding_turn_left", "walk"],
  wheelbarrow_walk_turn_right: ["wheelbarrow_walk", "holding_turn_right", "walk"],
  wheelbarrow_dump: ["pickup", "holding_idle", "idle"],
  // Swimming fallbacks — degrade to walk/idle if a character lacks the
  // glocomotion_combat pack so a fishless world still animates.
  swim: ["walk", "run", "idle"],
  swim_idle: ["idle", "idle_alt"],
  swim_to_edge: ["climb_topout", "pickup", "land", "idle"],
  // Gesture fallbacks — if the gestures pack isn't loaded for a given
  // character, every emote degrades to one of the alt-idle fidgets, so
  // the player still gets *some* expressive twitch instead of a freeze.
  gesture_acknowledge: ["idle_alt", "idle"],
  gesture_angry: ["idle_alt2", "idle_alt", "idle"],
  gesture_annoyed_shake: ["idle_alt2", "idle_alt", "idle"],
  gesture_cocky: ["idle_alt3", "idle_alt", "idle"],
  gesture_dismiss: ["idle_alt2", "idle_alt", "idle"],
  gesture_happy: ["idle_alt", "idle_alt3", "idle"],
  gesture_hard_nod: ["idle_alt", "idle"],
  gesture_nod_yes: ["idle_alt", "idle"],
  gesture_lengthy_nod: ["idle_alt", "idle"],
  gesture_look_away: ["idle_alt3", "idle_alt", "idle"],
  gesture_relieved: ["idle_alt", "idle"],
  gesture_sarcastic_nod: ["idle_alt2", "idle_alt", "idle"],
  gesture_no_shake: ["idle_alt2", "idle_alt", "idle"],
  gesture_thoughtful_shake: ["idle_alt", "idle"],
  gesture_weight_shift: ["idle_alt", "idle"],
  // Floating degrades to fall (the panicked-fall pose) so airtime always
  // animates even on characters that don't have the floating clip loaded.
  floating: ["fall", "jump", "idle"],
  // Bow degrades through the gestures pool to the alt-idle fidget.
  quick_formal_bow: ["gesture_acknowledge", "idle_alt", "idle"],
  // Mining degrades to a generic attack swing if the mining pack isn't
  // loaded — reads as "swinging at a wall".
  poorminer: ["attack", "attack2", "idle"],
  // Shuffle degradation. All four directions are authored on the
  // player rig; these chains exist for NPC rigs that lack the
  // glocomotion shuffle clips, where they degrade through a roll or
  // the closest locomotion clip so something still plays.
  shuffle_forward: ["run", "walk", "sneak", "idle"],
  shuffle_back: ["roll", "run_stop", "idle"],
  shuffle_left: ["walk", "run", "sneak", "idle"],
  shuffle_right: ["roll", "run", "idle"],
  // Dodge proc degrades to a roll then to hit so something always
  // plays even on minimal animation packs.
  dodge_proc: ["roll", "shuffle_back", "hit", "idle"],
  // Standard locomotion fallbacks. Strafes degrade to walk so a minimal
  // pack still moves the body sideways; pivots fall through to a turn loop
  // then idle. Climb transitions land in their loop counterpart.
  strafe_left: ["walk", "shuffle_left", "idle"],
  strafe_right: ["walk", "shuffle_right", "idle"],
  strafe_walk_left: ["strafe_left", "walk", "idle"],
  strafe_walk_right: ["strafe_right", "walk", "idle"],
  turn_left_90: ["idle", "walk"],
  turn_right_90: ["idle", "walk"],
  sprint_to_wall_climb: ["wall_run", "ledge_grab", "climb_start", "climb"],
  double_jump_to_climb: ["ledge_grab", "doubleJump", "climb_start", "fall"],
  ascending_stairs: ["walk_uphill_tired", "walk", "idle"],
  climb_ladder_start: ["climb_start", "climb", "pickup", "idle_alt", "idle"],
};

// Mixamo-only fallback. Non-Mixamo weapon packs (sword_shield,
// racalvin_*, ual1/ual2, longbow, rifle_locomotion, magic) were
// removed because their rest poses distorted the player's silhouette
// during retargeting. Every weapon now resolves to glocomotion +
// glocomotion_combat until weapon-specific Mixamo packs land.
const WEAPON_TO_PACKS: Record<WeaponType, string[]> = {
  sword: ["glocomotion_combat", "glocomotion"],
  greatsword: ["glocomotion_combat", "glocomotion"],
  axe: ["glocomotion_combat", "glocomotion"],
  poleaxe: ["glocomotion_combat", "glocomotion"],
  hammer: ["glocomotion_combat", "glocomotion"],
  dagger: ["glocomotion_combat", "glocomotion"],
  staff: ["glocomotion"],
  wand: ["glocomotion"],
  bow: ["glocomotion"],
  crossbow: ["glocomotion"],
  gun: ["glocomotion"],
  shield: ["glocomotion_combat", "glocomotion"],
  fists: ["glocomotion_combat", "glocomotion"],
};

const PACK_NAME_TO_STATE: Record<string, AnimationState> = {
  idle: "idle", idle_alt: "idle_alt", idle_2: "idle_alt", idle_3: "idle_alt2", idle_4: "idle_alt3",
  draw: "unsheath", draw_sword: "unsheath", draw_sword_alt: "unsheath",
  sheath_sword: "sheath", sheath_sword_alt: "sheath",
  walk: "walk", walk_forward: "walk", walk_alt: "walk", walk_back: "walk",
  walk_left: "walk", walk_right: "walk",
  run: "run", run_forward: "run", run_alt: "run", run_back: "run",
  run_left: "run", run_right: "run", running: "run",
  sprint: "sprint", sprint_forward: "sprint",
  jump: "jump", jumping_up: "jump", jump_up: "jump",
  death: "death", death_alt: "death", death_front_headshot: "death",
  death_from_front: "death", death_from_right: "death",
  death_crouch_headshot: "death", death_back_headshot: "death", death_from_back: "death",
  hit_large: "hit", hit_small: "hit", impact: "hit", impact_2: "hit", impact_3: "hit",
  slash: "attack", attack: "attack", attack_1h: "attack", attack_1h_01: "attack",
  attack_horizontal: "attack", attack_downward: "heavyAttack",
  slash_2: "combo2", attack_2: "combo2", attack_1h_02: "combo2", combo_1: "combo2",
  slash_3: "combo3", attack_3: "combo3", attack_1h_03: "combo3", combo_2: "combo3",
  slash_4: "fastCombo", attack_4: "fastCombo", combo_3: "fastCombo",
  slash_5: "fastCombo2",
  attack_360_high: "spinSlash", attack_360_low: "whirlwind", high_spin: "spinSlash",
  attack_backhand: "counterStrike", run_jump_attack: "jumpBash",
  slide_attack: "dashAttack", jump_attack: "jumpBash",
  block: "block", block_alt: "block", blocking: "block", block_idle: "block",
  kick: "uppercut", attack_kick: "uppercut",
  spell_cast: "hadouken", cast_1h: "hadouken", casting: "hadouken", casting_alt: "hadouken",
  attack_2h_area: "earthquake", area_attack_01: "earthquake", area_attack_02: "earthquake",
  attack_2h_01: "swordBlaster", attack_2h_02: "swordBlaster", cast_2h: "swordBlaster",
  falling_idle: "fall", falling_to_roll: "roll", hard_landing: "land",
  crouch_sneak_left: "sneak", crouch_sneak_right: "sneak",
  crouching: "sneak", crouching_2: "sneak", crouching_3: "sneak",
  crouch: "sneak", crouch_idle: "idle", crouch_block: "block",
  strafe: "walk", strafe_2: "walk", strafe_3: "walk", strafe_4: "walk",
  power_up: "whirlwind",
  armada: "spinSlash", au: "roll", capoeira: "whirlwind",
  meia_lua: "tatsumaki", martelo: "attack", ginga_forward: "idle", ginga_back: "idle_alt",
  esquiva: "roll", rasteira: "counterStrike",
  Idle_Loop: "idle", Walk_Loop: "walk", Jog_Fwd_Loop: "run", Sprint_Loop: "sprint",
  Jump_Start: "jump", Jump_Loop: "fall", Jump_Land: "land",
  Death01: "death", Hit_Chest: "hit", Hit_Head: "hit",
  Crouch_Fwd_Loop: "sneak", Roll: "roll", Roll_RM: "roll",
  Punch_Jab: "attack", Punch_Cross: "heavyAttack",
  Sword_Attack: "attack", Sword_Attack_RM: "heavyAttack",
  Spell_Simple_Shoot: "hadouken", Dance_Loop: "victory",
  Idle_Shield_Loop: "block", Idle_Shield_Break: "hit",
  Hit_Knockback: "hit", Shield_Dash_RM: "dashAttack",
  Shield_OneShot: "attack", Sword_Block: "block", Sword_Dash_RM: "dashAttack",
  Sword_Regular_A: "attack", Sword_Regular_B: "combo2",
  Sword_Regular_C: "combo3", Sword_Regular_Combo: "fastCombo",
  Melee_Hook: "attack", Yes: "victory",
  walk_crouch_forward: "sneak", walk_crouch_left: "sneak",
  walk_crouch_right: "sneak", walk_crouch_backward: "sneak",
  run_backward: "run", sprint_left: "sprint", sprint_right: "sprint",
  jump_loop: "fall", jump_down: "land",

  // GLocomotion (Mixamo locomotion pack — flat clip names)
  idle_fidget: "idle_alt", idle_look: "idle_alt", idle_stretch: "idle_alt",
  crouch_start: "sneak", crouch_end: "idle",
  sneak_forward: "sneak", sneak_left: "sneak", sneak_right: "sneak",
  turn_left: "idle", turn_right: "idle",
  fall: "fall", land: "land", roll: "roll",

  // GLocomotion Combat (Mixamo combat & misc)
  punching: "attack", straightpunching: "attack", punching_bag: "combo2",
  right_hook: "combo2", uppercut: "uppercut",
  mma_kick: "uppercut", martelo_2: "spinSlash",
  medium_hit_to_head: "hit", stunned: "hit",
  sweep_fall: "death", run_to_dive: "dashAttack",
  pick_up_item: "pickup", rallying: "victory", victory: "victory",
  // (swimming / treading_water / swimming_to_edge map to dedicated swim
  //  AnimationStates further down — see PACK_NAME_TO_STATE swim entries.)
  skateboarding: "sprint",

  // GLocomotion — tired/exhausted variants (incline locomotion)
  walk_uphill_tired: "walk_uphill_tired",

  // GLocomotion — parkour / vault (sprint into ≤3m wall, ≤90° upward)
  wall_run: "wall_run",

  // GLocomotion — transition into climb loop (turn-then-grab, no sprint, climb hotkey held at wall/ladder)
  climb_start: "climb_start",

  // GLocomotion — climb suite (up/down/hang-idle/topout-to-crouch). `climb` was a stub
  // (walk fallback) before; the new climb.glb supplies the real climbing-up loop.
  climb: "climb",
  climb_down: "climb_down",
  climb_idle: "climb_idle",
  climb_topout: "climb_topout",

  // GLocomotion — sideways braced shimmy on the wall (mirror gives the other side).
  climb_shimmy: "climb_shimmy",

  // GLocomotion — air-grab save: spend the second-jump input mid-fall to snap
  // onto a nearby ledge instead of double-jumping.
  ledge_grab: "ledge_grab",

  // Farming pack — file-entry names match the AnimationState names 1:1 because
  // the pack loader renames `clips[0].name` to the file-entry name on load.
  box_idle: "box_idle",
  box_walk_arc: "box_walk_arc",
  box_turn_left: "box_turn_left",
  box_turn_right: "box_turn_right",
  kneeling_idle: "kneeling_idle",
  dig_and_plant_seeds: "dig_and_plant_seeds",
  pull_plant: "pull_plant",
  pull_plant_2: "pull_plant_2",
  plant_tree: "plant_tree",
  plant_a_plant: "plant_a_plant",
  holding_idle: "holding_idle",
  holding_walk: "holding_walk",
  holding_turn_left: "holding_turn_left",
  holding_turn_right: "holding_turn_right",
  watering: "watering",
  pick_fruit: "pick_fruit",
  pick_fruit_2: "pick_fruit_2",
  pick_fruit_3: "pick_fruit_3",
  cow_milking: "cow_milking",
  wheelbarrow_idle: "wheelbarrow_idle",
  wheelbarrow_walk: "wheelbarrow_walk",
  wheelbarrow_walk_back: "wheelbarrow_walk_back",
  wheelbarrow_walk_turn_left: "wheelbarrow_walk_turn_left",
  wheelbarrow_walk_turn_right: "wheelbarrow_walk_turn_right",
  wheelbarrow_dump: "wheelbarrow_dump",

  // Swimming pack — file-entry names in glocomotion_combat:
  //   swimming.glb           → forward swim stroke (loops)
  //   treading_water.glb     → in-place tread / surface hover (loops)
  //   swimming_to_edge.glb   → climb-out to standing (one-shot)
  swimming: "swim",
  treading_water: "swim_idle",
  swimming_to_edge: "swim_to_edge",

  // Gestures pack — file-entry name → emote AnimationState. Keep file
  // names snake_case to match the registry and the on-disk GLBs.
  acknowledging: "gesture_acknowledge",
  angry_gesture: "gesture_angry",
  annoyed_head_shake: "gesture_annoyed_shake",
  being_cocky: "gesture_cocky",
  dismissing_gesture: "gesture_dismiss",
  happy_hand_gesture: "gesture_happy",
  hard_head_nod: "gesture_hard_nod",
  head_nod_yes: "gesture_nod_yes",
  lengthy_head_nod: "gesture_lengthy_nod",
  look_away_gesture: "gesture_look_away",
  relieved_sigh: "gesture_relieved",
  sarcastic_head_nod: "gesture_sarcastic_nod",
  shaking_head_no: "gesture_no_shake",
  thoughtful_head_shake: "gesture_thoughtful_shake",
  weight_shift: "gesture_weight_shift",

  // Locomotion + domain additions:
  //   floating.glb (in glocomotion pack) → "floating" airtime pose
  //   quick_formal_bow.glb (in gestures_basic pack) → ambient bow
  //   poorminer.glb (in mining pack)               → mining loop
  floating: "floating",
  quick_formal_bow: "quick_formal_bow",
  poorminer: "poorminer",

  // Shuffles + dodge proc — file-name-to-state for the loader.
  shuffle_forward: "shuffle_forward",
  shuffle_back: "shuffle_back",
  shuffle_left: "shuffle_left",
  shuffle_right: "shuffle_right",
  dodge_proc: "dodge_proc",

  // Standard locomotion pack — file-entry name → state. The 12-clip Mixamo
  // "Locomotion Pack" was renamed during conversion (e.g. "left strafe" →
  // strafe_left) so file-entries are 1:1 with the AnimationState union.
  strafe_left: "strafe_left",
  strafe_right: "strafe_right",
  strafe_walk_left: "strafe_walk_left",
  strafe_walk_right: "strafe_walk_right",
  turn_left_90: "turn_left_90",
  turn_right_90: "turn_right_90",
  sprint_to_wall_climb: "sprint_to_wall_climb",
  double_jump_to_climb: "double_jump_to_climb",
  ascending_stairs: "ascending_stairs",
  climb_ladder_start: "climb_ladder_start",

  // New swim trio sourced from the orphan single-clip uploads. These live
  // in the glocomotion pack now (no swim clips were on the player rig
  // before — only on glocomotion_combat). Names below map the canonical
  // file-stems to the existing swim/swim_idle/swim_to_edge states.
  swim: "swim",
  tread_water: "swim_idle",
  swim_to_edge: "swim_to_edge",
};

function findClip(clips: THREE.AnimationClip[], state: AnimationState): THREE.AnimationClip | null {
  const patterns = CLIP_PATTERNS[state];
  if (!patterns) return null;

  for (const name of patterns) {
    const clip = clips.find(c => c.name === name || c.name === name.replace(/:/g, ""));
    if (clip) return clip;
  }
  for (const name of patterns) {
    const lower = name.toLowerCase();
    const clip = clips.find(c => c.name.toLowerCase() === lower);
    if (clip) return clip;
  }
  for (const name of patterns) {
    const lower = name.toLowerCase();
    const clip = clips.find(c => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()));
    if (clip) return clip;
  }

  const fallbacks = FALLBACK_CHAIN[state];
  if (fallbacks) {
    for (const fb of fallbacks) {
      const fbPatterns = CLIP_PATTERNS[fb];
      if (!fbPatterns) continue;
      for (const name of fbPatterns) {
        const clip = clips.find(c => c.name === name || c.name.toLowerCase() === name.toLowerCase());
        if (clip) return clip;
      }
    }
  }

  return null;
}

// Sizing is now delegated entirely to `normalizeCharacterHeight` in
// BoundsUtils — the SINGLE canonical "make this character N metres tall and
// stand on the ground" function shared with the Hero Forge preview. Do NOT
// add a local scale formula here; that is exactly the kind of duplicate
// pipeline that produced the "100x too big" bug.

interface MaterialColorMap {
  [materialName: string]: string;
}

interface UseCharacterModelOptions {
  modelPath: string;
  targetHeight?: number;
  tintColor?: string | null;
  materialColorOverrides?: MaterialColorMap | null;
  weaponType?: WeaponType;
  /**
   * Additional animation pack IDs to load on top of the weapon-derived packs.
   * Use this to opt a character into a domain-specific clip set (e.g. `["farming"]`
   * for an NPC farmer or for a player holding a hoe/scythe). Packs in this list
   * are appended after the weapon packs, so weapon-pack clips take precedence
   * when the same state appears in both. Stable across renders by reference; pass
   * a useMemo'd array to avoid re-loading.
   */
  extraPacks?: string[];
  /**
   * When true, this hook will NOT auto-play idle on bind, will NOT auto-return
   * to idle on one-shot finished events, and weapon-pack swaps will not force
   * a cross-fade. Use this when an external CharacterAnimator is driving the
   * mixer (see useCharacterController).
   */
  externallyDriven?: boolean;
}

interface LoadedPack {
  clips: THREE.AnimationClip[];
  // Rest pose captured from the pack's source skeleton. Used by retargetClips
  // to perform delta-from-rest math when binding these clips onto a character
  // whose rest pose differs from the source rig (e.g. Mixamo packs onto a
  // CC4 character). Without this, the previous code passed `null` and got
  // rename-only retargeting, which preserved bone names but applied raw
  // source-space rotations directly to bones with different rest orientations
  // — the visible result is twisted/contorted limbs.
  //
  // For bundled packs (single GLB containing many clips on the same rig)
  // this is a single map shared by every clip. For per-file packs (each
  // clip in its own GLB), each clip can carry its own captured rest pose
  // via `perClipRest` — different Mixamo exports can bake the bind pose
  // differently (e.g. one with skin, one without; one with end-effector
  // bones, one without), and using the wrong rest map for delta math
  // collapses the clip's tracks to identity, leaving the rig in its bind
  // pose (the visible "T-pose" symptom). When `perClipRest` has an entry
  // for a clip, it overrides `sourceRest` for that clip's retargeting.
  sourceRest: Map<string, RestPoseEntry> | null;
  perClipRest?: Map<string, Map<string, RestPoseEntry> | null>;
}

const packClipCache = new Map<string, LoadedPack>();
const packLoadingPromises = new Map<string, Promise<LoadedPack>>();

async function loadPackClips(pack: AnimationPackEntry): Promise<LoadedPack> {
  if (packClipCache.has(pack.id)) return packClipCache.get(pack.id)!;
  if (packLoadingPromises.has(pack.id)) return packLoadingPromises.get(pack.id)!;

  const promise = (async () => {
    const loader = getSharedLoader();
    const allClips: THREE.AnimationClip[] = [];
    // Wrap in a holder object so TS doesn't narrow the let-binding to `null`
    // after the closure-side assignment in captureRestFrom (which it can't
    // see through). The holder sidesteps the narrow without an explicit cast.
    const restHolder: { value: Map<string, RestPoseEntry> | null } = { value: null };
    // Per-clip rest map, populated only by the per-file branch below. Stays
    // undefined for bundled packs where one rest is shared by all clips.
    let perClipRest: Map<string, Map<string, RestPoseEntry> | null> | undefined;

    const captureRestFrom = (gltf: any) => {
      if (restHolder.value || !gltf?.scene) return;
      try {
        restHolder.value = captureRestPose(gltf.scene);
      } catch { /* leave as null — falls back to rename-only retargeting */ }
    };

    if (pack.bundledFile) {
      try {
        const url = `${pack.basePath}/${pack.bundledFile}`;
        const gltf = await new Promise<any>((res, rej) => loader.load(url, res, undefined, rej));
        captureRestFrom(gltf);
        for (const clip of (gltf.animations || [])) allClips.push(clip);
      } catch (e) {
        console.warn(`[CharModel] Failed to load bundled pack ${pack.id}:`, e);
      }
    } else {
      const results = await Promise.allSettled(
        pack.animations.map(async (animEntry) => {
          const url = `${pack.basePath}/${animEntry.file}`;
          try {
            const gltf = await new Promise<any>((res, rej) => loader.load(url, res, undefined, rej));
            const clips = gltf.animations || [];
            if (clips.length > 0) {
              clips[0].name = animEntry.name;
              return { clip: clips[0] as THREE.AnimationClip, gltf };
            }
          } catch { /* skip failed animation */ }
          return null;
        })
      );
      // Per-file packs need PER-CLIP rest poses, not a single pack-wide one.
      // Different Mixamo exports of the "same" rig can bake the bind pose
      // differently (skin vs no-skin, end-effector bones present vs absent),
      // and feeding the wrong rest map to the cross-rig delta math produces
      // a degenerate clip whose tracks collapse to the bind pose — visually
      // a stuck T-pose. We capture each file's own rest pose here and the
      // consumer uses it when retargeting that specific clip. The first
      // captured rest is also retained as the pack-wide `sourceRest` for
      // backward compatibility (and as a fallback for clips whose own
      // capture failed).
      perClipRest = new Map();
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          captureRestFrom(r.value.gltf);
          let perRest: Map<string, RestPoseEntry> | null = null;
          try {
            if (r.value.gltf?.scene) perRest = captureRestPose(r.value.gltf.scene);
          } catch { /* leave per-clip rest null; consumer falls back to pack-wide */ }
          perClipRest.set(r.value.clip.name, perRest);
          allClips.push(r.value.clip);
        }
      }
      if (perClipRest.size === 0) perClipRest = undefined;
    }

    const sourceRest = restHolder.value;
    console.log(`[CharModel] Pack "${pack.id}": ${allClips.length} clips loaded${sourceRest ? ` (rest pose: ${sourceRest.size} bones)` : " (no rest pose)"}`);
    const loaded: LoadedPack = { clips: allClips, sourceRest, perClipRest };
    packClipCache.set(pack.id, loaded);
    packLoadingPromises.delete(pack.id);
    return loaded;
  })();

  packLoadingPromises.set(pack.id, promise);
  return promise;
}



export function useCharacterModel({
  modelPath,
  targetHeight = 2,
  tintColor = null,
  materialColorOverrides = null,
  weaponType,
  extraPacks,
  externallyDriven = false,
}: UseCharacterModelOptions) {
  const externallyDrivenRef = useRef(externallyDriven);
  externallyDrivenRef.current = externallyDriven;
  const gltf = useAsset(modelPath);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Map<AnimationState, THREE.AnimationAction>>(new Map());
  const currentStateRef = useRef<AnimationState>("idle");
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const transitionLockRef = useRef(0);
  const rightHandRef = useRef<THREE.Object3D | null>(null);
  const leftHandRef = useRef<THREE.Object3D | null>(null);
  const headRef = useRef<THREE.Object3D | null>(null);
  const movementSpeedRef = useRef(0);

  const scene = useMemo(() => {
    const cloned = SkeletonUtils.clone(gltf.scene);
    const clips = (gltf.animations || [])
      .filter(c => !isRestPoseClipName(c.name))
      .map(c => c.clone());

    cloned.rotation.set(0, 0, 0);
    cloned.quaternion.identity();
    cloned.updateMatrixWorld(true);
    {
      const probe = new THREE.Box3().setFromObject(cloned);
      const sx = probe.max.x - probe.min.x;
      const sy = probe.max.y - probe.min.y;
      const sz = probe.max.z - probe.min.z;
      if (sy > 0 && sz > sy * 1.5 && sz > sx * 1.2) {
        cloned.rotation.x = -Math.PI / 2;
        cloned.updateMatrixWorld(true);
      }
    }

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (!mat) continue;

          if (materialColorOverrides && mat.name && materialColorOverrides[mat.name]) {
            (mat as THREE.MeshStandardMaterial).color = new THREE.Color(materialColorOverrides[mat.name]);
          } else if (tintColor) {
            (mat as THREE.MeshStandardMaterial).color = new THREE.Color(tintColor);
          }
        }
      }
    });

    normalizeCharacterHeight(cloned, targetHeight);

    rightHandRef.current = findBoneByAlias(cloned, RIGHT_HAND_ALIASES);
    leftHandRef.current = findBoneByAlias(cloned, LEFT_HAND_ALIASES);
    headRef.current = findBoneByAlias(cloned, HEAD_ALIASES);

    const processedClips = retargetClips(clips, cloned);
    (cloned as any).__clips = processedClips;

    return cloned;
  }, [gltf, targetHeight, tintColor, materialColorOverrides]);

  const mixer = useMemo(() => {
    const m = new THREE.AnimationMixer(scene);
    mixerRef.current = m;
    return m;
  }, [scene]);

  useEffect(() => {
    const clips: THREE.AnimationClip[] = (scene as any).__clips || [];
    const actions = new Map<AnimationState, THREE.AnimationAction>();

    for (const clip of clips) {
      if (clip.name === "mixamo.com" || clip.name === "Armature|mixamo.com") {
        if (clips.length === 1) clip.name = "Idle";
      }
    }

    const allStates = Object.keys(CLIP_PATTERNS) as AnimationState[];
    const matched: string[] = [];

    for (const state of allStates) {
      const clip = findClip(clips, state);
      if (clip) {
        const uniqueClip = clip.clone();
        uniqueClip.name = `${state}_${clip.name}`;
        const action = mixer.clipAction(uniqueClip, scene);

        if (ONE_SHOT.has(state)) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        } else {
          action.setLoop(THREE.LoopRepeat, Infinity);
        }

        const speed = SPEED_OVERRIDES[state];
        if (speed) action.timeScale = speed;

        actions.set(state, action);
        matched.push(state);
      }
    }

    console.log(`[CharModel] "${modelPath}": ${clips.length} clips, ${matched.length} states matched`);
    actionsRef.current = actions;

    if (!externallyDrivenRef.current) {
      const idleAction = actions.get("idle");
      if (idleAction) {
        idleAction.play();
        currentStateRef.current = "idle";
        currentActionRef.current = idleAction;
      } else if (clips.length > 0) {
        const fb = mixer.clipAction(clips[0], scene);
        fb.setLoop(THREE.LoopRepeat, Infinity);
        fb.play();
        currentStateRef.current = "idle";
        currentActionRef.current = fb;
        actions.set("idle", fb);
      }
    }

    const onFinished = (e: any) => {
      // Skip auto-return when an external animator is driving playback —
      // it owns combat-layer fade-outs and locomotion blending.
      if (externallyDrivenRef.current) return;
      const finished = e.action as THREE.AnimationAction;
      // Only auto-return to idle when the finished action is still the
      // currently playing action. Without this guard, an interrupted attack
      // (already cross-faded into another state) would yank the character
      // back to idle and cause a visible snap.
      if (finished !== currentActionRef.current) return;
      for (const [state, action] of actions.entries()) {
        if (action === finished && AUTO_RETURN.has(state)) {
          if (currentStateRef.current !== "death") playAnimation("idle");
          break;
        }
      }
    };

    mixer.addEventListener("finished", onFinished);
    return () => {
      mixer.removeEventListener("finished", onFinished);
      mixer.stopAllAction();
    };
  }, [mixer, scene, modelPath]);

  const packGenRef = useRef(0);
  const injectedRef = useRef<{ state: AnimationState; action: THREE.AnimationAction; clip: THREE.AnimationClip }[]>([]);
  const embeddedClipsRef = useRef<THREE.AnimationClip[]>([]);

  useEffect(() => {
    embeddedClipsRef.current = ((scene as any).__clips || []) as THREE.AnimationClip[];
  }, [scene]);

  // Stable key derived from extraPacks contents (not identity). Callers that
  // pass an inline literal `extraPacks={["gestures_basic"]}` would otherwise
  // hand us a brand-new array every render and re-fire the pack-injection
  // effect below, rebuilding all AnimationActions and freezing the mixer at
  // rest pose ("T-pose / horse-pose flicker"). Comparing by contents makes
  // this hook robust regardless of how the caller spells the prop.
  const extraPacksKey = (extraPacks ?? []).join("|");

  useEffect(() => {
    if (!mixer || !scene) return;
    // Merge weapon-derived packs with caller-supplied extraPacks so an NPC
    // farmer (no weapon) or a player wielding any weapon can opt into a
    // domain-specific clip set like the farming pack. Weapon packs come first
    // so their entries take precedence on duplicate state names.
    const weaponPacks = weaponType ? (WEAPON_TO_PACKS[weaponType] ?? []) : [];
    const merged = extraPacks && extraPacks.length > 0
      ? [...weaponPacks, ...extraPacks]
      : weaponPacks;
    // De-dupe while preserving first-seen order (priority).
    const seen = new Set<string>();
    const packIds: string[] = [];
    for (const id of merged) {
      if (seen.has(id)) continue;
      seen.add(id);
      packIds.push(id);
    }
    if (packIds.length === 0) return;

    const gen = ++packGenRef.current;

    const prevInjected = injectedRef.current;
    // Track which state was actively playing so we can smoothly cross-fade
    // onto the equivalent state in the new weapon's animation profile rather
    // than snapping or freezing when the weapon type changes mid-action.
    const wasPlayingState = currentStateRef.current;
    let needsResume = false;

    for (const entry of prevInjected) {
      const wasCurrent = entry.action === currentActionRef.current;
      entry.action.stop();
      mixer.uncacheAction(entry.clip, scene);
      mixer.uncacheClip(entry.clip);

      const embeddedClip = findClip(embeddedClipsRef.current, entry.state);
      if (embeddedClip) {
        const restored = embeddedClip.clone();
        restored.name = `${entry.state}_${embeddedClip.name}`;
        const restoredAction = mixer.clipAction(restored, scene);
        if (ONE_SHOT.has(entry.state)) {
          restoredAction.setLoop(THREE.LoopOnce, 1);
          restoredAction.clampWhenFinished = true;
        } else {
          restoredAction.setLoop(THREE.LoopRepeat, Infinity);
        }
        const speed = SPEED_OVERRIDES[entry.state];
        if (speed) restoredAction.timeScale = speed;
        actionsRef.current.set(entry.state, restoredAction);
      } else {
        actionsRef.current.delete(entry.state);
      }

      if (wasCurrent) {
        currentActionRef.current = null;
        needsResume = true;
      }
    }
    injectedRef.current = [];

    if (needsResume && !externallyDrivenRef.current) {
      // Try to keep playing the same state on the restored embedded action
      // first, then walk the existing FALLBACK_CHAIN, and only drop to idle
      // as a last resort. This means a swap mid-run keeps running, mid-walk
      // keeps walking, and an interrupted attack tries the equivalent attack
      // before deciding to settle to idle.
      const resumeCandidates: AnimationState[] = [wasPlayingState];
      const fallbacks = FALLBACK_CHAIN[wasPlayingState];
      if (fallbacks) for (const fb of fallbacks) resumeCandidates.push(fb);
      resumeCandidates.push("idle");

      let resumeState: AnimationState = "idle";
      let resumeAction: THREE.AnimationAction | undefined;
      for (const candidate of resumeCandidates) {
        const a = actionsRef.current.get(candidate);
        if (a) { resumeAction = a; resumeState = candidate; break; }
      }
      if (resumeAction) {
        resumeAction.reset().fadeIn(0.2).play();
        currentStateRef.current = resumeState;
        currentActionRef.current = resumeAction;
        transitionLockRef.current = 0.2;
      }
    }

    (async () => {
      const newInjected: typeof injectedRef.current = [];

      for (const packId of packIds) {
        if (gen !== packGenRef.current) return;
        const pack = ANIMATION_PACKS.find(p => p.id === packId);
        if (!pack) continue;

        try {
          const loaded = await loadPackClips(pack);
          if (gen !== packGenRef.current) return;
          let rawClips = loaded.clips;

          // External pack: drop root-chain (Hips/Pelvis/Root) tracks so a
          // pack authored against a different rig can't pancake the player
          // (lay them flat on the ground), tip them sideways, or launch
          // them into the air. Spine/limb tracks pass through unchanged so
          // attacks/walks/etc. still animate correctly.
          //
          // Pass the pack's captured source rest pose so retargetClips can
          // run delta-from-rest math on the spine/limb quaternion tracks.
          // This is what stops a Mixamo-rest pack from twisting a CC4-rest
          // character into a contorted pose. Falls back to rename-only
          // retargeting (the previous behavior) if rest capture failed.
          //
          // For per-file packs, each clip carries its own captured rest
          // pose in `loaded.perClipRest` and we retarget one clip at a
          // time with its own rest. This avoids the "stuck T-pose"
          // symptom that appeared on Mixamo clips exported with a
          // different bind pose than the first-loaded clip in the pack
          // (e.g. shuffle_forward / shuffle_left vs idle).
          if (loaded.perClipRest) {
            const retargeted: THREE.AnimationClip[] = [];
            for (const c of rawClips) {
              const rest = loaded.perClipRest.get(c.name) ?? loaded.sourceRest;
              const out = retargetClips([c], scene, rest, { dropRootChain: true });
              if (out[0]) retargeted.push(out[0]);
            }
            rawClips = retargeted;
          } else {
            rawClips = retargetClips(rawClips, scene, loaded.sourceRest, { dropRootChain: true });
          }
          if (gen !== packGenRef.current) return;

          let addedCount = 0;

          for (const clip of rawClips) {
            const normalized = clip.name.toLowerCase().replace(/[\s-]+/g, "_");
            const state = PACK_NAME_TO_STATE[clip.name] || PACK_NAME_TO_STATE[normalized];
            if (!state) continue;

            if (newInjected.some(e => e.state === state)) continue;

            const existing = actionsRef.current.get(state);
            const replacingCurrent = !!existing && existing === currentActionRef.current;
            if (existing) {
              existing.stop();
              mixer.uncacheAction(existing.getClip(), scene);
              mixer.uncacheClip(existing.getClip());
            }

            const uniqueClip = clip.clone();
            uniqueClip.name = `ext_${packId}_${clip.name}`;
            const action = mixer.clipAction(uniqueClip, scene);

            if (ONE_SHOT.has(state)) {
              action.setLoop(THREE.LoopOnce, 1);
              action.clampWhenFinished = true;
            } else {
              action.setLoop(THREE.LoopRepeat, Infinity);
            }
            const speed = SPEED_OVERRIDES[state];
            if (speed) action.timeScale = speed;

            actionsRef.current.set(state, action);
            newInjected.push({ state, action, clip: uniqueClip });
            addedCount++;

            // If we just replaced the action that was actively playing, hand
            // over playback atomically: rebind currentActionRef to the new
            // action and cross-fade it in. Without this, playAnimation's
            // `state === currentState` early-return would leave the new
            // action stopped, freezing the character until the next state
            // change. For one-shots, prefer settling to idle instead of
            // restarting the swing on the new pack.
            if (replacingCurrent && !externallyDrivenRef.current) {
              if (ONE_SHOT.has(state)) {
                const idleAction = actionsRef.current.get("idle");
                if (idleAction) {
                  idleAction.reset().fadeIn(0.2).play();
                  currentStateRef.current = "idle";
                  currentActionRef.current = idleAction;
                  transitionLockRef.current = 0.2;
                }
              } else {
                action.reset().fadeIn(0.2).play();
                currentStateRef.current = state;
                currentActionRef.current = action;
                transitionLockRef.current = 0.2;
              }
            }
          }

          if (addedCount > 0) {
            console.log(`[CharModel] Pack "${packId}": ${addedCount} animations injected for "${weaponType}"`);
          }
        } catch (e) {
          console.warn(`[CharModel] Pack load error "${packId}":`, e);
        }
      }

      if (gen === packGenRef.current) {
        injectedRef.current = newInjected;
      }
    })();

    return () => { packGenRef.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weaponType, extraPacksKey, mixer, scene]);

  const playAnimation = useCallback((state: AnimationState) => {
    if (currentStateRef.current === "death" && state !== "idle") return;

    const isOnce = ONE_SHOT.has(state);
    if (state === currentStateRef.current && !isOnce) return;

    let next = actionsRef.current.get(state);
    if (!next) {
      const fallbacks = FALLBACK_CHAIN[state];
      if (fallbacks) {
        for (const fb of fallbacks) {
          next = actionsRef.current.get(fb);
          if (next) break;
        }
      }
      if (!next) return;
    }

    const current = currentActionRef.current;
    const isAttackTransition = isOnce && ONE_SHOT.has(currentStateRef.current);
    const fadeDuration = isAttackTransition ? 0.15
      : state === "death" ? 0.35
      : state === "hit" ? 0.15
      : isOnce ? 0.2
      : state === "idle" ? 0.35
      : state === "walk" ? 0.3
      : state === "run" ? 0.25
      : state === "sprint" ? 0.22
      : 0.25;

    if (current && current !== next) current.fadeOut(fadeDuration);
    next.reset().fadeIn(fadeDuration).play();
    currentStateRef.current = state;
    currentActionRef.current = next;
    transitionLockRef.current = isOnce ? 0.35 : 0.25;
  }, []);

  const setMovementSpeed = useCallback((speed: number) => {
    movementSpeedRef.current = speed;
  }, []);

  const update = useCallback((delta: number) => {
    mixer.update(delta);
    if (transitionLockRef.current > 0) transitionLockRef.current -= delta;
  }, [mixer]);

  return {
    scene,
    mixer,
    playAnimation,
    update,
    setMovementSpeed,
    currentState: currentStateRef,
    transitionLock: transitionLockRef,
    rightHand: rightHandRef,
    leftHand: leftHandRef,
    /**
     * Resolved Head bone (via HEAD_ALIASES) on the cloned rig. Published to
     * `playerBones.head` by Player.tsx so cosmetic helm attach, head
     * look-at, and camera-anchor offsets can find it without re-traversing
     * the scene each frame.
     */
    head: headRef,
    /**
     * Map<AnimationState, AnimationAction> updated reactively as
     * embedded clips bind and weapon packs inject new clips. Read-only
     * surface for external animators (CharacterAnimator, BlendTree).
     */
    actions: actionsRef,
  };
}

export { findClip, ONE_SHOT, AUTO_RETURN, SPEED_OVERRIDES, FALLBACK_CHAIN, CLIP_PATTERNS };
