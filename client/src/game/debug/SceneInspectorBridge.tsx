import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import * as THREE from "three";
import {
  useSceneInspector,
  type InspectorObject,
  type InspectorBody,
  type InspectorAuditEntry,
  type InspectorTextureRef,
} from "@/lib/stores/useSceneInspector";

/**
 * Scene Inspector bridge.
 *
 * Lives INSIDE `<Physics>` so it has access to both R3F's scene and
 * Rapier's world. When the inspector panel is visible (F9), this
 * snapshots the scene tree + the rapier world on a 4Hz throttle and
 * pushes the result into the `useSceneInspector` store for the DOM
 * panel to read.
 *
 * Not a useFrame loop — uses requestAnimationFrame with a manual
 * throttle so it doesn't add per-frame cost when the panel is closed
 * (returns null and never registers anything in that case).
 *
 * Read-only: never mutates the scene or any body.
 */

// Mirror of COLLISION_GROUPS in BuildingColliders.tsx. Kept in sync by
// hand because importing across debug → gameplay would invert the
// dependency.
const COLLISION_GROUP_NAMES: Record<number, string> = {
  0: "TERRAIN",
  1: "PLAYER",
  2: "BUILDING",
  3: "ENEMY",
  4: "PROJECTILE",
  5: "NPC",
  6: "TRIGGER",
  7: "RESOURCE",
  8: "CLIMBABLE",
  9: "LADDER",
};

// Rapier ShapeType enum → human-readable string. The numeric values are
// a stable enum from `@dimforge/rapier3d-compat`.
const SHAPE_NAMES: Record<number, string> = {
  0: "Ball",
  1: "Cuboid",
  2: "Capsule",
  3: "Segment",
  4: "Triangle",
  5: "TriMesh",
  6: "Polyline",
  7: "HalfSpace",
  8: "HeightField",
  9: "Compound",
  10: "ConvexPolyhedron",
  11: "Cylinder",
  12: "Cone",
  13: "RoundCuboid",
  14: "RoundTriangle",
  15: "RoundCylinder",
  16: "RoundCone",
  17: "RoundConvexPolyhedron",
};

const BODY_TYPE_NAMES: Record<number, string> = {
  0: "dynamic",
  1: "fixed",
  2: "kinematicPositionBased",
  3: "kinematicVelocityBased",
};

function decodeMembership(groups: number): number[] {
  const bits = (groups >>> 16) & 0xffff;
  const out: number[] = [];
  for (let i = 0; i < 16; i++) if (bits & (1 << i)) out.push(i);
  return out;
}

function decodeFilter(groups: number): number[] {
  const bits = groups & 0xffff;
  const out: number[] = [];
  for (let i = 0; i < 16; i++) if (bits & (1 << i)) out.push(i);
  return out;
}

function bitsToLayer(bits: number[]): string {
  if (!bits.length) return "(none)";
  return bits.map((b) => COLLISION_GROUP_NAMES[b] ?? `bit${b}`).join("+");
}

const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpEuler = new THREE.Euler();
const tmpBox = new THREE.Box3();
const tmpSize = new THREE.Vector3();

function snapshotScene(scene: THREE.Scene): {
  objects: InspectorObject[];
  audit: InspectorAuditEntry[];
} {
  const objects: InspectorObject[] = [];
  const audit: InspectorAuditEntry[] = [];

  // Track parent uuid → depth for indented rendering.
  const depthByUuid = new Map<string, number>();
  depthByUuid.set(scene.uuid, 0);

  scene.traverse((obj) => {
    const parentUuid = obj.parent?.uuid ?? null;
    const depth = parentUuid ? (depthByUuid.get(parentUuid) ?? 0) + 1 : 0;
    depthByUuid.set(obj.uuid, depth);

    obj.getWorldPosition(tmpPos);
    obj.getWorldQuaternion(tmpQuat);
    obj.getWorldScale(tmpScale);
    tmpEuler.setFromQuaternion(tmpQuat);

    const ref: InspectorObject = {
      uuid: obj.uuid,
      name: obj.name || `(${obj.type})`,
      type: obj.type,
      parentUuid,
      childCount: obj.children.length,
      depth,
      worldPosition: [tmpPos.x, tmpPos.y, tmpPos.z],
      worldRotationDeg: [
        THREE.MathUtils.radToDeg(tmpEuler.x),
        THREE.MathUtils.radToDeg(tmpEuler.y),
        THREE.MathUtils.radToDeg(tmpEuler.z),
      ],
      worldScale: [tmpScale.x, tmpScale.y, tmpScale.z],
      isMesh: false,
    };

    // Auto-audit: NaN positions and below-world objects.
    if (
      !Number.isFinite(tmpPos.x) ||
      !Number.isFinite(tmpPos.y) ||
      !Number.isFinite(tmpPos.z)
    ) {
      audit.push({
        id: `nan-${obj.uuid}`,
        severity: "error",
        message: `${ref.name} has NaN world position`,
        objectUuid: obj.uuid,
      });
    } else if (tmpPos.y < -100 && obj.type !== "Scene") {
      audit.push({
        id: `below-${obj.uuid}`,
        severity: "warn",
        message: `${ref.name} is below y=-100 (y=${tmpPos.y.toFixed(1)})`,
        objectUuid: obj.uuid,
      });
    }

    if ((obj as THREE.Mesh).isMesh || (obj as THREE.SkinnedMesh).isSkinnedMesh) {
      const mesh = obj as THREE.Mesh;
      const geom = mesh.geometry;
      const matRaw = mesh.material as THREE.Material | THREE.Material[];
      const mat = Array.isArray(matRaw) ? matRaw[0] : matRaw;
      ref.isMesh = true;
      const posAttr = geom?.attributes?.position;
      ref.vertexCount = posAttr?.count ?? 0;
      const indexed = geom?.index?.count ?? 0;
      ref.triangleCount = indexed
        ? Math.floor(indexed / 3)
        : Math.floor((ref.vertexCount ?? 0) / 3);
      ref.hasSkeleton = !!(mesh as unknown as THREE.SkinnedMesh).skeleton;
      ref.materialName = mat?.name || mat?.type || "(no material)";
      ref.materialType = mat?.type || "unknown";

      try {
        tmpBox.setFromObject(mesh);
        tmpBox.getSize(tmpSize);
        ref.bboxSize = [tmpSize.x, tmpSize.y, tmpSize.z];
      } catch {
        // Skinned meshes mid-bind can throw; ignore.
      }

      const textures: InspectorTextureRef[] = [];
      if (mat) {
        const slots = [
          "map",
          "normalMap",
          "roughnessMap",
          "metalnessMap",
          "emissiveMap",
          "aoMap",
          "alphaMap",
          "bumpMap",
        ];
        for (const slot of slots) {
          const tex = (mat as unknown as Record<string, THREE.Texture | null>)[slot];
          if (tex) {
            const src =
              ((tex as THREE.Texture).source?.data as { src?: string } | undefined)?.src ??
              ((tex as THREE.Texture).image as { src?: string } | undefined)?.src ??
              null;
            const missing = !tex.image && !src;
            textures.push({ slot, path: src, missing });
            if (missing) {
              audit.push({
                id: `tex-${obj.uuid}-${slot}`,
                severity: "warn",
                message: `${ref.name} missing texture for ${slot}`,
                objectUuid: obj.uuid,
              });
            }
          }
        }
      } else {
        audit.push({
          id: `nomat-${obj.uuid}`,
          severity: "warn",
          message: `${ref.name} has no material`,
          objectUuid: obj.uuid,
        });
      }
      ref.textures = textures;
    }

    objects.push(ref);
  });

  return { objects, audit };
}

function snapshotPhysics(world: unknown): {
  bodies: InspectorBody[];
  audit: InspectorAuditEntry[];
} {
  const bodies: InspectorBody[] = [];
  const audit: InspectorAuditEntry[] = [];
  // Defensive: rapier world API differs across versions; guard with any.
  const w = world as {
    bodies?: { forEach: (fn: (rb: unknown) => void) => void };
    forEachRigidBody?: (fn: (rb: unknown) => void) => void;
  };
  const iterate = w.bodies?.forEach
    ? (fn: (rb: unknown) => void) => w.bodies!.forEach(fn)
    : w.forEachRigidBody
    ? (fn: (rb: unknown) => void) => w.forEachRigidBody!(fn)
    : null;
  if (!iterate) return { bodies, audit };

  iterate((rb: unknown) => {
    const b = rb as {
      handle: number;
      bodyType: () => number;
      translation: () => { x: number; y: number; z: number };
      mass?: () => number;
      numColliders: () => number;
      collider: (i: number) => unknown;
    };
    try {
      const handle = b.handle;
      const bodyTypeNum = b.bodyType();
      const t = b.translation();
      const numCol = b.numColliders();
      const firstCol = numCol > 0 ? (b.collider(0) as {
        shape?: { type?: number };
        collisionGroups: () => number;
        isSensor?: () => boolean;
      }) : null;
      const groups = firstCol ? firstCol.collisionGroups() : 0;
      const membership = decodeMembership(groups);
      const filter = decodeFilter(groups);
      const shapeType = firstCol?.shape?.type ?? -1;
      const colliderShape =
        shapeType >= 0 ? SHAPE_NAMES[shapeType] ?? `shape${shapeType}` : "(none)";

      bodies.push({
        handle,
        bodyType: BODY_TYPE_NAMES[bodyTypeNum] ?? `type${bodyTypeNum}`,
        translation: [t.x, t.y, t.z],
        colliderShape,
        membership,
        filter,
        layerName: bitsToLayer(membership),
        isSensor: firstCol?.isSensor?.() ?? false,
        mass: b.mass?.(),
      });

      // Audit: dynamic body with trimesh collider is a known perf trap.
      if (bodyTypeNum === 0 && shapeType === 5) {
        audit.push({
          id: `trimesh-dyn-${handle}`,
          severity: "warn",
          message: `Dynamic body #${handle} uses TriMesh collider (perf trap — use convex hull or compound)`,
          bodyHandle: handle,
        });
      }
      // Audit: body with no collision groups (will collide with everything OR nothing depending on rapier defaults)
      if (groups === 0) {
        audit.push({
          id: `nogroup-${handle}`,
          severity: "info",
          message: `Body #${handle} has no collision groups set (default behaviour)`,
          bodyHandle: handle,
        });
      }
    } catch {
      // Skip malformed bodies silently.
    }
  });

  return { bodies, audit };
}

export function SceneInspectorBridge() {
  const { scene } = useThree();
  const { world } = useRapier();
  const visible = useSceneInspector((s) => s.visible);
  const setSnapshot = useSceneInspector((s) => s.setSnapshot);
  const lastTickRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    const tick = () => {
      const now = performance.now();
      if (now - lastTickRef.current > 250) {
        lastTickRef.current = now;
        const t0 = performance.now();
        const sceneSnap = snapshotScene(scene);
        const physSnap = snapshotPhysics(world);
        const snapshotMs = performance.now() - t0;
        setSnapshot({
          objects: sceneSnap.objects,
          bodies: physSnap.bodies,
          audit: [...sceneSnap.audit, ...physSnap.audit],
          snapshotMs,
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [visible, scene, world, setSnapshot]);

  return null;
}
