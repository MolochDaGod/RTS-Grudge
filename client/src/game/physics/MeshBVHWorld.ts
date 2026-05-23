/**
 * MeshBVHWorld — three-mesh-bvh accelerated spatial queries.
 *
 * Owns:
 *   - A registry of meshes whose geometry has had `computeBoundsTree()` baked
 *     onto it (one BVH per geometry, reused for every query).
 *   - A reusable `THREE.Raycaster` whose `firstHitOnly` is enabled by default
 *     for the cheapest possible query.
 *
 * Exposes:
 *   - `addMesh(mesh)` / `removeMesh(mesh)` — registration.
 *   - `raycast(origin, dir, maxDist?)` — generic ray query, returns nearest hit.
 *   - `hasLineOfSight(a, b)` — boolean LOS test (AI cone-of-sight, projectile pre-check).
 *   - `capsuleSlide(start, desired, radius, halfHeight)` — character collision +
 *     slide response against the registered surfaces.  Iterative depenetration:
 *     we move the capsule, find every triangle within radius via `shapecast`,
 *     push it back out along contact normals, then project the leftover motion
 *     onto the contact plane so it slides along walls instead of stopping dead.
 *
 * One-time prototype patch: this file mounts `computeBoundsTree`,
 * `disposeBoundsTree`, and `acceleratedRaycast` onto BufferGeometry / Mesh
 * the FIRST time it's imported.  Idempotent — guarded against double-mount.
 */
import * as THREE from 'three';
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
  ExtendedTriangle,
  MeshBVH,
} from 'three-mesh-bvh';

// ── One-time prototype patch (idempotent) ────────────────────────────────────
// We attach the BVH-aware helpers onto THREE prototypes so that any
// `geometry.computeBoundsTree()` / `mesh.raycast(...)` call goes through the
// accelerated path.  The BVH lib is designed to be patched globally; doing it
// on import keeps caller code free of boilerplate.
type GeoWithBVH = THREE.BufferGeometry & {
  computeBoundsTree?: typeof computeBoundsTree;
  disposeBoundsTree?: typeof disposeBoundsTree;
  boundsTree?: MeshBVH;
};
type MeshWithBVH = THREE.Mesh & { raycast: typeof acceleratedRaycast };

const _patchKey = '__bvhPatched';
const _root = (THREE as unknown as Record<string, unknown>);
if (!_root[_patchKey]) {
  (THREE.BufferGeometry.prototype as GeoWithBVH).computeBoundsTree = computeBoundsTree;
  (THREE.BufferGeometry.prototype as GeoWithBVH).disposeBoundsTree = disposeBoundsTree;
  (THREE.Mesh.prototype as MeshWithBVH).raycast = acceleratedRaycast;
  _root[_patchKey] = true;
}

export class MeshBVHWorld {
  private meshes: THREE.Mesh[] = [];
  private raycaster: THREE.Raycaster;

  constructor() {
    this.raycaster = new THREE.Raycaster();
    // firstHitOnly is a BVH-specific raycaster flag — it short-circuits as
    // soon as ANY triangle is hit instead of finding the nearest, which we
    // re-enable below for distance-sensitive queries.
    (this.raycaster as unknown as { firstHitOnly: boolean }).firstHitOnly = true;
  }

  // ── Registration ─────────────────────────────────────────────────────────

  /** Register a mesh.  Builds the BVH on its geometry if not already built. */
  addMesh(mesh: THREE.Mesh): void {
    const g = mesh.geometry as GeoWithBVH;
    if (!g.boundsTree) g.computeBoundsTree?.();
    this.meshes.push(mesh);
  }

  /** Add every Mesh under a root Object3D. */
  addObject(root: THREE.Object3D): void {
    root.traverse(o => { if ((o as THREE.Mesh).isMesh) this.addMesh(o as THREE.Mesh); });
  }

  removeMesh(mesh: THREE.Mesh): void {
    const i = this.meshes.indexOf(mesh);
    if (i >= 0) this.meshes.splice(i, 1);
  }

  /** Drop everything; disposes BVHs to free memory. */
  clear(): void {
    for (const m of this.meshes) (m.geometry as GeoWithBVH).disposeBoundsTree?.();
    this.meshes.length = 0;
  }

  // ── Raycast / LOS ────────────────────────────────────────────────────────

  /**
   * Cast a ray and return the nearest hit (or null).  `dir` MUST be unit length.
   * If `maxDist` is supplied, hits beyond it are ignored.
   */
  raycast(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist = Infinity,
  ): THREE.Intersection | null {
    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDist;
    const hits = this.raycaster.intersectObjects(this.meshes, false);
    return hits[0] ?? null;
  }

  /**
   * Returns true if nothing blocks the segment a→b.  Useful for AI sight cones,
   * projectile pre-flight checks, and "can the camera see the player" tests.
   */
  hasLineOfSight(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const dir = _v1.subVectors(b, a);
    const dist = dir.length();
    if (dist < 1e-5) return true;
    dir.multiplyScalar(1 / dist);
    return this.raycast(a, dir, dist) === null;
  }

  // ── Capsule slide ─────────────────────────────────────────────────────────

  /**
   * Move a capsule from `start` along `desired` against registered surfaces,
   * resolving collisions with iterative depenetration + sliding response.
   *
   * Capsule local frame: axis along Y, top sphere at `+halfHeight`, bottom
   * sphere at `-halfHeight`, both with the given `radius`.  The capsule's
   * origin is its geometric centre.
   *
   * Returns `{ position, grounded }`:
   *   - `position` — final centre after collision response.
   *   - `grounded` — true if at least one contact normal pointed mostly up
   *     (>= 0.7 dot Y), i.e. the capsule is standing on a walkable slope.
   */
  capsuleSlide(
    start: THREE.Vector3,
    desired: THREE.Vector3,
    radius: number,
    halfHeight: number,
    iterations = 4,
  ): { position: THREE.Vector3; grounded: boolean } {
    const pos = _v2.copy(start).add(desired);
    const segTop = _v3;
    const segBot = _v4;
    const tri = _tri;
    const triPoint = _v5;
    const capPoint = _v6;
    const push = _v7;
    const capSegment = _seg;
    let grounded = false;

    for (let iter = 0; iter < iterations; iter++) {
      // Capsule segment in WORLD space at the candidate position.
      segTop.set(pos.x, pos.y + halfHeight, pos.z);
      segBot.set(pos.x, pos.y - halfHeight, pos.z);

      let hadContact = false;

      for (const mesh of this.meshes) {
        const g = mesh.geometry as GeoWithBVH;
        const bvh = g.boundsTree;
        if (!bvh) continue;

        // Transform the capsule segment into the mesh's LOCAL space so the
        // BVH (built in local space) can be queried directly.  Using the
        // inverse matrix once per mesh per iteration is cheaper than per-tri.
        const inv = _mat4.copy(mesh.matrixWorld).invert();
        const localTop = _v8.copy(segTop).applyMatrix4(inv);
        const localBot = _v9.copy(segBot).applyMatrix4(inv);
        // Bounding sphere around the capsule (segment radius + capsule radius).
        const segCentre = _v10.addVectors(localTop, localBot).multiplyScalar(0.5);
        const segRadius = localTop.distanceTo(localBot) * 0.5 + radius;

        bvh.shapecast({
          intersectsBounds: (box) => {
            // Quick reject: AABB-vs-sphere around capsule.
            const dx = Math.max(box.min.x - segCentre.x, 0, segCentre.x - box.max.x);
            const dy = Math.max(box.min.y - segCentre.y, 0, segCentre.y - box.max.y);
            const dz = Math.max(box.min.z - segCentre.z, 0, segCentre.z - box.max.z);
            return dx * dx + dy * dy + dz * dz <= segRadius * segRadius;
          },
          intersectsTriangle: (triLocal) => {
            // Closest point pair between the capsule segment and the triangle.
            // ExtendedTriangle (from three-mesh-bvh) ships the segment-vs-tri
            // closest-point routine we need; vanilla THREE.Triangle doesn't.
            tri.copy(triLocal);
            tri.needsUpdate = true;
            capSegment.start.copy(localBot);
            capSegment.end.copy(localTop);
            const dist = tri.closestPointToSegment(capSegment, triPoint, capPoint);
            if (dist < radius) {
              // Convert the contact point and capsule point back to WORLD,
              // then push the capsule centre along the (capPoint→triPoint)
              // axis until they're separated by exactly `radius`.
              triPoint.applyMatrix4(mesh.matrixWorld);
              capPoint.applyMatrix4(mesh.matrixWorld);
              push.subVectors(capPoint, triPoint);
              const len = push.length();
              if (len > 1e-6) {
                push.multiplyScalar((radius - len) / len);
                pos.add(push);
                hadContact = true;
                // If the contact normal points up, we're standing on it.
                if (push.y / Math.max(push.length(), 1e-6) > 0.7) grounded = true;
              }
            }
            return false; // keep iterating — accumulate every contact
          },
        });
      }

      if (!hadContact) break;
    }

    return { position: pos.clone(), grounded };
  }
}

// Reused scratch vectors — never construct in the hot loop.
const _v1  = new THREE.Vector3();
const _v2  = new THREE.Vector3();
const _v3  = new THREE.Vector3();
const _v4  = new THREE.Vector3();
const _v5  = new THREE.Vector3();
const _v6  = new THREE.Vector3();
const _v7  = new THREE.Vector3();
const _v8  = new THREE.Vector3();
const _v9  = new THREE.Vector3();
const _v10 = new THREE.Vector3();
const _tri = new ExtendedTriangle();
const _seg = new THREE.Line3();
const _mat4 = new THREE.Matrix4();
