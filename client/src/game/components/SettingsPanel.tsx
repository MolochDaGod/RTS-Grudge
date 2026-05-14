import type { ReactNode } from "react";
import { useSettings } from "@/lib/stores/useSettings";
import { GearIcon } from "./GameIcons";

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

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: COLORS.textBody }}>{label}</span>
        <span style={{ fontSize: 11, color: COLORS.textHighlight, fontFamily: FONTS.mono }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: "100%", height: 6, appearance: "none", background: "#222",
          borderRadius: 3, outline: "none", cursor: "pointer",
          accentColor: COLORS.borderGold,
        }}
      />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginBottom: 8, padding: "4px 0",
    }}>
      <span style={{ fontSize: 11, color: COLORS.textBody }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{
        width: 40, height: 22, borderRadius: 11, border: "none",
        background: value ? COLORS.borderGold : "#333", cursor: "pointer",
        position: "relative", transition: "background 0.2s",
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: "50%", background: "#fff",
          position: "absolute", top: 3,
          left: value ? 21 : 3, transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }} />
      </button>
    </div>
  );
}

function SelectOption({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginBottom: 8,
    }}>
      <span style={{ fontSize: 11, color: COLORS.textBody }}>{label}</span>
      <div style={{ display: "flex", gap: 4 }}>
        {options.map((opt) => (
          <button key={opt.value} onClick={() => onChange(opt.value)} style={{
            padding: "3px 10px", borderRadius: 4, fontSize: 10, fontWeight: "bold",
            border: `1px solid ${value === opt.value ? COLORS.borderGold : "#333"}`,
            background: value === opt.value ? "rgba(197,160,89,0.15)" : "rgba(0,0,0,0.3)",
            color: value === opt.value ? COLORS.textHighlight : COLORS.textMuted,
            cursor: "pointer", transition: "all 0.15s",
          }}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontFamily: FONTS.header, fontSize: 11, color: COLORS.borderGold,
      textTransform: "uppercase", letterSpacing: 1.5, marginTop: 14, marginBottom: 8,
      borderBottom: `1px solid ${COLORS.borderGoldDim}`, paddingBottom: 4,
      display: "flex", alignItems: "center", gap: 6,
    }}>
      <div style={{ width: 3, height: 12, background: COLORS.borderGold, borderRadius: 2, flexShrink: 0 }} />
      {children}
    </div>
  );
}

export default function SettingsPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { graphics, audio, gameplay, setGraphics, setAudio, setGameplay, resetDefaults } = useSettings();

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10001,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 420, maxHeight: "80vh", overflowY: "auto",
        background: COLORS.panelBg, border: `1.5px solid ${COLORS.borderGold}`,
        borderRadius: 12, padding: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(197,160,89,0.1)",
        animation: "slideUp 0.25s ease-out",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10,
        }}>
          <div style={{
            fontFamily: FONTS.header, fontSize: 16, color: COLORS.textHighlight,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <GearIcon size={20} color={COLORS.textHighlight} />
            Settings
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

        <SectionHeader>Graphics</SectionHeader>
        <SelectOption label="Quality" value={graphics.quality}
          options={[{ value: "low", label: "Low" }, { value: "medium", label: "Med" }, { value: "high", label: "High" }]}
          onChange={(v) => setGraphics({ quality: v as "low" | "medium" | "high" })}
        />
        <Toggle label="Shadows" value={graphics.shadows} onChange={(v) => setGraphics({ shadows: v })} />
        <Toggle label="Particles" value={graphics.particles} onChange={(v) => setGraphics({ particles: v })} />
        <Toggle label="Post Processing" value={graphics.postProcessing} onChange={(v) => setGraphics({ postProcessing: v })} />

        <SectionHeader>Audio</SectionHeader>
        <Slider label="Master Volume" value={audio.masterVolume} min={0} max={1} step={0.05}
          onChange={(v) => setAudio({ masterVolume: v })} />
        <Slider label="Music" value={audio.musicVolume} min={0} max={1} step={0.05}
          onChange={(v) => setAudio({ musicVolume: v })} />
        <Slider label="SFX" value={audio.sfxVolume} min={0} max={1} step={0.05}
          onChange={(v) => setAudio({ sfxVolume: v })} />
        <Slider label="Ambient" value={audio.ambientVolume} min={0} max={1} step={0.05}
          onChange={(v) => setAudio({ ambientVolume: v })} />

        <SectionHeader>Gameplay</SectionHeader>
        <Toggle label="Damage Numbers" value={gameplay.showDamageNumbers}
          onChange={(v) => setGameplay({ showDamageNumbers: v })} />
        <Toggle label="Health Bars" value={gameplay.showHealthBars}
          onChange={(v) => setGameplay({ showHealthBars: v })} />
        <Toggle label="Minimap" value={gameplay.showMinimap}
          onChange={(v) => setGameplay({ showMinimap: v })} />
        <Toggle label="FPS Counter" value={gameplay.showFPS}
          onChange={(v) => setGameplay({ showFPS: v })} />
        <Toggle label="Auto Attack" value={gameplay.autoAttack}
          onChange={(v) => setGameplay({ autoAttack: v })} />
        <Toggle label="Screen Shake" value={gameplay.screenShake}
          onChange={(v) => setGameplay({ screenShake: v })} />
        <Toggle label="Flash Effects" value={gameplay.flashEffects}
          onChange={(v) => setGameplay({ flashEffects: v })} />

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button onClick={resetDefaults} style={{
            padding: "6px 20px", borderRadius: 6, fontSize: 11,
            fontFamily: FONTS.header, textTransform: "uppercase", letterSpacing: 1,
            background: "rgba(180,50,50,0.2)", border: "1px solid rgba(180,50,50,0.4)",
            color: "#e07070", cursor: "pointer", transition: "all 0.15s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(180,50,50,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(180,50,50,0.2)"; }}
          >
            Reset Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
