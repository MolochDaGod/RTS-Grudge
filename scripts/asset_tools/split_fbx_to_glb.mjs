#!/usr/bin/env node
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

function printUsageAndExit(code = 0) {
  const usage = `
Split a multi-mesh FBX into one GLB per top-level mesh/group.

Usage:
  node script/asset_tools/split_fbx_to_glb.mjs <input.fbx> <output_dir> [options]

Positional:
  <input.fbx>     Path to the source FBX (relative or absolute).
  <output_dir>    Directory to write the GLBs into (created if missing).
                  Required unless --list is passed.

Options:
  --list                      Print every named node in the FBX and exit.
                              No extraction is performed.
  --include <patterns>        Comma-separated list of mesh names (or simple
                              globs using "*") to include. If omitted, every
                              top-level child of the FBX root that contains
                              geometry is exported.
  --exclude <patterns>        Comma-separated list of names/globs to skip
                              even if they match --include.
  --rename <old=new,...>      Rename mapping applied to output basenames.
                              "old" matches the FBX node name (no glob);
                              "new" is used as the output filename without
                              the ".glb" extension.
  --rotate <name=rx,ry,rz;..> Per-mesh Euler XYZ rotation (radians) applied
                              to the cloned mesh BEFORE the recenter step.
                              Use ";" to separate multiple entries.
                              Useful when a pack mixes long-axis-Y meshes
                              with long-axis-Z meshes (see
                              MEDIEVAL_PACK_IMPORT.md for an example).
  --no-recenter               Skip the bounding-box recenter step. By
                              default, each exported mesh has its origin
                              moved to the centre of its world AABB so the
                              runtime loader's "centre + grip bias" pass
                              works without per-asset offsets.
  --quiet                     Only print the final summary table.
  --help, -h                  Print this message and exit.

Examples:
  # 1. Inspect what's inside a new pack:
  node script/asset_tools/split_fbx_to_glb.mjs pack.fbx --list

  # 2. Export every top-level mesh into ./out/:
  node script/asset_tools/split_fbx_to_glb.mjs pack.fbx ./out

  # 3. Export only the wieldable weapons, renaming and rotating two of them:
  node script/asset_tools/split_fbx_to_glb.mjs pack.fbx ./out \\
    --include "Sword001,Bow001,Spear001,Dagger*" \\
    --exclude "*_Holder*" \\
    --rename "Sword001=Medieval_Sword,Bow001=Medieval_Bow" \\
    --rotate "Spear001=-1.5708,0,0;Dagger002=-1.5708,0,0"
`.trim();
  console.log(usage);
  process.exit(code);
}

function requireValue(argv, i, flag) {
  const v = argv[i];
  if (v === undefined || v.startsWith('--')) {
    console.error(`Option ${flag} requires a value (got ${v === undefined ? 'end-of-args' : `"${v}"`}).`);
    process.exit(2);
  }
  return v;
}

function parseArgs(argv) {
  const args = { positional: [], list: false, recenter: true, quiet: false,
                 include: null, exclude: null, rename: {}, rotate: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') printUsageAndExit(0);
    if (a === '--list') { args.list = true; continue; }
    if (a === '--no-recenter') { args.recenter = false; continue; }
    if (a === '--quiet') { args.quiet = true; continue; }
    if (a === '--include') {
      const raw = requireValue(argv, ++i, '--include');
      args.include = raw.split(',').map(s => s.trim()).filter(Boolean);
      if (args.include.length === 0) {
        console.error('Option --include requires at least one non-empty pattern.');
        process.exit(2);
      }
      continue;
    }
    if (a === '--exclude') {
      const raw = requireValue(argv, ++i, '--exclude');
      args.exclude = raw.split(',').map(s => s.trim()).filter(Boolean);
      if (args.exclude.length === 0) {
        console.error('Option --exclude requires at least one non-empty pattern.');
        process.exit(2);
      }
      continue;
    }
    if (a === '--rename') {
      const raw = requireValue(argv, ++i, '--rename');
      const pairs = raw.split(',').map(s => s.trim()).filter(Boolean);
      if (pairs.length === 0) {
        console.error('Option --rename requires at least one old=new entry.');
        process.exit(2);
      }
      for (const pair of pairs) {
        const eq = pair.indexOf('=');
        if (eq < 0) {
          console.error(`Invalid --rename entry: "${pair}" (expected old=new)`);
          process.exit(2);
        }
        args.rename[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
      }
      continue;
    }
    if (a === '--rotate') {
      const raw = requireValue(argv, ++i, '--rotate');
      const entries = raw.split(';').map(s => s.trim()).filter(Boolean);
      if (entries.length === 0) {
        console.error('Option --rotate requires at least one name=rx,ry,rz entry.');
        process.exit(2);
      }
      for (const entry of entries) {
        const eq = entry.indexOf('=');
        if (eq < 0) {
          console.error(`Invalid --rotate entry: "${entry}" (expected name=rx,ry,rz)`);
          process.exit(2);
        }
        const name = entry.slice(0, eq).trim();
        const nums = entry.slice(eq + 1).split(',').map(n => Number(n.trim()));
        if (nums.length !== 3 || nums.some(n => Number.isNaN(n))) {
          console.error(`Invalid --rotate values for "${name}": expected three numbers`);
          process.exit(2);
        }
        args.rotate[name] = nums;
      }
      continue;
    }
    if (a.startsWith('--')) {
      console.error(`Unknown option: ${a}`);
      printUsageAndExit(2);
    }
    args.positional.push(a);
  }
  return args;
}

function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function matchesAny(name, patterns) {
  if (!patterns || patterns.length === 0) return false;
  return patterns.some(p => globToRegex(p).test(name));
}

function sanitizeFilename(name) {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_');
}

function hasGeometry(obj) {
  let found = false;
  obj.traverse(o => { if (o.isMesh && o.geometry) found = true; });
  return found;
}

function findByName(root, name) {
  let found = null;
  root.traverse(o => { if (!found && o.name === name) found = o; });
  return found;
}

const args = parseArgs(process.argv.slice(2));
if (args.positional.length < 1) printUsageAndExit(2);

const inputPath = path.resolve(args.positional[0]);
if (!fs.existsSync(inputPath)) {
  console.error(`Input FBX not found: ${inputPath}`);
  process.exit(1);
}

const buf = fs.readFileSync(inputPath);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const loader = new FBXLoader();
const root = loader.parse(ab, '');

if (args.list) {
  const rows = [];
  root.traverse(o => {
    if (!o.name) return;
    const geo = o.isMesh && o.geometry ? 'mesh' : (hasGeometry(o) ? 'group(geo)' : o.type.toLowerCase());
    rows.push(`${geo.padEnd(12)}  ${o.name}`);
  });
  if (!args.quiet) console.log(`--- Named nodes in ${path.basename(inputPath)} ---`);
  console.log(rows.join('\n'));
  process.exit(0);
}

if (args.positional.length < 2) {
  console.error('Missing <output_dir>. Pass --list to just inspect the FBX.');
  printUsageAndExit(2);
}
const outDir = path.resolve(args.positional[1]);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let candidates;
let skippedNoGeometry = [];
if (args.include && args.include.length > 0) {
  const found = new Set();
  root.traverse(o => {
    if (!o.name) return;
    if (matchesAny(o.name, args.include)) found.add(o);
  });
  candidates = Array.from(found);
  // Drop matched nodes that contain no geometry (e.g. empties / bones / parent
  // transforms). Warn so the operator notices a typo'd pattern instead of
  // silently producing empty GLBs.
  skippedNoGeometry = candidates.filter(o => !hasGeometry(o));
  candidates = candidates.filter(o => hasGeometry(o));
} else {
  candidates = [];
  root.traverse(o => {
    if (o === root) return;
    if (o.parent !== root) return;
    if (!o.name) return;
    if (!hasGeometry(o)) return;
    candidates.push(o);
  });
}

if (args.exclude && args.exclude.length > 0) {
  candidates = candidates.filter(o => !matchesAny(o.name, args.exclude));
}

if (skippedNoGeometry.length > 0 && !args.quiet) {
  console.warn(`--- Skipped ${skippedNoGeometry.length} matched node(s) with no geometry ---`);
  for (const o of skippedNoGeometry) console.warn(`  ${o.name}  (${o.type})`);
  console.warn('');
}

if (candidates.length === 0) {
  console.error('No meshes matched the given filters.');
  console.error('Hint: re-run with --list to see all node names in the FBX.');
  process.exit(1);
}

if (!args.quiet) {
  console.log(`--- Selected ${candidates.length} node(s) from ${path.basename(inputPath)} ---`);
  for (const o of candidates) console.log(`  ${o.name}  (${o.type})`);
  console.log('');
}

const exporter = new GLTFExporter();
const summary = [];

for (const obj of candidates) {
  const baseName = args.rename[obj.name] || obj.name;
  const outFile = `${sanitizeFilename(baseName)}.glb`;

  const clone = obj.clone(true);
  clone.position.set(0, 0, 0);
  const rot = args.rotate[obj.name];
  if (rot) clone.rotation.set(rot[0], rot[1], rot[2]);
  else clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);

  const wrapper = new THREE.Group();
  wrapper.name = sanitizeFilename(baseName);
  wrapper.add(clone);

  const bbox = new THREE.Box3().setFromObject(wrapper);
  const size = new THREE.Vector3(); bbox.getSize(size);

  if (args.recenter) {
    const center = new THREE.Vector3(); bbox.getCenter(center);
    clone.position.sub(center);
  }

  let result;
  try {
    result = await new Promise((resolve, reject) => {
      exporter.parse(
        wrapper,
        (gltf) => resolve(gltf),
        (err) => reject(err),
        { binary: true, embedImages: true, onlyVisible: true, includeCustomExtensions: false },
      );
    });
  } catch (err) {
    console.error(`[fail] ${obj.name}: ${err.message || err}`);
    summary.push({ name: obj.name, outFile, status: 'fail', error: String(err && err.message || err) });
    continue;
  }

  const outPath = path.join(outDir, outFile);
  fs.writeFileSync(outPath, Buffer.from(result));
  const stat = fs.statSync(outPath);
  if (!args.quiet) {
    console.log(`[ok]   ${outFile.padEnd(36)}  size=${stat.size}B  bbox=${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}`);
  }
  summary.push({ name: obj.name, outFile, status: 'ok', size_bytes: stat.size,
                 bbox: { x: size.x, y: size.y, z: size.z } });
}

console.log('\n--- Summary ---');
for (const s of summary) {
  if (s.status === 'ok') {
    console.log(`OK    ${s.outFile.padEnd(36)}  ${s.bbox.x.toFixed(2)} x ${s.bbox.y.toFixed(2)} x ${s.bbox.z.toFixed(2)}`);
  } else {
    console.log(`FAIL  ${s.name}: ${s.error}`);
  }
}

const failed = summary.filter(s => s.status !== 'ok').length;
process.exit(failed > 0 ? 1 : 0);
