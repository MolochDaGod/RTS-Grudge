import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useCheats } from "@/lib/stores/useCheats";

/**
 * Dev-only debug overlay for any scene's mounted physics colliders.
 *
 * Originally written for the tutorial island's worker-baked, spatially
 * chunked trimesh ground (`<StreamedGroundColliders>`); now generalized
 * to accept any source of `{ vertices, indices, name }` colliders so
 * other scenes (the dungeon, future heightmap-derived bake outputs) can
 * wire it in too. The shape is the same one Rapier's `TrimeshCollider`
 * already consumes, so callers usually have it on hand — and where
 * colliders are primitive boxes instead (e.g. dungeon tiles), it's
 * cheap to synthesize box trimesh data on the fly.
 *
 * For every currently-active chunk it renders:
 *  - A wireframe outline (THREE.EdgesGeometry of the trimesh) so any
 *    fall-through gap shows up as a missing line cluster.
 *  - A flat tinted xz bbox quad sitting just above the bbox top, so
 *    multi-chunk source meshes (heavy dunes, wreck-hull skirts, banks
 *    of dungeon walls) read as a tight grid of same-colored tiles
 *    instead of one big quad — chunk seams are visible at a glance.
 *
 * Colors are deterministic per source mesh name, so all chunks of a
 * single source share a tint and a different source nearby gets a
 * contrasting one. For non-streamed scenes (dungeon, etc.) where
 * everything is always mounted, just leave `active` undefined — the
 * overlay treats every entry as active.
 *
 * If `playerPosRef` + both ring radii are supplied, the mount/unmount
 * radius is also drawn around the player as flat rings, so for streamed
 * scenes you can watch chunks pop in/out as you walk and see the
 * hysteresis band the streaming layer is using. Scenes without
 * streaming simply omit those props and no rings are drawn.
 *
 * Gated on `useCheats.enabled && useCheats.debugColliders`. When the
 * cheat is off the wrapper short-circuits before mounting the inner
 * `<DebugOverlayInner>` — no useFrame is registered, no geometry is
 * built, no draw calls happen. Flipping the cheat off also unmounts
 * the inner component, which disposes its cached `EdgesGeometry`
 * entries (see below). Toggle from the F8 cheats panel.
 *
 * Built wireframe / bbox geometry for each collider is cached in a
 * ref-held Map keyed by collider index, so toggling the overlay on
 * mid-session pays the EdgesGeometry cost once per chunk and reuses
 * it for the rest of that on-period (subsequent re-mounts of a chunk
 * skip the rebuild). The cache is disposed when the overlay inner
 * component unmounts — i.e. when the cheat flips off OR when the
 * `colliders` array identity changes (fresh world load) — preventing
 * GPU buffer leaks. Toggling the cheat back on rebuilds entries on
 * demand.
 */

/**
 * One debuggable trimesh chunk. `vertices` / `indices` follow the
 * same layout Rapier's `TrimeshCollider` consumes (flat float32 xyz
 * triples + flat uint32 triangle indices). `name` is used both for
 * deterministic per-source coloring and the React key, so siblings
 * from the same source mesh share a tint and adjacent sources
 * contrast. `bbox` is optional — if omitted, the overlay computes it
 * from the vertex buffer on first build.
 */
export interface DebugColliderEntry {
  vertices: Float32Array;
  indices: Uint32Array;
  name: string;
  bbox?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
}

interface StreamedColliderDebugOverlayProps {
  /**
   * The chunk list to visualize. Tutorial island passes the same
   * array its `<StreamedGroundColliders>` iterates; the dungeon
   * passes a synthesized list where each tile floor / wall is a tiny
   * box trimesh. We only read these fields; never mutate.
   */
  colliders: ReadonlyArray<DebugColliderEntry>;
  /**
   * Indices of `colliders` currently mounted as physics bodies. Omit
   * for scenes without spatial streaming — every entry is then drawn.
   */
  active?: ReadonlySet<number>;
  /**
   * Player position to track for the mount/unmount rings. Omit (along
   * with the radii) for scenes without streaming hysteresis — no
   * rings are drawn.
   */
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
  mountRadius?: number;
  unmountRadius?: number;
}

interface CachedColliderViz {
  /** Wireframe of the trimesh, in world space (verts already baked). */
  wire: THREE.EdgesGeometry;
  /** xz bbox of the chunk in world space. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Top of the chunk's bbox; we float the bbox quad just above this. */
  topY: number;
}

/** Edge-fold angle threshold (deg) for `EdgesGeometry`. 25° gives a
 *  clean silhouette for the curving dune meshes without spamming every
 *  internal triangle edge. */
const EDGES_THRESHOLD_DEG = 25;

/** How many source meshes to list in the HUD's "by source" breakdown.
 *  The wreck-hull / dune sources usually dominate; 8 rows covers them
 *  with room for a couple of curiosity entries before the cliff falls
 *  off. Anything past this is summed into a "+N more" line. */
const STATS_TOP_N_SOURCES = 8;

/** Lift the tinted bbox quad this far above the chunk top so it
 *  doesn't z-fight with the wireframe or the visible terrain. */
const BBOX_QUAD_LIFT_M = 0.35;

/** Bbox quad alpha — high enough to read as a solid tile from a
 *  distance, low enough not to obscure the wireframe under it. */
const BBOX_QUAD_ALPHA = 0.22;

/**
 * Public wrapper. Cheap enough to leave permanently mounted: it
 * subscribes to a single boolean from `useCheats` and renders nothing
 * at all when the cheat is off. The expensive bits (per-frame ring
 * follow, geometry cache, scene graph contribution) live in the
 * inner component and only mount while the cheat is on, so flipping
 * it off truly returns to zero per-frame cost — no leftover
 * `useFrame` callback in Rapier's scheduler.
 */
export function StreamedColliderDebugOverlay(
  props: StreamedColliderDebugOverlayProps,
) {
  const debugOn = useCheats((s) => s.enabled && s.debugColliders);
  if (!debugOn) return null;
  return <DebugOverlayInner {...props} />;
}

function DebugOverlayInner({
  colliders,
  active,
  playerPosRef,
  mountRadius,
  unmountRadius,
}: StreamedColliderDebugOverlayProps) {
  // Per-collider visualization cache. Keyed by collider index. We
  // never delete entries while this inner component is mounted —
  // chunks that unmount from the streamer may re-mount later, and
  // reusing the EdgesGeometry beats rebuilding it on every visit.
  // The whole map is disposed when the overlay unmounts (cheat
  // flips off, or `colliders` array identity changes).
  const vizCacheRef = useRef<Map<number, CachedColliderViz>>(new Map());

  useEffect(() => {
    return () => {
      const cache = vizCacheRef.current;
      cache.forEach((entry) => entry.wire.dispose());
      cache.clear();
    };
  }, []);

  // If the colliders array identity changes (fresh world load), drop
  // every cached entry — the indices no longer correspond to the
  // same source meshes.
  useEffect(() => {
    const cache = vizCacheRef.current;
    cache.forEach((entry) => entry.wire.dispose());
    cache.clear();
  }, [colliders]);

  // Mount/unmount rings only render when the caller supplied both a
  // player tracker and both radii. Scenes with no streaming pass none
  // of these and we skip the per-frame follow entirely.
  const showRings =
    !!playerPosRef &&
    typeof mountRadius === "number" &&
    typeof unmountRadius === "number";
  const playerRingRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!showRings) return;
    const g = playerRingRef.current;
    if (!g) return;
    const p = playerPosRef!.current;
    // Track the player on xz; the rings sit on a fixed Y just above
    // the player capsule so they read against any terrain underneath.
    g.position.set(p.x, p.y + 0.05, p.z);
  });

  // Without an explicit `active` set, treat every collider as
  // mounted — non-streamed scenes (e.g. the dungeon, where every
  // tile collider is permanently in the world) want the whole list
  // drawn. The same convention is forwarded to `publishColliderStats`
  // below so the HUD's "mounted / baked" tally reads the full list as
  // mounted in those scenes too.
  const visit = (cb: (i: number) => void) => {
    if (active) {
      active.forEach(cb);
    } else {
      for (let i = 0; i < colliders.length; i++) cb(i);
    }
  };

  // Publish numeric stats to the module-level bridge so the HTML
  // `<StreamedColliderStatsHUD>` (mounted at App level — outside the
  // Canvas) can poll and render them. Recomputed only when the active
  // set or collider list changes, not per frame: the streaming layer
  // already throttles active-set updates to roughly one per 4 m walked,
  // so the HUD effectively refreshes when something it cares about
  // actually moves. For non-streamed scenes (no `active` set) the
  // publish runs once on mount and then only when the collider list
  // identity changes. While the cheat is off this hook never runs (the
  // outer wrapper short-circuits before mounting `DebugOverlayInner`).
  useEffect(() => {
    publishColliderStats(colliders, active);
  }, [colliders, active]);

  // When the inner overlay unmounts (cheat flipped off, or the scene
  // tears down), zero the bridge so the HUD — which may still be alive
  // at App level until the cheat boolean propagates — doesn't show
  // stale numbers from the previous session.
  useEffect(() => {
    return () => {
      resetColliderStats();
    };
  }, []);

  const items: JSX.Element[] = [];
  visit((i) => {
    const c = colliders[i];
    if (!c) return;
    let viz = vizCacheRef.current.get(i);
    if (!viz) {
      viz = buildColliderViz(c.vertices, c.indices, c.bbox);
      vizCacheRef.current.set(i, viz);
    }
    const color = colorForName(c.name);
    items.push(
      <group key={`dbg-${i}-${c.name}`} userData={{ isDebug: true }}>
        {/* Wireframe of the actual trimesh — gaps in the floor read
            as gaps in the line cluster here. depthTest off so the
            outline is visible even when a chunk is buried in foliage. */}
        <lineSegments geometry={viz.wire}>
          <lineBasicMaterial
            color={color}
            transparent
            opacity={0.85}
            depthTest={false}
            toneMapped={false}
          />
        </lineSegments>
        {/* Tinted xz bbox quad floated above the chunk top, so chunk
            seams within a single source mesh are obvious. Same color
            as the wireframe — sibling chunks share the tint. */}
        <mesh
          position={[
            (viz.minX + viz.maxX) * 0.5,
            viz.topY + BBOX_QUAD_LIFT_M,
            (viz.minZ + viz.maxZ) * 0.5,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={1}
        >
          <planeGeometry
            args={[
              Math.max(0.1, viz.maxX - viz.minX),
              Math.max(0.1, viz.maxZ - viz.minZ),
            ]}
          />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={BBOX_QUAD_ALPHA}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </group>,
    );
  });

  return (
    <>
      {items}
      {showRings && (
        <group ref={playerRingRef} userData={{ isDebug: true }}>
          {/* Mount radius — green, solid. Chunks inside this circle are
              actively mounted as physics bodies. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
            <ringGeometry args={[mountRadius! - 0.4, mountRadius!, 96]} />
            <meshBasicMaterial
              color={"#3ddc7e"}
              transparent
              opacity={0.55}
              depthTest={false}
              depthWrite={false}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
          {/* Unmount radius — amber, slightly thinner. Chunks past this
              ring get torn down. The band between the two rings is the
              streaming hysteresis: a chunk inside the green ring stays
              mounted until the player walks past the amber one. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
            <ringGeometry
              args={[unmountRadius! - 0.25, unmountRadius!, 96]}
            />
            <meshBasicMaterial
              color={"#ffb347"}
              transparent
              opacity={0.45}
              depthTest={false}
              depthWrite={false}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}
    </>
  );
}

function buildColliderViz(
  vertices: Float32Array,
  indices: Uint32Array,
  bbox?: DebugColliderEntry["bbox"],
): CachedColliderViz {
  // Build a temporary BufferGeometry from the trimesh so EdgesGeometry
  // can fold coplanar faces. Position attribute reuses the SAME backing
  // Float32Array — Rapier owns it on the worker side, but on the main
  // thread it's just a typed array. We dispose the temp geom after
  // EdgesGeometry has copied what it needs (it builds its own buffers).
  const tmp = new THREE.BufferGeometry();
  tmp.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  tmp.setIndex(new THREE.BufferAttribute(indices, 1));
  let minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number;
  if (bbox) {
    // Trust the caller — saves one pass over the vertex buffer for
    // chunks whose bbox is already known (e.g. dungeon box tiles).
    minX = bbox.minX;
    maxX = bbox.maxX;
    minY = bbox.minY;
    maxY = bbox.maxY;
    minZ = bbox.minZ;
    maxZ = bbox.maxZ;
  } else {
    // Compute bbox in the same pass — cheaper than walking the array
    // ourselves and consistent with the geometry the wireframe reflects.
    tmp.computeBoundingBox();
    const bb = tmp.boundingBox!;
    minX = bb.min.x;
    maxX = bb.max.x;
    minY = bb.min.y;
    maxY = bb.max.y;
    minZ = bb.min.z;
    maxZ = bb.max.z;
  }
  const wire = new THREE.EdgesGeometry(tmp, EDGES_THRESHOLD_DEG);
  tmp.dispose();
  return {
    wire,
    minX,
    maxX,
    minZ,
    maxZ,
    topY: maxY,
  };
}

/**
 * Deterministic hue per source mesh name, so all chunks of a single
 * source share a color and adjacent sources contrast. FNV-1a hash on
 * the name → hue in [0, 360). Saturation/lightness fixed for legible
 * neon-ish wireframes that still read against the sand.
 */
const colorCache = new Map<string, THREE.Color>();
function colorForName(name: string): THREE.Color {
  const cached = colorCache.get(name);
  if (cached) return cached;
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hue = ((hash >>> 0) % 360) / 360;
  const c = new THREE.Color().setHSL(hue, 0.78, 0.62);
  colorCache.set(name, c);
  return c;
}

// ---------------------------------------------------------------------
// Stats bridge + HTML HUD
// ---------------------------------------------------------------------
//
// The 3D overlay above lives inside the R3F Canvas; the readable stats
// text wants to be plain HTML (proper font, copy/paste, z-index above
// the canvas). Rather than bolt an HTML drei portal onto the overlay,
// we mirror the established `<TerrainDebugHUD>` pattern: the in-Canvas
// component writes summary numbers into a module-level mutable struct
// each time the active set changes; the HTML HUD polls that struct on
// a rAF loop and re-renders ~10 Hz. No zustand churn, no canvas-side
// React renders, and the HUD is fully decoupled from scene mounting.
//
// While the overlay is unmounted (cheat off, or scene torn down) the
// struct is reset to zeroes, so the HUD — even if its own gating is
// briefly out of sync — never paints stale chunk counts from a
// previous session.

interface ColliderStatsSource {
  name: string;
  count: number;
}

interface ColliderStats {
  /** Total baked colliders in the streamed set, mounted or not. */
  total: number;
  /** Subset currently mounted as physics bodies. */
  mounted: number;
  /** Sum of triangle counts across mounted colliders. */
  mountedTris: number;
  /** Distinct source meshes contributing at least one mounted chunk. */
  mountedSources: number;
  /** Top-N source meshes by mounted-chunk count (descending). */
  topSources: ColliderStatsSource[];
  /** Mounted-chunk count rolled into the "+N more" tail row. */
  remainingChunks: number;
  /** Distinct source meshes rolled into the tail. */
  remainingSources: number;
  /** Bumped on every publish so the HUD can detect staleness. */
  frame: number;
}

const colliderStats: ColliderStats = {
  total: 0,
  mounted: 0,
  mountedTris: 0,
  mountedSources: 0,
  topSources: [],
  remainingChunks: 0,
  remainingSources: 0,
  frame: 0,
};

function publishColliderStats(
  colliders: StreamedColliderDebugOverlayProps["colliders"],
  active: ReadonlySet<number> | undefined,
) {
  let mountedTris = 0;
  // Per-source mounted-chunk tally. Map preserves first-insertion
  // order which doesn't matter — we sort below.
  const bySource = new Map<string, number>();
  // Mirror the in-canvas `visit` helper: when the caller didn't supply
  // a streaming-active set, every entry counts as mounted (matches the
  // dungeon's "always mounted" tile colliders).
  const visit = (cb: (i: number) => void) => {
    if (active) {
      active.forEach(cb);
    } else {
      for (let i = 0; i < colliders.length; i++) cb(i);
    }
  };
  visit((i) => {
    const c = colliders[i];
    if (!c) return;
    // Indices is a flat triangle list (3 verts per tri).
    mountedTris += c.indices.length / 3;
    bySource.set(c.name, (bySource.get(c.name) ?? 0) + 1);
  });

  // Sort sources by chunk count desc, then name asc for stable ties so
  // the HUD doesn't reshuffle when two sources share a count.
  const sorted: ColliderStatsSource[] = Array.from(bySource.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));

  const top = sorted.slice(0, STATS_TOP_N_SOURCES);
  const tail = sorted.slice(STATS_TOP_N_SOURCES);
  let remainingChunks = 0;
  for (const s of tail) remainingChunks += s.count;

  colliderStats.total = colliders.length;
  colliderStats.mounted = active ? active.size : colliders.length;
  colliderStats.mountedTris = mountedTris;
  colliderStats.mountedSources = sorted.length;
  colliderStats.topSources = top;
  colliderStats.remainingChunks = remainingChunks;
  colliderStats.remainingSources = tail.length;
  colliderStats.frame += 1;
}

function resetColliderStats() {
  colliderStats.total = 0;
  colliderStats.mounted = 0;
  colliderStats.mountedTris = 0;
  colliderStats.mountedSources = 0;
  colliderStats.topSources = [];
  colliderStats.remainingChunks = 0;
  colliderStats.remainingSources = 0;
  colliderStats.frame += 1;
}

/**
 * HTML HUD that sits next to the in-canvas wireframe overlay. Mount
 * once at App level. Returns `null` when either the master cheats
 * switch or `debugColliders` specifically is off, so leaving it
 * permanently mounted in production costs one zustand subscriber.
 *
 * Style mirrors `<TerrainDebugHUD>` (top-right, mono font, dark card
 * with a colored accent border) but uses the cheat's signature green
 * — same hue as the mount-radius ring drawn in the canvas overlay —
 * so the HTML panel and the in-world rings read as one tool.
 */
export function StreamedColliderStatsHUD() {
  const debugOn = useCheats((s) => s.enabled && s.debugColliders);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!debugOn) return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      // ~10 Hz is plenty: the underlying numbers only change when the
      // streaming layer mounts/unmounts a chunk, which happens roughly
      // once every few metres walked at human speeds.
      if (t - last > 95) {
        last = t;
        setTick((n) => n + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [debugOn]);

  if (!debugOn) return null;

  const s = colliderStats;
  const overlayLive = s.total > 0 || s.mounted > 0;

  return (
    <div
      style={{
        position: "fixed",
        // Stack underneath the terrain HUD if both are on. Terrain HUD
        // sits at top:12; give this one enough headroom (~290px) to
        // clear it without overlapping on a 1080p layout.
        top: 312,
        right: 12,
        zIndex: 9998,
        background: "rgba(10, 14, 12, 0.92)",
        border: "1px solid rgba(120, 240, 160, 0.55)",
        borderRadius: 6,
        padding: "10px 14px",
        color: "#dcfce0",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
        lineHeight: 1.55,
        minWidth: 280,
        maxWidth: 360,
        boxShadow: "0 6px 22px rgba(0,0,0,0.55)",
        userSelect: "text",
        pointerEvents: "none",
      }}
      data-testid="streamed-collider-stats-hud"
      data-frame={s.frame}
    >
      <div
        style={{
          color: "#7fe6a3",
          fontWeight: 700,
          letterSpacing: 1,
          marginBottom: 6,
          paddingBottom: 4,
          borderBottom: "1px solid rgba(120,240,160,0.25)",
        }}
      >
        STREAM COLLIDERS
      </div>

      {!overlayLive ? (
        <div style={{ color: "#9fb6a8" }}>
          (overlay not active — enter tutorial island to populate)
        </div>
      ) : (
        <>
          <StatsSection label="TOTALS">
            <StatsRow k="baked" v={s.total.toLocaleString()} />
            <StatsRow
              k="mounted"
              v={`${s.mounted.toLocaleString()} / ${s.total.toLocaleString()}`}
            />
            <StatsRow k="mounted tris" v={s.mountedTris.toLocaleString()} />
            <StatsRow
              k="mounted sources"
              v={s.mountedSources.toLocaleString()}
            />
          </StatsSection>

          <StatsSection
            label={`TOP SOURCES (mounted)`}
            last
          >
            {s.topSources.length === 0 ? (
              <div style={{ color: "#9fb6a8" }}>—</div>
            ) : (
              <>
                {s.topSources.map((src) => (
                  <StatsRow
                    key={src.name}
                    k={shortenSourceName(src.name)}
                    v={`${src.count} chunk${src.count === 1 ? "" : "s"}`}
                  />
                ))}
                {s.remainingSources > 0 ? (
                  <StatsRow
                    k={`+${s.remainingSources} more source${s.remainingSources === 1 ? "" : "s"}`}
                    v={`${s.remainingChunks} chunk${s.remainingChunks === 1 ? "" : "s"}`}
                  />
                ) : null}
              </>
            )}
          </StatsSection>
        </>
      )}
    </div>
  );
}

function StatsSection({
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
          color: "#9fc9aa",
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

function StatsRow({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        color: "#dcfce0",
      }}
    >
      <span
        style={{
          color: "#7da490",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={k}
      >
        {k}
      </span>
      <span
        style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}
      >
        {v}
      </span>
    </div>
  );
}

/** Trim the noisy material suffixes the GLB pipeline staples on so a
 *  source name fits on one HUD row. Same trim regex as `describeMesh`
 *  in `<TerrainDebugHUD>` — keep the two in sync if either changes. */
function shortenSourceName(name: string): string {
  return name.replace(/_PolygonPirates_Material_\d+_A_\d+$/, "");
}

// ---------------------------------------------------------------------
// Oriented-box trimesh helper
// ---------------------------------------------------------------------
//
// Many of the world's "real" colliders are CuboidCollider boxes with an
// optional yaw rotation — placed buildings, climbable wall hulls, ladder
// rungs, dungeon decor, and the legacy hand-authored static building
// colliders all live in that family. This helper packs an 8-vertex /
// 12-triangle box trimesh in the exact layout the overlay above (and
// Rapier's TrimeshCollider) consumes, with the rotation already folded
// into world-space corner positions and an axis-aligned world bbox
// returned alongside so the overlay can skip its own bbox pass.
//
// Pass `rotY = 0` for axis-aligned boxes (dungeon tiles, etc.).

/** Result shape of `buildOrientedBoxDebugTrimesh` — same vertex/index
 *  layout the overlay (and Rapier's TrimeshCollider) consume, with the
 *  axis-aligned world bbox returned alongside so the overlay can skip
 *  its own bbox pass. */
export interface OrientedBoxDebugTrimesh {
  vertices: Float32Array;
  indices: Uint32Array;
  bbox: NonNullable<DebugColliderEntry["bbox"]>;
}

/**
 * Pack an oriented box (centre + half-extents + yaw) as a debug trimesh.
 * The yaw is baked into the corner positions in world space, so the
 * caller hands the result straight to a `DebugColliderEntry` without any
 * further transform — the overlay treats every chunk as world-space.
 *
 * Triangle winding matches `buildBoxDebugTrimesh` in DungeonScene so the
 * EdgesGeometry fold threshold (25°) renders all 12 box edges cleanly.
 */
export function buildOrientedBoxDebugTrimesh(
  cx: number, cy: number, cz: number,
  hx: number, hy: number, hz: number,
  rotY: number = 0,
): OrientedBoxDebugTrimesh {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  // 8 box corners in local frame, axis-aligned. Order chosen so the
  // index list below produces correctly-wound outward-facing tris.
  const local: Array<[number, number, number]> = [
    [-hx, -hy, -hz], [ hx, -hy, -hz], [ hx, -hy,  hz], [-hx, -hy,  hz],
    [-hx,  hy, -hz], [ hx,  hy, -hz], [ hx,  hy,  hz], [-hx,  hy,  hz],
  ];
  const vertices = new Float32Array(24);
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < 8; i++) {
    const [lx, ly, lz] = local[i];
    // Yaw around world Y: x' = x cos + z sin, z' = -x sin + z cos.
    const wx = cx + lx * c + lz * s;
    const wy = cy + ly;
    const wz = cz - lx * s + lz * c;
    vertices[i * 3] = wx;
    vertices[i * 3 + 1] = wy;
    vertices[i * 3 + 2] = wz;
    if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
    if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
  }
  // 12 outward-facing triangles. EdgesGeometry's 25° fold threshold
  // keeps every 90° corner edge so each box reads as a clean wire crate.
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

// ---------------------------------------------------------------------
// World-collider registry
// ---------------------------------------------------------------------
//
// The streamed-ground caller (tutorial island) and the dungeon's tile
// grid both have a single, scene-owned source of `DebugColliderEntry`s
// they pass straight to `<StreamedColliderDebugOverlay>`. Other physics
// bodies in the world — placed buildings, the legacy hand-authored
// static building boxes, climbable walls / ladders, dungeon decor —
// don't fit that "scene knows the whole list" shape: each producer owns
// its own data, and the dungeon decor list is even threaded through
// several render components.
//
// To wire those into the F8 overlay without prop-drilling everything up
// to the scene, the producers register their entries into a tiny
// module-level map keyed by source id. `<RegisteredDebugColliderOverlay>`
// subscribes to changes, flattens the registry into one
// `DebugColliderEntry[]`, and feeds it to the same generic overlay used
// by the streamed/tile-grid callers.
//
// Producers are expected to:
//   1. Subscribe to the F8 cheat (`useCheats.enabled && debugColliders`)
//      and only build their entry list while the cheat is on. With the
//      cheat off they pass `null` to the registration hook below, which
//      drops their entry from the registry entirely — production runs
//      stay zero-cost.
//   2. Memoize the entry list on stable inputs so the registry only
//      reshuffles when their underlying data actually changes
//      (preventing the overlay's EdgesGeometry cache from thrashing).
//
// Stats publishing remains the responsibility of the single mounted
// `<DebugOverlayInner>`: producers contribute geometry, not numbers.
// Mount only one `<RegisteredDebugColliderOverlay>` per scene to avoid
// two overlays racing on the module-level `colliderStats` struct used
// by the HTML HUD.

type DebugColliderSourceKey = string;
const debugColliderSources = new Map<
  DebugColliderSourceKey,
  ReadonlyArray<DebugColliderEntry>
>();
const debugColliderSubscribers = new Set<() => void>();
let debugColliderRegistryVersion = 0;

function notifyDebugColliderSubscribers() {
  debugColliderRegistryVersion += 1;
  // Snapshot to be defensive if a subscriber unsubscribes during iteration.
  const snap = Array.from(debugColliderSubscribers);
  for (const cb of snap) cb();
}

/**
 * Add or replace a registered collider source. Idempotent — calling
 * with the same key replaces the prior entry list. Pair every register
 * with a matching `unregisterDebugColliderSource` on unmount; the hook
 * below handles that for React callers.
 */
export function registerDebugColliderSource(
  key: DebugColliderSourceKey,
  entries: ReadonlyArray<DebugColliderEntry>,
): void {
  debugColliderSources.set(key, entries);
  notifyDebugColliderSubscribers();
}

/** Drop a previously registered source. No-op if the key is unknown. */
export function unregisterDebugColliderSource(
  key: DebugColliderSourceKey,
): void {
  if (debugColliderSources.delete(key)) {
    notifyDebugColliderSubscribers();
  }
}

/**
 * React hook that registers `entries` under `key` while mounted, and
 * cleans up on unmount or when `entries` becomes `null` (the common
 * "cheat is off, don't compute" case). The registration is replaced
 * whenever `entries` changes identity, so producers should `useMemo`
 * the list on stable deps to avoid thrashing the overlay's geometry
 * cache.
 */
export function useDebugColliderRegistration(
  key: DebugColliderSourceKey,
  entries: ReadonlyArray<DebugColliderEntry> | null,
): void {
  useEffect(() => {
    if (!entries || entries.length === 0) {
      unregisterDebugColliderSource(key);
      return;
    }
    registerDebugColliderSource(key, entries);
    return () => unregisterDebugColliderSource(key);
  }, [key, entries]);
}

/**
 * Subscribe to the registry and return the merged list of all currently
 * registered entries. Re-flattens only when the registry version bumps
 * (a register / unregister), not on every render of the consuming
 * component, so the returned array's identity is stable across renders
 * that don't actually change the underlying data — which keeps the
 * overlay's EdgesGeometry cache valid across uneventful frames.
 */
function useRegisteredDebugColliders(): ReadonlyArray<DebugColliderEntry> {
  const [version, setVersion] = useState(debugColliderRegistryVersion);
  useEffect(() => {
    const cb = () => setVersion(debugColliderRegistryVersion);
    debugColliderSubscribers.add(cb);
    // Sync once on subscribe in case the registry mutated between
    // initial render and this effect running.
    cb();
    return () => {
      debugColliderSubscribers.delete(cb);
    };
  }, []);
  return useMemo(() => {
    const out: DebugColliderEntry[] = [];
    debugColliderSources.forEach((entries) => {
      for (const e of entries) out.push(e);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
}

/**
 * Drop-in overlay for scenes that aggregate their colliders through the
 * registry above (player-placed buildings, static building boxes,
 * climbable walls / ladders, dungeon decor, dungeon tile grid).
 *
 * Mount once per scene at the same level you'd mount
 * `<StreamedColliderDebugOverlay>`. Returns null while the F8 cheat is
 * off so production runs pay nothing — same gating contract as the
 * streamed-ground overlay.
 *
 * Don't mount this AND `<StreamedColliderDebugOverlay>` in the same
 * scene: both publish into the shared `colliderStats` struct read by
 * the HTML HUD, and the last writer wins. Streamed scenes that want
 * world colliders too should pick one mount strategy (typically: keep
 * the streamed overlay, and skip mounting this one).
 */
export function RegisteredDebugColliderOverlay() {
  const debugOn = useCheats((s) => s.enabled && s.debugColliders);
  const entries = useRegisteredDebugColliders();
  if (!debugOn) return null;
  return <StreamedColliderDebugOverlay colliders={entries} />;
}
