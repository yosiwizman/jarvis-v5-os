#!/usr/bin/env bash
# Start AKIOR Jarvis V5 OS — all 3 services
# Backend (3002) + Next.js (3001) + HTTP proxy (3000)
# Usage: ./start-akior.sh

cd "$(dirname "$0")" || exit 1

exec npx concurrently -n server,next,proxy \
  "PORT=3002 DISABLE_HTTPS=true LOCAL_LLM_BASE_URL=http://localhost:11434 LOCAL_LLM_MODEL_NAME=qwen2.5:72b npm -w @akior/server run dev" \
  "cd apps/web && npx next dev -p 3001 -H localhost" \
  "sleep 5 && cd apps/web && node dev-proxy-http.mjs"
