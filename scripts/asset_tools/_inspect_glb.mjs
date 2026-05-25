import fs from 'node:fs';
import path from 'node:path';
if (typeof globalThis.window === 'undefined') globalThis.window = { URL: { createObjectURL: () => '' } };
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;
const THREE = await import('three');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const loader = new GLTFLoader();
const file = process.argv[2];
const buf = fs.readFileSync(file);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const g = await new Promise((res, rej) => loader.parse(ab, '', res, rej));
g.scene.updateMatrixWorld(true);
g.scene.traverse(o => {
  if (o.isMesh && o.geometry) {
    const bb = new THREE.Box3().setFromObject(o);
    const sz = new THREE.Vector3(); bb.getSize(sz);
    const ct = new THREE.Vector3(); bb.getCenter(ct);
    console.log(`MESH ${o.name}  pos=(${o.position.x.toFixed(3)},${o.position.y.toFixed(3)},${o.position.z.toFixed(3)})  rot=(${o.rotation.x.toFixed(3)},${o.rotation.y.toFixed(3)},${o.rotation.z.toFixed(3)})  scl=(${o.scale.x.toFixed(3)},${o.scale.y.toFixed(3)},${o.scale.z.toFixed(3)})  worldBBox center=(${ct.x.toFixed(3)},${ct.y.toFixed(3)},${ct.z.toFixed(3)})  size=(${sz.x.toFixed(3)},${sz.y.toFixed(3)},${sz.z.toFixed(3)})  verts=${o.geometry.attributes.position.count}`);
  } else if (o.name) {
    console.log(`NODE ${o.type} ${o.name}  pos=(${o.position.x.toFixed(3)},${o.position.y.toFixed(3)},${o.position.z.toFixed(3)})  rot=(${o.rotation.x.toFixed(3)},${o.rotation.y.toFixed(3)},${o.rotation.z.toFixed(3)})  scl=(${o.scale.x.toFixed(3)},${o.scale.y.toFixed(3)},${o.scale.z.toFixed(3)})`);
  }
});
