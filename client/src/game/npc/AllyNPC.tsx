import { useRef, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { type AnimationState } from "../hooks/useCharacterModel";
import { useCharacterController } from "../controllers/useCharacterController";
import { getTerrainHeight, globalHeightData } from "../components/Terrain";
import { KinematicCharacterBody } from "../components/KinematicCharacterBody";
import { COLLISION_MASKS } from "../components/BuildingColliders";
import { useAllies, type AllyData, type AllyBehavior } from "@/lib/stores/useAllies";
import { useEnemyManager } from "../systems/EnemyManager";
import { useInventory } from "@/lib/stores/useInventory";
import { useGame } from "@/lib/stores/useGame";
import {
  getResourceNodesNear,
  harvestNodeByIndex,
  type ResourceType,
} from "../components/ResourceNode";

const RESOURCE_ICONS: Record<string, string> = {
  wood: "🪵", stone: "🪨", fiber: "🌿", iron_ore: "⛏️",
  berry: "🫐", herb: "🌱", gold_ore: "🥇", crystal: "💎", raw_meat: "🥩",
};

const _steerVec = new THREE.Vector3();
const _avoidVec = new THREE.Vector3();
const _nodePos = new THREE.Vector3();

function AllyModel({ data }: { data: AllyData }) {
  const groupRef = useRef<THREE.Group>(null);
  const localPos = useRef(data.position.clone());
  const velocity = useRef(new THREE.Vector3());
  const wanderTarget = useRef(new THREE.Vector3());
  const wanderTimer = useRef(Math.random() * 3 + 1);
  const attackCooldown = useRef(0);
  const prevAnim = useRef<AnimationState>("idle");
  const positionSyncTimer = useRef(0);
  const behaviorState = useRef<AllyBehavior>(data.behavior);
  const harvestTimer = useRef(0);
  const harvestNodeIndex = useRef<number>(-1);
  const returnTimer = useRef(0);
  const idleTimer = useRef(0);
  const searchCooldown = useRef(0);
  const lastTurnAngle = useRef(0);
  const stuckTimer = useRef(0);
  const lastPos = useRef(data.position.clone());
  const projectileRef = useRef<THREE.Mesh | null>(null);
  const projectilePos = useRef(new THREE.Vector3());
  const projectileDir = useRef(new THREE.Vector3());
  const projectileActive = useRef(false);
  const projectileTargetId = useRef<string>("");
  const combatRetreatTimer = useRef(0);
  const combatCircleAngle = useRef(Math.random() * Math.PI * 2);

  // Migrated to the new controller pipeline. Combat layering is disabled
  // because allies don't currently load weapon packs, so attack states (when
  // they happen) should occupy the full body for a visible reaction.
  const { scene, playAnimation, update, setMovementSpeed, bounds } = useCharacterController({
    modelPath: data.modelPath,
    targetHeight: data.targetHeight,
    disableCombatLayer: true,
  });

  function steerToward(target: THREE.Vector3, speed: number, delta: number, smoothing = 8): boolean {
    _steerVec.subVectors(target, localPos.current);
    _steerVec.y = 0;
    const dist = _steerVec.length();
    if (dist < 0.5) return true;

    _steerVec.normalize();

    velocity.current.lerp(_steerVec.multiplyScalar(speed), 1 - Math.exp(-smoothing * delta));

    localPos.current.addScaledVector(velocity.current, delta);

    const terrainY = getTerrainHeight(localPos.current.x, localPos.current.z, globalHeightData);
    localPos.current.y = terrainY;

    const targetAngle = Math.atan2(velocity.current.x, velocity.current.z);
    lastTurnAngle.current += (targetAngle - lastTurnAngle.current) * (1 - Math.exp(-10 * delta));
    if (groupRef.current) {
      groupRef.current.rotation.y = lastTurnAngle.current;
    }

    return false;
  }

  function checkStuck(delta: number): boolean {
    const moved = localPos.current.distanceTo(lastPos.current);
    if (moved < 0.05 * delta) {
      stuckTimer.current += delta;
    } else {
      stuckTimer.current = 0;
      lastPos.current.copy(localPos.current);
    }
    return stuckTimer.current > 2.0;
  }

  function unstuck() {
    const angle = Math.random() * Math.PI * 2;
    localPos.current.x += Math.cos(angle) * 2;
    localPos.current.z += Math.sin(angle) * 2;
    stuckTimer.current = 0;
    lastPos.current.copy(localPos.current);
  }

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);
    update(dt);
    attackCooldown.current = Math.max(0, attackCooldown.current - dt);
    searchCooldown.current = Math.max(0, searchCooldown.current - dt);

    const alliesState = useAllies.getState();
    // Personal command overrides global command (per-ally orders from AllyDetailPanel)
    const effectiveCmd = data.personalCommand ?? alliesState.globalCommand;
    const cmdTargetId = alliesState.commandTargetId;
    const enemies = useEnemyManager.getState().enemies;
    const captainBuff = alliesState.getCaptainBuff(localPos.current);
    const effectiveDamage = data.damage + captainBuff;

    // Day/night cycle: at night, non-combatants head home and sleep until dawn.
    const isDaytime = useGame.getState().isDaytime;
    const isCombatant = data.projectileType !== "none" || (!data.canHarvest && data.damage >= 12);
    const enemyNearForGuard = enemies.some(e => !e.isDying && localPos.current.distanceTo(e.position) < (data.attackRange + 6));

    // Resolve effective target FIRST so the combat-promotion gate uses the right id.
    // Personal target (from AllyDetailPanel) wins over global squad target.
    const effectiveTargetId = data.personalCommand === "attack_target"
      ? data.personalTargetId
      : (effectiveCmd === "attack_target" ? cmdTargetId : null);

    const storeBehavior = data.behavior;
    if (behaviorState.current !== "combat" && behaviorState.current !== "return_to_camp") {
      if (effectiveCmd === "follow") behaviorState.current = "follow";
      else if (effectiveCmd === "stay") behaviorState.current = "idle";
      else if (effectiveCmd === "attack_target" && effectiveTargetId) behaviorState.current = "combat";
      else if (effectiveCmd === "patrol") behaviorState.current = storeBehavior;
    }

    // Override: sleep cycle (only when not actively in combat & no personal command)
    if (
      !isDaytime &&
      !data.personalCommand &&
      behaviorState.current !== "combat" &&
      !enemyNearForGuard &&
      !isCombatant
    ) {
      const distHome = localPos.current.distanceTo(data.homePosition);
      if (distHome > 1.5 && !data.isSleeping) {
        behaviorState.current = "go_home";
      } else {
        if (!data.isSleeping) useAllies.getState().setAllySleeping(data.id, true);
        behaviorState.current = "sleep";
      }
    } else if (isDaytime && data.isSleeping) {
      // Wake up at dawn
      useAllies.getState().setAllySleeping(data.id, false);
      behaviorState.current = data.canHarvest ? "harvest" : storeBehavior;
    }

    let priorityEnemy: (typeof enemies)[0] | null = null;
    if (effectiveTargetId) {
      const targeted = enemies.find(e => e.id === effectiveTargetId && !e.isDying);
      if (targeted) priorityEnemy = targeted;
    }

    let nearestEnemy: (typeof enemies)[0] | null = priorityEnemy ?? null;
    let nearestDist = priorityEnemy ? localPos.current.distanceTo(priorityEnemy.position) : data.attackRange + 10;
    if (!priorityEnemy) {
      for (const enemy of enemies) {
        if (enemy.isDying) continue;
        const dist = localPos.current.distanceTo(enemy.position);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = enemy;
        }
      }
    }

    let nextAnim: AnimationState = "idle";

    // Even sleeping/heading-home allies will wake to defend if an enemy is right next to them.
    const sleepLikeStates = behaviorState.current === "sleep" || behaviorState.current === "go_home";
    const canEnterCombat = behaviorState.current !== "harvest" && behaviorState.current !== "idle";
    const enemyInDefenseRange = nearestEnemy && nearestDist < (data.attackRange + (sleepLikeStates ? 4 : 10));
    if (enemyInDefenseRange && (canEnterCombat || sleepLikeStates)) {
      behaviorState.current = "combat";
      // Clear stale sleep flag if we were resting — UI/schedule must reflect active state
      if (data.isSleeping) useAllies.getState().setAllySleeping(data.id, false);
    } else if (behaviorState.current === "combat" && (!nearestEnemy || nearestDist > data.attackRange + 15)) {
      if (effectiveCmd === "follow") behaviorState.current = "follow";
      else if (effectiveCmd === "stay") behaviorState.current = "idle";
      else behaviorState.current = storeBehavior;
    }

    if (projectileRef.current) {
      if (projectileActive.current) {
        projectileRef.current.visible = true;
        projectilePos.current.addScaledVector(projectileDir.current, 22 * dt);
        projectileRef.current.position.copy(projectilePos.current);

        const target = enemies.find(e => e.id === projectileTargetId.current);
        if (target && projectilePos.current.distanceTo(target.position) < 1.5) {
          // damageEnemy returns true if this hit was a killing blow — single source of truth
          const killed = useEnemyManager.getState().damageEnemy(target.id, effectiveDamage);
          useAllies.getState().awardXp(data.id, killed ? 25 : 4, killed ? "kill" : undefined);
          projectileActive.current = false;
          projectileRef.current.visible = false;
        }
        if (projectilePos.current.distanceTo(localPos.current) > 30) {
          projectileActive.current = false;
          projectileRef.current.visible = false;
        }
      } else {
        projectileRef.current.visible = false;
      }
    }

    if (checkStuck(dt)) {
      unstuck();
    }

    switch (behaviorState.current) {
      case "combat": {
        if (!nearestEnemy) {
          behaviorState.current = storeBehavior;
          break;
        }

        if (nearestDist <= data.attackRange) {
          _steerVec.subVectors(nearestEnemy.position, localPos.current).normalize();
          const faceAngle = Math.atan2(_steerVec.x, _steerVec.z);
          lastTurnAngle.current += (faceAngle - lastTurnAngle.current) * (1 - Math.exp(-12 * dt));
          groupRef.current.rotation.y = lastTurnAngle.current;

          if (attackCooldown.current <= 0) {
            nextAnim = "attack";
            attackCooldown.current = 1.0 + Math.random() * 0.3;

            if (data.projectileType !== "none") {
              projectileActive.current = true;
              projectilePos.current.copy(localPos.current).add(new THREE.Vector3(0, 1, 0));
              projectileDir.current.subVectors(nearestEnemy.position, localPos.current).normalize();
              projectileTargetId.current = nearestEnemy.id;
            } else {
              const killed = useEnemyManager.getState().damageEnemy(nearestEnemy.id, effectiveDamage);
              useAllies.getState().awardXp(data.id, killed ? 25 : 4, killed ? "kill" : undefined);
            }

            if (data.projectileType === "none") {
              combatRetreatTimer.current = 0.4;
            }
          } else if (combatRetreatTimer.current > 0) {
            combatRetreatTimer.current -= dt;
            _steerVec.subVectors(localPos.current, nearestEnemy.position).normalize();
            localPos.current.addScaledVector(_steerVec, data.speed * 0.5 * dt);
            const terrainY = getTerrainHeight(localPos.current.x, localPos.current.z, globalHeightData);
            localPos.current.y = terrainY;
            nextAnim = "walk";
          } else {
            combatCircleAngle.current += dt * 1.5;
            const cx = nearestEnemy.position.x + Math.cos(combatCircleAngle.current) * (data.attackRange * 0.8);
            const cz = nearestEnemy.position.z + Math.sin(combatCircleAngle.current) * (data.attackRange * 0.8);
            _steerVec.set(cx, 0, cz);
            steerToward(_steerVec, data.speed * 0.4, dt);
            nextAnim = "walk";
          }
        } else {
          const arrived = steerToward(nearestEnemy.position, data.speed * 1.2, dt);
          nextAnim = nearestDist > 8 ? "run" : "walk";
        }
        break;
      }

      case "harvest": {
        if (!data.canHarvest) {
          behaviorState.current = "patrol";
          break;
        }

        if (harvestNodeIndex.current < 0 && searchCooldown.current <= 0) {
          const nearby = getResourceNodesNear(localPos.current, data.patrolRadius + 5);
          if (nearby.length > 0) {
            const pick = nearby[Math.floor(Math.random() * Math.min(3, nearby.length))];
            harvestNodeIndex.current = pick.index;
          } else {
            searchCooldown.current = 3;
            behaviorState.current = "patrol";
            idleTimer.current = 0;
          }
          break;
        }

        if (harvestNodeIndex.current < 0) {
          nextAnim = "idle";
          break;
        }

        const nodeData = getResourceNodesNear(
          localPos.current,
          data.patrolRadius + 20,
          false,
        ).find(n => n.index === harvestNodeIndex.current);

        if (!nodeData || nodeData.node.harvested) {
          harvestNodeIndex.current = -1;
          harvestTimer.current = 0;
          searchCooldown.current = 0.5;
          break;
        }

        _nodePos.set(nodeData.node.position[0], nodeData.node.position[1], nodeData.node.position[2]);
        const distToNode = localPos.current.distanceTo(_nodePos);

        if (distToNode > 2.0) {
          steerToward(_nodePos, data.speed * 0.6, dt, 6);
          nextAnim = "walk";
        } else {
          harvestTimer.current += dt;
          nextAnim = "attack";

          _steerVec.subVectors(_nodePos, localPos.current).normalize();
          const faceAngle = Math.atan2(_steerVec.x, _steerVec.z);
          groupRef.current.rotation.y = faceAngle;

          if (harvestTimer.current >= 2.5 / Math.max(data.harvestSpeed, 0.5)) {
            const result = harvestNodeByIndex(harvestNodeIndex.current);
            if (result) {
              useInventory.getState().addItem({
                id: result.type,
                name: result.type.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()),
                type: result.type === "berry" || result.type === "raw_meat" ? "food" : "material",
                healAmount: result.type === "berry" ? 8 : result.type === "herb" ? 12 : undefined,
                icon: RESOURCE_ICONS[result.type] || "📦",
                quantity: result.qty,
              });
              // XP for honest day's work — scales lightly with quantity gathered
              useAllies.getState().awardXp(data.id, 6 + Math.min(10, result.qty), "harvest");
            }

            harvestTimer.current = 0;
            harvestNodeIndex.current = -1;
            behaviorState.current = "return_to_camp";
            returnTimer.current = 0;
          }
        }
        break;
      }

      case "return_to_camp": {
        const distToCenter = localPos.current.distanceTo(data.patrolCenter);
        if (distToCenter > 3) {
          steerToward(data.patrolCenter, data.speed * 0.7, dt, 6);
          nextAnim = "walk";
        } else {
          returnTimer.current += dt;
          nextAnim = "idle";
          if (returnTimer.current >= 1.5) {
            behaviorState.current = "harvest";
            harvestNodeIndex.current = -1;
          }
        }
        break;
      }

      case "follow": {
        const playerPos = useGame.getState().playerPosition;
        if (playerPos) {
          const distToPlayer = localPos.current.distanceTo(playerPos);
          if (distToPlayer > 4) {
            const followSpeed = distToPlayer > 12 ? data.speed * 1.6 : data.speed * 0.9;
            steerToward(playerPos, followSpeed, dt);
            nextAnim = distToPlayer > 12 ? "run" : "walk";
          } else {
            velocity.current.multiplyScalar(0.9);
            nextAnim = "idle";
          }
        }
        break;
      }

      case "idle": {
        velocity.current.multiplyScalar(0.95);
        nextAnim = "idle";
        break;
      }

      case "go_home": {
        const distHome = localPos.current.distanceTo(data.homePosition);
        if (distHome > 1.2) {
          steerToward(data.homePosition, data.speed * 0.6, dt, 6);
          nextAnim = "walk";
        } else {
          // Arrived — settle in for the night
          velocity.current.multiplyScalar(0.85);
          if (!data.isSleeping) useAllies.getState().setAllySleeping(data.id, true);
          behaviorState.current = "sleep";
          nextAnim = "idle";
        }
        break;
      }

      case "sleep": {
        velocity.current.multiplyScalar(0.7);
        nextAnim = "idle";
        if (groupRef.current) {
          groupRef.current.position.y = localPos.current.y - 0.05;
        }
        break;
      }

      case "patrol":
      default: {
        wanderTimer.current -= dt;
        if (wanderTimer.current <= 0) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 3 + Math.random() * data.patrolRadius;
          wanderTarget.current.set(
            data.patrolCenter.x + Math.cos(angle) * dist,
            0,
            data.patrolCenter.z + Math.sin(angle) * dist,
          );
          wanderTimer.current = 4 + Math.random() * 5;
        }

        const dist = localPos.current.distanceTo(wanderTarget.current);
        if (dist > 1.5) {
          steerToward(wanderTarget.current, data.speed * 0.35, dt, 4);
          nextAnim = "walk";
        } else {
          velocity.current.multiplyScalar(0.95);
          idleTimer.current += dt;
          if (idleTimer.current > 4 && data.canHarvest) {
            idleTimer.current = 0;
            behaviorState.current = "harvest";
            harvestNodeIndex.current = -1;
          }
          nextAnim = "idle";
        }
        break;
      }
    }

    groupRef.current.position.copy(localPos.current);

    positionSyncTimer.current += dt;
    if (positionSyncTimer.current >= 0.5) {
      positionSyncTimer.current = 0;
      useAllies.getState().updateAllyPosition(data.id, localPos.current);
    }

    // Feed real horizontal speed to the locomotion blend tree so transitions
    // between idle/walk/run blend smoothly instead of snapping on state name.
    setMovementSpeed(Math.hypot(velocity.current.x, velocity.current.z));

    if (nextAnim !== prevAnim.current) {
      playAnimation(nextAnim);
      prevAnim.current = nextAnim;
    }
  });

  const projectileColor = data.projectileType === "fireball" ? "#ff4400" : data.projectileType === "lightning" ? "#44aaff" : "#ffcc00";
  const behaviorIcon = data.canHarvest ? "🌾" : data.projectileType !== "none" ? "🏹" : "⚔️";

  return (
    <>
    <KinematicCharacterBody
      positionRef={localPos}
      bounds={bounds}
      active={data.health > 0}
      collisionGroups={COLLISION_MASKS.NPC}
    />
    <group ref={groupRef} position={data.position.toArray()}>
      <primitive object={scene} />
      <sprite position={[0, data.targetHeight + 0.5, 0]} scale={[1.2, 0.25, 1]}>
        <spriteMaterial color={data.canHarvest ? "#e67e22" : data.projectileType !== "none" ? "#3498db" : "#e74c3c"} opacity={0.5} transparent />
      </sprite>
      {data.health < data.maxHealth && (
        <group position={[0, data.targetHeight + 0.3, 0]}>
          <mesh>
            <planeGeometry args={[1, 0.1]} />
            <meshBasicMaterial color="#333" transparent opacity={0.8} />
          </mesh>
          <mesh position={[-(1 - data.health / data.maxHealth) * 0.5, 0, 0.001]}>
            <planeGeometry args={[data.health / data.maxHealth, 0.08]} />
            <meshBasicMaterial color="#2ecc71" />
          </mesh>
        </group>
      )}
      {data.buffRadius > 0 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[data.buffRadius - 0.1, data.buffRadius, 32]} />
          <meshBasicMaterial color="#ffcc00" transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh ref={projectileRef} visible={false}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial color={projectileColor} />
      </mesh>
    </group>
    </>
  );
}

export default function AllyNPCs() {
  const allies = useAllies(s => s.allies);

  return (
    <>
      {allies.map(ally => (
        <Suspense key={ally.id} fallback={null}>
          <AllyModel data={ally} />
        </Suspense>
      ))}
    </>
  );
}
