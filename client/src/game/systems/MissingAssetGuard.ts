/**
 * MissingAssetGuard — installs a global Three.js loading-manager URL
 * modifier that swaps known-missing asset requests for a 1×1 transparent
 * PNG so they resolve with HTTP 200 instead of crashing React-Suspense
 * users like drei's `useTexture`.
 *
 * Two failure modes are handled:
 *
 *   1. GLB models that embed external `.psd` texture references (e.g.
 *      `WK_StandardUnits_Textures.psd`). Photoshop files are never
 *      browser-loadable; the GLB convert step should have inlined them.
 *      Until those GLBs are rebuilt we silently swallow the request.
 *   2. VFX/terrain texture paths referenced from `VFX_TEXTURES`,
 *      `ParticleEffects`, and `SandTerrainMaterial` whose source assets
 *      have not been added to `client/public/textures/` yet.
 *
 * The guard is idempotent and runs once per page load. Each unique
 * intercepted URL is warned about exactly once so the missing-asset
 * backlog stays visible in the console without flooding it.
 */

import * as THREE from "three";

// 1×1 fully-transparent PNG. Inlined so the guard has no network dependency.
const BLANK_PNG_DATA_URI =
  "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

// Filename stems (lowercase, no extension) that we know are missing from
// `client/public/textures/`. Keep this list narrow on purpose — we only
// want to silently swap things that are demonstrably absent so a real
// 404 from a typo still surfaces.
const MISSING_TEXTURE_STEMS: ReadonlySet<string> = new Set([
  // SandTerrainMaterial fallbacks
  "grass_detailed",
  "m_sand_diffuse",
  // ParticleEffects.PortalParticles
  "glow_point2_purple",
  // SkillEffects.VFX_TEXTURES (every entry currently 404s)
  "flamedecal04",
  "decal_fire10",
  "fx_glow_004",
  "radial_glow",
  "soft_circle_pulse",
  "spark_blur",
  "sparkle_ink_001",
  "hit_02",
  "slash03_anim_1",
  "color_ring_002",
  "dust54",
  "star_06",
  "lightning01_02",
  "trail_cpdr_rm_01",
  "gradient_beam_007",
  "flow_001",
  "noise_02",
  "flare08",
  "glow_ball2_grey",
  "aura_flame_000",
  "default-particle",
  "sheet_purple_w01",
  "fx_smoke_02",
  "dungeonringguid",
]);

const warned = new Set<string>();

function warnOnce(originalUrl: string, reason: string): void {
  if (warned.has(originalUrl)) return;
  warned.add(originalUrl);
  console.warn(`[MissingAssetGuard] ${reason}: ${originalUrl} → blank PNG`);
}

/**
 * Returns true if the URL points at a Photoshop file. Embedded GLB
 * texture refs sometimes survive conversion as `.psd` paths; the
 * browser cannot decode them so we always replace.
 */
function isPsd(url: string): boolean {
  // Strip query/hash before extension check.
  const clean = url.split("?")[0].split("#")[0];
  return clean.toLowerCase().endsWith(".psd");
}

/**
 * Extract the filename stem (no extension, no directory) from a URL.
 * Returns "" for opaque inputs like data URIs.
 */
function stemOf(url: string): string {
  if (url.startsWith("data:")) return "";
  const clean = url.split("?")[0].split("#")[0];
  const file = clean.substring(clean.lastIndexOf("/") + 1);
  const dot = file.lastIndexOf(".");
  return (dot >= 0 ? file.substring(0, dot) : file).toLowerCase();
}

let installed = false;

export function installMissingAssetGuard(): void {
  if (installed) return;
  installed = true;

  // Preserve any pre-existing modifier so we compose instead of replace.
  // Three's typings expose `setURLModifier` but not the underlying field,
  // so we proxy through a saved reference.
  const prev = THREE.DefaultLoadingManager.resolveURL.bind(
    THREE.DefaultLoadingManager,
  );

  THREE.DefaultLoadingManager.setURLModifier((url: string) => {
    // Skip data/blob URIs — they cannot 404 and the substring math below
    // would just waste cycles on the base64 payload.
    if (url.startsWith("data:") || url.startsWith("blob:")) {
      return prev(url);
    }

    if (isPsd(url)) {
      warnOnce(url, "PSD reference in GLB");
      return BLANK_PNG_DATA_URI;
    }

    if (MISSING_TEXTURE_STEMS.has(stemOf(url))) {
      warnOnce(url, "Missing texture");
      return BLANK_PNG_DATA_URI;
    }

    return prev(url);
  });
}
