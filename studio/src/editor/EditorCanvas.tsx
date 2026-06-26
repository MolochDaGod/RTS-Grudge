/**
 * The main R3F canvas for the map editor. Hosts the orbit camera,
 * lighting, terrain (sculpt), entity layer, and a click-to-place
 * handler when the user is in 'place_entity' mode.
 */
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Sky, Grid } from '@react-three/drei';
import { Suspense, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEditor } from './store';
import { SculptController } from './SculptController';
import { EntityLayer } from './EntityLayer';
import { newEntityId } from './project';
import { sampleHeight } from './terrain-utils';
import { Water, ShoreFoam, AmbientSparkles, PostFX } from '../runtime/Effects';
import { Rain } from '../runtime/Rain';
import { GrassField } from '../runtime/GrassField';
import { InstancedForest } from '../runtime/InstancedForest';
import { HdrEnvironment } from '../runtime/HdrEnvironment';
import { PlayModeRoot, liveCreaturePositions } from '../runtime/PlayMode';
import { ForgePhysics } from '../runtime/ForgePhysics';
import { getAssetById } from '../library/LandscapeAssets';
import type { Vec3 } from '../types';

/**
 * Invisible huge plane that catches clicks while the user is in
 * `place_entity` mode. If the user has armed an asset from the palette,
 * we stamp it (kind, asset URL, default scale + data, random Y rotation
 * so a forest doesn't look like a uniform regiment). Otherwise we drop
 * a blank "New Prop" so the legacy "Place Entity" tool still does
 * something useful.
 */
function PlacementHandler() {
  const tool           = useEditor((s) => s.tool);
  const playMode       = useEditor((s) => s.playMode);
  const addEntity      = useEditor((s) => s.addEntity);
  const project        = useEditor((s) => s.project);
  const armedAssetId   = useEditor((s) => s.armedAssetId);
  const armAsset       = useEditor((s) => s.armAsset);
  const placementTint  = useEditor((s) => s.placementTint);
  const placementScale = useEditor((s) => s.placementScale);

  // Placement is editing — disabled while playing so click-to-shoot doesn't
  // accidentally drop palette tiles into the world.
  if (playMode || tool !== 'place_entity') return null;

  return (
    <mesh
      visible={false}
      onClick={(e) => {
        e.stopPropagation();
        const x = e.point.x, z = e.point.z;
        const y = sampleHeight(x, z, project.terrain);
        const armed = armedAssetId ? getAssetById(armedAssetId) : undefined;
        if (armed) {
        const yaw = Math.random() * Math.PI * 2;
          const sJitter = 0.85 + Math.random() * 0.3; // ±15% scale variance
          const s = armed.defaultScale * placementScale * sJitter;
          /* Merge palette defaultData first, then the tint override on top
           * so per-asset colours (e.g. mineral blue) can be overridden by
           * the palette tint picker. */
          const entityData = {
            paletteId: armed.id,
            ...(armed.defaultData ?? {}),
            ...(placementTint ? { tint: placementTint } : {}),
          };
          addEntity({
            id: newEntityId(),
            kind: armed.kind,
            name: armed.label,
            asset: armed.assetUrl,
            position: [x, y, z] as Vec3,
            rotation: [0, yaw, 0],
            scale:    [s, s, s],
            data: entityData,
          });
          // One-click placement contract: clear armed state after a successful
          // drop so the next click doesn't keep stamping. Hold Shift to keep
          // the asset armed for rapid scattering (trees, grass, rocks).
          if (!e.shiftKey) armAsset(null);
        } else {
          addEntity({
            id: newEntityId(),
            kind: 'prop',
            name: 'New Prop',
            position: [x, y, z] as Vec3,
            rotation: [0, 0, 0],
            scale:    [1, 1, 1],
            data: {},
          });
        }
      }}
      position={[0, 0, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[10000, 10000]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}

/**
 * Bounded grid that:
 *   - matches the terrain footprint instead of running infinitely past
 *     the water (which looked like a second surface),
 *   - sits a hair above sea level so it's clipped naturally by the
 *     opaque water,
 *   - hides itself in Play mode so the finished scene stays clean.
 */
function EditorGrid() {
  const playMode = useEditor((s) => s.playMode);
  const size     = useEditor((s) => s.project.terrain.size);
  if (playMode) return null;
  return (
    <Grid
      args={[size, size]}
      cellSize={4}
      cellThickness={0.5}
      cellColor="#1b2230"
      sectionSize={32}
      sectionThickness={1}
      sectionColor="#2a3548"
      fadeDistance={size * 0.65}
      fadeStrength={1.2}
      position={[0, 0.02, 0]}
    />
  );
}

function CameraController() {
  const tool     = useEditor((s) => s.tool);
  const playMode = useEditor((s) => s.playMode);
  // In play mode the third-person camera in <Player /> drives the view;
  // OrbitControls would fight it for the camera transform.
  if (playMode) return null;
  // While sculpting/painting we disable orbit so drag-paint feels right.
  const isBrushing = tool.startsWith('sculpt_') || tool.startsWith('paint_');
  return (
    <OrbitControls
      enabled={!isBrushing}
      makeDefault
      maxPolarAngle={Math.PI / 2.05}
      target={new THREE.Vector3(0, 0, 0)}
    />
  );
}

/**
 * Reads the env-settings slice and conditionally mounts the optional
 * scene FX (shoreline ring / rain / sparkles / HDR / grass). Keeping
 * each behind its own toggle means turning a feature off actually
 * unmounts it — no GPU cost when disabled.
 */
function GrassWithInteraction() {
  const env = useEditor((s) => s.env);
  const terrain = useEditor((s) => s.project.terrain);
  const playMode = useEditor((s) => s.playMode);
  const playerPos = useEditor((s) => s.player.position);
  const interactRef = useRef<THREE.Vector3[]>([
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
    new THREE.Vector3(), new THREE.Vector3(),
  ]);

  useFrame(() => {
    if (!playMode) return;
    let n = 0;
    interactRef.current[n]?.set(playerPos[0], playerPos[1], playerPos[2]);
    n++;
    for (const p of liveCreaturePositions) {
      if (n >= interactRef.current.length) break;
      interactRef.current[n]?.copy(p);
      n++;
    }
  });

  if (!env.grass.enabled) return null;
  return (
    <GrassField
      terrain={terrain}
      density={env.grass.density}
      height={env.grass.height}
      noiseScale={env.grass.noiseScale}
      windStrength={env.grass.windStrength}
      interactionPositions={playMode ? interactRef.current : undefined}
    />
  );
}

function ForestLayer() {
  const terrain = useEditor((s) => s.project.terrain);
  const entities = useEditor((s) => s.project.entities);
  const entityRev = useEditor((s) => s.entityRev);

  const zones = useMemo(() => entities
    .filter((e) => e.data.forestZone === true)
    .map((e) => ({
      cx: Number(e.data.cx ?? e.position[0]),
      cz: Number(e.data.cz ?? e.position[2]),
      radius: Number(e.data.radius ?? 16),
      count: Number(e.data.count ?? 40),
      seed: Number(e.data.seed ?? 1),
    })), [entities, entityRev]);

  if (zones.length === 0) return null;
  return <InstancedForest terrain={terrain} zones={zones} />;
}

function EnvLayer() {
  const env = useEditor((s) => s.env);
  return (
    <>
      {env.shoreFoam && <ShoreFoam radius={102} />}
      {env.sparkles && <AmbientSparkles />}
      {env.rain && <Rain />}
      {env.hdr && <HdrEnvironment />}
      <ForestLayer />
      <GrassWithInteraction />
    </>
  );
}

function EditorScene() {
  const playMode = useEditor((s) => s.playMode);
  const scene = (
    <>
      <color attach="background" args={['#0d1117']} />
      <fogExp2 attach="fog" args={['#0d1117', 0.0035]} />
      <Sky sunPosition={[80, 40, -60]} turbidity={4} rayleigh={1.5} />

      <ambientLight intensity={0.45} />
      <directionalLight
        position={[60, 80, 30]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
      >
        <orthographicCamera attach="shadow-camera" args={[-150, 150, 150, -150, 0.1, 400]} />
      </directionalLight>

      <EditorGrid />

      <Suspense fallback={null}>
        <SculptController />
        <EntityLayer />
        <PlayModeRoot />
        <PlacementHandler />
        <Water size={600} />
        <EnvLayer />
      </Suspense>

      <CameraController />
      <PlayGizmoToggle />
      <PostFX />
    </>
  );

  return playMode ? <ForgePhysics>{scene}</ForgePhysics> : scene;
}

export function EditorCanvas() {
  return (
    <Canvas
      shadows
      camera={{ position: [80, 60, 80], fov: 50, near: 0.1, far: 2000 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
    >
      <EditorScene />
    </Canvas>
  );
}

function PlayGizmoToggle() {
  const playMode = useEditor((s) => s.playMode);
  if (playMode) return null;
  return (
    <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
      <GizmoViewport axisColors={['#ff5f5f', '#5fff5f', '#5f9fff']} labelColor="#1b1b1b" />
    </GizmoHelper>
  );
}
