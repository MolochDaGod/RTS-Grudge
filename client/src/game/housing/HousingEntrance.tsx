import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "@/lib/stores/useGame";
import { useHousing } from "@/lib/stores/useHousing";
import { getTerrainHeight, globalHeightData } from "../components/Terrain";

interface HousingEntranceProps {
  playerPosition: THREE.Vector3;
}

const HOUSE_X = 18;
const HOUSE_Z = 12;
const INTERACT_RANGE = 5;

function createTextTexture(text: string, color: string = "#ffffff"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 20, 512, 88);
  ctx.font = "bold 38px Arial";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function HousingLabel({ text, y, color = "#ffffff" }: { text: string; y: number; color?: string }) {
  const texture = useRef(createTextTexture(text, color)).current;
  return (
    <sprite position={[0, y, 2]} scale={[4, 0.8, 1]}>
      <spriteMaterial map={texture} transparent />
    </sprite>
  );
}

export default function HousingEntrance({ playerPosition }: HousingEntranceProps) {
  const groupRef = useRef<THREE.Group>(null);
  const cooldown = useRef(false);
  const promptRef = useRef<THREE.Group>(null);
  const { enterHousing, phase } = useGame();
  const unlocked = useHousing((s) => s.unlocked);

  const terrainY = useMemo(() => getTerrainHeight(HOUSE_X, HOUSE_Z, globalHeightData), []);
  const housePos = useMemo(() => new THREE.Vector3(HOUSE_X, terrainY, HOUSE_Z), [terrainY]);

  useFrame(() => {
    if (!promptRef.current) return;

    const dist = playerPosition.distanceTo(housePos);
    const inRange = dist < INTERACT_RANGE && phase === "playing" && unlocked;
    promptRef.current.visible = inRange;

    if (inRange && !cooldown.current) {
      if ((window as any).__dungeonInteract) {
        cooldown.current = true;
        console.log("[Housing] Entering house from overworld");
        enterHousing({ x: playerPosition.x, z: playerPosition.z });
        setTimeout(() => {
          cooldown.current = false;
        }, 2000);
      }
    }
  });

  return (
    <group ref={groupRef} position={[HOUSE_X, terrainY, HOUSE_Z]}>
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[5, 3, 4]} />
        <meshStandardMaterial color="#8B6914" roughness={0.9} />
      </mesh>

      <mesh position={[0, 3.5, 0]} castShadow>
        <coneGeometry args={[3.8, 2.5, 4]} />
        <meshStandardMaterial color="#6B3A2A" roughness={0.85} />
      </mesh>

      <mesh position={[0, 0.8, 2.01]}>
        <boxGeometry args={[1, 1.6, 0.1]} />
        <meshStandardMaterial color="#4A2F1A" roughness={0.8} />
      </mesh>

      <mesh position={[0, 0.85, 2.05]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#C0A030" metalness={0.8} roughness={0.3} />
      </mesh>

      <mesh position={[-1.5, 1.8, 2.01]}>
        <boxGeometry args={[0.8, 0.8, 0.1]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} roughness={0.1} />
      </mesh>
      <mesh position={[1.5, 1.8, 2.01]}>
        <boxGeometry args={[0.8, 0.8, 0.1]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} roughness={0.1} />
      </mesh>

      <mesh position={[-1.5, 1.8, -2.01]}>
        <boxGeometry args={[0.8, 0.8, 0.1]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} roughness={0.1} />
      </mesh>
      <mesh position={[1.5, 1.8, -2.01]}>
        <boxGeometry args={[0.8, 0.8, 0.1]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} roughness={0.1} />
      </mesh>

      <mesh position={[0.3, 4.8, 0.3]}>
        <cylinderGeometry args={[0.12, 0.15, 1.2, 8]} />
        <meshStandardMaterial color="#8B4513" roughness={0.7} />
      </mesh>
      <mesh position={[0.3, 5.5, 0.3]}>
        <coneGeometry args={[0.15, 0.4, 8]} />
        <meshStandardMaterial color="#555" roughness={0.8} />
      </mesh>

      <pointLight position={[0, 2, 2.5]} color="#ffcc66" intensity={3} distance={8} />

      <HousingLabel text="Player House" y={6} />

      <group ref={promptRef} visible={false}>
        <HousingLabel text="[Press T to Enter]" y={0.5} color="#aaffaa" />
      </group>
    </group>
  );
}
