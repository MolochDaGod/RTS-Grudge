/**
 * VendorRegistry — three faction shops, one per faction vendor hero.
 *
 * Vendors
 *   Crusade : Archmage Elara Brightspire (hero_elara)
 *   Fabled  : Lyra Stormweaver           (hero_lyra)
 *   Legion  : Necromancer Vexis          (hero_vexis)
 *
 * Currency: `gold_coin` items from the player's inventory (useInventory).
 * Each purchase calls: removeItem("gold_coin", cost) + addItem(item).
 */

import type { FactionId } from "./HeroRegistry";
import type { InventoryItem } from "@/lib/stores/useInventory";

// ─────────────────────────────────────────────────────────────────────────────

export interface VendorItem {
  /** Unique vendor listing id — may differ from the inventory item id when the
   *  vendor sells a variant or bundle. */
  listingId: string;
  /** Cost in gold_coin items. */
  price: number;
  /** Max purchasable per real day. 0 = unlimited. */
  dailyLimit: number;
  /** The inventory item added to the player on purchase. */
  item: Omit<InventoryItem, "quantity"> & { quantity: number };
}

export interface VendorShop {
  faction: FactionId;
  vendorHeroId: string;
  shopName: string;
  description: string;
  items: VendorItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Crusade shop — Elara Brightspire
// Holy, arcane, and restorative goods for Crusade soldiers.
// ─────────────────────────────────────────────────────────────────────────────

const CRUSADE_SHOP: VendorShop = {
  faction: "crusade",
  vendorHeroId: "hero_elara",
  shopName: "Elara's Arcane Dispensary",
  description: "The Archmage stocks only what she deems worthy. Her prices are fair. Her patience is not.",
  items: [
    {
      listingId: "crusade_holy_potion",
      price: 80,
      dailyLimit: 5,
      item: {
        id: "holy_potion", name: "Holy Potion", type: "consumable",
        healAmount: 60, icon: "✨",
        description: "A vial of pure arcane light. Heals 60 HP.",
        quantity: 1,
      },
    },
    {
      listingId: "crusade_mana_potion",
      price: 60,
      dailyLimit: 5,
      item: {
        id: "mana_potion", name: "Mana Potion", type: "consumable",
        icon: "💙", description: "Restores mana. Crusade-blessed.",
        quantity: 1,
      },
    },
    {
      listingId: "crusade_stamina_tonic",
      price: 50,
      dailyLimit: 5,
      item: {
        id: "stamina_tonic", name: "Stamina Tonic", type: "consumable",
        staminaRestore: 50, icon: "🧪",
        description: "Brewed from Jade Seas herb extracts.",
        quantity: 1,
      },
    },
    {
      listingId: "crusade_crystal_bundle",
      price: 40,
      dailyLimit: 3,
      item: {
        id: "crystal", name: "Crystal Shard", type: "material",
        icon: "💎", description: "Pure crystalline material for crafting.",
        quantity: 3,
      },
    },
    {
      listingId: "crusade_iron_sword",
      price: 300,
      dailyLimit: 1,
      item: {
        id: "iron_sword", name: "Iron Sword", type: "weapon",
        damage: 35, icon: "⚔️",
        description: "Forged with Crusade steel. Balanced for any class.",
        quantity: 1,
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Fabled shop — Lyra Stormweaver
// Elvish and runic goods, nature materials, arcane amplifiers.
// ─────────────────────────────────────────────────────────────────────────────

const FABLED_SHOP: VendorShop = {
  faction: "fabled",
  vendorHeroId: "hero_lyra",
  shopName: "Lyra's Crystal Spire Outpost",
  description: "Four centuries of collecting. She has seen better stock, but this is what travels well.",
  items: [
    {
      listingId: "fabled_nature_salve",
      price: 70,
      dailyLimit: 5,
      item: {
        id: "herbal_poultice", name: "Nature Salve", type: "consumable",
        healAmount: 45, icon: "🌿",
        description: "An elvish poultice. Heals 45 HP and cures minor poison.",
        quantity: 1,
      },
    },
    {
      listingId: "fabled_crystal_bundle",
      price: 35,
      dailyLimit: 5,
      item: {
        id: "crystal", name: "Crystal Shard", type: "material",
        icon: "💎", description: "Resonant crystals from the Frozen Reach.",
        quantity: 3,
      },
    },
    {
      listingId: "fabled_runic_scroll",
      price: 120,
      dailyLimit: 2,
      item: {
        id: "runic_scroll", name: "Runic Scroll", type: "consumable",
        icon: "📜",
        description: "Grants +20% spell damage for 60 seconds when used.",
        duration: 60,
        quantity: 1,
      },
    },
    {
      listingId: "fabled_herb_bundle",
      price: 25,
      dailyLimit: 0,
      item: {
        id: "herb", name: "Herb Bundle", type: "material",
        icon: "🌱", description: "A handful of rare Frozen Reach herbs.",
        quantity: 5,
      },
    },
    {
      listingId: "fabled_stone_spear",
      price: 180,
      dailyLimit: 1,
      item: {
        id: "stone_spear", name: "Moonblade Spear", type: "weapon",
        damage: 22, icon: "🔱",
        description: "Elvish-carved stone spear. Excellent reach.",
        quantity: 1,
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Legion shop — Necromancer Vexis
// Dark reagents, power elixirs, shadow consumables.
// ─────────────────────────────────────────────────────────────────────────────

const LEGION_SHOP: VendorShop = {
  faction: "legion",
  vendorHeroId: "hero_vexis",
  shopName: "Vexis's Soul Market",
  description: "She does not charge for the memories of the dead. Just the components. Consider yourself lucky.",
  items: [
    {
      listingId: "legion_dark_elixir",
      price: 90,
      dailyLimit: 4,
      item: {
        id: "dark_elixir", name: "Dark Elixir", type: "consumable",
        healAmount: 20, icon: "🫧",
        description: "Heals 20 HP and boosts damage by +15 for 30 seconds.",
        duration: 30,
        quantity: 1,
      },
    },
    {
      listingId: "legion_health_potion",
      price: 55,
      dailyLimit: 0,
      item: {
        id: "health_potion", name: "Health Potion", type: "consumable",
        healAmount: 50, icon: "❤️",
        description: "Standard battlefield restorative.",
        quantity: 1,
      },
    },
    {
      listingId: "legion_shadow_dust",
      price: 65,
      dailyLimit: 3,
      item: {
        id: "shadow_dust", name: "Shadow Dust", type: "consumable",
        icon: "🌑",
        description: "On use: grants 5 seconds of invisibility to enemies.",
        duration: 5,
        quantity: 1,
      },
    },
    {
      listingId: "legion_gold_ore_bundle",
      price: 30,
      dailyLimit: 5,
      item: {
        id: "gold_ore", name: "Gold Ore", type: "material",
        icon: "🥇",
        description: "Pure Legion-mined gold ore.",
        quantity: 3,
      },
    },
    {
      listingId: "legion_iron_mace",
      price: 320,
      dailyLimit: 1,
      item: {
        id: "iron_mace", name: "Legion War Mace", type: "weapon",
        damage: 38, icon: "🔨",
        description: "Heavy Legion-forged mace. Breaks shields and bones alike.",
        quantity: 1,
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────

export const ALL_VENDOR_SHOPS: VendorShop[] = [CRUSADE_SHOP, FABLED_SHOP, LEGION_SHOP];

export function getShopForHero(heroId: string): VendorShop | undefined {
  return ALL_VENDOR_SHOPS.find((s) => s.vendorHeroId === heroId);
}

export function getShopForFaction(faction: FactionId): VendorShop | undefined {
  return ALL_VENDOR_SHOPS.find((s) => s.faction === faction);
}
