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

// Files that were rotated by ROT_Z_TO_Y in extract_medieval_pack.mjs.
// These are the ones where the head/butt orientation along +Y vs -Y is
// ambiguous (the original Z axis is symmetric about 0 so picking +Z=head
// vs -Z=head is a guess). Per Task #33 we check whether the head ended
// up at +Y (correct, "head up out of the hand") or -Y (upside down).
const ROTATED_FILES = [
  'Slam_Hammer.glb',
  'Spiked_Mace.glb',
  'Medieval_Spear.glb',
  'Double_Side_Axe.glb',
  'Medieval_Dagger_A.glb',
  'Medieval_Dagger_B.glb',
  'Medieval_Shield_1.glb',
  'Medieval_Arrow.glb',
];

// Reference weapons that were NOT rotated and are visually known-good
// (Y-long, head at +Y) so we can sanity-check the heuristic.
const REFERENCE_FILES = [
  'Medieval_Sword.glb',
  'One_Side_Axe.glb',
  'Medieval_Mace.glb',
  'Spear_With_Knife.glb',
  'Quarterstaff.glb',
  'Medieval_Shield_2.glb',
  'Medieval_Shield_3.glb',
];

// Known-good KayKit reference weapons that the existing
// `WEAPON_PACK_WEAPONS` already attaches correctly in-hand. These are the
// "ground truth" for the head-up convention and are used to validate the
// heuristic itself.
const KAYKIT_REFERENCE_FILES = [
  'Arming_Sword.glb',
  'Great_Sword.glb',
  'Spear.glb',
  'Halberd.glb',
  'Bearded_Axe.glb',
  'Hatchet.glb',
  'War_Hammer.glb',
  'Anvil_Hammer.glb',
  'Falchion.glb',
  'Kriegmesser.glb',
  'Pitchfork.glb',
];

const loader = new GLTFLoader();

async function loadGltf(file) {
  const buf = fs.readFileSync(path.join(DIR, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => {
    loader.parse(ab, '', (gltf) => resolve(gltf), reject);
  });
}

// Walk every triangle of every mesh in the scene (in WORLD space) and
// accumulate two stats per Y-bin:
//   - triangle area (true surface area)
//   - cross-sectional XZ extent (how "wide" the slice is)
// Then split the bbox into a top half (+Y) and bottom half (-Y) and
// compare. Whichever half has the larger area + wider slices is the
// "head" end; the other is the "handle/butt" end.
function analyse(gltf) {
  const bbox = new THREE.Box3().setFromObject(gltf.scene);
  const min = bbox.min, max = bbox.max;
  const sizeY = max.y - min.y;
  if (sizeY <= 1e-6) return null;

  const N_BINS = 32;
  const binArea = new Float64Array(N_BINS);
  const binMinX = new Float64Array(N_BINS).fill(Infinity);
  const binMaxX = new Float64Array(N_BINS).fill(-Infinity);
  const binMinZ = new Float64Array(N_BINS).fill(Infinity);
  const binMaxZ = new Float64Array(N_BINS).fill(-Infinity);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab2 = new THREE.Vector3();
  const ac2 = new THREE.Vector3();
  const cross = new THREE.Vector3();

  function binFor(y) {
    const t = (y - min.y) / sizeY;
    let i = Math.floor(t * N_BINS);
    if (i < 0) i = 0;
    if (i >= N_BINS) i = N_BINS - 1;
    return i;
  }

  function noteVertex(v) {
    const i = binFor(v.y);
    if (v.x < binMinX[i]) binMinX[i] = v.x;
    if (v.x > binMaxX[i]) binMaxX[i] = v.x;
    if (v.z < binMinZ[i]) binMinZ[i] = v.z;
    if (v.z > binMaxZ[i]) binMaxZ[i] = v.z;
  }

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

      ab2.subVectors(b, a);
      ac2.subVectors(c, a);
      cross.crossVectors(ab2, ac2);
      const area = 0.5 * cross.length();

      const cy = (a.y + b.y + c.y) / 3;
      const cbin = binFor(cy);
      binArea[cbin] += area;
      noteVertex(a);
      noteVertex(b);
      noteVertex(c);
    }
  });

  // Per-bin cross-sectional "width" = max(xExtent, zExtent) of geometry
  // observed in that slice. Use 0 for empty bins.
  const binWidth = new Float64Array(N_BINS);
  for (let i = 0; i < N_BINS; i++) {
    if (binMinX[i] === Infinity) {
      binWidth[i] = 0;
    } else {
      const wx = binMaxX[i] - binMinX[i];
      const wz = binMaxZ[i] - binMinZ[i];
      binWidth[i] = Math.max(wx, wz);
    }
  }

  // Split into top (+Y) and bottom (-Y) halves and compare.
  const half = N_BINS / 2;
  let topArea = 0, botArea = 0;
  let topWidthSum = 0, botWidthSum = 0;
  let topMaxWidth = 0, botMaxWidth = 0;
  for (let i = 0; i < N_BINS; i++) {
    const isTop = i >= half;
    if (isTop) {
      topArea += binArea[i];
      topWidthSum += binWidth[i];
      if (binWidth[i] > topMaxWidth) topMaxWidth = binWidth[i];
    } else {
      botArea += binArea[i];
      botWidthSum += binWidth[i];
      if (binWidth[i] > botMaxWidth) botMaxWidth = binWidth[i];
    }
  }

  // Where in the Y axis is the geometry's centre of (triangle) area?
  // For a head-up weapon this should sit ABOVE the geometric mid-line
  // because the head is the heavy end (more triangles & area near +Y).
  let totalArea = 0, weightedY = 0;
  for (let i = 0; i < N_BINS; i++) {
    const yMid = min.y + (i + 0.5) / N_BINS * sizeY;
    weightedY += yMid * binArea[i];
    totalArea += binArea[i];
  }
  const areaCentreY = totalArea > 0 ? weightedY / totalArea : 0;
  const midY = (min.y + max.y) / 2;
  const areaCentreOffset = (areaCentreY - midY) / (sizeY * 0.5); // -1..+1

  return {
    sizeY,
    topArea, botArea,
    topWidthSum, botWidthSum,
    topMaxWidth, botMaxWidth,
    areaCentreOffset,
    binArea: Array.from(binArea),
    binWidth: Array.from(binWidth),
  };
}

function verdict(s) {
  // Three independent signals, each gives "+1 = head at +Y", "-1 = head at -Y".
  const areaSig = Math.sign(s.topArea - s.botArea);
  const widthSumSig = Math.sign(s.topWidthSum - s.botWidthSum);
  const widthMaxSig = Math.sign(s.topMaxWidth - s.botMaxWidth);
  const centreSig = Math.sign(s.areaCentreOffset);
  const total = areaSig + widthSumSig + widthMaxSig + centreSig;
  let label;
  if (total >= 2) label = 'HEAD AT +Y (correct)';
  else if (total <= -2) label = 'HEAD AT -Y (UPSIDE DOWN — needs flip)';
  else label = 'AMBIGUOUS (visual check needed)';
  return { areaSig, widthSumSig, widthMaxSig, centreSig, total, label };
}

function fmt(s, v) {
  return {
    file: s,
    sizeY: v.sizeY.toFixed(3),
    topArea: v.topArea.toFixed(3),
    botArea: v.botArea.toFixed(3),
    areaRatio: (v.topArea / Math.max(v.botArea, 1e-9)).toFixed(3),
    topWMax: v.topMaxWidth.toFixed(3),
    botWMax: v.botMaxWidth.toFixed(3),
    areaCentreOffset: v.areaCentreOffset.toFixed(3),
  };
}

console.log('=== KayKit known-good reference weapons (heuristic ground truth) ===\n');
for (const f of KAYKIT_REFERENCE_FILES) {
  try {
    const g = await loadGltf(f);
    const v = analyse(g);
    if (!v) { console.log(`${f}: zero Y extent`); continue; }
    const ver = verdict(v);
    const m = fmt(f, v);
    console.log(`${f.padEnd(28)} top/bot area=${m.topArea}/${m.botArea} (ratio ${m.areaRatio})  top/bot maxWidth=${m.topWMax}/${m.botWMax}  centreOff=${m.areaCentreOffset}  -> ${ver.label}`);
  } catch (e) { console.log(`${f}: ${e.message}`); }
}

console.log('\n=== Already-Y-long medieval weapons (no rotation needed; sanity check) ===\n');
for (const f of REFERENCE_FILES) {
  try {
    const g = await loadGltf(f);
    const v = analyse(g);
    if (!v) { console.log(`${f}: zero Y extent`); continue; }
    const ver = verdict(v);
    const m = fmt(f, v);
    console.log(`${f.padEnd(28)} top/bot area=${m.topArea}/${m.botArea} (ratio ${m.areaRatio})  top/bot maxWidth=${m.topWMax}/${m.botWMax}  centreOff=${m.areaCentreOffset}  -> ${ver.label}`);
  } catch (e) { console.log(`${f}: ${e.message}`); }
}

console.log('\n=== Rotated medieval weapons (orientation under test) ===\n');
const flips = [];
for (const f of ROTATED_FILES) {
  try {
    const g = await loadGltf(f);
    const v = analyse(g);
    if (!v) { console.log(`${f}: zero Y extent`); continue; }
    const ver = verdict(v);
    const m = fmt(f, v);
    console.log(`${f.padEnd(28)} top/bot area=${m.topArea}/${m.botArea} (ratio ${m.areaRatio})  top/bot maxWidth=${m.topWMax}/${m.botWMax}  centreOff=${m.areaCentreOffset}  -> ${ver.label}`);
    if (ver.total <= -2) flips.push(f);
  } catch (e) { console.log(`${f}: ${e.message}`); }
}

console.log('\n=== Summary ===');
if (flips.length === 0) {
  console.log('No flips required.');
} else {
  console.log('Flip required for:');
  for (const f of flips) console.log(`  - ${f}`);
}
