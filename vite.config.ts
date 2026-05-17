import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import glsl from "vite-plugin-glsl";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    glsl(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    // Tree-shake dead code and split heavy deps into cacheable chunks.
    target: "esnext",
    minify: "esbuild",
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          // Three.js core + stdlib — biggest single dep (~1.5 MB)
          three: ["three", "three-stdlib"],
          // React Three ecosystem — second-heaviest
          r3f: ["@react-three/fiber", "@react-three/drei"],
          // Physics engine (WASM binary)
          rapier: ["@react-three/rapier", "@dimforge/rapier3d-compat"],
          // Loaders (Draco WASM decoder, KTX2 transcoder)
          loaders: ["@loaders.gl/core", "@loaders.gl/draco", "@loaders.gl/images", "@loaders.gl/textures"],
          // State management
          state: ["zustand", "xstate", "@xstate/react"],
          // BVH + pathfinding
          spatial: ["three-mesh-bvh", "three-pathfinding", "yuka"],
        },
      },
    },
  },
  // Add support for large models and audio files
  assetsInclude: ["**/*.gltf", "**/*.glb", "**/*.mp3", "**/*.ogg", "**/*.wav"],
});
