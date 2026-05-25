# ── Grudge Warlords — Production Container ───────────────────────────────────────
#
# Multi-stage build: install + bundle → slim production image.
#
#   docker build -t grudge-warlords .
#   docker run -p 5000:5000 --env-file .env grudge-warlords
#
# The built image contains:
#   dist/index.cjs  — esbuild-bundled Express server
#   dist/public/    — Vite-built client (HTML, JS, CSS, models, icons)
#
# Static assets (models/, icons/, fonts/) are baked into dist/public/
# by Vite's build step. No separate Models/ copy needed.
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first (layer cache)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source + all assets needed for the Vite build
# client/public/ contains models, icons, fonts, sounds — Vite copies
# them into dist/public/ at build time.
COPY client/ client/
COPY server/ server/
COPY shared/ shared/
COPY script/ script/
COPY scripts/ scripts/
COPY vite.config.ts tsconfig.json tailwind.config.ts postcss.config.js ./

# Build client (Vite → dist/public) + server (esbuild → dist/index.cjs)
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Built output: server bundle + client SPA (including all static assets)
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/game-config || exit 1

CMD ["node", "dist/index.cjs"]
