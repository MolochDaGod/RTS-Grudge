import { Suspense, useRef, useEffect, useMemo, useCallback, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  TransformControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Stats,
  Environment,
  ContactShadows,
  Html,
} from "@react-three/drei";
import * as THREE from "three";
import { useEditorStore, CAMERA_PRESETS, type SceneObject, type CameraPreset } from "./EditorStore";
import { getPrefabById } from "./PrefabRegistry";
import { NPC_FACTION_COLORS } from "./NPCPrefabRegistry";
import { useAsset } from "../hooks/useAsset";
import { resolveNodePath } from "./SceneImporter";
import { AssetLoaderInit } from "../systems/AssetLoaderInit";
import { SceneErrorBoundary } from "../components/SceneErrorBoundary";
import GameSceneBackdrop from "./GameSceneBackdrop";

function EditorLight({ obj }: { obj: SceneObject }) {
  const { lightType, color, intensity, distance, angle, castShadow, penumbra, decay, groundColor } = obj.properties;

  switch (lightType) {
    case "ambient":
      return <ambientLight color={color} intensity={intensity} />;
    case "directional":
      return (
        <directionalLight
          color={color}
          intensity={intensity}
          castShadow={castShadow}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={100}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
          shadow-bias={-0.001}
        />
      );
    case "point":
      return (
        <pointLight
          color={color}
          intensity={intensity}
          distance={distance || 20}
          decay={decay ?? 2}
        />
      );
    case "spot":
      return (
        <spotLight
          color={color}
          intensity={intensity}
          distance={distance || 30}
          angle={angle || 0.5}
          penumbra={penumbra ?? 0.3}
        />
      );
    case "hemisphere":
      return (
        <hemisphereLight
          color={color}
          groundColor={groundColor || "#8b7355"}
          intensity={intensity}
        />
      );
    default:
      return null;
  }
}

function PrimitiveGeometry({ shape, args }: { shape: string; args?: number[] }) {
  switch (shape) {
    case "box": return <boxGeometry args={(args as [number, number, number]) || [1, 1, 1]} />;
    case "sphere": return <sphereGeometry args={(args as [number, number, number]) || [0.5, 32, 32]} />;
    case "cylinder": return <cylinderGeometry args={(args as [number, number, number, number]) || [0.5, 0.5, 1, 32]} />;
    case "cone": return <coneGeometry args={(args as [number, number, number]) || [0.5, 1, 32]} />;
    case "torus": return <torusGeometry args={(args as [number, number, number, number]) || [0.5, 0.2, 16, 32]} />;
    case "plane": return <planeGeometry args={(args as [number, number]) || [2, 2]} />;
    default: return <boxGeometry args={[1, 1, 1]} />;
  }
}

function EditorPrimitive({ obj }: { obj: SceneObject }) {
  const { shape, color, args, receiveShadow, metalness, roughness } = obj.properties;
  const viewportShading = useEditorStore((s) => s.viewportShading);

  const material = useMemo(() => {
    switch (viewportShading) {
      case "wireframe":
        return <meshBasicMaterial color={color || "#4488cc"} wireframe />;
      case "normals":
        return <meshNormalMaterial />;
      case "solid":
        return <meshLambertMaterial color={color || "#4488cc"} />;
      default:
        return (
          <meshStandardMaterial
            color={color || "#4488cc"}
            metalness={metalness ?? 0.1}
            roughness={roughness ?? 0.8}
          />
        );
    }
  }, [viewportShading, color, metalness, roughness]);

  return (
    <mesh
      castShadow
      receiveShadow={receiveShadow}
    >
      <PrimitiveGeometry shape={shape} args={args} />
      {material}
    </mesh>
  );
}

/**
 * Renders a single node from a GLB that was imported via
 * `glbToSceneObjects`. Each modelNode SceneObject corresponds to one
 * Object3D in the source GLB located by `properties.nodePath`. We render
 * ONLY the node's own contribution (its mesh, if any) — descendants are
 * supplied through the editor's own SceneObject hierarchy so each child
 * gets its own selectable wrapper, transform gizmo and inspector view.
 */
function ModelNodeEditor({ obj }: { obj: SceneObject }) {
  const sourceGlb = obj.properties?.sourceGlb as string | undefined;
  const nodePath = (obj.properties?.nodePath as string | undefined) ?? "";
  const gltf = useAsset(sourceGlb!);
  const viewportShading = useEditorStore((s) => s.viewportShading);

  const localMesh = useMemo(() => {
    if (!gltf?.scene) return null;
    const node = resolveNodePath(gltf.scene, nodePath);
    if (!node) return null;

    const meshLike = node as THREE.Mesh;
    if (!meshLike.isMesh) return null;
    if ((meshLike as THREE.SkinnedMesh).isSkinnedMesh) {
      // Skinned meshes need their skeleton intact; cloning shallowly here
      // would break bind matrices. They're rare in level GLBs. Return a
      // small wireframe placeholder so the user can still see + select
      // the node in the viewport.
      const placeholder = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.4),
        new THREE.MeshBasicMaterial({ color: "#a371f7", wireframe: true }),
      );
      return placeholder;
    }

    let material: THREE.Material | THREE.Material[] = meshLike.material;
    if (viewportShading === "wireframe") {
      material = new THREE.MeshBasicMaterial({ color: "#4488cc", wireframe: true });
    } else if (viewportShading === "normals") {
      material = new THREE.MeshNormalMaterial();
    } else if (viewportShading === "solid") {
      const matAny = Array.isArray(meshLike.material) ? meshLike.material[0] : meshLike.material;
      const origColor = (matAny as any)?.color?.clone?.() ?? new THREE.Color("#888");
      material = new THREE.MeshLambertMaterial({ color: origColor });
    }

    const fresh = new THREE.Mesh(meshLike.geometry, material);
    fresh.castShadow = true;
    fresh.receiveShadow = true;
    return fresh;
  }, [gltf, nodePath, viewportShading]);

  if (!localMesh) return null;
  return <primitive object={localMesh} />;
}

function GLBModelEditor({ obj }: { obj: SceneObject }) {
  const gltf = useAsset(obj.modelPath!);
  const viewportShading = useEditorStore((s) => s.viewportShading);

  const model = useMemo(() => {
    const clone = gltf.scene.clone();
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (viewportShading === "wireframe") {
          child.material = new THREE.MeshBasicMaterial({
            color: "#4488cc",
            wireframe: true,
          });
        } else if (viewportShading === "normals") {
          child.material = new THREE.MeshNormalMaterial();
        } else if (viewportShading === "solid") {
          const origColor = child.material?.color?.clone() || new THREE.Color("#888");
          child.material = new THREE.MeshLambertMaterial({ color: origColor });
        }
      }
    });
    const box = new THREE.Box3().setFromObject(clone);
    const height = box.max.y - box.min.y;
    const targetH = obj.properties.targetHeight || 2;
    if (height > 0) {
      const s = targetH / height;
      clone.scale.multiplyScalar(s);
      clone.position.y = -box.min.y * s;
    }
    return clone;
  }, [gltf, obj.properties.targetHeight, viewportShading]);

  return (
    <group>
      <primitive object={model} />
    </group>
  );
}

function LightHelper({ obj }: { obj: SceneObject }) {
  const { lightType, color, distance, angle } = obj.properties;
  const c = color || "#ffffff";

  if (lightType === "ambient") return null;

  return (
    <group>
      <mesh>
        <octahedronGeometry args={[0.15]} />
        <meshBasicMaterial color={c} />
      </mesh>
      <mesh>
        <octahedronGeometry args={[0.22]} />
        <meshBasicMaterial color={c} wireframe transparent opacity={0.4} />
      </mesh>
      {lightType === "point" && (
        <>
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rot, i) => (
            <group key={i} rotation={[0, rot, 0]}>
              <mesh position={[0.35, 0, 0]}>
                <sphereGeometry args={[0.04, 6, 6]} />
                <meshBasicMaterial color={c} />
              </mesh>
            </group>
          ))}
          {[Math.PI / 4, -Math.PI / 4].map((rot, i) => (
            <group key={`v${i}`} rotation={[0, 0, rot]}>
              <mesh position={[0.35, 0, 0]}>
                <sphereGeometry args={[0.04, 6, 6]} />
                <meshBasicMaterial color={c} />
              </mesh>
            </group>
          ))}
        </>
      )}
      {lightType === "directional" && (
        <>
          <arrowHelper args={[new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 0), 0.8, c, 0.2, 0.1]} />
          <mesh position={[0, 0.5, 0]}>
            <ringGeometry args={[0.25, 0.28, 16]} />
            <meshBasicMaterial color={c} side={THREE.DoubleSide} transparent opacity={0.5} />
          </mesh>
        </>
      )}
      {lightType === "spot" && (
        <>
          <arrowHelper args={[new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 0), 0.6, c, 0.15, 0.08]} />
          <mesh position={[0, -0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[Math.tan(angle || 0.5) * 0.8, 0.8, 16, 1, true]} />
            <meshBasicMaterial color={c} wireframe transparent opacity={0.3} />
          </mesh>
        </>
      )}
      {lightType === "hemisphere" && (
        <>
          <mesh>
            <sphereGeometry args={[0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshBasicMaterial color={c} wireframe transparent opacity={0.5} />
          </mesh>
          <mesh rotation={[Math.PI, 0, 0]}>
            <sphereGeometry args={[0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshBasicMaterial color={obj.properties.groundColor || "#8b7355"} wireframe transparent opacity={0.5} />
          </mesh>
        </>
      )}
    </group>
  );
}

function EmptyHelper({ obj }: { obj: SceneObject }) {
  return (
    <group>
      <axesHelper args={[0.5]} />
      <mesh>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#ffaa00" wireframe />
      </mesh>
    </group>
  );
}

function SpawnHelper({ obj }: { obj: SceneObject }) {
  const props = obj.properties || {};
  const spawnRadius = Math.max(0, props.spawnRadius ?? props.radius ?? 5);
  const innerRadius = Math.max(0.15, Math.min(0.5, spawnRadius * 0.1));
  const showOuterRing = spawnRadius >= 0.2;
  const outerInner = Math.max(0.001, spawnRadius - 0.08);
  const innerInner = Math.max(0.001, innerRadius - 0.04);
  const spawnCount = props.spawnCount ?? 1;
  const maxAlive = props.maxAlive ?? spawnCount;
  const faction = (props.faction as keyof typeof NPC_FACTION_COLORS) || "neutral";
  const color = NPC_FACTION_COLORS[faction] || "#44ff44";
  const colorHex = parseInt(color.slice(1), 16);
  const prefabId: string | undefined = props.prefabId;
  const prefab = prefabId ? getPrefabById(prefabId) : undefined;
  const label = prefab?.name || props.prefabName || "(no prefab)";

  const ghostMarkers = useMemo(() => {
    const positions: [number, number, number][] = [];
    const count = Math.min(spawnCount, 8);
    for (let i = 0; i < count; i++) {
      if (count === 1) {
        positions.push([0, 0.1, 0]);
      } else {
        const angle = (i / count) * Math.PI * 2;
        const r = spawnRadius * 0.7;
        positions.push([Math.cos(angle) * r, 0.1, Math.sin(angle) * r]);
      }
    }
    return positions;
  }, [spawnCount, spawnRadius]);

  return (
    <group>
      {showOuterRing && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[outerInner, spawnRadius, 64]} />
          <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.5} />
        </mesh>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[innerInner, innerRadius, 24]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      <mesh>
        <octahedronGeometry args={[0.2]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 0.6, colorHex, 0.15, 0.08]} />
      {ghostMarkers.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} />
        </mesh>
      ))}
      <Html position={[0, 1.0, 0]} center distanceFactor={10} style={{ pointerEvents: "none" }}>
        <div style={{
          background: "rgba(13, 17, 23, 0.92)",
          border: `1px solid ${color}`,
          color: "#c9d1d9",
          padding: "3px 7px",
          borderRadius: 4,
          fontSize: 10,
          fontFamily: "monospace",
          whiteSpace: "nowrap",
          textAlign: "center",
          lineHeight: 1.3,
        }}>
          <div style={{ color, fontWeight: 600 }}>{label}</div>
          <div style={{ opacity: 0.75, fontSize: 9 }}>
            ×{spawnCount}{maxAlive !== spawnCount ? ` / max ${maxAlive}` : ""}
            {props.autoRespawn ? " ↻" : ""}
          </div>
        </div>
      </Html>
    </group>
  );
}

function TriggerHelper({ obj }: { obj: SceneObject }) {
  const radius = obj.properties.radius || 3;
  return (
    <group>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ffaa00" wireframe transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.95, radius, 32]} />
        <meshBasicMaterial color="#ffaa00" side={THREE.DoubleSide} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function ModelBoundsHelper({ groupRef, isSelected, isInSelection }: {
  groupRef: React.RefObject<THREE.Group | null>;
  isSelected: boolean;
  isInSelection: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const showBounds = useEditorStore((s) => s.showBounds);
  const showHighlight = isSelected || isInSelection;
  const cachedBounds = useRef<{ center: THREE.Vector3; size: THREE.Vector3 } | null>(null);
  const frameCount = useRef(0);

  useFrame(() => {
    if (!meshRef.current || !groupRef.current) return;
    if (!showHighlight && !showBounds) {
      meshRef.current.visible = false;
      return;
    }
    frameCount.current++;
    if (frameCount.current % 30 === 1 || !cachedBounds.current) {
      meshRef.current.visible = false;
      const box = new THREE.Box3();
      groupRef.current.traverse((child: any) => {
        if (child === meshRef.current) return;
        if (child.isMesh && child.geometry) {
          child.geometry.computeBoundingBox();
          const childBox = child.geometry.boundingBox!.clone();
          childBox.applyMatrix4(child.matrixWorld);
          box.union(childBox);
        }
      });
      if (box.isEmpty()) {
        meshRef.current.visible = false;
        cachedBounds.current = null;
        return;
      }
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const parentWorld = new THREE.Vector3();
      groupRef.current.getWorldPosition(parentWorld);
      cachedBounds.current = { center: center.sub(parentWorld), size };
    }

    if (cachedBounds.current) {
      meshRef.current.position.copy(cachedBounds.current.center);
      const s = cachedBounds.current.size;
      meshRef.current.scale.set(s.x + 0.02, s.y + 0.02, s.z + 0.02);
      meshRef.current.visible = true;
    }
  });

  if (!showHighlight && !showBounds) return null;

  return (
    <mesh ref={meshRef} renderOrder={999}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        color={isSelected ? "#58a6ff" : "#ffffff"}
        wireframe
        transparent
        opacity={isSelected ? 0.5 : isInSelection ? 0.2 : 0.12}
        depthTest={false}
      />
    </mesh>
  );
}

function ColliderVisualization({ obj }: { obj: SceneObject }) {
  const showColliders = useEditorStore((s) => s.showColliders);
  const selectedId = useEditorStore((s) => s.selectedId);
  if (!showColliders || !obj.collider || obj.collider.shape === "none") return null;
  const isSelected = selectedId === obj.id;
  const c = obj.collider;
  const color = isSelected ? "#56d364" : "#56d364";
  const opacity = isSelected ? 0.35 : 0.12;

  return (
    <group position={c.offset}>
      {c.shape === "box" && (
        <mesh>
          <boxGeometry args={c.size as [number, number, number]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={opacity} depthTest={false} />
        </mesh>
      )}
      {c.shape === "sphere" && (
        <mesh>
          <sphereGeometry args={[c.size[0], 16, 12]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={opacity} depthTest={false} />
        </mesh>
      )}
      {c.shape === "capsule" && (
        <mesh>
          <capsuleGeometry args={[c.size[0], c.size[1] - c.size[0] * 2, 8, 12]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={opacity} depthTest={false} />
        </mesh>
      )}
    </group>
  );
}

function NavMeshIndicator({ obj }: { obj: SceneObject }) {
  const showNavMesh = useEditorStore((s) => s.showNavMesh);
  if (!showNavMesh || !obj.navMeshObstacle) return null;

  const size = obj.collider?.size || [1, 1, 1];
  const offset = obj.collider?.offset || [0, 0, 0];

  return (
    <group position={[offset[0], 0.05, offset[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size[0] + 0.4, size[2] + 0.4]} />
        <meshBasicMaterial color="#f0883e" transparent opacity={0.15} side={THREE.DoubleSide} depthTest={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(size[0], size[2]) * 0.5, Math.max(size[0], size[2]) * 0.5 + 0.08, 4]} />
        <meshBasicMaterial color="#f0883e" transparent opacity={0.4} side={THREE.DoubleSide} depthTest={false} />
      </mesh>
    </group>
  );
}

function SelectableObject({ obj, children, hierarchyChildren }: { obj: SceneObject; children: React.ReactNode; hierarchyChildren?: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const selectedId = useEditorStore((s) => s.selectedId);
  const setSelectedId = useEditorStore((s) => s.setSelectedId);
  const toggleSelectId = useEditorStore((s) => s.toggleSelectId);
  const transformMode = useEditorStore((s) => s.transformMode);
  const updateObject = useEditorStore((s) => s.updateObject);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const snapTranslate = useEditorStore((s) => s.snapTranslate);
  const snapRotate = useEditorStore((s) => s.snapRotate);
  const snapScale = useEditorStore((s) => s.snapScale);
  const transformSpace = useEditorStore((s) => s.transformSpace);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const isSelected = selectedId === obj.id;
  const isInSelection = selectedIds.includes(obj.id);

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    if (e.nativeEvent?.shiftKey || e.shiftKey) {
      toggleSelectId(obj.id);
    } else {
      setSelectedId(obj.id);
    }
  }, [obj.id, setSelectedId, toggleSelectId]);

  return (
    <>
      <group
        ref={groupRef}
        position={obj.position}
        rotation={obj.rotation}
        scale={obj.scale}
        onClick={handleClick}
        visible={obj.visible}
      >
        {children}
        <ColliderVisualization obj={obj} />
        <NavMeshIndicator obj={obj} />
        <ModelBoundsHelper groupRef={groupRef} isSelected={isSelected} isInSelection={isInSelection} />
        {hierarchyChildren}
      </group>
      {isSelected && groupRef.current && !obj.locked && (
        <TransformControls
          object={groupRef.current}
          mode={transformMode}
          space={transformSpace}
          translationSnap={snapEnabled && transformMode === "translate" ? snapTranslate : undefined}
          rotationSnap={snapEnabled && transformMode === "rotate" ? THREE.MathUtils.degToRad(snapRotate) : undefined}
          scaleSnap={snapEnabled && transformMode === "scale" ? snapScale : undefined}
          size={0.8}
          onMouseDown={() => {
            pushHistory();
            const orbitCtrl = (window as any).__editorOrbitControls;
            if (orbitCtrl) orbitCtrl.enabled = false;
          }}
          onChange={() => {
            if (groupRef.current) {
              const p = groupRef.current.position;
              const r = groupRef.current.rotation;
              const s = groupRef.current.scale;
              updateObject(obj.id, {
                position: [p.x, p.y, p.z],
                rotation: [r.x, r.y, r.z],
                scale: [s.x, s.y, s.z],
              });
            }
          }}
          onMouseUp={() => {
            const orbitCtrl = (window as any).__editorOrbitControls;
            if (orbitCtrl) orbitCtrl.enabled = true;
            if (groupRef.current) {
              const p = groupRef.current.position;
              const r = groupRef.current.rotation;
              const s = groupRef.current.scale;
              updateObject(obj.id, {
                position: [p.x, p.y, p.z],
                rotation: [r.x, r.y, r.z],
                scale: [s.x, s.y, s.z],
              });
            }
          }}
        />
      )}
    </>
  );
}

function CameraController() {
  const { camera } = useThree();
  const cameraPreset = useEditorStore((s) => s.cameraPreset);
  const prevPreset = useRef(cameraPreset);
  const orbitRef = useRef<any>(null);

  useEffect(() => {
    if (cameraPreset !== prevPreset.current) {
      const preset = CAMERA_PRESETS[cameraPreset];
      if (preset && orbitRef.current) {
        camera.position.set(...preset.position);
        orbitRef.current.target.set(...preset.target);
        orbitRef.current.update();
      }
    }
    prevPreset.current = cameraPreset;
  }, [cameraPreset, camera]);

  return (
    <OrbitControls
      ref={(ref: any) => {
        orbitRef.current = ref;
        (window as any).__editorOrbitControls = ref;
      }}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      minDistance={1}
      maxDistance={200}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  );
}

function XYZAxisLines() {
  const showAxes = useEditorStore((s) => s.showAxes);
  if (!showAxes) return null;

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([-50, 0, 0, 50, 0, 0]), 3]}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#f85149" opacity={0.4} transparent />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, -50, 0, 0, 50, 0]), 3]}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#7ee787" opacity={0.4} transparent />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, -50, 0, 0, 50]), 3]}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#58a6ff" opacity={0.4} transparent />
      </line>

      <Html position={[52, 0, 0]} center style={{ pointerEvents: "none" }}>
        <span style={{ color: "#f85149", fontSize: 14, fontWeight: 900, textShadow: "0 0 4px rgba(0,0,0,0.8)" }}>X</span>
      </Html>
      <Html position={[0, 52, 0]} center style={{ pointerEvents: "none" }}>
        <span style={{ color: "#7ee787", fontSize: 14, fontWeight: 900, textShadow: "0 0 4px rgba(0,0,0,0.8)" }}>Y</span>
      </Html>
      <Html position={[0, 0, 52]} center style={{ pointerEvents: "none" }}>
        <span style={{ color: "#58a6ff", fontSize: 14, fontWeight: 900, textShadow: "0 0 4px rgba(0,0,0,0.8)" }}>Z</span>
      </Html>
    </group>
  );
}

function CursorIndicator() {
  const cursor = useEditorStore((s) => s.cursorPosition);
  return (
    <group position={cursor}>
      <mesh>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#ff6600" />
      </mesh>
      <axesHelper args={[0.3]} />
    </group>
  );
}

function ViewportInfoOverlay() {
  const { camera } = useThree();
  const [info, setInfo] = useState({ x: 0, y: 0, z: 0 });

  useFrame(() => {
    setInfo({
      x: Math.round(camera.position.x * 100) / 100,
      y: Math.round(camera.position.y * 100) / 100,
      z: Math.round(camera.position.z * 100) / 100,
    });
  });

  return (
    <Html
      position={[0, 0, 0]}
      style={{ pointerEvents: "none", position: "fixed", bottom: 4, left: 4 }}
      fullscreen
    >
      <div style={{
        position: "absolute",
        bottom: 4,
        left: 4,
        background: "rgba(0,0,0,0.6)",
        padding: "3px 8px",
        borderRadius: 4,
        fontSize: 10,
        fontFamily: "monospace",
        color: "#8b949e",
        display: "flex",
        gap: 8,
        pointerEvents: "none",
      }}>
        <span>
          <span style={{ color: "#f85149" }}>X:</span>{info.x.toFixed(1)}
        </span>
        <span>
          <span style={{ color: "#7ee787" }}>Y:</span>{info.y.toFixed(1)}
        </span>
        <span>
          <span style={{ color: "#58a6ff" }}>Z:</span>{info.z.toFixed(1)}
        </span>
      </div>
    </Html>
  );
}

function GroundPlane() {
  const setCursorPosition = useEditorStore((s) => s.setCursorPosition);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (e.point) {
          setCursorPosition([
            Math.round(e.point.x * 100) / 100,
            Math.round(e.point.y * 100) / 100,
            Math.round(e.point.z * 100) / 100,
          ]);
        }
      }}
      renderOrder={-1}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial visible={false} depthWrite={false} />
    </mesh>
  );
}

function renderObjectContent(obj: SceneObject): React.ReactNode {
  if (obj.type === "light") {
    return <><EditorLight obj={obj} /><LightHelper obj={obj} /></>;
  }
  if (obj.type === "primitive") {
    return <EditorPrimitive obj={obj} />;
  }
  if ((obj.type === "model" || obj.type === "prefab") && obj.modelPath) {
    return <GLBModelEditor obj={obj} />;
  }
  if (obj.type === "modelNode" && obj.properties?.sourceGlb) {
    return <ModelNodeEditor obj={obj} />;
  }
  if (obj.type === "spawn") {
    return <SpawnHelper obj={obj} />;
  }
  if (obj.type === "trigger") {
    return <TriggerHelper obj={obj} />;
  }
  if (obj.type === "empty") {
    return <EmptyHelper obj={obj} />;
  }
  if (obj.type === "group") {
    return (
      <group>
        <axesHelper args={[0.8]} />
        <mesh>
          <boxGeometry args={[0.15, 0.15, 0.15]} />
          <meshBasicMaterial color="#d2a8ff" wireframe />
        </mesh>
      </group>
    );
  }
  return null;
}

function HierarchyRenderer({ objects }: { objects: SceneObject[] }) {
  const objectMap = useMemo(() => {
    const map = new Map<string, SceneObject>();
    for (const o of objects) map.set(o.id, o);
    return map;
  }, [objects]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, SceneObject[]>();
    for (const o of objects) {
      const pid = o.parentId || "__root__";
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(o);
    }
    return map;
  }, [objects]);

  const rootObjects = useMemo(() => childrenMap.get("__root__") || [], [childrenMap]);

  const renderNode = useCallback((obj: SceneObject): React.ReactNode => {
    const kids = childrenMap.get(obj.id);
    const childNodes = kids ? kids.map(child => renderNode(child)) : null;

    const content = renderObjectContent(obj);
    const needsSuspense =
      ((obj.type === "model" || obj.type === "prefab") && !!obj.modelPath) ||
      (obj.type === "modelNode" && !!obj.properties?.sourceGlb);

    if (needsSuspense) {
      return (
        <SceneErrorBoundary
          key={obj.id}
          resetKey={obj.modelPath ?? (obj.properties?.sourceGlb as string | undefined) ?? obj.id}
          label={`Editor:${obj.type}:${obj.id}`}
          fallback={
            <SelectableObject obj={obj} hierarchyChildren={childNodes}>
              <mesh>
                <boxGeometry args={[0.5, 0.5, 0.5]} />
                <meshStandardMaterial color="#a44" wireframe />
              </mesh>
            </SelectableObject>
          }
        >
          <Suspense fallback={
            <SelectableObject obj={obj} hierarchyChildren={childNodes}>
              <mesh>
                <boxGeometry args={[0.5, 0.5, 0.5]} />
                <meshStandardMaterial color={obj.type === "prefab" ? "#d2a8ff" : "#666"} wireframe />
              </mesh>
            </SelectableObject>
          }>
            <SelectableObject obj={obj} hierarchyChildren={childNodes}>
              {content}
            </SelectableObject>
          </Suspense>
        </SceneErrorBoundary>
      );
    }

    return (
      <SelectableObject key={obj.id} obj={obj} hierarchyChildren={childNodes}>
        {content}
      </SelectableObject>
    );
  }, [childrenMap]);

  return <>{rootObjects.map(obj => renderNode(obj))}</>;
}

function SceneContent() {
  const objects = useEditorStore((s) => s.objects);
  const showGrid = useEditorStore((s) => s.showGrid);
  const showStats = useEditorStore((s) => s.showStats);
  const setSelectedId = useEditorStore((s) => s.setSelectedId);
  const gameSceneBackdrop = useEditorStore((s) => s.gameSceneBackdrop);
  const backdropActive = gameSceneBackdrop !== "none";

  return (
    <>
      <SceneErrorBoundary
        resetKey={`backdrop:${gameSceneBackdrop}`}
        label={`Editor:Backdrop:${gameSceneBackdrop}`}
        fallback={null}
      >
        <GameSceneBackdrop type={gameSceneBackdrop} />
      </SceneErrorBoundary>

      {showGrid && !backdropActive && (
        <Grid
          position={[0, -0.01, 0]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#304060"
          sectionSize={5}
          sectionThickness={1.2}
          sectionColor="#506080"
          fadeDistance={80}
          fadeStrength={1.5}
          infiniteGrid
        />
      )}

      <XYZAxisLines />

      {showStats && <Stats />}

      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport
          labelColor="white"
          axisHeadScale={1}
          axisColors={["#f85149", "#7ee787", "#58a6ff"]}
        />
      </GizmoHelper>

      <CameraController />
      <GroundPlane />
      {!backdropActive && (
        <ContactShadows
          position={[0, -0.01, 0]}
          opacity={0.4}
          scale={40}
          blur={2}
          far={10}
        />
      )}
      <CursorIndicator />
      <ViewportInfoOverlay />

      <HierarchyRenderer objects={objects} />
    </>
  );
}

function KeyboardShortcuts() {
  const setTransformMode = useEditorStore((s) => s.setTransformMode);
  const selectedId = useEditorStore((s) => s.selectedId);
  const removeSelected = useEditorStore((s) => s.removeSelected);
  const duplicateSelected = useEditorStore((s) => s.duplicateSelected);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const toggleAxes = useEditorStore((s) => s.toggleAxes);
  const toggleBounds = useEditorStore((s) => s.toggleBounds);
  const toggleStats = useEditorStore((s) => s.toggleStats);
  const toggleColliders = useEditorStore((s) => s.toggleColliders);
  const toggleNavMesh = useEditorStore((s) => s.toggleNavMesh);
  const selectAll = useEditorStore((s) => s.selectAll);
  const deselectAll = useEditorStore((s) => s.deselectAll);
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const setCameraPreset = useEditorStore((s) => s.setCameraPreset);
  const focusSelected = useEditorStore((s) => s.focusSelected);
  const setTransformSpace = useEditorStore((s) => s.setTransformSpace);
  const transformSpace = useEditorStore((s) => s.transformSpace);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;

      switch (e.code) {
        case "KeyW": if (!e.ctrlKey && !e.metaKey) setTransformMode("translate"); break;
        case "KeyE": if (!e.ctrlKey && !e.metaKey) setTransformMode("rotate"); break;
        case "KeyR": if (!e.ctrlKey && !e.metaKey) setTransformMode("scale"); break;
        case "Delete":
        case "KeyX":
          if (!e.ctrlKey && !e.metaKey) removeSelected();
          break;
        case "KeyD":
          if ((e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            duplicateSelected();
          }
          break;
        case "KeyZ":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
          }
          break;
        case "KeyY":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            redo();
          }
          break;
        case "KeyG": if (!e.ctrlKey) toggleGrid(); break;
        case "KeyH": if (!e.ctrlKey) toggleAxes(); break;
        case "KeyB": if (!e.ctrlKey && !e.metaKey) toggleBounds(); break;
        case "KeyS":
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            setSnapEnabled(!snapEnabled);
          }
          break;
        case "KeyA":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            selectAll();
          } else {
            deselectAll();
          }
          break;
        case "Period":
          if (!e.ctrlKey) {
            focusSelected();
          }
          break;
        case "Tab":
          e.preventDefault();
          setTransformSpace(transformSpace === "world" ? "local" : "world");
          break;
        case "Numpad0":
        case "Digit0": if (!e.ctrlKey) setCameraPreset("perspective"); break;
        case "Numpad1":
        case "Digit1": if (!e.ctrlKey) setCameraPreset("front"); break;
        case "Numpad2":
        case "Digit2": if (!e.ctrlKey) setCameraPreset("back"); break;
        case "Numpad3":
        case "Digit3": if (!e.ctrlKey) setCameraPreset("left"); break;
        case "Numpad4":
        case "Digit4": if (!e.ctrlKey) setCameraPreset("right"); break;
        case "Numpad5":
        case "Digit5": if (!e.ctrlKey) setCameraPreset("top"); break;
        case "Numpad6":
        case "Digit6": if (!e.ctrlKey) setCameraPreset("bottom"); break;
        case "KeyI": if (!e.ctrlKey) toggleStats(); break;
        case "KeyC": if (!e.ctrlKey && !e.metaKey) toggleColliders(); break;
        case "KeyN": if (!e.ctrlKey && !e.metaKey) toggleNavMesh(); break;
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [selectedId, snapEnabled, transformSpace, setTransformMode, removeSelected, duplicateSelected, undo, redo, toggleGrid, toggleAxes, toggleBounds, toggleStats, toggleColliders, toggleNavMesh, selectAll, deselectAll, setSnapEnabled, setCameraPreset, focusSelected, setTransformSpace]);

  return null;
}

export default function EditorViewport() {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          position: [15, 12, 15],
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
        onPointerMissed={() => useEditorStore.getState().setSelectedId(null)}
        style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}
      >
        <AssetLoaderInit />
        <fog attach="fog" args={["#1a1a2e", 80, 200]} />
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>
      <KeyboardShortcuts />

      <ViewportCornerInfo />
    </div>
  );
}

function ViewportCornerInfo() {
  const transformMode = useEditorStore((s) => s.transformMode);
  const transformSpace = useEditorStore((s) => s.transformSpace);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const viewportShading = useEditorStore((s) => s.viewportShading);
  const cameraPreset = useEditorStore((s) => s.cameraPreset);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const cursorPos = useEditorStore((s) => s.cursorPosition);
  const objects = useEditorStore((s) => s.objects);
  const showColliders = useEditorStore((s) => s.showColliders);
  const showNavMesh = useEditorStore((s) => s.showNavMesh);

  return (
    <>
      <div style={{
        position: "absolute",
        top: 8,
        left: 8,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        pointerEvents: "none",
        zIndex: 10,
      }}>
        <div style={{
          background: "rgba(0,0,0,0.65)",
          padding: "4px 8px",
          borderRadius: 4,
          fontSize: 11,
          fontFamily: "monospace",
          color: "#c9d1d9",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}>
          <span style={{ color: "#58a6ff", fontWeight: 700 }}>{CAMERA_PRESETS[cameraPreset]?.label}</span>
          <span style={{ color: "#30363d" }}>|</span>
          <span style={{ color: viewportShading === "material" ? "#7ee787" : "#8b949e" }}>{viewportShading}</span>
        </div>
      </div>

      <div style={{
        position: "absolute",
        bottom: 8,
        left: 8,
        display: "flex",
        gap: 6,
        pointerEvents: "none",
        zIndex: 10,
      }}>
        <div style={{
          background: "rgba(0,0,0,0.65)",
          padding: "4px 8px",
          borderRadius: 4,
          fontSize: 10,
          fontFamily: "monospace",
          color: "#8b949e",
        }}>
          <span style={{ color: "#f85149" }}>X:</span>{cursorPos[0].toFixed(2)}{" "}
          <span style={{ color: "#7ee787" }}>Y:</span>{cursorPos[1].toFixed(2)}{" "}
          <span style={{ color: "#58a6ff" }}>Z:</span>{cursorPos[2].toFixed(2)}
        </div>
        <div style={{
          background: "rgba(0,0,0,0.65)",
          padding: "4px 8px",
          borderRadius: 4,
          fontSize: 10,
          fontFamily: "monospace",
          color: "#8b949e",
        }}>
          {objects.length} obj | {selectedIds.length} sel
        </div>
        {snapEnabled && (
          <div style={{
            background: "rgba(31,111,235,0.3)",
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 10,
            fontFamily: "monospace",
            color: "#58a6ff",
            border: "1px solid #58a6ff44",
          }}>
            SNAP
          </div>
        )}
        {showColliders && (
          <div style={{
            background: "rgba(86,211,100,0.2)",
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 10,
            fontFamily: "monospace",
            color: "#56d364",
            border: "1px solid #56d36444",
          }}>
            COL
          </div>
        )}
        {showNavMesh && (
          <div style={{
            background: "rgba(240,136,62,0.2)",
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 10,
            fontFamily: "monospace",
            color: "#f0883e",
            border: "1px solid #f0883e44",
          }}>
            NAV
          </div>
        )}
      </div>

      <div style={{
        position: "absolute",
        bottom: 8,
        right: 8,
        pointerEvents: "none",
        zIndex: 10,
      }}>
        <div style={{
          background: "rgba(0,0,0,0.65)",
          padding: "4px 8px",
          borderRadius: 4,
          fontSize: 10,
          fontFamily: "monospace",
          color: "#8b949e",
          display: "flex",
          gap: 6,
        }}>
          <span style={{
            color: transformMode === "translate" ? "#58a6ff" : "#484f58",
            fontWeight: transformMode === "translate" ? 700 : 400,
          }}>W:Move</span>
          <span style={{
            color: transformMode === "rotate" ? "#7ee787" : "#484f58",
            fontWeight: transformMode === "rotate" ? 700 : 400,
          }}>E:Rot</span>
          <span style={{
            color: transformMode === "scale" ? "#f0883e" : "#484f58",
            fontWeight: transformMode === "scale" ? 700 : 400,
          }}>R:Scl</span>
          <span style={{ color: "#30363d" }}>|</span>
          <span style={{ color: transformSpace === "local" ? "#d2a8ff" : "#484f58" }}>
            {transformSpace === "local" ? "Local" : "World"}
          </span>
        </div>
      </div>
    </>
  );
}
