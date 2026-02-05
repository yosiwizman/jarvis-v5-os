#!/usr/bin/env bash
# ops/linux/lan-mdns/install.sh
# Install and configure Avahi daemon for mDNS hostname resolution

set -euo pipefail

echo "[avahi-install] Updating package cache..."
sudo apt-get update -y

echo "[avahi-install] Installing avahi-daemon and libnss-mdns..."
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y avahi-daemon libnss-mdns

echo "[avahi-install] Enabling and starting avahi-daemon..."
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon

echo "[avahi-install] Avahi daemon status:"
systemctl is-active avahi-daemon || true

echo "[avahi-install] Complete - mDNS hostnames should now be advertised on the LAN"
