/**
 * Climbable surface authoring primitives — wall faces and ladders.
 *
 * Both components emit a *non-blocking* solid hull (so the player capsule
 * can pass through during the stick-to-wall climb) plus a sensor in front
 * of the face that announces the player's proximity to the climb
 * controller via the singleton in `nearClimbable.ts`. Ladders also drop
 * a small top-of-rungs sensor so the controller can transition to the
 * `climb_topout` animation.
 *
 * Author by dropping into a scene at world coordinates with a normal
 * (default +Z) and dimensions in metres. Rotation is expressed by passing
 * the desired Euler so the convex hull, sensors, and reported normal all
 * agree.
 */

import { useId, useMemo } from "react";
import { ConvexHullCollider, CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { COLLISION_MASKS } from "./BuildingColliders";
import { getPhysicsDebug } from "./BuildingColliders";
import {
  pushNearClimbable,
  popNearClimbable,
  setAtTop,
  type NearClimbableInfo,
} from "./nearClimbable";
import { useCheats } from "@/lib/stores/useCheats";
import {
  buildOrientedBoxDebugTrimesh,
  useDebugColliderRegistration,
  type DebugColliderEntry,
} from "../cheats/StreamedColliderDebugOverlay";

// --- helpers ---------------------------------------------------------------

/** 8 corner vertices of an axis-aligned box, packed for ConvexHullCollider. */
function boxHullVerts(hx: number, hy: number, hz: number): Float32Array {
  return new Float32Array([
    -hx, -hy, -hz,
     hx, -hy, -hz,
     hx,  hy, -hz,
    -hx,  hy, -hz,
    -hx, -hy,  hz,
     hx, -hy,  hz,
     hx,  hy,  hz,
    -hx,  hy,  hz,
  ]);
}

/** Apply an Euler-Y rotation to a [x,y,z] vector. Used to project the
 *  authoring `rotationY` onto the world-space normal / right vectors that
 *  the climb controller consumes. */
function rotY(v: [number, number, number], rotY: number): [number, number, number] {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

// --- WallClimbable ---------------------------------------------------------

export interface WallClimbableProps {
  /** World position of the wall face *centre* (foot-of-wall + half-height). */
  position: [number, number, number];
  /** Width × height × thickness, in metres. */
  size: [number, number, number];
  /** Rotation around world-Y. The wall faces +Z by default. */
  rotationY?: number;
}

/**
 * A climbable wall face. Renders a ConvexHullCollider (CLIMBABLE group, not
 * solid against the player) and a thin sensor slab pressed against the
 * front face. While the player capsule overlaps the sensor, the wall is
 * registered as the active climbable target.
 */
export function WallClimbable({ position, size, rotationY = 0 }: WallClimbableProps) {
  const id = useId();
  const [w, h, t] = size;

  const hullVerts = useMemo(() => boxHullVerts(w / 2, h / 2, t / 2), [w, h, t]);

  // Sensor sits in front of the wall (+Z in local frame, projected to world).
  const SENSOR_DEPTH = 1.4; // arm-reach for grabbing the wall.
  const sensorLocal: [number, number, number] = [0, 0, t / 2 + SENSOR_DEPTH / 2];
  const sensorOffset = rotY(sensorLocal, rotationY);

  const normal = useMemo<[number, number, number]>(
    () => rotY([0, 0, 1], rotationY),
    [rotationY],
  );
  const right = useMemo<[number, number, number]>(
    () => rotY([1, 0, 0], rotationY),
    [rotationY],
  );
  const topY = position[1] + h / 2;

  const debug = getPhysicsDebug();

  // F8 collider overlay: surface both the solid hull (which is just the
  // 8-corner box) and the front sensor as separate, colour-grouped
  // chunks so a debugger can tell at a glance which face is solid for
  // raycasts and which radius triggers the climb-stick.
  //
  // Dependencies are flattened to scalars on purpose — the `position`
  // tuple is JSX-literal authored at the call site, so it gets a fresh
  // identity every parent render. Hashing on the three numbers keeps
  // the registry from re-publishing on uneventful frames.
  const debugOn = useCheats((s) => s.enabled && s.debugColliders);
  const px = position[0], py = position[1], pz = position[2];
  const sx = sensorOffset[0], sy = sensorOffset[1], sz = sensorOffset[2];
  const debugEntries = useMemo<DebugColliderEntry[] | null>(() => {
    if (!debugOn) return null;
    const hull = buildOrientedBoxDebugTrimesh(
      px, py, pz, w / 2, h / 2, t / 2, rotationY,
    );
    const sensor = buildOrientedBoxDebugTrimesh(
      px + sx, py + sy, pz + sz,
      w / 2, h / 2, SENSOR_DEPTH / 2, rotationY,
    );
    return [
      { name: "climb_wall_hull",
        vertices: hull.vertices, indices: hull.indices, bbox: hull.bbox },
      { name: "climb_wall_sensor",
        vertices: sensor.vertices, indices: sensor.indices, bbox: sensor.bbox },
    ];
  }, [debugOn, id, px, py, pz, sx, sy, sz, w, h, t, rotationY]);
  useDebugColliderRegistration(`WallClimbable_${id}`, debugEntries);

  return (
    <RigidBody type="fixed" position={position} rotation={[0, rotationY, 0]} colliders={false}>
      {/* Solid (but non-blocking-vs-player) convex hull for raycast / projectile hits. */}
      <ConvexHullCollider
        args={[hullVerts]}
        collisionGroups={COLLISION_MASKS.CLIMBABLE}
      />
      {/* Front sensor — fires when the player capsule overlaps. */}
      <CuboidCollider
        args={[w / 2, h / 2, SENSOR_DEPTH / 2]}
        position={[0, 0, t / 2 + SENSOR_DEPTH / 2]}
        sensor
        collisionGroups={COLLISION_MASKS.CLIMBABLE_SENSOR}
        onIntersectionEnter={() => {
          const info: NearClimbableInfo = {
            id,
            kind: "wall",
            normal,
            anchor: [
              position[0] + sensorOffset[0],
              position[1],
              position[2] + sensorOffset[2],
            ],
            right,
            topY,
            atTop: false,
          };
          pushNearClimbable(info);
        }}
        onIntersectionExit={() => popNearClimbable(id)}
      />
      {debug && (
        <mesh>
          <boxGeometry args={[w, h, t]} />
          <meshBasicMaterial color="#22cc66" wireframe transparent opacity={0.55} />
        </mesh>
      )}
      {debug && (
        <mesh position={[0, 0, t / 2 + SENSOR_DEPTH / 2]}>
          <boxGeometry args={[w, h, SENSOR_DEPTH]} />
          <meshBasicMaterial color="#66ddff" wireframe transparent opacity={0.25} />
        </mesh>
      )}
    </RigidBody>
  );
}

// --- LadderClimbable -------------------------------------------------------

export interface LadderClimbableProps {
  /** World position of the *base* of the ladder (foot of bottom rung). */
  position: [number, number, number];
  /** Total ladder height in metres. */
  height: number;
  /** Ladder width (rung length) in metres. */
  width?: number;
  /** Rotation around world-Y. The ladder face is +Z by default. */
  rotationY?: number;
}

/**
 * A vertical ladder. The rungs are a thin slab that lightly blocks the
 * player capsule (so the body doesn't pop through the back). A tall front
 * sensor governs proximity, and a small slab at the very top fires the
 * topout signal so the controller can play `climb_topout` and dismount
 * onto the platform above.
 */
export function LadderClimbable({
  position,
  height,
  width = 0.8,
  rotationY = 0,
}: LadderClimbableProps) {
  const id = useId();
  const RUNG_THICKNESS = 0.12;
  const SENSOR_DEPTH = 1.0;
  const TOP_SENSOR_HEIGHT = 0.6;

  const normal = useMemo<[number, number, number]>(
    () => rotY([0, 0, 1], rotationY),
    [rotationY],
  );
  const right = useMemo<[number, number, number]>(
    () => rotY([1, 0, 0], rotationY),
    [rotationY],
  );
  const topY = position[1] + height;

  // Centre offsets in local frame (RigidBody applies position+rotation).
  const rungCentreY = height / 2;
  const sensorCentreLocal: [number, number, number] = [0, height / 2, RUNG_THICKNESS / 2 + SENSOR_DEPTH / 2];
  const sensorOffset = rotY(sensorCentreLocal, rotationY);

  const debug = getPhysicsDebug();

  // F8 collider overlay: surface the rung slab, proximity sensor, and
  // top-out sensor as three separately colour-grouped chunks. Each
  // mirrors the world-space transform applied to the matching Rapier
  // collider below so what you see on F8 is exactly what physics sees.
  // Scalar deps to avoid identity churn from JSX-literal arrays.
  const debugOn = useCheats((s) => s.enabled && s.debugColliders);
  const px = position[0], py = position[1], pz = position[2];
  const sx = sensorOffset[0], sy = sensorOffset[1], sz = sensorOffset[2];
  const debugEntries = useMemo<DebugColliderEntry[] | null>(() => {
    if (!debugOn) return null;
    // Rung slab — local centre (0, rungCentreY, 0) projected to world.
    // The local x/z offset is 0 so yaw rotation maps it to (0, 0) again;
    // only the height offset survives.
    const rungs = buildOrientedBoxDebugTrimesh(
      px, py + rungCentreY, pz,
      width / 2, height / 2, RUNG_THICKNESS / 2, rotationY,
    );
    // Proximity sensor centred at sensorOffset from the ladder base.
    const sensor = buildOrientedBoxDebugTrimesh(
      px + sx, py + sy, pz + sz,
      width / 2 + 0.2, height / 2, SENSOR_DEPTH / 2, rotationY,
    );
    // Top-out sensor — same horizontal projection as the proximity
    // sensor, but at the top of the ladder with a slim vertical extent.
    // Local y centre is `height - TOP_SENSOR_HEIGHT / 2`, which becomes
    // a world y of `py + height - TOP_SENSOR_HEIGHT / 2` (yaw doesn't
    // affect y), and the same +Z local offset projected via `(sx,sz)`.
    const top = buildOrientedBoxDebugTrimesh(
      px + sx, py + height - TOP_SENSOR_HEIGHT / 2, pz + sz,
      width / 2 + 0.2, TOP_SENSOR_HEIGHT / 2, SENSOR_DEPTH / 2 + 0.1, rotationY,
    );
    return [
      { name: "climb_ladder_rungs",
        vertices: rungs.vertices, indices: rungs.indices, bbox: rungs.bbox },
      { name: "climb_ladder_sensor",
        vertices: sensor.vertices, indices: sensor.indices, bbox: sensor.bbox },
      { name: "climb_ladder_top",
        vertices: top.vertices, indices: top.indices, bbox: top.bbox },
    ];
  }, [debugOn, id, px, py, pz, sx, sy, sz, width, height, rotationY, rungCentreY]);
  useDebugColliderRegistration(`LadderClimbable_${id}`, debugEntries);

  return (
    <RigidBody type="fixed" position={position} rotation={[0, rotationY, 0]} colliders={false}>
      {/* Rung slab — solid, blocks player + projectiles. */}
      <CuboidCollider
        args={[width / 2, height / 2, RUNG_THICKNESS / 2]}
        position={[0, rungCentreY, 0]}
        collisionGroups={COLLISION_MASKS.LADDER}
      />
      {/* Entry / proximity sensor in front of the rungs. */}
      <CuboidCollider
        args={[width / 2 + 0.2, height / 2, SENSOR_DEPTH / 2]}
        position={[0, rungCentreY, RUNG_THICKNESS / 2 + SENSOR_DEPTH / 2]}
        sensor
        collisionGroups={COLLISION_MASKS.LADDER_SENSOR}
        onIntersectionEnter={() => {
          pushNearClimbable({
            id,
            kind: "ladder",
            normal,
            anchor: [
              position[0] + sensorOffset[0],
              position[1],
              position[2] + sensorOffset[2],
            ],
            right,
            topY,
            atTop: false,
          });
        }}
        onIntersectionExit={() => popNearClimbable(id)}
      />
      {/* Top-out sensor — sits straddling the topmost rung so the player's
          chest crossing it fires the topout transition. Uses a unique id
          suffix so its enter/exit doesn't clobber the proximity entry. */}
      <CuboidCollider
        args={[width / 2 + 0.2, TOP_SENSOR_HEIGHT / 2, SENSOR_DEPTH / 2 + 0.1]}
        position={[0, height - TOP_SENSOR_HEIGHT / 2, RUNG_THICKNESS / 2 + SENSOR_DEPTH / 2]}
        sensor
        collisionGroups={COLLISION_MASKS.LADDER_SENSOR}
        onIntersectionEnter={() => setAtTop(id, true)}
        onIntersectionExit={() => setAtTop(id, false)}
      />
      {debug && (
        <mesh position={[0, rungCentreY, 0]}>
          <boxGeometry args={[width, height, RUNG_THICKNESS]} />
          <meshBasicMaterial color="#cc8822" wireframe transparent opacity={0.7} />
        </mesh>
      )}
      {debug && (
        <mesh position={[0, rungCentreY, RUNG_THICKNESS / 2 + SENSOR_DEPTH / 2]}>
          <boxGeometry args={[width + 0.4, height, SENSOR_DEPTH]} />
          <meshBasicMaterial color="#ffaa44" wireframe transparent opacity={0.2} />
        </mesh>
      )}
      {debug && (
        <mesh position={[0, height - TOP_SENSOR_HEIGHT / 2, RUNG_THICKNESS / 2 + SENSOR_DEPTH / 2]}>
          <boxGeometry args={[width + 0.4, TOP_SENSOR_HEIGHT, SENSOR_DEPTH + 0.2]} />
          <meshBasicMaterial color="#ff66aa" wireframe transparent opacity={0.4} />
        </mesh>
      )}
    </RigidBody>
  );
}
