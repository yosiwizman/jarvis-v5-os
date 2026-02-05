#!/usr/bin/env bash
# ops/verify/lan-mdns-check.sh
# Verify that akior.local is accessible and mDNS is advertising

set -euo pipefail

echo "=== Testing HTTPS connectivity to akior.local ==="
if curl -k --silent --fail --max-time 10 https://akior.local/menu >/dev/null 2>&1; then
  echo "✓ HTTPS to akior.local/menu succeeded"
else
  echo "✗ HTTPS to akior.local/menu failed"
  exit 1
fi

echo ""
echo "=== Checking mDNS resolution ==="
IP=$(dig +short @127.0.0.1 -p 5353 akior.local 2>/dev/null | grep -Eo "([0-9]{1,3}\.){3}[0-9]{1,3}" | head -n 1)
if [ -n "$IP" ]; then
  echo "✓ mDNS query returned: $IP"
else
  echo "⚠ mDNS query failed, checking NSS fallback..."
  IP=$(getent hosts akior.local | awk '{print $1}' | head -n 1)
  if [ -n "$IP" ]; then
    echo "✓ NSS resolution returned: $IP"
  else
    echo "✗ No resolution for akior.local"
    exit 1
  fi
fi

echo ""
echo "=== Avahi daemon status ==="
if systemctl is-active --quiet avahi-daemon; then
  echo "✓ Avahi daemon is active"
else
  echo "✗ Avahi daemon is not running"
  exit 1
fi

echo ""
echo "✅ LAN mDNS verification PASSED"
