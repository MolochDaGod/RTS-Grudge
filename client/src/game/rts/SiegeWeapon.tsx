/**
 * SiegeWeapon — stationary catapult / ballista that fires RockProjectile
 * at the nearest enemy in range. Built from the Engineer workshop or
 * an RTS barracks building. Fires slower than towers but deals AoE splash.
 */

import { useRef, useMemo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useEnemyManager } from "../systems/EnemyManager";
import { RockProjectile } from "../effects/SpellProjectiles";

interface SiegeWeaponProps {
  position: [number, number, number];
  type?: "catapult" | "ballista";
  aggroRange?: number;
  fireCooldown?: number;
  damage?: number;
}

interface ActiveRock {
  id: number;
  position: [number, number, number];
  direction: [number, number, number];
  active: boolean;
}

let rockIdCounter = 0;

export default function SiegeWeapon({
  position,
  type = "catapult",
  aggroRange = 40,
  fireCooldown = 4.0,
  damage = 25,
}: SiegeWeaponProps) {
  const cooldownRef = useRef(0);
  const rocksRef = useRef<ActiveRock[]>([]);
  const isBallista = type === "ballista";
  const launchHeight = isBallista ? 1.5 : 2.5;

  useFrame((_, delta) => {
    cooldownRef.current = Math.max(0, cooldownRef.current - delta);
    if (cooldownRef.current > 0) return;

    const enemies = useEnemyManager.getState().enemies;
    const pos = new THREE.Vector3(position[0], position[1], position[2]);

    let nearest: (typeof enemies)[0] | null = null;
    let nearestDist = aggroRange;
    for (const enemy of enemies) {
      if (enemy.isDying) continue;
      const dist = pos.distanceTo(enemy.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }
    if (!nearest) return;

    const launchPos: [number, number, number] = [
      position[0], position[1] + launchHeight, position[2],
    ];
    const dir = new THREE.Vector3()
      .subVectors(nearest.position, new THREE.Vector3(...launchPos))
      .normalize();
    // Catapult lobs with arc; ballista fires flat
    if (!isBallista) dir.y = Math.max(dir.y, 0.35);

    const newDir: [number, number, number] = [dir.x, dir.y, dir.z];
    rocksRef.current = [
      ...rocksRef.current.filter((r) => r.active),
      { id: rockIdCounter++, position: launchPos, direction: newDir, active: true },
    ].slice(-4);
    cooldownRef.current = fireCooldown;
  });

  return (
    <group position={position}>
      {/* Siege weapon body — procedural placeholder */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[isBallista ? 1.5 : 2.0, 1.2, isBallista ? 3.0 : 2.0]} />
        <meshStandardMaterial color={isBallista ? "#5a5a5a" : "#6b4226"} roughness={0.9} />
      </mesh>
      {/* Arm / barrel */}
      <mesh
        position={[0, isBallista ? 1.2 : 1.8, isBallista ? 0.8 : 0]}
        rotation={isBallista ? [0.3, 0, 0] : [-0.6, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.08, 0.12, isBallista ? 2.5 : 1.8, 6]} />
        <meshStandardMaterial color="#4a3218" roughness={0.95} />
      </mesh>

      {/* Range ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[aggroRange - 0.3, aggroRange, 48]} />
        <meshBasicMaterial color="#ff8844" transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>

      {/* Active projectiles */}
      {rocksRef.current.map((rock) => (
        <RockProjectile
          key={rock.id}
          position={rock.position}
          direction={rock.direction}
          active={rock.active}
          team="player"
          damage={damage}
        />
      ))}
    </group>
  );
}
