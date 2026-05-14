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
    constructor() { super(); this.width = 1; this.height = 1; this.data = null; this.complete = false; this.naturalWidth = 1; this.naturalHeight = 1; }
    set src(val) {
      this._src = val; this.complete = true;
      setTimeout(() => { this.dispatchEvent({ type: 'load', target: this }); if (this.onload) this.onload({ type: 'load', target: this }); }, 0);
    }
    get src() { return this._src || ''; }
  }
  class FakeCanvas extends FakeEventTarget {
    constructor() { super(); this.width = 1; this.height = 1; this.style = {}; }
    getContext() {
      return {
        canvas: this, fillRect: () => {}, clearRect: () => {}, drawImage: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData: () => {},
        createImageData: () => ({ data: new Uint8ClampedArray(4) }),
        setTransform: () => {}, resetTransform: () => {}, measureText: () => ({ width: 0 }),
        fillText: () => {}, scale: () => {}, translate: () => {}, rotate: () => {},
        save: () => {}, restore: () => {}, beginPath: () => {}, moveTo: () => {},
        lineTo: () => {}, closePath: () => {}, stroke: () => {}, fill: () => {},
        arc: () => {}, rect: () => {}, clip: () => {},
      };
    }
    toDataURL() { return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; }
  }
  global.document = {
    createElement: (tag) => { if (tag === 'canvas') return new FakeCanvas(); if (tag === 'img') return new FakeImage(); return new FakeEventTarget(); },
    createElementNS: (ns, tag) => { if (tag === 'canvas') return new FakeCanvas(); if (tag === 'img') return new FakeImage(); const el = new FakeEventTarget(); el.style = {}; return el; },
    body: { appendChild: () => {}, removeChild: () => {} },
  };
  global.window = global;
  global.self = global;
  global.navigator = { userAgent: 'node', platform: 'node' };
  global.HTMLCanvasElement = FakeCanvas;
  global.HTMLImageElement = FakeImage;
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

const SRC = '/tmp/threejs-games/assets/models';
const DST = path.resolve(__dirname, '../client/public/models/threejs-games');

function sanitizeName(name) {
  return name ? name.replace(/:/g, '_') : name;
}

function buildMeshGlb(fbxScene, clips) {
  const gltf = {
    asset: { version: "2.0", generator: "threejs-games-converter" },
    scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [],
    accessors: [], bufferViews: [], buffers: [], materials: [], animations: [],
  };
  const bufferChunks = [];
  let byteOffset = 0;

  function addBufferView(data, target) {
    const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const padding = (4 - (bytes.length % 4)) % 4;
    const paddedBytes = padding > 0 ? Buffer.concat([bytes, Buffer.alloc(padding)]) : bytes;
    const viewIdx = gltf.bufferViews.length;
    const bv = { buffer: 0, byteOffset, byteLength: bytes.length };
    if (target) bv.target = target;
    gltf.bufferViews.push(bv);
    byteOffset += paddedBytes.length;
    bufferChunks.push(paddedBytes);
    return viewIdx;
  }

  function addAccessor(data, type, componentType, target) {
    const viewIdx = addBufferView(data, target);
    const accIdx = gltf.accessors.length;
    const elemSize = type === "SCALAR" ? 1 : type === "VEC2" ? 2 : type === "VEC3" ? 3 : type === "VEC4" ? 4 : type === "MAT4" ? 16 : 1;
    const count = data.length / elemSize;
    const acc = { bufferView: viewIdx, componentType: componentType || 5126, count, type };
    if (type === "VEC3" || type === "VEC2" || type === "SCALAR") {
      const min = new Array(elemSize).fill(Infinity);
      const max = new Array(elemSize).fill(-Infinity);
      for (let i = 0; i < data.length; i++) {
        const c = i % elemSize;
        if (data[i] < min[c]) min[c] = data[i];
        if (data[i] > max[c]) max[c] = data[i];
      }
      acc.min = min; acc.max = max;
    }
    gltf.accessors.push(acc);
    return accIdx;
  }

  const materialMap = new Map();
  function getOrCreateMaterial(mat) {
    if (!mat) return 0;
    const key = mat.uuid || mat.name || 'default';
    if (materialMap.has(key)) return materialMap.get(key);
    const gltfMat = { name: sanitizeName(mat.name) || `material_${gltf.materials.length}` };
    const pbr = {};
    if (mat.color) pbr.baseColorFactor = [mat.color.r, mat.color.g, mat.color.b, mat.opacity !== undefined ? mat.opacity : 1.0];
    else pbr.baseColorFactor = [0.8, 0.8, 0.8, 1.0];
    pbr.roughnessFactor = mat.roughness !== undefined ? mat.roughness : 0.8;
    pbr.metallicFactor = mat.metalness !== undefined ? mat.metalness : 0.0;
    gltfMat.pbrMetallicRoughness = pbr;
    if (mat.transparent) gltfMat.alphaMode = "BLEND";
    if (mat.side === THREE.DoubleSide) gltfMat.doubleSided = true;
    const idx = gltf.materials.length;
    gltf.materials.push(gltfMat);
    materialMap.set(key, idx);
    return idx;
  }

  const boneNodeIndices = new Map();
  const boneList = [];
  let skinIdx = -1;
  fbxScene.traverse((child) => { if (child.isBone) boneList.push(child); });

  if (boneList.length > 0) {
    for (const bone of boneList) {
      const nodeIdx = gltf.nodes.length;
      boneNodeIndices.set(bone, nodeIdx);
      const node = { name: sanitizeName(bone.name) };
      if (bone.position && (bone.position.x !== 0 || bone.position.y !== 0 || bone.position.z !== 0))
        node.translation = [bone.position.x, bone.position.y, bone.position.z];
      if (bone.quaternion && (bone.quaternion.x !== 0 || bone.quaternion.y !== 0 || bone.quaternion.z !== 0 || bone.quaternion.w !== 1))
        node.rotation = [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w];
      if (bone.scale && (bone.scale.x !== 1 || bone.scale.y !== 1 || bone.scale.z !== 1))
        node.scale = [bone.scale.x, bone.scale.y, bone.scale.z];
      gltf.nodes.push(node);
    }
    for (const bone of boneList) {
      const parentIdx = boneNodeIndices.get(bone);
      const childIndices = [];
      for (const child of bone.children) {
        if (boneNodeIndices.has(child)) childIndices.push(boneNodeIndices.get(child));
      }
      if (childIndices.length > 0) gltf.nodes[parentIdx].children = childIndices;
    }
    const rootBoneIndices = boneList.filter(b => !b.parent || !boneNodeIndices.has(b.parent)).map(b => boneNodeIndices.get(b));
    const skinJoints = boneList.map(b => boneNodeIndices.get(b));
    const ibmData = new Float32Array(boneList.length * 16);
    for (let i = 0; i < boneList.length; i++) {
      const bone = boneList[i];
      const ibm = new THREE.Matrix4();
      bone.updateWorldMatrix(true, false);
      ibm.copy(bone.matrixWorld).invert();
      ibm.toArray(ibmData, i * 16);
    }
    const ibmAccessor = addAccessor(ibmData, "MAT4", 5126);
    gltf.skins = [{ joints: skinJoints, inverseBindMatrices: ibmAccessor }];
    skinIdx = 0;
    const skeletonRootIdx = gltf.nodes.length;
    gltf.nodes.push({ name: "Armature", children: rootBoneIndices });
    gltf.skins[0].skeleton = skeletonRootIdx;
    gltf.scenes[0].nodes.push(skeletonRootIdx);
  }

  let totalVertices = 0, totalTriangles = 0, meshCount = 0;
  fbxScene.traverse((child) => {
    if (!child.isMesh) return;
    meshCount++;
    const geo = child.geometry;
    if (!geo) return;
    const posAttr = geo.getAttribute('position');
    if (!posAttr) return;
    totalVertices += posAttr.count;
    const attributes = {};
    attributes.POSITION = addAccessor(new Float32Array(posAttr.array), "VEC3", 5126, 34962);
    const normalAttr = geo.getAttribute('normal');
    if (normalAttr) attributes.NORMAL = addAccessor(new Float32Array(normalAttr.array), "VEC3", 5126, 34962);
    const uvAttr = geo.getAttribute('uv');
    if (uvAttr) attributes.TEXCOORD_0 = addAccessor(new Float32Array(uvAttr.array), "VEC2", 5126, 34962);
    const skinIdxAttr = geo.getAttribute('skinIndex');
    const skinWeightAttr = geo.getAttribute('skinWeight');
    if (skinIdxAttr && skinWeightAttr && boneList.length > 0) {
      const jointData = new Uint16Array(skinIdxAttr.array.length);
      for (let i = 0; i < skinIdxAttr.array.length; i++) jointData[i] = Math.floor(skinIdxAttr.array[i]);
      attributes.JOINTS_0 = addAccessor(jointData, "VEC4", 5123, 34962);
      attributes.WEIGHTS_0 = addAccessor(new Float32Array(skinWeightAttr.array), "VEC4", 5126, 34962);
    }
    const primitive = { attributes };
    if (geo.index) {
      const indexData = geo.index.count > 65535 ? new Uint32Array(geo.index.array) : new Uint16Array(geo.index.array);
      const componentType = geo.index.count > 65535 ? 5125 : 5123;
      primitive.indices = addAccessor(indexData, "SCALAR", componentType, 34963);
      totalTriangles += geo.index.count / 3;
    } else { totalTriangles += posAttr.count / 3; }
    const mat = Array.isArray(child.material) ? child.material[0] : child.material;
    primitive.material = getOrCreateMaterial(mat);
    const meshIdx = gltf.meshes.length;
    gltf.meshes.push({ name: sanitizeName(child.name) || `mesh_${meshIdx}`, primitives: [primitive] });
    const nodeIdx = gltf.nodes.length;
    const node = { name: sanitizeName(child.name) || `node_${nodeIdx}`, mesh: meshIdx };
    if (child.position && (child.position.x !== 0 || child.position.y !== 0 || child.position.z !== 0))
      node.translation = [child.position.x, child.position.y, child.position.z];
    if (child.quaternion && (child.quaternion.x !== 0 || child.quaternion.y !== 0 || child.quaternion.z !== 0 || child.quaternion.w !== 1))
      node.rotation = [child.quaternion.x, child.quaternion.y, child.quaternion.z, child.quaternion.w];
    if (child.scale && (child.scale.x !== 1 || child.scale.y !== 1 || child.scale.z !== 1))
      node.scale = [child.scale.x, child.scale.y, child.scale.z];
    if (skinIdx >= 0 && child.isSkinnedMesh) node.skin = skinIdx;
    gltf.nodes.push(node);
    gltf.scenes[0].nodes.push(nodeIdx);
  });

  if (clips && clips.length > 0) {
    const boneNames = boneList.map(b => sanitizeName(b.name));
    for (const clip of clips) {
      const animation = { name: sanitizeName(clip.name) || "Animation", channels: [], samplers: [] };
      for (const track of clip.tracks) {
        const sanitizedTrackName = sanitizeName(track.name);
        const parts = sanitizedTrackName.split('.');
        const boneName = parts.slice(0, -1).join('.');
        const property = parts[parts.length - 1];
        let nodeIdx = -1;
        for (let i = 0; i < boneNames.length; i++) {
          if (boneNames[i] === boneName || boneNames[i].toLowerCase() === boneName.toLowerCase()) {
            nodeIdx = boneNodeIndices.get(boneList[i]); break;
          }
        }
        if (nodeIdx === -1) continue;
        let targetPath, valueType;
        if (property === 'position') { targetPath = 'translation'; valueType = 'VEC3'; }
        else if (property === 'quaternion') { targetPath = 'rotation'; valueType = 'VEC4'; }
        else if (property === 'scale') { targetPath = 'scale'; valueType = 'VEC3'; }
        else continue;
        const timeAccessor = addAccessor(new Float32Array(track.times), "SCALAR");
        const valueAccessor = addAccessor(new Float32Array(track.values), valueType);
        const samplerIdx = animation.samplers.length;
        animation.samplers.push({ input: timeAccessor, output: valueAccessor, interpolation: "LINEAR" });
        animation.channels.push({ sampler: samplerIdx, target: { node: nodeIdx, path: targetPath } });
      }
      if (animation.channels.length > 0) gltf.animations.push(animation);
    }
  }

  if (gltf.materials.length === 0) {
    gltf.materials.push({ name: "default", pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1.0], roughnessFactor: 0.8, metallicFactor: 0.0 } });
  }

  const allBufferData = Buffer.concat(bufferChunks.length > 0 ? bufferChunks : [Buffer.alloc(0)]);
  gltf.buffers.push({ byteLength: allBufferData.length });
  const jsonStr = JSON.stringify(gltf);
  const jsonBuffer = Buffer.from(jsonStr, 'utf8');
  const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4;
  const paddedJson = jsonPadding > 0 ? Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)]) : jsonBuffer;
  const binPadding = (4 - (allBufferData.length % 4)) % 4;
  const paddedBin = binPadding > 0 ? Buffer.concat([allBufferData, Buffer.alloc(binPadding, 0x00)]) : allBufferData;
  const totalLength = 12 + 8 + paddedJson.length + 8 + paddedBin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(totalLength, 8);
  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(paddedJson.length, 0); jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4);
  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(paddedBin.length, 0); binChunkHeader.writeUInt32LE(0x004E4942, 4);
  return {
    glb: Buffer.concat([header, jsonChunkHeader, paddedJson, binChunkHeader, paddedBin]),
    stats: { vertices: totalVertices, triangles: totalTriangles, meshes: meshCount, bones: boneList.length, animations: clips ? clips.length : 0 },
  };
}

const loader = new FBXLoader();

function loadFBX(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return loader.parse(ab, path.dirname(filePath) + '/');
  } catch (e) {
    return null;
  }
}

const CHARACTER_DIRS = [
  'barbarian', 'demon', 'goblin', 'golem', 'orc', 'orc-ogre',
  'skeleton', 'sorceress', 'troll', 'witch', 'wizard', 'zombie',
  'soldier', 'nude-victim',
];

const SINGLE_FBX_FILES = [
  { src: 'character/dwarf.fbx', dst: 'characters/dwarf.glb' },
  { src: 'weapon/bomb.fbx', dst: 'weapons/bomb.glb' },
  { src: 'weapon/kasikara.fbx', dst: 'weapons/kasikara.glb' },
  { src: 'weapon/rifle.fbx', dst: 'weapons/rifle.glb' },
  { src: 'building/bunker.fbx', dst: 'buildings/bunker.glb' },
  { src: 'building/castle/fortress.fbx', dst: 'buildings/castle-fortress.glb' },
  { src: 'building/castle/castle-fortress.fbx', dst: 'buildings/castle-fortress2.glb' },
  { src: 'building/castle/magic-castle.fbx', dst: 'buildings/magic-castle.glb' },
  { src: 'building/castle/arabic/model.fbx', dst: 'buildings/arabic-castle.glb' },
  { src: 'building/castle/dwarven-fort/model.fbx', dst: 'buildings/dwarven-fort.glb' },
  { src: 'building/castle/medieval-city/model.fbx', dst: 'buildings/medieval-city.glb' },
  { src: 'building/castle/minas-tirith/minas-tirith.fbx', dst: 'buildings/minas-tirith.glb' },
  { src: 'building/castle/town/town.fbx', dst: 'buildings/medieval-town.glb' },
  { src: 'building/castle/gate-of-mordor/black-gate.fbx', dst: 'buildings/black-gate.glb' },
  { src: 'building/house/medieval-house/model.fbx', dst: 'buildings/medieval-house.glb' },
  { src: 'building/house/witch-hut/model.fbx', dst: 'buildings/witch-hut.glb' },
  { src: 'building/house/wizard-house/model.fbx', dst: 'buildings/wizard-house.glb' },
  { src: 'building/house/wizard-house2/model.fbx', dst: 'buildings/wizard-house2.glb' },
  { src: 'building/house/steam-house/model.fbx', dst: 'buildings/steam-house.glb' },
  { src: 'building/temple/thorny-temple/thorny-castle.fbx', dst: 'buildings/thorny-temple.glb' },
  { src: 'building/temple/well-temple/temple.fbx', dst: 'buildings/well-temple.glb' },
  { src: 'building/temple/wizard-temple/wizard-temple.fbx', dst: 'buildings/wizard-temple.glb' },
  { src: 'building/tower/strange/tower.fbx', dst: 'buildings/strange-tower.glb' },
  { src: 'building/windmill/windmill1/model.fbx', dst: 'buildings/windmill.glb' },
  { src: 'building/factory/model.fbx', dst: 'buildings/factory.glb' },
  { src: 'building/monument/kadinjaca.fbx', dst: 'buildings/monument-kadinjaca.glb' },
  { src: 'building/monument/kosmaj.fbx', dst: 'buildings/monument-kosmaj.glb' },
  { src: 'building/monument/knight/knight.fbx', dst: 'buildings/monument-knight.glb' },
  { src: 'tank/renault-ft.fbx', dst: 'vehicles/tank-renault-ft.glb' },
  { src: 'tank/t-34.fbx', dst: 'vehicles/tank-t34.glb' },
  { src: 'tank/panzer-III.fbx', dst: 'vehicles/tank-panzer3.glb' },
  { src: 'vehicle/kubelwagen.fbx', dst: 'vehicles/kubelwagen.glb' },
  { src: 'vehicle/kubelwagen-color.fbx', dst: 'vehicles/kubelwagen-color.glb' },
  { src: 'aircraft/airplane/biplane-bristol-f2b/model.fbx', dst: 'vehicles/biplane-bristol.glb' },
  { src: 'aircraft/airplane/biplane-sopwith/model.fbx', dst: 'vehicles/biplane-sopwith.glb' },
  { src: 'aircraft/airplane/triplane-sopwith/triplane.fbx', dst: 'vehicles/triplane-sopwith.glb' },
  { src: 'aircraft/airship/zeppelin.fbx', dst: 'vehicles/zeppelin.glb' },
  { src: 'aircraft/airship/dirigible/model.fbx', dst: 'vehicles/dirigible.glb' },
  { src: 'aircraft/airship/steampunk-carrier/model.fbx', dst: 'vehicles/steampunk-carrier.glb' },
  { src: 'aircraft/airship/aerial-screw/model.fbx', dst: 'vehicles/aerial-screw.glb' },
  { src: 'aircraft/helicopter/simple-animated/helicopter.fbx', dst: 'vehicles/helicopter.glb' },
  { src: 'ship/elven-dark/model.fbx', dst: 'ships/elven-dark.glb' },
  { src: 'ship/elven-galeon/model.fbx', dst: 'ships/elven-galeon.glb' },
  { src: 'weapon/cannon/cannon.fbx', dst: 'weapons/cannon.glb' },
  { src: 'weapon/mg-42/mg42.fbx', dst: 'weapons/mg42.glb' },
  { src: 'weapon/machine-gun/model.fbx', dst: 'weapons/machine-gun.glb' },
  { src: 'weapon/catapult/scene.gltf', dst: 'weapons/catapult.glb', skipFbx: true },
  { src: 'item/barrel/barrel.fbx', dst: 'items/barrel.glb' },
  { src: 'item/propeller/propeller.fbx', dst: 'items/propeller.glb' },
  { src: 'building/city/Building1_Large.fbx', dst: 'buildings/building-1-large.glb' },
  { src: 'building/city/Building1_Small.fbx', dst: 'buildings/building-1-small.glb' },
  { src: 'building/city/Building3_Big.fbx', dst: 'buildings/building-3-big.glb' },
  { src: 'building/city/Building4.fbx', dst: 'buildings/building-4.glb' },
  { src: 'building/city/House1.fbx', dst: 'buildings/house-1.glb' },
  { src: 'space/lunar-module/model.fbx', dst: 'vehicles/lunar-module.glb' },
];

const WEAPON_MODEL_DIRS = [
  { src: 'weapon/axe-lowpoly', dst: 'weapons/axe-lowpoly.glb' },
  { src: 'weapon/flame-gun', dst: 'weapons/flame-gun.glb' },
  { src: 'weapon/luger', dst: 'weapons/luger.glb' },
  { src: 'weapon/revolver', dst: 'weapons/revolver.glb' },
  { src: 'weapon/rifle-berthier', dst: 'weapons/rifle-berthier.glb' },
];

function main() {
  let success = 0, fail = 0;

  for (const charDir of CHARACTER_DIRS) {
    const srcDir = path.join(SRC, 'character', charDir);
    const dstDir = path.join(DST, 'characters', charDir);
    if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });

    const modelFile = path.join(srcDir, 'model.fbx');
    if (!fs.existsSync(modelFile)) { console.log(`SKIP: No model.fbx in ${charDir}`); fail++; continue; }

    process.stdout.write(`Character: ${charDir} ... `);
    const modelScene = loadFBX(modelFile);
    if (!modelScene) { console.log('FAIL (parse)'); fail++; continue; }

    const allClips = [...(modelScene.animations || [])];
    const animFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.fbx') && f !== 'model.fbx').sort();
    for (const af of animFiles) {
      const animScene = loadFBX(path.join(srcDir, af));
      if (animScene?.animations?.length > 0) {
        for (const clip of animScene.animations) {
          clip.name = path.basename(af, '.fbx');
          allClips.push(clip);
        }
      }
    }

    try {
      const { glb, stats } = buildMeshGlb(modelScene, allClips);
      fs.writeFileSync(path.join(dstDir, 'model.glb'), glb);
      console.log(`OK (${stats.vertices} verts, ${stats.bones} bones, ${stats.animations} anims)`);
      success++;
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
      fail++;
    }
  }

  for (const entry of SINGLE_FBX_FILES) {
    if (entry.skipFbx) continue;
    const srcFile = path.join(SRC, entry.src);
    const dstFile = path.join(DST, entry.dst);
    const dir = path.dirname(dstFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(srcFile)) { console.log(`SKIP: ${entry.src} not found`); fail++; continue; }

    process.stdout.write(`Single: ${entry.src} ... `);
    const scene = loadFBX(srcFile);
    if (!scene) { console.log('FAIL (parse)'); fail++; continue; }

    try {
      const { glb, stats } = buildMeshGlb(scene, scene.animations || []);
      fs.writeFileSync(dstFile, glb);
      console.log(`OK (${stats.vertices} verts, ${stats.bones} bones)`);
      success++;
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
      fail++;
    }
  }

  for (const entry of WEAPON_MODEL_DIRS) {
    const srcDir = path.join(SRC, entry.src);
    const dstFile = path.join(DST, entry.dst);
    const dir = path.dirname(dstFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const fbxFiles = fs.existsSync(srcDir) ? fs.readdirSync(srcDir).filter(f => f.endsWith('.fbx')) : [];
    if (fbxFiles.length === 0) { console.log(`SKIP: No FBX in ${entry.src}`); fail++; continue; }

    process.stdout.write(`Weapon: ${entry.src} ... `);
    const scene = loadFBX(path.join(srcDir, fbxFiles[0]));
    if (!scene) { console.log('FAIL (parse)'); fail++; continue; }

    try {
      const { glb, stats } = buildMeshGlb(scene, []);
      fs.writeFileSync(dstFile, glb);
      console.log(`OK (${stats.vertices} verts)`);
      success++;
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
      fail++;
    }
  }

  console.log(`\nDone: ${success} converted, ${fail} failed`);
}

main();
