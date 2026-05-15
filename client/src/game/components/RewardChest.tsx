/**
 * RewardChest — tiered dungeon chests (common / uncommon / rare / mimic)
 * that open when the player approaches, roll the container loot table,
 * and eject 3D loot sprites into the world.
 *
 * Each chest renders as the body GLB + a separate lid GLB that rotates
 * open on approach. Loot is ejected via useLootDrops.addDrops().
 *
 * Usage in a scene:
 *   <RewardChest position={[10, 0, 5]} tier="rare" />
 *   <RewardChest position={[15, 0, 8]} tier="common" />
 */

import { useRef, useState, useMemo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { REWARD_CHEST_MODELS, type RewardChestTier } from "../systems/ModelRegistry";
import { rollContainerLootDrops } from "../systems/LootSystem";
import { useLootDrops } from "./LootDrops";
import { useAsset } from "../hooks/useAsset";
import { getTerrainHeight, globalHeightData } from "./Terrain";

interface RewardChestProps {
  position: [number, number, number];
  tier?: RewardChestTier;
  /** Loot table kind (default: "chest"). */
  lootKind?: "chest" | "sarcophagus" | "bookshelf";
  /** Distance in meters to trigger the open animation. */
  openRange?: number;
}

const TIER_GLOW: Record<RewardChestTier, string> = {
  common: "#cccccc",
  uncommon: "#44cc44",
  rare: "#4488ff",
  mimic: "#ff2222",
};

function ChestBody({ path, scale }: { path: string; scale: number }) {
  const { scene } = useAsset(path);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.scale.setScalar(scale);
    clone.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).castShadow = true;
        (child as THREE.Mesh).receiveShadow = true;
      }
    });
    return clone;
  }, [scene, scale]);
  return <primitive object={model} />;
}

function ChestLid({ path, scale, openAngle }: { path: string; scale: number; openAngle: number }) {
  const { scene } = useAsset(path);
  const groupRef = useRef<THREE.Group>(null);

  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.scale.setScalar(scale);
    clone.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).castShadow = true;
      }
    });
    return clone;
  }, [scene, scale]);

  useFrame(() => {
    if (!groupRef.current) return;
    // Smoothly interpolate toward the target open angle
    const current = groupRef.current.rotation.x;
    const target = -openAngle;
    groupRef.current.rotation.x += (target - current) * 0.08;
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} />
    </group>
  );
}

export default function RewardChest({
  position,
  tier = "common",
  lootKind = "chest",
  openRange = 3,
}: RewardChestProps) {
  const chestDef = REWARD_CHEST_MODELS[tier];
  const [opened, setOpened] = useState(false);
  const [openAngle, setOpenAngle] = useState(0);
  const glowColor = TIER_GLOW[tier];

  const terrainY = getTerrainHeight(position[0], position[2], globalHeightData);
  const y = Math.max(position[1], terrainY);

  useFrame(({ camera }) => {
    if (opened) return;
    // Check distance to camera (proxy for player position)
    const camPos = camera.position;
    const dx = camPos.x - position[0];
    const dz = camPos.z - position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < openRange) {
      setOpened(true);
      setOpenAngle(Math.PI * 0.6); // ~108° open

      // Roll loot and eject into world
      const drops = rollContainerLootDrops(lootKind, position[0], y + 0.8, position[2]);
      if (drops.length > 0) {
        useLootDrops.getState().addDrops(drops);
      }
    }
  });

  return (
    <group position={[position[0], y, position[2]]}>
      <Suspense fallback={
        <mesh>
          <boxGeometry args={[0.6, 0.4, 0.4]} />
          <meshStandardMaterial color={glowColor} />
        </mesh>
      }>
        <ChestBody path={chestDef.body} scale={chestDef.scale} />
        <ChestLid path={chestDef.top} scale={chestDef.scale} openAngle={openAngle} />
      </Suspense>
      {/* Glow aura before opening */}
      {!opened && (
        <pointLight
          color={glowColor}
          intensity={1.5}
          distance={5}
          position={[0, 0.4, 0]}
        />
      )}
      {/* Bright burst when opening */}
      {opened && (
        <pointLight
          color="#ffffff"
          intensity={3}
          distance={6}
          position={[0, 0.6, 0]}
        />
      )}
    </group>
  );
}
