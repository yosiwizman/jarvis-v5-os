# AKIOR LAN Access Guide

This guide explains how to access AKIOR from other machines on your local network.

## Quick Start

After deployment, AKIOR is accessible at:

```
HTTPS (recommended): https://jarvis.local/
HTTP (fallback):     http://<host-ip>/
```

To find the host IP, run on the deployment host:
```bash
ip -br a | grep UP | awk '{print $3}' | cut -d/ -f1
```

Example: `http://192.168.1.100/`

## Port Overview

| Port | Interface | Purpose |
|------|-----------|---------|
| 80 | `0.0.0.0` (all) | **LAN HTTP access** - use this from other machines |
| 3000 | `127.0.0.1` (localhost) | Tailscale Serve integration |
| 3001 | Docker internal | Next.js frontend (not exposed) |
| 1234 | Docker internal | API server (not exposed) |

## Setting Up a Hostname (Optional)

Instead of using the IP address, you can set up a friendly hostname like `jarvis.local` or `aifactory-lan`.

### Option 1: Windows Hosts File (Recommended for Single User)

1. Open Notepad **as Administrator**
2. Open file: `C:\Windows\System32\drivers\etc\hosts`
3. Add this line (replace IP with your host IP):
   ```
   192.168.1.100    jarvis.local aifactory-lan
   ```
4. Save and close
5. Access via: `http://jarvis.local/` or `http://aifactory-lan/`

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

2. **Check port 80 is listening:**
   ```bash
   ss -lntp | grep ':80'
   ```
   Should show `0.0.0.0:80` or `*:80`.

3. **Check firewall:**
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

**Solution: Enable HTTPS with Local Certificates**

AKIOR supports HTTPS via mkcert-generated certificates. See "HTTPS Setup" section below.

### Login Page

AKIOR now shows a login page at `/login` by default:
- "Quick Access" bypasses authentication for local use
- "Enter Access Code" accepts any 4+ character code
- Auth state is stored in `localStorage['akior.authenticated']`
- To logout: `localStorage.removeItem('akior.authenticated')` and refresh

## HTTPS Setup (For Camera/Mic)

Browsers require HTTPS for camera and microphone access. AKIOR uses locally-trusted certificates via mkcert.

### Step 1: Generate Certificates (On Host)

```bash
# Run the certificate setup script
cd /path/to/jarvis-v5-os
bash ops/setup/lan-https-certs.sh
```

This creates:
- `deploy/certs/cert.pem` - certificate for jarvis.local, aifactory-lan, localhost
- `deploy/certs/key.pem` - private key
- `deploy/certs/rootCA.pem` - CA certificate for clients to trust

### Step 2: Restart the Stack

```bash
docker compose -f deploy/compose.jarvis.yml down
docker compose -f deploy/compose.jarvis.yml up -d
```

### Step 3: Trust CA on Client Machines

Copy `deploy/certs/rootCA.pem` to each client machine, then:

**Windows:**
1. Double-click `rootCA.pem`
2. Click "Install Certificate"
3. Select "Local Machine" > Next
4. Select "Place all certificates in the following store"
5. Browse > "Trusted Root Certification Authorities" > OK
6. Next > Finish
7. Restart browser

**macOS:**
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain rootCA.pem
```

**Linux (Ubuntu/Debian):**
```bash
sudo cp rootCA.pem /usr/local/share/ca-certificates/akior-local.crt
sudo update-ca-certificates
```

### Step 4: Verify HTTPS

```bash
# From host
bash ops/verify/https-ui-check.sh

# From client
curl -I https://jarvis.local/
```

Open `https://jarvis.local/camera` in browser - camera should now work.

### HTTP Fallback

If HTTPS has issues, HTTP is still available on port 80:
- `http://jarvis.local/` (shows insecure warning banner)
- Camera/mic features will be disabled over HTTP

## Security Notes

- Port 443 (HTTPS) and 80 (HTTP) are accessible to all devices on the same network
- Internal services (3001, 1234) are NOT exposed to the network
- Local certificates are NOT trusted by browsers until CA is installed
- For internet access, use Tailscale or set up HTTPS with a public certificate

