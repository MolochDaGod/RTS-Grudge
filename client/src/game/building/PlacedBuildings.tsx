import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useBuildSystem, getBuildingDef, type PlacedBuilding } from "@/lib/stores/useBuildSystem";
import { useAsset } from "../hooks/useAsset";
import { getTerrainHeight, globalHeightData } from "../components/Terrain";
import { useCheats } from "@/lib/stores/useCheats";
import {
  buildOrientedBoxDebugTrimesh,
  useDebugColliderRegistration,
  type DebugColliderEntry,
} from "../cheats/StreamedColliderDebugOverlay";

const modelCache = new Map<string, THREE.Object3D>();

function BuildingModel({ building }: { building: PlacedBuilding }) {
  const def = getBuildingDef(building.defId);
  if (!def) return null;
  const gltf = useAsset(def.modelPath);

  const model = useMemo(() => {
    const cacheKey = def.modelPath;
    let cached = modelCache.get(cacheKey);
    if (!cached) {
      const clone = gltf.scene.clone(true);
      const box = new THREE.Box3().setFromObject(clone);
      const height = box.max.y - box.min.y;
      const targetHeight = Math.max(def.size[0], def.size[1]) * 0.8;
      const scale = targetHeight / Math.max(height, 0.01);
      clone.scale.setScalar(scale);
      clone.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      cached = clone;
      modelCache.set(cacheKey, cached);
    }
    return cached.clone();
  }, [gltf, def]);

  const terrainY = getTerrainHeight(building.position[0], building.position[2], globalHeightData);

  return (
    <group
      position={[building.position[0], terrainY, building.position[2]]}
      rotation={[0, building.rotation, 0]}
    >
      <primitive object={model} />
      {building.health < building.maxHealth && (
        <mesh position={[0, 4, 0]}>
          <planeGeometry args={[2, 0.2]} />
          <meshBasicMaterial color={building.health > building.maxHealth * 0.5 ? "#2ecc71" : "#e74c3c"} />
        </mesh>
      )}
    </group>
  );
}

// Cache the prepared (scaled + ghost-material) ghost model per buildingDef so we
// don't pay GLB-clone cost every frame. We swap materials to a translucent blue.
const ghostModelCache = new Map<string, THREE.Object3D>();

function GhostModel({ defId, modelPath, size }: { defId: string; modelPath: string; size: [number, number] }) {
  const gltf = useAsset(modelPath);

  const model = useMemo(() => {
    // Composite key so the cache invalidates when modelPath or footprint changes
    // (hot-reloads, content tweaks, level upgrades that swap the GLB).
    const cacheKey = `${defId}|${modelPath}|${size[0]}x${size[1]}`;
    let cached = ghostModelCache.get(cacheKey);
    if (!cached) {
      const clone = gltf.scene.clone(true);
      const box = new THREE.Box3().setFromObject(clone);
      const height = box.max.y - box.min.y;
      const targetHeight = Math.max(size[0], size[1]) * 0.8;
      const scale = targetHeight / Math.max(height, 0.01);
      clone.scale.setScalar(scale);

      // Replace every mesh material with a translucent blue ghost material so
      // the player still sees the silhouette of the actual structure.
      const ghostMat = new THREE.MeshStandardMaterial({
        color: "#4ea1ff",
        emissive: "#1a4a7a",
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.55,
        roughness: 0.4,
        metalness: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      clone.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.material = ghostMat;
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
      cached = clone;
      ghostModelCache.set(cacheKey, cached);
    }
    return cached;
  }, [gltf, defId, modelPath, size]);

  return <primitive object={model} />;
}

function GhostBuilding() {
  const selectedBuildingId = useBuildSystem(s => s.selectedBuildingId);
  const ghostPosition = useBuildSystem(s => s.ghostPosition);
  const ghostRotation = useBuildSystem(s => s.ghostRotation);
  const groupRef = useRef<THREE.Group>(null);

  if (!selectedBuildingId || !ghostPosition) return null;
  const def = getBuildingDef(selectedBuildingId);
  if (!def) return null;

  // Footprint plane stays so the player can see exactly which tiles will be claimed.
  return (
    <group ref={groupRef} position={ghostPosition} rotation={[0, ghostRotation, 0]}>
      <Suspense fallback={
        <mesh>
          <boxGeometry args={[def.size[0], 2, def.size[1]]} />
          <meshStandardMaterial color="#4ea1ff" transparent opacity={0.4} />
        </mesh>
      }>
        <GhostModel defId={def.id} modelPath={def.modelPath} size={def.size} />
      </Suspense>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[def.size[0], def.size[1]]} />
        <meshBasicMaterial color="#4ea1ff" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

function BuildingInteraction() {
  const rayRef = useRef(new THREE.Raycaster());
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const intersectionRef = useRef(new THREE.Vector3());

  useFrame(({ camera, mouse }) => {
    const { buildMode, selectedBuildingId, setGhostPosition } = useBuildSystem.getState();
    if (!buildMode || !selectedBuildingId) return;

    rayRef.current.setFromCamera(mouse, camera);
    rayRef.current.ray.intersectPlane(planeRef.current, intersectionRef.current);

    if (intersectionRef.current) {
      const snapped: [number, number, number] = [
        Math.round(intersectionRef.current.x / 2) * 2,
        getTerrainHeight(intersectionRef.current.x, intersectionRef.current.z, globalHeightData),
        Math.round(intersectionRef.current.z / 2) * 2,
      ];
      setGhostPosition(snapped);
    }
  });

  return null;
}

export default function PlacedBuildings() {
  const placedBuildings = useBuildSystem(s => s.placedBuildings);
  const buildMode = useBuildSystem(s => s.buildMode);

  // F8 collider overlay: visualize each player-placed building's
  // footprint. Placed buildings don't currently mount Rapier colliders
  // (they're visual-only), so the bbox we publish here approximates
  // the visible model extents using the same `targetHeight ≈ max(w, d)
  // * 0.8` rule `<BuildingModel>` uses to fit the GLB. Names are keyed
  // by `defId` so the overlay's hashed colour groups same-def buildings
  // together — handy when scanning a base for type clusters.
  const debugOn = useCheats((s) => s.enabled && s.debugColliders);
  const debugEntries = useMemo<DebugColliderEntry[] | null>(() => {
    if (!debugOn || placedBuildings.length === 0) return null;
    const out: DebugColliderEntry[] = [];
    for (const b of placedBuildings) {
      const def = getBuildingDef(b.defId);
      if (!def) continue;
      const [w, d] = def.size;
      const h = Math.max(w, d) * 0.8; // matches `BuildingModel`'s targetHeight
      const terrainY = getTerrainHeight(b.position[0], b.position[2], globalHeightData);
      const cy = terrainY + h / 2;
      const { vertices, indices, bbox } = buildOrientedBoxDebugTrimesh(
        b.position[0], cy, b.position[2],
        w / 2, h / 2, d / 2,
        b.rotation,
      );
      out.push({
        name: `placed_building_${b.defId}`,
        vertices,
        indices,
        bbox,
      });
    }
    return out;
  }, [debugOn, placedBuildings]);
  useDebugColliderRegistration("PlacedBuildings", debugEntries);

  return (
    <>
      {placedBuildings.map(b => (
        <Suspense key={b.uid} fallback={null}>
          <BuildingModel building={b} />
        </Suspense>
      ))}
      {buildMode && <GhostBuilding />}
      <BuildingInteraction />
    </>
  );
}
