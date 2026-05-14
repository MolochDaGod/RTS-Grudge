import React from "react";

interface IconProps {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

export function SwordIcon({ size = 24, color = "#e0d8c8", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M19.07 4.93l-1.41 1.41L14.83 3.5 3.5 14.83l2.83 2.83L3.5 20.5l.71.71 2.83-2.83 2.83 2.83L21.21 9.88l-2.83-2.83 1.41-1.41-.71-.71z" fill={color} />
      <path d="M7.04 18.67l-1.41-1.41 8.49-8.49 1.41 1.41-8.49 8.49z" fill="rgba(0,0,0,0.3)" />
    </svg>
  );
}

export function ShieldIcon({ size = 24, color = "#e0d8c8", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 2L4 6v5c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" fill={color} />
      <path d="M12 2L4 6v5c0 5.55 3.84 10.74 8 12V2z" fill="rgba(255,255,255,0.15)" />
    </svg>
  );
}

export function BackpackIcon({ size = 24, color = "#e0d8c8", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <rect x="5" y="9" width="14" height="12" rx="2" fill={color} />
      <path d="M8 9V6a4 4 0 018 0v3" stroke={color} strokeWidth="2" fill="none" />
      <rect x="9" y="12" width="6" height="3" rx="1" fill="rgba(0,0,0,0.3)" />
      <line x1="12" y1="15" x2="12" y2="17" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export function SpellbookIcon({ size = 24, color = "#e0d8c8", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M4 4h4l4 2 4-2h4v16h-4l-4 2-4-2H4V4z" fill={color} />
      <path d="M12 6v16" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
      <path d="M4 4h4l4 2v16l-4-2H4V4z" fill="rgba(255,255,255,0.1)" />
      <circle cx="8" cy="10" r="1.5" fill="rgba(0,0,0,0.3)" />
      <path d="M7 13h2M7 15h2" stroke="rgba(0,0,0,0.2)" strokeWidth="0.8" />
    </svg>
  );
}

export function ScrollIcon({ size = 24, color = "#e0d8c8", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M7 3C5.34 3 4 4.34 4 6v12c0 1.66 1.34 3 3 3h10c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3H7z" fill={color} />
      <path d="M4 6c0-1.66 1.34-3 3-3h0c-1.66 0-3 1.34-3 3v1h16V6c0-1.66-1.34-3-3-3H7C5.34 3 4 4.34 4 6z" fill="rgba(255,255,255,0.2)" />
      <path d="M8 10h8M8 13h8M8 16h5" stroke="rgba(0,0,0,0.3)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function CompassIcon({ size = 24, color = "#e0d8c8", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" fill="rgba(0,0,0,0.3)" />
      <polygon points="12,5 14,12 12,14 10,12" fill="#e74c3c" />
      <polygon points="12,19 10,12 12,10 14,12" fill={color} />
      <circle cx="12" cy="12" r="1.5" fill={color} />
    </svg>
  );
}

export function HammerIcon({ size = 24, color = "#e0d8c8", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <rect x="10" y="10" width="3" height="12" rx="1" fill={color} transform="rotate(-45 12 16)" />
      <rect x="5" y="3" width="14" height="7" rx="2" fill={color} transform="rotate(-45 12 6)" />
      <rect x="5" y="3" width="14" height="3.5" rx="1" fill="rgba(255,255,255,0.15)" transform="rotate(-45 12 6)" />
    </svg>
  );
}

export function PickaxeIcon({ size = 24, color = "#e0d8c8", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <line x1="6" y1="18" x2="16" y2="8" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M14 4l6 6-3 1-4-4 1-3z" fill={color} />
      <path d="M14 4l6 6-1.5.5-4.5-4.5L14 4z" fill="rgba(255,255,255,0.2)" />
    </svg>
  );
}

export function SpeakerIcon({ size = 24, color = "#e0d8c8", muted = false, style }: IconProps & { muted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M3 9v6h4l5 5V4L7 9H3z" fill={color} />
      {muted ? (
        <path d="M16.5 12l4.5-4.5M16.5 12l4.5 4.5M21 7.5l-4.5 4.5M21 16.5l-4.5-4.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      ) : (
        <>
          <path d="M15.54 8.46a5 5 0 010 7.07" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M18.07 5.93a9 9 0 010 12.14" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </>
      )}
    </svg>
  );
}

export function GearIcon({ size = 24, color = "#e0d8c8", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" fill={color} />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 8.82a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" fill={color} />
    </svg>
  );
}

export function FireIcon({ size = 24, color = "#ff6b35", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 2c0 4-4 6-4 10a4 4 0 008 0c0-4-4-6-4-10z" fill={color} />
      <path d="M12 8c0 2-2 3-2 5a2 2 0 004 0c0-2-2-3-2-5z" fill="#ffd700" />
    </svg>
  );
}

export function HealIcon({ size = 24, color = "#4caf50", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="12" cy="12" r="10" fill="rgba(76,175,80,0.2)" stroke={color} strokeWidth="1.5" />
      <rect x="10" y="5" width="4" height="14" rx="1" fill={color} />
      <rect x="5" y="10" width="14" height="4" rx="1" fill={color} />
    </svg>
  );
}

export function MagicShieldIcon({ size = 24, color = "#64b5f6", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 2L4 6v5c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" fill="rgba(100,181,246,0.3)" stroke={color} strokeWidth="1.5" />
      <circle cx="12" cy="11" r="3" fill={color} opacity="0.6" />
      <path d="M12 8v6M9 11h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function DashIcon({ size = 24, color = "#81d4fa", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M13 4l7 8-7 8" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M4 12h14" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d="M4 8h8" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <path d="M4 16h8" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

export function MeteorIcon({ size = 24, color = "#ff9800", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="9" cy="15" r="5" fill={color} />
      <circle cx="9" cy="15" r="3" fill="#ffd700" />
      <path d="M13 11l8-8M14 8l5-3M11 11l3-5" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function SunIcon({ size = 24, color = "#ffd700", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="12" cy="12" r="4" fill={color} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <line
          key={angle}
          x1={12 + 6 * Math.cos((angle * Math.PI) / 180)}
          y1={12 + 6 * Math.sin((angle * Math.PI) / 180)}
          x2={12 + 8 * Math.cos((angle * Math.PI) / 180)}
          y2={12 + 8 * Math.sin((angle * Math.PI) / 180)}
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export function MoonIcon({ size = 24, color = "#b0bec5", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill={color} />
    </svg>
  );
}

export function WoodIcon({ size = 24, color = "#8B4513", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <rect x="3" y="8" width="18" height="5" rx="2.5" fill={color} />
      <rect x="3" y="14" width="18" height="5" rx="2.5" fill="#6d3510" />
      <ellipse cx="8" cy="10.5" rx="1.5" ry="1" fill="rgba(0,0,0,0.2)" />
      <ellipse cx="15" cy="16.5" rx="1.5" ry="1" fill="rgba(0,0,0,0.15)" />
    </svg>
  );
}

export function StoneIcon({ size = 24, color = "#78909c", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M4 14l4-8h8l4 8-3 5H7l-3-5z" fill={color} />
      <path d="M4 14l4-8h8l4 8" fill="rgba(255,255,255,0.1)" />
      <path d="M8 6l2 8M16 6l-1 8" stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" />
    </svg>
  );
}

export function GoldIcon({ size = 24, color = "#ffd700", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="12" cy="12" r="8" fill={color} stroke="#b8860b" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="#b8860b" strokeWidth="0.8" />
      <text x="12" y="16" textAnchor="middle" fill="#b8860b" fontSize="10" fontWeight="bold" fontFamily="serif">G</text>
    </svg>
  );
}

export function CrosshairIcon({ size = 24, color = "#e0d8c8", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1" fill="none" />
      <line x1="12" y1="2" x2="12" y2="7" stroke={color} strokeWidth="1.5" />
      <line x1="12" y1="17" x2="12" y2="22" stroke={color} strokeWidth="1.5" />
      <line x1="2" y1="12" x2="7" y2="12" stroke={color} strokeWidth="1.5" />
      <line x1="17" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export function SkullIcon({ size = 24, color = "#f44336", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 2C7.58 2 4 5.58 4 10c0 2.76 1.41 5.19 3.54 6.61L7 22h10l-.54-5.39C18.59 15.19 20 12.76 20 10c0-4.42-3.58-8-8-8z" fill={color} />
      <circle cx="9" cy="10" r="2" fill="rgba(0,0,0,0.5)" />
      <circle cx="15" cy="10" r="2" fill="rgba(0,0,0,0.5)" />
      <path d="M10 16h4" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
      <path d="M10 16v2M12 16v2M14 16v2" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
    </svg>
  );
}

export function HouseIcon({ size = 24, color = "#e0d8c8", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M3 12l9-9 9 9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M5 10v10h14V10" fill={color} opacity="0.8" />
      <rect x="9" y="14" width="6" height="6" fill="rgba(0,0,0,0.3)" rx="0.5" />
    </svg>
  );
}

export function HeartIcon({ size = 24, color = "#e74c3c", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill={color} />
    </svg>
  );
}

export function BoltIcon({ size = 24, color = "#2196f3", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" fill={color} />
    </svg>
  );
}

export function FoodIcon({ size = 24, color = "#d68910", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <ellipse cx="12" cy="16" rx="8" ry="4" fill={color} />
      <path d="M7 10c0-3 2.5-5 5-5s5 2 5 5" fill="#c0392b" />
      <ellipse cx="12" cy="10" rx="5" ry="2" fill="rgba(255,255,255,0.15)" />
    </svg>
  );
}

export function TrophyIcon({ size = 24, color = "#ffd700", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M7 4h10v4a5 5 0 01-10 0V4z" fill={color} />
      <path d="M7 4H4v3a3 3 0 003 3" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M17 4h3v3a3 3 0 01-3 3" stroke={color} strokeWidth="1.5" fill="none" />
      <rect x="10" y="12" width="4" height="4" fill={color} />
      <rect x="8" y="16" width="8" height="3" rx="1" fill={color} />
    </svg>
  );
}

export function QuestionIcon({ size = 24, color = "#e0d8c8", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" fill="none" />
      <path d="M9.5 9a3 3 0 015.35 1.3c0 1.7-2.35 2.2-2.35 3.7" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="12.5" cy="17.5" r="1" fill={color} />
    </svg>
  );
}
