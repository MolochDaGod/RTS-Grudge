/**
 * Editable heightfield mesh. Holds its own BufferGeometry whose
 * position attribute is the source of truth for terrain.heights — we
 * mutate the typed array directly when sculpting and call
 * needsUpdate=true rather than rebuilding geometry on every brush tick.
 *
 * Vertex colors encode biome paint (grass/sand/rock/snow), shaded by
 * a single MeshStandardMaterial with vertexColors=true.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useEditor } from './store';
import { sampleHeight } from './terrain-utils';
import { BiomeTerrainMaterial } from './BiomeTerrainMaterial';
import { ensureBvhRaycast } from '../lib/bvh';

ensureBvhRaycast();

const BIOME_COLORS: [number, number, number][] = [
  [0.42, 0.65, 0.30], // grass
  [0.93, 0.86, 0.55], // sand
  [0.55, 0.50, 0.45], // rock
  [0.95, 0.96, 0.98], // snow
];

interface Props {
  onPointerEvent?: (e: ThreeEvent<PointerEvent>, type: 'down' | 'move' | 'up') => void;
}

export function TerrainMesh({ onPointerEvent }: Props) {
  const terrain = useEditor((s) => s.project.terrain);
  const terrainRev = useEditor((s) => s.terrainRev);

  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const { resolution, size } = terrain;
    const segments = resolution - 1;
    const g = new THREE.PlaneGeometry(size, size, segments, segments);
    g.rotateX(-Math.PI / 2);
    // Pre-allocate vertex color attribute
    const colors = new Float32Array(resolution * resolution * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const withBvh = g as THREE.BufferGeometry & { computeBoundsTree?: () => void };
    withBvh.computeBoundsTree?.();
    return g;
    // We deliberately rebuild only when resolution/size change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrain.resolution, terrain.size]);

  // Sync heights + biome colors into the geometry whenever terrainRev bumps
  useEffect(() => {
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const col = geometry.attributes.color    as THREE.BufferAttribute;
    const { resolution } = terrain;
    const total = resolution * resolution;
    for (let i = 0; i < total; i++) {
      pos.setY(i, terrain.heights[i] ?? 0);
      const c = BIOME_COLORS[terrain.biome[i] ?? 0]!;
      col.setXYZ(i, c[0], c[1], c[2]);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const withBvh = geometry as THREE.BufferGeometry & {
      computeBoundsTree?: () => void;
      disposeBoundsTree?: () => void;
    };
    withBvh.disposeBoundsTree?.();
    withBvh.computeBoundsTree?.();
  }, [terrain, terrainRev, geometry]);

  useFrame(() => { /* no-op — just keeps animation loop alive for sculpt */ });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      receiveShadow
      castShadow={false}
      onPointerDown={(e) => onPointerEvent?.(e, 'down')}
      onPointerMove={(e) => onPointerEvent?.(e, 'move')}
      onPointerUp={(e)   => onPointerEvent?.(e, 'up')}
    >
      <BiomeTerrainMaterial />
    </mesh>
  );
}

/** Read terrain height at world XZ — used by entity placement so props snap to ground. */
export function getTerrainHeightAt(
  x: number,
  z: number,
  terrain: { resolution: number; size: number; heights: number[] },
): number {
  return sampleHeight(x, z, terrain);
}
