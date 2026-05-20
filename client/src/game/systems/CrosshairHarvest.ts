import * as THREE from "three";
import { create } from "zustand";
import { globalResourceRegistry, type ResourceInstance } from "../components/ResourceNode";

// ---------------------------------------------------------------------------
// Crosshair Harvest — Conan Exiles-style aimed mining.
//
// Instead of proximity-only "press F near a node", the player aims the
// centre-screen crosshair at a resource node and clicks LMB. A raycast
// from the camera determines which node is targeted and where the tool
// hits. Hitting the node's weak-spot zone (small sphere near its centre)
// grants a 1.5× yield bonus, shown as a brief UI flash.
//
// Integration:
//   - Player.tsx calls `updateCrosshairTarget()` every frame in harvest mode
//   - On LMB click, Player.tsx calls `getCrosshairTarget()` and passes the
//     result to `globalHarvestTriggerRef` / startHarvest
//   - HUD.tsx reads `useCrosshairHarvest` for reticle colour + weak-spot indicator
// ---------------------------------------------------------------------------

const MAX_HARVEST_RANGE = 5.0;     // metres — max raycast distance for harvest
const WEAK_SPOT_RADIUS  = 0.35;    // metres — sphere around node centre
const WEAK_SPOT_MULT    = 1.5;     // yield multiplier for hitting the sweet spot

// Reusable THREE objects (avoid GC pressure in hot path)
const _raycaster   = new THREE.Raycaster();
const _screenCenter = new THREE.Vector2(0, 0); // NDC centre
const _hitPoint    = new THREE.Vector3();
const _nodeCenter  = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Store — consumed by HUD for reticle state
// ---------------------------------------------------------------------------
export interface CrosshairTarget {
  /** Index into globalResourceRegistry.nodes */
  nodeIndex: number;
  /** The resource instance */
  node: ResourceInstance;
  /** World-space hit point on the node mesh */
  hitPoint: THREE.Vector3;
  /** Distance from camera to hit */
  distance: number;
  /** True if the hit landed inside the weak-spot sphere */
  isWeakSpot: boolean;
}

interface CrosshairHarvestState {
  /** Current frame's target (null = crosshair over empty space) */
  target: CrosshairTarget | null;
  /** True while the player is in harvest interaction mode */
  active: boolean;
  /** Flash timer for weak-spot hit feedback (seconds remaining) */
  weakSpotFlash: number;
  setTarget: (t: CrosshairTarget | null) => void;
  setActive: (a: boolean) => void;
  tickFlash: (dt: number) => void;
  triggerWeakSpotFlash: () => void;
}

export const useCrosshairHarvest = create<CrosshairHarvestState>((set) => ({
  target: null,
  active: false,
  weakSpotFlash: 0,
  setTarget: (t) => set({ target: t }),
  setActive: (a) => set({ active: a }),
  tickFlash: (dt) => set((s) => ({
    weakSpotFlash: Math.max(0, s.weakSpotFlash - dt),
  })),
  triggerWeakSpotFlash: () => set({ weakSpotFlash: 0.6 }),
}));

// ---------------------------------------------------------------------------
// Per-frame update — called from Player.tsx useFrame in harvest mode.
//
// Casts a ray from the camera through NDC (0,0) — the exact screen centre.
// Checks all non-depleted resource nodes within MAX_HARVEST_RANGE by testing
// a sphere around each node's position (cheaper than mesh intersection for
// hundreds of nodes).
// ---------------------------------------------------------------------------

export function updateCrosshairTarget(
  camera: THREE.Camera,
  _scene: THREE.Scene,   // reserved for future mesh-level raycast
): CrosshairTarget | null {
  _raycaster.setFromCamera(_screenCenter, camera);
  _raycaster.far = MAX_HARVEST_RANGE;

  const ray = _raycaster.ray;
  const nodes = globalResourceRegistry.nodes;

  let best: CrosshairTarget | null = null;
  let bestDist = MAX_HARVEST_RANGE + 1;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.harvested) continue;

    _nodeCenter.set(node.position[0], node.position[1], node.position[2]);

    // Sphere test — treat each node as a sphere of radius ~0.8m
    // (scaled by the node's authored scale).
    const nodeRadius = 0.8 * (node.scale || 1);
    const closestOnRay = ray.closestPointToPoint(_nodeCenter, _hitPoint);
    const distToCenter = _hitPoint.distanceTo(_nodeCenter);

    if (distToCenter > nodeRadius) continue;

    const distFromCam = closestOnRay.distanceTo(ray.origin);
    if (distFromCam > MAX_HARVEST_RANGE || distFromCam >= bestDist) continue;

    // Weak-spot check — is the hit point within the inner sweet-spot sphere?
    const isWeakSpot = distToCenter <= WEAK_SPOT_RADIUS;

    best = {
      nodeIndex: i,
      node,
      hitPoint: _hitPoint.clone(),
      distance: distFromCam,
      isWeakSpot,
    };
    bestDist = distFromCam;
  }

  useCrosshairHarvest.getState().setTarget(best);
  return best;
}

// ---------------------------------------------------------------------------
// Yield multiplier — called by harvest completion logic.
// Returns WEAK_SPOT_MULT if the current target is a weak-spot hit,
// otherwise 1.0. Also fires the UI flash on weak-spot hits.
// ---------------------------------------------------------------------------

export function getWeakSpotMultiplier(): number {
  const state = useCrosshairHarvest.getState();
  if (state.target?.isWeakSpot) {
    state.triggerWeakSpotFlash();
    return WEAK_SPOT_MULT;
  }
  return 1.0;
}

// ---------------------------------------------------------------------------
// Convenience — get the current crosshair target without subscribing to
// the React store (for use inside useFrame / imperative code).
// ---------------------------------------------------------------------------

export function getCrosshairTarget(): CrosshairTarget | null {
  return useCrosshairHarvest.getState().target;
}
