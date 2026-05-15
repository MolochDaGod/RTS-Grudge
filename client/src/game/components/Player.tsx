import { useRef, useEffect, useCallback, useState, useMemo, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import { RigidBody, CapsuleCollider, ConvexHullCollider, type RapierRigidBody, interactionGroups, useRapier, CoefficientCombineRule } from "@react-three/rapier";
import * as THREE from "three";
import { sampleCharacterPoints, pointsSignature } from "@/lib/physics/characterHull";
import { PlayerColliderDebug } from "../cheats/PlayerColliderDebug";
import { createActor } from "xstate";
import { getTerrainHeight, globalHeightData } from "./Terrain";
import { COLLISION_GROUPS, COLLISION_MASKS } from "./BuildingColliders";
import { getNearClimbable } from "./nearClimbable";
import { type AnimationState } from "../hooks/useCharacterModel";
import { useCharacterController } from "../controllers/useCharacterController";
import {
  MotionInputBuffer,
  keyCodeToMotionDirection,
  keyCodeToMotionAction,
  motionResultToCombatEvent,
} from "../controllers/MotionInputBuffer";
import { useGameConfig } from "@/lib/stores/useGameConfig";
import {
  combatMachine,
  type CombatEvent,
  COMBAT_STATE_ANIMS,
  ACTION_DURATIONS,
  DAMAGE_STATES,
  STAMINA_COSTS,
} from "../machines/combatMachine";
import { MeleeSlashEffect } from "../effects/SkillEffects";
import { WeaponTrail } from "../effects/WeaponTrail";
import { isInWater } from "../effects/WaterVolume";
import { useSurvival, getHungerStatus, getHungerHealthRegenAllowed, onDodgeProc } from "@/lib/stores/useSurvival";
import { useInventory } from "@/lib/stores/useInventory";
import { useEquipment } from "@/lib/stores/useEquipment";
import { useEnemyManager } from "../systems/EnemyManager";
import { damageDestructiblesInArc } from "../dungeon/DungeonDestructibles";
import { tryDamageDungeonDecor } from "../dungeon/DungeonDecorDestruction";
import { useGame, SKILL_MAX_COOLDOWNS } from "@/lib/stores/useGame";
import { useCheats } from "@/lib/stores/useCheats";
import { useChargeHud, CHARGE_TIER_1_MS, CHARGE_TIER_2_MS } from "@/lib/stores/useChargeHud";
import { useStaminaFlash } from "@/lib/stores/useStaminaFlash";
import { useClimbPrompt } from "@/lib/stores/useClimbPrompt";
import { useParryFlash } from "@/lib/stores/useParryFlash";
import { useAudio } from "@/lib/stores/useAudio";
import { useHarvest } from "@/lib/stores/useHarvest";
import { globalHarvestTriggerRef } from "./ResourceNode";
import { useAllies, ALLY_COMMAND_KEYS } from "@/lib/stores/useAllies";
import { useCharacterStats, computeCombatDamage as computeGrudgeDamage, synthesizeEnemyDefender } from "@/lib/stores/useCharacterStats";
import { getCachedPlayerStats } from "@/lib/stores/useStatsBridge";
import { useCombatLog } from "@/lib/stores/useCombatLog";
import { HitParticles, HealParticles } from "../effects/ParticleEffects";
import {
  HadoukenProjectile, ShoryukenFlame, EarthquakeShockwave,
  TatsumakiWind, DashTrail, SpinSlashRing,
  LevelUpEffect, CriticalHitFlash, SwordBlinkFlash,
  ChargeImpactShockwave,
} from "../effects/SkillEffects";
import { DamageNumbersRenderer, useDamageNumbers } from "../effects/DamageNumbers";
import { FireballProjectile, IceLanceProjectile, RockProjectile, RootAOE, DistortionAOE, ArrowProjectile, CrossbowBoltProjectile, BulletProjectile, MagicMissileProjectile, LightningBoltProjectile } from "../effects/SpellProjectiles";
import { blockGuard } from "../state/blockGuard";
import { buildProceduralWeaponGroup } from "./WeaponMesh";
import { loadWeaponModel } from "./WeaponModelLoader";
import { WeaponIKController } from "./WeaponIKController";
import { GripPoseController } from "./GripPoseController";
import WeaponGizmoOverlay from "./WeaponGizmoOverlay";
import { setPlayerBones, useWeaponTuner } from "@/game/systems/playerBones";
import type { MaterialColors, WeaponType } from "@/lib/stores/useGame";
import {
  detectBodyParts, applyBodyMorph,
  detectSkeletonType,
  buildWeaponGripData, cleanWeaponsFromBone, applyWeaponTransformToBone, getWeaponBaseUserData,
  type GripTransform,
  findBoneByAlias, SPINE2_ALIASES,
  getWeaponReach,
} from "@/game/systems/BoneAliases";
import { getBackAccessoryModel } from "@/game/systems/ModelRegistry";
import { loadAsset } from "@/game/systems/AssetLoader";
import {
  onModelProcessed, onWeaponsAttached, onAnimationsBound,
  initializeControllers,
} from "@/game/controllers/GameFlowController";
import { computeMasteryBonuses, type WeaponTypeId as WSD_WeaponTypeId } from "@/lib/data/WeaponSkillData";
import { triggerScreenShake, isCameraOrbiting, getCameraYaw } from "./Camera";
import { useTargeting } from "@/lib/stores/useTargeting";
import { updateGrassPlayerPosition } from "../world/GrassLayer";
import { vfx, VFXPresets } from "../vfx";
import { ImpactFlinchController, damageToFlinchIntensity } from "../systems/ImpactFlinch";
// ── New combat systems ──
import {
  applyCombatImpulse, spawnCombatMeshVFX, fireWeaponVFX, fireHitVFX,
  rollHitEffects, spawnHitImpactMeshVFX, tickCombat, tickCombatVFX,
  applyHitKnockback, applyDodgeImpulse,
} from "../systems/CombatPhysics";
import { useFatigue } from "../systems/FatigueSystem";
import { preloadMeshVFX } from "../effects/MeshVFXProjectiles";

const MATERIAL_TO_PART: Record<string, keyof MaterialColors> = {
  Skin: "skin", Face: "skin", Teeth: "skin", Body: "skin", Head: "skin", Flesh: "skin",
  Foot: "skin", Feet: "skin", Arm: "skin", Leg_Skin: "skin",
  Hair: "hair", Hat: "hat", Helmet: "hat", Hood: "hat",
  Armor: "armor", Armor_Dark: "armor", Main: "armor",
  Gauntlet: "armor", Bracer: "armor", Pauldron: "armor", Shield: "armor", Plate: "armor",
  Clothes: "clothing", Shirt: "clothing", Top: "clothing", Tunic: "clothing", Cape: "clothing", Cloak: "clothing",
  Robe: "clothing", Vest: "clothing", Jacket: "clothing", Tabard: "clothing",
  Pants: "pants", Legs: "pants", Trousers: "pants", Skirt: "pants", Greaves: "pants",
  Boots: "pants", Leggings: "pants", Shorts: "pants", Kilt: "pants",
  Belt: "detail", Buckle: "detail", Strap: "detail",
  Beige: "clothing", Brown: "clothing", Black: "clothing", Light: "clothing",
  Gold: "detail", Detail: "detail", Red: "detail", Gem: "detail", Jewel: "detail",
};

function buildMaterialOverrides(matColors: MaterialColors): Record<string, string> | null {
  const overrides: Record<string, string> = {};
  let hasAny = false;
  for (const [matName, partKey] of Object.entries(MATERIAL_TO_PART)) {
    const colorVal = matColors[partKey];
    if (colorVal) {
      overrides[matName] = colorVal;
      hasAny = true;
    }
  }
  return hasAny ? overrides : null;
}

const ATTACK_RANGE = 4;
const JUMP_FORCE = 9;
const DOUBLE_JUMP_FORCE = 7;
const DASH_SPEED = 18;
const SHORYUKEN_LIFT = 10;
const EARTHQUAKE_SLAM = -15;
const LAUNCH_LIFT = 8;
const UPPERCUT_LIFT = 8;
const RISING_SLASH_LIFT = 7;
const BASE_PLAYER_RADIUS = 0.5;
const PLAYER_MASS = 5;
// `farming` is included so the wheelbarrow_idle / wheelbarrow_walk clips are
// loaded for the beached-boat push pose (lean against the hull + slow shuffle
// while WASD is held). They're cheap to add since the player already takes a
// pack hit from gestures_basic.
const PLAYER_EXTRA_PACKS: string[] = ["gestures_basic", "farming"];

// Valid WeaponType values from useGame, used to gate animation-pack
// loading by what's *actually* equipped in the mainHand slot. Anything
// not in this set (e.g. shovel, empty) falls back to "fists" so the
// player only loads sword packs when a sword is genuinely equipped.
const VALID_WEAPON_TYPES = new Set<WeaponType>([
  "sword", "greatsword", "staff", "wand", "bow", "axe", "poleaxe",
  "hammer", "dagger", "shield", "fists", "crossbow", "gun",
]);
function resolveEquippedWeaponType(equippedTypeRaw: string | undefined): WeaponType {
  if (equippedTypeRaw && VALID_WEAPON_TYPES.has(equippedTypeRaw as WeaponType)) {
    return equippedTypeRaw as WeaponType;
  }
  return "fists";
}
const AOE_STATES = new Set(["earthquake", "spinSlash", "skill1", "skill3", "skill5", "classAbility", "classAbility2", "classAbility3"]);
const CLEAVE_STATES = new Set(["attack1", "attack2", "attack3", "heavyAttack", "counterStrike", "dashAttack", "risingSlash", "chargeAttack", "chargeAttackMax", "chargeFist", "chargeStrike"]);
// Combat states that arm the WeaponTrail ribbon and publish their id to
// `attackIdRef` so per-attack width/length scaling kicks in. Adding spinSlash
// here (which CLEAVE_STATES omits because spinSlash uses a wider AOE path).
const TRAIL_SWING_STATES = new Set([
  "attack1", "attack2", "attack3",
  "heavyAttack", "counterStrike", "spinSlash", "risingSlash", "dashAttack",
  "chargeAttack", "chargeAttackMax", "chargeFist", "chargeStrike",
]);
const MAX_CLEAVE = 3;

const BUFFERABLE_EVENTS = new Set(["LMB", "RMB_DOWN", "DASH", "ROLL", "JUMP", "KEY_1", "KEY_2", "KEY_3", "KEY_4", "KEY_5", "CLASS_ABILITY", "CLASS_ABILITY_2", "CLASS_ABILITY_3"]);
const ACTIVE_COMBAT_STATES = new Set([
  "attack1", "attack2", "attack3", "heavyAttack", "dashAttack",
  "spinSlash", "counterStrike", "risingSlash", "uppercut", "jumpBash",
  "earthquake", "skill1", "skill2", "skill3", "skill4", "skill5",
  "classAbility", "classAbility2", "classAbility3", "rolling", "pop",
  "chargeAttack", "chargeAttackMax", "chargeFist", "chargeStrike",
]);
// Substates of the LMB hold-to-charge wind-up. Player tracks chargeTime
// here and dispatches CHARGE_TIER_1/2 when the configured thresholds are
// crossed; LMB_UP commits the appropriate release.
const CHARGE_HOLD_STATES = new Set(["charging", "charged1", "charged2"]);

// Module-scope ground sampler bound to the main game's procedural
// heightmap. Defined once so the per-frame sampler resolution doesn't
// allocate a fresh closure on every tick.
const heightmapGroundSampler = (x: number, z: number): number =>
  getTerrainHeight(x, z, globalHeightData);

interface PlayerProps {
  onPositionUpdate: (pos: THREE.Vector3) => void;
  spawnPosition?: [number, number, number];
  /**
   * When true (default), the player snaps and slope-samples against the
   * main game's procedural heightmap (`globalHeightData`). Scenes that
   * have their own colliders and don't publish a heightmap (e.g. the
   * tutorial island) should pass `false` so the body resolves naturally
   * against Rapier contacts instead of being yanked toward a stale
   * heightmap baked from another scene.
   */
  useTerrainHeightmap?: boolean;
  /**
   * Optional ground-height sampler for scenes that don't use the main
   * heightmap but still want the slope polish (uphill speed loss,
   * downhill boost, lateral nudge, step-up assist, click-move ground
   * pick, foot-snap). Receives world-space (x, z) and returns the
   * ground y at that point — typically a downward raycast against the
   * scene's terrain mesh.
   *
   * Only consulted when `useTerrainHeightmap` is false. Pass a stable
   * (memoised) callback to avoid extra work; allocations are cheap but
   * unnecessary churn is wasted.
   */
  groundSampler?: ((x: number, z: number) => number) | null;
}

const ACTION_STATES = new Set([
  "attack1", "attack2", "attack3",
  "dashAttack",
  "skill1", "skill2", "skill3", "skill4", "skill5",
  "classAbility", "classAbility2", "classAbility3", "rolling",
  "pop", "earthquake", "jumpBash",
  "blocking",
  "uppercut", "spinSlash", "counterStrike",
  "risingSlash", "heavyAttack",
  "chargeAttack", "chargeAttackMax", "chargeFist", "chargeStrike",
]);

// --- Charge glow ----------------------------------------------------------
// Re-tints every material on the right-hand weapon group based on the
// current charge tier. Materials are cloned the first time we touch them
// (so we don't permanently mutate cached/shared materials) and the
// original emissive color + intensity are stashed in userData so tier-0
// reset is exact.
interface ChargedUserData {
  __chargeOwned?: boolean;
  __origEmissive?: number;
  __origEmissiveIntensity?: number;
}
// Material types that expose `emissive` + `emissiveIntensity`. Both PBR
// and Phong materials share the same shape for these properties.
type EmissiveMaterial = THREE.MeshStandardMaterial | THREE.MeshPhongMaterial;
function isEmissiveMaterial(m: THREE.Material): m is EmissiveMaterial {
  return m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhongMaterial;
}

const CHARGE_GLOW_COLORS = [
  0x000000, // tier 0 — restore original
  0x4488ff, // tier 1 — cool blue glow
  0xffaa44, // tier 2 — hot orange glow
];
const CHARGE_GLOW_INTENSITY = [0, 1.4, 2.8];

function applyChargeGlow(boneRoot: THREE.Object3D | null, tier: 0 | 1 | 2) {
  if (!boneRoot) return;
  // Walk the weapon_* groups attached to the hand bone.
  for (const child of boneRoot.children) {
    if (!child.name.startsWith("weapon_")) continue;
    child.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mesh = obj;
      const swap = (m: THREE.Material): THREE.Material => {
        if (!isEmissiveMaterial(m)) return m;
        let owned = m;
        const ud = owned.userData as ChargedUserData;
        if (!ud.__chargeOwned) {
          owned = m.clone() as EmissiveMaterial;
          const newUd = owned.userData as ChargedUserData;
          newUd.__chargeOwned = true;
          newUd.__origEmissive = m.emissive.getHex();
          newUd.__origEmissiveIntensity = m.emissiveIntensity;
        }
        const ownedUd = owned.userData as ChargedUserData;
        if (tier === 0) {
          owned.emissive.setHex(ownedUd.__origEmissive ?? 0);
          owned.emissiveIntensity = ownedUd.__origEmissiveIntensity ?? 0;
        } else {
          owned.emissive.setHex(CHARGE_GLOW_COLORS[tier]);
          owned.emissiveIntensity = CHARGE_GLOW_INTENSITY[tier];
        }
        return owned;
      };
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(swap);
      } else {
        mesh.material = swap(mesh.material);
      }
    });
  }
}

function PlayerModel({
  onPositionUpdate,
  spawnPosition = [0, 3, 0],
  useTerrainHeightmap = true,
  groundSampler,
}: PlayerProps) {
  const modelRef = useRef<THREE.Group>(null);
  const playerPos = useRef(new THREE.Vector3(spawnPosition[0], spawnPosition[1], spawnPosition[2]));
  const lastAnimPlayed = useRef<string>("");
  const groundedFrames = useRef(0);
  const isGrounded = useRef(true);
  const actionTimer = useRef(0);
  // Idle fidget rotation: count seconds the player has been continuously
  // idle (no movement, no combat) and periodically trigger a one-shot idle
  // variant (idle_alt / idle_alt2 / idle_alt3) so the character looks alive
  // when the player isn't touching anything. Reset on any movement or hit.
  const idleFidgetAccum = useRef(0);
  const nextFidgetAt = useRef(8 + Math.random() * 10);
  const fidgetInFlight = useRef(false);
  // Weapon-swap detection: when the player picks a different weapon TYPE
  // mid-game, play an unsheath flourish so the change has visible weight.
  // Tracked as a ref so the very first mount doesn't trigger a draw.
  const prevWeaponTypeRef = useRef<WeaponType | null>(null);
  const lastHealthRef = useRef(useSurvival.getState().health);
  const hitAnimTimer = useRef(0);
  const healthRegenTimer = useRef(0);
  const healAccumRef = useRef(0);
  const useItemCooldown = useRef(false);
  // Tracks the current sub-state of the boat-push override pose:
  //   null     → not attached / pose released
  //   "lean"   → standing braced against the stern (no input)
  //   "shuffle"→ slow forward gait while WASD pushes the boat
  // We toggle on attach/detach edges and on input transitions from the
  // useFrame early-out so the player visibly leans into the boat instead
  // of standing in idle while it slides forward.
  const boatPoseStateRef = useRef<null | "lean" | "shuffle">(null);
  const prevKeys = useRef<Record<string, boolean>>({});
  const damageApplied = useRef(false);
  // Fall-damage / floating bookkeeping. peakAirY tracks the highest point
  // reached since leaving the ground (set to a sentinel while grounded).
  // FALL_DAMAGE_THRESHOLD_M is the safe drop; every meter beyond it costs
  // FALL_DAMAGE_PER_METER_PCT of the character's max health.
  const peakAirY = useRef<number | null>(null);
  const FALL_DAMAGE_THRESHOLD_M = 8;
  const FALL_DAMAGE_PER_METER_PCT = 0.10;
  // Tracks whether the floating airborne pose is currently latched, so we
  // only re-trigger the override when the predicate changes (avoids spam).
  const floatingActive = useRef(false);
  // --- Shuffle (double-tap-direction) bookkeeping --------------------------
  // Per-direction "last tap timestamp" so we can recognise the second tap
  // as a double-tap inside SHUFFLE_DOUBLE_TAP_MS. SHUFFLE_COOLDOWN_MS
  // throttles re-entry so a held key doesn't spam shuffles after the
  // initial trigger.
  const SHUFFLE_DOUBLE_TAP_MS = 280;
  const SHUFFLE_COOLDOWN_MS = 600;
  const lastTapAt = useRef<{ forward: number; back: number; left: number; right: number }>({
    forward: 0, back: 0, left: 0, right: 0,
  });
  const lastShuffleAt = useRef(0);
  // Edge tracker for movement keys so we only register a "tap" on key-down.
  const prevDirHeld = useRef<{ forward: boolean; back: boolean; left: boolean; right: boolean }>({
    forward: false, back: false, left: false, right: false,
  });
  // Cross-thread flag set by the dodge-proc listener (fired from inside
  // useSurvival.takeDamage). useFrame consumes it on the next tick and
  // triggers the dodge_proc override on the controller. Using a ref
  // keeps the store callback off the React render path.
  const dodgeProcPending = useRef(false);
  const [hitParticleActive, setHitParticleActive] = useState(false);
  const hitParticlePos = useRef<[number, number, number]>([0, 0, 0]);
  const [healParticleActive, setHealParticleActive] = useState(false);
  // Standalone slot for the parry-block spark/flash. Kept separate from the
  // attack-hit `hitParticleActive` slot so a perfect block doesn't clobber
  // a melee swing that might be running on the same frame.
  const [blockSparkActive, setBlockSparkActive] = useState(false);
  const blockSparkPos = useRef<[number, number, number]>([0, 0, 0]);
  const [skill1Active, setSkill1Active] = useState(false);
  const [skill2Active, setSkill2Active] = useState(false);
  const [earthquakeActive, setEarthquakeActive] = useState(false);
  const [skill3Active, setSkill3Active] = useState(false);
  const [dashActive, setDashActive] = useState(false);
  const [skill5Active, setSkill5Active] = useState(false);
  const [slashActive, setSlashActive] = useState(false);
  const [fireballActive, setFireballActive] = useState(false);
  const [iceLanceActive, setIceLanceActive] = useState(false);
  const [rockActive, setRockActive] = useState(false);
  const [rootActive, setRootActive] = useState(false);
  const [distortionActive, setDistortionActive] = useState(false);
  const [arrowActive, setArrowActive] = useState(false);
  const [boltActive, setBoltActive] = useState(false);
  const [bulletActive, setBulletActive] = useState(false);
  const [magicMissileActive, setMagicMissileActive] = useState(false);
  const [lightningActive, setLightningActive] = useState(false);
  const [levelUpActive, setLevelUpActive] = useState(false);
  const [critFlashActive, setCritFlashActive] = useState(false);
  const critFlashPos = useRef<[number, number, number]>([0, 0, 0]);
  // Charge-release shockwave VFX. `seq` is bumped every time a chargeStrike
  // lands so the effect re-arms even when the impact point is unchanged.
  const [chargeImpactSeq, setChargeImpactSeq] = useState(0);
  const chargeImpactPos = useRef<[number, number, number]>([0, 0, 0]);
  const facingDir = useRef<[number, number, number]>([0, 0, -1]);
  const prevCombatState = useRef<string>("idle");
  const smoothedY = useRef(spawnPosition[1]);
  const currentTiltX = useRef(0);
  const currentSlopeModifier = useRef(1.0);
  const moveDirVec = useRef(new THREE.Vector3());
  const clickMoveTarget = useRef<THREE.Vector3 | null>(null);
  const clickMoveRaycaster = useRef(new THREE.Raycaster());
  const clickMovePlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const slopeSampleDir = useRef(new THREE.Vector3());
  // Always-fresh resolved ground sampler. useFrame closes over the
  // current props directly, but the click-to-move mouse handler is set
  // up inside a useEffect whose deps intentionally don't list every
  // prop — we route through a ref so it reads the live sampler instead
  // of a stale capture.
  const groundSamplerRef = useRef<((x: number, z: number) => number) | null>(null);
  groundSamplerRef.current =
    useTerrainHeightmap && globalHeightData
      ? heightmapGroundSampler
      : (groundSampler ?? null);
  const stuckTimer = useRef(0);
  const lastMovePos = useRef(new THREE.Vector3(spawnPosition[0], spawnPosition[1], spawnPosition[2]));
  const stuckNudgeDir = useRef(new THREE.Vector3());
  const jumpForceApplied = useRef(false);

  const inputBuffer = useRef<{ event: CombatEvent; staminaCost: number } | null>(null);
  const inputBufferTime = useRef(0);
  const INPUT_BUFFER_WINDOW = 0.4;

  // Fighting-game motion-input parser: only fed (and only consulted) while
  // the combat machine is in the `blocking` state, mirroring Annihilate's
  // RoleControls block-gated `seqKey` buffer.
  const motionBuffer = useRef(new MotionInputBuffer());

  const combatActor = useRef(createActor(combatMachine));

  // Charge-attack hold state (LMB held to ramp through tiers)
  const chargeHoldMs = useRef(0);
  const chargeTier = useRef<0 | 1 | 2>(0);
  // Mirrors `currentCombatState === "chargeStrike"` for the WeaponTrail's
  // climax-palette flash. Updated in the same per-state-change branch
  // that sets slashActive so visuals stay in sync with the swing window.
  const chargeStrikeFlashRef = useRef(false);
  // Tracks the most recently entered swing's combat-state id so the
  // WeaponTrail can pull per-attack width / length scaling from SwingArcs
  // without re-rendering every frame. Cleared (null) when no swing is
  // active so WeaponTrail falls back to the base weapon profile.
  const attackIdRef = useRef<string | null>(null);
  const [flashTier, setFlashTier] = useState<1 | 2>(1);
  const [flashSeq, setFlashSeq] = useState(0);

  // Alias for CombatPhysics integration (applyCombatImpulse needs applyImpulse)
  const rigidBodyRef = rbRef;

  useEffect(() => {
    combatActor.current.start();
    // Preload mesh VFX models (rasengan, tornado, cast circle, explosions, etc.)
    preloadMeshVFX().catch(() => {});
    return () => {
      combatActor.current.stop();
      blockGuard.setBlocking(false);
      useChargeHud.getState().clear();
    };
  }, []);

  const selectedCharacter = useGame((s) => s.selectedCharacter);
  const physicsConfig = useGameConfig((s) => s.config.physics);
  const { camera, gl } = useThree();
  const charScale = selectedCharacter.scale;
  const charSpeedMult = selectedCharacter.speedMultiplier;
  const charHeight = selectedCharacter.baseHeight * charScale;
  const matOverrides = useMemo(
    () => buildMaterialOverrides(selectedCharacter.materialColors),
    [selectedCharacter.materialColors]
  );

  // The animation pack must reflect what's *actually* in the player's main
  // hand — not the character template's default weapon. Subscribe to the
  // equipped mainHand item's weaponType so when the equipment slot is empty
  // (or holds a non-combat tool like a shovel) we load the unarmed "fists"
  // pack rather than spamming the sword pack onto an empty hand.
  const equippedMainHandWeaponType = useEquipment(
    (s) => s.equipped.mainHand?.weaponType
  );
  const activeWeaponType = resolveEquippedWeaponType(equippedMainHandWeaponType);

  // Migrated to the new controller pipeline: speed-driven locomotion blend
  // tree (idle ↔ walk ↔ run ↔ sprint) plus a bone-masked upper-body combat
  // layer for punch / uppercut / hit. The public surface stays identical to
  // useCharacterModel so the rest of this component is unchanged.
  const controller = useCharacterController({
    modelPath: selectedCharacter.modelPath,
    targetHeight: charHeight,
    materialColorOverrides: matOverrides,
    weaponType: activeWeaponType,
    // Always load the basic-gestures pack on the player so all 15 numpad
    // emotes and the support-idle blends are available regardless of the
    // active weapon. NPCs that don't need gestures stay lean.
    // Module-scope constant so the array identity is stable across renders;
    // an inline literal would re-fire useCharacterModel's pack-injection
    // effect on every render and rebuild the mixer's actions, freezing the
    // character at rest pose ("T-pose / horse-pose flicker").
    extraPacks: PLAYER_EXTRA_PACKS,
  });
  const {
    scene, playAnimation, update, setMovementSpeed, transitionLock, rightHand, leftHand, head,
    sendEvent: sendCharEvent, setGrounded: setCharGrounded, bounds: measuredBounds,
  } = controller;

  // Impact flinch controller — procedural bone-level recoil on damage.
  const playerFlinchRef = useRef<ImpactFlinchController | null>(null);
  const playerFlinchDirRef = useRef(new THREE.Vector3());
  useEffect(() => {
    if (scene) {
      playerFlinchRef.current = new ImpactFlinchController(scene);
    }
    return () => { playerFlinchRef.current?.dispose(); };
  }, [scene]);

  // Derive the physics body's radius from the actual rendered, normalized
  // mesh bounds
  // come in at wildly different native scales (e.g. 457 units → normalized
  // to ~1.8 m) and historically the collider stayed at a hardcoded
  // 0.5 m sphere completely decoupled from the visible character. Now the
  // collider tracks the character's true XZ footprint.
  //
  // Falls back to the legacy formula for the first frame before bounds
  // are measured, then re-keys the RigidBody so the collider rebuilds at
  // the correct size as soon as the measurement lands.
  const PLAYER_RADIUS = useMemo(() => {
    const fallback = BASE_PLAYER_RADIUS * Math.max(charScale, 0.1);
    if (!measuredBounds) return fallback;
    // Round to 2 decimals so micro float drift across re-renders doesn't
    // re-key the RigidBody every frame.
    const r = Math.round(measuredBounds.radiusXZ * 100) / 100;
    return THREE.MathUtils.clamp(r, 0.3, 1.5);
  }, [measuredBounds, charScale]);

  // Vertical half-extent of the cylindrical part of the player capsule.
  // Total capsule height = 2*halfHeight + 2*radius, sized to wrap the
  // measured character height. Clamped to a small positive minimum so
  // very stubby characters still produce a valid capsule.
  const PLAYER_HALF_HEIGHT = useMemo(() => {
    if (!measuredBounds) return Math.max(0.1, BASE_PLAYER_RADIUS * Math.max(charScale, 0.1));
    const h = Math.max(0.4, measuredBounds.height);
    const halfH = Math.max(0.05, (h - 2 * PLAYER_RADIUS) / 2);
    return Math.round(halfH * 100) / 100;
  }, [measuredBounds, PLAYER_RADIUS, charScale]);

  // Eye-height for the Rapier line-of-sight raycast (combat / aggro). With
  // the collider anchored at the feet (vertex y=0 lives at body.y),
  // `playerPos.y` IS the foot plane, so the eye sits exactly
  // `height * 0.9` above it.
  const eyeOffsetY = useMemo(() => {
    if (!measuredBounds) return 1.0;
    return measuredBounds.height * 0.9;
  }, [measuredBounds]);

  // Convex-hull point cloud — DECLARED HERE but the actual sampling
  // effect lives below the morph effect so it runs AFTER bone scales
  // have been applied. See the hull effect for full notes.
  const [hullPoints, setHullPoints] = useState<Float32Array | null>(null);

  // Cheap signature so the rigid-body re-keys (and the collider
  // rebuilds) when the hull actually changes — not on every render.
  const hullSig = useMemo(
    () => (hullPoints ? pointsSignature(hullPoints) : "none"),
    [hullPoints],
  );

  // Translate combatMachine state transitions into semantic events on the
  // parallel character state machine. This is what makes the new machine
  // the source of truth for animation: combat / jump / block input flows
  // through combatMachine for combo bookkeeping, and the resulting state
  // transitions get fanned out as JUMP / ATTACK_LIGHT / BLOCK_START / etc.
  // so the controller can route them to the right animator slot.
  useEffect(() => {
    if (!sendCharEvent) return;
    const actor = combatActor.current;
    let prev: string | null = null;
    const sub = actor.subscribe((snap) => {
      const cur = snap.value as string;
      if (cur === prev) return;

      // Leaving blocking → release the held block layer and reset the
      // motion-input buffer so half-finished motions don't leak into the
      // next time the player blocks.
      if (prev === "blocking" && cur !== "blocking") {
        sendCharEvent({ type: "BLOCK_END" });
        blockGuard.setBlocking(false);
        motionBuffer.current.clear();
      }

      // Entering blocking → hold the block layer until release.
      if (cur === "blocking") {
        sendCharEvent({ type: "BLOCK_START" });
        blockGuard.setBlocking(true);
      }

      // ── NEW: Fire Rapier impulse + mesh VFX on every combat state change ──
      {
        const pos = playerPos.current;
        const faceY = modelRef.current?.rotation.y ?? 0;
        const facing: [number, number] = [Math.sin(faceY), Math.cos(faceY)];
        const fatigueMult = useFatigue.getState().modifiers.speedMult;
        const rb = rigidBodyRef.current;
        applyCombatImpulse(cur, rb, facing, [pos.x, pos.y, pos.z], fatigueMult);
        const sc = (window as any).__threeScene;
        if (sc) {
          spawnCombatMeshVFX(
            cur, prev ?? "idle", sc,
            [pos.x, pos.y, pos.z], facing,
            selectedCharacter.weaponRight,
            rightHand.current, null,
          );
        }
        if (rightHand.current) {
          const tipPos = new THREE.Vector3();
          rightHand.current.getWorldPosition(tipPos);
          fireWeaponVFX(cur, selectedCharacter.weaponRight, [tipPos.x, tipPos.y, tipPos.z], [facing[0], 0, facing[1]]);
        }
      }

      // Light combo chain: attack1 starts the combo, attack2/3 advance it.
      if (cur === "attack1") sendCharEvent({ type: "ATTACK_LIGHT" });
      else if (cur === "attack2" || cur === "attack3") sendCharEvent({ type: "ATTACK_COMBO_NEXT" });

      // Heavy / charged swings all map to the heavy slot in the parallel
      // combat region (they're upper-body layered with the heavyAttack clip).
      if (cur === "heavyAttack") sendCharEvent({ type: "ATTACK_HEAVY" });

      // Locomotion airborne: jump and double-jump both fire JUMP, falling
      // fires FALL. Returning to idle from any airborne state fires LAND.
      const wasAirborne = prev === "jumping" || prev === "doubleJumping" || prev === "falling" || prev === "jumpBash" || prev === "earthquake";
      if (cur === "jumping" || cur === "doubleJumping") {
        sendCharEvent({ type: "JUMP" });
      } else if (cur === "falling") {
        sendCharEvent({ type: "FALL" });
      } else if (cur === "idle" && wasAirborne) {
        sendCharEvent({ type: "LAND" });
      }

      prev = cur;
    });
    return () => sub.unsubscribe();
  }, [sendCharEvent]);

  useEffect(() => {
    if (scene && selectedCharacter.bodyMorph) {
      const boneNames: string[] = [];
      scene.traverse((child: any) => { if ((child as THREE.Bone).isBone) boneNames.push(child.name); });
      const bodyParts = detectBodyParts(boneNames);
      applyBodyMorph(scene, selectedCharacter.bodyMorph, bodyParts);
    }
  }, [scene, selectedCharacter.bodyMorph]);

  // Hull sampling — runs AFTER the morph effect above so bone scales
  // are applied before we ask `applyBoneTransform` for skinned vertex
  // positions. The points are in modelRef-LOCAL coordinates, which
  // equals the rigid body's local frame because the rigid body and
  // modelRef share the same world position (both seeded from
  // spawnPosition / lastPos). Recomputed on:
  //   - scene swap (different character)
  //   - measuredBounds change (re-normalized scale / new model)
  //   - body morph change (bone scales reshape the silhouette)
  useEffect(() => {
    if (!scene || !measuredBounds) return;
    const grp = modelRef.current;
    if (!grp) return;
    grp.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(grp.matrixWorld).invert();
    const pts = sampleCharacterPoints(scene, inv);
    if (pts.length >= 12) {
      setHullPoints(pts);
    } else {
      console.warn("[Player] Hull sampling produced too few points; staying on capsule fallback.");
      setHullPoints(null);
    }
  }, [scene, measuredBounds, selectedCharacter.bodyMorph]);

  useEffect(() => {
    if (scene) {
      onModelProcessed();
    }
  }, [scene]);

  // Publish active rig bones (hands + head) to the global registry
  // INDEPENDENTLY of the weapon-attach effect below. Doing it here means
  // unarmed/fists characters still expose their head/hand bones to
  // downstream consumers (camera anchor, head look-at, gizmo overlay,
  // future helm cosmetic), instead of leaving the registry null whenever
  // the player happens to be empty-handed. Refs from useCharacterModel are
  // reference-stable, so this only re-fires on actual scene swap.
  useEffect(() => {
    if (!scene) return;
    setPlayerBones(rightHand.current, leftHand.current, head.current);
    // Push the hand bones into the animator so layered combat states can
    // apply per-attack swing-arc splines as additive offsets on top of the
    // mixer pose. Idempotent — safe to call again on later scene swaps.
    controller.animator?.current?.setHandBones(rightHand.current, leftHand.current);
    return () => {
      setPlayerBones(null, null, null);
      controller.animator?.current?.setHandBones(null, null);
    };
  }, [scene, rightHand, leftHand, head, controller.animator]);

  // Subscribe to dodge-proc broadcasts from the survival store. Only
  // arms a flag — the actual override is fired in useFrame so it shares
  // the same gating logic as shuffles (skip while dead / in damage state).
  useEffect(() => {
    return onDodgeProc(() => {
      dodgeProcPending.current = true;
    });
  }, []);

  // Weapon-swap unsheath flourish. When the user picks a different weapon
  // TYPE mid-game (sword → hammer, etc.), play the unsheath animation as
  // a one-shot override so the swap reads visually. The first mount stores
  // the initial type without triggering a draw. Animation packs load
  // asynchronously after a swap, so we retry the trigger a few times until
  // the unsheath action exists in the library; otherwise the call is a
  // no-op and we silently fall back to the next weapon-pack idle.
  useEffect(() => {
    const wType = selectedCharacter.weaponRight;
    const prev = prevWeaponTypeRef.current;
    prevWeaponTypeRef.current = wType;
    if (!prev || prev === wType) return;
    if (wType === "fists" || !wType) return;

    let cancelled = false;
    let attempts = 0;
    let timeoutId: number | null = null;
    const tryDraw = () => {
      if (cancelled) return;
      const lib = controller.library?.current;
      if (lib && lib.getAction("unsheath")) {
        controller.triggerOverride("unsheath");
        return;
      }
      if (attempts++ < 6) {
        timeoutId = window.setTimeout(tryDraw, 150);
      }
    };
    tryDraw();
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [selectedCharacter.weaponRight, controller]);

  useEffect(() => {
    cleanWeaponsFromBone(rightHand.current);
    cleanWeaponsFromBone(leftHand.current);

    if (!scene) return;

    const wRight = selectedCharacter.weaponRight;
    const wLeft = selectedCharacter.weaponLeft;
    if (wRight === "fists" && (!wLeft || wLeft === "fists")) {
      onWeaponsAttached(wRight);
      return;
    }

    let cancelled = false;

    const boneNames: string[] = [];
    scene.traverse((child: any) => { if ((child as THREE.Bone).isBone) boneNames.push(child.name); });
    const skelType = detectSkeletonType(boneNames);

    if (!rightHand.current && !leftHand.current) {
      console.warn(`[Player] No hand bones found on model (skeleton: ${skelType}, bones: ${boneNames.length})`);
    }

    const gripData = buildWeaponGripData(wRight, wLeft, skelType, 1.0);
    const userOffset = selectedCharacter.weaponOffset;

    const attachToHand = (
      bone: THREE.Object3D | null,
      data: { type: WeaponType; transform: GripTransform } | null,
      hand: "right" | "left"
    ) => {
      if (!bone || !data || data.type === "fists") return;

      const weaponModelId = data.type === wRight
        ? selectedCharacter.weaponModelRight
        : data.type === wLeft
          ? selectedCharacter.weaponModelLeft
          : (hand === "right" ? selectedCharacter.weaponModelRight : selectedCharacter.weaponModelLeft);
      if (weaponModelId) {
        loadWeaponModel(data.type, weaponModelId).then((modelGroup) => {
          if (cancelled || !bone.parent) return;
          cleanWeaponsFromBone(bone);
          modelGroup.name = `weapon_${data.type}`;
          applyWeaponTransformToBone(modelGroup, bone, scene, data, hand, userOffset);
        }).catch((err) => {
          if (cancelled) return;
          console.warn(`[Player] Weapon model load failed for ${weaponModelId}, using procedural fallback:`, err);
          attachProceduralWeapon(bone, data, hand);
        });
        return;
      }

      attachProceduralWeapon(bone, data, hand);
    };

    const attachProceduralWeapon = (
      bone: THREE.Object3D,
      data: { type: WeaponType; transform: GripTransform },
      hand: "right" | "left"
    ) => {
      // Procedural fallback now flows through the SAME normalize pipeline
      // as GLB-loaded weapons so the grip-anchor + axis alignment match.
      const grp = buildProceduralWeaponGroup(data.type);
      grp.name = `weapon_${data.type}`;
      applyWeaponTransformToBone(grp, bone, scene, data, hand, userOffset);
    };

    attachToHand(rightHand.current, gripData.right, "right");
    attachToHand(leftHand.current, gripData.left, "left");
    onWeaponsAttached(wRight);

    return () => {
      cancelled = true;
      cleanWeaponsFromBone(rightHand.current);
      cleanWeaponsFromBone(leftHand.current);
    };
    // NOTE: weaponOffset deliberately excluded — live offset updates are
    // applied by the in-place mutator effect below to avoid rebuilding the
    // weapon group on every gizmo drag tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, rightHand, leftHand, selectedCharacter.weaponRight, selectedCharacter.weaponLeft, selectedCharacter.weaponModelRight, selectedCharacter.weaponModelLeft]);

  // Attach back-strap accessories (e.g. quiver / arrow bag) to the spine bone
  // looked up via `SPINE2_ALIASES`. Same lifecycle pattern as the hand-weapon
  // effect above: clear any existing accessory child, asynchronously load the
  // GLB, then add it to the bone — bailing out if either the character's
  // `backAccessoryId` changes mid-load (cancelled) or the bone vanishes
  // (model swap). The cleanup pass removes it on unmount or id-change.
  useEffect(() => {
    if (!scene) return;
    const accId = selectedCharacter.backAccessoryId;
    const backBone = findBoneByAlias(scene, SPINE2_ALIASES);
    if (!backBone) return;

    const ACCESSORY_NAME_PREFIX = "back_accessory_";
    const removeExisting = () => {
      for (let i = backBone.children.length - 1; i >= 0; i--) {
        const child = backBone.children[i];
        if (child.name.startsWith(ACCESSORY_NAME_PREFIX)) {
          backBone.remove(child);
        }
      }
    };
    removeExisting();

    const entry = getBackAccessoryModel(accId);
    if (!entry) return;

    let cancelled = false;
    loadAsset(entry.path, "medium", "back_accessory").then((gltf) => {
      if (cancelled || !backBone.parent) return;
      removeExisting();

      const cloned = gltf.scene.clone(true);
      // Normalise so the longest dimension matches `defaultLength` from the
      // registry. Source GLBs come out of the medieval pack at varying real-
      // world sizes, so without this the quiver can render absurdly large.
      cloned.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(cloned);
      const size = new THREE.Vector3();
      box.getSize(size);
      const longest = Math.max(size.x, size.y, size.z, 1e-4);
      const baseScale = entry.defaultLength / longest;

      const wrapper = new THREE.Group();
      wrapper.name = `${ACCESSORY_NAME_PREFIX}${entry.id}`;
      wrapper.add(cloned);

      // The bone has the parent skeleton's accumulated scale baked in (the
      // armature root scales to fit `targetHeight`). Cancel that out so the
      // accessory ends up at its real-world size in world units.
      const worldScale = new THREE.Vector3();
      backBone.getWorldScale(worldScale);
      const inv = 1 / Math.max(worldScale.x, 1e-4);
      wrapper.scale.setScalar(baseScale * inv);

      // Place the bag on the spine, slightly behind the back. The Spine2
      // bone in mixamo/kaykit rigs has +Y as the up-along-spine axis and
      // +Z as forward; placing at z=-0.18 nudges the bag onto the back.
      // The mild tilt + roll fits a quiver/bag against the upper back so it
      // reads as worn rather than floating.
      wrapper.position.set(0, 0.05, -0.18);
      wrapper.rotation.set(-0.3, 0, 0.4);

      wrapper.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          (c as THREE.Mesh).castShadow = true;
        }
      });

      backBone.add(wrapper);
    }).catch((err) => {
      if (!cancelled) {
        console.warn(`[Player] Back accessory load failed for ${accId}:`, err);
      }
    });

    return () => {
      cancelled = true;
      removeExisting();
    };
  }, [scene, selectedCharacter.backAccessoryId]);

  // Live-update weapon group transforms when only the offset changes (gizmo
  // drag, slider scrub). Mutates in place so the gizmo's `object` ref stays
  // valid throughout the drag.
  useEffect(() => {
    const off = selectedCharacter.weaponOffset;
    if (!off) return;
    const updateBone = (bone: THREE.Object3D | null, hand: "right" | "left") => {
      if (!bone) return;
      for (const child of bone.children) {
        const wb = getWeaponBaseUserData(child);
        if (!wb || wb.hand !== hand) continue;
        const uPos = hand === "right" ? off.rightPos : off.leftPos;
        const uRot = hand === "right" ? off.rightRot : off.leftRot;
        const uScl = hand === "right" ? off.rightScale : off.leftScale;
        child.position.set(wb.basePos[0] + uPos[0], wb.basePos[1] + uPos[1], wb.basePos[2] + uPos[2]);
        child.rotation.set(wb.baseRot[0] + uRot[0], wb.baseRot[1] + uRot[1], wb.baseRot[2] + uRot[2]);
        const sx = uScl ? uScl[0] : 1;
        const sy = uScl ? uScl[1] : 1;
        const sz = uScl ? uScl[2] : 1;
        child.scale.set(wb.boneInv * sx, wb.boneInv * sy, wb.boneInv * sz);
      }
    };
    updateBone(rightHand.current, "right");
    updateBone(leftHand.current, "left");
  }, [selectedCharacter.weaponOffset, rightHand, leftHand]);

  const rbRef = useRef<RapierRigidBody>(null);
  // Direct access to the Rapier world + module for raycasting
  // (line-of-sight, wall-occlusion checks). Held for the component lifetime.
  const { world: rapierWorld, rapier: rapierModule } = useRapier();

  // Last-known body transform, persisted across re-mounts so the player
  // doesn't snap back to spawn for a frame when the RigidBody re-keys
  // (e.g. when measured PLAYER_RADIUS / PLAYER_HALF_HEIGHT lands and
  // the collider rebuilds). Initialised from spawnPosition; updated
  // whenever rbRef is live and we sample the body.
  const lastPos = useRef<[number, number, number]>([...spawnPosition]);
  const lastVel = useRef<[number, number, number]>([0, 0, 0]);

  // --- Climbing controller state ---------------------------------------
  // Latched per climb session. `active` is the source-of-truth — it goes
  // true when we mount and false when we dismount/topout. Captured wall
  // info (normal / right tangent / topY / kind) is locked at mount time
  // so the controller doesn't thrash if the player slips out of the
  // sensor briefly. `gravityWasZeroed` records whether we still owe the
  // body a gravityScale restore on dismount, so we don't accidentally
  // leave it disabled across an interrupted climb.
  const climbState = useRef<{
    active: boolean;
    kind: "wall" | "ladder";
    normal: THREE.Vector3;
    right: THREE.Vector3;
    anchorXZ: { x: number; z: number };
    topY: number;
    /** Frame counter since mount — used to gate the topout check until
     *  the player is actually well inside the climb (avoids an instant
     *  TOPOUT on a wall whose top edge is below the mount Y). */
    frames: number;
    gravityWasZeroed: boolean;
  }>({
    active: false,
    kind: "wall",
    normal: new THREE.Vector3(0, 0, 1),
    right: new THREE.Vector3(1, 0, 0),
    anchorXZ: { x: 0, z: 0 },
    topY: 0,
    frames: 0,
    gravityWasZeroed: false,
  });

  const setLinvel = (x: number, y: number, z: number) => {
    lastVel.current[0] = x; lastVel.current[1] = y; lastVel.current[2] = z;
    rbRef.current?.setLinvel({ x, y, z }, true);
  };
  const setTranslation = (x: number, y: number, z: number) => {
    lastPos.current[0] = x; lastPos.current[1] = y; lastPos.current[2] = z;
    rbRef.current?.setTranslation({ x, y, z }, true);
  };
  const getVel = (): [number, number, number] => {
    if (!rbRef.current) return [...lastVel.current];
    const v = rbRef.current.linvel();
    lastVel.current[0] = v.x; lastVel.current[1] = v.y; lastVel.current[2] = v.z;
    return [v.x, v.y, v.z];
  };
  const getPos = (): [number, number, number] => {
    if (!rbRef.current) return [...lastPos.current];
    const p = rbRef.current.translation();
    lastPos.current[0] = p.x; lastPos.current[1] = p.y; lastPos.current[2] = p.z;
    return [p.x, p.y, p.z];
  };

  // --- Beached-boat push bridge -----------------------------------------
  // The BeachedBoatsSystem (world/BeachedBoats.tsx) drives the boat each
  // frame and snaps the player to the boat's stern. It needs a way to
  // teleport the body and re-orient the visible model from outside this
  // component, so we expose a thin window callback for the duration of
  // the player's lifetime. The early-out in useFrame keys off the same
  // module's `__boatAttached` flag.
  useEffect(() => {
    (window as any).__pushBoatTeleportPlayer = (
      x: number, y: number, z: number, yaw: number,
    ) => {
      const rb = rbRef.current;
      if (rb) {
        rb.setTranslation({ x, y, z }, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        lastPos.current[0] = x; lastPos.current[1] = y; lastPos.current[2] = z;
        lastVel.current[0] = 0; lastVel.current[1] = 0; lastVel.current[2] = 0;
      }
      if (modelRef.current) modelRef.current.rotation.y = yaw;
    };
    return () => {
      delete (window as any).__pushBoatTeleportPlayer;
      (window as any).__boatAttached = false;
    };
  }, []);

  // --- F8 cheat HUD wiring ----------------------------------------------
  // Two flags read from `useCheats`:
  //   - flyMode  → gravity off, vertical input via Space (up) / sink (down)
  //   - noClip   → capsule collision groups dropped to 0 (phases through)
  // We subscribe per-field (not the whole store) so a `panelOpen` toggle
  // on the F8 HUD doesn't re-render the entire Player tree. Each derived
  // `*Active` boolean folds the master `enabled` switch in so the user
  // can leave individual flags ticked across F8 open/close cycles and
  // the player still resumes normal physics the moment cheats turn off.
  // The per-frame fly branch in useFrame still needs both `enabled` and
  // `flyMode` mid-tick — we read those via `useCheats.getState()` there
  // so the frame loop sees the current values without a stale closure.
  const cheatsEnabled = useCheats((s) => s.enabled);
  const cheatsFly = useCheats((s) => s.flyMode);
  const cheatsNoClip = useCheats((s) => s.noClip);
  const flyActive = cheatsEnabled && cheatsFly;
  const noClipActive = cheatsEnabled && cheatsNoClip;

  // Gravity scale follows fly mode. We restore to 1 on release so the
  // player resumes normal falling. Skips while no rb is mounted (re-key
  // window) — the next mount sees the prop's default and the effect
  // re-fires when rbRef populates because the `flyActive` dep is stable
  // until the user toggles. We also re-zero the velocity on release so
  // the player doesn't keep coasting at fly speed under gravity.
  useEffect(() => {
    const rb = rbRef.current;
    if (!rb) return;
    rb.setGravityScale(flyActive ? 0 : 1, true);
    if (!flyActive) {
      // Drop residual fly velocity so the player isn't launched.
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      lastVel.current[0] = 0; lastVel.current[1] = 0; lastVel.current[2] = 0;
    }
  }, [flyActive]);

  // No-clip flips the capsule collider's collision groups so it neither
  // solves nor reports contacts. Restored on release using the original
  // PLAYER mask so terrain / props / enemies hit again. We grab the
  // collider via rb.collider(0) — there is exactly one CapsuleCollider
  // on the body (see the JSX below), so index 0 is stable.
  useEffect(() => {
    const rb = rbRef.current;
    if (!rb) return;
    const collider = rb.collider(0);
    if (!collider) return;
    collider.setCollisionGroups(noClipActive ? 0 : COLLISION_MASKS.PLAYER);
  }, [noClipActive]);

  const [, getKeys] = useKeyboardControls();
  const { useStamina, regenStamina, hungerTick, isAlive } = useSurvival();
  const { getSelectedItem } = useInventory();
  const { enemies, damageEnemy } = useEnemyManager();
  const targetId = useTargeting((s) => s.targetId);
  const clearTarget = useTargeting((s) => s.clearTarget);
  const { phase, addScore, addKill, die, updateDayTime, addXP, incrementCombo, tickComboTimer, tickSkillCooldowns, getComboMultiplier, rollCrit, useSkillCooldown } = useGame();
  const { playHit, playSuccess, playHeavyImpact, playClimbMount, playClimbDismount, startClimbScrape, stopClimbScrape } = useAudio();
  const spawnDamageNumber = useDamageNumbers((s) => s.spawn);

  const sendCombat = useCallback((event: CombatEvent, staminaCost: number = 0) => {
    const currentState = combatActor.current.getSnapshot().value as string;

    if (BUFFERABLE_EVENTS.has(event.type) && ACTIVE_COMBAT_STATES.has(currentState)) {
      const remaining = actionTimer.current;
      if (remaining > 0 && remaining < INPUT_BUFFER_WINDOW) {
        inputBuffer.current = { event, staminaCost };
        inputBufferTime.current = INPUT_BUFFER_WINDOW;
        return;
      }
    }

    combatActor.current.send(event);
  }, []);

  const tryDamageEnemies = useCallback((damageAmount: number, range: number = ATTACK_RANGE, combatState?: string) => {
    const selectedItem = getSelectedItem();
    const bonusDamage = selectedItem?.damage || 0;
    let baseDamage = damageAmount + bonusDamage;

    const charId = useSurvival.getState().activeCharacterId;
    const playerStats = getCachedPlayerStats(charId);

    const wType = selectedCharacter.weaponRight;
    const isMagicWeapon = wType === "staff" || wType === "wand";

    if (playerStats) {
      baseDamage += playerStats.damage;
    }

    const hero = useCharacterStats.getState().getHero(charId || "");
    const masteryLevels = hero?.skills || {};
    const masteryBonuses = computeMasteryBonuses((wType || "sword") as WSD_WeaponTypeId, masteryLevels);
    if (masteryBonuses.damagePercent > 0) {
      baseDamage = Math.round(baseDamage * (1 + masteryBonuses.damagePercent / 100));
    }

    const hungerState = useSurvival.getState();
    const hungerDamageMult = hungerState.hunger > 80 ? 1.1 : hungerState.hunger < 30 ? 0.85 : 1.0;
    baseDamage = Math.round(baseDamage * hungerDamageMult);

    const comboMult = getComboMultiplier();
    baseDamage = Math.round(baseDamage * comboMult);

    const isAOE = combatState ? AOE_STATES.has(combatState) : false;
    const isCleave = combatState ? CLEAVE_STATES.has(combatState) : false;

    const currentTargetId = useTargeting.getState().targetId;
    const enemiesInRange: { id: string; dist: number }[] = [];

    // Weapon-aware hit volume: scale the base attack range by the weapon's
    // reach (daggers shorter, polearms longer) and only accept enemies that
    // sit inside the forward swing arc — no more hitting things behind you
    // with a forward swing. AOE attacks (earthquake, spin) ignore the cone
    // and hit a full ring around the player. Locked target also bypasses
    // the cone (you've committed to fighting them) but still respects range.
    const weaponReach = getWeaponReach(wType);
    const reachedRange = range * weaponReach.reach;
    const facing = modelRef.current ? modelRef.current.rotation.y : 0;
    const fwdX = Math.sin(facing);
    const fwdZ = Math.cos(facing);
    const halfArc = weaponReach.arc;

    for (const enemy of enemies) {
      if (enemy.isDying) continue;
      const isLockedTarget = enemy.id === currentTargetId;
      const effectiveRange = isLockedTarget ? reachedRange * 1.5 : reachedRange;
      const dx = enemy.position.x - playerPos.current.x;
      const dy = enemy.position.y - playerPos.current.y;
      const dz = enemy.position.z - playerPos.current.z;
      const distSq = dx * dx + dz * dz;
      if (distSq >= effectiveRange * effectiveRange) continue;
      // Vertical containment: a flying enemy hovering directly overhead
      // shouldn't be a free melee target just because its xz overlaps the
      // player. Allow ~one weapon-length of vertical reach.
      if (Math.abs(dy) > effectiveRange) continue;

      if (!isAOE && !isLockedTarget) {
        const horiz = Math.sqrt(distSq);
        if (horiz > 1e-4) {
          // cos(angle) = (forward · toEnemy) / |toEnemy|
          // Reject when angle exceeds the weapon's half-arc.
          const cosAngle = (fwdX * dx + fwdZ * dz) / horiz;
          if (cosAngle < Math.cos(halfArc)) continue;
        }
      }

      // Line-of-sight raycast against the physics world. Skip for AOE
      // (those bypass walls by design — earthquake, spin) and for the
      // locked target (you've committed to that fight). For everything
      // else, if a solid collider sits between the player and the enemy,
      // treat the enemy as occluded and don't apply damage to it.
      if (!isAOE && !isLockedTarget && rapierWorld && rapierModule) {
        const dist = Math.sqrt(distSq);
        if (dist > 1e-4) {
          const origin = {
            x: playerPos.current.x,
            y: playerPos.current.y + eyeOffsetY,
            z: playerPos.current.z,
          };
          const dir = {
            x: dx / dist,
            y: dy / Math.max(dist, 1e-4),
            z: dz / dist,
          };
          try {
            const ray = new rapierModule.Ray(origin, dir);
            // Exclude the player's own rigid body from the cast so the ray
            // doesn't immediately strike the player's BallCollider and
            // report a phantom hit at toi≈0. We still want to be hit by
            // walls, props, and terrain.
            const hit = rapierWorld.castRay(
              ray,
              dist,
              true,
              undefined,
              undefined,
              undefined,
              rbRef.current ?? undefined,
            );
            // hit.timeOfImpact is the distance along the ray (0..dist) at
            // which the first collider is touched. If something solid sits
            // at < 90% of the enemy distance, the enemy is behind cover.
            if (hit && hit.timeOfImpact < dist * 0.9) continue;
          } catch {
            // If the cast fails for any reason, fall back to the
            // distance/arc check we already passed (no occlusion test).
          }
        }
      }

      enemiesInRange.push({ id: enemy.id, dist: Math.sqrt(distSq) });
    }

    // Smash any dungeon furniture / ceiling props inside the same arc.
    // Runs regardless of whether enemies were hit so chopping at an
    // empty bookshelf still works.
    try {
      damageDestructiblesInArc(
        playerPos.current,
        { x: fwdX, z: fwdZ },
        reachedRange,
        halfArc,
        baseDamage,
        isAOE,
      );
    } catch (err) {
      // Destructibles registry is optional (only populated in dungeons).
      // Never let a registry failure interrupt the enemy-damage flow.
      console.warn("[Player] Destructibles damage failed:", err);
    }

    if (enemiesInRange.length === 0) return;

    enemiesInRange.sort((a, b) => {
      if (a.id === currentTargetId) return -1;
      if (b.id === currentTargetId) return 1;
      return a.dist - b.dist;
    });

    let maxTargets = 1;
    if (isAOE) {
      maxTargets = enemiesInRange.length;
    } else if (isCleave) {
      maxTargets = Math.min(MAX_CLEAVE, enemiesInRange.length);
    }

    let hitPlayedOnce = false;
    let totalKills = 0;

    for (let i = 0; i < maxTargets; i++) {
      const target = enemiesInRange[i];
      let isCrit = false;
      let totalDamage = baseDamage;
      let dodged = false;
      let blocked = false;

      if (i > 0 && isCleave) {
        totalDamage = Math.round(totalDamage * 0.6);
      }

      // Canonical Grudge 8-step combat pipeline (stats-guide).
      // Falls back to the legacy crit roll when full player stats aren't
      // available (e.g. before character is loaded, on the title scene,
      // etc.) so test-runs and tutorials don't break.
      if (playerStats) {
        const hitEnemyForDef = enemies.find(e => e.id === target.id);
        const tier = hitEnemyForDef?.tier ?? "common";
        const defender = synthesizeEnemyDefender(tier);
        const result = computeGrudgeDamage(
          totalDamage,
          playerStats,
          defender,
          isMagicWeapon ? "magical" : "physical",
          1,
        );
        totalDamage = result.finalDamage;
        isCrit = result.isCrit;
        dodged = result.dodged;
        blocked = result.blocked;
      } else {
        isCrit = rollCrit();
        if (isCrit) totalDamage = Math.round(totalDamage * 2.0);
      }

      const killed = dodged ? false : damageEnemy(target.id, totalDamage);
      // Dodge skips the landed-hit confirm audio so a whiffed swing doesn't
      // play the same impact ping a successful strike would.
      if (!hitPlayedOnce && !dodged) {
        playHit();
        // chargeStrike landing also fires the dedicated heavy-impact
        // sample on top of the regular hit ping, so the second beat of
        // the chargeFist → chargeStrike combo audibly hits harder than
        // the standard attack chain.
        if (combatState === "chargeStrike") {
          playHeavyImpact();
        }
        hitPlayedOnce = true;
      }

      // Drain/lifesteal — drainHealth is already capped at 50% in
      // computeSecondaryStats per master-attributes.json statCaps. Only
      // applies when the strike actually landed.
      if (!dodged && playerStats && playerStats.drainHealth > 0) {
        const lifeSteal = Math.max(1, Math.round(totalDamage * playerStats.drainHealth / 100));
        useSurvival.getState().heal(lifeSteal);
      }

      const hitEnemy = enemies.find(e => e.id === target.id);
      if (hitEnemy) {
        if (!dodged) {
          hitParticlePos.current = [hitEnemy.position.x, hitEnemy.position.y + 1, hitEnemy.position.z];
          setHitParticleActive(true);
          setTimeout(() => setHitParticleActive(false), 600);
        }

        if (dodged) {
          spawnDamageNumber(
            0,
            [hitEnemy.position.x, hitEnemy.position.y + 1.5, hitEnemy.position.z],
            'dodge',
          );
        } else {
          spawnDamageNumber(
            totalDamage,
            [hitEnemy.position.x, hitEnemy.position.y + 1.5, hitEnemy.position.z],
            isCrit ? 'crit' : (blocked ? 'block' : (isMagicWeapon ? 'magic' : 'damage')),
          );
        }

        if (isCrit) {
          triggerScreenShake(0.15, 1.2);
          critFlashPos.current = [hitEnemy.position.x, hitEnemy.position.y, hitEnemy.position.z];
          setCritFlashActive(true);
          setTimeout(() => setCritFlashActive(false), 500);
        }

        // ── NEW: Weapon-specific hit VFX + status effect procs ──
        if (!dodged) {
          const hitDir: [number, number, number] = [
            hitEnemy.position.x - playerPos.current.x,
            0,
            hitEnemy.position.z - playerPos.current.z,
          ];
          const hitPos: [number, number, number] = [
            hitEnemy.position.x, hitEnemy.position.y + 0.8, hitEnemy.position.z,
          ];
          fireHitVFX(selectedCharacter.weaponRight, hitPos, hitDir, isCrit);
          rollHitEffects(target.id, selectedCharacter.characterId, selectedCharacter.weaponRight, combatState, isCrit);
          const sc = (window as any).__threeScene;
          if (sc) {
            spawnHitImpactMeshVFX(sc, hitPos, combatState, selectedCharacter.weaponRight, isCrit);
          }
        }

        const enemyName = hitEnemy.type.replace(/_/g, ' ');
        if (dodged) {
          useCombatLog.getState().addEntry(`✗ DODGED → ${enemyName}`, '#9ca3af');
        } else if (blocked) {
          useCombatLog.getState().addEntry(`⛨ BLOCKED ${totalDamage} → ${enemyName}`, '#60a5fa');
        } else {
          useCombatLog.getState().addEntry(
            `${isCrit ? 'CRIT! ' : ''}${isMagicWeapon ? '✦ ' : '⚔ '}${totalDamage} → ${enemyName}`,
            isCrit ? '#ff4444' : (isMagicWeapon ? '#aa88ff' : '#ffaa44')
          );
        }
      }

      if (killed) {
        totalKills++;
        if (target.id === useTargeting.getState().targetId) {
          clearTarget();
        }
        const xpReward = 15 + Math.floor(damageAmount * 0.5);
        addScore(10);
        addKill();
        const leveled = addXP(xpReward);
        spawnDamageNumber(xpReward, [hitEnemy!.position.x, hitEnemy!.position.y + 2, hitEnemy!.position.z], 'xp');
        if (leveled) {
          setLevelUpActive(true);
          setTimeout(() => setLevelUpActive(false), 1500);
        }
        try {
          const { useBuildSystem } = require("@/lib/stores/useBuildSystem");
          useBuildSystem.getState().addResources(
            5 + Math.floor(Math.random() * 5),
            2 + Math.floor(Math.random() * 3),
            1 + Math.floor(Math.random() * 3),
          );
        } catch (err) {
          console.warn("[Player] Build system resource add failed:", err);
        }

        useCombatLog.getState().addEntry(`☠ ${hitEnemy?.type.replace(/_/g, ' ')} slain! (+${xpReward} XP)`, '#66ff66');
      }
    }

    if (maxTargets > 1 && hitPlayedOnce) {
      const combo = incrementCombo();
      if (combo >= 3 && combo % 3 === 0) {
        spawnDamageNumber(combo, [playerPos.current.x, playerPos.current.y + 2.5, playerPos.current.z], 'combo');
      }
    } else {
      const combo = incrementCombo();
      if (combo >= 3 && combo % 3 === 0) {
        spawnDamageNumber(combo, [playerPos.current.x, playerPos.current.y + 2.5, playerPos.current.z], 'combo');
      }
    }

    // Charge-release juice: the held charge tiers (chargeFist /
    // chargeStrike) feel notably heavier than a basic attack1 swing.
    // chargeStrike — the second beat of the chargeFist → chargeStrike
    // combo and the climax of the held-charge release — shakes harder
    // and spawns a brief radial shockwave at the impact point on top of
    // the heavy-impact sample fired above. We fire this *after* the
    // generic >=20 shake so the per-state values win (later
    // triggerScreenShake call wins on the camera side).
    const firstHit = enemiesInRange[0];
    const firstEnemy = firstHit ? enemies.find(e => e.id === firstHit.id) : undefined;
    if (combatState === "chargeStrike") {
      triggerScreenShake(0.32, 2.2);
      if (firstEnemy) {
        chargeImpactPos.current = [
          firstEnemy.position.x,
          firstEnemy.position.y + 0.05,
          firstEnemy.position.z,
        ];
        setChargeImpactSeq(s => s + 1);
      }
    } else if (combatState === "chargeFist") {
      triggerScreenShake(0.22, 1.5);
    } else if (baseDamage >= 20) {
      triggerScreenShake(0.1, 0.7);
    }

    // Dungeon decor destruction — same cone math as the enemy hit
    // test. No-op outside dungeons (the destruction store is empty).
    tryDamageDungeonDecor(
      playerPos.current.x,
      playerPos.current.z,
      fwdX,
      fwdZ,
      reachedRange,
      halfArc,
      isAOE,
    );
  }, [enemies, damageEnemy, addScore, addKill, getSelectedItem, playHit, playHeavyImpact, rollCrit, getComboMultiplier, incrementCombo, addXP, spawnDamageNumber, selectedCharacter.weaponRight]);

  useEffect(() => {
    const getNextStateCost = (button: number): number => {
      const snap = combatActor.current.getSnapshot();
      const state = snap.value as string;
      if (button === 0) {
        if (state === "jumping" || state === "doubleJumping" || state === "falling") return STAMINA_COSTS.jumpBash || 12;
        if (state === "blocking") return STAMINA_COSTS.counterStrike || 12;
        if (state === "attack1") return STAMINA_COSTS.attack2 || 10;
        if (state === "attack2") return STAMINA_COSTS.attack3 || 15;
        if (state === "attack3") return STAMINA_COSTS.uppercut || 16;
        if (state === "dashAttack") return STAMINA_COSTS.spinSlash || 20;
        if (state === "counterStrike") return STAMINA_COSTS.spinSlash || 20;
        if (state === "uppercut") return STAMINA_COSTS.jumpBash || 12;
        if (state === "risingSlash") return STAMINA_COSTS.jumpBash || 12;
        if (state === "spinSlash") return STAMINA_COSTS.attack1 || 8;
        // Charge release combo chain: each follow-up press costs the next
        // step in the chargeAttack → chargeFist → chargeStrike chain.
        if (state === "chargeAttack") return STAMINA_COSTS.chargeFist || 16;
        if (state === "chargeAttackMax") return STAMINA_COSTS.chargeFist || 16;
        if (state === "chargeFist") return STAMINA_COSTS.chargeStrike || 22;
        if (state === "chargeStrike") return STAMINA_COSTS.attack1 || 8;
        return STAMINA_COSTS.attack1 || 8;
      }
      if (button === 2) {
        return 0;
      }
      return 8;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (phase !== "playing") return;
      if (useWeaponTuner.getState().dragging) return;
      // Boat-push mode owns mouse input — RMB flips the boat, LMB is
      // ignored. Gating here prevents combat (block/parry/attack) from
      // also firing during the push interaction.
      if ((window as any).__boatAttached) return;
      const mode = useGame.getState().interactionMode;
      if (e.button === 0) {
        // Harvest mode: LMB acts as the interact/select key (mirrors what F
        // does in combat). It triggers the harvest animation on the nearest
        // in-range node and intentionally does NOT send an attack to the
        // combat machine, so we don't play weird attack swings while gathering.
        if (mode === "harvest") {
          globalHarvestTriggerRef.current = true;
          return;
        }
        // Build mode: BuildModeHandler owns LMB for placement; suppress attacks
        // here so clicking to place a building doesn't also swing a weapon.
        if (mode === "build") return;

        // Combat mode: existing attack flow.
        const cost = getNextStateCost(0);
        const currentState = combatActor.current.getSnapshot().value as string;
        const willBuffer = BUFFERABLE_EVENTS.has("LMB") && ACTIVE_COMBAT_STATES.has(currentState) && actionTimer.current > 0 && actionTimer.current < INPUT_BUFFER_WINDOW;
        if (willBuffer) {
          sendCombat({ type: "LMB" }, cost);
        } else {
          if (!useStamina(cost)) return;
          sendCombat({ type: "LMB" });
        }
      } else if (e.button === 2) {
        // RMB (block/parry) is also a combat-only action.
        if (mode !== "combat") return;
        if (!isCameraOrbiting()) sendCombat({ type: "RMB_DOWN" });
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (useWeaponTuner.getState().dragging) return;
      // See handleMouseDown — boat-push mode owns mouse input.
      if ((window as any).__boatAttached) return;
      // Always forward UP events to the combat machine regardless of the
      // current mode. If the user pressed RMB in combat mode and then swapped
      // to harvest before releasing, suppressing the UP would leave the block
      // state latched. The machine ignores spurious UPs from idle states.
      if (e.button === 0) {
        sendCombat({ type: "LMB_UP" });
      } else if (e.button === 2) {
        const mode = useGame.getState().interactionMode;
        // Always release any held block (no-op if not blocking).
        sendCombat({ type: "RMB_UP" });
        // Outside combat, a non-drag RMB click is a click-to-move command.
        // The Camera component listens on `document` and runs first; by the
        // time we get here it has already updated `_rmbWasDrag`, so
        // isCameraOrbiting() reliably tells us if the user dragged.
        if (mode !== "combat" && !isCameraOrbiting()) {
          const rect = gl.domElement.getBoundingClientRect();
          const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          clickMoveRaycaster.current.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
          // Walk along the ray and find the first sample where the ray dips
          // below the terrain heightmap. Linearly interpolate that crossing
          // for a true ground hit. This handles cliffs, valleys, and slopes
          // far better than intersecting a flat plane at the player's foot
          // height (which always yielded a wrong point on uneven ground).
          const ray = clickMoveRaycaster.current.ray;
          const hit = new THREE.Vector3();
          let foundHit = false;
          // Resolve the active ground sampler the same way useFrame does:
          // the main game's heightmap when enabled, otherwise the
          // scene-supplied callback. Read from a ref so we always see
          // the current sampler — this useEffect's deps intentionally
          // don't list every prop, and a sampler created late or
          // swapped at scene transition would otherwise stay stale.
          const sampleGroundY = groundSamplerRef.current;
          if (sampleGroundY) {
            const MAX = 200;
            const STEP = 1.0;
            const sample = new THREE.Vector3();
            let prevAbove = 0;
            let prevT = 0;
            for (let t = 0; t <= MAX; t += STEP) {
              sample.copy(ray.origin).addScaledVector(ray.direction, t);
              if (sample.y < -50 || sample.y > 200) break;
              const terrainY = sampleGroundY(sample.x, sample.z);
              const above = sample.y - terrainY;
              if (t > 0 && prevAbove > 0 && above <= 0) {
                // Crossing: refine by linear interpolation between previous
                // and current sample.
                const span = prevAbove - above;
                const u = span > 1e-6 ? prevAbove / span : 0;
                const tHit = prevT + u * STEP;
                hit.copy(ray.origin).addScaledVector(ray.direction, tHit);
                hit.y = sampleGroundY(hit.x, hit.z);
                foundHit = true;
                break;
              }
              prevAbove = above;
              prevT = t;
            }
          }
          // Fallback to the old planar pick if we never crossed the
          // heightmap (e.g. clicking at the sky).
          if (!foundHit) {
            clickMovePlane.current.set(new THREE.Vector3(0, 1, 0), -playerPos.current.y);
            if (ray.intersectPlane(clickMovePlane.current, hit)) {
              foundHit = true;
            }
          }
          if (foundHit) {
            // Ignore clicks landing essentially on top of the player so a
            // mis-click doesn't immediately complete + cancel.
            const dx = hit.x - playerPos.current.x;
            const dz = hit.z - playerPos.current.z;
            if (dx * dx + dz * dz > 0.25) {
              clickMoveTarget.current = hit.clone();
            }
          }
        }
      }
    };
    const handleContextMenu = (e: Event) => e.preventDefault();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== "playing") return;
      if (useWeaponTuner.getState().dragging) return;
      // Boat-push mode suppresses class abilities, hotbar use, and ally
      // commands so keys can't fire combat actions while pushing.
      if ((window as any).__boatAttached) return;

      // Class ability "E" → primary class ability (cooldown classAbility1).
      // Suppressed near a dock so E keeps doubling as the dock-board prompt.
      if (e.code === "KeyE") {
        if ((window as any).__nearDock) return;
        const cdReady = useGame.getState().skillCooldowns.classAbility1 <= 0;
        if (cdReady && useStamina(STAMINA_COSTS.classAbility || 25)) {
          useSkillCooldown("classAbility1", 6.0);
          sendCombat({ type: "CLASS_ABILITY" });
        }
      }

      // Class ability "R" → secondary class ability (cooldown classAbility2).
      if (e.code === "KeyR") {
        const cdReady = useGame.getState().skillCooldowns.classAbility2 <= 0;
        if (cdReady && useStamina(STAMINA_COSTS.classAbility2 || 28)) {
          useSkillCooldown("classAbility2", 8.0);
          sendCombat({ type: "CLASS_ABILITY_2" });
        }
      }

      // Class ability "X" → tertiary class ability (cooldown classAbility3).
      if (e.code === "KeyX") {
        const cdReady = useGame.getState().skillCooldowns.classAbility3 <= 0;
        if (cdReady && useStamina(STAMINA_COSTS.classAbility3 || 35)) {
          useSkillCooldown("classAbility3", 12.0);
          sendCombat({ type: "CLASS_ABILITY_3" });
        }
      }

      if (e.code === "Tab") {
        e.preventDefault();
        const enemies = useEnemyManager.getState().enemies;
        useTargeting.getState().cycleTarget(enemies, playerPos.current);
        return;
      }

      if (e.code === "Escape") {
        if (useTargeting.getState().targetId) {
          useTargeting.getState().clearTarget();
          e.stopPropagation();
          return;
        }
      }

      // Digit1..Digit9 + Digit0 → inventory hotbar.
      // Selecting a slot is always free; if the slot's item is a one-shot
      // consumable (food/potion) we additionally use it on the same press
      // so players don't have to chord Digit then F.
      if (/^Digit[0-9]$/.test(e.code)) {
        const digit = parseInt(e.code.slice(5), 10);
        const slot = digit === 0 ? 9 : digit - 1;
        const inv = useInventory.getState();
        inv.selectSlot(slot);

        const item = inv.items[slot];
        if (item && (item.type === "food" || item.type === "consumable") && !useItemCooldown.current) {
          const result = inv.useItem(item.id);
          if (result) {
            const survival = useSurvival.getState();
            if (result.hungerRestore) {
              survival.eat(result.hungerRestore, result.healAmount || 0);
            } else if (result.healAmount) {
              survival.heal(result.healAmount);
            }
            if (result.staminaRestore) {
              survival.restoreStamina(result.staminaRestore);
            }
            useItemCooldown.current = true;
            setHealParticleActive(true);
            const displayAmount = result.healAmount || result.hungerRestore || result.staminaRestore || 0;
            spawnDamageNumber(
              Math.round(displayAmount),
              [playerPos.current.x, playerPos.current.y + 2, playerPos.current.z],
              'heal'
            );
            setTimeout(() => { useItemCooldown.current = false; setHealParticleActive(false); }, 800);
          }
        }
      }

      const allyCmd = ALLY_COMMAND_KEYS[e.code];
      if (allyCmd) {
        e.preventDefault();
        const targetId = allyCmd === "attack_target" ? useTargeting.getState().targetId : null;
        useAllies.getState().setGlobalCommand(allyCmd, targetId);
        useCombatLog.getState().addEntry(
          `[Command] Allies: ${allyCmd === "follow" ? "Follow me!" : allyCmd === "patrol" ? "Patrol area" : allyCmd === "stay" ? "Hold position!" : "Attack target!"}`,
          "#88ccff"
        );
      }
    };
    const handleKeyUp = (_e: KeyboardEvent) => {
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [phase, sendCombat, useStamina, camera, gl]);

  // ---------------------------------------------------------------------------
  // Fighting-game motion-input layer (Annihilate `RoleControls.js` port).
  //
  // Listens with `capture: true` so it runs BEFORE the App-level KeyK panel
  // toggle. While the combat machine is in `blocking`:
  //   • WASD edge presses get fed to the buffer as direction tokens.
  //   • J presses check for Hadouken (S→D) or Shoryuken (D→S→D).
  //   • K presses check for Tatsumaki (S→A).
  // Recognised motions dispatch the same `KEY_1` / `KEY_2` / `KEY_3` events
  // that the existing skill-hotkey wiring would use, so no new state-graph
  // regions are introduced — it's purely an alternate input on top.
  //
  // Outside `blocking` the listener is a no-op, which is what keeps KeyK
  // free for the skills-panel toggle in App.tsx the rest of the time.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Map combat-machine event types to the skill name used by the
    // useGame cooldown store. Cooldown durations themselves come from the
    // canonical SKILL_MAX_COOLDOWNS table so motion-input triggers stay in
    // lock-step with whatever the hotkey-driven path uses.
    const MOTION_SKILL_NAMES: Record<"KEY_1" | "KEY_2" | "KEY_3", "skill1" | "skill2" | "skill3"> = {
      KEY_1: "skill1", KEY_2: "skill2", KEY_3: "skill3",
    };

    const handleMotionKeyDown = (e: KeyboardEvent) => {
      if (phase !== "playing") return;
      if (useWeaponTuner.getState().dragging) return;
      if (e.repeat) return;
      // Boat-push mode owns WASD — don't let parry-stance directional
      // motions consume keypresses while pushing a boat.
      if ((window as any).__boatAttached) return;

      const state = combatActor.current.getSnapshot().value as string;
      if (state !== "blocking") return;

      const dir = keyCodeToMotionDirection(e.code);
      if (dir) {
        motionBuffer.current.pressDirection(dir);
        return;
      }

      const action = keyCodeToMotionAction(e.code);
      if (!action) return;

      const matched = motionBuffer.current.recognize(action);
      if (!matched) {
        // Even if no motion matched, the player is in the blocking state
        // and pressed K — swallow the event so App.tsx doesn't pop the
        // skills panel mid-fight. Misses are silent rather than confusing.
        if (e.code === "KeyK") {
          e.stopImmediatePropagation();
        }
        return;
      }

      const eventType = motionResultToCombatEvent(matched);
      const skillName = MOTION_SKILL_NAMES[eventType];
      const cdReady = useGame.getState().skillCooldowns[skillName] <= 0;
      if (!cdReady) {
        // On cooldown — still consume the keypress so App.tsx doesn't toggle
        // the panel and the buffer doesn't keep matching the same motion.
        e.stopImmediatePropagation();
        motionBuffer.current.clear();
        return;
      }

      const cost = STAMINA_COSTS[skillName] || 0;
      if (cost > 0 && !useStamina(cost)) {
        e.stopImmediatePropagation();
        motionBuffer.current.clear();
        return;
      }

      useSkillCooldown(skillName, SKILL_MAX_COOLDOWNS[skillName] ?? 3.0);
      motionBuffer.current.clear();
      sendCombat({ type: eventType });
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleMotionKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleMotionKeyDown, true);
    };
  }, [phase, sendCombat, useStamina, useSkillCooldown]);

  useFrame((_, delta) => {
    if (!modelRef.current) return;
    if (phase !== "playing") {
      const [px, py, pz] = getPos();
      modelRef.current.position.set(px, py, pz);
      // Pause/menu cancels any in-flight charge — clear the HUD meter too.
      useChargeHud.getState().clear();
      return;
    }

    // Freeze all player simulation while the weapon gizmo is being dragged
    // — no movement, no combat state transitions, no animation mixer tick.
    // Also zero out horizontal velocity so the character doesn't keep sliding.
    if (useWeaponTuner.getState().dragging) {
      const v = getVel();
      setLinvel(0, v[1], 0);
      useChargeHud.getState().clear();
      return;
    }

    update(delta);

    // While attached to a beached boat, the BeachedBoatsSystem owns the
    // player's transform — it teleports the rigid body to the stern each
    // frame via the window bridge. Skip the rest of the locomotion /
    // combat / climb pipeline so input doesn't fight the snap.
    if ((window as any).__boatAttached) {
      setLinvel(0, 0, 0);
      const [px, py, pz] = getPos();
      playerPos.current.set(px, py, pz);
      if (modelRef.current) modelRef.current.position.set(px, py, pz);
      onPositionUpdate(playerPos.current);
      updateGrassPlayerPosition(px, py, pz);
      useChargeHud.getState().clear();
      // Push pose: drive the full-body override slot. The lean uses
      // `wheelbarrow_idle` (Mixamo "leaning forward, arms outstretched
      // gripping a handle") and the shuffle uses `wheelbarrow_walk` —
      // both are looped so they hold while the BeachedBoatsSystem owns
      // movement. We swap between them based on the published push-input
      // flag so the pose blends from braced lean to slow shuffle on
      // WASD-down and back on key-up. Both clips fall back through
      // FALLBACK_CHAIN to `pickup`/`walk` if the farming pack failed
      // to load for any reason.
      const moving = !!(window as any).__boatPushMoving;
      const wantState: "lean" | "shuffle" = moving ? "shuffle" : "lean";
      if (boatPoseStateRef.current !== wantState) {
        controller.triggerOverride(
          wantState === "shuffle" ? "wheelbarrow_walk" : "wheelbarrow_idle",
          true,
        );
        boatPoseStateRef.current = wantState;
      }
      return;
    }
    if (boatPoseStateRef.current !== null) {
      // Detach edge — release the override slot so the locomotion blend
      // tree drives the body again. Using the animator's stopOverride
      // (rather than triggerOverride("idle")) ensures the held wheelbarrow
      // pose fades out cleanly instead of being replaced by an idle loop
      // pinned in the override slot.
      controller.animator.current?.stopOverride(0.18);
      boatPoseStateRef.current = null;
    }

    // --- F8 fly mode -------------------------------------------------------
    // Camera-relative WASD on the horizontal plane, Space (up) and `sink`
    // (LCtrl) on the vertical, sprint = sprint multiplier. Bypasses the
    // entire combat / swim / grounded / climb / jump pipeline because the
    // gravity-off body would interact with all of those incorrectly (e.g.
    // the swim block re-zeros vy, the grounded check would flag mid-air
    // hovering as "stuck"). Position broadcast still runs so the camera,
    // grass deformation, and HUD distance markers track the player.
    // Animator/mixer ticked above so idle / T-pose still play.
    {
      const c = useCheats.getState();
      if (c.enabled && c.flyMode) {
        const flyKeys = getKeys() as Record<string, boolean>;
        const FLY_BASE = 9;
        const FLY_SPRINT = 22;
        const speed = flyKeys.sprint ? FLY_SPRINT : FLY_BASE;
        let mvX = 0, mvZ = 0, mvY = 0;
        if (flyKeys.forward) mvZ -= 1;
        if (flyKeys.backward) mvZ += 1;
        if (flyKeys.left) mvX -= 1;
        if (flyKeys.right) mvX += 1;
        if (flyKeys.jump) mvY += 1;
        if (flyKeys.sink) mvY -= 1;
        const horizLen = Math.hypot(mvX, mvZ);
        let outVx = 0, outVz = 0;
        if (horizLen > 0) {
          const camYaw = getCameraYaw();
          const cosY = Math.cos(camYaw);
          const sinY = Math.sin(camYaw);
          const nx = mvX / horizLen;
          const nz = mvZ / horizLen;
          const rx = nx * cosY + nz * sinY;
          const rz = -nx * sinY + nz * cosY;
          outVx = rx * speed;
          outVz = rz * speed;
          if (modelRef.current) modelRef.current.rotation.y = Math.atan2(rx, rz);
        }
        setLinvel(outVx, mvY * speed, outVz);
        const [px, py, pz] = getPos();
        playerPos.current.set(px, py, pz);
        if (modelRef.current) modelRef.current.position.set(px, py, pz);
        onPositionUpdate(playerPos.current);
        updateGrassPlayerPosition(px, py, pz);
        useChargeHud.getState().clear();
        return;
      }
    }

    if (!isAlive) {
      playAnimation("death");
      die();
      useChargeHud.getState().clear();
      return;
    }

    // Casting swirl during the LMB hold-to-charge wind-up. Two particles
    // per frame orbit the player's chest at a small radius driven by
    // wall-clock time, and inherit a small upward velocity so the trail
    // floats off into the air. We pull straight from the combat actor
    // rather than wiring a prop because charge state changes faster than
    // React re-renders. The hue intensifies as the charge level rises so
    // the player gets unspoken visual feedback that the strike is ready.
    {
      const cs = combatActor.current.getSnapshot().value as string;
      if (CHARGE_HOLD_STATES.has(cs)) {
        const orbitRadius = cs === "charged2" ? 0.55 : cs === "charged1" ? 0.45 : 0.38;
        const hue: "arcane" | "fire" = cs === "charged2" ? "fire" : "arcane";
        const t = performance.now() * 0.006;
        for (let i = 0; i < 2; i++) {
          const ang = t + i * Math.PI;
          const ox = Math.cos(ang) * orbitRadius;
          const oz = Math.sin(ang) * orbitRadius;
          vfx.emit(VFXPresets.castSwirl(
            [playerPos.current.x + ox, playerPos.current.y + 1.1, playerPos.current.z + oz],
            hue,
          ));
        }
      }
    }

    const survivalState = useSurvival.getState();
    const harvestState = useHarvest.getState();
    const currentHealth = survivalState.health;
    if (currentHealth < lastHealthRef.current) {
      const dmg = lastHealthRef.current - currentHealth;
      if (dmg >= 0.5 && !survivalState.lastDamageWasStarve) {
        spawnDamageNumber(
          Math.max(1, Math.round(dmg)),
          [playerPos.current.x, playerPos.current.y + 1.6, playerPos.current.z],
          'player_damage'
        );
        // Bone-level impact flinch — estimate impact direction from nearest enemy.
        if (playerFlinchRef.current) {
          const enemies = useEnemyManager.getState().enemies;
          let nearestDist = Infinity;
          let nearestDir = playerFlinchDirRef.current.set(0, 0, -1);
          for (const e of enemies) {
            const d = e.position.distanceTo(playerPos.current);
            if (d < nearestDist && d < 10) {
              nearestDist = d;
              nearestDir = playerFlinchDirRef.current.subVectors(playerPos.current, e.position).normalize();
            }
          }
          const maxHp = survivalState.maxHealth;
          playerFlinchRef.current.trigger(nearestDir, damageToFlinchIntensity(dmg, maxHp));
        }
      }
      if (hitAnimTimer.current <= 0 && !survivalState.lastDamageWasStarve) {
        playAnimation("hit");
        hitAnimTimer.current = 0.5;
        harvestState.cancelHarvest();
      }
    }
    lastHealthRef.current = currentHealth;
    if (hitAnimTimer.current > 0) hitAnimTimer.current -= delta;
    if (harvestState.isHarvesting) {
      harvestState.tickHarvest(delta);
      if (harvestState.harvestAnimation && hitAnimTimer.current <= 0) {
        const harvestAnim = harvestState.harvestAnimation;
        if (lastAnimPlayed.current !== harvestAnim) {
          playAnimation(harvestAnim as any);
          lastAnimPlayed.current = harvestAnim;
        }
      }
      const [px, py, pz] = getPos();
      playerPos.current.set(px, py, pz);
      modelRef.current.position.set(px, py, pz);
      onPositionUpdate(playerPos.current);
      updateGrassPlayerPosition(px, py, pz);
      setLinvel(0, getVel()[1], 0);
      regenStamina(delta);
      hungerTick(delta);
      updateDayTime(delta);
      healthRegenTimer.current += delta;
      if (healthRegenTimer.current >= 2.0) {
        const tickDt = healthRegenTimer.current;
        healthRegenTimer.current = 0;
        const cid = useSurvival.getState().activeCharacterId;
        if (cid) {
          const hungerStatus = getHungerStatus(useSurvival.getState().hunger);
          if (getHungerHealthRegenAllowed(hungerStatus)) {
            const ps = getCachedPlayerStats(cid);
            if (ps && ps.healthRegen > 0) {
              const healAmt = ps.healthRegen * tickDt * 0.2;
              const survBefore = useSurvival.getState().health;
              useSurvival.getState().heal(healAmt);
              const survAfter = useSurvival.getState().health;
              const actualHeal = survAfter - survBefore;
              healAccumRef.current += actualHeal;
              if (healAccumRef.current >= 5) {
                spawnDamageNumber(
                  Math.round(healAccumRef.current),
                  [playerPos.current.x, playerPos.current.y + 2, playerPos.current.z],
                  'heal'
                );
                healAccumRef.current = 0;
              }
            }
          }
        }
      }
      return;
    }

    let [vx, vy, vz] = getVel();
    let [px, py, pz] = getPos();

    // --- Swim mode detection ----------------------------------------------
    // Thresholds live in `client/src/game/effects/WaterVolume.ts` so the
    // shader, the player, the seabed collider and any other water-aware
    // entity all read the same source of truth. When the player's capsule
    // centre dips below the surface AND we're still above the swim-band
    // floor, we switch into swim mode: vertical input is re-mapped (Space
    // ascends, Alt descends), gravity-jump is suppressed, and the locomotion
    // animation is overridden to swim / swim_idle. The lower bound is set
    // 1 m below the visible seabed so the player can stand on the seabed
    // collider and still be in swim mode (otherwise touching bottom would
    // snap them out of swimming).
    const inWater = isInWater(py);

    // Resolve the ground-height sampler for this frame. Defaults to the
    // main game's heightmap-backed closure; scenes that opt out of the
    // heightmap (tutorial island, future custom scenes) can supply a
    // raycast-backed `groundSampler` to get the additive slope polish
    // (uphill speed loss, downhill boost, lateral nudge, step-up
    // assist, foot-snap). When neither is available, `terrainH = py`
    // keeps the tunneling guard inert and routes grounded detection
    // through the downward raycast below.
    const sampleGroundY: ((x: number, z: number) => number) | null =
      useTerrainHeightmap && globalHeightData
        ? heightmapGroundSampler
        : (groundSampler ?? null);
    // `useHeightmap` is intentionally narrower than `sampleGroundY`: it
    // only flips on when the sampler IS the physics resting plane (the
    // main game's heightmap matches the heightfield collider exactly).
    // The grounded check and tunneling guard depend on that equivalence
    // — applying them with a scene-supplied sampler that returns the
    // visible mesh y would falsely un-ground a player resting on a
    // simpler proxy collider (e.g. tutorial's flat land cuboid). The
    // additive polish blocks below gate on `sampleGroundY` instead so
    // they fire for any sampler.
    const useHeightmap = useTerrainHeightmap && !!globalHeightData;
    const terrainH = sampleGroundY ? sampleGroundY(px, pz) : py;
    // With the capsule anchored at the feet, body.y == foot height, so
    // the resting foot plane sits exactly on terrainH. Add a small skin
    // (5 cm) so we don't fight Rapier's contact resolver pixel-by-pixel.
    const minFootY = terrainH + 0.05;
    // Tunneling guard ONLY: if the foot has clearly punched into the
    // terrain (more than 0.3 m below the resting plane while moving down),
    // gently lift it back to the surface and clear the downward velocity.
    // Above that threshold we let Rapier's contact + friction + gravity
    // resolve naturally so the body actually rests on the ground instead
    // of being teleported each frame. Horizontal velocity is preserved so
    // landing while moving doesn't snap the player to a halt.
    if (useHeightmap && py < minFootY - 0.3 && vy <= 0) {
      py = minFootY;
      vy = 0;
      setTranslation(px, py, pz);
      setLinvel(vx, 0, vz);
    }

    // Grounded: heightmap uses foot-to-surface distance; otherwise
    // cast a short downward ray and treat any contact as ground. The
    // raycast avoids false-grounded near jump apex.
    const distToGround = py - terrainH;
    let onGround: boolean;
    if (useHeightmap) {
      onGround = distToGround < 0.2 && vy < 4.0;
    } else {
      const PROBE_LEN = 0.35;
      let rayHit = false;
      try {
        const ray = new rapierModule.Ray(
          { x: px, y: py + 0.05, z: pz },
          { x: 0, y: -1, z: 0 },
        );
        const hit = rapierWorld.castRay(
          ray,
          PROBE_LEN,
          true,
          undefined,
          undefined,
          undefined,
          rbRef.current ?? undefined,
        );
        rayHit = hit !== null && hit.timeOfImpact <= PROBE_LEN;
      } catch {
        rayHit = false;
      }
      onGround = rayHit && vy < 4.0;
    }
    if (onGround) {
      groundedFrames.current = Math.min(groundedFrames.current + 1, 20);
    } else {
      groundedFrames.current = Math.max(groundedFrames.current - 2, 0);
    }
    const wasInAir = !isGrounded.current;
    isGrounded.current = groundedFrames.current > 2;

    if (wasInAir && isGrounded.current) {
      jumpForceApplied.current = false;
      // --- Fall damage on landing -----------------------------------------
      // Compare the highest point reached during this airtime against the
      // landing y. Every meter beyond FALL_DAMAGE_THRESHOLD_M costs
      // FALL_DAMAGE_PER_METER_PCT of max health (10% per meter past 8m).
      // Routed through the standard takeDamage("fall") path so it triggers
      // the red damage flash and respects damage reduction.
      if (peakAirY.current !== null) {
        const fallDist = peakAirY.current - py;
        if (fallDist > FALL_DAMAGE_THRESHOLD_M) {
          const surv = useSurvival.getState();
          const overage = fallDist - FALL_DAMAGE_THRESHOLD_M;
          const damage = Math.round(overage * FALL_DAMAGE_PER_METER_PCT * surv.maxHealth);
          if (damage > 0) surv.takeDamage(damage, "fall");
        }
      }
      peakAirY.current = null;
      sendCombat({ type: "LANDED" });
      // Keep the parallel character-machine context aware of grounded state
      // so its locomotion guards can rely on it. The combat-state translator
      // above will emit the matching LAND event.
      setCharGrounded(true);
    }
    if (!wasInAir && !isGrounded.current) {
      sendCombat({ type: "AIRBORNE" });
      setCharGrounded(false);
    }
    // Track the highest y reached while airborne. Initialised on the first
    // airborne frame and bumped each frame the player rises further.
    if (!isGrounded.current) {
      peakAirY.current = peakAirY.current === null ? py : Math.max(peakAirY.current, py);
    }
    // --- Floating airborne pose ---------------------------------------------
    // Two situations should swap the panicked "fall" pose for the relaxed
    // floating one:
    //   1. Double-jump apex hang: while in the doubleJumping combat state
    //      and vertical speed is near zero (|vy| < 1.5), the character is
    //      momentarily weightless — read as a brief float.
    //   2. Predicted safe drop: while genuinely falling (vy < -1) and the
    //      predicted impact distance from the current peak to the terrain
    //      below is under FALL_DAMAGE_THRESHOLD_M, no damage is incoming
    //      so the relaxed pose reads better than the panicked one.
    // Latched via floatingActive.current so we only fire the override on
    // the rising edge; release returns control to the regular fall/land
    // pipeline.
    if (!isGrounded.current && !inWater) {
      const vy = getVel()[1];
      const combatNow = combatActor.current.getSnapshot().value as string;
      const isDoubleJumpApex = combatNow === "doubleJumping" && Math.abs(vy) < 1.5;
      const predictedDrop = (peakAirY.current ?? py) - terrainH;
      const isSafeFall = vy < -1 && predictedDrop < FALL_DAMAGE_THRESHOLD_M;
      const wantFloat = isDoubleJumpApex || isSafeFall;
      if (wantFloat && !floatingActive.current) {
        controller.triggerOverride("floating");
        floatingActive.current = true;
      } else if (!wantFloat && floatingActive.current) {
        // Predicate dropped while still airborne. Floating is a loop, so
        // simply clearing the latch leaves the float pose stuck — we have
        // to actively replace the override slot. Push "fall" so the
        // panicked plummet pose takes over for the unsafe portion of the
        // drop (the controller's combat-state translator would otherwise
        // only re-emit FALL on a state change that may never come).
        controller.triggerOverride("fall");
        floatingActive.current = false;
      }
    } else if (floatingActive.current) {
      // Grounded or in water — actively replace the floating loop. If we
      // just landed the LANDED event a few lines above will trigger the
      // land animation; otherwise (entered water mid-fall) push idle so
      // the swim controller can take over cleanly.
      controller.triggerOverride(isGrounded.current ? "land" : "idle");
      floatingActive.current = false;
    }

    const keys = getKeys() as Record<string, boolean>;
    const preInputState = (combatActor.current.getSnapshot().value as string);

    // --- Reactive moves: dodge proc + directional shuffle -------------------
    // These two paths share a single override slot so we resolve them in
    // priority order (dodge proc wins — it's the response to incoming
    // damage, not a movement choice). Both paths gate on the same
    // "rest of the body is free to play a one-shot" predicate as the
    // gestures pool: grounded, not in water, no active hit/transition,
    // and we're in the idle/locomotion family of combat states.
    // Positive allow-list: only fire reactive overrides while the
    // combat machine is in the `idle` state (which is the umbrella for
    // all locomotion — running, walking, sneaking, standing — see
    // combatMachine.ts). Every other top-level state (charging, all
    // attack variants, blocking, rolling, classAbility, skill1..5, pop,
    // dashing, jumping, doubleJumping, jumpBash, earthquake, falling,
    // climbing, etc.) is "body is busy" and must finish before a
    // shuffle or dodge proc can interrupt it. Using a positive list of
    // exactly one state keeps this gate correct as new combat states
    // are added in the future.
    const reactiveAllowed =
      isGrounded.current &&
      !inWater &&
      hitAnimTimer.current <= 0 &&
      transitionLock.current <= 0 &&
      preInputState === "idle";

    // (a) Dodge proc takes priority. Fired from the survival store when
    // the dodge/evasion roll avoids an incoming hit. Always consume the
    // pending flag even when reactiveAllowed is false so it doesn't
    // queue stale procs and play seconds later.
    if (dodgeProcPending.current) {
      dodgeProcPending.current = false;
      if (reactiveAllowed) {
        controller.triggerOverride("dodge_proc");
        // Stamp the shuffle cooldown so a follow-up double-tap can't
        // immediately stack on top of the dodge anim.
        lastShuffleAt.current = performance.now();
      }
    }

    // (b) Directional shuffle on double-tap. Only fires when sprint is
    // NOT held — sprint+direction is the existing run/sprint path and
    // we don't want to clobber it. Pure tap-tap-on-the-same-direction.
    {
      const now = performance.now();
      const sinceLastShuffle = now - lastShuffleAt.current;
      const directions: Array<{
        key: keyof typeof prevDirHeld.current;
        held: boolean;
        anim: AnimationState;
      }> = [
        { key: "forward", held: !!keys.forward,  anim: "shuffle_forward" },
        { key: "back",    held: !!keys.backward, anim: "shuffle_back" },
        { key: "left",    held: !!keys.left,     anim: "shuffle_left" },
        { key: "right",   held: !!keys.right,    anim: "shuffle_right" },
      ];
      // Only consider firing a shuffle if no other direction is also held
      // — diagonal-tap is a movement intent, not a shuffle intent.
      const heldCount = directions.reduce((n, d) => n + (d.held ? 1 : 0), 0);

      for (const d of directions) {
        const wasHeld = prevDirHeld.current[d.key];
        // Rising-edge tap detection.
        if (d.held && !wasHeld) {
          const sinceLastTap = now - lastTapAt.current[d.key];
          const isDoubleTap = sinceLastTap > 0 && sinceLastTap < SHUFFLE_DOUBLE_TAP_MS;
          if (
            isDoubleTap &&
            !keys.sprint &&
            heldCount === 1 &&
            reactiveAllowed &&
            sinceLastShuffle >= SHUFFLE_COOLDOWN_MS
          ) {
            controller.triggerOverride(d.anim);
            lastShuffleAt.current = now;
            // Reset so we don't insta-trigger again on the same press.
            lastTapAt.current[d.key] = 0;
          } else {
            lastTapAt.current[d.key] = now;
          }
        }
        prevDirHeld.current[d.key] = d.held;
      }
    }

    // --- Swim mode: vertical control + jump suppression -------------------
    // While submerged we re-purpose Space/Alt as ascend/descend rather than
    // letting them fire the ground-jump path. With no vertical input we
    // damp toward neutral buoyancy (gentle hover) so the character treads
    // in place instead of sinking under Rapier gravity.
    if (inWater) {
      const SWIM_VERTICAL_SPEED = 3.5;
      let swimVy: number;
      if (keys.jump) swimVy = SWIM_VERTICAL_SPEED;
      else if (keys.sink) swimVy = -SWIM_VERTICAL_SPEED;
      else swimVy = vy * 0.85;
      setLinvel(vx, swimVy, vz);
      vy = swimVy;
    } else if (keys.jump && !prevKeys.current.jump) {
      // Mount intent: if the player is inside a climb sensor and not yet
      // climbing, route the jump press into a WALL_TOUCH so the combat
      // machine enters `climbing` and the controller block above takes
      // over. The axis arg only matters for the legacy world-bounds
      // entry path; we pick "z" arbitrarily — the climb controller
      // overwrites the captured normal from the sensor info anyway.
      const near = getNearClimbable();
      // Require some stamina to mount so a stamina-forced drop-off
      // can't be immediately undone by mashing jump again.
      const canMountClimb = useSurvival.getState().stamina > 0;
      if (near && preInputState !== "climbing" && canMountClimb) {
        sendCombat({ type: "WALL_TOUCH", axis: "z" });
      } else {
        const staminaCost = STAMINA_COSTS[preInputState === "jumping" ? "doubleJumping" : "jumping"] || 8;
        if (useStamina(staminaCost)) {
          sendCombat({ type: "JUMP" });
        }
      }
    }
    if (keys.modeSwitch && !prevKeys.current.modeSwitch) {
      useGame.getState().cycleInteractionMode();
    }

    // --- Numpad emote dispatch -------------------------------------------
    // Detect a key-down edge for any of the 15 gesture bindings and route
    // through the controller's full-body override slot. Gestures are gated
    // on the same conditions as the alt-idle fidget so we never interrupt
    // an attack, hit reaction, transition lock, or non-grounded state. The
    // animator already handles auto-return to idle when the one-shot ends.
    const gestureMap: Array<readonly [keyof typeof keys, AnimationState]> = [
      ["gesture1", "gesture_acknowledge"],
      ["gesture2", "gesture_angry"],
      ["gesture3", "gesture_cocky"],
      ["gesture4", "gesture_dismiss"],
      ["gesture5", "gesture_happy"],
      ["gesture6", "gesture_look_away"],
      ["gesture7", "gesture_relieved"],
      ["gesture8", "gesture_thoughtful_shake"],
      ["gesture9", "gesture_annoyed_shake"],
      ["gesture10", "gesture_hard_nod"],
      ["gesture11", "gesture_nod_yes"],
      ["gesture12", "gesture_lengthy_nod"],
      ["gesture13", "gesture_sarcastic_nod"],
      ["gesture14", "gesture_no_shake"],
      ["gesture15", "gesture_weight_shift"],
    ];
    for (const [keyName, anim] of gestureMap) {
      if (keys[keyName] && !prevKeys.current[keyName]
          && hitAnimTimer.current <= 0
          && transitionLock.current <= 0
          && isGrounded.current
          && !inWater
          && preInputState === "idle"
          && !fidgetInFlight.current) {
        fidgetInFlight.current = true;
        controller.triggerOverride(anim);
        // Reset the ambient idle-fidget timer so a manual emote doesn't
        // immediately get followed by an automatic one.
        idleFidgetAccum.current = 0;
        nextFidgetAt.current = 10 + Math.random() * 8;
        // Most gestures are 2-4s; release the in-flight latch on a safe
        // upper bound so the override slot can re-arm.
        window.setTimeout(() => { fidgetInFlight.current = false; }, 4500);
        break;
      }
    }

    if (keys.roll && !prevKeys.current.roll) {
      if (useStamina(STAMINA_COSTS.rolling || 12)) {
        sendCombat({ type: "ROLL" });
      }
    }
    // Crouch is held: press to enter the crouch posture in the parallel
    // posture region, release to stand back up. The character machine drives
    // the looped sneak animation on its own once CROUCH_START fires.
    if (keys.crouch && !prevKeys.current.crouch) {
      sendCharEvent({ type: "CROUCH_START" });
    }
    if (!keys.crouch && prevKeys.current.crouch) {
      sendCharEvent({ type: "CROUCH_END" });
    }

    Object.assign(prevKeys.current, keys);

    const currentCombatState = (combatActor.current.getSnapshot().value as string);

    if (modelRef.current) {
      const facing = modelRef.current.rotation.y;
      facingDir.current = [Math.sin(facing), 0, Math.cos(facing)];
    }

    // Publish the player's pose to the rebound primitive so any in-flight
    // hadouken-class projectile can detect a perfect block this frame.
    // See `client/src/game/state/blockGuard.ts`.
    blockGuard.updatePose(playerPos.current, {
      x: facingDir.current[0],
      y: facingDir.current[1],
      z: facingDir.current[2],
    });

    if (currentCombatState !== prevCombatState.current) {
      const cs = currentCombatState;
      const wType = selectedCharacter.weaponRight;
      const isCaster = wType === "staff" || wType === "wand";
      const isArcher = wType === "bow";
      const isCrossbow = wType === "crossbow";
      const isGun = wType === "gun";
      const isRanged = isArcher || isCrossbow || isGun;
      if (cs === "skill1") {
        setSkill1Active(true); setTimeout(() => setSkill1Active(false), 1300);
        if (isCaster) { setFireballActive(true); setTimeout(() => setFireballActive(false), 1500); }
        if (isArcher) { setArrowActive(true); setTimeout(() => setArrowActive(false), 1200); }
        if (isCrossbow) { setBoltActive(true); setTimeout(() => setBoltActive(false), 800); }
        if (isGun) { setBulletActive(true); setTimeout(() => setBulletActive(false), 500); }
      }
      if (cs === "skill2") {
        setSkill2Active(true); setTimeout(() => setSkill2Active(false), 800);
        if (isCaster) { setIceLanceActive(true); setTimeout(() => setIceLanceActive(false), 1200); }
        if (isArcher) { setArrowActive(true); setTimeout(() => setArrowActive(false), 1200); }
        if (isCrossbow) { setBoltActive(true); setTimeout(() => setBoltActive(false), 800); }
        if (isGun) { setBulletActive(true); setTimeout(() => setBulletActive(false), 500); }
      }
      if (cs === "earthquake") {
        setEarthquakeActive(true); setTimeout(() => setEarthquakeActive(false), 1100);
        if (isCaster) { setRootActive(true); setTimeout(() => setRootActive(false), 2500); }
      }
      if (cs === "skill3") {
        setSkill3Active(true); setTimeout(() => setSkill3Active(false), 1100);
        if (isCaster) { setDistortionActive(true); setTimeout(() => setDistortionActive(false), 1500); }
        if (isCaster) { setMagicMissileActive(true); setTimeout(() => setMagicMissileActive(false), 1500); }
        if (isArcher) { setArrowActive(true); setTimeout(() => setArrowActive(false), 1200); }
        if (isCrossbow) { setBoltActive(true); setTimeout(() => setBoltActive(false), 800); }
        if (isGun) { setBulletActive(true); setTimeout(() => setBulletActive(false), 500); }
      }
      if (cs === "skill5") {
        setSkill5Active(true); setTimeout(() => setSkill5Active(false), 800);
        if (isCaster) { setRockActive(true); setTimeout(() => setRockActive(false), 1000); }
        if (isCaster) { setLightningActive(true); setTimeout(() => setLightningActive(false), 400); }
      }
      if ((cs === "attack1" || cs === "attack2" || cs === "attack3") && isRanged) {
        if (isArcher) { setArrowActive(true); setTimeout(() => setArrowActive(false), 1200); }
        if (isCrossbow) { setBoltActive(true); setTimeout(() => setBoltActive(false), 800); }
        if (isGun) { setBulletActive(true); setTimeout(() => setBulletActive(false), 500); }
      }
      if (cs === "doubleJumping") {
        jumpForceApplied.current = false;
      }
      if (cs === "dashing" || cs === "dashAttack") { setDashActive(true); }
      if (prevCombatState.current === "dashing" || prevCombatState.current === "dashAttack") { setDashActive(false); }
      if (TRAIL_SWING_STATES.has(cs)) {
        setSlashActive(true); setTimeout(() => setSlashActive(false), 400);
        // Publish the active swing id so WeaponTrail can scale ribbon
        // width/length from SwingArcs metadata for this specific attack.
        attackIdRef.current = cs;
      } else if (TRAIL_SWING_STATES.has(prevCombatState.current)) {
        // Swing finished — clear so the next non-tracked state doesn't
        // keep stretching the ribbon with the previous attack's scaling.
        attackIdRef.current = null;
      }
      // Toggle the chargeStrike flash window so WeaponTrail flips into the
      // climax palette only during the actual release, not during the
      // wind-up tiers (which already glow via SwordBlinkFlash).
      chargeStrikeFlashRef.current = (cs === "chargeStrike");
      prevCombatState.current = cs;
    }

    tickComboTimer(delta);
    tickSkillCooldowns(delta);

    // --- Charge attack hold-tick ----------------------------------------
    // While the player holds LMB in a charge wind-up state we accrue hold
    // time and dispatch CHARGE_TIER_1 / CHARGE_TIER_2 as the thresholds are
    // crossed. The combat machine moves charging → charged1 → charged2,
    // and our chargeTier mirror drives the sword glow + blink VFX.
    // Charge release states: while we're in any of these, the player is
    // committing the charged swing. We must NOT clear chargeTier or the
    // animator's swing-arc multiplier here, otherwise the wider arc /
    // brighter trail collapse to tier-0 right at the moment of impact —
    // which is the exact frame the visual is supposed to read as
    // "charged release". Clearing happens only when we leave both the
    // hold-tier wind-up AND the release follow-through.
    const inChargeRelease = (
      currentCombatState === "chargeAttack" ||
      currentCombatState === "chargeAttackMax" ||
      currentCombatState === "chargeFist" ||
      currentCombatState === "chargeStrike"
    );

    if (CHARGE_HOLD_STATES.has(currentCombatState)) {
      chargeHoldMs.current += delta * 1000;
      if (chargeTier.current < 1 && chargeHoldMs.current >= CHARGE_TIER_1_MS) {
        chargeTier.current = 1;
        applyChargeGlow(rightHand.current, 1);
        controller.animator?.current?.setSwingArcChargeMul(1.25);
        sendCombat({ type: "CHARGE_TIER_1" });
        setFlashTier(1);
        setFlashSeq((s) => s + 1);
      } else if (chargeTier.current < 2 && chargeHoldMs.current >= CHARGE_TIER_2_MS) {
        chargeTier.current = 2;
        applyChargeGlow(rightHand.current, 2);
        controller.animator?.current?.setSwingArcChargeMul(1.6);
        sendCombat({ type: "CHARGE_TIER_2" });
        setFlashTier(2);
        setFlashSeq((s) => s + 1);
      }
      // Mirror into the HUD store so ChargeMeter can render the bar. Clamp
      // holdMs to the tier-2 cap so the store stops re-publishing once the
      // bar is visually full (the action no-ops on equal values).
      const hudHoldMs = Math.min(chargeHoldMs.current, CHARGE_TIER_2_MS);
      useChargeHud.getState().setCharge(true, hudHoldMs, chargeTier.current);
    } else if (inChargeRelease) {
      // Hold the captured tier through the release follow-through so the
      // wider arc + brighter trail land on the actual swing impact frame.
      // We still freeze the HUD bar so it stops re-publishing.
      useChargeHud.getState().setCharge(true, CHARGE_TIER_2_MS, chargeTier.current);
    } else if (chargeHoldMs.current > 0 || chargeTier.current !== 0) {
      // Neither holding nor releasing — fully clear timer + tier glow. We
      // must reset chargeHoldMs unconditionally, otherwise a sub-threshold
      // release (tier 0) leaves leftover ms that would make the next hold
      // cross tier 1 too early.
      chargeTier.current = 0;
      chargeHoldMs.current = 0;
      applyChargeGlow(rightHand.current, 0);
      controller.animator?.current?.setSwingArcChargeMul(1);
      useChargeHud.getState().clear();
    }

    // States whose animations are now driven by the parallel character
    // state machine (combat / jump / block / posture regions). For these we
    // intentionally skip the legacy playAnimation call so the layered slot
    // (combat upper-body, locomotion lower-body) stays authoritative; the
    // action timer, damage windows and FX are still set up here.
    const MACHINE_DRIVEN_STATES = new Set([
      "attack1", "attack2", "attack3",
      "heavyAttack",
      "blocking",
      "jumping", "doubleJumping", "falling",
    ]);

    const animName = COMBAT_STATE_ANIMS[currentCombatState];
    const machineDriven = MACHINE_DRIVEN_STATES.has(currentCombatState);
    if (animName && animName !== lastAnimPlayed.current && hitAnimTimer.current <= 0 && transitionLock.current <= 0) {
      if (!machineDriven) {
        playAnimation(animName as AnimationState);
      }
      lastAnimPlayed.current = animName;
      damageApplied.current = false;

      if (ACTION_DURATIONS[currentCombatState]) {
        const cidForAtk = useSurvival.getState().activeCharacterId;
        const atkStats = getCachedPlayerStats(cidForAtk);
        const atkSpeedMult = atkStats ? (1 / Math.max(0.5, atkStats.attackSpeed)) : 1.0;
        actionTimer.current = ACTION_DURATIONS[currentCombatState] * atkSpeedMult;
      }
    }

    // --- Swim animation override ------------------------------------------
    // While submerged, force the locomotion slot to swim/swim_idle regardless
    // of what the locomotion machine wants (idle/walk/run/falling/etc.). We
    // don't override during a hit reaction or transition lock so existing
    // damage feedback still reads. Combat upper-body animations from the
    // layered slot (attack/block) continue to mix on top because this only
    // touches the legacy lower-body playAnimation path.
    if (inWater && hitAnimTimer.current <= 0 && transitionLock.current <= 0) {
      const horizSpeed = Math.hypot(vx, vz);
      const desiredSwim: AnimationState = horizSpeed > 0.5 ? "swim" : "swim_idle";
      if (lastAnimPlayed.current !== desiredSwim) {
        playAnimation(desiredSwim);
        lastAnimPlayed.current = desiredSwim;
      }
    }

    if (actionTimer.current > 0) {
      actionTimer.current -= delta;

      if (!damageApplied.current && actionTimer.current < ACTION_DURATIONS[currentCombatState] * 0.5) {
        const dmg = DAMAGE_STATES[currentCombatState];
        if (dmg) {
          const range = currentCombatState === "earthquake" ? 6 :
                        currentCombatState === "skill1" ? 8 :
                        currentCombatState === "skill3" ? 5 :
                        currentCombatState === "skill5" ? 5 :
                        currentCombatState === "spinSlash" ? 5 :
                        currentCombatState === "heavyAttack" ? 5 :
                        currentCombatState === "classAbility" ? 6 :
                        ATTACK_RANGE;
          tryDamageEnemies(dmg, range, currentCombatState);
          damageApplied.current = true;
        }
      }

      if (actionTimer.current <= 0) {
        const buffered = inputBuffer.current;
        inputBuffer.current = null;
        inputBufferTime.current = 0;

        sendCombat({ type: "ACTION_DONE" });
        lastAnimPlayed.current = "";

        if (buffered) {
          if (buffered.staminaCost > 0) {
            if (useStamina(buffered.staminaCost)) {
              combatActor.current.send(buffered.event);
            }
          } else {
            combatActor.current.send(buffered.event);
          }
        }
      }
    }

    if (inputBufferTime.current > 0) {
      inputBufferTime.current -= delta;
      if (inputBufferTime.current <= 0) {
        inputBuffer.current = null;
      }
    }

    if (currentCombatState === "rolling") {
      const facing = modelRef.current ? modelRef.current.rotation.y : 0;
      const rollSpeed = DASH_SPEED * 0.8;
      setLinvel(Math.sin(facing) * rollSpeed, vy, Math.cos(facing) * rollSpeed);
    }

    const moveDir = moveDirVec.current.set(0, 0, 0);
    if (keys.forward) moveDir.z -= 1;
    if (keys.backward) moveDir.z += 1;
    if (keys.left) moveDir.x -= 1;
    if (keys.right) moveDir.x += 1;
    const wasdActive = moveDir.length() > 0;

    // Click-to-move integration. Any WASD input or entering combat mode
    // cancels a pending click target so the player can override at any time.
    const currentMode = useGame.getState().interactionMode;
    if (clickMoveTarget.current && (wasdActive || currentMode === "combat")) {
      clickMoveTarget.current = null;
    }
    if (!wasdActive && clickMoveTarget.current) {
      const tx = clickMoveTarget.current.x - playerPos.current.x;
      const tz = clickMoveTarget.current.z - playerPos.current.z;
      const distSq = tx * tx + tz * tz;
      if (distSq < 0.25) {
        clickMoveTarget.current = null;
      } else {
        // Already in world space — no camera-yaw rotation needed.
        const len = Math.sqrt(distSq);
        moveDir.x = tx / len;
        moveDir.z = tz / len;
      }
    } else if (wasdActive) {
      const camYaw = getCameraYaw();
      const cosY = Math.cos(camYaw);
      const sinY = Math.sin(camYaw);
      const rx = moveDir.x * cosY + moveDir.z * sinY;
      const rz = -moveDir.x * sinY + moveDir.z * cosY;
      moveDir.x = rx;
      moveDir.z = rz;
    }
    const moving = moveDir.length() > 0;

    const inAction = ACTION_STATES.has(currentCombatState);

    if (currentCombatState === "jumping" && !jumpForceApplied.current) {
      setLinvel(vx, JUMP_FORCE, vz);
      jumpForceApplied.current = true;
    }

    if (currentCombatState === "doubleJumping" && !jumpForceApplied.current) {
      setLinvel(vx, DOUBLE_JUMP_FORCE, vz);
      jumpForceApplied.current = true;
    }

    if (currentCombatState === "skill2" && !jumpForceApplied.current) {
      setLinvel(vx * 0.5, SHORYUKEN_LIFT, vz * 0.5);
      jumpForceApplied.current = true;
    }

    if (currentCombatState === "uppercut") {
      if (actionTimer.current > ACTION_DURATIONS.uppercut * 0.6) {
        setLinvel(vx * 0.3, UPPERCUT_LIFT, vz * 0.3);
      }
    }

    if (currentCombatState === "risingSlash") {
      if (actionTimer.current > ACTION_DURATIONS.risingSlash * 0.5) {
        setLinvel(vx * 0.4, RISING_SLASH_LIFT, vz * 0.4);
      }
    }

    if (currentCombatState === "earthquake" && !isGrounded.current) {
      setLinvel(0, EARTHQUAKE_SLAM, 0);
    }

    if (currentCombatState === "dashing") {
      const facing = modelRef.current ? modelRef.current.rotation.y : 0;
      const dashVx = Math.sin(facing) * DASH_SPEED;
      const dashVz = Math.cos(facing) * DASH_SPEED;
      setLinvel(dashVx, vy, dashVz);
    }

    if (currentCombatState === "dashAttack") {
      const facing = modelRef.current ? modelRef.current.rotation.y : 0;
      const dashVx = Math.sin(facing) * DASH_SPEED * 0.7;
      const dashVz = Math.cos(facing) * DASH_SPEED * 0.7;
      setLinvel(dashVx, vy, dashVz);
    }

    if (currentCombatState === "spinSlash") {
      if (modelRef.current) {
        modelRef.current.rotation.y += delta * 14;
        const facing = modelRef.current.rotation.y;
        setLinvel(Math.sin(facing) * 3, vy > -1 ? 0.5 : vy, Math.cos(facing) * 3);
      }
    }

    if (currentCombatState === "skill3") {
      if (modelRef.current) {
        modelRef.current.rotation.y += delta * 10;
        const facing = modelRef.current.rotation.y;
        setLinvel(Math.sin(facing) * 5, vy > -1 ? 1 : vy, Math.cos(facing) * 5);
      }
    }

    // ===== Climbing controller =========================================
    // Active while combatMachine is in `climbing`. The state was entered
    // either by the legacy world-bounds WALL_TOUCH path or by the new
    // mount-on-jump-near-sensor path below. We:
    //   1. Gate gravity to 0 once at mount, restore it on dismount, so
    //      the dynamic body doesn't keep tugging us off the wall while
    //      Player.tsx writes climb velocity each frame.
    //   2. Read WASD, project onto the captured wall tangent + world up,
    //      and write linvel directly.
    //   3. For walls, snap the body's XZ to the wall plane so the capsule
    //      stays one-radius off the face. For ladders, snap to the ladder
    //      column.
    //   4. Fire CLIMB_VEL into the parallel character machine so the
    //      animation region picks climb_idle / climb / climb_shimmy.
    //   5. Top-out: ladder reports atTop via its own sensor; for a wall
    //      we measure foot-y vs the captured topY. Either fires TOPOUT
    //      to the character machine and LANDED to the combat machine,
    //      then the controller's OVERRIDE_DONE plumbing returns us to
    //      grounded.idle once climb_topout finishes.
    //   6. Drop-off: jump key flips to combat JUMP (existing path), back
    //      key away from wall sends WALL_LEAVE.
    if (currentCombatState === "climbing") {
      const cs = climbState.current;
      // First-frame setup. Snapshot the active sensor info into refs and
      // suspend gravity. We do this here (rather than in an event handler)
      // because WALL_TOUCH may have been emitted from the world-bounds
      // path which has no sensor to read from — we fall back to a fixed
      // +Z normal in that case so the controller still functions.
      if (!cs.active) {
        const near = getNearClimbable();
        if (near) {
          cs.kind = near.kind;
          cs.normal.set(near.normal[0], near.normal[1], near.normal[2]);
          cs.right.set(near.right[0], near.right[1], near.right[2]);
          cs.anchorXZ = { x: near.anchor[0], z: near.anchor[2] };
          cs.topY = near.topY;
        } else {
          // Legacy world-bounds entry: face the player into the world
          // origin so back-key still drops them off without thrashing.
          const facing = modelRef.current?.rotation.y ?? 0;
          cs.normal.set(-Math.sin(facing), 0, -Math.cos(facing));
          cs.right.set(Math.cos(facing), 0, -Math.sin(facing));
          cs.anchorXZ = { x: px, z: pz };
          cs.topY = py + 6;
          cs.kind = "wall";
        }
        cs.frames = 0;
        cs.active = true;
        if (rbRef.current && !cs.gravityWasZeroed) {
          rbRef.current.setGravityScale(0, true);
          cs.gravityWasZeroed = true;
        }
        sendCharEvent({ type: "MOUNT_CLIMB", kind: cs.kind });
        useClimbPrompt.getState().setClimbing(true);
        playClimbMount();
        // Face the wall so the climb_* animations read correctly.
        if (modelRef.current) {
          modelRef.current.rotation.y = Math.atan2(-cs.normal.x, -cs.normal.z);
        }
      }
      cs.frames++;

      // Read per-frame inputs. Forward = up the wall, back = down,
      // left/right = lateral shimmy along the captured right tangent.
      const climbV = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
      const climbH = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const CLIMB_UP_SPEED = cs.kind === "ladder" ? 2.4 : 2.0;
      const CLIMB_LATERAL_SPEED = cs.kind === "ladder" ? 1.4 : 1.6;
      const climbVy = climbV * CLIMB_UP_SPEED;
      const lateralX = cs.right.x * climbH * CLIMB_LATERAL_SPEED;
      const lateralZ = cs.right.z * climbH * CLIMB_LATERAL_SPEED;

      // Stick-to-wall: project the body's current XZ onto the captured
      // anchor along the wall's outward normal so the capsule stays a
      // small fixed offset off the face. The offset is one player radius
      // plus a thin air gap so contacts don't fight Rapier's resolver.
      const stickOffset = PLAYER_RADIUS + 0.05;
      const targetX = cs.anchorXZ.x + cs.normal.x * stickOffset;
      const targetZ = cs.anchorXZ.z + cs.normal.z * stickOffset;
      // Lerp toward the target XZ so the mount snap doesn't teleport
      // — feels like a hand-grab instead of a warp.
      const stickT = 1 - Math.exp(-12 * Math.min(delta, 0.05));
      const newX = px + (targetX - px) * stickT;
      const newZ = pz + (targetZ - pz) * stickT;
      setTranslation(newX, py, newZ);
      setLinvel(lateralX, climbVy, lateralZ);
      // Mirror the world-space climb velocities into the parallel
      // character machine so the climbing region picks climb_idle /
      // climb / climb_shimmy each tick. Vertical sign is preserved so
      // useCharacterController can swap climb ↔ climb_down.
      sendCharEvent({ type: "CLIMB_VEL", vertical: climbV, lateral: climbH });

      // Vertical climbing drains stamina at a slow rate. Lateral
      // shimmying is free. Regen is suppressed elsewhere while in
      // `climbing`, so this produces a real net loss.
      let staminaExhausted = false;
      if (climbV !== 0) {
        const drain = (STAMINA_COSTS.climbing || 8) * Math.min(delta, 0.1);
        const newStamina = Math.max(0, useSurvival.getState().stamina - drain);
        useSurvival.setState({ stamina: newStamina });
        if (newStamina <= 0) staminaExhausted = true;
      }

      // Drop-off: back-key at the foot of the climb is a soft dismount,
      // and an empty stamina pool forces the same dismount.
      const backDropOff = climbV < 0 && distToGround < 0.25 && cs.frames > 6;
      if (backDropOff || staminaExhausted) {
        sendCombat({ type: "WALL_LEAVE" });
        sendCharEvent({ type: "DISMOUNT_CLIMB" });
        if (rbRef.current && cs.gravityWasZeroed) {
          rbRef.current.setGravityScale(1, true);
          cs.gravityWasZeroed = false;
        }
        cs.active = false;
        useClimbPrompt.getState().setClimbing(false);
        playClimbDismount();
        stopClimbScrape();
      }

      // Top-out detection. Two paths — ladders use the dedicated top
      // sensor (atTop flag), walls compare the chest y to the wall's
      // top edge minus a small reach. Either path sends TOPOUT to the
      // character machine + LANDED to the combat machine and clears
      // the climb flags. The actual pull-up is animated by climb_topout.
      const near = getNearClimbable();
      const chestY = py + 1.0;
      const ladderAtTop = cs.kind === "ladder" && !!(near && near.atTop);
      const wallAtTop = cs.kind === "wall" && cs.frames > 8 && chestY >= cs.topY - 0.25;
      // Skip topout if we already dismounted this frame (back-key or
      // stamina exhaustion) — `cs.active` is the source of truth.
      if (cs.active && (ladderAtTop || wallAtTop)) {
        sendCharEvent({ type: "TOPOUT" });
        sendCombat({ type: "LANDED" });
        if (rbRef.current && cs.gravityWasZeroed) {
          rbRef.current.setGravityScale(1, true);
          cs.gravityWasZeroed = false;
        }
        // Pop the player up onto the platform a bit so they don't fall
        // straight back down once gravity returns. The climb_topout
        // animation will read on top of this brief lift.
        setTranslation(newX + cs.normal.x * 0.6, cs.topY + 0.05, newZ + cs.normal.z * 0.6);
        setLinvel(0, 0, 0);
        cs.active = false;
        useClimbPrompt.getState().setClimbing(false);
        stopClimbScrape();
      }

      // Soft scrape loop: only audible while the player is still
      // mounted *and* actively moving on the wall this frame. Done
      // after the dismount/topout checks so a frame that decides to
      // dismount doesn't briefly start the loop just to tear it back
      // down. startClimbScrape is idempotent so per-frame calls are
      // fine, and we pass the current climb mode (vertical climb vs
      // lateral shimmy) so the audio store can colour the pitch
      // slightly differently for each.
      if (cs.active && (climbV !== 0 || climbH !== 0)) {
        const scrapeMode = climbV !== 0 ? "vertical" : "lateral";
        // Per-frame climb speed (units/sec). Combines vertical and
        // lateral intent so a diagonal climb reads as faster than a
        // pure shimmy or pure climb-up — useAudio uses this to scale
        // the scrape loop's volume + nudge its pitch a touch.
        const climbSpeed = Math.hypot(
          climbV * CLIMB_UP_SPEED,
          climbH * CLIMB_LATERAL_SPEED,
        );
        startClimbScrape(scrapeMode, climbSpeed);
      } else {
        stopClimbScrape();
      }
    } else if (climbState.current.active || climbState.current.gravityWasZeroed) {
      // We left the `climbing` combat state via some other route
      // (combat WALL_LEAVE/JUMP). Reset gravity & climb refs so the next
      // mount starts from a clean slate.
      if (rbRef.current && climbState.current.gravityWasZeroed) {
        rbRef.current.setGravityScale(1, true);
        climbState.current.gravityWasZeroed = false;
      }
      if (climbState.current.active) {
        sendCharEvent({ type: "DISMOUNT_CLIMB" });
        climbState.current.active = false;
        playClimbDismount();
      }
      // Hard safety net: any path that tears down climb state must
      // also kill the scrape loop, otherwise it can leak after a
      // jump-off or combat WALL_LEAVE.
      stopClimbScrape();
      useClimbPrompt.getState().setClimbing(false);
    }

    let slopeAngle = 0;
    // Slope sampling needs a ground-height function. The main game uses
    // its heightmap; other scenes can provide a raycast-backed sampler
    // via `groundSampler`. With no sampler at all we skip slope
    // adjustments and let the body run at its base speed across the
    // visible ground (the tutorial island's default behaviour today).
    if (sampleGroundY && moving && isGrounded.current) {
      const normDir = slopeSampleDir.current.copy(moveDir).normalize();
      const sampleDist = 0.6;
      const hCenter = sampleGroundY(px, pz);
      const hAhead = sampleGroundY(px + normDir.x * sampleDist, pz + normDir.z * sampleDist);
      const hBehind = sampleGroundY(px - normDir.x * sampleDist, pz - normDir.z * sampleDist);
      const hLeft = sampleGroundY(px - normDir.z * sampleDist * 0.5, pz + normDir.x * sampleDist * 0.5);
      const hRight = sampleGroundY(px + normDir.z * sampleDist * 0.5, pz - normDir.x * sampleDist * 0.5);
      const heightDiff = hAhead - hBehind;
      slopeAngle = Math.atan2(heightDiff, sampleDist * 2);

      const maxSlopeAngle = 0.9;
      if (Math.abs(slopeAngle) > maxSlopeAngle) {
        const slideDir = slopeSampleDir.current.set(-normDir.x, 0, -normDir.z).normalize();
        moveDir.add(slideDir.multiplyScalar(0.3));
        slopeAngle = Math.sign(slopeAngle) * maxSlopeAngle;
      }

      const sinSlope = Math.sin(Math.abs(slopeAngle));
      const slopeT = 1.0 - Math.exp(-8.0 * Math.min(delta, 0.05));
      if (slopeAngle > 0) {
        currentSlopeModifier.current = THREE.MathUtils.lerp(
          currentSlopeModifier.current,
          Math.max(0.35, 1.0 - sinSlope * 1.0),
          slopeT
        );
      } else if (slopeAngle < 0) {
        currentSlopeModifier.current = THREE.MathUtils.lerp(
          currentSlopeModifier.current,
          Math.min(1.35, 1.0 + sinSlope * 0.5),
          slopeT
        );
      } else {
        currentSlopeModifier.current = THREE.MathUtils.lerp(currentSlopeModifier.current, 1.0, slopeT);
      }

      const lateralSlope = Math.abs(hLeft - hRight) / sampleDist;
      if (lateralSlope > 1.5) {
        const lateralNudge = hLeft > hRight ? 0.15 : -0.15;
        moveDir.x += normDir.z * lateralNudge;
        moveDir.z -= normDir.x * lateralNudge;
      }

      const horizDist = Math.sqrt(
        Math.pow(px - lastMovePos.current.x, 2) + Math.pow(pz - lastMovePos.current.z, 2)
      );
      if (horizDist < 0.02 * delta * 60) {
        stuckTimer.current += delta;
        if (stuckTimer.current > 0.25) {
          stuckNudgeDir.current.set(
            (Math.random() - 0.5) * 2,
            0,
            (Math.random() - 0.5) * 2
          ).normalize();
          moveDir.add(stuckNudgeDir.current.multiplyScalar(0.5));
          setTranslation(px, terrainH + 0.3, pz);
          setLinvel(moveDir.x * 4, 2.5, moveDir.z * 4);
          stuckTimer.current = 0;
        }
      } else {
        stuckTimer.current = 0;
      }
      lastMovePos.current.set(px, py, pz);
    } else {
      const resetT = 1.0 - Math.exp(-6.0 * Math.min(delta, 0.05));
      currentSlopeModifier.current = THREE.MathUtils.lerp(currentSlopeModifier.current, 1.0, resetT);
      stuckTimer.current = 0;
    }

    if (!inAction && currentCombatState !== "dashing" && currentCombatState !== "dashAttack" &&
        currentCombatState !== "rolling" && currentCombatState !== "skill3" &&
        currentCombatState !== "climbing" && currentCombatState !== "spinSlash") {
      const wantsSprint = keys.sprint && moving;
      const canSprint = wantsSprint && useStamina(20 * delta);

      const cid = useSurvival.getState().activeCharacterId;
      const ps = getCachedPlayerStats(cid);
      const statSpeedMult = ps ? ps.movementSpeed : 1.0;

      let speed: number;
      if (canSprint) {
        speed = physicsConfig.playerSpeed * physicsConfig.sprintMultiplier * charSpeedMult * statSpeedMult;
      } else if (moving) {
        speed = physicsConfig.playerSpeed * charSpeedMult * statSpeedMult;
      } else {
        speed = 0;
      }

      speed *= currentSlopeModifier.current;

      const horizontalSpeed = Math.sqrt(vx * vx + vz * vz);
      setMovementSpeed(horizontalSpeed);

      if (moving) {
        moveDir.normalize();
        const desiredVx = moveDir.x * speed;
        const desiredVz = moveDir.z * speed;
        // Preserve the body's true vertical velocity so gravity actually
        // pulls the player down between frames (and friction holds them
        // on the ground). The only override is the slope-uphill boost,
        // which prevents the body from stalling on inclines.
        let liftVy = vy;
        if (isGrounded.current && slopeAngle > 0.2) {
          liftVy = Math.max(vy, 0.5 + slopeAngle * 2.0);
        }
        setLinvel(desiredVx, liftVy, desiredVz);

        const angle = Math.atan2(moveDir.x, moveDir.z);
        modelRef.current.rotation.y = angle;
      } else if (currentCombatState === "idle" || currentCombatState === "blocking") {
        // Lighter explicit decel — friction now does most of the work
        // through real Rapier contacts. We still nudge horizontal velocity
        // toward zero so the player feels responsive on release, but
        // gravity (vy) is left fully alone so the body sits on terrain.
        const decel = Math.exp(-3.0 * Math.min(delta, 0.05));
        setLinvel(vx * decel, vy, vz * decel);
      }

      if (hitAnimTimer.current <= 0 && transitionLock.current <= 0) {
        if (currentCombatState === "idle" || currentCombatState === "falling") {
          if (isGrounded.current) {
            if (canSprint) {
              if (lastAnimPlayed.current !== "sprint") {
                playAnimation("sprint");
                lastAnimPlayed.current = "sprint";
              }
            } else if (moving) {
              if (lastAnimPlayed.current !== "run") {
                playAnimation("run");
                lastAnimPlayed.current = "run";
              }
            } else {
              if (lastAnimPlayed.current !== "idle") {
                playAnimation("idle");
                lastAnimPlayed.current = "idle";
              }
            }
            // Idle fidget rotation. Only accumulate while truly idle (not
            // moving, no combat, no hit recently) and grounded. Pick a random
            // alt-idle every 8-18s. Trigger via the override slot so it
            // takes the whole body for one cycle and the controller's
            // OVERRIDE_DONE plumbing returns us to base idle automatically.
            if (!moving && !canSprint && currentCombatState === "idle") {
              idleFidgetAccum.current += delta;
              if (!fidgetInFlight.current && idleFidgetAccum.current >= nextFidgetAt.current) {
                // Idle fidget pool. The base idle_alt* set is the legacy
                // weapon-pack flavour; the gesture_* set are the "support"
                // emotes (head nods, head shakes, weight shift) from the
                // basic-gestures pack — short and ambient enough to read as
                // body language rather than a deliberate emote. Manual
                // numpad emotes are handled separately above.
                const variants: AnimationState[] = [
                  "idle_alt", "idle_alt2", "idle_alt3",
                  "gesture_annoyed_shake", "gesture_hard_nod", "gesture_nod_yes",
                  "gesture_lengthy_nod", "gesture_sarcastic_nod",
                  "gesture_no_shake", "gesture_weight_shift",
                  // Quick formal bow — short, polite "non-damage social
                  // collision" read; folds into the ambient idle pool.
                  "quick_formal_bow",
                ];
                const pick = variants[Math.floor(Math.random() * variants.length)];
                fidgetInFlight.current = true;
                controller.triggerOverride(pick);
                idleFidgetAccum.current = 0;
                nextFidgetAt.current = 10 + Math.random() * 8;
                // Estimate the fidget duration so we re-arm only after it
                // finishes; clips are typically 2-4s, use 4 as a safe upper.
                window.setTimeout(() => { fidgetInFlight.current = false; }, 4500);
              }
            } else {
              idleFidgetAccum.current = 0;
            }
          } else if (!isGrounded.current && (currentCombatState as string) !== "jumping" && (currentCombatState as string) !== "doubleJumping") {
            // Fall animation is now driven by the parallel character machine
            // (locomotion region → falling). The combat-state translator
            // emits FALL when combatMachine enters "falling", which routes
            // to playOverride("fall") on the override slot.
            lastAnimPlayed.current = "fall";
          }
        }
      }
    }

    const inDungeon = useGame.getState().inDungeon;
    const bounds = inDungeon ? 500 : 95;
    const clampedX = Math.max(-bounds, Math.min(bounds, px));
    const clampedZ = Math.max(-bounds, Math.min(bounds, pz));
    if (clampedX !== px || clampedZ !== pz) {
      setTranslation(clampedX, py, clampedZ);
      setLinvel(0, vy, 0);

      const wallAxis: "x" | null = (Math.abs(px) > bounds) ? "x" : null;
      if (wallAxis && !isGrounded.current) {
        sendCombat({ type: "WALL_TOUCH", axis: wallAxis });
      }
    }

    if (py < -10) {
      setTranslation(spawnPosition[0], spawnPosition[1] + 2, spawnPosition[2]);
      setLinvel(0, 0, 0);
    }

    // Capsule-anchored-at-feet semantics: body.y == foot height.
    const rawY = py;
    const clampedDt = Math.min(delta, 0.05);
    const inDungeonNow = useGame.getState().inDungeon;
    let footY = rawY;
    if (!inDungeonNow && sampleGroundY) {
      const terrainY = sampleGroundY(px, pz);

      // Per-frame downward "ground sample" against the visible terrain.
      // For the main game this is a bilinear read of the same heightData
      // that builds the visible terrain geometry; for scene-supplied
      // samplers it's typically a raycast against the rendered mesh at
      // (px, pz). Either way it's additive on top of the physics: when
      // the body is grounded but a frame's contact resolution leaves the
      // foot below the visible surface, we hard-clamp it back up so the
      // player never visibly sinks into the ground.
      if (isGrounded.current && py < terrainY) {
        setTranslation(px, terrainY, pz);
        py = terrainY;
      }

      // Step-up assist (≤ 0.3 m). While grounded and moving, sample the
      // ground a short distance ahead in the velocity direction. If it
      // rises by a small step, lift the body to the new foot height so
      // the capsule walks the step instead of stalling its forward
      // velocity against an invisible wall. Above 0.3 m we leave it to
      // the player to jump — that's a wall, not a step.
      if (isGrounded.current) {
        const horizSpeed = Math.hypot(vx, vz);
        if (horizSpeed > 0.5) {
          const stepLook = PLAYER_RADIUS + 0.2;
          const ax = px + (vx / horizSpeed) * stepLook;
          const az = pz + (vz / horizSpeed) * stepLook;
          const stepY = sampleGroundY(ax, az);
          const stepUp = stepY - terrainY;
          if (stepUp > 0.05 && stepUp <= 0.3 && stepY > py) {
            setTranslation(px, stepY, pz);
            py = stepY;
          }
        }
      }

      if (isGrounded.current) {
        footY = terrainY > py ? terrainY : py;
      } else if (py < terrainY) {
        footY = terrainY;
      } else {
        footY = py;
      }
    }
    if (isGrounded.current) {
      const smoothT = 1.0 - Math.exp(-20.0 * clampedDt);
      smoothedY.current = THREE.MathUtils.lerp(smoothedY.current, footY, smoothT);
    } else {
      smoothedY.current = footY;
    }

    playerPos.current.set(px, smoothedY.current, pz);
    modelRef.current.position.set(px, smoothedY.current, pz);

    let targetTilt = 0;
    if (moving && isGrounded.current) {
      if (slopeAngle > 0.15) {
        targetTilt = slopeAngle * 0.3;
      } else if (slopeAngle < -0.1) {
        targetTilt = slopeAngle * 0.3;
      }
    }
    const tiltT = 1.0 - Math.exp(-8.0 * clampedDt);
    currentTiltX.current = THREE.MathUtils.lerp(currentTiltX.current, targetTilt, tiltT);
    if (modelRef.current && Math.abs(currentTiltX.current) > 0.001) {
      modelRef.current.rotation.x = currentTiltX.current;
    } else if (modelRef.current) {
      modelRef.current.rotation.x = 0;
    }

    onPositionUpdate(playerPos.current);
    updateGrassPlayerPosition(playerPos.current.x, playerPos.current.y, playerPos.current.z);

    // Bone-level flinch: update AFTER the mixer so additive rotations
    // layer on top of the current animation pose.
    playerFlinchRef.current?.update(delta);

    // ── NEW: Per-frame combat VFX tick (mesh effects + spell zones) ──
    tickCombatVFX(delta);

    // Suppress stamina regen while on a climb
    // in the climb controller produces a real net loss instead of
    // being immediately repaid by base regen.
    if (currentCombatState !== "climbing") {
      regenStamina(delta);
    }
    hungerTick(delta);
    updateDayTime(delta);

    healthRegenTimer.current += delta;
    if (healthRegenTimer.current >= 2.0) {
      const tickDt = healthRegenTimer.current;
      healthRegenTimer.current = 0;
      const cid = useSurvival.getState().activeCharacterId;
      if (cid) {
        const hungerStatus = getHungerStatus(useSurvival.getState().hunger);
        if (getHungerHealthRegenAllowed(hungerStatus)) {
          const ps = getCachedPlayerStats(cid);
          if (ps && ps.healthRegen > 0) {
            const healAmt = ps.healthRegen * tickDt * 0.2;
            const survBefore = useSurvival.getState().health;
            useSurvival.getState().heal(healAmt);
            const survAfter = useSurvival.getState().health;
            const actualHeal = survAfter - survBefore;
            healAccumRef.current += actualHeal;
            if (healAccumRef.current >= 5) {
              spawnDamageNumber(
                Math.round(healAccumRef.current),
                [playerPos.current.x, playerPos.current.y + 2, playerPos.current.z],
                'heal'
              );
              healAccumRef.current = 0;
            }
          }
        }
      }
    }

    if (keys.use && !useItemCooldown.current && !useHarvest.getState().isHarvesting) {
      const selected = getSelectedItem();
      if (selected && (selected.type === "food" || selected.type === "consumable")) {
        const survival = useSurvival.getState();
        const inv = useInventory.getState();
        inv.removeItem(selected.id, 1);
        useItemCooldown.current = true;
        setHealParticleActive(true);

        if (selected.hungerRestore) {
          survival.eat(selected.hungerRestore, selected.healAmount || 0);
        } else if (selected.healAmount) {
          survival.heal(selected.healAmount);
        }

        if (selected.staminaRestore) {
          survival.restoreStamina(selected.staminaRestore);
        }

        const displayAmount = selected.healAmount || selected.hungerRestore || selected.staminaRestore || 0;
        spawnDamageNumber(
          Math.round(displayAmount),
          [playerPos.current.x, playerPos.current.y + 2, playerPos.current.z],
          'heal'
        );
        setTimeout(() => { useItemCooldown.current = false; setHealParticleActive(false); }, 800);
      }
    }
  });

  const pPos: [number, number, number] = [playerPos.current.x, playerPos.current.y, playerPos.current.z];

  // Shared callback for any blockable projectile (Hadouken / Fireball /
  // Bullet / MagicMissile). Fires the frame the rebound is triggered.
  // Spawns a spark/flash, plays the parry SFX, drops a "BLOCK!" damage
  // number, and consumes a chunk of stamina as the parry meter cost.
  const handleProjectileBlock = useCallback(
    (info: { position: [number, number, number] }) => {
      blockSparkPos.current = info.position;
      setBlockSparkActive(true);
      setTimeout(() => setBlockSparkActive(false), 350);
      try { playHit(); } catch {}
      try { playSuccess(); } catch {}
      // Parry stamina cost — small enough that you can chain a couple
      // blocks but real enough that spam-blocking will gas you out.
      // Pulse the HUD stamina bar + show a "-N" floating label so the
      // drain is legible (otherwise it just looks like sprint loss).
      const PARRY_COST = 8;
      try {
        if (useStamina(PARRY_COST)) {
          useStaminaFlash.getState().triggerBlock(PARRY_COST);
        }
      } catch {}
      // Brief gold/white edge vignette so a clean parry feels rewarding
      // visually too, not just audibly. Fires only on the perfect-timing
      // rebound path (this callback) — regular damage-soak blocks
      // intentionally don't trigger it. Gated on `gameplay.flashEffects`
      // inside the overlay so the accessibility toggle still applies.
      try { useParryFlash.getState().trigger(); } catch {}
      spawnDamageNumber(
        0,
        [info.position[0], info.position[1] + 0.5, info.position[2]],
        'block',
      );
    },
    [playHit, playSuccess, useStamina, spawnDamageNumber],
  );

  // Shared callback for when a rebounded projectile actually lands on an
  // enemy. The damage + enemy update are already applied inside
  // tryReboundProjectileHit; here we just spawn the on-impact VFX/SFX.
  const handleProjectileReboundHit = useCallback(
    (info: {
      position: [number, number, number];
      enemyId: string;
      damage: number;
      killed: boolean;
    }) => {
      hitParticlePos.current = info.position;
      setHitParticleActive(true);
      setTimeout(() => setHitParticleActive(false), 400);
      try { playHit(); } catch {}
    },
    [playHit],
  );

  return (
    <>
      <RigidBody
        // Re-key on the convex-hull signature so the collider rebuilds
        // exactly when the character silhouette changes (model swap,
        // scale change, body morph) — not on every render. The hull
        // signature already incorporates point count + AABB extents +
        // a vertex checksum, so two morphologically-identical scenes
        // share a key and don't trigger a rebuild.
        // The rb helpers above are null-safe so this re-key is harmless
        // mid-frame: any pending getPos/setLinvel call early-returns.
        key={`player-rb-${hullSig}`}
        ref={rbRef}
        // Seed the new body from the last-known transform (cached above),
        // not from spawnPosition. On the very first mount this is still
        // spawnPosition; on every subsequent re-key it's wherever the
        // player actually was when the previous body unmounted, so the
        // model never "snaps to spawn" for a frame when bounds settle.
        position={lastPos.current}
        type="dynamic"
        mass={PLAYER_MASS}
        linearDamping={0.5}
        angularDamping={1.0}
        // Lock all rotations so the capsule stays upright on slopes and
        // never tips on contact resolution.
        enabledRotations={[false, false, false]}
        colliders={false}
        collisionGroups={COLLISION_MASKS.PLAYER}
        ccd={true}
      >
        {/* Convex-hull collider built from the actual character mesh.
            Sampling, decimation, and signature live in
            `lib/physics/characterHull.ts`; the points are in body-local
            coordinates so the hull lines up 1:1 with the visible model
            (vertex y=0 sits at body.y, the foot plane).

            ── WHY A CONVEX HULL (not a capsule or compound) ──
            The bulk capsule is gone — the silhouette of the body now
            tracks every character's actual shape (slim ranger, broad
            warrior, hunched goblin) instead of a one-size sausage that
            never fit any of them. Hull is regenerated on character
            swap / morph; everything else (rotations locked upright,
            real friction, zero restitution, CCD) is unchanged.

            Friction (0.5, Average combine) keeps the body from sliding
            forever after locomotion releases velocity, without grip so
            hard it can't slide past corners. Restitution=0 kills bounce
            on landing. Toggle the wireframe overlay below from F8 →
            "Player collider" to inspect the hull live. */}
        {hullPoints ? (
          <ConvexHullCollider
            args={[hullPoints]}
            friction={0.5}
            frictionCombineRule={CoefficientCombineRule.Average}
            restitution={0.0}
          />
        ) : (
          // Fallback for the brief window before scene + bounds + morph
          // have all settled and we can sample the hull. Without ANY
          // collider the dynamic body would fall through the heightfield
          // on the first physics step, so a sized capsule keeps the
          // player on the ground until the hull lands. The RigidBody
          // re-keys when the hull arrives, so this fallback dies cleanly.
          <CapsuleCollider
            args={[PLAYER_HALF_HEIGHT, PLAYER_RADIUS]}
            position={[0, PLAYER_HALF_HEIGHT + PLAYER_RADIUS, 0]}
            friction={0.5}
            frictionCombineRule={CoefficientCombineRule.Average}
            restitution={0.0}
          />
        )}
        {/* Debug overlay — only renders when cheats panel is enabled
            AND "Player collider" is on. Mounted inside the rigid body
            so it follows the player without manual setPosition. */}
        <PlayerColliderDebug points={hullPoints} />
      </RigidBody>
      <group ref={modelRef} position={spawnPosition}>
        <primitive object={scene} />
      </group>
      {/* WeaponIK disabled — was fighting the animation mixer and causing
          the hero to spazz. Will re-enable behind a per-character toggle
          once the bend-plane tracks character facing instead of world X. */}
      {false && (
        <WeaponIKController
          scene={scene}
          rightHandRef={rightHand}
          leftHandRef={leftHand}
          weaponRight={selectedCharacter.weaponRight}
          weaponLeft={selectedCharacter.weaponLeft}
        />
      )}
      <GripPoseController
        scene={scene}
        weaponRight={selectedCharacter.weaponRight}
        weaponLeft={selectedCharacter.weaponLeft}
      />
      <WeaponGizmoOverlay />
      {hitParticleActive && <HitParticles position={hitParticlePos.current} active={hitParticleActive} />}
      {blockSparkActive && (
        <HitParticles
          position={blockSparkPos.current}
          active={blockSparkActive}
          color="#7ad7ff"
        />
      )}
      {healParticleActive && <HealParticles position={pPos} active={healParticleActive} />}
      {skill1Active && (
        <HadoukenProjectile
          position={pPos}
          direction={facingDir.current}
          active={skill1Active}
          onBlock={handleProjectileBlock}
          onReboundHit={handleProjectileReboundHit}
        />
      )}
      {skill2Active && <ShoryukenFlame position={pPos} active={skill2Active} />}
      {earthquakeActive && <EarthquakeShockwave position={pPos} active={earthquakeActive} />}
      {skill3Active && <TatsumakiWind position={pPos} active={skill3Active} />}
      {dashActive && <DashTrail position={pPos} active={dashActive} />}
      {skill5Active && <SpinSlashRing position={pPos} active={skill5Active} />}
      {slashActive && <MeleeSlashEffect position={pPos} direction={facingDir.current} active={slashActive} />}
      {/* Spline-driven blade trail. Reads chargeTier + chargeStrikeFlash via
          refs so transitions inside useFrame (which mutate refs without
          re-rendering) are reflected without spamming React state. */}
      <WeaponTrail
        bone={rightHand}
        active={slashActive}
        chargeTierRef={chargeTier}
        chargeStrikeFlashRef={chargeStrikeFlashRef}
        weaponType={activeWeaponType}
        attackIdRef={attackIdRef}
      />
      <SwordBlinkFlash anchor={rightHand} tier={flashTier} seq={flashSeq} />
      {fireballActive && (
        <FireballProjectile
          position={pPos}
          direction={facingDir.current}
          active={fireballActive}
          onBlock={handleProjectileBlock}
          onReboundHit={handleProjectileReboundHit}
        />
      )}
      {iceLanceActive && <IceLanceProjectile position={pPos} direction={facingDir.current} active={iceLanceActive} />}
      {rockActive && <RockProjectile position={pPos} direction={facingDir.current} active={rockActive} />}
      {rootActive && <RootAOE position={pPos} active={rootActive} />}
      {distortionActive && <DistortionAOE position={pPos} active={distortionActive} />}
      {arrowActive && <ArrowProjectile position={pPos} direction={facingDir.current} active={arrowActive} arrowModelId={selectedCharacter.arrowModelId ?? null} />}
      {boltActive && <CrossbowBoltProjectile position={pPos} direction={facingDir.current} active={boltActive} />}
      {bulletActive && (
        <BulletProjectile
          position={pPos}
          direction={facingDir.current}
          active={bulletActive}
          onBlock={handleProjectileBlock}
          onReboundHit={handleProjectileReboundHit}
        />
      )}
      {magicMissileActive && (
        <MagicMissileProjectile
          position={pPos}
          direction={facingDir.current}
          active={magicMissileActive}
          onBlock={handleProjectileBlock}
          onReboundHit={handleProjectileReboundHit}
        />
      )}
      {lightningActive && <LightningBoltProjectile position={pPos} direction={facingDir.current} active={lightningActive} />}
      {levelUpActive && <LevelUpEffect position={pPos} active={levelUpActive} />}
      {critFlashActive && <CriticalHitFlash position={critFlashPos.current} active={critFlashActive} />}
      <ChargeImpactShockwave position={chargeImpactPos.current} seq={chargeImpactSeq} />
      <DamageNumbersRenderer />
    </>
  );
}

export default function Player(props: PlayerProps) {
  return (
    <Suspense fallback={
      <mesh position={[0, 0.8, 0]}>
        <capsuleGeometry args={[0.3, 0.8, 8, 16]} />
        <meshStandardMaterial color="#4a90d9" />
      </mesh>
    }>
      <PlayerModel {...props} />
    </Suspense>
  );
}
