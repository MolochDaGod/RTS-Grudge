import * as THREE from "three";
import { useEnemyManager, type EnemyData } from "../systems/EnemyManager";
import { useDamageNumbers } from "../effects/DamageNumbers";

/**
 * Allegiance of a projectile. Used by the rebound primitive to swap which
 * side a deflected shot will damage. "neutral" exists for environment-spawned
 * projectiles that should not auto-flip targets on rebound.
 */
export type ProjectileTeam = "player" | "enemy" | "neutral";

/**
 * Mutable refs the projectile component owns. The rebound helper writes back
 * into these so the next frame's trajectory math picks up the flipped
 * direction, the new caster origin, and the swapped allegiance without the
 * component having to re-render.
 */
export interface ReboundableProjectileState {
  teamRef: { current: ProjectileTeam };
  reboundedRef: { current: boolean };
  dirRef: { current: [number, number, number] };
  startPosRef: { current: [number, number, number] };
  timeRef: { current: number };
}

/**
 * Singleton describing the player's current block stance, read by every
 * projectile each frame. Player.tsx owns the writes; projectile components
 * own the reads. Kept off the React tree so the read path stays allocation-
 * free in the inner loop.
 */
class BlockGuardSingleton {
  isBlocking = false;
  position = new THREE.Vector3();
  facing = new THREE.Vector3(0, 0, -1);
  /** Sphere radius around the player that counts as a successful block. */
  radius = 1.5;
  /** Cosine threshold the projectile direction must beat against -facing. */
  facingDotThreshold = -0.2;

  setBlocking(b: boolean): void {
    this.isBlocking = b;
  }

  updatePose(pos: THREE.Vector3, facing: { x: number; y: number; z: number }): void {
    this.position.copy(pos);
    this.facing.set(facing.x, facing.y, facing.z);
  }

  /**
   * Returns true if a projectile at (px, py, pz) moving along (dirX, dirZ)
   * should be deflected this frame. Caller is responsible for flipping its
   * own velocity / team flag — see {@link tryReboundProjectile}.
   */
  shouldRebound(px: number, py: number, pz: number, dirX: number, dirZ: number): boolean {
    if (!this.isBlocking) return false;
    const dx = px - this.position.x;
    const dy = py - this.position.y;
    const dz = pz - this.position.z;
    if (dx * dx + dy * dy + dz * dz > this.radius * this.radius) return false;
    // Projectile direction should be roughly opposite to player facing — i.e.
    // the projectile is travelling INTO the player from the front.
    const facingDot = dirX * this.facing.x + dirZ * this.facing.z;
    return facingDot < this.facingDotThreshold;
  }
}

export const blockGuard = new BlockGuardSingleton();

/**
 * Generic rebound check shared by all "Hadouken-class" linear projectiles
 * (FireballProjectile, BulletProjectile, MagicMissileProjectile, the
 * SkillEffects HadoukenProjectile). On a successful block:
 *   - flip the projectile's direction
 *   - reset its trajectory origin to the current world position so it appears
 *     to bounce off the guard, not warp back to the caster
 *   - reset its lifetime timer so the rebound gets the full fly-back window
 *   - swap the allegiance to "player" so future damage hooks attribute the
 *     hit to the blocker
 *
 * Returns true on the frame the rebound fires so callers can play VFX / SFX.
 */
export function tryReboundProjectile(
  state: ReboundableProjectileState,
  px: number,
  py: number,
  pz: number,
): boolean {
  if (state.reboundedRef.current) return false;
  // Only enemy projectiles flip allegiance to "player". Neutral projectiles
  // bounce back without changing sides (so they keep hitting whatever they
  // would have hit), and "player" projectiles can't be self-blocked at all.
  if (state.teamRef.current === "player") return false;
  const d = state.dirRef.current;
  if (!blockGuard.shouldRebound(px, py, pz, d[0], d[2])) return false;

  state.dirRef.current = [-d[0], -d[1], -d[2]];
  state.startPosRef.current = [px, py, pz];
  state.timeRef.current = 0;
  if (state.teamRef.current === "enemy") {
    state.teamRef.current = "player";
  }
  state.reboundedRef.current = true;
  return true;
}

/**
 * Information returned to the projectile component when its rebound damage
 * lands on an enemy. Lets the caller deactivate / spawn a hit puff at the
 * impact site.
 */
export interface ReboundHitInfo {
  enemyId: string;
  position: [number, number, number];
  damage: number;
  killed: boolean;
}

const _hitScratch = new THREE.Vector3();

/**
 * After a Hadouken-class projectile has been rebounded back at the original
 * caster's team, the projectile component calls this every frame to test
 * whether it has reached an enemy. On hit:
 *   - apply `damage` via the global enemy manager
 *   - spawn a damage number above the enemy
 *   - return a {@link ReboundHitInfo} so the projectile component can
 *     deactivate itself and play an impact effect
 *
 * Returns null if the projectile is still in flight, hasn't been rebounded,
 * or there is no enemy in `hitRadius` of (px, py, pz).
 *
 * Note: hit detection is XZ-only with a generous vertical tolerance because
 * enemy origins sit at their feet (~y=0) but the projectile flies at chest
 * height (~y=1.2). Matching melee `tryDamageEnemies` semantics, we treat the
 * enemy as a vertical column.
 */
export function tryReboundProjectileHit(
  state: ReboundableProjectileState,
  px: number,
  _py: number,
  pz: number,
  damage: number,
  hitRadius: number = 1.2,
  /**
   * Optional id of the enemy that originally fired the projectile. If the
   * rebounded shot is still within ~150 ms of being deflected, we skip the
   * caster so the projectile visibly travels back across the field instead of
   * insta-popping the caster from inside their own hitbox. This matches the
   * grace window used by EnemyHadoukenProjectile.
   */
  casterId?: string,
): ReboundHitInfo | null {
  if (!state.reboundedRef.current) return null;
  if (state.teamRef.current !== "player") return null;

  const { enemies, damageEnemy } = useEnemyManager.getState();
  if (enemies.length === 0) return null;

  const sinceRebound = state.timeRef.current;
  const casterGrace = 0.15;

  let nearest: EnemyData | null = null;
  let nearestDistSq = hitRadius * hitRadius;
  for (const e of enemies) {
    if (e.isDying) continue;
    if (casterId && e.id === casterId && sinceRebound < casterGrace) continue;
    const dx = e.position.x - px;
    const dz = e.position.z - pz;
    const distSq = dx * dx + dz * dz;
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = e;
    }
  }
  if (!nearest) return null;

  const killed = damageEnemy(nearest.id, damage);
  _hitScratch.copy(nearest.position);
  useDamageNumbers
    .getState()
    .spawn(damage, [_hitScratch.x, _hitScratch.y + 1.5, _hitScratch.z], "crit");

  return {
    enemyId: nearest.id,
    position: [nearest.position.x, nearest.position.y + 1.0, nearest.position.z],
    damage,
    killed,
  };
}
