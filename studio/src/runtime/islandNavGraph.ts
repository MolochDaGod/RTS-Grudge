/**
 * Lightweight nav waypoint graph for island creature pathfinding.
 * Waypoints are stamped as `nav_waypoint` entities during island seed.
 */
import type { PlacedEntity } from '../types';

export interface NavWaypoint {
  id: string;
  x: number;
  z: number;
  y: number;
  links: string[];
}

export function buildNavGraph(entities: PlacedEntity[]): NavWaypoint[] {
  const wps = entities
    .filter((e) => e.kind === 'nav_waypoint' || e.data.navWaypoint === true)
    .map((e) => ({
      id: e.id,
      x: e.position[0],
      z: e.position[2],
      y: e.position[1],
      links: (e.data.links as string[] | undefined) ?? [],
    }));
  return wps;
}

/** Pick a wander target via nearest waypoint + random linked neighbor. */
export function pickNavTarget(
  graph: NavWaypoint[],
  homeX: number,
  homeZ: number,
  rng: () => number,
): { x: number; z: number; y: number } | null {
  if (!graph.length) return null;
  let best = graph[0]!;
  let bestD = Infinity;
  for (const w of graph) {
    const d = Math.hypot(w.x - homeX, w.z - homeZ);
    if (d < bestD) { bestD = d; best = w; }
  }
  if (best.links.length > 0) {
    const linkId = best.links[Math.floor(rng() * best.links.length)]!;
    const linked = graph.find((w) => w.id === linkId);
    if (linked) return { x: linked.x, z: linked.z, y: linked.y };
  }
  const jitter = 3 + rng() * 5;
  const a = rng() * Math.PI * 2;
  return { x: best.x + Math.cos(a) * jitter, z: best.z + Math.sin(a) * jitter, y: best.y };
}