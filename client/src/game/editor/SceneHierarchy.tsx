import { useState, useCallback, useMemo, useRef } from "react";
import { useEditorStore, type SceneObject } from "./EditorStore";
import { ALL_CHARACTER_MODELS, ALL_WEAPON_MODELS, QUATERNIUS_WEAPONS } from "../systems/ModelRegistry";
import {
  ALL_PREFABS,
  getPrefabsByCategory,
  searchPrefabs,
  getPrefabCategories,
  CATEGORY_COLORS as PREFAB_COLORS,
  CATEGORY_ICONS as PREFAB_ICONS,
  type PrefabDef,
  type PrefabCategory,
} from "./PrefabRegistry";

const TYPE_ICONS: Record<string, string> = {
  model: "M",
  modelNode: "N",
  light: "L",
  primitive: "P",
  group: "G",
  spawn: "S",
  trigger: "T",
  empty: "E",
  prefab: "F",
};

const TYPE_COLORS: Record<string, string> = {
  model: "#7ee787",
  // modelNodes get a softer green so an imported GLB tree visually
  // reads as a related-but-distinct family from regular full-asset
  // "model" entries.
  modelNode: "#56d364",
  light: "#f0883e",
  primitive: "#58a6ff",
  group: "#d2a8ff",
  spawn: "#44ff44",
  trigger: "#ffaa00",
  empty: "#8b949e",
  prefab: "#d2a8ff",
};

let dragSourceId: string | null = null;

function ObjectRow({ obj, depth = 0 }: { obj: SceneObject; depth?: number }) {
  const objects = useEditorStore((s) => s.objects);
  const selectedId = useEditorStore((s) => s.selectedId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const expandedIds = useEditorStore((s) => s.expandedIds);
  const setSelectedId = useEditorStore((s) => s.setSelectedId);
  const toggleSelectId = useEditorStore((s) => s.toggleSelectId);
  const toggleExpanded = useEditorStore((s) => s.toggleExpanded);
  const updateObject = useEditorStore((s) => s.updateObject);
  const removeObject = useEditorStore((s) => s.removeObject);
  const duplicateObject = useEditorStore((s) => s.duplicateObject);
  const reparentObject = useEditorStore((s) => s.reparentObject);
  const ungroupObject = useEditorStore((s) => s.ungroupObject);
  const isSelected = selectedId === obj.id;
  const isInSelection = selectedIds.includes(obj.id);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<"none" | "on" | "above" | "below">("none");
  const rowRef = useRef<HTMLDivElement>(null);

  const children = useMemo(() =>
    objects.filter(o => o.parentId === obj.id),
    [objects, obj.id]
  );

  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(obj.id);
  const canHaveChildren = obj.type === "group" || obj.type === "empty" || obj.type === "prefab" || obj.type === "model" || obj.type === "modelNode";

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey) {
      toggleSelectId(obj.id);
    } else {
      setSelectedId(obj.id);
    }
  }, [obj.id, setSelectedId, toggleSelectId]);

  const handleDoubleClick = useCallback(() => {
    if (hasChildren || canHaveChildren) {
      toggleExpanded(obj.id);
    }
  }, [hasChildren, canHaveChildren, obj.id, toggleExpanded]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (obj.locked) { e.preventDefault(); return; }
    dragSourceId = obj.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", obj.id);
  }, [obj.id, obj.locked]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!dragSourceId || dragSourceId === obj.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top;
    const h = rect.height;

    if (canHaveChildren && y > h * 0.3 && y < h * 0.7) {
      setDropTarget("on");
    } else {
      setDropTarget("above");
    }
  }, [obj.id, canHaveChildren]);

  const handleDragLeave = useCallback(() => {
    setDropTarget("none");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget("none");
    const sourceId = dragSourceId;
    dragSourceId = null;
    if (!sourceId || sourceId === obj.id) return;

    if (dropTarget === "on") {
      reparentObject(sourceId, obj.id);
    } else {
      reparentObject(sourceId, obj.parentId || null);
    }
  }, [obj.id, obj.parentId, dropTarget, reparentObject]);

  const handleDragEnd = useCallback(() => {
    dragSourceId = null;
    setDropTarget("none");
  }, []);

  const color = TYPE_COLORS[obj.type] || "#8b949e";

  const dropIndicatorStyle = (): React.CSSProperties => {
    if (dropTarget === "on") return { outline: "1px solid #58a6ff", outlineOffset: -1 };
    if (dropTarget === "above") return { borderTop: "2px solid #58a6ff" };
    return {};
  };

  return (
    <>
      <div
        ref={rowRef}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        draggable={!obj.locked}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 8px",
          paddingLeft: 8 + depth * 16,
          background: isSelected ? "#1f6feb25" : isInSelection ? "#1f6feb10" : "transparent",
          borderLeft: isSelected ? `2px solid #58a6ff` : isInSelection ? "2px solid #58a6ff44" : "2px solid transparent",
          cursor: obj.locked ? "default" : "grab",
          fontSize: 11,
          color: obj.visible ? "#c9d1d9" : "#484f58",
          userSelect: "none",
          transition: "background 0.1s",
          ...dropIndicatorStyle(),
        }}
        onMouseEnter={(e) => { if (!isSelected && !isInSelection) e.currentTarget.style.background = "#21262d"; }}
        onMouseLeave={(e) => { if (!isSelected && !isInSelection) e.currentTarget.style.background = "transparent"; }}
      >
        {(hasChildren || canHaveChildren) ? (
          <span
            onClick={(e) => { e.stopPropagation(); toggleExpanded(obj.id); }}
            style={{
              width: 14,
              height: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 7,
              color: hasChildren ? "#8b949e" : "#30363d",
              cursor: "pointer",
              flexShrink: 0,
              transform: isExpanded ? "rotate(90deg)" : "none",
              transition: "transform 0.15s",
            }}
          >&#9654;</span>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}

        <span style={{
          width: 16,
          height: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
          fontWeight: 900,
          color: obj.visible ? color : "#484f58",
          background: `${color}15`,
          borderRadius: 3,
          flexShrink: 0,
        }}>{TYPE_ICONS[obj.type] || "?"}</span>

        <span style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontStyle: obj.locked ? "italic" : "normal",
        }}>
          {obj.name}
        </span>

        {hasChildren && (
          <span style={{ fontSize: 8, color: "#484f58", flexShrink: 0 }}>{children.length}</span>
        )}
        {obj.locked && (
          <span style={{ fontSize: 8, color: "#f0883e", opacity: 0.6 }} title="Locked">LK</span>
        )}
        <span
          onClick={(e) => { e.stopPropagation(); updateObject(obj.id, { visible: !obj.visible }); }}
          style={{
            fontSize: 10,
            cursor: "pointer",
            color: obj.visible ? "#484f58" : "#f8514960",
            width: 16,
            textAlign: "center",
            flexShrink: 0,
          }}
          title={obj.visible ? "Hide" : "Show"}
        >
          {obj.visible ? "o" : "-"}
        </span>
      </div>

      {isExpanded && children.map(child => (
        <ObjectRow key={child.id} obj={child} depth={depth + 1} />
      ))}

      {contextMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 100 }} onClick={() => setContextMenu(null)} />
          <div style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            zIndex: 101,
            minWidth: 160,
            padding: "4px 0",
          }}>
            <CtxItem label="Select" onClick={() => { setSelectedId(obj.id); setContextMenu(null); }} />
            <CtxItem label="Duplicate" onClick={() => { duplicateObject(obj.id); setContextMenu(null); }} />
            <CtxItem label={obj.visible ? "Hide" : "Show"} onClick={() => { updateObject(obj.id, { visible: !obj.visible }); setContextMenu(null); }} />
            <CtxItem label={obj.locked ? "Unlock" : "Lock"} onClick={() => { updateObject(obj.id, { locked: !obj.locked }); setContextMenu(null); }} />
            <div style={{ borderTop: "1px solid #21262d", margin: "2px 0" }} />
            <CtxItem label={isExpanded ? "Collapse" : "Expand"} disabled={!hasChildren && !canHaveChildren} onClick={() => { toggleExpanded(obj.id); setContextMenu(null); }} />
            <CtxItem label="Expand All" disabled={!hasChildren} onClick={() => {
              const store = useEditorStore.getState();
              const descendants = store.getDescendants(obj.id);
              set_multiple_expanded([obj.id, ...descendants]);
              setContextMenu(null);
            }} />
            <div style={{ borderTop: "1px solid #21262d", margin: "2px 0" }} />
            {obj.parentId && (
              <CtxItem label="Unparent" onClick={() => { reparentObject(obj.id, null); setContextMenu(null); }} />
            )}
            {obj.type === "group" && hasChildren && (
              <CtxItem label="Ungroup" color="#d2a8ff" onClick={() => { ungroupObject(obj.id); setContextMenu(null); }} />
            )}
            <div style={{ borderTop: "1px solid #21262d", margin: "2px 0" }} />
            <CtxItem label={hasChildren ? "Delete (with children)" : "Delete"} color="#f85149" onClick={() => { removeObject(obj.id); setContextMenu(null); }} />
          </div>
        </>
      )}
    </>
  );
}

function set_multiple_expanded(ids: string[]) {
  const store = useEditorStore.getState();
  for (const id of ids) {
    store.setExpanded(id, true);
  }
}

function CtxItem({ label, onClick, color, disabled }: { label: string; onClick: () => void; color?: string; disabled?: boolean }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        padding: "5px 12px",
        fontSize: 11,
        color: disabled ? "#30363d" : color || "#c9d1d9",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "#21262d"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {label}
    </div>
  );
}

function DropZoneRoot() {
  const reparentObject = useEditorStore((s) => s.reparentObject);
  const [active, setActive] = useState(false);

  return (
    <div
      onDragOver={(e) => { if (dragSourceId) { e.preventDefault(); setActive(true); } }}
      onDragLeave={() => setActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setActive(false);
        if (dragSourceId) {
          reparentObject(dragSourceId, null);
          dragSourceId = null;
        }
      }}
      style={{
        minHeight: 30,
        borderTop: active ? "2px solid #58a6ff" : "2px solid transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: active ? "#58a6ff" : "#21262d",
        fontSize: 9,
        transition: "all 0.15s",
      }}
    >
      {active ? "Drop here to make root-level" : ""}
    </div>
  );
}

function PrefabRow({ prefab, color, onClick, onSpawnerClick }: {
  prefab: PrefabDef;
  color: string;
  onClick: () => void;
  onSpawnerClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "4px 8px",
        fontSize: 10,
        cursor: "pointer",
        color: "#8b949e",
        borderBottom: "1px solid #161b22",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#21262d"; e.currentTarget.style.color = "#c9d1d9"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#8b949e"; }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 1, background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prefab.name}</span>
      {prefab.collider.shape !== "none" && (
        <span style={{ fontSize: 7, color: "#56d364", opacity: 0.7, flexShrink: 0 }}>
          {prefab.collider.shape === "capsule" ? "CAP" : prefab.collider.shape === "box" ? "BOX" : "SPH"}
        </span>
      )}
      {prefab.hasAnimations && (
        <span style={{ fontSize: 7, color: "#d29922", opacity: 0.7, flexShrink: 0 }}>ANIM</span>
      )}
      {onSpawnerClick && (
        <button
          title="Add as Spawner"
          onClick={(e) => { e.stopPropagation(); onSpawnerClick(); }}
          style={{
            background: "transparent",
            color: "#7ee787",
            border: "1px solid #2d4a3a",
            borderRadius: 3,
            padding: "1px 5px",
            fontSize: 9,
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 600,
            flexShrink: 0,
            lineHeight: 1.3,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#1a2e22"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          S
        </button>
      )}
    </div>
  );
}

function AssetBrowser() {
  const addModelToScene = useEditorStore((s) => s.addModelToScene);
  const addPrefab = useEditorStore((s) => s.addPrefab);
  const addPrefabSpawner = useEditorStore((s) => s.addPrefabSpawner);
  const addPrimitive = useEditorStore((s) => s.addPrimitive);
  const addLight = useEditorStore((s) => s.addLight);
  const addEmpty = useEditorStore((s) => s.addEmpty);
  const addSpawnPoint = useEditorStore((s) => s.addSpawnPoint);
  const addTriggerZone = useEditorStore((s) => s.addTriggerZone);

  const [searchFilter, setSearchFilter] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>("quick");

  const categories = useMemo(() => getPrefabCategories(), []);

  const filteredPrefabs = useMemo(() => {
    if (!searchFilter.trim()) return null;
    return searchPrefabs(searchFilter);
  }, [searchFilter]);

  return (
    <div style={{ padding: 8, fontSize: 11, color: "#c9d1d9" }}>
      <input
        type="text"
        placeholder="Search prefabs & assets..."
        value={searchFilter}
        onChange={(e) => setSearchFilter(e.target.value)}
        style={{
          width: "100%",
          background: "#0d1117",
          border: "1px solid #30363d",
          borderRadius: 4,
          color: "#c9d1d9",
          padding: "6px 8px",
          fontSize: 11,
          outline: "none",
          marginBottom: 8,
          boxSizing: "border-box",
        }}
      />

      {filteredPrefabs ? (
        <div>
          <div style={{ color: "#8b949e", fontSize: 9, padding: "4px 0", marginBottom: 4 }}>
            {filteredPrefabs.length} results
          </div>
          <div style={{ maxHeight: 500, overflowY: "auto" }}>
            {filteredPrefabs.map((p) => (
              <PrefabRow
                key={p.id}
                prefab={p}
                color={PREFAB_COLORS[p.category] || "#8b949e"}
                onClick={() => addPrefab(p)}
                onSpawnerClick={() => addPrefabSpawner(p)}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <AssetCategory
            title="Quick Add"
            color="#7ee787"
            expanded={expandedCategory === "quick"}
            onToggle={() => setExpandedCategory(expandedCategory === "quick" ? null : "quick")}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "4px 0" }}>
              {["box", "sphere", "cylinder", "cone", "torus", "plane"].map((s) => (
                <AssetBtn key={s} label={s} color="#58a6ff" onClick={() => addPrimitive(s)} />
              ))}
              {["point", "spot", "directional", "hemisphere"].map((l) => (
                <AssetBtn key={l} label={`${l} light`} color="#f0883e" onClick={() => addLight(l)} />
              ))}
              <AssetBtn label="Empty" color="#8b949e" onClick={addEmpty} />
              <AssetBtn label="Spawn" color="#44ff44" onClick={addSpawnPoint} />
              <AssetBtn label="Trigger" color="#ffaa00" onClick={addTriggerZone} />
            </div>
          </AssetCategory>

          {categories.map(({ category, count, icon, color }) => (
            <AssetCategory
              key={category}
              title={`${icon} ${category.charAt(0).toUpperCase() + category.slice(1)} (${count})`}
              color={color}
              expanded={expandedCategory === category}
              onToggle={() => setExpandedCategory(expandedCategory === category ? null : category)}
            >
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {getPrefabsByCategory(category).map((p) => (
                  <PrefabRow
                    key={p.id}
                    prefab={p}
                    color={color}
                    onClick={() => addPrefab(p)}
                    onSpawnerClick={() => addPrefabSpawner(p)}
                  />
                ))}
              </div>
            </AssetCategory>
          ))}
        </>
      )}
    </div>
  );
}

function AssetCategory({ title, color, expanded, onToggle, children }: {
  title: string;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 4px",
          cursor: "pointer",
          color: expanded ? color : "#8b949e",
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          borderBottom: `1px solid ${expanded ? `${color}30` : "#21262d"}`,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = color; }}
        onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.color = "#8b949e"; }}
      >
        <span style={{ fontSize: 8, transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.1s" }}>&#9654;</span>
        {title}
      </div>
      {expanded && children}
    </div>
  );
}

function AssetBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 8px",
        fontSize: 10,
        background: `${color}10`,
        border: `1px solid ${color}25`,
        borderRadius: 3,
        color,
        cursor: "pointer",
        textTransform: "capitalize",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${color}25`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = `${color}10`; }}
    >
      {label}
    </button>
  );
}

function AssetRow({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "4px 8px",
        fontSize: 10,
        cursor: "pointer",
        color: "#8b949e",
        borderBottom: "1px solid #161b22",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#21262d"; e.currentTarget.style.color = "#c9d1d9"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#8b949e"; }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 1, background: color, flexShrink: 0 }} />
      {label}
    </div>
  );
}

function HierarchyTreeInfo({ objects }: { objects: SceneObject[] }) {
  const rootCount = objects.filter(o => !o.parentId).length;
  const groupCount = objects.filter(o => o.type === "group").length;
  const childCount = objects.filter(o => !!o.parentId).length;

  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 8, color: "#8b949e", background: "#21262d", padding: "1px 4px", borderRadius: 3 }}>
        {rootCount} root
      </span>
      {groupCount > 0 && (
        <span style={{ fontSize: 8, color: "#d2a8ff", background: "#d2a8ff15", padding: "1px 4px", borderRadius: 3 }}>
          {groupCount} grp
        </span>
      )}
      {childCount > 0 && (
        <span style={{ fontSize: 8, color: "#58a6ff", background: "#58a6ff15", padding: "1px 4px", borderRadius: 3 }}>
          {childCount} nested
        </span>
      )}
    </div>
  );
}

export default function SceneHierarchy() {
  const objects = useEditorStore((s) => s.objects);
  const leftPanel = useEditorStore((s) => s.leftPanel);
  const setLeftPanel = useEditorStore((s) => s.setLeftPanel);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const groupSelected = useEditorStore((s) => s.groupSelected);

  const rootObjects = useMemo(() =>
    objects.filter(o => !o.parentId),
    [objects]
  );

  const typeCounts = objects.reduce((acc, o) => {
    acc[o.type] = (acc[o.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{
      width: "100%",
      height: "100%",
      minWidth: 0,
      background: "#0d1117",
      borderRight: "1px solid #21262d",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex",
        borderBottom: "1px solid #21262d",
        flexShrink: 0,
      }}>
        {(["hierarchy", "assets"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setLeftPanel(tab)}
            style={{
              flex: 1,
              padding: "8px 0",
              background: "none",
              border: "none",
              borderBottom: leftPanel === tab ? "2px solid #58a6ff" : "2px solid transparent",
              color: leftPanel === tab ? "#58a6ff" : "#8b949e",
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {leftPanel === "hierarchy" ? (
          <>
            <div style={{
              padding: "6px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #21262d",
            }}>
              <span style={{ color: "#8b949e", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                Scene ({objects.length})
              </span>
              <HierarchyTreeInfo objects={objects} />
            </div>

            {selectedIds.length >= 2 && (
              <div style={{ padding: "4px 8px", borderBottom: "1px solid #21262d" }}>
                <button
                  onClick={groupSelected}
                  style={{
                    width: "100%",
                    padding: "4px 8px",
                    fontSize: 10,
                    background: "#d2a8ff10",
                    border: "1px solid #d2a8ff30",
                    borderRadius: 4,
                    color: "#d2a8ff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#d2a8ff25"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#d2a8ff10"; }}
                >
                  Group Selected ({selectedIds.length})
                </button>
              </div>
            )}

            {rootObjects.map((obj) => (
              <ObjectRow key={obj.id} obj={obj} depth={0} />
            ))}
            <DropZoneRoot />
          </>
        ) : (
          <AssetBrowser />
        )}
      </div>
    </div>
  );
}
