const fs = require('fs');
const path = require('path');

const DEFAULT_PALETTE = [];
for (let i = 0; i < 256; i++) {
  DEFAULT_PALETTE.push([
    ((i * 37 + 50) % 256),
    ((i * 73 + 100) % 256),
    ((i * 113 + 150) % 256),
    255
  ]);
}

const MAGICAVOXEL_DEFAULT_PALETTE = [
  [0,0,0,0],
  [255,255,255,255],[255,255,204,255],[255,255,153,255],[255,255,102,255],[255,255,51,255],[255,255,0,255],
  [255,204,255,255],[255,204,204,255],[255,204,153,255],[255,204,102,255],[255,204,51,255],[255,204,0,255],
  [255,153,255,255],[255,153,204,255],[255,153,153,255],[255,153,102,255],[255,153,51,255],[255,153,0,255],
  [255,102,255,255],[255,102,204,255],[255,102,153,255],[255,102,102,255],[255,102,51,255],[255,102,0,255],
  [255,51,255,255],[255,51,204,255],[255,51,153,255],[255,51,102,255],[255,51,51,255],[255,51,0,255],
  [255,0,255,255],[255,0,204,255],[255,0,153,255],[255,0,102,255],[255,0,51,255],[255,0,0,255],
  [204,255,255,255],[204,255,204,255],[204,255,153,255],[204,255,102,255],[204,255,51,255],[204,255,0,255],
  [204,204,255,255],[204,204,204,255],[204,204,153,255],[204,204,102,255],[204,204,51,255],[204,204,0,255],
  [204,153,255,255],[204,153,204,255],[204,153,153,255],[204,153,102,255],[204,153,51,255],[204,153,0,255],
  [204,102,255,255],[204,102,204,255],[204,102,153,255],[204,102,102,255],[204,102,51,255],[204,102,0,255],
  [204,51,255,255],[204,51,204,255],[204,51,153,255],[204,51,102,255],[204,51,51,255],[204,51,0,255],
  [204,0,255,255],[204,0,204,255],[204,0,153,255],[204,0,102,255],[204,0,51,255],[204,0,0,255],
  [153,255,255,255],[153,255,204,255],[153,255,153,255],[153,255,102,255],[153,255,51,255],[153,255,0,255],
  [153,204,255,255],[153,204,204,255],[153,204,153,255],[153,204,102,255],[153,204,51,255],[153,204,0,255],
  [153,153,255,255],[153,153,204,255],[153,153,153,255],[153,153,102,255],[153,153,51,255],[153,153,0,255],
  [153,102,255,255],[153,102,204,255],[153,102,153,255],[153,102,102,255],[153,102,51,255],[153,102,0,255],
  [153,51,255,255],[153,51,204,255],[153,51,153,255],[153,51,102,255],[153,51,51,255],[153,51,0,255],
  [153,0,255,255],[153,0,204,255],[153,0,153,255],[153,0,102,255],[153,0,51,255],[153,0,0,255],
  [102,255,255,255],[102,255,204,255],[102,255,153,255],[102,255,102,255],[102,255,51,255],[102,255,0,255],
  [102,204,255,255],[102,204,204,255],[102,204,153,255],[102,204,102,255],[102,204,51,255],[102,204,0,255],
  [102,153,255,255],[102,153,204,255],[102,153,153,255],[102,153,102,255],[102,153,51,255],[102,153,0,255],
  [102,102,255,255],[102,102,204,255],[102,102,153,255],[102,102,102,255],[102,102,51,255],[102,102,0,255],
  [102,51,255,255],[102,51,204,255],[102,51,153,255],[102,51,102,255],[102,51,51,255],[102,51,0,255],
  [102,0,255,255],[102,0,204,255],[102,0,153,255],[102,0,102,255],[102,0,51,255],[102,0,0,255],
  [51,255,255,255],[51,255,204,255],[51,255,153,255],[51,255,102,255],[51,255,51,255],[51,255,0,255],
  [51,204,255,255],[51,204,204,255],[51,204,153,255],[51,204,102,255],[51,204,51,255],[51,204,0,255],
  [51,153,255,255],[51,153,204,255],[51,153,153,255],[51,153,102,255],[51,153,51,255],[51,153,0,255],
  [51,102,255,255],[51,102,204,255],[51,102,153,255],[51,102,102,255],[51,102,51,255],[51,102,0,255],
  [51,51,255,255],[51,51,204,255],[51,51,153,255],[51,51,102,255],[51,51,51,255],[51,51,0,255],
  [51,0,255,255],[51,0,204,255],[51,0,153,255],[51,0,102,255],[51,0,51,255],[51,0,0,255],
  [0,255,255,255],[0,255,204,255],[0,255,153,255],[0,255,102,255],[0,255,51,255],[0,255,0,255],
  [0,204,255,255],[0,204,204,255],[0,204,153,255],[0,204,102,255],[0,204,51,255],[0,204,0,255],
  [0,153,255,255],[0,153,204,255],[0,153,153,255],[0,153,102,255],[0,153,51,255],[0,153,0,255],
  [0,102,255,255],[0,102,204,255],[0,102,153,255],[0,102,102,255],[0,102,51,255],[0,102,0,255],
  [0,51,255,255],[0,51,204,255],[0,51,153,255],[0,51,102,255],[0,51,51,255],[0,51,0,255],
  [0,0,255,255],[0,0,204,255],[0,0,153,255],[0,0,102,255],[0,0,51,255],[0,0,0,255],
];

function parseVox(buffer) {
  let offset = 0;
  const read32 = () => { const v = buffer.readInt32LE(offset); offset += 4; return v; };
  const readU32 = () => { const v = buffer.readUInt32LE(offset); offset += 4; return v; };
  const readU8 = () => { const v = buffer.readUInt8(offset); offset += 1; return v; };
  const readStr = (n) => { const s = buffer.toString('ascii', offset, offset + n); offset += n; return s; };

  const magic = readStr(4);
  if (magic !== 'VOX ') throw new Error('Not a VOX file');
  const version = read32();
  console.log(`  VOX version: ${version}`);

  let sizeX = 0, sizeY = 0, sizeZ = 0;
  const voxels = [];
  let palette = null;

  function readChunk() {
    if (offset >= buffer.length) return;
    const id = readStr(4);
    const contentSize = read32();
    const childrenSize = read32();
    const contentStart = offset;

    if (id === 'SIZE') {
      sizeX = read32();
      sizeY = read32();
      sizeZ = read32();
      console.log(`  SIZE: ${sizeX}x${sizeY}x${sizeZ}`);
    } else if (id === 'XYZI') {
      const numVoxels = read32();
      console.log(`  XYZI: ${numVoxels} voxels`);
      for (let i = 0; i < numVoxels; i++) {
        const x = readU8();
        const y = readU8();
        const z = readU8();
        const colorIndex = readU8();
        voxels.push({ x, y, z, colorIndex });
      }
    } else if (id === 'RGBA') {
      palette = [[0,0,0,0]];
      for (let i = 0; i < 255; i++) {
        const r = readU8();
        const g = readU8();
        const b = readU8();
        const a = readU8();
        palette.push([r, g, b, a]);
      }
      readU8(); readU8(); readU8(); readU8();
      console.log(`  RGBA palette loaded (${palette.length} colors)`);
    } else {
      offset = contentStart + contentSize;
    }

    const childEnd = contentStart + contentSize + childrenSize;
    while (offset < childEnd) {
      readChunk();
    }
    offset = childEnd;
  }

  readChunk();

  if (!palette) {
    palette = MAGICAVOXEL_DEFAULT_PALETTE;
    console.log('  Using default MagicaVoxel palette');
  }

  return { sizeX, sizeY, sizeZ, voxels, palette };
}

function isVoxelAt(voxelSet, x, y, z) {
  return voxelSet.has(`${x},${y},${z}`);
}

function voxToMesh(voxData) {
  const { sizeX, sizeY, sizeZ, voxels, palette } = voxData;

  const voxelSet = new Set();
  for (const v of voxels) {
    voxelSet.add(`${v.x},${v.y},${v.z}`);
  }

  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];

  const faces = [
    { dir: [1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], normal: [1,0,0] },
    { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], normal: [-1,0,0] },
    { dir: [0, 1, 0], corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]], normal: [0,1,0] },
    { dir: [0, -1, 0], corners: [[1,0,0],[1,0,1],[0,0,1],[0,0,0]], normal: [0,-1,0] },
    { dir: [0, 0, 1], corners: [[0,0,1],[0,1,1],[1,1,1],[1,0,1]], normal: [0,0,1] },  // fixed winding
    { dir: [0, 0, -1], corners: [[1,0,0],[1,1,0],[0,1,0],[0,0,0]], normal: [0,0,-1] },
  ];

  const cx = sizeX / 2;
  const cy = 0;
  const cz = sizeZ / 2;

  for (const voxel of voxels) {
    const { x, y, z, colorIndex } = voxel;
    const color = palette[colorIndex] || [128, 128, 128, 255];
    const r = color[0] / 255;
    const g = color[1] / 255;
    const b = color[2] / 255;

    for (const face of faces) {
      const nx = x + face.dir[0];
      const ny = y + face.dir[1];
      const nz = z + face.dir[2];

      if (isVoxelAt(voxelSet, nx, ny, nz)) continue;

      const vertStart = positions.length / 3;
      for (const corner of face.corners) {
        positions.push(
          (x + corner[0] - cx),
          (z + corner[2] - cy),
          -(y + corner[1] - cz)
        );
        normals.push(face.normal[0], face.normal[2], -face.normal[1]);
        colors.push(r, g, b, 1.0);
      }
      indices.push(vertStart, vertStart + 1, vertStart + 2);
      indices.push(vertStart, vertStart + 2, vertStart + 3);
    }
  }

  console.log(`  Mesh: ${positions.length / 3} vertices, ${indices.length / 3} triangles`);
  return { positions, normals, colors, indices };
}

function createGLB(mesh) {
  const posArr = new Float32Array(mesh.positions);
  const normArr = new Float32Array(mesh.normals);
  const colorArr = new Float32Array(mesh.colors);

  let idxArr;
  let maxIdx = 0;
  for (let i = 0; i < mesh.indices.length; i++) {
    if (mesh.indices[i] > maxIdx) maxIdx = mesh.indices[i];
  }
  if (maxIdx > 65535) {
    idxArr = new Uint32Array(mesh.indices);
  } else {
    idxArr = new Uint16Array(mesh.indices);
  }

  const posBuf = Buffer.from(posArr.buffer);
  const normBuf = Buffer.from(normArr.buffer);
  const colorBuf = Buffer.from(colorArr.buffer);
  const idxBuf = Buffer.from(idxArr.buffer);

  function pad4(n) { return (n + 3) & ~3; }

  const totalBufLen = pad4(posBuf.length) + pad4(normBuf.length) + pad4(colorBuf.length) + pad4(idxBuf.length);

  let minPos = [Infinity, Infinity, Infinity];
  let maxPos = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < posArr.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      minPos[j] = Math.min(minPos[j], posArr[i+j]);
      maxPos[j] = Math.max(maxPos[j], posArr[i+j]);
    }
  }

  const gltf = {
    asset: { version: "2.0", generator: "vox-to-glb" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "VoxelMesh" }],
    meshes: [{
      primitives: [{
        attributes: {
          POSITION: 0,
          NORMAL: 1,
          COLOR_0: 2,
        },
        indices: 3,
        material: 0,
      }]
    }],
    materials: [{
      pbrMetallicRoughness: {
        metallicFactor: 0.1,
        roughnessFactor: 0.8,
      },
      name: "VoxelMaterial",
    }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: posArr.length / 3,
        type: "VEC3",
        min: minPos,
        max: maxPos,
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: normArr.length / 3,
        type: "VEC3",
      },
      {
        bufferView: 2,
        componentType: 5126,
        count: colorArr.length / 4,
        type: "VEC4",
      },
      {
        bufferView: 3,
        componentType: maxIdx > 65535 ? 5125 : 5123,
        count: mesh.indices.length,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBuf.length, target: 34962 },
      { buffer: 0, byteOffset: pad4(posBuf.length), byteLength: normBuf.length, target: 34962 },
      { buffer: 0, byteOffset: pad4(posBuf.length) + pad4(normBuf.length), byteLength: colorBuf.length, target: 34962 },
      { buffer: 0, byteOffset: pad4(posBuf.length) + pad4(normBuf.length) + pad4(colorBuf.length), byteLength: idxBuf.length, target: 34963 },
    ],
    buffers: [{ byteLength: totalBufLen }],
  };

  const jsonStr = JSON.stringify(gltf);
  const jsonBuf = Buffer.from(jsonStr);
  const jsonPadded = pad4(jsonBuf.length);

  const binData = Buffer.alloc(totalBufLen);
  let off = 0;
  posBuf.copy(binData, off); off = pad4(posBuf.length);
  normBuf.copy(binData, off); off += pad4(normBuf.length);
  colorBuf.copy(binData, off); off += pad4(colorBuf.length);
  idxBuf.copy(binData, off);

  const headerLen = 12;
  const jsonChunkLen = 8 + jsonPadded;
  const binChunkLen = 8 + totalBufLen;
  const totalLen = headerLen + jsonChunkLen + binChunkLen;

  const glb = Buffer.alloc(totalLen);
  let p = 0;

  glb.writeUInt32LE(0x46546C67, p); p += 4;
  glb.writeUInt32LE(2, p); p += 4;
  glb.writeUInt32LE(totalLen, p); p += 4;

  glb.writeUInt32LE(jsonPadded, p); p += 4;
  glb.writeUInt32LE(0x4E4F534A, p); p += 4;
  jsonBuf.copy(glb, p);
  for (let i = jsonBuf.length; i < jsonPadded; i++) {
    glb[p + i] = 0x20;
  }
  p += jsonPadded;

  glb.writeUInt32LE(totalBufLen, p); p += 4;
  glb.writeUInt32LE(0x004E4942, p); p += 4;
  binData.copy(glb, p);

  return glb;
}

const inputDir = process.argv[2] || 'attached_assets';
const outputDir = process.argv[3] || 'client/public/models/fortress';

const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.vox'));
console.log(`Found ${files.length} VOX files to convert\n`);

for (const file of files) {
  const baseName = file.replace(/_\d+\.vox$/, '').replace(/\.vox$/, '');
  const cleanName = baseName.replace(/([A-Z])/g, (m, c, i) => i > 0 ? '_' + c.toLowerCase() : c.toLowerCase());
  console.log(`Converting: ${file} -> ${cleanName}.glb`);

  const buffer = fs.readFileSync(path.join(inputDir, file));
  const voxData = parseVox(buffer);
  const mesh = voxToMesh(voxData);
  const glb = createGLB(mesh);

  const outPath = path.join(outputDir, `${cleanName}.glb`);
  fs.writeFileSync(outPath, glb);
  console.log(`  Written: ${outPath} (${(glb.length / 1024).toFixed(1)} KB)\n`);
}

console.log('Done! All VOX files converted to GLB.');
