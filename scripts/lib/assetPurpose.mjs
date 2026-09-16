/**
 * D1 asset_registry purpose SSOT.
 * One table. Do not invent play_kit2 / assets2.
 *
 * purpose  — why the row exists (queryable)
 * layer    — play-role slice (hero / anim / vfx / …)
 * body_status — R2 body truth (unknown until magic-byte)
 *
 * 6595 rows stay. Play instance loads `purpose='play'` (dozens), not the dump.
 */

export const PURPOSES = Object.freeze([
  "play",
  "isolate",
  "author",
  "catalog",
  "skip",
  "legacy"
]);

export const LAYERS = Object.freeze([
  "hero",
  "anim",
  "vfx",
  "weapon",
  "harvest",
  "nature",
  "creature",
  "dungeon",
  "contract",
  "icon",
  "texture",
  "audio",
  "font",
  "building",
  "environment",
  "prop",
  "other"
]);

export const BODY_STATUSES = Object.freeze([
  "unknown",
  "real",
  "html_fake",
  "missing"
]);

const TOON_RACES = new Set(["human", "barbarian", "elf", "dwarf", "orc", "undead"]);

const PLAY_CREATURES = new Set(["drake.glb", "ifrit.glb", "creature_crab.glb"]);

const FAMILY_WEAPONS = /\/(t0-[\w-]+|sword|axe|staff|bow|dagger|hammer|wand|assault_rifle)\.glb$/i;

/**
 * @param {string} r2Key
 * @param {string} [category]
 * @returns {{ purpose: string, layer: string, note?: string }}
 */
export function classifyAsset(r2Key, category) {
  const k = String(r2Key || "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");
  const lower = k.toLowerCase();

  const skip = classifySkip(lower, k);
  if (skip) return skip;

  const play = classifyPlay(lower, k);
  if (play) return play;

  const isolate = classifyIsolate(lower);
  if (isolate) return isolate;

  if (lower.startsWith("fish/") || (lower.includes("kaykit") && lower.endsWith(".gltf"))) {
    return { purpose: "legacy", layer: "prop", note: "migrate or do not load split gltf" };
  }

  if (lower.endsWith(".fbx") || lower.includes("models/grudge6/races/")) {
    return { purpose: "author", layer: layerFromKey(lower, category) };
  }

  return { purpose: "catalog", layer: layerFromKey(lower, category) };
}

function classifySkip(lower, k) {
  if (lower.includes("survival_game_propasset")) {
    return { purpose: "skip", layer: "prop", note: "modern survival pack — not Warlords" };
  }
  if (lower.includes("stylised_rocks.glb") || lower.includes("stylized_rocks.glb")) {
    if (!/rock-\d/.test(lower)) {
      return { purpose: "skip", layer: "nature", note: "fused megapack — isolate meshName" };
    }
  }
  if (lower.endsWith("models/vfx/fireball.glb") || lower.endsWith("/fireball.glb")) {
    return { purpose: "skip", layer: "vfx", note: "scene pack — use orb-* isolates" };
  }
  if (/magic_rocks\.glb$/.test(lower) && !/magic-rock-\d/.test(lower)) {
    return { purpose: "skip", layer: "vfx", note: "fused pack — use magic-rock-N" };
  }
  if (/waveanimation\.glb$/.test(lower)) {
    return { purpose: "skip", layer: "vfx", note: "fused pack — use fire-wave-* / lava-wave-aoe" };
  }
  if (lower.includes("meshy") && /hero|character|play/.test(lower)) {
    return { purpose: "skip", layer: "hero", note: "Meshy not play body" };
  }
  if (
    lower.startsWith("models/fauna/") ||
    lower.startsWith("icons/fauna/")
  ) {
    return { purpose: "skip", layer: "creature", note: "CDN 404 — no local GLB/FBX on disk; do not invent" };
  }
  if (lower.includes("voxel-knights-horse.glb")) {
    return { purpose: "skip", layer: "creature", note: "CDN 404 — pack not on R2" };
  }
  return null;
}

function classifyPlay(lower, k) {
  const toon = k.match(/asset-packs\/toon-rts-characters\/glb\/characters\/([a-z]+)\.glb$/i);
  if (toon && TOON_RACES.has(toon[1].toLowerCase())) {
    return { purpose: "play", layer: "hero" };
  }
  if (lower.startsWith("prod/anims/")) return { purpose: "play", layer: "anim" };
  if (lower === "js/grudge6-kit.js") return { purpose: "play", layer: "contract" };
  if (lower.includes("warlords-dungeon-kit.json")) return { purpose: "play", layer: "dungeon" };
  if (/models\/vfx\/rocks\/magic-rock-\d\.glb$/.test(lower)) {
    return { purpose: "play", layer: "vfx" };
  }
  if (/models\/vfx\/waves\/(fire-wave-|lava-wave-)/.test(lower)) {
    return { purpose: "play", layer: "vfx" };
  }
  if (/models\/vfx\/orbs\/orb-/.test(lower)) return { purpose: "play", layer: "vfx" };
  if (/models\/vfx\/slash\/slash/.test(lower)) return { purpose: "play", layer: "vfx" };
  if (/models\/vfx\/(arrows|projectiles|charge|summons|impact|heal)\//.test(lower) && lower.endsWith(".glb")) {
    return { purpose: "play", layer: "vfx" };
  }
  if (/models\/weapons\/t0-/.test(lower) && lower.endsWith(".glb")) {
    return { purpose: "play", layer: "weapon" };
  }
  if (lower.includes("strawberry-strike.glb")) return { purpose: "play", layer: "vfx" };
  if (lower.endsWith("models/vfx/explosion.glb") || lower.endsWith("/explosion.glb")) {
    return { purpose: "play", layer: "vfx" };
  }
  if (
    (lower.startsWith("prod/gltf/weapons/") || lower.startsWith("models/weapons/")) &&
    FAMILY_WEAPONS.test(lower)
  ) {
    return { purpose: "play", layer: "weapon" };
  }
  if (lower.startsWith("models/creatures/land/")) {
    const base = lower.split("/").pop();
    if (PLAY_CREATURES.has(base)) return { purpose: "play", layer: "creature" };
  }
  if (lower.includes("harvest/ore_nodes.glb") || lower.includes("harvest/flowers_pack.glb")) {
    return { purpose: "play", layer: "harvest" };
  }
  return null;
}

function classifyIsolate(lower) {
  if (/models\/vfx\/rocks\/rock-\d\.glb$/.test(lower)) {
    return { purpose: "isolate", layer: "vfx" };
  }
  if (lower.includes("models/vfx/charge/staff-charge.glb")) {
    return { purpose: "isolate", layer: "vfx" };
  }
  if (/models\/vfx\/(arrows|projectiles|summons)\//.test(lower) && lower.endsWith(".glb")) {
    return { purpose: "isolate", layer: "vfx" };
  }
  return null;
}

function layerFromKey(lower, category) {
  if (lower.startsWith("textures/") || category === "texture") return "texture";
  if (lower.startsWith("icons/") || lower.startsWith("game-assets/icons/")) return "icon";
  if (lower.startsWith("audio/") || lower.startsWith("sounds/") || category === "audio") return "audio";
  if (lower.startsWith("fonts/") || category === "font") return "font";
  if (lower.includes("/anims/") || category === "animation") return "anim";
  if (lower.includes("/vfx/") || category === "spell") return "vfx";
  if (lower.includes("/weapons/") || category === "weapon") return "weapon";
  if (lower.includes("/creatures/") || category === "monster") return "creature";
  if (lower.includes("/nature/") || lower.includes("harvest/")) return "nature";
  if (lower.includes("/dungeon") || lower.includes("/buildings/")) return "building";
  if (lower.includes("/characters/") || category === "character") return "hero";
  if (category === "environment" || category === "terrain") return "environment";
  if (category === "building") return "building";
  return "other";
}

/** @param {{ purpose: string, layer: string }[]} rows */
export function countByPurpose(rows) {
  const out = Object.fromEntries(PURPOSES.map((p) => [p, 0]));
  out.unset = 0;
  for (const r of rows) {
    const p = r.purpose && PURPOSES.includes(r.purpose) ? r.purpose : "unset";
    out[p] = (out[p] || 0) + 1;
  }
  return out;
}
