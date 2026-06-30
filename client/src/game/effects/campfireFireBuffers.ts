import * as THREE from "three";
import type { ClaimArea } from "@/lib/stores/useClaimArea";
import { CAMPFIRE_FIRE_CONFIG as C } from "./campfireFireConfig";

export interface CampfireFireBuffers {
  count: number;
  offsets: Float32Array;
  scales: Float32Array;
  seeds: Float32Array;
  visibility: Float32Array;
  invMat0: Float32Array;
  invMat1: Float32Array;
  invMat2: Float32Array;
  invMat3: Float32Array;
  boundingSpheres: THREE.Sphere[];
}

export function buildCampfireFireBuffers(claims: ClaimArea[]): CampfireFireBuffers {
  const lit = claims.filter((c) => c.lit);
  const count = Math.min(lit.length, C.maxInstances);

  const offsets = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const seeds = new Float32Array(count);
  const visibility = new Float32Array(count);
  const invMatrices = new Float32Array(count * 16);
  const boundingSpheres: THREE.Sphere[] = [];

  const tmp = new THREE.Object3D();
  const flameOffset = C.flameHeightOffset;

  for (let i = 0; i < count; i++) {
    const claim = lit[i];
    const s = claim.fireScale * C.boxSize;
    const x = claim.position[0];
    const y = claim.position[1] + flameOffset;
    const z = claim.position[2];

    offsets[i * 3] = x;
    offsets[i * 3 + 1] = y;
    offsets[i * 3 + 2] = z;
    scales[i] = s;
    seeds[i] = claim.fireSeed;
    visibility[i] = 1;

    const radius = s * Math.sqrt(3) * 0.5;
    boundingSpheres.push(new THREE.Sphere(new THREE.Vector3(x, y, z), radius));

    tmp.position.set(x, y, z);
    tmp.scale.set(s, s, s);
    tmp.updateMatrix();

    const instanceMatrix = new THREE.Matrix4();
    instanceMatrix.makeTranslation(x, y, z);
    instanceMatrix.scale(new THREE.Vector3(s, s, s));
    instanceMatrix.invert().toArray(invMatrices, i * 16);
  }

  const invMat0 = new Float32Array(count * 4);
  const invMat1 = new Float32Array(count * 4);
  const invMat2 = new Float32Array(count * 4);
  const invMat3 = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const base = i * 16;
    invMat0.set(invMatrices.subarray(base, base + 4), i * 4);
    invMat1.set(invMatrices.subarray(base + 4, base + 8), i * 4);
    invMat2.set(invMatrices.subarray(base + 8, base + 12), i * 4);
    invMat3.set(invMatrices.subarray(base + 12, base + 16), i * 4);
  }

  return {
    count,
    offsets,
    scales,
    seeds,
    visibility,
    invMat0,
    invMat1,
    invMat2,
    invMat3,
    boundingSpheres,
  };
}

export function applyBuffersToGeometry(
  geom: THREE.BoxGeometry,
  buffers: CampfireFireBuffers,
): void {
  geom.setAttribute(
    "instanceOffset",
    new THREE.InstancedBufferAttribute(buffers.offsets, 3),
  );
  geom.setAttribute(
    "instanceScale",
    new THREE.InstancedBufferAttribute(buffers.scales, 1),
  );
  geom.setAttribute(
    "instanceSeed",
    new THREE.InstancedBufferAttribute(buffers.seeds, 1),
  );
  geom.setAttribute(
    "invMatrix0",
    new THREE.InstancedBufferAttribute(buffers.invMat0, 4),
  );
  geom.setAttribute(
    "invMatrix1",
    new THREE.InstancedBufferAttribute(buffers.invMat1, 4),
  );
  geom.setAttribute(
    "invMatrix2",
    new THREE.InstancedBufferAttribute(buffers.invMat2, 4),
  );
  geom.setAttribute(
    "invMatrix3",
    new THREE.InstancedBufferAttribute(buffers.invMat3, 4),
  );
  geom.setAttribute(
    "visibility",
    new THREE.InstancedBufferAttribute(buffers.visibility, 1),
  );
}