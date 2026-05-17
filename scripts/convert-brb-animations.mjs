/**
 * convert-brb-animations.mjs
 *
 * Converts the Grudge6 BRB Bip001 FBX animation files to GLB format
 * using FBX2glTF (preferred) or Blender as fallback.
 *
 * Usage:
 *   node scripts/convert-brb-animations.mjs
 *
 * Prerequisites (one of):
 *   A) FBX2glTF — https://github.com/facebookincubator/FBX2glTF/releases
 *      Drop FBX2glTF.exe into the project root or add it to PATH.
 *
 *   B) Blender 3.x+ with Python scripting enabled.
 *      Set BLENDER_PATH env var or add blender to PATH.
 *
 * Output:  client/public/models/animations/grudge6_brb/**\/*.glb
 *          (same folder structure as the source FBX files)
 */

import { execSync } from "child_process";
import { readdirSync, existsSync } from "fs";
import { join, basename, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, "..");
const ANIM_ROOT = join(ROOT, "client", "public", "models", "animations", "grudge6_brb");

// ─────────────────────────────────────────────────────────────────────────────
// FBX → GLB mapping
//   key: relative path under grudge6_brb/  (the FBX)
//   value: the AnimationState name the clip should register as
//
// The clip name written into the GLB is what PACK_NAME_TO_STATE uses
// to route the clip to the right state, so we rename the clip during
// conversion using a blender python script.
// ─────────────────────────────────────────────────────────────────────────────
export const BRB_ANIMATION_MAP = [
  // ── BASE ──────────────────────────────────────────────────────────────────
  { src: "base/Idle.fbx",                       clip: "idle",               pack: "grudge6_brb_base" },
  { src: "base/Crouch Idle.fbx",                clip: "sneak",              pack: "grudge6_brb_base" },
  { src: "base/Standing To Crouch.fbx",         clip: "crouch_start",       pack: "grudge6_brb_base" },
  { src: "base/Cover To Stand.fbx",             clip: "crouch_end",         pack: "grudge6_brb_base" },
  { src: "base/Climbing Ladder.fbx",            clip: "climb",              pack: "grudge6_brb_base" },
  { src: "base/Disarmed.fbx",                   clip: "idle_alt",           pack: "grudge6_brb_base" },
  { src: "base/Kick.fbx",                       clip: "uppercut",           pack: "grudge6_brb_base" },
  { src: "base/Throw Object.fbx",               clip: "hadouken",           pack: "grudge6_brb_base" },
  { src: "base/Look Over Shoulder.fbx",         clip: "idle_alt2",          pack: "grudge6_brb_base" },
  { src: "base/Male Sitting Pose.fbx",          clip: "idle_alt3",          pack: "grudge6_brb_base" },
  { src: "base/Pointing.fbx",                   clip: "gesture_acknowledge",pack: "grudge6_brb_base" },
  { src: "base/Patting.fbx",                    clip: "gesture_happy",      pack: "grudge6_brb_base" },
  { src: "base/Reacting.fbx",                   clip: "gesture_annoyed_shake", pack: "grudge6_brb_base" },
  { src: "base/Swagger Walk.fbx",               clip: "walk",               pack: "grudge6_brb_base" },

  // ── EMOTES ────────────────────────────────────────────────────────────────
  { src: "emotes/Bboy Hip Hop Move.fbx",        clip: "victory",            pack: "grudge6_brb_emotes" },
  { src: "emotes/Dancing Running Man.fbx",      clip: "victory",            pack: "grudge6_brb_emotes" },
  { src: "emotes/Hip Hop Dancing.fbx",          clip: "victory",            pack: "grudge6_brb_emotes" },
  { src: "emotes/Silly Dancing.fbx",            clip: "idle_alt",           pack: "grudge6_brb_emotes" },
  { src: "emotes/Standing Taunt Battlecry.fbx", clip: "idle_alt2",          pack: "grudge6_brb_emotes" },

  // ── SWORD + SHIELD ────────────────────────────────────────────────────────
  { src: "sword_shield/Sword And Shield Attack.fbx",      clip: "attack",        pack: "grudge6_brb_sword_shield" },
  { src: "sword_shield/Sword And Shield Attack (1).fbx",  clip: "combo2",        pack: "grudge6_brb_sword_shield" },
  { src: "sword_shield/Sword And Shield Attack (2).fbx",  clip: "heavyAttack",   pack: "grudge6_brb_sword_shield" },
  { src: "sword_shield/Sword And Shield Slash.fbx",       clip: "combo3",        pack: "grudge6_brb_sword_shield" },
  { src: "sword_shield/Sword And Shield Slash 1.fbx",     clip: "fastCombo",     pack: "grudge6_brb_sword_shield" },
  { src: "sword_shield/Sword And Shield Slash (1).fbx",   clip: "counterStrike", pack: "grudge6_brb_sword_shield" },
  { src: "sword_shield/Sword And Shield Casting.fbx",     clip: "swordBlaster",  pack: "grudge6_brb_sword_shield" },
  { src: "sword_shield/Sword And Shield Power Up.fbx",    clip: "whirlwind",     pack: "grudge6_brb_sword_shield" },
  { src: "sword_shield/Northern Soul Spin Combo.fbx",     clip: "spinSlash",     pack: "grudge6_brb_sword_shield" },

  // ── GREATSWORD / 2H ───────────────────────────────────────────────────────
  { src: "greatsword/Great Sword Slash.fbx",     clip: "attack",      pack: "grudge6_brb_greatsword" },
  { src: "greatsword/Great Sword Slash (1).fbx", clip: "combo2",      pack: "grudge6_brb_greatsword" },
  { src: "greatsword/Two Hand Sword Combo.fbx",  clip: "fastCombo",   pack: "grudge6_brb_greatsword" },
  { src: "greatsword/Two Hand Club Combo.fbx",   clip: "heavyAttack", pack: "grudge6_brb_greatsword" },

  // ── ONE-HANDED (sword / axe / dagger) ────────────────────────────────────
  { src: "onehanded/One Hand Sword Combo.fbx", clip: "attack",    pack: "grudge6_brb_onehanded" },
  { src: "onehanded/One Hand Club Combo.fbx",  clip: "combo2",    pack: "grudge6_brb_onehanded" },
  { src: "onehanded/Dual Weapon Combo.fbx",    clip: "fastCombo", pack: "grudge6_brb_onehanded" },

  // ── MAGIC ─────────────────────────────────────────────────────────────────
  { src: "magic/Spell Casting.fbx",                     clip: "hadouken",    pack: "grudge6_brb_magic" },
  { src: "magic/Standing 1H Cast Spell 01.fbx",         clip: "attack",      pack: "grudge6_brb_magic" },
  { src: "magic/Standing 2H Cast Spell 01.fbx",         clip: "swordBlaster",pack: "grudge6_brb_magic" },
  { src: "magic/Standing 2H Magic Area Attack 01.fbx",  clip: "earthquake",  pack: "grudge6_brb_magic" },
  { src: "magic/Standing 2H Magic Area Attack 02.fbx",  clip: "spinSlash",   pack: "grudge6_brb_magic" },
  { src: "magic/Standing 2H Magic Attack 01.fbx",       clip: "swordBlaster2",pack: "grudge6_brb_magic" },
  { src: "magic/Standing 2H Magic Attack 03.fbx",       clip: "tatsumaki",   pack: "grudge6_brb_magic" },
  { src: "magic/Standing 2H Magic Attack 04.fbx",       clip: "shoryuken",   pack: "grudge6_brb_magic" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Blender Python script — renames the first action in the FBX to `clipName`,
// then exports as GLB animation-only.
// ─────────────────────────────────────────────────────────────────────────────
function makeBlenderScript(fbxPath, glbPath, clipName) {
  return `
import bpy, os
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
bpy.ops.import_scene.fbx(filepath=r'${fbxPath.replace(/\\/g, "\\\\")}')
# Rename the first action so the GLB clip name matches our AnimationState
if bpy.data.actions:
    bpy.data.actions[0].name = '${clipName}'
bpy.ops.export_scene.gltf(
    filepath=r'${glbPath.replace(/\\/g, "\\\\")}',
    export_format='GLB',
    export_animations=True,
    export_skins=False,
    export_morph=False,
    export_cameras=False,
    export_lights=False,
)
print('Exported:', r'${glbPath.replace(/\\/g, "\\\\")}')
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Detect converter
// ─────────────────────────────────────────────────────────────────────────────
function findBlender() {
  const candidates = [
    process.env.BLENDER_PATH,
    "blender",
    "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe",
    "C:/Program Files/Blender Foundation/Blender 3.6/blender.exe",
    "C:/Program Files/Blender Foundation/Blender 3.5/blender.exe",
  ].filter(Boolean);
  for (const c of candidates) {
    try { execSync(`"${c}" --version`, { stdio: "pipe" }); return c; } catch {}
  }
  return null;
}

function findFbx2gltf() {
  const candidates = [
    process.env.FBX2GLTF_PATH,
    join(ROOT, "FBX2glTF.exe"),
    join(ROOT, "FBX2glTF"),
    "FBX2glTF",
  ].filter(Boolean);
  for (const c of candidates) {
    try { execSync(`"${c}" --version`, { stdio: "pipe" }); return c; } catch {}
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
const blender  = findBlender();
const fbx2gltf = findFbx2gltf();

if (!blender && !fbx2gltf) {
  console.error(`
ERROR: No FBX→GLB converter found.

Install one of:
  A) FBX2glTF.exe — https://github.com/facebookincubator/FBX2glTF/releases
     Drop it in the project root (${ROOT})
  B) Blender 3.x+ — https://www.blender.org/download/
     After install, set BLENDER_PATH env var or ensure blender is in PATH.

Then re-run:  node scripts/convert-brb-animations.mjs
`);
  process.exit(1);
}

console.log(`Using: ${blender ? "Blender" : "FBX2glTF"}`);
let converted = 0, skipped = 0, errors = 0;

for (const entry of BRB_ANIMATION_MAP) {
  const fbxPath = join(ANIM_ROOT, entry.src);
  const glbPath = fbxPath.replace(/\.fbx$/i, ".glb");

  if (!existsSync(fbxPath)) {
    console.warn(`  SKIP (no FBX): ${entry.src}`);
    skipped++;
    continue;
  }
  if (existsSync(glbPath)) {
    console.log(`  SKIP (GLB exists): ${entry.src}`);
    skipped++;
    continue;
  }

  try {
    if (fbx2gltf) {
      // FBX2glTF — simple, no clip rename (GLB will contain original action name)
      execSync(`"${fbx2gltf}" --input "${fbxPath}" --output "${glbPath}" --binary`, { stdio: "pipe" });
    } else {
      // Blender — renames clip to the canonical AnimationState name
      const pyScript = makeBlenderScript(fbxPath, glbPath, entry.clip);
      const tmpPy = join(ROOT, "_tmp_brb_convert.py");
      import("fs").then(fs => fs.writeFileSync(tmpPy, pyScript));
      execSync(`"${blender}" --background --python "${tmpPy}"`, { stdio: "pipe" });
      import("fs").then(fs => { try { fs.unlinkSync(tmpPy); } catch {} });
    }
    console.log(`  OK  [${entry.clip}] ${entry.src}`);
    converted++;
  } catch (e) {
    console.error(`  ERR ${entry.src}: ${e.message?.slice(0, 120)}`);
    errors++;
  }
}

console.log(`\nDone: ${converted} converted, ${skipped} skipped, ${errors} errors.`);
if (converted > 0) {
  console.log("Next: commit the new GLB files and the animation pack registry will pick them up automatically.");
}
