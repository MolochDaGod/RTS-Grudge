// Inspect the world-space Y values of vertices in Slam_Hammer.glb to see
// whether the in-extractor rotation actually moved the hammer head to +Y.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (typeof globalThis.window === 'undefined') globalThis.window = { URL: { createObjectURL: () => '' } };
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;

const THREE = await import('three');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const file = process.argv[2] || 'Slam_Hammer.glb';
const fullPath = path.join(ROOT, 'client/public/models/weapon_pack', file);
const buf = fs.readFileSync(fullPath);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const loader = new GLTFLoader();
const g = await new Promise((res, rej) => loader.parse(ab, '', res, rej));
g.scene.updateMatrixWorld(true);

console.log(`File: ${file}`);
console.log(`Scene tree:`);
g.scene.traverse((obj) => {
  const indent = '  '.repeat(obj.parent ? 1 + countAncestors(obj) : 0);
  const r = obj.rotation;
  const p = obj.position;
  const s = obj.scale;
  console.log(`${indent}${obj.type} "${obj.name}"  pos=(${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)})  rot=(${r.x.toFixed(2)},${r.y.toFixed(2)},${r.z.toFixed(2)})  scl=(${s.x.toFixed(2)},${s.y.toFixed(2)},${s.z.toFixed(2)})`);
});

function countAncestors(o) {
  let n = 0;
  let cur = o.parent;
  while (cur && cur !== g.scene) { n++; cur = cur.parent; }
  return n;
}

// World-space bbox.
const bbox = new THREE.Box3().setFromObject(g.scene);
console.log(`World bbox: min=${bbox.min.toArray().map(v => v.toFixed(2)).join(',')}  max=${bbox.max.toArray().map(v => v.toFixed(2)).join(',')}`);
