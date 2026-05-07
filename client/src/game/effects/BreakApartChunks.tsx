import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Lightweight "shatter" effect for harvested resource nodes.
 *
 * Instead of nodes vanishing instantly when the player mines them, callers
 * fire `spawnBreakApart()` at the node's world position and a short-lived
 * burst of textured chunks tumbles outward, falls under gravity, and fades
 * away. The system is module-local (no Zustand needed) and the renderer
 * component only has to be mounted once anywhere inside the R3F scene.
 */

type Chunk = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  rotVel: THREE.Vector3;
  size: number;
};

type Burst = {
  id: string;
  origin: [number, number, number];
  color: string;
  startedAt: number;
  chunks: Chunk[];
};

const LIFETIME_MS = 1800;
const GRAVITY = 18;

const activeBursts = new Map<string, Burst>();
const subscribers = new Set<() => void>();
let burstCounter = 0;

function notify() {
  subscribers.forEach((fn) => fn());
}

export function spawnBreakApart(
  pos: [number, number, number],
  color: string,
  count = 8,
  scale = 1,
) {
  const id = `burst-${burstCounter++}`;
  const chunks: Chunk[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 2 + Math.random() * 4;
    chunks.push({
      pos: new THREE.Vector3(
        pos[0] + (Math.random() - 0.5) * 0.5,
        pos[1] + 0.4 + Math.random() * 0.4,
        pos[2] + (Math.random() - 0.5) * 0.5,
      ),
      vel: new THREE.Vector3(
        Math.cos(angle) * speed,
        4 + Math.random() * 3,
        Math.sin(angle) * speed,
      ),
      rot: new THREE.Euler(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      ),
      rotVel: new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
      ),
      size: (0.18 + Math.random() * 0.28) * scale,
    });
  }
  activeBursts.set(id, {
    id,
    origin: pos,
    color,
    startedAt: performance.now(),
    chunks,
  });
  notify();
}

export default function BreakApartChunks() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const fn = () => setTick((t) => (t + 1) % 1_000_000);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
      // If this is the last subscriber unmounting (e.g. leaving the
      // tutorial island), drop any in-flight bursts so a stale chunk
      // doesn't reappear when the renderer is mounted again later.
      if (subscribers.size === 0) {
        activeBursts.clear();
      }
    };
  }, []);

  return (
    <>
      {Array.from(activeBursts.values()).map((burst) => (
        <BurstGroup key={burst.id} burst={burst} />
      ))}
    </>
  );
}

function BurstGroup({ burst }: { burst: Burst }) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const matRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const cleanedUp = useRef(false);

  useFrame((_, delta) => {
    if (cleanedUp.current) return;
    const elapsed = performance.now() - burst.startedAt;
    const lifeFrac = Math.min(1, elapsed / LIFETIME_MS);
    if (lifeFrac >= 1) {
      cleanedUp.current = true;
      activeBursts.delete(burst.id);
      // Notify outside the frame to avoid setState-in-render warnings
      queueMicrotask(notify);
      return;
    }
    const opacity = 1 - lifeFrac;
    const restY = burst.origin[1] - 0.2;
    const dt = Math.min(delta, 0.05);

    for (let i = 0; i < burst.chunks.length; i++) {
      const c = burst.chunks[i];
      c.vel.y -= GRAVITY * dt;
      c.pos.x += c.vel.x * dt;
      c.pos.y += c.vel.y * dt;
      c.pos.z += c.vel.z * dt;
      if (c.pos.y < restY) {
        c.pos.y = restY;
        c.vel.y *= -0.25;
        c.vel.x *= 0.55;
        c.vel.z *= 0.55;
        c.rotVel.multiplyScalar(0.6);
      }
      c.rot.x += c.rotVel.x * dt;
      c.rot.y += c.rotVel.y * dt;
      c.rot.z += c.rotVel.z * dt;

      const m = meshRefs.current[i];
      if (m) {
        m.position.copy(c.pos);
        m.rotation.copy(c.rot);
      }
      const mat = matRefs.current[i];
      if (mat) {
        mat.opacity = opacity;
      }
    }
  });

  return (
    <group>
      {burst.chunks.map((chunk, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          position={chunk.pos.toArray() as [number, number, number]}
          rotation={chunk.rot.toArray().slice(0, 3) as [number, number, number]}
        >
          <boxGeometry args={[chunk.size, chunk.size, chunk.size]} />
          <meshStandardMaterial
            ref={(el) => {
              matRefs.current[i] = el as THREE.MeshStandardMaterial | null;
            }}
            color={burst.color}
            transparent
            opacity={1}
            roughness={0.85}
            metalness={0.05}
          />
        </mesh>
      ))}
    </group>
  );
}
