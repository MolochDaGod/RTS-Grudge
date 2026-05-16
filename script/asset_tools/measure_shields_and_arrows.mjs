import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (typeof globalThis.window === 'undefined') globalThis.window = { URL: { createObjectURL: () => '' } };
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;

const THREE = await import('three');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const FILES = [
  'client/public/models/kaykit_weapons/shield_A.glb',
  'client/public/models/kaykit_weapons/shield_B.glb',
  'client/public/models/kaykit_weapons/shield_C.glb',
  'client/public/models/weapon_pack/Blunt_Arrow.glb',
  'client/public/models/weapon_pack/Broadhead_Arrow.glb',
  'client/public/models/weapon_pack/Piercing_Arrow.glb',
];

const loader = new GLTFLoader();
for (const f of FILES) {
  const buf = fs.readFileSync(path.join(ROOT, f));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  await new Promise((resolve, reject) => {
    loader.parse(ab, '', (g) => {
      const b = new THREE.Box3().setFromObject(g.scene);
      const s = new THREE.Vector3(); b.getSize(s);
      console.log(`${f.padEnd(60)}  ${s.x.toFixed(2)} x ${s.y.toFixed(2)} x ${s.z.toFixed(2)}  longest=${Math.max(s.x,s.y,s.z).toFixed(2)}`);
      resolve();
    }, reject);
  });
}
