import { eq, asc } from "drizzle-orm";
import { db } from "./db";
import {
  assetRegistry, weaponData, skillData, materialData,
  equipmentConfig, armorData, consumableData,
} from "@shared/schema";

const OBJECT_STORE_BASE = "https://grudge-objectstore.pages.dev/api/v1";

// ── Object Store Sync ────────────────────────────────────────────────────────

export async function syncObjectStore() {
  const results = { weapons: 0, skills: 0, materials: 0, equipment: false, armor: 0, consumables: 0 };

  try {
    const res = await fetch(`${OBJECT_STORE_BASE}/weapons.json`);
    if (res.ok) {
      const data = await res.json();
      for (const [catKey, catData] of Object.entries(data.categories || {})) {
        const cat = catData as any;
        for (const item of cat.items || []) {
          await db.insert(weaponData).values({
            id: item.id, name: item.name, category: item.category || catKey,
            stats: item.stats || {}, abilities: item.abilities || [],
            passive: item.passives || [], lore: item.lore || null,
            spritePath: item.spritePath || null, grudgeType: item.grudgeType || "item",
          }).onDuplicateKeyUpdate({
            set: {
              name: item.name, stats: item.stats || {},
              abilities: item.abilities || [], passive: item.passives || [],
              lore: item.lore || null, spritePath: item.spritePath || null,
            },
          });
          results.weapons++;
        }
      }
    }
  } catch (e) { console.warn("[grudge] Weapons sync partial:", (e as Error).message); }

  try {
    const res = await fetch(`${OBJECT_STORE_BASE}/skills.json`);
    if (res.ok) {
      const data = await res.json();
      for (const [wType, catData] of Object.entries(data.categories || {})) {
        const cat = catData as any;
        for (const skill of cat.skills || []) {
          await db.insert(skillData).values({
            id: skill.id, name: skill.name, weaponType: wType,
            cooldown: skill.cooldown || "0s", manaCost: skill.mana || 0,
            description: skill.desc || null, grudgeType: skill.grudgeType || "ability",
          }).onDuplicateKeyUpdate({
            set: {
              name: skill.name, cooldown: skill.cooldown || "0s",
              manaCost: skill.mana || 0, description: skill.desc || null,
            },
          });
          results.skills++;
        }
      }
    }
  } catch (e) { console.warn("[grudge] Skills sync partial:", (e as Error).message); }

  try {
    const res = await fetch(`${OBJECT_STORE_BASE}/materials.json`);
    if (res.ok) {
      const data = await res.json();
      for (const [catKey, catData] of Object.entries(data.categories || {})) {
        const cat = catData as any;
        for (const mat of cat.items || []) {
          await db.insert(materialData).values({
            id: mat.id, name: mat.name, category: catKey,
            tier: mat.tier || 0, gatheredBy: mat.gatheredBy || null,
            grudgeType: mat.grudgeType || "material",
          }).onDuplicateKeyUpdate({
            set: { name: mat.name, tier: mat.tier || 0, gatheredBy: mat.gatheredBy || null },
          });
          results.materials++;
        }
      }
    }
  } catch (e) { console.warn("[grudge] Materials sync partial:", (e as Error).message); }

  try {
    const res = await fetch(`${OBJECT_STORE_BASE}/equipment.json`);
    if (res.ok) {
      const data = await res.json();
      const entries = [
        { key: "slots", value: data.slots || [] },
        { key: "tiers", value: data.tiers || {} },
        { key: "tier_flat_bonus", value: data.tierFlatBonus || {} },
        { key: "display_stat_map", value: data.displayStatMap || {} },
      ];
      for (const e of entries) {
        await db.insert(equipmentConfig).values({ key: e.key, value: e.value })
          .onDuplicateKeyUpdate({ set: { value: e.value } });
      }
      results.equipment = true;
    }
  } catch (e) { console.warn("[grudge] Equipment sync partial:", (e as Error).message); }

  try {
    const res = await fetch(`${OBJECT_STORE_BASE}/armor.json`);
    if (res.ok) {
      const data = await res.json();
      for (const [matKey, matData] of Object.entries(data.materials || {})) {
        const mat = matData as any;
        for (const item of mat.items || []) {
          let derivedSet: string | null = item.set || item.armorSet || null;
          if (!derivedSet && typeof item.id === "string") {
            const parts = item.id.split("-");
            if (parts.length >= 3) derivedSet = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
          }
          await db.insert(armorData).values({
            id: item.id, name: item.name, armorSet: derivedSet,
            type: item.type || null, material: item.material || matKey,
            attribute: item.attribute || null, stats: item.stats || {},
            passive: item.passive || null, effect: item.effect || null,
            proc: item.proc || null, setBonus: item.setBonus || null,
            lore: item.lore || null, spritePath: item.spritePath || null,
            grudgeType: item.grudgeType || "equipment",
          }).onDuplicateKeyUpdate({
            set: {
              name: item.name, armorSet: derivedSet, type: item.type || null,
              material: item.material || matKey, attribute: item.attribute || null,
              stats: item.stats || {}, passive: item.passive || null,
              effect: item.effect || null, proc: item.proc || null,
              setBonus: item.setBonus || null, lore: item.lore || null,
              spritePath: item.spritePath || null,
            },
          });
          results.armor++;
        }
      }
    }
  } catch (e) { console.warn("[grudge] Armor sync partial:", (e as Error).message); }

  try {
    const res = await fetch(`${OBJECT_STORE_BASE}/consumables.json`);
    if (res.ok) {
      const data = await res.json();
      for (const [catKey, catData] of Object.entries(data.categories || {})) {
        const cat = catData as any;
        for (const item of cat.items || []) {
          const id = `consumable-${catKey}-${item.id}`;
          await db.insert(consumableData).values({
            id, name: item.name, category: catKey,
            lvl: item.lvl || 1, icon: item.icon || null,
            mats: item.mats || {}, stats: item.stats || {},
            description: item.desc || null, grudgeType: item.grudgeType || "consumable",
          }).onDuplicateKeyUpdate({
            set: {
              name: item.name, lvl: item.lvl || 1, icon: item.icon || null,
              mats: item.mats || {}, stats: item.stats || {},
              description: item.desc || null,
            },
          });
          results.consumables++;
        }
      }
    }
  } catch (e) { console.warn("[grudge] Consumables sync partial:", (e as Error).message); }

  console.log(`[grudge] Synced: ${results.weapons} weapons, ${results.skills} skills, ${results.materials} materials, ${results.armor} armor, ${results.consumables} consumables, equipment=${results.equipment}`);
  return results;
}

// ── Asset Registration ───────────────────────────────────────────────────────

export async function registerAsset(asset: {
  id: string; category: string; name: string; type: string;
  localPath?: string; cdnUrl?: string; format?: string;
  metadata?: Record<string, any>; boneMap?: Record<string, string>;
  animationPack?: string;
}) {
  await db.insert(assetRegistry).values({
    id: asset.id, category: asset.category, name: asset.name, type: asset.type,
    localPath: asset.localPath || null, cdnUrl: asset.cdnUrl || null,
    format: asset.format || "glb", metadata: asset.metadata || {},
    boneMap: asset.boneMap || {}, animationPack: asset.animationPack || null,
  }).onDuplicateKeyUpdate({
    set: {
      name: asset.name, localPath: asset.localPath || null,
      cdnUrl: asset.cdnUrl || null, format: asset.format || "glb",
      metadata: asset.metadata || {}, boneMap: asset.boneMap || {},
      animationPack: asset.animationPack || null,
    },
  });
}

// ── Query helpers ────────────────────────────────────────────────────────────

export async function getAssets(category?: string) {
  if (category) return db.select().from(assetRegistry).where(eq(assetRegistry.category, category)).orderBy(asc(assetRegistry.name));
  return db.select().from(assetRegistry).orderBy(asc(assetRegistry.category), asc(assetRegistry.name));
}

export async function getWeapons(category?: string) {
  if (category) return db.select().from(weaponData).where(eq(weaponData.category, category)).orderBy(asc(weaponData.name));
  return db.select().from(weaponData).orderBy(asc(weaponData.name));
}

export async function getSkills(weaponType?: string) {
  if (weaponType) return db.select().from(skillData).where(eq(skillData.weaponType, weaponType)).orderBy(asc(skillData.name));
  return db.select().from(skillData).orderBy(asc(skillData.weaponType), asc(skillData.name));
}

export async function getMaterials(category?: string) {
  if (category) return db.select().from(materialData).where(eq(materialData.category, category)).orderBy(asc(materialData.tier), asc(materialData.name));
  return db.select().from(materialData).orderBy(asc(materialData.category), asc(materialData.tier), asc(materialData.name));
}

export async function getEquipmentConfig() {
  const rows = await db.select().from(equipmentConfig);
  const config: Record<string, any> = {};
  for (const row of rows) config[row.key] = row.value;
  return config;
}

export async function getArmor(material?: string, set?: string) {
  let q = db.select().from(armorData).$dynamic();
  if (material && set) q = q.where(eq(armorData.material, material));
  else if (material) q = q.where(eq(armorData.material, material));
  else if (set) q = q.where(eq(armorData.armorSet, set));
  return q.orderBy(asc(armorData.material), asc(armorData.armorSet), asc(armorData.type), asc(armorData.name));
}

export async function getConsumables(category?: string) {
  if (category) return db.select().from(consumableData).where(eq(consumableData.category, category)).orderBy(asc(consumableData.lvl), asc(consumableData.name));
  return db.select().from(consumableData).orderBy(asc(consumableData.category), asc(consumableData.lvl), asc(consumableData.name));
}
