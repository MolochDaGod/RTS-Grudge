// NOTE: This is the original one-off script that produced the medieval-pack
// GLBs in `client/public/models/weapon_pack/`. It is kept as a frozen record
// of that import. For NEW packs, use the generalised CLI instead:
//   node script/asset_tools/split_fbx_to_glb.mjs <input.fbx> <output_dir> [...]
// See `script/asset_tools/SPLIT_FBX_TO_GLB.md` for usage and the
// `MEDIEVAL_PACK_IMPORT.md` § "Re-running the import" note for the
// equivalent CLI invocation that recreates this script's output.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    constructor() {
      this.onloadend = null;
      this.onload = null;
      this.onerror = null;
      this.result = null;
    }
    async _read(blob, asWhat) {
      try {
        if (asWhat === 'arraybuffer') {
          this.result = await blob.arrayBuffer();
        } else if (asWhat === 'dataurl') {
          const buf = Buffer.from(await blob.arrayBuffer());
          const mime = blob.type || 'application/octet-stream';
          this.result = `data:${mime};base64,${buf.toString('base64')}`;
        } else {
          this.result = await blob.text();
        }
      } catch (err) {
        if (this.onerror) this.onerror(err);
        return;
      }
      if (this.onload) this.onload({ target: this });
      if (this.onloadend) this.onloadend({ target: this });
    }
    readAsArrayBuffer(blob) { this._read(blob, 'arraybuffer'); }
    readAsDataURL(blob) { this._read(blob, 'dataurl'); }
    readAsText(blob) { this._read(blob, 'text'); }
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = { URL: { createObjectURL: () => '' } };
}
if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const FBX_PATH = path.join(ROOT, 'attached_assets/mEDİAVEL_pACK_1777004586593.fbx');
const OUT_DIR = path.join(ROOT, 'client/public/models/weapon_pack');

// `rotation` (Euler XYZ in radians) is applied to the cloned mesh BEFORE the
// recentering step so the long axis of every wieldable weapon ends up along
// +Y, matching the convention used by KayKit + existing WEAPON_PACK_WEAPONS
// (handle at -Y, blade/head/string at +Y, "thin" axis along Z). Without this
// pass, ~half the medieval weapons come out lying flat along Z and would
// either sink into the wrist or point sideways from the hand.
//
// Detected from `node script/asset_tools/measure_weapon_glbs.mjs` after a
// no-rotation extraction:
//   Z-long (need rotateX(-PI/2) to Y-long): Slam_Hammer, Spiked_Mace,
//     Medieval_Spear, Double_Side_Axe, Medieval_Dagger_A/B, Medieval_Shield_1.
//   X-long (bow convention, kept as-is): Medieval_Bow.
//   Y-long (already correct): everything else.
const ROT_Z_TO_Y = [-Math.PI / 2, 0, 0]; // (x,y,z) -> (x, z, -y)

// For weapons whose source mesh has the head pointing along -Z (so plain
// ROT_Z_TO_Y above puts the head at -Y, i.e. upside-down in the player's
// hand), use the OPPOSITE X rotation. Both rotations send the source's Z
// axis to world Y (so the long axis still ends up vertical), but the sign
// determines which end of the source's Z axis lands at +Y:
//   rotateX(-PI/2): (x, y, z) -> (x,  z, -y)   →  +source_Z lands at +world_Y
//   rotateX(+PI/2): (x, y, z) -> (x, -z,  y)   →  -source_Z lands at +world_Y
// Note: an Euler-XYZ rotation of [-PI/2, 0, PI] does NOT flip Y because the
// Z rotation is applied BEFORE the X rotation in XYZ order, so the 180°
// about Z merely flips the source's X+Y (which become world's X+Z after
// the X rotation) and leaves world Y = source Z unchanged.
//
// Discovered with `node script/asset_tools/render_weapon_orientations.mjs`
// + `node script/asset_tools/_centroid_y.mjs`. After plain ROT_Z_TO_Y the
// area-weighted Y-centroid (normalised to bbox half-height) was:
//   Slam_Hammer     -0.64   (heavy hammer block at -Y → upside-down)
//   Spiked_Mace     -0.50   (spiked ball at -Y       → upside-down)
//   Double_Side_Axe -0.38   (axe blades at -Y        → upside-down)
//   Medieval_Spear  +0.18   (spearhead at +Y         → correct, keep)
//   Medieval_Dagger +0.01   (perfectly symmetric     → flip is a no-op, keep)
//   Medieval_Shield +0.37   (boss/cross-arms at +Y   → correct, keep)
//   Medieval_Arrow  -0.30   (fletching has more area than head, but visually
//                            the arrowhead is at +Y                → correct, keep)
const ROT_Z_TO_Y_FLIP = [Math.PI / 2, 0, 0];

const WEAPON_TARGETS = [
  { fbxName: 'Sword001',            outFile: 'Medieval_Sword.glb',     label: 'Medieval Sword' },
  { fbxName: 'Slam_Hammer001',      outFile: 'Slam_Hammer.glb',        label: 'Slam Hammer',       rotation: ROT_Z_TO_Y_FLIP },
  { fbxName: 'Bow001',              outFile: 'Medieval_Bow.glb',       label: 'Medieval Bow' },
  { fbxName: 'One_Side_Axe001',     outFile: 'One_Side_Axe.glb',       label: 'One-Side Axe' },
  { fbxName: 'Double_Side_Axe001',  outFile: 'Double_Side_Axe.glb',    label: 'Double-Side Axe',   rotation: ROT_Z_TO_Y_FLIP },
  { fbxName: 'Spiked_Maze001',      outFile: 'Spiked_Mace.glb',        label: 'Spiked Mace',       rotation: ROT_Z_TO_Y_FLIP },
  { fbxName: 'Maze002',             outFile: 'Medieval_Mace.glb',      label: 'Medieval Mace' },
  { fbxName: 'Spear001',            outFile: 'Medieval_Spear.glb',     label: 'Medieval Spear',    rotation: ROT_Z_TO_Y },
  { fbxName: 'Spear_With_Knife001', outFile: 'Spear_With_Knife.glb',   label: 'Spear With Knife' },
  { fbxName: 'Dagger002',           outFile: 'Medieval_Dagger_A.glb',  label: 'Medieval Dagger A', rotation: ROT_Z_TO_Y },
  { fbxName: 'Dagger003',           outFile: 'Medieval_Dagger_B.glb',  label: 'Medieval Dagger B', rotation: ROT_Z_TO_Y },
  { fbxName: 'Shield_1001',         outFile: 'Medieval_Shield_1.glb',  label: 'Medieval Shield 1', rotation: ROT_Z_TO_Y },
  { fbxName: 'Shield_2001',         outFile: 'Medieval_Shield_2.glb',  label: 'Medieval Shield 2' },
  { fbxName: 'Shield_3001',         outFile: 'Medieval_Shield_3.glb',  label: 'Medieval Shield 3' },
  { fbxName: 'Arrow001',            outFile: 'Medieval_Arrow.glb',     label: 'Medieval Arrow',    rotation: ROT_Z_TO_Y },
  { fbxName: 'Arrow_Bag001',        outFile: 'Arrow_Bag.glb',          label: 'Arrow Bag (Quiver)' },
  { fbxName: 'Stick001',            outFile: 'Quarterstaff.glb',       label: 'Quarterstaff' },
];

const buf = fs.readFileSync(FBX_PATH);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const loader = new FBXLoader();
const root = loader.parse(ab, '');

console.log('--- All named meshes/groups in FBX ---');
const allNames = [];
root.traverse(obj => {
  if (obj.name) allNames.push(`${obj.type}: ${obj.name}`);
});
console.log(allNames.join('\n'));

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const exporter = new GLTFExporter();

function findByName(root, name) {
  let found = null;
  root.traverse(o => { if (!found && o.name === name) found = o; });
  return found;
}

const summary = [];

for (const target of WEAPON_TARGETS) {
  const obj = findByName(root, target.fbxName);
  if (!obj) {
    console.warn(`[skip] ${target.fbxName} not found in FBX`);
    summary.push({ ...target, status: 'missing' });
    continue;
  }
  // Clone deep, detach from parent transform, normalize.
  const clone = obj.clone(true);
  clone.position.set(0, 0, 0);
  if (target.rotation) {
    clone.rotation.set(target.rotation[0], target.rotation[1], target.rotation[2]);
  } else {
    clone.rotation.set(0, 0, 0);
  }
  clone.scale.set(1, 1, 1);

  const wrapper = new THREE.Group();
  wrapper.name = target.label.replace(/\s+/g, '_');
  wrapper.add(clone);

  // Compute bounding box AFTER any orientation rotation so the recenter step
  // operates on the corrected long-axis-up frame.
  const bbox = new THREE.Box3().setFromObject(wrapper);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  // Recenter the geometry origin to the bounding box center so the runtime
  // WeaponModelLoader's "centre then bias by gripRatio" step lines the grip
  // up with the hand bone.
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  clone.position.sub(center);

  const result = await new Promise((resolve, reject) => {
    exporter.parse(
      wrapper,
      (gltf) => resolve(gltf),
      (err) => reject(err),
      { binary: true, embedImages: true, onlyVisible: true, includeCustomExtensions: false },
    );
  });

  const outPath = path.join(OUT_DIR, target.outFile);
  fs.writeFileSync(outPath, Buffer.from(result));
  const stat = fs.statSync(outPath);
  console.log(`[ok]   ${target.outFile}  size=${stat.size}B  bbox=${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}`);
  summary.push({ ...target, status: 'ok', size_bytes: stat.size, bbox: { x: size.x, y: size.y, z: size.z } });
}

console.log('\n--- Summary ---');
for (const s of summary) {
  if (s.status === 'ok') {
    console.log(`OK  ${s.outFile}  bbox ${s.bbox.x.toFixed(2)} x ${s.bbox.y.toFixed(2)} x ${s.bbox.z.toFixed(2)}`);
  } else {
    console.log(`MISS  ${s.fbxName}`);
  }
}
