import { useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useSurvivalBuilding } from "@/lib/stores/useSurvivalBuilding";
import { getTerrainHeight, globalHeightData } from "./Terrain";
import { COLLISION_MASKS } from "./BuildingColliders";

function SurvivalBuildingMesh({ building }: { building: ReturnType<typeof useSurvivalBuilding.getState>["placedBuildings"][0] }) {
  const [sx, sy, sz] = building.size;
  const isWall = sy > 1 && sz < 0.5;
  const isDoorway = building.recipeId === "wood_wall_door";
  const isWindow = building.recipeId === "wood_wall_window";
  const isCampfire = building.recipeId === "campfire" || building.recipeId === "fire_pit";

  return (
    <RigidBody
      type="fixed"
      position={[building.position[0], building.position[1] + sy / 2, building.position[2]]}
      rotation={[0, building.rotation, 0]}
      colliders={false}
      collisionGroups={COLLISION_MASKS.BUILDING}
    >
      <CuboidCollider args={[sx / 2, sy / 2, sz / 2]} friction={0.5} restitution={0.0} />
      <group>
        {isDoorway ? (
          <>
            <mesh castShadow receiveShadow position={[-sx * 0.35, 0, 0]}>
              <boxGeometry args={[sx * 0.3, sy, sz]} />
              <meshStandardMaterial color={building.color} roughness={0.8} />
            </mesh>
            <mesh castShadow receiveShadow position={[sx * 0.35, 0, 0]}>
              <boxGeometry args={[sx * 0.3, sy, sz]} />
              <meshStandardMaterial color={building.color} roughness={0.8} />
            </mesh>
            <mesh castShadow receiveShadow position={[0, sy * 0.4, 0]}>
              <boxGeometry args={[sx * 0.4, sy * 0.2, sz]} />
              <meshStandardMaterial color={building.color} roughness={0.8} />
            </mesh>
          </>
        ) : isWindow ? (
          <>
            <mesh castShadow receiveShadow position={[0, -sy * 0.3, 0]}>
              <boxGeometry args={[sx, sy * 0.4, sz]} />
              <meshStandardMaterial color={building.color} roughness={0.8} />
            </mesh>
            <mesh castShadow receiveShadow position={[0, sy * 0.35, 0]}>
              <boxGeometry args={[sx, sy * 0.3, sz]} />
              <meshStandardMaterial color={building.color} roughness={0.8} />
            </mesh>
            <mesh castShadow receiveShadow position={[-sx * 0.4, 0, 0]}>
              <boxGeometry args={[sx * 0.2, sy, sz]} />
              <meshStandardMaterial color={building.color} roughness={0.8} />
            </mesh>
            <mesh castShadow receiveShadow position={[sx * 0.4, 0, 0]}>
              <boxGeometry args={[sx * 0.2, sy, sz]} />
              <meshStandardMaterial color={building.color} roughness={0.8} />
            </mesh>
          </>
        ) : (
          <mesh castShadow receiveShadow>
            <boxGeometry args={[sx, sy, sz]} />
            <meshStandardMaterial color={building.color} roughness={isWall ? 0.8 : 0.7} />
          </mesh>
        )}

        {isCampfire && (
          <pointLight
            position={[0, sy + 0.5, 0]}
            color="#ff6600"
            intensity={3}
            distance={8}
            decay={2}
          />
        )}
      </group>
    </RigidBody>
  );
}

function GhostPreview() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const state = useSurvivalBuilding.getState();
      if (state.pendingRecipe && state.ghostPosition) {
        state.placeBuilding();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyR") {
        useSurvivalBuilding.getState().rotateGhost();
      }
      if (e.code === "Escape") {
        useSurvivalBuilding.getState().setPendingRecipe(null);
      }
    };

    gl.domElement.addEventListener("mousemove", handleMouseMove);
    gl.domElement.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      gl.domElement.removeEventListener("mousemove", handleMouseMove);
      gl.domElement.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [gl, camera]);

  useFrame(() => {
    const state = useSurvivalBuilding.getState();
    if (!state.pendingRecipe) return;

    raycaster.current.setFromCamera(mouse.current, camera);
    const target = new THREE.Vector3();
    raycaster.current.ray.intersectPlane(plane.current, target);

    if (target) {
      const terrainY = getTerrainHeight(target.x, target.z, globalHeightData);
      const snappedX = Math.round(target.x * 2) / 2;
      const snappedZ = Math.round(target.z * 2) / 2;
      state.setGhostPosition([snappedX, terrainY, snappedZ]);
    }
  });

  const pending = useSurvivalBuilding((s) => s.pendingRecipe);
  const ghostPos = useSurvivalBuilding((s) => s.ghostPosition);
  const ghostRot = useSurvivalBuilding((s) => s.ghostRotation);

  if (!pending || !ghostPos) return null;

  const [sx, sy, sz] = pending.size;

  return (
    <mesh
      ref={meshRef}
      position={[ghostPos[0], ghostPos[1] + sy / 2, ghostPos[2]]}
      rotation={[0, ghostRot, 0]}
    >
      <boxGeometry args={[sx, sy, sz]} />
      <meshStandardMaterial color={pending.color} transparent opacity={0.5} />
    </mesh>
  );
}

export default function SurvivalBuildings() {
  const buildings = useSurvivalBuilding((s) => s.placedBuildings);
  const pending = useSurvivalBuilding((s) => s.pendingRecipe);

  useEffect(() => {
    const handler = (e: Event) => {
      const recipe = (e as CustomEvent).detail;
      useSurvivalBuilding.getState().setPendingRecipe(recipe);
    };
    window.addEventListener("survival-build-place", handler);
    return () => window.removeEventListener("survival-build-place", handler);
  }, []);

  return (
    <>
      {buildings.map((b) => (
        <SurvivalBuildingMesh key={b.uid} building={b} />
      ))}
      {pending && <GhostPreview />}
    </>
  );
}
