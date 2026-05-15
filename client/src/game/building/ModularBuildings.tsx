/**
 * ModularBuildings — renders placed modular building pieces from the
 * BuildingPalette as GLB models with Rapier physics colliders.
 *
 * Each piece gets:
 *   - A fixed RigidBody with auto-sized CuboidCollider from the model AABB
 *   - Shadow casting/receiving
 *   - Health bar when damaged
 *
 * Ghost preview shows the model in translucent blue with a snap-grid plane.
 * Input: LMB to place, R to rotate, RMB/Escape to deselect, Delete to remove.
 */

import { Suspense, useMemo, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useModularBuild, getModularPieceDef, type ModularPiece } from "@/lib/stores/useModularBuild";
import { COLLISION_MASKS } from "../components/BuildingColliders";
import { useAsset } from "../hooks/useAsset";
import { getTerrainHeight, globalHeightData } from "../components/Terrain";

// ---------------------------------------------------------------------------
// Placed piece renderer
// ---------------------------------------------------------------------------

const modelSizeCache = new Map<string, { scale: number; halfExtents: [number, number, number] }>();

function computeModelMetrics(scene: THREE.Object3D, path: string) {
  let cached = modelSizeCache.get(path);
  if (cached) return cached;

  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  // Normalize so the longest axis is ~1 m — modular pieces snap to 1 m grid
  const longest = Math.max(size.x, size.y, size.z, 0.01);
  const scale = 1 / longest;
  const hx = (size.x * scale) / 2;
  const hy = (size.y * scale) / 2;
  const hz = (size.z * scale) / 2;
  cached = { scale, halfExtents: [Math.max(hx, 0.05), Math.max(hy, 0.05), Math.max(hz, 0.05)] };
  modelSizeCache.set(path, cached);
  return cached;
}

function ModularPieceModel({ piece }: { piece: ModularPiece }) {
  const def = getModularPieceDef(piece.pieceId);
  if (!def) return null;
  const gltf = useAsset(def.path);

  const { model, halfExtents } = useMemo(() => {
    const { scale, halfExtents } = computeModelMetrics(gltf.scene, def.path);
    const clone = gltf.scene.clone(true);
    clone.scale.setScalar(scale);
    clone.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return { model: clone, halfExtents };
  }, [gltf, def.path]);

  const terrainY = getTerrainHeight(piece.position[0], piece.position[2], globalHeightData);
  const y = Math.max(piece.position[1], terrainY);

  return (
    <RigidBody
      type="fixed"
      position={[piece.position[0], y + halfExtents[1], piece.position[2]]}
      rotation={[0, piece.rotation, 0]}
      colliders={false}
      collisionGroups={COLLISION_MASKS.BUILDING}
    >
      <CuboidCollider args={halfExtents} friction={0.6} restitution={0.0} />
      <primitive object={model} position={[0, -halfExtents[1], 0]} />
      {piece.health < piece.maxHealth && (
        <mesh position={[0, halfExtents[1] * 2 + 0.3, 0]}>
          <planeGeometry args={[0.8, 0.08]} />
          <meshBasicMaterial
            color={piece.health > piece.maxHealth * 0.5 ? "#2ecc71" : "#e74c3c"}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </RigidBody>
  );
}

// ---------------------------------------------------------------------------
// Ghost preview
// ---------------------------------------------------------------------------

const ghostMatCache = new Map<string, THREE.MeshStandardMaterial>();

function GhostPieceModel({ pieceId }: { pieceId: string }) {
  const def = getModularPieceDef(pieceId);
  if (!def) return null;
  const gltf = useAsset(def.path);

  const model = useMemo(() => {
    const { scale } = computeModelMetrics(gltf.scene, def.path);
    const clone = gltf.scene.clone(true);
    clone.scale.setScalar(scale);
    // Ghost material
    let ghostMat = ghostMatCache.get(def.path);
    if (!ghostMat) {
      ghostMat = new THREE.MeshStandardMaterial({
        color: "#4ea1ff",
        emissive: "#1a4a7a",
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.5,
        roughness: 0.4,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      ghostMatCache.set(def.path, ghostMat);
    }
    clone.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.material = ghostMat;
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
    return clone;
  }, [gltf, def.path]);

  return <primitive object={model} />;
}

function GhostPreview() {
  const selectedPieceId = useModularBuild(s => s.selectedPieceId);
  const ghostPosition = useModularBuild(s => s.ghostPosition);
  const ghostRotation = useModularBuild(s => s.ghostRotation);

  if (!selectedPieceId || !ghostPosition) return null;
  const def = getModularPieceDef(selectedPieceId);
  if (!def) return null;

  return (
    <group position={ghostPosition} rotation={[0, ghostRotation, 0]}>
      <Suspense fallback={
        <mesh>
          <boxGeometry args={[def.snapSize, def.snapSize, def.snapSize]} />
          <meshStandardMaterial color="#4ea1ff" transparent opacity={0.4} />
        </mesh>
      }>
        <GhostPieceModel pieceId={selectedPieceId} />
      </Suspense>
      {/* Snap grid plane */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[def.snapSize, def.snapSize]} />
        <meshBasicMaterial color="#4ea1ff" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Placement raycaster — follows mouse and snaps ghost to terrain
// ---------------------------------------------------------------------------

function PlacementRaycaster() {
  const rayRef = useRef(new THREE.Raycaster());
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hitRef = useRef(new THREE.Vector3());

  useFrame(({ camera, mouse }) => {
    const { active, selectedPieceId, setGhostPosition } = useModularBuild.getState();
    if (!active || !selectedPieceId) return;

    rayRef.current.setFromCamera(mouse, camera);
    rayRef.current.ray.intersectPlane(planeRef.current, hitRef.current);

    if (hitRef.current) {
      const terrainY = getTerrainHeight(hitRef.current.x, hitRef.current.z, globalHeightData);
      setGhostPosition([hitRef.current.x, terrainY, hitRef.current.z]);
    }
  });

  return null;
}

// ---------------------------------------------------------------------------
// Input handler — LMB place, R rotate, RMB/Escape cancel, Delete remove
// ---------------------------------------------------------------------------

function ModularBuildInput() {
  const { camera } = useThree();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const state = useModularBuild.getState();
      if (!state.active || !state.selectedPieceId) return;
      if (e.button === 0) {
        state.placeCurrentPiece();
      } else if (e.button === 2) {
        state.selectPiece(null);
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      const state = useModularBuild.getState();
      if (!state.active) return;
      if (e.code === "KeyR" && !e.repeat) {
        state.rotateGhost();
      }
      if (e.code === "Escape") {
        state.selectPiece(null);
      }
    };

    const handleContext = (e: MouseEvent) => {
      if (useModularBuild.getState().active) e.preventDefault();
    };

    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("contextmenu", handleContext);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("contextmenu", handleContext);
    };
  }, [camera]);

  return null;
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function ModularBuildings() {
  const placedPieces = useModularBuild(s => s.placedPieces);
  const active = useModularBuild(s => s.active);

  return (
    <>
      {placedPieces.map(piece => (
        <Suspense key={piece.uid} fallback={null}>
          <ModularPieceModel piece={piece} />
        </Suspense>
      ))}
      {active && (
        <>
          <GhostPreview />
          <PlacementRaycaster />
          <ModularBuildInput />
        </>
      )}
    </>
  );
}
