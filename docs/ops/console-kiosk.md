# AKIOR Console Kiosk

Turn an Ubuntu Server into a dedicated AKIOR console display. This creates a minimal GUI environment that automatically launches Chromium in kiosk mode, displaying the AKIOR console interface.

## Overview

**What it does:**
- Installs minimal GUI stack (Xorg + Openbox, no full desktop environment)
- Installs Chromium browser (via snap)
- Creates a dedicated `akior-kiosk` user
- Configures systemd to auto-start the kiosk on boot
- Includes watchdog to restart the browser if it crashes

**Use case:**
A dedicated physical monitor connected to your server displaying the AKIOR console UI. Perfect for a wall-mounted smart home dashboard.

**Security:**
- Local console only — no inbound WAN ports
- Browser runs as unprivileged user
- SSH access is unaffected

## Requirements

- Ubuntu Server 22.04 LTS or 24.04 LTS
- Physical monitor connected to the server
- Network access to your AKIOR instance
- Root/sudo access

## Quick Start

```bash
# Clone the repo or copy the scripts to your server
cd /tmp
git clone https://github.com/yosiwizman/akior-v5-os.git
cd akior-v5-os/ops/linux/console-kiosk

# Install with default settings
sudo ./install.sh

# Or specify a custom URL and IP
sudo ./install.sh --url https://akior.home.arpa/console --ip 192.168.1.100

# Reboot to start the kiosk
sudo reboot
```

## Installation

### Default Installation

```bash
sudo ./install.sh
```

This will:
1. Install Xorg, Openbox, and Chromium
2. Create the `akior-kiosk` user
3. Add `/etc/hosts` entry: `127.0.0.1 akior.home.arpa`
4. Create systemd service for auto-start
5. Set graphical target as default boot target

### Custom Installation

```bash
# Custom URL (different AKIOR page or external URL)
sudo ./install.sh --url https://akior.home.arpa/akior

# Custom IP (if your AKIOR server is on a different machine)
sudo ./install.sh --ip 192.168.1.50

# Both
sudo ./install.sh --url https://akior.home.arpa/console --ip 192.168.1.50
```

### Starting the Kiosk

After installation, either:

```bash
# Start immediately (no reboot)
sudo systemctl start akior-kiosk

# Or reboot
sudo reboot
```

## Uninstallation

### Basic Uninstall (keeps packages and user)

```bash
sudo ./uninstall.sh
```

### Complete Uninstall

```bash
# Remove everything including the kiosk user and GUI packages
sudo ./uninstall.sh --remove-user --remove-packages
```

### Options

| Flag | Description |
|------|-------------|
| `--remove-user` | Remove the `akior-kiosk` user and home directory |
| `--remove-packages` | Remove GUI packages (xorg, openbox, chromium) |

## Status Check

```bash
./status.sh

# Show more log lines
./status.sh --logs 100
```

This reports:
- Installed packages
- Kiosk user status
- Systemd service status
- Configured URL
- X server / Chromium process status
- Recent journal logs

## Changing the Kiosk URL

### Method 1: Edit the service file

```bash
sudo systemctl stop akior-kiosk
sudo nano /etc/systemd/system/akior-kiosk.service

# Edit the Environment line:
# Environment=KIOSK_URL=https://your-new-url.com/page

sudo systemctl daemon-reload
sudo systemctl start akior-kiosk
```

### Method 2: Reinstall

```bash
sudo ./uninstall.sh
sudo ./install.sh --url https://your-new-url.com/page
```

## Troubleshooting

### Black screen on boot

**Symptom:** Monitor shows black screen after boot, no browser visible.

**Check:**
```bash
# Check if service is running
sudo systemctl status akior-kiosk

# Check X server logs
journalctl -u akior-kiosk -n 100

# Check if X started
ps aux | grep Xorg
```

**Common causes:**
1. **GPU drivers not loaded:** Some graphics cards need additional drivers
   ```bash
   # For Intel/AMD
   sudo apt install xserver-xorg-video-intel  # or -amd
   
   # For NVIDIA
   sudo apt install nvidia-driver-XXX  # check available versions
   ```

2. **Wrong VT:** The service uses VT1; if another service is using it:
   ```bash
   sudo systemctl disable getty@tty1.service
   ```

3. **Permission issues:** Ensure kiosk user has video group membership:
   ```bash
   sudo usermod -aG video akior-kiosk
   ```

### X server not starting

**Check X logs:**
```bash
cat /var/log/Xorg.0.log | tail -50
```

**Try manually:**
```bash
# Switch to kiosk user
sudo -u akior-kiosk bash

# Try to start X
startx -- :0 vt1
```

### Chromium not launching

**Symptom:** X starts but browser doesn't appear.

**Check:**
```bash
# Check if Chromium is installed
which chromium || snap list chromium

# Check Openbox autostart
cat /home/akior-kiosk/.config/openbox/autostart

# Check kiosk script
cat /home/akior-kiosk/start-kiosk.sh
```

**Try manually:**
```bash
sudo -u akior-kiosk bash
export DISPLAY=:0
/snap/bin/chromium --kiosk https://akior.home.arpa/console
```

### Certificate errors

If you see certificate warnings in the browser:

1. **Use the proper hostname:** Ensure you're using `akior.home.arpa` (trusted by Caddy's CA)
2. **Install the CA certificate:** See [LAN HTTPS Trust](./lan-tls-trust.md)
3. **Temporary workaround:** The kiosk script includes `--ignore-certificate-errors`

### DNS resolution issues

**Symptom:** Browser shows "cannot resolve hostname".

**Check:**
```bash
# Verify /etc/hosts
grep akior /etc/hosts

# Test resolution
ping akior.home.arpa
```

**Fix:**
```bash
# Add/update hosts entry
echo "192.168.1.100    akior.home.arpa" | sudo tee -a /etc/hosts
```

### Service keeps restarting

**Check the logs:**
```bash
journalctl -u akior-kiosk -f
```

**Common causes:**
1. Chromium crashing immediately (check for missing libs)
2. X server failing to start (check permissions)
3. Network not ready (URL unreachable)

### Mouse cursor visible

The kiosk uses `unclutter` to hide the cursor after 3 seconds of inactivity. If it's not working:

```bash
# Check if unclutter is installed
which unclutter

# Install if missing
sudo apt install unclutter
```

## Hostname Recommendation

**Use `akior.home.arpa` instead of `akior.local`**

The `.local` domain uses mDNS (Multicast DNS) which is unreliable on many networks:
- May not work across VLANs
- Some routers block mDNS traffic
- Resolution can be slow or fail intermittently

The `.home.arpa` domain:
- Uses standard DNS or `/etc/hosts`
- Works reliably on all networks
- Is the IETF-recommended domain for home networks (RFC 8375)

## Architecture

```
┌─────────────────────────────────────────────┐
│              Ubuntu Server                   │
├─────────────────────────────────────────────┤
│  systemd (graphical.target)                 │
│      │                                       │
│      ▼                                       │
│  akior-kiosk.service                        │
│      │                                       │
│      ▼                                       │
│  startx → Xorg (VT1)                        │
│      │                                       │
│      ▼                                       │
│  Openbox (window manager)                   │
│      │                                       │
│      ▼                                       │
│  start-kiosk.sh (watchdog)                  │
│      │                                       │
│      ▼                                       │
│  Chromium (--kiosk mode)                    │
│      │                                       │
│      ▼                                       │
│  https://akior.home.arpa/console            │
└─────────────────────────────────────────────┘
```

## Files Installed

| Path | Description |
|------|-------------|
| `/etc/systemd/system/akior-kiosk.service` | Systemd service unit |
| `/home/akior-kiosk/start-kiosk.sh` | Browser launch script with watchdog |
| `/home/akior-kiosk/.xinitrc` | X initialization script |
| `/home/akior-kiosk/.config/openbox/autostart` | Openbox autostart config |
| `/etc/hosts` | Contains hostname mapping |

## Related Documentation

- [LAN HTTPS Trust](./lan-tls-trust.md) - Installing CA certificates
- [DNS Setup](./dns-setup.md) - Network hostname configuration
- [First Run Setup](../setup/first-run.md) - Initial AKIOR configuration
