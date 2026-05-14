import { useRef, useMemo, useEffect, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { create } from "zustand";
import * as THREE from "three";
import { DroppedLoot, rollLootDrops, collectLoot, shouldPickupLoot, isLootExpired } from "../systems/LootSystem";
import { registerEnemyDeathCallback, type EnemyData } from "../systems/EnemyManager";
import { ITEM_MODELS } from "../systems/ModelRegistry";
import { useCampaign } from "@/lib/stores/useCampaign";
import { useAsset } from "../hooks/useAsset";

interface LootDropState {
  drops: DroppedLoot[];
  addDrops: (drops: DroppedLoot[]) => void;
  removeDrop: (id: string) => void;
  clearExpired: () => void;
}

export const useLootDrops = create<LootDropState>((set, get) => ({
  drops: [],
  addDrops: (newDrops) => set(s => ({ drops: [...s.drops, ...newDrops] })),
  removeDrop: (id) => set(s => ({ drops: s.drops.filter(d => d.id !== id) })),
  clearExpired: () => set(s => ({ drops: s.drops.filter(d => !isLootExpired(d)) })),
}));

function onEnemyKilled(enemy: EnemyData) {
  const drops = rollLootDrops(enemy);
  if (drops.length > 0) {
    useLootDrops.getState().addDrops(drops);
  }

  const campaign = useCampaign.getState();
  if (campaign.active) {
    // Track every kill for stats + the "defend" quest objective.
    campaign.addKills(1);
    if (enemy.tier === "boss") {
      campaign.defeatBoss(campaign.currentIslandId);
    }
  }
}

interface LootDropsRendererProps {
  playerPosition: THREE.Vector3;
}

registerEnemyDeathCallback(onEnemyKilled);

const POTION_COLORS: Record<string, string> = {
  potion_health_minor: "#cc2222",
  potion_health: "#ee3333",
  potion_health_greater: "#ff1111",
  potion_health_supreme: "#ff0044",
  potion_mana_minor: "#2244cc",
  potion_mana: "#3355ee",
  potion_stamina_minor: "#22aa44",
  potion_strength: "#ee7722",
  potion_speed: "#cccc22",
  potion_elixir: "#9933cc",
};

export default function LootDropsRenderer({ playerPosition }: LootDropsRendererProps) {
  const drops = useLootDrops(s => s.drops);
  const cleanupTimer = useRef(0);
  const pickupCooldown = useRef(0);

  useFrame((_, delta) => {
    cleanupTimer.current += delta;
    if (cleanupTimer.current > 5) {
      cleanupTimer.current = 0;
      useLootDrops.getState().clearExpired();
    }

    pickupCooldown.current -= delta;
    if (pickupCooldown.current > 0) return;

    const currentDrops = useLootDrops.getState().drops;
    for (const drop of currentDrops) {
      if (shouldPickupLoot(drop, playerPosition.x, playerPosition.z)) {
        collectLoot(drop);
        useLootDrops.getState().removeDrop(drop.id);
        pickupCooldown.current = 0.1;
        break;
      }
    }
  });

  return (
    <>
      {drops.map(drop => (
        <Suspense key={drop.id} fallback={<FallbackLootMesh drop={drop} />}>
          {drop.type === "potion" ? (
            <PotionDropMesh drop={drop} />
          ) : (
            <LootDropMesh drop={drop} />
          )}
        </Suspense>
      ))}
    </>
  );
}

function PotionDropMesh({ drop }: { drop: DroppedLoot }) {
  const meshRef = useRef<THREE.Group>(null);
  const startY = drop.position[1];
  const { scene } = useAsset(ITEM_MODELS.potion.path);

  const potionColor = POTION_COLORS[drop.itemId] || "#cc2222";

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        mat.color = new THREE.Color(potionColor);
        mat.emissive = new THREE.Color(potionColor);
        mat.emissiveIntensity = 0.4;
        mat.transparent = true;
        mat.opacity = 0.85;
        mesh.material = mat;
        mesh.castShadow = true;
      }
    });
    clone.scale.setScalar(ITEM_MODELS.potion.defaultScale);
    return clone;
  }, [scene, potionColor]);

  useFrame(() => {
    if (!meshRef.current) return;
    const t = (Date.now() - drop.spawnTime) * 0.002;
    meshRef.current.position.y = startY + Math.sin(t) * 0.15 + 0.3;
    meshRef.current.rotation.y += 0.02;
  });

  return (
    <group ref={meshRef} position={drop.position}>
      <primitive object={clonedScene} />
      <pointLight color={potionColor} intensity={1.5} distance={4} />
      <sprite scale={[0.6, 0.6, 1]} position={[0, 0.4, 0]}>
        <spriteMaterial color={potionColor} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  );
}

function LootDropMesh({ drop }: { drop: DroppedLoot }) {
  const meshRef = useRef<THREE.Group>(null);
  const startY = drop.position[1];

  const color = useMemo(() => {
    switch (drop.type) {
      case "gold": return "#ffcc00";
      case "material": return "#88aacc";
      case "food": return "#44cc44";
      case "equipment": return "#cc44ff";
      default: return "#ffffff";
    }
  }, [drop.type]);

  useFrame(() => {
    if (!meshRef.current) return;
    const t = (Date.now() - drop.spawnTime) * 0.002;
    meshRef.current.position.y = startY + Math.sin(t) * 0.15 + 0.3;
    meshRef.current.rotation.y += 0.02;
  });

  return (
    <group ref={meshRef} position={drop.position}>
      <mesh castShadow>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      <pointLight color={color} intensity={0.5} distance={3} />
    </group>
  );
}

function FallbackLootMesh({ drop }: { drop: DroppedLoot }) {
  const meshRef = useRef<THREE.Group>(null);
  const startY = drop.position[1];
  const color = drop.type === "potion" ? (POTION_COLORS[drop.itemId] || "#cc2222") : "#ffffff";

  useFrame(() => {
    if (!meshRef.current) return;
    const t = (Date.now() - drop.spawnTime) * 0.002;
    meshRef.current.position.y = startY + Math.sin(t) * 0.15 + 0.3;
    meshRef.current.rotation.y += 0.02;
  });

  return (
    <group ref={meshRef} position={drop.position}>
      <mesh castShadow>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.7} />
      </mesh>
      <pointLight color={color} intensity={0.3} distance={2} />
    </group>
  );
}
