import { useRef, useEffect, useMemo, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAsset } from "../hooks/useAsset";
import { useTrainingIslands } from "./useTrainingIslands";
import { getTrainingIsland, TRAINING_ISLANDS, type TrainingIsland } from "./TrainingIslandRegistry";
import { useEnemyManager } from "../systems/EnemyManager";
import Enemy from "../components/Enemy";
import { useCombatLog } from "@/lib/stores/useCombatLog";
import { useAudio } from "@/lib/stores/useAudio";
import { SeaSurface } from "../effects/SeaSurface";

const PIRATE_SCENE_PATH = "/models/pirate_islands/scene.gltf";

const DESIRED_ISLAND_WIDTH = 60;

function PirateIslandModel({ island }: { island: TrainingIsland }) {
  const gltf = useAsset(PIRATE_SCENE_PATH);

  const islandGroup = useMemo(() => {
    if (!gltf?.scene) return null;
    const cloned = gltf.scene.clone(true);
    cloned.updateMatrixWorld(true);

    let targetNode: THREE.Object3D | null = null;
    cloned.traverse((child) => {
      if (child.name === island.sceneNodeName) {
        targetNode = child;
      }
    });

    if (!targetNode) {
      cloned.traverse((child) => {
        if (child.name === "RootNode" && child.children) {
          for (const c of child.children) {
            if (c.name === island.sceneNodeName) {
              targetNode = c;
              break;
            }
          }
        }
      });
    }

    if (!targetNode) {
      console.warn(`[TrainingIsland] Could not find node: ${island.sceneNodeName}`);
      return { group: cloned, computedScale: 1 };
    }
    const node: THREE.Object3D = targetNode;

    const parentWorldMatrix = node.parent
      ? node.parent.matrixWorld.clone()
      : new THREE.Matrix4();

    const group = new THREE.Group();
    group.applyMatrix4(parentWorldMatrix);

    group.add(node.clone(true));

    cloned.traverse((child) => {
      // SeaFloor stays — it's the seabed mesh under the water.
      // WaterPlane / WaterPlane_Flipped are intentionally NOT cloned: the
      // top-of-water surface is rendered by <SeaSurface> below using the
      // Seascape (TDM 2014) shader. Cloning the GLB's water planes would
      // stack two semi-transparent sheets at the same y and waste fillrate.
      if (child.name === "SeaFloor") {
        const waterClone = child.clone(true);
        const childParentMatrix = child.parent
          ? child.parent.matrixWorld.clone()
          : new THREE.Matrix4();
        const relativeMatrix = parentWorldMatrix.clone().invert().multiply(childParentMatrix);
        const wrapGroup = new THREE.Group();
        wrapGroup.applyMatrix4(relativeMatrix);
        wrapGroup.add(waterClone);
        group.add(wrapGroup);
      }
    });

    const box = new THREE.Box3();
    group.updateMatrixWorld(true);
    box.setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.z);
    const computedScale = maxDim > 0 ? DESIRED_ISLAND_WIDTH / maxDim : 1;

    const center = new THREE.Vector3();
    box.getCenter(center);

    console.log(
      `[TrainingIsland] ${island.sceneNodeName}: raw size=${size.x.toFixed(1)}x${size.y.toFixed(1)}x${size.z.toFixed(1)}, ` +
      `computedScale=${computedScale.toFixed(4)}, final width=${(maxDim * computedScale).toFixed(1)}`
    );

    return { group, computedScale, centerOffset: center.multiplyScalar(computedScale) };
  }, [gltf, island.sceneNodeName]);

  if (!islandGroup) return null;

  const { group, computedScale, centerOffset } = islandGroup;
  const s = computedScale;

  return (
    <group
      scale={[s, s, s]}
      position={[
        island.sceneOffset[0] - (centerOffset?.x ?? 0),
        island.sceneOffset[1],
        island.sceneOffset[2] - (centerOffset?.z ?? 0),
      ]}
    >
      <primitive object={group} />
    </group>
  );
}

function TrainingIslandSpawner({ island, playerPosition }: { island: TrainingIsland; playerPosition: THREE.Vector3 }) {
  const { spawnEnemy, enemies } = useEnemyManager();
  const tiState = useTrainingIslands();
  const { playSuccess } = useAudio();
  const spawnTimer = useRef(0);
  const waveEnemiesSpawned = useRef(0);
  const waveEnemiesTotal = useRef(0);
  const bossSpawnedLocal = useRef(false);
  const waveStarted = useRef(false);
  const prevEnemyCount = useRef(0);

  useEffect(() => {
    waveEnemiesSpawned.current = 0;
    waveEnemiesTotal.current = 0;
    bossSpawnedLocal.current = false;
    waveStarted.current = false;
    spawnTimer.current = 2.0;
    prevEnemyCount.current = 0;
  }, [island.id]);

  useEffect(() => {
    const aliveCount = enemies.filter(e => !e.isDying).length;
    if (aliveCount < prevEnemyCount.current) {
      const killed = prevEnemyCount.current - aliveCount;
      for (let i = 0; i < killed; i++) {
        useTrainingIslands.getState().recordKill();
      }
    }
    prevEnemyCount.current = aliveCount;
  }, [enemies]);

  useFrame((_, delta) => {
    if (!tiState.waveInProgress) return;

    const currentWaveIndex = tiState.currentWave;

    if (tiState.bossSpawned && !bossSpawnedLocal.current && island.bossType) {
      bossSpawnedLocal.current = true;
      const angle = Math.random() * Math.PI * 2;
      const dist = 15 + Math.random() * 10;
      const pos = new THREE.Vector3(
        playerPosition.x + Math.cos(angle) * dist,
        0,
        playerPosition.z + Math.sin(angle) * dist
      );
      spawnEnemy(island.bossType, pos);
      useCombatLog.getState().addEntry(
        `⚔️ ${island.bossName} has appeared!`,
        "#ff9900"
      );
      return;
    }

    if (currentWaveIndex >= island.waves.length) {
      const activeEnemies = enemies.filter(e => !e.isDying);
      if (activeEnemies.length === 0 && tiState.bossSpawned) {
        tiState.defeatBoss();
        tiState.clearIsland();
        playSuccess();
        useCombatLog.getState().addEntry(
          `🏆 ${island.name} has been conquered!`,
          "#44ff44"
        );
      }
      return;
    }

    const waveDef = island.waves[currentWaveIndex];
    if (!waveDef) return;

    if (!waveStarted.current) {
      waveStarted.current = true;
      waveEnemiesSpawned.current = 0;
      let total = 0;
      for (const entry of waveDef.enemies) total += entry.count;
      waveEnemiesTotal.current = total;
      spawnTimer.current = 1.5;
      useCombatLog.getState().addEntry(
        `Wave ${currentWaveIndex + 1}/${island.waves.length} incoming!`,
        "#ffaa00"
      );
    }

    spawnTimer.current -= delta;
    if (spawnTimer.current > 0) return;

    if (waveEnemiesSpawned.current < waveEnemiesTotal.current) {
      let spawnedSoFar = 0;
      for (const entry of waveDef.enemies) {
        const alreadySpawned = Math.min(waveEnemiesSpawned.current - spawnedSoFar, entry.count);
        if (alreadySpawned < entry.count) {
          const angle = Math.random() * Math.PI * 2;
          const dist = island.enemySpawnRadius * 0.5 + Math.random() * island.enemySpawnRadius * 0.5;
          const pos = new THREE.Vector3(
            Math.cos(angle) * dist,
            0,
            Math.sin(angle) * dist
          );
          const clampR = island.boundsRadius;
          pos.x = Math.max(-clampR, Math.min(clampR, pos.x));
          pos.z = Math.max(-clampR, Math.min(clampR, pos.z));
          spawnEnemy(entry.type, pos);
          waveEnemiesSpawned.current++;
          spawnTimer.current = waveDef.spawnDelay;
          tiState.setWaveSpawnProgress(waveEnemiesSpawned.current, waveEnemiesTotal.current);
          break;
        }
        spawnedSoFar += entry.count;
      }
    }

    if (waveEnemiesSpawned.current >= waveEnemiesTotal.current) {
      const activeEnemies = enemies.filter(e => !e.isDying);
      if (activeEnemies.length === 0) {
        waveStarted.current = false;
        waveEnemiesSpawned.current = 0;
        tiState.advanceWave();
        playSuccess();
      }
    }
  });

  return null;
}

function TrainingIslandHUD({ island }: { island: TrainingIsland }) {
  const { currentWave, totalWaves, enemiesKilledThisIsland, totalEnemiesThisIsland, bossSpawned, islandCleared } = useTrainingIslands();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setPortalTarget(document.body);
  }, []);

  if (!portalTarget) return null;

  return createPortal(
    <div style={{
      position: "fixed",
      top: 10,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 100,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      pointerEvents: "none",
    }}>
      <div style={{
        background: "linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(20,10,5,0.9) 100%)",
        border: "2px solid #aa7733",
        borderRadius: 8,
        padding: "8px 24px",
        color: "#ffddaa",
        fontFamily: "serif",
        textAlign: "center",
        minWidth: 260,
      }}>
        <div style={{ fontSize: 18, fontWeight: "bold", color: "#ffcc66", textShadow: "0 0 8px #aa6600" }}>
          {island.name}
        </div>
        <div style={{ fontSize: 11, color: "#aa8855", marginBottom: 4 }}>{island.subtitle}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, gap: 16 }}>
          <span>Difficulty: {"⭐".repeat(island.difficulty)}</span>
          <span>Wave: {Math.min(currentWave + 1, totalWaves)}/{totalWaves}</span>
        </div>
      </div>

      {islandCleared && (
        <div style={{
          background: "linear-gradient(180deg, rgba(0,80,0,0.9) 0%, rgba(0,40,0,0.95) 100%)",
          border: "2px solid #44ff44",
          borderRadius: 8,
          padding: "12px 28px",
          color: "#44ff44",
          fontFamily: "serif",
          fontSize: 22,
          fontWeight: "bold",
          textShadow: "0 0 12px #22aa22",
          animation: "emote-pop 0.5s ease-out",
        }}>
          ISLAND CONQUERED!
        </div>
      )}

      {bossSpawned && !islandCleared && (
        <div style={{
          background: "rgba(100,0,0,0.9)",
          border: "2px solid #ff4444",
          borderRadius: 6,
          padding: "6px 16px",
          color: "#ff6666",
          fontFamily: "serif",
          fontSize: 16,
          fontWeight: "bold",
          animation: "emote-pop 0.3s ease-out",
        }}>
          {island.bossName} AWAKENS!
        </div>
      )}

      <div style={{
        background: "rgba(0,0,0,0.7)",
        borderRadius: 4,
        padding: "2px 12px",
        color: "#cccccc",
        fontSize: 11,
      }}>
        Enemies: {enemiesKilledThisIsland}/{totalEnemiesThisIsland}
      </div>
    </div>,
    portalTarget,
  );
}

export function IslandSelectorUI({ onSelect, onClose }: { onSelect: (id: string) => void; onClose: () => void }) {
  const { clearedIslands, isIslandUnlocked } = useTrainingIslands();

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.8)",
    }}>
      <div style={{
        background: "linear-gradient(180deg, #1a0e05 0%, #0d0805 100%)",
        border: "2px solid #aa7733",
        borderRadius: 12,
        padding: 24,
        maxWidth: 700,
        width: "90%",
        maxHeight: "80vh",
        overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ color: "#ffcc66", fontFamily: "serif", margin: 0, fontSize: 24 }}>
            Training Islands
          </h2>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid #666", color: "#aaa", padding: "4px 12px",
            borderRadius: 4, cursor: "pointer", fontSize: 14,
          }}>Close</button>
        </div>
        <p style={{ color: "#aa8855", fontSize: 13, marginBottom: 16, fontFamily: "serif" }}>
          Sail to pirate-controlled islands and conquer them. Each island has unique enemies and fighting styles.
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {(TRAINING_ISLANDS as TrainingIsland[]).map((island) => {
            const unlocked = isIslandUnlocked(island.id);
            const cleared = clearedIslands.has(island.id);
            return (
              <div key={island.id} style={{
                background: cleared ? "rgba(0,60,0,0.3)" : unlocked ? "rgba(40,30,20,0.6)" : "rgba(20,20,20,0.4)",
                border: `1px solid ${cleared ? "#44aa44" : unlocked ? "#aa7733" : "#444"}`,
                borderRadius: 8,
                padding: 12,
                opacity: unlocked ? 1 : 0.5,
                cursor: unlocked && !cleared ? "pointer" : "default",
              }} onClick={() => unlocked && !cleared && onSelect(island.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ color: "#ffcc66", fontWeight: "bold", fontSize: 15, fontFamily: "serif" }}>
                      {island.name}
                    </span>
                    <span style={{ color: "#886644", fontSize: 12, marginLeft: 8 }}>{island.subtitle}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: "#ffaa00", fontSize: 13 }}>{"⭐".repeat(island.difficulty)}</span>
                    {cleared && <span style={{ color: "#44ff44", fontSize: 16 }}>✓</span>}
                    {!unlocked && <span style={{ color: "#666", fontSize: 12 }}>🔒</span>}
                  </div>
                </div>
                <p style={{ color: "#998877", fontSize: 12, margin: "6px 0 0", lineHeight: 1.4 }}>
                  {island.description}
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "#777" }}>
                  <span>Waves: {island.waves.length}</span>
                  <span>Boss: {island.bossName}</span>
                  <span>Style: {island.defaultBehavior}</span>
                  <span>XP: {island.rewards.xp}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TrainingIslandEnemies({ island, playerPosition }: { island: TrainingIsland; playerPosition: THREE.Vector3 }) {
  const { enemies } = useEnemyManager();
  const { currentBehavior } = useTrainingIslands();

  return (
    <>
      {enemies.map((enemy) => (
        <Enemy
          key={enemy.id}
          data={enemy}
          playerPosition={playerPosition}
          behaviorProfile={currentBehavior}
          allowedEmotes={island.enemyEmotes}
        />
      ))}
    </>
  );
}

interface TrainingIslandSceneProps {
  playerPosition: THREE.Vector3;
}

export default function TrainingIslandScene({ playerPosition }: TrainingIslandSceneProps) {
  const { activeIslandId } = useTrainingIslands();

  if (!activeIslandId) return null;

  const island = getTrainingIsland(activeIslandId);
  if (!island) return null;

  return (
    <>
      <Suspense fallback={null}>
        <PirateIslandModel island={island} />
      </Suspense>

      <TrainingIslandSpawner island={island} playerPosition={playerPosition} />
      <TrainingIslandEnemies island={island} playerPosition={playerPosition} />
      <TrainingIslandHUD island={island} />

      <ambientLight intensity={0.6} color={island.ambientColor} />
      <directionalLight position={[30, 50, 20]} intensity={1.2} castShadow color="#ffeedd" />
      <fog attach="fog" args={[island.fogColor, 20, 150]} />

      {/* Top-of-water surface — Seascape (TDM 2014) shader. */}
      <SeaSurface
        size={500}
        y={-0.5}
        opacity={0.9}
        seaBase="#0f3848"
        seaWaterColor="#a4c4b0"
      />
    </>
  );
}
