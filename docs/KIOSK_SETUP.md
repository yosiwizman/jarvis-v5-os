# AKIOR Kiosk Setup Guide

This document describes the kiosk system configuration for AKIOR displays.

## Overview

The AKIOR kiosk runs Chromium in full-screen kiosk mode on a dedicated virtual terminal (VT7). This ensures:

- **Deterministic display**: Always on VT7 (Ctrl+Alt+F7)
- **Auto-recovery**: Restarts automatically on crash and clears stale X locks before each start
- **No navigation escape**: Chromium is locked to the menu URL
- **No screen blanking**: Display stays on indefinitely

## Virtual Terminal Policy

| VT | Purpose |
|-----|---------|
| VT1-6 | System consoles (login, logs). Use VT3 (Ctrl+Alt+F3) for admin console. |
| **VT7** | AKIOR Kiosk (Chromium) |

**To access the kiosk display**: Press `Ctrl+Alt+F7`

**To access system console**: Press `Ctrl+Alt+F3` (requires login)

## Installation

### Prerequisites

```bash
# Install required packages
sudo apt update
sudo apt install -y xorg openbox chromium-browser unclutter
```

### Deploy Kiosk User

```bash
# Create kiosk user (if not exists)
sudo useradd -m -s /bin/bash akior-kiosk

# Deploy xinitrc
sudo mkdir -p /home/akior-kiosk
sudo cp deploy/kiosk/xinitrc /home/akior-kiosk/.xinitrc
sudo chown akior-kiosk:akior-kiosk /home/akior-kiosk/.xinitrc
sudo chmod 755 /home/akior-kiosk/.xinitrc
```

### Deploy Systemd Service

```bash
# Copy service file
sudo cp deploy/systemd/akior-kiosk.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable and start
sudo systemctl enable akior-kiosk.service
sudo systemctl start akior-kiosk.service
```

## Configuration

### Service File: `/etc/systemd/system/akior-kiosk.service`

Key settings (deterministic VT7 + self-heal):

- `ExecStart=/usr/bin/startx /home/akior-kiosk/.xinitrc -- :0 vt7 -nolisten tcp -nocursor`
- `ExecStartPre=+/bin/sh -lc ...` does best-effort cleanup as root (kills stray `Xorg`/`startx`/`xinit` on `:0`, removes `/tmp/.X0-lock` + `/tmp/.X11-unix/X0`, logs what it did)
- `ExecStartPost=+/bin/sh -lc '/usr/bin/chvt 7 || true'` forces VT7 after start (root, non-fatal)
- `Restart=on-failure`, `RestartSec=2`, `TimeoutStartSec=30`, `TimeoutStopSec=15`
- `StartLimitIntervalSec=60` + `StartLimitBurst=10` in `[Unit]` to prevent restart storms when Xorg cannot start
- `WantedBy=multi-user.target` for headless reliability

### xinitrc: `/home/akior-kiosk/.xinitrc`

Key features:

- Disables screen blanking (`xset s off`, `xset -dpms`, `xset s noblank`)
- Starts `openbox-session`
- Runs Chromium in kiosk/incognito with crash bubbles suppressed
- Chromium is supervised by `/home/akior-kiosk/kiosk-session.sh` and restarts on crash (logs to `/home/akior-kiosk/.local/share/jarvis-kiosk/kiosk.log`)

### Environment Variables

Set in the service file:

```ini
Environment=DISPLAY=:0
Environment=KIOSK_URL=https://akior.local/menu
```

## Recovery Procedures

### Kiosk Not Displaying

1. Switch to VT7: `Ctrl+Alt+F7`
2. If black screen, check service status:
   ```bash
   sudo systemctl status akior-kiosk.service --no-pager
   ```
3. Restart service:
   ```bash
   sudo systemctl restart akior-kiosk.service
   ```

### Kiosk Stuck / Frozen

1. Restart the kiosk service:
   ```bash
   sudo systemctl restart akior-kiosk.service
   ```
2. Wait 2-3 seconds, then switch to VT7

### Screen Showing Console/Logs

The display is likely on VT3 (console). Press `Ctrl+Alt+F7` to switch to the kiosk.

### Chromium Crashed

If Chromium crashes/exits, systemd restarts the kiosk service (Xorg + session). If crashes persist:

1. Check logs: `journalctl -u akior-kiosk.service -f`
2. Look for memory issues or GPU errors
3. Consider rebooting if persistent

### Full System Recovery

```bash
# Stop kiosk
sudo systemctl stop akior-kiosk.service

# Clear Chromium state (if needed)
sudo rm -rf /home/akior-kiosk/.chromium-kiosk

# Restart
sudo systemctl start akior-kiosk.service
```

## Troubleshooting

### Common systemd pitfalls

- `StartLimitIntervalSec=` / `StartLimitBurst=` belong in the `[Unit]` section (not `[Service]`). If they are placed under `[Service]`, systemd will ignore them.
- `chvt` typically requires root privileges. The kiosk unit runs `chvt` as root and makes it non-fatal to avoid killing `startx` when VT switching is restricted.
- If you are deploying from Windows/PowerShell, prefer copying and running a remote script (scp + ssh) rather than embedding large quoted bash one-liners (quoting can break and stall automation).

### Check Service Status

```bash
sudo systemctl status akior-kiosk.service --no-pager
```

### View Logs

```bash
# Recent logs
journalctl -u akior-kiosk.service --since "10 minutes ago" --no-pager

# Follow logs in real-time
journalctl -u akior-kiosk.service -f
```

### Run bounded diagnostics (recommended)

```bash
# From the repo root on the server
sudo bash ops/verify/kiosk-diagnostics.sh
```

For GPU/nouveau failures and restart-storm recovery, see `docs/ops/KIOSK_TROUBLESHOOTING.md`.

### Verify kiosk bring-up (deploy gate)

```bash
# From the repo root on the server
sudo bash ops/verify/kiosk-ui-verify.sh
```

For details on what it checks (and how to override the URL), see `docs/ops/KIOSK_VERIFY.md`.

### Verify URL Configuration

```bash
# Check what URL is configured
grep KIOSK_URL /etc/systemd/system/akior-kiosk.service
```

### Test URL Manually

```bash
# From the server
curl -ks https://akior.local/menu
curl -ks https://akior.local/api/health/build
```

## Security Notes

- Chromium runs with `--ignore-certificate-errors` for local HTTPS
- The kiosk user has no sudo access
- VT7 is dedicated to the kiosk; VT1-6 require login
- Chromium's address bar and navigation are disabled in kiosk mode

## Updating the Kiosk URL

1. Edit the service file:
   ```bash
   sudo nano /etc/systemd/system/akior-kiosk.service
   ```
2. Change the `KIOSK_URL` environment variable
3. Reload and restart:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart akior-kiosk.service
   ```
