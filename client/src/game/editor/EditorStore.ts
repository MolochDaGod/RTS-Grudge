import { create } from "zustand";
import * as THREE from "three";
import type { ColliderDef, PhysicsType, PrefabDef } from "./PrefabRegistry";
import type { GameSceneBackdropType } from "./GameSceneBackdrop";
import { glbToSceneObjects, type ImportGLBOptions } from "./SceneImporter";
import { isAssetFailed, loadAsset } from "../systems/AssetLoader";

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildLocalMatrix(obj: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  const euler = new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ');
  m.compose(
    new THREE.Vector3(...obj.position),
    new THREE.Quaternion().setFromEuler(euler),
    new THREE.Vector3(...obj.scale),
  );
  return m;
}

function getWorldMatrixForObject(objId: string, objects: SceneObject[]): THREE.Matrix4 {
  const chain: SceneObject[] = [];
  let cur = objects.find(o => o.id === objId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? objects.find(o => o.id === cur!.parentId) : undefined;
  }
  const world = new THREE.Matrix4();
  for (const o of chain) {
    world.multiply(buildLocalMatrix(o));
  }
  return world;
}

function decomposeMatrix(m: THREE.Matrix4): { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] } {
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  m.decompose(pos, quat, scl);
  const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');
  return {
    position: [pos.x, pos.y, pos.z],
    rotation: [euler.x, euler.y, euler.z],
    scale: [scl.x, scl.y, scl.z],
  };
}

function worldToLocal(childWorldMatrix: THREE.Matrix4, newParentWorldMatrix: THREE.Matrix4): { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] } {
  const localMatrix = newParentWorldMatrix.clone().invert().multiply(childWorldMatrix);
  return decomposeMatrix(localMatrix);
}

export type TransformMode = "translate" | "rotate" | "scale";
export type EditorTool = "select" | "place" | "delete";
export type ViewportShading = "solid" | "wireframe" | "material" | "normals";
export type CameraPreset = "perspective" | "front" | "back" | "left" | "right" | "top" | "bottom";
export type TransformSpace = "world" | "local";
export type BottomDock = "centerBottom" | "leftBottom" | "rightBottom" | "floating";

export interface SceneObject {
  id: string;
  name: string;
  type: "model" | "modelNode" | "light" | "primitive" | "group" | "spawn" | "trigger" | "empty" | "prefab";
  modelPath?: string;
  prefabId?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
  locked: boolean;
  children?: string[];
  parentId?: string;
  collider?: ColliderDef;
  physicsType?: PhysicsType;
  navMeshObstacle?: boolean;
  navMeshCarve?: boolean;
  properties: Record<string, any>;
}

interface EditorState {
  objects: SceneObject[];
  selectedId: string | null;
  selectedIds: string[];
  transformMode: TransformMode;
  transformSpace: TransformSpace;
  tool: EditorTool;
  showGrid: boolean;
  showAxes: boolean;
  showStats: boolean;
  showBounds: boolean;
  showWireOverlay: boolean;
  showColliders: boolean;
  showNavMesh: boolean;
  viewportShading: ViewportShading;
  cameraPreset: CameraPreset;
  snapEnabled: boolean;
  snapTranslate: number;
  snapRotate: number;
  snapScale: number;
  gridSize: number;
  gridDivisions: number;
  cameraPosition: [number, number, number];
  rightPanel: "inspector" | "admin";
  adminTab: string;
  leftPanel: "hierarchy" | "assets";
  history: SceneObject[][];
  historyIndex: number;
  pivotPoint: "median" | "individual" | "cursor";
  cursorPosition: [number, number, number];
  gameSceneBackdrop: GameSceneBackdropType;
  bottomDock: BottomDock;

  setSelectedId: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelectId: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setTransformMode: (mode: TransformMode) => void;
  setTransformSpace: (space: TransformSpace) => void;
  setTool: (tool: EditorTool) => void;
  toggleGrid: () => void;
  toggleAxes: () => void;
  toggleStats: () => void;
  toggleBounds: () => void;
  toggleWireOverlay: () => void;
  toggleColliders: () => void;
  toggleNavMesh: () => void;
  setViewportShading: (mode: ViewportShading) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setSnapEnabled: (v: boolean) => void;
  setSnapTranslate: (v: number) => void;
  setSnapRotate: (v: number) => void;
  setSnapScale: (v: number) => void;
  setGridSize: (v: number) => void;
  setRightPanel: (p: "inspector" | "admin") => void;
  setAdminTab: (tab: string) => void;
  setLeftPanel: (p: "hierarchy" | "assets") => void;
  setCursorPosition: (p: [number, number, number]) => void;
  setGameSceneBackdrop: (b: GameSceneBackdropType) => void;
  setBottomDock: (d: BottomDock) => void;

  addObject: (obj: Omit<SceneObject, "id">) => string;
  removeObject: (id: string) => void;
  removeSelected: () => void;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  duplicateObject: (id: string) => string | null;
  duplicateSelected: () => void;
  moveObjectUp: (id: string) => void;
  moveObjectDown: (id: string) => void;
  focusSelected: () => void;
  groupSelected: () => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  exportScene: () => string;
  importScene: (json: string) => boolean;
  clearScene: () => void;

  reparentObject: (childId: string, newParentId: string | null) => void;
  ungroupObject: (groupId: string) => void;
  getChildren: (parentId: string) => SceneObject[];
  getRootObjects: () => SceneObject[];
  getDescendants: (parentId: string) => string[];
  isAncestor: (ancestorId: string, descendantId: string) => boolean;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  setExpanded: (id: string, expanded: boolean) => void;

  addPrimitive: (type: string) => void;
  addLight: (type: string) => void;
  addModelToScene: (path: string, name: string, targetHeight?: number) => void;
  addPrefab: (prefab: PrefabDef) => void;
  addPrefabSpawner: (prefab: PrefabDef) => void;
  addEmpty: () => void;
  addSpawnPoint: () => void;
  addTriggerZone: () => void;

  /**
   * Load a GLB by path, walk its hierarchy, and add every named node as a
   * SceneObject of type "modelNode" with parent/child pointers, local
   * transforms and material/texture references preserved (materials ride
   * with the GLB itself; the editor viewport pulls live subtrees by
   * `properties.nodePath` at render time).
   *
   * Returns the imported root SceneObject id, or null on failure.
   * Pushes a single history snapshot so undo restores pre-import state.
   */
  importGLBAsHierarchy: (path: string, opts?: ImportGLBOptions) => Promise<string | null>;
}

const DEFAULT_OBJECTS: SceneObject[] = [
  {
    id: "sun",
    name: "Directional Light",
    type: "light",
    position: [10, 20, 10],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked: false,
    properties: { lightType: "directional", color: "#ffffff", intensity: 1.5, castShadow: true },
  },
  {
    id: "ambient",
    name: "Ambient Light",
    type: "light",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked: false,
    properties: { lightType: "ambient", color: "#404060", intensity: 0.4 },
  },
  {
    id: "ground",
    name: "Ground Plane",
    type: "primitive",
    position: [0, 0, 0],
    rotation: [-Math.PI / 2, 0, 0],
    scale: [100, 100, 1],
    visible: true,
    locked: false,
    properties: { shape: "plane", color: "#3a5a3a", receiveShadow: true },
  },
];

export const CAMERA_PRESETS: Record<CameraPreset, { position: [number, number, number]; target: [number, number, number]; label: string; hotkey: string }> = {
  perspective: { position: [15, 12, 15], target: [0, 0, 0], label: "Perspective", hotkey: "0" },
  front: { position: [0, 5, 20], target: [0, 5, 0], label: "Front", hotkey: "1" },
  back: { position: [0, 5, -20], target: [0, 5, 0], label: "Back", hotkey: "2" },
  left: { position: [-20, 5, 0], target: [0, 5, 0], label: "Left", hotkey: "3" },
  right: { position: [20, 5, 0], target: [0, 5, 0], label: "Right", hotkey: "4" },
  top: { position: [0, 30, 0.01], target: [0, 0, 0], label: "Top", hotkey: "5" },
  bottom: { position: [0, -30, 0.01], target: [0, 0, 0], label: "Bottom", hotkey: "6" },
};

export const useEditorStore = create<EditorState>((set, get) => ({
  objects: [...DEFAULT_OBJECTS],
  selectedId: null,
  selectedIds: [],
  transformMode: "translate",
  transformSpace: "world",
  tool: "select",
  showGrid: true,
  showAxes: true,
  showStats: false,
  showBounds: false,
  showWireOverlay: false,
  showColliders: true,
  showNavMesh: false,
  viewportShading: "material",
  cameraPreset: "perspective",
  snapEnabled: false,
  snapTranslate: 1,
  snapRotate: 15,
  snapScale: 0.25,
  gridSize: 50,
  gridDivisions: 10,
  cameraPosition: [15, 12, 15],
  rightPanel: "inspector",
  adminTab: "terrain",
  leftPanel: "hierarchy",
  history: [JSON.parse(JSON.stringify(DEFAULT_OBJECTS))],
  historyIndex: 0,
  pivotPoint: "median",
  cursorPosition: [0, 0, 0],
  expandedIds: new Set<string>(),
  gameSceneBackdrop: "none",
  bottomDock: "centerBottom",

  setSelectedId: (id) => set({ selectedId: id, selectedIds: id ? [id] : [] }),
  setSelectedIds: (ids) => set({ selectedIds: ids, selectedId: ids[0] || null }),
  toggleSelectId: (id) => {
    const { selectedIds } = get();
    if (selectedIds.includes(id)) {
      const next = selectedIds.filter((i) => i !== id);
      set({ selectedIds: next, selectedId: next[0] || null });
    } else {
      set({ selectedIds: [...selectedIds, id], selectedId: id });
    }
  },
  selectAll: () => {
    const ids = get().objects.map((o) => o.id);
    set({ selectedIds: ids, selectedId: ids[0] || null });
  },
  deselectAll: () => set({ selectedIds: [], selectedId: null }),
  setTransformMode: (mode) => set({ transformMode: mode }),
  setTransformSpace: (space) => set({ transformSpace: space }),
  setTool: (tool) => set({ tool }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleAxes: () => set((s) => ({ showAxes: !s.showAxes })),
  toggleStats: () => set((s) => ({ showStats: !s.showStats })),
  toggleBounds: () => set((s) => ({ showBounds: !s.showBounds })),
  toggleWireOverlay: () => set((s) => ({ showWireOverlay: !s.showWireOverlay })),
  toggleColliders: () => set((s) => ({ showColliders: !s.showColliders })),
  toggleNavMesh: () => set((s) => ({ showNavMesh: !s.showNavMesh })),
  setViewportShading: (mode) => set({ viewportShading: mode }),
  setCameraPreset: (preset) => set({ cameraPreset: preset }),
  setSnapEnabled: (v) => set({ snapEnabled: v }),
  setSnapTranslate: (v) => set({ snapTranslate: v }),
  setSnapRotate: (v) => set({ snapRotate: v }),
  setSnapScale: (v) => set({ snapScale: v }),
  setGridSize: (v) => set({ gridSize: v }),
  setRightPanel: (p) => set({ rightPanel: p }),
  setAdminTab: (tab) => set({ adminTab: tab }),
  setLeftPanel: (p) => set({ leftPanel: p }),
  setCursorPosition: (p) => set({ cursorPosition: p }),
  setGameSceneBackdrop: (b) => set({ gameSceneBackdrop: b }),
  setBottomDock: (d) => set({ bottomDock: d }),

  addObject: (obj) => {
    const id = genId();
    const newObj: SceneObject = { ...obj, id };
    get().pushHistory();
    set((s) => ({ objects: [...s.objects, newObj], selectedId: id, selectedIds: [id] }));
    return id;
  },

  removeObject: (id) => {
    get().pushHistory();
    const toRemove = new Set([id, ...get().getDescendants(id)]);
    set((s) => {
      const parentObj = s.objects.find(o => o.id === id);
      let objects = s.objects.filter((o) => !toRemove.has(o.id));
      if (parentObj?.parentId) {
        objects = objects.map(o =>
          o.id === parentObj.parentId
            ? { ...o, children: (o.children || []).filter(c => c !== id) }
            : o
        );
      }
      return {
        objects,
        selectedId: toRemove.has(s.selectedId || "") ? null : s.selectedId,
        selectedIds: s.selectedIds.filter((i) => !toRemove.has(i)),
      };
    });
  },

  removeSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    get().pushHistory();
    const toRemove = new Set<string>();
    selectedIds.forEach(id => {
      toRemove.add(id);
      get().getDescendants(id).forEach(d => toRemove.add(d));
    });
    set((s) => {
      let objects = s.objects.filter((o) => !toRemove.has(o.id));
      objects = objects.map(o => {
        if (o.children?.some(c => toRemove.has(c))) {
          return { ...o, children: o.children.filter(c => !toRemove.has(c)) };
        }
        return o;
      });
      return { objects, selectedId: null, selectedIds: [] };
    });
  },

  updateObject: (id, updates) => {
    const hasTransform = updates.position || updates.rotation || updates.scale;
    const hasPhysics = updates.collider !== undefined || updates.physicsType !== undefined || updates.navMeshObstacle !== undefined || updates.navMeshCarve !== undefined;
    if (hasTransform || updates.properties || hasPhysics) {
      get().pushHistory();
    }
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, ...updates } : o)),
    }));
  },

  duplicateObject: (id) => {
    const { objects } = get();
    const obj = objects.find((o) => o.id === id);
    if (!obj) return null;
    get().pushHistory();

    const idMap = new Map<string, string>();
    const duplicates: SceneObject[] = [];

    function dupRecursive(srcId: string, newParent: string | undefined) {
      const src = objects.find(o => o.id === srcId);
      if (!src) return;
      const newId = genId();
      idMap.set(srcId, newId);
      const childIds = objects.filter(o => o.parentId === srcId).map(o => o.id);
      const newChildren: string[] = [];
      for (const cid of childIds) {
        dupRecursive(cid, newId);
        const mapped = idMap.get(cid);
        if (mapped) newChildren.push(mapped);
      }
      duplicates.push({
        ...src,
        id: newId,
        name: srcId === id ? `${src.name} (copy)` : src.name,
        parentId: newParent,
        children: newChildren.length > 0 ? newChildren : undefined,
        position: srcId === id
          ? [src.position[0] + 2, src.position[1], src.position[2]]
          : [...src.position],
      });
    }

    dupRecursive(id, obj.parentId);
    const rootDupId = idMap.get(id)!;

    set((s) => {
      let updated = [...s.objects, ...duplicates];
      if (obj.parentId) {
        updated = updated.map(o =>
          o.id === obj.parentId
            ? { ...o, children: [...(o.children || []), rootDupId] }
            : o
        );
      }
      return { objects: updated, selectedId: rootDupId, selectedIds: [rootDupId] };
    });
    return rootDupId;
  },

  duplicateSelected: () => {
    const { selectedIds, objects } = get();
    if (selectedIds.length === 0) return;
    const rootsToDup = selectedIds.filter(id => {
      const obj = objects.find(o => o.id === id);
      return obj && !selectedIds.includes(obj.parentId || "");
    });
    if (rootsToDup.length === 0) return;
    get().pushHistory();

    const allNewIds: string[] = [];
    const allNewObjs: SceneObject[] = [];
    const globalIdMap = new Map<string, string>();

    for (const rootId of rootsToDup) {
      const idMap = new Map<string, string>();
      function dupRecursive(srcId: string, newParent: string | undefined) {
        const src = objects.find(o => o.id === srcId);
        if (!src) return;
        const newId = genId();
        idMap.set(srcId, newId);
        globalIdMap.set(srcId, newId);
        const childIds = objects.filter(o => o.parentId === srcId).map(o => o.id);
        const newChildren: string[] = [];
        for (const cid of childIds) {
          dupRecursive(cid, newId);
          const mapped = idMap.get(cid);
          if (mapped) newChildren.push(mapped);
        }
        allNewObjs.push({
          ...src,
          id: newId,
          name: srcId === rootId ? `${src.name} (copy)` : src.name,
          parentId: newParent,
          children: newChildren.length > 0 ? newChildren : undefined,
          position: srcId === rootId
            ? [src.position[0] + 2, src.position[1], src.position[2]]
            : [...src.position],
        });
      }
      const rootObj = objects.find(o => o.id === rootId);
      dupRecursive(rootId, rootObj?.parentId);
      const rootDupId = idMap.get(rootId);
      if (rootDupId) allNewIds.push(rootDupId);
    }

    set((s) => {
      let updated = [...s.objects, ...allNewObjs];
      for (const rootId of rootsToDup) {
        const rootObj = objects.find(o => o.id === rootId);
        const rootDupId = globalIdMap.get(rootId);
        if (rootObj?.parentId && rootDupId) {
          updated = updated.map(o =>
            o.id === rootObj.parentId
              ? { ...o, children: [...(o.children || []), rootDupId] }
              : o
          );
        }
      }
      return { objects: updated, selectedId: allNewIds[0] || null, selectedIds: allNewIds };
    });
  },

  moveObjectUp: (id) => {
    set((s) => {
      const idx = s.objects.findIndex((o) => o.id === id);
      if (idx <= 0) return s;
      const arr = [...s.objects];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return { objects: arr };
    });
  },

  moveObjectDown: (id) => {
    set((s) => {
      const idx = s.objects.findIndex((o) => o.id === id);
      if (idx < 0 || idx >= s.objects.length - 1) return s;
      const arr = [...s.objects];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return { objects: arr };
    });
  },

  focusSelected: () => {
    const { selectedId, objects } = get();
    if (!selectedId) return;
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj) return;
    const pos = obj.position;
    const dist = 8;
    const cameraPos: [number, number, number] = [pos[0] + dist, pos[1] + dist * 0.7, pos[2] + dist];
    set({
      cameraPreset: "perspective",
      cameraPosition: cameraPos,
    });
    const orbitCtrl = (window as any).__editorOrbitControls;
    if (orbitCtrl) {
      orbitCtrl.target.set(pos[0], pos[1], pos[2]);
      orbitCtrl.object.position.set(cameraPos[0], cameraPos[1], cameraPos[2]);
      orbitCtrl.update();
    }
  },

  groupSelected: () => {
    const { selectedIds, objects } = get();
    if (selectedIds.length < 2) return;
    get().pushHistory();
    const selected = objects.filter((o) => selectedIds.includes(o.id));

    const worldCenter = new THREE.Vector3();
    selected.forEach((o) => {
      const wm = getWorldMatrixForObject(o.id, objects);
      const wp = new THREE.Vector3();
      wp.setFromMatrixPosition(wm);
      worldCenter.add(wp);
    });
    worldCenter.divideScalar(selected.length);

    const center: [number, number, number] = [worldCenter.x, worldCenter.y, worldCenter.z];

    const groupId = genId();
    const group: SceneObject = {
      id: groupId,
      name: "Group",
      type: "group",
      position: center,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      locked: false,
      children: selectedIds,
      properties: {},
    };

    const groupWorldMatrix = buildLocalMatrix(group);

    let updatedObjects = objects.map((o) => {
      if (!selectedIds.includes(o.id)) return o;
      const childWorldMatrix = getWorldMatrixForObject(o.id, objects);
      const newLocal = worldToLocal(childWorldMatrix, groupWorldMatrix);
      if (o.parentId) {
        return { ...o, parentId: groupId, ...newLocal };
      }
      return { ...o, parentId: groupId, ...newLocal };
    });

    updatedObjects = updatedObjects.map(o => {
      if (o.children) {
        const cleaned = o.children.filter(c => !selectedIds.includes(c) || c === groupId);
        if (cleaned.length !== o.children.length) {
          return { ...o, children: cleaned.length > 0 ? cleaned : undefined };
        }
      }
      return o;
    });

    set({
      objects: [...updatedObjects, group],
      selectedId: groupId,
      selectedIds: [groupId],
    });
  },

  toggleExpanded: (id) => {
    set((s) => {
      const next = new Set(s.expandedIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { expandedIds: next };
    });
  },

  setExpanded: (id, expanded) => {
    set((s) => {
      const next = new Set(s.expandedIds);
      if (expanded) next.add(id); else next.delete(id);
      return { expandedIds: next };
    });
  },

  getChildren: (parentId) => {
    return get().objects.filter(o => o.parentId === parentId);
  },

  getRootObjects: () => {
    return get().objects.filter(o => !o.parentId);
  },

  getDescendants: (parentId) => {
    const { objects } = get();
    const result: string[] = [];
    function collect(pid: string) {
      for (const o of objects) {
        if (o.parentId === pid) {
          result.push(o.id);
          collect(o.id);
        }
      }
    }
    collect(parentId);
    return result;
  },

  isAncestor: (ancestorId, descendantId) => {
    const { objects } = get();
    let current = descendantId;
    while (current) {
      const obj = objects.find(o => o.id === current);
      if (!obj?.parentId) return false;
      if (obj.parentId === ancestorId) return true;
      current = obj.parentId;
    }
    return false;
  },

  reparentObject: (childId, newParentId) => {
    const { objects } = get();
    const child = objects.find(o => o.id === childId);
    if (!child) return;
    if (newParentId && (newParentId === childId || get().isAncestor(childId, newParentId))) return;
    if (child.parentId === newParentId) return;

    get().pushHistory();

    const childWorldMatrix = getWorldMatrixForObject(childId, objects);
    let localTransform: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] };

    if (newParentId) {
      const parentWorldMatrix = getWorldMatrixForObject(newParentId, objects);
      localTransform = worldToLocal(childWorldMatrix, parentWorldMatrix);
    } else {
      localTransform = decomposeMatrix(childWorldMatrix);
    }

    set((s) => {
      let updated = s.objects.map(o => {
        if (o.id === child.parentId && o.children) {
          return { ...o, children: o.children.filter(c => c !== childId) };
        }
        return o;
      });

      updated = updated.map(o => {
        if (o.id === childId) {
          return { ...o, parentId: newParentId || undefined, ...localTransform };
        }
        if (o.id === newParentId) {
          return { ...o, children: [...(o.children || []), childId] };
        }
        return o;
      });

      const expandedIds = new Set(s.expandedIds);
      if (newParentId) expandedIds.add(newParentId);
      return { objects: updated, expandedIds };
    });
  },

  ungroupObject: (groupId) => {
    const { objects } = get();
    const group = objects.find(o => o.id === groupId);
    if (!group || group.type !== "group") return;

    get().pushHistory();
    set((s) => {
      const childIds = s.objects.filter(o => o.parentId === groupId).map(o => o.id);
      const groupWorldMatrix = getWorldMatrixForObject(groupId, s.objects);
      const newParentWorldMatrix = group.parentId
        ? getWorldMatrixForObject(group.parentId, s.objects)
        : new THREE.Matrix4();

      let updated = s.objects.map(o => {
        if (childIds.includes(o.id)) {
          const childLocalMatrix = buildLocalMatrix(o);
          const childWorldMatrix = groupWorldMatrix.clone().multiply(childLocalMatrix);
          const newLocal = worldToLocal(childWorldMatrix, newParentWorldMatrix);
          return {
            ...o,
            parentId: group.parentId || undefined,
            ...newLocal,
          };
        }
        return o;
      });

      if (group.parentId) {
        updated = updated.map(o =>
          o.id === group.parentId
            ? { ...o, children: [...(o.children || []).filter(c => c !== groupId), ...childIds] }
            : o
        );
      }

      updated = updated.filter(o => o.id !== groupId);
      return {
        objects: updated,
        selectedId: childIds[0] || null,
        selectedIds: childIds,
      };
    });
  },

  pushHistory: () => {
    set((s) => {
      const trimmed = s.history.slice(0, s.historyIndex + 1);
      const snapshot = JSON.parse(JSON.stringify(s.objects));
      const newHistory = [...trimmed, snapshot].slice(-50);
      return { history: newHistory, historyIndex: newHistory.length - 1 };
    });
  },

  undo: () => {
    set((s) => {
      if (s.historyIndex <= 0) return s;
      const newIdx = s.historyIndex - 1;
      return { objects: JSON.parse(JSON.stringify(s.history[newIdx])), historyIndex: newIdx };
    });
  },

  redo: () => {
    set((s) => {
      if (s.historyIndex >= s.history.length - 1) return s;
      const newIdx = s.historyIndex + 1;
      return { objects: JSON.parse(JSON.stringify(s.history[newIdx])), historyIndex: newIdx };
    });
  },

  exportScene: () => {
    const { objects } = get();
    return JSON.stringify({ version: 2, objects, timestamp: Date.now() }, null, 2);
  },

  importScene: (json) => {
    try {
      const data = JSON.parse(json);
      if (!data.objects || !Array.isArray(data.objects)) return false;
      get().pushHistory();
      const seen = new Set<string>();
      const objects = (data.objects as SceneObject[]).map((obj) => {
        let id = obj.id;
        if (!id || seen.has(id)) {
          id = genId();
        }
        seen.add(id);
        return { ...obj, id };
      });
      set({ objects, selectedId: null, selectedIds: [] });
      return true;
    } catch {
      return false;
    }
  },

  clearScene: () => {
    get().pushHistory();
    set({ objects: [...DEFAULT_OBJECTS], selectedId: null, selectedIds: [] });
  },

  addPrimitive: (type) => {
    const shapes: Record<string, any> = {
      box: { shape: "box", color: "#4488cc", args: [1, 1, 1], metalness: 0.1, roughness: 0.8 },
      sphere: { shape: "sphere", color: "#cc4444", args: [0.5, 32, 32], metalness: 0.2, roughness: 0.6 },
      cylinder: { shape: "cylinder", color: "#44cc44", args: [0.5, 0.5, 1, 32], metalness: 0.1, roughness: 0.7 },
      cone: { shape: "cone", color: "#cccc44", args: [0.5, 1, 32], metalness: 0.1, roughness: 0.7 },
      torus: { shape: "torus", color: "#cc44cc", args: [0.5, 0.2, 16, 32], metalness: 0.3, roughness: 0.5 },
      plane: { shape: "plane", color: "#888888", args: [2, 2], metalness: 0, roughness: 1 },
    };
    const props = shapes[type] || shapes.box;
    get().addObject({
      name: `${type.charAt(0).toUpperCase() + type.slice(1)}`,
      type: "primitive",
      position: [0, props.shape === "plane" ? 0 : 0.5, 0],
      rotation: [props.shape === "plane" ? -Math.PI / 2 : 0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      locked: false,
      properties: props,
    });
  },

  addLight: (type) => {
    const configs: Record<string, any> = {
      point: { lightType: "point", color: "#ffffff", intensity: 2, distance: 20, decay: 2 },
      spot: { lightType: "spot", color: "#ffffff", intensity: 2, distance: 30, angle: 0.5, penumbra: 0.3 },
      directional: { lightType: "directional", color: "#ffffff", intensity: 1, castShadow: true },
      hemisphere: { lightType: "hemisphere", color: "#87ceeb", groundColor: "#8b7355", intensity: 0.6 },
    };
    const props = configs[type] || configs.point;
    get().addObject({
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Light`,
      type: "light",
      position: [0, type === "directional" ? 15 : 3, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      locked: false,
      properties: props,
    });
  },

  addModelToScene: (path, name, targetHeight) => {
    get().addObject({
      name,
      type: "model",
      modelPath: path,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      locked: false,
      properties: { targetHeight: targetHeight ?? 2 },
    });
  },

  addPrefab: (prefab) => {
    get().addObject({
      name: prefab.name,
      type: "prefab",
      modelPath: prefab.modelPath,
      prefabId: prefab.id,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [...prefab.defaultScale],
      visible: true,
      locked: false,
      collider: { ...prefab.collider },
      physicsType: prefab.physicsType,
      navMeshObstacle: prefab.navMeshObstacle,
      navMeshCarve: prefab.navMeshCarve,
      properties: {
        targetHeight: prefab.targetHeight,
        castShadow: prefab.castShadow,
        receiveShadow: prefab.receiveShadow,
        hasAnimations: prefab.hasAnimations,
        category: prefab.category,
        subcategory: prefab.subcategory,
        tags: prefab.tags,
      },
    });
  },

  addEmpty: () => {
    get().addObject({
      name: "Empty",
      type: "empty",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      locked: false,
      properties: {},
    });
  },

  addSpawnPoint: () => {
    get().addObject({
      name: "Spawner",
      type: "spawn",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      locked: false,
      properties: {
        spawnType: "npc",
        prefabId: undefined,
        spawnCount: 1,
        spawnRadius: 5,
        spawnInterval: 0,
        spawnOnLoad: true,
        autoRespawn: false,
        maxAlive: 1,
        faction: "neutral",
      },
    });
  },

  addPrefabSpawner: (prefab) => {
    const npc: any = prefab;
    const isNPC = prefab.category === "character";
    const isHostile = npc.faction === "hostile" || prefab.subcategory === "npc-hostile";
    get().addObject({
      name: `Spawner: ${prefab.name}`,
      type: "spawn",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      locked: false,
      properties: {
        spawnType: isNPC ? "npc" : prefab.category === "item" ? "item" : "object",
        prefabId: prefab.id,
        prefabName: prefab.name,
        spawnCount: 1,
        spawnRadius: isHostile ? 8 : 5,
        spawnInterval: 0,
        spawnOnLoad: true,
        autoRespawn: isHostile,
        maxAlive: isHostile ? 3 : 1,
        faction: npc.faction || (isHostile ? "hostile" : "neutral"),
        behavior: npc.behavior,
        wanderRadius: npc.wanderRadius,
        speed: npc.speed,
        health: npc.health,
        attackDamage: npc.attackDamage,
      },
    });
  },

  addTriggerZone: () => {
    get().addObject({
      name: "Trigger Zone",
      type: "trigger",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [3, 3, 3],
      visible: true,
      locked: false,
      properties: { triggerType: "area", event: "", radius: 3, oneShot: false },
    });
  },

  importGLBAsHierarchy: async (path, opts) => {
    let gltf;
    try {
      gltf = await loadAsset(path, "high", "editor:importGLBAsHierarchy");
    } catch (err) {
      console.error(`[EditorStore] importGLBAsHierarchy: failed to load ${path}`, err);
      return null;
    }
    if (!gltf || !gltf.scene) {
      console.error(`[EditorStore] importGLBAsHierarchy: GLB has no scene: ${path}`);
      return null;
    }
    // AssetLoader serves a placeholder cube instead of throwing when a
    // GLB fails to load (architect callout). Without this guard we'd
    // silently import the placeholder and report success, leaving the
    // user wondering why the tutorial island is now a 1m cube.
    if (isAssetFailed(path)) {
      console.error(
        `[EditorStore] importGLBAsHierarchy: asset failed to load (serving fallback cube): ${path}`,
      );
      return null;
    }

    const { rootId, objects: imported } = glbToSceneObjects(gltf, path, opts);
    get().pushHistory();
    set((s) => ({
      objects: [...s.objects, ...imported],
      selectedId: rootId,
      selectedIds: [rootId],
    }));
    console.log(
      `[EditorStore] Imported ${imported.length} nodes from ${path} (root id ${rootId.slice(0, 8)})`,
    );
    return rootId;
  },
}));
