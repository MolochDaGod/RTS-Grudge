import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CylinderCollider,
  RigidBody,
  TrimeshCollider,
} from "@react-three/rapier";
import * as THREE from "three";
import { useHarvest } from "@/lib/stores/useHarvest";
import { useInventory } from "@/lib/stores/useInventory";
import { useCampaign } from "@/lib/stores/useCampaign";
import { useGame, type WeaponType } from "@/lib/stores/useGame";
import { spawnBreakApart } from "../effects/BreakApartChunks";
import { COLLISION_MASKS } from "../components/BuildingColliders";

/**
 * World-object harvesting for Tutorial Island.
 *
 * Two interaction paths share this component, by harvestable type:
 *
 *   • Trees  → require an axe / poleaxe equipped. LMB performs a
 *     swing-driven attack; if a tree is in front within reach, the
 *     swing registers a hit. Trees take TREE_HP hits before the
 *     trunk physically falls (rotated around its base) and bursts
 *     into chunks. Each hit drops a small partial yield; the fall
 *     drops the bonus yield.
 *
 *   • Rocks  → require a hammer / heavy weapon (greatsword) equipped.
 *     Same swing flow as trees, but on the final hit the rock just
 *     vanishes in a chunk burst (no fall animation). Each hit
 *     knocks off a small chunk and gives 1–2 stone.
 *
 *   • Flowers → no tool required, pressing F while standing within
 *     range pops the closest one into the inventory instantly.
 *
 * Industry-standard physical wrappers:
 *   • Each tree gets a fixed `<RigidBody>` with a `<CylinderCollider>`
 *     sized from its bbox so the player physically collides with the
 *     trunk. Cylinder is the canonical primitive for tree trunks —
 *     much cheaper than trimesh and visually accurate enough.
 *   • Each rock keeps the existing trimesh collider baked in
 *     `useTutorialWorld`.
 *   • Flowers stay non-physical; you walk through them by design.
 */

type HarvestType = "wood" | "stone" | "flower";

interface HarvestableNode {
  object: THREE.Object3D;
  worldPos: [number, number, number];
  type: HarvestType;
  /** Hits remaining before the node fully breaks. Flowers = 1. */
  hp: number;
  maxHp: number;
  harvested: boolean;
  /** True while a tree is mid-fall animation (still visible, no longer hittable). */
  felling: boolean;
  /** ms timestamp when fall animation started. */
  fellStart: number;
  /** Unit XZ axis the tree is tipping around (perpendicular to swing dir). */
  fellAxisX: number;
  fellAxisZ: number;
  /** Cached original local quaternion so we can compose fall over the top. */
  origQuat?: THREE.Quaternion;
  /** Cached original local position — the tree's transform anchor in parent space. */
  origLocalPos?: THREE.Vector3;
  /**
   * Pivot point (in the tree's parent-local space) the trunk rotates
   * around during the fall — sits at the bottom-centre of the tree's
   * world bbox so the stump stays planted even when the GLB's origin
   * is at the canopy or the geometric centre of the mesh, not the
   * base. Computed once at fall start (we don't know runtime parent
   * transforms until then).
   */
  fellPivotLocal?: THREE.Vector3;
  /** Stable identity for keying React-rendered colliders. */
  treeKey?: string;
  rockKey?: string;
  /** Trunk dims for the per-tree CylinderCollider (only set for trees). */
  trunkRadius?: number;
  trunkHeight?: number;
  /** Vertical offset from worldPos.y to the cylinder's center. */
  trunkCenterY?: number;
}

export interface RockColliderData {
  object: THREE.Object3D;
  vertices: Float32Array;
  indices: Uint32Array;
}

interface Props {
  trees: THREE.Object3D[];
  rocks: THREE.Object3D[];
  flowers: THREE.Object3D[];
  rockColliders: RockColliderData[];
  worldScale: number;
  worldOffset: [number, number, number];
  playerPosition: THREE.Vector3;
}

// ── Tuning ───────────────────────────────────────────────────────
const TREE_HP = 3;
const ROCK_HP = 3;

const TREE_REACH = 4.0; // metres (axe arc)
const ROCK_REACH = 3.5; // metres (hammer arc)
const FLOWER_REACH = 2.5; // metres (proximity F-key pickup)

/** cos(half-angle) of the swing cone. 0.34 ≈ 70° half-angle (140° cone). */
const SWING_CONE_DOT = 0.34;
/** Min ms between two registered swings. Matches roughly the attack anim cadence. */
const SWING_THROTTLE_MS = 500;
/** ms after click when the chunk burst + damage actually applies (= swing impact frame). */
const HIT_DELAY_MS = 230;

const FELL_DURATION_MS = 1100;

/** Weapon → harvest target mapping. Empty = no tool needed (flowers). */
const TOOLS_FOR_TYPE: Record<HarvestType, WeaponType[]> = {
  wood: ["axe", "poleaxe"],
  // "heavyweapon.glb" in the user's request maps onto the in-game
  // hammer/greatsword weapon types in our combat machine.
  stone: ["hammer", "greatsword"],
  flower: [],
};

const PER_HIT_YIELD: Record<"wood" | "stone", { min: number; max: number }> = {
  wood: { min: 1, max: 2 },
  stone: { min: 1, max: 2 },
};
const FINAL_BONUS_YIELD: Record<"wood" | "stone", { min: number; max: number }> = {
  wood: { min: 2, max: 3 },
  stone: { min: 1, max: 2 },
};

const CHUNK_COLOR: Record<HarvestType, string> = {
  wood: "#5a3a1a",
  stone: "#888888",
  flower: "#d062c7",
};

const ITEM_ICON: Record<HarvestType, string> = {
  wood: "🪵",
  stone: "🪨",
  flower: "🌸",
};

const ITEM_LABEL: Record<HarvestType, string> = {
  wood: "Wood",
  stone: "Stone",
  flower: "Flower",
};

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Measure trunk dims for the per-tree collider.
 *
 * Naive `box.setFromObject(obj)` over-reports XZ because it includes
 * the foliage canopy — a 4 m wide palm canopy would yield a 0.55 m
 * trunk collider, an "invisible wall" 2-3× bigger than the visible
 * trunk. To fix that we measure ONLY vertices in the bottom 30 % of
 * the tree's height, which is reliably trunk-only across our GLBs
 * (palm, pine, oak). We pick the tightest XZ AABB of that slice and
 * use HALF the smaller side (a real trunk-radius) clamped tightly.
 *
 * Falls back to the canopy-aware naive estimate if the tree has no
 * BufferGeometry children we can read.
 */
function measureTrunk(
  obj: THREE.Object3D,
  worldScale: number,
): { radius: number; height: number; centerYOffset: number } {
  const fullBox = _scratchBox.setFromObject(obj);
  const fullSize = _scratchTrunkSize;
  fullBox.getSize(fullSize);
  const totalH = fullSize.y * worldScale;
  const height = Math.max(1.5, totalH * 0.95);
  const centerYOffset = height * 0.5;

  // Slice: keep only vertices with worldY ≤ bottom + 30% of bbox height.
  const sliceTop = fullBox.min.y + (fullBox.max.y - fullBox.min.y) * 0.30;
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  let saw = 0;
  const tmpV = _scratchTrunkVert;
  obj.updateWorldMatrix(true, true);
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const posAttr = mesh.geometry.getAttribute("position") as
      | THREE.BufferAttribute
      | undefined;
    if (!posAttr) return;
    mesh.updateWorldMatrix(true, false);
    const m = mesh.matrixWorld;
    const count = posAttr.count;
    // Sample stride: huge meshes with 30k verts don't need every one.
    const stride = count > 4000 ? Math.ceil(count / 4000) : 1;
    for (let i = 0; i < count; i += stride) {
      tmpV.fromBufferAttribute(posAttr, i).applyMatrix4(m);
      if (tmpV.y > sliceTop) continue;
      saw++;
      if (tmpV.x < minX) minX = tmpV.x;
      if (tmpV.x > maxX) maxX = tmpV.x;
      if (tmpV.z < minZ) minZ = tmpV.z;
      if (tmpV.z > maxZ) maxZ = tmpV.z;
    }
  });

  let radius: number;
  if (saw > 4 && isFinite(minX)) {
    // Half the smaller side of the trunk-slice AABB, in world units.
    const xSpan = (maxX - minX) * worldScale;
    const zSpan = (maxZ - minZ) * worldScale;
    radius = Math.min(xSpan, zSpan) * 0.5;
    // Bump slightly so the visible trunk isn't pierced by the capsule;
    // clamp tight so canopies / leaning palms don't bloat it.
    radius = Math.min(0.40, Math.max(0.15, radius * 1.05));
  } else {
    // No geometry walked — fall back to a conservative naive estimate.
    const minXZ = Math.min(fullSize.x, fullSize.z) * worldScale;
    radius = Math.min(0.40, Math.max(0.15, minXZ * 0.12));
  }
  return { radius, height, centerYOffset };
}

export default function TutorialIslandHarvestables({
  trees,
  rocks,
  flowers,
  rockColliders,
  worldScale,
  worldOffset,
  playerPosition,
}: Props) {
  const camera = useThree((s) => s.camera);

  // ── Stable identity maps ───────────────────────────────────────
  const rockKeyByObject = useMemo(() => {
    const map = new WeakMap<THREE.Object3D, string>();
    rocks.forEach((rock, i) => {
      map.set(rock, rock.uuid || `rock-${i}`);
    });
    return map;
  }, [rocks]);

  const treeKeyByObject = useMemo(() => {
    const map = new WeakMap<THREE.Object3D, string>();
    trees.forEach((t, i) => {
      map.set(t, t.uuid || `tree-${i}`);
    });
    return map;
  }, [trees]);

  // ── Build node table (trees + rocks + flowers, world-space) ────
  const nodes = useMemo(() => {
    const out: HarvestableNode[] = [];
    const tmp = new THREE.Vector3();
    const ox = worldOffset[0];
    const oy = worldOffset[1];
    const oz = worldOffset[2];

    const collect = (
      objs: THREE.Object3D[],
      type: HarvestType,
      maxHp: number,
    ) => {
      for (const obj of objs) {
        obj.getWorldPosition(tmp);
        const wx = tmp.x * worldScale + ox;
        const wy = tmp.y * worldScale + oy;
        const wz = tmp.z * worldScale + oz;

        const node: HarvestableNode = {
          object: obj,
          worldPos: [wx, wy, wz],
          type,
          hp: maxHp,
          maxHp,
          harvested: false,
          felling: false,
          fellStart: 0,
          fellAxisX: 1,
          fellAxisZ: 0,
        };

        if (type === "wood") {
          node.treeKey = treeKeyByObject.get(obj);
          const t = measureTrunk(obj, worldScale);
          node.trunkRadius = t.radius;
          node.trunkHeight = t.height;
          node.trunkCenterY = t.centerYOffset;
        } else if (type === "stone") {
          node.rockKey = rockKeyByObject.get(obj);
        }
        out.push(node);
      }
    };

    collect(trees, "wood", TREE_HP);
    collect(rocks, "stone", ROCK_HP);
    collect(flowers, "flower", 1);

    console.log(
      `[TutorialIsland] Registered ${out.length} harvestables ` +
        `(${trees.length} trees → wood, ${rocks.length} rocks → stone, ` +
        `${flowers.length} flowers, ${rockColliders.length} rock colliders)`,
    );
    return out;
  }, [
    trees,
    rocks,
    flowers,
    rockColliders,
    worldScale,
    worldOffset,
    rockKeyByObject,
    treeKeyByObject,
  ]);

  // Reset removal sets whenever the underlying object lists change
  // (scene re-mount, GLB hot reload).
  const [harvestedRockKeys, setHarvestedRockKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [removedTreeKeys, setRemovedTreeKeys] = useState<Set<string>>(
    () => new Set(),
  );
  useEffect(() => {
    setHarvestedRockKeys(new Set());
  }, [rocks]);
  useEffect(() => {
    setRemovedTreeKeys(new Set());
  }, [trees]);

  const markRockHarvested = useCallback((key: string) => {
    setHarvestedRockKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const markTreeRemoved = useCallback((key: string) => {
    setRemovedTreeKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  // ── Hit application ────────────────────────────────────────────
  /**
   * Apply one swing-hit's worth of damage to a node. Spawns a small
   * chunk burst, gives partial resource yield, and triggers the
   * full-break flow once HP hits zero (tree → fall animation,
   * rock → instant destroy).
   */
  const registerHit = useCallback(
    (
      node: HarvestableNode,
      swingDirX: number,
      swingDirZ: number,
    ) => {
      if (node.harvested || node.felling || node.type === "flower") return;
      const t = node.type as "wood" | "stone";
      node.hp -= 1;

      // Where chunks fly from. Trees get the burst at chest height
      // up the trunk so it reads as "axe biting wood"; rocks get it
      // just above the rock surface.
      const hitOffsetY = t === "wood" ? 1.4 : 0.5;
      const hitPos: [number, number, number] = [
        node.worldPos[0],
        node.worldPos[1] + hitOffsetY,
        node.worldPos[2],
      ];
      spawnBreakApart(hitPos, CHUNK_COLOR[t], 5, 0.7);

      // Per-hit partial yield
      const py = PER_HIT_YIELD[t];
      const qty = py.min + Math.floor(Math.random() * (py.max - py.min + 1));
      useInventory.getState().addItem({
        id: t,
        name: ITEM_LABEL[t],
        type: "material",
        icon: ITEM_ICON[t],
        quantity: qty,
      });
      useCampaign.getState().recordGather(qty);

      if (node.hp > 0) return;

      // Final blow.
      if (t === "stone") {
        // Instant destroy: hide mesh, drop physics body, big burst,
        // bonus yield.
        node.harvested = true;
        node.object.visible = false;
        if (node.rockKey) markRockHarvested(node.rockKey);
        spawnBreakApart(node.worldPos, CHUNK_COLOR.stone, 12, 1.4);
        const fy = FINAL_BONUS_YIELD.stone;
        const fqty =
          fy.min + Math.floor(Math.random() * (fy.max - fy.min + 1));
        useInventory.getState().addItem({
          id: "stone",
          name: "Stone",
          type: "material",
          icon: "🪨",
          quantity: fqty,
        });
        useCampaign.getState().recordGather(fqty);
        return;
      }

      // Wood: kick off the fall animation. The tree stays visible
      // and rotates around its STUMP (bbox bottom-centre, not the
      // GLB origin) over FELL_DURATION_MS, then is hidden + chunked
      // when the fall completes (handled in useFrame below). Drop
      // the trunk's collider immediately so the player can walk
      // through the falling tree.
      node.felling = true;
      node.fellStart = performance.now();
      // Tip the tree IN the direction of the swing — perpendicular
      // axis is what we rotate AROUND.
      const len = Math.hypot(swingDirX, swingDirZ) || 1;
      node.fellAxisX = -swingDirZ / len;
      node.fellAxisZ = swingDirX / len;
      if (!node.origQuat) node.origQuat = node.object.quaternion.clone();
      if (!node.origLocalPos) node.origLocalPos = node.object.position.clone();
      // Compute the pivot (stump base) in parent-local space NOW,
      // so the fall hinges on the bottom of the visible trunk
      // regardless of where the GLB authored its origin point.
      // setFromObject walks the tree's child meshes once; cheap.
      const box = _scratchBox.setFromObject(node.object);
      const pivotWorld = _scratchPivot.set(
        node.worldPos[0],
        box.min.y,
        node.worldPos[2],
      );
      const parent = node.object.parent;
      const pivotLocal = parent
        ? parent.worldToLocal(pivotWorld.clone())
        : pivotWorld.clone();
      node.fellPivotLocal = pivotLocal;
      if (node.treeKey) markTreeRemoved(node.treeKey);
    },
    [markRockHarvested, markTreeRemoved],
  );

  // ── F-key flower pickup ────────────────────────────────────────
  const flowerTriggerRef = useRef(false);
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "KeyF") flowerTriggerRef.current = true;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "KeyF") flowerTriggerRef.current = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // ── LMB swing → axe-on-tree / hammer-on-rock ───────────────────
  const lastSwingRef = useRef(0);
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // LMB only
      // Only react to swings that hit the game canvas — not clicks
      // on HUD buttons, inventory panels, hotbar slots, etc. R3F
      // renders the world into a <canvas>, every other UI overlay
      // is a regular HTML element above it, so a tagName check is
      // a sufficient and zero-allocation gate.
      const target = e.target as HTMLElement | null;
      if (!target || target.tagName !== "CANVAS") return;
      const now = performance.now();
      if (now - lastSwingRef.current < SWING_THROTTLE_MS) return;

      const weapon = useGame.getState().selectedCharacter.weaponRight;
      let targetType: HarvestType | null = null;
      if (TOOLS_FOR_TYPE.wood.includes(weapon)) targetType = "wood";
      else if (TOOLS_FOR_TYPE.stone.includes(weapon)) targetType = "stone";
      if (!targetType) return;

      // Player facing in world XZ = direction from camera to player,
      // normalised. Robust regardless of camera mode (mmo/action/
      // overhead) since the camera is always behind the player.
      const dx = playerPosition.x - camera.position.x;
      const dz = playerPosition.z - camera.position.z;
      const flen = Math.hypot(dx, dz);
      if (flen < 0.001) return;
      const fx = dx / flen;
      const fz = dz / flen;

      const reach = targetType === "wood" ? TREE_REACH : ROCK_REACH;

      // Score the cone: prefer "more in front" + "closer".
      let best: HarvestableNode | null = null;
      let bestScore = -Infinity;
      for (const n of nodes) {
        if (n.harvested || n.felling || n.type !== targetType) continue;
        const tdx = n.worldPos[0] - playerPosition.x;
        const tdz = n.worldPos[2] - playerPosition.z;
        const td = Math.hypot(tdx, tdz);
        if (td > reach) continue;
        const dot = (tdx * fx + tdz * fz) / Math.max(td, 0.0001);
        if (dot < SWING_CONE_DOT) continue;
        const score = dot * 2 - td * 0.15;
        if (score > bestScore) {
          bestScore = score;
          best = n;
        }
      }
      if (!best) return;

      lastSwingRef.current = now;
      const targetNode = best;
      // Apply the hit ~230ms in so it lines up with the visible
      // weapon swing impact frame, not the wind-up.
      window.setTimeout(() => registerHit(targetNode, fx, fz), HIT_DELAY_MS);
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [nodes, playerPosition, camera, registerHit]);

  // ── Per-frame: flower F-key + tree fall animation ──────────────
  useFrame(() => {
    // Flower pickup
    if (flowerTriggerRef.current) {
      flowerTriggerRef.current = false;
      const { isHarvesting, startHarvest } = useHarvest.getState();
      if (!isHarvesting) {
        let closest: HarvestableNode | null = null;
        let closestD2 = FLOWER_REACH * FLOWER_REACH;
        for (const n of nodes) {
          if (n.harvested || n.type !== "flower") continue;
          const dx = n.worldPos[0] - playerPosition.x;
          const dz = n.worldPos[2] - playerPosition.z;
          const d2 = dx * dx + dz * dz;
          if (d2 < closestD2) {
            closestD2 = d2;
            closest = n;
          }
        }
        if (closest) {
          const node = closest;
          // Quick "pick_up_item" gather animation, short duration.
          startHarvest("attack", 0.4, () => {
            if (node.harvested) return;
            node.harvested = true;
            node.object.visible = false;
            spawnBreakApart(node.worldPos, CHUNK_COLOR.flower, 4, 0.4);
            useInventory.getState().addItem({
              id: "flower",
              name: ITEM_LABEL.flower,
              type: "material",
              icon: ITEM_ICON.flower,
              quantity: 1,
            });
            useCampaign.getState().recordGather(1);
          });
        }
      }
    }

    // Tree fall animation
    const now = performance.now();
    const _q = _scratchQuat;
    const _axis = _scratchAxis;
    for (const n of nodes) {
      if (!n.felling || n.harvested) continue;
      const t = (now - n.fellStart) / FELL_DURATION_MS;
      if (t >= 1) {
        // Fall complete — hide mesh, spawn big chunk burst, bonus
        // wood yield. Trunk collider was already removed when the
        // fall started.
        n.object.visible = false;
        n.harvested = true;
        n.felling = false;
        spawnBreakApart(n.worldPos, CHUNK_COLOR.wood, 14, 1.5);
        const fy = FINAL_BONUS_YIELD.wood;
        const fqty =
          fy.min + Math.floor(Math.random() * (fy.max - fy.min + 1));
        useInventory.getState().addItem({
          id: "wood",
          name: "Wood",
          type: "material",
          icon: "🪵",
          quantity: fqty,
        });
        useCampaign.getState().recordGather(fqty);
        continue;
      }
      // Ease the rotation: slow start, fast finish (gravity-ish).
      const eased = t * t;
      const angle = eased * (Math.PI / 2);
      _axis.set(n.fellAxisX, 0, n.fellAxisZ);
      _q.setFromAxisAngle(_axis, angle);
      // Rotate around the stump pivot so the trunk base stays
      // planted: rotate the tree's local-position vector relative
      // to the pivot, then re-anchor the tree to (pivot + rotated
      // offset). This makes the felling animation pivot-correct
      // even for GLBs whose origin sits at the canopy or center.
      if (n.origQuat && n.origLocalPos && n.fellPivotLocal) {
        n.object.quaternion.copy(n.origQuat).premultiply(_q);
        _offset.copy(n.origLocalPos).sub(n.fellPivotLocal).applyQuaternion(_q);
        n.object.position.copy(n.fellPivotLocal).add(_offset);
      } else if (n.origQuat) {
        // Fallback (parent transform missing) — preserve old
        // behaviour rather than crashing.
        n.object.quaternion.copy(n.origQuat).premultiply(_q);
      } else {
        n.object.setRotationFromQuaternion(_q);
      }
    }
  });

  // ── Per-tree trunk colliders + per-rock trimesh colliders ──────
  return (
    <>
      {nodes
        .filter(
          (n) =>
            n.type === "wood" &&
            n.treeKey != null &&
            !removedTreeKeys.has(n.treeKey),
        )
        .map((n) => (
          <RigidBody
            key={`tree-${n.treeKey}`}
            type="fixed"
            colliders={false}
            position={[
              n.worldPos[0],
              n.worldPos[1] + (n.trunkCenterY ?? 1),
              n.worldPos[2],
            ]}
            // RESOURCE group: trunks block ONLY the player capsule.
            // Enemies, NPCs, projectiles, and other harvestables pass
            // through — that's why pathing AI doesn't snag on a forest
            // and why arrows fly between trees.
            collisionGroups={COLLISION_MASKS.RESOURCE}
          >
            <CylinderCollider
              args={[(n.trunkHeight ?? 4) * 0.5, n.trunkRadius ?? 0.3]}
              // Low friction so the player slides off rather than
              // sticking when their capsule grazes the cylinder.
              friction={0.2}
              restitution={0}
            />
          </RigidBody>
        ))}
      {rockColliders.map((rc) => {
        const key = rockKeyByObject.get(rc.object) ?? rc.object.uuid;
        if (harvestedRockKeys.has(key)) return null;
        return (
          <RigidBody
            key={`rock-${key}`}
            type="fixed"
            colliders={false}
            // RESOURCE group: same rationale as trees. Without this
            // the rock trimesh defaults to "collides with everything",
            // which made enemies snag on rocks and projectiles stop
            // dead at the first boulder triangle.
            collisionGroups={COLLISION_MASKS.RESOURCE}
          >
            <TrimeshCollider
              args={[rc.vertices, rc.indices]}
              // Trimesh capsules-vs-triangles snag without low friction;
              // rocks should slide the player off, not catch them.
              friction={0.3}
              restitution={0}
            />
          </RigidBody>
        );
      })}
    </>
  );
}

// Module-level scratch objects for the per-frame fall animation +
// the once-per-tree fall-start bbox computation. Keeps useFrame
// allocation-free at hundreds of trees.
const _scratchQuat = new THREE.Quaternion();
const _scratchAxis = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _scratchBox = new THREE.Box3();
const _scratchPivot = new THREE.Vector3();
// Used by `measureTrunk` to walk vertices in the bottom-30% trunk
// slice without per-call allocation.
const _scratchTrunkSize = new THREE.Vector3();
const _scratchTrunkVert = new THREE.Vector3();
