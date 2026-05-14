# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first (layer cache)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source + assets needed for the build
COPY client/ client/
COPY server/ server/
COPY shared/ shared/
COPY script/ script/
COPY scripts/ scripts/
COPY vite.config.ts tsconfig.json tailwind.config.ts postcss.config.js ./

# Build client (Vite → dist/public) + server (esbuild → dist/index.cjs)
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Built output
COPY --from=build /app/dist ./dist

# GLB/GLTF model assets served by express.static("/Models")
COPY Models/ Models/

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:5000/api/game-config || exit 1

CMD ["node", "dist/index.cjs"]
