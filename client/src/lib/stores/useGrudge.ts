import { create } from "zustand";

const OBJECT_STORE_BASE = "https://molochdagod.github.io/ObjectStore/api/v1";
const FETCH_TIMEOUT_MS = 10000;

function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

interface GrudgeWeapon {
  id: string;
  name: string;
  category: string;
  stats: Record<string, number>;
  abilities: string[];
  passives: string[];
  lore: string;
  basicAbility: string;
  signatureAbility: string;
  spritePath: string;
  grudgeType: string;
}

interface GrudgeSkill {
  id: string;
  name: string;
  weaponType: string;
  cooldown: string;
  mana: number;
  desc: string;
  grudgeType: string;
}

interface GrudgeMaterial {
  id: string;
  name: string;
  category: string;
  tier: number;
  gatheredBy: string;
  grudgeType: string;
}

interface GrudgeArmor {
  id: string;
  name: string;
  set: string;
  type: string;
  material: string;
  attribute: string;
  stats: Record<string, number>;
  passive: string;
  effect: string;
  proc: string;
  setBonus: string;
  lore: string;
  spritePath: string;
  grudgeType: string;
}

interface GrudgeConsumable {
  id: string;
  name: string;
  category: string;
  lvl: number;
  icon: string;
  mats: Record<string, number>;
  stats: Record<string, string | number>;
  desc: string;
  grudgeType: string;
}

interface EquipmentTier {
  name: string;
  color: string;
  multiplier: number;
}

interface EquipmentConfig {
  slots: string[];
  tiers: Record<string, EquipmentTier>;
  tierFlatBonus: Record<string, number>;
  displayStatMap: Record<string, { label: string; color: string; icon: string }>;
}

interface GrudgeState {
  weapons: Record<string, GrudgeWeapon[]>;
  skills: Record<string, GrudgeSkill[]>;
  materials: Record<string, GrudgeMaterial[]>;
  armor: Record<string, GrudgeArmor[]>;
  consumables: Record<string, GrudgeConsumable[]>;
  equipment: EquipmentConfig | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  lastSync: number;

  fetchAll: () => Promise<void>;
  fetchWeapons: () => Promise<void>;
  fetchSkills: () => Promise<void>;
  fetchMaterials: () => Promise<void>;
  fetchArmor: () => Promise<void>;
  fetchConsumables: () => Promise<void>;
  fetchEquipment: () => Promise<void>;
  syncToBackend: () => Promise<void>;
  getWeaponById: (id: string) => GrudgeWeapon | undefined;
  getSkillsForWeapon: (weaponType: string) => GrudgeSkill[];
  getMaterialsByCategory: (category: string) => GrudgeMaterial[];
  getArmorBySet: (set: string) => GrudgeArmor[];
  getConsumablesByCategory: (category: string) => GrudgeConsumable[];
  getTierColor: (tier: number) => string;
}

export const useGrudge = create<GrudgeState>((set, get) => ({
  weapons: {},
  skills: {},
  materials: {},
  armor: {},
  consumables: {},
  equipment: null,
  loaded: false,
  loading: false,
  error: null,
  lastSync: 0,

  fetchAll: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      await Promise.all([
        get().fetchWeapons(),
        get().fetchSkills(),
        get().fetchMaterials(),
        get().fetchArmor(),
        get().fetchConsumables(),
        get().fetchEquipment(),
      ]);
      set({ loaded: true, loading: false, lastSync: Date.now() });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchWeapons: async () => {
    try {
      const res = await fetchWithTimeout(`${OBJECT_STORE_BASE}/weapons.json`);
      if (!res.ok) throw new Error("Failed to fetch weapons");
      const data = await res.json();
      const weaponsByCategory: Record<string, GrudgeWeapon[]> = {};
      for (const [catKey, catData] of Object.entries(data.categories || {})) {
        const cat = catData as any;
        weaponsByCategory[catKey] = (cat.items || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category || catKey,
          stats: item.stats || {},
          abilities: item.abilities || [],
          passives: item.passives || [],
          lore: item.lore || "",
          basicAbility: item.basicAbility || "",
          signatureAbility: item.signatureAbility || "",
          spritePath: item.spritePath || "",
          grudgeType: item.grudgeType || "item",
        }));
      }
      set({ weapons: weaponsByCategory });
    } catch (e: any) {
      console.warn("[grudge] Weapons fetch failed:", e.message);
    }
  },

  fetchSkills: async () => {
    try {
      const res = await fetchWithTimeout(`${OBJECT_STORE_BASE}/skills.json`);
      if (!res.ok) throw new Error("Failed to fetch skills");
      const data = await res.json();
      const skillsByWeapon: Record<string, GrudgeSkill[]> = {};
      for (const [weaponType, catData] of Object.entries(data.categories || {})) {
        const cat = catData as any;
        skillsByWeapon[weaponType] = (cat.skills || []).map((skill: any) => ({
          id: skill.id,
          name: skill.name,
          weaponType,
          cooldown: skill.cooldown || "0s",
          mana: skill.mana || 0,
          desc: skill.desc || "",
          grudgeType: skill.grudgeType || "ability",
        }));
      }
      set({ skills: skillsByWeapon });
    } catch (e: any) {
      console.warn("[grudge] Skills fetch failed:", e.message);
    }
  },

  fetchMaterials: async () => {
    try {
      const res = await fetchWithTimeout(`${OBJECT_STORE_BASE}/materials.json`);
      if (!res.ok) throw new Error("Failed to fetch materials");
      const data = await res.json();
      const matsByCategory: Record<string, GrudgeMaterial[]> = {};
      for (const [catKey, catData] of Object.entries(data.categories || {})) {
        const cat = catData as any;
        matsByCategory[catKey] = (cat.items || []).map((mat: any) => ({
          id: mat.id,
          name: mat.name,
          category: catKey,
          tier: mat.tier || 0,
          gatheredBy: mat.gatheredBy || "",
          grudgeType: mat.grudgeType || "material",
        }));
      }
      set({ materials: matsByCategory });
    } catch (e: any) {
      console.warn("[grudge] Materials fetch failed:", e.message);
    }
  },

  fetchArmor: async () => {
    try {
      const res = await fetchWithTimeout(`${OBJECT_STORE_BASE}/armor.json`);
      if (!res.ok) throw new Error("Failed to fetch armor");
      const data = await res.json();
      const armorByMaterial: Record<string, GrudgeArmor[]> = {};
      for (const [matKey, matData] of Object.entries(data.materials || {})) {
        const mat = matData as any;
        armorByMaterial[matKey] = (mat.items || []).map((item: any) => {
          // Mirror the server: derive set from `${material}-${set}-${slot}` ID pattern.
          let derivedSet: string = item.set || item.armorSet || "";
          if (!derivedSet && typeof item.id === "string") {
            const parts = item.id.split("-");
            if (parts.length >= 3) derivedSet = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
          }
          return {
          id: item.id,
          name: item.name,
          set: derivedSet,
          type: item.type || "",
          material: item.material || matKey,
          attribute: item.attribute || "",
          stats: item.stats || {},
          passive: item.passive || "",
          effect: item.effect || "",
          proc: item.proc || "",
          setBonus: item.setBonus || "",
          lore: item.lore || "",
          spritePath: item.spritePath || "",
          grudgeType: item.grudgeType || "equipment",
          };
        });
      }
      set({ armor: armorByMaterial });
    } catch (e: any) {
      console.warn("[grudge] Armor fetch failed:", e.message);
    }
  },

  fetchConsumables: async () => {
    try {
      const res = await fetchWithTimeout(`${OBJECT_STORE_BASE}/consumables.json`);
      if (!res.ok) throw new Error("Failed to fetch consumables");
      const data = await res.json();
      const byCategory: Record<string, GrudgeConsumable[]> = {};
      for (const [catKey, catData] of Object.entries(data.categories || {})) {
        const cat = catData as any;
        byCategory[catKey] = (cat.items || []).map((item: any) => ({
          id: `consumable-${catKey}-${item.id}`,
          name: item.name,
          category: catKey,
          lvl: item.lvl || 1,
          icon: item.icon || "",
          mats: item.mats || {},
          stats: item.stats || {},
          desc: item.desc || "",
          grudgeType: item.grudgeType || "consumable",
        }));
      }
      set({ consumables: byCategory });
    } catch (e: any) {
      console.warn("[grudge] Consumables fetch failed:", e.message);
    }
  },

  fetchEquipment: async () => {
    try {
      const res = await fetchWithTimeout(`${OBJECT_STORE_BASE}/equipment.json`);
      if (!res.ok) throw new Error("Failed to fetch equipment");
      const data = await res.json();
      set({
        equipment: {
          slots: data.slots || [],
          tiers: data.tiers || {},
          tierFlatBonus: data.tierFlatBonus || {},
          displayStatMap: data.displayStatMap || {},
        },
      });
    } catch (e: any) {
      console.warn("[grudge] Equipment fetch failed:", e.message);
    }
  },

  syncToBackend: async () => {
    try {
      const res = await fetch("/api/grudge/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        set({ lastSync: Date.now() });
        console.log("[grudge] Backend sync complete:", data.results);
      }
    } catch (e: any) {
      console.warn("[grudge] Backend sync failed:", e.message);
    }
  },

  getWeaponById: (id: string) => {
    const { weapons } = get();
    for (const items of Object.values(weapons)) {
      const found = items.find((w) => w.id === id);
      if (found) return found;
    }
    return undefined;
  },

  getSkillsForWeapon: (weaponType: string) => {
    return get().skills[weaponType] || [];
  },

  getMaterialsByCategory: (category: string) => {
    return get().materials[category] || [];
  },

  getArmorBySet: (set: string) => {
    const out: GrudgeArmor[] = [];
    for (const items of Object.values(get().armor)) {
      for (const a of items) if (a.set === set) out.push(a);
    }
    return out;
  },

  getConsumablesByCategory: (category: string) => {
    return get().consumables[category] || [];
  },

  getTierColor: (tier: number) => {
    const eq = get().equipment;
    if (!eq || !eq.tiers[String(tier)]) return "#9ca3af";
    return eq.tiers[String(tier)].color;
  },
}));
