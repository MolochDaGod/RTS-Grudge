import { useState } from "react";
import { useSettings } from "@/lib/stores/useSettings";

const UI = "/ui";
const GOLD = "#c5a059";

const f = {
  title: "'MorkDungeon', 'Cinzel', serif",
  display: "'Cinzel', serif",
  body: "'Crimson Text', serif",
  mono: "'JetBrains Mono', monospace",
};

type SettingsTab = "graphics" | "audio" | "controls" | "gameplay";

const TABS: { key: SettingsTab; label: string; icon: string }[] = [
  { key: "graphics", label: "Graphics", icon: "🖥" },
  { key: "audio", label: "Audio", icon: "🔊" },
  { key: "controls", label: "Controls", icon: "🎮" },
  { key: "gameplay", label: "Gameplay", icon: "⚙" },
];

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  formatValue,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (v: number) => string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: "#c9a86c", fontWeight: 600, fontFamily: f.body }}>{label}</span>
        <span style={{ color: "#f5e2c1", fontFamily: f.mono, fontSize: 11 }}>
          {formatValue ? formatValue(value) : Math.round(value * 100) + "%"}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: "100%",
          height: 6,
          appearance: "none",
          background: `linear-gradient(90deg, #c9950a ${((value - min) / (max - min)) * 100}%, #2a1f14 ${((value - min) / (max - min)) * 100}%)`,
          borderRadius: 3,
          outline: "none",
          cursor: "pointer",
        }}
      />
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid rgba(255,255,255,.04)",
      }}
    >
      <div>
        <div style={{ color: "#c9a86c", fontSize: 12, fontWeight: 600, fontFamily: f.body }}>{label}</div>
        {description && (
          <div style={{ color: "#6b5535", fontSize: 10, marginTop: 2 }}>{description}</div>
        )}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          border: "1px solid",
          borderColor: value ? "#c9950a" : "#3a2a1a",
          background: value
            ? "linear-gradient(90deg, #c9950a, #d4a400)"
            : "rgba(30,20,10,.6)",
          cursor: "pointer",
          position: "relative",
          transition: "all 0.2s",
          padding: 0,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: value ? "#fff" : "#666",
            position: "absolute",
            top: 2,
            left: value ? 20 : 2,
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,.4)",
          }}
        />
      </button>
    </div>
  );
}

function SelectOption({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
      <span style={{ color: "#c9a86c", fontSize: 12, fontWeight: 600, fontFamily: f.body }}>{label}</span>
      <div style={{ display: "flex", gap: 4 }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: "3px 10px",
              fontSize: 11,
              fontFamily: f.display,
              background: value === opt.value ? "linear-gradient(180deg, #c9950a, #9b7520)" : "rgba(30,20,10,.6)",
              border: `1px solid ${value === opt.value ? "#c9950a" : "#3a2a1a"}`,
              borderRadius: 4,
              color: value === opt.value ? "#1a100a" : "#9b7d52",
              cursor: "pointer",
              fontWeight: value === opt.value ? 700 : 400,
              transition: "all 0.15s",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const KEYBIND_GROUPS = [
  {
    title: "Movement",
    binds: [
      { label: "Forward", keys: "W / Up" },
      { label: "Backward", keys: "S / Down" },
      { label: "Strafe Left", keys: "A / Left" },
      { label: "Strafe Right", keys: "D / Right" },
      { label: "Sprint", keys: "Shift" },
      { label: "Jump", keys: "Space" },
      { label: "Dash", keys: "Q" },
      { label: "Roll/Dodge", keys: "Ctrl" },
    ],
  },
  {
    title: "Combat",
    binds: [
      { label: "Attack", keys: "LMB" },
      { label: "Block", keys: "RMB" },
      { label: "Skill 1", keys: "1" },
      { label: "Skill 2", keys: "2" },
      { label: "Skill 3", keys: "3" },
      { label: "Skill 4", keys: "4" },
      { label: "Skill 5", keys: "5" },
      { label: "Class Ability", keys: "R" },
      { label: "Tab Target", keys: "Tab" },
      { label: "Clear Target", keys: "Esc" },
    ],
  },
  {
    title: "Interface",
    binds: [
      { label: "Interact", keys: "T" },
      { label: "Use / Pick Up", keys: "F" },
      { label: "Inventory", keys: "B" },
      { label: "Main Panel", keys: "C" },
      { label: "Skills", keys: "K" },
      { label: "Pause Menu", keys: "Esc" },
    ],
  },
];

function GraphicsTab() {
  const { graphics, setGraphics } = useSettings();
  return (
    <div>
      <SelectOption
        label="Quality Preset"
        value={graphics.quality}
        options={[
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ]}
        onChange={(v) => setGraphics({ quality: v as "low" | "medium" | "high" })}
      />
      <Toggle label="Shadows" value={graphics.shadows} onChange={(v) => setGraphics({ shadows: v })} description="Dynamic shadow casting" />
      <Toggle label="Particles" value={graphics.particles} onChange={(v) => setGraphics({ particles: v })} description="Combat and environmental particles" />
      <Toggle label="Post Processing" value={graphics.postProcessing} onChange={(v) => setGraphics({ postProcessing: v })} description="Bloom, SSAO, color grading" />
      <Slider
        label="View Distance"
        value={graphics.viewDistance}
        onChange={(v) => setGraphics({ viewDistance: v })}
        min={100}
        max={500}
        step={25}
        formatValue={(v) => `${v}m`}
      />
    </div>
  );
}

function AudioTab() {
  const { audio, setAudio } = useSettings();
  return (
    <div>
      <Toggle label="Mute All" value={audio.muted} onChange={(v) => setAudio({ muted: v })} />
      <div style={{ opacity: audio.muted ? 0.4 : 1, pointerEvents: audio.muted ? "none" : "auto" }}>
        <Slider label="Master Volume" value={audio.masterVolume} onChange={(v) => setAudio({ masterVolume: v })} />
        <Slider label="Music" value={audio.musicVolume} onChange={(v) => setAudio({ musicVolume: v })} />
        <Slider label="Sound Effects" value={audio.sfxVolume} onChange={(v) => setAudio({ sfxVolume: v })} />
        <Slider label="Ambient" value={audio.ambientVolume} onChange={(v) => setAudio({ ambientVolume: v })} />
      </div>
    </div>
  );
}

function ControlsTab() {
  const [gamepadDetected] = useState(() => {
    try {
      return navigator.getGamepads?.().some(gp => gp !== null) || false;
    } catch { return false; }
  });

  return (
    <div>
      <div style={{
        padding: "8px 12px",
        marginBottom: 12,
        background: "rgba(201,149,10,.08)",
        border: "1px solid rgba(201,149,10,.2)",
        borderRadius: 6,
        fontSize: 11,
        color: "#c9a86c",
        fontFamily: f.body,
      }}>
        Keyboard + Mouse controls. Keybind remapping coming soon.
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 0",
        borderBottom: "1px solid rgba(255,255,255,.04)",
        marginBottom: 12,
      }}>
        <span style={{ color: "#9b7d52", fontSize: 11 }}>Gamepad:</span>
        <span style={{
          fontSize: 11,
          fontFamily: f.mono,
          color: gamepadDetected ? "#6ec96e" : "#666",
        }}>
          {gamepadDetected ? "Connected" : "Not detected"}
        </span>
      </div>

      {KEYBIND_GROUPS.map((group) => (
        <div key={group.title} style={{ marginBottom: 16 }}>
          <h4 style={{
            fontFamily: f.display,
            fontSize: 11,
            color: "#d4a400",
            textTransform: "uppercase",
            letterSpacing: 1.5,
            borderBottom: "1px solid rgba(212,164,0,.25)",
            paddingBottom: 4,
            marginBottom: 6,
            margin: "0 0 6px 0",
          }}>
            {group.title}
          </h4>
          {group.binds.map((bind) => (
            <div
              key={bind.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "4px 0",
                borderBottom: "1px solid rgba(255,255,255,.02)",
              }}
            >
              <span style={{ color: "#c9a86c", fontSize: 12, fontFamily: f.body }}>{bind.label}</span>
              <div style={{ display: "flex", gap: 4 }}>
                {bind.keys.split(" / ").map((key) => (
                  <span
                    key={key}
                    style={{
                      padding: "2px 8px",
                      background: "rgba(30,20,10,.8)",
                      border: "1px solid #3a2a1a",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: f.mono,
                      color: "#f5e2c1",
                      minWidth: 28,
                      textAlign: "center",
                    }}
                  >
                    {key}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function GameplayTab() {
  const { gameplay, setGameplay } = useSettings();
  return (
    <div>
      <Toggle label="Damage Numbers" value={gameplay.showDamageNumbers} onChange={(v) => setGameplay({ showDamageNumbers: v })} description="Floating combat numbers" />
      <Toggle label="Health Bars" value={gameplay.showHealthBars} onChange={(v) => setGameplay({ showHealthBars: v })} description="HP bars above enemies" />
      <Toggle label="Minimap" value={gameplay.showMinimap} onChange={(v) => setGameplay({ showMinimap: v })} />
      <Toggle label="FPS Counter" value={gameplay.showFPS} onChange={(v) => setGameplay({ showFPS: v })} />
      <Toggle label="Screen Shake" value={gameplay.screenShake} onChange={(v) => setGameplay({ screenShake: v })} description="Camera shake on crits/hits" />
      <Toggle label="Flash Effects" value={gameplay.flashEffects} onChange={(v) => setGameplay({ flashEffects: v })} description="Damage vignette and other full-screen flashes" />
      <Toggle label="Auto-Attack" value={gameplay.autoAttack} onChange={(v) => setGameplay({ autoAttack: v })} description="Automatically attack when in range" />
      <Slider
        label="Max Camera Distance"
        value={gameplay.cameraDistance}
        onChange={(v) => setGameplay({ cameraDistance: v })}
        min={8}
        max={35}
        step={1}
        formatValue={(v) => `${v}m`}
      />
      <Slider
        label="Camera Sensitivity"
        value={gameplay.cameraSensitivity}
        onChange={(v) => setGameplay({ cameraSensitivity: v })}
        min={0.2}
        max={3}
        step={0.1}
        formatValue={(v) => `${v.toFixed(1)}x`}
      />
    </div>
  );
}

const TAB_COMPONENTS: Record<SettingsTab, () => JSX.Element> = {
  graphics: GraphicsTab,
  audio: AudioTab,
  controls: ControlsTab,
  gameplay: GameplayTab,
};

export default function SettingsPanel({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("graphics");
  const { resetDefaults } = useSettings();
  const TabContent = TAB_COMPONENTS[activeTab];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10003,
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          width: 520,
          maxHeight: "80vh",
          background: "linear-gradient(180deg, #1a120c, #0f0a06)",
          border: "2px solid #c9950a",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 32px rgba(0,0,0,.6), inset 0 1px 0 rgba(201,149,10,.15)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "linear-gradient(90deg, #1a100a, #221710, #1a100a)",
            borderBottom: "2px solid #c9950a",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: f.title,
              fontSize: 24,
              color: GOLD,
              letterSpacing: 3,
              textShadow: "0 0 15px rgba(201,149,10,0.3), 0 2px 4px #000",
            }}
          >
            SETTINGS
          </h2>
          <button
            onClick={onBack}
            style={{
              padding: "4px 12px",
              fontSize: 14,
              background: "rgba(212,80,80,.15)",
              border: "1px solid rgba(212,80,80,.4)",
              borderRadius: 6,
              color: "#d45050",
              cursor: "pointer",
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            Back
          </button>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid #3a2a1a" }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: "10px 0",
                background: activeTab === tab.key ? "rgba(201,149,10,.12)" : "transparent",
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid #c9950a" : "2px solid transparent",
                color: activeTab === tab.key ? "#d4a400" : "#6b5535",
                fontSize: 12,
                fontFamily: f.display,
                cursor: "pointer",
                transition: "all 0.15s",
                letterSpacing: 1,
              }}
            >
              <span style={{ marginRight: 4 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 16,
            minHeight: 0,
          }}
        >
          <TabContent />
        </div>

        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid #3a2a1a",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            onClick={resetDefaults}
            style={{
              padding: "6px 20px",
              fontSize: 11,
              fontFamily: f.display,
              background: "rgba(30,20,10,.6)",
              border: "1px solid #3a2a1a",
              borderRadius: 4,
              color: "#9b7d52",
              cursor: "pointer",
              letterSpacing: 1,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#c9950a";
              e.currentTarget.style.color = "#d4a400";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#3a2a1a";
              e.currentTarget.style.color = "#9b7d52";
            }}
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
