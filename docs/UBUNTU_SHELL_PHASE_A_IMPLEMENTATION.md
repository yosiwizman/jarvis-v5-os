# Jarvis V6.2.0 - Ubuntu Shell Phase A Implementation Guide

**Version:** v6.2.0  
**Phase:** A - Secure Workstation Mode  
**Date:** December 7, 2025  
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [What Phase A Delivers](#what-phase-a-delivers)
3. [Prerequisites](#prerequisites)
4. [Architecture](#architecture)
5. [Installation & Setup](#installation--setup)
6. [Configuration](#configuration)
7. [Service Management](#service-management)
8. [Development vs Production](#development-vs-production)
9. [Troubleshooting](#troubleshooting)
10. [Security](#security)
11. [Future Phases](#future-phases)

---

## Overview

**Jarvis Ubuntu Shell Phase A** implements a secure workstation mode where Jarvis V6 runs as a full-screen kiosk experience after Ubuntu login. This phase establishes the foundation for running Jarvis as an "operating system shell" while maintaining Ubuntu as the underlying OS and authentication provider.

### Design Philosophy

- **Non-Destructive:** All changes are user-level, no system modifications
- **Reversible:** Can be easily disabled or removed
- **Windows-Compatible:** Does not break existing Windows/macOS development workflow
- **Production-Grade:** Uses systemd for robust service management

### What This Is NOT

Phase A is **not**:
- A replacement for Ubuntu login (still uses standard Ubuntu authentication)
- A custom display manager or GDM greeter
- A true "OS replacement" (Jarvis is a shell, not an OS)
- A system-level modification (all changes are user-level)

---

## What Phase A Delivers

### Core Features

1. **Jarvis Server as Systemd Service**
   - Auto-starts after Ubuntu login
   - Runs as background process (user-level, no root)
   - Restarts automatically on failure
   - Logs to systemd journal

2. **Full-Screen Kiosk Browser**
   - Launches Chromium/Chrome in kiosk/app mode
   - No browser chrome (tabs, URL bar, bookmarks)
   - Auto-starts after server is ready
   - Lands at Jarvis dashboard (`https://localhost:3000`)

3. **Infrastructure Templates**
   - Systemd service files for server and browser
   - Desktop autostart file (alternative method)
   - Setup helper script (non-destructive)
   - Comprehensive documentation

4. **Environment Detection**
   - Web app detects Ubuntu kiosk mode via env var
   - Logging for debugging purposes
   - No UI changes (reserved for future phases)

### User Experience

```
Ubuntu Login
    ↓
[systemd] Start jarvis-server.service
    ↓
[systemd] Start jarvis-kiosk.service
    ↓
Browser opens full-screen at https://localhost:3000
    ↓
User sees Jarvis dashboard
```

---

## Prerequisites

### Hardware Requirements

- **CPU:** x86_64 processor (Intel/AMD)
- **RAM:** 4 GB minimum, 8 GB recommended
- **Storage:** 10 GB available space
- **GPU:** Hardware with OpenGL support (for browser rendering)
- **Display:** 1920x1080 minimum resolution

### Software Requirements

- **OS:** Ubuntu 22.04 LTS or 24.04 LTS (other Debian-based distros may work)
- **Node.js:** v20.x or later
- **npm:** v10.x or later
- **Browser:** Chromium or Google Chrome (installed via apt)
- **systemd:** Should be present on all modern Ubuntu installations

### Optional

- **GPU Drivers:** NVIDIA/AMD proprietary drivers for better performance
- **Audio:** ALSA/PulseAudio for Jarvis voice features
- **Camera:** Webcam for camera/security features

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Ubuntu Login (GDM)                  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              User Systemd Services                      │
│  ┌──────────────────────┐  ┌──────────────────────┐    │
│  │ jarvis-server.service│  │ jarvis-kiosk.service │    │
│  │   (Fastify Backend)  │→ │ (Chromium Kiosk)     │    │
│  └──────────────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│          Jarvis V6 Dashboard (Next.js App)              │
│         https://localhost:3000 (Full-Screen)            │
└─────────────────────────────────────────────────────────┘
```

### Service Dependencies

```
jarvis-kiosk.service
  ├─ Requires: jarvis-server.service
  └─ After: graphical-session.target

jarvis-server.service
  └─ After: network-online.target
```

### File Structure

```
jarvis-v5-os/
├── infra/
│   └── ubuntu-shell/
│       ├── jarvis-server.service.example    ← Server systemd template
│       ├── jarvis-kiosk.service.example     ← Kiosk browser template
│       ├── jarvis-kiosk.desktop.example     ← Autostart alternative
│       ├── prepare-ubuntu-shell.sh          ← Setup helper
│       └── README.md                        ← Infra documentation
├── docs/
│   └── UBUNTU_SHELL_PHASE_A_IMPLEMENTATION.md  ← This file
├── apps/
│   ├── server/                              ← Backend (detects JARVIS_UBUNTU_MODE)
│   └── web/                                 ← Frontend (detects NEXT_PUBLIC_JARVIS_UBUNTU_MODE)
└── JARVIS_V5_UBUNTU_SHELL_PLAN.md          ← Overall Ubuntu shell plan
```

---

## Installation & Setup

### Step 0: Prepare Jarvis Repository

1. **Clone repository** (if not already done):
   ```bash
   cd ~
   git clone https://github.com/yosiwizman/jarvis-v5-os.git
   cd jarvis-v5-os
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Test that Jarvis starts:**
   ```bash
   npm start
   # Press Ctrl+C to stop after verifying it works
   ```

### Step 1: Run Setup Helper (Recommended)

The setup helper script provides guidance without making changes:

```bash
cd ~/jarvis-v5-os/infra/ubuntu-shell
bash prepare-ubuntu-shell.sh
```

This script will:
- Verify you're on Linux
- Check for required browsers (Chromium/Chrome)
- Verify Node.js/npm installation
- Print detailed setup instructions
- **NOT make any changes to your system**

Follow the printed instructions for manual setup.

### Step 2: Install Jarvis Server Service

1. **Create systemd user directory** (if not exists):
   ```bash
   mkdir -p ~/.config/systemd/user
   ```

2. **Copy service template:**
   ```bash
   cd ~/jarvis-v5-os
   cp infra/ubuntu-shell/jarvis-server.service.example \
      ~/.config/systemd/user/jarvis-server.service
   ```

3. **Edit the service file:**
   ```bash
   nano ~/.config/systemd/user/jarvis-server.service
   ```

   Replace placeholders:
   - Change `/home/<USERNAME>/jarvis-v5-os` to actual repo path (e.g., `/home/john/jarvis-v5-os`)
   - Verify `NODE_ENV=production`
   - Verify `JARVIS_UBUNTU_MODE=kiosk`

4. **Reload systemd and enable service:**
   ```bash
   systemctl --user daemon-reload
   systemctl --user enable jarvis-server.service
   systemctl --user start jarvis-server.service
   ```

5. **Verify service is running:**
   ```bash
   systemctl --user status jarvis-server.service
   ```

   Should show "active (running)" in green.

6. **Check logs:**
   ```bash
   journalctl --user -u jarvis-server.service -f
   ```

   Press Ctrl+C to stop tailing logs.

### Step 3: Install Jarvis Kiosk Browser Service

1. **Copy service template:**
   ```bash
   cp infra/ubuntu-shell/jarvis-kiosk.service.example \
      ~/.config/systemd/user/jarvis-kiosk.service
   ```

2. **Edit the service file** (if needed):
   ```bash
   nano ~/.config/systemd/user/jarvis-kiosk.service
   ```

   Optionally adjust:
   - Browser path (if using Chrome instead of Chromium)
   - URL (if accessing from different IP)
   - `XAUTHORITY` path (replace `<USERNAME>` with your actual username)

3. **Reload systemd and enable service:**
   ```bash
   systemctl --user daemon-reload
   systemctl --user enable jarvis-kiosk.service
   systemctl --user start jarvis-kiosk.service
   ```

4. **Verify kiosk launches:**
   
   A full-screen browser should appear showing the Jarvis dashboard.

5. **Check logs:**
   ```bash
   journalctl --user -u jarvis-kiosk.service -f
   ```

### Step 4: Test Auto-Start

1. **Log out** of Ubuntu (don't reboot, just log out)

2. **Log back in**

3. **Verify:**
   - Server starts automatically (check with `systemctl --user status jarvis-server.service`)
   - Browser launches full-screen automatically
   - Jarvis dashboard loads at `https://localhost:3000`

---

## Configuration

### Server Service Configuration

Edit `~/.config/systemd/user/jarvis-server.service`:

```ini
[Service]
WorkingDirectory=/home/YOUR_USERNAME/jarvis-v5-os
Environment="NODE_ENV=production"
Environment="JARVIS_UBUNTU_MODE=kiosk"
ExecStart=/usr/bin/npm run start:ci
```

**Key settings:**
- `WorkingDirectory`: Absolute path to Jarvis repo
- `NODE_ENV`: Use `production` for kiosk mode
- `JARVIS_UBUNTU_MODE`: Set to `kiosk` to enable Ubuntu shell features
- `ExecStart`: Use `npm run start:ci` for production mode

### Kiosk Browser Configuration

Edit `~/.config/systemd/user/jarvis-kiosk.service`:

```ini
[Service]
Environment="DISPLAY=:0"
Environment="XAUTHORITY=/home/YOUR_USERNAME/.Xauthority"
ExecStart=/usr/bin/chromium-browser \
  --kiosk \
  --app=https://localhost:3000 \
  --noerrdialogs \
  --disable-infobars
```

**Key settings:**
- `DISPLAY`: X11 display (usually `:0`)
- `XAUTHORITY`: Path to X authority file
- `--kiosk`: Full-screen mode
- `--app=URL`: Launch as standalone app (no browser chrome)

**Chromium Flags Reference:**

| Flag | Purpose |
|------|---------|
| `--kiosk` | Full-screen mode |
| `--app=URL` | Standalone app mode (no tabs/URL bar) |
| `--noerrdialogs` | Suppress error dialogs |
| `--disable-infobars` | Hide info bars |
| `--no-first-run` | Skip first-run wizard |
| `--disable-session-crashed-bubble` | No crash recovery popups |
| `--autoplay-policy=no-user-gesture-required` | Allow auto-play media |

### Environment Variables

**Server (backend):**
- `JARVIS_UBUNTU_MODE=kiosk` - Enables Ubuntu shell mode detection

**Web (frontend):**
- `NEXT_PUBLIC_JARVIS_UBUNTU_MODE=kiosk` - Enables kiosk mode detection in React app

Add to `.env.local` in `apps/web/`:
```bash
NEXT_PUBLIC_JARVIS_UBUNTU_MODE=kiosk
```

---

## Service Management

### Common Commands

**Check service status:**
```bash
systemctl --user status jarvis-server.service
systemctl --user status jarvis-kiosk.service
```

**Start/stop services:**
```bash
systemctl --user start jarvis-server.service
systemctl --user stop jarvis-kiosk.service
```

**Restart services:**
```bash
systemctl --user restart jarvis-server.service
systemctl --user restart jarvis-kiosk.service
```

**Enable/disable autostart:**
```bash
systemctl --user enable jarvis-server.service
systemctl --user disable jarvis-kiosk.service
```

**View logs (live tail):**
```bash
journalctl --user -u jarvis-server.service -f
journalctl --user -u jarvis-kiosk.service -f
```

**View recent logs:**
```bash
journalctl --user -u jarvis-server.service -n 50
journalctl --user -u jarvis-kiosk.service -n 100
```

**Reload service files after editing:**
```bash
systemctl --user daemon-reload
```

### Disabling Kiosk Mode

To temporarily disable kiosk mode:

```bash
systemctl --user stop jarvis-kiosk.service
systemctl --user disable jarvis-kiosk.service
```

To completely remove:
```bash
systemctl --user stop jarvis-kiosk.service jarvis-server.service
systemctl --user disable jarvis-kiosk.service jarvis-server.service
rm ~/.config/systemd/user/jarvis-kiosk.service
rm ~/.config/systemd/user/jarvis-server.service
systemctl --user daemon-reload
```

---

## Development vs Production

### Development Mode (Windows/macOS/Linux)

Standard development workflow **remains unchanged**:

```bash
cd ~/jarvis-v5-os
npm start
```

- Uses dev server with hot reload
- Accessible at `https://localhost:3000`
- Browser in windowed mode (not kiosk)
- Works on Windows, macOS, and Linux

**Key Point:** Ubuntu shell changes do NOT affect development mode.

### Production Mode (Ubuntu Kiosk)

Uses systemd services for production deployment:

```bash
# Build once
npm run build

# Services auto-start on login
systemctl --user status jarvis-server.service
systemctl --user status jarvis-kiosk.service
```

- Server runs as background service
- Browser launches in full-screen kiosk mode
- Auto-starts after Ubuntu login
- Robust restart policies

---

## Troubleshooting

### Browser Doesn't Start

**Symptoms:**
- Kiosk service shows "active" but browser doesn't appear
- Browser crashes immediately after starting

**Solutions:**

1. **Check DISPLAY variable:**
   ```bash
   echo $DISPLAY
   # Should output :0 or :1
   ```

2. **Verify X authority:**
   ```bash
   ls -la ~/.Xauthority
   # Should exist and be readable
   ```

3. **Test browser manually:**
   ```bash
   chromium-browser --app=https://localhost:3000
   # Should launch browser in app mode
   ```

4. **Check service logs:**
   ```bash
   journalctl --user -u jarvis-kiosk.service -n 50
   ```

5. **Verify server is running:**
   ```bash
   systemctl --user status jarvis-server.service
   curl -k https://localhost:3000
   ```

### Server Fails to Start

**Symptoms:**
- jarvis-server.service shows "failed" or "inactive (dead)"
- Error messages in logs

**Solutions:**

1. **Check Node.js version:**
   ```bash
   node --version  # Should be v20+
   npm --version
   ```

2. **Verify repo path:**
   ```bash
   cat ~/.config/systemd/user/jarvis-server.service | grep WorkingDirectory
   # Should match actual repo location
   ```

3. **Check dependencies:**
   ```bash
   cd ~/jarvis-v5-os
   npm install
   npm run build
   ```

4. **View detailed logs:**
   ```bash
   journalctl --user -u jarvis-server.service -n 100 --no-pager
   ```

5. **Test manually:**
   ```bash
   cd ~/jarvis-v5-os
   NODE_ENV=production JARVIS_UBUNTU_MODE=kiosk npm run start:ci
   ```

### Certificate/HTTPS Errors

**Symptoms:**
- Browser shows "Your connection is not private"
- curl fails with SSL errors

**Solutions:**

1. **Regenerate certificates:**
   ```bash
   cd ~/jarvis-v5-os
   rm -rf apps/web/certs
   npm start  # Will auto-generate new certs
   # Press Ctrl+C after certs are generated
   ```

2. **Test HTTPS manually:**
   ```bash
   curl -k https://localhost:3000
   # -k flag ignores certificate errors for testing
   ```

3. **Accept certificate in browser:**
   - Open Chromium manually
   - Navigate to `https://localhost:3000`
   - Click "Advanced" → "Proceed to localhost (unsafe)"
   - This adds exception for future kiosk launches

### Kiosk Exits or Crashes

**Symptoms:**
- Browser closes unexpectedly
- Black screen after login

**Solutions:**

1. **Check restart policy:**
   ```bash
   systemctl --user status jarvis-kiosk.service
   # Should show restart attempts
   ```

2. **Increase restart limits:**
   Edit `~/.config/systemd/user/jarvis-kiosk.service`:
   ```ini
   [Service]
   Restart=on-failure
   RestartSec=5s
   StartLimitBurst=10  # Increase from 3
   ```

3. **Disable GPU acceleration (if graphics issues):**
   Add to `ExecStart` in kiosk service:
   ```
   --disable-gpu
   --disable-software-rasterizer
   ```

---

## Security

### Phase A Security Model

**Authentication:**
- Standard Ubuntu login provides authentication
- No custom login mechanism
- User credentials managed by Ubuntu/PAM

**Authorization:**
- Services run as user (no root/sudo)
- File permissions follow standard Unix model
- No system-level modifications

**Network:**
- Server binds to localhost only by default
- HTTPS with self-signed certificate
- No remote access unless explicitly configured

**Isolation:**
- Browser runs in Chromium sandbox
- Limited access to system resources
- No sudo/root escalation paths

### Security Best Practices

1. **Use strong user password:**
   ```bash
   passwd  # Change your user password
   ```

2. **Enable UFW firewall:**
   ```bash
   sudo ufw enable
   sudo ufw default deny incoming
   sudo ufw allow from 127.0.0.1  # Allow localhost only
   ```

3. **Keep system updated:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

4. **Enable automatic security updates:**
   ```bash
   sudo apt install unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

5. **Limit SSH access** (if enabled):
   ```bash
   sudo ufw allow from TRUSTED_IP to any port 22
   ```

### Known Limitations

1. **Self-signed certificate:** Browser will show security warning initially
2. **No remote access control:** Phase A is localhost-only
3. **No user switching:** Kiosk runs as single user
4. **No session timeout:** User remains logged in until manual logout

---

## Future Phases

### Phase B (v6.3+)

**Planned Features:**
- Custom GDM greeter with Jarvis branding
- Ubuntu native notifications bridge
- Wake-on-motion/camera detection
- Enhanced kiosk security policies

**Timeline:** Q1 2026

### Phase C (v7.0+)

**Planned Features:**
- True OS replacement (Jarvis as login manager)
- System-level notification integration
- Advanced hardware control
- Multi-user support with separate Jarvis profiles

**Timeline:** Q2 2026

---

## Additional Resources

- **Infrastructure Files:** `infra/ubuntu-shell/`
- **Ubuntu Shell Plan:** `JARVIS_V5_UBUNTU_SHELL_PLAN.md`
- **Test Plan:** `JARVIS_V6_TEST_PLAN.md`
- **Release Notes:** `JARVIS_V6_RELEASE_NOTES_v6.2.0.md`
- **Repository Overview:** `JARVIS_V6_REPO_OVERVIEW.md`

---

## Support

For issues or questions:

1. **Check logs:** `journalctl --user -u jarvis-server.service -f`
2. **Review troubleshooting section** above
3. **Run setup helper:** `bash infra/ubuntu-shell/prepare-ubuntu-shell.sh`
4. **Consult full documentation** in `docs/` directory

---

**Phase A Status:** ✅ Production Ready  
**Tested On:** Ubuntu 22.04 LTS, Ubuntu 24.04 LTS  
**Version:** v6.2.0  
**Date:** December 7, 2025
