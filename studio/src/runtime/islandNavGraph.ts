/**
 * Lightweight nav waypoint graph for island creature pathfinding.
 * Waypoints are stamped as `nav_waypoint` entities during island seed.
 *
 * Layers (from IslandGenerator):
 *   land   — above SEA_LEVEL, for land animals
 *   small  — underwater shelf band (small fish)
 *   big    — outer ocean band (big fish)
 */
import type { PlacedEntity } from '../types';
import { SEA_LEVEL } from '../editor/IslandGenerator';

export type NavLayer = 'land' | 'small' | 'big' | 'any';

export interface NavWaypoint {
  id: string;
  x: number;
  z: number;
  y: number;
  links: string[];
  layer: NavLayer;
  underwater: boolean;
}

export function buildNavGraph(entities: PlacedEntity[]): NavWaypoint[] {
  return entities
    .filter((e) => e.kind === 'nav_waypoint' || e.data.navWaypoint === true)
    .map((e) => {
      const layerRaw = (e.data.layer as string | undefined) ?? 'land';
      const layer: NavLayer =
        layerRaw === 'small' || layerRaw === 'big' || layerRaw === 'land'
          ? layerRaw
          : e.position[1] < SEA_LEVEL
            ? 'small'
            : 'land';
      return {
        id: e.id,
        x: e.position[0],
        z: e.position[2],
        y: e.position[1],
        links: (e.data.links as string[] | undefined) ?? [],
        layer,
        underwater: e.data.underwater === true || layer !== 'land',
      };
    });
}

function layerOk(w: NavWaypoint, prefer: NavLayer | undefined): boolean {
  if (!prefer || prefer === 'any') return true;
  if (prefer === 'land') return !w.underwater && w.layer === 'land';
  // aquatic layers can use either water band
  return w.underwater || w.layer === 'small' || w.layer === 'big';
}

/**
 * Pick a wander target via nearest waypoint + random linked neighbor.
 * @param preferLayer - 'land' keeps land animals on dry waypoints;
 *   'small' | 'big' prefer underwater nodes for fish pathfinding.
 */
export function pickNavTarget(
  graph: NavWaypoint[],
  homeX: number,
  homeZ: number,
  rng: () => number,
  preferLayer: NavLayer = 'land',
): { x: number; z: number; y: number } | null {
  if (!graph.length) return null;
  const pool = graph.filter((w) => layerOk(w, preferLayer));
  const use = pool.length ? pool : graph;

  let best = use[0]!;
  let bestD = Infinity;
  for (const w of use) {
    const d = Math.hypot(w.x - homeX, w.z - homeZ);
    if (d < bestD) { bestD = d; best = w; }
  }

  // Prefer linked neighbor on the same layer
  if (best.links.length > 0) {
    const candidates = best.links
      .map((id) => graph.find((w) => w.id === id))
      .filter((w): w is NavWaypoint => !!w && layerOk(w, preferLayer));
    if (candidates.length > 0) {
      const linked = candidates[Math.floor(rng() * candidates.length)]!;
      return { x: linked.x, z: linked.z, y: linked.y };
    }
    // Fall back to any linked node
    const linkId = best.links[Math.floor(rng() * best.links.length)]!;
    const linked = graph.find((w) => w.id === linkId);
    if (linked) return { x: linked.x, z: linked.z, y: linked.y };
  }

  const jitter = 3 + rng() * 5;
  const a = rng() * Math.PI * 2;
  return {
    x: best.x + Math.cos(a) * jitter,
    z: best.z + Math.sin(a) * jitter,
    y: best.y,
  };
}
