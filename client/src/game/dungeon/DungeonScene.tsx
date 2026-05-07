import { Suspense, useRef, useMemo, useEffect, useCallback, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAudio } from "@/lib/stores/useAudio";
import { useSettings } from "@/lib/stores/useSettings";
import { KeyboardControls, useTexture } from "@react-three/drei";
import { Physics, RigidBody, CuboidCollider, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { importFromScene } from "../systems/AssetPipeline";
import { useAsset } from "../hooks/useAsset";
import { AssetLoaderInit } from "../systems/AssetLoaderInit";
import Player from "../components/Player";
import Camera from "../components/Camera";
import HUD from "../components/HUD";
import Enemy from "../components/Enemy";
import { useEnemyManager } from "../systems/EnemyManager";
import LootDropsRenderer from "../components/LootDrops";
import { useGame } from "@/lib/stores/useGame";
import { generateDungeon, DungeonLayout, DungeonWall, DungeonDecor, DungeonTheme, DecorType, DungeonRoom, TileGrid, DungeonTile, TILE_SIZE } from "./DungeonGenerator";
import { TorchParticles, PortalParticles, CeilingHoleBeams } from "../effects/ParticleEffects";
import { VFXSystem } from "../vfx";
import { buildDungeonNavMesh, findDungeonPath } from "./DungeonNavigation";
import { DUNGEON_ASSETS, FURNITURE_ASSETS, KAYKIT_DUNGEON_ASSETS, DECOR_TO_DUNGEON_ASSET, resolveAssetDef, getRandomPotion, getRandomRock, getRandomBones, getRandomBook, getRandomChest, getRandomTable, getRandomWallDecor } from "./DungeonAssetMap";
import DungeonModularPieces, { DungeonEntranceArch, DungeonStairs, DungeonModularDecorations, ModularDecorPlacement } from "./DungeonModular";
import { WallClimbable, LadderClimbable } from "../components/ClimbableColliders";
import {
  RegisteredDebugColliderOverlay,
  buildOrientedBoxDebugTrimesh,
  useDebugColliderRegistration,
  type DebugColliderEntry,
} from "../cheats/StreamedColliderDebugOverlay";
import { useCheats } from "@/lib/stores/useCheats";
import { useDungeonDestructibles, type DungeonDestructibleEntry } from "./DungeonDestructibles";
import {
  useDungeonDestruction,
  useGLBBboxRegistry,
  useDestroyedSet,
  resolveDecorBBox,
  computeNormalizedBBox,
  glbBboxKey,
  PROCEDURAL_DECOR_BBOX,
  DECOR_MATERIAL,
  DungeonDecorFragments,
  type DecorBBox,
} from "./DungeonDecorDestruction";
import { FractureChunksPreloader } from "./DungeonFractureAssets";

const controls = [
  { name: "forward", keys: ["KeyW", "ArrowUp"] },
  { name: "backward", keys: ["KeyS", "ArrowDown"] },
  { name: "left", keys: ["KeyA", "ArrowLeft"] },
  { name: "right", keys: ["KeyD", "ArrowRight"] },
  { name: "sprint", keys: ["ShiftLeft", "ShiftRight"] },
  { name: "jump", keys: ["Space"] },
  { name: "use", keys: ["KeyF"] },
  { name: "craft", keys: ["KeyC"] },
  { name: "crouch", keys: ["ControlLeft", "ControlRight", "KeyZ"] },
  { name: "roll", keys: ["ControlLeft", "ControlRight"] },
  { name: "modeSwitch", keys: ["KeyQ"] },
  { name: "classAbility", keys: ["KeyR"] },
  { name: "classAbility2", keys: ["KeyE"] },
];

interface ThemeColors {
  floor: string;
  floorRoughness: number;
  wall: string;
  wallRoughness: number;
  ceiling: string;
  ambient: string;
  ambientIntensity: number;
  directionalColor: string;
  directionalIntensity: number;
  fog: string;
  fogNear: number;
  fogFar: number;
  portalColor: string;
  portalEmissive: string;
}

// Lighting intensities and fog ranges were tuned up so dungeons are
// readable without needing every torch in view. Ambient ~3-4x and a
// matching directional bump leave the original moody palette intact
// while pulling shapes out of the dark; fog still hides distant
// corridors but no longer blacks out adjacent rooms.
const THEME_COLORS: Record<DungeonTheme, ThemeColors> = {
  crypt: {
    floor: "#2a2a30",
    floorRoughness: 0.95,
    wall: "#4a4550",
    wallRoughness: 0.9,
    ceiling: "#1e1e24",
    ambient: "#445566",
    ambientIntensity: 0.55,
    directionalColor: "#8899bb",
    directionalIntensity: 0.7,
    fog: "#10101a",
    fogNear: 12,
    fogFar: 80,
    portalColor: "#33cc66",
    portalEmissive: "#33cc66",
  },
  mine: {
    floor: "#3a3028",
    floorRoughness: 0.98,
    wall: "#5a4a38",
    wallRoughness: 0.95,
    ceiling: "#2a2218",
    ambient: "#665544",
    ambientIntensity: 0.5,
    directionalColor: "#ddaa77",
    directionalIntensity: 0.65,
    fog: "#1a140c",
    fogNear: 10,
    fogFar: 75,
    portalColor: "#ffaa33",
    portalEmissive: "#ff8800",
  },
  temple: {
    floor: "#38363e",
    floorRoughness: 0.85,
    wall: "#605868",
    wallRoughness: 0.8,
    ceiling: "#2a2830",
    ambient: "#556677",
    ambientIntensity: 0.7,
    directionalColor: "#aabbdd",
    directionalIntensity: 0.95,
    fog: "#15151f",
    fogNear: 14,
    fogFar: 90,
    portalColor: "#6699ff",
    portalEmissive: "#4477ff",
  },
};

const ROOM_TYPE_FLOOR_COLORS: Partial<Record<string, Record<DungeonTheme, string>>> = {
  boss: { crypt: "#2e1a1a", mine: "#3a2218", temple: "#1e1a30" },
  treasure: { crypt: "#2a2a1e", mine: "#3a3020", temple: "#2a2838" },
  shrine: { crypt: "#242030", mine: "#302828", temple: "#202838" },
  arena: { crypt: "#302020", mine: "#382818", temple: "#282040" },
  trap: { crypt: "#1e2020", mine: "#2a1e18", temple: "#201e28" },
};

/**
 * TileGridColliders
 *
 * Floor and wall colliders are derived directly from the same `tileGrid` that
 * the modular renderer (DungeonModularPieces) uses. This guarantees a strict
 * 1:1 alignment between visible walls/floors and physics — no invisible
 * blockers, no pass-through visible walls.
 *
 * - One floor collider per tile (TILE_SIZE x TILE_SIZE), with a thin
 *   themed-color base plate beneath the modular GLB floor tile so any tiny
 *   gaps between GLBs aren't see-through.
 * - One wall collider per tile-edge `wallN/S/E/W` flag (TILE_SIZE wide,
 *   wallHeight tall, ~0.5 thick).
 * - Door edges (doorN/S/E/W) intentionally have NO collider so the player
 *   can walk through, matching the visible wallDoor archway opening.
 */
const WALL_HEIGHT = 4;
const WALL_THICKNESS = 0.5;

/**
 * Synthesize a tiny indexed box trimesh (8 verts, 12 tris) from a
 * world-space center + half-extents. The output is in the exact
 * shape `<StreamedColliderDebugOverlay>` consumes — same as Rapier's
 * `TrimeshCollider`. Used by `buildDungeonDebugColliders` to expose
 * the tile-grid `<CuboidCollider>` set to the F8 debug overlay so the
 * overlay can light up dungeon floors and walls just like it does the
 * tutorial island's worker-baked ground chunks. Because the bbox is
 * trivially derivable from the inputs we hand it back ready-made,
 * letting the overlay skip its `computeBoundingBox` pass.
 */
function buildBoxDebugTrimesh(
  cx: number, cy: number, cz: number,
  hx: number, hy: number, hz: number,
): { vertices: Float32Array; indices: Uint32Array; bbox: NonNullable<DebugColliderEntry["bbox"]> } {
  const minX = cx - hx, maxX = cx + hx;
  const minY = cy - hy, maxY = cy + hy;
  const minZ = cz - hz, maxZ = cz + hz;
  // 8 cube corners in (-x,-y,-z) … (+x,+y,+z) order.
  const vertices = new Float32Array([
    minX, minY, minZ,  maxX, minY, minZ,  maxX, minY, maxZ,  minX, minY, maxZ,
    minX, maxY, minZ,  maxX, maxY, minZ,  maxX, maxY, maxZ,  minX, maxY, maxZ,
  ]);
  // 12 outward-facing triangles. EdgesGeometry's 25° fold threshold
  // keeps every 90° corner edge, so each box renders as a clean wire
  // crate in the overlay.
  const indices = new Uint32Array([
    0, 2, 1,  0, 3, 2,  // bottom (-Y)
    4, 5, 6,  4, 6, 7,  // top    (+Y)
    0, 1, 5,  0, 5, 4,  // -Z
    1, 2, 6,  1, 6, 5,  // +X
    2, 3, 7,  2, 7, 6,  // +Z
    3, 0, 4,  3, 4, 7,  // -X
  ]);
  return { vertices, indices, bbox: { minX, maxX, minY, maxY, minZ, maxZ } };
}

/**
 * Build the debug-overlay chunk list from the dungeon's tile grid.
 * One entry per `<RigidBody>` mounted in `<TileGridColliders>`:
 *  - One per floor tile (named by room type so adjacent room types
 *    contrast and a single room reads as a uniform slab).
 *  - One per active wall flag (named by side: `wall_N/S/E/W`) so
 *    the four wall directions get four distinct tints.
 * Door edges produce no rigid body and so produce no entry — gaps
 * in the overlay match the actual physics gaps you can walk through.
 *
 * Cheap to recompute (a few hundred tiny typed arrays per dungeon)
 * and only runs when the tile grid identity changes — and only when
 * the F8 cheat is on (gated by `<DungeonTileGridDebugSource>` below).
 */
function buildDungeonDebugColliders(grid: TileGrid): DebugColliderEntry[] {
  const half = TILE_SIZE / 2;
  const wallH = WALL_HEIGHT / 2;
  const wallT = WALL_THICKNESS / 2;
  const out: DebugColliderEntry[] = [];
  for (const t of grid.tiles) {
    // Floor slab — body sits at y=-0.25 with half-extents (half, 0.25, half).
    const f = buildBoxDebugTrimesh(t.wx, -0.25, t.wz, half, 0.25, half);
    out.push({ ...f, name: `floor_${t.roomType}` });
    if (t.wallN) {
      const b = buildBoxDebugTrimesh(t.wx, wallH, t.wz - half, half, wallH, wallT);
      out.push({ ...b, name: "wall_N" });
    }
    if (t.wallS) {
      const b = buildBoxDebugTrimesh(t.wx, wallH, t.wz + half, half, wallH, wallT);
      out.push({ ...b, name: "wall_S" });
    }
    if (t.wallW) {
      const b = buildBoxDebugTrimesh(t.wx - half, wallH, t.wz, wallT, wallH, half);
      out.push({ ...b, name: "wall_W" });
    }
    if (t.wallE) {
      const b = buildBoxDebugTrimesh(t.wx + half, wallH, t.wz, wallT, wallH, half);
      out.push({ ...b, name: "wall_E" });
    }
  }
  return out;
}

/**
 * Registration-only debug source for the dungeon's tile grid.
 *
 * Subscribes to the F8 collider-debug cheat and synthesizes the per-tile
 * floor / wall chunk list only while the cheat is on, then publishes
 * the result into the shared collider-debug registry consumed by the
 * scene-level `<RegisteredDebugColliderOverlay>`. Production runs (cheat
 * off) skip the typed-array build entirely; flipping the cheat on
 * rebuilds the list once per `tileGrid` identity and the registry
 * reuses it for the rest of the on-period.
 *
 * Renders nothing of its own — pair with one
 * `<RegisteredDebugColliderOverlay>` mount per scene.
 */
function DungeonTileGridDebugSource({ tileGrid }: { tileGrid: TileGrid }) {
  const debugOn = useCheats((s) => s.enabled && s.debugColliders);
  const colliders = useMemo(
    () => (debugOn ? buildDungeonDebugColliders(tileGrid) : null),
    [debugOn, tileGrid],
  );
  useDebugColliderRegistration("DungeonTileGrid", colliders);
  return null;
}

function TileGridColliders({ grid, theme, rooms }: {
  grid: TileGrid;
  theme: DungeonTheme;
  rooms: DungeonRoom[];
}) {
  const tc = THEME_COLORS[theme];

  // Quick lookup: which room contains a given tile (by tile center coordinate).
  const roomTypeForTile = (t: DungeonTile): string => {
    return t.roomType || "normal";
  };

  return (
    <group>
      {/* Floor tile colliders + thin colored base plate */}
      {grid.tiles.map((t) => {
        const roomType = roomTypeForTile(t);
        const floorColor = ROOM_TYPE_FLOOR_COLORS[roomType]?.[theme] || tc.floor;
        return (
          <RigidBody
            key={`tile_${t.tx}_${t.tz}`}
            type="fixed"
            position={[t.wx, -0.25, t.wz]}
            colliders={false}
          >
            <CuboidCollider args={[TILE_SIZE / 2, 0.25, TILE_SIZE / 2]} />
            <mesh receiveShadow position={[0, 0.24, 0]}>
              <boxGeometry args={[TILE_SIZE, 0.02, TILE_SIZE]} />
              <meshStandardMaterial color={floorColor} roughness={tc.floorRoughness} metalness={0.05} />
            </mesh>
          </RigidBody>
        );
      })}

      {/* Wall colliders, one per wall flag. Door edges produce NO collider. */}
      {grid.tiles.flatMap((t) => {
        const half = TILE_SIZE / 2;
        const colliders: JSX.Element[] = [];
        if (t.wallN) {
          colliders.push(
            <RigidBody key={`wn_${t.tx}_${t.tz}`} type="fixed"
              position={[t.wx, WALL_HEIGHT / 2, t.wz - half]} colliders={false}>
              <CuboidCollider args={[TILE_SIZE / 2, WALL_HEIGHT / 2, WALL_THICKNESS / 2]} />
            </RigidBody>,
          );
        }
        if (t.wallS) {
          colliders.push(
            <RigidBody key={`ws_${t.tx}_${t.tz}`} type="fixed"
              position={[t.wx, WALL_HEIGHT / 2, t.wz + half]} colliders={false}>
              <CuboidCollider args={[TILE_SIZE / 2, WALL_HEIGHT / 2, WALL_THICKNESS / 2]} />
            </RigidBody>,
          );
        }
        if (t.wallW) {
          colliders.push(
            <RigidBody key={`ww_${t.tx}_${t.tz}`} type="fixed"
              position={[t.wx - half, WALL_HEIGHT / 2, t.wz]} colliders={false}>
              <CuboidCollider args={[WALL_THICKNESS / 2, WALL_HEIGHT / 2, TILE_SIZE / 2]} />
            </RigidBody>,
          );
        }
        if (t.wallE) {
          colliders.push(
            <RigidBody key={`we_${t.tx}_${t.tz}`} type="fixed"
              position={[t.wx + half, WALL_HEIGHT / 2, t.wz]} colliders={false}>
              <CuboidCollider args={[WALL_THICKNESS / 2, WALL_HEIGHT / 2, TILE_SIZE / 2]} />
            </RigidBody>,
          );
        }
        return colliders;
      })}
    </group>
  );
}

function DungeonGLBDecor({ path, position, height = 2, rotation = 0 }: {
  path: string; position: [number, number, number]; height?: number; rotation?: number;
}) {
  const gltf = useAsset(path);
  const registerBBox = useGLBBboxRegistry((s) => s.registerBBox);
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const normalized = importFromScene(clone, [], path, {
      targetHeight: height,
      sanitizeBones: false,
      fixDarkMaterials: true,
      enableShadows: true,
    });
    const box = new THREE.Box3().setFromObject(normalized.scene);
    normalized.scene.position.y = -box.min.y;
    registerBBox(glbBboxKey(path, height), computeNormalizedBBox(normalized.scene));
    return normalized.scene;
  }, [gltf, height, path, registerBBox]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <primitive object={model} />
    </group>
  );
}

function ProceduralDecor({ type, position, rotation, scale, theme }: {
  type: DecorType; position: [number, number, number]; rotation: number; scale: number; theme: DungeonTheme;
}) {
  switch (type) {
    case "brazier":
      return (
        <group position={position} rotation={[0, rotation, 0]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.35, 0.8, 8]} />
            <meshStandardMaterial color="#554433" roughness={0.8} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color="#ff4400" emissive="#ff4400" emissiveIntensity={2} />
          </mesh>
          <pointLight position={[0, 1.2, 0]} color="#ff6600" intensity={4} distance={10} />
        </group>
      );

    case "barrel":
      return (
        <group position={position} rotation={[0, rotation, 0]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.35, 0.8, 12]} />
            <meshStandardMaterial color="#6b4226" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <torusGeometry args={[0.32, 0.02, 4, 12]} />
            <meshStandardMaterial color="#444" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      );

    case "crate":
      return (
        <mesh position={[position[0], position[1] + 0.3, position[2]]} rotation={[0, rotation, 0]} castShadow>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshStandardMaterial color="#8b6914" roughness={0.9} />
        </mesh>
      );

    case "banner":
      return (
        <group position={position} rotation={[0, rotation, 0]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 3, 6]} />
            <meshStandardMaterial color="#443322" roughness={0.8} />
          </mesh>
          <mesh position={[0, 2, 0.15]}>
            <planeGeometry args={[0.8, 1.2]} />
            <meshStandardMaterial
              color={theme === "crypt" ? "#660033" : theme === "mine" ? "#664400" : "#003366"}
              roughness={0.95} side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      );

    case "statue":
      return (
        <group position={position} rotation={[0, rotation, 0]} scale={[scale, scale, scale]}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial color="#667788" roughness={0.7} metalness={0.2} />
          </mesh>
          <mesh position={[0, 1.2, 0]} castShadow>
            <capsuleGeometry args={[0.2, 0.8, 6, 12]} />
            <meshStandardMaterial color="#778899" roughness={0.6} metalness={0.3} />
          </mesh>
          <mesh position={[0, 1.9, 0]} castShadow>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial color="#889aab" roughness={0.6} metalness={0.3} />
          </mesh>
        </group>
      );

    case "bookshelf":
      return (
        <group position={position} rotation={[0, rotation, 0]}>
          <mesh position={[0, 1, 0]} castShadow>
            <boxGeometry args={[1.2, 2, 0.4]} />
            <meshStandardMaterial color="#4a3520" roughness={0.9} />
          </mesh>
          {[0.3, 0.8, 1.3, 1.7].map((y, i) => (
            <mesh key={i} position={[0, y, 0.05]}>
              <boxGeometry args={[1.0, 0.15, 0.25]} />
              <meshStandardMaterial color={["#8b2500", "#2e4e2e", "#3a3060", "#6b4226"][i % 4]} roughness={0.85} />
            </mesh>
          ))}
        </group>
      );

    case "cauldron":
      return (
        <group position={position} rotation={[0, rotation, 0]}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <sphereGeometry args={[0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#2a2a2a" roughness={0.5} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.05, 16]} />
            <meshStandardMaterial color="#33cc55" emissive="#22aa44" emissiveIntensity={0.8} transparent opacity={0.7} />
          </mesh>
          <pointLight position={[0, 0.5, 0]} color="#33cc55" intensity={1.5} distance={5} />
        </group>
      );

    case "sarcophagus":
      return (
        <group position={position} rotation={[0, rotation, 0]} scale={[scale, scale, scale]}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[0.8, 0.7, 2]} />
            <meshStandardMaterial color="#5a5060" roughness={0.8} metalness={0.1} />
          </mesh>
          <mesh position={[0, 0.75, 0]} castShadow>
            <boxGeometry args={[0.85, 0.1, 2.05]} />
            <meshStandardMaterial color="#6a6070" roughness={0.7} metalness={0.15} />
          </mesh>
        </group>
      );

    case "minecart":
      return (
        <group position={position} rotation={[0, rotation, 0]}>
          <mesh position={[0, 0.25, 0]} castShadow>
            <boxGeometry args={[0.6, 0.4, 0.9]} />
            <meshStandardMaterial color="#555" roughness={0.6} metalness={0.5} />
          </mesh>
          <mesh position={[-0.25, 0.05, -0.35]}>
            <cylinderGeometry args={[0.08, 0.08, 0.04, 8]} />
            <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0.25, 0.05, -0.35]}>
            <cylinderGeometry args={[0.08, 0.08, 0.04, 8]} />
            <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[-0.25, 0.05, 0.35]}>
            <cylinderGeometry args={[0.08, 0.08, 0.04, 8]} />
            <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0.25, 0.05, 0.35]}>
            <cylinderGeometry args={[0.08, 0.08, 0.04, 8]} />
            <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      );

    case "crystal":
      return (
        <group position={position} rotation={[0, rotation, 0]} scale={[scale, scale, scale]}>
          <mesh position={[0, 0.5, 0]} rotation={[0, 0, 0.1]} castShadow>
            <coneGeometry args={[0.15, 1, 6]} />
            <meshStandardMaterial
              color={theme === "mine" ? "#44aaff" : theme === "temple" ? "#aa44ff" : "#44ffaa"}
              emissive={theme === "mine" ? "#2288cc" : theme === "temple" ? "#8822cc" : "#22cc88"}
              emissiveIntensity={0.8}
              transparent opacity={0.85} roughness={0.1} metalness={0.3}
            />
          </mesh>
          <mesh position={[0.15, 0.3, 0.1]} rotation={[0.2, 0.5, -0.15]} castShadow>
            <coneGeometry args={[0.1, 0.6, 6]} />
            <meshStandardMaterial
              color={theme === "mine" ? "#66ccff" : theme === "temple" ? "#cc66ff" : "#66ffcc"}
              emissive={theme === "mine" ? "#4499cc" : theme === "temple" ? "#9944cc" : "#44cc99"}
              emissiveIntensity={0.6}
              transparent opacity={0.8} roughness={0.1} metalness={0.3}
            />
          </mesh>
          <pointLight position={[0, 0.6, 0]}
            color={theme === "mine" ? "#44aaff" : theme === "temple" ? "#aa44ff" : "#44ffaa"}
            intensity={2} distance={6}
          />
        </group>
      );

    case "water_pool":
      return (
        <group position={position}>
          <mesh position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[scale, 24]} />
            <meshStandardMaterial color="#2244aa" emissive="#112255" emissiveIntensity={0.3}
              transparent opacity={0.7} roughness={0.1} metalness={0.2} />
          </mesh>
          <pointLight position={[0, 0.2, 0]} color="#3366cc" intensity={1} distance={scale * 2} />
        </group>
      );

    case "lava_pool":
      return (
        <group position={position}>
          <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[scale, 24]} />
            <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={2}
              transparent opacity={0.85} roughness={0.3} />
          </mesh>
          <pointLight position={[0, 0.5, 0]} color="#ff4400" intensity={4} distance={scale * 3} />
        </group>
      );

    case "rubble":
      return (
        <group position={position} rotation={[0, rotation, 0]}>
          {[
            [0, 0.08, 0, 0.2], [-0.15, 0.06, 0.1, 0.15], [0.1, 0.05, -0.12, 0.12],
            [0.18, 0.04, 0.08, 0.1], [-0.08, 0.06, -0.15, 0.14],
          ].map((r, i) => (
            <mesh key={i} position={[r[0], r[1], r[2]]} castShadow>
              <dodecahedronGeometry args={[r[3], 0]} />
              <meshStandardMaterial color="#555" roughness={0.95} />
            </mesh>
          ))}
        </group>
      );

    case "altar":
      return (
        <group position={position} rotation={[0, rotation, 0]} scale={[scale, scale, scale]}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[1.2, 0.6, 0.8]} />
            <meshStandardMaterial
              color={theme === "temple" ? "#4a4060" : "#5a5050"}
              roughness={0.7} metalness={0.15}
            />
          </mesh>
          <mesh position={[0, 0.65, 0]}>
            <boxGeometry args={[1.0, 0.05, 0.6]} />
            <meshStandardMaterial
              color={theme === "temple" ? "#8866aa" : "#887766"}
              roughness={0.5} metalness={0.3}
            />
          </mesh>
          <pointLight position={[0, 1.2, 0]}
            color={theme === "temple" ? "#8866ff" : "#ffaa44"}
            intensity={2} distance={6}
          />
        </group>
      );

    case "weapon_rack":
      return (
        <group position={position} rotation={[0, rotation, 0]}>
          <mesh position={[0, 1, 0]} castShadow>
            <boxGeometry args={[0.15, 2, 1.5]} />
            <meshStandardMaterial color="#4a3520" roughness={0.9} />
          </mesh>
          {[-0.4, 0, 0.4].map((zo, i) => (
            <mesh key={i} position={[0.1, 0.5 + i * 0.4, zo]} rotation={[0, 0, Math.PI / 6]}>
              <boxGeometry args={[0.04, 0.8, 0.04]} />
              <meshStandardMaterial color="#888" metalness={0.5} roughness={0.4} />
            </mesh>
          ))}
        </group>
      );

    default:
      return null;
  }
}

/**
 * Per-torch precomputed influence from a swaying hero chandelier. The
 * `weight` collapses distance falloff (subtle effect at ~6m, none past
 * the room) so the runtime hot loop is just a couple of multiplies and
 * a sin/cos per chandelier-torch pair.
 */
interface TorchSwayInfluence {
  phase: number;
  freq: number;
  weight: number;
}

const TORCH_SWAY_RANGE = 11; // metres — ~ "same room" reach for hero chandeliers
const TORCH_SWAY_BOOST_FRACTION = 0.18; // peak boost is 18% of base intensity (subtle)

/**
 * A wall-mounted flame light (torch / brazier) that gently brightens
 * when nearby hero-chandelier shadows sweep across it. The boost peaks
 * at the chandelier's swing extremes (where the swung shadow is moving
 * fastest) and decays smoothly between, so quiet rooms — where there
 * are no influences — stay perfectly steady.
 */
function TorchFlameLight({
  position,
  color,
  baseIntensity,
  distance,
  influences,
}: {
  position: [number, number, number];
  color: string;
  baseIntensity: number;
  distance: number;
  influences: TorchSwayInfluence[];
}) {
  const ref = useRef<THREE.PointLight>(null);
  const hasInfluence = influences.length > 0;

  useFrame((state) => {
    const light = ref.current;
    if (!light) return;
    if (!hasInfluence) {
      // No nearby chandelier — keep the torch perfectly steady so quiet
      // rooms don't acquire a phantom flicker.
      if (light.intensity !== baseIntensity) light.intensity = baseIntensity;
      return;
    }
    const t = state.clock.elapsedTime;
    let pulseSum = 0;
    for (const c of influences) {
      // |cos(t·f + φ)| peaks at the chandelier's sway extremes (when the
      // pendulum is at the top of its arc and the cast shadow is sweeping
      // back the other way). Threshold at 0.5 so only the peak portion
      // contributes — between peaks the torch returns to its base value.
      const pulse = Math.abs(Math.cos(t * c.freq + c.phase));
      const shaped = pulse > 0.5 ? (pulse - 0.5) * 2 : 0; // 0..1
      pulseSum += shaped * c.weight;
    }
    if (pulseSum > 1) pulseSum = 1;
    light.intensity = baseIntensity + baseIntensity * TORCH_SWAY_BOOST_FRACTION * pulseSum;
  });

  return (
    <pointLight
      ref={ref}
      position={position}
      color={color}
      intensity={baseIntensity}
      distance={distance}
    />
  );
}

const FLAME_DECOR_TYPES = new Set<DecorType>(["torch", "brazier"]);

function DungeonDecorItems({
  decor,
  theme,
  heroChandeliers,
}: {
  decor: DungeonDecor[];
  theme: DungeonTheme;
  heroChandeliers: ChandelierSwaySource[];
}) {
  const proceduralOnly = new Set<DecorType>([
    "sarcophagus", "minecart", "crystal", "water_pool",
    "lava_pool", "rubble",
  ]);

  // For each flame-light decor, precompute the small list of nearby hero
  // chandeliers (within TORCH_SWAY_RANGE) and their distance-falloff
  // weights. The hot useFrame loop on the torch then only iterates over
  // already-relevant sources.
  const torchInfluences = useMemo(() => {
    const map = new Map<number, TorchSwayInfluence[]>();
    if (heroChandeliers.length === 0) return map;
    const r2 = TORCH_SWAY_RANGE * TORCH_SWAY_RANGE;
    for (let i = 0; i < decor.length; i++) {
      const d = decor[i];
      if (!FLAME_DECOR_TYPES.has(d.type)) continue;
      const list: TorchSwayInfluence[] = [];
      for (const c of heroChandeliers) {
        const dx = d.x - c.x;
        const dz = d.z - c.z;
        const dist2 = dx * dx + dz * dz;
        if (dist2 > r2) continue;
        const dist = Math.sqrt(dist2);
        // Smooth falloff: 1 at the chandelier, 0 at the edge of range.
        const w = 1 - dist / TORCH_SWAY_RANGE;
        if (w <= 0) continue;
        list.push({ phase: c.phase, freq: c.freq, weight: w * w });
      }
      if (list.length > 0) map.set(i, list);
    }
    return map;
  }, [decor, heroChandeliers]);

  const destroyed = useDestroyedSet();

  return (
    <group>
      {decor.map((d, i) => {
        if (destroyed.has(i)) return null;
        const mapping = DECOR_TO_DUNGEON_ASSET[d.type];

        if (mapping) {
          const assetDef = resolveAssetDef(mapping.asset, mapping.source);
          if (assetDef) {
            const influences = torchInfluences.get(i);
            return (
              <Suspense key={`decor_${i}`} fallback={null}>
                <group>
                  <DungeonGLBDecor
                    path={assetDef.path}
                    position={[d.x, 0, d.z]}
                    height={mapping.height}
                    rotation={d.rotation}
                  />
                  {mapping.hasLight && (
                    <>
                      {FLAME_DECOR_TYPES.has(d.type) ? (
                        <TorchFlameLight
                          position={[d.x, mapping.height + 0.5, d.z]}
                          color={mapping.lightColor || "#ff6600"}
                          baseIntensity={mapping.lightIntensity || 3}
                          distance={8}
                          influences={influences ?? []}
                        />
                      ) : (
                        <pointLight
                          position={[d.x, mapping.height + 0.5, d.z]}
                          color={mapping.lightColor || "#ff6600"}
                          intensity={mapping.lightIntensity || 3}
                          distance={8}
                        />
                      )}
                      {d.type === "torch" && <TorchParticles position={[d.x, mapping.height, d.z]} />}
                    </>
                  )}
                </group>
              </Suspense>
            );
          }
        }

        if (proceduralOnly.has(d.type)) {
          return (
            <ProceduralDecor
              key={`decor_${i}`}
              type={d.type}
              position={[d.x, 0, d.z]}
              rotation={d.rotation}
              scale={d.scale || 1}
              theme={theme}
            />
          );
        }

        return null;
      })}
    </group>
  );
}

// Returns the key `<DungeonGLBDecor>` registers under, or `null` for
// procedural-only / non-blocking decor.
function dungeonDecorBBoxKey(d: DungeonDecor): string | null {
  const mapping = DECOR_TO_DUNGEON_ASSET[d.type];
  if (!mapping) return null;
  const assetDef = resolveAssetDef(mapping.asset, mapping.source);
  if (!assetDef) return null;
  return glbBboxKey(assetDef.path, mapping.height);
}

// `null` = non-blocking decor or GLB not loaded yet.
function resolveDecorCollider(d: DungeonDecor): DecorBBox | null {
  return resolveDecorBBox(d, dungeonDecorBBoxKey);
}

/**
 * Mounts one `<RigidBody>+<CuboidCollider>` per dungeon decor placement
 * that has an entry in `DECOR_COLLIDERS`. The body is rotated by the
 * placement's yaw so non-axis-aligned decor (e.g. a sarcophagus rotated
 * 45°) blocks the player along its real silhouette, matching the
 * oriented box drawn by the F8 overlay. Decor without a spec is
 * intentionally non-blocking and produces nothing here.
 *
 * Visuals (`<DungeonDecorItems>`) are still rendered separately — this
 * component only provides the physics shells.
 */
function DungeonDecorColliders({ decor }: { decor: DungeonDecor[] }) {
  // Re-render when a fresh GLB lands or a decor is destroyed.
  useGLBBboxRegistry((s) => s.version);
  const destroyed = useDestroyedSet();
  return (
    <group>
      {decor.map((d, i) => {
        if (destroyed.has(i)) return null;
        const c = resolveDecorCollider(d);
        if (!c) return null;
        return (
          <RigidBody
            key={`decor_col_${i}`}
            type="fixed"
            position={[d.x, c.cy, d.z]}
            rotation={[0, d.rotation, 0]}
            colliders={false}
          >
            <CuboidCollider args={[c.hx, c.hy, c.hz]} />
          </RigidBody>
        );
      })}
    </group>
  );
}

/**
 * Registration-only F8 source for dungeon decor placements.
 *
 * Reads the same `DECOR_COLLIDERS` table that drives the runtime
 * physics in `<DungeonDecorColliders>` and registers a
 * `DebugColliderEntry` per blocking decor as a yawed oriented box. As a
 * result the overlay shows exactly what the player can collide with —
 * non-blocking decor (banners, torches, loot, pools, …) produces no
 * collider AND no overlay box. The `decor_<type>` name keeps the
 * overlay's hashed colour grouping per decor type intact.
 *
 * Gated on the F8 cheat; production runs build no entries. Mirror of
 * `<DungeonTileGridDebugSource>`: renders nothing, expects one
 * `<RegisteredDebugColliderOverlay>` per scene downstream.
 */
function DungeonDecorDebugSource({ decor }: { decor: DungeonDecor[] }) {
  const debugOn = useCheats((s) => s.enabled && s.debugColliders);
  // Stay aligned with the live colliders as GLBs load / decor breaks.
  const bboxVersion = useGLBBboxRegistry((s) => s.version);
  const destroyed = useDestroyedSet();
  const entries = useMemo<DebugColliderEntry[] | null>(() => {
    if (!debugOn || decor.length === 0) return null;
    const out: DebugColliderEntry[] = [];
    for (let i = 0; i < decor.length; i++) {
      if (destroyed.has(i)) continue;
      const d = decor[i];
      const c = resolveDecorCollider(d);
      if (!c) continue;
      const { vertices, indices, bbox: aabb } = buildOrientedBoxDebugTrimesh(
        d.x, c.cy, d.z,
        c.hx, c.hy, c.hz,
        d.rotation,
      );
      out.push({
        name: `decor_${d.type}`,
        vertices, indices, bbox: aabb,
      });
    }
    return out;
  }, [debugOn, decor, bboxVersion, destroyed]);
  useDebugColliderRegistration("DungeonDecor", entries);
  return null;
}

function ExitPortal({ position, playerPosition, theme }: {
  position: [number, number, number]; playerPosition: THREE.Vector3; theme: DungeonTheme;
}) {
  const portalRef = useRef<THREE.Mesh>(null);
  const { exitDungeon, addScore } = useGame();
  const exitCooldown = useRef(false);
  const tc = THEME_COLORS[theme];

  useFrame(() => {
    if (!portalRef.current) return;
    portalRef.current.rotation.y += 0.02;

    const dist = playerPosition.distanceTo(new THREE.Vector3(...position));
    if (dist < 3 && !exitCooldown.current) {
      const exitKey = (window as any).__dungeonExit;
      if (exitKey) {
        exitCooldown.current = true;
        addScore(50);
        exitDungeon();
      }
    }
  });

  return (
    <group position={position}>
      <mesh ref={portalRef} position={[0, 2, 0]}>
        <torusGeometry args={[1.5, 0.25, 16, 32]} />
        <meshStandardMaterial color={tc.portalColor} emissive={tc.portalEmissive} emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <circleGeometry args={[1.2, 32]} />
        <meshStandardMaterial color={tc.portalColor} emissive={tc.portalEmissive} emissiveIntensity={2} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, 2.5, 0]} color={tc.portalColor} intensity={5} distance={10} />
      <sprite position={[0, 4.5, 0]} scale={[3, 0.6, 1]}>
        <spriteMaterial map={createTextTex("[Press T to Exit]")} transparent />
      </sprite>
    </group>
  );
}

function DungeonInteractionHandler() {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "KeyT") {
        (window as any).__dungeonInteract = true;
        (window as any).__dungeonExit = true;
        setTimeout(() => {
          (window as any).__dungeonInteract = false;
          (window as any).__dungeonExit = false;
        }, 200);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
  return null;
}

function DungeonEnemySpawner({ layout }: { layout: DungeonLayout }) {
  const { spawnEnemy } = useEnemyManager();
  const spawned = useRef(false);

  useEffect(() => {
    if (spawned.current) return;
    spawned.current = true;

    layout.enemySpawns.forEach((spawn, i) => {
      setTimeout(() => {
        spawnEnemy(spawn.type as any, new THREE.Vector3(spawn.x, 0.5, spawn.z));
      }, i * 100);
    });
  }, [layout, spawnEnemy]);

  return null;
}

function DungeonLighting({ theme }: { theme: DungeonTheme }) {
  const tc = THEME_COLORS[theme];
  return (
    <group>
      <ambientLight intensity={tc.ambientIntensity} color={tc.ambient} />
      {/*
        Soft sky/ground hemisphere fill on top of the flat ambient. This
        makes floors slightly brighter than ceilings even where no torch
        is nearby, so silhouettes pop and dungeons read at a glance
        without flattening the moody palette.
      */}
      <hemisphereLight
        args={[tc.ambient, "#0a0a10", tc.ambientIntensity * 0.9]}
      />
      <directionalLight
        position={[10, 20, 10]}
        intensity={tc.directionalIntensity}
        color={tc.directionalColor}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
    </group>
  );
}

/**
 * Per-theme accent tint for the alternating ceiling tile, applied on top of
 * the shared masonry texture as a color multiplier. Slightly lighter than
 * the base `theme.ceiling` tint so the modular grid reads but stays
 * atmospheric.
 */
const CEILING_ACCENT: Record<DungeonTheme, string> = {
  crypt: "#6a6a78",
  mine: "#8a7a60",
  temple: "#8a8a98",
};

/**
 * Per-theme base tint applied on top of the shared masonry diffuse so the
 * ceiling matches the rest of the room palette while still showing real
 * brick/stone detail.
 */
const CEILING_BASE_TINT: Record<DungeonTheme, string> = {
  crypt: "#4a4a55",
  mine: "#6a5a40",
  temple: "#5e5c6a",
};

/**
 * Per-theme tiling masonry texture for the ceiling. Each theme picks a
 * brick/stone texture from the existing `client/public/textures` library
 * so the overhead surface reads as real masonry and matches the modular
 * floor's level of detail.
 */
const CEILING_TEXTURE: Record<DungeonTheme, { map: string; normal?: string }> = {
  crypt: { map: "/textures/threejs-games/walls/old-bricks.jpg" },
  mine: { map: "/textures/threejs-games/walls/bricks.jpg" },
  temple: {
    map: "/textures/threejs-games/walls/stonetiles.jpg",
    normal: "/textures/threejs-games/walls/stonetiles_n.jpg",
  },
};

/**
 * Per-theme alternate masonry texture used for "cracked" damaged ceiling
 * tiles. A distinct but tonally compatible brick/stone variant so the
 * damaged tile reads as broken masonry of the same wall, not a foreign
 * material.
 */
const CEILING_DAMAGED_TEXTURE: Record<DungeonTheme, { map: string; normal?: string }> = {
  crypt: { map: "/textures/threejs-games/walls/cave.jpg" },
  mine: { map: "/textures/threejs-games/walls/stone-wall.jpg" },
  temple: { map: "/textures/threejs-games/walls/concrete_wall_2b.jpg" },
};

/**
 * Per-theme tint multiplier for "stained" ceiling tiles — reuses the base
 * diffuse map but darkens it heavily to read as soot or water staining.
 */
const CEILING_STAIN_TINT: Record<DungeonTheme, string> = {
  crypt: "#1a1820",
  mine: "#1c1610",
  temple: "#1c1c24",
};

/**
 * Color used for "hole" ceiling tiles — near-black so the tile reads as
 * a missing brick opening to the dark void above. No texture map.
 */
const CEILING_HOLE_COLOR = "#050505";

/**
 * Theme-tinted color of the volumetric light shaft that drips from each
 * ceiling hole tile down to the floor. Cool moonlight in crypt, warm
 * filtered sunlight in mine, pale celestial blue-white in temple.
 */
const CEILING_HOLE_BEAM_COLOR: Record<DungeonTheme, string> = {
  crypt: "#a8c8ff",
  mine: "#ffcc88",
  temple: "#dde6ff",
};

const CEILING_THICKNESS = 0.2;
// Center the ceiling slab so its bottom face sits flush at WALL_HEIGHT,
// avoiding any visible overlap/clipping with the top of wall pieces.
const CEILING_Y = WALL_HEIGHT + CEILING_THICKNESS / 2;

/**
 * Hash a tile's grid coordinate into a stable rotation step (0..3) so each
 * instance's masonry texture is rotated by 0/90/180/270°. This breaks the
 * obvious repeating seam that would appear if every tile used the same
 * UV orientation.
 */
function tileRotationStep(tx: number, tz: number): number {
  // Cheap deterministic hash; integers only.
  const h = (tx * 73856093) ^ (tz * 19349663);
  return ((h >>> 0) & 0x3);
}

/**
 * Independent deterministic hash used to assign damaged-tile variants.
 * Uses different prime constants from `tileRotationStep` so rotation and
 * variant assignment aren't correlated.
 */
function tileVariantHash(tx: number, tz: number): number {
  const h = (tx * 2654435761) ^ (tz * 40503);
  return (h >>> 0) % 100;
}

type CeilingVariant = "base" | "accent" | "cracked" | "stained" | "hole";

// Damage budget (percent of all ceiling tiles). Same dungeon layout always
// produces the same damaged tiles thanks to the deterministic hash above.
const CEILING_HOLE_PCT = 2;        // ~2% missing-brick holes
const CEILING_STAINED_PCT = 3;     // ~3% sooty stained tiles
const CEILING_CRACKED_PCT = 5;     // ~5% cracked masonry tiles
// Total damage ~10% — keeps the modular grid readable while breaking up
// the regular pattern with visual storytelling.

function ceilingVariantForTile(tx: number, tz: number): CeilingVariant {
  const r = tileVariantHash(tx, tz);
  if (r < CEILING_HOLE_PCT) return "hole";
  if (r < CEILING_HOLE_PCT + CEILING_STAINED_PCT) return "stained";
  if (r < CEILING_HOLE_PCT + CEILING_STAINED_PCT + CEILING_CRACKED_PCT) {
    return "cracked";
  }
  return ((tx + tz) & 1) === 0 ? "accent" : "base";
}

/**
 * GLB used for the rubble pile placed under each "hole" ceiling tile —
 * shares the asset with the rest of the KayKit dungeon kit so the debris
 * reads as masonry that fell from the ceiling above.
 */
const KK_SHATTERED_BRICKS_PATH =
  "/models/dungeon_kaykit/floorDecoration_shatteredBricks.glb";

/**
 * Per-theme dark stain color used for the floor decal that mirrors a
 * "stained" ceiling tile overhead — soot or water dripping down onto the
 * floor. Slightly darker than the ceiling stain so it reads on top of the
 * lighter floor masonry.
 */
const FLOOR_STAIN_COLOR: Record<DungeonTheme, string> = {
  crypt: "#0a0a10",
  mine: "#0c0805",
  temple: "#0c0c14",
};

/**
 * Lift floor decals a hair above the modular floor surface (y=0) to avoid
 * z-fighting with the underlying floor tile mesh.
 */
const FLOOR_DECAL_Y = 0.015;

/**
 * Places a fallen-rubble pile under each "hole" ceiling tile and a dark
 * stain decal under each "stained" ceiling tile. Uses the exact same
 * deterministic hashes as `DungeonCeiling` (`ceilingVariantForTile` and
 * `tileRotationStep`) so the floor damage always lines up perfectly with
 * the matching ceiling tile overhead — telling the visual story that the
 * ceiling crumbled or leaked onto the floor below. Same dungeon layout
 * always produces the same paired damage on a replay.
 *
 * Rubble piles flow through the existing modular decoration pipeline
 * (instanced GLB placements) so a dungeon with many holes still issues
 * only one extra draw call per inner mesh of the GLB. Stains render as a
 * single InstancedMesh of a thin dark circle decal.
 */
function DungeonCeilingFloorDamage({
  grid,
  theme,
}: {
  grid: TileGrid;
  theme: DungeonTheme;
}) {
  const { rubblePlacements, stainTiles } = useMemo(() => {
    const rubble: ModularDecorPlacement[] = [];
    const stains: Array<[number, number]> = [];
    for (const t of grid.tiles) {
      const variant = ceilingVariantForTile(t.tx, t.tz);
      if (variant === "hole") {
        // Rotate the rubble pile by a stable per-tile step so identical
        // assets don't visually repeat in clusters.
        const rot = (tileRotationStep(t.tx, t.tz) * Math.PI) / 2;
        rubble.push({
          path: KK_SHATTERED_BRICKS_PATH,
          position: [t.wx, FLOOR_DECAL_Y, t.wz],
          rotation: rot,
          fit: "floorTile",
        });
      } else if (variant === "stained") {
        // Stains are rotationally symmetric circular decals, so no
        // per-tile yaw is stored — it would be a visual no-op.
        stains.push([t.wx, t.wz]);
      }
    }
    return { rubblePlacements: rubble, stainTiles: stains };
  }, [grid]);

  const stainGeom = useMemo(
    () => new THREE.CircleGeometry(TILE_SIZE * 0.42, 24),
    [],
  );
  useEffect(() => () => stainGeom.dispose(), [stainGeom]);

  const stainRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = stainRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const e = new THREE.Euler();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    // CircleGeometry is authored on the XY plane, so rotate -90° about X
    // to lay it flat on the floor's XZ plane.
    e.set(-Math.PI / 2, 0, 0);
    q.setFromEuler(e);
    for (let i = 0; i < stainTiles.length; i++) {
      const [wx, wz] = stainTiles[i];
      p.set(wx, FLOOR_DECAL_Y, wz);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.count = stainTiles.length;
    mesh.instanceMatrix.needsUpdate = true;
    // Rebuild the bounds so the instanced mesh frustum-culls correctly on
    // very large dungeons.
    mesh.computeBoundingSphere();
  }, [stainTiles]);

  return (
    <group>
      {rubblePlacements.length > 0 && (
        <Suspense fallback={null}>
          <DungeonModularDecorations placements={rubblePlacements} />
        </Suspense>
      )}
      {stainTiles.length > 0 && (
        <instancedMesh
          ref={stainRef}
          args={[
            stainGeom,
            undefined as unknown as THREE.Material,
            stainTiles.length,
          ]}
          receiveShadow
        >
          <meshStandardMaterial
            color={FLOOR_STAIN_COLOR[theme]}
            roughness={1.0}
            metalness={0.0}
            transparent
            opacity={0.78}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </instancedMesh>
      )}
    </group>
  );
}

/**
 * Modular tiled ceiling: one ceiling slab per tile, textured with a
 * tiling brick/stone material per theme so the overhead surface reads as
 * real masonry. A subtle 2-color tint variation preserves the modular
 * grid pattern.
 *
 * On top of the alternating base/accent tiles, ~10% of tiles are seeded
 * (deterministically by tile coordinate) into damaged variants for visual
 * storytelling — cracked masonry (alternate brick texture), sooty stains
 * (darkly tinted base texture), and missing-brick holes (near-black void).
 * Same dungeon layout always produces the same damage so a replay reads
 * consistently.
 *
 * Rendered as up to five InstancedMeshes (base + accent + cracked +
 * stained + hole) with per-instance UV rotation so even very large
 * dungeons stay cheap and seam-free — one batch per variant keeps draw
 * call count flat regardless of dungeon size.
 */
function DungeonCeiling({ grid, theme }: { grid: TileGrid; theme: DungeonTheme }) {
  const baseTint = CEILING_BASE_TINT[theme];
  const accentTint = CEILING_ACCENT[theme];
  const stainTint = CEILING_STAIN_TINT[theme];
  const texCfg = CEILING_TEXTURE[theme];
  const damagedCfg = CEILING_DAMAGED_TEXTURE[theme];

  const texPaths = useMemo(() => {
    const paths: string[] = [texCfg.map];
    if (texCfg.normal) paths.push(texCfg.normal);
    paths.push(damagedCfg.map);
    if (damagedCfg.normal) paths.push(damagedCfg.normal);
    return paths;
  }, [texCfg.map, texCfg.normal, damagedCfg.map, damagedCfg.normal]);
  const loaded = useTexture(texPaths);
  const textures = Array.isArray(loaded) ? loaded : [loaded];
  let idx = 0;
  const diffuseMap = textures[idx++];
  const normalMap = texCfg.normal ? textures[idx++] : undefined;
  const damagedMap = textures[idx++];
  const damagedNormalMap = damagedCfg.normal ? textures[idx++] : undefined;

  // Configure tiling. UV repeat of 1 means the texture covers a single tile
  // exactly once, matching the modular grid cell. Rotation is applied
  // per-instance via the geometry matrix below.
  useEffect(() => {
    const configure = (tex?: THREE.Texture) => {
      if (!tex) return;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 8;
      tex.needsUpdate = true;
    };
    configure(diffuseMap);
    configure(normalMap);
    configure(damagedMap);
    configure(damagedNormalMap);
  }, [diffuseMap, normalMap, damagedMap, damagedNormalMap]);

  const variantTiles = useMemo(() => {
    const buckets: Record<CeilingVariant, Array<[number, number, number]>> = {
      base: [],
      accent: [],
      cracked: [],
      stained: [],
      hole: [],
    };
    for (const t of grid.tiles) {
      const variant = ceilingVariantForTile(t.tx, t.tz);
      const rot = tileRotationStep(t.tx, t.tz);
      buckets[variant].push([t.wx, t.wz, rot]);
    }
    return buckets;
  }, [grid]);

  const geom = useMemo(() => new THREE.BoxGeometry(TILE_SIZE, CEILING_THICKNESS, TILE_SIZE), []);
  useEffect(() => () => geom.dispose(), [geom]);

  const baseRef = useRef<THREE.InstancedMesh>(null);
  const accentRef = useRef<THREE.InstancedMesh>(null);
  const crackedRef = useRef<THREE.InstancedMesh>(null);
  const stainedRef = useRef<THREE.InstancedMesh>(null);
  const holeRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const m = new THREE.Matrix4();
    const e = new THREE.Euler();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3(1, 1, 1);
    const apply = (
      mesh: THREE.InstancedMesh | null,
      tiles: Array<[number, number, number]>,
    ) => {
      if (!mesh) return;
      for (let i = 0; i < tiles.length; i++) {
        const [wx, wz, rot] = tiles[i];
        pos.set(wx, CEILING_Y, wz);
        e.set(0, (rot * Math.PI) / 2, 0);
        q.setFromEuler(e);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i, m);
      }
      mesh.count = tiles.length;
      mesh.instanceMatrix.needsUpdate = true;
    };
    apply(baseRef.current, variantTiles.base);
    apply(accentRef.current, variantTiles.accent);
    apply(crackedRef.current, variantTiles.cracked);
    apply(stainedRef.current, variantTiles.stained);
    apply(holeRef.current, variantTiles.hole);
  }, [variantTiles]);

  return (
    <group>
      {variantTiles.base.length > 0 && (
        <instancedMesh
          ref={baseRef}
          args={[geom, undefined as unknown as THREE.Material, variantTiles.base.length]}
          receiveShadow
        >
          <meshStandardMaterial
            map={diffuseMap}
            normalMap={normalMap}
            color={baseTint}
            roughness={0.95}
            metalness={0.05}
          />
        </instancedMesh>
      )}
      {variantTiles.accent.length > 0 && (
        <instancedMesh
          ref={accentRef}
          args={[geom, undefined as unknown as THREE.Material, variantTiles.accent.length]}
          receiveShadow
        >
          <meshStandardMaterial
            map={diffuseMap}
            normalMap={normalMap}
            color={accentTint}
            roughness={0.95}
            metalness={0.05}
          />
        </instancedMesh>
      )}
      {variantTiles.cracked.length > 0 && (
        <instancedMesh
          ref={crackedRef}
          args={[geom, undefined as unknown as THREE.Material, variantTiles.cracked.length]}
          receiveShadow
        >
          <meshStandardMaterial
            map={damagedMap}
            normalMap={damagedNormalMap}
            color={baseTint}
            roughness={1.0}
            metalness={0.02}
          />
        </instancedMesh>
      )}
      {variantTiles.stained.length > 0 && (
        <instancedMesh
          ref={stainedRef}
          args={[geom, undefined as unknown as THREE.Material, variantTiles.stained.length]}
          receiveShadow
        >
          <meshStandardMaterial
            map={diffuseMap}
            normalMap={normalMap}
            color={stainTint}
            roughness={1.0}
            metalness={0.0}
          />
        </instancedMesh>
      )}
      {variantTiles.hole.length > 0 && (
        <instancedMesh
          ref={holeRef}
          args={[geom, undefined as unknown as THREE.Material, variantTiles.hole.length]}
          receiveShadow
        >
          <meshStandardMaterial
            color={CEILING_HOLE_COLOR}
            roughness={1.0}
            metalness={0.0}
          />
        </instancedMesh>
      )}
    </group>
  );
}

/**
 * A single hanging chain rendered as a thin vertical cylinder. Used to
 * suspend ceiling props (chandeliers, planks, cages) from the ceiling.
 */
function HangingChain({ length, x = 0, z = 0 }: { length: number; x?: number; z?: number }) {
  return (
    <mesh position={[x, -length / 2, z]}>
      <cylinderGeometry args={[0.03, 0.03, length, 6]} />
      <meshStandardMaterial color="#222" metalness={0.7} roughness={0.5} />
    </mesh>
  );
}

/**
 * A temple chandelier: a metal ring with candles around it, suspended
 * from the ceiling on a short chain. Pivot is at y=0 (ceiling) so the
 * parent group can pendulum-rotate it.
 */
function TempleChandelier({ hero = false }: { hero?: boolean } = {}) {
  const ringY = -1.2;
  const candles = useMemo(() => {
    const arr: Array<{ x: number; z: number; phase: number; freq: number }> = [];
    const r = 0.55;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      // Per-candle phase + slightly varied base freq so flames never
      // pulse in lockstep — keeps the chandelier feeling alive.
      arr.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        phase: i * 1.37,
        freq: 1.7 + (i % 3) * 0.35,
      });
    }
    return arr;
  }, []);

  // Refs into each flame's material + mesh so we can drive a gentle
  // emissive-intensity (and barely-perceptible scale) flicker each
  // frame without forcing React re-renders.
  const flameMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const flameMeshRefs = useRef<Array<THREE.Mesh | null>>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < candles.length; i++) {
      const mat = flameMatRefs.current[i];
      if (!mat) continue;
      const c = candles[i];
      // Two-octave sine combination: low amplitude, never strobe-like.
      // Total range: ~1.74..2.26 around the original 2.0 baseline.
      const flicker =
        Math.sin(t * c.freq + c.phase) * 0.18 +
        Math.sin(t * c.freq * 2.7 + c.phase * 1.6) * 0.09;
      mat.emissiveIntensity = 2 + flicker;
      const mesh = flameMeshRefs.current[i];
      if (mesh) {
        // Very mild scale jitter (<5%) sells the flicker without making
        // the flame visibly throb.
        mesh.scale.setScalar(1 + flicker * 0.04);
      }
    }
  });

  return (
    <group>
      <HangingChain length={-ringY} />
      <mesh position={[0, ringY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.6, 0.04, 6, 24]} />
        <meshStandardMaterial color="#665533" metalness={0.7} roughness={0.4} />
      </mesh>
      {candles.map((c, i) => (
        <group key={i} position={[c.x, ringY, c.z]}>
          <mesh position={[0, 0.12, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.24, 6]} />
            <meshStandardMaterial color="#e6d8aa" roughness={0.85} />
          </mesh>
          <mesh
            position={[0, 0.3, 0]}
            ref={(m) => { flameMeshRefs.current[i] = m; }}
          >
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshStandardMaterial
              ref={(m) => { flameMatRefs.current[i] = m; }}
              color="#ffaa44"
              emissive="#ffaa44"
              emissiveIntensity={2}
            />
          </mesh>
        </group>
      ))}
      {hero ? (
        <pointLight
          position={[0, ringY + 0.2, 0]}
          color="#ffcc66"
          intensity={3.5}
          distance={11}
          castShadow
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
          shadow-bias={-0.002}
          shadow-normalBias={0.05}
          shadow-camera-near={0.2}
          shadow-camera-far={11}
          shadow-radius={3}
        />
      ) : (
        <pointLight position={[0, ringY + 0.2, 0]} color="#ffcc66" intensity={3} distance={9} />
      )}
    </group>
  );
}

/**
 * A mine ceiling prop: a broken wooden plank with collapsed scaffolding
 * dangling on two short chains. Pivot is at y=0 (ceiling).
 */
function MineHangingPlank({ rotation = 0 }: { rotation?: number }) {
  const plankY = -1.1;
  return (
    <group rotation={[0, rotation, 0]}>
      <HangingChain length={-plankY} x={-0.6} />
      <HangingChain length={-plankY} x={0.6} />
      <mesh position={[0, plankY, 0]} rotation={[0, 0, 0.08]} castShadow>
        <boxGeometry args={[1.6, 0.1, 0.35]} />
        <meshStandardMaterial color="#5a3a20" roughness={0.95} />
      </mesh>
      <mesh position={[0.2, plankY - 0.18, 0.05]} rotation={[0.2, 0.4, -0.1]} castShadow>
        <boxGeometry args={[0.7, 0.08, 0.3]} />
        <meshStandardMaterial color="#4a2f1a" roughness={0.95} />
      </mesh>
    </group>
  );
}

/**
 * A crypt cobweb: a translucent inverted cone hugging the ceiling.
 * Pivot is at y=0 (ceiling). Atmospheric only, no light.
 */
function CryptCobweb({ scale = 1 }: { scale?: number }) {
  return (
    <group position={[0, -0.05, 0]} scale={[scale, scale, scale]}>
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.7, 0.9, 8, 1, true]} />
        <meshStandardMaterial
          color="#cccccc"
          transparent
          opacity={0.25}
          roughness={1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, -0.45, 0]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#222" roughness={1} />
      </mesh>
    </group>
  );
}

/**
 * Ambient creak sources for swaying ceiling props. Uses the WebAudio API
 * directly (no asset file required): a short noise+sine creak buffer is
 * synthesized once on mount and looped through one BufferSource + Gain
 * per source. Each frame the gain is recomputed from the camera distance
 * so the sound attenuates naturally and never stacks loudly. Respects
 * the global useAudio.isMuted toggle.
 */
const MAX_CREAK_SOURCES = 3;
const CREAK_REF_DISTANCE = 3;
const CREAK_MAX_DISTANCE = 14;
const CREAK_BASE_VOLUME = 0.18;

function buildCreakBuffer(ctx: AudioContext): AudioBuffer {
  // ~3.1s loop. Filtered noise envelope shaped like a slow rope creak,
  // with a low sine tone underneath for the woody groan.
  const sr = ctx.sampleRate;
  const length = Math.floor(sr * 3.1);
  const buf = ctx.createBuffer(1, length, sr);
  const data = buf.getChannelData(0);
  // Simple 1-pole low-pass on white noise.
  let lp = 0;
  const lpA = 0.04;
  for (let i = 0; i < length; i++) {
    const t = i / sr;
    const noise = Math.random() * 2 - 1;
    lp += (noise - lp) * lpA;
    // Two creak "events" per loop.
    const e1 = Math.exp(-Math.pow((t - 0.6) / 0.35, 2));
    const e2 = Math.exp(-Math.pow((t - 2.1) / 0.45, 2)) * 0.8;
    const env = e1 + e2;
    const groan = Math.sin(2 * Math.PI * (60 + 8 * Math.sin(t * 1.1)) * t) * 0.25;
    data[i] = (lp * 0.85 + groan) * env;
  }
  return buf;
}

function CeilingCreaks({ positions }: { positions: Array<[number, number, number]> }) {
  const camera = useThree((s) => s.camera);
  const isMuted = useAudio((s) => s.isMuted);
  const settingsMuted = useSettings((s) => s.audio.muted);
  const masterVolume = useSettings((s) => s.audio.masterVolume);
  const ambientVolume = useSettings((s) => s.audio.ambientVolume);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const sourcesRef = useRef<Array<{ gain: GainNode; pos: THREE.Vector3 }>>([]);
  const tmpVec = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const Ctor = (window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return;
    const ctx = new Ctor();
    ctxRef.current = ctx;
    const buffer = buildCreakBuffer(ctx);
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    masterGainRef.current = master;

    const list: Array<{ gain: GainNode; pos: THREE.Vector3 }> = [];
    positions.slice(0, MAX_CREAK_SOURCES).forEach((p, i) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(g).connect(master);
      // Stagger so the creaks never line up.
      const offset = (i * 0.97) % buffer.duration;
      try { src.start(0, offset); } catch { /* ignore */ }
      list.push({ gain: g, pos: new THREE.Vector3(p[0], p[1], p[2]) });
    });
    sourcesRef.current = list;

    return () => {
      list.forEach(({ gain }) => {
        try { gain.disconnect(); } catch { /* ignore */ }
      });
      try { master.disconnect(); } catch { /* ignore */ }
      ctx.close().catch(() => { /* ignore */ });
      ctxRef.current = null;
      masterGainRef.current = null;
      sourcesRef.current = [];
    };
  }, [positions]);

  useEffect(() => {
    const master = masterGainRef.current;
    const ctx = ctxRef.current;
    if (!master || !ctx) return;
    // Combine the legacy useAudio mute toggle with the richer useSettings
    // audio model (master * ambient volumes + its own mute flag) so the
    // creak system honors whichever volume controls the user touches.
    const muted = isMuted || settingsMuted;
    const target = muted ? 0 : Math.max(0, Math.min(1, masterVolume * ambientVolume));
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.25);
  }, [isMuted, settingsMuted, masterVolume, ambientVolume]);

  useFrame(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const camPos = camera.position;
    for (const { gain, pos } of sourcesRef.current) {
      const d = tmpVec.subVectors(pos, camPos).length();
      let v: number;
      if (d <= CREAK_REF_DISTANCE) v = 1;
      else if (d >= CREAK_MAX_DISTANCE) v = 0;
      else v = 1 - (d - CREAK_REF_DISTANCE) / (CREAK_MAX_DISTANCE - CREAK_REF_DISTANCE);
      const target = v * v * CREAK_BASE_VOLUME;
      gain.gain.setTargetAtTime(target, now, 0.15);
    }
  });

  return null;
}

interface CeilingPropPlacement {
  kind: "chandelier" | "plank" | "cobweb";
  x: number;
  z: number;
  rotation: number;
  scale: number;
  phase: number;
  axis: 0 | 1;
  amp: number;
  freq: number;
  key: string;
  hero?: boolean;
}

const MAX_HERO_CHANDELIERS = 4;

/**
 * Pure helper that produces the deterministic ceiling-prop layout for
 * a dungeon. Lifted out of `DungeonCeilingProps` so that other systems
 * (e.g. wall torches modulating with chandelier sway) can derive the
 * same hero-chandelier sources without re-running the seeded RNG with
 * different state.
 */
function buildCeilingPlacements(rooms: DungeonRoom[], theme: DungeonTheme): CeilingPropPlacement[] {
  const out: CeilingPropPlacement[] = [];
  let seed = (91913 ^ rooms.length) >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed & 0xffffff) / 0xffffff;
  };

  const pushSway = (
    base: Omit<CeilingPropPlacement, "phase" | "axis" | "amp" | "freq">,
  ): CeilingPropPlacement => ({
    ...base,
    phase: rng() * Math.PI * 2,
    axis: rng() > 0.5 ? 1 : 0,
    // Cobwebs barely move; chandeliers/planks sway a touch more.
    amp: (base.kind === "cobweb" ? 0.012 : 0.03) + rng() * 0.02,
    freq: 0.45 + rng() * 0.35,
  });

  for (const room of rooms) {
    if (room.type === "corridor") continue;
    const tiles = room.width * room.depth;
    if (tiles < 16) continue; // skip tiny rooms

    const cx = room.x + room.width / 2;
    const cz = room.z + room.depth / 2;
    const inset = 1.5; // keep props off walls
    const halfW = Math.max(0, room.width / 2 - inset);
    const halfD = Math.max(0, room.depth / 2 - inset);

    if (theme === "temple") {
      out.push({
        ...pushSway({
          kind: "chandelier",
          x: cx,
          z: cz,
          rotation: 0,
          scale: 1,
          key: `chand_${room.x}_${room.z}`,
        }),
        hero: true,
      });
      if (tiles >= 36) {
        out.push(pushSway({
          kind: "chandelier",
          x: cx + (rng() - 0.5) * halfW,
          z: cz + (rng() - 0.5) * halfD,
          rotation: 0,
          scale: 1,
          key: `chand2_${room.x}_${room.z}`,
        }));
      }
    } else if (theme === "mine") {
      const count = tiles >= 36 ? 3 : 2;
      for (let i = 0; i < count; i++) {
        out.push(pushSway({
          kind: "plank",
          x: cx + (rng() - 0.5) * halfW * 1.2,
          z: cz + (rng() - 0.5) * halfD * 1.2,
          rotation: rng() * Math.PI,
          scale: 1,
          key: `plank_${room.x}_${room.z}_${i}`,
        }));
      }
    } else {
      const count = tiles >= 36 ? 4 : 3;
      for (let i = 0; i < count; i++) {
        out.push(pushSway({
          kind: "cobweb",
          x: cx + (rng() - 0.5) * halfW * 1.4,
          z: cz + (rng() - 0.5) * halfD * 1.4,
          rotation: 0,
          scale: 0.7 + rng() * 0.6,
          key: `web_${room.x}_${room.z}_${i}`,
        }));
      }
    }
  }
  // Cap the number of hero (shadow-casting) chandeliers across the whole
  // dungeon to keep shadow-map perf bounded. The first MAX_HERO_CHANDELIERS
  // hero-flagged placements keep their flag; the rest fall back to the
  // cheap non-shadow point light.
  let heroCount = 0;
  for (const p of out) {
    if (p.hero) {
      if (heroCount >= MAX_HERO_CHANDELIERS) p.hero = false;
      else heroCount++;
    }
  }
  return out;
}

/**
 * A single hero chandelier exposed as a sway source for downstream
 * effects (wall-torch brightening, etc.). Only includes the data
 * needed to reproduce the chandelier's instantaneous sway phase.
 */
export interface ChandelierSwaySource {
  x: number;
  z: number;
  phase: number;
  freq: number;
}

/**
 * Populates larger rooms with theme-appropriate hanging ceiling props
 * and gives each one a low-amplitude pendulum sway with per-instance
 * phase offsets. Placement is deterministic via a seeded RNG so layouts
 * stay stable across remounts. Sway uses a single useFrame loop and
 * direct ref mutation to keep large dungeons performant.
 */
/**
 * Per-kind hanging offset (negative Y from CEILING_Y, where the
 * dangling visual centroid sits) and collider half-extents used by
 * both the destructibles registry and the F8 overlay.
 */
const CEILING_PROP_PHYSICS: Record<
  CeilingPropPlacement["kind"],
  { hangY: number; hx: number; hy: number; hz: number; hp: number; mass: number; falls: boolean }
> = {
  // Heavy iron ring with candles — a meaty target you can knock down.
  chandelier: { hangY: -1.2, hx: 0.7, hy: 0.25, hz: 0.7, hp: 30, mass: 25, falls: true },
  // Plank dangling on two chains. Long & flat.
  plank: { hangY: -1.1, hx: 0.85, hy: 0.2, hz: 0.25, hp: 18, mass: 12, falls: true },
  // Cobweb is fluff — one good swing turns it to dust, no fall.
  cobweb: { hangY: -0.3, hx: 0.45, hy: 0.45, hz: 0.45, hp: 4, mass: 0, falls: false },
};

/**
 * One ceiling prop. While alive: attached to the ceiling, swaying via
 * its parent group. When destroyed by a melee swing:
 *   - cobwebs vanish silently;
 *   - chandeliers / planks switch to a dynamic rigid body and drop to
 *     the floor with full physics so they crash convincingly.
 */
function CeilingPropInstance({
  id,
  placement,
  swayRef,
}: {
  id: string;
  placement: CeilingPropPlacement;
  swayRef: (g: THREE.Group | null) => void;
}) {
  const phys = CEILING_PROP_PHYSICS[placement.kind];
  const hangY = CEILING_Y + phys.hangY;
  const positionRef = useRef(new THREE.Vector3(placement.x, hangY, placement.z));
  // Yaw stays at the placement-baked rotation while hanging; the falling
  // dynamic body updates this each frame from its current rotation.
  const yawRef = useRef<number>(placement.rotation);
  const _q = useRef(new THREE.Quaternion());
  const _e = useRef(new THREE.Euler());
  const [destroyed, setDestroyed] = useState(false);
  const [falling, setFalling] = useState(false);

  useEffect(() => {
    const entry: DungeonDestructibleEntry = {
      id,
      halfExtents: { x: phys.hx, y: phys.hy, z: phys.hz },
      positionRef,
      yawRef,
      hp: phys.hp,
      maxHp: phys.hp,
      onDestroyed: () => {
        if (phys.falls) setFalling(true);
        else setDestroyed(true);
      },
    };
    useDungeonDestructibles.getState().register(entry);
    return () => useDungeonDestructibles.getState().unregister(id);
  }, [id, phys.hx, phys.hy, phys.hz, phys.hp, phys.falls]);

  const fallRb = useRef<RapierRigidBody>(null);
  // One-shot flag: once we've scheduled the post-settle despawn timer,
  // never schedule it again. Without this, every subsequent useFrame
  // tick that still meets the "settled" predicate would enqueue another
  // timer, producing dozens of redundant `setDestroyed` callbacks.
  const settledTimerScheduled = useRef(false);
  // Once a falling prop has landed and rolled to a stop, despawn it
  // after a short delay so debris doesn't accumulate forever.
  useFrame(() => {
    if (!falling || destroyed) return;
    const rb = fallRb.current;
    if (!rb) return;
    const t = rb.translation();
    positionRef.current.set(t.x, t.y, t.z);
    const r = rb.rotation();
    _q.current.set(r.x, r.y, r.z, r.w);
    _e.current.setFromQuaternion(_q.current, "YXZ");
    yawRef.current = _e.current.y;
    if (!settledTimerScheduled.current && t.y < 0.3) {
      const v = rb.linvel();
      if (v.x * v.x + v.y * v.y + v.z * v.z < 0.05) {
        // Tiny inertia at floor level → consider it settled.
        settledTimerScheduled.current = true;
        setTimeout(() => setDestroyed(true), 4000);
      }
    }
  });

  if (destroyed) return null;

  if (falling) {
    return (
      <RigidBody
        ref={fallRb}
        type="dynamic"
        position={[placement.x, hangY, placement.z]}
        rotation={[0, placement.rotation, 0]}
        colliders={false}
        mass={phys.mass}
        linearDamping={0.2}
        angularDamping={0.4}
        friction={0.8}
        restitution={0.1}
      >
        <CuboidCollider args={[phys.hx, phys.hy, phys.hz]} />
        {/* Reposition the visual so its hanging pivot lines up with the
            collider center, otherwise the chandelier ring would offset
            below the falling body. */}
        <group position={[0, -phys.hangY, 0]}>
          {placement.kind === "chandelier" && <TempleChandelier hero={false} />}
          {placement.kind === "plank" && <MineHangingPlank rotation={0} />}
        </group>
      </RigidBody>
    );
  }

  return (
    <group>
      {/*
        Visual sways from the ceiling pivot exactly as before.
       */}
      <group ref={swayRef} position={[placement.x, CEILING_Y, placement.z]}>
        {placement.kind === "chandelier" && <TempleChandelier hero={placement.hero} />}
        {placement.kind === "plank" && <MineHangingPlank rotation={placement.rotation} />}
        {placement.kind === "cobweb" && <CryptCobweb scale={placement.scale} />}
      </group>
      {/*
        Static blocking collider at the *hanging* position. The sway
        amplitude is small (a few cm) so a fixed collider matches the
        visual closely enough; this gives the player something solid to
        bump into when standing under a chandelier or thrown against a
        plank, matching the "block like decor does" requirement.
       */}
      <RigidBody
        type="fixed"
        position={[placement.x, hangY, placement.z]}
        rotation={[0, placement.rotation, 0]}
        colliders={false}
      >
        <CuboidCollider args={[phys.hx, phys.hy, phys.hz]} />
      </RigidBody>
    </group>
  );
}

function DungeonCeilingProps({ rooms, theme }: { rooms: DungeonRoom[]; theme: DungeonTheme }) {
  const placements = useMemo<CeilingPropPlacement[]>(
    () => buildCeilingPlacements(rooms, theme),
    [rooms, theme],
  );

  const groupRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const arr = groupRefs.current;
    for (let i = 0; i < placements.length; i++) {
      const g = arr[i];
      if (!g) continue;
      const it = placements[i];
      const a = Math.sin(t * it.freq + it.phase) * it.amp;
      const b = Math.cos(t * it.freq * 0.83 + it.phase * 1.3) * it.amp * 0.4;
      if (it.axis === 0) {
        g.rotation.x = a;
        g.rotation.z = b;
      } else {
        g.rotation.z = a;
        g.rotation.x = b;
      }
    }
  });

  // Pick a small subset of swaying props (skip cobwebs — they're silent
  // floaty things and shouldn't creak) to host ambient creak sources.
  // Spread the picks across the dungeon by stride-sampling so multiple
  // sources don't bunch up in a single room.
  const creakPositions = useMemo<Array<[number, number, number]>>(() => {
    const candidates = placements.filter((p) => p.kind !== "cobweb");
    if (candidates.length === 0) return [];
    const stride = Math.max(1, Math.floor(candidates.length / MAX_CREAK_SOURCES));
    const out: Array<[number, number, number]> = [];
    for (let i = 0; i < candidates.length && out.length < MAX_CREAK_SOURCES; i += stride) {
      const c = candidates[i];
      // Source at the prop's hanging height (~1m below ceiling) so distance
      // attenuation tracks the visible decor, not the ceiling slab.
      out.push([c.x, CEILING_Y - 1.0, c.z]);
    }
    return out;
  }, [placements]);

  return (
    <group>
      {placements.map((p, i) => (
        <CeilingPropInstance
          key={p.key}
          id={`ceil_${p.key}`}
          placement={p}
          swayRef={(el) => { groupRefs.current[i] = el; }}
        />
      ))}
      {creakPositions.length > 0 && <CeilingCreaks positions={creakPositions} />}
    </group>
  );
}

/**
 * F8 overlay source for ceiling props. Reads the destructibles store
 * and emits one oriented box per *currently alive* prop, mirroring
 * `<DungeonFurnitureDebugSource>`. Falling chandeliers/planks update
 * `positionRef` each frame so the wireframe follows them down.
 */
function DungeonCeilingPropsDebugSource() {
  const debugOn = useCheats((s) => s.enabled && s.debugColliders);
  const items = useDungeonDestructibles((s) => s.items);
  const [tick, setTick] = useState(0);
  useFrame(() => {
    if (!debugOn) return;
    setTick((t) => (t + 1) & 0x7fffffff);
  });
  const entries = useMemo<DebugColliderEntry[] | null>(() => {
    if (!debugOn || items.size === 0) return null;
    const out: DebugColliderEntry[] = [];
    for (const e of items.values()) {
      if (!e.id.startsWith("ceil_")) continue;
      const p = e.positionRef.current;
      const yaw = e.yawRef?.current ?? 0;
      const { vertices, indices, bbox } = buildOrientedBoxDebugTrimesh(
        p.x, p.y, p.z,
        e.halfExtents.x, e.halfExtents.y, e.halfExtents.z,
        yaw,
      );
      out.push({ name: `ceil_${e.id.split("_")[1] ?? "x"}`, vertices, indices, bbox });
    }
    return out;
  }, [debugOn, items, tick]);
  useDebugColliderRegistration("DungeonCeilingProps", entries);
  return null;
}

const THEME_LABELS: Record<DungeonTheme, string> = {
  crypt: "Crypt of Shadows",
  mine: "Deep Mine",
  temple: "Temple Depths",
};

const THEME_LABEL_COLORS: Record<DungeonTheme, { bg: string; border: string; text: string; sub: string }> = {
  crypt: { bg: "rgba(50,0,80,0.8)", border: "#6633cc", text: "#cc99ff", sub: "#9966cc" },
  mine: { bg: "rgba(60,40,0,0.8)", border: "#cc8833", text: "#ffcc66", sub: "#cc9944" },
  temple: { bg: "rgba(0,30,80,0.8)", border: "#3366cc", text: "#99ccff", sub: "#6699cc" },
};

function DungeonLevelIndicator({ level, theme }: { level: number; theme: DungeonTheme }) {
  const colors = THEME_LABEL_COLORS[theme];
  return (
    <div style={{
      position: "absolute",
      top: 180,
      left: 15,
      background: colors.bg,
      padding: "8px 14px",
      borderRadius: 6,
      border: `1px solid ${colors.border}`,
      color: colors.text,
      fontSize: 14,
      fontWeight: "bold",
    }}>
      {THEME_LABELS[theme]} — Level {level}
      <div style={{ fontSize: 11, color: colors.sub, marginTop: 2 }}>
        Press T near portal to exit
      </div>
    </div>
  );
}

function RoomTypeIndicators({ rooms }: { rooms: DungeonRoom[] }) {
  const specialRooms = useMemo(() =>
    rooms.filter(r => r.type !== "normal" && r.type !== "spawn" && r.type !== "corridor")
  , [rooms]);

  if (specialRooms.length === 0) return null;

  return (
    <group>
      {specialRooms.map((room, i) => {
        const cx = room.x + room.width / 2;
        const cz = room.z + room.depth / 2;
        const labels: Record<string, string> = {
          boss: "BOSS",
          treasure: "TREASURE",
          shrine: "SHRINE",
          armory: "ARMORY",
          library: "LIBRARY",
          trap: "DANGER",
          arena: "ARENA",
        };
        const label = labels[room.type] || room.type.toUpperCase();
        return (
          <sprite key={`indicator_${i}`} position={[cx, 3.5, cz]} scale={[2.5, 0.5, 1]}>
            <spriteMaterial map={createTextTex(label)} transparent opacity={0.6} />
          </sprite>
        );
      })}
    </group>
  );
}

/* ----------------------------------------------------------------- */
/* Room furniture: real physics + destruction                         */
/* ----------------------------------------------------------------- */

/**
 * Per-furniture-path collider/HP spec mirroring `DECOR_COLLIDERS`.
 * Sizes are tuned against the visual footprint each piece ends up at
 * after `<DungeonGLBDecor>` height-normalises the GLB to `height`. The
 * F8 overlay (`<DungeonFurnitureDebugSource>`) reads the same table so
 * "what you see in the wireframe is what you bump into".
 *
 * Pieces deliberately omitted (carpets) render as visuals only — they
 * shouldn't push the player or be destroyable.
 */
interface FurniturePhysicsSpec {
  hx: number;
  hy: number;
  hz: number;
  /** Vertical center of the collider (collider sits on floor at y=0). */
  cy: number;
  hp: number;
  /** Mass in kg-ish units. Defaults proportional to volume × density. */
  mass?: number;
}

const FURNITURE_PHYSICS: Record<string, FurniturePhysicsSpec> = {
  // Furniture pack — bookcases / table.
  "/models/furniture_quaternius/BookCase.glb":
    { hx: 0.7, hy: 1.0, hz: 0.3, cy: 1.0, hp: 35, mass: 80 },
  "/models/furniture_quaternius/BookCaseBooks.glb":
    { hx: 0.7, hy: 1.0, hz: 0.3, cy: 1.0, hp: 40, mass: 85 },
  "/models/furniture_quaternius/BookCaseLarge.glb":
    { hx: 0.8, hy: 1.25, hz: 0.35, cy: 1.25, hp: 50, mass: 110 },
  "/models/furniture_quaternius/BookCaseLargeBooks.glb":
    { hx: 0.8, hy: 1.25, hz: 0.35, cy: 1.25, hp: 55, mass: 120 },
  "/models/furniture_quaternius/Table.glb":
    { hx: 0.6, hy: 0.4, hz: 0.4, cy: 0.4, hp: 25, mass: 35 },

  // Dungeon Quaternius props placed by RoomFurniture.
  "/models/dungeon_quaternius/Chest.glb":
    { hx: 0.4, hy: 0.3, hz: 0.25, cy: 0.3, hp: 40, mass: 45 },
  "/models/dungeon_quaternius/Chest_gold.glb":
    { hx: 0.4, hy: 0.3, hz: 0.25, cy: 0.3, hp: 55, mass: 50 },
  "/models/dungeon_quaternius/Candelabrum_tall.glb":
    { hx: 0.25, hy: 1.1, hz: 0.25, cy: 1.1, hp: 12, mass: 18 },
  "/models/dungeon_quaternius/Candle.glb":
    { hx: 0.1, hy: 0.2, hz: 0.1, cy: 0.2, hp: 5, mass: 1.5 },
  "/models/dungeon_quaternius/Column.glb":
    { hx: 0.45, hy: 1.75, hz: 0.45, cy: 1.75, hp: 90, mass: 250 },
  // Carpets are intentionally absent — they're flat decals, not blockers.
};

interface FurnitureItemDef {
  path: string;
  x: number;
  z: number;
  rotation: number;
  height: number;
}

/**
 * One destructible / movable furniture piece. Backed by a dynamic Rapier
 * body so the player can shove it, swing damage tears it down (via the
 * shared destructibles registry), and other physics objects can knock
 * it around. Visuals are a per-instance GLB clone (we can't share an
 * `<InstancedMesh>` because each piece moves on its own transform).
 */
function DynamicFurniturePiece({
  id,
  item,
  spec,
}: {
  id: string;
  item: FurnitureItemDef;
  spec: FurniturePhysicsSpec;
}) {
  const gltf = useAsset(item.path);
  // Clone + normalise the GLB to the requested target height. We then
  // shift the model so its base sits at y=0 of the rigid body's local
  // frame; the body itself is mounted at world y=spec.cy so the
  // collider's bottom rests on the dungeon floor.
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const normalized = importFromScene(clone, [], item.path, {
      targetHeight: item.height,
      sanitizeBones: false,
      fixDarkMaterials: true,
      enableShadows: true,
    });
    const box = new THREE.Box3().setFromObject(normalized.scene);
    normalized.scene.position.y = -box.min.y;
    return normalized.scene;
  }, [gltf, item.path, item.height]);

  const rbRef = useRef<RapierRigidBody>(null);
  // Scratch vector reused each frame to feed the destructibles registry
  // without per-frame allocation.
  const positionRef = useRef(new THREE.Vector3(item.x, spec.cy, item.z));
  // Live yaw — read from rigid body each frame so the F8 overlay box
  // tracks the prop's actual rotation when it's been knocked around.
  const yawRef = useRef<number>(item.rotation);
  const _yawScratch = useRef(new THREE.Quaternion());
  const _eulerScratch = useRef(new THREE.Euler());
  const [destroyed, setDestroyed] = useState(false);
  // 0..1 fade ramp triggered on damage/destroy. Drives a quick scale +
  // emissive flash so smashing a chest reads visually even without a
  // bespoke fragments mesh.
  const [damageFlash, setDamageFlash] = useState(0);

  useEffect(() => {
    const entry: DungeonDestructibleEntry = {
      id,
      halfExtents: { x: spec.hx, y: spec.hy, z: spec.hz },
      positionRef,
      yawRef,
      hp: spec.hp,
      maxHp: spec.hp,
      onDamage: () => setDamageFlash(performance.now()),
      onDestroyed: () => setDestroyed(true),
    };
    useDungeonDestructibles.getState().register(entry);
    return () => useDungeonDestructibles.getState().unregister(id);
  }, [id, spec.hx, spec.hy, spec.hz, spec.hp]);

  // Pull the body's current world position + yaw each frame so melee
  // swings hit the piece where it actually is and the F8 overlay box
  // matches the rotated collider.
  useFrame(() => {
    const rb = rbRef.current;
    if (!rb) return;
    const t = rb.translation();
    positionRef.current.set(t.x, t.y, t.z);
    const r = rb.rotation();
    _yawScratch.current.set(r.x, r.y, r.z, r.w);
    _eulerScratch.current.setFromQuaternion(_yawScratch.current, "YXZ");
    yawRef.current = _eulerScratch.current.y;
  });

  if (destroyed) return null;

  // Crude flash: fade red overlay for 220ms after a hit. We don't touch
  // material refs (each GLB has its own), so this is a transparent box
  // overlay that pops briefly when damage_flash advances.
  const flashAge = damageFlash > 0 ? (performance.now() - damageFlash) / 220 : 1;
  const flashAlpha = Math.max(0, 1 - flashAge) * 0.45;

  return (
    <RigidBody
      ref={rbRef}
      type="dynamic"
      position={[item.x, spec.cy, item.z]}
      rotation={[0, item.rotation, 0]}
      colliders={false}
      mass={spec.mass ?? 30}
      linearDamping={0.6}
      angularDamping={1.2}
      friction={0.9}
      restitution={0.05}
    >
      <CuboidCollider args={[spec.hx, spec.hy, spec.hz]} />
      <group position={[0, -spec.cy, 0]}>
        <primitive object={model} />
      </group>
      {flashAlpha > 0 && (
        <mesh raycast={() => null}>
          <boxGeometry args={[spec.hx * 2.05, spec.hy * 2.05, spec.hz * 2.05]} />
          <meshBasicMaterial color="#ff6633" transparent opacity={flashAlpha} depthWrite={false} />
        </mesh>
      )}
    </RigidBody>
  );
}

/**
 * F8 debug source: publishes one oriented box per *currently alive*
 * furniture piece into the shared collider-debug registry, mirroring
 * how `<DungeonDecorDebugSource>` exposes the main decor list. We read
 * the live registry (positions track the dynamic bodies) so the
 * wireframe follows the prop as the player shoves it across the room.
 */
function DungeonFurnitureDebugSource() {
  const debugOn = useCheats((s) => s.enabled && s.debugColliders);
  const items = useDungeonDestructibles((s) => s.items);
  // Re-tick each frame while the overlay is on so the wireframe boxes
  // follow the dynamic bodies. We piggy-back on a counter state to
  // force the memo to recompute every animation frame.
  const [tick, setTick] = useState(0);
  useFrame(() => {
    if (!debugOn) return;
    setTick((t) => (t + 1) & 0x7fffffff);
  });
  const entries = useMemo<DebugColliderEntry[] | null>(() => {
    if (!debugOn || items.size === 0) return null;
    const out: DebugColliderEntry[] = [];
    for (const e of items.values()) {
      // The store is shared with ceiling props (id prefix `ceil_`); we
      // only want furniture pieces (id prefix `furn_`) here so the two
      // overlay layers don't double-publish each other's boxes.
      if (!e.id.startsWith("furn_")) continue;
      const p = e.positionRef.current;
      const yaw = e.yawRef?.current ?? 0;
      const { vertices, indices, bbox } = buildOrientedBoxDebugTrimesh(
        p.x, p.y, p.z,
        e.halfExtents.x, e.halfExtents.y, e.halfExtents.z,
        yaw,
      );
      out.push({ name: `prop_${e.id.split("_").slice(2).join("_") || "x"}`, vertices, indices, bbox });
    }
    return out;
  }, [debugOn, items, tick]);
  useDebugColliderRegistration("DungeonRoomProps", entries);
  return null;
}

function RoomFurniture({ rooms, theme: _theme }: { rooms: DungeonRoom[]; theme: DungeonTheme }) {
  const furnitureItems = useMemo(() => {
    const items: FurnitureItemDef[] = [];
    let seed = 12345;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    for (const room of rooms) {
      const cx = room.x + room.width / 2;
      const cz = room.z + room.depth / 2;

      if (room.type === "library" || room.type === "armory") {
        const count = 2 + Math.floor(rng() * 3);
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          const dist = Math.min(room.width, room.depth) * 0.35;
          items.push({
            path: FURNITURE_ASSETS[rng() > 0.5 ? "bookcase_books" : "bookcase_large_books"].path,
            x: cx + Math.cos(angle) * dist,
            z: cz + Math.sin(angle) * dist,
            rotation: angle + Math.PI,
            height: 2.0,
          });
        }
        items.push({
          path: FURNITURE_ASSETS["table"].path,
          x: cx, z: cz,
          rotation: rng() * Math.PI * 2,
          height: 0.8,
        });
      }

      if (room.type === "treasure") {
        const chestCount = 2 + Math.floor(rng() * 3);
        for (let i = 0; i < chestCount; i++) {
          const ox = (rng() - 0.5) * room.width * 0.5;
          const oz = (rng() - 0.5) * room.depth * 0.5;
          items.push({
            path: DUNGEON_ASSETS[rng() > 0.3 ? "chest_gold" : "chest"].path,
            x: cx + ox, z: cz + oz,
            rotation: rng() * Math.PI * 2,
            height: 0.6,
          });
        }
        items.push({
          path: DUNGEON_ASSETS["candelabrum_tall"].path,
          x: cx, z: cz,
          rotation: 0,
          height: 2.2,
        });
      }

      if (room.type === "shrine") {
        items.push({
          path: DUNGEON_ASSETS["carpet"].path,
          x: cx, z: cz,
          rotation: 0,
          height: 0.05,
        });
        for (let c = 0; c < 4; c++) {
          const angle = (c / 4) * Math.PI * 2 + Math.PI / 4;
          const dist = Math.min(room.width, room.depth) * 0.3;
          items.push({
            path: DUNGEON_ASSETS["candle"].path,
            x: cx + Math.cos(angle) * dist,
            z: cz + Math.sin(angle) * dist,
            rotation: 0,
            height: 0.4,
          });
        }
      }

      if (room.type === "boss") {
        for (let c = 0; c < 4; c++) {
          const angle = (c / 4) * Math.PI * 2;
          const dist = Math.min(room.width, room.depth) * 0.4;
          items.push({
            path: DUNGEON_ASSETS["column"].path,
            x: cx + Math.cos(angle) * dist,
            z: cz + Math.sin(angle) * dist,
            rotation: 0,
            height: 3.5,
          });
        }
        items.push({
          path: DUNGEON_ASSETS["carpet"].path,
          x: cx, z: cz,
          rotation: 0,
          height: 0.05,
        });
      }
    }

    return items;
  }, [rooms]);

  // Split items into two pools:
  //  • physical: dynamic rigid body + per-instance GLB clone, registered
  //    with the destructibles registry so swings can break them.
  //  • staticDecor: flat / non-blocking pieces (carpets, etc.) — keep
  //    using the cheap instanced decoration pipeline.
  const physical = useMemo(
    () =>
      furnitureItems
        .map((item, i) => {
          const spec = FURNITURE_PHYSICS[item.path];
          return spec ? { id: `furn_${i}_${item.path.split("/").pop()}`, item, spec } : null;
        })
        .filter((v): v is { id: string; item: FurnitureItemDef; spec: FurniturePhysicsSpec } => v != null),
    [furnitureItems],
  );

  const staticDecor = useMemo<ModularDecorPlacement[]>(
    () =>
      furnitureItems
        .filter((item) => !FURNITURE_PHYSICS[item.path])
        .map((item) => ({
          path: item.path,
          position: [item.x, 0, item.z] as [number, number, number],
          rotation: item.rotation,
          fit: "decor" as const,
        })),
    [furnitureItems],
  );

  return (
    <group>
      <DungeonModularDecorations placements={staticDecor} />
      <Suspense fallback={null}>
        {physical.map((p) => (
          <DynamicFurniturePiece key={p.id} id={p.id} item={p.item} spec={p.spec} />
        ))}
      </Suspense>
    </group>
  );
}

/**
 * Places a spawn / exit arch by finding the door tile in the room nearest
 * to the supplied room center, then sitting the arch on that door edge
 * facing into the corridor (so the player walks under the arch when entering
 * or leaving the room).
 */
function DungeonArchAtRoom({
  grid,
  kind,
  roomCenter,
  theme,
}: {
  grid: TileGrid;
  kind: "spawn" | "exit";
  roomCenter: [number, number];
  theme: DungeonTheme;
}) {
  const placement = useMemo(() => {
    const [cx, cz] = roomCenter;
    const half = TILE_SIZE / 2;
    let best: { x: number; z: number; rotation: number; dist: number } | null = null;

    const candidates: Array<{
      tile: DungeonTile;
      side: "N" | "S" | "E" | "W";
    }> = [];
    // Constrain candidates to door tiles belonging to the spawn/exit room.
    // Fall back to any door tile if the spawn/exit room kind isn't tagged.
    const wantKind = kind; // "spawn" | "exit"
    const matchesRoom = (t: DungeonTile) => t.floorKind === wantKind;
    const sourceTiles = grid.tiles.filter(matchesRoom);
    const pool = sourceTiles.length > 0 ? sourceTiles : grid.tiles;
    for (const t of pool) {
      if (t.doorN) candidates.push({ tile: t, side: "N" });
      if (t.doorS) candidates.push({ tile: t, side: "S" });
      if (t.doorE) candidates.push({ tile: t, side: "E" });
      if (t.doorW) candidates.push({ tile: t, side: "W" });
    }
    for (const { tile, side } of candidates) {
      // Place arch at the edge between room tile and corridor tile.
      let x = tile.wx, z = tile.wz, rot = 0;
      if (side === "N") { z = tile.wz - half; rot = 0; }
      else if (side === "S") { z = tile.wz + half; rot = Math.PI; }
      else if (side === "W") { x = tile.wx - half; rot = Math.PI / 2; }
      else if (side === "E") { x = tile.wx + half; rot = -Math.PI / 2; }
      const dx = x - cx, dz = z - cz;
      const dist = dx * dx + dz * dz;
      if (!best || dist < best.dist) best = { x, z, rotation: rot, dist };
    }

    if (!best) {
      // Fallback: drop the arch at the room center facing -Z.
      return { position: [cx, 0, cz] as [number, number, number], rotation: 0 };
    }
    return { position: [best.x, 0, best.z] as [number, number, number], rotation: best.rotation };
  }, [grid, roomCenter]);

  return (
    <DungeonEntranceArch
      position={placement.position}
      rotation={placement.rotation}
      theme={theme}
      kind={kind}
    />
  );
}

function DungeonContent({ layout, level }: { layout: DungeonLayout; level: number }) {
  const playerPosRef = useRef(new THREE.Vector3(layout.spawnPoint.x, 1, layout.spawnPoint.z));
  const { enemies } = useEnemyManager();

  useEffect(() => {
    useDungeonDestruction.getState().setDecor(layout.decor);
  }, [layout]);

  const pathfinding = useMemo(() => {
    try {
      return buildDungeonNavMesh(layout);
    } catch (e) {
      console.warn("Failed to build dungeon navmesh:", e);
      return null;
    }
  }, [layout]);

  const pathfindFn = useCallback((from: THREE.Vector3, to: THREE.Vector3) => {
    if (!pathfinding) return null;
    return findDungeonPath(pathfinding, from, to);
  }, [pathfinding]);

  const handlePlayerPositionUpdate = (pos: THREE.Vector3) => {
    playerPosRef.current.copy(pos);
    useGame.getState().updatePlayerPosition(pos);
  };

  // Derive the hero chandelier sway sources once and share them with
  // both the ceiling-prop renderer (for visual sway) and the wall-torch
  // light renderer (for synced subtle brightening). Recomputed only when
  // the layout changes.
  const heroChandeliers = useMemo<ChandelierSwaySource[]>(() => {
    const placements = buildCeilingPlacements([...layout.rooms], layout.theme);
    const out: ChandelierSwaySource[] = [];
    for (const p of placements) {
      if (p.kind === "chandelier" && p.hero) {
        out.push({ x: p.x, z: p.z, phase: p.phase, freq: p.freq });
      }
    }
    return out;
  }, [layout.rooms, layout.theme]);

  // Collect every "hole" ceiling tile's world-space center so the
  // CeilingHoleBeams renderer can drop a single instanced light shaft +
  // pooled dust motes under each one. Recomputed only when the tile
  // grid layout changes.
  const ceilingHolePositions = useMemo<Array<[number, number]>>(() => {
    const out: Array<[number, number]> = [];
    for (const t of layout.tileGrid.tiles) {
      if (ceilingVariantForTile(t.tx, t.tz) === "hole") {
        out.push([t.wx, t.wz]);
      }
    }
    return out;
  }, [layout.tileGrid]);

  return (
    <>
      <DungeonLighting theme={layout.theme} />
      <TileGridColliders grid={layout.tileGrid} theme={layout.theme} rooms={[...layout.rooms]} />
      {/* Dev-only F8 overlay infrastructure for the dungeon scene.
          Each `*DebugSource` registers its chunk list into the shared
          collider-debug registry only while the F8 cheat is on, then
          renders nothing of its own; the single
          `<RegisteredDebugColliderOverlay>` mount below subscribes to
          the registry, flattens every source's contribution, and
          publishes the merged list to one `<DebugOverlayInner>` so
          there's exactly one writer to the HUD's stats struct.
          Decor and the climbable pieces (`<WallClimbable>` /
          `<LadderClimbable>` further down) self-register the same
          way — see their own `useDebugColliderRegistration` calls.
          With the cheat off none of these pay anything beyond a
          `useMemo` returning `null`. */}
      <DungeonTileGridDebugSource tileGrid={layout.tileGrid} />
      <DungeonDecorDebugSource decor={layout.decor} />
      <DungeonFurnitureDebugSource />
      <DungeonCeilingPropsDebugSource />
      <RegisteredDebugColliderOverlay />
      <Suspense fallback={null}>
        <DungeonCeiling grid={layout.tileGrid} theme={layout.theme} />
      </Suspense>
      <Suspense fallback={null}>
        <CeilingHoleBeams
          positions={ceilingHolePositions}
          color={CEILING_HOLE_BEAM_COLOR[layout.theme]}
          ceilingHeight={WALL_HEIGHT}
        />
      </Suspense>
      <DungeonCeilingProps rooms={[...layout.rooms]} theme={layout.theme} />
      <Suspense fallback={null}>
        <DungeonModularPieces
          grid={layout.tileGrid}
          theme={layout.theme}
          heroChandeliers={heroChandeliers}
          playerPositionRef={playerPosRef}
        />
      </Suspense>
      <DungeonCeilingFloorDamage grid={layout.tileGrid} theme={layout.theme} />
      <DungeonDecorItems decor={layout.decor} theme={layout.theme} heroChandeliers={heroChandeliers} />
      <DungeonDecorColliders decor={layout.decor} />
      <DungeonDecorFragments />
      <FractureChunksPreloader />
      <RoomFurniture rooms={layout.rooms} theme={layout.theme} />
      <RoomTypeIndicators rooms={layout.rooms} />
      <DungeonArchAtRoom grid={layout.tileGrid} kind="spawn"
        roomCenter={[layout.spawnPoint.x, layout.spawnPoint.z]} theme={layout.theme} />
      <DungeonArchAtRoom grid={layout.tileGrid} kind="exit"
        roomCenter={[layout.exitPoint.x, layout.exitPoint.z]} theme={layout.theme} />
      <DungeonStairs
        position={[layout.exitPoint.x, 0, layout.exitPoint.z - 2.5]}
        theme={layout.theme}
      />
      <ExitPortal
        position={[layout.exitPoint.x, 0, layout.exitPoint.z]}
        playerPosition={playerPosRef.current}
        theme={layout.theme}
      />
      <PortalParticles position={[layout.exitPoint.x, 0.5, layout.exitPoint.z]} color={THEME_COLORS[layout.theme].portalColor} />
      <DungeonEnemySpawner layout={layout} />
      <Player
        onPositionUpdate={handlePlayerPositionUpdate}
        spawnPosition={[layout.spawnPoint.x, 2, layout.spawnPoint.z]}
      />
      {/* Climbable surfaces emitted by the procedural generator —
          a small fraction of room wall tiles become climbable wall
          faces, and a few larger rooms get a ladder pressed against
          one of their interior walls. Spawn-room and corridor walls
          are skipped so the start of the level stays clean. */}
      {layout.climbables.map((c, i) => {
        if (c.kind === "wall" && c.size) {
          return (
            <WallClimbable
              key={`climb_w_${i}`}
              position={c.position}
              size={c.size}
              rotationY={c.rotationY}
            />
          );
        }
        if (c.kind === "ladder" && c.height !== undefined) {
          return (
            <LadderClimbable
              key={`climb_l_${i}`}
              position={c.position}
              height={c.height}
              width={c.width}
              rotationY={c.rotationY}
            />
          );
        }
        return null;
      })}
      {enemies.map((enemy) => (
        <Enemy key={enemy.id} data={enemy} playerPosition={playerPosRef.current} pathfindFn={pathfindFn} />
      ))}
      <LootDropsRenderer playerPosition={playerPosRef.current} />
      <Camera playerPosition={playerPosRef.current} />
      <fog attach="fog" args={[THEME_COLORS[layout.theme].fog, THEME_COLORS[layout.theme].fogNear, THEME_COLORS[layout.theme].fogFar]} />
    </>
  );
}

export default function DungeonScene() {
  const { dungeonSeed, dungeonLevel } = useGame();

  const layout = useMemo(() => {
    return generateDungeon(dungeonSeed, dungeonLevel);
  }, [dungeonSeed, dungeonLevel]);

  return (
    <KeyboardControls map={controls}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{
          position: [layout.spawnPoint.x, 20, layout.spawnPoint.z + 15],
          fov: 50,
          near: 0.1,
          far: 200,
        }}
        gl={{
          antialias: false,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        onCreated={({ gl }) => {
          const c = gl.domElement;
          c.addEventListener("webglcontextlost", (e) => { e.preventDefault(); });
          c.addEventListener("webglcontextrestored", () => {});
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <AssetLoaderInit />
        <Suspense fallback={null}>
          <Physics
            gravity={[0, -20, 0]}
            timeStep="vary"
            interpolate={false}
          >
            <VFXSystem />
            <DungeonContent layout={layout} level={dungeonLevel} />
          </Physics>
        </Suspense>
      </Canvas>
      <HUD />
      <DungeonLevelIndicator level={dungeonLevel} theme={layout.theme} />
      <DungeonInteractionHandler />
    </KeyboardControls>
  );
}

function createTextTex(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 20, 512, 88);
  ctx.font = "bold 38px Arial";
  ctx.fillStyle = "#66ff99";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
