import { Suspense, useEffect, useMemo } from "react";
import { create } from "zustand";
import * as THREE from "three";
import type { DecorType } from "./DungeonGenerator";
import { useAsset } from "../hooks/useAsset";
import { DECOR_TO_DUNGEON_ASSET } from "./DungeonAssetMap";

/**
 * Pre-fractured GLB variants for destructible dungeon decor.
 *
 * Each registered asset is a GLB whose child meshes represent the
 * individual chunks the prop should fall apart into. At load time we
 * auto-scale the whole scene to match the in-game prop's normalized
 * height, then bake each child mesh into a `FractureChunkTemplate`
 * (geometry + material + spawn offset). When `shatterDecor` fires for
 * a registered decor type, those templates seed the fragment list with
 * real model chunks instead of colored cuboids.
 *
 * Decor types missing from the registry — or whose GLB fails to load —
 * silently fall back to the procedural cuboid fragments.
 */

export interface FractureAssetDef {
  /** Path to the pre-fractured GLB under `client/public/`. */
  path: string;
  /** Cap on chunks pulled from the GLB. Defaults to 10. Extra meshes
   *  beyond the cap are dropped largest-first so the most visually
   *  prominent chunks survive. */
  maxChunks?: number;
}

/** Authoritative registry. Empty entries → cuboid fallback for that type.
 *
 *  Asset authoring lives in `scripts/build-fracture-glbs.cjs`, which
 *  slices each prop's source GLB/glTF into chunk meshes that share the
 *  prop's own materials and textures. To add or tweak a fracture, edit
 *  that script and re-run it (`node scripts/build-fracture-glbs.cjs`). */
export const FRACTURE_ASSETS: Partial<Record<DecorType, FractureAssetDef>> = {
  // Wood family — staves, planks, shelves, panels.
  barrel:    { path: "/models/dungeon/fractures/barrel.glb",    maxChunks: 8 },
  crate:     { path: "/models/dungeon/fractures/crate.glb",     maxChunks: 6 },
  bookshelf: { path: "/models/dungeon/fractures/bookshelf.glb", maxChunks: 6 },
  chest:     { path: "/models/dungeon/fractures/chest.glb",     maxChunks: 6 },
  // Stone — drum slices for the pillar.
  pillar:    { path: "/models/dungeon/fractures/pillar.glb",    maxChunks: 6 },
  // Ceramic — curved shards for grouped pots.
  pots:      { path: "/models/dungeon/fractures/pots.glb",      maxChunks: 8 },
  // Metal — curved shell shards for the cauldron + body chunks for anvil.
  cauldron:  { path: "/models/dungeon/fractures/cauldron.glb",  maxChunks: 6 },
  anvil:     { path: "/models/dungeon/fractures/anvil.glb",     maxChunks: 5 },
};

export interface FractureChunkTemplate {
  /** Cloned + scaled + recentered geometry. Position drives placement. */
  geometry: THREE.BufferGeometry;
  /** Original GLB material(s) — preserves PBR textures. Shared across
   *  all chunk instances of the same template. */
  material: THREE.Material | THREE.Material[];
  /** Local-space center of the chunk relative to the prop origin
   *  (model bottom pinned to y=0, matching `DungeonGLBDecor`). */
  offset: THREE.Vector3;
  /** Approx half-extent of the chunk, used for fragment lifetime/scale. */
  radius: number;
}

interface FractureRegistryState {
  templates: Partial<Record<DecorType, FractureChunkTemplate[]>>;
  registerTemplates: (decorType: DecorType, templates: FractureChunkTemplate[]) => void;
  reset: () => void;
}

export const useFractureRegistry = create<FractureRegistryState>((set, get) => ({
  templates: {},
  registerTemplates: (decorType, templates) => {
    if (get().templates[decorType]) return;
    set((s) => ({ templates: { ...s.templates, [decorType]: templates } }));
  },
  reset: () => set({ templates: {} }),
}));

export function getFractureTemplates(
  decorType: DecorType,
): FractureChunkTemplate[] | undefined {
  return useFractureRegistry.getState().templates[decorType];
}

/** Inspect the loaded scene and turn each child mesh into a chunk
 *  template, scaled so the assembled fracture matches the prop's
 *  normalized in-game height. */
function extractChunkTemplates(
  scene: THREE.Object3D,
  targetHeight: number,
  maxChunks: number,
): FractureChunkTemplate[] {
  scene.updateMatrixWorld(true);
  const fullBox = new THREE.Box3().setFromObject(scene);
  const fullHeight = Math.max(1e-4, fullBox.max.y - fullBox.min.y);
  const scale = targetHeight / fullHeight;

  const meshes: THREE.Mesh[] = [];
  scene.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh && m.geometry) meshes.push(m);
  });

  if (meshes.length === 0) return [];

  const sized = meshes.map((mesh) => {
    const box = new THREE.Box3().setFromObject(mesh);
    const sz = box.getSize(new THREE.Vector3());
    return { mesh, box, vol: Math.max(1e-6, sz.x * sz.y * sz.z) };
  });
  sized.sort((a, b) => b.vol - a.vol);
  const picked = sized.slice(0, maxChunks);

  const templates: FractureChunkTemplate[] = [];
  for (const { mesh, box } of picked) {
    const center = box.getCenter(new THREE.Vector3());
    const offset = new THREE.Vector3(
      center.x * scale,
      (center.y - fullBox.min.y) * scale,
      center.z * scale,
    );
    const sz = box.getSize(new THREE.Vector3());
    const radius = Math.max(sz.x, sz.y, sz.z) * 0.5 * scale;

    const geom = mesh.geometry.clone();
    geom.applyMatrix4(new THREE.Matrix4().makeScale(scale, scale, scale));
    geom.computeBoundingBox();
    if (geom.boundingBox) {
      const c = geom.boundingBox.getCenter(new THREE.Vector3());
      geom.applyMatrix4(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
    }
    geom.computeBoundingBox();
    geom.computeBoundingSphere();

    templates.push({
      geometry: geom,
      material: mesh.material,
      offset,
      radius,
    });
  }
  return templates;
}

function FractureLoader({
  decorType,
  def,
}: {
  decorType: DecorType;
  def: FractureAssetDef;
}) {
  const gltf = useAsset(def.path);
  const register = useFractureRegistry((s) => s.registerTemplates);
  const mapping = DECOR_TO_DUNGEON_ASSET[decorType];
  const targetHeight = mapping?.height ?? 1;

  useEffect(() => {
    const isFallback = (gltf as { userData?: { isAssetFallback?: boolean } })
      .userData?.isAssetFallback;
    if (isFallback) return;
    const cap = Math.max(1, Math.min(10, def.maxChunks ?? 10));
    const templates = extractChunkTemplates(gltf.scene, targetHeight, cap);
    if (templates.length > 0) register(decorType, templates);
  }, [gltf, decorType, def.maxChunks, targetHeight, register]);

  return null;
}

/**
 * Mounts one Suspense-wrapped loader per registered fracture asset.
 * Each loader reads the GLB through the shared `useAsset` cache and
 * registers its chunk templates exactly once. Mount this anywhere
 * inside the dungeon scene tree (alongside `<DungeonDecorFragments>`).
 */
export function FractureChunksPreloader() {
  const entries = useMemo(
    () => Object.entries(FRACTURE_ASSETS) as [DecorType, FractureAssetDef][],
    [],
  );
  if (entries.length === 0) return null;
  return (
    <>
      {entries.map(([type, def]) => (
        <Suspense key={type} fallback={null}>
          <FractureLoader decorType={type} def={def} />
        </Suspense>
      ))}
    </>
  );
}
