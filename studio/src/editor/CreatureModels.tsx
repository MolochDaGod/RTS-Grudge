/**
 * Creature rendering — two-tier dispatch.
 *
 *   1) `assetUrl` provided (the IslandGenerator stamps `data.asset` with a
 *      Kenney/Synty/Mixamo GLB URL):
 *        → GLBCreature: clones the rig, normalises to a per-species target
 *          height (TARGET_H[species]), auto-plays an idle/walk/swim/fly clip.
 *
 *   2) No assetUrl, but a `species` from CreatureRegistry (e.g. crab/bear/wolf):
 *        → AnimatedCreature: streams real animated FBX bundles from the
 *          public Grudge Studio ObjectStore (objectstore.grudge-studio.com)
 *          and crossfades clips by AI state.
 *
 *   3) Neither → render nothing. We NEVER fall back to a primitive blob.
 *
 * Both paths share the same goal: real animated meshes only.
 */
import { useMemo, useEffect, useRef, Suspense } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';
import { AnimatedCreature } from './AnimatedCreature';
import type { CreatureState } from '../runtime/ai';

// Per-species natural height (metres) used for GLB normalisation.
// The entity.scale multiplier from IslandGenerator is applied ON TOP,
// so a deer at [1.0] is exactly TARGET_H['deer'] = 1.4 m tall, etc.
const TARGET_H: Record<string, number> = {
  // land — player-relative sizes
  deer:        1.40,
  wolf:        1.00,
  buffalo:     1.70,
  ibex:        1.10,
  rabbit:      0.30,
  crab:        0.20,  // small beach crab, ~8 inches tall
  zombie:      1.80,
  velociraptor:1.40,
  bear:        1.80,
  tortoise:    0.60,
  raptor:      1.40,
  // air
  hawk:        0.55,
  harpy:       1.60,
  hummingbird: 0.12,
  dragon:      3.00,
  // water — length used as the normalisation axis since fish are horizontal
  shark:       4.50,
  crocodile:   3.00,
  clownfish:   0.15,
  'blue-tang': 0.20,
  lionfish:    0.28,
  tuna:        0.90,
  swordfish:   1.20,
  puffer:      0.22,
  'parrot-fish':0.30,
  anglerfish:  0.35,
  piranha:     0.28,
  betta:       0.10,
  goldfish:    0.12,
  'blue-goldfish':0.12,
  'cardinal-fish':0.08,
  'mandarin-fish':0.10,
};
const DEFAULT_H = 1.80;

function GLBCreature({ url, species }: { url: string; species?: string }) {
  const { scene, animations } = useGLTF(url, true, true);

  const instance = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);
    cloned.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; }
    });

    // Normalise to a species-appropriate height so the entity scale
    // from IslandGenerator acts as a clean multiplier.
    const targetH = (species ? (TARGET_H[species] ?? DEFAULT_H) : DEFAULT_H);
    const box = new THREE.Box3().setFromObject(cloned);
    const h   = box.getSize(new THREE.Vector3()).y;
    if (h > 0) cloned.scale.setScalar(targetH / h);
    const box2 = new THREE.Box3().setFromObject(cloned);
    cloned.position.y -= box2.min.y;

    return cloned;
  }, [scene, species]);

  const groupRef = useRef<THREE.Group>(null);
  const { actions, names } = useAnimations(animations, groupRef);

  useEffect(() => {
    const pick =
      names.find(n => /\b(idle|swim|walk|fly|float|run|move)\b/i.test(n)) ??
      names[0];
    if (!pick) return;
    const a = actions[pick];
    a?.reset().fadeIn(0.2).play();
    return () => { a?.fadeOut(0.2); };
  }, [actions, names]);

  return <group ref={groupRef}><primitive object={instance} /></group>;
}

/**
 * CreatureBySpecies — public API used by EntityLayer (edit mode) and by
 * PlayMode (creature AI clones). Three-way dispatch:
 *
 *   - If `assetUrl` is set → render the bound GLB via GLBCreature.
 *   - Else if `species` matches a CreatureRegistry entry → AnimatedCreature.
 *   - Else → render nothing (NO primitive fallback).
 */
export function CreatureBySpecies({
  species,
  state,
  assetUrl,
}: {
  species?: string;
  state?:   CreatureState;
  assetUrl?: string;
}) {
  if (assetUrl) {
    return (
      <Suspense fallback={null}>
        <GLBCreature url={assetUrl} species={species} />
      </Suspense>
    );
  }
  if (!species) return null;
  return <AnimatedCreature species={species} state={state} />;
}

export { AnimatedCreature };
