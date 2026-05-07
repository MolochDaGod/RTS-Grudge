/**
 * Shared bone-name sanitiser for build scripts.
 *
 * MUST mirror `sanitizeBoneName` in `client/src/game/systems/BoneAliases.ts`.
 *
 * Strips Maya-style namespace colons (e.g. "mixamorig:Hips" → "mixamorigHips")
 * which are illegal in GLTF node/track names.
 */
function sanitizeBoneName(name) {
  return name ? name.replace(/:/g, '') : name;
}

/**
 * Strip a numeric duplicate-suffix (e.g. "Spine_1" → "Spine") that some
 * exporters add when bones share a name. Mirrors `stripBoneSuffix`.
 */
function stripBoneSuffix(name) {
  return name ? name.replace(/_\d+$/, '') : name;
}

module.exports = {
  sanitizeBoneName,
  stripBoneSuffix,
};
