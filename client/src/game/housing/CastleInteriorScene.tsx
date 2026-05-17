/**
 * CastleInteriorScene — grand 20×16 throne hall for the player_castle building.
 *
 * All 5 WCS crafting stations are pre-placed along the walls:
 *  Forge (back-left), Workbench (back-right), Alchemy Table (mid-left),
 *  Loom (mid-right), Tannery (back-centre-left), Enchanting Altar (throne alcove)
 *
 * Features:
 *  - 4 storage chests around the room
 *  - Grand throne at the back
 *  - Castle column decorations
 *  - All 6 crafting stations interactive (E-key → CraftingStationUI)
 *  - Wall banners and torches
 *  - Exit by pressing T near the entrance
 */

import { Suspense, useRef, useEffect, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import Player from "../components/Player";
import Camera from "../components/Camera";
import HUD from "../components/HUD";
import { AssetLoaderInit } from "../systems/AssetLoaderInit";
import { useGame } from "@/lib/stores/useGame";
import { VFXSystem } from "../vfx";
import CraftingStationUI from "./CraftingStationUI";

const ROOM_W  = 20;
const ROOM_D  = 16;
const WALL_H  = 6;
const WALL_T  = 0.4;

// Reuse the same controls map
const CONTROLS = [
  { name: "forward",      keys: ["KeyW", "ArrowUp"] },
  { name: "backward",     keys: ["KeyS", "ArrowDown"] },
  { name: "left",         keys: ["KeyA", "ArrowLeft"] },
  { name: "right",        keys: ["KeyD", "ArrowRight"] },
  { name: "sprint",       keys: ["ShiftLeft", "ShiftRight"] },
  { name: "jump",         keys: ["Space"] },
  { name: "use",          keys: ["KeyF"] },
  { name: "craft",        keys: ["KeyC"] },
  { name: "crouch",       keys: ["ControlLeft", "ControlRight", "KeyZ"] },
  { name: "roll",         keys: ["ControlLeft", "ControlRight"] },
  { name: "modeSwitch",   keys: ["KeyQ"] },
  { name: "interact",     keys: ["KeyT"] },
  { name: "classAbility", keys: ["KeyR"] },
  { name: "classAbility2",keys: ["KeyE"] },
];

// ─────────────────────────────────────────────────────────────────────────────

function CastleFloor() {
  return (
    <RigidBody type="fixed" position={[0, -0.25, 0]} colliders={false}>
      <CuboidCollider args={[ROOM_W / 2, 0.25, ROOM_D / 2]} />
      <mesh receiveShadow>
        <boxGeometry args={[ROOM_W, 0.5, ROOM_D]} />
        <meshStandardMaterial color="#888" roughness={0.8} metalness={0.05} />
      </mesh>
      {/* Central carpet */}
      <mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 10]} />
        <meshStandardMaterial color="#8B0000" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
    </RigidBody>
  );
}

function CastleCeiling() {
  return (
    <mesh position={[0, WALL_H, 0]} receiveShadow>
      <boxGeometry args={[ROOM_W + WALL_T * 2, 0.4, ROOM_D + WALL_T * 2]} />
      <meshStandardMaterial color="#4a4050" roughness={0.9} />
    </mesh>
  );
}

function CastleWall({ pos, args, color }: { pos: [number,number,number]; args: [number,number,number]; color?: string }) {
  return (
    <RigidBody type="fixed" position={pos} colliders={false}>
      <CuboidCollider args={[args[0]/2, args[1]/2, args[2]/2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={args} />
        <meshStandardMaterial color={color ?? "#777"} roughness={0.85} />
      </mesh>
    </RigidBody>
  );
}

function CastleWalls() {
  const hw = ROOM_W / 2;
  const hd = ROOM_D / 2;
  const doorW = 3.0, doorH = 4.0;
  const sideW = (ROOM_W - doorW) / 2;
  return (
    <group>
      <CastleWall pos={[-hw - WALL_T/2, WALL_H/2, 0]}  args={[WALL_T, WALL_H, ROOM_D]} />
      <CastleWall pos={[ hw + WALL_T/2, WALL_H/2, 0]}  args={[WALL_T, WALL_H, ROOM_D]} />
      <CastleWall pos={[0, WALL_H/2, -hd - WALL_T/2]}  args={[ROOM_W, WALL_H, WALL_T]} />
      <CastleWall pos={[-(sideW/2 + doorW/2), WALL_H/2,  hd + WALL_T/2]} args={[sideW, WALL_H, WALL_T]} />
      <CastleWall pos={[ sideW/2 + doorW/2,  WALL_H/2,  hd + WALL_T/2]} args={[sideW, WALL_H, WALL_T]} />
      <CastleWall pos={[0, WALL_H/2 + (WALL_H - doorH)/2 + doorH/2, hd + WALL_T/2]} args={[doorW, WALL_H - doorH, WALL_T]} />
    </group>
  );
}

function Column({ pos }: { pos: [number,number,number] }) {
  return (
    <group position={pos}>
      <mesh castShadow position={[0, 0.2, 0]}>
        <boxGeometry args={[0.6, 0.4, 0.6]} />
        <meshStandardMaterial color="#666" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, WALL_H/2 + 0.2, 0]}>
        <cylinderGeometry args={[0.22, 0.28, WALL_H - 0.8, 10]} />
        <meshStandardMaterial color="#888" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, WALL_H - 0.2, 0]}>
        <boxGeometry args={[0.55, 0.35, 0.55]} />
        <meshStandardMaterial color="#666" roughness={0.9} />
      </mesh>
    </group>
  );
}

function WallTorch({ pos }: { pos: [number,number,number] }) {
  const lt = useRef<THREE.PointLight>(null);
  const t = useRef(Math.random() * 6);
  useFrame((_, d) => {
    t.current += d * 2.5;
    if (lt.current) lt.current.intensity = 1.8 + 1.2 * Math.sin(t.current);
  });
  return (
    <group position={pos}>
      <mesh castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.4, 6]} />
        <meshStandardMaterial color="#5C3A1E" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#FF6600" emissive="#FF4400" emissiveIntensity={3} />
      </mesh>
      <pointLight ref={lt} position={[0, 0.35, 0.1]} color="#FF7700" intensity={1.8} distance={7} />
    </group>
  );
}

function WallBanner({ pos, rot, color }: { pos:[number,number,number]; rot?:number; color:string }) {
  return (
    <group position={pos} rotation={[0, rot ?? 0, 0]}>
      <mesh>
        <cylinderGeometry args={[0.02, 0.02, 0.9, 6]} />
        <meshStandardMaterial color="#8B7355" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, -0.6, 0.06]}>
        <planeGeometry args={[0.7, 1.2]} />
        <meshStandardMaterial color={color} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.6, 0.07]}>
        <planeGeometry args={[0.35, 0.35]} />
        <meshStandardMaterial color="#ffd700" roughness={0.3} metalness={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Throne() {
  return (
    <group position={[0, 0, -ROOM_D / 2 + 1.8]}>
      {/* Seat */}
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[1.4, 1.0, 0.7]} />
        <meshStandardMaterial color="#8B0000" roughness={0.8} />
      </mesh>
      {/* Back */}
      <mesh castShadow position={[0, 1.6, -0.3]}>
        <boxGeometry args={[1.4, 1.4, 0.15]} />
        <meshStandardMaterial color="#8B0000" roughness={0.8} />
      </mesh>
      {/* Arms */}
      {[-0.65, 0.65].map((x, i) => (
        <mesh key={i} castShadow position={[x, 0.9, 0.1]}>
          <boxGeometry args={[0.12, 0.1, 0.6]} />
          <meshStandardMaterial color="#6B0000" roughness={0.8} />
        </mesh>
      ))}
      {/* Crown top */}
      <mesh castShadow position={[0, 2.5, -0.3]}>
        <boxGeometry args={[0.3, 0.5, 0.12]} />
        <meshStandardMaterial color="#ffd700" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0, 2.85, -0.3]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>
      <pointLight position={[0, 2, 0]} color="#ffd700" intensity={1.5} distance={6} />
    </group>
  );
}

function StorageChest({ pos }: { pos: [number,number,number] }) {
  return (
    <group position={pos}>
      <mesh castShadow position={[0, 0.3, 0]}>
        <boxGeometry args={[0.85, 0.6, 0.55]} />
        <meshStandardMaterial color="#CD853F" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.61, 0]}>
        <boxGeometry args={[0.87, 0.04, 0.57]} />
        <meshStandardMaterial color="#8B6914" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.3, 0.285]}>
        <boxGeometry args={[0.26, 0.12, 0.02]} />
        <meshStandardMaterial color="#B8860B" roughness={0.3} metalness={0.6} />
      </mesh>
      <pointLight position={[0, 0.8, 0]} color="#ffd700" intensity={0.6} distance={2} />
    </group>
  );
}

// Castle-scale crafting station that hooks into proximity + E-key
interface CastleStationProps {
  stationId: string;
  position: [number,number,number];
  glowColor: string;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}

function CastleStation({ stationId, position, glowColor, playerPosRef }: CastleStationProps) {
  const lightRef = useRef<THREE.PointLight>(null);
  const promptRef = useRef<THREE.Group>(null);
  const glowTime = useRef(Math.random() * Math.PI * 2);
  const RANGE = 3.5;

  const promptTex = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 256; cv.height = 64;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(4, 8, 248, 48);
    ctx.font = "bold 22px Arial";
    ctx.fillStyle = glowColor;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const labels: Record<string,string> = {
      forge: "[E] Forge", workbench: "[E] Workbench",
      alchemy_table: "[E] Alchemy", loom: "[E] Loom",
      tannery: "[E] Tannery", enchanting_altar: "[E] Enchant",
    };
    ctx.fillText(labels[stationId] ?? "[E] Craft", 128, 32);
    const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
  }, [stationId, glowColor]);

  useFrame((_, delta) => {
    glowTime.current += delta * 1.8;
    const pulse = 0.7 + 0.3 * Math.sin(glowTime.current);
    if (lightRef.current) lightRef.current.intensity = 1.4 * pulse;
    if (!promptRef.current) return;
    const sPos = new THREE.Vector3(...position);
    const inRange = playerPosRef.current.distanceTo(sPos) < RANGE;
    promptRef.current.visible = inRange;
    if (inRange) (window as any).__nearStation = stationId;
    else if ((window as any).__nearStation === stationId) (window as any).__nearStation = null;
  });

  // Simple mesh per station type
  const h = stationId === "loom" ? 1.3 : stationId === "enchanting_altar" ? 1.2 : 1.05;
  const color: Record<string,string> = {
    forge: "#555", workbench: "#7a5c3a", alchemy_table: "#2a3a1a",
    loom: "#654321", tannery: "#5c3a1e", enchanting_altar: "#222233",
  };

  return (
    <group position={position}>
      <mesh castShadow position={[0, h/2, 0]}>
        {stationId === "enchanting_altar"
          ? <cylinderGeometry args={[0.45, 0.55, h, 8]} />
          : <boxGeometry args={[1.2, h, 0.8]} />
        }
        <meshStandardMaterial color={color[stationId] ?? "#555"} roughness={0.7} metalness={stationId === "forge" ? 0.4 : 0.1} />
      </mesh>
      {/* Glow emissive */}
      <mesh position={[0, h + 0.18, 0]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={3} transparent opacity={0.75} />
      </mesh>
      {stationId === "enchanting_altar" && (
        <mesh position={[0, h + 0.05, 0]} rotation={[-Math.PI/2, 0, 0]}>
          <ringGeometry args={[0.3, 0.43, 16]} />
          <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={3} side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
      )}
      <pointLight ref={lightRef} color={glowColor} intensity={1.4} distance={5.5} position={[0, h + 0.5, 0]} />
      <group ref={promptRef} visible={false} position={[0, h + 0.9, 0]}>
        <sprite scale={[2.2, 0.55, 1]}>
          <spriteMaterial map={promptTex} transparent />
        </sprite>
      </group>
    </group>
  );
}

function ExitDoor({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const { exitHousing } = useGame();
  const cd = useRef(false);
  const hd = ROOM_D / 2;
  const doorPos = useMemo(() => new THREE.Vector3(0, 0, hd), [hd]);
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 20, 512, 88);
    ctx.font = "bold 38px Arial"; ctx.fillStyle = "#FFDEAD";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("[Press T to Exit]", 256, 64);
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
  }, []);
  useFrame(() => {
    if (playerPosRef.current.distanceTo(doorPos) < 3 && !cd.current) {
      if ((window as any).__housingExit) { cd.current = true; exitHousing(); }
    }
  });
  return (
    <group position={[0, 0, hd]}>
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[3.0, 4.0, 0.15]} />
        <meshStandardMaterial color="#4A3520" roughness={0.9} />
      </mesh>
      <sprite position={[0, 4.5, 0]} scale={[3.5, 0.7, 1]}>
        <spriteMaterial map={tex} transparent />
      </sprite>
    </group>
  );
}

function CastleLighting() {
  return (
    <group>
      <ambientLight intensity={0.2} color="#FFE0A0" />
      <directionalLight position={[5, 10, 5]} intensity={0.25} color="#FFDEAD" castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[0, 4.5, 0]} color="#FF9933" intensity={2.5} distance={20} />
    </group>
  );
}

const CASTLE_STATIONS: { id: string; pos: [number,number,number]; glow: string }[] = [
  { id: "forge",            pos: [-8, 0, -5.5], glow: "#ff8800" },
  { id: "workbench",        pos: [ 8, 0, -5.5], glow: "#d4a437" },
  { id: "alchemy_table",    pos: [-8, 0,  1.5], glow: "#3ddc7b" },
  { id: "loom",             pos: [ 8, 0,  1.5], glow: "#9966ee" },
  { id: "tannery",          pos: [-4, 0, -7],   glow: "#a07050" },
  { id: "enchanting_altar", pos: [ 0, 0, -7],   glow: "#42e8e0" },
];

function CastleContent() {
  const playerPosRef = useRef(new THREE.Vector3(0, 1, 5));
  const [openStation, setOpenStation] = useState<string | null>(null);

  const handlePositionUpdate = (pos: THREE.Vector3) => {
    playerPosRef.current.copy(pos);
    useGame.getState().updatePlayerPosition(pos);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "KeyE" && !e.repeat) {
        const near = (window as any).__nearStation as string | null;
        if (near) setOpenStation(near);
      }
      if (e.code === "Escape") setOpenStation(null);
      if (e.code === "KeyT") {
        (window as any).__housingExit = true;
        setTimeout(() => { (window as any).__housingExit = false; }, 200);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const hw = ROOM_W / 2;
  const hd = ROOM_D / 2;

  return (
    <>
      <CastleLighting />
      <CastleFloor />
      <CastleWalls />
      <CastleCeiling />

      {/* Columns at corners */}
      <Column pos={[-hw + 0.4, 0, -hd + 0.4]} />
      <Column pos={[ hw - 0.4, 0, -hd + 0.4]} />
      <Column pos={[-hw + 0.4, 0,  hd - 0.4]} />
      <Column pos={[ hw - 0.4, 0,  hd - 0.4]} />
      {/* Mid-columns */}
      <Column pos={[-hw + 0.4, 0, 0]} />
      <Column pos={[ hw - 0.4, 0, 0]} />

      {/* Wall torches */}
      <WallTorch pos={[-hw + 0.2, 3.2, -hd + 3]} />
      <WallTorch pos={[-hw + 0.2, 3.2,  hd - 3]} />
      <WallTorch pos={[ hw - 0.2, 3.2, -hd + 3]} />
      <WallTorch pos={[ hw - 0.2, 3.2,  hd - 3]} />
      <WallTorch pos={[-hw + 0.2, 3.2,  0]} />
      <WallTorch pos={[ hw - 0.2, 3.2,  0]} />

      {/* Banners */}
      <WallBanner pos={[-hw + 0.3, 4.0, -hd + 4]} color="#8B0000" />
      <WallBanner pos={[ hw - 0.3, 4.0, -hd + 4]} rot={Math.PI} color="#00008B" />
      <WallBanner pos={[0, 4.0, -hd + 0.3]} rot={Math.PI / 2} color="#4B0082" />

      {/* Throne */}
      <Throne />

      {/* 4 Storage chests */}
      <StorageChest pos={[-hw + 1.2, 0, -hd + 1.2]} />
      <StorageChest pos={[ hw - 1.2, 0, -hd + 1.2]} />
      <StorageChest pos={[-hw + 1.2, 0,  hd - 2.5]} />
      <StorageChest pos={[ hw - 1.2, 0,  hd - 2.5]} />

      {/* All 5+1 crafting stations */}
      {CASTLE_STATIONS.map(st => (
        <CastleStation
          key={st.id}
          stationId={st.id}
          position={st.pos}
          glowColor={st.glow}
          playerPosRef={playerPosRef}
        />
      ))}

      <ExitDoor playerPosRef={playerPosRef} />
      <Player onPositionUpdate={handlePositionUpdate} spawnPosition={[0, 1, 5]} />
      <Camera playerPosition={playerPosRef.current} />
      <fog attach="fog" args={["#110A00", 12, 30]} />

      {openStation && (
        <CraftingStationUI stationId={openStation} onClose={() => setOpenStation(null)} />
      )}
    </>
  );
}

export default function CastleInteriorScene() {
  return (
    <KeyboardControls map={CONTROLS}>
      <Canvas
        shadows dpr={[1, 1.5]}
        camera={{ position: [0, 14, 18], fov: 50, near: 0.1, far: 120 }}
        gl={{
          antialias: false, powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <AssetLoaderInit />
        <Suspense fallback={null}>
          <Physics gravity={[0, -20, 0]} timeStep={1 / 60} interpolate={false}>
            <VFXSystem />
            <CastleContent />
          </Physics>
        </Suspense>
      </Canvas>
      <HUD />
      <div style={{
        position: "absolute", top: 180, left: 15,
        background: "rgba(30,10,30,0.85)", padding: "8px 14px",
        borderRadius: 6, border: "1px solid #8B0000",
        color: "#FFDEAD", fontSize: 14, fontWeight: "bold",
      }}>
        🏰 Your Castle
        <div style={{ fontSize: 11, color: "#CC9966", marginTop: 2 }}>
          Press E near any station to craft · T to exit
        </div>
      </div>
    </KeyboardControls>
  );
}
