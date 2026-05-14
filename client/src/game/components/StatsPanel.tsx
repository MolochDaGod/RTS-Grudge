import { useState, useMemo, useCallback } from "react";
import {
  useCharacterStats,
  ATTRIBUTE_EFFECTS,
  SECONDARY_STAT_LABELS,
  CLASS_LABELS,
  HERO_DEFINITIONS,
  type PrimaryAttributes,
  type SecondaryStats,
  type SkillNode,
  type HeroClass,
} from "@/lib/stores/useCharacterStats";
import { useSurvival } from "@/lib/stores/useSurvival";

type Tab = "attributes" | "stats" | "skills";

function formatStat(value: number, format: string): string {
  switch (format) {
    case "int": return Math.round(value).toString();
    case "1dp": return value.toFixed(1);
    case "2dp": return value.toFixed(2);
    case "3dp": return value.toFixed(3);
    case "pct": return value.toFixed(1) + "%";
    default: return value.toString();
  }
}

const ATTR_COLORS: Record<keyof PrimaryAttributes, string> = {
  strength: "#cc3333",
  vitality: "#cc9933",
  endurance: "#997733",
  intellect: "#3399ff",
  wisdom: "#cc33cc",
  dexterity: "#33cc33",
  agility: "#33cccc",
  tactics: "#ff6633",
};

function AttributesTab({ characterId }: { characterId: string }) {
  const hero = useCharacterStats(s => s.heroes[characterId]);
  const allocateAttribute = useCharacterStats(s => s.allocateAttribute);
  const resetAttributes = useCharacterStats(s => s.resetAttributes);
  const randomizeAttributes = useCharacterStats(s => s.randomizeAttributes);
  const [hoveredAttr, setHoveredAttr] = useState<keyof PrimaryAttributes | null>(null);

  if (!hero) return null;

  const remaining = hero.attributePointsMax - hero.attributePointsSpent;
  const attrKeys = Object.keys(ATTRIBUTE_EFFECTS) as (keyof PrimaryAttributes)[];

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "#aaa" }}>
          Points: <span style={{ color: remaining > 0 ? "#ffcc00" : "#666" }}>{remaining}</span> / {hero.attributePointsMax}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => randomizeAttributes(characterId)} style={smallBtnStyle} title="Randomize">🎲</button>
          <button onClick={() => resetAttributes(characterId)} style={smallBtnStyle} title="Reset">↺</button>
        </div>
      </div>

      {attrKeys.map(attr => {
        const info = ATTRIBUTE_EFFECTS[attr];
        const val = hero.attributes[attr];
        const base = hero.baseAttributes[attr];
        const added = val - base;

        return (
          <div key={attr}
            onMouseEnter={() => setHoveredAttr(attr)}
            onMouseLeave={() => setHoveredAttr(null)}
            style={{ marginBottom: 6, padding: "4px 6px", background: hoveredAttr === attr ? "rgba(255,255,255,0.05)" : "transparent", borderRadius: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: ATTR_COLORS[attr], fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                <img src={info.iconUrl} alt={info.label} style={{ width: 16, height: 16, objectFit: "contain" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                {info.label}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13, color: "#fff", fontWeight: 700, minWidth: 24, textAlign: "right" }}>
                  {val}
                </span>
                {added > 0 && <span style={{ fontSize: 9, color: "#4caf50" }}>+{added}</span>}
                <button
                  disabled={remaining <= 0}
                  onClick={() => allocateAttribute(characterId, attr, 1)}
                  style={{ ...tinyBtnStyle, opacity: remaining > 0 ? 1 : 0.3 }}>+</button>
                <button
                  disabled={remaining <= 0}
                  onClick={() => allocateAttribute(characterId, attr, 5)}
                  style={{ ...tinyBtnStyle, opacity: remaining > 0 ? 1 : 0.3, fontSize: 8 }}>+5</button>
              </div>
            </div>
            {hoveredAttr === attr && (
              <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>
                {info.description}
                <div style={{ marginTop: 2 }}>
                  {info.effects.map((e, i) => (
                    <div key={i} style={{ color: "#6a6" }}>• {e}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DerivedStatsTab({ characterId }: { characterId: string }) {
  const getSecondaryStats = useCharacterStats(s => s.getSecondaryStats);
  const hero = useCharacterStats(s => s.heroes[characterId]);
  const stats = useMemo(() => getSecondaryStats(characterId), [characterId, hero?.attributes, hero?.skills, hero?.level]);

  if (!stats) return <div style={{ padding: 8, color: "#888" }}>No data</div>;

  const groups: { title: string; keys: (keyof SecondaryStats)[] }[] = [
    { title: "Offense", keys: ["damage", "attackSpeed", "critChance", "critDamage", "accuracy", "armorPenetration", "defenseBreak", "stagger"] },
    { title: "Defense", keys: ["health", "defense", "armor", "resistance", "block", "blockEffect", "evasion", "dodge", "damageReduction", "critEvasion"] },
    { title: "Resources", keys: ["mana", "stamina", "healthRegen", "manaRegen", "cooldownReduction", "abilityCost"] },
    { title: "Utility", keys: ["movementSpeed", "drainHealth", "ccResistance", "cdrResist", "defenseBreakResist", "bleedResist", "spellblock", "spellAccuracy", "statusEffect", "reflexTime", "fallDamage", "comboCooldownRed", "blockPenetration", "combatPower"] },
  ];

  return (
    <div style={{ padding: 8 }}>
      {groups.map(group => (
        <div key={group.title} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, borderBottom: "1px solid #333", paddingBottom: 2 }}>
            {group.title}
          </div>
          {group.keys.map(key => {
            const info = SECONDARY_STAT_LABELS[key];
            return (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "1px 4px", fontSize: 11 }}>
                <span style={{ color: "#bbb" }}>{info.label}</span>
                <span style={{ color: key === "combatPower" ? "#ffcc00" : "#fff", fontWeight: key === "combatPower" ? 700 : 400 }}>
                  {formatStat(stats[key], info.format)}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function SkillTreeTab({ characterId }: { characterId: string }) {
  const getSkillTree = useCharacterStats(s => s.getSkillTree);
  const learnSkill = useCharacterStats(s => s.learnSkill);
  const resetSkills = useCharacterStats(s => s.resetSkills);
  const hero = useCharacterStats(s => s.heroes[characterId]);
  const tree = useMemo(() => getSkillTree(characterId), [characterId, hero?.skills]);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  if (!hero || !tree.length) return null;

  const classNodes = tree.filter(n => n.category === "class");
  const weaponNodes = tree.filter(n => n.category === "weapon");
  const classInfo = CLASS_LABELS[hero.heroClass];

  const canLearn = (node: SkillNode): boolean => {
    if (hero.skillPoints <= 0) return false;
    if (node.currentRank >= node.maxRank) return false;
    for (const req of node.requires) {
      const reqNode = tree.find(n => n.id === req);
      if (!reqNode || reqNode.currentRank < 1) return false;
    }
    return true;
  };

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "#aaa" }}>
          Skill Points: <span style={{ color: hero.skillPoints > 0 ? "#ffcc00" : "#666" }}>{hero.skillPoints}</span>
        </span>
        <button onClick={() => resetSkills(characterId)} style={smallBtnStyle} title="Reset Skills">↺</button>
      </div>

      <div style={{ fontSize: 11, color: classInfo.color, fontWeight: 600, marginBottom: 6 }}>
        {classInfo.icon} {classInfo.label} Skills
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
        {classNodes.map(node => {
          const learnable = canLearn(node);
          const active = node.currentRank > 0;
          return (
            <div key={node.id}
              onMouseEnter={() => setHoveredSkill(node.id)}
              onMouseLeave={() => setHoveredSkill(null)}
              onClick={() => learnable && learnSkill(characterId, node.id)}
              style={{
                padding: "3px 5px", borderRadius: 4, cursor: learnable ? "pointer" : "default",
                background: active ? "rgba(76,175,80,0.15)" : hoveredSkill === node.id ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.2)",
                border: `1px solid ${active ? "#4caf50" : learnable ? "#666" : "#333"}`,
                opacity: active || learnable ? 1 : 0.5,
              }}>
              <div style={{ fontSize: 10, display: "flex", justifyContent: "space-between" }}>
                <span>{node.icon} {node.name}</span>
                <span style={{ color: active ? "#4caf50" : "#666" }}>{node.currentRank}/{node.maxRank}</span>
              </div>
              {hoveredSkill === node.id && (
                <div style={{ fontSize: 8, color: "#aaa", marginTop: 2 }}>{node.description}</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: "#998", fontWeight: 600, marginTop: 10, marginBottom: 4 }}>
        Weapon Mastery
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
        {weaponNodes.map(node => {
          const learnable = canLearn(node);
          const active = node.currentRank > 0;
          return (
            <div key={node.id}
              onMouseEnter={() => setHoveredSkill(node.id)}
              onMouseLeave={() => setHoveredSkill(null)}
              onClick={() => learnable && learnSkill(characterId, node.id)}
              style={{
                padding: "3px 5px", borderRadius: 4, cursor: learnable ? "pointer" : "default",
                background: active ? "rgba(76,175,80,0.15)" : "rgba(0,0,0,0.2)",
                border: `1px solid ${active ? "#4caf50" : learnable ? "#666" : "#333"}`,
                opacity: active || learnable ? 1 : 0.5,
              }}>
              <div style={{ fontSize: 10, display: "flex", justifyContent: "space-between" }}>
                <span>{node.icon} {node.name}</span>
                <span style={{ color: active ? "#4caf50" : "#666" }}>{node.currentRank}/{node.maxRank}</span>
              </div>
              {hoveredSkill === node.id && (
                <div style={{ fontSize: 8, color: "#aaa", marginTop: 2 }}>{node.description}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StatsPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("attributes");
  const activeCharacterId = useSurvival(s => s.activeCharacterId);
  const hero = useCharacterStats(s => activeCharacterId ? s.heroes[activeCharacterId] : null);

  if (!activeCharacterId || !hero) return null;

  const def = HERO_DEFINITIONS.find(h => h.characterId === activeCharacterId);
  const classInfo = CLASS_LABELS[hero.heroClass];

  if (!open) {
    return (
      <div style={{
        position: "fixed", right: 12, top: 12,
        zIndex: 200, pointerEvents: "auto",
      }}>
        <button onClick={() => setOpen(true)} style={{
          background: "rgba(0,0,0,0.7)", border: "1px solid #555", borderRadius: 6,
          color: "#fff", padding: "6px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600,
        }}>
          {classInfo.icon} Lv.{hero.level} | CP: {useCharacterStats.getState().getSecondaryStats(activeCharacterId)?.combatPower || 0}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", right: 12, top: 12, width: 320,
      maxHeight: "calc(100vh - 24px)", overflowY: "auto",
      background: "rgba(10, 10, 15, 0.92)", border: "1px solid #444",
      borderRadius: 8, zIndex: 200, pointerEvents: "auto",
      boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
    }}>
      <div style={{ padding: "8px 10px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{def?.name || activeCharacterId}</span>
          <span style={{ fontSize: 10, color: classInfo.color, marginLeft: 6 }}>{classInfo.icon} {classInfo.label}</span>
          <div style={{ fontSize: 10, color: "#888" }}>
            Level {hero.level} | XP: {hero.experience}/{hero.experienceToNext}
          </div>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 16 }}>✕</button>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #333" }}>
        {(["attributes", "stats", "skills"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "6px 0", background: tab === t ? "rgba(255,255,255,0.08)" : "transparent",
            border: "none", borderBottom: tab === t ? "2px solid #4caf50" : "2px solid transparent",
            color: tab === t ? "#fff" : "#888", fontSize: 11, cursor: "pointer", textTransform: "capitalize",
          }}>
            {t}
          </button>
        ))}
      </div>

      {tab === "attributes" && <AttributesTab characterId={activeCharacterId} />}
      {tab === "stats" && <DerivedStatsTab characterId={activeCharacterId} />}
      {tab === "skills" && <SkillTreeTab characterId={activeCharacterId} />}
    </div>
  );
}

const smallBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.1)", border: "1px solid #555", borderRadius: 4,
  color: "#ccc", padding: "2px 6px", cursor: "pointer", fontSize: 11,
};

const tinyBtnStyle: React.CSSProperties = {
  background: "rgba(76,175,80,0.2)", border: "1px solid #4caf50", borderRadius: 3,
  color: "#4caf50", padding: "0 4px", cursor: "pointer", fontSize: 11, fontWeight: 700, lineHeight: "18px",
};
