import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getTerrainHeight, globalHeightData } from "./Terrain";
import { useEnemyManager, type EnemyType } from "../systems/EnemyManager";
import { useGame } from "@/lib/stores/useGame";
import { useAudio } from "@/lib/stores/useAudio";
import {
  rollBiomeEnemy,
  getDifficultyAtPosition,
} from "../systems/BiomeSpawnRegistry";
import { isEnemySpawnAllowed } from "@/game/world/DistrictRegistry";
import { useWorldEvents } from "@/lib/stores/useWorldEvents";

interface WaveSpawnerProps {
  playerPosition: THREE.Vector3;
}

const WAVE_ENEMY_POOLS: Record<number, { day: EnemyType[]; night: EnemyType[] }> = {
  1: {
    day: ["skeleton", "spider", "bunny", "blob", "thrower_brute", "thrower_assassin", "thrower_soldier", "thrower_berserker"],
    night: ["skeleton", "spider", "ghost", "thrower_brute", "thrower_assassin"],
  },
  2: {
    day: ["skeleton", "spider", "frog", "bunny", "blob", "thrower_soldier", "thrower_berserker"],
    night: ["skeleton", "spider", "ghost", "golem", "thrower_brute", "thrower_assassin"],
  },
  3: {
    day: ["skeleton", "spider", "pirate", "frog", "orc", "thrower_brute", "thrower_berserker"],
    night: ["skeleton", "golem", "ghost", "witch", "tribal", "thrower_soldier"],
  },
  4: {
    day: ["pirate", "orc", "cactoro", "frog", "ninja", "thrower_assassin", "thrower_berserker"],
    night: ["golem", "witch", "ghost", "tribal", "blue_demon", "thrower_brute"],
  },
  5: {
    day: ["orc", "ninja", "cactoro", "tribal", "blue_demon", "raptor", "thrower_berserker"],
    night: ["golem", "witch", "blue_demon", "yeti", "demon", "thrower_soldier"],
  },
  6: {
    day: ["orc", "ninja", "alien", "blue_demon", "mushroom_king", "raptor", "triceratops", "thrower_berserker"],
    night: ["demon", "yeti", "alien", "mushroom_king", "dragon", "trex"],
  },
};

function getWavePool(wave: number, isDaytime: boolean): EnemyType[] {
  const tier = Math.min(wave, 6);
  const pool = WAVE_ENEMY_POOLS[tier];
  const base = isDaytime ? pool.day : pool.night;

  if (wave >= 7 && Math.random() < 0.2) {
    return [...base, "dragon", "dino"];
  }
  if (wave >= 5 && Math.random() < 0.15) {
    return [...base, "demon", "alien"];
  }
  return base;
}

export default function WaveSpawner({ playerPosition }: WaveSpawnerProps) {
  const { spawnEnemy, enemies } = useEnemyManager();
  const { wave, nextWave, phase, isDaytime } = useGame();
  const { playSuccess } = useAudio();
  const spawnTimer = useRef(0);
  const waveEnemiesSpawned = useRef(0);
  const initialized = useRef(false);
  const spawnPos = useRef(new THREE.Vector3());

  const maxEnemiesPerWave = wave * 3 + 2;
  const maxConcurrent = 5 + wave * 2;

  useEffect(() => {
    if (phase === "playing" && !initialized.current) {
      initialized.current = true;
      waveEnemiesSpawned.current = 0;
    }
    if (phase === "menu") {
      initialized.current = false;
      waveEnemiesSpawned.current = 0;
    }
  }, [phase]);

  useFrame((_, delta) => {
    if (phase !== "playing") return;

    spawnTimer.current -= delta;

    if (
      spawnTimer.current <= 0 &&
      waveEnemiesSpawned.current < maxEnemiesPerWave &&
      enemies.length < maxConcurrent
    ) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 15;
      const sx = playerPosition.x + Math.cos(angle) * dist;
      const sz = playerPosition.z + Math.sin(angle) * dist;
      const sy = getTerrainHeight(sx, sz, globalHeightData);
      spawnPos.current.set(sx, sy, sz);

      const bounds = 90;
      spawnPos.current.x = Math.max(-bounds, Math.min(bounds, spawnPos.current.x));
      spawnPos.current.z = Math.max(-bounds, Math.min(bounds, spawnPos.current.z));

      // Skip town/safe districts — enemies don't spawn inside settlements.
      if (!isEnemySpawnAllowed(spawnPos.current.x, spawnPos.current.z)) {
        spawnTimer.current = 0.5; // retry quickly at a different angle
        return;
      }

      // Primary: biome-appropriate enemy for this spawn position.
      // Fallback: wave-tier pool (plains / initial game area).
      const biomeType = rollBiomeEnemy(
        spawnPos.current.x,
        spawnPos.current.z,
        isDaytime,
      );
      const pool = getWavePool(wave, isDaytime);
      const type: EnemyType = biomeType ?? pool[Math.floor(Math.random() * pool.length)];

      spawnEnemy(type, spawnPos.current.clone());
      waveEnemiesSpawned.current++;

      // Spawn interval: shorter in high-difficulty zones (more pressure).
      const diffMult = getDifficultyAtPosition(
        spawnPos.current.x,
        spawnPos.current.z,
      );
      const baseInterval = isDaytime ? 4 : 2;
      // diffMult 1.0 → normal interval; 3.5 → ~60 % faster
      const diffScale = Math.max(0.4, 1 / Math.sqrt(diffMult));
      // World events (e.g. FactionInvasion) further compress the interval.
      const eventMult = useWorldEvents.getState().enemySpawnMult();
      spawnTimer.current =
        (baseInterval - Math.min(wave * 0.2, 2) + Math.random() * 2) * diffScale * eventMult;
    }

    const activeEnemies = enemies.filter(e => !e.isDying);
    if (waveEnemiesSpawned.current >= maxEnemiesPerWave && activeEnemies.length === 0) {
      nextWave();
      playSuccess();
      waveEnemiesSpawned.current = 0;
      spawnTimer.current = 3;
    }
  });

  return null;
}
