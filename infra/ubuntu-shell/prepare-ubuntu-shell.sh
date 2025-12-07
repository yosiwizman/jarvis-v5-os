#!/bin/bash
#
# Jarvis V6 Ubuntu Shell - Phase A Setup Helper
#
# This script performs NON-DESTRUCTIVE checks and prints
# instructions for setting up Jarvis as an Ubuntu shell/kiosk.
#
# It does NOT make any system changes automatically.
# You must manually follow the printed instructions.
#
# Usage:
#   bash prepare-ubuntu-shell.sh
#

set -e

echo "========================================"
echo "Jarvis V6 Ubuntu Shell - Phase A Setup"
echo "========================================"
echo ""

# Check OS
if [[ "$(uname -s)" != "Linux" ]]; then
    echo "❌ ERROR: This script is for Linux/Ubuntu only."
    echo "   Detected OS: $(uname -s)"
    echo ""
    echo "   Jarvis dev mode works on Windows/macOS."
    echo "   Ubuntu shell mode is for production kiosk deployments."
    exit 1
fi

echo "✓ Running on Linux"
echo ""

# Detect Ubuntu version
if [ -f /etc/os-release ]; then
    source /etc/os-release
    echo "✓ Detected: $PRETTY_NAME"
    echo ""
else
    echo "⚠ Warning: Could not detect Ubuntu version"
    echo ""
fi

# Check for browsers
echo "Checking for available browsers..."
BROWSER_FOUND=false

if command -v chromium-browser &> /dev/null; then
    echo "  ✓ Chromium: $(chromium-browser --version)"
    BROWSER_FOUND=true
    BROWSER_PATH="/usr/bin/chromium-browser"
elif command -v chromium &> /dev/null; then
    echo "  ✓ Chromium: $(chromium --version)"
    BROWSER_FOUND=true
    BROWSER_PATH="/usr/bin/chromium"
fi

if command -v google-chrome &> /dev/null; then
    echo "  ✓ Google Chrome: $(google-chrome --version)"
    BROWSER_FOUND=true
    BROWSER_PATH="/usr/bin/google-chrome"
fi

if command -v brave-browser &> /dev/null; then
    echo "  ✓ Brave: $(brave-browser --version)"
    BROWSER_FOUND=true
    BROWSER_PATH="/usr/bin/brave-browser"
fi

if [ "$BROWSER_FOUND" = false ]; then
    echo "  ❌ No supported browser found"
    echo ""
    echo "  Install Chromium or Google Chrome:"
    echo "    sudo apt update"
    echo "    sudo apt install chromium-browser"
    echo "  OR"
    echo "    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -"
    echo "    sudo sh -c 'echo \"deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main\" >> /etc/apt/sources.list.d/google-chrome.list'"
    echo "    sudo apt update"
    echo "    sudo apt install google-chrome-stable"
    echo ""
    exit 1
fi

echo ""

# Check Node.js
if command -v node &> /dev/null; then
    echo "✓ Node.js: $(node --version)"
else
    echo "❌ Node.js not found - install Node.js 20+ first"
    exit 1
fi

if command -v npm &> /dev/null; then
    echo "✓ npm: $(npm --version)"
else
    echo "❌ npm not found - install npm first"
    exit 1
fi

echo ""

# Get repo directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Jarvis repository detected at:"
echo "  $REPO_ROOT"
echo ""

# Check if services exist
USER_SYSTEMD_DIR="$HOME/.config/systemd/user"
if [ -d "$USER_SYSTEMD_DIR" ]; then
    echo "✓ User systemd directory exists: $USER_SYSTEMD_DIR"
else
    echo "ℹ User systemd directory not found (will be created during setup)"
fi

echo ""
echo "========================================"
echo "SETUP INSTRUCTIONS"
echo "========================================"
echo ""
echo "Phase A delivers a secure workstation mode where Jarvis runs"
echo "as a full-screen kiosk after Ubuntu login."
echo ""
echo "Follow these steps to complete setup:"
echo ""

# Step 1: Build
echo "STEP 1: Build Jarvis for production"
echo "---------------------------------------"
echo "cd $REPO_ROOT"
echo "npm run build"
echo ""

# Step 2: Server service
echo "STEP 2: Install Jarvis server service"
echo "---------------------------------------"
echo "mkdir -p ~/.config/systemd/user"
echo "cp $SCRIPT_DIR/jarvis-server.service.example ~/.config/systemd/user/jarvis-server.service"
echo ""
echo "# Edit the service file and replace placeholders:"
echo "nano ~/.config/systemd/user/jarvis-server.service"
echo "#   - Change /home/<USERNAME>/jarvis-v5-os to: $REPO_ROOT"
echo "#   - Verify NODE_ENV and other settings"
echo ""
echo "# Reload and enable:"
echo "systemctl --user daemon-reload"
echo "systemctl --user enable jarvis-server.service"
echo "systemctl --user start jarvis-server.service"
echo ""
echo "# Check status:"
echo "systemctl --user status jarvis-server.service"
echo ""

# Step 3: Kiosk service
echo "STEP 3: Install Jarvis kiosk browser service"
echo "---------------------------------------"
echo "cp $SCRIPT_DIR/jarvis-kiosk.service.example ~/.config/systemd/user/jarvis-kiosk.service"
echo ""
echo "# Edit the service file if needed:"
echo "nano ~/.config/systemd/user/jarvis-kiosk.service"
echo "#   - Change /home/<USERNAME>/.Xauthority to your actual path"
echo "#   - Adjust browser path if using Chrome instead of Chromium"
echo "#   - Modify URL if needed (default: https://localhost:3000)"
echo ""
echo "# Reload and enable:"
echo "systemctl --user daemon-reload"
echo "systemctl --user enable jarvis-kiosk.service"
echo "systemctl --user start jarvis-kiosk.service"
echo ""
echo "# Check status:"
echo "systemctl --user status jarvis-kiosk.service"
echo ""

# Alternative: Desktop file
echo "ALTERNATIVE: Use .desktop autostart instead of systemd"
echo "---------------------------------------"
echo "mkdir -p ~/.config/autostart"
echo "cp $SCRIPT_DIR/jarvis-kiosk.desktop.example ~/.config/autostart/jarvis-kiosk.desktop"
echo "chmod +x ~/.config/autostart/jarvis-kiosk.desktop"
echo ""
echo "# Edit if needed, then log out and back in"
echo ""

# Step 4: Testing
echo "STEP 4: Testing"
echo "---------------------------------------"
echo "# View server logs:"
echo "journalctl --user -u jarvis-server.service -f"
echo ""
echo "# View kiosk logs:"
echo "journalctl --user -u jarvis-kiosk.service -f"
echo ""
echo "# Stop services:"
echo "systemctl --user stop jarvis-kiosk.service"
echo "systemctl --user stop jarvis-server.service"
echo ""
echo "# Restart services:"
echo "systemctl --user restart jarvis-server.service"
echo "systemctl --user restart jarvis-kiosk.service"
echo ""

# Troubleshooting
echo "TROUBLESHOOTING"
echo "---------------------------------------"
echo "If kiosk browser doesn't start:"
echo "  - Check DISPLAY: echo \$DISPLAY"
echo "  - Test manually: $BROWSER_PATH --app=https://localhost:3000"
echo "  - Check certificate: curl -k https://localhost:3000"
echo "  - Check server: systemctl --user status jarvis-server.service"
echo ""
echo "If server fails to start:"
echo "  - Check Node.js: node --version"
echo "  - Check repo path in service file"
echo "  - View logs: journalctl --user -u jarvis-server.service -n 50"
echo ""

echo "========================================"
echo "Setup helper complete!"
echo "========================================"
echo ""
echo "For detailed documentation, see:"
echo "  $REPO_ROOT/docs/UBUNTU_SHELL_PHASE_A_IMPLEMENTATION.md"
echo ""
echo "⚠ Remember: This script does NOT make changes automatically."
echo "   Follow the printed instructions above to complete setup."
echo ""
