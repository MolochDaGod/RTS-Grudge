/**
 * PetCompanion — renders the active dragon pet following the player.
 *
 * When the player mounts the dragon (usePets mountPet), this component
 * hides itself — the Player swaps to the dragon model instead.
 */

import { useRef, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePets } from "@/lib/stores/usePets";
import {
  DRAGON_STAGES,
  getDragonModelPath,
  type DragonColor,
} from "@/game/systems/DragonPetRegistry";
import { applyDragonTint } from "@/game/systems/dragonTint";
import { useCharacterController } from "../controllers/useCharacterController";

function DragonPetMesh({
  modelPath,
  scale,
  targetHeight,
  color,
}: {
  modelPath: string;
  scale: number;
  targetHeight: number;
  color: DragonColor;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const tintedRef = useRef(false);
  const { scene, update } = useCharacterController({
    modelPath,
    targetHeight,
    weaponType: "fists",
  });

  useFrame((_, dt) => {
    update(dt);
    if (!groupRef.current || !scene || tintedRef.current) return;
    applyDragonTint(scene, color);
    tintedRef.current = true;
  });

  if (!scene) return null;
  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

export function PetCompanion({
  playerPosRef,
}: {
  playerPosRef: React.RefObject<THREE.Vector3>;
}) {
  const activePet = usePets((s) => s.getActivePet());
  const mountedPet = usePets((s) => s.getMountedPet());
  const groupRef = useRef<THREE.Group>(null);
  const offset = useRef(new THREE.Vector3(1.8, 0.4, -1.2));
  const targetPos = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!activePet || mountedPet || !groupRef.current) return;
    const player = playerPosRef.current;
    if (!player) return;
    targetPos.current.copy(player).add(offset.current);
    groupRef.current.position.lerp(targetPos.current, 0.08);
  });

  if (!activePet || mountedPet || activePet.stage < 2) return null;

  const stageDef = DRAGON_STAGES[activePet.stage];
  const modelPath = getDragonModelPath(activePet.stage);
  if (!modelPath) return null;

  return (
    <group ref={groupRef}>
      <Suspense fallback={null}>
        <DragonPetMesh
          modelPath={modelPath}
          scale={stageDef.scale}
          targetHeight={stageDef.targetHeight}
          color={activePet.color}
        />
      </Suspense>
    </group>
  );
}