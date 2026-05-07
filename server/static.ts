import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist — but never for
  // missing static assets, otherwise GLTFLoader / image / audio fetches
  // get an HTML page back and crash with parse errors that take down the
  // WebGL canvas.
  app.use("/{*path}", (req, res) => {
    if (/\.(glb|gltf|bin|fbx|obj|hdr|exr|png|jpe?g|webp|gif|svg|ico|mp3|wav|ogg|m4a|webm|mp4|json|txt|wasm|woff2?|ttf|otf|map)(\?.*)?$/i.test(req.originalUrl)) {
      return res.status(404).type("text/plain").send(`Not found: ${req.originalUrl}`);
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
