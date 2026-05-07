import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useGame } from "@/lib/stores/useGame";
import { DEFAULT_WEAPON_OFFSET, type WeaponOffsetConfig } from "@/game/systems/BoneAliases";
import { useWeaponTuner, type GizmoMode } from "@/game/systems/playerBones";
import {
  cloneWeaponOffset as cloneOffset,
  useWeaponOffsetPresetsStore,
  weaponOffsetComboKey as comboKeyFor,
  writeWeaponOffsetPresetsStore as writePresetsStore,
  type WeaponOffsetPresetsStore as PresetsStore,
} from "@/game/systems/weaponOffsetPresets";

type Hand = "right" | "left";
type Axis = 0 | 1 | 2;

type ImportPresetEntry = {
  name: string;
  status: "new" | "conflict" | "invalid";
  offset?: WeaponOffsetConfig;
};

type ImportComboEntry = {
  comboKey: string;
  presets: ImportPresetEntry[];
  newCount: number;
  conflictCount: number;
  invalidCount: number;
  included: boolean;
};

type ImportPreview = {
  fileName: string;
  combos: ImportComboEntry[];
  skippedCombos: { key: string; reason: string }[];
};

const PI = Math.PI;
const POS_RANGE = 0.5;
const ROT_RANGE = PI;
const SCALE_MIN = 0.1;
const SCALE_MAX = 3.0;
const AXIS_LABELS: Record<Axis, string> = { 0: "X", 1: "Y", 2: "Z" };

function Slider({
  label, value, min, max, step, onChange, format, color,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  color: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <span style={{ width: 18, color, fontSize: 11, fontWeight: 600 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: color }}
      />
      <span style={{ width: 56, fontSize: 10, color: "#ddd", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {format(value)}
      </span>
      <button
        onClick={() => onChange(min === SCALE_MIN ? 1 : 0)}
        title="Reset"
        style={{
          width: 18, height: 18, fontSize: 10, lineHeight: "16px",
          background: "#333", color: "#aaa", border: "1px solid #555",
          borderRadius: 3, cursor: "pointer", padding: 0,
        }}
      >
        ↺
      </button>
    </div>
  );
}

function isEditorEnabled(): boolean {
  try {
    if ((import.meta as any)?.env?.DEV) return true;
  } catch {}
  try {
    if (typeof window !== "undefined" && window.localStorage.getItem("editor.weaponTuner") === "1") {
      return true;
    }
  } catch {}
  return false;
}

export default function WeaponOffsetTuner() {
  const phase = useGame((s) => s.phase);
  const selectedCharacter = useGame((s) => s.selectedCharacter);
  const setOffset = useGame((s) => s.setSelectedCharacterWeaponOffset);

  const [open, setOpen] = useState(false);
  const gizmoHand = useWeaponTuner((s) => s.gizmoHand);
  const setGizmoHand = useWeaponTuner((s) => s.setGizmoHand);
  const gizmoMode = useWeaponTuner((s) => s.gizmoMode);
  const setGizmoMode = useWeaponTuner((s) => s.setGizmoMode);
  const hand = gizmoHand;
  const setHand = setGizmoHand;
  const [editorEnabled] = useState<boolean>(isEditorEnabled);
  const [presetsStore, setPresetsStore] = useWeaponOffsetPresetsStore();
  const [presetName, setPresetName] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const characterId = selectedCharacter.characterId;
  const equippedRight = selectedCharacter.weaponRight;
  const equippedLeft = selectedCharacter.weaponLeft;
  const comboKey = comboKeyFor(characterId, equippedRight, equippedLeft);
  const comboEntry = presetsStore[comboKey];
  const comboPresets = comboEntry?.presets ?? {};
  const activePresetName = comboEntry?.active;

  const presetNames = useMemo(() => Object.keys(comboPresets).sort(), [comboPresets]);

  const lastAutoLoadedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!editorEnabled) return;
    const entry = presetsStore[comboKey];
    const activeOffset = entry?.active ? entry.presets[entry.active] : undefined;
    const sigKey = `${comboKey}|${entry?.active ?? ""}|${
      activeOffset ? JSON.stringify(activeOffset) : ""
    }`;
    if (lastAutoLoadedKey.current === sigKey) return;
    lastAutoLoadedKey.current = sigKey;
    if (activeOffset) {
      setOffset(cloneOffset(activeOffset));
    }
  }, [comboKey, editorEnabled, presetsStore, setOffset]);

  // Turn the gizmo off whenever the panel closes so it doesn't linger on
  // screen and steal pointer events.
  useEffect(() => {
    if (!open && gizmoMode) setGizmoMode(null);
  }, [open, gizmoMode, setGizmoMode]);

  useEffect(() => {
    if (!editorEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "F10") {
        e.preventDefault();
        if (phase === "playing" || phase === "paused") setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, editorEnabled]);

  const writeOffset = useCallback(
    (next: WeaponOffsetConfig) => {
      setOffset(next);
    },
    [setOffset]
  );

  if (!editorEnabled) return null;
  if (phase !== "playing" && phase !== "paused") return null;

  const offset: WeaponOffsetConfig = selectedCharacter.weaponOffset
    ? cloneOffset(selectedCharacter.weaponOffset)
    : { ...DEFAULT_WEAPON_OFFSET };

  const handPos = hand === "right" ? offset.rightPos : offset.leftPos;
  const handRot = hand === "right" ? offset.rightRot : offset.leftRot;
  const handScl = hand === "right" ? offset.rightScale : offset.leftScale;

  const equippedThisHand = hand === "right" ? equippedRight : equippedLeft;

  const updateAxis = (group: "pos" | "rot" | "scl", axis: Axis, value: number) => {
    const next = cloneOffset(offset);
    const target =
      group === "pos"
        ? hand === "right" ? next.rightPos : next.leftPos
        : group === "rot"
          ? hand === "right" ? next.rightRot : next.leftRot
          : hand === "right" ? next.rightScale : next.leftScale;
    target[axis] = value;
    writeOffset(next);
  };

  const resetHand = () => {
    const next = cloneOffset(offset);
    if (hand === "right") {
      next.rightPos = [0, 0, 0];
      next.rightRot = [0, 0, 0];
      next.rightScale = [1, 1, 1];
    } else {
      next.leftPos = [0, 0, 0];
      next.leftRot = [0, 0, 0];
      next.leftScale = [1, 1, 1];
    }
    writeOffset(next);
  };

  const resetAll = () => writeOffset({ ...DEFAULT_WEAPON_OFFSET });

  const copyJson = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(offset, null, 2));
    } catch {}
  };

  const savePreset = (rawName: string) => {
    const name = rawName.trim();
    if (!name) return;
    const next: PresetsStore = { ...presetsStore };
    const existing = next[comboKey] ?? { presets: {}, active: undefined };
    next[comboKey] = {
      presets: { ...existing.presets, [name]: cloneOffset(offset) },
      active: name,
    };
    setPresetsStore(next);
    writePresetsStore(next);
    setPresetName("");
  };

  const loadPreset = (name: string) => {
    const entry = presetsStore[comboKey];
    const preset = entry?.presets[name];
    if (!preset) return;
    const next: PresetsStore = {
      ...presetsStore,
      [comboKey]: { presets: entry!.presets, active: name },
    };
    setPresetsStore(next);
    writePresetsStore(next);
    setOffset(cloneOffset(preset));
  };

  const isPlainRecord = (v: unknown): v is Record<string, unknown> => {
    if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
  };

  const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
  const isSafeKey = (k: string): boolean =>
    typeof k === "string" && k.length > 0 && !UNSAFE_KEYS.has(k);

  const isValidOffset = (o: unknown): o is WeaponOffsetConfig => {
    if (!isPlainRecord(o)) return false;
    const keys: (keyof WeaponOffsetConfig)[] = [
      "rightPos", "rightRot", "rightScale", "leftPos", "leftRot", "leftScale",
    ];
    for (const k of keys) {
      const v = o[k];
      if (!Array.isArray(v) || v.length !== 3) return false;
      if (!v.every((n: unknown) => typeof n === "number" && Number.isFinite(n))) return false;
    }
    return true;
  };

  const exportPresets = () => {
    try {
      if (Object.keys(presetsStore).length === 0) {
        alert("No presets to export.");
        return;
      }
      const data = JSON.stringify(presetsStore, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `weapon-offset-presets-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[WeaponOffsetTuner] Failed to export presets", err);
      alert("Export failed. See console for details.");
    }
  };

  const buildImportPreview = (
    parsed: Record<string, unknown>,
    fileName: string,
    currentStore: PresetsStore,
  ): ImportPreview => {
    const combos: ImportComboEntry[] = [];
    const skippedCombos: { key: string; reason: string }[] = [];
    for (const comboK of Object.keys(parsed)) {
      if (!isSafeKey(comboK)) {
        skippedCombos.push({ key: comboK, reason: "unsafe key" });
        continue;
      }
      const comboVal: unknown = parsed[comboK];
      if (!isPlainRecord(comboVal)) {
        skippedCombos.push({ key: comboK, reason: "not an object" });
        continue;
      }
      const inPresets: unknown = comboVal.presets;
      if (!isPlainRecord(inPresets)) {
        skippedCombos.push({ key: comboK, reason: "missing presets map" });
        continue;
      }
      const existing = currentStore[comboK]?.presets ?? {};
      const presets: ImportPresetEntry[] = [];
      let newCount = 0;
      let conflictCount = 0;
      let invalidCount = 0;
      for (const name of Object.keys(inPresets)) {
        if (!isSafeKey(name)) {
          presets.push({ name: name || "(unnamed)", status: "invalid" });
          invalidCount++;
          continue;
        }
        const off: unknown = inPresets[name];
        if (!isValidOffset(off)) {
          presets.push({ name, status: "invalid" });
          invalidCount++;
          continue;
        }
        const isConflict = Object.prototype.hasOwnProperty.call(existing, name);
        if (isConflict) {
          presets.push({ name, status: "conflict", offset: off });
          conflictCount++;
        } else {
          presets.push({ name, status: "new", offset: off });
          newCount++;
        }
      }
      presets.sort((a, b) => a.name.localeCompare(b.name));
      combos.push({
        comboKey: comboK,
        presets,
        newCount,
        conflictCount,
        invalidCount,
        included: newCount + conflictCount > 0,
      });
    }
    combos.sort((a, b) => a.comboKey.localeCompare(b.comboKey));
    return { fileName, combos, skippedCombos };
  };

  const importPresetsFromFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!isPlainRecord(parsed)) {
        alert("Import failed: file does not contain a preset library.");
        return;
      }
      const preview = buildImportPreview(parsed, file.name, presetsStore);
      if (preview.combos.length === 0 && preview.skippedCombos.length === 0) {
        alert("Import failed: file contains no preset combos.");
        return;
      }
      setImportPreview(preview);
    } catch (err) {
      console.error("[WeaponOffsetTuner] Failed to import presets", err);
      alert("Import failed: invalid JSON file.");
    }
  };

  const onImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void importPresetsFromFile(file);
    if (importFileInputRef.current) importFileInputRef.current.value = "";
  };

  const togglePreviewCombo = (comboKey: string) => {
    setImportPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        combos: prev.combos.map((c) =>
          c.comboKey === comboKey ? { ...c, included: !c.included } : c,
        ),
      };
    });
  };

  const setAllPreviewCombos = (included: boolean) => {
    setImportPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        combos: prev.combos.map((c) =>
          c.newCount + c.conflictCount > 0 ? { ...c, included } : c,
        ),
      };
    });
  };

  const commitImport = (preview: ImportPreview) => {
    const merged: PresetsStore = { ...presetsStore };
    let imported = 0;
    let overwritten = 0;
    let skipped = 0;
    for (const combo of preview.combos) {
      if (!combo.included) continue;
      const currentEntry = merged[combo.comboKey] ?? { presets: {}, active: undefined };
      const nextPresets: Record<string, WeaponOffsetConfig> = { ...currentEntry.presets };
      for (const p of combo.presets) {
        if (p.status === "invalid" || !p.offset) {
          skipped++;
          continue;
        }
        if (p.status === "conflict") overwritten++;
        else imported++;
        nextPresets[p.name] = cloneOffset(p.offset);
      }
      merged[combo.comboKey] = {
        presets: nextPresets,
        active: currentEntry.active,
      };
    }
    setPresetsStore(merged);
    writePresetsStore(merged);
    setImportPreview(null);
    const parts: string[] = [];
    if (imported) parts.push(`${imported} new preset(s) added`);
    if (overwritten) parts.push(`${overwritten} preset(s) overwritten`);
    if (skipped) parts.push(`${skipped} skipped (invalid)`);
    if (parts.length === 0) parts.push("No presets were imported.");
    alert(`Import complete:\n${parts.join("\n")}`);
  };

  const deletePreset = (name: string) => {
    const entry = presetsStore[comboKey];
    if (!entry?.presets[name]) return;
    const { [name]: _removed, ...rest } = entry.presets;
    const next: PresetsStore = { ...presetsStore };
    if (Object.keys(rest).length === 0) {
      delete next[comboKey];
    } else {
      next[comboKey] = {
        presets: rest,
        active: entry.active === name ? undefined : entry.active,
      };
    }
    setPresetsStore(next);
    writePresetsStore(next);
  };

  const toggleBtn = (
    <button
      onClick={() => setOpen((v) => !v)}
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 9999,
        background: "rgba(20,20,28,0.85)",
        color: "#c9950a",
        border: "1px solid #c9950a",
        borderRadius: 4,
        padding: "6px 10px",
        fontSize: 11,
        fontFamily: "Inter, sans-serif",
        cursor: "pointer",
      }}
      title="Toggle Weapon Offset Tuner (F10)"
    >
      {open ? "Close Tuner" : "Weapon Tuner (F10)"}
    </button>
  );

  if (!open) return toggleBtn;

  return (
    <>
      {toggleBtn}
      <div
        style={{
          position: "fixed",
          right: 12,
          bottom: 52,
          width: 320,
          maxHeight: "70vh",
          overflowY: "auto",
          zIndex: 9998,
          background: "rgba(15,17,22,0.94)",
          border: "1px solid #c9950a",
          borderRadius: 6,
          padding: 12,
          color: "#ddd",
          fontFamily: "Inter, sans-serif",
          boxShadow: "0 6px 24px rgba(0,0,0,0.6)",
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#c9950a" }}>Weapon Offset Tuner</div>
          <div style={{ fontSize: 9, color: "#888" }}>F10 to toggle</div>
        </div>

        <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6 }}>
          Char: <span style={{ color: "#fff" }}>{selectedCharacter.name}</span>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {(["right", "left"] as Hand[]).map((h) => {
            const eq = h === "right" ? equippedRight : equippedLeft;
            const isActive = hand === h;
            return (
              <button
                key={h}
                onClick={() => setHand(h)}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  background: isActive ? "#c9950a" : "rgba(60,60,70,0.6)",
                  color: isActive ? "#1a1a1a" : "#ddd",
                  border: "1px solid " + (isActive ? "#c9950a" : "#444"),
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {h === "right" ? "Right" : "Left"} Hand
                <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.85, marginTop: 2 }}>
                  {eq ? eq : "(empty)"}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {([
            { mode: null, label: "Off", color: "#888" },
            { mode: "translate", label: "Move", color: "#66bb6a" },
            { mode: "rotate", label: "Rotate", color: "#42a5f5" },
            { mode: "scale", label: "Scale", color: "#ab47bc" },
          ] as { mode: GizmoMode; label: string; color: string }[]).map(({ mode, label, color }) => {
            const active = gizmoMode === mode;
            return (
              <button
                key={String(mode)}
                onClick={() => setGizmoMode(mode)}
                style={{
                  flex: 1,
                  padding: "5px 4px",
                  background: active ? color : "rgba(60,60,70,0.6)",
                  color: active ? "#1a1a1a" : "#ddd",
                  border: "1px solid " + (active ? color : "#444"),
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginBottom: 8,
            padding: 8,
            background: "rgba(0,0,0,0.25)",
            border: "1px solid #333",
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: 10, color: "#c9950a", fontWeight: 600, marginBottom: 4 }}>
            Presets
          </div>
          <div style={{ fontSize: 9, color: "#888", marginBottom: 6 }}>
            Combo: <span style={{ color: "#bbb" }}>{selectedCharacter.name || characterId}</span>
            {" / "}
            <span style={{ color: "#bbb" }}>{equippedRight || "none"}</span>
            {" + "}
            <span style={{ color: "#bbb" }}>{equippedLeft || "none"}</span>
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            <select
              value={activePresetName ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v) loadPreset(v);
              }}
              style={{
                flex: 1,
                fontSize: 11,
                padding: "4px 6px",
                background: "rgba(40,40,50,0.9)",
                color: "#ddd",
                border: "1px solid #555",
                borderRadius: 3,
              }}
            >
              <option value="">
                {presetNames.length === 0 ? "(no presets saved)" : "-- select preset --"}
              </option>
              {presetNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              onClick={() => activePresetName && deletePreset(activePresetName)}
              disabled={!activePresetName}
              title="Delete active preset"
              style={{
                width: 26,
                fontSize: 11,
                background: activePresetName ? "rgba(80,30,30,0.6)" : "rgba(50,50,50,0.4)",
                color: activePresetName ? "#ffaaaa" : "#666",
                border: "1px solid " + (activePresetName ? "#884" : "#444"),
                borderRadius: 3,
                cursor: activePresetName ? "pointer" : "not-allowed",
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              type="text"
              value={presetName}
              placeholder="Name (e.g. Knight + Sword)"
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") savePreset(presetName);
              }}
              style={{
                flex: 1,
                fontSize: 11,
                padding: "4px 6px",
                background: "rgba(40,40,50,0.9)",
                color: "#ddd",
                border: "1px solid #555",
                borderRadius: 3,
              }}
            />
            <button
              onClick={() => savePreset(presetName)}
              disabled={!presetName.trim()}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                background: presetName.trim() ? "rgba(40,60,40,0.7)" : "rgba(50,50,50,0.4)",
                color: presetName.trim() ? "#aaffaa" : "#666",
                border: "1px solid " + (presetName.trim() ? "#487" : "#444"),
                borderRadius: 3,
                cursor: presetName.trim() ? "pointer" : "not-allowed",
              }}
            >
              Save
            </button>
          </div>
          {activePresetName && (
            <div style={{ fontSize: 9, color: "#888", marginTop: 4 }}>
              Active: <span style={{ color: "#c9950a" }}>{activePresetName}</span>
              {" — auto-loads when this combo is selected."}
            </div>
          )}
          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
            <button
              onClick={exportPresets}
              title="Download all saved presets as a JSON file"
              style={{
                flex: 1,
                fontSize: 10,
                padding: "4px 6px",
                background: "rgba(40,50,70,0.6)",
                color: "#aac8ff",
                border: "1px solid #467",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Export Presets
            </button>
            <button
              onClick={() => importFileInputRef.current?.click()}
              title="Pick a JSON file — opens a preview before anything is added to your library"
              style={{
                flex: 1,
                fontSize: 10,
                padding: "4px 6px",
                background: "rgba(50,40,70,0.6)",
                color: "#d0aaff",
                border: "1px solid #647",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              Import Presets
            </button>
            <input
              ref={importFileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={onImportFileChange}
            />
          </div>
        </div>

        {!equippedThisHand || equippedThisHand === "fists" ? (
          <div style={{ fontSize: 11, color: "#888", padding: 8, background: "rgba(0,0,0,0.3)", borderRadius: 4, marginBottom: 8 }}>
            No weapon equipped in this hand. Sliders still write to the offset, applied when a weapon is equipped.
          </div>
        ) : null}

        <div style={{ fontSize: 11, color: "#66bb6a", marginTop: 4, marginBottom: 4, fontWeight: 600 }}>Position (m)</div>
        {([0, 1, 2] as Axis[]).map((a) => (
          <Slider
            key={"p" + a}
            label={AXIS_LABELS[a]}
            value={handPos[a]}
            min={-POS_RANGE}
            max={POS_RANGE}
            step={0.001}
            color="#66bb6a"
            onChange={(v) => updateAxis("pos", a, v)}
            format={(v) => `${(v * 100).toFixed(1)}cm`}
          />
        ))}

        <div style={{ fontSize: 11, color: "#42a5f5", marginTop: 8, marginBottom: 4, fontWeight: 600 }}>Rotation</div>
        {([0, 1, 2] as Axis[]).map((a) => (
          <Slider
            key={"r" + a}
            label={AXIS_LABELS[a]}
            value={handRot[a]}
            min={-ROT_RANGE}
            max={ROT_RANGE}
            step={0.01}
            color="#42a5f5"
            onChange={(v) => updateAxis("rot", a, v)}
            format={(v) => `${((v * 180) / PI).toFixed(1)}°`}
          />
        ))}

        <div style={{ fontSize: 11, color: "#ab47bc", marginTop: 8, marginBottom: 4, fontWeight: 600 }}>Scale</div>
        {([0, 1, 2] as Axis[]).map((a) => (
          <Slider
            key={"s" + a}
            label={AXIS_LABELS[a]}
            value={handScl[a]}
            min={SCALE_MIN}
            max={SCALE_MAX}
            step={0.01}
            color="#ab47bc"
            onChange={(v) => updateAxis("scl", a, v)}
            format={(v) => v.toFixed(2)}
          />
        ))}

        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button
            onClick={resetHand}
            style={{
              flex: 1, padding: "6px 8px", fontSize: 11,
              background: "rgba(60,60,70,0.6)", color: "#ddd",
              border: "1px solid #555", borderRadius: 4, cursor: "pointer",
            }}
          >
            Reset {hand === "right" ? "Right" : "Left"}
          </button>
          <button
            onClick={resetAll}
            style={{
              flex: 1, padding: "6px 8px", fontSize: 11,
              background: "rgba(80,30,30,0.6)", color: "#ffaaaa",
              border: "1px solid #884", borderRadius: 4, cursor: "pointer",
            }}
          >
            Reset Both
          </button>
          <button
            onClick={copyJson}
            style={{
              flex: 1, padding: "6px 8px", fontSize: 11,
              background: "rgba(40,60,40,0.6)", color: "#aaffaa",
              border: "1px solid #487", borderRadius: 4, cursor: "pointer",
            }}
            title="Copy current offset JSON to clipboard"
          >
            Copy JSON
          </button>
        </div>

        <div style={{ marginTop: 8, fontSize: 9, color: "#666", lineHeight: 1.4 }}>
          Edits persist to your character. Re-open Character Select to see the saved values applied to the form.
        </div>
      </div>
      {importPreview && (
        <ImportPreviewModal
          preview={importPreview}
          onCancel={() => setImportPreview(null)}
          onConfirm={() => commitImport(importPreview)}
          onToggleCombo={togglePreviewCombo}
          onSetAll={setAllPreviewCombos}
        />
      )}
    </>
  );
}

function ImportPreviewModal({
  preview,
  onCancel,
  onConfirm,
  onToggleCombo,
  onSetAll,
}: {
  preview: ImportPreview;
  onCancel: () => void;
  onConfirm: () => void;
  onToggleCombo: (comboKey: string) => void;
  onSetAll: (included: boolean) => void;
}) {
  const totals = preview.combos.reduce(
    (acc, c) => {
      if (!c.included) return acc;
      return {
        newCount: acc.newCount + c.newCount,
        conflictCount: acc.conflictCount + c.conflictCount,
        invalidCount: acc.invalidCount + c.invalidCount,
      };
    },
    { newCount: 0, conflictCount: 0, invalidCount: 0 },
  );
  const importableCombos = preview.combos.filter((c) => c.newCount + c.conflictCount > 0);
  const allIncluded = importableCombos.length > 0 && importableCombos.every((c) => c.included);
  const noneIncluded = importableCombos.every((c) => !c.included);
  const willImportAnything = totals.newCount + totals.conflictCount > 0;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          maxHeight: "min(80vh, 720px)",
          display: "flex",
          flexDirection: "column",
          background: "rgba(15,17,22,0.98)",
          border: "1px solid #c9950a",
          borderRadius: 8,
          color: "#ddd",
          boxShadow: "0 12px 48px rgba(0,0,0,0.7)",
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid #333",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#c9950a" }}>
              Import Presets — Preview
            </div>
            <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
              {preview.fileName}
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#aaa", textAlign: "right" }}>
            <div>
              <span style={{ color: "#aaffaa" }}>{totals.newCount} new</span>
              {" · "}
              <span style={{ color: "#ffd27a" }}>{totals.conflictCount} overwrite</span>
              {" · "}
              <span style={{ color: "#ff8a8a" }}>{totals.invalidCount} invalid</span>
            </div>
            <div style={{ color: "#666", marginTop: 2 }}>(in selected combos)</div>
          </div>
        </div>

        <div
          style={{
            padding: "8px 14px",
            borderBottom: "1px solid #2a2a2a",
            fontSize: 10,
            color: "#aaa",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            {preview.combos.length} combo{preview.combos.length === 1 ? "" : "s"} found
            {preview.skippedCombos.length > 0
              ? ` · ${preview.skippedCombos.length} unrecognized`
              : ""}
          </span>
          {importableCombos.length > 1 && (
            <button
              onClick={() => onSetAll(!allIncluded)}
              style={{
                fontSize: 10,
                padding: "3px 8px",
                background: "rgba(40,40,50,0.9)",
                color: "#ddd",
                border: "1px solid #555",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              {allIncluded ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>

        <div
          style={{
            padding: "6px 14px 8px",
            fontSize: 10,
            color: "#ffd27a",
            background: "rgba(60,45,15,0.25)",
            borderBottom: "1px solid #2a2a2a",
            lineHeight: 1.4,
          }}
        >
          Anything tagged <strong>OVERWRITE</strong> will replace your saved
          preset of the same name when you click Import. Uncheck a combo or
          cancel to keep your local copies.
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px" }}>
          {preview.combos.length === 0 && (
            <div style={{ fontSize: 11, color: "#888", padding: "12px 0" }}>
              No valid combos found in this file.
            </div>
          )}
          {preview.combos.map((combo) => {
            const importable = combo.newCount + combo.conflictCount > 0;
            return (
              <div
                key={combo.comboKey}
                style={{
                  marginBottom: 8,
                  padding: 8,
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid #2c2c2c",
                  borderRadius: 4,
                  opacity: importable ? 1 : 0.55,
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: importable ? "pointer" : "default",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={combo.included && importable}
                    disabled={!importable}
                    onChange={() => onToggleCombo(combo.comboKey)}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#ddd",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={combo.comboKey}
                    >
                      {combo.comboKey}
                    </div>
                    <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>
                      <span style={{ color: "#aaffaa" }}>{combo.newCount} new</span>
                      {" · "}
                      <span style={{ color: "#ffd27a" }}>
                        {combo.conflictCount} overwrite
                      </span>
                      {combo.invalidCount > 0 && (
                        <>
                          {" · "}
                          <span style={{ color: "#ff8a8a" }}>
                            {combo.invalidCount} invalid
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </label>
                {combo.presets.length > 0 && (
                  <ul
                    style={{
                      margin: "6px 0 0 28px",
                      padding: 0,
                      listStyle: "none",
                      fontSize: 10,
                      lineHeight: 1.5,
                    }}
                  >
                    {combo.presets.map((p, idx) => {
                      const color =
                        p.status === "new"
                          ? "#aaffaa"
                          : p.status === "conflict"
                            ? "#ffd27a"
                            : "#ff8a8a";
                      const tag =
                        p.status === "new"
                          ? "NEW"
                          : p.status === "conflict"
                            ? "OVERWRITE"
                            : "INVALID";
                      return (
                        <li key={`${p.name}-${idx}`} style={{ color: "#ccc" }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: 64,
                              fontSize: 9,
                              fontWeight: 600,
                              color,
                            }}
                          >
                            {tag}
                          </span>
                          <span
                            style={{
                              textDecoration:
                                p.status === "invalid" ? "line-through" : undefined,
                            }}
                          >
                            {p.name}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
          {preview.skippedCombos.length > 0 && (
            <div
              style={{
                marginTop: 4,
                padding: 8,
                background: "rgba(40,20,20,0.3)",
                border: "1px solid #4a2a2a",
                borderRadius: 4,
                fontSize: 10,
                color: "#ff8a8a",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Unrecognized combos (will be skipped):
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {preview.skippedCombos.map((s, idx) => (
                  <li key={`${s.key}-${idx}`} style={{ color: "#ddb" }}>
                    <span style={{ color: "#ddd" }}>{s.key || "(empty)"}</span>
                    <span style={{ color: "#aa7777" }}> — {s.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid #333",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              fontSize: 11,
              padding: "6px 14px",
              background: "rgba(60,60,70,0.6)",
              color: "#ddd",
              border: "1px solid #555",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!willImportAnything || noneIncluded}
            title={
              !willImportAnything
                ? "Nothing to import"
                : noneIncluded
                  ? "Select at least one combo"
                  : "Import the selected combos"
            }
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "6px 16px",
              background:
                willImportAnything && !noneIncluded
                  ? "#c9950a"
                  : "rgba(80,70,40,0.4)",
              color:
                willImportAnything && !noneIncluded ? "#1a1a1a" : "#888",
              border:
                "1px solid " +
                (willImportAnything && !noneIncluded ? "#c9950a" : "#555"),
              borderRadius: 4,
              cursor:
                willImportAnything && !noneIncluded ? "pointer" : "not-allowed",
            }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
