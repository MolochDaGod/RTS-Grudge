import { useState } from "react";

const T = {
  bg: "#0a0705",
  bgCard: "#0f0a06",
  bgSection: "#130e08",
  bgInput: "#0a0705",
  border: "rgba(201,149,10,0.15)",
  borderActive: "rgba(201,149,10,0.35)",
  gold: "#c9950a",
  goldLight: "#f0d68a",
  text: "#c9a86c",
  textBright: "#f0e6d0",
  textMuted: "#7a6a50",
};

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export function NumberField({ label, value, onChange, min, max, step = 1, suffix }: NumberFieldProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
      <label style={{ color: T.text, fontSize: 12, fontFamily: "'Crimson Text', serif" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          style={{
            width: 80, background: T.bgInput,
            border: `1px solid ${T.border}`, borderRadius: 4,
            color: T.textBright, padding: "5px 8px", fontSize: 12,
            textAlign: "right", outline: "none",
            fontFamily: "'JetBrains Mono', monospace",
            transition: "border-color 0.2s ease",
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = T.gold}
          onBlur={(e) => e.currentTarget.style.borderColor = T.border}
        />
        {suffix && <span style={{ color: T.textMuted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>{suffix}</span>}
      </div>
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function TextField({ label, value, onChange, placeholder }: TextFieldProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
      <label style={{ color: T.text, fontSize: 12, fontFamily: "'Crimson Text', serif" }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: 140, background: T.bgInput,
          border: `1px solid ${T.border}`, borderRadius: 4,
          color: T.textBright, padding: "5px 8px", fontSize: 12,
          outline: "none", fontFamily: "'Crimson Text', serif",
          transition: "border-color 0.2s ease",
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = T.gold}
        onBlur={(e) => e.currentTarget.style.borderColor = T.border}
      />
    </div>
  );
}

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
      <label style={{ color: T.text, fontSize: 12, fontFamily: "'Crimson Text', serif" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 4,
          border: `1px solid ${T.border}`,
          overflow: "hidden",
          position: "relative",
        }}>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: 32, height: 32, border: "none",
              background: "none", cursor: "pointer",
              position: "absolute", top: -4, left: -4,
            }}
          />
        </div>
        <span style={{ color: T.textMuted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
      </div>
    </div>
  );
}

interface BoolFieldProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export function BoolField({ label, value, onChange }: BoolFieldProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
      <label style={{ color: T.text, fontSize: 12, fontFamily: "'Crimson Text', serif" }}>{label}</label>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 36, height: 20, borderRadius: 10,
          background: value ? `linear-gradient(135deg, ${T.gold}, ${T.goldLight})` : T.bgInput,
          border: `1px solid ${value ? T.gold : T.border}`,
          cursor: "pointer",
          position: "relative",
          transition: "all 0.2s ease",
          boxShadow: value ? `0 0 8px ${T.gold}33` : "none",
        }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: "50%",
          background: value ? T.bg : T.textMuted,
          position: "absolute", top: 2,
          left: value ? 19 : 2,
          transition: "left 0.2s ease",
        }} />
      </div>
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

export function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
      <label style={{ color: T.text, fontSize: 12, fontFamily: "'Crimson Text', serif" }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 140, background: T.bgInput,
          border: `1px solid ${T.border}`, borderRadius: 4,
          color: T.textBright, padding: "5px 8px", fontSize: 12,
          outline: "none", fontFamily: "'Crimson Text', serif",
          cursor: "pointer",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function Section({ title, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      marginBottom: 10,
      overflow: "hidden",
      background: T.bgCard,
      transition: "border-color 0.2s ease",
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: "10px 14px",
          background: T.bgSection,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: open ? `1px solid ${T.border}` : "1px solid transparent",
          transition: "all 0.2s ease",
        }}
      >
        <span style={{
          color: T.goldLight, fontSize: 12, fontWeight: 700,
          fontFamily: "'Cinzel', serif", letterSpacing: 2,
          textTransform: "uppercase",
        }}>{title}</span>
        <span style={{
          color: T.gold, fontSize: 10,
          transition: "transform 0.2s ease",
          transform: open ? "rotate(0deg)" : "rotate(-90deg)",
          display: "inline-block",
        }}>▼</span>
      </div>
      {open && <div style={{ padding: "10px 14px" }}>{children}</div>}
    </div>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}

export function SliderField({ label, value, onChange, min, max, step = 0.1, suffix }: SliderFieldProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ padding: "5px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <label style={{ color: T.text, fontSize: 12, fontFamily: "'Crimson Text', serif" }}>{label}</label>
        <span style={{
          color: T.gold, fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
        }}>{value.toFixed(2)}{suffix || ""}</span>
      </div>
      <div style={{ position: "relative" }}>
        <div style={{
          position: "absolute", top: "50%", left: 0, right: 0,
          height: 4, borderRadius: 2,
          background: T.bgInput,
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}>
          <div style={{
            width: `${pct}%`, height: "100%", borderRadius: 2,
            background: `linear-gradient(90deg, ${T.goldLight}, ${T.gold})`,
            boxShadow: `0 0 6px ${T.gold}44`,
          }} />
        </div>
        <input
          type="range"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          min={min}
          max={max}
          step={step}
          style={{
            width: "100%",
            accentColor: T.gold,
            position: "relative",
            opacity: 0,
            cursor: "pointer",
            height: 20,
          }}
        />
      </div>
    </div>
  );
}
