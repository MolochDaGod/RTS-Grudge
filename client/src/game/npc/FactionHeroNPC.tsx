/**
 * FactionHeroNPC — single faction hero agent rendered in the 3D world.
 *
 * Two behavioural contexts, selected by the hero's current dailyState:
 *
 *   at_hub   Wander within 8 units of the hub position. Show nameplate
 *            and [T] Talk prompt when the player is within 4 units.
 *
 *   adventuring  Full class-based AI (combat / harvest / camp) using the
 *            HeroAIProfile. Fights enemies, gathers resources, and places
 *            a camp on the first tick it spawns.
 *
 * The AI pattern deliberately mirrors AllyNPC.tsx for consistency;
 * combat steering, stuck detection, and steer helpers are copied from there.
 *
 * Camp: a tiny campfire mesh placed once on arrival. Used as patrol centre.
 * Health: shown as an in-world bar and driven by useFactionHeroes.damageHero.
 * Projectile: mages and rangers fire a coloured sphere; worges and warriors
 *   use melee damage calls.
 */

import { useRef, useMemo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AnimationState } from "../hooks/useCharacterModel";
import { useCharacterController } from "../controllers/useCharacterController";
import { getTerrainHeight, globalHeightData } from "../components/Terrain";
import { KinematicCharacterBody } from "../components/KinematicCharacterBody";
import { COLLISION_MASKS } from "../components/BuildingColliders";
import { useEnemyManager } from "../systems/EnemyManager";
import { useGame } from "@/lib/stores/useGame";
import { useFactionHeroes } from "@/lib/stores/useFactionHeroes";
import { useMissions } from "@/lib/stores/useMissions";
import { getHero, FACTION_COLOR, type HeroDef } from "@/game/world/HeroRegistry";
import { getAIProfile, isBerserk, shouldRetreat, effectiveDamage } from "@/game/world/HeroAIProfiles";
import { getResourceNodesNear, harvestNodeByIndex } from "../components/ResourceNode";
import { useInventory } from "@/lib/stores/useInventory";
import HeroSquadMember, { type SquadMemberConfig } from "./HeroSquadMember";
import type { HeroClass } from "@/lib/stores/useCharacterStats";

// ─────────────────────────────────────────────────────────────────────────────
// Squad compositions — 3 members per hero (hero + 3 = 4 total per camp)
// Colors are intentionally class-coded so player can read roles at a glance.
// ─────────────────────────────────────────────────────────────────────────────

const SQUAD_CONFIGS: Record<HeroClass, SquadMemberConfig[]> = {
  warrior: [
    { role: "Soldier", color: "#b8903c", size: 0.9, hp: 60, damage: 12, attackRange: 2.5, speed: 2.8 },
    { role: "Archer",  color: "#5588aa", size: 0.8, hp: 45, damage: 18, attackRange: 13,  speed: 2.5 },
    { role: "Soldier", color: "#b8903c", size: 0.9, hp: 65, damage: 13, attackRange: 2.5, speed: 3.0 },
  ],
  worge: [
    { role: "Beast",  color: "#995533", size: 1.0, hp: 55, damage: 16, attackRange: 2.5, speed: 4.2 },
    { role: "Beast",  color: "#995533", size: 1.0, hp: 55, damage: 16, attackRange: 2.5, speed: 4.2 },
    { role: "Scout",  color: "#776633", size: 0.85, hp: 50, damage: 14, attackRange: 2.5, speed: 4.5 },
  ],
  mage: [
    { role: "Spellblade", color: "#9944aa", size: 0.8, hp: 40, damage: 22, attackRange: 11, speed: 2.5 },
    { role: "Archer",     color: "#5588aa", size: 0.8, hp: 45, damage: 16, attackRange: 13, speed: 3.0 },
    { role: "Guard",      color: "#b8903c", size: 0.9, hp: 65, damage: 10, attackRange: 2.5, speed: 3.0 },
  ],
  ranger: [
    { role: "Scout",   color: "#5599aa", size: 0.82, hp: 50, damage: 20, attackRange: 15, speed: 3.5 },
    { role: "Scout",   color: "#5599aa", size: 0.82, hp: 50, damage: 18, attackRange: 13, speed: 3.5 },
    { role: "Fighter", color: "#b8903c", size: 0.9,  hp: 60, damage: 12, attackRange: 2.5, speed: 3.2 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TALK_RADIUS      = 4.0;
const TALK_RADIUS_LEAVE = 5.5;
const HUB_WANDER_RADIUS = 8.0;
const POSITION_SYNC_INTERVAL = 0.5;  // seconds
const CAMP_RADIUS       = 18;        // patrol distance from camp

// ─────────────────────────────────────────────────────────────────────────────
// Reusable scratch vectors — never keep a reference to these across frames
// ─────────────────────────────────────────────────────────────────────────────

const _steerVec  = new THREE.Vector3();
const _avoidVec  = new THREE.Vector3();
const _nodePos   = new THREE.Vector3();

// ─────────────────────────────────────────────────────────────────────────────

type HeroBehavior =
  | "hub_wander"
  | "field_patrol"
  | "field_combat"
  | "field_harvest"
  | "field_camp_setup"
  | "field_retreat"
  | "dead";

// ─────────────────────────────────────────────────────────────────────────────

function HeroModel({ heroId }: { heroId: string }) {
  const heroDef = getHero(heroId)!;
  const profile = getAIProfile(heroDef.heroClass);
  const factionColor = FACTION_COLOR[heroDef.faction];

  // Reactive heroWorldState — use hook so squad rendering re-evaluates when
  // dailyState or hasCamp changes (e.g. hero transitions outbound→adventuring).
  const heroWorldState = useFactionHeroes((s) => s.heroes.get(heroId));

  // Derive weapon type from heroClass so the correct BRB animation pack loads
  // (warrior/worge → greatsword combos, mage → staff casts, ranger → bow draws).
  const HERO_WEAPON_TYPE: Record<HeroClass, import("@/lib/stores/useGame").WeaponType> = {
    warrior: "sword",
    worge:   "greatsword",
    mage:    "staff",
    ranger:  "bow",
  };

  // Model
  const { scene, playAnimation, update, setMovementSpeed, bounds } = useCharacterController({
    modelPath: heroDef.modelPath,
    targetHeight: heroDef.targetHeight,
    weaponType: HERO_WEAPON_TYPE[heroDef.heroClass],
    disableCombatLayer: true,
  });

  // Refs — mutable, never trigger renders
  const groupRef     = useRef<THREE.Group>(null);
  const localPos     = useRef(new THREE.Vector3(...heroDef.hubPosition));
  const velocity     = useRef(new THREE.Vector3());
  const wanderTarget = useRef(new THREE.Vector3(...heroDef.hubPosition));
  const wanderTimer  = useRef(Math.random() * 4 + 2);
  const lastTurnAngle      = useRef(0);
  const prevAnim           = useRef<AnimationState>("idle");
  const behaviorState      = useRef<HeroBehavior>("hub_wander");
  const attackCooldown     = useRef(0);
  const specialCooldown    = useRef(Math.random() * profile.specialCooldown);
  const combatCircleAngle  = useRef(Math.random() * Math.PI * 2);
  const harvestNodeIdx     = useRef(-1);
  const harvestTimer       = useRef(0);
  const positionSyncTimer  = useRef(0);
  const campPos            = useRef<THREE.Vector3 | null>(null);
  const wasNearPlayer      = useRef(false);
  const stuckTimer         = useRef(0);
  const lastStuckPos       = useRef(new THREE.Vector3(...heroDef.hubPosition));
  const projectileRef      = useRef<THREE.Mesh | null>(null);
  const projectilePos      = useRef(new THREE.Vector3());
  const projectileDir      = useRef(new THREE.Vector3());
  const projectileActive   = useRef(false);
  const projectileTargetId = useRef("");

  // ── Helpers ────────────────────────────────────────────────────────────

  function steerToward(target: THREE.Vector3, speed: number, delta: number, smoothing = 8): boolean {
    _steerVec.subVectors(target, localPos.current).setY(0);
    const dist = _steerVec.length();
    if (dist < 0.5) return true;
    _steerVec.normalize();
    velocity.current.lerp(_steerVec.multiplyScalar(speed), 1 - Math.exp(-smoothing * delta));
    localPos.current.addScaledVector(velocity.current, delta);
    localPos.current.y = getTerrainHeight(localPos.current.x, localPos.current.z, globalHeightData);
    const angle = Math.atan2(velocity.current.x, velocity.current.z);
    lastTurnAngle.current += (angle - lastTurnAngle.current) * (1 - Math.exp(-10 * delta));
    if (groupRef.current) groupRef.current.rotation.y = lastTurnAngle.current;
    return false;
  }

  function faceTarget(target: THREE.Vector3, dt: number) {
    _steerVec.subVectors(target, localPos.current).normalize();
    const angle = Math.atan2(_steerVec.x, _steerVec.z);
    lastTurnAngle.current += (angle - lastTurnAngle.current) * (1 - Math.exp(-12 * dt));
    if (groupRef.current) groupRef.current.rotation.y = lastTurnAngle.current;
  }

  function checkStuck(dt: number): boolean {
    const moved = localPos.current.distanceTo(lastStuckPos.current);
    if (moved < 0.05 * dt) stuckTimer.current += dt;
    else { stuckTimer.current = 0; lastStuckPos.current.copy(localPos.current); }
    return stuckTimer.current > 2.0;
  }

  function unstuck() {
    const angle = Math.random() * Math.PI * 2;
    localPos.current.x += Math.cos(angle) * 2;
    localPos.current.z += Math.sin(angle) * 2;
    stuckTimer.current = 0;
    lastStuckPos.current.copy(localPos.current);
  }

  // ── Main frame loop ────────────────────────────────────────────────────

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);
    update(dt);

    attackCooldown.current  = Math.max(0, attackCooldown.current  - dt);
    specialCooldown.current = Math.max(0, specialCooldown.current - dt);

  // Pull fresh state every frame (still ref-based so no re-render overhead).
    const heroWorldState = useFactionHeroes.getState().heroes.get(heroId);
    if (!heroWorldState || heroWorldState.dailyState === "dead") {
      if (prevAnim.current !== "idle") { playAnimation("idle"); prevAnim.current = "idle"; }
      return;
    }

    const isHub = heroWorldState.dailyState === "at_hub";

    // ── Projectile advance ──────────────────────────────────────────────
    if (projectileRef.current) {
      if (projectileActive.current) {
        projectileRef.current.visible = true;
        projectilePos.current.addScaledVector(projectileDir.current, 20 * dt);
        projectileRef.current.position.copy(projectilePos.current);
        const targetEnemy = useEnemyManager.getState().enemies.find(e => e.id === projectileTargetId.current);
        if (targetEnemy && projectilePos.current.distanceTo(targetEnemy.position) < 1.8) {
          useEnemyManager.getState().damageEnemy(targetEnemy.id, heroDef.stats.damage);
          useFactionHeroes.getState().recordKill(heroId);
          projectileActive.current = false;
        }
        if (projectilePos.current.distanceTo(localPos.current) > 32) {
          projectileActive.current = false;
        }
      } else {
        projectileRef.current.visible = false;
      }
    }

    // ── Stuck check ─────────────────────────────────────────────────────
    if (!isHub && checkStuck(dt)) unstuck();

    // ── Player proximity (T talk prompt) ───────────────────────────────
    const playerPos = useGame.getState().playerPosition;
    if (playerPos) {
      const dist = localPos.current.distanceTo(playerPos);
      const leaveR = wasNearPlayer.current ? TALK_RADIUS_LEAVE : TALK_RADIUS;
      const near = dist <= leaveR;
      if (near !== wasNearPlayer.current) {
        wasNearPlayer.current = near;
        if (near && isHub) {
          useFactionHeroes.getState().setNearHero(heroId);
        } else if (!near && useFactionHeroes.getState().nearHeroId === heroId) {
          useFactionHeroes.getState().setNearHero(null);
        }
      }
    }

    let nextAnim: AnimationState = "idle";

    // ── HUB behaviour ───────────────────────────────────────────────────
    if (isHub) {
      behaviorState.current = "hub_wander";
      wanderTimer.current -= dt;
      if (wanderTimer.current <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const dist  = 2 + Math.random() * HUB_WANDER_RADIUS;
        wanderTarget.current.set(
          heroDef.hubPosition[0] + Math.cos(angle) * dist,
          0,
          heroDef.hubPosition[2] + Math.sin(angle) * dist,
        );
        wanderTimer.current = 4 + Math.random() * 6;
      }
      const dw = localPos.current.distanceTo(wanderTarget.current);
      if (dw > 1.2) {
        steerToward(wanderTarget.current, heroDef.stats.speed * 0.35, dt, 4);
        nextAnim = "walk";
      } else {
        velocity.current.multiplyScalar(0.9);
      }
    }
    // ── FIELD behaviour ─────────────────────────────────────────────────
    else {
      // Place camp on first field tick
      if (!campPos.current) {
        const angle = Math.random() * Math.PI * 2;
        campPos.current = new THREE.Vector3(
          localPos.current.x + Math.cos(angle) * 5,
          getTerrainHeight(localPos.current.x, localPos.current.z, globalHeightData),
          localPos.current.z + Math.sin(angle) * 5,
        );
        useFactionHeroes.getState().placeCamp(heroId, campPos.current);
      }

      const enemies = useEnemyManager.getState().enemies;
      const hp = heroWorldState.health;
      const hpFrac = hp / heroWorldState.maxHealth;
      const berserk = isBerserk(profile, hpFrac);
      const retreating = !berserk && shouldRetreat(profile, hpFrac);

      // Find nearest enemy within engage range
      let nearestEnemy = null as (typeof enemies)[0] | null;
      let nearestDist  = profile.engageRange;
      for (const e of enemies) {
        if (e.isDying) continue;
        const d = localPos.current.distanceTo(e.position);
        if (d < nearestDist) { nearestDist = d; nearestEnemy = e; }
      }

      if (retreating && nearestEnemy && nearestDist < profile.attackRange + 6) {
        behaviorState.current = "field_retreat";
      } else if (nearestEnemy) {
        behaviorState.current = "field_combat";
      } else if (heroDef.dailyObjective === "harvest") {
        behaviorState.current = "field_harvest";
      } else {
        behaviorState.current = "field_patrol";
      }

      switch (behaviorState.current) {

        // ── COMBAT ────────────────────────────────────────────────────
        case "field_combat": {
          if (!nearestEnemy) { behaviorState.current = "field_patrol"; break; }

          const dmg = effectiveDamage(heroDef.stats.damage, profile, hpFrac);
          const spd = berserk ? heroDef.stats.speed * 1.8 : heroDef.stats.speed;

          if (nearestDist <= profile.attackRange) {
            faceTarget(nearestEnemy.position, dt);

            // Normal attack
            if (attackCooldown.current <= 0) {
              nextAnim = "attack";
              attackCooldown.current = profile.attackCooldown + Math.random() * 0.2;

              const isRanged = profile.heroClass === "mage" || profile.heroClass === "ranger";
              if (isRanged && projectileRef.current) {
                projectileActive.current = true;
                projectilePos.current.copy(localPos.current).add(new THREE.Vector3(0, 1, 0));
                projectileDir.current.subVectors(nearestEnemy.position, localPos.current).normalize();
                projectileTargetId.current = nearestEnemy.id;
              } else {
                useEnemyManager.getState().damageEnemy(nearestEnemy.id, dmg);
                useFactionHeroes.getState().recordKill(heroId);
              }
            } else {
              // Orbit / circle (melee) or kite (ranged)
              if (profile.kiteWhileFighting) {
                // Strafe perpendicular
                _steerVec.subVectors(nearestEnemy.position, localPos.current).normalize();
                _avoidVec.set(-_steerVec.z, 0, _steerVec.x);
                localPos.current.addScaledVector(_avoidVec, spd * 0.4 * dt);
                localPos.current.y = getTerrainHeight(localPos.current.x, localPos.current.z, globalHeightData);
              } else if (profile.circleOrbitSpeed > 0) {
                combatCircleAngle.current += profile.circleOrbitSpeed * dt;
                const cx = nearestEnemy.position.x + Math.cos(combatCircleAngle.current) * profile.optimalRange;
                const cz = nearestEnemy.position.z + Math.sin(combatCircleAngle.current) * profile.optimalRange;
                steerToward(new THREE.Vector3(cx, 0, cz), spd * 0.5, dt);
              }
              nextAnim = "walk";
            }

            // Special move
            if (specialCooldown.current <= 0) {
              specialCooldown.current = profile.specialCooldown;
              if (profile.specialMove === "charge" || profile.specialMove === "leap") {
                // Burst toward enemy
                _steerVec.subVectors(nearestEnemy.position, localPos.current).normalize();
                localPos.current.addScaledVector(_steerVec, spd * 3.5 * dt);
                const d2 = localPos.current.distanceTo(nearestEnemy.position);
                if (d2 < profile.attackRange) {
                  useEnemyManager.getState().damageEnemy(nearestEnemy.id, dmg * 1.8);
                }
              } else if (profile.specialMove === "big_spell") {
                // AOE around enemy
                for (const e of enemies) {
                  if (!e.isDying && localPos.current.distanceTo(e.position) < 6) {
                    useEnemyManager.getState().damageEnemy(e.id, dmg * 1.4);
                  }
                }
              } else if (profile.specialMove === "rapid_fire") {
                // 3 quick shots — fire on next 3 frames (simplified: one heavy shot)
                if (projectileRef.current) {
                  projectileActive.current = true;
                  projectilePos.current.copy(localPos.current).add(new THREE.Vector3(0, 1, 0));
                  projectileDir.current.subVectors(nearestEnemy.position, localPos.current).normalize();
                  projectileTargetId.current = nearestEnemy.id;
                  attackCooldown.current = 0.2;
                }
              }
            }
          } else {
            // Move toward enemy
            steerToward(nearestEnemy.position, spd, dt);
            nextAnim = nearestDist > 10 ? "run" : "walk";
          }
          break;
        }

        // ── HARVEST ───────────────────────────────────────────────────
        case "field_harvest": {
          if (harvestNodeIdx.current < 0) {
            const nearby = getResourceNodesNear(localPos.current, CAMP_RADIUS);
            if (nearby.length > 0) {
              // Prefer resources in the hero's profile preferred list
              const pref = nearby.filter(n =>
                profile.preferredResources.some(r => (n.node as any).type?.includes(r))
              );
              const pick = (pref.length > 0 ? pref : nearby)[Math.floor(Math.random() * Math.min(3, nearby.length))];
              harvestNodeIdx.current = pick.index;
            } else {
              behaviorState.current = "field_patrol";
            }
            break;
          }
          const nodeData = getResourceNodesNear(localPos.current, CAMP_RADIUS + 10, false)
            .find(n => n.index === harvestNodeIdx.current);
          if (!nodeData || (nodeData.node as any).harvested) {
            harvestNodeIdx.current = -1; harvestTimer.current = 0; break;
          }
          _nodePos.set((nodeData.node as any).position[0], (nodeData.node as any).position[1], (nodeData.node as any).position[2]);
          if (localPos.current.distanceTo(_nodePos) > 2.0) {
            steerToward(_nodePos, heroDef.stats.speed * 0.6, dt, 6);
            nextAnim = "walk";
          } else {
            harvestTimer.current += dt;
            nextAnim = "attack";
            faceTarget(_nodePos, dt);
            if (harvestTimer.current >= 2.0 / Math.max(profile.harvestMultiplier, 0.5)) {
              const result = harvestNodeByIndex(harvestNodeIdx.current);
              if (result) {
                useInventory.getState().addItem({
                  id: result.type, name: result.type.replace(/_/g, " "),
                  type: "material", icon: "📦", quantity: Math.ceil(result.qty * profile.harvestMultiplier),
                });
                useMissions.getState().onGather(result.type);
                useFactionHeroes.getState().recordGather(heroId);
              }
              harvestNodeIdx.current = -1; harvestTimer.current = 0;
              behaviorState.current = "field_patrol";
            }
          }
          break;
        }

        // ── RETREAT ───────────────────────────────────────────────────
        case "field_retreat": {
          if (campPos.current) {
            const arrived = steerToward(campPos.current, heroDef.stats.speed * 0.8, dt, 6);
            nextAnim = "run";
            if (arrived) behaviorState.current = "field_patrol";
          } else {
            behaviorState.current = "field_patrol";
          }
          break;
        }

        // ── PATROL ────────────────────────────────────────────────────
        default: {
          wanderTimer.current -= dt;
          if (wanderTimer.current <= 0) {
            const centre = campPos.current ?? new THREE.Vector3(...heroDef.hubPosition);
            const angle = Math.random() * Math.PI * 2;
            const d = 3 + Math.random() * profile.patrolRadius;
            wanderTarget.current.set(centre.x + Math.cos(angle) * d, 0, centre.z + Math.sin(angle) * d);
            wanderTimer.current = 5 + Math.random() * 5;
          }
          const dw2 = localPos.current.distanceTo(wanderTarget.current);
          if (dw2 > 1.5) {
            steerToward(wanderTarget.current, heroDef.stats.speed * 0.4, dt, 4);
            nextAnim = "walk";
          } else {
            velocity.current.multiplyScalar(0.9);
          }
          break;
        }
      }
    }

    // Push position to group mesh
    groupRef.current.position.copy(localPos.current);

    // Periodic position sync to store (avoid per-frame store writes)
    positionSyncTimer.current += dt;
    if (positionSyncTimer.current >= POSITION_SYNC_INTERVAL) {
      positionSyncTimer.current = 0;
      useFactionHeroes.getState().updateHeroPosition(heroId, localPos.current);
    }

    setMovementSpeed(Math.hypot(velocity.current.x, velocity.current.z));
    if (nextAnim !== prevAnim.current) { playAnimation(nextAnim); prevAnim.current = nextAnim; }
  });

  // ── Determine HP for health bar ─────────────────────────────────────────

  const hp    = heroWorldState?.health ?? heroDef.stats.maxHealth;
  const maxHp = heroWorldState?.maxHealth ?? heroDef.stats.maxHealth;

  // Projectile colour by class
  const projColor = heroDef.heroClass === "mage"
    ? (heroDef.faction === "legion" ? "#aa00ff" : heroDef.faction === "fabled" ? "#00ccff" : "#ffee00")
    : "#ff8800";

  const isRanged = heroDef.heroClass === "mage" || heroDef.heroClass === "ranger";

  return (
    <>
      <KinematicCharacterBody
        positionRef={localPos}
        bounds={bounds}
        active
        collisionGroups={COLLISION_MASKS.NPC}
      />
      <group ref={groupRef} position={localPos.current.toArray()}>
        <primitive object={scene} />

        {/* Faction colour stripe */}
        <sprite position={[0, heroDef.targetHeight + 0.55, 0]} scale={[1.4, 0.15, 1]}>
          <spriteMaterial color={factionColor} opacity={0.75} transparent />
        </sprite>

        {/* Health bar (only when damaged) */}
        {hp < maxHp && (
          <group position={[0, heroDef.targetHeight + 0.35, 0]}>
            <mesh>
              <planeGeometry args={[1.1, 0.09]} />
              <meshBasicMaterial color="#222" transparent opacity={0.85} />
            </mesh>
            <mesh position={[-(1.1 - (hp / maxHp) * 1.1) / 2, 0, 0.001]}>
              <planeGeometry args={[(hp / maxHp) * 1.1, 0.07]} />
              <meshBasicMaterial color={hp / maxHp > 0.5 ? "#2ecc71" : hp / maxHp > 0.25 ? "#f39c12" : "#e74c3c"} />
            </mesh>
          </group>
        )}

        {/* Projectile mesh (hidden unless active) */}
        {isRanged && (
          <mesh ref={projectileRef} visible={false}>
            <sphereGeometry args={[0.18, 7, 7]} />
            <meshBasicMaterial color={projColor} />
          </mesh>
        )}

        {/* Camp fire indicator */}
        {campPos.current && (
          <mesh position={[campPos.current.x - localPos.current.x, 0.2, campPos.current.z - localPos.current.z]}>
            <coneGeometry args={[0.3, 0.5, 5]} />
            <meshBasicMaterial color="#ff6600" transparent opacity={0.7} />
          </mesh>
        )}
      </group>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export default function FactionHeroNPC({ heroId }: { heroId: string }) {
  const heroDef = getHero(heroId);
  if (!heroDef) return null;

  // Squad is visible when the hero is adventuring and has established a camp.
  // This is a reactive selector so it re-evaluates when dailyState changes.
  const isAdventuring = useFactionHeroes((s) => s.heroes.get(heroId)?.dailyState === "adventuring");
  const hasCamp       = useFactionHeroes((s) => !!s.heroes.get(heroId)?.hasCamp);
  const squadConfigs  = SQUAD_CONFIGS[heroDef.heroClass];
  const factionColor  = FACTION_COLOR[heroDef.faction];

  return (
    <>
      <Suspense fallback={null}>
        <HeroModel heroId={heroId} />
      </Suspense>

      {/* Squad — up to 3 allies, only when adventuring with an established camp. */}
      {isAdventuring && hasCamp && squadConfigs.map((cfg, i) => (
        <HeroSquadMember
          key={`${heroId}_sq${i}`}
          heroId={heroId}
          memberIndex={i}
          config={cfg}
          factionColor={factionColor}
        />
      ))}
    </>
  );
}
