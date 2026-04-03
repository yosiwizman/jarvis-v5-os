# Deployment Drift Detection & Recovery

This runbook helps diagnose and fix "deployment drift" — when the running application
serves stale assets that don't match the expected build.

## Symptoms

- `/api/health/build` returns **404** (endpoint doesn't exist in running build)
- Settings page crashes with `TypeError: Cannot read properties of undefined`
- Browser console references old hashed bundles (e.g., `page-1c6a2a71d758b1c8.js`)
- Application behavior doesn't match recent code changes
- Error boundaries show a different build SHA than expected

> **CRITICAL**: If `/api/health/build` returns 404, you are NOT running a recent build.
> Skip to [One-Command Redeploy](#one-command-redeploy-recommended) below.

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
git -C /path/to/akior-v5-os log --oneline -1
```

Or check your deployment system (GitHub Actions, CI/CD dashboard).

## Diagnosis

| API SHA | UI SHA | Expected SHA | Problem |
|---------|--------|--------------|---------|
| ✓ Match | ✓ Match | ✓ Match | No drift — bug is in code |
| ✓ Match | ✓ Match | ✗ Different | Server running old build |
| ✓ Match | ✗ Different | - | Client cached stale HTML |
| ✗ Different | - | - | Multiple instances with different builds |

## One-Command Redeploy (Recommended)

For the local Docker Compose stack, use the automated redeploy script:

```powershell
# From the repo root on Windows:
.\deploy\local\redeploy.ps1
```

This script will:
1. Pull latest code from main
2. Stop existing containers
3. Rebuild images with `--no-cache` (injects git SHA)
4. Start containers with `--force-recreate`
5. Wait for health checks to pass
6. Verify `/api/health/build` returns correct SHA
7. Check `/settings` loads without crash

### Verification Script

To verify a live deployment without redeploying:

```powershell
# Check if live build matches expected SHA:
.\scripts\verify-live-build.ps1

# Or with custom URL:
.\scripts\verify-live-build.ps1 -BaseUrl "http://localhost:3000"
```

## Manual Recovery Procedures

### A. Client Has Stale HTML Cache

**Symptoms**: API SHA is correct, but UI SHA differs.

**Fix**:
1. Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Clear browser cache for the site
3. Try incognito/private window

**Note**: Incognito won't help if the *server* is serving stale HTML.

### B. Server Running Old Build

**Symptoms**: API SHA doesn't match expected deployment SHA, or `/api/health/build` returns 404.

**Fix (Recommended - Docker Compose)**:
```powershell
# Use the one-command redeploy script:
.\deploy\local\redeploy.ps1
```

**Fix (Manual Docker Compose)**:
```powershell
cd deploy

# Get current git info
$SHA = git rev-parse --short HEAD
$TIME = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

# Stop, rebuild, start
docker compose -f compose.akior.yml down
docker compose -f compose.akior.yml build --no-cache `
    --build-arg GIT_SHA=$SHA `
    --build-arg BUILD_TIME=$TIME
docker compose -f compose.akior.yml up -d --force-recreate
```

**Fix (PM2/Node)**:
```bash
cd /path/to/akior-v5-os/apps/web
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

### E. akior.local Points to Wrong Host

**Symptoms**: 
- `localhost:3000/settings` works, but `akior.local/settings` shows old build
- Settings page shows "Build Drift Detected" warning
- SHA returned by API doesn't match expected
- Ping shows non-localhost IP with TTL=64 (another LAN device)

**Diagnosis**:
```powershell
# Check what IP akior.local resolves to
ping -n 1 akior.local

# Check hosts file
type C:\Windows\System32\drivers\etc\hosts | Select-String "akior"

# Verify build SHA on the target host
curl https://akior.local/api/health/build -k

# Compare with local build
curl http://localhost:3000/api/health/build
```

**Fix Options** (choose based on your network setup):

#### Option 1: Update Hosts File (Per-Device)

Edit `C:\Windows\System32\drivers\etc\hosts` as Administrator:
```
# Point akior.local to the correct host
192.168.1.100  akior.local
```

Replace `192.168.1.100` with the IP of the machine running AKIOR.

#### Option 2: Update Router DNS (Network-Wide, Recommended)

1. Log into your router admin panel
2. Find DNS/DHCP settings
3. Add a static DNS entry: `akior.local` → `<LAN IP of AKIOR server>`
4. Flush DNS on clients: `ipconfig /flushdns`

#### Option 3: Run Local DNS (Advanced)

See `docs/ops/dns-setup.md` for setting up AdGuard Home or dnsmasq.

#### Option 4: Redeploy on Target Host

If `akior.local` correctly points to a dedicated server, redeploy there:
```bash
ssh user@akior-server
cd /path/to/akior-v5-os
git pull origin main
./deploy/local/redeploy.ps1  # or equivalent for Linux
```

**Verification**:
```powershell
# After fix, both should return same SHA:
.\scripts\verify-live-build.ps1 -BaseUrl "http://localhost:3000"
.\scripts\verify-live-build.ps1 -BaseUrl "https://akior.local"
```

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
- `deploy/local/redeploy.ps1` — One-command redeploy script
- `scripts/verify-live-build.ps1` — Deployment verification script
- `e2e/drift-detection.spec.ts` — Automated drift tests
- `deploy/Caddyfile` — Reverse proxy configuration with cache headers
- `docs/ops/deployment.md` — General deployment procedures
