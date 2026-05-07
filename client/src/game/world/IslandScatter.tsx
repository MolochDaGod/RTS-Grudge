import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useAsset } from "../hooks/useAsset";

/**
 * Beyond this camera distance, scattered island props stop casting shadows.
 * Every pool keeps two THREE.InstancedMesh draws per inner template — a near
 * pool with castShadow=true, and a far pool with castShadow=false. Membership
 * is repartitioned on a low-frequency timer so we still pay only one shadow
 * pass per inner mesh and only for nearby instances.
 *
 * Beyond DRAW_CULL_FACTOR * worldSize the instance is omitted entirely from
 * both pools, dropping it from the color pass too. Default is 0.6 of the
 * generated terrain extent (≈120 units for the default 200-unit island), well
 * past the shadow radius and the gameplay-relevant area but inside the typical
 * camera frustum so off-screen scatter on the far side of the island is not
 * drawn.
 */
const SHADOW_CULL_DISTANCE_SQ = 35 * 35;
const SHADOW_CULL_INTERVAL = 0.25;
const DRAW_CULL_FACTOR = 0.6;
/**
 * Width (in world units) of the hysteresis fade band just inside the draw
 * cull radius. Instances inside `cull - FADE_BAND` are fully visible
 * (fade=1), instances outside `cull` are fully culled (fade=0), and
 * anything in between ramps based on distance. Combined with the
 * time-based ramp (FADE_TIME), this hides scatter pop-in/out when the
 * camera crosses the cull edge and lets designers pull the radius in
 * without visible artifacts.
 */
const FADE_BAND = 6;
const FADE_TIME = 0.3;
const FADE_EPSILON = 1e-3;
import type { IslandBiome } from "@/lib/stores/useIslandWorld";
import type { IslandTerrainData } from "./IslandGenerator";
import { getIslandTerrainHeight } from "./IslandGenerator";
import { PIRATE_ASSETS, VILLAGE_ASSETS } from "../dungeon/DungeonAssetMap";

interface ScatterItem {
  path: string;
  x: number;
  z: number;
  rotation: number;
  height: number;
  scale: number;
}

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

const BIOME_VILLAGE_BUILDINGS: Record<IslandBiome, string[]> = {
  temperate: ["inn", "blacksmith", "house1", "house2", "house3", "mill", "stable"],
  tropical: ["house1", "house4", "sawmill", "gazebo"],
  volcanic: ["blacksmith", "house3", "bell_tower"],
  arctic: ["inn", "house2", "house1", "stable"],
  pirate: [],
  cursed: ["house3", "house4", "bell_tower"],
};

const PIRATE_VILLAGE_BUILDINGS = [
  "house1", "house2", "house3", "sawmill",
];

const PIRATE_PROPS = [
  "barrel", "cannon", "chest_closed", "anchor", "skull", "bomb", "bucket",
];

function generateScatterItems(
  terrainData: IslandTerrainData,
  biome: IslandBiome,
  seed: number,
): ScatterItem[] {
  const items: ScatterItem[] = [];
  const rng = seededRng(seed + 500);

  const villageX = terrainData.villageCenter.x;
  const villageZ = terrainData.villageCenter.z;

  if (biome === "pirate") {
    const pirateBuildings = PIRATE_VILLAGE_BUILDINGS;
    for (let i = 0; i < Math.min(4, pirateBuildings.length); i++) {
      const angle = (i / 4) * Math.PI * 2 + rng() * 0.5;
      const dist = 8 + rng() * 10;
      const bx = villageX + Math.cos(angle) * dist;
      const bz = villageZ + Math.sin(angle) * dist;
      const key = pirateBuildings[i];
      const piratePath = (PIRATE_ASSETS as any)[key];
      if (piratePath) {
        items.push({
          path: piratePath,
          x: bx, z: bz,
          rotation: rng() * Math.PI * 2,
          height: 4,
          scale: 1,
        });
      }
    }

    for (let i = 0; i < 15; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 5 + rng() * 40;
      const px = villageX + Math.cos(angle) * dist;
      const pz = villageZ + Math.sin(angle) * dist;
      const h = getIslandTerrainHeight(px, pz, terrainData);
      if (h < 0.5) continue;
      const propKey = PIRATE_PROPS[Math.floor(rng() * PIRATE_PROPS.length)];
      const propPath = (PIRATE_ASSETS as any)[propKey];
      if (propPath) {
        items.push({
          path: propPath,
          x: px, z: pz,
          rotation: rng() * Math.PI * 2,
          height: 0.8,
          scale: 1,
        });
      }
    }

    const palmTypes = [PIRATE_ASSETS.palm_tree1, PIRATE_ASSETS.palm_tree2, PIRATE_ASSETS.palm_tree3];
    for (let i = 0; i < 30; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 15 + rng() * 60;
      const px = Math.cos(angle) * dist;
      const pz = Math.sin(angle) * dist;
      const h = getIslandTerrainHeight(px, pz, terrainData);
      if (h < 0.3 || h > 5) continue;
      items.push({
        path: palmTypes[Math.floor(rng() * palmTypes.length)],
        x: px, z: pz,
        rotation: rng() * Math.PI * 2,
        height: 4 + rng() * 3,
        scale: 1,
      });
    }

    const rockTypes = [
      PIRATE_ASSETS.rock1, PIRATE_ASSETS.rock2, PIRATE_ASSETS.rock3,
      PIRATE_ASSETS.rock4, PIRATE_ASSETS.rock5,
    ];
    for (let i = 0; i < 15; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 20 + rng() * 70;
      const px = Math.cos(angle) * dist;
      const pz = Math.sin(angle) * dist;
      const h = getIslandTerrainHeight(px, pz, terrainData);
      if (h < 0.2) continue;
      items.push({
        path: rockTypes[Math.floor(rng() * rockTypes.length)],
        x: px, z: pz,
        rotation: rng() * Math.PI * 2,
        height: 1 + rng() * 2,
        scale: 1,
      });
    }
  } else {
    const buildings = BIOME_VILLAGE_BUILDINGS[biome];
    const numBuildings = Math.min(buildings.length, 3 + Math.floor(rng() * 3));
    for (let i = 0; i < numBuildings; i++) {
      const angle = (i / numBuildings) * Math.PI * 2 + rng() * 0.5;
      const dist = 10 + rng() * 12;
      const bx = villageX + Math.cos(angle) * dist;
      const bz = villageZ + Math.sin(angle) * dist;
      const bkey = buildings[i % buildings.length];
      const asset = VILLAGE_ASSETS[bkey];
      if (asset) {
        items.push({
          path: asset.path,
          x: bx, z: bz,
          rotation: Math.atan2(villageX - bx, villageZ - bz),
          height: asset.height,
          scale: 1,
        });
      }
    }

    const props = ["well", "barrel", "crate", "bench1", "cart", "bonfire_lit", "market_stand1"];
    for (let i = 0; i < 8; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 5 + rng() * 20;
      const px = villageX + Math.cos(angle) * dist;
      const pz = villageZ + Math.sin(angle) * dist;
      const h = getIslandTerrainHeight(px, pz, terrainData);
      if (h < 0.3) continue;
      const propKey = props[Math.floor(rng() * props.length)];
      const asset = VILLAGE_ASSETS[propKey];
      if (asset) {
        items.push({
          path: asset.path,
          x: px, z: pz,
          rotation: rng() * Math.PI * 2,
          height: asset.height,
          scale: 1,
        });
      }
    }
  }

  return items;
}

/**
 * Brighten near-black untextured materials on scattered GLBs. Mirrors the
 * behavior the AssetPipeline.fixDarkMaterials path used to apply per clone,
 * but operates once on the shared cached gltf.scene so instanced copies all
 * pick up the corrected materials.
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

interface InstanceSpec {
  x: number;
  z: number;
  y: number;
  rotation: number;
  height: number;
}

// Reusable scratch vector to avoid per-instance allocation when composing
// matrices with the per-frame fade scale.
const _tmpScale = new THREE.Vector3();

/**
 * Hardware-instanced pool sharing one GLB across many scatter placements.
 * Per-instance uniform scale (derived from item.height / natural height) lets
 * a single InstancedMesh cover scattered props that were authored at very
 * different sizes (e.g. randomly sized palm trees/rocks).
 */
function InstancedScatterPool({
  path,
  instances,
  drawCullDistance,
}: {
  path: string;
  instances: InstanceSpec[];
  drawCullDistance: number;
}) {
  const drawCullDistanceSq = drawCullDistance * drawCullDistance;
  const gltf = useAsset(path);
  fixDarkSceneMaterials(gltf.scene);

  const templates = useMemo(() => collectMeshTemplates(gltf.scene), [gltf]);

  const naturalBox = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    return { minY: box.min.y, sy: Math.max(0.0001, box.max.y - box.min.y) };
  }, [gltf]);

  // Pre-baked instance matrices (one per scatter item, identical across all
  // inner mesh templates aside from the per-template localMatrix). We compute
  // them once and reuse them every shadow-cull repartition without rebuilding
  // the per-instance trig.
  // Cached per-instance pose, NOT including per-frame fade scale. We compose
  // (translation, rotation, baseScale) and the y-translation that drops the
  // mesh's natural origin to ground level. Fade scale is applied later as
  // a uniform scale around the instance pivot.
  const instancePoses = useMemo(() => {
    const yAxis = new THREE.Vector3(0, 1, 0);
    const out = new Array<{
      pos: THREE.Vector3;
      quat: THREE.Quaternion;
      baseScale: number;
    }>(instances.length);
    for (let i = 0; i < instances.length; i++) {
      const spec = instances[i];
      const quat = new THREE.Quaternion().setFromAxisAngle(yAxis, spec.rotation);
      out[i] = {
        pos: new THREE.Vector3(spec.x, spec.y, spec.z),
        quat,
        baseScale: spec.height / naturalBox.sy,
      };
    }
    return out;
  }, [instances, naturalBox]);

  const yTranslation = useMemo(
    () => new THREE.Matrix4().makeTranslation(0, -naturalBox.minY, 0),
    [naturalBox],
  );

  const nearRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const farRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const camera = useThree((s) => s.camera);
  const cullTimerRef = useRef(0);
  const lastPartitionKeyRef = useRef<string>("");

  // Per-instance fade amount in [0,1]. 1 = fully visible, 0 = fully culled.
  // Initialised lazily on the first repartition so we don't pop on spawn.
  const fadeRef = useRef<Float32Array>(new Float32Array(0));
  const fadeInitedRef = useRef(false);

  // Resize fade buffer if the instance count changes (HMR / asset rebuild).
  useEffect(() => {
    if (fadeRef.current.length !== instances.length) {
      fadeRef.current = new Float32Array(instances.length);
      fadeInitedRef.current = false;
    }
  }, [instances.length]);

  const buildInstanceMatrix = (i: number, fade: number, target: THREE.Matrix4) => {
    const pose = instancePoses[i];
    const s = pose.baseScale * fade;
    target.compose(pose.pos, pose.quat, _tmpScale.set(s, s, s));
    target.multiply(yTranslation);
  };

  const repartition = (force: boolean) => {
    const inst = new THREE.Matrix4();
    const local = new THREE.Matrix4();
    const camX = camera.position.x;
    const camZ = camera.position.z;
    const fade = fadeRef.current;

    // Build membership ahead of time; use a cheap rounded key to avoid redundant
    // matrix uploads when the camera barely moved between ticks.
    const nearIdx: number[] = [];
    const farIdx: number[] = [];
    // Membership checksum: per-near-index FNV-1a-style mix so any change in
    // the near/far split invalidates the cache, not just first/last/length.
    let memHash = 2166136261 >>> 0;
    // Quantised fade hash so re-uploads only happen when fade values
    // actually change visibly between repartitions.
    let fadeHash = 2166136261 >>> 0;
    for (let i = 0; i < instances.length; i++) {
      const spec = instances[i];
      const dx = camX - spec.x;
      const dz = camZ - spec.z;
      const distSq = dx * dx + dz * dz;
      const f = fade[i];
      if (f < FADE_EPSILON) {
        // Fully faded out — omitted from both pools.
        memHash ^= (i + 1) | 0x80000000;
        memHash = Math.imul(memHash, 16777619) >>> 0;
        continue;
      }
      // Quantise fade to ~1/64 increments for the change check.
      const fq = (f * 64) | 0;
      fadeHash ^= ((i + 1) ^ (fq << 16)) >>> 0;
      fadeHash = Math.imul(fadeHash, 16777619) >>> 0;
      if (distSq < SHADOW_CULL_DISTANCE_SQ) {
        nearIdx.push(i);
        memHash ^= i + 1;
        memHash = Math.imul(memHash, 16777619) >>> 0;
      } else {
        farIdx.push(i);
        memHash ^= (i + 1) | 0x40000000;
        memHash = Math.imul(memHash, 16777619) >>> 0;
      }
    }
    const key = `${nearIdx.length}|${farIdx.length}|${memHash}|${fadeHash}`;
    if (!force && key === lastPartitionKeyRef.current) return;
    lastPartitionKeyRef.current = key;

    for (let ti = 0; ti < templates.length; ti++) {
      const tmpl = templates[ti];
      const nearMesh = nearRefs.current[ti];
      const farMesh = farRefs.current[ti];
      if (nearMesh) {
        for (let n = 0; n < nearIdx.length; n++) {
          const idx = nearIdx[n];
          buildInstanceMatrix(idx, fade[idx], local);
          inst.copy(local).multiply(tmpl.localMatrix);
          nearMesh.setMatrixAt(n, inst);
        }
        nearMesh.count = nearIdx.length;
        nearMesh.instanceMatrix.needsUpdate = true;
        nearMesh.computeBoundingSphere();
      }
      if (farMesh) {
        for (let f2 = 0; f2 < farIdx.length; f2++) {
          const idx = farIdx[f2];
          buildInstanceMatrix(idx, fade[idx], local);
          inst.copy(local).multiply(tmpl.localMatrix);
          farMesh.setMatrixAt(f2, inst);
        }
        farMesh.count = farIdx.length;
        farMesh.instanceMatrix.needsUpdate = true;
        farMesh.computeBoundingSphere();
      }
    }
  };

  // Advance the per-instance fade toward its distance-derived target.
  // Returns true if any fade value moved enough this frame to warrant a
  // matrix re-upload.
  const advanceFade = (delta: number): boolean => {
    const fade = fadeRef.current;
    if (fade.length === 0) return false;
    const camX = camera.position.x;
    const camZ = camera.position.z;
    const drawCull = drawCullDistance;
    const fadeInner = Math.max(0, drawCull - FADE_BAND);
    const rate = delta / FADE_TIME;
    const init = !fadeInitedRef.current;
    let changed = false;
    for (let i = 0; i < instances.length; i++) {
      const spec = instances[i];
      const dx = camX - spec.x;
      const dz = camZ - spec.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      let target: number;
      if (dist <= fadeInner) target = 1;
      else if (dist >= drawCull) target = 0;
      else target = (drawCull - dist) / FADE_BAND;
      if (init) {
        // Snap to target on the very first frame so spawn doesn't ramp in.
        fade[i] = target;
        continue;
      }
      const cur = fade[i];
      if (cur === target) continue;
      let nxt: number;
      if (cur < target) nxt = Math.min(target, cur + rate);
      else nxt = Math.max(target, cur - rate);
      if (Math.abs(nxt - cur) > 1e-4) changed = true;
      fade[i] = nxt;
    }
    if (init) {
      fadeInitedRef.current = true;
      return true;
    }
    return changed;
  };

  useEffect(() => {
    lastPartitionKeyRef.current = "";
    fadeInitedRef.current = false;
    advanceFade(0);
    repartition(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, instancePoses, drawCullDistance]);

  useFrame((_, delta) => {
    const fadeChanged = advanceFade(delta);
    cullTimerRef.current -= delta;
    const partitionDue = cullTimerRef.current <= 0;
    if (partitionDue) cullTimerRef.current = SHADOW_CULL_INTERVAL;
    if (partitionDue || fadeChanged) repartition(false);
  });

  if (instances.length === 0) return null;

  return (
    <>
      {templates.map((tmpl, ti) => (
        <group key={ti}>
          <instancedMesh
            ref={(m) => {
              nearRefs.current[ti] = m;
            }}
            args={[tmpl.geometry, tmpl.material as THREE.Material, instances.length]}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={(m) => {
              farRefs.current[ti] = m;
            }}
            args={[tmpl.geometry, tmpl.material as THREE.Material, instances.length]}
            castShadow={false}
            receiveShadow
          />
        </group>
      ))}
    </>
  );
}

export default function IslandScatter({
  terrainData,
  drawCullDistance,
}: {
  terrainData: IslandTerrainData;
  drawCullDistance?: number;
}) {
  const effectiveCullDistance =
    drawCullDistance ?? terrainData.worldSize * DRAW_CULL_FACTOR;
  const grouped = useMemo(() => {
    const items = generateScatterItems(terrainData, terrainData.biome, terrainData.seed);
    const byPath = new Map<string, InstanceSpec[]>();
    for (const item of items) {
      const y = getIslandTerrainHeight(item.x, item.z, terrainData);
      const list = byPath.get(item.path) ?? [];
      list.push({
        x: item.x,
        z: item.z,
        y,
        rotation: item.rotation,
        height: item.height,
      });
      byPath.set(item.path, list);
    }
    return Array.from(byPath.entries());
  }, [terrainData]);

  return (
    <group>
      {grouped.map(([path, instances]) => (
        <Suspense key={path} fallback={null}>
          <InstancedScatterPool
            path={path}
            instances={instances}
            drawCullDistance={effectiveCullDistance}
          />
        </Suspense>
      ))}
    </group>
  );
}
