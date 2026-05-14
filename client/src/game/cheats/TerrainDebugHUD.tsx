import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useCheats } from "@/lib/stores/useCheats";
import { useGame } from "@/lib/stores/useGame";

/**
 * Live in-game terrain / raycast probe.
 *
 * Two pieces, one source of truth:
 *
 *  • `<TerrainDebugProbe />` — R3F component placed INSIDE the Canvas
 *    (it uses `useFrame` + `useThree`). Every frame it casts a screen-
 *    centre ray, samples the ground beneath the player, and counts the
 *    nearby collider geometry. Results are written to a module-level
 *    mutable struct so we don't burn React renders.
 *
 *  • `<TerrainDebugHUD />` — HTML overlay mounted at App level. Polls
 *    the same struct on a `requestAnimationFrame` loop and re-renders
 *    only when one of the displayed numbers actually changes.
 *
 * Both gate themselves on `useCheats.debugTerrain`. Off by default;
 * mounted but inert until the F8 panel toggles it on.
 *
 * The split exists because the HUD wants HTML for legibility (font,
 * z-index, copy/paste of values) but the raycast needs Canvas context
 * for `state.scene` and `state.camera`. A shared mutable struct is the
 * simplest bridge that doesn't introduce a dedicated zustand store
 * just to ferry per-frame numbers from one tree to the other.
 */

interface CrosshairProbe {
  hit: boolean;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  name: string;
  distance: number;
}

interface PlayerProbe {
  capsuleY: number;
  groundY: number;
  delta: number;
  groundName: string;
}

interface NearbyProbe {
  meshCount: number;
  triCount: number;
}

const probeData: {
  crosshair: CrosshairProbe;
  player: PlayerProbe;
  nearby: NearbyProbe;
  frame: number;
} = {
  crosshair: { hit: false, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, name: "", distance: 0 },
  player: { capsuleY: 0, groundY: 0, delta: 0, groundName: "" },
  nearby: { meshCount: 0, triCount: 0 },
  frame: 0,
};

/** Radius (m) for the "nearby colliders" stat. Hard-coded — this is a
 *  debug overlay, not a physics tunable. */
const NEARBY_RADIUS = 30;
/** Vertical drop distance (m) for the under-player ground sampler ray.
 *  Matches the spawn-time sampler in TutorialIslandScene which casts
 *  from `groundY + 80`. */
const GROUND_RAY_HEIGHT = 80;
/** Re-throttle the nearby-collider scan: walking the whole scene every
 *  frame is wasteful for ~5000-node islands. Sample 6× per second. */
const NEARBY_SCAN_HZ = 6;
/** Raycast throttle. Two recursive `intersectObject(scene, true)` calls
 *  per frame against ~5k nodes is unnecessary — the HUD only refreshes
 *  at 30 Hz anyway, so doing the raycasts at the same cadence buys all
 *  the responsiveness a user can actually see. */
const RAYCAST_HZ = 30;
/** Cap raycast far distance — anything past this is fog anyway. Keeps
 *  hit lists short on the rare frames where the camera looks at sky. */
const RAYCAST_FAR_M = 400;

/**
 * R3F probe. Mount inside any scene's `<Canvas>`. No-op when the
 * `debugTerrain` cheat is off — the `useFrame` body bails on the
 * first line, so leaving it permanently mounted is free.
 */
export function TerrainDebugProbe() {
  // Gate on `enabled && debugTerrain` so the master F8 switch really
  // does silence every cheat (per the useCheats invariant). A stale
  // `debugTerrain=true` shouldn't keep raycasting after F8-off.
  const debugOn = useCheats(
    (s) => s.enabled && s.debugTerrain,
  );
  const { scene, camera } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const downRaycaster = useRef(new THREE.Raycaster());
  const ndcCenter = useRef(new THREE.Vector2(0, 0));
  const downDir = useRef(new THREE.Vector3(0, -1, 0));
  const downOrigin = useRef(new THREE.Vector3());
  const lastNearbyAt = useRef(0);
  const lastRaycastAt = useRef(0);
  const enabledLastTick = useRef(false);

  // One-time setup: cap raycast `far` so the probe doesn't traverse
  // every distant placeholder island when the camera looks at the
  // horizon. Set on the refs themselves (not in the useFrame hot path)
  // so we touch the value once per probe lifetime, not per frame.
  useEffect(() => {
    raycaster.current.far = RAYCAST_FAR_M;
    downRaycaster.current.far = GROUND_RAY_HEIGHT * 2;
  }, []);

  useFrame(({ clock }) => {
    if (!debugOn) {
      if (enabledLastTick.current) {
        console.log("[TerrainDebug] disabled");
        enabledLastTick.current = false;
      }
      return;
    }
    if (!enabledLastTick.current) {
      console.log("[TerrainDebug] enabled — overlay is live");
      enabledLastTick.current = true;
    }

    // Throttle the heavy work — recursive scene raycasts at 144 Hz
    // are wasted CPU when the HUD only repaints at 30 Hz. Bail early
    // on frames in between; the displayed numbers won't change.
    const now = clock.getElapsedTime();
    if (now - lastRaycastAt.current < 1 / RAYCAST_HZ) return;
    lastRaycastAt.current = now;

    // ----- Crosshair raycast (camera through screen centre) -----
    raycaster.current.setFromCamera(ndcCenter.current, camera);
    // `firstHitOnly` would require BVH instances; the scene mesh tree
    // is small enough at any one camera angle that the cost is fine.
    const hits = raycaster.current.intersectObject(scene, true);
    // Skip the player skin and any helper widgets — we want world
    // geometry, not the character we're driving.
    const wallHit = hits.find(
      (h) =>
        h.object.visible &&
        !isPlayerOwned(h.object) &&
        !isHelper(h.object) &&
        !isWaterSheet(h.object),
    );
    if (wallHit) {
      probeData.crosshair.hit = true;
      probeData.crosshair.x = wallHit.point.x;
      probeData.crosshair.y = wallHit.point.y;
      probeData.crosshair.z = wallHit.point.z;
      const n = wallHit.face?.normal;
      if (n) {
        // Face normal is in object-local space — transform to world.
        const worldN = n
          .clone()
          .transformDirection(wallHit.object.matrixWorld)
          .normalize();
        probeData.crosshair.nx = worldN.x;
        probeData.crosshair.ny = worldN.y;
        probeData.crosshair.nz = worldN.z;
      }
      probeData.crosshair.name = describeMesh(wallHit.object);
      probeData.crosshair.distance = wallHit.distance;
    } else {
      probeData.crosshair.hit = false;
      probeData.crosshair.name = "(no hit)";
      probeData.crosshair.distance = 0;
    }

    // ----- Player ground sampler (down-ray from above the capsule) -----
    const playerPos = useGame.getState().playerPosition;
    if (playerPos) {
      probeData.player.capsuleY = playerPos.y;
      downOrigin.current.set(playerPos.x, playerPos.y + GROUND_RAY_HEIGHT, playerPos.z);
      downRaycaster.current.set(downOrigin.current, downDir.current);
      const downHits = downRaycaster.current.intersectObject(scene, true);
      const groundHit = downHits.find(
        (h) =>
          h.object.visible &&
          !isPlayerOwned(h.object) &&
          !isHelper(h.object) &&
          !isWaterSheet(h.object),
      );
      if (groundHit) {
        probeData.player.groundY = groundHit.point.y;
        probeData.player.delta = playerPos.y - groundHit.point.y;
        probeData.player.groundName = describeMesh(groundHit.object);
      } else {
        probeData.player.groundY = 0;
        probeData.player.delta = playerPos.y;
        probeData.player.groundName = "(none)";
      }
    }

    // ----- Nearby collider scan (throttled) -----
    if (now - lastNearbyAt.current > 1 / NEARBY_SCAN_HZ) {
      lastNearbyAt.current = now;
      let meshCount = 0;
      let triCount = 0;
      if (playerPos) {
        const pxz = new THREE.Vector2(playerPos.x, playerPos.z);
        const tmp = new THREE.Vector3();
        scene.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh) || !obj.visible) return;
          if (isPlayerOwned(obj) || isHelper(obj) || isWaterSheet(obj)) return;
          obj.getWorldPosition(tmp);
          const dx = tmp.x - pxz.x;
          const dz = tmp.z - pxz.y;
          if (dx * dx + dz * dz > NEARBY_RADIUS * NEARBY_RADIUS) return;
          meshCount += 1;
          const idx = obj.geometry?.index;
          const pos = obj.geometry?.attributes?.position;
          if (idx) triCount += idx.count / 3;
          else if (pos) triCount += pos.count / 3;
        });
      }
      probeData.nearby.meshCount = meshCount;
      probeData.nearby.triCount = Math.round(triCount);
    }

    probeData.frame += 1;
  });

  return null;
}

/**
 * HTML overlay. Mount once at App level. Polls `probeData` via rAF
 * and re-renders ~30 Hz so we don't pin the React reconciler at
 * 144fps for a debug widget. Renders nothing when `debugTerrain` is
 * off, so leaving it mounted in production is harmless.
 */
export function TerrainDebugHUD() {
  const debugOn = useCheats(
    (s) => s.enabled && s.debugTerrain,
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!debugOn) return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      // ~30 Hz
      if (t - last > 33) {
        last = t;
        setTick((n) => n + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [debugOn]);

  if (!debugOn) return null;

  const c = probeData.crosshair;
  const p = probeData.player;
  const n = probeData.nearby;

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 9998,
        background: "rgba(10, 10, 12, 0.92)",
        border: "1px solid rgba(120, 200, 255, 0.55)",
        borderRadius: 6,
        padding: "10px 14px",
        color: "#dceefc",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
        lineHeight: 1.55,
        minWidth: 280,
        boxShadow: "0 6px 22px rgba(0,0,0,0.55)",
        userSelect: "text",
        pointerEvents: "none",
      }}
      data-testid="terrain-debug-hud"
      data-frame={tick}
    >
      <div
        style={{
          color: "#78c8ff",
          fontWeight: 700,
          letterSpacing: 1,
          marginBottom: 6,
          paddingBottom: 4,
          borderBottom: "1px solid rgba(120,200,255,0.25)",
        }}
      >
        TERRAIN DEBUG
      </div>

      <Section label="CROSSHAIR">
        <Row k="hit" v={c.hit ? "✓" : "—"} />
        <Row k="name" v={c.name || "—"} />
        <Row
          k="xyz"
          v={
            c.hit
              ? `${c.x.toFixed(2)}  ${c.y.toFixed(2)}  ${c.z.toFixed(2)}`
              : "—"
          }
        />
        <Row
          k="normal"
          v={
            c.hit
              ? `${c.nx.toFixed(2)}  ${c.ny.toFixed(2)}  ${c.nz.toFixed(2)}`
              : "—"
          }
        />
        <Row k="dist" v={c.hit ? `${c.distance.toFixed(2)} m` : "—"} />
      </Section>

      <Section label="UNDER PLAYER">
        <Row k="capsule Y" v={p.capsuleY.toFixed(2)} />
        <Row k="ground Y" v={p.groundY.toFixed(2)} />
        <Row
          k="delta"
          v={`${p.delta.toFixed(2)} m`}
          warn={Math.abs(p.delta) > 5}
        />
        <Row k="ground" v={p.groundName || "—"} />
      </Section>

      <Section label={`NEARBY (${NEARBY_RADIUS} m)`} last>
        <Row k="meshes" v={String(n.meshCount)} />
        <Row k="tris" v={n.triCount.toLocaleString()} />
      </Section>
    </div>
  );
}

function Section({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div style={{ marginBottom: last ? 0 : 6 }}>
      <div
        style={{
          color: "#9fb6c9",
          fontSize: 9,
          letterSpacing: 1.2,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        color: warn ? "#ffb56b" : "#dceefc",
      }}
    >
      <span style={{ color: "#7d92a4" }}>{k}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </div>
  );
}

// ---------- helpers ----------

function isPlayerOwned(obj: THREE.Object3D): boolean {
  // Walk up; any ancestor whose name/tag flags "Player" wins.
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    const name = cur.name || "";
    if (
      name === "Player" ||
      name.startsWith("Player_") ||
      name.startsWith("PlayerCharacter") ||
      cur.userData?.isPlayer === true
    ) {
      return true;
    }
    cur = cur.parent;
  }
  return false;
}

function isHelper(obj: THREE.Object3D): boolean {
  // R3F drei helpers + our own debug visualisers tag themselves.
  if ((obj as any).isLine || (obj as any).isPoints) return true;
  if (obj.userData?.isDebug === true) return true;
  return false;
}

function isWaterSheet(obj: THREE.Object3D): boolean {
  const name = obj.name || "";
  if (/water/i.test(name)) return true;
  // Material name check — the GLB ships a "Water" material; the
  // tutorial island also has a custom WaterSheets component whose
  // meshes are named e.g. "WaterSurface".
  const mat = (obj as THREE.Mesh).material;
  if (mat && !Array.isArray(mat) && /water/i.test(mat.name || "")) return true;
  return false;
}

function describeMesh(obj: THREE.Object3D): string {
  // Prefer the closest named ancestor — bare children of an SM_*
  // pivot are usually unnamed primitive splits.
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.name) {
      // Trim noisy material suffixes the GLB pipeline adds, e.g.
      // "SM_Env_Beach_03_PolygonPirates_Material_01_A_0".
      return cur.name.replace(/_PolygonPirates_Material_\d+_A_\d+$/, "");
    }
    cur = cur.parent;
  }
  return "(unnamed)";
}
