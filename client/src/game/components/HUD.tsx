import { useSurvival, getHungerStatus, type HungerStatus } from "@/lib/stores/useSurvival";
import { useStaminaFlash } from "@/lib/stores/useStaminaFlash";
import { useClimbPrompt } from "@/lib/stores/useClimbPrompt";
import { useDamageFlash } from "@/lib/stores/useDamageFlash";
import { useParryFlash } from "@/lib/stores/useParryFlash";
import { useSettings } from "@/lib/stores/useSettings";
import { useInventory, type InventoryItem } from "@/lib/stores/useInventory";
import { useGame } from "@/lib/stores/useGame";
import { useHotbar, loadoutKey } from "@/lib/stores/useHotbar";
import { getPlayerId } from "@/lib/save/playerId";
import { getFaction } from "@/lib/data/factions";
import { getFactionForModelPath } from "@/game/systems/ModelRegistry";
import { useAudio } from "@/lib/stores/useAudio";
import { useHarvest } from "@/lib/stores/useHarvest";
import { useBuildSystem } from "@/lib/stores/useBuildSystem";
import { useCampaign } from "@/lib/stores/useCampaign";
import React, { useState, useRef, useEffect } from "react";
import type { InteractionMode } from "@/lib/stores/useGame";
import MainPanel from "./MainPanel";
import AllyDetailPanel from "./AllyDetailPanel";
import WeaponSkillPanel from "./WeaponSkillPanel";
import WorldMap from "./WorldMap";
import SettingsPanel from "./SettingsPanel";
import HotkeysPanel from "./HotkeysPanel";
import DialogPanel, { NpcProximityHint } from "./DialogPanel";
import ChargeMeter from "./ChargeMeter";
import { useDialog } from "@/lib/stores/useDialog";
import { getDialogueScript } from "@/lib/dialog/dialogueData";
import { useWorldMap } from "@/lib/stores/useWorldMap";
import {
  ISLAND_LAYOUT,
  WORLD_MAP_IMAGE_PATH,
  WORLD_MAP_IMAGE_W,
  WORLD_MAP_IMAGE_H,
  worldToImageUV,
} from "@/game/world/IslandLayout";
import { useTargeting } from "@/lib/stores/useTargeting";
import { useEnemyManager } from "@/game/systems/EnemyManager";
import { getEnemyTierColor } from "@/game/systems/EnemyManager";
import { useCombatLog } from "@/lib/stores/useCombatLog";
import { useAllies, ALLY_COMMAND_LABELS, ALLY_COMMAND_ICONS } from "@/lib/stores/useAllies";
import {
  SwordIcon, ShieldIcon, BackpackIcon, SpellbookIcon, ScrollIcon,
  CompassIcon, HammerIcon, PickaxeIcon, SpeakerIcon, GearIcon,
  FireIcon, HealIcon, MagicShieldIcon, DashIcon, MeteorIcon,
  SunIcon, MoonIcon, WoodIcon, StoneIcon, GoldIcon,
  HeartIcon, BoltIcon, FoodIcon, TrophyIcon, QuestionIcon,
  SkullIcon, HouseIcon, CrosshairIcon,
} from "./GameIcons";
import { WEAPON_TYPE_EMOJI } from "@/lib/data/ItemPrefabRegistry";

const COLORS = {
  bgDark: "#0a0705",
  panelBg: "rgba(18, 12, 8, 0.92)",
  panelBgInteractive: "rgba(35, 24, 16, 0.95)",
  borderGold: "#c5a059",
  borderGoldDim: "rgba(197, 160, 89, 0.35)",
  borderGoldBright: "#e8c868",
  textBody: "#e0d8c8",
  textHighlight: "#ffd700",
  textMuted: "#8a7e6a",
  affordanceGlow: "0 0 8px rgba(197, 160, 89, 0.6)",
  btnInnerShadow: "inset 0 2px 4px rgba(255,255,255,0.08), inset 0 -2px 4px rgba(0,0,0,0.5)",
  dockBg: "rgba(12, 8, 5, 0.95)",
  dockBtnBg: "linear-gradient(180deg, rgba(50,36,24,0.9) 0%, rgba(22,15,10,0.95) 100%)",
  dockBtnActive: "linear-gradient(180deg, rgba(80,55,30,0.95) 0%, rgba(45,30,15,0.98) 100%)",
};

const FONTS = {
  header: "'Cinzel', serif",
  body: "'Crimson Text', serif",
  mono: "'JetBrains Mono', monospace",
};

// Bottom-of-screen hint that appears whenever the player's climb
// sensor is engaged and they haven't mounted yet. Mirrors the
// styling of the boat dock prompt so the two read as the same kind
// of cue. The visibility flags are written by the climb sensor
// proximity tracker (`nearClimbable.ts`) and the climb controller
// in Player.tsx — see `useClimbPrompt`.
function ClimbPrompt() {
  const near = useClimbPrompt((s) => s.near);
  const climbing = useClimbPrompt((s) => s.climbing);
  // Mount is gated on stamina > 0 in Player.tsx, so hide the prompt
  // until the player has at least a sliver back — otherwise the cue
  // would lie immediately after a stamina-forced drop-off.
  const stamina = useSurvival((s) => s.stamina);
  if (!near || climbing || stamina <= 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 220,
        transform: "translateX(-50%)",
        zIndex: 9050,
        pointerEvents: "none",
        background: "rgba(12,8,5,0.85)",
        border: "1px solid rgba(197,160,89,0.55)",
        borderRadius: 8,
        padding: "8px 14px",
        color: "#f3eada",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        letterSpacing: 1,
        textTransform: "uppercase",
        boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
      }}
    >
      Press <span style={{ color: "#e8c868", fontWeight: 700 }}>[Space]</span> to climb
    </div>
  );
}

function NpcDialogOverlays() {
  const active = useDialog((s) => s.active);
  const nearby = useDialog((s) => s.nearby);
  const speakerName = nearby ? getDialogueScript(nearby.npcId)?.speakerName ?? null : null;
  return (
    <>
      <NpcProximityHint visible={!active && !!nearby} speakerName={speakerName} />
      <DialogPanel />
    </>
  );
}

function ProgressBar({ color, value, max, label, height = 20, fontSize = 12, showValue = true }: {
  color: string; value: number; max: number; label: string; height?: number; fontSize?: number; showValue?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{
      position: "relative", width: "100%", height,
      background: "rgba(0,0,0,0.8)", borderRadius: 3,
      border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden",
      boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
    }}>
      <div style={{
        position: "absolute", inset: 0, opacity: 0.15,
        backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.1) 5px, rgba(255,255,255,0.1) 10px)",
      }} />
      <div style={{
        position: "absolute", top: 0, left: 0, height: "100%", width: `${pct}%`,
        background: color, transition: "width 0.3s",
        boxShadow: "inset 0 0 10px rgba(255,255,255,0.25)",
      }} />
      <div style={{
        position: "absolute", inset: 0, display: "flex", justifyContent: "space-between",
        alignItems: "center", padding: "0 6px", pointerEvents: "none",
        color: "#fff", fontWeight: "bold", fontSize, textShadow: "0 1px 3px #000",
      }}>
        <span>{label}</span>
        {showValue && <span>{Math.round(value)} / {max}</span>}
      </div>
    </div>
  );
}

// Wraps the stamina ProgressBar with a parry-block reaction:
//   1. A bright cyan pulse overlay flashes across the bar fill
//   2. A floating "−N" label rises and fades next to the bar
// Both fire off the `useStaminaFlash` store, which Player triggers from
// `handleProjectileBlock` after the stamina is actually drained.
function StaminaBar({
  value, max, height, fontSize,
}: { value: number; max: number; height: number; fontSize: number }) {
  const flashSeq = useStaminaFlash((s) => s.seq);
  const flashCost = useStaminaFlash((s) => s.cost);
  const [pulseKey, setPulseKey] = useState(0);
  const [floater, setFloater] = useState<{ key: number; cost: number } | null>(null);
  const lastSeqRef = useRef(0);

  useEffect(() => {
    if (flashSeq === 0 || flashSeq === lastSeqRef.current) return;
    lastSeqRef.current = flashSeq;
    setPulseKey((k) => k + 1);
    setFloater({ key: flashSeq, cost: flashCost });
    const t = window.setTimeout(() => {
      setFloater((cur) => (cur && cur.key === flashSeq ? null : cur));
    }, 900);
    return () => window.clearTimeout(t);
  }, [flashSeq, flashCost]);

  return (
    <div style={{ position: "relative" }}>
      <ProgressBar
        color="linear-gradient(90deg, #1a5276, #2980b9)"
        value={value}
        max={max}
        label="SP"
        height={height}
        fontSize={fontSize}
      />
      {pulseKey > 0 && (
        <div
          key={pulseKey}
          style={{
            position: "absolute", inset: 0, borderRadius: 3,
            pointerEvents: "none",
            background: "linear-gradient(90deg, rgba(122,215,255,0) 0%, rgba(122,215,255,0.85) 50%, rgba(122,215,255,0) 100%)",
            mixBlendMode: "screen",
            animation: "staminaBlockPulse 600ms ease-out forwards",
            boxShadow: "0 0 10px rgba(122,215,255,0.9), inset 0 0 6px rgba(255,255,255,0.6)",
          }}
        />
      )}
      {floater && (
        <div
          key={`f${floater.key}`}
          style={{
            position: "absolute", right: 4, top: -2,
            pointerEvents: "none",
            color: "#7ad7ff", fontFamily: FONTS.header, fontWeight: "bold",
            fontSize: 12, textShadow: "0 1px 3px #000, 0 0 6px rgba(122,215,255,0.8)",
            animation: "staminaBlockFloater 900ms ease-out forwards",
          }}
        >
          −{floater.cost} SP · BLOCK
        </div>
      )}
    </div>
  );
}

// Bottom-row stamina globe with the same parry-block reaction as the
// top-left bar: a cyan ring pulse around the orb plus a small "-N"
// floater. Keeps both stamina readouts visually consistent so the
// player gets the cue regardless of which one they're looking at.
function StaminaGlobe({ stamina, maxStamina }: { stamina: number; maxStamina: number }) {
  const flashSeq = useStaminaFlash((s) => s.seq);
  const flashCost = useStaminaFlash((s) => s.cost);
  const [pulseKey, setPulseKey] = useState(0);
  const [floater, setFloater] = useState<{ key: number; cost: number } | null>(null);
  const lastSeqRef = useRef(0);

  useEffect(() => {
    if (flashSeq === 0 || flashSeq === lastSeqRef.current) return;
    lastSeqRef.current = flashSeq;
    setPulseKey((k) => k + 1);
    setFloater({ key: flashSeq, cost: flashCost });
    const t = window.setTimeout(() => {
      setFloater((cur) => (cur && cur.key === flashSeq ? null : cur));
    }, 900);
    return () => window.clearTimeout(t);
  }, [flashSeq, flashCost]);

  return (
    <div style={{ position: "relative", cursor: "help" }} title={`Stamina: ${Math.round(stamina)}/${maxStamina}`}>
      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        border: `3px solid ${COLORS.borderGold}`,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        overflow: "hidden", background: "#000008",
        boxShadow: "0 0 20px rgba(0,100,200,0.4), inset 0 0 20px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          width: "100%", height: `${(stamina / maxStamina) * 100}%`,
          background: "linear-gradient(to top, #1a5276, #2980b9)",
          transition: "height 0.4s ease",
          boxShadow: "inset 0 10px 20px rgba(0,100,255,0.4)",
        }} />
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,1)",
        }}>
          <span style={{ fontFamily: FONTS.header, fontWeight: "bold", fontSize: 15, lineHeight: 1 }}>{Math.round(stamina)}</span>
          <BoltIcon size={10} color="#aaccff" style={{ marginTop: 1 }} />
        </div>
      </div>
      {pulseKey > 0 && (
        <div
          key={pulseKey}
          style={{
            position: "absolute", inset: -4, borderRadius: "50%",
            pointerEvents: "none",
            border: "3px solid rgba(122,215,255,0.95)",
            boxShadow: "0 0 16px rgba(122,215,255,0.9), inset 0 0 12px rgba(122,215,255,0.6)",
            animation: "staminaBlockGlobe 600ms ease-out forwards",
          }}
        />
      )}
      {floater && (
        <div
          key={`gf${floater.key}`}
          style={{
            position: "absolute", left: "50%", top: -4,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            color: "#7ad7ff", fontFamily: FONTS.header, fontWeight: "bold",
            fontSize: 13, textShadow: "0 1px 3px #000, 0 0 6px rgba(122,215,255,0.8)",
            animation: "staminaBlockFloater 900ms ease-out forwards",
            whiteSpace: "nowrap",
          }}
        >
          −{floater.cost}
        </div>
      )}
    </div>
  );
}

// Full-screen vignette pulse that fires whenever the player loses HP
// from any source — projectiles, melee swings, traps, fall, status
// effects. `useSurvival.takeDamage` routes every HP-draining branch
// through `useDamageFlash.triggerHit`, so callers don't need to fire
// it themselves. Pairs with the playHit() ping so the impact is felt
// visually too.
//
// Intensity scales lightly with damage so big hits feel bigger:
//   ≤10 dmg => ~0.55 alpha, scaling up to ~1.0 at 40 dmg.
// The element itself is `pointerEvents: none` and renders below the
// modal/panel z-indexes so it doesn't interfere with input or UI.
//
// Color is keyed off the damage `source` so the flash also conveys
// *what* hit you: physical = blood red, burn = orange, poison = green,
// fall = silvery white. See `DamageFlashSource` in useDamageFlash.ts.
//
// Honors the dedicated `gameplay.flashEffects` toggle so players who are
// sensitive to brightness / motion can disable the vignette without
// also losing camera shake. Any future "flash" cues (parry success
// flash, low-HP edge pulse, etc.) should gate on this same setting.
const FLASH_TINTS: Record<
  "physical" | "burn" | "poison" | "fall",
  { mid: [number, number, number]; edge: [number, number, number] }
> = {
  physical: { mid: [180, 20, 20], edge: [140, 0, 0] },
  burn:     { mid: [220, 110, 30], edge: [170, 60, 0] },
  poison:   { mid: [70, 170, 60], edge: [30, 110, 30] },
  fall:     { mid: [220, 220, 220], edge: [170, 170, 170] },
};

function DamageFlashOverlay() {
  const seq = useDamageFlash((s) => s.seq);
  const damage = useDamageFlash((s) => s.damage);
  const source = useDamageFlash((s) => s.source);
  const flashEffects = useSettings((s) => s.gameplay.flashEffects);
  const [pulse, setPulse] = useState<
    | { key: number; alpha: number; source: "physical" | "burn" | "poison" | "fall" }
    | null
  >(null);
  const lastSeqRef = useRef(0);

  useEffect(() => {
    if (seq === 0 || seq === lastSeqRef.current) return;
    lastSeqRef.current = seq;
    if (!flashEffects) return;
    // Map damage 0..40 → alpha 0.55..1.0; clamp so trivial hits still
    // get a clearly visible pulse, and huge ones can't blow out white.
    const norm = Math.min(1, Math.max(0, damage / 40));
    const alpha = 0.55 + 0.45 * norm;
    setPulse({ key: seq, alpha, source });
    const t = window.setTimeout(() => {
      setPulse((cur) => (cur && cur.key === seq ? null : cur));
    }, 150);
    return () => window.clearTimeout(t);
  }, [seq, damage, source, flashEffects]);

  if (!pulse) return null;
  // Bake the damage-scaled peak alpha into the gradient stops so the
  // CSS keyframe animation can fade `opacity` cleanly from 1 → 0
  // without fighting an inline opacity override.
  const tint = FLASH_TINTS[pulse.source] ?? FLASH_TINTS.physical;
  const midA = (0.55 * pulse.alpha).toFixed(3);
  const edgeA = (0.85 * pulse.alpha).toFixed(3);
  const [mr, mg, mb] = tint.mid;
  const [er, eg, eb] = tint.edge;
  return (
    <div
      key={pulse.key}
      aria-hidden
      style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9990,
        // Radial vignette: transparent in the middle, source-tinted
        // toward the edges. Keeps the action visible while still
        // flashing the screen. Mid/edge alphas are pre-scaled by
        // `pulse.alpha`.
        background:
          `radial-gradient(ellipse at center, rgba(${mr},${mg},${mb},0) 35%, rgba(${mr},${mg},${mb},${midA}) 75%, rgba(${er},${eg},${eb},${edgeA}) 100%)`,
        animation: "damageFlashPulse 150ms ease-out forwards",
      }}
    />
  );
}

// Brief gold/white edge vignette that fires whenever the player lands a
// successful parry / perfect-block. Pairs with the existing parry SFX
// played from `handleProjectileBlock` in Player.tsx so a clean defense
// gets visual confirmation, not just an audio cue.
//
// This is the positive-feedback counterpart to `DamageFlashOverlay` —
// inverted color (warm gold instead of red) and shorter (~120 ms vs
// ~150 ms) so it reads as a snap of light rather than a damage hit.
// Center stays mostly clear so the action remains visible; the glow
// hugs the screen edges like a parry "ping".
//
// Gated on the same `gameplay.flashEffects` toggle as the damage flash
// so players who disabled flash effects for accessibility get no
// surprise white pulses here either. Only the perfect-timing block
// path (handleProjectileBlock) calls into this store today; regular
// damage-soak blocks intentionally do NOT trigger the flash so players
// can tell the two apart.
function ParryFlashOverlay() {
  const seq = useParryFlash((s) => s.seq);
  const flashEffects = useSettings((s) => s.gameplay.flashEffects);
  const [pulseKey, setPulseKey] = useState(0);
  const lastSeqRef = useRef(0);

  useEffect(() => {
    if (seq === 0 || seq === lastSeqRef.current) return;
    lastSeqRef.current = seq;
    if (!flashEffects) return;
    setPulseKey(seq);
    const t = window.setTimeout(() => {
      setPulseKey((cur) => (cur === seq ? 0 : cur));
    }, 130);
    return () => window.clearTimeout(t);
  }, [seq, flashEffects]);

  if (pulseKey === 0) return null;
  return (
    <div
      key={pulseKey}
      aria-hidden
      style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9990,
        // Radial vignette: clear in the middle, warm gold→white toward the
        // edges. Reads as a quick "ping" of light around the screen rather
        // than a screen-wide white flash, which would be jarring.
        background:
          "radial-gradient(ellipse at center, rgba(255,240,200,0) 45%, rgba(255,225,150,0.45) 78%, rgba(255,255,255,0.7) 100%)",
        animation: "parryFlashPulse 120ms ease-out forwards",
      }}
    />
  );
}

function CombatLogPanel({ visible }: { visible: boolean }) {
  const logRef = useRef<HTMLDivElement>(null);
  const entries = useCombatLog((s) => s.entries);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [entries.length]);

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", bottom: 200, left: 16,
      width: 300, height: 160,
      background: COLORS.panelBg, border: `1px solid ${COLORS.borderGoldDim}`,
      borderRadius: 8, padding: 10, display: "flex", flexDirection: "column",
      backdropFilter: "blur(8px)", zIndex: 9997,
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      animation: "slideUp 0.2s ease-out",
    }}>
      <div style={{
        textAlign: "center", fontFamily: FONTS.header, fontSize: 11,
        borderBottom: `1px solid ${COLORS.borderGoldDim}`, paddingBottom: 4, marginBottom: 4,
        color: COLORS.borderGold, display: "flex", justifyContent: "center", alignItems: "center", gap: 6,
      }}>
        <ScrollIcon size={14} color={COLORS.borderGold} />
        <span>Combat Log</span>
      </div>
      <div ref={logRef} className="custom-scrollbar" style={{
        flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
        justifyContent: "flex-end", gap: 2, fontFamily: FONTS.mono, fontSize: 10, paddingRight: 4,
      }}>
        {entries.slice(-25).map((entry) => (
          <div key={entry.id} style={{ color: entry.color }}>{entry.text}</div>
        ))}
      </div>
    </div>
  );
}

const HUNGER_STATUS_CONFIG: Record<HungerStatus, { label: string; color: string; effect: string }> = {
  well_fed: { label: "Well Fed", color: "#4caf50", effect: "+10% DMG" },
  normal: { label: "Normal", color: "#888", effect: "" },
  hungry: { label: "Hungry", color: "#ff9800", effect: "-30% Regen" },
  starving: { label: "Starving!", color: "#f44336", effect: "-50% Regen" },
};

function HungerStatusIndicator() {
  const hunger = useSurvival((s) => s.hunger);
  const status = getHungerStatus(hunger);
  if (status === "normal") return null;
  const cfg = HUNGER_STATUS_CONFIG[status];
  return (
    <div style={{
      position: "absolute", top: 124, left: 12,
      padding: "4px 10px", borderRadius: 6,
      background: COLORS.panelBg, border: `1px solid ${cfg.color}`,
      fontSize: 11, color: cfg.color, fontFamily: FONTS.header,
      display: "flex", alignItems: "center", gap: 5, zIndex: 90,
      backdropFilter: "blur(4px)",
      animation: status === "starving" ? "pulse 1s infinite" : undefined,
    }}>
      <FoodIcon size={14} color={cfg.color} />
      <span>{cfg.label}</span>
      {cfg.effect && <span style={{ fontSize: 9, opacity: 0.8 }}>{cfg.effect}</span>}
    </div>
  );
}

function AllyCommandIndicator() {
  const globalCommand = useAllies((s) => s.globalCommand);
  const allyCount = useAllies((s) => s.allies.length);
  if (allyCount === 0) return null;
  const icon = ALLY_COMMAND_ICONS[globalCommand];
  const label = ALLY_COMMAND_LABELS[globalCommand];
  return (
    <div style={{
      position: "absolute", top: 150, left: 12,
      padding: "4px 10px", borderRadius: 6,
      background: COLORS.panelBg, border: "1px solid rgba(136,204,255,0.3)",
      fontSize: 11, color: "#88ccff", fontFamily: FONTS.header,
      display: "flex", alignItems: "center", gap: 5, zIndex: 90,
      backdropFilter: "blur(4px)",
    }}>
      <ShieldIcon size={14} color="#88ccff" />
      <span>Allies: {label}</span>
      <span style={{ fontSize: 9, color: "#555" }}>({allyCount})</span>
      <span style={{ fontSize: 8, color: "#444", marginLeft: 2 }}>F1-F4</span>
    </div>
  );
}

function TargetFrame() {
  const targetId = useTargeting((s) => s.targetId);
  const enemies = useEnemyManager((s) => s.enemies);
  const clearTarget = useTargeting((s) => s.clearTarget);

  if (!targetId) return null;
  const enemy = enemies.find((e) => e.id === targetId);
  if (!enemy || enemy.isDying) return null;

  const healthPct = Math.max(0, Math.min(100, (enemy.health / enemy.maxHealth) * 100));
  const tierColor = getEnemyTierColor(enemy.tier);
  const displayName = enemy.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div style={{
      position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
      pointerEvents: "auto", zIndex: 100,
    }}>
      <div style={{
        width: 280, background: COLORS.panelBg,
        border: `1px solid ${COLORS.borderGoldDim}`, borderRadius: 8,
        padding: "10px 14px 12px", position: "relative", backdropFilter: "blur(8px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      }}>
        <button onClick={clearTarget} style={{
          position: "absolute", top: 6, right: 6,
          width: 20, height: 20, borderRadius: 4,
          background: "rgba(180,50,50,0.15)", border: "1px solid rgba(180,50,50,0.35)",
          color: "#d45050", fontSize: 11, fontWeight: 700,
          cursor: "pointer", lineHeight: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s", padding: 0,
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(180,50,50,0.3)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(180,50,50,0.15)"; }}
        >✕</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <CrosshairIcon size={14} color={tierColor} />
          <span style={{
            color: tierColor, fontSize: 12, fontWeight: "bold",
            fontFamily: FONTS.header, textShadow: "0 1px 3px #000", textTransform: "capitalize",
          }}>{displayName}</span>
          <span style={{
            color: "#aaa", fontSize: 9, marginLeft: "auto",
            textTransform: "uppercase", letterSpacing: 1,
          }}>{enemy.tier}</span>
        </div>
        <div style={{ position: "relative", height: 18 }}>
          <div style={{ position: "absolute", inset: 0, background: "#111", borderRadius: 3 }} />
          <div style={{
            position: "absolute", top: 1, left: 1, bottom: 1, width: `${healthPct}%`,
            background: healthPct > 50 ? "linear-gradient(to bottom, #4caf50, #2e7d32)"
              : healthPct > 25 ? "linear-gradient(to bottom, #ff9800, #e65100)"
              : "linear-gradient(to bottom, #f44336, #b71c1c)",
            borderRadius: 3, transition: "width 0.3s",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
          }} />
          <span style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)", color: "#fff",
            fontSize: 9, fontWeight: "bold", textShadow: "0 1px 3px #000", whiteSpace: "nowrap",
          }}>{Math.round(enemy.health)} / {enemy.maxHealth}</span>
        </div>
      </div>
    </div>
  );
}

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

const MODE_CONFIG: Record<InteractionMode, { label: string; color: string; Icon: typeof SwordIcon }> = {
  combat: { label: "Combat", color: "#e74c3c", Icon: SwordIcon },
  build: { label: "Build", color: "#f39c12", Icon: HammerIcon },
  harvest: { label: "Harvest", color: "#2ecc71", Icon: PickaxeIcon },
};

const SKILL_DEFS = [
  { key: "classAbility1" as const, label: "E", name: "Class Ability I", Icon: FireIcon, color: "#ff6b35", max: 6.0 },
  { key: "classAbility2" as const, label: "R", name: "Class Ability II", Icon: MagicShieldIcon, color: "#64b5f6", max: 8.0 },
  { key: "classAbility3" as const, label: "X", name: "Class Ability III", Icon: MeteorIcon, color: "#ff9800", max: 12.0 },
];

interface DockButtonProps {
  Icon: typeof SwordIcon;
  label: string;
  hotkey?: string;
  active?: boolean;
  color?: string;
  onClick: () => void;
  badge?: number;
}

function DockButton({ Icon, label, hotkey, active, color, onClick, badge }: DockButtonProps) {
  const [hovered, setHovered] = useState(false);
  const activeColor = color || COLORS.borderGold;

  return (
    <div style={{ position: "relative" }}>
      {hovered && (
        <div style={{
          position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
          marginBottom: 8, whiteSpace: "nowrap", padding: "4px 10px",
          background: "rgba(0,0,0,0.95)", border: `1px solid ${COLORS.borderGoldDim}`,
          borderRadius: 6, fontSize: 10, color: COLORS.textBody,
          fontFamily: FONTS.header, pointerEvents: "none", zIndex: 20,
          boxShadow: "0 4px 12px rgba(0,0,0,0.8)",
        }}>
          {label}
          {hotkey && <span style={{ color: COLORS.textMuted, marginLeft: 6, fontSize: 9, fontFamily: FONTS.mono }}>[{hotkey}]</span>}
        </div>
      )}
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 44, height: 44, borderRadius: 10,
          background: active ? COLORS.dockBtnActive : COLORS.dockBtnBg,
          border: `1.5px solid ${active ? activeColor : COLORS.borderGoldDim}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", position: "relative", padding: 0,
          transition: "all 0.2s ease",
          boxShadow: active
            ? `0 0 12px ${activeColor}40, ${COLORS.btnInnerShadow}`
            : `0 2px 8px rgba(0,0,0,0.4), ${COLORS.btnInnerShadow}`,
          transform: hovered ? "translateY(-2px)" : "translateY(0)",
        }}
      >
        <Icon size={20} color={active ? activeColor : hovered ? COLORS.textBody : COLORS.textMuted} />
        {active && (
          <div style={{
            position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)",
            width: 16, height: 3, borderRadius: 2,
            background: activeColor, boxShadow: `0 0 6px ${activeColor}`,
          }} />
        )}
        {badge !== undefined && badge > 0 && (
          <div style={{
            position: "absolute", top: -4, right: -4,
            width: 16, height: 16, borderRadius: "50%",
            background: "#e74c3c", border: "2px solid #0a0705",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, fontWeight: "bold", color: "#fff",
          }}>{badge > 9 ? "9+" : badge}</div>
        )}
      </button>
    </div>
  );
}

function ResourceChip({ Icon, value, label }: { Icon: typeof WoodIcon; value: number; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      background: "rgba(0,0,0,0.5)", borderRadius: 6,
      padding: "3px 8px 3px 5px",
      border: "1px solid rgba(255,255,255,0.06)",
    }} title={label}>
      <Icon size={14} />
      <span style={{
        fontSize: 11, fontWeight: "bold", color: COLORS.textBody,
        fontFamily: FONTS.mono, minWidth: 20, textAlign: "right",
      }}>{Math.floor(value)}</span>
    </div>
  );
}

function CampaignPanel({ visible }: { visible: boolean }) {
  const active = useCampaign((s) => s.active);
  const daysSurvived = useCampaign((s) => s.daysSurvived);
  const islandsDiscovered = useCampaign((s) => s.islandsDiscovered);
  const dungeonsCleared = useCampaign((s) => s.dungeonsCleared);
  const totalKills = useCampaign((s) => s.totalKills);
  const homeBaseLevel = useCampaign((s) => s.homeBaseLevel);
  const activeQuests = useCampaign((s) => s.activeQuests);

  if (!visible || !active) return null;

  return (
    <div style={{
      position: "fixed", bottom: 200, right: 16,
      width: 260, background: COLORS.panelBg,
      border: `1px solid ${COLORS.borderGoldDim}`,
      borderRadius: 10, padding: 14, zIndex: 9997,
      backdropFilter: "blur(8px)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      animation: "slideUp 0.2s ease-out",
    }}>
      <div style={{
        fontFamily: FONTS.header, fontSize: 13, color: COLORS.borderGold,
        textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10,
        borderBottom: `1px solid ${COLORS.borderGoldDim}`, paddingBottom: 6,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <TrophyIcon size={16} color={COLORS.borderGold} />
        Campaign
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {[
          { Icon: SunIcon, label: "Day", value: daysSurvived, color: "#ffd700" },
          { Icon: CompassIcon, label: "Islands", value: islandsDiscovered, color: "#64b5f6" },
          { Icon: SkullIcon, label: "Kills", value: totalKills, color: "#e74c3c" },
          { Icon: HouseIcon, label: "Base Lv", value: homeBaseLevel, color: "#81c784" },
        ].map((s) => (
          <div key={s.label} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "5px 8px",
            border: "1px solid rgba(255,255,255,0.04)",
          }}>
            <s.Icon size={14} color={s.color} />
            <div>
              <div style={{ fontSize: 8, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: "bold", color: COLORS.textBody, fontFamily: FONTS.mono }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>
      {activeQuests.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{
            fontSize: 10, color: COLORS.textMuted, fontFamily: FONTS.header,
            textTransform: "uppercase", letterSpacing: 1, marginBottom: 6,
          }}>Active Quests</div>
          {activeQuests.slice(0, 3).map((quest) => {
            const hasProgress = typeof quest.target === "number" && quest.target > 0;
            const progress = quest.progress ?? 0;
            const target = quest.target ?? 1;
            const pct = hasProgress ? Math.min(100, (progress / target) * 100) : 0;
            return (
              <div key={quest.id} style={{
                marginBottom: 4, borderLeft: `2px solid ${COLORS.borderGoldDim}`,
                paddingLeft: 8, paddingTop: 2, paddingBottom: 2,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ color: "#e0d0a0", fontSize: 11, fontWeight: "bold" }}>{quest.title}</div>
                  {hasProgress && (
                    <div style={{ color: "#ffd166", fontSize: 10, fontFamily: FONTS.mono }}>
                      {progress}/{target}
                    </div>
                  )}
                </div>
                <div style={{ color: "#6a5a3a", fontSize: 9, lineHeight: 1.3 }}>{quest.description}</div>
                {hasProgress && (
                  <div style={{
                    marginTop: 3, height: 3, background: "rgba(255,255,255,0.06)",
                    borderRadius: 2, overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${pct}%`, height: "100%",
                      background: "linear-gradient(90deg,#bf8a3c,#ffd166)",
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Round HUD minimap that paints the world overhead reference image as
 * a static backdrop and keeps a player dot in sync with the player's
 * actual position. The world map UI (M key) is the same image at full
 * size with pan/zoom and waypoint editing.
 *
 * Why the dot updates via rAF + ref instead of a normal state hook
 *   `useGame.playerPosition` is a `THREE.Vector3` that gets mutated in
 *   place every frame to avoid GC pressure. Subscribing to it via
 *   `useGame(s => s.playerPosition)` only fires once, on the initial
 *   non-null assignment; after that React thinks the reference is
 *   unchanged and never re-renders. So we read .x / .z directly each
 *   frame and write the dot's transform via a DOM ref. No re-renders.
 */
function Minimap(props: {
  isDaytime: boolean;
  onClick: () => void;
  dayNightLabelColor: string;
  mutedColor: string;
  borderColor: string;
  borderColorHover: string;
  glow: string;
  headerFont: string;
}) {
  const dotRef = React.useRef<HTMLDivElement | null>(null);
  const SIZE = 130;

  React.useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const pos = useGame.getState().playerPosition;
      const dot = dotRef.current;
      if (!dot) return;
      if (!pos) {
        dot.style.opacity = "0";
        return;
      }
      const { u, v } = worldToImageUV(pos.x, pos.z);
      // Clamp to the circle's interior so a dot way off-map doesn't
      // disappear off the edge (handy while sailing past the islets).
      const cu = Math.max(0.02, Math.min(0.98, u));
      const cv = Math.max(0.02, Math.min(0.98, v));
      dot.style.opacity = "1";
      dot.style.transform = `translate(${cu * SIZE - 5}px, ${cv * SIZE - 5}px)`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      style={{
        width: SIZE, height: SIZE, borderRadius: "50%",
        border: `3px solid ${props.borderColor}`, overflow: "hidden",
        position: "relative", pointerEvents: "auto", cursor: "pointer",
        boxShadow: `0 5px 20px rgba(0,0,0,0.8), ${props.glow}`,
        background: "#0a1a2a",
      }}
      title="Open World Map [M]"
      onClick={props.onClick}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = props.borderColorHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = props.borderColor; }}
    >
      {/* World image fills the circle. object-fit:fill (not cover)
          so the image's UV space maps 1:1 to the 130x130 box —
          critical because pins and the player dot are positioned
          using raw UV. The 784x826 source has a near-square aspect
          (0.95) so the ~5% vertical squish is imperceptible at this
          size. cover would crop and break pin alignment. */}
      <img
        src={WORLD_MAP_IMAGE_PATH}
        width={WORLD_MAP_IMAGE_W}
        height={WORLD_MAP_IMAGE_H}
        alt=""
        draggable={false}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "fill",
          pointerEvents: "none", userSelect: "none",
        }}
      />
      {/* Subtle vignette so the day/night chip stays readable over
          bright beach pixels. */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      {/* Island pins from IslandLayout — small coloured dots so the
          player can see the world's structure at a glance. The
          tutorial pin gets a brighter ring so it stands out as "home". */}
      {ISLAND_LAYOUT.map((isl) => {
        const left = (isl.imagePx / WORLD_MAP_IMAGE_W) * SIZE;
        const top = (isl.imagePy / WORLD_MAP_IMAGE_H) * SIZE;
        const r = isl.isIslet ? 2 : isl.isTutorial ? 5 : 4;
        return (
          <div
            key={isl.id}
            aria-hidden
            style={{
              position: "absolute",
              left: left - r,
              top: top - r,
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              background: isl.color,
              border: isl.isTutorial ? "1.5px solid #fff" : "1px solid rgba(0,0,0,0.45)",
              boxShadow: isl.isTutorial ? "0 0 5px rgba(255,255,255,0.7)" : undefined,
              pointerEvents: "none",
            }}
          />
        );
      })}
      {/* Player dot — 10px white-ringed marker, positioned absolutely
          and moved every frame by the rAF loop above. */}
      <div
        ref={dotRef}
        style={{
          position: "absolute", top: 0, left: 0,
          width: 10, height: 10, borderRadius: "50%",
          background: "#e74c3c", border: "2px solid #fff",
          boxShadow: "0 0 6px rgba(231,76,60,0.95)",
          pointerEvents: "none",
          willChange: "transform",
          transform: `translate(${SIZE / 2 - 5}px, ${SIZE / 2 - 5}px)`,
        }}
      />
      {/* Day/night chip preserved from the placeholder minimap. The
          old wave counter was removed when the game pivoted away from
          the wave-based survival prototype to an open-world MMO. */}
      <div style={{
        position: "absolute", bottom: 0, width: "100%",
        background: "rgba(0,0,0,0.7)", textAlign: "center",
        padding: "3px 0", backdropFilter: "blur(4px)",
        borderTop: "1px solid rgba(255,255,255,0.15)",
        fontSize: 10, fontWeight: "bold", fontFamily: props.headerFont,
        letterSpacing: 1, color: props.dayNightLabelColor,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
      }}>
        {props.isDaytime ? <SunIcon size={12} color="#ffd700" /> : <MoonIcon size={12} color="#b0bec5" />}
        <span>{props.isDaytime ? "DAY" : "NIGHT"}</span>
      </div>
    </div>
  );
}

export default function HUD() {
  const { health, maxHealth, hunger, maxHunger, stamina, maxStamina } = useSurvival();
  const { score, enemiesKilled, isDaytime, showCrafting, toggleCrafting, activePanel, togglePanel, closePanel, xp, xpToNext, level, comboCount, comboTimer, skillCooldowns } = useGame();
  const selectedCharacter = useGame((s) => s.selectedCharacter);
  // Faction is derived from race (model path) — single source of truth.
  // Falls back to selectedCharacter.faction for legacy save data, then to default.
  const faction = getFaction(
    getFactionForModelPath(selectedCharacter?.modelPath) || selectedCharacter?.faction
  );
  const interactionMode = useGame((s) => s.interactionMode);
  const cycleInteractionMode = useGame((s) => s.cycleInteractionMode);
  const { isMuted, toggleMute } = useAudio();
  const { getSelectedItem, items, selectedSlot, selectSlot } = useInventory();
  // Mode-aware hotbar: weapon skills derived from equipped weapon's
  // mastery tree, class skills tracked alongside, harvest hotbar
  // sorts inventory so food/materials surface before everything else.
  const hotbarHydratedKey = useHotbar((s) => s.hydratedKey);
  const hotbarHydrate = useHotbar((s) => s.hydrate);
  const hotbarPersist = useHotbar((s) => s.persist);
  const resolveWeaponSkills = useHotbar((s) => s.resolveWeaponSkills);
  const harvestPinnedTools = useHotbar((s) => s.harvest.pinnedToolIds);
  const combatBindings = useHotbar((s) => s.combat);
  const characterIdRaw = useGame((s) => s.selectedCharacter.characterId);
  const characterId = characterIdRaw && characterIdRaw.length >= 6 ? characterIdRaw : `char-${characterIdRaw || "default"}`;
  const [hoveredWeaponSkill, setHoveredWeaponSkill] = useState<number | null>(null);
  const { isHarvesting, harvestProgress, harvestDuration, harvestAnimation } = useHarvest();
  const resources = useBuildSystem(s => s.resources);
  const placedCount = useBuildSystem(s => s.placedBuildings.length);
  const selected = getSelectedItem();
  const windowWidth = useWindowWidth();
  const actionBarScale = Math.min(1, (windowWidth - 20) / 900);
  const toggleMap = useWorldMap(s => s.toggleMap);
  const campaignActive = useCampaign(s => s.active);

  const [hoveredSkill, setHoveredSkill] = useState<number | null>(null);
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);
  const [showCombatLog, setShowCombatLog] = useState(false);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "KeyM" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        toggleMap();
      }
      if (e.code === "KeyL" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setShowCombatLog(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [toggleMap]);

  const harvestLabel = harvestAnimation === "attack" ? "Chopping..." :
    harvestAnimation === "attack2" ? "Mining..." : "Gathering...";

  // Build the displayed hotbar list. Combat keeps the raw inventory
  // order (selecting slot N == items[N]). Harvest sorts so pinned
  // tools come first, then food, then materials, then anything else
  // — surfacing what the player actually needs while gathering. Note
  // that selectedSlot is a raw index into the displayed list, so the
  // highlight stays on the same visual position when switching modes.
  const harvestSortedItems: (InventoryItem | null)[] = (() => {
    if (interactionMode !== "harvest") return [];
    const score = (it: InventoryItem) => {
      if (harvestPinnedTools.includes(it.id)) return 0;
      if (it.type === "tool")     return 1;
      if (it.type === "food")     return 2;
      if (it.type === "material") return 3;
      return 4;
    };
    return [...items]
      .sort((a, b) => score(a) - score(b))
      .slice(0, 10);
  })();
  const sourceItems: (InventoryItem | undefined | null)[] =
    interactionMode === "harvest" ? harvestSortedItems : items;
  const hotbarItems = Array.from({ length: 10 }).map((_, i) => {
    const item = sourceItems[i];
    if (!item) return null;
    return { icon: item.icon, name: item.name, qty: item.quantity };
  });

  // Weapon skill slots — only meaningful in combat mode. In other modes
  // we still compute (cheap, no allocations beyond the array) but skip
  // the render. Cooldowns aren't yet wired for weapon skills, so they
  // render as always-ready; class skills still drive off skillCooldowns.
  const weaponSkillSlots = interactionMode === "combat" ? resolveWeaponSkills() : [];

  // Hydrate hotbar bindings from the server when the active
  // character changes. The character id from useGame is short-form
  // (e.g. "knight"), so we pad it to satisfy the >=6 char API
  // constraint before sending. The store's hydrate() resets bindings
  // to defaults synchronously and clears hydratedKey, which the
  // persist effect below uses to refuse to write stale state.
  useEffect(() => {
    hotbarHydrate(getPlayerId(), characterId);
  }, [hotbarHydrate, characterId]);

  // Debounced persistence — writes 1.5s after the latest mutation.
  // Two hard gates prevent cross-character clobber:
  //   1. The effect itself only schedules a write when the store's
  //      hydratedKey matches the *current* (playerId, characterId).
  //   2. useHotbar.persist() re-checks the same key right before
  //      the network call, so even a late-firing timer from the
  //      previous character cannot win the race.
  useEffect(() => {
    const currentKey = loadoutKey(getPlayerId(), characterId);
    if (hotbarHydratedKey !== currentKey) return;
    const t = setTimeout(() => {
      hotbarPersist(getPlayerId(), characterId);
    }, 1500);
    return () => clearTimeout(t);
  }, [hotbarHydratedKey, hotbarPersist, characterId, combatBindings, harvestPinnedTools]);

  const modeCfg = MODE_CONFIG[interactionMode];

  return (
    <>
      <WorldMap />
      <TargetFrame />
      <HungerStatusIndicator />
      <AllyCommandIndicator />
      <ChargeMeter />

      {/* === TOP LEFT: Unit Frame === */}
      <div style={{
        position: "absolute", top: 16, left: 16,
        display: "flex", gap: 12, pointerEvents: "none", maxWidth: "45vw",
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          border: `2.5px solid ${COLORS.borderGold}`,
          background: COLORS.panelBgInteractive,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", boxShadow: `0 4px 16px rgba(0,0,0,0.8), ${COLORS.affordanceGlow}`,
          pointerEvents: "auto", cursor: "pointer", flexShrink: 0,
        }} title="Character Profile">
          <span style={{ fontSize: 28, filter: "drop-shadow(0 2px 3px #000)" }}>
            {selected?.icon || "🧙‍♂️"}
          </span>
          <div style={{
            position: "absolute", bottom: -6, right: -4,
            width: 26, height: 26, borderRadius: "50%",
            background: "linear-gradient(135deg, #6a1b1b, #3a0a0a)",
            border: `2px solid ${COLORS.borderGold}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: FONTS.header, fontSize: 12, fontWeight: "bold", color: "#fff",
            boxShadow: "0 2px 6px rgba(0,0,0,0.6)",
          }}>{level}</div>
          <div title={faction.name} style={{
            position: "absolute", top: -4, right: -6,
            width: 30, height: 30, borderRadius: "50%",
            background: `radial-gradient(circle, ${faction.colorDark} 0%, #050505 90%)`,
            border: `2px solid ${faction.color}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 8px ${faction.color}aa, 0 2px 6px rgba(0,0,0,0.7)`,
            overflow: "hidden",
          }}>
            <img src={faction.emblem} alt={faction.name} style={{ width: 26, height: 26, objectFit: "contain" }} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 3, justifyContent: "center", width: 200 }}>
          <ProgressBar color="linear-gradient(90deg, #8e2020, #c0392b)" value={health} max={maxHealth} label="HP" height={18} fontSize={10} />
          <StaminaBar value={stamina} max={maxStamina} height={14} fontSize={9} />
          <ProgressBar color="linear-gradient(90deg, #935116, #d68910)" value={hunger} max={maxHunger} label="FD" height={12} fontSize={8} />
          <ProgressBar color="linear-gradient(90deg, #6c3483, #8e44ad)" value={xp} max={xpToNext} label="XP" height={8} fontSize={7} showValue={false} />
        </div>
      </div>

      {/* === TOP RIGHT: Compact Info === */}
      <div style={{
        position: "absolute", top: 16, right: 16,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
        pointerEvents: "none", maxWidth: "35vw",
      }}>
        {/* Minimap — full world overview baked from IslandLayout. The
            player dot subscribes to useGame.playerPosition via its own
            rAF loop because that Vector3 is mutated in place rather
            than re-set, so a normal React subscription would never
            fire after the first frame. */}
        <Minimap
          isDaytime={isDaytime}
          onClick={toggleMap}
          dayNightLabelColor={COLORS.textHighlight}
          mutedColor={COLORS.textMuted}
          borderColor={COLORS.borderGold}
          borderColorHover={COLORS.borderGoldBright}
          glow={COLORS.affordanceGlow}
          headerFont={FONTS.header}
        />

        {/* Resources */}
        <div style={{
          display: "flex", gap: 4, pointerEvents: "none",
        }}>
          <ResourceChip Icon={WoodIcon} value={resources.wood} label="Wood" />
          <ResourceChip Icon={StoneIcon} value={resources.stone} label="Stone" />
          <ResourceChip Icon={GoldIcon} value={resources.gold} label="Gold" />
        </div>

        {/* Score & Kills */}
        <div style={{
          display: "flex", gap: 8, pointerEvents: "none",
          fontSize: 10, fontFamily: FONTS.mono, color: COLORS.textMuted,
        }}>
          <span><TrophyIcon size={12} color="#ffd700" style={{ verticalAlign: "middle", marginRight: 3 }} />{score}</span>
          <span><SkullIcon size={12} color="#e74c3c" style={{ verticalAlign: "middle", marginRight: 3 }} />{enemiesKilled}</span>
          {placedCount > 0 && (
            <span><HouseIcon size={12} color="#64b5f6" style={{ verticalAlign: "middle", marginRight: 3 }} />{placedCount}</span>
          )}
        </div>
      </div>

      {/* === COMBO COUNTER === */}
      {comboCount >= 2 && (
        <div style={{
          position: "absolute", top: "30%", left: "50%",
          transform: "translateX(-50%)", pointerEvents: "none", textAlign: "center",
          opacity: Math.min(1, comboTimer / 0.5), transition: "opacity 0.3s",
        }}>
          <div style={{
            fontSize: comboCount >= 10 ? 42 : comboCount >= 5 ? 36 : 28,
            fontWeight: "bold",
            color: comboCount >= 10 ? "#ff4444" : comboCount >= 5 ? "#ffaa00" : "#ff8844",
            textShadow: `0 0 20px ${comboCount >= 10 ? "rgba(255,68,68,0.8)" : comboCount >= 5 ? "rgba(255,170,0,0.6)" : "rgba(255,136,68,0.4)"}`,
            letterSpacing: 2, fontFamily: FONTS.header,
          }}>
            {comboCount}x COMBO
          </div>
        </div>
      )}

      {/* === HARVEST PROGRESS === */}
      {isHarvesting && (
        <div style={{
          position: "absolute", bottom: 175, left: "50%",
          transform: "translateX(-50%)", pointerEvents: "none",
        }}>
          <div style={{ width: 300 }}>
            <div style={{
              textAlign: "center", color: "#fff", fontSize: 11,
              marginBottom: 4, fontFamily: FONTS.header, textShadow: "0 1px 4px #000",
            }}>{harvestLabel}</div>
            <ProgressBar
              color={harvestAnimation === "attack" ? "linear-gradient(90deg, #8B4513, #a0522d)" :
                harvestAnimation === "attack2" ? "linear-gradient(90deg, #666, #999)" :
                "linear-gradient(90deg, #4a7c3f, #7cba3f)"}
              value={harvestProgress} max={harvestDuration} label="" height={22} fontSize={10} showValue={false}
            />
          </div>
        </div>
      )}

      {/* === BOTTOM ACTION BAR === */}
      <div style={{
        position: "fixed", bottom: 8, left: "50%", transform: "translateX(-50%)",
        pointerEvents: "none", zIndex: 9999,
        display: interactionMode === "build" ? "none" : "flex",
        flexDirection: "column", alignItems: "center", gap: 6,
        maxWidth: "100vw",
      }}>
        {/* Mode Indicator */}
        <div
          onClick={() => cycleInteractionMode()}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 14px", background: COLORS.panelBg,
            border: `1px solid ${modeCfg.color}`, borderRadius: 20,
            cursor: "pointer", pointerEvents: "auto",
            transition: "all 0.2s", backdropFilter: "blur(4px)",
          }}
        >
          <modeCfg.Icon size={14} color={modeCfg.color} />
          <span style={{
            fontSize: 11, color: modeCfg.color, fontWeight: "bold",
            fontFamily: FONTS.header, letterSpacing: 1, textTransform: "uppercase",
          }}>{modeCfg.label}</span>
          <span style={{ fontSize: 9, color: "#555" }}>[Q]</span>
        </div>

        {/* Action Bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          transform: `scale(${actionBarScale})`, transformOrigin: "bottom center",
          pointerEvents: "auto",
        }}>
          {/* HP Globe */}
          <div style={{ position: "relative", cursor: "help" }} title={`Health: ${Math.round(health)}/${maxHealth}`}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              border: `3px solid ${COLORS.borderGold}`,
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              overflow: "hidden", background: "#0a0000",
              boxShadow: "0 0 20px rgba(200,0,0,0.4), inset 0 0 20px rgba(0,0,0,0.5)",
            }}>
              <div style={{
                width: "100%", height: `${(health / maxHealth) * 100}%`,
                background: "linear-gradient(to top, #8e2020, #c0392b)",
                transition: "height 0.4s ease",
                boxShadow: "inset 0 10px 20px rgba(255,0,0,0.4)",
              }} />
              <div style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,1)",
              }}>
                <span style={{ fontFamily: FONTS.header, fontWeight: "bold", fontSize: 15, lineHeight: 1 }}>{Math.round(health)}</span>
                <HeartIcon size={10} color="#ffaaaa" style={{ marginTop: 1 }} />
              </div>
            </div>
          </div>

          {/* Skills + Hotbar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 3, padding: 8,
            borderRadius: 12, border: `1px solid ${COLORS.borderGold}`,
            background: COLORS.panelBgInteractive,
            boxShadow: `0 10px 30px rgba(0,0,0,0.8), ${COLORS.btnInnerShadow}`,
          }}>
            {/* Combat-only: Weapon skills (auto-derived from equipped weapon's mastery tree) */}
            {interactionMode === "combat" && weaponSkillSlots.map((skill, i) => {
              const label = ["Q1", "Q2", "Q3"][i];
              const color = skill?.color ?? "#555";
              const present = !!skill;
              return (
                <div key={`wskill-${i}`} style={{
                  position: "relative", display: "flex", flexDirection: "column",
                  alignItems: "center", cursor: present ? "pointer" : "default",
                }}
                  onMouseEnter={() => setHoveredWeaponSkill(i)}
                  onMouseLeave={() => setHoveredWeaponSkill(null)}
                >
                  {hoveredWeaponSkill === i && (
                    <div style={{
                      position: "absolute", top: -28, whiteSpace: "nowrap",
                      fontSize: 10, padding: "2px 8px", borderRadius: 4,
                      background: "#000", border: `1px solid ${COLORS.borderGoldDim}`,
                      color: "#fff", zIndex: 10, pointerEvents: "none",
                    }}>
                      {skill ? `${skill.node.name} — ${skill.node.effect}` : "Equip a weapon"}
                    </div>
                  )}
                  <div style={{
                    width: 44, height: 44, borderRadius: 8,
                    border: `1px solid ${present ? COLORS.borderGold : "#3a3a3a"}`,
                    background: present ? "rgba(30,25,18,0.9)" : "#141414",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative", overflow: "hidden",
                    opacity: present ? 1 : 0.45, transition: "all 0.15s",
                    boxShadow: present ? COLORS.btnInnerShadow : "none",
                    transform: present && hoveredWeaponSkill === i ? "translateY(-3px)" : "translateY(0)",
                    fontSize: 22,
                  }}>
                    {/* Show weapon-type emoji when a weapon skill is present,
                        fall back to generic SwordIcon for empty slots. */}
                    {present && skill
                      ? <span style={{ filter: "drop-shadow(0 1px 3px #000)" }}>
                          {WEAPON_TYPE_EMOJI[skill.weapon as keyof typeof WEAPON_TYPE_EMOJI] ?? "⚔️"}
                        </span>
                      : <SwordIcon size={20} color="#444" />}
                  </div>
                  <div style={{
                    marginTop: 2, background: "rgba(255,255,255,0.08)", padding: "1px 5px",
                    borderRadius: 3, fontSize: 8, fontWeight: "bold", textAlign: "center",
                    color: "#888", border: "1px solid rgba(255,255,255,0.04)",
                  }}>{label}</div>
                </div>
              );
            })}

            {/* Combat-only: separator between weapon and class skills */}
            {interactionMode === "combat" && (
              <div style={{ width: 1, height: 50, background: COLORS.borderGoldDim, margin: "0 4px", flexShrink: 0 }} />
            )}

            {/* Combat-only: Class skills */}
            {interactionMode === "combat" && SKILL_DEFS.map((skill, i) => {
              const cd = skillCooldowns[skill.key] || 0;
              const onCd = cd > 0;
              return (
                <div key={skill.key} style={{
                  position: "relative", display: "flex", flexDirection: "column",
                  alignItems: "center", cursor: "pointer",
                }}
                  onMouseEnter={() => setHoveredSkill(i)}
                  onMouseLeave={() => setHoveredSkill(null)}
                >
                  {hoveredSkill === i && (
                    <div style={{
                      position: "absolute", top: -28, whiteSpace: "nowrap",
                      fontSize: 10, padding: "2px 8px", borderRadius: 4,
                      background: "#000", border: `1px solid ${COLORS.borderGoldDim}`,
                      color: "#fff", zIndex: 10, pointerEvents: "none",
                    }}>
                      {skill.name} {onCd ? `(${cd.toFixed(1)}s)` : ""}
                    </div>
                  )}
                  <div style={{
                    width: 44, height: 44, borderRadius: 8,
                    border: `1px solid ${onCd ? "#444" : COLORS.borderGold}`,
                    background: onCd ? "#1a1a1a" : "rgba(30,25,18,0.9)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative", overflow: "hidden",
                    opacity: onCd ? 0.5 : 1, transition: "all 0.15s",
                    boxShadow: !onCd ? COLORS.btnInnerShadow : "none",
                    transform: !onCd && hoveredSkill === i ? "translateY(-3px)" : "translateY(0)",
                  }}>
                    <skill.Icon size={20} color={onCd ? "#555" : skill.color} />
                    {onCd && (
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, width: "100%",
                        height: `${(cd / skill.max) * 100}%`,
                        background: "rgba(0,0,0,0.7)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{
                          color: "#fff", fontSize: 9, fontWeight: "bold",
                          textShadow: "0 1px 3px #000", zIndex: 1,
                        }}>{cd.toFixed(1)}s</span>
                      </div>
                    )}
                  </div>
                  <div style={{
                    marginTop: 2, background: "rgba(255,255,255,0.08)", padding: "1px 5px",
                    borderRadius: 3, fontSize: 8, fontWeight: "bold", textAlign: "center",
                    color: "#888", border: "1px solid rgba(255,255,255,0.04)",
                  }}>{skill.label}</div>
                </div>
              );
            })}

            {/* Combat-only: separator between class skills and inventory hotbar */}
            {interactionMode === "combat" && (
              <div style={{ width: 1, height: 50, background: COLORS.borderGoldDim, margin: "0 4px", flexShrink: 0 }} />
            )}

            {/* Hotbar — matches the skill-slot styling above (44x44,
                radius 8, single CSS border) so weapon-skills, class-
                skills and inventory hotkeys read as one consistent
                strip. The cramped per-slot name label was removed —
                icons + tooltip-on-hover already convey the item. */}
            {hotbarItems.map((item, i) => {
              const isSelected = selectedSlot === i;
              const isHovered = hoveredItem === i;
              return (
                <div key={`inv-${i}`} style={{
                  position: "relative", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center",
                }}
                  onClick={() => selectSlot(i)}
                  onMouseEnter={() => setHoveredItem(i)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 8,
                    border: `1px solid ${isSelected ? COLORS.borderGoldBright : (item ? COLORS.borderGold : "#3a3a3a")}`,
                    background: item ? "rgba(30,25,18,0.9)" : "#141414",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative", overflow: "hidden",
                    opacity: item ? 1 : 0.45, transition: "all 0.15s",
                    boxShadow: isSelected
                      ? `inset 0 0 10px rgba(197,160,89,0.35), 0 0 8px rgba(197,160,89,0.5)`
                      : (item ? COLORS.btnInnerShadow : "none"),
                    transform: item && isHovered ? "translateY(-3px)" : "translateY(0)",
                  }}>
                    {item ? (
                      <>
                        <span style={{
                          fontSize: 24, lineHeight: 1,
                          filter: "drop-shadow(0 1px 2px #000)",
                        }}>{item.icon}</span>
                        {item.qty > 1 && (
                          <span style={{
                            position: "absolute", bottom: 1, right: 3,
                            fontSize: 9, fontWeight: "bold", color: "#fff",
                            textShadow: "0 1px 3px #000, 0 0 3px #000",
                          }}>{item.qty}</span>
                        )}
                      </>
                    ) : null}
                  </div>
                  {/* Hotkey label below the slot — matches the
                      `[label]` chip the skill slots render so the row
                      reads as a single typographic system. */}
                  <div style={{
                    marginTop: 2, background: "rgba(255,255,255,0.08)", padding: "1px 5px",
                    borderRadius: 3, fontSize: 8, fontWeight: "bold", textAlign: "center",
                    color: isSelected ? COLORS.borderGold : "#888",
                    border: "1px solid rgba(255,255,255,0.04)",
                    minWidth: 14,
                  }}>{i === 9 ? 0 : i + 1}</div>

                  {item && isHovered && (
                    <div style={{
                      position: "absolute", bottom: "100%", left: "50%",
                      transform: "translateX(-50%)", marginBottom: 8,
                      background: "rgba(0,0,0,0.95)", border: `1px solid ${COLORS.borderGold}`,
                      padding: 8, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.8)",
                      minWidth: 120, zIndex: 20, pointerEvents: "none",
                    }}>
                      <div style={{
                        fontWeight: "bold", color: COLORS.borderGold,
                        borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: 4, marginBottom: 4,
                        fontSize: 11,
                      }}>{item.name}</div>
                      <div style={{ fontSize: 10, color: "#888", display: "flex", justifyContent: "space-between" }}>
                        <span>Qty:</span><span>{item.qty}</span>
                      </div>
                      <div style={{ fontSize: 9, color: "#444", marginTop: 4, textAlign: "center", fontStyle: "italic" }}>
                        Press {i === 9 ? 0 : i + 1} to use
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stamina Globe */}
          <StaminaGlobe stamina={stamina} maxStamina={maxStamina} />
        </div>
      </div>

      {/* === BOTTOM LEFT: Combat Log (toggleable) === */}
      <CombatLogPanel visible={showCombatLog} />

      {/* === BOTTOM RIGHT: Icon Dock === */}
      <div style={{
        position: "fixed", bottom: 16, right: 16,
        display: "flex", gap: 6, pointerEvents: "auto", zIndex: 9998,
      }}>
        <DockButton
          Icon={BackpackIcon} label="Inventory" hotkey="I"
          active={activePanel === "inventory" || showCrafting}
          color="#d4a400"
          onClick={() => togglePanel("inventory")}
        />
        <DockButton
          Icon={SpellbookIcon} label="Skills" hotkey="K"
          active={activePanel === "skills"}
          color="#bb95ff"
          onClick={() => togglePanel("skills")}
        />
        <DockButton
          Icon={SwordIcon} label="Combat" hotkey="C"
          active={activePanel === "combat"}
          color="#e74c3c"
          onClick={() => togglePanel("combat")}
        />
        <DockButton
          Icon={ScrollIcon} label="Combat Log" hotkey="L"
          active={showCombatLog}
          color="#81d4fa"
          onClick={() => setShowCombatLog(prev => !prev)}
        />
        <DockButton
          Icon={CompassIcon} label="World Map" hotkey="M"
          color="#64b5f6"
          onClick={toggleMap}
        />
        {campaignActive && (
          <DockButton
            Icon={TrophyIcon} label="Campaign"
            active={activePanel === "campaign"}
            color="#ffd700"
            onClick={() => togglePanel("campaign")}
          />
        )}
        <DockButton
          Icon={QuestionIcon} label="Hotkeys"
          active={activePanel === "hotkeys"}
          color="#a0a0a0"
          onClick={() => togglePanel("hotkeys")}
        />
        <DockButton
          Icon={GearIcon} label="Settings" hotkey="ESC"
          active={activePanel === "settings"}
          color="#b0bec5"
          onClick={() => togglePanel("settings")}
        />
        <DockButton
          Icon={({ size, color, style }: { size?: number; color?: string; style?: React.CSSProperties }) =>
            <SpeakerIcon size={size} color={color} style={style} muted={isMuted} />
          }
          label={isMuted ? "Unmute" : "Mute"}
          onClick={toggleMute}
        />
      </div>

      {/* === TOGGLEABLE PANELS === */}
      <CampaignPanel visible={activePanel === "campaign"} />

      <MainPanel isOpen={showCrafting || activePanel === "inventory" || activePanel === "combat"} onClose={() => { if (showCrafting) toggleCrafting(); closePanel(); }} />
      <AllyDetailPanel />
      <WeaponSkillPanel isOpen={activePanel === "skills"} onClose={closePanel} />
      <SettingsPanel isOpen={activePanel === "settings"} onClose={closePanel} />
      <HotkeysPanel isOpen={activePanel === "hotkeys"} onClose={closePanel} />

      {/* Red vignette pulse on unblocked enemy projectile hits. */}
      <DamageFlashOverlay />

      {/* Gold/white edge flash on a successful parry / perfect block. */}
      <ParryFlashOverlay />

      {/* Dialog system overlay + proximity hint */}
      <NpcDialogOverlays />

      {/* "Press Space to climb" hint when inside a climb sensor. */}
      <ClimbPrompt />

      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;700&display=swap');
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c5a059; border-radius: 2px; }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes staminaBlockPulse {
          0%   { opacity: 0; transform: translateX(-30%); }
          30%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(30%); }
        }
        @keyframes staminaBlockGlobe {
          0%   { opacity: 0; transform: scale(0.85); }
          35%  { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0; transform: scale(1.25); }
        }
        @keyframes staminaBlockFloater {
          0%   { opacity: 0; transform: translateY(0px) scale(0.85); }
          15%  { opacity: 1; transform: translateY(-4px) scale(1); }
          80%  { opacity: 1; transform: translateY(-16px) scale(1); }
          100% { opacity: 0; transform: translateY(-22px) scale(0.95); }
        }
        /* Red vignette pulse on unblocked enemy projectile hits.
           Snaps in fast, then fades out over ~150 ms to keep the cue
           punchy without smothering the action. The element's inline
           opacity is set to the damage-scaled peak; this animation
           overrides it from 100%→0 of that peak. */
        @keyframes damageFlashPulse {
          0%   { opacity: 1; }
          15%  { opacity: 1; }
          100% { opacity: 0; }
        }
        /* Gold/white edge flash for a successful parry / perfect block.
           Snaps in instantly, holds at full for one frame, then fades
           cleanly so it reads as a quick light "ping" rather than a
           lingering bloom. ~120 ms total. */
        @keyframes parryFlashPulse {
          0%   { opacity: 1; }
          10%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}} />
    </>
  );
}
