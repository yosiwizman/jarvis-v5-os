# Remote Access via Tailscale Serve

AKIOR supports optional secure remote access using [Tailscale](https://tailscale.com). This allows you to access your AKIOR instance from anywhere without opening ports on your router.

## Overview

- **Security:** Uses Tailscale's WireGuard-based mesh VPN - no inbound WAN ports
- **Default state:** Disabled (must be explicitly enabled)
- **Requirement:** Tailscale must be installed on the AKIOR host machine

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

## Related Documentation

- [Tailscale Documentation](https://tailscale.com/kb/)
- [Tailscale Serve](https://tailscale.com/kb/1242/tailscale-serve/)
- [First Run Setup](../setup/first-run.md)
- [LAN HTTPS Trust](./lan-tls-trust.md)
