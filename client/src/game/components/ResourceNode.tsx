import { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useInventory } from "@/lib/stores/useInventory";
import { useHarvest } from "@/lib/stores/useHarvest";
import { useCampaign } from "@/lib/stores/useCampaign";
import { getTerrainHeight, globalHeightData } from "./Terrain";

interface ResourceNodeProps {
  playerPosition: THREE.Vector3;
}

export type ResourceType = "wood" | "stone" | "fiber" | "iron_ore" | "raw_meat" | "berry" | "herb" | "gold_ore" | "crystal";

export interface ResourceInstance {
  position: [number, number, number];
  type: ResourceType;
  respawnTime: number;
  harvested: boolean;
  harvestTimer: number;
  scale: number;
  spawnedBy?: string;
}

export const globalResourceRegistry: { nodes: ResourceInstance[] } = { nodes: [] };

export function getResourceNodesNear(center: THREE.Vector3, radius: number, onlyAvailable = true): { index: number; node: ResourceInstance; dist: number }[] {
  const results: { index: number; node: ResourceInstance; dist: number }[] = [];
  const r2 = radius * radius;
  for (let i = 0; i < globalResourceRegistry.nodes.length; i++) {
    const node = globalResourceRegistry.nodes[i];
    if (onlyAvailable && node.harvested) continue;
    const dx = node.position[0] - center.x;
    const dz = node.position[2] - center.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < r2) {
      results.push({ index: i, node, dist: Math.sqrt(d2) });
    }
  }
  results.sort((a, b) => a.dist - b.dist);
  return results;
}

export function harvestNodeByIndex(index: number): { type: ResourceType; qty: number } | null {
  const node = globalResourceRegistry.nodes[index];
  if (!node || node.harvested) return null;
  node.harvested = true;
  node.harvestTimer = node.respawnTime;
  const yields = RESOURCE_YIELDS[node.type] || { min: 1, max: 1 };
  const qty = yields.min + Math.floor(Math.random() * (yields.max - yields.min + 1));
  return { type: node.type, qty };
}

export function addBuildingResources(buildingUid: string, center: [number, number, number], resources: { type: ResourceType; count: number }[]) {
  for (const res of resources) {
    for (let i = 0; i < res.count; i++) {
      const angle = (i / res.count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 4 + Math.random() * 6;
      const x = center[0] + Math.cos(angle) * dist;
      const z = center[2] + Math.sin(angle) * dist;
      const h = getTerrainHeight(x, z, globalHeightData);
      globalResourceRegistry.nodes.push({
        position: [x, Math.max(h + 0.3, 0.5), z],
        type: res.type,
        respawnTime: 15 + Math.random() * 10,
        harvested: false,
        harvestTimer: 0,
        scale: 0.7 + Math.random() * 0.4,
        spawnedBy: buildingUid,
      });
    }
  }
}

export function removeBuildingResources(buildingUid: string) {
  globalResourceRegistry.nodes = globalResourceRegistry.nodes.filter(n => n.spawnedBy !== buildingUid);
}

const RESOURCE_COLORS: Record<ResourceType, string> = {
  wood: "#8B4513",
  stone: "#888",
  fiber: "#7cba3f",
  iron_ore: "#8a6030",
  raw_meat: "#cc4444",
  berry: "#9933cc",
  herb: "#33aa55",
  gold_ore: "#ccaa33",
  crystal: "#66aaff",
};

const RESOURCE_ICONS: Record<ResourceType, string> = {
  wood: "🪵",
  stone: "🪨",
  fiber: "🌿",
  iron_ore: "⛏️",
  raw_meat: "🥩",
  berry: "🫐",
  herb: "🌱",
  gold_ore: "🥇",
  crystal: "💎",
};

const HARVEST_ANIMATIONS: Record<ResourceType, string> = {
  wood: "attack",
  stone: "attack2",
  iron_ore: "attack2",
  gold_ore: "attack2",
  fiber: "pickup",
  raw_meat: "pickup",
  berry: "pickup",
  herb: "pickup",
  crystal: "attack",
};

const HARVEST_DURATIONS: Record<ResourceType, number> = {
  wood: 1.2,
  stone: 1.5,
  iron_ore: 1.8,
  gold_ore: 2.2,
  fiber: 0.8,
  raw_meat: 0.8,
  berry: 0.6,
  herb: 0.7,
  crystal: 2.0,
};

const RESOURCE_YIELDS: Record<ResourceType, { min: number; max: number }> = {
  wood: { min: 1, max: 3 },
  stone: { min: 1, max: 2 },
  fiber: { min: 2, max: 4 },
  iron_ore: { min: 1, max: 2 },
  gold_ore: { min: 1, max: 1 },
  raw_meat: { min: 1, max: 2 },
  berry: { min: 2, max: 5 },
  herb: { min: 1, max: 3 },
  crystal: { min: 1, max: 1 },
};

// Shared "interact / harvest" trigger flag. Set true by either:
//   - F key (any mode — keeps the existing "F to interact" muscle memory)
//   - LMB while in harvest mode (see Player.tsx handleMouseDown)
// The nearest in-range ResourceNodeMesh consumes it on the next frame.
export const globalHarvestTriggerRef = { current: false };

export default function ResourceNodes({ playerPosition }: ResourceNodeProps) {
  const resourcesRef = useRef<ResourceInstance[]>([]);
  const initialized = useRef(false);
  const [nodeCount, setNodeCount] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Suppress while pushing a beached boat — F there toggles
      // attach/release on the boat and must not double-fire as a
      // harvest interaction.
      if (e.code === "KeyF" && !(window as any).__boatAttached) {
        globalHarvestTriggerRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "KeyF") globalHarvestTriggerRef.current = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  if (!initialized.current) {
    const nodes: ResourceInstance[] = [];
    const rng = (seed: number) => {
      let s = seed;
      return () => {
        s = (s * 48271 + 0) % 2147483647;
        return s / 2147483647;
      };
    };
    const rand = rng(123);
    const types: ResourceType[] = ["wood", "stone", "fiber", "iron_ore", "raw_meat", "berry", "herb", "gold_ore", "crystal"];

    for (let i = 0; i < 150; i++) {
      const x = (rand() - 0.5) * 180;
      const z = (rand() - 0.5) * 180;
      if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;
      const h = getTerrainHeight(x, z, globalHeightData);
      if (h < 0.2) continue;

      const typeIndex = Math.floor(rand() * types.length);
      const type = types[typeIndex];

      let scale = 0.8 + rand() * 0.5;
      if (type === "wood") scale = 1.0 + rand() * 0.8;
      if (type === "crystal" || type === "gold_ore") scale = 0.6 + rand() * 0.3;

      nodes.push({
        position: [x, h + 0.3, z],
        type,
        respawnTime: 20 + rand() * 15,
        harvested: false,
        harvestTimer: 0,
        scale,
      });
    }
    resourcesRef.current = nodes;
    globalResourceRegistry.nodes = nodes;
    setNodeCount(nodes.length);
    initialized.current = true;
  }

  useFrame((_, delta) => {
    if (resourcesRef.current.length !== globalResourceRegistry.nodes.length) {
      resourcesRef.current = globalResourceRegistry.nodes;
      setNodeCount(globalResourceRegistry.nodes.length);
    }
    for (const node of globalResourceRegistry.nodes) {
      if (node.harvested) {
        node.harvestTimer -= delta;
        if (node.harvestTimer <= 0) {
          node.harvested = false;
          node.harvestTimer = 0;
        }
      }
    }
  });

  const harvest = useCallback((index: number) => {
    const node = resourcesRef.current[index];
    if (!node || node.harvested) return;

    const { isHarvesting, startHarvest } = useHarvest.getState();
    if (isHarvesting) return;

    const anim = HARVEST_ANIMATIONS[node.type] || "pickup";
    const duration = HARVEST_DURATIONS[node.type] || 1.0;

    startHarvest(anim, duration, () => {
      const n = resourcesRef.current[index];
      if (!n || n.harvested) return;

      n.harvested = true;
      n.harvestTimer = n.respawnTime;

      const yields = RESOURCE_YIELDS[n.type] || { min: 1, max: 1 };
      const qty = yields.min + Math.floor(Math.random() * (yields.max - yields.min + 1));

      useInventory.getState().addItem({
        id: n.type,
        name: n.type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        type: n.type === "raw_meat" || n.type === "berry" ? "food" : "material",
        healAmount: n.type === "berry" ? 8 : n.type === "raw_meat" ? 5 : n.type === "herb" ? 12 : undefined,
        icon: RESOURCE_ICONS[n.type],
        quantity: qty,
      });

      // Advance any active "gather" quest by the harvested quantity.
      useCampaign.getState().recordGather(qty);
    });
  }, []);

  return (
    <>
      {Array.from({ length: nodeCount }, (_, i) => (
        <ResourceNodeMesh
          key={`rn_${i}`}
          index={i}
          resourcesRef={resourcesRef}
          playerPosition={playerPosition}
          onHarvest={harvest}
        />
      ))}
    </>
  );
}

function ResourceNodeMesh({
  index,
  resourcesRef,
  playerPosition,
  onHarvest,
}: {
  index: number;
  resourcesRef: React.MutableRefObject<ResourceInstance[]>;
  playerPosition: THREE.Vector3;
  onHarvest: (index: number) => void;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const tempVec = useRef(new THREE.Vector3());
  const node = resourcesRef.current[index];

  useFrame(() => {
    if (!meshRef.current) return;
    const n = resourcesRef.current[index];
    if (!n) { meshRef.current.visible = false; return; }
    meshRef.current.visible = !n.harvested;

    if (!n.harvested) {
      const dist = tempVec.current.set(n.position[0], n.position[1], n.position[2]).distanceTo(playerPosition);
      if (dist < 3.5) {
        meshRef.current.position.y = n.position[1] + Math.sin(Date.now() * 0.003) * 0.1;
        if (globalHarvestTriggerRef.current) {
          globalHarvestTriggerRef.current = false;
          onHarvest(index);
        }
      } else {
        meshRef.current.position.y = n.position[1];
      }
    }
  });

  if (!node) return null;
  const color = RESOURCE_COLORS[node.type];

  return (
    <group
      ref={meshRef}
      position={node.position}
      scale={[node.scale, node.scale, node.scale]}
      onClick={(e) => {
        e.stopPropagation();
        const n = resourcesRef.current[index];
        if (!n) return;
        const dist = tempVec.current.set(n.position[0], n.position[1], n.position[2]).distanceTo(playerPosition);
        if (dist < 3.5) onHarvest(index);
      }}
    >
      <ResourceVisual type={node.type} color={color} />
    </group>
  );
}

function ResourceVisual({ type, color }: { type: ResourceType; color: string }) {
  switch (type) {
    case "wood":
      return (
        <group>
          <mesh castShadow position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 0.8, 8]} />
            <meshStandardMaterial color="#5a3a1a" />
          </mesh>
          <mesh castShadow position={[0, 1.0, 0]}>
            <coneGeometry args={[0.5, 1.0, 8]} />
            <meshStandardMaterial color="#2d6b1e" />
          </mesh>
          <mesh castShadow position={[0, 1.6, 0]}>
            <coneGeometry args={[0.35, 0.7, 8]} />
            <meshStandardMaterial color="#3a8a2a" />
          </mesh>
        </group>
      );
    case "stone":
      return (
        <group>
          <mesh castShadow position={[0, 0.2, 0]} rotation={[0.2, 0.3, 0]}>
            <dodecahedronGeometry args={[0.35, 0]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0.25, 0.12, 0.15]} rotation={[0, 0.5, 0]}>
            <dodecahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial color="#777" roughness={0.9} />
          </mesh>
        </group>
      );
    case "iron_ore":
      return (
        <group>
          <mesh castShadow position={[0, 0.2, 0]} rotation={[0.1, 0.2, 0]}>
            <octahedronGeometry args={[0.3, 0]} />
            <meshStandardMaterial color={color} roughness={0.7} metalness={0.5} />
          </mesh>
          <mesh castShadow position={[0.2, 0.25, 0.1]}>
            <octahedronGeometry args={[0.15, 0]} />
            <meshStandardMaterial color="#aa7733" roughness={0.6} metalness={0.6} />
          </mesh>
        </group>
      );
    case "gold_ore":
      return (
        <group>
          <mesh castShadow position={[0, 0.2, 0]}>
            <octahedronGeometry args={[0.25, 0]} />
            <meshStandardMaterial color="#ddaa22" roughness={0.4} metalness={0.8} />
          </mesh>
          <mesh castShadow position={[-0.15, 0.3, 0.1]}>
            <octahedronGeometry args={[0.12, 0]} />
            <meshStandardMaterial color="#ffcc33" roughness={0.3} metalness={0.9} />
          </mesh>
        </group>
      );
    case "crystal":
      return (
        <group>
          <mesh castShadow position={[0, 0.3, 0]} rotation={[0, 0, 0.1]}>
            <cylinderGeometry args={[0.05, 0.12, 0.6, 6]} />
            <meshStandardMaterial color="#66aaff" roughness={0.1} metalness={0.3} transparent opacity={0.8} />
          </mesh>
          <mesh castShadow position={[0.15, 0.2, 0.1]} rotation={[0.2, 0, -0.2]}>
            <cylinderGeometry args={[0.03, 0.08, 0.4, 6]} />
            <meshStandardMaterial color="#88ccff" roughness={0.1} metalness={0.3} transparent opacity={0.8} />
          </mesh>
          <mesh castShadow position={[-0.1, 0.15, -0.05]} rotation={[-0.1, 0, 0.3]}>
            <cylinderGeometry args={[0.04, 0.1, 0.5, 6]} />
            <meshStandardMaterial color="#5599ee" roughness={0.1} metalness={0.3} transparent opacity={0.8} />
          </mesh>
        </group>
      );
    case "fiber":
      return (
        <group>
          <mesh castShadow position={[0, 0.2, 0]}>
            <coneGeometry args={[0.2, 0.5, 5]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh castShadow position={[0.15, 0.15, 0.1]}>
            <coneGeometry args={[0.15, 0.35, 4]} />
            <meshStandardMaterial color="#6aaa33" />
          </mesh>
        </group>
      );
    case "herb":
      return (
        <group>
          <mesh castShadow position={[0, 0.1, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color="#44aa44" />
          </mesh>
          <mesh castShadow position={[0, 0.25, 0]}>
            <coneGeometry args={[0.1, 0.2, 5]} />
            <meshStandardMaterial color="#55cc55" />
          </mesh>
          <mesh castShadow position={[0.1, 0.12, 0.08]}>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshStandardMaterial color="#ffee44" emissive="#ffee44" emissiveIntensity={0.3} />
          </mesh>
        </group>
      );
    case "berry":
      return (
        <group>
          <mesh castShadow position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#7722aa" />
          </mesh>
          <mesh castShadow position={[0.1, 0.12, 0.05]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color="#9933cc" />
          </mesh>
          <mesh castShadow position={[-0.08, 0.1, 0.08]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial color="#8833bb" />
          </mesh>
          <mesh castShadow position={[0, 0.3, 0]}>
            <coneGeometry args={[0.15, 0.3, 5]} />
            <meshStandardMaterial color="#55aa33" />
          </mesh>
        </group>
      );
    case "raw_meat":
      return (
        <group>
          <mesh castShadow position={[0, 0.1, 0]} rotation={[Math.PI / 6, 0, 0]}>
            <sphereGeometry args={[0.2, 8, 6]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh castShadow position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.35, 6]} />
            <meshStandardMaterial color="#ddddcc" />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh castShadow>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
  }
}
