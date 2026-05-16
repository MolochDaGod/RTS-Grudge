/**
 * ItemPrefabRegistry — single source of truth for ALL equippable items:
 *   weapons (17 types × 6 variants) + armour (3 materials × 8 slots × 6 variants)
 *
 * Responsibilities:
 *  1. Resolve CDN icon URLs for every item (falling back to emoji)
 *  2. Merge user-saved overrides from localStorage (per-item stat edits)
 *  3. Expose unified lookup / search helpers
 *  4. Generate loot-drop candidates by tier/type/class
 */

import { WEAPON_PREFAB_VARIANTS } from "./WeaponPrefabs";
import type { WeaponVariant } from "./WeaponSkillData";
import type { WeaponTypeId } from "./WeaponSkillData";
import {
  ALL_ARMOR_PREFABS,
  type ArmorPrefab,
  type ArmorSlot,
  type ArmorMaterial,
  type ArmorRarity,
} from "./ArmorPrefabDatabase";
import { CDN_BASE } from "@/lib/stores/useEquipment";

// ---------------------------------------------------------------------------
// CDN icon paths
// CDN_BASE = "https://molochdagod.github.io/ObjectStore/icons/pack"
// Weapon icons live at: {CDN_BASE}/weapons/{type}/{name}.png  (lowercase, spaces→_)
// Armour icons live at: {CDN_BASE}/armor/{material}/{slot}/{rarity}.png
// ---------------------------------------------------------------------------

const WEAPON_CDN_FOLDER: Record<WeaponTypeId, string> = {
  sword:      "swords",
  axe:        "axes",
  dagger:     "daggers",
  hammer:     "hammers",
  mace:       "maces",
  greatsword: "greatswords",
  greataxe:   "greataxes",
  greathammer:"greathammers",
  lance:      "lances",
  bow:        "bows",
  crossbow:   "crossbows",
  gun:        "guns",
  staff:      "staves",
  tome:       "tomes",
  wand:       "wands",
  focus:      "focuses",
  shield:     "shields",
};

function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

/** CDN URL for a weapon variant icon. Falls back to emoji if CDN unavailable. */
export function getWeaponIconUrl(typeId: WeaponTypeId, variant: WeaponVariant): string {
  const folder = WEAPON_CDN_FOLDER[typeId] ?? "misc";
  return `${CDN_BASE}/weapons/${folder}/${toSlug(variant.name)}.png`;
}

/** CDN URL for an armour piece icon */
export function getArmorIconUrl(armor: ArmorPrefab): string {
  return `${CDN_BASE}/armor/${armor.material}/${armor.slot}/${armor.rarity}.png`;
}

/** Emoji icon for a weapon type (reliable fallback) */
export const WEAPON_TYPE_EMOJI: Record<WeaponTypeId, string> = {
  sword:      "⚔️",   axe:        "🪓",   dagger:     "🗡️",
  hammer:     "🔨",   mace:       "⚒️",   greatsword: "⚔️",
  greataxe:   "🪓",   greathammer:"🔨",   lance:      "🔱",
  bow:        "🏹",   crossbow:   "🎯",   gun:        "🔫",
  staff:      "🪄",   tome:       "📖",   wand:       "✨",
  focus:      "🔮",   shield:     "🛡️",
};

// ---------------------------------------------------------------------------
// Unified item record
// ---------------------------------------------------------------------------

export type ItemCategory = "weapon" | "armor";
export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export interface ItemRecord {
  id: string;
  name: string;
  category: ItemCategory;
  /** weapon type id or armour slot */
  typeKey: string;
  rarity: ItemRarity;
  icon: string;           // emoji fallback
  iconUrl: string;        // CDN URL
  stats: Record<string, number>;
  lore: string;
  modelPath?: string;
  /** Indicates item has been user-edited (merged from localStorage overrides) */
  isEdited?: boolean;
  /** Raw source data */
  _source: WeaponVariant | ArmorPrefab;
}

// ---------------------------------------------------------------------------
// Build the full registry
// ---------------------------------------------------------------------------

function weaponToRecord(typeId: WeaponTypeId, variant: WeaponVariant, idx: number): ItemRecord {
  return {
    id:        `weapon_${typeId}_v${idx + 1}`,
    name:      variant.name,
    category:  "weapon",
    typeKey:   typeId,
    rarity:    variant.rarity as ItemRarity,
    icon:      WEAPON_TYPE_EMOJI[typeId] ?? "⚔️",
    iconUrl:   getWeaponIconUrl(typeId, variant),
    stats:     { damage: variant.baseDamage, attackSpeed: variant.attackSpeed },
    lore:      variant.lore,
    modelPath: variant.modelPath,
    _source:   variant,
  };
}

function armorToRecord(armor: ArmorPrefab): ItemRecord {
  return {
    id:       armor.id,
    name:     armor.name,
    category: "armor",
    typeKey:  armor.slot,
    rarity:   armor.rarity as ItemRarity,
    icon:     armor.icon,
    iconUrl:  getArmorIconUrl(armor),
    stats:    armor.stats as Record<string, number>,
    lore:     armor.lore,
    _source:  armor,
  };
}

// Build master list (weapons first, then armour)
const MASTER_REGISTRY: ItemRecord[] = (() => {
  const records: ItemRecord[] = [];

  // Weapons
  for (const [typeId, variants] of Object.entries(WEAPON_PREFAB_VARIANTS)) {
    for (let i = 0; i < variants.length; i++) {
      records.push(weaponToRecord(typeId as WeaponTypeId, variants[i], i));
    }
  }

  // Armour
  for (const armor of ALL_ARMOR_PREFABS) {
    records.push(armorToRecord(armor));
  }

  return records;
})();

// ---------------------------------------------------------------------------
// Override system (per-item stat edits saved to localStorage)
// ---------------------------------------------------------------------------

const OVERRIDES_KEY = "grudge_item_prefab_overrides";

export interface ItemOverride {
  id: string;
  name?: string;
  stats?: Record<string, number>;
  lore?: string;
  iconUrl?: string;
  modelPath?: string;
}

export type OverridesMap = Record<string, ItemOverride>;

function loadOverrides(): OverridesMap {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as OverridesMap) : {};
  } catch {
    return {};
  }
}

export function saveItemOverride(override: ItemOverride): void {
  try {
    const map = loadOverrides();
    map[override.id] = { ...map[override.id], ...override };
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(map));
    // Invalidate cache
    _cache = null;
  } catch {
    console.warn("[ItemPrefabRegistry] Could not save override");
  }
}

export function resetItemOverride(id: string): void {
  try {
    const map = loadOverrides();
    delete map[id];
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(map));
    _cache = null;
  } catch {}
}

export function resetAllOverrides(): void {
  try {
    localStorage.removeItem(OVERRIDES_KEY);
    _cache = null;
  } catch {}
}

// Cached merged registry (rebuilt after saves)
let _cache: ItemRecord[] | null = null;

function getMergedRegistry(): ItemRecord[] {
  if (_cache) return _cache;
  const overrides = loadOverrides();
  _cache = MASTER_REGISTRY.map(item => {
    const ov = overrides[item.id];
    if (!ov) return item;
    return {
      ...item,
      name:      ov.name      ?? item.name,
      stats:     ov.stats     ? { ...item.stats, ...ov.stats } : item.stats,
      lore:      ov.lore      ?? item.lore,
      iconUrl:   ov.iconUrl   ?? item.iconUrl,
      modelPath: ov.modelPath ?? item.modelPath,
      isEdited:  true,
    };
  });
  return _cache;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** All items (merged with any saved overrides) */
export function getAllItems(): ItemRecord[] {
  return getMergedRegistry();
}

/** All weapon items */
export function getAllWeapons(): ItemRecord[] {
  return getMergedRegistry().filter(i => i.category === "weapon");
}

/** All armour items */
export function getAllArmor(): ItemRecord[] {
  return getMergedRegistry().filter(i => i.category === "armor");
}

/** Get by id */
export function getItemById(id: string): ItemRecord | undefined {
  return getMergedRegistry().find(i => i.id === id);
}

/** Get all items for a weapon type */
export function getWeaponsByType(typeId: WeaponTypeId): ItemRecord[] {
  return getMergedRegistry().filter(i => i.category === "weapon" && i.typeKey === typeId);
}

/** Get all armour for a slot */
export function getArmorBySlotKey(slot: ArmorSlot): ItemRecord[] {
  return getMergedRegistry().filter(i => i.category === "armor" && i.typeKey === slot);
}

/** Get items by rarity */
export function getItemsByRarity(rarity: ItemRarity): ItemRecord[] {
  return getMergedRegistry().filter(i => i.rarity === rarity);
}

/** Search items by name substring */
export function searchItems(query: string): ItemRecord[] {
  const q = query.toLowerCase();
  return getMergedRegistry().filter(i => i.name.toLowerCase().includes(q) || i.lore.toLowerCase().includes(q));
}

/** Get loot candidates appropriate for a given tier (maps rarity) */
export function getLootCandidates(
  tier: "common" | "uncommon" | "rare" | "elite" | "boss",
  category?: ItemCategory,
): ItemRecord[] {
  const rarityMap: Record<string, ItemRarity> = {
    common:   "common",
    uncommon: "uncommon",
    rare:     "rare",
    elite:    "epic",
    boss:     "legendary",
  };
  const rarity = rarityMap[tier] ?? "common";
  return getMergedRegistry().filter(i =>
    i.rarity === rarity && (category === undefined || i.category === category)
  );
}

/** Pick a random loot item of appropriate tier */
export function rollItemDrop(
  tier: "common" | "uncommon" | "rare" | "elite" | "boss",
  category?: ItemCategory,
): ItemRecord | null {
  const candidates = getLootCandidates(tier, category);
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Summary stats for debug / admin panel header */
export function getRegistryStats() {
  const all = getMergedRegistry();
  const edited = all.filter(i => i.isEdited).length;
  return {
    total: all.length,
    weapons: all.filter(i => i.category === "weapon").length,
    armor:   all.filter(i => i.category === "armor").length,
    edited,
  };
}
