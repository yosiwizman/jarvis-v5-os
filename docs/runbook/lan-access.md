# JARVIS LAN Access Guide

This guide explains how to access JARVIS from other machines on your local network.

## Quick Start

After deployment, JARVIS is accessible at:

```
http://<host-ip>/
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

You should see the JARVIS interface.

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

## Security Notes

- Port 80 is accessible to all devices on the same network
- Internal services (3001, 1234) are NOT exposed to the network
- For internet access, use Tailscale or set up HTTPS with a proper certificate
