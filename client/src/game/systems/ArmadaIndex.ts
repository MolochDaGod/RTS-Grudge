/**
 * ArmadaIndex — Master index of every unit, building, vehicle, weapon,
 * and effect from the advance_wars_infantry__mech_units organized pack.
 *
 * Defines:
 *  - What each building produces
 *  - What resources are required to build units & structures
 *  - Texture/model CDN paths
 *  - AI behavior assignments
 *  - Projectile & ability loadouts
 *  - Harvesting interactions
 *
 * CDN root: https://assets.grudge-studio.com/grudge-armada
 * Local source: C:\Users\nugye\Documents\advance_wars_infantry__mech_units\organized
 */

// ---------------------------------------------------------------------------
// CDN base
// ---------------------------------------------------------------------------
const CDN = "https://assets.grudge-studio.com/grudge-armada";

// ---------------------------------------------------------------------------
// Unit icon mapping — maps unit/building IDs to their icon image paths.
// Icons live under /icons/grudge/entities/ in the public folder.
// ---------------------------------------------------------------------------
export const UNIT_ICONS: Record<string, string> = {
  // Units
  aw_infantry:     "/icons/grudge/entities/Human Warrior.png",
  aw_mech:         "/icons/grudge/entities/Brute Mecha Icon.png",
  aw_tank:         "/icons/grudge/entities/Heavy Human Merc.PNG",
  mech_tripod:     "/icons/grudge/entities/Brute Mecha Icon.png",
  scifi_soldier:   "/icons/grudge/entities/Human Merc.PNG",
  cyborg_unit:     "/icons/grudge/entities/heavy barb merc.PNG",
  cyborg_soldier:  "/icons/grudge/entities/Heavy Undead Merc.PNG",
  shadow_soldier:  "/icons/grudge/entities/Heavy Orc Merc.PNG",
  scifi_trooper:   "/icons/grudge/entities/Barb merc.PNG",
  scifi_officer:   "/icons/grudge/entities/barb paladin.png",
  // Buildings
  barracks:        "/icons/grudge/entities/Armory Icon.png",
  mech_factory:    "/icons/grudge/entities/Foundry Icon.png",
  vehicle_plant:   "/icons/grudge/entities/Arsenal Icon.png",
  tech_lab:        "/icons/grudge/entities/Laboritory.PNG",
  turret_platform: "/icons/grudge/entities/tower.PNG",
  turret_bud:      "/icons/grudge/entities/tower 2.PNG",
  reactor:         "/icons/grudge/entities/Large Furnace Icon.png",
  refinery:        "/icons/grudge/entities/Refinery Icon.png",
  command_center:  "/icons/grudge/entities/Castle Gate Icon.png",
  drill_station:   "/icons/grudge/entities/Recycler Icon.png",
  warehouse:       "/icons/grudge/entities/Storage.PNG",
  farm:            "/icons/grudge/entities/Workbench.PNG",
  sawmill:         "/icons/grudge/entities/Sawmill Icon.png",
  drill_rig:       "/icons/grudge/entities/Recycler Icon.png",
  repair_dock:     "/icons/grudge/entities/Blacksmith Icon.png",
  solar_array:     "/icons/grudge/entities/Lamp Icon.png",
  cargo_depot:     "/icons/grudge/entities/Market Icon.png",
  landing_pad:     "/icons/grudge/entities/Flag Icon.png",
  drone_bay:       "/icons/grudge/entities/YoloCopter Icon.png",
  space_dock:      "/icons/grudge/entities/Boat Icon.png",
};

export function getUnitIcon(id: string): string {
  return UNIT_ICONS[id] ?? "/icons/grudge/entities/Human Warrior.png";
}

// ---------------------------------------------------------------------------
// Resource types the player harvests / earns
// ---------------------------------------------------------------------------
export type ResourceType =
  | "gold"
  | "iron"
  | "crystal"
  | "oil"
  | "alloy"
  | "circuit"
  | "energy"
  | "biomass";

export interface ResourceCost {
  type: ResourceType;
  amount: number;
}

// ---------------------------------------------------------------------------
// Projectile types units can fire
// ---------------------------------------------------------------------------
export type ProjectileType =
  | "bullet"        // fast, low damage, infantry rifles
  | "missile"       // tracking, medium damage, mechs
  | "cannon_shell"  // slow, high damage, tanks
  | "laser"         // instant-hit, turrets
  | "plasma"        // medium speed, cyborgs
  | "hadouken"      // energy ball, boss mechs
  | "grenade"       // arced, AoE, infantry
  | "none";         // melee only

// ---------------------------------------------------------------------------
// Ability definitions
// ---------------------------------------------------------------------------
export interface UnitAbility {
  id: string;
  name: string;
  cooldown: number;          // seconds
  damage?: number;
  range?: number;
  aoe?: number;              // AoE radius, 0 = single target
  effect?: string;           // status effect applied
  description: string;
}

// ---------------------------------------------------------------------------
// Building definition — production structures
// ---------------------------------------------------------------------------
export type BuildingId =
  | "barracks"
  | "mech_factory"
  | "vehicle_plant"
  | "tech_lab"
  | "turret_platform"
  | "turret_bud"
  | "reactor"
  | "refinery"
  | "drone_bay"
  | "command_center"
  | "space_dock"
  | "repair_dock"
  | "landing_pad"
  | "research_center"
  | "warehouse"
  | "farm"
  | "colonist_home"
  | "solar_array"
  | "drill_station"
  | "cargo_depot";

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  /** CDN model URL */
  modelUrl: string;
  /** Textures bundled inside the GLTF (listed here for reference) */
  textures: string[];
  /** Source asset pack */
  assetPack: string;
  /** Resources to construct this building */
  buildCost: ResourceCost[];
  /** Build time in seconds */
  buildTime: number;
  /** HP of the building */
  health: number;
  /** What unit IDs this building can produce (empty = non-production) */
  produces: string[];
  /** What this building harvests or generates passively */
  generates?: { type: ResourceType; perMinute: number }[];
  description: string;
}

// ---------------------------------------------------------------------------
// Unit definition (extended from UnitRegistry)
// ---------------------------------------------------------------------------
export interface ArmadaUnit {
  id: string;
  name: string;
  /** CDN model URL */
  modelUrl: string;
  /** Texture files referenced by the GLTF */
  textures: string[];
  /** Source asset pack */
  assetPack: string;
  /** Which building produces this unit */
  builtAt: BuildingId;
  /** Resource cost to train/build */
  trainCost: ResourceCost[];
  /** Train time in seconds */
  trainTime: number;

  // --- Combat ---
  health: number;
  armor: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  speed: number;
  detectionRange: number;
  projectile: ProjectileType;
  abilities: UnitAbility[];

  // --- AI ---
  aiBehavior: string;
  /** Can this unit harvest resources? */
  canHarvest: boolean;
  harvestTypes?: ResourceType[];
  harvestRate?: number;

  // --- Render ---
  scale: number;
  targetHeight: number;
  tint: string | null;

  description: string;
}

// ═══════════════════════════════════════════════════════════════════════════
//  BUILDINGS
// ═══════════════════════════════════════════════════════════════════════════

export const BUILDINGS: BuildingDefinition[] = [
  // ── Barracks — trains infantry ──────────────────────────────────────
  {
    id: "barracks",
    name: "Barracks",
    modelUrl: `${CDN}/environments/KayKit_Space_Base_Bits_1.0_FREE/KayKit_Space_Base_Bits_1.0_FREE/Assets/gltf/basemodule_A.gltf`,
    textures: ["colormap.png"],
    assetPack: "KayKit_Space_Base_Bits_1.0_FREE",
    buildCost: [
      { type: "gold", amount: 200 },
      { type: "iron", amount: 100 },
    ],
    buildTime: 30,
    health: 500,
    produces: ["aw_infantry", "scifi_trooper", "scifi_soldier", "shadow_soldier"],
    description: "Basic infantry production. Trains foot soldiers, troopers, and special ops.",
  },

  // ── Mech Factory — builds mechs & cyborgs ──────────────────────────
  {
    id: "mech_factory",
    name: "Mech Factory",
    modelUrl: `${CDN}/environments/KayKit_Space_Base_Bits_1.0_FREE/KayKit_Space_Base_Bits_1.0_FREE/Assets/gltf/basemodule_garage.gltf`,
    textures: ["colormap.png"],
    assetPack: "KayKit_Space_Base_Bits_1.0_FREE",
    buildCost: [
      { type: "gold", amount: 500 },
      { type: "iron", amount: 300 },
      { type: "alloy", amount: 150 },
    ],
    buildTime: 60,
    health: 800,
    produces: ["aw_mech", "cyborg_unit", "cyborg_soldier"],
    description: "Heavy unit assembly. Produces mechs and cybernetic soldiers.",
  },

  // ── Vehicle Plant — builds tanks & APCs ─────────────────────────────
  {
    id: "vehicle_plant",
    name: "Vehicle Plant",
    modelUrl: `${CDN}/environments/Free_Space_Colony_3D_Models/fbx/Machine_building_plant.fbx`,
    textures: ["diffuse.png", "normal.png"],
    assetPack: "Free_Space_Colony_3D_Models",
    buildCost: [
      { type: "gold", amount: 800 },
      { type: "iron", amount: 400 },
      { type: "oil", amount: 200 },
    ],
    buildTime: 90,
    health: 1200,
    produces: ["aw_tank", "mech_tripod"],
    description: "Armored vehicle production line. Builds tanks and heavy walkers.",
  },

  // ── Tech Lab — produces officers & unlocks upgrades ─────────────────
  {
    id: "tech_lab",
    name: "Tech Lab",
    modelUrl: `${CDN}/environments/Free_Space_Colony_3D_Models/fbx/Research_center.fbx`,
    textures: ["diffuse.png", "emissive.png"],
    assetPack: "Free_Space_Colony_3D_Models",
    buildCost: [
      { type: "gold", amount: 600 },
      { type: "crystal", amount: 300 },
      { type: "circuit", amount: 200 },
    ],
    buildTime: 75,
    health: 600,
    produces: ["scifi_officer"],
    description: "Research facility. Produces officers and unlocks tech upgrades for all units.",
  },

  // ── Turret Platform — defensive structure ───────────────────────────
  {
    id: "turret_platform",
    name: "Turret Platform",
    modelUrl: `${CDN}/weapons/laser_turret/scene.gltf`,
    textures: ["diffuse.jpeg", "normal.png", "metallic.png", "roughness.png"],
    assetPack: "laser_turret",
    buildCost: [
      { type: "gold", amount: 300 },
      { type: "iron", amount: 200 },
      { type: "circuit", amount: 50 },
    ],
    buildTime: 20,
    health: 400,
    produces: [],
    description: "Automated laser turret. Fires at enemies within range. Cannot produce units.",
  },

  // ── Turret Bud — cheap deployable turret ─────────────────────────────
  {
    id: "turret_bud",
    name: "Turret Bud",
    modelUrl: `${CDN}/effects/turret_bud/scene.gltf`,
    textures: [],
    assetPack: "turret_bud",
    buildCost: [
      { type: "gold", amount: 100 },
      { type: "iron", amount: 50 },
    ],
    buildTime: 10,
    health: 150,
    produces: [],
    description: "Small deployable auto-turret. Cheap and fast to place. Lower range and damage than the laser platform but spammable for area denial.",
  },

  // ── Reactor — power generation ──────────────────────────────────────
  {
    id: "reactor",
    name: "Reactor",
    modelUrl: `${CDN}/environments/Free_Space_Colony_3D_Models/fbx/Reactor.fbx`,
    textures: ["diffuse.png", "emissive.png"],
    assetPack: "Free_Space_Colony_3D_Models",
    buildCost: [
      { type: "gold", amount: 400 },
      { type: "crystal", amount: 200 },
    ],
    buildTime: 45,
    health: 600,
    produces: [],
    generates: [{ type: "energy", perMinute: 20 }],
    description: "Powers all base buildings. Required for mech factory and tech lab operation.",
  },

  // ── Refinery — processes raw materials ──────────────────────────────
  {
    id: "refinery",
    name: "Refinery",
    modelUrl: `${CDN}/environments/Free_Space_Colony_3D_Models/fbx/Geothermal_generator.fbx`,
    textures: ["diffuse.png"],
    assetPack: "Free_Space_Colony_3D_Models",
    buildCost: [
      { type: "gold", amount: 350 },
      { type: "iron", amount: 150 },
    ],
    buildTime: 40,
    health: 500,
    produces: [],
    generates: [
      { type: "alloy", perMinute: 5 },
      { type: "oil", perMinute: 8 },
    ],
    description: "Refines raw ore into alloy and processes crude oil. Essential for vehicles.",
  },

  // ── Drone Bay — air support ─────────────────────────────────────────
  {
    id: "drone_bay",
    name: "Drone Bay",
    modelUrl: `${CDN}/environments/Free_Space_Colony_3D_Models/fbx/Drone_control_center.fbx`,
    textures: ["diffuse.png"],
    assetPack: "Free_Space_Colony_3D_Models",
    buildCost: [
      { type: "gold", amount: 700 },
      { type: "circuit", amount: 300 },
      { type: "alloy", amount: 200 },
    ],
    buildTime: 80,
    health: 700,
    produces: [],
    description: "Deploys automated scout and strike drones for recon and air support.",
  },

  // ── Command Center — main base HQ ──────────────────────────────────
  {
    id: "command_center",
    name: "Command Center",
    modelUrl: `${CDN}/environments/KayKit_Space_Base_Bits_1.0_FREE/KayKit_Space_Base_Bits_1.0_FREE/Assets/gltf/structure_tall.gltf`,
    textures: ["colormap.png"],
    assetPack: "KayKit_Space_Base_Bits_1.0_FREE",
    buildCost: [],
    buildTime: 0,
    health: 2000,
    produces: [],
    generates: [{ type: "gold", perMinute: 10 }],
    description: "Base headquarters. Lose this and you lose the match. Generates baseline income.",
  },

  // ── Space Dock — air/space vehicles ─────────────────────────────────
  {
    id: "space_dock",
    name: "Space Dock",
    modelUrl: `${CDN}/environments/Free_Space_Colony_3D_Models/fbx/Drone_carrier.fbx`,
    textures: ["diffuse.png"],
    assetPack: "Free_Space_Colony_3D_Models",
    buildCost: [
      { type: "gold", amount: 1000 },
      { type: "alloy", amount: 500 },
      { type: "circuit", amount: 300 },
    ],
    buildTime: 120,
    health: 1500,
    produces: [],
    description: "Constructs and launches air/space vehicles. Requires reactor power.",
  },

  // ── Repair Dock ─────────────────────────────────────────────────────
  {
    id: "repair_dock",
    name: "Repair Dock",
    modelUrl: `${CDN}/vehicles/ship_repair_dock_-_starcraft_2/scene.gltf`,
    textures: ["diffuse.png", "normal.png"],
    assetPack: "ship_repair_dock_-_starcraft_2",
    buildCost: [
      { type: "gold", amount: 400 },
      { type: "iron", amount: 250 },
    ],
    buildTime: 50,
    health: 800,
    produces: [],
    description: "Repairs damaged vehicles and mechs. Units near this building regenerate HP.",
  },

  // ── Landing Pad ─────────────────────────────────────────────────────
  {
    id: "landing_pad",
    name: "Landing Pad",
    modelUrl: `${CDN}/environments/KayKit_Space_Base_Bits_1.0_FREE/KayKit_Space_Base_Bits_1.0_FREE/Assets/gltf/landingpad_large.gltf`,
    textures: ["colormap.png"],
    assetPack: "KayKit_Space_Base_Bits_1.0_FREE",
    buildCost: [
      { type: "gold", amount: 200 },
      { type: "iron", amount: 100 },
    ],
    buildTime: 25,
    health: 300,
    produces: [],
    description: "Allows air units to land, refuel, and rearm.",
  },

  // ── Research Center ─────────────────────────────────────────────────
  {
    id: "research_center",
    name: "Research Center",
    modelUrl: `${CDN}/environments/Free_Space_Colony_3D_Models/fbx/Research_center.fbx`,
    textures: ["diffuse.png"],
    assetPack: "Free_Space_Colony_3D_Models",
    buildCost: [
      { type: "gold", amount: 500 },
      { type: "crystal", amount: 250 },
    ],
    buildTime: 60,
    health: 500,
    produces: [],
    description: "Unlocks advanced tech tree upgrades: armor, weapons, speed, and abilities.",
  },

  // ── Warehouse ───────────────────────────────────────────────────────
  {
    id: "warehouse",
    name: "Warehouse",
    modelUrl: `${CDN}/environments/Free_Space_Colony_3D_Models/fbx/Resource_warehouse.fbx`,
    textures: ["diffuse.png"],
    assetPack: "Free_Space_Colony_3D_Models",
    buildCost: [
      { type: "gold", amount: 150 },
      { type: "iron", amount: 75 },
    ],
    buildTime: 20,
    health: 400,
    produces: [],
    description: "Increases resource storage capacity. Build more to stockpile for late game.",
  },

  // ── Farm ────────────────────────────────────────────────────────────
  {
    id: "farm",
    name: "Farm",
    modelUrl: `${CDN}/environments/Free_Space_Colony_3D_Models/fbx/Farm.fbx`,
    textures: ["diffuse.png"],
    assetPack: "Free_Space_Colony_3D_Models",
    buildCost: [
      { type: "gold", amount: 100 },
    ],
    buildTime: 15,
    health: 200,
    produces: [],
    generates: [{ type: "biomass", perMinute: 10 }],
    description: "Produces biomass for unit healing and population support.",
  },

  // ── Colonist Home ───────────────────────────────────────────────────
  {
    id: "colonist_home",
    name: "Colonist Home",
    modelUrl: `${CDN}/environments/Free_Space_Colony_3D_Models/fbx/Home_colonists.fbx`,
    textures: ["diffuse.png"],
    assetPack: "Free_Space_Colony_3D_Models",
    buildCost: [
      { type: "gold", amount: 100 },
      { type: "iron", amount: 50 },
    ],
    buildTime: 15,
    health: 200,
    produces: [],
    generates: [{ type: "gold", perMinute: 5 }],
    description: "Houses colonists. Each home increases population cap and generates tax income.",
  },

  // ── Solar Array ─────────────────────────────────────────────────────
  {
    id: "solar_array",
    name: "Solar Array",
    modelUrl: `${CDN}/environments/Free_Space_Colony_3D_Models/fbx/Solar_generator.fbx`,
    textures: ["diffuse.png"],
    assetPack: "Free_Space_Colony_3D_Models",
    buildCost: [
      { type: "gold", amount: 250 },
      { type: "crystal", amount: 100 },
    ],
    buildTime: 30,
    health: 300,
    produces: [],
    generates: [{ type: "energy", perMinute: 12 }],
    description: "Supplemental power generator. Cheaper than reactor but lower output.",
  },

  // ── Drill Station ──────────────────────────────────────────────────
  {
    id: "drill_station",
    name: "Drill Station",
    modelUrl: `${CDN}/environments/KayKit_Space_Base_Bits_1.0_FREE/KayKit_Space_Base_Bits_1.0_FREE/Assets/gltf/drill_structure.gltf`,
    textures: ["colormap.png"],
    assetPack: "KayKit_Space_Base_Bits_1.0_FREE",
    buildCost: [
      { type: "gold", amount: 300 },
      { type: "iron", amount: 150 },
    ],
    buildTime: 35,
    health: 400,
    produces: [],
    generates: [
      { type: "iron", perMinute: 8 },
      { type: "crystal", perMinute: 3 },
    ],
    description: "Automated mining drill. Extracts iron and crystal from terrain deposits.",
  },

  // ── Cargo Depot ─────────────────────────────────────────────────────
  {
    id: "cargo_depot",
    name: "Cargo Depot",
    modelUrl: `${CDN}/environments/KayKit_Space_Base_Bits_1.0_FREE/KayKit_Space_Base_Bits_1.0_FREE/Assets/gltf/cargodepot_A.gltf`,
    textures: ["colormap.png"],
    assetPack: "KayKit_Space_Base_Bits_1.0_FREE",
    buildCost: [
      { type: "gold", amount: 200 },
      { type: "iron", amount: 100 },
    ],
    buildTime: 25,
    health: 500,
    produces: [],
    description: "Serves as a drop-off point for harvested resources. Speeds up supply chain.",
  },

  // ═════════════════════════════════════════════════════════════════════════
  //  STARTER MINING VEHICLES — already rendering with spinning wheels,
  //  just needed economy wiring. Placed near command center at game start.
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: "sawmill" as BuildingId,
    name: "Sawmill",
    modelUrl: "/models/village_quaternius/Sawmill_saw.glb",
    textures: [],
    assetPack: "village_quaternius",
    buildCost: [],
    buildTime: 0,
    health: 300,
    produces: [],
    generates: [{ type: "biomass" as ResourceType, perMinute: 12 }],
    description: "Starter harvester. Spinning saw blade cuts wood and produces biomass. Free at game start.",
  },
  {
    id: "drill_rig" as BuildingId,
    name: "Drill Rig",
    modelUrl: "/models/rpg_tools/handdrill.glb",
    textures: [],
    assetPack: "rpg_tools",
    buildCost: [],
    buildTime: 0,
    health: 300,
    produces: [],
    generates: [
      { type: "iron" as ResourceType, perMinute: 6 },
      { type: "crystal" as ResourceType, perMinute: 2 },
    ],
    description: "Starter harvester. Spinning drill extracts iron and crystal from the ground. Free at game start.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  UNITS
// ═══════════════════════════════════════════════════════════════════════════

export const UNITS: ArmadaUnit[] = [
  // ── AW Infantry ─────────────────────────────────────────────────────
  {
    id: "aw_infantry",
    name: "AW Infantry",
    modelUrl: `${CDN}/units/advance_wars_infantry__mech_units/scene.gltf`,
    textures: ["scene.bin", "texture_diffuse.png"],
    assetPack: "advance_wars_infantry__mech_units",
    builtAt: "barracks",
    trainCost: [
      { type: "gold", amount: 50 },
    ],
    trainTime: 8,
    health: 50,
    armor: 2,
    damage: 10,
    attackRange: 2.5,
    attackCooldown: 1.0,
    speed: 3.5,
    detectionRange: 20,
    projectile: "none",
    abilities: [
      {
        id: "frag_grenade",
        name: "Frag Grenade",
        cooldown: 12,
        damage: 25,
        range: 8,
        aoe: 3,
        description: "Throws a fragmentation grenade dealing AoE damage.",
      },
    ],
    aiBehavior: "coordinated",
    canHarvest: false,
    scale: 1.0,
    targetHeight: 1.8,
    tint: "#5577aa",
    description: "Basic foot soldier. Cheap, fast to train, fights in squads.",
  },

  // ── AW Mech ─────────────────────────────────────────────────────────
  {
    id: "aw_mech",
    name: "AW Mech",
    modelUrl: `${CDN}/units/advance_wars_infantry__mech_units/scene.gltf`,
    textures: ["scene.bin", "texture_diffuse.png"],
    assetPack: "advance_wars_infantry__mech_units",
    builtAt: "mech_factory",
    trainCost: [
      { type: "gold", amount: 200 },
      { type: "iron", amount: 100 },
      { type: "alloy", amount: 50 },
    ],
    trainTime: 20,
    health: 140,
    armor: 8,
    damage: 22,
    attackRange: 3.5,
    attackCooldown: 1.8,
    speed: 2.5,
    detectionRange: 22,
    projectile: "missile",
    abilities: [
      {
        id: "rocket_barrage",
        name: "Rocket Barrage",
        cooldown: 18,
        damage: 40,
        range: 10,
        aoe: 4,
        description: "Fires a volley of rockets at a target area.",
      },
      {
        id: "stomp",
        name: "Ground Stomp",
        cooldown: 10,
        damage: 15,
        aoe: 5,
        effect: "slow",
        description: "Stomps the ground, slowing nearby enemies for 3s.",
      },
    ],
    aiBehavior: "defensive",
    canHarvest: false,
    scale: 1.6,
    targetHeight: 2.4,
    tint: "#886633",
    description: "Armored walker. Tough, slow, heavy firepower. Anti-infantry specialist.",
  },

  // ── AW Tank ─────────────────────────────────────────────────────────
  {
    id: "aw_tank",
    name: "AW Tank",
    modelUrl: `${CDN}/units/advance_wars_land_units/scene.gltf`,
    textures: ["scene.bin", "texture_diffuse.png"],
    assetPack: "advance_wars_land_units",
    builtAt: "vehicle_plant",
    trainCost: [
      { type: "gold", amount: 400 },
      { type: "iron", amount: 200 },
      { type: "oil", amount: 100 },
    ],
    trainTime: 35,
    health: 250,
    armor: 15,
    damage: 35,
    attackRange: 14,
    attackCooldown: 2.2,
    speed: 4.0,
    detectionRange: 28,
    projectile: "cannon_shell",
    abilities: [
      {
        id: "armor_piercing",
        name: "Armor Piercing Round",
        cooldown: 15,
        damage: 60,
        range: 16,
        description: "Fires a penetrating shell that ignores 50% of target armor.",
      },
      {
        id: "smoke_screen",
        name: "Smoke Screen",
        cooldown: 25,
        aoe: 8,
        effect: "stealth",
        description: "Deploys smoke, making nearby allies invisible for 5s.",
      },
    ],
    aiBehavior: "aggressive",
    canHarvest: false,
    scale: 2.0,
    targetHeight: 2.8,
    tint: "#556644",
    description: "Main battle tank. Long range cannon, heavy armor. Dominates open ground.",
  },

  // ── Mech Tripod (boss) ──────────────────────────────────────────────
  {
    id: "mech_tripod",
    name: "War Tripod",
    modelUrl: `${CDN}/units/mechs_tanks_vehicles_and_tripods/scene.gltf`,
    textures: ["scene.bin", "texture_diffuse.png"],
    assetPack: "mechs_tanks_vehicles_and_tripods",
    builtAt: "vehicle_plant",
    trainCost: [
      { type: "gold", amount: 1000 },
      { type: "alloy", amount: 500 },
      { type: "circuit", amount: 300 },
      { type: "energy", amount: 200 },
    ],
    trainTime: 90,
    health: 400,
    armor: 20,
    damage: 45,
    attackRange: 16,
    attackCooldown: 2.5,
    speed: 3.0,
    detectionRange: 35,
    projectile: "hadouken",
    abilities: [
      {
        id: "death_ray",
        name: "Death Ray",
        cooldown: 30,
        damage: 100,
        range: 20,
        description: "Channels a devastating beam for 3s dealing massive single-target damage.",
      },
      {
        id: "shockwave",
        name: "Shockwave",
        cooldown: 20,
        damage: 30,
        aoe: 10,
        effect: "knockback",
        description: "Releases a radial shockwave knocking back and damaging all nearby units.",
      },
      {
        id: "shield_generator",
        name: "Energy Shield",
        cooldown: 45,
        effect: "shield",
        description: "Generates a shield absorbing 150 damage for 8s.",
      },
    ],
    aiBehavior: "berserker",
    canHarvest: false,
    scale: 3.5,
    targetHeight: 4.5,
    tint: "#444455",
    description: "Massive siege walker. Ultimate weapon. Requires full tech tree to produce.",
  },

  // ── Sci-Fi Soldier ──────────────────────────────────────────────────
  {
    id: "scifi_soldier",
    name: "Sci-Fi Soldier",
    modelUrl: `${CDN}/units/futuristic_soldier_lowpoly/scene.gltf`,
    textures: ["scene.bin", "body_diffuse.png", "head_diffuse.png", "weapon_diffuse.png"],
    assetPack: "futuristic_soldier_lowpoly",
    builtAt: "barracks",
    trainCost: [
      { type: "gold", amount: 80 },
      { type: "iron", amount: 30 },
    ],
    trainTime: 10,
    health: 60,
    armor: 3,
    damage: 14,
    attackRange: 12,
    attackCooldown: 0.9,
    speed: 4.5,
    detectionRange: 24,
    projectile: "bullet",
    abilities: [
      {
        id: "burst_fire",
        name: "Burst Fire",
        cooldown: 8,
        damage: 30,
        range: 14,
        description: "Fires a 3-round burst for triple damage on a single target.",
      },
    ],
    aiBehavior: "coordinated",
    canHarvest: false,
    scale: 1.0,
    targetHeight: 1.85,
    tint: "#336699",
    description: "Ranged rifleman. Fast fire rate, good range. Core of any squad.",
  },

  // ── Cyborg ──────────────────────────────────────────────────────────
  {
    id: "cyborg_unit",
    name: "Cyborg",
    modelUrl: `${CDN}/units/cyborg/scene.gltf`,
    textures: ["scene.bin", "diffuse.jpeg"],
    assetPack: "cyborg",
    builtAt: "mech_factory",
    trainCost: [
      { type: "gold", amount: 350 },
      { type: "circuit", amount: 200 },
      { type: "alloy", amount: 100 },
    ],
    trainTime: 30,
    health: 180,
    armor: 10,
    damage: 28,
    attackRange: 14,
    attackCooldown: 1.2,
    speed: 5.0,
    detectionRange: 28,
    projectile: "plasma",
    abilities: [
      {
        id: "plasma_overcharge",
        name: "Plasma Overcharge",
        cooldown: 14,
        damage: 50,
        range: 16,
        aoe: 2,
        description: "Overcharges plasma cannon for a devastating shot with small AoE.",
      },
      {
        id: "nano_repair",
        name: "Nano Repair",
        cooldown: 20,
        effect: "heal",
        description: "Self-heals 40 HP over 5s using nanobots.",
      },
    ],
    aiBehavior: "aggressive",
    canHarvest: false,
    scale: 1.4,
    targetHeight: 2.2,
    tint: "#44cccc",
    description: "Elite cybernetic warrior. Fast, durable, self-healing. Anti-everything.",
  },

  // ── Cyborg Soldier ──────────────────────────────────────────────────
  {
    id: "cyborg_soldier",
    name: "Cyborg Soldier",
    modelUrl: `${CDN}/units/cyborg_soldier_scifi_character/scene.gltf`,
    textures: ["scene.bin", "diffuse.jpeg", "normal.png"],
    assetPack: "cyborg_soldier_scifi_character",
    builtAt: "mech_factory",
    trainCost: [
      { type: "gold", amount: 250 },
      { type: "circuit", amount: 150 },
    ],
    trainTime: 22,
    health: 150,
    armor: 7,
    damage: 24,
    attackRange: 13,
    attackCooldown: 1.4,
    speed: 4.0,
    detectionRange: 26,
    projectile: "plasma",
    abilities: [
      {
        id: "emp_blast",
        name: "EMP Blast",
        cooldown: 20,
        aoe: 6,
        effect: "disable",
        description: "Disables enemy vehicles and turrets for 4s in a radius.",
      },
    ],
    aiBehavior: "coordinated",
    canHarvest: false,
    scale: 1.2,
    targetHeight: 2.0,
    tint: "#6688aa",
    description: "Mid-tier cyborg. EMP specialist, shuts down vehicles and turrets.",
  },

  // ── Shadow Operative ────────────────────────────────────────────────
  {
    id: "shadow_soldier",
    name: "Shadow Operative",
    modelUrl: `${CDN}/units/call_of_duty_mw2r_-_shadow_company_soilders/scene.gltf`,
    textures: ["scene.bin"] ,
    assetPack: "call_of_duty_mw2r_-_shadow_company_soilders",
    builtAt: "barracks",
    trainCost: [
      { type: "gold", amount: 120 },
      { type: "iron", amount: 50 },
    ],
    trainTime: 12,
    health: 70,
    armor: 4,
    damage: 16,
    attackRange: 14,
    attackCooldown: 0.8,
    speed: 5.5,
    detectionRange: 26,
    projectile: "bullet",
    abilities: [
      {
        id: "cloak",
        name: "Active Camo",
        cooldown: 25,
        effect: "stealth",
        description: "Turns invisible for 6s. First attack from cloak deals 3x damage.",
      },
      {
        id: "c4_charge",
        name: "C4 Charge",
        cooldown: 18,
        damage: 60,
        range: 4,
        aoe: 4,
        description: "Plants a C4 explosive. Detonates on command dealing massive AoE.",
      },
    ],
    aiBehavior: "ambush",
    canHarvest: false,
    scale: 1.0,
    targetHeight: 1.85,
    tint: "#333344",
    description: "Special ops infiltrator. Cloaks, ambushes, plants explosives. Glass cannon.",
  },

  // ── Sci-Fi Trooper ──────────────────────────────────────────────────
  {
    id: "scifi_trooper",
    name: "Sci-Fi Trooper",
    modelUrl: `${CDN}/units/stylized_sci-_fi_soldier_animated/scene.gltf`,
    textures: ["scene.bin", "body.png", "head.png"],
    assetPack: "stylized_sci-_fi_soldier_animated",
    builtAt: "barracks",
    trainCost: [
      { type: "gold", amount: 40 },
    ],
    trainTime: 6,
    health: 55,
    armor: 2,
    damage: 12,
    attackRange: 12,
    attackCooldown: 1.0,
    speed: 4.0,
    detectionRange: 22,
    projectile: "bullet",
    abilities: [],
    aiBehavior: "patrol",
    canHarvest: true,
    harvestTypes: ["iron", "crystal"],
    harvestRate: 5,
    scale: 1.0,
    targetHeight: 1.8,
    tint: "#558866",
    description: "Cheapest ranged unit. Can harvest resources. Jack of all trades, master of none.",
  },

  // ── Sci-Fi Officer ──────────────────────────────────────────────────
  {
    id: "scifi_officer",
    name: "Sci-Fi Officer",
    modelUrl: `${CDN}/units/stylized_sci-fi_officer_with_gun_animated/scene.gltf`,
    textures: ["scene.bin", "body.jpeg", "head.png", "weapon.png"],
    assetPack: "stylized_sci-fi_officer_with_gun_animated",
    builtAt: "tech_lab",
    trainCost: [
      { type: "gold", amount: 180 },
      { type: "crystal", amount: 80 },
    ],
    trainTime: 18,
    health: 80,
    armor: 5,
    damage: 18,
    attackRange: 16,
    attackCooldown: 1.6,
    speed: 3.5,
    detectionRange: 28,
    projectile: "plasma",
    abilities: [
      {
        id: "rally_cry",
        name: "Rally Cry",
        cooldown: 30,
        aoe: 12,
        effect: "buff_damage",
        description: "Boosts damage of all nearby allies by 25% for 10s.",
      },
      {
        id: "tactical_scan",
        name: "Tactical Scan",
        cooldown: 20,
        range: 30,
        effect: "reveal",
        description: "Reveals all cloaked/hidden enemies in a large area for 8s.",
      },
    ],
    aiBehavior: "defensive",
    canHarvest: false,
    scale: 1.0,
    targetHeight: 1.9,
    tint: "#aa6633",
    description: "Support commander. Buffs allies, reveals stealth. Force multiplier.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  WEAPONS — turrets, attachable weapon models, deployable armaments
// ═══════════════════════════════════════════════════════════════════════════

export interface WeaponAsset {
  id: string;
  name: string;
  modelUrl: string;
  textures: string[];
  assetPack: string;
  /** Which unit can equip this as an upgrade (empty = building-only) */
  equippableBy: string[];
  /** Projectile this weapon fires */
  projectile: ProjectileType;
  damage: number;
  range: number;
  cooldown: number;
  description: string;
}

export const WEAPONS: WeaponAsset[] = [
  {
    id: "laser_turret_weapon",
    name: "Laser Turret",
    modelUrl: `${CDN}/weapons/laser_turret/scene.gltf`,
    textures: [
      "base_BAKED_baseColor.jpeg", "base_BAKED_metallicRoughness.png", "base_BAKED_normal.png",
      "body_-_wear_out_baseColor.jpeg", "body_-_wear_out_metallicRoughness.png", "body_-_wear_out_normal.png",
      "body_BAKED_baseColor.jpeg", "body_BAKED_metallicRoughness.png", "body_BAKED_normal.png",
      "body_details_BAKED_baseColor.jpeg", "body_details_BAKED_metallicRoughness.png", "body_details_BAKED_normal.png",
      "platform_details_BAKED_baseColor.jpeg", "platform_details_BAKED_metallicRoughness.png", "platform_details_BAKED_normal.png",
      "platform_main_BAKED_baseColor.jpeg", "platform_main_BAKED_metallicRoughness.png", "platform_main_BAKED_normal.png",
    ],
    assetPack: "laser_turret",
    equippableBy: ["aw_mech", "mech_tripod"],
    projectile: "laser",
    damage: 20,
    range: 18,
    cooldown: 1.5,
    description: "Full PBR laser turret. Can be mounted on mechs or placed as a static defense platform. High accuracy, instant-hit beam.",
  },
  {
    id: "turret_bud_weapon",
    name: "Turret Bud",
    modelUrl: `${CDN}/effects/turret_bud/scene.gltf`,
    textures: [],
    assetPack: "turret_bud",
    equippableBy: [],
    projectile: "bullet",
    damage: 8,
    range: 10,
    cooldown: 0.6,
    description: "Small deployable auto-turret. Fast fire rate, low damage. Deploy anywhere for area denial.",
  },
];

const _weaponMap = new Map<string, WeaponAsset>();
for (const w of WEAPONS) _weaponMap.set(w.id, w);

export function getWeapon(id: string): WeaponAsset | undefined {
  return _weaponMap.get(id);
}

/** All weapons equippable by a given unit. */
export function getWeaponsForUnit(unitId: string): WeaponAsset[] {
  return WEAPONS.filter((w) => w.equippableBy.includes(unitId));
}

// ═══════════════════════════════════════════════════════════════════════════
//  VEHICLES (air/space — not trainable yet, listed for future reference)
// ═══════════════════════════════════════════════════════════════════════════

export const VEHICLE_ASSETS = [
  { id: "bomber",      name: "Bomber",         folder: "vehicles/bomber",       assetPack: "bomber",       cdn: `${CDN}/vehicles/bomber` },
  { id: "carrier",     name: "Carrier",        folder: "vehicles/carrier",      assetPack: "carrier",      cdn: `${CDN}/vehicles/carrier` },
  { id: "fighter",     name: "Fighter",        folder: "vehicles/fighter",      assetPack: "fighter",      cdn: `${CDN}/vehicles/fighter` },
  { id: "spaceship",   name: "Spaceship Pack", folder: "vehicles/craftpix-net-307725-free-spaceship-3d-low-poly-models-pack", assetPack: "craftpix-net spaceships", cdn: `${CDN}/vehicles/craftpix-net-307725-free-spaceship-3d-low-poly-models-pack` },
  { id: "oil_pump",    name: "Oil Pumpjack",   folder: "vehicles/oil_pumpjack_-_animated", assetPack: "oil_pumpjack_-_animated", cdn: `${CDN}/vehicles/oil_pumpjack_-_animated` },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
//  EFFECTS (VFX assets)
// ═══════════════════════════════════════════════════════════════════════════

export const EFFECT_ASSETS = [
  { id: "horse_vfx",   name: "Horse VFX (mount effects)",     folder: "effects/FREE",        format: "glb",     cdn: `${CDN}/effects/FREE` },
  { id: "magic_vfx",   name: "Magic VFX (Godot shaders)",     folder: "effects/magicvfx",    format: "gdshader", cdn: `${CDN}/effects/magicvfx` },
  { id: "portal_vfx",  name: "Portal VFX",                    folder: "effects/portal",      format: "gdshader", cdn: `${CDN}/effects/portal` },
  { id: "toon_shade",  name: "Toon Shading",                  folder: "effects/toonshading",  format: "gdshader", cdn: `${CDN}/effects/toonshading` },
  { id: "turret_bud",  name: "Turret Bud (deployable turret)", folder: "effects/turret_bud", format: "gltf",    cdn: `${CDN}/effects/turret_bud` },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
//  LOOKUP HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const _unitMap = new Map<string, ArmadaUnit>();
for (const u of UNITS) _unitMap.set(u.id, u);

const _buildingMap = new Map<string, BuildingDefinition>();
for (const b of BUILDINGS) _buildingMap.set(b.id, b);

export function getUnit(id: string): ArmadaUnit | undefined {
  return _unitMap.get(id);
}

export function getBuilding(id: BuildingId): BuildingDefinition | undefined {
  return _buildingMap.get(id);
}

/** Which building produces a given unit? */
export function getBuildingForUnit(unitId: string): BuildingDefinition | undefined {
  const unit = _unitMap.get(unitId);
  if (!unit) return undefined;
  return _buildingMap.get(unit.builtAt);
}

/** All units a building can produce. */
export function getUnitsForBuilding(buildingId: BuildingId): ArmadaUnit[] {
  const bld = _buildingMap.get(buildingId);
  if (!bld) return [];
  return bld.produces.map((id) => _unitMap.get(id)).filter(Boolean) as ArmadaUnit[];
}

/** All buildings that generate a specific resource. */
export function getBuildingsGenerating(resource: ResourceType): BuildingDefinition[] {
  return BUILDINGS.filter((b) => b.generates?.some((g) => g.type === resource));
}

/** All units that can harvest. */
export function getHarvesters(): ArmadaUnit[] {
  return UNITS.filter((u) => u.canHarvest);
}

/** Total cost to build a building + train all its units once. */
export function getFullProductionCost(buildingId: BuildingId): ResourceCost[] {
  const bld = _buildingMap.get(buildingId);
  if (!bld) return [];
  const costs = new Map<ResourceType, number>();
  for (const c of bld.buildCost) costs.set(c.type, (costs.get(c.type) ?? 0) + c.amount);
  for (const uid of bld.produces) {
    const u = _unitMap.get(uid);
    if (u) for (const c of u.trainCost) costs.set(c.type, (costs.get(c.type) ?? 0) + c.amount);
  }
  return Array.from(costs.entries()).map(([type, amount]) => ({ type, amount }));
}
