#!/usr/bin/env tsx
import { readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import {
  RIGHT_HAND_ALIASES, LEFT_HAND_ALIASES,
  UPPER_ARM_R_ALIASES, UPPER_ARM_L_ALIASES,
  FOREARM_R_ALIASES, FOREARM_L_ALIASES,
  SHOULDER_R_ALIASES, SHOULDER_L_ALIASES,
  HEAD_ALIASES, HIPS_ALIASES, SPINE_ALIASES, SPINE2_ALIASES, CHEST_ALIASES,
  RIGHT_FOOT_ALIASES, LEFT_FOOT_ALIASES,
  RIGHT_INDEX_1_ALIASES, RIGHT_INDEX_2_ALIASES, RIGHT_INDEX_3_ALIASES,
  RIGHT_MIDDLE_1_ALIASES, RIGHT_MIDDLE_2_ALIASES, RIGHT_MIDDLE_3_ALIASES,
  RIGHT_RING_1_ALIASES, RIGHT_RING_2_ALIASES, RIGHT_RING_3_ALIASES,
  RIGHT_PINKY_1_ALIASES, RIGHT_PINKY_2_ALIASES, RIGHT_PINKY_3_ALIASES,
  RIGHT_THUMB_1_ALIASES, RIGHT_THUMB_2_ALIASES, RIGHT_THUMB_3_ALIASES,
  LEFT_INDEX_1_ALIASES, LEFT_MIDDLE_1_ALIASES, LEFT_RING_1_ALIASES,
  LEFT_PINKY_1_ALIASES, LEFT_THUMB_1_ALIASES,
  RETARGET_ALIAS_MAP,
  detectSkeletonType, detectBodyParts, findBoneNameByAlias,
  stripBoneSuffix,
  computeWeaponTransform,
  type SkeletonType,
} from "../client/src/game/systems/BoneAliases.ts";

const CHARS_DIR = resolve("client/public/models/characters");
const ANIM_DIR  = resolve("client/public/models/animations");

// ─────────────────────── helpers ───────────────────────

function normalize(s: string): string {
  return stripBoneSuffix(s.replace(/:/g, "")).toLowerCase();
}

async function listBones(glbPath: string): Promise<{ bones: string[]; anims: string[] }> {
  const io = new NodeIO();
  const doc = await io.read(glbPath);
  const root = doc.getRoot();
  const skins = root.listSkins();
  const boneSet = new Set<string>();
  for (const skin of skins) {
    for (const j of skin.listJoints()) {
      const n = j.getName();
      if (n) boneSet.add(n);
    }
  }
  // Also include all node names (some rigs have non-skinned root/control bones)
  for (const node of root.listNodes()) {
    const n = node.getName();
    if (n) boneSet.add(n);
  }
  const anims = root.listAnimations().map(a => a.getName() || "(unnamed)");
  return { bones: [...boneSet], anims };
}

function resolveTargetBone(alias: string, boneNames: string[]): string | null {
  const exact = new Set(boneNames);
  if (exact.has(alias)) return alias;
  const stripped = stripBoneSuffix(alias);
  if (exact.has(stripped)) return stripped;

  const byStripped = new Map<string, string>();
  const byLower = new Map<string, string>();
  const byNormalized = new Map<string, string>();
  for (const b of boneNames) {
    const s = stripBoneSuffix(b);
    if (s !== b && !byStripped.has(s)) byStripped.set(s, b);
    byLower.set(b.toLowerCase(), b);
    const n = normalize(b);
    if (!byNormalized.has(n)) byNormalized.set(n, b);
  }
  if (byStripped.has(alias)) return byStripped.get(alias)!;
  if (byStripped.has(stripped)) return byStripped.get(stripped)!;
  const lower = alias.toLowerCase();
  if (byLower.has(lower)) return byLower.get(lower)!;
  const norm = normalize(alias);
  if (byNormalized.has(norm)) return byNormalized.get(norm)!;
  return null;
}

// All canonical alias buckets we expect to resolve on every humanoid
const CRITICAL: Record<string, string[]> = {
  "RightHand":     RIGHT_HAND_ALIASES,
  "LeftHand":      LEFT_HAND_ALIASES,
  "RightArm":      UPPER_ARM_R_ALIASES,
  "LeftArm":       UPPER_ARM_L_ALIASES,
  "RightForeArm":  FOREARM_R_ALIASES,
  "LeftForeArm":   FOREARM_L_ALIASES,
  "RightShoulder": SHOULDER_R_ALIASES,
  "LeftShoulder":  SHOULDER_L_ALIASES,
  "Head":          HEAD_ALIASES,
  "Hips":          HIPS_ALIASES,
  "Spine":         SPINE_ALIASES,
  "Spine2":        SPINE2_ALIASES,
  "Chest":         CHEST_ALIASES,
  "RightFoot":     RIGHT_FOOT_ALIASES,
  "LeftFoot":      LEFT_FOOT_ALIASES,
};

const FINGER_BUCKETS: Record<string, string[]> = {
  "R-Index1":  RIGHT_INDEX_1_ALIASES,
  "R-Middle1": RIGHT_MIDDLE_1_ALIASES,
  "R-Ring1":   RIGHT_RING_1_ALIASES,
  "R-Pinky1":  RIGHT_PINKY_1_ALIASES,
  "R-Thumb1":  RIGHT_THUMB_1_ALIASES,
  "L-Index1":  LEFT_INDEX_1_ALIASES,
  "L-Middle1": LEFT_MIDDLE_1_ALIASES,
  "L-Ring1":   LEFT_RING_1_ALIASES,
  "L-Pinky1":  LEFT_PINKY_1_ALIASES,
  "L-Thumb1":  LEFT_THUMB_1_ALIASES,
};

const WEAPONS = [
  "sword","greatsword","axe","poleaxe","hammer","dagger",
  "staff","wand","bow","crossbow","gun","shield",
] as const;

// ─────────────────────── main ───────────────────────

async function main() {
  const charFiles = readdirSync(CHARS_DIR).filter(f => f.endsWith(".glb")).sort();
  console.log(`\n═══ CHARACTER RIG VERIFICATION (${charFiles.length} GLBs) ═══\n`);

  const summary: Array<{ name: string; type: SkeletonType | "unknown"; missing: string[]; missingFingers: string[]; extras: Record<string, string> }> = [];

  for (const file of charFiles) {
    const path = resolve(CHARS_DIR, file);
    const { bones, anims } = await listBones(path);
    const skelType = detectSkeletonType(bones);

    // Critical alias resolution
    const missing: string[] = [];
    const resolved: Record<string, string> = {};
    for (const [key, aliases] of Object.entries(CRITICAL)) {
      const found = findBoneNameByAlias(bones, aliases);
      if (found) resolved[key] = found;
      else missing.push(key);
    }

    // Finger resolution (just the proximal segments)
    const missingFingers: string[] = [];
    for (const [key, aliases] of Object.entries(FINGER_BUCKETS)) {
      const found = findBoneNameByAlias(bones, aliases);
      if (!found) missingFingers.push(key);
    }

    // Body parts keyword detector
    const bp = detectBodyParts(bones);

    // Retarget map size
    let mappedCount = 0;
    for (const aliases of Object.values(RETARGET_ALIAS_MAP)) {
      for (const a of aliases) {
        if (resolveTargetBone(a, bones)) { mappedCount++; break; }
      }
    }
    const totalRetarget = Object.keys(RETARGET_ALIAS_MAP).length;

    // Weapon transforms (just confirm no throw)
    let weaponOK = true;
    for (const w of WEAPONS) {
      try {
        const wt = computeWeaponTransform(w as any, "right", skelType, 1.0);
        if (!wt || !Array.isArray(wt.position)) weaponOK = false;
      } catch (e) {
        weaponOK = false;
      }
    }

    const status = (missing.length === 0 && missingFingers.length === 0) ? "✓" : "⚠";
    console.log(`${status} ${file.padEnd(38)} type=${String(skelType).padEnd(7)} bones=${String(bones.length).padStart(3)} retarget=${mappedCount}/${totalRetarget} weapons=${weaponOK ? "ok" : "FAIL"} embeddedAnims=${anims.length}`);

    if (missing.length > 0) console.log(`    ✗ MISSING CRITICAL: ${missing.join(", ")}`);
    if (missingFingers.length > 0) console.log(`    ✗ MISSING FINGERS: ${missingFingers.join(", ")}`);

    // Surface body-parts gaps
    const bpGaps: string[] = [];
    if (bp.spine.length === 0) bpGaps.push("spine[]");
    if (bp.upperSpine.length === 0) bpGaps.push("upperSpine[]");
    if (bp.head.length === 0) bpGaps.push("head[]");
    if (bp.hips.length === 0) bpGaps.push("hips[]");
    if (bp.feet.length === 0) bpGaps.push("feet[]");
    if (bp.hands.length === 0) bpGaps.push("hands[]");
    if (bpGaps.length > 0) console.log(`    ⚠ bodyParts empty: ${bpGaps.join(", ")}`);

    summary.push({ name: file, type: skelType, missing, missingFingers, extras: { bp_upperSpine: bp.upperSpine.join(",") || "(empty)" } });
  }

  // ─────────────────────── Animation pack scan ───────────────────────
  console.log(`\n═══ ANIMATION LIBRARY SCAN ═══\n`);
  const packs = readdirSync(ANIM_DIR).filter(p => {
    try { return readdirSync(resolve(ANIM_DIR, p)).length >= 0; } catch { return false; }
  });
  for (const pack of packs) {
    const dir = resolve(ANIM_DIR, pack);
    let glbs: string[] = [];
    try { glbs = readdirSync(dir).filter(f => f.endsWith(".glb")); } catch { continue; }
    if (glbs.length === 0) continue;

    // Pick one to examine for source rig type
    const sample = resolve(dir, glbs[0]);
    try {
      const { bones, anims } = await listBones(sample);
      const sampleType = detectSkeletonType(bones);
      console.log(`  ${pack.padEnd(28)} ${glbs.length} GLBs   sample-rig=${sampleType.padEnd(8)} sample-anims=${anims.length}`);
    } catch (e) {
      console.log(`  ${pack.padEnd(28)} ${glbs.length} GLBs   (parse error)`);
    }
  }

  // ─────────────────────── Cross-rig retarget probe ───────────────────────
  console.log(`\n═══ CROSS-RIG RETARGET PROBE ═══\n`);
  // Pick one Mixamo (glocomotion) and one CC4 character — verify every track bone resolves
  const characterPath = resolve(CHARS_DIR, "elf-female.glb");
  const charBones = (await listBones(characterPath)).bones;

  const sourcePackPath = resolve(ANIM_DIR, "glocomotion/walk.glb");
  const sourceBones = (await listBones(sourcePackPath)).bones;
  console.log(`  source: glocomotion/walk.glb  (${sourceBones.length} bones)`);
  console.log(`  target: elf-female.glb         (${charBones.length} bones, type=${detectSkeletonType(charBones)})`);

  // Build remap from source → target using RETARGET_ALIAS_MAP
  const remap = new Map<string, string>();
  const targetByAlias: Record<string, string | null> = {};
  for (const [canon, aliases] of Object.entries(RETARGET_ALIAS_MAP)) {
    let target: string | null = null;
    for (const a of aliases) {
      const r = resolveTargetBone(a, charBones);
      if (r) { target = r; break; }
    }
    targetByAlias[canon] = target;
    if (target) {
      for (const a of aliases) if (a !== target) remap.set(a, target);
    }
  }

  // Now, for each source bone, can we map it to a target bone?
  let resolvedSrcCount = 0;
  const unresolvedSrc: string[] = [];
  for (const src of sourceBones) {
    const direct = charBones.includes(src);
    const stripped = stripBoneSuffix(src);
    const remapped = remap.get(src) || remap.get(stripped) || null;
    const resolved = resolveTargetBone(src, charBones) || resolveTargetBone(stripped, charBones);
    if (direct || remapped || resolved) resolvedSrcCount++;
    else unresolvedSrc.push(src);
  }
  console.log(`  source-bone resolution: ${resolvedSrcCount}/${sourceBones.length} bones map to target`);
  if (unresolvedSrc.length > 0 && unresolvedSrc.length <= 10) {
    console.log(`  unresolved: ${unresolvedSrc.join(", ")}`);
  } else if (unresolvedSrc.length > 10) {
    console.log(`  unresolved (${unresolvedSrc.length}): ${unresolvedSrc.slice(0, 10).join(", ")}, ... +${unresolvedSrc.length - 10} more`);
  }

  console.log(`\n  Canonical-bone target coverage:`);
  const importantCanon = ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head", "LeftHand", "RightHand", "LeftFoot", "RightFoot", "LeftUpLeg", "RightUpLeg"];
  for (const c of importantCanon) {
    const t = targetByAlias[c];
    console.log(`    ${c.padEnd(15)} → ${t || "(NOT FOUND)"}`);
  }

  // ─────────────────────── Final summary table ───────────────────────
  const allGood = summary.every(s => s.missing.length === 0);
  console.log(`\n═══ SUMMARY ═══`);
  console.log(`  Characters: ${summary.length}`);
  console.log(`  All critical bones resolved: ${allGood ? "YES ✓" : "NO ✗"}`);
  console.log(`  CC4 detection: ${summary.filter(s => s.type === "cc4").length}/${summary.length}`);
  console.log(`  Empty upperSpine (bodyParts): ${summary.filter(s => s.extras.bp_upperSpine === "(empty)").length}/${summary.length}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
