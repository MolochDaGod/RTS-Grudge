/**
 * AnimatedCreature — replaces the old primitive Deer/Rabbit/Bird/Crab meshes.
 *
 * Loads a real animated FBX from the Grudge Studio ObjectStore (via
 * `ObjectStoreClient.loadAnimatedFbx` for split packs or `loadFbxBase` for
 * merged packs), clones the rig per-instance with SkeletonUtils, and runs
 * an AnimationMixer that crossfades between clips when the AI state changes.
 *
 * Hard rule: NO procedural primitive fallback. If a model fails to load
 * we log and render nothing — primitive blob creatures should never ship
 * to users again.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import {
  loadAnimatedFbx,
  loadFbxBase,
} from '../library/ObjectStoreClient';
import {
  getCreatureSpec,
  type CreatureSpec,
} from '../library/CreatureRegistry';
import type { CreatureState } from '../runtime/ai';

interface Props {
  species: string;
  state?: CreatureState;
}

interface LoadedBundle {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

// Module-level promise cache so multiple <AnimatedCreature> instances of the
// same species don't trigger duplicate ObjectStore requests. We dedupe at
// the loader level too, but caching the awaited bundle here also lets us
// share the resolved value synchronously across re-renders.
const bundleCache = new Map<string, Promise<LoadedBundle>>();

function getBundle(spec: CreatureSpec): Promise<LoadedBundle> {
  const key = spec.baseKey;
  let p = bundleCache.get(key);
  if (p) return p;

  if (spec.layout === 'split') {
    // Drop undefined entries — user might omit some clips for a barebones spec.
    const clips: Record<string, string> = {};
    for (const [k, v] of Object.entries(spec.splitClips ?? {})) {
      if (v) clips[k] = v;
    }
    p = loadAnimatedFbx(spec.baseKey, clips);
  } else {
    // Merged pack: clips are inside the base FBX. We just hand the loaded
    // group + its native animations array straight through.
    p = loadFbxBase(spec.baseKey).then((scene) => ({
      scene,
      animations: scene.animations,
    }));
  }
  bundleCache.set(key, p);
  return p;
}

/**
 * Same heuristic the GLTFEntity loader uses: prefer a clip whose name
 * matches the desired state, then keyword-match an "idle"/"loop" clip,
 * then fall back to any non-bind clip, then index 0.
 */
function pickClip(
  clips: THREE.AnimationClip[],
  target: string,
): THREE.AnimationClip | undefined {
  if (!clips.length) return undefined;
  const lower = clips.map((c) => c.name.toLowerCase());
  const exact = lower.indexOf(target.toLowerCase());
  if (exact >= 0) return clips[exact];
  const fallbackKeywords =
    target === 'idle'   ? ['idle', 'stand', 'loop'] :
    target === 'wander' ? ['walk', 'run', 'move']    :
    target === 'flee'   ? ['run', 'walk']            :
    [target];
  for (const kw of fallbackKeywords) {
    const i = lower.findIndex((n) => n.includes(kw));
    if (i >= 0) return clips[i];
  }
  const nonBind = lower.findIndex((n) => !/(t.?pose|bind|rest)/.test(n));
  return clips[nonBind >= 0 ? nonBind : 0];
}

export function AnimatedCreature({ species, state = 'wander' }: Props) {
  const spec = getCreatureSpec(species);
  const [bundle, setBundle] = useState<LoadedBundle | null>(null);
  const [errored, setErrored] = useState(false);

  // Kick off the load (or retrieve cached) on mount / species change.
  useEffect(() => {
    if (!spec) {
      // eslint-disable-next-line no-console
      console.warn(`[AnimatedCreature] Unknown species "${species}" — nothing rendered`);
      return;
    }
    let alive = true;
    setErrored(false);
    getBundle(spec)
      .then((b) => { if (alive) setBundle(b); })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`[AnimatedCreature] failed to load "${species}" from ObjectStore:`, err);
        if (alive) setErrored(true);
      });
    return () => { alive = false; };
  }, [spec, species]);

  // Per-instance clone of the rig + a fresh AnimationMixer driving it.
  const cloned = useMemo(() => {
    if (!bundle || !spec) return null;
    return SkeletonUtils.clone(bundle.scene);
  }, [bundle, spec]);

  const mixer = useMemo(
    () => (cloned ? new THREE.AnimationMixer(cloned) : null),
    [cloned],
  );

  const groupRef = useRef<THREE.Group>(null);
  const currentAction = useRef<THREE.AnimationAction | null>(null);

  // When `state` flips (idle → wander, wander → flee), crossfade to the
  // matching clip. We crank `flee` to 1.4× timeScale so reusing a single
  // walk anim still reads as urgency.
  useEffect(() => {
    if (!mixer || !bundle || !cloned) return;
    const clip = pickClip(bundle.animations, state);
    if (!clip) return;
    const next = mixer.clipAction(clip, cloned);
    next.timeScale = state === 'flee' ? 1.4 : 1;
    next.reset();
    next.fadeIn(0.25);
    next.play();
    if (currentAction.current && currentAction.current !== next) {
      currentAction.current.fadeOut(0.25);
    }
    currentAction.current = next;
    return () => { next.fadeOut(0.25); };
  }, [mixer, bundle, cloned, state]);

  // Drive the mixer.
  useFrame((_, dt) => {
    if (mixer) mixer.update(dt);
  });

  // Apply shadow casting and clean up the cloned skeleton's pivot.
  useEffect(() => {
    if (!cloned) return;
    cloned.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.type === 'Mesh' || m.type === 'SkinnedMesh') {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }, [cloned]);

  if (!spec) return null;
  if (errored) return null;
  if (!cloned) return null; // suspending — show nothing rather than a primitive

  return (
    <group ref={groupRef} scale={spec.defaultScale} position={[0, spec.yOffset, 0]}>
      <primitive object={cloned} />
    </group>
  );
}

/**
 * Drop-in replacement for the old CreatureBySpecies switch — kept here so
 * EntityLayer / PlayMode imports don't have to change. Any unknown species
 * renders nothing (with a console warning) per "no primitives ever" rule.
 */
export function CreatureBySpecies({
  species,
  state,
}: {
  species?: string;
  state?: CreatureState;
}) {
  if (!species) return null;
  return <AnimatedCreature species={species} state={state} />;
}
