/* eslint-disable no-console */
/**
 * Build pre-fractured GLBs for the most-shattered dungeon props.
 *
 * Approach: load each source prop's GLB/glTF, slice its triangles into
 * chunks based on a per-prop region strategy, and re-export a new GLB
 * whose meshes are the chunk pieces. The chunks reuse the source's
 * materials, textures, samplers and image URIs wholesale, so smashed
 * fragments render with the prop's actual textures (PBR atlases for
 * fantasy props, vertex-colored palettes for KayKit).
 *
 * Image references are kept as RELATIVE URIs pointing back at the
 * source pack folder so each fracture .glb stays small (~tens of KB)
 * and the heavy trim atlases load once and are shared by both the
 * intact prop and its fracture chunks.
 *
 * Generation is deterministic — every triangle goes to a single chunk
 * based purely on its centroid (no RNG anywhere).
 *
 * Run from project root:
 *   node scripts/build-fracture-glbs.cjs
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { glbToGltf } = require("gltf-pipeline");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PUBLIC_ROOT = path.join(PROJECT_ROOT, "client/public");
const OUT_DIR = path.join(PUBLIC_ROOT, "models/dungeon/fractures");
fs.mkdirSync(OUT_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────────────
// Per-prop fracture strategies
//
// Each strategy receives the centroid of a triangle in *source local
// space* (post node-transform), normalized so the source bbox spans
// roughly [-0.5, 0.5] on each axis around its center, and returns a
// chunk index >= 0 (or -1 to drop the triangle).
//
// Choosing chunk index by centroid makes generation fully deterministic:
// the same source mesh produces the same fracture every run.
// ─────────────────────────────────────────────────────────────────────

function angularStrategy(sectors) {
  return ({ x, z }) => {
    let a = Math.atan2(z, x);
    if (a < 0) a += Math.PI * 2;
    return Math.min(sectors - 1, Math.floor((a / (Math.PI * 2)) * sectors));
  };
}
function ySlabsStrategy(slabs) {
  return ({ y }) => {
    const t = Math.max(0, Math.min(0.9999, y + 0.5));
    return Math.floor(t * slabs);
  };
}
function bookshelfStrategy(shelves) {
  return ({ x, y }) => {
    if (x < -0.4) return shelves;
    if (x > 0.4) return shelves + 1;
    const t = Math.max(0, Math.min(0.9999, y + 0.5));
    return Math.floor(t * shelves);
  };
}
function sixFaceStrategy() {
  return ({ x, y, z }) => {
    const d = [0.5 - x, 0.5 + x, 0.5 - y, 0.5 + y, 0.5 - z, 0.5 + z];
    let bestI = 0;
    for (let i = 1; i < 6; i++) if (d[i] < d[bestI]) bestI = i;
    return bestI;
  };
}
function chestStrategy() {
  return ({ x, y, z }) => {
    if (y > 0.15) return 0; // lid
    const d = [0.5 - x, 0.5 + x, 0.5 + y, 0.5 - z, 0.5 + z];
    let bestI = 0;
    for (let i = 1; i < 5; i++) if (d[i] < d[bestI]) bestI = i;
    return bestI + 1;
  };
}
function anvilStrategy() {
  return ({ x, y }) => {
    if (y < -0.2) return 0; // base block
    if (x > 0.25) return 1; // heel
    if (x < -0.25) return 2; // horn
    if (y > 0.18) return 3; // top face
    return 4; // waist
  };
}

// ─────────────────────────────────────────────────────────────────────
// Prop registry
// ─────────────────────────────────────────────────────────────────────

const PROPS = [
  {
    name: "barrel.glb",
    source: "models/fantasy_props/Barrel.gltf",
    chunks: 8,
    strategy: angularStrategy(8),
  },
  {
    name: "pots.glb",
    source: "models/dungeon_kaykit/pots.glb",
    chunks: 8,
    strategy: angularStrategy(8),
  },
  {
    name: "crate.glb",
    source: "models/dungeon_kaykit/crate.glb",
    chunks: 6,
    strategy: sixFaceStrategy(),
  },
  {
    name: "pillar.glb",
    source: "models/dungeon_kaykit/pillar.glb",
    chunks: 6,
    strategy: ySlabsStrategy(6),
  },
  {
    name: "bookshelf.glb",
    source: "models/fantasy_props/Bookcase_2.gltf",
    chunks: 6, // 4 shelves + 2 sides
    strategy: bookshelfStrategy(4),
  },
  {
    name: "chest.glb",
    source: "models/fantasy_props/Chest_Wood.gltf",
    chunks: 6, // lid + 5 body
    strategy: chestStrategy(),
  },
  {
    name: "cauldron.glb",
    source: "models/fantasy_props/Cauldron.gltf",
    chunks: 6,
    strategy: angularStrategy(6),
  },
  {
    name: "anvil.glb",
    source: "models/fantasy_props/Anvil.gltf",
    chunks: 5,
    strategy: anvilStrategy(),
  },
];

// ─────────────────────────────────────────────────────────────────────
// glTF accessor / matrix helpers
// ─────────────────────────────────────────────────────────────────────

const COMPONENT_TYPE_BYTES = {
  5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4,
};
const TYPE_NUM_COMPONENTS = {
  SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16,
};

function readAccessor(gltf, buffers, accessorIndex) {
  const accessor = gltf.accessors[accessorIndex];
  const view = gltf.bufferViews[accessor.bufferView];
  const buffer = buffers[view.buffer];
  const numComps = TYPE_NUM_COMPONENTS[accessor.type];
  const compBytes = COMPONENT_TYPE_BYTES[accessor.componentType];
  const stride = view.byteStride || numComps * compBytes;
  const byteOffset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const count = accessor.count;
  const total = count * numComps;
  let out;
  switch (accessor.componentType) {
    case 5126: out = new Float32Array(total); break;
    case 5125: out = new Uint32Array(total); break;
    case 5123: out = new Uint16Array(total); break;
    case 5121: out = new Uint8Array(total); break;
    case 5122: out = new Int16Array(total); break;
    case 5120: out = new Int8Array(total); break;
    default: throw new Error(`Unsupported componentType ${accessor.componentType}`);
  }
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.length);
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < numComps; c++) {
      const off = byteOffset + i * stride + c * compBytes;
      switch (accessor.componentType) {
        case 5126: out[i * numComps + c] = dv.getFloat32(off, true); break;
        case 5125: out[i * numComps + c] = dv.getUint32(off, true); break;
        case 5123: out[i * numComps + c] = dv.getUint16(off, true); break;
        case 5121: out[i * numComps + c] = dv.getUint8(off); break;
        case 5122: out[i * numComps + c] = dv.getInt16(off, true); break;
        case 5120: out[i * numComps + c] = dv.getInt8(off); break;
      }
    }
  }
  return out;
}

function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}
function mat4Multiply(a, b) {
  const out = new Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}
function mat4FromTRS(t = [0, 0, 0], r = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = r;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const [sx, sy, sz] = s;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    t[0], t[1], t[2], 1,
  ];
}
function nodeMatrix(node) {
  if (node.matrix) return node.matrix.slice();
  return mat4FromTRS(node.translation, node.rotation, node.scale);
}
function transformPoint(m, p) {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}
function transformDir(m, d) {
  const [x, y, z] = d;
  return [
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z,
  ];
}

function collectMeshInstances(gltf) {
  const out = [];
  const sceneIdx = gltf.scene ?? 0;
  const scene = gltf.scenes[sceneIdx];
  function recurse(nodeIdx, parentMatrix) {
    const node = gltf.nodes[nodeIdx];
    const local = nodeMatrix(node);
    const world = mat4Multiply(parentMatrix, local);
    if (node.mesh != null) out.push({ meshIndex: node.mesh, matrix: world });
    if (node.children) for (const c of node.children) recurse(c, world);
  }
  for (const root of scene.nodes) recurse(root, mat4Identity());
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Source loader
//
// Parses the source's `.gltf` JSON + its single `.bin` buffer (for
// .glb inputs we go through glbToGltf first to extract both). Crucially
// we DO NOT inline image data — image URIs stay relative to the source
// directory so the output GLB can re-point them at the same files.
// ─────────────────────────────────────────────────────────────────────

async function loadSource(srcRelPath) {
  const abs = path.join(PUBLIC_ROOT, srcRelPath);
  const dir = path.dirname(abs);
  let gltf;
  let buffers = [];
  if (srcRelPath.endsWith(".glb")) {
    const buf = fs.readFileSync(abs);
    const result = await glbToGltf(buf);
    gltf = result.gltf;
    // glbToGltf converts the binary chunk into a data URI on buffer 0.
    buffers = gltf.buffers.map(decodeBuffer);
  } else {
    gltf = JSON.parse(fs.readFileSync(abs, "utf8"));
    buffers = (gltf.buffers || []).map((b) => {
      if (b.uri && b.uri.startsWith("data:")) return decodeBuffer(b);
      if (b.uri) return fs.readFileSync(path.join(dir, b.uri));
      throw new Error("Embedded GLB-style buffer in non-GLB input");
    });
  }
  return { gltf, buffers, sourceDir: dir };
}

function decodeBuffer(b) {
  if (!b.uri) return Buffer.alloc(b.byteLength || 0);
  const m = /^data:[^;]+;base64,(.*)$/.exec(b.uri);
  if (m) return Buffer.from(m[1], "base64");
  throw new Error(`Unsupported buffer uri: ${b.uri.slice(0, 60)}`);
}

// ─────────────────────────────────────────────────────────────────────
// Slicer — assigns each triangle to a chunk bucket per material
// ─────────────────────────────────────────────────────────────────────

function sliceProp(gltf, buffers, strategy, chunkCount) {
  const instances = collectMeshInstances(gltf);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const triangles = [];

  for (const inst of instances) {
    const mesh = gltf.meshes[inst.meshIndex];
    for (const prim of mesh.primitives) {
      const posIdx = prim.attributes.POSITION;
      if (posIdx == null) continue;
      const positions = readAccessor(gltf, buffers, posIdx);
      const normals = prim.attributes.NORMAL != null
        ? readAccessor(gltf, buffers, prim.attributes.NORMAL) : null;
      const uvs = prim.attributes.TEXCOORD_0 != null
        ? readAccessor(gltf, buffers, prim.attributes.TEXCOORD_0) : null;

      let indices;
      if (prim.indices != null) {
        indices = readAccessor(gltf, buffers, prim.indices);
      } else {
        const n = positions.length / 3;
        indices = new Uint32Array(n);
        for (let i = 0; i < n; i++) indices[i] = i;
      }

      const triCount = (indices.length / 3) | 0;
      for (let t = 0; t < triCount; t++) {
        const ia = indices[t * 3];
        const ib = indices[t * 3 + 1];
        const ic = indices[t * 3 + 2];
        const pA = transformPoint(inst.matrix, [positions[ia * 3], positions[ia * 3 + 1], positions[ia * 3 + 2]]);
        const pB = transformPoint(inst.matrix, [positions[ib * 3], positions[ib * 3 + 1], positions[ib * 3 + 2]]);
        const pC = transformPoint(inst.matrix, [positions[ic * 3], positions[ic * 3 + 1], positions[ic * 3 + 2]]);
        for (const p of [pA, pB, pC]) {
          if (p[0] < min[0]) min[0] = p[0];
          if (p[1] < min[1]) min[1] = p[1];
          if (p[2] < min[2]) min[2] = p[2];
          if (p[0] > max[0]) max[0] = p[0];
          if (p[1] > max[1]) max[1] = p[1];
          if (p[2] > max[2]) max[2] = p[2];
        }
        triangles.push({
          mat: prim.material ?? -1,
          pA, pB, pC,
          nA: normals ? transformDir(inst.matrix, [normals[ia * 3], normals[ia * 3 + 1], normals[ia * 3 + 2]]) : null,
          nB: normals ? transformDir(inst.matrix, [normals[ib * 3], normals[ib * 3 + 1], normals[ib * 3 + 2]]) : null,
          nC: normals ? transformDir(inst.matrix, [normals[ic * 3], normals[ic * 3 + 1], normals[ic * 3 + 2]]) : null,
          uvA: uvs ? [uvs[ia * 2], uvs[ia * 2 + 1]] : null,
          uvB: uvs ? [uvs[ib * 2], uvs[ib * 2 + 1]] : null,
          uvC: uvs ? [uvs[ic * 2], uvs[ic * 2 + 1]] : null,
        });
      }
    }
  }

  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const size = [Math.max(1e-4, max[0] - min[0]), Math.max(1e-4, max[1] - min[1]), Math.max(1e-4, max[2] - min[2])];

  const chunkBuckets = new Map(); // chunkIdx -> Map<matIdx, tri[]>
  for (const tri of triangles) {
    const cx = (tri.pA[0] + tri.pB[0] + tri.pC[0]) / 3 - center[0];
    const cy = (tri.pA[1] + tri.pB[1] + tri.pC[1]) / 3 - center[1];
    const cz = (tri.pA[2] + tri.pB[2] + tri.pC[2]) / 3 - center[2];
    const idx = strategy({ x: cx / size[0], y: cy / size[1], z: cz / size[2] });
    if (idx < 0 || idx >= chunkCount) continue;
    let perMat = chunkBuckets.get(idx);
    if (!perMat) { perMat = new Map(); chunkBuckets.set(idx, perMat); }
    let arr = perMat.get(tri.mat);
    if (!arr) { arr = []; perMat.set(tri.mat, arr); }
    arr.push(tri);
  }

  return chunkBuckets;
}

// ─────────────────────────────────────────────────────────────────────
// Build new gltf — geometry-only buffer, image URIs rewritten relative
// to the output directory so the heavy PBR atlases stay external and
// shared with the intact prop.
// ─────────────────────────────────────────────────────────────────────

function buildOutputGltf(srcGltf, sourceDir, outputDir, chunkBuckets) {
  // Determine which materials we actually use
  const usedMats = new Set();
  for (const perMat of chunkBuckets.values()) {
    for (const matIdx of perMat.keys()) if (matIdx >= 0) usedMats.add(matIdx);
  }

  // Track which textures/images/samplers each used material references
  const usedTex = new Set();
  function collectTexFromMat(mat) {
    const pbr = mat.pbrMetallicRoughness || {};
    if (pbr.baseColorTexture) usedTex.add(pbr.baseColorTexture.index);
    if (pbr.metallicRoughnessTexture) usedTex.add(pbr.metallicRoughnessTexture.index);
    if (mat.normalTexture) usedTex.add(mat.normalTexture.index);
    if (mat.occlusionTexture) usedTex.add(mat.occlusionTexture.index);
    if (mat.emissiveTexture) usedTex.add(mat.emissiveTexture.index);
  }
  for (const i of usedMats) collectTexFromMat(srcGltf.materials[i]);

  const usedImg = new Set();
  const usedSampler = new Set();
  for (const i of usedTex) {
    const tex = srcGltf.textures[i];
    if (tex.source != null) usedImg.add(tex.source);
    if (tex.sampler != null) usedSampler.add(tex.sampler);
  }

  // Build remap tables (old index -> new index)
  function remap(originalSet) {
    const map = new Map();
    let next = 0;
    for (const i of [...originalSet].sort((a, b) => a - b)) {
      map.set(i, next++);
    }
    return map;
  }
  const matMap = remap(usedMats);
  const texMap = remap(usedTex);
  const imgMap = remap(usedImg);
  const samMap = remap(usedSampler);

  // Compute relative path from output dir to source dir
  const relSrcDir = path.relative(outputDir, sourceDir).split(path.sep).join("/");

  // Build trimmed asset arrays
  const newImages = [];
  for (const oldIdx of [...usedImg].sort((a, b) => a - b)) {
    const img = srcGltf.images[oldIdx];
    const out = { name: img.name };
    if (img.mimeType) out.mimeType = img.mimeType;
    if (img.uri && !img.uri.startsWith("data:")) {
      // External PNG — rewrite URI to point to the source folder.
      out.uri = (relSrcDir ? relSrcDir + "/" : "") + img.uri;
    } else if (img.uri) {
      // Data URI image (rare for our sources) — keep as-is.
      out.uri = img.uri;
    } else {
      // Image was a bufferView reference. We'd have to embed the bytes
      // back into the new buffer. None of our current sources need this
      // path — KayKit has no images, fantasy_props uses URIs.
      throw new Error(`Image ${oldIdx} uses bufferView; not supported by this builder.`);
    }
    newImages.push(out);
  }

  const newSamplers = [];
  for (const oldIdx of [...usedSampler].sort((a, b) => a - b)) {
    newSamplers.push({ ...srcGltf.samplers[oldIdx] });
  }

  const newTextures = [];
  for (const oldIdx of [...usedTex].sort((a, b) => a - b)) {
    const tex = srcGltf.textures[oldIdx];
    const out = {};
    if (tex.source != null) out.source = imgMap.get(tex.source);
    if (tex.sampler != null) out.sampler = samMap.get(tex.sampler);
    newTextures.push(out);
  }

  const newMaterials = [];
  for (const oldIdx of [...usedMats].sort((a, b) => a - b)) {
    const m = JSON.parse(JSON.stringify(srcGltf.materials[oldIdx]));
    function remapTexRef(ref) {
      if (ref && ref.index != null) ref.index = texMap.get(ref.index);
    }
    if (m.pbrMetallicRoughness) {
      remapTexRef(m.pbrMetallicRoughness.baseColorTexture);
      remapTexRef(m.pbrMetallicRoughness.metallicRoughnessTexture);
    }
    remapTexRef(m.normalTexture);
    remapTexRef(m.occlusionTexture);
    remapTexRef(m.emissiveTexture);
    newMaterials.push(m);
  }

  // Build geometry buffer + bufferViews + accessors per chunk primitive
  const geomChunks = [];
  let geomOffset = 0;
  function pushGeometry(buf) {
    const padded = (buf.length + 3) & ~3;
    if (padded > buf.length) {
      buf = Buffer.concat([buf, Buffer.alloc(padded - buf.length)]);
    }
    const off = geomOffset;
    geomChunks.push(buf);
    geomOffset += buf.length;
    return off;
  }

  const newBufferViews = [];
  const newAccessors = [];
  function addBufferView(byteOffset, byteLength, target) {
    const bv = { buffer: 0, byteOffset, byteLength };
    if (target != null) bv.target = target;
    newBufferViews.push(bv);
    return newBufferViews.length - 1;
  }
  function addAccessor(bv, type, componentType, count, min, max) {
    const acc = { bufferView: bv, componentType, count, type };
    if (min) acc.min = min;
    if (max) acc.max = max;
    newAccessors.push(acc);
    return newAccessors.length - 1;
  }

  const newMeshes = [];
  const newNodes = [];
  for (const [chunkIdx, perMat] of [...chunkBuckets.entries()].sort((a, b) => a[0] - b[0])) {
    const primitives = [];
    for (const [matIdx, tris] of perMat.entries()) {
      const N = tris.length * 3;
      const positions = new Float32Array(N * 3);
      const normals = new Float32Array(N * 3);
      const uvs = new Float32Array(N * 2);
      const hasNormals = tris[0].nA != null;
      const hasUvs = tris[0].uvA != null;
      const posMin = [Infinity, Infinity, Infinity];
      const posMax = [-Infinity, -Infinity, -Infinity];
      for (let t = 0; t < tris.length; t++) {
        const tri = tris[t];
        const verts = [
          [tri.pA, tri.nA, tri.uvA],
          [tri.pB, tri.nB, tri.uvB],
          [tri.pC, tri.nC, tri.uvC],
        ];
        for (let v = 0; v < 3; v++) {
          const [pos, n, uv] = verts[v];
          const i = t * 3 + v;
          positions[i * 3] = pos[0];
          positions[i * 3 + 1] = pos[1];
          positions[i * 3 + 2] = pos[2];
          if (hasNormals && n) {
            normals[i * 3] = n[0];
            normals[i * 3 + 1] = n[1];
            normals[i * 3 + 2] = n[2];
          }
          if (hasUvs && uv) {
            uvs[i * 2] = uv[0];
            uvs[i * 2 + 1] = uv[1];
          }
          for (let k = 0; k < 3; k++) {
            if (pos[k] < posMin[k]) posMin[k] = pos[k];
            if (pos[k] > posMax[k]) posMax[k] = pos[k];
          }
        }
      }

      const posOff = pushGeometry(Buffer.from(positions.buffer));
      const posBV = addBufferView(posOff, positions.byteLength, 34962);
      const posAcc = addAccessor(posBV, "VEC3", 5126, N, posMin, posMax);
      const attributes = { POSITION: posAcc };
      if (hasNormals) {
        const normOff = pushGeometry(Buffer.from(normals.buffer));
        const normBV = addBufferView(normOff, normals.byteLength, 34962);
        attributes.NORMAL = addAccessor(normBV, "VEC3", 5126, N);
      }
      if (hasUvs) {
        const uvOff = pushGeometry(Buffer.from(uvs.buffer));
        const uvBV = addBufferView(uvOff, uvs.byteLength, 34962);
        attributes.TEXCOORD_0 = addAccessor(uvBV, "VEC2", 5126, N);
      }

      const prim = { attributes };
      if (matIdx >= 0 && matMap.has(matIdx)) prim.material = matMap.get(matIdx);
      primitives.push(prim);
    }
    if (primitives.length === 0) continue;
    const meshIdx = newMeshes.length;
    newMeshes.push({ name: `chunk_${chunkIdx}`, primitives });
    newNodes.push({ name: `chunk_${chunkIdx}`, mesh: meshIdx });
  }

  const geomBuffer = Buffer.concat(geomChunks);
  const out = {
    asset: { version: "2.0", generator: "build-fracture-glbs.cjs" },
    scene: 0,
    scenes: [{ nodes: newNodes.map((_, i) => i) }],
    nodes: newNodes,
    meshes: newMeshes,
    buffers: [{ byteLength: geomBuffer.length }],
    bufferViews: newBufferViews,
    accessors: newAccessors,
  };
  if (newMaterials.length) out.materials = newMaterials;
  if (newTextures.length) out.textures = newTextures;
  if (newSamplers.length) out.samplers = newSamplers;
  if (newImages.length) out.images = newImages;

  return { gltf: out, bin: geomBuffer };
}

// ─────────────────────────────────────────────────────────────────────
// GLB writer (12-byte header + JSON chunk + BIN chunk)
// ─────────────────────────────────────────────────────────────────────

function writeGlb(gltfJson, binBuffer) {
  const jsonStr = JSON.stringify(gltfJson);
  // Pad JSON to 4-byte boundary with spaces (0x20)
  let jsonPad = (4 - (jsonStr.length % 4)) % 4;
  const json = Buffer.concat([Buffer.from(jsonStr, "utf8"), Buffer.alloc(jsonPad, 0x20)]);

  // Pad BIN to 4-byte boundary with zeros
  const binPad = (4 - (binBuffer.length % 4)) % 4;
  const bin = binPad
    ? Buffer.concat([binBuffer, Buffer.alloc(binPad, 0)])
    : binBuffer;

  const total = 12 + 8 + json.length + 8 + bin.length;
  const out = Buffer.alloc(total);
  let off = 0;
  out.writeUInt32LE(0x46546c67, off); off += 4; // 'glTF'
  out.writeUInt32LE(2, off); off += 4;          // version
  out.writeUInt32LE(total, off); off += 4;      // total length

  out.writeUInt32LE(json.length, off); off += 4;
  out.writeUInt32LE(0x4e4f534a, off); off += 4; // 'JSON'
  json.copy(out, off); off += json.length;

  out.writeUInt32LE(bin.length, off); off += 4;
  out.writeUInt32LE(0x004e4942, off); off += 4; // 'BIN\0'
  bin.copy(out, off); off += bin.length;

  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`Building fracture GLBs into ${OUT_DIR}`);
  for (const prop of PROPS) {
    process.stdout.write(`  ${prop.name.padEnd(15)} ← ${prop.source} ... `);
    const { gltf: srcGltf, buffers: srcBuffers, sourceDir } = await loadSource(prop.source);
    const chunkBuckets = sliceProp(srcGltf, srcBuffers, prop.strategy, prop.chunks);
    const { gltf: outGltf, bin } = buildOutputGltf(srcGltf, sourceDir, OUT_DIR, chunkBuckets);
    const glb = writeGlb(outGltf, bin);
    const outPath = path.join(OUT_DIR, prop.name);
    fs.writeFileSync(outPath, glb);
    const totalTris = [...chunkBuckets.values()]
      .flatMap((m) => [...m.values()])
      .reduce((s, a) => s + a.length, 0);
    console.log(`${chunkBuckets.size} chunks, ${totalTris} tris, ${glb.length} bytes`);
  }
  console.log("Done.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
