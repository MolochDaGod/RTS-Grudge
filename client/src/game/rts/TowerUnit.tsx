/**
 * TowerUnit — defensive archery tower that fires ArrowProjectile at enemies.
 *
 * Loads the Archery Tower GLB, places an archer NPC inside at the
 * battlement height, and auto-fires arrows at the nearest enemy within
 * aggro range. Uses the existing projectile team system (team="player").
 *
 * Props:
 *   position   — world position [x, y, z]
 *   aggroRange — detection radius in world units (default 30)
 *   fireCooldown — seconds between shots (default 2.0)
 *   damage     — per-arrow damage (default 12)
 *   arrowModelId — optional arrow model id from ModelRegistry
 */

import { useRef, useMemo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAsset } from "../hooks/useAsset";
import { useEnemyManager } from "../systems/EnemyManager";
import { ArrowProjectile } from "../effects/SpellProjectiles";

const TOWER_MODEL_PATH = "/models/rts/Archery Towers.glb";
const ARCHER_HEIGHT_OFFSET = 5.5; // how high above base the archer sits

interface TowerUnitProps {
  position: [number, number, number];
  aggroRange?: number;
  fireCooldown?: number;
  damage?: number;
  arrowModelId?: string | null;
}

interface ActiveArrow {
  id: number;
  position: [number, number, number];
  direction: [number, number, number];
  active: boolean;
}

let arrowIdCounter = 0;

export default function TowerUnit({
  position,
  aggroRange = 30,
  fireCooldown = 2.0,
  damage = 12,
  arrowModelId = null,
}: TowerUnitProps) {
  return (
    <Suspense fallback={null}>
      <TowerUnitInner
        position={position}
        aggroRange={aggroRange}
        fireCooldown={fireCooldown}
        damage={damage}
        arrowModelId={arrowModelId}
      />
    </Suspense>
  );
}

function TowerUnitInner({
  position,
  aggroRange,
  fireCooldown,
  damage,
  arrowModelId,
}: Required<Omit<TowerUnitProps, "arrowModelId">> & { arrowModelId: string | null }) {
  const gltf = useAsset(TOWER_MODEL_PATH);
  const cooldownRef = useRef(0);
  const arrowsRef = useRef<ActiveArrow[]>([]);

  const towerModel = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).castShadow = true;
        (child as THREE.Mesh).receiveShadow = true;
      }
    });
    // Normalize tower height
    const box = new THREE.Box3().setFromObject(clone);
    const height = box.max.y - box.min.y;
    if (height > 0) {
      const targetH = 8;
      clone.scale.setScalar(targetH / height);
    }
    return clone;
  }, [gltf]);

  // Archer visual — simple box placeholder positioned at battlement
  const archerPos: [number, number, number] = [
    position[0],
    position[1] + ARCHER_HEIGHT_OFFSET,
    position[2],
  ];

  useFrame((_, delta) => {
    cooldownRef.current = Math.max(0, cooldownRef.current - delta);
    if (cooldownRef.current > 0) return;

    const enemies = useEnemyManager.getState().enemies;
    const towerPos = new THREE.Vector3(position[0], position[1], position[2]);

    // Find nearest enemy in range
    let nearest: (typeof enemies)[0] | null = null;
    let nearestDist = aggroRange;
    for (const enemy of enemies) {
      if (enemy.isDying) continue;
      const dist = towerPos.distanceTo(enemy.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }

    if (!nearest) return;

    // Fire arrow toward enemy
    const dir = new THREE.Vector3()
      .subVectors(nearest.position, new THREE.Vector3(...archerPos))
      .normalize();

    const newArrow: ActiveArrow = {
      id: arrowIdCounter++,
      position: [...archerPos],
      direction: [dir.x, dir.y, dir.z],
      active: true,
    };
    arrowsRef.current = [...arrowsRef.current.filter((a) => a.active), newArrow].slice(-8);
    cooldownRef.current = fireCooldown;
  });

  return (
    <group position={position}>
      <primitive object={towerModel} />

      {/* Archer placeholder at battlement height */}
      <mesh position={[0, ARCHER_HEIGHT_OFFSET, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.8, 4, 8]} />
        <meshStandardMaterial color="#8B6914" />
      </mesh>

      {/* Range indicator ring (visible in build mode) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[aggroRange - 0.3, aggroRange, 48]} />
        <meshBasicMaterial color="#44ff44" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>

      {/* Active arrows */}
      {arrowsRef.current.map((arrow) => (
        <ArrowProjectile
          key={arrow.id}
          position={arrow.position}
          direction={arrow.direction}
          active={arrow.active}
          team="player"
          damage={damage}
          arrowModelId={arrowModelId}
        />
      ))}
    </group>
  );
}
