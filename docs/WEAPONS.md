# Weapon Prefabs & Object Storage

> Full catalogue of weapon types, tiers, class restrictions, and CDN asset paths.

---

## CDN Base URL

```
https://molochdagod.github.io/ObjectStore/icons/pack
```

Backed by Cloudflare R2 at `assets.grudge-studio.com`. GitHub Pages mirror at the above URL.

---

## Weapon Types (17)

| ID | Display | Emoji | CDN Folder | Model Source |
|---|---|---|---|---|
| `sword` | Sword | ⚔️ | `weapons/swords/` | Craftpix swords pack (24 variants) |
| `greatsword` | Greatsword | ⚔️ | `weapons/greatswords/` | Craftpix + KayKit |
| `axe` | Axe | 🪓 | `weapons/axes/` | Craftpix axes pack (24 variants) |
| `hammer` | Hammer | 🔨 | `weapons/hammers/` | Craftpix hammers |
| `mace` | Mace | ⚒️ | `weapons/maces/` | KayKit weapons |
| `dagger` | Dagger | 🗡️ | `weapons/daggers/` | Craftpix daggers (24 variants) |
| `poleaxe` | Poleaxe | 🔱 | `weapons/lances/` | Craftpix poleaxes |
| `spear` | Spear | 🔱 | `weapons/lances/` | Craftpix spears |
| `bow` | Bow | 🏹 | `weapons/bows/` | Craftpix bows (24 variants) |
| `crossbow` | Crossbow | 🎯 | `weapons/crossbows/` | Craftpix crossbows (24 variants) |
| `gun` | Gun | 🔫 | `weapons/guns/` | Firearm pack (8 models) |
| `staff` | Staff | 🪄 | `weapons/staves/` | Craftpix staffs (24 variants) |
| `tome` | Tome | 📖 | `weapons/tomes/` | KayKit off-hand |
| `wand` | Wand | ✨ | `weapons/wands/` | Craftpix wands |
| `shield` | Shield | 🛡️ | `weapons/shields/` | Craftpix shields |
| `relic` | Relic | 🔮 | `weapons/focuses/` | Off-hand relics |
| `fists` | Fists | 👊 | `weapons/fists/` | (no model — unarmed) |

---

## Class Weapon Restrictions

| Class | Allowed Weapons |
|---|---|
| **Warrior** | sword, greatsword, shield, axe, poleaxe, hammer, mace |
| **Mage** | staff, tome, wand, mace, relic |
| **Ranger** | bow, crossbow, gun, dagger, greatsword, spear |
| **Worge** | staff, spear, dagger, bow, hammer, mace, relic |

---

## Tier System

| Tier | Label | DMG Mult | Colour | Glow |
|---|---|---|---|---|
| T0 | Starter | 0.5× | `#666666` | none |
| T1 | Common | 1.0× | `#8b7355` | none |
| T2 | Uncommon | 1.3× | `#a8a8a8` | 4px silver |
| T3 | Rare | 1.6× | `#4a9eff` | 6px blue |
| T4 | Epic | 2.0× | `#9d4dff` | 8px purple |
| T5 | Legendary | 2.5× | `#ff4d4d` | 10px red |
| T6 | Mythic | 3.0× | `#ffaa00` | 12px gold |
| T7 | Ancient | 3.5× | `#d4a84b` | 14px amber |
| T8 | Artifact | 4.0× | `#f0d890` | 16px light gold |

---

## Armor Types

### 3 Materials × 8 Slots × 6 Rarities = 144 Base Armor Prefabs

**Materials:** `cloth` · `leather` · `metal`

**Slots:** `helm` · `shoulder` · `chest` · `legs` · `boots` · `belt` · `gloves` · `cape`

**Rarities:** `common` · `uncommon` · `rare` · `epic` · `legendary` · `mythic`

### Armor CDN Path Pattern

```
{CDN_BASE}/armor/{material}/{slot}/{rarity}.png
```

Examples:
```
/armor/metal/helm/legendary.png
/armor/leather/chest/rare.png
/armor/cloth/gloves/uncommon.png
```

### Armor Class Restrictions

| Armor Type | Cloth | Leather | Metal |
|---|---|---|---|
| Warrior | ✗ | ○ | ✓ |
| Mage | ✓ | ○ | ✗ |
| Ranger | ○ | ✓ | ✗ |
| Worge | ✓ | ✓ | ✗ |

---

## 3D Model Sources

### Weapon Models (in `/public/models/`)

| Pack | Count | Path |
|---|---|---|
| Weapon Pack (medieval) | 28 | `/models/weapons/` |
| KayKit weapons | 22 | `/models/kaykit_weapons/` |
| Quaternius weapons | 24 | `/models/weapons_quaternius/` |
| RPG Items | varies | `/models/rpg_items/` |

### Off-hand Slot Models

```
/models/weapons/offhand/Tome.glb
/models/weapons/offhand/Book.glb
/models/weapons/offhand/Skull.glb
/models/weapons/offhand/NatureShield.glb
/models/weapons/offhand/DarkShield.glb
```

---

## Code API

### Resolve an Icon URL

```ts
import { getWeaponIconUrl, getArmorIconUrl, WEAPON_TYPE_EMOJI } from "@/lib/data/ItemPrefabRegistry";

// Weapon icon (CDN)
const swordUrl = getWeaponIconUrl("sword", swordVariant);

// Weapon emoji fallback (always available)
const emoji = WEAPON_TYPE_EMOJI["staff"]; // "🪄"

// Armor icon (CDN)
const armorUrl = getArmorIconUrl(armorPrefab); // {CDN_BASE}/armor/leather/chest/rare.png
```

### Look Up All Items

```ts
import { getAllItems, getItemById, searchItems } from "@/lib/data/ItemPrefabRegistry";

// All weapons + armor
const all = getAllItems();

// Single item
const sword = getItemById("weapon_sword_v3");

// Search
const rareItems = searchItems({ rarity: "rare", category: "weapon" });
```

### Loot Drop Generation

```ts
import { generateLootDrop } from "@/lib/data/ItemPrefabRegistry";

// Generate a loot drop for a level-5 enemy
const drops = generateLootDrop({
  minTier:   2,
  maxTier:   4,
  count:     2,
  classHint: "warrior",
});
```

### Override System (Admin / Editor)

```ts
import { saveItemOverride, resetItemOverride, getItemOverride } from "@/lib/data/ItemPrefabRegistry";

// Override damage + icon
saveItemOverride({
  id:      "weapon_sword_v5",
  stats:   { damage: 120 },
  iconUrl: "https://custom-cdn.com/my-sword.png",
});

// Get current override (or undefined if default)
const override = getItemOverride("weapon_sword_v5");

// Reset to defaults
resetItemOverride("weapon_sword_v5");
```

---

## In-Game Weapon Assignment

Weapons are assigned to the player via `CharacterConfig.weaponRight` and `weaponLeft`:

```ts
// client/src/lib/stores/useGame.tsx
const config: CharacterConfig = {
  characterId:   "orc_scout-male",
  weaponRight:   "sword",     // main hand
  weaponLeft:    "shield",    // off-hand
  combatClass:   "melee",
  weaponModelRight: "iron_sword.glb",
  weaponModelLeft:  null,
};
```

### Bone Attachment Points

Weapons attach to character skeleton via `WeaponPrefabDatabase.ts` bone configs:

| Weapon Type | Right Hand Bone | Left Hand Bone |
|---|---|---|
| sword | `mixamorigRightHand` | — |
| sword + shield | `mixamorigRightHand` | `mixamorigLeftHand` |
| staff | `mixamorigRightHand` | `mixamorigLeftHand` (grip) |
| bow | `mixamorigRightHand` | `mixamorigLeftHand` |
| greatsword | `mixamorigRightHand` | — (two-hand flag) |

---

## Animation Packs by Weapon Type

| Weapon | Animation Pack | Key Animations |
|---|---|---|
| sword + shield | `glocomotion` | idle, walk, run, attack, block |
| greatsword | `glocomotion` | idle, walk, run, attack (wide swing) |
| bow | `glocomotion` + `longbow_locomotion` | idle_aim, draw, release, walk |
| staff | `glocomotion` | idle, walk, cast_a, cast_b |
| dagger | `glocomotion` | idle, walk, stab, combo |

All packs are Mixamo-compatible rigs (standard skeleton, no custom bind pose).
