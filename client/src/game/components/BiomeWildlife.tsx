/**
 * BiomeWildlife — replaces the old Animals.tsx with a biome-aware wildlife system.
 *
 * On mount, 24 animal positions are determined across the home island using a
 * seeded RNG. For each position, `rollBiomeWildlife` selects the ecologically
 * correct species from WILDLIFE_MODELS (cows/sheep near plains, pigeon/fish near
 * coast, llama/sheep in mountains, etc.). Models load via `useCharacterController`
 * for consistent animation support.
 *
 * Harvestable animals (cow, pig, sheep, llama, fish) track a simple HP ref.
 * If the player is nearby and presses F while in harvest mode, the animal takes
 * damage and on death drops raw_meat into the inventory. Passive animals flee
 * rather than standing still when approached.
 *
 * BiomeSpawnRegistry.WILDLIFE_MODELS provides the correct model paths; we no
 * longer use the old Animals.tsx mapping of Mushnub_Evolved → "Cow".
 */

import { useRef, useEffect, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useCharacterController } from "../controllers/useCharacterController";
import { getTerrainHeight, globalHeightData } from "./Terrain";
import { KinematicCharacterBody } from "./KinematicCharacterBody";
import { COLLISION_MASKS } from "./BuildingColliders";
import {
  rollBiomeWildlife,
  type WildlifeEntry,
} from "../systems/BiomeSpawnRegistry";
import { useInventory } from "@/lib/stores/useInventory";
import { useGame } from "@/lib/stores/useGame";

// ─────────────────────────────────────────────────────────────────────────────

const TOTAL_ANIMALS = 24;
const WORLD_RANGE   = 85;    // world-space half-extent for placement
const HARVEST_RANGE = 3.5;   // distance for F-key harvest
const FLEE_RANGE    = 8.0;   // passive animals flee when player this close
const FLEE_SPEED    = 5.0;

// ─────────────────────────────────────────────────────────────────────────────
// Seed stable spawn positions + species selection at module load
// ─────────────────────────────────────────────────────────────────────────────

interface AnimalSpawn {
  entry:   WildlifeEntry;
  startX:  number;
  startZ:  number;
  startY:  number;
}

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}

function buildSpawnList(): AnimalSpawn[] {
  const rng  = seededRng(777);
  const list: AnimalSpawn[] = [];

  while (list.length < TOTAL_ANIMALS) {
    const angle = rng() * Math.PI * 2;
    const dist  = 15 + rng() * WORLD_RANGE;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = getTerrainHeight(x, z, globalHeightData);
    if (y < 0.1) continue;                          // skip underwater cells
    if (Math.abs(x) < 6 && Math.abs(z) < 6) continue; // clear of spawn point

    const candidates = rollBiomeWildlife(x, z, 1);
    if (candidates.length === 0) continue;

    list.push({ entry: candidates[0], startX: x, startZ: z, startY: y });
  }
  return list;
}

const ANIMAL_SPAWNS: AnimalSpawn[] = buildSpawnList();

// ─────────────────────────────────────────────────────────────────────────────
// Individual animal component
// ─────────────────────────────────────────────────────────────────────────────

interface AnimalModelProps {
  spawn: AnimalSpawn;
}

const _toPlayer  = new THREE.Vector3();
const _toTarget  = new THREE.Vector3();
const _awayDir   = new THREE.Vector3();

function AnimalModel({ spawn }: AnimalModelProps) {
  const { entry } = spawn;

  const { scene, playAnimation, update, setMovementSpeed, bounds } = useCharacterController({
    modelPath:          entry.modelPath,
    targetHeight:       entry.targetHeight,
    disableCombatLayer: true,
  });

  const groupRef       = useRef<THREE.Group>(null);
  const localPos       = useRef(new THREE.Vector3(spawn.startX, spawn.startY, spawn.startZ));
  const wanderTarget   = useRef(new THREE.Vector3(spawn.startX, 0, spawn.startZ));
  const wanderTimer    = useRef(Math.random() * 4 + 2);
  const isIdle         = useRef(true);
  const idleTimer      = useRef(Math.random() * 3 + 1);
  const prevAnim       = useRef<string>("idle");
  const hp             = useRef(entry.harvestable ? 40 : Infinity);
  const alive          = useRef(true);

  // Harvest trigger — player presses F while in harvest mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!alive.current) return;
      if (!entry.harvestable) return;
      if (e.code !== "KeyF") return;
      const mode = useGame.getState().interactionMode;
      if (mode !== "harvest") return;
      const playerPos = useGame.getState().playerPosition;
      if (!playerPos) return;
      if (localPos.current.distanceTo(playerPos) > HARVEST_RANGE) return;
      hp.current = Math.max(0, hp.current - 20);
      if (hp.current <= 0) {
        alive.current = false;
        // Drop raw_meat
        useInventory.getState().addItem({
          id: "raw_meat", name: "Raw Meat", type: "food",
          healAmount: 8, icon: "🥩", quantity: 1 + Math.floor(Math.random() * 2),
        });
        if (groupRef.current) groupRef.current.visible = false;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entry]);

  useFrame((_, delta) => {
    if (!groupRef.current || !alive.current) return;
    update(delta);

    const playerPos = useGame.getState().playerPosition;

    // ── Flee behaviour (passive animals) ─────────────────────────────────
    if (entry.passive && playerPos) {
      const distToPlayer = localPos.current.distanceTo(playerPos);
      if (distToPlayer < FLEE_RANGE) {
        _awayDir.subVectors(localPos.current, playerPos).setY(0).normalize();
        localPos.current.addScaledVector(_awayDir, FLEE_SPEED * delta);
        localPos.current.y = getTerrainHeight(localPos.current.x, localPos.current.z, globalHeightData);
        const angle = Math.atan2(_awayDir.x, _awayDir.z);
        groupRef.current.rotation.y = angle;
        groupRef.current.position.copy(localPos.current);
        if (prevAnim.current !== "run") {
          playAnimation("run");
          prevAnim.current = "run";
        }
        setMovementSpeed(FLEE_SPEED);
        return;
      }
    }

    // ── Wander behaviour ─────────────────────────────────────────────────
    if (isIdle.current) {
      idleTimer.current -= delta;
      if (idleTimer.current <= 0) {
        isIdle.current = false;
        const angle = Math.random() * Math.PI * 2;
        const dist  = 4 + Math.random() * 12;
        wanderTarget.current.set(
          spawn.startX + Math.cos(angle) * dist,
          0,
          spawn.startZ + Math.sin(angle) * dist,
        );
        wanderTarget.current.x = Math.max(-90, Math.min(90, wanderTarget.current.x));
        wanderTarget.current.z = Math.max(-90, Math.min(90, wanderTarget.current.z));
        wanderTimer.current = 4 + Math.random() * 6;
      }
      if (prevAnim.current !== "idle") {
        playAnimation("idle");
        prevAnim.current = "idle";
      }
      setMovementSpeed(0);
      return;
    }

    _toTarget.subVectors(wanderTarget.current, localPos.current).setY(0);
    const dist = _toTarget.length();
    if (dist < 0.5) {
      isIdle.current = true;
      idleTimer.current = 2 + Math.random() * 4;
      return;
    }

    _toTarget.normalize();
    localPos.current.addScaledVector(_toTarget, entry.speed * delta);
    localPos.current.y = getTerrainHeight(localPos.current.x, localPos.current.z, globalHeightData);
    const angle = Math.atan2(_toTarget.x, _toTarget.z);
    groupRef.current.rotation.y = angle;
    groupRef.current.position.copy(localPos.current);

    if (prevAnim.current !== "walk") {
      playAnimation("walk");
      prevAnim.current = "walk";
    }
    setMovementSpeed(entry.speed);
  });

  return (
    <>
      <KinematicCharacterBody
        positionRef={localPos}
        bounds={bounds}
        collisionGroups={COLLISION_MASKS.NPC}
      />
      <group ref={groupRef} position={localPos.current.toArray()}>
        <primitive object={scene} />
        {/* Harvest indicator — small orange dot above harvestable animals */}
        {entry.harvestable && (
          <sprite position={[0, entry.targetHeight + 0.4, 0]} scale={[0.3, 0.3, 1]}>
            <spriteMaterial color="#ff9900" opacity={0.7} transparent />
          </sprite>
        )}
      </group>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported scene component
// ─────────────────────────────────────────────────────────────────────────────

export default function BiomeWildlife() {
  return (
    <>
      {ANIMAL_SPAWNS.map((spawn, i) => (
        <Suspense key={`biome_wildlife_${i}`} fallback={null}>
          <AnimalModel spawn={spawn} />
        </Suspense>
      ))}
    </>
  );
}
