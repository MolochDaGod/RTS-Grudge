/**
 * PlayerCharacter — third-person avatar mesh + animation mixer.
 *
 * Driven entirely by the play slice (see `editor/store-slices.ts:PlaySlice`).
 * The component mounts as a child of the player root <group> placed by
 * PlayerController; this component is "dumb" rendering — it owns no
 * position state of its own beyond the FBX→metre scale.
 *
 * Loading rules mirror AnimatedCreature:
 *   - merged GLB/FBX → `loadGlb` / `loadFbxBase`, native clip names
 *   - split base+@anim FBX → `loadAnimatedFbx`, clips renamed to states
 *   - load failure → render nothing (NEVER a primitive fallback)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import {
  loadAnimatedFbx,
  loadFbxBase,
  loadGlb,
} from '../library/ObjectStoreClient';
import {
  getPlayerCharacterSpec,
  type PlayerCharacterSpec,
} from '../library/PlayerCharacterRegistry';
import type { LocomotionState } from '../editor/store';
import { stripUnarmedEquipment } from '../lib/raceEquipment';

interface Bundle {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

const bundleCache = new Map<string, Promise<Bundle>>();

function getBundle(spec: PlayerCharacterSpec): Promise<Bundle> {
  // Include clip map so adding swim/tread clips busts the cache correctly.
  const key = spec.layout === 'split'
    ? `${spec.baseKey}|${JSON.stringify(spec.splitClips ?? {})}`
    : spec.baseKey;
  let p = bundleCache.get(key);
  if (p) return p;

  if (spec.layout === 'split') {
    const clips: Record<string, string> = {};
    for (const [k, v] of Object.entries(spec.splitClips ?? {})) {
      if (v) clips[k] = v;
    }
    p = loadAnimatedFbx(spec.baseKey, clips);
  } else if (spec.baseKey.toLowerCase().endsWith('.glb') ||
             spec.baseKey.toLowerCase().endsWith('.gltf')) {
    p = loadGlb(spec.baseKey).then(({ scene, animations }) => ({ scene, animations }));
  } else {
    // Merged FBX (e.g. tortoise-style) — animations live inside the base.
    p = loadFbxBase(spec.baseKey).then((scene) => ({
      scene,
      animations: scene.animations,
    }));
  }
  bundleCache.set(key, p);
  return p;
}

/**
 * Lookup an animation clip by intent. Tries the spec's explicit name first
 * (whether merged literal or stitched-split state name), then falls back
 * to keyword matching on `idle`/`stand`/`walk`/`run`/`loop`.
 */
function pickClip(
  clips: THREE.AnimationClip[],
  spec: PlayerCharacterSpec,
  state: LocomotionState,
): THREE.AnimationClip | undefined {
  if (!clips.length) return undefined;
  const lower = clips.map((c) => c.name.toLowerCase());

  // 1) Explicit spec mapping (merged clip name OR stitched-split state name).
  const explicit =
    spec.layout === 'split'
      ? state // split clips are already renamed to state by loadAnimatedFbx
      : spec.mergedClipNames?.[state];
  if (explicit) {
    const i = lower.indexOf(explicit.toLowerCase());
    if (i >= 0) return clips[i];
  }

  // 2) Keyword fallback.
  const keywords =
    state === 'idle'         ? ['idle', 'stand', 'loop'] :
    state === 'walk'         ? ['walk', 'move', 'jog']    :
    state === 'run'          ? ['run', 'sprint', 'walk', 'move'] :
    state === 'attack'       ? ['attack', 'swing', 'cast'] :
    state === 'swim'         ? ['swim', 'swimming'] :
    state === 'tread'        ? ['tread', 'treading', 'float', 'swim_idle', 'idle'] :
    state === 'swim_to_edge' ? ['edge', 'swim_to', 'climb', 'exit', 'swim'] :
    state === 'climb'        ? ['climb', 'climbing', 'ladder'] :
    state === 'climb_idle'   ? ['climb_idle', 'hang', 'idle', 'climb'] :
    state === 'climb_down'   ? ['climb_down', 'climb', 'climbing', 'ladder'] :
    state === 'climb_shimmy' ? ['shimmy', 'climb', 'climbing'] :
    state === 'climb_topout' ? ['topout', 'top_out', 'climb', 'pull'] :
    [state];
  for (const kw of keywords) {
    const i = lower.findIndex((n) => n.includes(kw));
    if (i >= 0) return clips[i];
  }

  // 3) First non-bind clip / first clip.
  const nonBind = lower.findIndex((n) => !/(t.?pose|bind|rest)/.test(n));
  return clips[nonBind >= 0 ? nonBind : 0];
}

export function PlayerCharacter({
  characterId,
  state,
}: {
  characterId: string;
  state: LocomotionState;
}) {
  const spec = getPlayerCharacterSpec(characterId);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!spec) {
      // eslint-disable-next-line no-console
      console.warn(`[PlayerCharacter] Unknown id "${characterId}" \u2014 nothing rendered`);
      return;
    }
    let alive = true;
    setErrored(false);
    getBundle(spec)
      .then((b) => { if (alive) setBundle(b); })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`[PlayerCharacter] failed "${characterId}":`, err);
        if (alive) setErrored(true);
      });
    return () => { alive = false; };
  }, [spec, characterId]);

  const cloned = useMemo(() => {
    if (!bundle || !spec) return null;
    const inst = SkeletonUtils.clone(bundle.scene);
    if (spec.unarmed) stripUnarmedEquipment(inst);
    return inst;
  }, [bundle, spec]);

  const mixer = useMemo(
    () => (cloned ? new THREE.AnimationMixer(cloned) : null),
    [cloned],
  );
  const currentAction = useRef<THREE.AnimationAction | null>(null);

  // Drive locomotion clip from `state`, with a quick crossfade.
  useEffect(() => {
    if (!mixer || !bundle || !cloned || !spec) return;
    const clip = pickClip(bundle.animations, spec, state);
    if (!clip) return;
    const next = mixer.clipAction(clip, cloned);
    // Playback rate / direction per locomotion intent
    next.timeScale =
      state === 'run'        ? 1.2  :
      state === 'climb_down' ? -1.0 : // reverse climb clip for descent
      state === 'climb'      ? 1.05 :
      state === 'climb_shimmy'? 0.85 :
      state === 'climb_idle' ? 0.35 : // slow hang
      1.0;
    next.reset();
    // Reversed clips need to start at the end
    if (next.timeScale < 0) next.time = clip.duration;
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.fadeIn(0.18);
    next.play();
    if (currentAction.current && currentAction.current !== next) {
      currentAction.current.fadeOut(0.18);
    }
    currentAction.current = next;
    return () => { next.fadeOut(0.18); };
  }, [mixer, bundle, cloned, spec, state]);

  useFrame((_, dt) => {
    if (mixer) mixer.update(dt);
  });

  // Apply shadow flags once on mount.
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

  if (!spec || errored || !cloned) return null;

  return (
    <group scale={spec.defaultScale} position={[0, spec.yOffset, 0]}>
      <primitive object={cloned} />
    </group>
  );
}
