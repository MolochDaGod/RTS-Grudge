#!/bin/bash
set -e

if [ -f package.json ]; then
  npm install --no-audit --no-fund --prefer-offline
fi

if [ -n "$DATABASE_URL" ] && grep -q '"db:push"' package.json 2>/dev/null; then
  npm run db:push -- --force || true
fi
