import { useMemo, useState } from "react";
import { useEditorStore, type SceneObject } from "./EditorStore";
import { getAllPrefabs, getPrefabById, type ColliderShape, type PhysicsType } from "./PrefabRegistry";
import { NPC_FACTION_COLORS, isNPCPrefab } from "./NPCPrefabRegistry";

function VectorInput({ label, value, onChange, colors }: {
  label: string;
  value: [number, number, number];
  onChange: (v: [number, number, number]) => void;
  colors?: string[];
}) {
  const labels = ["X", "Y", "Z"];
  const c = colors || ["#f85149", "#7ee787", "#58a6ff"];

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ color: "#8b949e", fontSize: 10, fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 2 }}>
            <span style={{
              color: c[i],
              fontSize: 9,
              fontWeight: 700,
              width: 14,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `${c[i]}15`,
              borderRadius: 2,
            }}>{labels[i]}</span>
            <input
              type="number"
              step={0.1}
              value={Number(value[i].toFixed(3))}
              onChange={(e) => {
                const v: [number, number, number] = [...value];
                v[i] = parseFloat(e.target.value) || 0;
                onChange(v);
              }}
              style={{
                width: "100%",
                background: "#0d1117",
                border: `1px solid ${c[i]}30`,
                borderRadius: 4,
                color: "#c9d1d9",
                padding: "4px 6px",
                fontSize: 11,
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "monospace",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = c[i]; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = `${c[i]}30`; }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ color: "#8b949e", fontSize: 10, fontWeight: 600, textTransform: "uppercase", flex: 1 }}>
        {label}
      </div>
      <div style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        background: value,
        border: "2px solid #30363d",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            position: "absolute",
            inset: -4,
            width: "calc(100% + 8px)",
            height: "calc(100% + 8px)",
            cursor: "pointer",
            opacity: 0,
          }}
        />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 70,
          background: "#0d1117",
          border: "1px solid #30363d",
          borderRadius: 4,
          color: "#c9d1d9",
          padding: "4px 6px",
          fontSize: 11,
          outline: "none",
          fontFamily: "monospace",
        }}
      />
    </div>
  );
}

function NumberInput({ label, value, onChange, min, max, step = 0.1, suffix }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ color: "#8b949e", fontSize: 10, fontWeight: 600, textTransform: "uppercase", flex: 1 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type="number"
          value={Number(value.toFixed(3))}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{
            width: 70,
            background: "#0d1117",
            border: "1px solid #30363d",
            borderRadius: 4,
            color: "#c9d1d9",
            padding: "4px 6px",
            fontSize: 11,
            outline: "none",
            fontFamily: "monospace",
          }}
        />
        {suffix && <span style={{ color: "#484f58", fontSize: 9 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function SliderInput({ label, value, onChange, min = 0, max = 1, step = 0.01 }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <div style={{ color: "#8b949e", fontSize: 10, fontWeight: 600, textTransform: "uppercase", flex: 1 }}>
          {label}
        </div>
        <span style={{ color: "#c9d1d9", fontSize: 10, fontFamily: "monospace" }}>{value.toFixed(2)}</span>
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
          height: 4,
          appearance: "none",
          background: "#21262d",
          borderRadius: 2,
          cursor: "pointer",
          accentColor: "#58a6ff",
        }}
      />
    </div>
  );
}

function CheckInput({ label, value, onChange }: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ color: "#8b949e", fontSize: 10, fontWeight: 600, textTransform: "uppercase", flex: 1 }}>
        {label}
      </div>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 32,
          height: 16,
          borderRadius: 8,
          background: value ? "#1f6feb" : "#21262d",
          cursor: "pointer",
          position: "relative",
          transition: "background 0.15s",
          border: `1px solid ${value ? "#58a6ff44" : "#30363d"}`,
        }}
      >
        <div style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          background: value ? "#fff" : "#484f58",
          position: "absolute",
          top: 1,
          left: value ? 17 : 1,
          transition: "left 0.15s",
        }} />
      </div>
    </div>
  );
}

function SelectInput({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ color: "#8b949e", fontSize: 10, fontWeight: 600, textTransform: "uppercase", flex: 1 }}>
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 90,
          background: "#0d1117",
          border: "1px solid #30363d",
          borderRadius: 4,
          color: "#c9d1d9",
          padding: "3px 4px",
          fontSize: 10,
          outline: "none",
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

function SectionHeader({ label, color = "#58a6ff", icon }: { label: string; color?: string; icon?: string }) {
  return (
    <div style={{
      color,
      fontSize: 10,
      fontWeight: 700,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 1,
      display: "flex",
      alignItems: "center",
      gap: 6,
      paddingBottom: 4,
      borderBottom: `1px solid ${color}20`,
    }}>
      {icon && <span style={{ fontSize: 12 }}>{icon}</span>}
      {label}
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#161b22",
      borderRadius: 6,
      border: "1px solid #21262d",
      padding: 10,
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function TransformSection({ obj }: { obj: any }) {
  const updateObject = useEditorStore((s) => s.updateObject);

  return (
    <SectionCard>
      <SectionHeader label="Transform" icon="+" />
      <VectorInput
        label="Position"
        value={obj.position}
        onChange={(v) => updateObject(obj.id, { position: v })}
      />
      <VectorInput
        label="Rotation"
        value={obj.rotation}
        onChange={(v) => updateObject(obj.id, { rotation: v })}
      />
      <VectorInput
        label="Scale"
        value={obj.scale}
        onChange={(v) => updateObject(obj.id, { scale: v })}
      />
    </SectionCard>
  );
}

function LightPropertiesSection({ obj }: { obj: any }) {
  const updateObject = useEditorStore((s) => s.updateObject);
  const updateProp = (key: string, value: any) => {
    updateObject(obj.id, { properties: { ...obj.properties, [key]: value } });
  };
  const { lightType } = obj.properties;

  return (
    <SectionCard>
      <SectionHeader label="Light" color="#f0883e" icon="*" />
      <SelectInput
        label="Type"
        value={lightType}
        options={[
          { label: "Point", value: "point" },
          { label: "Spot", value: "spot" },
          { label: "Directional", value: "directional" },
          { label: "Hemisphere", value: "hemisphere" },
          { label: "Ambient", value: "ambient" },
        ]}
        onChange={(v) => updateProp("lightType", v)}
      />
      <ColorInput label="Color" value={obj.properties.color || "#ffffff"} onChange={(v) => updateProp("color", v)} />
      {lightType === "hemisphere" && (
        <ColorInput label="Ground" value={obj.properties.groundColor || "#8b7355"} onChange={(v) => updateProp("groundColor", v)} />
      )}
      <SliderInput label="Intensity" value={obj.properties.intensity ?? 1} onChange={(v) => updateProp("intensity", v)} min={0} max={20} step={0.1} />
      {(lightType === "point" || lightType === "spot") && (
        <NumberInput label="Distance" value={obj.properties.distance ?? 20} onChange={(v) => updateProp("distance", v)} min={0} max={200} step={1} />
      )}
      {lightType === "spot" && (
        <>
          <SliderInput label="Angle" value={obj.properties.angle ?? 0.5} onChange={(v) => updateProp("angle", v)} min={0.01} max={Math.PI / 2} step={0.01} />
          <SliderInput label="Penumbra" value={obj.properties.penumbra ?? 0} onChange={(v) => updateProp("penumbra", v)} min={0} max={1} step={0.01} />
        </>
      )}
      {lightType !== "ambient" && lightType !== "hemisphere" && (
        <CheckInput label="Cast Shadow" value={obj.properties.castShadow ?? false} onChange={(v) => updateProp("castShadow", v)} />
      )}
    </SectionCard>
  );
}

function MaterialSection({ obj }: { obj: any }) {
  const updateObject = useEditorStore((s) => s.updateObject);
  const updateProp = (key: string, value: any) => {
    updateObject(obj.id, { properties: { ...obj.properties, [key]: value } });
  };

  if (obj.type !== "primitive") return null;

  return (
    <SectionCard>
      <SectionHeader label="Material" color="#d2a8ff" icon="o" />
      <ColorInput label="Color" value={obj.properties.color || "#4488cc"} onChange={(v) => updateProp("color", v)} />
      <SliderInput label="Metalness" value={obj.properties.metalness ?? 0.1} onChange={(v) => updateProp("metalness", v)} />
      <SliderInput label="Roughness" value={obj.properties.roughness ?? 0.8} onChange={(v) => updateProp("roughness", v)} />
      <CheckInput label="Cast Shadow" value={true} onChange={() => {}} />
      <CheckInput label="Receive Shadow" value={obj.properties.receiveShadow ?? false} onChange={(v) => updateProp("receiveShadow", v)} />
    </SectionCard>
  );
}

function GeometrySection({ obj }: { obj: any }) {
  const updateObject = useEditorStore((s) => s.updateObject);
  const updateProp = (key: string, value: any) => {
    updateObject(obj.id, { properties: { ...obj.properties, [key]: value } });
  };

  if (obj.type !== "primitive") return null;

  const shapeLabels: Record<string, string[]> = {
    box: ["Width", "Height", "Depth"],
    sphere: ["Radius", "W Segments", "H Segments"],
    cylinder: ["Radius Top", "Radius Bottom", "Height", "Segments"],
    cone: ["Radius", "Height", "Segments"],
    torus: ["Radius", "Tube", "Radial Seg", "Tubular Seg"],
    plane: ["Width", "Height"],
  };

  const labels = shapeLabels[obj.properties.shape] || [];

  return (
    <SectionCard>
      <SectionHeader label="Geometry" color="#7ee787" icon="#" />
      <SelectInput
        label="Shape"
        value={obj.properties.shape || "box"}
        options={["box", "sphere", "cylinder", "cone", "torus", "plane"].map((s) => ({ label: s, value: s }))}
        onChange={(v) => updateProp("shape", v)}
      />
      {obj.properties.args && Array.isArray(obj.properties.args) && (
        <div style={{ marginTop: 6 }}>
          {obj.properties.args.map((val: number, i: number) => (
            <NumberInput
              key={i}
              label={labels[i] || `Arg ${i}`}
              value={val}
              onChange={(v) => {
                const newArgs = [...obj.properties.args];
                newArgs[i] = v;
                updateProp("args", newArgs);
              }}
              step={labels[i]?.includes("Seg") ? 1 : 0.1}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/**
 * Inspector card for SceneObjects of type "modelNode" — instances created
 * by `useEditorStore.importGLBAsHierarchy`. Surfaces the source GLB path
 * and the slash-separated nodePath that locates this node inside it, so
 * users can confirm what they're editing at a glance.
 */
function ModelNodeSection({ obj }: { obj: any }) {
  if (obj.type !== "modelNode") return null;
  const sourceGlb: string | undefined = obj.properties?.sourceGlb;
  const nodePath: string = obj.properties?.nodePath ?? "";
  const isMesh = obj.properties?.isMesh === true;
  const isBone = obj.properties?.isBone === true;
  const isImportedRoot = obj.properties?.isImportedRoot === true;

  return (
    <SectionCard>
      <SectionHeader label={isImportedRoot ? "Imported GLB Root" : "GLB Node"} color="#a371f7" icon="@" />
      {sourceGlb && (
        <div style={{ color: "#8b949e", fontSize: 10, marginBottom: 6, wordBreak: "break-all", fontFamily: "monospace", background: "#0d1117", padding: "6px 8px", borderRadius: 4 }}>
          {sourceGlb}
        </div>
      )}
      <div style={{ color: "#8b949e", fontSize: 10, marginBottom: 6, wordBreak: "break-all", fontFamily: "monospace", background: "#0d1117", padding: "6px 8px", borderRadius: 4 }}>
        {nodePath || "(scene root)"}
      </div>
      <div style={{ color: "#7d8590", fontSize: 10 }}>
        {isMesh ? "Mesh" : isBone ? "Bone" : "Group"}
      </div>
    </SectionCard>
  );
}

function ModelSection({ obj }: { obj: any }) {
  const updateObject = useEditorStore((s) => s.updateObject);
  const updateProp = (key: string, value: any) => {
    updateObject(obj.id, { properties: { ...obj.properties, [key]: value } });
  };

  if (obj.type !== "model") return null;

  return (
    <SectionCard>
      <SectionHeader label="Model" color="#f0883e" icon="@" />
      {obj.modelPath && (
        <div style={{ color: "#8b949e", fontSize: 10, marginBottom: 8, wordBreak: "break-all", fontFamily: "monospace", background: "#0d1117", padding: "6px 8px", borderRadius: 4 }}>
          {obj.modelPath}
        </div>
      )}
      <NumberInput label="Target Height" value={obj.properties.targetHeight ?? 2} onChange={(v) => updateProp("targetHeight", v)} min={0.1} max={100} step={0.1} suffix="m" />
    </SectionCard>
  );
}

function PrefabPickerInput({ value, onChange, filterCategory }: {
  value: string | undefined;
  onChange: (prefabId: string) => void;
  filterCategory?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allPrefabs = useMemo(() => getAllPrefabs(), []);
  const filtered = useMemo(() => {
    let list = allPrefabs;
    if (filterCategory && filterCategory !== "any") {
      list = list.filter((p) => p.category === filterCategory ||
        (filterCategory === "npc" && (p.subcategory === "npc-ally" || p.subcategory === "npc-hostile")));
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list.slice(0, 50);
  }, [allPrefabs, filterCategory, query]);

  const selected = value ? getPrefabById(value) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
      <div style={{ fontSize: 10, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5 }}>Prefab</div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: selected ? "#1a2332" : "#21262d",
          color: selected ? "#7ee787" : "#8b949e",
          border: `1px solid ${selected ? "#2d4a6e" : "#30363d"}`,
          padding: "8px 10px",
          borderRadius: 4,
          fontSize: 11,
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{selected ? selected.name : "(none — click to pick)"}</span>
        <span style={{ fontSize: 9, opacity: 0.7 }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 4, padding: 6, maxHeight: 280, overflow: "auto" }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search prefabs…"
            style={{
              width: "100%",
              background: "#161b22",
              color: "#c9d1d9",
              border: "1px solid #30363d",
              padding: "5px 8px",
              fontSize: 11,
              borderRadius: 3,
              marginBottom: 6,
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
          {filtered.length === 0 && (
            <div style={{ color: "#8b949e", fontSize: 11, padding: 8, textAlign: "center" }}>No prefabs match</div>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => { onChange(p.id); setOpen(false); setQuery(""); }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: value === p.id ? "#1f3a5e" : "transparent",
                color: "#c9d1d9",
                border: "none",
                padding: "5px 8px",
                fontSize: 11,
                cursor: "pointer",
                borderRadius: 3,
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { if (value !== p.id) e.currentTarget.style.background = "#1c2128"; }}
              onMouseLeave={(e) => { if (value !== p.id) e.currentTarget.style.background = "transparent"; }}
            >
              <div>{p.name}</div>
              <div style={{ fontSize: 9, color: "#8b949e" }}>{p.category} / {p.subcategory}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SpawnSection({ obj }: { obj: any }) {
  const updateObject = useEditorStore((s) => s.updateObject);
  const updateProp = (key: string, value: any) => {
    updateObject(obj.id, { properties: { ...obj.properties, [key]: value } });
  };

  if (obj.type !== "spawn") return null;

  const prefabId: string | undefined = obj.properties.prefabId;
  const prefab = prefabId ? getPrefabById(prefabId) : undefined;
  const npcMeta = prefab && isNPCPrefab(prefab) ? prefab : null;
  const faction: string = obj.properties.faction || npcMeta?.faction || "neutral";
  const factionColor = NPC_FACTION_COLORS[faction as keyof typeof NPC_FACTION_COLORS] || "#8b949e";
  const spawnType = obj.properties.spawnType || "npc";
  const filterCat = spawnType === "npc" ? "npc" : spawnType === "item" ? "item" : "any";

  return (
    <SectionCard>
      <SectionHeader label="Spawner" color="#7ee787" icon="^" />
      <SelectInput
        label="Spawn Type"
        value={spawnType}
        options={[
          { label: "NPC", value: "npc" },
          { label: "Item", value: "item" },
          { label: "Object", value: "object" },
          { label: "Player Start", value: "player" },
        ]}
        onChange={(v) => updateProp("spawnType", v)}
      />
      {spawnType !== "player" && (
        <PrefabPickerInput
          value={prefabId}
          filterCategory={filterCat}
          onChange={(pid) => {
            const p = getPrefabById(pid);
            const isNPC = p && isNPCPrefab(p);
            updateObject(obj.id, {
              name: p ? `Spawner: ${p.name}` : obj.name,
              properties: {
                ...obj.properties,
                prefabId: pid,
                prefabName: p?.name,
                faction: isNPC ? p.faction : (obj.properties.faction || "neutral"),
                behavior: isNPC ? p.behavior : undefined,
                wanderRadius: isNPC ? p.wanderRadius : obj.properties.wanderRadius,
                speed: isNPC ? p.speed : obj.properties.speed,
                health: isNPC ? p.health : obj.properties.health,
                attackDamage: isNPC ? p.attackDamage : obj.properties.attackDamage,
              },
            });
          }}
        />
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <NumberInput label="Count" value={obj.properties.spawnCount ?? 1} onChange={(v) => updateProp("spawnCount", Math.max(1, Math.floor(v)))} min={1} max={100} step={1} />
        <NumberInput label="Max Alive" value={obj.properties.maxAlive ?? 1} onChange={(v) => updateProp("maxAlive", Math.max(1, Math.floor(v)))} min={1} max={100} step={1} />
        <NumberInput label="Radius" value={obj.properties.spawnRadius ?? 5} onChange={(v) => updateProp("spawnRadius", v)} min={0} max={100} step={0.5} suffix="m" />
        <NumberInput label="Interval" value={obj.properties.spawnInterval ?? 0} onChange={(v) => updateProp("spawnInterval", v)} min={0} max={600} step={1} suffix="s" />
      </div>
      <CheckInput label="Spawn On Load" value={obj.properties.spawnOnLoad ?? true} onChange={(v) => updateProp("spawnOnLoad", v)} />
      <CheckInput label="Auto Respawn" value={obj.properties.autoRespawn ?? false} onChange={(v) => updateProp("autoRespawn", v)} />
      {spawnType === "npc" && (
        <SelectInput
          label="Faction"
          value={faction}
          options={[
            { label: "Ally", value: "ally" },
            { label: "Neutral", value: "neutral" },
            { label: "Hostile", value: "hostile" },
          ]}
          onChange={(v) => updateProp("faction", v)}
        />
      )}
      <div style={{
        marginTop: 8,
        padding: "8px 10px",
        background: "#0d1117",
        border: `1px solid ${factionColor}`,
        borderRadius: 4,
        fontSize: 10,
        color: "#c9d1d9",
      }}>
        <div style={{ color: factionColor, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Will Spawn</div>
        {prefab ? (
          <>
            <div><b>{prefab.name}</b> × {obj.properties.spawnCount ?? 1}</div>
            <div style={{ color: "#8b949e", marginTop: 2 }}>
              within {obj.properties.spawnRadius ?? 5}m
              {(obj.properties.spawnInterval ?? 0) > 0 && `, every ${obj.properties.spawnInterval}s`}
              {obj.properties.autoRespawn && ", auto-respawn"}
            </div>
          </>
        ) : (
          <div style={{ color: "#8b949e" }}>(no prefab selected)</div>
        )}
      </div>
    </SectionCard>
  );
}

function TriggerSection({ obj }: { obj: any }) {
  const updateObject = useEditorStore((s) => s.updateObject);
  const updateProp = (key: string, value: any) => {
    updateObject(obj.id, { properties: { ...obj.properties, [key]: value } });
  };

  if (obj.type !== "trigger") return null;

  return (
    <SectionCard>
      <SectionHeader label="Trigger Zone" color="#f0883e" icon="!" />
      <SelectInput
        label="Type"
        value={obj.properties.triggerType || "area"}
        options={[
          { label: "Area", value: "area" },
          { label: "Proximity", value: "proximity" },
          { label: "Interaction", value: "interaction" },
        ]}
        onChange={(v) => updateProp("triggerType", v)}
      />
      <NumberInput label="Radius" value={obj.properties.radius ?? 3} onChange={(v) => updateProp("radius", v)} min={0} max={100} step={0.5} />
      <CheckInput label="One Shot" value={obj.properties.oneShot ?? false} onChange={(v) => updateProp("oneShot", v)} />
    </SectionCard>
  );
}

function ColliderSection({ obj }: { obj: SceneObject }) {
  const updateObject = useEditorStore((s) => s.updateObject);
  if (!obj.collider && obj.type !== "prefab") return null;

  const collider = obj.collider || { shape: "none" as ColliderShape, size: [1, 1, 1] as [number, number, number], offset: [0, 0, 0] as [number, number, number], isTrigger: false };

  const updateCollider = (key: string, value: any) => {
    updateObject(obj.id, { collider: { ...collider, [key]: value } });
  };

  return (
    <SectionCard>
      <SectionHeader label="Collider" color="#56d364" icon="[" />
      <SelectInput
        label="Shape"
        value={collider.shape}
        options={[
          { label: "None", value: "none" },
          { label: "Box", value: "box" },
          { label: "Sphere", value: "sphere" },
          { label: "Capsule", value: "capsule" },
          { label: "Mesh", value: "mesh" },
        ]}
        onChange={(v) => updateCollider("shape", v)}
      />
      {collider.shape !== "none" && (
        <>
          <VectorInput
            label="Size"
            value={collider.size}
            onChange={(v) => updateCollider("size", v)}
            colors={["#56d364", "#56d364", "#56d364"]}
          />
          <VectorInput
            label="Offset"
            value={collider.offset}
            onChange={(v) => updateCollider("offset", v)}
            colors={["#56d364", "#56d364", "#56d364"]}
          />
          <CheckInput
            label="Is Trigger"
            value={collider.isTrigger}
            onChange={(v) => updateCollider("isTrigger", v)}
          />
        </>
      )}
    </SectionCard>
  );
}

function PhysicsSection({ obj }: { obj: SceneObject }) {
  const updateObject = useEditorStore((s) => s.updateObject);
  if (obj.type !== "prefab" && obj.type !== "model") return null;

  return (
    <SectionCard>
      <SectionHeader label="Physics" color="#79c0ff" icon="~" />
      <SelectInput
        label="Type"
        value={obj.physicsType || "none"}
        options={[
          { label: "None", value: "none" },
          { label: "Static", value: "static" },
          { label: "Dynamic", value: "dynamic" },
          { label: "Kinematic", value: "kinematic" },
        ]}
        onChange={(v) => updateObject(obj.id, { physicsType: v as PhysicsType })}
      />
    </SectionCard>
  );
}

function NavMeshSection({ obj }: { obj: SceneObject }) {
  const updateObject = useEditorStore((s) => s.updateObject);
  if (obj.type !== "prefab" && obj.type !== "model" && obj.type !== "primitive") return null;

  return (
    <SectionCard>
      <SectionHeader label="NavMesh" color="#f0883e" icon="%" />
      <CheckInput
        label="Obstacle"
        value={obj.navMeshObstacle ?? false}
        onChange={(v) => updateObject(obj.id, { navMeshObstacle: v })}
      />
      {obj.navMeshObstacle && (
        <CheckInput
          label="Carve"
          value={obj.navMeshCarve ?? false}
          onChange={(v) => updateObject(obj.id, { navMeshCarve: v })}
        />
      )}
    </SectionCard>
  );
}

function PrefabInfoSection({ obj }: { obj: SceneObject }) {
  if (obj.type !== "prefab") return null;

  return (
    <SectionCard>
      <SectionHeader label="Prefab" color="#d2a8ff" icon="@" />
      {obj.modelPath && (
        <div style={{ color: "#8b949e", fontSize: 10, marginBottom: 6, wordBreak: "break-all", fontFamily: "monospace", background: "#0d1117", padding: "6px 8px", borderRadius: 4 }}>
          {obj.modelPath}
        </div>
      )}
      {obj.prefabId && (
        <div style={{ color: "#484f58", fontSize: 9, marginBottom: 6, fontFamily: "monospace" }}>
          ID: {obj.prefabId}
        </div>
      )}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
        {obj.properties.category && (
          <span style={{ background: "#d2a8ff15", color: "#d2a8ff", padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600 }}>
            {obj.properties.category}
          </span>
        )}
        {obj.properties.hasAnimations && (
          <span style={{ background: "#d2992215", color: "#d29922", padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600 }}>
            ANIMATED
          </span>
        )}
      </div>
      {obj.properties.tags && obj.properties.tags.length > 0 && (
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {obj.properties.tags.slice(0, 8).map((t: string) => (
            <span key={t} style={{ background: "#21262d", color: "#8b949e", padding: "1px 5px", borderRadius: 2, fontSize: 8 }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function QuickActions({ obj }: { obj: any }) {
  const updateObject = useEditorStore((s) => s.updateObject);
  const removeObject = useEditorStore((s) => s.removeObject);
  const duplicateObject = useEditorStore((s) => s.duplicateObject);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const resetTransform = () => {
    pushHistory();
    updateObject(obj.id, {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });
  };

  return (
    <SectionCard>
      <SectionHeader label="Actions" color="#484f58" />
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <ActionBtn label="Duplicate" color="#58a6ff" onClick={() => duplicateObject(obj.id)} />
        <ActionBtn label="Reset XForm" color="#7ee787" onClick={resetTransform} />
        <ActionBtn label="Delete" color="#f85149" onClick={() => removeObject(obj.id)} />
      </div>
    </SectionCard>
  );
}

function ParentChildSection({ obj }: { obj: SceneObject }) {
  const objects = useEditorStore((s) => s.objects);
  const setSelectedId = useEditorStore((s) => s.setSelectedId);
  const reparentObject = useEditorStore((s) => s.reparentObject);
  const ungroupObject = useEditorStore((s) => s.ungroupObject);

  const parent = useMemo(() =>
    obj.parentId ? objects.find(o => o.id === obj.parentId) : null,
    [objects, obj.parentId]
  );

  const children = useMemo(() =>
    objects.filter(o => o.parentId === obj.id),
    [objects, obj.id]
  );

  if (!parent && children.length === 0) return null;

  return (
    <div style={{ marginBottom: 8, padding: "6px 0", borderBottom: "1px solid #21262d" }}>
      <div style={{ color: "#8b949e", fontSize: 10, fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>
        Hierarchy
      </div>
      {parent && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: "#484f58" }}>Parent:</span>
          <span
            onClick={() => setSelectedId(parent.id)}
            style={{
              fontSize: 10,
              color: "#58a6ff",
              cursor: "pointer",
              textDecoration: "underline",
              textDecorationColor: "#58a6ff40",
            }}
          >{parent.name}</span>
          <span
            onClick={() => reparentObject(obj.id, null)}
            style={{
              fontSize: 8,
              color: "#f85149",
              cursor: "pointer",
              padding: "1px 4px",
              background: "#f8514910",
              borderRadius: 3,
            }}
          >Unparent</span>
        </div>
      )}
      {children.length > 0 && (
        <div>
          <span style={{ fontSize: 9, color: "#484f58" }}>Children ({children.length}):</span>
          <div style={{ marginTop: 2, maxHeight: 80, overflowY: "auto" }}>
            {children.map(c => (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{
                  fontSize: 10,
                  color: "#7ee787",
                  cursor: "pointer",
                  padding: "2px 4px",
                  borderRadius: 3,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#21262d"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >{c.name}</div>
            ))}
          </div>
          {obj.type === "group" && (
            <span
              onClick={() => ungroupObject(obj.id)}
              style={{
                fontSize: 8,
                color: "#d2a8ff",
                cursor: "pointer",
                padding: "2px 6px",
                background: "#d2a8ff10",
                borderRadius: 3,
                marginTop: 4,
                display: "inline-block",
              }}
            >Ungroup</span>
          )}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 10px",
        fontSize: 10,
        background: `${color}10`,
        border: `1px solid ${color}30`,
        borderRadius: 4,
        color,
        cursor: "pointer",
        fontWeight: 600,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${color}25`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = `${color}10`; }}
    >
      {label}
    </button>
  );
}

export default function InspectorPanel() {
  const selectedId = useEditorStore((s) => s.selectedId);
  const objects = useEditorStore((s) => s.objects);
  const updateObject = useEditorStore((s) => s.updateObject);
  const selectedIds = useEditorStore((s) => s.selectedIds);

  const obj = objects.find((o) => o.id === selectedId);

  if (!obj) {
    return (
      <div style={{ padding: 16, color: "#484f58", fontSize: 12, textAlign: "center" }}>
        <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }}>+</div>
        <div style={{ marginBottom: 8 }}>Select an object to inspect</div>
        <div style={{
          color: "#30363d",
          fontSize: 9,
          lineHeight: 1.8,
          fontFamily: "monospace",
          textAlign: "left",
          padding: "8px 12px",
          background: "#161b22",
          borderRadius: 6,
        }}>
          <div style={{ color: "#58a6ff", marginBottom: 4, fontSize: 10, fontWeight: 700 }}>SHORTCUTS</div>
          <div><span style={{ color: "#8b949e" }}>W</span> Move  <span style={{ color: "#8b949e" }}>E</span> Rotate  <span style={{ color: "#8b949e" }}>R</span> Scale</div>
          <div><span style={{ color: "#8b949e" }}>G</span> Grid  <span style={{ color: "#8b949e" }}>H</span> Axes  <span style={{ color: "#8b949e" }}>S</span> Snap</div>
          <div><span style={{ color: "#8b949e" }}>Tab</span> World/Local  <span style={{ color: "#8b949e" }}>Del</span> Delete</div>
          <div><span style={{ color: "#8b949e" }}>Ctrl+D</span> Duplicate  <span style={{ color: "#8b949e" }}>Ctrl+Z</span> Undo</div>
          <div><span style={{ color: "#8b949e" }}>0-6</span> Camera Presets  <span style={{ color: "#8b949e" }}>I</span> Stats</div>
          <div><span style={{ color: "#8b949e" }}>Shift+Click</span> Multi-select</div>
        </div>
      </div>
    );
  }

  const TYPE_COLORS: Record<string, string> = {
    primitive: "#58a6ff",
    light: "#f0883e",
    model: "#7ee787",
    group: "#d2a8ff",
    spawn: "#44ff44",
    trigger: "#ffaa00",
    empty: "#8b949e",
    prefab: "#d2a8ff",
  };

  return (
    <div style={{ padding: 10, fontSize: 12, color: "#c9d1d9", overflowY: "auto", height: "100%" }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: TYPE_COLORS[obj.type] || "#8b949e",
          }} />
          <input
            type="text"
            value={obj.name}
            onChange={(e) => updateObject(obj.id, { name: e.target.value })}
            style={{
              flex: 1,
              background: "#0d1117",
              border: "1px solid #30363d",
              borderRadius: 4,
              color: "#f0f6fc",
              padding: "5px 8px",
              fontSize: 12,
              fontWeight: 600,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 10, color: "#484f58" }}>
          <span style={{
            background: `${TYPE_COLORS[obj.type] || "#8b949e"}15`,
            color: TYPE_COLORS[obj.type] || "#8b949e",
            padding: "1px 6px",
            borderRadius: 3,
            fontWeight: 600,
            fontSize: 9,
          }}>{obj.type}</span>
          <span style={{ fontFamily: "monospace" }}>{obj.id}</span>
        </div>
        {selectedIds.length > 1 && (
          <div style={{
            marginTop: 6,
            padding: "3px 6px",
            background: "#58a6ff15",
            borderRadius: 4,
            fontSize: 10,
            color: "#58a6ff",
          }}>
            {selectedIds.length} objects selected
          </div>
        )}
      </div>

      <CheckInput label="Visible" value={obj.visible} onChange={(v) => updateObject(obj.id, { visible: v })} />
      <CheckInput label="Locked" value={obj.locked} onChange={(v) => updateObject(obj.id, { locked: v })} />

      <ParentChildSection obj={obj} />
      <TransformSection obj={obj} />

      {obj.type === "light" && <LightPropertiesSection obj={obj} />}
      {obj.type === "primitive" && <GeometrySection obj={obj} />}
      {obj.type === "primitive" && <MaterialSection obj={obj} />}
      {obj.type === "model" && <ModelSection obj={obj} />}
      {obj.type === "modelNode" && <ModelNodeSection obj={obj} />}
      {obj.type === "prefab" && <PrefabInfoSection obj={obj} />}
      {obj.type === "spawn" && <SpawnSection obj={obj} />}
      {obj.type === "trigger" && <TriggerSection obj={obj} />}

      <ColliderSection obj={obj} />
      <PhysicsSection obj={obj} />
      <NavMeshSection obj={obj} />

      <QuickActions obj={obj} />
    </div>
  );
}
