import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "@/lib/stores/useGame";
import { getTerrainHeight, globalHeightData } from "../components/Terrain";
import { PortalParticles } from "../effects/ParticleEffects";

interface DungeonEntrancesProps {
  playerPosition: THREE.Vector3;
}

const ENTRANCE_LOCATIONS = [
  { x: -62, z: -58, level: 1, label: "Crypt of Shadows" },
  { x: -77, z: -38, level: 2, label: "Deep Mine" },
  { x: 72, z: 57, level: 3, label: "Temple Depths" },
];

function DungeonPortal({ x, z, level, label, playerPosition }: {
  x: number; z: number; level: number; label: string; playerPosition: THREE.Vector3;
}) {
  const portalRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const { enterDungeon, phase } = useGame();
  const cooldown = useRef(false);
  const terrainY = getTerrainHeight(x, z, globalHeightData);

  useFrame((_, delta) => {
    if (!portalRef.current) return;

    if (glowRef.current) {
      glowRef.current.rotation.y += delta * 0.5;
      const t = Date.now() * 0.002;
      const scale = 1 + Math.sin(t) * 0.1;
      glowRef.current.scale.set(scale, scale, scale);
    }

    const portalPos = new THREE.Vector3(x, terrainY, z);
    const dist = playerPosition.distanceTo(portalPos);

    if (dist < 4 && phase === "playing" && !cooldown.current) {
      if ((window as any).__dungeonInteract) {
        cooldown.current = true;
        enterDungeon(level, { x, z });
        setTimeout(() => { cooldown.current = false; }, 2000);
      }
    }
  });

  return (
    <group ref={portalRef} position={[x, terrainY, z]}>
      <mesh position={[0, 2.5, 0]}>
        <torusGeometry args={[2, 0.3, 16, 32]} />
        <meshStandardMaterial color="#6633cc" emissive="#6633cc" emissiveIntensity={0.5} metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh ref={glowRef} position={[0, 2.5, 0]}>
        <circleGeometry args={[1.6, 32]} />
        <meshStandardMaterial
          color="#9966ff"
          emissive="#9966ff"
          emissiveIntensity={2}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[-2.3, 2.5, 0]}>
        <boxGeometry args={[0.4, 5, 0.4]} />
        <meshStandardMaterial color="#443355" roughness={0.8} />
      </mesh>
      <mesh position={[2.3, 2.5, 0]}>
        <boxGeometry args={[0.4, 5, 0.4]} />
        <meshStandardMaterial color="#443355" roughness={0.8} />
      </mesh>
      <mesh position={[0, 5.2, 0]}>
        <boxGeometry args={[5, 0.4, 0.4]} />
        <meshStandardMaterial color="#443355" roughness={0.8} />
      </mesh>

      <pointLight position={[0, 3, 1]} color="#9966ff" intensity={5} distance={10} />

      <PortalParticles position={[0, 1, 0]} color="#9933ff" />

      <PortalLabel text={`${label} (Lv.${level})`} y={6} />
      <PortalLabel text="[Press T]" y={0.8} color="#ccaaff" />
    </group>
  );
}

function PortalLabel({ text, y, color = "#ffffff" }: { text: string; y: number; color?: string }) {
  const texture = useRef(createTextTexture(text, color)).current;
  return (
    <sprite position={[0, y, 1.5]} scale={[4, 0.8, 1]}>
      <spriteMaterial map={texture} transparent />
    </sprite>
  );
}

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

export default function DungeonEntrances({ playerPosition }: DungeonEntrancesProps) {
  return (
    <group>
      {ENTRANCE_LOCATIONS.map((loc, i) => (
        <DungeonPortal
          key={`dungeon_entrance_${i}`}
          x={loc.x}
          z={loc.z}
          level={loc.level}
          label={loc.label}
          playerPosition={playerPosition}
        />
      ))}
    </group>
  );
}
