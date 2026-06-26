/**
 * Play Mode runtime — toggled from the toolbar.
 *
 * Two responsibilities:
 *   1. Mount the third-person <Player /> avatar + camera composite.
 *   2. Tick the creature AI, using the *player* (not the camera) as the
 *      threat target so flee/attack reads make sense regardless of where
 *      the user is looking.
 *
 * Edit Mode shows the creatures as static spawn meshes via the editor's
 * EntityLayer. Play mode hides those and renders ticked-by-AI clones here
 * (the EntityLayer already filters them out when `playMode === true`).
 *
 * Per-creature rendering supports either a baked GLB asset (e.g. the
 * Kenney/Synty/Mixamo packs the IslandGenerator stamps onto creatures) or
 * a registry-backed AnimatedCreature; both go through `<CreatureBySpecies>`
 * which does the GLB-vs-registry dispatch.
 */
import { useMemo, useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Html } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';
import { useEditor } from '../editor/store';
import { sampleHeight } from '../editor/terrain-utils';
import { CreatureBySpecies } from '../editor/CreatureModels';
import { fromEntity, tickCreatures, type CreatureRuntime } from './ai';
import { buildNavGraph } from './islandNavGraph';
import { Player } from './Player';

/**
 * GLB-backed creature for play mode — separate from the edit-mode
 * GLBCreature in CreatureModels because here we don't normalise height
 * (the AI tick already places things correctly).
 */
function GLBCreature({ url }: { url: string }) {
  const { scene, animations } = useGLTF(url, true, true);
  const instance = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const groupRef = useRef<THREE.Group>(null);
  const { actions, names } = useAnimations(animations, groupRef);
  useMemo(() => {
    const pick = names.find(n => /idle|swim|walk|fly|float/i.test(n)) ?? names[0];
    if (pick && actions[pick]) actions[pick]?.reset().fadeIn(0.2).play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(names)]);
  instance.traverse(obj => {
    const m = obj as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; }
  });
  return <group ref={groupRef}><primitive object={instance} /></group>;
}

// Debug overlay toggle — flipped from the Play HUD so we can see AI states.
export let showDebugOverlay = false;
export function setDebugOverlay(v: boolean) { showDebugOverlay = v; }

/** Live creature world positions — updated each frame for grass bending. */
export const liveCreaturePositions: THREE.Vector3[] = [];

export function PlayModeCreatures() {
  const playMode  = useEditor((s) => s.playMode);
  const entities  = useEditor((s) => s.project.entities);
  const entityRev = useEditor((s) => s.entityRev);
  const terrain   = useEditor((s) => s.project.terrain);

  // Snapshot creature entities into runtime structs whenever play mode
  // (re)starts or the entity list changes. We deliberately don't re-run on
  // every edit so the user can sculpt without resetting AI mid-play.
  const creatures = useMemo<CreatureRuntime[]>(() => {
    if (!playMode) return [];
    return entities.filter((e) => e.kind === 'creature').map(fromEntity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playMode, entityRev]);

  const navGraph = useMemo(
    () => (playMode ? buildNavGraph(entities) : []),
    [playMode, entities, entityRev],
  );

  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
  const threatRef = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    if (!playMode || creatures.length === 0) return;
    // Threat = the live player position (driven by the third-person
    // controller in <Player />). Falls back to (0,0,0) before the
    // controller has produced its first frame.
    const p = useEditor.getState().player.position;
    threatRef.current.set(p[0], p[1] + 1.5, p[2]);
    tickCreatures(creatures, Math.min(dt, 0.05), {
      threat: threatRef.current,
      groundAt: (x, z) => sampleHeight(x, z, terrain),
      creatures,
      navGraph,
    });
    liveCreaturePositions.length = 0;
    for (const c of creatures) {
      const g = groupRefs.current.get(c.id);
      if (!g) continue;
      g.position.set(c.pos.x, c.pos.y, c.pos.z);
      g.rotation.y = c.yaw;
      if (c.pos.y > -0.5) liveCreaturePositions.push(c.pos.clone());
    }
  });

  if (!playMode) return null;

  return (
    <group>
      {creatures.map((c) => (
        <group
          key={c.id}
          ref={(g) => {
            if (g) groupRefs.current.set(c.id, g);
            else   groupRefs.current.delete(c.id);
          }}
          position={[c.pos.x, c.pos.y, c.pos.z]}
          rotation={[0, c.yaw, 0]}
        >
          {c.asset ? (
            <Suspense fallback={null}>
              <GLBCreature url={c.asset} />
            </Suspense>
          ) : (
            <CreatureBySpecies
              species={c.species}
              state={
                c.state === 'idle' ? 'idle' :
                c.state === 'flee' ? 'flee' :
                'wander'
              }
            />
          )}

          {/* Debug state badge — toggle with the DEBUG button in PlayHud. */}
          {showDebugOverlay && (
            <Html
              position={[0, 2.4, 0]}
              center
              occlude={false}
              distanceFactor={20}
              style={{ pointerEvents: 'none' }}
            >
              <div style={{
                background: 'rgba(0,0,0,0.75)',
                color: c.isPredator ? '#ff6644' : '#88ddff',
                fontFamily: 'monospace',
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 3,
                whiteSpace: 'nowrap',
                border: `1px solid ${c.isPredator ? '#ff444444' : '#44aaff44'}`,
              }}>
                {c.species} · {c.debugState}
              </div>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
}

/**
 * Composite the user mounts in EditorCanvas. Bundles:
 *   - the player avatar + camera + input
 *   - the creature AI tick & meshes
 * Only renders when `playMode === true`.
 */
export function PlayModeRoot() {
  const playMode = useEditor((s) => s.playMode);
  if (!playMode) return null;
  return (
    <>
      <Player />
      <PlayModeCreatures />
    </>
  );
}
