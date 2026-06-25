import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";


import path from "path";

const port = Number(process.env.PORT ?? 5174);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

const basePath = process.env.BASE_PATH ?? "/";
const outDir = process.env.STUDIO_OUT_DIR
  ? path.resolve(process.env.STUDIO_OUT_DIR)
  : path.resolve(import.meta.dirname, "dist/public");

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir,
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('@dimforge/rapier') || id.includes('@react-three/rapier')) return 'rapier';
          if (id.includes('@react-three/')) return 'react-three';
          if (id.includes('@radix-ui/')) return 'radix-ui';
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) return 'react-vendor';
          if (id.includes('node_modules/framer-motion') ||
              id.includes('node_modules/recharts') ||
              id.includes('node_modules/embla-carousel')) return 'ui-extras';
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": { target: "https://api.grudge-studio.com", changeOrigin: true, secure: true },
      "/auth": { target: "https://id.grudge-studio.com", changeOrigin: true, secure: true },
      "/objectstore": { target: "https://objectstore.grudge-studio.com", changeOrigin: true, secure: true, rewrite: (p) => p.replace(/^\/objectstore/, "") },
      "/assets-cdn": { target: "https://assets.grudge-studio.com", changeOrigin: true, secure: true, rewrite: (p) => p.replace(/^\/assets-cdn/, "") },
    },
    fs: {
      strict: true,
      allow: [path.resolve(import.meta.dirname)],
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
