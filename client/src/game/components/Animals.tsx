import { useRef, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { type AnimationState } from "../hooks/useCharacterModel";
import { useCharacterController } from "../controllers/useCharacterController";
import { getTerrainHeight, globalHeightData } from "./Terrain";
import { KinematicCharacterBody } from "./KinematicCharacterBody";
import { COLLISION_MASKS } from "./BuildingColliders";

interface AnimalConfig {
  id: string;
  modelPath: string;
  startPos: [number, number, number];
  targetHeight: number;
  wanderRadius: number;
  speed: number;
  label: string;
}

const ANIMAL_CONFIGS: AnimalConfig[] = [
  { id: "cow1", modelPath: "/models/monsters/blob/Mushnub_Evolved.glb", startPos: [35, 0, 20], targetHeight: 1.4, wanderRadius: 8, speed: 0.6, label: "Cow" },
  { id: "cow2", modelPath: "/models/monsters/blob/Mushnub_Evolved.glb", startPos: [38, 0, 25], targetHeight: 1.4, wanderRadius: 8, speed: 0.5, label: "Cow" },
  { id: "cow3", modelPath: "/models/monsters/blob/Mushnub_Evolved.glb", startPos: [32, 0, 18], targetHeight: 1.4, wanderRadius: 8, speed: 0.7, label: "Cow" },
  { id: "pug1", modelPath: "/models/monsters/blob/Dog.glb", startPos: [3, 0, 3], targetHeight: 0.5, wanderRadius: 10, speed: 2.5, label: "Pug" },
  { id: "pug2", modelPath: "/models/monsters/blob/Dog.glb", startPos: [-5, 0, 8], targetHeight: 0.5, wanderRadius: 12, speed: 3.0, label: "Pug" },
];

function AnimalModel({ config }: { config: AnimalConfig }) {
  const groupRef = useRef<THREE.Group>(null);
  const terrainY = getTerrainHeight(config.startPos[0], config.startPos[2], globalHeightData);
  const localPos = useRef(new THREE.Vector3(config.startPos[0], terrainY, config.startPos[2]));
  const wanderTarget = useRef(new THREE.Vector3(
    config.startPos[0] + (Math.random() - 0.5) * config.wanderRadius,
    0,
    config.startPos[2] + (Math.random() - 0.5) * config.wanderRadius
  ));
  const isIdle = useRef(true);
  const idleTimer = useRef(Math.random() * 3 + 2);
  const prevAnim = useRef<AnimationState>("idle");

  // Migrated to the new controller pipeline. Animals never attack, so the
  // upper-body combat layer is disabled.
  const { scene, playAnimation, update, setMovementSpeed, bounds: characterBounds } = useCharacterController({
    modelPath: config.modelPath,
    targetHeight: config.targetHeight,
    disableCombatLayer: true,
  });

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    update(delta);

    let movedSpeed = 0;

    if (isIdle.current) {
      idleTimer.current -= delta;
      if (idleTimer.current <= 0) {
        isIdle.current = false;
        wanderTarget.current.set(
          config.startPos[0] + (Math.random() - 0.5) * config.wanderRadius * 2,
          0,
          config.startPos[2] + (Math.random() - 0.5) * config.wanderRadius * 2
        );
        const bounds = 90;
        wanderTarget.current.x = Math.max(-bounds, Math.min(bounds, wanderTarget.current.x));
        wanderTarget.current.z = Math.max(-bounds, Math.min(bounds, wanderTarget.current.z));
      }
      // Feed real horizontal speed (zero while idling).
      setMovementSpeed(0);
      return;
    }

    const dir = new THREE.Vector3().subVectors(wanderTarget.current, localPos.current);
    dir.y = 0;
    const dist = dir.length();

    if (dist < 0.5) {
      isIdle.current = true;
      idleTimer.current = 3 + Math.random() * 6;
      if (prevAnim.current !== "idle") {
        playAnimation("idle");
        prevAnim.current = "idle";
      }
      setMovementSpeed(0);
      return;
    }

    dir.normalize();
    localPos.current.add(dir.clone().multiplyScalar(config.speed * delta));
    const ty = getTerrainHeight(localPos.current.x, localPos.current.z, globalHeightData);
    localPos.current.y = ty;

    const angle = Math.atan2(dir.x, dir.z);
    groupRef.current.rotation.y = angle;
    groupRef.current.position.copy(localPos.current);
    movedSpeed = config.speed;

    if (prevAnim.current !== "walk") {
      playAnimation("walk");
      prevAnim.current = "walk";
    }

    // Feed real horizontal speed to the locomotion blend tree so the
    // controller can smoothly pick the right idle/walk/run clip.
    setMovementSpeed(movedSpeed);
  });

  return (
    <>
      <KinematicCharacterBody
        positionRef={localPos}
        bounds={characterBounds}
        collisionGroups={COLLISION_MASKS.NPC}
      />
      <group ref={groupRef} position={localPos.current.toArray()}>
        <primitive object={scene} />
      </group>
    </>
  );
}

export default function Animals() {
  return (
    <>
      {ANIMAL_CONFIGS.map((config) => (
        <Suspense key={config.id} fallback={null}>
          <AnimalModel config={config} />
        </Suspense>
      ))}
    </>
  );
}
