import { useRef, Suspense, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { type AnimationState } from "../hooks/useCharacterModel";
import { useCharacterController } from "../controllers/useCharacterController";
import { WeaponTrail } from "../effects/WeaponTrail";
import { getTerrainHeight, globalHeightData } from "./Terrain";
import { KinematicCharacterBody } from "./KinematicCharacterBody";
import { COLLISION_MASKS } from "./BuildingColliders";
import { EnemyData, useEnemyManager, type EnemyType, getEnemyTierColor } from "../systems/EnemyManager";
import { useSurvival } from "@/lib/stores/useSurvival";
import { useGame } from "@/lib/stores/useGame";
import { useCombatLog } from "@/lib/stores/useCombatLog";
import { useTargeting } from "@/lib/stores/useTargeting";
import { createEnemyBehaviorTree, tickEnemyBT, updatePlayerTracking, scaleDifficulty, type EnemyBlackboard } from "../systems/EnemyBehaviorTree";
import type { SelectorNode } from "../systems/EnemyBehaviorTree";
import type { AIBehaviorProfile, EmoteType } from "../islands/TrainingIslandRegistry";
import { Html } from "@react-three/drei";
import {
  FireballProjectile,
  BulletProjectile,
  MagicMissileProjectile,
} from "../effects/SpellProjectiles";
import { HadoukenProjectile } from "../effects/SkillEffects";
import { ImpactFlinchController, damageToFlinchIntensity } from "../systems/ImpactFlinch";
import { UNIT_CDN_BASE } from "../systems/UnitRegistry";

// Ranged thrower archetypes from §3.5 of the audit (Paladin/Robot family).
// Each one fires a different one of the four standard blockable projectile
// components instead of dealing immediate melee damage — which makes them
// the first enemies in the codebase that the new block-and-rebound primitive
// can be exercised against in actual gameplay (see THROWER_PROJECTILE below).
const RANGED_THROWER_TYPES: ReadonlySet<EnemyType> = new Set<EnemyType>([
  "thrower_brute",
  "thrower_assassin",
  "thrower_soldier",
  "thrower_berserker",
  // Sci-fi / AW ranged units fire projectiles instead of melee
  "scifi_soldier",
  "cyborg_unit",
  "cyborg_soldier",
  "shadow_soldier",
  "scifi_trooper",
  "scifi_officer",
  "aw_tank",
  "mech_tripod",
]);

/**
 * Each thrower archetype is wired to a distinct one of the four standard
 * blockable projectile components (defined in SpellProjectiles.tsx /
 * SkillEffects.tsx). All four spawn with team="enemy" via Enemy.tsx, so the
 * player can perfect-block any of them and watch the deflected shot fly back
 * and damage the caster (block-and-rebound primitive in
 * `client/src/game/state/blockGuard.ts`). Variety here also makes the parry
 * window feel different per enemy: the heavy Fireball reads slow and bright,
 * the Assassin's Bullet snaps in fast, etc.
 */
type ThrowerProjectileKind = "fireball" | "bullet" | "magic_missile" | "hadouken";
const THROWER_PROJECTILE: Record<string, ThrowerProjectileKind> = {
  thrower_brute: "fireball",
  thrower_assassin: "bullet",
  thrower_soldier: "magic_missile",
  thrower_berserker: "hadouken",
  // AW / sci-fi ranged units
  scifi_soldier: "bullet",
  cyborg_unit: "hadouken",
  cyborg_soldier: "magic_missile",
  shadow_soldier: "bullet",
  scifi_trooper: "bullet",
  scifi_officer: "magic_missile",
  aw_tank: "fireball",
  mech_tripod: "hadouken",
};

interface EnemyProps {
  data: EnemyData;
  playerPosition: THREE.Vector3;
  pathfindFn?: ((from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[] | null) | null;
  behaviorProfile?: AIBehaviorProfile;
  allowedEmotes?: EmoteType[];
  nearbyEnemyPositions?: THREE.Vector3[];
  playerLevel?: number;
}

const ENEMY_MODEL_PATHS: Record<EnemyType, string> = {
  skeleton: "/models/pirate_quaternius/Characters_Skeleton.glb",
  spider: "/models/characters/goblin_backstabber-male.glb",
  golem: "/models/pirate_quaternius/Characters_Captain_Barbarossa.glb",
  pirate: "/models/pirate_quaternius/Characters_Anne.glb",
  witch: "/models/monsters/blob/Wizard.glb",
  ninja: "/models/monsters/blob/Ninja.glb",
  orc: "/models/monsters/big/Orc.glb",
  demon: "/models/monsters/big/Demon.glb",
  blue_demon: "/models/monsters/big/BlueDemon.glb",
  dragon: "/models/monsters/flying/Dragon_Evolved.glb",
  mushroom_king: "/models/monsters/big/MushroomKing.glb",
  yeti: "/models/monsters/blob/Yeti.glb",
  ghost: "/models/monsters/flying/Ghost.glb",
  frog: "/models/monsters/big/Frog.glb",
  blob: "/models/monsters/blob/GreenBlob.glb",
  cactoro: "/models/monsters/big/Cactoro.glb",
  tribal: "/models/monsters/big/Tribal.glb",
  dino: "/models/monsters/dinosaurs/Apatosaurus.glb",
  raptor: "/models/monsters/dinosaurs/Velociraptor.glb",
  trex: "/models/monsters/dinosaurs/Trex.glb",
  triceratops: "/models/monsters/dinosaurs/Triceratops.glb",
  bunny: "/models/monsters/big/Bunny.glb",
  alien: "/models/monsters/big/Alien.glb",
  thrower_brute: "/models/characters/night_stalker-male.glb",
  thrower_assassin: "/models/characters/assassin-male.glb",
  thrower_soldier: "/models/characters/undead_grave_knight-male.glb",
  thrower_berserker: "/models/characters/night_stalker-male.glb",
  // Dark elf camp enemies — local elf-male.glb (CDN upgrade: ELF_ranger.glb when ready)
  dark_elf: "/models/characters/elf-male.glb",
  // Flying boss enemies
  armabee: "/models/monsters/flying/Armabee.glb",
  alpaking: "/models/monsters/flying/Alpaking.glb",
  // Advance Wars / sci-fi units — loaded from object storage CDN
  aw_infantry: `${UNIT_CDN_BASE}/units/advance_wars_infantry__mech_units/scene.gltf`,
  aw_mech: `${UNIT_CDN_BASE}/units/advance_wars_infantry__mech_units/scene.gltf`,
  aw_tank: `${UNIT_CDN_BASE}/units/advance_wars_land_units/scene.gltf`,
  mech_tripod: `${UNIT_CDN_BASE}/units/mechs_tanks_vehicles_and_tripods/scene.gltf`,
  scifi_soldier: `${UNIT_CDN_BASE}/units/futuristic_soldier_lowpoly/scene.gltf`,
  cyborg_unit: `${UNIT_CDN_BASE}/units/cyborg/scene.gltf`,
  cyborg_soldier: `${UNIT_CDN_BASE}/units/cyborg_soldier_scifi_character/scene.gltf`,
  shadow_soldier: `${UNIT_CDN_BASE}/units/call_of_duty_mw2r_-_shadow_company_soilders/scene.gltf`,
  scifi_trooper: `${UNIT_CDN_BASE}/units/stylized_sci-_fi_soldier_animated/scene.gltf`,
  scifi_officer: `${UNIT_CDN_BASE}/units/stylized_sci-fi_officer_with_gun_animated/scene.gltf`,
};

const ENEMY_TARGET_HEIGHTS: Record<EnemyType, number> = {
  skeleton: 1.8,
  spider: 0.9,
  golem: 2.6,
  pirate: 1.85,
  witch: 1.75,
  ninja: 1.8,
  orc: 2.0,
  demon: 2.8,
  blue_demon: 2.4,
  dragon: 3.5,
  mushroom_king: 3.0,
  yeti: 2.8,
  ghost: 1.8,
  frog: 1.5,
  blob: 1.0,
  cactoro: 1.8,
  tribal: 1.6,
  dino: 3.5,
  raptor: 2.0,
  trex: 4.5,
  triceratops: 3.5,
  bunny: 0.8,
  alien: 2.4,
  thrower_brute: 2.0,
  thrower_assassin: 1.8,
  thrower_soldier: 1.9,
  thrower_berserker: 2.0,
  aw_infantry: 1.8,
  aw_mech: 2.4,
  aw_tank: 2.8,
  mech_tripod: 4.5,
  scifi_soldier: 1.85,
  cyborg_unit: 2.2,
  cyborg_soldier: 2.0,
  shadow_soldier: 1.85,
  scifi_trooper: 1.8,
  scifi_officer: 1.9,
  dark_elf: 1.8,
  armabee: 1.4,
  alpaking: 2.5,
};

const ENEMY_TINTS: Record<EnemyType, string | null> = {
  skeleton: "#88aa77",
  spider: "#886644",
  golem: null,
  pirate: null,
  witch: "#9944aa",
  ninja: null,
  orc: null,
  demon: null,
  blue_demon: null,
  dragon: null,
  mushroom_king: null,
  yeti: null,
  ghost: "#aaccff",
  frog: null,
  blob: null,
  cactoro: null,
  tribal: null,
  dino: null,
  raptor: "#557744",
  trex: "#885533",
  triceratops: "#667755",
  bunny: null,
  alien: null,
  thrower_brute: "#cc4444",
  thrower_assassin: "#aa3366",
  thrower_soldier: "#4466aa",
  thrower_berserker: "#cc6600",
  aw_infantry: "#5577aa",
  aw_mech: "#886633",
  aw_tank: "#556644",
  mech_tripod: "#444455",
  scifi_soldier: "#336699",
  cyborg_unit: "#44cccc",
  cyborg_soldier: "#6688aa",
  shadow_soldier: "#333344",
  scifi_trooper: "#558866",
  scifi_officer: "#aa6633",
  dark_elf: "#3a2255",
  armabee: "#ffcc00",
  alpaking: "#ff88aa",
};

const USES_MONSTER_MODEL: Record<EnemyType, boolean> = {
  skeleton: false, spider: false, golem: false, pirate: false, witch: false, ninja: false,
  orc: true, demon: true, blue_demon: true, dragon: true, mushroom_king: true, yeti: true,
  ghost: true, frog: true, blob: true, cactoro: true, tribal: true, dino: true,
  raptor: true, trex: true, triceratops: true,
  bunny: true, alien: true,
  thrower_brute: false, thrower_assassin: false, thrower_soldier: false, thrower_berserker: false,
  // AW / sci-fi units — GLTF from CDN, no humanoid rig → monster path
  aw_infantry: true, aw_mech: true, aw_tank: true, mech_tripod: true,
  scifi_soldier: true, cyborg_unit: true, cyborg_soldier: true,
  shadow_soldier: true, scifi_trooper: true, scifi_officer: true,
  // New enemies
  dark_elf: false, armabee: true, alpaking: true,
};

const EMOTE_ICONS: Record<EmoteType, string> = {
  taunt: "😤",
  rally: "⚔️",
  fear: "😱",
  celebrate: "🎉",
  warn: "⚠️",
  laugh: "😈",
};

const EMOTE_COLORS: Record<EmoteType, string> = {
  taunt: "#ff4444",
  rally: "#ffaa00",
  fear: "#66bbff",
  celebrate: "#44ff44",
  warn: "#ffcc00",
  laugh: "#cc44cc",
};

function EmoteBubble({ emote, visible }: { emote: EmoteType | null; visible: boolean }) {
  if (!emote || !visible) return null;
  return (
    <Html center distanceFactor={15} style={{ pointerEvents: "none" }}>
      <div style={{
        background: EMOTE_COLORS[emote] + "cc",
        borderRadius: "50%",
        width: 36,
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        border: "2px solid white",
        boxShadow: "0 0 10px " + EMOTE_COLORS[emote],
        animation: "emote-pop 0.3s ease-out",
      }}>
        {EMOTE_ICONS[emote]}
      </div>
    </Html>
  );
}

function EnemyModel({ data, playerPosition, pathfindFn, behaviorProfile, allowedEmotes, nearbyEnemyPositions, playerLevel }: EnemyProps) {
  const groupRef = useRef<THREE.Group>(null);
  const localPos = useRef(data.position.clone());
  const tempDir = useRef(new THREE.Vector3());
  const { updateEnemy } = useEnemyManager();
  const { takeDamage } = useSurvival();
  const prevState = useRef<string>("idle");
  const isDead = useRef(false);
  const localIsAttacking = useRef(false);
  const posUpdateTimer = useRef(0);
  const hitFlashTimer = useRef(0);
  const prevHealth = useRef(data.health);
  const knockbackVel = useRef(new THREE.Vector3());
  const btRef = useRef<{ tree: SelectorNode; blackboard: EnemyBlackboard } | null>(null);
  const pathRef = useRef<THREE.Vector3[] | null>(null);
  const pathIndexRef = useRef(0);
  const pathUpdateTimer = useRef(0);
  const [activeEmote, setActiveEmote] = useState<EmoteType | null>(null);
  const emoteTimerRef = useRef(0);

  // Ranged-cast bookkeeping. We snapshot the spawn position/direction at the
  // moment the BT requests an attack and bump the fireKey so the projectile
  // component remounts (using `key` as a clean re-arm signal).
  const isRanged = RANGED_THROWER_TYPES.has(data.type);
  const [castShot, setCastShot] = useState<{
    pos: [number, number, number];
    dir: [number, number, number];
    fireKey: number;
  } | null>(null);
  const fireKeyRef = useRef(0);

  if (!btRef.current) {
    const profile = behaviorProfile || "patrol";
    const bt = createEnemyBehaviorTree(profile);
    bt.blackboard.health = data.health;
    bt.blackboard.maxHealth = data.maxHealth;
    bt.blackboard.detectionRange = data.detectionRange;
    bt.blackboard.attackRange = data.attackRange;
    bt.blackboard.speed = data.speed;
    bt.blackboard.attackCooldown = data.attackCooldown;
    bt.blackboard.damage = data.damage;
    btRef.current = bt;
  }

  const isMonster = USES_MONSTER_MODEL[data.type] || false;
  const modelPath = ENEMY_MODEL_PATHS[data.type] || ENEMY_MODEL_PATHS.skeleton;
  const targetHeight = ENEMY_TARGET_HEIGHTS[data.type] || 1.8;
  const tintColor = ENEMY_TINTS[data.type] || null;

  // Migrated to the new controller pipeline. Humanoid enemies route their
  // attack/hit through the upper-body combat layer so the legs keep
  // locomoting; monster GLBs lack a properly-classified skeleton, so we
  // fall back to the full-body override slot for them.
  const { scene, playAnimation, update, setMovementSpeed, bounds, rightHand, leftHand, animator } = useCharacterController({
    modelPath,
    targetHeight: isMonster ? undefined : targetHeight,
    tintColor,
    disableCombatLayer: isMonster,
  });

  // Impact flinch controller — procedural bone-level hit reaction.
  // Initialized after useCharacterController so `scene` is available.
  const flinchRef = useRef<ImpactFlinchController | null>(null);
  const flinchDirRef = useRef(new THREE.Vector3());
  useEffect(() => {
    if (scene) {
      flinchRef.current = new ImpactFlinchController(scene);
    }
    return () => { flinchRef.current?.dispose(); };
  }, [scene]);

  // Push hand bones into the animator so attack states get the per-attack
  // swing-arc spline overlay. Monster GLBs lack a classified rig — they
  // fall back to the visual-only WeaponTrail mounted on groupRef below.
  useEffect(() => {
    if (!scene || isMonster) return;
    animator.current?.setHandBones(rightHand.current, leftHand.current);
    return () => { animator.current?.setHandBones(null, null); };
  }, [scene, isMonster, rightHand, leftHand, animator]);

  // Track when the enemy is mid-attack so the WeaponTrail only emits during
  // active swing windows (not while idle/walking). Mirrors the same
  // localIsAttacking signal that drives newState='attack' below.
  const [trailActive, setTrailActive] = useState(false);
  const trailTimerRef = useRef<number | null>(null);

  // Sample positional delta to feed the locomotion blend tree in real m/s.
  const speedSamplePos = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    update(delta);

    // Snapshot current position so we can derive horizontal speed at the end
    // of the frame, regardless of whether movement came from the BT, the
    // pathfinder, or knockback.
    speedSamplePos.current.copy(localPos.current);

    if (data.isDying || isDead.current) {
      if (!isDead.current) {
        isDead.current = true;
        if (!isMonster) playAnimation("death");
      }
      if (isMonster && groupRef.current) {
        groupRef.current.scale.multiplyScalar(0.96);
        groupRef.current.position.y -= delta * 2;
      }
      return;
    }

    const bb = btRef.current!.blackboard;
    updatePlayerTracking(bb, playerPosition, delta);
    bb.selfPos.copy(localPos.current);
    bb.health = data.health;

    if (nearbyEnemyPositions && nearbyEnemyPositions.length > 0) {
      bb.allyPositions = nearbyEnemyPositions;
    }

    if (playerLevel && playerLevel > 1) {
      scaleDifficulty(bb, playerLevel, data.maxHealth, data.damage, data.speed);
    }

    tickEnemyBT(btRef.current!.tree, bb, delta);

    if (bb.emoteRequested && (!allowedEmotes || allowedEmotes.includes(bb.emoteRequested))) {
      setActiveEmote(bb.emoteRequested);
      emoteTimerRef.current = 2.0;
    }
    if (emoteTimerRef.current > 0) {
      emoteTimerRef.current -= delta;
      if (emoteTimerRef.current <= 0) {
        setActiveEmote(null);
      }
    }

    const gameState = useGame.getState();
    const inDungeon = gameState.inDungeon;
    const inTutorialIsland = gameState.inTutorialIsland;

    if (bb.attackRequested && !localIsAttacking.current) {
      if (isRanged) {
        // Spawn an EnemyHadoukenProjectile aimed at the player. The projectile
        // applies its own damage on impact (and switches sides on a player
        // block via the rebound primitive), so we DO NOT call takeDamage here.
        const dirToPlayer = tempDir.current.subVectors(playerPosition, localPos.current);
        dirToPlayer.y = 0;
        if (dirToPlayer.lengthSq() > 0.0001) {
          dirToPlayer.normalize();
          const spawnY = localPos.current.y + (targetHeight * 0.55);
          fireKeyRef.current += 1;
          setCastShot({
            // Spawn a little in front of the caster's chest so the bolt
            // doesn't visually clip through their own model on frame 1.
            pos: [
              localPos.current.x + dirToPlayer.x * 0.6,
              spawnY,
              localPos.current.z + dirToPlayer.z * 0.6,
            ],
            dir: [dirToPlayer.x, 0, dirToPlayer.z],
            fireKey: fireKeyRef.current,
          });
          useCombatLog.getState().addEntry(
            `${data.type.replace(/_/g, ' ')} hurls an energy bolt!`,
            '#ffaa66'
          );
        }
      } else {
        takeDamage(bb.damage, "blade");
        useCombatLog.getState().addEntry(
          `${data.type.replace(/_/g, ' ')} hits you for ${bb.damage} damage!`,
          '#ff6b6b'
        );
      }
      localIsAttacking.current = true;
      setTimeout(() => { localIsAttacking.current = false; }, 600);
    }

    let newState = "idle";

    if (bb.moveDirection) {
      if (inDungeon && pathfindFn && !bb.fleeRequested) {
        pathUpdateTimer.current += delta;
        if (pathUpdateTimer.current > 1.0 || !pathRef.current) {
          pathUpdateTimer.current = 0;
          const path = pathfindFn(localPos.current, playerPosition);
          if (path && path.length > 0) {
            pathRef.current = path;
            pathIndexRef.current = 0;
          }
        }

        if (pathRef.current && pathIndexRef.current < pathRef.current.length) {
          const wp = pathRef.current[pathIndexRef.current];
          const dir = tempDir.current.subVectors(wp, localPos.current);
          dir.y = 0;
          if (dir.lengthSq() < 1) {
            pathIndexRef.current++;
          }
          if (dir.lengthSq() > 0.01) {
            dir.normalize().multiplyScalar(bb.speed * delta);
            localPos.current.add(dir);
            const angle = Math.atan2(dir.x, dir.z);
            groupRef.current.rotation.y = angle;
          }
        } else {
          localPos.current.add(bb.moveDirection);
          if (bb.moveDirection.lengthSq() > 0) {
            const angle = Math.atan2(bb.moveDirection.x, bb.moveDirection.z);
            groupRef.current.rotation.y = angle;
          }
        }
      } else {
        localPos.current.add(bb.moveDirection);
        if (bb.moveDirection.lengthSq() > 0) {
          const angle = Math.atan2(bb.moveDirection.x, bb.moveDirection.z);
          groupRef.current.rotation.y = angle;
        }
      }

      if (bb.fleeRequested) {
        newState = "run";
      } else {
        const dist = localPos.current.distanceTo(playerPosition);
        newState = dist < data.detectionRange ? "run" : "walk";
      }
    }

    if (localIsAttacking.current) {
      newState = "attack";
      const dir = tempDir.current.subVectors(playerPosition, localPos.current);
      dir.y = 0;
      if (dir.lengthSq() > 0) {
        const angle = Math.atan2(dir.x, dir.z);
        groupRef.current.rotation.y = angle;
      }
      // Open a ~400ms emit window for the WeaponTrail. Re-arming on each
      // attack tick keeps the trail visible across consecutive swings, and
      // the timer below clears it so it doesn't bleed into the next idle.
      if (!trailActive) setTrailActive(true);
      if (trailTimerRef.current !== null) clearTimeout(trailTimerRef.current);
      trailTimerRef.current = window.setTimeout(() => {
        setTrailActive(false);
        trailTimerRef.current = null;
      }, 400);
    }

    if (data.health < prevHealth.current && !isDead.current) {
      hitFlashTimer.current = 0.12;
      bb.lastDamagedTime = performance.now() / 1000;
      const damageTaken = prevHealth.current - data.health;

      // Bone-level impact flinch — direction from player toward enemy.
      if (flinchRef.current) {
        flinchDirRef.current.subVectors(localPos.current, playerPosition).normalize();
        const intensity = damageToFlinchIntensity(damageTaken, data.maxHealth);
        flinchRef.current.trigger(flinchDirRef.current, intensity);
      }

      if (damageTaken > 10) {
        const knockDir = tempDir.current.subVectors(localPos.current, playerPosition);
        knockDir.y = 0;
        if (knockDir.lengthSq() > 0) {
          knockDir.normalize();
          const knockForce = Math.min(damageTaken * 0.15, 3);
          knockbackVel.current.copy(knockDir).multiplyScalar(knockForce);
        }
      }
    }
    prevHealth.current = data.health;

    if (hitFlashTimer.current > 0) {
      hitFlashTimer.current -= delta;
      if (scene) {
        scene.traverse((child: any) => {
          if (child.isMesh && child.material) {
            if (hitFlashTimer.current > 0) {
              if (!child.userData._origEmissive) {
                child.userData._origEmissive = child.material.emissive?.clone() || new THREE.Color(0);
                child.userData._origEmissiveIntensity = child.material.emissiveIntensity || 0;
              }
              child.material.emissive = new THREE.Color(1, 1, 1);
              child.material.emissiveIntensity = 2;
            } else if (child.userData._origEmissive) {
              child.material.emissive = child.userData._origEmissive;
              child.material.emissiveIntensity = child.userData._origEmissiveIntensity;
              delete child.userData._origEmissive;
              delete child.userData._origEmissiveIntensity;
            }
          }
        });
      }
    }

    if (knockbackVel.current.lengthSq() > 0.01) {
      localPos.current.add(knockbackVel.current.clone().multiplyScalar(delta * 5));
      knockbackVel.current.multiplyScalar(0.85);
      if (knockbackVel.current.lengthSq() < 0.01) {
        knockbackVel.current.set(0, 0, 0);
      }
    }

    if (!isMonster) {
      if (data.isHit && !isDead.current) {
        playAnimation("hit");
        prevState.current = "hit";
      } else if (newState !== prevState.current && !isDead.current) {
        playAnimation(newState as any);
        prevState.current = newState;
      }
    }

    // Per-scene grounding strategy:
    //  - Dungeon: pinned to floor Y=0.
    //  - Tutorial Island: scene is a baked GLB (not the GameScene
    //    heightfield); preserve the spawn Y so enemies sit on the
    //    ground they were spawned on instead of being snapped to an
    //    empty/zero overworld heightmap.
    //  - Overworld: snap to the global heightfield as usual.
    const terrainY = inDungeon
      ? 0
      : inTutorialIsland
        ? localPos.current.y
        : getTerrainHeight(localPos.current.x, localPos.current.z, globalHeightData);
    localPos.current.y = terrainY;
    groupRef.current.position.x = localPos.current.x;
    groupRef.current.position.z = localPos.current.z;
    groupRef.current.position.y = terrainY;

    posUpdateTimer.current += delta;
    if (posUpdateTimer.current > 0.1) {
      posUpdateTimer.current = 0;
      updateEnemy(data.id, { position: localPos.current.clone() });
    }

    // Feed real horizontal speed to the locomotion blend tree so the
    // controller picks the right idle/walk/run clip and blends smoothly
    // instead of snapping on a state-name change.
    const dx = localPos.current.x - speedSamplePos.current.x;
    const dz = localPos.current.z - speedSamplePos.current.z;
    const horizontalSpeed = Math.hypot(dx, dz) / Math.max(delta, 1e-4);
    setMovementSpeed(horizontalSpeed);

    // Bone-level flinch: update AFTER the mixer so the additive rotation
    // layers on top of the current animation pose.
    flinchRef.current?.update(delta);
  });

  const healthPercent = data.health / data.maxHealth;
  const barY = targetHeight + 0.5;
  const tierColor = getEnemyTierColor(data.tier);
  const isTargeted = useTargeting((s) => s.targetId === data.id);
  const targetRingRef = useRef<THREE.Group>(null);
  const targetRingInnerRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (isTargeted && targetRingRef.current) {
      const t = state.clock.elapsedTime;
      const pulse = 0.9 + Math.sin(t * 3) * 0.15;
      targetRingRef.current.scale.set(pulse, pulse, pulse);
      targetRingRef.current.rotation.z = t * 0.5;
      if (targetRingInnerRef.current) {
        const mat = targetRingInnerRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.5 + Math.sin(t * 4) * 0.2;
      }
    }
  });

  return (
    <>
      {/* Render the cast shot as a world-space sibling of the enemy group so
          it doesn't inherit the enemy's per-frame transform (which would warp
          the trajectory). The projectile snapshots its own spawn pos/dir on
          mount via the bumped fireKey, then animates itself in world space.
          Each thrower archetype uses one of the four standard blockable
          components so all four can be exercised against the parry primitive
          in actual gameplay. */}
      {castShot && (() => {
        const kind = THROWER_PROJECTILE[data.type] ?? "fireball";
        const k = castShot.fireKey;
        if (kind === "fireball") {
          return (
            <FireballProjectile
              key={k}
              position={castShot.pos}
              direction={castShot.dir}
              active={true}
              team="enemy"
              damage={data.damage}
              casterId={data.id}
            />
          );
        }
        if (kind === "bullet") {
          return (
            <BulletProjectile
              key={k}
              position={castShot.pos}
              direction={castShot.dir}
              active={true}
              team="enemy"
              damage={data.damage}
              casterId={data.id}
            />
          );
        }
        if (kind === "magic_missile") {
          return (
            <MagicMissileProjectile
              key={k}
              position={castShot.pos}
              direction={castShot.dir}
              active={true}
              team="enemy"
              damage={data.damage}
              casterId={data.id}
              color="#ff6688"
            />
          );
        }
        // hadouken
        return (
          <HadoukenProjectile
            key={k}
            position={castShot.pos}
            direction={castShot.dir}
            active={true}
            team="enemy"
            damage={data.damage}
            casterId={data.id}
          />
        );
      })()}
      <KinematicCharacterBody
        positionRef={localPos}
        bounds={bounds}
        scale={isMonster ? data.scale : 1}
        active={!data.isDying && !isDead.current}
        collisionGroups={COLLISION_MASKS.ENEMY}
      />
      <group ref={groupRef} position={localPos.current.toArray()} scale={isMonster ? [data.scale, data.scale, data.scale] : [1, 1, 1]}>
      <primitive object={scene} />
      {/* Visual weapon trail. Humanoids sample the rigged right-hand bone
          (and its weapon child); monsters lack a classified rig, so we
          fall back to groupRef as a chest-height origin so the swing still
          gets a flair without faking a weapon. */}
      <WeaponTrail
        bone={isMonster ? { current: null } : rightHand}
        originRef={isMonster ? groupRef : undefined}
        active={trailActive}
      />
      <group position={[0, (barY + 0.4) / (isMonster ? data.scale : 1), 0]}>
        <EmoteBubble emote={activeEmote} visible={activeEmote !== null} />
      </group>
      {isTargeted && (
        <group ref={targetRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05 / (isMonster ? data.scale : 1), 0]} scale={isMonster ? [1 / data.scale, 1 / data.scale, 1 / data.scale] : [1, 1, 1]}>
          <mesh>
            <ringGeometry args={[1.0, 1.2, 32]} />
            <meshBasicMaterial color={tierColor} transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={targetRingInnerRef}>
            <ringGeometry args={[0.7, 0.85, 32]} />
            <meshBasicMaterial color={tierColor} transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
          <mesh>
            <ringGeometry args={[0.3, 0.4, 6]} />
            <meshBasicMaterial color={tierColor} transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
      <group position={[0, barY / (isMonster ? data.scale : 1), 0]} scale={isMonster ? [1 / data.scale, 1 / data.scale, 1 / data.scale] : [1, 1, 1]}>
        <mesh position={[0, 0.15, 0]}>
          <planeGeometry args={[1.2, 0.06]} />
          <meshBasicMaterial color={tierColor} side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
        <mesh>
          <planeGeometry args={[1.2, 0.12]} />
          <meshBasicMaterial color="#222" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
        <mesh position={[(healthPercent - 1) * 0.6, 0, 0.01]}>
          <planeGeometry args={[healthPercent * 1.2, 0.1]} />
          <meshBasicMaterial
            color={healthPercent > 0.5 ? "#4caf50" : healthPercent > 0.25 ? "#ff9800" : "#f44336"}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      </group>
    </>
  );
}

function EnemyFallback({ data }: { data: EnemyData }) {
  return (
    <group position={data.position.toArray()}>
      <mesh castShadow position={[0, 0.7 * data.scale, 0]}>
        <capsuleGeometry args={[0.3 * data.scale, 0.7 * data.scale, 8, 16]} />
        <meshStandardMaterial color={data.color} />
      </mesh>
    </group>
  );
}

export default function Enemy({ data, playerPosition, pathfindFn, behaviorProfile, allowedEmotes, nearbyEnemyPositions, playerLevel }: EnemyProps) {
  return (
    <Suspense fallback={<EnemyFallback data={data} />}>
      <EnemyModel data={data} playerPosition={playerPosition} pathfindFn={pathfindFn} behaviorProfile={behaviorProfile} allowedEmotes={allowedEmotes} nearbyEnemyPositions={nearbyEnemyPositions} playerLevel={playerLevel} />
    </Suspense>
  );
}
