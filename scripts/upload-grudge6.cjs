/**
 * Upload the 6 Grudge6 faction character GLBs to R2.
 * Run from the RTS-Grudge root: node scripts/upload-grudge6.cjs
 */
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "";
const ACCESS_KEY = process.env.OBJECT_STORAGE_KEY || process.env.R2_ACCESS_KEY_ID || "";
const SECRET_KEY = process.env.OBJECT_STORAGE_SECRET || process.env.R2_SECRET_ACCESS_KEY || "";
const BUCKET = process.env.OBJECT_STORAGE_BUCKET || process.env.R2_BUCKET_NAME || "grudge-assets";

if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
  console.error("Missing R2 credentials in .env");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

const base = path.resolve(__dirname, "../client/public/models/grudge6");
const files = [
  "wk/WK_Characters.glb",
  "brb/BRB_Characters.glb",
  "elf/ELF_Characters.glb",
  "dwf/DWF_Characters.glb",
  "orc/ORC_Characters.glb",
  "ud/UD_Characters.glb",
];

async function uploadWithRetry(key, body, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: body,
          ContentType: "model/gltf-binary",
          CacheControl: "public, max-age=86400",
        })
      );
      return true;
    } catch (err) {
      console.warn(`  attempt ${i + 1}/${retries} failed: ${err.code || err.message}`);
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return false;
}

(async () => {
  let ok = 0;
  for (const rel of files) {
    const filePath = path.join(base, rel);
    if (!fs.existsSync(filePath)) {
      console.warn(`SKIP (not found): ${filePath}`);
      continue;
    }
    const key = "models/grudge6/" + rel;
    const body = fs.readFileSync(filePath);
    console.log(`Uploading ${key} (${Math.round(body.length / 1024)} KB)...`);
    if (await uploadWithRetry(key, body)) {
      console.log(`  ✓ ${key}`);
      ok++;
    } else {
      console.error(`  ✗ FAILED: ${key}`);
    }
  }
  console.log(`\nDone — ${ok}/${files.length} Grudge6 faction GLBs uploaded to R2.`);
})();
