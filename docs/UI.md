# UI Reference — Combat, Harvest & Build

> Complete specification for the three interaction modes, hotbar layout, skill icons, and UI layer architecture.

---

## Interaction Mode Toggle

The player cycles through three interaction modes with **Q**:

```
combat → harvest → build → combat → …
```

Current mode is stored in `useGame.interactionMode`:

```ts
import { useGame } from "@/lib/stores/useGame";

const mode = useGame(s => s.interactionMode);
// "combat" | "harvest" | "build"

useGame.getState().setInteractionMode("harvest");
useGame.getState().cycleInteractionMode(); // Q key
```

---

## Combat Mode

### HUD Elements (visible in combat)

```
┌────────────────────────────────────────────────────────┐
│  [Health Bar]    [Mana Bar]    [Stamina Bar]           │
│  ████████████    ████████      ████████                │
│                                                         │
│              [Target Frame + Health]                    │
│                                                         │
│  [Wave: 3]    [Enemy Count: 5]    [Score: 1240]        │
│                                                         │
│  [HOTBAR: 1][2][3][4][ ][6][7][8]                     │
│              ↑Skill slots  ↑Consumable slots           │
│                                                         │
│  [Minimap]                              [Clock/Phase]  │
└────────────────────────────────────────────────────────┘
```

### Hotbar Specification

```
Slot  Key   Type       Default Icon   Description
 0     1    skill      🔥             Skill 1 (class-based)
 1     2    skill      ⬆️             Skill 2
 2     3    skill      🌀             Skill 3
 3     4    attack     👊             Skill 4 / basic attack
 4     5    empty      —              Unused
 5     6    item       🍖             Consumable (food/potion)
 6     7    item       ❤️             Consumable (potion)
 7     8    item       —              Consumable (on-use relic)
```

### Skill Icons CDN Path

```
{CDN_BASE}/skills/{class}/{skillName}.png
```

Where `{CDN_BASE} = https://molochdagod.github.io/ObjectStore/icons/pack`

**Per-class skill icon paths:**

```
Warrior:
  skills/warrior/slash.png
  skills/warrior/guard.png
  skills/warrior/charge.png
  skills/warrior/aoe_sweep.png

Mage:
  skills/mage/fireball.png
  skills/mage/ice_bolt.png
  skills/mage/lightning.png
  skills/mage/aoe_burst.png

Ranger:
  skills/ranger/quick_shot.png
  skills/ranger/aimed_shot.png
  skills/ranger/dodge_roll.png
  skills/ranger/rapid_fire.png

Worge:
  skills/worge/claw.png
  skills/worge/leap.png
  skills/worge/transform.png
  skills/worge/howl.png
```

### Hotbar Action Slot API

```ts
import { useEquipment } from "@/lib/stores/useEquipment";

// Read all slots
const slots = useEquipment(s => s.actionSlots);

// Set a slot programmatically (from character select, level up, etc.)
useEquipment.getState().setActionSlot(0, {
  label:         "Fireball",
  animationName: "skill1",
  cooldown:      3,       // seconds
  icon:          "🔥",   // emoji fallback
  iconUrl:       `${CDN_BASE}/skills/mage/fireball.png`,
  type:          "skill",
});

// Use action (returns false if on cooldown)
const fired = useEquipment.getState().useAction(0);

// Clear a slot
useEquipment.getState().clearActionSlot(5);
```

### Class-Specific Default Hotbars

**Warrior**
```
[⚔ Slash]  [🛡 Block]  [💥 Charge]  [🌀 Sweep]  [ ]  [🍖 Food]  [❤️ HP]  [ ]
```

**Mage**
```
[🔥 Fire]  [💧 Ice]  [⚡ Lightning]  [📖 AOE]  [ ]  [🧪 Tonic]  [💙 Mana]  [ ]
```

**Ranger**
```
[🏹 Quick]  [🎯 Aim]  [💨 Dodge]  [🌀 Trap]  [ ]  [🥩 Meat]  [❤️ HP]  [ ]
```

**Worge**
```
[🐾 Claw]  [🐺 Leap]  [🌙 Transform]  [🌀 Howl]  [ ]  [🥩 Meat]  [🧪 Tonic]  [ ]
```

---

### Combat Controls Reference

| Input | Action |
|---|---|
| W/A/S/D | Move (camera-relative, forward = away from camera) |
| Hold LMB | Rotate camera |
| LMB (release) | Primary attack |
| RMB | Block / parry attempt |
| RMB + LMB | Ranger: counter dash after parry (0.5s stun window) |
| Q | Cycle interaction mode (combat → harvest → build) |
| R | Class ability 1 |
| E | Class ability 2 |
| X | Class ability 3 |
| Z | Z-key buff: stackable flame indicator above health, chat bubble trigger |
| Tab | Cycle target lock (WoW-style; shows target frame) |
| Space | Jump (Warriors: double-jump) |
| Shift | Sprint (Warriors: stamina-gated, enables charge attacks) |
| 1–8 | Activate hotbar slot |
| F | Interact / use item |
| M | Open world map |
| I | Open inventory |
| K | Open skill tree |
| Esc | Pause / close panels |

---

### Warrior Stamina System

Warriors have an invisible stamina bar tied to sprint:

- Stamina fills via: parries, dodges, blocks, perfect actions
- Sprint → target lock + speed boost + charge attack unlock
- Double-jump available at any stamina level
- AoE attack hits all nearby enemies
- Group invincibility (brief) at max stamina

```ts
// useCharacterStats.ts tracks stamina internally
// Warrior class abilities consume/restore stamina
```

---

### Ranger Parry System

```
RMB (hold) → guard stance → LMB → attempted parry
  Perfect parry → counter dash → enemy stunned 0.5s
  Miss parry → normal block (reduced damage)
```

---

## Harvest Mode

### HUD Changes in Harvest Mode

The hotbar reconfigures:
- Slots 1–4 show available harvest tools (axe, pickaxe, fishing rod, sickle)
- Slots 6–8 remain consumables
- A small "Harvest Mode" badge shows above the hotbar

```
┌────────────────────────────────────────────────────────┐
│  [Health Bar]                                           │
│                                                         │
│  [HARVEST MODE]  ← badge                               │
│                                                         │
│  Nearby nodes highlight with resource type icons:       │
│  🪵 🪨 🌿 ⛏️ 🥩 🫐 🌱 🥇 💎                            │
│                                                         │
│  [HOTBAR: 🪓][⛏️][🌿][🔱][ ][🍖][❤️][ ]               │
└────────────────────────────────────────────────────────┘
```

### Node Interaction

Resource nodes within **3.5 world-units** of the player highlight with a gentle bob animation.

```ts
// F key or LMB in harvest mode = harvest nearest highlighted node
// Node type determines animation and tool requirement:

const HARVEST_ANIMATIONS = {
  wood:     "attack",   // axe swing
  stone:    "attack2",  // pickaxe
  iron_ore: "attack2",
  gold_ore: "attack2",
  fiber:    "pickup",
  raw_meat: "pickup",
  berry:    "pickup",
  herb:     "pickup",
  crystal:  "attack",
};

const HARVEST_DURATIONS = {
  wood:     1.2s,
  stone:    1.5s,
  iron_ore: 1.8s,
  gold_ore: 2.2s,
  crystal:  2.0s,
  fiber:    0.8s,
  // ... (lighter items faster)
};
```

### Wildlife Harvest

Harvestable animals are tagged with a **🟠 orange dot** above them. Pressing F while in harvest mode within 3.5u deals 20 damage. At 0 HP, the animal drops 1–2 `raw_meat`.

---

## Build Mode

### HUD Changes in Build Mode

```
┌────────────────────────────────────────────────────────┐
│  [BUILD MODE]  ← badge                                  │
│                                                         │
│  [Building preview follows mouse cursor]               │
│  Green = valid placement                                │
│  Red = blocked (collision / out of bounds)             │
│                                                         │
│  [BUILD MENU]  ← press B                               │
│  [Current: Barracks 🏰] Cost: 5🪵 3🪨                  │
│                                                         │
│  [HOTBAR: 🏰][🌾][📦][🗼][⛏][🔧][ ][ ]                │
└────────────────────────────────────────────────────────┘
```

### Build Menu (B key)

```ts
// Opens BuildMenu.tsx overlay
// Categories:
"military"   → barracks, watchtower, fortress wall
"production" → farm, mine, workshop
"storage"    → storage chest, warehouse
```

### Building Placement

```ts
// Placement flow:
// 1. Player opens build menu (B)
// 2. Clicks a building type
// 3. Preview mesh follows player camera
// 4. LMB places building at valid location
// 5. R rotates preview 90° steps
// 6. Esc cancels placement
```

### Building Costs

| Building | Wood | Stone | Iron | Fiber |
|---|---|---|---|---|
| Barracks | 8 | 5 | 3 | 0 |
| Farm | 5 | 2 | 0 | 4 |
| Storage | 6 | 4 | 2 | 0 |
| Watchtower | 4 | 8 | 2 | 0 |
| Mine | 3 | 6 | 4 | 0 |
| Workshop | 6 | 3 | 5 | 2 |

### Building → Resource Node Spawn

After placement, buildings spawn resource nodes:

```ts
// From addBuildingResources() in ResourceNode.tsx
barracks:   → iron_ore (×2)
farm:       → berry (×3), herb (×2)
mine:       → stone (×3), iron_ore (×2)
workshop:   → wood (×2), fiber (×2)
```

---

## Equipment Screen (I key)

```
┌─────────────────────────────────────────────────────────┐
│ Character Model ← left      Equipment Slots ← right    │
│                             [Helm]   [Shoulder]         │
│                             [Chest]  [Belt]             │
│                             [Legs]   [Boots]            │
│   [3D preview rotates       [Gloves] [Cape]             │
│    on drag]                 [Ring]   [Necklace]         │
│                             [Main Hand] [Off-Hand]      │
│─────────────────────────────────────────────────────────│
│ STATS                                                   │
│ ❤️ Health: 450   🛡️ Defense: 85   ⚔️ Damage: 120       │
│ 💙 Mana: 80      🎯 Accuracy: 72  ⚡ Atk Speed: 1.4   │
└─────────────────────────────────────────────────────────┘
```

### Equip Slot Icons (CDN)

```
{CDN_BASE}/ui/slots/helm.png
{CDN_BASE}/ui/slots/chest.png
{CDN_BASE}/ui/slots/mainhand.png
... etc.
```

### Cape Active Ability Button

Capes show a glowing active-ability button in the equipment UI. Using the ability locks the cape slot:

```ts
// Attempt use
const { ok, effect, remainingCd } = useEquipment.getState().useCapeAbility();

// Is swap currently blocked?
const blocked = useEquipment.getState().isCapeSwapLocked();
```

---

## World Map ([M] key)

### Map Layer Order (bottom to top)

```
1. Background ocean fill (#0a1628)
2. Reference image (world_overhead.png)
3. Zone quadrant overlays (translucent biome tints)
4. Island pins (faction-coloured, hub gets double ring)
5. Sinking island indicators (faded/dashed when submerged)
6. Mission markers (pulsing rings — ⚔️/📦/🗺️ icons)
7. Port anchor icons (⚓ per port from PortRegistry)
8. District town icons (🏘️/🏰/🛒 at zoom > 0.6)
9. Active world event banner (bottom-left screen edge)
10. Discovered locations (landmark icons)
11. User waypoints (coloured emoji pins)
12. Player dot (red + glow halo)
```

### Map Controls

| Input | Action |
|---|---|
| Drag | Pan camera |
| Scroll | Zoom in/out |
| Double-click | Place waypoint |
| Right-click waypoint | Remove waypoint |
| Click waypoint | Select / track |
| M / Esc | Close map |
| 📍 button | Centre on player |
| 📋 button | Toggle legend |
| 📌 button | Open waypoint list |

---

## Z-Key Combat Mechanic

Pressing Z during combat:
- Triggers a stackable buff (max 5 stacks shown as flame indicators ◈ above health bar)
- Randomly fires a **chat bubble** (tactical callout)
- Each stack boosts damage by a configurable multiplier
- Stack timer (resets on Z re-press or expires after ~8s)
- PvP interaction: other players can see your stacks
- Customizable battle cry sound effect per character

```ts
// useGame.tsx tracks:
comboCount: number     // current Z-key stack count
comboTimer: number     // seconds until stack decay
maxCombo:   number     // per-class cap
```
