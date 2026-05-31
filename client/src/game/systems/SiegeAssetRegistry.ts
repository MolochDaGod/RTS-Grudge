/**
 * SiegeAssetRegistry — World-placed siege equipment, training props, and
 * decoration objects from the Craftpix Low-Poly Medieval pack.
 *
 * These are NOT hand-held weapons — they are large world objects loaded as
 * static or rigged meshes via AssetLoader. Rigged variants include bones
 * for animating mechanical parts (catapult arm, ballista string, etc.).
 *
 * Source: scripts/convert-craftpix-lowpoly.cjs
 */

// ---------------------------------------------------------------------------
// Siege equipment
// ---------------------------------------------------------------------------

export type SiegeCategory = "catapult" | "ballista" | "battering_ram";

export interface SiegeAssetEntry {
  id: string;
  name: string;
  /** Static mesh (no bones) */
  staticPath: string;
  /** Rigged mesh (bones for animation) — null if no rig was provided */
  riggedPath: string | null;
  category: SiegeCategory;
  /** Default world-space scale */
  defaultScale: number;
  /** Health points for siege targets */
  baseHP: number;
  /** Whether this siege unit can be player-operated */
  operable: boolean;
  description: string;
}

export const SIEGE_ASSETS: SiegeAssetEntry[] = [
  {
    id: "siege_catapult",
    name: "Catapult",
    staticPath: "/models/craftpix_lowpoly/Catapult.glb",
    riggedPath: "/models/craftpix_lowpoly/Catapult_Rig.glb",
    category: "catapult",
    defaultScale: 1.0,
    baseHP: 5000,
    operable: true,
    description: "Medieval trebuchet-style catapult. Launches stones at structures and groups.",
  },
  {
    id: "siege_ballista",
    name: "Ballista",
    staticPath: "/models/craftpix_lowpoly/Ballista.glb",
    riggedPath: "/models/craftpix_lowpoly/Ballista_Rig.glb",
    category: "ballista",
    defaultScale: 1.0,
    baseHP: 3500,
    operable: true,
    description: "Giant crossbow turret. Fires heavy bolts at single targets with high accuracy.",
  },
  {
    id: "siege_battering_ram",
    name: "Battering Ram",
    staticPath: "/models/craftpix_lowpoly/Battering_Ram.glb",
    riggedPath: "/models/craftpix_lowpoly/Battering_Ram_Rig.glb",
    category: "battering_ram",
    defaultScale: 1.0,
    baseHP: 8000,
    operable: true,
    description: "Wheeled battering ram for breaking down gates and walls.",
  },
];

/** Catapult ammo — loaded as a separate prop mesh for projectile spawning */
export const SIEGE_AMMO = {
  catapult_stone: {
    id: "siege_catapult_stone",
    name: "Catapult Stone",
    path: "/models/craftpix_lowpoly/Catapult_Stone.glb",
    defaultScale: 1.0,
    damage: 500,
    splashRadius: 3.0,
  },
  ballista_bolt: {
    id: "siege_ballista_bolt",
    name: "Ballista Bolt",
    path: "/models/craftpix_lowpoly/Big_Crossbow_Arrow.glb",
    defaultScale: 1.0,
    damage: 350,
    splashRadius: 0,
  },
} as const;

// ---------------------------------------------------------------------------
// Training & decoration props
// ---------------------------------------------------------------------------

export type TrainingPropType = "target_dummy" | "target_board" | "dartboard" | "weapon_stand";

export interface TrainingPropEntry {
  id: string;
  name: string;
  path: string;
  propType: TrainingPropType;
  defaultScale: number;
  /** Whether this prop can be attacked for combat training */
  attackable: boolean;
  /** HP for attackable props — they respawn after being "destroyed" */
  hp: number;
  description: string;
}

export const TRAINING_PROPS: TrainingPropEntry[] = [
  {
    id: "prop_target_dummy",
    name: "Target Dummy",
    path: "/models/craftpix_lowpoly/Target_Dummy.glb",
    propType: "target_dummy",
    defaultScale: 1.0,
    attackable: true,
    hp: 999999,
    description: "Straw training dummy. Takes damage but never dies — shows DPS readout.",
  },
  {
    id: "prop_target_board",
    name: "Archery Target",
    path: "/models/craftpix_lowpoly/Target_Board.glb",
    propType: "target_board",
    defaultScale: 1.0,
    attackable: true,
    hp: 999999,
    description: "Archery target board with bullseye rings. Tracks hit accuracy.",
  },
  {
    id: "prop_dartboard",
    name: "Dartboard",
    path: "/models/craftpix_lowpoly/Dartboard.glb",
    propType: "dartboard",
    defaultScale: 1.0,
    attackable: true,
    hp: 999999,
    description: "Wall-mounted dartboard for ranged practice.",
  },
  {
    id: "prop_weapon_stand",
    name: "Weapon Stand",
    path: "/models/craftpix_lowpoly/Weapon_Stand.glb",
    propType: "weapon_stand",
    defaultScale: 1.0,
    attackable: false,
    hp: 0,
    description: "Wooden weapon rack for displaying and storing weapons. Interactable for gear swap.",
  },
];

// ---------------------------------------------------------------------------
// Rigged weapon models (bow/crossbow with draw animations)
// ---------------------------------------------------------------------------

export const RIGGED_WEAPON_VARIANTS = {
  bow_rig: {
    id: "clp_bow_rig",
    name: "LP Bow (Rigged)",
    path: "/models/craftpix_lowpoly/Bow_Rig.glb",
    description: "Rigged bow with string-draw bone for pull animation.",
  },
  crossbow_rig: {
    id: "clp_crossbow_rig",
    name: "LP Crossbow (Rigged)",
    path: "/models/craftpix_lowpoly/Crossbow_Rig.glb",
    description: "Rigged crossbow with string bone for cocking animation.",
  },
} as const;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getSiegeAsset(id: string): SiegeAssetEntry | undefined {
  return SIEGE_ASSETS.find(s => s.id === id);
}

export function getTrainingProp(id: string): TrainingPropEntry | undefined {
  return TRAINING_PROPS.find(p => p.id === id);
}

export function getSiegeByCategory(category: SiegeCategory): SiegeAssetEntry[] {
  return SIEGE_ASSETS.filter(s => s.category === category);
}

export function getAttackableProps(): TrainingPropEntry[] {
  return TRAINING_PROPS.filter(p => p.attackable);
}
