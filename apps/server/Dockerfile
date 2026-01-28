# Jarvis Server Dockerfile
# Target: Fly.io (supports WebSockets natively)
# 
# Build: docker build -t jarvis-server .
# Run:   docker run -p 1234:1234 -e PORT=1234 jarvis-server

FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine
RUN apk add --no-cache libc6-compat

# Copy workspace root files
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

# Install all dependencies (including workspace deps)
RUN npm ci --workspace=@jarvis/server

# Build the shared package and server
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules

# Copy source files
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
COPY package.json package-lock.json ./

# Build shared package first, then server
WORKDIR /app/packages/shared
RUN npm run build --if-present || true

WORKDIR /app/apps/server
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=1234

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 jarvis

# Copy built artifacts
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared

# Create data directory with correct permissions
RUN mkdir -p /app/data && chown -R jarvis:nodejs /app/data

USER jarvis

EXPOSE 1234

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

CMD ["node", "dist/index.js"]
