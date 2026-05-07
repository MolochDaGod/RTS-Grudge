const fs = require('fs');
const path = require('path');

const ANIMS_DIR = path.resolve(__dirname, '../client/public/models/animations');

const MIXAMO_BONE_MAP = {
  'Hips': 'mixamorigHips',
  'Spine': 'mixamorigSpine',
  'Spine1': 'mixamorigSpine1',
  'Spine2': 'mixamorigSpine2',
  'Neck': 'mixamorigNeck',
  'Head': 'mixamorigHead',
  'HeadTop_End': 'mixamorigHeadTop_End',
  'LeftShoulder': 'mixamorigLeftShoulder',
  'LeftArm': 'mixamorigLeftArm',
  'LeftForeArm': 'mixamorigLeftForeArm',
  'LeftHand': 'mixamorigLeftHand',
  'LeftHandThumb1': 'mixamorigLeftHandThumb1',
  'LeftHandThumb2': 'mixamorigLeftHandThumb2',
  'LeftHandThumb3': 'mixamorigLeftHandThumb3',
  'LeftHandThumb4': 'mixamorigLeftHandThumb4',
  'LeftHandIndex1': 'mixamorigLeftHandIndex1',
  'LeftHandIndex2': 'mixamorigLeftHandIndex2',
  'LeftHandIndex3': 'mixamorigLeftHandIndex3',
  'LeftHandIndex4': 'mixamorigLeftHandIndex4',
  'LeftHandMiddle1': 'mixamorigLeftHandMiddle1',
  'LeftHandMiddle2': 'mixamorigLeftHandMiddle2',
  'LeftHandMiddle3': 'mixamorigLeftHandMiddle3',
  'LeftHandMiddle4': 'mixamorigLeftHandMiddle4',
  'LeftHandRing1': 'mixamorigLeftHandRing1',
  'LeftHandRing2': 'mixamorigLeftHandRing2',
  'LeftHandRing3': 'mixamorigLeftHandRing3',
  'LeftHandRing4': 'mixamorigLeftHandRing4',
  'LeftHandPinky1': 'mixamorigLeftHandPinky1',
  'LeftHandPinky2': 'mixamorigLeftHandPinky2',
  'LeftHandPinky3': 'mixamorigLeftHandPinky3',
  'LeftHandPinky4': 'mixamorigLeftHandPinky4',
  'RightShoulder': 'mixamorigRightShoulder',
  'RightArm': 'mixamorigRightArm',
  'RightForeArm': 'mixamorigRightForeArm',
  'RightHand': 'mixamorigRightHand',
  'RightHandThumb1': 'mixamorigRightHandThumb1',
  'RightHandThumb2': 'mixamorigRightHandThumb2',
  'RightHandThumb3': 'mixamorigRightHandThumb3',
  'RightHandThumb4': 'mixamorigRightHandThumb4',
  'RightHandIndex1': 'mixamorigRightHandIndex1',
  'RightHandIndex2': 'mixamorigRightHandIndex2',
  'RightHandIndex3': 'mixamorigRightHandIndex3',
  'RightHandIndex4': 'mixamorigRightHandIndex4',
  'RightHandMiddle1': 'mixamorigRightHandMiddle1',
  'RightHandMiddle2': 'mixamorigRightHandMiddle2',
  'RightHandMiddle3': 'mixamorigRightHandMiddle3',
  'RightHandMiddle4': 'mixamorigRightHandMiddle4',
  'RightHandRing1': 'mixamorigRightHandRing1',
  'RightHandRing2': 'mixamorigRightHandRing2',
  'RightHandRing3': 'mixamorigRightHandRing3',
  'RightHandRing4': 'mixamorigRightHandRing4',
  'RightHandPinky1': 'mixamorigRightHandPinky1',
  'RightHandPinky2': 'mixamorigRightHandPinky2',
  'RightHandPinky3': 'mixamorigRightHandPinky3',
  'RightHandPinky4': 'mixamorigRightHandPinky4',
  'LeftUpLeg': 'mixamorigLeftUpLeg',
  'LeftLeg': 'mixamorigLeftLeg',
  'LeftFoot': 'mixamorigLeftFoot',
  'LeftToeBase': 'mixamorigLeftToeBase',
  'LeftToe_End': 'mixamorigLeftToe_End',
  'RightUpLeg': 'mixamorigRightUpLeg',
  'RightLeg': 'mixamorigRightLeg',
  'RightFoot': 'mixamorigRightFoot',
  'RightToeBase': 'mixamorigRightToeBase',
  'RightToe_End': 'mixamorigRightToe_End',
};

function needsNormalization(glbPath) {
  const buf = fs.readFileSync(glbPath);
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546C67) return false;

  const jsonLen = buf.readUInt32LE(12);
  const jsonStr = buf.slice(20, 20 + jsonLen).toString('utf8');
  const gltf = JSON.parse(jsonStr);

  if (!gltf.nodes) return false;
  const hasPlainHips = gltf.nodes.some(n => n.name === 'Hips');
  const hasMixamoHips = gltf.nodes.some(n => n.name === 'mixamorigHips');
  return hasPlainHips && !hasMixamoHips;
}

function normalizeGlb(glbPath) {
  const buf = fs.readFileSync(glbPath);
  const jsonLen = buf.readUInt32LE(12);
  const jsonStr = buf.slice(20, 20 + jsonLen).toString('utf8');
  const gltf = JSON.parse(jsonStr);

  let changed = false;

  if (gltf.nodes) {
    for (const node of gltf.nodes) {
      if (node.name && MIXAMO_BONE_MAP[node.name]) {
        node.name = MIXAMO_BONE_MAP[node.name];
        changed = true;
      }
    }
  }

  if (gltf.animations) {
    for (const anim of gltf.animations) {
      if (anim.channels) {
        for (const ch of anim.channels) {
          if (ch.target && ch.target.node !== undefined) {
            const nodeName = gltf.nodes[ch.target.node]?.name;
          }
        }
      }
    }
  }

  if (!changed) return false;

  const newJsonStr = JSON.stringify(gltf);
  const newJsonBuf = Buffer.from(newJsonStr, 'utf8');
  const jsonPadding = (4 - (newJsonBuf.length % 4)) % 4;
  const paddedJson = jsonPadding > 0
    ? Buffer.concat([newJsonBuf, Buffer.alloc(jsonPadding, 0x20)])
    : newJsonBuf;

  const binChunkStart = 20 + jsonLen;
  const binPreamble = buf.slice(binChunkStart - 8, binChunkStart);
  const binLen = buf.readUInt32LE(binChunkStart);
  const binData = buf.slice(binChunkStart + 8, binChunkStart + 8 + binLen);
  const binPadding = (4 - (binData.length % 4)) % 4;
  const paddedBin = binPadding > 0
    ? Buffer.concat([binData, Buffer.alloc(binPadding, 0x00)])
    : binData;

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

  const result = Buffer.concat([header, jsonChunkHeader, paddedJson, binChunkHeader, paddedBin]);
  fs.writeFileSync(glbPath, result);
  return true;
}

function findAllGlb(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAllGlb(full));
    } else if (entry.name.toLowerCase().endsWith('.glb')) {
      results.push(full);
    }
  }
  return results;
}

function main() {
  const allGlb = findAllGlb(ANIMS_DIR);
  console.log(`Found ${allGlb.length} GLB files to check\n`);

  let normalized = 0;
  let skipped = 0;

  for (const glbPath of allGlb) {
    const rel = path.relative(ANIMS_DIR, glbPath);

    try {
      if (needsNormalization(glbPath)) {
        if (normalizeGlb(glbPath)) {
          normalized++;
          console.log(`FIXED: ${rel}`);
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    } catch (e) {
      console.log(`ERROR: ${rel} - ${e.message}`);
    }
  }

  console.log(`\nNormalized: ${normalized}`);
  console.log(`Already correct: ${skipped}`);
}

main();
