import { useState, useCallback, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useGame } from "@/lib/stores/useGame";
import { useGameConfig } from "@/lib/stores/useGameConfig";
import { useEditorStore, CAMERA_PRESETS, type CameraPreset, type ViewportShading, type BottomDock } from "./EditorStore";
import { GAME_SCENE_BACKDROP_OPTIONS, type GameSceneBackdropType } from "./GameSceneBackdrop";
import EditorViewport from "./EditorViewport";
import SceneHierarchy from "./SceneHierarchy";
import InspectorPanel from "./InspectorPanel";

import TerrainPanel from "@/admin/panels/TerrainPanel";
import EnemyPanel from "@/admin/panels/EnemyPanel";
import CombatPanel from "@/admin/panels/CombatPanel";
import PhysicsPanel from "@/admin/panels/PhysicsPanel";
import WorldPanel from "@/admin/panels/WorldPanel";
import WavePanel from "@/admin/panels/WavePanel";
import NPCPanel from "@/admin/panels/NPCPanel";
import StatsPanel from "@/admin/panels/StatsPanel";
import BehaviorPanel from "@/admin/panels/BehaviorPanel";
import AnimationPanel from "@/admin/panels/AnimationPanel";
import UIPanel from "@/admin/panels/UIPanel";
import ModelBrowser from "@/admin/panels/ModelBrowser";
import MeshyPanel from "@/admin/panels/MeshyPanel";
import VibeChat from "@/admin/VibeChat";

type BottomTab = "none" | "terrain" | "enemies" | "combat" | "physics" | "world" | "waves" | "npcs" | "stats" | "behavior" | "animation" | "ui" | "models" | "meshy" | "ai";

const ADMIN_TABS: { id: BottomTab; label: string; group: string; hotkey?: string }[] = [
  { id: "terrain", label: "Terrain", group: "World" },
  { id: "world", label: "Environment", group: "World" },
  { id: "physics", label: "Physics", group: "World" },
  { id: "enemies", label: "Enemies", group: "Combat" },
  { id: "waves", label: "Waves", group: "Combat" },
  { id: "combat", label: "Combat", group: "Combat" },
  { id: "behavior", label: "Behaviors", group: "Combat" },
  { id: "npcs", label: "NPCs", group: "Entities" },
  { id: "stats", label: "Stats", group: "Entities" },
  { id: "animation", label: "Animation", group: "Entities" },
  { id: "ui", label: "UI / HUD", group: "Interface" },
  { id: "models", label: "Assets", group: "Interface" },
  { id: "meshy", label: "Meshy AI", group: "Interface" },
  { id: "ai", label: "VIBE AI", group: "Interface" },
];

const GROUP_COLORS: Record<string, string> = {
  World: "#7ee787",
  Combat: "#f85149",
  Entities: "#d2a8ff",
  Interface: "#58a6ff",
};

function renderAdminPanel(tab: BottomTab) {
  switch (tab) {
    case "terrain": return <TerrainPanel />;
    case "enemies": return <EnemyPanel />;
    case "combat": return <CombatPanel />;
    case "physics": return <PhysicsPanel />;
    case "world": return <WorldPanel />;
    case "waves": return <WavePanel />;
    case "npcs": return <NPCPanel />;
    case "stats": return <StatsPanel />;
    case "behavior": return <BehaviorPanel />;
    case "animation": return <AnimationPanel />;
    case "ui": return <UIPanel />;
    case "models": return <ModelBrowser />;
    case "meshy": return <MeshyPanel />;
    case "ai": return <div style={{ height: "100%" }}><VibeChat /></div>;
    default: return null;
  }
}

export default function GGEEditorMain() {
  const restart = useGame((s) => s.restart);
  const goToCharacterSelect = useGame((s) => s.goToCharacterSelect);
  const goToAdmin = useGame((s) => s.goToAdmin);

  const transformMode = useEditorStore((s) => s.transformMode);
  const setTransformMode = useEditorStore((s) => s.setTransformMode);
  const transformSpace = useEditorStore((s) => s.transformSpace);
  const setTransformSpace = useEditorStore((s) => s.setTransformSpace);
  const showGrid = useEditorStore((s) => s.showGrid);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const showAxes = useEditorStore((s) => s.showAxes);
  const toggleAxes = useEditorStore((s) => s.toggleAxes);
  const showBounds = useEditorStore((s) => s.showBounds);
  const toggleBounds = useEditorStore((s) => s.toggleBounds);
  const showStats = useEditorStore((s) => s.showStats);
  const toggleStats = useEditorStore((s) => s.toggleStats);
  const showColliders = useEditorStore((s) => s.showColliders);
  const toggleColliders = useEditorStore((s) => s.toggleColliders);
  const showNavMesh = useEditorStore((s) => s.showNavMesh);
  const toggleNavMesh = useEditorStore((s) => s.toggleNavMesh);
  const rightPanel = useEditorStore((s) => s.rightPanel);
  const setRightPanel = useEditorStore((s) => s.setRightPanel);
  const editorUndo = useEditorStore((s) => s.undo);
  const editorRedo = useEditorStore((s) => s.redo);
  const exportScene = useEditorStore((s) => s.exportScene);
  const importScene = useEditorStore((s) => s.importScene);
  const clearScene = useEditorStore((s) => s.clearScene);
  const objects = useEditorStore((s) => s.objects);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const selectedId = useEditorStore((s) => s.selectedId);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled);
  const snapTranslate = useEditorStore((s) => s.snapTranslate);
  const setSnapTranslate = useEditorStore((s) => s.setSnapTranslate);
  const snapRotate = useEditorStore((s) => s.snapRotate);
  const setSnapRotate = useEditorStore((s) => s.setSnapRotate);
  const snapScale = useEditorStore((s) => s.snapScale);
  const setSnapScale = useEditorStore((s) => s.setSnapScale);
  const viewportShading = useEditorStore((s) => s.viewportShading);
  const setViewportShading = useEditorStore((s) => s.setViewportShading);
  const cameraPreset = useEditorStore((s) => s.cameraPreset);
  const setCameraPreset = useEditorStore((s) => s.setCameraPreset);
  const gameSceneBackdrop = useEditorStore((s) => s.gameSceneBackdrop);
  const setGameSceneBackdrop = useEditorStore((s) => s.setGameSceneBackdrop);
  const historyIndex = useEditorStore((s) => s.historyIndex);
  const history = useEditorStore((s) => s.history);
  const selectAll = useEditorStore((s) => s.selectAll);
  const deselectAll = useEditorStore((s) => s.deselectAll);
  const removeSelected = useEditorStore((s) => s.removeSelected);
  const duplicateSelected = useEditorStore((s) => s.duplicateSelected);
  const groupSelected = useEditorStore((s) => s.groupSelected);
  const focusSelected = useEditorStore((s) => s.focusSelected);

  const configIsDirty = useGameConfig((s) => s.isDirty);
  const configUndo = useGameConfig((s) => s.undo);
  const configRedo = useGameConfig((s) => s.redo);
  const configExport = useGameConfig((s) => s.exportConfig);

  const [bottomTab, setBottomTab] = useState<BottomTab>("none");
  const [snapMenuOpen, setSnapMenuOpen] = useState(false);

  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);

  const bottomDock = useEditorStore((s) => s.bottomDock);
  const setBottomDock = useEditorStore((s) => s.setBottomDock);
  const [floatPos, setFloatPos] = useState({ x: 200, y: 100 });
  const [floatSize, setFloatSize] = useState({ w: 700, h: 400 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  const addPrimitive = useEditorStore((s) => s.addPrimitive);
  const addLight = useEditorStore((s) => s.addLight);
  const addEmpty = useEditorStore((s) => s.addEmpty);
  const addSpawnPoint = useEditorStore((s) => s.addSpawnPoint);
  const addTriggerZone = useEditorStore((s) => s.addTriggerZone);

  const handleExportScene = useCallback(() => {
    const json = exportScene();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gge-scene-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportScene]);

  const handleImportScene = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const ok = importScene(ev.target?.result as string);
        if (!ok) alert("Invalid scene file.");
      };
      reader.readAsText(file);
    };
    input.click();
  }, [importScene]);

  const handleImportGLBHierarchy = useCallback(async () => {
    const importGLBAsHierarchy = useEditorStore.getState().importGLBAsHierarchy;
    const defaultPath = "/models/tutorial_island/scene.glb";
    const path = window.prompt(
      "GLB path to import as editable hierarchy",
      defaultPath,
    );
    if (!path) return;
    const id = await importGLBAsHierarchy(path.trim());
    if (!id) {
      window.alert(`Failed to import GLB: ${path}\nCheck the browser console for details.`);
    }
  }, []);

  const handleExportConfig = useCallback(() => {
    const json = configExport();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `game-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [configExport]);

  const closeAllMenus = () => {
    setFileMenuOpen(false);
    setEditMenuOpen(false);
    setAddMenuOpen(false);
    setViewMenuOpen(false);
    setSnapMenuOpen(false);
  };

  const handleFloatDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: floatPos.x, origY: floatPos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setFloatPos({
        x: Math.max(0, dragRef.current.origX + ev.clientX - dragRef.current.startX),
        y: Math.max(38, dragRef.current.origY + ev.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [floatPos]);

  const handleFloatResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: floatSize.w, origH: floatSize.h };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      setFloatSize({
        w: Math.max(400, resizeRef.current.origW + ev.clientX - resizeRef.current.startX),
        h: Math.max(200, resizeRef.current.origH + ev.clientY - resizeRef.current.startY),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [floatSize]);

  const hasBottomTab = bottomTab !== "none";
  const isCenterDocked = bottomDock === "centerBottom" && hasBottomTab;
  const isLeftDocked = bottomDock === "leftBottom" && hasBottomTab;
  const isRightDocked = bottomDock === "rightBottom" && hasBottomTab;
  const showFloating = bottomDock === "floating" && hasBottomTab;

  const activeTabLabel = ADMIN_TABS.find(t => t.id === bottomTab)?.label || "";
  const activeTabColor = GROUP_COLORS[ADMIN_TABS.find(t => t.id === bottomTab)?.group || ""] || "#8b949e";

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#0d1117",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', -apple-system, sans-serif",
      zIndex: 9999,
    }}>
      {/* TOP BAR */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        background: "linear-gradient(180deg, #161b22, #0d1117)",
        borderBottom: "1px solid #21262d",
        height: 38,
        flexShrink: 0,
        gap: 4,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 4 }}>
          <div style={{
            width: 24,
            height: 24,
            borderRadius: 5,
            background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 900,
            color: "#fff",
            boxShadow: "0 0 8px rgba(139,92,246,0.4)",
          }}>G</div>
          <span style={{ color: "#f0f6fc", fontWeight: 700, fontSize: 13, letterSpacing: 0.5 }}>GGE</span>
        </div>

        <Divider />

        {/* File Menu */}
        <div style={{ position: "relative" }}>
          <MenuBarBtn label="File" active={fileMenuOpen} onClick={() => { closeAllMenus(); setFileMenuOpen(!fileMenuOpen); }} />
          {fileMenuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={closeAllMenus} />
              <DropdownMenu>
                <MenuItem label="New Scene" hotkey="" onClick={() => { clearScene(); closeAllMenus(); }} />
                <MenuItem label="Import Scene..." hotkey="" onClick={() => { handleImportScene(); closeAllMenus(); }} />
                <MenuItem label="Import GLB Hierarchy..." hotkey="" onClick={() => { handleImportGLBHierarchy(); closeAllMenus(); }} />
                <MenuItem label="Export Scene..." hotkey="" onClick={() => { handleExportScene(); closeAllMenus(); }} />
                <MenuDivider />
                <MenuItem label="Export Game Config" hotkey="" onClick={() => { handleExportConfig(); closeAllMenus(); }} />
                <MenuDivider />
                <MenuItem label="Back to Menu" hotkey="" onClick={() => { restart(); closeAllMenus(); }} />
                <MenuItem label="Character Select" hotkey="" onClick={() => { goToCharacterSelect(); closeAllMenus(); }} />
                <MenuItem label="Admin Dashboard" hotkey="" onClick={() => { goToAdmin(); closeAllMenus(); }} />
              </DropdownMenu>
            </>
          )}
        </div>

        {/* Edit Menu */}
        <div style={{ position: "relative" }}>
          <MenuBarBtn label="Edit" active={editMenuOpen} onClick={() => { closeAllMenus(); setEditMenuOpen(!editMenuOpen); }} />
          {editMenuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={closeAllMenus} />
              <DropdownMenu>
                <MenuItem label="Undo" hotkey="Ctrl+Z" disabled={historyIndex <= 0} onClick={() => { editorUndo(); closeAllMenus(); }} />
                <MenuItem label="Redo" hotkey="Ctrl+Y" disabled={historyIndex >= history.length - 1} onClick={() => { editorRedo(); closeAllMenus(); }} />
                <MenuDivider />
                <MenuItem label="Select All" hotkey="Ctrl+A" onClick={() => { selectAll(); closeAllMenus(); }} />
                <MenuItem label="Deselect All" hotkey="Esc" onClick={() => { deselectAll(); closeAllMenus(); }} />
                <MenuDivider />
                <MenuItem label="Duplicate" hotkey="Ctrl+D" disabled={selectedIds.length === 0} onClick={() => { duplicateSelected(); closeAllMenus(); }} />
                <MenuItem label="Delete" hotkey="Del" disabled={selectedIds.length === 0} onClick={() => { removeSelected(); closeAllMenus(); }} />
                <MenuDivider />
                <MenuItem label="Group Selected" hotkey="Ctrl+G" disabled={selectedIds.length < 2} onClick={() => { groupSelected(); closeAllMenus(); }} />
                <MenuItem label="Focus Selected" hotkey="F" disabled={!selectedId} onClick={() => { focusSelected(); closeAllMenus(); }} />
              </DropdownMenu>
            </>
          )}
        </div>

        {/* Add Menu */}
        <div style={{ position: "relative" }}>
          <MenuBarBtn label="+ Add" active={addMenuOpen} color="#7ee787" onClick={() => { closeAllMenus(); setAddMenuOpen(!addMenuOpen); }} />
          {addMenuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={closeAllMenus} />
              <DropdownMenu>
                <MenuSection label="PRIMITIVES" />
                {["box", "sphere", "cylinder", "cone", "torus", "plane"].map((s) => (
                  <MenuItem key={s} label={s} hotkey="" onClick={() => { addPrimitive(s); closeAllMenus(); }} />
                ))}
                <MenuDivider />
                <MenuSection label="LIGHTS" />
                {["ambient", "point", "spot", "directional", "hemisphere"].map((l) => (
                  <MenuItem key={l} label={`${l} light`} hotkey="" onClick={() => { addLight(l); closeAllMenus(); }} />
                ))}
                <MenuDivider />
                <MenuSection label="SCENE" />
                <MenuItem label="Empty Node" hotkey="" onClick={() => { addEmpty(); closeAllMenus(); }} />
                <MenuItem label="Group" hotkey="" onClick={() => {
                  useEditorStore.getState().addObject({
                    name: "New Group",
                    type: "group",
                    position: [0, 0, 0],
                    rotation: [0, 0, 0],
                    scale: [1, 1, 1],
                    visible: true,
                    locked: false,
                    properties: {},
                  });
                  closeAllMenus();
                }} />
                <MenuItem label="Spawn Point" hotkey="" onClick={() => { addSpawnPoint(); closeAllMenus(); }} />
                <MenuItem label="Trigger Zone" hotkey="" onClick={() => { addTriggerZone(); closeAllMenus(); }} />
              </DropdownMenu>
            </>
          )}
        </div>

        {/* View Menu */}
        <div style={{ position: "relative" }}>
          <MenuBarBtn label="View" active={viewMenuOpen} onClick={() => { closeAllMenus(); setViewMenuOpen(!viewMenuOpen); }} />
          {viewMenuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={closeAllMenus} />
              <DropdownMenu width={220}>
                <MenuSection label="GAME SCENE BACKDROP" />
                {GAME_SCENE_BACKDROP_OPTIONS.map((opt) => (
                  <MenuToggle
                    key={opt.id}
                    label={opt.label}
                    active={gameSceneBackdrop === opt.id}
                    onClick={() => { setGameSceneBackdrop(opt.id); }}
                  />
                ))}
                <MenuDivider />
                <MenuSection label="VIEWPORT SHADING" />
                {(["material", "solid", "wireframe", "normals"] as ViewportShading[]).map((mode) => (
                  <MenuToggle key={mode} label={mode} active={viewportShading === mode} onClick={() => { setViewportShading(mode); }} />
                ))}
                <MenuDivider />
                <MenuSection label="OVERLAYS" />
                <MenuToggle label="Grid (G)" active={showGrid} onClick={toggleGrid} />
                <MenuToggle label="Axes (H)" active={showAxes} onClick={toggleAxes} />
                <MenuToggle label="Bounds (B)" active={showBounds} onClick={toggleBounds} />
                <MenuToggle label="Stats (I)" active={showStats} onClick={toggleStats} />
                <MenuToggle label="Colliders (C)" active={showColliders} onClick={toggleColliders} />
                <MenuToggle label="NavMesh (N)" active={showNavMesh} onClick={toggleNavMesh} />
                <MenuDivider />
                <MenuSection label="CAMERA PRESETS" />
                {(Object.entries(CAMERA_PRESETS) as [CameraPreset, typeof CAMERA_PRESETS[CameraPreset]][]).map(([key, preset]) => (
                  <MenuToggle key={key} label={`${preset.label} (${preset.hotkey})`} active={cameraPreset === key} onClick={() => { setCameraPreset(key); }} />
                ))}
                <MenuDivider />
                <MenuSection label="PANEL LAYOUT" />
                <MenuToggle label="Dock under viewport (center)" active={bottomDock === "centerBottom"} onClick={() => setBottomDock("centerBottom")} />
                <MenuToggle label="Dock under hierarchy (left)" active={bottomDock === "leftBottom"} onClick={() => setBottomDock("leftBottom")} />
                <MenuToggle label="Dock under inspector (right)" active={bottomDock === "rightBottom"} onClick={() => setBottomDock("rightBottom")} />
                <MenuToggle label="Float (draggable window)" active={bottomDock === "floating"} onClick={() => setBottomDock("floating")} />
              </DropdownMenu>
            </>
          )}
        </div>

        <Divider />

        {/* Transform mode */}
        <ToolbarGroup>
          {([["translate", "W", "Move"], ["rotate", "E", "Rotate"], ["scale", "R", "Scale"]] as const).map(([mode, key, label]) => {
            const colors = { translate: "#58a6ff", rotate: "#7ee787", scale: "#f0883e" };
            const active = transformMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setTransformMode(mode)}
                title={`${label} (${key})`}
                style={{
                  padding: "4px 8px",
                  fontSize: 10,
                  borderRadius: 3,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  background: active ? `${colors[mode]}20` : "transparent",
                  color: active ? colors[mode] : "#484f58",
                  transition: "all 0.1s",
                }}
              >
                {label}
              </button>
            );
          })}
        </ToolbarGroup>

        <button
          onClick={() => setTransformSpace(transformSpace === "world" ? "local" : "world")}
          title="Toggle World/Local space (Tab)"
          style={{
            padding: "4px 8px",
            fontSize: 10,
            borderRadius: 3,
            border: `1px solid ${transformSpace === "local" ? "#d2a8ff30" : "#30363d"}`,
            cursor: "pointer",
            fontWeight: 600,
            background: transformSpace === "local" ? "#d2a8ff15" : "#21262d",
            color: transformSpace === "local" ? "#d2a8ff" : "#484f58",
          }}
        >
          {transformSpace === "world" ? "World" : "Local"}
        </button>

        <Divider />

        {/* Snap */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            onContextMenu={(e) => { e.preventDefault(); setSnapMenuOpen(!snapMenuOpen); }}
            title="Snap (S) | Right-click for settings"
            style={{
              padding: "4px 8px",
              fontSize: 10,
              borderRadius: 3,
              border: `1px solid ${snapEnabled ? "#58a6ff30" : "#30363d"}`,
              cursor: "pointer",
              fontWeight: 600,
              background: snapEnabled ? "#58a6ff15" : "#21262d",
              color: snapEnabled ? "#58a6ff" : "#484f58",
            }}
          >
            Snap
          </button>
          <button
            onClick={() => setSnapMenuOpen(!snapMenuOpen)}
            style={{
              padding: "4px 4px",
              fontSize: 8,
              borderRadius: 3,
              border: "none",
              cursor: "pointer",
              background: "transparent",
              color: "#484f58",
            }}
          >
            &#9660;
          </button>
          {snapMenuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={() => setSnapMenuOpen(false)} />
              <div style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: 4,
                background: "#161b22",
                border: "1px solid #30363d",
                borderRadius: 6,
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                zIndex: 51,
                width: 200,
                padding: 12,
              }}>
                <div style={{ color: "#8b949e", fontSize: 10, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>Snap Settings</div>
                <SnapField label="Translate" value={snapTranslate} onChange={setSnapTranslate} suffix="units" options={[0.1, 0.25, 0.5, 1, 2, 5]} />
                <SnapField label="Rotate" value={snapRotate} onChange={setSnapRotate} suffix="deg" options={[5, 10, 15, 30, 45, 90]} />
                <SnapField label="Scale" value={snapScale} onChange={setSnapScale} suffix="x" options={[0.1, 0.25, 0.5, 1]} />
              </div>
            </>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Camera preset quick buttons */}
        <div style={{ display: "flex", gap: 1 }}>
          {(["perspective", "front", "top", "right"] as CameraPreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => setCameraPreset(preset)}
              style={{
                padding: "3px 6px",
                fontSize: 9,
                borderRadius: 2,
                border: "none",
                cursor: "pointer",
                background: cameraPreset === preset ? "#58a6ff20" : "transparent",
                color: cameraPreset === preset ? "#58a6ff" : "#484f58",
                fontWeight: 600,
              }}
            >
              {CAMERA_PRESETS[preset].label.substring(0, 4)}
            </button>
          ))}
        </div>

        <Divider />

        {/* Viewport shading quick toggle */}
        <div style={{ display: "flex", gap: 1 }}>
          {(["material", "solid", "wireframe"] as ViewportShading[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewportShading(mode)}
              style={{
                padding: "3px 6px",
                fontSize: 9,
                borderRadius: 2,
                border: "none",
                cursor: "pointer",
                background: viewportShading === mode ? "#7ee78720" : "transparent",
                color: viewportShading === mode ? "#7ee787" : "#484f58",
                fontWeight: 600,
              }}
            >
              {mode.substring(0, 4)}
            </button>
          ))}
        </div>

        <Divider />

        <ToolbarGroup>
          <SmallBtn label="Undo" onClick={editorUndo} disabled={historyIndex <= 0} hotkey="Ctrl+Z" />
          <SmallBtn label="Redo" onClick={editorRedo} disabled={historyIndex >= history.length - 1} hotkey="Ctrl+Y" />
        </ToolbarGroup>
      </div>

      {/* MAIN AREA — fully resizable, dockable Unity-style layout */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <PanelGroup direction="horizontal" autoSaveId="gge-main-h">
            {/* LEFT COLUMN — hierarchy (+ optional docked panel) */}
            <Panel id="gge-left" order={1} defaultSize={18} minSize={10} maxSize={45}>
              <PanelGroup key={isLeftDocked ? "left-with" : "left-only"} direction="vertical" autoSaveId={isLeftDocked ? "gge-left-v-with-bottom" : "gge-left-v-only"}>
                <Panel id="gge-left-top" order={1} defaultSize={isLeftDocked ? 60 : 100} minSize={20}>
                  <DockColumn>
                    <SceneHierarchy />
                  </DockColumn>
                </Panel>
                {isLeftDocked && (
                  <>
                    <HorizontalHandle />
                    <Panel id="gge-left-bottom" order={2} defaultSize={40} minSize={10}>
                      <BottomDockChrome
                        label={activeTabLabel}
                        color={activeTabColor}
                        bottomDock={bottomDock}
                        setBottomDock={setBottomDock}
                        onClose={() => setBottomTab("none")}
                      >
                        {renderAdminPanel(bottomTab)}
                      </BottomDockChrome>
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>

            <VerticalHandle />

            {/* CENTER COLUMN — viewport (+ optional docked panel) */}
            <Panel id="gge-center" order={2} defaultSize={62} minSize={25}>
              <PanelGroup key={isCenterDocked ? "center-with" : "center-only"} direction="vertical" autoSaveId={isCenterDocked ? "gge-center-v-with-bottom" : "gge-center-v-only"}>
                <Panel id="gge-center-top" order={1} defaultSize={isCenterDocked ? 65 : 100} minSize={20}>
                  <div style={{ height: "100%", position: "relative", overflow: "hidden" }}>
                    <EditorViewport />
                  </div>
                </Panel>
                {isCenterDocked && (
                  <>
                    <HorizontalHandle />
                    <Panel id="gge-center-bottom" order={2} defaultSize={35} minSize={10}>
                      <BottomDockChrome
                        label={activeTabLabel}
                        color={activeTabColor}
                        bottomDock={bottomDock}
                        setBottomDock={setBottomDock}
                        onClose={() => setBottomTab("none")}
                      >
                        {renderAdminPanel(bottomTab)}
                      </BottomDockChrome>
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>

            <VerticalHandle />

            {/* RIGHT COLUMN — inspector (+ optional docked panel) */}
            <Panel id="gge-right" order={3} defaultSize={20} minSize={10} maxSize={45}>
              <PanelGroup key={isRightDocked ? "right-with" : "right-only"} direction="vertical" autoSaveId={isRightDocked ? "gge-right-v-with-bottom" : "gge-right-v-only"}>
                <Panel id="gge-right-top" order={1} defaultSize={isRightDocked ? 60 : 100} minSize={20}>
                  <RightSidebar
                    rightPanel={rightPanel}
                    setRightPanel={setRightPanel}
                    bottomTab={bottomTab}
                    setBottomTab={setBottomTab}
                  />
                </Panel>
                {isRightDocked && (
                  <>
                    <HorizontalHandle />
                    <Panel id="gge-right-bottom" order={2} defaultSize={40} minSize={10}>
                      <BottomDockChrome
                        label={activeTabLabel}
                        color={activeTabColor}
                        bottomDock={bottomDock}
                        setBottomDock={setBottomDock}
                        onClose={() => setBottomTab("none")}
                      >
                        {renderAdminPanel(bottomTab)}
                      </BottomDockChrome>
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>
          </PanelGroup>
        </div>

        {/* GLOBAL BOTTOM TAB BAR — visible across all dock targets */}
        <div style={{
          display: "flex",
          alignItems: "center",
          borderTop: "1px solid #21262d",
          background: "#010409",
          height: 30,
          flexShrink: 0,
          overflowX: "auto",
          gap: 0,
        }}>
          {ADMIN_TABS.map((tab) => {
            const active = bottomTab === tab.id;
            const color = GROUP_COLORS[tab.group];
            return (
              <button
                key={tab.id}
                onClick={() => setBottomTab(active ? "none" : tab.id)}
                style={{
                  padding: "0 10px",
                  height: "100%",
                  background: "none",
                  border: "none",
                  borderTop: active ? `2px solid ${color}` : "2px solid transparent",
                  color: active ? color : "#484f58",
                  fontSize: 10,
                  fontWeight: active ? 700 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.1s",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "#8b949e"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = active ? color : "#484f58"; }}
              >
                {tab.label}
              </button>
            );
          })}

          <div style={{ flex: 1 }} />

          {hasBottomTab && (
            <DockTargetMenu bottomDock={bottomDock} setBottomDock={setBottomDock} />
          )}

          {configIsDirty && (
            <span style={{
              padding: "2px 6px",
              borderRadius: 8,
              fontSize: 8,
              fontWeight: 600,
              background: "#f0883e22",
              color: "#f0883e",
              border: "1px solid #f0883e44",
              marginRight: 4,
            }}>Modified</span>
          )}

          <SmallBtn label="Cfg Undo" onClick={configUndo} />
          <SmallBtn label="Cfg Redo" onClick={configRedo} />
          <SmallBtn label="Cfg Export" onClick={handleExportConfig} />

          <Divider />

          <span style={{ color: "#30363d", fontSize: 9, fontFamily: "monospace", marginRight: 4 }}>
            {objects.length} obj | {selectedIds.length} sel
          </span>
        </div>
      </div>

      {/* FLOATING PANEL */}
      {showFloating && (
        <div style={{
          position: "fixed",
          left: floatPos.x,
          top: floatPos.y,
          width: floatSize.w,
          height: floatSize.h,
          background: "#0d1117",
          border: "1px solid #30363d",
          borderRadius: 8,
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Floating title bar */}
          <div
            onMouseDown={handleFloatDragStart}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0 8px",
              height: 30,
              background: "linear-gradient(180deg, #161b22, #0d1117)",
              borderBottom: "1px solid #21262d",
              cursor: "grab",
              flexShrink: 0,
              gap: 8,
              userSelect: "none",
            }}
          >
            <span style={{ color: activeTabColor, fontSize: 11, fontWeight: 700 }}>{activeTabLabel}</span>
            <div style={{ flex: 1 }} />

            <DockTargetMenu bottomDock={bottomDock} setBottomDock={setBottomDock} />

            <button
              onClick={() => setBottomTab("none")}
              style={{
                width: 18,
                height: 18,
                borderRadius: 3,
                border: "none",
                background: "transparent",
                color: "#8b949e",
                cursor: "pointer",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f8514930"; e.currentTarget.style.color = "#f85149"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#8b949e"; }}
            >
              x
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {renderAdminPanel(bottomTab)}
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={handleFloatResizeStart}
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 14,
              height: 14,
              cursor: "nwse-resize",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#30363d",
              fontSize: 8,
            }}
          >
            &#9698;
          </div>
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: "#21262d", flexShrink: 0 }} />;
}

function DockColumn({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: "#0d1117",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {children}
    </div>
  );
}

function VerticalHandle() {
  return (
    <PanelResizeHandle style={{
      width: 4,
      background: "#21262d",
      cursor: "col-resize",
      transition: "background 0.15s",
    }}>
      <div style={{ width: "100%", height: "100%" }}
        onMouseEnter={(e) => { (e.currentTarget.parentElement as HTMLElement).style.background = "#58a6ff"; }}
        onMouseLeave={(e) => { (e.currentTarget.parentElement as HTMLElement).style.background = "#21262d"; }}
      />
    </PanelResizeHandle>
  );
}

function HorizontalHandle() {
  return (
    <PanelResizeHandle style={{
      height: 6,
      background: "linear-gradient(180deg, #30363d 0%, #21262d 100%)",
      cursor: "row-resize",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background 0.15s",
    }}>
      <div style={{ width: 40, height: 2, borderRadius: 1, background: "#484f58", pointerEvents: "none" }} />
    </PanelResizeHandle>
  );
}

const DOCK_TARGETS: { id: BottomDock; label: string; short: string; title: string }[] = [
  { id: "leftBottom",   label: "Dock under hierarchy",  short: "L", title: "Dock under hierarchy (left column)" },
  { id: "centerBottom", label: "Dock under viewport",   short: "C", title: "Dock under viewport (center column)" },
  { id: "rightBottom",  label: "Dock under inspector",  short: "R", title: "Dock under inspector (right column)" },
  { id: "floating",     label: "Float as window",       short: "F", title: "Float as draggable window" },
];

function DockTargetMenu({ bottomDock, setBottomDock }: { bottomDock: BottomDock; setBottomDock: (d: BottomDock) => void }) {
  return (
    <div style={{ display: "flex", gap: 1, marginRight: 4, background: "#161b22", borderRadius: 3, padding: 1, border: "1px solid #21262d" }}>
      {DOCK_TARGETS.map((t) => {
        const active = bottomDock === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setBottomDock(t.id)}
            title={t.title}
            style={{
              padding: "2px 6px",
              fontSize: 9,
              borderRadius: 2,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              background: active ? "#58a6ff20" : "transparent",
              color: active ? "#58a6ff" : "#8b949e",
            }}
          >
            {t.short}
          </button>
        );
      })}
    </div>
  );
}

function BottomDockChrome({
  label,
  color,
  bottomDock,
  setBottomDock,
  onClose,
  children,
}: {
  label: string;
  color: string;
  bottomDock: BottomDock;
  setBottomDock: (d: BottomDock) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: "#0d1117",
      borderTop: "1px solid #21262d",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "0 6px",
        height: 24,
        background: "linear-gradient(180deg, #161b22, #0d1117)",
        borderBottom: "1px solid #21262d",
        flexShrink: 0,
        gap: 6,
      }}>
        <span style={{ color, fontSize: 10, fontWeight: 700 }}>{label}</span>
        <div style={{ flex: 1 }} />
        <DockTargetMenu bottomDock={bottomDock} setBottomDock={setBottomDock} />
        <button
          onClick={onClose}
          title="Close panel"
          style={{
            width: 16, height: 16,
            borderRadius: 3,
            border: "none",
            background: "transparent",
            color: "#8b949e",
            cursor: "pointer",
            fontSize: 11,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#f8514930"; e.currentTarget.style.color = "#f85149"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#8b949e"; }}
        >x</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}

function RightSidebar({
  rightPanel,
  setRightPanel,
  bottomTab,
  setBottomTab,
}: {
  rightPanel: "inspector" | "admin";
  setRightPanel: (p: "inspector" | "admin") => void;
  bottomTab: BottomTab;
  setBottomTab: (t: BottomTab) => void;
}) {
  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: "#0d1117",
      borderLeft: "1px solid #21262d",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex",
        borderBottom: "1px solid #21262d",
        flexShrink: 0,
      }}>
        {(["inspector", "admin"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setRightPanel(tab)}
            style={{
              flex: 1,
              padding: "7px 0",
              background: "none",
              border: "none",
              borderBottom: rightPanel === tab ? "2px solid #58a6ff" : "2px solid transparent",
              color: rightPanel === tab ? "#58a6ff" : "#8b949e",
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

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {rightPanel === "inspector" ? (
          <InspectorPanel />
        ) : (
          <div style={{ padding: 8 }}>
            <div style={{ color: "#8b949e", fontSize: 10, marginBottom: 8 }}>
              Use bottom tabs or click below to open panels
            </div>
            {Object.entries(
              ADMIN_TABS.reduce((acc, tab) => {
                if (!acc[tab.group]) acc[tab.group] = [];
                acc[tab.group].push(tab);
                return acc;
              }, {} as Record<string, typeof ADMIN_TABS>)
            ).map(([group, tabs]) => (
              <div key={group} style={{ marginBottom: 8 }}>
                <div style={{ color: GROUP_COLORS[group], fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  {group}
                </div>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setBottomTab(tab.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "5px 10px",
                      marginBottom: 2,
                      background: bottomTab === tab.id ? "#1f6feb20" : "transparent",
                      border: "none",
                      borderRadius: 4,
                      color: bottomTab === tab.id ? GROUP_COLORS[tab.group] : "#8b949e",
                      fontSize: 11,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#21262d"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = bottomTab === tab.id ? "#1f6feb20" : "transparent"; }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex",
      gap: 1,
      background: "#161b22",
      borderRadius: 4,
      padding: 1,
      border: "1px solid #21262d",
    }}>
      {children}
    </div>
  );
}

function MenuBarBtn({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 10px",
        fontSize: 10,
        color: active ? (color || "#f0f6fc") : (color || "#8b949e"),
        background: active ? "#21262d" : "none",
        border: "none",
        borderRadius: 3,
        cursor: "pointer",
        fontWeight: 600,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#21262d"; e.currentTarget.style.color = color || "#f0f6fc"; }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "none"; e.currentTarget.style.color = color || "#8b949e"; } }}
    >
      {label}
    </button>
  );
}

function DropdownMenu({ children, width }: { children: React.ReactNode; width?: number }) {
  return (
    <div style={{
      position: "absolute",
      top: "100%",
      left: 0,
      marginTop: 4,
      background: "#161b22",
      border: "1px solid #30363d",
      borderRadius: 6,
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      zIndex: 51,
      minWidth: width || 200,
      padding: "4px 0",
    }}>
      {children}
    </div>
  );
}

function SmallBtn({ label, onClick, warn, disabled, hotkey }: { label: string; onClick: () => void; warn?: boolean; disabled?: boolean; hotkey?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hotkey}
      style={{
        padding: "3px 8px",
        fontSize: 9,
        borderRadius: 3,
        border: "none",
        background: "transparent",
        color: disabled ? "#21262d" : warn ? "#f0883e" : "#8b949e",
        cursor: disabled ? "default" : "pointer",
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}

function MenuSection({ label }: { label: string }) {
  return <div style={{ color: "#484f58", fontSize: 9, padding: "6px 12px 2px", fontWeight: 700, letterSpacing: 1 }}>{label}</div>;
}

function MenuDivider() {
  return <div style={{ borderTop: "1px solid #21262d", margin: "2px 0" }} />;
}

function MenuItem({ label, onClick, hotkey, disabled }: { label: string; onClick: () => void; hotkey?: string; disabled?: boolean }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        padding: "5px 12px",
        fontSize: 11,
        color: disabled ? "#30363d" : "#c9d1d9",
        cursor: disabled ? "default" : "pointer",
        textTransform: "capitalize",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "#21262d"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span>{label}</span>
      {hotkey && <span style={{ fontSize: 9, color: "#484f58", fontFamily: "monospace" }}>{hotkey}</span>}
    </div>
  );
}

function MenuToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "5px 12px",
        fontSize: 11,
        color: active ? "#58a6ff" : "#c9d1d9",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        textTransform: "capitalize",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#21262d"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{
        width: 10,
        height: 10,
        borderRadius: 2,
        background: active ? "#58a6ff" : "transparent",
        border: `1px solid ${active ? "#58a6ff" : "#484f58"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 8,
        color: "#fff",
      }}>
        {active ? "+" : ""}
      </span>
      {label}
    </div>
  );
}

function SnapField({ label, value, onChange, suffix, options }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
  options: number[];
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: "#c9d1d9", fontSize: 10 }}>{label}</span>
        <span style={{ color: "#58a6ff", fontSize: 10, fontFamily: "monospace" }}>{value} {suffix}</span>
      </div>
      <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            style={{
              padding: "2px 6px",
              fontSize: 9,
              borderRadius: 2,
              border: "none",
              cursor: "pointer",
              background: value === o ? "#58a6ff25" : "#21262d",
              color: value === o ? "#58a6ff" : "#8b949e",
              fontWeight: value === o ? 700 : 400,
            }}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
