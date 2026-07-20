/**
 * PlayCanvas — full-screen play mode scene.
 *
 * Completely separate R3F Canvas from the editor so:
 *   - The editor remains a static drag-and-drop canvas with no frame waste
 *   - Play starts its own Three.js context, game loop, and camera
 *
 * Player: ORC character from orc_characters.glb (toon_rts pack, child 0)
 * Controls: WASD move, mouse drag to rotate camera
 * Camera: third-person, follows behind player at ~10m distance
 */
import { useRef, useEffect, useMemo, Suspense, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, Sky } from '@react-three/drei';
import { setDebugOverlay } from './PlayMode';
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';
import { useEditor } from '../editor/store';
import { TerrainMesh } from '../editor/TerrainMesh';
import { EntityLayer } from '../editor/EntityLayer';
import { Water } from './Effects';
import { sampleHeight } from '../editor/terrain-utils';
import { Link } from 'wouter';
import { ForgePhysics } from './ForgePhysics';

// ── ORC player character ───────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL;
const ORC_GLB = `${BASE}models/units/orc_characters.glb`;

function OrcPlayer({
  posRef,
  yawRef,
}: {
  posRef: React.MutableRefObject<THREE.Vector3>;
  yawRef: React.MutableRefObject<number>;
}) {
  const { scene, animations } = useGLTF(ORC_GLB, true, true) as unknown as {
    scene: THREE.Group;
    animations: THREE.AnimationClip[];
  };

  const groupRef = useRef<THREE.Group>(null);
  const prevPos = useRef(new THREE.Vector3());

  // Extract the first toon_rts character from the pack (child index 0)
  const model = useMemo(() => {
    const root = SkeletonUtils.clone(scene) as THREE.Group;
    // Unwrap Blender wrapper group if present
    let search: THREE.Group = root;
    if (root.children.length === 1 && root.children[0] instanceof THREE.Group) {
      search = root.children[0] as THREE.Group;
    }
    const child = search.children[0] as THREE.Object3D | undefined;
    let target: THREE.Object3D = child ?? root;
    if (child) {
      child.parent?.remove(child);
      child.position.set(0, 0, 0);
      child.rotation.set(0, 0, 0);
      const wrap = new THREE.Group();
      wrap.add(child);
      target = wrap;
    }
    target.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    });
    // Auto-scale to ~1.8m tall
    const box = new THREE.Box3().setFromObject(target);
    const h = box.getSize(new THREE.Vector3()).y;
    if (h > 0) target.scale.setScalar(1.8 / h);
    const box2 = new THREE.Box3().setFromObject(target);
    target.position.y -= box2.min.y;
    return target;
  }, [scene]);

  const { actions, names } = useAnimations(animations, groupRef);

  // Auto-play idle/walk animation
  useMemo(() => {
    const idle = names.find((n) => /idle|stand/i.test(n)) ?? names[0];
    if (idle) actions[idle]?.reset().fadeIn(0.3).play();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(names)]);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(posRef.current);
    groupRef.current.rotation.y = yawRef.current;

    // Switch anim when moving
    const moving = posRef.current.distanceTo(prevPos.current) > 0.001;
    prevPos.current.copy(posRef.current);
    const walkName = names.find((n) => /walk|run/i.test(n));
    const idleName = names.find((n) => /idle|stand/i.test(n)) ?? names[0];
    if (moving && walkName && actions[walkName] && !actions[walkName]?.isRunning()) {
      actions[idleName ?? '']?.fadeOut(0.2);
      actions[walkName]?.reset().fadeIn(0.2).play();
    }
    if (!moving && idleName && actions[idleName] && !actions[idleName]?.isRunning()) {
      actions[walkName ?? '']?.fadeOut(0.2);
      actions[idleName]?.reset().fadeIn(0.2).play();
    }
  });

  return <group ref={groupRef}><primitive object={model} /></group>;
}

// ── Third-person camera controller ────────────────────────────────────────

function ThirdPersonController({
  posRef,
  yawRef,
}: {
  posRef: React.MutableRefObject<THREE.Vector3>;
  yawRef: React.MutableRefObject<number>;
}) {
  const { camera, gl } = useThree();
  const terrain = useEditor((s) => s.project.terrain);

  const keysRef = useRef<Set<string>>(new Set());
  const pitchRef = useRef(0.35);
  const distRef = useRef(10);
  const camYawRef = useRef(0); // camera yaw separate from character yaw

  useEffect(() => {
    const el = gl.domElement;

    const onKey = (e: KeyboardEvent) => {
      if (e.type === 'keydown') keysRef.current.add(e.code);
      else keysRef.current.delete(e.code);
    };

    let lastX = 0, lastY = 0, isDragging = false;
    const onDown = (e: PointerEvent) => {
      isDragging = true; lastX = e.clientX; lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      camYawRef.current -= dx * 0.005;
      pitchRef.current = Math.max(0.1, Math.min(1.2, pitchRef.current + dy * 0.005));
    };
    const onUp = () => { isDragging = false; };
    const onWheel = (e: WheelEvent) => {
      distRef.current = Math.max(3, Math.min(25, distRef.current + e.deltaY * 0.02));
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('wheel', onWheel);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const keys = keysRef.current;
    const speed = 8;
    const yaw = camYawRef.current;

    // Move relative to camera facing
    let mx = 0, mz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp'))    { mx += Math.sin(yaw); mz += Math.cos(yaw); }
    if (keys.has('KeyS') || keys.has('ArrowDown'))  { mx -= Math.sin(yaw); mz -= Math.cos(yaw); }
    if (keys.has('KeyA') || keys.has('ArrowLeft'))  { mx += Math.cos(yaw); mz -= Math.sin(yaw); }
    if (keys.has('KeyD') || keys.has('ArrowRight')) { mx -= Math.cos(yaw); mz += Math.sin(yaw); }

    const len = Math.sqrt(mx * mx + mz * mz);
    if (len > 0) {
      const nx = (mx / len) * speed * dt;
      const nz = (mz / len) * speed * dt;
      posRef.current.x += nx;
      posRef.current.z += nz;
      posRef.current.y = sampleHeight(posRef.current.x, posRef.current.z, terrain);
      yawRef.current = Math.atan2(nx, nz);
    }

    // Camera orbit behind player
    const dist = distRef.current;
    const pitch = pitchRef.current;
    const tx = posRef.current.x - Math.sin(yaw) * dist * Math.cos(pitch);
    const ty = posRef.current.y + dist * Math.sin(pitch) + 1.2;
    const tz = posRef.current.z - Math.cos(yaw) * dist * Math.cos(pitch);

    camera.position.lerp(new THREE.Vector3(tx, ty, tz), dt * 8);
    camera.lookAt(posRef.current.x, posRef.current.y + 1.2, posRef.current.z);
  });

  return null;
}

// ── Scene inside the play Canvas ───────────────────────────────────────────

function PlayScene() {
  const posRef = useRef(new THREE.Vector3(0, 0.5, 0));
  const yawRef = useRef(0);

  // Set starting position at first spawn point or island center
  const entities = useEditor((s) => s.project.entities);
  const terrain  = useEditor((s) => s.project.terrain);
  useMemo(() => {
    const spawn = entities.find((e) => e.kind === 'spawn_point');
    if (spawn) {
      posRef.current.set(spawn.position[0], spawn.position[1], spawn.position[2]);
    } else {
      const y = sampleHeight(0, 0, terrain);
      posRef.current.set(0, y + 0.5, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <color attach="background" args={['#0d1117']} />
      <fogExp2 attach="fog" args={['#0d1117', 0.003]} />
      <Sky sunPosition={[80, 40, -60]} turbidity={4} rayleigh={1.5} />

      <ambientLight intensity={0.5} />
      <directionalLight
        position={[60, 80, 30]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
      >
        <orthographicCamera attach="shadow-camera" args={[-120, 120, 120, -120, 0.1, 400]} />
      </directionalLight>

      <Suspense fallback={null}>
        <TerrainMesh />
        <EntityLayer />
        <Water size={600} />
      </Suspense>

      <Suspense fallback={null}>
        <OrcPlayer posRef={posRef} yawRef={yawRef} />
      </Suspense>

      <ThirdPersonController posRef={posRef} yawRef={yawRef} />
    </>
  );
}

// ── Public component ───────────────────────────────────────────────────────

export function PlayCanvas() {
  const [debug, setDebug] = useState(false);
  const toggleDebug = () => {
    const next = !debug;
    setDebug(next);
    setDebugOverlay(next);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* HUD overlay */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 10,
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <Link href="/editor">
          <button style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 700,
            fontFamily: 'monospace', letterSpacing: 2,
            background: 'rgba(10,15,30,0.85)',
            color: '#88ccaa', border: '1px solid #336655',
            borderRadius: 4, cursor: 'pointer',
          }}>
            ← EDITOR
          </button>
        </Link>
        <button
          onClick={toggleDebug}
          style={{
            padding: '6px 12px', fontSize: 10, fontWeight: 700,
            fontFamily: 'monospace', letterSpacing: 2,
            background: debug ? 'rgba(80,40,10,0.9)' : 'rgba(10,15,30,0.85)',
            color: debug ? '#ffaa44' : '#556677',
            border: `1px solid ${debug ? '#ff8822' : '#223344'}`,
            borderRadius: 4, cursor: 'pointer',
          }}
        >
          {debug ? '● DEBUG ON' : '○ DEBUG'}
        </button>
        <span style={{
          fontFamily: 'monospace', fontSize: 10, color: '#667788',
          background: 'rgba(10,15,30,0.75)', padding: '4px 10px', borderRadius: 3,
        }}>
          WASD · DRAG TO LOOK · SCROLL ZOOM
        </span>
      </div>

      <Canvas
        shadows
        camera={{ position: [0, 12, 15], fov: 60, near: 0.1, far: 2000 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <ForgePhysics>
          <PlayScene />
        </ForgePhysics>
      </Canvas>
    </div>
  );
}
