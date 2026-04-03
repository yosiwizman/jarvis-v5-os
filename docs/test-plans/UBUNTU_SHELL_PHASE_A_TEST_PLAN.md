# Ubuntu Shell Phase A - Test Plan

**Version:** v6.2.0  
**Phase:** A - Secure Workstation Mode  
**Date:** December 2025

---

## Overview

This document provides a practical test plan for verifying Ubuntu Shell Phase A functionality. It covers installation verification, kiosk mode testing, and notification system validation in the Ubuntu environment.

---

## Pre-Requirements

Before testing, ensure:

- **Hardware:**
  - Ubuntu 22.04 LTS or 24.04 LTS desktop installation
  - Non-root user account with sudo privileges
  - Display resolution 1920x1080 or higher
  - Working GPU with drivers installed

- **Software:**
  - Node.js 20+ installed (`node --version`)
  - npm 10+ installed (`npm --version`)
  - Chromium or Chrome browser (`which chromium-browser` or `which google-chrome`)
  - Git installed (`git --version`)

- **Repository:**
  - AKIOR repository cloned to `~/akior-v5-os` (or known location)
  - Dependencies installed (`npm install` completed)
  - Production build successful (`npm run build` completed)

---

## Test Suite

### 1. Setup Helper Script Verification

**Objective:** Verify the setup helper script runs without errors and provides clear instructions.

**Steps:**

1. Navigate to infra directory:
   ```bash
   cd ~/akior-v5-os/infra/ubuntu-shell
   ```

2. Run the setup helper:
   ```bash
   bash prepare-ubuntu-shell.sh
   ```

**Expected Results:**

- ✅ Script detects Linux OS
- ✅ Script detects available browser (Chromium/Chrome)
- ✅ Script verifies Node.js and npm are installed
- ✅ Script prints step-by-step installation instructions
- ✅ Script does NOT make any system changes
- ✅ No errors or warnings appear

**Pass Criteria:**
- All checks pass
- Clear instructions printed to terminal

---

### 2. Service File Installation

**Objective:** Verify service files can be copied and edited correctly.

**Steps:**

1. Create systemd user directory:
   ```bash
   mkdir -p ~/.config/systemd/user
   ```

2. Copy server service:
   ```bash
   cp ~/akior-v5-os/infra/ubuntu-shell/akior-server.service.example \
      ~/.config/systemd/user/akior-server.service
   ```

3. Copy kiosk service:
   ```bash
   cp ~/akior-v5-os/infra/ubuntu-shell/akior-kiosk.service.example \
      ~/.config/systemd/user/akior-kiosk.service
   ```

4. Edit server service to update paths:
   ```bash
   nano ~/.config/systemd/user/akior-server.service
   ```
   - Update `WorkingDirectory=` to actual repo path
   - Update `ExecStart=` npm path if needed
   - Update `User=` to your username

5. Edit kiosk service if using Chrome instead of Chromium:
   ```bash
   nano ~/.config/systemd/user/akior-kiosk.service
   ```
   - Change browser path if needed

**Expected Results:**

- ✅ Files copied successfully
- ✅ Files exist at `~/.config/systemd/user/akior-*.service`
- ✅ Service files are valid systemd format
- ✅ Paths updated to match local environment

**Pass Criteria:**
- Both service files exist with correct paths

---

### 3. AKIOR Server Service Test

**Objective:** Verify AKIOR server starts and runs as a systemd service.

**Steps:**

1. Reload systemd configuration:
   ```bash
   systemctl --user daemon-reload
   ```

2. Start server service:
   ```bash
   systemctl --user start akior-server.service
   ```

3. Check service status:
   ```bash
   systemctl --user status akior-server.service
   ```

4. View service logs:
   ```bash
   journalctl --user -u akior-server.service -n 50
   ```

5. Test server endpoint:
   ```bash
   curl http://localhost:1234/api/health
   ```

6. Stop service:
   ```bash
   systemctl --user stop akior-server.service
   ```

**Expected Results:**

- ✅ Service starts without errors
- ✅ Status shows `active (running)`
- ✅ Logs show "Fastify server listening on https://0.0.0.0:1234"
- ✅ Health check returns 200 OK
- ✅ Service stops cleanly

**Pass Criteria:**
- Server service runs and responds to API calls

---

### 4. Kiosk Browser Service Test

**Objective:** Verify kiosk browser launches in full-screen mode.

**Steps:**

1. Start server service (dependency):
   ```bash
   systemctl --user start akior-server.service
   ```

2. Start kiosk service:
   ```bash
   systemctl --user start akior-kiosk.service
   ```

3. Observe:
   - Browser window opens
   - Full-screen mode active (no tabs, URL bar, or browser chrome)
   - AKIOR dashboard loads at `https://localhost:3000`

4. Check service status:
   ```bash
   systemctl --user status akior-kiosk.service
   ```

5. Stop kiosk service:
   ```bash
   systemctl --user stop akior-kiosk.service
   ```

**Expected Results:**

- ✅ Browser opens in full-screen kiosk mode
- ✅ No browser UI visible (tabs, URL bar, bookmarks)
- ✅ AKIOR dashboard loads correctly
- ✅ Service status shows `active (running)`
- ✅ Closing browser stops the service

**Pass Criteria:**
- Full-screen browser displays AKIOR dashboard

---

### 5. Auto-Start on Login Test

**Objective:** Verify services auto-start after Ubuntu login.

**Steps:**

1. Enable services for auto-start:
   ```bash
   systemctl --user enable akior-server.service
   systemctl --user enable akior-kiosk.service
   ```

2. Verify enabled status:
   ```bash
   systemctl --user is-enabled akior-server.service
   systemctl --user is-enabled akior-kiosk.service
   ```

3. Log out of Ubuntu:
   ```bash
   gnome-session-quit --logout --no-prompt
   ```

4. Log back in with same user

5. Observe:
   - Server starts automatically in background
   - Kiosk browser opens full-screen automatically
   - AKIOR dashboard loads

6. Check running services:
   ```bash
   systemctl --user status akior-server.service
   systemctl --user status akior-kiosk.service
   ```

**Expected Results:**

- ✅ Both services enabled successfully
- ✅ Services start automatically after login
- ✅ Browser opens full-screen without manual intervention
- ✅ AKIOR dashboard accessible immediately

**Pass Criteria:**
- Auto-start works on login without manual commands

---

### 6. HUD Notification Widget Test (Kiosk Mode)

**Objective:** Verify HUD notification integration works correctly in kiosk mode.

**Steps:**

1. With kiosk browser running, locate HUD widget in top-right corner

2. Observe notification bell icon in HUD

3. Schedule a test notification from AKIOR interface or API:
   ```bash
   curl -X POST http://localhost:1234/api/notifications/schedule \
     -H "Content-Type: application/json" \
     -d '{
       "type": "system_update",
       "payload": {"message": "Test notification in kiosk mode"},
       "triggerAt": "'$(date -u -d '+5 seconds' '+%Y-%m-%dT%H:%M:%S.000Z')'"
     }'
   ```

4. Wait 5 seconds and observe:
   - Toast notification appears in top-right
   - Red dot badge appears on HUD bell icon
   - Click bell icon to open dropdown

5. Verify notification dropdown:
   - Dropdown appears below HUD
   - Notification visible in list
   - Blue dot indicates unread
   - Click notification to mark as read

6. Test actions:
   - Click "Mark all as read"
   - Click "Clear all"

**Expected Results:**

- ✅ HUD widget visible and functional
- ✅ Toast notification appears
- ✅ Red badge appears on bell icon
- ✅ Dropdown opens when clicking bell
- ✅ Notification list displays correctly
- ✅ Mark as read works
- ✅ Clear all works
- ✅ No visual collision between toast and dropdown

**Pass Criteria:**
- All notification features work in kiosk mode

---

### 7. Service Restart on Failure Test

**Objective:** Verify services restart automatically on crash.

**Steps:**

1. Start services:
   ```bash
   systemctl --user start akior-server.service
   systemctl --user start akior-kiosk.service
   ```

2. Find server process ID:
   ```bash
   ps aux | grep "node.*apps/server"
   ```

3. Kill server process:
   ```bash
   kill -9 <PID>
   ```

4. Wait 2 seconds and check status:
   ```bash
   systemctl --user status akior-server.service
   ```

5. Verify server restarted:
   ```bash
   journalctl --user -u akior-server.service -n 20
   ```

**Expected Results:**

- ✅ Service restarts automatically after kill
- ✅ Logs show restart attempt
- ✅ Server comes back online
- ✅ Kiosk browser reconnects

**Pass Criteria:**
- Service recovers from crashes automatically

---

### 8. Service Cleanup Test

**Objective:** Verify services can be cleanly disabled and removed.

**Steps:**

1. Disable services:
   ```bash
   systemctl --user disable akior-server.service
   systemctl --user disable akior-kiosk.service
   ```

2. Stop services:
   ```bash
   systemctl --user stop akior-server.service
   systemctl --user stop akior-kiosk.service
   ```

3. Remove service files:
   ```bash
   rm ~/.config/systemd/user/akior-server.service
   rm ~/.config/systemd/user/akior-kiosk.service
   ```

4. Reload systemd:
   ```bash
   systemctl --user daemon-reload
   ```

5. Log out and log back in

6. Verify services don't auto-start

**Expected Results:**

- ✅ Services disabled successfully
- ✅ Services stopped
- ✅ Files removed
- ✅ No auto-start after login
- ✅ System back to normal state

**Pass Criteria:**
- Complete cleanup with no residual effects

---

## Troubleshooting Common Issues

### Issue: Server service fails to start

**Check:**
```bash
journalctl --user -u akior-server.service -n 50
```

**Common Causes:**
- Incorrect `WorkingDirectory` path in service file
- Node.js not found (update `ExecStart` path)
- Port 1234 already in use
- Missing dependencies (`npm install` not run)

### Issue: Kiosk browser doesn't open

**Check:**
```bash
journalctl --user -u akior-kiosk.service -n 50
```

**Common Causes:**
- Server service not running (check dependency)
- Browser binary not found (update path in service file)
- Display not available (check `DISPLAY=:0`)
- X11 authentication issues

### Issue: Red badge doesn't appear

**Check:**
- Notification actually triggered (check server logs)
- SSE stream connected (check browser console)
- HUD widget visible and not collapsed

---

## Regression Tests (Post-v6.2.0 Verification)

After completing v6.2.0 upgrade:

1. **Verify Windows dev mode still works:**
   ```bash
   npm start
   # (on Windows machine - should work identically to before)
   ```

2. **Verify notification endpoints:**
   ```bash
   # Schedule endpoint
   curl -X POST http://localhost:1234/api/notifications/schedule ...
   
   # History endpoint
   curl http://localhost:1234/api/notifications/history
   
   # SSE stream
   curl http://localhost:1234/api/notifications/stream
   ```

3. **Verify removed components don't break build:**
   ```bash
   npm run typecheck
   npm run build
   ```

---

## Sign-Off Checklist

After completing all tests, verify:

- [ ] Setup helper script runs successfully
- [ ] Service files copy and edit correctly
- [ ] AKIOR server service starts and runs
- [ ] Kiosk browser service launches full-screen
- [ ] Services auto-start on login
- [ ] HUD notification widget works in kiosk mode
- [ ] Services restart on failure
- [ ] Services can be cleanly disabled/removed
- [ ] Windows dev mode still works (if applicable)
- [ ] No regressions in notification system

---

**Test Plan Version:** 1.0  
**Last Updated:** December 7, 2025  
**Status:** Ready for Testing
