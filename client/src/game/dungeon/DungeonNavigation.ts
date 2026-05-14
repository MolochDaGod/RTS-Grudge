import * as THREE from "three";
import { Pathfinding } from "three-pathfinding";
import type { DungeonLayout } from "./DungeonGenerator";

export function buildDungeonNavMesh(layout: DungeonLayout): Pathfinding {
  const pathfinding = new Pathfinding();

  const vertices: number[] = [];
  const indices: number[] = [];

  for (const tile of layout.floorTiles) {
    const hw = tile.width / 2;
    const hd = tile.depth / 2;
    const baseIndex = vertices.length / 3;

    vertices.push(
      tile.x - hw, 0, tile.z - hd,
      tile.x + hw, 0, tile.z - hd,
      tile.x + hw, 0, tile.z + hd,
      tile.x - hw, 0, tile.z + hd
    );

    indices.push(
      baseIndex, baseIndex + 1, baseIndex + 2,
      baseIndex, baseIndex + 2, baseIndex + 3
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);

  const zone = Pathfinding.createZone(geometry);
  pathfinding.setZoneData("dungeon", zone);

  return pathfinding;
}

export function findDungeonPath(
  pathfinding: Pathfinding,
  start: THREE.Vector3,
  end: THREE.Vector3
): THREE.Vector3[] | null {
  const groupID = pathfinding.getGroup("dungeon", start);
  if (groupID === null || groupID === undefined) return null;

  const closestStart = pathfinding.getClosestNode(start, "dungeon", groupID);
  if (!closestStart) return null;

  const clampedStart = new THREE.Vector3(
    closestStart.centroid?.x ?? start.x,
    0,
    closestStart.centroid?.z ?? start.z
  );

  const closestEnd = pathfinding.getClosestNode(end, "dungeon", groupID);
  const clampedEnd = closestEnd
    ? new THREE.Vector3(closestEnd.centroid?.x ?? end.x, 0, closestEnd.centroid?.z ?? end.z)
    : end.clone();

  const path = pathfinding.findPath(clampedStart, clampedEnd, "dungeon", groupID);
  if (!path || path.length === 0) return null;

  return path;
}
