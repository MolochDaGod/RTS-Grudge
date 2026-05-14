import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { TerrainGrassLayer } from "../world/GrassLayer";
import { useSandTerrainMaterial } from "./SandTerrainMaterial";
import {
  MAX_HEIGHT,
  TERRAIN_RESOLUTION,
  WORLD_SIZE,
  getTerrainHeight as _getTerrainHeight,
  subscribeTerrainEdit,
  terrainHeights,
  type TerrainEditRect,
} from "./TerrainHeightField";

// Re-export the bits older modules still import from this file. The actual
// authority is `TerrainHeightField` now — `globalHeightData` is just an
// alias so existing call sites (Player, NPCs, BuildingColliders, etc.)
// keep working without a sweeping refactor.
//
// !! Migration bridge — DO NOT USE IN NEW CODE.
// `globalHeightData` captures the *initial* buffer reference. If
// `resetTerrain()` is ever called (e.g. when loading a saved world), this
// alias becomes stale and direct indexing into it returns the pre-load
// data. New callers should `import { terrainHeights, getTerrainHeight }
// from "./TerrainHeightField"` instead. The 12 existing callers all read
// through `getTerrainHeight()` or use `globalHeightData` purely as a
// truthy sentinel, both of which are safe.
export { MAX_HEIGHT, TERRAIN_RESOLUTION, WORLD_SIZE };
export const globalHeightData: Float32Array = terrainHeights;

/**
 * Backwards-compatible 3-arg signature. The old API let callers pass any
 * Float32Array; we now ignore the third argument and always read from the
 * shared mutable buffer so brush edits are visible everywhere immediately.
 */
export function getTerrainHeight(
  x: number,
  z: number,
  _heightData?: Float32Array | null,
): number {
  return _getTerrainHeight(x, z);
}

// --- Geometry construction & live update --------------------------------

function buildTerrainGeometry(): THREE.BufferGeometry {
  const segs = TERRAIN_RESOLUTION - 1;
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segs, segs);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position.array as Float32Array;
  for (let i = 0; i < positions.length / 3; i++) {
    const px = positions[i * 3];
    const pz = positions[i * 3 + 2];
    positions[i * 3 + 1] = _getTerrainHeight(px, pz);
  }
  geometry.computeVertexNormals();

  // Per-vertex tint from height + steepness. The fragment shader multiplies
  // the textured colour by this, so cliffs read brown and peaks read white
  // even though the diffuse comes from a single sand or grass texture.
  const colors = new Float32Array(positions.length);
  paintVertexColors(positions, geometry.attributes.normal.array as Float32Array, colors);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return geometry;
}

function paintVertexColors(positions: Float32Array, normals: Float32Array, colors: Float32Array) {
  for (let i = 0; i < positions.length / 3; i++) {
    paintOneVertexColor(positions[i * 3 + 1], normals[i * 3 + 1], colors, i * 3);
  }
}

// Inlined per-vertex tint so the brush hot-path doesn't allocate three
// tiny Float32Arrays per touched vertex (architect callout).
function paintOneVertexColor(y: number, ny: number, out: Float32Array, baseIdx: number) {
  const normalizedHeight = y / MAX_HEIGHT;
  const steepness = 1 - Math.abs(ny);

  let r = 1, g = 1, b = 1;
  if (normalizedHeight < 0.5) {
    r = 1; g = 1; b = 1;
  } else if (normalizedHeight < 0.7) {
    const t = (normalizedHeight - 0.5) / 0.2;
    r = 1 * (1 - t) + 0.95 * t;
    g = 1 * (1 - t) + 0.92 * t;
    b = 1 * (1 - t) + 0.88 * t;
  } else if (normalizedHeight < 0.9) {
    r = 0.85; g = 0.82; b = 0.78;
  } else {
    const t = (normalizedHeight - 0.9) / 0.1;
    r = 0.85 * (1 - t) + 1.05 * t;
    g = 0.82 * (1 - t) + 1.05 * t;
    b = 0.78 * (1 - t) + 1.10 * t;
  }

  if (steepness > 0.4) {
    const blend = Math.min(1, (steepness - 0.4) / 0.3);
    r = r * (1 - blend) + 0.78 * blend;
    g = g * (1 - blend) + 0.62 * blend;
    b = b * (1 - blend) + 0.45 * blend;
  }

  out[baseIdx] = r;
  out[baseIdx + 1] = g;
  out[baseIdx + 2] = b;
}

/**
 * Apply a brush edit's height changes to the geometry's position attribute.
 * Only the rect that changed is touched — for a 5m brush on the 200m
 * world that's ~80 verts vs the full 16k.
 *
 * Vertex layout in `PlaneGeometry(W, W, N-1, N-1).rotateX(-pi/2)`:
 *   index = row * N + col
 *   position[index*3 + 0] = x,  +1 = y,  +2 = z
 * Rows run along +Z (after the rotation), cols along +X. This matches the
 * (col=x, row=z) convention used in the heightfield buffer.
 */
function applyEditToGeometry(geometry: THREE.BufferGeometry, rect: TerrainEditRect) {
  const positions = geometry.attributes.position.array as Float32Array;
  const N = TERRAIN_RESOLUTION;
  for (let r = rect.z0; r <= rect.z1; r++) {
    for (let c = rect.x0; c <= rect.x1; c++) {
      const idx = r * N + c;
      positions[idx * 3 + 1] = terrainHeights[idx];
    }
  }
  geometry.attributes.position.needsUpdate = true;

  // Three's `computeVertexNormals()` walks the indexed triangles and is
  // the canonical correct version. Trying to roll our own rect-restricted
  // version got the diagonal/winding wrong (see architect callout); the
  // perf saving wasn't worth the lighting seams. At 16k verts it's ~1ms,
  // which is fine for brush strokes (we already debounce the collider).
  geometry.computeVertexNormals();
  geometry.attributes.normal.needsUpdate = true;

  // Repaint vertex tints in the rect so the height-based grass/sand
  // bias stays in sync after a deep dig or a tall pile.
  const colors = geometry.attributes.color.array as Float32Array;
  const normals = geometry.attributes.normal.array as Float32Array;
  const minR = Math.max(0, rect.z0 - 1);
  const maxR = Math.min(N - 1, rect.z1 + 1);
  const minC = Math.max(0, rect.x0 - 1);
  const maxC = Math.min(N - 1, rect.x1 + 1);
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const idx = r * N + c;
      const stride3 = idx * 3;
      paintOneVertexColor(positions[stride3 + 1], normals[stride3 + 1], colors, stride3);
    }
  }
  geometry.attributes.color.needsUpdate = true;
}

// --- Component ----------------------------------------------------------

export default function Terrain() {
  const material = useSandTerrainMaterial();
  const meshRef = useRef<THREE.Mesh>(null);

  // Build the geometry once. Edits mutate it in place via the subscriber
  // below, so we don't want React to throw it away on every render.
  const geometry = useMemo(() => buildTerrainGeometry(), []);

  // Subscribe to brush edits and patch the geometry in place. The
  // grass layer below re-scatters on its own debounced timer, and the
  // collider re-mounts via its own subscriber, so this hook is purely
  // about keeping the visual mesh in sync.
  useEffect(() => {
    return subscribeTerrainEdit((rect) => {
      applyEditToGeometry(geometry, rect);
    });
  }, [geometry]);

  // Bump grass scatter at most every ~250ms during a sustained brush
  // stroke. Without this, grass blades stay at their original Y values
  // after a dig and end up floating in mid-air or buried in dunes
  // (architect callout). 250ms feels live enough not to be noticed but
  // is far cheaper than re-scattering 60 times per second.
  const [grassRev, setGrassRev] = useState<number>(0);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return subscribeTerrainEdit(() => {
      if (timeout) return;
      timeout = setTimeout(() => {
        timeout = null;
        setGrassRev((v: number) => v + 1);
      }, 250);
    });
  }, []);

  return (
    <group>
      <mesh
        ref={meshRef}
        name={TERRAIN_MESH_NAME}
        userData={{ terrainEditable: true }}
        receiveShadow
        castShadow
        geometry={geometry}
        material={material}
      />
      <TerrainGrassLayer
        // `grassRev` is in the key so the layer fully remounts (and re-
        // scatters from the current height field) on each commit. Memo
        // deps wouldn't fire because we mutate `terrainHeights` in place.
        key={`grass-${grassRev}`}
        heightData={terrainHeights}
        worldSize={WORLD_SIZE}
        terrainResolution={TERRAIN_RESOLUTION}
        maxHeight={MAX_HEIGHT}
      />
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
        <planeGeometry args={[WORLD_SIZE * 1.5, WORLD_SIZE * 1.5]} />
        <meshStandardMaterial color="#1a3a5a" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/** Stable Object3D.name so other systems (TerrainEditor, debug overlays)
 * can find the editable mesh via `scene.getObjectByName`. */
export const TERRAIN_MESH_NAME = "main_world_terrain";

/**
 * Helper for the editor and other systems that need direct access to the
 * terrain mesh's material so they can poke its uniforms (brush ring etc.).
 * Returns null until the mesh has mounted at least once.
 */
export function getTerrainMaterialFromScene(scene: THREE.Object3D): THREE.MeshStandardMaterial | null {
  let found: THREE.MeshStandardMaterial | null = null;
  scene.traverse((obj) => {
    if (found) return;
    if (
      (obj as THREE.Mesh).isMesh &&
      ((obj as THREE.Mesh).geometry?.attributes?.position?.count ?? 0) ===
        TERRAIN_RESOLUTION * TERRAIN_RESOLUTION &&
      (obj as THREE.Mesh).material instanceof THREE.MeshStandardMaterial
    ) {
      found = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
    }
  });
  return found;
}
