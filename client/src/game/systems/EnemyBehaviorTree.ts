import * as THREE from "three";
import type { AIBehaviorProfile, EmoteType } from "../islands/TrainingIslandRegistry";

const _tempVec1 = new THREE.Vector3();
const _tempVec2 = new THREE.Vector3();
const _tempVec3 = new THREE.Vector3();

export enum BehaviorStatus {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
  RUNNING = "RUNNING",
}

export interface EnemyBlackboard {
  playerPos: THREE.Vector3;
  selfPos: THREE.Vector3;
  health: number;
  maxHealth: number;
  detectionRange: number;
  attackRange: number;
  speed: number;
  wanderTarget: THREE.Vector3 | null;
  wanderTimer: number;
  lastAttackTime: number;
  attackCooldown: number;
  damage: number;
  moveDirection: THREE.Vector3 | null;
  attackRequested: boolean;
  fleeRequested: boolean;

  behaviorProfile: AIBehaviorProfile;
  emoteRequested: EmoteType | null;
  lastEmoteTime: number;
  emoteCooldown: number;

  anchorPos: THREE.Vector3 | null;
  ambushTriggered: boolean;
  ambushDetectRange: number;

  patrolPoints: THREE.Vector3[];
  patrolIndex: number;
  patrolWaitTimer: number;

  allyPositions: THREE.Vector3[];
  chargeSpeed: number;
  isCharging: boolean;

  isAlpha: boolean;
  packTarget: THREE.Vector3 | null;
  lastPlayerVelocity: THREE.Vector3;
  prevPlayerPos: THREE.Vector3;
  strafeDir: number;
  strafeTimer: number;
  retreatHealTimer: number;
  healingActive: boolean;
  lastDamagedTime: number;
  combatEngageTime: number;
  playerLevel: number;
  difficultyScale: number;
}

export abstract class BehaviorNode {
  abstract tick(blackboard: EnemyBlackboard, delta: number): BehaviorStatus;
}

export class SelectorNode extends BehaviorNode {
  children: BehaviorNode[];
  constructor(children: BehaviorNode[]) {
    super();
    this.children = children;
  }
  tick(blackboard: EnemyBlackboard, delta: number): BehaviorStatus {
    for (const child of this.children) {
      const status = child.tick(blackboard, delta);
      if (status === BehaviorStatus.SUCCESS || status === BehaviorStatus.RUNNING) {
        return status;
      }
    }
    return BehaviorStatus.FAILURE;
  }
}

export class SequenceNode extends BehaviorNode {
  children: BehaviorNode[];
  constructor(children: BehaviorNode[]) {
    super();
    this.children = children;
  }
  tick(blackboard: EnemyBlackboard, delta: number): BehaviorStatus {
    for (const child of this.children) {
      const status = child.tick(blackboard, delta);
      if (status === BehaviorStatus.FAILURE || status === BehaviorStatus.RUNNING) {
        return status;
      }
    }
    return BehaviorStatus.SUCCESS;
  }
}

export class LeafNode extends BehaviorNode {
  private fn: (blackboard: EnemyBlackboard, delta: number) => BehaviorStatus;
  constructor(fn: (blackboard: EnemyBlackboard, delta: number) => BehaviorStatus) {
    super();
    this.fn = fn;
  }
  tick(blackboard: EnemyBlackboard, delta: number): BehaviorStatus {
    return this.fn(blackboard, delta);
  }
}

const IsPlayerInAttackRange = new LeafNode((bb) => {
  const dist = bb.selfPos.distanceTo(bb.playerPos);
  return dist < bb.attackRange ? BehaviorStatus.SUCCESS : BehaviorStatus.FAILURE;
});

const IsPlayerDetected = new LeafNode((bb) => {
  const effectiveRange = bb.detectionRange * (1 + bb.difficultyScale * 0.15);
  const dist = bb.selfPos.distanceTo(bb.playerPos);
  return dist < effectiveRange ? BehaviorStatus.SUCCESS : BehaviorStatus.FAILURE;
});

const IsHealthLow = new LeafNode((bb) => {
  return bb.health / bb.maxHealth < 0.25 ? BehaviorStatus.SUCCESS : BehaviorStatus.FAILURE;
});

const IsHealthCritical = new LeafNode((bb) => {
  return bb.health / bb.maxHealth < 0.15 ? BehaviorStatus.SUCCESS : BehaviorStatus.FAILURE;
});

const HasWanderTarget = new LeafNode((bb) => {
  return bb.wanderTarget !== null ? BehaviorStatus.SUCCESS : BehaviorStatus.FAILURE;
});

const AttackAction = new LeafNode((bb) => {
  const now = performance.now() / 1000;
  const scaledCooldown = bb.attackCooldown / (1 + bb.difficultyScale * 0.1);
  if (now - bb.lastAttackTime > scaledCooldown) {
    bb.attackRequested = true;
    bb.lastAttackTime = now;
    bb.combatEngageTime = bb.combatEngageTime || now;
    return BehaviorStatus.SUCCESS;
  }
  return BehaviorStatus.RUNNING;
});

const FacePlayerAction = new LeafNode((bb) => {
  return BehaviorStatus.SUCCESS;
});

const MoveTowardPlayerAction = new LeafNode((bb, delta) => {
  const dir = _tempVec1.subVectors(bb.playerPos, bb.selfPos);
  dir.y = 0;
  if (dir.lengthSq() > 0) {
    bb.moveDirection = dir.normalize().multiplyScalar(bb.speed * delta);
  }
  return BehaviorStatus.SUCCESS;
});

const FleeFromPlayerAction = new LeafNode((bb, delta) => {
  const dir = _tempVec1.subVectors(bb.selfPos, bb.playerPos);
  dir.y = 0;
  if (dir.lengthSq() > 0) {
    bb.moveDirection = dir.normalize().multiplyScalar(bb.speed * delta);
    bb.fleeRequested = true;
  }
  return BehaviorStatus.SUCCESS;
});

const MoveToWanderTargetAction = new LeafNode((bb, delta) => {
  if (!bb.wanderTarget) return BehaviorStatus.FAILURE;
  const dir = _tempVec1.subVectors(bb.wanderTarget, bb.selfPos);
  dir.y = 0;
  if (dir.lengthSq() < 1) {
    bb.wanderTarget = null;
    return BehaviorStatus.SUCCESS;
  }
  bb.moveDirection = dir.normalize().multiplyScalar(bb.speed * 0.3 * delta);
  return BehaviorStatus.RUNNING;
});

const SetNewWanderTargetAction = new LeafNode((bb) => {
  const bounds = 90;
  bb.wanderTarget = new THREE.Vector3(
    Math.max(-bounds, Math.min(bounds, bb.selfPos.x + (Math.random() - 0.5) * 20)),
    0,
    Math.max(-bounds, Math.min(bounds, bb.selfPos.z + (Math.random() - 0.5) * 20))
  );
  bb.wanderTimer = 3 + Math.random() * 5;
  return BehaviorStatus.SUCCESS;
});

const IdleAction = new LeafNode((bb, delta) => {
  bb.wanderTimer -= delta;
  bb.moveDirection = null;
  if (bb.wanderTimer <= 0) {
    return BehaviorStatus.FAILURE;
  }
  return BehaviorStatus.RUNNING;
});

const IsAmbushProfile = new LeafNode((bb) => {
  return bb.behaviorProfile === "ambush" ? BehaviorStatus.SUCCESS : BehaviorStatus.FAILURE;
});

const IsAmbushNotTriggered = new LeafNode((bb) => {
  return !bb.ambushTriggered ? BehaviorStatus.SUCCESS : BehaviorStatus.FAILURE;
});

const AmbushHideAction = new LeafNode((bb) => {
  const dist = bb.selfPos.distanceTo(bb.playerPos);
  if (dist < bb.ambushDetectRange) {
    bb.ambushTriggered = true;
    bb.emoteRequested = "warn";
    return BehaviorStatus.FAILURE;
  }
  bb.moveDirection = null;
  return BehaviorStatus.RUNNING;
});

const IsDefensiveProfile = new LeafNode((bb) => {
  return bb.behaviorProfile === "defensive" ? BehaviorStatus.SUCCESS : BehaviorStatus.FAILURE;
});

const DefensiveHoldAction = new LeafNode((bb, delta) => {
  if (!bb.anchorPos) {
    bb.anchorPos = bb.selfPos.clone();
  }
  const distToPlayer = bb.selfPos.distanceTo(bb.playerPos);
  if (distToPlayer < bb.attackRange) {
    return BehaviorStatus.FAILURE;
  }
  const distToAnchor = bb.selfPos.distanceTo(bb.anchorPos);
  if (distToAnchor > 3) {
    const dir = _tempVec1.subVectors(bb.anchorPos, bb.selfPos);
    dir.y = 0;
    if (dir.lengthSq() > 0) {
      bb.moveDirection = dir.normalize().multiplyScalar(bb.speed * 0.5 * delta);
    }
  } else {
    bb.moveDirection = null;
  }
  if (distToPlayer < bb.detectionRange * 0.6) {
    return BehaviorStatus.FAILURE;
  }
  return BehaviorStatus.RUNNING;
});

const IsBerserkerProfile = new LeafNode((bb) => {
  return bb.behaviorProfile === "berserker" ? BehaviorStatus.SUCCESS : BehaviorStatus.FAILURE;
});

const BerserkerChargeAction = new LeafNode((bb, delta) => {
  const dist = bb.selfPos.distanceTo(bb.playerPos);
  const healthPct = bb.health / bb.maxHealth;
  const chargeMultiplier = healthPct < 0.3 ? 2.5 : healthPct < 0.5 ? 2.0 : 1.8;
  if (dist > bb.attackRange && dist < bb.detectionRange * 1.5) {
    const predictedPos = _tempVec1.copy(bb.playerPos).add(
      _tempVec2.copy(bb.lastPlayerVelocity).multiplyScalar(0.3)
    );
    const dir = _tempVec3.subVectors(predictedPos, bb.selfPos);
    dir.y = 0;
    if (dir.lengthSq() > 0) {
      bb.moveDirection = dir.normalize().multiplyScalar(bb.speed * chargeMultiplier * delta);
      bb.isCharging = true;
    }
    if (healthPct < 0.3) {
      tryEmote(bb, "rally");
    }
    return BehaviorStatus.RUNNING;
  }
  bb.isCharging = false;
  return BehaviorStatus.FAILURE;
});

const IsCoordinatedProfile = new LeafNode((bb) => {
  return bb.behaviorProfile === "coordinated" ? BehaviorStatus.SUCCESS : BehaviorStatus.FAILURE;
});

const CoordinatedFlankAction = new LeafNode((bb, delta) => {
  const dist = bb.selfPos.distanceTo(bb.playerPos);
  if (dist > bb.detectionRange || dist < bb.attackRange) return BehaviorStatus.FAILURE;

  const predictedPos = _tempVec1.copy(bb.playerPos).add(
    _tempVec2.copy(bb.lastPlayerVelocity).multiplyScalar(0.5)
  );
  const toPlayer = _tempVec3.subVectors(predictedPos, bb.selfPos);
  toPlayer.y = 0;

  const flankAngle = bb.isAlpha
    ? 0
    : (bb.patrolIndex % 4 === 0) ? Math.PI / 3
    : (bb.patrolIndex % 4 === 1) ? -Math.PI / 3
    : (bb.patrolIndex % 4 === 2) ? Math.PI / 6
    : -Math.PI / 6;

  const cos = Math.cos(flankAngle);
  const sin = Math.sin(flankAngle);
  const flankX = toPlayer.x * cos - toPlayer.z * sin;
  const flankZ = toPlayer.x * sin + toPlayer.z * cos;
  const flanked = _tempVec1.set(flankX, 0, flankZ);

  const allySpacing = 2.5;
  for (const allyPos of bb.allyPositions) {
    const allyDist = bb.selfPos.distanceTo(allyPos);
    if (allyDist < allySpacing && allyDist > 0.1) {
      const pushAway = _tempVec2.subVectors(bb.selfPos, allyPos).normalize();
      flanked.add(pushAway.multiplyScalar(0.5));
    }
  }

  if (flanked.lengthSq() > 0) {
    bb.moveDirection = flanked.normalize().multiplyScalar(bb.speed * 1.2 * delta);
  }

  if (dist < bb.detectionRange * 0.5 && bb.allyPositions.length >= 2) {
    tryEmote(bb, "rally");
  }
  return BehaviorStatus.RUNNING;
});

const IsPatrolProfile = new LeafNode((bb) => {
  return bb.behaviorProfile === "patrol" ? BehaviorStatus.SUCCESS : BehaviorStatus.FAILURE;
});

const PatrolAction = new LeafNode((bb, delta) => {
  if (bb.patrolPoints.length === 0) return BehaviorStatus.FAILURE;

  if (bb.patrolWaitTimer > 0) {
    bb.patrolWaitTimer -= delta;
    bb.moveDirection = null;
    return BehaviorStatus.RUNNING;
  }

  const target = bb.patrolPoints[bb.patrolIndex % bb.patrolPoints.length];
  const dir = _tempVec1.subVectors(target, bb.selfPos);
  dir.y = 0;

  if (dir.lengthSq() < 2) {
    bb.patrolIndex = (bb.patrolIndex + 1) % bb.patrolPoints.length;
    bb.patrolWaitTimer = 1.5 + Math.random() * 2;
    return BehaviorStatus.RUNNING;
  }

  bb.moveDirection = dir.normalize().multiplyScalar(bb.speed * 0.4 * delta);
  return BehaviorStatus.RUNNING;
});

const IsAggressiveProfile = new LeafNode((bb) => {
  return bb.behaviorProfile === "aggressive" ? BehaviorStatus.SUCCESS : BehaviorStatus.FAILURE;
});

const AggressiveChaseAction = new LeafNode((bb, delta) => {
  const dist = bb.selfPos.distanceTo(bb.playerPos);
  if (dist > bb.detectionRange * 1.5) return BehaviorStatus.FAILURE;

  const predictedPos = _tempVec1.copy(bb.playerPos).add(
    _tempVec2.copy(bb.lastPlayerVelocity).multiplyScalar(0.4)
  );
  const dir = _tempVec3.subVectors(predictedPos, bb.selfPos);
  dir.y = 0;
  if (dir.lengthSq() > 0) {
    bb.moveDirection = dir.normalize().multiplyScalar(bb.speed * 1.3 * delta);
  }

  if (dist < bb.detectionRange * 0.7) {
    tryEmote(bb, "taunt");
  }
  return BehaviorStatus.SUCCESS;
});

const RetreatAndHealCheck = new LeafNode((bb, delta) => {
  if (bb.behaviorProfile === "berserker") return BehaviorStatus.FAILURE;
  const healthPct = bb.health / bb.maxHealth;
  if (healthPct > 0.35 || healthPct <= 0) return BehaviorStatus.FAILURE;

  const now = performance.now() / 1000;
  if (now - bb.lastDamagedTime < 1.5) return BehaviorStatus.FAILURE;

  if (!bb.healingActive && bb.retreatHealTimer <= 0) {
    bb.healingActive = true;
    bb.retreatHealTimer = 3.0;
    tryEmote(bb, "fear");
  }

  if (bb.healingActive) {
    const fleeDir = _tempVec1.subVectors(bb.selfPos, bb.playerPos);
    fleeDir.y = 0;
    if (fleeDir.lengthSq() > 0) {
      bb.moveDirection = fleeDir.normalize().multiplyScalar(bb.speed * 0.8 * delta);
      bb.fleeRequested = true;
    }

    bb.retreatHealTimer -= delta;
    const regenAmount = bb.maxHealth * 0.03 * delta;
    bb.health = Math.min(bb.maxHealth * 0.4, bb.health + regenAmount);

    if (bb.retreatHealTimer <= 0 || bb.health >= bb.maxHealth * 0.4) {
      bb.healingActive = false;
      bb.retreatHealTimer = 0;
      tryEmote(bb, "rally");
    }
    return BehaviorStatus.RUNNING;
  }
  return BehaviorStatus.FAILURE;
});

const StrafeAction = new LeafNode((bb, delta) => {
  const dist = bb.selfPos.distanceTo(bb.playerPos);
  if (dist > bb.attackRange * 3 || dist < bb.attackRange * 0.8) return BehaviorStatus.FAILURE;

  bb.strafeTimer -= delta;
  if (bb.strafeTimer <= 0) {
    bb.strafeDir = Math.random() > 0.5 ? 1 : -1;
    bb.strafeTimer = 1.5 + Math.random() * 2;
  }

  const toPlayer = _tempVec1.subVectors(bb.playerPos, bb.selfPos);
  toPlayer.y = 0;
  toPlayer.normalize();

  const strafeVec = _tempVec2.set(-toPlayer.z * bb.strafeDir, 0, toPlayer.x * bb.strafeDir);
  const approach = toPlayer.multiplyScalar(0.2);
  const combined = strafeVec.add(approach).normalize();

  bb.moveDirection = combined.multiplyScalar(bb.speed * 0.7 * delta);
  return BehaviorStatus.RUNNING;
});

const PackTacticsAction = new LeafNode((bb, delta) => {
  if (bb.allyPositions.length < 2) return BehaviorStatus.FAILURE;
  const dist = bb.selfPos.distanceTo(bb.playerPos);
  if (dist > bb.detectionRange) return BehaviorStatus.FAILURE;

  if (bb.isAlpha) {
    bb.packTarget = bb.playerPos.clone();
    const dir = _tempVec1.subVectors(bb.playerPos, bb.selfPos);
    dir.y = 0;
    if (dir.lengthSq() > 0) {
      bb.moveDirection = dir.normalize().multiplyScalar(bb.speed * 1.1 * delta);
    }
    if (dist < bb.detectionRange * 0.4) {
      tryEmote(bb, "rally");
    }
  } else {
    const alphaPos = bb.allyPositions[0];
    if (alphaPos) {
      const behindAlpha = _tempVec1.subVectors(alphaPos, bb.playerPos).normalize();
      const flankOffsetX = -behindAlpha.z * bb.strafeDir * 3;
      const flankOffsetZ = behindAlpha.x * bb.strafeDir * 3;
      const targetPos = _tempVec2.copy(bb.playerPos).add(behindAlpha.multiplyScalar(-3));
      targetPos.x += flankOffsetX;
      targetPos.z += flankOffsetZ;
      const dir = _tempVec3.subVectors(targetPos, bb.selfPos);
      dir.y = 0;
      if (dir.lengthSq() > 0) {
        bb.moveDirection = dir.normalize().multiplyScalar(bb.speed * 1.0 * delta);
      }
    }
  }
  return BehaviorStatus.RUNNING;
});

const EmoteOnDetection = new LeafNode((bb) => {
  const dist = bb.selfPos.distanceTo(bb.playerPos);
  if (dist < bb.detectionRange && !bb.emoteRequested) {
    const healthPct = bb.health / bb.maxHealth;
    if (healthPct < 0.15) {
      tryEmote(bb, "fear");
    } else if (healthPct < 0.3) {
      tryEmote(bb, "warn");
    } else if (bb.isCharging) {
      tryEmote(bb, "taunt");
    }
  }
  return BehaviorStatus.SUCCESS;
});

function tryEmote(bb: EnemyBlackboard, emote: EmoteType) {
  const now = performance.now() / 1000;
  if (now - bb.lastEmoteTime > bb.emoteCooldown) {
    bb.emoteRequested = emote;
    bb.lastEmoteTime = now;
  }
}

const BerserkerNoFlee = new LeafNode((bb) => {
  return bb.behaviorProfile === "berserker" ? BehaviorStatus.FAILURE : BehaviorStatus.SUCCESS;
});

export function createEnemyBehaviorTree(profile: AIBehaviorProfile = "patrol"): { tree: SelectorNode; blackboard: EnemyBlackboard } {
  const ambushWait = new SequenceNode([
    IsAmbushProfile,
    IsAmbushNotTriggered,
    AmbushHideAction,
  ]);

  const retreatHeal = new SequenceNode([
    IsHealthLow,
    RetreatAndHealCheck,
  ]);

  const berserkerCharge = new SequenceNode([
    IsBerserkerProfile,
    IsPlayerDetected,
    BerserkerChargeAction,
  ]);

  const coordinatedFlank = new SequenceNode([
    IsCoordinatedProfile,
    IsPlayerDetected,
    new SelectorNode([
      PackTacticsAction,
      CoordinatedFlankAction,
    ]),
  ]);

  const defensiveHold = new SequenceNode([
    IsDefensiveProfile,
    DefensiveHoldAction,
  ]);

  const aggressiveChase = new SequenceNode([
    IsAggressiveProfile,
    AggressiveChaseAction,
  ]);

  const patrolBehavior = new SequenceNode([
    IsPatrolProfile,
    PatrolAction,
  ]);

  const fleeSequence = new SequenceNode([
    BerserkerNoFlee,
    IsHealthCritical,
    IsPlayerDetected,
    FleeFromPlayerAction,
  ]);

  const attackSequence = new SequenceNode([
    IsPlayerInAttackRange,
    FacePlayerAction,
    AttackAction,
  ]);

  const rangedStrafe = new SequenceNode([
    IsPlayerDetected,
    StrafeAction,
  ]);

  const chaseSequence = new SequenceNode([
    IsPlayerDetected,
    MoveTowardPlayerAction,
  ]);

  const wanderSequence = new SequenceNode([
    HasWanderTarget,
    MoveToWanderTargetAction,
  ]);

  const newWanderSequence = new SequenceNode([
    SetNewWanderTargetAction,
    MoveToWanderTargetAction,
  ]);

  const idleOrWander = new SelectorNode([
    patrolBehavior,
    wanderSequence,
    IdleAction,
    newWanderSequence,
  ]);

  const tree = new SelectorNode([
    ambushWait,
    retreatHeal,
    fleeSequence,
    berserkerCharge,
    attackSequence,
    coordinatedFlank,
    defensiveHold,
    aggressiveChase,
    rangedStrafe,
    chaseSequence,
    idleOrWander,
  ]);

  const sp = new THREE.Vector3(
    (Math.random() - 0.5) * 30,
    0,
    (Math.random() - 0.5) * 30
  );

  const patrolPoints: THREE.Vector3[] = [];
  const numPatrolPts = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numPatrolPts; i++) {
    patrolPoints.push(new THREE.Vector3(
      sp.x + (Math.random() - 0.5) * 40,
      0,
      sp.z + (Math.random() - 0.5) * 40
    ));
  }

  const blackboard: EnemyBlackboard = {
    playerPos: new THREE.Vector3(),
    selfPos: new THREE.Vector3(),
    health: 100,
    maxHealth: 100,
    detectionRange: 18,
    attackRange: 2.5,
    speed: 3,
    wanderTarget: null,
    wanderTimer: 3 + Math.random() * 5,
    lastAttackTime: 0,
    attackCooldown: 1.2,
    damage: 10,
    moveDirection: null,
    attackRequested: false,
    fleeRequested: false,

    behaviorProfile: profile,
    emoteRequested: null,
    lastEmoteTime: 0,
    emoteCooldown: 8,

    anchorPos: null,
    ambushTriggered: false,
    ambushDetectRange: 10,

    patrolPoints,
    patrolIndex: 0,
    patrolWaitTimer: 0,

    allyPositions: [],
    chargeSpeed: 0,
    isCharging: false,

    isAlpha: Math.random() < 0.2,
    packTarget: null,
    lastPlayerVelocity: new THREE.Vector3(),
    prevPlayerPos: new THREE.Vector3(),
    strafeDir: Math.random() > 0.5 ? 1 : -1,
    strafeTimer: 1.5 + Math.random() * 2,
    retreatHealTimer: 0,
    healingActive: false,
    lastDamagedTime: 0,
    combatEngageTime: 0,
    playerLevel: 1,
    difficultyScale: 0,
  };

  return { tree, blackboard };
}

export function updatePlayerTracking(bb: EnemyBlackboard, currentPlayerPos: THREE.Vector3, delta: number) {
  const velocity = _tempVec1.subVectors(currentPlayerPos, bb.prevPlayerPos);
  if (delta > 0) {
    velocity.divideScalar(delta);
  }
  bb.lastPlayerVelocity.lerp(velocity, 0.3);
  bb.prevPlayerPos.copy(currentPlayerPos);
  bb.playerPos.copy(currentPlayerPos);
}

export function scaleDifficulty(bb: EnemyBlackboard, playerLevel: number, baseMaxHealth: number, baseDamage: number, baseSpeed: number) {
  if (bb.playerLevel === playerLevel) return;
  bb.playerLevel = playerLevel;
  bb.difficultyScale = Math.min(playerLevel / 10, 2.0);
  const scale = 1 + bb.difficultyScale * 0.1;
  bb.maxHealth = baseMaxHealth * scale;
  bb.health = Math.min(bb.health, bb.maxHealth);
  bb.damage = baseDamage * (1 + bb.difficultyScale * 0.08);
  bb.speed = baseSpeed * (1 + bb.difficultyScale * 0.05);
}

export function tickEnemyBT(
  tree: SelectorNode,
  blackboard: EnemyBlackboard,
  delta: number
): EnemyBlackboard {
  blackboard.moveDirection = null;
  blackboard.attackRequested = false;
  blackboard.fleeRequested = false;
  blackboard.emoteRequested = null;
  blackboard.isCharging = false;

  EmoteOnDetection.tick(blackboard, delta);
  tree.tick(blackboard, delta);

  return blackboard;
}
