import { ALL_CHARACTER_MODELS, ALL_WEAPON_MODELS, QUATERNIUS_WEAPONS, SPELL_MODELS, ITEM_MODELS, type ModelEntry, type WeaponModelEntry } from "../systems/ModelRegistry";
import {
  ALL_TJG_ASSETS,
  type TJGAsset,
} from "@/lib/data/ThreeJSGamesRegistry";
import { NPC_PREFABS } from "./NPCPrefabRegistry";

export type ColliderShape = "box" | "sphere" | "capsule" | "mesh" | "none";
export type PhysicsType = "static" | "dynamic" | "kinematic" | "none";

export interface ColliderDef {
  shape: ColliderShape;
  size: [number, number, number];
  offset: [number, number, number];
  isTrigger: boolean;
}

export interface PrefabDef {
  id: string;
  name: string;
  category: PrefabCategory;
  subcategory: string;
  modelPath: string;
  defaultScale: [number, number, number];
  targetHeight: number;
  collider: ColliderDef;
  physicsType: PhysicsType;
  navMeshObstacle: boolean;
  navMeshCarve: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  hasAnimations: boolean;
  tags: string[];
}

export type PrefabCategory =
  | "character"
  | "animal"
  | "building"
  | "weapon"
  | "vehicle"
  | "nature"
  | "ship"
  | "item"
  | "primitive"
  | "effect";

const CATEGORY_ICONS: Record<PrefabCategory, string> = {
  character: "C",
  animal: "A",
  building: "B",
  weapon: "W",
  vehicle: "V",
  nature: "N",
  ship: "S",
  item: "I",
  primitive: "P",
  effect: "F",
};

const CATEGORY_COLORS: Record<PrefabCategory, string> = {
  character: "#d2a8ff",
  animal: "#7ee787",
  building: "#f0883e",
  weapon: "#f85149",
  vehicle: "#79c0ff",
  nature: "#56d364",
  ship: "#3fb950",
  item: "#58a6ff",
  primitive: "#8b949e",
  effect: "#d29922",
};

function inferColliderFromTJG(asset: TJGAsset): ColliderDef {
  switch (asset.category) {
    case "character":
    case "animal":
      return {
        shape: "capsule",
        size: [0.4, 1.8, 0.4],
        offset: [0, 0.9, 0],
        isTrigger: false,
      };
    case "building":
      if (asset.tags.includes("castle") || asset.tags.includes("fortress")) {
        return { shape: "box", size: [12, 10, 12], offset: [0, 5, 0], isTrigger: false };
      }
      if (asset.tags.includes("tower")) {
        return { shape: "box", size: [3, 8, 3], offset: [0, 4, 0], isTrigger: false };
      }
      if (asset.tags.includes("house") || asset.tags.includes("hut")) {
        return { shape: "box", size: [4, 3, 4], offset: [0, 1.5, 0], isTrigger: false };
      }
      if (asset.tags.includes("monument")) {
        return { shape: "box", size: [3, 5, 3], offset: [0, 2.5, 0], isTrigger: false };
      }
      if (asset.tags.includes("city") || asset.tags.includes("settlement")) {
        return { shape: "box", size: [20, 6, 20], offset: [0, 3, 0], isTrigger: false };
      }
      if (asset.tags.includes("temple")) {
        return { shape: "box", size: [8, 6, 8], offset: [0, 3, 0], isTrigger: false };
      }
      return { shape: "box", size: [5, 4, 5], offset: [0, 2, 0], isTrigger: false };
    case "weapon":
      return { shape: "box", size: [0.3, 1.2, 0.3], offset: [0, 0.6, 0], isTrigger: false };
    case "vehicle":
      if (asset.tags.includes("tank")) {
        return { shape: "box", size: [3, 2, 5], offset: [0, 1, 0], isTrigger: false };
      }
      if (asset.tags.includes("aircraft") || asset.tags.includes("biplane") || asset.tags.includes("triplane")) {
        return { shape: "box", size: [6, 1.5, 5], offset: [0, 0.75, 0], isTrigger: false };
      }
      if (asset.tags.includes("airship") || asset.tags.includes("zeppelin")) {
        return { shape: "box", size: [4, 4, 12], offset: [0, 2, 0], isTrigger: false };
      }
      if (asset.tags.includes("car")) {
        return { shape: "box", size: [2, 1.5, 4], offset: [0, 0.75, 0], isTrigger: false };
      }
      return { shape: "box", size: [3, 2, 3], offset: [0, 1, 0], isTrigger: false };
    case "nature":
      if (asset.tags.includes("tree")) {
        return { shape: "capsule", size: [0.5, 4, 0.5], offset: [0, 2, 0], isTrigger: false };
      }
      if (asset.tags.includes("cloud")) {
        return { shape: "none", size: [1, 1, 1], offset: [0, 0, 0], isTrigger: false };
      }
      return { shape: "box", size: [1, 1, 1], offset: [0, 0.5, 0], isTrigger: false };
    case "ship":
      return { shape: "box", size: [5, 4, 12], offset: [0, 2, 0], isTrigger: false };
    default:
      return { shape: "box", size: [1, 1, 1], offset: [0, 0.5, 0], isTrigger: false };
  }
}

function inferPhysicsType(asset: TJGAsset): PhysicsType {
  if (asset.category === "character" || asset.category === "animal") return "kinematic";
  if (asset.category === "building" || asset.category === "nature") return "static";
  if (asset.category === "vehicle" || asset.category === "ship") return "kinematic";
  return "static";
}

function inferNavMeshObstacle(asset: TJGAsset): boolean {
  if (asset.category === "building") return true;
  if (asset.category === "nature" && !asset.tags.includes("cloud")) return true;
  if (asset.category === "vehicle" && asset.tags.includes("tank")) return true;
  return false;
}

function inferTargetHeight(asset: TJGAsset): number {
  if (asset.category === "character") {
    if (asset.tags.includes("ogre") || asset.tags.includes("boss")) return 2.8;
    if (asset.tags.includes("troll") || asset.tags.includes("golem")) return 2.5;
    if (asset.tags.includes("orc")) return 2.0;
    if (asset.tags.includes("goblin") || asset.tags.includes("dwarf")) return 1.4;
    if (asset.tags.includes("sorceress") || asset.tags.includes("wizard")) return 1.9;
    return 1.8;
  }
  if (asset.category === "animal") {
    if (asset.tags.includes("horse")) return 1.6;
    if (asset.tags.includes("spider")) return 0.5;
    if (asset.tags.includes("rat")) return 0.3;
    if (asset.tags.includes("bird") || asset.tags.includes("flying")) return 0.4;
    return 0.6;
  }
  if (asset.category === "building") {
    if (asset.tags.includes("castle") || asset.tags.includes("fortress")) return 12;
    if (asset.tags.includes("tower")) return 8;
    if (asset.tags.includes("city") || asset.tags.includes("settlement")) return 8;
    if (asset.tags.includes("temple")) return 10;
    if (asset.tags.includes("house") || asset.tags.includes("hut")) return 4;
    if (asset.tags.includes("monument")) return 6;
    if (asset.tags.includes("windmill")) return 6;
    if (asset.tags.includes("bunker")) return 3;
    if (asset.tags.includes("landmark")) return 10;
    return 5;
  }
  if (asset.category === "weapon") {
    if (asset.tags.includes("knife") || asset.tags.includes("dagger")) return 0.4;
    if (asset.tags.includes("rifle") || asset.tags.includes("gun")) return 1.0;
    if (asset.tags.includes("pistol") || asset.tags.includes("revolver")) return 0.3;
    if (asset.tags.includes("axe")) return 0.9;
    if (asset.tags.includes("bomb")) return 0.25;
    return 1.0;
  }
  if (asset.category === "vehicle") {
    if (asset.tags.includes("airship") || asset.tags.includes("zeppelin")) return 6;
    if (asset.tags.includes("dirigible") || asset.tags.includes("carrier")) return 8;
    if (asset.tags.includes("tank")) return 2.5;
    if (asset.tags.includes("helicopter")) return 3;
    if (asset.tags.includes("spacecraft")) return 3;
    if (asset.tags.includes("biplane") || asset.tags.includes("triplane")) return 2.5;
    if (asset.tags.includes("car")) return 1.5;
    return 3;
  }
  if (asset.category === "nature") {
    if (asset.tags.includes("tree")) return 5;
    if (asset.tags.includes("cloud")) return 3;
    return 2;
  }
  if (asset.category === "ship") return 8;
  return 2;
}

function tjgToPrefab(asset: TJGAsset): PrefabDef {
  return {
    id: `prefab-${asset.id}`,
    name: asset.name,
    category: asset.category as PrefabCategory,
    subcategory: asset.subcategory,
    modelPath: asset.modelPath,
    defaultScale: [1, 1, 1],
    targetHeight: inferTargetHeight(asset),
    collider: inferColliderFromTJG(asset),
    physicsType: inferPhysicsType(asset),
    navMeshObstacle: inferNavMeshObstacle(asset),
    navMeshCarve: inferNavMeshObstacle(asset),
    castShadow: true,
    receiveShadow: asset.category !== "character",
    hasAnimations: asset.hasAnimations,
    tags: asset.tags,
  };
}

function inferWeaponTargetHeight(category: string, weaponType?: string): number {
  switch (category) {
    case "blade":
      if (weaponType === "dagger") return 0.4;
      if (weaponType === "greatsword") return 1.4;
      if (weaponType === "axe") return 0.9;
      return 1.0;
    case "blunt":
      if (weaponType === "hammer") return 1.0;
      return 0.9;
    case "polearm":
      return 1.6;
    case "ranged":
      if (weaponType === "bow") return 1.2;
      if (weaponType === "crossbow") return 0.8;
      return 0.9;
    case "magic":
      if (weaponType === "staff") return 1.6;
      if (weaponType === "wand") return 0.5;
      return 0.8;
    case "shield":
      return 0.7;
    case "armor":
      return 0.5;
    case "character":
      return 1.8;
    default:
      return 1.0;
  }
}

function inferWeaponCollider(category: string, h: number): ColliderDef {
  if (category === "shield") {
    return { shape: "box", size: [0.6, h, 0.1], offset: [0, h / 2, 0], isTrigger: false };
  }
  if (category === "armor") {
    return { shape: "box", size: [0.4, h, 0.4], offset: [0, h / 2, 0], isTrigger: false };
  }
  if (category === "ranged") {
    return { shape: "box", size: [0.2, h, 0.4], offset: [0, h / 2, 0], isTrigger: false };
  }
  return { shape: "box", size: [0.15, h, 0.15], offset: [0, h / 2, 0], isTrigger: false };
}

function modelRegistryCharToPrefab(m: ModelEntry): PrefabDef {
  const h = m.defaultHeight || 1.8;
  return {
    id: `prefab-char-${m.id}`,
    name: m.name,
    category: "character",
    subcategory: m.category || "player",
    modelPath: m.path,
    defaultScale: [1, 1, 1],
    targetHeight: h,
    collider: { shape: "capsule", size: [0.4, h, 0.4], offset: [0, h / 2, 0], isTrigger: false },
    physicsType: "kinematic",
    navMeshObstacle: false,
    navMeshCarve: false,
    castShadow: true,
    receiveShadow: false,
    hasAnimations: true,
    tags: ["character", m.category, m.combatClass],
  };
}

function inferWeaponTypeFromModelEntry(m: ModelEntry): string | undefined {
  const n = m.name.toLowerCase();
  const id = m.id.toLowerCase();
  if (n.includes("katana") || n.includes("longsword") || n.includes("short sword")) return "sword";
  if (n.includes("club")) return "hammer";
  if (n.includes("helmet") || n.includes("shoulder")) return undefined;
  if (n.includes("tome") || n.includes("spellbook") || n.includes("skull")) return "wand";
  if (n.includes("shield")) return "shield";
  if (id.includes("offhand")) return undefined;
  return undefined;
}

function modelRegistryWeaponEntryToPrefab(m: ModelEntry): PrefabDef {
  const weaponType = inferWeaponTypeFromModelEntry(m);
  const h = inferWeaponTargetHeight(m.category, weaponType);
  return {
    id: `prefab-weap-${m.id}`,
    name: m.name,
    category: "weapon",
    subcategory: m.category,
    modelPath: m.path,
    defaultScale: [1, 1, 1],
    targetHeight: h,
    collider: inferWeaponCollider(m.category, h),
    physicsType: "none",
    navMeshObstacle: false,
    navMeshCarve: false,
    castShadow: true,
    receiveShadow: false,
    hasAnimations: false,
    tags: ["weapon", m.category, ...(weaponType ? [weaponType] : [])],
  };
}

function quaterniusWeaponToPrefab(m: WeaponModelEntry): PrefabDef {
  const h = inferWeaponTargetHeight(m.category, m.weaponType);
  return {
    id: `prefab-weap-${m.id}`,
    name: m.name,
    category: "weapon",
    subcategory: m.category,
    modelPath: m.path,
    defaultScale: [1, 1, 1],
    targetHeight: h,
    collider: inferWeaponCollider(m.category, h),
    physicsType: "none",
    navMeshObstacle: false,
    navMeshCarve: false,
    castShadow: true,
    receiveShadow: false,
    hasAnimations: false,
    tags: ["weapon", m.category, m.weaponType],
  };
}

function spellModelToPrefab(m: { id: string; name: string; path: string; defaultScale: number; spellType: string; element: string }): PrefabDef {
  return {
    id: `prefab-spell-${m.id}`,
    name: m.name,
    category: "effect",
    subcategory: m.spellType,
    modelPath: m.path,
    defaultScale: [1, 1, 1],
    targetHeight: m.defaultScale * 2,
    collider: { shape: "sphere", size: [0.3, 0.3, 0.3], offset: [0, 0, 0], isTrigger: true },
    physicsType: "none",
    navMeshObstacle: false,
    navMeshCarve: false,
    castShadow: false,
    receiveShadow: false,
    hasAnimations: false,
    tags: ["spell", "effect", m.element, m.spellType],
  };
}

const TJG_PREFABS: PrefabDef[] = ALL_TJG_ASSETS.map(tjgToPrefab);

const CHAR_PREFABS: PrefabDef[] = ALL_CHARACTER_MODELS.map(modelRegistryCharToPrefab);

const WEAPON_PREFABS: PrefabDef[] = [
  ...ALL_WEAPON_MODELS.map(modelRegistryWeaponEntryToPrefab),
  ...QUATERNIUS_WEAPONS.map(quaterniusWeaponToPrefab),
];

const SPELL_PREFABS: PrefabDef[] = SPELL_MODELS.map(spellModelToPrefab);

const ITEM_PREFABS: PrefabDef[] = [
  {
    id: "prefab-item-potion",
    name: "Health Potion",
    category: "item",
    subcategory: "consumable",
    modelPath: ITEM_MODELS.potion.path,
    defaultScale: [1, 1, 1],
    targetHeight: 0.3,
    collider: { shape: "box", size: [0.15, 0.3, 0.15], offset: [0, 0.15, 0], isTrigger: true },
    physicsType: "none",
    navMeshObstacle: false,
    navMeshCarve: false,
    castShadow: true,
    receiveShadow: true,
    hasAnimations: false,
    tags: ["item", "potion", "consumable", "loot"],
  },
];

const CUSTOM_PREFABS_KEY = "gge-custom-prefabs";

let customPrefabs: PrefabDef[] = [];
try {
  const stored = localStorage.getItem(CUSTOM_PREFABS_KEY);
  if (stored) customPrefabs = JSON.parse(stored);
} catch {}

export function addCustomPrefab(prefab: PrefabDef): void {
  customPrefabs = customPrefabs.filter(p => p.id !== prefab.id);
  customPrefabs.push(prefab);
  localStorage.setItem(CUSTOM_PREFABS_KEY, JSON.stringify(customPrefabs));
}

export function removeCustomPrefab(id: string): void {
  customPrefabs = customPrefabs.filter(p => p.id !== id);
  localStorage.setItem(CUSTOM_PREFABS_KEY, JSON.stringify(customPrefabs));
}

export function getCustomPrefabs(): PrefabDef[] {
  return [...customPrefabs];
}

export function getAllPrefabs(): PrefabDef[] {
  return [...NPC_PREFABS, ...TJG_PREFABS, ...CHAR_PREFABS, ...WEAPON_PREFABS, ...SPELL_PREFABS, ...ITEM_PREFABS, ...customPrefabs];
}

export const ALL_PREFABS: PrefabDef[] = [
  ...NPC_PREFABS,
  ...TJG_PREFABS,
  ...CHAR_PREFABS,
  ...WEAPON_PREFABS,
  ...SPELL_PREFABS,
  ...ITEM_PREFABS,
];

export function getPrefabById(id: string): PrefabDef | undefined {
  return getAllPrefabs().find((p) => p.id === id);
}

export function getPrefabsByCategory(category: PrefabCategory): PrefabDef[] {
  return getAllPrefabs().filter((p) => p.category === category);
}

export function searchPrefabs(query: string): PrefabDef[] {
  const q = query.toLowerCase();
  return getAllPrefabs().filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.tags.some((t) => t.includes(q)) ||
      p.category.includes(q) ||
      p.subcategory.includes(q)
  );
}

export function getPrefabCategories(): { category: PrefabCategory; count: number; icon: string; color: string }[] {
  const counts = new Map<PrefabCategory, number>();
  for (const p of getAllPrefabs()) {
    counts.set(p.category, (counts.get(p.category) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([cat, count]) => ({
    category: cat,
    count,
    icon: CATEGORY_ICONS[cat],
    color: CATEGORY_COLORS[cat],
  }));
}

export { CATEGORY_ICONS, CATEGORY_COLORS };
