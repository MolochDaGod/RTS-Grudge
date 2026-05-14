import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VFXManager, type ParticleSpec, type BurstSpec } from "./VFXManager";

/**
 * Singleton VFXManager — created lazily on first import. Keeping the
 * manager outside React state lets gameplay code (which lives all over
 * the tree, often inside `useFrame` callbacks) call `vfx.emit(...)`
 * imperatively without prop drilling or context lookups.
 */
let _manager: VFXManager | null = null;
function getManager(): VFXManager {
  if (!_manager) _manager = new VFXManager(6000);
  return _manager;
}

/**
 * Public imperative VFX API. Import as `import { vfx } from '@/game/vfx'`
 * and call from anywhere — the underlying pool is shared.
 *
 * `vfx.emit(spec)`  → spawn one particle (use this every frame from a
 *                     moving source to form a *linked stream* trail).
 * `vfx.burst(spec)` → spawn many particles at once (impact pops).
 * `vfx.aliveCount`  → live particle count (read-only debug).
 */
export const vfx = {
  emit(spec: ParticleSpec): number { return getManager().emit(spec); },
  burst(spec: BurstSpec): void { getManager().burst(spec); },
  get aliveCount(): number { return getManager().aliveCount; },
  /** Wipe the pool (e.g. on scene transitions). */
  clear(): void { getManager().clear(); },
};

/**
 * Vertex shader: position + per-particle attributes drive size attenuation
 * and pass color through to fragment. The size is in world units; the
 * `300 / -mvz` term converts to pixel size at the current depth so far
 * particles shrink naturally with distance — same idea as the linked-
 * particle demo's perspective sizing.
 */
const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Cull dead particles (parked at y = -10000) cheaply by zeroing size.
    float live = step(-9000.0, position.y);
    gl_PointSize = aSize * 300.0 / max(-mv.z, 0.1) * live;
    gl_Position = projectionMatrix * mv;
    vAlpha = live;
  }
`;

/**
 * Fragment shader: soft circular alpha (no texture dependency, max
 * portability) with a hot core and additive falloff. The pow(d, 1.6)
 * shapes the falloff so particles read as crisp light instead of
 * blurry blobs — visible at small sizes, important for the user's
 * "seamless but beautiful" requirement.
 */
const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    if (d > 1.0) discard;
    float core = 1.0 - pow(d, 1.6);
    float a = core * vAlpha;
    // Slight HDR boost on the core so additive blending pops without
    // requiring bloom post-processing.
    vec3 c = vColor * (1.0 + core * 0.6);
    gl_FragColor = vec4(c, a);
  }
`;

/**
 * Mount this once near the root of every Physics-bearing scene. It
 * builds the GPU buffers (sized to the manager's capacity), runs the
 * per-frame simulation step, and uploads the dirty attributes.
 *
 * Mounting it inside `<Physics>` is fine — it doesn't interact with
 * Rapier; positioning at scene root just means it inherits no
 * transforms.
 */
export function VFXSystem() {
  const manager = getManager();
  const meshRef = useRef<THREE.Points>(null);

  const { geometry, material } = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    // Positions and colors come straight from the manager arrays — no
    // copy needed; we hand the same Float32Array to the GPU and just
    // flip needsUpdate after each simulation step.
    geom.setAttribute("position", new THREE.BufferAttribute(manager.positions, 3));
    geom.setAttribute("aColor", new THREE.BufferAttribute(manager.colors, 3));
    geom.setAttribute("aSize", new THREE.BufferAttribute(manager.sizes, 1));
    geom.setDrawRange(0, manager.capacity);
    // We render the full pool every frame because dead slots are parked
    // at y = -10000 and the vertex shader culls them via gl_PointSize=0.
    // Trying to compact alive particles into a contiguous prefix would
    // force re-uploading positions for every shift — the parked-cull
    // trick is far cheaper.

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      vertexColors: false, // colors come through aColor attribute manually
    });

    return { geometry: geom, material: mat };
  }, [manager]);

  useFrame((state, dt) => {
    // Pass clock.elapsedTime as a dedup tag so the manager only integrates
    // once per render frame even if multiple VFXSystem components are
    // mounted simultaneously (two Physics roots, scene-transition overlap,
    // dev hot-reload doubling, etc.). The first caller wins; the rest
    // no-op out cheaply inside manager.update().
    manager.update(dt, state.clock.elapsedTime);
    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const colAttr = geometry.getAttribute("aColor") as THREE.BufferAttribute;
    const sizAttr = geometry.getAttribute("aSize") as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizAttr.needsUpdate = true;
  });

  // Keep the pool clean across scene swaps. The manager is a module
  // singleton, so when this component unmounts (e.g. switching out of
  // GameScene) we clear leftover particles so they don't reappear when
  // the next scene mounts.
  useEffect(() => {
    return () => { manager.clear(); };
  }, [manager]);

  return (
    <points ref={meshRef} frustumCulled={false} renderOrder={10}>
      <primitive object={geometry} />
      <primitive object={material} attach="material" />
    </points>
  );
}
