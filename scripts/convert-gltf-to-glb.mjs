import pkg from "gltf-pipeline";
const { gltfToGlb } = pkg;
import fs from "fs";
import path from "path";

const DIRS_TO_CONVERT = [
  "client/public/models/kaykit_weapons",
  "client/public/models/kaykit_tools",
];

async function convertFile(gltfPath) {
  try {
    const gltf = JSON.parse(fs.readFileSync(gltfPath, "utf8"));
    const dir = path.dirname(path.resolve(gltfPath));

    const options = {
      resourceDirectory: dir + "/",
      separate: false,
    };

    const results = await gltfToGlb(gltf, options);
    const glbPath = gltfPath.replace(/\.gltf$/i, ".glb");
    fs.writeFileSync(glbPath, Buffer.from(results.glb));

    const stats = fs.statSync(glbPath);
    console.log(`  OK: ${path.basename(gltfPath)} -> ${path.basename(glbPath)} (${(stats.size / 1024).toFixed(1)}KB)`);
    return true;
  } catch (err) {
    console.error(`  FAIL: ${path.basename(gltfPath)}: ${err.message}`);
    return false;
  }
}

async function main() {
  let converted = 0;
  let failed = 0;
  let skipped = 0;

  for (const dir of DIRS_TO_CONVERT) {
    if (!fs.existsSync(dir)) {
      console.log(`Directory not found: ${dir}`);
      continue;
    }

    console.log(`\nProcessing: ${dir}`);
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".gltf"));

    for (const file of files) {
      const gltfPath = path.join(dir, file);
      const glbPath = gltfPath.replace(/\.gltf$/i, ".glb");

      if (fs.existsSync(glbPath)) {
        skipped++;
        continue;
      }

      const ok = await convertFile(gltfPath);
      if (ok) converted++;
      else failed++;
    }
  }

  console.log(`\nDone: ${converted} converted, ${failed} failed, ${skipped} skipped (already had .glb)`);
}

main().catch(console.error);
