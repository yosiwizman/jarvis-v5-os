# AKIOR V5 OS – Ubuntu Shell Integration Plan

This document defines how AKIOR V5 will run as a branded, full-screen "shell" experience on Ubuntu Linux while maintaining proper OS-level security and user experience.

---

## 1. Purpose & Scope

### What this document covers

This plan describes how **AKIOR V5 OS** will be deployed on Ubuntu as a full-screen, kiosk-style shell that replaces the traditional desktop environment from a user's perspective, while still leveraging Ubuntu's native security features.

**Key principles:**

- **Ubuntu remains the underlying OS**: AKIOR is a branded experience layer, not a replacement for the operating system.
- **Leverage Ubuntu's security**: We use Ubuntu's login, lock screen, and account management as the primary security boundary.
- **Full-screen branded experience**: Users see only AKIOR UI, not the Ubuntu desktop, panels, or traditional window manager.
- **Phased approach**: We implement this in clear stages, starting with simple kiosk-mode startup and progressing to deeper integration over time.

### What this is NOT

- This is **not** a custom Linux distribution or a forked OS.
- This is **not** a replacement for Ubuntu's PAM, display manager, or security systems.
- This is **not** trying to hide Ubuntu's existence from system administrators or advanced users.

Instead, AKIOR V5 on Ubuntu is a **curated shell experience** designed for AI workstations, factory rigs, and dedicated AKIOR devices, where the full power of Ubuntu is present but the UX is streamlined and branded.

---

## 2. Operating Modes (CTO Decision)

AKIOR V5 will support **two deployment modes** to accommodate different use cases. **Secure Workstation Mode** is the **recommended default** for most users.

### 2.1 Secure Workstation Mode (Recommended)

**Description:**

- Ubuntu login and lock screen remain **fully enabled**.
- User must authenticate with their Ubuntu password on boot and after lock.
- After login, AKIOR auto-launches in full-screen (kiosk mode).
- Traditional Ubuntu desktop is hidden; users interact only with AKIOR UI.
- Optional: AKIOR may implement its own PIN-locked overlay for convenience (future feature).

**Security model:**

- **Primary security**: Ubuntu account password + disk encryption (LUKS).
- **Secondary security** (future): AKIOR PIN lock overlay for quick locking without triggering full OS lock.

**Recommended for:**

- Personal workstations with sensitive data.
- AI factory rigs with API keys and credentials.
- Multi-user systems where each user has their own Ubuntu account.
- Any scenario where real OS-level security is required.

**User flow example:**

1. Boot → GDM login screen (themed with AKIOR branding).
2. User enters Ubuntu password → session starts.
3. AKIOR launches full-screen automatically.
4. User sees only AKIOR UI (no desktop, no panels).
5. Lock (Super+L) → Ubuntu lock screen → unlock with password → AKIOR resumes.

---

### 2.2 Appliance Mode (Optional)

**Description:**

- Ubuntu **auto-login** enabled for a dedicated service account (e.g., `akior-kiosk`).
- AKIOR launches full-screen on boot without user interaction.
- No visible Ubuntu desktop or login screen.
- Security relies on **physical access controls**, **network isolation**, and **AKIOR's internal PIN lock** (when implemented).

**Security model:**

- **Primary security**: Physical access + network controls.
- **Secondary security** (future): AKIOR PIN lock overlay.
- **No OS-level authentication** on boot.

**Recommended for:**

- Dedicated kiosk devices (e.g., print stations, info terminals).
- Lab tools or demo machines in controlled environments.
- Single-purpose appliances where the device itself is physically secured.

**NOT recommended for:**

- Personal workstations with user data.
- Systems with API keys, credentials, or sensitive information.
- Multi-user environments.

**User flow example:**

1. Boot → auto-login to `akior-kiosk` account.
2. AKIOR launches full-screen immediately.
3. User sees only AKIOR UI.
4. Lock (if enabled) → AKIOR PIN overlay (future feature).

---

## 3. UX Flows

This section describes the user experience for each major interaction flow.

### 3.1 Cold Boot → Ready State (Secure Workstation Mode)

**Steps:**

1. **Power on** → BIOS/UEFI boot sequence.
2. **Ubuntu boots** → systemd initialization, display manager (GDM) starts.
3. **GDM login screen appears**:
   - Background: AKIOR-themed wallpaper (dark, branded).
   - Logo: AKIOR logo visible.
   - User enters Ubuntu password.
4. **Session starts**:
   - Ubuntu initializes user session.
   - Auto-start script launches AKIOR in full-screen mode (browser or Electron).
   - Traditional desktop/panels are hidden or disabled.
5. **AKIOR UI loads**:
   - User sees AKIOR dashboard at `https://localhost:3000`.
   - No visible browser chrome, URL bar, or tabs.
   - Full-screen, branded experience.

**Expected time:** ~10-30 seconds from power-on to AKIOR ready (depending on hardware and SSD speed).

---

### 3.2 Lock & Unlock

**User-initiated lock (Super+L):**

1. User presses **Super+L** (or clicks a lock button if added to AKIOR UI).
2. Ubuntu lock screen appears immediately.
3. Browser/Electron app remains running in background.
4. Lock screen shows:
   - AKIOR-themed background.
   - Password prompt.
5. User enters Ubuntu password → session unlocks.
6. AKIOR UI reappears, exactly as it was before lock.

**Auto-lock after inactivity:**

- Ubuntu's built-in auto-lock can be configured (e.g., lock after 5 minutes of inactivity).
- Same unlock flow as above.

**Important:** This uses Ubuntu's native lock screen, which is tied to system security. It cannot be bypassed without the user's password.

---

### 3.3 Future: AKIOR Lock Overlay (Phase B)

**Scenario:** User wants to quickly lock AKIOR without triggering the full OS lock screen.

**Flow:**

1. User clicks **"Lock AKIOR"** button in UI (e.g., in settings or a quick-action menu).
2. AKIOR displays a **full-screen PIN overlay**:
   - Branded background (AKIOR logo, dark theme).
   - Numeric keypad (0-9, Enter, Clear).
   - "Enter PIN to unlock" prompt.
3. User enters correct PIN → overlay dismisses → dashboard resumes.
4. Incorrect PIN → error message, retry.

**Auto-lock variant:**

- AKIOR can auto-lock after inactivity (configurable in settings).
- Same unlock flow as manual lock.

**Security note:** This is a **convenience layer**, not a replacement for Ubuntu's lock screen. A technically savvy user could still bypass it by switching to a different TTY or killing the AKIOR process. For real security, use Ubuntu's lock screen (Super+L) or Secure Workstation Mode.

---

### 3.4 Appliance Mode Variant (Auto-login)

**Flow:**

1. **Boot** → Ubuntu auto-logs in to `akior-kiosk` account.
2. Auto-start script launches AKIOR full-screen.
3. User sees AKIOR UI immediately (no login prompt).
4. Lock (if future AKIOR PIN is implemented) → AKIOR PIN overlay → unlock with PIN.

**No Ubuntu lock screen in this mode** unless manually triggered (Super+L still works, but users typically won't use it).

---

## 4. Implementation Phases

This section outlines the concrete steps to implement Ubuntu shell integration. Each phase builds on the previous one.

---

### Phase A – Ubuntu Shell Integration (Kiosk Startup)

**Goal:** Make AKIOR launch full-screen on Ubuntu login, with minimal visible desktop elements.

**Scope:**

- Keep Ubuntu login and lock screen **enabled** (Secure Workstation Mode).
- Theme GDM login/lock screen with AKIOR branding.
- Auto-start AKIOR in full-screen kiosk mode after login.
- Hide traditional Ubuntu desktop elements (panels, dock, etc.).

**Tasks:**

1. **Theme GDM login and lock screen:**
   - Replace default Ubuntu wallpaper with AKIOR-branded background (dark, logo).
   - Optionally customize GDM CSS for logo placement.
   - Ensure lock screen uses same themed background.

2. **Choose kiosk technology:**
   - **Option A: Full-screen browser (Chromium/Chrome in kiosk mode)**:
     - Launch Chromium with `--kiosk --app=https://localhost:3000` flags.
     - Disable browser chrome (no URL bar, tabs, menus).
     - Enable auto-reconnect if AKIOR server restarts.
   - **Option B: Electron app wrapper**:
     - Package AKIOR UI in an Electron app.
     - Configure frameless window, full-screen by default.
     - Better control over security, updates, and app lifecycle.
   - **Recommendation**: Start with **Option A (browser kiosk)** for simplicity, migrate to **Option B (Electron)** if needed for deeper integration.

3. **Auto-start AKIOR on login:**
   - Add a `.desktop` file to `~/.config/autostart/` (or systemwide `/etc/xdg/autostart/`).
   - Example: `akior-kiosk.desktop`:
     ```desktop
     [Desktop Entry]
     Type=Application
     Name=AKIOR Kiosk
     Exec=/usr/bin/chromium --kiosk --app=https://localhost:3000 --disable-infobars --no-first-run
     X-GNOME-Autostart-enabled=true
     ```
   - Ensure AKIOR server (Fastify backend) is also auto-started via systemd service.

4. **Hide Ubuntu desktop elements:**
   - Disable GNOME Shell panels and dock:
     - Use GNOME extensions to hide top bar and dock (e.g., `Hide Top Bar`, `Dash to Panel` removal).
     - Or use a minimal window manager (e.g., Openbox) instead of GNOME Shell.
   - Ensure no desktop icons or file manager windows appear on login.

5. **Systemd service for AKIOR backend:**
   - Create `/etc/systemd/system/akior-server.service`:
     ```ini
     [Unit]
     Description=AKIOR V5 Backend Server
     After=network.target

     [Service]
     Type=simple
     User=akior
     WorkingDirectory=/opt/akior-v5
     ExecStart=/usr/bin/node /opt/akior-v5/apps/server/dist/index.js
     Restart=always
     RestartSec=5

     [Install]
     WantedBy=multi-user.target
     ```
   - Enable and start: `systemctl enable akior-server && systemctl start akior-server`.

6. **GPU drivers and dependencies:**
   - Ensure NVIDIA/AMD GPU drivers are installed for 3D rendering.
   - Verify WebGL works in Chromium.
   - Install mkcert and configure HTTPS certificates for localhost.

7. **Test and validate:**
   - Reboot → verify GDM login screen is themed.
   - Log in → verify AKIOR launches full-screen automatically.
   - Verify Super+L locks correctly and unlock resumes AKIOR.
   - Verify no desktop elements visible.

**Deliverables (Phase A):**

- Themed GDM login/lock screen.
- Auto-start configuration for AKIOR (browser or Electron).
- Systemd service for AKIOR backend.
- Documentation for installation and configuration.

**Target version:** v6.0.0 or v6.1.0 (future release line).

---

### Phase B – AKIOR PIN Lock (In-UI Security Layer)

**Goal:** Add a convenient, branded PIN lock overlay inside AKIOR UI.

**Scope:**

- Implement a React component for full-screen PIN entry overlay.
- Store PIN securely (hashed, encrypted) in AKIOR settings.
- Support manual "Lock AKIOR" action and auto-lock after inactivity.
- Integrate with existing AKIOR UI theme and branding.

**Tasks:**

1. **Design PIN overlay UI:**
   - Full-screen centered modal with dark background.
   - AKIOR logo at top.
   - Numeric keypad (0-9, Enter, Clear buttons).
   - "Enter PIN to unlock" prompt.
   - Error state for incorrect PIN.

2. **Backend: PIN storage and validation:**
   - Add `akiorPinHash` field to settings (SHA-256 hash of PIN).
   - API endpoint: `POST /api/settings/pin/validate` → returns `{ valid: boolean }`.
   - API endpoint: `POST /api/settings/pin/set` → stores new PIN hash.

3. **Frontend: Lock state management:**
   - Add global `isLocked` state in React context or Zustand store.
   - When locked, render PIN overlay on top of all other UI.
   - On successful PIN entry, clear `isLocked` state.

4. **Manual lock action:**
   - Add "Lock AKIOR" button in settings or quick-action menu.
   - On click, set `isLocked = true`.

5. **Auto-lock after inactivity:**
   - Track user activity (mouse, keyboard events).
   - If no activity for X minutes (configurable), set `isLocked = true`.
   - Reset timer on any user interaction.

6. **Security considerations:**
   - PIN is NOT a replacement for Ubuntu lock screen (users can bypass via TTY or process kill).
   - Store PIN hash, never plaintext.
   - Consider rate-limiting failed PIN attempts.

7. **Test and validate:**
   - Lock manually → verify overlay appears.
   - Enter correct PIN → verify unlock.
   - Enter incorrect PIN → verify error message.
   - Wait for auto-lock timeout → verify lock triggers.

**Deliverables (Phase B):**

- Reusable `PinLockOverlay` React component.
- Backend PIN validation endpoints.
- Settings UI for configuring PIN and auto-lock timeout.
- Documentation for users on how to set and use PIN lock.

**Target version:** v6.2.0 or later.

---

### Phase C – Deep OS Integration (Advanced/Future)

**Goal:** Explore deeper integration with Ubuntu for a more seamless experience.

**Scope (exploratory):**

- Custom GDM greeter or display manager for fully branded login.
- Bridge Ubuntu notifications into AKIOR notification center.
- Facial recognition or voice unlock as second factor.
- Wayland session integration for better security and compositor control.
- System-level keyboard shortcuts routed to AKIOR.

**Tasks (tentative):**

1. **Custom GDM greeter:**
   - Research GDM theming and custom greeter plugins.
   - Potentially build a React-based greeter using GDM's plugin API.
   - Show AKIOR branding, logo, and custom animations on login screen.

2. **Notification integration:**
   - Listen to Ubuntu's notification daemon (D-Bus).
   - Forward notifications to AKIOR notification center.
   - Allow AKIOR to trigger system notifications.

3. **Biometric unlock:**
   - Integrate with Linux PAM for fingerprint (libfprint).
   - Explore webcam-based facial recognition (OpenCV, face_recognition library).
   - Voice unlock via AKIOR's existing speech recognition.

4. **Wayland session:**
   - Investigate running AKIOR as a Wayland compositor client.
   - Better security (X11 allows keylogging between apps).
   - Smoother full-screen rendering.

5. **Keyboard shortcut integration:**
   - Register global shortcuts (Super+J, etc.) to trigger AKIOR actions.
   - Potentially intercept Ubuntu's default shortcuts.

**Deliverables (Phase C):**

- Research reports for each integration point.
- Prototypes for custom greeter, notification bridge, and biometric unlock.
- Decision on which features to pursue based on feasibility and user value.

**Target version:** v7.0.0 or later (long-term roadmap).

---

## 5. Security Model

### Primary Security: Ubuntu OS Layer

- **Ubuntu account password** is the **primary security boundary**.
- **Disk encryption (LUKS)** protects data at rest.
- **Lock screen** prevents unauthorized access when user steps away.
- **Standard Linux permissions** control file access.

**AKIOR does NOT replace these.** Ubuntu's security is the foundation.

### Secondary Security: AKIOR PIN Lock (Future)

- **AKIOR PIN** is a **convenience layer** for quick locking.
- It does **NOT** protect against:
  - TTY access (Ctrl+Alt+F2, etc.).
  - Process termination (kill AKIOR process).
  - Physical access to the machine.
- It **DOES** protect against:
  - Casual snooping when user steps away briefly.
  - Accidental UI access by other users in the room.

**Use case:** User is in a shared office and wants to lock AKIOR while leaving Ubuntu session running (e.g., ongoing download or server process). They use AKIOR PIN lock instead of full OS lock.

### Appliance Mode Security

- **Appliance Mode** (auto-login) is **ONLY** for controlled environments:
  - Physically secured devices (locked room, kiosk enclosure).
  - Network-isolated devices (no internet, no SSH access).
  - Devices with no sensitive data (demo stations, print queues).

**Do NOT use Appliance Mode** for:
- Personal workstations.
- Systems with API keys, credentials, or user data.
- Multi-user environments.

### Recommendations

- **For most users:** Use **Secure Workstation Mode** with Ubuntu login enabled.
- **For convenience:** Enable AKIOR PIN lock once Phase B is complete.
- **For kiosks:** Use **Appliance Mode** only in controlled physical environments.

---

## 6. Migration Plan

### When to start Ubuntu shell integration

**Current state (v5.9.0):**
- AKIOR V5 core features are stable and tested on development platforms (macOS, Windows WSL, etc.).
- All major integrations (weather, web search, local LLM, TTS, Spotify, Gmail, Calendar) are functional.
- Documentation and test plans are comprehensive.

**Ready to start Ubuntu integration when:**
1. **Core AKIOR features are stable** ✅ (already true as of v5.9.0).
2. **Target Ubuntu machine is available** with:
   - GPU drivers installed (NVIDIA/AMD).
   - Clean Ubuntu installation (22.04 LTS or 24.04 LTS recommended).
   - HTTPS certificates configured (mkcert).
3. **Phase A deliverables are scoped and assigned**:
   - GDM theming.
   - Auto-start configuration.
   - Systemd service setup.

**Migration approach:**

- **Continue developing AKIOR features** on current platforms (macOS, WSL) in parallel.
- **Dedicate a separate Ubuntu workstation** or VM for shell integration work.
- **Use feature flags** or environment variables to enable Ubuntu-specific features (e.g., `AKIOR_UBUNTU_MODE=kiosk`).

### Version planning

- **Phase A (Ubuntu Shell Integration)** will be released as **v6.0.0** or **v6.1.0**.
- **Phase B (AKIOR PIN Lock)** will be released as **v6.2.0** or later.
- **Phase C (Deep OS Integration)** is **exploratory** and will be scoped in future planning docs.

### Documentation updates needed before Phase A

- Update `AKIOR_V5_REPO_OVERVIEW.md` to mention Ubuntu shell mode.
- Create installation guide: `UBUNTU_INSTALLATION_GUIDE.md`.
- Create troubleshooting guide: `UBUNTU_TROUBLESHOOTING.md`.
- Update `AKIOR_V5_TEST_PLAN.md` to include Ubuntu-specific test cases.

---

## 7. Summary

This document defines the architecture and migration plan for running **AKIOR V5 OS as a branded shell on Ubuntu**.

**Key decisions:**

- **Secure Workstation Mode** (Ubuntu login + lock enabled) is the **recommended default**.
- **Appliance Mode** (auto-login) is available for controlled kiosk environments only.
- **Implementation is phased**:
  - **Phase A**: Kiosk startup with themed login (v6.0.0+).
  - **Phase B**: AKIOR PIN lock overlay (v6.2.0+).
  - **Phase C**: Deep OS integration (v7.0.0+).

**Non-goals for v5.x/early v6.x:**

- No custom display manager or PAM modules.
- No replacement of Ubuntu's core security systems.
- No full notification integration yet (Phase C).

**Next steps:**

1. **Commit this plan** to the repository.
2. **Assign Phase A tasks** to implementation tickets.
3. **Provision Ubuntu workstation** for development and testing.
4. **Create installation and setup guides** for Phase A.

This plan is now ready for the CTO to review and approve.
