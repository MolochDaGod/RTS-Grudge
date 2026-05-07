import { useRef, Suspense, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useIslandWorld, ISLAND_SIZE } from "@/lib/stores/useIslandWorld";
import { importFromScene } from "../systems/AssetPipeline";
import { PIRATE_ASSETS } from "../dungeon/DungeonAssetMap";
import { useAsset } from "../hooks/useAsset";
import { SeaSurface } from "../effects/SeaSurface";

function BoatModel({ position, rotation, scale = 4 }: {
  position: [number, number, number];
  rotation: number;
  scale?: number;
}) {
  const gltf = useAsset(PIRATE_ASSETS.ship_small);
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const normalized = importFromScene(clone, [], "ship_small", {
      targetHeight: scale,
      sanitizeBones: false,
      fixDarkMaterials: true,
      enableShadows: true,
    });
    const box = new THREE.Box3().setFromObject(normalized.scene);
    normalized.scene.position.y = -box.min.y;
    return normalized.scene;
  }, [gltf, scale]);

  // Gentle bob — each boat gets a per-instance phase keyed off its
  // position so a row of moored boats doesn't bob in lockstep. We
  // animate the parent group rather than the model itself so the
  // model's own y-offset (computed above to seat the keel on the
  // waterline) is preserved.
  const groupRef = useRef<THREE.Group>(null);
  const phase = useMemo(() => position[0] * 0.13 + position[2] * 0.27, [position]);
  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.position.y = position[1] + Math.sin(t * 0.7 + phase) * 0.08;
    g.rotation.z = Math.sin(t * 0.55 + phase) * 0.025;
    g.rotation.x = Math.cos(t * 0.45 + phase * 1.3) * 0.018;
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
      <primitive object={model} />
    </group>
  );
}

function DockModel({ position, rotation }: {
  position: [number, number, number];
  rotation: number;
}) {
  const gltf = useAsset(PIRATE_ASSETS.dock);
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const normalized = importFromScene(clone, [], "dock", {
      targetHeight: 2,
      sanitizeBones: false,
      fixDarkMaterials: true,
      enableShadows: true,
    });
    const box = new THREE.Box3().setFromObject(normalized.scene);
    normalized.scene.position.y = -box.min.y;
    return normalized.scene;
  }, [gltf]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <primitive object={model} />
    </group>
  );
}

export function DockArea({ dockPositions }: {
  dockPositions: { x: number; z: number; rotation: number }[];
}) {
  return (
    <group>
      {dockPositions.map((dock, i) => (
        <Suspense key={`dock_${i}`} fallback={null}>
          <DockModel
            position={[dock.x, 0.1, dock.z]}
            rotation={dock.rotation}
          />
          <BoatModel
            position={[
              dock.x + Math.cos(dock.rotation + Math.PI / 2) * 6,
              -0.3,
              dock.z + Math.sin(dock.rotation + Math.PI / 2) * 6,
            ]}
            rotation={dock.rotation}
            scale={3}
          />
        </Suspense>
      ))}
    </group>
  );
}

export function BoardBoatZone({ dockPositions, playerPosition }: {
  dockPositions: { x: number; z: number; rotation: number }[];
  playerPosition: THREE.Vector3;
}) {
  const nearDock = useRef(false);
  const { sailing, startSailing, currentIslandId } = useIslandWorld();
  const cooldown = useRef(false);

  useFrame(() => {
    if (sailing || cooldown.current) return;

    let near = false;
    for (const dock of dockPositions) {
      const boatX = dock.x + Math.cos(dock.rotation + Math.PI / 2) * 6;
      const boatZ = dock.z + Math.sin(dock.rotation + Math.PI / 2) * 6;
      const dist = Math.sqrt(
        (playerPosition.x - boatX) ** 2 + (playerPosition.z - boatZ) ** 2
      );
      if (dist < 5) {
        near = true;
        break;
      }
    }
    nearDock.current = near;
  });

  return null;
}

export function BoatBoardPrompt({ dockPositions, playerPosition }: {
  dockPositions: { x: number; z: number; rotation: number }[];
  playerPosition: THREE.Vector3;
}) {
  const near = useRef(false);

  useFrame(() => {
    let isNear = false;
    for (const dock of dockPositions) {
      const boatX = dock.x + Math.cos(dock.rotation + Math.PI / 2) * 6;
      const boatZ = dock.z + Math.sin(dock.rotation + Math.PI / 2) * 6;
      const dist = Math.sqrt(
        (playerPosition.x - boatX) ** 2 + (playerPosition.z - boatZ) ** 2
      );
      if (dist < 5) { isNear = true; break; }
    }
    near.current = isNear;
  });

  return null;
}

export function OceanPlane() {
  // Top-of-water surface — Seascape (TDM 2014) shader. CPU sine-wave vertex
  // animation removed; all wave detail now lives in the fragment shader so
  // the plane stays geometrically flat (clean physics) but reads as choppy.
  return (
    <SeaSurface
      size={ISLAND_SIZE * 3}
      y={-0.3}
      opacity={0.9}
      seaBase="#0e2840"
      seaWaterColor="#a8c4d0"
    />
  );
}

export function EdgeDetector({ playerPosition, onReachEdge }: {
  playerPosition: THREE.Vector3;
  onReachEdge: (direction: "north" | "south" | "east" | "west") => void;
}) {
  const halfSize = ISLAND_SIZE / 2;
  const threshold = halfSize - 5;
  const cooldown = useRef(false);

  useFrame(() => {
    if (cooldown.current) return;
    const px = playerPosition.x;
    const pz = playerPosition.z;

    if (px > threshold) {
      cooldown.current = true;
      onReachEdge("east");
      setTimeout(() => { cooldown.current = false; }, 3000);
    } else if (px < -threshold) {
      cooldown.current = true;
      onReachEdge("west");
      setTimeout(() => { cooldown.current = false; }, 3000);
    } else if (pz > threshold) {
      cooldown.current = true;
      onReachEdge("south");
      setTimeout(() => { cooldown.current = false; }, 3000);
    } else if (pz < -threshold) {
      cooldown.current = true;
      onReachEdge("north");
      setTimeout(() => { cooldown.current = false; }, 3000);
    }
  });

  return null;
}
