/**
 * R2 CDN Worker — serves objects from the grudge-assets R2 bucket
 * on assets.grudge-studio.com with proper CORS, caching, and
 * content-type headers for GLTF, GLB, PNG, JPEG, BIN, FBX, etc.
 *
 * Route: assets.grudge-studio.com/*
 * Binding: ASSETS (R2 bucket: grudge-assets)
 */

export interface Env {
  ASSETS: R2Bucket;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Type",
};

const MIME: Record<string, string> = {
  ".gltf": "model/gltf+json",
  ".glb": "model/gltf-binary",
  ".bin": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
  ".fbx": "application/octet-stream",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".wasm": "application/wasm",
};

function getMime(key: string): string {
  const dot = key.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  return MIME[key.slice(dot).toLowerCase()] ?? "application/octet-stream";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: CORS });
    }

    const url = new URL(request.url);
    let key = decodeURIComponent(url.pathname.slice(1)); // strip leading /

    // Root path → health check
    if (!key || key === "") {
      return new Response(
        JSON.stringify({ service: "grudge-r2-cdn", status: "ok" }),
        { status: 200, headers: { "Content-Type": "application/json", ...CORS } }
      );
    }

    // Fetch from R2
    const object = await env.ASSETS.get(key);
    if (!object) {
      return new Response(
        JSON.stringify({ error: "not_found", key }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS } }
      );
    }

    const headers = new Headers(CORS);
    headers.set("Content-Type", getMime(key));
    headers.set("ETag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=2592000, immutable");

    if (object.size !== undefined) {
      headers.set("Content-Length", String(object.size));
    }

    if (request.method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }

    return new Response(object.body, { status: 200, headers });
  },
};
