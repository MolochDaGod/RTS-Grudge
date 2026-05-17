/**
 * UnitRegistry — Centralized unit definitions for the Advance Wars / sci-fi
 * unit packs deployed to Grudge object storage (assets.grudge-studio.com).
 *
 * Each entry carries:
 *  - CDN model path (scene.gltf served from R2)
 *  - Combat stats (health, damage, speed, etc.)
 *  - Render config (scale, height, tint, isMonster flag)
 *  - AI behavior profile for the BehaviorTree
 *  - RTS role classification (infantry, mech, vehicle, support)
 *
 * The EnemyManager, Enemy component, BiomeSpawnRegistry, and WaveSpawner
 * all consume this registry so there is a single source of truth.
 */

import type { EnemyTier } from "./EnemyManager";
import type { AIBehaviorProfile } from "../islands/TrainingIslandRegistry";

// ---------------------------------------------------------------------------
// CDN base — all organized assets live under this R2 bucket prefix.
// ---------------------------------------------------------------------------
export const UNIT_CDN_BASE = "https://assets.grudge-studio.com/grudge-armada";

// ---------------------------------------------------------------------------
// RTS role — drives formation logic and AI squad composition.
// ---------------------------------------------------------------------------
export type RTSRole = "infantry" | "mech" | "vehicle" | "support" | "elite" | "boss";

// ---------------------------------------------------------------------------
// Unit definition
// ---------------------------------------------------------------------------
export interface UnitDefinition {
  /** Unique key — must match the EnemyType string added to EnemyManager. */
  id: string;
  /** Human-readable name shown in HUD / combat log. */
  name: string;
  /** Full CDN URL to the scene.gltf (or .glb). */
  modelUrl: string;
  /** RTS role. */
  role: RTSRole;

  // --- Combat stats ---
  health: number;
  damage: number;
  speed: number;
  attackCooldown: number;
  detectionRange: number;
  attackRange: number;
  tier: EnemyTier;
  xpReward: number;

  // --- Render config ---
  scale: number;
  targetHeight: number;
  tint: string | null;
  /** true = simple GLB with no humanoid rig — skip combat layer. */
  isMonster: boolean;
  color: string;

  // --- AI ---
  behaviorProfile: AIBehaviorProfile;
}

// ---------------------------------------------------------------------------
// Unit catalog — one entry per new unit type from the organized folder.
// ---------------------------------------------------------------------------
export const UNIT_DEFINITIONS: UnitDefinition[] = [
  // ── Advance Wars Infantry & Mech (the pack's namesake) ──────────────
  {
    id: "aw_infantry",
    name: "AW Infantry",
    modelUrl: `${UNIT_CDN_BASE}/units/advance_wars_infantry__mech_units/scene.gltf`,
    role: "infantry",
    health: 50,
    damage: 10,
    speed: 3.5,
    attackCooldown: 1.0,
    detectionRange: 20,
    attackRange: 2.5,
    tier: "common",
    xpReward: 15,
    scale: 1.0,
    targetHeight: 1.8,
    tint: "#5577aa",
    isMonster: true,
    color: "#5577aa",
    behaviorProfile: "coordinated",
  },
  {
    id: "aw_mech",
    name: "AW Mech",
    modelUrl: `${UNIT_CDN_BASE}/units/advance_wars_infantry__mech_units/scene.gltf`,
    role: "mech",
    health: 140,
    damage: 22,
    speed: 2.5,
    attackCooldown: 1.8,
    detectionRange: 22,
    attackRange: 3.5,
    tier: "rare",
    xpReward: 55,
    scale: 1.6,
    targetHeight: 2.4,
    tint: "#886633",
    isMonster: true,
    color: "#886633",
    behaviorProfile: "defensive",
  },

  // ── Advance Wars Land Units (tanks / APCs) ──────────────────────────
  {
    id: "aw_tank",
    name: "AW Tank",
    modelUrl: `${UNIT_CDN_BASE}/units/advance_wars_land_units/scene.gltf`,
    role: "vehicle",
    health: 250,
    damage: 35,
    speed: 4.0,
    attackCooldown: 2.2,
    detectionRange: 28,
    attackRange: 14,
    tier: "elite",
    xpReward: 100,
    scale: 2.0,
    targetHeight: 2.8,
    tint: "#556644",
    isMonster: true,
    color: "#556644",
    behaviorProfile: "aggressive",
  },

  // ── Mechs, Tanks, Vehicles & Tripods ────────────────────────────────
  {
    id: "mech_tripod",
    name: "War Tripod",
    modelUrl: `${UNIT_CDN_BASE}/units/mechs_tanks_vehicles_and_tripods/scene.gltf`,
    role: "boss",
    health: 400,
    damage: 45,
    speed: 3.0,
    attackCooldown: 2.5,
    detectionRange: 35,
    attackRange: 16,
    tier: "boss",
    xpReward: 220,
    scale: 3.5,
    targetHeight: 4.5,
    tint: "#444455",
    isMonster: true,
    color: "#444455",
    behaviorProfile: "berserker",
  },

  // ── Futuristic Soldier (lowpoly) ────────────────────────────────────
  {
    id: "scifi_soldier",
    name: "Sci-Fi Soldier",
    modelUrl: `${UNIT_CDN_BASE}/units/futuristic_soldier_lowpoly/scene.gltf`,
    role: "infantry",
    health: 60,
    damage: 14,
    speed: 4.5,
    attackCooldown: 0.9,
    detectionRange: 24,
    attackRange: 12,
    tier: "uncommon",
    xpReward: 25,
    scale: 1.0,
    targetHeight: 1.85,
    tint: "#336699",
    isMonster: true,
    color: "#336699",
    behaviorProfile: "coordinated",
  },

  // ── Cyborg ──────────────────────────────────────────────────────────
  {
    id: "cyborg_unit",
    name: "Cyborg",
    modelUrl: `${UNIT_CDN_BASE}/units/cyborg/scene.gltf`,
    role: "elite",
    health: 180,
    damage: 28,
    speed: 5.0,
    attackCooldown: 1.2,
    detectionRange: 28,
    attackRange: 14,
    tier: "elite",
    xpReward: 85,
    scale: 1.4,
    targetHeight: 2.2,
    tint: "#44cccc",
    isMonster: true,
    color: "#44cccc",
    behaviorProfile: "aggressive",
  },

  // ── Cyborg Soldier (sci-fi character) ───────────────────────────────
  {
    id: "cyborg_soldier",
    name: "Cyborg Soldier",
    modelUrl: `${UNIT_CDN_BASE}/units/cyborg_soldier_scifi_character/scene.gltf`,
    role: "elite",
    health: 150,
    damage: 24,
    speed: 4.0,
    attackCooldown: 1.4,
    detectionRange: 26,
    attackRange: 13,
    tier: "rare",
    xpReward: 65,
    scale: 1.2,
    targetHeight: 2.0,
    tint: "#6688aa",
    isMonster: true,
    color: "#6688aa",
    behaviorProfile: "coordinated",
  },

  // ── Call of Duty Shadow Company soldiers ────────────────────────────
  {
    id: "shadow_soldier",
    name: "Shadow Operative",
    modelUrl: `${UNIT_CDN_BASE}/units/call_of_duty_mw2r_-_shadow_company_soilders/scene.gltf`,
    role: "infantry",
    health: 70,
    damage: 16,
    speed: 5.5,
    attackCooldown: 0.8,
    detectionRange: 26,
    attackRange: 14,
    tier: "uncommon",
    xpReward: 30,
    scale: 1.0,
    targetHeight: 1.85,
    tint: "#333344",
    isMonster: true,
    color: "#333344",
    behaviorProfile: "ambush",
  },

  // ── Stylized Sci-Fi Soldier (animated) ──────────────────────────────
  {
    id: "scifi_trooper",
    name: "Sci-Fi Trooper",
    modelUrl: `${UNIT_CDN_BASE}/units/stylized_sci-_fi_soldier_animated/scene.gltf`,
    role: "infantry",
    health: 55,
    damage: 12,
    speed: 4.0,
    attackCooldown: 1.0,
    detectionRange: 22,
    attackRange: 12,
    tier: "common",
    xpReward: 20,
    scale: 1.0,
    targetHeight: 1.8,
    tint: "#558866",
    isMonster: true,
    color: "#558866",
    behaviorProfile: "patrol",
  },

  // ── Stylized Sci-Fi Officer (animated, with gun) ────────────────────
  {
    id: "scifi_officer",
    name: "Sci-Fi Officer",
    modelUrl: `${UNIT_CDN_BASE}/units/stylized_sci-fi_officer_with_gun_animated/scene.gltf`,
    role: "support",
    health: 80,
    damage: 18,
    speed: 3.5,
    attackCooldown: 1.6,
    detectionRange: 28,
    attackRange: 16,
    tier: "rare",
    xpReward: 45,
    scale: 1.0,
    targetHeight: 1.9,
    tint: "#aa6633",
    isMonster: true,
    color: "#aa6633",
    behaviorProfile: "defensive",
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------
const _byId = new Map<string, UnitDefinition>();
for (const u of UNIT_DEFINITIONS) _byId.set(u.id, u);

export function getUnitDef(id: string): UnitDefinition | undefined {
  return _byId.get(id);
}

export function getUnitsByRole(role: RTSRole): UnitDefinition[] {
  return UNIT_DEFINITIONS.filter((u) => u.role === role);
}

export function getUnitsByTier(tier: EnemyTier): UnitDefinition[] {
  return UNIT_DEFINITIONS.filter((u) => u.tier === tier);
}

/** All unit IDs as a string union array — used to extend EnemyType. */
export function getAllUnitIds(): string[] {
  return UNIT_DEFINITIONS.map((u) => u.id);
}
