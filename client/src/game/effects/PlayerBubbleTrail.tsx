import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { isInWater, WATER_SURFACE_Y } from "./WaterVolume";

/**
 * A small ring of bubble particles that follows the player while
 * submerged. Each bubble has a random horizontal jitter and a slow
 * upward drift; once it pops above the surface it's recycled back
 * down near the player. When the player is not in water the whole
 * Points object is hidden so it costs nothing.
 *
 * Visually this complements the in-shader bubbles (which are tied to
 * screen-space and don't track the player) — these come from the
 * player's own body and confirm to the user that they're submerged.
 */
const BUBBLE_COUNT = 36;
const SPAWN_RADIUS = 0.45; // m around the player
const RISE_SPEED = 0.55;   // m/s upward

export default function PlayerBubbleTrail({
  playerPosRef,
}: {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}) {
  const pointsRef = useRef<THREE.Points>(null);

  // Per-particle horizontal offset + vertical phase. Computed once so
  // the trail looks stable rather than re-shuffling every frame.
  const offsets = useMemo(() => {
    const arr: { dx: number; dz: number; phase: number; speed: number }[] = [];
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * SPAWN_RADIUS;
      arr.push({
        dx: Math.cos(a) * r,
        dz: Math.sin(a) * r,
        phase: Math.random(),
        speed: RISE_SPEED * (0.7 + Math.random() * 0.6),
      });
    }
    return arr;
  }, []);

  // Initial buffer — written every frame anyway, just needs the right shape.
  const positions = useMemo(() => new Float32Array(BUBBLE_COUNT * 3), []);

  useFrame((state) => {
    const points = pointsRef.current;
    if (!points) return;

    const px = playerPosRef.current.x;
    const py = playerPosRef.current.y;
    const pz = playerPosRef.current.z;
    const submerged = isInWater(py);
    points.visible = submerged;
    if (!submerged) return;

    const t = state.clock.elapsedTime;
    const geo = points.geometry as THREE.BufferGeometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    // Cap how high a bubble can rise above the player so we don't
    // breach the surface — bubbles popping out into the air look broken.
    // 0.05 of leeway under the surface keeps them strictly submerged.
    const ceilingY = WATER_SURFACE_Y - 0.05;

    for (let i = 0; i < BUBBLE_COUNT; i++) {
      const o = offsets[i];
      // Each bubble's vertical position cycles through a column up to
      // 1.5 m tall, but we shorten that column when the player is near
      // the surface so the trail stays under water.
      const maxRise = Math.max(0, ceilingY - (py + 0.2));
      const column = Math.min(1.5, maxRise);
      const cycle = ((t * o.speed * 0.4) + o.phase) % 1.0;
      const dy = cycle * column;

      arr[i * 3 + 0] = px + o.dx;
      arr[i * 3 + 1] = py + 0.2 + dy;
      arr[i * 3 + 2] = pz + o.dz;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={BUBBLE_COUNT}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        sizeAttenuation
        color="#cfeefb"
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </points>
  );
}
