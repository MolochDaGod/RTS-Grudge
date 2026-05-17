/**
 * ArmorPrefabDatabase — Complete armour definitions for Grudge Warlords.
 *
 * 3 material types: cloth · leather · metal
 * 8 equipment slots:
 *   helm · shoulder · chest · legs · boots · belt · gloves · cape
 * 6 named variants per slot × material (common → legendary)
 * Cape has an active effect + cooldown (no swapping mid-fight).
 *
 * Stat conventions (per game design):
 *   cloth  → mana, manaRegen, spellAccuracy, healthRegen (mage/worge)
 *   leather→ evasion, dodge, attackSpeed, movementSpeed (ranger/worge)
 *   metal  → defense, armor, block, stagger         (warrior)
 */

import type { EquipSlot, StatKey, ItemTier } from "@/lib/stores/useEquipment";

export type ArmorMaterial = "cloth" | "leather" | "metal";
export type ArmorSlot = Exclude<EquipSlot, "mainHand" | "offHand" | "ring" | "necklace">;

export const ARMOR_SLOT_LABELS: Record<ArmorSlot, string> = {
  helm:     "Helm",
  shoulder: "Shoulders",
  chest:    "Chest",
  legs:     "Legs",
  boots:    "Boots",
  belt:     "Belt",
  gloves:   "Gloves",
  cape:     "Cape",
};

export type ArmorRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export const ARMOR_RARITY_COLORS: Record<ArmorRarity, string> = {
  common:    "#b0b0b0",
  uncommon:  "#4caf50",
  rare:      "#42a5f5",
  epic:      "#ab47bc",
  legendary: "#ff9800",
  mythic:    "#f0d890",
};

export const ARMOR_TIER_MAP: Record<ArmorRarity, ItemTier> = {
  common:    1,
  uncommon:  2,
  rare:      3,
  epic:      4,
  legendary: 5,
  mythic:    6,
};

/** Cape-specific active ability */
export interface CapeActiveAbility {
  name: string;
  description: string;
  icon: string;
  cooldownSeconds: number;
  effect: string; // applied to character stats or triggers an event
}

export interface ArmorPrefab {
  id: string;
  name: string;
  slot: ArmorSlot;
  material: ArmorMaterial;
  rarity: ArmorRarity;
  tier: ItemTier;
  lore: string;
  icon: string;  // emoji fallback
  iconUrl?: string; // CDN url resolved at runtime by ItemPrefabRegistry
  stats: Partial<Record<StatKey, number>>;
  /** Passive bonus label shown in tooltip */
  passive?: string;
  /** Cape only — active ability with cooldown */
  capeActive?: CapeActiveAbility;
  /** Classes that can equip this armour */
  classes?: string[];
  /** Set bonus id — e.g. "crusader_set" */
  setId?: string;
}

// ---------------------------------------------------------------------------
// Stat budgets per slot (base at tier 1, scaled by rarity multiplier)
// ---------------------------------------------------------------------------
const RARITY_MULT: Record<ArmorRarity, number> = {
  common: 1, uncommon: 1.4, rare: 1.9, epic: 2.6, legendary: 3.5, mythic: 5.0,
};

function scale(base: number, rarity: ArmorRarity): number {
  return Math.round(base * RARITY_MULT[rarity]);
}

// ---------------------------------------------------------------------------
// CLOTH ARMOUR  (mage / worge — mana focus)
// ---------------------------------------------------------------------------

const CLOTH_NAMES: Record<ArmorSlot, string[]> = {
  helm:     ["Scholar Cap",      "Mystic Hood",      "Arcane Cowl",     "Void Crown",       "Spellweaver Tiara",  "Mythweave Diadem"],
  shoulder: ["Scholar Wrap",     "Mystic Pauldrons", "Arcane Mantle",   "Void Veil",        "Spellweaver Drape",  "Mythweave Shroud"],
  chest:    ["Scholar Robe",     "Mystic Vestment",  "Arcane Gown",     "Void Robes",       "Spellweaver Coat",   "Mythweave Regalia"],
  legs:     ["Scholar Breeches", "Mystic Leggings",  "Arcane Trousers", "Void Pants",       "Spellweaver Skirts", "Mythweave Legwraps"],
  boots:    ["Scholar Sandals",  "Mystic Slippers",  "Arcane Steps",    "Void Treads",      "Spellweaver Boots",  "Mythweave Walkers"],
  belt:     ["Scholar Sash",     "Mystic Girdle",    "Arcane Band",     "Void Cinch",       "Spellweaver Cord",   "Mythweave Weave"],
  gloves:   ["Scholar Fingers",  "Mystic Gloves",    "Arcane Wrap",     "Void Mittens",     "Spellweaver Grips",  "Mythweave Casters"],
  cape:     ["Scholar Cloak",    "Mystic Cape",      "Arcane Veil",     "Void Mantle",      "Spellweaver Wrap",   "Mythweave Flowing"],
};

const CLOTH_LORES: Record<ArmorSlot, string[]> = {
  helm:     ["Woven for study","Attuned to ley lines","Bound with runes","Pulsing with void","Woven by archmages","Myth-threaded"],
  shoulder: ["Draped in theory","Etched with glyphs","Laced with energy","Wrapped in shadow","Formed by spell","Myth-woven"],
  chest:    ["Stitched with wisdom","Imbibed with mana","Pulsing with power","Void-kissed silk","Spun by archmages","Myth-forged cloth"],
  legs:     ["Comfortable for long study","Nimble enchanted","Arcane-stitched","Void-hem","Speed-woven","Myth-thread legs"],
  boots:    ["Quiet for the library","Muffled magic","Rune-stepped","Void-treads","Arcane-soled","Myth-walkers"],
  belt:     ["Holds scrolls","Clasped with gems","Arcane-buckle","Void-cinched","Spell-cord","Myth-sash"],
  gloves:   ["Nimble fingers","Channeling cast","Rune-tipped","Void-touched","Arcane-palmed","Myth-grips"],
  cape:     ["Billows in still air","Swirls with power","Ripples with energy","Void-tinged","Arcane-drifting","Myth-flowing"],
};

const CLOTH_CAPE_ACTIVES: CapeActiveAbility[] = [
  { name: "Mana Surge",     description: "Instantly restore 20 mana",                  icon: "💙", cooldownSeconds: 30, effect: "restoreMana:20" },
  { name: "Arcane Veil",    description: "Grant 5s spell immunity",                    icon: "🔮", cooldownSeconds: 45, effect: "spellImmunity:5" },
  { name: "Phase Shift",    description: "Become ethereal for 3s, dodge all attacks",  icon: "👻", cooldownSeconds: 60, effect: "ethereal:3" },
  { name: "Void Step",      description: "Teleport 8m forward",                        icon: "🕳️", cooldownSeconds: 20, effect: "teleport:8" },
  { name: "Arcane Torrent", description: "Boost spell damage 40% for 8s",              icon: "✨", cooldownSeconds: 50, effect: "spellDamageBuff:40:8" },
  { name: "Myth Weave",     description: "Reflect 30% of incoming magical damage",      icon: "🌀", cooldownSeconds: 90, effect: "magicReflect:30" },
];

// ---------------------------------------------------------------------------
// LEATHER ARMOUR (ranger / worge — agility focus)
// ---------------------------------------------------------------------------

const LEATHER_NAMES: Record<ArmorSlot, string[]> = {
  helm:     ["Tracker Hood",     "Scout Cap",         "Shadow Cowl",     "Hunter Crown",       "Stalker Visor",    "Phantom Faceguard"],
  shoulder: ["Tracker Guards",   "Scout Pads",        "Shadow Spaulders", "Hunter Drape",      "Stalker Caps",     "Phantom Plates"],
  chest:    ["Tracker Vest",     "Scout Jerkin",      "Shadow Tunic",    "Hunter Coat",        "Stalker Cuirass",  "Phantom Breastguard"],
  legs:     ["Tracker Pants",    "Scout Leathers",    "Shadow Trousers", "Hunter Leggings",    "Stalker Greaves",  "Phantom Legguards"],
  boots:    ["Tracker Boots",    "Scout Shoes",       "Shadow Steps",    "Hunter Treads",      "Stalker Soles",    "Phantom Walkers"],
  belt:     ["Tracker Strap",    "Scout Belt",        "Shadow Wrap",     "Hunter Clasp",       "Stalker Girth",    "Phantom Sash"],
  gloves:   ["Tracker Grips",    "Scout Wraps",       "Shadow Gauntlets","Hunter Fingers",     "Stalker Mitts",    "Phantom Gloves"],
  cape:     ["Tracker Cloak",    "Scout Drape",       "Shadow Shroud",   "Hunter Mantle",      "Stalker Wrap",     "Phantom Veil"],
};

const LEATHER_LORES: Record<ArmorSlot, string[]> = {
  helm:     ["For swift sight","Stitched for stealth","Shadowed leather","Hunted and earned","Worn by master stalkers","Phantom-light"],
  shoulder: ["Cut for movement","Thinned for speed","Shadowed pads","Hunter's own","Stalker-grade","Phantom-weight"],
  chest:    ["Hardened yet supple","Scouted paths","Shadow-cured","Hunter's chest","Stalker-grade","Phantom-woven"],
  legs:     ["Quick through brush","Scout-cut","Shadow-seam","Hunter-stitched","Stalker-grade","Phantom-thread"],
  boots:    ["Silent as dusk","Scout-soled","Shadow-tread","Hunter-soled","Stalker-tread","Phantom-step"],
  belt:     ["Holds arrows close","Scout-clasp","Shadow-strap","Hunter-girth","Stalker-band","Phantom-cord"],
  gloves:   ["Nocked and fired","Scout-palmed","Shadow-grip","Hunter fingers","Stalker-gloves","Phantom-touch"],
  cape:     ["Wind-worn in the field","Whisper-light","Shadow-drift","Hunter-flow","Stalker-veil","Phantom-wisp"],
};

const LEATHER_CAPE_ACTIVES: CapeActiveAbility[] = [
  { name: "Vanish",         description: "Enter stealth for 5s, +30% next attack damage",  icon: "👤", cooldownSeconds: 25, effect: "stealth:5:critBonus:30" },
  { name: "Wind Sprint",    description: "Increase movement speed 50% for 4s",             icon: "💨", cooldownSeconds: 20, effect: "speedBuff:50:4" },
  { name: "Shadow Meld",    description: "Become invisible for 8s (breaks on attack)",     icon: "🌑", cooldownSeconds: 40, effect: "invisible:8" },
  { name: "Predator Rush",  description: "Dash 12m and deal 60 damage to first target",    icon: "🏃", cooldownSeconds: 18, effect: "dash:12:damage:60" },
  { name: "Eagle Eye",      description: "Reveal all enemies in 20m for 10s",              icon: "👁️", cooldownSeconds: 35, effect: "reveal:20:10" },
  { name: "Ghost Step",     description: "Phase through obstacles, ignore collisions 6s",  icon: "👻", cooldownSeconds: 60, effect: "noclip:6" },
];

// ---------------------------------------------------------------------------
// METAL ARMOUR (warrior — defense focus)
// ---------------------------------------------------------------------------

const METAL_NAMES: Record<ArmorSlot, string[]> = {
  helm:     ["Iron Helm",     "Steel Basinet",    "Knight Visor",    "Crusader Crown",     "Champion Faceplate", "Titan Warhelm"],
  shoulder: ["Iron Pauldrons","Steel Shoulders",  "Knight Guards",   "Crusader Spaulders", "Champion Plates",    "Titan Bulwarks"],
  chest:    ["Iron Breastplate","Steel Cuirass",  "Knight Hauberk",  "Crusader Armor",     "Champion Mail",      "Titan Fortress"],
  legs:     ["Iron Greaves",  "Steel Legplates",  "Knight Cuisses",  "Crusader Tassets",   "Champion Legguards", "Titan Legplates"],
  boots:    ["Iron Sabatons", "Steel Stompers",   "Knight Treads",   "Crusader Boots",     "Champion Sabatons",  "Titan Stompers"],
  belt:     ["Iron Girdle",   "Steel Girdle",     "Knight Waist",    "Crusader Cord",      "Champion Waist",     "Titan Clasp"],
  gloves:   ["Iron Gauntlets","Steel Gauntlets",  "Knight Fists",    "Crusader Grips",     "Champion Gauntlets", "Titan Fists"],
  cape:     ["Iron Cloak",    "Steel Mantle",     "Knight Tabard",   "Crusader Banner",    "Champion Drape",     "Titan Shroud"],
};

const METAL_LORES: Record<ArmorSlot, string[]> = {
  helm:     ["Forged to last","Tempered in battle","Proven in siege","Blessed by crusade","Worn by champions","Titan-forged"],
  shoulder: ["Riveted for war","Hammered true","Knight-stamped","Crusade-blessed","Champion-wrought","Titan-plated"],
  chest:    ["Standard issue","Battle-hardened","Knight-grade","Crusade-armored","Champion-proved","Titan-hammered"],
  legs:     ["March-ready","Battle-worn","Knight-grade","Crusade-stomped","Champion-tested","Titan-marched"],
  boots:    ["Crushed many paths","Battle-trodden","Knight-soled","Crusade-stamped","Champion-marched","Titan-tread"],
  belt:     ["Holds the line","Battle-clasped","Knight-bound","Crusade-girt","Champion-buckled","Titan-cinched"],
  gloves:   ["Iron grip","Battle-fisted","Knight-palmed","Crusade-gripped","Champion-fists","Titan-gauntlets"],
  cape:     ["Bears faction colors","Battle-tattered","Knight-tabard","Crusade-banner","Champion-drape","Titan-mantle"],
};

const METAL_CAPE_ACTIVES: CapeActiveAbility[] = [
  { name: "Iron Bulwark",   description: "Absorb next 150 damage dealt to you",             icon: "🛡️", cooldownSeconds: 35, effect: "damageShield:150" },
  { name: "War Cry",        description: "Increase nearby ally damage 25% for 8s",          icon: "📣", cooldownSeconds: 40, effect: "allyDamageBuff:25:8:radius:10" },
  { name: "Rallying Shout", description: "Restore 30 health to all allies within 8m",       icon: "⚔️", cooldownSeconds: 30, effect: "healAllies:30:8" },
  { name: "Titan Slam",     description: "Stomp the ground, stun all enemies within 5m 3s", icon: "💥", cooldownSeconds: 50, effect: "aoeStun:5:3" },
  { name: "Crusade Banner", description: "Plant banner; allies gain +20% defense for 12s",  icon: "🏴", cooldownSeconds: 60, effect: "defBanner:20:12" },
  { name: "Indomitable",    description: "Become immune to CC and take 50% less damage 6s", icon: "🏔️", cooldownSeconds: 90, effect: "cCImmune:6:damageReduction:50" },
];

// ---------------------------------------------------------------------------
// BASE STAT BUDGETS per slot per material (at tier 1 / common rarity)
// ---------------------------------------------------------------------------

type SlotStats = Partial<Record<StatKey, number>>;

const CLOTH_BASE: Record<ArmorSlot, SlotStats> = {
  helm:     { mana: 25, manaRegen: 2 },
  shoulder: { mana: 18, spellAccuracy: 3 },
  chest:    { mana: 40, healthRegen: 2 },
  legs:     { mana: 28, manaRegen: 1 },
  boots:    { mana: 16, movementSpeed: 2 },
  belt:     { mana: 20, cooldownReduction: 2 },
  gloves:   { mana: 15, spellAccuracy: 4 },
  cape:     { mana: 22, manaRegen: 3 },
};

const LEATHER_BASE: Record<ArmorSlot, SlotStats> = {
  helm:     { evasion: 8,  attackSpeed: 2 },
  shoulder: { dodge: 6,    movementSpeed: 3 },
  chest:    { evasion: 14, defense: 5 },
  legs:     { dodge: 10,   movementSpeed: 4 },
  boots:    { movementSpeed: 6, evasion: 6 },
  belt:     { attackSpeed: 4,   evasion: 5 },
  gloves:   { attackSpeed: 5,   accuracy: 5 },
  cape:     { evasion: 7,  dodge: 5 },
};

const METAL_BASE: Record<ArmorSlot, SlotStats> = {
  helm:     { defense: 18, armor: 12 },
  shoulder: { defense: 12, block: 5 },
  chest:    { defense: 30, armor: 20 },
  legs:     { defense: 20, armor: 14 },
  boots:    { defense: 12, stagger: 3 },
  belt:     { defense: 10, armor: 8 },
  gloves:   { defense: 8,  stagger: 4 },
  cape:     { defense: 14, block: 6 },
};

// ---------------------------------------------------------------------------
// Build all armour prefabs
// ---------------------------------------------------------------------------

const RARITIES: ArmorRarity[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
const SLOTS: ArmorSlot[] = ["helm", "shoulder", "chest", "legs", "boots", "belt", "gloves", "cape"];
const MATERIALS: ArmorMaterial[] = ["cloth", "leather", "metal"];

const MATERIAL_ICONS: Record<ArmorMaterial, Record<ArmorSlot, string>> = {
  cloth:   { helm: "🧢", shoulder: "🧣", chest: "👘", legs: "🩲", boots: "🥿", belt: "➰", gloves: "🧤", cape: "🦋" },
  leather: { helm: "🎩", shoulder: "🪬", chest: "🧥", legs: "🩱", boots: "👞", belt: "⬛", gloves: "🥊", cape: "🦅" },
  metal:   { helm: "⛑️",  shoulder: "🔩", chest: "🛡️", legs: "⚙️", boots: "👢", belt: "🔗", gloves: "🥋", cape: "🏴" },
};

const MATERIAL_CLASSES: Record<ArmorMaterial, string[]> = {
  cloth:   ["mage", "worge"],
  leather: ["ranger", "worge"],
  metal:   ["warrior"],
};

const PASSIVE_LABELS: Record<ArmorMaterial, Record<ArmorSlot, string>> = {
  cloth: {
    helm:     "Mana Clarity: +2% spell crit chance",
    shoulder: "Astral Flow: Spells cost 2% less mana",
    chest:    "Arcane Body: +3% all spell power",
    legs:     "Agile Mind: +2% cast speed",
    boots:    "Ley Walker: Mana regens 5% faster in combat",
    belt:     "Focal Point: -3% skill cooldowns",
    gloves:   "Precise Touch: +3% spell accuracy",
    cape:     "Mana Cloak: Blocking a hit restores 5 mana",
  },
  leather: {
    helm:     "Eagle Eye: +4% ranged accuracy",
    shoulder: "Nimble Shrug: +2% dodge chance",
    chest:    "Shadowstep Ready: Evasion refreshes 10% faster",
    legs:     "Swift Stride: +3% movement speed",
    boots:    "Ghostfoot: Leave no sound; +5% sneak bonus",
    belt:     "Quick Draw: +3% attack speed",
    gloves:   "Deadeye: +3% crit chance on ranged hits",
    cape:     "Wind Cloak: Evaded attacks grant +5% speed for 2s",
  },
  metal: {
    helm:     "Iron Will: +5% CC resistance",
    shoulder: "Stalwart: +3% block chance",
    chest:    "Bastion: +4% armor vs physical",
    legs:     "Heavy Steps: +3% knockback resistance",
    boots:    "Ground Hold: Cannot be pushed back",
    belt:     "Core Guard: +5 defense when below 30% HP",
    gloves:   "Iron Grip: +4% stagger chance",
    cape:     "Defender's Vow: Blocking restores 3 health",
  },
};

function buildArmorStats(
  slot: ArmorSlot,
  material: ArmorMaterial,
  rarity: ArmorRarity,
): SlotStats {
  const base = material === "cloth" ? CLOTH_BASE[slot]
    : material === "leather" ? LEATHER_BASE[slot]
    : METAL_BASE[slot];
  const out: SlotStats = {};
  for (const [k, v] of Object.entries(base)) {
    out[k as StatKey] = scale(v as number, rarity);
  }
  return out;
}

let _armorIdCounter = 0;
function makeArmorId(material: ArmorMaterial, slot: ArmorSlot, idx: number): string {
  return `${material}_${slot}_v${idx + 1}`;
}

export const ALL_ARMOR_PREFABS: ArmorPrefab[] = (() => {
  const result: ArmorPrefab[] = [];

  const getNames = (m: ArmorMaterial, s: ArmorSlot) =>
    m === "cloth" ? CLOTH_NAMES[s] : m === "leather" ? LEATHER_NAMES[s] : METAL_NAMES[s];
  const getLores = (m: ArmorMaterial, s: ArmorSlot) =>
    m === "cloth" ? CLOTH_LORES[s] : m === "leather" ? LEATHER_LORES[s] : METAL_LORES[s];
  const getCapeActives = (m: ArmorMaterial) =>
    m === "cloth" ? CLOTH_CAPE_ACTIVES : m === "leather" ? LEATHER_CAPE_ACTIVES : METAL_CAPE_ACTIVES;

  for (const material of MATERIALS) {
    for (const slot of SLOTS) {
      const names = getNames(material, slot);
      const lores = getLores(material, slot);
      const capeActives = getCapeActives(material);

      for (let i = 0; i < RARITIES.length; i++) {
        const rarity = RARITIES[i];
        const prefab: ArmorPrefab = {
          id:       makeArmorId(material, slot, i),
          name:     names[i],
          slot,
          material,
          rarity,
          tier:     ARMOR_TIER_MAP[rarity],
          lore:     lores[i] ?? "Forged in the old ways",
          icon:     MATERIAL_ICONS[material][slot],
          stats:    buildArmorStats(slot, material, rarity),
          passive:  PASSIVE_LABELS[material][slot],
          classes:  MATERIAL_CLASSES[material],
        };
        // Cape active ability (must be unique per variant, no swapping)
        if (slot === "cape") {
          prefab.capeActive = {
            ...capeActives[i],
            cooldownSeconds: capeActives[i].cooldownSeconds + i * 10, // scale CD with rarity
          };
        }
        result.push(prefab);
      }
    }
  }
  return result;
})();

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Get all armour for a given slot */
export function getArmorBySlot(slot: ArmorSlot): ArmorPrefab[] {
  return ALL_ARMOR_PREFABS.filter(a => a.slot === slot);
}

/** Get all armour for a given material */
export function getArmorByMaterial(material: ArmorMaterial): ArmorPrefab[] {
  return ALL_ARMOR_PREFABS.filter(a => a.material === material);
}

/** Get armour by rarity */
export function getArmorByRarity(rarity: ArmorRarity): ArmorPrefab[] {
  return ALL_ARMOR_PREFABS.filter(a => a.rarity === rarity);
}

/** Lookup by prefab id */
export function getArmorById(id: string): ArmorPrefab | undefined {
  return ALL_ARMOR_PREFABS.find(a => a.id === id);
}

/** Get armour usable by a class */
export function getArmorForClass(className: string): ArmorPrefab[] {
  return ALL_ARMOR_PREFABS.filter(a => !a.classes || a.classes.includes(className));
}

/** Get a starter armour set (one common per slot) per class */
export function getStarterSet(className: string): Record<ArmorSlot, ArmorPrefab> {
  const mat: ArmorMaterial = className === "warrior" ? "metal"
    : className === "ranger" ? "leather" : "cloth";
  const result = {} as Record<ArmorSlot, ArmorPrefab>;
  for (const slot of SLOTS) {
    const pieces = ALL_ARMOR_PREFABS.filter(a => a.slot === slot && a.material === mat && a.rarity === "common");
    result[slot] = pieces[0]!;
  }
  return result;
}

/** Convert an ArmorPrefab to a useEquipment EquipItem */
export function armorToEquipItem(armor: ArmorPrefab): import("@/lib/stores/useEquipment").EquipItem {
  return {
    id:     armor.id,
    name:   armor.name,
    slot:   armor.slot as import("@/lib/stores/useEquipment").EquipSlot,
    icon:   armor.icon,
    tier:   armor.tier,
    stats:  armor.stats,
    rarity: armor.rarity as import("@/lib/stores/useEquipment").EquipItem["rarity"],
  };
}

/** Summary counts for debugging */
export function getArmorDatabaseStats(): { total: number; byMaterial: Record<ArmorMaterial, number>; bySlot: Record<ArmorSlot, number> } {
  const byMaterial = { cloth: 0, leather: 0, metal: 0 };
  const bySlot: Record<string, number> = {};
  for (const a of ALL_ARMOR_PREFABS) {
    byMaterial[a.material]++;
    bySlot[a.slot] = (bySlot[a.slot] || 0) + 1;
  }
  return { total: ALL_ARMOR_PREFABS.length, byMaterial, bySlot: bySlot as Record<ArmorSlot, number> };
}
