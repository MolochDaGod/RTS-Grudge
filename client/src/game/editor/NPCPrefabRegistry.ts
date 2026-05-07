import type { ColliderDef, PhysicsType, PrefabDef } from "./PrefabRegistry";

export type NPCFaction = "ally" | "neutral" | "hostile";
export type NPCBehavior =
  | "guard"
  | "worker"
  | "wander"
  | "patrol"
  | "stationary"
  | "aggressive";

export interface NPCPrefabDef extends PrefabDef {
  faction: NPCFaction;
  behavior: NPCBehavior;
  wanderRadius: number;
  speed: number;
  health: number;
  attackDamage: number;
  label: string;
}

interface FriendlyNPCSeed {
  key: string;
  label: string;
  modelPath: string;
  faction: NPCFaction;
  behavior: NPCBehavior;
  targetHeight: number;
  wanderRadius: number;
  speed: number;
  health: number;
}

const FRIENDLY_NPCS: FriendlyNPCSeed[] = [
  { key: "guard_red",     label: "Grave Knight (Red)",  modelPath: "/models/characters/undead_grave_knight-male.glb", faction: "ally", behavior: "guard",     targetHeight: 1.9, wanderRadius: 6,  speed: 1.5, health: 80 },
  { key: "guard_blue",    label: "Grave Knight (Blue)", modelPath: "/models/characters/undead_grave_knight-male.glb", faction: "ally", behavior: "guard",     targetHeight: 1.9, wanderRadius: 6,  speed: 1.5, health: 80 },
  { key: "worker",        label: "Battle Mage Worker",  modelPath: "/models/characters/human_battle_mage-male.glb",   faction: "ally", behavior: "worker",    targetHeight: 1.85, wanderRadius: 8,  speed: 1.2, health: 50 },
  { key: "rancher",       label: "Night Stalker Hunter",modelPath: "/models/characters/night_stalker-male.glb",       faction: "ally", behavior: "wander",    targetHeight: 2.0, wanderRadius: 10, speed: 1.8, health: 70 },
  { key: "captain",       label: "Crusade Captain",     modelPath: "/models/characters/night_stalker-male.glb",       faction: "ally", behavior: "patrol",    targetHeight: 2.0, wanderRadius: 4,  speed: 1.0, health: 150 },
  { key: "knight",        label: "Grave Knight",        modelPath: "/models/characters/undead_grave_knight-male.glb", faction: "ally", behavior: "guard",     targetHeight: 1.9, wanderRadius: 5,  speed: 1.3, health: 120 },
  { key: "elf",           label: "Elf Ranger",          modelPath: "/models/characters/elf-male.glb",                 faction: "ally", behavior: "wander",    targetHeight: 1.85, wanderRadius: 12, speed: 2.0, health: 60 },
  { key: "wizard",        label: "Battle Mage",         modelPath: "/models/characters/human_battle_mage-male.glb",   faction: "ally", behavior: "stationary", targetHeight: 1.85, wanderRadius: 5,  speed: 0.8, health: 70 },
];

interface HostileNPCSeed {
  key: string;
  label: string;
  modelPath: string;
  targetHeight: number;
  speed: number;
  health: number;
  attackDamage: number;
  wanderRadius: number;
}

const HOSTILE_NPCS: HostileNPCSeed[] = [
  { key: "skeleton",      label: "Skeleton",         modelPath: "/models/pirate_quaternius/Characters_Skeleton.glb",          targetHeight: 1.7, speed: 1.4, health: 40,  attackDamage: 8,  wanderRadius: 8 },
  { key: "goblin",        label: "Goblin Backstabber", modelPath: "/models/characters/goblin_backstabber-male.glb",           targetHeight: 1.4, speed: 1.6, health: 30,  attackDamage: 6,  wanderRadius: 10 },
  { key: "viking_raider", label: "Viking Raider",    modelPath: "/models/pirate_quaternius/Characters_Captain_Barbarossa.glb", targetHeight: 1.9, speed: 1.5, health: 100, attackDamage: 14, wanderRadius: 6 },
  { key: "pirate",        label: "Pirate",           modelPath: "/models/pirate_quaternius/Characters_Anne.glb",              targetHeight: 1.8, speed: 1.5, health: 70,  attackDamage: 10, wanderRadius: 8 },
  { key: "witch",         label: "Witch",            modelPath: "/models/monsters/blob/Wizard.glb",                            targetHeight: 1.7, speed: 1.0, health: 60,  attackDamage: 18, wanderRadius: 5 },
  { key: "ninja_sand",    label: "Sand Ninja",       modelPath: "/models/monsters/blob/Ninja.glb",                             targetHeight: 1.7, speed: 2.2, health: 50,  attackDamage: 16, wanderRadius: 12 },
  { key: "ninja",         label: "Ninja",            modelPath: "/models/monsters/blob/Ninja.glb",                             targetHeight: 1.7, speed: 2.2, health: 50,  attackDamage: 16, wanderRadius: 12 },
  { key: "orc",           label: "Orc",              modelPath: "/models/monsters/big/Orc.glb",                                targetHeight: 2.0, speed: 1.4, health: 120, attackDamage: 18, wanderRadius: 6 },
  { key: "demon",         label: "Demon",            modelPath: "/models/monsters/big/Demon.glb",                              targetHeight: 2.8, speed: 1.6, health: 200, attackDamage: 25, wanderRadius: 5 },
  { key: "blue_demon",    label: "Blue Demon",       modelPath: "/models/monsters/big/BlueDemon.glb",                          targetHeight: 2.4, speed: 1.7, health: 180, attackDamage: 22, wanderRadius: 5 },
  { key: "dragon",        label: "Dragon",           modelPath: "/models/monsters/flying/Dragon_Evolved.glb",                  targetHeight: 3.5, speed: 2.0, health: 500, attackDamage: 50, wanderRadius: 8 },
  { key: "mushroom_king", label: "Mushroom King",    modelPath: "/models/monsters/big/MushroomKing.glb",                       targetHeight: 3.0, speed: 0.8, health: 350, attackDamage: 30, wanderRadius: 4 },
  { key: "yeti",          label: "Yeti",             modelPath: "/models/monsters/blob/Yeti.glb",                              targetHeight: 2.8, speed: 1.5, health: 220, attackDamage: 24, wanderRadius: 6 },
  { key: "ghost",         label: "Ghost",            modelPath: "/models/monsters/flying/Ghost.glb",                           targetHeight: 1.8, speed: 2.0, health: 80,  attackDamage: 14, wanderRadius: 10 },
  { key: "frog",          label: "Giant Frog",       modelPath: "/models/monsters/big/Frog.glb",                               targetHeight: 1.5, speed: 1.8, health: 60,  attackDamage: 10, wanderRadius: 8 },
  { key: "blob",          label: "Green Blob",       modelPath: "/models/monsters/blob/GreenBlob.glb",                         targetHeight: 1.0, speed: 1.0, health: 40,  attackDamage: 6,  wanderRadius: 5 },
  { key: "cactoro",       label: "Cactoro",          modelPath: "/models/monsters/big/Cactoro.glb",                            targetHeight: 1.8, speed: 1.2, health: 90,  attackDamage: 12, wanderRadius: 5 },
  { key: "tribal",        label: "Tribal Warrior",   modelPath: "/models/monsters/big/Tribal.glb",                             targetHeight: 1.6, speed: 1.6, health: 70,  attackDamage: 11, wanderRadius: 8 },
  { key: "raptor",        label: "Raptor",           modelPath: "/models/monsters/big/Dino.glb",                               targetHeight: 2.0, speed: 2.5, health: 110, attackDamage: 18, wanderRadius: 12 },
  { key: "trex",          label: "T-Rex",            modelPath: "/models/monsters/big/Dino.glb",                               targetHeight: 4.5, speed: 1.8, health: 600, attackDamage: 60, wanderRadius: 10 },
  { key: "triceratops",   label: "Triceratops",      modelPath: "/models/monsters/big/Dino.glb",                               targetHeight: 3.5, speed: 1.2, health: 400, attackDamage: 35, wanderRadius: 8 },
  { key: "bunny",         label: "Killer Bunny",     modelPath: "/models/monsters/big/Bunny.glb",                              targetHeight: 0.8, speed: 2.5, health: 25,  attackDamage: 5,  wanderRadius: 12 },
  { key: "alien",         label: "Alien",            modelPath: "/models/monsters/big/Alien.glb",                              targetHeight: 2.4, speed: 1.8, health: 150, attackDamage: 20, wanderRadius: 8 },
  { key: "berserker",     label: "Berserker",        modelPath: "/models/characters/night_stalker-male.glb",                   targetHeight: 2.0, speed: 2.0, health: 130, attackDamage: 22, wanderRadius: 6 },
];

function npcCollider(targetHeight: number): ColliderDef {
  const r = Math.max(0.3, Math.min(0.8, targetHeight * 0.25));
  return {
    shape: "capsule",
    size: [r, targetHeight, r],
    offset: [0, targetHeight / 2, 0],
    isTrigger: false,
  };
}

function makeFriendlyPrefab(seed: FriendlyNPCSeed): NPCPrefabDef {
  return {
    id: `prefab-npc-${seed.key}`,
    name: seed.label,
    category: "character",
    subcategory: "npc-ally",
    modelPath: seed.modelPath,
    defaultScale: [1, 1, 1],
    targetHeight: seed.targetHeight,
    collider: npcCollider(seed.targetHeight),
    physicsType: "kinematic" as PhysicsType,
    navMeshObstacle: false,
    navMeshCarve: false,
    castShadow: true,
    receiveShadow: false,
    hasAnimations: true,
    tags: ["npc", "ally", seed.behavior, seed.label.toLowerCase()],
    faction: seed.faction,
    behavior: seed.behavior,
    wanderRadius: seed.wanderRadius,
    speed: seed.speed,
    health: seed.health,
    attackDamage: 10,
    label: seed.label,
  };
}

function makeHostilePrefab(seed: HostileNPCSeed): NPCPrefabDef {
  return {
    id: `prefab-npc-${seed.key}`,
    name: seed.label,
    category: "character",
    subcategory: "npc-hostile",
    modelPath: seed.modelPath,
    defaultScale: [1, 1, 1],
    targetHeight: seed.targetHeight,
    collider: npcCollider(seed.targetHeight),
    physicsType: "kinematic" as PhysicsType,
    navMeshObstacle: false,
    navMeshCarve: false,
    castShadow: true,
    receiveShadow: false,
    hasAnimations: true,
    tags: ["npc", "enemy", "hostile", seed.label.toLowerCase()],
    faction: "hostile",
    behavior: "aggressive",
    wanderRadius: seed.wanderRadius,
    speed: seed.speed,
    health: seed.health,
    attackDamage: seed.attackDamage,
    label: seed.label,
  };
}

export const FRIENDLY_NPC_PREFABS: NPCPrefabDef[] = FRIENDLY_NPCS.map(makeFriendlyPrefab);
export const HOSTILE_NPC_PREFABS: NPCPrefabDef[] = HOSTILE_NPCS.map(makeHostilePrefab);

export const NPC_PREFABS: NPCPrefabDef[] = [
  ...FRIENDLY_NPC_PREFABS,
  ...HOSTILE_NPC_PREFABS,
];

export function getNPCPrefabs(): NPCPrefabDef[] {
  return NPC_PREFABS;
}

export function getNPCPrefabById(id: string): NPCPrefabDef | undefined {
  return NPC_PREFABS.find((p) => p.id === id);
}

export function isNPCPrefab(prefab: PrefabDef): prefab is NPCPrefabDef {
  return prefab.category === "character" &&
    (prefab.subcategory === "npc-ally" || prefab.subcategory === "npc-hostile");
}

export const NPC_FACTION_COLORS: Record<NPCFaction, string> = {
  ally: "#56d364",
  neutral: "#d29922",
  hostile: "#f85149",
};
