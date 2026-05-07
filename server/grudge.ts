import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

const OBJECT_STORE_BASE = "https://molochdagod.github.io/ObjectStore/api/v1";

let _sql: NeonQueryFunction<false, false> | null = null;
function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.GRUDGE_DATABASE_URL;
    if (!url) throw new Error("GRUDGE_DATABASE_URL not configured");
    _sql = neon(url);
  }
  return _sql;
}

export async function initGrudgeDB() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS asset_registry (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      local_path TEXT,
      cdn_url TEXT,
      format TEXT DEFAULT 'glb',
      metadata JSONB DEFAULT '{}',
      bone_map JSONB DEFAULT '{}',
      animation_pack TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS weapon_data (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      tier INTEGER DEFAULT 1,
      stats JSONB DEFAULT '{}',
      abilities JSONB DEFAULT '[]',
      passive JSONB DEFAULT '[]',
      lore TEXT,
      sprite_path TEXT,
      model_id TEXT,
      grudge_type TEXT DEFAULT 'item',
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS skill_data (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      weapon_type TEXT NOT NULL,
      cooldown TEXT,
      mana_cost INTEGER DEFAULT 0,
      description TEXT,
      grudge_type TEXT DEFAULT 'ability',
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS material_data (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      tier INTEGER DEFAULT 0,
      gathered_by TEXT,
      grudge_type TEXT DEFAULT 'material',
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS equipment_config (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS armor_data (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      armor_set TEXT,
      type TEXT,
      material TEXT,
      attribute TEXT,
      stats JSONB DEFAULT '{}',
      passive TEXT,
      effect TEXT,
      proc TEXT,
      set_bonus TEXT,
      lore TEXT,
      sprite_path TEXT,
      grudge_type TEXT DEFAULT 'equipment',
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS armor_data_set_idx ON armor_data(armor_set)`;
  await sql`CREATE INDEX IF NOT EXISTS armor_data_material_idx ON armor_data(material)`;

  await sql`
    CREATE TABLE IF NOT EXISTS consumable_data (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      lvl INTEGER DEFAULT 1,
      icon TEXT,
      mats JSONB DEFAULT '{}',
      stats JSONB DEFAULT '{}',
      description TEXT,
      grudge_type TEXT DEFAULT 'consumable',
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS consumable_data_cat_idx ON consumable_data(category)`;

  console.log("[grudge] Database tables initialized");
}

export async function syncObjectStore() {
  const sql = getSql();
  const results = { weapons: 0, skills: 0, materials: 0, equipment: false, armor: 0, consumables: 0 };

  try {
    const weaponsRes = await fetch(`${OBJECT_STORE_BASE}/weapons.json`);
    if (weaponsRes.ok) {
      const data = await weaponsRes.json();
      for (const [_catKey, catData] of Object.entries(data.categories || {})) {
        const cat = catData as any;
        for (const item of cat.items || []) {
          await sql`
            INSERT INTO weapon_data (id, name, category, stats, abilities, passive, lore, sprite_path, grudge_type)
            VALUES (${item.id}, ${item.name}, ${item.category || _catKey}, 
                    ${JSON.stringify(item.stats || {})}, 
                    ${JSON.stringify(item.abilities || [])},
                    ${JSON.stringify(item.passives || [])},
                    ${item.lore || null}, ${item.spritePath || null}, ${item.grudgeType || 'item'})
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              stats = EXCLUDED.stats,
              abilities = EXCLUDED.abilities,
              passive = EXCLUDED.passive,
              lore = EXCLUDED.lore,
              sprite_path = EXCLUDED.sprite_path,
              synced_at = NOW()
          `;
          results.weapons++;
        }
      }
    }
  } catch (e) {
    console.warn("[grudge] Weapons sync partial:", (e as Error).message);
  }

  try {
    const skillsRes = await fetch(`${OBJECT_STORE_BASE}/skills.json`);
    if (skillsRes.ok) {
      const data = await skillsRes.json();
      for (const [weaponType, catData] of Object.entries(data.categories || {})) {
        const cat = catData as any;
        for (const skill of cat.skills || []) {
          await sql`
            INSERT INTO skill_data (id, name, weapon_type, cooldown, mana_cost, description, grudge_type)
            VALUES (${skill.id}, ${skill.name}, ${weaponType},
                    ${skill.cooldown || '0s'}, ${skill.mana || 0},
                    ${skill.desc || null}, ${skill.grudgeType || 'ability'})
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              cooldown = EXCLUDED.cooldown,
              mana_cost = EXCLUDED.mana_cost,
              description = EXCLUDED.description,
              synced_at = NOW()
          `;
          results.skills++;
        }
      }
    }
  } catch (e) {
    console.warn("[grudge] Skills sync partial:", (e as Error).message);
  }

  try {
    const materialsRes = await fetch(`${OBJECT_STORE_BASE}/materials.json`);
    if (materialsRes.ok) {
      const data = await materialsRes.json();
      for (const [catKey, catData] of Object.entries(data.categories || {})) {
        const cat = catData as any;
        for (const mat of cat.items || []) {
          await sql`
            INSERT INTO material_data (id, name, category, tier, gathered_by, grudge_type)
            VALUES (${mat.id}, ${mat.name}, ${catKey},
                    ${mat.tier || 0}, ${mat.gatheredBy || null}, ${mat.grudgeType || 'material'})
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              tier = EXCLUDED.tier,
              gathered_by = EXCLUDED.gathered_by,
              synced_at = NOW()
          `;
          results.materials++;
        }
      }
    }
  } catch (e) {
    console.warn("[grudge] Materials sync partial:", (e as Error).message);
  }

  try {
    const equipRes = await fetch(`${OBJECT_STORE_BASE}/equipment.json`);
    if (equipRes.ok) {
      const data = await equipRes.json();
      await sql`
        INSERT INTO equipment_config (key, value)
        VALUES ('slots', ${JSON.stringify(data.slots || [])}),
               ('tiers', ${JSON.stringify(data.tiers || {})}),
               ('tier_flat_bonus', ${JSON.stringify(data.tierFlatBonus || {})}),
               ('display_stat_map', ${JSON.stringify(data.displayStatMap || {})})
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = NOW()
      `;
      results.equipment = true;
    }
  } catch (e) {
    console.warn("[grudge] Equipment sync partial:", (e as Error).message);
  }

  try {
    const armorRes = await fetch(`${OBJECT_STORE_BASE}/armor.json`);
    if (armorRes.ok) {
      const data = await armorRes.json();
      for (const [matKey, matData] of Object.entries(data.materials || {})) {
        const mat = matData as any;
        for (const item of mat.items || []) {
          // ObjectStore armor IDs are `${material}-${set}-${slot}` (e.g. "cloth-bloodfeud-helm").
          // Derive the set from the second token when no explicit set field exists.
          let derivedSet: string | null = item.set || item.armorSet || null;
          if (!derivedSet && typeof item.id === "string") {
            const parts = item.id.split("-");
            if (parts.length >= 3) {
              derivedSet = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
            }
          }
          await sql`
            INSERT INTO armor_data (id, name, armor_set, type, material, attribute, stats, passive, effect, proc, set_bonus, lore, sprite_path, grudge_type)
            VALUES (${item.id}, ${item.name},
                    ${derivedSet}, ${item.type || null},
                    ${item.material || matKey}, ${item.attribute || null},
                    ${JSON.stringify(item.stats || {})},
                    ${item.passive || null}, ${item.effect || null},
                    ${item.proc || null}, ${item.setBonus || null},
                    ${item.lore || null}, ${item.spritePath || null},
                    ${item.grudgeType || 'equipment'})
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              armor_set = EXCLUDED.armor_set,
              type = EXCLUDED.type,
              material = EXCLUDED.material,
              attribute = EXCLUDED.attribute,
              stats = EXCLUDED.stats,
              passive = EXCLUDED.passive,
              effect = EXCLUDED.effect,
              proc = EXCLUDED.proc,
              set_bonus = EXCLUDED.set_bonus,
              lore = EXCLUDED.lore,
              sprite_path = EXCLUDED.sprite_path,
              synced_at = NOW()
          `;
          results.armor++;
        }
      }
    }
  } catch (e) {
    console.warn("[grudge] Armor sync partial:", (e as Error).message);
  }

  try {
    const consRes = await fetch(`${OBJECT_STORE_BASE}/consumables.json`);
    if (consRes.ok) {
      const data = await consRes.json();
      for (const [catKey, catData] of Object.entries(data.categories || {})) {
        const cat = catData as any;
        for (const item of cat.items || []) {
          // consumable IDs are integers within categories — namespace them
          const id = `consumable-${catKey}-${item.id}`;
          await sql`
            INSERT INTO consumable_data (id, name, category, lvl, icon, mats, stats, description, grudge_type)
            VALUES (${id}, ${item.name}, ${catKey},
                    ${item.lvl || 1}, ${item.icon || null},
                    ${JSON.stringify(item.mats || {})},
                    ${JSON.stringify(item.stats || {})},
                    ${item.desc || null}, ${item.grudgeType || 'consumable'})
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              lvl = EXCLUDED.lvl,
              icon = EXCLUDED.icon,
              mats = EXCLUDED.mats,
              stats = EXCLUDED.stats,
              description = EXCLUDED.description,
              synced_at = NOW()
          `;
          results.consumables++;
        }
      }
    }
  } catch (e) {
    console.warn("[grudge] Consumables sync partial:", (e as Error).message);
  }

  console.log(`[grudge] Synced: ${results.weapons} weapons, ${results.skills} skills, ${results.materials} materials, ${results.armor} armor, ${results.consumables} consumables, equipment=${results.equipment}`);
  return results;
}

export async function registerAsset(asset: {
  id: string;
  category: string;
  name: string;
  type: string;
  localPath?: string;
  cdnUrl?: string;
  format?: string;
  metadata?: Record<string, any>;
  boneMap?: Record<string, string>;
  animationPack?: string;
}) {
  const sql = getSql();
  await sql`
    INSERT INTO asset_registry (id, category, name, type, local_path, cdn_url, format, metadata, bone_map, animation_pack)
    VALUES (${asset.id}, ${asset.category}, ${asset.name}, ${asset.type},
            ${asset.localPath || null}, ${asset.cdnUrl || null}, ${asset.format || 'glb'},
            ${JSON.stringify(asset.metadata || {})}, ${JSON.stringify(asset.boneMap || {})},
            ${asset.animationPack || null})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      local_path = EXCLUDED.local_path,
      cdn_url = EXCLUDED.cdn_url,
      format = EXCLUDED.format,
      metadata = EXCLUDED.metadata,
      bone_map = EXCLUDED.bone_map,
      animation_pack = EXCLUDED.animation_pack,
      updated_at = NOW()
  `;
}

export async function getAssets(category?: string) {
  const sql = getSql();
  if (category) {
    return sql`SELECT * FROM asset_registry WHERE category = ${category} ORDER BY name`;
  }
  return sql`SELECT * FROM asset_registry ORDER BY category, name`;
}

export async function getWeapons(category?: string) {
  const sql = getSql();
  if (category) {
    return sql`SELECT * FROM weapon_data WHERE category = ${category} ORDER BY name`;
  }
  return sql`SELECT * FROM weapon_data ORDER BY name`;
}

export async function getSkills(weaponType?: string) {
  const sql = getSql();
  if (weaponType) {
    return sql`SELECT * FROM skill_data WHERE weapon_type = ${weaponType} ORDER BY name`;
  }
  return sql`SELECT * FROM skill_data ORDER BY weapon_type, name`;
}

export async function getMaterials(category?: string) {
  const sql = getSql();
  if (category) {
    return sql`SELECT * FROM material_data WHERE category = ${category} ORDER BY tier, name`;
  }
  return sql`SELECT * FROM material_data ORDER BY category, tier, name`;
}

export async function getEquipmentConfig() {
  const sql = getSql();
  const rows = await sql`SELECT * FROM equipment_config`;
  const config: Record<string, any> = {};
  for (const row of rows) {
    config[row.key] = row.value;
  }
  return config;
}

export async function getArmor(material?: string, set?: string) {
  const sql = getSql();
  if (material && set) {
    return sql`SELECT * FROM armor_data WHERE material = ${material} AND armor_set = ${set} ORDER BY type, name`;
  }
  if (material) {
    return sql`SELECT * FROM armor_data WHERE material = ${material} ORDER BY armor_set, type, name`;
  }
  if (set) {
    return sql`SELECT * FROM armor_data WHERE armor_set = ${set} ORDER BY material, type, name`;
  }
  return sql`SELECT * FROM armor_data ORDER BY material, armor_set, type, name`;
}

export async function getConsumables(category?: string) {
  const sql = getSql();
  if (category) {
    return sql`SELECT * FROM consumable_data WHERE category = ${category} ORDER BY lvl, name`;
  }
  return sql`SELECT * FROM consumable_data ORDER BY category, lvl, name`;
}

export { getSql };
