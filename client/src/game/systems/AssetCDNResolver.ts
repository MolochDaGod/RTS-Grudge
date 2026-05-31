/**
 * AssetCDNResolver — Rewrites local asset paths to the Grudge Studio R2 CDN
 * in production builds.
 *
 * In development (localhost / Vite dev server), assets are served directly
 * from `client/public/` — no rewriting needed.
 *
 * In production (Vercel), most model/texture files are NOT deployed (480+ MB,
 * not committed to git). Vercel's SPA fallback returns `index.html` for any
 * missing file, which the GLTFLoader interprets as "Unexpected token '<'".
 *
 * This resolver intercepts those paths at the application level and rewrites
 * them to `https://assets.grudge-studio.com/<path>` so the browser fetches
 * from the Cloudflare R2 CDN instead.
 *
 * The Vercel `routes` config in vercel.json also adds a proxy rule for
 * `/models/(.*)` → R2 as a belt-and-suspenders fallback, but the client-side
 * rewrite is faster (avoids the Vercel proxy hop).
 */

const CDN_BASE = "https://assets.grudge-studio.com";

/**
 * True when running in a production deployment (Vercel, Railway, etc).
 * False in local dev (vite dev server on localhost).
 */
const IS_PRODUCTION =
  typeof window !== "undefined" &&
  !window.location.hostname.includes("localhost") &&
  !window.location.hostname.includes("127.0.0.1") &&
  !window.location.hostname.startsWith("192.168.");

/**
 * Paths that are known to exist locally even in production builds
 * (committed to git / included in the Vercel output).
 */
const LOCAL_WHITELIST = new Set<string>([
  "/models/characters/stylized_nightmarish_werewolf.glb",
]);

/**
 * Resolve an asset path. In production, rewrites `/models/...` and
 * `/textures/...` to the R2 CDN. In development, returns the path unchanged.
 *
 * NOTE: This does NOT handle character model resolution (faction GLBs).
 * That's done by CharacterModelResolver.ts which runs first and returns
 * absolute CDN URLs that this function passes through.
 */
export function resolveAssetPath(path: string): string {
  // Already an absolute URL — pass through (CDN URLs, data URIs, etc.)
  if (!path || path.startsWith("https://") || path.startsWith("http://") || path.startsWith("data:")) {
    return path;
  }

  // In dev mode, serve everything from Vite's dev server
  if (!IS_PRODUCTION) return path;

  // Whitelisted local files
  if (LOCAL_WHITELIST.has(path)) return path;

  // Rewrite model and texture paths to CDN
  if (
    path.startsWith("/models/") ||
    path.startsWith("/textures/") ||
    path.startsWith("/sounds/")
  ) {
    return `${CDN_BASE}${path}`;
  }

  return path;
}
