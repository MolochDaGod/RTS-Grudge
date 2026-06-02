/**
 * Procedural stylized prop meshes — no GLB downloads required.
 *
 * Trees have been removed from this file (they are now rendered by
 * FluffyTree3D / CardTree in TexturedFoliage.tsx).  This file retains:
 *   StylizedRock, StylizedBush, StylizedFlower, ResourceNode, DockPad,
 *   WindSway.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { FluffyTree3D } from './TexturedFoliage';

// ── Rocks ──────────────────────────────────────────────────
const ROCK_GEOS = [
  new THREE.DodecahedronGeometry(0.7, 0),
  new THREE.IcosahedronGeometry(0.6, 0),
  new THREE.OctahedronGeometry(0.65, 0),
];

// Jitter vertices once per geometry for an irregular, hand-carved look
for (const g of ROCK_GEOS) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const j = 0.18;
    pos.setXYZ(
      i,
      pos.getX(i) + (Math.random() - 0.5) * j,
      pos.getY(i) + (Math.random() - 0.5) * j,
      pos.getZ(i) + (Math.random() - 0.5) * j,
    );
  }
  g.computeVertexNormals();
}

export function StylizedRock({ variant = 0 }: { variant?: number }) {
  const geo = ROCK_GEOS[variant % ROCK_GEOS.length]!;
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial color="#8b8a83" roughness={0.95} flatShading />
    </mesh>
  );
}

// ── Bushes — compact sphere cluster (FluffyTree3D, no visible trunk) ───────
export function StylizedBush({ tint }: { tint?: string }) {
  return (
    // Scaled to 0.45 of a full tree — produces a rounded bush shape.
    // The trunk at this scale is 5 cm wide and mostly hidden by the canopy.
    <group scale={[0.45, 0.45, 0.45]}>
      <FluffyTree3D
        colors={tint
          ? { lit: tint,      shadow: '#001a09', highlight: '#c8e840' }
          : { lit: '#3ab81e', shadow: '#001a09', highlight: '#98d828' }
        }
        trunkColor="#2a1808"
        size={0.7}
      />
    </group>
  );
}

// ── Flowers ───────────────────────────────────────────────────────
const FLOWER_STEM = new THREE.CylinderGeometry(0.015, 0.015, 0.45, 5);
FLOWER_STEM.translate(0, 0.225, 0);
const FLOWER_HEAD = new THREE.IcosahedronGeometry(0.07, 0);

export function StylizedFlower({ color = '#ff5d8f' }: { color?: string }) {
  return (
    <group>
      <mesh geometry={FLOWER_STEM}>
        <meshStandardMaterial color="#3f8c4a" />
      </mesh>
      <mesh geometry={FLOWER_HEAD} position={[0, 0.48, 0]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} flatShading />
      </mesh>
    </group>
  );
}

// ── Resource node (crystal cluster) ───────────────────────────────
const CRYSTAL_GEO = new THREE.OctahedronGeometry(0.6, 0);
export function ResourceNode({ resource = 'crystal' }: { resource?: string }) {
  const color = resource === 'wood' ? '#a06b3f' : '#7df2ff';
  return (
    <group>
      <mesh geometry={CRYSTAL_GEO} position={[0, 0.5, 0]} castShadow>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} roughness={0.2} metalness={0.4} />
      </mesh>
      <mesh geometry={CRYSTAL_GEO} position={[0.3, 0.35, 0.1]} scale={[0.5, 0.6, 0.5]} rotation={[0.2, 0.5, 0.1]} castShadow>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} roughness={0.2} metalness={0.4} />
      </mesh>
      <mesh geometry={CRYSTAL_GEO} position={[-0.25, 0.3, -0.15]} scale={[0.45, 0.5, 0.45]} rotation={[-0.3, 1.2, 0]} castShadow>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} roughness={0.2} metalness={0.4} />
      </mesh>
    </group>
  );
}

// ── Dock pad ──────────────────────────────────────────────────────
export function DockPad() {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#7a5429" roughness={0.85} />
      </mesh>
      {[-0.4, -0.1, 0.2, 0.5].map((dz) => (
        <mesh key={dz} position={[-0.5, 0.3, dz]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.6, 6]} />
          <meshStandardMaterial color="#3a2611" />
        </mesh>
      ))}
    </group>
  );
}

// ── Wind sway controller for trees/bushes (lightweight) ───────────
export function WindSway({ amount = 0.04, children }: { amount?: number; children: React.ReactNode }) {
  const ref = useMemo(() => ({ current: null as THREE.Group | null, t: Math.random() * 100 }), []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.t += dt;
    ref.current.rotation.z = Math.sin(ref.t * 0.8) * amount;
    ref.current.rotation.x = Math.cos(ref.t * 0.6) * amount * 0.6;
  });
  return <group ref={(g) => { ref.current = g; }}>{children}</group>;
}
