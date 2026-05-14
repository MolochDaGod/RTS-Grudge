const fs = require('fs');
const path = require('path');
const {
  parseArgs, walkGlob, runWithConcurrency,
  ProgressReporter, FailureAggregator, makeMain,
} = require('./lib/scriptKit.cjs');
const { sanitizeBoneName } = require('./lib/boneSanitize.cjs');

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
      this._src = val;
      this.complete = true;
      setTimeout(() => {
        this.dispatchEvent({ type: 'load', target: this });
        if (this.onload) this.onload({ type: 'load', target: this });
      }, 0);
    }
    get src() { return this._src || ''; }
  }

  class FakeCanvas extends FakeEventTarget {
    constructor() { super(); this.width = 1; this.height = 1; this.style = {}; }
    getContext() {
      return {
        canvas: this,
        fillRect: () => {},
        clearRect: () => {},
        drawImage: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        putImageData: () => {},
        createImageData: () => ({ data: new Uint8ClampedArray(4) }),
        setTransform: () => {},
        resetTransform: () => {},
        measureText: () => ({ width: 0 }),
        fillText: () => {},
        scale: () => {},
        translate: () => {},
        rotate: () => {},
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        stroke: () => {},
        fill: () => {},
        arc: () => {},
        rect: () => {},
        clip: () => {},
      };
    }
    toDataURL() { return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; }
  }

  global.document = {
    createElement: (tag) => {
      if (tag === 'canvas') return new FakeCanvas();
      if (tag === 'img') return new FakeImage();
      return new FakeEventTarget();
    },
    createElementNS: (ns, tag) => {
      if (tag === 'canvas') return new FakeCanvas();
      if (tag === 'img') return new FakeImage();
      const el = new FakeEventTarget();
      el.style = {};
      return el;
    },
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

const MODELS_DIR = path.resolve(__dirname, '../client/public/models');

const DIRS_TO_CONVERT = [
  'weapons',
  'environment',
  'characters',
  'dungeon',
  'dungeon_quaternius',
  'furniture_quaternius',
  'village_quaternius',
];

const SKIP_DIRS = ['animations'];

function buildMeshGlb(fbxScene, clips) {
  const gltf = {
    asset: { version: "2.0", generator: "model-converter-v2" },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
    meshes: [],
    accessors: [],
    bufferViews: [],
    buffers: [],
    materials: [],
    animations: [],
  };

  const bufferChunks = [];
  let byteOffset = 0;

  function addBufferView(data, target) {
    const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const padding = (4 - (bytes.length % 4)) % 4;
    const paddedBytes = padding > 0 ? Buffer.concat([bytes, Buffer.alloc(padding)]) : bytes;

    const viewIdx = gltf.bufferViews.length;
    const bv = {
      buffer: 0,
      byteOffset: byteOffset,
      byteLength: bytes.length,
    };
    if (target) bv.target = target;
    gltf.bufferViews.push(bv);
    byteOffset += paddedBytes.length;
    bufferChunks.push(paddedBytes);
    return viewIdx;
  }

  function addAccessor(data, type, componentType, target) {
    const viewIdx = addBufferView(data, target);
    const accIdx = gltf.accessors.length;
    const elemSize = type === "SCALAR" ? 1 : type === "VEC2" ? 2 : type === "VEC3" ? 3 : type === "VEC4" ? 4 : 1;
    const count = data.length / elemSize;

    const acc = {
      bufferView: viewIdx,
      componentType: componentType || 5126,
      count: count,
      type: type,
    };

    if (type === "VEC3" || type === "VEC2" || type === "SCALAR") {
      const min = new Array(elemSize).fill(Infinity);
      const max = new Array(elemSize).fill(-Infinity);
      for (let i = 0; i < data.length; i++) {
        const c = i % elemSize;
        if (data[i] < min[c]) min[c] = data[i];
        if (data[i] > max[c]) max[c] = data[i];
      }
      acc.min = min;
      acc.max = max;
    }

    gltf.accessors.push(acc);
    return accIdx;
  }

  const materialMap = new Map();

  function getOrCreateMaterial(mat) {
    if (!mat) return 0;
    const key = mat.uuid || mat.name || 'default';
    if (materialMap.has(key)) return materialMap.get(key);

    const gltfMat = { name: sanitizeBoneName(mat.name) || `material_${gltf.materials.length}` };
    const pbr = {};

    if (mat.color) {
      pbr.baseColorFactor = [mat.color.r, mat.color.g, mat.color.b, mat.opacity !== undefined ? mat.opacity : 1.0];
    } else {
      pbr.baseColorFactor = [0.8, 0.8, 0.8, 1.0];
    }

    if (mat.roughness !== undefined) pbr.roughnessFactor = mat.roughness;
    else pbr.roughnessFactor = 0.8;

    if (mat.metalness !== undefined) pbr.metallicFactor = mat.metalness;
    else pbr.metallicFactor = 0.0;

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

  fbxScene.traverse((child) => {
    if (child.isBone) boneList.push(child);
  });

  if (boneList.length > 0) {
    for (const bone of boneList) {
      const nodeIdx = gltf.nodes.length;
      boneNodeIndices.set(bone, nodeIdx);

      const node = { name: sanitizeBoneName(bone.name) };
      if (bone.position && (bone.position.x !== 0 || bone.position.y !== 0 || bone.position.z !== 0)) {
        node.translation = [bone.position.x, bone.position.y, bone.position.z];
      }
      if (bone.quaternion && (bone.quaternion.x !== 0 || bone.quaternion.y !== 0 || bone.quaternion.z !== 0 || bone.quaternion.w !== 1)) {
        node.rotation = [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w];
      }
      if (bone.scale && (bone.scale.x !== 1 || bone.scale.y !== 1 || bone.scale.z !== 1)) {
        node.scale = [bone.scale.x, bone.scale.y, bone.scale.z];
      }
      gltf.nodes.push(node);
    }

    for (const bone of boneList) {
      const parentIdx = boneNodeIndices.get(bone);
      const childIndices = [];
      for (const child of bone.children) {
        if (boneNodeIndices.has(child)) {
          childIndices.push(boneNodeIndices.get(child));
        }
      }
      if (childIndices.length > 0) {
        gltf.nodes[parentIdx].children = childIndices;
      }
    }

    const rootBoneIndices = boneList
      .filter(b => !b.parent || !boneNodeIndices.has(b.parent))
      .map(b => boneNodeIndices.get(b));

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

    gltf.skins = [{
      joints: skinJoints,
      inverseBindMatrices: ibmAccessor,
    }];
    skinIdx = 0;

    const skeletonRootIdx = gltf.nodes.length;
    gltf.nodes.push({
      name: "Armature",
      children: rootBoneIndices,
    });
    gltf.skins[0].skeleton = skeletonRootIdx;
    gltf.scenes[0].nodes.push(skeletonRootIdx);
  }

  let totalVertices = 0;
  let totalTriangles = 0;
  let meshCount = 0;

  fbxScene.traverse((child) => {
    if (!child.isMesh) return;
    meshCount++;
    const mesh = child;
    const geo = mesh.geometry;
    if (!geo) return;

    const posAttr = geo.getAttribute('position');
    if (!posAttr) return;

    const posData = new Float32Array(posAttr.array);
    totalVertices += posAttr.count;

    const primitives = [];
    const attributes = {};

    attributes.POSITION = addAccessor(posData, "VEC3", 5126, 34962);

    const normalAttr = geo.getAttribute('normal');
    if (normalAttr) {
      attributes.NORMAL = addAccessor(new Float32Array(normalAttr.array), "VEC3", 5126, 34962);
    }

    const uvAttr = geo.getAttribute('uv');
    if (uvAttr) {
      attributes.TEXCOORD_0 = addAccessor(new Float32Array(uvAttr.array), "VEC2", 5126, 34962);
    }

    const skinIdxAttr = geo.getAttribute('skinIndex');
    const skinWeightAttr = geo.getAttribute('skinWeight');
    if (skinIdxAttr && skinWeightAttr && boneList.length > 0) {
      const jointData = new Uint16Array(skinIdxAttr.array.length);
      for (let i = 0; i < skinIdxAttr.array.length; i++) {
        jointData[i] = Math.floor(skinIdxAttr.array[i]);
      }
      attributes.JOINTS_0 = addAccessor(jointData, "VEC4", 5123, 34962);
      attributes.WEIGHTS_0 = addAccessor(new Float32Array(skinWeightAttr.array), "VEC4", 5126, 34962);
    }

    const primitive = { attributes };

    if (geo.index) {
      const indexData = geo.index.count > 65535
        ? new Uint32Array(geo.index.array)
        : new Uint16Array(geo.index.array);
      const componentType = geo.index.count > 65535 ? 5125 : 5123;
      primitive.indices = addAccessor(indexData, "SCALAR", componentType, 34963);
      totalTriangles += geo.index.count / 3;
    } else {
      totalTriangles += posAttr.count / 3;
    }

    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    primitive.material = getOrCreateMaterial(mat);

    primitives.push(primitive);

    const meshIdx = gltf.meshes.length;
    gltf.meshes.push({ name: sanitizeBoneName(child.name) || `mesh_${meshIdx}`, primitives });

    const nodeIdx = gltf.nodes.length;
    const node = { name: sanitizeBoneName(child.name) || `node_${nodeIdx}`, mesh: meshIdx };

    if (child.position && (child.position.x !== 0 || child.position.y !== 0 || child.position.z !== 0)) {
      node.translation = [child.position.x, child.position.y, child.position.z];
    }
    if (child.quaternion && (child.quaternion.x !== 0 || child.quaternion.y !== 0 || child.quaternion.z !== 0 || child.quaternion.w !== 1)) {
      node.rotation = [child.quaternion.x, child.quaternion.y, child.quaternion.z, child.quaternion.w];
    }
    if (child.scale && (child.scale.x !== 1 || child.scale.y !== 1 || child.scale.z !== 1)) {
      node.scale = [child.scale.x, child.scale.y, child.scale.z];
    }

    if (skinIdx >= 0 && child.isSkinnedMesh) {
      node.skin = skinIdx;
    }

    gltf.nodes.push(node);
    gltf.scenes[0].nodes.push(nodeIdx);
  });

  if (clips && clips.length > 0) {
    const boneNames = boneList.map(b => sanitizeBoneName(b.name));

    for (const clip of clips) {
      const animation = { name: sanitizeBoneName(clip.name) || "Animation", channels: [], samplers: [] };

      for (const track of clip.tracks) {
        const sanitizedTrackName = sanitizeBoneName(track.name);
        const parts = sanitizedTrackName.split('.');
        const boneName = parts.slice(0, -1).join('.');
        const property = parts[parts.length - 1];

        let nodeIdx = -1;
        for (let i = 0; i < boneNames.length; i++) {
          if (boneNames[i] === boneName || boneNames[i].toLowerCase() === boneName.toLowerCase()) {
            nodeIdx = boneNodeIndices.get(boneList[i]);
            break;
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

      if (animation.channels.length > 0) {
        gltf.animations.push(animation);
      }
    }
  }

  if (gltf.materials.length === 0) {
    gltf.materials.push({
      name: "default",
      pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1.0], roughnessFactor: 0.8, metallicFactor: 0.0 },
    });
  }

  const allBufferData = Buffer.concat(bufferChunks.length > 0 ? bufferChunks : [Buffer.alloc(0)]);
  gltf.buffers.push({ byteLength: allBufferData.length });

  const jsonStr = JSON.stringify(gltf);
  const jsonBuffer = Buffer.from(jsonStr, 'utf8');
  const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4;
  const paddedJson = jsonPadding > 0
    ? Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)])
    : jsonBuffer;

  const binPadding = (4 - (allBufferData.length % 4)) % 4;
  const paddedBin = binPadding > 0
    ? Buffer.concat([allBufferData, Buffer.alloc(binPadding, 0x00)])
    : allBufferData;

  const totalLength = 12 + 8 + paddedJson.length + 8 + paddedBin.length;

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(paddedJson.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4);

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(paddedBin.length, 0);
  binChunkHeader.writeUInt32LE(0x004E4942, 4);

  return {
    glb: Buffer.concat([header, jsonChunkHeader, paddedJson, binChunkHeader, paddedBin]),
    stats: { vertices: totalVertices, triangles: totalTriangles, meshes: meshCount, bones: boneList.length, animations: clips ? clips.length : 0 },
  };
}

function convertFile(fbxPath, { force }) {
  const glbPath = fbxPath.replace(/\.fbx$/i, '.glb');

  if (!force && fs.existsSync(glbPath)) {
    return { status: 'skipped', path: glbPath };
  }

  const buffer = fs.readFileSync(fbxPath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  const loader = new FBXLoader();
  const fbxScene = loader.parse(arrayBuffer, path.dirname(fbxPath) + '/');

  const clips = fbxScene.animations || [];
  const { glb, stats } = buildMeshGlb(fbxScene, clips);

  fs.writeFileSync(glbPath, glb);

  const fbxSize = fs.statSync(fbxPath).size;
  const glbSize = glb.length;
  const savings = ((1 - glbSize / fbxSize) * 100).toFixed(1);

  return {
    status: 'converted',
    path: glbPath,
    fbxSize,
    glbSize,
    savings: `${savings}%`,
    ...stats,
  };
}

async function main(argv) {
  const { values } = parseArgs(argv, {
    flags: {
      force: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      concurrency: { type: 'number', default: 1 },
    },
    positional: ['dir'],
  });

  const dirsToProcess = values.dir ? [values.dir] : DIRS_TO_CONVERT;

  let allFbx = [];
  for (const dir of dirsToProcess) {
    const fullDir = path.join(MODELS_DIR, dir);
    if (fs.existsSync(fullDir)) {
      allFbx.push(...walkGlob(fullDir, /\.fbx$/i, { skipDirs: SKIP_DIRS }));
    } else {
      console.log(`Warning: Directory not found: ${fullDir}`);
    }
  }

  console.log(`\n=== Model FBX → GLB Converter ===`);
  console.log(`Found ${allFbx.length} FBX files to process`);
  if (values.force) console.log(`Mode: Force overwrite existing GLB files`);
  if (values['dry-run']) console.log(`Mode: Dry run (no files will be written)`);
  console.log('');

  const progress = new ProgressReporter(allFbx.length);
  const failures = new FailureAggregator();

  let converted = 0, skipped = 0;
  let totalFbxSize = 0, totalGlbSize = 0;
  let totalVerts = 0, totalTris = 0;
  const results = [];

  // FBXLoader.parse is sync + memory-heavy; serialise by default.
  await runWithConcurrency(allFbx, values.concurrency, async (fbxPath) => {
    const rel = path.relative(MODELS_DIR, fbxPath);
    progress.start(rel);

    if (values['dry-run']) {
      const glbPath = fbxPath.replace(/\.fbx$/i, '.glb');
      const exists = fs.existsSync(glbPath);
      progress.end(exists ? 'EXISTS (would skip)' : 'WOULD CONVERT');
      return;
    }

    try {
      const result = convertFile(fbxPath, { force: values.force });
      if (result.status === 'converted') {
        converted++;
        totalFbxSize += result.fbxSize;
        totalGlbSize += result.glbSize;
        totalVerts += result.vertices;
        totalTris += result.triangles;
        results.push({ file: rel, ...result });
        progress.end(`OK (${result.vertices} verts, ${result.triangles} tris, ${result.meshes} meshes, ${result.bones} bones, ${result.savings} smaller)`);
      } else {
        skipped++;
        progress.end('SKIPPED (GLB exists)');
      }
    } catch (err) {
      failures.add({ file: rel, error: err });
      progress.end(`ERROR: ${err.message}`);
    }
  });

  console.log(`\n=== Summary ===`);
  console.log(`Converted: ${converted}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Errors:    ${failures.count}`);
  if (totalFbxSize > 0) {
    console.log(`\nTotal FBX size:  ${(totalFbxSize / 1024 / 1024).toFixed(1)} MB`);
    console.log(`Total GLB size:  ${(totalGlbSize / 1024 / 1024).toFixed(1)} MB`);
    console.log(`Space saved:     ${((1 - totalGlbSize / totalFbxSize) * 100).toFixed(1)}%`);
    console.log(`Total vertices:  ${totalVerts.toLocaleString()}`);
    console.log(`Total triangles: ${totalTris.toLocaleString()}`);
  }
  failures.printSummary();

  if (converted > 0) {
    const reportPath = path.join(MODELS_DIR, '..', 'conversion-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      converted,
      skipped,
      errors: failures.count,
      totalFbxSize,
      totalGlbSize,
      totalVertices: totalVerts,
      totalTriangles: totalTris,
      files: results,
      errorFiles: failures.failures.map(f => ({ file: f.file, error: f.error?.message || String(f.error) })),
    }, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);
  }

  return { failures: failures.count };
}

makeMain(main, { scriptName: 'convert-models-to-glb' })();
