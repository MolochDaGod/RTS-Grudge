import { useMemo } from "react";
import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { useCheats } from "@/lib/stores/useCheats";

interface Props {
  /** Same Float32Array passed to `<ConvexHullCollider args={[points]}>`,
   *  expressed in the rigid body's local frame. We rebuild the convex
   *  hull mesh client-side (cheap — Rapier and three's ConvexHull both
   *  use QuickHull, so the silhouettes match). */
  points: Float32Array | null;
}

/**
 * Wireframe overlay of the player's convex-hull collider.
 *
 * Mounted as a sibling of the `<ConvexHullCollider>` INSIDE the
 * `<RigidBody>` so it inherits the body's per-frame transform and
 * tracks the player perfectly without any manual setPosition wiring.
 *
 * Hidden unless the cheats panel is enabled AND the "Player collider"
 * row is on (`debugPlayerCollider`). Read-only; no physics side
 * effects, no allocations on the hot path — the geometry is memoised
 * against the input points reference.
 */
export function PlayerColliderDebug({ points }: Props) {
  const enabled = useCheats((s) => s.enabled && s.debugPlayerCollider);

  const geometry = useMemo(() => {
    if (!enabled || !points || points.length < 12) return null;
    const verts: THREE.Vector3[] = new Array(points.length / 3);
    for (let i = 0; i < points.length; i += 3) {
      verts[i / 3] = new THREE.Vector3(points[i], points[i + 1], points[i + 2]);
    }
    try {
      return new ConvexGeometry(verts);
    } catch (e: any) {
      // Degenerate point cloud (all coplanar) — bail silently.
      console.warn("[PlayerColliderDebug] hull build failed:", e?.message || e);
      return null;
    }
  }, [enabled, points]);

  if (!enabled || !geometry) return null;

  return (
    <group>
      {/* Bright wireframe — depthTest off so the hull is visible even
          when the camera is behind/inside the character mesh. */}
      <mesh geometry={geometry} renderOrder={9999}>
        <meshBasicMaterial
          color="#00ff66"
          wireframe
          transparent
          opacity={0.85}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Faint solid fill so the silhouette reads at a glance even when
          the wires get dense around the head/hands. */}
      <mesh geometry={geometry} renderOrder={9998}>
        <meshBasicMaterial
          color="#00ff66"
          transparent
          opacity={0.07}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
