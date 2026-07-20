/**
 * Procedural instanced forest — inspired by the CodePen reference at
 * D:\Games\Models\procedural-instanced-foresthigh-performance-real-trees
 *
 * Lightweight port: instanced trunk cylinders + leaf impostor spheres.
 * Driven by zone entities stamped by IslandGenerator (`data.forestZone`).
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sampleHeight } from '../editor/terrain-utils';
import type { TerrainData } from '../types';

interface ForestZone {
  cx: number;
  cz: number;
  radius: number;
  count: number;
  seed: number;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface InstancedForestProps {
  terrain: TerrainData;
  zones: ForestZone[];
}

export function InstancedForest({ terrain, zones }: InstancedForestProps) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);

  const { trunkGeo, leafGeo, matrices } = useMemo(() => {
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const leafGeo = new THREE.IcosahedronGeometry(0.55, 0);

    const trunkM = new THREE.Matrix4();
    const leafM = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const trunkMatrices: THREE.Matrix4[] = [];
    const leafMatrices: THREE.Matrix4[] = [];

    for (const zone of zones) {
      const rng = mulberry32(zone.seed);
      let placed = 0;
      let tries = 0;
      while (placed < zone.count && tries < zone.count * 8) {
        tries++;
        const ang = rng() * Math.PI * 2;
        const r = rng() * zone.radius;
        const x = zone.cx + Math.cos(ang) * r;
        const z = zone.cz + Math.sin(ang) * r;
        const y = sampleHeight(x, z, terrain);
        if (y < 0.35) continue;

        const h = 3.5 + rng() * 4.5;
        const w = 0.85 + rng() * 0.5;
        pos.set(x, y, z);
        quat.setFromEuler(new THREE.Euler(0, rng() * Math.PI * 2, 0));
        scl.set(w, h, w);
        trunkM.compose(pos, quat, scl);
        trunkMatrices.push(trunkM.clone());

        pos.set(x, y + h * 0.92, z);
        scl.set(1.1 + rng() * 0.6, 1.1 + rng() * 0.6, 1.1 + rng() * 0.6);
        leafM.compose(pos, quat, scl);
        leafMatrices.push(leafM.clone());
        placed++;
      }
    }

    return { trunkGeo, leafGeo, matrices: { trunkMatrices, leafMatrices } };
  }, [terrain, zones]);

  const trunkCount = matrices.trunkMatrices.length;
  const leafCount = matrices.leafMatrices.length;

  useLayoutEffect(() => {
    if (!trunkRef.current || !leafRef.current) return;
    matrices.trunkMatrices.forEach((mat, i) => trunkRef.current!.setMatrixAt(i, mat));
    matrices.leafMatrices.forEach((mat, i) => leafRef.current!.setMatrixAt(i, mat));
    trunkRef.current.instanceMatrix.needsUpdate = true;
    leafRef.current.instanceMatrix.needsUpdate = true;
  }, [matrices, trunkCount, leafCount]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (leafRef.current) {
      leafRef.current.rotation.y = Math.sin(t * 0.08) * 0.02;
    }
  });

  if (trunkCount === 0) return null;

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[trunkGeo, undefined, trunkCount]} castShadow receiveShadow>
        <meshStandardMaterial color="#3d2817" roughness={0.92} metalness={0.02} />
      </instancedMesh>
      <instancedMesh ref={leafRef} args={[leafGeo, undefined, leafCount]} castShadow>
        <meshStandardMaterial color="#2d6b3a" roughness={0.75} metalness={0} />
      </instancedMesh>
    </group>
  );
}