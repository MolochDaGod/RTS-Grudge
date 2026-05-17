/**
 * CampInteriorScene — compact 8×6 interior for the player_camp building.
 *
 * Entered via the BuildingEntrance proximity detector on the overworld
 * (same T-key pattern as HousingScene). Inside:
 *  - A campfire that provides warm light
 *  - One chest linked to global useStorage
 *  - A basic Workbench (Forester station) — the only crafting station in a camp
 *  - A sleeping roll
 *  - Full E-key → CraftingStationUI integration
 *
 * Exit by pressing T near the entrance.
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

const ROOM_W = 8;
const ROOM_D = 6;
const WALL_H = 3.2;
const WALL_T = 0.35;

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

function CampFloor() {
  return (
    <RigidBody type="fixed" position={[0, -0.2, 0]} colliders={false}>
      <CuboidCollider args={[ROOM_W / 2, 0.2, ROOM_D / 2]} />
      <mesh receiveShadow>
        <boxGeometry args={[ROOM_W, 0.4, ROOM_D]} />
        <meshStandardMaterial color="#5c3a1e" roughness={0.95} />
      </mesh>
    </RigidBody>
  );
}

function CampWalls() {
  const hw = ROOM_W / 2;
  const hd = ROOM_D / 2;
  const doorW = 1.8, doorH = 2.6;
  const sideW = (ROOM_W - doorW) / 2;
  return (
    <group>
      <RigidBody type="fixed" position={[-hw - WALL_T / 2, WALL_H / 2, 0]} colliders={false}>
        <CuboidCollider args={[WALL_T / 2, WALL_H / 2, ROOM_D / 2]} />
        <mesh castShadow><boxGeometry args={[WALL_T, WALL_H, ROOM_D]} /><meshStandardMaterial color="#7a5c3a" roughness={0.9} /></mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[hw + WALL_T / 2, WALL_H / 2, 0]} colliders={false}>
        <CuboidCollider args={[WALL_T / 2, WALL_H / 2, ROOM_D / 2]} />
        <mesh castShadow><boxGeometry args={[WALL_T, WALL_H, ROOM_D]} /><meshStandardMaterial color="#7a5c3a" roughness={0.9} /></mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[0, WALL_H / 2, -hd - WALL_T / 2]} colliders={false}>
        <CuboidCollider args={[ROOM_W / 2, WALL_H / 2, WALL_T / 2]} />
        <mesh castShadow><boxGeometry args={[ROOM_W, WALL_H, WALL_T]} /><meshStandardMaterial color="#7a5c3a" roughness={0.9} /></mesh>
      </RigidBody>
      {/* Front wall with door gap */}
      <RigidBody type="fixed" position={[-(sideW / 2 + doorW / 2), WALL_H / 2, hd + WALL_T / 2]} colliders={false}>
        <CuboidCollider args={[sideW / 2, WALL_H / 2, WALL_T / 2]} />
        <mesh castShadow><boxGeometry args={[sideW, WALL_H, WALL_T]} /><meshStandardMaterial color="#7a5c3a" roughness={0.9} /></mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[sideW / 2 + doorW / 2, WALL_H / 2, hd + WALL_T / 2]} colliders={false}>
        <CuboidCollider args={[sideW / 2, WALL_H / 2, WALL_T / 2]} />
        <mesh castShadow><boxGeometry args={[sideW, WALL_H, WALL_T]} /><meshStandardMaterial color="#7a5c3a" roughness={0.9} /></mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[0, WALL_H / 2 + (WALL_H - doorH) / 2 + doorH / 2, hd + WALL_T / 2]} colliders={false}>
        <CuboidCollider args={[doorW / 2, (WALL_H - doorH) / 2, WALL_T / 2]} />
        <mesh castShadow><boxGeometry args={[doorW, WALL_H - doorH, WALL_T]} /><meshStandardMaterial color="#7a5c3a" roughness={0.9} /></mesh>
      </RigidBody>
    </group>
  );
}

function CampCeiling() {
  return (
    <mesh position={[0, WALL_H, 0]} receiveShadow>
      <boxGeometry args={[ROOM_W + WALL_T * 2, 0.25, ROOM_D + WALL_T * 2]} />
      <meshStandardMaterial color="#4a2e14" roughness={0.95} />
    </mesh>
  );
}

function Campfire() {
  const flickerRef = useRef<THREE.PointLight>(null);
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta * 3;
    if (flickerRef.current) {
      flickerRef.current.intensity = 4 + 2.5 * Math.sin(t.current) * Math.cos(t.current * 0.7);
    }
  });
  return (
    <group position={[0, 0, -0.5]}>
      {/* Stone ring */}
      {[0, 1, 2, 3, 4, 5].map(i => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.5, 0.1, Math.sin(angle) * 0.5]} castShadow>
            <sphereGeometry args={[0.12, 6, 6]} />
            <meshStandardMaterial color="#777" roughness={0.9} />
          </mesh>
        );
      })}
      {/* Logs */}
      <mesh position={[0, 0.08, 0]} rotation={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.8, 6]} />
        <meshStandardMaterial color="#5C3317" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.08, 0]} rotation={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.8, 6]} />
        <meshStandardMaterial color="#5C3317" roughness={0.9} />
      </mesh>
      {/* Flame */}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#FF5500" emissive="#FF3300" emissiveIntensity={3} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <coneGeometry args={[0.14, 0.4, 8]} />
        <meshStandardMaterial color="#FFAA00" emissive="#FF6600" emissiveIntensity={2.5} transparent opacity={0.7} />
      </mesh>
      <pointLight ref={flickerRef} position={[0, 0.6, 0]} color="#FF7700" intensity={4} distance={8} castShadow />
    </group>
  );
}

function CampWorkbench({
  playerPosRef,
  onOpen,
}: {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onOpen: () => void;
}) {
  const promptRef = useRef<THREE.Group>(null);
  const lightRef  = useRef<THREE.PointLight>(null);
  const RANGE = 3;
  const pos = useMemo(() => new THREE.Vector3(-3, 0, -1.5), []);
  const glowTime = useRef(0);
  const promptTex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(4, 8, 248, 48);
    ctx.font = "bold 22px Arial"; ctx.fillStyle = "#d4a437";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("[E] Workbench", 128, 32);
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
  }, []);

  useFrame((_, delta) => {
    glowTime.current += delta * 2;
    if (lightRef.current) lightRef.current.intensity = 1.2 + 0.8 * Math.sin(glowTime.current);
    if (!promptRef.current) return;
    const inRange = playerPosRef.current.distanceTo(pos) < RANGE;
    promptRef.current.visible = inRange;
    (window as any).__nearStation = inRange ? "workbench" : ((window as any).__nearStation === "workbench" ? null : (window as any).__nearStation);
  });

  return (
    <group position={pos.toArray()}>
      {/* Table body */}
      <mesh castShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[1.3, 0.9, 0.65]} />
        <meshStandardMaterial color="#7a5c3a" roughness={0.9} />
      </mesh>
      {/* Tabletop */}
      <mesh position={[0, 0.94, 0]}>
        <boxGeometry args={[1.3, 0.08, 0.65]} />
        <meshStandardMaterial color="#a07848" roughness={0.85} />
      </mesh>
      {/* Glow tool stub */}
      <mesh position={[0, 1.06, 0.1]}>
        <boxGeometry args={[0.06, 0.2, 0.06]} />
        <meshStandardMaterial color="#d4a437" emissive="#d4a437" emissiveIntensity={2} />
      </mesh>
      <pointLight ref={lightRef} color="#d4a437" intensity={1.2} distance={4} position={[0, 1.3, 0]} />
      <group ref={promptRef} visible={false} position={[0, 1.8, 0]}>
        <sprite scale={[2.4, 0.55, 1]}>
          <spriteMaterial map={promptTex} transparent />
        </sprite>
      </group>
    </group>
  );
}

function CampChest() {
  return (
    <group position={[3, 0, -1.5]}>
      <mesh castShadow position={[0, 0.3, 0]}>
        <boxGeometry args={[0.8, 0.6, 0.5]} />
        <meshStandardMaterial color="#CD853F" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.82, 0.04, 0.52]} />
        <meshStandardMaterial color="#8B6914" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.3, 0.26]}>
        <boxGeometry args={[0.24, 0.1, 0.02]} />
        <meshStandardMaterial color="#B8860B" roughness={0.3} metalness={0.6} />
      </mesh>
    </group>
  );
}

function SleepingRoll() {
  return (
    <group position={[2.8, 0, 1.2]} rotation={[0, Math.PI / 6, 0]}>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 2.0]} />
        <meshStandardMaterial color="#4a6741" roughness={0.98} side={THREE.DoubleSide} />
      </mesh>
      {/* Pillow */}
      <mesh position={[0, 0.1, -0.7]} castShadow>
        <boxGeometry args={[0.6, 0.14, 0.3]} />
        <meshStandardMaterial color="#8B4513" roughness={0.95} />
      </mesh>
    </group>
  );
}

function ExitMarker({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
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
    if (playerPosRef.current.distanceTo(doorPos) < 2.5 && !cd.current) {
      if ((window as any).__housingExit) {
        cd.current = true;
        exitHousing();
      }
    }
  });

  return (
    <group position={[0, 0, hd]}>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[1.8, 2.6, 0.1]} />
        <meshStandardMaterial color="#4A3520" roughness={0.9} />
      </mesh>
      <sprite position={[0, 3, 0]} scale={[3.2, 0.65, 1]}>
        <spriteMaterial map={tex} transparent />
      </sprite>
    </group>
  );
}

function CampLighting() {
  return (
    <group>
      <ambientLight intensity={0.15} color="#FF9966" />
      <pointLight position={[2.5, 2.5, -2.5]} color="#FF8844" intensity={0.8} distance={10} />
    </group>
  );
}

function CampContent() {
  const playerPosRef = useRef(new THREE.Vector3(0, 1, 2));
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

  return (
    <>
      <CampLighting />
      <CampFloor />
      <CampWalls />
      <CampCeiling />
      <Campfire />
      <CampWorkbench playerPosRef={playerPosRef} onOpen={() => setOpenStation("workbench")} />
      <CampChest />
      <SleepingRoll />
      <ExitMarker playerPosRef={playerPosRef} />
      <Player onPositionUpdate={handlePositionUpdate} spawnPosition={[0, 1, 2]} />
      <Camera playerPosition={playerPosRef.current} />
      <fog attach="fog" args={["#1A0A00", 6, 16]} />
      {openStation && <CraftingStationUI stationId={openStation} onClose={() => setOpenStation(null)} />}
    </>
  );
}

export default function CampInteriorScene() {
  return (
    <KeyboardControls map={CONTROLS}>
      <Canvas
        shadows dpr={[1, 1.5]}
        camera={{ position: [0, 8, 8], fov: 55, near: 0.1, far: 60 }}
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
            <CampContent />
          </Physics>
        </Suspense>
      </Canvas>
      <HUD />
      <div style={{
        position: "absolute", top: 180, left: 15,
        background: "rgba(40,20,0,0.8)", padding: "8px 14px",
        borderRadius: 6, border: "1px solid #AA6633",
        color: "#FFDEAD", fontSize: 14, fontWeight: "bold",
      }}>
        🏕 Your Camp
        <div style={{ fontSize: 11, color: "#CC9966", marginTop: 2 }}>
          Press E near Workbench to craft · T to exit
        </div>
      </div>
    </KeyboardControls>
  );
}
