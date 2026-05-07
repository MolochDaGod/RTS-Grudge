import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { KeyboardControls, Sky } from "@react-three/drei";
import {
  Physics,
  RigidBody,
  CuboidCollider,
  TrimeshCollider,
} from "@react-three/rapier";
import * as THREE from "three";
import { useGame } from "@/lib/stores/useGame";
import { useAsset } from "../hooks/useAsset";
import { AssetLoaderInit } from "../systems/AssetLoaderInit";
import { isAssetCached, subscribeAssetProgress } from "../systems/AssetLoader";
import Player from "../components/Player";
import WorldNetBridge from "../networking/WorldNetBridge";
import RemotePlayers from "../networking/RemotePlayers";
import Camera, { resetCamera, clearPendingCameraReset } from "../components/Camera";
import HUD from "../components/HUD";
import { LocationDiscovery } from "../components/WorldMap";
import LootDropsRenderer from "../components/LootDrops";
import { VFXSystem } from "../vfx";
import {
  registerModeGetter,
  updateActiveController,
} from "../controllers/ModeController";
import {
  initializeControllers,
  resetGameFlow,
} from "../controllers/GameFlowController";
import { useGame as useGameStore } from "@/lib/stores/useGame";
import TutorialIslandHarvestables from "./TutorialIslandHarvestables";
import TutorialIslandAnimals from "./TutorialIslandAnimals";
import {
  BakedSceneWrapper,
  LightmapIgnore,
} from "../lighting/BakedSceneWrapper";
import TutorialIslandWaves from "./TutorialIslandWaves";
import Enemy from "../components/Enemy";
import { useEnemyManager } from "../systems/EnemyManager";
import BreakApartChunks from "../effects/BreakApartChunks";
import UnderwaterVolume from "../effects/UnderwaterShader";
import { SeaSurface } from "../effects/SeaSurface";
import { ShoreFoam } from "../effects/ShoreFoam";
import {
  WATER_SURFACE_Y,
  SEABED_VISUAL_Y,
  SWIM_BAND_BOTTOM_Y,
} from "../effects/WaterVolume";
import PlayerBubbleTrail from "../effects/PlayerBubbleTrail";
import TerrainStreamDustCues, {
  type StreamDustCue,
} from "../effects/TerrainStreamDustCue";
import BuildMenu from "../building/BuildMenu";
import { TerrainDebugProbe } from "../cheats/TerrainDebugHUD";
import { StreamedColliderDebugOverlay } from "../cheats/StreamedColliderDebugOverlay";
import BuildModeHandler from "../building/BuildModeHandler";
import PlacedBuildings from "../building/PlacedBuildings";
import { attachWindToMaterial } from "../effects/WindSway";
import {
  copyIndices,
  copyPositions,
  collectGeomTransfers,
  dispatchColliderBake,
  packMatrix,
} from "./colliderBake";
import type {
  BakeCandidateGeom,
  BakeCandidateGroup,
} from "./colliderBake";
import type { RockColliderData } from "./TutorialIslandHarvestables";

const TUTORIAL_GLB_PATH = "/models/tutorial_island/scene.glb";

// Scale factor applied to the GLB. Native units appear to be cm — at the
// original 0.01 the playable area was ~10–30m across (way too small per
// user feedback). Bumped 100x to 1.0 so the spawn island is now ~1–3 km
// across and the horizon islands sit tens of km out. The player capsule
// stays the same size, so they'll feel small next to the world.
const WORLD_SCALE = 1.0;

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

/**
 * One trimesh collider's worth of geometry, baked into final world
 * coordinates (i.e. with the wrapping `<group position scale>` already
 * folded in). Ready to hand directly to `<TrimeshCollider>` with the
 * RigidBody at the origin.
 */
interface GroundColliderGeometry {
  vertices: Float32Array;
  indices: Uint32Array;
  /** Original GLB mesh name — purely for debug logging. */
  name: string;
  /**
   * World-space xz centroid of this mesh, used by the streaming
   * collider component to decide whether to mount the trimesh.
   */
  centerX: number;
  centerZ: number;
  /**
   * World-space xz bounding radius of this mesh. The streaming
   * component compares `playerDist - radius` against the stream
   * threshold so a long mesh whose centroid is far from the player
   * still mounts when the player is standing on its near end.
   */
  radius: number;
}

// `RockColliderData` (one baked harvestable rock, vertices already in
// physics world space) is owned by `TutorialIslandHarvestables`, the
// component that consumes it. We import the type above so the bake
// hooks here can produce values in the exact shape the harvestables
// component expects, without duplicating the definition.

// Cuboid land-fallback footprint = union bbox of `SM_Env_Beach_*`
// meshes whose post-scale, post-offset centroid is within
// `NEAR_RADIUS_M` of the shipwreck, clamped to that radius. Only used
// when the trimesh bake fails entirely — otherwise
// `<StreamedGroundColliders>` handles the walkable surface. Hoisted
// to module scope so the synchronous base-world derivation can read
// it; the async trimesh bake intentionally bakes the whole island
// and does NOT apply this filter.
//
// 75 m sits just inside `STREAM_MOUNT_RADIUS_M` (80 m), so when the
// trimesh bake fails the player still gets a land pad roughly the
// size of the area whose colliders would have streamed in around
// them. Was previously 35 m to keep the rAF-sliced base-world derive
// cheap, but that work is trivial (centroid bbox-union over beach
// meshes) — the per-vertex cost lives in the worker now, and the
// loading overlay no longer cares about a slightly larger fallback
// footprint search.
const NEAR_RADIUS_M = 75;
const NEAR_RADIUS_SQ = NEAR_RADIUS_M * NEAR_RADIUS_M;

// What counts as "ground" on this island. Every matching mesh in the
// GLB is baked into a trimesh collider, regardless of where it sits
// on the ~1.8 km map; `<StreamedGroundColliders>` then picks which
// ones to mount around the player at runtime so physics cost stays
// bounded.
//   - SM_Env_Beach_*       : sand. Covers the actual island terrain
//                            shape under every region (including
//                            Havana, Mansion, Fort, Shipwreck and
//                            Mangrove). Also matches the small
//                            `SM_Env_Beach_Pile_*` decoration mounds
//                            that sit on top of the beach.
//   - SM_Env_Flat_Sand_*   : raised flat sand pads inside the
//                            Havana village (7 large 10x10 m tiles).
//                            They sit slightly above the surrounding
//                            beach, so without a collider the player
//                            would sink onto the lower beach the
//                            moment they stepped onto one.
//   - SM_Env_GroundLeaves_*: thin forest-floor leaf-litter splats
//                            scattered around the Shipwreck/forest
//                            interior. Very low (≈18 cm) — they're
//                            here so the inland forest area has a
//                            walkable surface tagged everywhere the
//                            player visually sees floor, not just on
//                            bare beach mesh.
//   - SM_Bld_Fort_*        : the fort/ruin sitting on the spawn beach —
//                            this is the actual walkable structure the
//                            player sees next to the spawn (the GLB's
//                            "Shipwreck" node is just a re-centring
//                            pivot; the real SM_Prop_Shipwreck_* boats
//                            sit ~240 m away as background scenery).
//   - SM_Prop_Shipwreck_(02|03) (no _Sails): wreck hulls/decks
//                            scattered around the island.
//
// Note: `SM_Env_Rock(s)_*` are deliberately *excluded* — every
// rock with that prefix is a harvestable handled by
// `TutorialIslandHarvestables`. They get their own per-rock trimesh
// body baked in `useTutorialBaseWorld` so the physics collider can
// be torn down in lockstep with the visible mesh on harvest. Baking
// them into the static ground here would leave an invisible wall
// behind after the visual disappears. Foliage and decoration prefixes
// (`SM_Env_Grass`, `SM_Env_PalmTree`, `SM_Env_Bush`, `SM_Env_Flowers`,
// `SM_Env_Plants`, etc.) are likewise excluded — they're 3D foliage
// clumps placed on top of the actual ground (`SM_Env_Beach_*`), not
// surfaces the player should stand on.
const GROUND_NAME_RE =
  /^(SM_Env_Beach_|SM_Env_Flat_Sand_|SM_Env_GroundLeaves_|SM_Bld_Fort_|SM_Prop_Shipwreck_(?:02|03)(?!_Sails))/;

// Natural terrain — what the player should think of as "the ground".
// This is the sand level the user pointed at (`SM_Env_Beach_*` is the
// island's whole sandy footprint, `SM_Env_Flat_Sand_*` are the raised
// Havana pads, `SM_Env_GroundLeaves_*` is forest-floor litter inland).
// All of these are part of the natural sand/dirt the player walks on.
//
// Used by `computeSpawnSurfaceY` to make sure the player spawns on
// the actual sand under the shipwreck pivot — not on top of the
// shipwreck deck or fort wall that happens to overlap the spawn xz.
// Both kinds still get full trimesh colliders mounted at runtime, so
// the player can climb onto the deck/fort by walking up to it; this
// regex only governs which surfaces count for "where am I spawning".
const NATURAL_GROUND_NAME_RE =
  /^(SM_Env_Beach_|SM_Env_Flat_Sand_|SM_Env_GroundLeaves_)/;

// Per-chunk and total triangle caps for the trimesh bake.
//
// `TRI_LIMIT_PER_MESH` is now a per-COLLIDER cap, not a drop cap —
// the worker spatially splits any candidate that exceeds it into
// multiple smaller-bbox chunks (each its own `<TrimeshCollider>`
// keyed and streamed independently), so even the heaviest GLB
// meshes — background dune ridges, the SM_Prop_Shipwreck hull
// skirts — become walkable instead of being logged as `droppedHighTri`
// and turning into invisible walls / fall-through pits in game.
// Keeping a per-collider ceiling matters because Rapier's trimesh
// build cost grows nonlinearly with triangle count and very large
// per-body meshes give the streaming layer worse bbox locality;
// 80 k strikes a balance where chunk-split count stays small (most
// candidates remain a single chunk) while no single collider blows
// the per-body budget.
//
// The total cap is a memory ceiling on baked Float32Array storage —
// 1 M tris is ~24 MB worst case (3 floats × 4 bytes × 2 vertices/tri),
// with active mounted geometry held well below that by the streaming
// radius. Current shipped GLB fits comfortably under the cap
// (~180 k tris of tagged walkable surface, including the small bump
// from re-admitting the previously-dropped dense meshes through
// chunking).
const TRI_LIMIT_PER_MESH = 80000;
const TOTAL_TRI_LIMIT = 1_000_000;

// Per-rock and total caps for the harvestable-rock trimesh bake.
// The per-rock cap drops pathologically dense rock meshes; the
// total cap is a safety net against the GLB pulling in hundreds of
// off-island background rocks all at once. Rocks within the play
// area are tiny so the cap is set well above any realistic need.
const ROCK_TRI_LIMIT = 4000;
const ROCK_TRI_TOTAL_LIMIT = 200000;

// (The previous `BAKE_FRAME_BUDGET_MS` time-slicing has been replaced
// by a Web Worker — see `useGroundCollidersBake` — so the per-vertex
// transform pass never touches the main thread regardless of triangle
// budget.)

/**
 * How far from the player we keep ground colliders mounted. The GLB
 * spans ~1.8 km and contains hundreds of walkable-tagged meshes; we
 * only ever need physics for the patch the player can plausibly walk
 * onto in the next few seconds. Picked so the collider for a mesh is
 * already mounted by the time the player walks within ~30 m of it.
 */
const STREAM_MOUNT_RADIUS_M = 80;
/**
 * Hysteresis: only unmount a collider once the player has walked at
 * least this far past the mount radius. Prevents flicker on the
 * boundary.
 */
const STREAM_UNMOUNT_RADIUS_M = 100;
/**
 * Distance the player has to move from the last stream check before
 * we re-evaluate which colliders are active. Cheap O(N) sweep but no
 * point doing it every frame.
 */
const STREAM_RECHECK_DIST_M = 4;
/**
 * How close the player has to be to a freshly-streamed ground mesh
 * (nearest-edge distance) before we play a small dust-puff cue. The
 * cue is meant to mark "this terrain just became real underneath
 * you" — so we only fire when the player is plausibly about to step
 * onto the mesh, not when it pops in 60 m away.
 */
const STREAM_CUE_TRIGGER_DIST_M = 12;
/**
 * Approximate distance from the player capsule's reported world
 * position down to its feet. Used to spawn the dust puff at floor
 * level instead of inside the capsule.
 */
const STREAM_CUE_FOOT_OFFSET_M = 0.85;

interface TutorialBaseWorldData {
  root: THREE.Object3D;
  scale: number;
  offset: [number, number, number];
  trees: THREE.Object3D[];
  rocks: THREE.Object3D[];
  /**
   * Pick-uppable foliage (flowers, plants, mushrooms, bushes) — handed
   * to `TutorialIslandHarvestables` so the player can harvest them with
   * an F-key proximity press. Excludes grass tufts (too many to be
   * worth a single-stack inventory pickup each).
   */
  flowers: THREE.Object3D[];
  /**
   * Land-only ground bounds in *final* world space (after `scale` and
   * `offset`). Computed from the union bbox of every `SM_Env_Beach_*`
   * mesh whose centroid sits within `NEAR_RADIUS_M` of the shipwreck
   * (origin), then clamped to that radius — only used when trimesh
   * extraction fails entirely, in which case we just need a dry
   * land pad next to the spawn.
   */
  groundY: number;
  groundCenter: [number, number];
  groundHalfExtent: [number, number];
  beachCount: number;
  /**
   * Final-world XZ where the player physics capsule should drop in
   * on first mount. Computed by `useTutorialBaseWorld` from the
   * closest "isolated palm tree near the wreck" — the small sand
   * patch with one tree + a couple of rocks the user circled. Using
   * the wreck centre (0,0) instead lands the capsule INSIDE the
   * shipwreck hull, which is a terrible collider test (multi-storey
   * trimesh seams) and a worse first impression. Falls back to
   * (0,0) when no candidate palm is found.
   */
  spawnXZ: [number, number];
  /**
   * Cloned foliage materials with the WindSway shader injection.
   * Held here so the consumer can dispose them on unmount — the
   * source materials inside the cached GLB are immortal, but our
   * clones live only for this scene's lifetime.
   */
  windedMaterials: THREE.Material[];
}

interface TutorialWorldData extends TutorialBaseWorldData {
  /**
   * Per-mesh trimesh colliders for the playable ground (sand beach,
   * the rocky shore, fort/ruin, shipwreck hull). The full island's
   * walkable surfaces are baked here — at runtime the
   * `<StreamedGroundColliders>` component only mounts the subset
   * within `STREAM_MOUNT_RADIUS_M` of the player so physics cost
   * stays bounded even though the island spans ~1.8 km. Empty if
   * we couldn't tag any candidate meshes (in which case the cuboid
   * fallback kicks in).
   */
  groundColliders: GroundColliderGeometry[];
  /**
   * Per-rock trimesh collider data, one entry per harvestable rock,
   * baked off the main thread by the shared collider-bake worker.
   * Used by `TutorialIslandHarvestables` to spawn a physics body for
   * each rock that gets torn down in the same React render the rock
   * is hidden — so harvested rocks never leave an invisible wall.
   */
  rockColliders: RockColliderData[];
  /**
   * Y of the actual walkable surface directly under the spawn xz
   * (origin), found by raycasting the baked ground meshes straight
   * down. The player spawns a small distance above this so they
   * always drop onto the surface beneath them — never from the top
   * of a tall fort tower in the same 35 m bubble.
   */
  spawnSurfaceY: number;
}

interface BakeResult {
  groundColliders: GroundColliderGeometry[];
  spawnSurfaceY: number;
}

// Module-level cache of completed trimesh bakes, keyed by GLB path.
// The baked vertices are already folded into final world coordinates
// (the wrapping `<group offset scale>` transform is applied during the
// bake), and the same GLB always produces the same Shipwreck-pivot
// offset, so the result is safe to reuse across mounts. Re-entering
// the tutorial after the first visit pulls from this cache and skips
// the chunked rAF bake entirely — the player mounts on the same frame
// the scene does, with no empty-sky flicker between overlay-skip and
// player spawn.
const groundColliderBakeCache = new Map<string, BakeResult>();

/**
 * Cheap synchronous part of world setup: clone the GLB, re-centre on
 * the Shipwreck pivot, compute the cuboid land-fallback bbox, disable
 * per-mesh shadows (1186 meshes = no thanks), and collect the
 * tree/rock object lists. None of this touches per-vertex data, so it
 * runs in a few ms even on the full GLB.
 *
 * The expensive per-vertex trimesh bake is split out into
 * `useGroundCollidersBake`, which dispatches it to a Web Worker.
 */
function useTutorialBaseWorld(): TutorialBaseWorldData | null {
  const gltf = useAsset(TUTORIAL_GLB_PATH);
  const baseWorld = useMemo(() => {
    if (!gltf?.scene) return null;
    const root = gltf.scene.clone(true);
    root.updateMatrixWorld(true);

    // Re-centre the world so the player washes up next to the small
    // shipwreck on the SW island (the green-dot location the user
    // marked). Earlier we used a node named "Shipwreck", but that
    // pivot sits inside the Fort ruins on a *different* island ~250 m
    // from any visible wreck — spawning the player on top of a fort
    // tower with a 23 m drop. Use the actual visible wreck mesh
    // (SM_Prop_Shipwreck_03) instead; it sits on the SW island beach
    // at y≈2 m above sea level. Keep the legacy "Shipwreck" pivot as
    // a fallback so a future GLB swap that removes the prop names
    // still spawns somewhere sensible rather than at GLB origin.
    let spawnPivot: THREE.Object3D | null = null;
    let spawnPivotSource = "(none)";
    root.traverse((child) => {
      if (spawnPivot) return;
      if (child.name === "SM_Prop_Shipwreck_03") {
        spawnPivot = child;
        spawnPivotSource = "SM_Prop_Shipwreck_03";
      }
    });
    if (!spawnPivot) {
      root.traverse((child) => {
        if (spawnPivot) return;
        if (child.name === "Shipwreck") {
          spawnPivot = child;
          spawnPivotSource = "Shipwreck (legacy pivot)";
        }
      });
    }

    let offset: [number, number, number] = [0, 0, 0];
    if (spawnPivot) {
      const swp = new THREE.Vector3();
      (spawnPivot as THREE.Object3D).getWorldPosition(swp);
      // Scaled-then-translated so the pivot lands at roughly origin.
      offset = [-swp.x * WORLD_SCALE, -swp.y * WORLD_SCALE, -swp.z * WORLD_SCALE];
      console.log(
        `[TutorialIsland] Spawn pivot: ${spawnPivotSource} @ raw (${swp.x.toFixed(0)}, ${swp.y.toFixed(0)}, ${swp.z.toFixed(0)})`,
      );
    } else {
      console.warn(
        "[TutorialIsland] No spawn pivot found in GLB — spawning at GLB origin.",
      );
    }

    // Cuboid-fallback footprint = union bbox of `SM_Env_Beach_*`
    // meshes whose post-scale, post-offset centroid is within
    // `NEAR_RADIUS_M` of the shipwreck. Only used if the trimesh
    // extraction below tags zero meshes (defensive — should never
    // happen with the shipped GLB). Radius lives at module scope so
    // the fallback footprint matches the documented "near play area"
    // bubble; see the `NEAR_RADIUS_M` definition for sizing notes.
    const beachBox = new THREE.Box3();
    const tmpBox = new THREE.Box3();
    const tmpCenter = new THREE.Vector3();
    let beachCount = 0;
    root.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      if (!/^SM_Env_Beach_/.test(child.name)) return;
      tmpBox.setFromObject(child);
      if (!isFinite(tmpBox.min.x)) return;
      tmpBox.getCenter(tmpCenter);
      const wx = tmpCenter.x * WORLD_SCALE + offset[0];
      const wz = tmpCenter.z * WORLD_SCALE + offset[2];
      if (wx * wx + wz * wz > NEAR_RADIUS_SQ) return;
      if (beachCount === 0) beachBox.copy(tmpBox);
      else beachBox.union(tmpBox);
      beachCount += 1;
    });

    let groundY = 0.5;
    let groundCenter: [number, number] = [0, 0];
    let groundHalfExtent: [number, number] = [12, 12];
    if (beachCount > 0 && isFinite(beachBox.min.y)) {
      // Clamp the final extent so a single oversized mesh inside the
      // centroid filter can't blow the collider past NEAR_RADIUS_M.
      const rawMinX = beachBox.min.x * WORLD_SCALE + offset[0];
      const rawMaxX = beachBox.max.x * WORLD_SCALE + offset[0];
      const rawMinZ = beachBox.min.z * WORLD_SCALE + offset[2];
      const rawMaxZ = beachBox.max.z * WORLD_SCALE + offset[2];
      const minX = Math.max(rawMinX, -NEAR_RADIUS_M);
      const maxX = Math.min(rawMaxX, NEAR_RADIUS_M);
      const minZ = Math.max(rawMinZ, -NEAR_RADIUS_M);
      const maxZ = Math.min(rawMaxZ, NEAR_RADIUS_M);
      groundY = beachBox.min.y * WORLD_SCALE + offset[1];
      groundCenter = [(minX + maxX) / 2, (minZ + maxZ) / 2];
      groundHalfExtent = [(maxX - minX) / 2, (maxZ - minZ) / 2];
    } else {
      console.warn(
        `[TutorialIsland] No beach meshes within ${NEAR_RADIUS_M}m of shipwreck; ` +
          `falling back to a small ${groundHalfExtent[0] * 2}x${groundHalfExtent[1] * 2}m land pad.`,
      );
    }
    // Keep the collider top above the water sheet (y=0) on degenerate input.
    if (!isFinite(groundY) || groundY < 0.1) groundY = 0.5;

    // ── Sea-level lift ───────────────────────────────────────────
    // The shipwreck pivot lives at sea level inside the source GLB
    // (not 2m above as an earlier comment claimed), so anchoring
    // offset[1] off it can leave the beach geometry sitting at or
    // below WATER_SURFACE_Y — the player spawns half-submerged.
    //
    // If that's the case, bias the wrapping offset upward so the
    // beach min Y lands SEA_LEVEL_BUFFER above the water sheet.
    // We adjust both offset[1] (the visible mesh wrapper) and
    // groundY (the collider top) by the same amount so spawn,
    // colliders, and rendered geometry all move together. This MUST
    // happen before any rock/ground collider bake reads `offset`.
    const SEA_LEVEL_BUFFER = 0.6;
    if (beachCount > 0 && isFinite(beachBox.min.y)) {
      const beachWorldMinY = beachBox.min.y * WORLD_SCALE + offset[1];
      const targetMinY = WATER_SURFACE_Y + SEA_LEVEL_BUFFER;
      if (beachWorldMinY < targetMinY) {
        const lift = targetMinY - beachWorldMinY;
        offset[1] += lift;
        groundY += lift;
        console.log(
          `[TutorialIsland] Lifted island by ${lift.toFixed(2)}m to keep ` +
            `beach above sea level (was ${beachWorldMinY.toFixed(2)}m, ` +
            `now ${(beachWorldMinY + lift).toFixed(2)}m).`,
        );
      }
    }

    // 1186 meshes is far too many to cast shadows on. Disable per-mesh
    // shadows for the world — only the player + animals cast shadows.
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });

    const trees: THREE.Object3D[] = [];
    const rocks: THREE.Object3D[] = [];
    const flowers: THREE.Object3D[] = [];
    const palms: THREE.Object3D[] = [];
    root.traverse((child) => {
      const name = child.name || "";
      if (
        /^SM_Env_(Tree|PalmTree|Mangrove_Tree|Tree_Vines|PalmBush)/.test(name)
      ) {
        trees.push(child);
        if (/^SM_Env_PalmTree/.test(name)) {
          palms.push(child);
        }
      } else if (/^SM_Env_Rock/.test(name)) {
        rocks.push(child);
      } else if (
        // Pick-uppable foliage. Grass is intentionally excluded —
        // tens of thousands of grass tufts would flood the inventory
        // with single-stack pickups for no real value.
        /^SM_Env_(Flower|Plant|Mushroom|Bush)/.test(name)
      ) {
        flowers.push(child);
      }
    });

    // ── Pick the spawn XZ ────────────────────────────────────────
    // Default to wreck origin (0,0); searched-for value below
    // overrides it when we find a small isolated palm patch.
    //
    // Algorithm: among palm trees inside the SPAWN_SEARCH_RADIUS
    // donut around the wreck, score each by how isolated it is
    // (fewer neighbouring palms within ISOLATION_RADIUS = better,
    // since the user circled a one-tree sandbar) and how close it
    // is to the wreck (closer = better, since they want to wash up
    // RIGHT next to the wreck for the tutorial framing). The winning
    // palm's XZ becomes the spawn target — we step a small distance
    // toward the wreck so the capsule lands on sand BESIDE the
    // trunk, not inside the tree's collider footprint.
    let spawnXZ: [number, number] = [0, 0];
    if (palms.length > 0) {
      const SPAWN_MIN_RADIUS = 5;     // skip palms inside the wreck patch
      const SPAWN_MAX_RADIUS = 30;    // ignore far-shore palms
      const ISOLATION_RADIUS = 6;     // neighbour-counting window
      const NUDGE_TOWARD_WRECK = 1.6; // step off the trunk
      const palmWorldXZ: { x: number; z: number; obj: THREE.Object3D }[] = [];
      const tmpV = new THREE.Vector3();
      for (const palm of palms) {
        palm.getWorldPosition(tmpV);
        const wx = tmpV.x * WORLD_SCALE + offset[0];
        const wz = tmpV.z * WORLD_SCALE + offset[2];
        palmWorldXZ.push({ x: wx, z: wz, obj: palm });
      }
      type Cand = { x: number; z: number; dist: number; neighbours: number };
      const candidates: Cand[] = [];
      for (const p of palmWorldXZ) {
        const d2 = p.x * p.x + p.z * p.z;
        if (d2 < SPAWN_MIN_RADIUS * SPAWN_MIN_RADIUS) continue;
        if (d2 > SPAWN_MAX_RADIUS * SPAWN_MAX_RADIUS) continue;
        let neighbours = 0;
        for (const q of palmWorldXZ) {
          if (q === p) continue;
          const dx = q.x - p.x;
          const dz = q.z - p.z;
          if (dx * dx + dz * dz <= ISOLATION_RADIUS * ISOLATION_RADIUS) {
            neighbours += 1;
          }
        }
        candidates.push({ x: p.x, z: p.z, dist: Math.sqrt(d2), neighbours });
      }
      // Sort: fewest neighbours first, then closest to wreck.
      candidates.sort((a, b) =>
        a.neighbours !== b.neighbours
          ? a.neighbours - b.neighbours
          : a.dist - b.dist,
      );
      const best = candidates[0];
      if (best) {
        // Nudge toward wreck so we don't spawn inside the trunk.
        const len = Math.max(best.dist, 0.0001);
        const nx = best.x - (best.x / len) * NUDGE_TOWARD_WRECK;
        const nz = best.z - (best.z / len) * NUDGE_TOWARD_WRECK;
        spawnXZ = [nx, nz];
        console.log(
          `[TutorialIsland] Spawn XZ = isolated palm @ (${nx.toFixed(2)}, ${nz.toFixed(2)}) ` +
            `[wreck-distance=${best.dist.toFixed(1)}m, palm-neighbours=${best.neighbours}, ` +
            `palmCandidates=${candidates.length}/${palms.length}]`,
        );
      } else {
        console.warn(
          `[TutorialIsland] No palm tree within ${SPAWN_MIN_RADIUS}-${SPAWN_MAX_RADIUS}m ` +
            `donut of wreck — falling back to wreck origin spawn.`,
        );
      }
    }

    // ── Cuboid fallback pad coverage clamp ───────────────────────
    // The cuboid `groundCenter` / `groundHalfExtent` above were sized
    // around the wreck (origin). Now that spawn is moved to a palm
    // patch up to ~30 m off-origin, that pad might not cover the
    // spawn xz — and the pad is the LAST-RESORT floor when trimesh
    // extraction returns zero colliders (a degenerate path). If
    // we're outside the pad in that case, expand it just enough
    // (with a 4 m skirt) so the player still has dry land to drop
    // onto. Cheap insurance: this never runs in the normal trimesh-
    // ground codepath because that path ignores the cuboid pad.
    {
      const PAD_SKIRT = 4;
      const dxToCenter = Math.abs(spawnXZ[0] - groundCenter[0]);
      const dzToCenter = Math.abs(spawnXZ[1] - groundCenter[1]);
      if (dxToCenter > groundHalfExtent[0] - PAD_SKIRT) {
        groundHalfExtent[0] = dxToCenter + PAD_SKIRT;
      }
      if (dzToCenter > groundHalfExtent[1] - PAD_SKIRT) {
        groundHalfExtent[1] = dzToCenter + PAD_SKIRT;
      }
    }

    // ── Wind sway for tutorial trees ──────────────────────────────
    // Clone the foliage materials (per-original, not per-mesh) and
    // attach the WindSway vertex injection to the clones. Cloning
    // per-original keeps draw-call batching intact while making sure
    // we don't accidentally sway any non-tree mesh that shares the
    // source material. See effects/WindSway.ts for the shader.
    const windedMatCache = new Map<string, THREE.Material>();
    const swapTreeMaterial = (raw: THREE.Material) => {
      const cached = windedMatCache.get(raw.uuid);
      if (cached) return cached;
      const cloned = raw.clone();
      attachWindToMaterial(cloned);
      windedMatCache.set(raw.uuid, cloned);
      return cloned;
    };
    for (const treeRoot of trees) {
      treeRoot.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(swapTreeMaterial);
        } else if (mesh.material) {
          mesh.material = swapTreeMaterial(mesh.material);
        }
      });
    }

    // The per-rock trimesh collider bake used to live here, doing
    // per-vertex math on the main thread. It's now dispatched to the
    // shared collider-bake worker (see `useRockCollidersBake`) so
    // even rock-heavy GLBs don't add to the loading-overlay budget.

    // ── Material handoff audit ───────────────────────────────────
    // One-shot post-bake audit: walk every visible mesh and bucket
    // it by material name. Goals:
    //   1. Confirm no mesh fell back to the THREE default
    //      `MeshBasicMaterial` (white, unnamed) — that's the
    //      symptom we'd see if the GLB ever shipped without its
    //      embedded material assignments.
    //   2. Confirm WindSway only swapped the foliage material clones
    //      (1 per source material × winded count, NOT 1 per mesh).
    //   3. Print the raw distribution so we can see if e.g. the
    //      shipwreck is sharing PolygonPirates_Material_01_A with the
    //      sand (which would explain why texture remap touches both).
    const matCounts = new Map<string, number>();
    let untexturedFallback = 0;
    let meshesWalked = 0;
    // Three patterns of "default fallback" we want to flag:
    //   a) mesh has NO material at all (the renderer would assign a
    //      transient MeshBasicMaterial behind our back).
    //   b) material is a `MeshBasicMaterial` (GLTFLoader emits
    //      `MeshStandardMaterial` for valid PBR assignments — basic
    //      means something replaced it).
    //   c) material has no name AND its colour is THREE's default
    //      white (1,1,1) AND no texture map. The PolygonPirates
    //      atlases all carry both a name and a `map`, so this triple
    //      is a strong signature of the THREE default constructor.
    const isLikelyDefaultFallback = (mat: THREE.Material): boolean => {
      if ((mat as any).isMeshBasicMaterial) return true;
      const named = (mat.name || "").length > 0;
      if (named) return false;
      const std = mat as THREE.MeshStandardMaterial;
      const color = std.color;
      const noMap = !std.map;
      return (
        !!color &&
        color.r === 1 &&
        color.g === 1 &&
        color.b === 1 &&
        noMap
      );
    };
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      meshesWalked += 1;
      const m = mesh.material;
      const tally = (mat: THREE.Material | undefined) => {
        if (!mat) {
          matCounts.set("(no material)", (matCounts.get("(no material)") ?? 0) + 1);
          untexturedFallback += 1;
          return;
        }
        const name = mat.name || "(unnamed)";
        matCounts.set(name, (matCounts.get(name) ?? 0) + 1);
        if (isLikelyDefaultFallback(mat)) untexturedFallback += 1;
      };
      if (Array.isArray(m)) m.forEach(tally);
      else tally(m);
    });
    const matSummary = Array.from(matCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([n, c]) => `${n}=${c}`)
      .join(", ");
    console.log(
      `[TutorialIsland] Material audit: meshes=${meshesWalked}, ` +
        `windSwayCloned=${windedMatCache.size}, ` +
        `untexturedFallback=${untexturedFallback} | ${matSummary}`,
    );

    return {
      root,
      scale: WORLD_SCALE,
      offset,
      trees,
      rocks,
      flowers,
      groundY,
      groundCenter,
      groundHalfExtent,
      beachCount,
      spawnXZ,
      windedMaterials: Array.from(windedMatCache.values()),
    };
  }, [gltf]);

  // Dispose the cloned wind-sway materials when the base world
  // changes (HMR, GLB swap) or the tutorial scene unmounts. The
  // source materials live forever inside the asset cache; only our
  // clones need cleanup, otherwise repeat mounts would leak GPU
  // shader programs and sampler bindings.
  useEffect(() => {
    const winded = baseWorld?.windedMaterials;
    if (!winded || winded.length === 0) return;
    return () => {
      for (const mat of winded) mat.dispose();
    };
  }, [baseWorld]);

  return baseWorld;
}

/**
 * Background-worker trimesh ground-collider bake.
 *
 * Walking the GLB and per-vertex transforming every walkable mesh's
 * geometry is the part of world setup that previously blocked the
 * main thread (the original sync version stalled it for tens of ms,
 * and even the rAF time-sliced version still spent ~4 ms per frame
 * on the main thread, which would balloon further now that the bake
 * covers the *whole island* — no play-area radius filter — so
 * `<StreamedGroundColliders>` can mount the subset within
 * `STREAM_MOUNT_RADIUS_M` of the player as they wander the GLB's
 * ~1.8 km extent.
 *
 * Now the main thread only does the cheap candidate-mesh collection
 * (name + bbox-centroid filter), the per-mesh triangle-budget filter,
 * and a single bulk typed-array constructor copy of each accepted
 * candidate's `position` / `index` data into transferable buffers
 * (we can't transfer the geometry's own buffers because they're still
 * needed for rendering, but the constructor copy is a native memcpy
 * in the common non-interleaved-Float32 case — no per-vertex JS).
 * The actual per-vertex matrix transform — including folding the
 * wrapping `<group offset scale>` transform into every vertex so the
 * resulting `<RigidBody><TrimeshCollider/></RigidBody>` sits at the
 * origin — happens entirely inside `colliderBake.worker.ts` (the
 * shared collider-bake worker, also used by `useRockCollidersBake`
 * and available to any future scene whose `<TrimeshCollider>` props
 * come from baked GLB geometry). The worker posts the assembled
 * vertex/index arrays back via Transferable, so the main thread pays
 * zero copy on the return path.
 */
function useGroundCollidersBake(
  baseWorld: TutorialBaseWorldData | null,
  glbPath: string,
): BakeResult | null {
  // Seed initial state from the module cache so re-entries render the
  // baked colliders on the very first frame, before the effect even
  // runs — no flash of empty world between mount and bake completion.
  const [bake, setBake] = useState<BakeResult | null>(
    () => groundColliderBakeCache.get(glbPath) ?? null,
  );

  useEffect(() => {
    if (!baseWorld) {
      setBake(null);
      return;
    }

    // Cache hit: skip the chunked per-vertex bake entirely. The cached
    // vertices are already in final world coordinates, identical to
    // what we'd produce from this fresh `baseWorld` (same GLB content
    // ⇒ same Shipwreck-pivot offset ⇒ same baked geometry).
    const cached = groundColliderBakeCache.get(glbPath);
    if (cached) {
      setBake(cached);
      return;
    }

    setBake(null);

    let cancelled = false;
    const startedAt = performance.now();

    // Pre-flight pass: collect every candidate mesh plus the data the
    // worker needs to bake it (raw position/index buffers + the
    // combined world matrix). No per-vertex math here — just an
    // O(verts) flat copy per mesh (via the shared collider-bake
    // helpers) so the typed arrays can be transferred to the worker.
    // No play-area filter — we want the whole island walkable;
    // `<StreamedGroundColliders>` decides which baked colliders are
    // actually mounted at runtime.
    const wrapMat = new THREE.Matrix4()
      .makeTranslation(
        baseWorld.offset[0],
        baseWorld.offset[1],
        baseWorld.offset[2],
      )
      .multiply(
        new THREE.Matrix4().makeScale(
          baseWorld.scale,
          baseWorld.scale,
          baseWorld.scale,
        ),
      );
    const combined = new THREE.Matrix4();
    const tmpBox = new THREE.Box3();
    const candidates: BakeCandidateGroup[] = [];
    const transfers: ArrayBuffer[] = [];
    // Total-triangle accounting on the main thread keeps us from
    // posting a candidate over the wire whose triangles wouldn't fit
    // the total-budget anyway — we filter BEFORE doing any flat copy
    // of position/index data, which saves a tonne of typed-array
    // copies and worker-transfer bytes in the common dense-prop case.
    // The per-mesh cap is intentionally NOT enforced here: the bake
    // worker (with `chunkOversized: true` for the ground pass)
    // spatially chunks any candidate that exceeds `TRI_LIMIT_PER_MESH`
    // into multiple colliders rather than dropping it, so the
    // previously-dropped heavy dunes / wreck-hull skirts now make it
    // through as walkable surface.
    let totalTris = 0;
    let droppedTotal = 0;
    let interleavedFallbacks = 0;

    baseWorld.root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      if (!GROUND_NAME_RE.test(mesh.name || "")) return;
      tmpBox.setFromObject(mesh);
      if (!isFinite(tmpBox.min.x)) return;

      const geom = mesh.geometry as THREE.BufferGeometry;
      const posAttr = geom.attributes.position as
        | THREE.BufferAttribute
        | THREE.InterleavedBufferAttribute
        | undefined;
      if (!posAttr) return;
      const indexAttr = geom.index;

      // Compute the triangle count from the attribute metadata BEFORE
      // touching any vertex/index data, so meshes that would push us
      // past the total cap are skipped without ever paying for a flat
      // copy. The per-mesh cap is intentionally NOT enforced here —
      // the worker chunks oversized candidates into multiple colliders.
      const vertCount = posAttr.count;
      const triCount = indexAttr
        ? (indexAttr.count / 3) | 0
        : (vertCount / 3) | 0;
      if (totalTris + triCount > TOTAL_TRI_LIMIT) {
        droppedTotal += 1;
        return;
      }
      totalTris += triCount;

      const cp = copyPositions(posAttr);
      if (!cp) return;
      if (cp.interleavedFallback) interleavedFallbacks += 1;
      const indices = copyIndices(indexAttr);

      // Combined matrix per mesh. The worker multiplies each vertex by
      // this so the baked output is already in physics world space
      // (i.e. the `<group offset scale>` is folded in).
      combined.multiplyMatrices(wrapMat, mesh.matrixWorld);
      const matrix = packMatrix(combined);

      const candidateGeom: BakeCandidateGeom = {
        positions: cp.positions,
        indices,
        matrix,
      };
      candidates.push({
        name: mesh.name || "",
        geoms: [candidateGeom],
      });
      collectGeomTransfers(candidateGeom, transfers);
    });

    /**
     * Find the actual surface directly under the spawn xz (an
     * "isolated palm" patch near the shipwreck — see
     * useTutorialBaseWorld for selection) by 2D barycentric raycast
     * through every baked ground collider's triangles. This is what
     * we want the player to land on, NOT the tallest vertex anywhere
     * near the spawn (which would put them on top of the fort tower
     * or a high dune and kill them with fall damage on entry).
     *
     * Only the few colliders whose xz-bbox actually contains the
     * spawn xz contribute triangles to test, so the cost is small.
     */
    const computeSpawnSurfaceY = (
      groundColliders: GroundColliderGeometry[],
    ): number => {
      // Spawn XZ comes from the base world's "isolated palm" search,
      // not the wreck centre — see useTutorialBaseWorld for the
      // selection algorithm. The two-pass raycast below probes that
      // exact xz so the player's drop height is the natural sand
      // surface beside the palm, not the deck of the wreck nearby.
      const SPAWN_X = baseWorld.spawnXZ[0];
      const SPAWN_Z = baseWorld.spawnXZ[1];
      const RAY_ORIGIN_Y = 200;
      // Two-pass raycast against the baked trimesh:
      //   1. Natural ground only (sand / beach / forest leaves) —
      //      this is "the entire sand level" the player is meant to
      //      walk on. If a triangle of natural ground sits anywhere
      //      under the spawn xz, THAT is the spawn surface.
      //   2. Fallback: any tagged ground (decks, forts) — only used
      //      if the spawn xz happens to have no natural sand under
      //      it (e.g. a future spawn pivot moved over a fort tile).
      // Without the split, the shipwreck deck collider that happens
      // to overlap spawn wins the highest-Y race and the player
      // spawns on top of the wreck instead of on the sand beside it.
      const va = new THREE.Vector3();
      const vb = new THREE.Vector3();
      const vc = new THREE.Vector3();
      const raycastPass = (
        filter: ((g: GroundColliderGeometry) => boolean) | null,
      ): number => {
        let bestHitY = -Infinity;
        for (const g of groundColliders) {
          if (filter && !filter(g)) continue;
          // Quick xz-bbox reject (the streaming bbox is in world space).
          const dx = g.centerX - SPAWN_X;
          const dz = g.centerZ - SPAWN_Z;
          if (dx * dx + dz * dz > g.radius * g.radius) continue;
          const verts = g.vertices;
          const idx = g.indices;
          for (let t = 0; t < idx.length; t += 3) {
            const a = idx[t] * 3;
            const b = idx[t + 1] * 3;
            const c = idx[t + 2] * 3;
            va.set(verts[a], verts[a + 1], verts[a + 2]);
            vb.set(verts[b], verts[b + 1], verts[b + 2]);
            vc.set(verts[c], verts[c + 1], verts[c + 2]);
            const dx1 = vb.x - va.x;
            const dz1 = vb.z - va.z;
            const dx2 = vc.x - va.x;
            const dz2 = vc.z - va.z;
            const denom = dx1 * dz2 - dx2 * dz1;
            if (denom === 0) continue;
            const px = SPAWN_X - va.x;
            const pz = SPAWN_Z - va.z;
            const u = (px * dz2 - dx2 * pz) / denom;
            const w = (dx1 * pz - px * dz1) / denom;
            if (u < 0 || w < 0 || u + w > 1) continue;
            const y = va.y + u * (vb.y - va.y) + w * (vc.y - va.y);
            if (y > bestHitY && y <= RAY_ORIGIN_Y) bestHitY = y;
          }
        }
        return bestHitY;
      };
      const naturalHitY = raycastPass((g) =>
        NATURAL_GROUND_NAME_RE.test(g.name),
      );
      if (isFinite(naturalHitY)) {
        console.log(
          `[TutorialIsland] Spawn surface = natural sand at y=${naturalHitY.toFixed(2)}`,
        );
        return naturalHitY;
      }
      const anyHitY = raycastPass(null);
      if (isFinite(anyHitY)) {
        console.warn(
          `[TutorialIsland] No natural ground under spawn xz; ` +
            `falling back to nearest tagged surface at y=${anyHitY.toFixed(2)}.`,
        );
        return anyHitY;
      }
      return baseWorld.groundY;
    };

    const finish = (groundColliders: GroundColliderGeometry[]) => {
      if (cancelled) return;
      const spawnSurfaceY = computeSpawnSurfaceY(groundColliders);
      const result: BakeResult = {
        groundColliders,
        spawnSurfaceY,
      };
      // Cache the completed bake so the next mount of the tutorial
      // skips the worker dispatch and reuses these arrays directly.
      groundColliderBakeCache.set(glbPath, result);
      setBake(result);
    };

    // No candidates — nothing to bake. Resolve immediately so the
    // outer hook can fall through to the cuboid land fallback.
    if (candidates.length === 0) {
      console.log(
        "[TutorialIsland] Trimesh bake skipped — no candidate meshes tagged.",
      );
      finish([]);
      return () => {
        cancelled = true;
      };
    }

    const cancelBake = dispatchColliderBake({
      candidates,
      transfers,
      triLimitPerCollider: TRI_LIMIT_PER_MESH,
      totalTriLimit: TOTAL_TRI_LIMIT,
      // Ground bake: spatially split any candidate over the per-collider
      // cap into multiple chunks instead of dropping it. Without this,
      // the heavy dune ridges / wreck-hull skirts that exceed
      // `TRI_LIMIT_PER_MESH` ship as no collider at all and the player
      // can fall through them. Rocks intentionally stay non-chunked
      // (a rock should be a single physics body).
      chunkOversized: true,
      tag: "TutorialIsland.ground",
      onResult: (data) => {
        if (cancelled) return;
        const elapsed = performance.now() - startedAt;
        // Worker output already carries the per-collider bbox metadata
        // (centerX/centerZ/radius) that the `<StreamedGroundColliders>`
        // component needs, so the typed-array entries can be handed
        // through unchanged. `data.colliders.length` may exceed
        // `candidates.length` because dense source meshes get split
        // into multiple chunk colliders by the worker.
        const groundColliders: GroundColliderGeometry[] = data.colliders;
        // Combined "dropped over total budget" count: candidates we
        // skipped on the main thread (couldn't even fit their tri count
        // into the total budget) plus chunks the worker had to skip
        // for the same reason after splitting.
        const droppedOverBudget = droppedTotal + data.droppedTotal;
        const chunkedSources = data.chunkedSources ?? 0;
        const chunkCount = data.chunkCount ?? 0;
        console.log(
          `[TutorialIsland] Trimesh bake done in ${elapsed.toFixed(0)}ms ` +
            `(${candidates.length} candidate meshes, ` +
            `worker=${data.elapsedMs.toFixed(0)}ms). ` +
            `groundColliders=${groundColliders.length} tris=${data.totalTris}` +
            `${chunkedSources ? `, chunkedSources=${chunkedSources} chunkCount=${chunkCount}` : ""}` +
            `${data.droppedHighTri ? `, droppedHighTri=${data.droppedHighTri}` : ""}` +
            `${droppedOverBudget ? `, droppedOverBudget=${droppedOverBudget}` : ""}` +
            `${interleavedFallbacks ? `, interleavedFallbacks=${interleavedFallbacks}` : ""}`,
        );
        finish(groundColliders);
      },
      onError: () => {
        // Worker construction or runtime failure (e.g. CSP, ancient
        // browser): fall back to the cuboid land collider. The
        // existing land-fallback path in `TutorialIslandSceneContents`
        // handles an empty `groundColliders` list.
        if (cancelled) return;
        finish([]);
      },
    });

    return () => {
      cancelled = true;
      cancelBake();
    };
  }, [baseWorld, glbPath]);

  return bake;
}

// Module-level cache of completed per-rock bakes, keyed by GLB path.
// The baked vertices are pre-transformed into final world space so
// the typed-array buffers themselves are safe to reuse across mounts.
//
// Each cached entry pairs the buffers with the rock's GLB-node name
// AND its position in the `baseWorld.rocks` array — UUIDs change on
// every `gltf.scene.clone(true)`, but the post-clone traversal order
// and node names are stable. We need both because two separate rock
// nodes can legitimately share a GLB node name (the GLB has dozens of
// rocks named `SM_Env_Rock_*` with overlap), and matching on name
// alone could swap or drop colliders on cache hits. Matching on
// `(rockIndex, nodeName)` is unambiguous: same index ⇒ same logical
// rock, name match is the integrity check that the GLB hasn't been
// reordered between bake and re-attach.
interface CachedRockColliderEntry {
  rockIndex: number;
  nodeName: string;
  vertices: Float32Array;
  indices: Uint32Array;
}
const rockColliderBakeCache = new Map<string, CachedRockColliderEntry[]>();

/**
 * Background-worker bake of the per-rock trimesh colliders.
 *
 * Each harvestable rock can be a parent node with several material/
 * LOD splits underneath, and the player should bump into the rock as
 * a single object — not be able to step between sub-meshes. So every
 * rock is sent to the worker as one `BakeCandidateGroup` whose
 * `geoms` array carries every sub-mesh; the worker welds them into a
 * single trimesh per rock and posts it back ready to hand to
 * `<TrimeshCollider>`.
 *
 * The bake used to live inside `useTutorialBaseWorld`, doing the
 * per-vertex matrix multiply on the main thread. Splitting it out
 * here means the rock work joins the ground bake on the worker —
 * the loading overlay no longer pays for either, even if the GLB
 * grows substantially more rocks.
 */
function useRockCollidersBake(
  baseWorld: TutorialBaseWorldData | null,
  glbPath: string,
): RockColliderData[] | null {
  // Helper that re-binds cached `{rockIndex, nodeName, vertices,
  // indices}` entries to the current scene's `Object3D` instances.
  // Every mount produces a fresh GLB clone (new UUIDs), but the
  // `baseWorld.rocks` traversal order is stable for the same GLB —
  // so we use the index as the primary identity and the node name as
  // an integrity guard. If the integrity check fails (the GLB has
  // been reordered, e.g. via an asset reload during dev), we drop
  // the whole cache and force a fresh bake rather than serving
  // mismatched colliders.
  const reattachCachedColliders = (
    rocks: THREE.Object3D[],
    cached: CachedRockColliderEntry[],
  ): RockColliderData[] | null => {
    const out: RockColliderData[] = [];
    for (const entry of cached) {
      const obj = rocks[entry.rockIndex];
      if (!obj) return null; // GLB shrunk → cache is stale
      if ((obj.name || "") !== entry.nodeName) return null; // GLB reordered → cache is stale
      out.push({
        object: obj,
        vertices: entry.vertices,
        indices: entry.indices,
      });
    }
    return out;
  };

  const [colliders, setColliders] = useState<RockColliderData[] | null>(
    () => null,
  );

  useEffect(() => {
    if (!baseWorld) {
      setColliders(null);
      return;
    }

    // Cache hit: re-bind the cached buffers to this mount's rock
    // `Object3D` instances and short-circuit the worker dispatch.
    // The integrity check inside `reattachCachedColliders` returns
    // `null` if the GLB has changed shape since the bake (asset reload,
    // node reorder); we treat that as a cache miss and re-bake.
    const cached = rockColliderBakeCache.get(glbPath);
    if (cached) {
      const reattached = reattachCachedColliders(baseWorld.rocks, cached);
      if (reattached) {
        setColliders(reattached);
        return;
      }
      console.warn(
        "[TutorialIsland] Rock collider cache stale (GLB reordered) — re-baking.",
      );
      rockColliderBakeCache.delete(glbPath);
    }

    setColliders(null);
    const startedAt = performance.now();
    let cancelled = false;

    const wrapMat = new THREE.Matrix4()
      .makeTranslation(
        baseWorld.offset[0],
        baseWorld.offset[1],
        baseWorld.offset[2],
      )
      .multiply(
        new THREE.Matrix4().makeScale(
          baseWorld.scale,
          baseWorld.scale,
          baseWorld.scale,
        ),
      );
    const combined = new THREE.Matrix4();
    const tmpCenter = new THREE.Vector3();

    // Bake nearest-to-spawn rocks first so the total triangle cap, if
    // it ever fires, only drops far-off background rocks the player
    // can't reach — never the rocks they'd actually walk into. We keep
    // the rock's *original* index in `baseWorld.rocks` alongside it
    // because the cache uses that index as its primary identity (the
    // sort order is volatile, the input order is stable).
    const rocksByDistance = baseWorld.rocks
      .map((rock, rockIndex) => {
        rock.getWorldPosition(tmpCenter);
        const wx = tmpCenter.x * baseWorld.scale + baseWorld.offset[0];
        const wz = tmpCenter.z * baseWorld.scale + baseWorld.offset[2];
        return { rock, rockIndex, d2: wx * wx + wz * wz };
      })
      .sort((a, b) => a.d2 - b.d2);

    const candidates: BakeCandidateGroup[] = [];
    const transfers: ArrayBuffer[] = [];
    // Tag candidates with a unique per-bake key so the result can be
    // matched back to its source `Object3D` AND its original index in
    // `baseWorld.rocks` — even if two rocks share a node name (rare
    // but possible in the GLB). The candidate-key index here is just
    // a counter; the rockIndex on the entry is the canonical identity
    // used for cache re-attach.
    const candidateBindings = new Map<
      string,
      { object: THREE.Object3D; rockIndex: number }
    >();
    let interleavedFallbacks = 0;
    let candidateIdx = 0;

    let droppedHighTriEarly = 0;

    for (const { rock, rockIndex } of rocksByDistance) {
      // Cheap pre-pass: sum the rock's submesh tri counts straight from
      // the attribute metadata. If the rock is already over the
      // per-collider cap we skip the per-submesh `copyPositions` /
      // `copyIndices` typed-array allocations entirely — the worker
      // would just reject the group anyway, and copying a multi-MB
      // dense rock's vertex buffer for nothing is the cost the ground
      // bake already avoids with the same trick (see line ~780).
      let preTriTotal = 0;
      rock.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        const geom = mesh.geometry as THREE.BufferGeometry;
        const posAttr = geom.attributes.position as
          | THREE.BufferAttribute
          | undefined;
        if (!posAttr) return;
        const indexAttr = geom.index;
        const vc = posAttr.count;
        const tc = indexAttr ? (indexAttr.count / 3) | 0 : (vc / 3) | 0;
        preTriTotal += tc;
      });
      if (preTriTotal > ROCK_TRI_LIMIT) {
        droppedHighTriEarly += 1;
        continue;
      }

      const geoms: BakeCandidateGeom[] = [];
      rock.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        const geom = mesh.geometry as THREE.BufferGeometry;
        const posAttr = geom.attributes.position as
          | THREE.BufferAttribute
          | THREE.InterleavedBufferAttribute
          | undefined;
        const cp = copyPositions(posAttr);
        if (!cp) return;
        if (cp.interleavedFallback) interleavedFallbacks += 1;
        const indices = copyIndices(geom.index);
        combined.multiplyMatrices(wrapMat, mesh.matrixWorld);
        const matrix = packMatrix(combined);
        const candidateGeom: BakeCandidateGeom = {
          positions: cp.positions,
          indices,
          matrix,
        };
        geoms.push(candidateGeom);
        collectGeomTransfers(candidateGeom, transfers);
      });
      if (geoms.length === 0) continue;
      const name = `${candidateIdx}|${rock.name || "unnamed"}`;
      candidateBindings.set(name, { object: rock, rockIndex });
      candidates.push({ name, geoms });
      candidateIdx += 1;
    }

    if (candidates.length === 0) {
      console.log(
        "[TutorialIsland] Rock bake skipped — no rocks tagged.",
      );
      rockColliderBakeCache.set(glbPath, []);
      setColliders([]);
      return () => {
        cancelled = true;
      };
    }

    const cancelBake = dispatchColliderBake({
      candidates,
      transfers,
      triLimitPerCollider: ROCK_TRI_LIMIT,
      totalTriLimit: ROCK_TRI_TOTAL_LIMIT,
      tag: "TutorialIsland.rocks",
      onResult: (data) => {
        if (cancelled) return;
        const elapsed = performance.now() - startedAt;
        const out: RockColliderData[] = [];
        const cacheEntries: CachedRockColliderEntry[] = [];
        for (const baked of data.colliders) {
          const binding = candidateBindings.get(baked.name);
          if (!binding) continue;
          out.push({
            object: binding.object,
            vertices: baked.vertices,
            indices: baked.indices,
          });
          cacheEntries.push({
            rockIndex: binding.rockIndex,
            nodeName: binding.object.name || "",
            vertices: baked.vertices,
            indices: baked.indices,
          });
        }
        rockColliderBakeCache.set(glbPath, cacheEntries);
        console.log(
          `[TutorialIsland] Rock collider bake done in ${elapsed.toFixed(0)}ms ` +
            `(${candidates.length} rocks, worker=${data.elapsedMs.toFixed(0)}ms). ` +
            `colliders=${out.length} tris=${data.totalTris}` +
            `${droppedHighTriEarly ? `, droppedHighTriEarly=${droppedHighTriEarly}` : ""}` +
            `${data.droppedHighTri ? `, droppedHighTri=${data.droppedHighTri}` : ""}` +
            `${data.droppedTotal ? `, droppedOverBudget=${data.droppedTotal}` : ""}` +
            `${interleavedFallbacks ? `, interleavedFallbacks=${interleavedFallbacks}` : ""}`,
        );
        setColliders(out);
      },
      onError: () => {
        if (cancelled) return;
        // Fallback: no rock colliders for this mount. Rocks stay
        // visible and remain harvestable — players can walk through
        // them until the bake is repaired.
        //
        // We deliberately do NOT cache the empty result: a worker
        // failure is most likely transient (CSP race on first load,
        // OOM under memory pressure, browser-level worker recycling),
        // and caching `[]` would stick a no-collider state for the
        // rest of the session even after the underlying problem
        // clears. The next mount re-tries the bake from scratch.
        setColliders([]);
      },
    });

    return () => {
      cancelled = true;
      cancelBake();
    };
  }, [baseWorld, glbPath]);

  return colliders;
}

/**
 * Combines the cheap synchronous base-world derivation with the two
 * worker-driven trimesh bakes (ground + per-rock colliders). Returns
 * `null` until ALL THREE are ready, so `TutorialIslandSceneContents`
 * only mounts the player once both collider sets exist — no race
 * where the capsule falls through the world or walks through a rock
 * while a bake is still in flight.
 *
 * Both bakes use the same generalized worker (see
 * `colliderBake.worker.ts`) and run in parallel on the same Web
 * Worker pool slot — they're independent so neither blocks the other,
 * and the loading overlay only has to wait for the slower of the two.
 */
function useTutorialWorld(): TutorialWorldData | null {
  const baseWorld = useTutorialBaseWorld();
  const bake = useGroundCollidersBake(baseWorld, TUTORIAL_GLB_PATH);
  const rockColliders = useRockCollidersBake(baseWorld, TUTORIAL_GLB_PATH);

  return useMemo(() => {
    if (!baseWorld || !bake || !rockColliders) return null;
    console.log(
      `[TutorialIsland] World ready. trees=${baseWorld.trees.length} ` +
        `rocks=${baseWorld.rocks.length} beach=${baseWorld.beachCount} ` +
        `offset=(${baseWorld.offset.map((v) => v.toFixed(2)).join(", ")}) ` +
        `groundY=${baseWorld.groundY.toFixed(2)} ` +
        `spawnSurfaceY=${bake.spawnSurfaceY.toFixed(2)} ` +
        `spawnXZ=(${baseWorld.spawnXZ[0].toFixed(2)}, ${baseWorld.spawnXZ[1].toFixed(2)}) ` +
        `groundCenter=(${baseWorld.groundCenter[0].toFixed(1)}, ${baseWorld.groundCenter[1].toFixed(1)}) ` +
        `groundHalfExtent=(${baseWorld.groundHalfExtent[0].toFixed(1)}, ${baseWorld.groundHalfExtent[1].toFixed(1)}) ` +
        `groundColliders=${bake.groundColliders.length} ` +
        `rockColliders=${rockColliders.length}`,
    );
    return {
      ...baseWorld,
      groundColliders: bake.groundColliders,
      rockColliders,
      spawnSurfaceY: bake.spawnSurfaceY,
    };
  }, [baseWorld, bake, rockColliders]);
}

/**
 * Distance-based LOD for the tutorial-island GLB. The world.root mesh
 * tree contains 2400+ pieces; at WORLD_SCALE=1.0 most of them sit
 * hundreds-of-metres-to-km from the player and don't need shadow-pass
 * cost or even draw cost.
 *
 * Three quality tiers, evaluated against horizontal distance from the
 * player to each mesh's pre-recorded world centroid:
 *   - <  HIGH_DIST  (30 m): full quality, shadows on
 *   - <  MID_DIST  (300 m): visible, no shadows
 *   - >= MID_DIST          : hidden
 *
 * Centroids are captured ONCE on mount (post-`updateMatrixWorld`) so
 * the per-tick cost is just an xz distance compare per mesh. Re-eval
 * runs at 5 Hz, which is more than enough for shadow flips at human
 * walk speed and avoids touching mesh.visible every frame.
 *
 * Ground meshes (matching `GROUND_NAME_RE`) are exempt from the cull
 * — the player walks on them, and they're already streamed for
 * physics by `<StreamedGroundColliders>`. Hiding them visually would
 * leave invisible walkable surfaces.
 */
const LOD_HIGH_DIST_SQ = 30 * 30;
const LOD_MID_DIST_SQ = 300 * 300;
const LOD_TICK_INTERVAL = 0.2;

// Tier IDs — tracked per entry so we only write the three Mesh
// properties on tier transitions (cheap nominal-case loop, no flicker
// at threshold boundaries from per-frame thrash).
const TIER_UNINIT = -1;
const TIER_HIGH = 0;
const TIER_MID = 1;
const TIER_FAR = 2;

interface LodMeshEntry {
  mesh: THREE.Mesh;
  cx: number;
  cz: number;
  isGround: boolean;
  /** Last LOD tier we wrote to this mesh; starts UNINIT to force first write. */
  lastTier: number;
  /**
   * Latches once an external system (e.g. `TutorialIslandHarvestables`,
   * which hides chopped trees / mined rocks via
   * `node.object.visible = false`) flips a mesh invisible while we
   * thought it should be visible. Once latched, the LOD never writes
   * to that mesh again, so harvested props stay gone.
   */
  externallyHidden: boolean;
}

function GroundLODController({
  root,
  playerPosition,
}: {
  root: THREE.Object3D;
  playerPosition: THREE.Vector3;
}) {
  const entriesRef = useRef<LodMeshEntry[]>([]);
  const tickAccumRef = useRef(0);

  useEffect(() => {
    root.updateMatrixWorld(true);
    const entries: LodMeshEntry[] = [];
    const tmpBox = new THREE.Box3();
    const tmpCenter = new THREE.Vector3();
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      tmpBox.setFromObject(mesh);
      tmpBox.getCenter(tmpCenter);
      entries.push({
        mesh,
        cx: tmpCenter.x,
        cz: tmpCenter.z,
        isGround: GROUND_NAME_RE.test(mesh.name || ""),
        lastTier: TIER_UNINIT,
        externallyHidden: false,
      });
    });
    entriesRef.current = entries;
    tickAccumRef.current = LOD_TICK_INTERVAL;
    return () => {
      entriesRef.current = [];
    };
  }, [root]);

  useFrame((_, delta) => {
    tickAccumRef.current -= delta;
    if (tickAccumRef.current > 0) return;
    tickAccumRef.current = LOD_TICK_INTERVAL;
    const px = playerPosition.x;
    const pz = playerPosition.z;
    const entries = entriesRef.current;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.externallyHidden) continue;

      // Detect external hide: previous LOD tick wanted this mesh
      // visible, but something (e.g. harvest) flipped mesh.visible
      // to false. Latch and never touch it again.
      if (
        e.lastTier !== TIER_UNINIT &&
        e.lastTier !== TIER_FAR &&
        e.mesh.visible === false
      ) {
        e.externallyHidden = true;
        continue;
      }

      const dx = e.cx - px;
      const dz = e.cz - pz;
      const dSq = dx * dx + dz * dz;

      // Compute the target tier for this mesh.
      let tier: number;
      if (e.isGround) {
        // Ground is never visibility-culled (player walks on it).
        tier = dSq < LOD_HIGH_DIST_SQ ? TIER_HIGH : TIER_MID;
      } else if (dSq < LOD_HIGH_DIST_SQ) {
        tier = TIER_HIGH;
      } else if (dSq < LOD_MID_DIST_SQ) {
        tier = TIER_MID;
      } else {
        tier = TIER_FAR;
      }

      if (tier === e.lastTier) continue;
      e.lastTier = tier;
      const m = e.mesh;
      switch (tier) {
        case TIER_HIGH:
          m.visible = true;
          m.castShadow = true;
          m.receiveShadow = true;
          break;
        case TIER_MID:
          m.visible = true;
          m.castShadow = false;
          m.receiveShadow = e.isGround;
          break;
        case TIER_FAR:
          m.visible = false;
          m.castShadow = false;
          m.receiveShadow = false;
          break;
      }
    }
  });

  return null;
}

function TutorialWorld({
  world,
  playerPosition,
}: {
  world: TutorialWorldData;
  playerPosition: THREE.Vector3;
}) {
  return (
    <>
      <group
        position={world.offset}
        scale={[world.scale, world.scale, world.scale]}
      >
        <primitive object={world.root} />
      </group>
      <GroundLODController root={world.root} playerPosition={playerPosition} />
      <TutorialIslandHarvestables
        trees={world.trees}
        rocks={world.rocks}
        flowers={world.flowers}
        rockColliders={world.rockColliders}
        worldScale={world.scale}
        worldOffset={world.offset}
        playerPosition={playerPosition}
      />
    </>
  );
}

/**
 * Renders every active enemy from `useEnemyManager` for the tutorial
 * island scene. Mirrors the inline `enemies.map(...)` block used by
 * GameScene so wave-spawned mobs actually appear in this scene too.
 */
function TutorialIslandEnemies({
  playerPosition,
}: {
  playerPosition: THREE.Vector3;
}) {
  const enemies = useEnemyManager((s) => s.enemies);
  return (
    <>
      {enemies.map((enemy) => (
        <Enemy key={enemy.id} data={enemy} playerPosition={playerPosition} />
      ))}
    </>
  );
}

/**
 * Mirror of GameScene's `ModeControllerUpdater` — required so the
 * combat/build/harvest mode-machine ticks while the player is on the
 * tutorial island and harvest-mode swaps work as expected.
 */
function ModeControllerUpdater() {
  useEffect(() => {
    registerModeGetter(() => useGameStore.getState().interactionMode);
    initializeControllers();
    return () => {
      resetGameFlow();
    };
  }, []);

  useEffect(() => {
    let lastTime = performance.now();
    let raf: number;
    const tick = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      updateActiveController(Math.min(delta, 0.1));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return null;
}

/**
 * The ocean surface sheet at `surfaceY`. The seabed and its terrain are
 * painted by `<UnderwaterVolume>` itself — the raymarched fBm terrain
 * inside that shader doubles as the visible sea floor, so we no longer
 * need a separate sand plane underneath.
 *
 * Surface props were previously tuned for deep open-ocean sailing
 * (opacity 0.92, near-black navy, choppy 4.0). At a shore-side spawn
 * those values flooded the frame with a wall of dark choppy water,
 * cropped the sky entirely and made the starter sandbar look pasted
 * on. Toned down here for shore viewing — the SailingMode boat scene
 * still uses its own SeaSurface instance with its open-ocean values.
 *
 * Two sheets are stacked so the shoreline reads correctly:
 *   - Deep ocean sheet (full extent, slightly lighter navy, less opaque)
 *     so the horizon line and sky are visible above it.
 *   - Shallow band sheet (centred on the island, ~180m extent, soft
 *     turquoise, low opacity) sits over the deep sheet near land. The
 *     transparency falloff at its edge mimics a shallow-water shelf
 *     and breaks up the hard ocean / beach edge.
 */
function WaterSheets({
  surfaceY,
  extent,
}: {
  surfaceY: number;
  extent: number;
}) {
  return (
    <>
      <SeaSurface
        size={extent}
        y={surfaceY}
        opacity={0.8}
        seaBase="#1a4258"
        seaWaterColor="#b8d4dd"
        choppy={2.8}
        height={0.4}
        renderOrder={1}
      />
      <SeaSurface
        size={180}
        y={surfaceY + 0.02}
        opacity={0.45}
        seaBase="#3d8a9c"
        seaWaterColor="#c8e7ec"
        choppy={1.6}
        height={0.18}
        renderOrder={2}
      />
    </>
  );
}

/**
 * Mounts only the ground trimesh colliders within `STREAM_MOUNT_RADIUS_M`
 * of the player. The full set of baked colliders covers the entire
 * island (~1.8 km), but we only ever keep a thin ring around the
 * player active so Rapier never has to step thousands of trimesh
 * triangles per frame.
 *
 * Implementation:
 *   - Distance check runs in `useFrame` but only after the player has
 *     moved `STREAM_RECHECK_DIST_M` since the last check, so the O(N)
 *     sweep happens ~once per second of normal walking.
 *   - Hysteresis (mount inside MOUNT, unmount outside UNMOUNT) prevents
 *     a collider sitting near the boundary from flickering on and off.
 *   - React's keyed reconciliation handles the actual mount/unmount —
 *     each `<RigidBody>` is keyed by mesh index so unchanged colliders
 *     keep their physics handles between updates.
 */
function StreamedGroundColliders({
  colliders,
  playerPosRef,
}: {
  colliders: GroundColliderGeometry[];
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}) {
  // Compute the initial active set from the player's current position
  // (the spawn) so the first frame already has its colliders mounted
  // and the player doesn't fall through the floor before useFrame ticks.
  const computeActive = useCallback(
    (
      px: number,
      pz: number,
      prev: ReadonlySet<number> | null,
    ): Set<number> => {
      const next = new Set<number>();
      const mountSq =
        STREAM_MOUNT_RADIUS_M * STREAM_MOUNT_RADIUS_M;
      const unmountSq =
        STREAM_UNMOUNT_RADIUS_M * STREAM_UNMOUNT_RADIUS_M;
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        const dx = c.centerX - px;
        const dz = c.centerZ - pz;
        const distSq = dx * dx + dz * dz;
        // Effective distance to the mesh's bbox (centroid distance
        // minus its xz radius). Squared comparison avoids the sqrt
        // for the common "obviously far" case.
        const r = c.radius;
        const inMount =
          distSq <= mountSq + 2 * r * STREAM_MOUNT_RADIUS_M + r * r;
        const inUnmount =
          distSq <= unmountSq + 2 * r * STREAM_UNMOUNT_RADIUS_M + r * r;
        // Hysteresis: stay mounted until past the unmount radius.
        if (prev && prev.has(i) ? inUnmount : inMount) next.add(i);
      }
      return next;
    },
    [colliders],
  );

  // Fired-cue tracking: each ground mesh index that has already played
  // its dust-puff cue this session. The initial active set (the ring
  // around the spawn point) is seeded as already-fired below so the
  // player doesn't get a faceful of dust the moment the world loads.
  const firedCueRef = useRef<Set<number>>(new Set());
  const cueIdRef = useRef(0);
  const [cues, setCues] = useState<StreamDustCue[]>([]);

  const [active, setActive] = useState<Set<number>>(() => {
    const initial = computeActive(
      playerPosRef.current.x,
      playerPosRef.current.z,
      null,
    );
    // Suppress cues for everything mounted on the very first frame.
    for (const i of initial) firedCueRef.current.add(i);
    return initial;
  });
  const lastCheck = useRef({
    x: playerPosRef.current.x,
    z: playerPosRef.current.z,
  });
  const activeRef = useRef(active);
  activeRef.current = active;

  // Re-seed when the collider list changes (e.g. on a fresh world load).
  useEffect(() => {
    const next = computeActive(
      playerPosRef.current.x,
      playerPosRef.current.z,
      null,
    );
    setActive(next);
    lastCheck.current.x = playerPosRef.current.x;
    lastCheck.current.z = playerPosRef.current.z;
    // New collider list = new session: forget which cues fired and
    // re-suppress the spawn ring so the first frame is silent again.
    firedCueRef.current = new Set(next);
    setCues([]);
  }, [computeActive, playerPosRef]);

  const removeCue = useCallback((id: number) => {
    setCues((prev) => prev.filter((c) => c.id !== id));
  }, []);

  useFrame((state) => {
    const px = playerPosRef.current.x;
    const pz = playerPosRef.current.z;
    const dx = px - lastCheck.current.x;
    const dz = pz - lastCheck.current.z;
    if (
      dx * dx + dz * dz <
      STREAM_RECHECK_DIST_M * STREAM_RECHECK_DIST_M
    ) {
      return;
    }
    lastCheck.current.x = px;
    lastCheck.current.z = pz;

    const prev = activeRef.current;
    const next = computeActive(px, pz, prev);

    // Cheap set-equality check: same size AND every element shared.
    let same = next.size === prev.size;
    if (same) {
      for (const i of next) {
        if (!prev.has(i)) {
          same = false;
          break;
        }
      }
    }
    if (!same) setActive(next);

    // Stream-cue trigger: whether or not the active set just changed,
    // look for the closest currently-mounted mesh whose cue hasn't
    // fired yet AND whose nearest edge is within
    // `STREAM_CUE_TRIGGER_DIST_M` of the player. Fire one cue at most
    // per stream check (~one per 4 m walked) so the effect feels like
    // an occasional footstep highlight rather than a dust storm.
    //
    // This unified check covers both interesting cases:
    //   1. A mesh streams in already close to the player (fast sprint
    //      or teleport into a fresh region) — picked up immediately.
    //   2. A mesh streamed in further out, the player kept walking,
    //      and is now close enough to step onto it — picked up on a
    //      later check.
    let closestI = -1;
    let closestDist = Infinity;
    for (const i of next) {
      if (firedCueRef.current.has(i)) continue;
      const c = colliders[i];
      const dxc = c.centerX - px;
      const dzc = c.centerZ - pz;
      const distEdge = Math.hypot(dxc, dzc) - c.radius;
      if (distEdge <= STREAM_CUE_TRIGGER_DIST_M && distEdge < closestDist) {
        closestI = i;
        closestDist = distEdge;
      }
    }
    if (closestI >= 0) {
      firedCueRef.current.add(closestI);
      const cueId = cueIdRef.current++;
      const py = playerPosRef.current.y - STREAM_CUE_FOOT_OFFSET_M;
      const startTime = state.clock.elapsedTime;
      setCues((prevCues) => [
        ...prevCues,
        { id: cueId, x: px, y: py, z: pz, startTime },
      ]);
    }
  });

  // One fixed RigidBody per active ground mesh. Vertices are already
  // in physics world coordinates (the wrapping group's offset+scale
  // was folded in during baking), so the body sits at the origin.
  const items: JSX.Element[] = [];
  for (const i of active) {
    const g = colliders[i];
    items.push(
      <RigidBody
        key={`ground-${i}-${g.name}`}
        type="fixed"
        colliders={false}
      >
        <TrimeshCollider args={[g.vertices, g.indices]} />
      </RigidBody>,
    );
  }
  return (
    <>
      {items}
      <TerrainStreamDustCues cues={cues} onCueExpired={removeCue} />
      {/* Dev-only overlay. Returns null when the F8 cheat
          `debugColliders` is off, so it costs nothing in production —
          but when toggled on it walks the same `active` set above to
          draw a wireframe + tinted xz bbox per mounted chunk and
          mount/unmount radius rings around the player. */}
      <StreamedColliderDebugOverlay
        colliders={colliders}
        active={active}
        playerPosRef={playerPosRef}
        mountRadius={STREAM_MOUNT_RADIUS_M}
        unmountRadius={STREAM_UNMOUNT_RADIUS_M}
      />
    </>
  );
}

/**
 * Inner scene contents that depend on the loaded GLB. Calling
 * `useTutorialWorld()` here suspends until the GLB is ready, which means
 * the spawn position and the ground collider are placed using the
 * island's actual `groundY` rather than a guess. While suspended, the
 * outer Canvas just shows the empty scene (sky/lights) — no player yet,
 * no phantom collider.
 */
function TutorialIslandSceneContents({
  playerPosRef,
  onPlayerPositionUpdate,
  onWorldReady,
}: {
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onPlayerPositionUpdate: (pos: THREE.Vector3) => void;
  onWorldReady: () => void;
}) {
  const world = useTutorialWorld();

  // Cuboid land fallback: thin slab at `groundY`, sized by the filtered
  // beach bbox. Only used when trimesh extraction tagged zero meshes
  // (defensive — should never happen with the shipped GLB).
  const COLLIDER_HALF_HEIGHT = 0.5;
  const groundY = world?.groundY ?? 0.5;
  const groundCenter = world?.groundCenter ?? [0, 0];
  const groundHalfExtent = world?.groundHalfExtent ?? [25, 25];
  const groundColliders = world?.groundColliders ?? [];
  const useTrimeshGround = groundColliders.length > 0;
  // Spawn altitude: with the cuboid fallback the surface is uniform at
  // `groundY` and 1m of clearance is plenty. With trimesh ground we
  // raycast straight down through the baked colliders at the spawn xz
  // and place the capsule 1.5 m above whatever surface we hit (the
  // shipwreck deck or the beach beside it). Falling 1.5 m is well
  // under the fall-damage threshold so the player won't die on entry.
  const spawnSurfaceY = world?.spawnSurfaceY ?? groundY;
  const spawnY = useTrimeshGround ? spawnSurfaceY + 1.5 : groundY + 1.0;
  // XZ comes from the world bake (isolated-palm selection). Falls back
  // to (0,0) — wreck centre — when the bake is still in flight or no
  // candidate palm was found.
  const spawnX = world?.spawnXZ?.[0] ?? 0;
  const spawnZ = world?.spawnXZ?.[1] ?? 0;
  const spawnPosition = useMemo<[number, number, number]>(
    () => [spawnX, spawnY, spawnZ],
    [spawnX, spawnY, spawnZ],
  );

  // Seabed collider sits at the swim-band bottom so swimmers don't fall
  // through the world. The shader paints the visible seabed terrain
  // ~1 m above this collider; that 1 m of clearance keeps the player in
  // swim mode even while standing on bottom.
  const SEABED_COLLIDER_Y = SWIM_BAND_BOTTOM_Y;
  const SEABED_HALF_HEIGHT = 0.5;

  // Raycast-backed ground sampler against the visible beach geometry,
  // wired into Player so the slope polish (uphill speed loss, downhill
  // boost, lateral nudge, step-up assist, foot-snap) fires here too —
  // not just on the main game's heightmap. The sampler always returns
  // at least `groundY` so the polish never tries to drag the body
  // BELOW the cuboid fallback floor.
  //
  // We collect every beach mesh in the GLB (no radius filter) so the
  // sampler stays accurate when the player wanders past the original
  // 35 m playable bubble. Three.js's intersectObjects does a cheap
  // bbox cull per mesh first, so even ~140 scattered beach meshes
  // resolve a downward cast in microseconds — only the few directly
  // beneath the cast actually run a triangle test.
  const groundSampler = useMemo(() => {
    if (!world) return null;
    const meshes: THREE.Mesh[] = [];
    const tmpBox = new THREE.Box3();
    world.root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      // Same prefix list as `GROUND_NAME_RE` so the slope-polish
      // sampler tracks every walkable surface — without this the
      // player's per-frame Y polish would dip onto the lower beach
      // when standing on raised inland sand pads or forest-floor
      // leaf splats. Buildings (Fort, Shipwreck) are intentionally
      // excluded here: their multi-storey trimesh would let the
      // raycast slip into a lower deck through floor seams. Beach
      // remains the primary terrain, so this stays cheap.
      const name = mesh.name || "";
      if (
        !/^SM_Env_Beach_/.test(name) &&
        !/^SM_Env_Flat_Sand_/.test(name) &&
        !/^SM_Env_GroundLeaves_/.test(name)
      ) {
        return;
      }
      tmpBox.setFromObject(mesh);
      if (!isFinite(tmpBox.min.x)) return;
      meshes.push(mesh);
    });
    if (meshes.length === 0) return null;
    const raycaster = new THREE.Raycaster();
    raycaster.far = 200;
    const origin = new THREE.Vector3();
    const down = new THREE.Vector3(0, -1, 0);
    return (x: number, z: number): number => {
      // Cast straight down from well above any plausible terrain.
      origin.set(x, groundY + 80, z);
      raycaster.set(origin, down);
      const hits = raycaster.intersectObjects(meshes, false);
      const hitY = hits.length > 0 ? hits[0].point.y : groundY;
      // Clamp the result so the sampler never drops below the physics
      // resting plane: the cuboid collider IS the floor, the visible
      // mesh just contributes additional bumps on top.
      return hitY > groundY ? hitY : groundY;
    };
  }, [world, groundY]);

  useEffect(() => {
    if (!world) return;
    playerPosRef.current.set(spawnPosition[0], spawnY, spawnPosition[2]);
    // Spawn position is now real — tell the DOM overlay it can fade out.
    // Fired in the same render the player + collider mount, so the overlay
    // disappears exactly when the world becomes visible.
    onWorldReady();
  }, [world, spawnPosition, spawnY, playerPosRef, onWorldReady]);

  if (!world) return null;

  return (
    <>
      {useTrimeshGround ? (
        <StreamedGroundColliders
          colliders={groundColliders}
          playerPosRef={playerPosRef}
        />
      ) : (
        <RigidBody
          type="fixed"
          colliders={false}
          position={[
            groundCenter[0],
            groundY - COLLIDER_HALF_HEIGHT,
            groundCenter[1],
          ]}
        >
          <CuboidCollider
            args={[
              groundHalfExtent[0],
              COLLIDER_HALF_HEIGHT,
              groundHalfExtent[1],
            ]}
          />
        </RigidBody>
      )}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[0, SEABED_COLLIDER_Y - SEABED_HALF_HEIGHT, 0]}
      >
        <CuboidCollider args={[400, SEABED_HALF_HEIGHT, 400]} />
      </RigidBody>

      {/* Player rig + camera are dynamic and must be skipped by the
          lightmap baker — the player is skinned (the lib handles that
          automatically) but `LightmapIgnore` also keeps the player out
          of the per-mesh atlas walk so a stale spawn pose never gets
          captured as occlusion against the world. Camera carries no
          meshes but ignoring it costs nothing and matches intent. */}
      <LightmapIgnore>
        <Player
          onPositionUpdate={onPlayerPositionUpdate}
          spawnPosition={spawnPosition}
          useTerrainHeightmap={false}
          groundSampler={groundSampler}
        />
        <PlayerBubbleTrail playerPosRef={playerPosRef} />
        <Camera playerPosition={playerPosRef.current} />
        {/* Authoritative MMO bridge: subscribes the Zustand mirror, joins
            the zone, and broadcasts the local player's pos/rot/anim to
            the Railway /world server at 10 Hz. RemotePlayers renders
            every other player in the zone next to <Player>. */}
        <WorldNetBridge zone="tutorial" rate={10} spawn={spawnPosition} />
        <RemotePlayers />
      </LightmapIgnore>

      {/* Shore foam ring around the island. Uses the world bake's
          groundCenter/groundHalfExtent so the band hugs the actual
          land rectangle baked from the GLB. */}
      {/* Animated shore foam shader — animated UVs and a custom
          ShaderMaterial. The baker skips ShaderMaterial meshes anyway
          but ignoring it explicitly keeps it out of the occluder walk
          so its full-disc bbox doesn't shadow the beach below. */}
      <LightmapIgnore>
        <ShoreFoam
          center={groundCenter}
          halfExtent={groundHalfExtent}
          surfaceY={WATER_SURFACE_Y}
          intensity={0.85}
          bandWidthMeters={3.5}
        />
      </LightmapIgnore>

      {/* The static island GLB. THIS is the primary bake target — its
          beach, palms, fort, shipwreck, and rocks all use Standard
          materials with valid uv channels and don't move at runtime. */}
      <TutorialWorld world={world} playerPosition={playerPosRef.current} />

      {/* Everything else animates per-frame, spawns at runtime, or uses
          skinned meshes — none can contribute correctly to a one-shot
          bake, all should be excluded so the bake walker doesn't waste
          atlas space on them. */}
      <LightmapIgnore>
        <TutorialIslandAnimals spawnXZ={world.spawnXZ} />
        <TutorialIslandEnemies playerPosition={playerPosRef.current} />
        <TutorialIslandWaves playerPosition={playerPosRef.current} />
        <BreakApartChunks />
        <LootDropsRenderer playerPosition={playerPosRef.current} />
      </LightmapIgnore>
    </>
  );
}

/**
 * DOM overlay shown while the 84 MB tutorial GLB is downloading and
 * decoding. Subscribes to AssetLoader's per-asset byte progress so the
 * bar reflects real network progress; switches to an indeterminate
 * "Preparing the world…" state once the bytes are in but the scene is
 * still mounting (geometry decode, mesh traversal, etc.).
 *
 * Fades out — instead of unmounting immediately — when `ready` flips,
 * so the player doesn't see a hard cut between overlay and world.
 */
function TutorialLoadingOverlay({ ready }: { ready: boolean }) {
  const [progress, setProgress] = useState<{ loaded: number; total: number }>({
    loaded: 0,
    total: 0,
  });
  // Skip the overlay entirely on re-entries where the world is already
  // cached and `ready` was initialized true — no flash, no fade, nothing.
  const [removed, setRemoved] = useState(ready);

  useEffect(() => {
    return subscribeAssetProgress(TUTORIAL_GLB_PATH, (p) => setProgress(p));
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Match the CSS opacity transition below so the node leaves the DOM
    // *after* the fade completes — no abrupt pop-out.
    const t = setTimeout(() => setRemoved(true), 600);
    return () => clearTimeout(t);
  }, [ready]);

  if (removed) return null;

  const { loaded, total } = progress;
  const pct = total > 0 ? Math.min(100, (loaded / total) * 100) : 0;
  const downloadedMB = loaded > 0 ? (loaded / (1024 * 1024)).toFixed(1) : "0.0";
  const totalMB = total > 0 ? (total / (1024 * 1024)).toFixed(0) : null;
  // Bytes are in but the React tree hasn't mounted the player yet — show
  // an indeterminate "preparing" message rather than a stale 99 %.
  const decoding = total > 0 && loaded >= total && !ready;

  const GOLD = "#c9950a";
  const GOLD_DIM = "rgba(201,149,10,0.5)";
  const GOLD_GLOW = "rgba(201,149,10,0.3)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background:
          "linear-gradient(180deg, rgba(8,12,20,0.92) 0%, rgba(6,18,28,0.92) 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#f0d68a",
        fontFamily: "'Cinzel', serif",
        opacity: ready ? 0 : 1,
        transition: "opacity 0.55s ease-out",
        pointerEvents: ready ? "none" : "auto",
      }}
    >
      <div
        style={{
          fontSize: 28,
          letterSpacing: 4,
          textTransform: "uppercase",
          textShadow: `0 0 24px ${GOLD_GLOW}, 0 2px 6px rgba(0,0,0,0.7)`,
          marginBottom: 14,
        }}
      >
        Loading the Island
      </div>

      <div
        style={{
          fontSize: 13,
          color: "#bcdde8",
          fontFamily: "'Crimson Text', serif",
          marginBottom: 26,
          maxWidth: 360,
          textAlign: "center",
          lineHeight: 1.5,
          opacity: 0.85,
        }}
      >
        {decoding
          ? "Preparing the world\u2026"
          : "Streaming the shipwreck and shoreline\u2026"}
      </div>

      <div
        style={{
          width: 320,
          height: 6,
          background: "rgba(201,149,10,0.12)",
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid rgba(201,149,10,0.18)",
        }}
      >
        {decoding ? (
          // Indeterminate sweep while the mesh tree is being built.
          <div
            style={{
              height: "100%",
              width: "40%",
              background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
              animation: "tutorialLoadSweep 1.2s ease-in-out infinite",
              boxShadow: `0 0 10px ${GOLD_GLOW}`,
            }}
          />
        ) : (
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${GOLD}, #e8c868)`,
              borderRadius: 3,
              transition: "width 0.25s ease-out",
              boxShadow: `0 0 10px ${GOLD_GLOW}`,
            }}
          />
        )}
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: GOLD_DIM,
          fontVariantNumeric: "tabular-nums",
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 1,
        }}
      >
        {decoding
          ? "\u2014"
          : totalMB
          ? `${downloadedMB} / ${totalMB} MB \u00b7 ${Math.floor(pct)}%`
          : `${downloadedMB} MB`}
      </div>

      <style>{`
        @keyframes tutorialLoadSweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}

export default function TutorialIslandScene() {
  const exitTutorialIsland = useGame((s) => s.exitTutorialIsland);
  const restart = useGame((s) => s.restart);
  // Camera-follow ref. Seeded above the water so that, on the very first
  // render before `TutorialIslandSceneContents` mounts, the camera isn't
  // staring underwater. The ref is updated to the real spawn position as
  // soon as the GLB resolves.
  const playerPosRef = useRef(new THREE.Vector3(0, 1, 0));
  // Skip the loading flash on re-entries: if the GLB is already in
  // AssetLoader's cache, useAsset resolves on first render and the
  // chunked trimesh bake completes in a few frames, so the overlay
  // would only briefly flash and fade for no reason. Initialize
  // ready=true in that case so the overlay never even paints.
  const [worldReady, setWorldReady] = useState(() =>
    isAssetCached(TUTORIAL_GLB_PATH),
  );

  const handlePlayerPositionUpdate = useCallback((pos: THREE.Vector3) => {
    playerPosRef.current.copy(pos);
  }, []);

  const handleWorldReady = useCallback(() => {
    setWorldReady(true);
  }, []);

  const handleLeave = useCallback(() => {
    exitTutorialIsland();
    restart();
  }, [exitTutorialIsland, restart]);

  // Whatever camera state was carried over from a previous scene/session
  // (e.g. the player toggled Overhead with V, or zoomed all the way out
  // to 35m), snap back to the MMO defaults on first mount of this scene
  // so the tutorial island opens in the intended over-the-shoulder
  // framing — not a top-down 60m bird's-eye that makes the island read
  // as a tiny pebble. The pending-flag inside `resetCamera` covers the
  // ordering case where Camera (inside the Canvas tree) hasn't mounted
  // yet at this point; on unmount we discard any still-unconsumed reset
  // so a rapid mount/unmount can't leak it into the next scene.
  useEffect(() => {
    resetCamera();
    return () => clearPendingCameraReset();
  }, []);

  return (
    <KeyboardControls map={controls}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [10, 12, 10], fov: 50, near: 0.1, far: 150000 }}
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
          c.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            console.warn("[TutorialIsland] WebGL context lost — will restore");
          });
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <AssetLoaderInit />
        <Suspense fallback={null}>
          <Physics gravity={[0, -20, 0]} timeStep={1 / 60} interpolate={true}>
            {/* Lightmap baker. No-op unless launched with `?bakeLightmap=1`
                in the URL; when active it walks the subtree once at mount,
                bakes irradiance + AO into a 1024² atlas, and replaces each
                static mesh's lightMap slot with the result. Sky/Fog/VFX
                and the animated water sheets are wrapped in
                <LightmapIgnore> below or inside their respective scene so
                only the island GLB itself contributes to the bake. */}
            <BakedSceneWrapper>
              <LightmapIgnore>
                <Sky sunPosition={[100, 50, 100]} />
              </LightmapIgnore>
              <ambientLight intensity={0.55} color="#fff5e0" />
              <directionalLight
                position={[40, 60, 30]}
                intensity={1.4}
                color="#ffeedd"
                castShadow
              />
              <fog attach="fog" args={["#bcdde8", 120, 600]} />
              <LightmapIgnore>
                <VFXSystem />
              </LightmapIgnore>

              <TutorialIslandSceneContents
                playerPosRef={playerPosRef}
                onPlayerPositionUpdate={handlePlayerPositionUpdate}
                onWorldReady={handleWorldReady}
              />

            {/* Distant horizon dressing comes from the GLB itself
                (the `Background_Islands` meshes baked into the
                tutorial scene by the artist). We deliberately do NOT
                render the procedural cone-blob placeholders here —
                they were ~10–20× the size of the playable shipwreck
                island and made it read as a tiny sandbar instead of
                a real place. The minimap / world-map UIs still draw
                pins for the other islands from `IslandLayout`. */}

            {/* Surface sheet on top; underwater volume bracketed below.
                The shader inside `UnderwaterVolume` paints its own
                raymarched seabed terrain, so there's no separate sand
                plane between them. */}
              <LightmapIgnore>
                <WaterSheets surfaceY={WATER_SURFACE_Y} extent={600} />
                {/* Shore foam ring sits INSIDE TutorialIslandSceneContents
                    because it depends on the world bake's groundCenter /
                    groundHalfExtent — see the <ShoreFoam /> render there. */}
                <UnderwaterVolume
                  topY={WATER_SURFACE_Y}
                  bottomY={SEABED_VISUAL_Y}
                  size={600}
                />

                {/* Render any structures the player has built. The building
                    store is shared across scenes, so foundations placed here
                    show up in the main world too. Player-placed → must be
                    excluded from a static bake. */}
                <PlacedBuildings />

                {/* Cheat: terrain/raycast debug probe. No-op until the
                    `debugTerrain` cheat is on (F8 panel). Writes per-frame
                    results to a module-level struct read by the HUD div. */}
                <TerrainDebugProbe />
              </LightmapIgnore>
            </BakedSceneWrapper>
          </Physics>
        </Suspense>
      </Canvas>
      <HUD />
      <LocationDiscovery />
      {/* Build mode (B key). Mirrors GameScene — without these, the
          tutorial island had no way to enter build mode at all. */}
      <BuildMenu />
      <BuildModeHandler />
      <ModeControllerUpdater />
      <TutorialLoadingOverlay ready={worldReady} />
      {/* Leave-Island button. Top-CENTER to clear the minimap +
          resource chip column on the right and the player avatar +
          stat-bar block on the left. */}
      <div
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 150,
          pointerEvents: "auto",
        }}
      >
        <button
          onClick={handleLeave}
          style={{
            background: "linear-gradient(180deg, rgba(20,10,5,0.9), rgba(0,0,0,0.85))",
            border: "2px solid #aa7733",
            borderRadius: 8,
            padding: "8px 18px",
            color: "#ffcc66",
            fontFamily: "serif",
            fontSize: 14,
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
          }}
        >
          ← Leave Island
        </button>
      </div>
    </KeyboardControls>
  );
}
