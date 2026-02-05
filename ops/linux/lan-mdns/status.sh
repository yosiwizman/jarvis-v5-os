#!/usr/bin/env bash
# ops/linux/lan-mdns/status.sh
# Check Avahi daemon status and mDNS functionality

set -euo pipefail

echo "=== Avahi Daemon Status ==="
systemctl --no-pager -l status avahi-daemon || true

echo ""
echo "=== mDNS Query Test ==="
echo "Querying akior.local via mDNS..."
dig +short @127.0.0.1 -p 5353 akior.local 2>/dev/null || echo "Direct mDNS query failed (may need avahi-browse)"

echo ""
echo "=== DNS-SD Service Discovery ==="
dig +short @127.0.0.1 -p 5353 _services._dns-sd._udp.local PTR 2>/dev/null || echo "Service discovery query failed"

echo ""
echo "=== Hostname Resolution Test ==="
getent hosts akior.local || echo "akior.local not resolvable via NSS"
