# AKIOR V6.2.0 – Ubuntu Shell Phase A + HUD Notifications

**Release Date:** 2025-12-07

---

## Overview

AKIOR V6.2.0 introduces two major enhancements: **Ubuntu Shell Phase A** (secure workstation mode) and **HUD-integrated notifications**. This release provides the foundation for running AKIOR as a kiosk-style desktop environment on Ubuntu while improving the notification user experience across all platforms.

---

## What's New

### 🖥️ Ubuntu Shell Phase A – Secure Workstation Mode

AKIOR can now run as a full-screen kiosk application on Ubuntu, auto-launching after user login. This phase establishes the infrastructure for AKIOR to function as an OS shell while maintaining Ubuntu as the underlying operating system and login provider.

**Key Features:**

- **User-Level Systemd Services:**
  - `akior-server.service` – Background service for the AKIOR Fastify backend
  - `akior-kiosk.service` – Auto-launch Chromium/Chrome in full-screen kiosk mode
  - `akior-kiosk.desktop` – Alternative desktop autostart file for simpler setups

- **Non-Destructive Setup:**
  - All configuration files provided as `.example` templates in `infra/ubuntu-shell/`
  - `prepare-ubuntu-shell.sh` helper script checks system requirements and prints guided setup instructions
  - No automatic system modifications – user retains full control

- **Kiosk Mode Detection:**
  - Environment variable: `NEXT_PUBLIC_AKIOR_UBUNTU_MODE=kiosk`
  - Server-side detection via `AKIOR_UBUNTU_MODE=kiosk`
  - Logging for debugging kiosk mode status

**Infrastructure Files:**

- `infra/ubuntu-shell/akior-server.service.example` (71 lines)
- `infra/ubuntu-shell/akior-kiosk.service.example` (113 lines)
- `infra/ubuntu-shell/akior-kiosk.desktop.example` (56 lines)
- `infra/ubuntu-shell/prepare-ubuntu-shell.sh` (231 lines)
- `infra/ubuntu-shell/README.md` (343 lines)

**Documentation:**

- `docs/UBUNTU_SHELL_PHASE_A_IMPLEMENTATION.md` (727 lines)
  - Complete installation guide
  - Architecture diagrams
  - Configuration examples
  - Troubleshooting section
  - Security best practices
  - Future phases roadmap (Phase B & C)

**Design Principles:**

- User-level only (no root/sudo required)
- Reversible (services can be disabled without traces)
- Windows/macOS development workflows completely unaffected
- Production-grade (systemd management, restart policies, logging)

---

### 🔔 HUD-Integrated Notifications

Notifications have been fully integrated into the top-right HUD system widget, replacing the separate floating bell icon and full-height drawer. This creates a unified, futuristic interface consistent with AKIOR's visual design.

**Key Features:**

- **HUD Widget Integration:**
  - Bell icon with red dot badge for unread notifications
  - Compact dropdown attached directly to the HUD
  - Same glass/neon/blur aesthetic as the HUD system status widget

- **New HudNotificationDropdown Component:**
  - 360px width, max 400px height with scrolling
  - Shows notification icon, title, message preview, and timestamp
  - Unread notifications highlighted with glowing blue dot
  - Click to mark individual notifications as read
  - "Mark all as read" and "Clear all" actions at bottom

- **Visual Consistency:**
  - Reuses HUD CSS variables: `--akior-panel-surface`, `--akior-accent`, `--akior-glow`
  - Matches HUD typography, spacing, and border styling
  - Red badge with glow effect when notifications are unread

- **Toast Notifications:**
  - Repositioned from `top-6` to `top-24` (18px lower)
  - Prevents visual collision with HUD dropdown
  - Still appear as live notifications with auto-dismiss

**User Experience:**

- Click bell icon in HUD to open/close dropdown
- Click outside or press ESC to close dropdown
- Notification history loads automatically on first open
- All notification preferences and filtering still respected

---

## Internal Changes & Cleanup

### Removed Components

- `apps/web/components/NotificationBell.tsx` (unused)
- `apps/web/components/NotificationDrawer.tsx` (unused)

These components have been replaced by the HUD-integrated notification system.

### Version Bumps

- `@akior/server`: 6.1.0 → 6.2.0
- `@akior/web`: 6.1.0 → 6.2.0
- `@shared/core`: 6.1.0 → 6.2.0

---

## Quality Assurance

All quality gates passed:

- ✅ **TypeScript:** 0 errors across all workspaces
- ✅ **Build:** Production build successful (87.1 kB shared bundle, unchanged)
- ✅ **Smoke Tests:** 15/15 checks passed
  - Notification endpoints (schedule, stream, history) ✅
  - All pages render correctly ✅
  - System metrics API operational ✅

---

## Breaking Changes

**None.** This release is fully backward compatible:

- All notification logic unchanged (context, scheduler, SSE, endpoints)
- Windows/macOS development workflows unaffected
- Toast notifications still work identically
- No database or API changes

---

## Upgrade Notes

### For All Users

1. **Update Dependencies:**
   ```bash
   npm install
   ```

2. **Rebuild:**
   ```bash
   npm run build
   ```

3. **Restart Server:**
   ```bash
   npm start
   ```

### For Ubuntu Kiosk Deployment

If you want to run AKIOR as a kiosk on Ubuntu:

1. **Read the Implementation Guide:**
   - `docs/UBUNTU_SHELL_PHASE_A_IMPLEMENTATION.md`

2. **Run the Setup Helper:**
   ```bash
   cd infra/ubuntu-shell
   bash prepare-ubuntu-shell.sh
   ```

3. **Follow Printed Instructions:**
   - Copy service files to `~/.config/systemd/user/`
   - Edit paths and usernames in service files
   - Enable and start services
   - Test auto-launch on login

---

## Future Roadmap

### Phase B (v6.3+)

- Custom GDM greeter with AKIOR branding
- Ubuntu native notification integration
- Wake-on-motion hardware integration
- Enhanced kiosk UI optimizations

### Phase C (v7.0+)

- True OS replacement (AKIOR as login manager)
- System-level notification bridge
- Multi-user support
- Advanced hardware control

---

## Known Limitations

### Ubuntu Shell Phase A

1. **Standard Ubuntu Login:** Uses default GDM greeter (no custom branding yet)
2. **Manual Setup:** Requires following documented installation steps
3. **Single User:** One AKIOR instance per user account
4. **Browser Notifications Only:** Native Ubuntu notifications not yet integrated

### HUD Notifications

1. **Read State Client-Side:** Read status not persisted server-side (survives session only)
2. **No Keyboard Navigation:** Arrow keys not yet supported in dropdown

---

## Contributors

- Development: Senior Full-Stack + DevOps Engineer
- Project Owner: Mr W

---

## Links

- **Ubuntu Shell Implementation Guide:** `docs/UBUNTU_SHELL_PHASE_A_IMPLEMENTATION.md`
- **Infrastructure Files:** `infra/ubuntu-shell/`
- **Test Plan:** `docs/test-plans/UBUNTU_SHELL_PHASE_A_TEST_PLAN.md` (to be created)

---

**Version:** 6.2.0  
**Previous Version:** 6.1.0  
**Release Type:** Minor (new features, no breaking changes)  
**Git Tag:** `v6.2.0`
