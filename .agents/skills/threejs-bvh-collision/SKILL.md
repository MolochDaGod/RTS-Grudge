---
name: threejs-bvh-collision
description: Three.js BVH (three-mesh-bvh) and navmesh (three-pathfinding) patterns for accelerated raycasting, capsule/sphere collision, character controllers, click-to-harvest, terrain queries, AI navmesh pathfinding, and spatial queries. Use when working on Grudge Survival's collider, terrain, harvestables, ground sampler, NPC/enemy AI movement, projectile collision, click-pick interactions, GroundLODController, ColliderBake, StreamedGroundColliders, Tutorial Island ground/raycast probes, or any "make raycasting faster" or "AI can't path around the island" task. Triggers: BVH, bounds tree, mesh-bvh, shapecast, capsulecast, navmesh, pathfinding, raycaster.firstHitOnly, StaticGeometryGenerator, click-harvest, terrain raycast, AI pathfinding, NPC movement, projectile collision.
---

# Three.js BVH Collision & Navmesh Pathfinding (Grudge Survival)

Patterns from [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) and [donmccurdy/three-pathfinding](https://github.com/donmccurdy/three-pathfinding) — **already installed** in this project (`three-mesh-bvh ^0.8.3`, `three-pathfinding ^1.3.0`).

## When to use this skill

USE FOR:
- Accelerated raycasting against high-poly meshes (terrain, GLB worlds, harvestable forests)
- Click-to-harvest / click-to-target picking
- Sphere physics for projectiles (arrows, bullets, spells, thrown items)
- Capsule queries against static geometry that **don't need full Rapier physics**
- AI navmesh pathfinding for NPCs / enemies / GOULDs across complex islands
- "Closest point on terrain" lookups for ground samplers, foot snap, IK targets
- Spatial queries: "what's inside this box / sphere / segment"

DON'T use for:
- Player movement physics — **Grudge uses Rapier** (`@react-three/rapier`) for that. BVH coexists for raycasting/queries; do NOT replace Rapier with the BVH capsule controller in this codebase.
- Triangle-mesh colliders backing Rapier RigidBodies — that's a `TrimeshCollider`, not a BVH.

## How BVH and Rapier coexist in Grudge

| Concern                              | Owner                                                |
|--------------------------------------|------------------------------------------------------|
| Player capsule + ground reaction     | Rapier `BallCollider` + `RigidBody`                  |
| Static terrain physics               | Rapier `HeightfieldCollider` / `TrimeshCollider`     |
| Click-pick / hover / harvest raycast | three-mesh-bvh on the visible mesh                   |
| Foot-snap / slope-polish raycast     | three-mesh-bvh on visible terrain meshes             |
| Projectile collision visualization   | three-mesh-bvh sphere shapecast (cheap), Rapier for the actual hit body |
| AI pathfinding across an island      | three-pathfinding on a baked navmesh GLB             |

The BVH layer is **read-only spatial acceleration** for the visible mesh tree; Rapier owns dynamics.

## Core setup — accelerate every raycast in the project

Done once at app init (e.g. in a top-level `main.tsx` or per-Canvas `onCreated`). Already-installed package:

```ts
import * as THREE from "three";
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from "three-mesh-bvh";

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
```

Then for any mesh that participates in raycasting:

```ts
mesh.geometry.computeBoundsTree();
// optional but big win when you only need the closest hit:
const raycaster = new THREE.Raycaster();
raycaster.firstHitOnly = true;
raycaster.intersectObjects([mesh]);
```

**Always pair `firstHitOnly = true` with click-pick raycasts** — turns a ~60 ms cast against the tutorial island GLB into ~0.3 ms.

## BVH construction options

```ts
import { MeshBVH, SAH, CENTER, AVERAGE } from "three-mesh-bvh";

const bvh = new MeshBVH(geometry, {
  strategy: SAH,           // SAH = best quality (slowest build), CENTER = fastest build, AVERAGE = middle
  maxDepth: 40,
  maxLeafSize: 10,
  setBoundingBox: true,    // auto-set geometry.boundingBox
  indirect: false,         // true = don't reorder index buffer (use when geo is shared)
});
geometry.boundsTree = bvh;
```

Pick **SAH** for permanent colliders (terrain, world GLB) — built once, queried millions of times. Pick **CENTER** for transient meshes that are rebuilt every frame (deforming cloth, runtime mesh slicing).

## Merge environment into a single collider

For the tutorial island, fort, shipwreck, and rocks, merge into one BVH instead of one per mesh — two orders of magnitude faster.

```ts
import { StaticGeometryGenerator, MeshBVH } from "three-mesh-bvh";

const staticGen = new StaticGeometryGenerator(environmentGroup);
staticGen.attributes = ["position"]; // collision only needs position

const mergedGeo = staticGen.generate();
mergedGeo.boundsTree = new MeshBVH(mergedGeo);

const collider = new THREE.Mesh(mergedGeo);
collider.material = new THREE.MeshBasicMaterial({
  wireframe: true, transparent: true, opacity: 0.3, depthWrite: false,
});
collider.visible = false; // collider is query-only
scene.add(collider);
```

This is the right pattern for `client/src/game/islands/colliderBake.ts` — but only as a **raycast accelerator** alongside the existing trimesh colliders fed to Rapier, not as a replacement.

## Capsule shapecast (BVH-only, NOT player movement here)

Use this for **non-Rapier** capsule queries — e.g. "is there a wall in front of the AI before it tries to swing?" or "does this projectile capsule clip the world?" In Grudge, do **not** wire this to player movement; that's Rapier's job.

```ts
const capsuleInfo = {
  radius: 0.5,
  segment: new THREE.Line3(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)),
};

const tempBox = new THREE.Box3();
const tempMat = new THREE.Matrix4();
const tempSegment = new THREE.Line3();
const tempV1 = new THREE.Vector3();
const tempV2 = new THREE.Vector3();

function castCapsuleAgainstBVH(worldStart: THREE.Vector3, worldEnd: THREE.Vector3) {
  tempBox.makeEmpty();
  tempMat.copy(collider.matrixWorld).invert();
  tempSegment.start.copy(worldStart).applyMatrix4(tempMat);
  tempSegment.end.copy(worldEnd).applyMatrix4(tempMat);
  tempBox.expandByPoint(tempSegment.start);
  tempBox.expandByPoint(tempSegment.end);
  tempBox.min.addScalar(-capsuleInfo.radius);
  tempBox.max.addScalar(capsuleInfo.radius);

  let collided = false;
  collider.geometry.boundsTree.shapecast({
    intersectsBounds: (box) => box.intersectsBox(tempBox),
    intersectsTriangle: (tri) => {
      const distance = tri.closestPointToSegment(tempSegment, tempV1, tempV2);
      if (distance < capsuleInfo.radius) {
        const depth = capsuleInfo.radius - distance;
        const dir = tempV2.sub(tempV1).normalize();
        tempSegment.start.addScaledVector(dir, depth);
        tempSegment.end.addScaledVector(dir, depth);
        collided = true;
      }
    },
  });
  return collided;
}
```

## Sphere physics (projectiles, particles, dropped loot)

Use for arrows, magic projectiles, thrown weapons, and bouncy loot drops.

```ts
function updateSphereCollision(sphere, bvh, deltaTime) {
  const tempSphere = new THREE.Sphere();
  const deltaVec = new THREE.Vector3();

  sphere.velocity.y += GRAVITY * deltaTime;
  sphere.collider.center.addScaledVector(sphere.velocity, deltaTime);

  tempSphere.copy(sphere.collider);
  let collided = false;

  bvh.shapecast({
    intersectsBounds: (box) => box.intersectsSphere(tempSphere),
    intersectsTriangle: (tri) => {
      tri.closestPointToPoint(tempSphere.center, deltaVec);
      deltaVec.sub(tempSphere.center);
      const distance = deltaVec.length();
      if (distance < tempSphere.radius) {
        const depth = distance - tempSphere.radius;
        deltaVec.multiplyScalar(1 / distance);
        tempSphere.center.addScaledVector(deltaVec, depth);
        collided = true;
      }
    },
    boundsTraverseOrder: (box) =>
      box.distanceToPoint(tempSphere.center) - tempSphere.radius,
  });

  if (collided) {
    deltaVec.subVectors(tempSphere.center, sphere.collider.center).normalize();
    sphere.velocity.reflect(deltaVec);
    sphere.velocity.multiplyScalar(0.8); // bounce damping
    sphere.collider.center.copy(tempSphere.center);
  }
}
```

## Shapecast API reference

```ts
bvh.shapecast({
  // Per BVH node — returns NOT_INTERSECTED, INTERSECTED, or CONTAINED
  intersectsBounds: (box, isLeaf, score, depth, nodeIndex) =>
    box.intersectsBox(queryBox) ? INTERSECTED : NOT_INTERSECTED,

  // Per triangle in intersecting leaf nodes. Return true to stop early.
  intersectsTriangle: (tri, triIndex, contained, depth) => {
    // tri is ExtendedTriangle:
    //   tri.closestPointToPoint(point, target)
    //   tri.closestPointToSegment(segment, triTarget, segTarget)
    //   tri.intersectsBox(box)
    return false;
  },

  // Optional: child visit order (lower score = first)
  boundsTraverseOrder: (box) => box.distanceToPoint(queryPoint),
});
```

## three-pathfinding — navmesh AI navigation

### 1. Bake a navmesh in Blender

1. Model the walkable surface as a flat / low-poly mesh covering only walkable areas (no walls, no water, no roof slopes > climb angle).
2. Decimate to <2000 polys per island. The library is geometry-quality-bound, not poly-count-bound.
3. Export → glTF 2.0 (`.glb`).
4. Place under `client/public/models/navmesh/` (e.g. `tutorial_island_nav.glb`, `wilderness_nav.glb`).

### 2. Setup at scene init

```ts
import { Pathfinding, PathfindingHelper } from "three-pathfinding";
import { useAsset } from "@/lib/useAsset"; // Grudge's GLTFLoader wrapper

const pathfinding = new Pathfinding();
const ZONE = "tutorial_island";

const navGltf = await useAsset("/models/navmesh/tutorial_island_nav.glb");
let navmesh: THREE.Mesh | null = null;
navGltf.scene.traverse((node) => { if ((node as THREE.Mesh).isMesh) navmesh = node as THREE.Mesh; });
if (navmesh) {
  pathfinding.setZoneData(ZONE, Pathfinding.createZone(navmesh.geometry));
}
```

In Grudge, do this once per island scene mount, store `pathfinding` + `ZONE` in a Zustand store (e.g. extend `useTutorialWorld`) so all NPCs share the same baked zone.

### 3. Find a path

```ts
function findPath(startPos: THREE.Vector3, targetPos: THREE.Vector3) {
  const groupID = pathfinding.getGroup(ZONE, startPos);
  return pathfinding.findPath(startPos, targetPos, ZONE, groupID); // Vector3[] | null
}
```

### 4. Walk an NPC along the path

```ts
useFrame((_, delta) => {
  if (!path || path.length === 0) return;
  const next = path[0];
  const dir = next.clone().sub(npc.position).setY(0);
  const dist = dir.length();
  if (dist < 0.5) {
    path.shift();
    return;
  }
  dir.normalize().multiplyScalar(speed * delta);
  npc.position.add(dir);
});
```

For Grudge enemies / NPCs, **don't** lerp toward the next node — drive a desired-velocity vector and feed it into the existing Rapier-based movement (`useCharacterController` or `Enemy.tsx`'s movement applier). Mixing direct `position.add` with Rapier RigidBody movement causes drift.

### 5. Clamp movement to navmesh (FPS-style)

When you need "the player can never leave the walkable area" semantics for an NPC:

```ts
function clampedMove(startPos, endPos, currentNode) {
  const groupID = pathfinding.getGroup(ZONE, startPos);
  const out = new THREE.Vector3();
  const newNode = pathfinding.clampStep(
    startPos, endPos, currentNode, ZONE, groupID, out,
  );
  return { position: out, node: newNode };
}
```

### 6. Random patrol point

```ts
const groupID = pathfinding.getGroup(ZONE, npcCenter);
const node = pathfinding.getRandomNode(ZONE, groupID, npcCenter, /* radius */ 30);
const patrolTarget = node.centroid.clone();
```

### 7. Debug visualization

```ts
const helper = new PathfindingHelper();
scene.add(helper);
helper.setPath(path);
helper.setPlayerPosition(start);
helper.setTargetPosition(end);
helper.reset();
```

Gate this behind the `debugColliders` cheat flag in `client/src/lib/stores/useCheats.tsx` so it doesn't ship to players.

## Grudge-specific integration points

### Tutorial Island ground sampler (already in place, BVH would speed up)

`client/src/game/islands/TutorialIslandScene.tsx` lines ~1985-2028 raycast straight down through `meshes[]` per frame for slope-polish. Right now those raycasts fall back to Three's default per-mesh BVH **if** the global prototype patch is in effect. If that patch isn't installed at app boot, add it — every per-frame downward cast becomes O(log n).

### Click-to-harvest (Tutorial Island Harvestables)

`client/src/game/islands/TutorialIslandHarvestables.tsx` and the `LootDropsRenderer` raycast against many separate meshes per click. Pattern:

```ts
// once after the harvestable mesh is ready:
mesh.geometry.computeBoundsTree();
// per-click:
raycaster.firstHitOnly = true;
const hits = raycaster.intersectObjects(allHarvestables, /* recursive */ true);
```

### Projectile collision

`client/src/game/effects/Bullet.tsx` (and arrows, spells) currently use radius-based hit checks against enemy positions. For environmental collision (arrow sticks into a wall, spell explodes against terrain), use the **sphere shapecast** snippet above against the merged environment BVH.

### Enemy AI navmesh

`client/src/game/components/Enemy.tsx` uses behaviour trees + direct steering. Grudge already has `three-pathfinding` for dungeon enemies (per replit.md). Extend to outdoor islands by baking per-island navmeshes (one GLB per island) and storing them in `client/public/models/navmesh/`. Wire the lookup through `useIslandWorld` so NPC spawners can request paths against the current zone.

### Tutorial Island colliderBake.ts

`colliderBake.worker.ts` already merges trimesh colliders for Rapier in a worker. Add a sibling `bvhBake.worker.ts` that runs `MeshBVH.serialize(...)` in the same worker, then `MeshBVH.deserialize(buffer, geo)` on the main thread — keeps the main thread free during heavy island load.

## Performance tips (essential)

- **Always merge static geometry** into one collider with `StaticGeometryGenerator` — separate per-mesh BVHs add ~0.5ms overhead each per query.
- **Always set `raycaster.firstHitOnly = true`** for click-pick / hover / line-of-sight checks.
- **Use `SAH` strategy** for permanent colliders (terrain, world GLB).
- **Use `indirect: true`** if a geometry's index buffer is shared between multiple meshes (instanced harvestables, scattered props).
- **Sub-step physics** when you DO drive movement directly (5–10 substeps per frame). For Grudge this only matters for projectiles, since Rapier owns player physics with its own fixed timestep.
- **Refit, don't rebuild**, when geometry deforms slightly: `bvh.refit()` is ~10× cheaper than `new MeshBVH(geo)`. Use for cloth, breakable terrain chunks, animated colliders.
- **Serialize/deserialize for workers**: `const data = MeshBVH.serialize(bvh); /* postMessage(data) */ const restored = MeshBVH.deserialize(data, geo);`
- **Bake navmeshes offline** (Blender / RecastNavigation), never at runtime. Don't try to compute walkable surfaces from the rendered terrain in-browser — it's slow and gives bad results.

## What NOT to do in Grudge

- Don't replace Rapier's player capsule with the BVH capsule controller — Rapier owns player physics (see `replit.md` Tech Stack: "Player BallCollider, fixed timestep `1/60`, `interpolate={true}`").
- Don't add separate per-mesh BVHs to every harvestable rock individually — bake them into the merged collider in `colliderBake.ts` instead.
- Don't run `MeshBVH.serialize` on the main thread for big islands (the tutorial GLB is 84 MB) — push it into a worker.
- Don't ship the PathfindingHelper without a debug-flag gate; it's expensive and ugly in production.
- Don't compute the navmesh from the terrain heightmap at runtime — bake one in Blender per island and load it as a GLB asset.

## Quick decision matrix

| Need                                       | Tool                                     |
|--------------------------------------------|------------------------------------------|
| Player walks on terrain                    | **Rapier** (already wired)               |
| Click on a tree / rock to harvest          | **three-mesh-bvh** + `firstHitOnly`      |
| Arrow flies and sticks in wall             | **three-mesh-bvh** sphere shapecast      |
| Foot snap / IK target on terrain           | **three-mesh-bvh** raycast               |
| NPC navigates around obstacles             | **three-pathfinding** on baked navmesh   |
| "Is target visible from here?" (line of sight) | **three-mesh-bvh** raycast (firstHitOnly) |
| Spawn enemy at a random walkable point     | **three-pathfinding** `getRandomNode`    |
| Rapier-driven dynamic body collision       | **Rapier** colliders (no BVH needed)     |
