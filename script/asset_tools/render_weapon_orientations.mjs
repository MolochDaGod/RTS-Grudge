// Renders every (rotated) medieval weapon, plus a few un-rotated reference
// medieval weapons, as a 2D silhouette PNG so a human can visually confirm
// the head end is at +Y. Avoids WebGL / browser dependencies entirely:
//
//   1. Load each GLB with three's GLTFLoader (Node).
//   2. Project every triangle onto the chosen plane (YX or YZ, picked to
//      view the FLAT face of the weapon).
//   3. Build an SVG containing those triangles (depth-sorted by world Y is
//      not needed, since the silhouette is what we care about).
//   4. Rasterise the SVG to PNG with sharp.
//
// All PNGs are written to `/tmp/weapon_orientations/`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (typeof globalThis.window === 'undefined') globalThis.window = { URL: { createObjectURL: () => '' } };
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;

const THREE = await import('three');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const sharp = (await import('sharp')).default;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const GLB_DIR = path.join(ROOT, 'client/public/models/weapon_pack');
const OUT_DIR = '/tmp/weapon_orientations';
fs.mkdirSync(OUT_DIR, { recursive: true });

const WEAPONS = [
  { file: 'Slam_Hammer.glb',       rotated: true },
  { file: 'Spiked_Mace.glb',       rotated: true },
  { file: 'Double_Side_Axe.glb',   rotated: true },
  { file: 'Medieval_Spear.glb',    rotated: true },
  { file: 'Medieval_Dagger_A.glb', rotated: true },
  { file: 'Medieval_Dagger_B.glb', rotated: true },
  { file: 'Medieval_Shield_1.glb', rotated: true },
  { file: 'Medieval_Arrow.glb',    rotated: true },
  { file: 'Medieval_Sword.glb',    rotated: false },
  { file: 'One_Side_Axe.glb',      rotated: false },
  { file: 'Medieval_Mace.glb',     rotated: false },
  { file: 'Medieval_Bow.glb',      rotated: false },
  { file: 'Spear_With_Knife.glb',  rotated: false },
  { file: 'Quarterstaff.glb',      rotated: false },
  { file: 'Medieval_Shield_2.glb', rotated: false },
  { file: 'Medieval_Shield_3.glb', rotated: false },
  { file: 'Arrow_Bag.glb',         rotated: false },
];

const loader = new GLTFLoader();

async function loadGltf(file) {
  const buf = fs.readFileSync(path.join(GLB_DIR, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((res, rej) => loader.parse(ab, '', res, rej));
}

// Project all triangles in the GLB onto a 2D plane and emit SVG path data.
// `forceHorizAxis` overrides the default (which uses the wider of X/Z as
// the horizontal axis and the narrower as the view-axis). Pass 'X' or 'Z'
// to force a particular plane.
function buildSvg(gltf, panelW, panelH, weapon, forceHorizAxis) {
  gltf.scene.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(gltf.scene);
  const min = bbox.min, max = bbox.max;
  const sx = max.x - min.x, sy = max.y - min.y, sz = max.z - min.z;
  const useZ = forceHorizAxis ? forceHorizAxis === 'Z' : sz > sx;
  const minH = useZ ? min.z : min.x;
  const sh   = useZ ? sz   : sx;
  const horizAxis = useZ ? 'Z' : 'X';

  const padding = 16;
  const labelArea = 36;
  const drawW = panelW - padding * 2;
  const drawH = panelH - padding * 2 - labelArea;
  // Fit the geometry into drawW x drawH preserving aspect ratio.
  const scale = Math.min(drawW / sh, drawH / sy);
  const drawnW = sh * scale;
  const drawnY = sy * scale;
  const offX = (panelW - drawnW) / 2;
  const offY = padding + (drawH - drawnY) / 2;

  // SVG y grows downward, but we want +Y up. Map y_world -> svg_y so that
  // y_world = max.y (top of model) lands at offY (top of drawing area).
  function projX(v) { return offX + ((useZ ? v.z : v.x) - minH) / sh * drawnW; }
  function projY(v) { return offY + (max.y - v.y) / sy * drawnY; }

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const triangles = [];
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
        i0 = index.getX(t * 3); i1 = index.getX(t * 3 + 1); i2 = index.getX(t * 3 + 2);
      } else {
        i0 = t * 3; i1 = t * 3 + 1; i2 = t * 3 + 2;
      }
      a.fromBufferAttribute(pos, i0).applyMatrix4(matrix);
      b.fromBufferAttribute(pos, i1).applyMatrix4(matrix);
      c.fromBufferAttribute(pos, i2).applyMatrix4(matrix);
      triangles.push([
        projX(a), projY(a), projX(b), projY(b), projX(c), projY(c),
      ]);
    }
  });

  // Background panel + axis arrow + label area.
  const fg = '#dddddd';
  const arrowX = panelW / 2;
  const arrowYTop = offY - 8;
  const arrowYBot = offY + drawnY + 8;
  const labelY = panelH - labelArea / 2;
  const expectedHeadHere = `+Y up (HEAD should be at top)`;
  const sizeStr = `bbox X=${sx.toFixed(2)} Y=${sy.toFixed(2)} Z=${sz.toFixed(2)}  view-axis=${useZ ? 'X' : 'Z'}  horizontal=${horizAxis}`;

  let body = '';
  // Render filled triangles in a single <path> for performance.
  if (triangles.length > 0) {
    let d = '';
    for (const [x1, y1, x2, y2, x3, y3] of triangles) {
      d += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}L${x3.toFixed(1)} ${y3.toFixed(1)}Z`;
    }
    body += `<path d="${d}" fill="#88ccff" fill-opacity="0.55" stroke="#88ccff" stroke-opacity="0.25" stroke-width="0.2"/>`;
  }

  // Up arrow on the right edge to mark the +Y direction.
  body += `
    <line x1="${(panelW - 12).toFixed(1)}" y1="${arrowYTop.toFixed(1)}" x2="${(panelW - 12).toFixed(1)}" y2="${arrowYBot.toFixed(1)}" stroke="#33ff66" stroke-width="2"/>
    <polygon points="${(panelW - 17).toFixed(1)},${(arrowYTop + 8).toFixed(1)} ${(panelW - 7).toFixed(1)},${(arrowYTop + 8).toFixed(1)} ${(panelW - 12).toFixed(1)},${arrowYTop.toFixed(1)}" fill="#33ff66"/>
    <text x="${(panelW - 22).toFixed(1)}" y="${(arrowYTop + 4).toFixed(1)}" font-family="sans-serif" font-size="10" fill="#33ff66" text-anchor="end">+Y (head)</text>
  `;

  // Title and meta labels.
  body += `
    <text x="${padding}" y="14" font-family="sans-serif" font-size="13" font-weight="bold" fill="${weapon.rotated ? '#ffcc66' : '#ccccff'}">${weapon.file}${weapon.rotated ? '  [ROT_Z_TO_Y]' : '  [no rotation]'}</text>
    <text x="${padding}" y="${(labelY + 4).toFixed(1)}" font-family="sans-serif" font-size="10" fill="${fg}">${sizeStr}</text>
    <text x="${padding}" y="${(labelY + 18).toFixed(1)}" font-family="sans-serif" font-size="10" fill="${fg}">${expectedHeadHere}</text>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${panelW}" height="${panelH}" viewBox="0 0 ${panelW} ${panelH}">
    <rect x="0" y="0" width="${panelW}" height="${panelH}" fill="#101418"/>
    ${body}
  </svg>`;
}

const PANEL_W = 360;
const PANEL_H = 420;
const COLS = 4;

// For ambiguous (top-bottom-symmetric) weapons we render BOTH orthogonal
// views so both axes can be inspected.
const DUAL_VIEW = new Set([
  'Medieval_Dagger_A.glb',
  'Medieval_Dagger_B.glb',
  'Medieval_Shield_1.glb',
  'Medieval_Arrow.glb',
  'Medieval_Sword.glb',
]);

const panels = [];
for (const w of WEAPONS) {
  try {
    const g = await loadGltf(w.file);
    if (DUAL_VIEW.has(w.file)) {
      for (const axis of ['X', 'Z']) {
        const svg = buildSvg(g, PANEL_W, PANEL_H, { ...w, file: `${w.file} (h=${axis})` }, axis);
        const png = await sharp(Buffer.from(svg)).png().toBuffer();
        const outPath = path.join(OUT_DIR, w.file.replace(/\.glb$/, `_h${axis}.png`));
        fs.writeFileSync(outPath, png);
        panels.push({ file: `${w.file}_h${axis}`, png, w });
        console.log(`rendered ${w.file} (h=${axis}) -> ${outPath} (${png.length}B)`);
      }
    } else {
      const svg = buildSvg(g, PANEL_W, PANEL_H, w);
      const png = await sharp(Buffer.from(svg)).png().toBuffer();
      const outPath = path.join(OUT_DIR, w.file.replace(/\.glb$/, '.png'));
      fs.writeFileSync(outPath, png);
      panels.push({ file: w.file, png, w });
      console.log(`rendered ${w.file} -> ${outPath} (${png.length}B)`);
    }
  } catch (e) {
    console.error(`failed ${w.file}: ${e.message}`);
  }
}

// Composite all panels into one mosaic PNG so the user can see them all.
const ROWS = Math.ceil(panels.length / COLS);
const mosaicW = COLS * PANEL_W;
const mosaicH = ROWS * PANEL_H;
const composites = panels.map((p, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return { input: p.png, top: row * PANEL_H, left: col * PANEL_W };
});
const mosaic = await sharp({
  create: {
    width: mosaicW, height: mosaicH, channels: 3,
    background: { r: 16, g: 20, b: 24 },
  },
}).composite(composites).png().toBuffer();
const mosaicPath = path.join(OUT_DIR, '_mosaic.png');
fs.writeFileSync(mosaicPath, mosaic);
console.log(`mosaic -> ${mosaicPath} (${mosaic.length}B)`);
