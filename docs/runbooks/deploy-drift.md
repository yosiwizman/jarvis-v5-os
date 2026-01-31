# Deployment Drift Detection & Recovery

This runbook helps diagnose and fix "deployment drift" — when the running application
serves stale assets that don't match the expected build.

## Symptoms

- Settings page crashes with `TypeError: Cannot read properties of undefined`
- Browser console references old hashed bundles (e.g., `page-1c6a2a71d758b1c8.js`)
- Application behavior doesn't match recent code changes
- Error boundaries show a different build SHA than expected

## Quick Verification (10 seconds)

### Step 1: Check the API Build Info

Open in your browser or curl:

```
https://akior.local/api/health/build
```

Expected response:
```json
{
  "ok": true,
  "git_sha": "abc1234",
  "build_time": "2026-01-31T00:00:00.000Z",
  "app_version": "6.2.0",
  "env": { ... },
  "time": "2026-01-31T05:00:00.000Z"
}
```

**Record the `git_sha` value.**

### Step 2: Check UI-Displayed SHA

1. Open the AKIOR dashboard (any page with sidebar)
2. Look at the sidebar footer — it shows `Build: <sha>`
3. If an error occurred, the error screen shows the build SHA

**Compare**: UI SHA should match API SHA.

### Step 3: Verify Expected SHA

Check what SHA *should* be deployed:

```bash
git -C /path/to/jarvis-v5-os log --oneline -1
```

Or check your deployment system (GitHub Actions, CI/CD dashboard).

## Diagnosis

| API SHA | UI SHA | Expected SHA | Problem |
|---------|--------|--------------|---------|
| ✓ Match | ✓ Match | ✓ Match | No drift — bug is in code |
| ✓ Match | ✓ Match | ✗ Different | Server running old build |
| ✓ Match | ✗ Different | - | Client cached stale HTML |
| ✗ Different | - | - | Multiple instances with different builds |

## Recovery Procedures

### A. Client Has Stale HTML Cache

**Symptoms**: API SHA is correct, but UI SHA differs.

**Fix**:
1. Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Clear browser cache for the site
3. Try incognito/private window

**Note**: Incognito won't help if the *server* is serving stale HTML.

### B. Server Running Old Build

**Symptoms**: API SHA doesn't match expected deployment SHA.

**Fix (Docker/Container)**:
```bash
# Stop and remove old container
docker stop akior-web
docker rm akior-web

# Pull latest and start
docker pull your-registry/akior-web:latest
docker run -d --name akior-web ... your-registry/akior-web:latest
```

**Fix (PM2/Node)**:
```bash
cd /path/to/jarvis-v5-os/apps/web
npm run build
pm2 restart akior-web
```

**Fix (Systemd)**:
```bash
sudo systemctl restart akior-web
```

### C. Proxy/CDN Caching Stale HTML

**Symptoms**: Server shows correct SHA, but browser still gets old build.

**Check reverse proxy configuration**. Ensure HTML is not cached:

**Nginx**:
```nginx
location / {
    # Don't cache HTML
    add_header Cache-Control "no-store, no-cache, must-revalidate";
    proxy_pass http://localhost:3000;
}

location /_next/static/ {
    # Cache hashed static assets forever
    add_header Cache-Control "public, max-age=31536000, immutable";
    proxy_pass http://localhost:3000;
}
```

**Caddy**:
```
akior.local {
    header / Cache-Control "no-store, no-cache, must-revalidate"
    header /_next/static/* Cache-Control "public, max-age=31536000, immutable"
    reverse_proxy localhost:3000
}
```

### D. Multiple Instances/Containers

**Symptoms**: SHA changes between refreshes.

**Diagnosis**:
```bash
# Check if multiple containers are running
docker ps | grep akior

# Check load balancer configuration
```

**Fix**: Ensure all instances are running the same build.

## Prevention

### Build-Time Checks

The CI pipeline should verify build info:

```yaml
- name: Verify build
  run: |
    SHA=$(curl -s https://akior.local/api/health/build | jq -r '.git_sha')
    if [ "$SHA" != "${{ github.sha }}" ]; then
      echo "Build drift detected! Expected ${{ github.sha }}, got $SHA"
      exit 1
    fi
```

### Runtime Monitoring

The drift detection E2E tests run in CI:

```bash
npm run test:e2e -- --grep "Deployment Drift"
```

### Cache Headers

Next.js is configured with proper cache headers (see `apps/web/next.config.mjs`):
- HTML: `no-store, no-cache, must-revalidate`
- Static assets: `public, max-age=31536000, immutable`

## Related

- `/api/health` — Full health check with server status
- `/api/health/build` — Build-only info (always available)
- `e2e/drift-detection.spec.ts` — Automated drift tests
- `docs/ops/deployment.md` — General deployment procedures
