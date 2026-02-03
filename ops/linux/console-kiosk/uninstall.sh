#!/bin/bash
#
# AKIOR Console Kiosk - Uninstall Script
# Removes the kiosk configuration while preserving SSH access.
#
# Usage: sudo ./uninstall.sh [--remove-user] [--remove-packages]
#   --remove-user      Also remove the akior-kiosk user and home directory
#   --remove-packages  Also remove GUI packages (xorg, openbox, chromium)
#

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================
KIOSK_USER="akior-kiosk"
KIOSK_SERVICE="akior-kiosk"
KIOSK_HOSTNAME="akior.home.arpa"
REMOVE_USER=false
REMOVE_PACKAGES=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --remove-user)
            REMOVE_USER=true
            shift
            ;;
        --remove-packages)
            REMOVE_PACKAGES=true
            shift
            ;;
        -h|--help)
            echo "Usage: sudo $0 [--remove-user] [--remove-packages]"
            echo "  --remove-user      Remove the kiosk user and home directory"
            echo "  --remove-packages  Remove GUI packages (xorg, openbox, chromium)"
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
echo "AKIOR Console Kiosk Uninstaller"
echo "========================================"
echo ""

# Must be root
if [[ $EUID -ne 0 ]]; then
    echo "ERROR: This script must be run as root (sudo)."
    exit 1
fi

echo "Options:"
echo "  Remove kiosk user:    $REMOVE_USER"
echo "  Remove GUI packages:  $REMOVE_PACKAGES"
echo ""

# ============================================================================
# Step 1: Stop and Disable Service
# ============================================================================
echo "[1/5] Stopping kiosk service..."

if systemctl is-active --quiet "${KIOSK_SERVICE}.service" 2>/dev/null; then
    systemctl stop "${KIOSK_SERVICE}.service"
    echo "  ✓ Service stopped"
else
    echo "  Service not running"
fi

if systemctl is-enabled --quiet "${KIOSK_SERVICE}.service" 2>/dev/null; then
    systemctl disable "${KIOSK_SERVICE}.service"
    echo "  ✓ Service disabled"
else
    echo "  Service not enabled"
fi

# ============================================================================
# Step 2: Remove Systemd Service File
# ============================================================================
echo "[2/5] Removing systemd service..."

SERVICE_FILE="/etc/systemd/system/${KIOSK_SERVICE}.service"
if [[ -f "$SERVICE_FILE" ]]; then
    rm -f "$SERVICE_FILE"
    systemctl daemon-reload
    echo "  ✓ Removed $SERVICE_FILE"
else
    echo "  Service file not found"
fi

# Reset default target to multi-user (no GUI)
systemctl set-default multi-user.target
echo "  ✓ Default target set to multi-user (console only)"

# ============================================================================
# Step 3: Remove /etc/hosts Entry
# ============================================================================
echo "[3/5] Cleaning /etc/hosts..."

if grep -q "$KIOSK_HOSTNAME" /etc/hosts 2>/dev/null; then
    sed -i "/$KIOSK_HOSTNAME/d" /etc/hosts
    echo "  ✓ Removed $KIOSK_HOSTNAME from /etc/hosts"
else
    echo "  No kiosk entry found in /etc/hosts"
fi

# ============================================================================
# Step 4: Remove Kiosk User (Optional)
# ============================================================================
echo "[4/5] Handling kiosk user..."

if $REMOVE_USER; then
    if id "$KIOSK_USER" &>/dev/null; then
        # Kill any processes owned by the user
        pkill -u "$KIOSK_USER" 2>/dev/null || true
        sleep 1
        
        # Remove user and home directory
        userdel -r "$KIOSK_USER" 2>/dev/null || userdel "$KIOSK_USER"
        echo "  ✓ User '$KIOSK_USER' and home directory removed"
    else
        echo "  User '$KIOSK_USER' not found"
    fi
else
    if id "$KIOSK_USER" &>/dev/null; then
        echo "  User '$KIOSK_USER' preserved (use --remove-user to delete)"
    else
        echo "  User '$KIOSK_USER' not found"
    fi
fi

# ============================================================================
# Step 5: Remove GUI Packages (Optional)
# ============================================================================
echo "[5/5] Handling GUI packages..."

if $REMOVE_PACKAGES; then
    echo "  Removing GUI packages..."
    
    # Remove snap chromium
    if snap list chromium &>/dev/null 2>&1; then
        snap remove chromium
        echo "  ✓ Removed Chromium (snap)"
    fi
    
    # Remove apt packages
    apt-get remove -y --purge \
        xorg \
        xinit \
        openbox \
        x11-xserver-utils \
        unclutter \
        2>/dev/null || true
    
    apt-get autoremove -y 2>/dev/null || true
    
    echo "  ✓ GUI packages removed"
else
    echo "  GUI packages preserved (use --remove-packages to delete)"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "========================================"
echo "Uninstall Complete!"
echo "========================================"
echo ""
echo "The AKIOR Console Kiosk has been removed."
echo ""
echo "The system will now boot to a standard text console."
echo "SSH access is unaffected."
echo ""

if ! $REMOVE_USER && id "$KIOSK_USER" &>/dev/null 2>&1; then
    echo "Note: The '$KIOSK_USER' user still exists."
    echo "  To remove: sudo userdel -r $KIOSK_USER"
    echo ""
fi

if ! $REMOVE_PACKAGES; then
    echo "Note: GUI packages (xorg, openbox, chromium) still installed."
    echo "  To remove: sudo apt remove xorg xinit openbox && sudo snap remove chromium"
    echo ""
fi

echo "Reboot recommended to ensure clean state."
echo ""
