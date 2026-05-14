import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useAsset } from "../hooks/useAsset";
import { TileGrid, DungeonTile, DungeonTheme, TILE_SIZE } from "./DungeonGenerator";

/**
 * Brighten near-black untextured materials on dungeon GLB pieces. KayKit
 * dungeon assets occasionally ship with very dark base colors that read as
 * "broken" in-scene under low ambient dungeon lighting. We mirror the same
 * heuristic AssetPipeline.fixDarkMaterials uses (luminance threshold + sRGB
 * map flag) so structural tiles look consistent with decor passed through
 * the asset pipeline. Cached per-scene so we do not mutate materials twice.
 */
type StandardLikeMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
function isStandardLike(mat: THREE.Material): mat is StandardLikeMaterial {
  return (
    mat instanceof THREE.MeshStandardMaterial ||
    mat instanceof THREE.MeshPhysicalMaterial
  );
}

const DARK_FIXED = new WeakSet<THREE.Object3D>();
function fixDarkSceneMaterials(scene: THREE.Object3D): void {
  if (DARK_FIXED.has(scene)) return;
  DARK_FIXED.add(scene);
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      if (mat instanceof THREE.MeshBasicMaterial && mat.map) {
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.needsUpdate = true;
        mat.needsUpdate = true;
        continue;
      }
      if (!isStandardLike(mat)) continue;
      const hasMap = !!(mat.map || mat.emissiveMap || mat.normalMap);
      if (mat.map) {
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.needsUpdate = true;
      }
      if (!hasMap) {
        const c = mat.color;
        const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
        if (lum < 0.08) {
          c.set("#8B7355");
          mat.roughness = Math.max(mat.roughness, 0.6);
        }
        if (mat.metalness > 0.95) {
          mat.metalness = 0.5;
          mat.roughness = Math.max(mat.roughness, 0.4);
        }
      }
      mat.needsUpdate = true;
    }
  });
}

const KK = "/models/dungeon_kaykit";
const QT = "/models/dungeon_quaternius";

/**
 * Tiny per-axis scale fudge applied to floor and wall pieces so adjacent
 * tiles overlap by a hair and hide the hairline seams that show up where
 * the GLB mesh footprints fall a fraction of a unit short of TILE_SIZE.
 * Values must stay very close to 1 (sub-percent) to avoid visible squashing.
 */
export const SEAM_FUDGE = {
  floor: 1.004,
  wall: 1.002,
} as const;

/**
 * Per-piece yaw offset (radians) added on top of the renderer's per-tile
 * rotation. Use these to correct GLBs whose authored "front" doesn't match
 * the renderer's convention:
 *   wall  : decorated side faces +Z (into the room) at rotation 0
 *   corner: occupies the +X / -Z corner at rotation 0
 *   door  : opening faces into the room (+Z) at rotation 0
 */
export interface ModularPieceSet {
  floor: string;
  floorAlt?: string;
  floorAccent?: string;
  wall: string;
  wallYaw?: number;
  wallCorner: string;
  wallCornerYaw?: number;
  wallSplit: string;
  wallSplitYaw?: number;
  wallIntersection: string;
  wallIntersectionYaw?: number;
  wallEnd: string;
  wallEndYaw?: number;
  wallDoor: string;
  wallDoorYaw?: number;
  wallTorch?: string;
  pillar: string;
  stairs: string;
  entrance: string;
  exitArch: string;
}

const PIECE_SETS: Record<DungeonTheme, ModularPieceSet> = {
  crypt: {
    floor: `${KK}/tileBrickA_large.glb`,
    floorAlt: `${KK}/tileBrickB_large.glb`,
    floorAccent: `${KK}/tileBrickB_large.glb`,
    wall: `${KK}/wall.glb`,
    wallCorner: `${KK}/wallCorner.glb`,
    // KayKit corner is authored facing +X/-Z; the renderer's "rotation 0"
    // expects N+E (also +X/-Z), so no extra yaw is needed here.
    wallCornerYaw: 0,
    wallSplit: `${KK}/wallSplit.glb`,
    wallIntersection: `${KK}/wallIntersection.glb`,
    wallEnd: `${KK}/wall_end.glb`,
    wallDoor: `${KK}/wall_door.glb`,
    // KayKit door's arch opening points away from the wall normal at +Z,
    // but the renderer mounts doorN with the wall facing -Z, so flip 180°
    // so the carved opening faces into the room interior.
    wallDoorYaw: Math.PI,
    wallTorch: `${KK}/torchWall.glb`,
    pillar: `${KK}/pillar.glb`,
    stairs: `${KK}/stairs.glb`,
    entrance: `${QT}/Entrance.glb`,
    exitArch: `${QT}/Entrance2.glb`,
  },
  mine: {
    floor: `${KK}/tileBrickA_large.glb`,
    floorAlt: `${KK}/floorDecoration_wood.glb`,
    floorAccent: `${KK}/tileBrickA_large.glb`,
    wall: `${KK}/wall_broken.glb`,
    wallCorner: `${KK}/wallCorner.glb`,
    wallCornerYaw: 0,
    wallSplit: `${KK}/wallSplit.glb`,
    wallIntersection: `${KK}/wallIntersection.glb`,
    wallEnd: `${KK}/wall_end.glb`,
    wallDoor: `${KK}/wall_door.glb`,
    wallDoorYaw: Math.PI,
    wallTorch: `${KK}/torchWall.glb`,
    pillar: `${KK}/pillar_broken.glb`,
    stairs: `${KK}/scaffold_stairs.glb`,
    entrance: `${QT}/Entrance.glb`,
    exitArch: `${QT}/Entrance2.glb`,
  },
  temple: {
    floor: `${KK}/tileBrickA_large.glb`,
    floorAlt: `${KK}/floorDecoration_tilesLarge.glb`,
    floorAccent: `${KK}/tileBrickB_large.glb`,
    wall: `${KK}/wall.glb`,
    wallCorner: `${KK}/wallCorner.glb`,
    wallCornerYaw: 0,
    wallSplit: `${KK}/wallSplit.glb`,
    wallIntersection: `${KK}/wallIntersection.glb`,
    wallEnd: `${KK}/wall_end.glb`,
    wallDoor: `${KK}/wall_gate.glb`,
    // The gate piece is authored mirrored relative to wall_door; same
    // 180° flip lands the opening into the room.
    wallDoorYaw: Math.PI,
    wallTorch: `${KK}/torchWall.glb`,
    pillar: `${KK}/pillar.glb`,
    stairs: `${KK}/stairs_wide.glb`,
    entrance: `${QT}/Entrance.glb`,
    exitArch: `${QT}/Entrance2.glb`,
  },
};

type FitMode = "floorTile" | "wall" | "pillar" | "arch" | "decor";

const NORMALIZE_CACHE = new Map<string, { scale: number; yOffset: number }>();

function computeNormalization(scene: THREE.Object3D, fit: FitMode): { scale: number; yOffset: number } {
  const box = new THREE.Box3().setFromObject(scene);
  const sx = box.max.x - box.min.x || 1;
  const sy = box.max.y - box.min.y || 1;
  const sz = box.max.z - box.min.z || 1;

  let scale = 1;
  if (fit === "floorTile" || fit === "wall") {
    scale = TILE_SIZE / Math.max(sx, sz);
  } else if (fit === "pillar") {
    scale = TILE_SIZE / sy;
  } else if (fit === "arch") {
    scale = TILE_SIZE / Math.max(sx, sz);
  } else if (fit === "decor") {
    scale = (TILE_SIZE * 0.5) / Math.max(sx, sy, sz);
  }
  if (!isFinite(scale) || scale <= 0) scale = 1;
  scale = Math.max(0.05, Math.min(20, scale));

  const yOffset = -box.min.y * scale;
  return { scale, yOffset };
}

function getNormalization(path: string, fit: FitMode, scene: THREE.Object3D) {
  const key = `${path}|${fit}`;
  let cached = NORMALIZE_CACHE.get(key);
  if (!cached) {
    cached = computeNormalization(scene, fit);
    NORMALIZE_CACHE.set(key, cached);
  }
  return cached;
}

interface InstanceSpec {
  position: [number, number, number];
  rotation: number;
}

/** Per-fit scale fudge applied uniformly to instance composition to hide seams. */
function fudgeForFit(fit: FitMode): number {
  if (fit === "floorTile") return SEAM_FUDGE.floor;
  if (fit === "wall") return SEAM_FUDGE.wall;
  return 1;
}

interface MeshTemplate {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  localMatrix: THREE.Matrix4;
}

function collectMeshTemplates(scene: THREE.Object3D): MeshTemplate[] {
  scene.updateMatrixWorld(true);
  const list: MeshTemplate[] = [];
  scene.traverse((obj: THREE.Object3D) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      list.push({
        geometry: mesh.geometry,
        material: mesh.material,
        localMatrix: mesh.matrixWorld.clone(),
      });
    }
  });
  return list;
}

/** Renders many copies of one GLB piece using THREE.InstancedMesh per inner mesh. */
function InstancedPiecePool({
  path,
  fit,
  instances,
}: {
  path: string;
  fit: FitMode;
  instances: InstanceSpec[];
}) {
  const gltf = useAsset(path);
  fixDarkSceneMaterials(gltf.scene);
  const norm = useMemo(() => getNormalization(path, fit, gltf.scene), [path, fit, gltf]);
  const templates = useMemo(() => collectMeshTemplates(gltf.scene), [gltf]);
  const fudge = fudgeForFit(fit);

  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  useEffect(() => {
    const tPos = new THREE.Vector3();
    const qRot = new THREE.Quaternion();
    const sclVec = new THREE.Vector3(fudge, 1, fudge);
    const yT = new THREE.Matrix4().makeTranslation(0, norm.yOffset, 0);
    const sclM = new THREE.Matrix4().makeScale(norm.scale, norm.scale, norm.scale);
    const trM = new THREE.Matrix4();
    const inst = new THREE.Matrix4();

    for (let ti = 0; ti < templates.length; ti++) {
      const mesh = meshRefs.current[ti];
      if (!mesh) continue;
      const tmpl = templates[ti];
      for (let i = 0; i < instances.length; i++) {
        const spec = instances[i];
        tPos.set(spec.position[0], spec.position[1], spec.position[2]);
        qRot.setFromAxisAngle(new THREE.Vector3(0, 1, 0), spec.rotation);
        trM.compose(tPos, qRot, sclVec);
        inst.copy(trM).multiply(yT).multiply(sclM).multiply(tmpl.localMatrix);
        mesh.setMatrixAt(i, inst);
      }
      mesh.count = instances.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [templates, instances, norm, fudge]);

  if (instances.length === 0) return null;

  return (
    <>
      {templates.map((tmpl, ti) => (
        <instancedMesh
          key={ti}
          ref={(m) => {
            meshRefs.current[ti] = m;
          }}
          args={[tmpl.geometry, tmpl.material as THREE.Material, instances.length]}
          castShadow
          receiveShadow
        />
      ))}
    </>
  );
}

/** Single-clone piece, used for unique / low-frequency placements (e.g. arches). */
function SinglePiece({
  path,
  position,
  rotation = 0,
  fit,
  extraScale = 1,
}: {
  path: string;
  position: [number, number, number];
  rotation?: number;
  fit: FitMode;
  extraScale?: number;
}) {
  const gltf = useAsset(path);
  fixDarkSceneMaterials(gltf.scene);
  const norm = useMemo(() => getNormalization(path, fit, gltf.scene), [path, fit, gltf]);
  const cloned = useMemo(() => {
    const c = gltf.scene.clone(true);
    c.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return c;
  }, [gltf]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group position={[0, norm.yOffset * extraScale, 0]} scale={norm.scale * extraScale}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}

/**
 * Unified decoration renderer: groups decoration placements by GLB path and
 * draws each group as an instanced pool. Use this for chest / bookcase /
 * candelabrum / column / carpet etc. so room decoration flows through the
 * same modular pipeline as structural floor / wall pieces.
 */
export interface ModularDecorPlacement {
  path: string;
  position: [number, number, number];
  rotation?: number;
  /** "decor" (default) sizes the piece to ~half a tile; "arch" uses full tile width. */
  fit?: FitMode;
}

export function DungeonModularDecorations({ placements }: { placements: ModularDecorPlacement[] }) {
  const grouped = useMemo(() => {
    const byKey = new Map<string, { path: string; fit: FitMode; instances: InstanceSpec[] }>();
    for (const p of placements) {
      const fit = p.fit ?? "decor";
      const key = `${p.path}|${fit}`;
      const entry = byKey.get(key) ?? { path: p.path, fit, instances: [] };
      entry.instances.push({ position: p.position, rotation: p.rotation ?? 0 });
      byKey.set(key, entry);
    }
    return Array.from(byKey.values());
  }, [placements]);

  return (
    <group>
      {grouped.map((g) => (
        <Suspense key={`${g.path}|${g.fit}`} fallback={null}>
          <InstancedPiecePool path={g.path} fit={g.fit} instances={g.instances} />
        </Suspense>
      ))}
    </group>
  );
}

/**
 * A single modular stairs piece, placed (for example) inside the exit room
 * to give the dungeon visible vertical / threshold geometry.
 */
export function DungeonStairs({
  position,
  theme,
  rotation = 0,
}: {
  position: [number, number, number];
  theme: DungeonTheme;
  rotation?: number;
}) {
  const pieces = PIECE_SETS[theme];
  return (
    <Suspense fallback={null}>
      <SinglePiece path={pieces.stairs} position={position} rotation={rotation} fit="arch" extraScale={1} />
    </Suspense>
  );
}

export function DungeonEntranceArch({
  position,
  theme,
  kind,
  rotation = 0,
}: {
  position: [number, number, number];
  theme: DungeonTheme;
  kind: "spawn" | "exit";
  rotation?: number;
}) {
  const pieces = PIECE_SETS[theme];
  const path = kind === "spawn" ? pieces.entrance : pieces.exitArch;
  return (
    <Suspense fallback={null}>
      <SinglePiece path={path} position={position} rotation={rotation} fit="arch" extraScale={1.1} />
    </Suspense>
  );
}

/**
 * Minimal subset of {@link import("./DungeonScene").ChandelierSwaySource}
 * the wall-torch lights need to brighten in sync with hero chandeliers.
 * Declared locally so this module stays free of a circular import on
 * `DungeonScene` (which already imports from us).
 */
export interface WallTorchSwaySource {
  x: number;
  z: number;
  phase: number;
  freq: number;
}

/* ------------------------------------------------------------------ */
/* Wall-torch flame lights (pooled, distance-culled)                   */
/* ------------------------------------------------------------------ */

interface TorchSwayInfluence {
  phase: number;
  freq: number;
  weight: number;
}

interface TorchLightSpec {
  /** World-space position of the flame head (where the light sits). */
  flame: [number, number, number];
  /** Pre-resolved nearby hero-chandelier influences for sway brightening. */
  influences: TorchSwayInfluence[];
}

/** Approximate flame-head offsets relative to the wall mount point. */
const WALL_TORCH_FLAME_HEIGHT = 0.7;
const WALL_TORCH_FLAME_DEPTH = 0.25;
/** Warm flame colour and reach. Distance is set so the lit pool is
 *  visible across a corridor width without leaking into adjacent rooms. */
const WALL_TORCH_LIGHT_COLOR = "#ff7a33";
const WALL_TORCH_LIGHT_INTENSITY = 2.6;
const WALL_TORCH_LIGHT_DISTANCE = 11;
/** Same "same-room" reach used by the floor-torch sway effect, so wall
 *  torches feel coherent with the existing chandelier-sync brightening. */
const WALL_TORCH_SWAY_RANGE = 11;
const WALL_TORCH_SWAY_BOOST_FRACTION = 0.18;
/** Pool size: cap on simultaneously lit wall torches. The K nearest to
 *  the player are activated each frame; the rest stay dark (still
 *  rendered as GLB meshes by the instance pool above). */
const WALL_TORCH_POOL_SIZE = 6;
/** Squared cull radius around the player. Beyond this, a torch is too
 *  far to meaningfully affect what the camera sees and is skipped. */
const WALL_TORCH_CULL_RADIUS = 22;

/**
 * Pooled flame lights for instanced wall torches. We only ever
 * instantiate {@link WALL_TORCH_POOL_SIZE} `pointLight`s; each frame we
 * pick the closest `K` torches to the player (within the cull radius)
 * and snap a light onto each. Torches outside the radius emit no light
 * for that frame, but the GLB still renders so the player sees the
 * unlit prop in the distance.
 */
function WallTorchLightPool({
  torches,
  playerPositionRef,
}: {
  torches: TorchLightSpec[];
  playerPositionRef: React.MutableRefObject<THREE.Vector3>;
}) {
  const lightRefs = useRef<(THREE.PointLight | null)[]>([]);
  // Reusable per-frame scratch arrays. `slots` ranks candidate torch
  // indices by distance (insertion sort, K is small) so we avoid any
  // per-frame allocation in the hot loop.
  const slots = useRef<{ idx: number; d2: number }[]>(
    Array.from({ length: WALL_TORCH_POOL_SIZE }, () => ({ idx: -1, d2: Infinity })),
  );

  useFrame((state) => {
    const player = playerPositionRef.current;
    const cullR2 = WALL_TORCH_CULL_RADIUS * WALL_TORCH_CULL_RADIUS;

    // Reset slots.
    const ranked = slots.current;
    for (let s = 0; s < WALL_TORCH_POOL_SIZE; s++) {
      ranked[s].idx = -1;
      ranked[s].d2 = Infinity;
    }

    // Insertion-sort each candidate into the K-best list.
    for (let i = 0; i < torches.length; i++) {
      const f = torches[i].flame;
      const dx = f[0] - player.x;
      const dz = f[2] - player.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > cullR2) continue;
      // Bubble into sorted slot list (ascending d2).
      if (d2 >= ranked[WALL_TORCH_POOL_SIZE - 1].d2) continue;
      let j = WALL_TORCH_POOL_SIZE - 1;
      while (j > 0 && d2 < ranked[j - 1].d2) {
        ranked[j].idx = ranked[j - 1].idx;
        ranked[j].d2 = ranked[j - 1].d2;
        j--;
      }
      ranked[j].idx = i;
      ranked[j].d2 = d2;
    }

    const t = state.clock.elapsedTime;
    for (let s = 0; s < WALL_TORCH_POOL_SIZE; s++) {
      const light = lightRefs.current[s];
      if (!light) continue;
      const slot = ranked[s];
      if (slot.idx < 0) {
        if (light.visible) light.visible = false;
        continue;
      }
      const torch = torches[slot.idx];
      light.visible = true;
      light.position.set(torch.flame[0], torch.flame[1], torch.flame[2]);

      // Chandelier-sync brightening (same shaping as TorchFlameLight).
      const influences = torch.influences;
      let pulseSum = 0;
      for (let k = 0; k < influences.length; k++) {
        const c = influences[k];
        const pulse = Math.abs(Math.cos(t * c.freq + c.phase));
        const shaped = pulse > 0.5 ? (pulse - 0.5) * 2 : 0;
        pulseSum += shaped * c.weight;
      }
      if (pulseSum > 1) pulseSum = 1;
      light.intensity =
        WALL_TORCH_LIGHT_INTENSITY * (1 + WALL_TORCH_SWAY_BOOST_FRACTION * pulseSum);
    }
  });

  return (
    <>
      {Array.from({ length: WALL_TORCH_POOL_SIZE }, (_, s) => (
        <pointLight
          key={s}
          ref={(l) => {
            lightRefs.current[s] = l;
          }}
          color={WALL_TORCH_LIGHT_COLOR}
          intensity={0}
          distance={WALL_TORCH_LIGHT_DISTANCE}
          decay={2}
          visible={false}
        />
      ))}
    </>
  );
}

interface DungeonModularPiecesProps {
  grid: TileGrid;
  theme: DungeonTheme;
  enablePillars?: boolean;
  enableTorches?: boolean;
  /** Hero (shadow-casting) chandeliers in the layout — used to extend
   *  the chandelier-sway brightening effect to nearby wall torches. */
  heroChandeliers?: WallTorchSwaySource[];
  /** Live player position. Required for distance-culling the pooled
   *  wall-torch lights — only the K nearest torches get a real light. */
  playerPositionRef?: React.MutableRefObject<THREE.Vector3>;
}

/* ------------------------------------------------------------------ */
/* Vertex-junction analysis                                            */
/* ------------------------------------------------------------------ */

type JunctionKind = "end" | "corner" | "split" | "intersection";

interface VertexJunction {
  vx: number;
  vz: number;
  kind: JunctionKind;
  rotation: number;
  key: string;
}

function classifyVertex(
  vx: number,
  vz: number,
  hasWallH: (x: number, z: number) => boolean, // edge along x at row z, between x and x+1
  hasWallV: (x: number, z: number) => boolean, // edge along z at col x, between z and z+1
): VertexJunction | null {
  // Edges meeting at vertex (vx, vz):
  //   N: vertical edge between (vx, vz-1) and (vx, vz)  -> hasWallV(vx, vz-1)
  //   S: vertical edge between (vx, vz) and (vx, vz+1)  -> hasWallV(vx, vz)
  //   E: horizontal edge between (vx, vz) and (vx+1, vz)-> hasWallH(vx, vz)
  //   W: horizontal edge between (vx-1, vz) and (vx, vz)-> hasWallH(vx - 1, vz)
  const eN = hasWallV(vx, vz - 1);
  const eS = hasWallV(vx, vz);
  const eE = hasWallH(vx, vz);
  const eW = hasWallH(vx - 1, vz);

  const count = (eN ? 1 : 0) + (eS ? 1 : 0) + (eE ? 1 : 0) + (eW ? 1 : 0);
  if (count === 0) return null;

  const key = `${vx},${vz}`;
  if (count === 4) {
    return { vx, vz, kind: "intersection", rotation: 0, key };
  }
  if (count === 3) {
    // T-junction: missing edge dictates rotation. Default piece "stem" assumed to point +X (E).
    let rot = 0;
    if (!eW) rot = Math.PI;
    else if (!eE) rot = 0;
    else if (!eN) rot = -Math.PI / 2;
    else if (!eS) rot = Math.PI / 2;
    return { vx, vz, kind: "split", rotation: rot, key };
  }
  if (count === 2) {
    // Colinear walls: not a junction, return nothing (the wall pieces themselves cover it).
    if (eN && eS) return null;
    if (eE && eW) return null;
    // Perpendicular: corner. Default corner orientation assumed N+E (rotation 0).
    let rot = 0;
    if (eN && eE) rot = 0;
    else if (eN && eW) rot = Math.PI / 2;
    else if (eS && eE) rot = -Math.PI / 2;
    else if (eS && eW) rot = Math.PI;
    return { vx, vz, kind: "corner", rotation: rot, key };
  }
  // count === 1: dead-end cap. Rotation points along the wall direction.
  let rot = 0;
  if (eN) rot = 0;
  else if (eE) rot = -Math.PI / 2;
  else if (eS) rot = Math.PI;
  else if (eW) rot = Math.PI / 2;
  return { vx, vz, kind: "end", rotation: rot, key };
}

/* ------------------------------------------------------------------ */
/* Main renderer                                                       */
/* ------------------------------------------------------------------ */

export default function DungeonModularPieces({
  grid,
  theme,
  enablePillars = true,
  enableTorches = true,
  heroChandeliers,
  playerPositionRef,
}: DungeonModularPiecesProps) {
  const pieces = PIECE_SETS[theme];

  // Build tile lookup for adjacency and edge queries.
  const tileMap = useMemo(() => {
    const m = new Map<string, DungeonTile>();
    for (const t of grid.tiles) m.set(`${t.tx},${t.tz}`, t);
    return m;
  }, [grid]);

  // Edge presence helpers: a wall exists on an edge if exactly one of the two adjacent
  // tiles is present (and it's not a doorway).
  const { hasWallH, hasWallV } = useMemo(() => {
    const get = (x: number, z: number) => tileMap.get(`${x},${z}`);
    const isDoorEdgeBetween = (a: DungeonTile | undefined, b: DungeonTile | undefined): boolean => {
      // Doors only exist between a room tile and a corridor tile (both present).
      if (!a || !b) return false;
      if (a.floorKind === "corridor" && b.floorKind !== "corridor") return true;
      if (b.floorKind === "corridor" && a.floorKind !== "corridor") return true;
      return false;
    };
    // Horizontal edge at row z between x and x+1: separates tile (x, z-1) from (x, z).
    const hasWallH = (x: number, z: number) => {
      const above = get(x, z - 1);
      const below = get(x, z);
      if (!!above === !!below) return false; // both present or both empty -> no wall
      // Skip if this edge is part of a door (shouldn't happen since one side is empty here)
      if (isDoorEdgeBetween(above, below)) return false;
      return true;
    };
    // Vertical edge at col x between z and z+1: separates tile (x-1, z) from (x, z).
    const hasWallV = (x: number, z: number) => {
      const left = get(x - 1, z);
      const right = get(x, z);
      if (!!left === !!right) return false;
      if (isDoorEdgeBetween(left, right)) return false;
      return true;
    };
    return { hasWallH, hasWallV };
  }, [tileMap]);

  // ---------- Floors ----------
  const floorByPath = useMemo(() => {
    const map = new Map<string, InstanceSpec[]>();
    for (const t of grid.tiles) {
      const seed = (t.tx * 73856093) ^ (t.tz * 19349663);
      const useAlt = ((seed >>> 0) % 5) === 0 && pieces.floorAlt;
      const useAccent =
        (t.roomType === "boss" || t.roomType === "treasure" || t.roomType === "shrine") &&
        pieces.floorAccent;
      const path = useAccent ? pieces.floorAccent! : useAlt ? pieces.floorAlt! : pieces.floor;
      const list = map.get(path) ?? [];
      list.push({ position: [t.wx, 0, t.wz], rotation: 0 });
      map.set(path, list);
    }
    return map;
  }, [grid, pieces]);

  // ---------- Walls + doors ----------
  const { wallInstances, doorInstances } = useMemo(() => {
    const half = TILE_SIZE / 2;
    const wallYaw = pieces.wallYaw ?? 0;
    const doorYaw = pieces.wallDoorYaw ?? 0;
    const walls: InstanceSpec[] = [];
    const doors: InstanceSpec[] = [];
    for (const t of grid.tiles) {
      // Plain walls (corridor/room boundary with the void).
      if (t.wallN) walls.push({ position: [t.wx, 0, t.wz - half], rotation: 0 + wallYaw });
      if (t.wallS) walls.push({ position: [t.wx, 0, t.wz + half], rotation: Math.PI + wallYaw });
      if (t.wallW) walls.push({ position: [t.wx - half, 0, t.wz], rotation: Math.PI / 2 + wallYaw });
      if (t.wallE) walls.push({ position: [t.wx + half, 0, t.wz], rotation: -Math.PI / 2 + wallYaw });

      // Doorways: room-tile edges that face a corridor tile. Avoid double-placement
      // by only emitting from the room side (doorN/S/E/W are only set on non-corridor tiles).
      if (t.doorN) doors.push({ position: [t.wx, 0, t.wz - half], rotation: 0 + doorYaw });
      if (t.doorS) doors.push({ position: [t.wx, 0, t.wz + half], rotation: Math.PI + doorYaw });
      if (t.doorW) doors.push({ position: [t.wx - half, 0, t.wz], rotation: Math.PI / 2 + doorYaw });
      if (t.doorE) doors.push({ position: [t.wx + half, 0, t.wz], rotation: -Math.PI / 2 + doorYaw });
    }
    return { wallInstances: walls, doorInstances: doors };
  }, [grid, pieces.wallYaw, pieces.wallDoorYaw]);

  // ---------- Vertex junctions ----------
  const junctions = useMemo(() => {
    const seen = new Set<string>();
    const out: VertexJunction[] = [];
    // Iterate over every unique vertex touched by any tile (4 vertices per tile).
    for (const t of grid.tiles) {
      const verts: Array<[number, number]> = [
        [t.tx, t.tz],
        [t.tx + 1, t.tz],
        [t.tx, t.tz + 1],
        [t.tx + 1, t.tz + 1],
      ];
      for (const [vx, vz] of verts) {
        const key = `${vx},${vz}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const j = classifyVertex(vx, vz, hasWallH, hasWallV);
        if (j) out.push(j);
      }
    }
    return out;
  }, [grid, hasWallH, hasWallV]);

  const cornerYaw = pieces.wallCornerYaw ?? 0;
  const splitYaw = pieces.wallSplitYaw ?? 0;
  const intersectionYaw = pieces.wallIntersectionYaw ?? 0;
  const endYaw = pieces.wallEndYaw ?? 0;

  const cornerInstances = useMemo<InstanceSpec[]>(
    () =>
      junctions
        .filter((j) => j.kind === "corner")
        .map((j) => ({ position: [j.vx * TILE_SIZE, 0, j.vz * TILE_SIZE], rotation: j.rotation + cornerYaw })),
    [junctions, cornerYaw],
  );
  const splitInstances = useMemo<InstanceSpec[]>(
    () =>
      junctions
        .filter((j) => j.kind === "split")
        .map((j) => ({ position: [j.vx * TILE_SIZE, 0, j.vz * TILE_SIZE], rotation: j.rotation + splitYaw })),
    [junctions, splitYaw],
  );
  const intersectionInstances = useMemo<InstanceSpec[]>(
    () =>
      junctions
        .filter((j) => j.kind === "intersection")
        .map((j) => ({ position: [j.vx * TILE_SIZE, 0, j.vz * TILE_SIZE], rotation: j.rotation + intersectionYaw })),
    [junctions, intersectionYaw],
  );
  const endInstances = useMemo<InstanceSpec[]>(
    () =>
      junctions
        .filter((j) => j.kind === "end")
        .map((j) => ({ position: [j.vx * TILE_SIZE, 0, j.vz * TILE_SIZE], rotation: j.rotation + endYaw })),
    [junctions, endYaw],
  );

  // ---------- Pillars (decorative, important rooms only) ----------
  const pillarInstances = useMemo<InstanceSpec[]>(() => {
    if (!enablePillars) return [];
    const out: InstanceSpec[] = [];
    const placed = new Set<string>();
    for (const j of junctions) {
      if (j.kind !== "corner") continue;
      // Sample a tile this vertex belongs to to check room importance.
      const t =
        tileMap.get(`${j.vx - 1},${j.vz - 1}`) ??
        tileMap.get(`${j.vx},${j.vz - 1}`) ??
        tileMap.get(`${j.vx - 1},${j.vz}`) ??
        tileMap.get(`${j.vx},${j.vz}`);
      if (!t) continue;
      const important =
        t.roomType === "boss" ||
        t.roomType === "shrine" ||
        t.roomType === "library" ||
        t.roomType === "treasure" ||
        t.roomType === "arena";
      if (!important) continue;
      if (placed.has(j.key)) continue;
      placed.add(j.key);
      out.push({ position: [j.vx * TILE_SIZE, 0, j.vz * TILE_SIZE], rotation: 0 });
    }
    return out;
  }, [junctions, tileMap, enablePillars]);

  // ---------- Wall torches (corridors and important rooms, every Nth wall) ----------
  // Both the GLB instance pool and the pooled point lights derive from the
  // same placement pass so the lit flame head always sits in the right spot
  // relative to the rendered torch GLB.
  const { torchInstances, torchLightSpecs } = useMemo(() => {
    if (!enableTorches || !pieces.wallTorch) {
      return { torchInstances: [] as InstanceSpec[], torchLightSpecs: [] as TorchLightSpec[] };
    }
    const insts: InstanceSpec[] = [];
    const lights: TorchLightSpec[] = [];
    const half = TILE_SIZE / 2;
    let counter = 0;
    for (const t of grid.tiles) {
      const inCorridor = t.floorKind === "corridor";
      const important =
        t.roomType === "boss" ||
        t.roomType === "shrine" ||
        t.roomType === "library" ||
        t.roomType === "treasure";
      if (!inCorridor && !important) continue;
      const stride = inCorridor ? 3 : 4;
      // Place a torch on the first available wall every `stride` qualifying tiles.
      const sides: Array<{ has: boolean; pos: [number, number, number]; rot: number }> = [
        { has: t.wallN, pos: [t.wx, 1.5, t.wz - half + 0.05], rot: 0 },
        { has: t.wallS, pos: [t.wx, 1.5, t.wz + half - 0.05], rot: Math.PI },
        { has: t.wallW, pos: [t.wx - half + 0.05, 1.5, t.wz], rot: Math.PI / 2 },
        { has: t.wallE, pos: [t.wx + half - 0.05, 1.5, t.wz], rot: -Math.PI / 2 },
      ];
      const candidate = sides.find((s) => s.has);
      if (!candidate) continue;
      if (counter % stride === 0) {
        insts.push({ position: candidate.pos, rotation: candidate.rot });
        // Local +Z (after Y-rotation `rot`) points into the room; offset
        // the light a short way out from the wall so the cone wraps the
        // flame head rather than the wall behind it.
        const inwardX = Math.sin(candidate.rot);
        const inwardZ = Math.cos(candidate.rot);
        const flame: [number, number, number] = [
          candidate.pos[0] + inwardX * WALL_TORCH_FLAME_DEPTH,
          candidate.pos[1] + WALL_TORCH_FLAME_HEIGHT,
          candidate.pos[2] + inwardZ * WALL_TORCH_FLAME_DEPTH,
        ];
        lights.push({ flame, influences: [] });
      }
      counter++;
    }
    return { torchInstances: insts, torchLightSpecs: lights };
  }, [grid, pieces.wallTorch, enableTorches]);

  // Per-torch chandelier sway influences. Recomputed only when the torch
  // set or the hero-chandelier set changes; the runtime per-frame loop
  // then iterates a typically-tiny per-light list.
  const torchLightSpecsWithSway = useMemo(() => {
    const sources = heroChandeliers ?? [];
    if (sources.length === 0) return torchLightSpecs;
    const r2 = WALL_TORCH_SWAY_RANGE * WALL_TORCH_SWAY_RANGE;
    return torchLightSpecs.map((spec) => {
      const list: TorchSwayInfluence[] = [];
      for (const c of sources) {
        const dx = spec.flame[0] - c.x;
        const dz = spec.flame[2] - c.z;
        const dist2 = dx * dx + dz * dz;
        if (dist2 > r2) continue;
        const dist = Math.sqrt(dist2);
        const w = 1 - dist / WALL_TORCH_SWAY_RANGE;
        if (w <= 0) continue;
        list.push({ phase: c.phase, freq: c.freq, weight: w * w });
      }
      return list.length > 0 ? { ...spec, influences: list } : spec;
    });
  }, [torchLightSpecs, heroChandeliers]);

  return (
    <group>
      {/* Floors (instanced per path) */}
      {Array.from(floorByPath.entries()).map(([path, list]) => (
        <Suspense key={`fp_${path}`} fallback={null}>
          <InstancedPiecePool path={path} fit="floorTile" instances={list} />
        </Suspense>
      ))}

      {/* Walls (instanced) */}
      <Suspense fallback={null}>
        <InstancedPiecePool path={pieces.wall} fit="wall" instances={wallInstances} />
      </Suspense>

      {/* Door / arch segments (instanced) */}
      <Suspense fallback={null}>
        <InstancedPiecePool path={pieces.wallDoor} fit="wall" instances={doorInstances} />
      </Suspense>

      {/* Vertex junctions */}
      <Suspense fallback={null}>
        <InstancedPiecePool path={pieces.wallCorner} fit="wall" instances={cornerInstances} />
      </Suspense>
      <Suspense fallback={null}>
        <InstancedPiecePool path={pieces.wallSplit} fit="wall" instances={splitInstances} />
      </Suspense>
      <Suspense fallback={null}>
        <InstancedPiecePool path={pieces.wallIntersection} fit="wall" instances={intersectionInstances} />
      </Suspense>
      <Suspense fallback={null}>
        <InstancedPiecePool path={pieces.wallEnd} fit="wall" instances={endInstances} />
      </Suspense>

      {/* Pillars */}
      {pillarInstances.length > 0 && (
        <Suspense fallback={null}>
          <InstancedPiecePool path={pieces.pillar} fit="pillar" instances={pillarInstances} />
        </Suspense>
      )}

      {/* Wall torches */}
      {torchInstances.length > 0 && pieces.wallTorch && (
        <Suspense fallback={null}>
          <InstancedPiecePool path={pieces.wallTorch} fit="decor" instances={torchInstances} />
        </Suspense>
      )}

      {/* Pooled wall-torch flame lights — only the K nearest to the
          player carry an actual point light each frame, so the dungeon
          stays performant regardless of total wall-torch count. */}
      {playerPositionRef && torchLightSpecsWithSway.length > 0 && (
        <WallTorchLightPool
          torches={torchLightSpecsWithSway}
          playerPositionRef={playerPositionRef}
        />
      )}
    </group>
  );
}
