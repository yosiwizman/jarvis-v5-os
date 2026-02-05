# LAN mDNS (`*.local`) for AKIOR

AKIOR now ships with **Avahi-daemon**, advertising `akior.local` so that
Windows 11 (with Apple "Bonjour" or native mDNS), macOS, iOS and Linux hosts
can reach the UI without editing `/etc/hosts`.

## Overview

- **Service type**: `_http._tcp`, `_https._tcp`
- **Hostname**: `akior.local`
- **Ports**: `80` (HTTP), `443` (HTTPS)
- **mDNS port**: `5353` (UDP)

## How It Works

1. **Avahi-daemon** runs on the kiosk server and advertises the hostname `akior.local` via multicast DNS (mDNS) on the local network.
2. Client devices with mDNS support can resolve `akior.local` to the server's IP address without manual DNS configuration.
3. The systemd unit `akior-avahi.service` ensures Avahi starts on boot and stays running.

## Platform Support

### Linux
✅ Works out of the box with Avahi or systemd-resolved

### macOS / iOS
✅ Built-in mDNS support (Bonjour)

### Windows 11
⚠️ Requires additional setup:

**Option 1: Install Bonjour Print Services**
- Download: [Bonjour Print Services for Windows](https://support.apple.com/kb/DL999)
- Install and restart
- `akior.local` will now resolve automatically

**Option 2: Manual hosts file entry (fallback)**
```
C:\Windows\System32\drivers\etc\hosts
```
Add line:
```
<server-ip> akior.local
```

## Deployment

The mDNS setup is deployed automatically via:
```bash
ops/deploy/deploy-mdns.sh
```

This is called from `ops/deploy/deploy-kiosk.sh` before kiosk verification.

## Verification

Check mDNS status:
```bash
bash ops/linux/lan-mdns/status.sh
```

Full verification (tests connectivity + mDNS):
```bash
bash ops/verify/lan-mdns-check.sh
```

## Troubleshooting

### Avahi not advertising
```bash
systemctl status avahi-daemon
sudo systemctl restart avahi-daemon
```

### Client can't resolve akior.local
1. Verify server is advertising:
   ```bash
   avahi-browse -a
   ```
2. Check firewall allows UDP port 5353:
   ```bash
   sudo ufw allow 5353/udp
   ```
3. Test from client:
   ```bash
   ping akior.local
   ```

### Windows still can't resolve
- Install Bonjour Print Services
- Or use IP address directly: `https://<ip>/menu`
- Or add manual hosts file entry (see above)

## Files

- `ops/linux/lan-mdns/install.sh` - Install Avahi packages
- `ops/linux/lan-mdns/status.sh` - Check mDNS status
- `ops/deploy/deploy-mdns.sh` - Deploy mDNS configuration
- `ops/verify/lan-mdns-check.sh` - Verify mDNS functionality
- `deploy/systemd/akior-avahi.service` - Systemd wrapper unit
