# Local hostnames for AKIOR

## Why move off `.local`?
- `.local` is reserved for mDNS (RFC 6762) and may resolve to different devices on your LAN.
- Browsers and OSes may prefer mDNS over DNS, causing “stale host” issues.

## Recommended canonical hostname
- Use `akior.home.arpa` (RFC 8375 reserved for home networks).
- Keep `akior.local` / `akior.local` as legacy aliases only.

## How to point to the correct host
### Preferred: Router / DNS server
1) Create an A record: `akior.home.arpa` → `<server LAN IP>`
2) (Optional) Aliases: `akior.local`, `akior.local` → `<server LAN IP>`

### Fallback: Hosts file (per device)
- Add this line (replace `<server LAN IP>`):
```
<server LAN IP> akior.home.arpa
```
- Windows: `C:\Windows\System32\drivers\etc\hosts`
- macOS/Linux: `/etc/hosts`

## Certificates / HTTPS
- Caddy issues an internal CA certificate for `akior.home.arpa`, `akior.local`, `akior.local`.
- Export CA: `docker cp akior-caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root-ca.crt`
- Import CA on your device to trust HTTPS for camera/mic access.

## Self-check (non-technical)
- Open `/diagnostics` in the AKIOR UI. It shows:
  - Current hostname
  - Web build SHA (from `/web-build`)
  - Server build SHA (from `/api/health/build`)
  - Warning if you're on `.local` or if web/server SHAs differ (deployment drift).

## Verifying web vs server SHA
AKIOR runs two containers: `akior-web` (Next.js frontend) and `akior-server` (Fastify backend).
Both must be built and deployed together to stay in sync.

### Endpoints
- **Web build**: `/web-build` - served by akior-web container
- **Server build**: `/api/health/build` - served by akior-server container

### Quick verification (curl)
```bash
# Web SHA
curl -sk https://akior.local/web-build | jq .git_sha

# Server SHA
curl -sk https://akior.local/api/health/build | jq .git_sha

# Both should return the same SHA!
```

### If /diagnostics returns 404
You're running an old akior-web build that doesn't have the diagnostics page.
Redeploy with rebuild to sync both containers:
```powershell
.\ops\deploy.ps1 -Rebuild
```

### If web SHA ≠ server SHA (drift)
This means one container was rebuilt without the other.
Fix by redeploying both:
```powershell
.\ops\deploy.ps1 -Rebuild
```

## Operator quick helper (CLI)
- Run `./ops/dns-doctor.ps1` to print your LAN IP and a ready-to-paste hosts entry.

## Quick Fix (Windows, single machine)
Run:
```
.\ops\dns-doctor.ps1 -Apply -UseLoopback
```
What it does:
- Adds a managed block to `C:\Windows\System32\drivers\etc\hosts` for:
  - akior.home.arpa, akior.local, akior.local → 127.0.0.1
- Flushes DNS cache.
- Verifies `/api/health/build` on akior.home.arpa and akior.local match the local build SHA.

