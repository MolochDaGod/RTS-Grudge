const fs = require('fs');
const path = require('path');
const {
  parseArgs, walkGlob, runWithConcurrency,
  ProgressReporter, FailureAggregator, makeMain,
} = require('./lib/scriptKit.cjs');
const { sanitizeBoneName } = require('./lib/boneSanitize.cjs');

// Browser-global shim so three.js examples (FBXLoader → fflate) load under Node.
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;
if (typeof globalThis.document === 'undefined') globalThis.document = { createElementNS: () => ({}), createElement: () => ({}) };

const THREE = require('three');

// FBXLoader tries to load embedded textures via TextureLoader, which under
// Node fails because there's no real Image with addEventListener. We're only
// after the skeleton + animation tracks, so neuter the texture path entirely.
// FBXLoader.js uses ESM three.module.js — a *different* instance than this
// CJS require — so we patch both via dynamic ESM import once at startup.
function patchTextureLoader(THREE_) {
  THREE_.TextureLoader.prototype.load = function (_url, onLoad) {
    const tex = new THREE_.Texture();
    tex.image = { width: 1, height: 1, addEventListener() {}, removeEventListener() {} };
    if (onLoad) setTimeout(() => onLoad(tex), 0);
    return tex;
  };
  THREE_.ImageLoader.prototype.load = function (_url, onLoad) {
    const fake = { width: 1, height: 1, addEventListener() {}, removeEventListener() {} };
    if (onLoad) setTimeout(() => onLoad(fake), 0);
    return fake;
  };
  if (THREE_.ImageBitmapLoader) {
    THREE_.ImageBitmapLoader.prototype.load = function (_url, onLoad) {
      const fake = { width: 1, height: 1, close() {} };
      if (onLoad) setTimeout(() => onLoad(fake), 0);
      return fake;
    };
  }
}
patchTextureLoader(THREE);

const ANIMS_DIR = path.resolve(__dirname, '../client/public/models/animations');

// FBXLoader is loaded async because it ESM-imports its own three instance.
let FBXLoader = null;

function buildGlb(clips, skeleton) {
  const gltf = {
    asset: { version: "2.0", generator: "fbx-to-glb-converter" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [],
    animations: [],
    accessors: [],
    bufferViews: [],
    buffers: [],
  };

  const bufferChunks = [];
  let byteOffset = 0;

  function addBufferView(data) {
    const float32 = data instanceof Float32Array ? data : new Float32Array(data);
    const bytes = Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength);

    const padding = (4 - (bytes.length % 4)) % 4;
    const paddedBytes = padding > 0 ? Buffer.concat([bytes, Buffer.alloc(padding)]) : bytes;

    const viewIdx = gltf.bufferViews.length;
    gltf.bufferViews.push({
      buffer: 0,
      byteOffset: byteOffset,
      byteLength: bytes.length,
    });
    byteOffset += paddedBytes.length;
    bufferChunks.push(paddedBytes);
    return viewIdx;
  }

  function addAccessor(data, type, componentType) {
    const float32 = data instanceof Float32Array ? data : new Float32Array(data);

    let min, max;
    if (type === "SCALAR") {
      min = [float32[0]];
      max = [float32[0]];
      for (let i = 1; i < float32.length; i++) {
        if (float32[i] < min[0]) min[0] = float32[i];
        if (float32[i] > max[0]) max[0] = float32[i];
      }
    }

    const viewIdx = addBufferView(float32);
    const accIdx = gltf.accessors.length;
    const count = type === "SCALAR" ? float32.length :
                  type === "VEC3" ? float32.length / 3 :
                  type === "VEC4" ? float32.length / 4 : float32.length;

    const acc = {
      bufferView: viewIdx,
      componentType: componentType || 5126,
      count: count,
      type: type,
    };
    if (min) acc.min = min;
    if (max) acc.max = max;
    gltf.accessors.push(acc);
    return accIdx;
  }

  const boneNames = [];
  const boneNodeStart = 0;

  if (skeleton && skeleton.bones && skeleton.bones.length > 0) {
    for (let i = 0; i < skeleton.bones.length; i++) {
      const bone = skeleton.bones[i];
      const name = sanitizeBoneName(bone.name);
      boneNames.push(name);

      const node = { name: name };

      if (bone.position && (bone.position.x !== 0 || bone.position.y !== 0 || bone.position.z !== 0)) {
        node.translation = [bone.position.x, bone.position.y, bone.position.z];
      }
      if (bone.quaternion && (bone.quaternion.x !== 0 || bone.quaternion.y !== 0 || bone.quaternion.z !== 0 || bone.quaternion.w !== 1)) {
        node.rotation = [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w];
      }
      if (bone.scale && (bone.scale.x !== 1 || bone.scale.y !== 1 || bone.scale.z !== 1)) {
        node.scale = [bone.scale.x, bone.scale.y, bone.scale.z];
      }

      const childIndices = [];
      for (let j = 0; j < skeleton.bones.length; j++) {
        if (j !== i && skeleton.bones[j].parent === bone) {
          childIndices.push(boneNodeStart + j);
        }
      }
      if (childIndices.length > 0) node.children = childIndices;

      gltf.nodes.push(node);
    }

    const rootIndices = [];
    for (let i = 0; i < skeleton.bones.length; i++) {
      const parent = skeleton.bones[i].parent;
      const isRoot = !parent || !skeleton.bones.includes(parent);
      if (isRoot) rootIndices.push(boneNodeStart + i);
    }
    gltf.scenes[0].nodes = rootIndices;
  } else {
    gltf.nodes.push({ name: "Root" });
  }

  for (const clip of clips) {
    const animation = { name: sanitizeBoneName(clip.name) || "Animation", channels: [], samplers: [] };

    for (const track of clip.tracks) {
      const sanitizedTrackName = sanitizeBoneName(track.name);
      const parts = sanitizedTrackName.split('.');
      const boneName = parts.slice(0, -1).join('.');
      const property = parts[parts.length - 1];

      let nodeIdx = boneNames.indexOf(boneName);
      if (nodeIdx === -1) {
        for (let i = 0; i < boneNames.length; i++) {
          if (boneNames[i].toLowerCase() === boneName.toLowerCase()) {
            nodeIdx = i;
            break;
          }
        }
      }
      if (nodeIdx === -1) continue;

      let targetPath;
      let valueType;
      if (property === 'position') {
        targetPath = 'translation';
        valueType = 'VEC3';
      } else if (property === 'quaternion') {
        targetPath = 'rotation';
        valueType = 'VEC4';
      } else if (property === 'scale') {
        targetPath = 'scale';
        valueType = 'VEC3';
      } else {
        continue;
      }

      const timeAccessor = addAccessor(track.times, "SCALAR");
      const valueAccessor = addAccessor(track.values, valueType);

      const samplerIdx = animation.samplers.length;
      animation.samplers.push({
        input: timeAccessor,
        output: valueAccessor,
        interpolation: "LINEAR",
      });

      animation.channels.push({
        sampler: samplerIdx,
        target: {
          node: boneNodeStart + nodeIdx,
          path: targetPath,
        },
      });
    }

    if (animation.channels.length > 0) {
      gltf.animations.push(animation);
    }
  }

  const allBufferData = Buffer.concat(bufferChunks);
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
  header.writeUInt32LE(0x46546C67, 0); // glTF magic
  header.writeUInt32LE(2, 4);          // version 2
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(paddedJson.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // JSON

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(paddedBin.length, 0);
  binChunkHeader.writeUInt32LE(0x004E4942, 4); // BIN

  return Buffer.concat([header, jsonChunkHeader, paddedJson, binChunkHeader, paddedBin]);
}

function extractSkeleton(fbxScene) {
  let skeleton = null;
  fbxScene.traverse((child) => {
    if (child.isSkinnedMesh && child.skeleton && !skeleton) {
      skeleton = child.skeleton;
    }
  });
  if (!skeleton) {
    const bones = [];
    fbxScene.traverse((child) => {
      if (child.isBone) bones.push(child);
    });
    if (bones.length > 0) {
      skeleton = { bones };
    }
  }
  return skeleton;
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
  if (clips.length === 0) {
    throw new Error('No animations found in FBX');
  }

  const skeleton = extractSkeleton(fbxScene);

  const glbBuffer = buildGlb(clips, skeleton);
  fs.writeFileSync(glbPath, glbBuffer);

  const fbxSize = fs.statSync(fbxPath).size;
  const glbSize = glbBuffer.length;
  const savings = ((1 - glbSize / fbxSize) * 100).toFixed(1);

  return {
    status: 'converted',
    path: glbPath,
    fbxSize,
    glbSize,
    savings: `${savings}%`,
    animations: clips.length,
    bones: skeleton ? skeleton.bones.length : 0,
  };
}

async function main(argv) {
  const { values } = parseArgs(argv, {
    flags: {
      force: { type: 'boolean', default: false },
      concurrency: { type: 'number', default: 1 },
    },
  });

  // Patch the ESM three instance that FBXLoader actually imports, then load it.
  const esmThree = await import('three');
  patchTextureLoader(esmThree);
  const fbxMod = await import('three/examples/jsm/loaders/FBXLoader.js');
  FBXLoader = fbxMod.FBXLoader;

  const allFbx = walkGlob(ANIMS_DIR, /\.fbx$/i);
  console.log(`Found ${allFbx.length} FBX files to convert\n`);

  const progress = new ProgressReporter(allFbx.length);
  const failures = new FailureAggregator();
  let converted = 0;
  let skipped = 0;
  let totalFbxSize = 0;
  let totalGlbSize = 0;

  // FBXLoader.parse is sync + memory-heavy; serialise by default.
  const results = await runWithConcurrency(allFbx, values.concurrency, async (fbxPath) => {
    const rel = path.relative(ANIMS_DIR, fbxPath);
    progress.start(rel);
    try {
      const result = convertFile(fbxPath, { force: values.force });
      if (result.status === 'converted') {
        converted++;
        totalFbxSize += result.fbxSize;
        totalGlbSize += result.glbSize;
        progress.end(`OK (${result.animations} clips, ${result.bones} bones, ${result.savings} smaller)`);
      } else {
        skipped++;
        progress.end('SKIPPED (GLB exists)');
      }
      return result;
    } catch (err) {
      failures.add({ file: rel, error: err });
      progress.end(`ERROR: ${err.message}`);
      return { __error: err };
    }
  });
  void results;

  console.log(`\n--- Summary ---`);
  console.log(`Converted: ${converted}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Errors:    ${failures.count}`);
  if (totalFbxSize > 0) {
    console.log(`Total FBX: ${(totalFbxSize / 1024 / 1024).toFixed(1)} MB`);
    console.log(`Total GLB: ${(totalGlbSize / 1024 / 1024).toFixed(1)} MB`);
    console.log(`Space saved: ${((1 - totalGlbSize / totalFbxSize) * 100).toFixed(1)}%`);
  }
  failures.printSummary();

  return { failures: failures.count };
}

makeMain(main, { scriptName: 'convert-fbx-to-glb' })();
