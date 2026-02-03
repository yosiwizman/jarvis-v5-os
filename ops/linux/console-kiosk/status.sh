#!/bin/bash
#
# AKIOR Console Kiosk - Status Script
# Reports the current state of the kiosk configuration.
#
# Usage: ./status.sh [--logs N]
#   --logs N   Show last N lines of kiosk journal (default: 50)
#

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================
KIOSK_USER="akior-kiosk"
KIOSK_SERVICE="akior-kiosk"
KIOSK_HOSTNAME="akior.home.arpa"
LOG_LINES=50

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --logs)
            LOG_LINES="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--logs N]"
            echo "  --logs N   Show last N lines of kiosk journal (default: 50)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ============================================================================
# Status Report
# ============================================================================
echo "========================================"
echo "AKIOR Console Kiosk Status"
echo "========================================"
echo ""
echo "Timestamp: $(date)"
echo ""

# ============================================================================
# 1. Package Status
# ============================================================================
echo "--- Package Status ---"

check_package() {
    local pkg="$1"
    if dpkg -l "$pkg" 2>/dev/null | grep -q "^ii"; then
        echo "  ✓ $pkg: installed (apt)"
        return 0
    fi
    return 1
}

check_snap() {
    local pkg="$1"
    if snap list "$pkg" &>/dev/null 2>&1; then
        local version
        version=$(snap list "$pkg" 2>/dev/null | awk 'NR==2 {print $2}')
        echo "  ✓ $pkg: installed (snap, version $version)"
        return 0
    fi
    return 1
}

# X server
if check_package xorg 2>/dev/null; then
    :
else
    echo "  ✗ xorg: not installed"
fi

# Openbox
if check_package openbox 2>/dev/null; then
    :
else
    echo "  ✗ openbox: not installed"
fi

# Chromium
if check_snap chromium; then
    :
elif command -v chromium-browser &>/dev/null; then
    echo "  ✓ chromium-browser: installed (apt)"
elif command -v chromium &>/dev/null; then
    echo "  ✓ chromium: installed"
else
    echo "  ✗ chromium: not installed"
fi

# Utilities
if check_package unclutter 2>/dev/null; then
    :
else
    echo "  ✗ unclutter: not installed"
fi

echo ""

# ============================================================================
# 2. Kiosk User Status
# ============================================================================
echo "--- Kiosk User ---"

if id "$KIOSK_USER" &>/dev/null; then
    GROUPS=$(id -nG "$KIOSK_USER" 2>/dev/null | tr ' ' ',')
    echo "  ✓ User '$KIOSK_USER' exists"
    echo "    Groups: $GROUPS"
    
    KIOSK_HOME="/home/$KIOSK_USER"
    if [[ -d "$KIOSK_HOME" ]]; then
        echo "    Home: $KIOSK_HOME"
        
        # Check for kiosk script
        if [[ -f "$KIOSK_HOME/start-kiosk.sh" ]]; then
            echo "    ✓ start-kiosk.sh exists"
        else
            echo "    ✗ start-kiosk.sh missing"
        fi
        
        # Check for .xinitrc
        if [[ -f "$KIOSK_HOME/.xinitrc" ]]; then
            echo "    ✓ .xinitrc exists"
        else
            echo "    ✗ .xinitrc missing"
        fi
        
        # Check for Openbox autostart
        if [[ -f "$KIOSK_HOME/.config/openbox/autostart" ]]; then
            echo "    ✓ Openbox autostart exists"
        else
            echo "    ✗ Openbox autostart missing"
        fi
    else
        echo "    ✗ Home directory not found"
    fi
else
    echo "  ✗ User '$KIOSK_USER' does not exist"
fi

echo ""

# ============================================================================
# 3. Systemd Service Status
# ============================================================================
echo "--- Systemd Service ---"

SERVICE_FILE="/etc/systemd/system/${KIOSK_SERVICE}.service"

if [[ -f "$SERVICE_FILE" ]]; then
    echo "  ✓ Service file exists: $SERVICE_FILE"
else
    echo "  ✗ Service file not found"
fi

# Check if enabled
if systemctl is-enabled --quiet "${KIOSK_SERVICE}.service" 2>/dev/null; then
    echo "  ✓ Service enabled"
else
    echo "  ✗ Service not enabled"
fi

# Check if active
if systemctl is-active --quiet "${KIOSK_SERVICE}.service" 2>/dev/null; then
    echo "  ✓ Service active (running)"
    
    # Get PID
    MAIN_PID=$(systemctl show "${KIOSK_SERVICE}.service" --property=MainPID --value 2>/dev/null || echo "unknown")
    echo "    Main PID: $MAIN_PID"
else
    ACTIVE_STATE=$(systemctl show "${KIOSK_SERVICE}.service" --property=ActiveState --value 2>/dev/null || echo "unknown")
    echo "  ○ Service not active (state: $ACTIVE_STATE)"
fi

# Default target
DEFAULT_TARGET=$(systemctl get-default 2>/dev/null || echo "unknown")
echo "  Default target: $DEFAULT_TARGET"

echo ""

# ============================================================================
# 4. Kiosk URL Configuration
# ============================================================================
echo "--- Kiosk URL ---"

# Try to extract URL from service file
if [[ -f "$SERVICE_FILE" ]]; then
    URL=$(grep "Environment=KIOSK_URL=" "$SERVICE_FILE" 2>/dev/null | cut -d= -f3 || echo "")
    if [[ -n "$URL" ]]; then
        echo "  Target URL: $URL"
    else
        echo "  Target URL: (not configured in service)"
    fi
fi

# Check /etc/hosts
if grep -q "$KIOSK_HOSTNAME" /etc/hosts 2>/dev/null; then
    HOSTS_ENTRY=$(grep "$KIOSK_HOSTNAME" /etc/hosts | head -1)
    echo "  /etc/hosts: $HOSTS_ENTRY"
else
    echo "  /etc/hosts: no entry for $KIOSK_HOSTNAME"
fi

echo ""

# ============================================================================
# 5. X Server Status
# ============================================================================
echo "--- X Server ---"

if pgrep -x Xorg &>/dev/null || pgrep -x X &>/dev/null; then
    X_PID=$(pgrep -x Xorg 2>/dev/null || pgrep -x X 2>/dev/null || echo "unknown")
    echo "  ✓ X server running (PID: $X_PID)"
    
    # Check display
    if [[ -n "${DISPLAY:-}" ]]; then
        echo "    DISPLAY: $DISPLAY"
    fi
else
    echo "  ○ X server not running"
fi

# Check for Chromium process
if pgrep -f "chromium.*kiosk" &>/dev/null; then
    CHROMIUM_PID=$(pgrep -f "chromium.*kiosk" | head -1)
    echo "  ✓ Chromium kiosk running (PID: $CHROMIUM_PID)"
elif pgrep -f chromium &>/dev/null; then
    CHROMIUM_PID=$(pgrep -f chromium | head -1)
    echo "  ○ Chromium running (PID: $CHROMIUM_PID) but may not be in kiosk mode"
else
    echo "  ○ Chromium not running"
fi

echo ""

# ============================================================================
# 6. Recent Journal Logs
# ============================================================================
echo "--- Recent Kiosk Logs (last $LOG_LINES lines) ---"

if systemctl is-enabled --quiet "${KIOSK_SERVICE}.service" 2>/dev/null || [[ -f "$SERVICE_FILE" ]]; then
    journalctl -u "${KIOSK_SERVICE}.service" -n "$LOG_LINES" --no-pager 2>/dev/null || echo "  (no logs available)"
else
    echo "  (service not configured)"
fi

echo ""
echo "========================================"
echo "End of Status Report"
echo "========================================"
