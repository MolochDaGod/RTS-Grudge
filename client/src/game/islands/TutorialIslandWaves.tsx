import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useEnemyManager, type EnemyType } from "@/game/systems/EnemyManager";
import { useGame } from "@/lib/stores/useGame";

/**
 * Wave-based enemy spawner for the tutorial island.
 *
 * Mirrors `client/src/game/components/WaveSpawner.tsx` but does NOT
 * depend on the GameScene Terrain heightfield — the tutorial island
 * is a baked GLB, so we just use the player's Y as the spawn Y. That
 * keeps spawns at ground level relative to the player without needing
 * to raycast into the world every spawn.
 *
 * Tuned for the 100×-scaled tutorial world: spawn ring of 25–55 m
 * around the player, soft cap of 5 + 2·wave concurrent enemies, max
 * 2 + 3·wave per wave.
 */

const WAVE_POOLS: Record<number, { day: EnemyType[]; night: EnemyType[] }> = {
  1: {
    day: ["skeleton", "spider", "blob", "bunny"],
    night: ["skeleton", "spider", "ghost"],
  },
  2: {
    day: ["skeleton", "spider", "frog", "blob", "thrower_soldier"],
    night: ["skeleton", "spider", "ghost", "thrower_brute"],
  },
  3: {
    day: ["skeleton", "pirate", "frog", "orc", "thrower_brute"],
    night: ["skeleton", "golem", "ghost", "witch"],
  },
  4: {
    day: ["pirate", "orc", "ninja", "cactoro", "thrower_assassin"],
    night: ["golem", "witch", "ghost", "tribal", "blue_demon"],
  },
  5: {
    day: ["orc", "ninja", "tribal", "blue_demon", "raptor"],
    night: ["golem", "witch", "blue_demon", "yeti", "demon"],
  },
  6: {
    day: ["orc", "ninja", "alien", "mushroom_king", "raptor", "triceratops"],
    night: ["demon", "yeti", "alien", "mushroom_king", "dragon", "trex"],
  },
};

function poolFor(wave: number, isDay: boolean): EnemyType[] {
  const tier = Math.max(1, Math.min(wave, 6));
  return isDay ? WAVE_POOLS[tier].day : WAVE_POOLS[tier].night;
}

interface Props {
  playerPosition: THREE.Vector3;
  /** Min spawn radius around the player. */
  minRadius?: number;
  /** Max spawn radius around the player. */
  maxRadius?: number;
}

export default function TutorialIslandWaves({
  playerPosition,
  minRadius = 25,
  maxRadius = 55,
}: Props) {
  const { spawnEnemy, enemies } = useEnemyManager();
  const { wave, nextWave, phase, isDaytime } = useGame();
  const spawnTimer = useRef(0);
  const spawnedThisWave = useRef(0);
  const armed = useRef(false);
  const tmp = useRef(new THREE.Vector3());

  // Defensive cleanup: if the scene tears down via an unusual path
  // (route swap, hot-reload, etc.) that bypasses `exitTutorialIsland`,
  // make sure we don't leave dangling enemies in the manager that would
  // be inherited by whichever scene mounts next.
  useEffect(() => {
    return () => {
      useEnemyManager.getState().reset();
    };
  }, []);

  const maxThisWave = 2 + wave * 3;
  const maxConcurrent = 5 + wave * 2;

  useEffect(() => {
    if (phase === "playing" && !armed.current) {
      armed.current = true;
      spawnedThisWave.current = 0;
      spawnTimer.current = 4;
    } else if (phase !== "playing") {
      armed.current = false;
      spawnedThisWave.current = 0;
    }
  }, [phase]);

  useFrame((_, delta) => {
    if (phase !== "playing") return;

    spawnTimer.current -= delta;

    if (
      spawnTimer.current <= 0 &&
      spawnedThisWave.current < maxThisWave &&
      enemies.length < maxConcurrent
    ) {
      const angle = Math.random() * Math.PI * 2;
      const dist = minRadius + Math.random() * (maxRadius - minRadius);
      tmp.current.set(
        playerPosition.x + Math.cos(angle) * dist,
        playerPosition.y,
        playerPosition.z + Math.sin(angle) * dist,
      );

      const pool = poolFor(wave, isDaytime);
      const type = pool[Math.floor(Math.random() * pool.length)];
      spawnEnemy(type, tmp.current.clone());
      spawnedThisWave.current++;

      const baseInterval = isDaytime ? 4.5 : 2.5;
      spawnTimer.current = Math.max(
        1,
        baseInterval - Math.min(wave * 0.2, 2.5) + Math.random() * 1.5,
      );
    }

    const alive = enemies.filter((e) => !e.isDying);
    if (spawnedThisWave.current >= maxThisWave && alive.length === 0) {
      nextWave();
      spawnedThisWave.current = 0;
      spawnTimer.current = 6;
    }
  });

  return null;
}
