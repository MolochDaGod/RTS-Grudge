import type { EquipItem } from "@/lib/stores/useEquipment";
import { WEAPON_VARIANTS, type WeaponTypeId } from "./WeaponSkillData";

export type WeaponSkillNodeType = "sig" | "ability" | "passive";

export interface WeaponSkillNode {
  name: string;
  desc: string;
  type: WeaponSkillNodeType;
}

export interface WeaponSkillTier {
  tier: number;
  label: string;
  nodes: WeaponSkillNode[];
}

export interface WeaponSkillSource {
  name: string;
  baseName?: string;
  iconUrl?: string;
  tier?: number;
  tierLabel?: string;
  lore?: string;
  description?: string;
  craftedBy?: string;
  category?: string;
  abilities?: string[];
  signature?: string;
  passives?: string[];
}

const OBJECT_STORE_API = "https://molochdagod.github.io/ObjectStore/api/v1";

const WEAPON_TYPE_TO_CATEGORY: Record<string, string> = {
  sword: "swords",
  axe: "axes1h",
  dagger: "daggers",
  greatsword: "greatswords",
  greataxe: "greataxes",
  hammer: "hammers1h",
  greathammer: "hammers2h",
  mace: "maces",
  bow: "bows",
  crossbow: "crossbows",
  gun: "guns",
  staff: "fireStaves",
  shield: "shields",
  lance: "spears",
  spear: "spears",
  tome: "tomes",
  wand: "wands",
  focus: "relics",
};

let catalogPromise: Promise<WeaponSkillSource[]> | null = null;

async function fetchWeaponCatalog(): Promise<WeaponSkillSource[]> {
  if (!catalogPromise) {
    catalogPromise = fetch(`${OBJECT_STORE_API}/master-weapons.json`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => (data.items || []) as WeaponSkillSource[])
      .catch(() => [] as WeaponSkillSource[]);
  }
  return catalogPromise;
}

export function parseSkillLine(line: string): { name: string; desc: string } {
  if (!line) return { name: "", desc: "" };
  const name = line.split("(")[0].trim();
  const desc = line.includes("(") ? line.match(/\((.+)\)/)?.[1] || "" : "";
  return { name, desc };
}

export function buildWeaponSkillTiers(weapon: WeaponSkillSource | null | undefined): WeaponSkillTier[] {
  if (!weapon) return [];

  const abilities = (weapon.abilities || []).map((a) => {
    const p = parseSkillLine(a);
    return { name: p.name, desc: p.desc, type: "ability" as const };
  });
  const passives = (weapon.passives || []).map((p) => {
    const parsed = parseSkillLine(p);
    return { name: parsed.name, desc: parsed.desc, type: "passive" as const };
  });
  const sig = weapon.signature
    ? (() => {
        const p = parseSkillLine(weapon.signature!);
        return { name: p.name, desc: p.desc, type: "sig" as const };
      })()
    : null;

  const tiers: WeaponSkillTier[] = [];
  const ab = [...abilities];
  const pa = [...passives];

  const t1: WeaponSkillNode[] = [];
  if (sig) t1.push(sig);
  if (ab.length) t1.push(ab.shift()!);
  if (t1.length) tiers.push({ tier: 1, label: "T1", nodes: t1 });

  const t2: WeaponSkillNode[] = [];
  if (ab.length) t2.push(ab.shift()!);
  if (ab.length) t2.push(ab.shift()!);
  if (t2.length) tiers.push({ tier: 2, label: "T2", nodes: t2 });

  const t3: WeaponSkillNode[] = [];
  if (ab.length) t3.push(ab.shift()!);
  if (pa.length) t3.push(pa.shift()!);
  if (t3.length) tiers.push({ tier: 3, label: "T3", nodes: t3 });

  const t4: WeaponSkillNode[] = [];
  if (ab.length) t4.push(ab.shift()!);
  if (ab.length) t4.push(ab.shift()!);
  if (t4.length) tiers.push({ tier: 4, label: "T4", nodes: t4 });

  let tierNum = 5;
  while (ab.length || pa.length) {
    const tn: WeaponSkillNode[] = [];
    if (ab.length) tn.push(ab.shift()!);
    if (pa.length) tn.push(pa.shift()!);
    if (tn.length) tiers.push({ tier: tierNum, label: `T${tierNum}`, nodes: tn });
    tierNum += 1;
    if (tierNum > 8) break;
  }

  return tiers;
}

function variantToSource(
  variant: { name: string; lore: string; abilities: string[]; sig: string; passives: string[] },
  equip: EquipItem,
): WeaponSkillSource {
  return {
    name: variant.name,
    baseName: variant.name,
    tier: equip.tier,
    lore: variant.lore,
    abilities: variant.abilities,
    signature: variant.sig,
    passives: variant.passives,
    category: equip.weaponType,
  };
}

function findPrefabVariant(equip: EquipItem): WeaponSkillSource | null {
  const wt = equip.weaponType as WeaponTypeId | undefined;
  if (!wt || !WEAPON_VARIANTS[wt]) return null;
  const variants = WEAPON_VARIANTS[wt];
  const byName = variants.find(
    (v) => v.name.toLowerCase() === equip.name.toLowerCase(),
  );
  if (byName) return variantToSource(byName, equip);
  const idx = Math.max(0, Math.min(variants.length - 1, (equip.tier || 1) - 1));
  return variantToSource(variants[idx], equip);
}

export async function resolveEquippedWeaponSkills(
  equip: EquipItem | undefined,
): Promise<WeaponSkillSource | null> {
  if (!equip) return null;

  const catalog = await fetchWeaponCatalog();

  if (equip.id.startsWith("ITEM-")) {
    const hit = catalog.find((w) => w.uuid === equip.id || (w as { id?: string }).id === equip.id);
    if (hit) return hit;
  }

  const byName = catalog.find(
    (w) =>
      w.name?.toLowerCase() === equip.name.toLowerCase() ||
      w.baseName?.toLowerCase() === equip.name.toLowerCase(),
  );
  if (byName) return byName;

  const cat = equip.weaponType ? WEAPON_TYPE_TO_CATEGORY[equip.weaponType] : undefined;
  if (cat) {
    const tier = equip.tier || 1;
    const byCat = catalog.find((w) => w.category === cat && (w.tier || 1) === tier);
    if (byCat) return byCat;
    const anyCat = catalog.find((w) => w.category === cat && (w.tier || 1) === 1);
    if (anyCat) return anyCat;
  }

  return findPrefabVariant(equip);
}

export const TIER_COLORS: Record<number, string> = {
  1: "#8b7355",
  2: "#a8a8a8",
  3: "#4a9eff",
  4: "#9d4dff",
  5: "#ff4d4d",
  6: "#ffaa00",
  7: "#d4a84b",
  8: "#f0d890",
};