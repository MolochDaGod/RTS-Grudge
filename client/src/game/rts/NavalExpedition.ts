/**
 * NavalExpedition — manages AI ship arrivals, coastal landings, crew
 * deployment, territory claiming, and automated camp establishment.
 *
 * Lifecycle:
 *   1. APPROACHING — ship spawns 30m offshore, holds for 2 minutes
 *   2. LANDING     — ship moves toward shore at crawl speed
 *   3. DEPLOYING   — ship hits land, spawns commander + 2-5 crew
 *   4. CLAIMING    — commander checks if the landing zone is unclaimed
 *   5. BUILDING    — if unclaimed, AICommander takes over and builds a camp
 *   6. HOSTILE     — if claimed by player, crew enters combat mode
 *
 * Multiple expeditions can be active simultaneously across different
 * islands/sectors. The system runs on a tick and is driven by the
 * world map epoch rotation — each sector refresh can spawn new
 * expeditions based on danger tier.
 */

import * as THREE from "three";
import { SHIP_TYPES, type Ship } from "../definitions/sailing";
import {
  HOME_SECTOR_DEFS,
  COMPASS_ORDER,
  sectorWorldOffset,
  currentEpochId,
  sectorSeed,
  type CompassDirection,
} from "../definitions/homeIslandWorldMap";

// ── Types ───────────────────────────────────────────────────────────────────

export type ExpeditionPhase =
  | "approaching"   // holding 30m offshore, 2-min countdown
  | "landing"       // moving toward shore
  | "deploying"     // hit land, spawning crew
  | "claiming"      // checking territory
  | "building"      // unclaimed — AI commander building camp
  | "hostile"       // claimed — crew fights
  | "defeated"      // all crew killed
  | "retreating";   // ship leaving after defeat

export type ExpeditionFaction = "crusade" | "legion" | "fabled" | "pirate" | "wild";

export interface ExpeditionCrew {
  id: string;
  type: "commander" | "soldier" | "archer" | "farmer";
  health: number;
  maxHealth: number;
  position: THREE.Vector3;
  alive: boolean;
}

export interface NavalExpedition {
  id: string;
  faction: ExpeditionFaction;
  phase: ExpeditionPhase;
  /** Ship tier (2-4 as spec'd) */
  shipTier: number;
  shipId: string;
  /** World position of the ship */
  shipPosition: THREE.Vector3;
  /** Direction the ship faces (toward shore) */
  shipHeading: number;
  /** Where the ship is trying to land */
  landingTarget: THREE.Vector3;
  /** Shore point where the ship will stop */
  shorePoint: THREE.Vector3;
  /** Timer: seconds remaining in current phase */
  phaseTimer: number;
  /** Crew members (spawned on DEPLOYING) */
  crew: ExpeditionCrew[];
  /** Total crew count (decided at spawn, deployed on landing) */
  crewCount: number;
  /** Whether the landing zone was claimed by the player */
  zoneClaimed: boolean;
  /** Sector this expedition targets (null = player's home island) */
  sector: CompassDirection | null;
  /** Epoch when this expedition was spawned */
  epochId: number;
  /** Seed for deterministic crew/faction rolls */
  seed: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Distance offshore where ships spawn */
const SPAWN_DISTANCE = 30;

/** Seconds the ship holds offshore before approaching */
const HOLD_TIME = 120; // 2 minutes

/** Ship approach speed in units/second */
const APPROACH_SPEED = 2.0;

/** Distance from shore at which the ship "lands" */
const LAND_THRESHOLD = 3.0;

/** Radius around the landing point that counts as "claimed" territory */
const CLAIM_RADIUS = 25;

/** How often the expedition spawner checks for new arrivals (ms) */
const SPAWN_CHECK_INTERVAL = 60_000;

// ── Seeded PRNG (matches homeIslandWorldMap) ────────────────────────────────

class SeededRNG {
  private state: number;
  constructor(seed: number) {
    this.state = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  }
  next(): number {
    this.state = (this.state * 16807) % 2147483647;
    return this.state / 2147483647;
  }
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}

// ── Expedition state ────────────────────────────────────────────────────────

let expeditions: NavalExpedition[] = [];
let expeditionIdCounter = 0;
let spawnTimer = 0;

// Callbacks for the 3D scene to react to expedition events
type ExpeditionListener = (event: ExpeditionEvent) => void;
let listeners: ExpeditionListener[] = [];

export interface ExpeditionEvent {
  type: "spawn" | "hold_complete" | "landed" | "crew_deployed" | "claiming" | "building" | "hostile" | "defeated" | "retreating";
  expeditionId: string;
  data?: Record<string, unknown>;
}

export function onExpeditionEvent(fn: ExpeditionListener): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

function emit(event: ExpeditionEvent): void {
  for (const fn of listeners) fn(event);
}

// ── Core API ────────────────────────────────────────────────────────────────

export function getExpeditions(): readonly NavalExpedition[] {
  return expeditions;
}

export function getExpedition(id: string): NavalExpedition | undefined {
  return expeditions.find(e => e.id === id);
}

/**
 * Spawn a new naval expedition targeting a specific shore point.
 * The ship appears SPAWN_DISTANCE meters offshore and begins its
 * 2-minute hold before approaching.
 */
export function spawnExpedition(opts: {
  shorePoint: THREE.Vector3;
  faction?: ExpeditionFaction;
  sector?: CompassDirection | null;
  seed?: number;
}): NavalExpedition {
  const seed = opts.seed ?? Math.floor(Math.random() * 2147483647);
  const rng = new SeededRNG(seed);

  const faction = opts.faction ?? rng.pick(["crusade", "legion", "fabled", "pirate", "wild"] as const);
  const shipTier = rng.int(2, 4);
  const shipKeys = Object.keys(SHIP_TYPES);
  // Map tier 2→skiff, 3→sloop, 4→brigantine
  const shipId = shipTier <= 2 ? "skiff" : shipTier === 3 ? "sloop" : "brigantine";
  const crewCount = rng.int(2, 5);

  // Position ship SPAWN_DISTANCE offshore, facing the shore
  const shoreFlat = new THREE.Vector2(opts.shorePoint.x, opts.shorePoint.z);
  const awayDir = shoreFlat.clone().normalize();
  if (awayDir.length() < 0.01) awayDir.set(1, 0); // fallback if shore is at origin
  const spawnPos = new THREE.Vector3(
    opts.shorePoint.x + awayDir.x * SPAWN_DISTANCE,
    0,
    opts.shorePoint.z + awayDir.y * SPAWN_DISTANCE,
  );
  const heading = Math.atan2(-awayDir.x, -awayDir.y); // face toward shore

  const expedition: NavalExpedition = {
    id: `exp_${++expeditionIdCounter}_${Date.now()}`,
    faction,
    phase: "approaching",
    shipTier,
    shipId,
    shipPosition: spawnPos,
    shipHeading: heading,
    landingTarget: opts.shorePoint.clone(),
    shorePoint: opts.shorePoint.clone(),
    phaseTimer: HOLD_TIME,
    crew: [],
    crewCount,
    zoneClaimed: false,
    sector: opts.sector ?? null,
    epochId: currentEpochId(),
    seed,
  };

  expeditions.push(expedition);
  emit({ type: "spawn", expeditionId: expedition.id, data: { faction, shipTier, crewCount } });
  return expedition;
}

/**
 * Check whether a point is within any player-claimed territory.
 * Territory is defined as CLAIM_RADIUS around any placed building.
 * Caller must provide the building positions (to avoid circular imports).
 */
export function isZoneClaimed(
  point: THREE.Vector3,
  buildingPositions: Array<[number, number, number]>,
): boolean {
  for (const bp of buildingPositions) {
    const dx = point.x - bp[0];
    const dz = point.z - bp[2];
    if (dx * dx + dz * dz < CLAIM_RADIUS * CLAIM_RADIUS) return true;
  }
  return false;
}

/**
 * Main tick — call every frame with delta time.
 * Advances all active expeditions through their lifecycle.
 */
export function updateExpeditions(
  delta: number,
  buildingPositions: Array<[number, number, number]>,
): void {
  for (const exp of expeditions) {
    switch (exp.phase) {
      // ── APPROACHING: countdown the 2-minute hold ──────────────────
      case "approaching": {
        exp.phaseTimer -= delta;
        if (exp.phaseTimer <= 0) {
          exp.phase = "landing";
          exp.phaseTimer = 0;
          emit({ type: "hold_complete", expeditionId: exp.id });
        }
        break;
      }

      // ── LANDING: move ship toward shore ───────────────────────────
      case "landing": {
        const toShore = new THREE.Vector3()
          .subVectors(exp.shorePoint, exp.shipPosition);
        toShore.y = 0;
        const dist = toShore.length();

        if (dist <= LAND_THRESHOLD) {
          exp.phase = "deploying";
          exp.shipPosition.copy(exp.shorePoint);
          emit({ type: "landed", expeditionId: exp.id });
        } else {
          const move = toShore.normalize().multiplyScalar(APPROACH_SPEED * delta);
          exp.shipPosition.add(move);
        }
        break;
      }

      // ── DEPLOYING: spawn commander + crew ─────────────────────────
      case "deploying": {
        const rng = new SeededRNG(exp.seed + 99);
        const crew: ExpeditionCrew[] = [];

        // Commander always spawns
        crew.push({
          id: `${exp.id}_commander`,
          type: "commander",
          health: 200,
          maxHealth: 200,
          position: exp.shorePoint.clone().add(new THREE.Vector3(0, 0, 2)),
          alive: true,
        });

        // Remaining crew: mix of soldiers, archers, farmers
        const crewTypes: ExpeditionCrew["type"][] = ["soldier", "archer", "farmer"];
        for (let i = 0; i < exp.crewCount; i++) {
          const type = rng.pick(crewTypes);
          const angle = ((i + 1) / (exp.crewCount + 1)) * Math.PI - Math.PI / 2;
          const offset = new THREE.Vector3(Math.cos(angle) * 4, 0, Math.sin(angle) * 4);
          crew.push({
            id: `${exp.id}_crew_${i}`,
            type,
            health: type === "soldier" ? 100 : type === "archer" ? 70 : 50,
            maxHealth: type === "soldier" ? 100 : type === "archer" ? 70 : 50,
            position: exp.shorePoint.clone().add(offset),
            alive: true,
          });
        }

        exp.crew = crew;
        exp.phase = "claiming";
        emit({ type: "crew_deployed", expeditionId: exp.id, data: { crewCount: crew.length } });
        break;
      }

      // ── CLAIMING: check if zone is free ───────────────────────────
      case "claiming": {
        const claimed = isZoneClaimed(exp.shorePoint, buildingPositions);
        exp.zoneClaimed = claimed;

        if (claimed) {
          exp.phase = "hostile";
          emit({ type: "hostile", expeditionId: exp.id, data: { faction: exp.faction } });
        } else {
          exp.phase = "building";
          emit({ type: "building", expeditionId: exp.id, data: { faction: exp.faction } });
        }
        break;
      }

      // ── BUILDING: AI camp construction (ticks handled by AICommander) ─
      case "building": {
        // The AICommander picks up this expedition's crew and builds
        // around the landing zone. This phase persists until the camp
        // is established or the crew is wiped out.
        const alive = exp.crew.filter(c => c.alive);
        if (alive.length === 0) {
          exp.phase = "defeated";
          emit({ type: "defeated", expeditionId: exp.id });
        }
        break;
      }

      // ── HOSTILE: crew fights player's forces ──────────────────────
      case "hostile": {
        const alive = exp.crew.filter(c => c.alive);
        if (alive.length === 0) {
          exp.phase = "defeated";
          exp.phaseTimer = 10; // ship lingers 10s then retreats
          emit({ type: "defeated", expeditionId: exp.id });
        }
        break;
      }

      // ── DEFEATED: ship retreats after delay ───────────────────────
      case "defeated": {
        exp.phaseTimer -= delta;
        if (exp.phaseTimer <= 0) {
          exp.phase = "retreating";
          emit({ type: "retreating", expeditionId: exp.id });
        }
        break;
      }

      // ── RETREATING: ship moves away from shore ────────────────────
      case "retreating": {
        const awayDir = new THREE.Vector3()
          .subVectors(exp.shipPosition, exp.shorePoint);
        awayDir.y = 0;
        if (awayDir.length() < 0.01) awayDir.set(1, 0, 0);
        awayDir.normalize();

        exp.shipPosition.add(awayDir.multiplyScalar(APPROACH_SPEED * 2 * delta));

        // Remove when far enough
        const dist = exp.shipPosition.distanceTo(exp.shorePoint);
        if (dist > SPAWN_DISTANCE * 2) {
          expeditions = expeditions.filter(e => e.id !== exp.id);
        }
        break;
      }
    }
  }
}

// ── Crew damage (called by combat system when player hits crew) ─────────────

export function damageExpeditionCrew(
  expeditionId: string,
  crewId: string,
  damage: number,
): boolean {
  const exp = expeditions.find(e => e.id === expeditionId);
  if (!exp) return false;
  const member = exp.crew.find(c => c.id === crewId);
  if (!member || !member.alive) return false;

  member.health = Math.max(0, member.health - damage);
  if (member.health <= 0) {
    member.alive = false;
    return true; // killed
  }
  return false;
}

// ── Auto-spawner: generates expeditions based on world state ────────────────

/**
 * Roll new expeditions for all sectors based on their danger tier.
 * Higher danger = higher chance of expedition per epoch.
 * Call this once per epoch rollover or on a slow timer.
 */
export function rollSectorExpeditions(playerGrudgeId: string): NavalExpedition[] {
  const epoch = currentEpochId();
  const spawned: NavalExpedition[] = [];

  for (const dir of COMPASS_ORDER) {
    const def = HOME_SECTOR_DEFS[dir];
    const seed = sectorSeed(playerGrudgeId, dir, epoch) + 7777;
    const rng = new SeededRNG(seed);

    // Chance scales with danger tier: T2=20%, T3=35%, T4=50%, T5=65%
    const chance = 0.05 + def.dangerTier * 0.15;
    if (rng.next() > chance) continue;

    // Already have an active expedition in this sector?
    const existing = expeditions.find(e => e.sector === dir && e.phase !== "retreating" && e.phase !== "defeated");
    if (existing) continue;

    // Pick a shore point in the sector
    const offset = sectorWorldOffset(dir);
    const shoreAngle = rng.next() * Math.PI * 2;
    const shoreRadius = 30 + rng.next() * 40;
    const shorePoint = new THREE.Vector3(
      offset.x + Math.cos(shoreAngle) * shoreRadius,
      0,
      offset.z + Math.sin(shoreAngle) * shoreRadius,
    );

    // Pick faction based on sector biome
    const factionPool: ExpeditionFaction[] =
      def.biomePool.includes("haunted") || def.biomePool.includes("undead") ? ["legion", "legion", "wild"] :
      def.biomePool.includes("volcanic") || def.biomePool.includes("obsidian") ? ["legion", "pirate"] :
      def.biomePool.includes("forest") || def.biomePool.includes("fey") ? ["fabled", "wild"] :
      def.biomePool.includes("tundra") || def.biomePool.includes("arctic") ? ["crusade", "legion"] :
      ["pirate", "crusade", "fabled"];

    const faction = rng.pick(factionPool);

    const exp = spawnExpedition({
      shorePoint,
      faction,
      sector: dir,
      seed,
    });
    spawned.push(exp);
  }

  return spawned;
}

/**
 * Spawn a random expedition at the player's home island shore.
 * Used for direct encounters on the chicken gun pirate map.
 */
export function spawnHomeIslandRaid(opts?: {
  faction?: ExpeditionFaction;
  shoreAngle?: number;
}): NavalExpedition {
  const angle = opts?.shoreAngle ?? Math.random() * Math.PI * 2;
  const shoreRadius = 70 + Math.random() * 15; // near the edge of the 80u build zone
  const shorePoint = new THREE.Vector3(
    Math.cos(angle) * shoreRadius,
    0,
    Math.sin(angle) * shoreRadius,
  );

  return spawnExpedition({
    shorePoint,
    faction: opts?.faction,
    sector: null,
  });
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

export function clearAllExpeditions(): void {
  expeditions = [];
}

export function removeExpedition(id: string): void {
  expeditions = expeditions.filter(e => e.id !== id);
}

export function getActiveExpeditionCount(): number {
  return expeditions.filter(e => e.phase !== "defeated" && e.phase !== "retreating").length;
}
