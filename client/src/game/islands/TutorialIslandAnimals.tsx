import { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { type AnimationState } from "../hooks/useCharacterModel";
import { useCharacterController } from "../controllers/useCharacterController";

/**
 * Two animals — one cow, one dog — wandering near the spawn island. Slim
 * version of the overworld `<Animals>` component that does NOT depend on
 * the heightfield `<Terrain>` (which we don't mount on tutorial island);
 * animals walk on a flat y=0 plane instead.
 *
 * `startPos` here is an *offset* from the player's spawn xz (passed in
 * via the `spawnXZ` prop), not a world-space coordinate. The previous
 * version hardcoded world (-5,0,6) and (6,0,-4), which assumed the
 * player spawned at world origin (0,0). Now that the spawn is the
 * isolated palm patch beside the wreck, animals snap to the same
 * patch instead of remaining fixed at a no-longer-spawn location.
 */

interface AnimalConfig {
  id: string;
  modelPath: string;
  /** Offset from spawnXZ in world units; resolved at mount. */
  startOffset: [number, number, number];
  targetHeight: number;
  wanderRadius: number;
  speed: number;
}

const ANIMALS: AnimalConfig[] = [
  {
    id: "tutorial-cow",
    modelPath: "/models/monsters/blob/Mushnub_Evolved.glb",
    startOffset: [-5, 0, 6],
    targetHeight: 1.4,
    wanderRadius: 6,
    speed: 0.6,
  },
  {
    id: "tutorial-dog",
    modelPath: "/models/monsters/blob/Dog.glb",
    startOffset: [6, 0, -4],
    targetHeight: 0.5,
    wanderRadius: 8,
    speed: 2.2,
  },
];

function TutorialAnimal({
  config,
  spawnXZ,
}: {
  config: AnimalConfig;
  spawnXZ: [number, number];
}) {
  const groupRef = useRef<THREE.Group>(null);
  // Resolve the world-space start once — config.startOffset is relative
  // to the player's spawn xz, not absolute. Captured in refs so the
  // wander loop and idle re-center keep tracking the same anchor.
  const startPos = useRef<[number, number, number]>([
    spawnXZ[0] + config.startOffset[0],
    config.startOffset[1],
    spawnXZ[1] + config.startOffset[2],
  ]);
  const localPos = useRef(
    new THREE.Vector3(startPos.current[0], 0, startPos.current[2]),
  );
  const wanderTarget = useRef(
    new THREE.Vector3(startPos.current[0], 0, startPos.current[2]),
  );
  const isIdle = useRef(true);
  const idleTimer = useRef(2 + Math.random() * 3);
  const prevAnim = useRef<AnimationState>("idle");

  const { scene, playAnimation, update, setMovementSpeed } =
    useCharacterController({
      modelPath: config.modelPath,
      targetHeight: config.targetHeight,
      disableCombatLayer: true,
    });

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    update(delta);

    if (isIdle.current) {
      idleTimer.current -= delta;
      if (idleTimer.current <= 0) {
        isIdle.current = false;
        wanderTarget.current.set(
          startPos.current[0] + (Math.random() - 0.5) * config.wanderRadius * 2,
          0,
          startPos.current[2] + (Math.random() - 0.5) * config.wanderRadius * 2,
        );
      }
      setMovementSpeed(0);
      return;
    }

    const dir = new THREE.Vector3().subVectors(wanderTarget.current, localPos.current);
    dir.y = 0;
    const dist = dir.length();

    if (dist < 0.5) {
      isIdle.current = true;
      idleTimer.current = 2 + Math.random() * 4;
      if (prevAnim.current !== "idle") {
        playAnimation("idle");
        prevAnim.current = "idle";
      }
      setMovementSpeed(0);
      return;
    }

    dir.normalize();
    localPos.current.add(dir.clone().multiplyScalar(config.speed * delta));
    localPos.current.y = 0;

    const angle = Math.atan2(dir.x, dir.z);
    groupRef.current.rotation.y = angle;
    groupRef.current.position.copy(localPos.current);

    if (prevAnim.current !== "walk") {
      playAnimation("walk");
      prevAnim.current = "walk";
    }
    setMovementSpeed(config.speed);
  });

  return (
    <group ref={groupRef} position={localPos.current.toArray()}>
      <primitive object={scene} />
    </group>
  );
}

export default function TutorialIslandAnimals({
  spawnXZ,
}: {
  spawnXZ: [number, number];
}) {
  return (
    <>
      {ANIMALS.map((config) => (
        <Suspense key={config.id} fallback={null}>
          <TutorialAnimal config={config} spawnXZ={spawnXZ} />
        </Suspense>
      ))}
    </>
  );
}
