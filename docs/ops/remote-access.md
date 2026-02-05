# Remote Access

AKIOR supports optional secure remote access using [Tailscale](https://tailscale.com). This allows you to access your AKIOR instance from anywhere without opening ports on your router.

## Overview

- **Security:** Uses Tailscale's WireGuard-based mesh VPN - no inbound WAN ports
- **Default state:** Disabled (must be explicitly enabled)
- **Two approaches:**
  - **Phase B.1 (Ubuntu host):** Tailscale container (profile-gated, zero-config)
  - **Phase B.0 (Windows host):** Tailscale Serve on host machine

---

## Phase B.1 — Tailscale Container (Ubuntu)

**For Ubuntu 22.04 deployments running `/opt/jarvis/JARVIS-V5-OS`**

### Overview

This approach runs Tailscale as an **optional Docker container** alongside JARVIS services. It's:
- Profile-gated (disabled by default)
- Zero-trust remote access (no inbound WAN ports)
- Isolated from host system
- Uses host networking to access localhost services (Caddy/web/server)

### Prerequisites

1. **Tailscale account**
   - Sign up at https://tailscale.com (free for personal use)
   
2. **Auth key**
   - Generate at: https://login.tailscale.com/admin/settings/keys
   - Recommended: Reusable + Ephemeral for containerized deployments

### Setup

1. **Create local secrets file:**
   ```bash
   cd /opt/jarvis/JARVIS-V5-OS
   cp deploy/secrets/tailscale.env.example deploy/secrets/tailscale.env
   ```

2. **Edit `deploy/secrets/tailscale.env` and add your auth key:**
   ```bash
   nano deploy/secrets/tailscale.env
   # Replace YOUR_TAILSCALE_AUTH_KEY_HERE with your actual key
   ```

3. **Bring up the Tailscale profile:**
   ```bash
   bash ops/remote-access/tailscale-up.sh
   ```

4. **Verify it's running:**
   ```bash
   bash ops/verify/tailscale-check.sh
   ```

### Usage

**Get your Tailscale hostname:**
```bash
# From the Ubuntu host
cd /opt/jarvis/JARVIS-V5-OS/deploy
docker compose exec tailscale tailscale status
```

Your hostname will look like: `jarvis-tailscale.tail12345.ts.net`

**Access JARVIS from any device on your Tailscale network:**
```
https://<your-tailscale-hostname>/
```

### Management

**Start Tailscale:**
```bash
bash ops/remote-access/tailscale-up.sh
```

**Stop Tailscale:**
```bash
bash ops/remote-access/tailscale-down.sh
```

**Check status:**
```bash
bash ops/verify/tailscale-check.sh
```

**View logs:**
```bash
docker logs jarvis-tailscale -f
```

### How It Works

- Tailscale container runs with `network_mode: host`
- This gives it direct access to localhost services (Caddy on port 3000)
- No need for complex network bridges or port mapping
- Container persists state in `tailscale-state` volume
- Auth key is read from local `deploy/secrets/tailscale.env` (gitignored)

### Security Notes

1. **No WAN ports:** Tailscale uses NAT traversal - no router configuration needed
2. **End-to-end encryption:** All traffic is encrypted via WireGuard
3. **Tailscale ACLs:** Control which devices can access your JARVIS instance
4. **Auth key safety:** 
   - Never commit `deploy/secrets/tailscale.env` to git (it's gitignored)
   - Use ephemeral keys for better security
5. **Host networking:** Container shares host network stack for localhost access

### Troubleshooting

**Container not starting:**
```bash
# Check logs
docker logs jarvis-tailscale

# Verify secrets file exists
ls -la /opt/jarvis/JARVIS-V5-OS/deploy/secrets/tailscale.env
```

**Not authenticated:**
```bash
# Check Tailscale status
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml \
  exec tailscale tailscale status

# If auth failed, regenerate your auth key and update secrets file
```

**Can't access JARVIS from Tailscale:**
```bash
# Verify Caddy is listening on localhost:3000
ss -lntp | grep :3000

# Check Tailscale can reach localhost services
docker compose -f /opt/jarvis/JARVIS-V5-OS/deploy/compose.jarvis.yml \
  exec tailscale curl -sk https://localhost:3000/
```

### Future: Phase B.2

Phase B.2 will add:
- Optional Cloudflare DNS sync
- Public ACME certificates (Let's Encrypt)
- Custom domain support

These will remain **optional** and **profile-gated** - LAN-only operation will always be the default.

---

## Phase B.0 — Tailscale Serve (Windows)

**For Windows deployments with Tailscale installed on the host**

## How It Works

Tailscale Serve exposes AKIOR's internal port (3000) to your Tailscale network over HTTPS. When enabled, you can access AKIOR from any device on your Tailscale network using your machine's Tailscale hostname.

Example: `https://akior-pc.tail12345.ts.net`

## Prerequisites

1. **Install Tailscale** on the Windows machine running AKIOR
   - Download from: https://tailscale.com/download/windows
   
2. **Login to Tailscale**
   - Run `tailscale login` or use the GUI
   
3. **Verify installation**
   ```powershell
   .\ops\tailscale-doctor.ps1
   ```

## Enabling Remote Access

### Via Setup Wizard (Recommended)

1. Navigate to `https://akior.home.arpa/setup`
2. Complete Step 1 (Owner PIN) and Step 2 (HTTPS Trust)
3. In Step 3 (Remote Access):
   - Click "Enable Remote Access"
   - Wait for Tailscale Serve to activate

### Via ops Script

```powershell
# Check status first
.\ops\tailscale-serve.ps1 -Status

# Enable Tailscale Serve on port 3000
.\ops\tailscale-serve.ps1 -Enable

# Disable when done
.\ops\tailscale-serve.ps1 -Disable
```

### Via API

```bash
# Check status
curl https://akior.home.arpa/api/admin/remote-access/status

# Enable (requires admin session)
curl -X POST https://akior.home.arpa/api/admin/remote-access/enable

# Disable
curl -X POST https://akior.home.arpa/api/admin/remote-access/disable
```

## Accessing AKIOR Remotely

Once enabled:

1. **Get your Tailscale hostname:**
   - Run `tailscale status` or check the Tailscale GUI
   - Your hostname looks like: `machine-name.tailnet-name.ts.net`

2. **Access from any device on your Tailscale network:**
   ```
   https://<machine-name>.<tailnet>.ts.net
   ```

3. **Mobile devices:**
   - Install Tailscale on your phone/tablet
   - Login with the same account
   - Access the URL above

## Diagnostics

### Check Tailscale Health

```powershell
# Full diagnostic output
.\ops\tailscale-doctor.ps1

# JSON output for programmatic use
.\ops\tailscale-doctor.ps1 -Json
```

### Check Serve Status

```powershell
# Via script
.\ops\tailscale-serve.ps1 -Status

# Direct CLI
tailscale serve status
```

### API Endpoint

```bash
curl https://akior.home.arpa/api/admin/remote-access/status
```

Returns:
```json
{
  "enabled": true,
  "mode": "tailscale",
  "tailscaleStatus": {
    "running": true,
    "serveActive": true,
    "hostname": "akior-pc.tailnet.ts.net"
  },
  "servePort": 3000
}
```

## Security Notes

1. **No WAN ports:** Tailscale uses NAT traversal - no router configuration needed
2. **End-to-end encryption:** All traffic is encrypted via WireGuard
3. **Tailscale ACLs:** Control which devices can access your AKIOR instance
4. **Auth key not stored:** If you provide an auth key during setup, it's used once and never persisted

## Troubleshooting

### "Tailscale not found"

1. Verify Tailscale is installed: `where tailscale`
2. Ensure Tailscale is in your PATH
3. Try restarting your terminal

### "Tailscale not logged in"

1. Run `tailscale login` and complete authentication
2. Check `tailscale status` to verify

### "Serve failed to start"

1. Check if another service is using Tailscale Serve
2. Run `tailscale serve status` to see current config
3. Try resetting: `tailscale serve reset`

### Remote access works but HTTPS not trusted

1. Tailscale Serve uses its own certificates
2. These are automatically trusted by Tailscale clients
3. If using a browser outside Tailscale, you may see a certificate warning

## Disabling Remote Access

```powershell
# Via script
.\ops\tailscale-serve.ps1 -Disable

# Via API
curl -X POST https://akior.home.arpa/api/admin/remote-access/disable
```

Or in the Setup Wizard/Settings page, click "Disable Remote Access".

## Rollback to LAN-Only Mode

If you need to disable all remote access features and return to LAN-only operation:

### Quick Rollback

```bash
cd /opt/jarvis/JARVIS-V5-OS
sudo bash ops/rollback/switch-to-local-only-mode.sh
```

**What this does:**
- Stops any remote-access Docker containers (Tailscale, etc.)
- Ensures Caddy is using internal TLS (self-signed certificates)
- Removes any Cloudflare DNS sync cron jobs
- Restarts the core Docker stack
- Restarts the kiosk service
- Runs LAN verification to confirm everything works

### Safe Testing (Dry-Run)

Test what would happen without making changes:

```bash
cd /opt/jarvis/JARVIS-V5-OS
sudo bash ops/rollback/switch-to-local-only-mode.sh --dry-run
```

This prints all actions that would be taken without executing them.

### Options

```bash
# Dry-run mode (no changes)
sudo bash ops/rollback/switch-to-local-only-mode.sh --dry-run

# Skip kiosk restart (for testing)
sudo bash ops/rollback/switch-to-local-only-mode.sh --no-kiosk-restart

# Show help
sudo bash ops/rollback/switch-to-local-only-mode.sh --help
```

### Verification After Rollback

The rollback script automatically runs LAN verification. You can also run it manually:

```bash
cd /opt/jarvis/JARVIS-V5-OS
bash ops/verify/kiosk-ui-verify.sh
```

### Logs

Rollback logs are saved to:
```
/opt/jarvis/JARVIS-V5-OS/ops/rollback/_logs/rollback_YYYYMMDD_HHMMSS.log
```

These logs include:
- Timestamps for every action
- Commands executed
- Output from Docker and systemctl
- Verification results

## Related Documentation

- [Tailscale Documentation](https://tailscale.com/kb/)
- [Tailscale Serve](https://tailscale.com/kb/1242/tailscale-serve/)
- [First Run Setup](../setup/first-run.md)
- [LAN HTTPS Trust](./lan-tls-trust.md)
- [Incident Response](../runbook/incident-first-5-min.md)
