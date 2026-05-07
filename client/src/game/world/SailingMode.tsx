import { useRef, useMemo, Suspense, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { importFromScene } from "../systems/AssetPipeline";
import { useAsset } from "../hooks/useAsset";
import { useIslandWorld, ISLAND_SIZE } from "@/lib/stores/useIslandWorld";
import { PIRATE_ASSETS } from "../dungeon/DungeonAssetMap";
import { SeaSurface } from "../effects/SeaSurface";

function PlayerShip() {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useAsset(PIRATE_ASSETS.ship_large);
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const normalized = importFromScene(clone, [], "player_ship", {
      targetHeight: 6,
      sanitizeBones: false,
      fixDarkMaterials: true,
      enableShadows: true,
    });
    const box = new THREE.Box3().setFromObject(normalized.scene);
    normalized.scene.position.y = -box.min.y;
    return normalized.scene;
  }, [gltf]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const time = clock.getElapsedTime();
      groupRef.current.rotation.z = Math.sin(time * 0.8) * 0.03;
      groupRef.current.position.y = Math.sin(time * 0.5) * 0.15 - 0.5;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.5, 0]}>
      <primitive object={model} />
    </group>
  );
}

function SailingOcean() {
  // Top-of-water for the cinematic sailing transition — Seascape shader,
  // tuned slightly choppier and with a deeper base to match the mood of
  // open-ocean travel between islands.
  return (
    <SeaSurface
      size={800}
      y={-0.8}
      opacity={0.95}
      seaBase="#08243f"
      seaWaterColor="#9bc0cc"
      choppy={4.5}
      height={0.75}
    />
  );
}

function DistantIsland({ direction, distance }: {
  direction: [number, number, number];
  distance: number;
}) {
  return (
    <group position={[direction[0] * distance, 0, direction[2] * distance]}>
      <mesh position={[0, 2, 0]} castShadow>
        <coneGeometry args={[15, 8, 8]} />
        <meshStandardMaterial color="#4a6b3f" roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[20, 22, 2, 12]} />
        <meshStandardMaterial color="#c2b280" roughness={0.9} />
      </mesh>
    </group>
  );
}

export function SailingScene({ onArrive }: { onArrive: () => void }) {
  const progressRef = useRef(0);
  const arrivedRef = useRef(false);
  const shipGroupRef = useRef<THREE.Group>(null);
  const { sailingTarget } = useIslandWorld();

  useFrame((_, delta) => {
    progressRef.current += delta * 0.08;
    if (shipGroupRef.current) {
      shipGroupRef.current.position.z = -progressRef.current * 100;
    }
    if (progressRef.current >= 1 && !arrivedRef.current) {
      arrivedRef.current = true;
      onArrive();
    }
  });

  return (
    <group>
      <ambientLight intensity={0.6} color="#88aacc" />
      <directionalLight position={[50, 80, 30]} intensity={1.2} color="#ffeedd" castShadow />
      <SailingOcean />
      <group ref={shipGroupRef}>
        <Suspense fallback={null}>
          <PlayerShip />
        </Suspense>
      </group>
      <DistantIsland direction={[1, 0, 0.5]} distance={200} />
      <DistantIsland direction={[-0.8, 0, 0.3]} distance={250} />
      <DistantIsland direction={[0.2, 0, -1]} distance={300} />
      <fog attach="fog" args={["#6699bb", 50, 400]} />
      <color attach="background" args={["#88bbdd"]} />
    </group>
  );
}

export function SailingHUD() {
  const { sailingTarget, currentIslandId, islands } = useIslandWorld();
  const current = islands.get(currentIslandId);
  const discovered = Array.from(islands.values()).filter(i => i.discovered);

  return (
    <div style={{
      position: "absolute",
      top: 10,
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.7)",
      color: "white",
      padding: "10px 20px",
      borderRadius: 8,
      fontFamily: "monospace",
      fontSize: 14,
      zIndex: 100,
      textAlign: "center",
    }}>
      {sailingTarget ? (
        <div>
          <div style={{ fontSize: 18, marginBottom: 4 }}>Sailing...</div>
          <div>Heading to island ({sailingTarget.gridX}, {sailingTarget.gridZ})</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 16 }}>
            {current?.biome.charAt(0).toUpperCase()}{current?.biome.slice(1)} Island
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Islands discovered: {discovered.length}
          </div>
        </div>
      )}
    </div>
  );
}

export function DockPrompt({ visible, onBoard }: { visible: boolean; onBoard: () => void }) {
  useEffect(() => {
    if (!visible) {
      (window as any).__nearDock = false;
      return;
    }
    (window as any).__nearDock = true;
    const handler = (e: KeyboardEvent) => {
      if (e.code === "KeyE") onBoard();
    };
    window.addEventListener("keydown", handler);
    return () => {
      (window as any).__nearDock = false;
      window.removeEventListener("keydown", handler);
    };
  }, [visible, onBoard]);

  if (!visible) return null;

  return (
    <div style={{
      position: "absolute",
      bottom: 120,
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.8)",
      color: "#ffcc00",
      padding: "8px 16px",
      borderRadius: 6,
      fontFamily: "monospace",
      fontSize: 16,
      zIndex: 100,
      border: "1px solid #ffcc00",
    }}>
      Press E to board boat
    </div>
  );
}

export function IslandSelector({ onSelect, onCancel }: {
  onSelect: (gridX: number, gridZ: number) => void;
  onCancel: () => void;
}) {
  const { islands, currentIslandId } = useIslandWorld();
  const current = islands.get(currentIslandId);
  if (!current) return null;

  const directions = [
    { label: "North", dx: 0, dz: -1, key: "w" },
    { label: "South", dx: 0, dz: 1, key: "s" },
    { label: "East", dx: 1, dz: 0, key: "d" },
    { label: "West", dx: -1, dz: 0, key: "a" },
  ];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const dir = directions.find(d => e.key.toLowerCase() === d.key);
      if (dir) onSelect(current.gridX + dir.dx, current.gridZ + dir.dz);
      if (e.code === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, onSelect, onCancel]);

  return (
    <div style={{
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      background: "rgba(0,0,0,0.9)",
      color: "white",
      padding: 20,
      borderRadius: 12,
      fontFamily: "monospace",
      zIndex: 200,
      minWidth: 250,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 18, marginBottom: 12 }}>Choose Destination</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div />
        <button onClick={() => onSelect(current.gridX, current.gridZ - 1)}
          style={btnStyle}>
          W - North
        </button>
        <div />
        <button onClick={() => onSelect(current.gridX - 1, current.gridZ)}
          style={btnStyle}>
          A - West
        </button>
        <div style={{ color: "#ffcc00", padding: 8 }}>You</div>
        <button onClick={() => onSelect(current.gridX + 1, current.gridZ)}
          style={btnStyle}>
          D - East
        </button>
        <div />
        <button onClick={() => onSelect(current.gridX, current.gridZ + 1)}
          style={btnStyle}>
          S - South
        </button>
        <div />
      </div>
      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>
        ESC to cancel
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#2a4a6a",
  color: "white",
  border: "1px solid #4a8abb",
  borderRadius: 6,
  padding: "8px 12px",
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: 13,
};
