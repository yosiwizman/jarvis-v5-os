# Deployment Drift Detection

This document describes the deployment drift detection system for AKIOR, which helps operators verify that running containers match the expected git revision.

## What is Drift?

**Deployment drift** occurs when running containers are built from a different git commit than the current repository HEAD. This can happen when:

- Code is merged to main but containers aren't rebuilt
- Manual deployments are done without rebuilding images
- Container images are rolled back without matching git state

Drift detection helps ensure that what's deployed matches what's expected.

## Detection Methods

AKIOR provides three ways to check for drift:

### 1. API Endpoint (Recommended for Monitoring)

The `/api/ops/drift` endpoint returns drift status as JSON:

```bash
curl -s https://akior.local/api/ops/drift | jq .
```

Response:
```json
{
  "ok": true,
  "expectedSha": "8efe503ca26c4eb5f388d73b1d180c41151ee7ff",
  "running": {
    "server": "8efe503ca26c4eb5f388d73b1d180c41151ee7ff",
    "web": "8efe503ca26c4eb5f388d73b1d180c41151ee7ff"
  },
  "drift": false,
  "driftDetails": [],
  "time": "2026-02-03T16:00:00.000Z"
}
```

Fields:
- `ok`: `true` if no drift detected
- `expectedSha`: The GIT_SHA baked into the server container at build time
- `running.server`: Server container's build SHA
- `running.web`: Web container's build SHA (fetched via internal health check)
- `drift`: `true` if any container doesn't match expected SHA
- `driftDetails`: Array of human-readable drift reasons
- `time`: ISO timestamp of the check

### 2. Host Script (Recommended for CI/CD)

The `drift-check.sh` script runs on the host and compares the git repo HEAD with running container labels:

```bash
# Text output (human-readable)
/opt/jarvis/JARVIS-V5-OS/deploy/scripts/drift-check.sh

# JSON output (for scripting)
/opt/jarvis/JARVIS-V5-OS/deploy/scripts/drift-check.sh --json

# Quiet mode (exit code only)
/opt/jarvis/JARVIS-V5-OS/deploy/scripts/drift-check.sh --quiet
```

Exit codes:
- `0`: No drift detected
- `1`: Drift detected
- `2`: Error (missing dependencies, etc.)

Example usage in CI:
```bash
if ! /opt/jarvis/JARVIS-V5-OS/deploy/scripts/drift-check.sh --quiet; then
  echo "⚠️ Deployment drift detected! Containers need rebuild."
  exit 1
fi
```

### 3. Systemd Timer (Optional Scheduled Checks)

For periodic monitoring, install the systemd timer:

```bash
# Copy unit files
sudo cp /opt/jarvis/JARVIS-V5-OS/deploy/systemd/akior-drift-check.service /etc/systemd/system/
sudo cp /opt/jarvis/JARVIS-V5-OS/deploy/systemd/akior-drift-check.timer /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable timer (runs every 6 hours)
sudo systemctl enable --now akior-drift-check.timer

# Check timer status
systemctl list-timers akior-drift-check.timer

# View last check results
journalctl -u akior-drift-check.service -n 20
```

To disable:
```bash
sudo systemctl disable --now akior-drift-check.timer
```

## How Drift is Detected

### Build-Time SHA Embedding

When containers are built, the `GIT_SHA` is embedded:

1. **Docker build args**: The compose file passes `GIT_SHA` as a build arg
2. **Environment variable**: Containers have `GIT_SHA` in their environment
3. **OCI label** (optional): `org.opencontainers.image.revision`

### Detection Logic

The drift check compares:

1. **API Endpoint**: Compares the server's `GIT_SHA` env with web container's health endpoint
2. **Host Script**: Compares `git rev-parse HEAD` with container labels/env

## Fixing Drift

When drift is detected, rebuild and redeploy:

```bash
cd /opt/jarvis/JARVIS-V5-OS

# Pull latest code
git pull origin main

# Rebuild and restart containers
docker compose -f deploy/compose.jarvis.yml up -d --build

# Verify drift is resolved
curl -s https://akior.local/api/ops/drift | jq .ok
```

## Monitoring Integration

### Prometheus/Grafana

You can scrape the drift endpoint and alert on `drift: true`:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'akior-drift'
    metrics_path: /api/ops/drift
    static_configs:
      - targets: ['akior.local']
```

### Simple Health Check

Add to your monitoring system:

```bash
# Returns 0 if healthy, non-zero if drift
curl -sf https://akior.local/api/ops/drift | jq -e '.ok == true'
```

## Troubleshooting

### "Expected SHA unknown"

The `GIT_SHA` wasn't set at build time. Rebuild with:

```bash
GIT_SHA=$(git rev-parse HEAD) BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  docker compose -f deploy/compose.jarvis.yml up -d --build
```

### "Web container health endpoint unreachable"

The server can't reach the web container's internal health endpoint. This usually means:
- Web container isn't running
- Network configuration issue between containers
- Web container is starting up (wait a few seconds and retry)

### Script reports "unknown" for container SHA

The container doesn't have the GIT_SHA label or env var. Rebuild the images with proper build args.
