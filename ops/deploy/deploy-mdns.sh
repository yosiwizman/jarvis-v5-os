#!/usr/bin/env bash
# ops/deploy/deploy-mdns.sh
# Deploy Avahi mDNS daemon for LAN hostname resolution

set -euo pipefail

log() {
  echo "[$(date -Is)] $*"
}

log "Installing Avahi daemon for mDNS..."
bash ops/linux/lan-mdns/install.sh

log "Deploying systemd wrapper unit..."
sudo cp deploy/systemd/akior-avahi.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable akior-avahi.service
sudo systemctl start akior-avahi.service

log "Verifying Avahi status..."
bash ops/linux/lan-mdns/status.sh

log "mDNS deployment complete"
