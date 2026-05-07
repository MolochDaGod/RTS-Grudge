/**
 * Helpers for dispatching trimesh collider bakes to the shared
 * `colliderBake.worker.ts`. The worker itself only knows about flat
 * typed-array geometry and matrices; this module bridges the gap from
 * Three.js `BufferGeometry` / `Matrix4` to the worker's wire format,
 * and centralises the "spawn worker → handle message → terminate"
 * boilerplate so per-scene bake hooks stay focused on what to bake
 * rather than how to talk to the worker.
 */

import * as THREE from "three";
import ColliderBakeWorkerCtor from "./colliderBake.worker.ts?worker";
import type {
  BakeCandidateGeom,
  BakeCandidateGroup,
  BakeWorkerRequest,
  BakeWorkerResponse,
  BakedCollider,
} from "./colliderBake.worker";

export type {
  BakeCandidateGeom,
  BakeCandidateGroup,
  BakeWorkerRequest,
  BakeWorkerResponse,
  BakedCollider,
};

/**
 * Pull the raw position attribute out of a `BufferGeometry` as a flat
 * `Float32Array`. The common GLB case (non-interleaved Float32 storage)
 * becomes a single native memcpy via the TypedArray constructor — no
 * per-vertex JS loop. Returns `null` if the attribute is missing.
 *
 * The second return value flags interleaved/non-Float32 sources so
 * callers can surface them in their bake log — the de-interleave
 * fallback path is correct but slower, and we want to know if it ever
 * starts firing in production.
 */
export function copyPositions(
  posAttr:
    | THREE.BufferAttribute
    | THREE.InterleavedBufferAttribute
    | undefined,
): { positions: Float32Array; interleavedFallback: boolean } | null {
  if (!posAttr) return null;
  const vertCount = posAttr.count;
  const isInterleaved =
    (posAttr as Partial<THREE.InterleavedBufferAttribute>)
      .isInterleavedBufferAttribute === true;
  const posArray = (posAttr as THREE.BufferAttribute).array as
    | ArrayLike<number>
    | undefined;
  if (
    !isInterleaved &&
    posArray instanceof Float32Array &&
    posArray.length === vertCount * 3
  ) {
    return { positions: new Float32Array(posArray), interleavedFallback: false };
  }
  // Rare in our GLBs — interleaved or non-Float32 storage. Pay the
  // per-vertex de-interleave cost here once.
  const positions = new Float32Array(vertCount * 3);
  for (let v = 0; v < vertCount; v++) {
    positions[v * 3] = posAttr.getX(v);
    positions[v * 3 + 1] = posAttr.getY(v);
    positions[v * 3 + 2] = posAttr.getZ(v);
  }
  return { positions, interleavedFallback: true };
}

/**
 * Pull the index attribute out of a `BufferGeometry` as a flat
 * `Uint32Array`. The TypedArray constructor memcpy-and-widens
 * Uint8/Uint16/Uint32 sources in a single native pass. Returns `null`
 * for non-indexed geometry (worker handles that case explicitly).
 */
export function copyIndices(
  indexAttr: THREE.BufferAttribute | null,
): Uint32Array | null {
  if (!indexAttr) return null;
  const indexArray = (indexAttr as THREE.BufferAttribute).array as
    | ArrayLike<number>
    | undefined;
  if (
    indexArray instanceof Uint32Array ||
    indexArray instanceof Uint16Array ||
    indexArray instanceof Uint8Array
  ) {
    return new Uint32Array(indexArray);
  }
  const out = new Uint32Array(indexAttr.count);
  for (let k = 0; k < indexAttr.count; k++) out[k] = indexAttr.getX(k);
  return out;
}

/**
 * Build the 16-element column-major matrix the worker expects from a
 * Three.js `Matrix4`. Allocates a fresh `Float32Array` each call so
 * the caller can transfer ownership to the worker without aliasing.
 */
export function packMatrix(m: THREE.Matrix4): Float32Array {
  const out = new Float32Array(16);
  for (let i = 0; i < 16; i++) out[i] = m.elements[i];
  return out;
}

/**
 * Append a baked-candidate geom's underlying buffers to a transfer
 * list so they're handed to the worker by reference rather than
 * copied. The candidate's own `positions` / `indices` are flat copies
 * of the source `BufferGeometry`'s data — once we've passed them to
 * the worker we don't need them again on the main thread, so the
 * transfer is safe.
 */
export function collectGeomTransfers(
  geom: BakeCandidateGeom,
  out: ArrayBuffer[],
): void {
  out.push(geom.positions.buffer);
  if (geom.indices) out.push(geom.indices.buffer);
  out.push(geom.matrix.buffer);
}

export interface DispatchOptions {
  candidates: BakeCandidateGroup[];
  transfers: ArrayBuffer[];
  triLimitPerCollider: number;
  totalTriLimit: number;
  /**
   * If `true`, any candidate group whose summed triangle count exceeds
   * `triLimitPerCollider` is spatially split into multiple sub-colliders
   * (each ≤ the cap) instead of being dropped wholesale. Used by the
   * tutorial-island ground bake so dense dune ridges and wreck-hull
   * skirts remain walkable. Defaults to `false`, which preserves the
   * original drop-and-count-`droppedHighTri` semantics — the right
   * behaviour for things like rocks, where a single collider IS the
   * physics body and splitting it would let the player walk between
   * the pieces.
   */
  chunkOversized?: boolean;
  /** Tag for log messages, e.g. "TutorialIsland.ground". */
  tag: string;
  onResult: (response: BakeWorkerResponse) => void;
  /** Called on worker construction failure or runtime error. */
  onError: (err: unknown) => void;
}

/**
 * Spawn a one-shot collider-bake worker, send it the request, and
 * wire up message/error handlers. Returns a cancel function the
 * caller can run from a `useEffect` cleanup; calling it terminates
 * the worker and suppresses any in-flight result callback.
 *
 * Constructing the worker can synchronously throw on hostile
 * environments (older browsers, restrictive CSP). We catch that here
 * and route through `onError` so the caller's fallback path runs in
 * the same shape as a runtime error.
 */
export function dispatchColliderBake(opts: DispatchOptions): () => void {
  let worker: Worker | null = null;
  let cancelled = false;

  try {
    worker = new ColliderBakeWorkerCtor();
  } catch (err) {
    console.warn(
      `[ColliderBake:${opts.tag}] Failed to spawn worker — caller will fall back.`,
      err,
    );
    opts.onError(err);
    return () => {
      cancelled = true;
    };
  }

  worker.onmessage = (e: MessageEvent<BakeWorkerResponse>) => {
    if (cancelled) return;
    opts.onResult(e.data);
    worker?.terminate();
    worker = null;
  };

  worker.onerror = (err) => {
    if (cancelled) return;
    console.error(`[ColliderBake:${opts.tag}] Worker errored.`, err);
    opts.onError(err);
    worker?.terminate();
    worker = null;
  };

  const request: BakeWorkerRequest = {
    candidates: opts.candidates,
    triLimitPerCollider: opts.triLimitPerCollider,
    totalTriLimit: opts.totalTriLimit,
    chunkOversized: opts.chunkOversized === true,
  };
  worker.postMessage(request, opts.transfers);

  return () => {
    cancelled = true;
    worker?.terminate();
    worker = null;
  };
}
