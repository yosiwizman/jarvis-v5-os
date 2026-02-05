#!/bin/bash
# Setup Auto-Deployment for JARVIS
# 
# This script installs systemd services that automatically redeploy
# JARVIS whenever you run 'git pull' on the server.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Setting up auto-deployment for JARVIS..."

# Make deploy.sh executable
chmod +x "$REPO_ROOT/ops/deploy.sh"
echo "✓ Made deploy.sh executable"

# Copy systemd units
echo "Installing systemd units..."
sudo cp "$REPO_ROOT/ops/jarvis-auto-deploy.service" /etc/systemd/system/
sudo cp "$REPO_ROOT/ops/jarvis-auto-deploy.path" /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload
echo "✓ Systemd units installed"

# Enable and start the path watcher
sudo systemctl enable jarvis-auto-deploy.path
sudo systemctl start jarvis-auto-deploy.path
echo "✓ Auto-deploy watcher enabled and started"

# Check status
echo ""
echo "Auto-deployment setup complete!"
echo ""
echo "Status:"
sudo systemctl status jarvis-auto-deploy.path --no-pager
echo ""
echo "Now, whenever you run 'git pull' in $REPO_ROOT,"
echo "the system will automatically rebuild and redeploy JARVIS."
echo ""
echo "Manual deployment: $REPO_ROOT/ops/deploy.sh"
echo "View logs: sudo journalctl -u jarvis-auto-deploy -f"
