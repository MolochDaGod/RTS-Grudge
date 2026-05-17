import { create } from "zustand";
import * as THREE from "three";
import type { WeaponType } from "@/lib/stores/useGame";

export type AllyType = "soldier" | "archer" | "knight" | "elite_archer" | "farmer" | "warrior" | "ranger" | "mage" | "wizard" | "captain";

export type AllyBehavior = "idle" | "patrol" | "combat" | "harvest" | "return_to_camp" | "follow" | "sleep" | "go_home" | "craft" | "defend";

export type AllyCommand = "follow" | "patrol" | "stay" | "attack_target";

export type AllyProfession = "Soldier" | "Archer" | "Farmer" | "Mage" | "Knight" | "Captain" | "Worker";

const TYPE_TO_PROFESSION: Record<AllyType, AllyProfession> = {
  soldier: "Soldier", warrior: "Soldier", knight: "Knight",
  archer: "Archer", elite_archer: "Archer", ranger: "Archer",
  farmer: "Farmer",
  mage: "Mage", wizard: "Mage",
  captain: "Captain",
};

const FIRST_NAMES = [
  "Aldric", "Brena", "Caspian", "Dara", "Elwin", "Fenra", "Gareth", "Hilda",
  "Ivor", "Jocelyn", "Kenric", "Lirien", "Magnus", "Nessa", "Oren", "Petra",
  "Quill", "Rowan", "Sigrun", "Torin", "Una", "Valen", "Wren", "Yarrow",
];

function randomAllyName(): string {
  return FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
}

// Level 1-100. XP curve: 50 * level^1.6 (gentle quadratic). Cap at 100.
export const MAX_ALLY_LEVEL = 100;
export function xpForNextLevel(level: number): number {
  if (level >= MAX_ALLY_LEVEL) return Infinity;
  return Math.round(50 * Math.pow(level, 1.6));
}

export const ALLY_COMMAND_LABELS: Record<AllyCommand, string> = {
  follow: "Follow Me",
  patrol: "Patrol Area",
  stay: "Hold Position",
  attack_target: "Attack Target",
};

export const ALLY_COMMAND_KEYS: Record<string, AllyCommand> = {
  F1: "follow",
  F2: "patrol",
  F3: "stay",
  F4: "attack_target",
};

export const ALLY_COMMAND_ICONS: Record<AllyCommand, string> = {
  follow: "🚶",
  patrol: "🔄",
  stay: "🛑",
  attack_target: "⚔",
};

export interface AllyData {
  id: string; // UUID v4 (crypto.randomUUID)
  name: string;
  type: AllyType;
  profession: AllyProfession;
  level: number; // 1-100
  xp: number;
  xpToNext: number;
  position: THREE.Vector3;
  health: number;
  maxHealth: number;
  patrolCenter: THREE.Vector3;
  patrolRadius: number;
  homePosition: THREE.Vector3; // tent/home — defaults to patrolCenter
  damage: number;
  attackRange: number;
  speed: number;
  modelPath: string;
  targetHeight: number;
  /** Weapon type drives which BRB animation pack loads on the NPC controller. */
  weaponType?: WeaponType;
  /** Extra animation packs (e.g. 'farming' for farmer NPCs). */
  extraPacks?: string[];
  /** Faction origin — determines color coding and assignment. */
  faction?: "crusade" | "fabled" | "legion" | "wild";
  spawnedBy: string;
  behavior: AllyBehavior;
  assignedBuildingUid: string | null;  // building this ally is assigned to
  personalCommand: AllyCommand | null; // null = obey global; otherwise overrides
  personalTargetId: string | null;     // per-ally target for "attack_target"
  canHarvest: boolean;
  harvestSpeed: number;
  buffRadius: number;
  buffDamage: number;
  projectileType: "none" | "arrow" | "fireball" | "lightning";
  isSleeping: boolean;
  kills: number;
  resourcesGathered: number;
}

type AllyConfig = Omit<
  AllyData,
  | "id" | "name" | "profession" | "level" | "xp" | "xpToNext"
  | "position" | "patrolCenter" | "patrolRadius" | "homePosition"
  | "spawnedBy" | "assignedBuildingUid" | "personalCommand" | "personalTargetId"
  | "isSleeping" | "kills" | "resourcesGathered"
>;

// ─────────────────────────────────────────────────────────────────────────────
// Faction-correct character model paths
// Crusade  = Human (assassin-*) + Barbarian (human_battle_mage-*)
// Fabled   = Elf (elf-*) + Dwarf (dwarf-*)
// Legion   = Orc (orc_scout-*) + Undead (vampire_aristocrat-*)
// Wild     = Worge / Barbarian forms
// When grudge6 CDN models are uploaded these paths are overridden per faction.
// ─────────────────────────────────────────────────────────────────────────────

const ALLY_CONFIGS: Record<AllyType, AllyConfig> = {
  // ── soldier: Crusade human frontline (sword+shield) ──────────────────────
  soldier: {
    type: "soldier",
    health: 80,
    maxHealth: 80,
    damage: 12,
    attackRange: 2.5,
    speed: 3,
    // Human Crusade soldier — hooded duelist stand-in until WK_ GLB is on CDN
    modelPath: "/models/characters/assassin-male.glb",
    targetHeight: 1.85,
    faction: "crusade",
    weaponType: "sword",
    behavior: "patrol",
    canHarvest: false,
    harvestSpeed: 0,
    buffRadius: 0,
    buffDamage: 0,
    projectileType: "none",
  },
  // ── archer: Fabled elf ranged (bow) ──────────────────────────────────────
  archer: {
    type: "archer",
    health: 50,
    maxHealth: 50,
    damage: 15,
    attackRange: 12,
    speed: 2.5,
    // Elf archer — correct race for the Fabled faction
    modelPath: "/models/characters/elf-male.glb",
    targetHeight: 1.85,
    faction: "fabled",
    weaponType: "bow",
    behavior: "patrol",
    canHarvest: false,
    harvestSpeed: 0,
    buffRadius: 0,
    buffDamage: 0,
    projectileType: "arrow",
  },
  // ── knight: Crusade heavy armored melee (sword) ──────────────────────────
  knight: {
    type: "knight",
    health: 150,
    maxHealth: 150,
    damage: 20,
    attackRange: 2.5,
    speed: 2.5,
    // Grave knight — armored plate, correct for the tank knight archetype
    modelPath: "/models/characters/undead_grave_knight-male.glb",
    targetHeight: 1.9,
    faction: "crusade",
    weaponType: "sword",
    behavior: "patrol",
    canHarvest: false,
    harvestSpeed: 0,
    buffRadius: 0,
    buffDamage: 0,
    projectileType: "none",
  },
  // ── elite_archer: Fabled elf precision ranger (bow) ──────────────────────
  elite_archer: {
    type: "elite_archer",
    health: 70,
    maxHealth: 70,
    damage: 25,
    attackRange: 18,
    speed: 3,
    // Elf female — faster, lighter, elite ranger role
    modelPath: "/models/characters/elf-female.glb",
    targetHeight: 1.8,
    faction: "fabled",
    weaponType: "bow",
    behavior: "patrol",
    canHarvest: false,
    harvestSpeed: 0,
    buffRadius: 0,
    buffDamage: 0,
    projectileType: "arrow",
  },
  // ── farmer: Crusade civilian gatherer (no weapon — uses farming animations) ─
  farmer: {
    type: "farmer",
    health: 40,
    maxHealth: 40,
    damage: 4,
    attackRange: 1.5,
    speed: 2,
    // Human commoner, non-combat role
    modelPath: "/models/characters/human_battle_mage-male.glb",
    targetHeight: 1.85,
    faction: "crusade",
    // No weaponType — farming animations via extraPacks
    extraPacks: ["farming"],
    behavior: "harvest",
    canHarvest: true,
    harvestSpeed: 1.5,
    buffRadius: 0,
    buffDamage: 0,
    projectileType: "none",
  },
  // ── warrior: Legion orc berserker (greatsword) ──────────────────────────
  warrior: {
    type: "warrior",
    health: 120,
    maxHealth: 120,
    damage: 18,
    attackRange: 2.8,
    speed: 3.5,
    // Orc scout — correct Legion race for a brutal frontline warrior
    modelPath: "/models/characters/orc_scout-male.glb",
    targetHeight: 1.9,
    faction: "legion",
    weaponType: "greatsword",
    behavior: "patrol",
    canHarvest: false,
    harvestSpeed: 0,
    buffRadius: 0,
    buffDamage: 0,
    projectileType: "none",
  },
  // ── ranger: Wild/Fabled hybrid scout (bow) ───────────────────────────────
  ranger: {
    type: "ranger",
    health: 65,
    maxHealth: 65,
    damage: 20,
    attackRange: 15,
    speed: 4,
    // Elf female — agile scout archetype, correct for ranged + harvest hybrid
    modelPath: "/models/characters/elf-female.glb",
    targetHeight: 1.8,
    faction: "fabled",
    weaponType: "bow",
    behavior: "patrol",
    canHarvest: true,
    harvestSpeed: 1.0,
    buffRadius: 0,
    buffDamage: 0,
    projectileType: "arrow",
  },
  // ── mage: Crusade battle mage caster (staff) ─────────────────────────────
  mage: {
    type: "mage",
    health: 55,
    maxHealth: 55,
    damage: 22,
    attackRange: 14,
    speed: 2.5,
    // Human battle mage female — correct caster identity
    modelPath: "/models/characters/human_battle_mage-female.glb",
    targetHeight: 1.8,
    faction: "crusade",
    weaponType: "staff",
    behavior: "patrol",
    canHarvest: false,
    harvestSpeed: 0,
    buffRadius: 0,
    buffDamage: 0,
    projectileType: "fireball",
  },
  // ── wizard: Legion undead sorcerer (staff + area buff) ───────────────────
  wizard: {
    type: "wizard",
    health: 60,
    maxHealth: 60,
    damage: 30,
    attackRange: 16,
    speed: 2,
    // Vampire aristocrat — undead dark mage, correct Legion caster identity
    modelPath: "/models/characters/vampire_aristocrat-male.glb",
    targetHeight: 1.85,
    faction: "legion",
    weaponType: "staff",
    behavior: "patrol",
    canHarvest: false,
    harvestSpeed: 0,
    buffRadius: 8,
    buffDamage: 5,
    projectileType: "lightning",
  },
  // ── captain: Crusade commander (greatsword + party buff) ─────────────────
  captain: {
    type: "captain",
    health: 180,
    maxHealth: 180,
    damage: 16,
    attackRange: 3.0,
    speed: 3,
    // Battle mage male — commanding human captain, not a worge beast form
    modelPath: "/models/characters/human_battle_mage-male.glb",
    targetHeight: 1.85,
    faction: "crusade",
    weaponType: "greatsword",
    behavior: "patrol",
    canHarvest: false,
    harvestSpeed: 0,
    buffRadius: 12,
    buffDamage: 8,
    projectileType: "none",
  },
};

function makeAllyId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122-ish v4
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface AlliesState {
  allies: AllyData[];
  globalCommand: AllyCommand;
  commandTargetId: string | null;
  selectedAllyId: string | null;
  spawnAllies: (type: AllyType, count: number, center: THREE.Vector3, patrolRadius: number, buildingUid: string) => void;
  removeAlliesForBuilding: (buildingUid: string) => void;
  damageAlly: (id: string, amount: number) => void;
  updateAllyPosition: (id: string, pos: THREE.Vector3) => void;
  updateAllyBehavior: (id: string, behavior: AllyBehavior) => void;
  setAllySleeping: (id: string, sleeping: boolean) => void;
  awardXp: (id: string, amount: number, source?: "kill" | "harvest" | "quest") => void;
  setPersonalCommand: (id: string, command: AllyCommand | null, targetId?: string | null) => void;
  setHomePosition: (id: string, home: THREE.Vector3) => void;
  assignToBuilding: (allyId: string, buildingUid: string | null, behavior?: AllyBehavior) => void;
  selectAlly: (id: string | null) => void;
  getAlliesNear: (pos: THREE.Vector3, radius: number) => AllyData[];
  getCaptainBuff: (pos: THREE.Vector3) => number;
  setGlobalCommand: (command: AllyCommand, targetId?: string | null) => void;
}

export const useAllies = create<AlliesState>((set, get) => ({
  allies: [],
  globalCommand: "patrol" as AllyCommand,
  commandTargetId: null as string | null,
  selectedAllyId: null as string | null,

  spawnAllies: (type, count, center, patrolRadius, buildingUid) => {
    const config = ALLY_CONFIGS[type];
    if (!config) return;
    const newAllies: AllyData[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const offsetX = Math.cos(angle) * patrolRadius * 0.5;
      const offsetZ = Math.sin(angle) * patrolRadius * 0.5;
      const homePos = new THREE.Vector3(
        center.x + Math.cos(angle) * (patrolRadius * 0.35),
        center.y,
        center.z + Math.sin(angle) * (patrolRadius * 0.35),
      );
      newAllies.push({
        ...config,
        id: makeAllyId(),
        name: randomAllyName(),
        profession: TYPE_TO_PROFESSION[type],
        level: 1,
        xp: 0,
        xpToNext: xpForNextLevel(1),
        position: new THREE.Vector3(center.x + offsetX, center.y, center.z + offsetZ),
        patrolCenter: center.clone(),
        patrolRadius,
        homePosition: homePos,
        spawnedBy: buildingUid,
        assignedBuildingUid: null,
        personalCommand: null,
        personalTargetId: null,
        isSleeping: false,
        kills: 0,
        resourcesGathered: 0,
      });
    }
    set(s => ({ allies: [...s.allies, ...newAllies] }));
  },

  removeAlliesForBuilding: (buildingUid) => set(s => ({
    allies: s.allies.filter(a => a.spawnedBy !== buildingUid),
    selectedAllyId: s.allies.find(a => a.id === s.selectedAllyId)?.spawnedBy === buildingUid
      ? null
      : s.selectedAllyId,
  })),

  damageAlly: (id, amount) => set(s => {
    const next = s.allies
      .map(a => a.id === id ? { ...a, health: Math.max(0, a.health - amount) } : a)
      .filter(a => a.health > 0);
    return {
      allies: next,
      selectedAllyId: next.find(a => a.id === s.selectedAllyId) ? s.selectedAllyId : null,
    };
  }),

  updateAllyPosition: (id, pos) => set(s => ({
    allies: s.allies.map(a => a.id === id ? { ...a, position: pos.clone() } : a),
  })),

  updateAllyBehavior: (id, behavior) => set(s => ({
    allies: s.allies.map(a => a.id === id ? { ...a, behavior } : a),
  })),

  setAllySleeping: (id, sleeping) => set(s => ({
    allies: s.allies.map(a => a.id === id ? { ...a, isSleeping: sleeping } : a),
  })),

  awardXp: (id, amount, source) => set(s => ({
    allies: s.allies.map(a => {
      if (a.id !== id) return a;
      let level = a.level;
      let xp = a.xp + amount;
      let xpToNext = a.xpToNext;
      let maxHealth = a.maxHealth;
      let health = a.health;
      let damage = a.damage;
      // Cascade level-ups for big XP awards
      while (level < MAX_ALLY_LEVEL && xp >= xpToNext) {
        xp -= xpToNext;
        level += 1;
        // +5% HP, +3% damage per level (compounded loosely)
        const hpGain = Math.round(a.maxHealth * 0.05);
        const dmgGain = Math.max(1, Math.round(a.damage * 0.03));
        maxHealth += hpGain;
        health += hpGain; // heal a little on level-up
        damage += dmgGain;
        xpToNext = xpForNextLevel(level);
      }
      if (level >= MAX_ALLY_LEVEL) xp = 0;
      const kills = source === "kill" ? a.kills + 1 : a.kills;
      const resourcesGathered = source === "harvest" ? a.resourcesGathered + 1 : a.resourcesGathered;
      return { ...a, level, xp, xpToNext, maxHealth, health, damage, kills, resourcesGathered };
    }),
  })),

  setPersonalCommand: (id, command, targetId = null) => set(s => {
    const behaviorMap: Record<AllyCommand, AllyBehavior> = {
      follow: "follow",
      patrol: "patrol",
      stay: "idle",
      attack_target: "combat",
    };
    return {
      allies: s.allies.map(a => {
        if (a.id !== id) return a;
        if (command === null) return { ...a, personalCommand: null, personalTargetId: null };
        const nextBehavior = a.canHarvest && command === "patrol" ? "harvest" : behaviorMap[command];
        return {
          ...a,
          personalCommand: command,
          personalTargetId: command === "attack_target" ? targetId : null,
          behavior: nextBehavior,
        };
      }),
    };
  }),

  setHomePosition: (id, home) => set(s => ({
    allies: s.allies.map(a => a.id === id ? { ...a, homePosition: home.clone() } : a),
  })),

  assignToBuilding: (allyId, buildingUid, behavior) => set(s => ({
    allies: s.allies.map(a => {
      if (a.id !== allyId) return a;
      return {
        ...a,
        assignedBuildingUid: buildingUid,
        behavior: behavior ?? (buildingUid ? a.behavior : "patrol"),
      };
    }),
  })),

  selectAlly: (id) => set({ selectedAllyId: id }),

  getAlliesNear: (pos, radius) => {
    return get().allies.filter(a => a.position.distanceTo(pos) < radius);
  },

  getCaptainBuff: (pos) => {
    const allies = get().allies;
    let buff = 0;
    for (const a of allies) {
      if ((a.type === "captain" || a.type === "wizard") && a.buffRadius > 0) {
        if (a.position.distanceTo(pos) < a.buffRadius) {
          buff += a.buffDamage;
        }
      }
    }
    return buff;
  },

  setGlobalCommand: (command, targetId = null) => {
    const behaviorMap: Record<AllyCommand, AllyBehavior> = {
      follow: "follow",
      patrol: "patrol",
      stay: "idle",
      attack_target: "combat",
    };
    const newBehavior = behaviorMap[command];
    set((s) => ({
      globalCommand: command,
      commandTargetId: targetId ?? null,
      allies: s.allies.map((a) => {
        // Personal command overrides global
        if (a.personalCommand) return a;
        return {
          ...a,
          behavior: a.canHarvest && command === "patrol" ? "harvest" : newBehavior,
        };
      }),
    }));
  },
}));
