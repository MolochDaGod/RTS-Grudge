import { useState, useCallback, useEffect, useRef } from "react";
import {
  WEAPON_TYPES,
  WEAPON_VARIANTS,
  WEAPON_MASTERY_TREES,
  MASTERY_TREE_ALIASES,
  getClassesForWeapon,
  type WeaponTypeId,
  type WeaponVariant,
  type MasterySkillNode,
  type WeaponCategory,
} from "@/lib/data/WeaponSkillData";

const UI = "/ui";
const GOLD = "#c9a44a";
const DIM = "#888";

const CLASS_COLORS: Record<string, string> = {
  Warrior: "#ef4444",
  Mage: "#8b5cf6",
  Ranger: "#22c55e",
  Worge: "#d97706",
};

const CATEGORIES: WeaponCategory[] = ["Melee", "Two-Handed", "Ranged", "Magic", "Off-Hand"];

function Tooltip({ skill, pos }: { skill: MasterySkillNode; pos: { x: number; y: number } }) {
  const x = pos.x + 270 > window.innerWidth ? pos.x - 280 : pos.x + 12;
  const y = pos.y + 200 > window.innerHeight ? window.innerHeight - 210 : pos.y + 12;
  return (
    <div style={{
      position: "fixed",
      left: x,
      top: y,
      zIndex: 10002,
      backgroundImage: `url(${UI}/dialog_container.png)`,
      backgroundSize: "100% 100%",
      padding: 14,
      width: 260,
      pointerEvents: "none",
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{skill.name}</div>
      <div style={{ fontSize: 9, color: GOLD, textTransform: "uppercase", marginBottom: 8 }}>Passive Mastery</div>
      <div style={{ fontSize: 11, color: DIM, marginBottom: 6, lineHeight: 1.3 }}>{skill.description}</div>
      <div style={{ fontSize: 11, color: GOLD, marginBottom: 4 }}>Effect: {skill.effect}</div>
      <div style={{ fontSize: 10, color: "#22c55e" }}>Bonus: {skill.bonus}</div>
    </div>
  );
}

export default function WeaponSkillPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponTypeId>("sword");
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [activeTab, setActiveTab] = useState<"mastery" | "skills">("mastery");
  const [hoveredSkill, setHoveredSkill] = useState<MasterySkillNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    setSelectedVariant(0);
  }, [selectedWeapon]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc, true);
    return () => window.removeEventListener("keydown", handleEsc, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const weaponType = WEAPON_TYPES.find(w => w.id === selectedWeapon)!;
  const variants = WEAPON_VARIANTS[selectedWeapon] || [];
  const variant = variants[selectedVariant];
  const classes = getClassesForWeapon(selectedWeapon);

  const masteryKey = WEAPON_MASTERY_TREES[selectedWeapon] ? selectedWeapon : (MASTERY_TREE_ALIASES[selectedWeapon] || null);
  const masteryTree = masteryKey ? WEAPON_MASTERY_TREES[masteryKey as WeaponTypeId] : null;
  const isAliased = masteryKey !== null && masteryKey !== selectedWeapon;

  return (
    <div
      ref={panelRef}
      onMouseMove={handleMouseMove}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 10001,
        display: "flex",
        fontFamily: "'Cinzel', 'Segoe UI', system-ui, sans-serif",
        color: "#e0e0e0",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
      }} onClick={onClose} />

      <div style={{
        position: "relative",
        display: "flex",
        width: "90vw",
        maxWidth: 1100,
        height: "85vh",
        margin: "auto",
        zIndex: 1,
      }}>
        {/* Sidebar */}
        <div style={{
          width: 190,
          backgroundImage: `url(${UI}/char_container.png)`,
          backgroundSize: "100% 100%",
          overflowY: "auto",
          flexShrink: 0,
          borderRadius: "8px 0 0 8px",
        }}>
          <div style={{
            width: "100%",
            height: 36,
            backgroundImage: `url(${UI}/spells_header_frame.png)`,
            backgroundSize: "100% 100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <span style={{
              color: GOLD,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 2,
              textShadow: "0 1px 3px #000",
            }}>Weapons</span>
          </div>
          {CATEGORIES.map(cat => {
            const weapons = WEAPON_TYPES.filter(w => w.category === cat);
            return (
              <div key={cat}>
                <div style={{
                  padding: "6px 14px",
                  fontSize: 9,
                  color: "#666",
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  marginTop: 6,
                  borderTop: "1px solid rgba(197,160,89,0.15)",
                }}>
                  {cat}
                </div>
                {weapons.map(w => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWeapon(w.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 14px",
                      border: "none",
                      background: selectedWeapon === w.id ? `rgba(201,164,74,0.2)` : "transparent",
                      borderLeft: selectedWeapon === w.id ? `3px solid ${GOLD}` : "3px solid transparent",
                      color: selectedWeapon === w.id ? GOLD : "#ccc",
                      cursor: "pointer",
                      fontSize: 12,
                      width: "100%",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{w.icon}</span>
                    {w.name}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Main Content */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          backgroundImage: `url(${UI}/spells_container.png)`,
          backgroundSize: "100% 100%",
          borderRadius: "0 8px 8px 0",
        }}>
          {/* Header bar with title */}
          <div style={{
            width: "100%",
            height: 40,
            backgroundImage: `url(${UI}/talents_header_frame.png)`,
            backgroundSize: "100% 100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            position: "relative",
          }}>
            <span style={{
              color: GOLD,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 2,
              textShadow: "0 2px 4px #000",
            }}>
              {weaponType.icon} {weaponType.name} Skills
            </span>
            <div
              onClick={onClose}
              style={{
                position: "absolute",
                right: 8,
                top: 4,
                width: 80,
                height: 28,
                backgroundImage: `url(${UI}/talents_close_background.png)`,
                backgroundSize: "100% 100%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ccc",
                fontSize: 10,
              }}
            >ESC</div>
          </div>

          {/* Variant selection */}
          <div style={{
            display: "flex",
            gap: 4,
            padding: "8px 16px",
            overflowX: "auto",
            flexShrink: 0,
            borderBottom: "1px solid rgba(197,160,89,0.15)",
          }}>
            {variants.map((v, i) => (
              <button
                key={i}
                onClick={() => setSelectedVariant(i)}
                style={{
                  padding: "6px 12px",
                  border: selectedVariant === i ? `1px solid ${GOLD}` : "1px solid rgba(197,160,89,0.2)",
                  background: selectedVariant === i ? `rgba(201,164,74,0.2)` : "rgba(0,0,0,0.3)",
                  color: selectedVariant === i ? GOLD : "#bbb",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 11,
                  whiteSpace: "nowrap",
                  minWidth: 90,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 11 }}>{v.name}</span>
                <span style={{ fontSize: 8, color: DIM }}>{v.sub}</span>
              </button>
            ))}
          </div>

          {/* Tab selector */}
          <div style={{
            display: "flex",
            flexShrink: 0,
            borderBottom: "1px solid rgba(197,160,89,0.15)",
          }}>
            {(["mastery", "skills"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: 10,
                  border: "none",
                  background: "transparent",
                  color: activeTab === tab ? GOLD : DIM,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  borderBottom: activeTab === tab ? `2px solid ${GOLD}` : "2px solid transparent",
                  fontFamily: "inherit",
                }}
              >
                {tab === "mastery" ? "Mastery Tree" : "Combat Skills"}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
          }}>
            {/* Weapon Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 14,
              paddingBottom: 10,
              borderBottom: "1px solid rgba(197,160,89,0.15)",
            }}>
              <div style={{
                width: 52,
                height: 52,
                backgroundImage: `url(${UI}/spells_icon___avatar_frame.png)`,
                backgroundSize: "cover",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <span style={{ fontSize: 28 }}>{weaponType.icon}</span>
              </div>
              <div>
                <h1 style={{ fontSize: 18, margin: 0, color: "#fff" }}>
                  {activeTab === "mastery" ? `${weaponType.name} Mastery` : (variant?.name || weaponType.name)}
                </h1>
                <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>
                  {activeTab === "mastery"
                    ? `Passive skill tree${isAliased ? ` (shared with ${masteryKey})` : ""}`
                    : `${variant?.sub || weaponType.name} \u2014 Combat Skills`}
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  {classes.map(c => (
                    <span key={c} style={{
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontSize: 9,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      background: `${CLASS_COLORS[c]}22`,
                      color: CLASS_COLORS[c],
                      border: `1px solid ${CLASS_COLORS[c]}40`,
                    }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {activeTab === "mastery" ? (
              masteryTree ? (
                <div>
                  {masteryTree.tiers.map((tier, ti) => (
                    <div key={ti}>
                      {ti > 0 && (
                        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
                          <div style={{ width: 2, height: 16, background: "rgba(197,160,89,0.3)", borderRadius: 1 }} />
                        </div>
                      )}
                      <div style={{ padding: "10px 0", textAlign: "center" }}>
                        <div style={{
                          fontSize: 10,
                          color: GOLD,
                          textTransform: "uppercase",
                          letterSpacing: 2,
                          marginBottom: 8,
                          textShadow: "0 1px 3px #000",
                        }}>
                          {tier.name}
                        </div>
                        <div style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: 10,
                          flexWrap: "wrap",
                        }}>
                          {tier.skills.map((skill, si) => (
                            <div
                              key={si}
                              onMouseEnter={() => setHoveredSkill(skill)}
                              onMouseLeave={() => setHoveredSkill(null)}
                              style={{
                                width: 125,
                                backgroundImage: `url(${UI}/dialog_container.png)`,
                                backgroundSize: "100% 100%",
                                padding: 10,
                                textAlign: "center",
                                cursor: "pointer",
                                transition: "0.15s",
                                position: "relative",
                              }}
                            >
                              <span style={{
                                position: "absolute",
                                top: 3,
                                right: 3,
                                fontSize: 7,
                                background: `rgba(201,164,74,0.3)`,
                                color: GOLD,
                                padding: "1px 4px",
                                borderRadius: 3,
                                textTransform: "uppercase",
                              }}>
                                Passive
                              </span>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{skill.name}</div>
                              <div style={{ fontSize: 9, color: GOLD, marginTop: 2 }}>{skill.effect}</div>
                              <div style={{
                                fontSize: 9,
                                padding: "2px 5px",
                                background: "rgba(34,197,94,0.15)",
                                borderRadius: 3,
                                color: "#22c55e",
                                marginTop: 4,
                                display: "inline-block",
                              }}>
                                {skill.bonus}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 20px", color: DIM }}>
                  <div style={{ fontSize: 40, opacity: 0.5 }}>{weaponType.icon}</div>
                  <h3 style={{ fontSize: 14, margin: "12px 0 6px", color: "#e0e0e0" }}>
                    Mastery Tree In Development
                  </h3>
                  <p style={{ fontSize: 11 }}>
                    The {weaponType.name} passive mastery tree is coming soon.
                  </p>
                </div>
              )
            ) : variant ? (
              <div style={{
                backgroundImage: `url(${UI}/dialog_container.png)`,
                backgroundSize: "100% 100%",
                padding: 16,
              }}>
                <div style={{ fontSize: 11, color: DIM, fontStyle: "italic", marginBottom: 10 }}>
                  "{variant.lore}"
                </div>
                <div style={{ fontSize: 11, color: "#e0e0e0", marginBottom: 6 }}>
                  Basic Attack: <span style={{ color: GOLD, fontWeight: 600 }}>{variant.basic}</span>
                </div>
                {variant.elem && (
                  <div style={{ fontSize: 11, color: "#e0e0e0", marginBottom: 10 }}>
                    Element: <span style={{ color: GOLD, fontWeight: 600 }}>{variant.elem}</span>
                  </div>
                )}

                <div style={{
                  fontSize: 10,
                  color: GOLD,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  margin: "10px 0 6px",
                  textShadow: "0 1px 2px #000",
                }}>
                  Abilities ({variant.abilities.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {variant.abilities.map((a, i) => (
                    <div key={i} style={{
                      width: 48,
                      height: 48,
                      backgroundImage: `url(${UI}/spell_slot_frame.png)`,
                      backgroundSize: "cover",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                    }}>
                      <span style={{
                        fontSize: 7,
                        color: "#fff",
                        textAlign: "center",
                        textShadow: "0 1px 2px #000",
                        lineHeight: 1.1,
                        padding: 2,
                        wordBreak: "break-word",
                      }}>{a}</span>
                    </div>
                  ))}
                </div>

                <div style={{
                  fontSize: 10,
                  color: GOLD,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  margin: "14px 0 6px",
                  textShadow: "0 1px 2px #000",
                }}>
                  Signature Ability
                </div>
                <div style={{
                  width: 56,
                  height: 56,
                  backgroundImage: `url(${UI}/spell_slot_frame.png)`,
                  backgroundSize: "cover",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  filter: "hue-rotate(-30deg) brightness(1.2)",
                }}>
                  <span style={{
                    fontSize: 7,
                    color: "#ff6b6b",
                    textAlign: "center",
                    textShadow: "0 1px 2px #000",
                    fontWeight: "bold",
                    lineHeight: 1.1,
                    padding: 2,
                    wordBreak: "break-word",
                  }}>{variant.sig}</span>
                </div>

                <div style={{
                  fontSize: 10,
                  color: GOLD,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  margin: "14px 0 6px",
                  textShadow: "0 1px 2px #000",
                }}>
                  Passives
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {variant.passives.map((p, i) => (
                    <span key={i} style={{
                      fontSize: 10,
                      padding: "4px 10px",
                      borderRadius: 4,
                      background: "rgba(34,197,94,0.12)",
                      border: "1px solid rgba(34,197,94,0.2)",
                      color: "#22c55e",
                    }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 20px", color: DIM }}>
                <h3>No variant data available</h3>
              </div>
            )}
          </div>
        </div>
      </div>

      {hoveredSkill && <Tooltip skill={hoveredSkill} pos={mousePos} />}
    </div>
  );
}
