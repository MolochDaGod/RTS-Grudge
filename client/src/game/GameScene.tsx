import { Suspense, useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import * as THREE from "three";
import Player from "./components/Player";
import Enemy from "./components/Enemy";
import Terrain from "./components/Terrain";
import TerrainCollider from "./components/TerrainCollider";
import TerrainEditor, { ShovelHudOverlay } from "./components/TerrainEditor";
import { LocationDiscovery } from "./components/WorldMap";
import BuildingColliders from "./components/BuildingColliders";
import { RegisteredDebugColliderOverlay } from "./cheats/StreamedColliderDebugOverlay";
import World from "./components/World";
import ResourceNodes from "./components/ResourceNode";
import Lighting from "./components/Lighting";
import { VFXSystem } from "./vfx";
import Camera from "./components/Camera";
import Sky from "./components/Sky";
import WeatherEvents from "./components/WeatherEvents";
import { AssetLoaderInit } from "./systems/AssetLoaderInit";
import WaveSpawner from "./components/WaveSpawner";
import NPCs from "./components/NPCs";
import BiomeWildlife from "./components/BiomeWildlife";
import HUD from "./components/HUD";
import DungeonEntrances from "./dungeon/DungeonEntrances";
import HousingEntrance from "./housing/HousingEntrance";
import PlacedBuildings from "./building/PlacedBuildings";
import BuildMenu from "./building/BuildMenu";
import BuildModeHandler from "./building/BuildModeHandler";
import SurvivalBuildings from "./components/SurvivalBuildings";
import ModularBuildings from "./building/ModularBuildings";
import ModularBuildMenu from "./building/ModularBuildMenu";
import AllyNPCs from "./npc/AllyNPC";
import NatureScatter from "./terrain/NatureScatter";
import LootDropsRenderer from "./components/LootDrops";
import BossSpawner from "./components/BossSpawner";
import { useEnemyManager } from "./systems/EnemyManager";
import { useGame as useGameStore } from "@/lib/stores/useGame";
import { useGameConfig } from "@/lib/stores/useGameConfig";
import { useIslandWorld } from "@/lib/stores/useIslandWorld";
import { useCampaign } from "@/lib/stores/useCampaign";
import { OceanPlane, DockArea } from "./world/BoatSystem";
import { BeachedBoatsSystem, BeachedBoatPromptHUD } from "./world/BeachedBoats";
import { SailingScene, SailingHUD, DockPrompt, IslandSelector } from "./world/SailingMode";
import CampaignHUD from "./components/CampaignHUD";
import { updateActiveController, registerModeGetter } from "./controllers/ModeController";
import { initializeControllers, resetGameFlow } from "./controllers/GameFlowController";
import TrainingIslandScene, { IslandSelectorUI } from "./islands/TrainingIslandScene";
import { useTrainingIslands } from "./islands/useTrainingIslands";
import { SceneInspectorBridge } from "./debug/SceneInspectorBridge";
import { SelectionHighlight } from "./debug/SelectionHighlight";
import { SceneInspectorPanel } from "./debug/SceneInspectorPanel";
import SinkingIslandTicker from "./world/SinkingIslandTicker";
import SinkingIslandDebugHUD from "./cheats/SinkingIslandDebugHUD";
import FactionHeroes from "./npc/FactionHeroes";
import HeroInteractionPanel from "./ui/HeroInteractionPanel";

const controls = [
  { name: "forward", keys: ["KeyW", "ArrowUp"] },
  { name: "backward", keys: ["KeyS", "ArrowDown"] },
  { name: "left", keys: ["KeyA", "ArrowLeft"] },
  { name: "right", keys: ["KeyD", "ArrowRight"] },
  { name: "sprint", keys: ["ShiftLeft", "ShiftRight"] },
  { name: "jump", keys: ["Space"] },
  // Swim controls. While the player is below the water surface, `jump` is
  // re-purposed as ascend and `sink` as descend; otherwise `sink` is unused.
  { name: "sink", keys: ["AltLeft", "AltRight"] },
  // Numpad emotes — 15 gesture clips from the basic-gestures pack. Bindings
  // are intentionally numpad-only so they don't clash with the top-row
  // hotbar (Digit1-Digit9) used by the inventory quick-slots.
  { name: "gesture1", keys: ["Numpad1"] },
  { name: "gesture2", keys: ["Numpad2"] },
  { name: "gesture3", keys: ["Numpad3"] },
  { name: "gesture4", keys: ["Numpad4"] },
  { name: "gesture5", keys: ["Numpad5"] },
  { name: "gesture6", keys: ["Numpad6"] },
  { name: "gesture7", keys: ["Numpad7"] },
  { name: "gesture8", keys: ["Numpad8"] },
  { name: "gesture9", keys: ["Numpad9"] },
  { name: "gesture10", keys: ["Numpad0"] },
  { name: "gesture11", keys: ["NumpadDecimal"] },
  { name: "gesture12", keys: ["NumpadAdd"] },
  { name: "gesture13", keys: ["NumpadSubtract"] },
  { name: "gesture14", keys: ["NumpadMultiply"] },
  { name: "gesture15", keys: ["NumpadDivide"] },
  { name: "use", keys: ["KeyF"] },
  { name: "modeSwitch", keys: ["KeyQ"] },
  { name: "roll", keys: ["ControlLeft", "ControlRight"] },
  { name: "crouch", keys: ["KeyZ"] },
  { name: "interact", keys: ["KeyT"] },
  { name: "classAbility", keys: ["KeyR"] },
  { name: "classAbility2", keys: ["KeyE"] },
  { name: "classAbility3", keys: ["KeyX"] },
];

function ModeControllerUpdater() {
  useEffect(() => {
    registerModeGetter(() => useGameStore.getState().interactionMode);
    initializeControllers();
    return () => {
      resetGameFlow();
    };
  }, []);

  useEffect(() => {
    let lastTime = performance.now();
    let raf: number;
    const tick = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      updateActiveController(Math.min(delta, 0.1));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return null;
}

function DungeonInteractionHandler() {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "KeyT") {
        (window as any).__dungeonInteract = true;
        setTimeout(() => {
          (window as any).__dungeonInteract = false;
        }, 200);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
  return null;
}

function DockDetector({ playerPosition, dockPositions, onNearDock }: {
  playerPosition: THREE.Vector3;
  dockPositions: { x: number; z: number; rotation: number }[];
  onNearDock: (near: boolean) => void;
}) {
  const wasNear = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      let near = false;
      for (const dock of dockPositions) {
        const boatX = dock.x + Math.cos(dock.rotation + Math.PI / 2) * 6;
        const boatZ = dock.z + Math.sin(dock.rotation + Math.PI / 2) * 6;
        const dist = Math.sqrt(
          (playerPosition.x - boatX) ** 2 + (playerPosition.z - boatZ) ** 2
        );
        if (dist < 6) { near = true; break; }
      }
      // Player-launched boats (BeachedBoatsSystem flips them to floating
      // once they cross the shoreline) should also light up the existing
      // E-to-board prompt so the launch flow loops back into sailing.
      if (!near) {
        const floated = (window as any).__floatedBeachedBoats as
          | Array<{ x: number; z: number }>
          | undefined;
        if (floated) {
          for (const b of floated) {
            const dist = Math.hypot(playerPosition.x - b.x, playerPosition.z - b.z);
            if (dist < 6) { near = true; break; }
          }
        }
      }
      if (near !== wasNear.current) {
        wasNear.current = near;
        onNearDock(near);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [playerPosition, dockPositions, onNearDock]);

  return null;
}

const DEFAULT_DOCKS = [
  { x: 85, z: 0, rotation: Math.PI },
  { x: -85, z: 0, rotation: 0 },
  { x: 0, z: 85, rotation: -Math.PI / 2 },
];

export default function GameScene() {
  const playerPosRef = useRef(new THREE.Vector3(0, 0.5, 0));
  const { enemies } = useEnemyManager();
  const state = useGameStore.getState();
  const returnPos = state.overworldReturnPos || state.housingReturnPos;
  const gravity = useGameConfig((s) => s.config.physics.gravity);

  const sailing = useIslandWorld((s) => s.sailing);
  const startSailing = useIslandWorld((s) => s.startSailing);
  const stopSailing = useIslandWorld((s) => s.stopSailing);
  const currentIslandId = useIslandWorld((s) => s.currentIslandId);
  const getCurrentIsland = useIslandWorld((s) => s.getCurrentIsland);
  const campaignActive = useCampaign((s) => s.active);
  const campaignIslands = useCampaign((s) => s.islands);
  const campaignIslandId = useCampaign((s) => s.currentIslandId);
  const isWilderness = campaignActive && (campaignIslands.get(campaignIslandId)?.wilderness ?? false);

  const currentIsland = useMemo(() => getCurrentIsland(), [currentIslandId]);
  const [nearDock, setNearDock] = useState(false);
  const [showIslandSelector, setShowIslandSelector] = useState(false);
  const [showTrainingSelector, setShowTrainingSelector] = useState(false);
  const trainingIslandActive = useTrainingIslands((s) => s.activeIslandId);
  const startTrainingIsland = useTrainingIslands((s) => s.startIsland);
  const leaveTrainingIsland = useTrainingIslands((s) => s.leaveIsland);
  const trainingIslandCleared = useTrainingIslands((s) => s.islandCleared);

  const handlePlayerPositionUpdate = (pos: THREE.Vector3) => {
    playerPosRef.current.copy(pos);
    useGameStore.getState().updatePlayerPosition(pos);
  };

  const handleBoardBoat = useCallback(() => {
    setShowIslandSelector(true);
  }, []);

  const handleSelectDestination = useCallback((gridX: number, gridZ: number) => {
    setShowIslandSelector(false);
    startSailing(gridX, gridZ);
  }, [startSailing]);

  const handleCancelSelector = useCallback(() => {
    setShowIslandSelector(false);
  }, []);

  const handleSailingArrive = useCallback(() => {
    stopSailing();
  }, [stopSailing]);

  const handleOpenTrainingSelector = useCallback(() => {
    setShowTrainingSelector(true);
  }, []);

  const handleSelectTrainingIsland = useCallback((islandId: string) => {
    setShowTrainingSelector(false);
    useEnemyManager.getState().reset();
    startTrainingIsland(islandId);
  }, [startTrainingIsland]);

  const handleLeaveTrainingIsland = useCallback(() => {
    useEnemyManager.getState().reset();
    leaveTrainingIsland();
  }, [leaveTrainingIsland]);

  if (trainingIslandActive) {
    return (
      <KeyboardControls map={controls}>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [0, 15, 15], fov: 50, near: 0.1, far: 500 }}
          gl={{
            antialias: false,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <AssetLoaderInit />
          <Suspense fallback={null}>
            <Physics gravity={[0, gravity, 0]} timeStep={1 / 60} interpolate={true}>
              <Sky />
              <WeatherEvents />
              <VFXSystem />
              <Player
                onPositionUpdate={handlePlayerPositionUpdate}
                spawnPosition={[0, 5, -5]}
              />
              <Camera playerPosition={playerPosRef.current} />
              <TrainingIslandScene playerPosition={playerPosRef.current} />
              <LootDropsRenderer playerPosition={playerPosRef.current} />
            </Physics>
          </Suspense>
        </Canvas>
        <HUD />
        {trainingIslandCleared && (
          <div style={{
            position: "fixed",
            bottom: 30,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 150,
          }}>
            <button onClick={handleLeaveTrainingIsland} style={{
              background: "linear-gradient(180deg, #2a6b2a 0%, #1a4a1a 100%)",
              border: "2px solid #44ff44",
              borderRadius: 8,
              padding: "12px 32px",
              color: "#44ff44",
              fontFamily: "serif",
              fontSize: 18,
              fontWeight: "bold",
              cursor: "pointer",
              textShadow: "0 0 8px #22aa22",
            }}>
              Return to Base
            </button>
          </div>
        )}
        <ModeControllerUpdater />
      </KeyboardControls>
    );
  }

  if (sailing) {
    return (
      <KeyboardControls map={controls}>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [0, 15, 25], fov: 50, near: 0.1, far: 1000 }}
          gl={{
            antialias: false,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          onCreated={({ gl }) => {
            const canvas = gl.domElement;
            canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); });
            canvas.addEventListener("webglcontextrestored", () => { console.log("WebGL context restored"); });
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <AssetLoaderInit />
          <Suspense fallback={null}>
            <SailingScene onArrive={handleSailingArrive} />
          </Suspense>
        </Canvas>
        <SailingHUD />
      </KeyboardControls>
    );
  }

  return (
    <KeyboardControls map={controls}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{
          position: [0, 15, 15],
          fov: 50,
          near: 0.1,
          far: 500,
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
          const canvas = gl.domElement;
          canvas.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            console.warn("WebGL context lost - will restore");
          });
          canvas.addEventListener("webglcontextrestored", () => {
            console.log("WebGL context restored");
          });
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <AssetLoaderInit />
        <Suspense fallback={null}>
          <Physics
            gravity={[0, gravity, 0]}
            timeStep={1 / 60}
            interpolate={true}
          >
            <Sky />
            <WeatherEvents />
            <Lighting />
            <VFXSystem />
            <Terrain />
            <TerrainCollider />
            <TerrainEditor />
            <BuildingColliders />
            {/* Dev-only F8 collider overlay. Subscribes to the shared
                collider-debug registry that `<BuildingColliders>`,
                `<PlacedBuildings>`, and any other producers in this
                scene self-register into; renders a wireframe + bbox
                quad per registered chunk while the F8 cheat is on,
                colour-grouped by source (`static_building`,
                `placed_building_<defId>`, …). Returns null with the
                cheat off — production runs pay nothing. */}
            <RegisteredDebugColliderOverlay />
            <World />
            <DungeonEntrances playerPosition={playerPosRef.current} />
            <HousingEntrance playerPosition={playerPosRef.current} />
            <Player
              onPositionUpdate={handlePlayerPositionUpdate}
              spawnPosition={returnPos ? [returnPos.x, 3, returnPos.z] : [0, 5, -5]}
            />
            {enemies.map((enemy) => (
              <Enemy
                key={enemy.id}
                data={enemy}
                playerPosition={playerPosRef.current}
              />
            ))}
            {!isWilderness && <NPCs />}
            <BiomeWildlife />
            <AllyNPCs />
            <PlacedBuildings />
            {!isWilderness && <SurvivalBuildings />}
            <ModularBuildings />
            <Suspense fallback={null}>
              <NatureScatter />
            </Suspense>
            <ResourceNodes playerPosition={playerPosRef.current} />
            <WaveSpawner playerPosition={playerPosRef.current} />
            {campaignActive && <BossSpawner />}
            <LootDropsRenderer playerPosition={playerPosRef.current} />
            <Camera playerPosition={playerPosRef.current} />
            <OceanPlane />
            <Suspense fallback={null}>
              <DockArea dockPositions={DEFAULT_DOCKS} />
            </Suspense>
            <BeachedBoatsSystem playerPosition={playerPosRef.current} />
            <DockDetector
              playerPosition={playerPosRef.current}
              dockPositions={DEFAULT_DOCKS}
              onNearDock={setNearDock}
            />
            <fog attach="fog" args={["#87CEEB", 50, 150]} />
            {/* Scene Inspector — F9 dev overlay. Bridge sits inside
                Physics so it can read both the R3F scene tree and the
                Rapier world. SelectionHighlight draws a yellow bbox
                around the selected object. Both no-op when the panel
                is closed. */}
            <SceneInspectorBridge />
            <SelectionHighlight />
            {/* Sinking island simulation — drives the boss-zone sink/respawn
                state machine every frame. Must be inside the Canvas so it
                gets proper R3F delta time. Cost is one branch check/frame
                while all islands are stable. */}
            <SinkingIslandTicker />
            {/* Faction heroes — renders only heroes co-located with the
                player. Off-screen heroes advance via 60-s interval in
                FactionHeroes; their states live in useFactionHeroes. */}
            <FactionHeroes playerPosition={playerPosRef.current} />
          </Physics>
        </Suspense>
      </Canvas>
      <HUD />
      <SceneInspectorPanel />
      <LocationDiscovery />
      <BuildMenu />
      <ModularBuildMenu />
      <CampaignHUD />
      <DungeonInteractionHandler />
      <BuildModeHandler />
      <ModeControllerUpdater />
      {/* F10 — sinking island state verification panel */}
      <SinkingIslandDebugHUD />
      {/* Faction hero interaction panel — opens on [T] near hub hero */}
      <HeroInteractionPanel />
      <ShovelHudOverlay />
      {/* IslandStatus: only show during active sailing transit. When docked
          the hub_main island name + dock prompts handle orientation cues. */}
      {sailing && <SailingHUD />}
      <DockPrompt visible={nearDock && !showIslandSelector} onBoard={handleBoardBoat} />
      <BeachedBoatPromptHUD />
      {nearDock && !showIslandSelector && !showTrainingSelector && (
        <div style={{
          position: "fixed",
          bottom: 90,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
        }}>
          <button onClick={handleOpenTrainingSelector} style={{
            background: "linear-gradient(180deg, #6b3a1a 0%, #4a2510 100%)",
            border: "2px solid #aa7733",
            borderRadius: 8,
            padding: "10px 24px",
            color: "#ffcc66",
            fontFamily: "serif",
            fontSize: 15,
            fontWeight: "bold",
            cursor: "pointer",
            textShadow: "0 0 6px #aa6600",
          }}>
            Sail to Training Islands
          </button>
        </div>
      )}
      {showIslandSelector && (
        <IslandSelector
          onSelect={handleSelectDestination}
          onCancel={handleCancelSelector}
        />
      )}
      {showTrainingSelector && (
        <IslandSelectorUI
          onSelect={handleSelectTrainingIsland}
          onClose={() => setShowTrainingSelector(false)}
        />
      )}
    </KeyboardControls>
  );
}
