/**
 * convert-craftpix-lowpoly.cjs
 *
 * Converts the Craftpix "Medieval Weapons 3D Low Poly Models" FBX pack
 * into GLB files placed in client/public/models/craftpix_lowpoly/.
 *
 * Source: D:\Games\Models\craftpix_medieval_weapons\FBX\fbx_ordinar_full\
 * Rigged siege: D:\Games\Models\craftpix_medieval_weapons\FBX\rig_unity\
 *
 * Usage:
 *   node scripts/convert-craftpix-lowpoly.cjs [--force]
 */

const fs = require('fs');
const path = require('path');

// ── DOM shims (same as convert-models-to-glb.cjs) ──
if (typeof document === 'undefined') {
  class FakeEventTarget {
    constructor() { this._listeners = {}; }
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
    removeEventListener(type, fn) { if (this._listeners[type]) this._listeners[type] = this._listeners[type].filter(f => f !== fn); }
    dispatchEvent(event) { (this._listeners[event.type] || []).forEach(fn => fn(event)); }
  }
  class FakeImage extends FakeEventTarget {
    constructor() { super(); this.width = 1; this.height = 1; this.data = null; this.complete = false; this.naturalWidth = 1; this.naturalHeight = 1; }
    set src(val) { this._src = val; this.complete = true; setTimeout(() => { this.dispatchEvent({ type: 'load', target: this }); if (this.onload) this.onload({ type: 'load', target: this }); }, 0); }
    get src() { return this._src || ''; }
  }
  class FakeCanvas extends FakeEventTarget {
    constructor() { super(); this.width = 1; this.height = 1; this.style = {}; }
    getContext() {
      return { canvas: this, fillRect: () => {}, clearRect: () => {}, drawImage: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData: () => {},
        createImageData: () => ({ data: new Uint8ClampedArray(4) }),
        setTransform: () => {}, resetTransform: () => {}, measureText: () => ({ width: 0 }),
        fillText: () => {}, scale: () => {}, translate: () => {}, rotate: () => {},
        save: () => {}, restore: () => {}, beginPath: () => {}, moveTo: () => {},
        lineTo: () => {}, closePath: () => {}, stroke: () => {}, fill: () => {},
        arc: () => {}, rect: () => {}, clip: () => {} };
    }
    toDataURL() { return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; }
  }
  global.document = {
    createElement: (tag) => tag === 'canvas' ? new FakeCanvas() : tag === 'img' ? new FakeImage() : new FakeEventTarget(),
    createElementNS: (ns, tag) => { const el = tag === 'canvas' ? new FakeCanvas() : tag === 'img' ? new FakeImage() : new FakeEventTarget(); el.style = el.style || {}; return el; },
    body: { appendChild: () => {}, removeChild: () => {} },
  };
  global.window = global; global.self = global;
  global.navigator = { userAgent: 'node', platform: 'node' };
  global.HTMLCanvasElement = FakeCanvas; global.HTMLImageElement = FakeImage;
  global.ImageData = class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } };
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

// ── Paths ──
const SRC_DIR = path.resolve('D:/Games/Models/craftpix_medieval_weapons/FBX/fbx_ordinar_full');
const SRC_RIG_DIR = path.resolve('D:/Games/Models/craftpix_medieval_weapons/FBX/rig_unity');
const OUT_DIR = path.resolve(__dirname, '../client/public/models/craftpix_lowpoly');
const TEX_SRC = path.resolve('D:/Games/Models/craftpix_medieval_weapons/texture/Texture_MAp.png');
const TEX_DST = path.resolve(OUT_DIR, 'texture_map.png');

function sanitize(name) { return name ? name.replace(/:/g, '') : name; }

// ── Minimal GLB builder (same as convert-models-to-glb.cjs) ──
function buildMeshGlb(fbxScene, clips) {
  const gltf = {
    asset: { version: '2.0', generator: 'craftpix-lowpoly-converter' },
    scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [],
    accessors: [], bufferViews: [], buffers: [], materials: [], animations: [],
  };
  const bufferChunks = []; let byteOffset = 0;

  function addBufferView(data, target) {
    const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const padding = (4 - (bytes.length % 4)) % 4;
    const padded = padding > 0 ? Buffer.concat([bytes, Buffer.alloc(padding)]) : bytes;
    const idx = gltf.bufferViews.length;
    const bv = { buffer: 0, byteOffset, byteLength: bytes.length };
    if (target) bv.target = target;
    gltf.bufferViews.push(bv); byteOffset += padded.length; bufferChunks.push(padded);
    return idx;
  }
  function addAccessor(data, type, componentType, target) {
    const viewIdx = addBufferView(data, target);
    const elemSize = type === 'SCALAR' ? 1 : type === 'VEC2' ? 2 : type === 'VEC3' ? 3 : type === 'VEC4' ? 4 : 1;
    const count = data.length / elemSize;
    const acc = { bufferView: viewIdx, componentType: componentType || 5126, count, type };
    if (type === 'VEC3' || type === 'VEC2' || type === 'SCALAR') {
      const min = new Array(elemSize).fill(Infinity), max = new Array(elemSize).fill(-Infinity);
      for (let i = 0; i < data.length; i++) { const c = i % elemSize; if (data[i] < min[c]) min[c] = data[i]; if (data[i] > max[c]) max[c] = data[i]; }
      acc.min = min; acc.max = max;
    }
    gltf.accessors.push(acc); return gltf.accessors.length - 1;
  }

  const materialMap = new Map();
  function getOrCreateMaterial(mat) {
    if (!mat) return 0;
    const key = mat.uuid || mat.name || 'default';
    if (materialMap.has(key)) return materialMap.get(key);
    const gltfMat = { name: sanitize(mat.name) || `material_${gltf.materials.length}` };
    const pbr = {};
    pbr.baseColorFactor = mat.color ? [mat.color.r, mat.color.g, mat.color.b, mat.opacity ?? 1.0] : [0.8, 0.8, 0.8, 1.0];
    pbr.roughnessFactor = mat.roughness ?? 0.8;
    pbr.metallicFactor = mat.metalness ?? 0.0;
    gltfMat.pbrMetallicRoughness = pbr;
    if (mat.transparent) gltfMat.alphaMode = 'BLEND';
    if (mat.side === THREE.DoubleSide) gltfMat.doubleSided = true;
    const idx = gltf.materials.length; gltf.materials.push(gltfMat); materialMap.set(key, idx); return idx;
  }

  // Bones
  const boneNodeIndices = new Map(); const boneList = [];
  fbxScene.traverse(c => { if (c.isBone) boneList.push(c); });
  if (boneList.length > 0) {
    for (const bone of boneList) {
      const nodeIdx = gltf.nodes.length; boneNodeIndices.set(bone, nodeIdx);
      const node = { name: sanitize(bone.name) };
      if (bone.position && (bone.position.x || bone.position.y || bone.position.z)) node.translation = [bone.position.x, bone.position.y, bone.position.z];
      if (bone.quaternion && (bone.quaternion.x || bone.quaternion.y || bone.quaternion.z || bone.quaternion.w !== 1)) node.rotation = [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w];
      if (bone.scale && (bone.scale.x !== 1 || bone.scale.y !== 1 || bone.scale.z !== 1)) node.scale = [bone.scale.x, bone.scale.y, bone.scale.z];
      const childIndices = [];
      for (const child of bone.children) { if (child.isBone) childIndices.push(gltf.nodes.length + boneList.indexOf(child) - boneList.indexOf(bone)); }
      if (childIndices.length > 0) node.children = childIndices;
      gltf.nodes.push(node);
    }
    // InverseBindMatrices + skin
    const ibmData = new Float32Array(boneList.length * 16);
    for (let i = 0; i < boneList.length; i++) {
      const m = new THREE.Matrix4(); boneList[i].updateWorldMatrix(true, false);
      m.copy(boneList[i].matrixWorld).invert();
      ibmData.set(m.elements, i * 16);
    }
    const ibmAccessor = addAccessor(ibmData, 'MAT4', 5126);
    gltf.skins = [{ inverseBindMatrices: ibmAccessor, joints: boneList.map(b => boneNodeIndices.get(b)) }];
  }
  const skinIdx = gltf.skins ? 0 : -1;

  // Meshes
  let totalVertices = 0, totalTriangles = 0, meshCount = 0;
  fbxScene.traverse(child => {
    if (!child.isMesh) return;
    const mesh = child; const geo = mesh.geometry; meshCount++;
    const posAttr = geo.attributes.position; if (!posAttr) return;
    totalVertices += posAttr.count;
    const primitives = []; const attributes = {};
    attributes.POSITION = addAccessor(new Float32Array(posAttr.array), 'VEC3', 5126, 34962);
    if (geo.attributes.normal) attributes.NORMAL = addAccessor(new Float32Array(geo.attributes.normal.array), 'VEC3', 5126, 34962);
    if (geo.attributes.uv) attributes.TEXCOORD_0 = addAccessor(new Float32Array(geo.attributes.uv.array), 'VEC2', 5126, 34962);
    if (geo.attributes.color) attributes.COLOR_0 = addAccessor(new Float32Array(geo.attributes.color.array), geo.attributes.color.itemSize === 4 ? 'VEC4' : 'VEC3', 5126, 34962);
    // Skinning
    const skinIdxAttr = geo.attributes.skinIndex, skinWeightAttr = geo.attributes.skinWeight;
    if (skinIdx >= 0 && skinIdxAttr && skinWeightAttr) {
      const jointData = new Uint16Array(skinIdxAttr.array.length);
      for (let i = 0; i < skinIdxAttr.array.length; i++) jointData[i] = Math.floor(skinIdxAttr.array[i]);
      attributes.JOINTS_0 = addAccessor(jointData, 'VEC4', 5123, 34962);
      attributes.WEIGHTS_0 = addAccessor(new Float32Array(skinWeightAttr.array), 'VEC4', 5126, 34962);
    }
    const primitive = { attributes };
    if (geo.index) {
      const indexData = geo.index.count > 65535 ? new Uint32Array(geo.index.array) : new Uint16Array(geo.index.array);
      primitive.indices = addAccessor(indexData, 'SCALAR', geo.index.count > 65535 ? 5125 : 5123, 34963);
      totalTriangles += geo.index.count / 3;
    } else { totalTriangles += posAttr.count / 3; }
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    primitive.material = getOrCreateMaterial(mat);
    primitives.push(primitive);
    const meshIdx = gltf.meshes.length;
    gltf.meshes.push({ name: sanitize(child.name) || `mesh_${meshIdx}`, primitives });
    const nodeIdx = gltf.nodes.length;
    const node = { name: sanitize(child.name) || `node_${nodeIdx}`, mesh: meshIdx };
    if (child.position && (child.position.x || child.position.y || child.position.z)) node.translation = [child.position.x, child.position.y, child.position.z];
    if (child.quaternion && (child.quaternion.x || child.quaternion.y || child.quaternion.z || child.quaternion.w !== 1)) node.rotation = [child.quaternion.x, child.quaternion.y, child.quaternion.z, child.quaternion.w];
    if (child.scale && (child.scale.x !== 1 || child.scale.y !== 1 || child.scale.z !== 1)) node.scale = [child.scale.x, child.scale.y, child.scale.z];
    if (skinIdx >= 0 && child.isSkinnedMesh) node.skin = skinIdx;
    gltf.nodes.push(node); gltf.scenes[0].nodes.push(nodeIdx);
  });

  // Animations
  if (clips && clips.length > 0) {
    const boneNames = boneList.map(b => sanitize(b.name));
    for (const clip of clips) {
      const animation = { name: sanitize(clip.name) || 'Animation', channels: [], samplers: [] };
      for (const track of clip.tracks) {
        const parts = sanitize(track.name).split('.'); const boneName = parts.slice(0, -1).join('.'); const property = parts[parts.length - 1];
        let nodeIdx = -1;
        for (let i = 0; i < boneNames.length; i++) { if (boneNames[i] === boneName || boneNames[i].toLowerCase() === boneName.toLowerCase()) { nodeIdx = boneNodeIndices.get(boneList[i]); break; } }
        if (nodeIdx === -1) continue;
        let targetPath, valueType;
        if (property === 'position') { targetPath = 'translation'; valueType = 'VEC3'; }
        else if (property === 'quaternion') { targetPath = 'rotation'; valueType = 'VEC4'; }
        else if (property === 'scale') { targetPath = 'scale'; valueType = 'VEC3'; }
        else continue;
        const timeAcc = addAccessor(new Float32Array(track.times), 'SCALAR');
        const valueAcc = addAccessor(new Float32Array(track.values), valueType);
        const samplerIdx = animation.samplers.length;
        animation.samplers.push({ input: timeAcc, output: valueAcc, interpolation: 'LINEAR' });
        animation.channels.push({ sampler: samplerIdx, target: { node: nodeIdx, path: targetPath } });
      }
      if (animation.channels.length > 0) gltf.animations.push(animation);
    }
  }

  if (gltf.materials.length === 0) gltf.materials.push({ name: 'default', pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1.0], roughnessFactor: 0.8, metallicFactor: 0.0 } });

  const allBuf = Buffer.concat(bufferChunks.length > 0 ? bufferChunks : [Buffer.alloc(0)]);
  gltf.buffers.push({ byteLength: allBuf.length });

  const jsonStr = JSON.stringify(gltf);
  const jsonBuf = Buffer.from(jsonStr, 'utf8');
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const paddedJson = jsonPad > 0 ? Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]) : jsonBuf;
  const binPad = (4 - (allBuf.length % 4)) % 4;
  const paddedBin = binPad > 0 ? Buffer.concat([allBuf, Buffer.alloc(binPad, 0x00)]) : allBuf;
  const totalLength = 12 + 8 + paddedJson.length + 8 + paddedBin.length;

  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546C67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(totalLength, 8);
  const jsonH = Buffer.alloc(8); jsonH.writeUInt32LE(paddedJson.length, 0); jsonH.writeUInt32LE(0x4E4F534A, 4);
  const binH = Buffer.alloc(8); binH.writeUInt32LE(paddedBin.length, 0); binH.writeUInt32LE(0x004E4942, 4);

  return {
    glb: Buffer.concat([header, jsonH, paddedJson, binH, paddedBin]),
    stats: { vertices: totalVertices, triangles: totalTriangles, meshes: meshCount, bones: boneList.length, animations: clips ? clips.length : 0 },
  };
}

// ── File map: source FBX name → output GLB name ──
const FILES_STATIC = {
  // Hand-held weapons
  '_SWORD_1.fbx':          'Sword_1.glb',
  '_SWORD_2.fbx':          'Sword_2.glb',
  '_SWORD_3.fbx':          'Sword_3.glb',
  '_AXE.fbx':              'Axe.glb',
  '_MACE.fbx':             'Mace.glb',
  '_BATON.fbx':            'Baton.glb',
  '_SPEAR.fbx':            'Spear.glb',
  '_HALBERT.fbx':          'Halberd.glb',
  '_POLEAXE.fbx':          'Poleaxe.glb',
  '_BOW.fbx':              'Bow.glb',
  '_CROSSBOW.fbx':         'Crossbow.glb',
  '_SHIELD_1.fbx':         'Shield_1.glb',
  '_SHIELD_2.fbx':         'Shield_2.glb',
  // Ammo / arrows
  '_BOW_ARROW.fbx':        'Bow_Arrow.glb',
  '_CROSSBOW_ARROW.fbx':   'Crossbow_Arrow.glb',
  '_BIG_CROSSBOW_ARROW.fbx': 'Big_Crossbow_Arrow.glb',
  // Siege / world assets
  '_CATAPULT.fbx':         'Catapult.glb',
  'CATAPULT_STONE.fbx':    'Catapult_Stone.glb',
  '_big_crossbow.fbx':     'Ballista.glb',
  '_BATTERING_RAM.fbx':    'Battering_Ram.glb',
  // Training / decoration
  '_TARGET_1.fbx':         'Target_Dummy.glb',
  '_TARGET_2.fbx':         'Target_Board.glb',
  '_DARTBOARD.fbx':        'Dartboard.glb',
  '_WEAPON_STAND.fbx':     'Weapon_Stand.glb',
};

const FILES_RIGGED = {
  'catapult_rig.fbx':      'Catapult_Rig.glb',
  'battering_ram.fbx':     'Battering_Ram_Rig.glb',
  'big_crossbow_rig.fbx':  'Ballista_Rig.glb',
  'bow_rig.fbx':           'Bow_Rig.glb',
  'crossbow_rig.fbx':      'Crossbow_Rig.glb',
};

function convertFile(fbxPath, outPath) {
  const buffer = fs.readFileSync(fbxPath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const loader = new FBXLoader();
  const fbxScene = loader.parse(arrayBuffer, path.dirname(fbxPath) + '/');
  const clips = fbxScene.animations || [];
  const { glb, stats } = buildMeshGlb(fbxScene, clips);
  fs.writeFileSync(outPath, glb);
  return stats;
}

async function main() {
  const force = process.argv.includes('--force');
  console.log('\n=== Craftpix Low-Poly Medieval Weapons → GLB ===\n');

  // Copy texture atlas
  if (!fs.existsSync(TEX_DST) || force) {
    fs.copyFileSync(TEX_SRC, TEX_DST);
    console.log(`✓ Texture copied → ${path.basename(TEX_DST)}`);
  }

  let converted = 0, skipped = 0, failed = 0;

  // Static meshes
  for (const [src, dst] of Object.entries(FILES_STATIC)) {
    const srcPath = path.join(SRC_DIR, src);
    const outPath = path.join(OUT_DIR, dst);
    if (fs.existsSync(outPath) && !force) { skipped++; continue; }
    if (!fs.existsSync(srcPath)) { console.log(`  ✗ Missing: ${src}`); failed++; continue; }
    try {
      const stats = convertFile(srcPath, outPath);
      console.log(`  ✓ ${dst}  (${stats.vertices} verts, ${stats.triangles} tris, ${stats.bones} bones, ${stats.animations} anims)`);
      converted++;
    } catch (e) { console.log(`  ✗ ${dst}: ${e.message}`); failed++; }
  }

  // Rigged meshes (siege + bow/crossbow with animation)
  for (const [src, dst] of Object.entries(FILES_RIGGED)) {
    const srcPath = path.join(SRC_RIG_DIR, src);
    const outPath = path.join(OUT_DIR, dst);
    if (fs.existsSync(outPath) && !force) { skipped++; continue; }
    if (!fs.existsSync(srcPath)) { console.log(`  ✗ Missing (rig): ${src}`); failed++; continue; }
    try {
      const stats = convertFile(srcPath, outPath);
      console.log(`  ✓ ${dst}  (${stats.vertices} verts, ${stats.bones} bones, ${stats.animations} anims)`);
      converted++;
    } catch (e) { console.log(`  ✗ ${dst}: ${e.message}`); failed++; }
  }

  // Rigged ammo (arrows)
  const rigArrows = {
    'ARROW_BOW.fbx': 'Bow_Arrow_Rig.glb',
    'ARROW_CROSSBOW.fbx': 'Crossbow_Arrow_Rig.glb',
    'ARROW_BIG_CROSSBOW.fbx': 'Big_Crossbow_Arrow_Rig.glb',
  };
  for (const [src, dst] of Object.entries(rigArrows)) {
    const srcPath = path.join(SRC_RIG_DIR, src);
    const outPath = path.join(OUT_DIR, dst);
    if (fs.existsSync(outPath) && !force) { skipped++; continue; }
    if (!fs.existsSync(srcPath)) { console.log(`  ✗ Missing (arrow rig): ${src}`); failed++; continue; }
    try {
      const stats = convertFile(srcPath, outPath);
      console.log(`  ✓ ${dst}  (${stats.vertices} verts, ${stats.bones} bones)`);
      converted++;
    } catch (e) { console.log(`  ✗ ${dst}: ${e.message}`); failed++; }
  }

  console.log(`\nDone: ${converted} converted, ${skipped} skipped, ${failed} failed\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
