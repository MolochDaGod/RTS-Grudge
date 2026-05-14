/**
 * Registry of pre-baked dungeon prefabs (GLB scenes) used as the static
 * layout for a dungeon run. Each entry points at a single GLB on disk
 * plus the metadata `BakedDungeonScene` needs to spawn the player and
 * procedural enemies inside it.
 *
 * The user opted for "use the GLB as the static base layout, then spawn
 * 7-12 enemies + 1 boss procedurally on top" — so geometry comes from
 * the prefab and combat content comes from the dungeon level / theme
 * tables in `DungeonGenerator.ts`.
 *
 * Three prefabs ship today; one is picked deterministically per dungeon
 * entry by `pickPrefabForSeed(dungeonSeed)` so revisiting a level via
 * the same seed yields the same prefab + spawn arrangement.
 */
import { useAssets } from "../hooks/useAsset";

export interface BakedDungeonPrefab {
  /** Stable id used in logs and as a deterministic-seed salt. */
  id: string;
  /** Human-readable label (currently log-only, but cheap to keep). */
  name: string;
  /** Public URL of the GLB inside `client/public/`. */
  modelPath: string;
  /** Uniform scale applied to the cloned scene before bbox compute. */
  scale: number;
  /**
   * Inset (meters) from each side of the prefab's world bbox when
   * sampling random spawn positions for enemies. Keeps spawns away
   * from outer walls / out-of-bounds corners.
   */
  spawnInset: number;
  /**
   * Minimum distance (meters) any enemy must spawn from the player's
   * spawn point. Prevents instant attacks on dungeon entry.
   */
  enemyMinDistFromPlayer: number;
  /**
   * Minimum distance (meters) the boss must spawn from the player's
   * spawn point — typically the diagonal of the dungeon so the player
   * has to fight through the room.
   */
  bossMinDistFromPlayer: number;
  /** Inclusive lower bound on the procedural enemy count. */
  enemyMin: number;
  /** Inclusive upper bound on the procedural enemy count. */
  enemyMax: number;
}

/**
 * The three prefabs available today. Two chicken_gun-style baked
 * dungeons (5.5MB each, similar footprints) and the larger low-poly
 * dungeon sample (38MB, sprawling). All three render with the same
 * shell — only geometry, scale, and spawn footprint differ.
 */
export const BAKED_DUNGEON_PREFABS: BakedDungeonPrefab[] = [
  {
    id: "chicken_gun_a",
    name: "Cavern A",
    modelPath: "/models/dungeons/baked/dungeon_a.glb",
    scale: 1,
    spawnInset: 4,
    enemyMinDistFromPlayer: 8,
    bossMinDistFromPlayer: 16,
    enemyMin: 7,
    enemyMax: 12,
  },
  {
    id: "chicken_gun_b",
    name: "Cavern B",
    modelPath: "/models/dungeons/baked/dungeon_b.glb",
    scale: 1,
    spawnInset: 4,
    enemyMinDistFromPlayer: 8,
    bossMinDistFromPlayer: 16,
    enemyMin: 7,
    enemyMax: 12,
  },
  {
    id: "low_poly_sample",
    name: "Modular Sample",
    modelPath: "/models/dungeon_modular/low poly dungeon sample.glb",
    scale: 1,
    spawnInset: 6,
    enemyMinDistFromPlayer: 10,
    bossMinDistFromPlayer: 22,
    enemyMin: 7,
    enemyMax: 12,
  },
];

/**
 * Deterministically pick a prefab from {@link BAKED_DUNGEON_PREFABS}
 * for a given dungeon seed. Same seed → same prefab on every visit.
 */
export function pickPrefabForSeed(dungeonSeed: number): BakedDungeonPrefab {
  const seed = Math.abs(Math.floor(dungeonSeed)) | 0;
  const idx = seed % BAKED_DUNGEON_PREFABS.length;
  return BAKED_DUNGEON_PREFABS[idx];
}

/**
 * Convenience hook: warm-load every baked prefab through the shared
 * `useAssets` Suspense cache so subsequent dungeon entries don't pay
 * the GLB download/parse cost. Mount this anywhere inside a Suspense
 * boundary (e.g. an idle background loader) to preheat.
 */
export function useBakedDungeonPrefabsPreload(): void {
  useAssets(BAKED_DUNGEON_PREFABS.map((p) => p.modelPath));
}

/**
 * Tiny linear-congruential PRNG used by the baked dungeon spawner so
 * spawn positions, enemy types, and boss type are reproducible for a
 * given dungeon seed. Mirrors the inline RNG in `DungeonGenerator.ts`
 * but is exported so other modules can share the same algorithm.
 */
export class SeededRandom {
  private state: number;
  constructor(seed: number) {
    // Avoid 0 — LCG with seed=0 gets stuck.
    this.state = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  }
  /** Uniform random in [0, 1). */
  next(): number {
    this.state = (this.state * 16807) % 2147483647;
    return this.state / 2147483647;
  }
  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  /** Pick a random element from a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}
