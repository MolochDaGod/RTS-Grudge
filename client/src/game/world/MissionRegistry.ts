/**
 * MissionRegistry — rotating 3-variant mission pools, one pool per hero.
 *
 * Each hero has exactly 3 variants that cycle in order:
 *   Variant 0 — Kill      fight enemies in the hero's adventure zone
 *   Variant 1 — Recover   gather materials framed as recovering lost/stolen goods
 *   Variant 2 — Resource  crafting/magical material request
 *
 * Rotation triggers (handled by useMissions.ts):
 *   • Player claims a completed mission → immediately advance to next variant
 *   • 2 real hours elapse             → advance regardless of completion
 *
 * markerOffset [x, z]
 *   World-space offset from the hero's hub position where the quest marker
 *   should appear when the player accepts the mission. All offsets are chosen
 *   to land inside or near the hero's adventure zone and stay ≤ 1000 world
 *   units from the hub. Kill/explore markers point toward the zone centre;
 *   gather/recover markers stay close to the hub.
 *
 * Hub positions (world coords):
 *   Crusade [-62, -90]  → tropical zone NW
 *   Fabled  [ 95, -82]  → ice zone NE
 *   Legion  [-15,  48]  → lava zone E, boss zone SW
 */

import type { FactionId } from "./HeroRegistry";

// ─────────────────────────────────────────────────────────────────────────────

export type MissionType = "kill" | "gather" | "explore";
export type MissionVariantKind = "kill" | "recover" | "resource";

export interface KillObjective {
  type: "kill";
  /** Specific enemy type(s) that count toward progress. Empty = any enemy. */
  enemyTypes: string[];
  required: number;
}

export interface GatherObjective {
  type: "gather";
  /** Resource item IDs (from ResourceNode/inventory) that count. */
  resourceTypes: string[];
  required: number;
}

export interface ExploreObjective {
  type: "explore";
  /** Zone that the newly discovered island must belong to. Empty = any zone. */
  targetZone: string;
  required: number;  // always 1 for now
}

export type MissionObjective = KillObjective | GatherObjective | ExploreObjective;

export interface MissionReward {
  xp: number;
  gold: number;
  /** Items added directly to player inventory on claim. */
  items: Array<{ id: string; name: string; icon: string; quantity: number }>;
}

export interface FactionMission {
  id: string;
  title: string;
  /** Hero whose interaction panel shows this mission. */
  giverHeroId: string;
  faction: FactionId;
  description: string;
  objective: MissionObjective;
  rewards: MissionReward;
  /** Suggested player level. */
  recommendedLevel: number;
  /** True = offered again the next real calendar day. */
  repeatable: boolean;
  /**
   * World-space [x, z] OFFSET from the hero's hub position.
   * The actual marker position is hub + offset. Must be ≤ 1000 world units
   * from the hub so the player can find it easily.
   */
  markerOffset: [number, number];
  /** Short label shown on the world map quest marker. */
  markerLabel: string;
  /** Which rotation slot this variant occupies (0=kill, 1=recover, 2=resource). */
  variantKind: MissionVariantKind;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pool — exactly 3 variants per hero, cycling 0→1→2→0→…
// ─────────────────────────────────────────────────────────────────────────────

export interface HeroMissionPool {
  heroId: string;
  faction: FactionId;
  /** Tuple of exactly 3 variants. Index matches variantKind. */
  variants: [FactionMission, FactionMission, FactionMission];
}

/** Stable mission ID from hero ID + variant index (0-2). */
export function getMissionId(heroId: string, variantIndex: number): string {
  return `${heroId}_v${variantIndex % 3}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder helpers
// ─────────────────────────────────────────────────────────────────────────────

function kill(enemies: string[], count: number): KillObjective {
  return { type: "kill", enemyTypes: enemies, required: count };
}
function killAny(count: number): KillObjective {
  return { type: "kill", enemyTypes: [], required: count };
}
function gather(resources: string[], count: number): GatherObjective {
  return { type: "gather", resourceTypes: resources, required: count };
}
function explore(zone: string): ExploreObjective {
  return { type: "explore", targetZone: zone, required: 1 };
}

function reward(
  xp: number, gold: number,
  items: MissionReward["items"] = [],
): MissionReward {
  return { xp, gold, items };
}

// v(variantKind, title, desc, objective, reward, level, markerOffset, markerLabel)
type V = [MissionVariantKind, string, string, MissionObjective, MissionReward, number, [number,number], string];

function pool(
  heroId: string, faction: FactionId,
  v0: V, v1: V, v2: V,
): HeroMissionPool {
  const make = (v: V, idx: number): FactionMission => ({
    id: getMissionId(heroId, idx),
    title: v[1], description: v[2],
    giverHeroId: heroId, faction,
    objective: v[3], rewards: v[4],
    recommendedLevel: v[5],
    markerOffset: v[6], markerLabel: v[7],
    variantKind: v[0],
    repeatable: true,
  });
  return {
    heroId, faction,
    variants: [make(v0, 0), make(v1, 1), make(v2, 2)],
  };
}

// Short reward aliases
const r = reward;

// ─────────────────────────────────────────────────────────────────────────────
// All 24 hero mission pools (3 variants each = 72 missions total)
// Marker offsets point toward the hero's adventure zone from their hub.
// ─────────────────────────────────────────────────────────────────────────────

export const HERO_MISSION_POOLS: Record<string, HeroMissionPool> = {

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUSADE / HUMAN  — hub (-62, -90), tropical zone NW
  // Zone-center offset: ~(-95, -420), gather near hub: small offsets
  // ═══════════════════════════════════════════════════════════════════════════

  hero_aldric: pool("hero_aldric", "crusade",
    ["kill",     "Purge the Coastal Raiders",
      "Pirate raider camps are blocking Crusade supply lines. Clear them out.",
      kill(["pirate", "ninja"], 10), r(400, 120, [{id:"herbal_poultice",name:"Herbal Poultice",icon:"💊",quantity:2}]),
      3, [-180, -350], "⚔ Raiders"],
    ["recover",  "Recover the Stolen Arms Shipment",
      "Pirates raided our last iron convoy. Recover what materials you can find.",
      gather(["iron_ore", "wood"], 8), r(320, 140, [{id:"bandage",name:"Bandage",icon:"🩹",quantity:3}]),
      3, [-30, -40], "📦 Supplies"],
    ["resource", "Steel for the Vanguard",
      "The front-line troops need iron. Supply the forge before the next assault.",
      gather(["iron_ore", "stone"], 10), r(350, 160, [{id:"health_potion",name:"Health Potion",icon:"❤️",quantity:2}]),
      3, [20, -25], "📦 Steel"],
  ),

  hero_gareth: pool("hero_gareth", "crusade",
    ["kill",     "Run Down the Pack",
      "A pack of raptors has been terrorising the southern paths. Thin their numbers.",
      kill(["raptor", "spider"], 8), r(350, 100, [{id:"raw_meat",name:"Raw Meat",icon:"🥩",quantity:4}]),
      4, [-150, -300], "⚔ Hunt"],
    ["recover",  "Salvage the Hunt Grounds",
      "The pack scattered our supplies. Gather back what the beasts dragged off.",
      gather(["raw_meat", "fiber"], 8), r(300, 110, [{id:"cooked_meat",name:"Cooked Meat",icon:"🍖",quantity:2}]),
      3, [-25, -35], "📦 Salvage"],
    ["resource", "The Blood Trail",
      "Fenrath is hungry. Enough blood will satisfy the wolf spirit for today.",
      killAny(12), r(380, 110, [{id:"raw_meat",name:"Raw Meat",icon:"🥩",quantity:3}]),
      3, [-200, -400], "⚔ Hunt"],
  ),

  hero_elara: pool("hero_elara", "crusade",
    ["kill",     "Arcane Suppression",
      "Ghosts and witches are disrupting the arcane wards. Silence them.",
      kill(["ghost", "witch"], 8), r(380, 130, [{id:"mana_potion",name:"Mana Potion",icon:"💙",quantity:2}]),
      4, [-120, -280], "⚔ Spirits"],
    ["recover",  "Reagent Recovery",
      "Stolen reagent stores must be replenished. Gather crystal and herb.",
      gather(["crystal", "herb"], 8), r(300, 150, [{id:"health_potion",name:"Health Potion",icon:"❤️",quantity:2}]),
      2, [30, -20], "📦 Reagents"],
    ["resource", "Compound Gathering",
      "The Dispensary needs herb and berry for the next restorative batch.",
      gather(["herb", "berry"], 10), r(280, 130, [{id:"stamina_tonic",name:"Stamina Tonic",icon:"🧪",quantity:2}]),
      2, [-20, 30], "📦 Herbs"],
  ),

  hero_kael: pool("hero_kael", "crusade",
    ["kill",     "Eliminate the Watchers",
      "Ninja scouts are feeding intelligence to the Legion. Remove them.",
      kill(["ninja"], 8), r(360, 120, [{id:"stamina_tonic",name:"Stamina Tonic",icon:"🧪",quantity:2}]),
      4, [-160, -320], "⚔ Scouts"],
    ["recover",  "Field Supply Run",
      "Shadow operations require fiber and wood. Recover what's out there.",
      gather(["fiber", "wood"], 8), r(280, 120, [{id:"bandage",name:"Bandage",icon:"🩹",quantity:3}]),
      3, [25, -30], "📦 Gear"],
    ["resource", "Chart the Jade Seas",
      "I need fresh charts. Find an uncharted island in the tropical zone.",
      explore("tropical"), r(500, 200, [{id:"stamina_tonic",name:"Stamina Tonic",icon:"🧪",quantity:2}]),
      5, [-100, -200], "🗺 Chart"],
  ),

  // ── CRUSADE / BARBARIAN ─────────────────────────────────────────────────

  hero_ulfgar: pool("hero_ulfgar", "crusade",
    ["kill",     "Shatter the Golems",
      "Stone golems are smashing supply wagons. Ulfgar wants them rubble.",
      kill(["golem"], 6), r(450, 130, [{id:"iron_ore",name:"Iron Ore",icon:"⛏️",quantity:5}]),
      5, [-170, -360], "⚔ Golems"],
    ["recover",  "Recover the Forge Run",
      "A resupply convoy was attacked. Gather back the iron and stone.",
      gather(["iron_ore", "stone"], 8), r(330, 140, [{id:"bandage",name:"Bandage",icon:"🩹",quantity:3}]),
      4, [-15, -35], "📦 Iron"],
    ["resource", "Tribal Rout",
      "Tribal warriors are raiding the northern paths. Drive them back.",
      kill(["tribal", "orc"], 8), r(400, 120, [{id:"herbal_poultice",name:"Herbal Poultice",icon:"💊",quantity:2}]),
      5, [-190, -340], "⚔ Tribals"],
  ),

  hero_hrothgar: pool("hero_hrothgar", "crusade",
    ["kill",     "The Blood Hunt",
      "Hrothgar demands a proper hunt. Numbers are what the pack judges.",
      killAny(12), r(380, 110, [{id:"cooked_meat",name:"Cooked Meat",icon:"🍖",quantity:3}]),
      3, [-160, -380], "⚔ Hunt"],
    ["recover",  "Claim the Kill",
      "The pack needs feeding. Gather the meat from these lands.",
      gather(["raw_meat"], 6), r(280, 100, [{id:"cooked_meat",name:"Cooked Meat",icon:"🍖",quantity:3}]),
      2, [-20, -25], "📦 Meat"],
    ["resource", "Hunt the Raptors",
      "Raptors have become too bold. The pack wants them culled.",
      kill(["raptor"], 8), r(360, 110, [{id:"raw_meat",name:"Raw Meat",icon:"🥩",quantity:4}]),
      4, [-145, -310], "⚔ Raptors"],
  ),

  hero_volka: pool("hero_volka", "crusade",
    ["kill",     "Storm the Warrens",
      "Spider and blob clusters are infesting the lowlands. Clear them.",
      kill(["spider", "blob"], 10), r(350, 110, [{id:"antidote",name:"Antidote",icon:"💉",quantity:2}]),
      3, [-140, -300], "⚔ Vermin"],
    ["recover",  "Gather Storm Crystals",
      "Volka needs crystalline shards charged by the elemental storms.",
      gather(["crystal"], 5), r(320, 160, [{id:"mana_potion",name:"Mana Potion",icon:"💙",quantity:2}]),
      3, [30, -20], "📦 Crystals"],
    ["resource", "Herb for the Blizzard",
      "The next working requires rare herbs and berries as a base reagent.",
      gather(["herb", "berry"], 8), r(290, 130, [{id:"stamina_tonic",name:"Stamina Tonic",icon:"🧪",quantity:2}]),
      2, [-15, 25], "📦 Herbs"],
  ),

  hero_svala: pool("hero_svala", "crusade",
    ["kill",     "Thin the Pirates",
      "Pirate scouts are moving too freely. Svala needs them reduced.",
      kill(["pirate"], 8), r(340, 110, [{id:"bandage",name:"Bandage",icon:"🩹",quantity:3}]),
      3, [-155, -330], "⚔ Pirates"],
    ["recover",  "Supply Recovery",
      "Trail supplies have been scattered. Gather fiber and berry from the field.",
      gather(["fiber", "berry"], 8), r(280, 110, [{id:"stamina_tonic",name:"Stamina Tonic",icon:"🧪",quantity:2}]),
      2, [20, -30], "📦 Trail Gear"],
    ["resource", "Eyes Ahead",
      "Sail out and discover a new island. The map needs filling.",
      explore(""), r(480, 190, [{id:"wooden_bow",name:"Wooden Bow",icon:"🏹",quantity:1}]),
      4, [-90, -180], "🗺 Scout"],
  ),

  // ═══════════════════════════════════════════════════════════════════════════
  // FABLED / DWARF  — hub (95, -82), ice zone NE
  // Zone-center offset: ~(392, -383), gather near hub: small offsets
  // ═══════════════════════════════════════════════════════════════════════════

  hero_thane: pool("hero_thane", "fabled",
    ["kill",     "Defend the Deep Gate",
      "Stone constructs have gone rogue in the glacier passes. Destroy them.",
      kill(["golem"], 8), r(500, 140, [{id:"iron_chestplate",name:"Iron Chestplate",icon:"🛡️",quantity:1}]),
      6, [300, -320], "⚔ Golems"],
    ["recover",  "Ore for the Gate",
      "The Deep Gate's defences need resupply. Recover iron ore and stone.",
      gather(["iron_ore", "stone"], 8), r(330, 145, [{id:"bandage",name:"Bandage",icon:"🩹",quantity:3}]),
      4, [20, -30], "📦 Ore"],
    ["resource", "Drive Back the Cold",
      "Yetis are advancing on the gate perimeter. Drive them back.",
      kill(["yeti"], 8), r(440, 130, [{id:"herbal_poultice",name:"Herbal Poultice",icon:"💊",quantity:2}]),
      6, [280, -280], "⚔ Yetis"],
  ),

  hero_bromm: pool("hero_bromm", "fabled",
    ["kill",     "Cavern Purge",
      "Yetis and ghosts have overrun the cavern networks. Clear them.",
      kill(["yeti", "ghost"], 8), r(460, 125, [{id:"cooked_meat",name:"Cooked Meat",icon:"🍖",quantity:4}]),
      7, [320, -300], "⚔ Caverns"],
    ["recover",  "Deep Cache Recovery",
      "Cave-ins scattered our stone and iron stores. Recover what you can.",
      gather(["stone", "iron_ore"], 8), r(310, 135, [{id:"bandage",name:"Bandage",icon:"🩹",quantity:3}]),
      4, [-20, -30], "📦 Cache"],
    ["resource", "Hunt the Spirits",
      "Ghost concentrations are growing in the lower tunnels. Suppress them.",
      kill(["ghost"], 10), r(420, 120, [{id:"antidote",name:"Antidote",icon:"💉",quantity:2}]),
      6, [260, -260], "⚔ Spirits"],
  ),

  hero_runa: pool("hero_runa", "fabled",
    ["kill",     "Golem Ward",
      "Animated golems keep disrupting the forge vibrations. Silence them.",
      kill(["golem"], 6), r(420, 130, [{id:"iron_ore",name:"Iron Ore",icon:"⛏️",quantity:5}]),
      5, [290, -310], "⚔ Golems"],
    ["recover",  "Forge Materials",
      "The forge runs low. Recover iron ore and crystals from the field.",
      gather(["iron_ore", "crystal"], 10), r(340, 170, [{id:"iron_sword",name:"Iron Sword",icon:"⚔️",quantity:1}]),
      4, [25, -20], "📦 Forge"],
    ["resource", "Rune Components",
      "The new rune sequence requires crystal and herb as binding agents.",
      gather(["crystal", "herb"], 8), r(330, 160, [{id:"mana_potion",name:"Mana Potion",icon:"💙",quantity:2}]),
      3, [-20, 25], "📦 Runes"],
  ),

  hero_durin: pool("hero_durin", "fabled",
    ["kill",     "Scout and Strike",
      "Durin marks the targets. You clear them. Simple.",
      killAny(8), r(360, 115, [{id:"bandage",name:"Bandage",icon:"🩹",quantity:3}]),
      5, [310, -290], "⚔ Marks"],
    ["recover",  "Deep Cache",
      "Stone and ore sit loose in the collapsed tunnels. Gather what's recoverable.",
      gather(["stone", "iron_ore"], 8), r(300, 130, [{id:"iron_ore",name:"Iron Ore",icon:"⛏️",quantity:3}]),
      4, [-25, -20], "📦 Cache"],
    ["resource", "Chart the Glacier",
      "The ice zone needs mapping. Find an undiscovered island there.",
      explore("ice"), r(550, 210, [{id:"wooden_bow",name:"Wooden Bow",icon:"🏹",quantity:1}]),
      6, [200, -200], "🗺 Chart"],
  ),

  // ── FABLED / ELF ─────────────────────────────────────────────────────────

  hero_thalion: pool("hero_thalion", "fabled",
    ["kill",     "The Moonblade Trial",
      "Prove your blade is worthy. Thalion cares only about the count.",
      killAny(10), r(420, 115, [{id:"bandage",name:"Bandage",icon:"🩹",quantity:3}]),
      5, [330, -310], "⚔ Trial"],
    ["recover",  "Recover the Blades",
      "Stolen elven iron must be recovered from the field before it rusts.",
      gather(["iron_ore", "crystal"], 8), r(320, 145, [{id:"iron_ore",name:"Iron Ore",icon:"⛏️",quantity:4}]),
      4, [20, -25], "📦 Blades"],
    ["resource", "The Deep Cull",
      "Demon presences are encroaching. Thalion wants them driven back with style.",
      kill(["demon", "blue_demon"], 8), r(480, 135, [{id:"herbal_poultice",name:"Herbal Poultice",icon:"💊",quantity:2}]),
      7, [350, -340], "⚔ Demons"],
  ),

  hero_sylara: pool("hero_sylara", "fabled",
    ["kill",     "Forest Purge",
      "Demonic corruption is spreading through the Darkwood. Drive them out.",
      kill(["demon", "blue_demon"], 8), r(480, 135, [{id:"herb",name:"Herb",icon:"🌱",quantity:5}]),
      7, [340, -350], "⚔ Demons"],
    ["recover",  "Nature's Bounty",
      "The forest's healing bounty has been scattered. Recover herb and berry.",
      gather(["herb", "berry"], 8), r(290, 130, [{id:"stamina_tonic",name:"Stamina Tonic",icon:"🧪",quantity:2}]),
      3, [15, -20], "📦 Herbs"],
    ["resource", "Spirit Hunt",
      "Ghosts and witches desecrate the spirit groves. Silence them all.",
      kill(["ghost", "witch"], 10), r(430, 125, [{id:"antidote",name:"Antidote",icon:"💉",quantity:2}]),
      6, [300, -300], "⚔ Spirits"],
  ),

  hero_lyra: pool("hero_lyra", "fabled",
    ["kill",     "Silence the Demons",
      "Demon presences disrupt the Crystal Spire's resonance. Remove them.",
      kill(["demon"], 8), r(460, 135, [{id:"mana_potion",name:"Mana Potion",icon:"💙",quantity:2}]),
      7, [360, -360], "⚔ Demons"],
    ["recover",  "Storm Reagents",
      "The weather-working needs charged crystal and rare herbs. Gather them.",
      gather(["crystal", "herb"], 10), r(360, 175, [{id:"mana_potion",name:"Mana Potion",icon:"💙",quantity:2}]),
      4, [25, -20], "📦 Storm"],
    ["resource", "Arcane Materials",
      "Crystal and berry are the base components for the next working.",
      gather(["crystal", "berry"], 8), r(320, 150, [{id:"stamina_tonic",name:"Stamina Tonic",icon:"🧪",quantity:2}]),
      3, [-15, 20], "📦 Arcane"],
  ),

  hero_aelindra: pool("hero_aelindra", "fabled",
    ["kill",     "Silver Arrow Hunt",
      "Yetis and ghosts have been spotted near the scouting lines. Clear them.",
      kill(["yeti", "ghost"], 8), r(420, 120, [{id:"wooden_bow",name:"Wooden Bow",icon:"🏹",quantity:1}]),
      6, [320, -290], "⚔ Hunt"],
    ["recover",  "Forest Cache",
      "Scout supplies were lost. Recover fiber and herb from the wild.",
      gather(["fiber", "herb"], 8), r(280, 115, [{id:"bandage",name:"Bandage",icon:"🩹",quantity:3}]),
      3, [20, -25], "📦 Cache"],
    ["resource", "Ice Survey",
      "Aelindra needs a newly discovered island in the ice zone charted.",
      explore("ice"), r(520, 200, [{id:"stone_spear",name:"Stone Spear",icon:"🔱",quantity:1}]),
      6, [200, -200], "🗺 Survey"],
  ),

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGION / ORC  — hub (-15, 48), lava zone E
  // Zone-center offset: ~(547, 237), gather near hub: small offsets
  // ═══════════════════════════════════════════════════════════════════════════

  hero_grommash: pool("hero_grommash", "legion",
    ["kill",     "Blood Tribute",
      "The Warchief demands blood. Cut down anything in your path. Count is the tribute.",
      killAny(15), r(500, 150, [{id:"iron_mace",name:"Iron Mace",icon:"🔨",quantity:1}]),
      5, [420, 180], "⚔ Tribute"],
    ["recover",  "War Loot Recovery",
      "A Legion cache was raided. Recover iron and gold from the field.",
      gather(["iron_ore", "gold_ore"], 8), r(340, 155, [{id:"cooked_meat",name:"Cooked Meat",icon:"🍖",quantity:3}]),
      4, [25, 20], "📦 Loot"],
    ["resource", "Slay the Strong",
      "Golems and demons challenge Legion dominance. Prove it otherwise.",
      kill(["golem", "demon"], 8), r(460, 140, [{id:"herbal_poultice",name:"Herbal Poultice",icon:"💊",quantity:2}]),
      7, [440, 200], "⚔ Strong"],
  ),

  hero_fenris: pool("hero_fenris", "legion",
    ["kill",     "Alpha's Hunt",
      "Fenris wants worthy prey. Demons and mushroom kings will suffice.",
      kill(["demon", "mushroom_king"], 8), r(460, 130, [{id:"raw_meat",name:"Raw Meat",icon:"🥩",quantity:6}]),
      7, [430, 200], "⚔ Hunt"],
    ["recover",  "Territorial Claim",
      "Fenris marks his territory with resources. Gather meat and iron.",
      gather(["raw_meat", "iron_ore"], 8), r(310, 130, [{id:"cooked_meat",name:"Cooked Meat",icon:"🍖",quantity:3}]),
      3, [20, 25], "📦 Claim"],
    ["resource", "Elite Prey",
      "The pack needs elite kills. Alien and blue demon are worthy targets.",
      kill(["alien", "blue_demon"], 6), r(500, 145, [{id:"herbal_poultice",name:"Herbal Poultice",icon:"💊",quantity:2}]),
      8, [450, 220], "⚔ Elite"],
  ),

  hero_zulijn: pool("hero_zulijn", "legion",
    ["kill",     "Blood Ritual Targets",
      "The hex requires demon essence. Provide the kills for the ritual.",
      kill(["demon"], 8), r(420, 135, [{id:"health_potion",name:"Health Potion",icon:"❤️",quantity:3}]),
      6, [410, 170], "⚔ Ritual"],
    ["recover",  "Ritual Components",
      "Gold ore and crystal shards are needed for the blood-sight working.",
      gather(["gold_ore", "crystal"], 8), r(350, 180, [{id:"health_potion",name:"Health Potion",icon:"❤️",quantity:3}]),
      5, [20, -20], "📦 Components"],
    ["resource", "Hex Ingredients",
      "Crystal and iron are the physical anchors for the next hex sequence.",
      gather(["crystal", "iron_ore"], 8), r(330, 165, [{id:"mana_potion",name:"Mana Potion",icon:"💙",quantity:2}]),
      4, [-20, 20], "📦 Hex"],
  ),

  hero_razak: pool("hero_razak", "legion",
    ["kill",     "Trophy Hunt",
      "Razak wants dragon-scale and dino-bone. Bring him proof of the kills.",
      kill(["dragon", "trex", "triceratops"], 4), r(700, 280, [{id:"iron_axe",name:"Iron Axe",icon:"🪓",quantity:1}]),
      8, [500, 240], "⚔ Trophy"],
    ["recover",  "Trophy Room Supplies",
      "The display cases need iron brackets and gold bindings. Gather them.",
      gather(["iron_ore", "gold_ore"], 8), r(330, 155, [{id:"iron_ore",name:"Iron Ore",icon:"⛏️",quantity:4}]),
      4, [15, 25], "📦 Trophy Room"],
    ["resource", "Elite Marks",
      "Aliens and mushroom kings are worthy wall trophies. Bring Razak proof.",
      kill(["alien", "mushroom_king"], 6), r(520, 160, [{id:"health_potion",name:"Health Potion",icon:"❤️",quantity:2}]),
      8, [480, 230], "⚔ Marks"],
  ),

  // ── LEGION / UNDEAD ──────────────────────────────────────────────────────

  hero_malachar: pool("hero_malachar", "legion",
    ["kill",     "Reclaim the Dead",
      "The wandering undead are a perversion. Malachar wants them destroyed.",
      kill(["skeleton", "ghost", "witch"], 10), r(430, 120, [{id:"bandage",name:"Bandage",icon:"🩹",quantity:4}]),
      4, [370, 160], "⚔ Undead"],
    ["recover",  "Recover the Armory Cache",
      "Iron and stone from a lost armory must be found and returned.",
      gather(["iron_ore", "stone"], 8), r(320, 135, [{id:"bandage",name:"Bandage",icon:"🩹",quantity:4}]),
      4, [20, -20], "📦 Armory"],
    ["resource", "Silence the Unrest",
      "Demon presences grow. Even Malachar finds them a perversion.",
      kill(["demon"], 8), r(440, 130, [{id:"herbal_poultice",name:"Herbal Poultice",icon:"💊",quantity:2}]),
      6, [400, 180], "⚔ Demons"],
  ),

  hero_ghoulfather: pool("hero_ghoulfather", "legion",
    ["kill",     "Feed the Hunger",
      "The Ghoulfather is hungry. All three of him. Any enemies will do.",
      killAny(12), r(400, 110, [{id:"feast_platter",name:"Feast Platter",icon:"🍽️",quantity:1}]),
      4, [380, 150], "⚔ Feed"],
    ["recover",  "Feast Gathering",
      "Raw meat and berry — the three spirits will settle for less while digesting.",
      gather(["raw_meat", "berry"], 8), r(290, 105, [{id:"cooked_meat",name:"Cooked Meat",icon:"🍖",quantity:3}]),
      2, [25, 15], "📦 Feast"],
    ["resource", "The Endless Hunt",
      "Demons and golems — worthy food for three restless spirits.",
      kill(["demon", "golem"], 8), r(420, 120, [{id:"herbal_poultice",name:"Herbal Poultice",icon:"💊",quantity:2}]),
      7, [400, 170], "⚔ Endless"],
  ),

  hero_vexis: pool("hero_vexis", "legion",
    ["kill",     "Soul Collection",
      "Skeletons and ghosts carry harvestable soul fragments. Destroy them.",
      kill(["skeleton", "ghost"], 8), r(380, 125, [{id:"health_potion",name:"Health Potion",icon:"❤️",quantity:2}]),
      4, [360, 140], "⚔ Souls"],
    ["recover",  "Essence Materials",
      "Crystal and iron are the physical anchors for soul-harvesting. Gather them.",
      gather(["crystal", "iron_ore"], 10), r(360, 170, [{id:"health_potion",name:"Health Potion",icon:"❤️",quantity:2}]),
      4, [20, -15], "📦 Essence"],
    ["resource", "Dark Components",
      "Gold ore and crystal — the final layer of the soul matrix requires them.",
      gather(["gold_ore", "crystal"], 8), r(340, 175, [{id:"mana_potion",name:"Mana Potion",icon:"💙",quantity:2}]),
      4, [-15, 20], "📦 Dark"],
  ),

  hero_shade: pool("hero_shade", "legion",
    ["kill",     "Mark and Eliminate",
      "Shade marks targets. Every kill adds to her ever-growing list of faces.",
      killAny(8), r(380, 120, [{id:"bandage",name:"Bandage",icon:"🩹",quantity:3}]),
      4, [370, 160], "⚔ Marks"],
    ["recover",  "Shadow Cache",
      "Field supplies were abandoned. Recover fiber and crystal before others find them.",
      gather(["fiber", "crystal"], 8), r(300, 130, [{id:"stamina_tonic",name:"Stamina Tonic",icon:"🧪",quantity:2}]),
      3, [20, 20], "📦 Cache"],
    ["resource", "Into the Abyss",
      "Shade is tracking something in the boss zone. Chart an unvisited island there.",
      explore("boss"), r(580, 220, [{id:"wooden_bow",name:"Wooden Bow",icon:"🏹",quantity:1}]),
      8, [-160, 240], "🗺 Abyss"],
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Flat ALL_MISSIONS for backward compatibility with any code using it
// ─────────────────────────────────────────────────────────────────────────────
export const ALL_MISSIONS: FactionMission[] = Object.values(HERO_MISSION_POOLS)
  .flatMap((p) => p.variants);

// ─────────────────────────────────────────────────────────────────────────────
// Lookups
// ─────────────────────────────────────────────────────────────────────────────

export function getMission(id: string): FactionMission | undefined {
  return ALL_MISSIONS.find((m) => m.id === id);
}

export function getHeroPool(heroId: string): HeroMissionPool | undefined {
  return HERO_MISSION_POOLS[heroId];
}

/**
 * Returns the single active FactionMission for a hero given their current
 * variant index (0-2). Always returns a valid mission — index wraps.
 */
export function getActiveVariant(heroId: string, variantIndex: number): FactionMission | undefined {
  const p = HERO_MISSION_POOLS[heroId];
  if (!p) return undefined;
  return p.variants[variantIndex % 3];
}

/** All 3 variants for a hero — used for display in UI. */
export function getMissionsForHero(heroId: string): FactionMission[] {
  const p = HERO_MISSION_POOLS[heroId];
  return p ? [...p.variants] : [];
}

export function getMissionsForFaction(faction: FactionId): FactionMission[] {
  return ALL_MISSIONS.filter((m) => m.faction === faction);
}
