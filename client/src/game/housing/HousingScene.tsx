import { Suspense, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { KeyboardControls, useTexture } from "@react-three/drei";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import Player from "../components/Player";
import Camera from "../components/Camera";
import HUD from "../components/HUD";
import { AssetLoaderInit } from "../systems/AssetLoaderInit";
import { useGame } from "@/lib/stores/useGame";
import { useHousing, FURNITURE_CATALOG, type PlacedFurniture, type FurnitureType } from "@/lib/stores/useHousing";
import HousingUI from "./HousingUI";
import { VFXSystem } from "../vfx";

const ROOM_WIDTH = 12;
const ROOM_DEPTH = 10;
const WALL_HEIGHT = 4;
const WALL_THICKNESS = 0.4;

const controls = [
  { name: "forward", keys: ["KeyW", "ArrowUp"] },
  { name: "backward", keys: ["KeyS", "ArrowDown"] },
  { name: "left", keys: ["KeyA", "ArrowLeft"] },
  { name: "right", keys: ["KeyD", "ArrowRight"] },
  { name: "sprint", keys: ["ShiftLeft", "ShiftRight"] },
  { name: "jump", keys: ["Space"] },
  { name: "use", keys: ["KeyF"] },
  { name: "craft", keys: ["KeyC"] },
  { name: "crouch", keys: ["ControlLeft", "ControlRight", "KeyZ"] },
  { name: "roll", keys: ["ControlLeft", "ControlRight"] },
  { name: "modeSwitch", keys: ["KeyQ"] },
  { name: "interact", keys: ["KeyT"] },
  { name: "classAbility", keys: ["KeyR"] },
  { name: "classAbility2", keys: ["KeyE"] },
];

function HousingInteractionHandler() {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "KeyT") {
        (window as any).__housingExit = true;
        setTimeout(() => {
          (window as any).__housingExit = false;
        }, 200);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
  return null;
}

function Floor() {
  const woodTexture = useTexture("/textures/wood.jpg");
  woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
  woodTexture.repeat.set(4, 3);

  return (
    <RigidBody type="fixed" position={[0, -0.25, 0]} colliders={false}>
      <CuboidCollider args={[ROOM_WIDTH / 2, 0.25, ROOM_DEPTH / 2]} />
      <mesh receiveShadow>
        <boxGeometry args={[ROOM_WIDTH, 0.5, ROOM_DEPTH]} />
        <meshStandardMaterial map={woodTexture} color="#8B7355" roughness={0.8} metalness={0.05} />
      </mesh>
    </RigidBody>
  );
}

function Ceiling() {
  return (
    <mesh receiveShadow position={[0, WALL_HEIGHT, 0]}>
      <boxGeometry args={[ROOM_WIDTH + WALL_THICKNESS * 2, 0.3, ROOM_DEPTH + WALL_THICKNESS * 2]} />
      <meshStandardMaterial color="#5C4033" roughness={0.9} metalness={0.05} />
    </mesh>
  );
}

function Wall({ position, args }: { position: [number, number, number]; args: [number, number, number] }) {
  return (
    <RigidBody type="fixed" position={position} colliders={false}>
      <CuboidCollider args={[args[0] / 2, args[1] / 2, args[2] / 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={args} />
        <meshStandardMaterial color="#A0825A" roughness={0.85} metalness={0.05} />
      </mesh>
    </RigidBody>
  );
}

function Walls() {
  const halfW = ROOM_WIDTH / 2;
  const halfD = ROOM_DEPTH / 2;
  const wallY: [number, number, number] = [0, WALL_HEIGHT / 2, 0];

  const doorWidth = 2.0;
  const doorHeight = 3.0;
  const backWallLeftWidth = (ROOM_WIDTH - doorWidth) / 2;

  return (
    <group>
      <Wall position={[-halfW - WALL_THICKNESS / 2, WALL_HEIGHT / 2, 0]} args={[WALL_THICKNESS, WALL_HEIGHT, ROOM_DEPTH]} />
      <Wall position={[halfW + WALL_THICKNESS / 2, WALL_HEIGHT / 2, 0]} args={[WALL_THICKNESS, WALL_HEIGHT, ROOM_DEPTH]} />
      <Wall position={[0, WALL_HEIGHT / 2, -halfD - WALL_THICKNESS / 2]} args={[ROOM_WIDTH, WALL_HEIGHT, WALL_THICKNESS]} />

      <Wall
        position={[-(backWallLeftWidth / 2 + doorWidth / 2), WALL_HEIGHT / 2, halfD + WALL_THICKNESS / 2]}
        args={[backWallLeftWidth, WALL_HEIGHT, WALL_THICKNESS]}
      />
      <Wall
        position={[(backWallLeftWidth / 2 + doorWidth / 2), WALL_HEIGHT / 2, halfD + WALL_THICKNESS / 2]}
        args={[backWallLeftWidth, WALL_HEIGHT, WALL_THICKNESS]}
      />
      <Wall
        position={[0, WALL_HEIGHT / 2 + (WALL_HEIGHT - doorHeight) / 2 + doorHeight / 2, halfD + WALL_THICKNESS / 2]}
        args={[doorWidth, WALL_HEIGHT - doorHeight, WALL_THICKNESS]}
      />
    </group>
  );
}

function ExitDoor({ playerPosition }: { playerPosition: THREE.Vector3 }) {
  const { exitHousing } = useGame();
  const exitCooldown = useRef(false);
  const halfD = ROOM_DEPTH / 2;
  const doorPos = useMemo(() => new THREE.Vector3(0, 0, halfD), [halfD]);

  useFrame(() => {
    const dist = playerPosition.distanceTo(doorPos);
    if (dist < 3 && !exitCooldown.current) {
      const exitKey = (window as any).__housingExit;
      if (exitKey) {
        exitCooldown.current = true;
        exitHousing();
      }
    }
  });

  return (
    <group position={[0, 0, halfD]}>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[1.8, 2.8, 0.1]} />
        <meshStandardMaterial color="#4A3520" roughness={0.9} metalness={0.1} />
      </mesh>
      <mesh position={[0.6, 1.5, 0.08]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#B8860B" roughness={0.3} metalness={0.7} />
      </mesh>
      <sprite position={[0, 3.5, 0]} scale={[3, 0.6, 1]}>
        <spriteMaterial map={createTextTex("[Press T to Exit]")} transparent />
      </sprite>
    </group>
  );
}

function FurnitureMesh({ item }: { item: PlacedFurniture }) {
  const def = FURNITURE_CATALOG.find((f) => f.type === item.type);
  if (!def) return null;

  const [w, h, d] = def.size;

  switch (item.type) {
    case "bed":
      return (
        <group position={item.position} rotation={[0, item.rotation, 0]}>
          <mesh castShadow position={[0, 0.15, 0]}>
            <boxGeometry args={[w, 0.3, d]} />
            <meshStandardMaterial color="#654321" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <boxGeometry args={[w - 0.1, 0.1, d - 0.1]} />
            <meshStandardMaterial color="#8B0000" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 0.5, -d / 2 + 0.1]}>
            <boxGeometry args={[w, 0.4, 0.1]} />
            <meshStandardMaterial color="#654321" roughness={0.9} />
          </mesh>
          {[[-w / 2 + 0.05, 0, -d / 2 + 0.05], [w / 2 - 0.05, 0, -d / 2 + 0.05], [-w / 2 + 0.05, 0, d / 2 - 0.05], [w / 2 - 0.05, 0, d / 2 - 0.05]].map((p, i) => (
            <mesh key={i} castShadow position={[p[0], p[1], p[2]]}>
              <boxGeometry args={[0.08, 0.3, 0.08]} />
              <meshStandardMaterial color="#4A3520" roughness={0.9} />
            </mesh>
          ))}
        </group>
      );

    case "table":
      return (
        <group position={item.position} rotation={[0, item.rotation, 0]}>
          <mesh castShadow position={[0, h - 0.05, 0]}>
            <boxGeometry args={[w, 0.1, d]} />
            <meshStandardMaterial color={def.color} roughness={0.85} />
          </mesh>
          {[[-w / 2 + 0.08, (h - 0.1) / 2, -d / 2 + 0.08], [w / 2 - 0.08, (h - 0.1) / 2, -d / 2 + 0.08], [-w / 2 + 0.08, (h - 0.1) / 2, d / 2 - 0.08], [w / 2 - 0.08, (h - 0.1) / 2, d / 2 - 0.08]].map((p, i) => (
            <mesh key={i} castShadow position={[p[0], p[1], p[2]]}>
              <boxGeometry args={[0.08, h - 0.1, 0.08]} />
              <meshStandardMaterial color="#5C3A1E" roughness={0.9} />
            </mesh>
          ))}
        </group>
      );

    case "chair":
      return (
        <group position={item.position} rotation={[0, item.rotation, 0]}>
          <mesh castShadow position={[0, 0.25, 0]}>
            <boxGeometry args={[w, 0.06, w]} />
            <meshStandardMaterial color={def.color} roughness={0.85} />
          </mesh>
          <mesh castShadow position={[0, 0.55, -w / 2 + 0.03]}>
            <boxGeometry args={[w, 0.6, 0.06]} />
            <meshStandardMaterial color={def.color} roughness={0.85} />
          </mesh>
          {[[-w / 2 + 0.04, 0.12, -w / 2 + 0.04], [w / 2 - 0.04, 0.12, -w / 2 + 0.04], [-w / 2 + 0.04, 0.12, w / 2 - 0.04], [w / 2 - 0.04, 0.12, w / 2 - 0.04]].map((p, i) => (
            <mesh key={i} castShadow position={[p[0], p[1], p[2]]}>
              <boxGeometry args={[0.06, 0.25, 0.06]} />
              <meshStandardMaterial color="#5C3A1E" roughness={0.9} />
            </mesh>
          ))}
        </group>
      );

    case "chest":
      return (
        <group position={item.position} rotation={[0, item.rotation, 0]}>
          <mesh castShadow position={[0, h / 2, 0]}>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={def.color} roughness={0.8} />
          </mesh>
          <mesh position={[0, h * 0.4, d / 2 + 0.01]}>
            <boxGeometry args={[w * 0.3, h * 0.15, 0.02]} />
            <meshStandardMaterial color="#B8860B" roughness={0.3} metalness={0.6} />
          </mesh>
          <mesh position={[0, h, 0]}>
            <boxGeometry args={[w + 0.02, 0.04, d + 0.02]} />
            <meshStandardMaterial color="#8B6914" roughness={0.7} metalness={0.2} />
          </mesh>
        </group>
      );

    case "shelf":
      return (
        <group position={item.position} rotation={[0, item.rotation, 0]}>
          <mesh castShadow position={[0, h / 2, 0]}>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={def.color} roughness={0.85} />
          </mesh>
          {[0.3, 0.7, 1.1].map((y, i) => (
            <mesh key={i} position={[0, y, 0.02]}>
              <boxGeometry args={[w - 0.1, 0.05, d - 0.05]} />
              <meshStandardMaterial color="#5C3A1E" roughness={0.9} />
            </mesh>
          ))}
        </group>
      );

    case "torch":
      return (
        <group position={item.position} rotation={[0, item.rotation, 0]}>
          <mesh castShadow position={[0, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.05, 0.4, 6]} />
            <meshStandardMaterial color="#4A3520" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#FF6600" emissive="#FF4400" emissiveIntensity={2} />
          </mesh>
          <pointLight position={[0, 0.3, 0]} color="#FF6600" intensity={3} distance={8} />
        </group>
      );

    case "banner":
      return (
        <group position={item.position} rotation={[0, item.rotation, 0]}>
          <mesh position={[0, h / 2, 0]}>
            <cylinderGeometry args={[0.025, 0.025, h, 6]} />
            <meshStandardMaterial color="#4A3520" roughness={0.8} />
          </mesh>
          <mesh position={[0, h * 0.55, 0.05]}>
            <planeGeometry args={[0.7, 1.0]} />
            <meshStandardMaterial color={def.color} roughness={0.95} side={THREE.DoubleSide} />
          </mesh>
        </group>
      );

    case "rug":
      return (
        <group position={item.position} rotation={[0, item.rotation, 0]}>
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial color={def.color} roughness={0.98} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.021, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w * 0.7, d * 0.7]} />
            <meshStandardMaterial color="#DAA520" roughness={0.95} side={THREE.DoubleSide} />
          </mesh>
        </group>
      );

    case "forge":
      return (
        <group position={item.position} rotation={[0, item.rotation, 0]}>
          <mesh castShadow position={[0, h / 2, 0]}>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={def.color} roughness={0.7} metalness={0.3} />
          </mesh>
          <mesh position={[0, h + 0.05, 0]}>
            <boxGeometry args={[w * 0.6, 0.1, d * 0.6]} />
            <meshStandardMaterial color="#333" roughness={0.5} metalness={0.5} />
          </mesh>
          <mesh position={[0, h + 0.15, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color="#FF4400" emissive="#FF2200" emissiveIntensity={1.5} />
          </mesh>
          <pointLight position={[0, h + 0.3, 0]} color="#FF4400" intensity={2} distance={5} />
        </group>
      );

    case "barrel":
      return (
        <group position={item.position} rotation={[0, item.rotation, 0]}>
          <mesh castShadow position={[0, h / 2, 0]}>
            <cylinderGeometry args={[w / 2 - 0.02, w / 2, h, 12]} />
            <meshStandardMaterial color={def.color} roughness={0.9} />
          </mesh>
          <mesh position={[0, h * 0.3, 0]}>
            <torusGeometry args={[w / 2, 0.015, 4, 12]} />
            <meshStandardMaterial color="#555" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, h * 0.7, 0]}>
            <torusGeometry args={[w / 2, 0.015, 4, 12]} />
            <meshStandardMaterial color="#555" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      );

    case "bookshelf":
      return (
        <group position={item.position} rotation={[0, item.rotation, 0]}>
          <mesh castShadow position={[0, h / 2, 0]}>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={def.color} roughness={0.9} />
          </mesh>
          {[0.3, 0.7, 1.1, 1.5].map((y, i) => (
            <mesh key={i} position={[0, y, 0.03]}>
              <boxGeometry args={[w - 0.1, 0.12, d - 0.08]} />
              <meshStandardMaterial color={["#8B2500", "#2E4E2E", "#3A3060", "#6B4226"][i % 4]} roughness={0.85} />
            </mesh>
          ))}
        </group>
      );

    case "cauldron":
      return (
        <group position={item.position} rotation={[0, item.rotation, 0]}>
          <mesh castShadow position={[0, h / 2, 0]}>
            <sphereGeometry args={[w / 2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#2A2A2A" roughness={0.5} metalness={0.7} />
          </mesh>
          <mesh position={[0, h * 0.55, 0]}>
            <cylinderGeometry args={[w / 2 - 0.05, w / 2 - 0.05, 0.04, 16]} />
            <meshStandardMaterial color="#33CC55" emissive="#22AA44" emissiveIntensity={0.8} transparent opacity={0.7} />
          </mesh>
          <pointLight position={[0, h * 0.7, 0]} color="#33CC55" intensity={1.5} distance={4} />
        </group>
      );

    default:
      return (
        <mesh castShadow position={[item.position[0], item.position[1] + h / 2, item.position[2]]} rotation={[0, item.rotation, 0]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={def.color} roughness={0.8} />
        </mesh>
      );
  }
}

function PlacedFurnitureRenderer() {
  const furniture = useHousing((s) => s.furniture);
  return (
    <group>
      {furniture.map((item) => (
        <FurnitureMesh key={item.id} item={item} />
      ))}
    </group>
  );
}

function HousingLighting() {
  return (
    <group>
      <ambientLight intensity={0.25} color="#FFE4B5" />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.3}
        color="#FFDEAD"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[0, 3.5, 0]} color="#FF9933" intensity={2} distance={15} />
      <pointLight position={[-4, 2.5, -3]} color="#FF6600" intensity={1} distance={8} />
      <pointLight position={[4, 2.5, 3]} color="#FF6600" intensity={1} distance={8} />
    </group>
  );
}

function Fireplace() {
  return (
    <group position={[0, 0, -ROOM_DEPTH / 2 + 0.3]}>
      <mesh castShadow position={[0, 0.6, 0]}>
        <boxGeometry args={[2.0, 1.2, 0.5]} />
        <meshStandardMaterial color="#555555" roughness={0.8} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[2.2, 0.15, 0.55]} />
        <meshStandardMaterial color="#666666" roughness={0.7} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.4, 0.15]}>
        <boxGeometry args={[1.4, 0.8, 0.3]} />
        <meshStandardMaterial color="#1A1A1A" roughness={1} />
      </mesh>
      <mesh position={[0, 0.3, 0.2]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#FF4400" emissive="#FF2200" emissiveIntensity={3} />
      </mesh>
      <mesh position={[-0.15, 0.25, 0.18]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial color="#FF6600" emissive="#FF4400" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.12, 0.22, 0.19]}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshStandardMaterial color="#FFAA00" emissive="#FF6600" emissiveIntensity={2} />
      </mesh>
      <pointLight position={[0, 0.5, 0.3]} color="#FF6600" intensity={5} distance={10} />
      <pointLight position={[0, 0.8, 0.4]} color="#FF4400" intensity={2} distance={6} />
    </group>
  );
}

function WallTorch({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.4, 6]} />
        <meshStandardMaterial color="#5C3A1E" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.15, 0.05]}>
        <boxGeometry args={[0.12, 0.08, 0.08]} />
        <meshStandardMaterial color="#333" roughness={0.8} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#FF6600" emissive="#FF4400" emissiveIntensity={3} />
      </mesh>
      <pointLight position={[0, 0.3, 0.1]} color="#FF6600" intensity={1.5} distance={5} />
    </group>
  );
}

function WallBanner({ position, rotation, color }: { position: [number, number, number]; rotation?: number; color: string }) {
  return (
    <group position={position} rotation={[0, rotation || 0, 0]}>
      <mesh castShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.8, 6]} />
        <meshStandardMaterial color="#8B7355" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, -0.5, 0.02]}>
        <planeGeometry args={[0.6, 1.0]} />
        <meshStandardMaterial color={color} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.5, 0.02]}>
        <planeGeometry args={[0.3, 0.3]} />
        <meshStandardMaterial color="#ffd700" roughness={0.3} metalness={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function StoneColumn({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[0.5, 0.2, 0.5]} />
        <meshStandardMaterial color="#777" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, WALL_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.15, 0.18, WALL_HEIGHT - 0.4, 8]} />
        <meshStandardMaterial color="#888" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, WALL_HEIGHT - 0.1, 0]}>
        <boxGeometry args={[0.4, 0.2, 0.4]} />
        <meshStandardMaterial color="#777" roughness={0.9} />
      </mesh>
    </group>
  );
}

function CastleDecorations() {
  const halfW = ROOM_WIDTH / 2;
  const halfD = ROOM_DEPTH / 2;
  return (
    <group>
      <WallTorch position={[-halfW + 0.15, 2.5, -halfD + 2]} />
      <WallTorch position={[-halfW + 0.15, 2.5, halfD - 2]} />
      <WallTorch position={[halfW - 0.15, 2.5, -halfD + 2]} />
      <WallTorch position={[halfW - 0.15, 2.5, halfD - 2]} />
      <WallBanner position={[-halfW + 0.25, 3.0, 0]} color="#8B0000" />
      <WallBanner position={[halfW - 0.25, 3.0, 0]} rotation={Math.PI} color="#00008B" />
      <WallBanner position={[0, 3.0, -halfD + 0.25]} rotation={Math.PI / 2} color="#4B0082" />
      <StoneColumn position={[-halfW + 0.3, 0, -halfD + 0.3]} />
      <StoneColumn position={[halfW - 0.3, 0, -halfD + 0.3]} />
      <StoneColumn position={[-halfW + 0.3, 0, halfD - 0.3]} />
      <StoneColumn position={[halfW - 0.3, 0, halfD - 0.3]} />
      <mesh receiveShadow position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2, 32]} />
        <meshStandardMaterial color="#8B4513" roughness={0.7} metalness={0.1} opacity={0.4} transparent />
      </mesh>
    </group>
  );
}

function HousingContent() {
  const playerPosRef = useRef(new THREE.Vector3(0, 1, 3));

  const handlePlayerPositionUpdate = (pos: THREE.Vector3) => {
    playerPosRef.current.copy(pos);
    useGame.getState().updatePlayerPosition(pos);
  };

  return (
    <>
      <HousingLighting />
      <Floor />
      <Walls />
      <Ceiling />
      <Fireplace />
      <CastleDecorations />
      <ExitDoor playerPosition={playerPosRef.current} />
      <PlacedFurnitureRenderer />
      <Player
        onPositionUpdate={handlePlayerPositionUpdate}
        spawnPosition={[0, 1, 3]}
      />
      <Camera playerPosition={playerPosRef.current} />
      <fog attach="fog" args={["#1A0E00", 8, 20]} />
    </>
  );
}

function HousingLabel() {
  return (
    <div style={{
      position: "absolute",
      top: 180,
      left: 15,
      background: "rgba(60,30,0,0.8)",
      padding: "8px 14px",
      borderRadius: 6,
      border: "1px solid #AA6633",
      color: "#FFDEAD",
      fontSize: 14,
      fontWeight: "bold",
    }}>
      Your House
      <div style={{ fontSize: 11, color: "#CC9966", marginTop: 2 }}>
        Press T near door to exit
      </div>
    </div>
  );
}

export default function HousingScene() {
  return (
    <KeyboardControls map={controls}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{
          position: [0, 12, 12],
          fov: 50,
          near: 0.1,
          far: 100,
        }}
        gl={{
          antialias: false,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        onCreated={({ gl }) => {
          const c = gl.domElement;
          c.addEventListener("webglcontextlost", (e) => { e.preventDefault(); });
          c.addEventListener("webglcontextrestored", () => {});
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <AssetLoaderInit />
        <Suspense fallback={null}>
          <Physics
            gravity={[0, -20, 0]}
            timeStep={1 / 60}
            interpolate={false}
          >
            <VFXSystem />
            <HousingContent />
          </Physics>
        </Suspense>
      </Canvas>
      <HUD />
      <HousingUI />
      <HousingLabel />
      <HousingInteractionHandler />
    </KeyboardControls>
  );
}

function createTextTex(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 20, 512, 88);
  ctx.font = "bold 38px Arial";
  ctx.fillStyle = "#FFDEAD";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
