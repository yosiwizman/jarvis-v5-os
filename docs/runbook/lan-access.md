# AKIOR LAN Access Guide

This guide explains how to access AKIOR from other machines on your local network.

## Quick Start

After deployment, AKIOR is accessible at:

```
HTTPS (recommended): https://akior.local/     (primary)
                     https://jarvis.local/    (alias)
HTTP (fallback):     http://<host-ip>/
```

To find the host IP, run on the deployment host:
```bash
ip -br a | grep UP | awk '{print $3}' | cut -d/ -f1
```

Example: `http://192.168.1.100/`

## Port Overview

| Port | Interface | Purpose |
|------|-----------|----------|
| 443 | `0.0.0.0` (all) | **LAN HTTPS** - camera/mic works |
| 80 | `0.0.0.0` (all) | **LAN HTTP fallback** - no camera/mic |
| 3000 | `localhost` | Tailscale Serve integration |
| 3001 | Docker internal | Next.js frontend (not exposed) |
| 1234 | Docker internal | API server (not exposed) |

## Setting Up a Hostname (Optional)

Instead of using the IP address, you can set up a friendly hostname like `akior.local` (primary) or `jarvis.local` (alias).

### Option 1: Windows Hosts File (Recommended for Single User)

1. Open Notepad **as Administrator**
2. Open file: `C:\Windows\System32\drivers\etc\hosts`
3. Add this line (replace IP with your host IP):
   ```
   192.168.1.204    akior.local jarvis.local aifactory-lan
   ```
4. Save and close
5. Flush DNS: `ipconfig /flushdns`
6. Access via: `https://akior.local/` or `https://jarvis.local/`

### Option 2: macOS/Linux Hosts File

```bash
# Edit hosts file
sudo nano /etc/hosts

# Add line (replace IP):
192.168.1.100    jarvis.local aifactory-lan

# Save and exit (Ctrl+O, Ctrl+X)
```

### Option 3: Router DNS (Best for Multiple Users)

If your router supports custom DNS entries:
1. Log into your router admin panel
2. Find DNS or DHCP settings
3. Add a static hostname entry pointing to the host IP
4. All devices on the network can then use the hostname

### Option 4: mDNS / Avahi (Automatic Discovery)

If the host runs Avahi (common on Ubuntu):
```bash
# Install on host if needed
sudo apt install avahi-daemon

# The host becomes accessible as:
# http://hostname.local/
# (where hostname is the machine's hostname)
```

Windows users need Bonjour Print Services or iTunes installed for `.local` resolution.

## Verifying Access

### From the Host

```bash
# Check ports are listening
ss -lntp | grep -E ':80|:3000'

# Test HTTP
curl -I http://127.0.0.1/
curl -I http://127.0.0.1:3000/
```

### From Another LAN Machine

```bash
# Using IP
curl -I http://192.168.1.100/

# Using hostname (if configured)
curl -I http://jarvis.local/
```

Expected response:
```
HTTP/1.1 307 Temporary Redirect
Location: /menu
Server: Caddy
```

### Browser Test

Open in browser: `http://<host-ip>/`

You should see the AKIOR login page.

## Troubleshooting

### "Connection Refused"

1. **Check containers are running:**
   ```bash
   docker compose -f deploy/compose.jarvis.yml ps
   ```
   All should show `Up (healthy)`.

2. **Check ports 80 and 443 are listening:**
   ```bash
   ss -lntp | grep -E ':(80|443)'
   ```
   Should show `0.0.0.0:80` and `0.0.0.0:443`.

3. **Port 443 not listening?** The compose file may be outdated. Pull latest and restart:
   ```bash
   cd /opt/jarvis/JARVIS-V5-OS  # or your install path
   git pull origin main
   docker compose -f deploy/compose.jarvis.yml down
   docker compose -f deploy/compose.jarvis.yml up -d
   ```

4. **Check firewall:**
   ```bash
   sudo ufw status
   # If active, allow port 80:
   sudo ufw allow 80/tcp
   ```

### "Host Not Found" (Hostname Doesn't Resolve)

- Verify hosts file entry is correct
- Try flushing DNS cache:
  - Windows: `ipconfig /flushdns`
  - macOS: `sudo dscacheutil -flushcache`
  - Linux: `sudo systemd-resolve --flush-caches`

### Caddy Returns 502

Backend service is down. Check:
```bash
docker logs jarvis-server --tail=50
docker logs jarvis-web --tail=50
```

## UI Troubleshooting

### Settings Page Crash

If the Settings page shows "Application error: a client-side exception has occurred":

1. The page now has an error boundary that catches most errors
2. Try the "Reset settings" button on the error page
3. Clear browser localStorage: `localStorage.removeItem('smartMirrorSettings')`
4. Clear browser cache and reload

### Camera Not Working

Camera requires HTTPS for browser security reasons. On the camera page, check the "Camera Diagnostics" panel at the bottom.

**Solution:** Access via `https://akior.local/camera` (not HTTP). See "HTTPS Setup" section below.

### Login Page

AKIOR now shows a login page at `/login` by default:
- "Quick Access" bypasses authentication for local use
- "Enter Access Code" accepts any 4+ character code
- Auth state is stored in `localStorage['akior.authenticated']`
- To logout: `localStorage.removeItem('akior.authenticated')` and refresh

## HTTPS Setup (For Camera/Mic)

Browsers require HTTPS for camera and microphone access. AKIOR uses Caddy's internal CA for automatic certificate generation - no manual cert setup needed.

### Step 1: Deploy/Update the Stack

```bash
cd /opt/jarvis/JARVIS-V5-OS  # or your install path
git pull origin main
docker compose -f deploy/compose.jarvis.yml down
docker compose -f deploy/compose.jarvis.yml up -d
```

Caddy automatically generates certificates for `akior.local`, `jarvis.local`, and `aifactory-lan`.

### Step 2: Verify HTTPS is Working

```bash
# From host - check ports are listening
ss -lntp | grep -E ':(80|443)'

# Test HTTPS (will show cert warning until CA is trusted)
curl -k https://localhost/
```

### Step 3: Export Caddy's Root CA

```bash
# On the host, extract the CA certificate:
docker cp jarvis-caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root-ca.crt

# Copy to your Windows machine (e.g., via SCP or shared folder)
```

### Step 4: Trust CA on Windows

**Option A: Using the import script (Recommended)**
```powershell
# Run PowerShell as Administrator:
cd C:\path\to\jarvis-v5-os
.\ops\windows\import-lan-rootca.ps1 -CertPath "C:\path\to\caddy-root-ca.crt"
```

**Option B: Manual import**
1. Double-click `caddy-root-ca.crt`
2. Click "Install Certificate"
3. Select "Local Machine" > Next
4. Select "Place all certificates in the following store"
5. Browse > "Trusted Root Certification Authorities" > OK
6. Next > Finish
7. Restart browser and flush DNS: `ipconfig /flushdns`

### Step 5: Verify from Browser

Open in browser:
- `https://akior.local/` - Should show AKIOR without certificate warnings
- `https://akior.local/camera` - Camera should work
- `https://akior.local/display` - Kiosk display

### HTTP Fallback

If HTTPS has issues, HTTP is still available on port 80:
- `http://akior.local/` (shows insecure warning banner)
- Camera/mic features will be disabled over HTTP

## Branding

- **Primary hostname:** `akior.local` - AKIOR is the official product name
- **Alias:** `jarvis.local` - kept for backward compatibility only
- **UI branding:** All user-facing text displays "AKIOR" (not "Jarvis")
- **Internal code:** Some internal code/filenames may still use "jarvis" for compatibility

## Security Notes

- Port 443 (HTTPS) and 80 (HTTP) are accessible to all devices on the same network
- Internal services (3001, 1234) are NOT exposed to the network
- Caddy's internal CA is only trusted on machines where you import `caddy-root-ca.crt`
- For internet access, use Tailscale or set up HTTPS with a public certificate

