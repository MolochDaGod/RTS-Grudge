import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Lifetime (seconds) of a single dust puff. Picked short enough to feel
 * like an immediate footstep cue but long enough that the player can
 * register it from the corner of their eye.
 */
export const STREAM_CUE_LIFETIME_S = 0.7;
/**
 * How long the puff takes to fade in. The remaining lifetime is spent
 * fading out, so the puff peaks just after it spawns and then drifts
 * away.
 */
const STREAM_CUE_RISE_S = 0.15;

/** One particle's polar offset around the cue centre. */
interface PuffOffset {
  ax: number;
  az: number;
  /** Per-particle drift radius, in metres at age=1.0. */
  radius: number;
}

const PUFF_PARTICLES = 5;
const PUFF_MAX_RADIUS_M = 0.55;
/** How far above the spawn point the puff rises by the end of its life. */
const PUFF_RISE_M = 0.35;
/** Peak alpha of the dust. Subtle on purpose. */
const PUFF_PEAK_ALPHA = 0.42;

export interface StreamDustCue {
  /** Stable id used as the React key so each puff renders independently. */
  id: number;
  /** World-space spawn position (typically the player's foot). */
  x: number;
  y: number;
  z: number;
  /** `useFrame` clock time at which the cue was emitted. */
  startTime: number;
}

/**
 * A small expanding ring of sand-coloured dust used to mark the moment
 * a freshly-streamed island terrain mesh becomes active under the
 * player. Each puff is cheap (5 low-poly spheres sharing one material)
 * and lives `STREAM_CUE_LIFETIME_S`, after which the parent removes
 * it via `onCueExpired`.
 */
function DustPuff({
  cue,
  onExpired,
}: {
  cue: StreamDustCue;
  onExpired: (id: number) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Per-particle radial offsets — computed once per cue so the puff
  // looks stable rather than re-shuffling each frame.
  const offsets = useMemo<PuffOffset[]>(() => {
    const arr: PuffOffset[] = [];
    // Stagger particle angles around the circle, with a small random
    // jitter so two adjacent cues don't look identical.
    const baseJitter = Math.random() * Math.PI * 2;
    for (let i = 0; i < PUFF_PARTICLES; i++) {
      const a = baseJitter + (i / PUFF_PARTICLES) * Math.PI * 2;
      arr.push({
        ax: Math.cos(a),
        az: Math.sin(a),
        radius: PUFF_MAX_RADIUS_M * (0.7 + Math.random() * 0.5),
      });
    }
    return arr;
  }, []);

  // Single shared material so the parent can fade the whole puff with
  // one opacity write per frame instead of one per particle.
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#d8c39a",
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  // Single shared low-poly sphere geometry — also disposed with the puff.
  const geometry = useMemo(
    () => new THREE.SphereGeometry(0.16, 8, 6),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  const expiredRef = useRef(false);

  useFrame((state) => {
    const grp = groupRef.current;
    if (!grp) return;
    const age = state.clock.elapsedTime - cue.startTime;
    if (age >= STREAM_CUE_LIFETIME_S) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        onExpired(cue.id);
      }
      return;
    }
    const t = age / STREAM_CUE_LIFETIME_S; // 0..1
    // Particles drift outward and rise gently as the puff ages.
    for (let i = 0; i < grp.children.length; i++) {
      const o = offsets[i];
      const child = grp.children[i];
      const r = o.radius * t;
      child.position.set(o.ax * r, PUFF_RISE_M * t, o.az * r);
      child.scale.setScalar(0.7 + 0.6 * t);
    }
    // Quick rise then long fade. Multiplied by the peak alpha so the
    // puff stays subtle even at its brightest frame.
    const fade =
      age <= STREAM_CUE_RISE_S
        ? age / STREAM_CUE_RISE_S
        : Math.max(
            0,
            1 - (age - STREAM_CUE_RISE_S) / (STREAM_CUE_LIFETIME_S - STREAM_CUE_RISE_S),
          );
    material.opacity = PUFF_PEAK_ALPHA * fade;
  });

  return (
    <group ref={groupRef} position={[cue.x, cue.y, cue.z]}>
      {offsets.map((_, i) => (
        <mesh key={i} material={material} geometry={geometry} />
      ))}
    </group>
  );
}

/**
 * Renders a list of currently-active stream dust cues. Each cue calls
 * back into `onCueExpired` when its puff finishes, giving the parent
 * a chance to drop the cue from its state and free the React subtree.
 */
export default function TerrainStreamDustCues({
  cues,
  onCueExpired,
}: {
  cues: StreamDustCue[];
  onCueExpired: (id: number) => void;
}) {
  return (
    <>
      {cues.map((cue) => (
        <DustPuff key={cue.id} cue={cue} onExpired={onCueExpired} />
      ))}
    </>
  );
}
