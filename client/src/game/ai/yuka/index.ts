// Thin wrapper around the YUKA AI library (https://mugen87.github.io/yuka).
//
// Pattern:
//   1. Mount <useYukaTick /> ONCE inside the R3F canvas (e.g. GameScene)
//      so the shared EntityManager advances each frame.
//   2. Create YUKA Vehicles / GameEntities and `manager.add(entity)` them.
//   3. Each frame after `manager.update`, call `syncEntityToObject3D` to
//      copy the entity's pose onto the visual three.js Object3D.
//   4. For navmesh-based pathing, `loadNavMesh('/navmeshes/foo.gltf')` and
//      attach a FollowPathBehavior (or one of YUKA's other steering
//      behaviors) to the vehicle.
//
// See: https://mugen87.github.io/yuka/docs/

export * as YUKA from "yuka";
export { getYukaWorld, tickYuka, resetYukaWorld } from "./YukaWorld";
export { loadNavMesh, clearNavMeshCache } from "./loadNavMesh";
export { syncEntityToObject3D } from "./syncEntity";
export { useYukaTick } from "./useYukaTick";
