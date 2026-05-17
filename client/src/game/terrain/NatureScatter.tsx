import { Suspense, useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getTerrainHeight, globalHeightData } from "../components/Terrain";
import { useAsset } from "../hooks/useAsset";
import { attachWindToMaterial } from "../effects/WindSway";
import { getBiomeAtPosition } from "../systems/BiomeSpawnRegistry";

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface ScatteredInstance {
  position: [number, number, number];
  rotation: number;
  scale: number;
}

const NATURE_ASSETS = {
  trees: [
    "/models/nature/CommonTree_1.glb",
    "/models/nature/CommonTree_2.glb",
    "/models/nature/CommonTree_3.glb",
    "/models/nature/CommonTree_4.glb",
    "/models/nature/CommonTree_5.glb",
  ],
  pines: [
    "/models/nature/Pine_1.glb",
    "/models/nature/Pine_2.glb",
    "/models/nature/Pine_3.glb",
    "/models/nature/Pine_4.glb",
    "/models/nature/Pine_5.glb",
  ],
  deadTrees: [
    "/models/nature/DeadTree_1.glb",
    "/models/nature/DeadTree_2.glb",
    "/models/nature/DeadTree_3.glb",
  ],
  twistedTrees: [
    "/models/nature/TwistedTree_1.glb",
    "/models/nature/TwistedTree_2.glb",
    "/models/nature/TwistedTree_3.glb",
  ],
  rocks: [
    "/models/nature/Rock_Medium_1.glb",
    "/models/nature/Rock_Medium_2.glb",
    "/models/nature/Rock_Medium_3.glb",
  ],
  bushes: [
    "/models/nature/Bush_Common.glb",
    "/models/nature/Bush_Common_Flowers.glb",
  ],
  grass: [
    "/models/nature/Grass_Common_Short.glb",
    "/models/nature/Grass_Common_Tall.glb",
    "/models/nature/Grass_Wispy_Short.glb",
    "/models/nature/Grass_Wispy_Tall.glb",
  ],
  mushrooms: [
    "/models/nature/Mushroom_Common.glb",
    "/models/nature/Mushroom_Laetiporus.glb",
  ],
  flowers: [
    "/models/nature/Flower_3_Group.glb",
    "/models/nature/Flower_4_Group.glb",
  ],
  ferns: [
    "/models/nature/Fern_1.glb",
  ],
  plants: [
    "/models/nature/Plant_1.glb",
    "/models/nature/Plant_7.glb",
  ],
};

function generateScatterInstances(
  count: number,
  seed: number,
  minRadius: number,
  maxRadius: number,
  minScale: number,
  maxScale: number,
  avoidCenter: number = 15,
): ScatteredInstance[] {
  const rng = seededRandom(seed);
  const instances: ScatteredInstance[] = [];
  let attempts = 0;
  while (instances.length < count && attempts < count * 3) {
    attempts++;
    const angle = rng() * Math.PI * 2;
    const radius = minRadius + rng() * (maxRadius - minRadius);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x) < avoidCenter && Math.abs(z) < avoidCenter) continue;
    const y = getTerrainHeight(x, z, globalHeightData);
    if (y < -1 || y > 10) continue;
    const scale = minScale + rng() * (maxScale - minScale);
    const rotation = rng() * Math.PI * 2;
    instances.push({ position: [x, y, z], rotation, scale });
  }
  return instances;
}

interface MeshData {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

const modelMeshCache = new Map<string, { meshes: MeshData[]; baseScale: number }>();

function extractMeshes(scene: THREE.Object3D): MeshData[] {
  const meshes: MeshData[] = [];
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      meshes.push({
        geometry: child.geometry,
        material: child.material,
      });
    }
  });
  return meshes;
}

const _tempMatrix = new THREE.Matrix4();
const _tempPosition = new THREE.Vector3();
const _tempQuaternion = new THREE.Quaternion();
const _tempScale = new THREE.Vector3();
const _yAxis = new THREE.Vector3(0, 1, 0);

function InstancedNatureGroup({ path, instances, windEnabled = false }: {
  path: string;
  instances: ScatteredInstance[];
  windEnabled?: boolean;
}) {
  const gltf = useAsset(path);
  const groupRef = useRef<THREE.Group>(null);

  const { meshes, baseScale } = useMemo(() => {
    let cached = modelMeshCache.get(path);
    if (!cached) {
      const clone = gltf.scene.clone(true);
      const box = new THREE.Box3().setFromObject(clone);
      const h = box.max.y - box.min.y;
      const bs = 2.5 / Math.max(h, 0.01);
      clone.scale.setScalar(bs);
      clone.updateMatrixWorld(true);

      const extractedMeshes: MeshData[] = [];
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          const geom = child.geometry.clone();
          geom.applyMatrix4(child.matrixWorld);
          extractedMeshes.push({
            geometry: geom,
            material: child.material,
          });
        }
      });

      cached = { meshes: extractedMeshes, baseScale: 1 };
      modelMeshCache.set(path, cached);
    }
    return cached;
  }, [gltf, path]);

  const instancedMeshes = useMemo(() => {
    if (instances.length === 0 || meshes.length === 0) return [];

    return meshes.map((meshData) => {
      const mat = Array.isArray(meshData.material) ? meshData.material[0] : meshData.material;
      // Foliage assets get a vertex-shader wind sway. Safe to call
      // multiple times — the helper marks the material to no-op on
      // subsequent calls, so cached/shared materials don't get
      // chained onBeforeCompile hooks.
      if (windEnabled && mat) attachWindToMaterial(mat);
      const im = new THREE.InstancedMesh(meshData.geometry, mat, instances.length);
      im.castShadow = false;
      im.receiveShadow = false;

      for (let i = 0; i < instances.length; i++) {
        const inst = instances[i];
        _tempPosition.set(inst.position[0], inst.position[1], inst.position[2]);
        _tempQuaternion.setFromAxisAngle(_yAxis, inst.rotation);
        _tempScale.setScalar(inst.scale * baseScale);
        _tempMatrix.compose(_tempPosition, _tempQuaternion, _tempScale);
        im.setMatrixAt(i, _tempMatrix);
      }
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = true;

      im.computeBoundingSphere();

      return im;
    });
  }, [meshes, instances, baseScale]);

  useEffect(() => {
    return () => {
      instancedMeshes.forEach((im) => {
        if (im.instanceMatrix) {
          im.instanceMatrix = null!;
        }
      });
    };
  }, [instancedMeshes]);

  return (
    <group ref={groupRef}>
      {instancedMeshes.map((im, i) => (
        <primitive key={`${path}-im-${i}`} object={im} />
      ))}
    </group>
  );
}

function InstancedScatterGroup({ paths, instances, windEnabled = false }: {
  paths: string[];
  instances: ScatteredInstance[];
  windEnabled?: boolean;
}) {
  const perPathInstances = useMemo(() => {
    const groups = new Map<string, ScatteredInstance[]>();
    paths.forEach((p) => groups.set(p, []));
    instances.forEach((inst, i) => {
      const pathKey = paths[i % paths.length];
      groups.get(pathKey)!.push(inst);
    });
    return groups;
  }, [paths, instances]);

  return (
    <>
      {Array.from(perPathInstances.entries()).map(([path, insts]) => (
        insts.length > 0 ? (
          <Suspense key={path} fallback={null}>
            <InstancedNatureGroup path={path} instances={insts} windEnabled={windEnabled} />
          </Suspense>
        ) : null
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Biome-to-asset filter rules.
// Each entry: which biome ids are ALLOWED for this scatter type.
// Empty set = allowed in all biomes.
// ─────────────────────────────────────────────────────────────────────────────

const BIOME_ALLOW: Record<string, Set<string>> = {
  pines:      new Set(["mountains", "snow", "forest"]),
  deadTrees:  new Set(["lava", "desert", "mountains"]),
  twisted:    new Set(["swamp", "lava", "desert"]),
  mushrooms:  new Set(["forest", "swamp", "plains", "jungle"]),
  flowers:    new Set(["plains", "forest", "jungle", "coast"]),
  ferns:      new Set(["forest", "jungle", "swamp"]),
  plants:     new Set(["jungle", "swamp", "forest", "plains"]),
  // Trees, rocks, bushes, grass are allowed everywhere (empty = no filter).
};

function filterByBiome(instances: ScatteredInstance[], category: string): ScatteredInstance[] {
  const allowed = BIOME_ALLOW[category];
  if (!allowed || allowed.size === 0) return instances; // no restriction
  return instances.filter((inst) => {
    const biomeId = getBiomeAtPosition(inst.position[0], inst.position[2]).id;
    return allowed.has(biomeId);
  });
}

export default function NatureScatter() {
  const rawTrees    = useMemo(() => generateScatterInstances(12, 100, 20, 90, 1.5, 3.0), []);
  const rawPines    = useMemo(() => generateScatterInstances(16, 200, 25, 90, 1.2, 2.5), []);
  const rawDead     = useMemo(() => generateScatterInstances(8,  300, 30, 85, 1.0, 2.0), []);
  const rawTwisted  = useMemo(() => generateScatterInstances(7,  350, 35, 80, 1.5, 2.5), []);
  const rawRocks    = useMemo(() => generateScatterInstances(8,  400, 15, 85, 0.8, 2.0), []);
  const rawBushes   = useMemo(() => generateScatterInstances(10, 500, 12, 80, 0.8, 1.5), []);
  const rawGrass    = useMemo(() => generateScatterInstances(12, 600,  8, 70, 0.6, 1.2, 8), []);
  const rawMushrooms= useMemo(() => generateScatterInstances(8,  700, 15, 60, 0.5, 1.0), []);
  const rawFlowers  = useMemo(() => generateScatterInstances(10, 800, 10, 70, 0.6, 1.0, 8), []);
  const rawFerns    = useMemo(() => generateScatterInstances(8,  900, 12, 65, 0.7, 1.3), []);
  const rawPlants   = useMemo(() => generateScatterInstances(8, 1000, 10, 75, 0.5, 1.2), []);

  // Apply biome filter — only place ecologically appropriate plants per zone
  const treeInstances     = useMemo(() => filterByBiome(rawTrees,    "trees"),    [rawTrees]);
  const pineInstances     = useMemo(() => filterByBiome(rawPines,    "pines"),    [rawPines]);
  const deadTreeInstances = useMemo(() => filterByBiome(rawDead,     "deadTrees"),[rawDead]);
  const twistedInstances  = useMemo(() => filterByBiome(rawTwisted,  "twisted"),  [rawTwisted]);
  const rockInstances     = useMemo(() => filterByBiome(rawRocks,    "rocks"),    [rawRocks]);
  const bushInstances     = useMemo(() => filterByBiome(rawBushes,   "bushes"),   [rawBushes]);
  const grassInstances    = useMemo(() => filterByBiome(rawGrass,    "grass"),    [rawGrass]);
  const mushroomInstances = useMemo(() => filterByBiome(rawMushrooms,"mushrooms"),[rawMushrooms]);
  const flowerInstances   = useMemo(() => filterByBiome(rawFlowers,  "flowers"),  [rawFlowers]);
  const fernInstances     = useMemo(() => filterByBiome(rawFerns,    "ferns"),    [rawFerns]);
  const plantInstances    = useMemo(() => filterByBiome(rawPlants,   "plants"),   [rawPlants]);

  return (
    <group>
      <InstancedScatterGroup paths={NATURE_ASSETS.trees} instances={treeInstances} windEnabled />
      <InstancedScatterGroup paths={NATURE_ASSETS.pines} instances={pineInstances} windEnabled />
      <InstancedScatterGroup paths={NATURE_ASSETS.deadTrees} instances={deadTreeInstances} windEnabled />
      <InstancedScatterGroup paths={NATURE_ASSETS.twistedTrees} instances={twistedInstances} windEnabled />
      <InstancedScatterGroup paths={NATURE_ASSETS.rocks} instances={rockInstances} />
      <InstancedScatterGroup paths={NATURE_ASSETS.bushes} instances={bushInstances} windEnabled />
      <InstancedScatterGroup paths={NATURE_ASSETS.grass} instances={grassInstances} windEnabled />
      <InstancedScatterGroup paths={NATURE_ASSETS.mushrooms} instances={mushroomInstances} />
      <InstancedScatterGroup paths={NATURE_ASSETS.flowers} instances={flowerInstances} windEnabled />
      <InstancedScatterGroup paths={NATURE_ASSETS.ferns} instances={fernInstances} windEnabled />
      <InstancedScatterGroup paths={NATURE_ASSETS.plants} instances={plantInstances} windEnabled />
    </group>
  );
}
