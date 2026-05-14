import { useRef, useMemo, useEffect, useCallback, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RigidBody, HeightfieldCollider, CylinderCollider, BallCollider } from "@react-three/rapier";
import { COLLISION_MASKS } from "../components/BuildingColliders";
import {
  WorldChunkManager,
  CHUNK_SIZE,
  LOD_FULL,
  LOD_LOW,
  LOD_MINIMAL,
  type WorldChunk,
  type LODTier,
} from "./WorldChunkManager";
import { GrassChunkLayer } from "./GrassLayer";

const TERRAIN_RES_FULL = 32;
const TERRAIN_RES_LOW = 16;
const TERRAIN_RES_MINIMAL = 8;

function getResolutionForLOD(lod: LODTier): number {
  switch (lod) {
    case "full": return TERRAIN_RES_FULL;
    case "low": return TERRAIN_RES_LOW;
    case "minimal": return TERRAIN_RES_MINIMAL;
    default: return TERRAIN_RES_MINIMAL;
  }
}

interface ChunkTerrainProps {
  chunk: WorldChunk;
  islandSeed: number;
  islandSize: number;
  heightSampler: (wx: number, wz: number) => number;
}

function ChunkTerrain({ chunk, islandSeed, islandSize, heightSampler }: ChunkTerrainProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const resolution = getResolutionForLOD(chunk.lod);

  const { geometry, heightData } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, resolution - 1, resolution - 1);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const hData = new Float32Array(resolution * resolution);

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i) + CHUNK_SIZE / 2;
      const lz = pos.getZ(i) + CHUNK_SIZE / 2;
      const wx = chunk.worldX + lx;
      const wz = chunk.worldZ + lz;

      const h = heightSampler(wx, wz);
      pos.setY(i, h);

      const gx = Math.floor((lx / CHUNK_SIZE) * (resolution - 1));
      const gz = Math.floor((lz / CHUNK_SIZE) * (resolution - 1));
      if (gx >= 0 && gx < resolution && gz >= 0 && gz < resolution) {
        hData[gz * resolution + gx] = h;
      }

      let r: number, g: number, b: number;
      if (h < 0.5) {
        r = 0.76; g = 0.70; b = 0.50;
      } else if (h < 3) {
        r = 0.30; g = 0.55; b = 0.20;
      } else if (h < 7) {
        r = 0.35; g = 0.30; b = 0.25;
      } else {
        r = 0.85; g = 0.85; b = 0.85;
      }
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    return { geometry: geo, heightData: hData };
  }, [chunk.worldX, chunk.worldZ, chunk.lod, resolution, heightSampler]);

  const colliderHeights = useMemo(() => {
    if (chunk.lod !== "full") return null;
    const cols = resolution;
    const rows = resolution;
    const heights = new Float32Array(cols * rows);
    for (let z = 0; z < rows; z++) {
      for (let x = 0; x < cols; x++) {
        heights[z * cols + x] = heightData[(rows - 1 - z) * cols + x];
      }
    }
    return Array.from(heights) as number[];
  }, [heightData, chunk.lod, resolution]);

  return (
    <group position={[chunk.worldX + CHUNK_SIZE / 2, 0, chunk.worldZ + CHUNK_SIZE / 2]}>
      <mesh ref={meshRef} geometry={geometry} receiveShadow castShadow={chunk.lod === "full"}>
        <meshStandardMaterial vertexColors roughness={0.9} metalness={0.0} />
      </mesh>
      {colliderHeights && (
        <RigidBody type="fixed" colliders={false}>
          <HeightfieldCollider
            args={[resolution - 1, resolution - 1, colliderHeights, { x: CHUNK_SIZE, y: 1, z: CHUNK_SIZE }]}
            friction={0.6}
          />
        </RigidBody>
      )}
    </group>
  );
}

interface ChunkNatureProps {
  chunk: WorldChunk;
  islandSeed: number;
  heightSampler: (wx: number, wz: number) => number;
}

function ChunkNature({ chunk, islandSeed, heightSampler }: ChunkNatureProps) {
  const groupRef = useRef<THREE.Group>(null);

  const instances = useMemo(() => {
    if (chunk.lod === "minimal") return [];

    let s = islandSeed + chunk.cx * 31337 + chunk.cz * 7919;
    const rng = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };

    const count = chunk.lod === "full" ? 20 : 8;
    const items: Array<{
      type: "tree" | "rock" | "bush";
      x: number;
      y: number;
      z: number;
      scale: number;
      rotation: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      const lx = rng() * CHUNK_SIZE;
      const lz = rng() * CHUNK_SIZE;
      const wx = chunk.worldX + lx;
      const wz = chunk.worldZ + lz;
      const h = heightSampler(wx, wz);

      if (h < 0.5 || h > 10) continue;

      const type = rng() < 0.5 ? "tree" : rng() < 0.7 ? "rock" : "bush";
      const scale = 0.5 + rng() * 1.5;
      items.push({
        type,
        x: lx - CHUNK_SIZE / 2,
        y: h,
        z: lz - CHUNK_SIZE / 2,
        scale,
        rotation: rng() * Math.PI * 2,
      });
    }
    return items;
  }, [chunk.cx, chunk.cz, chunk.lod, islandSeed, heightSampler]);

  if (instances.length === 0) return null;

  // Only attach physics colliders for chunks the player can actually reach.
  // Distant LODs render visually but stay collision-free to keep Rapier's
  // body count bounded and stable as the camera streams the world.
  const hasColliders = chunk.lod === "full";

  return (
    <group ref={groupRef} position={[chunk.worldX + CHUNK_SIZE / 2, 0, chunk.worldZ + CHUNK_SIZE / 2]}>
      {instances.map((item, idx) => {
        if (item.type === "tree") {
          // Trunk visual: cylinder y=1.2, height 2.4, scaled by item.scale.
          // Collider matches the trunk only — leaves stay walkable so the
          // player can duck under canopies without bouncing off branches.
          const trunkHalfHeight = 1.2 * item.scale;
          const trunkRadius = 0.18 * item.scale;
          const visual = (
            <group scale={item.scale}>
              <mesh position={[0, 1.2, 0]} castShadow>
                <cylinderGeometry args={[0.1, 0.15, 2.4, 6]} />
                <meshStandardMaterial color="#5a3a1a" />
              </mesh>
              <mesh position={[0, 3, 0]} castShadow>
                <coneGeometry args={[1.2, 2.5, 6]} />
                <meshStandardMaterial color="#1a5c1a" />
              </mesh>
            </group>
          );
          if (!hasColliders) {
            return (
              <group key={idx} position={[item.x, item.y, item.z]} rotation-y={item.rotation}>
                {visual}
              </group>
            );
          }
          return (
            <RigidBody
              key={idx}
              type="fixed"
              position={[item.x, item.y, item.z]}
              rotation={[0, item.rotation, 0]}
              colliders={false}
              collisionGroups={COLLISION_MASKS.BUILDING}
            >
              <CylinderCollider
                args={[trunkHalfHeight, trunkRadius]}
                position={[0, trunkHalfHeight, 0]}
                friction={0.6}
                restitution={0.0}
              />
              {visual}
            </RigidBody>
          );
        }
        if (item.type === "rock") {
          // Dodecahedron visual radius 0.5, scaled by item.scale; Rapier
          // sphere is the cleanest fit and avoids the per-frame cost of a
          // convex hull.
          const rockRadius = 0.5 * item.scale;
          const visual = (
            <mesh scale={item.scale} castShadow>
              <dodecahedronGeometry args={[0.5, 0]} />
              <meshStandardMaterial color="#6b6b6b" roughness={0.95} />
            </mesh>
          );
          if (!hasColliders) {
            return (
              <group key={idx} position={[item.x, item.y + 0.2, item.z]} rotation-y={item.rotation}>
                {visual}
              </group>
            );
          }
          return (
            <RigidBody
              key={idx}
              type="fixed"
              position={[item.x, item.y + 0.2, item.z]}
              rotation={[0, item.rotation, 0]}
              colliders={false}
              collisionGroups={COLLISION_MASKS.BUILDING}
            >
              <BallCollider args={[rockRadius]} friction={0.7} restitution={0.0} />
              {visual}
            </RigidBody>
          );
        }
        // Bushes intentionally stay collisionless — soft foliage the player
        // and enemies can walk through.
        return (
          <mesh key={idx} position={[item.x, item.y + 0.15, item.z]} rotation-y={item.rotation} scale={[item.scale, item.scale * 0.6, item.scale]}>
            <sphereGeometry args={[0.4, 6, 4]} />
            <meshStandardMaterial color="#2a6a2a" />
          </mesh>
        );
      })}
    </group>
  );
}

export interface ChunkedWorldProps {
  playerPosition: THREE.Vector3;
  islandSeed: number;
  islandSize: number;
  heightSampler: (wx: number, wz: number) => number;
}

export default function ChunkedWorld({ playerPosition, islandSeed, islandSize, heightSampler }: ChunkedWorldProps) {
  const managerRef = useRef(new WorldChunkManager());
  const [activeChunks, setActiveChunks] = useState<WorldChunk[]>([]);

  useFrame(() => {
    const mgr = managerRef.current;
    const result = mgr.update(playerPosition.x, playerPosition.z);

    if (result.added.length > 0 || result.removed.length > 0 || result.lodChanged.length > 0) {
      setActiveChunks([...mgr.getActiveChunks()]);
    }
  });

  return (
    <group>
      {activeChunks.map((chunk) => (
        <group key={chunk.key}>
          <ChunkTerrain
            chunk={chunk}
            islandSeed={islandSeed}
            islandSize={islandSize}
            heightSampler={heightSampler}
          />
          <GrassChunkLayer
            chunk={chunk}
            islandSeed={islandSeed}
            heightSampler={heightSampler}
          />
          <ChunkNature
            chunk={chunk}
            islandSeed={islandSeed}
            heightSampler={heightSampler}
          />
        </group>
      ))}
    </group>
  );
}
