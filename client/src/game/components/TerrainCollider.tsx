import { useEffect, useMemo, useState } from "react";
import { RigidBody, HeightfieldCollider } from "@react-three/rapier";
import { COLLISION_MASKS } from "./BuildingColliders";
import {
  TERRAIN_RESOLUTION,
  WORLD_SIZE,
  subscribeTerrainEdit,
  terrainHeights,
  terrainVersion,
} from "./TerrainHeightField";

// We can't mutate a Rapier `HeightfieldCollider`'s heights array in place
// from React — the collider props are baked into the underlying physics
// world at mount. Instead we re-mount the collider with a fresh height
// snapshot whenever the editor commits an edit. To keep brush strokes
// from spamming Rapier with rebuilds (which would also wipe any rigid
// body resting on the terrain for a frame), we coalesce edits with a
// short debounce: the collider rebuild lags the visual mesh by ~80 ms,
// which feels fine because the player isn't standing on the brush
// centre while painting.
const COLLIDER_REBUILD_DEBOUNCE_MS = 80;

export default function TerrainCollider() {
  const [version, setVersion] = useState(terrainVersion());

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const unsub = subscribeTerrainEdit((_rect, v) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        setVersion(v);
        timeout = null;
      }, COLLIDER_REBUILD_DEBOUNCE_MS);
    });
    return () => {
      if (timeout) clearTimeout(timeout);
      unsub();
    };
  }, []);

  // Rapier's heightfield uses a different row order than `PlaneGeometry`
  // (rows from +Z to -Z vs the other way around). We snapshot a flipped
  // copy each rebuild so subsequent edits to `terrainHeights` don't
  // partially overwrite the snapshot mid-physics-step.
  const heights = useMemo(() => {
    const n = TERRAIN_RESOLUTION;
    const arr = new Float32Array(n * n);
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const iz = (n - 1) - row;
        arr[row * n + col] = terrainHeights[iz * n + col];
      }
    }
    return arr;
  }, [version]);

  const elementSize = WORLD_SIZE / (TERRAIN_RESOLUTION - 1);
  const nRows = TERRAIN_RESOLUTION;
  const nCols = TERRAIN_RESOLUTION;

  return (
    <RigidBody
      // Re-key the body so Rapier rebuilds the heightfield cleanly when
      // the editor commits a change. Without the key, the collider would
      // keep its initial heights forever.
      key={`terrain-rb-${version}`}
      type="fixed"
      position={[0, 0, 0]}
      colliders={false}
      collisionGroups={COLLISION_MASKS.TERRAIN}
    >
      <HeightfieldCollider
        args={[
          nRows - 1,
          nCols - 1,
          Array.from(heights),
          { x: elementSize * (nCols - 1), y: 1, z: elementSize * (nRows - 1) },
        ]}
        friction={0.6}
        restitution={0.0}
      />
    </RigidBody>
  );
}
