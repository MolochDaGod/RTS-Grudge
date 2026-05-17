/**
 * CraftingStationUI — WCS-aligned 4-tab crafting panel.
 *
 * Opens when the player presses E near a crafting station inside any interior
 * (home, camp, castle). The panel is profession-aware; each of the 5 crafting
 * stations opens into its own profession context with all 4 tabs:
 *
 *   Tab 1 · Skill Tree  — 50-node 5×10 grid for the matched profession
 *   Tab 2 · Recipes     — filterable recipe list (station + profession context)
 *   Tab 3 · Stations    — all stations for this profession + tier requirements
 *   Tab 4 · Infusions   — apply infusions/enchants to equipped gear
 *
 * Ingredient checking pulls from useStorage first, then useInventory.
 * Crafting consumes ingredients via useStorage.consumeIngredients().
 */

import { useState, useEffect, useCallback } from "react";
import { useProfessions, PROFESSION_DEFS, PROFESSION_SKILL_TREES, type ProfessionId, type SkillNode } from "@/lib/stores/useProfessions";
import { useStorage } from "@/lib/stores/useStorage";
import { useInventory, CRAFT_RECIPES, type CraftRecipe } from "@/lib/stores/useInventory";
import { useEquipment, TIER_INFO } from "@/lib/stores/useEquipment";
import type { StationId } from "@/lib/stores/useProfessions";

// ─────────────────────────────────────────────────────────────────────────────
// Station → Profession mapping
// ─────────────────────────────────────────────────────────────────────────────

const STATION_PROFESSION: Record<string, ProfessionId | "all"> = {
  forge:             "miner",
  anvil:             "miner",
  workbench:         "forester",
  sawmill:           "forester",
  tannery:           "forester",
  alchemy_table:     "chef",
  cooking_pot:       "chef",
  loom:              "mystic",
  enchanting_altar:  "all",
};

const STATION_LABEL: Record<string, string> = {
  forge:             "⛏️ Forge",
  workbench:         "🛠️ Workbench",
  alchemy_table:     "⚗️ Alchemy Table",
  loom:              "🧵 Loom",
  tannery:           "🦴 Tannery",
  enchanting_altar:  "✨ Enchanting Altar",
};

// ─────────────────────────────────────────────────────────────────────────────
// WCS Infusion data (20 types: 5 generic + 3 per profession)
// ─────────────────────────────────────────────────────────────────────────────

interface InfusionDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  tier: 1 | 2 | 3 | 4 | 5;
  source: "enemy_drop" | "profession";
  profession?: ProfessionId;
  cost: { itemId: string; count: number }[];
}

const INFUSIONS: InfusionDef[] = [
  // Generic (enemy drops)
  { id: "minor_infusion",   name: "Minor Infusion",   icon: "✨", description: "+3% to all stats", tier: 1, source: "enemy_drop", cost: [] },
  { id: "lesser_infusion",  name: "Lesser Infusion",  icon: "💫", description: "+6% to all stats", tier: 2, source: "enemy_drop", cost: [] },
  { id: "greater_infusion", name: "Greater Infusion", icon: "⭐", description: "+10% to all stats", tier: 3, source: "enemy_drop", cost: [] },
  { id: "superior_infusion",name: "Superior Infusion",icon: "🌟", description: "+15% to all stats", tier: 4, source: "enemy_drop", cost: [] },
  { id: "perfect_infusion", name: "Perfect Infusion", icon: "💎", description: "+22% to all stats", tier: 5, source: "enemy_drop", cost: [] },
  // Miner-specific
  { id: "iron_temper",   name: "Iron Temper",   icon: "🔨", description: "+12% damage, +8% armor pen", tier: 2, source: "profession", profession: "miner",    cost: [{ itemId: "iron_ingot", count: 3 }] },
  { id: "forge_rune",    name: "Forge Rune",    icon: "🔥", description: "+20% crit damage, +5% block", tier: 3, source: "profession", profession: "miner",    cost: [{ itemId: "steel_ingot", count: 2 }, { itemId: "mithril_ore", count: 1 }] },
  { id: "divine_temper", name: "Divine Temper", icon: "✨", description: "+35% all combat stats", tier: 5, source: "profession", profession: "miner",    cost: [{ itemId: "divine_ingot", count: 1 }] },
  // Forester-specific
  { id: "bowstring_oil",  name: "Bowstring Oil",  icon: "🏹", description: "+15% ranged damage, +5% crit chance", tier: 2, source: "profession", profession: "forester", cost: [{ itemId: "oak_plank", count: 2 }, { itemId: "fiber", count: 3 }] },
  { id: "leather_weave",  name: "Leather Weave",  icon: "🦺", description: "+18% armor, +10% evasion", tier: 3, source: "profession", profession: "forester", cost: [{ itemId: "rugged_hide", count: 3 }] },
  { id: "wyrm_coating",   name: "Wyrm Coating",   icon: "🐉", description: "+30% all defenses, +8% move speed", tier: 5, source: "profession", profession: "forester", cost: [{ itemId: "wyrm_leather", count: 1 }] },
  // Chef-specific
  { id: "mana_oil",       name: "Mana Oil",       icon: "💙", description: "+20% mana regen, +8% spell accuracy", tier: 2, source: "profession", profession: "chef", cost: [{ itemId: "herb", count: 5 }] },
  { id: "vitality_grease",name: "Vitality Grease",icon: "❤️", description: "+15% health regen, +10% health", tier: 3, source: "profession", profession: "chef", cost: [{ itemId: "rare_herb", count: 2 }, { itemId: "honey", count: 3 }] },
  { id: "divine_essence_oil",name:"Divine Essence Oil",icon:"🌟",description:"+40% health/mana regen, +15% all stats", tier: 5, source: "profession", profession: "chef", cost: [{ itemId: "divine_essence", count: 1 }] },
  // Engineer-specific
  { id: "scope_lens",    name: "Scope Lens",    icon: "🔭", description: "+25% ranged accuracy, +10% crit chance", tier: 2, source: "profession", profession: "engineer", cost: [{ itemId: "lens", count: 2 }, { itemId: "cog", count: 3 }] },
  { id: "mechanism",     name: "Mechanism",     icon: "⚙️", description: "+20% attack speed, -10% stamina cost", tier: 3, source: "profession", profession: "engineer", cost: [{ itemId: "spring", count: 3 }, { itemId: "circuit", count: 1 }] },
  { id: "divine_circuit",name: "Divine Circuit",icon: "💡", description: "+35% attack speed, +15% all combat", tier: 5, source: "profession", profession: "engineer", cost: [{ itemId: "divine_circuit", count: 1 }] },
  // Mystic-specific
  { id: "moonweave_enchant",  name: "Moonweave Enchant", icon: "🌙", description: "+20% spell damage, +12% mana", tier: 2, source: "profession", profession: "mystic", cost: [{ itemId: "moonweave", count: 2 }, { itemId: "minor_essence", count: 3 }] },
  { id: "arcane_inscription", name: "Arcane Inscription",icon: "📜", description: "+25% spell crit, +15% cooldown reduction", tier: 3, source: "profession", profession: "mystic", cost: [{ itemId: "greater_essence", count: 2 }, { itemId: "silk", count: 2 }] },
  { id: "divine_inscription", name: "Divine Inscription", icon: "✨", description: "+50% all magic stats, divination buff", tier: 5, source: "profession", profession: "mystic", cost: [{ itemId: "divine_essence", count: 1 }, { itemId: "voidweave", count: 1 }] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Color constants
// ─────────────────────────────────────────────────────────────────────────────

const c = {
  bg: "#0a0a14",
  panel: "#14101e",
  panel2: "#1c1628",
  border: "#c0893a",
  borderDim: "#2a2038",
  text: "#f0e8d8",
  muted: "#9080a8",
  gold: "#c0893a",
  green: "#6ddd6d",
  red: "#e05050",
  blue: "#5599ff",
  purple: "#9966ee",
  cyan: "#42e8e0",
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Skill Tree
// ─────────────────────────────────────────────────────────────────────────────

function SkillTreeTab({ profId }: { profId: ProfessionId }) {
  const profDef = PROFESSION_DEFS[profId];
  const profState = useProfessions(s => s.professions[profId]);
  const unlockNode = useProfessions(s => s.unlockNode);
  const isNodeUnlocked = useProfessions(s => s.isNodeUnlocked);
  const nodes = PROFESSION_SKILL_TREES[profId];

  const tiers = [1, 2, 3, 4, 5] as const;

  return (
    <div style={{ padding: "12px 16px", overflowY: "auto", maxHeight: "calc(100% - 20px)" }}>
      {/* Profession header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 32 }}>{profDef.icon}</span>
        <div>
          <div style={{ color: profDef.color, fontWeight: 900, fontSize: 18 }}>{profDef.name}</div>
          <div style={{ color: c.muted, fontSize: 11 }}>{profDef.description}</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ color: c.gold, fontSize: 13, fontWeight: "bold" }}>Level {profState.level}</div>
          <div style={{ color: c.muted, fontSize: 10 }}>
            {profState.xp} / {profState.xpToNext === Infinity ? "MAX" : profState.xpToNext} XP
          </div>
          <div style={{ color: c.green, fontSize: 11 }}>
            {profState.skillPoints} skill point{profState.skillPoints !== 1 ? "s" : ""} available
          </div>
        </div>
      </div>

      {/* 5×10 skill grid */}
      {tiers.map(tier => {
        const tierNodes = nodes.filter(n => n.tier === tier);
        const tierUnlocked = profState.level >= (tier === 1 ? 1 : (tier - 1) * 10 + 1);
        return (
          <div key={tier} style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 11, color: tierUnlocked ? profDef.color : c.muted,
              fontWeight: "bold", letterSpacing: 1, textTransform: "uppercase",
              marginBottom: 6, paddingBottom: 3,
              borderBottom: `1px solid ${tierUnlocked ? profDef.color + "44" : c.borderDim}`,
            }}>
              Tier {tier} {tier === 1 ? "(Gathering)" : tier === 2 ? "(Processing)" : tier === 3 ? "(Advanced)" : tier === 4 ? "(Rare)" : "(Mastery)"}
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {tierNodes.map(node => {
                const unlocked = isNodeUnlocked(profId, node.id);
                const prereqsMet = node.requires.every(req => isNodeUnlocked(profId, req));
                const levelMet = profState.level >= node.reqLevel;
                const canUnlock = !unlocked && prereqsMet && levelMet && profState.skillPoints > 0;

                return (
                  <div
                    key={node.id}
                    title={`${node.name}\nLv.${node.reqLevel} required\n${node.description}\n+${Math.round(node.effect.value * 100)}% ${node.effect.bonus}`}
                    onClick={() => canUnlock && unlockNode(profId, node.id)}
                    style={{
                      width: 68, height: 68, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: 2,
                      borderRadius: 6, cursor: canUnlock ? "pointer" : "default",
                      border: `1px solid ${unlocked ? profDef.color : prereqsMet && levelMet ? c.borderDim + "aa" : "#1a1a28"}`,
                      background: unlocked
                        ? profDef.color + "22"
                        : canUnlock
                          ? c.panel2
                          : "#0a0a12",
                      opacity: !tierUnlocked ? 0.35 : unlocked ? 1 : prereqsMet && levelMet ? 0.85 : 0.45,
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{node.icon}</span>
                    <span style={{ fontSize: 8, color: unlocked ? profDef.color : c.muted, textAlign: "center", lineHeight: 1.2 }}>
                      {node.name}
                    </span>
                    {unlocked && <span style={{ fontSize: 7, color: c.green }}>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Recipes
// ─────────────────────────────────────────────────────────────────────────────

function RecipesTab({ stationId }: { stationId: string }) {
  const { items: inventoryItems, removeItem } = useInventory();
  const storageEntries = useStorage(s => s.entries);
  const consumeIngredients = useStorage(s => s.consumeIngredients);
  const addToStorage = useStorage(s => s.addToStorage);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [lastCrafted, setLastCrafted] = useState<string | null>(null);

  // For now show all craft recipes filtered by station-relevant categories
  const stationCategories: Record<string, string[]> = {
    forge:            ["weapons", "armor", "materials", "smelt"],
    workbench:        ["tools", "weapons", "materials", "woodwork"],
    alchemy_table:    ["food", "consumables", "alchemy"],
    loom:             ["armor", "materials", "weave"],
    tannery:          ["armor", "materials", "leatherwork"],
    enchanting_altar: ["enchant"],
  };
  const relevantCats = stationCategories[stationId] ?? [];

  const recipes = CRAFT_RECIPES.filter(r => {
    const catOk = filter === "all" || relevantCats.includes(r.category) || relevantCats.includes(filter);
    const searchOk = !search || r.name.toLowerCase().includes(search.toLowerCase());
    return catOk && searchOk;
  });

  function canCraftCombined(recipe: CraftRecipe): boolean {
    return recipe.ingredients.every(ing => {
      const stored = storageEntries.find(e => e.id === ing.itemId)?.quantity ?? 0;
      const carried = inventoryItems.find(i => i.id === ing.itemId)?.quantity ?? 0;
      return stored + carried >= ing.count;
    });
  }

  function handleCraft(recipe: CraftRecipe) {
    if (!canCraftCombined(recipe)) return;
    const success = consumeIngredients(recipe.ingredients, inventoryItems, removeItem);
    if (success) {
      // Output goes to storage
      addToStorage({
        id: recipe.result.id,
        name: recipe.result.name,
        icon: recipe.result.icon,
        quantity: recipe.result.quantity,
        type: recipe.result.type,
        source: "crafted",
      });
      setLastCrafted(recipe.name);
      setTimeout(() => setLastCrafted(null), 2500);
    }
  }

  return (
    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input
          placeholder="Search recipes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 120, background: c.panel2, border: `1px solid ${c.borderDim}`,
            borderRadius: 5, padding: "4px 8px", color: c.text, fontSize: 11, outline: "none",
          }}
        />
        {["all", ...relevantCats].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{
              padding: "3px 8px", fontSize: 10, borderRadius: 4, cursor: "pointer",
              background: filter === cat ? c.gold + "33" : "transparent",
              border: `1px solid ${filter === cat ? c.gold : c.borderDim}`,
              color: filter === cat ? c.gold : c.muted,
            }}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {lastCrafted && (
        <div style={{
          background: "#1a3a1a", border: "1px solid #4ddd4d", borderRadius: 6,
          padding: "6px 12px", color: c.green, fontSize: 12, textAlign: "center",
        }}>
          ✓ Crafted {lastCrafted} → stored in Storage
        </div>
      )}

      {/* Recipe list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {recipes.length === 0 && (
          <div style={{ color: c.muted, fontSize: 12, textAlign: "center", padding: 16 }}>
            No recipes for this station yet. Unlock more via the Skill Tree.
          </div>
        )}
        {recipes.map(recipe => {
          const canCraft = canCraftCombined(recipe);
          return (
            <div key={recipe.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "7px 10px", borderRadius: 6,
              background: canCraft ? "#1a2814" : c.panel2,
              border: `1px solid ${canCraft ? "#4ddd4d44" : c.borderDim}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>{recipe.result.icon}</span>
                <div>
                  <div style={{ color: c.text, fontWeight: 700, fontSize: 12 }}>{recipe.name}</div>
                  <div style={{ fontSize: 10, color: c.muted }}>
                    {recipe.ingredients.map(ing => {
                      const stored = storageEntries.find(e => e.id === ing.itemId)?.quantity ?? 0;
                      const carried = inventoryItems.find(i => i.id === ing.itemId)?.quantity ?? 0;
                      const have = stored + carried;
                      return (
                        <span
                          key={ing.itemId}
                          style={{ color: have >= ing.count ? c.green : c.red, marginRight: 6 }}
                        >
                          {ing.count}× {ing.itemId.replace(/_/g, " ")} ({have})
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              <button
                disabled={!canCraft}
                onClick={() => handleCraft(recipe)}
                style={{
                  padding: "5px 14px", fontSize: 11, borderRadius: 5, cursor: canCraft ? "pointer" : "default",
                  background: canCraft ? "rgba(77,221,77,0.2)" : "rgba(100,100,100,0.15)",
                  border: `1px solid ${canCraft ? "#4ddd4d" : c.borderDim}`,
                  color: canCraft ? c.green : c.muted, fontWeight: "bold",
                }}
              >
                Craft
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Stations
// ─────────────────────────────────────────────────────────────────────────────

function StationsTab({ profId }: { profId: ProfessionId | "all" }) {
  const profDef = profId === "all" ? null : PROFESSION_DEFS[profId];
  const professions = profId === "all"
    ? Object.values(PROFESSION_DEFS)
    : [PROFESSION_DEFS[profId]];

  const ALL_STATIONS = [
    { id: "forge",            name: "Forge",            tier: "T1–T5", masterName: "Master Forge",  masterTier: "T6–T7", divineName: "Divine Forge",  divineTier: "T8",   reqLevel: 1,  icon: "🔨" },
    { id: "anvil",            name: "Anvil",            tier: "T1–T5", masterName: "Master Anvil",  masterTier: "T6–T7", divineName: "Divine Anvil",  divineTier: "T8",   reqLevel: 1,  icon: "⚒️" },
    { id: "workbench",        name: "Workbench",        tier: "T1–T5", masterName: "Master Bench",  masterTier: "T6–T7", divineName: "Divine Bench",  divineTier: "T8",   reqLevel: 1,  icon: "🛠️" },
    { id: "sawmill",          name: "Sawmill",          tier: "T1–T5", masterName: "Master Sawmill",masterTier: "T6–T7", divineName: "Divine Sawmill",divineTier: "T8",   reqLevel: 5,  icon: "🪚" },
    { id: "tannery",          name: "Tannery",          tier: "T1–T5", masterName: "Master Tannery",masterTier: "T6–T7", divineName: "Divine Tannery",divineTier: "T8",   reqLevel: 5,  icon: "🦴" },
    { id: "alchemy_table",    name: "Alchemy Table",    tier: "T1–T5", masterName: "Master Alchemy",masterTier: "T6–T7", divineName: "Divine Alchemy",divineTier: "T8",   reqLevel: 1,  icon: "⚗️" },
    { id: "cooking_pot",      name: "Cooking Pot",      tier: "T1–T3", masterName: "Grand Pot",     masterTier: "T4–T6", divineName: "Divine Kitchen",divineTier: "T7–T8",reqLevel: 1,  icon: "🍲" },
    { id: "loom",             name: "Loom",             tier: "T1–T5", masterName: "Master Loom",   masterTier: "T6–T7", divineName: "Divine Loom",   divineTier: "T8",   reqLevel: 1,  icon: "🧵" },
    { id: "enchanting_altar", name: "Enchanting Altar", tier: "T1–T4", masterName: "Master Altar",  masterTier: "T5–T7", divineName: "Divine Altar",  divineTier: "T8",   reqLevel: 10, icon: "✨" },
  ];

  return (
    <div style={{ padding: "12px 16px", overflowY: "auto" }}>
      <div style={{ color: c.muted, fontSize: 11, marginBottom: 12 }}>
        Standard stations handle T1–T5. Master stations unlock at Lv.30 for T6–T7. Divine stations require Lv.70 + Divine Essence for T8.
      </div>
      {ALL_STATIONS.map(st => (
        <div key={st.id} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 10px", marginBottom: 4, borderRadius: 6,
          background: c.panel2, border: `1px solid ${c.borderDim}`,
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{st.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: c.text, fontWeight: "bold", fontSize: 12 }}>{st.name}</div>
            <div style={{ fontSize: 10, color: c.muted }}>Req. Lv.{st.reqLevel}</div>
          </div>
          {/* Tier chain */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {[
              { label: st.name,       tier: st.tier,       color: TIER_INFO[1].color },
              { label: st.masterName, tier: st.masterTier, color: TIER_INFO[6].color },
              { label: st.divineName, tier: st.divineTier, color: TIER_INFO[8].color },
            ].map(t => (
              <div key={t.label} style={{
                padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: "bold",
                background: t.color + "22", border: `1px solid ${t.color}44`,
                color: t.color, textAlign: "center",
              }}>
                <div>{t.label}</div>
                <div style={{ opacity: 0.7 }}>{t.tier}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Infusions
// ─────────────────────────────────────────────────────────────────────────────

function InfusionsTab({ profId }: { profId: ProfessionId | "all" }) {
  const equipped = useEquipment(s => s.equipped);
  const storageEntries = useStorage(s => s.entries);
  const inventoryItems = useInventory(s => s.items);
  const consumeIngredients = useStorage(s => s.consumeIngredients);
  const removeItem = useInventory(s => s.removeItem);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [lastApplied, setLastApplied] = useState<string | null>(null);

  const equippedSlots = Object.entries(equipped);
  const filtered = profId === "all"
    ? INFUSIONS
    : INFUSIONS.filter(inf => !inf.profession || inf.profession === profId);

  function canApply(inf: InfusionDef): boolean {
    return inf.source === "enemy_drop" || inf.cost.every(c => {
      const s = storageEntries.find(e => e.id === c.itemId)?.quantity ?? 0;
      const i = inventoryItems.find(it => it.id === c.itemId)?.quantity ?? 0;
      return s + i >= c.count;
    });
  }

  function handleApply(inf: InfusionDef) {
    if (!selectedSlot) return;
    if (inf.cost.length > 0) {
      const success = consumeIngredients(inf.cost, inventoryItems, removeItem);
      if (!success) return;
    }
    // TODO: apply infusion effect via useEquipment (stat injection)
    setLastApplied(`${inf.name} → ${selectedSlot}`);
    setTimeout(() => setLastApplied(null), 2500);
  }

  return (
    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
      <div style={{ color: c.muted, fontSize: 11 }}>
        Select an equipped item, then click an infusion to apply it. Each item can hold 1 active infusion.
      </div>

      {lastApplied && (
        <div style={{ background: "#1a2a3a", border: `1px solid ${c.cyan}`, borderRadius: 6, padding: "6px 12px", color: c.cyan, fontSize: 11 }}>
          ✓ Applied: {lastApplied}
        </div>
      )}

      {/* Equipped slots */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
        {equippedSlots.length === 0 && (
          <div style={{ color: c.muted, fontSize: 11 }}>No gear equipped.</div>
        )}
        {equippedSlots.map(([slot, item]) => item && (
          <div
            key={slot}
            onClick={() => setSelectedSlot(slot === selectedSlot ? null : slot)}
            style={{
              padding: "5px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11,
              border: `1px solid ${slot === selectedSlot ? c.gold : c.borderDim}`,
              background: slot === selectedSlot ? c.gold + "22" : c.panel2,
              color: slot === selectedSlot ? c.gold : c.text,
            }}
          >
            <span>{item.icon || "⚔️"}</span> {item.name}
          </div>
        ))}
      </div>

      {/* Infusion list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {filtered.map(inf => {
          const can = canApply(inf);
          const tierColor = TIER_INFO[Math.min(inf.tier, 8) as 1|2|3|4|5|6|7|8].color;
          return (
            <div key={inf.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 10px", borderRadius: 6,
              background: c.panel2, border: `1px solid ${can ? tierColor + "55" : c.borderDim}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>{inf.icon}</span>
                <div>
                  <div style={{ color: tierColor, fontWeight: 700, fontSize: 12 }}>{inf.name}</div>
                  <div style={{ fontSize: 10, color: c.muted }}>{inf.description}</div>
                  {inf.cost.length > 0 && (
                    <div style={{ fontSize: 10, color: can ? c.green : c.red }}>
                      Cost: {inf.cost.map(c => `${c.count}× ${c.itemId.replace(/_/g, " ")}`).join(", ")}
                    </div>
                  )}
                  {inf.source === "enemy_drop" && (
                    <div style={{ fontSize: 9, color: c.muted }}>Drop from enemies</div>
                  )}
                </div>
              </div>
              <button
                disabled={!can || !selectedSlot}
                onClick={() => handleApply(inf)}
                style={{
                  padding: "4px 12px", fontSize: 10, borderRadius: 4, fontWeight: "bold",
                  cursor: can && selectedSlot ? "pointer" : "default",
                  background: can && selectedSlot ? tierColor + "22" : "transparent",
                  border: `1px solid ${can && selectedSlot ? tierColor : c.borderDim}`,
                  color: can && selectedSlot ? tierColor : c.muted,
                }}
              >
                {selectedSlot ? "Apply" : "Select item ↑"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

interface CraftingStationUIProps {
  stationId: string;
  onClose: () => void;
}

export default function CraftingStationUI({ stationId, onClose }: CraftingStationUIProps) {
  const rawProfId = STATION_PROFESSION[stationId] ?? "miner";
  const profId = rawProfId === "all" ? ("miner" as ProfessionId) : rawProfId as ProfessionId;
  const profDef = PROFESSION_DEFS[profId];
  const [activeTab, setActiveTab] = useState<"tree" | "recipes" | "stations" | "infusions">("recipes");

  // Storage info
  const storageCount = useStorage(s => s.entries.length);
  const storageMax = useStorage(s => s.maxSlots);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const tabs = [
    { key: "tree" as const,      label: "🌳 Skill Tree",  color: profDef.color },
    { key: "recipes" as const,   label: "📜 Recipes",    color: c.gold },
    { key: "stations" as const,  label: "🏗️ Stations",  color: c.blue },
    { key: "infusions" as const, label: "✨ Infusions",  color: c.cyan },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.75)",
    }}>
      <div style={{
        width: "min(860px, 95vw)", height: "min(640px, 90vh)",
        background: c.bg, border: `2px solid ${profDef.color}`,
        borderRadius: 12, display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: `0 0 40px ${profDef.color}44, 0 0 80px ${profDef.color}22`,
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px",
          background: `linear-gradient(90deg, ${profDef.color}22, transparent)`,
          borderBottom: `1px solid ${profDef.color}44`,
        }}>
          <span style={{ fontSize: 26 }}>{profDef.icon}</span>
          <div>
            <div style={{ color: profDef.color, fontWeight: 900, fontSize: 16 }}>
              {STATION_LABEL[stationId] ?? stationId}
            </div>
            <div style={{ color: c.muted, fontSize: 10 }}>
              {profDef.name} Station · Storage: {storageCount}/{storageMax}
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button
              onClick={onClose}
              style={{
                padding: "4px 12px", background: "rgba(200,50,50,0.2)",
                border: "1px solid rgba(200,50,50,0.4)", color: "#ff6666",
                borderRadius: 5, cursor: "pointer", fontWeight: "bold", fontSize: 12,
              }}
            >
              ✕ Close [Esc]
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: `1px solid ${c.borderDim}` }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: "9px 4px", fontSize: 12, cursor: "pointer",
                background: activeTab === tab.key ? tab.color + "22" : "transparent",
                border: "none",
                borderBottom: activeTab === tab.key ? `2px solid ${tab.color}` : "2px solid transparent",
                color: activeTab === tab.key ? tab.color : c.muted,
                fontWeight: activeTab === tab.key ? "bold" : "normal",
                transition: "all 0.12s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {activeTab === "tree" && <SkillTreeTab profId={profId} />}
          {activeTab === "recipes" && <RecipesTab stationId={stationId} />}
          {activeTab === "stations" && <StationsTab profId={rawProfId as ProfessionId | "all"} />}
          {activeTab === "infusions" && <InfusionsTab profId={rawProfId as ProfessionId | "all"} />}
        </div>
      </div>
    </div>
  );
}
