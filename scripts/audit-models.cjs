const fs = require('fs');
const path = require('path');
const THREE = require('three');
const { FBXLoader } = require('three/examples/jsm/loaders/FBXLoader.js');
const {
  parseArgs, walkGlob, ProgressReporter, makeMain,
} = require('./lib/scriptKit.cjs');

const MODELS_DIR = path.resolve(__dirname, '../client/public/models');

const POLY_BUDGET = {
  character: { warn: 15000, critical: 30000 },
  weapon: { warn: 5000, critical: 12000 },
  environment: { warn: 10000, critical: 25000 },
  dungeon: { warn: 8000, critical: 20000 },
  animation: { warn: 0, critical: 0 },
};

function categorize(filePath) {
  const rel = path.relative(MODELS_DIR, filePath).toLowerCase();
  if (rel.startsWith('character')) return 'character';
  if (rel.startsWith('weapon')) return 'weapon';
  if (rel.startsWith('environment')) return 'environment';
  if (rel.startsWith('dungeon')) return 'dungeon';
  if (rel.startsWith('animation')) return 'animation';
  if (rel.startsWith('medieval') || rel.startsWith('rts')) return 'environment';
  return 'other';
}

function analyzeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  const result = {
    path: path.relative(MODELS_DIR, filePath),
    format: ext.replace('.', ''),
    size: stat.size,
    category: categorize(filePath),
    vertices: 0,
    triangles: 0,
    meshes: 0,
    bones: 0,
    animations: 0,
    materials: 0,
    hasSkeleton: false,
    hasGlbCounterpart: false,
    hasFbxCounterpart: false,
    issues: [],
  };

  if (ext === '.fbx') {
    const glbPath = filePath.replace(/\.fbx$/i, '.glb');
    result.hasGlbCounterpart = fs.existsSync(glbPath);
  } else if (ext === '.glb') {
    const fbxPath = filePath.replace(/\.glb$/i, '.fbx');
    result.hasFbxCounterpart = fs.existsSync(fbxPath);
  }

  if (ext === '.fbx') {
    try {
      const buffer = fs.readFileSync(filePath);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      const loader = new FBXLoader();
      const scene = loader.parse(arrayBuffer, path.dirname(filePath) + '/');

      scene.traverse((child) => {
        if (child.isBone) { result.bones++; result.hasSkeleton = true; }
        if (child.isMesh) {
          result.meshes++;
          const geo = child.geometry;
          if (geo) {
            const pos = geo.getAttribute('position');
            if (pos) result.vertices += pos.count;
            if (geo.index) result.triangles += geo.index.count / 3;
            else if (pos) result.triangles += pos.count / 3;
          }
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          result.materials += mats.length;
        }
      });

      result.animations = (scene.animations || []).length;
    } catch (err) {
      result.issues.push(`Parse error: ${err.message}`);
    }
  }

  const budget = POLY_BUDGET[result.category];
  if (budget && result.triangles > 0) {
    if (result.triangles > budget.critical) {
      result.issues.push(`CRITICAL: ${result.triangles} tris exceeds ${budget.critical} budget`);
    } else if (result.triangles > budget.warn) {
      result.issues.push(`WARNING: ${result.triangles} tris exceeds ${budget.warn} soft limit`);
    }
  }

  return result;
}

async function main(argv) {
  const { values } = parseArgs(argv, {
    flags: {
      'fbx-only': { type: 'boolean', default: false },
      'issues-only': { type: 'boolean', default: false },
    },
    positional: ['dir'],
  });

  const targetDir = values.dir ? path.join(MODELS_DIR, values.dir) : MODELS_DIR;

  console.log(`\n=== Model Audit Report ===`);
  console.log(`Scanning: ${targetDir}\n`);

  const allFiles = walkGlob(targetDir, /\.(fbx|glb|gltf)$/i);
  const filtered = values['fbx-only']
    ? allFiles.filter(p => p.toLowerCase().endsWith('.fbx'))
    : allFiles;

  const progress = new ProgressReporter(filtered.length);
  const results = [];

  const formatCounts = { fbx: 0, glb: 0, gltf: 0 };
  const categoryCounts = {};
  let fbxWithoutGlb = 0;
  let totalVerts = 0;
  let totalTris = 0;
  let issueCount = 0;

  for (const filePath of filtered) {
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const rel = path.relative(MODELS_DIR, filePath);
    progress.start(rel);

    const result = analyzeFile(filePath);
    results.push(result);

    formatCounts[ext] = (formatCounts[ext] || 0) + 1;
    categoryCounts[result.category] = (categoryCounts[result.category] || 0) + 1;

    if (ext === 'fbx' && !result.hasGlbCounterpart) fbxWithoutGlb++;
    totalVerts += result.vertices;
    totalTris += result.triangles;
    issueCount += result.issues.length;

    progress.end(`${result.triangles} tris${result.issues.length > 0 ? ` [${result.issues.length} issue(s)]` : ''}`);
  }

  console.log(`\n--- Format Distribution ---`);
  for (const [fmt, count] of Object.entries(formatCounts)) {
    if (count > 0) console.log(`  ${fmt.toUpperCase()}: ${count}`);
  }

  console.log(`\n--- Category Distribution ---`);
  for (const [cat, count] of Object.entries(categoryCounts)) {
    console.log(`  ${cat}: ${count}`);
  }

  console.log(`\n--- Totals ---`);
  console.log(`  Total files:     ${results.length}`);
  console.log(`  Total vertices:  ${totalVerts.toLocaleString()}`);
  console.log(`  Total triangles: ${totalTris.toLocaleString()}`);
  console.log(`  FBX without GLB: ${fbxWithoutGlb}`);
  console.log(`  Issues found:    ${issueCount}`);

  if (issueCount > 0) {
    console.log(`\n--- Issues ---`);
    for (const r of results) {
      if (r.issues.length > 0) {
        console.log(`  ${r.path}:`);
        for (const issue of r.issues) {
          console.log(`    - ${issue}`);
        }
      }
    }
  }

  const fbxOnlyFiles = results.filter(r => r.format === 'fbx' && !r.hasGlbCounterpart);
  if (fbxOnlyFiles.length > 0 && !values['issues-only']) {
    console.log(`\n--- FBX Files Without GLB Counterpart (${fbxOnlyFiles.length}) ---`);
    for (const r of fbxOnlyFiles) {
      console.log(`  ${r.path} (${r.vertices} verts, ${r.triangles} tris)`);
    }
  }

  const highPolyFiles = results.filter(r => {
    const budget = POLY_BUDGET[r.category];
    return budget && r.triangles > budget.warn;
  });

  if (highPolyFiles.length > 0) {
    console.log(`\n--- High Poly Count Models ---`);
    for (const r of highPolyFiles) {
      const budget = POLY_BUDGET[r.category];
      const severity = r.triangles > budget.critical ? 'CRITICAL' : 'WARNING';
      console.log(`  [${severity}] ${r.path}: ${r.triangles} tris (budget: ${budget.warn}/${budget.critical})`);
    }
  }

  const reportPath = path.join(MODELS_DIR, '..', 'model-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: results.length,
      formatCounts,
      categoryCounts,
      totalVertices: totalVerts,
      totalTriangles: totalTris,
      fbxWithoutGlb,
      issueCount,
    },
    files: results,
  }, null, 2));
  console.log(`\nFull report saved to: ${reportPath}`);

  return { failures: 0 };
}

makeMain(main, { scriptName: 'audit-models' })();
