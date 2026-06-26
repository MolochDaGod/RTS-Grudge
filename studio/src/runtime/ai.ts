/**
 * Full AI system for island creatures.
 *
 * Behaviors:
 *   idle    — pause then re-enter wander
 *   wander  — pick random point within homeRadius; unstick after 4 s no movement
 *   flee    — sprint away from predator OR player camera
 *   pursue  — predators close in on nearest prey (wolf → deer, shark → fish, etc.)
 *   circle  — air animals fly a large variable orbit with wind-riding mode +
 *             altitude drift + random direction reversals
 *   swim    — aquatic orbit at sea surface with depth oscillation
 *
 * Per-species config handles:
 *   - isPredator flag (wolves/harpy/shark/croc are predators)
 *   - facingOffset   (ibex GLB faces backward → +π correction)
 *
 * Unstick: if any land animal hasn’t moved >0.3 m in 4 s, a new wander
 * target is forced so animals never freeze on steep terrain.
 *
 * debugState string on each creature shows the current FSM state for
 * the in-game overlay (toggled from the Play HUD).
 */
import * as THREE from 'three';
import type { PlacedEntity, Vec3 } from '../types';
import { pickNavTarget, type NavWaypoint } from './islandNavGraph';

export type CreatureState = 'idle' | 'wander' | 'flee' | 'pursue' | 'circle' | 'swim';

export interface CreatureRuntime {
  id: string;
  species: string;
  asset?: string;
  state: CreatureState;
  pos: THREE.Vector3;
  yaw: number;
  target: THREE.Vector3;
  timer: number;
  speed: number;
  fleeSpeed: number;
  visionRadius: number;
  homeX: number;
  homeZ: number;
  homeRadius: number;
  // Predator / prey
  isPredator: boolean;
  pursueTarget?: string;   // id of creature currently being chased
  // Facing correction (ibex faces -Z in the GLB)
  facingOffset: number;
  // Air / swim shared
  centerX?: number;
  centerZ?: number;
  altitude?: number;
  radius?: number;
  phase?: number;
  // Air-specific
  orbitDir: 1 | -1;        // 1=CCW  -1=CW
  baseRadius: number;
  baseAlt: number;
  windRiding: boolean;     // slow glide mode vs active flap
  windTimer: number;       // seconds until next wind-mode switch
  altPhase: number;        // drives gentle altitude oscillation
  // Unstick
  lastPos: THREE.Vector3;
  stuckTimer: number;
  // Debug display
  debugState: string;
}

// ── Per-species defaults ───────────────────────────────────────────────
const SPECIES_CFG: Record<string, { isPredator: boolean; facingOffset: number }> = {
  wolf:        { isPredator: true,  facingOffset: 0 },
  shark:       { isPredator: true,  facingOffset: 0 },
  crocodile:   { isPredator: true,  facingOffset: 0 },
  harpy:       { isPredator: true,  facingOffset: 0 },
  hawk:        { isPredator: true,  facingOffset: 0 },
  velociraptor:{ isPredator: true,  facingOffset: 0 },
  zombie:      { isPredator: true,  facingOffset: 0 },
  deer:        { isPredator: false, facingOffset: 0 },
  ibex:        { isPredator: false, facingOffset: Math.PI }, // GLB is backwards
  buffalo:     { isPredator: false, facingOffset: 0 },
  crab:        { isPredator: false, facingOffset: 0 },
  rabbit:      { isPredator: false, facingOffset: 0 },
  hummingbird: { isPredator: false, facingOffset: 0 },
  dragon:      { isPredator: true,  facingOffset: 0 },
  // fish (all passive unless overridden)
  clownfish:   { isPredator: false, facingOffset: 0 },
  anglerfish:  { isPredator: false, facingOffset: 0 },
  lionfish:    { isPredator: false, facingOffset: 0 },
  puffer:      { isPredator: false, facingOffset: 0 },
  'blue-tang': { isPredator: false, facingOffset: 0 },
  'parrot-fish':{ isPredator: false, facingOffset: 0 },
  swordfish:   { isPredator: false, facingOffset: 0 },
  tuna:        { isPredator: false, facingOffset: 0 },
  piranha:     { isPredator: true,  facingOffset: 0 },
};

function cfgOf(species: string) {
  return SPECIES_CFG[species] ?? { isPredator: false, facingOffset: 0 };
}

export function fromEntity(e: PlacedEntity): CreatureRuntime {
  const d   = e.data ?? {};
  const cfg = cfgOf((d.species as string) ?? 'deer');
  const baseR = Number(d.radius) || 20;
  const baseA = Number(d.altitude) || 8;
  return {
    id: e.id,
    species:      (d.species      as string)           ?? 'deer',
    asset:        (d.asset        as string | undefined) ?? (e.asset as string | undefined),
    state:        ((d.behavior    as CreatureState)     ?? 'wander'),
    pos:          new THREE.Vector3(...e.position),
    yaw:          (e.rotation[1]  ?? 0) + cfg.facingOffset,
    target:       new THREE.Vector3(...e.position),
    timer:        Math.random() * 2,   // stagger so animals don’t all switch at once
    speed:        Number(d.speed)        || 2,
    fleeSpeed:    Number(d.fleeSpeed)    || 5,
    visionRadius: Number(d.visionRadius) || 10,
    homeX:        Number(d.homeX)  || e.position[0],
    homeZ:        Number(d.homeZ)  || e.position[2],
    homeRadius:   Number(d.homeRadius)   || 12,
    isPredator:   cfg.isPredator,
    facingOffset: cfg.facingOffset,
    centerX:      d.centerX  as number | undefined,
    centerZ:      d.centerZ  as number | undefined,
    altitude:     baseA,
    radius:       baseR,
    phase:        Math.random() * Math.PI * 2,
    orbitDir:     Math.random() < 0.5 ? 1 : -1,
    baseRadius:   baseR,
    baseAlt:      baseA,
    windRiding:   false,
    windTimer:    10 + Math.random() * 20,
    altPhase:     Math.random() * Math.PI * 2,
    lastPos:      new THREE.Vector3(...e.position),
    stuckTimer:   0,
    debugState:   'init',
  };
}

// ── Tick entry point ───────────────────────────────────────────────────
const _v  = new THREE.Vector3();
const _v2 = new THREE.Vector3();

interface TickCtx {
  threat:   THREE.Vector3 | null;
  groundAt: (x: number, z: number) => number;
  creatures: CreatureRuntime[]; // full array for predator→prey targeting
  navGraph?: NavWaypoint[];
}

export function tickCreatures(
  crs: CreatureRuntime[], dt: number,
  ctx: Omit<TickCtx, 'creatures'> & { creatures?: CreatureRuntime[] },
): void {
  const full: TickCtx = { ...ctx, creatures: ctx.creatures ?? crs };
  for (const c of crs) {
    c.timer      += dt;
    c.windTimer  -= dt;
    c.altPhase   += dt * 0.12;

    const beh = c.state;

    if (beh === 'circle') { tickAir(c, dt, full); continue; }
    if (beh === 'swim')   { tickSwim(c, dt, full); continue; }

    // ─ Land creatures ───────────────────────────────────────────
    if (c.isPredator) {
      tickPredator(c, dt, full);
    } else {
      tickPrey(c, dt, full);
    }

    // Unstick: if land animal hasn’t moved >0.3 m in 4 s, force a new target
    const moved = c.pos.distanceTo(c.lastPos);
    if (moved > 0.3) {
      c.lastPos.copy(c.pos);
      c.stuckTimer = 0;
    } else {
      c.stuckTimer += dt;
      if (c.stuckTimer > 4.0) {
        pickWanderTarget(c, full.navGraph);
        c.state      = 'wander';
        c.timer      = 0;
        c.stuckTimer = 0;
        c.debugState = 'UNSTUCK';
      }
    }
  }
}

// ── Predator AI ──────────────────────────────────────────────────
function tickPredator(c: CreatureRuntime, dt: number, ctx: TickCtx): void {
  // Scan for nearest non-predator within a looser detection range
  let nearestPrey: CreatureRuntime | null = null;
  let nearDist = c.visionRadius * 2.5;
  for (const other of ctx.creatures) {
    if (other.id === c.id || other.isPredator) continue;
    if (other.state === 'swim' || other.state === 'circle') continue;
    const d = c.pos.distanceTo(other.pos);
    if (d < nearDist) { nearDist = d; nearestPrey = other; }
  }

  if (nearestPrey) {
    // Pursue: set target to prey position and sprint
    c.target.copy(nearestPrey.pos);
    c.pursueTarget = nearestPrey.id;
    c.state        = 'pursue';
    c.debugState   = `pursue:${nearestPrey.species}`;
    moveTowardTarget(c, dt, c.fleeSpeed * 0.8, ctx, () => {
      // Caught prey — release, go idle
      c.state = 'idle'; c.timer = 0; c.pursueTarget = undefined;
    });
    return;
  }

  // No prey nearby — wander loosely
  c.pursueTarget = undefined;
  tickWander(c, dt, ctx);
}

// ── Prey AI ────────────────────────────────────────────────────
function tickPrey(c: CreatureRuntime, dt: number, ctx: TickCtx): void {
  // Check for any nearby predator (or player camera)
  let closestThreat: THREE.Vector3 | null = null;
  let closestDist = c.visionRadius;

  // Player camera threat
  if (ctx.threat) {
    const d = c.pos.distanceTo(ctx.threat);
    if (d < closestDist) { closestDist = d; closestThreat = ctx.threat; }
  }
  // Predator threat
  for (const other of ctx.creatures) {
    if (!other.isPredator) continue;
    const d = c.pos.distanceTo(other.pos);
    if (d < closestDist) { closestDist = d; closestThreat = other.pos; }
  }

  if (closestThreat && c.state !== 'flee') {
    _v.subVectors(c.pos, closestThreat).setY(0).normalize()
      .multiplyScalar(c.homeRadius * 1.5);
    c.target.copy(c.pos).add(_v);
    c.state      = 'flee';
    c.timer      = 0;
    c.debugState = 'FLEE';
  }

  switch (c.state) {
    case 'idle': {
      c.debugState = `idle ${c.timer.toFixed(1)}s`;
      if (c.timer > 1.5 + Math.random() * 3) {
        pickWanderTarget(c, ctx.navGraph); c.state = 'wander'; c.timer = 0;
      }
      break;
    }
    case 'wander': {
      c.debugState = 'wander';
      moveTowardTarget(c, dt, c.speed, ctx, () => { c.state = 'idle'; c.timer = 0; });
      break;
    }
    case 'flee': {
      c.debugState = 'flee!';
      moveTowardTarget(c, dt, c.fleeSpeed, ctx, () => { c.state = 'idle'; c.timer = 0; });
      if (c.timer > 3) { c.state = 'idle'; c.timer = 0; }
      break;
    }
    // prey enter 'pursue' only if something went wrong; treat as wander
    case 'pursue': tickWander(c, dt, ctx); break;
    default: break;
  }
}

function tickWander(c: CreatureRuntime, dt: number, ctx: TickCtx): void {
  switch (c.state) {
    case 'idle':
      c.debugState = `idle ${c.timer.toFixed(1)}s`;
      if (c.timer > 1.5 + Math.random() * 3) { pickWanderTarget(c, ctx.navGraph); c.state = 'wander'; c.timer = 0; }
      break;
    case 'wander':
    case 'pursue':
      c.debugState = c.state;
      moveTowardTarget(c, dt, c.speed, ctx, () => { c.state = 'idle'; c.timer = 0; });
      break;
    default: c.state = 'idle'; c.timer = 0; break;
  }
}

// ── Air AI (circle behavior) ───────────────────────────────────────
function tickAir(c: CreatureRuntime, dt: number, _ctx: TickCtx): void {
  // Wind-riding mode toggle: every windTimer seconds, switch between
  // lazy glide (0.3× speed) and active flight (1.0× speed)
  if (c.windTimer <= 0) {
    c.windRiding  = !c.windRiding;
    c.windTimer   = c.windRiding
      ? 8  + Math.random() * 12   // glide 8–20 s
      : 5  + Math.random() * 10;  // flap  5–15 s
    // Occasionally reverse orbit direction
    if (Math.random() < 0.25) c.orbitDir = c.orbitDir === 1 ? -1 : 1;
    c.debugState = c.windRiding ? 'glide' : 'fly';
  }

  const speedMult = c.windRiding ? 0.30 : 1.0;
  const angVel    = (c.speed / Math.max(4, c.baseRadius)) * speedMult * c.orbitDir;
  c.phase = ((c.phase ?? 0) + angVel * dt + Math.PI * 2) % (Math.PI * 2);

  // Radius oscillates (±25% of base) for an organic path
  const r = c.baseRadius + c.baseRadius * 0.25 * Math.sin(c.altPhase * 0.4);

  // Altitude drifts gently up/down (±3 m)
  const alt = c.baseAlt + 3 * Math.sin(c.altPhase * 0.18);

  const cx = c.centerX ?? 0, cz = c.centerZ ?? 0;
  const x = cx + Math.cos(c.phase) * r;
  const z = cz + Math.sin(c.phase) * r;

  // Yaw tangent to orbit, corrected for direction
  c.yaw = c.phase + (c.orbitDir > 0 ? Math.PI / 2 : -Math.PI / 2) + c.facingOffset;
  c.pos.set(x, alt, z);

  if (!c.debugState || c.debugState === 'init') c.debugState = 'fly';
}

// ── Water AI (swim behavior) ─────────────────────────────────────
function tickSwim(c: CreatureRuntime, dt: number, _ctx: TickCtx): void {
  // Occasional lazy direction reversal (~every 30–60 s)
  if (c.windTimer <= 0) {
    if (Math.random() < 0.4) c.orbitDir = c.orbitDir === 1 ? -1 : 1;
    c.windTimer = 20 + Math.random() * 40;
    // Vary speed a bit (fish school speed variation)
    c.speed = c.speed * (0.8 + Math.random() * 0.4);
    c.debugState = `swim${c.orbitDir > 0 ? '+' : '-'}`;
  }

  const angVel = (c.speed / Math.max(4, c.radius ?? 20)) * c.orbitDir;
  c.phase = ((c.phase ?? 0) + angVel * dt + Math.PI * 2) % (Math.PI * 2);

  const cx = c.centerX ?? 0, cz = c.centerZ ?? 0;
  const r = c.radius ?? 20;

  // Depth oscillation: deep-water spawns use their stamped altitude
  const depthOsc = c.baseAlt < -0.5
    ? c.baseAlt + Math.sin(c.altPhase * 0.25) * 1.2
    : c.isPredator
      ? -0.8 - Math.abs(Math.sin(c.altPhase * 0.25)) * 1.5
      : 0.15 + Math.sin(c.altPhase * 0.3) * 0.1;

  const x = cx + Math.cos(c.phase) * r;
  const z = cz + Math.sin(c.phase) * r;

  c.yaw = c.phase + (c.orbitDir > 0 ? Math.PI / 2 : -Math.PI / 2) + c.facingOffset;
  c.pos.set(x, depthOsc, z);

  if (!c.debugState || c.debugState === 'init') c.debugState = 'swim';
}

// ── Shared movement helpers ─────────────────────────────────────────
function pickWanderTarget(c: CreatureRuntime, navGraph?: NavWaypoint[]): void {
  const nav = navGraph?.length
    ? pickNavTarget(navGraph, c.homeX, c.homeZ, Math.random)
    : null;
  if (nav) {
    c.target.set(nav.x, nav.y, nav.z);
    return;
  }
  const a = Math.random() * Math.PI * 2;
  const r = 0.3 + Math.random() * c.homeRadius;
  c.target.set(
    c.homeX + Math.cos(a) * r,
    c.pos.y,
    c.homeZ + Math.sin(a) * r,
  );
}

function moveTowardTarget(
  c: CreatureRuntime, dt: number, speed: number,
  ctx: Pick<TickCtx, 'groundAt'>, onArrived: () => void,
): void {
  _v.subVectors(c.target, c.pos).setY(0);
  const d = _v.length();
  if (d < 0.35) { onArrived(); return; }
  _v.normalize();

  // Obstacle avoidance: sample terrain 1.5 m to each side;
  // if one side is significantly higher, steer away from it.
  const steerL = ctx.groundAt(c.pos.x - _v.z * 1.5, c.pos.z + _v.x * 1.5);
  const steerR = ctx.groundAt(c.pos.x + _v.z * 1.5, c.pos.z - _v.x * 1.5);
  const diff   = steerR - steerL;
  if (Math.abs(diff) > 0.6) {
    // Deflect away from the higher side (steer toward the lower)
    _v2.set(-_v.z, 0, _v.x).multiplyScalar(diff > 0 ? -0.4 : 0.4);
    _v.add(_v2).normalize();
  }

  c.pos.x += _v.x * speed * dt;
  c.pos.z += _v.z * speed * dt;
  c.pos.y  = ctx.groundAt(c.pos.x, c.pos.z);

  // Smooth yaw turn
  const desired = Math.atan2(_v.x, _v.z) + c.facingOffset;
  const delta   = ((desired - c.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  c.yaw += delta * Math.min(1, dt * 8);
}

/** Convenience: pull final transform out for renderer. */
export function getTransform(c: CreatureRuntime): { position: Vec3; rotation: Vec3 } {
  return { position: [c.pos.x, c.pos.y, c.pos.z], rotation: [0, c.yaw, 0] };
}
