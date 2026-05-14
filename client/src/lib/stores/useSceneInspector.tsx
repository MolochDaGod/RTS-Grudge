import { create } from "zustand";

/**
 * Scene Inspector store.
 *
 * F9-toggled debug overlay. Aggregates a snapshot of the live R3F scene
 * tree + the live Rapier physics world into a flat list the DOM panel
 * can render. The `<SceneInspectorBridge>` (mounted inside `<Physics>`)
 * walks the scene + world on a 4Hz throttle and pushes the result here
 * via `setSnapshot`. The DOM panel reads from this store with shallow
 * selectors so it only re-renders when the relevant slice changes.
 *
 * Read-only: this store NEVER mutates the scene or any rigid body. It
 * is a pure visibility surface so we can finally see ground truth about
 * what is in the world before we try to fix anything.
 *
 * Layer naming follows `COLLISION_GROUPS` in
 * `client/src/game/components/BuildingColliders.tsx` — bit 0 = TERRAIN,
 * bit 1 = PLAYER, ..., bit 9 = LADDER. Bodies whose collider belongs to
 * multiple groups get a "+"-joined label (e.g. "BUILDING+TRIGGER").
 */

export interface InspectorTextureRef {
  slot: string;
  path: string | null;
  missing: boolean;
}

export interface InspectorObject {
  uuid: string;
  name: string;
  type: string; // Object3D.type — "Mesh", "Group", "Bone", "SkinnedMesh", etc.
  parentUuid: string | null;
  childCount: number;
  depth: number;
  worldPosition: [number, number, number];
  worldRotationDeg: [number, number, number];
  worldScale: [number, number, number];
  // Mesh-specific
  isMesh: boolean;
  vertexCount?: number;
  triangleCount?: number;
  hasSkeleton?: boolean;
  materialName?: string;
  materialType?: string;
  textures?: InspectorTextureRef[];
  bboxSize?: [number, number, number];
}

export interface InspectorBody {
  handle: number;
  bodyType: string; // dynamic | fixed | kinematicPositionBased | kinematicVelocityBased
  translation: [number, number, number];
  colliderShape: string;
  membership: number[]; // bit positions (0-15) the collider belongs to
  filter: number[]; // bit positions the collider can interact with
  layerName: string; // joined name of membership bits
  isSensor: boolean;
  mass?: number;
}

export interface InspectorAuditEntry {
  id: string;
  severity: "error" | "warn" | "info";
  message: string;
  objectUuid?: string;
  bodyHandle?: number;
}

export interface InspectorState {
  visible: boolean;
  selectedUuid: string | null;
  selectedBodyHandle: number | null;
  objects: InspectorObject[];
  bodies: InspectorBody[];
  layerCounts: Record<string, number>;
  audit: InspectorAuditEntry[];
  lastSnapshotAt: number;
  snapshotMs: number;

  toggle: () => void;
  setVisible: (v: boolean) => void;
  selectObject: (uuid: string | null) => void;
  selectBody: (handle: number | null) => void;
  setSnapshot: (data: {
    objects: InspectorObject[];
    bodies: InspectorBody[];
    audit: InspectorAuditEntry[];
    snapshotMs: number;
  }) => void;
}

export const useSceneInspector = create<InspectorState>((set) => ({
  visible: false,
  selectedUuid: null,
  selectedBodyHandle: null,
  objects: [],
  bodies: [],
  layerCounts: {},
  audit: [],
  lastSnapshotAt: 0,
  snapshotMs: 0,
  toggle: () => set((s) => ({ visible: !s.visible })),
  setVisible: (v) => set({ visible: v }),
  selectObject: (uuid) => set({ selectedUuid: uuid }),
  selectBody: (handle) => set({ selectedBodyHandle: handle }),
  setSnapshot: ({ objects, bodies, audit, snapshotMs }) => {
    const layerCounts: Record<string, number> = {};
    for (const b of bodies) {
      const key = b.layerName || "(none)";
      layerCounts[key] = (layerCounts[key] || 0) + 1;
    }
    set({
      objects,
      bodies,
      audit,
      layerCounts,
      lastSnapshotAt: performance.now(),
      snapshotMs,
    });
  },
}));
