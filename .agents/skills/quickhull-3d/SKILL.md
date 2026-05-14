---
name: quickhull-3d
description: Build a 3D convex hull from a point cloud using the QuickHull algorithm as presented by Dirk Gregorius (Valve, GDC 2014). Use whenever the user mentions convex hull, ConvexHull, point-cloud collision shape, "wrap these points", AABB-not-tight-enough, GJK/EPA shape generation, ragdoll/asset collision proxies, navmesh boundary fitting, or any task that needs the smallest convex polytope enclosing a set of 3D points. Also use when the user asks "how does QuickHull work" or wants to implement, debug, or port a 3D ConvexHull (three.js, YUKA, Bullet, ReactPhysics3D, custom engine). The algorithm runs in O(n log n) average and O(n²) worst case.
---

# QuickHull 3D — Dirk Gregorius (Valve, GDC 2014)

A practical recipe for building the convex hull of an arbitrary 3D point set. The output is a closed manifold mesh of triangular (or coplanar-merged polygonal) faces, every face oriented outward, every edge shared by exactly two faces, and every input point lying on or inside the hull.

## When to reach for this

- Generating a tight collision proxy from a render mesh's vertices (much tighter than an AABB or OBB, far cheaper to test than the original mesh).
- Fitting a bounding polytope around dynamic point clouds (debris, voxel chunks, navmesh islands).
- Pre-processing for narrow-phase collision (GJK/EPA, SAT) that requires convex inputs.
- Computing the silhouette / shadow volume of an object from a light.
- Any time an AABB is "too loose" and an OBB is "too axis-locked".

## Core data structures

The whole algorithm hinges on a **half-edge mesh**:

```
HalfEdge  { vertex, twin, next, prev, face }
Face      { edge (any half-edge on its boundary), normal, distance, conflictList }
Vertex    { position, edge (an outgoing half-edge) }
```

Invariants you must keep true at every step:

1. Every half-edge has a `twin` and `twin.twin === self`.
2. `next.prev === self` and `prev.next === self` around each face.
3. `face.normal` points outward (away from the interior).
4. `face.distance = dot(face.normal, any vertex on face)` so signed distance from a point `p` to the plane is `dot(face.normal, p) - face.distance`.

Each face also owns a **conflict list**: the input points still floating outside it. A point belongs to exactly one face's conflict list — the face it is *furthest above* (largest positive signed distance). Points already inside the current hull are dropped permanently.

## Algorithm — six phases

### 1. Build the initial tetrahedron

You need four non-coplanar points that span as much volume as possible. Robust recipe:

1. Find the 6 extreme points along ±X, ±Y, ±Z (one per axis direction).
2. From those 6, pick the pair `(a, b)` with the largest separation → first edge.
3. From the remaining points, pick `c` maximising the perpendicular distance to line `ab` → first triangle.
4. From all input points, pick `d` maximising the absolute distance to plane `abc` → apex.
5. If `d` is below the plane, swap two of `a,b,c` so `d` ends up *above*. Build the 4 faces with outward normals.

Bail out early if any of those steps degenerates (all points colinear / coplanar) — return a 0-, 1-, 2-, or 3-D degenerate hull instead of crashing.

### 2. Assign every remaining point to a conflict list

For each point `p`, evaluate the signed distance against all 4 faces; if any distance is `> EPSILON`, attach `p` to the face where the distance is largest. Otherwise discard `p` (it's inside).

### 3. Main loop — process one "eye point" at a time

Pick any face `F` whose conflict list is non-empty. Pop the point `eye` that is furthest above `F`. (Picking the *furthest* point, not the first, is what gives QuickHull its log-ish behaviour and keeps the hull from growing in tiny increments.)

### 4. Find the visible region (the "horizon")

A face is **visible from `eye`** iff `dot(face.normal, eye) - face.distance > EPSILON`.

Starting from `F`, flood-fill across face/twin links to collect every visible face. The boundary of that region is the **horizon**: the ordered loop of half-edges whose face is visible but whose twin's face is *not*.

Walking the horizon correctly is the trickiest part. Practical recipe:

```
mark F visible
stack = [F]
visibleFaces = {F}
while stack not empty:
    f = stack.pop()
    for each half-edge e on f:
        nf = e.twin.face
        if nf not yet classified:
            if signedDist(nf, eye) > EPS:
                mark nf visible; push; add to visibleFaces
            else:
                mark nf horizon-boundary; record e.twin as a horizon edge
```

The horizon edges, sorted by following `next`/`twin` pointers around the cavity, form a single closed polygon (provided the input is non-degenerate — see § Robustness).

### 5. Patch the hole with a fan of new triangles

For each horizon edge `h` (in order), build a new triangle `(h.vertex, h.twin.vertex, eye)`. Stitch:

- `newFace.edge0 = h.twin` (re-using the existing outer twin, so the outside of the hull stays connected)
- `newFace.edge1 = newHalfEdge(eye → h.twin.vertex)`
- `newFace.edge2 = newHalfEdge(h.vertex → eye)`

After all new faces are created, walk them once more to wire the `twin` pointers between adjacent new faces (their shared edges are the two `eye`-incident ones). Compute each new face's normal/distance.

### 6. Re-partition orphaned conflict points

Every point that was on the conflict list of any deleted face must be re-tested:

- If it was the `eye` itself → it is now a hull vertex, drop it.
- Otherwise, signed-distance-test it against the *new* faces only and attach to the new face it is furthest above. Drop if it is now inside.

Loop back to phase 3 until no face has any conflict points left.

## Optional but recommended: face merging

The raw QuickHull output is all triangles. Many of them are nearly coplanar (e.g. four input points that were almost flat get split into two triangles). For collision/SAT, merging them into convex polygons is a big win (fewer SAT axes, smaller adjacency tests).

For each new face just after step 5, walk its edges; if `dot(face.normal, twin.face.normal) > 1 - MERGE_EPS` and the merged polygon stays convex (every reflex test passes), absorb the neighbour: splice out the shared edge pair, re-link `next`/`prev`, recompute the merged normal as the area-weighted average. Repeat until no neighbour is mergeable. Set a flag like `mergeFaces = true` to opt in.

## Robustness — the actual reason this is hard

The mathematically clean version above will explode on real input. Mitigations from the talk:

- **One epsilon doesn't cut it.** Use a *relative* tolerance scaled by the AABB extent of the input:
  `EPSILON = 3 * (|maxX-minX| + |maxY-minY| + |maxZ-minZ|) * DBL_EPSILON`.
- **Always test "is this face visible" with the same epsilon** in phases 2, 4, and 6, otherwise a point can flicker between "in" and "out" between phases and corrupt the topology.
- **Coplanar / nearly-coplanar input.** When the chosen `c` or `d` is within EPS of degenerate, fall back to a 2D hull (Andrew's monotone chain) on the dominant plane and extrude with zero thickness. Skip phase 4-onwards.
- **Duplicate or near-duplicate points.** Pre-snap input to a grid of `EPSILON` so they collapse before they cause horizon edges to fork.
- **Horizon must be a single loop.** If your flood fill produces a non-manifold horizon (two loops, or an edge visited twice), treat the offending neighbour as visible and recurse — never as boundary. This is the single most common bug; assert it after the flood fill.
- **Cap iterations.** Worst-case the loop is O(n²); for production code set `maxIters = 4 * inputCount` and abort with the partial hull if exceeded.

## Reference API (matches YUKA's `math/ConvexHull.js`)

```ts
class ConvexHull extends Polyhedron {
  mergeFaces: boolean;            // default true; merge coplanar tris into polygons
  vertices: Vector3[];            // unique hull vertices
  faces: Polygon[];               // outward-facing polygons
  edges: HalfEdge[];              // unique edges (one per twin pair)
  centroid: Vector3;

  fromPoints(points: Vector3[]): this;          // ≥ 4 points required
  containsPoint(p: Vector3): boolean;           // point-in-hull (all signed distances ≤ 0)
  intersectsAABB(aabb: AABB): boolean;          // SAT against the 3 box axes + face normals
  intersectsConvexHull(other: ConvexHull): boolean; // SAT: face normals of both + edge-edge cross products

  computeCentroid(): this;
  computeUniqueEdges(): this;
  computeUniqueVertices(): this;
  fromAABB(aabb: AABB): this;                   // convenience: 6-face box hull
}
```

`containsPoint` is just: for every face, `dot(face.normal, p) - face.distance ≤ EPSILON`.

`intersectsConvexHull` is the Separating Axis Theorem on three sets of axes:
1. face normals of `this`
2. face normals of `other`
3. cross products of every edge of `this` with every edge of `other` (skip near-parallel pairs)

If *any* axis separates the projected intervals, the hulls are disjoint.

## Quick complexity table

| Operation | Average | Worst |
|---|---|---|
| `fromPoints(n)` | O(n log n) | O(n²) |
| `containsPoint` | O(F) | O(F) |
| `intersectsAABB` | O(F) | O(F) |
| `intersectsConvexHull` | O(F₁·F₂ + E₁·E₂) | same |

(F = face count, E = edge count, after merging.)

## Off-the-shelf implementations to crib from

- three.js examples: `examples/jsm/math/ConvexHull.js` — clean reference, no merging.
- YUKA: `src/math/ConvexHull.js` — adds face merging + AABB/hull intersection.
- Bullet: `src/LinearMath/btConvexHullComputer.cpp` — battle-hardened, integer arithmetic option.
- qhull (the original library) — gold standard for correctness and degeneracy handling.

When porting, the *only* parts that usually need rewriting are (a) the epsilon scheme and (b) the horizon-loop walk. The half-edge bookkeeping is mechanical.

## Common pitfalls checklist

- [ ] Outward normals: every `face.normal` should give a positive dot product against `(face.centroid - hull.centroid)`. If not, the face is inverted — flip it now, before any conflict-list work.
- [ ] Conflict list cleared on faces being deleted (memory leak / dangling pointer otherwise).
- [ ] `eye` removed from input set after promotion, or it will be re-added every iteration.
- [ ] Two new faces sharing a horizon vertex are wired as twins of each other, not of the deleted face's old half-edges.
- [ ] After merging, recompute `face.distance` (the centroid moved).
- [ ] Don't trust `face.distance` after vertex positions change — recompute from a current vertex.

## Source

Dirk Gregorius, *Implementing QuickHull*, GDC 2014.
PDF: https://media.steampowered.com/apps/valve/2014/DirkGregorius_ImplementingQuickHull.pdf
