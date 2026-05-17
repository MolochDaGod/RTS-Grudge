import { useState, useMemo } from "react";
import { useSurvival } from "@/lib/stores/useSurvival";
import { useInventory, CRAFT_RECIPES, SURVIVAL_BUILD_RECIPES, INVENTORY_EQUIP_MAP, type CraftCategory, type SurvivalBuildCategory, type SurvivalBuildRecipe } from "@/lib/stores/useInventory";
import { useEquipment, SLOT_ORDER, TIER_INFO, CDN_BASE, type EquipSlot, type StatKey, type ActionSlot, type ItemTier } from "@/lib/stores/useEquipment";
import { useGame } from "@/lib/stores/useGame";
import {
  useCharacterStats,
  ATTRIBUTE_EFFECTS,
  ATTRIBUTE_ICON_BASE,
  ATTRIBUTE_ICON_ALTS,
  CDN,
  RACE_BONUSES,
  CLASS_SKILL_TREES,
  WEAPON_MASTERY_NODES,
  CLASS_LABELS,
  SECONDARY_STAT_LABELS,
  HERO_DEFINITIONS,
  type PrimaryAttributes,
  type SecondaryStats,
  type SkillNode,
  type HeroClass,
  type HeroRace,
} from "@/lib/stores/useCharacterStats";
import { useBuildSystem, BUILDING_REGISTRY, type BuildingCategory } from "@/lib/stores/useBuildSystem";
import { useAllies, type AllyType } from "@/lib/stores/useAllies";
import { useStorage } from "@/lib/stores/useStorage";
import { useProfessions, PROFESSION_DEFS, type ProfessionId } from "@/lib/stores/useProfessions";
import { getUnitIcon, getRacePortrait, getClassIcon, getProfessionIcon, type IconRace } from "@/lib/data/icons";
import { FACTIONS_BY_ID } from "@/lib/data/factions";

const AVAILABLE_ANIMATIONS = [
  { name: "skill1", label: "Skill 1", icon: "🔥", type: "skill" as const, cooldown: 3, key: "1" },
  { name: "skill2", label: "Skill 2", icon: "⬆️", type: "skill" as const, cooldown: 4, key: "2" },
  { name: "skill3", label: "Skill 3", icon: "🌀", type: "skill" as const, cooldown: 5, key: "3" },
  { name: "skill4", label: "Skill 4", icon: "👊", type: "skill" as const, cooldown: 3, key: "4" },
  { name: "skill5", label: "Skill 5", icon: "💫", type: "skill" as const, cooldown: 4, key: "5" },
  { name: "attack", label: "Quick Attack", icon: "⚔️", type: "attack" as const, cooldown: 0.5, key: "LMB" },
  { name: "attack2", label: "Heavy Attack", icon: "🗡️", type: "attack" as const, cooldown: 1, key: "LMBx2" },
  { name: "block", label: "Block", icon: "🛡️", type: "skill" as const, cooldown: 0.3, key: "RMB" },
  { name: "dash_attack", label: "Dash Attack", icon: "💨", type: "attack" as const, cooldown: 2, key: "Q+LMB" },
  { name: "classAbility", label: "Class Ability", icon: "✨", type: "skill" as const, cooldown: 8, key: "R" },
  { name: "classAbility2", label: "Class Ability 2", icon: "🌟", type: "skill" as const, cooldown: 10, key: "E" },
  { name: "roll", label: "Roll/Dodge", icon: "🌪️", type: "skill" as const, cooldown: 1, key: "Ctrl" },
];

const RARITY_COLORS: Record<string, string> = {
  common: "#8b7355",
  uncommon: "#a8a8a8",
  rare: "#4a9eff",
  epic: "#9d4dff",
  legendary: "#ff4d4d",
  mythic: "#ffaa00",
  ancient: "#d4a84b",
  artifact: "#f0d890",
};

const SLOT_LABELS: Record<EquipSlot, string> = {
  helm: "Helm", shoulder: "Shoulder", chest: "Chest", legs: "Legs",
  boots: "Boots", belt: "Belt", mainHand: "Mainhand", offHand: "Offhand",
  gloves: "Gloves", cape: "Cape", ring: "Ring", necklace: "Necklace",
};

const SLOT_ICONS: Record<EquipSlot, string> = {
  helm: "⛑️", shoulder: "🦺", chest: "🛡️", legs: "👖",
  boots: "👢", belt: "⛓️", mainHand: "⚔️", offHand: "🛡️",
  gloves: "🧤", cape: "🧣", ring: "💍", necklace: "📿",
};

const GRUDGE_CDN = "https://molochdagod.github.io/ObjectStore";

const SLOT_CDN_ICONS: Record<EquipSlot, string> = {
  helm: `${GRUDGE_CDN}/icons/wcs/armor/Helm_01.png`,
  shoulder: `${GRUDGE_CDN}/icons/wcs/armor/Shoulder_01.png`,
  chest: `${GRUDGE_CDN}/icons/wcs/armor/Chest_01.png`,
  legs: `${GRUDGE_CDN}/icons/wcs/armor/Legs_01.png`,
  boots: `${GRUDGE_CDN}/icons/wcs/armor/Boots_01.png`,
  belt: `${GRUDGE_CDN}/icons/wcs/armor/Belt_01.png`,
  mainHand: `${GRUDGE_CDN}/icons/wcs/weapons/Sword_01.png`,
  offHand: `${GRUDGE_CDN}/icons/wcs/weapons/shield_01.png`,
  gloves: `${GRUDGE_CDN}/icons/wcs/armor/Gloves_01.png`,
  cape: `${GRUDGE_CDN}/icons/wcs/armor/Cape_01.png`,
  ring: `${GRUDGE_CDN}/icons/wcs/misc/Ring_01.png`,
  necklace: `${GRUDGE_CDN}/icons/wcs/misc/Necklace_01.png`,
};

const CLASS_BADGE_COLORS: Record<HeroClass, { color: string; border: string; bg: string }> = {
  warrior: { color: "#ff7d87", border: "#ff7d8740", bg: "#ff7d8712" },
  mage: { color: "#bb95ff", border: "#bb95ff40", bg: "#bb95ff12" },
  worge: { color: "#ffb16d", border: "#ffb16d40", bg: "#ffb16d12" },
  ranger: { color: "#49de95", border: "#49de9540", bg: "#49de9512" },
};

const CHIP_STYLES: Record<string, { color: string; border: string; bg: string }> = {
  dmg: { color: "#ff8b95", border: "#ff8b9540", bg: "#ff8b9510" },
  cd: { color: "#84b2ff", border: "#84b2ff40", bg: "#84b2ff10" },
  heal: { color: "#6ec96e", border: "#6ec96e40", bg: "#6ec96e10" },
  buff: { color: "#ffd56a", border: "#ffd56a40", bg: "#ffd56a10" },
  cc: { color: "#a87ddb", border: "#a87ddb40", bg: "#a87ddb10" },
  ult: { color: "#ff9d4d", border: "#ff9d4d40", bg: "#ff9d4d10" },
};

const f = {
  display: "'Cinzel', serif",
  body: "'Crimson Text', Georgia, serif",
  mono: "'JetBrains Mono', monospace",
};

const ENEMY_BESTIARY: { type: string; name: string; tier: string; hp: number; damage: number; speed: number; xp: number; icon: string; desc: string }[] = [
  { type: "skeleton", name: "Skeleton", tier: "common", hp: 40, damage: 8, speed: 3, xp: 15, icon: "💀", desc: "Undead warriors rising from forgotten graves." },
  { type: "spider", name: "Spider", tier: "common", hp: 25, damage: 6, speed: 5, xp: 10, icon: "🕷️", desc: "Fast skittering arachnids with venomous fangs." },
  { type: "blob", name: "Blob", tier: "common", hp: 35, damage: 5, speed: 2, xp: 8, icon: "🟢", desc: "Gelatinous creatures that absorb everything." },
  { type: "frog", name: "Frog", tier: "common", hp: 60, damage: 10, speed: 6, xp: 20, icon: "🐸", desc: "Oversized amphibians with powerful leaping attacks." },
  { type: "bunny", name: "Bunny", tier: "common", hp: 15, damage: 3, speed: 8, xp: 5, icon: "🐰", desc: "Deceptively aggressive. Extremely fast." },
  { type: "pirate", name: "Pirate", tier: "uncommon", hp: 55, damage: 12, speed: 3.5, xp: 25, icon: "🏴‍☠️", desc: "Seafaring raiders with cutlasses and cunning." },
  { type: "witch", name: "Witch", tier: "uncommon", hp: 35, damage: 15, speed: 2.5, xp: 30, icon: "🧙‍♀️", desc: "Dark spellcasters hurling hexes from range." },
  { type: "ninja", name: "Ninja", tier: "uncommon", hp: 30, damage: 10, speed: 7, xp: 20, icon: "🥷", desc: "Shadow assassins. Lightning-fast strikes." },
  { type: "orc", name: "Orc", tier: "uncommon", hp: 80, damage: 16, speed: 3, xp: 35, icon: "👹", desc: "Brutish green-skinned warriors with heavy blows." },
  { type: "ghost", name: "Ghost", tier: "uncommon", hp: 45, damage: 14, speed: 4, xp: 30, icon: "👻", desc: "Spectral entities phasing through attacks." },
  { type: "cactoro", name: "Cactoro", tier: "uncommon", hp: 70, damage: 12, speed: 2.5, xp: 25, icon: "🌵", desc: "Thorny desert guardians with spike attacks." },
  { type: "tribal", name: "Tribal", tier: "uncommon", hp: 65, damage: 14, speed: 4, xp: 30, icon: "🗿", desc: "Ancient warriors wielding primal weapons." },
  { type: "blue_demon", name: "Blue Demon", tier: "rare", hp: 100, damage: 18, speed: 3.5, xp: 55, icon: "😈", desc: "Frost-infused demons with chilling attacks." },
  { type: "golem", name: "Golem", tier: "rare", hp: 120, damage: 20, speed: 1.5, xp: 50, icon: "🗿", desc: "Massive stone constructs. Slow but devastating." },
  { type: "demon", name: "Demon", tier: "elite", hp: 150, damage: 25, speed: 4, xp: 80, icon: "👿", desc: "Hellfire-wielding fiends of immense power." },
  { type: "mushroom_king", name: "Mushroom King", tier: "elite", hp: 200, damage: 22, speed: 2, xp: 100, icon: "🍄", desc: "Fungal monarch spreading toxic spores." },
  { type: "yeti", name: "Yeti", tier: "elite", hp: 180, damage: 30, speed: 3, xp: 90, icon: "❄️", desc: "Frostbitten beast of the frozen peaks." },
  { type: "alien", name: "Alien", tier: "elite", hp: 160, damage: 28, speed: 4.5, xp: 85, icon: "👽", desc: "Extraterrestrial entity with unknown tech." },
  { type: "dragon", name: "Dragon", tier: "boss", hp: 300, damage: 40, speed: 5, xp: 200, icon: "🐉", desc: "Ancient wyrm. The ultimate challenge." },
  { type: "dino", name: "Dino", tier: "boss", hp: 250, damage: 35, speed: 5, xp: 180, icon: "🦖", desc: "Prehistoric predator with crushing jaws." },
];

const TIER_COLORS: Record<string, { color: string; border: string; bg: string }> = {
  common: { color: "#b0b0b0", border: "#b0b0b030", bg: "#b0b0b008" },
  uncommon: { color: "#4caf50", border: "#4caf5030", bg: "#4caf5008" },
  rare: { color: "#42a5f5", border: "#42a5f530", bg: "#42a5f508" },
  elite: { color: "#ab47bc", border: "#ab47bc30", bg: "#ab47bc08" },
  boss: { color: "#ff9800", border: "#ff980030", bg: "#ff980008" },
};

const ALLY_INFO: { type: AllyType; name: string; icon: string; role: string; hp: number; damage: number; range: number; speed: number; special: string }[] = [
  { type: "soldier", name: "Soldier", icon: "⚔️", role: "Melee", hp: 80, damage: 12, range: 2.5, speed: 3, special: "Frontline melee fighter" },
  { type: "archer", name: "Archer", icon: "🏹", role: "Ranged", hp: 50, damage: 15, range: 12, speed: 2.5, special: "Ranged arrow attacks" },
  { type: "knight", name: "Knight", icon: "🛡️", role: "Tank", hp: 150, damage: 20, range: 2.5, speed: 2.5, special: "High HP frontline tank" },
  { type: "elite_archer", name: "Elite Archer", icon: "🎯", role: "Sniper", hp: 70, damage: 25, range: 18, speed: 3, special: "Long-range precision shots" },
  { type: "farmer", name: "Farmer", icon: "🌾", role: "Gatherer", hp: 40, damage: 4, range: 1.5, speed: 2, special: "Auto-harvests wood, stone, fiber" },
  { type: "warrior", name: "Warrior", icon: "💪", role: "Melee DPS", hp: 120, damage: 18, range: 2.8, speed: 3.5, special: "Fast aggressive melee" },
  { type: "ranger", name: "Ranger", icon: "🌿", role: "Hybrid", hp: 65, damage: 20, range: 15, speed: 4, special: "Ranged attacks + harvesting" },
  { type: "mage", name: "Mage", icon: "🔥", role: "Caster", hp: 55, damage: 22, range: 14, speed: 2.5, special: "Ranged fireballs" },
  { type: "wizard", name: "Wizard", icon: "⚡", role: "Support DPS", hp: 60, damage: 30, range: 16, speed: 2, special: "Lightning + area buff (8 range, +5 dmg)" },
  { type: "captain", name: "Captain", icon: "👑", role: "Commander", hp: 180, damage: 16, range: 3, speed: 3, special: "Area buff (12 range, +8 dmg)" },
];

const BUILDING_CATEGORY_ICONS: Record<BuildingCategory, string> = {
  defense: "🏰", economy: "💰", military: "⚔️", housing: "🏠", special: "✨",
};

type PanelTab = "equipment" | "attributes" | "classSkill" | "skillTree" | "upgrade" | "craft" | "building" | "bestiary" | "allies" | "professions" | "storage";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "equipment",   label: "Equipment" },
  { id: "attributes",  label: "Attributes" },
  { id: "classSkill",  label: "Class Skills" },
  { id: "skillTree",   label: "Weapon Skills" },
  { id: "upgrade",     label: "Base" },
  { id: "craft",       label: "Crafting" },
  { id: "building",    label: "Building" },
  { id: "bestiary",    label: "Bestiary" },
  { id: "allies",      label: "Allies" },
  { id: "professions", label: "Professions" },
  { id: "storage",     label: "Storage" },
];

/** Resolve character portrait URL from race + heroClass. */
function resolvePortrait(race: string | undefined, heroClass: HeroClass | null): string {
  const r = (race ?? "human") as IconRace;
  const arch = heroClass === "ranger" ? "archer" : heroClass === "mage" ? "mage" : "warrior";
  return getUnitIcon(r, arch);
}

/** Faction color for a given faction ID string. */
function factionColor(factionId?: string): string {
  if (!factionId) return "#c9950a";
  const def = Object.values(FACTIONS_BY_ID).find(f => f.id === factionId);
  return def?.color ?? "#c9950a";
}

function formatStat(value: number, format: string): string {
  switch (format) {
    case "int": return Math.round(value).toLocaleString();
    case "1dp": return value.toFixed(1);
    case "2dp": return value.toFixed(2);
    case "3dp": return value.toFixed(3);
    case "pct": return value.toFixed(1) + "%";
    default: return String(value);
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      fontFamily: f.display, fontSize: 12, color: "#d4a400",
      textTransform: "uppercase", letterSpacing: 1,
      margin: "16px 0 10px",
    }}>
      <span style={{ width: 3, height: 14, background: "#d4a400", borderRadius: 3, flexShrink: 0 }} />
      {children}
    </div>
  );
}

function Chip({ type, label }: { type: string; label: string }) {
  const s = CHIP_STYLES[type] || CHIP_STYLES.buff;
  return (
    <span style={{
      fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4,
      border: `1px solid ${s.border}`, borderRadius: 99, padding: "1px 6px",
      color: s.color, background: s.bg,
    }}>{label}</span>
  );
}

function ResBar({ label, current, max, gradient }: { label: string; current: number; max: number; gradient: string }) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  return (
    <div style={{
      width: 120, height: 14, background: "#1a0f08",
      border: "1px solid #3a2a1a", borderRadius: 3,
      overflow: "hidden", position: "relative",
    }}>
      <div style={{ height: "100%", borderRadius: 2, transition: "width .4s", background: gradient, width: `${pct}%` }} />
      <span style={{
        position: "absolute", top: 0, left: 0, right: 0, textAlign: "center",
        fontSize: 9, fontFamily: f.mono, lineHeight: "14px", color: "#fff",
        textShadow: "0 1px 2px #000",
      }}>{label} {Math.round(current)}/{max}</span>
    </div>
  );
}

function EquipSlotBox({ slot, onClick, size = 64 }: { slot: EquipSlot; onClick?: () => void; size?: number }) {
  const item = useEquipment(s => s.equipped[slot]);
  const tierInfo = item ? TIER_INFO[item.tier as ItemTier] : null;
  const borderColor = tierInfo ? tierInfo.color : "#3a2a1a";
  const glowStyle = tierInfo && tierInfo.glow !== "none" ? tierInfo.glow : "none";
  return (
    <div onClick={onClick} title={item ? `${item.name} (T${item.tier} ${item.rarity})` : SLOT_LABELS[slot]}
      style={{
        width: size, height: size,
        border: item ? `2px solid ${borderColor}` : "1px solid transparent",
        borderRadius: 8,
        backgroundImage: `url(/ui/item_slot.png)`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundColor: item ? `${borderColor}12` : "transparent",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: ".15s", position: "relative",
        boxShadow: glowStyle,
      }}>
      {item?.iconUrl ? (
        <img src={item.iconUrl} alt={item.name} style={{ width: size * 0.6, height: size * 0.6, objectFit: "contain", imageRendering: "auto" }} />
      ) : item ? (
        <span style={{ fontSize: 22 }}>{item.icon}</span>
      ) : (
        <img
          src={SLOT_CDN_ICONS[slot]}
          alt={SLOT_LABELS[slot]}
          style={{ width: size * 0.5, height: size * 0.5, objectFit: "contain", opacity: 0.35 }}
          onError={(e) => { (e.target as HTMLImageElement).outerHTML = `<span style="font-size:14px;opacity:0.3">${SLOT_ICONS[slot]}</span>`; }}
        />
      )}
      {!item && (
        <span style={{ fontSize: 7, color: "#6b5535", textTransform: "uppercase", letterSpacing: 0.3, fontFamily: f.display, marginTop: 2 }}>
          {SLOT_LABELS[slot]}
        </span>
      )}
      {item && tierInfo && (
        <span style={{
          position: "absolute", top: 1, left: 3, fontSize: 7, fontWeight: 800,
          color: tierInfo.color, fontFamily: f.mono,
        }}>T{item.tier}</span>
      )}
    </div>
  );
}

function EquipmentTabContent() {
  const { equipped, unequip, getTotalStats } = useEquipment();
  const [selectedSlot, setSelectedSlot] = useState<EquipSlot | null>(null);
  const stats = getTotalStats();

  const leftSlots: EquipSlot[] = ["helm", "shoulder", "chest", "legs", "boots", "belt"];
  const rightSlots: EquipSlot[] = ["mainHand", "offHand", "gloves", "cape", "ring", "necklace"];

  return (
    <div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 120px 1fr", gap: 12,
        alignItems: "start", maxWidth: 560, margin: "0 auto",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
          {leftSlots.map(slot => (
            <EquipSlotBox key={slot} slot={slot} size={58} onClick={() => setSelectedSlot(slot)} />
          ))}
        </div>
        {/* Character portrait in equipment slot center — reads current character from stores */}
        {(() => {
          const charId2   = useGame.getState().selectedCharacter.characterId ||
                            useSurvival.getState().activeCharacterId;
          const heroClass2 = charId2 ? useCharacterStats.getState().getHeroClass(charId2) : null;
          const heroDef2   = charId2 ? HERO_DEFINITIONS.find(h => h.characterId === charId2) : null;
          const race2      = (heroDef2?.race ?? "human") as IconRace;
          const arch2      = heroClass2 === "ranger" ? "archer" : heroClass2 === "mage" ? "mage" : "warrior";
          const portraitEq = getUnitIcon(race2, arch2);
          const fColor2    = factionColor(useGame.getState().selectedCharacter.faction);
          return (
            <div style={{
              width: 110, height: 180, border: `2px solid ${fColor2}`, borderRadius: 10,
              alignSelf: "center", overflow: "hidden", position: "relative", flexShrink: 0,
              background: `radial-gradient(ellipse at 50% 40%, ${fColor2}12, transparent 60%), linear-gradient(135deg, #2e1f14, #1a0f08)`,
            }}>
              <img
                src={portraitEq}
                alt="Character"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.opacity = "0";
                }}
              />
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                padding: "8px 4px 3px", textAlign: "center",
                fontSize: 8, fontFamily: f.display, color: fColor2, textTransform: "uppercase",
              }}>
                {heroClass2 ?? "hero"}
              </div>
            </div>
          );
        })()}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
          {rightSlots.map(slot => (
            <EquipSlotBox key={slot} slot={slot} size={58} onClick={() => setSelectedSlot(slot)} />
          ))}
        </div>
      </div>

      {selectedSlot && equipped[selectedSlot] && (() => {
        const item = equipped[selectedSlot]!;
        const tierInfo = TIER_INFO[item.tier as ItemTier];
        return (
          <div style={{
            marginTop: 12, background: "linear-gradient(135deg, #221710, #1a0f08)",
            border: `1px solid ${tierInfo?.color || "#c9950a"}`, borderRadius: 10, padding: 12,
            boxShadow: tierInfo?.glow || "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {item.iconUrl ? (
                  <img src={item.iconUrl} alt={item.name} style={{ width: 36, height: 36, objectFit: "contain" }} />
                ) : (
                  <span style={{ fontSize: 24 }}>{item.icon}</span>
                )}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: tierInfo?.color || "#fff", fontWeight: 700, fontSize: 13, fontFamily: f.display }}>
                      {item.name}
                    </span>
                    <span style={{
                      fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 3,
                      background: `${tierInfo?.color || "#666"}20`, color: tierInfo?.color || "#666",
                      border: `1px solid ${tierInfo?.color || "#666"}40`,
                    }}>T{item.tier} {tierInfo?.label}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#9b7d52", marginTop: 3 }}>
                    {Object.entries(item.stats).map(([k, v]) => `+${v} ${k.replace(/([A-Z])/g, " $1")}`).join(" · ")}
                  </div>
                </div>
              </div>
              <button onClick={() => { unequip(selectedSlot); setSelectedSlot(null); }}
                style={{
                  padding: "4px 12px", fontSize: 10, background: "rgba(212,80,80,.15)",
                  border: "1px solid rgba(212,80,80,.4)", borderRadius: 6, color: "#d45050",
                  cursor: "pointer", fontFamily: f.display, textTransform: "uppercase", letterSpacing: 0.5,
                }}>Unequip</button>
            </div>
          </div>
        );
      })()}

      <SectionTitle>Equipment Bonuses</SectionTitle>
      <div style={{ background: "linear-gradient(135deg, #1e1510, #160e08)", borderRadius: 8, padding: 8, border: "1px solid #3a2a1a" }}>
        {(["damage", "defense", "health", "armor", "critChance", "block", "attackSpeed", "accuracy", "resistance", "evasion"] as StatKey[]).map(key => (
          <div key={key} style={{
            display: "flex", justifyContent: "space-between", padding: "3px 8px", fontSize: 11,
            borderBottom: "1px solid rgba(255,255,255,.03)",
          }}>
            <span style={{ color: "#9b7d52", fontWeight: 600, textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, " $1")}</span>
            <span style={{ color: (stats[key] || 0) > 0 ? "#6ec96e" : "#555", fontFamily: f.mono, fontSize: 10 }}>
              {(stats[key] || 0) > 0 ? `+${stats[key]}` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttributesTabContent({ charId }: { charId: string | null }) {
  const hero = useCharacterStats(s => charId ? s.heroes[charId] : null);
  const allocateAttribute = useCharacterStats(s => s.allocateAttribute);
  const resetAttributes = useCharacterStats(s => s.resetAttributes);
  const heroDef = charId ? HERO_DEFINITIONS.find(h => h.characterId === charId) : null;
  const [hoveredAttr, setHoveredAttr] = useState<keyof PrimaryAttributes | null>(null);

  if (!charId || !hero) {
    return <div style={{ color: "#9b7d52", textAlign: "center", padding: 40 }}>No character loaded</div>;
  }

  const remaining = hero.attributePointsMax - hero.attributePointsSpent;
  const attrs = hero.attributes;
  const raceInfo = heroDef ? RACE_BONUSES[heroDef.race] : null;

  return (
    <div>
      {raceInfo && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "6px 10px",
          background: "linear-gradient(135deg, #1e1812, #14100a)", border: "1px solid #3a2a1a", borderRadius: 8,
        }}>
          {raceInfo.iconUrl ? (
            <img src={raceInfo.iconUrl} alt={raceInfo.label} style={{ width: 20, height: 20, objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).outerHTML = `<span style="font-size:16px">${raceInfo.icon}</span>`; }} />
          ) : (
            <span style={{ fontSize: 16 }}>{raceInfo.icon}</span>
          )}
          <span style={{ fontSize: 12, color: "#d4a400", fontWeight: 700, fontFamily: f.display }}>{raceInfo.label}</span>
          <span style={{ fontSize: 10, color: "#6ec96e", marginLeft: "auto" }}>{raceInfo.bonus}</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "#9b7d52" }}>
          Attribute Points: <span style={{ color: remaining > 0 ? "#6ec96e" : "#666", fontFamily: f.mono, fontWeight: 700 }}>{remaining}</span>
          <span style={{ color: "#555" }}> / {hero.attributePointsMax}</span>
        </span>
        <button onClick={() => resetAttributes(charId)} style={{
          padding: "3px 10px", fontSize: 9, background: "rgba(212,80,80,.12)",
          border: "1px solid rgba(212,80,80,.3)", borderRadius: 5, color: "#d45050",
          cursor: "pointer", fontFamily: f.display, textTransform: "uppercase",
        }}>Reset</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
        {(Object.keys(ATTRIBUTE_EFFECTS) as (keyof PrimaryAttributes)[]).map(attr => {
          const info = ATTRIBUTE_EFFECTS[attr];
          const val = attrs[attr];
          const base = hero.baseAttributes[attr];
          const added = val - base;
          const isHovered = hoveredAttr === attr;
          return (
            <div key={attr}
              onMouseEnter={() => setHoveredAttr(attr)}
              onMouseLeave={() => setHoveredAttr(null)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                background: isHovered
                  ? "linear-gradient(135deg, #2a1e14, #1e1510)"
                  : "linear-gradient(135deg, #1e1510, #160e08)",
                border: `1px solid ${isHovered ? "#5a4020" : "#3a2a1a"}`, borderRadius: 8,
                transition: ".15s",
              }}>
              <div style={{
                width: 36, height: 36, borderRadius: 6, flexShrink: 0, overflow: "hidden",
                background: "radial-gradient(circle, rgba(212,164,0,.12), transparent)",
                border: "1px solid #5a4020",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <img
                  src={info.iconUrl}
                  alt={info.label}
                  style={{ width: 28, height: 28, objectFit: "contain" }}
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    // One-shot fallback guard: dataset.tried prevents infinite
                    // retry loops when primary and alt resolve to the same URL.
                    if (img.dataset.fallbackTried) {
                      img.style.display = "none";
                      return;
                    }
                    img.dataset.fallbackTried = "1";
                    const altUrl = ATTRIBUTE_ICON_ALTS[attr as keyof PrimaryAttributes];
                    const absAlt = altUrl ? new URL(altUrl, window.location.origin).href : "";
                    if (absAlt && img.src !== absAlt) {
                      img.src = altUrl;
                    } else {
                      img.style.display = "none";
                    }
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f5e2c1" }}>{info.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 16, fontFamily: f.mono, color: "#d4a400", fontWeight: 700 }}>{val}</span>
                  {added > 0 && <span style={{ fontSize: 9, color: "#4caf50" }}>+{added}</span>}
                </div>
                {isHovered && (
                  <div style={{ fontSize: 8, color: "#777", marginTop: 2 }}>
                    {info.effects.slice(0, 2).map((e, i) => (
                      <div key={i} style={{ color: "#6a6" }}>• {e}</div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                {remaining > 0 && (
                  <>
                    <button onClick={() => allocateAttribute(charId, attr, 1)} style={{
                      width: 22, height: 18, borderRadius: 3, border: "1px solid #6ec96e",
                      background: "rgba(110,200,110,.08)", color: "#6ec96e", cursor: "pointer",
                      fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>+</button>
                    <button onClick={() => allocateAttribute(charId, attr, 5)} style={{
                      width: 22, height: 18, borderRadius: 3, border: "1px solid #4a8a4a",
                      background: "rgba(80,160,80,.06)", color: "#4a8a4a", cursor: "pointer",
                      fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>+5</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClassSkillsTabContent({ charId }: { charId: string | null }) {
  const hero = useCharacterStats(s => charId ? s.heroes[charId] : null);
  const learnSkill = useCharacterStats(s => s.learnSkill);
  const getSkillTree = useCharacterStats(s => s.getSkillTree);
  const heroClass = useCharacterStats(s => charId ? s.getHeroClass(charId) : null);

  const tree = charId ? getSkillTree(charId).filter(n => n.category === "class") : [];

  const tiers = useMemo(() => {
    const t: { name: string; skills: SkillNode[] }[] = [];
    for (let i = 0; i < tree.length; i += 3) {
      const tierIdx = Math.floor(i / 3) + 1;
      t.push({ name: `Tier ${tierIdx}`, skills: tree.slice(i, i + 3) });
    }
    return t;
  }, [tree]);

  if (!charId || !hero || !heroClass) {
    return <div style={{ color: "#9b7d52", textAlign: "center", padding: 40 }}>No character loaded</div>;
  }

  const classLabel = CLASS_LABELS[heroClass];
  const badge = CLASS_BADGE_COLORS[heroClass];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "2px 8px", borderRadius: 99, fontSize: 9, fontWeight: 800,
          textTransform: "uppercase", letterSpacing: 0.5,
          color: badge.color, borderColor: badge.border, background: badge.bg,
          border: `1px solid ${badge.border}`,
        }}>{classLabel.icon} {classLabel.label}</span>
        <span style={{ fontSize: 11, color: "#9b7d52" }}>
          Skill Points: <span style={{ color: hero.skillPoints > 0 ? "#6ec96e" : "#9b7d52", fontFamily: f.mono, fontWeight: 700 }}>{hero.skillPoints}</span>
        </span>
      </div>

      {tiers.map((tier, ti) => (
        <div key={ti} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10, color: "#9b7d52", textTransform: "uppercase", letterSpacing: 1.2,
            fontWeight: 700, marginBottom: 8, fontFamily: f.display,
          }}>{tier.name}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {tier.skills.map(node => {
              const rank = hero.skills[node.id] || 0;
              const unlocked = rank > 0;
              const canLearn = hero.skillPoints > 0 && rank < node.maxRank;
              const hasChips = node.effects.map(e => {
                if (e.specialId) return "ult";
                if (e.stat?.includes("Damage") || e.stat?.includes("damage")) return "dmg";
                if (e.stat?.includes("Regen") || e.stat?.includes("heal")) return "heal";
                if (e.stat?.includes("cool") || e.stat?.includes("CDR")) return "cd";
                return "buff";
              });
              return (
                <div key={node.id} onClick={() => canLearn && learnSkill(charId, node.id)}
                  style={{
                    display: "flex", gap: 8, padding: 10, cursor: canLearn ? "pointer" : "default",
                    background: unlocked ? "linear-gradient(135deg, #1a2810, #142008)" : "linear-gradient(135deg, #1e1710, #160f08)",
                    border: `1px solid ${unlocked ? "#4a7a30" : "#3a2a1a"}`, borderRadius: 10,
                    opacity: (!unlocked && !canLearn) ? 0.5 : 1, transition: ".15s",
                  }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: "radial-gradient(circle, rgba(212,164,0,.12), transparent)",
                    border: "1px solid #3a2a1a",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                  }}>{node.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#f5e2c1" }}>
                      {node.name} <span style={{ fontFamily: f.mono, fontSize: 9, color: "#9b7d52" }}>{rank}/{node.maxRank}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#9b7d52", lineHeight: 1.3, marginTop: 2 }}>{node.description}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                      {hasChips.map((c, ci) => <Chip key={ci} type={c} label={c} />)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function WeaponSkillsTabContent({ charId }: { charId: string | null }) {
  const hero = useCharacterStats(s => charId ? s.heroes[charId] : null);
  const learnSkill = useCharacterStats(s => s.learnSkill);
  const getSkillTree = useCharacterStats(s => s.getSkillTree);

  if (!charId || !hero) {
    return <div style={{ color: "#9b7d52", textAlign: "center", padding: 40 }}>No character loaded</div>;
  }

  const tree = getSkillTree(charId).filter(n => n.category === "weapon");

  return (
    <div>
      <div style={{ fontSize: 11, color: "#9b7d52", marginBottom: 12 }}>
        Skill Points: <span style={{ color: hero.skillPoints > 0 ? "#6ec96e" : "#9b7d52", fontFamily: f.mono, fontWeight: 700 }}>{hero.skillPoints}</span>
      </div>
      <SectionTitle>Weapon Mastery</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
        {tree.map(node => {
          const rank = hero.skills[node.id] || 0;
          const unlocked = rank > 0;
          const canLearn = hero.skillPoints > 0 && rank < node.maxRank;
          return (
            <div key={node.id} onClick={() => canLearn && learnSkill(charId, node.id)}
              style={{
                display: "flex", gap: 8, padding: 10, cursor: canLearn ? "pointer" : "default",
                background: unlocked ? "linear-gradient(135deg, #1a2810, #142008)" : "linear-gradient(135deg, #1e1710, #160f08)",
                border: `1px solid ${unlocked ? "#4a7a30" : "#3a2a1a"}`, borderRadius: 10,
                opacity: (!unlocked && !canLearn) ? 0.5 : 1, transition: ".15s",
              }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: "radial-gradient(circle, rgba(212,164,0,.12), transparent)",
                border: "1px solid #3a2a1a",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>{node.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f5e2c1" }}>
                  {node.name} <span style={{ fontFamily: f.mono, fontSize: 9, color: "#9b7d52" }}>{rank}/{node.maxRank}</span>
                </div>
                <div style={{ fontSize: 10, color: "#9b7d52", lineHeight: 1.3, marginTop: 2 }}>{node.description}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                  <Chip type="buff" label="buff" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <SectionTitle>Action Bar</SectionTitle>
      <ActionBarEditor />
    </div>
  );
}

function ActionBarEditor() {
  const { actionSlots, setActionSlot, clearActionSlot } = useEquipment();
  const [editingSlot, setEditingSlot] = useState<number | null>(null);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 12 }}>
        {actionSlots.map((slot, i) => (
          <div key={i} onClick={() => setEditingSlot(editingSlot === i ? null : i)}
            style={{
              border: `2px solid ${editingSlot === i ? "#c9950a" : slot.type === "empty" ? "#3a2a1a" : "#7a5c1e"}`,
              borderRadius: 6, padding: 6, textAlign: "center", cursor: "pointer",
              background: editingSlot === i ? "rgba(212,164,0,.15)" : "linear-gradient(135deg, #221710, #1a0f08)",
              transition: ".15s",
            }}>
            <div style={{ fontSize: 18 }}>{slot.icon || "➕"}</div>
            <div style={{ fontSize: 9, color: "#f5e2c1", marginTop: 2 }}>{slot.label}</div>
            <div style={{
              fontSize: 7, color: "#9b7d52", marginTop: 1, background: "rgba(0,0,0,.3)",
              borderRadius: 2, padding: "1px 4px", display: "inline-block", fontFamily: f.mono,
            }}>[{slot.key}]</div>
            {slot.cooldown > 0 && (
              <div style={{ fontSize: 7, color: "#5a9ad8", marginTop: 1 }}>{slot.cooldown}s CD</div>
            )}
          </div>
        ))}
      </div>

      {editingSlot !== null && (
        <div style={{
          background: "linear-gradient(135deg, #221710, #1a0f08)",
          border: "1px solid #c9950a", borderRadius: 10, padding: 10,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "#d4a400", fontWeight: 700, fontFamily: f.display }}>
              Edit Slot [{actionSlots[editingSlot].key}]
            </span>
            <button onClick={() => { clearActionSlot(editingSlot); setEditingSlot(null); }}
              style={{
                padding: "3px 10px", fontSize: 9, background: "rgba(212,80,80,.15)",
                border: "1px solid rgba(212,80,80,.4)", borderRadius: 4, color: "#d45050", cursor: "pointer",
              }}>Clear</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, maxHeight: 160, overflowY: "auto" }}>
            {AVAILABLE_ANIMATIONS.map(anim => {
              const isActive = actionSlots[editingSlot].animationName === anim.name;
              return (
                <button key={anim.name}
                  onClick={() => {
                    setActionSlot(editingSlot, { label: anim.label, animationName: anim.name, icon: anim.icon, type: anim.type, cooldown: anim.cooldown });
                    setEditingSlot(null);
                  }}
                  style={{
                    padding: "5px 8px", fontSize: 10, borderRadius: 6, cursor: "pointer", textAlign: "left",
                    background: isActive ? "rgba(212,164,0,.25)" : "linear-gradient(135deg, #1e1710, #160f08)",
                    border: isActive ? "1px solid #c9950a" : "1px solid #3a2a1a",
                    color: isActive ? "#d4a400" : "#f5e2c1", fontFamily: f.body,
                  }}>
                  {anim.icon} {anim.label}
                  <span style={{ fontSize: 8, color: "#9b7d52", marginLeft: 4, fontFamily: f.mono }}>{anim.cooldown}s</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function UpgradesTabContent() {
  const { placedBuildings, resources, upgradeBuilding } = useBuildSystem();
  const [activeCat, setActiveCat] = useState<BuildingCategory | "all">("all");

  const buildings = useMemo(() => {
    return placedBuildings.map(pb => {
      const def = BUILDING_REGISTRY.find(b => b.id === pb.defId);
      return { ...pb, def };
    }).filter(b => b.def && (activeCat === "all" || b.def!.category === activeCat));
  }, [placedBuildings, activeCat]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: placedBuildings.length };
    for (const pb of placedBuildings) {
      const def = BUILDING_REGISTRY.find(b => b.id === pb.defId);
      if (def) counts[def.category] = (counts[def.category] || 0) + 1;
    }
    return counts;
  }, [placedBuildings]);

  return (
    <div>
      <SectionTitle>Base Overview</SectionTitle>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ padding: "6px 12px", background: "linear-gradient(135deg, #1e1510, #160e08)", border: "1px solid #3a2a1a", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontFamily: f.mono, color: "#d4a400" }}>{placedBuildings.length}</div>
          <div style={{ fontSize: 9, color: "#9b7d52", textTransform: "uppercase" }}>Buildings</div>
        </div>
        <div style={{ padding: "6px 12px", background: "linear-gradient(135deg, #1e1510, #160e08)", border: "1px solid #3a2a1a", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontFamily: f.mono, color: "#c9a04a" }}>🪵 {resources.wood}</div>
          <div style={{ fontSize: 9, color: "#9b7d52" }}>Wood</div>
        </div>
        <div style={{ padding: "6px 12px", background: "linear-gradient(135deg, #1e1510, #160e08)", border: "1px solid #3a2a1a", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontFamily: f.mono, color: "#9ba4b0" }}>🪨 {resources.stone}</div>
          <div style={{ fontSize: 9, color: "#9b7d52" }}>Stone</div>
        </div>
        <div style={{ padding: "6px 12px", background: "linear-gradient(135deg, #1e1510, #160e08)", border: "1px solid #3a2a1a", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontFamily: f.mono, color: "#ffd56a" }}>⚜ {resources.gold}</div>
          <div style={{ fontSize: 9, color: "#9b7d52" }}>Gold</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => setActiveCat("all")}
          style={{
            padding: "5px 10px", fontSize: 10, borderRadius: 6, fontWeight: 700, cursor: "pointer",
            background: activeCat === "all" ? "rgba(212,164,0,.15)" : "rgba(50,40,30,.4)",
            border: activeCat === "all" ? "1px solid #d4a400" : "1px solid #3a2a1a",
            color: activeCat === "all" ? "#d4a400" : "#9b7d52",
            fontFamily: f.display, textTransform: "uppercase", letterSpacing: 1,
          }}>All ({categoryCounts.all || 0})</button>
        {(["defense", "military", "economy", "housing", "special"] as BuildingCategory[]).map(cat => (
          <button key={cat} onClick={() => setActiveCat(cat)}
            style={{
              padding: "5px 10px", fontSize: 10, borderRadius: 6, fontWeight: 700, cursor: "pointer",
              background: activeCat === cat ? "rgba(212,164,0,.15)" : "rgba(50,40,30,.4)",
              border: activeCat === cat ? "1px solid #d4a400" : "1px solid #3a2a1a",
              color: activeCat === cat ? "#d4a400" : "#9b7d52",
              fontFamily: f.display, textTransform: "uppercase", letterSpacing: 1,
            }}>{BUILDING_CATEGORY_ICONS[cat]} {cat} ({categoryCounts[cat] || 0})</button>
        ))}
      </div>

      {buildings.length === 0 && (
        <div style={{ color: "#6b5535", fontSize: 12, textAlign: "center", padding: 30 }}>
          {placedBuildings.length === 0 ? "No buildings placed yet. Press B to enter Build Mode." : "No buildings in this category."}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
        {buildings.map(b => {
          const def = b.def!;
          const canUpgrade = b.level < def.maxLevel;
          const upgradeCost = canUpgrade ? { wood: def.cost.wood * 1.5, stone: def.cost.stone * 1.5, gold: def.cost.gold * 1.5 } : null;
          const canAfford = upgradeCost ? resources.wood >= upgradeCost.wood && resources.stone >= upgradeCost.stone && resources.gold >= upgradeCost.gold : false;
          const hpPct = b.maxHealth > 0 ? Math.min(100, (b.health / b.maxHealth) * 100) : 0;

          return (
            <div key={b.uid} style={{
              padding: 10, background: "linear-gradient(135deg, #1e1510, #160e08)",
              border: "1px solid #3a2a1a", borderRadius: 10,
              borderLeft: `3px solid ${def.spawnAlly ? "#49de95" : "#c9950a"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{BUILDING_CATEGORY_ICONS[def.category]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: f.display, fontSize: 12, color: "#f5e2c1" }}>{def.name}</div>
                  <div style={{ fontSize: 10, color: "#9b7d52" }}>Lv.{b.level}/{def.maxLevel} — {def.category}</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#8a7050", marginBottom: 6 }}>{def.description}</div>
              {def.spawnAlly && (
                <div style={{ fontSize: 10, color: "#49de95", marginBottom: 4 }}>
                  Spawns: {def.allyCount}x {def.spawnAlly}
                </div>
              )}
              <div style={{ height: 4, background: "#1a0f08", borderRadius: 2, overflow: "hidden", marginBottom: 6, border: "1px solid #3a2a1a" }}>
                <div style={{ height: "100%", background: hpPct > 50 ? "linear-gradient(90deg, #4a7a30, #6ec96e)" : "linear-gradient(90deg, #8b2020, #d44040)", width: `${hpPct}%`, borderRadius: 2, transition: "width .3s" }} />
              </div>
              <div style={{ fontSize: 9, color: "#9b7d52", fontFamily: f.mono }}>{Math.round(b.health)}/{b.maxHealth} HP</div>
              {canUpgrade && upgradeCost && (
                <button disabled={!canAfford} onClick={() => upgradeBuilding(b.uid)}
                  style={{
                    marginTop: 6, padding: "4px 12px", fontSize: 10, borderRadius: 6, fontWeight: 700, width: "100%",
                    background: canAfford ? "linear-gradient(180deg, rgba(212,164,0,.2), rgba(212,164,0,.05))" : "rgba(100,100,100,.1)",
                    border: canAfford ? "2px solid #d4a400" : "1px solid #3a2a1a",
                    color: canAfford ? "#d4a400" : "#6b5535", cursor: canAfford ? "pointer" : "default",
                    fontFamily: f.display, textTransform: "uppercase", letterSpacing: 1,
                  }}>
                  Upgrade (🪵{Math.round(upgradeCost.wood)} 🪨{Math.round(upgradeCost.stone)} ⚜{Math.round(upgradeCost.gold)})
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// WCS-aligned crafting category list with all 12 categories (6 original + 6 profession)
const CRAFT_CATEGORIES: { id: CraftCategory; label: string; icon: string; profOnly?: boolean }[] = [
  { id: "tools",       label: "Tools",       icon: "🔧" },
  { id: "weapons",     label: "Weapons",     icon: "⚔️" },
  { id: "armor",       label: "Armor",       icon: "🛡️" },
  { id: "food",        label: "Food",        icon: "🍖" },
  { id: "consumables", label: "Potions",     icon: "🧪" },
  { id: "materials",   label: "Materials",   icon: "🪵" },
  // WCS profession categories
  { id: "smelt",       label: "Smelt",       icon: "🔥",  profOnly: true },
  { id: "woodwork",    label: "Woodwork",    icon: "🚵",  profOnly: true },
  { id: "leatherwork", label: "Leather",     icon: "🦴",  profOnly: true },
  { id: "weave",       label: "Weave",       icon: "🧵",  profOnly: true },
  { id: "alchemy",     label: "Alchemy",     icon: "⚗️",  profOnly: true },
  { id: "enchant",     label: "Enchant",     icon: "✨",  profOnly: true },
];

function CraftingTabContent() {
  const { craft, hasItem, items, removeItem } = useInventory();
  const storageEntries = useStorage(s => s.entries);
  const consumeIngredients = useStorage(s => s.consumeIngredients);
  const addToStorage = useStorage(s => s.addToStorage);
  const [activeCat, setActiveCat] = useState<CraftCategory>("tools");
  const [showProf, setShowProf] = useState(false);
  const [lastCrafted, setLastCrafted] = useState<string | null>(null);

  const filtered = useMemo(() =>
    CRAFT_RECIPES.filter(r => r.category === activeCat), [activeCat]);

  // Combined ingredient check: storage + inventory
  function canCraftCombined(recipe: typeof filtered[0]): boolean {
    return recipe.ingredients.every(ing => {
      const stored = storageEntries.find(e => e.id === ing.itemId)?.quantity ?? 0;
      const carried = items.find(i => i.id === ing.itemId)?.quantity ?? 0;
      return stored + carried >= ing.count;
    });
  }

  function handleCraft(recipe: typeof filtered[0]) {
    const isMaterialsProf = CRAFT_CATEGORIES.find(c => c.id === recipe.category)?.profOnly;
    if (isMaterialsProf) {
      // Profession recipes: consume from storage first → output to storage
      const success = consumeIngredients(recipe.ingredients, items, removeItem);
      if (success) {
        addToStorage({
          id: recipe.result.id, name: recipe.result.name, icon: recipe.result.icon,
          quantity: recipe.result.quantity, type: recipe.result.type as any, source: "crafted",
        });
        setLastCrafted(`${recipe.name} → Storage`);
        setTimeout(() => setLastCrafted(null), 2500);
      }
    } else {
      // Regular recipes: consume from inventory only → add to inventory
      const success = craft(recipe);
      if (success) {
        setLastCrafted(recipe.name);
        setTimeout(() => setLastCrafted(null), 2000);
      }
    }
  }

  const visibleCats = CRAFT_CATEGORIES.filter(c => showProf ? true : !c.profOnly);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <SectionTitle>Crafting</SectionTitle>
        <button
          onClick={() => setShowProf(p => !p)}
          style={{
            fontSize: 9, padding: "3px 8px", borderRadius: 4, cursor: "pointer",
            background: showProf ? "rgba(73,222,149,.15)" : "rgba(50,40,30,.4)",
            border: showProf ? "1px solid #49de95" : "1px solid #3a2a1a",
            color: showProf ? "#49de95" : "#9b7d52", fontFamily: f.display,
          }}
        >⛓ Profession Recipes
        </button>
      </div>

      {lastCrafted && (
        <div style={{
          marginBottom: 8, padding: "6px 10px", borderRadius: 6,
          background: "#1a2814", border: "1px solid #4ddd4d",
          color: "#6ec96e", fontSize: 11,
        }}>✓ Crafted: {lastCrafted}</div>
      )}

      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
        {visibleCats.map(cat => (
          <button key={cat.id} onClick={() => setActiveCat(cat.id)}
            style={{
              padding: "5px 10px", fontSize: 9, borderRadius: 6, fontWeight: 700,
              background: activeCat === cat.id ? (cat.profOnly ? "rgba(73,222,149,.15)" : "rgba(212,164,0,.15)") : "rgba(50,40,30,.4)",
              border: activeCat === cat.id ? (cat.profOnly ? "1px solid #49de95" : "1px solid #d4a400") : "1px solid #3a2a1a",
              color: activeCat === cat.id ? (cat.profOnly ? "#49de95" : "#d4a400") : "#9b7d52",
              cursor: "pointer", fontFamily: f.display, textTransform: "uppercase", letterSpacing: 0.8,
            }}>{cat.icon} {cat.label}</button>
        ))}
      </div>

      {showProf && CRAFT_CATEGORIES.find(c => c.id === activeCat)?.profOnly && (
        <div style={{ marginBottom: 8, fontSize: 10, color: "#49de95", padding: "4px 8px", background: "rgba(73,222,149,.06)", borderRadius: 4, border: "1px solid #49de9530" }}>
          Profession recipe — ingredients consumed from Storage first, output stored in Storage.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map(recipe => {
          const isProfRecipe = CRAFT_CATEGORIES.find(c => c.id === recipe.category)?.profOnly;
          const canCraft = isProfRecipe ? canCraftCombined(recipe) : recipe.ingredients.every(ing => hasItem(ing.itemId, ing.count));
          return (
            <div key={recipe.id} style={{
              padding: 10, borderRadius: 8, opacity: canCraft ? 1 : 0.45,
              background: "linear-gradient(135deg, #1e1510, #160e08)",
              border: "1px solid #3a2a1a",
              borderLeft: isProfRecipe ? "3px solid #49de95" : "3px solid #c9950a",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: isProfRecipe ? "#49de95" : "#d4a400", fontWeight: 700, fontSize: 13, fontFamily: f.display }}>
                    {recipe.result.icon} {recipe.name}
                  </div>
                  {recipe.result.description && (
                    <div style={{ fontSize: 9, color: "#8a7050", marginTop: 2 }}>{recipe.result.description}</div>
                  )}
                  <div style={{ fontSize: 10, color: "#9b7d52", marginTop: 4 }}>
                    {recipe.ingredients.map(ing => {
                      const stored  = storageEntries.find(e => e.id === ing.itemId)?.quantity ?? 0;
                      const carried = items.find(i => i.id === ing.itemId)?.quantity ?? 0;
                      const have    = stored + carried;
                      const color   = have >= ing.count ? "#6ec96e" : "#cc5555";
                      return (
                        <span key={ing.itemId} style={{ color, marginRight: 8 }}>
                          {have}/{ing.count} {ing.itemId.replace(/_/g, " ")}
                          {stored > 0 && <span style={{ color: "#49de9580", fontSize: 8 }}> (📦{stored})</span>}
                        </span>
                      );
                    })}
                  </div>
                  {recipe.result.damage && <div style={{ fontSize: 9, color: "#cc8844", marginTop: 2 }}>Damage: {recipe.result.damage}</div>}
                  {recipe.result.healAmount && <div style={{ fontSize: 9, color: "#66cc66", marginTop: 2 }}>Heal: {recipe.result.healAmount}</div>}
                </div>
                <button disabled={!canCraft} onClick={() => handleCraft(recipe)}
                  style={{
                    padding: "6px 14px", fontSize: 10, borderRadius: 6, fontWeight: 700,
                    background: canCraft
                      ? (isProfRecipe ? "rgba(73,222,149,.2)" : "rgba(212,164,0,.2)")
                      : "rgba(100,100,100,.1)",
                    border: canCraft
                      ? (isProfRecipe ? "2px solid #49de95" : "2px solid #d4a400")
                      : "1px solid #3a2a1a",
                    color: canCraft ? (isProfRecipe ? "#49de95" : "#d4a400") : "#6b5535",
                    cursor: canCraft ? "pointer" : "default",
                    fontFamily: f.display, textTransform: "uppercase", letterSpacing: 1,
                  }}>Craft</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ color: "#6b5535", fontSize: 12, textAlign: "center", padding: 20 }}>No recipes in this category</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ProfessionsTabContent() {
  const professions = useProfessions(s => s.professions);
  const unlockNode  = useProfessions(s => s.unlockNode);
  const isNodeUnlocked = useProfessions(s => s.isNodeUnlocked);
  const [expanded, setExpanded] = useState<ProfessionId | null>(null);

  return (
    <div>
      <SectionTitle>Crafting Professions</SectionTitle>
      <div style={{ fontSize: 10, color: "#8a7050", marginBottom: 12 }}>
        Visit a crafting station (Forge, Workbench, Alchemy Table, Loom, or Tannery) and press E to open the full skill tree.
      </div>
      {(Object.keys(PROFESSION_DEFS) as ProfessionId[]).map(profId => {
        const def  = PROFESSION_DEFS[profId];
        const prof = professions[profId];
        const xpPct = prof.level >= 100 ? 100 : Math.min(100, (prof.xp / Math.max(1, prof.xpToNext)) * 100);
        const nodesUnlocked = prof.unlockedNodes.length;
        const isEx  = expanded === profId;
        return (
          <div key={profId}
            onClick={() => setExpanded(isEx ? null : profId)}
            style={{
              marginBottom: 8, padding: 10, borderRadius: 10, cursor: "pointer",
              background: isEx ? "linear-gradient(135deg, #1e2418, #141a0e)" : "linear-gradient(135deg, #1e1510, #160e08)",
              border: `1px solid ${isEx ? def.color + "66" : "#3a2a1a"}`,
              borderLeft: `3px solid ${def.color}`,
              transition: ".15s",
            }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22 }}>{def.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: f.display, fontSize: 12, color: def.color }}>{def.name}</span>
                  <span style={{ fontFamily: f.mono, fontSize: 12, color: "#d4a400", fontWeight: 700 }}>Lv.{prof.level}</span>
                </div>
                {/* XP bar */}
                <div style={{ height: 6, background: "#1a0f08", border: "1px solid #3a2a1a", borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
                  <div style={{ height: "100%", width: `${xpPct}%`, background: `linear-gradient(90deg, ${def.color}88, ${def.color})`, transition: "width .4s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#9b7d52", marginTop: 2 }}>
                  <span>{prof.xp.toLocaleString()} / {prof.xpToNext === Infinity ? "MAX" : prof.xpToNext.toLocaleString()} XP</span>
                  <span style={{ color: prof.skillPoints > 0 ? "#6ec96e" : "#555" }}>
                    {prof.skillPoints > 0 ? `★ ${prof.skillPoints} pts` : `${nodesUnlocked}/50 nodes`}
                  </span>
                </div>
              </div>
            </div>

            {/* Expanded detail */}
            {isEx && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, color: "#9b7d52", marginBottom: 6 }}>{def.description}</div>
                <div style={{ fontSize: 9, color: def.color, marginBottom: 6 }}>
                  Gathers: {def.gatherTypes.join(" · ")}
                </div>
                <div style={{ fontSize: 9, color: "#8a7050", marginBottom: 6 }}>
                  Crafts: {def.crafts}
                </div>
                {/* Mini node grid preview (first 10 nodes) */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 6 }}>
                  {Array.from({ length: 50 }).map((_, i) => {
                    const nodeId = `${profId}_t${Math.floor(i / 10) + 1}_${(i % 10) + 1}`;
                    const unlocked = isNodeUnlocked(profId, nodeId);
                    return (
                      <div key={nodeId} style={{
                        width: 10, height: 10, borderRadius: 2,
                        background: unlocked ? def.color : "#2a1e14",
                        border: `1px solid ${unlocked ? def.color + "88" : "#3a2a1a"}`,
                      }} />
                    );
                  })}
                </div>
                <div style={{ fontSize: 9, color: "#9b7d52", marginTop: 4 }}>
                  {nodesUnlocked}/50 skill nodes unlocked
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function StorageTabContent() {
  const entries    = useStorage(s => s.entries);
  const usedSlots  = useStorage(s => s.usedSlots);
  const maxSlots   = useStorage(s => s.maxSlots);
  const totalQty   = useStorage(s => s.totalQuantity);
  const removeFromStorage = useStorage(s => s.removeFromStorage);
  const addItem    = useInventory(s => s.addItem);
  const [search, setSearch]   = useState("");
  const [srcFilter, setSrcFilter] = useState<string>("all");

  const SOURCE_COLORS: Record<string, { color: string; label: string }> = {
    auto_harvest: { color: "#49de95", label: "🌾 Auto-Harvest" },
    crafted:      { color: "#d4a400", label: "⚒ Crafted" },
    manual:       { color: "#84b2ff", label: "🔒 Manual" },
    looted:       { color: "#ff8b95", label: "💰 Looted" },
    transfer:     { color: "#bb95ff", label: "⇄ Transfer" },
    quest:        { color: "#ffd56a", label: "📖 Quest" },
  };

  const filtered = useMemo(() => {
    let list = entries;
    if (srcFilter !== "all") list = list.filter(e => (e.source ?? "manual") === srcFilter);
    if (search.trim()) list = list.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [entries, srcFilter, search]);

  function transferToInventory(id: string, qty: number = 1) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    addItem({ id: entry.id, name: entry.name, type: entry.type, icon: entry.icon, quantity: qty });
    removeFromStorage(id, qty);
  }

  return (
    <div>
      <SectionTitle>Account Storage</SectionTitle>
      <div style={{ fontSize: 10, color: "#8a7050", marginBottom: 8 }}>
        Non-droppable account goods. Never lost on death. Auto-harvest output lands here automatically.
      </div>

      {/* Stats bar */}
      <div style={{
        display: "flex", gap: 12, marginBottom: 10, padding: "6px 10px",
        background: "linear-gradient(135deg, #1e1510, #160e08)", border: "1px solid #3a2a1a", borderRadius: 6,
        fontSize: 11, fontFamily: f.mono,
      }}>
        <span style={{ color: "#9b7d52" }}>Slots: <span style={{ color: "#d4a400" }}>{usedSlots()}/{maxSlots}</span></span>
        <span style={{ color: "#9b7d52" }}>Items: <span style={{ color: "#6ec96e" }}>{totalQty().toLocaleString()}</span></span>
      </div>

      {/* Search + filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          placeholder="Search storage…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 100, background: "#1e1510", border: "1px solid #3a2a1a",
            borderRadius: 5, padding: "4px 8px", color: "#f5e2c1", fontSize: 11, outline: "none",
          }}
        />
        {["all", ...Object.keys(SOURCE_COLORS)].map(src => (
          <button key={src} onClick={() => setSrcFilter(src)}
            style={{
              padding: "3px 8px", fontSize: 9, borderRadius: 4, cursor: "pointer",
              background: srcFilter === src ? "rgba(212,164,0,.15)" : "rgba(50,40,30,.4)",
              border: srcFilter === src ? "1px solid #d4a400" : "1px solid #3a2a1a",
              color: srcFilter === src ? "#d4a400" : "#9b7d52",
              fontFamily: f.display, textTransform: "uppercase",
            }}>
            {src === "all" ? "All" : SOURCE_COLORS[src]?.label ?? src}
          </button>
        ))}
      </div>

      {entries.length === 0 && (
        <div style={{ color: "#6b5535", fontSize: 12, textAlign: "center", padding: 30 }}>
          Storage is empty. Build a Camp or send allies to auto-harvest.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
        {filtered.map(entry => {
          const srcInfo = SOURCE_COLORS[entry.source ?? "manual"];
          return (
            <div key={entry.id} style={{
              padding: "8px 10px", borderRadius: 8,
              background: "linear-gradient(135deg, #1e1510, #160e08)",
              border: "1px solid #3a2a1a",
              borderLeft: `3px solid ${srcInfo?.color ?? "#c9950a"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 20 }}>{entry.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontFamily: f.display, color: "#f5e2c1" }}>{entry.name}</div>
                    <div style={{ fontSize: 9, color: srcInfo?.color ?? "#9b7d52" }}>{srcInfo?.label ?? entry.source}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontFamily: f.mono, color: "#d4a400", fontWeight: 700 }}>{entry.quantity.toLocaleString()}</div>
                  {entry.tier && (
                    <div style={{ fontSize: 9, color: TIER_INFO[Math.min(entry.tier, 8) as ItemTier]?.color }}>
                      T{entry.tier}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => transferToInventory(entry.id, 1)}
                style={{
                  marginTop: 6, width: "100%", padding: "3px 0", fontSize: 9,
                  background: "rgba(132,178,255,.1)", border: "1px solid rgba(132,178,255,.3)",
                  borderRadius: 4, color: "#84b2ff", cursor: "pointer",
                  fontFamily: f.display, textTransform: "uppercase", letterSpacing: 0.5,
                }}
              >⇄ Move 1 to Inventory</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const BUILD_CATEGORIES: { id: SurvivalBuildCategory; label: string; icon: string }[] = [
  { id: "fire", label: "Fire & Heat", icon: "🔥" },
  { id: "structure", label: "Structure", icon: "🏠" },
  { id: "furniture", label: "Furniture", icon: "🪑" },
  { id: "defense", label: "Defense", icon: "🪵" },
  { id: "storage", label: "Storage", icon: "📦" },
];

function BuildingTabContent() {
  const { hasItem, items, craftSurvivalBuilding } = useInventory();
  const [activeCat, setActiveCat] = useState<SurvivalBuildCategory>("fire");

  const filtered = useMemo(() =>
    SURVIVAL_BUILD_RECIPES.filter(r => r.category === activeCat), [activeCat]);

  const handleBuild = (recipe: SurvivalBuildRecipe) => {
    const success = craftSurvivalBuilding(recipe);
    if (success) {
      const event = new CustomEvent("survival-build-place", { detail: recipe });
      window.dispatchEvent(event);
    }
  };

  return (
    <div>
      <SectionTitle>Survival Building</SectionTitle>
      <div style={{ fontSize: 10, color: "#8a7050", marginBottom: 10 }}>
        Craft structures and place them in the world. Materials are consumed on craft.
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
        {BUILD_CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setActiveCat(cat.id)}
            style={{
              padding: "6px 12px", fontSize: 10, borderRadius: 6, fontWeight: 700,
              background: activeCat === cat.id ? "rgba(212,164,0,.15)" : "rgba(50,40,30,.4)",
              border: activeCat === cat.id ? "1px solid #d4a400" : "1px solid #3a2a1a",
              color: activeCat === cat.id ? "#d4a400" : "#9b7d52",
              cursor: "pointer", fontFamily: f.display, textTransform: "uppercase", letterSpacing: 1,
            }}>{cat.icon} {cat.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map(recipe => {
          const canBuild = recipe.ingredients.every(ing => hasItem(ing.itemId, ing.count));
          return (
            <div key={recipe.id} style={{
              padding: 10, borderRadius: 8, opacity: canBuild ? 1 : 0.45,
              background: "linear-gradient(135deg, #1e1510, #160e08)",
              border: "1px solid #3a2a1a", borderLeft: `3px solid ${recipe.color}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#d4a400", fontWeight: 700, fontSize: 13, fontFamily: f.display }}>
                    {recipe.icon} {recipe.name}
                  </div>
                  <div style={{ fontSize: 9, color: "#8a7050", marginTop: 2 }}>{recipe.description}</div>
                  <div style={{ fontSize: 10, color: "#9b7d52", marginTop: 4 }}>
                    {recipe.ingredients.map(ing => {
                      const has = items.find(i => i.id === ing.itemId);
                      const count = has ? has.quantity : 0;
                      const color = count >= ing.count ? "#6ec96e" : "#cc5555";
                      return <span key={ing.itemId} style={{ color, marginRight: 8 }}>{count}/{ing.count} {ing.itemId.replace(/_/g, " ")}</span>;
                    })}
                  </div>
                  <div style={{ fontSize: 9, color: "#6b5535", marginTop: 2 }}>
                    Size: {recipe.size[0]}x{recipe.size[2]}x{recipe.size[1]}
                  </div>
                </div>
                <button disabled={!canBuild} onClick={() => handleBuild(recipe)}
                  style={{
                    padding: "6px 16px", fontSize: 10, borderRadius: 6, fontWeight: 700,
                    background: canBuild ? "linear-gradient(180deg, rgba(100,180,80,.2), rgba(100,180,80,.05))" : "rgba(100,100,100,.1)",
                    border: canBuild ? "2px solid #6ec96e" : "1px solid #3a2a1a",
                    color: canBuild ? "#6ec96e" : "#6b5535", cursor: canBuild ? "pointer" : "default",
                    fontFamily: f.display, textTransform: "uppercase", letterSpacing: 1,
                  }}>Build</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BestiaryTabContent() {
  const [activeTier, setActiveTier] = useState<string>("all");
  const [selectedEnemy, setSelectedEnemy] = useState<string | null>(null);

  const filtered = useMemo(() =>
    ENEMY_BESTIARY.filter(e => activeTier === "all" || e.tier === activeTier), [activeTier]);

  const selected = selectedEnemy ? ENEMY_BESTIARY.find(e => e.type === selectedEnemy) : null;

  return (
    <div>
      <SectionTitle>Monster Bestiary ({ENEMY_BESTIARY.length} Types)</SectionTitle>
      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
        {["all", "common", "uncommon", "rare", "elite", "boss"].map(tier => {
          const count = tier === "all" ? ENEMY_BESTIARY.length : ENEMY_BESTIARY.filter(e => e.tier === tier).length;
          const tc = TIER_COLORS[tier] || TIER_COLORS.common;
          return (
            <button key={tier} onClick={() => setActiveTier(tier)}
              style={{
                padding: "5px 10px", fontSize: 10, borderRadius: 6, fontWeight: 700, cursor: "pointer",
                background: activeTier === tier ? (tc.bg || "rgba(212,164,0,.15)") : "rgba(50,40,30,.4)",
                border: activeTier === tier ? `1px solid ${tc.color || "#d4a400"}` : "1px solid #3a2a1a",
                color: activeTier === tier ? (tc.color || "#d4a400") : "#9b7d52",
                fontFamily: f.display, textTransform: "uppercase", letterSpacing: 1,
              }}>{tier} ({count})</button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
        {filtered.map(enemy => {
          const tc = TIER_COLORS[enemy.tier] || TIER_COLORS.common;
          const isSelected = selectedEnemy === enemy.type;
          return (
            <div key={enemy.type} onClick={() => setSelectedEnemy(isSelected ? null : enemy.type)}
              style={{
                padding: 10, cursor: "pointer", transition: ".15s",
                background: isSelected ? "linear-gradient(135deg, #2a1f14, #1e1510)" : "linear-gradient(135deg, #1e1510, #160e08)",
                border: `1px solid ${isSelected ? tc.color : "#3a2a1a"}`, borderRadius: 10,
                borderLeft: `3px solid ${tc.color}`,
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22 }}>{enemy.icon}</span>
                <div>
                  <div style={{ fontFamily: f.display, fontSize: 12, color: "#f5e2c1" }}>{enemy.name}</div>
                  <span style={{
                    fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5,
                    border: `1px solid ${tc.border}`, borderRadius: 99, padding: "1px 6px",
                    color: tc.color, background: tc.bg,
                  }}>{enemy.tier}</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#8a7050", marginTop: 6, lineHeight: 1.3 }}>{enemy.desc}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 10, fontFamily: f.mono }}>
                <span style={{ color: "#d44040" }}>❤ {enemy.hp}</span>
                <span style={{ color: "#ff8b95" }}>⚔ {enemy.damage}</span>
                <span style={{ color: "#84b2ff" }}>💨 {enemy.speed}</span>
                <span style={{ color: "#ffd56a" }}>★ {enemy.xp}xp</span>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div style={{
          marginTop: 14, padding: 14,
          background: "linear-gradient(135deg, #221710, #1a0f08)",
          border: `1px solid ${(TIER_COLORS[selected.tier] || TIER_COLORS.common).color}`, borderRadius: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 32 }}>{selected.icon}</span>
            <div>
              <div style={{ fontFamily: f.display, fontSize: 16, color: "#f5e2c1" }}>{selected.name}</div>
              <div style={{ fontSize: 11, color: "#9b7d52", marginTop: 2 }}>{selected.desc}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[
              { label: "Health", value: selected.hp, color: "#d44040", icon: "❤" },
              { label: "Damage", value: selected.damage, color: "#ff8b95", icon: "⚔" },
              { label: "Speed", value: selected.speed, color: "#84b2ff", icon: "💨" },
              { label: "XP Reward", value: selected.xp, color: "#ffd56a", icon: "★" },
            ].map(stat => (
              <div key={stat.label} style={{
                padding: 8, textAlign: "center",
                background: "linear-gradient(135deg, #1e1510, #160e08)",
                border: "1px solid #3a2a1a", borderRadius: 8,
              }}>
                <div style={{ fontSize: 16, color: stat.color }}>{stat.icon}</div>
                <div style={{ fontSize: 16, fontFamily: f.mono, color: stat.color, fontWeight: 700 }}>{stat.value}</div>
                <div style={{ fontSize: 9, color: "#9b7d52", textTransform: "uppercase" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Faction color map matching FACTIONS_BY_ID colors
const ALLY_FACTION_COLORS: Record<string, { color: string; border: string; bg: string }> = {
  crusade: { color: "#3aa0ff", border: "#3aa0ff44", bg: "#3aa0ff10" },
  fabled:  { color: "#3ddc7b", border: "#3ddc7b44", bg: "#3ddc7b10" },
  legion:  { color: "#ff3a3a", border: "#ff3a3a44", bg: "#ff3a3a10" },
  pirate:  { color: "#d4a437", border: "#d4a43744", bg: "#d4a43710" },
  wild:    { color: "#a07050", border: "#a0705044", bg: "#a0705010" },
};

function AlliesTabContent() {
  const allies      = useAllies(s => s.allies);
  const storageEntries = useStorage(s => s.entries);
  const [selectedType, setSelectedType] = useState<AllyType | null>(null);

  // Auto-harvest items accumulated in storage this session
  const autoHarvestCount = storageEntries.filter(e => e.source === "auto_harvest").reduce((s, e) => s + e.quantity, 0);

  const activeAllyCounts = useMemo(() => {
    const counts: Partial<Record<AllyType, number>> = {};
    for (const ally of allies) {
      counts[ally.type] = (counts[ally.type] || 0) + 1;
    }
    return counts;
  }, [allies]);

  const selected = selectedType ? ALLY_INFO.find(a => a.type === selectedType) : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <SectionTitle>Ally Forces ({allies.length} Active)</SectionTitle>
        {autoHarvestCount > 0 && (
          <span style={{ fontSize: 10, color: "#49de95", fontFamily: f.mono }}>
            📦 {autoHarvestCount.toLocaleString()} gathered → Storage
          </span>
        )}
      </div>
      <div style={{ fontSize: 10, color: "#8a7050", marginBottom: 12 }}>
        Build military structures to recruit allies. Command them with F1 (Follow), F2 (Patrol), F3 (Stay), F4 (Attack).
        Harvesting allies send resources directly to your Storage.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8 }}>
        {ALLY_INFO.map(allyInfo => {
          // Find the actual faction from a live ally of this type
          const liveAlly = allies.find(a => a.type === allyInfo.type);
          const factionId = liveAlly?.faction ?? "crusade";
          const fColors = ALLY_FACTION_COLORS[factionId] ?? ALLY_FACTION_COLORS.crusade;
          const count = activeAllyCounts[allyInfo.type] || 0;
          const isSelected = selectedType === allyInfo.type;
          const hasActive = count > 0;
          const isHarvester = allyInfo.type === "farmer" || allyInfo.type === "ranger";
          return (
            <div key={allyInfo.type} onClick={() => setSelectedType(isSelected ? null : allyInfo.type)}
              style={{
                padding: 10, cursor: "pointer", transition: ".15s",
                background: hasActive ? fColors.bg : "linear-gradient(135deg, #1e1510, #160e08)",
                border: `1px solid ${isSelected ? fColors.color : hasActive ? fColors.border : "#3a2a1a"}`,
                borderLeft: `3px solid ${fColors.color}`,
                borderRadius: 10,
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Race portrait */}
                <div style={{ width: 36, height: 36, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "#1a0f08", border: `1px solid ${fColors.border}` }}>
                  <img
                    src={getProfessionIcon(allyInfo.name, factionId === "fabled" ? "elf" : factionId === "legion" ? "orc" : "human")}
                    alt={allyInfo.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: f.display, fontSize: 12, color: "#f5e2c1" }}>{allyInfo.name}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                    <span style={{
                      fontSize: 7, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5,
                      border: `1px solid ${fColors.border}`, borderRadius: 99, padding: "1px 5px",
                      color: fColors.color, background: fColors.bg,
                    }}>{factionId}</span>
                    <span style={{
                      fontSize: 7, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5,
                      border: "1px solid #49de9540", borderRadius: 99, padding: "1px 5px",
                      color: "#49de95", background: "#49de9512",
                    }}>{allyInfo.role}</span>
                    {isHarvester && (
                      <span style={{
                        fontSize: 7, fontWeight: 800, letterSpacing: 0.3,
                        border: "1px solid #d4a40044", borderRadius: 99, padding: "1px 5px",
                        color: "#d4a400", background: "#d4a40012",
                      }}>→ Storage</span>
                    )}
                  </div>
                </div>
                {hasActive && (
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    background: fColors.bg, border: `1px solid ${fColors.color}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontFamily: f.mono, color: fColors.color, fontWeight: 700,
                  }}>{count}</div>
                )}
              </div>
              <div style={{ fontSize: 10, color: "#8a7050", marginTop: 6 }}>{allyInfo.special}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 10, fontFamily: f.mono }}>
                <span style={{ color: "#d44040" }}>❤ {allyInfo.hp}</span>
                <span style={{ color: "#ff8b95" }}>⚔ {allyInfo.damage}</span>
                <span style={{ color: "#84b2ff" }}>↗ {allyInfo.range}</span>
                <span style={{ color: "#ffd56a" }}>💨 {allyInfo.speed}</span>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div style={{
          marginTop: 14, padding: 14,
          background: "linear-gradient(135deg, #221710, #1a0f08)",
          border: "1px solid #49de95", borderRadius: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 32 }}>{selected.icon}</span>
            <div>
              <div style={{ fontFamily: f.display, fontSize: 16, color: "#f5e2c1" }}>{selected.name}</div>
              <div style={{ fontSize: 11, color: "#49de95", marginTop: 2 }}>{selected.role} — {selected.special}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[
              { label: "Health", value: selected.hp, color: "#d44040", icon: "❤" },
              { label: "Damage", value: selected.damage, color: "#ff8b95", icon: "⚔" },
              { label: "Range", value: selected.range, color: "#84b2ff", icon: "↗" },
              { label: "Speed", value: selected.speed, color: "#ffd56a", icon: "💨" },
            ].map(stat => (
              <div key={stat.label} style={{
                padding: 8, textAlign: "center",
                background: "linear-gradient(135deg, #1e1510, #160e08)",
                border: "1px solid #3a2a1a", borderRadius: 8,
              }}>
                <div style={{ fontSize: 16, color: stat.color }}>{stat.icon}</div>
                <div style={{ fontSize: 16, fontFamily: f.mono, color: stat.color, fontWeight: 700 }}>{stat.value}</div>
                <div style={{ fontSize: 9, color: "#9b7d52", textTransform: "uppercase" }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: "#9b7d52" }}>
            Active: <span style={{ color: "#49de95", fontFamily: f.mono, fontWeight: 700 }}>{activeAllyCounts[selected.type] || 0}</span> deployed
          </div>
        </div>
      )}

      {allies.length > 0 && (
        <>
          <SectionTitle>Active Allies ({allies.length}) — click to inspect</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6, maxHeight: 200, overflowY: "auto" }}>
          {allies.map(ally => {
              const info = ALLY_INFO.find(a => a.type === ally.type);
              const hpPct = ally.maxHealth > 0 ? Math.min(100, (ally.health / ally.maxHealth) * 100) : 0;
              const fColors = ALLY_FACTION_COLORS[ally.faction ?? "crusade"] ?? ALLY_FACTION_COLORS.crusade;
              return (
                <div
                  key={ally.id}
                  onClick={() => useAllies.getState().selectAlly(ally.id)}
                  style={{
                    padding: 8, background: "linear-gradient(135deg, #1e1510, #160e08)",
                    border: `1px solid #3a2a1a`, borderLeft: `3px solid ${fColors.color}`,
                    borderRadius: 8, cursor: "pointer",
                    transition: "border-color .15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = fColors.color; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#3a2a1a"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 4, overflow: "hidden", flexShrink: 0, background: "#1a0f08" }}>
                      <img
                        src={getProfessionIcon(ally.profession, ally.faction === "fabled" ? "elf" : ally.faction === "legion" ? "orc" : "human")}
                        alt={ally.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "#f5e2c1", fontFamily: f.display, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {ally.name}
                      </div>
                      <div style={{ fontSize: 9, color: fColors.color }}>
                        {ally.profession} · Lv.{ally.level}
                      </div>
                    </div>
                    {ally.canHarvest && <span title="Sends to Storage" style={{ fontSize: 9, color: "#d4a400" }}>📦</span>}
                    {ally.isSleeping && <span title="Sleeping" style={{ fontSize: 10 }}>😴</span>}
                    {ally.personalCommand && <span title={`Personal: ${ally.personalCommand}`} style={{ fontSize: 10, color: "#49de95" }}>●</span>}
                  </div>
                  <div style={{ height: 4, background: "#1a0f08", borderRadius: 2, overflow: "hidden", marginTop: 4, border: "1px solid #3a2a1a" }}>
                    <div style={{ height: "100%", background: hpPct > 50 ? "linear-gradient(90deg, #4a7a30, #6ec96e)" : "linear-gradient(90deg, #8b2020, #d44040)", width: `${hpPct}%`, borderRadius: 2 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#9b7d52", fontFamily: f.mono, marginTop: 2 }}>
                    <span>{Math.round(ally.health)}/{ally.maxHealth}</span>
                    <span style={{ textTransform: "capitalize", color: fColors.color }}>{ally.behavior.replace(/_/g, " ")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function MainPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<PanelTab>("equipment");
  const { health, maxHealth, hunger, maxHunger, stamina, maxStamina } = useSurvival();
  const selectedCharacter = useGame(s => s.selectedCharacter);
  const gameLevel = useGame(s => s.level);
  const gameXp = useGame(s => s.xp);
  const gameXpToNext = useGame(s => s.xpToNext);
  const survivalCharId = useSurvival(s => s.activeCharacterId);
  const charId = selectedCharacter.characterId || survivalCharId;
  const { gold, mana, maxMana } = useEquipment();
  const equipped = useEquipment(s => s.equipped);
  const hero = useCharacterStats(s => charId ? s.heroes[charId] : null);
  const heroClass = useCharacterStats(s => charId ? s.getHeroClass(charId) : null);
  const displayLevel = hero?.level || gameLevel;
  const displayXP = hero?.experience ?? gameXp;
  const displayXPToNext = hero?.experienceToNext ?? gameXpToNext;
  const displayName = selectedCharacter.name || hero?.characterId || "Hero";
  const stats = useMemo(() => {
    const totals: Partial<Record<StatKey, number>> = {};
    for (const item of Object.values(equipped)) {
      if (!item) continue;
      for (const [key, val] of Object.entries(item.stats)) {
        const k = key as StatKey;
        totals[k] = (totals[k] || 0) + (val || 0);
      }
    }
    return totals;
  }, [equipped]);
  const secondaryStats = useMemo(() => {
    if (!charId) return null;
    return useCharacterStats.getState().getSecondaryStats(charId);
  }, [charId, hero?.level, hero?.attributes, hero?.skills]);
  const { items, selectedSlot, selectSlot, useItem, equipFromInventory } = useInventory();

  const triggerInventoryAction = (slotIndex: number) => {
    const it = items[slotIndex];
    if (!it) return;
    if (it.type === "food" || it.type === "consumable") {
      const result = useItem(it.id);
      if (result) {
        const surv = useSurvival.getState();
        if (result.hungerRestore) surv.eat(result.hungerRestore, result.healAmount || 0);
        else if (result.healAmount) surv.heal(result.healAmount);
        if (result.staminaRestore) surv.restoreStamina(result.staminaRestore);
      }
    } else if (INVENTORY_EQUIP_MAP[it.id]) {
      equipFromInventory(it.id);
    }
  };

  if (!isOpen) return null;

  const classLabel = heroClass ? CLASS_LABELS[heroClass] : null;

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 200,
      display: "flex", flexDirection: "column",
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      fontFamily: f.body, color: "#f5e2c1",
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px",
        background: "linear-gradient(90deg, #1a100a, #221710, #1a100a)",
        borderBottom: "2px solid #c9950a",
        boxShadow: "0 2px 12px rgba(0,0,0,.5)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontFamily: f.display, fontSize: 15, color: "#d4a400", letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
            ⚔ Grudge Warlords
          </h1>
          <span style={{ fontSize: 11, color: "#9b7d52" }}>Main Panel [C]</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <ResBar label="HP" current={health} max={maxHealth} gradient="linear-gradient(90deg, #8b2020, #d44040)" />
            <ResBar label="MP" current={mana} max={maxMana} gradient="linear-gradient(90deg, #1a3a6a, #3a7ad8)" />
            <ResBar label="SP" current={stamina} max={maxStamina} gradient="linear-gradient(90deg, #5a6a1a, #9ab830)" />
          </div>
          <span style={{ color: "#d4a400", fontFamily: f.display, fontWeight: 700 }}>
            {displayName}
          </span>
          {(() => {
            const def = charId ? HERO_DEFINITIONS.find(h => h.characterId === charId) : null;
            const raceInfo = def ? RACE_BONUSES[def.race] : null;
            return (
              <span style={{ color: "#9b7d52", fontSize: 11 }}>
                Lv.{displayLevel} {raceInfo ? `${raceInfo.icon} ` : ""}{classLabel?.label || ""}
              </span>
            );
          })()}
          <button onClick={onClose} style={{
            padding: "4px 12px", fontSize: 14, background: "rgba(212,80,80,.15)",
            border: "1px solid rgba(212,80,80,.4)", borderRadius: 6, color: "#d45050",
            cursor: "pointer", fontWeight: 700, lineHeight: 1,
          }}>✕</button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

        <aside style={{
          width: 260, flexShrink: 0,
          backgroundImage: "linear-gradient(180deg, rgba(20,14,8,0.78), rgba(20,14,8,0.92)), url(/ui/char_container.png)",
          backgroundSize: "auto, 100% 100%",
          backgroundRepeat: "no-repeat, no-repeat",
          borderRight: "2px solid #3a2a1a",
          display: "flex", flexDirection: "column", overflowY: "auto",
        }}>
          {(() => {
            const heroDef2  = charId ? HERO_DEFINITIONS.find(h => h.characterId === charId) : null;
            const portraitUrl = resolvePortrait(heroDef2?.race, heroClass);
            const fColor      = factionColor(selectedCharacter.faction);
            const classBadge  = CLASS_BADGE_COLORS[heroClass ?? "warrior"];
            return (
              <div style={{
                height: 220, position: "relative", overflow: "hidden",
                borderBottom: "1px solid #3a2a1a",
                background: `radial-gradient(circle at 50% 60%, ${fColor}12, transparent 70%), linear-gradient(180deg, #0f0a06, #1a120c)`,
              }}>
                {/* Portrait image */}
                <img
                  src={portraitUrl}
                  alt={displayName}
                  style={{
                    width: "100%", height: "100%",
                    objectFit: "cover", objectPosition: "top center",
                    display: "block",
                  }}
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    img.style.opacity = "0";
                  }}
                />
                {/* Faction color border accent */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                  boxShadow: `inset 0 0 0 2px ${fColor}55`,
                  borderRadius: 0, pointerEvents: "none",
                }} />
                {/* Bottom gradient + name overlay */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  padding: "16px 10px 6px",
                  background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
                }}>
                  <div style={{ fontSize: 13, fontFamily: f.display, color: "#f5e2c1", fontWeight: 700, lineHeight: 1.2 }}>
                    {displayName}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                    {heroClass && (
                      <span style={{
                        fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5,
                        padding: "1px 6px", borderRadius: 99,
                        border: `1px solid ${classBadge.border}`,
                        color: classBadge.color, background: classBadge.bg,
                      }}>{CLASS_LABELS[heroClass]?.label ?? heroClass}</span>
                    )}
                    <span style={{ fontSize: 10, color: "#d4a400", fontFamily: f.mono }}>Lv.{displayLevel}</span>
                    <span style={{ fontSize: 8, color: fColor, marginLeft: "auto" }}>
                      {selectedCharacter.faction?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{ padding: "10px 12px" }}>
            <h3 style={{
              fontFamily: f.display, fontSize: 11, color: "#d4a400",
              textTransform: "uppercase", letterSpacing: 1.5,
              borderBottom: "1px solid rgba(212,164,0,.25)", paddingBottom: 4, marginBottom: 6, margin: 0,
            }}>Combat Stats</h3>
            {secondaryStats && (
              <>
                {([
                  ["health", "Health", "#e05555"],
                  ["mana", "Mana", "#4488dd"],
                  ["stamina", "Stamina", "#88aa33"],
                  ["damage", "Damage", "#6ec96e"],
                  ["defense", "Defense", "#f5e2c1"],
                  ["armor", "Armor", "#c0a060"],
                  ["critChance", "Crit %", "#ffaa33"],
                  ["block", "Block", "#8899bb"],
                  ["evasion", "Evasion", "#55ccaa"],
                  ["attackSpeed", "Atk Spd", "#cc88ff"],
                  ["accuracy", "Accuracy", "#f5e2c1"],
                  ["resistance", "Resist", "#66aaff"],
                  ["combatPower", "Combat Power", "#d4a400"],
                ] as [keyof SecondaryStats, string, string][]).map(([key, label, color]) => {
                  const info = SECONDARY_STAT_LABELS[key];
                  const val = secondaryStats[key];
                  return (
                    <div key={key} style={{
                      display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11,
                      borderBottom: "1px solid rgba(255,255,255,.03)",
                    }}>
                      <span style={{ color: "#9b7d52", fontWeight: 600 }}>{label}</span>
                      <span style={{ color, fontFamily: f.mono, fontSize: 10 }}>
                        {formatStat(val, info?.format || "int")}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
            {!secondaryStats && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, borderBottom: "1px solid rgba(255,255,255,.03)" }}>
                  <span style={{ color: "#9b7d52", fontWeight: 600 }}>Health</span>
                  <span style={{ color: "#e05555", fontFamily: f.mono, fontSize: 10 }}>{Math.round(health)}/{maxHealth}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, borderBottom: "1px solid rgba(255,255,255,.03)" }}>
                  <span style={{ color: "#9b7d52", fontWeight: 600 }}>Mana</span>
                  <span style={{ color: "#4488dd", fontFamily: f.mono, fontSize: 10 }}>{Math.round(mana)}/{maxMana}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, borderBottom: "1px solid rgba(255,255,255,.03)" }}>
                  <span style={{ color: "#9b7d52", fontWeight: 600 }}>Damage</span>
                  <span style={{ color: "#6ec96e", fontFamily: f.mono, fontSize: 10 }}>{stats.damage || 0}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, borderBottom: "1px solid rgba(255,255,255,.03)" }}>
                  <span style={{ color: "#9b7d52", fontWeight: 600 }}>Defense</span>
                  <span style={{ color: "#f5e2c1", fontFamily: f.mono, fontSize: 10 }}>{stats.defense || 0}</span>
                </div>
              </>
            )}
          </div>

          {/* Professions mini-bar row */}
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #3a2a1a" }}>
            <div style={{ fontSize: 9, color: "#9b7d52", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Professions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {(Object.keys(PROFESSION_DEFS) as ProfessionId[]).map(profId => {
                const def  = PROFESSION_DEFS[profId];
                const prof = useProfessions.getState().professions[profId];
                const xpPct = prof.level >= 100 ? 100 : Math.min(100, (prof.xp / Math.max(1, prof.xpToNext)) * 100);
                return (
                  <div key={profId} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, width: 18, textAlign: "center" }}>{def.icon}</span>
                    <div style={{ flex: 1, height: 5, background: "#1a0f08", borderRadius: 3, overflow: "hidden", border: "1px solid #3a2a1a" }}>
                      <div style={{ height: "100%", width: `${xpPct}%`, background: def.color, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 9, fontFamily: f.mono, color: def.color, width: 22, textAlign: "right" }}>{prof.level}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ padding: "10px 12px" }}>
            <h3 style={{
              fontFamily: f.display, fontSize: 11, color: "#d4a400",
              textTransform: "uppercase", letterSpacing: 1.5,
              borderBottom: "1px solid rgba(212,164,0,.25)", paddingBottom: 4, marginBottom: 6, margin: 0,
            }}>Progression</h3>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, borderBottom: "1px solid rgba(255,255,255,.03)" }}>
              <span style={{ color: "#9b7d52", fontWeight: 600 }}>EXP</span>
              <span style={{ color: "#f5e2c1", fontFamily: f.mono, fontSize: 11 }}>
                {displayXP.toLocaleString()} / {displayXPToNext.toLocaleString()}
              </span>
            </div>
            {hero && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, borderBottom: "1px solid rgba(255,255,255,.03)" }}>
                  <span style={{ color: "#9b7d52", fontWeight: 600 }}>Skill Pts</span>
                  <span style={{ color: hero.skillPoints > 0 ? "#6ec96e" : "#f5e2c1", fontFamily: f.mono, fontSize: 11 }}>{hero.skillPoints}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, borderBottom: "1px solid rgba(255,255,255,.03)" }}>
                  <span style={{ color: "#9b7d52", fontWeight: 600 }}>Attr Pts</span>
                  <span style={{ color: (hero.attributePointsMax - hero.attributePointsSpent) > 0 ? "#6ec96e" : "#f5e2c1", fontFamily: f.mono, fontSize: 11 }}>
                    {hero.attributePointsMax - hero.attributePointsSpent}
                  </span>
                </div>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
              <span style={{ color: "#9b7d52", fontWeight: 600 }}>Gold</span>
              <span style={{ color: "#ffd56a", fontFamily: f.mono, fontSize: 11 }}>⚜ {gold.toLocaleString()}</span>
            </div>
          </div>
        </aside>

        <main style={{ flex: 1, display: "flex", flexDirection: "row", minWidth: 0 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: 16, minWidth: 0 }}>
            {activeTab === "equipment"   && <EquipmentTabContent />}
            {activeTab === "attributes"  && <AttributesTabContent charId={charId} />}
            {activeTab === "classSkill"  && <ClassSkillsTabContent charId={charId} />}
            {activeTab === "skillTree"   && <WeaponSkillsTabContent charId={charId} />}
            {activeTab === "upgrade"     && <UpgradesTabContent />}
            {activeTab === "craft"       && <CraftingTabContent />}
            {activeTab === "building"    && <BuildingTabContent />}
            {activeTab === "bestiary"    && <BestiaryTabContent />}
            {activeTab === "allies"      && <AlliesTabContent />}
            {activeTab === "professions" && <ProfessionsTabContent />}
            {activeTab === "storage"     && <StorageTabContent />}
          </div>
          <nav style={{
            display: "flex", flexDirection: "column", gap: 0,
            background: "linear-gradient(180deg, #14100a, #1e150e, #14100a)",
            borderLeft: "2px solid #c9950a", flexShrink: 0,
            overflowY: "auto",
          }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  border: "none", background: activeTab === tab.id ? "rgba(212,164,0,.08)" : "transparent",
                  color: activeTab === tab.id ? "#d4a400" : "#9b7d52",
                  cursor: "pointer", padding: "10px 14px",
                  fontFamily: f.display, fontSize: 10, textTransform: "uppercase",
                  letterSpacing: 1, fontWeight: 700,
                  borderRight: activeTab === tab.id ? "3px solid #d4a400" : "3px solid transparent",
                  textAlign: "right", whiteSpace: "nowrap", transition: ".15s",
                }}>{tab.label}</button>
            ))}
          </nav>
        </main>

        <aside style={{
          width: 280, flexShrink: 0,
          backgroundImage: "linear-gradient(180deg, rgba(20,14,8,0.78), rgba(20,14,8,0.92)), url(/ui/char_container.png)",
          backgroundSize: "auto, 100% 100%",
          backgroundRepeat: "no-repeat, no-repeat",
          borderLeft: "2px solid #3a2a1a",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            padding: "10px 12px", borderBottom: "1px solid #3a2a1a",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <h3 style={{ fontFamily: f.display, fontSize: 12, color: "#d4a400", textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>Inventory</h3>
            <span style={{ fontFamily: f.mono, fontSize: 12, color: "#ffd56a" }}>⚜ {gold.toLocaleString()}</span>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4,
            padding: 8, flex: 1, overflowY: "auto", alignContent: "start",
          }}>
            {Array.from({ length: 36 }).map((_, i) => {
              const item = items[i];
              const isSelected = selectedSlot === i;
              return (
                <div key={i}
                  onClick={() => item && selectSlot(i)}
                  onDoubleClick={() => item && triggerInventoryAction(i)}
                  onContextMenu={(e) => { if (item) { e.preventDefault(); triggerInventoryAction(i); } }}
                  title={item ? (
                    item.type === "food" || item.type === "consumable"
                      ? `${item.name} — double-click to use`
                      : INVENTORY_EQUIP_MAP[item.id]
                        ? `${item.name} — double-click to equip`
                        : item.name
                  ) : ""}
                  style={{
                    aspectRatio: "1",
                    border: isSelected ? "2px solid #d4a400" : "1px solid transparent",
                    borderRadius: 6,
                    backgroundImage: `url(/ui/item_slot.png)`,
                    backgroundSize: "100% 100%",
                    backgroundRepeat: "no-repeat",
                    backgroundColor: isSelected ? "rgba(212,164,0,.18)" : "transparent",
                    boxShadow: isSelected ? "0 0 8px rgba(212,164,0,.4)" : "none",
                    cursor: item ? "pointer" : "default", transition: ".15s",
                    position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  {item && (
                    <>
                      <span style={{ fontSize: 18 }}>{item.icon}</span>
                      {item.quantity > 1 && (
                        <span style={{ position: "absolute", bottom: 1, right: 3, fontSize: 9, fontFamily: f.mono, color: "#d4a400" }}>
                          {item.quantity}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {items[selectedSlot] && (() => {
            const sel = items[selectedSlot];
            const isConsumable = sel.type === "food" || sel.type === "consumable";
            const isEquippable = !!INVENTORY_EQUIP_MAP[sel.id];
            const equipDef = INVENTORY_EQUIP_MAP[sel.id];
            const actionLabel = isConsumable ? "Use" : isEquippable ? "Equip" : null;
            return (
              <div style={{
                padding: "8px 12px", borderTop: "1px solid #3a2a1a",
                background: "linear-gradient(135deg, #221710, #1a0f08)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ fontFamily: f.display, fontSize: 12, color: "#d4a400" }}>
                    {sel.icon} {sel.name}
                  </div>
                  {actionLabel && (
                    <button
                      onClick={() => triggerInventoryAction(selectedSlot)}
                      style={{
                        background: "linear-gradient(135deg, #b8860b, #d4a400)",
                        color: "#1a0f08", border: "1px solid #ffd56a", borderRadius: 4,
                        padding: "3px 10px", fontSize: 10, fontFamily: f.display,
                        textTransform: "uppercase", letterSpacing: 1, cursor: "pointer",
                        fontWeight: "bold",
                      }}
                    >{actionLabel}</button>
                  )}
                </div>
                <div style={{ fontSize: 10, color: "#9b7d52", marginTop: 2 }}>
                  Type: {sel.type}
                  {sel.damage ? ` | Dmg: ${sel.damage}` : ""}
                  {sel.healAmount ? ` | Heal: ${sel.healAmount}` : ""}
                  {sel.hungerRestore ? ` | Food: +${sel.hungerRestore}` : ""}
                  {sel.staminaRestore ? ` | Stam: +${sel.staminaRestore}` : ""}
                  {equipDef && Object.entries(equipDef.stats).map(([k, v]) => ` | +${v} ${k}`).join("")}
                </div>
              </div>
            );
          })()}

          <div style={{
            padding: "8px 12px", borderTop: "1px solid #3a2a1a",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{
              width: 40, height: 40, border: "2px dashed #d45050", borderRadius: 6,
              background: "rgba(200,40,40,.08)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: "#d45050",
            }}>🗑</div>
            <span style={{ fontSize: 11, color: "#9b7d52" }}>Drop items here to destroy</span>
          </div>
        </aside>
      </div>

    </div>
  );
}
