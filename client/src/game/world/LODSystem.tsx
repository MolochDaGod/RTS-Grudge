import { useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LOD_FULL, LOD_LOW, LOD_MINIMAL, getLODTier, type LODTier } from "./WorldChunkManager";

interface LODGroupProps {
  playerPosition: THREE.Vector3;
  position: [number, number, number];
  fullContent: React.ReactNode;
  lowContent?: React.ReactNode;
  minimalContent?: React.ReactNode;
  updateInterval?: number;
}

export function LODGroup({
  playerPosition,
  position,
  fullContent,
  lowContent,
  minimalContent,
  updateInterval = 0.25,
}: LODGroupProps) {
  const fullRef = useRef<THREE.Group>(null);
  const lowRef = useRef<THREE.Group>(null);
  const minRef = useRef<THREE.Group>(null);
  const timerRef = useRef(0);
  const currentLOD = useRef<LODTier>("full");

  useFrame((_, delta) => {
    timerRef.current += delta;
    if (timerRef.current < updateInterval) return;
    timerRef.current = 0;

    const dist = Math.sqrt(
      (playerPosition.x - position[0]) ** 2 +
      (playerPosition.z - position[2]) ** 2
    );
    const tier = getLODTier(dist);

    if (tier === currentLOD.current) return;
    currentLOD.current = tier;

    if (fullRef.current) fullRef.current.visible = tier === "full";
    if (lowRef.current) lowRef.current.visible = tier === "low";
    if (minRef.current) minRef.current.visible = tier === "minimal";
  });

  return (
    <group>
      <group ref={fullRef}>{fullContent}</group>
      {lowContent && <group ref={lowRef} visible={false}>{lowContent}</group>}
      {minimalContent && <group ref={minRef} visible={false}>{minimalContent}</group>}
    </group>
  );
}

interface DistanceCullProps {
  playerPosition: THREE.Vector3;
  maxDistance: number;
  children: React.ReactNode;
  updateInterval?: number;
}

export function DistanceCull({
  playerPosition,
  maxDistance,
  children,
  updateInterval = 0.5,
}: DistanceCullProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timerRef = useRef(0);
  const posRef = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    timerRef.current += delta;
    if (timerRef.current < updateInterval || !groupRef.current) return;
    timerRef.current = 0;

    groupRef.current.getWorldPosition(posRef.current);
    const dist = Math.sqrt(
      (playerPosition.x - posRef.current.x) ** 2 +
      (playerPosition.z - posRef.current.z) ** 2
    );
    groupRef.current.visible = dist <= maxDistance;
  });

  return <group ref={groupRef}>{children}</group>;
}

export function useLODDistance(playerPosition: THREE.Vector3): (wx: number, wz: number) => LODTier {
  return useCallback(
    (wx: number, wz: number) => {
      const dist = Math.sqrt(
        (playerPosition.x - wx) ** 2 +
        (playerPosition.z - wz) ** 2
      );
      return getLODTier(dist);
    },
    [playerPosition]
  );
}
