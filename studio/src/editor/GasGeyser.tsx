/**
 * Gas Geyser — procedural resource node for "gas" deposits.
 *
 * Visual: a small dark-stone rim cup, a hot lava disc inside (emissive
 * glow), and a vertical column of soft smoke billboards drifting up and
 * fading out using the attached `smoke_*.png` puff texture. Designed to
 * read as an RTS resource location at any zoom — the silhouette plus the
 * orange under-glow are the legible bits even when the camera is far.
 *
 * The smoke uses additive-ish billboards (transparent + depthWrite off)
 * so they never punch holes in the depth buffer and never z-fight with
 * each other. Per-puff state is kept in a ref array so React doesn't
 * re-render every frame — only the GPU does.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FoliageTextures } from '../library/FoliageTextures';

interface PuffState {
  age: number;     // seconds since spawn
  life: number;    // total lifespan in seconds
  speed: number;   // upward m/s
  drift: [number, number]; // x/z wander (m/s)
  spin: number;    // billboard roll rate (rad/s)
  scale0: number;  // start scale
  scale1: number;  // end scale
}

const PUFF_COUNT = 12;

function makePuff(rng: () => number): PuffState {
  return {
    age: rng() * 1.6,                 // pre-stagger so plume isn't pulsy on mount
    life: 1.6 + rng() * 1.2,
    speed: 0.55 + rng() * 0.35,
    drift: [(rng() - 0.5) * 0.18, (rng() - 0.5) * 0.18],
    spin: (rng() - 0.5) * 0.6,
    scale0: 0.55 + rng() * 0.25,
    scale1: 1.6 + rng() * 0.6,
  };
}

export function GasGeyser({ tint = '#ff7733' }: { tint?: string }) {
  const smokeTex = FoliageTextures.smoke();

  // Stable PRNG so each mounted geyser keeps consistent puff timings
  // across re-renders (mulberry32 seeded with a per-mount random).
  const rng = useMemo(() => {
    let s = (Math.random() * 2 ** 31) | 0;
    return () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, []);

  const puffs = useRef<PuffState[]>([]);
  if (puffs.current.length === 0) {
    puffs.current = Array.from({ length: PUFF_COUNT }, () => makePuff(rng));
  }

  // One ref per sprite so we can mutate transform/opacity directly
  const spriteRefs = useRef<Array<THREE.Sprite | null>>([]);

  // Materials — created once. SpriteMaterial honours rotation, transparent
  // alpha, depthWrite off (puffs blend cleanly with each other and the
  // lava glow underneath without stealing depth).
  const spriteMats = useMemo(() => {
    return puffs.current.map(() => new THREE.SpriteMaterial({
      map: smokeTex ?? undefined,
      color: 0xbfbfbf,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    }));
  }, [smokeTex]);

  useFrame((_state, dt) => {
    const dts = Math.min(dt, 0.05); // clamp dt so a stutter doesn't teleport puffs
    for (let i = 0; i < puffs.current.length; i++) {
      const p = puffs.current[i]!;
      const sprite = spriteRefs.current[i];
      if (!sprite) continue;
      p.age += dts;
      if (p.age >= p.life) {
        // recycle puff at the geyser mouth
        const fresh = makePuff(rng);
        fresh.age = 0;
        puffs.current[i] = fresh;
        sprite.position.set(0, 0.25, 0);
        sprite.material.rotation = rng() * Math.PI * 2;
        continue;
      }
      const t = p.age / p.life;        // 0 → 1
      sprite.position.x += p.drift[0] * dts;
      sprite.position.y += p.speed * dts;
      sprite.position.z += p.drift[1] * dts;
      const s = p.scale0 + (p.scale1 - p.scale0) * t;
      sprite.scale.set(s, s, 1);
      sprite.material.rotation += p.spin * dts;
      // Bell-curve opacity: rises in, holds, fades out
      const alpha = Math.sin(Math.PI * t) * 0.55;
      sprite.material.opacity = alpha;
    }
  });

  // Emissive lava colour as a THREE.Color so we can set both color and
  // emissive on the disc material with one source of truth.
  const lavaColor = useMemo(() => new THREE.Color(tint), [tint]);

  return (
    <group>
      {/* Stone rim — short low-poly cylinder, dark and matte. */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 1.15, 0.24, 16]} />
        <meshStandardMaterial color="#2c2826" roughness={0.95} metalness={0.05} />
      </mesh>
      {/* Inner lip — shadow side */}
      <mesh position={[0, 0.22, 0]}>
        <torusGeometry args={[0.78, 0.08, 8, 24]} />
        <meshStandardMaterial color="#1a1715" roughness={1} />
      </mesh>
      {/* Lava disc — emissive so it glows even in shade. */}
      <mesh position={[0, 0.235, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.78, 24]} />
        <meshStandardMaterial
          color={lavaColor}
          emissive={lavaColor}
          emissiveIntensity={1.4}
          roughness={0.6}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      {/* Soft warm point light — sells the "hot pool" read at distance. */}
      <pointLight color={tint} intensity={1.4} distance={6} decay={2} position={[0, 0.6, 0]} />

      {/* Smoke plume */}
      {puffs.current.map((_, i) => (
        <sprite
          key={i}
          ref={(s) => { spriteRefs.current[i] = s; }}
          material={spriteMats[i]}
          position={[0, 0.25, 0]}
        />
      ))}
    </group>
  );
}
