/**
 * Pathfinder — three-pathfinding wrapper.
 *
 * Loads a navmesh GLB authored externally (Blender's NavMesh modifier,
 * Recast, Houdini, etc.) and exposes a synchronous `findPath(start, end)`
 * that returns either the corridor of waypoints or null.
 *
 * Convention: navmesh GLBs live under `public/models/navmesh/<scene>.glb`
 * with the actual nav surface as the FIRST Mesh in the scene graph.  No
 * material requirements — only `geometry.attributes.position` is read.
 *
 * Multi-zone scenes (multiple navmesh files for different levels) are
 * supported via the `zoneId` constructor arg — give each Pathfinder a
 * unique zone string and they won't clash.
 */
import * as THREE from 'three';
import { Pathfinding } from 'three-pathfinding';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Pathfinder {
  private pathfinding = new Pathfinding();
  private loader = new GLTFLoader();
  private zoneId: string;
  /** True once a navmesh has been loaded and registered with the zone. */
  loaded = false;
  /** The mesh that was registered, kept for debug/visualisation. */
  navMesh: THREE.Mesh | null = null;

  constructor(zoneId = 'level') {
    this.zoneId = zoneId;
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  /**
   * Load a navmesh GLB from an absolute URL.  Throws if the file has no
   * mesh or if the GLB itself fails to parse.
   */
  async loadFromUrl(url: string): Promise<void> {
    const gltf = await this.loader.loadAsync(url);
    let nav: THREE.Mesh | null = null;
    gltf.scene.traverse(o => {
      if (!nav && (o as THREE.Mesh).isMesh) nav = o as THREE.Mesh;
    });
    if (!nav) throw new Error(`Pathfinder: no Mesh found in ${url}`);

    const zone = Pathfinding.createZone((nav as THREE.Mesh).geometry);
    this.pathfinding.setZoneData(this.zoneId, zone);
    this.navMesh = nav;
    this.loaded = true;
  }

  /**
   * Convenience: load `<basePath>models/navmesh/<sceneName>.glb`.  `basePath`
   * defaults to `import.meta.env.BASE_URL` (the artifact's mount path under
   * Replit's preview proxy), which is what app code should pass.
   */
  async loadScene(sceneName: string, basePath = '/'): Promise<void> {
    const root = basePath.endsWith('/') ? basePath : basePath + '/';
    await this.loadFromUrl(`${root}models/navmesh/${sceneName}.glb`);
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  /**
   * Find a path from `start` to `end`.  Returns the array of waypoints
   * (NOT including `start`) on success, or null if either point is off the
   * navmesh / no route exists / the pathfinder isn't loaded yet.
   */
  findPath(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] | null {
    if (!this.loaded) return null;

    // Snap each endpoint to the nearest navmesh group (an "island" of
    // connected polys).  If start and end are on different islands we can't
    // route between them — bail.
    const startGroup = this.pathfinding.getGroup(this.zoneId, start);
    if (startGroup == null) return null;
    const endGroup = this.pathfinding.getGroup(this.zoneId, end);
    if (endGroup == null || endGroup !== startGroup) return null;

    const startNode = this.pathfinding.getClosestNode(start, this.zoneId, startGroup);
    const endNode = this.pathfinding.getClosestNode(end, this.zoneId, endGroup);
    if (!startNode || !endNode) return null;

    const path = this.pathfinding.findPath(start, end, this.zoneId, startGroup);
    return path ?? null;
  }

  /**
   * Cheap reachability test — true if `target` is on the same navmesh island
   * as `from`, regardless of obstacle complexity.  No corridor is computed.
   */
  isReachable(from: THREE.Vector3, target: THREE.Vector3): boolean {
    if (!this.loaded) return false;
    const a = this.pathfinding.getGroup(this.zoneId, from);
    const b = this.pathfinding.getGroup(this.zoneId, target);
    return a != null && a === b;
  }

  /** Snap an arbitrary world position to the nearest point on the navmesh. */
  snapToNavmesh(position: THREE.Vector3): THREE.Vector3 | null {
    if (!this.loaded) return null;
    const group = this.pathfinding.getGroup(this.zoneId, position);
    if (group == null) return null;
    const node = this.pathfinding.getClosestNode(position, this.zoneId, group);
    return node ? node.centroid.clone() : null;
  }

  /** Free internal data; call when leaving a level. */
  dispose(): void {
    this.loaded = false;
    this.navMesh = null;
    // three-pathfinding has no public dispose, but dropping our reference
    // lets the zone data be GC'd alongside this instance.
  }
}
