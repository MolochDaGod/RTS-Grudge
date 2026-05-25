import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (typeof globalThis.window === 'undefined') globalThis.window = { URL: { createObjectURL: () => '' } };
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;

const THREE = await import('three');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'client/public/models/weapon_pack');

const ALL_FILES = process.argv.slice(2);
if (ALL_FILES.length === 0) {
  console.log('Usage: node profile_weapon_glbs.mjs <file1.glb> [file2.glb ...]');
  process.exit(1);
}

const loader = new GLTFLoader();

async function loadGltf(file) {
  const buf = fs.readFileSync(path.join(DIR, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => {
    loader.parse(ab, '', (gltf) => resolve(gltf), reject);
  });
}

// Render an ASCII silhouette of the weapon, viewed along whichever of {+X,+Z}
// is the thinnest axis (so we always look at the FLAT face of the weapon, not
// edge-on). Top of the printout is +Y, bottom is -Y, so "is the head end up?"
// is a visual check for whichever way we end up viewing.
function renderSilhouette(gltf, rows = 32, cols = 28) {
  // First pass: gather bbox in world space.
  const bbox = new THREE.Box3().setFromObject(gltf.scene);
  const min = bbox.min, max = bbox.max;
  const sx = max.x - min.x, sy = max.y - min.y, sz = max.z - min.z;
  if (sy <= 1e-6) return ['(degenerate bbox)'];
  // Pick the wider of (X, Z) as the in-plane "horizontal" axis for the
  // silhouette. The other becomes the view direction.
  const useZ = sz > sx;
  const sh = useZ ? sz : sx;
  const minH = useZ ? min.z : min.x;
  if (sh <= 1e-6) return ['(degenerate bbox)'];

  // Second pass: rasterise. For each triangle, sample many points along its
  // surface and stamp them into the grid.
  const grid = new Uint8Array(rows * cols);
  function plot(h, y) {
    const cx = Math.floor((h - minH) / sh * cols);
    const cy = Math.floor((y - min.y) / sy * rows);
    if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) return;
    grid[cy * cols + cx] = 1;
  }

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    const geom = obj.geometry;
    const pos = geom.attributes.position;
    if (!pos) return;
    const index = geom.index;
    const matrix = obj.matrixWorld;

    const triCount = index ? index.count / 3 : pos.count / 3;
    for (let t = 0; t < triCount; t++) {
      let i0, i1, i2;
      if (index) {
        i0 = index.getX(t * 3);
        i1 = index.getX(t * 3 + 1);
        i2 = index.getX(t * 3 + 2);
      } else {
        i0 = t * 3;
        i1 = t * 3 + 1;
        i2 = t * 3 + 2;
      }
      a.fromBufferAttribute(pos, i0).applyMatrix4(matrix);
      b.fromBufferAttribute(pos, i1).applyMatrix4(matrix);
      c.fromBufferAttribute(pos, i2).applyMatrix4(matrix);

      // Barycentric sweep — number of samples scales with triangle size in
      // grid units so even tiny triangles emit at least one dot.
      const ah = useZ ? a.z : a.x;
      const bh = useZ ? b.z : b.x;
      const ch = useZ ? c.z : c.x;
      const minH2 = Math.min(ah, bh, ch), maxH2 = Math.max(ah, bh, ch);
      const minY = Math.min(a.y, b.y, c.y), maxY = Math.max(a.y, b.y, c.y);
      const triW = (maxH2 - minH2) / sh * cols;
      const triH = (maxY - minY) / sy * rows;
      const samples = Math.max(3, Math.ceil(triW + triH) * 2);
      for (let s = 0; s < samples; s++) {
        for (let r = 0; r < samples; r++) {
          let u = s / samples, v = r / samples;
          if (u + v > 1) { u = 1 - u; v = 1 - v; }
          const w = 1 - u - v;
          const h = ah * w + bh * u + ch * v;
          const y = a.y * w + b.y * u + c.y * v;
          plot(h, y);
        }
      }
    }
  });

  // Build text rows: top of the printout is +Y so iterate rows from
  // (rows-1) down to 0.
  const lines = [];
  for (let r = rows - 1; r >= 0; r--) {
    let line = '';
    for (let c2 = 0; c2 < cols; c2++) line += grid[r * cols + c2] ? '#' : '.';
    let label = '';
    if (r === rows - 1) label = `  <- +Y (expect HEAD here) [view along ${useZ ? '+X' : '+Z'}; horizontal=${useZ ? 'Z' : 'X'}; bbox sx=${sx.toFixed(2)} sy=${sy.toFixed(2)} sz=${sz.toFixed(2)}]`;
    if (r === 0)         label = '  <- -Y (expect HANDLE/butt here)';
    if (r === Math.floor(rows / 2)) label = '  <- mid';
    lines.push(line + label);
  }
  return lines;
}

for (const f of ALL_FILES) {
  console.log(`\n========== ${f} ==========`);
  try {
    const g = await loadGltf(f);
    const lines = renderSilhouette(g);
    for (const l of lines) console.log(l);
  } catch (e) {
    console.log(`error: ${e.message}`);
  }
}
