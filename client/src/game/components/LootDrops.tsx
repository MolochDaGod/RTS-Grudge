import { useRef, useMemo, useEffect, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { create } from "zustand";
import * as THREE from "three";
import { DroppedLoot, rollLootDrops, collectLoot, shouldPickupLoot, isLootExpired } from "../systems/LootSystem";
import { registerEnemyDeathCallback, type EnemyData } from "../systems/EnemyManager";
import { ITEM_MODELS, getLootModelKey } from "../systems/ModelRegistry";
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
      // Magnetic pull: items within 5m drift toward the player
      const dx = playerPosition.x - drop.position[0];
      const dz = playerPosition.z - drop.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 5.0 && dist > 0.1) {
        const pull = Math.min(4.0 * delta / dist, 0.5);
        drop.position[0] += dx * pull;
        drop.position[2] += dz * pull;
      }

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

/** Rarity glow color based on loot type + itemId keywords. */
function getRarityColor(type: string, itemId: string): string {
  if (itemId.includes("legendary") || itemId.includes("artifact")) return "#ffaa00";
  if (itemId.includes("rare") || itemId.includes("crystal") || type === "equipment") return "#aa44ff";
  if (type === "gold") return "#ffcc00";
  if (type === "material") return "#44aaff";
  if (type === "food") return "#44cc44";
  return "#ffffff";
}

function LootGLBModel({ modelDef }: { modelDef: { path: string; defaultScale: number } }) {
  const { scene } = useAsset(modelDef.path);
  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    clone.scale.setScalar(modelDef.defaultScale);
    clone.traverse(child => {
      if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).castShadow = true;
    });
    return clone;
  }, [scene, modelDef.defaultScale]);
  return <primitive object={cloned} />;
}

function LootDropMesh({ drop }: { drop: DroppedLoot }) {
  const meshRef = useRef<THREE.Group>(null);
  const startY = drop.position[1];
  const modelKey = getLootModelKey(drop.type, drop.itemId);
  const modelDef = ITEM_MODELS[modelKey];
  const rarityColor = getRarityColor(drop.type, drop.itemId);

  useFrame(() => {
    if (!meshRef.current) return;
    const t = (Date.now() - drop.spawnTime) * 0.002;
    meshRef.current.position.set(drop.position[0], startY + Math.sin(t) * 0.15 + 0.3, drop.position[2]);
    meshRef.current.rotation.y += 0.02;
  });

  return (
    <group ref={meshRef} position={drop.position}>
      {modelDef ? (
        <Suspense fallback={
          <mesh castShadow>
            <boxGeometry args={[0.15, 0.15, 0.15]} />
            <meshStandardMaterial color={rarityColor} emissive={rarityColor} emissiveIntensity={0.5} />
          </mesh>
        }>
          <LootGLBModel modelDef={modelDef} />
        </Suspense>
      ) : (
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color={rarityColor} emissive={rarityColor} emissiveIntensity={0.5} />
        </mesh>
      )}
      <pointLight color={rarityColor} intensity={0.8} distance={4} />
      {/* Rarity aura glow */}
      <sprite scale={[0.5, 0.5, 1]} position={[0, 0.1, 0]}>
        <spriteMaterial color={rarityColor} transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
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
