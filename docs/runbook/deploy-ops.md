# JARVIS Deployment Operations Runbook

This runbook covers day-to-day operations for the JARVIS deployment on a LAN host.

## Quick Reference

| Action | Command |
|--------|---------|
| Status | `docker compose -f deploy/compose.jarvis.yml ps` |
| Start | `docker compose -f deploy/compose.jarvis.yml up -d` |
| Stop | `docker compose -f deploy/compose.jarvis.yml down` |
| Restart | `docker compose -f deploy/compose.jarvis.yml restart` |
| Logs | `docker compose -f deploy/compose.jarvis.yml logs -f` |
| Health | `curl http://127.0.0.1:3000/api/health` |

## Prerequisites

- SSH access to the host (e.g., `ssh aifactory-lan`)
- Docker and Docker Compose v2 installed
- Repository cloned to `/opt/jarvis/JARVIS-V5-OS`
- Environment file at `deploy/jarvis.env`

## Service Overview

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| caddy | jarvis-caddy | 3000 (exposed) | Reverse proxy, TLS termination |
| web | jarvis-web | 3001 (internal) | Next.js frontend |
| server | jarvis-server | 1234 (internal) | Fastify API + Socket.IO |

## Starting the Stack

```bash
cd /opt/jarvis/JARVIS-V5-OS

# Build and start all services
docker compose -f deploy/compose.jarvis.yml up -d --build

# Or start without rebuilding
docker compose -f deploy/compose.jarvis.yml up -d
```

Wait ~30-60 seconds for health checks to pass.

## Stopping the Stack

```bash
cd /opt/jarvis/JARVIS-V5-OS

# Stop all services (containers removed)
docker compose -f deploy/compose.jarvis.yml down

# Stop but keep containers (faster restart)
docker compose -f deploy/compose.jarvis.yml stop
```

## Restarting Services

```bash
# Restart all services
docker compose -f deploy/compose.jarvis.yml restart

# Restart a specific service
docker compose -f deploy/compose.jarvis.yml restart server
docker compose -f deploy/compose.jarvis.yml restart web
docker compose -f deploy/compose.jarvis.yml restart caddy
```

## Checking Health

### Container Status

```bash
# Quick status
docker compose -f deploy/compose.jarvis.yml ps

# Expected output (all healthy):
# NAME            STATUS
# jarvis-caddy    Up (healthy)
# jarvis-server   Up (healthy)
# jarvis-web      Up (healthy)
```

### Health Endpoints

```bash
# Server health (direct)
curl http://127.0.0.1:1234/health
# Expected: {"ok":true,"timestamp":"...","uptime":...}

# Server health (through Caddy)
curl http://127.0.0.1:3000/api/health
# Expected: same as above

# Web frontend
curl -I http://127.0.0.1:3000/
# Expected: HTTP 307 or 200
```

### What "Healthy" Means

- **caddy**: Responds to HTTP on port 3000
- **server**: `/health` endpoint returns 200
- **web**: Next.js server responds on port 3001

Recovery time after restart: ~30-60 seconds for all services to become healthy.

## Viewing Logs

```bash
# All services (follow mode)
docker compose -f deploy/compose.jarvis.yml logs -f

# Specific service
docker logs -f jarvis-server
docker logs -f jarvis-web
docker logs -f jarvis-caddy

# Last 100 lines
docker logs --tail=100 jarvis-server
```

### Log Locations

Logs are written to Docker's log driver. To persist logs, configure Docker's logging driver in `/etc/docker/daemon.json`.

## Upgrade Procedure

### Standard Upgrade (from git)

```bash
cd /opt/jarvis/JARVIS-V5-OS

# 1. Pull latest code
git fetch origin main
git checkout main
git pull origin main

# 2. Rebuild and restart
docker compose -f deploy/compose.jarvis.yml up -d --build

# 3. Verify health
docker compose -f deploy/compose.jarvis.yml ps

# 4. Run smoke test
./ops/verify/deploy-smoke.sh
```

### Blue-Green Upgrade (zero downtime)

Not currently supported. The standard upgrade has ~30-60s downtime during container recreation.

## Rollback Procedure

### Option 1: Git Revert

```bash
cd /opt/jarvis/JARVIS-V5-OS

# Find the previous working commit
git log --oneline -10

# Checkout previous version
git checkout <previous-commit-sha>

# Rebuild
docker compose -f deploy/compose.jarvis.yml up -d --build
```

### Option 2: Docker Image Rollback

```bash
# List available images
docker images | grep jarvis

# If previous images exist, edit compose to use specific tags
# Then restart
docker compose -f deploy/compose.jarvis.yml up -d
```

### Option 3: Keep Previous Images

Before upgrading, tag current images:

```bash
# Before upgrade
docker tag deploy-server:latest deploy-server:backup-$(date +%Y%m%d)
docker tag deploy-web:latest deploy-web:backup-$(date +%Y%m%d)

# To rollback
docker tag deploy-server:backup-20260129 deploy-server:latest
docker tag deploy-web:backup-20260129 deploy-web:latest
docker compose -f deploy/compose.jarvis.yml up -d
```

## Data Persistence

- **Settings**: Stored in `jarvis-data` Docker volume at `/app/data`
- **Backup**: `docker cp jarvis-server:/app/data ./backup-data`
- **Restore**: `docker cp ./backup-data/. jarvis-server:/app/data/`

## Resource Usage

Check container resources:

```bash
docker stats --no-stream jarvis-caddy jarvis-server jarvis-web
```

Typical usage:
- caddy: ~10-20MB RAM
- server: ~100-200MB RAM
- web: ~100-200MB RAM

## Troubleshooting Quick Links

- [Incident First 5 Minutes](./incident-first-5-min.md)
- [SSH LAN Troubleshooting](./ssh-lan-troubleshooting.md)
