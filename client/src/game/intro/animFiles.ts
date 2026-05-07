// Most files are single-clip Mixamo exports — for those, leave `clipName`
// unset and the first (and only) clip is taken. For multi-clip GLBs (e.g. the
// KayKit "Rig_Medium_*" packs that bundle a dozen clips per file), set
// `clipName` to the exact clip name inside the GLB so we can cherry-pick (e.g.
// the bespoke "Throw" clip used for the grab beat).
export type IntroAnimEntry = { name: string; file: string; clipName?: string };

const ANIM_BASE = "/models/animations";

// Crew on the enemy deck: swing/punch/grab/release. The KayKit "Throw" clip is
// a real two-handed lift-and-overhead-toss motion — exactly what the "crew
// hauls the player overboard" beat wants — so it leads the grab keyword
// search. `rallying` / `pick_up_item` stay as fallbacks in case retargeting
// against an unusual rig drops the KayKit tracks.
export const ANIM_COMBAT_FILES: IntroAnimEntry[] = [
  // Original "slash"/"attack" beats were sword & shield clips from a
  // non-Mixamo pack we deleted because its rest pose distorted the
  // player rig. The intro crew brawls bare-handed now — these names are
  // kept so the keyword search in the intro still resolves them, but
  // they all map to Mixamo unarmed strikes from glocomotion_combat.
  { name: "slash_a",         file: `${ANIM_BASE}/glocomotion_combat/right_hook.glb` },
  { name: "slash_b",         file: `${ANIM_BASE}/glocomotion_combat/uppercut.glb` },
  { name: "attack_a",        file: `${ANIM_BASE}/glocomotion_combat/punching.glb` },
  { name: "attack_b",        file: `${ANIM_BASE}/glocomotion_combat/straightpunching.glb` },
  { name: "punch",           file: `${ANIM_BASE}/glocomotion_combat/punching.glb` },
  { name: "hook",            file: `${ANIM_BASE}/glocomotion_combat/right_hook.glb` },
  { name: "uppercut",        file: `${ANIM_BASE}/glocomotion_combat/uppercut.glb` },
  // Two-handed grab + lift + overhead toss — the "haul overboard" motion.
  // Listed before the rallying / pickup fallbacks so the grab keyword search
  // finds this clip first.
  { name: "grab_lift_throw", file: `${ANIM_BASE}/kaykit/Rig_Medium_General.glb`, clipName: "Throw" },
  { name: "grab_pickup_lift",file: `${ANIM_BASE}/kaykit/Rig_Medium_General.glb`, clipName: "PickUp" },
  { name: "grab_carry",      file: `${ANIM_BASE}/glocomotion_combat/rallying.glb` },
  { name: "grab_pickup",     file: `${ANIM_BASE}/glocomotion_combat/pick_up_item.glb` },
  { name: "victory",         file: `${ANIM_BASE}/glocomotion_combat/victory.glb` },
];

export const ANIM_SPECIAL_FILES: IntroAnimEntry[] = [
  { name: "idle",         file: `${ANIM_BASE}/glocomotion/idle.glb` },
  { name: "struggle_hit", file: `${ANIM_BASE}/glocomotion/hit.glb` },
  { name: "stagger",      file: `${ANIM_BASE}/glocomotion_combat/stunned.glb` },
  { name: "react_flinch", file: `${ANIM_BASE}/glocomotion_combat/medium_hit_to_head.glb` },
  { name: "fall_idle",    file: `${ANIM_BASE}/glocomotion/fall.glb` },
  { name: "tumble_air",   file: `${ANIM_BASE}/glocomotion_combat/sweep_fall.glb` },
  { name: "death_lay",    file: `${ANIM_BASE}/glocomotion/death.glb` },
  { name: "rise_getup",   file: `${ANIM_BASE}/glocomotion_combat/pick_up_item.glb` },
  { name: "land",         file: `${ANIM_BASE}/glocomotion/land.glb` },
];
