/**
 * useProfessions — WCS canonical 5 crafting professions.
 *
 * Miner    · Weaponsmith & Plate Armorsmith · Mining gather
 * Forester · Woodworker, Leatherworker & Mount Tamer · Logging/Skinning/Fishing/Herbalism
 * Chef     · Cook, Brewer & Alchemist · Fishing/Foraging/Herbalism
 * Engineer · Mechanic, Gunsmith & Inventor · Scavenging/Salvaging
 * Mystic   · Weaver, Enchanter & Spellcrafter · Herbalism/Essence/Crystals
 *
 * Each profession has:
 *  - 100 levels, XP curve: 80 * level^1.7
 *  - 50 skill nodes across 5 tiers of 10 (generated procedurally)
 *  - Profession bonuses that feed into HarvestToolActions & CraftingStationUI
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ─────────────────────────────────────────────────────────────────────────────
// Profession taxonomy
// ─────────────────────────────────────────────────────────────────────────────

export type ProfessionId = "miner" | "forester" | "chef" | "engineer" | "mystic";
export type GatherType   = "mining" | "logging" | "skinning" | "fishing" | "herbalism" | "scavenging";
export type StationId    = "forge" | "workbench" | "alchemy_table" | "loom" | "tannery" | "enchanting_altar" | "sawmill" | "cooking_pot" | "anvil";

export type ProfBonusType =
  | "harvestSpeed"    // multiplier on harvest ticks
  | "rareFindBonus"   // 0-1 chance to find bonus rare material
  | "craftEfficiency" // 0-1 chance to save 1 ingredient
  | "craftSpeed"      // multiplier on craft time
  | "yieldBonus"      // extra quantity per harvest
  | "xpBonus"         // extra XP per action
  ;

export interface ProfessionDef {
  id: ProfessionId;
  name: string;
  icon: string;
  color: string;
  description: string;
  gatherTypes: GatherType[];
  primaryStation: StationId;
  allStations: StationId[];
  /** Materials this profession processes */
  materials: string[];
  /** What it crafts */
  crafts: string;
}

export const PROFESSION_DEFS: Record<ProfessionId, ProfessionDef> = {
  miner: {
    id: "miner",
    name: "Miner",
    icon: "⛏️",
    color: "#c0893a",
    description: "Weaponsmith & Plate Armorsmith. Mines ore/gems and forges weapons and heavy armor.",
    gatherTypes: ["mining"],
    primaryStation: "forge",
    allStations: ["forge", "anvil"],
    materials: ["copper_ore", "iron_ore", "steel_ore", "mithril_ore", "adamantine_ore", "orichalcum_ore", "starmetal_ore", "divine_ore"],
    crafts: "Swords · Axes · Daggers · Hammers · Maces · Greatswords · Spears · Shields · Plate Armor",
  },
  forester: {
    id: "forester",
    name: "Forester",
    icon: "🪓",
    color: "#5a9e3c",
    description: "Woodworker, Leatherworker & Mount Tamer. Fells trees, skins creatures, and crafts bows/leather armor.",
    gatherTypes: ["logging", "skinning", "fishing", "herbalism"],
    primaryStation: "workbench",
    allStations: ["workbench", "sawmill", "tannery"],
    materials: ["pine_log", "oak_log", "maple_log", "ash_log", "ironwood_log", "ebony_log", "rawhide", "thick_hide", "rugged_hide"],
    crafts: "Bows · Leather Armor · Planks · Leather · Rope · Ground & Flying Mounts",
  },
  chef: {
    id: "chef",
    name: "Chef",
    icon: "🍖",
    color: "#e07a30",
    description: "Cook, Brewer & Alchemist. Prepares food, potions, and elixirs from gathered ingredients.",
    gatherTypes: ["fishing", "herbalism"],
    primaryStation: "alchemy_table",
    allStations: ["alchemy_table", "cooking_pot"],
    materials: ["raw_meat", "fish", "herb", "berry", "mushroom", "honey", "salt"],
    crafts: "Food T0–T8 · Health Potions · Mana Potions · Buff Potions · Drinks",
  },
  engineer: {
    id: "engineer",
    name: "Engineer",
    icon: "⚙️",
    color: "#7ba0b8",
    description: "Mechanic, Gunsmith & Inventor. Salvages components and builds crossbows, guns, and gadgets.",
    gatherTypes: ["scavenging"],
    primaryStation: "workbench",
    allStations: ["workbench"],
    materials: ["cog", "iron_scrap", "copper_wire", "spring", "lens", "gunpowder", "circuit"],
    crafts: "Crossbows · Guns · Components · Mechanical Mounts · Gadgets",
  },
  mystic: {
    id: "mystic",
    name: "Mystic",
    icon: "🔮",
    color: "#9155d4",
    description: "Weaver, Enchanter & Spellcrafter. Extracts essence, weaves cloth, crafts staves and enchants gear.",
    gatherTypes: ["herbalism", "mining"],
    primaryStation: "loom",
    allStations: ["loom", "enchanting_altar"],
    materials: ["linen", "wool", "cotton", "silk", "minor_essence", "lesser_essence", "rough_gem", "crystal"],
    crafts: "Staves (all schools) · Wands · Tomes · Off-hand Relics · Cloth Armor · Enchants",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Skill tree  (50 nodes per profession, 5 tiers × 10 nodes)
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillNode {
  id: string;       // "<profId>_t<tier>_<col>"  e.g. "miner_t1_3"
  name: string;
  icon: string;
  description: string;
  tier: 1 | 2 | 3 | 4 | 5;
  col: number;      // 1-10
  requires: string[]; // IDs of prerequisite nodes
  effect: { bonus: ProfBonusType; value: number };
  /** Level requirement in this profession to even see / unlock the node */
  reqLevel: number;
}

// Compact node factory so we don't repeat boilerplate 250 times
function n(
  prof: ProfessionId,
  tier: 1|2|3|4|5,
  col: number,
  name: string,
  icon: string,
  desc: string,
  bonus: ProfBonusType,
  value: number,
  reqLevel: number,
  extraReqs: string[] = []
): SkillNode {
  const id = `${prof}_t${tier}_${col}`;
  const autoReq = col > 1 ? [`${prof}_t${tier}_${col - 1}`] : (tier > 1 ? [`${prof}_t${tier - 1}_10`] : []);
  return { id, name, icon, description: desc, tier, col, requires: [...autoReq, ...extraReqs], effect: { bonus, value }, reqLevel };
}

// ── Miner skill tree ──────────────────────────────────────────────────────────
const MINER_NODES: SkillNode[] = [
  // T1 — Gathering basics
  n("miner",1,1,"Iron Will","⛏️","Stronger strikes yield +5% ore per swing.","harvestSpeed",0.05,1),
  n("miner",1,2,"Vein Sense","👁️","Ore nodes visible from 20% further away.","yieldBonus",0.05,2),
  n("miner",1,3,"Chip Strike","🪨","Precision chip adds +0.1 to rare-find chance.","rareFindBonus",0.01,3),
  n("miner",1,4,"Steady Grip","🤝","Reduces stamina cost per swing by 5%.","harvestSpeed",0.05,4),
  n("miner",1,5,"Rock Lore","📖","Identifies ore quality — yields +5% raw material.","yieldBonus",0.05,5),
  n("miner",1,6,"Deep Dig","⬇️","Mine 5% faster in underground zones.","harvestSpeed",0.05,6),
  n("miner",1,7,"Quick Strip","⚡","Auto-mine speed +5%.","harvestSpeed",0.05,7),
  n("miner",1,8,"Crystal Eye","💎","Gem find rate +2%.","rareFindBonus",0.02,8),
  n("miner",1,9,"Ore Sense","🌑","Detects hidden ore seams; +5% total yield.","yieldBonus",0.05,9),
  n("miner",1,10,"Miner's Mark","⛏️","Unlock T2 nodes. +10% harvest XP.","xpBonus",0.10,10),
  // T2 — Smelting
  n("miner",2,1,"Smelter's Touch","🔥","Smelting time -10%.","craftSpeed",0.10,12),
  n("miner",2,2,"Efficient Alloy","♻️","10% chance to save 1 ore per smelt.","craftEfficiency",0.10,14),
  n("miner",2,3,"Hot Tongs","🪛","Ingot yield +5%.","yieldBonus",0.05,16),
  n("miner",2,4,"Flux Mastery","⚗️","Unlocks Steel ingot recipe.","craftEfficiency",0.05,18),
  n("miner",2,5,"Slag Reclaim","🧱","Reclaims 1 ore from slag 20% of the time.","rareFindBonus",0.02,20),
  n("miner",2,6,"Forge Tempo","⏱️","Craft speed at Forge +10%.","craftSpeed",0.10,22),
  n("miner",2,7,"Vein Splitter","💥","Special shatter yields +30% material.","yieldBonus",0.10,24),
  n("miner",2,8,"Gem Polisher","💎","Gem quality chance +3%.","rareFindBonus",0.03,26),
  n("miner",2,9,"Iron Discipline","🏋️","Carry weight +10 (more ore per trip).","yieldBonus",0.05,28),
  n("miner",2,10,"Journeyman Miner","🏅","Unlock T3 nodes. Harvest XP +15%.","xpBonus",0.15,30),
  // T3 — Advanced ore/weapons
  n("miner",3,1,"Mithril Touch","✨","Unlocks Mithril ingot smelting.","craftEfficiency",0.10,32),
  n("miner",3,2,"Anvil Mastery","🔨","Weapon craft time -15%.","craftSpeed",0.15,34),
  n("miner",3,3,"Edge Sharpener","⚔️","Weapon quality roll improved +5%.","yieldBonus",0.05,36),
  n("miner",3,4,"Plate Fit","🛡️","Armor craft efficiency +10%.","craftEfficiency",0.10,38),
  n("miner",3,5,"Deep Vein","🪨","Unlocks veins that yield 2 ore at once 15% of the time.","rareFindBonus",0.05,40),
  n("miner",3,6,"Temper Steel","🌡️","Steel smelting yields +1 ingot 20% of the time.","yieldBonus",0.10,42),
  n("miner",3,7,"Precision Grind","🔩","Reduces wasted material on weapons by 10%.","craftEfficiency",0.10,44),
  n("miner",3,8,"Ore Efficiency","🔄","Mine nodes give +10% ore.","harvestSpeed",0.10,46),
  n("miner",3,9,"Ancestral Craft","🏛️","Unlock named T1 weapon variants at forge.","craftEfficiency",0.05,48),
  n("miner",3,10,"Adept Miner","⭐","Unlock T4 nodes. XP +20%.","xpBonus",0.20,50),
  // T4 — Rare metals
  n("miner",4,1,"Adamantine Sense","💠","Detect adamantine nodes.","rareFindBonus",0.05,52),
  n("miner",4,2,"Master Smith","🔥","Craft time at Master Forge -20%.","craftSpeed",0.20,54),
  n("miner",4,3,"Legendary Alloy","⚗️","Unlocks Orichalcum smelt.","craftEfficiency",0.15,56),
  n("miner",4,4,"Plate Mastery","🛡️","T6 Mythic plate armor unlock.","craftEfficiency",0.10,58),
  n("miner",4,5,"Crystal Resonance","🔮","Crystal harvest +20%.","yieldBonus",0.15,60),
  n("miner",4,6,"Rune Etch","✍️","Unlocks basic rune application on weapons.","rareFindBonus",0.05,62),
  n("miner",4,7,"Heavy Hitter","💪","Shatter Vein deals extra +50% yield.","yieldBonus",0.20,64),
  n("miner",4,8,"Forge Mastery","🔨","All forge crafts +5% chance to produce T+1 item.","rareFindBonus",0.05,66),
  n("miner",4,9,"Star Sense","⭐","Reveals starmetal veins on map.","yieldBonus",0.10,68),
  n("miner",4,10,"Master Miner","👑","Unlock T5 nodes. XP +25%.","xpBonus",0.25,70),
  // T5 — Mastery / Divine
  n("miner",5,1,"Divine Forge","✨","Enables crafting at Divine Forge.","craftEfficiency",0.20,72),
  n("miner",5,2,"Starmetal Mastery","🌟","Starmetal yield +30%.","yieldBonus",0.20,74),
  n("miner",5,3,"Perfected Temper","⚗️","T7 Ancient recipe unlock chance +10%.","rareFindBonus",0.10,76),
  n("miner",5,4,"Living Steel","💫","Chance to craft self-repairing weapons.","rareFindBonus",0.10,78),
  n("miner",5,5,"Divine Ingot","🌐","Unlocks Divine ore smelting.","craftEfficiency",0.20,80),
  n("miner",5,6,"Legendary Craft","🏆","T8 weapon craft chance +5%.","rareFindBonus",0.05,82),
  n("miner",5,7,"Ultimate Vein","💥","Shatter Vein now AoE 6m.","yieldBonus",0.25,84),
  n("miner",5,8,"Smith's Legend","⭐","All forge craft speed +30%.","craftSpeed",0.30,86),
  n("miner",5,9,"Ore Omniscience","🌍","All ore nodes on minimap permanently visible.","yieldBonus",0.10,88),
  n("miner",5,10,"Grand Master Miner","👑","Max XP bonus +50%. All Miner bonuses +10%.","xpBonus",0.50,90),
];

// ── Generic node generator for Forester, Chef, Engineer, Mystic ──────────────
function genNodes(
  prof: ProfessionId,
  t1Labels: [string,string][],
  t2Labels: [string,string][],
  t3Labels: [string,string][],
  t4Labels: [string,string][],
  t5Labels: [string,string][],
): SkillNode[] {
  const tiers = [t1Labels, t2Labels, t3Labels, t4Labels, t5Labels];
  const bonuses: ProfBonusType[] = ["harvestSpeed","rareFindBonus","craftEfficiency","craftSpeed","yieldBonus","xpBonus","harvestSpeed","rareFindBonus","yieldBonus","xpBonus"];
  const nodes: SkillNode[] = [];
  tiers.forEach((labels, ti) => {
    const tier = (ti + 1) as 1|2|3|4|5;
    labels.forEach(([name, icon], ci) => {
      const col = ci + 1;
      const bonus = bonuses[ci];
      const value = bonus === "xpBonus" ? 0.10 + ti * 0.05 : 0.05 + ti * 0.02;
      const reqLevel = tier === 1 ? 1 + ci * 2 : 10 * ti + ci * 2;
      nodes.push(n(prof, tier, col, name, icon, `${name}: ${bonus.replace(/([A-Z])/g,' $1')} +${Math.round(value*100)}%.`, bonus, value, reqLevel));
    });
  });
  return nodes;
}

const FORESTER_NODES = genNodes("forester",
  [["Keen Eye","👁️"],["Axe Mastery","🪓"],["Bark Read","🌲"],["Swift Fell","⚡"],["Log Roll","🪵"],["Bowyer Start","🏹"],["Hide Sense","🔪"],["Skinner's Cut","🩸"],["Fish Lore","🎣"],["Forester Mark","🌿"]],
  [["Plank Mill","🪚"],["Grain Saw","⚙️"],["Hardwood Find","🌳"],["Tan Basics","🦌"],["Rawhide Cure","🧴"],["Bowstring Twist","🪢"],["Leather Work","🪡"],["Bait Craft","🪱"],["Shore Cast","🎣"],["Journeyman Fore","🏅"]],
  [["Ironwood Seek","💪"],["Wyrmwood Lore","🐉"],["Master Tan","🏆"],["Wyrm Hide","🐍"],["Mount Bond","🐴"],["Bow Craft T3","🏹"],["Arrow Fletch","🪶"],["Leather Armor","🛡️"],["Fishing Net","🥅"],["Adept Forester","⭐"]],
  [["Titan Hide","💎"],["Ebony Mill","🌑"],["Master Bow","🎯"],["Wyrm Leather","✨"],["Flying Mount","🦅"],["Rugged Craft","⚒️"],["Elite Tan","🦓"],["Trophy Hunt","🏆"],["Deep Sea","🌊"],["Master Forester","👑"]],
  [["Divine Wood","🌐"],["Worldtree Log","🌳"],["Legendary Bow","🏹"],["Divine Hide","✨"],["Celestial Mount","☁️"],["Grand Tan","⚗️"],["Perfect Leather","💠"],["Epic Fishing","🎣"],["Beast Bond","🐻"],["Grand Master Fore","👑"]],
);

const CHEF_NODES = genNodes("chef",
  [["Kitchen Start","🔥"],["Herb Sense","🌿"],["Fish Fillet","🐟"],["Spice Know","🌶️"],["Campfire Cook","🏕️"],["Forage Eye","🫐"],["Brew Basics","🍺"],["Salt Cure","🧂"],["Sweet Tooth","🍯"],["Chef Mark","🍖"]],
  [["Pot Mastery","🍲"],["Alchemy Intro","⚗️"],["Health Brew","❤️"],["Mana Brew","💙"],["Buff Cook","💪"],["Drink Mix","🥤"],["Rare Ingredient","✨"],["Advanced Spice","🌶️"],["Multi Cook","🍽️"],["Journeyman Chef","🏅"]],
  [["Master Pot","🏆"],["Elixir Craft","💊"],["Regen Brew","🔄"],["Stamina Food","⚡"],["Feast Prep","🎉"],["Poison Brew","💀"],["Antidote","💉"],["Exotic Cook","🍱"],["Divine Taste","👼"],["Adept Chef","⭐"]],
  [["Grand Feast","🍽️"],["Master Brew","🏆"],["T6 Recipe","✨"],["Mythic Food","🌟"],["Rare Catch","🎣"],["Ancient Herb","🌿"],["God's Brew","⚗️"],["Legendary Meal","🍖"],["Rare Mushroom","🍄"],["Master Chef","👑"]],
  [["Divine Kitchen","✨"],["Sacred Recipe","📜"],["T8 Alchemy","🌐"],["Perfected Brew","💎"],["Divine Feast","☁️"],["Legendary Elixir","💫"],["Cosmic Herb","🌌"],["Perfect Fish","🐟"],["Grand Cellar","🍷"],["Grand Master Chef","👑"]],
);

const ENGINEER_NODES = genNodes("engineer",
  [["Scavenge Eye","🔍"],["Gear Sense","⚙️"],["Spring Find","🔩"],["Salvage Basics","♻️"],["Dismantle","🔧"],["Gun Lore","🔫"],["Crossbow Intro","🎯"],["Component Craft","🔨"],["Power Cell","⚡"],["Engineer Mark","⚙️"]],
  [["Oil Extract","🛢️"],["Gas Find","💨"],["Circuit Trace","🔌"],["Battery Craft","🔋"],["Bolt Maker","🔩"],["Gunpowder Mix","💥"],["Lens Polish","🔭"],["Spring Coil","🌀"],["Gear Grind","⚙️"],["Journeyman Eng","🏅"]],
  [["Advanced Gun","🔫"],["T3 Crossbow","🎯"],["Mechanical Mount","🤖"],["Gadget Craft","📱"],["Explosive Make","💣"],["Circuit Master","💡"],["Steam Engine","♨️"],["Scope Craft","🔭"],["Precision Bolt","🎯"],["Adept Engineer","⭐"]],
  [["Master Gun","🔫"],["T6 Crossbow","✨"],["Flying Machine","✈️"],["Advanced Circuit","💻"],["EMP Device","⚡"],["Master Gadget","🤖"],["T6 Component","🔩"],["Rare Salvage","💎"],["Auto-Loader","⚙️"],["Master Engineer","👑"]],
  [["Divine Workshop","✨"],["T8 Crossbow","🌐"],["T8 Gun","💫"],["Legendary Gadget","🌟"],["Divine Circuit","☁️"],["Perfect Component","💎"],["Legendary Machine","🤖"],["Grand Salvage","♻️"],["Cosmic Engine","🌌"],["Grand Master Eng","👑"]],
);

const MYSTIC_NODES = genNodes("mystic",
  [["Herb Eye","🌿"],["Essence Feel","✨"],["Crystal Sense","💎"],["Loom Start","🧶"],["Weave Basics","🪡"],["Staff Carve","🪄"],["Tome Bind","📚"],["Wand Shape","🪄"],["Relic Find","🔮"],["Mystic Mark","🔮"]],
  [["Minor Essence","⚗️"],["Cotton Weave","🧵"],["Enchant Intro","✨"],["Fire Staff","🔥"],["Frost Staff","❄️"],["Holy Staff","✝️"],["Lightning Staff","⚡"],["Nature Staff","🌿"],["Off-hand Relic","🔮"],["Journeyman Myst","🏅"]],
  [["Greater Essence","💫"],["Silk Weave","🌟"],["Enchant Mastery","✨"],["Arcane Staff","🌀"],["Cloth Armor T3","🧙"],["Wand Mastery","🪄"],["Tome Inscribe","📜"],["Infusion Basics","💉"],["Crystal Extract","💎"],["Adept Mystic","⭐"]],
  [["Perfect Essence","🌐"],["Moonweave","🌙"],["T6 Enchant","✨"],["Mythic Staff","⭐"],["Starweave","⭐"],["Grand Wand","💫"],["Legendary Tome","📜"],["Divine Infusion","☁️"],["Void Crystal","🌑"],["Master Mystic","👑"]],
  [["Divine Loom","✨"],["Voidweave","🌌"],["T8 Staff","💎"],["Legendary Relic","🏆"],["Cosmic Cloth","🌠"],["Perfect Enchant","✨"],["Grand Infuse","💉"],["Divine Essence","🌐"],["Sacred Tome","📖"],["Grand Master Myst","👑"]],
);

export const PROFESSION_SKILL_TREES: Record<ProfessionId, SkillNode[]> = {
  miner:    MINER_NODES,
  forester: FORESTER_NODES,
  chef:     CHEF_NODES,
  engineer: ENGINEER_NODES,
  mystic:   MYSTIC_NODES,
};

// ─────────────────────────────────────────────────────────────────────────────
// XP curve
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_PROF_LEVEL = 100;

export function profXpForNextLevel(level: number): number {
  if (level >= MAX_PROF_LEVEL) return Infinity;
  return Math.round(80 * Math.pow(level, 1.7));
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfessionState {
  level: number;
  xp: number;
  xpToNext: number;
  skillPoints: number;
  /** IDs of unlocked skill nodes */
  unlockedNodes: string[];
}

function defaultProfState(): ProfessionState {
  return { level: 1, xp: 0, xpToNext: profXpForNextLevel(1), skillPoints: 0, unlockedNodes: [] };
}

interface ProfessionsState {
  professions: Record<ProfessionId, ProfessionState>;

  /** Award XP to a profession by its ID. Handles levelling up. */
  addProfXP: (profId: ProfessionId, amount: number) => void;

  /** Spend one skill point to unlock a node. Returns false if prereqs not met or already unlocked. */
  unlockNode: (profId: ProfessionId, nodeId: string) => boolean;

  /**
   * Returns the total bonus value for a given bonus type,
   * summed across all unlocked nodes for the profession.
   */
  getProfBonus: (profId: ProfessionId, bonus: ProfBonusType) => number;

  /** Returns true if the given node ID is unlocked for the profession. */
  isNodeUnlocked: (profId: ProfessionId, nodeId: string) => boolean;
}

export const useProfessions = create<ProfessionsState>()(
  persist(
    (set, get) => ({
      professions: {
        miner:    defaultProfState(),
        forester: defaultProfState(),
        chef:     defaultProfState(),
        engineer: defaultProfState(),
        mystic:   defaultProfState(),
      },

      // ── addProfXP ─────────────────────────────────────────────────────────
      addProfXP: (profId, amount) => {
        set(s => {
          const prof = { ...s.professions[profId] };
          prof.xp += amount;
          while (prof.level < MAX_PROF_LEVEL && prof.xp >= prof.xpToNext) {
            prof.xp -= prof.xpToNext;
            prof.level += 1;
            prof.skillPoints += 1; // 1 point per level
            prof.xpToNext = profXpForNextLevel(prof.level);
          }
          if (prof.level >= MAX_PROF_LEVEL) prof.xp = 0;
          return { professions: { ...s.professions, [profId]: prof } };
        });
      },

      // ── unlockNode ────────────────────────────────────────────────────────
      unlockNode: (profId, nodeId) => {
        const state = get();
        const prof = state.professions[profId];
        if (!prof || prof.skillPoints < 1) return false;
        if (prof.unlockedNodes.includes(nodeId)) return false;

        const tree = PROFESSION_SKILL_TREES[profId];
        const node = tree.find(n => n.id === nodeId);
        if (!node) return false;
        if (node.reqLevel > prof.level) return false;

        // Check prerequisites
        for (const req of node.requires) {
          if (!prof.unlockedNodes.includes(req)) return false;
        }

        set(s => {
          const p = { ...s.professions[profId] };
          p.unlockedNodes = [...p.unlockedNodes, nodeId];
          p.skillPoints -= 1;
          return { professions: { ...s.professions, [profId]: p } };
        });
        return true;
      },

      // ── getProfBonus ──────────────────────────────────────────────────────
      getProfBonus: (profId, bonus) => {
        const prof = get().professions[profId];
        if (!prof) return 0;
        const tree = PROFESSION_SKILL_TREES[profId];
        let total = 0;
        for (const nodeId of prof.unlockedNodes) {
          const node = tree.find(n => n.id === nodeId);
          if (node && node.effect.bonus === bonus) total += node.effect.value;
        }
        return total;
      },

      // ── isNodeUnlocked ────────────────────────────────────────────────────
      isNodeUnlocked: (profId, nodeId) => {
        const prof = get().professions[profId];
        return prof?.unlockedNodes.includes(nodeId) ?? false;
      },
    }),
    {
      name: "grudge_professions",
      storage: createJSONStorage(() => {
        try { return localStorage; }
        catch { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; }
      }),
      partialize: (s) => ({ professions: s.professions }),
    }
  )
);
