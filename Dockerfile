# ── Stage 1: Install + Build ─────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

# Install deps (leverage Docker cache — only re-install when lockfile changes)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Build the server bundle (Express + Socket.IO → dist/index.cjs)
RUN npm run build:server

# ── Stage 2: Production runtime ─────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only what's needed to run
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# Static data files served by the game server in dev (Vercel serves in prod,
# but the server reads them for SSR / API responses)
COPY --from=builder /app/client/public/data ./client/public/data

EXPOSE 5000

# Healthcheck for Railway / Docker Compose
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/index.cjs"]
