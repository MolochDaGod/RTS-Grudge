/**
 * Rain — instanced thin streak-quads falling over the play area.
 *
 * Implementation choices:
 * - One InstancedMesh of tall narrow PlaneGeometry quads (cheaper than
 *   individual line segments, antialiases better, supports alpha).
 * - Each frame we advance every drop down by `speed * dt`. When a drop
 *   falls below sea level we re-spawn it at a random XZ within a square
 *   centred on the camera, with a random Y high in the sky.
 * - The matrix is updated CPU-side and pushed via instanceMatrix. This
 *   is fine for ~1500 drops on a modern GPU; if it ever feels slow we
 *   can move motion into a vertex shader uniform clock instead.
 * - Material is `MeshBasicMaterial`, additive-blend off, transparent
 *   with `depthWrite:false` so the streaks don't punch holes in the
 *   z-buffer.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface RainProps {
  /** How many active drops in flight. */
  count?: number;
  /** Square footprint around the camera the rain is spawned within. */
  area?: number;
  /** Vertical fall speed in metres/sec. */
  speed?: number;
}

export function Rain({ count = 1500, area = 220, speed = 22 }: RainProps) {
  const { camera } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Per-drop state lives in a typed array to avoid per-frame allocs.
  const drops = useMemo(() => {
    const arr = new Float32Array(count * 3); // x, y, z
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * area;
      arr[i * 3 + 1] = Math.random() * 60 + 5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * area;
    }
    return arr;
  }, [count, area]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const m = meshRef.current;
    if (!m) return;
    // Initial matrix flush so frame-1 isn't all at the origin.
    for (let i = 0; i < count; i++) {
      dummy.position.set(drops[i * 3], drops[i * 3 + 1], drops[i * 3 + 2]);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [count, dummy, drops]);

  useFrame((_, dt) => {
    const m = meshRef.current;
    if (!m) return;
    const cx = camera.position.x;
    const cz = camera.position.z;
    const half = area / 2;
    for (let i = 0; i < count; i++) {
      let y = drops[i * 3 + 1] - speed * dt;
      let x = drops[i * 3 + 0];
      let z = drops[i * 3 + 2];
      // Recycle drops that have fallen out the bottom — and drops that
      // wandered too far from the camera as it moves around the scene.
      if (y < -2 || Math.abs(x - cx) > half || Math.abs(z - cz) > half) {
        x = cx + (Math.random() - 0.5) * area;
        z = cz + (Math.random() - 0.5) * area;
        y = 50 + Math.random() * 20;
      }
      drops[i * 3 + 0] = x;
      drops[i * 3 + 1] = y;
      drops[i * 3 + 2] = z;
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      {/* A tall, very thin quad. The +Y axis is the streak length. */}
      <planeGeometry args={[0.025, 1.4]} />
      <meshBasicMaterial
        color="#cfd8e6"
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
