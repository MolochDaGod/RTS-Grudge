const fs = require('fs');
const path = require('path');

if (typeof document === 'undefined') {
  class FakeEventTarget {
    constructor() { this._listeners = {}; }
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
    removeEventListener(type, fn) { if (this._listeners[type]) this._listeners[type] = this._listeners[type].filter(f => f !== fn); }
    dispatchEvent(event) { (this._listeners[event.type] || []).forEach(fn => fn(event)); }
  }
  class FakeImage extends FakeEventTarget {
    constructor() { super(); this.width = 1; this.height = 1; this.complete = false; this.naturalWidth = 1; this.naturalHeight = 1; }
    set src(val) { this._src = val; this.complete = true; setTimeout(() => { this.dispatchEvent({ type: 'load', target: this }); if (this.onload) this.onload({ type: 'load', target: this }); }, 0); }
    get src() { return this._src || ''; }
  }
  class FakeCanvas extends FakeEventTarget {
    constructor() { super(); this.width = 1; this.height = 1; this.style = {}; }
    getContext() { return { canvas: this, fillRect: () => {}, clearRect: () => {}, drawImage: () => {}, getImageData: () => ({ data: new Uint8Array(4) }), putImageData: () => {}, createImageData: () => ({ data: new Uint8Array(4) }), createLinearGradient: () => ({ addColorStop: () => {} }), createRadialGradient: () => ({ addColorStop: () => {} }), measureText: () => ({ width: 0 }), scale: () => {}, translate: () => {}, rotate: () => {}, save: () => {}, restore: () => {}, beginPath: () => {}, closePath: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, arc: () => {}, rect: () => {}, clip: () => {}, setTransform: () => {}, createPattern: () => ({}) }; }
    toDataURL() { return 'data:image/png;base64,iVBOR'; }
    toBlob(cb) { cb(new Blob([''], { type: 'image/png' })); }
  }
  global.window = global.window || global;
  global.document = { createElement: (tag) => tag === 'canvas' ? new FakeCanvas() : new FakeImage(), createElementNS: () => new FakeImage(), body: { appendChild: () => {}, removeChild: () => {} }, URL: { createObjectURL: () => '', revokeObjectURL: () => {} } };
  global.HTMLCanvasElement = FakeCanvas;
  global.Image = FakeImage;
  global.Blob = global.Blob || class Blob { constructor(parts, opts) { this.parts = parts; this.type = opts?.type; } };
  global.atob = global.atob || ((str) => Buffer.from(str, 'base64').toString('binary'));
  global.btoa = global.btoa || ((str) => Buffer.from(str, 'binary').toString('base64'));
  global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  global.OffscreenCanvas = class OffscreenCanvas extends FakeCanvas { constructor(w, h) { super(); this.width = w; this.height = h; } };
  global.createImageBitmap = async () => new FakeImage();
}

const THREE = require('three');
const { FBXLoader } = require('three/examples/jsm/loaders/FBXLoader.js');

function sanitizeName(name) { return name ? name.replace(/:/g, '') : name; }

function buildSimpleGlb(fbxScene) {
  const gltf = {
    asset: { version: "2.0", generator: "pack-converter" },
    scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [],
    accessors: [], bufferViews: [], buffers: [], materials: [],
  };
  const bufferChunks = [];
  let byteOffset = 0;

  function addBufferView(data, target) {
    const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const padding = (4 - (bytes.length % 4)) % 4;
    const paddedBytes = padding > 0 ? Buffer.concat([bytes, Buffer.alloc(padding)]) : bytes;
    const viewIdx = gltf.bufferViews.length;
    gltf.bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length, ...(target ? { target } : {}) });
    byteOffset += paddedBytes.length;
    bufferChunks.push(paddedBytes);
    return viewIdx;
  }

  function addAccessor(data, type, componentType, target) {
    const viewIdx = addBufferView(data, target);
    const elemSize = type === "SCALAR" ? 1 : type === "VEC2" ? 2 : type === "VEC3" ? 3 : type === "VEC4" ? 4 : 1;
    const count = data.length / elemSize;
    const acc = { bufferView: viewIdx, componentType: componentType || 5126, count, type };
    if (type === "VEC3" || type === "VEC2" || type === "SCALAR") {
      const min = new Array(elemSize).fill(Infinity);
      const max = new Array(elemSize).fill(-Infinity);
      for (let i = 0; i < data.length; i++) { const c = i % elemSize; if (data[i] < min[c]) min[c] = data[i]; if (data[i] > max[c]) max[c] = data[i]; }
      acc.min = min; acc.max = max;
    }
    gltf.accessors.push(acc);
    return gltf.accessors.length - 1;
  }

  const materialMap = new Map();
  function getOrCreateMaterial(mat) {
    if (!mat) return 0;
    const key = mat.uuid || mat.name || 'default';
    if (materialMap.has(key)) return materialMap.get(key);
    const gltfMat = { name: sanitizeName(mat.name) || `mat_${gltf.materials.length}` };
    const pbr = {};
    if (mat.color) pbr.baseColorFactor = [mat.color.r, mat.color.g, mat.color.b, mat.opacity !== undefined ? mat.opacity : 1.0];
    if (mat.roughness !== undefined) pbr.roughnessFactor = mat.roughness;
    if (mat.metalness !== undefined) pbr.metallicFactor = mat.metalness;
    gltfMat.pbrMetallicRoughness = pbr;
    if (mat.transparent || (mat.opacity !== undefined && mat.opacity < 1.0)) { gltfMat.alphaMode = "BLEND"; }
    if (mat.side === THREE.DoubleSide) gltfMat.doubleSided = true;
    const idx = gltf.materials.length;
    gltf.materials.push(gltfMat);
    materialMap.set(key, idx);
    return idx;
  }

  if (gltf.materials.length === 0) gltf.materials.push({ name: "default", pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1.0] } });

  fbxScene.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const geo = child.geometry;
    const pos = geo.attributes.position;
    if (!pos || pos.count === 0) return;

    child.updateMatrixWorld(true);
    const clonedGeo = geo.clone();
    clonedGeo.applyMatrix4(child.matrixWorld);

    const posData = new Float32Array(clonedGeo.attributes.position.array);
    const primitives = [];
    const prim = { attributes: { POSITION: addAccessor(posData, "VEC3", 5126, 34962) } };

    if (clonedGeo.attributes.normal) {
      const normData = new Float32Array(clonedGeo.attributes.normal.array);
      prim.attributes.NORMAL = addAccessor(normData, "VEC3", 5126, 34962);
    }
    if (clonedGeo.attributes.uv) {
      const uvData = new Float32Array(clonedGeo.attributes.uv.array);
      prim.attributes.TEXCOORD_0 = addAccessor(uvData, "VEC2", 5126, 34962);
    }
    if (clonedGeo.attributes.color) {
      const colData = new Float32Array(clonedGeo.attributes.color.array);
      const elemSize = clonedGeo.attributes.color.itemSize;
      prim.attributes.COLOR_0 = addAccessor(colData, elemSize === 4 ? "VEC4" : "VEC3", 5126, 34962);
    }
    if (clonedGeo.index) {
      const indexData = clonedGeo.index.count > 65535 ? new Uint32Array(clonedGeo.index.array) : new Uint16Array(clonedGeo.index.array);
      prim.indices = addAccessor(indexData, "SCALAR", indexData instanceof Uint32Array ? 5125 : 5123, 34963);
    }

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    prim.material = getOrCreateMaterial(mats[0]);
    primitives.push(prim);

    const meshIdx = gltf.meshes.length;
    gltf.meshes.push({ name: sanitizeName(child.name) || `mesh_${meshIdx}`, primitives });
    const nodeIdx = gltf.nodes.length;
    gltf.nodes.push({ name: sanitizeName(child.name) || `node_${nodeIdx}`, mesh: meshIdx });
    gltf.scenes[0].nodes.push(nodeIdx);
  });

  if (gltf.meshes.length === 0) return null;

  const totalBuffer = Buffer.concat(bufferChunks);
  gltf.buffers = [{ byteLength: totalBuffer.length }];

  const jsonStr = JSON.stringify(gltf);
  const jsonBuf = Buffer.from(jsonStr);
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const paddedJson = jsonPad > 0 ? Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]) : jsonBuf;
  const binPad = (4 - (totalBuffer.length % 4)) % 4;
  const paddedBin = binPad > 0 ? Buffer.concat([totalBuffer, Buffer.alloc(binPad)]) : totalBuffer;

  const headerSize = 12;
  const jsonChunkHeader = 8;
  const binChunkHeader = 8;
  const totalSize = headerSize + jsonChunkHeader + paddedJson.length + binChunkHeader + paddedBin.length;

  const result = Buffer.alloc(totalSize);
  result.writeUInt32LE(0x46546C67, 0);
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(totalSize, 8);
  result.writeUInt32LE(paddedJson.length, 12);
  result.writeUInt32LE(0x4E4F534A, 16);
  paddedJson.copy(result, 20);
  const binOffset = 20 + paddedJson.length;
  result.writeUInt32LE(paddedBin.length, binOffset);
  result.writeUInt32LE(0x004E4942, binOffset + 4);
  paddedBin.copy(result, binOffset + 8);

  return result;
}

const CONVERSIONS = [
  { src: '/tmp/asset_unpack/EEE_-_Gem_Asset_Pack/.fbx Files', dest: 'client/public/models/gems' },
  { src: '/tmp/asset_unpack/EEE_-_Low_Poly_Foliage_Pack_001/Low_Poly_Foliage_Pack_001/FBX Files', dest: 'client/public/models/foliage' },
  { src: '/tmp/asset_unpack/free-environment-props-3d-low-poly-models/FBX', dest: 'client/public/models/env_props' },
  { src: '/tmp/asset_unpack/Free_Medieval_3D_People_Low_Poly_Pack/fbx/unral_better_export', dest: 'client/public/models/medieval_people' },
  { src: '/tmp/asset_unpack/medieval_props/Fbx', dest: 'client/public/models/medieval_props' },
  { src: '/tmp/asset_unpack/dungeon/Free Modular Low Poly Dungeon', dest: 'client/public/models/dungeon_modular' },
  { src: '/tmp/asset_unpack/weapon_pack/Low Poly Weapon Pack - by Kickin It Studios', dest: 'client/public/models/weapon_pack' },
  { src: '/tmp/asset_unpack/encampment', dest: 'client/public/models/encampment' },
];

const loader = new FBXLoader();
let totalConverted = 0;
let totalFailed = 0;

for (const conv of CONVERSIONS) {
  if (!fs.existsSync(conv.src)) {
    console.log(`SKIP (not found): ${conv.src}`);
    continue;
  }
  fs.mkdirSync(conv.dest, { recursive: true });
  const fbxFiles = fs.readdirSync(conv.src).filter(f => f.toLowerCase().endsWith('.fbx'));
  console.log(`\n=== ${path.basename(conv.dest)} === (${fbxFiles.length} FBX files)`);

  for (const fbxFile of fbxFiles) {
    const fbxPath = path.join(conv.src, fbxFile);
    const glbName = fbxFile.replace(/\.fbx$/i, '.glb').replace(/\.fbx_/i, '_').replace(/^Low Poly Weapon Pack.*\.fbx_/, '');
    const glbPath = path.join(conv.dest, glbName);

    try {
      const fbxData = fs.readFileSync(fbxPath);
      const arrayBuf = fbxData.buffer.slice(fbxData.byteOffset, fbxData.byteOffset + fbxData.byteLength);
      const scene = loader.parse(arrayBuf, '');
      const glb = buildSimpleGlb(scene);
      if (glb) {
        fs.writeFileSync(glbPath, glb);
        totalConverted++;
        process.stdout.write('.');
      } else {
        console.log(`  EMPTY: ${fbxFile}`);
      }
    } catch (err) {
      totalFailed++;
      console.log(`  FAIL: ${fbxFile} - ${err.message?.substring(0, 80)}`);
    }
  }
}

console.log(`\n\nDone! Converted: ${totalConverted}, Failed: ${totalFailed}`);
