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

const REFERENCES = [
  'Arming_Sword.glb',
  'Great_Sword.glb',
  'Bow.glb',
  'Spear.glb',
  'Dagger.glb',
  'War_Hammer.glb',
];
const NEW_FILES = [
  'Medieval_Sword.glb', 'Slam_Hammer.glb', 'Medieval_Bow.glb',
  'One_Side_Axe.glb', 'Double_Side_Axe.glb', 'Spiked_Mace.glb', 'Medieval_Mace.glb',
  'Medieval_Spear.glb', 'Spear_With_Knife.glb',
  'Medieval_Dagger_A.glb', 'Medieval_Dagger_B.glb',
  'Medieval_Shield_1.glb', 'Medieval_Shield_2.glb', 'Medieval_Shield_3.glb',
  'Medieval_Arrow.glb', 'Arrow_Bag.glb', 'Quarterstaff.glb',
];

const loader = new GLTFLoader();

async function measure(file) {
  const buf = fs.readFileSync(path.join(DIR, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => {
    loader.parse(ab, '', (gltf) => {
      const bbox = new THREE.Box3().setFromObject(gltf.scene);
      const size = new THREE.Vector3(); bbox.getSize(size);
      const longest = Math.max(size.x, size.y, size.z);
      resolve({ file, x: size.x, y: size.y, z: size.z, longest });
    }, reject);
  });
}

console.log('--- Existing reference weapons ---');
for (const f of REFERENCES) {
  try {
    const r = await measure(f);
    console.log(`${r.file.padEnd(28)}  ${r.x.toFixed(3)} x ${r.y.toFixed(3)} x ${r.z.toFixed(3)}  longest=${r.longest.toFixed(3)}`);
  } catch (e) { console.log(`${f}: ${e.message}`); }
}

console.log('\n--- New medieval pack weapons ---');
for (const f of NEW_FILES) {
  try {
    const r = await measure(f);
    console.log(`${r.file.padEnd(28)}  ${r.x.toFixed(3)} x ${r.y.toFixed(3)} x ${r.z.toFixed(3)}  longest=${r.longest.toFixed(3)}`);
  } catch (e) { console.log(`${f}: ${e.message}`); }
}
