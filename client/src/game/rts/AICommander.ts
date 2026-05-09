/**
 * AICommander — automated base-building AI that evaluates the player's
 * settlement state and issues build/upgrade/deploy orders on a tick.
 *
 * Runs on a configurable interval (default 15s). Each tick it:
 *   1. Surveys placed buildings, resources, ally counts, and threats
 *   2. Scores unbuilt building types by priority
 *   3. Finds a valid placement position (grid-snapped, collision-free)
 *   4. Places the highest-priority affordable building
 *   5. Assigns ally patrol zones around resource buildings
 *   6. Upgrades existing buildings when surplus resources exist
 *
 * The commander can run fully autonomously or be throttled to only
 * suggest actions (for a "advisor" mode).
 */

import * as THREE from "three";
import {
  useBuildSystem,
  BUILDING_REGISTRY,
  getBuildingDef,
  BUILD_GRID_SIZE,
  BUILD_MIN_RADIUS,
  BUILD_MAX_RADIUS,
  type BuildingDef,
  type PlacedBuilding,
} from "@/lib/stores/useBuildSystem";
import { useAllies, type AllyData } from "@/lib/stores/useAllies";
import { useEnemyManager } from "../systems/EnemyManager";

// ── Configuration ───────────────────────────────────────────────────────────

export interface AICommanderConfig {
  /** Milliseconds between evaluation ticks */
  tickInterval: number;
  /** Whether the AI auto-places buildings or just suggests */
  autoPlace: boolean;
  /** Whether the AI auto-upgrades buildings */
  autoUpgrade: boolean;
  /** Whether the AI reassigns idle allies to patrol resource zones */
  autoAssignAllies: boolean;
  /** Minimum resource reserves the AI won't spend below */
  reserveWood: number;
  reserveStone: number;
  reserveGold: number;
  /** How aggressively the AI prioritises defense (0-1) */
  defenseBias: number;
}

const DEFAULT_CONFIG: AICommanderConfig = {
  tickInterval: 15000,
  autoPlace: true,
  autoUpgrade: true,
  autoAssignAllies: true,
  reserveWood: 50,
  reserveStone: 30,
  reserveGold: 10,
  defenseBias: 0.5,
};

// ── Priority scoring ────────────────────────────────────────────────────────

interface BuildCandidate {
  def: BuildingDef;
  score: number;
  reason: string;
}

function countBuildingsByCategory(
  buildings: PlacedBuilding[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const b of buildings) {
    const def = getBuildingDef(b.defId);
    if (!def) continue;
    counts[def.category] = (counts[def.category] || 0) + 1;
  }
  return counts;
}

function countAlliesByType(allies: AllyData[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of allies) {
    counts[a.type] = (counts[a.type] || 0) + 1;
  }
  return counts;
}

function scoreBuildCandidates(
  config: AICommanderConfig,
  buildings: PlacedBuilding[],
  allies: AllyData[],
  resources: { wood: number; stone: number; gold: number },
  unlockedBuildings: Set<string>,
  enemyThreat: number,
): BuildCandidate[] {
  const categoryCounts = countBuildingsByCategory(buildings);
  const allyCounts = countAlliesByType(allies);
  const totalBuildings = buildings.length;
  const candidates: BuildCandidate[] = [];

  for (const def of BUILDING_REGISTRY) {
    // Must be unlocked
    if (!unlockedBuildings.has(def.id)) continue;
    // Must be affordable (with reserves)
    const netWood = resources.wood - config.reserveWood;
    const netStone = resources.stone - config.reserveStone;
    const netGold = resources.gold - config.reserveGold;
    if (netWood < def.cost.wood || netStone < def.cost.stone || netGold < def.cost.gold) continue;
    // Skip upgrade-only entries (level > 1) — upgrades are handled separately
    if (def.level > 1) continue;

    let score = 0;
    let reason = "";

    const catCount = categoryCounts[def.category] || 0;

    // ── Economy: always need a baseline of resource buildings
    if (def.category === "economy") {
      if (catCount < 2) {
        score = 80;
        reason = "Need economy baseline";
      } else if (catCount < 5) {
        score = 50 - catCount * 5;
        reason = "Expand economy";
      } else {
        score = 10;
        reason = "Economy saturated";
      }
      // Bonus for camps that spawn farmers
      if (def.spawnAlly === "farmer" && (allyCounts["farmer"] || 0) < 4) {
        score += 20;
        reason = "Need more harvesters";
      }
    }

    // ── Defense: scale with threat level
    if (def.category === "defense") {
      const threatScore = enemyThreat * config.defenseBias * 40;
      if (catCount < 2) {
        score = 60 + threatScore;
        reason = "Need basic defenses";
      } else if (catCount < 4) {
        score = 30 + threatScore;
        reason = "Strengthen perimeter";
      } else {
        score = threatScore;
        reason = "Additional fortification";
      }
    }

    // ── Military: balance with economy
    if (def.category === "military") {
      const econCount = categoryCounts["economy"] || 0;
      if (catCount < 1 && econCount >= 2) {
        score = 70;
        reason = "Need military presence";
      } else if (catCount < 3 && econCount >= 3) {
        score = 45;
        reason = "Grow army";
      } else {
        score = 15;
        reason = "Military expansion";
      }
      // Bonus if we have few combat allies
      const combatAllies = (allyCounts["soldier"] || 0) + (allyCounts["archer"] || 0) +
        (allyCounts["knight"] || 0) + (allyCounts["warrior"] || 0);
      if (combatAllies < 4) {
        score += 25;
        reason = "Critically low defenders";
      }
    }

    // ── Housing: need to support population
    if (def.category === "housing") {
      const housingCount = catCount;
      if (housingCount < 2 && totalBuildings >= 4) {
        score = 40;
        reason = "Need housing";
      } else if (housingCount < 4 && totalBuildings >= 8) {
        score = 25;
        reason = "Expand housing";
      } else {
        score = 5;
        reason = "Housing surplus";
      }
    }

    // ── Special: high value but low urgency
    if (def.category === "special") {
      if (def.id.startsWith("towncenter") && catCount === 0 && totalBuildings >= 6) {
        score = 90;
        reason = "Town center unlocks Second Age";
      } else if (def.id.startsWith("temple") && catCount === 0 && totalBuildings >= 8) {
        score = 55;
        reason = "Temple unlocks healing";
      } else {
        score = 5;
        reason = "Low priority special";
      }
    }

    if (score > 0) {
      candidates.push({ def, score, reason });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

// ── Placement search ────────────────────────────────────────────────────────

/**
 * Spiral outward from a center point to find a valid grid-snapped
 * placement position that doesn't collide with existing buildings.
 */
function findPlacementPosition(
  center: THREE.Vector3,
  def: BuildingDef,
  rotation: number,
  placedBuildings: PlacedBuilding[],
): [number, number, number] | null {
  const { snapToGrid } = useBuildSystem.getState();

  // Spiral search: try positions in expanding rings
  for (let ring = 1; ring <= 20; ring++) {
    const dist = ring * BUILD_GRID_SIZE * 2;
    const steps = ring * 8;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const rawX = center.x + Math.cos(angle) * dist;
      const rawZ = center.z + Math.sin(angle) * dist;
      const [sx, sz] = snapToGrid(rawX, rawZ);
      const candidatePos: [number, number, number] = [sx, 0, sz];

      // Check zone bounds
      const d = Math.sqrt(sx * sx + sz * sz);
      if (d < BUILD_MIN_RADIUS || d > BUILD_MAX_RADIUS) continue;

      // Check collision
      let overlap = false;
      const hw = def.size[0] / 2;
      const hd = def.size[1] / 2;
      for (const placed of placedBuildings) {
        const pDef = getBuildingDef(placed.defId);
        if (!pDef) continue;
        const phw = pDef.size[0] / 2;
        const phd = pDef.size[1] / 2;
        if (
          sx - hw < placed.position[0] + phw &&
          sx + hw > placed.position[0] - phw &&
          sz - hd < placed.position[2] + phd &&
          sz + hd > placed.position[2] - phd
        ) {
          overlap = true;
          break;
        }
      }
      if (!overlap) return candidatePos;
    }
  }
  return null;
}

// ── Ally assignment ─────────────────────────────────────────────────────────

/**
 * Reassign idle/patrol allies to guard resource buildings that have no
 * nearby defenders, and send harvesters toward economy buildings.
 */
function reassignAllies(
  buildings: PlacedBuilding[],
  allies: AllyData[],
): void {
  const alliesStore = useAllies.getState();

  // Find economy buildings with spawned resources but no nearby harvesters
  for (const b of buildings) {
    const def = getBuildingDef(b.defId);
    if (!def || !def.spawnResources || def.spawnResources.length === 0) continue;

    const buildingPos = new THREE.Vector3(b.position[0], 0, b.position[2]);
    const nearbyHarvesters = allies.filter(
      (a) => a.canHarvest && a.position.distanceTo(buildingPos) < 15,
    );

    if (nearbyHarvesters.length > 0) continue;

    // Find an idle harvester to send here
    const idleHarvester = allies.find(
      (a) =>
        a.canHarvest &&
        a.behavior === "idle" &&
        !a.personalCommand &&
        a.position.distanceTo(buildingPos) < 50,
    );
    if (idleHarvester) {
      alliesStore.setPersonalCommand(idleHarvester.id, "patrol");
      alliesStore.setHomePosition(idleHarvester.id, buildingPos);
    }
  }

  // Find defense buildings with no nearby combat allies
  for (const b of buildings) {
    const def = getBuildingDef(b.defId);
    if (!def || def.category !== "defense") continue;

    const buildingPos = new THREE.Vector3(b.position[0], 0, b.position[2]);
    const nearbyDefenders = allies.filter(
      (a) =>
        !a.canHarvest &&
        a.projectileType !== "none" &&
        a.position.distanceTo(buildingPos) < 12,
    );

    if (nearbyDefenders.length > 0) continue;

    // Find an idle ranged ally to garrison
    const idleArcher = allies.find(
      (a) =>
        a.projectileType !== "none" &&
        (a.behavior === "patrol" || a.behavior === "idle") &&
        !a.personalCommand &&
        a.position.distanceTo(buildingPos) < 40,
    );
    if (idleArcher) {
      alliesStore.setPersonalCommand(idleArcher.id, "stay");
      alliesStore.setHomePosition(idleArcher.id, buildingPos);
    }
  }
}

// ── Upgrade logic ───────────────────────────────────────────────────────────

function tryUpgradeBuildings(
  config: AICommanderConfig,
  buildings: PlacedBuilding[],
  resources: { wood: number; stone: number; gold: number },
): void {
  const bs = useBuildSystem.getState();

  // Only upgrade if we have surplus above reserves
  const surplus = {
    wood: resources.wood - config.reserveWood * 2,
    stone: resources.stone - config.reserveStone * 2,
    gold: resources.gold - config.reserveGold * 2,
  };
  if (surplus.wood < 0 || surplus.stone < 0 || surplus.gold < 0) return;

  // Priority: upgrade defense > military > economy > housing
  const priorityOrder = ["defense", "military", "economy", "housing", "special"];

  for (const cat of priorityOrder) {
    for (const b of buildings) {
      const def = getBuildingDef(b.defId);
      if (!def || def.category !== cat) continue;
      if (b.level >= def.maxLevel) continue;

      const upgradeCost = {
        wood: def.cost.wood * 1.5,
        stone: def.cost.stone * 1.5,
        gold: def.cost.gold * 1.5,
      };
      if (
        surplus.wood >= upgradeCost.wood &&
        surplus.stone >= upgradeCost.stone &&
        surplus.gold >= upgradeCost.gold
      ) {
        bs.upgradeBuilding(b.uid);
        return; // One upgrade per tick
      }
    }
  }
}

// ── Main tick ───────────────────────────────────────────────────────────────

export interface AITickResult {
  action: "idle" | "build" | "upgrade" | "assign" | "defend";
  buildingId?: string;
  position?: [number, number, number];
  reason: string;
  score?: number;
}

export function runAITick(config: AICommanderConfig = DEFAULT_CONFIG): AITickResult {
  const bs = useBuildSystem.getState();
  const { placedBuildings, resources, unlockedBuildings } = bs;
  const allies = useAllies.getState().allies;
  const enemies = useEnemyManager.getState().enemies;

  // Calculate threat level (0-1) based on active enemy count and proximity
  const aliveEnemies = enemies.filter((e) => !e.isDying);
  const enemyThreat = Math.min(1, aliveEnemies.length / 15);

  // 1. Score candidates
  const candidates = scoreBuildCandidates(
    config,
    placedBuildings,
    allies,
    resources,
    unlockedBuildings,
    enemyThreat,
  );

  // 2. Try to place the top candidate
  if (config.autoPlace && candidates.length > 0) {
    const top = candidates[0];
    const center = new THREE.Vector3(0, 0, 0);

    // Place near existing buildings if we have any, otherwise near origin
    if (placedBuildings.length > 0) {
      const last = placedBuildings[placedBuildings.length - 1];
      center.set(last.position[0], 0, last.position[2]);
    }

    const pos = findPlacementPosition(
      center,
      top.def,
      0,
      placedBuildings,
    );

    if (pos) {
      // Set ghost and place
      bs.selectBuilding(top.def.id);
      bs.setGhostPosition(pos);
      const placed = bs.placeBuilding();
      bs.selectBuilding(null);

      if (placed) {
        // Spawn allies if the building definition calls for it
        const allBuildings = useBuildSystem.getState().placedBuildings;
        const justPlaced = allBuildings[allBuildings.length - 1];
        if (justPlaced && top.def.spawnAlly && top.def.allyCount) {
          const spawnCenter = new THREE.Vector3(pos[0], pos[1], pos[2]);
          useAllies.getState().spawnAllies(
            top.def.spawnAlly as any,
            top.def.allyCount,
            spawnCenter,
            10,
            justPlaced.uid,
          );
        }

        return {
          action: "build",
          buildingId: top.def.id,
          position: pos,
          reason: top.reason,
          score: top.score,
        };
      }
    }
  }

  // 3. Try upgrades
  if (config.autoUpgrade) {
    const preCount = placedBuildings.reduce((s, b) => s + b.level, 0);
    tryUpgradeBuildings(config, placedBuildings, resources);
    const postCount = useBuildSystem.getState().placedBuildings.reduce((s, b) => s + b.level, 0);
    if (postCount > preCount) {
      return { action: "upgrade", reason: "Upgraded building" };
    }
  }

  // 4. Reassign allies
  if (config.autoAssignAllies) {
    reassignAllies(placedBuildings, allies);
    return { action: "assign", reason: "Ally deployment adjusted" };
  }

  return { action: "idle", reason: "No action needed" };
}

// ── Interval runner ─────────────────────────────────────────────────────────

let _interval: ReturnType<typeof setInterval> | null = null;
let _config: AICommanderConfig = { ...DEFAULT_CONFIG };
let _lastResult: AITickResult = { action: "idle", reason: "Not started" };

export function startAICommander(config?: Partial<AICommanderConfig>): void {
  if (_interval) clearInterval(_interval);
  _config = { ...DEFAULT_CONFIG, ...config };
  _lastResult = { action: "idle", reason: "Starting..." };
  _interval = setInterval(() => {
    _lastResult = runAITick(_config);
  }, _config.tickInterval);
  // Run first tick immediately
  _lastResult = runAITick(_config);
}

export function stopAICommander(): void {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }
}

export function getAICommanderConfig(): AICommanderConfig {
  return { ..._config };
}

export function updateAICommanderConfig(patch: Partial<AICommanderConfig>): void {
  _config = { ..._config, ...patch };
}

export function getLastAIResult(): AITickResult {
  return _lastResult;
}

export function isAICommanderRunning(): boolean {
  return _interval !== null;
}
