# Jarvis V6 Ubuntu Shell - Phase A Infrastructure

This directory contains systemd service templates, desktop files, and setup scripts for running Jarvis as an Ubuntu shell/kiosk.

## Contents

| File | Purpose |
|------|---------|
| `jarvis-server.service.example` | Systemd user service template for Jarvis backend server |
| `jarvis-kiosk.service.example` | Systemd user service template for full-screen kiosk browser |
| `jarvis-kiosk.desktop.example` | Desktop autostart file (alternative to systemd) |
| `prepare-ubuntu-shell.sh` | Non-destructive setup helper script |
| `README.md` | This file |

## Quick Start

1. **Run the setup helper** (on Ubuntu):
   ```bash
   bash prepare-ubuntu-shell.sh
   ```

2. **Follow printed instructions** to:
   - Copy service files to `~/.config/systemd/user/`
   - Edit placeholders (paths, usernames)
   - Enable and start services

3. **Read full documentation:**
   - [Phase A Implementation Guide](../../docs/UBUNTU_SHELL_PHASE_A_IMPLEMENTATION.md)
   - [Ubuntu Shell Plan](../../JARVIS_V5_UBUNTU_SHELL_PLAN.md)

## What is Phase A?

Phase A delivers a **secure workstation mode** where:
- Ubuntu remains the OS and login provider
- After login, Jarvis server starts automatically (systemd)
- A full-screen browser launches in kiosk mode
- User lands in Jarvis dashboard at `https://localhost:3000`

**NOT included in Phase A:**
- Custom GDM greeter
- True login replacement
- Ubuntu native notifications bridge

## Prerequisites

- Ubuntu 22.04+ or 24.04+
- Node.js 20+
- Chromium or Google Chrome browser
- Jarvis repository cloned locally
- GPU drivers installed (for hardware acceleration)

## Files Overview

### jarvis-server.service.example

Systemd user service that runs the Jarvis backend server as a persistent background process.

**Key features:**
- Runs as user service (no root required)
- Auto-starts after login
- Restarts on failure (up to 5 times)
- Logs to systemd journal
- Environment: `JARVIS_UBUNTU_MODE=kiosk`

**Installation:**
```bash
mkdir -p ~/.config/systemd/user
cp jarvis-server.service.example ~/.config/systemd/user/jarvis-server.service
nano ~/.config/systemd/user/jarvis-server.service  # Edit paths
systemctl --user daemon-reload
systemctl --user enable --now jarvis-server.service
```

### jarvis-kiosk.service.example

Systemd user service that launches a full-screen browser in kiosk/app mode.

**Key features:**
- Depends on `jarvis-server.service`
- Chromium/Chrome in full-screen kiosk mode
- No browser chrome (tabs, URL bar, etc.)
- Auto-restarts on failure
- Configurable browser flags

**Installation:**
```bash
cp jarvis-kiosk.service.example ~/.config/systemd/user/jarvis-kiosk.service
nano ~/.config/systemd/user/jarvis-kiosk.service  # Edit if needed
systemctl --user daemon-reload
systemctl --user enable --now jarvis-kiosk.service
```

### jarvis-kiosk.desktop.example

Alternative to systemd services using traditional .desktop autostart.

**Pros:**
- Simpler to set up
- No systemd knowledge required

**Cons:**
- No automatic restart on failure
- No dependency management
- Less robust for production

**Installation:**
```bash
mkdir -p ~/.config/autostart
cp jarvis-kiosk.desktop.example ~/.config/autostart/jarvis-kiosk.desktop
chmod +x ~/.config/autostart/jarvis-kiosk.desktop
# Log out and back in to test
```

### prepare-ubuntu-shell.sh

Non-destructive helper script that:
- Checks OS is Linux
- Detects available browsers
- Verifies Node.js/npm installation
- Prints step-by-step setup instructions
- **Does NOT make changes automatically**

**Usage:**
```bash
bash prepare-ubuntu-shell.sh
```

## Systemd Service Management

### Common Commands

```bash
# Check status
systemctl --user status jarvis-server.service
systemctl --user status jarvis-kiosk.service

# View logs
journalctl --user -u jarvis-server.service -f
journalctl --user -u jarvis-kiosk.service -f

# Start/stop services
systemctl --user start jarvis-server.service
systemctl --user stop jarvis-kiosk.service

# Restart services
systemctl --user restart jarvis-server.service
systemctl --user restart jarvis-kiosk.service

# Enable/disable autostart
systemctl --user enable jarvis-server.service
systemctl --user disable jarvis-kiosk.service

# Reload service files after editing
systemctl --user daemon-reload
```

### Service Dependencies

```
jarvis-kiosk.service
  ↓ (Requires)
jarvis-server.service
  ↓ (After)
network-online.target
```

The kiosk browser will not start until the server is running.

## Browser Configuration

### Chromium Flags Explained

| Flag | Purpose |
|------|---------|
| `--kiosk` | Full-screen mode (like F11) |
| `--app=URL` | Launch as standalone app (no tabs/URL bar) |
| `--noerrdialogs` | Suppress error dialogs |
| `--disable-infobars` | Hide info bars ("Chrome is being controlled...") |
| `--no-first-run` | Skip first-run setup wizard |
| `--disable-session-crashed-bubble` | No crash recovery popups |
| `--autoplay-policy=no-user-gesture-required` | Allow auto-play media |

### Switching Browsers

To use Google Chrome instead of Chromium:

1. Edit `jarvis-kiosk.service`:
   ```bash
   nano ~/.config/systemd/user/jarvis-kiosk.service
   ```

2. Replace `ExecStart` line:
   ```ini
   ExecStart=/usr/bin/google-chrome \
     --kiosk \
     --app=https://localhost:3000 \
     --noerrdialogs \
     --disable-infobars \
     --no-first-run
   ```

3. Reload and restart:
   ```bash
   systemctl --user daemon-reload
   systemctl --user restart jarvis-kiosk.service
   ```

## Troubleshooting

### Browser Doesn't Start

1. **Check DISPLAY variable:**
   ```bash
   echo $DISPLAY  # Should be :0 or :1
   ```

2. **Test browser manually:**
   ```bash
   chromium-browser --app=https://localhost:3000
   ```

3. **Check service logs:**
   ```bash
   journalctl --user -u jarvis-kiosk.service -n 50
   ```

4. **Verify X authority:**
   ```bash
   ls -la ~/.Xauthority
   ```

### Server Fails to Start

1. **Check Node.js:**
   ```bash
   node --version  # Should be v20+
   npm --version
   ```

2. **Check repo path:**
   ```bash
   cat ~/.config/systemd/user/jarvis-server.service | grep WorkingDirectory
   ```

3. **View server logs:**
   ```bash
   journalctl --user -u jarvis-server.service -n 100
   ```

4. **Test manually:**
   ```bash
   cd ~/jarvis-v5-os
   npm run build
   npm run start:ci
   ```

### Certificate/HTTPS Issues

1. **Regenerate certificates:**
   ```bash
   cd ~/jarvis-v5-os
   npm start  # Will regenerate certs on first run
   ```

2. **Test HTTPS:**
   ```bash
   curl -k https://localhost:3000
   ```

3. **Browser certificate error:**
   - Add certificate exception in browser settings
   - Or use HTTP instead (change URL in service file)

## Development vs Production

### Development Mode (Windows/macOS/Linux)

Standard development workflow:
```bash
npm start  # Starts server + Next.js dev + TLS proxy
```

This mode works on all platforms and is NOT affected by Ubuntu shell changes.

### Production Mode (Ubuntu Kiosk)

Uses systemd services:
```bash
# Build once
npm run build

# Services auto-start on login
systemctl --user status jarvis-server.service
systemctl --user status jarvis-kiosk.service
```

## Security Considerations

### Phase A Security Model

- **Standard Ubuntu login** provides authentication
- **User-level services** run with user permissions (no root)
- **HTTPS with self-signed cert** for local encryption
- **No remote access** by default (localhost only)

### Hardening Recommendations (Future)

- Use systemd-resolved for DNS security
- Configure UFW firewall (allow only local)
- Enable AppArmor profiles
- Set up automatic security updates
- Use strong user passwords

## Next Steps (Future Phases)

### Phase B (v6.3+)
- Custom GDM greeter with Jarvis branding
- Ubuntu native notifications bridge
- Wake-on-motion integration

### Phase C (v7.0+)
- True OS replacement (Jarvis as login manager)
- System-level notification integration
- Advanced hardware integration

## Additional Resources

- **Full documentation:** [UBUNTU_SHELL_PHASE_A_IMPLEMENTATION.md](../../docs/UBUNTU_SHELL_PHASE_A_IMPLEMENTATION.md)
- **Ubuntu Shell Plan:** [JARVIS_V5_UBUNTU_SHELL_PLAN.md](../../JARVIS_V5_UBUNTU_SHELL_PLAN.md)
- **Test Plan:** [JARVIS_V6_TEST_PLAN.md](../../JARVIS_V6_TEST_PLAN.md)
- **Repository Overview:** [JARVIS_V6_REPO_OVERVIEW.md](../../JARVIS_V6_REPO_OVERVIEW.md)

## Support

For issues or questions:
1. Check service logs: `journalctl --user -u jarvis-server.service -f`
2. Review troubleshooting section above
3. Consult full documentation
4. Test with `prepare-ubuntu-shell.sh` script

---

**Remember:** Phase A is non-destructive and requires manual setup steps. All services run at user level (no root/sudo required).
