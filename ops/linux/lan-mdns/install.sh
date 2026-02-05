#!/usr/bin/env bash
# ops/linux/lan-mdns/install.sh
# Install and configure Avahi daemon for mDNS hostname resolution

set -euo pipefail

echo "[avahi-install] Updating package cache..."
sudo apt-get update -y

echo "[avahi-install] Installing avahi-daemon and libnss-mdns..."
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y avahi-daemon libnss-mdns

echo "[avahi-install] Configuring Avahi to advertise 'akior.local'..."
# Backup original config if it exists
if [[ -f /etc/avahi/avahi-daemon.conf ]] && [[ ! -f /etc/avahi/avahi-daemon.conf.bak ]]; then
  sudo cp /etc/avahi/avahi-daemon.conf /etc/avahi/avahi-daemon.conf.bak
fi

# Apply hostname override (sets mDNS hostname to 'akior')
if grep -q "^host-name=" /etc/avahi/avahi-daemon.conf; then
  sudo sed -i 's/^host-name=.*/host-name=akior/' /etc/avahi/avahi-daemon.conf
else
  sudo sed -i '/^\[server\]/a host-name=akior' /etc/avahi/avahi-daemon.conf
fi

# Install service definitions for HTTP/HTTPS
echo "[avahi-install] Installing Avahi service definitions..."
sudo cp deploy/avahi/akior-cnames.service /etc/avahi/services/

echo "[avahi-install] Enabling and restarting avahi-daemon..."
sudo systemctl enable avahi-daemon
sudo systemctl restart avahi-daemon

echo "[avahi-install] Waiting for Avahi to stabilize..."
sleep 2

echo "[avahi-install] Avahi daemon status:"
systemctl is-active avahi-daemon || true

echo "[avahi-install] Complete - akior.local should now be advertised on the LAN"
