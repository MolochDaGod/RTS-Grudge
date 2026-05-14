#!/usr/bin/env node
/**
 * Convert all character GLBs that use the deprecated
 * KHR_materials_pbrSpecularGlossiness extension to standard
 * metallicRoughness. The current three.js GLTFLoader (>= r160) ignores
 * spec-gloss, leaving meshes with their default white material — which is
 * why the new race characters were rendering as flat white blobs.
 *
 * Run: node scripts/convert-spec-gloss.mjs
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { metalRough } from "@gltf-transform/functions";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const DIR = "client/public/models/characters";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const files = (await readdir(DIR)).filter((f) => f.endsWith(".glb"));

let converted = 0;
let skipped = 0;
for (const file of files) {
  const path = join(DIR, file);
  const doc = await io.read(path);
  const usesSpecGloss = doc
    .getRoot()
    .listExtensionsUsed()
    .some((e) => e.extensionName === "KHR_materials_pbrSpecularGlossiness");
  if (!usesSpecGloss) {
    skipped++;
    continue;
  }
  await doc.transform(metalRough());
  await io.write(path, doc);
  converted++;
  console.log(`converted: ${file}`);
}
console.log(`\nDone. converted=${converted} skipped=${skipped}`);
