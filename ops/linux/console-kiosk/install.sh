#!/bin/bash
#
# AKIOR Console Kiosk - Install Script
# Transforms Ubuntu Server into a dedicated AKIOR console display.
#
# Usage: sudo ./install.sh [--url URL] [--ip IP]
#   --url URL   Override the default kiosk URL (default: https://akior.home.arpa/console)
#   --ip IP     Server IP for /etc/hosts entry (default: 127.0.0.1)
#
# Requirements:
#   - Ubuntu Server 22.04+ (tested on 22.04 LTS and 24.04 LTS)
#   - Root/sudo access
#   - Network connectivity (for package installation)
#
# What this installs:
#   - Minimal X server (xorg, xinit)
#   - Openbox window manager (lightweight, no desktop environment)
#   - Chromium browser (via snap)
#   - Systemd service for kiosk auto-start
#   - Dedicated kiosk user (akior-kiosk)
#

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================
KIOSK_USER="akior-kiosk"
KIOSK_URL="https://akior.home.arpa/console"
KIOSK_IP="127.0.0.1"
KIOSK_SERVICE="akior-kiosk"
KIOSK_HOSTNAME="akior.home.arpa"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --url)
            KIOSK_URL="$2"
            shift 2
            ;;
        --ip)
            KIOSK_IP="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: sudo $0 [--url URL] [--ip IP]"
            echo "  --url URL   Kiosk target URL (default: https://akior.home.arpa/console)"
            echo "  --ip IP     Server IP for /etc/hosts (default: 127.0.0.1)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ============================================================================
# Preflight Checks
# ============================================================================
echo "========================================"
echo "AKIOR Console Kiosk Installer"
echo "========================================"
echo ""

# Must be root
if [[ $EUID -ne 0 ]]; then
    echo "ERROR: This script must be run as root (sudo)."
    exit 1
fi

# Check Ubuntu
if ! grep -qi "ubuntu" /etc/os-release 2>/dev/null; then
    echo "WARNING: This script is designed for Ubuntu. Proceed with caution."
fi

echo "Configuration:"
echo "  Kiosk User:     $KIOSK_USER"
echo "  Kiosk URL:      $KIOSK_URL"
echo "  Hosts IP:       $KIOSK_IP"
echo "  Service Name:   $KIOSK_SERVICE"
echo ""

# ============================================================================
# Step 1: Install Packages
# ============================================================================
echo "[1/7] Installing minimal GUI packages..."

apt-get update -qq

# Install X server, Openbox, and essential utilities
apt-get install -y --no-install-recommends \
    xorg \
    xinit \
    openbox \
    x11-xserver-utils \
    unclutter \
    || { echo "ERROR: Failed to install GUI packages"; exit 1; }

echo "  ✓ Xorg and Openbox installed"

# Install Chromium via snap (most reliable on Ubuntu)
if ! command -v chromium &>/dev/null && ! snap list chromium &>/dev/null; then
    echo "  Installing Chromium via snap..."
    snap install chromium || { echo "ERROR: Failed to install Chromium"; exit 1; }
fi
echo "  ✓ Chromium installed"

# ============================================================================
# Step 2: Create Kiosk User
# ============================================================================
echo "[2/7] Creating kiosk user..."

if id "$KIOSK_USER" &>/dev/null; then
    echo "  User '$KIOSK_USER' already exists"
else
    useradd -m -s /bin/bash -G video,audio,input,tty "$KIOSK_USER"
    echo "  ✓ User '$KIOSK_USER' created"
fi

# Ensure user has access to required groups
usermod -aG video,audio,input,tty "$KIOSK_USER" 2>/dev/null || true

# ============================================================================
# Step 3: Configure /etc/hosts
# ============================================================================
echo "[3/7] Configuring /etc/hosts..."

# Remove any existing entry for our hostname
sed -i "/$KIOSK_HOSTNAME/d" /etc/hosts

# Add the new entry
echo "$KIOSK_IP    $KIOSK_HOSTNAME" >> /etc/hosts
echo "  ✓ Added $KIOSK_IP -> $KIOSK_HOSTNAME to /etc/hosts"

# ============================================================================
# Step 4: Create Kiosk Launch Script
# ============================================================================
echo "[4/7] Creating kiosk launch script..."

KIOSK_HOME="/home/$KIOSK_USER"
KIOSK_SCRIPT="$KIOSK_HOME/start-kiosk.sh"

cat > "$KIOSK_SCRIPT" << 'KIOSK_SCRIPT_EOF'
#!/bin/bash
#
# AKIOR Kiosk Launch Script
# Runs X server with Openbox and Chromium in kiosk mode.
# Includes watchdog to auto-restart browser on crash.
#

# Configuration (sourced from environment or defaults)
KIOSK_URL="${KIOSK_URL:-https://akior.home.arpa/console}"

# Logging
exec > >(logger -t akior-kiosk) 2>&1
echo "Starting AKIOR Kiosk..."
echo "  URL: $KIOSK_URL"

# X server configuration
export DISPLAY=:0

# Disable screen blanking and DPMS
xset s off
xset s noblank
xset -dpms

# Hide mouse cursor after 3 seconds of inactivity
unclutter -idle 3 -root &

# Wait for X to be fully ready
sleep 2

# Chromium flags for kiosk stability
CHROMIUM_FLAGS=(
    --kiosk
    --noerrdialogs
    --disable-infobars
    --disable-session-crashed-bubble
    --disable-restore-session-state
    --disable-features=TranslateUI
    --disable-component-update
    --check-for-update-interval=31536000
    --no-first-run
    --start-fullscreen
    --autoplay-policy=no-user-gesture-required
    --disable-pinch
    --overscroll-history-navigation=0
    --ignore-certificate-errors
)

# Watchdog loop - restart Chromium if it crashes
echo "Entering kiosk watchdog loop..."
while true; do
    echo "Launching Chromium at $(date)..."
    
    # Try snap chromium first, then fall back to apt chromium
    if command -v /snap/bin/chromium &>/dev/null; then
        /snap/bin/chromium "${CHROMIUM_FLAGS[@]}" "$KIOSK_URL"
    elif command -v chromium-browser &>/dev/null; then
        chromium-browser "${CHROMIUM_FLAGS[@]}" "$KIOSK_URL"
    elif command -v chromium &>/dev/null; then
        chromium "${CHROMIUM_FLAGS[@]}" "$KIOSK_URL"
    else
        echo "ERROR: Chromium not found!"
        sleep 10
        continue
    fi
    
    EXIT_CODE=$?
    echo "Chromium exited with code $EXIT_CODE at $(date)"
    
    # Brief pause before restart to prevent CPU spin on repeated crashes
    sleep 3
done
KIOSK_SCRIPT_EOF

chmod +x "$KIOSK_SCRIPT"
chown "$KIOSK_USER:$KIOSK_USER" "$KIOSK_SCRIPT"
echo "  ✓ Created $KIOSK_SCRIPT"

# ============================================================================
# Step 5: Create Openbox Autostart
# ============================================================================
echo "[5/7] Configuring Openbox autostart..."

OPENBOX_CONFIG_DIR="$KIOSK_HOME/.config/openbox"
mkdir -p "$OPENBOX_CONFIG_DIR"

cat > "$OPENBOX_CONFIG_DIR/autostart" << AUTOSTART_EOF
# AKIOR Kiosk Openbox Autostart
# Launched automatically when Openbox starts

# Export kiosk URL for the script
export KIOSK_URL="$KIOSK_URL"

# Start the kiosk browser
$KIOSK_SCRIPT &
AUTOSTART_EOF

chown -R "$KIOSK_USER:$KIOSK_USER" "$KIOSK_HOME/.config"
echo "  ✓ Configured Openbox autostart"

# ============================================================================
# Step 6: Create .xinitrc for startx
# ============================================================================
echo "[6/7] Creating X initialization config..."

cat > "$KIOSK_HOME/.xinitrc" << XINITRC_EOF
#!/bin/bash
# AKIOR Kiosk X init
# Start Openbox as the window manager

exec openbox-session
XINITRC_EOF

chmod +x "$KIOSK_HOME/.xinitrc"
chown "$KIOSK_USER:$KIOSK_USER" "$KIOSK_HOME/.xinitrc"
echo "  ✓ Created .xinitrc"

# ============================================================================
# Step 7: Create Systemd Service
# ============================================================================
echo "[7/7] Creating systemd service..."

# Create the kiosk service
cat > "/etc/systemd/system/${KIOSK_SERVICE}.service" << SERVICE_EOF
[Unit]
Description=AKIOR Console Kiosk
After=network-online.target systemd-logind.service
Wants=network-online.target
Conflicts=getty@tty1.service

[Service]
Type=simple
User=$KIOSK_USER
Environment=KIOSK_URL=$KIOSK_URL
PAMName=login
TTYPath=/dev/tty1
StandardInput=tty
StandardOutput=journal
StandardError=journal

# Allow access to the framebuffer/GPU
SupplementaryGroups=video audio input tty

# Start X server with Openbox
ExecStart=/usr/bin/startx /home/$KIOSK_USER/.xinitrc -- :0 vt1 -keeptty -nolisten tcp

# Restart on failure
Restart=on-failure
RestartSec=5

[Install]
WantedBy=graphical.target
SERVICE_EOF

echo "  ✓ Created ${KIOSK_SERVICE}.service"

# Create graphical.target.wants directory if needed
mkdir -p /etc/systemd/system/graphical.target.wants

# Enable the service
systemctl daemon-reload
systemctl enable "${KIOSK_SERVICE}.service"

# Set default target to graphical
systemctl set-default graphical.target

echo "  ✓ Service enabled and graphical target set"

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "========================================"
echo "Installation Complete!"
echo "========================================"
echo ""
echo "The AKIOR Console Kiosk has been configured."
echo ""
echo "What happens next:"
echo "  1. On boot, the system will start the graphical target"
echo "  2. The $KIOSK_SERVICE service will launch X + Openbox"
echo "  3. Chromium will open in kiosk mode to: $KIOSK_URL"
echo "  4. If Chromium crashes, it will auto-restart"
echo ""
echo "Commands:"
echo "  Start now:    sudo systemctl start $KIOSK_SERVICE"
echo "  Stop:         sudo systemctl stop $KIOSK_SERVICE"
echo "  Status:       sudo systemctl status $KIOSK_SERVICE"
echo "  Logs:         sudo journalctl -u $KIOSK_SERVICE -f"
echo ""
echo "To activate immediately without reboot:"
echo "  sudo systemctl start $KIOSK_SERVICE"
echo ""
echo "Or reboot to start the kiosk automatically."
echo ""
