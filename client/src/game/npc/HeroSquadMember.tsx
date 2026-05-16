/**
 * HeroSquadMember — lightweight R3F ally for hero adventure camps.
 *
 * Intentionally uses plain THREE geometry (capsule + sphere) rather than
 * GLB models. Loading 24 × 3 = 72 full character models would be expensive;
 * coloured capsules give immediate visual feedback at near-zero cost while
 * still participating in combat.
 *
 * Behaviour loop (useFrame, simplified from AllyNPC.tsx):
 *   1. If an enemy is within detection range → enter combat
 *   2. Combat: close to attack range, face target, strike on cooldown
 *   3. No enemies → patrol in a loose circle around the hero's camp
 *
 * Squad cap: FactionHeroNPC renders at most 3 HeroSquadMember instances per
 * hero (hero + 3 = 4 total agents per camp, per the design spec).
 *
 * HP: tracked as a ref — it's ephemeral. Squad members that reach 0 HP
 * disappear for the rest of the session and respawn when the hero mounts again.
 */

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getTerrainHeight, globalHeightData } from "../components/Terrain";
import { KinematicCharacterBody } from "../components/KinematicCharacterBody";
import { COLLISION_MASKS } from "../components/BuildingColliders";
import { useEnemyManager } from "../systems/EnemyManager";
import { useFactionHeroes } from "@/lib/stores/useFactionHeroes";

// ─────────────────────────────────────────────────────────────────────────────

export interface SquadMemberConfig {
  /** Display label shown in the coloured band. */
  role:   string;
  /** Hex colour for body mesh and head dot. */
  color:  string;
  /** Cap height multiplier (affects visual presence). */
  size:   number;
  hp:     number;
  damage: number;
  /** Distance at which the squad member starts attacking. */
  attackRange: number;
  speed:  number;
}

interface HeroSquadMemberProps {
  heroId:      string;
  memberIndex: number;  // 0-2
  config:      SquadMemberConfig;
  factionColor: string;
}

// ─────────────────────────────────────────────────────────────────────────────

const _tmp = new THREE.Vector3();

export default function HeroSquadMember({
  heroId, memberIndex, config, factionColor,
}: HeroSquadMemberProps) {
  const groupRef        = useRef<THREE.Group>(null);
  const localPos        = useRef(new THREE.Vector3());
  const velocity        = useRef(new THREE.Vector3());
  const wanderTarget    = useRef(new THREE.Vector3());
  const wanderTimer     = useRef(Math.random() * 4 + 2);
  const attackCooldown  = useRef(Math.random() * 1.5 + 1.0);
  const alive           = useRef(true);
  const hp              = useRef(config.hp);
  const lastTurnAngle   = useRef(0);

  // Spawn near the hero's camp with angular offset so members don't stack.
  useEffect(() => {
    const heroState = useFactionHeroes.getState().heroes.get(heroId);
    const camp = heroState?.campPosition;
    const base = camp ?? new THREE.Vector3(0, 0, 0);
    const angle = (memberIndex / 3) * Math.PI * 2 + Math.random() * 0.5;
    const dist  = 3 + memberIndex * 2;
    localPos.current.set(
      base.x + Math.cos(angle) * dist,
      getTerrainHeight(base.x + Math.cos(angle) * dist, base.z + Math.sin(angle) * dist, globalHeightData),
      base.z + Math.sin(angle) * dist,
    );
    wanderTarget.current.copy(localPos.current);
  }, [heroId, memberIndex]);

  useFrame((_, delta) => {
    if (!groupRef.current || !alive.current) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    const dt = Math.min(delta, 0.05);
    attackCooldown.current = Math.max(0, attackCooldown.current - dt);

    const heroState = useFactionHeroes.getState().heroes.get(heroId);
    const campPos = heroState?.campPosition ?? localPos.current.clone();
    const enemies = useEnemyManager.getState().enemies;

    // ── Find nearest enemy in detection range ─────────────────────────────
    let nearest: (typeof enemies)[0] | null = null;
    let nearestDist = config.attackRange + 14;
    for (const e of enemies) {
      if (e.isDying) continue;
      const d = localPos.current.distanceTo(e.position);
      if (d < nearestDist) { nearest = e; nearestDist = d; }
    }

    if (nearest) {
      // ── COMBAT ─────────────────────────────────────────────────────────
      if (nearestDist > config.attackRange) {
        // Close the gap
        _tmp.subVectors(nearest.position, localPos.current).setY(0).normalize();
        velocity.current.lerp(_tmp.multiplyScalar(config.speed), 0.25);
        localPos.current.addScaledVector(velocity.current, dt);
        localPos.current.y = getTerrainHeight(localPos.current.x, localPos.current.z, globalHeightData);
      } else {
        // At range — strike
        velocity.current.multiplyScalar(0.85);
        _tmp.subVectors(nearest.position, localPos.current).setY(0).normalize();
        const faceAngle = Math.atan2(_tmp.x, _tmp.z);
        lastTurnAngle.current += (faceAngle - lastTurnAngle.current) * (1 - Math.exp(-12 * dt));
        if (attackCooldown.current <= 0) {
          attackCooldown.current = 1.3 + Math.random() * 0.6;
          useEnemyManager.getState().damageEnemy(nearest.id, config.damage);
        }
      }
    } else {
      // ── PATROL ─────────────────────────────────────────────────────────
      wanderTimer.current -= dt;
      if (wanderTimer.current <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const dist  = 3 + Math.random() * 8;
        wanderTarget.current.set(
          campPos.x + Math.cos(angle) * dist,
          0,
          campPos.z + Math.sin(angle) * dist,
        );
        wanderTimer.current = 3 + Math.random() * 5;
      }
      _tmp.subVectors(wanderTarget.current, localPos.current).setY(0);
      if (_tmp.length() > 1.0) {
        _tmp.normalize();
        velocity.current.lerp(_tmp.multiplyScalar(config.speed * 0.35), 0.15);
        localPos.current.addScaledVector(velocity.current, dt);
        localPos.current.y = getTerrainHeight(localPos.current.x, localPos.current.z, globalHeightData);
        const angle = Math.atan2(velocity.current.x, velocity.current.z);
        lastTurnAngle.current += (angle - lastTurnAngle.current) * (1 - Math.exp(-8 * dt));
      } else {
        velocity.current.multiplyScalar(0.9);
      }
    }

    groupRef.current.position.copy(localPos.current);
    groupRef.current.rotation.y = lastTurnAngle.current;
  });

  const s = config.size;
  // Capsule approximation for Rapier: height = body trunk, radius = width.
  const physBounds = { height: 0.7 * s, radiusXZ: 0.18 * s };
  return (
    <>
      <KinematicCharacterBody
        positionRef={localPos}
        bounds={physBounds}
        active={alive.current}
        collisionGroups={COLLISION_MASKS.ALLY}
      />
      <group ref={groupRef}>
      {/* Body capsule */}
      <mesh position={[0, 0.55 * s, 0]}>
        <capsuleGeometry args={[0.18 * s, 0.7 * s, 4, 8]} />
        <meshStandardMaterial color={config.color} roughness={0.7} metalness={0.1} />
      </mesh>
      {/* Faction-coloured head dot */}
      <mesh position={[0, 1.05 * s, 0]}>
        <sphereGeometry args={[0.15 * s, 7, 7]} />
        <meshBasicMaterial color={factionColor} />
      </mesh>
      {/* Thin role stripe */}
      <sprite position={[0, 1.35 * s, 0]} scale={[0.7, 0.12, 1]}>
        <spriteMaterial color={config.color} opacity={0.6} transparent />
      </sprite>
    </group>
    </>
  );
}
