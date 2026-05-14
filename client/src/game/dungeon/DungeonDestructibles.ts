import * as THREE from "three";
import { create } from "zustand";
import type { MutableRefObject } from "react";

/**
 * One blockable + breakable dungeon prop registered with the destructibles
 * registry. Furniture pieces (`<RoomFurniturePhysics>`) and hanging
 * ceiling props (`<DungeonCeilingProps>`) both produce one of these so the
 * player's melee swing — which already iterates enemies inside its
 * range/arc — can damage them in the exact same way.
 *
 * `positionRef` is read each swing instead of cached so dynamic / kinematic
 * bodies are hit at their *current* position, not where they were spawned.
 */
export interface DungeonDestructibleEntry {
  id: string;
  /** AABB half-extents of the prop's collider in local space. */
  halfExtents: { x: number; y: number; z: number };
  /** Live world-space position of the prop center. Updated each frame. */
  positionRef: MutableRefObject<THREE.Vector3>;
  /**
   * Live Y-axis rotation (yaw, radians) of the prop's collider in world
   * space. Updated each frame for dynamic bodies; static for hanging
   * props. The F8 overlay reads this so wireframe boxes match the
   * actual rotated collider — without it, a rotated bookcase collider
   * would render as an axis-aligned box and look "wrong" in the debug.
   * Optional for backwards-compat; defaults to 0 when missing.
   */
  yawRef?: MutableRefObject<number>;
  hp: number;
  maxHp: number;
  /**
   * Called after damage is applied. `remaining` is the new hp; `dealt` is
   * the amount the registry actually subtracted (clamped to remaining hp).
   * Optional — props that only care about the death event can omit it.
   */
  onDamage?: (remaining: number, dealt: number) => void;
  /** Called once when hp drops to zero. The entry is auto-unregistered. */
  onDestroyed: () => void;
}

interface State {
  items: Map<string, DungeonDestructibleEntry>;
  register: (entry: DungeonDestructibleEntry) => void;
  unregister: (id: string) => void;
  damage: (id: string, amount: number) => boolean;
  reset: () => void;
}

/**
 * Global registry of destructible dungeon props. Lives outside React
 * render so the player attack hook (`Player.tsx`) can read it
 * imperatively each swing without re-subscribing.
 */
export const useDungeonDestructibles = create<State>((set, get) => ({
  items: new Map(),
  register: (entry) =>
    set((s) => {
      const next = new Map(s.items);
      next.set(entry.id, entry);
      return { items: next };
    }),
  unregister: (id) =>
    set((s) => {
      if (!s.items.has(id)) return s;
      const next = new Map(s.items);
      next.delete(id);
      return { items: next };
    }),
  damage: (id, amount) => {
    const e = get().items.get(id);
    if (!e || e.hp <= 0) return false;
    const dealt = Math.min(e.hp, amount);
    const remaining = e.hp - dealt;
    e.hp = remaining;
    e.onDamage?.(remaining, dealt);
    if (remaining <= 0) {
      e.onDestroyed();
      set((s) => {
        const next = new Map(s.items);
        next.delete(id);
        return { items: next };
      });
      return true;
    }
    return false;
  },
  reset: () => set({ items: new Map() }),
}));

/**
 * Apply melee damage to every destructible whose center sits inside the
 * forward swing arc + range of `origin`. Mirrors the enemy-arc filter
 * inside `Player.tryDamageEnemies` so a sword swing that would kill an
 * orc also smashes the bookshelf next to it.
 *
 * @param origin       Player position
 * @param forward      Player facing in the XZ plane (unit vector ish)
 * @param range        Effective melee range (already weapon-scaled)
 * @param halfArc      Half of the weapon's swing arc in radians
 * @param damageAmount Damage per hit
 * @param ignoreArc    AOE swings hit a full ring; pass `true` to skip arc test
 * @returns Number of destructibles damaged (not destroyed) this call.
 */
export function damageDestructiblesInArc(
  origin: THREE.Vector3,
  forward: { x: number; z: number },
  range: number,
  halfArc: number,
  damageAmount: number,
  ignoreArc: boolean,
): number {
  const store = useDungeonDestructibles.getState();
  if (store.items.size === 0) return 0;
  const cosArc = Math.cos(halfArc);
  const range2 = range * range;
  const victims: string[] = [];
  for (const e of store.items.values()) {
    const p = e.positionRef.current;
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    const dz = p.z - origin.z;
    // Allow extra horizontal reach toward the prop's surface — a melee
    // swing should hit a bookshelf when the player is "near" it, not
    // require the player to overlap its center. We add the prop's
    // longer horizontal half-extent to the effective range.
    const surfaceReach = range + Math.max(e.halfExtents.x, e.halfExtents.z);
    const horizDistSq = dx * dx + dz * dz;
    if (horizDistSq >= surfaceReach * surfaceReach) continue;
    // Vertical reach: include the collider's full height so a tall
    // bookshelf is hittable even when the player swings around chest-
    // height. Add a generous range buffer for short props (chests).
    if (Math.abs(dy) > range + e.halfExtents.y) continue;
    if (!ignoreArc) {
      const horiz = Math.sqrt(horizDistSq);
      if (horiz > 1e-4) {
        const cosAngle = (forward.x * dx + forward.z * dz) / horiz;
        if (cosAngle < cosArc) continue;
      }
    }
    victims.push(e.id);
  }
  if (victims.length === 0) return 0;
  const damageFn = store.damage;
  for (const id of victims) damageFn(id, damageAmount);
  return victims.length;
}
