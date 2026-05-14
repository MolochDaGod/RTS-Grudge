/**
 * Canonical Grudge Warlords data layer.
 *
 * Source of truth: https://molochdagod.github.io/ObjectStore/api/v1/
 * (mirrored at https://info.grudge-studio.com/data/).
 *
 * The 12 master-*.json files are served from /data/grudge/*.json (see
 * client/public/data/grudge/). They are loaded once at runtime via
 * `loadGrudgeData()` and cached. Game systems should import the typed
 * helpers below — never duplicate this data inline.
 *
 * To refresh from the canonical source, re-fetch the files into
 * client/public/data/grudge/ and bump CANONICAL_DATA_VERSION below.
 */

export const CANONICAL_DATA_BASE = "/data/grudge";
export const CANONICAL_DATA_VERSION = "2026-04-22";

// ============================================================
// Types — shapes match the canonical JSON exactly. Any field
// the canonical source emits but we don't yet consume is left
// as `unknown` rather than `any` so TS still flags misuse.
// ============================================================

export type AttributeId =
  | "strength"
  | "vitality"
  | "endurance"
  | "intellect"
  | "wisdom"
  | "dexterity"
  | "agility"
  | "tactics";

export type ClassId = "warrior" | "mage" | "ranger" | "worge";

export type MaterialKind =
  | "ore" | "ingot" | "wood" | "cloth" | "leather" | "gem" | "essence";

export interface AttributeGain {
  label: string;
  flat: number;
  percent: number;
}

export interface CanonicalAttribute {
  id: AttributeId;
  name: string;
  emoji: string;
  color: string;
  icon: string;
  role: string;
  description: string;
  gains: Record<string, AttributeGain>;
  uuid: string;
}

export interface CanonicalAttributesFile {
  version: string;
  generated: string;
  total: number;
  levelRange: string;
  startingPoints: number;
  pointsPerLevel: number;
  maxPoints: number;
  diminishingReturns: {
    threshold: number;
    tier1: { range: string; efficiency: number };
    tier2: { range: string; efficiency: number };
  };
  attributes: CanonicalAttribute[];
  statDescriptions: Record<string, string>;
  statCaps: Record<string, { value: number; display: string; rationale: string }>;
}

export interface CanonicalSkill {
  uuid: string;
  id: string;
  name: string;
  icon: string;
  description: string;
  effect?: string;
  maxPoints?: number;
  cooldown?: number | string;
  manaCost?: number;
  range?: number | string;
  [key: string]: unknown;
}

export interface CanonicalSkillTier {
  name: string;
  requiredLevel: number;
  skills: CanonicalSkill[];
}

export interface CanonicalSkillTree {
  uuid: string;
  className: string;
  color: string;
  tiers: CanonicalSkillTier[];
}

export interface CanonicalSkillTreesFile {
  version: string;
  generated: string;
  totalClasses: number;
  totalSkills: number;
  skillTrees: Record<ClassId, CanonicalSkillTree>;
}

export interface CanonicalWeaponSkill {
  uuid: string;
  id: string;
  name: string;
  icon?: string;
  description?: string;
  effect?: string;
  tier?: number;
  damage?: number;
  cooldown?: number | null;
  castTime?: number | null;
  range?: number | string | null;
  [key: string]: unknown;
}

export interface CanonicalWeaponSlot {
  type: string;
  label: string;
  unlockTier: number;
  skills: CanonicalWeaponSkill[];
}

export interface CanonicalWeaponType {
  id: string;
  name: string;
  uuid: string;
  icon?: string;
  classes?: string[];
  totalSkills?: number;
  slots: CanonicalWeaponSlot[];
}

export interface CanonicalWeaponSkillsFile {
  version: string;
  generated: string;
  generatedAt?: string;
  totalWeaponTypes: number;
  totalSkills: number;
  classRestrictions: Record<string, string[]>;
  /** Real payload is an array — `weaponTypeById` indexes it by `id`. */
  weaponTypes: CanonicalWeaponType[];
}

export interface CanonicalProfessionsFile {
  version: string;
  generated: string;
  totalGathering: number;
  totalCrafting: number;
  totalNodes: number;
  gathering: Record<string, unknown>;
  crafting: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CanonicalItem {
  uuid: string;
  id?: string;
  name: string;
  type?: string;
  category?: string;
  tier?: number | string;
  icon?: string;
  description?: string;
  [key: string]: unknown;
}

export interface CanonicalItemsFile {
  version: string;
  generated: string;
  source?: string;
  totalItems?: number;
  totalRecipes?: number;
  totalMaterials?: number;
  items: CanonicalItem[];
}

export interface CanonicalArrayFile<T> {
  version: string;
  generated: string;
  total?: number;
  items: T[];
  [key: string]: unknown;
}

export interface CanonicalRecipe {
  uuid: string;
  id?: string;
  name?: string;
  output?: { uuid: string; quantity?: number };
  inputs?: Array<{ uuid: string; quantity: number }>;
  [key: string]: unknown;
}

export interface CanonicalRecipesFile {
  version: string;
  generated: string;
  totalRecipes: number;
  recipes: CanonicalRecipe[];
}

export interface CanonicalMaterial {
  uuid: string;
  id?: string;
  name: string;
  kind?: MaterialKind;
  tier?: number;
  icon?: string;
  [key: string]: unknown;
}

export interface CanonicalMaterialsFile {
  version: string;
  generated: string;
  totalMaterials: number;
  materials: CanonicalMaterial[];
}

export interface CanonicalArtifact {
  uuid: string;
  id?: string;
  name: string;
  hiddenUntilFound?: boolean;
  discovery?: unknown;
  [key: string]: unknown;
}

export interface CanonicalArtifactsFile {
  version: string;
  generated: string;
  total: number;
  totalArtifacts?: number;
  note?: string;
  artifacts: CanonicalArtifact[];
}

export interface CanonicalRegistryFile {
  version: string;
  generated: string;
  source?: string;
  baseUrl?: string;
  cdnUrl?: string;
  r2Bucket?: string;
  packs?: unknown;
  assets?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  categories?: Record<string, unknown>;
}

// ============================================================
// Bundle returned by `loadGrudgeData()` — one stop shop.
// ============================================================

export interface GrudgeData {
  attributes: CanonicalAttributesFile;
  skillTrees: CanonicalSkillTreesFile;
  weaponSkills: CanonicalWeaponSkillsFile;
  professions: CanonicalProfessionsFile;
  items: CanonicalItemsFile;
  weapons: CanonicalArrayFile<CanonicalItem>;
  armor: CanonicalArrayFile<CanonicalItem>;
  consumables: CanonicalArrayFile<CanonicalItem>;
  recipes: CanonicalRecipesFile;
  materials: CanonicalMaterialsFile;
  artifacts: CanonicalArtifactsFile;
  registry: CanonicalRegistryFile;

  // Indexed lookups built once at load time.
  itemByUuid: Map<string, CanonicalItem>;
  materialByUuid: Map<string, CanonicalMaterial>;
  attributeById: Map<AttributeId, CanonicalAttribute>;
  skillByUuid: Map<string, CanonicalSkill>;
  weaponTypeById: Map<string, CanonicalWeaponType>;
}

// ============================================================
// Loader — single in-flight promise, cached on success.
// ============================================================

let loaded: GrudgeData | null = null;
let loading: Promise<GrudgeData> | null = null;

async function fetchJson<T>(name: string): Promise<T> {
  const url = `${CANONICAL_DATA_BASE}/${name}`;
  const r = await fetch(url, { cache: "force-cache" });
  if (!r.ok) {
    throw new Error(`Grudge data fetch failed: ${url} (${r.status})`);
  }
  return (await r.json()) as T;
}

function indexItems(file: CanonicalItemsFile): Map<string, CanonicalItem> {
  const m = new Map<string, CanonicalItem>();
  for (const it of file.items) m.set(it.uuid, it);
  return m;
}

export async function loadGrudgeData(): Promise<GrudgeData> {
  if (loaded) return loaded;
  if (loading) return loading;
  loading = (async () => {
    const [
      attributes,
      skillTrees,
      weaponSkills,
      professions,
      items,
      weapons,
      armor,
      consumables,
      recipes,
      materials,
      artifacts,
      registry,
    ] = await Promise.all([
      fetchJson<CanonicalAttributesFile>("master-attributes.json"),
      fetchJson<CanonicalSkillTreesFile>("master-skillTrees.json"),
      fetchJson<CanonicalWeaponSkillsFile>("master-weaponSkills.json"),
      fetchJson<CanonicalProfessionsFile>("master-professions.json"),
      fetchJson<CanonicalItemsFile>("master-items.json"),
      fetchJson<CanonicalArrayFile<CanonicalItem>>("master-weapons.json"),
      fetchJson<CanonicalArrayFile<CanonicalItem>>("master-armor.json"),
      fetchJson<CanonicalArrayFile<CanonicalItem>>("master-consumables.json"),
      fetchJson<CanonicalRecipesFile>("master-recipes.json"),
      fetchJson<CanonicalMaterialsFile>("master-materials.json"),
      fetchJson<CanonicalArtifactsFile>("master-artifacts.json"),
      fetchJson<CanonicalRegistryFile>("master-registry.json"),
    ]);

    const itemByUuid = indexItems(items);
    const materialByUuid = new Map<string, CanonicalMaterial>(
      materials.materials.map((m) => [m.uuid, m]),
    );
    const attributeById = new Map<AttributeId, CanonicalAttribute>(
      attributes.attributes.map((a) => [a.id, a]),
    );
    const skillByUuid = new Map<string, CanonicalSkill>();
    for (const tree of Object.values(skillTrees.skillTrees)) {
      for (const tier of tree.tiers) {
        for (const skill of tier.skills) skillByUuid.set(skill.uuid, skill);
      }
    }
    // master-weaponSkills.json ships `weaponTypes` as an array; index by
    // weapon `id` (e.g. "SWORD", "BOW") so consumers get O(1) lookup.
    const weaponTypeById = new Map<string, CanonicalWeaponType>(
      weaponSkills.weaponTypes.map((w) => [w.id, w]),
    );
    // While we're walking the array, register every nested slot skill
    // so `skillByUuid` covers both class-tree and weapon-tree skills.
    // Weapon skills carry extra fields (tier/damage/range/...) that the
    // class-tree skill type doesn't enumerate; the cast is safe because
    // both shapes share `uuid`/`id`/`name`/`description`/`icon`/`effect`.
    for (const wt of weaponSkills.weaponTypes) {
      for (const slot of wt.slots) {
        for (const skill of slot.skills) {
          skillByUuid.set(skill.uuid, skill as unknown as CanonicalSkill);
        }
      }
    }

    loaded = {
      attributes,
      skillTrees,
      weaponSkills,
      professions,
      items,
      weapons,
      armor,
      consumables,
      recipes,
      materials,
      artifacts,
      registry,
      itemByUuid,
      materialByUuid,
      attributeById,
      skillByUuid,
      weaponTypeById,
    };
    return loaded;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

/** Returns the cached data or throws if `loadGrudgeData()` has not resolved yet. */
export function getGrudgeData(): GrudgeData {
  if (!loaded) {
    throw new Error(
      "Grudge data not loaded. Await loadGrudgeData() before calling getGrudgeData().",
    );
  }
  return loaded;
}

/** True once the canonical data is loaded and cached. */
export function isGrudgeDataLoaded(): boolean {
  return loaded !== null;
}
