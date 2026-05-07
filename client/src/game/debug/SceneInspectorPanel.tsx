import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  useSceneInspector,
  type InspectorObject,
  type InspectorBody,
  type InspectorAuditEntry,
} from "@/lib/stores/useSceneInspector";

/**
 * Scene Inspector DOM panel.
 *
 * F9-toggled. Sibling to `<HUD />` in GameScene. Renders 4 tabs:
 *  - Tree: scene hierarchy (indented, click to select)
 *  - Selected: details for the currently-selected object
 *  - Layers: collision-group layer counts (legend)
 *  - Audit: auto-flagged problems (NaN, missing materials, perf traps)
 *
 * Draggable header (drag anywhere on the title bar). Read-only — never
 * mutates the scene. Mounted always but returns null when not visible.
 */

const COLORS = {
  bg: "rgba(10,7,5,0.94)",
  bgInner: "rgba(20,14,10,0.85)",
  border: "rgba(201,149,10,0.45)",
  borderDim: "rgba(201,149,10,0.18)",
  text: "#d4d4d4",
  muted: "#888",
  gold: "#c9950a",
  goldBright: "#ffc94a",
  red: "#dc2626",
  yellow: "#facc15",
  blue: "#3b82f6",
  green: "#22c55e",
  rowHover: "rgba(201,149,10,0.08)",
  rowSelected: "rgba(201,149,10,0.22)",
};

type Tab = "tree" | "selected" | "layers" | "physics" | "audit";

export function SceneInspectorPanel() {
  const visible = useSceneInspector((s) => s.visible);
  const setVisible = useSceneInspector((s) => s.setVisible);
  const objects = useSceneInspector((s) => s.objects);
  const bodies = useSceneInspector((s) => s.bodies);
  const audit = useSceneInspector((s) => s.audit);
  const layerCounts = useSceneInspector((s) => s.layerCounts);
  const selectedUuid = useSceneInspector((s) => s.selectedUuid);
  const selectedBodyHandle = useSceneInspector((s) => s.selectedBodyHandle);
  const selectObject = useSceneInspector((s) => s.selectObject);
  const selectBody = useSceneInspector((s) => s.selectBody);
  const snapshotMs = useSceneInspector((s) => s.snapshotMs);

  const [tab, setTab] = useState<Tab>("tree");
  const [filter, setFilter] = useState("");
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // F9 hotkey toggles the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        useSceneInspector.getState().toggle();
      }
      if (e.key === "Escape" && useSceneInspector.getState().visible) {
        // Don't steal Escape from menus; only close if no other modal looks active.
        const someModal = document.querySelector("[data-modal-open='true']");
        if (!someModal) setVisible(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setVisible]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: Math.max(0, e.clientX - dragRef.current.dx),
        y: Math.max(0, e.clientY - dragRef.current.dy),
      });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const selectedObj = useMemo<InspectorObject | null>(
    () => objects.find((o) => o.uuid === selectedUuid) ?? null,
    [objects, selectedUuid],
  );
  const selectedBody = useMemo<InspectorBody | null>(
    () => bodies.find((b) => b.handle === selectedBodyHandle) ?? null,
    [bodies, selectedBodyHandle],
  );

  // Aggregate stats for header
  const stats = useMemo(() => {
    let meshCount = 0;
    let triCount = 0;
    for (const o of objects) {
      if (o.isMesh) {
        meshCount++;
        triCount += o.triangleCount ?? 0;
      }
    }
    return {
      objectCount: objects.length,
      meshCount,
      triCount,
      bodyCount: bodies.length,
      colliderCount: bodies.length, // 1:1 in v1 (we read first collider per body)
      auditCount: audit.length,
    };
  }, [objects, bodies, audit]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: 460,
        maxHeight: "calc(100vh - 32px)",
        zIndex: 9999,
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        boxShadow: "0 12px 36px rgba(0,0,0,0.6)",
        color: COLORS.text,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        display: "flex",
        flexDirection: "column",
        userSelect: "none",
      }}
      data-modal-open="false"
    >
      {/* Title bar / drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          padding: "8px 12px",
          borderBottom: `1px solid ${COLORS.borderDim}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "grab",
          background: "rgba(0,0,0,0.3)",
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: COLORS.gold, fontWeight: 700 }}>SCENE INSPECTOR</span>
          <span style={{ color: COLORS.muted, fontSize: 10 }}>F9 to toggle</span>
        </div>
        <button
          onClick={() => setVisible(false)}
          style={{
            background: "transparent",
            border: `1px solid ${COLORS.borderDim}`,
            color: COLORS.text,
            cursor: "pointer",
            padding: "2px 8px",
            borderRadius: 3,
            fontSize: 10,
          }}
        >
          ×
        </button>
      </div>

      {/* Stat strip */}
      <div
        style={{
          padding: "6px 12px",
          borderBottom: `1px solid ${COLORS.borderDim}`,
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 8,
          fontSize: 10,
          color: COLORS.muted,
        }}
      >
        <Stat label="objects" value={stats.objectCount} />
        <Stat label="meshes" value={stats.meshCount} />
        <Stat label="tris" value={stats.triCount.toLocaleString()} />
        <Stat label="bodies" value={stats.bodyCount} />
        <Stat label="audit" value={stats.auditCount} color={stats.auditCount ? COLORS.yellow : COLORS.muted} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.borderDim}` }}>
        {(["tree", "selected", "layers", "physics", "audit"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "6px 0",
              background: tab === t ? "rgba(201,149,10,0.12)" : "transparent",
              border: "none",
              borderBottom: tab === t ? `2px solid ${COLORS.gold}` : "2px solid transparent",
              color: tab === t ? COLORS.goldBright : COLORS.muted,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {t}
            {t === "audit" && stats.auditCount > 0 && (
              <span style={{ marginLeft: 4, color: COLORS.yellow }}>({stats.auditCount})</span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {tab === "tree" && (
          <TreeView
            objects={objects}
            filter={filter}
            setFilter={setFilter}
            selectedUuid={selectedUuid}
            onSelect={(uuid) => { selectObject(uuid); setTab("selected"); }}
          />
        )}
        {tab === "selected" && (
          <SelectedView object={selectedObj} body={selectedBody} />
        )}
        {tab === "layers" && (
          <LayersView layerCounts={layerCounts} bodies={bodies} onSelectBody={(h) => { selectBody(h); setTab("selected"); }} />
        )}
        {tab === "physics" && (
          <PhysicsView bodies={bodies} selectedHandle={selectedBodyHandle} onSelectBody={(h) => { selectBody(h); setTab("selected"); }} />
        )}
        {tab === "audit" && <AuditView audit={audit} onSelect={(uuid) => { if (uuid) { selectObject(uuid); setTab("selected"); } }} />}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "4px 12px",
          borderTop: `1px solid ${COLORS.borderDim}`,
          fontSize: 9,
          color: COLORS.muted,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>snapshot: {snapshotMs.toFixed(1)}ms (4Hz)</span>
        <span>read-only · F9 close</span>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: color ?? COLORS.text, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function TreeView({
  objects,
  filter,
  setFilter,
  selectedUuid,
  onSelect,
}: {
  objects: InspectorObject[];
  filter: string;
  setFilter: (s: string) => void;
  selectedUuid: string | null;
  onSelect: (uuid: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!filter.trim()) return objects;
    const f = filter.toLowerCase();
    return objects.filter(
      (o) => o.name.toLowerCase().includes(f) || o.type.toLowerCase().includes(f),
    );
  }, [objects, filter]);

  return (
    <>
      <div style={{ padding: "6px 12px", borderBottom: `1px solid ${COLORS.borderDim}` }}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter by name or type..."
          style={{
            width: "100%",
            background: COLORS.bgInner,
            border: `1px solid ${COLORS.borderDim}`,
            color: COLORS.text,
            padding: "4px 8px",
            borderRadius: 3,
            fontFamily: "inherit",
            fontSize: 11,
            outline: "none",
          }}
        />
      </div>
      <div style={{ overflow: "auto", maxHeight: 380 }}>
        {filtered.map((o) => (
          <div
            key={o.uuid}
            onClick={() => onSelect(o.uuid)}
            style={{
              padding: `2px 12px 2px ${12 + Math.min(o.depth, 12) * 10}px`,
              cursor: "pointer",
              background: o.uuid === selectedUuid ? COLORS.rowSelected : "transparent",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              borderLeft: o.uuid === selectedUuid ? `2px solid ${COLORS.gold}` : "2px solid transparent",
            }}
            onMouseEnter={(e) => {
              if (o.uuid !== selectedUuid) e.currentTarget.style.background = COLORS.rowHover;
            }}
            onMouseLeave={(e) => {
              if (o.uuid !== selectedUuid) e.currentTarget.style.background = "transparent";
            }}
          >
            <TypeBadge type={o.type} />
            <span style={{ color: o.isMesh ? COLORS.text : COLORS.muted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {o.name}
            </span>
            {o.childCount > 0 && (
              <span style={{ color: COLORS.muted, fontSize: 9 }}>{o.childCount}</span>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 12, color: COLORS.muted, fontStyle: "italic", fontSize: 10 }}>
            No matches.
          </div>
        )}
      </div>
    </>
  );
}

function TypeBadge({ type }: { type: string }) {
  const palette: Record<string, string> = {
    Mesh: COLORS.green,
    SkinnedMesh: COLORS.green,
    Group: COLORS.blue,
    Bone: COLORS.gold,
    Object3D: COLORS.muted,
    Scene: COLORS.gold,
    PerspectiveCamera: COLORS.yellow,
    OrthographicCamera: COLORS.yellow,
    DirectionalLight: COLORS.yellow,
    PointLight: COLORS.yellow,
    SpotLight: COLORS.yellow,
    HemisphereLight: COLORS.yellow,
    AmbientLight: COLORS.yellow,
  };
  const color = palette[type] ?? COLORS.muted;
  const short = type === "SkinnedMesh" ? "SKN" : type === "PerspectiveCamera" ? "CAM" : type.slice(0, 3).toUpperCase();
  return (
    <span style={{
      fontSize: 8,
      color,
      border: `1px solid ${color}`,
      borderRadius: 2,
      padding: "1px 3px",
      minWidth: 26,
      textAlign: "center",
      lineHeight: 1,
    }}>{short}</span>
  );
}

function SelectedView({ object, body }: { object: InspectorObject | null; body: InspectorBody | null }) {
  if (!object && !body) {
    return (
      <div style={{ padding: 16, color: COLORS.muted, fontStyle: "italic" }}>
        Nothing selected. Click an object in the Tree, Layers, or Physics tab.
      </div>
    );
  }

  return (
    <div style={{ overflow: "auto", padding: 12, fontSize: 10, lineHeight: 1.6 }}>
      {object && (
        <>
          <Section title="Object">
            <Row k="name" v={object.name} />
            <Row k="type" v={object.type} />
            <Row k="children" v={object.childCount} />
          </Section>

          <Section title="Transform (world)">
            <Row k="position" v={fmtVec(object.worldPosition)} />
            <Row k="rotation°" v={fmtVec(object.worldRotationDeg)} />
            <Row k="scale" v={fmtVec(object.worldScale)} />
          </Section>

          {object.isMesh && (
            <Section title="Mesh">
              <Row k="vertices" v={object.vertexCount?.toLocaleString() ?? 0} />
              <Row k="triangles" v={object.triangleCount?.toLocaleString() ?? 0} />
              <Row k="skeleton" v={object.hasSkeleton ? "yes" : "no"} />
              {object.bboxSize && <Row k="bbox" v={fmtVec(object.bboxSize)} />}
            </Section>
          )}

          {object.isMesh && (
            <Section title="Material">
              <Row k="name" v={object.materialName ?? "?"} />
              <Row k="type" v={object.materialType ?? "?"} />
              {object.textures && object.textures.length > 0 ? (
                <div style={{ marginTop: 4 }}>
                  {object.textures.map((t) => (
                    <div key={t.slot} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                      <span style={{ color: t.missing ? COLORS.red : COLORS.green }}>•</span>
                      <span style={{ color: COLORS.muted, minWidth: 90 }}>{t.slot}</span>
                      <span style={{ color: t.missing ? COLORS.red : COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>
                        {t.path ? t.path.split("/").pop() : "(missing)"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: COLORS.muted, fontStyle: "italic" }}>No textures.</div>
              )}
            </Section>
          )}
        </>
      )}

      {body && (
        <Section title="Physics body">
          <Row k="handle" v={`#${body.handle}`} />
          <Row k="bodyType" v={body.bodyType} />
          <Row k="collider" v={body.colliderShape} />
          <Row k="layer" v={body.layerName} color={COLORS.goldBright} />
          <Row k="membership" v={body.membership.join(", ") || "(none)"} />
          <Row k="filter" v={body.filter.join(", ") || "(none)"} />
          <Row k="sensor" v={body.isSensor ? "yes" : "no"} />
          {body.mass !== undefined && <Row k="mass" v={body.mass.toFixed(3)} />}
          <Row k="position" v={fmtVec(body.translation)} />
        </Section>
      )}
    </div>
  );
}

function LayersView({
  layerCounts,
  bodies,
  onSelectBody,
}: {
  layerCounts: Record<string, number>;
  bodies: InspectorBody[];
  onSelectBody: (h: number) => void;
}) {
  const entries = useMemo(
    () => Object.entries(layerCounts).sort((a, b) => b[1] - a[1]),
    [layerCounts],
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={{ overflow: "auto", padding: 12, fontSize: 10 }}>
      <div style={{ color: COLORS.muted, marginBottom: 6 }}>
        Collision-group bits decoded into named layers (TERRAIN=0, PLAYER=1, BUILDING=2, ENEMY=3, PROJECTILE=4, NPC=5, TRIGGER=6, RESOURCE=7, CLIMBABLE=8, LADDER=9). Combined names mean the body's collider belongs to multiple groups.
      </div>
      {entries.length === 0 && (
        <div style={{ color: COLORS.muted, fontStyle: "italic" }}>No physics bodies in scene.</div>
      )}
      {entries.map(([layer, count]) => {
        const isOpen = expanded === layer;
        return (
          <div key={layer} style={{ borderBottom: `1px solid ${COLORS.borderDim}` }}>
            <div
              onClick={() => setExpanded(isOpen ? null : layer)}
              style={{ padding: "6px 0", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <span style={{ color: COLORS.gold, fontWeight: 700 }}>{isOpen ? "▼" : "▶"} {layer}</span>
              <span style={{ color: COLORS.text }}>{count}</span>
            </div>
            {isOpen && (
              <div style={{ paddingBottom: 6 }}>
                {bodies
                  .filter((b) => b.layerName === layer)
                  .slice(0, 60)
                  .map((b) => (
                    <div
                      key={b.handle}
                      onClick={() => onSelectBody(b.handle)}
                      style={{ padding: "2px 8px", cursor: "pointer", color: COLORS.muted, display: "flex", justifyContent: "space-between" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.rowHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span>#{b.handle} {b.colliderShape} ({b.bodyType})</span>
                      <span style={{ fontFamily: "monospace" }}>{fmtVec(b.translation, 1)}</span>
                    </div>
                  ))}
                {bodies.filter((b) => b.layerName === layer).length > 60 && (
                  <div style={{ padding: "2px 8px", color: COLORS.muted, fontStyle: "italic" }}>
                    ...and {bodies.filter((b) => b.layerName === layer).length - 60} more.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PhysicsView({
  bodies,
  selectedHandle,
  onSelectBody,
}: {
  bodies: InspectorBody[];
  selectedHandle: number | null;
  onSelectBody: (h: number) => void;
}) {
  const byShape = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of bodies) m[b.colliderShape] = (m[b.colliderShape] || 0) + 1;
    return m;
  }, [bodies]);
  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of bodies) m[b.bodyType] = (m[b.bodyType] || 0) + 1;
    return m;
  }, [bodies]);

  return (
    <div style={{ overflow: "auto", padding: 12, fontSize: 10 }}>
      <Section title="By body type">
        {Object.entries(byType).map(([k, v]) => <Row key={k} k={k} v={v} />)}
      </Section>
      <Section title="By collider shape">
        {Object.entries(byShape).map(([k, v]) => <Row key={k} k={k} v={v} />)}
      </Section>
      <Section title={`All bodies (${bodies.length})`}>
        <div style={{ maxHeight: 220, overflow: "auto" }}>
          {bodies.slice(0, 200).map((b) => (
            <div
              key={b.handle}
              onClick={() => onSelectBody(b.handle)}
              style={{
                padding: "2px 4px",
                cursor: "pointer",
                background: b.handle === selectedHandle ? COLORS.rowSelected : "transparent",
                display: "grid",
                gridTemplateColumns: "32px 60px 70px 1fr 110px",
                gap: 4,
                color: COLORS.muted,
              }}
              onMouseEnter={(e) => { if (b.handle !== selectedHandle) e.currentTarget.style.background = COLORS.rowHover; }}
              onMouseLeave={(e) => { if (b.handle !== selectedHandle) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ color: COLORS.gold }}>#{b.handle}</span>
              <span>{b.bodyType}</span>
              <span>{b.colliderShape}</span>
              <span style={{ color: COLORS.text }}>{b.layerName}</span>
              <span style={{ fontFamily: "monospace" }}>{fmtVec(b.translation, 1)}</span>
            </div>
          ))}
          {bodies.length > 200 && (
            <div style={{ padding: 6, color: COLORS.muted, fontStyle: "italic" }}>
              ...and {bodies.length - 200} more (use Layers tab to filter).
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function AuditView({
  audit,
  onSelect,
}: {
  audit: InspectorAuditEntry[];
  onSelect: (uuid: string | undefined) => void;
}) {
  if (audit.length === 0) {
    return (
      <div style={{ padding: 16, color: COLORS.green, fontStyle: "italic" }}>
        No issues detected.
      </div>
    );
  }
  const sevColor: Record<string, string> = {
    error: COLORS.red,
    warn: COLORS.yellow,
    info: COLORS.muted,
  };
  return (
    <div style={{ overflow: "auto", padding: 8, fontSize: 10 }}>
      {audit.map((a) => (
        <div
          key={a.id}
          onClick={() => onSelect(a.objectUuid)}
          style={{
            padding: "4px 8px",
            cursor: a.objectUuid ? "pointer" : "default",
            borderLeft: `3px solid ${sevColor[a.severity]}`,
            marginBottom: 4,
            background: COLORS.bgInner,
            borderRadius: 2,
          }}
          onMouseEnter={(e) => { if (a.objectUuid) e.currentTarget.style.background = COLORS.rowHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.bgInner; }}
        >
          <span style={{ color: sevColor[a.severity], fontWeight: 700, marginRight: 6, textTransform: "uppercase" }}>
            {a.severity}
          </span>
          <span style={{ color: COLORS.text }}>{a.message}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        color: COLORS.gold,
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        borderBottom: `1px solid ${COLORS.borderDim}`,
        paddingBottom: 2,
        marginBottom: 4,
      }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ k, v, color }: { k: string; v: string | number; color?: string }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <span style={{ color: COLORS.muted, minWidth: 90 }}>{k}</span>
      <span style={{ color: color ?? COLORS.text, fontFamily: "monospace" }}>{v}</span>
    </div>
  );
}

function fmtVec(v: [number, number, number], digits = 2): string {
  return `[${v[0].toFixed(digits)}, ${v[1].toFixed(digits)}, ${v[2].toFixed(digits)}]`;
}
