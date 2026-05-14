import {
  SwordIcon, ShieldIcon, BackpackIcon, SpellbookIcon, CompassIcon,
  HammerIcon, PickaxeIcon, DashIcon, FireIcon, HealIcon,
  MagicShieldIcon, MeteorIcon, GearIcon, BoltIcon, QuestionIcon,
} from "./GameIcons";

const FONTS = {
  header: "'Cinzel', serif",
  body: "'Crimson Text', serif",
  mono: "'JetBrains Mono', monospace",
};

const COLORS = {
  panelBg: "rgba(18, 12, 8, 0.96)",
  borderGold: "#c5a059",
  borderGoldDim: "rgba(197, 160, 89, 0.35)",
  textBody: "#e0d8c8",
  textMuted: "#8a7e6a",
  textHighlight: "#ffd700",
};

interface KeyGroup {
  title: string;
  keys: { action: string; key: string; color?: string }[];
}

const KEY_GROUPS: KeyGroup[] = [
  {
    title: "Movement",
    keys: [
      { action: "Move", key: "W A S D" },
      { action: "Sprint", key: "SHIFT" },
      { action: "Jump", key: "SPACE" },
      { action: "Dodge / Roll", key: "CTRL" },
    ],
  },
  {
    title: "Combat",
    keys: [
      { action: "Attack", key: "LMB", color: "#e74c3c" },
      { action: "Block", key: "RMB", color: "#64b5f6" },
      { action: "Class Ability", key: "R", color: "#bb95ff" },
      { action: "Tab Target", key: "TAB", color: "#ff9800" },
      { action: "Clear Target", key: "ESC" },
    ],
  },
  {
    title: "Skills",
    keys: [
      { action: "Fireball", key: "1", color: "#ff6b35" },
      { action: "Heal", key: "2", color: "#4caf50" },
      { action: "Shield", key: "3", color: "#64b5f6" },
      { action: "Dash", key: "4", color: "#81d4fa" },
      { action: "Ultimate", key: "5", color: "#ff9800" },
    ],
  },
  {
    title: "Interaction",
    keys: [
      { action: "Cycle Mode", key: "Q" },
      { action: "Build Mode", key: "B" },
      { action: "Interact", key: "T" },
      { action: "Use Item", key: "F" },
      { action: "Rotate (Build)", key: "R" },
    ],
  },
  {
    title: "Camera",
    keys: [
      { action: "Orbit Camera", key: "RMB + Drag", color: "#64b5f6" },
      { action: "Zoom In/Out", key: "Scroll Wheel", color: "#81d4fa" },
      { action: "Toggle MMO/Action", key: "V", color: "#ce93d8" },
    ],
  },
  {
    title: "Panels",
    keys: [
      { action: "Inventory", key: "I", color: "#d4a400" },
      { action: "Skills", key: "K", color: "#bb95ff" },
      { action: "Combat Panel", key: "C", color: "#e74c3c" },
      { action: "World Map", key: "M", color: "#64b5f6" },
      { action: "Combat Log", key: "L", color: "#81d4fa" },
      { action: "Settings", key: "ESC", color: "#b0bec5" },
    ],
  },
];

function KeyBadge({ children }: { children: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 4,
      background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)",
      fontSize: 10, fontWeight: "bold", fontFamily: FONTS.mono, color: "#fff",
      minWidth: 32, textAlign: "center",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.3)",
    }}>
      {children}
    </span>
  );
}

export default function HotkeysPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10001,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 480, maxHeight: "80vh", overflowY: "auto",
        background: COLORS.panelBg, border: `1.5px solid ${COLORS.borderGold}`,
        borderRadius: 12, padding: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(197,160,89,0.1)",
        animation: "slideUp 0.25s ease-out",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14,
        }}>
          <div style={{
            fontFamily: FONTS.header, fontSize: 16, color: COLORS.textHighlight,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <QuestionIcon size={20} color={COLORS.textHighlight} />
            Controls & Hotkeys
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 6,
            background: "rgba(180,50,50,0.15)", border: "1px solid rgba(180,50,50,0.4)",
            color: "#d45050", fontSize: 14, fontWeight: 700,
            cursor: "pointer", lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(180,50,50,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(180,50,50,0.15)"; }}
          >✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {KEY_GROUPS.map((group) => (
            <div key={group.title} style={{
              background: "rgba(0,0,0,0.25)", borderRadius: 8,
              border: `1px solid ${COLORS.borderGoldDim}`, padding: 10,
            }}>
              <div style={{
                fontFamily: FONTS.header, fontSize: 11, color: COLORS.borderGold,
                textTransform: "uppercase", letterSpacing: 1,
                borderBottom: `1px solid ${COLORS.borderGoldDim}`,
                paddingBottom: 4, marginBottom: 8,
              }}>{group.title}</div>
              {group.keys.map((k) => (
                <div key={k.action} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginBottom: 6,
                }}>
                  <span style={{
                    fontSize: 11, color: k.color || COLORS.textBody,
                  }}>{k.action}</span>
                  <KeyBadge>{k.key}</KeyBadge>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 14, textAlign: "center", fontSize: 10,
          color: COLORS.textMuted, fontStyle: "italic",
        }}>
          All keybinds shown are defaults
        </div>
      </div>
    </div>
  );
}
