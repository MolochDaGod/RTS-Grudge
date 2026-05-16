// Quick geometric asymmetry check: for each weapon GLB, compute the
// area-weighted Y-centroid of all triangles. If centroid_y is significantly
// above the bbox center, the heavy end is at +Y (head up). If below, the
// heavy end is at -Y (head down → upside-down → flip needed).
//
// Also reports the centroid position normalised to [-1, +1] over the bbox
// height so the magnitude is comparable across weapons.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (typeof globalThis.window === 'undefined') globalThis.window = { URL: { createObjectURL: () => '' } };
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;

const THREE = await import('three');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const GLB_DIR = path.join(ROOT, 'client/public/models/weapon_pack');

const FILES = [
  'Slam_Hammer.glb',       // expect: head -Y (flip)  per visual
  'Spiked_Mace.glb',       // expect: head -Y (flip)
  'Double_Side_Axe.glb',   // expect: head -Y (flip)
  'Medieval_Spear.glb',    // expect: head +Y (correct)
  'Medieval_Dagger_A.glb', // ambiguous
  'Medieval_Dagger_B.glb', // ambiguous
  'Medieval_Shield_1.glb', // ambiguous
  'Medieval_Arrow.glb',    // expect: head +Y (correct)
  'Medieval_Sword.glb',    // ref: head +Y (correct)
  'One_Side_Axe.glb',      // ref
  'Medieval_Mace.glb',     // ref
  'Medieval_Bow.glb',      // ref
  'Medieval_Shield_2.glb', // ref
  'Medieval_Shield_3.glb', // ref
];

const loader = new GLTFLoader();

async function loadGltf(file) {
  const buf = fs.readFileSync(path.join(GLB_DIR, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((res, rej) => loader.parse(ab, '', res, rej));
}

console.log('file                          bboxY      cY      cYnorm  topMass  botMass  topPeakY  botPeakY  verdict');
console.log('---------------------------------------------------------------------------------------------------------');

for (const f of FILES) {
  try {
    const g = await loadGltf(f);
    g.scene.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(g.scene);
    const minY = bbox.min.y;
    const maxY = bbox.max.y;
    const midY = (minY + maxY) / 2;
    const height = maxY - minY;

    let totalArea = 0;
    let weightedY = 0;
    let topMass = 0; // area of triangles whose centroid is in upper half
    let botMass = 0;
    // Track the most extreme +Y and -Y vertex masses (where is the heaviest
    // single horizontal slice?).
    const NSLICES = 20;
    const sliceArea = new Array(NSLICES).fill(0);

    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    g.scene.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry) return;
      const geom = obj.geometry;
      const pos = geom.attributes.position;
      if (!pos) return;
      const idx = geom.index;
      const matrix = obj.matrixWorld;
      const triCount = idx ? idx.count / 3 : pos.count / 3;
      for (let t = 0; t < triCount; t++) {
        let i0, i1, i2;
        if (idx) { i0 = idx.getX(t * 3); i1 = idx.getX(t * 3 + 1); i2 = idx.getX(t * 3 + 2); }
        else      { i0 = t * 3; i1 = t * 3 + 1; i2 = t * 3 + 2; }
        a.fromBufferAttribute(pos, i0).applyMatrix4(matrix);
        b.fromBufferAttribute(pos, i1).applyMatrix4(matrix);
        c.fromBufferAttribute(pos, i2).applyMatrix4(matrix);
        const ab = b.clone().sub(a);
        const ac = c.clone().sub(a);
        const area = ab.cross(ac).length() * 0.5;
        const cy = (a.y + b.y + c.y) / 3;
        totalArea += area;
        weightedY += cy * area;
        if (cy > midY) topMass += area; else botMass += area;
        const sliceIdx = Math.min(NSLICES - 1, Math.max(0, Math.floor((cy - minY) / height * NSLICES)));
        sliceArea[sliceIdx] += area;
      }
    });

    const cY = weightedY / Math.max(1e-9, totalArea);
    const cYnorm = (cY - midY) / (height / 2);

    // Find heaviest top slice and heaviest bottom slice.
    let topPeakIdx = -1, botPeakIdx = -1, topPeakArea = 0, botPeakArea = 0;
    for (let i = 0; i < NSLICES; i++) {
      if (i >= NSLICES / 2) {
        if (sliceArea[i] > topPeakArea) { topPeakArea = sliceArea[i]; topPeakIdx = i; }
      } else {
        if (sliceArea[i] > botPeakArea) { botPeakArea = sliceArea[i]; botPeakIdx = i; }
      }
    }
    const topPeakY = (topPeakIdx + 0.5) / NSLICES;
    const botPeakY = (botPeakIdx + 0.5) / NSLICES;

    // Verdict: where is the head?
    //   cYnorm > +0.05 → head likely at +Y (correct, no flip)
    //   cYnorm < -0.05 → head likely at -Y (flip)
    //   |cYnorm| < 0.05 → symmetric / ambiguous
    let verdict;
    if (cYnorm > 0.05) verdict = 'HEAD AT +Y (correct)';
    else if (cYnorm < -0.05) verdict = 'HEAD AT -Y (FLIP)';
    else verdict = 'symmetric / ambiguous';

    console.log(
      `${f.padEnd(28)}  ${height.toFixed(2).padStart(6)}  ${cY.toFixed(2).padStart(6)}  ${cYnorm.toFixed(3).padStart(6)}  ${topMass.toFixed(2).padStart(7)}  ${botMass.toFixed(2).padStart(7)}  ${topPeakY.toFixed(2).padStart(7)}  ${botPeakY.toFixed(2).padStart(7)}  ${verdict}`,
    );
  } catch (e) {
    console.log(`${f.padEnd(28)}  ERROR: ${e.message}`);
  }
}
