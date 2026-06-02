/**
 * Renders all PlacedEntity instances as selectable boxes (or loaded
 * GLTF if the asset is a URL). Click to select; selected entity gets
 * a TransformControls gizmo bound to the active translate/rotate/scale tool.
 */
import { useRef, useEffect, useMemo, Suspense } from 'react';
import { TransformControls, useGLTF, useAnimations } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';
import { useEditor } from './store';
import type { PlacedEntity, Vec3 } from '../types';
import { CreatureBySpecies } from './CreatureModels';
import {
  CardTree, TexturedFern, TexturedMushroom, TexturedBush,
  TexturedFlowerCluster, TexturedGrass, TexturedRock, PBRRockGLTF, Sway,
} from './TexturedFoliage';
import { GasGeyser } from './GasGeyser';

// Kenney CC0 ship GLB — dock anchor marker
const DOCK_GLB = `${import.meta.env.BASE_URL}assets/models/nature/ship-small.glb`;
// Fallen log + stump — wood resource node
const LOG_STUMP_GLB = `${import.meta.env.BASE_URL}assets/models/nature/log-stump.glb`;

// ── GlowCrystal ────────────────────────────────────────────────────────────────
// Intentionally stylised magical resource marker (not a low-effort placeholder).
// Glowing octahedra cluster — reads instantly as “valued resource” at any zoom.
const _CRYSTAL_GEO = new THREE.OctahedronGeometry(0.55, 0);
function GlowCrystal({ color = '#7df2ff' }: { color?: string }) {
  const col = new THREE.Color(color);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: col, emissive: col, emissiveIntensity: 0.7, roughness: 0.15, metalness: 0.45,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [color]);
  return (
    <group>
      <mesh geometry={_CRYSTAL_GEO} material={mat} position={[0, 0.55, 0]} castShadow />
      <mesh geometry={_CRYSTAL_GEO} material={mat} position={[0.28, 0.38, 0.1]}
        scale={[0.55, 0.65, 0.55]} rotation={[0.2, 0.5, 0.1]} castShadow />
      <mesh geometry={_CRYSTAL_GEO} material={mat} position={[-0.24, 0.32, -0.14]}
        scale={[0.5, 0.55, 0.5]} rotation={[-0.3, 1.2, 0]} castShadow />
      <pointLight color={color} intensity={0.8} distance={4} decay={2} position={[0, 0.7, 0]} />
    </group>
  );
}

const KIND_COLOR: Record<PlacedEntity['kind'], string> = {
  unit: '#ff8a3d',
  building: '#4dd0ff',
  prop: '#9aa0a8',
  spell_marker: '#c34dff',
  spawn_point: '#5dff8a',
  tree: '#3f8c4a',
  rock: '#8b8a83',
  bush: '#4f9c5a',
  flower: '#ff5d8f',
  creature: '#ffd24d',
  resource_node: '#7df2ff',
  dock: '#7a5429',
};

function EntityBody({ entity }: { entity: PlacedEntity }) {
  // Resolve the best available asset URL:
  //   entity.asset        — set by palette placement (LandscapeAssets.assetUrl)
  //   entity.data.asset   — set by IslandGenerator for auto-placed creatures/trees
  const resolvedAsset = entity.asset ?? (entity.data.asset as string | undefined);
  const isModel = !!resolvedAsset && /\.(gltf|glb)(\?|$)/i.test(resolvedAsset);

  if (isModel) {
    // Rocks get PBR texture override — Kenney GLBs are great shapes but
    // load with no/white material. PBRRockGLTF replaces every mesh material
    // with our terrain rock_diff + rock_nor + rock_arm PBR set.
    if (entity.kind === 'rock') {
      return (
        <Suspense fallback={<FallbackBox kind={entity.kind} />}>
          <PBRRockGLTF url={resolvedAsset!} />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<FallbackBox kind={entity.kind} />}>
        <GLTFEntity
          url={resolvedAsset!}
          animationOverride={entity.data.animation as string | undefined}
          tint={entity.data.tint as string | undefined}
          childIndex={entity.data.childIndex as number | undefined}
        />
      </Suspense>
    );
  }

  // Gas Geyser — small lava pool + rising smoke plume. Marks a "gas"
  // resource location for the RTS. Tinted via data.tint.
  if (entity.data.foliageStyle === 'geyser') {
    return <GasGeyser tint={entity.data.tint as string | undefined} />;
  }

  // Texture-driven foliage: opt in via data.foliageStyle === 'textured'.
  // The palette stamps this for the "Foliage Cards" / textured rock entries
  // so a placed Birch Card Tree renders as cross-quad billboards instead of
  // the legacy fluffy-blob tree.
  if (entity.data.foliageStyle === 'textured') {
    if (entity.kind === 'tree') {
      return (
        <CardTree
          leafSlug={entity.data.leaf as string | undefined}
          tint={entity.data.tint as string | undefined}
        />
      );
    }
    if (entity.kind === 'bush') {
      if (entity.data.fern) return <TexturedFern slug={entity.data.fern as string} />;
      if (entity.data.grass) return <TexturedGrass />;
      return <Sway amount={0.04}><TexturedBush slug={entity.data.leaf as string | undefined} /></Sway>;
    }
    if (entity.kind === 'flower') {
      if (entity.data.mushroom) return <TexturedMushroom slug={entity.data.mushroom as string} />;
      return <TexturedFlowerCluster slug={entity.data.flowerAtlas as string | undefined} />;
    }
    if (entity.kind === 'rock') {
      return <TexturedRock variant={(entity.data.variant as number | undefined) ?? 0} />;
    }
  }

  // ─ Prop dispatch ────────────────────────────────────────────────────
  const speciesLeaf: Record<string, string> = {
    oak: 'oak', pine: 'pine', birch: 'birch', maple: 'maple', palm: 'palm',
  };
  switch (entity.kind) {
    // ─ Trees: layered billboard leaf-card tree, species-specific shape ──────
    case 'tree': {
      const leaf = (entity.data.leaf as string | undefined)
        ?? speciesLeaf[entity.data.species as string] ?? 'normal';
      return <CardTree leafSlug={leaf} tint={entity.data.tint as string | undefined} />;
    }

    // ─ Rocks: always PBR-textured (rock_diff + rock_nor + rock_arm) ────────
    case 'rock':
      return <TexturedRock variant={(entity.data.variant as number | undefined) ?? 0} />;

    // ─ Bushes: cross-quad leaf cards (same tech as trees, bush palette) ───
    case 'bush':
      return (
        <Sway amount={0.03}>
          <TexturedBush slug={entity.data.leaf as string | undefined} />
        </Sway>
      );

    // ─ Flowers: real flower atlas textures ───────────────────────────
    case 'flower':
      if (entity.data.mushroom)
        return <TexturedMushroom slug={entity.data.mushroom as string} />;
      return <TexturedFlowerCluster slug={entity.data.flowerAtlas as string | undefined} />;

    // ─ Resource nodes ─────────────────────────────────────────────
    case 'resource_node': {
      const res = entity.data.resource as string | undefined;
      // Wood → fallen log + stump GLB (childIndex 2 = stage 3 of log-stump)
      if (res === 'wood') {
        return (
          <Suspense fallback={<FallbackBox kind={entity.kind} />}>
            <GLTFEntity url={LOG_STUMP_GLB} childIndex={2} />
          </Suspense>
        );
      }
      // Ore → PBR rock
      if (res === 'ore') return <TexturedRock variant={1} />;
      // Crystal / mineral → glowing procedural cluster (intentionally stylised
      //   for a magical resource marker — not a placeholder)
      const col = res === 'mineral_blue' ? '#4ea7ff'
                : res === 'mineral_red'  ? '#ff4d52'
                : '#7df2ff';
      return <GlowCrystal color={col} />;
    }

    // ─ Dock: real Kenney ship GLB instead of a box ──────────────────
    case 'dock':
      return (
        <Suspense fallback={<FallbackBox kind={entity.kind} />}>
          <GLTFEntity url={DOCK_GLB} />
        </Suspense>
      );

    // ─ Creatures ────────────────────────────────────────────────
    case 'creature': {
      const creatureAsset = entity.asset ?? (entity.data.asset as string | undefined);
      return (
        <CreatureBySpecies
          species={entity.data.species as string | undefined}
          state="idle"
          assetUrl={creatureAsset}
        />
      );
    }

    // ─ Editor-only markers ──────────────────────────────────────
    default: return <FallbackBox kind={entity.kind} />;
  }
}

/**
 * Pick the best clip name to auto-play.
 *
 * Per the glTF 2.0 spec, an asset's `animations[]` is just an unordered
 * array of channel/sampler bundles — there's no "default" flag. Authoring
 * tools commonly leak a bind-pose / T-Pose clip as index 0, so we'd rather
 * keyword-match an "idle" loop than blindly play `[0]`. Falls through in
 * order: explicit override → idle keyword → first non-bind clip → first.
 */
function pickClip(names: readonly string[], override?: string): string | undefined {
  if (!names.length) return undefined;
  if (override && names.includes(override)) return override;
  const lower = names.map((n) => n.toLowerCase());
  const idle = lower.findIndex((n) => /\b(idle|sway|loop|wind)\b/.test(n));
  if (idle >= 0) return names[idle];
  const nonBind = lower.findIndex((n) => !/(t.?pose|bind|rest)/.test(n));
  return names[nonBind >= 0 ? nonBind : 0];
}

function GLTFEntity({ url, animationOverride, tint, childIndex }: {
  url: string; animationOverride?: string; tint?: string; childIndex?: number;
}) {
  // `useGLTF(url, useDraco, useMeshopt)` — drei wires the Khronos Draco
  // CDN decoder + the Meshopt decoder into the underlying GLTFLoader so
  // KHR_draco_mesh_compression and EXT_meshopt_compression assets actually
  // decompress instead of throwing "Unknown extension". Color spaces
  // (sRGB baseColor + emissive, linear normal/MR/occlusion) are handled
  // automatically by GLTFLoader since three r152.
  const { scene, animations } = useGLTF(url, true, true);

  // Clone once per mounted entity, not on every render. SkeletonUtils.clone
  // preserves skinned-mesh bone bindings AND morph target influences (per
  // spec, meshes can carry POSITION/NORMAL morph targets with weights); a
  // plain scene.clone() would share the geometry and break per-entity
  // independent morphing.
  const instance = useMemo(() => {
    let cloned = SkeletonUtils.clone(scene) as THREE.Object3D;

    // childIndex support: extract Nth top-level child (same as ShowcaseGLTFModel).
    // Used by log-stump stages and any other multi-mesh pack entity.
    if (typeof childIndex === 'number') {
      let search = cloned as THREE.Group;
      if ((cloned as THREE.Group).children?.length === 1 &&
          (cloned as THREE.Group).children[0] instanceof THREE.Group) {
        search = (cloned as THREE.Group).children[0] as THREE.Group;
      }
      const child = search.children[childIndex] as THREE.Object3D | undefined;
      if (child) {
        child.parent?.remove(child);
        child.position.set(0, 0, 0);
        child.rotation.set(0, 0, 0);
        const wrap = new THREE.Group();
        wrap.add(child);
        cloned = wrap;
      }
    }

    // If a tint is provided
    // crystal pack), build a single THREE.Color and multiply the baseColor
    // of every material we encounter. Materials must be CLONED first —
    // SkeletonUtils.clone shares the original Material instances across
    // every entity, so mutating in place would tint every other crystal
    // on the map too.
    const tintColor = tint ? new THREE.Color(tint) : null;
    // De-dupe material clones across meshes that share the same source
    // material so we still benefit from material reuse on the GPU side.
    const matCache = new Map<THREE.Material, THREE.Material>();
    const cloneAndTint = (mat: THREE.Material): THREE.Material => {
      const cached = matCache.get(mat);
      if (cached) return cached;
      const c = mat.clone();
      const stdLike = c as THREE.MeshStandardMaterial;
      if (tintColor && stdLike.color && stdLike.color.isColor) {
        stdLike.color.multiply(tintColor);
      }
      matCache.set(mat, c);
      return c;
    };

    // glTF doesn't carry shadow flags — they're a renderer concern. Apply
    // sane defaults so trees/rocks/units cast and receive shadows in our
    // editor lighting setup.
    cloned.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if ((m as THREE.Object3D).type === 'Mesh' || (m as THREE.Object3D).type === 'SkinnedMesh') {
        m.castShadow = true;
        m.receiveShadow = true;
        if (tintColor) {
          if (Array.isArray(m.material)) {
            m.material = m.material.map(cloneAndTint);
          } else if (m.material) {
            m.material = cloneAndTint(m.material);
          }
        }
      }
    });
    return cloned;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, url, tint, childIndex]);

  // Bind animations to *this cloned* instance — drei's useAnimations creates
  // a new AnimationMixer attached to the ref'd group, so each entity plays
  // independently and bones stay isolated from siblings.
  const groupRef = useRef<THREE.Group>(null);
  const { actions, names } = useAnimations(animations, groupRef);
  useEffect(() => {
    const pick = pickClip(names, animationOverride);
    if (!pick) return;
    const a = actions[pick];
    a?.reset().fadeIn(0.2).play();
    return () => { a?.fadeOut(0.2); };
  }, [actions, names, animationOverride]);
  return <group ref={groupRef}><primitive object={instance} /></group>;
}

function FallbackBox({ kind }: { kind: PlacedEntity['kind'] }) {
  return (
    <mesh castShadow>
      <boxGeometry args={[1.2, 1.2, 1.2]} />
      <meshStandardMaterial color={KIND_COLOR[kind]} />
    </mesh>
  );
}

export function EntityLayer() {
  const allEntities = useEditor((s) => s.project.entities);
  const entityRev   = useEditor((s) => s.entityRev);
  const selectedId  = useEditor((s) => s.selectedId);
  const selectEntity = useEditor((s) => s.selectEntity);
  const tool         = useEditor((s) => s.tool);
  const playMode     = useEditor((s) => s.playMode);
  const updateEntityTransform = useEditor((s) => s.updateEntityTransform);
  // In Play mode the runtime layer (PlayModeCreatures) renders creatures
  // — hide the static spawn meshes so we don't double-up.
  const entities = playMode
    ? allEntities.filter((e) => e.kind !== 'creature')
    : allEntities;

  // We re-read the entity list on each render; using entityRev as a key
  // hint avoids React reusing stale group children when arrays mutate.
  void entityRev;

  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());

  // Keep group transforms in sync with state when state changes
  // externally (e.g., undo, JSON load).
  useEffect(() => {
    for (const e of entities) {
      const g = groupRefs.current.get(e.id);
      if (!g) continue;
      g.position.set(...e.position);
      g.rotation.set(...e.rotation);
      g.scale.set(...e.scale);
    }
  }, [entities, entityRev]);

  const gizmoMode: 'translate' | 'rotate' | 'scale' | null =
    tool === 'translate' ? 'translate' :
    tool === 'rotate'    ? 'rotate'    :
    tool === 'scale'     ? 'scale'     : null;

  const selectedEntity = entities.find((e) => e.id === selectedId);
  const selectedRef    = selectedEntity ? groupRefs.current.get(selectedEntity.id) : null;

  return (
    <>
      {entities.map((e) => (
        <group
          key={e.id}
          ref={(g) => {
            if (g) groupRefs.current.set(e.id, g);
            else   groupRefs.current.delete(e.id);
          }}
          position={e.position}
          rotation={e.rotation}
          scale={e.scale}
          onClick={(ev) => { ev.stopPropagation(); selectEntity(e.id); }}
        >
          <EntityBody entity={e} />
          {selectedId === e.id && <SelectionRing />}
        </group>
      ))}

      {gizmoMode && selectedEntity && selectedRef && (
        <TransformControls
          object={selectedRef}
          mode={gizmoMode}
          onObjectChange={() => {
            const g = selectedRef;
            updateEntityTransform(selectedEntity.id, {
              position: [g.position.x, g.position.y, g.position.z] as Vec3,
              rotation: [g.rotation.x, g.rotation.y, g.rotation.z] as Vec3,
              scale:    [g.scale.x,    g.scale.y,    g.scale.z]    as Vec3,
            });
          }}
        />
      )}
    </>
  );
}

function SelectionRing() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[1.0, 1.15, 48]} />
      <meshBasicMaterial color="#ffd24d" transparent opacity={0.85} />
    </mesh>
  );
}
