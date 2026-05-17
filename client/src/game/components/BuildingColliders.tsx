import { useMemo, useState, useEffect } from "react";
import { RigidBody, CuboidCollider, interactionGroups } from "@react-three/rapier";
import { getTerrainHeight, globalHeightData } from "./Terrain";
import { useCheats } from "@/lib/stores/useCheats";
import {
  buildOrientedBoxDebugTrimesh,
  useDebugColliderRegistration,
  type DebugColliderEntry,
} from "../cheats/StreamedColliderDebugOverlay";

function th(x: number, z: number): number {
  return getTerrainHeight(x, z, globalHeightData);
}

export const COLLISION_GROUPS = {
  TERRAIN:     0,
  PLAYER:      1,
  BUILDING:    2,
  ENEMY:       3,
  PROJECTILE:  4,
  NPC:         5,
  TRIGGER:     6,
  RESOURCE:    7,
  // Climbing surfaces (rough walls / cliff faces) — solid hull does NOT
  // block the player capsule; player approach is detected via a sibling
  // sensor and the climb-stick raycast filters by this group.
  CLIMBABLE:   8,
  // Ladders — rungs lightly block the player so they don't clip through
  // the back of the ladder; entry / topout sensors share the same group.
  LADDER:      9,
  // Hero squad members, recruited ally NPCs, Gouldstone companions.
  // Separate from NPC(5) so ally-vs-ally stacking is suppressed while
  // allies still collide with enemies and terrain.
  ALLY:        10,
  // Swim volume sensor — only the player capsule triggers it.
  WATER:       11,
  // Sailing physics body — collides with terrain, player, and buildings
  // so the boat doesn't fall through the ocean floor.
  BOAT:        12,
  // Dropped loot spheres — trigger-only, only the player can pick them up.
  LOOT:        13,
};

export const COLLISION_MASKS = {
  // Terrain blocks player, enemies, projectiles, NPCs, allies.
  TERRAIN:     interactionGroups([0], [1, 3, 4, 5, 10, 12]),
  // Player now collides with NPCs/animals/allies (group 5 + 10) so the
  // kinematic capsules on those characters push the player back.
  // Bits 8 (CLIMBABLE) and 9 (LADDER) are added so climb sensors fire;
  // sensor matching is symmetric in Rapier. Also hits LOOT(13) triggers.
  PLAYER:      interactionGroups([1], [0, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13]),
  // Buildings block player, enemies, projectiles, NPCs, allies, boats.
  BUILDING:    interactionGroups([2], [1, 3, 4, 5, 10, 12]),
  // Enemies collide with each other (3) plus allies (10).
  ENEMY:       interactionGroups([3], [0, 1, 2, 3, 4, 10]),
  PROJECTILE:  interactionGroups([4], [0, 2, 3]),
  // NPCs/animals collide with terrain, player, buildings.
  NPC:         interactionGroups([5], [0, 1, 2]),
  TRIGGER:     interactionGroups([6], [1]),
  RESOURCE:    interactionGroups([7], [1]),
  CLIMBABLE:        interactionGroups([8], [4]),
  CLIMBABLE_SENSOR: interactionGroups([8], [1]),
  LADDER:           interactionGroups([9], [1, 4]),
  LADDER_SENSOR:    interactionGroups([9], [1]),
  // Allies collide with terrain, buildings, enemies. NOT with each other
  // (no group 10 in the mask) — prevents squad members stacking.
  ALLY:        interactionGroups([10], [0, 2, 3]),
  // Water sensor — only triggers on the player capsule.
  WATER:       interactionGroups([11], [1]),
  // Boat physics — terrain, player, buildings.
  BOAT:        interactionGroups([12], [0, 1, 2]),
  // Loot pickup triggers — player only.
  LOOT:        interactionGroups([13], [1]),
};

interface ColliderDef {
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
}

function StaticBox({ position, size, rotation }: ColliderDef) {
  return (
    <RigidBody
      type="fixed"
      position={position}
      rotation={rotation || [0, 0, 0]}
      colliders={false}
      collisionGroups={COLLISION_MASKS.BUILDING}
    >
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} friction={0.4} restitution={0.0} />
    </RigidBody>
  );
}

let debugMode = false;
export function setPhysicsDebug(v: boolean) { debugMode = v; }
export function getPhysicsDebug() { return debugMode; }

function DebugBox({ position, size, rotation }: ColliderDef) {
  return (
    <mesh position={position} rotation={rotation || [0, 0, 0]}>
      <boxGeometry args={size} />
      <meshBasicMaterial color="#00ff00" wireframe transparent opacity={0.4} />
    </mesh>
  );
}

export default function BuildingColliders() {
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F3") {
        debugMode = !debugMode;
        setShowDebug(debugMode);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const colliders = useMemo(() => {
    const defs: ColliderDef[] = [];

    const medBuildings: { x: number; z: number; w: number; h: number; d: number; r: number }[] = [
      { x: -15, z: -25, w: 6, h: 10, d: 6, r: 0.8 },
      { x: 15, z: -20, w: 6, h: 11, d: 6, r: 2.2 },
      { x: -12, z: 20, w: 5, h: 8, d: 5, r: 1.5 },
      { x: 12, z: 25, w: 4, h: 6, d: 4, r: 3.0 },
      { x: -30, z: -10, w: 6, h: 12, d: 6, r: 0.3 },
      { x: 30, z: -40, w: 4, h: 14, d: 4, r: 1.0 },
      { x: -35, z: 15, w: 6, h: 9, d: 6, r: 2.1 },
      { x: 35, z: 10, w: 5, h: 7, d: 5, r: 0.7 },
      { x: -20, z: -45, w: 6, h: 9, d: 5, r: 1.8 },
      { x: 0, z: -30, w: 3, h: 14, d: 3, r: 0 },
      { x: 0, z: -40, w: 7, h: 8, d: 3, r: 0 },
      { x: -40, z: -35, w: 6, h: 10, d: 6, r: 0.4 },
      { x: 50, z: -30, w: 6, h: 10, d: 6, r: 2.8 },
      { x: -50, z: 10, w: 6, h: 10, d: 6, r: 1.6 },
    ];

    const rtsBuildings: { x: number; z: number; w: number; h: number; d: number; r: number }[] = [
      { x: -60, z: -60, w: 12, h: 18, d: 12, r: 0.5 },
      { x: 60, z: -60, w: 4, h: 12, d: 4, r: 1.0 },
      { x: -60, z: 45, w: 4, h: 8, d: 4, r: 2.5 },
      { x: 70, z: 55, w: 7, h: 12, d: 7, r: 3.0 },
      { x: -75, z: -40, w: 5, h: 7, d: 5, r: 1.2 },
      { x: 75, z: -35, w: 10, h: 15, d: 10, r: 2.0 },
      { x: -80, z: 10, w: 5, h: 10, d: 5, r: 1.0 },
      { x: 80, z: 15, w: 7, h: 12, d: 7, r: 2.5 },
      { x: 0, z: 55, w: 6, h: 10, d: 6, r: 0 },
    ];

    const elfBuildings: { x: number; z: number; r: number }[] = [
      { x: 20, z: -30, r: 0.5 },
      { x: -25, z: 25, r: 1.2 },
      { x: 40, z: 15, r: 2.5 },
      { x: -55, z: -30, r: 0.8 },
      { x: 65, z: -50, r: 1.7 },
      { x: -70, z: 55, r: 3.1 },
      { x: 80, z: 30, r: 0.3 },
    ];

    const structBuildings: { x: number; z: number; w: number; h: number; d: number; r: number }[] = [
      { x: -38, z: -15, w: 4, h: 6, d: 4, r: 0.6 },
      { x: -8, z: 38, w: 5, h: 7, d: 5, r: 1.2 },
      { x: -72, z: -10, w: 5, h: 10, d: 5, r: 0.9 },
      { x: -28, z: 2, w: 4, h: 7, d: 4, r: 1.5 },
      { x: -10, z: 22, w: 4, h: 6, d: 4, r: 2.8 },
      { x: -58, z: -65, w: 6, h: 15, d: 6, r: 0.4 },
      { x: 68, z: -28, w: 6, h: 10, d: 6, r: 1.8 },
      { x: 62, z: -42, w: 4, h: 12, d: 4, r: 0.5 },
      { x: -62, z: -58, w: 5, h: 8, d: 5, r: 0.3 },
      { x: -85, z: -80, w: 6, h: 10, d: 6, r: 1.0 },
      { x: 85, z: 70, w: 12, h: 16, d: 12, r: 0 },
    ];

    medBuildings.forEach(({ x, z, w, h, d, r }) => {
      const y = th(x, z);
      defs.push({
        position: [x, y + h / 2, z],
        size: [w, h, d],
        rotation: [0, r, 0],
      });
    });

    rtsBuildings.forEach(({ x, z, w, h, d, r }) => {
      const y = th(x, z);
      defs.push({
        position: [x, y + h / 2, z],
        size: [w, h, d],
        rotation: [0, r, 0],
      });
    });

    elfBuildings.forEach(({ x, z, r }) => {
      const y = th(x, z);
      defs.push({
        position: [x, y + 5, z],
        size: [6, 10, 6],
        rotation: [0, r, 0],
      });
    });

    structBuildings.forEach(({ x, z, w, h, d, r }) => {
      const y = th(x, z);
      defs.push({
        position: [x, y + h / 2, z],
        size: [w, h, d],
        rotation: [0, r, 0],
      });
    });

    const smallProps: { x: number; z: number; w: number; h: number; d: number; r?: number }[] = [
      { x: 18, z: 5, w: 1.5, h: 2.5, d: 1.5 },
      { x: -16, z: -12, w: 1.5, h: 2, d: 1.5 },
      { x: 16, z: -12, w: 1.5, h: 2.5, d: 1.5 },
      { x: -14, z: -23, w: 1, h: 1.2, d: 1 },
      { x: -16, z: -24, w: 1, h: 1.2, d: 1 },
      { x: 14, z: -18, w: 1, h: 1.4, d: 1 },
      { x: 16, z: -19, w: 1, h: 1.2, d: 1 },
      { x: 25, z: 8, w: 3, h: 2.5, d: 2, r: 0.6 },
    ];
    smallProps.forEach(({ x, z, w, h, d, r }) => {
      const y = th(x, z);
      defs.push({
        position: [x, y + h / 2, z],
        size: [w, h, d],
        rotation: r ? [0, r, 0] as [number, number, number] : undefined,
      });
    });

    return defs;
  }, []);

  // F8 collider overlay: surface every static-building box as a debug
  // entry. Gated on the cheat so the trimesh build skips entirely on
  // production runs. Memoized on `colliders` (a stable list with empty
  // deps), so the registry only re-publishes on the cheat-toggle edge.
  const debugOn = useCheats((s) => s.enabled && s.debugColliders);
  const debugEntries = useMemo<DebugColliderEntry[] | null>(() => {
    if (!debugOn) return null;
    return colliders.map((c, i) => {
      const [px, py, pz] = c.position;
      const [w, h, d] = c.size;
      const rotY = c.rotation ? c.rotation[1] : 0;
      const { vertices, indices, bbox } = buildOrientedBoxDebugTrimesh(
        px, py, pz, w / 2, h / 2, d / 2, rotY,
      );
      return {
        name: "static_building",
        vertices,
        indices,
        bbox,
      };
    });
  }, [debugOn, colliders]);
  useDebugColliderRegistration("BuildingColliders", debugEntries);

  return (
    <>
      {colliders.map((c, i) => (
        <StaticBox key={`bcol_${i}`} position={c.position} size={c.size} rotation={c.rotation} />
      ))}
      {showDebug && colliders.map((c, i) => (
        <DebugBox key={`dbg_${i}`} position={c.position} size={c.size} rotation={c.rotation} />
      ))}
    </>
  );
}
